// Regression tests for the report engine's derivation checks, run against the
// deployed rules directly (src/lib/report-engine.ts is pure and import-free,
// same discipline as norbert-review-rules). The first two cases are the two
// errors that actually reached a client from a human-built report: an AOV that
// did not equal revenue over purchases, and campaign reach summed and presented
// as account reach. They stay here permanently.
//
// Run: node tests/report-engine.test.js
const { checkReport } = require("../src/lib/report-engine.ts");

let pass = 0, fail = 0;
const check = (name, cond, detail) => {
  if (cond) { pass++; console.log(`  ok    ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? "\n          " + JSON.stringify(detail) : ""}`); }
};

const win = (over = {}) => ({
  label: "this week", start: "2026-08-24", end: "2026-08-30",
  spend: 500, impressions: 100000, clicks: 2000, conversions: 4, revenue: 1000, leads: 0, reach: 8000,
  ...over,
});
const windows4 = (cur) => [win(cur), win({ label: "last week" }), win({ label: "2 weeks ago" }), win({ label: "3 weeks ago" })];
const base = (over = {}) => ({
  platform: "meta", currency: "GBP",
  windows: windows4(),
  claims: {},
  ...over,
});

// REGRESSION 1: the broken AOV. Revenue 1000 over 4 purchases is 250; a report
// stating 400 does not ship.
{
  const issues = checkReport(base({ claims: { aov: 400 } }));
  check("broken AOV is caught", issues.some((i) => i.check === "aov" && i.severity === "fail"), issues);
  const ok = checkReport(base({ claims: { aov: 250 } }));
  check("correct AOV passes", !ok.some((i) => i.check === "aov"), ok);
}

// REGRESSION 2: summed reach. Campaign reach adds to 12000, the deduplicated
// account read is 8000; a report stating 12000 is naming the sum as reach.
{
  const issues = checkReport(base({ claims: { reach: 12000 }, reachSummedAcrossCampaigns: 12000 }));
  const hit = issues.find((i) => i.check === "reach" && i.severity === "fail");
  check("summed reach reported as reach is caught", !!hit, issues);
  check("the flag names the sum as the cause", !!hit && hit.detail.includes("SUM"), hit);
  const ok = checkReport(base({ claims: { reach: 8000 }, reachSummedAcrossCampaigns: 12000 }));
  check("deduplicated reach passes", !ok.some((i) => i.check === "reach"), ok);
}

// Reach stated with no deduplicated source at all is a warning to drop it.
{
  const issues = checkReport(base({ windows: windows4({ reach: null }), claims: { reach: 12000 } }));
  check("reach without a dedup read warns", issues.some((i) => i.check === "reach" && i.severity === "warn"), issues);
}

// Event-source honesty: the "1,019 form fills" case. A custom conversion
// counted as leads must be named for what it is.
{
  const issues = checkReport(base({
    windows: windows4({ leads: 1019 }),
    eventSources: [{ label: "form fills (leads)", actionType: "offsite_conversion.custom.482203", count: 1019 }],
  }));
  check("custom conversion counted as form fills is caught", issues.some((i) => i.check === "event_sources" && i.severity === "fail"), issues);
  const honest = checkReport(base({
    windows: windows4({ leads: 30 }),
    eventSources: [{ label: "leads", actionType: "lead", count: 30 }],
  }));
  check("the platform lead action passes", !honest.some((i) => i.check === "event_sources"), honest);
  const unnamed = checkReport(base({ windows: windows4({ leads: 30 }) }));
  check("leads with no named source warns", unnamed.some((i) => i.check === "event_sources" && i.severity === "warn"), unnamed);
}

// Zero denominators: a figure divided by nothing is not a figure.
{
  const issues = checkReport(base({ windows: windows4({ conversions: 0 }), claims: { cpa: 125 } }));
  check("CPA over zero conversions fails", issues.some((i) => i.check === "cpa" && i.severity === "fail"), issues);
}

// Four-window discipline: fewer than four windows is said, never hidden.
{
  const issues = checkReport(base({ windows: [win(), win({ label: "last week" })] }));
  check("two windows carry the four-window warning", issues.some((i) => i.check === "four_windows"), issues);
  const full = checkReport(base({}));
  check("four windows carry no such warning", !full.some((i) => i.check === "four_windows"), full);
}

// Store ledger anchor: attribution 15%+ above the ledger is flagged.
{
  const issues = checkReport(base({ storeLedger: { revenue: 700, orders: 3, source: "shopify orders" } }));
  check("attribution far above the ledger warns", issues.some((i) => i.check === "store_ledger"), issues);
  const fine = checkReport(base({ storeLedger: { revenue: 980, orders: 4, source: "shopify orders" } }));
  check("attribution near the ledger passes", !fine.some((i) => i.check === "store_ledger"), fine);
}

// POAS honesty (freeze lifted 2026-09-04): the figure only exists on a fully
// costed ledger, and it must reproduce from ledger profit over spend.
{
  const ledger = { revenue: 980, orders: 4, source: "shopify orders (gopoxy)", profit: 400, cogsCoveragePct: 100 };
  const noLedger = checkReport(base({ claims: { poas: 0.8 } }));
  check("POAS without a ledger fails", noLedger.some((i) => i.check === "poas" && i.severity === "fail"), noLedger);

  const partial = checkReport(base({ claims: { poas: 0.8 }, storeLedger: { ...ledger, cogsCoveragePct: 62.5 } }));
  check("POAS on partial COGS coverage fails", partial.some((i) => i.check === "poas" && i.detail.includes("coverage")), partial);

  const wrong = checkReport(base({ claims: { poas: 1.4 }, storeLedger: ledger }));
  check("POAS not equal to profit over spend fails", wrong.some((i) => i.check === "poas" && i.detail.includes("recomputes")), wrong);

  const right = checkReport(base({ claims: { poas: 0.8 }, storeLedger: ledger }));
  check("correct POAS on full coverage passes", !right.some((i) => i.check === "poas"), right);
}

// A fully clean report produces zero issues.
{
  const issues = checkReport(base({
    claims: { aov: 250, cpa: 125, roas: 2, ctr: 2, cpm: 5, cpc: 0.25, reach: 8000 },
    reachSummedAcrossCampaigns: 12000,
  }));
  check("clean report has zero issues", issues.length === 0, issues);
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);

// Tests for Oscar's read-shaping rules (src/lib/oscar-reads.ts is pure and
// import-free, same discipline as norbert-review-rules). Two cases are the
// live failures that prompted the module and stay here permanently: a campaign
// list cut at 80 rows that looked complete, and a one-week report where the
// four-window rule needed four.
//
// Run: node tests/oscar-reads.test.js
const assert = require("node:assert/strict");
const {
  CAMPAIGN_LIST_CAP, capList, fourWeekWindows, deriveWindow, clientTypeLabel, editorKind,
  tabulateChanges, removedSummary, joinConversionConfig, labelAccess, customerIdOf,
} = require("../src/lib/oscar-reads.ts");

let n = 0;
const t = (name, fn) => { fn(); n++; console.log("  ok", name); };

// REGRESSION 1: the 80-row cut. A list of exactly the cap must not read as whole.
t("capList returns everything below the cap and says so", () => {
  const r = capList([1, 2, 3], 5);
  assert.deepEqual(r, { items: [1, 2, 3], total: 3, truncated: false });
});

t("capList at exactly the cap is not truncated", () => {
  const r = capList([1, 2, 3, 4, 5], 5);
  assert.equal(r.truncated, false);
  assert.equal(r.total, 5);
});

t("capList above the cap flags truncated and keeps the TOTAL, not the returned count", () => {
  const items = Array.from({ length: 95 }, (_, i) => ({ name: i < 90 ? `AM | ${i}` : `Shopping_${i}` }));
  const r = capList(items, 80);
  assert.equal(r.truncated, true);
  assert.equal(r.total, 95);
  assert.equal(r.items.length, 80);
  assert.ok(CAMPAIGN_LIST_CAP > 80, "the live cap must be above the 80 that hid the paused Shopping campaign");
});

// REGRESSION 2: four windows, dates as returned.
t("fourWeekWindows yields four consecutive complete weeks stepping back from the anchor", () => {
  const w = fourWeekWindows("2026-08-24", "2026-08-30");
  assert.equal(w.length, 4);
  assert.deepEqual(w.map((x) => x.label), ["this week", "last week", "2 weeks ago", "3 weeks ago"]);
  assert.deepEqual(w[0], { label: "this week", start: "2026-08-24", end: "2026-08-30" });
  assert.deepEqual(w[1], { label: "last week", start: "2026-08-17", end: "2026-08-23" });
  assert.deepEqual(w[2], { label: "2 weeks ago", start: "2026-08-10", end: "2026-08-16" });
  assert.deepEqual(w[3], { label: "3 weeks ago", start: "2026-08-03", end: "2026-08-09" });
  // Contiguous: each window ends the day before the next one starts.
  for (let i = 1; i < 4; i++) {
    const gap = (new Date(w[i - 1].start + "T00:00:00Z") - new Date(w[i].end + "T00:00:00Z")) / 86_400_000;
    assert.equal(gap, 1, `window ${i} is not contiguous with window ${i - 1}`);
  }
  // Each spans seven days, and the anchor is a Monday to Sunday.
  for (const x of w) {
    assert.equal((new Date(x.end + "T00:00:00Z") - new Date(x.start + "T00:00:00Z")) / 86_400_000 + 1, 7);
    assert.equal(new Date(x.start + "T00:00:00Z").getUTCDay(), 1);
    assert.equal(new Date(x.end + "T00:00:00Z").getUTCDay(), 0);
  }
});

t("fourWeekWindows crosses a month boundary correctly", () => {
  const w = fourWeekWindows("2026-09-07", "2026-09-13");
  assert.deepEqual(w[3], { label: "3 weeks ago", start: "2026-08-17", end: "2026-08-23" });
});

t("fourWeekWindows refuses an anchor that is not seven days", () => {
  assert.throws(() => fourWeekWindows("2026-08-24", "2026-08-31"), /expected 7/);
  assert.throws(() => fourWeekWindows("nonsense", "2026-08-30"), /bad dates/);
});

t("deriveWindow gives null, not 0 or Infinity, where the denominator is zero", () => {
  const d = deriveWindow({ spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0, conversionsByTime: 0, revenueByTime: 0 });
  assert.equal(d.cpa, null); assert.equal(d.roas, null); assert.equal(d.aov, null); assert.equal(d.ctrPct, null); assert.equal(d.avgCpc, null);
  const e = deriveWindow({ spend: 500, impressions: 100000, clicks: 2000, conversions: 4, revenue: 1000, conversionsByTime: 5, revenueByTime: 1200 });
  assert.equal(e.cpa, 125); assert.equal(e.roas, 2); assert.equal(e.aov, 250); assert.equal(e.ctrPct, 2); assert.equal(e.avgCpc, 0.25);
});

// Change history attribution.
t("clientTypeLabel names Recommendations Auto-Apply and distinguishes it from the recommendations page", () => {
  assert.match(clientTypeLabel("GOOGLE_ADS_RECOMMENDATIONS_SUBSCRIPTION"), /Auto-Apply/);
  assert.doesNotMatch(clientTypeLabel("GOOGLE_ADS_RECOMMENDATIONS"), /Auto-Apply/);
  assert.equal(clientTypeLabel(null), "unknown client");
});

t("editorKind: ours, shared, other, system", () => {
  assert.equal(editorKind("Us@Agency.com", ["us@agency.com"]), "ours");
  assert.equal(editorKind("founder@gmail.com", ["us@agency.com"], ["founder@gmail.com"]), "shared founder/freelancer login");
  assert.equal(editorKind("freelancer@ppc.com", ["us@agency.com"]), "other");
  assert.equal(editorKind(null, ["us@agency.com"]), "no user (system)");
  assert.equal(editorKind("us@agency.com", ["us@agency.com"], ["us@agency.com"]), "ours", "own wins over shared");
});

const ev = (over = {}) => ({
  at: "2026-09-01 10:00:00", user: "freelancer@ppc.com", clientType: "GOOGLE_ADS_WEB_CLIENT",
  resourceType: "CAMPAIGN", op: "UPDATE", fields: "campaign.status", campaign: "customers/1/campaigns/22",
  resourceName: "customers/1/campaigns/22", ...over,
});

t("tabulateChanges splits the count by user and client type, labels each, and counts auto-apply", () => {
  const events = [
    ev(), ev({ at: "2026-09-02 09:00:00" }),
    ev({ user: "us@agency.com", clientType: "GOOGLE_ADS_API", at: "2026-08-28 09:00:00" }),
    ev({ user: "", clientType: "GOOGLE_ADS_RECOMMENDATIONS_SUBSCRIPTION", resourceType: "AD_GROUP_CRITERION", op: "CREATE", campaign: "customers/1/campaigns/99" }),
    ev({ user: "founder@gmail.com", clientType: "GOOGLE_ADS_WEB_CLIENT", campaign: null }),
  ];
  const tab = tabulateChanges(events, ["us@agency.com"], ["founder@gmail.com"], (r) => (r.endsWith("/22") ? "Brand Search" : r));
  assert.equal(tab.total, 5);
  assert.equal(tab.byEditor[0].user, "freelancer@ppc.com");
  assert.equal(tab.byEditor[0].count, 2);
  assert.equal(tab.byEditor[0].kind, "other");
  assert.equal(tab.byEditor[0].firstAt, "2026-09-01 10:00:00");
  assert.equal(tab.byEditor[0].lastAt, "2026-09-02 09:00:00");
  const ours = tab.byEditor.find((r) => r.user === "us@agency.com");
  assert.equal(ours.kind, "ours");
  assert.equal(ours.clientType, "GOOGLE_ADS_API");
  const auto = tab.byEditor.find((r) => r.clientType === "GOOGLE_ADS_RECOMMENDATIONS_SUBSCRIPTION");
  assert.equal(auto.kind, "no user (system)");
  assert.match(auto.via, /Auto-Apply/);
  assert.equal(tab.autoApplyCount, 1);
  assert.deepEqual(tab.humanUsers, ["founder@gmail.com (shared founder/freelancer login; author ambiguous)", "freelancer@ppc.com"]);
  assert.deepEqual(tab.byCampaign[0], { campaign: "Brand Search", count: 3 });
  assert.ok(tab.byCampaign.some((c) => c.campaign === "account-level" && c.count === 1));
  assert.ok(tab.byCampaign.some((c) => c.campaign === "customers/1/campaigns/99"), "unknown campaign ids stay as ids, never invented");
  assert.equal(tab.byResourceOp[0].resourceType, "CAMPAIGN");
  assert.equal(tab.byResourceOp[0].count, 4);
  assert.equal(tab.earliestAt, "2026-08-28 09:00:00");
  assert.equal(tab.latestAt, "2026-09-02 09:00:00");
});

t("tabulateChanges on an empty list is zero everywhere, not an error", () => {
  const tab = tabulateChanges([], []);
  assert.equal(tab.total, 0);
  assert.deepEqual(tab.byEditor, []);
  assert.equal(tab.latestAt, null);
});

t("removedSummary pulls the recognisable text out of old_resource", () => {
  const s = removedSummary({ adGroupCriterion: { resourceName: "customers/1/adGroupCriteria/2~3", keyword: { text: "cheap filters", matchType: "BROAD" }, status: "ENABLED" } });
  assert.match(s, /text: cheap filters/);
  assert.doesNotMatch(s, /customers\/1/);
  assert.equal(removedSummary(null), null);
  assert.equal(removedSummary({ campaign: { id: "1" } }), null);
  const ad = removedSummary({ adGroupAd: { ad: { responsiveSearchAd: { headlines: [{ text: "Buy now" }, { text: "Free shipping" }] }, finalUrls: ["https://x.com"] } } });
  assert.match(ad, /Buy now/);
  assert.match(ad, /finalUrls: https:\/\/x.com/);
});

// Conversion action config joined onto the reported actions.
const cfg = (over = {}) => ({
  id: "1", name: "Purchase (GTAG)", status: "ENABLED", type: "WEBPAGE", category: "PURCHASE", origin: "WEBSITE",
  primaryForGoal: true, countingType: "ONE_PER_CLICK", includeInConversionsMetric: true, defaultValue: null,
  alwaysUseDefaultValue: false, attributionModel: "GOOGLE_ADS_LAST_CLICK", ...over,
});

t("joinConversionConfig attaches config by name and flags two primary purchase actions both carrying value", () => {
  const j = joinConversionConfig(
    [{ action: "Purchase (GTAG)", conversions: 120, convValue: 9000 }, { action: "GA4 purchase", conversions: 118, convValue: 8800 }, { action: "Add to cart", conversions: 900, convValue: 0 }],
    [cfg(), cfg({ id: "2", name: "GA4 purchase", origin: "GOOGLE_ANALYTICS_4" }), cfg({ id: "3", name: "Add to cart", category: "ADD_TO_CART", primaryForGoal: false, includeInConversionsMetric: false })],
  );
  assert.equal(j.actions[0].config.origin, "WEBSITE");
  assert.equal(j.actions[1].config.origin, "GOOGLE_ANALYTICS_4");
  assert.equal(j.actions[2].config.primaryForGoal, false);
  assert.deepEqual(j.unmatched, []);
  assert.equal(j.doubleCountRisk.length, 1);
  assert.equal(j.doubleCountRisk[0].category, "PURCHASE");
  assert.deepEqual(j.doubleCountRisk[0].actions, ["Purchase (GTAG)", "GA4 purchase"]);
});

t("joinConversionConfig does not flag a secondary action or one without value, and names unmatched actions", () => {
  const j = joinConversionConfig(
    [{ action: "Purchase (GTAG)", conversions: 120, convValue: 9000 }, { action: "Old purchase", conversions: 100, convValue: 7000 }, { action: "Gone", conversions: 1, convValue: 1 }],
    [cfg(), cfg({ id: "2", name: "Old purchase", primaryForGoal: false })],
  );
  assert.deepEqual(j.doubleCountRisk, []);
  assert.deepEqual(j.unmatched, ["Gone"]);
  assert.equal(j.actions[2].config, null);
  assert.deepEqual(j.duplicateNames, []);
});

// Live shape from the first large account: the same name on several action ids.
t("joinConversionConfig surfaces actions sharing one name instead of silently taking one", () => {
  const j = joinConversionConfig(
    [{ action: "Transactions (Filtered)", conversions: 50, convValue: 4000 }],
    [cfg({ id: "11", name: "Transactions (Filtered)" }), cfg({ id: "12", name: "Transactions (Filtered)", countingType: "MANY_PER_CLICK" }), cfg({ id: "13", name: "Other" })],
  );
  assert.equal(j.actions[0].config.id, "11");
  assert.equal(j.actions[0].configsSharingName, 2);
  assert.deepEqual(j.duplicateNames, [{ name: "Transactions (Filtered)", ids: ["11", "12"] }]);
});

// Account holders.
t("labelAccess labels each user and customerIdOf reads ids from resource names", () => {
  const rows = labelAccess([{ email: "Us@Agency.com", role: "ADMIN", since: null, invitedBy: null }, { email: "client@shop.com", role: "ADMIN", since: null, invitedBy: null }], ["us@agency.com"]);
  assert.equal(rows[0].kind, "ours");
  assert.equal(rows[1].kind, "other");
  assert.equal(customerIdOf("customers/1234567890"), "1234567890");
  assert.equal(customerIdOf("123-456-7890"), "1234567890");
  assert.equal(customerIdOf(null), null);
  assert.equal(customerIdOf(""), null);
});

console.log(`\n${n} oscar-reads tests passed`);

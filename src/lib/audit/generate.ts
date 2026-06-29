// Google Ads Audit generator — orchestrates extract -> diagnose -> narrative
// (Claude, artifact-values-only) -> assemble branded .docx. Returns a Buffer.
// Part B (account audit) is fully API-driven; Part C (strategy/forecast) is
// Claude-written from the findings. WMI voice: British, no em dashes, evidence-led.
import Anthropic from "@anthropic-ai/sdk";
import { Packer, Paragraph, AlignmentType } from "docx";
import { extractAuditFindings, type AuditFindings } from "./extract";
import {
  buildAuditDoc, cover, partDivider, contents, h1, h2, para, bullet, numItem, figcap,
  table, statusRun, exhibitPanel, t, NAVY, type CellVal,
} from "./docx";

const MODEL = "claude-opus-4-8";

export interface Diagnosis { pattern: string; evidence: string; fix: string; severity: "critical" | "high" | "medium" | "low" }

// ---- code-side diagnosis from the findings ----
export function diagnose(f: AuditFindings): Diagnosis[] {
  const d: Diagnosis[] = [];
  const total = f.account.spend || 1;
  const searchCampaigns = f.campaigns.filter((c) => c.type === "SEARCH");
  const sp = f.networks.find((n) => n.network === "SEARCH_PARTNERS");
  const content = f.networks.find((n) => n.network === "CONTENT");
  if (sp && sp.spend > 0)
    d.push({ pattern: "search-on-display-and-partners", evidence: `Search Partners network carries ${money(f, sp.spend)} of spend at ${money(f, sp.conversions > 0 ? sp.spend / sp.conversions : 0, 2)} cost/conv.`, fix: "Disable Search Partners on Search campaigns; rebuild Search-only.", severity: "high" });
  if (content && content.spend / total > 0.1 && searchCampaigns.length > 0)
    d.push({ pattern: "search-on-display-and-partners", evidence: `${money(f, content.spend)} (${((content.spend / total) * 100).toFixed(0)}% of spend) ran on the Display/Content network. Confirm which is PMax vs Search leaking onto Display.`, fix: "Separate Search from Display; keep Search campaigns Search-only.", severity: "high" });
  if (f.conversionSummary.totalActions >= 12)
    d.push({ pattern: "conversion-action-sprawl", evidence: `${f.conversionSummary.totalActions} conversion actions configured — too many competing signals.`, fix: "Consolidate to one primary demo/lead action; everything else secondary.", severity: "high" });
  if (!f.conversionSummary.valueTracked)
    d.push({ pattern: "no-value-no-oct", evidence: "Total conversion value is ~0 — no value/offline conversion tracking feeding pipeline back to Google.", fix: "Implement OCT: capture GCLID, feed MQL/SQL/Opportunity/Closed-won back with values.", severity: "critical" });
  const junk = f.searchTerms.filter((s) => s.junk);
  if (junk.length > 0)
    d.push({ pattern: "broad-unprotected-keywords", evidence: `${junk.length} of the top search terms are irrelevant (e.g. ${junk.slice(0, 3).map((j) => `"${j.term}"`).join(", ")}).`, fix: "Phrase/exact match at launch + layered account-level negative lists.", severity: "medium" });
  if (f.assets.missing.length >= 3)
    d.push({ pattern: "thin-assets", evidence: `Missing asset types: ${f.assets.missing.join(", ")}.`, fix: "Add the full extension set (sitelinks, callouts, snippets, image, lead form, etc.).", severity: "medium" });
  const pmax = f.campaigns.filter((c) => c.type === "PERFORMANCE_MAX");
  const cheapPmax = pmax.find((c) => c.conversions > 50 && c.costPerConv > 0 && c.costPerConv < 2);
  if (cheapPmax)
    d.push({ pattern: "pmax-manufactured-conversions", evidence: `${cheapPmax.name} recorded ${cheapPmax.conversions.toFixed(0)} conversions at ${money(f, cheapPmax.costPerConv)} each — implausibly cheap for this market.`, fix: "Review PMax conversion actions; exclude low-value events.", severity: "high" });
  return d;
}

// ---- formatting helpers ----
function money(f: AuditFindings, n: number, dp = 0): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: f.meta.currency, minimumFractionDigits: dp, maximumFractionDigits: dp }).format(n);
}
const int = (n: number) => new Intl.NumberFormat("en-GB").format(Math.round(n));
const pct = (n: number) => `${n.toFixed(2)}%`;

// ---- forecast (computed; labelled estimates) ----
function forecast(f: AuditFindings, monthlyBudget: number) {
  const cpc = Math.max(f.account.avgCpc, 4); // clean high-intent search floor
  const rows: { name: string; media: number; cpc: number; cvr: number }[] = [
    { name: "Conservative", media: monthlyBudget * 0.8, cpc: cpc * 1.2, cvr: 2.0 },
    { name: "Base case", media: monthlyBudget, cpc, cvr: 2.75 },
    { name: "Stretch", media: monthlyBudget * 1.2, cpc: cpc * 0.9, cvr: 3.5 },
  ];
  return rows.map((r) => {
    const clicks = r.media / r.cpc;
    const demos = clicks * (r.cvr / 100);
    return { ...r, clicks, demos, costPerDemo: demos > 0 ? r.media / demos : 0 };
  });
}

interface Sections {
  executiveSummary: { intro: string; findings: string[]; recommendation: string };
  accountAnalysis: string; structureCommentary: string[]; networkCommentary: string;
  searchTermsCommentary: string; negativeStrategy: string[]; auctionCommentary: string;
  conversionCommentary: string; octExplainer: string; assetsCommentary: string;
  audiencesCommentary: string; quickWins: string[]; architecture: string;
  octRoadmap: string[]; channelStrategy: string; shortTerm: string; longTerm: string;
  optimisationPlan: string[]; forecastNote: string;
}

const SECTION_KEYS: (keyof Sections)[] = ["executiveSummary", "accountAnalysis", "structureCommentary", "networkCommentary", "searchTermsCommentary", "negativeStrategy", "auctionCommentary", "conversionCommentary", "octExplainer", "assetsCommentary", "audiencesCommentary", "quickWins", "architecture", "octRoadmap", "channelStrategy", "shortTerm", "longTerm", "optimisationPlan", "forecastNote"];

async function writeNarrative(f: AuditFindings, diagnoses: Diagnosis[]): Promise<Sections> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const facts = JSON.stringify({ meta: f.meta, account: f.account, networks: f.networks, campaigns: f.campaigns.slice(0, 10), conversionActions: f.conversionActions.slice(0, 15), conversionSummary: f.conversionSummary, searchTerms: f.searchTerms.slice(0, 15), impressionShare: f.impressionShare, assets: f.assets, diagnoses }, null, 0);
  const system = `You are a senior paid-media consultant at Web Marketing International Ltd (a Google Premier Partner), writing a Google Ads account audit for a client. Match the WMI house voice: consultative, evidence-led, confident, British spelling (optimise, analyse), NO em dashes, address the advertiser as "you/your". Operating principle: success is qualified demos/MQLs/opportunities, not clicks or form fills — quality over volume.

Use ONLY the figures in the DATA. Never invent a number, campaign name, metric or competitor. Lead claims with the real figure. Explain OCT in full (GCLID capture -> feed MQL/SQL/Opportunity/Closed-won back with values, so smart bidding optimises to pipeline, not form fills).

Respond with ONLY a valid JSON object (no markdown fence) with EXACTLY these keys: ${SECTION_KEYS.join(", ")}.
- executiveSummary: { intro (2-3 sentences with the headline numbers), findings (array of 4-6 one-sentence bullet strings, each led by a real figure), recommendation (one paragraph) }
- accountAnalysis, networkCommentary, searchTermsCommentary, auctionCommentary, conversionCommentary, octExplainer, assetsCommentary, audiencesCommentary, architecture, channelStrategy, shortTerm, longTerm, forecastNote: prose strings (1-2 short paragraphs each).
- structureCommentary, negativeStrategy, quickWins, octRoadmap, optimisationPlan: arrays of short strings (bullets/steps).
Ground every section in the DATA + diagnoses. If conversion value is ~0, treat OCT as the central fix.`;
  const msg = await client.messages.create({ model: MODEL, max_tokens: 6000, system, messages: [{ role: "user", content: `DATA:\n${facts}` }] });
  const text = msg.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("").trim();
  const json = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  return JSON.parse(json) as Sections;
}

// ---- assemble ----
function assemble(f: AuditFindings, diagnoses: Diagnosis[], s: Sections, monthlyBudget: number, logo?: Buffer) {
  const a = f.account;
  const c: (Paragraph | ReturnType<typeof table> | ReturnType<typeof contents>)[] = [];
  const push = (...x: typeof c) => c.push(...x);

  push(...cover({ title: "Google Ads Audit & Growth Research", subtitle: "Account Audit  |  Strategy  |  Forecast  |  Optimisation Plan", client: f.meta.client, website: f.meta.website, customerId: f.meta.googleAdsCustomerId, date: f.meta.preparedDate, logo }));

  push(h1("Overview"), para(`This document audits the ${f.meta.client} Google Ads account and sets out how paid media should be rebuilt to generate qualified demand rather than volume for its own sake. It is not exhaustive; it gives an honest summary of where the account stands today and where the opportunities sit. Our guiding principle throughout is that success is measured in qualified demos, marketing qualified leads and opportunities, not in clicks or form fills.`));

  push(contents());

  push(h1("Executive Summary"), para(s.executiveSummary.intro));
  push(h2("The findings that matter most"));
  for (const b of s.executiveSummary.findings) push(bullet(b));
  push(h2("What we recommend, in one paragraph"), para(s.executiveSummary.recommendation));

  // ---- PART B ----
  push(...partDivider("PART B", "Google Ads Account Audit"));
  push(h1("Account Analysis"), para(s.accountAnalysis));
  push(table([4680, 4680], null, [
    ["Spend", money(f, a.spend)], ["Impressions", int(a.impressions)], ["Clicks", int(a.clicks)],
    ["CTR", pct(a.ctr)], ["Avg. CPC", money(f, a.avgCpc, 2)], ["Conversions", int(a.conversions)],
    ["Conv. rate", pct(a.convRate)], ["Cost / conv.", money(f, a.costPerConv, 2)], ["Conv. value", money(f, a.convValue)],
    ["Campaigns", String(a.campaignCount)],
  ] as CellVal[][], { aligns: [undefined, AlignmentType.RIGHT] }));
  push(figcap(`Exhibit 1: Account performance, ${f.meta.window.start} to ${f.meta.window.end}. Source: Google Ads account ${f.meta.googleAdsCustomerId}.`));

  push(h1("Campaign Structure & Settings"));
  push(table([3360, 1500, 1500, 1500, 1500], ["Campaign", "Type", "Cost", "Conv.", "Cost/conv."],
    f.campaigns.slice(0, 8).map((c2) => [c2.name.slice(0, 42), c2.type, money(f, c2.cost), int(c2.conversions), money(f, c2.costPerConv, 2)] as CellVal[]),
    { aligns: [undefined, undefined, AlignmentType.RIGHT, AlignmentType.RIGHT, AlignmentType.RIGHT] }));
  push(figcap(`Exhibit 2: Largest campaigns by spend. Source: Google Ads account ${f.meta.googleAdsCustomerId}.`));
  push(h2("What the structure tells us"));
  for (const b of s.structureCommentary) push(bullet(b));

  push(h1("Network Split: Where the Budget Went"), para(s.networkCommentary));
  push(table([3360, 2000, 2000, 2000], ["Network", "Spend", "Clicks", "Conv."],
    f.networks.map((n) => [n.network, money(f, n.spend), int(n.clicks), int(n.conversions)] as CellVal[]),
    { aligns: [undefined, AlignmentType.RIGHT, AlignmentType.RIGHT, AlignmentType.RIGHT] }));
  push(figcap(`Exhibit 3: Spend by network (with search partners). Source: Google Ads account ${f.meta.googleAdsCustomerId}.`));

  push(h1("Search Terms"), para(s.searchTermsCommentary));
  const junk = f.searchTerms.filter((x) => x.junk).slice(0, 8);
  if (junk.length) {
    push(table([4680, 2340, 2340], ["Search term", "Type", "Cost"],
      junk.map((j) => [j.term, j.junk!, money(f, j.cost)] as CellVal[]), { aligns: [undefined, undefined, AlignmentType.RIGHT] }));
    push(figcap(`Exhibit 4: Sample of irrelevant search terms that triggered ads. Source: search terms report, account ${f.meta.googleAdsCustomerId}.`));
  }
  push(h1("Negative Keyword Strategy"));
  for (const b of s.negativeStrategy) push(bullet(b));

  push(h1("Auction Insights & Competitor Bidding"), para(s.auctionCommentary));
  push(table([4680, 4680], null, [
    ["Search impression share", pct(f.impressionShare.impressionShare)],
    ["Absolute top impression share", pct(f.impressionShare.absoluteTop)],
    ["Impression share lost to rank", pct(f.impressionShare.rankLost)],
    ["Impression share lost to budget", pct(f.impressionShare.budgetLost)],
  ] as CellVal[][], { aligns: [undefined, AlignmentType.RIGHT] }));
  push(figcap(`Exhibit 5: Search impression share. Note: the Google Ads API does not expose competitor-domain auction insights; competitor domains are reviewed manually. Source: account ${f.meta.googleAdsCustomerId}.`));

  push(h1("Conversion Tracking: The Root Cause"), para(s.conversionCommentary));
  push(table([3700, 1700, 2200, 1760], ["Conversion action", "Category", "Conv. (period)", "Status"],
    f.conversionActions.slice(0, 12).map((ca) => [ca.name.slice(0, 40), ca.category, int(ca.conversions), { __runs: statusRun(ca.status) }] as CellVal[]),
    { aligns: [undefined, undefined, AlignmentType.RIGHT, undefined] }));
  push(figcap(`Exhibit 6: Conversion actions (${f.conversionSummary.totalActions} total). Source: account ${f.meta.googleAdsCustomerId}.`));
  push(h2("Offline conversion tracking: what it is and why it matters most"), para(s.octExplainer));

  push(h1("Ad Copy & Assets"), para(s.assetsCommentary));
  push(exhibitPanel("Asset coverage", [
    { t: `Present: ${f.assets.present.join(", ") || "none detected"}` },
    { t: `Missing: ${f.assets.missing.join(", ") || "none"}`, color: "8A4B00" },
  ]));
  push(h1("Audiences"), para(s.audiencesCommentary));
  push(h1("Quick Wins"));
  for (const b of s.quickWins) push(bullet(b));

  // ---- PART C ----
  push(...partDivider("PART C", "Strategy, Forecast & Optimisation Plan"));
  push(h1("Recommended Account Architecture"), para(s.architecture));
  push(h1("Conversion Tracking & OCT Roadmap"));
  for (const n of s.octRoadmap) push(numItem(n));
  push(h1("Channel Strategy"), para(s.channelStrategy));
  push(h1("Short-Term Strategy (First 90 Days)"), para(s.shortTerm));
  push(h1("Long-Term Growth Strategy"), para(s.longTerm));

  push(h1("Google Ads Forecast"), para(s.forecastNote));
  const fc = forecast(f, monthlyBudget);
  push(table([2400, 2240, 1600, 1560, 1560], ["Scenario", "Media/mo", "Avg CPC", "Demos/mo", "Cost/demo"],
    fc.map((r) => [r.name, money(f, r.media), money(f, r.cpc, 2), int(r.demos), money(f, r.costPerDemo)] as CellVal[]),
    { aligns: [undefined, AlignmentType.RIGHT, AlignmentType.RIGHT, AlignmentType.RIGHT, AlignmentType.RIGHT] }));
  push(figcap("Forecast: bottom-up estimates against the stated budget. Search volume is the binding constraint and the website (CRO) is the biggest lever. Figures are estimates, refined during onboarding."));

  push(h1("Optimisation Plan"));
  for (const b of s.optimisationPlan) push(bullet(b));

  // ---- Appendix ----
  push(...partDivider("APPENDIX", "Working with a Google Premier Partner"));
  push(h1("The Benefits of Working with a Google Premier Partner"),
    para("Web Marketing International Ltd is a Google Premier Partner, a status awarded to the top tier of agencies on performance, spend and certification. In practice this means direct Google support, early access to betas, and a team held to Google's highest standard of account management. Your account is managed to that standard throughout."));

  return c;
}

export interface AuditResult { buffer: Buffer; findings: AuditFindings; diagnoses: Diagnosis[] }
export async function generateAudit(
  customerId: string,
  clientLabel: string,
  opts: { website?: string; monthlyBudget?: number; logo?: Buffer } = {},
): Promise<AuditResult> {
  const findings = await extractAuditFindings(customerId, clientLabel, opts.website);
  const diagnoses = diagnose(findings);
  const sections = await writeNarrative(findings, diagnoses);
  const budget = opts.monthlyBudget ?? Math.max(2000, Math.round((findings.account.spend / 12) / 100) * 100);
  const children = assemble(findings, diagnoses, sections, budget, opts.logo);
  const buffer = await Packer.toBuffer(buildAuditDoc(children, `${clientLabel} | Google Ads Audit & Growth Research`, opts.logo));
  return { buffer: Buffer.from(buffer), findings, diagnoses };
}

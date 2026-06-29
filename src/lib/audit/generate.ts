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

export type AccountType = "ecommerce" | "lead_gen";
// Ecommerce when purchases/value are tracked; lead-gen otherwise. Drives the
// whole framing (revenue/ROAS vs demos/OCT-pipeline).
export function detectAccountType(f: AuditFindings): AccountType {
  const purchase = f.conversionActions.some((c) => /purchase|store_sale|add_to_cart|begin_checkout/i.test(c.category));
  if (purchase) return "ecommerce";
  if (f.conversionSummary.valueTracked && f.account.roas >= 1) return "ecommerce";
  return "lead_gen";
}

export interface Diagnosis { pattern: string; evidence: string; fix: string; severity: "critical" | "high" | "medium" | "low" }

// ---- code-side diagnosis from the findings ----
export function diagnose(f: AuditFindings, accountType: AccountType): Diagnosis[] {
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
  if (!f.conversionSummary.valueTracked) {
    if (accountType === "ecommerce")
      d.push({ pattern: "no-value-no-oct", evidence: "Purchases are tracked without conversion VALUE (total value ~0), so smart bidding cannot optimise to revenue or ROAS.", fix: "Send purchase value (and ideally margin) with every conversion; switch to value-based bidding (Target ROAS).", severity: "critical" });
    else
      d.push({ pattern: "no-value-no-oct", evidence: "Total conversion value is ~0 — no value/offline conversion tracking feeding pipeline back to Google.", fix: "Implement OCT: capture GCLID, feed MQL/SQL/Opportunity/Closed-won back with values.", severity: "critical" });
  }
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
function forecastLeadGen(f: AuditFindings, monthlyBudget: number) {
  const cpc = Math.max(f.account.avgCpc, 4); // clean high-intent search floor
  const rows = [
    { name: "Conservative", media: monthlyBudget * 0.8, cpc: cpc * 1.2, cvr: 2.0 },
    { name: "Base case", media: monthlyBudget, cpc, cvr: 2.75 },
    { name: "Stretch", media: monthlyBudget * 1.2, cpc: cpc * 0.9, cvr: 3.5 },
  ];
  return rows.map((r) => {
    const clicks = r.media / r.cpc;
    const demos = clicks * (r.cvr / 100);
    return { ...r, demos, costPerDemo: demos > 0 ? r.media / demos : 0 };
  });
}
// Ecommerce forecast: orders, revenue and ROAS off the account's own AOV + CVR.
function forecastEcom(f: AuditFindings, monthlyBudget: number) {
  const cpc = Math.max(f.account.avgCpc, 0.3);
  const baseCvr = Math.max(f.account.convRate, 0.5) / 100; // fraction
  const aov = f.account.conversions > 0 ? f.account.convValue / f.account.conversions : 0;
  const rows = [
    { name: "Conservative", media: monthlyBudget * 0.8, cvr: baseCvr, aov },
    { name: "Base case", media: monthlyBudget, cvr: baseCvr * 1.1, aov },
    { name: "Stretch", media: monthlyBudget * 1.2, cvr: baseCvr * 1.2, aov: aov * 1.05 },
  ];
  return rows.map((r) => {
    const clicks = r.media / cpc;
    const orders = clicks * r.cvr;
    const revenue = orders * r.aov;
    return { ...r, orders, revenue, roas: r.media > 0 ? revenue / r.media : 0 };
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

async function writeNarrative(f: AuditFindings, diagnoses: Diagnosis[], accountType: AccountType): Promise<Sections> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const ecom = accountType === "ecommerce";
  const facts = JSON.stringify({ meta: f.meta, accountType, account: f.account, networks: f.networks, campaigns: f.campaigns.slice(0, 10), conversionActions: f.conversionActions.slice(0, 15), conversionSummary: f.conversionSummary, searchTerms: f.searchTerms.slice(0, 15), impressionShare: f.impressionShare, assets: f.assets, diagnoses }, null, 0);
  const principle = ecom
    ? "This is an ECOMMERCE account: the primary conversion is a PURCHASE and success is profitable revenue and return on ad spend (ROAS), not clicks or raw conversion counts."
    : "This is a LEAD-GEN account: success is qualified demos, MQLs and opportunities, not clicks or form fills — quality over volume.";
  const convGuidance = ecom
    ? `For conversion tracking, focus on PURCHASE tracking integrity, conversion VALUE accuracy, de-duplicating purchase tags, and VALUE-BASED BIDDING (Target ROAS) — the goal is revenue/ROAS. The octExplainer section must explain value-based bidding and clean purchase/value tracking (ideally feeding margin or new-vs-returning value). DO NOT recommend offline conversion tracking, GCLID-to-CRM, or MQL/SQL/Opportunity/Closed-won pipeline feedback — those are lead-gen concepts and are WRONG here. octRoadmap = a measurement & value-based-bidding roadmap. forecastNote = framed in orders, revenue and ROAS.`
    : `Explain OCT in full in octExplainer (GCLID capture -> feed MQL/SQL/Opportunity/Closed-won back with values, so smart bidding optimises to pipeline, not form fills). octRoadmap = the conversion-tracking & OCT roadmap. forecastNote = framed in demos and cost per demo. If conversion value is ~0, treat OCT as the central fix.`;
  const system = `You are a senior paid-media consultant at Web Marketing International Ltd (a Google Premier Partner), writing a Google Ads account audit for a client. Match the WMI house voice: consultative, evidence-led, confident, British spelling (optimise, analyse), NO em dashes, address the advertiser as "you/your". ${principle}

Use ONLY the figures in the DATA. Never invent a number, campaign name, metric or competitor. Lead claims with the real figure. ${convGuidance}

Respond with ONLY a valid JSON object (no markdown fence) with EXACTLY these keys: ${SECTION_KEYS.join(", ")}.
- executiveSummary: { intro (2-3 sentences with the headline numbers${ecom ? ", including spend, conversion value and ROAS" : ""}), findings (array of 4-6 one-sentence bullet strings, each led by a real figure), recommendation (one paragraph) }
- accountAnalysis, networkCommentary, searchTermsCommentary, auctionCommentary, conversionCommentary, octExplainer, assetsCommentary, audiencesCommentary, architecture, channelStrategy, shortTerm, longTerm, forecastNote: prose strings (1-2 short paragraphs each).
- structureCommentary, negativeStrategy, quickWins, octRoadmap, optimisationPlan: arrays of short strings (bullets/steps).
Ground every section in the DATA + diagnoses.`;
  const msg = await client.messages.create({ model: MODEL, max_tokens: 6000, system, messages: [{ role: "user", content: `DATA:\n${facts}` }] });
  const text = msg.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("").trim();
  const json = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  return JSON.parse(json) as Sections;
}

// ---- glossary (account-type aware; abbreviations actually used) ----
function glossarySection(ecom: boolean) {
  const common: [string, string][] = [
    ["CPA", "Cost Per Acquisition"], ["CPC", "Cost Per Click"], ["CR / CVR", "Conversion Rate"],
    ["CRO", "Conversion Rate Optimisation"], ["CTR", "Click-Through Rate"], ["DSA", "Dynamic Search Ads"],
    ["GA4", "Google Analytics 4"], ["GTM", "Google Tag Manager"], ["Impr. Share", "Impression Share"],
    ["LTV", "Lifetime Value"], ["PMax", "Performance Max"], ["PPC", "Pay Per Click"],
    ["RLSA", "Remarketing Lists for Search Ads"], ["ROAS", "Return On Ad Spend"], ["RSA", "Responsive Search Ad"],
    ["Search Partners", "Non-Google sites showing Search ads"], ["SKAG", "Single Keyword Ad Group"],
    ["tCPA / tROAS", "Target CPA / Target ROAS"], ["YT", "YouTube"],
  ];
  const leadgen: [string, string][] = [
    ["CPL", "Cost Per Lead"], ["CRM", "Customer Relationship Management (e.g. HubSpot)"],
    ["GCLID", "Google Click Identifier"], ["MQL", "Marketing Qualified Lead"],
    ["OCT", "Offline Conversion Tracking"], ["SQL", "Sales Qualified Lead"],
  ];
  const ecomTerms: [string, string][] = [
    ["AOV", "Average Order Value"], ["COS", "Cost of Sale"], ["Feed", "Google Merchant Center product feed"],
    ["Item ID", "Product identifier in the Merchant Center feed"], ["POAS", "Profit On Ad Spend"],
    ["VBB", "Value-Based Bidding (Target ROAS)"],
  ];
  const map = new Map<string, string>();
  for (const [k, v] of [...common, ...(ecom ? ecomTerms : leadgen)]) map.set(k, v);
  const rows = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => [k, v] as CellVal[]);
  return [
    h1("Glossary"),
    para("Paid media comes with a lot of shorthand. This glossary covers the terms used in this document so that nothing is ambiguous."),
    table([2400, 6960], ["Term", "Meaning"], rows),
  ];
}

// ---- assemble ----
function assemble(f: AuditFindings, diagnoses: Diagnosis[], s: Sections, monthlyBudget: number, accountType: AccountType, logo?: Buffer) {
  const a = f.account;
  const ecom = accountType === "ecommerce";
  const c: (Paragraph | ReturnType<typeof table> | ReturnType<typeof contents>)[] = [];
  const push = (...x: typeof c) => c.push(...x);

  push(...cover({ title: "Google Ads Audit & Growth Research", subtitle: "Account Audit  |  Strategy  |  Forecast  |  Optimisation Plan", client: f.meta.client, website: f.meta.website, customerId: f.meta.googleAdsCustomerId, date: f.meta.preparedDate, logo }));

  const principle = ecom
    ? "Our guiding principle throughout is that success is measured in profitable revenue and return on ad spend, not in clicks or raw conversions."
    : "Our guiding principle throughout is that success is measured in qualified demos, marketing qualified leads and opportunities, not in clicks or form fills.";
  push(h1("Overview"), para(`This document audits the ${f.meta.client} Google Ads account and sets out how paid media should be rebuilt to drive ${ecom ? "profitable, scalable demand" : "qualified demand"} rather than volume for its own sake. It is not exhaustive; it gives an honest summary of where the account stands today and where the opportunities sit. ${principle}`));

  push(...glossarySection(ecom));
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

  push(h1(ecom ? "Conversion Tracking & Value Integrity" : "Conversion Tracking: The Root Cause"), para(s.conversionCommentary));
  push(table([3700, 1700, 2200, 1760], ["Conversion action", "Category", "Conv. (period)", "Status"],
    f.conversionActions.slice(0, 12).map((ca) => [ca.name.slice(0, 40), ca.category, int(ca.conversions), { __runs: statusRun(ca.status) }] as CellVal[]),
    { aligns: [undefined, undefined, AlignmentType.RIGHT, undefined] }));
  push(figcap(`Exhibit 6: Conversion actions (${f.conversionSummary.totalActions} total). Source: account ${f.meta.googleAdsCustomerId}.`));
  push(h2(ecom ? "Value-based bidding and clean purchase tracking" : "Offline conversion tracking: what it is and why it matters most"), para(s.octExplainer));

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
  push(h1(ecom ? "Measurement & Value-Based Bidding Roadmap" : "Conversion Tracking & OCT Roadmap"));
  for (const n of s.octRoadmap) push(numItem(n));
  push(h1("Channel Strategy"), para(s.channelStrategy));
  push(h1("Short-Term Strategy (First 90 Days)"), para(s.shortTerm));
  push(h1("Long-Term Growth Strategy"), para(s.longTerm));

  push(h1("Google Ads Forecast"), para(s.forecastNote));
  if (ecom) {
    const fc = forecastEcom(f, monthlyBudget);
    push(table([2400, 2240, 1700, 2020, 1000], ["Scenario", "Media/mo", "Orders/mo", "Revenue/mo", "ROAS"],
      fc.map((r) => [r.name, money(f, r.media), int(r.orders), money(f, r.revenue), `${r.roas.toFixed(2)}×`] as CellVal[]),
      { aligns: [undefined, AlignmentType.RIGHT, AlignmentType.RIGHT, AlignmentType.RIGHT, AlignmentType.RIGHT] }));
    push(figcap("Forecast: bottom-up estimates off the account's own average order value and conversion rate. The biggest levers are impression-share capture, feed quality and value-based bidding. Figures are estimates, refined during onboarding."));
  } else {
    const fc = forecastLeadGen(f, monthlyBudget);
    push(table([2400, 2240, 1600, 1560, 1560], ["Scenario", "Media/mo", "Avg CPC", "Demos/mo", "Cost/demo"],
      fc.map((r) => [r.name, money(f, r.media), money(f, r.cpc, 2), int(r.demos), money(f, r.costPerDemo)] as CellVal[]),
      { aligns: [undefined, AlignmentType.RIGHT, AlignmentType.RIGHT, AlignmentType.RIGHT, AlignmentType.RIGHT] }));
    push(figcap("Forecast: bottom-up estimates against the stated budget. Search volume is the binding constraint and the website (CRO) is the biggest lever. Figures are estimates, refined during onboarding."));
  }

  push(h1("Optimisation Plan"));
  for (const b of s.optimisationPlan) push(bullet(b));

  // ---- Appendix ----
  push(...partDivider("APPENDIX", "Working with a Google Premier Partner"));
  push(h1("The Benefits of Working with a Google Premier Partner"));
  push(para(`Web Marketing International is a Google Premier Partner. Premier status is not a badge that every agency holds. Google reserves it for the top tier of partners in each country, based on a combination of certified expertise, demonstrated client performance and the amount of spend managed to a high standard. In practice it means a few concrete things for ${f.meta.client}.`));
  const apxBullet = (lead: string, rest: string) => bullet([t(lead + " ", { bold: true, size: 22 }), t(rest, { size: 22 })]);
  push(apxBullet("Proven, certified expertise.", "Premier Partners must maintain Google Ads certifications across Search, Display, Video and more, and are assessed on the results they deliver. You are working with a team Google itself recognises as among the most capable."));
  push(apxBullet("Direct access to Google.", "Premier Partners have dedicated Google representatives and support channels, which means faster resolution of issues such as those found in this account, early access to betas, and a direct line when something needs escalating."));
  push(apxBullet("Early access to features and beta products.", `We can test new formats and bidding tools, including ${ecom ? "value-based bidding and feed enhancements" : "offline-conversion and lead-focused features"}, ahead of the wider market, which is exactly the kind of capability this account needs.`));
  push(apxBullet("Strategic support and training.", "Access to Google product specialists, market insights and co-developed account strategies, so recommendations are grounded in what is actually working at scale."));
  push(apxBullet("Accountability and best practice.", "Premier status must be re-earned, so it is a continuing commitment to managing accounts to Google's highest standards, which aligns our incentives with your results."));
  push(para(`For a business like ${f.meta.client}, ${ecom ? "scaling profitable ecommerce demand" : "selling a high value product into a specialised market on a focused budget"}, the difference between an average agency and a Premier Partner is the difference between spending money and investing it. The work in this document, fixing tracking, rebuilding cleanly and optimising toward ${ecom ? "real revenue and return on ad spend" : "real pipeline"}, is exactly where that expertise pays for itself.`));
  push(para("Web Marketing International Ltd  |  Google Premier Partner", { color: "888888", size: 18 }));

  return c;
}

export interface AuditResult { buffer: Buffer; findings: AuditFindings; diagnoses: Diagnosis[]; accountType: AccountType }
export async function generateAudit(
  customerId: string,
  clientLabel: string,
  opts: { website?: string; monthlyBudget?: number; logo?: Buffer; accountType?: AccountType } = {},
): Promise<AuditResult> {
  const findings = await extractAuditFindings(customerId, clientLabel, opts.website);
  const accountType = opts.accountType ?? detectAccountType(findings);
  const diagnoses = diagnose(findings, accountType);
  const sections = await writeNarrative(findings, diagnoses, accountType);
  const budget = opts.monthlyBudget ?? Math.max(2000, Math.round((findings.account.spend / 12) / 100) * 100);
  const children = assemble(findings, diagnoses, sections, budget, accountType, opts.logo);
  const buffer = await Packer.toBuffer(buildAuditDoc(children, `${clientLabel} | Google Ads Audit & Growth Research`, opts.logo));
  return { buffer: Buffer.from(buffer), findings, diagnoses, accountType };
}

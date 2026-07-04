// Google Shopping & Feed Audit — branded .docx generator. Data comes from the
// Ads-API feed layer (getFeedAudit); Claude writes only the exec summary +
// recommendations (artifact-values-only), falling back to a computed template.
// Merchant Center feed HEALTH is a labelled placeholder until the Content API is
// wired. Returns a Buffer.
import Anthropic from "@anthropic-ai/sdk";
import { Packer, AlignmentType } from "docx";
import { getFeedAudit, type FeedAudit } from "@/lib/integrations/google-ads/feed";
import { entityConfig } from "@/lib/config";
import {
  buildAuditDoc, cover, h1, h2, para, bullet, figcap, table, t, type CellVal,
} from "./docx";

const MODEL = "claude-opus-4-8";

interface FeedNarrative {
  executiveSummary: string;
  findings: string[];
  recommendations: string[];
}

async function writeFeedNarrative(f: FeedAudit, client: string): Promise<FeedNarrative | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  const facts = JSON.stringify({
    client, currency: f.currency, window: f.window, totals: f.totals,
    channelSplit: f.channelSplit, topProducts: f.topProducts.slice(0, 10),
    wastedProducts: f.wastedProducts.slice(0, 10), byBrand: f.byBrand.slice(0, 8),
    byType: f.byType.slice(0, 8), spendConcentrationTop10Pct: f.spendConcentrationTop10Pct,
    diagnoses: f.diagnoses,
  }, null, 0);
  const system = `You are a senior paid-media consultant at ${entityConfig.brandName} (a Google Premier Partner) writing the executive summary and recommendations for a Google Shopping / product-feed audit. British spelling, no em dashes, address the advertiser as "you/your", evidence-led. This is an ECOMMERCE feed: success is profitable revenue and ROAS, not clicks.

Use ONLY the figures in the DATA. Never invent a number, product, brand or metric. Lead claims with the real figure. This audit covers feed PERFORMANCE (from the Google Ads API); it does NOT include Merchant Center feed health (disapprovals, item errors) — do not claim it does.

Respond with ONLY a valid JSON object (no markdown fence) with EXACTLY these keys: executiveSummary, findings, recommendations.
- executiveSummary: 2-3 sentences with the headline feed numbers (spend, revenue, ROAS, product count) and the single biggest opportunity.
- findings: array of 4-6 one-sentence strings, each led by a real figure (wasted spend, concentration, zero-click products, ROAS, etc.).
- recommendations: array of 4-6 concrete, prioritised next steps grounded in the diagnoses.`;
  try {
    const msg = await new Anthropic({ apiKey }).messages.create({
      model: MODEL, max_tokens: 2000, system,
      messages: [{ role: "user", content: `DATA:\n${facts}` }],
    });
    const text = msg.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("").trim();
    return JSON.parse(text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "")) as FeedNarrative;
  } catch {
    return null;
  }
}

export interface FeedAuditResult { buffer: Buffer; feed: FeedAudit }

export async function generateFeedAudit(
  customerId: string,
  clientLabel: string,
  opts: { website?: string; logo?: Buffer; days?: number } = {},
): Promise<FeedAuditResult> {
  const f = await getFeedAudit(customerId, opts.days ?? 30);
  const money = (n: number, dp = 0) =>
    new Intl.NumberFormat("en-GB", { style: "currency", currency: f.currency, minimumFractionDigits: dp, maximumFractionDigits: dp }).format(n);
  const int = (n: number) => new Intl.NumberFormat("en-GB").format(Math.round(n));
  const roas = (n: number) => `${n.toFixed(2)}x`;
  const preparedDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(new Date());

  const narrative = f.hasShopping ? await writeFeedNarrative(f, clientLabel) : null;
  const R = AlignmentType.RIGHT;
  const children: (ReturnType<typeof para> | ReturnType<typeof table>)[] = [];
  const push = (...x: typeof children) => children.push(...x);

  push(...cover({
    title: "Google Shopping & Feed Audit",
    subtitle: "Feed Performance  |  Product Analysis  |  Recommendations",
    client: clientLabel, website: opts.website, customerId, date: preparedDate, logo: opts.logo,
  }));

  push(h1("Overview"), para(`This audit reviews the ${clientLabel} Google Shopping activity and product feed over ${f.window.start} to ${f.window.end}, using live Google Ads data. It shows where feed spend earns its return and where it is wasted, and sets out the changes that would make the catalogue work harder. Our guiding principle is that success is measured in profitable revenue and return on ad spend, not clicks.`));

  if (!f.hasShopping) {
    push(
      h1("No Shopping activity found"),
      para(`We found no Shopping or Performance Max retail activity for this account in the window, so there is no feed performance to report. Confirm that Merchant Center is linked, products are approved, and at least one Shopping or Performance Max (retail) campaign is live. Once the Content API is enabled we will also be able to report feed health (disapprovals and item errors) directly.`),
    );
    const buffer = await Packer.toBuffer(buildAuditDoc(children, `${clientLabel} | Google Shopping & Feed Audit`, opts.logo));
    return { buffer: Buffer.from(buffer), feed: f };
  }

  // Executive summary
  push(h1("Executive Summary"));
  push(para(narrative?.executiveSummary ?? `Over the period the feed spent ${money(f.totals.spend)} across ${int(f.totals.products)} products, returning ${money(f.totals.convValue)} at ${roas(f.totals.roas)} ROAS. ${f.totals.nonConvertingSpendPct.toFixed(0)}% of spend (${money(f.totals.nonConvertingSpend)}) went to products with zero conversions — the clearest immediate opportunity.`));
  push(h2("The findings that matter most"));
  for (const b of (narrative?.findings ?? f.diagnoses.map((d) => `${d.evidence}`))) push(bullet(b));

  // Feed performance snapshot
  push(h1("Feed Performance"));
  push(table([4680, 4680], null, [
    ["Products advertised", int(f.totals.products)],
    ["Impressions", int(f.totals.impressions)],
    ["Clicks", int(f.totals.clicks)],
    ["Spend", money(f.totals.spend)],
    ["Conversions", int(f.totals.conversions)],
    ["Conversion value", money(f.totals.convValue)],
    ["ROAS", roas(f.totals.roas)],
    ["Non-converting spend", `${money(f.totals.nonConvertingSpend)} (${f.totals.nonConvertingSpendPct.toFixed(0)}%)`],
    ["Products with 0 clicks", int(f.totals.zeroClickProducts)],
    ["Products missing brand", int(f.totals.missingBrand)],
    ["Spend in top 10% of products", `${f.spendConcentrationTop10Pct.toFixed(0)}%`],
  ] as CellVal[][], { aligns: [undefined, R] }));
  push(figcap(`Exhibit 1: Feed performance, ${f.window.start} to ${f.window.end}. Source: Google Ads account ${customerId}.`));

  // Channel mix
  if (f.channelSplit.length) {
    push(h1("Channel Mix: Shopping vs Performance Max"));
    push(table([3360, 2000, 2000, 2000], ["Channel", "Spend", "Conv.", "ROAS"],
      f.channelSplit.map((c) => [c.label, money(c.spend), int(c.conversions), roas(c.roas)] as CellVal[]),
      { aligns: [undefined, R, R, R] }));
    push(figcap(`Exhibit 2: Retail spend by channel. Source: account ${customerId}.`));
  }

  // Top products
  if (f.topProducts.length) {
    push(h1("Top Performing Products"));
    push(table([3600, 1400, 1400, 1400, 1560], ["Product", "Spend", "Conv.", "Revenue", "ROAS"],
      f.topProducts.slice(0, 10).map((p) => [(p.title || p.itemId).slice(0, 46), money(p.cost), int(p.conversions), money(p.convValue), roas(p.roas)] as CellVal[]),
      { aligns: [undefined, R, R, R, R] }));
    push(figcap(`Exhibit 3: Highest revenue products. Source: shopping performance, account ${customerId}.`));
  }

  // Wasted spend
  if (f.wastedProducts.length) {
    push(h1("Wasted Spend: Zero-Conversion Products"));
    push(para(`These products spent with no conversions in the period. They are the first candidates for feed fixes (title, image, price), listing-group exclusion, or bid capping.`));
    push(table([5000, 1600, 1400, 1360], ["Product", "Spend", "Clicks", "Impr."],
      f.wastedProducts.slice(0, 12).map((p) => [(p.title || p.itemId).slice(0, 60), money(p.cost), int(p.clicks), int(p.impressions)] as CellVal[]),
      { aligns: [undefined, R, R, R] }));
    push(figcap(`Exhibit 4: Largest zero-conversion spenders. Source: account ${customerId}.`));
  }

  // Brand + type breakdowns
  if (f.byBrand.length) {
    push(h1("Performance by Brand"));
    push(table([3960, 1800, 1800, 1800], ["Brand", "Spend", "Revenue", "ROAS"],
      f.byBrand.slice(0, 10).map((g) => [g.label.slice(0, 40), money(g.spend), money(g.convValue), roas(g.roas)] as CellVal[]),
      { aligns: [undefined, R, R, R] }));
    push(figcap(`Exhibit 5: Spend and return by brand. Source: account ${customerId}.`));
  }
  if (f.byType.length) {
    push(h1("Performance by Product Type"));
    push(table([3960, 1800, 1800, 1800], ["Product type", "Spend", "Revenue", "ROAS"],
      f.byType.slice(0, 10).map((g) => [g.label.slice(0, 40), money(g.spend), money(g.convValue), roas(g.roas)] as CellVal[]),
      { aligns: [undefined, R, R, R] }));
    push(figcap(`Exhibit 6: Spend and return by product type (L1). Source: account ${customerId}.`));
  }

  // Findings (computed diagnoses)
  if (f.diagnoses.length) {
    push(h1("Findings"));
    for (const d of f.diagnoses) {
      push(bullet([t(`[${d.severity.toUpperCase()}] `, { bold: true, size: 22, color: d.severity === "critical" ? "C62828" : d.severity === "high" ? "B26A00" : "26323B" }), t(`${d.evidence} `, { size: 22 }), t(`Fix: ${d.fix}`, { size: 22, italics: true })]));
    }
  }

  // Recommendations
  push(h1("Recommendations"));
  for (const rItem of (narrative?.recommendations ?? f.diagnoses.map((d) => d.fix))) push(bullet(rItem));

  // Merchant Center health — labelled placeholder (Content API pending)
  push(h1("Merchant Center Feed Health"));
  if (f.merchantCenter) {
    const mc = f.merchantCenter;
    push(para(`Merchant Center ${mc.merchantId}: ${int(mc.totalItems)} items, ${int(mc.disapproved)} disapproved, ${int(mc.warnings)} with warnings.`));
    if (mc.topIssues.length) {
      push(table([6000, 3360], ["Issue", "Items"], mc.topIssues.map((i) => [i.description, int(i.count)] as CellVal[]), { aligns: [undefined, R] }));
    }
  } else {
    push(para(`Item-level feed health — product disapprovals, policy errors and missing-attribute warnings — comes from the Merchant Center Content API, which is not yet connected for this deployment. This audit therefore covers feed PERFORMANCE only. Once the Content API is enabled (a Google API scope + Merchant Center link), this section will list disapproved items and their reasons directly.`));
  }

  push(para(`${entityConfig.brandName}  |  Google Premier Partner`, { color: "888888", size: 18 }));

  const buffer = await Packer.toBuffer(buildAuditDoc(children, `${clientLabel} | Google Shopping & Feed Audit`, opts.logo));
  return { buffer: Buffer.from(buffer), feed: f };
}

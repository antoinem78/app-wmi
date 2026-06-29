// Google Ads Audit — API-sourced findings extractor (read-only).
// Builds the structured findings artifact (Part B account data) the writer
// consumes. The writer may ONLY use values present here. Each section is
// resilient: a failed query is recorded in `warnings` rather than sinking the
// whole audit. Window = last 12 months (the audit period).
import { gaqlSearch } from "@/lib/integrations/google-ads";

const num = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0)) || 0;
const micros = (v: unknown) => num(v) / 1_000_000;
const fmt = (d: Date) => d.toISOString().slice(0, 10);

export interface AuditFindings {
  meta: { client: string; googleAdsCustomerId: string; website?: string; currency: string; preparedDate: string; window: { start: string; end: string }; accountName?: string };
  account: { spend: number; impressions: number; clicks: number; ctr: number; avgCpc: number; conversions: number; convRate: number; costPerConv: number; convValue: number; roas: number; campaignCount: number };
  monthly: { month: string; spend: number; clicks: number; conversions: number; convValue: number }[];
  campaigns: { name: string; type: string; status: string; bidStrategy: string; budgetPerDay: number; cost: number; clicks: number; impressions: number; conversions: number; costPerConv: number; convValue: number }[];
  networks: { network: string; spend: number; clicks: number; conversions: number }[];
  conversionActions: { name: string; category: string; status: string; origin: string; conversions: number; convValue: number }[];
  conversionSummary: { totalActions: number; periodConversions: number; valueTracked: boolean };
  searchTerms: { term: string; cost: number; clicks: number; conversions: number; junk?: string }[];
  impressionShare: { impressionShare: number; absoluteTop: number; rankLost: number; budgetLost: number };
  assets: { present: string[]; missing: string[] };
  warnings: string[];
}

const STANDARD_ASSETS = ["SITELINK", "CALLOUT", "STRUCTURED_SNIPPET", "IMAGE", "CALL", "LEAD_FORM", "PRICE", "PROMOTION", "BUSINESS_LOGO", "SITELINK"];
const JUNK_RULES: { re: RegExp; label: string }[] = [
  { re: /\b(job|jobs|salary|vacancy|vacancies|career|careers|recruit|hiring|cv|resume)\b/i, label: "Job seeker" },
  { re: /\b(free|cheap|crack|cracked|torrent|download|nulled|pirate)\b/i, label: "Price/noise" },
  { re: /\b(course|courses|training|certification|certificate|tutorial|learn|diploma|degree)\b/i, label: "Education" },
  { re: /\b(diy|how to|meaning|definition|wiki|wikipedia|news)\b/i, label: "Off-topic" },
];
function classifyJunk(term: string): string | undefined {
  for (const r of JUNK_RULES) if (r.re.test(term)) return r.label;
  return undefined;
}

async function safe<T>(label: string, warnings: string[], fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    warnings.push(`${label}: ${e instanceof Error ? e.message : String(e)}`);
    return fallback;
  }
}

export async function extractAuditFindings(
  customerId: string,
  clientLabel: string,
  website?: string,
): Promise<AuditFindings> {
  const warnings: string[] = [];

  const meta = await gaqlSearch(customerId, "SELECT customer.currency_code, customer.time_zone, customer.descriptive_name FROM customer LIMIT 1");
  const cust = (meta[0]?.customer ?? {}) as { currencyCode?: string; timeZone?: string; descriptiveName?: string };
  const currency = cust.currencyCode ?? "USD";

  // 12-month window ending yesterday (UTC is fine for an audit window).
  const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  const end = new Date(today.getTime() - 86_400_000);
  const start = new Date(end.getTime() - 364 * 86_400_000);
  const DATE = `segments.date BETWEEN '${fmt(start)}' AND '${fmt(end)}'`;
  const ACTIVE = "campaign.status != 'REMOVED'";

  // --- campaigns + account totals ---
  const campRows = await safe("campaigns", warnings, () => gaqlSearch(
    customerId,
    `SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type,
            campaign.bidding_strategy_type, campaign_budget.amount_micros,
            metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions, metrics.conversions_value
     FROM campaign WHERE ${DATE} AND ${ACTIVE} ORDER BY metrics.cost_micros DESC`,
  ), []);
  const campaigns = campRows.map((r) => {
    const c = (r.campaign ?? {}) as Record<string, unknown>;
    const m = (r.metrics ?? {}) as Record<string, unknown>;
    const b = (r.campaignBudget ?? {}) as { amountMicros?: string };
    const cost = micros(m.costMicros), conv = num(m.conversions);
    return {
      name: String(c.name ?? "(unnamed)"), type: String(c.advertisingChannelType ?? "—"),
      status: String(c.status ?? ""), bidStrategy: String(c.biddingStrategyType ?? "—"),
      budgetPerDay: micros(b.amountMicros), cost, clicks: num(m.clicks), impressions: num(m.impressions),
      conversions: conv, costPerConv: conv > 0 ? cost / conv : 0, convValue: num(m.conversionsValue),
    };
  });
  const acc = campaigns.reduce((a, c) => {
    a.spend += c.cost; a.impressions += c.impressions; a.clicks += c.clicks; a.conversions += c.conversions; a.convValue += c.convValue;
    return a;
  }, { spend: 0, impressions: 0, clicks: 0, conversions: 0, convValue: 0 });
  const account = {
    ...acc,
    ctr: acc.impressions > 0 ? (acc.clicks / acc.impressions) * 100 : 0,
    avgCpc: acc.clicks > 0 ? acc.spend / acc.clicks : 0,
    convRate: acc.clicks > 0 ? (acc.conversions / acc.clicks) * 100 : 0,
    costPerConv: acc.conversions > 0 ? acc.spend / acc.conversions : 0,
    roas: acc.spend > 0 ? acc.convValue / acc.spend : 0,
    campaignCount: campaigns.length,
  };

  // --- network split ---
  const netRows = await safe("networks", warnings, () => gaqlSearch(
    customerId,
    `SELECT segments.ad_network_type, metrics.cost_micros, metrics.clicks, metrics.conversions
     FROM campaign WHERE ${DATE} AND ${ACTIVE}`,
  ), []);
  const netMap: Record<string, { spend: number; clicks: number; conversions: number }> = {};
  for (const r of netRows) {
    const net = String(((r.segments ?? {}) as { adNetworkType?: string }).adNetworkType ?? "UNKNOWN");
    const m = (r.metrics ?? {}) as Record<string, unknown>;
    netMap[net] ??= { spend: 0, clicks: 0, conversions: 0 };
    netMap[net].spend += micros(m.costMicros); netMap[net].clicks += num(m.clicks); netMap[net].conversions += num(m.conversions);
  }
  const networks = Object.entries(netMap).map(([network, v]) => ({ network, ...v })).sort((a, b) => b.spend - a.spend);

  // --- conversion actions (config) + per-action conversions (window) ---
  const caConfig = await safe("conversionActions", warnings, () => gaqlSearch(
    customerId,
    "SELECT conversion_action.name, conversion_action.category, conversion_action.status, conversion_action.origin FROM conversion_action",
  ), []);
  const caPerf = await safe("conversionActionPerf", warnings, () => gaqlSearch(
    customerId,
    `SELECT segments.conversion_action_name, metrics.conversions, metrics.conversions_value FROM campaign WHERE ${DATE} AND ${ACTIVE}`,
  ), []);
  const perfMap: Record<string, { conversions: number; convValue: number }> = {};
  for (const r of caPerf) {
    const name = String(((r.segments ?? {}) as { conversionActionName?: string }).conversionActionName ?? "");
    const m = (r.metrics ?? {}) as Record<string, unknown>;
    if (!name) continue;
    perfMap[name] ??= { conversions: 0, convValue: 0 };
    perfMap[name].conversions += num(m.conversions); perfMap[name].convValue += num(m.conversionsValue);
  }
  const conversionActions = caConfig.map((r) => {
    const c = (r.conversionAction ?? {}) as { name?: string; category?: string; status?: string; origin?: string };
    const p = perfMap[c.name ?? ""] ?? { conversions: 0, convValue: 0 };
    return { name: String(c.name ?? ""), category: String(c.category ?? ""), status: String(c.status ?? ""), origin: String(c.origin ?? ""), conversions: p.conversions, convValue: p.convValue };
  }).sort((a, b) => b.conversions - a.conversions);
  const conversionSummary = {
    totalActions: conversionActions.length,
    periodConversions: account.conversions,
    valueTracked: account.convValue > 0,
  };

  // --- search terms + junk ---
  const stRows = await safe("searchTerms", warnings, () => gaqlSearch(
    customerId,
    `SELECT search_term_view.search_term, metrics.cost_micros, metrics.clicks, metrics.conversions
     FROM search_term_view WHERE ${DATE} ORDER BY metrics.cost_micros DESC LIMIT 60`,
  ), []);
  const searchTerms = stRows.map((r) => {
    const term = String(((r.searchTermView ?? {}) as { searchTerm?: string }).searchTerm ?? "");
    const m = (r.metrics ?? {}) as Record<string, unknown>;
    return { term, cost: micros(m.costMicros), clicks: num(m.clicks), conversions: num(m.conversions), junk: classifyJunk(term) };
  });

  // --- impression share (Search only, impression-weighted) ---
  const impressionShare = await safe("impressionShare", warnings, async () => {
    const rows = await gaqlSearch(
      customerId,
      `SELECT metrics.impressions, metrics.search_impression_share, metrics.search_absolute_top_impression_share,
              metrics.search_rank_lost_impression_share, metrics.search_budget_lost_impression_share
       FROM campaign WHERE ${DATE} AND campaign.advertising_channel_type = 'SEARCH' AND ${ACTIVE}`,
    );
    const a = { is: 0, at: 0, rl: 0, bl: 0, im: 0 };
    for (const r of rows) {
      const m = (r.metrics ?? {}) as Record<string, unknown>;
      if (m.searchImpressionShare == null) continue;
      const im = num(m.impressions); a.im += im;
      a.is += num(m.searchImpressionShare) * im; a.at += num(m.searchAbsoluteTopImpressionShare) * im;
      a.rl += num(m.searchRankLostImpressionShare) * im; a.bl += num(m.searchBudgetLostImpressionShare) * im;
    }
    const p = (v: number) => (a.im > 0 ? (v / a.im) * 100 : 0);
    return { impressionShare: p(a.is), absoluteTop: p(a.at), rankLost: p(a.rl), budgetLost: p(a.bl) };
  }, { impressionShare: 0, absoluteTop: 0, rankLost: 0, budgetLost: 0 });

  // --- assets present ---
  const assetRows = await safe("assets", warnings, () => gaqlSearch(
    customerId, "SELECT asset_field_type_view.field_type FROM asset_field_type_view",
  ), []);
  const present = Array.from(new Set(assetRows.map((r) => String(((r.assetFieldTypeView ?? {}) as { fieldType?: string }).fieldType ?? "")).filter(Boolean)));
  const missing = STANDARD_ASSETS.filter((a) => !present.includes(a));

  // --- monthly trend (12 months) ---
  const monthRows = await safe("monthly", warnings, () => gaqlSearch(
    customerId,
    `SELECT segments.month, metrics.cost_micros, metrics.clicks, metrics.conversions, metrics.conversions_value
     FROM campaign WHERE ${DATE} AND ${ACTIVE} ORDER BY segments.month`,
  ), []);
  const mMap: Record<string, { spend: number; clicks: number; conversions: number; convValue: number }> = {};
  for (const r of monthRows) {
    const key = String(((r.segments ?? {}) as { month?: string }).month ?? "");
    if (!key) continue;
    const m = (r.metrics ?? {}) as Record<string, unknown>;
    mMap[key] ??= { spend: 0, clicks: 0, conversions: 0, convValue: 0 };
    mMap[key].spend += micros(m.costMicros); mMap[key].clicks += num(m.clicks);
    mMap[key].conversions += num(m.conversions); mMap[key].convValue += num(m.conversionsValue);
  }
  const monthly = Object.entries(mMap).sort(([a], [b]) => a.localeCompare(b)).map(([month, v]) => ({ month, ...v }));

  return {
    meta: {
      client: clientLabel, googleAdsCustomerId: customerId, website, currency,
      preparedDate: new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(today),
      window: { start: fmt(start), end: fmt(end) }, accountName: cust.descriptiveName,
    },
    account, monthly, campaigns, networks, conversionActions, conversionSummary, searchTerms, impressionShare, assets: { present, missing }, warnings,
  };
}

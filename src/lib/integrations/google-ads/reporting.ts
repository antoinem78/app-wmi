// Phase 6.1: Google Ads performance dashboard data layer.
// ACCOUNT-WIDE (all campaign types), removed campaigns excluded, account timezone
// + currency, last 28 vs prior 28 (or 7/90) excluding today. Headline KPIs and
// the change log span every channel (Search, Performance Max, Demand Gen,
// Shopping, Display, Video); a per-channel breakdown is provided. Search-only
// signals (impression share, search terms) are kept but clearly labelled as
// Search. Conversions are attributed by interaction (click) date. Whole payload
// cached per client+window (~30 min) so refreshes don't drain the shared quota.
//
// All figures come from here (the data layer). Any LLM summary only rewords
// these verified numbers — it never generates them.
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { gaqlSearch } from "./index";

export const REPORT_WINDOWS = [7, 28, 90] as const;
export type ReportWindow = (typeof REPORT_WINDOWS)[number];
const CACHE_TTL_MS = 30 * 60 * 1000;

export interface Kpi {
  value: number;
  prev: number;
  /** % change vs prior period; null when prior is 0 (can't divide). */
  deltaPct: number | null;
}
export interface WeeklySummary {
  start: string;
  end: string;
  spend: Kpi;
  conversions: Kpi;
  /** Human-readable change lines, e.g. "keywords added (3)". */
  changeLines: string[];
  changeCount: number;
}

export interface DashboardPayload {
  currency: string;
  timeZone: string;
  window: number;
  range: { start: string; end: string };
  hasConversionValue: boolean;
  weekly: WeeklySummary;
  kpis: {
    spend: Kpi; impressions: Kpi; clicks: Kpi; ctr: Kpi; avgCpc: Kpi;
    conversions: Kpi; costPerConv: Kpi; convValue: Kpi; roas: Kpi;
    convRate: Kpi; searchImprShare: Kpi;
    // By conversion date ("By Time") + ecommerce derivations:
    conversionsByTime: Kpi; convValueByTime: Kpi; roasByTime: Kpi; aov: Kpi;
  };
  /** Window conversions / value averaged over the window's days (interaction date). */
  avgOrdersPerDay: number;
  avgRevenuePerDay: number;
  trend: { date: string; spend: number; conversions: number }[];
  /** Per-channel-type rollup for the window (account-wide). */
  byChannel: { channel: string; spend: number; conversions: number; convValue: number; costPerConv: number; roas: number }[];
  byCampaign: { name: string; channel: string; spend: number; conversions: number; costPerConv: number; roas: number }[];
  /** Swydo-style campaign grid: every metric with this-period value + %Δ vs prior window. */
  campaignPerformance: {
    name: string; channel: string;
    clicks: Kpi; impressions: Kpi; ctr: Kpi; avgCpc: Kpi;
    cost: Kpi; conversions: Kpi; costPerConv: Kpi; convRate: Kpi;
  }[];
  byDevice: { device: string; spend: number; conversions: number }[];
  topSearchTerms: { term: string; spend: number; conversions: number }[];
  /** Conversions split by conversion action / type (account-wide). */
  byConversionAction: { action: string; conversions: number; convValue: number }[];
  /** Top performing ads by conversions (with leading RSA headlines + final URL). */
  topAds: {
    headline: string; finalUrl: string; campaign: string;
    impressions: number; clicks: number; ctr: number; cost: number;
    conversions: number; convValue: number;
  }[];
  /** Competitive impression-share suite (Search only) — the API-available
   *  stand-in for Auction Insights (no competitor-domain data via the API). */
  impressionShare: { impressionShare: number; absoluteTop: number; top: number; rankLost: number; budgetLost: number };
  /** Last ~6 calendar months (most recent first), account-wide. */
  monthPerformance: {
    month: string; clicks: number; impressions: number; ctr: number;
    avgCpc: number; cost: number; conversions: number; costPerConv: number;
  }[];
}

const num = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0)) || 0;
const micros = (v: unknown) => num(v) / 1_000_000;

function ymdInTz(d: Date, tz: string): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}
const fmt = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
};

function windows(tz: string, windowDays: number) {
  const today = new Date(`${ymdInTz(new Date(), tz)}T00:00:00Z`);
  // The "week" is always the most recent COMPLETE Monday–Sunday week (our
  // report standard, matching Swydo), compared with the Monday–Sunday before
  // it. Larger windows (28/90) stay rolling "last N days".
  if (windowDays === 7) {
    const dow = today.getUTCDay(); // 0=Sun … 6=Sat
    const backToSunday = dow === 0 ? 7 : dow; // days back to the last completed Sunday
    const end = addDays(today, -backToSunday); // Sunday
    const start = addDays(end, -6); // Monday
    const prevEnd = addDays(start, -1); // previous Sunday
    const prevStart = addDays(prevEnd, -6); // previous Monday
    return { start: fmt(start), end: fmt(end), prevStart: fmt(prevStart), prevEnd: fmt(prevEnd) };
  }
  const end = addDays(today, -1); // exclude today
  const start = addDays(end, -(windowDays - 1));
  const prevEnd = addDays(start, -1);
  const prevStart = addDays(prevEnd, -(windowDays - 1));
  return {
    start: fmt(start),
    end: fmt(end),
    prevStart: fmt(prevStart),
    prevEnd: fmt(prevEnd),
  };
}

// ---- Selectable report ranges (Week / 7d / 14d / 30d / Month / Custom) ----
export type DashRange =
  | { kind: "week" }
  | { kind: "rolling"; days: 7 | 14 | 30 }
  | { kind: "month" }
  | { kind: "custom"; start: string; end: string };
export const RANGE_PRESETS = [
  { key: "week", label: "Week" },
  { key: "7d", label: "7d" },
  { key: "14d", label: "14d" },
  { key: "30d", label: "30d" },
  { key: "month", label: "Month" },
] as const;

/** Parse the `?range=` param into a DashRange. week | 7d/14d/30d | month | custom:from:to. */
export function parseRange(raw?: string | null): DashRange {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "month") return { kind: "month" };
  const cm = v.match(/^custom:(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})$/);
  if (cm && cm[1] <= cm[2]) return { kind: "custom", start: cm[1], end: cm[2] };
  const rm = v.match(/^(\d{1,3})d?$/);
  if (rm) { const n = Number(rm[1]); if (n === 7 || n === 14 || n === 30) return { kind: "rolling", days: n }; }
  return { kind: "week" };
}
/** Serialize a DashRange back to a `?range=` value (for the active-preset check). */
export function rangeKey(r: DashRange): string {
  if (r.kind === "week") return "week";
  if (r.kind === "month") return "month";
  if (r.kind === "rolling") return `${r.days}d`;
  return `custom:${r.start}:${r.end}`;
}

export interface ResolvedRange { start: string; end: string; prevStart: string; prevEnd: string; days: number }
export function resolveRange(tz: string, range: DashRange): ResolvedRange {
  const today = new Date(`${ymdInTz(new Date(), tz)}T00:00:00Z`);
  if (range.kind === "week") return { ...windows(tz, 7), days: 7 };
  if (range.kind === "rolling") {
    const n = range.days;
    const end = addDays(today, -1);
    const start = addDays(end, -(n - 1));
    const prevEnd = addDays(start, -1);
    const prevStart = addDays(prevEnd, -(n - 1));
    return { start: fmt(start), end: fmt(end), prevStart: fmt(prevStart), prevEnd: fmt(prevEnd), days: n };
  }
  if (range.kind === "month") {
    const y = today.getUTCFullYear(), m = today.getUTCMonth();
    const s = new Date(Date.UTC(y, m - 1, 1)), e = new Date(Date.UTC(y, m, 0)); // last complete calendar month
    const ps = new Date(Date.UTC(y, m - 2, 1)), pe = new Date(Date.UTC(y, m - 1, 0));
    const days = Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1;
    return { start: fmt(s), end: fmt(e), prevStart: fmt(ps), prevEnd: fmt(pe), days };
  }
  const s = new Date(`${range.start}T00:00:00Z`), e = new Date(`${range.end}T00:00:00Z`);
  const span = Math.max(1, Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1);
  const prevEnd = addDays(s, -1);
  const prevStart = addDays(prevEnd, -(span - 1));
  return { start: range.start, end: range.end, prevStart: fmt(prevStart), prevEnd: fmt(prevEnd), days: span };
}

function kpi(value: number, prev: number): Kpi {
  return { value, prev, deltaPct: prev > 0 ? ((value - prev) / prev) * 100 : null };
}

// Search-only filter (for inherently-Search signals: impression share, terms).
const SEARCH_FILTER =
  "campaign.advertising_channel_type = 'SEARCH' AND campaign.status != 'REMOVED'";
// Account-wide filter: every channel type, only removed campaigns excluded.
const ACTIVE_FILTER = "campaign.status != 'REMOVED'";

// advertising_channel_type enum → friendly label.
const CHANNEL_LABEL: Record<string, string> = {
  SEARCH: "Search",
  PERFORMANCE_MAX: "Performance Max",
  SHOPPING: "Shopping",
  DISPLAY: "Display",
  VIDEO: "Video",
  DEMAND_GEN: "Demand Gen",
  DISCOVERY: "Demand Gen",
  MULTI_CHANNEL: "App",
  LOCAL: "Local",
  LOCAL_SERVICES: "Local Services",
  SMART: "Smart",
  HOTEL: "Hotel",
  TRAVEL: "Travel",
};
const channelLabel = (t?: string): string =>
  CHANNEL_LABEL[t ?? ""] ?? (t ? t.replace(/_/g, " ") : "Other");

type ChannelAgg = { spend: number; conversions: number; convValue: number; impressions: number; clicks: number };

// Aggregate campaign metrics for a date range ACROSS ALL CHANNEL TYPES →
// account totals + per-campaign rows (tagged with channel) + per-channel rollup.
async function campaignTotals(customerId: string, start: string, end: string) {
  const rows = await gaqlSearch(
    customerId,
    `SELECT campaign.name, campaign.advertising_channel_type,
            metrics.cost_micros, metrics.impressions, metrics.clicks,
            metrics.conversions, metrics.conversions_value,
            metrics.conversions_by_conversion_date, metrics.conversions_value_by_conversion_date
     FROM campaign
     WHERE segments.date BETWEEN '${start}' AND '${end}' AND ${ACTIVE_FILTER}`,
  );
  let spend = 0, impressions = 0, clicks = 0, conversions = 0, convValue = 0;
  let convByTime = 0, convValueByTime = 0;
  const byName: Record<string, { channel: string; spend: number; impressions: number; clicks: number; conversions: number; convValue: number }> = {};
  const byChannel: Record<string, ChannelAgg> = {};
  for (const r of rows) {
    const m = (r.metrics ?? {}) as Record<string, unknown>;
    const c = micros(m.costMicros);
    const cv = num(m.conversionsValue);
    const cn = num(m.conversions);
    const im = num(m.impressions);
    const ck = num(m.clicks);
    spend += c; impressions += im; clicks += ck; conversions += cn; convValue += cv;
    convByTime += num(m.conversionsByConversionDate);
    convValueByTime += num(m.conversionsValueByConversionDate);
    const camp = (r.campaign ?? {}) as { name?: string; advertisingChannelType?: string };
    const name = camp.name ?? "(unnamed)";
    const channel = channelLabel(camp.advertisingChannelType);
    byName[name] ??= { channel, spend: 0, impressions: 0, clicks: 0, conversions: 0, convValue: 0 };
    byName[name].spend += c; byName[name].impressions += im; byName[name].clicks += ck;
    byName[name].conversions += cn; byName[name].convValue += cv;
    byChannel[channel] ??= { spend: 0, conversions: 0, convValue: 0, impressions: 0, clicks: 0 };
    const bc = byChannel[channel];
    bc.spend += c; bc.conversions += cn; bc.convValue += cv; bc.impressions += im; bc.clicks += ck;
  }
  return { spend, impressions, clicks, conversions, convValue, convByTime, convValueByTime, byName, byChannel };
}

// Competitive "auction insights" suite. NOTE: the Google Ads API does NOT
// expose the Auction Insights report (competitor domains / overlap rate), so we
// surface the API-available impression-share family instead — how often we
// showed, won the top/absolute-top slots, and where we lost share (rank vs
// budget). Search campaigns only; impression-weighted across campaigns.
interface ImpressionShareSuite {
  impressionShare: number;
  absoluteTop: number;
  top: number;
  rankLost: number;
  budgetLost: number;
}
async function impressionShareSuite(
  customerId: string,
  start: string,
  end: string,
): Promise<ImpressionShareSuite> {
  const rows = await gaqlSearch(
    customerId,
    `SELECT metrics.impressions, metrics.search_impression_share,
            metrics.search_absolute_top_impression_share, metrics.search_top_impression_share,
            metrics.search_rank_lost_impression_share, metrics.search_budget_lost_impression_share
     FROM campaign
     WHERE segments.date BETWEEN '${start}' AND '${end}' AND ${SEARCH_FILTER}`,
  );
  const acc = { is: 0, at: 0, tp: 0, rl: 0, bl: 0, impr: 0 };
  for (const r of rows) {
    const m = (r.metrics ?? {}) as Record<string, unknown>;
    if (m.searchImpressionShare == null) continue;
    const impr = num(m.impressions);
    acc.impr += impr;
    acc.is += num(m.searchImpressionShare) * impr;
    acc.at += num(m.searchAbsoluteTopImpressionShare) * impr;
    acc.tp += num(m.searchTopImpressionShare) * impr;
    acc.rl += num(m.searchRankLostImpressionShare) * impr;
    acc.bl += num(m.searchBudgetLostImpressionShare) * impr;
  }
  const pct = (v: number) => (acc.impr > 0 ? (v / acc.impr) * 100 : 0);
  return {
    impressionShare: pct(acc.is),
    absoluteTop: pct(acc.at),
    top: pct(acc.tp),
    rankLost: pct(acc.rl),
    budgetLost: pct(acc.bl),
  };
}

// Classify one change_event into a specific, plain-English optimisation label,
// using resource type, operation, the changed field mask, the new resource, AND
// the campaign's channel type (so non-Search ad-group criteria are labelled
// product/listing groups, not keywords — the reported mis-classification).
// Returns null for noise. FACTS only; rationale is added by the narrative LLM.
function classifyChange(
  ce: {
    changeResourceType?: string;
    resourceChangeOperation?: string;
    changedFields?: string;
    newResource?: Record<string, Record<string, unknown>>;
  },
  channelType?: string,
): string | null {
  const type = ce.changeResourceType ?? "";
  const op = ce.resourceChangeOperation ?? "";
  const fields = ce.changedFields ?? "";
  const has = (f: string) => fields.toLowerCase().includes(f.toLowerCase());
  const nr = ce.newResource ?? {};
  const statusOf = (k: string) => String((nr[k]?.status as string) ?? "");
  const isSearch = (channelType ?? "SEARCH").toUpperCase() === "SEARCH";

  switch (type) {
    case "CAMPAIGN": {
      if (has("status")) {
        const s = statusOf("campaign");
        return s === "PAUSED" ? "campaigns paused" : s === "ENABLED" ? "campaigns resumed" : s === "REMOVED" ? "campaigns removed" : "campaign status changed";
      }
      if (has("targetCpa") || has("targetRoas") || has("biddingStrategy") || has("maximizeConversion")) return "bid-strategy targets adjusted";
      return "campaign settings updated";
    }
    case "AD_GROUP": {
      if (has("status")) {
        const s = statusOf("adGroup");
        return s === "PAUSED" ? "ad groups paused" : s === "ENABLED" ? "ad groups resumed" : "ad group status changed";
      }
      if (has("cpcBid")) return "ad group bids adjusted";
      return "ad groups updated";
    }
    case "CAMPAIGN_BUDGET":
      return "budgets adjusted";
    case "AD_GROUP_CRITERION": {
      const neg = Boolean((nr.adGroupCriterion?.negative as boolean) ?? false);
      if (has("negative") || neg) return "negative keywords added";
      // Search → keywords; every other channel → product/listing groups.
      const entity = isSearch ? "keyword" : "product group";
      if (op === "CREATE") return `${entity}s added`;
      if (op === "REMOVE") return `${entity}s removed`;
      if (has("cpcBid")) return `${entity} bids adjusted`;
      if (has("status")) return `${entity} status changed`;
      return `${entity}s updated`;
    }
    case "CAMPAIGN_CRITERION": {
      const neg = Boolean((nr.campaignCriterion?.negative as boolean) ?? false);
      if (has("negative") || neg) return "campaign-level negatives added";
      return "campaign targeting updated";
    }
    case "AD_GROUP_AD":
    case "AD":
      return op === "CREATE" ? "ads added" : op === "REMOVE" ? "ads removed" : "ads updated";
    case "AD_GROUP_BID_MODIFIER":
      return "bid adjustments set";
    case "AD_GROUP_ASSET":
    case "CAMPAIGN_ASSET":
      return "assets updated";
    // Performance Max / asset-based campaigns:
    case "ASSET_GROUP":
      return op === "CREATE" ? "asset groups added" : op === "REMOVE" ? "asset groups removed" : "asset groups updated";
    case "ASSET_GROUP_ASSET":
      return "asset-group assets updated";
    case "ASSET_GROUP_LISTING_GROUP_FILTER":
      return op === "CREATE" ? "product groups added" : op === "REMOVE" ? "product groups removed" : "product groups updated";
    case "FEED":
    case "FEED_ITEM":
    case "CAMPAIGN_FEED":
    case "AD_GROUP_FEED":
      return "feeds updated";
    default:
      return null;
  }
}

// Google Ads `change_event` only serves roughly the last 30 days; a query whose
// start is older errors out. Clamp the start to today-29 (UTC, a safe margin) so
// wider ranges (Month, custom, 30d) still return whatever change history exists.
function clampChangeStart(start: string): string {
  const floor = fmt(addDays(new Date(`${ymdInTz(new Date(), "UTC")}T00:00:00Z`), -29));
  return start < floor ? floor : start;
}

// Aggregate the account's change history (ALL channel types) into plain-English
// lines (template, not LLM), using the channel-aware classifier so non-Search
// edits aren't mislabelled. Used for the Slack fallback / changeCount.
async function changeSummary(customerId: string, start: string, end: string) {
  const from = clampChangeStart(start);
  const [campRows, rows] = await Promise.all([
    gaqlSearch(customerId, "SELECT campaign.id, campaign.advertising_channel_type FROM campaign"),
    gaqlSearch(
      customerId,
      `SELECT change_event.change_resource_type, change_event.resource_change_operation,
              change_event.changed_fields, change_event.campaign, change_event.new_resource
       FROM change_event
       WHERE change_event.change_date_time >= '${from} 00:00:00'
         AND change_event.change_date_time <= '${end} 23:59:59'
       ORDER BY change_event.change_date_time DESC LIMIT 1000`,
    ),
  ]);
  const channelById: Record<string, string> = {};
  for (const r of campRows) {
    const c = (r.campaign ?? {}) as { id?: string | number; advertisingChannelType?: string };
    if (c.id != null) channelById[String(c.id)] = c.advertisingChannelType ?? "";
  }
  const counts: Record<string, number> = {};
  for (const r of rows) {
    const ce = (r.changeEvent ?? {}) as Parameters<typeof classifyChange>[0] & { campaign?: string };
    const campId = (ce.campaign?.match(/campaigns\/(\d+)/) ?? [])[1];
    const action = classifyChange(ce, campId ? channelById[campId] : undefined);
    if (!action) continue;
    counts[action] = (counts[action] ?? 0) + 1;
  }
  const lines = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([action, n]) => `${action} (${n})`);
  return { count: rows.length, lines };
}

/**
 * Detailed weekly optimisations, grouped by campaign + action with counts —
 * the raw material for the report's "Optimisations Made" section, across ALL
 * channel types and channel-aware. Facts only; the narrative turns them into
 * client-facing sentences.
 */
export async function getWeeklyOptimisations(
  customerId: string,
  start: string,
  end: string,
): Promise<string[]> {
  const from = clampChangeStart(start);
  const [campRows, changeRows] = await Promise.all([
    gaqlSearch(customerId, "SELECT campaign.id, campaign.name, campaign.advertising_channel_type FROM campaign"),
    gaqlSearch(
      customerId,
      `SELECT change_event.change_resource_type, change_event.resource_change_operation,
              change_event.changed_fields, change_event.campaign, change_event.new_resource
       FROM change_event
       WHERE change_event.change_date_time >= '${from} 00:00:00'
         AND change_event.change_date_time <= '${end} 23:59:59'
       ORDER BY change_event.change_date_time DESC LIMIT 2000`,
    ),
  ]);

  const nameById: Record<string, string> = {};
  const channelById: Record<string, string> = {};
  for (const r of campRows) {
    const c = (r.campaign ?? {}) as { id?: string | number; name?: string; advertisingChannelType?: string };
    if (c.id != null) {
      nameById[String(c.id)] = c.name ?? "";
      channelById[String(c.id)] = c.advertisingChannelType ?? "";
    }
  }

  const counts: Record<string, number> = {};
  for (const r of changeRows) {
    const ce = (r.changeEvent ?? {}) as Parameters<typeof classifyChange>[0] & {
      campaign?: string;
    };
    const campId = (ce.campaign?.match(/campaigns\/(\d+)/) ?? [])[1];
    const action = classifyChange(ce, campId ? channelById[campId] : undefined);
    if (!action) continue;
    const camp = (campId && nameById[campId]) || "account-level";
    counts[`${camp}|||${action}`] = (counts[`${camp}|||${action}`] ?? 0) + 1;
  }

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([key, n]) => {
      const [camp, action] = key.split("|||");
      return camp === "account-level"
        ? `${action} (${n})`
        : `${camp} — ${action} (${n})`;
    });
}

async function buildWeekly(
  customerId: string,
  tz: string,
): Promise<WeeklySummary> {
  const w = windows(tz, 7);
  const [cur, prev, changes] = await Promise.all([
    campaignTotals(customerId, w.start, w.end),
    campaignTotals(customerId, w.prevStart, w.prevEnd),
    changeSummary(customerId, w.start, w.end),
  ]);
  return {
    start: w.start,
    end: w.end,
    spend: kpi(cur.spend, prev.spend),
    conversions: kpi(cur.conversions, prev.conversions),
    changeLines: changes.lines,
    changeCount: changes.count,
  };
}

async function buildDashboard(
  customerId: string,
  range: DashRange,
): Promise<DashboardPayload> {
  // Account meta first (timezone drives the date math, currency drives display).
  const metaRows = await gaqlSearch(
    customerId,
    "SELECT customer.currency_code, customer.time_zone FROM customer LIMIT 1",
  );
  const cust = ((metaRows[0]?.customer ?? {}) as {
    currencyCode?: string;
    timeZone?: string;
  });
  const currency = cust.currencyCode ?? "USD";
  const timeZone = cust.timeZone ?? "Etc/UTC";
  const w = resolveRange(timeZone, range);
  const windowDays = w.days;

  // Month performance: the last 6 calendar months (incl. the current partial
  // month), independent of the selected window — matches the Swydo reports.
  const todayTz = new Date(`${ymdInTz(new Date(), timeZone)}T00:00:00Z`);
  const monthEnd = addDays(todayTz, -1); // exclude today
  const monthStart = new Date(Date.UTC(todayTz.getUTCFullYear(), todayTz.getUTCMonth() - 5, 1));

  const [cur, prev, sis, deviceRows, trendRows, termRows, convActionRows, adRows, monthRows, weekly] = await Promise.all([
    campaignTotals(customerId, w.start, w.end),
    campaignTotals(customerId, w.prevStart, w.prevEnd),
    impressionShareSuite(customerId, w.start, w.end),
    gaqlSearch(
      customerId,
      `SELECT segments.device, metrics.cost_micros, metrics.conversions
       FROM campaign WHERE segments.date BETWEEN '${w.start}' AND '${w.end}' AND ${ACTIVE_FILTER}`,
    ),
    gaqlSearch(
      customerId,
      `SELECT segments.date, metrics.cost_micros, metrics.conversions
       FROM campaign WHERE segments.date BETWEEN '${w.start}' AND '${w.end}' AND ${ACTIVE_FILTER}
       ORDER BY segments.date`,
    ),
    gaqlSearch(
      customerId,
      `SELECT search_term_view.search_term, metrics.cost_micros, metrics.conversions
       FROM search_term_view WHERE segments.date BETWEEN '${w.start}' AND '${w.end}'
       ORDER BY metrics.cost_micros DESC LIMIT 10`,
    ),
    gaqlSearch(
      customerId,
      `SELECT segments.conversion_action_name, metrics.conversions, metrics.conversions_value
       FROM campaign WHERE segments.date BETWEEN '${w.start}' AND '${w.end}' AND ${ACTIVE_FILTER}`,
    ),
    gaqlSearch(
      customerId,
      `SELECT campaign.name, ad_group_ad.ad.type, ad_group_ad.ad.name,
              ad_group_ad.ad.responsive_search_ad.headlines, ad_group_ad.ad.final_urls,
              metrics.impressions, metrics.clicks, metrics.cost_micros,
              metrics.conversions, metrics.conversions_value
       FROM ad_group_ad
       WHERE segments.date BETWEEN '${w.start}' AND '${w.end}'
         AND ad_group_ad.status != 'REMOVED' AND ${ACTIVE_FILTER}
       ORDER BY metrics.conversions DESC LIMIT 10`,
    ),
    gaqlSearch(
      customerId,
      `SELECT segments.month, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions
       FROM campaign
       WHERE segments.date BETWEEN '${fmt(monthStart)}' AND '${fmt(monthEnd)}' AND ${ACTIVE_FILTER}
       ORDER BY segments.month`,
    ),
    buildWeekly(customerId, timeZone),
  ]);

  const ratio = (a: number, b: number) => (b > 0 ? a / b : 0);

  // Trend (daily) — sum by date.
  const trendMap: Record<string, { spend: number; conversions: number }> = {};
  for (const r of trendRows) {
    const date = ((r.segments ?? {}) as { date?: string }).date ?? "";
    const m = (r.metrics ?? {}) as Record<string, unknown>;
    trendMap[date] ??= { spend: 0, conversions: 0 };
    trendMap[date].spend += micros(m.costMicros);
    trendMap[date].conversions += num(m.conversions);
  }
  const trend = Object.entries(trendMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }));

  // Device — sum by device.
  const devMap: Record<string, { spend: number; conversions: number }> = {};
  for (const r of deviceRows) {
    const device = String(((r.segments ?? {}) as { device?: string }).device ?? "UNKNOWN");
    const m = (r.metrics ?? {}) as Record<string, unknown>;
    devMap[device] ??= { spend: 0, conversions: 0 };
    devMap[device].spend += micros(m.costMicros);
    devMap[device].conversions += num(m.conversions);
  }
  const byDevice = Object.entries(devMap)
    .map(([device, v]) => ({ device: prettyDevice(device), ...v }))
    .sort((a, b) => b.spend - a.spend);

  const byChannel = Object.entries(cur.byChannel)
    .map(([channel, v]) => ({
      channel,
      spend: v.spend,
      conversions: v.conversions,
      convValue: v.convValue,
      costPerConv: ratio(v.spend, v.conversions),
      roas: ratio(v.convValue, v.spend),
    }))
    .sort((a, b) => b.spend - a.spend);

  const byCampaign = Object.entries(cur.byName)
    .map(([name, v]) => ({
      name,
      channel: v.channel,
      spend: v.spend,
      conversions: v.conversions,
      costPerConv: ratio(v.spend, v.conversions),
      roas: ratio(v.convValue, v.spend),
    }))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 10);

  // Swydo-style "Campaign performance" grid: every metric with this-period
  // value + %Δ vs the prior window (joined by campaign name across cur/prev).
  const empty = { channel: "—", spend: 0, impressions: 0, clicks: 0, conversions: 0, convValue: 0 };
  const ctrOf = (clicks: number, impr: number) => (impr > 0 ? (clicks / impr) * 100 : 0);
  const cvrOf = (conv: number, clicks: number) => (clicks > 0 ? (conv / clicks) * 100 : 0);
  const campaignPerformance = Array.from(
    new Set([...Object.keys(cur.byName), ...Object.keys(prev.byName)]),
  )
    .map((name) => {
      const c = cur.byName[name] ?? empty;
      const p = prev.byName[name] ?? empty;
      return {
        name,
        channel: (cur.byName[name] ?? prev.byName[name] ?? empty).channel,
        clicks: kpi(c.clicks, p.clicks),
        impressions: kpi(c.impressions, p.impressions),
        ctr: kpi(ctrOf(c.clicks, c.impressions), ctrOf(p.clicks, p.impressions)),
        avgCpc: kpi(ratio(c.spend, c.clicks), ratio(p.spend, p.clicks)),
        cost: kpi(c.spend, p.spend),
        conversions: kpi(c.conversions, p.conversions),
        costPerConv: kpi(ratio(c.spend, c.conversions), ratio(p.spend, p.conversions)),
        convRate: kpi(cvrOf(c.conversions, c.clicks), cvrOf(p.conversions, p.clicks)),
      };
    })
    .sort((a, b) => b.cost.value - a.cost.value)
    .slice(0, 15);

  const topSearchTerms = termRows.map((r) => {
    const m = (r.metrics ?? {}) as Record<string, unknown>;
    return {
      term: ((r.searchTermView ?? {}) as { searchTerm?: string }).searchTerm ?? "—",
      spend: micros(m.costMicros),
      conversions: num(m.conversions),
    };
  });

  // Conversions split by conversion action / type (account-wide).
  const caMap: Record<string, { conversions: number; convValue: number }> = {};
  for (const r of convActionRows) {
    const action = ((r.segments ?? {}) as { conversionActionName?: string }).conversionActionName ?? "(unattributed)";
    const m = (r.metrics ?? {}) as Record<string, unknown>;
    caMap[action] ??= { conversions: 0, convValue: 0 };
    caMap[action].conversions += num(m.conversions);
    caMap[action].convValue += num(m.conversionsValue);
  }
  const byConversionAction = Object.entries(caMap)
    .map(([action, v]) => ({ action, ...v }))
    .sort((a, b) => b.conversions - a.conversions)
    .slice(0, 10);

  // Top performing ads (by conversions). RSA headlines come as an array of
  // text assets; show the leading headlines, falling back to ad name/type.
  const topAds = adRows.map((r) => {
    const m = (r.metrics ?? {}) as Record<string, unknown>;
    const ad = (((r.adGroupAd ?? {}) as Record<string, unknown>).ad ?? {}) as {
      name?: string;
      type?: string;
      responsiveSearchAd?: { headlines?: { text?: string }[] };
      finalUrls?: string[];
    };
    const headlines = (ad.responsiveSearchAd?.headlines ?? [])
      .map((h) => h.text)
      .filter(Boolean)
      .slice(0, 3)
      .join(" | ");
    const headline = headlines || ad.name || prettyAdType(ad.type) || "Ad";
    const clicks = num(m.clicks);
    const impressions = num(m.impressions);
    return {
      headline,
      finalUrl: ad.finalUrls?.[0] ?? "",
      campaign: ((r.campaign ?? {}) as { name?: string }).name ?? "—",
      impressions,
      clicks,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
      cost: micros(m.costMicros),
      conversions: num(m.conversions),
      convValue: num(m.conversionsValue),
    };
  });

  // Month performance — aggregate per calendar month, most recent first.
  const monthMap: Record<string, { impressions: number; clicks: number; cost: number; conversions: number }> = {};
  for (const r of monthRows) {
    const key = ((r.segments ?? {}) as { month?: string }).month ?? "";
    if (!key) continue;
    const m = (r.metrics ?? {}) as Record<string, unknown>;
    monthMap[key] ??= { impressions: 0, clicks: 0, cost: 0, conversions: 0 };
    monthMap[key].impressions += num(m.impressions);
    monthMap[key].clicks += num(m.clicks);
    monthMap[key].cost += micros(m.costMicros);
    monthMap[key].conversions += num(m.conversions);
  }
  const monthLabel = (key: string) =>
    new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long", year: "numeric" }).format(
      new Date(`${key}T00:00:00Z`),
    );
  const monthPerformance = Object.entries(monthMap)
    .sort(([a], [b]) => b.localeCompare(a)) // most recent month first
    .map(([key, v]) => ({
      month: monthLabel(key),
      clicks: v.clicks,
      impressions: v.impressions,
      ctr: v.impressions > 0 ? (v.clicks / v.impressions) * 100 : 0,
      avgCpc: ratio(v.cost, v.clicks),
      cost: v.cost,
      conversions: v.conversions,
      costPerConv: ratio(v.cost, v.conversions),
    }));

  return {
    currency,
    timeZone,
    window: windowDays,
    range: { start: w.start, end: w.end },
    hasConversionValue: cur.convValue > 0,
    weekly,
    kpis: {
      spend: kpi(cur.spend, prev.spend),
      impressions: kpi(cur.impressions, prev.impressions),
      clicks: kpi(cur.clicks, prev.clicks),
      ctr: kpi(ratio(cur.clicks, cur.impressions) * 100, ratio(prev.clicks, prev.impressions) * 100),
      avgCpc: kpi(ratio(cur.spend, cur.clicks), ratio(prev.spend, prev.clicks)),
      conversions: kpi(cur.conversions, prev.conversions),
      costPerConv: kpi(ratio(cur.spend, cur.conversions), ratio(prev.spend, prev.conversions)),
      convValue: kpi(cur.convValue, prev.convValue),
      roas: kpi(ratio(cur.convValue, cur.spend), ratio(prev.convValue, prev.spend)),
      convRate: kpi(ratio(cur.conversions, cur.clicks) * 100, ratio(prev.conversions, prev.clicks) * 100),
      searchImprShare: { value: sis.impressionShare, prev: 0, deltaPct: null }, // no prior IS → no delta
      conversionsByTime: kpi(cur.convByTime, prev.convByTime),
      convValueByTime: kpi(cur.convValueByTime, prev.convValueByTime),
      roasByTime: kpi(ratio(cur.convValueByTime, cur.spend), ratio(prev.convValueByTime, prev.spend)),
      aov: kpi(ratio(cur.convValue, cur.conversions), ratio(prev.convValue, prev.conversions)),
    },
    avgOrdersPerDay: windowDays > 0 ? cur.conversions / windowDays : 0,
    avgRevenuePerDay: windowDays > 0 ? cur.convValue / windowDays : 0,
    trend,
    byChannel,
    byCampaign,
    campaignPerformance,
    byDevice,
    topSearchTerms,
    byConversionAction,
    topAds,
    impressionShare: sis,
    monthPerformance,
  };
}

/**
 * Generate the weekly report for one account: the verified weekly numbers, plus
 * a plain-text rendering for Slack (template — words only, never figures).
 */
export async function generateWeeklyReport(customerId: string): Promise<{
  currency: string;
  timeZone: string;
  weekly: WeeklySummary;
  text: string;
}> {
  const metaRows = await gaqlSearch(
    customerId,
    "SELECT customer.currency_code, customer.time_zone FROM customer LIMIT 1",
  );
  const cust = (metaRows[0]?.customer ?? {}) as {
    currencyCode?: string;
    timeZone?: string;
  };
  const currency = cust.currencyCode ?? "USD";
  const timeZone = cust.timeZone ?? "Etc/UTC";
  const weekly = await buildWeekly(customerId, timeZone);
  return { currency, timeZone, weekly, text: formatWeeklyText(weekly, currency) };
}

/** Lightweight per-account headline summary for the agency Command Center —
 *  just the KPIs + deltas needed for the overview table + alert rules, in ~3
 *  GAQL calls (meta + cur/prev campaign totals), not the full 14-call dashboard. */
export interface AccountSummary {
  currency: string;
  range: { start: string; end: string };
  priorRange: { start: string; end: string };
  hasConversionValue: boolean;
  spend: Kpi; conversions: Kpi; convValue: Kpi;
  cpa: Kpi; roas: Kpi; convRate: Kpi;
  impressions: Kpi; clicks: Kpi;
}
export async function getAccountSummary(
  customerId: string,
  windowDays: ReportWindow = 7,
): Promise<AccountSummary> {
  const metaRows = await gaqlSearch(
    customerId,
    "SELECT customer.currency_code, customer.time_zone FROM customer LIMIT 1",
  );
  const cust = (metaRows[0]?.customer ?? {}) as { currencyCode?: string; timeZone?: string };
  const currency = cust.currencyCode ?? "USD";
  const timeZone = cust.timeZone ?? "Etc/UTC";
  const w = windows(timeZone, windowDays);
  const [cur, prev] = await Promise.all([
    campaignTotals(customerId, w.start, w.end),
    campaignTotals(customerId, w.prevStart, w.prevEnd),
  ]);
  const ratio = (a: number, b: number) => (b > 0 ? a / b : 0);
  return {
    currency,
    range: { start: w.start, end: w.end },
    priorRange: { start: w.prevStart, end: w.prevEnd },
    hasConversionValue: cur.convValue > 0,
    spend: kpi(cur.spend, prev.spend),
    conversions: kpi(cur.conversions, prev.conversions),
    convValue: kpi(cur.convValue, prev.convValue),
    cpa: kpi(ratio(cur.spend, cur.conversions), ratio(prev.spend, prev.conversions)),
    roas: kpi(ratio(cur.convValue, cur.spend), ratio(prev.convValue, prev.spend)),
    convRate: kpi(ratio(cur.conversions, cur.clicks) * 100, ratio(prev.conversions, prev.clicks) * 100),
    impressions: kpi(cur.impressions, prev.impressions),
    clicks: kpi(cur.clicks, prev.clicks),
  };
}

/**
 * The bulleted weekly-update text (Slack fallback when no LLM narrative). Pure
 * formatting over an already-computed WeeklySummary — so callers that already
 * have the dashboard payload (which contains `weekly`) can reuse it without
 * re-querying. Account-wide; conversions by interaction date.
 */
export function formatWeeklyText(weekly: WeeklySummary, currency: string): string {
  const money = (n: number) =>
    new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(n);
  const dec1 = (n: number) =>
    new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(n);
  const delta = (k: Kpi) =>
    k.deltaPct == null
      ? ""
      : ` (${k.deltaPct >= 0 ? "▲" : "▼"}${Math.abs(k.deltaPct).toFixed(0)}% vs prior week)`;
  const changes = weekly.changeLines.length
    ? `Changes this week: ${weekly.changeLines.join(", ")}.`
    : "No account changes this week.";
  return [
    `📈 *Weekly update* (${weekly.start} → ${weekly.end}) — all campaign types`,
    `• Spend: ${money(weekly.spend.value)}${delta(weekly.spend)}`,
    `• Conversions: ${dec1(weekly.conversions.value)}${delta(weekly.conversions)}`,
    `• ${changes}`,
  ].join("\n");
}

function prettyDevice(d: string): string {
  const map: Record<string, string> = {
    MOBILE: "Mobile",
    DESKTOP: "Desktop",
    TABLET: "Tablet",
    CONNECTED_TV: "Connected TV",
    OTHER: "Other",
  };
  return map[d] ?? "Other";
}

function prettyAdType(t?: string): string {
  if (!t) return "";
  return t
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\bad\b/g, "ad")
    .replace(/^\w/, (c) => c.toUpperCase());
}

/**
 * Cached dashboard fetch. Reads a fresh-enough payload from ads_report_cache;
 * otherwise queries Google, writes the cache, and returns. Cache failures
 * (e.g. table not migrated yet) degrade gracefully to a live query.
 */
export async function getDashboard(
  clientId: string | null,
  customerId: string,
  range: DashRange = { kind: "week" },
): Promise<DashboardPayload> {
  // Cache ONLY the canonical Mon–Sun week for imported clients (the cron + the
  // default dashboard view). Everything else — MCC-wide reads with no clientId,
  // and the 7d/14d/30d/month/custom ranges — computes live: the cache key is an
  // int window_days that can't disambiguate week-vs-7d or custom windows, and
  // those ranges are user-triggered rather than hot paths.
  if (!clientId || range.kind !== "week") return buildDashboard(customerId, range);

  const supabase = createSupabaseAdminClient();
  try {
    const { data } = await supabase
      .from("ads_report_cache")
      .select("payload, fetched_at")
      .eq("client_id", clientId)
      .eq("window_days", 7)
      .single();
    if (data && Date.now() - new Date(data.fetched_at).getTime() < CACHE_TTL_MS) {
      return data.payload as DashboardPayload;
    }
  } catch {
    /* cache miss / table missing — fall through to live */
  }

  const payload = await buildDashboard(customerId, range);

  try {
    await supabase
      .from("ads_report_cache")
      .upsert({ client_id: clientId, window_days: 7, payload, fetched_at: new Date().toISOString() });
  } catch {
    /* cache write best-effort */
  }
  return payload;
}

// Figure builders for the report engine: read the four windows and the honesty
// inputs (deduplicated reach, event sources) from each platform, and carry the
// derived figures the draft will STATE so checkReport can recompute them.
//
// Both builders are best-effort: a failed read returns what could be read with
// fewer windows, and the four-window check downgrades the report visibly
// rather than anything here pretending.
import { gaqlSearch } from "@/lib/integrations/google-ads";
import { metaGraphAll } from "@/lib/integrations/meta";
import type { MetaWeekly } from "@/lib/integrations/meta/weekly";
import { getStoreLedgerForMetaAccount } from "@/lib/store-ledger";
import type { ReportFigures, WindowMetrics, EventSource } from "@/lib/report-engine";

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const num = (v: unknown) => Number(v ?? 0) || 0;
const LABELS = ["this week", "last week", "2 weeks ago", "3 weeks ago"];

function weekRanges(currentStart: string, currentEnd: string): { label: string; start: string; end: string }[] {
  const out: { label: string; start: string; end: string }[] = [];
  let start = new Date(currentStart + "T00:00:00Z");
  let end = new Date(currentEnd + "T00:00:00Z");
  for (let i = 0; i < 4; i++) {
    out.push({ label: LABELS[i], start: ymd(start), end: ymd(end) });
    start = new Date(start.getTime() - 7 * 86_400_000);
    end = new Date(end.getTime() - 7 * 86_400_000);
  }
  return out;
}

// ---- Google ----
interface DashLike {
  currency: string;
  weekly: { start: string; end: string };
  kpis: {
    spend: { value: number }; conversions: { value: number }; costPerConv: { value: number };
    roas: { value: number }; aov: { value: number }; ctr: { value: number }; avgCpc: { value: number };
    convValue: { value: number };
  };
  hasConversionValue: boolean;
}

export async function googleReportFigures(reportingId: string, dash: DashLike): Promise<ReportFigures> {
  const ranges = weekRanges(dash.weekly.start, dash.weekly.end);
  const windows: WindowMetrics[] = await Promise.all(ranges.map(async (r) => {
    try {
      const rows = await gaqlSearch(
        reportingId,
        `SELECT metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions, metrics.conversions_value
         FROM customer WHERE segments.date BETWEEN '${r.start}' AND '${r.end}'`,
      );
      const t = { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 };
      for (const row of rows) {
        const m = (row.metrics ?? {}) as Record<string, unknown>;
        t.spend += num(m.costMicros) / 1e6; t.impressions += num(m.impressions);
        t.clicks += num(m.clicks); t.conversions += num(m.conversions); t.revenue += num(m.conversionsValue);
      }
      return { ...r, ...t, leads: 0, reach: null };
    } catch {
      return null as unknown as WindowMetrics;
    }
  })).then((ws) => ws.filter(Boolean));

  const k = dash.kpis;
  return {
    platform: "google",
    currency: dash.currency,
    windows,
    claims: {
      cpa: k.conversions.value > 0 ? k.costPerConv.value : null,
      roas: dash.hasConversionValue && k.spend.value > 0 ? k.roas.value : null,
      aov: dash.hasConversionValue && k.conversions.value > 0 ? k.aov.value : null,
      ctr: k.ctr.value || null,
      cpc: k.avgCpc.value || null,
    },
    storeLedger: null, // seam: no per-client store connection wired into this leg yet
  };
}

// ---- Meta ----
const PURCHASE_TYPES = ["offsite_conversion.fb_pixel_purchase", "purchase", "omni_purchase"];
const LEAD_TYPES = ["offsite_conversion.fb_pixel_lead", "lead", "onsite_conversion.lead_grouped"];

type ActionRow = { action_type?: string; value?: unknown };
const firstOf = (list: ActionRow[], keys: string[]): { type: string; count: number } | null => {
  for (const k of keys) {
    const hit = list.find((a) => a.action_type === k);
    if (hit) return { type: k, count: num(hit.value) };
  }
  return null;
};

export async function metaReportFigures(accountId: string, weekly: MetaWeekly): Promise<ReportFigures> {
  const act = accountId.startsWith("act_") ? accountId : `act_${accountId}`;
  const ranges = weekRanges(weekly.period.start, weekly.period.end);
  const timeRanges = JSON.stringify(ranges.map((r) => ({ since: r.start, until: r.end })));
  const fields = "spend,impressions,clicks,reach,actions,action_values";

  // One call, one row per range, each with its own DEDUPLICATED account reach.
  const perRange = await metaGraphAll(`${act}/insights`, { fields, time_ranges: timeRanges }, 20);
  const windows: WindowMetrics[] = [];
  let eventSources: EventSource[] = [];
  for (const r of ranges) {
    const row = perRange.rows.find((x) => x.date_start === r.start && x.date_stop === r.end);
    if (!row) continue;
    const actions = (row.actions as ActionRow[] | undefined) ?? [];
    const values = (row.action_values as ActionRow[] | undefined) ?? [];
    const purchase = firstOf(actions, PURCHASE_TYPES);
    const lead = firstOf(actions, LEAD_TYPES);
    const revenue = firstOf(values, PURCHASE_TYPES);
    windows.push({
      ...r,
      spend: num(row.spend), impressions: num(row.impressions), clicks: num(row.clicks),
      conversions: purchase?.count ?? 0, revenue: revenue?.count ?? 0, leads: lead?.count ?? 0,
      reach: row.reach != null ? num(row.reach) : null,
    });
    if (r.label === "this week") {
      eventSources = [
        ...(purchase ? [{ label: "purchases", actionType: purchase.type, count: purchase.count }] : []),
        ...(lead ? [{ label: "leads", actionType: lead.type, count: lead.count }] : []),
      ];
    }
  }

  // Campaign-level reach for the current window, SUMMED: kept only so the
  // summed-reach error is detectable, never reportable as reach.
  let reachSummed: number | null = null;
  try {
    const camp = await metaGraphAll(`${act}/insights`, {
      fields: "reach", level: "campaign",
      time_range: JSON.stringify({ since: weekly.period.start, until: weekly.period.end }),
    }, 200);
    if (!camp.error || camp.rows.length) reachSummed = camp.rows.reduce((s, r) => s + num(r.reach), 0);
  } catch { /* best-effort */ }

  // Store ledger (POAS leg, freeze lifted 2026-09-04): the merchant's own
  // orders for the same window, with profit where a COGS sheet covers them.
  // Null means no connected store maps to this ad account; stated, never hidden.
  const ledger = await getStoreLedgerForMetaAccount(accountId, weekly.period.start, weekly.period.end).catch(() => null);
  const spend = windows[0]?.spend ?? 0;
  const poas = ledger && ledger.profit != null && ledger.cogsCoveragePct >= 100 && spend > 0
    ? ledger.profit / spend
    : null;

  const c = weekly.current;
  return {
    platform: "meta",
    currency: weekly.currency,
    windows,
    claims: {
      cpa: c.costPerPurchase,
      costPerLead: c.costPerLead,
      roas: c.roas,
      ctr: c.ctr || null,
      cpm: c.cpm || null,
      reach: c.reach || null,
      poas,
    },
    reachSummedAcrossCampaigns: reachSummed,
    eventSources,
    storeLedger: ledger,
  };
}

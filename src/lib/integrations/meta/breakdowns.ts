// Breakdown reads for Meta reporting (build brief docs/META_REPORTING_BUILD_BRIEF.md,
// 2026-08-28): placement, age and gender, ad-level performance with video
// engagement, and the two crosses the client question actually needs, creative
// by placement and creative by demographic. Scoped to a caller-supplied window
// and an optional campaign set, because account-wide 90-day totals answer a
// different question from "how is the campaign that launched on the 17th doing".
//
// Two Meta constraints shape this file:
// - Placement and demographic breakdowns cannot be combined in one insights
//   call (Meta rejects cross-family combinations), so the crosses are separate
//   requests joined on ad_id here.
// - Breakdowns at level ad multiply rows (ads x segments), so the ad-level
//   calls page at 500 rows with a deep cap instead of the default 100/3000.
//
// Read-only throughout. Anything that fails is returned as { error }; callers
// must skip an errored section rather than treat it as an absence.
import { metaGraphGet, metaGraphAll, normalizeActId } from "@/lib/integrations/meta";
import { INSIGHT_FIELDS, action, actionValue, isErr, type Row, type Maybe } from "@/lib/integrations/meta/audit-deep";

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const num = (v: unknown) => Number(v ?? 0) || 0;

const videoMetric = (r: Row, field: string): number => {
  const list = (r[field] as { action_type?: string; value?: unknown }[] | undefined) ?? [];
  return num(list.find((a) => a.action_type === "video_view")?.value);
};

/** One measured cell: a segment, an ad, or an ad x segment cross. Carries both
 *  the purchase and the lead result so ecommerce and lead-gen accounts read
 *  from the same shape; the caller ranks on whichever is non-zero. */
export interface BreakdownCell {
  key: string;
  spend: number;
  impressions: number;
  linkClicks: number;
  linkCtr: number;
  purchases: number;
  revenue: number;
  roas: number;
  leads: number;
  costPerLead: number | null;
  videoPlays: number;
  thruplay: number;
  videoComplete: number;
}

function cellOf(key: string): BreakdownCell {
  return { key, spend: 0, impressions: 0, linkClicks: 0, linkCtr: 0, purchases: 0, revenue: 0, roas: 0, leads: 0, costPerLead: null, videoPlays: 0, thruplay: 0, videoComplete: 0 };
}
function addRow(c: BreakdownCell, r: Row): void {
  c.spend += num(r.spend);
  c.impressions += num(r.impressions);
  c.linkClicks += num(r.inline_link_clicks);
  c.purchases += action(r, "omni_purchase", "purchase");
  c.revenue += actionValue(r, "omni_purchase", "purchase");
  c.leads += action(r, "lead");
  c.videoPlays += videoMetric(r, "video_play_actions");
  c.thruplay += videoMetric(r, "video_thruplay_watched_actions");
  c.videoComplete += videoMetric(r, "video_p100_watched_actions");
}
function finalise(c: BreakdownCell): BreakdownCell {
  c.linkCtr = c.impressions ? (c.linkClicks / c.impressions) * 100 : 0;
  c.roas = c.spend ? c.revenue / c.spend : 0;
  c.costPerLead = c.leads ? c.spend / c.leads : null;
  return c;
}
function aggregate(rs: Row[], keyOf: (r: Row) => string): BreakdownCell[] {
  const m = new Map<string, BreakdownCell>();
  for (const r of rs) {
    const key = keyOf(r);
    const c = m.get(key) ?? cellOf(key);
    addRow(c, r);
    m.set(key, c);
  }
  return [...m.values()].map(finalise).sort((a, b) => b.spend - a.spend);
}

export interface AdBreakdown {
  adId: string;
  adName: string;
  campaign: string;
  totals: BreakdownCell;
  /** publisher_platform/platform_position cells for this ad. */
  byPlacement: BreakdownCell[];
  /** age gender cells for this ad. */
  byDemographic: BreakdownCell[];
}

export interface MetaBreakdowns {
  accountId: string;
  accountName: string;
  currency: string;
  window: { since: string; until: string; days: number };
  /** Names of the campaigns the report is scoped to; empty = whole account. */
  campaignsIncluded: string[];
  byPlacement: Maybe<BreakdownCell[]>;
  byAgeGender: Maybe<BreakdownCell[]>;
  /** Per-ad performance with the two crosses joined on ad_id, top spenders first. */
  ads: Maybe<AdBreakdown[]>;
  notes: string[];
}

const placementKey = (r: Row) => `${r.publisher_platform ?? "?"}/${r.platform_position ?? "?"}`;
const demoKey = (r: Row) => `${r.age ?? "?"} ${r.gender ?? "?"}`;

export async function getMetaBreakdowns(
  accountRef: string,
  opts: { days?: number; campaignIds?: string[]; since?: string; until?: string } = {},
): Promise<MetaBreakdowns> {
  const { act, digits } = normalizeActId(accountRef);
  // Exact range wins (weekly/monthly reporting needs Monday-to-Sunday or a
  // calendar month, and a window that "ends yesterday" can never match one);
  // days stays as the trailing-window convenience.
  let start: Date, end: Date, days: number;
  if (opts.since && opts.until && /^\d{4}-\d{2}-\d{2}$/.test(opts.since) && /^\d{4}-\d{2}-\d{2}$/.test(opts.until)) {
    start = new Date(opts.since + "T00:00:00Z");
    end = new Date(opts.until + "T00:00:00Z");
    days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  } else {
    days = Math.min(90, Math.max(7, Math.round(opts.days ?? 30)));
    end = new Date(Date.now() - 86_400_000); // exclude today: intraday is immature
    start = new Date(end.getTime() - (days - 1) * 86_400_000);
  }
  const range = JSON.stringify({ since: ymd(start), until: ymd(end) });

  const campaignIds = (opts.campaignIds ?? []).map((c) => String(c).replace(/\D/g, "")).filter(Boolean);
  const filtering = campaignIds.length
    ? JSON.stringify([{ field: "campaign.id", operator: "IN", value: campaignIds }])
    : undefined;

  const base: Record<string, string> = {
    fields: INSIGHT_FIELDS,
    time_range: range,
    ...(filtering ? { filtering } : {}),
  };
  // Ad-level breakdown calls multiply rows (ads x segments); page at 500 with a
  // deep cap rather than hitting the 100/3000 defaults mid-account.
  const ins = (params: Record<string, string>, cap = 3000) =>
    metaGraphAll(`${act}/insights`, { ...base, limit: "500", ...params }, cap);
  const AD_FIELDS = `ad_id,ad_name,campaign_name,${INSIGHT_FIELDS}`;

  const [accountRes, placementRes, demoRes, adPerfRes, adPlacementRes, adDemoRes] = await Promise.all([
    metaGraphGet(act, { fields: "name,currency" }),
    ins({ breakdowns: "publisher_platform,platform_position" }),
    ins({ breakdowns: "age,gender" }),
    ins({ level: "ad", fields: AD_FIELDS }, 6000),
    ins({ level: "ad", fields: AD_FIELDS, breakdowns: "publisher_platform,platform_position" }, 10000),
    ins({ level: "ad", fields: AD_FIELDS, breakdowns: "age,gender" }, 10000),
  ]);

  // Resolve the campaign names the scope covers, for the header and so a wrong
  // id is visible instead of silently narrowing the report to nothing.
  let campaignsIncluded: string[] = [];
  if (campaignIds.length) {
    const names = await Promise.all(campaignIds.map(async (id) => {
      const r = await metaGraphGet(id, { fields: "name" });
      return r.error ? `${id} (unresolved: ${r.error})` : String((r.data as Row | undefined)?.name ?? id);
    }));
    campaignsIncluded = names;
  }

  const notes: string[] = [
    "Window excludes today: Meta backloads delivery and intraday numbers are immature.",
    "Placement and demographic breakdowns are separate Meta calls (the API cannot combine them); crosses are joined on ad_id.",
  ];
  if (!campaignIds.length) notes.push("Account-wide: no campaign filter was supplied.");

  const acc = (accountRes.data ?? {}) as Row;

  // Join the two ad-level crosses on ad_id.
  let ads: Maybe<AdBreakdown[]>;
  if (adPerfRes.error && !adPerfRes.rows.length) {
    ads = { error: adPerfRes.error };
  } else {
    const byAd = new Map<string, AdBreakdown>();
    for (const r of adPerfRes.rows) {
      const id = String(r.ad_id ?? "");
      if (!id) continue;
      const a = byAd.get(id) ?? {
        adId: id, adName: String(r.ad_name ?? ""), campaign: String(r.campaign_name ?? ""),
        totals: cellOf(id), byPlacement: [], byDemographic: [],
      };
      addRow(a.totals, r);
      byAd.set(id, a);
    }
    const crossInto = (rows: Row[], pick: (a: AdBreakdown) => BreakdownCell[], keyOf: (r: Row) => string) => {
      const per = new Map<string, Map<string, BreakdownCell>>();
      for (const r of rows) {
        const id = String(r.ad_id ?? "");
        if (!id || !byAd.has(id)) continue;
        const m = per.get(id) ?? new Map<string, BreakdownCell>();
        const key = keyOf(r);
        const c = m.get(key) ?? cellOf(key);
        addRow(c, r);
        m.set(key, c);
        per.set(id, m);
      }
      for (const [id, m] of per) {
        const list = pick(byAd.get(id)!);
        list.push(...[...m.values()].map(finalise).sort((a, b) => b.spend - a.spend));
      }
    };
    if (!adPlacementRes.error || adPlacementRes.rows.length) crossInto(adPlacementRes.rows, (a) => a.byPlacement, placementKey);
    else notes.push(`Creative-by-placement read failed: ${adPlacementRes.error}`);
    if (!adDemoRes.error || adDemoRes.rows.length) crossInto(adDemoRes.rows, (a) => a.byDemographic, demoKey);
    else notes.push(`Creative-by-demographic read failed: ${adDemoRes.error}`);
    ads = [...byAd.values()]
      .map((a) => ({ ...a, totals: finalise(a.totals) }))
      .sort((a, b) => b.totals.spend - a.totals.spend);
  }

  return {
    accountId: digits,
    accountName: String(acc.name ?? digits),
    currency: String(acc.currency ?? ""),
    window: { since: ymd(start), until: ymd(end), days },
    campaignsIncluded,
    byPlacement: placementRes.error && !placementRes.rows.length ? { error: placementRes.error } : aggregate(placementRes.rows, placementKey),
    byAgeGender: demoRes.error && !demoRes.rows.length ? { error: demoRes.error } : aggregate(demoRes.rows, demoKey),
    ads,
    notes,
  };
}

/**
 * Compact text rendering of the breakdowns for the weekly Slack draft: the
 * depth the client-facing report is built from (placement, demographic,
 * creative, video), in a dozen lines rather than the full tables. Adaptive:
 * ranks on ROAS where purchases exist, cost per lead where only leads do.
 * Counts ride next to everything, because single-digit results are
 * observations, not rankings.
 */
export function formatMetaBreakdownsText(b: MetaBreakdowns): string {
  const flat: BreakdownCell[] = [
    ...(isErr(b.byPlacement) ? [] : b.byPlacement),
    ...(isErr(b.byAgeGender) ? [] : b.byAgeGender),
  ];
  const hasPurchases = flat.some((c) => c.purchases > 0);
  const money = (v: number) => `${b.currency} ${v.toFixed(2)}`;
  const result = (c: BreakdownCell) =>
    hasPurchases
      ? `${c.purchases} purchases${c.purchases ? `, ROAS ${c.roas.toFixed(2)}` : ""}`
      : `${c.leads} ${c.leads === 1 ? "lead" : "leads"}${c.costPerLead != null ? ` at ${money(c.costPerLead)}` : ""}`;
  const lines: string[] = [];

  if (!isErr(b.byPlacement) && b.byPlacement.length) {
    lines.push("Placements (top by spend):");
    for (const c of b.byPlacement.slice(0, 5)) {
      lines.push(`  ${c.key}: ${money(c.spend)}, ${result(c)}, CTR ${c.linkCtr.toFixed(2)}%`);
    }
  }
  if (!isErr(b.byAgeGender) && b.byAgeGender.length) {
    const withResults = b.byAgeGender.filter((c) => (hasPurchases ? c.purchases : c.leads) > 0);
    const top = (withResults.length ? withResults : b.byAgeGender).slice(0, 5);
    lines.push("");
    lines.push(withResults.length ? "Who is responding (age gender cells with results):" : "Age and gender (top spend, no results yet):");
    for (const c of top) lines.push(`  ${c.key}: ${money(c.spend)}, ${result(c)}`);
  }
  if (!isErr(b.ads) && b.ads.length) {
    lines.push("");
    lines.push("Creatives (top by spend):");
    for (const a of b.ads.slice(0, 5)) {
      const best = a.byPlacement
        .filter((c) => (hasPurchases ? c.purchases : c.leads) > 0)
        .sort((x, y) => (hasPurchases ? y.roas - x.roas : (x.costPerLead ?? Infinity) - (y.costPerLead ?? Infinity)))[0];
      const video = a.totals.videoPlays > 0
        ? `, video ${Math.round(a.totals.videoPlays).toLocaleString()} plays${a.totals.videoPlays ? ` (${((a.totals.videoComplete / a.totals.videoPlays) * 100).toFixed(1)}% complete)` : ""}`
        : "";
      lines.push(`  ${a.adName}: ${money(a.totals.spend)}, ${result(a.totals)}${best ? `, best in ${best.key} (${result(best)})` : ""}${video}`);
    }
  }
  return lines.join("\n");
}

export { isErr };

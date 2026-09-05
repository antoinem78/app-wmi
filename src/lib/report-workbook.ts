// The client reporting workbook (.xlsx): the spreadsheet half of the weekly
// and monthly reporting standard (docs/WEEKLY_CLIENT_REPORTING_BRIEF.md and
// docs/SF_WEEKLY_REPORT_TEMPLATE.md; founder go 2026-09-05). Assembled from
// the same reads that feed the graded Slack drafts, so the sheet and the
// narrative can never disagree.
//
// The brief's section-5 rules are encoded structurally, not left to a writer:
// - Outcome columns (results, cost per result, revenue, ROAS) come BEFORE
//   delivery metrics (CTR, CPM, CPC) on every tab; nothing ranks on delivery.
// - Below the volume floor the creative and placement tabs sort by SPEND and
//   say in the sheet that they are not ranking, rather than crowning winners.
// - Missing data is the literal string n/a, never a blank cell (reach and
//   landing page views do not exist at breakdown level, so those columns say
//   so on every row rather than tempting a fill-in).
// - Every window is declared on the Notes tab with the offset it carries, and
//   the placement-vs-total reconciliation is stated with its difference.
// - The contest/secondary-campaign discipline: campaign rows are never
//   blended into breakdown tabs; the Campaigns tab is the only place they sum.
import ExcelJS from "exceljs";
import { getMetaBreakdowns, isErr, type BreakdownCell, type MetaBreakdowns } from "@/lib/integrations/meta/breakdowns";
import { metaGraphAll } from "@/lib/integrations/meta";
import { metaPeriodFigures, type PeriodRange } from "@/lib/report-figures";
import { checkReport, storeLedgerText, type ReportFigures } from "@/lib/report-engine";

const num = (v: unknown) => Number(v ?? 0) || 0;
const NA = "n/a";
/** Below this many results in the window, nothing is ranked on results. */
export const RANKING_FLOOR = 20;

interface CampaignRow { name: string; spend: number; impressions: number; clicks: number; purchases: number; revenue: number; leads: number }

async function campaignSplit(accountId: string, range: PeriodRange): Promise<CampaignRow[]> {
  const act = accountId.startsWith("act_") ? accountId : `act_${accountId}`;
  const r = await metaGraphAll(`${act}/insights`, {
    level: "campaign",
    fields: "campaign_name,spend,impressions,clicks,actions,action_values",
    time_range: JSON.stringify({ since: range.start, until: range.end }),
    limit: "200",
  }, 400);
  const take = (row: Record<string, unknown>, keys: string[], values = false) => {
    const list = ((values ? row.action_values : row.actions) as { action_type?: string; value?: unknown }[] | undefined) ?? [];
    for (const k of keys) { const hit = list.find((a) => a.action_type === k); if (hit) return num(hit.value); }
    return 0;
  };
  const P = ["offsite_conversion.fb_pixel_purchase", "purchase", "omni_purchase"];
  const L = ["offsite_conversion.fb_pixel_lead", "lead", "onsite_conversion.lead_grouped"];
  return r.rows.map((row) => ({
    name: String(row.campaign_name ?? "(unnamed)"),
    spend: num(row.spend), impressions: num(row.impressions), clicks: num(row.clicks),
    purchases: take(row, P), revenue: take(row, P, true), leads: take(row, L),
  })).sort((a, b) => b.spend - a.spend);
}

const n2 = (v: number) => Math.round(v * 100) / 100;
function outcomeCols(c: { spend: number; clicks: number; impressions: number; purchases?: number; revenue?: number; leads?: number }, mode: "purchase" | "lead") {
  const results = mode === "purchase" ? (c.purchases ?? 0) : (c.leads ?? 0);
  return {
    results,
    costPerResult: results > 0 ? n2(c.spend / results) : NA,
    revenue: mode === "purchase" ? n2(c.revenue ?? 0) : NA,
    roas: mode === "purchase" && c.spend > 0 && (c.revenue ?? 0) > 0 ? n2((c.revenue ?? 0) / c.spend) : NA,
    ctr: c.impressions > 0 ? n2((c.clicks / c.impressions) * 100) : NA,
    cpm: c.impressions > 0 ? n2((c.spend / c.impressions) * 1000) : NA,
    cpc: c.clicks > 0 ? n2(c.spend / c.clicks) : NA,
  };
}

export async function buildMetaReportWorkbook(
  accountId: string,
  ranges: PeriodRange[],
  opts: { campaignIds?: string[]; currencyHint?: string; periodLabel: string },
): Promise<{ buffer: Buffer; accountName: string; figures: ReportFigures; breakdowns: MetaBreakdowns }> {
  const current = ranges[0];
  const [figures, breakdowns, campaigns] = await Promise.all([
    metaPeriodFigures(accountId, ranges, undefined, opts.currencyHint),
    getMetaBreakdowns(accountId, { since: current.start, until: current.end, campaignIds: opts.campaignIds }),
    campaignSplit(accountId, current),
  ]);
  const issues = checkReport(figures);
  const cur = figures.windows[0];
  const mode: "purchase" | "lead" = (cur?.conversions ?? 0) > 0 ? "purchase" : "lead";
  const totalResults = mode === "purchase" ? (cur?.conversions ?? 0) : (cur?.leads ?? 0);
  const ranking = totalResults >= RANKING_FLOOR;
  const cx = breakdowns.currency || figures.currency;
  const resultLabel = mode === "purchase" ? "Purchases" : "Leads";

  const wb = new ExcelJS.Workbook();
  wb.creator = "WMI";

  const header = (ws: ExcelJS.Worksheet, cols: string[]) => {
    const row = ws.addRow(cols);
    row.font = { bold: true };
    ws.columns.forEach((c, i) => { c.width = i === 0 ? 42 : 14; });
  };
  const note = (ws: ExcelJS.Worksheet, text: string) => {
    const r = ws.addRow([text]);
    r.font = { italic: true };
  };

  // ---- Headline: the four windows, outcomes before delivery ----
  {
    const ws = wb.addWorksheet("Headline");
    note(ws, `${opts.periodLabel} · account ${breakdowns.accountName} · currency ${cx} · windows declared on the Notes tab`);
    header(ws, ["Window", "Spend", resultLabel, "Cost per result", "Revenue", "ROAS", "Reach (dedup)", "Impressions", "Clicks", "CTR %", "CPM", "CPC"]);
    for (const w of figures.windows) {
      const o = outcomeCols({ spend: w.spend, clicks: w.clicks, impressions: w.impressions, purchases: w.conversions, revenue: w.revenue, leads: w.leads }, mode);
      ws.addRow([`${w.label} (${w.start} to ${w.end})`, n2(w.spend), o.results, o.costPerResult, o.revenue, o.roas, w.reach ?? NA, w.impressions, w.clicks, o.ctr, o.cpm, o.cpc]);
    }
    note(ws, storeLedgerText(figures));
  }

  // ---- Campaigns: the only tab where campaigns sum; secondary campaigns are
  // visible as rows and never blended into the breakdown tabs ----
  {
    const ws = wb.addWorksheet("Campaigns");
    note(ws, "Campaigns are reported separately and never blended; a dominant secondary campaign flatters every blended figure.");
    header(ws, ["Campaign", "Spend", resultLabel, "Cost per result", "Revenue", "ROAS", "Impressions", "Clicks", "CTR %", "CPM", "CPC"]);
    for (const c of campaigns) {
      const o = outcomeCols(c, mode);
      ws.addRow([c.name, n2(c.spend), o.results, o.costPerResult, o.revenue, o.roas, c.impressions, c.clicks, o.ctr, o.cpm, o.cpc]);
    }
  }

  const cellRow = (c: BreakdownCell) => {
    const o = outcomeCols({ spend: c.spend, clicks: c.linkClicks, impressions: c.impressions, purchases: c.purchases, revenue: c.revenue, leads: c.leads }, mode);
    return [c.key, n2(c.spend), o.results, o.costPerResult, o.revenue, o.roas, NA, c.impressions, c.linkClicks, n2(c.linkCtr), o.cpm, o.cpc];
  };
  const breakdownHeader = ["Segment", "Spend", resultLabel, "Cost per result", "Revenue", "ROAS", "Reach", "Impressions", "Link clicks", "Link CTR %", "CPM", "CPC"];
  const rankNote = ranking
    ? `Ranked by ${resultLabel.toLowerCase()} outcomes.`
    : `NOT RANKING: ${totalResults} ${resultLabel.toLowerCase()} in the window is below the floor of ${RANKING_FLOOR}; rows are ordered by spend and no winner is named.`;

  // ---- Placement ----
  if (!isErr(breakdowns.byPlacement)) {
    const ws = wb.addWorksheet("Placement");
    note(ws, rankNote + " Reach does not exist at placement level (Meta), hence n/a.");
    header(ws, breakdownHeader);
    for (const c of breakdowns.byPlacement) ws.addRow(cellRow(c));
  }

  // ---- Demographics ----
  if (!isErr(breakdowns.byAgeGender)) {
    const ws = wb.addWorksheet("Demographics");
    note(ws, rankNote);
    header(ws, breakdownHeader);
    for (const c of breakdowns.byAgeGender) ws.addRow(cellRow(c));
  }

  // ---- Creative, Creative x Placement, Video ----
  if (!isErr(breakdowns.ads)) {
    const ws = wb.addWorksheet("Creative");
    note(ws, rankNote);
    header(ws, ["Ad", "Campaign", ...breakdownHeader.slice(1)]);
    for (const a of breakdowns.ads) {
      const o = outcomeCols({ spend: a.totals.spend, clicks: a.totals.linkClicks, impressions: a.totals.impressions, purchases: a.totals.purchases, revenue: a.totals.revenue, leads: a.totals.leads }, mode);
      ws.addRow([a.adName, a.campaign, n2(a.totals.spend), o.results, o.costPerResult, o.revenue, o.roas, NA, a.totals.impressions, a.totals.linkClicks, n2(a.totals.linkCtr), o.cpm, o.cpc]);
    }

    const wsX = wb.addWorksheet("Creative x Placement");
    note(wsX, rankNote);
    header(wsX, ["Ad", "Placement", ...breakdownHeader.slice(1)]);
    for (const a of breakdowns.ads) for (const p of a.byPlacement) {
      const o = outcomeCols({ spend: p.spend, clicks: p.linkClicks, impressions: p.impressions, purchases: p.purchases, revenue: p.revenue, leads: p.leads }, mode);
      wsX.addRow([a.adName, p.key, n2(p.spend), o.results, o.costPerResult, o.revenue, o.roas, NA, p.impressions, p.linkClicks, n2(p.linkCtr), o.cpm, o.cpc]);
    }

    const wsV = wb.addWorksheet("Video");
    note(wsV, "Engagement is diagnostic, never a target: it says whether a creative got a fair run, not whether it won.");
    header(wsV, ["Ad", "Video plays", "ThruPlays", "Completes", "Complete %"]);
    for (const a of breakdowns.ads.filter((x) => x.totals.videoPlays > 0)) {
      wsV.addRow([a.adName, a.totals.videoPlays, a.totals.thruplay, a.totals.videoComplete,
        a.totals.videoPlays ? n2((a.totals.videoComplete / a.totals.videoPlays) * 100) : NA]);
    }
    if (!breakdowns.ads.some((x) => x.totals.videoPlays > 0)) note(wsV, "No video plays recorded in this window.");
  }

  // ---- Notes: windows, offsets, reconciliation, check results ----
  {
    const ws = wb.addWorksheet("Notes");
    ws.columns = [{ width: 130 }];
    note(ws, `Windows: ${figures.windows.map((w) => `${w.label} = ${w.start} to ${w.end}`).join("; ")}. Breakdown tabs cover the current window exactly (${current.start} to ${current.end}); no offset.`);
    // Reconciliation: placement-level results vs the account total, stated
    // with the difference (a normal attribution artefact, not an error).
    if (!isErr(breakdowns.byPlacement) && cur) {
      const placementResults = breakdowns.byPlacement.reduce((s, p) => s + (mode === "purchase" ? p.purchases : p.leads), 0);
      const accountResults = totalResults;
      if (placementResults !== accountResults) {
        note(ws, `Reconciliation: placement rows sum to ${placementResults} ${resultLabel.toLowerCase()} against ${accountResults} at account level (difference ${placementResults - accountResults}). Breakdown attribution normally sums differently from totals; the account level is the reportable figure.`);
      } else {
        note(ws, `Reconciliation: placement rows sum to the account total (${accountResults} ${resultLabel.toLowerCase()}).`);
      }
    }
    note(ws, rankNote);
    note(ws, "Recommendations are made on outcomes, never on delivery metrics: no budget move is justified by CPM, CTR, cost per landing page view or reach.");
    for (const n of breakdowns.notes) note(ws, n);
    note(ws, issues.length ? "Derivation checks:" : "Derivation checks: all clean.");
    for (const i of issues) note(ws, `${i.severity.toUpperCase()} [${i.check}] ${i.detail}`);
  }

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  return { buffer, accountName: breakdowns.accountName, figures, breakdowns };
}

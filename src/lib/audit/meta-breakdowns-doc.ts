// Meta breakdown tables as a .docx: INTERNAL RAW MATERIAL, deliberately not a
// client document (build brief docs/META_REPORTING_BUILD_BRIEF.md §5). No
// narrative pass, no model involvement: the tables are the deliverable, and
// what a client receives is written separately, as Anthony, from this.
import { Packer, type Paragraph, type Table } from "docx";
import { h1, h2, para, table, buildAuditDoc, type CellVal } from "@/lib/audit/docx";
import { getMetaBreakdowns, isErr, type BreakdownCell } from "@/lib/integrations/meta/breakdowns";

const n0 = (v: number) => Math.round(v).toLocaleString("en-GB");
const n2 = (v: number) => v.toFixed(2);

// Column set switches on what the data holds: lead-gen tables get leads and
// cost per lead, ecommerce tables get purchases, revenue and ROAS. Both only
// when both exist (rare, but a mixed account is a mixed account).
function metricHeaders(hasPurchases: boolean, hasLeads: boolean): string[] {
  const base = ["Spend", "Impressions", "Link clicks", "Link CTR %"];
  if (hasPurchases) base.push("Purchases", "Revenue", "ROAS");
  if (hasLeads || !hasPurchases) base.push("Leads", "Cost/lead");
  return base;
}
function metricCells(c: BreakdownCell, hasPurchases: boolean, hasLeads: boolean): CellVal[] {
  const row: CellVal[] = [n0(c.spend), n0(c.impressions), n0(c.linkClicks), n2(c.linkCtr)];
  if (hasPurchases) row.push(n0(c.purchases), n0(c.revenue), n2(c.roas));
  if (hasLeads || !hasPurchases) row.push(n0(c.leads), c.costPerLead != null ? n2(c.costPerLead) : "-");
  return row;
}
function widthsFor(labels: number): number[] {
  // First column wide for the segment/ad name, the rest split evenly.
  const rest = Math.floor(6360 / labels);
  return [3000, ...Array.from({ length: labels }, () => rest)];
}

function cellTable(title: string, cells: BreakdownCell[], hasPurchases: boolean, hasLeads: boolean): (Paragraph | Table)[] {
  if (!cells.length) return [h2(title), para("No delivery in this window.")];
  const headers = metricHeaders(hasPurchases, hasLeads);
  return [
    h2(title),
    table(widthsFor(headers.length), ["Segment", ...headers],
      cells.map((c) => [c.key, ...metricCells(c, hasPurchases, hasLeads)])),
  ];
}

export async function generateMetaBreakdownsDoc(
  accountRef: string,
  opts: { days?: number; campaignIds?: string[] } = {},
): Promise<{ buffer: Buffer; accountName: string }> {
  const b = await getMetaBreakdowns(accountRef, opts);
  const children: (Paragraph | Table)[] = [];

  const flat: BreakdownCell[] = [
    ...(isErr(b.byPlacement) ? [] : b.byPlacement),
    ...(isErr(b.byAgeGender) ? [] : b.byAgeGender),
  ];
  const hasPurchases = flat.some((c) => c.purchases > 0);
  const hasLeads = flat.some((c) => c.leads > 0);

  children.push(h1(`${b.accountName}: Meta breakdown tables`));
  children.push(para(`Window ${b.window.since} to ${b.window.until} (${b.window.days} days, ending yesterday).`));
  children.push(para(b.campaignsIncluded.length
    ? `Scope: ${b.campaignsIncluded.join("; ")}.`
    : "Scope: whole account (no campaign filter)."));
  children.push(para(`Currency ${b.currency}. Internal working document, not client-facing.`));
  for (const n of b.notes) children.push(para(n));

  if (isErr(b.byPlacement)) children.push(h2("Placement"), para(`Read failed: ${b.byPlacement.error}`));
  else children.push(...cellTable("Placement", b.byPlacement, hasPurchases, hasLeads));

  if (isErr(b.byAgeGender)) children.push(h2("Age and gender"), para(`Read failed: ${b.byAgeGender.error}`));
  else children.push(...cellTable("Age and gender", b.byAgeGender, hasPurchases, hasLeads));

  if (isErr(b.ads)) {
    children.push(h2("Creative"), para(`Read failed: ${b.ads.error}`));
  } else {
    const headers = metricHeaders(hasPurchases, hasLeads);
    children.push(h2("Creative performance"));
    children.push(table(widthsFor(headers.length), ["Ad", ...headers],
      b.ads.slice(0, 30).map((a) => [`${a.adName} (${a.campaign})`, ...metricCells(a.totals, hasPurchases, hasLeads)])));
    children.push(h2("Video engagement by creative"));
    const videoAds = b.ads.filter((a) => a.totals.videoPlays > 0).slice(0, 30);
    if (!videoAds.length) children.push(para("No video plays recorded in this window."));
    else children.push(table([3000, 1600, 1600, 1600, 1560], ["Ad", "Plays", "ThruPlays", "Completes", "Complete %"],
      videoAds.map((a) => [a.adName, n0(a.totals.videoPlays), n0(a.totals.thruplay), n0(a.totals.videoComplete),
        a.totals.videoPlays ? `${((a.totals.videoComplete / a.totals.videoPlays) * 100).toFixed(1)}%` : "-"])));

    const headers2 = metricHeaders(hasPurchases, hasLeads);
    for (const a of b.ads.slice(0, 12)) {
      if (!a.byPlacement.length && !a.byDemographic.length) continue;
      children.push(h2(`${a.adName} (${a.campaign})`));
      if (a.byPlacement.length) {
        children.push(para("By placement:"), table(widthsFor(headers2.length), ["Placement", ...headers2],
          a.byPlacement.slice(0, 12).map((c) => [c.key, ...metricCells(c, hasPurchases, hasLeads)])));
      }
      if (a.byDemographic.length) {
        children.push(para("By age and gender:"), table(widthsFor(headers2.length), ["Segment", ...headers2],
          a.byDemographic.slice(0, 14).map((c) => [c.key, ...metricCells(c, hasPurchases, hasLeads)])));
      }
    }
  }

  const doc = buildAuditDoc(children, `${b.accountName} - Meta breakdowns (internal)`);
  const buffer = await Packer.toBuffer(doc);
  return { buffer, accountName: b.accountName };
}

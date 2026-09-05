// Downloadable client reporting workbook (.xlsx) for one Meta ad account:
// the spreadsheet half of the weekly/monthly reporting standard, generated
// fresh from the same reads that feed the graded Slack drafts. Admin-only,
// read-only on the account. Internal working material feeding the report a
// person writes; never sent to a client as-is.
//
// ?since=YYYY-MM-DD&until=YYYY-MM-DD sets the current window exactly (weekly
// Monday-to-Sunday or a calendar month); prior windows step back by the same
// length. ?period=month uses calendar months instead of same-length steps.
import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth/auth0";
import { isAgencyAdmin } from "@/lib/auth/roles";
import { metaConfigured } from "@/lib/integrations/meta";
import { buildMetaReportWorkbook } from "@/lib/report-workbook";
import { monthRanges, type PeriodRange } from "@/lib/report-figures";

export const maxDuration = 300;

const ymd = (d: Date) => d.toISOString().slice(0, 10);

function sameLengthRanges(since: string, until: string): PeriodRange[] {
  const out: PeriodRange[] = [];
  let s = new Date(since + "T00:00:00Z");
  let e = new Date(until + "T00:00:00Z");
  const len = e.getTime() - s.getTime() + 86_400_000;
  const labels = ["current", "prior", "2 periods back", "3 periods back"];
  for (let i = 0; i < 4; i++) {
    out.push({ label: labels[i], start: ymd(s), end: ymd(e) });
    s = new Date(s.getTime() - len);
    e = new Date(e.getTime() - len);
  }
  return out;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ accountId: string }> },
) {
  const session = await auth0.getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!isAgencyAdmin(session.user as Record<string, unknown>)) {
    return NextResponse.json({ error: "Agency admin only." }, { status: 403 });
  }
  if (!metaConfigured()) {
    return NextResponse.json({ error: "Meta access is not configured on this deployment." }, { status: 503 });
  }
  const { accountId } = await params;
  if (!/^(act_)?\d{6,}$/.test(accountId)) {
    return NextResponse.json({ error: "That doesn't look like a Meta ad account id." }, { status: 400 });
  }
  const url = new URL(request.url);
  const since = url.searchParams.get("since") ?? "";
  const until = url.searchParams.get("until") ?? "";
  const period = url.searchParams.get("period") ?? "";
  const campaignIds = (url.searchParams.get("campaigns") ?? "").split(",").map((c) => c.replace(/\D/g, "")).filter((c) => /^\d{6,}$/.test(c));

  let ranges: PeriodRange[];
  let label: string;
  if (period === "month") {
    ranges = monthRanges(until ? new Date(until + "T00:00:00Z") : new Date());
    // monthRanges anchors on "the month before the anchor's month": passing an
    // until inside the report month needs the anchor pushed one month forward.
    if (until) ranges = monthRanges(new Date(new Date(until + "T00:00:00Z").getTime() + 32 * 86_400_000));
    label = `Monthly report: ${ranges[0].label}`;
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(since) && /^\d{4}-\d{2}-\d{2}$/.test(until) && since <= until) {
    ranges = sameLengthRanges(since, until);
    label = `Weekly report: ${since} to ${until}`;
  } else {
    return NextResponse.json({ error: "Pass since and until (YYYY-MM-DD), or period=month." }, { status: 400 });
  }

  try {
    const { buffer, accountName } = await buildMetaReportWorkbook(accountId.replace(/^act_/, ""), ranges, { campaignIds, periodLabel: label });
    const filename = `${accountName.replace(/[^\w &-]/g, "")} - ${ranges[0].label} report.xlsx`;
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("Report workbook failed:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Workbook generation failed." }, { status: 500 });
  }
}

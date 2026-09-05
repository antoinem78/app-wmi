// Monthly Google Ads cron (vercel.json, 1st of the month): the Google leg of
// the monthly reporting standard (docs/WEEKLY_CLIENT_REPORTING_BRIEF.md,
// founder go 2026-09-05). Same contract as the weekly cron: the dashboard's
// own monthly figures, an LLM narrative, derivation checks over FOUR calendar
// months, Norbert's grade, a Slack review draft. ?only=<client uuid> runs one.
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity";
import { getDashboard, formatWeeklyText } from "@/lib/integrations/google-ads/reporting";
import { generateNarrative, stripEmDashes } from "@/lib/integrations/anthropic/narrative";
import { googleReportFigures, monthRanges } from "@/lib/report-figures";
import { gradeReport, gradeLines } from "@/lib/report-grade";

export const maxDuration = 300;

const CONCURRENCY = 5;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: rows } = await supabase
    .from("onboarding_state")
    .select("client_id, google_ads_customer_id, google_ads_reporting_customer_id, clients(company_name, contact_name, report_prompt)")
    .eq("ad_link_status", "approved")
    .not("google_ads_customer_id", "is", null);

  let clients = rows ?? [];
  const only = (new URL(request.url).searchParams.get("only") ?? "").trim();
  if (only) clients = clients.filter((r) => r.client_id === only);

  const reviewChannel = process.env.SLACK_REVIEW_CHANNEL;
  const slackOn = !!process.env.SLACK_BOT_TOKEN && !!reviewChannel;
  const ranges = monthRanges();
  const month = ranges[0];

  let sent = 0, failed = 0, skipped = 0, slackFailed = 0;
  const errors: string[] = [];

  async function processClient(row: (typeof clients)[number]): Promise<void> {
    const clientId = row.client_id as string;
    const reportingId = (row.google_ads_reporting_customer_id as string | null) ?? (row.google_ads_customer_id as string);
    const clientRow = row.clients as unknown as { company_name?: string; contact_name?: string; report_prompt?: string } | null;
    const companyName = clientRow?.company_name ?? "";
    try {
      const dash = await getDashboard(clientId, reportingId, { kind: "custom", start: month.start, end: month.end });
      if (!dash.kpis.spend.value && !dash.kpis.impressions.value) { skipped++; return; }

      let narrative: string | null = null;
      try {
        narrative = await generateNarrative(dash, companyName, [], (clientRow?.contact_name ?? "").trim(), undefined, clientRow?.report_prompt ?? "");
      } catch (e) {
        console.error(`Monthly narrative skipped for ${clientId}:`, e);
      }
      const body = stripEmDashes(narrative ?? formatWeeklyText(dash.weekly, dash.currency));

      let grade: Awaited<ReturnType<typeof gradeReport>> | null = null;
      try {
        const rf = await googleReportFigures(reportingId, dash as unknown as Parameters<typeof googleReportFigures>[1], ranges);
        grade = await gradeReport(rf, body, companyName);
      } catch (e) {
        console.error(`Monthly grade skipped for ${clientId}:`, e);
      }

      if (slackOn) {
        try {
          const { postMessage } = await import("@/lib/integrations/slack");
          const g = grade ? gradeLines(grade) : { header: "⚠️ UNGRADED · ", footer: ["*Norbert:* grading pass failed outright; treat as unreviewed."] };
          const draft = [
            `📙 ${g.header}*Monthly report draft: ${companyName}* (${month.label}, ${month.start} → ${month.end})`,
            "",
            body,
            ...(grade ? ["", "```", grade.figuresBlock, "```"] : []),
            ...g.footer,
            "_Monthly draft for review — not yet sent to the client._",
          ].join("\n");
          await postMessage(reviewChannel!, draft);
        } catch (e) {
          slackFailed++;
          errors.push(`${clientId} (slack): ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      await logActivity({ clientId, eventType: "monthly_report_generated", actor: "system:cron", payload: { month: month.label } });
      sent++;
    } catch (e) {
      failed++;
      errors.push(`${companyName || clientId}: ${e instanceof Error ? e.message : String(e)}`);
      console.error(`Monthly report failed for ${clientId}:`, e);
    }
  }

  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, clients.length) }, async () => {
      while (cursor < clients.length) {
        const row = clients[cursor++];
        await processClient(row);
      }
    }),
  );

  return NextResponse.json({ month: month.label, clients: clients.length, sent, skipped, failed, slackFailed, ...(errors.length ? { errors: errors.slice(0, 10) } : {}) });
}

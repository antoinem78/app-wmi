// Weekly Meta cron (vercel.json, Mondays): for every Meta ad account the
// system user can see, generate the weekly read and post a review draft to
// Slack. The Meta counterpart to /api/cron/weekly-reports, same contract:
// CRON_SECRET-protected, verified figures from the read layer, an LLM narrative
// over the top, and nothing goes to a client without a human passing it on.
//
// Roster note: Google iterates linked clients from the database. Meta has no
// equivalent link table, so the roster is whatever the system-user token can
// see, which is the same rule the rest of the Meta layer follows: assigning an
// account in Business Manager puts it in reach with no registration step.
// Dormant accounts are skipped rather than reported as empty.
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { listMetaAdAccounts, metaConfigured } from "@/lib/integrations/meta";
import { getMetaWeekly, formatMetaWeeklyText, type MetaWeekly } from "@/lib/integrations/meta/weekly";
import { getMetaBreakdowns, formatMetaBreakdownsText } from "@/lib/integrations/meta/breakdowns";
import { metaReportFigures } from "@/lib/report-figures";
import { gradeReport, gradeLines } from "@/lib/report-grade";
import { stripEmDashes } from "@/lib/integrations/anthropic/narrative";

export const maxDuration = 300;

// Each account is a multi-call Graph read plus an LLM call. Keep the pool small
// enough to stay friendly to Graph rate limits over a whole book of accounts.
const CONCURRENCY = 3;

const SYSTEM = `You write the weekly Meta Ads review note for a paid social agency.

Audience: the founder, reviewing before anything reaches a client. He is an expert, so do not explain what CTR means.

Rules, all firm:
- British spelling (optimise, analyse).
- NEVER use an em dash or en dash. Use full stops, commas, colons or parentheses. En dashes only inside numeric ranges.
- Never say "we", "us" or "our". Write impersonally or in the first person singular.
- Anchor every claim to a figure you were given. Invent nothing. If the data does not support a conclusion, say what would be needed to reach one.
- A week is a short window. Where an ad set is in learning or the sample is small, say so plainly rather than reading a trend into noise.
- The figures include breakdowns (placement, age and gender, creative, video). Name the specific placement, demographic cell or creative where one genuinely stands out; that depth is the point of the report. But NEVER rank creatives or placements on single-digit result counts: report those as observations with the count stated, not as winners.
- Three short paragraphs at most: what happened, what it means, what to watch. No headings, no bullet lists, no sign-off.`;

async function narrate(w: MetaWeekly, figures: string): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  try {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 900,
      // Identical brief for every account in the run, so the first write pays
      // and the rest read back cheap.
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [
        {
          role: "user",
          content:
            `Account: ${w.accountName} (${w.accountId}), currency ${w.currency}.\n` +
            `Week ${w.period.start} to ${w.period.end}, compared with ${w.priorPeriod.start} to ${w.priorPeriod.end}.\n\n` +
            `${figures}\n\nWrite the review note.`,
        },
      ],
    });
    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    return text || null;
  } catch (e) {
    console.error(`Meta narrative skipped for ${w.accountId}:`, e);
    return null;
  }
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!metaConfigured()) {
    return NextResponse.json({ error: "META_ADS_TOKEN not configured" }, { status: 500 });
  }

  const channel = process.env.SLACK_META_REVIEW_CHANNEL;
  const slackOn = !!process.env.SLACK_BOT_TOKEN && !!channel;

  let roster = await listMetaAdAccounts();
  if ("error" in roster) {
    return NextResponse.json({ error: `Could not list ad accounts: ${roster.error}` }, { status: 502 });
  }
  // ?only=<account digits>: single-account run, for acceptance passes and
  // founder-triggered regenerations that should not flood the channel.
  const only = (new URL(request.url).searchParams.get("only") ?? "").replace(/\D/g, "");
  if (only) roster = roster.filter((a) => a.accountId.replace(/\D/g, "") === only);

  // "Generated" and "delivered" are counted apart on purpose. Collapsing them
  // means an unset channel id reports the same success as a delivered report,
  // which is how a first live run looked like it had posted four drafts into a
  // channel it had never contacted.
  let generated = 0;
  let delivered = 0;
  let skipped = 0;
  let failed = 0;
  let slackFailed = 0;
  const errors: string[] = [];

  async function processAccount(acc: { accountId: string; name: string }): Promise<void> {
    try {
      const weekly = await getMetaWeekly(acc.accountId);
      if ("error" in weekly) {
        failed++;
        errors.push(`${acc.name}: ${weekly.error}`);
        return;
      }
      if (weekly.skip) {
        skipped++;
        return;
      }

      // The breakdown depth (placement, demographic, creative, video) is what
      // separates a report from "metrics you can see in Ads Manager", which a
      // client said in as many words (docs/META_REPORTING_BUILD_BRIEF.md).
      // Best-effort: a failed breakdown read degrades to the headline draft
      // rather than failing the account.
      let breakdownText = "";
      try {
        breakdownText = formatMetaBreakdownsText(await getMetaBreakdowns(acc.accountId, { days: 7 }));
      } catch (e) {
        console.error(`Meta weekly breakdowns skipped for ${acc.accountId}:`, e);
      }

      const headline = formatMetaWeeklyText(weekly);
      const figures = breakdownText ? `${headline}\n\n${breakdownText}` : headline;
      const narrative = await narrate(weekly, figures);
      const body = stripEmDashes(narrative ?? figures);

      // Report engine: recompute every stated figure, then Norbert grades the
      // prose. A draft never reaches the channel without its grade.
      let grade: Awaited<ReturnType<typeof gradeReport>> | null = null;
      try {
        const rf = await metaReportFigures(acc.accountId, weekly);
        grade = await gradeReport(rf, body, weekly.accountName);
      } catch (e) {
        console.error(`Report grade skipped for ${acc.accountId}:`, e);
      }

      generated++;
      if (!slackOn) return; // generated but deliberately undelivered; never counted as delivered
      try {
        const { postMessage } = await import("@/lib/integrations/slack");
        const g = grade ? gradeLines(grade) : { header: "⚠️ UNGRADED · ", footer: ["*Norbert:* grading pass failed outright; treat as unreviewed."] };
        const draft = [
          `📘 ${g.header}*Weekly Meta draft: ${weekly.accountName}* (${weekly.period.start} → ${weekly.period.end})`,
          "",
          body,
          "",
          "*Figures*",
          "```",
          figures,
          ...(grade ? ["", grade.figuresBlock] : []),
          "```",
          ...g.footer,
          `Full breakdown tables (placement, demographic, creative crosses): https://app.wmiltd.com/api/bernard/breakdowns/${weekly.accountId}?days=7`,
          `Report workbook (.xlsx, all tabs, this exact week): https://app.wmiltd.com/api/bernard/report/${weekly.accountId}?since=${weekly.period.start}&until=${weekly.period.end}`,
          "_Draft for review, not yet sent to the client._",
        ].join("\n");
        await postMessage(channel!, draft);
        delivered++;
      } catch (e) {
        // A wrong channel id or an uninvited bot must not look like success.
        slackFailed++;
        errors.push(`${acc.name} (slack): ${e instanceof Error ? e.message : String(e)}`);
        console.error(`Meta weekly draft post failed for ${acc.accountId}:`, e);
      }
    } catch (e) {
      failed++;
      errors.push(`${acc.name}: ${e instanceof Error ? e.message : String(e)}`);
      console.error(`Meta weekly report failed for ${acc.accountId}:`, e);
    }
  }

  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, roster.length) }, async () => {
      while (cursor < roster.length) {
        const acc = roster[cursor++];
        await processAccount(acc);
      }
    }),
  );

  return NextResponse.json({
    accounts: roster.length,
    generated,
    delivered,
    skipped,
    failed,
    slackFailed,
    slackConfigured: slackOn,
    ...(slackOn ? {} : { warning: "SLACK_META_REVIEW_CHANNEL is not set on this deployment, so reports were generated and discarded." }),
    ...(errors.length ? { errors: errors.slice(0, 10) } : {}),
  });
}

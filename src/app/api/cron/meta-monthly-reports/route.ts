// Monthly Meta cron (vercel.json, 1st of the month): the monthly leg of the
// client reporting standard (docs/WEEKLY_CLIENT_REPORTING_BRIEF.md, founder go
// 2026-09-05). Same contract as the weekly: verified figures over FOUR
// calendar months, breakdown depth over the report month, an LLM narrative,
// Norbert's grade, and the workbook link. Nothing reaches a client without a
// human passing it on. ?only=<account digits> runs one account.
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { listMetaAdAccounts, metaConfigured } from "@/lib/integrations/meta";
import { getMetaBreakdowns, formatMetaBreakdownsText } from "@/lib/integrations/meta/breakdowns";
import { metaPeriodFigures, monthRanges } from "@/lib/report-figures";
import { gradeReport, gradeLines } from "@/lib/report-grade";
import { fourWindowText, storeLedgerText } from "@/lib/report-engine";
import { stripEmDashes } from "@/lib/integrations/anthropic/narrative";

export const maxDuration = 300;

const CONCURRENCY = 3;

const SYSTEM = `You write the monthly Meta Ads review note for a paid social agency.

Audience: the founder, reviewing before anything reaches a client. He is an expert, so do not explain what CTR means.

Rules, all firm:
- British spelling (optimise, analyse).
- NEVER use an em dash or en dash. Use full stops, commas, colons or parentheses. En dashes only inside numeric ranges.
- Never say "we", "us" or "our". Write impersonally or in the first person singular.
- Anchor every claim to a figure you were given. Invent nothing. If the data does not support a conclusion, say what would be needed to reach one.
- Judge the month against ALL FOUR months given: two windows cannot tell a fall from a return to normal.
- The figures include breakdowns (placement, age and gender, creative, video). Name the specific cell where one genuinely stands out, but NEVER rank creatives or placements on single-digit result counts; report those as observations with the count stated.
- Where a store ledger is present, revenue claims defer to it: platform figures are attribution, the ledger is takings, and POAS only exists where the ledger says it does.
- Four short paragraphs at most: what happened over the month, what changed against the prior months, what it means, what to watch. No headings, no bullet lists, no sign-off.`;

async function narrate(accountName: string, currency: string, figuresText: string): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  try {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1100,
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: `Account: ${accountName}, currency ${currency}.\n\n${figuresText}\n\nWrite the monthly review note.` }],
    });
    const text = msg.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("").trim();
    return text || null;
  } catch (e) {
    console.error(`Meta monthly narrative skipped for ${accountName}:`, e);
    return null;
  }
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!metaConfigured()) return NextResponse.json({ error: "META_ADS_TOKEN not configured" }, { status: 500 });

  const channel = process.env.SLACK_META_REVIEW_CHANNEL;
  const slackOn = !!process.env.SLACK_BOT_TOKEN && !!channel;

  let roster = await listMetaAdAccounts();
  if ("error" in roster) return NextResponse.json({ error: `Could not list ad accounts: ${roster.error}` }, { status: 502 });
  const only = (new URL(request.url).searchParams.get("only") ?? "").replace(/\D/g, "");
  if (only) roster = roster.filter((a) => a.accountId.replace(/\D/g, "") === only);

  const ranges = monthRanges();
  const month = ranges[0];

  let generated = 0, delivered = 0, skipped = 0, failed = 0, slackFailed = 0;
  const errors: string[] = [];

  async function processAccount(acc: { accountId: string; name: string; currency: string }): Promise<void> {
    try {
      const figures = await metaPeriodFigures(acc.accountId, ranges, undefined, acc.currency);
      const cur = figures.windows[0];
      if (!cur || (cur.spend === 0 && (figures.windows[1]?.spend ?? 0) === 0)) { skipped++; return; }

      let breakdownText = "";
      try {
        breakdownText = formatMetaBreakdownsText(await getMetaBreakdowns(acc.accountId, { since: month.start, until: month.end }));
      } catch (e) {
        console.error(`Monthly breakdowns skipped for ${acc.accountId}:`, e);
      }

      const figuresText = [fourWindowText(figures), storeLedgerText(figures), breakdownText].filter(Boolean).join("\n\n");
      const narrative = await narrate(acc.name, figures.currency || acc.currency, figuresText);
      const body = stripEmDashes(narrative ?? figuresText);
      const grade = await gradeReport(figures, body, acc.name).catch(() => null);

      generated++;
      if (!slackOn) return;
      try {
        const { postMessage } = await import("@/lib/integrations/slack");
        const g = grade ? gradeLines(grade) : { header: "⚠️ UNGRADED · ", footer: ["*Norbert:* grading pass failed outright; treat as unreviewed."] };
        const digits = acc.accountId.replace(/\D/g, "");
        const draft = [
          `📙 ${g.header}*Monthly Meta draft: ${acc.name}* (${month.label}, ${month.start} → ${month.end})`,
          "",
          body,
          "",
          "*Figures*",
          "```",
          figuresText,
          ...(grade ? ["", grade.figuresBlock] : []),
          "```",
          ...g.footer,
          `Report workbook (.xlsx, all tabs, ${month.label}): https://app.wmiltd.com/api/bernard/report/${digits}?period=month&until=${month.end}`,
          `Full breakdown tables: https://app.wmiltd.com/api/bernard/breakdowns/${digits}?days=30`,
          "_Monthly draft for review, not yet sent to the client._",
        ].join("\n");
        await postMessage(channel!, draft);
        delivered++;
        // Attach the workbook FILE for people without portal access.
        try {
          const { uploadFile } = await import("@/lib/integrations/slack");
          const { buildMetaReportWorkbook } = await import("@/lib/report-workbook");
          const wbk = await buildMetaReportWorkbook(acc.accountId.replace(/\D/g, ""), ranges, { periodLabel: `Monthly report: ${month.label}`, currencyHint: acc.currency });
          const up = await uploadFile(channel!, `${acc.name.replace(/[^\w &-]/g, "")} - ${month.label}.xlsx`, wbk.buffer, `${acc.name} monthly report workbook`);
          if ("error" in up) console.error(`Workbook attach skipped for ${acc.accountId}: ${up.error}`);
        } catch (e) {
          console.error(`Workbook attach failed for ${acc.accountId}:`, e);
        }
      } catch (e) {
        slackFailed++;
        errors.push(`${acc.name} (slack): ${e instanceof Error ? e.message : String(e)}`);
      }
    } catch (e) {
      failed++;
      errors.push(`${acc.name}: ${e instanceof Error ? e.message : String(e)}`);
      console.error(`Meta monthly report failed for ${acc.accountId}:`, e);
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
    month: month.label, accounts: roster.length, generated, delivered, skipped, failed, slackFailed,
    slackConfigured: slackOn,
    ...(errors.length ? { errors: errors.slice(0, 10) } : {}),
  });
}

// Meta Ads audit (.docx) — Bernard's downloadable deliverable. Reads the
// account live (read-only Graph calls), has Bernard's model write the audit
// narrative from that ground truth, and renders it with the house docx
// helpers (house WMI header/footer, same as the Google Ads audit deliverable).
import Anthropic from "@anthropic-ai/sdk";
import { Document, Packer, Paragraph, Table, TextRun, PageBreak, AlignmentType } from "docx";
import { getMetaAuditData, normalizeActId } from "@/lib/integrations/meta";
import { t, h1, h3, para, bullet, numItem, table, buildAuditDoc, CONTENT_W, NAVY, type CellVal } from "@/lib/audit/docx";

const MODEL = "claude-fable-5";
const FALLBACK_MODEL = "claude-opus-4-8";

const NARRATIVE_SYSTEM = `You are a senior Meta Ads media buyer writing a full account audit for the account owner. You are given the account's real data (read live from the account) as JSON.

RULES:
- Every figure, name, date and percentage must come from the DATA. Never invent, estimate or extrapolate a number. If a section of the data carries an "error" field, say that part could not be read and move on.
- Use the account's own currency for money figures.
- Do not mention APIs, tokens, JSON, tools, or how the data was obtained. This reads as a hands-on account review.
- No em dashes anywhere; use commas, colons or plain hyphens.
- Write in clear professional English, direct and specific, no filler.

OUTPUT: Markdown only, using exactly this structure:
## Executive Summary
(3-5 sentences: state of the account, headline numbers, the core problems)
## Account Snapshot
(a bullet list: account name, status, currency, timezone, lifetime spend, structure counts)
## Performance: Last Period vs Prior
(a markdown table of the key metrics current vs previous with change, then 2-3 sentences of interpretation; call out pacing or delivery anomalies visible in the daily trend)
## Structure and Settings Review
(campaigns/ad sets: objectives, budgets, bid strategies, statuses, learning phase, targeting breadth; what is sound and what is not)
## Tracking and Signals
(pixel presence and last fire, conversion signal quality, anything that undermines optimisation)
## Key Findings
(numbered list, most important first; each finding one bold title sentence then evidence with figures)
## Recommendations
(numbered, prioritised, each actionable and tied to a finding)
## First 30 Days
(a short week-by-week action plan)`;

function inlineRuns(text: string, size = 22): TextRun[] {
  // **bold** only — keep the renderer small and predictable.
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts
    .filter((p) => p.length > 0)
    .map((p, i) => t(p, { size, bold: i % 2 === 1 }));
}

/** Minimal markdown -> docx children using the house look. */
export function markdownToDocx(md: string): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  const lines = md.replace(/\r/g, "").split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) { i++; continue; }

    // Table block
    if (line.startsWith("|")) {
      const block: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) { block.push(lines[i].trim()); i++; }
      const parse = (row: string) => row.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.replace(/\*\*/g, "").trim());
      const header = parse(block[0]);
      const rows = block.slice(block[1]?.match(/^\|[\s:-]+\|/) ? 2 : 1).map(parse);
      const w = Math.floor(CONTENT_W / Math.max(1, header.length));
      const widths = header.map(() => w);
      out.push(table(widths, header, rows as CellVal[][]));
      out.push(para("", { after: 120 }));
      continue;
    }

    if (line.startsWith("### ")) out.push(h3(line.slice(4).replace(/\*\*/g, "")));
    else if (line.startsWith("## ")) out.push(h1(line.slice(3).replace(/\*\*/g, "")));
    else if (line.startsWith("# ")) out.push(h1(line.slice(2).replace(/\*\*/g, "")));
    else if (/^[-*] /.test(line)) out.push(bullet(inlineRuns(line.slice(2))));
    else if (/^\d+[.)] /.test(line)) out.push(numItem(inlineRuns(line.replace(/^\d+[.)] /, ""))));
    else out.push(new Paragraph({ spacing: { after: 140, line: 276 }, children: inlineRuns(line) }));
    i++;
  }
  return out;
}

export interface MetaAuditResult {
  buffer: Buffer;
  accountName: string;
}

export async function generateMetaAudit(accountRef: string, days = 30): Promise<MetaAuditResult> {
  const { digits } = normalizeActId(accountRef);
  const data = await getMetaAuditData(digits, days);
  const accountObj = data.account as Record<string, unknown>;
  if (accountObj.error) {
    throw new Error(`Could not read account ${digits}: ${String(accountObj.error)}`);
  }
  const accountName = typeof accountObj.name === "string" && accountObj.name ? accountObj.name : `Account ${digits}`;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const msg = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 8000,
    output_config: { effort: "medium" },
    betas: ["server-side-fallback-2026-06-01"],
    fallbacks: [{ model: FALLBACK_MODEL }],
    system: NARRATIVE_SYSTEM,
    messages: [{ role: "user", content: `DATA:\n${JSON.stringify(data)}` }],
  });
  if (msg.stop_reason === "refusal") {
    throw new Error("The audit narrative was declined by a safety check — try again.");
  }
  const md = msg.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  if (!md) throw new Error("The audit narrative came back empty — try again.");

  const dateStr = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const title = `Meta Ads Account Audit`;
  const children: (Paragraph | Table)[] = [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 600, after: 80 }, children: [t(title, { size: 40, bold: true, color: NAVY })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [t(accountName, { size: 24, bold: true })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [t(`Ad account ${digits}`, { size: 20, color: "555555" })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [t(`Review window: last ${days} days vs the prior ${days}`, { size: 20, color: "555555" })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 160 }, children: [t(`${dateStr}  |  Private & Confidential`, { size: 18, color: "888888" })] }),
    new Paragraph({ children: [new PageBreak()] }),
    ...markdownToDocx(md),
  ];

  const doc: Document = buildAuditDoc(children, `${accountName} - Meta Ads Audit`);
  const buffer = await Packer.toBuffer(doc);
  return { buffer: Buffer.from(buffer), accountName };
}

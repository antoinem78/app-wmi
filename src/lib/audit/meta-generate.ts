// Meta Ads audit (.docx) — Bernard's downloadable deliverable. Reads the
// account live (read-only Graph calls), has Bernard's model write the audit
// narrative from that ground truth, and renders it with the house docx
// helpers (house WMI header/footer, same as the Google Ads audit deliverable).
import Anthropic from "@anthropic-ai/sdk";
import { Document, Packer, Paragraph, Table, TextRun, PageBreak, AlignmentType } from "docx";
import { getMetaAuditData, normalizeActId } from "@/lib/integrations/meta";
import { getDeepAuditData, isErr } from "@/lib/integrations/meta/audit-deep";
import { detectFindings, detectStrengths, totalAtStake, type Finding } from "@/lib/audit/meta-findings";
import { t, h1, h3, para, bullet, numItem, table, buildAuditDoc, CONTENT_W, NAVY, type CellVal } from "@/lib/audit/docx";

const MODEL = "claude-fable-5";
const FALLBACK_MODEL = "claude-opus-4-8";

// The findings are computed in code before the model is called (see
// meta-findings.ts). The model's job is to write them up, in order, without
// discovering anything of its own. That is the whole difference between this
// and a generic "here is some JSON, find the problems" audit.
const NARRATIVE_SYSTEM = `You are a senior Meta Ads media buyer writing a full account audit for the account owner, in the owner's own voice as the person who did the work.

You are given three things: the account's headline numbers, a list of VERIFIED FINDINGS already established from the account's data, and a list of things checked and found sound.

HARD RULES:
- The VERIFIED FINDINGS are the audit. Write every one of them up, in the order given. Do not add findings of your own, do not merge them, do not drop any.
- Never state a number that is not in the material you were given. Do not estimate, extrapolate, round differently, or infer a figure. If you want to say something you cannot source, leave it out.
- Never claim something is missing or absent unless a finding says so explicitly. A section that could not be read is not evidence of absence.
- Do not mention APIs, tokens, JSON, tools, agents, or how the data was obtained. This reads as a hands-on account review.
- No em dashes anywhere. Use commas, colons, full stops or plain hyphens.
- First person singular where you refer to yourself: I, me, my. Never "we", "us" or "our".
- Direct and specific. No filler, no throat-clearing, no "in today's competitive landscape".

STRUCTURE (markdown only, exactly these headings):
## Executive Summary
(4-6 sentences: the state of the account, the headline numbers, and the two or three things costing the most. Name the money at stake if it is given.)
## Account Snapshot
(bullet list: name, currency, lifetime spend, structure counts, review window)
## Performance
(a markdown table of the headline metrics, then 3-4 sentences of interpretation including the trend across months if given)
## What Is Already Right
(bullet list from the "checked and sound" material. This section matters: an audit that only lists faults is not a review, it is a pitch.)
## Findings
(one ### sub-heading per verified finding, in the order given, using the finding's title. Under each: the headline sentence, then the evidence as a bullet list, then a short paragraph on why it matters commercially. Use the finding's own figures verbatim.)
## Recommendations
(numbered, prioritised, one per finding, each tied to its finding by name and each stating what changes and what it is expected to do)
## The First 30 Days
(week by week, sequenced so that each step depends on the one before it. Say plainly which step unlocks the others.)
## What I Need From You
(short bullet list: access, assets or decisions required, only where a finding implies one)`;

function findingsBrief(findings: Finding[], currency: string): string {
  return findings.map((f, i) => [
    `FINDING ${i + 1} [${f.severity}] ${f.title}`,
    `  headline: ${f.headline}`,
    ...f.evidence.map((e) => `  evidence: ${e}`),
    f.moneyAtStake ? `  money at stake: ${Math.round(f.moneyAtStake).toLocaleString("en-GB")} ${currency} per 30 days` : "  money at stake: not directly quantifiable",
    `  recommendation: ${f.recommendation}`,
  ].join("\n")).join("\n\n");
}

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
  const tData = Date.now();
  // The shallow read carries the settings picture, the deep read carries the
  // breakdowns and library the detectors need. The deep read is allowed to
  // fail without taking the audit down with it.
  const [data, deep] = await Promise.all([
    getMetaAuditData(digits, days),
    getDeepAuditData(digits, days).catch((e: unknown) => {
      console.error(`[meta-audit] ${digits} deep read failed:`, e);
      return null;
    }),
  ]);
  console.log(`[meta-audit] ${digits} days=${days} data assembly ${Date.now() - tData}ms`);
  const accountObj = data.account as Record<string, unknown>;
  if (accountObj.error) {
    throw new Error(`Could not read account ${digits}: ${String(accountObj.error)}`);
  }
  const accountName = typeof accountObj.name === "string" && accountObj.name ? accountObj.name : `Account ${digits}`;

  const findings = deep ? detectFindings(deep) : [];
  const strengths = deep ? detectStrengths(deep) : [];
  const atStake = totalAtStake(findings);
  console.log(`[meta-audit] ${digits} findings=${findings.length} (${findings.map((f) => f.id).join(",")}) atStake=${Math.round(atStake)}`);

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  // Streamed so long generations can't trip response timeouts; generous
  // max_tokens because Fable 5's (always-on) thinking spends from the same
  // budget as the visible text.
  const tNarrative = Date.now();
  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: 16000,
    output_config: { effort: "medium" },
    betas: ["server-side-fallback-2026-06-01"],
    fallbacks: [{ model: FALLBACK_MODEL }],
    system: NARRATIVE_SYSTEM,
    messages: [{
      role: "user", content: [
        findings.length
          ? `VERIFIED FINDINGS (${findings.length}). These are established from the account's data. Write up every one, in this order.\n\n${findingsBrief(findings, deep?.currency ?? "")}`
          : "VERIFIED FINDINGS: none cleared the detection thresholds. Say so plainly in the Findings section rather than inventing problems, and keep the audit to the performance read.",
        atStake > 0
          ? `\nTOTAL MEASURED WASTE: roughly ${Math.round(atStake).toLocaleString("en-GB")} ${deep?.currency ?? ""} per 30 days across the findings that could be priced. You may quote this figure.`
          : "",
        strengths.length ? `\nCHECKED AND SOUND (use for the "What Is Already Right" section):\n${strengths.map((s) => `- ${s}`).join("\n")}` : "",
        `\nACCOUNT DATA (for the snapshot and performance sections only, do not mine it for new findings):\n${JSON.stringify(data)}`,
        deep && !isErr(deep.monthly) && deep.monthly.length
          ? `\nMONTHLY TREND:\n${deep.monthly.map((m) => `${m.month}: spend ${Math.round(m.spend)}, purchases ${m.purchases}, revenue ${Math.round(m.revenue)}, ROAS ${m.roas.toFixed(2)}, link CTR ${m.linkCtr.toFixed(2)}%`).join("\n")}`
          : "",
      ].filter(Boolean).join("\n"),
    }],
  });
  const msg = await stream.finalMessage();
  console.log(
    `[meta-audit] ${digits} days=${days} narrative ${Date.now() - tNarrative}ms stop=${msg.stop_reason} out=${msg.usage.output_tokens}`,
  );
  if (msg.stop_reason === "refusal") {
    throw new Error("The audit narrative was declined by a safety check — try again.");
  }
  const md = msg.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  if (!md) throw new Error(`The audit narrative came back empty (stop_reason: ${msg.stop_reason}) — try again.`);

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

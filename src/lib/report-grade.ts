// Norbert's report sign-off (build-order step 5): the model half, over the
// deterministic half in report-engine.ts. The code recomputes every figure;
// Norbert judges whether the PROSE claims anything the figures do not support,
// and names the most important thing the report fails to say. No draft reaches
// the founder's review channel without a grade attached, and any failed
// derivation check makes the verdict HOLD in code before Norbert even speaks.
//
// Same reviewer independence as everywhere else: a different model family from
// the agents whose reports he grades, metered under his own name.
import Anthropic from "@anthropic-ai/sdk";
import { logAgentUsage } from "@/lib/agent-usage";
import { checkReport, fourWindowText, storeLedgerText, renderIssues, type ReportFigures, type CheckIssue } from "@/lib/report-engine";

const MODEL = "claude-fable-5";
const AGENT = "norbert";

export interface ReportGrade {
  verdict: "SHIP" | "HOLD" | "UNGRADED";
  issues: CheckIssue[];
  /** Norbert's answer on the prose: SUPPORTED, or what is unsupported. */
  q1: string | null;
  /** The most important thing the report fails to say. */
  q2: string | null;
  figuresBlock: string; // four-window table + check results, for the draft
}

const SYSTEM = [
  "You are Norbert, the supervisor grading a weekly ads report draft before the founder reviews it. The figures were read from the platform and every derived number was recomputed in code; the check results are given. Your job is the PROSE.",
  "Answer two questions, separately and plainly. Plain text, no em dashes.",
  "Q1: Does the narrative claim anything the figures do not support? Judge trends against all four windows (two windows cannot tell a fall from a return to normal), watch for results attributed to causes the figures cannot show, and watch for a custom or ambiguous conversion being talked about as if it were a hard business result. If everything is supported, answer exactly SUPPORTED. Otherwise list each unsupported claim in one sentence each.",
  "Q2: What is the most important thing this report fails to say? One or two sentences, specific to these figures.",
  'Respond as JSON only: {"q1": "SUPPORTED" | "<unsupported claims>", "q2": "..."}',
].join("\n");

export async function gradeReport(
  figures: ReportFigures,
  narrative: string,
  accountLabel: string,
): Promise<ReportGrade> {
  const issues = checkReport(figures);
  const figuresBlock = `${fourWindowText(figures)}\n\n${storeLedgerText(figures)}\n\n${renderIssues(issues)}`;
  const hasFail = issues.some((i) => i.severity === "fail");

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { verdict: hasFail ? "HOLD" : "UNGRADED", issues, q1: null, q2: null, figuresBlock };
  }
  try {
    const client = new Anthropic({ apiKey });
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 1200,
      system: SYSTEM,
      messages: [{
        role: "user",
        content: JSON.stringify({
          account: accountLabel,
          platform: figures.platform,
          windows: figures.windows,
          stated_derived_figures: figures.claims,
          event_sources: figures.eventSources ?? null,
          store_ledger: figures.storeLedger ?? null,
          derivation_check_results: issues,
          narrative,
        }),
      }],
    });
    const u = resp.usage;
    void logAgentUsage(AGENT, `report:${figures.platform}:${accountLabel}`, null, {
      model: resp.model || MODEL, turns: 1,
      tokensInUncached: u?.input_tokens ?? 0,
      tokensCacheWrite: (u as { cache_creation_input_tokens?: number })?.cache_creation_input_tokens ?? 0,
      tokensCacheRead: (u as { cache_read_input_tokens?: number })?.cache_read_input_tokens ?? 0,
      tokensOut: u?.output_tokens ?? 0,
    });
    const text = resp.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    const parsed = start >= 0 && end > start ? (JSON.parse(text.slice(start, end + 1)) as { q1?: unknown; q2?: unknown }) : {};
    const q1 = typeof parsed.q1 === "string" && parsed.q1.trim() ? parsed.q1.trim() : null;
    const q2 = typeof parsed.q2 === "string" && parsed.q2.trim() ? parsed.q2.trim() : null;
    const supported = q1 !== null && /^supported\b/i.test(q1);
    return {
      verdict: hasFail || (q1 !== null && !supported) ? "HOLD" : q1 === null ? "UNGRADED" : "SHIP",
      issues, q1, q2, figuresBlock,
    };
  } catch (e) {
    console.error("Report grade failed:", e);
    return { verdict: hasFail ? "HOLD" : "UNGRADED", issues, q1: null, q2: null, figuresBlock };
  }
}

/** The grade as Slack lines for the draft header and footer. */
export function gradeLines(g: ReportGrade): { header: string; footer: string[] } {
  const header = g.verdict === "SHIP" ? "" : g.verdict === "HOLD" ? "⛔ NOT CLIENT-READY (Norbert holds this draft) · " : "⚠️ UNGRADED · ";
  const footer = [
    `*Norbert:* ${g.verdict}${g.q1 ? ` · ${g.q1}` : g.verdict === "UNGRADED" ? " · grading pass unavailable; checks above still ran in code" : ""}`,
    ...(g.q2 ? [`*Not said:* ${g.q2}`] : []),
  ];
  return { header, footer };
}

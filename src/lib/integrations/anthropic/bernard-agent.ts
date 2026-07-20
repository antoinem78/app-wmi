// Bernard chat agent — the Meta Lab supervisor's conversational surface.
// Founder-ruled runtime: highest Anthropic model (Claude Fable 5) at medium
// effort. Thinking is always on for Fable 5 (no `thinking` param), and a
// server-side fallback to Opus 4.8 covers the rare classifier refusal so the
// founder never gets a dead reply.
//
// Bernard's portal tools are exactly his governed n8n endpoints (src/lib/
// bernard.ts): read the lab status, decide a proposed fix, stand a client
// down. Meta reads and executor dispatches run in the substrate, not here.
import Anthropic from "@anthropic-ai/sdk";
import { getBernardStatus, decideFix, standDown } from "@/lib/bernard";
import type { AgentEvent, ChatMessage } from "@/lib/integrations/anthropic/agent";

const MODEL = "claude-fable-5";
const FALLBACK_MODEL = "claude-opus-4-8";

const TOOLS: Anthropic.Beta.BetaToolUnion[] = [
  {
    name: "get_status",
    description:
      "Bernard's live lab snapshot from the substrate: lab clients (armed/disabled/stand-down, doctrine version, skill install state, monitors, ad accounts), fixes awaiting founder approval, recent activity trail, and remaining executor credits. Call this before answering any question about the current state of the lab.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "decide_fix",
    description:
      "Record the founder's decision on a fix Bernard proposed (approve = the whitelisted Meta write executes and is verified; reject = it is discarded). ONLY call this when the founder has explicitly and unambiguously approved or rejected a SPECIFIC pending fix in this conversation — never infer a decision, never batch. Confirm which fix they mean against get_status first if there is any doubt.",
    input_schema: {
      type: "object",
      properties: {
        task_id: { type: "string", description: "The pending fix's task_id from get_status" },
        decision: { type: "string", enum: ["approve", "reject"] },
      },
      required: ["task_id", "decision"],
    },
  },
  {
    name: "stand_down",
    description:
      "Halt ALL executor work for one lab client (dispatch disabled, monitors muted) until the founder re-arms it. Emergency brake. ONLY call this when the founder explicitly orders a stand-down for a named client — never infer it.",
    input_schema: {
      type: "object",
      properties: {
        client_slug: { type: "string", description: "The client's slug from get_status" },
        reason: { type: "string", description: "Why, in the founder's words" },
      },
      required: ["client_slug", "reason"],
    },
  },
];

const SYSTEM = `You are Bernard, the Rexos Meta Ads supervisor. You govern the Meta Lab: you audit ad accounts against ground truth, dispatch and verify the executor (Manus) under a version-pinned doctrine, and propose fixes that only execute after the founder approves them. You never activate anything on Meta and you never mutate an account outside the founder-gated fix path.

You are talking to the founder inside the Rexos portal.

WHAT YOU CAN DO HERE:
- get_status gives you the live lab snapshot (clients, pending fixes, activity, executor credits). Fetch it rather than guessing; never invent a figure, task id, client or timestamp.
- decide_fix records the founder's approve/reject on a specific pending fix. The founder's word in this chat IS the approval gate — so only call it on an explicit, unambiguous instruction naming (or clearly identifying) one fix. If they say "approve it" and more than one fix is pending, ask which.
- stand_down is the emergency brake for one client. Explicit orders only. Confirm you understood ("Standing down <client> — all executor work halts") after doing it, not before.

WHAT RUNS ELSEWHERE (be straight about it):
- Deep Meta reads, audits, executor dispatches and report verification run in the substrate on their own workflows (daily monitor at 09:00, dispatch gates, webhook verification). From this chat you can read their outcomes in the activity trail but not trigger them yet. If the founder asks for a new audit or dispatch, say it isn't wired into chat yet and that the monitor/dispatch path in the substrate handles it.

HOW YOU SPEAK:
- A calm, senior supervisor reporting to the principal: lead with the state or the answer, then the evidence. Be concise and concrete.
- Don't narrate tool use; call the tool, then answer.
- Never claim an action succeeded unless the tool result says so. If an endpoint errors, report the failure plainly.`;

type BetaBlock = Anthropic.Beta.BetaContentBlock;

// If a server-side fallback fired mid-turn, thinking/tool_use blocks BEFORE the
// last fallback boundary must not be echoed back (API rule); everything at or
// after it echoes normally. No fallback block → pass content through untouched.
function sanitizeForEcho(content: BetaBlock[]): BetaBlock[] {
  const lastFallback = content.map((b) => b.type).lastIndexOf("fallback");
  if (lastFallback < 0) return content;
  return content.filter(
    (b, i) =>
      i >= lastFallback ||
      (b.type !== "thinking" && b.type !== "redacted_thinking" && b.type !== "tool_use"),
  );
}

function statusLabel(name: string): string {
  switch (name) {
    case "get_status": return "Reading the lab…";
    case "decide_fix": return "Recording your decision…";
    case "stand_down": return "Standing the client down…";
    default: return "Working…";
  }
}

async function runTool(
  name: string,
  input: Record<string, unknown>,
  actor: string,
): Promise<unknown> {
  switch (name) {
    case "get_status":
      return getBernardStatus();
    case "decide_fix": {
      const taskId = String(input.task_id ?? "");
      const decision = String(input.decision ?? "");
      if (!taskId || (decision !== "approve" && decision !== "reject"))
        return { error: "decide_fix needs a task_id and decision of approve|reject." };
      return decideFix(taskId, decision, actor);
    }
    case "stand_down": {
      const slug = String(input.client_slug ?? "");
      if (!slug) return { error: "stand_down needs a client_slug." };
      return standDown(slug, String(input.reason ?? "founder order via Bernard chat"), actor);
    }
    default:
      return { error: `Unknown tool ${name}` };
  }
}

// Streaming Bernard chat. Same NDJSON event contract as the Rexos agent so the
// UI plumbing is shared: status while tools run, delta for answer text, reset
// to drop tool-turn preamble, then done (or error).
export async function runBernardChatStream(
  history: ChatMessage[],
  actor: string,
  emit: (ev: AgentEvent) => void,
): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    emit({ type: "delta", text: "Bernard isn't configured (no ANTHROPIC_API_KEY)." });
    emit({ type: "done" });
    return;
  }
  const client = new Anthropic({ apiKey });
  const messages: Anthropic.Beta.BetaMessageParam[] = history.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  try {
    for (let i = 0; i < 8; i++) {
      const stream = client.beta.messages.stream({
        model: MODEL,
        max_tokens: 4000,
        output_config: { effort: "medium" },
        betas: ["server-side-fallback-2026-06-01"],
        fallbacks: [{ model: FALLBACK_MODEL }],
        system: SYSTEM,
        tools: TOOLS,
        messages,
      });
      stream.on("text", (t) => emit({ type: "delta", text: t }));
      const final = await stream.finalMessage();

      if (final.stop_reason === "refusal") {
        emit({ type: "reset" });
        emit({
          type: "delta",
          text: "I can't answer that one — the request was declined by a safety check. Rephrase it and I'll try again.",
        });
        emit({ type: "done" });
        return;
      }

      const toolUses = final.content.filter(
        (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use",
      );
      if (final.stop_reason !== "tool_use" || toolUses.length === 0) {
        emit({ type: "done" });
        return;
      }

      messages.push({ role: "assistant", content: sanitizeForEcho(final.content) });
      emit({ type: "reset" }); // drop any preamble streamed during the tool turn
      const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
      for (const tu of toolUses) {
        emit({ type: "status", text: statusLabel(tu.name) });
        let out: unknown;
        try {
          out = await runTool(tu.name, (tu.input ?? {}) as Record<string, unknown>, actor);
        } catch (e) {
          out = { error: e instanceof Error ? e.message : String(e) };
        }
        results.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(out).slice(0, 80000) });
      }
      messages.push({ role: "user", content: results });
    }
    emit({ type: "delta", text: "\n\n(Stopped after several steps — ask me one thing at a time.)" });
    emit({ type: "done" });
  } catch (e) {
    emit({ type: "error", text: e instanceof Error ? e.message : String(e) });
  }
}

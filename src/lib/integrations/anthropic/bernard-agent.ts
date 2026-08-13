// Bernard chat agent — the Meta Lab supervisor's conversational surface.
// Founder-ruled runtime (2026-08-13): Claude Sonnet 5 at medium effort, for
// cost. Adaptive thinking is the model's default (no `thinking` param).
//
// Bernard's portal tools are exactly his governed n8n endpoints (src/lib/
// bernard.ts): read the lab status, decide a proposed fix, stand a client
// down. Meta reads and executor dispatches run in the substrate, not here.
import Anthropic from "@anthropic-ai/sdk";
import { getBernardStatus, decideFix, standDown, dispatchBuild, type BuildDispatch } from "@/lib/bernard";
import {
  listMetaAdAccounts,
  getMetaAuditData,
  metaConfigured,
  normalizeActId,
  readAdCopy,
  buildCopyFixSpec,
  listCustomAudiences,
  getAdSetDetail,
  getCreativePerformance,
  getPixelStats,
} from "@/lib/integrations/meta";
import type { AgentEvent, ChatMessage } from "@/lib/integrations/anthropic/agent";
import type { Attachment } from "@/lib/attachments";
import { makeEmDashScrubber } from "@/lib/emdash";
import {
  loadMemories,
  renderMemories,
  remember,
  reviseMemory,
  forgetMemory,
  MEMORY_KINDS,
  type MemoryKind,
} from "@/lib/agent-memory";

const AGENT = "bernard";
const MODEL = "claude-sonnet-5";

const TOOLS: Anthropic.Beta.BetaToolUnion[] = [
  {
    // Tools sit ahead of the system prompt in the cacheable prefix, so the
    // breakpoint on SYSTEM_BASE covers this whole block too.
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
  {
    name: "list_meta_accounts",
    description:
      "Every Meta ad account the system user can currently see, live from the token — the moment the founder assigns an account in Business Manager it appears here and is auditable. Returns name, account id, status, currency, business owner, lifetime spend. Use to resolve an account the founder names.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "run_audit",
    description:
      "Full READ-ONLY audit read of one Meta ad account, live from the account: account state, current-vs-prior period performance, daily spend/conversion trend, campaigns with budgets and objectives, ad sets with bid strategy/targeting/learning phase, ad counts, pixel presence and last fire. Nothing is modified. Use whenever the founder asks for an audit, a performance review, or 'what's wrong with X'. The result includes download_path — a link to the same audit as a formatted Word document.",
    input_schema: {
      type: "object",
      properties: {
        account_id: { type: "string", description: "The ad account id (digits, or act_ prefixed) — resolve via list_meta_accounts if the founder gave a name" },
        days: { type: "number", description: "Review window in days (default 30, 7-90); compared against the prior window of the same length" },
      },
      required: ["account_id"],
    },
  },
  {
    name: "read_ad_copy",
    description:
      "READ the actual words in an account's ads: every headline, primary text and description variant, plus each creative's Instagram identity. Also returns deterministic flags for em dashes and discount/savings claims. Call this BEFORE recommending, reusing or duplicating ANY creative: performance figures do not show you what an ad says, and a creative that looks like a winner can carry a claim the client has retired. Defaults to serving and in-review ads; pass status 'all' to sweep the paused pool before duplicating out of it.",
    input_schema: {
      type: "object",
      properties: {
        account_id: { type: "string", description: "Ad account id (digits or act_ prefixed)" },
        status: { type: "string", enum: ["active", "all"], description: "Default 'active' (serving + in review). 'all' includes paused and archived." },
        limit: { type: "number", description: "Max ads to scan, 1-200, default 50" },
      },
      required: ["account_id"],
    },
  },
  {
    name: "list_audiences",
    description:
      "READ an account's custom audiences: name, id, subtype, retention, the event sources and events behind each rule, whether exclusions exist, and crucially whether Meta says the audience can actually serve. Use before building any retargeting layer, and to check whether an audience you are about to ask for already exists. Audience SIZE is deliberately not returned: Meta suppresses it on advanced-matching website audiences and the API's count fields are placeholders that must never be quoted as counts.",
    input_schema: {
      type: "object",
      properties: { account_id: { type: "string", description: "Ad account id (digits or act_ prefixed)" } },
      required: ["account_id"],
    },
  },
  {
    name: "get_adset_detail",
    description:
      "READ one ad set's full live configuration: budget, optimisation goal and conversion event, pixel, bid strategy, geo, age, gender, included and excluded audiences, placements and devices. Use to verify a single change by read-back rather than trusting a report, and to confirm what an ad set actually targets before dispatching into it.",
    input_schema: {
      type: "object",
      properties: { adset_id: { type: "string", description: "The ad set id" } },
      required: ["adset_id"],
    },
  },
  {
    name: "get_creative_performance",
    description:
      "READ ad-level performance ranked by spend: spend, impressions, CTR, add to carts, purchases, revenue and ROAS per ad. Use to decide which creative is actually earning rather than which is assumed to. Pair it with read_ad_copy before any creative recommendation: this tool tells you what performs, that one tells you what it says.",
    input_schema: {
      type: "object",
      properties: {
        account_id: { type: "string", description: "Ad account id (digits or act_ prefixed)" },
        days: { type: "number", description: "Window in days. Omit for lifetime." },
      },
      required: ["account_id"],
    },
  },
  {
    name: "get_pixel_stats",
    description:
      "READ a pixel's event volume by event type over a window (PageView, ViewContent, AddToCart, Purchase and so on). Use to establish whether an audience pool can exist before blaming audience size, and to size an event window honestly (a 30-day AddToCart audience on 40 events a month is not an audience).",
    input_schema: {
      type: "object",
      properties: {
        pixel_id: { type: "string", description: "The pixel/dataset id" },
        days: { type: "number", description: "Window in days, 1-90, default 30" },
      },
      required: ["pixel_id"],
    },
  },
  {
    name: "dispatch_copy_fix",
    description:
      "Rebuild ONE ad from an existing creative with corrected words, and dispatch it PAUSED. Use this for every copy fix: it reads the base creative itself and rewrites only the text you name, so the image hashes, crops, placement customisation rules, link, CTA, UTM tags and Instagram identity all carry over untouched. Send ONLY the changed text, never the whole spec: hand-carrying a creative spec through a tool call truncates and mis-transcribes, which is why this tool exists. Overrides are keyed by zero-based index into the existing variants, so read_ad_copy first to get the indexes right (its title[1] is index 0). ALWAYS re-read with read_ad_copy before a second fix on a rebuilt creative: Meta does not preserve variant order on create, so the indexes shift and yesterday's numbering will silently overwrite the wrong variant. The new ad is created PAUSED like everything else; the founder activates.",
    input_schema: {
      type: "object",
      properties: {
        client_slug: { type: "string", description: "Lab client slug from get_status" },
        account_id: { type: "string", description: "act_-prefixed ad account id" },
        adset_id: { type: "string", description: "Ad set the new ad goes into" },
        base_creative_id: { type: "string", description: "Creative to copy structure and unchanged text from" },
        ad_name: { type: "string", description: "Name for the new ad" },
        build_ref: { type: "string", description: "Unique idempotency ref for this dispatch" },
        title_overrides: {
          type: "object",
          description: 'Zero-based index to replacement text, e.g. {"0": "Made in Italy. $250."}. Omit to change no titles.',
        },
        body_overrides: {
          type: "object",
          description: 'Zero-based index to replacement text. Omit to change no bodies.',
        },
      },
      required: ["client_slug", "account_id", "adset_id", "base_creative_id", "ad_name", "build_ref"],
    },
  },
  {
    name: "dispatch_build",
    description:
      "Dispatch a campaign build to the substrate executor (BERNARD_build). The executor enforces every safety property in code before and after the write: every entity is created PAUSED, unmet gate_conditions return GATE_BLOCKED before any Meta call, the write budget caps the operation count, the account must be in the client's allow-list, and build_ref makes the dispatch idempotent. The response is the builder's own verified report: it re-reads every entity it claims to have created. ONLY call this when the founder has explicitly told you to build a SPECIFIC spec that has been laid out in this conversation. Never dispatch a spec the founder has not seen, never infer the instruction, and never re-dispatch on failure without telling the founder what failed first. After a build, report the verdict, the created entities and any problems verbatim, and remind him everything sits PAUSED for his activation.",
    input_schema: {
      type: "object",
      properties: {
        client_slug: { type: "string", description: "The lab client slug from get_status (e.g. dental-mastery)" },
        account_id: { type: "string", description: "act_-prefixed ad account id; must be in the client's allow-list" },
        build_ref: { type: "string", description: "Unique idempotency reference for this build, e.g. dm-expansion-2026-08-01. Re-dispatching the same ref is a no-op by design." },
        gate_conditions: {
          type: "array",
          description: "Optional pre-flight gates. Any entry not explicitly met blocks the build before Meta is touched.",
          items: { type: "object", properties: {
            id: { type: "string" }, check: { type: "string" },
            state: { type: "string", enum: ["met", "unmet"] } }, required: ["id", "check", "state"] },
        },
        campaigns: {
          type: "array",
          description: "The build spec: campaigns with nested adsets and ads, exactly as agreed with the founder in chat. An existing campaign can be referenced by id instead of created. Budgets are in account-currency minor units and are capped by the client's write budget regardless of what is asked.",
          items: { type: "object" },
        },
      },
      required: ["client_slug", "account_id", "build_ref", "campaigns"],
    },
  },
  {
    name: "remember",
    description:
      "Write something to your permanent memory. Your memory survives the founder clearing the chat and every future session, so use it for anything you would be embarrassed to have forgotten next week: how a client operates, an account's baselines and quirks, a ruling the founder made and why, a standing preference about how he wants you to work, a strategic position you have taken. Do NOT store things you can look up live (current spend, today's status, pending fixes) — store the judgement, not the reading. Check your existing memory first: if a memory is merely out of date, use revise_memory instead of adding a second version.",
    input_schema: {
      type: "object",
      properties: {
        kind: {
          type: "string",
          enum: ["client", "account", "decision", "preference", "strategy", "fact"],
          description: "client = how they operate; account = an ad account's quirks/baselines; decision = a founder ruling and its reason; preference = how the founder wants you to work; strategy = a standing position or plan; fact = anything else durable",
        },
        subject: {
          type: "string",
          description: "What it is about: a client slug, an act_ id, or 'global' for things not tied to one entity",
        },
        content: {
          type: "string",
          description: "The memory itself, written so it makes sense to you cold in six months. Include the why, not just the what. State dates absolutely, never 'last week'.",
        },
        shared: {
          type: "boolean",
          description: "Set true to make this memory visible to every agent, not just you. Share client-level facts (business model, offer, fee model, CRM and tracking state), founder rulings, and cross-channel strategy. Keep platform-specific tactics private: your channel's mechanics rarely transfer. You stay the owner either way; other agents can read a shared memory but never edit it.",
        },
      },
      required: ["kind", "subject", "content"],
    },
  },
  {
    name: "revise_memory",
    description:
      "Correct or update an existing memory in place, using the id shown beside it in your memory block. Use this when a fact has CHANGED. If a memory turns out to have been wrong all along, use forget with the reason instead, so the record shows you were corrected.",
    input_schema: {
      type: "object",
      properties: {
        memory_id: { type: "string", description: "The id from your memory block" },
        content: { type: "string", description: "The replacement content, complete rather than a diff" },
      },
      required: ["memory_id", "content"],
    },
  },
  {
    name: "forget",
    description:
      "Retire a memory. Use it when the founder tells you to forget something, or when you discover a memory was wrong. The memory stops appearing but is retained in the audit trail rather than destroyed, so state the reason honestly.",
    input_schema: {
      type: "object",
      properties: {
        memory_id: { type: "string", description: "The id from your memory block" },
        reason: { type: "string", description: "Why it is being retired" },
      },
      required: ["memory_id", "reason"],
    },
  },
];

const SYSTEM_BASE = `You are Bernard, the senior paid social strategist and media buyer for Rexos. Auditing accounts and building campaigns are things you do, not what you are: you own Meta strategy across every client, you carry the thread from one week to the next, and you are expected to have an opinion and defend it. You also govern the Meta Lab — dispatching and verifying the executor (Manus) under a version-pinned doctrine, and proposing fixes that only execute once the founder approves them. You never activate anything on Meta and you never mutate an account outside the founder-gated fix path.

You are talking to the founder inside the Rexos portal.

YOUR MEMORY IS PERMANENT. Everything in the MEMORY block below is yours, written by you in earlier sessions, and it persists across sessions indefinitely. It survives the founder clearing the chat: clearing wipes the visible transcript only. So never say you have no memory across sessions, never say "as a new session I don't have context", and never ask the founder to re-explain something that is in your memory. If a session feels contextless, that means you did not write things down, which is a failure to fix by using the remember tool more, not something to apologise about mid-conversation.

Use it like a strategist keeping a running file on every account:
- When you learn something durable — how a client operates, an account's baselines, a ruling the founder made and why, a preference about how he wants you to work, a strategic position — call remember. Do it as it happens, not at the end.
- Store judgement, not readings. Current spend, today's status and pending fixes are live lookups; the conclusion you drew from them is memory.
- Memories can be SHARED across agents. Anything marked "SHARED by <agent>" in your memory block was written by a colleague: treat it as their testimony about their channel, trust it for client-level facts, and do not repeat their platform tactics on yours without thinking. Share your own client-level learnings back (the shared flag on remember); a multi-channel client should never depend on the founder ferrying facts between you.
- When a fact changes, revise_memory rather than adding a second version. You cannot edit a colleague's shared memory: write your own shared correction and say so. Duplicated, contradictory memories are worse than none.
- When the founder says to forget something, or you find a memory was wrong, call forget and say so plainly.
- Anything the founder rules on is worth remembering. If he corrects you, that correction is a memory.

WHAT YOU CAN DO HERE:
- get_status gives you the live lab snapshot (clients, pending fixes, activity, executor credits). Fetch it rather than guessing; never invent a figure, task id, client or timestamp.
- list_meta_accounts shows every ad account the system user can see, live. Any account there is yours to read and audit immediately — assignment in Business Manager is the onboarding for reads. (Executor dispatch for a client still requires lab registration in the substrate.)
- run_audit reads one account's full ground truth (read-only) so you can audit it right here in chat. Lead with the verdict and the strongest evidence; keep the chat version tight. The tool result carries download_path — ALWAYS give the founder that link at the end of an audit, on its own line, e.g. "Word document: /api/bernard/audit/123456?days=30". The document is generated fresh from the same live data when they click it.
- dispatch_build sends an agreed spec to the substrate executor, which creates everything PAUSED behind machine-enforced gates and reads back what it made. You CAN build from this chat: lay the spec out, get the founder's explicit go, dispatch, then report the verified result. The founder activates; you never do.
- decide_fix records the founder's approve/reject on a specific pending fix. The founder's word in this chat IS the approval gate — so only call it on an explicit, unambiguous instruction naming (or clearly identifying) one fix. If they say "approve it" and more than one fix is pending, ask which.
- stand_down is the emergency brake for one client. Explicit orders only. Confirm you understood ("Standing down <client> — all executor work halts") after doing it, not before.

WHAT RUNS ELSEWHERE (be straight about it):
- Executor dispatches (Manus work), report verification and the daily monitor run in the substrate on their own workflows. You can read their outcomes in the activity trail but not trigger a dispatch from chat. If the founder asks to dispatch the executor, say that path stays in the substrate behind its gates.

AUDIT CRAFT:
- Anchor every number to the data you fetched; if a section came back with an error, say so instead of working around it silently.
- NEVER recommend, reuse or dispatch a creative whose words you have not read. Call read_ad_copy first, every time. Performance figures do not show you what an ad says: on 2026-08-06 a creative was recommended on its ROAS and carried a "Save up to 72%" headline that an audit had already pledged to retire. read_ad_copy also flags em dashes (a standing founder ruling) and tells you whether an Instagram identity is attached at all.
- Before proposing an audience, call list_audiences: the one you are about to ask for may already exist. Audience size is NOT available and no tool will give it to you. Meta suppresses it on advanced-matching website audiences, and the API's count fields are placeholders. Use canServe for usability, get_pixel_stats to judge whether a pool can exist, and the publish-time estimate for size. Never set a go/no-go threshold on a number you cannot obtain.
- Verify changes by read-back with get_adset_detail rather than trusting a report, yours or anyone's.
- On a "performance dropped" complaint, check in order: spend pacing and delivery gaps in the daily trend, learning-phase state and recent ad set churn (updated timestamps), budget or bid strategy changes, frequency/fatigue, and pixel health (last fire). Attribute the drop to what the data shows, not to a template.

HOW YOU SPEAK:
- A calm, senior supervisor reporting to the principal: lead with the state or the answer, then the evidence. Be concise and concrete.
- Never use an em dash, in anything you write: chat, drafts, documents, headings. Use a full stop, comma, colon or parentheses instead (en dashes only inside numeric ranges, like 45-54). The founder has ruled on this; anything you hand him must already comply.
- Anything drafted in the founder's voice (client messages, freelancer instructions) is first person SINGULAR: I, me, my. Never the agency "we/us/our", even where it feels natural ("we cut the videos"). Ruled 2026-08-03. Sweep the draft for "we" before handing it over.
- Don't narrate tool use; call the tool, then answer.
- Never claim an action succeeded unless the tool result says so. If an endpoint errors, report the failure plainly.`;

/**
 * The system prompt for one turn, as two cache-separated blocks.
 *
 * Split deliberately. The brief never changes, so it caches forever alongside
 * the tool definitions ahead of it in the prefix. The memory block changes the
 * moment Bernard writes a memory, so it gets its own breakpoint: a memory write
 * invalidates only the second block and the first still reads back cheap.
 *
 * This matters more than it looks. The agent loop runs up to 8 iterations per
 * message and re-sends the whole prefix every time, so ~6k tokens of brief and
 * tools were being paid for at full price eight times over on a tool-heavy turn.
 */
function buildSystem(memoryBlock: string): Anthropic.Beta.BetaTextBlockParam[] {
  return [
    { type: "text", text: SYSTEM_BASE, cache_control: { type: "ephemeral", ttl: "1h" } },
    {
      type: "text",
      text: `=== MEMORY (yours, written by you, persists across all sessions) ===\n${memoryBlock}\n=== END MEMORY ===`,
      cache_control: { type: "ephemeral" },
    },
  ];
}

/**
 * Move the conversation cache breakpoint to the tail of the transcript.
 *
 * Each loop iteration appends the assistant turn and its tool results, so
 * without this every iteration re-pays full price for everything the previous
 * iterations already sent. Old markers are cleared first because the API caps
 * breakpoints at four and the two system blocks already hold two.
 */
function markConversationCache(messages: Anthropic.Beta.BetaMessageParam[]): void {
  const asRecords = (c: unknown) => c as unknown as Record<string, unknown>[];
  for (const m of messages) {
    if (typeof m.content === "string") continue;
    for (const block of asRecords(m.content)) {
      if (block && typeof block === "object") delete block.cache_control;
    }
  }
  const last = messages[messages.length - 1];
  if (!last) return;
  if (typeof last.content === "string") {
    last.content = [
      { type: "text", text: last.content, cache_control: { type: "ephemeral" } },
    ];
    return;
  }
  const blocks = asRecords(last.content);
  const tail = blocks[blocks.length - 1];
  if (tail && typeof tail === "object") tail.cache_control = { type: "ephemeral" };
}

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
    case "list_meta_accounts": return "Listing ad accounts…";
    case "run_audit": return "Auditing the account (live reads)…";
    case "read_ad_copy": return "Reading the ad copy…";
    case "list_audiences": return "Reading the audiences…";
    case "get_adset_detail": return "Reading the ad set config…";
    case "get_creative_performance": return "Ranking the creatives…";
    case "get_pixel_stats": return "Reading pixel event volume…";
    case "dispatch_copy_fix": return "Rebuilding the ad with corrected copy…";
    case "dispatch_build": return "Dispatching the build to the substrate…";
    case "remember": return "Committing that to memory…";
    case "revise_memory": return "Updating what I know…";
    case "forget": return "Forgetting that…";
    default: return "Working…";
  }
}

const META_NOT_CONFIGURED = {
  error:
    "Meta access is not configured on this deployment (META_ADS_TOKEN missing) — tell the founder it needs adding to the environment.",
};

/** Shared guard for the account-scoped Meta reads. */
function requireMetaAccount(ref: unknown, tool: string): { digits: string } | { error: string } {
  if (!metaConfigured()) return META_NOT_CONFIGURED;
  const s = String(ref ?? "").trim();
  if (!/^(act_)?\d{6,}$/.test(s))
    return { error: `${tool} needs a numeric ad account id — resolve the name via list_meta_accounts first.` };
  return { digits: normalizeActId(s).digits };
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
    case "list_meta_accounts": {
      if (!metaConfigured())
        return { error: "Meta access is not configured on this deployment (META_ADS_TOKEN missing) — tell the founder it needs adding to the environment." };
      return listMetaAdAccounts();
    }
    case "run_audit": {
      if (!metaConfigured())
        return { error: "Meta access is not configured on this deployment (META_ADS_TOKEN missing) — tell the founder it needs adding to the environment." };
      const ref = String(input.account_id ?? "");
      if (!/^(act_)?\d{6,}$/.test(ref.trim()))
        return { error: "run_audit needs a numeric ad account id — resolve the name via list_meta_accounts first." };
      const days = Math.min(90, Math.max(7, Math.round(Number(input.days) || 30)));
      const { digits } = normalizeActId(ref);
      const data = await getMetaAuditData(digits, days);
      return { ...data, download_path: `/api/bernard/audit/${digits}?days=${days}` };
    }
    case "read_ad_copy": {
      const guard = requireMetaAccount(input.account_id, "read_ad_copy");
      if ("error" in guard) return guard;
      const status = input.status === "all" ? "all" : "active";
      const limit = Number(input.limit) || undefined;
      return readAdCopy(guard.digits, { status, limit });
    }
    case "list_audiences": {
      const guard = requireMetaAccount(input.account_id, "list_audiences");
      if ("error" in guard) return guard;
      return listCustomAudiences(guard.digits);
    }
    case "get_adset_detail": {
      if (!metaConfigured()) return META_NOT_CONFIGURED;
      const id = String(input.adset_id ?? "").trim();
      if (!/^\d{6,}$/.test(id)) return { error: "get_adset_detail needs a numeric ad set id." };
      return getAdSetDetail(id);
    }
    case "get_creative_performance": {
      const guard = requireMetaAccount(input.account_id, "get_creative_performance");
      if ("error" in guard) return guard;
      const days = input.days ? Math.min(365, Math.max(1, Math.round(Number(input.days)))) : undefined;
      return getCreativePerformance(guard.digits, { days });
    }
    case "get_pixel_stats": {
      if (!metaConfigured()) return META_NOT_CONFIGURED;
      const id = String(input.pixel_id ?? "").trim();
      if (!/^\d{6,}$/.test(id)) return { error: "get_pixel_stats needs a numeric pixel id." };
      const days = Math.min(90, Math.max(1, Math.round(Number(input.days) || 30)));
      return getPixelStats(id, { days });
    }
    case "dispatch_copy_fix": {
      if (!metaConfigured()) return META_NOT_CONFIGURED;
      const clientSlug = String(input.client_slug ?? "").trim();
      const accountId = String(input.account_id ?? "").trim();
      const adsetId = String(input.adset_id ?? "").trim();
      const baseCreativeId = String(input.base_creative_id ?? "").trim();
      const adName = String(input.ad_name ?? "").trim();
      const buildRef = String(input.build_ref ?? "").trim();
      if (!clientSlug || !accountId || !adsetId || !baseCreativeId || !adName || !buildRef) {
        return { error: "dispatch_copy_fix needs client_slug, account_id, adset_id, base_creative_id, ad_name and build_ref." };
      }
      const asStrings = (v: unknown): Record<string, string> | undefined => {
        if (!v || typeof v !== "object") return undefined;
        const out: Record<string, string> = {};
        for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[k] = String(val);
        return Object.keys(out).length ? out : undefined;
      };
      const built = await buildCopyFixSpec(baseCreativeId, {
        titles: asStrings(input.title_overrides),
        bodies: asStrings(input.body_overrides),
      });
      if ("error" in built) return { error: `Could not assemble the spec: ${built.error}` };
      if (!built.applied.length) {
        return { error: "No overrides were applied, so this dispatch would recreate the same copy. Name at least one title or body index." };
      }
      // The executor's pre-flight wants a campaign with a name and objective OR
      // an existing id, and an ad set reference in the same shape. Resolve the
      // parent campaign from the ad set rather than asking for it: the caller
      // knows which ad set the ad belongs in, and making them also supply the
      // campaign is a second chance to get an id wrong.
      const parent = await getAdSetDetail(adsetId);
      if ("error" in parent) return { error: `Could not resolve the ad set: ${parent.error}` };
      const campaignId = String((parent as { campaignId?: unknown }).campaignId ?? "");
      if (!campaignId) return { error: `Ad set ${adsetId} returned no parent campaign, so the build envelope cannot be addressed.` };
      const dispatched = await dispatchBuild({
        client_slug: clientSlug,
        account_id: accountId.startsWith("act_") ? accountId : `act_${accountId.replace(/^act_/, "")}`,
        build_ref: buildRef,
        campaigns: [{ id: campaignId, adsets: [{ id: adsetId, ads: [{ name: adName, creative: built.spec }] }] }],
      });
      return {
        assembled: {
          base_creative_id: baseCreativeId,
          resolved_campaign_id: campaignId,
          applied: built.applied,
          deduped_assets: built.dedupedAssets,
          residual_em_dashes: built.residualEmDashes,
          residual_claims: built.residualClaims,
        },
        dispatch: dispatched,
        note:
          "The spec was assembled server-side from the base creative, so nothing was transcribed. residual_em_dashes and residual_claims cover the WHOLE creative including variants you did not touch: if either is non-empty, the new ad still carries a defect and needs another override before activation.",
      };
    }
    case "dispatch_build": {
      const spec = input as unknown as BuildDispatch;
      if (!spec.client_slug || !spec.account_id || !spec.build_ref || !Array.isArray(spec.campaigns) || !spec.campaigns.length)
        return { error: "dispatch_build needs client_slug, account_id, build_ref and a non-empty campaigns spec." };
      try { return await dispatchBuild(spec); }
      catch (e) { return { error: e instanceof Error ? e.message : String(e) }; }
    }
    case "remember": {
      const kind = String(input.kind ?? "");
      if (!(MEMORY_KINDS as string[]).includes(kind))
        return { error: `kind must be one of: ${MEMORY_KINDS.join(", ")}` };
      const content = String(input.content ?? "");
      if (!content.trim()) return { error: "remember needs content." };
      return remember(AGENT, kind as MemoryKind, String(input.subject ?? "global"), content, actor, input.shared === true);
    }
    case "revise_memory": {
      const id = String(input.memory_id ?? "");
      if (!id) return { error: "revise_memory needs a memory_id from your memory block." };
      return reviseMemory(AGENT, id, String(input.content ?? ""));
    }
    case "forget": {
      const id = String(input.memory_id ?? "");
      if (!id) return { error: "forget needs a memory_id from your memory block." };
      return forgetMemory(AGENT, id, String(input.reason ?? "founder asked me to forget it"));
    }
    default:
      return { error: `Unknown tool ${name}` };
  }
}

// Bookkeeping tools run AFTER the answer is written, not before it, so any text
// streamed ahead of them is the reply itself and must survive the tool turn.
const BOOKKEEPING_TOOLS = new Set(["remember", "revise_memory", "forget"]);
const PREAMBLE_MAX_CHARS = 400;

/** True when the text streamed during a tool turn is throat-clearing rather
 *  than the answer. Only then is it safe to tell the client to discard it. */
function isPreamble(text: string, toolUses: { name: string }[]): boolean {
  if (toolUses.every((t) => BOOKKEEPING_TOOLS.has(t.name))) return false;
  return text.trim().length <= PREAMBLE_MAX_CHARS;
}

// Streaming Bernard chat. Same NDJSON event contract as the Rexos agent so the
// UI plumbing is shared: status while tools run, delta for answer text, reset
// to drop tool-turn preamble, then done (or error).
export async function runBernardChatStream(
  history: ChatMessage[],
  actor: string,
  emitRaw: (ev: AgentEvent) => void,
  attachments: Attachment[] = [],
): Promise<void> {
  // The no-em-dash ruling is enforced in code, not just asked of the prompt.
  const scrub = makeEmDashScrubber();
  const emit = (ev: AgentEvent) =>
    emitRaw(ev.type === "delta" && ev.text ? { ...ev, text: scrub(ev.text) } : ev);
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    emit({ type: "delta", text: "Bernard isn't configured (no ANTHROPIC_API_KEY)." });
    emit({ type: "done" });
    return;
  }
  const client = new Anthropic({ apiKey });
  // Memory is read fresh each turn, so anything Bernard remembered a moment ago
  // is already in scope, and a founder edit lands without a restart.
  const system = buildSystem(renderMemories(await loadMemories(AGENT), AGENT));
  const messages: Anthropic.Beta.BetaMessageParam[] = history.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // Files ride on the turn they were sent with, as document blocks ahead of the
  // founder's text so Bernard reads them before the instruction about them.
  // Extracted text also lands in the stored transcript (see transcriptNote), so
  // it survives into later turns; a PDF does not, because we hold only the bytes
  // for the length of this request. Re-attach if a PDF is needed again later.
  if (attachments.length && messages.length) {
    const last = messages[messages.length - 1];
    const blocks: Anthropic.Beta.BetaContentBlockParam[] = attachments.map((a) =>
      a.kind === "pdf"
        ? {
            type: "document",
            title: a.name,
            source: { type: "base64", media_type: "application/pdf", data: a.base64 },
          }
        : {
            type: "document",
            title: a.name,
            source: { type: "text", media_type: "text/plain", data: a.text },
          },
    );
    blocks.push({ type: "text", text: typeof last.content === "string" ? last.content : "" });
    messages[messages.length - 1] = { role: "user", content: blocks };
  }

  try {
    for (let i = 0; i < 8; i++) {
      markConversationCache(messages);
      const stream = client.beta.messages.stream({
        model: MODEL,
        // A build spec is emitted verbatim inside a tool_use block, and a
        // placement-customised creative runs to roughly 4k tokens of JSON on
        // its own. At 8000 the tool call truncated mid-argument and
        // dispatch_build received an empty campaigns array with no error to
        // explain it. Headroom here is what lets him dispatch real specs.
        max_tokens: 32000,
        output_config: { effort: "medium" },
        system,
        tools: TOOLS,
        messages,
      });
      let turnText = "";
      stream.on("text", (t) => {
        turnText += t;
        emit({ type: "delta", text: t });
      });
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
      // Drop preamble streamed during a tool turn ("let me check…"), but never
      // the answer itself. Bernard routinely writes a full reply and only then
      // calls remember/revise_memory to file it; resetting there deleted
      // everything he had said and left the founder the closing line alone.
      if (isPreamble(turnText, toolUses)) emit({ type: "reset" });
      const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
      for (const tu of toolUses) {
        emit({ type: "status", text: statusLabel(tu.name) });
        let out: unknown;
        try {
          out = await runTool(tu.name, (tu.input ?? {}) as Record<string, unknown>, actor);
        } catch (e) {
          out = { error: e instanceof Error ? e.message : String(e) };
        }
        // A finished audit gets a first-class download chip in the panel.
        const dl = (out as { download_path?: string; account?: { name?: unknown } } | null);
        if (tu.name === "run_audit" && dl?.download_path) {
          const who = typeof dl.account?.name === "string" ? dl.account.name : "account";
          emit({ type: "artifact", text: dl.download_path, label: `Download the ${who} audit (.docx)` });
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

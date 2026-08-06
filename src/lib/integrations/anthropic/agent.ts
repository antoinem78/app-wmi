// Rexos chat agent — the "ask about your accounts" brain. Claude Opus 4.8 with
// READ-ONLY tools over the live data layer. It can analyse and PROPOSE
// optimisations, but it cannot execute anything (no mutate layer exists; every
// change is a recommendation for human approval).
import Anthropic from "@anthropic-ai/sdk";
import {
  loadMemories,
  renderMemories,
  remember,
  reviseMemory,
  forgetMemory,
  MEMORY_KINDS,
  type MemoryKind,
} from "@/lib/agent-memory";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getDashboard, getWeeklyOptimisations } from "@/lib/integrations/google-ads/reporting";
import { gaqlSearch, listManagedAccounts } from "@/lib/integrations/google-ads";
import { getFeedAudit } from "@/lib/integrations/google-ads/feed";
import { getCommandCenter } from "@/lib/command-center";
import { createProposal, decideProposal, listProposals, type ProposalType, type ProposalStatus } from "@/lib/proposals";
import { applyProposal, dryRunProposal } from "@/lib/proposals-execute";
import { buildGoogleCampaign, type GoogleBuildSpec } from "@/lib/integrations/google-ads/build";
import { entityConfig } from "@/lib/config";
import { makeEmDashScrubber } from "@/lib/emdash";

const AGENT = "oscar";
const MODEL = "claude-opus-4-8";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export type AgentEvent =
  | { type: "status"; text: string } // a tool is running
  | { type: "delta"; text: string } // a chunk of the answer
  | { type: "reset" } // discard any text streamed during a tool-use turn (preamble)
  | { type: "artifact"; text: string; label?: string } // a downloadable deliverable (href)
  | { type: "done" }
  | { type: "error"; text: string };

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

// ---- Account roster + resolution (cheap; DB only, no GAQL) ----
interface RosterEntry { clientId: string | null; reportingId: string; company: string; status: string; imported: boolean }
// MCC-wide READS: the roster is imported clients PLUS every leaf under the MCC
// (so the agent can analyse any account). Non-imported accounts have clientId
// null — reads work off the customer id; proposals require an imported client.
async function loadRoster(): Promise<RosterEntry[]> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("onboarding_state")
    .select("client_id, google_ads_customer_id, google_ads_reporting_customer_id, clients(company_name, status)")
    .eq("ad_link_status", "approved")
    .not("google_ads_customer_id", "is", null);
  const roster: RosterEntry[] = (data ?? []).map((r) => ({
    clientId: r.client_id as string,
    reportingId: (r.google_ads_reporting_customer_id ?? r.google_ads_customer_id) as string,
    company: (r.clients as unknown as { company_name?: string } | null)?.company_name ?? "(unnamed)",
    status: (r.clients as unknown as { status?: string } | null)?.status ?? "",
    imported: true,
  }));
  const seen = new Set(roster.map((r) => r.reportingId.replace(/\D/g, "")));
  try {
    for (const leaf of await listManagedAccounts()) {
      if (seen.has(leaf.id.replace(/\D/g, ""))) continue; // already an imported client
      roster.push({ clientId: null, reportingId: leaf.id, company: leaf.name || leaf.id, status: "managed", imported: false });
    }
  } catch {
    /* MCC enumeration best-effort — fall back to imported clients only */
  }
  return roster;
}
function resolveAccount(roster: RosterEntry[], ref: string): RosterEntry | null {
  const q = (ref ?? "").trim().toLowerCase();
  if (!q) return null;
  const byId = roster.find((r) => r.clientId === ref);
  if (byId) return byId;
  // Match on the Google Ads customer id (dash/space-insensitive) — the agent or
  // user often refers to an account by its numeric id (e.g. 236-724-2101).
  const digits = q.replace(/\D/g, "");
  if (digits) {
    const byCid = roster.find((r) => r.reportingId.replace(/\D/g, "") === digits);
    if (byCid) return byCid;
  }
  return (
    roster.find((r) => r.company.toLowerCase() === q) ??
    roster.find((r) => r.company.toLowerCase().includes(q)) ??
    null
  );
}

// When the chat is scoped to a client in the UI, tell the agent which account it
// is (so it doesn't ask "which account?"). Advisory — the user can still name
// another account explicitly.
function focusNote(roster: RosterEntry[], focusClientId?: string | null): string {
  if (!focusClientId) return "";
  const acc = roster.find((r) => r.clientId === focusClientId);
  if (!acc) return "";
  return `\n\nFOCUS ACCOUNT: the user is working on ${acc.company} (clientId ${acc.clientId}, Google customer id ${acc.reportingId}). Treat questions as about this account unless they clearly name another. Call tools with this account directly — you do not need to ask which account.`;
}

// ---- Compact projection of a dashboard payload (keep tokens sane) ----
function compactReport(company: string, p: Awaited<ReturnType<typeof getDashboard>>) {
  const k = p.kpis;
  const kpi = (x: { value: number; deltaPct: number | null }) => ({
    value: Number(x.value.toFixed(2)),
    deltaPct: x.deltaPct == null ? null : Number(x.deltaPct.toFixed(1)),
  });
  return {
    company,
    currency: p.currency,
    period: p.range,
    note: "Account-wide across all channel types. Search impression share & search terms are Search-only. 'byTime' = conversion-date basis.",
    kpis: {
      spend: kpi(k.spend), impressions: kpi(k.impressions), clicks: kpi(k.clicks), ctr: kpi(k.ctr),
      avgCpc: kpi(k.avgCpc), conversions: kpi(k.conversions), costPerConv: kpi(k.costPerConv),
      conversionRate: kpi(k.convRate), revenue: kpi(k.convValue), roas: kpi(k.roas), aov: kpi(k.aov),
      conversionsByTime: kpi(k.conversionsByTime), revenueByTime: kpi(k.convValueByTime), roasByTime: kpi(k.roasByTime),
      searchImpressionShare: kpi(k.searchImprShare),
    },
    hasConversionValue: p.hasConversionValue,
    byChannel: p.byChannel,
    impressionShare: p.impressionShare,
    topCampaigns: p.byCampaign.slice(0, 8),
    conversionsByAction: p.byConversionAction,
    topSearchTerms: p.topSearchTerms.slice(0, 8),
    topAds: p.topAds.slice(0, 5).map((a) => ({ headline: a.headline, campaign: a.campaign, conversions: a.conversions, cost: a.cost, ctr: Number(a.ctr.toFixed(2)) })),
    deviceSplit: p.byDevice,
  };
}

// ---- Tool definitions (read-only) ----
const TOOLS: Anthropic.Tool[] = [
  {
    name: "list_accounts",
    description: "List all managed accounts (company name, client id, Google Ads customer id, status). Use to resolve an account — you can then reference it by name OR by its Google customer id. Cheap; no metrics.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "list_campaigns",
    description: "List an account's campaigns (name, id, status, type) INCLUDING PAUSED ones, independent of recent activity. Use this to find the EXACT campaign name to target for a proposal — especially on paused or low-activity accounts where get_account_report shows little. Always confirm the exact campaign name here before filing an executable proposal.",
    input_schema: { type: "object", properties: { account: { type: "string", description: "Client name, client id, or Google customer id" } }, required: ["account"] },
  },
  {
    name: "get_account_report",
    description: "Full performance snapshot for ONE account this week vs prior: KPIs (incl. by-time + ROAS/AOV), by-channel, impression-share suite, top campaigns, conversions-by-action, top search terms, top ads, device split. Use for 'how is <client> doing' and to justify/refute optimisations.",
    input_schema: { type: "object", properties: { account: { type: "string", description: "Client name or id (from list_accounts)" } }, required: ["account"] },
  },
  {
    name: "get_all_account_summaries",
    description: "Headline KPIs (spend/conv/CPA/ROAS + deltas), open alerts, and health status for EVERY account, plus per-currency agency totals. Use for cross-account questions (where am I wasting budget, reallocate budget, which campaign/account to pause).",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_recent_changes",
    description: "The logged account changes (optimisations) for ONE account this week, from the Google Ads change history.",
    input_schema: { type: "object", properties: { account: { type: "string", description: "Client name or id" } }, required: ["account"] },
  },
  {
    name: "get_search_terms",
    description: "The account's ACTUAL search-term (query) data — Search campaigns only, aggregated per query, sorted by spend. Call this BEFORE proposing any negative keyword so you cite real wasted queries (meaningful cost, zero/low conversions) rather than inventing one. Only Search has search terms; PMax / Demand Gen / Shopping return nothing.",
    input_schema: { type: "object", properties: { account: { type: "string", description: "Client name or id" }, days: { type: "number", description: "Look-back window in days (default 30, max 90)" } }, required: ["account"] },
  },
  {
    name: "get_feed_audit",
    description: "Google Shopping / feed PERFORMANCE audit for ONE ecommerce account: product-level winners and wasted spend (zero-conversion products), spend concentration, brand and product-type breakdowns, Shopping vs Performance Max split, and computed feed diagnoses. Use for feed/Shopping questions ('audit <client>'s feed', 'where is Shopping wasting spend', 'which products to cut'). Read-only. NOTE: this is feed PERFORMANCE from the Ads API — NOT Merchant Center feed HEALTH (disapprovals / item errors), which isn't available yet.",
    input_schema: { type: "object", properties: { account: { type: "string", description: "Client name or id" }, days: { type: "number", description: "Look-back window in days (default 30, max 180)" } }, required: ["account"] },
  },
  {
    name: "propose_optimization",
    description:
      "File a structured, reviewable optimisation proposal against an account for the human to approve or dismiss. Use when the user asks you to PROPOSE a change, or when you've identified a concrete, figure-backed change worth formalising. This does NOT execute anything — it creates a pending proposal card in the Proposals page. Base it on figures you've fetched. File one proposal per distinct change.",
    input_schema: {
      type: "object",
      properties: {
        account: { type: "string", description: "Client name or id" },
        type: { type: "string", enum: ["negative_keywords", "pause_campaign", "budget_reallocation", "rsa_improvement", "other"] },
        title: { type: "string", description: "Short imperative summary, e.g. 'Pause Competitors Test 2026 (£268, 0 conv)'" },
        rationale: { type: "string", description: "1-3 sentences, figure-backed, on why." },
        details: {
          type: "object",
          description:
            "To make the proposal EXECUTABLE (gives it an Apply button), include an `action` object — exactly ONE operation per proposal (one op per approval; NO batching). For multiple negatives, file SEPARATE proposals, one keyword each. For campaign-level actions (add_negative_keyword, pause_campaign, set_campaign_budget) the `campaign` field is REQUIRED and must be an EXACT campaign name from list_campaigns (do NOT guess). For an account-wide shared negative use add_shared_negative (NO campaign). If you cannot pin a campaign-level change to a specific campaign, OMIT `action` entirely and file it as ADVISORY — never emit a campaign-level action with a missing or invented campaign.",
          properties: {
            action: {
              type: "object",
              description:
                "campaign negative: {kind:'add_negative_keyword', campaign, level:'campaign'|'ad_group', adGroup?, text:'<one keyword>', matchType:'EXACT'|'PHRASE'|'BROAD'}. shared/account-level negative (attaches to all Search campaigns): {kind:'add_shared_negative', text:'<one keyword>', matchType:'EXACT'|'PHRASE'|'BROAD'}. pause: {kind:'pause_campaign', campaign}. budget: {kind:'set_campaign_budget', campaign, newDailyAmount:<number in account currency>}.",
              properties: {
                kind: { type: "string", enum: ["add_negative_keyword", "add_shared_negative", "pause_campaign", "set_campaign_budget"] },
                campaign: { type: "string" },
                level: { type: "string", enum: ["campaign", "ad_group"] },
                adGroup: { type: "string" },
                text: { type: "string" },
                matchType: { type: "string", enum: ["EXACT", "PHRASE", "BROAD"] },
                newDailyAmount: { type: "number" },
              },
            },
          },
        },
      },
      required: ["account", "type", "title", "rationale"],
    },
  },
  {
    name: "run_audit",
    description:
      "Hand the founder a link to the full Google Ads Audit and Growth Research document (.docx) for one client: account audit, diagnosis with severities, strategy, forecast and an optimisation plan. The document is generated fresh from live account data when he opens the link, and takes a couple of minutes. Use this when he asks for an audit, a written review, or something to send a client. ONLY works for imported clients (an account the agency has onboarded); a bare MCC account with no client record cannot be audited this way, and you should say so rather than guessing an id.",
    input_schema: {
      type: "object",
      properties: {
        account: { type: "string", description: "Client name, client id, or Google customer id — resolve via list_accounts if unsure" },
        monthly_budget: { type: "number", description: "Optional monthly budget in account currency to base the forecast on; omit to derive it from historic spend" },
      },
      required: ["account"],
    },
  },
];

const SYSTEM_BASE = `You are Oscar, the ${entityConfig.brandName} senior paid search strategist. You own Google Ads and Shopping across every client: you read accounts against ground truth, you form a view, and you defend it. Analysis and reporting are things you do, not what you are.

You are NOT Rexos. Rexos is the platform you work inside, the same way Bernard (your counterpart on Meta) works inside it. Never refer to yourself as Rexos. If someone calls you Rexos, answer to it once and carry on as Oscar rather than correcting them at length.

YOUR MEMORY IS PERMANENT. Everything in the MEMORY block below is yours, written by you in earlier sessions, and it persists across sessions indefinitely. It survives the chat being cleared: clearing wipes the visible transcript only. So never say you have no memory across sessions, and never ask for something to be re-explained that is already in your memory. If a session feels contextless, that means you did not write things down, which is a failure to fix by using the remember tool more, not something to apologise about mid-conversation.

Use it like a strategist keeping a running file on every account:
- When you learn something durable, call remember. How an account is structured and why, its baselines, a ruling the founder made, a preference about how he wants you to work, a strategic position you have taken. Do it as it happens.
- Store judgement, not readings. Yesterday's spend and today's impression share are live lookups; the conclusion you drew from them is memory.
- Memories can be SHARED across agents. Anything marked "SHARED by <agent>" in your memory block was written by a colleague: treat it as their testimony about their channel, trust it for client-level facts, and do not repeat their platform tactics on yours without thinking. Share your own client-level learnings back (the shared flag on remember); a multi-channel client should never depend on the founder ferrying facts between you.
- When a fact changes, revise_memory rather than adding a second version. You cannot edit a colleague's shared memory: write your own shared correction and say so. Contradictory memories are worse than none.
- Your memory is yours alone. Bernard has his own and you cannot see it, because a conclusion about Meta delivery rarely transfers to a search auction. If something genuinely spans both, say so and let the founder carry it across.

HOW YOU WORK:
- Use the tools to fetch REAL figures. Never invent, estimate or recompute a number, %, campaign name or metric. If you don't have it, fetch it.
- Resolve accounts with list_accounts (you can reference an account by name OR its Google customer id). Use get_account_report for one account, get_all_account_summaries for cross-account questions, get_recent_changes for what was changed, get_search_terms for real query data, get_feed_audit for Shopping/feed (ecommerce) questions, and list_campaigns to get the EXACT campaign names (including paused ones) before filing any executable proposal.
- Figures are ACCOUNT-WIDE across all channel types. Attribute correctly — never call Performance Max / Shopping activity "Search", never call product/listing groups "keywords". Search impression share and search terms are Search-only. Two conversion bases exist (interaction date vs by-time); don't conflate them.
- Respect each account's own currency; never sum across currencies.
- Don't narrate your tool use ("let me check…", "I'll look that up"); just call the tools, then give the answer.

YOUR JOB:
- Be concise, specific and actionable — a senior analyst talking to a peer. Lead with the answer, then the evidence.
- Never use an em dash, in anything you write: chat, drafts, documents, headings. Use a full stop, comma, colon or parentheses instead (en dashes only inside numeric ranges, like 45-54). The founder has ruled on this; anything you hand him must already comply.
- Anything drafted in the founder's voice (client messages, freelancer instructions) is first person SINGULAR: I, me, my. Never the agency "we/us/our", even where it feels natural ("we cut the videos"). Ruled 2026-08-03. Sweep the draft for "we" before handing it over.
- You may PROPOSE optimisations (negatives to add, budget reallocations, RSA improvements, campaigns/ad groups to pause) with clear, figure-backed rationale. But you CANNOT execute anything.
- When the user asks you to PROPOSE something (or you've found a concrete change worth formalising), call propose_optimization to file it as a reviewable card, then tell the user it is filed. The founder can approve and apply WITHOUT leaving this chat: on his explicit word, decide_proposal records the approval and apply_proposal executes it behind the same guardrails as the Proposals page. Offer dry_run_proposal when he hesitates. NEVER claim a change was made unless apply_proposal returned success; execution authority is his word, never your inference.
- For the executable actions — add a single (campaign or ad-group) negative keyword, add a shared/account-level negative, pause a campaign, set a campaign daily budget — include the precise details.action block so the proposal can be applied behind the approval gate. ONE operation per proposal: to add several negatives, file several proposals (one keyword each), never a batch. For a campaign-level negative, pause, or budget change, first call list_campaigns to get the EXACT campaign name. For a shared negative (no campaign), use the add_shared_negative action.
- NEGATIVE KEYWORDS: before proposing ANY negative keyword, call get_search_terms and cite the actual wasted queries (meaningful cost, zero/low conversions). Never invent a query. If get_search_terms returns nothing, say so and do not fabricate one. If a wasted query is spending across many Search campaigns, file a shared negative (add_shared_negative); if it is confined to one campaign, file a campaign-level add_negative_keyword against that exact campaign.
- If asked whether an optimisation is needed and you think NOT, prove it with the figures.
- dispatch_build creates a full Search campaign from a spec: campaign PAUSED always, atomic (all or nothing), gates in code, result verified by re-read. You CAN build from this chat. Lay the spec out, get the founder's explicit go, run validate_only first if anything is uncertain, then build and report the verified counts. The founder activates; you never do. PMax, Demand Gen and Shopping builds do not exist here; say so rather than improvising.
- run_audit prepares the written Google Ads audit. Give the founder the download_path on its own line at the end of your reply, e.g. "Audit document: /api/audit/<id>". Keep your chat read tight; the document carries the detail. It only covers imported clients, so if he names a bare MCC account say plainly that there is no client record to attach it to rather than inventing an id.`;

/** The system prompt for one turn: the fixed brief plus everything Oscar has
 *  chosen to remember. Loaded per request so a memory written earlier in the
 *  same conversation is in scope on the next turn. */
/**
 * System prompt as cache-separated blocks. The brief never changes so it caches
 * with the tool definitions ahead of it in the prefix; the memory block gets its
 * own breakpoint so writing a memory invalidates only itself; the focus note
 * varies per client and stays uncached at the end.
 *
 * The agent loop re-sends this prefix on every one of up to 8 iterations, so
 * without breakpoints a tool-heavy turn pays for the whole thing eight times.
 */
function buildSystem(memoryBlock: string, focus = ""): Anthropic.TextBlockParam[] {
  const blocks: Anthropic.TextBlockParam[] = [
    { type: "text", text: SYSTEM_BASE, cache_control: { type: "ephemeral" } },
    {
      type: "text",
      text: `=== MEMORY (yours, written by you, persists across all sessions) ===\n${memoryBlock}\n=== END MEMORY ===`,
      cache_control: { type: "ephemeral" },
    },
  ];
  if (focus) blocks.push({ type: "text", text: focus });
  return blocks;
}

/**
 * Move the conversation cache breakpoint to the tail of the transcript. Each
 * loop iteration appends the assistant turn and its tool results, so without
 * this every iteration re-pays full price for what the previous ones sent. Old
 * markers are cleared first: the API caps breakpoints at four and the two
 * system blocks already hold two.
 */
function markConversationCache(messages: Anthropic.MessageParam[]): void {
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

const EXEC_TOOLS: Anthropic.Tool[] = [
  {
    name: "list_proposals",
    description: "List optimisation proposals (id, title, type, status, client). Use to resolve which proposal the founder means before deciding or applying, and to answer what is pending.",
    input_schema: { type: "object", properties: {
      status: { type: "string", enum: ["pending", "approved", "dismissed", "applied"], description: "Filter by status; omit for all recent" },
    } },
  },
  {
    name: "decide_proposal",
    description: "Record the founder's decision on a specific proposal. ONLY call this when the founder has explicitly and unambiguously approved or dismissed a SPECIFIC proposal in this conversation. His word in this chat IS the approval gate. If more than one proposal could match, list them and ask which.",
    input_schema: { type: "object", properties: {
      proposal_id: { type: "string" },
      decision: { type: "string", enum: ["approved", "dismissed"] },
    }, required: ["proposal_id", "decision"] },
  },
  {
    name: "apply_proposal",
    description: "Execute an APPROVED executable proposal against Google Ads. The worker re-checks approval status and every guardrail (write kill switch, customer allow-list, budget caps) before any mutate, exactly as the Proposals page Apply button does. ONLY call after the founder explicitly says to apply, and only on a proposal that is already approved (approve first via decide_proposal if he says approve-and-apply). Report the result verbatim; never claim success the result does not show.",
    input_schema: { type: "object", properties: {
      proposal_id: { type: "string" },
    }, required: ["proposal_id"] },
  },
  {
    name: "dry_run_proposal",
    description: "Preview exactly what applying a proposal would change, without changing anything. Cheap and safe; offer it when the founder hesitates.",
    input_schema: { type: "object", properties: {
      proposal_id: { type: "string" },
    }, required: ["proposal_id"] },
  },
];

const BUILD_TOOL: Anthropic.Tool[] = [
  {
    name: "dispatch_build",
    description:
      "Build a complete SEARCH campaign in a client's Google Ads account from a spec: budget, bidding, geo, schedule, campaign negatives, ad groups with keywords and responsive search ads. The build is one atomic operation (it fully exists or nothing does), the CAMPAIGN is always created PAUSED regardless of the spec (the founder activates; groups and ads inside are enabled so activation is a single action), and the result is verified by re-reading every count from the account. Gates enforced in code: global write kill switch, customer allowlist, budget hard cap, operation budget, duplicate-name refusal. ONLY call this when the founder has explicitly told you to build a SPECIFIC spec laid out in this conversation. Offer validate_only first when anything is uncertain: it runs Google's full server-side validation and changes NOTHING. Search campaigns only; Performance Max, Demand Gen and Shopping are not buildable here and you should say so plainly if asked.",
    input_schema: {
      type: "object",
      properties: {
        account: { type: "string", description: "Customer id (digits or formatted); resolve via list_accounts" },
        build_ref: { type: "string", description: "Unique reference for this build, e.g. vip-national-2026-08-01; recorded in the audit trail" },
        validate_only: { type: "boolean", description: "true = Google validates the full build server-side, creating nothing. Use as the dry run before a real build." },
        campaign: {
          type: "object",
          description: "The spec agreed with the founder. daily_budget and target_cpa/cpc_bid in account currency units. geo takes geo target constant ids or GB shorthand. schedule optional. Every ad: 3-15 headlines (max 30 chars), 2-4 descriptions (max 90 chars), final_url.",
          properties: {
            name: { type: "string" },
            daily_budget: { type: "number" },
            bidding: { type: "string", enum: ["maximize_conversions", "maximize_clicks", "manual_cpc"] },
            target_cpa: { type: "number" },
            geo: { type: "array", items: {} },
            negatives: { type: "array", items: { type: "object", properties: { text: { type: "string" }, match: { type: "string", enum: ["EXACT", "PHRASE", "BROAD"] } }, required: ["text", "match"] } },
            schedule: { type: "object", properties: { days: { type: "string", enum: ["MON_FRI", "ALL_WEEK"] }, start_hour: { type: "number" }, end_hour: { type: "number" } }, required: ["days", "start_hour", "end_hour"] },
            ad_groups: { type: "array", items: { type: "object", properties: {
              name: { type: "string" }, cpc_bid: { type: "number" },
              keywords: { type: "array", items: { type: "object", properties: { text: { type: "string" }, match: { type: "string", enum: ["EXACT", "PHRASE", "BROAD"] } }, required: ["text", "match"] } },
              ads: { type: "array", items: { type: "object", properties: {
                headlines: { type: "array", items: { type: "string" } },
                descriptions: { type: "array", items: { type: "string" } },
                final_url: { type: "string" }, path1: { type: "string" }, path2: { type: "string" },
              }, required: ["headlines", "descriptions", "final_url"] } },
            }, required: ["name", "keywords", "ads"] } },
          },
          required: ["name", "daily_budget", "bidding", "geo", "ad_groups"],
        },
      },
      required: ["account", "build_ref", "campaign"],
    },
  },
];

const MEMORY_TOOLS: Anthropic.Tool[] = [
  {
    name: "remember",
    description:
      "Write something to your permanent memory. It survives the chat being cleared and every future session, so use it for anything you would be embarrassed to have forgotten next week: how an account is structured and why, its baselines, a ruling the founder made, a standing preference about how he wants you to work, a strategic position you have taken. Do NOT store things you can look up live (yesterday's spend, current impression share) — store the judgement, not the reading. Check your existing memory first: if a memory is merely out of date, use revise_memory rather than adding a second version.",
    input_schema: {
      type: "object",
      properties: {
        kind: {
          type: "string",
          enum: ["client", "account", "decision", "preference", "strategy", "fact"],
          description: "client = how they operate; account = a Google Ads account's structure/baselines/quirks; decision = a founder ruling and its reason; preference = how the founder wants you to work; strategy = a standing position or plan; fact = anything else durable",
        },
        subject: {
          type: "string",
          description: "What it is about: a client name or slug, a Google customer id, or 'global' for things not tied to one entity",
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
      "Retire a memory. Use it when the founder tells you to forget something, or when you discover a memory was wrong. It stops appearing but is retained in the audit trail rather than destroyed, so state the reason honestly.",
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

const ALL_TOOLS: Anthropic.Tool[] = [...TOOLS, ...EXEC_TOOLS, ...BUILD_TOOL, ...MEMORY_TOOLS];

interface ToolContext { roster: RosterEntry[]; actor: string }
async function runTool(name: string, input: Record<string, unknown>, ctx: ToolContext): Promise<unknown> {
  switch (name) {
    case "dispatch_build": {
      const acc = resolveAccount(ctx.roster, String(input.account ?? ""));
      if (!acc) return { error: "Could not resolve that account. Use list_accounts and pass an exact name or customer id." };
      const spec = { account: acc.reportingId, build_ref: String(input.build_ref ?? ""), campaign: input.campaign } as unknown as GoogleBuildSpec;
      return buildGoogleCampaign(spec, ctx.actor, { validateOnly: input.validate_only === true });
    }
    case "list_proposals": {
      const st = input.status ? String(input.status) as ProposalStatus : undefined;
      return listProposals(st ? { status: st } : undefined);
    }
    case "decide_proposal": {
      const id = String(input.proposal_id ?? "");
      const d = String(input.decision ?? "");
      if (!id || (d !== "approved" && d !== "dismissed"))
        return { error: "decide_proposal needs a proposal_id and decision of approved|dismissed." };
      return decideProposal(id, d as "approved" | "dismissed", ctx.actor);
    }
    case "apply_proposal": {
      const id = String(input.proposal_id ?? "");
      if (!id) return { error: "apply_proposal needs a proposal_id." };
      return applyProposal(id, ctx.actor);
    }
    case "dry_run_proposal": {
      const id = String(input.proposal_id ?? "");
      if (!id) return { error: "dry_run_proposal needs a proposal_id." };
      return dryRunProposal(id);
    }
    case "remember": {
      const kind = String(input.kind ?? "");
      if (!(MEMORY_KINDS as string[]).includes(kind))
        return { error: `kind must be one of: ${MEMORY_KINDS.join(", ")}` };
      const content = String(input.content ?? "");
      if (!content.trim()) return { error: "remember needs content." };
      return remember(AGENT, kind as MemoryKind, String(input.subject ?? "global"), content, ctx.actor, input.shared === true);
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
    case "run_audit": {
      const acc = resolveAccount(ctx.roster, String(input.account ?? ""));
      if (!acc) return { error: "I couldn't resolve that account — call list_accounts and use an exact name or customer id." };
      if (!acc.imported || !acc.clientId) {
        return { error: `${acc.company} is visible under the MCC but is not an onboarded client, so there is no client record to attach an audit to. The written audit only covers imported clients. I can still report on it in chat.` };
      }
      const budget = Number(input.monthly_budget);
      const qs = Number.isFinite(budget) && budget > 0 ? `?budget=${Math.round(budget)}` : "";
      return {
        account: { company: acc.company, customer_id: acc.reportingId },
        download_path: `/api/audit/${acc.clientId}${qs}`,
        note: "Generated fresh from live account data when the founder opens it. Takes roughly two minutes.",
      };
    }
    case "list_accounts":
      return ctx.roster.map((r) => ({ clientId: r.clientId, company: r.company, customerId: r.reportingId, status: r.status, imported: r.imported }));
    case "list_campaigns": {
      const acc = resolveAccount(ctx.roster, String(input.account ?? ""));
      if (!acc) return { error: `No account matches "${input.account}". Call list_accounts.` };
      const rows = await gaqlSearch(acc.reportingId, "SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type FROM campaign WHERE campaign.status != 'REMOVED' ORDER BY campaign.name");
      const campaigns = rows.map((r) => {
        const c = (r.campaign ?? {}) as { id?: string | number; name?: string; status?: string; advertisingChannelType?: string };
        return { id: String(c.id), name: c.name, status: c.status, type: c.advertisingChannelType };
      }).slice(0, 80);
      return { company: acc.company, customerId: acc.reportingId, campaignCount: campaigns.length, campaigns };
    }
    case "get_account_report": {
      const acc = resolveAccount(ctx.roster, String(input.account ?? ""));
      if (!acc) return { error: `No account matches "${input.account}". Call list_accounts.` };
      const dash = await getDashboard(acc.clientId, acc.reportingId, { kind: "week" });
      return compactReport(acc.company, dash);
    }
    case "get_all_account_summaries": {
      const cc = await getCommandCenter(7);
      return {
        period: cc.range,
        totalsByCurrency: cc.totalsByCurrency,
        alertCounts: cc.alertCounts,
        accounts: cc.accounts.map((a) => ({
          company: a.company, clientId: a.clientId, status: a.status,
          currency: a.summary?.currency,
          spend: a.summary?.spend, conversions: a.summary?.conversions,
          cpa: a.summary?.cpa, roas: a.summary?.roas,
          alerts: a.alerts.map((al) => `${al.severity}: ${al.title}`),
        })),
      };
    }
    case "get_recent_changes": {
      const acc = resolveAccount(ctx.roster, String(input.account ?? ""));
      if (!acc) return { error: `No account matches "${input.account}". Call list_accounts.` };
      const dash = await getDashboard(acc.clientId, acc.reportingId, { kind: "week" });
      const changes = await getWeeklyOptimisations(acc.reportingId, dash.weekly.start, dash.weekly.end);
      return { company: acc.company, period: dash.weekly, changes: changes.length ? changes : ["No account changes logged this week."] };
    }
    case "get_search_terms": {
      const acc = resolveAccount(ctx.roster, String(input.account ?? ""));
      if (!acc) return { error: `No account matches "${input.account}". Call list_accounts.` };
      const days = Math.min(90, Math.max(1, Math.round(Number(input.days) || 30)));
      const end = new Date(Date.now() - 86_400_000); // exclude today
      const start = new Date(end.getTime() - (days - 1) * 86_400_000);
      const ymd = (d: Date) => d.toISOString().slice(0, 10);
      const rows = await gaqlSearch(
        acc.reportingId,
        `SELECT search_term_view.search_term, campaign.name, campaign.advertising_channel_type,
                metrics.cost_micros, metrics.clicks, metrics.conversions
         FROM search_term_view
         WHERE segments.date BETWEEN '${ymd(start)}' AND '${ymd(end)}'
           AND campaign.advertising_channel_type = 'SEARCH'
           AND metrics.cost_micros > 0
         ORDER BY metrics.cost_micros DESC
         LIMIT 500`,
      );
      // Aggregate per query (sum cost/clicks/conv, collect campaign names).
      const agg: Record<string, { term: string; cost: number; clicks: number; conversions: number; campaigns: Set<string> }> = {};
      for (const r of rows) {
        const term = ((r.searchTermView ?? {}) as { searchTerm?: string }).searchTerm ?? "";
        if (!term) continue;
        const m = (r.metrics ?? {}) as Record<string, unknown>;
        const camp = ((r.campaign ?? {}) as { name?: string }).name ?? "";
        agg[term] ??= { term, cost: 0, clicks: 0, conversions: 0, campaigns: new Set() };
        agg[term].cost += Number(m.costMicros ?? 0) / 1_000_000;
        agg[term].clicks += Number(m.clicks ?? 0);
        agg[term].conversions += Number(m.conversions ?? 0);
        if (camp) agg[term].campaigns.add(camp);
      }
      const terms = Object.values(agg)
        .sort((a, b) => b.cost - a.cost)
        .slice(0, 60)
        .map((t2) => ({
          term: t2.term,
          cost: Number(t2.cost.toFixed(2)),
          clicks: t2.clicks,
          conversions: Number(t2.conversions.toFixed(2)),
          campaigns: [...t2.campaigns],
        }));
      if (!terms.length) {
        return { company: acc.company, days, terms: [], note: "No Search search-term data in this window (the account may have no active Search campaigns; PMax/Demand Gen/Shopping have no search terms)." };
      }
      return {
        company: acc.company,
        currency: undefined,
        days,
        window: { start: ymd(start), end: ymd(end) },
        terms,
        note: "Costs in account major units. Queries with meaningful cost and zero/near-zero conversions are negative-keyword candidates. A wasted query spanning many Search campaigns is a shared-negative candidate; one confined to a single campaign is a campaign-level negative.",
      };
    }
    case "get_feed_audit": {
      const acc = resolveAccount(ctx.roster, String(input.account ?? ""));
      if (!acc) return { error: `No account matches "${input.account}". Call list_accounts.` };
      const days = Math.min(180, Math.max(7, Math.round(Number(input.days) || 30)));
      const f = await getFeedAudit(acc.reportingId, days);
      if (!f.hasShopping) {
        return { company: acc.company, hasShopping: false, note: "No Shopping/Performance Max activity found for this account in the window — nothing to audit at the feed level." };
      }
      const dec = (n: number, dp = 2) => Number(n.toFixed(dp));
      const trimProduct = (p: import("@/lib/integrations/google-ads/feed").FeedProduct) => ({
        itemId: p.itemId, title: p.title.slice(0, 80), brand: p.brand, type: p.type,
        impressions: p.impressions, clicks: p.clicks, cost: dec(p.cost), conversions: dec(p.conversions), convValue: dec(p.convValue), roas: dec(p.roas),
      });
      const trimGroup = (g: import("@/lib/integrations/google-ads/feed").FeedGroup) => ({ label: g.label, spend: dec(g.spend), conversions: dec(g.conversions), convValue: dec(g.convValue), roas: dec(g.roas) });
      return {
        company: acc.company,
        currency: f.currency,
        window: f.window,
        hasShopping: true,
        totals: {
          products: f.totals.products, spend: dec(f.totals.spend), conversions: dec(f.totals.conversions),
          convValue: dec(f.totals.convValue), roas: dec(f.totals.roas),
          nonConvertingSpend: dec(f.totals.nonConvertingSpend), nonConvertingSpendPct: dec(f.totals.nonConvertingSpendPct, 1),
          zeroClickProducts: f.totals.zeroClickProducts, missingBrand: f.totals.missingBrand,
        },
        spendConcentrationTop10Pct: dec(f.spendConcentrationTop10Pct, 1),
        channelSplit: f.channelSplit.map(trimGroup),
        topProducts: f.topProducts.slice(0, 10).map(trimProduct),
        wastedProducts: f.wastedProducts.slice(0, 10).map(trimProduct),
        byBrand: f.byBrand.slice(0, 8).map(trimGroup),
        byType: f.byType.slice(0, 8).map(trimGroup),
        diagnoses: f.diagnoses,
        note: "Feed PERFORMANCE from the Google Ads API — not Merchant Center feed HEALTH (disapprovals/item errors). Costs/values in account currency. Base negative/exclusion or bidding proposals on the wastedProducts + diagnoses.",
      };
    }
    case "propose_optimization": {
      const acc = resolveAccount(ctx.roster, String(input.account ?? ""));
      if (!acc) return { error: `No account matches "${input.account}". Call list_accounts.` };
      if (!acc.clientId)
        return { error: `${acc.company} is under the MCC but not imported as a client, so a proposal can't be filed against it yet. It can still be analysed; to file/track proposals, import it first (Add managed account).` };
      const res = await createProposal({
        clientId: acc.clientId,
        accountLabel: acc.company,
        type: (input.type as ProposalType) ?? "other",
        title: String(input.title ?? "Optimisation proposal"),
        rationale: input.rationale != null ? String(input.rationale) : undefined,
        details:
          input.details && typeof input.details === "object"
            ? (input.details as Record<string, unknown>)
            : {},
        createdBy: ctx.actor,
      });
      if ("error" in res) return { error: res.error };
      return {
        ok: true,
        proposalId: res.id,
        message: `Proposal filed for ${acc.company} — pending review in the Proposals page.`,
      };
    }
    default:
      return { error: `Unknown tool ${name}` };
  }
}

export async function runAgentChat(
  history: ChatMessage[],
  actor = "rexos-agent",
  focusClientId?: string | null,
): Promise<{ reply: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { reply: "The assistant isn't configured (no ANTHROPIC_API_KEY)." };
  const client = new Anthropic({ apiKey });
  const ctx: ToolContext = { roster: await loadRoster(), actor };
  // Memory is read fresh each turn, so a memory written a moment ago is already
  // in scope, and it is scoped to Oscar so Bernard's notes never leak in.
  const system = buildSystem(renderMemories(await loadMemories(AGENT), AGENT), focusNote(ctx.roster, focusClientId));

  const messages: Anthropic.MessageParam[] = history.map((m) => ({ role: m.role, content: m.content }));

  for (let i = 0; i < 8; i++) {
    markConversationCache(messages);
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      system,
      tools: ALL_TOOLS,
      messages,
    });
    const toolUses = resp.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (resp.stop_reason !== "tool_use" || toolUses.length === 0) {
      const text = resp.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("")
        .trim();
      return { reply: text || "(no answer)" };
    }
    messages.push({ role: "assistant", content: resp.content });
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      let out: unknown;
      try {
        out = await runTool(tu.name, (tu.input ?? {}) as Record<string, unknown>, ctx);
      } catch (e) {
        out = { error: e instanceof Error ? e.message : String(e) };
      }
      results.push({
        type: "tool_result",
        tool_use_id: tu.id,
        content: JSON.stringify(out).slice(0, 80000),
      });
    }
    messages.push({ role: "user", content: results });
  }
  return { reply: "I wasn't able to finish that — try narrowing the question to a specific account." };
}

function statusLabel(name: string, input: Record<string, unknown>): string {
  const acc = typeof input?.account === "string" ? input.account : "";
  switch (name) {
    case "dispatch_build": return "Building the campaign (atomic, paused, verified)…";
    case "list_proposals": return "Listing proposals…";
    case "decide_proposal": return "Recording your decision…";
    case "apply_proposal": return "Applying the change (guardrails re-checked)…";
    case "dry_run_proposal": return "Dry-running the change…";
    case "remember": return "Committing that to memory…";
    case "revise_memory": return "Updating what I know…";
    case "forget": return "Forgetting that…";
    case "run_audit": return "Preparing the audit document…";
    case "list_accounts": return "Listing accounts…";
    case "get_account_report": return `Reading ${acc || "account"}…`;
    case "get_all_account_summaries": return "Scanning all accounts…";
    case "get_recent_changes": return `Checking ${acc || "account"} changes…`;
    case "get_search_terms": return `Pulling ${acc || "account"} search terms…`;
    case "get_feed_audit": return `Auditing ${acc || "account"} feed…`;
    case "propose_optimization": return `Filing proposal${acc ? ` for ${acc}` : ""}…`;
    default: return "Working…";
  }
}

// Streaming variant: emits status events as tools run and delta events as the
// answer is generated. Same tool-use loop as runAgentChat.
export async function runAgentChatStream(
  history: ChatMessage[],
  actor: string,
  emitRaw: (ev: AgentEvent) => void,
  focusClientId?: string | null,
): Promise<void> {
  // The no-em-dash ruling is enforced in code, not just asked of the prompt.
  const scrub = makeEmDashScrubber();
  const emit = (ev: AgentEvent) =>
    emitRaw(ev.type === "delta" && ev.text ? { ...ev, text: scrub(ev.text) } : ev);
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    emit({ type: "delta", text: "The assistant isn't configured (no ANTHROPIC_API_KEY)." });
    emit({ type: "done" });
    return;
  }
  const client = new Anthropic({ apiKey });
  const ctx: ToolContext = { roster: await loadRoster(), actor };
  // Memory is read fresh each turn, so a memory written a moment ago is already
  // in scope, and it is scoped to Oscar so Bernard's notes never leak in.
  const system = buildSystem(renderMemories(await loadMemories(AGENT), AGENT), focusNote(ctx.roster, focusClientId));
  const messages: Anthropic.MessageParam[] = history.map((m) => ({ role: m.role, content: m.content }));

  try {
    for (let i = 0; i < 8; i++) {
      markConversationCache(messages);
      const stream = client.messages.stream({
        model: MODEL,
        // Was 2000, which truncated a long analysis mid-sentence. Bernard runs
        // far higher; Oscar needs room to lay out a build spec or a full read.
        max_tokens: 8000,
        system,
        tools: ALL_TOOLS,
        messages,
      });
      let turnText = "";
      stream.on("text", (t) => {
        turnText += t;
        emit({ type: "delta", text: t });
      });
      const final = await stream.finalMessage();
      const toolUses = final.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
      if (final.stop_reason !== "tool_use" || toolUses.length === 0) {
        emit({ type: "done" });
        return;
      }
      messages.push({ role: "assistant", content: final.content });
      // Drop "let me check…" preamble, never the answer. Oscar writes his reply
      // and only then calls remember/revise_memory to file it; an unconditional
      // reset there deleted the whole reply and left the closing line alone.
      if (isPreamble(turnText, toolUses)) emit({ type: "reset" });
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const tu of toolUses) {
        emit({ type: "status", text: statusLabel(tu.name, (tu.input ?? {}) as Record<string, unknown>) });
        let out: unknown;
        try {
          out = await runTool(tu.name, (tu.input ?? {}) as Record<string, unknown>, ctx);
        } catch (e) {
          out = { error: e instanceof Error ? e.message : String(e) };
        }
        // A prepared audit gets a first-class download chip in the panel.
        const dl = out as { download_path?: string; account?: { company?: unknown } } | null;
        if (tu.name === "run_audit" && dl?.download_path) {
          const who = typeof dl.account?.company === "string" ? dl.account.company : "account";
          emit({ type: "artifact", text: dl.download_path, label: `Download the ${who} Google Ads audit (.docx)` });
        }
        results.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(out).slice(0, 80000) });
      }
      messages.push({ role: "user", content: results });
    }
    emit({ type: "delta", text: "\n\n(Stopped after several steps — try narrowing the question.)" });
    emit({ type: "done" });
  } catch (e) {
    emit({ type: "error", text: e instanceof Error ? e.message : String(e) });
  }
}

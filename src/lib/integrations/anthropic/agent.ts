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
import { logAgentUsage } from "@/lib/agent-usage";
import { consumeFeedback, renderFeedback } from "@/lib/agent-feedback";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getDashboard, classifyChange } from "@/lib/integrations/google-ads/reporting";
import { gaqlSearch, gaqlSearchAll, listManagedAccounts } from "@/lib/integrations/google-ads";
import {
  CAMPAIGN_LIST_CAP, CHANGE_EVENT_LIMIT, CHANGE_EVENTS_SHOWN, CHANGE_HISTORY_MAX_DAYS,
  capList, deriveWindow, fourWeekWindows, tabulateChanges, clientTypeLabel, editorKind,
  removedSummary, joinConversionConfig, labelAccess, customerIdOf,
  type ConversionActionConfig, type ChangeEventIn, type WindowTotals,
} from "@/lib/oscar-reads";
import { getFeedAudit } from "@/lib/integrations/google-ads/feed";
import { getCommandCenter } from "@/lib/command-center";
import { createProposal, decideProposal, listProposals, type ProposalType, type ProposalStatus } from "@/lib/proposals";
import { applyProposal, dryRunProposal } from "@/lib/proposals-execute";
import { reviewProposal } from "@/lib/norbert-review";
import { buildGoogleCampaign, type GoogleBuildSpec } from "@/lib/integrations/google-ads/build";
import { entityConfig } from "@/lib/config";
import { makeEmDashScrubber } from "@/lib/emdash";
import type { Attachment } from "@/lib/attachments";

const AGENT = "oscar";
const MODEL = "claude-sonnet-5";

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
  // End-of-response marker, emitted by the ROUTE after the agent returns, never
  // by the agent itself. A client that reaches end-of-stream without seeing it
  // knows the reply was truncated (process feedback 2026-08-26, item 2).
  | { type: "complete" }
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
    description: "List an account's campaigns INCLUDING PAUSED ones, independent of recent activity: name, id, status, serving status, type, bidding strategy type and any target, daily budget in account currency, whether the budget is shared, start and end dates. Pages the whole account; when the list is cut at the cap the result says truncated:true with the total, so narrow with status or name_contains rather than treating the returned rows as the whole account. Use this to find the EXACT campaign name to target for a proposal and to verify a budget or bidding setting. Always confirm the exact campaign name here before filing an executable proposal.",
    input_schema: {
      type: "object",
      properties: {
        account: { type: "string", description: "Client name, client id, or Google customer id" },
        status: { type: "string", enum: ["ALL", "ENABLED", "PAUSED"], description: "Filter by campaign status (default ALL non-removed). Use PAUSED to list only paused campaigns." },
        name_contains: { type: "string", description: "Case-insensitive substring filter on the campaign name (e.g. 'Everpure')." },
      },
      required: ["account"],
    },
  },
  {
    name: "get_account_report",
    description: "Full performance snapshot for ONE account this week vs prior: KPIs (incl. by-time + ROAS/AOV), by-channel, impression-share suite, top campaigns, conversions-by-action WITH each action's configuration (primary flag, origin, category, counting, include-in-conversions) and a double-count risk flag, top search terms, top ads, device split. Pass windows: 4 to also get four consecutive complete weeks with their dates: two windows cannot tell a fall from a return to normal, so any claim about a break needs four. Use for 'how is <client> doing' and to justify/refute optimisations.",
    input_schema: {
      type: "object",
      properties: {
        account: { type: "string", description: "Client name or id (from list_accounts)" },
        windows: { type: "number", enum: [1, 4], description: "1 (default) = this week vs prior week. 4 = also return four consecutive complete Monday to Sunday weeks, each with spend, clicks, conversions, revenue and derived CPA/ROAS/AOV." },
      },
      required: ["account"],
    },
  },
  {
    name: "get_all_account_summaries",
    description: "Headline KPIs (spend/conv/CPA/ROAS + deltas), open alerts, and health status for EVERY account, plus per-currency agency totals. Use for cross-account questions (where am I wasting budget, reallocate budget, which campaign/account to pause).",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_recent_changes",
    description: "The account's Google Ads change history for ONE account, with attribution: every event carries its timestamp, the user email, the client type (web interface, API, Editor, automated rule, script, Recommendations Auto-Apply), resource type, operation, changed fields and campaign; REMOVE events carry what was removed. Returns the tabulation by editor (user email x client type, each labelled ours / shared founder-freelancer login / other / system), by resource and operation, by campaign, plus the most recent events in full. Tabulate this BEFORE judging how an account is run: our own login and Auto-Apply often account for most of the count. The API serves about 30 days; ask for days up to 29. Pass campaign to scope to one campaign.",
    input_schema: {
      type: "object",
      properties: {
        account: { type: "string", description: "Client name or id" },
        days: { type: "number", description: "Look-back window in days ending today (default 7, max 29: the API keeps roughly 30 days)." },
        campaign: { type: "string", description: "Optional exact campaign name or id to scope the history to one campaign." },
      },
      required: ["account"],
    },
  },
  {
    name: "get_account_access",
    description: "Who holds an account: the users with access (email, role, since, invited by, each labelled ours / shared founder-freelancer login / other), pending access invitations, and the manager accounts linked above it (with whether each is our own MCC). Read-only. Each of the three reads reports its own error when it cannot be read (user access needs admin rights on the account), so an empty list with an error next to it is NOT evidence of nobody having access. Use with get_recent_changes (who edits) before saying who runs an account.",
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
            "To make the proposal EXECUTABLE (gives it an Apply button), include an `action` object — exactly ONE operation per proposal (one op per approval; NO batching). For multiple negatives or criteria, file SEPARATE proposals, one each. Every campaign-scoped action's `campaign` field must be an EXACT campaign name or id from list_campaigns (do NOT guess). For an account-wide shared negative use add_shared_negative (NO campaign). If you cannot pin a change to its exact entity, OMIT `action` entirely and file it as ADVISORY — never emit an action with a missing or invented entity reference.",
          properties: {
            action: {
              type: "object",
              description:
                "campaign negative: {kind:'add_negative_keyword', campaign, level:'campaign'|'ad_group', adGroup?, text:'<one keyword>', matchType:'EXACT'|'PHRASE'|'BROAD'}. " +
                "shared/account-level negative (attaches to all Search campaigns): {kind:'add_shared_negative', text, matchType}. " +
                "pause: {kind:'pause_campaign', campaign} | {kind:'pause_ad_group', campaign, adGroup} | {kind:'pause_ad', campaign, adGroup, adId:'<numeric ad id>'}. " +
                "budget: {kind:'set_campaign_budget', campaign, newDailyAmount:<number in account currency>}. " +
                "shared set link, covering negative keyword lists AND brand lists (PMax brand exclusions): {kind:'attach_shared_set'|'detach_shared_set', campaign, sharedSet:'<exact shared set name or id>'}. " +
                "campaign criterion: {kind:'add_campaign_criterion'|'remove_campaign_criterion', campaign, criterionType:'location'|'negative_location'|'language', constantId:'<geo target or language constant id, digits only>'}. " +
                "bidding: {kind:'set_bidding_strategy', campaign, strategy:'MAXIMIZE_CONVERSIONS'|'MAXIMIZE_CONVERSION_VALUE'|'TARGET_SPEND'|'MANUAL_CPC', targetCpa?:<currency units, MAXIMIZE_CONVERSIONS only>, targetRoas?:<a multiple like 3.5, MAXIMIZE_CONVERSION_VALUE only>}. A campaign on a PORTFOLIO bidding strategy is refused by the worker; say so rather than proposing one. " +
                "Merchant Center feed overlay (feed-layer ONLY, one attribute per proposal, reversal is one delete): {kind:'mc_set_title', merchantId, offerId, contentLanguage, feedLabel, title:<1-150 chars>} or {kind:'mc_set_price', merchantId, offerId, contentLanguage, feedLabel, amount:<currency units>, currency:'GBP'}. Identity fields must match the feed EXACTLY (feed labels are not always country codes; resolve them from a product read, never guess). The worker refuses a merchant id the client's own shopping campaigns do not use. " +
                "Listing-group tree surgery (Standard Shopping ONLY, single-level trees only, the rendered before/after tree diff is the approval surface): exclude products {kind:'lg_exclude_product', campaign, adGroup, dimension:{type:'item_id'|'brand'|'product_type_l1'|'custom_label_0'..'custom_label_4', value}}; performance-tier split of a flat all-products tree {kind:'lg_split', campaign, adGroup, dimensionType, tiers:[{value, cpcBid:<currency units>}...], othersBid:<currency units, REQUIRED: the everything-else node always survives with an explicit bid>}. Trees subdivided beyond one level, cross-dimension exclusions, and PMax filter trees are refused; say so rather than improvising.",
              properties: {
                kind: { type: "string", enum: ["add_negative_keyword", "add_shared_negative", "pause_campaign", "set_campaign_budget", "pause_ad_group", "pause_ad", "attach_shared_set", "detach_shared_set", "add_campaign_criterion", "remove_campaign_criterion", "set_bidding_strategy", "mc_set_title", "mc_set_price", "lg_exclude_product", "lg_split"] },
                campaign: { type: "string" },
                level: { type: "string", enum: ["campaign", "ad_group"] },
                adGroup: { type: "string" },
                adId: { type: "string" },
                text: { type: "string" },
                matchType: { type: "string", enum: ["EXACT", "PHRASE", "BROAD"] },
                newDailyAmount: { type: "number" },
                sharedSet: { type: "string" },
                criterionType: { type: "string", enum: ["location", "negative_location", "language"] },
                constantId: { type: "string" },
                strategy: { type: "string", enum: ["MAXIMIZE_CONVERSIONS", "MAXIMIZE_CONVERSION_VALUE", "TARGET_SPEND", "MANUAL_CPC"] },
                targetCpa: { type: "number" },
                targetRoas: { type: "number" },
                merchantId: { type: "string" },
                offerId: { type: "string" },
                contentLanguage: { type: "string" },
                feedLabel: { type: "string" },
                title: { type: "string" },
                amount: { type: "number" },
                currency: { type: "string" },
                dimension: { type: "object", properties: { type: { type: "string", enum: ["item_id", "brand", "product_type_l1", "custom_label_0", "custom_label_1", "custom_label_2", "custom_label_3", "custom_label_4"] }, value: { type: "string" } }, required: ["type", "value"] },
                dimensionType: { type: "string", enum: ["item_id", "brand", "product_type_l1", "custom_label_0", "custom_label_1", "custom_label_2", "custom_label_3", "custom_label_4"] },
                tiers: { type: "array", items: { type: "object", properties: { value: { type: "string" }, cpcBid: { type: "number" } }, required: ["value", "cpcBid"] } },
                othersBid: { type: "number" },
              },
            },
            revision_of: {
              type: "string",
              description: "ONLY when correcting a proposal Norbert objected to: the id of the objected proposal. One revision round exists; a revision of a revision is reviewed but its verdict is final.",
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
- Resolve accounts with list_accounts (you can reference an account by name OR its Google customer id). Use get_account_report for one account (windows: 4 when judging any rise or fall, since two windows cannot tell a fall from a return to normal), get_all_account_summaries for cross-account questions, get_recent_changes for what was changed and BY WHOM (tabulate by editor before judging an account; our own login and Recommendations Auto-Apply are not the client's changes), get_account_access for who holds an account, get_search_terms for real query data, get_feed_audit for Shopping/feed (ecommerce) questions, and list_campaigns to get the EXACT campaign names (including paused ones) before filing any executable proposal.
- Figures are ACCOUNT-WIDE across all channel types. Attribute correctly — never call Performance Max / Shopping activity "Search", never call product/listing groups "keywords". Search impression share and search terms are Search-only. Two conversion bases exist (interaction date vs by-time); don't conflate them.
- Respect each account's own currency; never sum across currencies.
- Don't narrate your tool use ("let me check…", "I'll look that up"); just call the tools, then give the answer.

YOUR JOB:
- Be concise, specific and actionable — a senior analyst talking to a peer. Lead with the answer, then the evidence.
- Never use an em dash, in anything you write: chat, drafts, documents, headings. Use a full stop, comma, colon or parentheses instead (en dashes only inside numeric ranges, like 45-54). The founder has ruled on this; anything you hand him must already comply.
- Anything drafted in the founder's voice (client messages, freelancer instructions) is first person SINGULAR: I, me, my. Never the agency "we/us/our", even where it feels natural ("we cut the videos"). Ruled 2026-08-03. Sweep the draft for "we" before handing it over.
- You may PROPOSE optimisations (negatives to add, budget reallocations, RSA improvements, campaigns/ad groups to pause) with clear, figure-backed rationale. But you CANNOT execute anything.
- When the user asks you to PROPOSE something (or you've found a concrete change worth formalising), call propose_optimization to file it as a reviewable card, then tell the user it is filed. The founder can approve and apply WITHOUT leaving this chat: on his explicit word, decide_proposal records the approval and apply_proposal executes it behind the same guardrails as the Proposals page. Offer dry_run_proposal when he hesitates. NEVER claim a change was made unless apply_proposal returned success; execution authority is his word, never your inference.
- NORBERT REVIEWS EVERY PROPOSAL YOU FILE, in code, before the founder sees it (since 2026-09-03). The propose_optimization result carries his verdict and any flags (thrashing entity, recent human changes, unreadable change history). Report the verdict to the founder as it is. If Norbert objects, do not argue in chat: either accept the objection in one sentence, or file ONE corrected proposal with details.revision_of set to the objected proposal's id. There is no third round. His verdict is advice; the founder decides, and an unreviewed proposal cannot be approved.
- For the executable actions, include the precise details.action block so the proposal can be applied behind the approval gate. The kinds you can execute (widened 2026-09-03, founder-ruled): negatives (campaign, ad-group, or account-wide shared), pause at campaign, AD GROUP and AD level, campaign daily budget, attach or detach a SHARED SET (negative keyword lists and brand lists, which is how a PMax brand exclusion is applied), add or remove a campaign CRITERION (location, negative location, language, by constant id), and SET BIDDING STRATEGY (type and target; portfolio-strategy campaigns are refused by the worker). ONE operation per proposal, never a batch. Resolve the exact entity first: list_campaigns for campaign names, and never invent an ad id, shared set name or constant id. Detaching a shared set and changing bidding are consequential (they widen delivery or reset bidding learning); say so in the rationale so the founder decides with that in view. Conversion action create/edit is NOT executable yet; file those as advisory.
- LISTING-GROUP TREES (lg_exclude_product, lg_split, the last and most dangerous optimise surface): Standard Shopping ad groups only, single-level trees only, and the dry run renders the COMPLETE before and after trees. Never summarise a tree change in prose alone: show the founder both rendered trees from the dry run, and check yourself that the everything-else node appears in the after tree included with a bid, because a tree without it silently stops the rest of the catalog serving. Refusals (nested trees, cross-dimension edits, PMax) are the surface working; relay them as they are.
- MERCHANT CENTER OVERLAYS (mc_set_title, mc_set_price, founder-ruled 2026-08-26): feed-layer only, never the store; one attribute per proposal; the reversal is one delete after which the primary feed's value returns. Resolve the product identity (offerId, contentLanguage, feedLabel) from real data before filing, never from memory: feed labels are frequently not country codes. The dry run is a full read pass (the Merchant API has no server-side validate) and states any one-time overlay-source linkage the apply would perform; put that in front of the founder plainly. After an apply, Merchant Center composes asynchronously, so a read-back that lags minutes behind an accepted write is pending, not failed; say which.
- NEGATIVE KEYWORDS: before proposing ANY negative keyword, call get_search_terms and cite the actual wasted queries (meaningful cost, zero/low conversions). Never invent a query. If get_search_terms returns nothing, say so and do not fabricate one. If a wasted query is spending across many Search campaigns, file a shared negative (add_shared_negative); if it is confined to one campaign, file a campaign-level add_negative_keyword against that exact campaign.
- If asked whether an optimisation is needed and you think NOT, prove it with the figures.
- dispatch_build creates a full campaign from a spec: SEARCH, STANDARD SHOPPING or DSA (widened 2026-09-03, founder-ruled). Campaign PAUSED always, atomic (all or nothing), gates in code, result verified by re-read. You CAN build from this chat. Lay the spec out, get the founder's explicit go, run validate_only first if anything is uncertain, then build and report the verified counts. The founder activates; you never do. Shopping needs the linked merchant_id and its listing-group tree ships as one all-products root (subdividing it is a separate surface; do not promise tiered trees). DSA needs the site domain and webpage targets. PMax and Demand Gen builds do not exist here; say so rather than improvising.

Operating doctrine, adopted 2026-08-18 from a reviewed external field study:
- Every operating report OPENS with problems ranked by money at stake, stated explicitly, before any narrative. "Client X is losing £Y/week" outranks "client Z could use £50 more". A status-shaped report is a failed report.
- Before recommending any change to a campaign, ad group or ad, state that entity's recent change history (what, when, by whom). Four or more changes in 7 days means the entity is thrashing, and a thrashing entity needs stability, not another move; every change must be worth the learning reset it causes. On freelancer-managed accounts his changes count exactly as yours do, and a recommendation that would reverse his recent change says so by name; the founder arbitrates, never you.
- Never act on immature intraday data; any judgement made mid-day on partial numbers carries an explicit immature-data caveat, stated where the founder will read it.
- Memory stores principles and lessons, never volatile facts. A budget, a status, a count or a spend figure is re-read live every run. The memory tool refuses entries that look like volatile facts; that refusal is correct, restate the lesson without the number.
- When an answer rests on inference from naming, structure or a partial sample rather than a direct read, say so in the answer itself, unprompted. "The names suggest X but I have not read it" is a complete sentence and it has already prevented a mis-set Demand Gen goal; the silent version of the same inference picked the wrong one.
- Your account reporting can lag Google's own UI by up to three days, and a zero in a stale window reads exactly like a zero in a live one. EVERY answer that cites report data states the window it covers, and any conclusion about the last three days carries that caveat explicitly. Twice in August a stale window produced a confident wrong answer about an event the data had not caught up with.
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
    { type: "text", text: SYSTEM_BASE, cache_control: { type: "ephemeral", ttl: "1h" } },
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
      "Build a complete campaign in a client's Google Ads account from a spec. Three types (campaign.type): 'search' (default; ad groups with keywords and responsive search ads), 'shopping' (Standard Shopping: needs merchant_id, optional campaign_priority 0-2 and feed_label; each ad group gets one product ad and a root all-products listing group, and bidding is manual_cpc, maximize_clicks or target_roas, never maximize_conversions; subdividing the listing-group tree is a separate surface, do not promise it), 'dsa' (Dynamic Search Ads: needs dsa.domain, optional dsa.language; each ad group takes webpage_targets with conditions and dsa_ads carrying description lines, Google generates headlines and landing pages). Every type: one atomic operation (it fully exists or nothing does), the CAMPAIGN always created PAUSED regardless of the spec (the founder activates; everything inside is enabled so activation is one action), result verified by re-reading counts. Gates in code: global write kill switch, customer allowlist, budget hard cap, operation budget, duplicate-name refusal. ONLY call this when the founder has explicitly told you to build a SPECIFIC spec laid out in this conversation. Offer validate_only first when anything is uncertain: it runs Google's full server-side validation and changes NOTHING. Performance Max and Demand Gen are deliberately not buildable; say so plainly if asked.",
    input_schema: {
      type: "object",
      properties: {
        account: { type: "string", description: "Customer id (digits or formatted); resolve via list_accounts" },
        build_ref: { type: "string", description: "Unique reference for this build, e.g. vip-national-2026-08-01; recorded in the audit trail" },
        validate_only: { type: "boolean", description: "true = Google validates the full build server-side, creating nothing. Use as the dry run before a real build." },
        campaign: {
          type: "object",
          description: "The spec agreed with the founder. daily_budget and target_cpa/cpc_bid in account currency units; target_roas a multiple like 3.5. geo takes geo target constant ids or GB shorthand. schedule optional. Search ads: 3-15 headlines (max 30 chars), 2-4 descriptions (max 90 chars), final_url. Shopping ad groups: name and cpc_bid only. DSA ad groups: webpage_targets (conditions of operand URL|CATEGORY|PAGE_TITLE|PAGE_CONTENT|CUSTOM_LABEL and argument) plus dsa_ads (description max 90 chars, optional description2).",
          properties: {
            type: { type: "string", enum: ["search", "shopping", "dsa"] },
            name: { type: "string" },
            daily_budget: { type: "number" },
            bidding: { type: "string", enum: ["maximize_conversions", "maximize_clicks", "manual_cpc", "target_roas"] },
            target_cpa: { type: "number" },
            target_roas: { type: "number" },
            merchant_id: { type: "string" },
            campaign_priority: { type: "number" },
            feed_label: { type: "string" },
            dsa: { type: "object", properties: { domain: { type: "string" }, language: { type: "string" } }, required: ["domain"] },
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
              webpage_targets: { type: "array", items: { type: "object", properties: {
                name: { type: "string" },
                conditions: { type: "array", items: { type: "object", properties: { operand: { type: "string", enum: ["URL", "CATEGORY", "PAGE_TITLE", "PAGE_CONTENT", "CUSTOM_LABEL"] }, argument: { type: "string" } }, required: ["operand", "argument"] } },
              }, required: ["name", "conditions"] } },
              dsa_ads: { type: "array", items: { type: "object", properties: { description: { type: "string" }, description2: { type: "string" } }, required: ["description"] } },
            }, required: ["name"] } },
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
      const statusIn = String(input.status ?? "ALL").toUpperCase();
      const statusFilter = statusIn === "ENABLED" || statusIn === "PAUSED" ? statusIn : "ALL";
      const needle = String(input.name_contains ?? "").trim().toLowerCase();
      const where = statusFilter === "ALL" ? "campaign.status != 'REMOVED'" : `campaign.status = '${statusFilter}'`;
      // Paged read, never one page: on a large account the first page of an
      // alphabetical list is all "AM |" names and the rest is invisible.
      const { rows, truncated: pageCut } = await gaqlSearchAll(
        acc.reportingId,
        `SELECT campaign.id, campaign.name, campaign.status, campaign.serving_status, campaign.advertising_channel_type,
                campaign.bidding_strategy_type, campaign.bidding_strategy, campaign.start_date_time, campaign.end_date_time,
                campaign.target_roas.target_roas, campaign.maximize_conversion_value.target_roas,
                campaign.target_cpa.target_cpa_micros, campaign.maximize_conversions.target_cpa_micros,
                campaign_budget.amount_micros, campaign_budget.explicitly_shared, campaign_budget.name,
                customer.currency_code
         FROM campaign WHERE ${where} ORDER BY campaign.status, campaign.name`,
      );
      let currency: string | undefined;
      const all = rows.map((r) => {
        const c = (r.campaign ?? {}) as Record<string, unknown>;
        const b = (r.campaignBudget ?? {}) as Record<string, unknown>;
        currency ??= ((r.customer ?? {}) as { currencyCode?: string }).currencyCode;
        const micros = (v: unknown) => (v == null ? null : Number(Number(v) / 1e6));
        const tRoas = (c.targetRoas as { targetRoas?: number } | undefined)?.targetRoas
          ?? (c.maximizeConversionValue as { targetRoas?: number } | undefined)?.targetRoas ?? null;
        const tCpa = micros((c.targetCpa as { targetCpaMicros?: unknown } | undefined)?.targetCpaMicros
          ?? (c.maximizeConversions as { targetCpaMicros?: unknown } | undefined)?.targetCpaMicros);
        return {
          id: String(c.id), name: String(c.name ?? ""), status: c.status, servingStatus: c.servingStatus, type: c.advertisingChannelType,
          biddingStrategyType: c.biddingStrategyType ?? null,
          portfolioStrategy: c.biddingStrategy ? String(c.biddingStrategy) : null,
          targetRoas: tRoas || null, targetCpa: tCpa || null,
          dailyBudget: micros(b.amountMicros), budgetShared: b.explicitlyShared === true, budgetName: b.explicitlyShared === true ? (b.name ?? null) : undefined,
          startDate: c.startDateTime ?? null, endDate: c.endDateTime ?? null,
        };
      });
      const filtered = needle ? all.filter((x) => x.name.toLowerCase().includes(needle)) : all;
      const cut = capList(filtered, CAMPAIGN_LIST_CAP);
      return {
        company: acc.company, customerId: acc.reportingId, currency: currency ?? null,
        filter: { status: statusFilter, name_contains: needle || null },
        totalCampaigns: cut.total, returned: cut.items.length, truncated: cut.truncated || pageCut,
        ...(cut.truncated || pageCut ? { note: `Only ${cut.items.length} of ${cut.total} campaigns are listed. Narrow with status or name_contains; do not treat this list as the whole account.` } : {}),
        note_budget: "dailyBudget is in the account currency (micros divided out). budgetShared true means the budget is shared with other campaigns and its name is given.",
        campaigns: cut.items,
      };
    }
    case "get_account_report": {
      const acc = resolveAccount(ctx.roster, String(input.account ?? ""));
      if (!acc) return { error: `No account matches "${input.account}". Call list_accounts.` };
      const dash = await getDashboard(acc.clientId, acc.reportingId, { kind: "week" });
      const report = compactReport(acc.company, dash) as Record<string, unknown>;

      // Conversion action configuration joined onto the reported actions, so
      // single-source versus double-counted is judged from one read.
      try {
        const cfgRows = await gaqlSearch(
          acc.reportingId,
          `SELECT conversion_action.id, conversion_action.name, conversion_action.status, conversion_action.type,
                  conversion_action.category, conversion_action.origin, conversion_action.primary_for_goal,
                  conversion_action.counting_type, conversion_action.include_in_conversions_metric,
                  conversion_action.value_settings.default_value, conversion_action.value_settings.always_use_default_value,
                  conversion_action.attribution_model_settings.attribution_model
           FROM conversion_action WHERE conversion_action.status != 'REMOVED'`,
        );
        const config: ConversionActionConfig[] = cfgRows.map((r) => {
          const c = (r.conversionAction ?? {}) as Record<string, unknown>;
          const vs = (c.valueSettings ?? {}) as Record<string, unknown>;
          const am = (c.attributionModelSettings ?? {}) as Record<string, unknown>;
          return {
            id: String(c.id), name: String(c.name ?? ""), status: (c.status as string) ?? null, type: (c.type as string) ?? null,
            category: (c.category as string) ?? null, origin: (c.origin as string) ?? null,
            primaryForGoal: typeof c.primaryForGoal === "boolean" ? c.primaryForGoal : null,
            countingType: (c.countingType as string) ?? null,
            includeInConversionsMetric: typeof c.includeInConversionsMetric === "boolean" ? c.includeInConversionsMetric : null,
            defaultValue: vs.defaultValue == null ? null : Number(vs.defaultValue),
            alwaysUseDefaultValue: typeof vs.alwaysUseDefaultValue === "boolean" ? vs.alwaysUseDefaultValue : null,
            attributionModel: (am.attributionModel as string) ?? null,
          };
        });
        const joined = joinConversionConfig(dash.byConversionAction, config);
        report.conversionsByAction = joined.actions;
        const idle = config.filter((c) => !dash.byConversionAction.some((a) => a.action.trim().toLowerCase() === c.name.trim().toLowerCase()));
        report.conversionActionsNotInWindow = {
          total: idle.length,
          actions: idle.slice(0, 60).map((c) => ({ name: c.name, status: c.status, category: c.category, origin: c.origin, primaryForGoal: c.primaryForGoal, includeInConversionsMetric: c.includeInConversionsMetric })),
        };
        report.conversionActionsUnmatched = joined.unmatched;
        report.conversionActionsSharingAName = joined.duplicateNames;
        report.doubleCountRisk = joined.doubleCountRisk;
        report.note_conversions = "primaryForGoal true and includeInConversionsMetric true is what bidding optimises to. Two primary actions in one category both carrying value is a double-count RISK to check (origins, tags, whether they fire on the same event), not a verdict. Reported conversions are keyed by action NAME, so where several actions share one name (conversionActionsSharingAName) their conversions are already merged in the report and the attached config is the first of them.";
      } catch (e) {
        report.conversionActionConfig = { error: `could not read conversion action configuration: ${e instanceof Error ? e.message : String(e)}` };
      }

      // Four consecutive complete weeks on request (the four-window rule).
      if (Number(input.windows) === 4) {
        try {
          const wins = fourWeekWindows(dash.weekly.start, dash.weekly.end);
          const totals = await Promise.all(wins.map(async (w) => {
            const rows = await gaqlSearch(
              acc.reportingId,
              `SELECT metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions, metrics.conversions_value,
                      metrics.conversions_by_conversion_date, metrics.conversions_value_by_conversion_date
               FROM customer WHERE segments.date BETWEEN '${w.start}' AND '${w.end}'`,
            );
            const t: WindowTotals = { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0, conversionsByTime: 0, revenueByTime: 0 };
            for (const r of rows) {
              const m = (r.metrics ?? {}) as Record<string, unknown>;
              const n = (v: unknown) => Number(v ?? 0) || 0;
              t.spend += n(m.costMicros) / 1e6; t.impressions += n(m.impressions); t.clicks += n(m.clicks);
              t.conversions += n(m.conversions); t.revenue += n(m.conversionsValue);
              t.conversionsByTime += n(m.conversionsByConversionDate); t.revenueByTime += n(m.conversionsValueByConversionDate);
            }
            return { ...w, ...deriveWindow(t) };
          }));
          report.fourWindows = totals;
          report.note_windows = "Four consecutive complete Monday to Sunday weeks, account-wide, all channel types, click-date basis (byTime fields are conversion-date basis). Compare all four before calling anything a fall or a rise.";
        } catch (e) {
          report.fourWindows = { error: `could not build the four windows: ${e instanceof Error ? e.message : String(e)}` };
        }
      }
      return report;
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
      const days = Math.min(CHANGE_HISTORY_MAX_DAYS, Math.max(1, Math.round(Number(input.days) || 7)));
      const ymd = (d: Date) => d.toISOString().slice(0, 10);
      const end = new Date();
      const start = new Date(end.getTime() - (days - 1) * 86_400_000);
      const campRows = await gaqlSearch(acc.reportingId, "SELECT campaign.id, campaign.name, campaign.advertising_channel_type FROM campaign");
      const nameById: Record<string, string> = {};
      const channelById: Record<string, string> = {};
      for (const r of campRows) {
        const c = (r.campaign ?? {}) as { id?: string | number; name?: string; advertisingChannelType?: string };
        if (c.id != null) { nameById[String(c.id)] = c.name ?? ""; channelById[String(c.id)] = c.advertisingChannelType ?? ""; }
      }
      let scope = "";
      const campRef = String(input.campaign ?? "").trim();
      if (campRef) {
        const digits = campRef.replace(/\D/g, "");
        const id = digits.length >= 6 && /^[\d\s-]+$/.test(campRef)
          ? digits
          : Object.entries(nameById).find(([, n]) => n.toLowerCase() === campRef.toLowerCase())?.[0];
        if (!id) return { error: `No campaign matching "${campRef}" in ${acc.company}. Use list_campaigns for the exact name or id.` };
        scope = ` AND change_event.campaign = 'customers/${acc.reportingId}/campaigns/${id}'`;
      }
      // Two reads. The tabulation reads every event in the window WITHOUT the
      // resource bodies (7,000 events with bodies took 43 seconds live); the
      // detail read fetches bodies only for the events shown in full.
      const where = `WHERE change_event.change_date_time >= '${ymd(start)} 00:00:00'
             AND change_event.change_date_time <= '${ymd(end)} 23:59:59'${scope}`;
      const light = `change_event.change_date_time, change_event.user_email, change_event.client_type,
                  change_event.change_resource_type, change_event.resource_change_operation, change_event.changed_fields,
                  change_event.campaign, change_event.change_resource_name`;
      let rows: Record<string, unknown>[];
      let detailRows: Record<string, unknown>[];
      let pageCut = false;
      try {
        const [all, detail] = await Promise.all([
          gaqlSearchAll(acc.reportingId, `SELECT ${light} FROM change_event ${where} ORDER BY change_event.change_date_time DESC LIMIT ${CHANGE_EVENT_LIMIT}`, CHANGE_EVENT_LIMIT),
          gaqlSearch(acc.reportingId, `SELECT ${light}, change_event.old_resource, change_event.new_resource FROM change_event ${where} ORDER BY change_event.change_date_time DESC LIMIT ${CHANGE_EVENTS_SHOWN}`),
        ]);
        rows = all.rows; pageCut = all.truncated; detailRows = detail;
      } catch (e) {
        // Fail closed: an unreadable history is reported as unreadable, never as quiet.
        return { company: acc.company, window: { start: ymd(start), end: ymd(end), days }, readable: false, error: `change history could not be read: ${e instanceof Error ? e.message : String(e)}` };
      }
      const campName = (res: string) => { const id = (res.match(/campaigns\/(\d+)/) ?? [])[1]; return (id && nameById[id]) || res; };
      const toEvent = (r: Record<string, unknown>): ChangeEventIn => {
        const ce = (r.changeEvent ?? {}) as Record<string, unknown>;
        return {
          at: String(ce.changeDateTime ?? ""), user: (ce.userEmail as string) ?? null, clientType: (ce.clientType as string) ?? null,
          resourceType: (ce.changeResourceType as string) ?? null, op: (ce.resourceChangeOperation as string) ?? null,
          fields: (ce.changedFields as string) ?? null, campaign: (ce.campaign as string) ?? null,
          resourceName: (ce.changeResourceName as string) ?? null, oldResource: ce.oldResource, newResource: ce.newResource,
        };
      };
      const events = rows.map(toEvent);
      const own = (process.env.GOOGLE_ADS_OWN_LOGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
      const shared = (process.env.GOOGLE_ADS_SHARED_LOGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
      const tab = tabulateChanges(events, own, shared, campName);
      const truncated = pageCut || rows.length >= CHANGE_EVENT_LIMIT;
      const recent = detailRows.map(toEvent).map((e) => {
        const campId = (e.campaign?.match(/campaigns\/(\d+)/) ?? [])[1];
        const action = classifyChange(
          { changeResourceType: e.resourceType ?? undefined, resourceChangeOperation: e.op ?? undefined, changedFields: e.fields ?? undefined, newResource: (e.newResource ?? undefined) as Record<string, Record<string, unknown>> | undefined },
          campId ? channelById[campId] : undefined,
        );
        return {
          at: e.at, user: e.user || null, editor: editorKind(e.user, own, shared), via: clientTypeLabel(e.clientType),
          resourceType: e.resourceType, op: e.op, fields: e.fields ? e.fields.slice(0, 200) : null,
          campaign: e.campaign ? campName(e.campaign) : null, resource: e.resourceName, action,
          ...(e.op === "REMOVE" ? { removed: removedSummary(e.oldResource) } : {}),
        };
      });
      return {
        company: acc.company, customerId: acc.reportingId,
        window: { start: ymd(start), end: ymd(end), days, apiLimit: "change_event serves about the last 30 days" },
        readable: true, total: tab.total, truncated,
        ...(truncated ? { note: `The API cap of ${CHANGE_EVENT_LIMIT} events was hit; the total is at least this. Narrow the window or scope to a campaign.` } : {}),
        byEditor: tab.byEditor, autoApplyCount: tab.autoApplyCount, humanUsers: tab.humanUsers,
        byResourceOp: tab.byResourceOp.slice(0, 30), byCampaign: tab.byCampaign.slice(0, 40),
        earliestAt: tab.earliestAt, latestAt: tab.latestAt,
        recentEvents: recent,
        agencyLogins: own, sharedFounderFreelancerLogins: shared,
        note_reading: "Judge the account only after reading byEditor: changes under our own login and Recommendations Auto-Apply are not the client's or the freelancer's. A REMOVE carries what was removed in `removed`.",
      };
    }
    case "get_account_access": {
      const acc = resolveAccount(ctx.roster, String(input.account ?? ""));
      if (!acc) return { error: `No account matches "${input.account}". Call list_accounts.` };
      const own = (process.env.GOOGLE_ADS_OWN_LOGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
      const shared = (process.env.GOOGLE_ADS_SHARED_LOGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
      const ourMcc = (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ?? "").replace(/\D/g, "");
      const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));
      const read = async <T,>(q: string, shape: (r: Record<string, unknown>) => T): Promise<{ rows: T[] } | { error: string }> => {
        try { return { rows: (await gaqlSearch(acc.reportingId, q)).map(shape) }; } catch (e) { return { error: errText(e) }; }
      };
      const [customer, users, invitations, managers] = await Promise.all([
        read("SELECT customer.id, customer.descriptive_name, customer.manager, customer.status, customer.currency_code, customer.time_zone, customer.conversion_tracking_setting.google_ads_conversion_customer FROM customer LIMIT 1", (r) => {
          const c = (r.customer ?? {}) as Record<string, unknown>;
          const cts = (c.conversionTrackingSetting ?? {}) as Record<string, unknown>;
          return { id: String(c.id ?? ""), name: c.descriptiveName ?? null, isManager: c.manager === true, status: c.status ?? null, currency: c.currencyCode ?? null, timeZone: c.timeZone ?? null, conversionTrackingOwner: customerIdOf(cts.googleAdsConversionCustomer as string) };
        }),
        read("SELECT customer_user_access.user_id, customer_user_access.email_address, customer_user_access.access_role, customer_user_access.access_creation_date_time, customer_user_access.inviter_user_email_address FROM customer_user_access", (r) => {
          const u = (r.customerUserAccess ?? {}) as Record<string, unknown>;
          return { email: String(u.emailAddress ?? ""), role: (u.accessRole as string) ?? null, since: (u.accessCreationDateTime as string) ?? null, invitedBy: (u.inviterUserEmailAddress as string) ?? null };
        }),
        read("SELECT customer_user_access_invitation.email_address, customer_user_access_invitation.access_role, customer_user_access_invitation.creation_date_time, customer_user_access_invitation.invitation_status FROM customer_user_access_invitation", (r) => {
          const u = (r.customerUserAccessInvitation ?? {}) as Record<string, unknown>;
          return { email: String(u.emailAddress ?? ""), role: (u.accessRole as string) ?? null, createdAt: (u.creationDateTime as string) ?? null, status: (u.invitationStatus as string) ?? null };
        }),
        read("SELECT customer_manager_link.manager_customer, customer_manager_link.manager_link_id, customer_manager_link.status FROM customer_manager_link", (r) => {
          const l = (r.customerManagerLink ?? {}) as Record<string, unknown>;
          const managerId = customerIdOf(l.managerCustomer as string);
          return { managerCustomerId: managerId, status: (l.status as string) ?? null, ours: !!ourMcc && managerId === ourMcc };
        }),
      ]);
      return {
        company: acc.company, customerId: acc.reportingId,
        customer: "rows" in customer ? customer.rows[0] ?? null : { error: customer.error },
        users: "rows" in users ? labelAccess(users.rows, own, shared) : { error: users.error, note: "Not readable from our login (customer_user_access needs admin access on the account). This is NOT evidence that nobody has access." },
        pendingInvitations: "rows" in invitations ? invitations.rows : { error: invitations.error },
        managerLinks: "rows" in managers ? managers.rows : { error: managers.error },
        ourMccId: ourMcc || null, agencyLogins: own, sharedFounderFreelancerLogins: shared,
        note: "Holder = who has user access (roles ADMIN, STANDARD, READ_ONLY, EMAIL_ONLY) plus which managers link above. Billing ownership is not readable here. Join with get_recent_changes to see who actually edits.",
      };
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
      // Norbert reviews before the founder sees the card (spec §9). Awaited so
      // Oscar can carry the verdict into his reply instead of learning it later.
      const isRevision = typeof (input.details as Record<string, unknown> | undefined)?.revision_of === "string";
      const review = await reviewProposal(res.id, isRevision ? "revision" : "filed", ctx.actor)
        .catch((e) => ({ error: e instanceof Error ? e.message : String(e), summary: "Norbert's review did not run; the card shows it unreviewed." }));
      return {
        ok: true,
        proposalId: res.id,
        norbert: review.summary,
        norbert_q2: "ok" in review ? review.record.q2 ?? null : null,
        message: `Proposal filed for ${acc.company} — pending the founder in the Proposals page, with Norbert's verdict on the card.`,
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
  const system = buildSystem(renderMemories(await loadMemories(AGENT), AGENT) + renderFeedback(await consumeFeedback(AGENT)), focusNote(ctx.roster, focusClientId));

  const messages: Anthropic.MessageParam[] = history.map((m) => ({ role: m.role, content: m.content }));

  for (let i = 0; i < 8; i++) {
    markConversationCache(messages);
    const resp = await client.messages.create({
      model: MODEL,
      // Sonnet 5 thinks by default and thinking spends from max_tokens. At
      // 8000 a hard question exhausted the whole budget inside thinking and
      // the visible reply came back empty. 32000 matches Bernard.
      max_tokens: 32000,
      output_config: { effort: "medium" },
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
    case "get_account_access": return `Reading who holds ${acc || "the account"}…`;
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
  attachments: Attachment[] = [],
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
  const system = buildSystem(renderMemories(await loadMemories(AGENT), AGENT) + renderFeedback(await consumeFeedback(AGENT)), focusNote(ctx.roster, focusClientId));
  const messages: Anthropic.MessageParam[] = history.map((m) => ({ role: m.role, content: m.content }));

  // Files ride on the turn they were sent with, as document blocks ahead of the
  // founder's text so Oscar reads them before the instruction about them.
  // Document blocks need no beta header, so this stays on client.messages.
  // Extracted text also lands in the stored transcript (see transcriptNote), so
  // it survives into later turns; a PDF does not, because we hold only the bytes
  // for the length of this request. Re-attach if a PDF is needed again later.
  if (attachments.length && messages.length) {
    const last = messages[messages.length - 1];
    const blocks: Anthropic.ContentBlockParam[] = attachments.map((a) =>
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

  const runUsage = { model: MODEL as string, turns: 0, tokensInUncached: 0, tokensCacheWrite: 0, tokensCacheRead: 0, tokensOut: 0 };
  const flushUsage = () => { void logAgentUsage(AGENT, focusClientId ?? "oscar", focusClientId ?? null, runUsage); };
  try {
    for (let i = 0; i < 8; i++) {
      markConversationCache(messages);
      const stream = client.messages.stream({
        model: MODEL,
        // Was 2000 (truncated mid-sentence), then 8000, which Sonnet 5's
        // default thinking exhausted on hard questions, returning an empty
        // reply. Thinking and text share this budget; 32000 matches Bernard.
        max_tokens: 32000,
        output_config: { effort: "medium" },
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
      runUsage.turns += 1;
      runUsage.tokensInUncached += final.usage?.input_tokens ?? 0;
      runUsage.tokensCacheWrite += (final.usage as { cache_creation_input_tokens?: number })?.cache_creation_input_tokens ?? 0;
      runUsage.tokensCacheRead += (final.usage as { cache_read_input_tokens?: number })?.cache_read_input_tokens ?? 0;
      runUsage.tokensOut += final.usage?.output_tokens ?? 0;
      runUsage.model = final.model || runUsage.model;
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
  } finally {
    flushUsage();
  }
}

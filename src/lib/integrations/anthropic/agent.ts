// Rexos chat agent — the "ask about your accounts" brain. Claude Opus 4.8 with
// READ-ONLY tools over the live data layer. It can analyse and PROPOSE
// optimisations, but it cannot execute anything (no mutate layer exists; every
// change is a recommendation for human approval).
import Anthropic from "@anthropic-ai/sdk";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getDashboard, getWeeklyOptimisations } from "@/lib/integrations/google-ads/reporting";
import { gaqlSearch, listManagedAccounts } from "@/lib/integrations/google-ads";
import { getFeedAudit } from "@/lib/integrations/google-ads/feed";
import { getCommandCenter } from "@/lib/command-center";
import { createProposal, type ProposalType } from "@/lib/proposals";
import { entityConfig } from "@/lib/config";

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
];

const SYSTEM = `You are Rexos, the ${entityConfig.brandName} paid-media ops analyst inside the PPC Ops Command Center. You help the agency team understand and optimise their Google Ads accounts.

HOW YOU WORK:
- Use the tools to fetch REAL figures. Never invent, estimate or recompute a number, %, campaign name or metric. If you don't have it, fetch it.
- Resolve accounts with list_accounts (you can reference an account by name OR its Google customer id). Use get_account_report for one account, get_all_account_summaries for cross-account questions, get_recent_changes for what was changed, get_search_terms for real query data, get_feed_audit for Shopping/feed (ecommerce) questions, and list_campaigns to get the EXACT campaign names (including paused ones) before filing any executable proposal.
- Figures are ACCOUNT-WIDE across all channel types. Attribute correctly — never call Performance Max / Shopping activity "Search", never call product/listing groups "keywords". Search impression share and search terms are Search-only. Two conversion bases exist (interaction date vs by-time); don't conflate them.
- Respect each account's own currency; never sum across currencies.
- Don't narrate your tool use ("let me check…", "I'll look that up"); just call the tools, then give the answer.

YOUR JOB:
- Be concise, specific and actionable — a senior analyst talking to a peer. Lead with the answer, then the evidence.
- You may PROPOSE optimisations (negatives to add, budget reallocations, RSA improvements, campaigns/ad groups to pause) with clear, figure-backed rationale. But you CANNOT execute anything.
- When the user asks you to PROPOSE something (or you've found a concrete change worth formalising), call propose_optimization to file it as a reviewable card, then tell the user it's filed for their approval in the Proposals page. NEVER claim you made or applied a change; approval/execution is the human's.
- For the executable actions — add a single (campaign or ad-group) negative keyword, add a shared/account-level negative, pause a campaign, set a campaign daily budget — include the precise details.action block so the proposal can be applied behind the approval gate. ONE operation per proposal: to add several negatives, file several proposals (one keyword each), never a batch. For a campaign-level negative, pause, or budget change, first call list_campaigns to get the EXACT campaign name. For a shared negative (no campaign), use the add_shared_negative action.
- NEGATIVE KEYWORDS: before proposing ANY negative keyword, call get_search_terms and cite the actual wasted queries (meaningful cost, zero/low conversions). Never invent a query. If get_search_terms returns nothing, say so and do not fabricate one. If a wasted query is spending across many Search campaigns, file a shared negative (add_shared_negative); if it is confined to one campaign, file a campaign-level add_negative_keyword against that exact campaign.
- If asked whether an optimisation is needed and you think NOT, prove it with the figures.`;

interface ToolContext { roster: RosterEntry[]; actor: string }
async function runTool(name: string, input: Record<string, unknown>, ctx: ToolContext): Promise<unknown> {
  switch (name) {
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
  const system = SYSTEM + focusNote(ctx.roster, focusClientId);

  const messages: Anthropic.MessageParam[] = history.map((m) => ({ role: m.role, content: m.content }));

  for (let i = 0; i < 8; i++) {
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system,
      tools: TOOLS,
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
  emit: (ev: AgentEvent) => void,
  focusClientId?: string | null,
): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    emit({ type: "delta", text: "The assistant isn't configured (no ANTHROPIC_API_KEY)." });
    emit({ type: "done" });
    return;
  }
  const client = new Anthropic({ apiKey });
  const ctx: ToolContext = { roster: await loadRoster(), actor };
  const system = SYSTEM + focusNote(ctx.roster, focusClientId);
  const messages: Anthropic.MessageParam[] = history.map((m) => ({ role: m.role, content: m.content }));

  try {
    for (let i = 0; i < 8; i++) {
      const stream = client.messages.stream({
        model: MODEL,
        max_tokens: 2000,
        system,
        tools: TOOLS,
        messages,
      });
      stream.on("text", (t) => emit({ type: "delta", text: t }));
      const final = await stream.finalMessage();
      const toolUses = final.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
      if (final.stop_reason !== "tool_use" || toolUses.length === 0) {
        emit({ type: "done" });
        return;
      }
      messages.push({ role: "assistant", content: final.content });
      emit({ type: "reset" }); // drop any "let me check…" preamble from this tool turn
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const tu of toolUses) {
        emit({ type: "status", text: statusLabel(tu.name, (tu.input ?? {}) as Record<string, unknown>) });
        let out: unknown;
        try {
          out = await runTool(tu.name, (tu.input ?? {}) as Record<string, unknown>, ctx);
        } catch (e) {
          out = { error: e instanceof Error ? e.message : String(e) };
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

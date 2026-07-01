// Rexos chat agent — the "ask about your accounts" brain. Claude Opus 4.8 with
// READ-ONLY tools over the live data layer. It can analyse and PROPOSE
// optimisations, but it cannot execute anything (no mutate layer exists; every
// change is a recommendation for human approval).
import Anthropic from "@anthropic-ai/sdk";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getDashboard, getWeeklyOptimisations } from "@/lib/integrations/google-ads/reporting";
import { gaqlSearch } from "@/lib/integrations/google-ads";
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
  | { type: "done" }
  | { type: "error"; text: string };

// ---- Account roster + resolution (cheap; DB only, no GAQL) ----
interface RosterEntry { clientId: string; reportingId: string; company: string; status: string }
async function loadRoster(): Promise<RosterEntry[]> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("onboarding_state")
    .select("client_id, google_ads_customer_id, google_ads_reporting_customer_id, clients(company_name, status)")
    .eq("ad_link_status", "approved")
    .not("google_ads_customer_id", "is", null);
  return (data ?? []).map((r) => ({
    clientId: r.client_id as string,
    reportingId: (r.google_ads_reporting_customer_id ?? r.google_ads_customer_id) as string,
    company: (r.clients as unknown as { company_name?: string } | null)?.company_name ?? "(unnamed)",
    status: (r.clients as unknown as { status?: string } | null)?.status ?? "",
  }));
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
            "To make the proposal EXECUTABLE (gives it an Apply button), include an `action` object — exactly ONE operation per proposal (one op per approval; NO batching). For multiple negatives, file SEPARATE proposals, one keyword each. The `campaign` field is REQUIRED and must be an EXACT campaign name from list_campaigns (do NOT guess). If you cannot identify a specific campaign, or the change is account-level / shared-negative-list (no single campaign), OMIT `action` entirely and file it as ADVISORY — never emit an action with a missing or invented campaign.",
          properties: {
            action: {
              type: "object",
              description:
                "negatives: {kind:'add_negative_keyword', campaign, level:'campaign'|'ad_group', adGroup?, text:'<one keyword>', matchType:'EXACT'|'PHRASE'|'BROAD'}. pause: {kind:'pause_campaign', campaign}. budget: {kind:'set_campaign_budget', campaign, newDailyAmount:<number in account currency>}.",
              properties: {
                kind: { type: "string", enum: ["add_negative_keyword", "pause_campaign", "set_campaign_budget"] },
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
- Resolve accounts with list_accounts (you can reference an account by name OR its Google customer id). Use get_account_report for one account, get_all_account_summaries for cross-account questions, get_recent_changes for what was changed, and list_campaigns to get the EXACT campaign names (including paused ones) before filing any executable proposal.
- Figures are ACCOUNT-WIDE across all channel types. Attribute correctly — never call Performance Max / Shopping activity "Search", never call product/listing groups "keywords". Search impression share and search terms are Search-only. Two conversion bases exist (interaction date vs by-time); don't conflate them.
- Respect each account's own currency; never sum across currencies.
- Don't narrate your tool use ("let me check…", "I'll look that up"); just call the tools, then give the answer.

YOUR JOB:
- Be concise, specific and actionable — a senior analyst talking to a peer. Lead with the answer, then the evidence.
- You may PROPOSE optimisations (negatives to add, budget reallocations, RSA improvements, campaigns/ad groups to pause) with clear, figure-backed rationale. But you CANNOT execute anything.
- When the user asks you to PROPOSE something (or you've found a concrete change worth formalising), call propose_optimization to file it as a reviewable card, then tell the user it's filed for their approval in the Proposals page. NEVER claim you made or applied a change; approval/execution is the human's.
- For the three executable actions — add a single negative keyword, pause a campaign, set a campaign daily budget — first call list_campaigns to get the EXACT campaign name, then include the precise details.action block (with that exact campaign) so the proposal can be applied behind the approval gate. ONE operation per proposal: to add several negatives, file several proposals (one keyword each), never a batch. If the change is account-level / a shared negative list, or you cannot pin it to a specific campaign, file it as ADVISORY (omit details.action) rather than emitting an action with no campaign.
- If asked whether an optimisation is needed and you think NOT, prove it with the figures.`;

interface ToolContext { roster: RosterEntry[]; actor: string }
async function runTool(name: string, input: Record<string, unknown>, ctx: ToolContext): Promise<unknown> {
  switch (name) {
    case "list_accounts":
      return ctx.roster.map((r) => ({ clientId: r.clientId, company: r.company, customerId: r.reportingId, status: r.status }));
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
      const dash = await getDashboard(acc.clientId, acc.reportingId, 7);
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
      const dash = await getDashboard(acc.clientId, acc.reportingId, 7);
      const changes = await getWeeklyOptimisations(acc.reportingId, dash.weekly.start, dash.weekly.end);
      return { company: acc.company, period: dash.weekly, changes: changes.length ? changes : ["No account changes logged this week."] };
    }
    case "propose_optimization": {
      const acc = resolveAccount(ctx.roster, String(input.account ?? ""));
      if (!acc) return { error: `No account matches "${input.account}". Call list_accounts.` };
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
): Promise<{ reply: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { reply: "The assistant isn't configured (no ANTHROPIC_API_KEY)." };
  const client = new Anthropic({ apiKey });
  const ctx: ToolContext = { roster: await loadRoster(), actor };

  const messages: Anthropic.MessageParam[] = history.map((m) => ({ role: m.role, content: m.content }));

  for (let i = 0; i < 8; i++) {
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system: SYSTEM,
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
): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    emit({ type: "delta", text: "The assistant isn't configured (no ANTHROPIC_API_KEY)." });
    emit({ type: "done" });
    return;
  }
  const client = new Anthropic({ apiKey });
  const ctx: ToolContext = { roster: await loadRoster(), actor };
  const messages: Anthropic.MessageParam[] = history.map((m) => ({ role: m.role, content: m.content }));

  try {
    for (let i = 0; i < 8; i++) {
      const stream = client.messages.stream({
        model: MODEL,
        max_tokens: 2000,
        system: SYSTEM,
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

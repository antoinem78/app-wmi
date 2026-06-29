// Rexos chat agent — the "ask about your accounts" brain. Claude Opus 4.8 with
// READ-ONLY tools over the live data layer. It can analyse and PROPOSE
// optimisations, but it cannot execute anything (no mutate layer exists; every
// change is a recommendation for human approval).
import Anthropic from "@anthropic-ai/sdk";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getDashboard, getWeeklyOptimisations } from "@/lib/integrations/google-ads/reporting";
import { getCommandCenter } from "@/lib/command-center";
import { entityConfig } from "@/lib/config";

const MODEL = "claude-opus-4-8";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

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
  return (
    roster.find((r) => r.clientId === ref) ??
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
    description: "List all managed accounts (name, id, status). Use to resolve a client name or see what's available. Cheap; no metrics.",
    input_schema: { type: "object", properties: {} },
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
];

const SYSTEM = `You are Rexos, the ${entityConfig.brandName} paid-media ops analyst inside the PPC Ops Command Center. You help the agency team understand and optimise their Google Ads accounts.

HOW YOU WORK:
- Use the tools to fetch REAL figures. Never invent, estimate or recompute a number, %, campaign name or metric. If you don't have it, fetch it.
- Resolve client names with list_accounts. Use get_account_report for one account, get_all_account_summaries for cross-account questions, get_recent_changes for what was changed.
- Figures are ACCOUNT-WIDE across all channel types. Attribute correctly — never call Performance Max / Shopping activity "Search", never call product/listing groups "keywords". Search impression share and search terms are Search-only. Two conversion bases exist (interaction date vs by-time); don't conflate them.
- Respect each account's own currency; never sum across currencies.

YOUR JOB:
- Be concise, specific and actionable — a senior analyst talking to a peer. Lead with the answer, then the evidence.
- You may PROPOSE optimisations (negatives to add, budget reallocations, RSA improvements, campaigns/ad groups to pause) with clear, figure-backed rationale. But you CANNOT execute anything — present every change as a recommendation for the human to review and apply. NEVER claim you made or applied a change.
- If asked whether an optimisation is needed and you think NOT, prove it with the figures.`;

interface ToolContext { roster: RosterEntry[] }
async function runTool(name: string, input: Record<string, unknown>, ctx: ToolContext): Promise<unknown> {
  switch (name) {
    case "list_accounts":
      return ctx.roster.map((r) => ({ clientId: r.clientId, company: r.company, status: r.status }));
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
    default:
      return { error: `Unknown tool ${name}` };
  }
}

export async function runAgentChat(history: ChatMessage[]): Promise<{ reply: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { reply: "The assistant isn't configured (no ANTHROPIC_API_KEY)." };
  const client = new Anthropic({ apiKey });
  const ctx: ToolContext = { roster: await loadRoster() };

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

// Norbert's review of one Oscar proposal (BERNARD_OPTIMISE_SPEC §9, built
// 2026-09-03). Runs when Oscar files a proposal, when the founder presses Ask
// Norbert on the card, and when Oscar files a revision. Same two questions as
// the Meta leg, same one revision round, same fail-closed reading of change
// history, and metered under Norbert's name like every other run.
//
// Norbert sees the entity and its change history, not Oscar's argument: he
// reviews what is there and what is missing. He runs on a different model
// family from Oscar on purpose (spec §6).
import Anthropic from "@anthropic-ai/sdk";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { gaqlSearch } from "@/lib/integrations/google-ads";
import { parseAction, type ExecAction } from "@/lib/integrations/google-ads/write";
import { logAgentUsage } from "@/lib/agent-usage";
import { leaveFeedback } from "@/lib/agent-feedback";
import { logActivity } from "@/lib/activity";
import {
  assessHistory, parseVerdict, revisionRound, summariseReview,
  THRASH_WINDOW_DAYS, type ChangeRow, type ReviewRecord,
} from "@/lib/norbert-review-rules";

const MODEL = "claude-fable-5";
const AGENT = "norbert";

export type ReviewTrigger = "filed" | "founder" | "revision";
export type ReviewOutcome = { ok: true; record: ReviewRecord; summary: string } | { error: string; summary: string };

type Row = {
  id: string; client_id: string; account_label: string | null; type: string; title: string;
  rationale: string | null; details: Record<string, unknown> | null; status: string;
  created_by: string | null; norbert_review: ReviewRecord | null;
};

const gaqlStr = (s: string) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
const num = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0)) || 0;

function ownLogins(): string[] {
  return (process.env.GOOGLE_ADS_OWN_LOGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}
/** Logins the founder shares with the freelancer: changes under them stay
 *  flagged as human (either person may have made them) but are labelled as
 *  shared so verdicts do not misattribute the author. */
function sharedLogins(): string[] {
  return (process.env.GOOGLE_ADS_SHARED_LOGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

async function customerFor(clientId: string): Promise<string | null> {
  const { data } = await createSupabaseAdminClient()
    .from("onboarding_state")
    .select("google_ads_customer_id, google_ads_reporting_customer_id")
    .eq("client_id", clientId)
    .single();
  if (!data) return null;
  return (data.google_ads_reporting_customer_id ?? data.google_ads_customer_id) as string | null;
}

function campaignPredicate(ref: string): string {
  const r = ref.trim();
  const digits = r.replace(/\D/g, "");
  if (digits.length >= 6 && /^[\d\s-]+$/.test(r)) return `campaign.id = ${digits}`;
  return `campaign.name = '${gaqlStr(r)}'`;
}

interface Evidence {
  campaign: Record<string, unknown> | null;
  history: ChangeRow[] | null;
  historyScope: "campaign" | "account" | "none";
}

// Read what Norbert needs to judge the proposal. Every read is best-effort and
// its absence is stated: a failed change-history read comes back as null so
// assessHistory fails closed, and a campaign that cannot be resolved is
// reported as such rather than silently omitted.
async function gatherEvidence(customerId: string, action: ExecAction | null): Promise<Evidence> {
  const ev: Evidence = { campaign: null, history: null, historyScope: "none" };
  const since = new Date(Date.now() - THRASH_WINDOW_DAYS * 86400_000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  let campaignResource: string | null = null;

  if (action && "campaign" in action) {
    try {
      const rows = await gaqlSearch(
        customerId,
        `SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type, campaign.resource_name,
                campaign_budget.amount_micros, campaign_budget.explicitly_shared,
                metrics.cost_micros, metrics.clicks, metrics.conversions, metrics.conversions_value
         FROM campaign WHERE ${campaignPredicate(action.campaign)} AND campaign.status != 'REMOVED'
           AND segments.date BETWEEN '${since}' AND '${today}'`,
      );
      if (rows.length === 0) {
        ev.campaign = { error: `no campaign matching "${action.campaign}"` };
      } else {
        const c = (rows[0].campaign ?? {}) as Record<string, unknown>;
        const b = (rows[0].campaignBudget ?? {}) as Record<string, unknown>;
        const m = { cost: 0, clicks: 0, conversions: 0, value: 0 };
        for (const r of rows) {
          const x = (r.metrics ?? {}) as Record<string, unknown>;
          m.cost += num(x.costMicros) / 1e6; m.clicks += num(x.clicks);
          m.conversions += num(x.conversions); m.value += num(x.conversionsValue);
        }
        campaignResource = String(c.resourceName ?? "");
        ev.campaign = {
          id: c.id, name: c.name, status: c.status, channel: c.advertisingChannelType,
          daily_budget: num(b.amountMicros) / 1e6, shared_budget: b.explicitlyShared === true,
          last_7d: { cost: +m.cost.toFixed(2), clicks: m.clicks, conversions: +m.conversions.toFixed(2), value: +m.value.toFixed(2) },
        };
      }
    } catch (e) {
      ev.campaign = { error: `campaign read failed: ${e instanceof Error ? e.message : String(e)}` };
    }
  }

  try {
    const scope = campaignResource ? `AND change_event.campaign = '${gaqlStr(campaignResource)}'` : "";
    const rows = await gaqlSearch(
      customerId,
      `SELECT change_event.change_date_time, change_event.user_email, change_event.resource_change_operation,
              change_event.changed_fields, change_event.change_resource_name, change_event.campaign
       FROM change_event
       WHERE change_event.change_date_time >= '${since} 00:00:00' AND change_event.change_date_time <= '${today} 23:59:59'
         ${scope}
       ORDER BY change_event.change_date_time DESC LIMIT 200`,
    );
    ev.history = rows.map((r) => {
      const ce = (r.changeEvent ?? {}) as Record<string, unknown>;
      const fields = ce.changedFields as { paths?: string[] } | string | undefined;
      return {
        at: String(ce.changeDateTime ?? ""),
        user: typeof ce.userEmail === "string" ? ce.userEmail : null,
        op: typeof ce.resourceChangeOperation === "string" ? ce.resourceChangeOperation : null,
        fields: typeof fields === "string" ? fields : fields?.paths?.join(",") ?? null,
        resource: typeof ce.changeResourceName === "string" ? ce.changeResourceName : null,
      };
    });
    ev.historyScope = campaignResource ? "campaign" : "account";
  } catch {
    ev.history = null;
  }
  return ev;
}

async function loadRow(id: string): Promise<Row | null> {
  const { data } = await createSupabaseAdminClient()
    .from("optimization_proposals")
    .select("id, client_id, account_label, type, title, rationale, details, status, created_by, norbert_review")
    .eq("id", id)
    .single();
  return (data as Row | null) ?? null;
}

async function store(id: string, record: ReviewRecord): Promise<void> {
  await createSupabaseAdminClient()
    .from("optimization_proposals")
    .update({ norbert_review: record, norbert_reviewed_at: record.at })
    .eq("id", id);
}

const SYSTEM = [
  "You are Norbert, the supervisor reviewing a proposed Google Ads change before the founder sees it. Oscar filed it; you do not see his reasoning beyond the stated rationale, deliberately.",
  "Answer two questions, separately and plainly. Plain text, no em dashes.",
  "Q1: Is this proposal wrong? Judge against the entity state and the change history given. A thrashing entity (four or more changes in seven days) needs stability, not another move, unless the proposal is itself the stabilising move. A recent change by a human other than the agency's own login must be named and the proposal must not silently reverse it. If the change history is marked unreadable, say the entity is unassessed and judge only what you can. If the proposal is wrong, say why in one or two sentences. If it is sound, begin your answer with the word SOUND.",
  "Q2: What is the biggest problem in this account or campaign that this proposal does NOT touch, judging from the evidence given? One short paragraph, specific. If the evidence is too thin to say, say that.",
  'Respond as JSON only: {"q1": "SOUND" | "<why it is wrong>", "q2": "..."}',
].join("\n");

export async function reviewProposal(id: string, trigger: ReviewTrigger, actor = "system"): Promise<ReviewOutcome> {
  const at = new Date().toISOString();
  const row = await loadRow(id);
  if (!row) return { error: "Proposal not found.", summary: "Proposal not found." };
  if (row.status !== "pending") return { error: `Only a pending proposal is reviewed (this one is ${row.status}).`, summary: "Not reviewed: not pending." };

  // Revision bookkeeping: Oscar may revise once after an objection.
  let parent: ReviewRecord | null = null;
  const revisionOf = typeof row.details?.revision_of === "string" ? row.details.revision_of : null;
  if (revisionOf) {
    const { data } = await createSupabaseAdminClient().from("optimization_proposals").select("norbert_review").eq("id", revisionOf).single();
    parent = ((data?.norbert_review as ReviewRecord) ?? { revision_round: 0 });
  }
  const { round, final } = revisionRound(parent);

  const fail = async (msg: string): Promise<ReviewOutcome> => {
    const record: ReviewRecord = { at, model: MODEL, trigger, revision_round: round, error: msg };
    await store(id, record);
    await logActivity({ clientId: row.client_id, eventType: "proposal_review_failed", actor: "norbert", payload: { proposal_id: id, error: msg, trigger } });
    return { error: msg, summary: summariseReview(record) };
  };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return fail("ANTHROPIC_API_KEY is not set on this deployment");

  const parsed = parseAction(row.details ?? {});
  const action: ExecAction | null = parsed && !("error" in parsed) ? parsed : null;
  const customerId = await customerFor(row.client_id);
  if (!customerId) return fail("no Google Ads account on this client");

  try {
    const ev = await gatherEvidence(customerId, action);
    const history = assessHistory(ev.history, ownLogins(), sharedLogins());
    const user = JSON.stringify({
      proposal: { type: row.type, title: row.title, rationale: row.rationale, action: action ?? row.details?.action ?? null, advisory_only: !action, filed_by: row.created_by },
      revision: revisionOf ? { revision_of: revisionOf, round, parent_objection: parent?.verdict?.q1 ?? null, final_round: final } : null,
      campaign: ev.campaign,
      change_history: {
        scope: ev.historyScope, window_days: THRASH_WINDOW_DAYS,
        readable: history.readable, changes: history.changes7d, thrashing: history.thrashing,
        human_users: history.humanUsers, rows: (ev.history ?? []).slice(0, 40),
      },
      agency_logins: ownLogins(),
      shared_founder_freelancer_logins: sharedLogins(),
    });

    const client = new Anthropic({ apiKey });
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: SYSTEM,
      messages: [{ role: "user", content: user }],
    });
    const u = resp.usage;
    void logAgentUsage(AGENT, `review:oscar:${id}`, row.client_id, {
      model: resp.model || MODEL, turns: 1,
      tokensInUncached: u?.input_tokens ?? 0,
      tokensCacheWrite: (u as { cache_creation_input_tokens?: number })?.cache_creation_input_tokens ?? 0,
      tokensCacheRead: (u as { cache_read_input_tokens?: number })?.cache_read_input_tokens ?? 0,
      tokensOut: u?.output_tokens ?? 0,
    });

    const text = resp.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const verdict = parseVerdict(text);
    if (!verdict) return fail("Norbert's reply could not be parsed as a verdict");

    const record: ReviewRecord = {
      at, model: resp.model || MODEL, trigger, revision_round: round,
      verdict: { sound: verdict.sound, q1: verdict.q1 }, q2: verdict.q2, history,
    };
    await store(id, record);
    const summary = summariseReview(record);
    await logActivity({
      clientId: row.client_id, eventType: "proposal_reviewed", actor: "norbert",
      payload: { proposal_id: id, sound: verdict.sound, thrashing: history.thrashing, human_users: history.humanUsers, trigger, revision_round: round, by: actor },
    });

    // The return leg is a duty (2026-08-26): an objection, a thrash flag or a
    // human-change flag reaches Oscar's inbox, not only the founder's card.
    if (!verdict.sound || history.thrashing || history.humanUsers.length || !history.readable) {
      const tail = final
        ? " This was the revision round; the verdict is final and the founder decides."
        : verdict.sound ? "" : ` You may file ONE corrected proposal with details.revision_of = "${id}", or accept the objection.`;
      await leaveFeedback("oscar", `[from Norbert's review] Proposal "${row.title}" (${row.account_label ?? "account"}, id ${id}): ${summary}${tail}`, "norbert").catch(() => {});
    }
    return { ok: true, record, summary };
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
}

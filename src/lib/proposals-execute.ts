// Rexos P5-Lite execution worker. The worker — NOT the UI — is the control
// boundary: it re-checks the approval record, enforces the kill switch +
// allowlists + caps, runs validate_only, then mutates, verifies the resulting
// state, writes an immutable audit entry, and exposes rollback.
//
// Flow (per the approved spec):
//   approved proposal -> worker re-check -> build op -> validate_only=true
//   -> mutate -> re-query/verify -> audit log -> rollback available.
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity";
import { gaqlSearch, googleAdsMutate } from "@/lib/integrations/google-ads";
import {
  parseAction, guardCustomer, guardCampaignWrite, guardBudget,
  negativeKeywordCreateOp, negativeKeywordRemoveOp, campaignStatusOp, budgetUpdateOp,
  type ExecAction,
} from "@/lib/integrations/google-ads/write";

const num = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0)) || 0;
const gaqlStr = (s: string) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

type Row = {
  id: string; client_id: string; account_label: string | null; type: string;
  title: string; status: string; details: Record<string, unknown> | null;
  execution: Record<string, unknown> | null;
};
type Result = { ok: true; [k: string]: unknown } | { error: string };

async function loadRow(id: string): Promise<Row | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("optimization_proposals")
    .select("id, client_id, account_label, type, title, status, details, execution")
    .eq("id", id)
    .single();
  return (data as Row) ?? null;
}
async function customerFor(clientId: string): Promise<string | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("onboarding_state")
    .select("google_ads_customer_id, google_ads_reporting_customer_id")
    .eq("client_id", clientId)
    .single();
  if (!data) return null;
  return (data.google_ads_reporting_customer_id ?? data.google_ads_customer_id) as string | null;
}

interface CampaignRef { id: string; name: string; status: string; budgetResourceName: string; budgetAmountMicros: number; budgetShared: boolean }
async function resolveCampaign(customerId: string, name: string): Promise<CampaignRef | { error: string }> {
  const rows = await gaqlSearch(
    customerId,
    `SELECT campaign.id, campaign.name, campaign.status, campaign_budget.id,
            campaign_budget.amount_micros, campaign_budget.explicitly_shared, campaign.campaign_budget
     FROM campaign WHERE campaign.name = '${gaqlStr(name)}' AND campaign.status != 'REMOVED'`,
  );
  if (rows.length === 0) return { error: `No campaign named "${name}".` };
  if (rows.length > 1) return { error: `"${name}" matches ${rows.length} campaigns — be exact.` };
  const c = (rows[0].campaign ?? {}) as { id?: string | number; name?: string; status?: string; campaignBudget?: string };
  const b = (rows[0].campaignBudget ?? {}) as { amountMicros?: string | number; explicitlyShared?: boolean };
  return {
    id: String(c.id), name: c.name ?? name, status: String(c.status ?? ""),
    budgetResourceName: c.campaignBudget ?? "",
    budgetAmountMicros: num(b.amountMicros), budgetShared: b.explicitlyShared === true,
  };
}
async function resolveAdGroup(customerId: string, name: string, campaignId: string): Promise<{ id: string } | { error: string }> {
  const rows = await gaqlSearch(
    customerId,
    `SELECT ad_group.id, ad_group.name FROM ad_group
     WHERE ad_group.name = '${gaqlStr(name)}' AND campaign.id = ${campaignId} AND ad_group.status != 'REMOVED'`,
  );
  if (rows.length === 0) return { error: `No ad group named "${name}" in that campaign.` };
  if (rows.length > 1) return { error: `Ad group "${name}" is ambiguous.` };
  return { id: String(((rows[0].adGroup ?? {}) as { id?: string | number }).id) };
}

function firstResourceName(resp: Awaited<ReturnType<typeof googleAdsMutate>>): string | undefined {
  const r = resp.mutateOperationResponses?.[0];
  if (!r) return undefined;
  for (const k of Object.keys(r)) {
    const v = r[k] as { resourceName?: string } | undefined;
    if (v && typeof v === "object" && typeof v.resourceName === "string") return v.resourceName;
  }
  return undefined;
}

// Resolve + guard + build the single mutate op + capture before-state. Shared by
// dry-run and apply so they validate identically.
async function prepare(customerId: string, action: ExecAction): Promise<
  { op: unknown; before: Record<string, unknown>; campaign?: CampaignRef } | { error: string }
> {
  const camp = await resolveCampaign(customerId, action.campaign);
  if ("error" in camp) return camp;

  if (action.kind === "add_negative_keyword") {
    if (action.level === "ad_group") {
      const ag = await resolveAdGroup(customerId, action.adGroup!, camp.id);
      if ("error" in ag) return ag;
      return {
        op: negativeKeywordCreateOp({ customerId, level: "ad_group", adGroupId: ag.id, text: action.text, matchType: action.matchType }),
        before: { adGroupId: ag.id, note: "criterion does not exist yet" },
        campaign: camp,
      };
    }
    return {
      op: negativeKeywordCreateOp({ customerId, level: "campaign", campaignId: camp.id, text: action.text, matchType: action.matchType }),
      before: { campaignId: camp.id, note: "criterion does not exist yet" },
      campaign: camp,
    };
  }

  if (action.kind === "pause_campaign") {
    const guard = guardCampaignWrite(camp.id);
    if (guard) return { error: guard };
    return { op: campaignStatusOp(customerId, camp.id, "PAUSED"), before: { campaignId: camp.id, status: camp.status }, campaign: camp };
  }

  // set_campaign_budget
  const guard = guardCampaignWrite(camp.id);
  if (guard) return { error: guard };
  if (camp.budgetShared) return { error: "Campaign uses a SHARED budget — out of scope for the spike." };
  if (!camp.budgetResourceName) return { error: "Could not resolve the campaign's budget." };
  const nextMicros = Math.round(action.newDailyAmount * 1_000_000);
  const budgetGuard = guardBudget(camp.budgetAmountMicros, nextMicros, action.confirmLargeDecrease === true);
  if (budgetGuard) return { error: budgetGuard };
  return {
    op: budgetUpdateOp(camp.budgetResourceName, nextMicros),
    before: { budgetResourceName: camp.budgetResourceName, amountMicros: camp.budgetAmountMicros },
    campaign: camp,
  };
}

// VALIDATE-ONLY dry run — proves the request server-side with zero change.
export async function dryRunProposal(id: string): Promise<Result> {
  const row = await loadRow(id);
  if (!row) return { error: "Proposal not found." };
  const action = parseAction(row.details ?? {});
  if (!action) return { error: "This proposal has no executable action." };
  if ("error" in action) return { error: action.error };
  const customerId = await customerFor(row.client_id);
  if (!customerId) return { error: "No Google Ads account for this client." };
  const cg = guardCustomer(customerId);
  if (cg) return { error: cg };
  const prep = await prepare(customerId, action);
  if ("error" in prep) return { error: prep.error };
  try {
    await googleAdsMutate(customerId, [prep.op], { validateOnly: true });
  } catch (e) {
    return { error: `validate_only failed: ${e instanceof Error ? e.message : String(e)}` };
  }
  await patch(id, { execution: { ...(row.execution ?? {}), lastValidate: { ok: true, op: prep.op, before: prep.before, at: new Date().toISOString() } } });
  return { ok: true, validated: true, before: prep.before, op: prep.op };
}

// APPLY — the real mutate, behind every guardrail. Worker re-checks approval.
export async function applyProposal(id: string, actor: string): Promise<Result> {
  const row = await loadRow(id);
  if (!row) return { error: "Proposal not found." };
  // STEP 4: the worker is the control boundary — never trust the UI.
  if (row.status !== "approved") return { error: `Proposal is ${row.status}, not approved — refusing.` };
  const action = parseAction(row.details ?? {});
  if (!action) return { error: "This proposal has no executable action." };
  if ("error" in action) return { error: action.error };
  const customerId = await customerFor(row.client_id);
  if (!customerId) return { error: "No Google Ads account for this client." };
  const cg = guardCustomer(customerId);
  if (cg) return { error: cg };
  const prep = await prepare(customerId, action);
  if ("error" in prep) return { error: prep.error };

  // validate_only first
  try {
    await googleAdsMutate(customerId, [prep.op], { validateOnly: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await patch(id, { status: "failed", execution: { ...(row.execution ?? {}), error: `validate: ${msg}`, op: prep.op } });
    await logActivity({ clientId: row.client_id, eventType: "proposal_apply_failed", actor: `admin:${actor}`, payload: { id, stage: "validate", error: msg } });
    return { error: `Validation failed (no change made): ${msg}` };
  }
  // real mutate
  let resp: Awaited<ReturnType<typeof googleAdsMutate>>;
  try {
    resp = await googleAdsMutate(customerId, [prep.op], { validateOnly: false });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await patch(id, { status: "failed", execution: { ...(row.execution ?? {}), error: `mutate: ${msg}`, op: prep.op } });
    await logActivity({ clientId: row.client_id, eventType: "proposal_apply_failed", actor: `admin:${actor}`, payload: { id, stage: "mutate", error: msg } });
    return { error: `Mutate failed: ${msg}` };
  }
  const resourceName = firstResourceName(resp);
  const after = await verify(customerId, action, prep, resourceName).catch(() => ({ note: "verify query failed" }));
  const execution = {
    ...(row.execution ?? {}),
    action, op: prep.op, before: prep.before, after, resourceName,
    appliedAt: new Date().toISOString(), appliedBy: actor,
  };
  await patch(id, { status: "applied", applied_at: new Date().toISOString(), applied_by: actor, execution });
  await logActivity({ clientId: row.client_id, eventType: "proposal_applied", actor: `admin:${actor}`, payload: { id, action: action.kind, before: prep.before, after, resourceName } });
  await alert(`✅ Rexos applied: *${row.title}* (${row.account_label}) by ${actor}. Verified: ${JSON.stringify(after)}`);
  return { ok: true, applied: true, before: prep.before, after, resourceName };
}

// ROLLBACK — inverse of the applied change, through the same gate.
export async function rollbackProposal(id: string, actor: string): Promise<Result> {
  const row = await loadRow(id);
  if (!row) return { error: "Proposal not found." };
  if (row.status !== "applied") return { error: `Only an applied proposal can be rolled back (is ${row.status}).` };
  const action = parseAction(row.details ?? {});
  if (!action || "error" in action) return { error: "Cannot parse the original action." };
  const customerId = await customerFor(row.client_id);
  if (!customerId) return { error: "No Google Ads account." };
  const cg = guardCustomer(customerId);
  if (cg) return { error: cg };
  const exec = (row.execution ?? {}) as Record<string, unknown>;

  let op: unknown;
  if (action.kind === "add_negative_keyword") {
    const rn = exec.resourceName as string | undefined;
    if (!rn) return { error: "No resource name stored — cannot remove the keyword." };
    op = negativeKeywordRemoveOp(action.level, rn);
  } else if (action.kind === "pause_campaign") {
    const before = exec.before as { campaignId?: string; status?: string } | undefined;
    if (!before?.campaignId) return { error: "No prior state stored." };
    op = campaignStatusOp(customerId, before.campaignId, (before.status as "ENABLED") ?? "ENABLED");
  } else {
    const before = exec.before as { budgetResourceName?: string; amountMicros?: number } | undefined;
    if (!before?.budgetResourceName) return { error: "No prior budget stored." };
    op = budgetUpdateOp(before.budgetResourceName, num(before.amountMicros));
  }
  try {
    await googleAdsMutate(customerId, [op], { validateOnly: true });
    await googleAdsMutate(customerId, [op], { validateOnly: false });
  } catch (e) {
    return { error: `Rollback failed: ${e instanceof Error ? e.message : String(e)}` };
  }
  await patch(id, { status: "rolled_back", rolled_back_at: new Date().toISOString(), rolled_back_by: actor, execution: { ...exec, rollbackOp: op, rolledBackAt: new Date().toISOString() } });
  await logActivity({ clientId: row.client_id, eventType: "proposal_rolled_back", actor: `admin:${actor}`, payload: { id, action: action.kind } });
  await alert(`↩️ Rexos rolled back: *${row.title}* (${row.account_label}) by ${actor}.`);
  return { ok: true, rolledBack: true };
}

async function verify(
  customerId: string, action: ExecAction,
  prep: { campaign?: CampaignRef }, resourceName?: string,
): Promise<Record<string, unknown>> {
  if (action.kind === "add_negative_keyword" && resourceName) {
    const res = action.level === "ad_group" ? "ad_group_criterion" : "campaign_criterion";
    const rows = await gaqlSearch(customerId, `SELECT ${res}.resource_name, ${res}.negative FROM ${res} WHERE ${res}.resource_name = '${gaqlStr(resourceName)}'`);
    return { exists: rows.length > 0, resourceName };
  }
  if (action.kind === "pause_campaign" && prep.campaign) {
    const rows = await gaqlSearch(customerId, `SELECT campaign.status FROM campaign WHERE campaign.id = ${prep.campaign.id}`);
    return { status: ((rows[0]?.campaign ?? {}) as { status?: string }).status };
  }
  if (action.kind === "set_campaign_budget" && prep.campaign) {
    const rows = await gaqlSearch(customerId, `SELECT campaign_budget.amount_micros FROM campaign WHERE campaign.id = ${prep.campaign.id}`);
    return { amountMicros: num(((rows[0]?.campaignBudget ?? {}) as { amountMicros?: string }).amountMicros) };
  }
  return {};
}

async function patch(id: string, fields: Record<string, unknown>): Promise<void> {
  const supabase = createSupabaseAdminClient();
  await supabase.from("optimization_proposals").update(fields).eq("id", id);
}
async function alert(text: string): Promise<void> {
  const channel = process.env.SLACK_OPS_CHANNEL ?? process.env.SLACK_REVIEW_CHANNEL;
  if (!process.env.SLACK_BOT_TOKEN || !channel) return;
  try {
    const { postMessage } = await import("@/lib/integrations/slack");
    await postMessage(channel, text);
  } catch {
    /* alerting is best-effort */
  }
}

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
import { gaqlSearch, googleAdsMutate, isUnderMcc } from "@/lib/integrations/google-ads";
import {
  parseAction, writeEnabled, guardAllowlist, guardCampaignWrite, guardBudget,
  negativeKeywordCreateOp, negativeKeywordRemoveOp, campaignStatusOp, budgetUpdateOp,
  sharedNegativeSetName, sharedSetCreateOp, sharedCriterionCreateOp,
  campaignSharedSetCreateOp, sharedCriterionRemoveOp,
  type ExecAction,
} from "@/lib/integrations/google-ads/write";
import { recordWriteAudit } from "@/lib/write-audit";

// Two independent scopes on EVERY write and validate:
//   1. MCC membership — a hard boundary verified against the live hierarchy;
//      enforced on dry-run too. No cross-MCC writes, ever.
//   2. Account allowlist — operational rollout control; skipped on dry-run so an
//      account can be validated before it's allowlisted. Lifted by ALLOW_ALL_MCC_ACCOUNTS.
// The kill switch gates both. Blocks + boundary violations are audit-logged here.
type Phase = "dry_run" | "apply" | "rollback";
async function guardWrite(
  customerId: string,
  phase: Phase,
  meta: { action?: string; approver?: string; clientId?: string },
): Promise<{ ok: true } | { error: string }> {
  const base = { phase, customerId, action: meta.action, approver: meta.approver, clientId: meta.clientId } as const;
  if (!writeEnabled()) {
    await recordWriteAudit({ ...base, mccCheck: "skipped", allowlistCheck: "skipped", result: "blocked", detail: { reason: "kill switch off" } });
    return { error: "Writes are disabled (kill switch off)." };
  }
  let member = false;
  try { member = await isUnderMcc(customerId); } catch { member = false; }
  if (!member) {
    await recordWriteAudit({ ...base, mccCheck: "fail", allowlistCheck: "skipped", result: "boundary_violation", detail: { reason: "target account is not under this deployment's MCC" } });
    return { error: `Customer ${customerId} is not under this deployment's MCC — refusing (boundary violation).` };
  }
  if (phase !== "dry_run") {
    const al = guardAllowlist(customerId);
    if (al) {
      await recordWriteAudit({ ...base, mccCheck: "ok", allowlistCheck: "fail", result: "blocked", detail: { reason: al } });
      return { error: al };
    }
  }
  return { ok: true };
}

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
// Accept the campaign as EITHER an exact name OR a numeric campaign id (the
// agent sometimes carries the id from list_campaigns) — a pure-digits value is
// resolved by id, everything else by name.
function idOrName(ref: string): { predicate: string; by: "id" | "name" } {
  const r = String(ref ?? "").trim();
  const digits = r.replace(/\D/g, "");
  if (digits.length >= 6 && /^[\d\s-]+$/.test(r)) return { predicate: `campaign.id = ${digits}`, by: "id" };
  return { predicate: `campaign.name = '${gaqlStr(r)}'`, by: "name" };
}
async function resolveCampaign(customerId: string, name: string): Promise<CampaignRef | { error: string }> {
  const { predicate, by } = idOrName(name);
  const rows = await gaqlSearch(
    customerId,
    `SELECT campaign.id, campaign.name, campaign.status, campaign_budget.id,
            campaign_budget.amount_micros, campaign_budget.explicitly_shared, campaign.campaign_budget
     FROM campaign WHERE ${predicate} AND campaign.status != 'REMOVED'`,
  );
  if (rows.length === 0) return { error: `No campaign matching "${name}" (by ${by}) in this account.` };
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
  const r = String(name ?? "").trim();
  const digits = r.replace(/\D/g, "");
  const predicate = digits.length >= 6 && /^[\d\s-]+$/.test(r) ? `ad_group.id = ${digits}` : `ad_group.name = '${gaqlStr(r)}'`;
  const rows = await gaqlSearch(
    customerId,
    `SELECT ad_group.id, ad_group.name FROM ad_group
     WHERE ${predicate} AND campaign.id = ${campaignId} AND ad_group.status != 'REMOVED'`,
  );
  if (rows.length === 0) return { error: `No ad group matching "${name}" in that campaign.` };
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

// Resolve + guard + build the mutate op(s) + capture before-state. Shared by
// dry-run and apply so they validate identically. `ops` is an array to support
// the multi-op (atomic) shared-negative action; the other actions are single-op.
// `rollbackResourceName` (optional) extracts the resource name to reverse from
// the multi-op response when firstResourceName() isn't the right one.
interface Prep {
  ops: unknown[];
  before: Record<string, unknown>;
  campaign?: CampaignRef;
  sharedSet?: string; // shared-set resource (for verify-after on add_shared_negative)
  rollbackResourceName?: (resp: Awaited<ReturnType<typeof googleAdsMutate>>) => string | undefined;
}

// Build the atomic multi-op mutate for an account-level shared negative:
// find-or-create the managed shared set, add the criterion, and attach the set to
// every enabled/paused Search campaign not already linked. Uses a temp resource
// name when the set must be created so all three ops reference it in one mutate.
async function prepareSharedNegative(
  customerId: string,
  action: Extract<ExecAction, { kind: "add_shared_negative" }>,
): Promise<Prep | { error: string }> {
  const name = sharedNegativeSetName();
  // 1. find-or-create the managed shared set
  const setRows = await gaqlSearch(
    customerId,
    `SELECT shared_set.resource_name, shared_set.name, shared_set.type, shared_set.status
     FROM shared_set
     WHERE shared_set.type = 'NEGATIVE_KEYWORDS' AND shared_set.name = '${gaqlStr(name)}'
       AND shared_set.status != 'REMOVED'`,
  );
  const existing = ((setRows[0]?.sharedSet ?? {}) as { resourceName?: string }).resourceName;
  const isNew = !existing;
  const TEMP = "-1";
  const setResource = existing ?? `customers/${customerId}/sharedSets/${TEMP}`;

  const ops: unknown[] = [];
  if (isNew) ops.push(sharedSetCreateOp(customerId, TEMP, name));
  const criterionIndex = ops.length; // the criterion op's position in the response
  ops.push(sharedCriterionCreateOp(setResource, action.text, action.matchType));

  // 2. attach the set to every enabled/paused Search campaign not already linked
  const campRows = await gaqlSearch(
    customerId,
    `SELECT campaign.id FROM campaign
     WHERE campaign.advertising_channel_type = 'SEARCH' AND campaign.status IN ('ENABLED', 'PAUSED')`,
  );
  const searchCampaignIds = campRows
    .map((r) => String(((r.campaign ?? {}) as { id?: string | number }).id ?? ""))
    .filter(Boolean);
  const alreadyLinked = new Set<string>();
  if (!isNew) {
    const linkRows = await gaqlSearch(
      customerId,
      `SELECT campaign_shared_set.campaign, campaign_shared_set.shared_set
       FROM campaign_shared_set WHERE campaign_shared_set.shared_set = '${gaqlStr(setResource)}'`,
    );
    for (const r of linkRows) {
      const camp = ((r.campaignSharedSet ?? {}) as { campaign?: string }).campaign;
      const cid = camp?.match(/campaigns\/(\d+)/)?.[1];
      if (cid) alreadyLinked.add(cid);
    }
  }
  const toAttach = searchCampaignIds.filter((cid) => !alreadyLinked.has(cid));
  for (const cid of toAttach) ops.push(campaignSharedSetCreateOp(customerId, cid, setResource));

  return {
    ops,
    before: {
      note: "shared negative not present yet",
      sharedSet: isNew ? "(to be created)" : setResource,
      searchCampaignsToAttach: toAttach.length,
    },
    sharedSet: isNew ? undefined : setResource,
    // The criterion resource name is what rollback removes (leave the set + links).
    rollbackResourceName: (resp) => {
      const r = resp.mutateOperationResponses?.[criterionIndex] as { sharedCriterionResult?: { resourceName?: string } } | undefined;
      if (r?.sharedCriterionResult?.resourceName) return r.sharedCriterionResult.resourceName;
      for (const rr of resp.mutateOperationResponses ?? []) {
        const v = (rr as { sharedCriterionResult?: { resourceName?: string } }).sharedCriterionResult;
        if (v?.resourceName) return v.resourceName;
      }
      return undefined;
    },
  };
}
async function prepare(customerId: string, action: ExecAction): Promise<Prep | { error: string }> {
  // Account-level shared negative — no campaign gate; MCC boundary + allowlist
  // (in guardWrite) are the controls. One atomic mutate: find-or-create the
  // managed shared set, add the criterion, attach the set to every Search campaign.
  if (action.kind === "add_shared_negative") {
    return prepareSharedNegative(customerId, action);
  }

  const camp = await resolveCampaign(customerId, action.campaign);
  if ("error" in camp) return camp;

  if (action.kind === "add_negative_keyword") {
    if (action.level === "ad_group") {
      const ag = await resolveAdGroup(customerId, action.adGroup!, camp.id);
      if ("error" in ag) return ag;
      return {
        ops: [negativeKeywordCreateOp({ customerId, level: "ad_group", adGroupId: ag.id, text: action.text, matchType: action.matchType })],
        before: { adGroupId: ag.id, note: "criterion does not exist yet" },
        campaign: camp,
      };
    }
    return {
      ops: [negativeKeywordCreateOp({ customerId, level: "campaign", campaignId: camp.id, text: action.text, matchType: action.matchType })],
      before: { campaignId: camp.id, note: "criterion does not exist yet" },
      campaign: camp,
    };
  }

  if (action.kind === "pause_campaign") {
    const guard = guardCampaignWrite(camp.id);
    if (guard) return { error: guard };
    return { ops: [campaignStatusOp(customerId, camp.id, "PAUSED")], before: { campaignId: camp.id, status: camp.status }, campaign: camp };
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
    ops: [budgetUpdateOp(camp.budgetResourceName, nextMicros)],
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
  const g = await guardWrite(customerId, "dry_run", { action: action.kind, clientId: row.client_id });
  if ("error" in g) return { error: g.error };
  const prep = await prepare(customerId, action);
  if ("error" in prep) return { error: prep.error };
  try {
    await googleAdsMutate(customerId, prep.ops, { validateOnly: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await recordWriteAudit({ phase: "dry_run", customerId, action: action.kind, clientId: row.client_id, mccCheck: "ok", allowlistCheck: "skipped", result: "failed", detail: { validate: msg } });
    return { error: `validate_only failed: ${msg}` };
  }
  await recordWriteAudit({ phase: "dry_run", customerId, action: action.kind, clientId: row.client_id, mccCheck: "ok", allowlistCheck: "skipped", result: "ok", detail: { before: prep.before } });
  await patch(id, { execution: { ...(row.execution ?? {}), lastValidate: { ok: true, ops: prep.ops, before: prep.before, at: new Date().toISOString() } } });
  return { ok: true, validated: true, before: prep.before, ops: prep.ops };
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
  const g = await guardWrite(customerId, "apply", { action: action.kind, approver: actor, clientId: row.client_id });
  if ("error" in g) return { error: g.error };
  const prep = await prepare(customerId, action);
  if ("error" in prep) return { error: prep.error };

  // validate_only first
  try {
    await googleAdsMutate(customerId, prep.ops, { validateOnly: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await patch(id, { status: "failed", execution: { ...(row.execution ?? {}), error: `validate: ${msg}`, ops: prep.ops } });
    await logActivity({ clientId: row.client_id, eventType: "proposal_apply_failed", actor: `admin:${actor}`, payload: { id, stage: "validate", error: msg } });
    await recordWriteAudit({ phase: "apply", customerId, action: action.kind, approver: actor, clientId: row.client_id, mccCheck: "ok", allowlistCheck: "ok", result: "failed", detail: { validate: msg } });
    return { error: `Validation failed (no change made): ${msg}` };
  }
  // real mutate
  let resp: Awaited<ReturnType<typeof googleAdsMutate>>;
  try {
    resp = await googleAdsMutate(customerId, prep.ops, { validateOnly: false });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await patch(id, { status: "failed", execution: { ...(row.execution ?? {}), error: `mutate: ${msg}`, ops: prep.ops } });
    await logActivity({ clientId: row.client_id, eventType: "proposal_apply_failed", actor: `admin:${actor}`, payload: { id, stage: "mutate", error: msg } });
    await recordWriteAudit({ phase: "apply", customerId, action: action.kind, approver: actor, clientId: row.client_id, mccCheck: "ok", allowlistCheck: "ok", result: "failed", detail: { mutate: msg } });
    return { error: `Mutate failed: ${msg}` };
  }
  const resourceName = prep.rollbackResourceName ? prep.rollbackResourceName(resp) : firstResourceName(resp);
  const after = await verify(customerId, action, prep, resourceName).catch(() => ({ note: "verify query failed" }));
  const execution = {
    ...(row.execution ?? {}),
    action, ops: prep.ops, before: prep.before, after, resourceName,
    appliedAt: new Date().toISOString(), appliedBy: actor,
  };
  await patch(id, { status: "applied", applied_at: new Date().toISOString(), applied_by: actor, execution });
  await recordWriteAudit({ phase: "apply", customerId, action: action.kind, approver: actor, clientId: row.client_id, mccCheck: "ok", allowlistCheck: "ok", result: "ok", detail: { before: prep.before, after, resourceName } });
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
  // Rollback is a write — it must clear the same MCC boundary + allowlist + kill switch.
  const g = await guardWrite(customerId, "rollback", { action: action.kind, approver: actor, clientId: row.client_id });
  if ("error" in g) return { error: g.error };
  const exec = (row.execution ?? {}) as Record<string, unknown>;

  let op: unknown;
  if (action.kind === "add_negative_keyword") {
    const rn = exec.resourceName as string | undefined;
    if (!rn) return { error: "No resource name stored — cannot remove the keyword." };
    op = negativeKeywordRemoveOp(action.level, rn);
  } else if (action.kind === "add_shared_negative") {
    // Remove ONLY the added shared criterion — leave the set and its campaign
    // links intact (they may hold other negatives).
    const rn = exec.resourceName as string | undefined;
    if (!rn) return { error: "No shared criterion resource name stored — cannot remove it." };
    op = sharedCriterionRemoveOp(rn);
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
    const msg = e instanceof Error ? e.message : String(e);
    await recordWriteAudit({ phase: "rollback", customerId, action: action.kind, approver: actor, clientId: row.client_id, mccCheck: "ok", allowlistCheck: "ok", result: "failed", detail: { error: msg } });
    return { error: `Rollback failed: ${msg}` };
  }
  await recordWriteAudit({ phase: "rollback", customerId, action: action.kind, approver: actor, clientId: row.client_id, mccCheck: "ok", allowlistCheck: "ok", result: "ok", detail: {} });
  await patch(id, { status: "rolled_back", rolled_back_at: new Date().toISOString(), rolled_back_by: actor, execution: { ...exec, rollbackOp: op, rolledBackAt: new Date().toISOString() } });
  await logActivity({ clientId: row.client_id, eventType: "proposal_rolled_back", actor: `admin:${actor}`, payload: { id, action: action.kind } });
  await alert(`↩️ Rexos rolled back: *${row.title}* (${row.account_label}) by ${actor}.`);
  return { ok: true, rolledBack: true };
}

async function verify(
  customerId: string, action: ExecAction,
  prep: { campaign?: CampaignRef; sharedSet?: string }, resourceName?: string,
): Promise<Record<string, unknown>> {
  if (action.kind === "add_negative_keyword" && resourceName) {
    const res = action.level === "ad_group" ? "ad_group_criterion" : "campaign_criterion";
    const rows = await gaqlSearch(customerId, `SELECT ${res}.resource_name, ${res}.negative FROM ${res} WHERE ${res}.resource_name = '${gaqlStr(resourceName)}'`);
    return { exists: rows.length > 0, resourceName };
  }
  if (action.kind === "add_shared_negative" && resourceName) {
    // Re-query the criterion, then derive the set and count attached Search campaigns.
    const critRows = await gaqlSearch(customerId, `SELECT shared_criterion.resource_name FROM shared_criterion WHERE shared_criterion.resource_name = '${gaqlStr(resourceName)}'`);
    const setResource = prep.sharedSet ?? `customers/${customerId}/sharedSets/${resourceName.match(/sharedCriteria\/(\d+)~/)?.[1] ?? ""}`;
    let attachedCampaigns = 0;
    try {
      const links = await gaqlSearch(customerId, `SELECT campaign_shared_set.campaign FROM campaign_shared_set WHERE campaign_shared_set.shared_set = '${gaqlStr(setResource)}'`);
      attachedCampaigns = links.length;
    } catch { /* count best-effort */ }
    return { exists: critRows.length > 0, resourceName, sharedSet: setResource, attachedCampaigns };
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

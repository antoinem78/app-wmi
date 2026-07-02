// Rexos optimisation proposals — first-class, reviewable change requests.
// The agent (or the team) files a typed proposal; a human approves/dismisses.
// Propose-only: approval RECORDS the decision, it does not touch a live account
// (the P5 mutate layer will later hang off an approved proposal).
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity";

export type ProposalType =
  | "negative_keywords"
  | "pause_campaign"
  | "budget_reallocation"
  | "rsa_improvement"
  | "other";
export type ProposalStatus = "pending" | "approved" | "dismissed" | "applied";

export interface Proposal {
  id: string;
  clientId: string;
  accountLabel: string | null;
  type: ProposalType;
  title: string;
  rationale: string | null;
  details: Record<string, unknown>;
  status: ProposalStatus;
  createdBy: string | null;
  createdAt: string;
  decidedBy: string | null;
  decidedAt: string | null;
  execution: Record<string, unknown>;
}

const PROPOSAL_TYPES: ProposalType[] = [
  "negative_keywords",
  "pause_campaign",
  "budget_reallocation",
  "rsa_improvement",
  "other",
];

type Row = {
  id: string; client_id: string; account_label: string | null; type: string;
  title: string; rationale: string | null; details: Record<string, unknown> | null;
  status: string; created_by: string | null; created_at: string;
  decided_by: string | null; decided_at: string | null;
  execution: Record<string, unknown> | null;
};
function mapRow(r: Row): Proposal {
  return {
    id: r.id, clientId: r.client_id, accountLabel: r.account_label,
    type: (PROPOSAL_TYPES.includes(r.type as ProposalType) ? r.type : "other") as ProposalType,
    title: r.title, rationale: r.rationale, details: r.details ?? {},
    status: r.status as ProposalStatus, createdBy: r.created_by, createdAt: r.created_at,
    decidedBy: r.decided_by, decidedAt: r.decided_at, execution: r.execution ?? {},
  };
}

export async function createProposal(input: {
  clientId: string;
  accountLabel?: string;
  type: ProposalType;
  title: string;
  rationale?: string;
  details?: Record<string, unknown>;
  createdBy?: string;
}): Promise<{ id: string } | { error: string }> {
  const supabase = createSupabaseAdminClient();
  const type = PROPOSAL_TYPES.includes(input.type) ? input.type : "other";
  const { data, error } = await supabase
    .from("optimization_proposals")
    .insert({
      client_id: input.clientId,
      account_label: input.accountLabel ?? null,
      type,
      title: input.title.slice(0, 300),
      rationale: input.rationale ?? null,
      details: input.details ?? {},
      created_by: input.createdBy ?? "rexos-agent",
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "insert failed" };
  await logActivity({
    clientId: input.clientId,
    eventType: "proposal_created",
    actor: input.createdBy ?? "rexos-agent",
    payload: { type, title: input.title },
  });
  return { id: data.id };
}

export async function listProposals(opts?: {
  status?: ProposalStatus;
  clientId?: string;
  limit?: number;
}): Promise<Proposal[]> {
  const supabase = createSupabaseAdminClient();
  let q = supabase
    .from("optimization_proposals")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 100);
  if (opts?.status) q = q.eq("status", opts.status);
  if (opts?.clientId) q = q.eq("client_id", opts.clientId);
  const { data } = await q;
  return (data ?? []).map(mapRow as (r: unknown) => Proposal);
}

export async function pendingProposalCount(): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const { count } = await supabase
    .from("optimization_proposals")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");
  return count ?? 0;
}

// Permanently remove a proposal. Blocked while a proposal is live-applied — roll
// it back first so we never delete an active change's audit record.
export async function deleteProposal(
  id: string,
  by: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = createSupabaseAdminClient();
  const { data: row } = await supabase
    .from("optimization_proposals")
    .select("client_id, status, title, type")
    .eq("id", id)
    .single();
  if (!row) return { error: "Proposal not found." };
  if (row.status === "applied") {
    return { error: "This proposal is applied to a live account — roll it back before deleting." };
  }
  const { error } = await supabase.from("optimization_proposals").delete().eq("id", id);
  if (error) return { error: error.message };
  await logActivity({
    clientId: row.client_id as string,
    eventType: "proposal_deleted",
    actor: `admin:${by}`,
    payload: { proposal_id: id, type: row.type, title: row.title },
  });
  return { ok: true };
}

// Record a decision. Propose-only: "approve" means accepted (you'll apply it in
// Google Ads); it does not execute. Idempotent-ish: only acts on a pending row.
export async function decideProposal(
  id: string,
  decision: "approved" | "dismissed",
  by: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = createSupabaseAdminClient();
  const { data: row } = await supabase
    .from("optimization_proposals")
    .select("client_id, status, title, type")
    .eq("id", id)
    .single();
  if (!row) return { error: "Proposal not found." };
  if (row.status !== "pending") return { error: `Already ${row.status}.` };
  const { error } = await supabase
    .from("optimization_proposals")
    .update({ status: decision, decided_by: by, decided_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending");
  if (error) return { error: error.message };
  await logActivity({
    clientId: row.client_id as string,
    eventType: decision === "approved" ? "proposal_approved" : "proposal_dismissed",
    actor: `admin:${by}`,
    payload: { proposal_id: id, type: row.type, title: row.title },
  });
  return { ok: true };
}

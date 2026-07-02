"use server";

import { revalidatePath } from "next/cache";
import { requireAgencyAdmin } from "@/lib/auth/guard";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { decideProposal, deleteProposal, markProposalApplied } from "@/lib/proposals";
import { dryRunProposal, applyProposal, rollbackProposal } from "@/lib/proposals-execute";

async function decide(formData: FormData, decision: "approved" | "dismissed") {
  const { email } = await requireAgencyAdmin();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Missing proposal id.");
  const res = await decideProposal(id, decision, email);
  if ("error" in res) throw new Error(res.error);
  revalidatePath("/proposals");
  revalidatePath("/dashboard");
}

export async function approveProposal(formData: FormData): Promise<void> {
  await decide(formData, "approved");
}
export async function dismissProposal(formData: FormData): Promise<void> {
  await decide(formData, "dismissed");
}

export async function deleteProposalAction(formData: FormData): Promise<void> {
  const { email } = await requireAgencyAdmin();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Missing proposal id.");
  const res = await deleteProposal(id, email);
  if ("error" in res) throw new Error(res.error);
  revalidatePath("/proposals");
  revalidatePath("/dashboard");
}

export async function markAppliedAction(formData: FormData): Promise<void> {
  const { email } = await requireAgencyAdmin();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Missing proposal id.");
  const res = await markProposalApplied(id, email);
  if ("error" in res) throw new Error(res.error);
  revalidatePath("/proposals");
  revalidatePath("/dashboard");
}

// Execution actions — each routes through the worker (proposals-execute), which
// re-checks approval + guardrails before any mutate. Errors are persisted to the
// row's execution.lastError so the page can show them (no scary error overlay).
async function runExec(
  formData: FormData,
  fn: (id: string, actor: string) => Promise<{ ok: true; [k: string]: unknown } | { error: string }>,
) {
  const { email } = await requireAgencyAdmin();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Missing proposal id.");
  const res = await fn(id, email);
  if ("error" in res) {
    const supabase = createSupabaseAdminClient();
    const { data } = await supabase.from("optimization_proposals").select("execution").eq("id", id).single();
    const execution = {
      ...(((data?.execution as Record<string, unknown>) ?? {})),
      lastError: res.error,
      lastErrorAt: new Date().toISOString(),
    };
    await supabase.from("optimization_proposals").update({ execution }).eq("id", id);
  }
  revalidatePath("/proposals");
  revalidatePath("/dashboard");
}

export async function dryRunProposalAction(formData: FormData): Promise<void> {
  await runExec(formData, (id) => dryRunProposal(id));
}
export async function applyProposalAction(formData: FormData): Promise<void> {
  await runExec(formData, (id, actor) => applyProposal(id, actor));
}
export async function rollbackProposalAction(formData: FormData): Promise<void> {
  await runExec(formData, (id, actor) => rollbackProposal(id, actor));
}

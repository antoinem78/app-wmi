"use server";

// Founder actions on Bernard: approving/rejecting a proposed Meta fix and the
// per-client STAND_DOWN. Every action re-checks agency_admin server-side and
// carries the approver's identity into the substrate audit trail.
import { revalidatePath } from "next/cache";
import { auth0 } from "@/lib/auth/auth0";
import { isAgencyAdmin } from "@/lib/auth/roles";
import { decideFix, standDown } from "@/lib/bernard";
import { leaveFeedback } from "@/lib/agent-feedback";

async function requireAdmin(): Promise<string> {
  const session = await auth0.getSession();
  const user = session?.user as Record<string, unknown> | undefined;
  if (!user || !isAgencyAdmin(user)) throw new Error("Not authorised.");
  return typeof user.email === "string" ? user.email : "agency_admin";
}

export async function decideFixAction(formData: FormData): Promise<void> {
  const email = await requireAdmin();
  const taskId = String(formData.get("task_id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (!taskId || (decision !== "approve" && decision !== "reject")) return;
  await decideFix(taskId, decision, email);
  revalidatePath("/bernard");
}

export async function standDownAction(formData: FormData): Promise<void> {
  const email = await requireAdmin();
  const slug = String(formData.get("client_slug") ?? "");
  if (!slug) return;
  await standDown(slug, "founder stand-down from portal", email);
  revalidatePath("/bernard");
}

// The feedback inbox (Denis brief item 3): a one-off steering note the agent
// reads at the start of its next run and then archives. Not a memory, not a
// chat turn; the missing middle between the two.
export async function leaveFeedbackAction(formData: FormData): Promise<void> {
  const email = await requireAdmin();
  const agent = String(formData.get("agent") ?? "bernard");
  const note = String(formData.get("note") ?? "").trim();
  if (!note) return;
  if (!["bernard", "oscar", "norbert", "all"].includes(agent)) throw new Error("Unknown agent.");
  await leaveFeedback(agent, note, email);
  revalidatePath("/bernard");
}


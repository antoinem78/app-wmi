"use server";

// Founder actions on Bernard: approving/rejecting a proposed Meta fix and the
// per-client STAND_DOWN. Every action re-checks agency_admin server-side and
// carries the approver's identity into the substrate audit trail.
import { revalidatePath } from "next/cache";
import { auth0 } from "@/lib/auth/auth0";
import { isAgencyAdmin } from "@/lib/auth/roles";
import { decideFix, standDown } from "@/lib/bernard";

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

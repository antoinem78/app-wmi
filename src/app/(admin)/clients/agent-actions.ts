"use server";
// Server actions for cockpit agent-config edits (Step 5). Agency-admin only.
// Enforcement (allowlist, audit) is authoritative in the n8n webhook; these
// actions add the auth gate, the actor identity, and cache revalidation.
import { revalidatePath } from "next/cache";
import { auth0 } from "@/lib/auth/auth0";
import { isAgencyAdmin } from "@/lib/auth/roles";
import { writeAgentConfig, type ConfigWriteResult } from "@/lib/platform/config-write";

async function requireAdminEmail(): Promise<string | null> {
  const session = await auth0.getSession();
  if (!session) return null;
  const user = session.user as Record<string, unknown>;
  if (!isAgencyAdmin(user)) return null;
  return typeof user.email === "string" ? user.email : "admin";
}

// Preview a tier-B change (returns current value; no write).
export async function previewAgentConfig(
  engineBClientId: string,
  key: string,
  value: unknown,
): Promise<ConfigWriteResult> {
  const actor = await requireAdminEmail();
  if (!actor) return { ok: false, error: "Agency admin only." };
  return writeAgentConfig({ engineBClientId, key, value, action: "dryRun", actor });
}

// Apply a change (tier A directly; tier B after the caller has previewed + confirmed).
export async function applyAgentConfig(
  engineAClientId: string,
  engineBClientId: string,
  key: string,
  value: unknown,
): Promise<ConfigWriteResult> {
  const actor = await requireAdminEmail();
  if (!actor) return { ok: false, error: "Agency admin only." };
  const result = await writeAgentConfig({ engineBClientId, key, value, action: "apply", actor });
  if (result.updated === "1") revalidatePath(`/clients/${engineAClientId}`);
  return result;
}

// Request a KB re-ingest for this client (tier B; logged).
export async function requestKbReingest(engineBClientId: string): Promise<ConfigWriteResult> {
  const actor = await requireAdminEmail();
  if (!actor) return { ok: false, error: "Agency admin only." };
  return writeAgentConfig({ engineBClientId, action: "reingest_kb", actor });
}

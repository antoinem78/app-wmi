// Cross-cutting security trail for every Google Ads write attempt (P5-Lite
// apply/rollback, dry-runs, and boundary rejections). Records the two independent
// scope checks (MCC membership + allowlist) alongside the outcome. Best-effort:
// if the write_audit table isn't present yet, this no-ops (the write path still
// runs). Client-scoped activity_log entries remain the human-facing trail.
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export interface WriteAuditEntry {
  customerId?: string | null;
  action?: string | null;
  phase: "dry_run" | "apply" | "rollback";
  mccCheck?: "ok" | "fail" | "skipped";
  allowlistCheck?: "ok" | "fail" | "skipped";
  approver?: string | null;
  result: "ok" | "blocked" | "failed" | "boundary_violation";
  detail?: Record<string, unknown>;
  clientId?: string | null;
}

export async function recordWriteAudit(e: WriteAuditEntry): Promise<void> {
  try {
    const supabase = createSupabaseAdminClient();
    await supabase.from("write_audit").insert({
      deployment: process.env.APP_BASE_URL ?? null,
      mcc: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ?? null,
      customer_id: e.customerId ?? null,
      source: "p5lite",
      action: e.action ?? null,
      phase: e.phase,
      mcc_check: e.mccCheck ?? null,
      allowlist_check: e.allowlistCheck ?? null,
      approver: e.approver ?? null,
      result: e.result,
      detail: e.detail ?? {},
      client_id: e.clientId ?? null,
    });
  } catch {
    /* security trail is best-effort — never block a write on audit failure */
  }
}

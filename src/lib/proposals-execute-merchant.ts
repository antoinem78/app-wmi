// Merchant Center leg of the proposals worker (founder-ruled 2026-08-26, built
// 2026-09-04). Same control-boundary shape as the Google Ads leg in
// proposals-execute.ts, with the differences the surface forces:
//
// - The Merchant API has no validateOnly, so the dry run is a full read pass:
//   resolve the product, capture the current value, resolve or plan the overlay
//   source and its linkage, and report EXACTLY what an apply would do,
//   including any one-time "create overlay source and link it into primary X"
//   step, which the founder approves with eyes open rather than discovering.
// - Merchant Center composes products asynchronously, so the post-apply
//   read-back can lag the accepted write by minutes. An accepted write whose
//   read-back has not caught up is reported as applied-with-pending-composition,
//   never verification_failed and never silent success.
// - The write is guarded by its own kill switch and allowlist (a new write
//   surface class starts narrow; no ALLOW_ALL lift), plus a cross-check that
//   the merchant account is the one the client's own Google Ads shopping
//   campaigns actually use, so a typo'd merchant id cannot write into a
//   stranger's feed the token happens to reach.
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity";
import { gaqlSearch } from "@/lib/integrations/google-ads";
import {
  merchantWriteEnabled, guardMerchantAllowlist,
  type ExecAction,
} from "@/lib/integrations/google-ads/write";
import {
  getMerchantProduct, ensureOverlaySource, insertOverlayInput, deleteOverlayInput,
  agentOverlaySourceName, type ProductIdentity,
} from "@/lib/integrations/merchant";
import { recordWriteAudit } from "@/lib/write-audit";

type McAction = Extract<ExecAction, { kind: "mc_set_title" | "mc_set_price" }>;
type Result = { ok: true; [k: string]: unknown } | { error: string };
type Phase = "dry_run" | "apply" | "rollback";

const identity = (a: McAction): ProductIdentity => ({
  merchantId: a.merchantId, offerId: a.offerId, contentLanguage: a.contentLanguage, feedLabel: a.feedLabel,
});
const attributesFor = (a: McAction): Record<string, unknown> =>
  a.kind === "mc_set_title"
    ? { title: a.title }
    : { price: { amountMicros: String(Math.round(a.amount * 1_000_000)), currencyCode: a.currency } };

async function guard(
  a: McAction, clientId: string, phase: Phase, approver?: string,
): Promise<{ ok: true } | { error: string }> {
  const base = { phase, customerId: `mc:${a.merchantId}`, action: a.kind, approver, clientId } as const;
  if (!merchantWriteEnabled()) {
    await recordWriteAudit({ ...base, mccCheck: "skipped", allowlistCheck: "skipped", result: "blocked", detail: { reason: "MERCHANT_WRITE_ENABLED is off" } });
    return { error: "Merchant Center writes are disabled (MERCHANT_WRITE_ENABLED)." };
  }
  const allow = guardMerchantAllowlist(a.merchantId);
  if (allow && phase !== "dry_run") {
    await recordWriteAudit({ ...base, mccCheck: "skipped", allowlistCheck: "fail", result: "blocked", detail: { reason: allow } });
    return { error: allow };
  }
  // Boundary cross-check on every phase, dry run included: the merchant id must
  // be one the CLIENT'S OWN Google Ads shopping campaigns use.
  const customerId = await customerFor(clientId);
  if (!customerId) return { error: "No Google Ads account for this client, so the merchant link cannot be verified." };
  try {
    const rows = await gaqlSearch(
      customerId,
      `SELECT campaign.shopping_setting.merchant_id FROM campaign
       WHERE campaign.advertising_channel_type IN ('SHOPPING', 'PERFORMANCE_MAX') AND campaign.status != 'REMOVED'`,
    );
    const linked = new Set(rows.map((r) => String(((r.campaign ?? {}) as { shoppingSetting?: { merchantId?: unknown } }).shoppingSetting?.merchantId ?? "")));
    if (!linked.has(a.merchantId)) {
      await recordWriteAudit({ ...base, mccCheck: "fail", allowlistCheck: allow ? "fail" : "ok", result: "boundary_violation", detail: { reason: `merchant ${a.merchantId} is not used by any of the client's shopping campaigns`, linked: [...linked] } });
      return { error: `Merchant ${a.merchantId} is not the account the client's own shopping campaigns use (${[...linked].filter(Boolean).join(", ") || "none found"}) — refusing.` };
    }
  } catch (e) {
    return { error: `Could not verify the merchant link from the client's campaigns: ${e instanceof Error ? e.message : String(e)}; refusing rather than writing blind.` };
  }
  return { ok: true };
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

interface McPrep {
  before: Record<string, unknown>;
  primaryDataSource: string;
  plannedAttributes: Record<string, unknown>;
}
async function prepareMc(a: McAction): Promise<McPrep | { error: string }> {
  const product = await getMerchantProduct(identity(a));
  if ("error" in product) return { error: `Product read failed (${product.error}). The identity is contentLanguage~feedLabel~offerId, exactly as the feed carries them.` };
  if (!product.primaryDataSource) return { error: "The product carries no primary data source reference; cannot place an overlay safely." };
  const before = a.kind === "mc_set_title"
    ? { title: product.title, product: product.name }
    : { price: product.price, product: product.name };
  return { before, primaryDataSource: product.primaryDataSource, plannedAttributes: attributesFor(a) };
}

export async function dryRunMerchant(a: McAction, clientId: string): Promise<Result> {
  const g = await guard(a, clientId, "dry_run");
  if ("error" in g) return g;
  const prep = await prepareMc(a);
  if ("error" in prep) return prep;
  const allow = guardMerchantAllowlist(a.merchantId);
  await recordWriteAudit({ phase: "dry_run", customerId: `mc:${a.merchantId}`, action: a.kind, clientId, mccCheck: "ok", allowlistCheck: "skipped", result: "ok", detail: { before: prep.before } });
  return {
    ok: true,
    validated: true,
    before: prep.before,
    would_write: prep.plannedAttributes,
    overlay_source: agentOverlaySourceName(),
    primary_data_source: prep.primaryDataSource,
    note: "The Merchant API has no server-side validate; this dry run is the full read pass. Applying will find-or-create the overlay source and, ONCE per primary, link it into that primary's default rule ahead of self. Reversal is one delete of the overlay input."
      + (allow ? ` NOTE: ${allow} An apply would be blocked until the account is allowlisted.` : ""),
  };
}

export async function applyMerchant(a: McAction, clientId: string, actor: string): Promise<Result> {
  const g = await guard(a, clientId, "apply", actor);
  if ("error" in g) return g;
  const prep = await prepareMc(a);
  if ("error" in prep) return prep;
  const src = await ensureOverlaySource(a.merchantId, prep.primaryDataSource);
  if ("error" in src) return { error: `Overlay source setup failed: ${src.error}` };
  const inserted = await insertOverlayInput(identity(a), src.dataSource, prep.plannedAttributes);
  if ("error" in inserted) {
    await recordWriteAudit({ phase: "apply", customerId: `mc:${a.merchantId}`, action: a.kind, approver: actor, clientId, mccCheck: "ok", allowlistCheck: "ok", result: "failed", detail: { error: inserted.error, overlay: src } });
    return { error: `Overlay write failed: ${inserted.error}` };
  }
  // Read back, honestly: composition is asynchronous.
  const after = await getMerchantProduct(identity(a));
  const composed = !("error" in after);
  const target = a.kind === "mc_set_title" ? a.title : Math.round(a.amount * 1_000_000);
  const reflected = composed && (a.kind === "mc_set_title"
    ? (after as { title: string | null }).title === a.title
    : (after as { price: { amountMicros: number } | null }).price?.amountMicros === target);
  const detail = {
    before: prep.before, written: prep.plannedAttributes, input: inserted.name,
    overlay: src, read_back: composed ? after : { error: (after as { error: string }).error },
    composition: reflected ? "reflected" : "pending (Merchant Center composes asynchronously; re-read in a few minutes)",
  };
  await recordWriteAudit({ phase: "apply", customerId: `mc:${a.merchantId}`, action: a.kind, approver: actor, clientId, mccCheck: "ok", allowlistCheck: "ok", result: "ok", detail });
  await logActivity({ clientId, eventType: "proposal_applied", actor: `admin:${actor}`, payload: { action: a.kind, ...detail } });
  return { ok: true, applied: true, resourceName: inserted.name, dataSource: src.dataSource, ...detail };
}

export async function rollbackMerchant(
  a: McAction, clientId: string, actor: string,
  execution: Record<string, unknown>,
): Promise<Result> {
  const g = await guard(a, clientId, "rollback", actor);
  if ("error" in g) return g;
  const inputName = execution.resourceName as string | undefined;
  const dataSource = execution.dataSource as string | undefined;
  if (!inputName || !dataSource) return { error: "No overlay input recorded on this proposal — nothing to delete." };
  const del = await deleteOverlayInput(inputName, dataSource);
  if ("error" in del) {
    await recordWriteAudit({ phase: "rollback", customerId: `mc:${a.merchantId}`, action: a.kind, approver: actor, clientId, mccCheck: "ok", allowlistCheck: "ok", result: "failed", detail: { error: del.error } });
    return { error: `Overlay delete failed: ${del.error}` };
  }
  await recordWriteAudit({ phase: "rollback", customerId: `mc:${a.merchantId}`, action: a.kind, approver: actor, clientId, mccCheck: "ok", allowlistCheck: "ok", result: "ok", detail: { deleted: inputName } });
  return { ok: true, rolledBack: true, note: "Overlay input deleted; the attribute falls back to the primary feed's value on the next composition pass (minutes)." };
}

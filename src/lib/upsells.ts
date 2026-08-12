// Upsells: extra work sold to an existing client, either a one-off (setup, ad
// hoc task) or an ongoing add-on service.
//
// Two founder rulings from 2026-08-11 shape this module:
//
//   A recurring upsell bills as its OWN Stripe subscription, so a client can
//   drop an add-on with no route by which that action could reach the core
//   retainer. See createUpsellCheckoutSession.
//
//   A recurring upsell needs a signable quote before it can be paid, the same
//   as the original engagement. A one-off does not: the invoice is the record.
//   That asymmetry is the only real branch in here.
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity";
import { entityConfig, formatMoney } from "@/lib/config";
import { createContractDocument, getDocumentStatus } from "@/lib/integrations/contracts";

export type UpsellKind = "one_off" | "recurring";

export type Upsell = {
  id: string;
  client_id: string;
  kind: UpsellKind;
  name: string;
  description: string | null;
  amount: number;
  currency: string;
  status:
    | "draft"
    | "quote_sent"
    | "quote_signed"
    | "payment_sent"
    | "paid"
    | "active"
    | "cancelled";
  document_id: string | null;
  stripe_session_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
  paid_at: string | null;
};

const UPSELL_COLUMNS =
  "id, client_id, kind, name, description, amount, currency, status, document_id, stripe_session_id, stripe_subscription_id, created_at, paid_at";

export function upsellNeedsQuote(kind: UpsellKind): boolean {
  return kind === "recurring";
}

/** Whether the client can be sent to Stripe yet. A one-off is always ready; a
 *  recurring upsell is only ready once its quote is signed. */
export function upsellCanPay(u: Pick<Upsell, "kind" | "status">): boolean {
  if (u.status === "paid" || u.status === "active" || u.status === "cancelled") return false;
  return u.kind === "one_off" || u.status === "quote_signed";
}

export function upsellPriceLabel(u: Pick<Upsell, "amount" | "currency" | "kind">): string {
  const money = formatMoney(u.amount, u.currency);
  return u.kind === "recurring" ? `${money} / month` : money;
}

export async function getUpsell(id: string): Promise<Upsell | null> {
  const { data } = await createSupabaseAdminClient()
    .from("upsells")
    .select(UPSELL_COLUMNS)
    .eq("id", id)
    .single();
  return (data as Upsell | null) ?? null;
}

export async function listUpsellsForClient(clientId: string): Promise<Upsell[]> {
  const { data } = await createSupabaseAdminClient()
    .from("upsells")
    .select(UPSELL_COLUMNS)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  return (data as Upsell[] | null) ?? [];
}

export async function createUpsell(args: {
  clientId: string;
  kind: UpsellKind;
  name: string;
  description?: string | null;
  amount: number;
  currency?: string | null;
  actor?: string;
}): Promise<Upsell> {
  const { data, error } = await createSupabaseAdminClient()
    .from("upsells")
    .insert({
      client_id: args.clientId,
      kind: args.kind,
      name: args.name.trim(),
      description: args.description?.trim() || null,
      amount: args.amount,
      currency: (args.currency || entityConfig.currency).toUpperCase(),
    })
    .select(UPSELL_COLUMNS)
    .single();
  if (error) throw new Error(error.message);

  await logActivity({
    clientId: args.clientId,
    eventType: "upsell_created",
    actor: args.actor ?? "admin",
    payload: { upsell_id: data.id, kind: args.kind, name: args.name, amount: args.amount },
  });
  return data as Upsell;
}

/** Issue the signable quote for a recurring upsell. Reuses whichever contract
 *  provider the entity runs (proposal engine on FZCO, PandaDoc on wmiltd), so
 *  the client sees the same signing experience as their original agreement. */
export async function issueUpsellQuote(
  upsellId: string,
  actor?: string,
): Promise<string> {
  const supabase = createSupabaseAdminClient();
  const upsell = await getUpsell(upsellId);
  if (!upsell) throw new Error("Upsell not found.");
  if (!upsellNeedsQuote(upsell.kind)) {
    throw new Error("A one-off upsell does not need a quote.");
  }
  if (upsell.document_id) return upsell.document_id;

  const { data: client } = await supabase
    .from("clients")
    .select("id, company_name, contact_name, contact_email")
    .eq("id", upsell.client_id)
    .single();
  if (!client) throw new Error("Client not found.");

  const documentId = await createContractDocument(client, {
    name: upsell.name,
    price: upsell.amount,
    // The provider templates label this "channels" because they were written
    // for media retainers. For an add-on it is the service description, which
    // is what lands in the document title.
    channels: upsell.name,
    currency: upsell.currency,
  });

  const { error } = await supabase
    .from("upsells")
    .update({
      document_id: documentId,
      status: "quote_sent",
      updated_at: new Date().toISOString(),
    })
    .eq("id", upsellId)
    .eq("status", "draft");
  if (error) throw new Error(error.message);

  await logActivity({
    clientId: upsell.client_id,
    eventType: "upsell_quote_issued",
    actor: actor ?? "admin",
    payload: { upsell_id: upsellId, document_id: documentId },
  });
  return documentId;
}

/** Poll the provider and promote to quote_signed once it reports completion.
 *  Called on the client-facing page load, the same way onboarding does it, so
 *  no webhook is needed from either provider. Returns true if it just flipped. */
export async function refreshUpsellQuoteStatus(upsellId: string): Promise<boolean> {
  const upsell = await getUpsell(upsellId);
  if (!upsell || !upsell.document_id) return false;
  if (upsell.status !== "quote_sent") return false;

  let status: string;
  try {
    status = await getDocumentStatus(upsell.document_id);
  } catch (e) {
    console.error("Upsell quote status check failed:", e);
    return false;
  }
  if (status !== "document.completed") return false;

  const { error } = await createSupabaseAdminClient()
    .from("upsells")
    .update({ status: "quote_signed", updated_at: new Date().toISOString() })
    .eq("id", upsellId)
    .eq("status", "quote_sent");
  if (error) throw new Error(error.message);

  await logActivity({
    clientId: upsell.client_id,
    eventType: "upsell_quote_signed",
    actor: "client",
    payload: { upsell_id: upsellId },
  });
  return true;
}

/** Withdraw an upsell that has not been paid. Deliberately refuses once money
 *  has moved: a paid one-off is history, and a live add-on subscription has to
 *  be cancelled in Stripe so the client's billing and our record stay in step. */
export async function cancelUpsell(upsellId: string, actor?: string): Promise<void> {
  const upsell = await getUpsell(upsellId);
  if (!upsell) throw new Error("Upsell not found.");
  if (upsell.status === "paid" || upsell.status === "active") {
    throw new Error(
      "This upsell has been paid. Cancel the subscription in Stripe rather than withdrawing the offer.",
    );
  }
  const { error } = await createSupabaseAdminClient()
    .from("upsells")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", upsellId);
  if (error) throw new Error(error.message);

  await logActivity({
    clientId: upsell.client_id,
    eventType: "upsell_cancelled",
    actor: actor ?? "admin",
    payload: { upsell_id: upsellId, name: upsell.name },
  });
}

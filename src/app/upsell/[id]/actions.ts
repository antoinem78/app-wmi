"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getUpsell, upsellCanPay } from "@/lib/upsells";
import { createUpsellCheckoutSession } from "@/lib/integrations/stripe";
import { createSigningSession } from "@/lib/integrations/contracts";
import { logActivity } from "@/lib/activity";

/** Send the client to Stripe. Refuses if the upsell is not payable yet, so a
 *  recurring add-on cannot be paid before its quote is signed even if somebody
 *  reaches this action directly. */
export async function startUpsellCheckout(upsellId: string): Promise<void> {
  const upsell = await getUpsell(upsellId);
  if (!upsell) throw new Error("Upsell not found.");
  if (!upsellCanPay(upsell)) {
    throw new Error("This upsell is not ready for payment.");
  }

  const supabase = createSupabaseAdminClient();
  const { data: client } = await supabase
    .from("clients")
    .select("id, contact_email")
    .eq("id", upsell.client_id)
    .single();
  if (!client) throw new Error("Client not found.");

  const url = await createUpsellCheckoutSession(upsell, client);
  await supabase
    .from("upsells")
    .update({ status: "payment_sent", updated_at: new Date().toISOString() })
    .eq("id", upsellId)
    .in("status", ["draft", "quote_signed"]);
  await logActivity({
    clientId: upsell.client_id,
    eventType: "upsell_checkout_opened",
    actor: "client",
    payload: { upsell_id: upsellId },
  });
  redirect(url);
}

/** Open the signing session for a recurring upsell's quote. */
export async function openUpsellQuote(upsellId: string): Promise<void> {
  const upsell = await getUpsell(upsellId);
  if (!upsell?.document_id) throw new Error("No quote to sign.");

  const supabase = createSupabaseAdminClient();
  const { data: client } = await supabase
    .from("clients")
    .select("contact_email")
    .eq("id", upsell.client_id)
    .single();
  if (!client) throw new Error("Client not found.");

  const url = await createSigningSession(upsell.document_id, client.contact_email);
  revalidatePath(`/upsell/${upsellId}`);
  redirect(url);
}

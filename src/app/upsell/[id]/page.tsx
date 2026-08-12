// Public, link-driven upsell acceptance.
//
// One link covers both kinds, so the client never has to be told which flow
// they are in. A one-off goes straight to payment. A recurring add-on shows the
// quote first, and payment only unlocks once it is signed (founder ruling
// 2026-08-11: an ongoing service needs paperwork, a one-off does not).
import { notFound } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { entityConfig } from "@/lib/config";
import { Wordmark } from "@/components/Wordmark";
import { PoweredBy } from "@/components/PoweredBy";
import { SubmitButton } from "@/components/SubmitButton";
import {
  getUpsell,
  upsellCanPay,
  upsellNeedsQuote,
  upsellPriceLabel,
} from "@/lib/upsells";
import { refreshUpsellQuoteStatus } from "@/lib/upsells";
import { finalizeUpsellFromSession } from "@/lib/integrations/stripe";
import { startUpsellCheckout, openUpsellQuote } from "./actions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function UpsellPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { id } = await params;
  const { session_id: sessionId } = await searchParams;

  let upsell = await getUpsell(id);
  if (!upsell) notFound();

  // Returning from Stripe: verify with Stripe rather than trusting the URL.
  if (sessionId && upsell.status !== "paid" && upsell.status !== "active") {
    try {
      if (await finalizeUpsellFromSession(id, sessionId)) {
        upsell = (await getUpsell(id)) ?? upsell;
      }
    } catch (e) {
      console.error("Upsell checkout verification failed:", e);
    }
  }

  // A signature may have landed since the last visit.
  if (upsell.status === "quote_sent") {
    try {
      if (await refreshUpsellQuoteStatus(id)) {
        upsell = (await getUpsell(id)) ?? upsell;
      }
    } catch (e) {
      console.error("Upsell quote refresh failed:", e);
    }
  }

  const { data: client } = await createSupabaseAdminClient()
    .from("clients")
    .select("company_name")
    .eq("id", upsell.client_id)
    .single();

  const settled = upsell.status === "paid" || upsell.status === "active";
  const recurring = upsell.kind === "recurring";

  return (
    <div className="mx-auto max-w-lg px-6 py-14">
      <Wordmark />

      <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-zinc-900">{upsell.name}</h1>
        {client?.company_name && (
          <p className="mt-1 text-sm text-zinc-500">For {client.company_name}</p>
        )}

        {upsell.description && (
          <p className="mt-4 whitespace-pre-line text-sm text-zinc-600">
            {upsell.description}
          </p>
        )}

        <div className="mt-6 flex items-baseline justify-between border-t border-zinc-200 pt-4">
          <span className="text-sm text-zinc-500">
            {recurring ? "Ongoing" : "One-off"}
          </span>
          <span className="text-lg font-semibold text-zinc-900">
            {upsellPriceLabel(upsell)}
          </span>
        </div>
        <p className="mt-1 text-xs text-zinc-400">
          {entityConfig.vatRate
            ? "Tax is added at checkout, calculated from your billing address."
            : "Any tax that applies is calculated at checkout from your billing address."}
        </p>

        {upsell.status === "cancelled" && (
          <p className="mt-6 text-sm text-zinc-500">
            This is no longer available. Get in touch if you would still like it.
          </p>
        )}

        {settled && (
          <div className="mt-6 rounded-md bg-emerald-50 p-4 text-sm text-emerald-700">
            {recurring
              ? "All set. This is now running alongside your existing plan, on its own billing, so you can stop it at any time without affecting anything else."
              : "Paid, thank you. Your invoice is on its way by email and we are getting started."}
          </div>
        )}

        {!settled && upsell.status !== "cancelled" && (
          <div className="mt-6">
            {recurring && !upsellCanPay(upsell) ? (
              <>
                <p className="text-sm text-zinc-600">
                  This is an ongoing service, so there is a short agreement to
                  sign first. It takes a minute, and payment comes after.
                </p>
                <form action={openUpsellQuote.bind(null, upsell.id)} className="mt-4">
                  <SubmitButton>Review and sign</SubmitButton>
                </form>
              </>
            ) : (
              <>
                {recurring && (
                  <p className="mb-4 text-sm text-emerald-600">
                    Agreement signed, thank you. One step left.
                  </p>
                )}
                <form action={startUpsellCheckout.bind(null, upsell.id)}>
                  <SubmitButton>
                    {recurring ? "Set up payment" : "Pay now"}
                  </SubmitButton>
                </form>
                {recurring && (
                  <p className="mt-3 text-xs text-zinc-400">
                    Billed separately from your existing plan, so stopping this
                    never touches anything else.
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {!settled && upsell.status === "quote_sent" && upsellNeedsQuote(upsell.kind) && (
          <p className="mt-4 text-xs text-zinc-400">
            Already signed? Refresh this page and the next step will appear.
          </p>
        )}
      </div>

      <PoweredBy />
    </div>
  );
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity";

// These actions are intentionally public (access = having the link). Each one
// re-checks the current step server-side so steps can't be skipped or replayed
// out of order. clientId is bound server-side in the page, not taken from form
// input, so it can't be swapped by the client.

async function getState(clientId: string) {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("onboarding_state")
    .select("current_step")
    .eq("client_id", clientId)
    .single();
  return data;
}

export async function submitQuestionnaire(
  clientId: string,
  formData: FormData,
): Promise<void> {
  const state = await getState(clientId);
  if (!state) throw new Error("Onboarding not found.");
  if (state.current_step !== "questionnaire") {
    revalidatePath(`/onboarding/${clientId}`);
    return;
  }

  // Accept "spacex.com" and normalise to a full URL so the field is painless.
  let website = String(formData.get("website_url") ?? "").trim();
  if (website && !/^https?:\/\//i.test(website)) {
    website = "https://" + website;
  }

  const questionnaire = {
    website_url: website,
    industry: String(formData.get("industry") ?? "").trim(),
    monthly_budget: String(formData.get("monthly_budget") ?? "").trim(),
    primary_goal: String(formData.get("primary_goal") ?? "").trim(),
    platforms: formData.getAll("platforms").map(String),
    target_locations: String(formData.get("target_locations") ?? "").trim(),
    competitors: String(formData.get("competitors") ?? "").trim(),
    notes: String(formData.get("notes") ?? "").trim(),
  };

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("onboarding_state")
    .update({ questionnaire_data: questionnaire, current_step: "contract" })
    .eq("client_id", clientId);
  if (error) throw new Error(error.message);

  await logActivity({
    clientId,
    eventType: "questionnaire_submitted",
    actor: "client",
  });
  revalidatePath(`/onboarding/${clientId}`);
}

// Real PandaDoc contract: generate the document from the template, filled from
// the client record. Signing happens in the embedded frame; completion is
// recorded by the PandaDoc webhook or the page's status-check fallback.
export async function generateContract(clientId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { data: state } = await supabase
    .from("onboarding_state")
    .select("current_step, pandadoc_document_id")
    .eq("client_id", clientId)
    .single();
  if (!state) throw new Error("Onboarding not found.");
  if (state.current_step !== "contract") {
    revalidatePath(`/onboarding/${clientId}`);
    return;
  }

  const { createContractDocument, ensureDocumentSent } = await import(
    "@/lib/integrations/pandadoc"
  );

  if (state.pandadoc_document_id) {
    // Retry path: document exists but may not have been sent.
    await ensureDocumentSent(state.pandadoc_document_id);
  } else {
    const { data: client } = await supabase
      .from("clients")
      .select("id, company_name, contact_name, contact_email, service_tier")
      .eq("id", clientId)
      .single();
    if (!client) throw new Error("Client not found.");
    const { getTier } = await import("@/lib/tiers");
    const tier = getTier(client.service_tier);
    if (!tier) throw new Error("Client has no valid service tier configured.");

    const documentId = await createContractDocument(client, tier);
    const { error } = await supabase
      .from("onboarding_state")
      .update({ pandadoc_document_id: documentId })
      .eq("client_id", clientId);
    if (error) throw new Error(error.message);

    await logActivity({
      clientId,
      eventType: "contract_generated",
      actor: "client",
      payload: { pandadoc_document_id: documentId },
    });
  }
  revalidatePath(`/onboarding/${clientId}`);
}

// "I've signed" button: check the document status with PandaDoc and advance if
// genuinely completed (fallback for when the webhook hasn't arrived yet).
export async function confirmContractSigned(clientId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { data: state } = await supabase
    .from("onboarding_state")
    .select("current_step, pandadoc_document_id")
    .eq("client_id", clientId)
    .single();
  if (state?.current_step === "contract" && state.pandadoc_document_id) {
    const { getDocumentStatus, markContractSigned } = await import(
      "@/lib/integrations/pandadoc"
    );
    const status = await getDocumentStatus(state.pandadoc_document_id);
    if (status === "document.completed") {
      await markContractSigned(clientId, "contract-return");
    }
  }
  revalidatePath(`/onboarding/${clientId}`);
}

// Real Stripe payment: send the client to Stripe Checkout for their tier's
// monthly subscription. Completion is recorded by the webhook (or the
// checkout-return fallback in the page) — never by this action.
export async function startCheckout(clientId: string): Promise<void> {
  const state = await getState(clientId);
  if (!state) throw new Error("Onboarding not found.");
  if (state.current_step !== "payment") {
    revalidatePath(`/onboarding/${clientId}`);
    return;
  }

  const supabase = createSupabaseAdminClient();
  const { data: client } = await supabase
    .from("clients")
    .select("id, contact_email, service_tier")
    .eq("id", clientId)
    .single();
  if (!client) throw new Error("Client not found.");

  const { createCheckoutSessionForClient } = await import(
    "@/lib/integrations/stripe"
  );
  const checkoutUrl = await createCheckoutSessionForClient(client);

  await logActivity({
    clientId,
    eventType: "checkout_started",
    actor: "client",
  });

  redirect(checkoutUrl);
}

// Transactional email via Resend. Env-gated per deployment: without
// RESEND_API_KEY and EMAIL_FROM this module is a silent no-op, so deployments
// that have not set up a sending domain (app.wmiltd.com today) behave exactly
// as before. Failures never break the calling flow: an onboarding invite that
// cannot send should not roll back the client that was just created.
import { entityConfig, formatMoney } from "@/lib/config";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

function configured(): { apiKey: string; from: string } | null {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return null;
  return { apiKey, from };
}

export async function sendEmail(args: {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
}): Promise<boolean> {
  const cfg = configured();
  if (!cfg) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: cfg.from,
        to: [args.to],
        subject: args.subject,
        text: args.text,
        ...(args.replyTo ? { reply_to: args.replyTo } : {}),
      }),
    });
    if (!res.ok) {
      console.error("Resend send failed:", res.status, (await res.text()).slice(0, 300));
      return false;
    }
    return true;
  } catch (e) {
    console.error("Resend send threw:", e);
    return false;
  }
}

/** The onboarding invite: sent when an admin creates a client, carrying the
 *  private wizard link. The email the flow was silently missing. */
export async function sendOnboardingInvite(args: {
  to: string;
  contactName: string | null;
  companyName: string;
  link: string;
}): Promise<boolean> {
  const first = (args.contactName ?? "").trim().split(/\s+/)[0] || "there";
  const text = [
    `Hi ${first},`,
    "",
    `Here is your private onboarding link for ${args.companyName}:`,
    "",
    args.link,
    "",
    "It walks you through your quote, the service agreement and payment. The whole thing takes about five minutes, and your details are saved as you go, so you can come back to it any time.",
    "",
    "If anything is unclear, just reply to this email.",
    "",
    entityConfig.brandName,
  ].join("\n");
  return sendEmail({
    to: args.to,
    subject: `Your onboarding link, ${args.companyName}`,
    text,
  });
}

/** Payment confirmation: sent from the Stripe webhook once checkout completes.
 *  Reads the client row itself so the webhook handler stays thin. */
export async function sendPaymentConfirmationFor(clientId: string): Promise<boolean> {
  if (!configured()) return false;
  try {
    const supabase = createSupabaseAdminClient();
    const { data: client } = await supabase
      .from("clients")
      .select("company_name, contact_name, contact_email, custom_monthly_price, platforms, currency")
      .eq("id", clientId)
      .single();
    if (!client?.contact_email) return false;
    const first = (client.contact_name ?? "").trim().split(/\s+/)[0] || "there";
    const price = client.custom_monthly_price
      ? `${formatMoney(client.custom_monthly_price, client.currency)} per month`
      : "your agreed monthly fee";
    const text = [
      `Hi ${first},`,
      "",
      `Payment received, and welcome aboard. Your managed service for ${client.company_name} is confirmed at ${price}.`,
      "",
      "What happens next: setup begins on our side straight away, and you will hear from us within one working day with the first steps and anything we need from you.",
      "",
      "This email is your confirmation; a receipt follows separately from our payment provider.",
      "",
      entityConfig.brandName,
    ].join("\n");
    return sendEmail({
      to: client.contact_email,
      subject: `Payment confirmed, welcome aboard ${client.company_name}`,
      text,
    });
  } catch (e) {
    console.error("Payment confirmation email failed:", e);
    return false;
  }
}

/** Signed-agreement copy: sent from the proposal-engine webhook the moment the
 *  click-wrap is accepted. The engine's proposal URL is permanent, so this
 *  email is the client's durable copy of what they signed. */
export async function sendContractCopyFor(
  clientId: string,
  documentUrl: string,
): Promise<boolean> {
  if (!configured()) return false;
  try {
    const supabase = createSupabaseAdminClient();
    const { data: client } = await supabase
      .from("clients")
      .select("company_name, contact_name, contact_email")
      .eq("id", clientId)
      .single();
    if (!client?.contact_email) return false;
    const first = (client.contact_name ?? "").trim().split(/\s+/)[0] || "there";
    const text = [
      `Hi ${first},`,
      "",
      `This confirms your acceptance of the service agreement for ${client.company_name}. Your copy of the signed document, including the acceptance record, is here:`,
      "",
      documentUrl,
      "",
      "That link is permanent, so this email serves as your copy for your records. If anything in the agreement needs discussing, just reply.",
      "",
      entityConfig.brandName,
    ].join("\n");
    return sendEmail({
      to: client.contact_email,
      subject: `Your signed agreement, ${client.company_name}`,
      text,
    });
  } catch (e) {
    console.error("Contract copy email failed:", e);
    return false;
  }
}

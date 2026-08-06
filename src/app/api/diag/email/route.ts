// Proves email actually WORKS on this deployment, rather than proving a
// variable exists. Sends one message to CONTRACT_COPY_TO and nowhere else, so
// it can never reach a client. Reports the provider's verdict rather than
// assuming success.
//
// Presence of RESEND_API_KEY tells you nothing about whether the key is valid,
// whether the From domain is verified in THAT Resend account, or whether the
// account can send at all. Only a send tells you that.
import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { auth0 } from "@/lib/auth/auth0";
import { isAgencyAdmin } from "@/lib/auth/roles";
import { sendEmail } from "@/lib/email";
import { entityConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

function relayOk(request: Request): boolean {
  for (const [envName, header] of [
    ["BERNARD_RELAY_KEY", "x-bernard-relay-key"],
    ["OSCAR_RELAY_KEY", "x-oscar-relay-key"],
  ] as const) {
    const expected = process.env[envName];
    const given = request.headers.get(header);
    if (!expected || !given) continue;
    const a = Buffer.from(given);
    const b = Buffer.from(expected);
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }
  return false;
}

export async function POST(request: Request) {
  if (!relayOk(request)) {
    const session = await auth0.getSession();
    const user = session?.user as Record<string, unknown> | undefined;
    if (!user || !isAgencyAdmin(user)) {
      return NextResponse.json({ error: "Not authorised." }, { status: 401 });
    }
  }

  const to = entityConfig.contractCopyTo;
  if (!to) {
    return NextResponse.json(
      { ok: false, reason: "CONTRACT_COPY_TO is not set, so there is no safe internal address to test with." },
      { status: 400 },
    );
  }
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    return NextResponse.json(
      {
        ok: false,
        reason: "Email is not configured on this deployment.",
        has_key: !!process.env.RESEND_API_KEY,
        has_from: !!process.env.EMAIL_FROM,
      },
      { status: 400 },
    );
  }

  const stamp = new Date().toISOString();
  const sent = await sendEmail({
    to,
    subject: `${entityConfig.brandName}: email delivery test`,
    text: [
      `This is a delivery test from ${process.env.APP_BASE_URL ?? "this deployment"}.`,
      "",
      `Sent at ${stamp}.`,
      "",
      "If you are reading this, the sending domain is verified in this deployment's Resend account and client emails will go out: onboarding invite, agreement issued, signed copy, payment confirmation.",
    ].join("\n"),
  });

  return NextResponse.json({
    ok: sent,
    to,
    from_domain: (process.env.EMAIL_FROM ?? "").split("@").pop()?.replace(/>.*$/, "") ?? "",
    sent_at: stamp,
    note: sent
      ? "Provider accepted the message. Check the inbox to confirm delivery."
      : "Provider REJECTED the send. Most likely the From domain is not verified in the Resend account this key belongs to, or the key is invalid.",
  });
}

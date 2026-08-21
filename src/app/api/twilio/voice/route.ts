// TwiML endpoint the TwiML App points at. Twilio POSTs here when the browser
// client places a call; the response tells Twilio what to dial.
//
// Two independent guards:
//   1. A shared secret in the query string (set on the TwiML App's voice URL),
//      because this route must be reachable by Twilio without a session. It is
//      excluded from the Auth0 proxy matcher for the same reason.
//   2. The same UK-range allowlist as scripts/call.mjs. Caller ID is pinned
//      server-side; nothing from the client can change it.
import { timingSafeEqual } from "node:crypto";
import { normaliseUkTarget } from "@/lib/twilio";

const xml = (body: string) =>
  new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`, {
    headers: { "Content-Type": "text/xml" },
  });

export async function POST(request: Request) {
  const expected = process.env.TWILIO_VOICE_WEBHOOK_SECRET ?? "";
  const given = new URL(request.url).searchParams.get("key") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (!expected || a.length !== b.length || !timingSafeEqual(a, b)) {
    return new Response("Forbidden", { status: 403 });
  }

  const form = await request.formData().catch(() => null);
  const to = normaliseUkTarget(String(form?.get("To") ?? ""));
  if (!to) {
    return xml(`<Say voice="alice" language="en-GB">That number is outside the permitted UK ranges.</Say><Hangup/>`);
  }

  const callerId = process.env.TWILIO_CALLER_ID ?? "";
  return xml(`<Dial callerId="${callerId}" answerOnBridge="true"><Number>${to}</Number></Dial>`);
}

// Twilio Voice helpers for the browser dialer.
//
// The access token is minted by hand (HS256 JWT signed with the API key
// secret) rather than pulling in the full twilio SDK for one function.
// Token shape per https://www.twilio.com/docs/iam/access-tokens.
import { createHmac } from "node:crypto";

const b64url = (input: Buffer | string) =>
  Buffer.from(input).toString("base64url");

export function mintVoiceToken(identity: string): string {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const keySid = process.env.TWILIO_API_KEY_SID;
  const secret = process.env.TWILIO_API_KEY_SECRET;
  const appSid = process.env.TWILIO_TWIML_APP_SID;
  if (!accountSid || !keySid || !secret || !appSid) {
    throw new Error("Twilio voice env vars missing (TWILIO_ACCOUNT_SID / TWILIO_API_KEY_SID / TWILIO_API_KEY_SECRET / TWILIO_TWIML_APP_SID).");
  }
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT", cty: "twilio-fpa;v=1" };
  const payload = {
    jti: `${keySid}-${now}`,
    iss: keySid,
    sub: accountSid,
    iat: now,
    exp: now + 3600,
    grants: {
      identity,
      voice: { outgoing: { application_sid: appSid } },
    },
  };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const signature = createHmac("sha256", secret).update(signingInput).digest("base64url");
  return `${signingInput}.${signature}`;
}

// Same guard as scripts/call.mjs: normal UK ranges only (01/02/03/07).
// Premium-rate (09, 084/087, 070) and non-UK targets are refused.
export function normaliseUkTarget(raw: string): string | null {
  let to = (raw || "").replace(/[^\d+]/g, "");
  if (/^0\d{9,10}$/.test(to)) to = "+44" + to.slice(1);
  else if (/^44\d{9,10}$/.test(to)) to = "+" + to;
  if (!/^\+44[1237]\d{8,9}$/.test(to)) return null;
  return to;
}

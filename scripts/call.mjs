#!/usr/bin/env node
// Callback bridge: lets the founder call UK numbers from Dubai with no VoIP
// on his side. Twilio rings his mobile from the WMI 020 first (an ordinary
// inbound call, nothing the UAE networks restrict); when he answers, it dials
// the target presenting the 020. Usage:
//   node scripts/call.mjs "020 7946 0018"     (UK formats or +44 accepted)
//
// Guard: only normal UK ranges (01/02/03/07). Premium-rate (09, 084/087,
// 070) and non-UK targets are refused outright.
import { readFileSync } from "node:fs";

const env = readFileSync(`${process.env.HOME}/.config/singularweb/substrate.env`, "utf8");
const get = (k) => {
  const line = env.split("\n").find((l) => l.startsWith(k + "="));
  return line ? line.slice(k.length + 1).trim() : "";
};
const SID = get("TWILIO_ACCOUNT_SID");
const KEY = get("TWILIO_API_KEY_SID");
const SECRET = get("TWILIO_API_KEY_SECRET");
const FOUNDER_MOBILE = "+971504468897";
const CALLER_ID = "+442045383367"; // WMI outbound (UK)

let to = (process.argv[2] || "").replace(/[^\d+]/g, "");
if (/^0\d{9,10}$/.test(to)) to = "+44" + to.slice(1);
else if (/^44\d{9,10}$/.test(to)) to = "+" + to;
if (!/^\+44[1237]\d{8,9}$/.test(to)) {
  console.error(`Refusing: target must be a normal UK number (01/02/03/07 ranges). Got: ${to || "(nothing)"}`);
  process.exit(2);
}

const twiml = `<Response><Say voice="alice" language="en-GB">Connecting you now.</Say><Dial callerId="${CALLER_ID}" answerOnBridge="true"><Number>${to}</Number></Dial></Response>`;
const body = new URLSearchParams({ To: FOUNDER_MOBILE, From: CALLER_ID, Twiml: twiml, Timeout: "30" });
const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${SID}/Calls.json`, {
  method: "POST",
  headers: {
    Authorization: "Basic " + Buffer.from(`${KEY}:${SECRET}`).toString("base64"),
    "Content-Type": "application/x-www-form-urlencoded",
  },
  body,
});
const d = await res.json();
if (d.sid) {
  console.log(`Bridge placed (${d.sid}). Your mobile rings from 020 4538 3367; answer and it dials ${to} showing the 020.`);
} else {
  console.error("ERROR", d.code, d.message);
  process.exit(1);
}

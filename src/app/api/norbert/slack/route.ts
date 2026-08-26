// Norbert's Slack surface (WMILTD workspace). A dedicated Slack app ("Norbert",
// its own bot token and signing secret, separate from the client-channel
// provisioning bot) sends events here; Norbert answers by chat.postMessage.
//
// Slack demands an ack within 3 seconds and a Norbert turn takes minutes, so
// the handler verifies, acks 200 immediately, and runs the turn inside
// next/server's after(), which keeps executing up to this route's maxDuration.
//
// The conversation joins the same "norbert" scope as the portal chat and the
// Code relay: one mind, three surfaces, one thread.
//
// SECURITY MODEL, deliberate and fail-closed:
// - Every request is signature-verified (Slack v0 HMAC over the raw body,
//   timing-safe, stale timestamps rejected). No secret configured = 503.
// - Only Slack user ids in SLACK_NORBERT_ALLOWED_USERS may speak to him. The
//   workspace holds contractors and (via client channels) clients; Norbert
//   dispatches briefs to agents, so his ear is founder-only. Everyone else
//   gets one polite line and nothing reaches the model.
// - Slack retries delivery when an ack is slow (cold start); a retried event
//   is acked and dropped, because a duplicated Norbert run (which can dispatch
//   briefs) is worse than a rarely dropped message.
import { NextResponse } from "next/server";
import { after } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { runNorbertChatStream } from "@/lib/integrations/anthropic/norbert-agent";
import type { AgentEvent, ChatMessage } from "@/lib/integrations/anthropic/agent";
import { loadConversation, appendTurns } from "@/lib/agent-conversations";

// A Norbert turn can contain a dispatched agent run; same headroom as the chat.
export const maxDuration = 300;

const SCOPE = "norbert";
const SLACK_API = "https://slack.com/api";

function botToken(): string | null {
  return process.env.SLACK_NORBERT_BOT_TOKEN ?? null;
}

function allowedUsers(): Set<string> {
  return new Set(
    (process.env.SLACK_NORBERT_ALLOWED_USERS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

/** Slack request signature: v0=HMAC_SHA256(secret, "v0:{ts}:{rawBody}"). */
function verifySignature(rawBody: string, timestamp: string | null, signature: string | null): boolean {
  const secret = process.env.SLACK_NORBERT_SIGNING_SECRET;
  if (!secret || !timestamp || !signature) return false;
  // Reject replays: Slack says discard anything older than five minutes.
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;
  const expected = "v0=" + createHmac("sha256", secret).update(`v0:${timestamp}:${rawBody}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function slackApi(method: string, body: Record<string, unknown>): Promise<void> {
  const token = botToken();
  if (!token) return;
  try {
    const res = await fetch(`${SLACK_API}/${method}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { ok: boolean; error?: string };
    if (!data.ok) console.error(`Norbert Slack ${method} failed: ${data.error}`);
  } catch (e) {
    console.error(`Norbert Slack ${method} failed:`, e);
  }
}

/** Norbert writes markdown; Slack renders mrkdwn. Convert the constructs that
 *  actually differ and leave the rest alone. */
function toMrkdwn(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, "<$2|$1>") // [t](url) -> <url|t>
    .replace(/^#{1,6}\s+(.+)$/gm, "*$1*") // headings -> bold lines
    .replace(/\*\*([^*\n]+)\*\*/g, "*$1*"); // **bold** -> *bold*
}

/** Split a long reply on paragraph boundaries; Slack messages read badly past
 *  a few thousand characters and hard-cap at 40k. */
function chunk(text: string, max = 3800): string[] {
  if (text.length <= max) return [text];
  const parts: string[] = [];
  let current = "";
  for (const para of text.split("\n\n")) {
    const piece = para.length > max ? para.slice(0, max) : para;
    if (current && current.length + piece.length + 2 > max) {
      parts.push(current);
      current = piece;
    } else {
      current = current ? `${current}\n\n${piece}` : piece;
    }
  }
  if (current) parts.push(current);
  return parts;
}

interface SlackEvent {
  type: string;
  channel_type?: string;
  user?: string;
  text?: string;
  ts?: string;
  thread_ts?: string;
  channel?: string;
  bot_id?: string;
  subtype?: string;
}

/** The whole Norbert turn, run inside after() once Slack has its 200. */
async function handleEvent(event: SlackEvent): Promise<void> {
  const channel = event.channel!;
  const threadTs = event.thread_ts ?? (event.type === "app_mention" ? event.ts : undefined);
  const say = (text: string) =>
    slackApi("chat.postMessage", { channel, text, ...(threadTs ? { thread_ts: threadTs } : {}) });

  if (!allowedUsers().has(event.user ?? "")) {
    await say("I only take instructions from Antoine. Anything for the account teams goes through him.");
    return;
  }

  // Strip the bot mention from channel messages so Norbert reads clean text.
  const text = (event.text ?? "").replace(/<@[A-Z0-9]+>/g, "").trim();
  if (!text) {
    await say("Say the word and I am on it. I read both agents' live state and dispatch briefs on your say-so.");
    return;
  }

  // Show he heard, before the minutes of thinking start.
  if (event.ts) await slackApi("reactions.add", { channel, name: "eyes", timestamp: event.ts });

  // One thread across surfaces: same history and persistence as portal + relay.
  const prior = (await loadConversation(SCOPE)).slice(-20);
  const history: ChatMessage[] = [...prior, { role: "user", content: text }];

  let reply = "";
  let error: string | null = null;
  const collect = (ev: AgentEvent) => {
    if (ev.type === "delta" && ev.text) reply += ev.text;
    else if (ev.type === "reset") reply = "";
    else if (ev.type === "error" && ev.text) error = ev.text;
  };
  try {
    await runNorbertChatStream(history, "antoine.martin@wmiltd.com (slack)", collect);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  reply = reply.trim();

  if (error && !reply) {
    await say(`I hit an error and could not finish: ${error}`);
    return;
  }

  const toStore: { role: "user" | "assistant"; content: string }[] = [
    { role: "user", content: text },
  ];
  if (reply) toStore.push({ role: "assistant", content: reply });
  await appendTurns(SCOPE, null, toStore, "antoine.martin@wmiltd.com (slack)");

  for (const part of chunk(toMrkdwn(reply || "(I produced no text on that one. Try me again.)"))) {
    await say(part);
  }
}

export async function POST(request: Request) {
  // Raw body first: the signature covers the exact bytes.
  const rawBody = await request.text();
  if (!process.env.SLACK_NORBERT_SIGNING_SECRET) {
    return NextResponse.json({ error: "Norbert's Slack surface is not configured." }, { status: 503 });
  }
  if (
    !verifySignature(
      rawBody,
      request.headers.get("x-slack-request-timestamp"),
      request.headers.get("x-slack-signature"),
    )
  ) {
    return NextResponse.json({ error: "Bad signature." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  // Slack's one-time endpoint handshake when the Request URL is saved.
  if (body.type === "url_verification") {
    return NextResponse.json({ challenge: body.challenge });
  }

  // A retry means our first ack was slow (cold start), not that the event was
  // lost: the original delivery is still processing. Ack and drop, and tell
  // Slack not to retry further; a duplicated run is the worse failure here.
  if (request.headers.get("x-slack-retry-num")) {
    return new NextResponse("ok", { headers: { "X-Slack-No-Retry": "1" } });
  }

  if (body.type !== "event_callback") return new NextResponse("ok");
  const event = (body.event ?? {}) as SlackEvent;

  // Only two shapes reach the model: a DM to Norbert, or an @Norbert mention.
  const isDm = event.type === "message" && event.channel_type === "im";
  const isMention = event.type === "app_mention";
  if (!isDm && !isMention) return new NextResponse("ok");
  // Never answer bots (including himself) or message edits/deletions.
  if (event.bot_id || event.subtype || !event.user || !event.channel) return new NextResponse("ok");

  after(() => handleEvent(event));
  return new NextResponse("ok");
}

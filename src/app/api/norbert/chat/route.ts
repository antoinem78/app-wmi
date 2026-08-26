// Norbert chat endpoint, admin-only. Streams the supervisor's replies as
// NDJSON events, same wire shape as /api/bernard/chat and /api/agent/chat so
// the client plumbing is shared. Conversation persists in agent_conversations
// under the fixed "norbert" scope.
import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { auth0 } from "@/lib/auth/auth0";
import { isAgencyAdmin } from "@/lib/auth/roles";
import type { AgentEvent, ChatMessage } from "@/lib/integrations/anthropic/agent";
import { runNorbertChatStream } from "@/lib/integrations/anthropic/norbert-agent";
import { loadConversation, appendTurns, clearConversation } from "@/lib/agent-conversations";
import {
  attachmentsFromFormData,
  transcriptNote,
  AttachmentError,
  type Attachment,
} from "@/lib/attachments";

// A Norbert turn can contain a full dispatched agent run (brief_oscar or
// brief_bernard runs the target agent's own 8-iteration loop inline), so this
// route gets more headroom than the single-agent chats.
export const maxDuration = 300;

const SCOPE = "norbert";

// The relay lets the founder reach Norbert from outside the portal (Claude
// Code sessions via scripts/agent-relay.mjs). Same handler, same conversation
// scope, so both surfaces are one thread. Header key only; the key lives in
// NORBERT_RELAY_KEY and is never written into the repo.
function relayActor(request: Request): string | null {
  const expected = process.env.NORBERT_RELAY_KEY;
  const given = request.headers.get("x-norbert-relay-key");
  if (!expected || !given) return null;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return "antoine.martin@wmiltd.com (code chat)";
}

async function requireAdmin(request?: Request) {
  if (request) {
    const relay = relayActor(request);
    if (relay) return { actor: relay };
  }
  const session = await auth0.getSession();
  if (!session) return { error: NextResponse.json({ error: "Not signed in." }, { status: 401 }) };
  const sUser = session.user as Record<string, unknown>;
  if (!isAgencyAdmin(sUser)) {
    return { error: NextResponse.json({ error: "Agency admin only." }, { status: 403 }) };
  }
  return { actor: typeof sUser.email === "string" ? sUser.email : "agency_admin" };
}

// Hydrate prior turns (chat reload / cross-page persistence / relay pickup).
export async function GET(request: Request) {
  const gate = await requireAdmin(request);
  if (gate.error) return gate.error;
  const turns = await loadConversation(SCOPE);
  return NextResponse.json({ messages: turns });
}

// Clear the Norbert conversation. Deliberately NOT relay-accessible: wiping
// the shared thread stays a portal-session action.
export async function DELETE() {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;
  await clearConversation(SCOPE);
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  const gate = await requireAdmin(request);
  if (gate.error) return gate.error;
  const actor = gate.actor!;

  // Two request shapes: JSON (text only) and multipart/form-data (text plus
  // attachments), the latter carrying the history as a "messages" JSON field.
  let body: { messages?: unknown };
  let attachments: Attachment[] = [];
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return NextResponse.json({ error: "Could not read the upload." }, { status: 400 });
    }
    try {
      body = JSON.parse(String(form.get("messages") ?? "{}")) as { messages?: unknown };
    } catch {
      return NextResponse.json({ error: "Invalid messages payload." }, { status: 400 });
    }
    try {
      attachments = await attachmentsFromFormData(form);
    } catch (e) {
      const msg = e instanceof AttachmentError ? e.message : "That file could not be read.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  } else {
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
    }
  }

  const raw = Array.isArray(body.messages) ? body.messages : [];
  const messages: ChatMessage[] = raw
    .filter((m): m is ChatMessage =>
      !!m && typeof m === "object" &&
      (((m as ChatMessage).role === "user") || ((m as ChatMessage).role === "assistant")) &&
      typeof (m as ChatMessage).content === "string",
    )
    .slice(-20); // cap history

  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return NextResponse.json({ error: "Expected a user message." }, { status: 400 });
  }
  const userTurn = messages[messages.length - 1];

  // Persist the founder's turn BEFORE generating (process feedback 2026-08-26,
  // item 2): the question must survive even if the answer dies mid-stream.
  const stored = attachments.length
    ? [...attachments.map(transcriptNote), userTurn.content].join("\n\n")
    : userTurn.content;
  await appendTurns(SCOPE, null, [{ role: "user", content: stored }], actor);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // assistantText is what gets PERSISTED, so a reset deletes the reply from
      // the transcript, not just the screen. Safe only because the stream emits
      // reset solely for genuine preamble (never on a bookkeeping-only turn).
      let assistantText = "";
      const send = (ev: AgentEvent) => {
        if (ev.type === "delta" && ev.text) assistantText += ev.text;
        else if (ev.type === "reset") assistantText = "";
        try {
          controller.enqueue(encoder.encode(JSON.stringify(ev) + "\n"));
        } catch {
          /* controller closed (client disconnected) */
        }
      };
      try {
        await runNorbertChatStream(messages, actor, send, attachments);
        // End-of-response marker: a stream ending without it was truncated.
        send({ type: "complete" });
      } catch (e) {
        console.error("Norbert chat failed:", e);
        send({ type: "error", text: "Norbert hit an error. Try again." });
      } finally {
        // The user turn is stored pre-stream; only the reply lands here.
        if (assistantText.trim())
          await appendTurns(SCOPE, null, [{ role: "assistant", content: assistantText }], actor);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

// Rexos chat endpoint — admin-only. Runs the read-only tool-use agent over the
// account data and returns the assistant's reply. (Non-streaming for v1.)
import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { auth0 } from "@/lib/auth/auth0";
import { isAgencyAdmin } from "@/lib/auth/roles";
import { runAgentChatStream, type AgentEvent, type ChatMessage } from "@/lib/integrations/anthropic/agent";
import {
  loadConversation,
  appendTurns,
  clearConversation,
  COMMAND_CENTER_SCOPE,
} from "@/lib/agent-conversations";
import {
  attachmentsFromFormData,
  transcriptNote,
  AttachmentError,
  type Attachment,
} from "@/lib/attachments";

export const maxDuration = 120;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// A conversation scope is either the agency-wide command centre or a client id.
// clientId is set only for the latter (drives the cascade FK).
function resolveScope(raw: unknown): { scope: string; clientId: string | null } {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (s && s !== COMMAND_CENTER_SCOPE && UUID_RE.test(s)) return { scope: s, clientId: s };
  return { scope: COMMAND_CENTER_SCOPE, clientId: null };
}

// The relay lets the founder reach Oscar from outside the portal (Claude Code
// sessions via scripts/agent-relay.mjs). Same handler, same conversation
// scopes, so both surfaces are one thread. Header key only; the key lives in
// OSCAR_RELAY_KEY and is never written into the repo. Mirrors the Bernard
// relay on /api/bernard/chat.
function relayActor(request: Request): string | null {
  const expected = process.env.OSCAR_RELAY_KEY;
  const given = request.headers.get("x-oscar-relay-key");
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
  return { actor: typeof sUser.email === "string" ? sUser.email : "rexos-agent" };
}

// Hydrate prior turns for a scope (chat reload / cross-page persistence /
// relay pickup).
export async function GET(request: Request) {
  const gate = await requireAdmin(request);
  if (gate.error) return gate.error;
  const { scope } = resolveScope(new URL(request.url).searchParams.get("scope"));
  const turns = await loadConversation(scope);
  return NextResponse.json({ messages: turns });
}

// Clear a scope's conversation. Deliberately NOT relay-accessible: wiping a
// shared thread stays a portal-session action.
export async function DELETE(request: Request) {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;
  const { scope } = resolveScope(new URL(request.url).searchParams.get("scope"));
  await clearConversation(scope);
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  const gate = await requireAdmin(request);
  if (gate.error) return gate.error;
  const actor = gate.actor!;

  // Two request shapes: JSON (text only) and multipart/form-data (text plus
  // attachments), the latter carrying the history as a "messages" JSON field.
  // Same contract as /api/bernard/chat so the client plumbing stays shared.
  let body: { messages?: unknown; scope?: unknown };
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
      body = JSON.parse(String(form.get("messages") ?? "{}")) as {
        messages?: unknown;
        scope?: unknown;
      };
    } catch {
      return NextResponse.json({ error: "Invalid messages payload." }, { status: 400 });
    }
    // The scope rides in the JSON field with the history, but accept a separate
    // form field too so a hand-rolled multipart caller cannot silently land the
    // turn in the command-centre thread instead of the client's.
    const formScope = form.get("scope");
    if (typeof formScope === "string" && formScope) body.scope = formScope;
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

  const { scope, clientId } = resolveScope(body.scope);
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

  // Stream the answer as newline-delimited JSON events (status / delta / done / error).
  // Accumulate the assistant's final text so we can persist the turn pair after
  // the stream completes ('reset' clears any tool-use preamble, matching the UI).
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
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
        // When the conversation is scoped to a client (per-account thread), that
        // client id is also the analyst's FOCUS account — forward it so the agent
        // treats questions as about that account instead of asking "which?".
        await runAgentChatStream(messages, actor, send, clientId, attachments);
      } catch (e) {
        console.error("Agent chat failed:", e);
        send({ type: "error", text: "The assistant hit an error. Try again." });
      } finally {
        // Persist the new turn pair (best-effort; no-op if migration 0018 unrun).
        // Store the attachments alongside the founder's text: extracted text
        // inline so later turns still have it, PDFs as a filename marker only.
        const stored = attachments.length
          ? [...attachments.map(transcriptNote), userTurn.content].join("\n\n")
          : userTurn.content;
        const toStore: { role: "user" | "assistant"; content: string }[] = [
          { role: "user", content: stored },
        ];
        if (assistantText.trim()) toStore.push({ role: "assistant", content: assistantText });
        await appendTurns(scope, clientId, toStore, actor);
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

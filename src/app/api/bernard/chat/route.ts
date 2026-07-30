// Bernard chat endpoint — admin-only. Streams the Meta Lab supervisor's
// replies (Claude Fable 5, medium effort) as NDJSON events, same wire shape as
// /api/agent/chat so the client plumbing is shared. Conversation persists in
// agent_conversations under the fixed "bernard" scope.
import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth/auth0";
import { isAgencyAdmin } from "@/lib/auth/roles";
import type { AgentEvent, ChatMessage } from "@/lib/integrations/anthropic/agent";
import { runBernardChatStream } from "@/lib/integrations/anthropic/bernard-agent";
import { loadConversation, appendTurns, clearConversation } from "@/lib/agent-conversations";
import {
  attachmentsFromFormData,
  transcriptNote,
  AttachmentError,
  type Attachment,
} from "@/lib/attachments";

export const maxDuration = 120;

const SCOPE = "bernard";

async function requireAdmin() {
  const session = await auth0.getSession();
  if (!session) return { error: NextResponse.json({ error: "Not signed in." }, { status: 401 }) };
  const sUser = session.user as Record<string, unknown>;
  if (!isAgencyAdmin(sUser)) {
    return { error: NextResponse.json({ error: "Agency admin only." }, { status: 403 }) };
  }
  return { actor: typeof sUser.email === "string" ? sUser.email : "agency_admin" };
}

// Hydrate prior turns (chat reload / cross-page persistence).
export async function GET() {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;
  const turns = await loadConversation(SCOPE);
  return NextResponse.json({ messages: turns });
}

// Clear the Bernard conversation.
export async function DELETE() {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;
  await clearConversation(SCOPE);
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  const gate = await requireAdmin();
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
        await runBernardChatStream(messages, actor, send, attachments);
      } catch (e) {
        console.error("Bernard chat failed:", e);
        send({ type: "error", text: "Bernard hit an error. Try again." });
      } finally {
        // Store the attachments alongside the founder's text: extracted text
        // inline so later turns still have it, PDFs as a filename marker only.
        const stored = attachments.length
          ? [...attachments.map(transcriptNote), userTurn.content].join("\n\n")
          : userTurn.content;
        const toStore: { role: "user" | "assistant"; content: string }[] = [
          { role: "user", content: stored },
        ];
        if (assistantText.trim()) toStore.push({ role: "assistant", content: assistantText });
        await appendTurns(SCOPE, null, toStore, actor);
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

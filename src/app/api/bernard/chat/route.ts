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

  let body: { messages?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
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
        await runBernardChatStream(messages, actor, send);
      } catch (e) {
        console.error("Bernard chat failed:", e);
        send({ type: "error", text: "Bernard hit an error. Try again." });
      } finally {
        const toStore: { role: "user" | "assistant"; content: string }[] = [
          { role: "user", content: userTurn.content },
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

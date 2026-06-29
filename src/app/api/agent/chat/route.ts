// Rexos chat endpoint — admin-only. Runs the read-only tool-use agent over the
// account data and returns the assistant's reply. (Non-streaming for v1.)
import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth/auth0";
import { isAgencyAdmin } from "@/lib/auth/roles";
import { runAgentChat, type ChatMessage } from "@/lib/integrations/anthropic/agent";

export const maxDuration = 120;

export async function POST(request: Request) {
  const session = await auth0.getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!isAgencyAdmin(session.user as Record<string, unknown>)) {
    return NextResponse.json({ error: "Agency admin only." }, { status: 403 });
  }

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

  try {
    const { reply } = await runAgentChat(messages);
    return NextResponse.json({ reply });
  } catch (e) {
    console.error("Agent chat failed:", e);
    return NextResponse.json({ error: "The assistant hit an error. Try again." }, { status: 500 });
  }
}

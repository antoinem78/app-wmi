// Persistence for the Rexos chat (parity P2). Turns are stored per `scope`
// ('command-center' or a client id) so a conversation reloads across page
// navigation. Best-effort: if the table doesn't exist yet (migration 0018 not
// run), reads return [] and writes silently no-op — the chat still works, just
// without memory.
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const COMMAND_CENTER_SCOPE = "command-center";

export interface StoredTurn {
  role: "user" | "assistant";
  content: string;
}

/** Load the last `limit` turns for a scope, oldest-first (ready to render/replay). */
export async function loadConversation(
  scope: string,
  limit = 40,
): Promise<StoredTurn[]> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("agent_conversations")
      .select("role, content")
      .eq("scope", scope)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data
      .reverse()
      .map((r) => ({ role: r.role as "user" | "assistant", content: r.content as string }));
  } catch {
    return [];
  }
}

/** Append turns to a scope's conversation. `clientId` is set for account threads. */
export async function appendTurns(
  scope: string,
  clientId: string | null,
  turns: StoredTurn[],
  actor: string,
): Promise<void> {
  if (!turns.length) return;
  try {
    const supabase = createSupabaseAdminClient();
    await supabase.from("agent_conversations").insert(
      turns.map((t) => ({
        scope,
        client_id: clientId,
        role: t.role,
        content: t.content,
        actor,
      })),
    );
  } catch {
    /* table may not exist yet — memory is best-effort */
  }
}

/** Wipe a scope's conversation (the "Clear" action). */
export async function clearConversation(scope: string): Promise<void> {
  try {
    const supabase = createSupabaseAdminClient();
    await supabase.from("agent_conversations").delete().eq("scope", scope);
  } catch {
    /* best-effort */
  }
}

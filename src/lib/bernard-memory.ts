// Bernard's durable memory. Deliberately separate from agent_conversations:
// clearing the chat drops the transcript and must leave what Bernard KNOWS
// intact. Founder ruling 2026-07-30 — Bernard is the senior paid social
// strategist, so he carries client context and prior decisions across sessions
// indefinitely and forgets only on instruction.
//
// Best-effort throughout, matching agent-conversations: if migration 0002 has
// not been applied, reads return empty and writes report a failure Bernard can
// relay, rather than throwing and killing the turn.
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type MemoryKind =
  | "client"
  | "account"
  | "decision"
  | "preference"
  | "strategy"
  | "fact";

export const MEMORY_KINDS: MemoryKind[] = [
  "client",
  "account",
  "decision",
  "preference",
  "strategy",
  "fact",
];

export interface Memory {
  id: string;
  kind: MemoryKind;
  subject: string;
  content: string;
  createdAt: string;
}

/** Ceiling on what we inject into the system prompt. Memory is meant to grow
 *  for years; the prompt is not. When this bites, the fix is Bernard pruning
 *  and consolidating rather than us silently truncating more. */
const MAX_MEMORIES = 150;
const MAX_CHARS = 24_000;

/** Every live memory, oldest first within each subject so a subject reads as a
 *  small narrative rather than a shuffled pile. */
export async function loadMemories(): Promise<Memory[]> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("bernard_memory")
      .select("id, kind, subject, content, created_at")
      .is("forgotten_at", null)
      .order("subject", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(MAX_MEMORIES);
    if (error || !data) return [];
    return data.map((r) => ({
      id: r.id as string,
      kind: r.kind as MemoryKind,
      subject: r.subject as string,
      content: r.content as string,
      createdAt: r.created_at as string,
    }));
  } catch {
    return [];
  }
}

/** Render memories for the system prompt, grouped by subject, with ids so
 *  Bernard can revise or forget a specific one by reference. */
export function renderMemories(memories: Memory[]): string {
  if (!memories.length) {
    return "Your memory is currently empty. As soon as you learn something durable, write it down with the remember tool.";
  }
  const bySubject = new Map<string, Memory[]>();
  for (const m of memories) {
    const list = bySubject.get(m.subject) ?? [];
    list.push(m);
    bySubject.set(m.subject, list);
  }
  const lines: string[] = [];
  let chars = 0;
  let dropped = 0;
  for (const [subject, list] of bySubject) {
    const header = `\n[${subject}]`;
    if (chars + header.length > MAX_CHARS) { dropped += list.length; continue; }
    lines.push(header);
    chars += header.length;
    for (const m of list) {
      const line = `  (${m.kind}, ${m.createdAt.slice(0, 10)}, id ${m.id}) ${m.content}`;
      if (chars + line.length > MAX_CHARS) { dropped++; continue; }
      lines.push(line);
      chars += line.length;
    }
  }
  if (dropped) {
    lines.push(
      `\n[${dropped} older memories omitted for length. Consolidate related memories so nothing important sits outside this window.]`,
    );
  }
  return lines.join("\n").trim();
}

export async function remember(
  kind: MemoryKind,
  subject: string,
  content: string,
  actor: string,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const text = content.trim();
  if (!text) return { ok: false, error: "Nothing to remember (empty content)." };
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("bernard_memory")
      .insert({ kind, subject: subject.trim() || "global", content: text, actor })
      .select("id")
      .single();
    if (error || !data) {
      return { ok: false, error: error?.message ?? "Memory write failed." };
    }
    return { ok: true, id: data.id as string };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Memory write failed." };
  }
}

/** Correct a memory in place. Used when a fact changes rather than turning out
 *  to have been wrong; for wrong, forget it and say why. */
export async function reviseMemory(
  id: string,
  content: string,
): Promise<{ ok: boolean; error?: string }> {
  const text = content.trim();
  if (!text) return { ok: false, error: "Nothing to write (empty content)." };
  try {
    const supabase = createSupabaseAdminClient();
    const { error, count } = await supabase
      .from("bernard_memory")
      .update({ content: text, updated_at: new Date().toISOString() }, { count: "exact" })
      .eq("id", id)
      .is("forgotten_at", null);
    if (error) return { ok: false, error: error.message };
    if (!count) return { ok: false, error: "No live memory with that id." };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Memory revision failed." };
  }
}

/** Soft delete. Nothing is destroyed: a memory the founder asked Bernard to drop
 *  is still evidence of what he believed and when. */
export async function forgetMemory(
  id: string,
  reason: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = createSupabaseAdminClient();
    const { error, count } = await supabase
      .from("bernard_memory")
      .update(
        { forgotten_at: new Date().toISOString(), forgotten_reason: reason.trim() || null },
        { count: "exact" },
      )
      .eq("id", id)
      .is("forgotten_at", null);
    if (error) return { ok: false, error: error.message };
    if (!count) return { ok: false, error: "No live memory with that id." };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Forget failed." };
  }
}

// The founder feedback inbox (Denis brief item 3): the missing middle between a
// chat instruction (ephemeral) and a durable memory (permanent). A note here is
// read at the start of the agent's next run, shown in its context, and archived
// so it does not live forever. "Go easy on client X this week" is the canonical
// example.
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export interface FeedbackNote {
  id: string;
  note: string;
  created_at: string;
}

/** Unread notes for an agent, marked read as a side effect. Read-and-mark is
 *  one operation on purpose: a note consumed into a run's context has done its
 *  job, and leaving it unread would replay it every run, which is what durable
 *  memory is for and this deliberately is not. Archived seven days after being
 *  read, so a note stays inspectable but never re-enters context. */
export async function consumeFeedback(agent: string): Promise<FeedbackNote[]> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data } = await supabase
      .from("agent_feedback")
      .select("id, note, created_at")
      .in("agent", [agent, "all"])
      .is("archived_at", null)
      .is("read_at", null)
      .order("created_at", { ascending: true })
      .limit(10);
    if (!data?.length) return [];
    await supabase
      .from("agent_feedback")
      .update({ read_at: new Date().toISOString(), archived_at: new Date().toISOString() })
      .in("id", data.map((d) => d.id));
    return data;
  } catch {
    return [];
  }
}

export function renderFeedback(notes: FeedbackNote[]): string {
  if (!notes.length) return "";
  return (
    "\n\nFOUNDER STEERING FOR THIS RUN (one-off notes, consumed now, not standing doctrine):\n" +
    notes.map((n) => `- ${n.note} (left ${n.created_at.slice(0, 10)})`).join("\n") +
    "\nApply these to this run's judgement. Do not store them as memories; they expire by design."
  );
}

export async function leaveFeedback(agent: string, note: string, createdBy: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("agent_feedback")
    .insert({ agent, note: note.trim(), created_by: createdBy });
  if (error) throw new Error(error.message);
}

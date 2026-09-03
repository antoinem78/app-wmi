// Pure rules for Norbert's review of Oscar's proposals. No imports, no I/O,
// so tests/norbert-review-rules.test.js runs them directly under Node's type
// stripping. Everything that touches Google Ads, Anthropic or the database
// lives in norbert-review.ts and calls into here.

export const THRASH_N = 4;
export const THRASH_WINDOW_DAYS = 7;
export const MAX_REVISION_ROUNDS = 1;

export interface ChangeRow {
  at: string;             // change_event.change_date_time
  user: string | null;    // change_event.user_email
  op: string | null;      // resource_change_operation
  fields: string | null;  // changed_fields
  resource: string | null;
}

export interface HistoryAssessment {
  readable: boolean;
  changes7d: number;
  thrashing: boolean;
  humanUsers: string[];   // distinct emails not in our own login list
  latestAt: string | null;
}

/** Assess an entity's recent change history. `rows` null means the read failed,
 *  and the assessment says so rather than pretending the entity is quiet: an
 *  unreadable history fails closed (Bernard's leg, 2026-08-18), it never reads
 *  as zero changes. `ownLogins` are the agency's own Google logins; a change by
 *  anyone else is a human (usually the freelancer) and gets named. */
export function assessHistory(rows: ChangeRow[] | null, ownLogins: string[]): HistoryAssessment {
  if (!rows) return { readable: false, changes7d: 0, thrashing: false, humanUsers: [], latestAt: null };
  const own = new Set(ownLogins.map((s) => s.trim().toLowerCase()).filter(Boolean));
  const humans = new Set<string>();
  let latest: string | null = null;
  for (const r of rows) {
    const u = (r.user ?? "").trim().toLowerCase();
    if (u && !own.has(u)) humans.add(u);
    if (r.at && (!latest || r.at > latest)) latest = r.at;
  }
  return {
    readable: true,
    changes7d: rows.length,
    thrashing: rows.length >= THRASH_N,
    humanUsers: [...humans].sort(),
    latestAt: latest,
  };
}

export interface Verdict {
  sound: boolean;
  q1: string;
  q2: string | null;
}

/** Parse Norbert's JSON reply. Tolerates prose around the JSON. Returns null
 *  when there is no usable q1, so the caller records a parse failure instead of
 *  inventing a verdict. SOUND (any case, optionally with a trailing sentence)
 *  means sound; anything else is the objection text. */
export function parseVerdict(text: string): Verdict | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let obj: unknown;
  try { obj = JSON.parse(text.slice(start, end + 1)); } catch { return null; }
  if (!obj || typeof obj !== "object") return null;
  const q1raw = (obj as { q1?: unknown }).q1;
  const q1 = typeof q1raw === "string" ? q1raw.trim() : "";
  if (!q1) return null;
  const q2raw = (obj as { q2?: unknown }).q2;
  const q2 = typeof q2raw === "string" && q2raw.trim() ? q2raw.trim() : null;
  return { sound: /^sound\b/i.test(q1), q1, q2 };
}

export interface ReviewRecord {
  at?: string;
  model?: string;
  trigger?: string;
  revision_round?: number;
  verdict?: { sound: boolean; q1: string };
  q2?: string | null;
  history?: HistoryAssessment;
  error?: string;
}

/** The approval gate. Blocks a proposal Norbert has never looked at; lets the
 *  founder through when Norbert objected (disagreeing is Norbert's job,
 *  overruling is the founder's) and when the review itself failed (a Norbert
 *  outage is visible on the card and must not freeze the founder's queue). */
export function approvalGate(review: unknown, reviewedAt: string | null): { ok: true } | { error: string } {
  if (!reviewedAt) {
    return { error: "Norbert has not reviewed this proposal yet. Ask Norbert (button on the card) before approving; his verdict is advice, the decision stays yours." };
  }
  void review;
  return { ok: true };
}

/** Which revision round a new proposal is, given its parent's record. Round 0
 *  is a fresh proposal. A revision of a revision exceeds MAX_REVISION_ROUNDS
 *  and Norbert's verdict on it is final: Oscar does not get a third go. */
export function revisionRound(parent: ReviewRecord | null | undefined): { round: number; final: boolean } {
  if (!parent) return { round: 0, final: false };
  const round = (parent.revision_round ?? 0) + 1;
  return { round, final: round >= MAX_REVISION_ROUNDS };
}

/** One-line summary for Oscar's tool result and the feedback note. */
export function summariseReview(rec: ReviewRecord): string {
  if (rec.error && !rec.verdict) return `Norbert could not review this proposal (${rec.error}). The founder will see that on the card.`;
  const v = rec.verdict!;
  const flags: string[] = [];
  const h = rec.history;
  if (h && !h.readable) flags.push("change history unreadable, treat the entity as unassessed");
  if (h?.thrashing) flags.push(`thrashing: ${h.changes7d} changes in ${THRASH_WINDOW_DAYS} days`);
  if (h?.humanUsers.length) flags.push(`recent human changes by ${h.humanUsers.join(", ")}`);
  const head = v.sound ? "Norbert: SOUND." : `Norbert objects: ${v.q1}`;
  return flags.length ? `${head} Flags: ${flags.join("; ")}.` : head;
}

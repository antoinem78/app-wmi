// Read-only access to the Engine B (agent substrate) database.
//
// Engine B is a SEPARATE Supabase project from this app's DB. The console reads
// it directly over a pooled, READ-ONLY Postgres connection (SUBSTRATE_DB_URL),
// server-side only. n8n remains the agent runtime; this is purely read.
//
// Requires: SUBSTRATE_DB_URL (a read-only role — see docs/platform-integration-phase1.md)
// and the `pg` dependency.

import { Pool } from "pg";

let pool: Pool | undefined;
function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.SUBSTRATE_DB_URL;
    if (!connectionString) {
      throw new Error("SUBSTRATE_DB_URL is not set (read-only substrate connection).");
    }
    pool = new Pool({ connectionString, max: 3, idleTimeoutMillis: 30_000, ssl: { rejectUnauthorized: false } });
  }
  return pool;
}

async function q<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const client = await getPool().connect();
  try {
    // Belt-and-braces: even if the role were mis-granted, force read-only per tx.
    await client.query("SET TRANSACTION READ ONLY");
    const res = await client.query(sql, params);
    return res.rows as T[];
  } finally {
    client.release();
  }
}

export interface ConversationRow {
  session_id: string;
  status: string;
  escalation_class: string | null;
  turns: number;
  created_at: string;
  last_message_at: string;
  transcript: unknown;
}

export async function getConversations(engineBClientId: string, limit = 50): Promise<ConversationRow[]> {
  return q<ConversationRow>(
    `SELECT session_id, status, escalation_class,
            jsonb_array_length(transcript) AS turns,
            created_at, last_message_at, transcript
     FROM conversations
     WHERE client_id = $1::uuid
     ORDER BY last_message_at DESC
     LIMIT $2`,
    [engineBClientId, limit],
  );
}

export interface LeadRow {
  session_id: string;
  status: string;
  ghl_contact_id: string | null;
  last_message_at: string;
}

// Leads = conversations that reached a handoff/contact-captured state.
export async function getLeads(engineBClientId: string, limit = 50): Promise<LeadRow[]> {
  return q<LeadRow>(
    `SELECT session_id, status, ghl_contact_id, last_message_at
     FROM conversations
     WHERE client_id = $1::uuid AND status = 'handoff_pending'
     ORDER BY last_message_at DESC
     LIMIT $2`,
    [engineBClientId, limit],
  );
}

export interface AgentHealth {
  conversations_7d: number;
  handoffs_7d: number;
  handoff_rate_pct: number;
  escalations_7d: number;
  avg_confidence_7d: number | null;
}

export async function getAgentHealth(engineBClientId: string): Promise<AgentHealth> {
  const [row] = await q<AgentHealth>(
    `WITH c AS (
       SELECT * FROM conversations
       WHERE client_id = $1::uuid AND created_at > now() - interval '7 days'
     )
     SELECT
       (SELECT count(*) FROM c)::int AS conversations_7d,
       (SELECT count(*) FROM c WHERE status = 'handoff_pending')::int AS handoffs_7d,
       round(100.0 * (SELECT count(*) FROM c WHERE status = 'handoff_pending')
             / GREATEST((SELECT count(*) FROM c), 1), 1)::float AS handoff_rate_pct,
       (SELECT count(*) FROM c WHERE status = 'escalated')::int AS escalations_7d,
       (SELECT round(avg((m->>'confidence')::numeric), 3)
        FROM c, LATERAL jsonb_array_elements(c.transcript) m
        WHERE m->>'role' = 'agent' AND m->>'outcome' = 'answered' AND m->>'confidence' IS NOT NULL)::float AS avg_confidence_7d`,
    [engineBClientId],
  );
  return row ?? { conversations_7d: 0, handoffs_7d: 0, handoff_rate_pct: 0, escalations_7d: 0, avg_confidence_7d: null };
}

export interface ConversionFunnel {
  chats: number;          // conversations started
  qualified: number;      // reached contact-capture / handoff
  booked: number;         // calendar bookings (via GHL event webhooks -> action_log)
  window_days: number;
}

export async function getConversionFunnel(engineBClientId: string, days = 30): Promise<ConversionFunnel> {
  const [row] = await q<ConversionFunnel>(
    `SELECT
       (SELECT count(*) FROM conversations
          WHERE client_id = $1::uuid AND created_at > now() - ($2 || ' days')::interval)::int AS chats,
       (SELECT count(*) FROM conversations
          WHERE client_id = $1::uuid AND created_at > now() - ($2 || ' days')::interval
            AND (ghl_contact_id IS NOT NULL OR status = 'handoff_pending'))::int AS qualified,
       (SELECT count(*) FROM action_log
          WHERE client_id = $1::uuid AND created_at > now() - ($2 || ' days')::interval
            AND step IN ('appt_booked'))::int AS booked,
       $2::int AS window_days`,
    [engineBClientId, days],
  );
  return row ?? { chats: 0, qualified: 0, booked: 0, window_days: days };
}

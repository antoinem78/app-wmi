-- Substrate (Engine B) migration — applied 2026-07-24 by Code, per the
-- approved DESIGN_NOTE_CONSOLE_SURFACES (§5). Additive only.
-- This file is the audit record; the substrate DB is NOT the portal DB
-- (supabase/migrations/ in this repo targets the portal).

ALTER TABLE action_log
  ADD COLUMN IF NOT EXISTS is_client_visible boolean NOT NULL DEFAULT false;

CREATE OR REPLACE VIEW growth_action AS
  SELECT t.id, t.client_id, t.operator_id, t.source, t.status, t.risk_level,
         t.plan->>'reason' AS reason,
         t.plan->>'evidence' AS evidence,
         t.plan->>'expected_impact' AS expected_impact,
         t.result->>'verdict' AS verdict,
         t.result->>'outcome' AS outcome,
         t.result->'probes' AS probes,
         t.request, t.plan, t.result,
         t.created_at, t.updated_at, t.completed_at,
         al.steps, al.last_step_at, al.client_visible_steps
  FROM tasks t
  LEFT JOIN LATERAL (
    SELECT count(*) AS steps, max(a.created_at) AS last_step_at,
           count(*) FILTER (WHERE a.is_client_visible) AS client_visible_steps
    FROM action_log a WHERE a.task_id = t.id
  ) al ON true;

-- Also applied 2026-07-24: the scoped read-only role for the cockpit
-- (per docs/platform-integration-phase1.md §1, extended for Phase 1):
--   CREATE ROLE substrate_readonly LOGIN PASSWORD '<in substrate.env>';
--   GRANT CONNECT ON DATABASE postgres; GRANT USAGE ON SCHEMA public;
--   GRANT SELECT ON conversations, action_log, kb_documents, clients,
--                   tasks, growth_action;   -- leads: table does not exist
--   + explicit RLS SELECT policies (substrate_readonly_select) on
--     action_log, clients, conversations, kb_documents, tasks.
-- Verified: SELECTs work; INSERT refused; ungranted tables (operators) refused.

-- Rexos P5-Lite: execution + audit columns on optimisation proposals. An
-- approved proposal can be applied (validate_only -> mutate -> verify), with the
-- full before/after captured immutably and a rollback recorded. Propose-only
-- remains the default; writes are gated by a kill switch + allowlist in env.
-- status now also takes: applied | failed | rolled_back.
-- Run in BOTH Supabase projects (Supabase SQL Editor).

alter table optimization_proposals
  add column applied_at      timestamptz,
  add column applied_by      text,
  add column rolled_back_at  timestamptz,
  add column rolled_back_by  text,
  add column execution       jsonb not null default '{}'::jsonb;

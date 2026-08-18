-- TARGET: SUBSTRATE
-- 0008: staged optimisation moves, per the agent-optimise v1 spec
-- (docs/BERNARD_OPTIMISE_SPEC.md, all seven decisions founder-ruled 2026-08-18).
--
-- Two tables because Norbert's Q2 ("the biggest problem this run did NOT touch")
-- is a property of the RUN, not of any move in it. Flattening it onto every move
-- row would invite treating it as per-move commentary, which it is not.
--
-- Nothing in the runtime reads these tables to make decisions; they are the
-- staging and audit surface between proposal and founder word. move_snapshots
-- (0007) remains the grading corpus and gets its rows at execute/reject time.
create table if not exists optimise_sessions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  account_id text not null,
  -- Founder-triggered only, per the 2026-08-18 operating model. This records
  -- who or what dispatched; the webhook refuses without the dispatch key either way.
  dispatched_by text not null default 'founder',
  -- Norbert, the supervisor. Q2 is run-scoped; q1 verdicts live on the moves.
  norbert_model text,
  norbert_q2 text,
  norbert_revision_round jsonb,   -- {finding, bernard_response, resolved: 'acted'|'defended'}
  immature_data boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists optimise_moves (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references optimise_sessions(id) on delete cascade,
  client_id uuid not null,

  -- The two-op grammar. unpause is stored distinctly so the only-what-Bernard-
  -- paused rule is checkable from the row alone.
  op text not null check (op in ('pause','budget','unpause')),
  entity_type text not null check (entity_type in ('campaign','adset','ad')),
  entity_id text not null,
  from_value jsonb,               -- budget: {daily_budget_minor}; pause: {status}
  to_value jsonb,
  evidence text not null,

  -- proposed -> approved|rejected -> executed|verification_failed
  -- gate_blocked never reaches this table; it is refused pre-staging and logged
  -- straight to move_snapshots as a counterfactual.
  status text not null default 'proposed'
    check (status in ('proposed','approved','rejected','executed','verification_failed','expired')),

  norbert_q1 text,                -- Norbert's verdict on THIS move, if any
  human_change_conflict text,     -- named human change this move would reverse, 14d window
  snapshot_id uuid,               -- move_snapshots row, written at decide/execute time

  decided_at timestamptz,
  decided_reason text,
  executed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists optimise_moves_session_idx on optimise_moves (session_id);
create index if not exists optimise_moves_status_idx on optimise_moves (status, created_at desc);
-- The daily ceiling counts executed moves per account per day; make that cheap.
create index if not exists optimise_moves_entity_idx on optimise_moves (entity_id, created_at desc);
create index if not exists optimise_sessions_client_idx on optimise_sessions (client_id, created_at desc);

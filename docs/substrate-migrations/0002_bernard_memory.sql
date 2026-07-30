-- 0002_bernard_memory.sql
--
-- TARGET DATABASE: **PORTAL** (see README in this directory).
--
-- Bernard's durable memory. Distinct from agent_conversations on purpose:
-- clearing the chat wipes the transcript, and must NOT wipe what Bernard knows.
-- The founder's ruling (2026-07-30): Bernard is the senior paid social
-- strategist and media buyer, not an audit tool. He is expected to carry client
-- context, prior decisions and standing preferences across sessions
-- indefinitely, and to forget only when explicitly told to.
--
-- Writes come from Bernard himself via the remember / revise_memory / forget
-- tools, so rows are model-authored and the actor column records the founder
-- session they were written in.

create table if not exists bernard_memory (
  id uuid primary key default gen_random_uuid(),

  -- What sort of thing this is. Kept as free text with a check rather than an
  -- enum so a new category does not need a migration.
  kind text not null check (kind in (
    'client',      -- how a client operates, their constraints, their history
    'account',     -- a specific ad account's quirks, structure, baselines
    'decision',    -- a ruling the founder made, and why
    'preference',  -- how the founder wants Bernard to work
    'strategy',    -- a standing strategic position or plan
    'fact'         -- anything else durable and verified
  )),

  -- Slug, act_ id, or 'global' for things not tied to one entity.
  subject text not null default 'global',

  content text not null,

  actor text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Soft delete. Forgetting is reversible and auditable; nothing is destroyed,
  -- because a memory the founder asked Bernard to drop is still evidence of
  -- what he believed and when.
  forgotten_at timestamptz,
  forgotten_reason text
);

-- The hot path is "every live memory, grouped by subject", loaded on each turn.
create index if not exists bernard_memory_live_idx
  on bernard_memory (subject, created_at)
  where forgotten_at is null;

comment on table bernard_memory is
  'Bernard''s cross-session memory. Survives chat clear by design. Written by Bernard via his own tools.';

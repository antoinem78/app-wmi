-- TARGET: PORTAL
-- 0022_agent_memory.sql
-- Cross-session memory for the named agents (bernard = Meta, oscar = Google
-- Ads). Historically this table was created by hand on the app.wmiltd.com
-- database (docs/substrate-migrations/0002-0004), so entity clones built from
-- this series never got it and their agents had amnesia. This migration is the
-- fresh-install shape (agent column + shared flag included); on databases that
-- already have the table it is a no-op.

create table if not exists agent_memory (
  id uuid primary key default gen_random_uuid(),
  agent text not null default 'bernard',
  kind text not null check (kind in (
    'client',      -- how a client operates, their constraints, their history
    'account',     -- a specific ad account's quirks, structure, baselines
    'decision',    -- a ruling the founder made, and why
    'preference',  -- how the founder wants the agent to work
    'strategy',    -- a standing strategic position or plan
    'fact'         -- anything else durable and verified
  )),
  subject text not null default 'global',
  content text not null,
  actor text,
  shared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Soft delete. Forgetting is reversible and auditable.
  forgotten_at timestamptz,
  forgotten_reason text
);

alter table agent_memory add column if not exists shared boolean not null default false;

create index if not exists agent_memory_live_idx
  on agent_memory (agent, subject, created_at)
  where forgotten_at is null;
create index if not exists agent_memory_shared_idx
  on agent_memory (shared, subject, created_at)
  where forgotten_at is null and shared;

comment on table agent_memory is
  'Cross-session memory for named agents. Survives chat clear by design. Written by each agent via its own remember / revise_memory / forget tools.';
comment on column agent_memory.agent is
  'Which agent owns this memory. Ownership (and the right to revise/forget) stays here even when shared.';
comment on column agent_memory.shared is
  'Visible to every agent when true. Client-level facts, founder rulings and cross-channel strategy are shared; platform-specific tactics stay private.';

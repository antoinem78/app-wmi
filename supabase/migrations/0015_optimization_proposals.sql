-- Rexos P4: structured optimisation proposals. The AI agent (or the team) files
-- a typed proposal against a client; a human approves or dismisses it. Approval
-- does NOT execute anything yet (propose-only) — it records the decision. The
-- mutate/execute layer (P5) will later hang off an approved proposal.
-- Run in BOTH Supabase projects (Supabase SQL Editor).

create table optimization_proposals (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references clients(id) on delete cascade,
  account_label text,                       -- company-name snapshot for display
  type         text not null,               -- negative_keywords | pause_campaign | budget_reallocation | rsa_improvement | other
  title        text not null,
  rationale    text,
  details      jsonb not null default '{}'::jsonb,  -- type-specific structured change
  status       text not null default 'pending',     -- pending | approved | dismissed | applied
  created_by   text,                         -- 'rexos-agent' or admin email
  created_at   timestamptz not null default now(),
  decided_by   text,
  decided_at   timestamptz
);

create index optimization_proposals_status_idx on optimization_proposals(status, created_at desc);
create index optimization_proposals_client_idx on optimization_proposals(client_id);

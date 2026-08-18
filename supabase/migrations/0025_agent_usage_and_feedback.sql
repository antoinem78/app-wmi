-- TARGET: PORTAL
-- 0025: agent usage metering, and the founder feedback inbox.
--
-- METERING (economics ledger, 2026-08-18): action_log showed 5,718 rows with
-- model cost on only 402, all from one n8n workflow. Bernard and Oscar, the two
-- always-on agents, recorded nothing, and agent_conversations carries no
-- token or cost column, so none of it can be backfilled. The portal's substrate
-- connection is READ-ONLY by design, so agent cost lands here, portal-side,
-- in its own table rather than widening every conversation row.
create table if not exists agent_usage (
  id uuid primary key default gen_random_uuid(),
  agent text not null,              -- 'bernard' | 'oscar'
  scope text,                       -- conversation scope, joinable to agent_conversations
  client_id uuid,
  model text not null,
  turns int not null default 1,     -- stream iterations in the run
  tokens_in bigint not null,
  tokens_out bigint not null,
  cost_usd numeric(10,6) not null,
  created_at timestamptz not null default now()
);
create index if not exists agent_usage_agent_idx on agent_usage (agent, created_at desc);

-- FEEDBACK INBOX (Denis brief item 3): one-off founder steering, distinct from
-- durable memory (permanent, ceremony-bearing) and chat instructions
-- (ephemeral, session-bound). Read at run start, then archived. "Go easy on
-- client X this week" should not require a ruling and should not live forever.
create table if not exists agent_feedback (
  id uuid primary key default gen_random_uuid(),
  agent text not null,              -- 'bernard' | 'oscar' | 'all'
  note text not null,
  created_by text not null default 'founder',
  created_at timestamptz not null default now(),
  read_at timestamptz,
  archived_at timestamptz
);
create index if not exists agent_feedback_unread_idx on agent_feedback (agent, created_at)
  where archived_at is null;

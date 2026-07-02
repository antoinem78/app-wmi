-- Rexos parity P2: persistent chat memory for the Rexos assistant. Each turn
-- (user or assistant) is one row, grouped by `scope` so a conversation survives
-- page navigation and reloads. Scope is either the literal 'command-center'
-- (the agency-wide chat) or a client id string (a per-account thread).
-- Run in the Supabase SQL Editor.

create table agent_conversations (
  id         uuid primary key default gen_random_uuid(),
  scope      text not null,                       -- 'command-center' | '<client uuid>'
  client_id  uuid references clients(id) on delete cascade,  -- set for account-scoped threads
  role       text not null check (role in ('user', 'assistant')),
  content    text not null,
  actor      text,                                -- admin email that owned the turn
  created_at timestamptz not null default now()
);

create index agent_conversations_scope_idx on agent_conversations(scope, created_at);
create index agent_conversations_client_idx on agent_conversations(client_id);

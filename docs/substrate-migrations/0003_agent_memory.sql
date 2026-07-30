-- 0003_agent_memory.sql
--
-- TARGET DATABASE: **PORTAL** (SUPABASE_URL / SUPABASE_SECRET_KEY in .env.local).
-- NOT the substrate. `agent_memory` is read through createSupabaseAdminClient(),
-- which is the portal. Run this in the portal project's SQL editor. See the
-- README in this directory: pointing this at the substrate was attempted once
-- and only failed safely by luck.
--
-- Generalise Bernard's memory so every named agent can use it.
--
-- Two things happen here, and the rename is the more important one. Migration
-- 0002 created `bernard_memory`, which was correct while Bernard was the only
-- agent with a memory. Oscar (paid search, formerly the misnamed "Ask Rexos")
-- now needs the same capability, and storing Oscar's memories in a table called
-- bernard_memory would repeat exactly the category error the founder called out
-- on 2026-07-30: a specific name standing in for a shared thing. The table held
-- 20 rows and was created the same day, so this is the cheapest moment it will
-- ever be to fix.
--
-- The `agent` column defaults to 'bernard' so the existing 20 seeded rows are
-- attributed correctly without a data migration.

alter table bernard_memory rename to agent_memory;

alter table agent_memory
  add column if not exists agent text not null default 'bernard';

-- Renaming a table does not rename its indexes, so the old one is dropped and
-- rebuilt with `agent` leading: every query is scoped to one agent first.
drop index if exists bernard_memory_live_idx;

create index if not exists agent_memory_live_idx
  on agent_memory (agent, subject, created_at)
  where forgotten_at is null;

comment on table agent_memory is
  'Cross-session memory for named agents (bernard = Meta, oscar = Google Ads). Survives chat clear by design. Written by each agent via its own remember / revise_memory / forget tools.';

comment on column agent_memory.agent is
  'Which agent owns this memory. Memories are never shared across agents implicitly: Bernard should not inherit Oscar''s conclusions about a different platform.';

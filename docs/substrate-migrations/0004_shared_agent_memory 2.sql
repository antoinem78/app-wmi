-- TARGET: SUBSTRATE
-- 0004_shared_agent_memory.sql
--
-- TARGET DATABASE: **PORTAL** (SUPABASE_URL / SUPABASE_SECRET_KEY in .env.local).
-- Run in the portal project's SQL editor. See the README in this directory.
--
-- Multi-channel clients need Bernard (Meta) and Oscar (Google) to share
-- client-level knowledge without dissolving the isolation that keeps platform
-- tactics from cross-contaminating. Founder ask 2026-08-01: "I need Bernard and
-- Oscar to access a shared memory and to be able to work together."
--
-- Design: ownership stays with the writing agent (the `agent` column is
-- unchanged, and only the owner can revise or forget a memory). A new `shared`
-- flag makes a memory VISIBLE to every agent. So the pool is written by one,
-- readable by all, and corrections to another agent's shared memory happen by
-- writing your own shared correction rather than editing theirs.

alter table agent_memory
  add column if not exists shared boolean not null default false;

create index if not exists agent_memory_shared_idx
  on agent_memory (shared, subject, created_at)
  where forgotten_at is null and shared;

comment on column agent_memory.shared is
  'Visible to every agent when true. Ownership (and the right to revise/forget) stays with the agent column. Client-level facts, founder rulings and cross-channel strategy are shared; platform-specific tactics stay private.';

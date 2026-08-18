-- TARGET: SUBSTRATE
-- 0007: decision-time snapshots and the counterfactual class.
--
-- Code brief "Bernard upgrades from the Denis field study", item 1. The whole
-- justification is that decision-time state cannot be reconstructed from Meta
-- after the fact, so every week without this table is fitting data destroyed.
-- Nothing here reads or changes behaviour; it only records.
--
-- ONE HONEST LIMITATION, STATED IN THE SCHEMA RATHER THAN DISCOVERED LATER.
-- The brief enumerates pacing, frequency, creative age, learning-phase status
-- and budget utilisation. Those are OPTIMISATION features and they do not exist
-- for an entity being created for the first time, which is the only class of
-- move Bernard makes today: he builds, he does not adjust. So `snapshot` carries
-- what genuinely exists at decision time for a build, and an explicit
-- `optimisation_state: null` with the reason beside it. The day Bernard gains
-- optimisation moves, those fields populate and nothing here changes shape.
--
-- Recording a null honestly is the point. A table full of zeroes would look
-- like instrumentation and would poison anything later fitted on it.
create table if not exists move_snapshots (
  id uuid primary key default gen_random_uuid(),

  -- Null for a move that died before any task row existed (a pre-flight gate
  -- hold, a spec rejected at review). Those are the counterfactuals.
  task_id uuid references tasks(id) on delete cascade,
  client_id uuid,
  build_ref text,

  -- Which operation within the build: 'c0', 'as0_0', 'ad0_0_0'.
  op_name text,
  entity_type text check (entity_type in ('campaign','adset','ad')),
  -- Populated only once read-back settles it. Null at propose time by design.
  entity_id text,

  -- executed     the move happened and read-back confirmed it
  -- rejected     a human declined it before execution
  -- gate_blocked pre-flight gate refused it, zero Meta calls made
  -- died         staged and never executed for any other reason
  move_class text not null
    check (move_class in ('executed','rejected','gate_blocked','died')),
  reason text,

  snapshot jsonb not null,

  -- Both timestamps exist so the staleness rule from the 2026-08-13 dossier is
  -- computable later without re-deriving anything: a move whose snapshot is more
  -- than 12 hours older than its execution grades INCONCLUSIVE, never as a
  -- verdict from a stale baseline. Storing the pair now costs nothing; deriving
  -- it retrospectively is impossible.
  taken_at timestamptz not null default now(),
  executed_at timestamptz,

  created_at timestamptz not null default now()
);

-- Anything that is not 'executed' is a counterfactual: a proposal that did not
-- happen, with the state that produced it. These are the seed set for honest
-- grading, and today they simply need to stop being indistinguishable from noise.
create index if not exists move_snapshots_counterfactual_idx
  on move_snapshots (move_class, created_at desc)
  where move_class <> 'executed';

create index if not exists move_snapshots_client_idx on move_snapshots (client_id, created_at desc);
create index if not exists move_snapshots_task_idx on move_snapshots (task_id);
create index if not exists move_snapshots_build_ref_idx on move_snapshots (build_ref)
  where build_ref is not null;

comment on table move_snapshots is
  'Decision-time state per Bernard move. Written at propose and at execute; never read by the runtime. Grading corpus only. Partition by move_class before fitting anything: the tasks table also carries 1,177 historic OpenDental rows that are not moves at all.';

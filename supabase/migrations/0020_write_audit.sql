-- Rexos writes-on-all-MCC-accounts: cross-cutting security trail for every
-- Google Ads write attempt (P5-Lite apply/rollback, dry-runs, and boundary
-- rejections). Non-client-scoped — this is the security ledger, distinct from the
-- client-scoped activity_log. Run in the Supabase SQL Editor.

create table if not exists write_audit (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  deployment text,
  mcc text,
  customer_id text,
  source text not null,             -- 'p5lite'
  action text,
  phase text,                       -- 'dry_run' | 'apply' | 'rollback'
  mcc_check text,
  allowlist_check text,
  approver text,
  result text not null,             -- 'ok' | 'blocked' | 'failed' | 'boundary_violation'
  detail jsonb not null default '{}'::jsonb,
  client_id uuid
);

create index if not exists write_audit_created_idx on write_audit(created_at desc);
create index if not exists write_audit_customer_idx on write_audit(customer_id);

-- Rexos parity P4: client-shareable read-only dashboard. Each client gets an
-- unguessable share token; sharing is off until the admin enables it. The public
-- page /share/<token> renders the dashboard read-only when share_enabled is true.
-- Run in the Supabase SQL Editor.

alter table clients add column if not exists share_enabled boolean not null default false;
alter table clients add column if not exists share_token uuid not null default gen_random_uuid();

create unique index if not exists clients_share_token_idx on clients(share_token);

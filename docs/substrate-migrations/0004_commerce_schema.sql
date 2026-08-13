-- 0004_commerce_schema.sql
-- TARGET: SUBSTRATE (conversion plane, ckxiqsufssibrrwdotad). NOT the portal.
-- Applied via the pg client per docs/substrate-migrations/README.md.
--
-- CODE_BRIEF_2 §3: the commerce ingestion schema. First named application
-- schema on this plane. Purely additive: new schema, new tables, one new role,
-- one operators row. Zero changes to existing objects.
--
-- Rulings implemented (2026-07-30, Antoine):
--   D1(a): dedicated commerce_writer role WITHOUT bypassrls, used only by the
--          commerce workflows' n8n DB credential. Cross-tenant writes become
--          impossible rather than avoided. NOTE: the brief said NOLOGIN; that
--          cannot authenticate an n8n credential, so this follows the
--          substrate_readonly precedent from 0001: LOGIN, password recorded in
--          ~/.config/singularweb/substrate.env, never in this file.
--   D2(a): guarded apply-once script, rehearsed in a rolled-back transaction.
--
-- The CREATE ROLE password placeholder is substituted at apply time.

-- Guard 1 (README rule): assert this is the substrate, not the portal.
do $$ begin
  if to_regclass('public.agent_conversations') is not null then
    raise exception 'This looks like the PORTAL database. Substrate migration aborted.';
  end if;
  if to_regclass('public.tasks') is null or to_regclass('public.clients') is null then
    raise exception 'tasks/clients not found; wrong database. Aborted.';
  end if;
end $$;

-- Guard 2: apply-once.
do $$ begin
  if exists (select 1 from information_schema.schemata where schema_name = 'commerce') then
    raise exception 'Schema commerce already exists; migration already applied. Aborted.';
  end if;
end $$;

begin;

-- ---------------------------------------------------------------------------
-- Role (D1a). LOGIN so it can be an n8n credential; no bypassrls, so the
-- tenant policies actually bind it, unlike the estate postgres role.
-- ---------------------------------------------------------------------------
create role commerce_writer login password :'commerce_writer_password';
comment on role commerce_writer is
  'Commerce ingestion write path (CODE_BRIEF_2 D1a). Bound to RLS; used only by the commerce n8n workflows.';

-- ---------------------------------------------------------------------------
-- Schema and tables (event contract v0.2 with verified corrections)
-- ---------------------------------------------------------------------------
create schema commerce;

-- Append-only event log. UNIQUE (client_id, event_id) is the idempotency
-- backstop; the insert is ON CONFLICT DO NOTHING.
create table commerce.events (
  id                 bigint generated always as identity primary key,
  event_id           text not null,             -- X-Shopify-Webhook-Id
  client_id          uuid not null references public.clients(id),
  session_id         text,
  identity_key       text,
  consent_state      text not null check (consent_state in ('granted','denied','pending','not_applicable')),
  event_type         text not null,
  order_ref          text,
  order_sequence     integer,
  value              numeric,
  currency           text,
  source_attribution jsonb,
  schema_version     text not null default '0.2',
  payload            jsonb,
  occurred_at        timestamptz not null,
  received_at        timestamptz not null default now(),
  constraint events_value_needs_currency check (value is null or currency is not null),
  constraint events_client_event_unique unique (client_id, event_id)
);
create index events_client_occurred_idx on commerce.events (client_id, occurred_at desc);
create index events_client_type_idx     on commerce.events (client_id, event_type);

-- Open checkout state, upserted on (client_id, checkout_token). Exists because
-- cart abandonment asks "which checkouts have no matching order after N
-- minutes", which is trivial against state and painful against a log.
create table commerce.checkouts (
  client_id           uuid not null references public.clients(id),
  checkout_token      text not null,
  email_present       boolean not null default false,
  marketing_consent   text not null default 'not_applicable' check (marketing_consent in ('granted','denied','pending','not_applicable')),
  line_summary        jsonb,
  value               numeric,
  currency            text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  completed_order_ref text,
  primary key (client_id, checkout_token)
);

-- Materialised order state, upserted on (client_id, order_ref). Tolerant of
-- out-of-order webhook arrival by construction.
create table commerce.orders (
  client_id        uuid not null references public.clients(id),
  order_ref        text not null,
  value            numeric,
  currency         text,
  financial_status text,
  order_sequence   integer,
  refunded_value   numeric not null default 0,
  consent_state    text check (consent_state in ('granted','denied','pending','not_applicable')),
  placed_at        timestamptz,
  updated_at       timestamptz not null default now(),
  primary key (client_id, order_ref)
);
create index orders_client_placed_idx on commerce.orders (client_id, placed_at desc);

-- Per-merchant webhook HMAC secret, readable ONLY by commerce_writer.
-- Why a table and not the n8n credential store: n8n Code nodes cannot read
-- n8n credentials, and HMAC needs the secret inside a Code node. Why not
-- config: house rule, no secrets in config. RLS below denies every role
-- except commerce_writer; postgres/service_role bypass RLS as everywhere
-- else on this plane.
create table commerce.merchant_secrets (
  client_id   uuid not null references public.clients(id),
  name        text not null,                    -- e.g. 'shopify_hmac'
  secret      text not null,
  created_at  timestamptz not null default now(),
  primary key (client_id, name)
);

-- ---------------------------------------------------------------------------
-- RLS: estate tenant_isolation shape on the three data tables (roles PUBLIC,
-- so commerce_writer is bound); explicit substrate_readonly SELECT policies so
-- the portal read spine can see them (its grants are per-table); secrets table
-- locked to commerce_writer only.
-- ---------------------------------------------------------------------------
alter table commerce.events           enable row level security;
alter table commerce.checkouts        enable row level security;
alter table commerce.orders           enable row level security;
alter table commerce.merchant_secrets enable row level security;

create policy tenant_isolation on commerce.events
  for all using (client_id = (current_setting('app.client_id', true))::uuid);
create policy tenant_isolation on commerce.checkouts
  for all using (client_id = (current_setting('app.client_id', true))::uuid);
create policy tenant_isolation on commerce.orders
  for all using (client_id = (current_setting('app.client_id', true))::uuid);

create policy substrate_readonly_select on commerce.events
  for select to substrate_readonly using (true);
create policy substrate_readonly_select on commerce.checkouts
  for select to substrate_readonly using (true);
create policy substrate_readonly_select on commerce.orders
  for select to substrate_readonly using (true);

-- Secrets: no tenant policy, no readonly policy. Only commerce_writer, and only
-- for the client whose context is set.
create policy commerce_writer_secrets on commerce.merchant_secrets
  for select to commerce_writer
  using (client_id = (current_setting('app.client_id', true))::uuid);
-- ADDENDUM 2026-07-31 (CODE_BRIEF_3 §1): the policy above and the SELECT grant
-- below were both REVOKED/DROPPED. verify_shopify_hmac() is SECURITY DEFINER
-- and reads the table as its owner, so commerce_writer needs no access at all.
-- After the revoke the secret is unreachable from n8n by construction.
-- Applied live: REVOKE ALL ON commerce.merchant_secrets FROM commerce_writer;
--               DROP POLICY commerce_writer_secrets ON commerce.merchant_secrets;
-- Verified: function still verifies as commerce_writer; direct SELECT refused.

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
grant usage on schema commerce to substrate_readonly;
grant select on commerce.events, commerce.checkouts, commerce.orders to substrate_readonly;

grant usage on schema commerce, public to commerce_writer;
grant select                         on public.clients        to commerce_writer;
grant insert                         on public.tasks          to commerce_writer;
grant insert                         on public.action_log     to commerce_writer;
-- RETURNING needs column-level SELECT (found at verification; applied 2026-07-31)
grant select (id)                    on public.tasks          to commerce_writer;
grant select (task_id)               on public.action_log     to commerce_writer;
grant usage on sequence public.action_log_id_seq              to commerce_writer;
grant select, insert                 on commerce.events       to commerce_writer;
grant usage on sequence commerce.events_id_seq                to commerce_writer;
grant select, insert, update         on commerce.checkouts    to commerce_writer;
grant select, insert, update         on commerce.orders       to commerce_writer;
grant select                         on commerce.merchant_secrets to commerce_writer; -- REVOKED 2026-07-31, see addendum above

-- public.clients and public.tasks/action_log carry RLS with roles=PUBLIC
-- policies already (tenant_isolation with the OR client_id IS NULL clause and
-- substrate_readonly_select). commerce_writer needs a read path to resolve a
-- client BEFORE app.client_id can be set (resolution is how the id is learned),
-- so it gets a scoped SELECT policy on clients limited to commerce-enabled rows.
create policy commerce_writer_clients on public.clients
  for select to commerce_writer
  using (config -> 'commerce' ->> 'enabled' = 'true');

-- ---------------------------------------------------------------------------
-- HMAC verification function (applied 2026-07-31, same session as the schema).
-- Why in the database and not an n8n Code node with a bound credential, which
-- is what CODE_BRIEF_2 §4.2 asked for: n8n Code nodes cannot read n8n
-- credentials, and routing the secret through node output would persist it in
-- n8n execution logs. SECURITY DEFINER keeps the secret inside Postgres;
-- plpgsql gives the sequential execution that the set_config CTE pattern
-- cannot guarantee under an RLS-bound role. Fails closed on missing raw body.
-- Compares digests of both signatures, so the comparison is constant-time.
-- EXECUTE granted to commerce_writer only.
-- ---------------------------------------------------------------------------
-- create function commerce.verify_shopify_hmac(p_domain text, p_body_hex text, p_hmac_b64 text)
--   returns table (verified boolean, client_id uuid, slug text, reason text)
--   ... full body applied live; see the Phase A build report for the source.
-- revoke all on function commerce.verify_shopify_hmac(text,text,text) from public;
-- grant execute on function commerce.verify_shopify_hmac(text,text,text) to commerce_writer;

-- ---------------------------------------------------------------------------
-- Operators registry row (verified shape: id, name, default_risk,
-- approval_policy, config)
-- ---------------------------------------------------------------------------
insert into public.operators (id, name, default_risk, approval_policy, config)
values ('commerce_ingest', 'Commerce ingestion (Shopify webhooks)', 'L1', 'policy_readonly',
        '{"class":"receiver","governing_spec":"CODE_BRIEF_2 Phase A"}'::jsonb);

commit;

-- 0024: upsells. Extra work sold to an existing client, either a one-off
-- (setup, ad hoc task) or an ongoing add-on service.
--
-- Two founder rulings from 2026-08-11 are baked into this shape.
--
-- 1. A recurring upsell bills as its OWN Stripe subscription, never as an extra
--    line on the client's retainer. The reason is cancellation isolation: a
--    client dropping an add-on must not be able to touch the core retainer, and
--    with one subscription carrying both there is no safe way to offer that.
--    Hence stripe_subscription_id lives here, per upsell, not on the client.
--
-- 2. A recurring upsell needs a signable quote before it can be paid, the same
--    way the original engagement does. A one-off does not: the invoice is the
--    record. So document_id is nullable and only populated for kind='recurring'.
create table if not exists upsells (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,

  kind text not null check (kind in ('one_off', 'recurring')),
  name text not null,
  description text,
  -- Net of tax, like every other price in this system. Stripe Tax adds VAT on
  -- top via tax_behavior 'exclusive'.
  amount numeric not null check (amount > 0),
  currency text not null,

  -- draft         created, nothing sent
  -- quote_sent    recurring only: signable quote issued, awaiting signature
  -- quote_signed  recurring only: signed, payment link can go out
  -- payment_sent  client has the payment link
  -- paid          one-off settled
  -- active        recurring subscription live
  -- cancelled     withdrawn before payment, or subscription ended
  status text not null default 'draft'
    check (status in ('draft','quote_sent','quote_signed','payment_sent','paid','active','cancelled')),

  document_id text,
  stripe_session_id text,
  stripe_subscription_id text,
  stripe_payment_intent_id text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz,
  cancelled_at timestamptz
);

create index if not exists upsells_client_id_idx on upsells (client_id);
create index if not exists upsells_status_idx on upsells (status);
-- The webhook arrives knowing only the Stripe ids, so both need to be findable.
create index if not exists upsells_stripe_subscription_idx on upsells (stripe_subscription_id)
  where stripe_subscription_id is not null;
create index if not exists upsells_stripe_session_idx on upsells (stripe_session_id)
  where stripe_session_id is not null;

-- Deny-all by default. Every code path that touches upsells, including the
-- client-facing /upsell page, goes through the service-role admin client, which
-- bypasses RLS. So no policies are needed and none are granted: anything
-- arriving with an anon or authenticated key gets nothing. The rest of this
-- schema leaves RLS off (see the commented block in 0001_init.sql); this table
-- carries pricing and Stripe ids, so it starts closed instead.
alter table upsells enable row level security;

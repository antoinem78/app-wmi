-- TARGET: SUBSTRATE
-- 0011: POAS reporting leg (capability map tier two, added 2026-08-12 on
-- partner feedback; tier-two freeze LIFTED by the founder for POAS reporting
-- 2026-09-04, his word: "LIFT IT"). Two objects:
--
-- commerce.sku_costs: the one client input POAS needs, a cost per SKU with a
-- cost-basis date so staleness is a visible property, never a silent one.
-- Written by the admin role via scripts/ingest-cogs.mjs; merchants never
-- touch it directly.
--
-- commerce.order_profit: per-order profit derived from what the spine already
-- holds. Line items live in the order webhook payloads (commerce.events),
-- not in commerce.orders, so the view joins the LATEST order event's items
-- against sku_costs. Honesty is structural: items_missing_cost and
-- oldest_cost_basis ride on every row, and profit is only meaningful where
-- items_missing_cost = 0; consumers must not average around the gap.
--
-- The bidding half of POAS (profit as conversion value through OCT/CAPI) is
-- NOT here and stays behind its own founder-approved cutover per the map.
create table if not exists commerce.sku_costs (
  client_id uuid not null references public.clients(id) on delete cascade,
  sku text not null,
  cost numeric not null check (cost >= 0),   -- major units, same basis as commerce.orders.value
  currency text not null,
  cost_basis_date date not null,
  source text,                                -- e.g. "Ryan COGS sheet 2026-09"
  updated_at timestamptz not null default now(),
  primary key (client_id, sku)
);

create or replace view commerce.order_profit as
with latest as (
  select distinct on (client_id, order_ref) client_id, order_ref, payload
  from commerce.events
  where event_type in ('order_created', 'order_updated')
  order by client_id, order_ref, received_at desc
),
items as (
  select l.client_id, l.order_ref,
         li->>'sku' as sku,
         coalesce(nullif(li->>'quantity', '')::numeric, 1) as qty
  from latest l
  cross join lateral jsonb_array_elements(coalesce(l.payload->'line_items', '[]'::jsonb)) li
)
select
  o.client_id,
  o.order_ref,
  o.placed_at,
  o.currency,
  (o.value - coalesce(o.refunded_value, 0)) as net_value,
  sum(i.qty * sc.cost) as cogs,
  count(*) as items,
  count(*) filter (where sc.sku is null) as items_missing_cost,
  min(sc.cost_basis_date) as oldest_cost_basis
from commerce.orders o
join items i on i.client_id = o.client_id and i.order_ref = o.order_ref
left join commerce.sku_costs sc on sc.client_id = i.client_id and sc.sku = i.sku
group by o.client_id, o.order_ref, o.placed_at, o.currency, o.value, o.refunded_value;

grant select on commerce.sku_costs to substrate_readonly;
grant select on commerce.order_profit to substrate_readonly;

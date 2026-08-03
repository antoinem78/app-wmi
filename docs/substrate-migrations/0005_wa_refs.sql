-- TARGET: SUBSTRATE (the n8n database, SUPABASE_DB_URL in substrate.env).
-- NOT the portal DB. Read README.md in this directory before running anything.
--
-- 0005: WhatsApp attribution bridge, ref store.
-- The site widget stores a visitor's click ids (gclid, fbclid, fbc/fbp, utm)
-- under a short ref code before opening WhatsApp; the inbound receiver claims
-- the ref when the message arrives and stamps the ids onto the GHL contact.
-- Applied 2026-08-03.

create table if not exists wa_refs (
  ref           text primary key,               -- e.g. WA-7K3F2M
  client_slug   text not null references clients(slug),
  attribution   jsonb not null default '{}'::jsonb,
  page          text,
  created_at    timestamptz not null default now(),
  claimed_at    timestamptz,                    -- set when an inbound message carries this ref
  claimed_phone text,                           -- E.164 of the WhatsApp sender who claimed it
  contact_id    text                            -- GHL contact id created/updated from the claim
);

create index if not exists wa_refs_client_created_idx
  on wa_refs (client_slug, created_at desc);

comment on table wa_refs is
  'WhatsApp attribution bridge: click ids parked under a short ref that rides the prefilled WhatsApp message.';

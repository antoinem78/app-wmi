-- Rexos parity P3: per-account narrative guidance. An optional free-text prompt
-- the account manager sets per client (tone, focus metrics, context the data
-- can't show). It is appended to the report narrative system prompt as extra
-- guidance — it never overrides the hard "use only verified figures" rules.
-- Run in the Supabase SQL Editor.

alter table clients add column if not exists report_prompt text;

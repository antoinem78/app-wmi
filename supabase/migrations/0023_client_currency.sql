-- TARGET: PORTAL
-- 0023_client_currency.sql
-- Per-client quote currency (founder request 2026-08-05: FZCO clients may be
-- quoted in USD or AED). NULL = the deployment's default currency
-- (entityConfig.currency), so existing rows and single-currency deployments
-- behave exactly as before.

alter table clients add column if not exists currency text;

comment on column clients.currency is
  'ISO 4217 currency this client is quoted, contracted and charged in. NULL = deployment default.';

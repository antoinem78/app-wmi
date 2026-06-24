-- Service/contract start date. For bank-transfer clients the term can begin on
-- a clean date (e.g. the 1st of next month) rather than the day payment landed.
-- Null = starts on the payment/mark-paid date (the default behaviour).
-- Run in BOTH Supabase projects (Supabase SQL Editor).

alter table onboarding_state
  add column service_start_date date;

-- TARGET: SUBSTRATE
-- 0009: admit the v1.1 move class (docs/BERNARD_OPTIMISE_V1_1_EXCLUSIONS_SPEC.md,
-- both rulings founder-given 2026-08-26: audience_exclude approved as the first
-- widened class, folded into v1's existing graduation bar).
--
-- One constraint swap, nothing else: from_value/to_value are already jsonb and
-- carry the exclusion snapshot and disclosure without schema change. There is
-- deliberately NO 'audience_include' or exclusion-removal op here: an exclusion
-- can only ever narrow delivery, and that one-way property is the whole risk
-- case (spec section 1). Do not add the inverse without its own founder ruling.
alter table optimise_moves drop constraint optimise_moves_op_check;
alter table optimise_moves add constraint optimise_moves_op_check
  check (op = any (array['pause'::text, 'budget'::text, 'unpause'::text, 'audience_exclude'::text]));

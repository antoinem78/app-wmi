-- TARGET: SUBSTRATE
-- 0010: admit the v1.2 move class (placements, founder-ruled 2026-09-04:
-- "go with placements, and I agree with your Advantage+ rule").
--
-- placement_exclude REMOVES one platform from an ad set's manual placement
-- list: narrowing-only, same one-way property as v1.1's audience exclusions.
-- Adding a placement widens delivery and is NOT an op. The Advantage+ rule is
-- enforced in the staging gates, not here: an ad set on Advantage+ placements
-- refuses the move, because excluding a placement there is a mode change to
-- manual that forfeits per-asset media customisation (founder-agreed rule).
-- Folded into the v1 graduation bar, consistent with the v1.1 ruling.
alter table optimise_moves drop constraint optimise_moves_op_check;
alter table optimise_moves add constraint optimise_moves_op_check
  check (op = any (array['pause'::text, 'budget'::text, 'unpause'::text, 'audience_exclude'::text, 'placement_exclude'::text]));

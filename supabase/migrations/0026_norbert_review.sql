-- TARGET: PORTAL
-- 0026: Norbert's review of Oscar's proposals (BERNARD_OPTIMISE_SPEC §9).
--
-- Bernard's optimise moves already pass through Norbert in the substrate before
-- the founder sees them. Oscar's proposals did not: they went from Oscar's chat
-- straight to the Proposals page. This adds the review record to the proposal
-- row itself, so the founder reads Oscar's rationale and Norbert's verdict on
-- the same card, and so the approval and apply gates can refuse an unreviewed
-- proposal in code rather than in a prompt.
--
-- norbert_review carries: at, model, trigger (filed | founder | revision),
-- revision_round, verdict {sound, q1}, q2 (the biggest untouched problem),
-- history {readable, changes7d, thrashing, humanUsers}, evidence, and error
-- when the review itself failed. A failed review still stamps
-- norbert_reviewed_at, because the gate blocks "never reviewed", not
-- "Norbert was unavailable": the founder remains the human in the loop and
-- sees the failure on the card.
alter table optimization_proposals
  add column if not exists norbert_review      jsonb,
  add column if not exists norbert_reviewed_at timestamptz;

comment on column optimization_proposals.norbert_review is
  'Norbert''s review of this proposal: verdict, untouched-problem paragraph, change-history assessment, metering model. Written by the portal (src/lib/norbert-review.ts).';

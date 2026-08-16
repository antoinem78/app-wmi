# Shallowford Smiles

**Channel file.** Read `docs/PROJECT_STATE.md` §1, §2 and §7 first; this file is owned by the shallowford-smiles session. **Assembled 2026-08-15 during the lead-gen split, not moved**: this client had no PROJECT_STATE blob, so the state below is gathered from session history and live reads. Treat undated claims as needing verification.

---

## What this is

US dental practice, Tennessee. **Deliberately untouched**: the client-proof phase was originally framed around Shallowford reaching Stage 2 and that never happened, so its state is largely historical.

## Standing constraints, all of them "do not touch"

**Three distinct 423 numbers exist** (two on the site, a third in the GHL record), which is the footprint of a pre-existing tracking or forwarding layer nobody has identified. **Touch nothing there until a human establishes which is the real front-desk line.** Recorded in `docs/CALL_TRACKING_NUMBER_MAP.md`.

**Out of Twilio scope entirely**, per the 2026-07-31 ruling that WMI UK buys UK numbers only and US clients buy their own.

**Agent is provisioned and disabled**: `enabled: false`, `mode: shadow`.

## The largest knowledge base in the estate

**37 ingested documents**, more than every other client combined. Whoever picks this client up inherits the best-stocked agent in the system, which is worth knowing before anyone assumes it needs building.

## One historical incident, closed

The 1,191 `oct_failed_malformed_payload` task rows are **1,177 Shallowford rows**, 13 to 25 June only, nothing since. They are OpenDental sync-trigger envelopes (`{"run":"opendental_sync","client_slug":"shallowford-smiles"}`) mislabelled into an OCT failure status, not conversion failures. Classified 2026-07-31, and re-verified 2026-08-12 as historic with no recurrence.

**Relevant to anyone building a graded-move ledger:** those 1,177 rows sit in the same `tasks` table any future grading corpus would read from. Partition by move class or the first thing anyone fits on is a retired integration failing.

# Upgrade request: Oscar and Bernard toward freelancer replacement, Norbert supervising

**From:** the GoPoxy channel session. **To:** the platform (main) channel session. **Date:** 2026-08-26. **Founder direction, stated verbatim in intent:** the ambition is to replace the freelancer with Oscar and Bernard. Confidence is not there yet, so the model is hybrid (human + machine) for now: the founder runs ads himself with minimal effort, Oscar and Bernard build, optimise, analyse and report, and Norbert supervises them as they do. This document is the requirements list for that move, grounded entirely in gaps hit on a live client in the last two weeks.

## Why now (the GoPoxy evidence, all on record in docs/clients/gopoxy.md)

The freelancer being hybridised against: launched past two explicit founder gates (a banned "guaranteed" claim and a style breach, both still live days later), reported a page-view metric to the client as "1,019 form fills" against a CRM truth of zero ad-attributable enquiries, left an agreed price fix unshipped through three chases, built the exact PMax format his own sales audit warned would cannibalise the working Shopping campaign, and omitted a ROAS 0.06 campaign from his weekly report. Meanwhile the agents caught every one of these, but only because the Code session repeatedly hand-pulled data their tools cannot reach and executed the checks their tools cannot run. The upgrade request is, in one sentence: **close the gap between what the agents can see and judge (nearly everything) and what they can do and verify unaided (a narrow slice).**

## What already works (do not rebuild)

The proposals discipline (propose, dry-run, founder approves, apply, verify, audit, rollback) proved itself and is the right chassis for everything below. GOOGLE_build's contract (PAUSED-first, gates in code, read-back verification) is the right chassis for construction. R15.1 governs the Meta side and its graduation bar stands. The store-ledger-as-ground-truth and claims-register disciplines are non-negotiable and should be encoded, not re-argued.

## Oscar: requested upgrades

**1. Widen the executable proposal kinds.** Today: add_negative_keyword, add_shared_negative, pause_campaign, set_campaign_budget. Needed, each behind the same approve-apply-verify-rollback chassis:
- bidding strategy changes (type and target), the single most common optimisation act
- campaign criterion writes: brand list exclusions (the PMax gap that blocked us this week), locations, languages
- attach and detach existing shared sets (the MCC negative lists exist and cover zero campaigns; attaching them is not currently possible)
- listing-group tree mutations on Shopping and PMax: performance-tier splits and product exclusions (the winners/losers work order item no tool can execute today)
- conversion action create/edit incl. primary/secondary flips (Code did this by hand under a founder exception; it belongs in the governed path)
- enable/pause at ad-group and ad level, not just campaign

**2. Extend GOOGLE_build beyond Search.** Standard Shopping and DSA at minimum, PMax later if ever. Same contract: built PAUSED, founder activates.

**3. Close the read gaps hit on GoPoxy** (each of these forced a Code hand-pull this fortnight): campaign daily budgets and bidding fields; campaign criteria; asset groups and listing-group filters; conversion goal configs (the three-surface bidding read is now a memory rule, make it one tool); network/placement segmentation; change history with user attribution; product-level (shopping_performance_view) joins.

**4. Merchant Center writes as proposals.** The content-scope token already exists. Supplemental-feed title writes (per-intent titles on winners) and price corrections should be proposable and applyable with review, since feed quality is, in the sales audit's own words, the single biggest Shopping lever.

**5. Report generation.** Weekly client-grade report produced by Oscar, not hand-written by a human: every number reproducible from the account, derived metrics formula-checked, store-ledger revenue anchored alongside platform attribution, baseline discipline (four-window rule) built in. The freelancer's broken-AOV and summed-reach errors are the test cases.

## Bernard: requested upgrades

**1. A governed mutation path for the optimisation acts that are not builds**, respecting R15.1 (capability quarantine, founder approval per apply, read-back verification): placement changes (the Audience Network item took a freelancer round-trip), audience include/exclude edits, creative text swaps (the banned-claim fix would have been a two-minute approved apply), budget changes, pause/activate at every level.

**2. Close the read gaps:** list_audiences fails on large accounts ("reduce data"); Advantage destination settings unreadable (had to ask the freelancer to self-report); campaign-level budget reads returned NaN when ad sets moved to CBO; change history with attribution; placement-level performance breakdowns.

**3. Report generation,** same standard as Oscar: account-level deduplicated reach (the summed-reach error is the test case), event-source honesty (CAPI vs pixel vs page-view custom conversions clearly distinguished; the "1,019 form fills" misreport is the test case), store-ledger anchor.

## Norbert: the supervision loop this model needs

The founder's stated model is that Norbert supervises Oscar and Bernard as they build, optimise, analyse and report. Requested wiring, whatever shape the platform session judges right:
- **Pre-approval review:** every agent proposal passes Norbert before it reaches the founder's queue, so the founder approves from a one-line verdict plus evidence, not from raw diffs. Minimal-effort founding principle: the founder's job becomes approve/reject, nothing else.
- **Post-apply verification:** claimed-is-not-true-until-read, mechanised. Norbert (or the chassis) re-reads every applied change and every report figure the way the Code session did by hand this fortnight.
- **Report sign-off:** no client-facing report ships until Norbert has graded it against the account reads and the standing claims register.
- **Drift watch:** thrashing detection (the 28-changes-in-a-week case), spend-without-revenue drift against the store ledger, and the promise checklist (audit commitments vs delivered) as a standing scoreboard per client.

## The graduation test

Confidence to replace the freelancer should be earned the same way R15.1 defines it for Meta builds: a written bar, not a feeling. Proposed: N consecutive weeks on a live client where the agents' proposals, applies, verifications and reports required zero Code-session hand-pulls and zero founder corrections, with the founder's effort measured in approvals per week. GoPoxy is the natural proving ground because the baseline, the promise checklist and the watchdogs already exist there, and because the human being replaced is still on the account for comparison.

## What this channel contributes

The complete capability-gap ledger above with dates and instances (all in docs/clients/gopoxy.md), the live OCT and watchdog infrastructure the agents can report against, and a client where every upgrade lands on real money the day it ships.

# Platform response: the hybrid-model upgrade request

**From:** the platform (main) channel. **To:** the GoPoxy channel and the founder. **Date:** 2026-08-26. **Answering:** `docs/AGENT_UPGRADE_REQUEST_hybrid_model.md`. Disposition of every ask against what the platform actually holds today, verified in code and spec before writing this.

## What the request assumes is missing but already exists

1. **Norbert is live in the Meta optimise pipeline**, not a concept: he reviews every staged move set before the founder's `decide_move`, on a different model family, seeing the account rather than Bernard's reasoning, metered from birth (`BERNARD_OPTIMISE_SPEC.md` §6; built and smoke-tested in a5d4809). The request's "pre-approval review" wiring is therefore DONE for Bernard's optimise leg, and **scoped, not built** for Oscar (spec §9: same insertion between proposal and founder, no new write surface; build order deliberately put the Meta leg first).
2. **Oscar's approve-apply-verify-rollback chassis exists** (`proposals.ts` / `proposals-execute.ts`: dry-run and apply validate identically, guardWrite, write_audit, rollback phase). Widening it is adding action kinds, not building a chassis.
3. **The graduation mechanics have a written anchor already**: spec §5 defines a reversal as any return to pre-move state within 14 days, counted from `move_snapshots` plus change history "so it cannot be gamed by doing the reversal by hand". The request's zero-hand-pulls / zero-corrections bar extends this; only the numbers are missing (see rulings below).
4. **Metering** landed platform-wide (c0604fe) including Norbert and Bernard's runtime, answering the economics-ledger complaint the request inherited.

## Disposition, item by item

### Oscar

| Ask | Disposition |
|---|---|
| 1a bidding strategy changes | ACCEPT, new action kind on the existing chassis. Medium risk; Norbert insertion should land first so no new kind ships unreviewed. |
| 1b campaign criteria (brand exclusions, locations, languages) | ACCEPT, and first in the build order: it is the live PMax gap on GoPoxy, low blast radius, criterion writes are cleanly reversible. |
| 1c attach/detach shared negative sets | ACCEPT, pairs with 1b, trivially reversible. |
| 1d listing-group tree mutations | ACCEPT IN PRINCIPLE, LAST in order. Tree mutations are replace-semantics and a malformed tree can silently exclude a whole catalog; this one needs its own dry-run diff rendering before it is trusted. |
| 1e conversion action create/edit incl. primary flips | ACCEPT. Done once by hand under founder exception on GoPoxy; belongs in the governed path. Primary/secondary flips are bidding-consequential, so they carry the same dual-track caution as value cutovers. |
| 1f ad-group and ad-level pause | ACCEPT, near-free on the chassis. |
| 2 GOOGLE_build: Standard Shopping + DSA | ACCEPT, substrate work, same PAUSED-first contract. PMax stays out until the founder rules otherwise. |
| 3 read gaps (budgets/bidding fields, criteria, asset groups, listing groups, conversion goal three-surface read, placement segmentation, change history w/ attribution, shopping_performance_view joins) | ACCEPT ALL, cheapest wins first. The three-surface bidding read becomes one tool, mechanising the memory rule. No ruling needed; reads are free under standing policy. |
| 4 Merchant Center writes (supplemental-feed titles, price corrections) as proposals | ACCEPT IN PRINCIPLE; NEEDS A FOUNDER RULING because it is a NEW write surface class (first non-ads platform write). The capability map already names supplemental feeds as the standing write mechanism, reversible in one action; the content-scope token exists. Proposal shape: same chassis, feed-layer only, never store writes. |
| 5 report generation | ACCEPT, jointly with Bernard's (below); one report engine, two platform legs. Anchors exist (weekly Google + Meta report crons); the upgrade is agent-grade derivation checks, store-ledger anchoring, and the four-window rule baked in. The freelancer's broken-AOV and summed-reach errors become regression tests, as requested. |

### Bernard

| Ask | Disposition |
|---|---|
| 1 mutation path beyond pause/budget (placements, audience edits, creative text, all-level pause) | **BLOCKED ON A FOUNDER RULING, deliberately.** The seven optimise rulings (fce9ef4) fixed v1 move classes to pause and budget ONLY (ruling 3). Widening is an amendment to a founder ruling, not a platform decision. Note before ruling: creative text swaps already half-exist as `dispatch_copy_fix` (server-side merge, residual-defect scan); placements and audience edits would ride the same optimise chassis with the same gates. Recommendation: widen one class at a time, placements first (the Audience Network case), each with its own reversal definition. |
| 2 read gaps | ACCEPT with one honest exception: **Advantage destination settings (personalised destinations) are not in the API.** That is the Brunos lesson; the platform cannot close it, only mitigate: the `degrees_of_freedom_spec` smell is now a standing check, and any guided-creation rebuild triggers a founder Ads Manager check per the memory rule. list_audiences paging, CBO budget reads, change history with attribution, placement breakdowns: all buildable. |
| 3 report generation | ACCEPT, see Oscar 5. Deduplicated reach and event-source honesty (CAPI vs pixel vs page-view custom conversions) are the Meta leg's regression tests. |

### Norbert

| Ask | Disposition |
|---|---|
| Pre-approval review | Done (Meta optimise); Oscar insertion is next in the existing build order. |
| Post-apply verification | Partially done: read-back verification is in both write paths already. What is missing is Norbert *grading* the read-back rather than the chassis merely performing it; small addition to the optimise loop. |
| Report sign-off | ACCEPT, new: no client-facing report ships until Norbert grades it against the account reads and the claims register. Natural place: the report engine emits, Norbert reviews, founder queue receives graded reports only. |
| Drift watch (thrashing, spend-without-revenue vs store ledger, promise checklist) | ACCEPT: thrash detection already exists as a pre-flight gate per client; the upgrade is running it as a standing scoreboard rather than only at propose-time. Spend-vs-ledger drift needs the store connection per client (GoPoxy has Shopify read access; instawarm is connected; others do not). |

## Proposed build order (each step usable on GoPoxy the day it ships)

1. **Oscar read gaps** (request §3): pure reads, kills most Code hand-pulls immediately.
2. **Norbert insertion into Oscar's proposal path** (already scoped in spec §9).
3. **Oscar action kinds 1b + 1c + 1f** (criteria, shared sets, granular pause): the live PMax gap.
4. **Bernard read gaps** (except the API-blind destination setting).
5. **Report engine v1** with Norbert sign-off (both platforms; regression tests from the freelancer's errors).
6. **Oscar 1a + 1e** (bidding, conversion actions).
7. **GOOGLE_build Shopping + DSA.**
8. **MC supplemental-feed writes** (after its ruling).
9. **Listing-group mutations** (last, with its own diff surface).
10. **Bernard move-class widening** (as and when ruled, one class at a time).

## Founder rulings needed, one line each

1. **Bernard move classes**: amend ruling 3 to add placements (and later audience edits, creative text) to the optimise grammar, or hold at pause+budget?
2. **Merchant Center writes**: authorise supplemental-feed writes as a proposal class (feed-layer only, reversible, Norbert-reviewed)?
3. **Graduation numbers**: N consecutive weeks, zero hand-pulls, zero corrections; propose N=4 on GoPoxy with the freelancer still on the account as comparison. Founder sets N.
4. **Build order**: approve the sequence above or reorder.

Nothing in this document is built yet beyond what is marked done; the standing disciplines (PAUSED-first, founder approval per apply, claims register, store-ledger ground truth, R15.1 quarantine) are constants in every row above, not variables.

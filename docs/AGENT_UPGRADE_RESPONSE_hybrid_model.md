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

## Rulings, answered by the founder 2026-08-26

**2. Merchant Center writes: YES.** Supplemental-feed writes are authorised as a proposal class: feed-layer only, never store writes, reversible in one action, Norbert-reviewed, same chassis. Stays at position 8 in the build order.

**3. Graduation bar: YES, N=4.** Four consecutive weeks on GoPoxy with zero Code-session hand-pulls and zero founder corrections, freelancer still on the account as the comparison, founder effort measured in approvals per week.

**4. Build order: approved as written.**

**1. Bernard move classes: held; the founder asked for the trade-off to be explained before ruling.** The explanation, in full:

What exists today: Bernard's optimise grammar has exactly two move classes, pause and budget (bounded to 25% per move), fixed by ruling 3 of the seven optimise rulings. Both share one property that makes the whole safety model work: a move is trivially reversible and a reversal is trivially DETECTABLE. `move_snapshots` records the pre-move state, and any return to it within 14 days, by anyone, by any means, counts against graduation. That is the anti-gaming spine.

What widening adds, class by class, cheapest first:

- **Placements** (the Audience Network case): same ad set, one field family, snapshot and read-back both clean, reversal detection identical to budget moves. The one real risk is a placement change resetting learning on a stable ad set, which the thrash gate already guards. This is the cheapest widening and the recommended first step if ruling 1 is a yes.
- **Audience include/exclude edits**: reversible in one write, but the blast radius is delivery-shaping rather than delivery-stopping, and a bad exclusion can silently strangle an ad set in a way the daily numbers take days to reveal. Needs its own reversal definition (restore the exact audience list from snapshot) and a post-apply delivery check, not just a config read-back.
- **Creative text swaps**: half-exists already as `dispatch_copy_fix` (server-side merge from the base creative, residual-defect scan, lands PAUSED). Folding it into the optimise grammar would let the swap go live without the founder activating, which is the actual decision here: today's path keeps activation with the founder, the widened path would not. The banned-claim fix argument cuts the other way too: a wrong automated swap on live spend is the same speed in the wrong direction.

Why one class at a time: each class needs its own reversal definition in the graduation counter, and a batch widening makes week-counting ambiguous (a reversal in a new class would reset the clock for everything). Widening one class, watching it through a full graduation window, then widening the next keeps the N=4 measurement honest.

The recommendation stands: if widening, placements first, audience edits second, creative text last or never (its PAUSED-first path already works and keeps activation with the founder). Holding at pause+budget is also coherent: the freelancer-replacement case on GoPoxy is mostly an Oscar case today, and Bernard's widening can wait for evidence from the Meta side that pause+budget is the binding constraint.

**Amended after the founder surfaced `docs/BERNARD_OPTIMISE_V1_1_EXCLUSIONS_SPEC.md` (written 2026-08-19 off the Steffen Foerster incident).** That spec re-orders the widening recommendation, because it splits "audience edits" into two very different things. Audience EXCLUSIONS only narrow delivery, never widen it, so their worst case is bounded (under-delivery plus a disclosed learning reset), and the spec carries the whole machine already: move grammar, the read-merge-write-diff sequence that defends against Meta's replace-not-merge targeting writes, the canServe/match-floor disclosure so a too-small exclusion cannot masquerade as a solved problem, hard caps (adset-level only, max 5 exclusions, no removal op, one per ad set per run). Meanwhile the spec's §8 shows placements are NOT the easy first step this document assumed: on Advantage+ placements, excluding a placement is a mode change to manual that forfeits per-asset Customize Media, a real trade needing its own founder ruling. Revised order therefore: **audience exclusions first (spec ready, strictly narrowing, code touch points verified current), placements second (after the Advantage+ trade is ruled), general audience edits later, creative text last or never.** Two one-line decisions unlock the build: approve v1.1 exclusions as the first widened class, and fold it into v1's existing graduation bar (recommended, since an exclusion is lower risk than a budget move already inside the bar) or start its own count.

**5. New founder direction, same day: the Norbert front door.** Verbatim intent: a Norbert page and chat in the portal where everything is discussed before Oscar and Bernard are called and dispatched, running on Anthropic API key tokens rather than the founder's Claude plan. Built 2026-08-26 (all portal agents already bill to `ANTHROPIC_API_KEY`; this makes the portal the default route for agent work rather than Code-session relays on plan tokens). Norbert's chat runs on Claude Fable 5 (a different model family from the Sonnet both agents run, preserving the optimise spec's reviewer-independence principle), reads both agents' live state, dispatches written briefs to either agent on the founder's word, and holds no approval authority whatsoever: every brief carries a machine-prepended header voiding approval language, so a dispatch cannot trip the founder-word gates in the receiving agent. Approvals still execute only where they always did: decide_proposal/apply on Oscar's side, decide_fix/decide_move on Bernard's. Whether Norbert should ever RELAY a founder approval spoken in his chat is an open governance question, deliberately not built; the founder can rule on it after living with the front door.

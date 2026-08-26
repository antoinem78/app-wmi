# Agent optimise v1.1: audience exclusions

**2026-08-19. Build spec, not a design note.** Extends `docs/BERNARD_OPTIMISE_SPEC.md` (v1) with one new op class. Everything in v1 that is not restated here is inherited unchanged: the operating model, the pre-flight gates, Norbert's review, per-move approval, read-back, the R15.1 quarantine.

**Why this exists.** On 2026-08-19 the founder needed an exclusion audience applied to five live ad sets on Steffen Foerster, because clients who had already booked and paid were seeing the ads. Bernard could not do it. `OptimiseMove.op` is `pause | budget | unpause` only, `BERNARD_build` creates entities rather than editing them, and `BernardFix` is approve/reject on Bernard's own proposals. So a compliance-shaped fix, in front of a client, became a manual job. The founder's objection was exactly right in intent: the point of build and optimise is that he does not apply manual changes.

**This is not a request to reopen UI automation.** That was researched the same day and ruled out permanently: driving Ads Manager with any browser or GUI agent breaches Meta's terms and risks losing the whole Business Manager. See the `never-ui-automate-meta-ads-manager` memory. `excluded_custom_audiences` is a supported Marketing API field, shipped in v22, and works as a hard constraint even inside Advantage+ Audience. The gap was always in our code, never in Meta's surface.

---

## 1. The standing decision this has to get past

v1 §8 puts **targeting** out of scope, reason given: "destroy learning history". That reason is sound and is not being waved away. Adding an exclusion is an audience edit and does reset the ad set's learning phase.

**The argument for carving exclusions out ahead of the rest of targeting rests on one property: an exclusion can only ever narrow delivery, never widen it.** The worst case of a wrong exclusion is under-delivery plus a learning reset. The worst case of a wrong interest, geo or age edit is spending money on the wrong people, which is unbounded. That asymmetry is why exclusions can ship while the rest of §8 stays closed.

**Two consequences, both load-bearing:**

- **v1.1 ships `audience_exclude` only. Removing an exclusion widens delivery, so it is NOT in this spec and stays a human action.** The one-way property is what makes the risk case work, and it must not be quietly broken by adding the inverse later without its own ruling.
- **The learning reset is disclosed, not hidden.** See §4.

**Founder ruling needed, one line:** does v1.1 fold into v1's existing graduation bar (50 approved moves, zero reversals, per agent), or start its own count? Recommendation: fold in. An exclusion is strictly lower risk than a budget move, which is already inside the bar, so starting a separate count would rank it as more dangerous than the thing it is safer than.

**RULED 2026-08-26, both lines: audience_exclude approved as the first widened move class, and folded into v1's existing graduation bar. Built and deployed the same day** (substrate migration 0009, both workflows regenerated from `scripts/build-optimise-workflows.py` and re-deployed, portal grammar in `src/lib/bernard.ts` and `bernard-agent.ts`). Acceptance state: §7 tests 3, 4, 5 and 8 passed LIVE on the Steffen Foerster account; test 2 passed at logic level (`tests/verify-exclusion.test.js`, which also caught and fixed a crash-on-dropped-field bug in the diff before deploy); test 7 covered by the existing gates suite; test 1 staged and awaiting the founder's per-move approve; test 6 (sixth exclusion) reviewed in code but not exercisable live, since no ad set carries five exclusions. Field note from the live run: the same audience read `delivery_status` 300/count 20 on the batch `?ids=` surface and 200/count 1000 on the single-object surface at the same moment; the workflow reads the batch surface, which is the conservative one, so the §4 warning fires on the honest reading.

---

## 2. Move grammar

One new shape, following v1 §2:

```json
{
  "op": "audience_exclude",
  "entity_type": "adset",
  "entity_id": "120250809746340053",
  "audience_id": "120250694850660053",
  "evidence": "..."
}
```

Machine limits, enforced before Norbert sees a proposal:

- `entity_type` must be `adset`. Exclusions do not apply at campaign or ad level; anything else fails the whole set.
- `audience_id` must resolve, and must belong to the same ad account as `entity_id`. A cross-account audience id fails the set.
- **The audience must not already be in that ad set's inclusion list.** Excluding an audience you are simultaneously targeting is incoherent and is almost always a mis-specified move.
- **The audience must not already be excluded on that ad set.** Idempotent no-ops still burn a daily-ceiling slot and still reset learning, so they are refused rather than absorbed.
- **Maximum 5 excluded audiences per ad set after the move.** This account family has already squeezed an ad set to roughly 1,000 people by stacking audiences; the cap is there so a sequence of individually reasonable exclusions cannot strangle delivery.
- One `audience_exclude` per ad set per run. Two is one move done badly, same rule as budget.

---

## 3. The write, and the one thing most likely to go wrong

**`excluded_custom_audiences` is nested inside the ad set's `targeting` object, and Meta's targeting spec is replace-not-merge.** Sending a partial `targeting` payload can silently drop interests, geo, age, placements and Advantage+ flags that were not included.

**Required sequence, and it is not optional:**

1. **Read** the ad set's complete current `targeting` object.
2. **Snapshot** it verbatim into `move_snapshots` as the decision-time state, before any mutation.
3. **Merge** the new audience id into `excluded_custom_audiences`, changing nothing else.
4. **Write** the whole targeting object back.
5. **Read back** the complete targeting object.
6. **Diff every field against the snapshot.** Only `excluded_custom_audiences` may differ, and only by the single added id. **Any other field differing at all is `verification_failed`**, not success, and raises an alert rather than reporting done.

Step 6 is the acceptance test for this build. A 200 response proves nothing; v1 §5 already establishes that and this op is the one where a partial-payload bug would do the most damage while looking clean.

---

## 4. New gate: the exclusion must be able to match somebody

**Drawn directly from the incident that motivated this spec.** The audience applied to four ad sets on Steffen Foerster, `Applicants and Bookers`, reads as subtype CUSTOM, retention 0, zero event sources, zero events, and Meta reports it `canServe: false`, too small to use in campaign creation. It may match nobody, which would mean four ad sets carrying an exclusion that excludes no one while everybody believed the problem was handled. Nobody caught it because nothing was checking.

**So before staging any `audience_exclude` proposal, read the target audience's `canServe`, `approximate_count` and `subtype`, and attach all three to the approval item.** Where `canServe` is false or the count is below Meta's match floor, **the approval item must say, in plain words, that this exclusion may not match anyone and is therefore not evidence the problem is solved.** Do not refuse the move on this basis. A too-small exclusion is harmless in itself; the harm is believing it worked. The gate exists to stop a false sense of completion, not to block the write.

**Also required in the approval item, per v1 §4 conventions:**

- **A plain statement that this resets the ad set's learning phase**, with how long the ad set has been running and what it has spent. That is the cost the founder is approving, and it must be visible at the point of decision rather than discovered afterwards.
- Whether the ad set is currently in `LEARNING`, since resetting an ad set that is already learning costs far less than resetting one that has stabilised.

---

## 5. Gates inherited unchanged from v1 §3

Kill switch, stand-down and client `enabled`. Thrash gate, counting the platform's own change history plus `move_snapshots`, which matters here because these accounts are freelancer-managed and this exact week saw 189 changes in 7 days on the paired Google account. Human-change check, naming any human whose change this reverses within 14 days. Daily ceiling of 3 executed moves per account, which `audience_exclude` counts against like any other. Data maturity flagging.

Norbert's review, per-move founder approval, and the counterfactual row on rejection all work exactly as v1 describes.

---

## 6. Code touch points

| File | Change |
|---|---|
| [src/lib/bernard.ts:107](src/lib/bernard.ts:107) | Add `"audience_exclude"` to `OptimiseMove.op`; add optional `audience_id: string` |
| [src/lib/integrations/anthropic/bernard-agent.ts:206](src/lib/integrations/anthropic/bernard-agent.ts:206) | `dispatch_optimise` tool description currently says "pause/budget optimisation moves"; extend |
| [src/lib/integrations/anthropic/bernard-agent.ts:321](src/lib/integrations/anthropic/bernard-agent.ts:321) | Doctrine text says "the only two ops that exist"; update, and state the one-way property so Bernard does not offer to remove exclusions |
| [src/lib/integrations/anthropic/bernard-agent.ts:430](src/lib/integrations/anthropic/bernard-agent.ts:430) | Progress string for the new op |
| [src/lib/integrations/anthropic/bernard-agent.ts:581](src/lib/integrations/anthropic/bernard-agent.ts:581) | Handler validation: require `audience_id` when op is `audience_exclude` |
| n8n `BERNARD_optimise` | Proposal generation, the §2 limits, the §4 match check |
| n8n `BERNARD_optimise_execute` | The §3 read-merge-write-diff sequence |
| `docs/BERNARD_OPTIMISE_SPEC.md` | §2 grammar, §3 gates, and §8 amended to say exclusions have moved in scope and why |

---

## 7. Acceptance tests

1. Full-targeting round trip on a paused test ad set: every field other than `excluded_custom_audiences` byte-identical after the write.
2. A deliberately partial payload is caught by the §3 step 6 diff and reports `verification_failed`, with zero silent success.
3. An audience with `canServe: false` stages successfully and its approval item carries the may-not-match warning verbatim.
4. Cross-account `audience_id` fails the whole set before staging.
5. Re-excluding an already-excluded audience is refused, not absorbed.
6. The sixth exclusion on an ad set is refused.
7. Thrash gate fires on an entity with 4 or more changes in 7 days, attaching the history.
8. Rejection writes the counterfactual row.

---

## 8. Explicitly still out of scope

Everything v1 §8 excludes except audience exclusions: creative swaps, interests, geo, age, bid strategy, scheduling, any write outside a founder-triggered session.

**Removing an exclusion**, per §1. One-way only.

**Placements, and this one is a near miss worth naming**, because it was the other thing that blocked the founder this week. Placement restriction shares the only-ever-narrows property that justifies exclusions, so it looks like an obvious companion. It is not, for one specific reason: on an ad set using Advantage+ placements, excluding a placement is not a field edit but a **mode change to manual**, and that mode change forfeits the per-asset Customize Media control which is the only way to keep a widescreen video out of vertical placements without a separate ad set. That is a real trade with no right default, so it needs a founder ruling rather than an agent's judgement. Candidate for v1.2 with that decision made first.

---

## 9. Oscar's leg

Google's equivalent is `excluded_audiences` at ad group or campaign level, and Oscar already has the proposal and guardrail machinery per v1 §9. Same one-way rule, same match-quality disclosure, same read-back diff. Follows the Meta leg rather than shipping with it, exactly as v1 sequenced it.

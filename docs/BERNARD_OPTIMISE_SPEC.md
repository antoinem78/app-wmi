# Agent optimise v1: executor spec (Bernard and Oscar, supervised by Norbert)

**2026-08-18. All seven design decisions ruled, then the operating model ruled the same day and folded in.** Companion: `docs/BERNARD_OPTIMISE_DESIGN_NOTE.md` (the reasoning), Executor Contract v2 (the conventions this inherits). Quarantined under R15.1 as a new capability. **Graduation bar: fifty approved moves with no reversal, counted per agent.**

**The operating model, which frames everything below.** Human contractors stay; Gopoxy and Steffen are freelancer-managed and remain so. Build and optimise run **only in founder-triggered sessions** (audit first, then build and/or optimise on the founder's word), to complement, improve or correct the freelancer's work. Between sessions the agents watch and flag. **Norbert supervises both Bernard (Meta) and Oscar (Google)**: his review precedes the founder's on every session. v1 builds the Meta leg because that is where the executor machinery lives; Oscar's Google leg reuses his existing proposals path with Norbert's review inserted ahead of the founder, and is scoped in §9.

## 0. The rulings this implements

| # | Ruling |
|---|---|
| 1 | Own R15.1 bar: 50 approved moves, zero reversals |
| 2 | Does not wait for build to graduate |
| 3 | Move classes: **pause and budget only** |
| 4 | Critic is a different model from Bernard, named **Norbert** |
| 5 | Daily ceiling: **3 moves per account**, config per client |
| 6 | **On demand only**, no schedule |
| 7 | First accounts **Steffen and Gopoxy**, both freelancer-managed, both write-eligible **only inside a founder-triggered session**. The 2026-08-13 watch-and-flag ruling is the resting posture between sessions, not a contradiction |

## 1. Workflows

Three, mirroring the build family's shape:

**`BERNARD_optimise`** (webhook, founder-dispatched only): reads the account live, proposes at most `daily_ceiling` moves with evidence, snapshots decision-time state, stages them as `proposed`.

**`NORBERT_review`** (called synchronously by the proposer): a different model reviews the staged set. Two questions, separately answered: **Q1, is any proposal wrong**, with the specific reason; **Q2, what is the biggest problem in this account the run did not touch.** One revision round enforced in the runtime: Bernard amends or defends with specifics, then the set goes to the founder regardless. Norbert's findings ride with the approval item, never silently resolved.

**`BERNARD_optimise_execute`** (webhook, per-move, founder approval token required): executes ONE approved move, reads it back, writes the `move_snapshots` row as `executed` with `executed_at`. A rejection writes the counterfactual row instead, which already works (Denis item 1.2).

## 2. Move grammar, the only two shapes v1 accepts

```json
{ "op": "pause",  "entity_type": "ad|adset|campaign", "entity_id": "...", "evidence": "..." }
{ "op": "budget", "adset_id": "...", "from_minor": 4000, "to_minor": 3000, "evidence": "..." }
```

Machine limits, enforced in code before Norbert ever sees a proposal:

- **Budget moves bounded to ±25% per move**, and never above the client's `write_budget.max_daily_budget_minor`. Two budget moves on the same entity in one run is one move done badly; refused.
- **Unpause is `pause` in reverse and is only legal on an entity whose last `move_snapshots` row is a Bernard pause.** An entity the founder paused is not Bernard's to wake.
- Anything else in the `op` field fails the whole set before any staging.

## 3. Pre-flight gates, all machine, all before a proposal exists

In order, each with its refusal logged as a `gate_blocked` counterfactual:

1. Kill switch, stand-down, client `enabled`, exactly as build.
2. **Thrash gate:** 4 or more changes on the entity in 7 days (config `thrash_n`) refuses, attaching the change history. On a freelancer-managed account, which is now the normal case, it counts **the platform's own change history plus `move_snapshots`**, because the freelancer's edits destabilise an entity exactly as ours do. Never reads `tasks`, which carries 1,177 OpenDental rows that are not moves.
2b. **Human-change check:** any proposal that would reverse a change made by a human in the last 14 days must say so, named, in the approval item. The founder arbitrates between agent and freelancer; the agent never does.
3. **Daily ceiling:** counting `executed` rows today for this account; at 3, the run refuses to propose more.
4. **Data maturity:** any read taken intraday marks every resulting proposal `immature_data: true`, and that flag renders in the founder's approval item verbatim.

## 4. Approval surface

Per move, not per batch, in the portal chat where dispatch already lives. Each item carries: the move, the evidence, the decision-time snapshot summary, Norbert's Q1 verdict on that move, Norbert's Q2 finding for the run, and the immature-data caveat when set. Approve executes that move only. Reject records why, and the why lands in the counterfactual row.

## 5. Read-back and reversal

Every executed move is re-read from Meta before it is reported done; a budget PATCH that returns 200 but reads back unchanged is `verification_failed`, not success. **Reversal definition for the graduation bar:** any subsequent move or founder action that returns the entity to its pre-move state within 14 days counts as a reversal, whoever performs it. Counted from `move_snapshots` plus account change history, so it cannot be gamed by doing the reversal by hand.

## 6. Norbert, concretely

Different model family from Bernard's runtime, temperature default, no shared conversation state: he sees the staged set, the snapshots and the live account read, not Bernard's reasoning. That is deliberate; he reviews the account, not the argument. His pass writes one row per run to `action_log` with `model`, `tokens_in`, `tokens_out`, `cost_usd` populated, because the economics ledger showed the agents record nothing and this one does not get to start life unmetered.

**Bernard's runtime also gets the same four columns wired in this build.** It is half a day, it is already owed, and shipping a new agent metered while the old one is blind would be backwards.

## 7. Prerequisites before first dispatch

1. **Substrate rows for both accounts.** Neither Steffen nor Gopoxy has one and the executor gates on it. Each needs: slug, ad account id, `write_budget`, `thrash_n`, `daily_ceiling`. Founder go before each write, per convention.
2. Norbert model choice and credential in n8n.
3. The em dash in build's ad-name fallback gets fixed in the same deploy window, since both workflows ship together.

## 8. Explicitly out of v1

Creative swaps, targeting, bid strategy (destroy learning history). Scheduling, and any write outside a founder-triggered session. Any grading of moves (snapshots accumulate; grading is a later, separately-reviewed decision). Meta writes outside the two-op grammar.

## 9. Oscar's leg, scoped not built

Oscar already has the machinery this spec would otherwise invent: `list_proposals`, `decide_proposal`, `apply_proposal` with guardrail re-checks, and `write_audit`. What he gains is **Norbert inserted between proposal and founder**, the same two questions, the same one revision round, and the same session-only trigger. No new Google write surface. The thrash gate and human-change check apply identically, reading the Google Ads change history. Build order: Meta leg first because it is net-new; Oscar's insertion is a follow-up in the same pattern once Norbert exists.

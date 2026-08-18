# BERNARD_optimise, the Critic, and the graded-move ledger: one design note

**2026-08-17.** Founder-requested: an optimisation executor, human in the loop always, with an agent reviewing before the human. This is also the note owed under the 2026-08-05 risk brief §3 and the Denis brief §4, because the reviewer the founder asked for and the Critic that brief specifies are the same organ. One note, four parts.

**Nothing here is built. No workflow exists. This is for review.**

---

## 1. The thing that makes optimise different from build, and it removes the safety net

`BERNARD_build` is safe for one structural reason that has nothing to do with its gates: **everything it creates is PAUSED.** A bad build spends nothing. Four orphan campaigns sat on Atelier Brunos for days and cost zero, which is the only reason that incident was embarrassing rather than expensive.

**Optimise has no PAUSED equivalent.** Every move it makes changes live delivery the moment it lands. A budget raised is money spent. A targeting change resets learning on an ad set that was working. There is no state in which the change exists but is inert.

So the safety cannot be inherited. It has to be rebuilt out of four things that build does not need: **per-move approval rather than per-batch, hard reversibility classes, a daily change ceiling per account, and a thrash gate that refuses rather than warns.**

Everything below follows from that one difference.

## 2. Move classes, tiered by whether a mistake is recoverable

Not all optimisation moves are the same kind of risk, and treating them uniformly is how a system either blocks everything or waves everything through.

| Class | Reversible? | v1 |
|---|---|---|
| **Pause** an ad, ad set or campaign | Yes, fully | **In** |
| **Budget change** within a bounded percentage | Yes, and the spend is bounded by the cap | **In** |
| **Unpause** something previously paused | Yes | **In, with a caveat** |
| **Creative swap** (new ad, pause old) | Yes, but restarts creative learning | Out |
| **Targeting or audience change** | **No.** The delivery history is gone | Out |
| **Bid strategy change** | **No.** Resets learning wholesale | Out |

**Recommendation: v1 does pause and budget only.** Those two cover most of the real day-to-day value, are the two the founder already makes by hand, and both are undoable in one click. The bottom three all destroy learning history, and "we can set it back" is not reversibility when the thing lost is two weeks of delivery data.

The caveat on unpause: unpausing something the founder paused deliberately is a way for an agent to overturn a human decision. **Unpause is allowed only for entities Bernard itself paused**, tracked through `move_snapshots`.

## 3. The pipeline, and where each gate sits

```
                    proposes, with evidence
   BERNARD_optimise ─────────────────────────► staged moves + decision-time snapshot
          │                                              │
          │ pre-flight, before any proposal exists       │
          ├─ kill switch, stand-down, client enabled     │
          ├─ THRASH GATE: N+ changes in 7 days refuses   │
          ├─ daily change ceiling per account            │
          └─ data-maturity: intraday reads carry a caveat│
                                                         ▼
                                           BERNARD_critic  (separate model pass)
                                                         │
                                    ┌────────────────────┴────────────────────┐
                                    │ Q1: is this proposal wrong?             │
                                    │ Q2: what is the biggest problem this    │
                                    │     run did NOT touch?                  │
                                    └────────────────────┬────────────────────┘
                                                         │ one revision round:
                                                         │ act, or defend with specifics
                                                         ▼
                                              FOUNDER, per move, not per batch
                                                         │
                                          approve ───────┼─────── reject
                                                         │           │
                                                         ▼           ▼
                                                    execute     counterfactual row
                                                         │      (already built, item 1.2)
                                                         ▼
                                              read-back verification
                                                         │
                                                         ▼
                                              move_snapshots, executed
```

**Two questions, not one.** The Denis brief specifies the Critic asks only "what did this run not touch", because omission is the failure class governed systems drift into. The founder asked for a reviewer that checks the proposal. **Both are needed and they are different jobs.** Q1 is adversarial on what is there; Q2 is adversarial on what is absent. A reviewer asked only Q1 will rubber-stamp a run that ignored the biggest problem in the account.

**One revision round, enforced in the runtime, not in the prompt.** Bernard acts on the finding or defends the hold with specifics, and then it goes to the founder either way. Unbounded rounds are how two models talk themselves into agreement.

## 4. What it reuses, which is most of it

Nothing here needs new safety machinery. The pieces exist:

**`move_snapshots`** (migration 0007, live). This is what it was built for. The optimisation fields currently null for build moves (pacing, frequency, creative age, learning status, budget utilisation) are exactly the state an optimise proposal reasons over, so they populate for the first time and the schema does not change.

**The counterfactual class** (item 1.2, live). A founder rejection at the review step is already recorded with the state that produced it. **That is the honest control group**, and it is why grading later will not be measuring regression to the mean.

**Gate hold and write budget**, both machine-enforced pre-flight in `Plan batch`, both portable.

**Read-back verification.** Claimed is not true until read, and that applies harder here: a budget update can return 200 and not take effect.

**What is genuinely new:** the proposal store, the Critic pass, the per-move approval surface, the thrash gate and the daily ceiling.

## 5. The thrash gate, which is the one that must refuse rather than warn

The Denis dossier's doctrine is that N or more changes to an entity in 7 days marks it as thrashing, and a thrashing entity needs stability rather than another move. **In their system that was advice, and their own buyer flip-flopped one ad set thirteen times in a week anyway.**

Make it a gate. Default N is 4, config per client. A thrashing entity is refused with the change history attached, and the refusal is logged as a counterfactual.

**Data hazard, already found:** the `tasks` table carries 1,177 historic OpenDental rows for Shallowford that are not moves at all. Any thrash counter reading that table naively makes Shallowford look like it thrashed 1,177 times in June. The counter must read `move_snapshots`, or filter `tasks` by move class.

## 6. The graded-move ledger

Grading is deliberately **not** in v1. The snapshots accumulate now; grading is a later decision with its own review. Three rules to install at birth, because retrofitting them is impossible:

**Never grade a pause on raw before/after.** A paused entity's metrics improve by definition. Pause-class moves grade against the counterfactual set or not at all.

**The 12-hour staleness rule.** A move whose snapshot is more than 12 hours older than its execution grades **INCONCLUSIVE**, never as a verdict from a stale baseline. `taken_at` and `executed_at` are already stored as a pair so this is computable.

**Partition by move class before fitting anything.** See the Shallowford rows above.

## 7. Memory hygiene, the part originally asked for on 2026-08-05

**Principles and lessons, never volatile facts.** Budgets, statuses, counts and spend figures are re-read live every run and must never be remembered. A remembered number is a stale number wearing the clothes of knowledge.

**Honest statement of what is enforceable.** In the current memory tooling this is **instructional, not structural**: nothing prevents an agent writing "the budget is £40/day" into memory. The structural version is a write-time check on the memory tool that rejects entries containing bare figures against known volatile keys. Worth building only if the instructional version is seen to fail; say so plainly rather than claiming a control that does not exist.

**Audit cadence:** monthly read of every agent memory, checking each entry is still true and is still a principle. The KST-literals-in-VIP incident is the argument: clone artefacts survive precisely because nobody re-reads them.

## 8. Decisions I need from you before anything is built

**1. R15.1.** Optimisation is a new capability, so it starts quarantined. What is its graduation bar? Build's is ten clean verified builds across three clients. My suggestion for optimise: **fifty approved moves with no reversal**, because the failure mode is silent degradation rather than a visible error.

**2. Does build graduate first?** Build sits at 11 built against 20 failed. Running a second capability while the first has an unresolved spec-quality problem is a real choice.

**3. Move classes for v1.** I recommend pause and budget only. Say if you want creative swaps in.

**4. Who is the Critic?** A different model is better than the same model at a different temperature, because the failure being guarded against is shared blind spots. Cost is one extra pass per run.

**5. Daily change ceiling per account.** I would start at 3.

**6. On demand or scheduled?** I recommend on demand only for v1. A schedule means moves get proposed when nobody is watching, and the data-maturity rule already says the cadence should follow data rather than the clock.

**7. Which client first.** Not Atelier Brunos: it is the newest revenue and has had two configuration incidents in a fortnight. Steffen or DentalMastery are lower-consequence proving grounds.

# Executor Contract v2 §6, audited against reality

**Risk brief 2026-08-05, item 1.2. Audited 2026-08-12.** Chat's charge: *"the parser scored successful creates as failures for four consecutive rounds and left four orphan shells. So the control does not enforce the thing it claims."* And the standard to hold: *"a contract that overstates its enforcement is worse than one that admits a control is declared-only."*

## Every MACHINE claim in §6 is demonstrable

Checked against the deployed `BERNARD_build` code, not against the register.

| §6 claim | Verdict | Evidence in the live workflow |
|---|---|---|
| Write budget, MACHINE pre-flight | **Holds** | `Plan batch` reads `cfg.write_budget`, sets `MAX_OPS` (default 25) and `MAX_DAILY` (default 5000 minor units), and caps both the operation count and every daily budget before a batch is assembled. |
| Gate hold, MACHINE pre-flight | **Holds** | `Plan batch` walks `gate_conditions` and blocks before any Meta call. Independently proven on 31 July with a deliberately blocked live envelope: zero Meta writes, rejection logged. |
| PAUSED at creation | **Holds** | `status: 'PAUSED'` is written into the body of every campaign, ad set and ad, regardless of what the spec asks for. |
| Verification diff, MACHINE | **Holds** | `Verify build` derives the verdict from a read-back of the account, not from the batch response. |
| Report shape, MACHINE | **Holds, and that is the problem.** See below. |

**Nothing needs downgrading.** The contract does not overstate what it enforces.

## But one row was doing damage by being true

The **report shape** row says: *"The builder constructs the report. Nothing is being asked politely."* That is accurate. The report always had the right shape.

**What failed on 5 August was not shape, it was truth.** A well-formed report said `build_failed` about five campaigns that existed on the account. The shape control passed every time while the content was wrong every time, and because the row read MACHINE, the report looked like something that had been checked.

So Chat's charge is half right in an interesting way. The claim was not overstated; **the claim was answering a question nobody needed answered**, and its confident wording is what discouraged anyone from asking the question that mattered.

**Recommended amendment: add a row rather than change one.**

| Control | Status | Why |
|---|---|---|
| **Report accuracy** | **DECLARED. Settled only by read-back.** | Shape is machine-enforced; correspondence to what exists on the account is not, and cannot be, because the batch response is not a reliable witness. Meta returns empty elements for operations that succeeded. Nothing in the report may be believed until `Verify build` has read the account. |

That row would have prevented the orphans, not by adding a control, but by removing false confidence from the one that existed. It is also exactly the discipline §6 already articulates for the diff (*"claimed is still not true until read"*) and simply never applied to the report itself.

## The parser is fixed, and now tested

Rule 4 is implemented in the live `Parse batch`: a slot carrying neither an id nor an error is `unresolved`, never `failed`, and is handed to `Verify build` to settle by reading Meta. The node's own comment carries the 5 August post-mortem, including the detail that refutes the old scoring on its face: ad set `as0_0` depended on `c0` and was created, which is only possible if `c0` returned an id to the batch.

**29 tests, all passing, against code extracted from the live workflow rather than a copy** (`tests/parse-batch.test.js`, `node tests/parse-batch.test.js`). Six shapes, every one of which has actually occurred: clean create, the empty-slot-on-success orphan case, the NULL dependency cascade, the top-level transport failure, a real per-op error with Meta's blame fields, and the mixed case that turns up in life.

The extraction matters. A suite testing a hand-copied parser would go green about code that is not deployed, which is the same class of false confidence as the report-shape row.

## The record, re-run

| Verdict | Lifetime | Since the fix (after 5 Aug) |
|---|---|---|
| `built` | 11 | 9 |
| `built_with_problems` | 4 | 2 |
| `build_failed` | 20 | 14 |

**Worth saying plainly: the failure rate is still high.** Fourteen failures in twenty-five attempts since the fix. The parser no longer mis-scores successes, which was the reported bug, but it was never the whole problem. Most of those failures are genuine Meta rejections from the six dispatch rounds (permissions, pixel binding, a deprecated placement, CBO versus ad-set budget, the Advantage age floor), and each was resolved by a human reading the error and correcting the spec.

That is a **spec-quality problem, not a parser problem**, and it is the thing the Denis addendum's Critic pass is arguably aimed at. It should not be filed as fixed.

## One unrelated finding, small and client-visible

`Plan batch` auto-names ads with an em dash:

```js
name: ad.name || (a.name + ' — ad ' + (di + 1))
```

Those names appear in the client's own Ads Manager. The standing ruling is no em dashes anywhere. One-character fix, needs a founder-gated deploy to the workflow like any other change.

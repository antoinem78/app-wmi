---
name: replay-real-executions-through-the-glue
description: Unit tests on functions extracted from n8n Code nodes miss the glue around them; replay captured real executions through the actual node code with the database in a rolled-back transaction, and expect it to find bugs the unit tests passed
metadata:
  type: feedback
---

Three optimise-workflow bugs in a row lived outside the tested function: `got is not defined` one line after the verified diff (26 August), a strict diff that would have failed every real exclusion because Meta appends a default field on write, and a JS Date interpolated into a SQL literal that Postgres rejects. The 24 gate tests and 11 diff tests were green throughout. All three surfaced within an hour of running the real node code against captured execution data (`tests/optimise-glue.smoke.js`, 2026-09-03), two of them only because Postgres nodes ran their real resolved SQL inside `BEGIN … ROLLBACK`.

**Why:** the pure function is the part that was designed; the glue (what `$input` really carries, what the Postgres driver hands back, what Meta appends on a write) is the part nobody specified, so it is where the assumptions hide. Fixture-shaped data is what the author imagined; captured execution data is what happened.

**How to apply:** for any n8n workflow that writes to a platform, keep a harness that runs the Code, If and Switch nodes for real with `$('Node')` emulated, feeds external nodes from captured executions, resolves every `{{ }}` template and refuses `undefined`, `NaN` and `[object Object]` in the result, and has a mode where Postgres nodes execute against the real database inside a transaction that always rolls back. Refresh fixtures from real executions, never by hand, and strip `paging` first (see [[meta-token-lives-in-n8n-execution-data]]). Deploy from the generator, then diff n8n against it (`--deployed`), so the tested code and the running code are the same bytes.

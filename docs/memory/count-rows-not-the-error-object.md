---
name: count-rows-not-the-error-object
description: A REST error body is a 4-key dict, so len() of an unchecked response reads as "4 rows"; assert the response is a list before counting, and never cite a count whose query you did not see succeed
metadata:
  type: feedback
---

On 2026-09-03 I cited "the portal holds 4 paid rows" as evidence in the strategic state file. The query had named a column that does not exist; PostgREST returned `{"code","details","hint","message"}` and my one-liner printed `len()` of it. The real count was 0. The underlying claim happened to be true on other evidence, but the number I published was the size of an error message.

**Why:** a wrong instrument produces a confident number. The habit of `len(json.load(...))` without checking the type is exactly the kind of check that passes because it was chosen to pass.

**How to apply:** every count or list read over REST asserts `isinstance(rows, list)` first and prints the error body otherwise. Evidence quoted in a state file names the query that produced it. When a test client is about to be deleted, capture its activity rows first: `activity_log` cascades on client delete, and the 6 August rehearsal evidence survived only in a session transcript. See also [[never-assert-absence-from-one-reading]].

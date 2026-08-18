---
name: validate-backups-by-reading-executions
description: "The nightly n8n backup failed 30/30 for months while looking active; a backup claim is validated by reading executions AND the destination repo, never by the workflow being active"
metadata: 
  node_type: memory
  type: project
  originSessionId: b3c42a30-35e2-452c-8cf4-c3de3c3beba9
  modified: 2026-08-16T20:59:27.058Z
---

The n8n `Daily Backup to GitHub v2` workflow was active and firing nightly, yet every retained execution (2026-07-17 through 2026-08-15, 30/30) failed on GitHub 409: 50 unthrottled Contents-API PUTs race the branch ref, and the node had no retry and `onError: stopWorkflow`. Coverage was 1-2 random files per night; 25 of 50 live workflows (including `BERNARD_build`) had NEVER been captured. Fixed 2026-08-16 (throttle 1 req/2s, retry x5, continue on item failure), proven by a 50/50 manual run and a 50/50 unaided scheduled run the same night.

**Why:** "the backup workflow is active" and "backups exist" are different claims. The failure was invisible because nobody read the execution list or counted files in the destination repo.

**How to apply:** to validate any scheduled job, read its execution history (statuses, durations) AND its output at the destination, and compare against the full expected set. A 7-second run that should take 100 seconds is a tell. Also: GitHub Contents API serialises commits on the branch ref, so sequential PUTs need throttling and retry regardless of unique file paths. Related: [[never-infer-delivery-from-repo]], [[prove-offline-conversions-account-side]].

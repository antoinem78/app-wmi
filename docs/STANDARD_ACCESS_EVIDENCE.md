# Google Ads API — Standard Access evidence: controlled, human-approved, reversible writes

**Tool:** WMI PPC Ops Command Center ("Rexos") — app.wmiltd.com
**Developer token holder:** WMI, operating client accounts under a single MCC.
**Summary:** The tool performs Google Ads write operations **only** through a human approval gate, with server-side validation, post-write verification, an immutable audit trail, and one-click rollback. Below is the design and a proven end-to-end example, independently corroborated by the account's Google Ads Change History.

---

## 1. Write capability (deliberately narrow)
Three write actions, **one operation per approval (no batching, no autonomous writes):**
1. **Add a negative keyword** (campaign or ad-group level) — rollback: remove it.
2. **Pause / re-enable a campaign** — rollback: restore the prior status.
3. **Set a campaign daily budget** (non-shared budgets only, hard-capped) — rollback: restore the prior amount.

All writes use `GoogleAdsService.Mutate` (`customers/{id}/googleAds:mutate`) with `validateOnly` support.

## 2. Required execution flow (enforced by the backend worker, not the UI)
```
proposal created  →  stored as an immutable pending record
  →  human approves (recorded with actor + timestamp)
  →  worker RE-CHECKS the approval record (UI is not the control boundary)
  →  worker builds a single mutate operation
  →  validate_only = true   (server-side validation, NO change)
  →  if valid: execute the mutate
  →  re-query the entity to VERIFY the resulting state
  →  write an immutable audit entry (before + after)
  →  rollback action available
```

## 3. Guardrails
- **Kill switch** (`GOOGLE_ADS_WRITE_ENABLED`) — off by default; disables all writes instantly.
- **Allowlists** — only allowlisted customer IDs may be written; pause/budget additionally require the campaign ID on a separate allowlist.
- **Budget caps** — hard daily ceiling, max-increase %, and a confirmation requirement for large decreases.
- **One operation per approval**, no batch writes, no autonomous writes (every change is human-approved).
- **Previous state captured** before every mutate; **immutable audit** (append-only activity log + a per-proposal execution record with before/after); **Slack alert** after every successful mutate; **rollback** generated where reversible.

## 4. Proven end-to-end example (test account 2367242101, a non-serving POC account)
Action: add a campaign-level **negative** keyword `"p5 proof probe"` (PHRASE) to a **paused** test campaign, then roll it back.

| Stage | Result |
|---|---|
| Proposal filed | executable proposal recorded (pending) |
| Approved | decision recorded (actor + timestamp) |
| Dry-run (`validate_only`) | passed — no change |
| Apply | `validate_only` → mutate → **verified**: criterion created at `customers/2367242101/campaignCriteria/23723187240~…` |
| Rollback | criterion removed |
| Independent verify | re-query confirmed the criterion no longer exists |
| Audit | `proposal_created → approved → applied` (before/after + resourceName) `→ rolled_back` |

**Google Ads Change History corroboration** (the account's own log, outside our app): *"1 negative phrase match keyword added"* then *"1 negative phrase match keyword removed"* — both via **Google Ads API**, attributed to the authenticated OAuth user. The same flow was also exercised through the live product UI (campaign-level EXACT negative `"free"`).

## 5. Access & permissions (why token alone is insufficient)
Writes require all of: the developer token's access level permitting production mutates, the **OAuth user** holding edit/admin access to the target account through the MCC, the account permission, and the specific mutate method. OAuth 2.0 authorizes the app to act on the user's account without storing credentials; the account-hierarchy permissions still gate every operation.

## 6. Scope statement
This is a **controlled proof of capability**, not a general campaign-management release. During this phase the write allowlist is confined to a non-serving test account; widening to live client accounts is a deliberate, separate step after Standard Access is granted.

---

*Implementation: `google-ads/index.ts` (googleAdsMutate), `google-ads/write.ts` (guardrails + op builders), `proposals-execute.ts` (the worker: re-check → validate → mutate → verify → audit → rollback). Read-only reporting + the human approval queue sit in front of all writes.*

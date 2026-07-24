# Design Note: Console Write Surfaces & Growth Operations

**Date:** 2026-07-24. **Author:** Code. **Status:** APPROVED by founder 2026-07-24, with two amendments folded in below: (i) every Tier B apply automatically runs the smoke-probe battery post-apply (§4.3) — verified-not-assumed applies to config changes; (ii) every console write, all tiers, is task-logged (§2, §4).
**Covers:** (a) the Step 5 console→substrate config-write path, (b) the Bernard cockpit pane, (c) the growth_action view + Growth Operations UI, (d) the Growth Assistant guard.
**Grounding:** written against the live substrate schema (tasks, action_log, operators, clients.config) and the code now on main (src/lib/platform/config-write.ts, src/lib/bernard.ts) — every mapping below was checked against real columns and real status values, not the canon's memory of them.

---

## 0. The one principle

The substrate spine (tasks + action_log + clients.config) is the only system of record. Every surface in this note is either a **read projection** of that spine or a **gated writer into** it. No parallel objects, no shadow state in the console DB, no second audit trail. Where a needed field has no home, the answer is one additive column, never a new table.

## 1. Auth model (all four surfaces)

Two independent layers on every path; both must pass.

**Layer 1 — who is asking (session):**
- Cockpit (app.wmiltd.com → app.singularweb.ai per R14): Auth0 session + `agency_admin` role. Already enforced by the (admin) layout and re-checked inside every server action (existing pattern: bernard/actions.ts, agent-actions.ts).
- Client portal instances (R14 doorway skins): Auth0 session + a `tenant` claim binding the user to exactly one client. A portal session can never name another tenant's id; the tenant id comes from the claim, never from the URL or form input.

**Layer 2 — which pipe (transport):**
- Config writes: `x-console-key` → the n8n config-write webhook (exists; env `SUBSTRATE_CONFIG_WRITE_URL` + `CONSOLE_CONFIG_KEY`, deliberately absent from Vercel today).
- Bernard actions: `x-bernard-key` → Bernard's n8n endpoints (live today).
- Substrate reads: the read-only Postgres role (`SUBSTRATE_DB_URL`), server-side only.

**Hard rule:** client-facing portal instances receive **no write keys of any kind**. The only key a portal deployment carries is the read-only role, and its queries are tenant-bound (§5). Writes are a cockpit capability, full stop.

**Authority split (unchanged from Step 5's build):** the console is a *requester*; the n8n webhook is the *enforcer*. The allowlist, tier classification, and audit write live substrate-side, so a compromised console cannot exceed the webhook's rules.

## 2. Audit logging of console-originated writes

Every write that originates in a console lands, atomically with its effect, as **both**:
- one `tasks` row (`operator_id='CONSOLE'`) — all tiers, no exceptions (founder amendment 2026-07-24). Tier A writes create the task directly in `status='applied'` (single act); Tier B tasks travel `staged → applied` (§4); fix approvals and stand-downs keep their existing task rows. This makes the growth_action view (§5) automatically cover every console write.
- one `action_log` row: `workflow='CONSOLE'`, `step=<writable key or action>`, `tool='config_write' | 'bernard_fix' | 'standdown'`, `status`, `input_ref=<Auth0 actor email>`, `output_ref=<summary of old→new>`, `client_id`, keyed to that task.

Nothing writes config without the paired audit row — the n8n webhook does both in one transaction (already its design). The console never writes audit rows directly; it can't, it has no write role.

## 3. Writable-key whitelist (config-write path)

Three tiers, enforced in the webhook, displayed in the UI:

| Tier | Keys (initial set) | Path |
|---|---|---|
| **A — direct write** | `agent.suggestions`, `agent.booking_url`, `agent.handoff_email`, `agent.hours_note`, `report_prompt`-class narrative guidance | dryRun optional; apply immediate; audit row always |
| **B — stage-then-apply** | `agent.persona`, `agent.opening_message`, `agent.qualification_questions`, KB re-ingest (`reingest_kb`) | mandatory dryRun first (§4); founder-visible diff; apply is a second, explicit act |
| **X — never console-writable** | safety floor, gates and gate vocabulary, cant[] guards, model/effort selection, channel enable/disable, autonomy rung, anything under `config.bernard.*`, budgets/spend | substrate-only (Chat canon → Code sessions), or Bernard's founder-gated fix path for Meta whitelist fields. The console UI shows these read-only with a "changed via canon/Bernard" caption. |

Rationale for X: the floor and gates are the product's guarantees (R12: "they are the product"); the console must not be able to weaken them even with an admin session and a valid key.

## 4. Stage-then-apply vs direct write

Tier B changes are two acts separated by a human reading a diff:
1. **Stage:** console calls `dryRun` → webhook returns `{current, proposed}`; console renders the diff. The staged change is recorded as a `tasks` row: `operator_id='CONSOLE'`, `status='staged'`, `request={key, proposed, actor}`. Staging expires (webhook rejects applies against stale stages after 24h or any intervening change to the same key).
2. **Apply:** a second call referencing the staged task id → webhook re-validates current==staged.current (optimistic lock), writes config + audit, flips the task to `status='applied'`.

Rejected/expired stages flip to `status='stage_expired'` — nothing is deleted. (Tier A creates its task row directly in `'applied'`, per §2.)

**4.3 Post-apply verification (founder amendment 2026-07-24).** Applying any Tier B staged change automatically runs the tenant's smoke-probe battery immediately after the write — the same probe pattern used at gate testing (canned probe conversations against the live config, checked for floor/gate/disclosure behaviour and answer sanity). Results land in the task's `result.probes`; on any probe failure the task flips to `status='applied_probe_failed'` and an alert fires to #alerts with the diff and the failing probe, so the founder decides revert-or-accept with evidence in hand. Verified-not-assumed applies to config changes exactly as it does to executor reports: an apply without a green probe battery is not "done".

## 5. growth_action: lifecycle mapping (no new spine)

The Growth Operations Center's unit ("a detected leak → a validated action → an approved change → an observed result") maps **entirely onto existing objects**:

| growth_action lifecycle | Existing home | Value |
|---|---|---|
| detected | `tasks.status='received'` or `'classified'`, `operator_id` = detecting operator (BERNARD, knowledge_qa, …) | exists today |
| validated (evidence attached) | `tasks.plan` jsonb: `{reason, evidence, expected_impact, risk}` + `tasks.risk_level` | columns exist; vocabulary standardised, not added |
| proposed (awaiting founder) | `tasks.status='fix_proposed'` (Bernard pattern, live) or `'staged'` (console pattern, §4) | exists today |
| approved / rejected | `tasks.status='approved'/'fix_rejected'` + actor in `result` | `fix_rejected` already live |
| executing / executed | `action_log` rows keyed by `task_id` (workflow, step, duration, cost, error — all existing columns) | exists today |
| observed result | `tasks.result` jsonb: `{outcome, observed, verified_at}` + Bernard verdict echo | exists today (Bernard report verification writes here) |
| Bernard verdict | `tasks.result.verdict` for BERNARD-operator tasks (proceed / abstain / pause / prepare-for-review) | jsonb, no column |

**The growth_action "object" is a Postgres VIEW** joining tasks to its action_log rows and surfacing the fields above — created in the substrate, read through the existing read-only role. The console renders it; it cannot write it.

**Minimal additive column list (the entire migration surface of this note):**
1. `action_log.is_client_visible boolean NOT NULL DEFAULT false` — the client-pane filter (brief Phase 1 item 4). Conservative default: nothing leaks unless explicitly marked.
2. *(nothing else)* — evidence fields live in `tasks.plan`/`result` jsonb; approval actors likewise; verdicts likewise. If Phase 2 finds a field that can't live in jsonb (e.g. an indexed SLA timestamp), it comes back as its own one-line addendum.

## 6. Bernard cockpit pane (b) — convergence, not a second surface

The live /bernard pane already implements the approval UX this note needs (pending fixes → approve/reject with actor). Phase 2 does not build a *new* approvals surface; it **generalises the Bernard pane's card into the growth_action card** (reason, evidence, expected impact, risk, approval state, execution state, rollback availability, observed result — brief Phase 1 item 3). Bernard's fixes become one `operator_id` filter of the same list. His chat, stand-down, and audit chips stay as they are. Consequence: one approvals muscle for the founder, whether the proposer is Bernard, the OCT pipeline, or a future operator.

## 7. Growth Assistant guard (d)

The client-portal chat ("ask about your own growth data") ships only with all of the following, mapped to existing primitives:
- **Tenant boundary:** every query goes through the read-only role with `client_id` bound from the Auth0 tenant claim (the substrate's existing `SET app.client_id` row-scoping pattern) — the assistant is architecturally unable to read another tenant.
- **Read-only twice over:** no write keys in portal deployments (§1) *and* a DB role without write grants.
- **Disclosure on:** the runtime's existing AI-disclosure config, non-optional for this surface.
- **KB-and-data-bounded with confidence discipline:** answers cite the tenant's own figures or its KB; no invented numbers (the Rexos-analyst "never invent, fetch" prompt discipline, plus the runtime safety floor as already shipped — floor mapping identical to web-chat).
- **No actions:** it can *describe* a pending approval; it cannot decide one. Approvals are cockpit-only (§6).

## 8. Sequencing after sign-off

1. Migration: `is_client_visible` column + the `growth_action` VIEW (additive, one file).
2. Phase 1 exposure items (dashboard composition, autonomy indicator READ-ONLY, evidence cards, filtered client action log, O10 badges) — all reads.
3. Preview-login wiring (Auth0 wildcard callbacks for Vercel previews) so every later step is founder-eyeballable pre-merge.
4. Step 5 write path goes live behind §3/§4 (env vars onto Vercel is the switch; tier X keys verified rejected in the webhook first).
5. Phase 2 UI (Growth Operations Center) per §5/§6.

**Explicitly out of scope, unchanged:** leakage scoring, assessment automation, autonomy behaviour changes, growth_action tables (there are none — it's a view), Phases 3–4.

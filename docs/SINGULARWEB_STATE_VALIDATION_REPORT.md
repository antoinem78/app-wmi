# Validation report on SINGULARWEB_PROJECT_STATE.md, for the strategy surface

**From the Rexos platform session (Code), 2026-09-03.** You asked for four things: falsify §5, §7 and §8 with evidence; fill the UNVERIFIED items; name what a fresh Code session needs from the strategic side that the file lacked; judge the §11 maintenance protocol. All four are done and the corrected file is in the repo at `docs/SINGULARWEB_PROJECT_STATE.md`, commit `199f381` and later. This report is the feedback in one place. Evidence for every line below is in the file's §12.

## Headline

The file is good and worth keeping. Its structure (rulings ledger, entity map, client book, product lines, agents, open items by owner) is the right shape and nothing in Code carried it before. Eleven claims were wrong, all of them the kind that a strategy surface cannot check from where it sits: things that had happened in the substrate or the portal since your last sync. One structural weakness (three hand-synced copies) will undo the work if it stays.

## What was false, and what is true

| Claim | Truth |
|---|---|
| wmiltd funnel unrehearsed | Ran end to end 2026-08-06 with a £1 live Stripe checkout on test client WE BET, since deleted by the founder. |
| Conversational runtime "ingest disabled" | MAINT_kb_ingest is active and healthy. It was a Drive quota bug, fixed 2026-08-08; it ingested VIP's knowledge base 2026-08-15. PARKED describes intent; all six runtime workflows are live in n8n. |
| Kyle and VIP Accounting as two clients | One client. Kyle Randall is VIP Accounting. It is a joint Baptiste-and-Anthony project under PPC Mastery, which is why agency "we" is correct in its copy, the one exception to the first-person-singular rule. |
| KST snapshot not captured | Captured; the founder ruled it done 2026-08-15 and VIP was cloned from it. |
| Buggy Trip pitch held until demo live | Demo videos shot 2026-08-11; French proposal handed to Baptiste; the gate is Baptiste confirming auto-tagging, still unconfirmed. |
| Economics instrumentation owed | Done 2026-08-18: `ECONOMICS_LEDGER.md`, `agent_usage` metering on every agent run, Norbert reviews metered in the substrate. |
| Code's 5 August risk brief open | All five items closed between 2026-08-12 and 2026-08-18. |
| Denis adoptions queued | Items 1 to 4 live in both agents' prompts and tooling; only 5a (dupe-exclusion audience) is not built. |
| Substrate session on the Mac mini, portal session on Windows | One Mac mini session ships both; the Windows machine holds the long Shallowford sessions. |
| Gopoxy absent from the client book | Freelancer-managed since 2026-08-13, founder-invoked exceptions since 2026-08-17, first optimise account 2026-08-18. Added. |
| HubSpot client unnamed | Fly-Rides (Scott Good), Austin party bus hire, no retainer, two open founder offers. Added with its shape for §6.6: keep HubSpot and integrate, by the client's own choice. |

One claim (R-g tier copy never uploaded to Drive) is not checkable from Code: the Drive document was modified 2026-07-06 and the knowledge base matches it; whether that version carries the amendment is a founder question.

## What I could not verify, and left as yours

Entity ownership shares in §2, and every commercial figure: Steffen at $1,000 a month via Upwork, Super Henry at £650 a month proposed, KST's Growth tier, FiltersFast at $6,500 a month with a pagination requirement, and the whole Denis and Joey consulting line. None of these numbers exists in any Code file. The channel files describe the work, not the money. They are marked Chat-verified only in §12 and should be checked at source before a decision rests on them.

## §8 filled

Bernard and Oscar run `claude-sonnet-5`; Norbert runs `claude-fable-5`, a different model family by design. Norbert has three surfaces (substrate review leg, portal page and chat, Slack route), founder-gated briefing tools with a code header voiding approval language, and no approval authority anywhere. BERNARD_optimise has been live since 2026-08-18 with exclusions since 2026-08-26: 4 executed, 3 rejected, 4 of 50 toward graduation. Caching is 15 sites at a one-hour TTL. Metering is 50 runs so far across three agents.

Two things landed today that you do not have yet. Oscar's proposals now pass through Norbert in code before the founder sees them, same two questions, same one revision round; the first three live reviews ran on Fly-Rides negatives this morning. And a glue-level smoke harness replaying real executions found that the optimise verifier had never recorded a real write unaided: Meta appends a default field on write that failed the diff, and a Date-in-SQL bug would have failed the recording step. Both fixed and redeployed. The graduation count of 4 rests on hand-reconciled moves.

## What the file lacked that Code enforces every session

Nine items, now written into §4 and §5: the 2026-08-18 operating model (contractors stay; agents build and optimise only in founder-triggered sessions; Norbert supervises); the seven optimise rulings and the 50-move zero-reversal bar per agent; the channel-file convention and memory living in the repo; VIP's "we" exception and CallTrackingMetrics doing its call tracking; DentalMastery's Meta inside the WMI UK account, plus the slug trap; the portal's read-only substrate role; the `WMI |` naming rule; the two unruled process questions; and names-only credential handling.

## On the §11 protocol

Right in shape, wrong in one mechanism. Surgical edits plus a changelog line is exactly how the operational files are maintained, and it transfers. Three copies kept identical by founder uploads will not survive the first busy Friday. What I have done about it, with the founder's agreement today:

- The repo copy is the master. Every Code session now reads its §0 and §4 at start and updates it in the same commit as the change it records (rulings, client-book changes, product-line status, agent capability, closed open items). This is written into `AGENTS.md`, which every session loads.
- The panel copy is an export the founder refreshes from the repo. Nobody edits it directly.
- The sync horizon carries a git commit hash, so "what changed since" is a `git log`, not a memory exercise.
- The Friday sweep becomes a diff review of panel against repo, not an authoring session.

What I would ask of you: when you draft a change to the strategic state, write it as a proposed edit to a named section plus a §0 line, and hand it to the founder for the repo, rather than editing your copy. And keep doing what §8 did: mark what you have not seen as UNVERIFIED with a date. Those markers are what made this pass fast and honest.

## Where things live from here

- `docs/SINGULARWEB_PROJECT_STATE.md`: the strategic state, master copy, §12 holds the evidence for this pass.
- `docs/PROJECT_STATE.md`: operational state, shared infrastructure, cross-session convention.
- `docs/clients/<slug>.md`: one file per client, owned by that client's session.
- `docs/memory/`: lessons that generalise, loaded automatically by every session.

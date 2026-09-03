# n8n and Supabase audit, 2026-09-03

Platform session, on the founder's instruction to review every workflow, credential and database and correct what is wrong. Everything below was read from the live systems that day: 55 workflows, 42 credentials, 1,905 executions over 30 days, the substrate and FZCO databases over a direct connection, the wmiltd portal over REST.

## Fixed today, verified live

| Fix | Evidence |
|---|---|
| 15 active workflows had no error handler, including the daily backup, both optimise workflows and BERNARD_build. The backup failed silently for 12 days in August because of this. All now route errors to MAINT_error_alert. | Re-read after PUT: `errorWorkflow = neKxYlJYR6c6HC2e` on every one. |
| Four internal webhooks accepted unauthenticated calls: the agent core (`agent-core-v1`), the post-pass that writes CRM and Slack (`agent-postpass-v1`), knowledge QA and the task router. Anyone guessing the path could drive Claude spend or inject CRM writes. All four now require the `x-rag-key` header credential; the five internal callers send it. | Unauthenticated POST to each returns 403. A live chat probe through AGENT_webchat completed end to end with the header. |
| Agent core crashed on a null tenant id (11 errors in 30 days, every one a widget without a valid token). Load config now falls back to a nil uuid and returns no rows; the webchat wrapper degrades to the "not available" line instead of erroring. | Live probe without a token: HTTP 200 with the unavailable message, both executions success. |
| MAINT_conversations_doc and MAINT_kb_ingest both fired at :00 every two hours and fought over the Drive per-minute quota (25 quota errors). The document refresh now runs at :20. | Trigger re-read: `triggerAtMinute: 20`. |
| Two temporary probe workflows (Resend domain probe, Drive probe) were still active with open webhooks. Deactivated. | `active: false` on both. |
| Duplicate migration file `0004_shared_agent_memory 2.sql` (a macOS copy artefact) removed from the repo. | git. |

## Backups

Daily Backup to GitHub v2 runs at 20:00 UTC every day and has succeeded every day since 16 August (18 consecutive), committing all 55 workflows to `antoinem78/n8n-backups` under `workflows/<date>/`. The last commit is from 2026-09-02. It failed every day from 4 to 15 August with a GitHub "invalid request" error and nobody was told, because it had no error handler; that is fixed above. Two gaps remain: credentials are not backed up (the public API cannot export their values, only their names and types), and the trigger node is labelled "Daily 02:00" while it runs at 20:00 UTC. The label is cosmetic.

## Left for the founder, in priority order

1. **Meta token travels in the URL.** 21 Graph nodes across 8 workflows use query-string auth. Graph echoes the token back in `paging.next`, so it sits in plaintext in every stored execution that read a paginated endpoint. Fix in two steps: create a Header Auth credential in n8n (name `Authorization`, value `Bearer <the Meta system-user token>`), then run `python3 scripts/n8n-swap-meta-auth.py <credential id> --apply`, which moves all 21 nodes and confirms each. Then prune old executions of BERNARD_optimise and BERNARD_monitor.
2. **A GHL private integration token is hardcoded in RCV_form_routing** (two HTTP nodes, `Bearer pit-9…aab3`). The workflow has not fired in 30 days and RCV_form_routing_DEV runs instead. Tell me which location it serves (KST, WMI, VIP) and I swap the literal for that location's header credential, or confirm the workflow is dead and I deactivate it.
3. **Open Dental sync for Shallowford has failed every night since 5 August**: the office's eConnector is not running (Open Dental's own message). Nothing on our side fixes that; the practice has to restart the eConnector service. Appointments stop syncing until they do. Belongs to the Shallowford channel.
4. **GHL webhooks are unauthenticated and some paths are guessable** (`kst-stage-changed`, `vip-stage-changed`, `dm-form-submitted`, `dm-appt-booked`, `dentalmastery-form`). GHL can send a custom header from its Webhook action. Adding one per location is a GHL UI change on your side; I then switch the n8n side to header auth in one PUT each.
5. **SLACK_sw_command does not verify Slack's signature.** Needs the app's signing secret placed in an n8n credential; then a verification step. Idle for 30 days, so low urgency.
6. **Barsoum Dental GHL agent** is active, has never run in 30 days, references a node that no longer exists (it would error if triggered) and shares a webhook path with an archived workflow. Looks like Shallowford's pre-runtime agent. Confirm and I archive it.
7. **Eight credentials are referenced by no workflow**: Anthropic account 2 and 3, Bearer Auth account, GHL PMS, Header Auth account, HighLevel account 2, JWT Auth account, OpenAi account. Deletion is irreversible so I have not touched them; say the word.
8. **Supabase FZCO portal grants**: RLS is enabled on all 13 tables with zero policies, which is correct for a service-key-only app, but the `anon` and `authenticated` roles still hold full table grants (Supabase defaults). Harmless while RLS stays on; revoking them is defence in depth. Same posture presumably on wmiltd, which I cannot inspect over REST.

## Verified sound, no action

- Substrate: RLS on all 18 tables, no anon or authenticated grants at all, no invalid indexes or constraints. Migration files 0002 and 0003 describe portal tables and are labelled as such in the README.
- FZCO and wmiltd portals: identical schemas, table for table and column for column, and both match the migration files exactly through 0026.
- Every credential referenced by a workflow exists. No workflow references a missing node except the Barsoum one above. No Code node has a syntax error (the linter's five "await" hits are false positives; n8n Code nodes run async).
- MAINT_kb_ingest: 49 errors in the window, all between 6 and 11 August, none since the quota fix.
- Meta writes exist in six nodes, all inside the governed paths (BERNARD_build, BERNARD_fix, optimise execute, and the two conversions uploads).

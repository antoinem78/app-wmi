# Economics ledger v1: what the operation actually costs

**Risk brief 2026-08-05, item 1.4.** Started 2026-08-18. The brief's instruction was "stand up the minimum honest version, it does not need to be elegant, it needs to exist", and "if any of it is genuinely unreadable, say which and why".

**The headline is a measurement finding, not a cost finding.** Most of the cost base is not instrumented, and the largest and fastest-growing line is the one recording nothing at all.

---

## 1. What is measured, and it is the cheap part

**Telephony, read live from Twilio.**

| Line | Amount |
|---|---|
| All-time usage, every priced category | **£0.17** |
| Number rental, 4 numbers | **~£4.63 / month** |

All-time usage is seventeen pence. Two UK local numbers at £0.87, one UK mobile at £1.89, one legacy US number at about £1.00. **Telephony is a rounding error and can stop being discussed as a cost.** The only thing worth doing is releasing the unused US number, which is £12 a year for nothing.

Worth noting against the earlier bridge-call analysis: the per-call prices seen on individual call records did not appear in the usage rollup, so treat £0.17 as the floor rather than a settled total. It does not change the conclusion.

**Model spend, read from `action_log`, and this is where it falls apart.**

| Model | Calls | Cost | Tokens in / out |
|---|---|---|---|
| claude-sonnet-4-5 | 244 | $2.80 | 723,485 / 42,144 |
| claude-haiku-4-5 | 158 | $0.37 | 295,367 / 14,037 |
| **Total recorded** | **402** | **$3.17** | |

## 2. The finding that matters

**`action_log` holds 5,718 rows. Only 561 carry a token count and only 402 name a model.**

Every one of those comes from a single workflow, `OP_knowledge_qa`. Here is the same table by workflow:

| Workflow | Rows | Recorded cost |
|---|---|---|
| CAP_offline_conversions_push | 2,007 | **$0** |
| CAP_opendental_sync | 1,576 | **$0** |
| OP_knowledge_qa | 561 | $3.17 |
| CAP_rag_retrieve | 526 | **$0** |
| AGENT_postpass | 184 | **$0** |
| OP_conv_agent_runtime | 173 | **$0** |
| ROUTER_main | 159 | **$0** |
| SLACK_sw_command | 132 | **$0** |

**Bernard and Oscar record nothing.** The two always-on agents the brief specifically names, running on the most expensive models in the range, with a thirty-one-memory prompt injected every turn, have no cost line anywhere. Neither does the conversational runtime, the router, or the Slack command surface.

The recorded $3.17 is Sonnet and Haiku. **It is not the agents at all**, so it is not a partial view of the spend, it is a different thing entirely.

`agent_conversations` in the portal database, where Bernard and Oscar's turns actually persist, has columns `id, scope, client_id, role, content, actor, created_at`. **No token count, no model, no cost.** The data was never captured, so it cannot be backfilled.

## 3. What cannot be read from here, and why

| Line | Why not |
|---|---|
| Vercel, 2 Pro projects | No API token on this machine. Pro is per-seat; the figure is in the billing page |
| Supabase, 3 databases | No management token. Plan tier per project is in the dashboard |
| n8n Cloud | No billing API surface in use |
| Resend, 2 accounts | Separate accounts per entity; no key with billing scope |
| Stripe fees | Readable in principle, but fees are a cost of revenue rather than run rate |
| **Claude Code sessions** | **Not readable by any mechanism.** This is the one the brief flags and it is real: the sessions doing the building are a genuine cost with no meter |

These are all **fixed subscriptions**, which is the saving grace: they are knowable in ten minutes from four dashboards and they do not move week to week. Someone reads them once and the number holds until a plan changes.

## 4. Against revenue

New monthly revenue on the FZCO side is AED 1,800, roughly £385. Measured recurring cost against it is £4.63 of telephony.

**That comparison is meaningless until the model spend exists**, and stating it without saying so would be exactly the flattery the brief was written to prevent.

## 5. The fix, and it is small

**Populate `cost_usd`, `tokens_in`, `tokens_out` and `model` on the Bernard and Oscar paths**, the same four columns `OP_knowledge_qa` already fills. The schema is there; the agent workflows just do not write to it. That is the entire gap between "unmeasurable" and "measured", and every day it waits is a day of spend that cannot be recovered, exactly like the decision-time snapshots.

Second, smaller: add the same four columns to `agent_conversations`, or have the agent paths write their turn cost into `action_log` instead. One place is better than two.

**Cadence once it exists:** monthly, one query, appended to this file. Per-client cost falls out of it because `action_log` already carries `client_id`.

## 6. What I recommend, in order

1. **Wire the four columns on Bernard and Oscar.** Half a day, and it is the only thing here that cannot be retrofitted.
2. **Read the four dashboards once** and write the fixed monthly figure into this file. Ten minutes, and it stops being a question.
3. **Release the unused US Twilio number.** £12 a year for nothing.
4. Revisit the revenue comparison when 1 and 2 are done, and not before.

# PPC Mastery portal: upgrade brief

**From:** the Claude Code session running `app-wmi` (WMI Ltd and WMI FZCO portals)
**To:** the Claude Code session running the PPC Mastery portal
**Date:** 2026-08-06
**Read first:** `docs/PROJECT_STATE.md` in the app-wmi repo. It is the operational source of truth and it is current to today.

## The relationship between the two repos

This codebase and yours are siblings: the app-wmi repo still carries PPC Mastery's fingerprints (the Auth0 roles claim defaults to `https://ppcmastery.app/roles`, and `src/lib/config.ts` documents the multi-entity model as "BJ PPC USD, WMI GBP"). The June status report has PPC Mastery as the primary deployment with WMI as the clone. Since then the WMI side took 223 commits, 81 in the last nine days, and yours did not receive them.

**First thing to determine, because it decides everything else:** do the two repos share git history? Run in your repo:

```
git remote add wmi git@github.com:antoinem78/app-wmi.git
git fetch wmi
git merge-base HEAD wmi/main
```

- **A commit hash comes back**: you share ancestry. Prefer merging or cherry-picking the commits listed below over hand-porting. You will still have to resolve entity-specific files, chiefly `src/lib/config.ts` and anything carrying WMI branding.
- **"no merge base"**: the repos are unrelated trees. Port by file, in the order below, and treat this document as the spec.

**Do not blind-merge `main` into your repo.** Some of what follows is entity-specific and some of it is deliberately absent from your deployment. Read the ordering section before you start.

---

## Part 1: things that are pure product improvement, port them all

These are provider- and entity-neutral. Every one exists because a human walked the funnel and something went wrong.

| What | Commits | Why it exists |
|---|---|---|
| **Transactional email layer** (`src/lib/email.ts`) | `a39d874`, `13ea3fc`, `a88868a` | The portal had NO email at all. Nothing on client creation, nothing after signature. Resend, env-gated (`RESEND_API_KEY` + `EMAIL_FROM`); unset means silent no-op, so porting it changes nothing until you configure it. |
| **Signed-copy delivery at the state chokepoint** | `a88868a` | Read this one carefully. FOUR paths can mark a contract signed (both webhooks plus two `contract-return` status polls in the wizard). Wiring delivery into a webhook means the copy depends on which path wins a race. On the first real run, a poll won and the client got nothing. Delivery now lives inside `markContractSigned`, which transitions exactly once. |
| **Provider execution on the agreement** | `a39d874`, `6e73314`, `860ca15` | Click-wrap is binding without a countersignature, but a one-signature document reads lopsided and leaves the founder with no counter-signed record. Also: never email a PandaDoc *signing session* to the provider; those are single-use, one-hour, and scoped to the client's recipient identity. Use the document view URL instead. |
| **VAT shown before the card** | `f7a9b43` | We quote net, Stripe adds tax at the last moment, so the client's bank asks them to approve a bigger number than they agreed. The quote now breaks out service, VAT and gross, worded as an estimate because Stripe decides real liability from the billing address. |
| **Wizard auto-advance after signature** | `5e49c56` | The signature moves server state but nothing told the browser, so clients sat on a dead page until they reloaded. The contract step now polls its own step every 4s. |
| **Channel-aware plan names** | `97692db` | A Meta-only client was 20 minutes from signing a "Managed Paid Search Services Agreement". Plan name and agreement title now derive from the platforms chosen at client creation. |
| **Per-client currency** | `730d20e` + migration `0023` | `clients.currency`, with `ENTITY_CURRENCIES` driving a selector. Currency is locked per client at creation on purpose: the contract amount and the charged amount must never disagree. |
| **Config health + email delivery test** | `482e09c`, `ae74cc9`, `53280ab`, `d9bcb70` | `/api/diag/env` returns which variables a deployment has as booleans (never values), plus Stripe key mode and From domain; `/api/diag/email` sends one real message to `CONTRACT_COPY_TO` and reports the provider's verdict. Port these early: they turn "is this configured" from an archaeology exercise into one request, and they caught a variable that existed in the dashboard with an empty value. |
| **Chat transcript race fixes** | `d3a38f8`, plus the earlier three-race fix | Agent replies were vanishing from the chat when a second message was sent. Three separate races: a slow hydration GET clobbering a live conversation, `send()` reading a stale closure, and the `reset` event blanking whatever bubble was last instead of its own. Note the sharp edge in `d3a38f8`: `reset` deletes the reply from the persisted transcript too, so it must only fire for genuine preamble. |
| **Em dash scrubber** | `src/lib/emdash.ts` | The founder's no-em-dash rule enforced in code on both agents' output streams, because a prompt instruction does not survive long analytical replies. Stateful, so dashes split across stream chunks still collapse. |

## Part 1b: the named agents, which is the largest gap and was missing from my first draft

If PPC Mastery's portal predates July, it has no Bernard and no Oscar as they exist now, and this dwarfs everything in Part 1. What accumulated, roughly in build order:

| Capability | Commits | What it gives the operator |
|---|---|---|
| **Oscar, the Google Ads analyst, MCC-wide** | `a568e9d`, `d0f7712`, `edcbfec`, `9d0452d` | Reads any account under the MCC, resolves accounts by name or customer id, per-account chat threads with a focus account, real search-term data, Shopping and feed audits. |
| **Executable proposals with an approval gate** | `0b36231`, `444884b`, `9460b1c` | Oscar files figure-backed optimisation cards (negatives, budgets, pauses, RSA work); the founder approves; execution runs behind guardrails with a write audit trail. One operation per proposal, deliberately. |
| **Bernard, the Meta Lab supervisor** | `5ad4f75`, `c8c9bc4`, `6c70232` | Live Meta account roster, chat-triggered read-only audits with a downloadable Word document, and file attachments (PDF, Word, Markdown) so a brief can be dropped into the conversation. |
| **Permanent agent memory** | `97dd306`, `c55f373`, `89208d6` | Cross-session memory per agent, surviving a cleared chat by design, with a shared pool for client-level facts and founder rulings. This is what stops an agent sounding clueless on Monday about Friday's decision. |
| **Chat-native execution** | `89208d6`, `857803b` | Both agents act from chat on the founder's explicit word, behind unchanged machine gates. Oscar builds entire Google Search campaigns (`GOOGLE_build`): atomic single mutate, campaign always created PAUSED, kill switch, customer allowlist, budget caps, RSA limits, verified by re-read, every attempt in `write_audit`. Bernard dispatches Meta builds to a governed executor with the same discipline. |
| **Bernard's read tools, added this week** | `f7b16f0`, `f27cad9`, `6a8112b`, `4d87cf3`, `126652b` | Eyes on ad copy (every headline and description variant, plus deterministic flags for em dashes and discount claims), custom audiences and whether they can actually serve, one ad set's full live config, creative performance ranked by spend, and pixel stats. Plus `dispatch_copy_fix` so a copy change stops travelling as five kilobytes of JSON. The copy tool exists because performance figures never show you what an ad actually says, and a "winner" can carry a claim the client has retired. |
| **Voice rules enforced in code** | `3bdb2dd`, `548eb20`, `b04789a` | No em dashes anywhere (a prompt instruction does not survive long analytical replies, so it is a stream scrubber), and client-facing writing in the founder's first person singular, never the agency "we". |

**Porting notes specific to the agents.** They need `ANTHROPIC_API_KEY` and the `agent_memory` table (migration `0022`). Oscar needs the Google Ads credentials the portal already has; Bernard needs a Meta token and, for dispatch, the substrate lab wiring, which is a separate n8n estate and may not be worth standing up for PPC Mastery at all. Without those he degrades honestly: he says plainly what he cannot see rather than improvising, which is by design and worth preserving when you port the personas. **Do not copy `BERNARD_WEBHOOK_KEY` between entities**: it points at one lab and would show one entity's client book to another entity's agent.

**The seed-the-memory step is easy to miss.** An agent with an empty memory is slower and vaguer for weeks. When PPC Mastery's agents come up, write their first memories deliberately: which deployment they are on, what they can and cannot see, the client book, and the founder's standing rulings.

## Part 2: things to port only if they apply to your deployment

- **Shared agent memory** (`MEMORY_SUPABASE_URL` / `MEMORY_SUPABASE_SECRET_KEY`, migration `0022`): makes Bernard and Oscar one mind across deployments. Only meaningful if PPC Mastery's agents should share knowledge with WMI's. That is a founder decision with a commercial dimension (client facts of one legal entity sitting in another's database). Default: leave unset, and the deployment uses its own `agent_memory` table.
- **Agent relays** (`scripts/agent-relay.mjs`, relay keys on the chat routes): lets a Code session talk to the deployed agents. Useful, independent of everything else.
- **The proposal engine path** (`CONTRACT_PROVIDER=proposal-engine`): only if PPC Mastery wants to drop PandaDoc. If it stays on PandaDoc, port `6e73314` (execution tokens) and add the block to your own template.
- **WhatsApp attribution bridge** (`public/wa-widget.js`, substrate `0005`, two n8n receivers): a separate product line, not portal plumbing. Port only if PPC Mastery will sell it. **CORRECTED 2026-08-06 after a production test: the invisible zero-width ref does NOT survive WhatsApp, which strips it. What carries attribution is the server-side click park plus a single-candidate 30-minute window. See `docs/WA_BRIDGE_CORRECTION.md` before describing this to anyone.**

## Part 3: migrations

Check which of these your database has, in numeric order, and apply the gaps: `0015` optimization_proposals, `0016` proposal_execution, `0017` report_prompt, `0018` agent_conversations, `0019` share_dashboard, `0020` write_audit, `0021` platform_client, `0022` agent_memory, `0023` client_currency.

**Two warnings, both learned the hard way.** There are now three separate databases in this estate and a migration meant for one was pointed at another on 30 July. Read `docs/substrate-migrations/README.md` before running anything, and confirm which database your connection string resolves to before the first statement. Separately, `0022` exists because `agent_memory` was originally created by hand on one database only, so clones built from the migration series had agents with amnesia; if your deployment has agents, it needs that table.

## Part 4: the environment variables that are new

`RESEND_API_KEY`, `EMAIL_FROM`, `CONTRACT_COPY_TO`, `ENTITY_CURRENCIES`, `AGREEMENT_SIGNATORY_NAME`, `AGREEMENT_SIGNATORY_TITLE`, `MEMORY_SUPABASE_URL`, `MEMORY_SUPABASE_SECRET_KEY`. All are documented in `.env.example` on our side, all are optional, and every feature they gate is a silent no-op when they are unset. **Vercel bakes values at build time**, so a variable added after the last deploy is invisible until the next one, and `/api/diag/env` is how you prove what the running deployment actually sees.

## Part 5: what we learned that is not in any commit

Port the code however you like, but these cost us real hours:

1. **A funnel that has never been walked end to end by a human is not working, it is untested.** The WMI portal had a complete, plausible, deployed funnel that had never once run. Walking it found five defects in two days: no contract email, wrong governing law, a currency default leaking the wrong symbol, a page stranded after signing, and a one-sided agreement. Budget twenty minutes and a real card at the smallest amount your entity allows.
2. **Stripe webhook endpoints are per-mode.** A live secret key with a test-mode endpoint means the client pays and never activates, and nothing looks broken until they ask why nothing happened. Confirm in Live mode that the endpoint exists and that its signing secret is the one in your env.
3. **Presence of a variable proves nothing.** We found `RESEND_API_KEY` present in the dashboard, correctly named, and empty at runtime. Test the function, not the configuration.
4. **Claimed is not true until read back.** Our Meta executor reported four consecutive failures while actually creating four campaigns. It was an independent read of the account, not the executor's own report, that caught it. Apply the same suspicion to any report a tool gives you about its own work.
5. **Never assert absence from a single reading.** Twice this week a claim of "there is no X" came from one field read and was wrong, once in a client document and once in a status report to the strategy surface. Check the surface a real user sees before saying something is not there.

## Suggested order

1. `/api/diag/env` and `/api/diag/email`, so everything after this is verifiable.
2. Migrations, in numeric order, against a database you have positively identified.
3. The email layer plus signed-copy-at-the-chokepoint, which is the largest client-visible gain.
4. Agreement execution block and VAT transparency.
5. Wizard auto-advance, channel-aware plan names, chat race fixes, em dash scrubber.
6. Per-client currency, only if PPC Mastery quotes in more than one.
7. **The rehearsal, which is not optional.** Small live payment, full walk, then refund and delete.

Anything in this brief that contradicts `docs/PROJECT_STATE.md` means the brief is stale and the project state is right.

# Handover — Port Rexos (Command Center + Agents + Audit) to app.ppcmastery.ai & app.adenergy.online

**Audience:** Claude Code in the **PPC Mastery** (app.ppcmastery.ai) and **AdEnergy / BJ Command Center** (app.adenergy.online) repos.
**Source of truth:** the `app-wmi` repo (app.wmiltd.com). Everything below was built and verified live there. Commit trail (newest first): `1216807, d4990f8, 5cc256e, 0017927, 6b9a7c2, a1e481a, 48522f2, 2663fe4, 11fa64f, 557ca09, 92a1fed, a25aa36, d528ede` and the earlier reporting/billing evolution.
**Goal:** give both apps the full Rexos layer — agency Command Center, the read-only AI chat, the propose→approve queue, the controlled-mutate (P5-Lite) spike, and the Google Ads audit-doc generator.

> Read `AGENTS.md` first — this is the non-standard Next.js (middleware is `proxy`; route `context.params` is a Promise; read `node_modules/next/dist/docs/`). Companion docs: `HANDOVER_REPORTING_BILLING_PORT.md` (the reporting data layer + billing) and `HANDOVER_BJ_FULL_PARITY.md` (the full portal). Rexos sits ON TOP of the reporting data layer.

---

## 0. Framing & prerequisites
Both targets are single-agency deployments (one agency, many client accounts) of the same lineage — **not** a multi-agency SaaS. Each runs as its OWN entity with its OWN credentials (Auth0, Google MCC, Supabase, Slack, Anthropic, Stripe). Same credential-isolation discipline as the WMI harvest: **never point an integration at another entity's account.**

**Prerequisite — the reporting data layer must exist first.** Rexos depends on `src/lib/integrations/google-ads/reporting.ts` providing: `gaqlSearch`, `getDashboard`, `getAccountSummary`, Mon–Sun `windows()`, `impressionShare` suite, `byConversionAction`, `campaignPerformance`, `monthPerformance`, `topAds`. If a target lacks these, port `HANDOVER_REPORTING_BILLING_PORT.md` first (Step 0 gap analysis), then this.

---

## 1. Rexos subsystems (today's build)

### A. Command Center — agency overview + live alerts  (commit 92a1fed)
- **`src/lib/command-center.ts`** — `getCommandCenter(7)` pulls every approved account's `getAccountSummary` (bounded concurrency 5), runs `evaluateAlerts` (spend≥50 with 0 conv = critical; conversions ≤-25% critical / ≤-10% warning; spend ≥+40% warning), rolls up totals **per currency** (never sum across currencies), sorts Action-first.
- **`src/app/(admin)/dashboard/page.tsx`** — replaces the placeholder dashboard: per-currency KPI cards, open-alerts-by-severity, all-accounts table with Healthy/Action pills (rows link to the client dashboard), Alerts & Monitoring panel.
- Adapt: nothing entity-specific beyond `entityConfig.brandName`. Alert thresholds (`MEANINGFUL_SPEND`, the %s) are tunable constants.

### B. AI Chat — read-only agent  (commits 557ca09, 2663fe4)
- **`src/lib/integrations/anthropic/agent.ts`** — `runAgentChat` + `runAgentChatStream` (tool-use loop, Claude `claude-opus-4-8`) with 4 READ-ONLY tools: `list_accounts`, `get_account_report`, `get_all_account_summaries`, `get_recent_changes`, plus `propose_optimization` (§C). System prompt: real figures only, correct channel attribution, propose-but-never-execute. Streaming emits `status`/`delta`/`reset`/`done` events (`reset` drops tool-turn preamble).
- **`src/app/api/agent/chat/route.ts`** — admin-gated (auth0 session + `isAgencyAdmin`), streams NDJSON.
- **`src/components/CommandChat.tsx`** — sticky right-rail chat panel on the Command Center; suggestion chips; consumes the stream.
- Adapt: `entityConfig.brandName` in the system prompt; nothing else.

### C. Proposals — structured approval queue  (commits 11fa64f, 6b9a7c2)
- **Migration `0015_optimization_proposals.sql`** — `optimization_proposals` table (client_id, type, title, rationale, details jsonb, status pending|approved|dismissed|applied|failed|rolled_back, created_by, decided_*). Run in that app's Supabase (both envs).
- **`src/lib/proposals.ts`** — `createProposal` / `listProposals` / `pendingProposalCount` / `decideProposal` (logs every create + decision to activity_log).
- **Agent tool `propose_optimization`** (in agent.ts) — files a structured proposal; for the 3 executable actions it MUST include a precise `details.action` (one op per proposal), else it's advisory-only.
- **`src/app/(admin)/proposals/page.tsx` + `actions.ts`** — approve/dismiss cards; nav badge with `pendingProposalCount` in `(admin)/layout.tsx`.

### D. P5-Lite — controlled mutate spike  (commits 48522f2, a1e481a)  ⚠️ HANDLE WITH CARE
A proof-of-capability write layer behind the approval gate. **Three actions only** (add negative keyword, pause/re-enable campaign, set daily budget), **one op per approval, no batch, no autonomous writes.** Ships **INERT** (kill switch off, allowlists empty).
- **Migration `0016_proposal_execution.sql`** — adds `applied_*`, `rolled_back_*`, `execution jsonb` to optimization_proposals.
- **`src/lib/integrations/google-ads/index.ts`** — `googleAdsMutate(customerId, ops, {validateOnly})` (unified `GoogleAdsService.Mutate`). The ONLY write path.
- **`src/lib/integrations/google-ads/write.ts`** — guardrails: `writeEnabled()` (kill switch, case-insensitive `=== "true"`), `allowedCustomers()`, `allowedCampaigns()` (required for pause/budget), `budgetCaps()` (hard daily ceiling + max-increase % + large-decrease confirm), `parseAction(details)`, single-op builders.
- **`src/lib/proposals-execute.ts`** — the WORKER (the control boundary, NOT the UI): re-checks the approval record → resolve names→IDs → `validate_only` → mutate → re-query to VERIFY → immutable audit (activity_log + execution before/after) → Slack alert → rollback. `dryRunProposal` / `applyProposal` / `rollbackProposal`.
- **Proposals page** — write-mode banner + Dry-run / Apply / Rollback on approved executable proposals.
- **Env (per deployment, set in Vercel for that app):** `GOOGLE_ADS_WRITE_ENABLED=true`, `GOOGLE_ADS_WRITE_CUSTOMERS=<test account id>`, `GOOGLE_ADS_WRITE_CAMPAIGNS=<ids>`, `GOOGLE_ADS_BUDGET_MAX_DAILY=<cap>`. **Keep it to a TEST account until that agency has Google Standard Access and decides to widen.** Vercel binds env at deploy → redeploy after setting.
- **Go-live sequence (each app, do NOT change real accounts first):** confirm dev token can mutate + OAuth edit access → allowlist ONE demo/test account → `validate_only` first → one low-risk mutate → verify → rollback → confirm the audit log. (We proved this on app-wmi against a paused POC test account.)

### E. Audit-doc generator  (commits 0017927, 5cc256e, d4990f8)
- **`src/lib/audit/extract.ts`** — findings artifact from the Google Ads API (12-mo, read-only): account totals + monthly trend, campaigns, network split, conversion actions, search terms + junk heuristics, impression share, assets. Resilient per-section.
- **`src/lib/audit/docx.ts`** — branded `docx-js` helpers (cover, TOC, part dividers, exhibits, status colours). **BRANDING LIVES HERE — see §2.**
- **`src/lib/audit/generate.ts`** — `detectAccountType` (ecommerce vs lead-gen) → `diagnose` → Claude writes the prose (artifact-values-only, British, no em dashes) → assemble. **Account-type aware:** ecommerce → revenue/ROAS/AOV/value-based-bidding (NO OCT/MQL/pipeline); lead-gen → OCT/pipeline + demos forecast. Full Premier-Partner appendix (parameterised).
- **`src/app/api/audit/[clientId]/route.ts`** — admin-gated, `maxDuration 300` (~2 min), streams the `.docx`. **`next.config` `outputFileTracingIncludes`** bundles the logo.
- **`src/components/GenerateAuditButton.tsx`** — on the client page (Google Ads section, when approved) + compact per-row on the Command Center.
- Domain knowledge bundle: the `google-ads-audit` skill (`SKILL.md` + `references/` + `findings-artifact.schema.json` + `build_audit_docx.js`). Reference outputs: OASES (lead-gen), House of Isabella / FiltersFast (ecommerce).
- `npm i docx`. `npm i @anthropic-ai/sdk` if not present.

### F. Weekly-report refinements  (commits a25aa36, 1216807, and the reporting evolution)
- **`narrative.ts`** — Mon–Sun period; all three By-Time scorecard lines; standalone *Conversions by action* paragraph; the *Summary* now **leads with the key insight and explains the WHY** (tied to the logged optimisations + seasonality, not a metric dump); the *A note from your account manager* personalization placeholder. Greeting + sign-off envelope around the Swydo body.
- **`AdsDashboard.tsx`** — scaled dual-axis trend chart (conversions/day = bars + right axis; spend = line + left axis); default range = the Mon–Sun "Week"; campaign-performance grid; top ads; auction-insights tiles; month performance. Pure-dashboard view in a wide shell.

---

## 2. Per-deployment adaptations (DO NOT skip — especially branding)
| Concern | app.ppcmastery.ai (PPC Mastery) | app.adenergy.online (AdEnergy / BJ) |
|---|---|---|
| **Audit branding (`audit/docx.ts`)** | Replace "Web Marketing International Ltd", the navy/orange palette, the logo (`audit/assets/`), and the "Google Premier Partner" claim with **PPC Mastery's** identity | Same, with **AdEnergy's** identity. **Only claim "Premier Partner" if that entity actually holds it** — otherwise reword the appendix. |
| **Logo** | PPC Mastery logo in `audit/assets/` + `public/` (and Wordmark) | AdEnergy logo |
| **`entityConfig.brandName`** (chat sign-off, "The X Team") | PPC Mastery | AdEnergy |
| **Currency** | per-account (from API) — no change | same |
| **Auth0 roles claim / `requireAgencyAdmin`** | confirm that app's claim + role | same |
| **Slack channel ID** (alerts, weekly drafts) | that app's channel ID (use the ID, not name) | same |
| **Google MCC** (`GOOGLE_ADS_LOGIN_CUSTOMER_ID`) | PPC Mastery's MCC | AdEnergy's MCC |
| **P5-Lite write allowlist** | that app's TEST account only, until Standard Access | same |
| **Audit voice/templates** | OASES + ecommerce refs as the standard; tune if PPC Mastery's house style differs | AdEnergy may want its own audit voice/sections — adjust the skill refs |

The audit document's company name, palette, logo and Premier-Partner language are **WMI-specific and hardcoded in `docx.ts` + `generate.ts`** — these are the single most important things to re-brand per deployment.

---

## 3. Schema migrations to run (per app's Supabase, both envs)
- `0015_optimization_proposals.sql` (proposals)
- `0016_proposal_execution.sql` (execution/audit columns)
- (plus any reporting/billing migrations the target is missing — see the reporting handover)
RLS stays as-is (server uses the secret key). No tenant keys (single-agency).

## 4. Env checklist (per app, in its Vercel project)
- Existing: Auth0, Google Ads (`GOOGLE_ADS_*` incl. that app's MCC), Supabase, Slack (`SLACK_BOT_TOKEN`, `SLACK_REVIEW_CHANNEL` ID, `SLACK_OPS_CHANNEL`), `ANTHROPIC_API_KEY`, `CRON_SECRET`, `entityConfig` vars.
- New for P5-Lite (default off): `GOOGLE_ADS_WRITE_ENABLED`, `GOOGLE_ADS_WRITE_CUSTOMERS`, `GOOGLE_ADS_WRITE_CAMPAIGNS`, `GOOGLE_ADS_BUDGET_MAX_DAILY` (+ optional `_MAX_INCREASE_PCT`, `_LARGE_DECREASE_PCT`). Redeploy after setting.

## 5. Build / verify / order
Suggested order per app: reporting data layer (if missing) → Command Center (A) → AI chat (B) → proposals + migration 0015 (C) → audit + `docx`/branding (E) → weekly refinements (F) → P5-Lite + migration 0016, **inert** (D), then the validate-only go-live sequence on a test account.

Verify each (Node local; throwaway `tsx` — load `.env.local` manually, then dynamic-import):
- `npx tsc --noEmit` + `npx next build` (validates routes/config).
- Command Center: `getCommandCenter()` returns per-currency totals + alerts.
- Chat: `runAgentChatStream` emits status + deltas; tools return real figures.
- Proposals: file → approve → (P5 off) advisory; (P5 on, test acct) dry-run → apply → verify → rollback; audit log has before/after.
- Audit: `generateAudit(customerId, label, {logo})` → valid `.docx`; ecommerce account → revenue/ROAS framing, no OCT; lead-gen → OCT framing.

## 6. Hard rules carried over
- **P5-Lite: no real-account writes until guardrails + Standard Access; allowlist test accounts; kill switch off by default; the worker re-checks approval (UI is not the boundary).**
- Credential isolation per entity. No UTF-8 BOM in `.sql`. Supabase secret key via the client lib, not raw REST. `gaqlSearch` = 1 request/call. Clear `ads_report_cache` after reporting-shape changes. Server actions self-guard with `requireAgencyAdmin()`.
- Re-brand the audit document per entity (company, palette, logo, Premier-Partner claim).

*Companion: `HANDOVER_REPORTING_BILLING_PORT.md`, `HANDOVER_BJ_FULL_PARITY.md`, `V4a_MULTITENANCY_AUDIT.md`.*

---

# Appendix — reference detail

Reference material for the build. Nothing here is new scope; it makes §1–§6 precise.

## A1. New-file manifest (everything Rexos added)
| File | Subsystem | Purpose |
|---|---|---|
| `src/lib/command-center.ts` | Command Center | `getCommandCenter`, `evaluateAlerts`, per-currency roll-ups |
| `src/app/(admin)/dashboard/page.tsx` | Command Center | overview + alerts UI (replaces placeholder) |
| `src/lib/integrations/anthropic/agent.ts` | Chat | tool-use loop (`runAgentChat`/`runAgentChatStream`) + tools |
| `src/app/api/agent/chat/route.ts` | Chat | admin-gated streaming NDJSON endpoint |
| `src/components/CommandChat.tsx` | Chat | right-rail chat panel |
| `src/lib/proposals.ts` | Proposals | create/list/decide/pendingCount |
| `src/app/(admin)/proposals/page.tsx` + `actions.ts` | Proposals | approval queue UI + actions |
| `supabase/migrations/0015_optimization_proposals.sql` | Proposals | proposals table |
| `src/lib/integrations/google-ads/write.ts` | P5-Lite | guardrails + op builders + `parseAction` |
| `src/lib/proposals-execute.ts` | P5-Lite | the worker (validate→mutate→verify→audit→rollback) |
| `supabase/migrations/0016_proposal_execution.sql` | P5-Lite | execution/audit columns |
| `src/lib/audit/extract.ts` | Audit | findings artifact from the API |
| `src/lib/audit/docx.ts` | Audit | branded docx-js helpers (**re-brand per entity**) |
| `src/lib/audit/generate.ts` | Audit | diagnose + narrative + assemble + glossary + account-type |
| `src/lib/audit/assets/<logo>.png` | Audit | cover logo (**per entity**) |
| `src/app/api/audit/[clientId]/route.ts` | Audit | admin-gated .docx download |
| `src/components/GenerateAuditButton.tsx` | Audit | client-page + Command-Center button |
| `googleAdsMutate` in `…/google-ads/index.ts` | P5-Lite | only write path |
| `next.config.ts` `outputFileTracingIncludes` | Audit | bundles the logo |
Modified: `narrative.ts`, `AdsDashboard.tsx`, `reporting.ts` (getAccountSummary), `(admin)/layout.tsx` (Proposals nav badge), `(admin)/clients/[id]/page.tsx` (audit button), cron route.

## A2. New GAQL queries added today (all read-only, 1 request each)
- **Network split:** `SELECT segments.ad_network_type, metrics.cost_micros, metrics.clicks, metrics.conversions FROM campaign WHERE …` (values SEARCH / SEARCH_PARTNERS / CONTENT / YOUTUBE / …).
- **Conversion-action config:** `SELECT conversion_action.name, conversion_action.category, conversion_action.status, conversion_action.origin FROM conversion_action` (do NOT select `primary_for_goal` — brittle across versions).
- **Per-action conversions:** `SELECT segments.conversion_action_name, metrics.conversions, metrics.conversions_value FROM campaign WHERE …`.
- **Assets present:** `SELECT asset_field_type_view.field_type FROM asset_field_type_view`.
- **Month trend:** `SELECT segments.month, metrics.* FROM campaign WHERE segments.date BETWEEN … ORDER BY segments.month`.
- **Impression-share suite:** `metrics.search_impression_share`, `…absolute_top…`, `…top…`, `…rank_lost…`, `…budget_lost…` FROM campaign (Search only), impression-weighted.
- **Top ads:** `SELECT campaign.name, ad_group_ad.ad.type, ad_group_ad.ad.responsive_search_ad.headlines, ad_group_ad.ad.final_urls, metrics.* FROM ad_group_ad WHERE … ORDER BY metrics.conversions DESC LIMIT 10`.
- `campaignTotals` now also retains per-campaign impressions+clicks (drives the campaign-performance grid).
- **Mutate (P5-Lite, the ONLY write):** `POST customers/{cid}/googleAds:mutate` with `mutateOperations`, `validateOnly`, `partialFailure`. Op shapes: `campaignCriterionOperation.create{campaign, negative:true, keyword{text,matchType}}` (remove by resourceName); `campaignOperation.update{resourceName,status}` + `updateMask:"status"`; `campaignBudgetOperation.update{resourceName, amountMicros}` + `updateMask:"amount_micros"`. ⚠️ The API does NOT expose Auction-Insights competitor domains — only impression share.

## A3. Audit document map (section → source → who writes it)
Cover · Overview (code, type-aware) · **Glossary** (code, type-aware table) · Contents (TOC) · Executive Summary (LLM) · **PART B**: Account Analysis + Exhibit 1 totals (table) · Campaign Structure + Exhibit 2 (table) + commentary (LLM) · Network Split + table (the killer finding) · Search Terms + junk exhibit · Negative Strategy (LLM bullets) · Auction Insights + impression-share table (note: no competitor domains via API) · Conversion Tracking + actions table + explainer (LLM, type-aware) · Assets panel · Audiences · Quick Wins · **PART C** (all LLM): Architecture · Measurement/OCT Roadmap · Channel Strategy · Short/Long-Term · Forecast (table, type-aware) · Optimisation Plan · **Appendix**: full Premier-Partner section. Rule: **tables/exhibits are built in code from the findings; prose is LLM, artifact-values-only.**

## A4. Account-type framing matrix
| Aspect | lead_gen | ecommerce |
|---|---|---|
| Detect | else | purchase-category action OR (value tracked & ROAS≥1) |
| Principle | qualified demos/MQLs, not form fills | profitable revenue & ROAS, not raw conversions |
| Conversion section | "The Root Cause" + OCT explainer | "Value Integrity" + value-based-bidding explainer |
| Roadmap | Conversion Tracking & OCT | Measurement & Value-Based Bidding |
| Forecast | Media / CPC / Demos / Cost-per-demo | Media / Orders / Revenue / ROAS (off account AOV+CVR) |
| "no value" diagnosis | implement OCT/GCLID/pipeline | enable conversion VALUE → Target ROAS |
| FORBIDDEN | — | OCT, GCLID-to-CRM, MQL/SQL/Opportunity/pipeline |

## A5. P5-Lite execution flow & go-live (the dangerous part)
Flow: **approved proposal → worker re-checks approval (NOT the UI) → resolve names→IDs → `validate_only` → mutate → re-query/verify → immutable audit (activity_log + execution before/after) → Slack alert → rollback available.** Guardrails: kill switch `GOOGLE_ADS_WRITE_ENABLED` (off by default, case-insensitive), customer allowlist `GOOGLE_ADS_WRITE_CUSTOMERS`, campaign allowlist `GOOGLE_ADS_WRITE_CAMPAIGNS` (pause/budget only), budget caps. One op per approval; no batch; no autonomous writes.
Go-live per app (do NOT change a real account first): confirm dev token can mutate + OAuth edit access → allowlist ONE test account → `validate_only` → one low-risk mutate (a negative keyword on a paused campaign is safest) → verify → rollback → confirm the audit before/after. Vercel binds env at deploy → **redeploy** after setting vars; the Proposals banner shows ENABLED/OFF.

## A6. Agent tools (read-only + propose)
`list_accounts` (roster — returns company, clientId, **customerId**, status), `list_campaigns` (an account's campaigns **including paused**, activity-independent — the agent must use this to get the EXACT campaign name), `get_account_report` (one account full snapshot), `get_all_account_summaries` (cross-account KPIs + alerts), `get_recent_changes` (change log), `propose_optimization` (files a proposal; include `details.action` = {kind: add_negative_keyword | pause_campaign | set_campaign_budget, campaign:<exact name>, …} for an EXECUTABLE one, ONE op each; **campaign is REQUIRED** — if it can't be pinned to a campaign, file ADVISORY). `resolveAccount` matches clientId, **Google customer id (dash/space-insensitive)**, or company name. The agent analyses and proposes only — it never executes.

## A7. Re-branding the audit document per entity (the #1 per-app task)
In `audit/docx.ts`: `NAVY`/`ORANGE` palette, font, the cover "WEB MARKETING INTERNATIONAL LTD" + "Google Premier Partner" lines, header/footer text. In `audit/generate.ts`: the Premier-Partner appendix prose ("Web Marketing International is a Google Premier Partner…" — only keep the Premier-Partner claim if that entity holds it; otherwise reword), and the cover title/subtitle. Replace `audit/assets/<logo>.png` and the `outputFileTracingIncludes` path. `entityConfig.brandName` covers the chat/weekly-report sign-off.

## A8. Deliberately out of scope (so nobody rebuilds them by surprise)
Part A (market/competitor/keyword research) and the Website CRO document — need live web/Chrome the runtime doesn't have (the standalone agent bundle does these). Auction-Insights competitor domains — not in the API. Batch writes & autonomous writes — excluded by the P5-Lite safety model. The Glossary IS included (added in commit a248c75).

## A9. Verification reference (expected anchors)
Throwaway harness: `npm i tsx --no-save`; in the script parse `.env.local` manually, then `await import("@/…")`; `npm uninstall tsx` after. Live anchors from app-wmi to sanity-check a port:
- Command Center: per-currency totals (USD/GBP/AUD/EUR), Action-first, real alerts (e.g. House of Isabella conv −33%).
- Chat: ranks accounts needing attention; for one account cites real figures + impression-share breakdown; proposes, never executes.
- P5-Lite: negative-keyword add on a paused test campaign → verify exists → rollback → criterion gone; audit log has before/after; re-approve guard rejects.
- Audit: ecommerce account → revenue/ROAS framing + ecommerce glossary, NO OCT; lead-gen → OCT framing + lead-gen glossary. Valid 1MB+ `.docx` in ~2 min.

## A10. Troubleshooting (issues seen on the first ports)
**"Controlled writes / Write mode: OFF" — can't push changes live.** The env flag isn't live on that deployment. Fix on THAT app's Vercel: set `GOOGLE_ADS_WRITE_ENABLED=true` (no quotes/spaces), `GOOGLE_ADS_WRITE_CUSTOMERS=<test account digits>`, `GOOGLE_ADS_WRITE_CAMPAIGNS=<paused test campaign ids>`, `GOOGLE_ADS_BUDGET_MAX_DAILY=<cap>` — for the **Production** scope — then **Redeploy** (Vercel binds env at deploy). Common causes: not redeployed; vars on Preview/Development instead of Production; wrong Vercel project. Confirm `writeEnabled()` uses the **case-insensitive** check (`.trim().toLowerCase() === "true"`); a port made before that fix has the exact-`"true"` bug.

**"Add negative … to undefined" / "This proposal has no executable action."** The agent filed an executable negative with no campaign (account-level / shared list, or it couldn't find a campaign). Ensure the port includes the agent fixes: `resolveAccount` matches the **Google customer id**; the **`list_campaigns`** tool (paused-inclusive); and `propose_optimization` requires an exact `campaign` for executable actions and otherwise files ADVISORY. Account-level / shared-negative-list writes are **not** in the P5-Lite spike — they are advisory-only. (Fixed in app-wmi commit d0f7712.)

**"Hard for the assistant to find the account/campaign."** Same fix: reference accounts by name OR customer id (list_accounts now returns the customerId); the agent calls list_campaigns to get exact names even on paused/zero-activity accounts.

**"Campaign <id> not found" at Apply time.** `proposals-execute.ts` `resolveCampaign`/`resolveAdGroup` originally matched by NAME only, so a proposal carrying a numeric campaign id failed. Fixed (app-wmi commit 8af8969): a pure-digits value resolves by `campaign.id`, otherwise by name. If it still "not found" after this, the campaign belongs to a DIFFERENT account than the proposal's resolved customer id — check the account.

**Stripe/PandaDoc webhooks failing (400 "Invalid signature", or Stripe emails "other errors").** ⚠️ **All ports have this latent bug.** The Auth0 middleware (`src/proxy.ts`) matcher ran on `/api/webhooks/*`, so a session-less machine POST passed through Auth0 and its raw body was altered/buffered → HMAC signature verification failed (`constructWebhookEvent` throws → 400), or the request was redirected into the login flow (Stripe reports "other errors"). Symptom: every webhook delivery fails from the day it starts; subscriptions/checkout fulfilment silently stops. **Fix (app-wmi commit afe2e40):** add `api/webhooks` and `api/cron` to the proxy matcher's negative-lookahead so Auth0 never touches them — they self-authenticate (Stripe/PandaDoc signature, `CRON_SECRET`):
```
"/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|api/webhooks|api/cron).*)"
```
Also pin both webhook routes to Node crypto: `export const runtime = "nodejs"; export const dynamic = "force-dynamic"; export const maxDuration = 15;`. After deploying, **Resend** the failed events in the Stripe dashboard so clients that paid during the outage get activated. (If it's a genuine `STRIPE_WEBHOOK_SECRET` mismatch instead, the delivery detail shows a persistent 400 even after this fix — copy the destination's `whsec_…` into that app's Vercel and redeploy.)

## A11. MCC-wide reads (commit a568e9d)
The agent can analyse ANY leaf under the MCC, not just imported clients — **reads only; writes stay gated to the per-account allowlist.**
- `loadRoster()` merges the DB roster (imported clients, `clientId` set) with `listManagedAccounts()` (every MCC leaf, `clientId: null`, deduped by customer id).
- `getDashboard(clientId: string | null, …)` computes **live/cache-less** when `clientId` is null (the `ads_report_cache` FKs to `clients`, so non-client accounts can't cache).
- Read tools work for any account; `propose_optimization` requires an imported client (proposals FK to `clients`) and otherwise returns an "import it first" message.
- Note: `get_all_account_summaries` / the Command Center page still use the imported-client roster (the heavy per-account KPI pull). Extending those to all MCC leaves is a deliberate follow-up (perf: an MCC can have 100+ leaves).
- ⚠️ MCC-wide WRITES are NOT enabled: the write allowlist stays the boundary. A "write to any MCC account" mode would be a separate, explicit opt-in flag, only after Standard Access, keeping human approval + validate-only + caps + audit.

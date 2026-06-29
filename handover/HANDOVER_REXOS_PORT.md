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

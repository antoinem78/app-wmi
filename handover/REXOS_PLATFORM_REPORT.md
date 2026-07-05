# Rexos — Platform Report (app.wmiltd.com)

**Date:** 2026-07-05 · **Repo:** app-wmi (github.com/antoinem78/app-wmi) · **Live:** https://app.wmiltd.com
**Purpose of this document:** the definitive record of what Rexos is and does, to inform the SingularWeb ("matrix") build. Written to be read cold by another Claude instance or engineer.

---

## 1. What Rexos is

Rexos is WMI's **PPC Ops Control Center**: a single-tenant agency platform that runs the entire client lifecycle — onboarding → contract → payment → Google Ads linking → reporting → AI analysis → **AI-proposed, human-approved, gated live changes to Google Ads accounts**. It started as a client-onboarding portal and evolved into a command center with a controlled write layer over WMI's whole MCC.

Two sibling deployments were ported from this codebase (each its own repo + credentials): **app.ppcmastery.ai** and **app.adenergy.online** (BJ Command Center). WMI is the reference implementation. Features flow in both directions via handover briefs (see `handover/`).

**Stack:** Next.js 16.2.7 (App Router, `proxy` middleware), Auth0 (agency-admin gate), Supabase (Postgres, 20 migrations), Stripe (subscriptions, GBP), PandaDoc (contracts, production key), Slack (bot: client channels, review drafts, ops alerts), Google Ads API v24 REST (one MCC refresh token, `login-customer-id` auth, **no client OAuth**), Anthropic `claude-opus-4-8` (narratives, audits, analyst agent), docx-js (branded documents). Deployed on Vercel.

---

## 2. Capability map

### 2.1 Client onboarding & billing (the original MaaS portal)
- Full funnel: details → PandaDoc contract → Stripe checkout → post-payment checklist (questionnaire, Slack invite, Google Ads link, GA4/GTM/GSC/GMC/Meta access grants, creative assets, Microsoft Ads).
- Custom pricing only (no tiers). Subscription lifecycle: payment-failure dunning + 31-day-notice cancellation.
- **Bank-transfer override:** admin "mark as paid" (manual Xero invoice path) + customizable contract/service start date (migration 0014).
- Google Ads linking: MCC sends a CustomerClientLink invitation; daily cron refreshes status; manager links auto-resolve to the reporting leaf.
- Reporting-only clients: import any MCC account (single or bulk from the MCC list, with select-all) without the onboarding funnel.

### 2.2 Reporting engine (Swydo standard)
- **Data layer** (`src/lib/integrations/google-ads/reporting.ts`): account-wide (all channel types) dashboard payload — KPIs with prior-period deltas (incl. By-Time = conversion-date basis, ROAS, AOV), daily trend, campaign performance grid (every metric + %Δ, 0-spend filtered), top ads (with ad group), Search impression-share suite (Auction Insights stand-in), conversions-by-action, top search terms (ranked by conversions), device split, 6-month Month performance. Cached in `ads_report_cache` for the canonical week; cache-less for other ranges.
- **Selectable ranges:** Week (Mon–Sun, the standard) / 7d / 14d / 30d / Month (last complete calendar month) / Custom from–to. `DashRange` → `resolveRange` with equal-length prior window.
- **AI narrative** (`narrative.ts`): Claude writes the client report in the Swydo format wrapped in greeting/sign-off. Hard rules: verified figures only, never invent numbers; Summary leads with the 1–2 key insights and explains the **why** (ties movements to the logged change history + seasonality); account-manager note placeholder for human personalisation; period-aware wording (weekly/monthly/custom). Per-account guidance prompt (`clients.report_prompt`) shapes tone without overriding figures.
- **Delivery:** Monday cron posts weekly drafts per client to the Slack review channel (bounded concurrency, delivery failures surfaced). On-demand **"Send report to Slack"** button for any selected timeframe. Change-history queries clamped to Google's ~30-day limit.

### 2.3 Command Center (P1+P2)
- `/dashboard`: all managed accounts at a glance — per-currency agency roll-ups (never sums across currencies), health pills, live alert rules (spend with 0 conv = critical; conversions −25%/−10%; spend +40%), Action-first sort. ~3 GAQL calls per account.

### 2.4 Rexos AI analyst (P3)
- **Global widget on every admin page** (floating launcher, `RexosWidget` in the admin layout) with an **in-chat account selector** (All accounts ↔ any client); auto-focuses the client whose page you're on.
- Streaming tool-use agent (Opus 4.8, NDJSON stream, live tool status). **Read-only tools:** `list_accounts`, `list_campaigns`, `get_account_report`, `get_all_account_summaries`, `get_recent_changes`, `get_search_terms` (real search-term data — negatives must cite actual wasted queries, never invented), `get_feed_audit` (Shopping/PMax product-level feed performance), plus `propose_optimization` (files proposals, never executes).
- **MCC-wide reads:** the roster is imported clients + every leaf under the MCC, so any account can be analysed; proposals require an imported client.
- **Persistent memory** (`agent_conversations`, migration 0018): each scope ('command-center' or a client id) is its own thread that survives navigation/reload; Clear wipes server-side. Focus account injected into the system prompt (fixes "which account?").

### 2.5 Proposals + controlled writes (P4 + P5)
- **Proposals** (`optimization_proposals`, migrations 0015/0016): typed, figure-backed cards (negatives / pause / budget / RSA / other) filed by the agent or team; statuses pending → approved → applied/failed/rolled_back; Approve/Dismiss/Delete (any state); **"Mark as applied"** for changes actioned by hand (propose-only workflow); full activity logging.
- **Write layer — the crown jewel.** Four executable actions, one operation per approval, no batching, no autonomous writes:
  1. add campaign/ad-group negative keyword
  2. **add shared/account-level negative** — one atomic mutate: find-or-create the "WMI shared negatives" SharedSet, add the criterion, attach to every enabled/paused Search campaign
  3. pause / re-enable campaign
  4. set campaign daily budget (hard daily cap, max-increase %, large-decrease confirm; cap=0 disables budget writes)
- **Safety model, enforced in the worker (never the UI):** kill switch `GOOGLE_ADS_WRITE_ENABLED` → **live MCC-membership boundary** (target verified against the real `customer_client` hierarchy, 15-min cache, re-verified on miss; enforced on dry-run, apply AND rollback; no cross-MCC writes ever) → account allowlist (`GOOGLE_ADS_WRITE_CUSTOMERS`; `ALLOW_ALL_MCC_ACCOUNTS=true` lifts it *and* the per-campaign pause/budget gate = "open the whole book") → per-action guards. Flow: **validate-only → mutate → verify-after (re-query the account) → immutable audit → rollback** (inverse op through the same gates; shared-negative rollback removes only the criterion). Dry-run skips the allowlist (validate before allowlisting) but never the MCC boundary.
- **`write_audit` table** (migration 0020): non-client-scoped security ledger of every write attempt — both scope-check results, approver, phase, outcome (`ok/blocked/failed/boundary_violation`).
- **Proven live:** end-to-end on the test account (negative add → verify → rollback, corroborated in Google Change History), and in production on the full book (e.g. PMax campaign pause on House of Isabella UK, verified PAUSED, Slack-alerted, rollback available).

### 2.6 Audit generators (branded .docx)
- **Google Ads audit** (`src/lib/audit/`): API-sourced, OASES-style branded Word document — extract findings → code-side diagnosis (network leakage, conversion sprawl, junk terms, thin assets, PMax manufactured conversions…) → Claude narrative (artifact-values-only) → docx assembly with cover, TOC, glossary, exhibits, forecast, full Premier-Partner appendix. **Account-type aware:** ecommerce (revenue/ROAS/value-based bidding) vs lead-gen (demos/OCT/pipeline) framing throughout. Generated + downloaded from the portal (~2 min). Verified against real accounts of both types.
- **Shopping/feed audit** (commit 9d0452d): product-level feed-performance audit from the Ads API (dead/zero-impression products, spend concentration, Shopping-vs-PMax) — with a **Merchant Center seam** ready: true feed health (disapprovals, item-level issues) lights up once the Content API scope is provisioned (Google-side setup pending — see §5).

### 2.7 Client-facing surfaces & exports
- Client dashboard on the onboarding portal (same verified payload).
- **Public share link** `/share/<token>` (migration 0019): unguessable token, admin-toggled, read-only, no sign-in; print-to-PDF button.
- Audit .docx exports to PDF / opens as Google Doc natively (no in-app Drive integration by choice).

---

## 3. Data model (Supabase, migrations 0001–0020)

`clients` (+ `report_prompt`, `share_enabled`, `share_token`, `service_start_date`, custom price, platforms, access tasks, source, cancellation) · `onboarding_state` (funnel state machine + Google Ads customer/reporting ids + link status) · `activity_log` (client-scoped event trail) · `ads_report_cache` (PK client_id+window) · `weekly_reports` · `optimization_proposals` (+ execution jsonb, applied/rolled-back bookkeeping) · `agent_conversations` (chat memory by scope) · `write_audit` (cross-cutting write security ledger). `_consolidated_fresh_install.sql` stands up a fresh instance.

## 4. Security & multi-entity architecture (most relevant to SingularWeb)

- **Credential isolation is the constitutional rule.** Each deployment (WMI / PPC Mastery / AdEnergy) is its own repo, own Supabase, own Auth0, own Stripe, own PandaDoc, own Slack, own Google MCC + refresh token, own Anthropic key. Every integration reads config from exactly one module (clean seams: `src/lib/integrations/*`, `src/lib/config.ts` entityConfig). Nothing crosses entities.
- **Single-operator model:** one stored MCC refresh token; clients never OAuth. The MCC hierarchy IS the authorization boundary for both reads and writes.
- **Writes are guarded by layered, server-side, env-driven controls** (kill switch → live MCC boundary → allowlists → caps → approval → validate → verify → audit → rollback). The UI is never trusted; the worker re-checks everything.
- Admin gate in the layout (Auth0 role), not middleware. Public surfaces are token-scoped and read-only.
- V4a multi-tenancy audit exists (`handover/V4a_MULTITENANCY_AUDIT.md`) documenting what single-tenant assumptions would need to change for a true multi-tenant SaaS.

## 5. Known pending / open items

- **Merchant Center feed health:** needs Google-side setup — enable Content API on the GCP project, re-mint the refresh token with the `content` scope, provide Merchant Center id mapping. The code seam + document section are already built and render automatically when data appears.
- Campaign Builder is **deliberately absent** on WMI (exists on PPC Mastery only; `/builder` is 404 here by decision).
- Bing/Microsoft Ads reporting and Gross Profit metric: recorded as pending in the weekly report standard.
- Write rollout state: whole book open (`ALLOW_ALL_MCC_ACCOUNTS=true`), kill switch on, proven in production.

## 6. Porting record

Handover briefs in `handover/` drove two successful ports (PPC Mastery, AdEnergy) and two reverse-ports back into WMI (parity brief 2026-07-02: ranges/monthly/Slack-send, chat memory, per-account prompts, share links, exports; analyst+writes brief: focus account, search-terms grounding, MCC-wide writes, shared negatives, write_audit). The pattern — target-state spec, diff, build gaps, commit per phase — worked cleanly in both directions and is the recommended mechanism for SingularWeb feature distribution.

---

*One-line summary: Rexos is a proven single-tenant agency OS — onboarding, billing, Swydo-grade AI reporting, a command center, an everywhere-available AI analyst with persistent memory, and a production-proven, MCC-bounded, human-approved write layer over Google Ads — built on strict credential-isolation seams that make it replicable per entity.*

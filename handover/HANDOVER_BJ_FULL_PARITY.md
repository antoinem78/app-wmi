# Handover — Bring BJ PPC MCC Command Center to FULL app.wmiltd.com parity

**Audience:** Claude Code, running in the **BJ PPC MCC Command Center** repo.
**Reference implementation:** the `app-wmi` repo (SingularWeb/WMI portal at app.wmiltd.com).
**Goal:** BJ Command Center should have **every functionality** app.wmiltd.com has — the full client portal: onboarding funnel, contracts, payments, provisioning, admin, reporting.

> **Companion doc:** `HANDOVER_REPORTING_BILLING_PORT.md` covers the reporting + billing *delta* (already ported to BJ — its dashboards/reports are confirmed good). THIS doc covers **everything else** to reach full parity.

---

## 0. Read this framing first (it changes the size of the job)

app.wmiltd.com is **one agency (WMI) with many clients**. It is "single-tenant" only in that it is **deployed once per agency**, with all per-agency settings in environment variables — the code never branches on entity. BJ Command Center is the **same shape**: one agency (BJ), many client accounts under BJ's MCC.

**So "full parity" = port the full app-wmi feature set into BJ's repo and run it as BJ's own deployment** with BJ's own credentials. This is a **feature port + second deployment**, *not* a multi-agency SaaS rebuild.

⚠️ **If you actually want multiple agencies each logging into one shared install** (true multi-tenant SaaS), that is **V4a** — a different, much larger project ("rebuild the spine": tenant keys on every table, RLS, per-tenant OAuth token storage, Stripe Connect, Auth0 orgs). See `V4a_MULTITENANCY_AUDIT.md`. Do **not** undertake that here unless explicitly told to — it is out of scope for "BJ parity".

---

## 1. Step 0 — Gap analysis BEFORE you build

BJ Command Center already shares lineage with app-wmi and **already has the reporting stack** (reporting.ts, narrative.ts, AdsDashboard, Google Ads integration, Supabase, and likely admin client management + reporting-only clients). **Do not re-port what exists.** First, inventory BJ's repo and produce a checklist of present vs missing against the feature map in §2. Port only the gaps.

Likely **already present** in BJ: Google Ads integration, reporting/dashboard, Supabase client, admin client list, reporting-only clients, Auth0 admin gate, activity log.
Likely **missing** (the parity work): the client-facing **onboarding funnel** (details → contract → payment → post-payment checklist), **Stripe** subscriptions + lifecycle + webhooks, **PandaDoc** contracts + webhook, **Slack** client-channel provisioning, **access-grant** tasks, the full `onboarding_state` machine + billing columns, the `google-ads-links` cron.

---

## 2. Full feature map (the parity target)

| Subsystem | Key files (app-wmi paths) | Port? |
|---|---|---|
| **Onboarding funnel (client-facing)** | `app/onboarding/[id]/page.tsx` + `actions.ts`, `app/onboarding/page.tsx` | §4 |
| **Admin area** | `app/(admin)/layout.tsx`, `dashboard/`, `clients/` (`page`, `[id]`, `new`, `import`, `reporting`) + `actions.ts` | §5 |
| **Stripe** (subscriptions, lifecycle, webhook) | `lib/integrations/stripe/index.ts`, `app/api/webhooks/stripe/route.ts` | §6 |
| **PandaDoc** (contracts, signing, webhook) | `lib/integrations/pandadoc/index.ts`, `app/api/webhooks/pandadoc/route.ts` | §6 |
| **Slack** (channels, invites, posts) | `lib/integrations/slack/index.ts` | §6 |
| **Google Ads** (MCC linking + reporting) | `lib/integrations/google-ads/index.ts` + `reporting.ts` | likely present; verify §6 |
| **Anthropic** (weekly narrative) | `lib/integrations/anthropic/narrative.ts` | present (reporting port) |
| **Crons** | `app/api/cron/google-ads-links/route.ts`, `app/api/cron/weekly-reports/route.ts` | §7 |
| **Auth** | `lib/auth/{auth0,roles,guard}.ts`, `(admin)/layout.tsx` | §3 |
| **Config / tiers / access-tasks / activity** | `lib/{config,tiers,access-tasks,activity}.ts` | §3 |
| **Schema** | `supabase/migrations/*` | §8 |
| **Components** | `components/*` (Wordmark, StatusBadge, SubmitButton, ConfirmSubmitButton, CopyButton, DeleteClientForm, PoweredBy, AdsDashboard) | as needed |

---

## 3. Foundation: config, auth, core libs

**`lib/config.ts` — `entityConfig`** (the entity seam; set via env, never branch on entity in code). Fields: `legalName`, `brandName`, `brandLogoUrl`, `currency` (BJ = **USD**), `vatRate`, `vatNumber`, `reportingOnly`, + `formatMoney()`. → For BJ, set BJ's legal name/brand/currency. **`reportingOnly`** toggles whether the onboarding funnel is shown — for full parity set it **false** so BJ gets the funnel.

**`lib/auth/`** — Auth0 (`@auth0/nextjs-auth0` v4): `auth0.ts` (client + `beforeSessionSaved` preserving the roles claim), `roles.ts` (`ROLES_CLAIM`, `isAgencyAdmin`), `guard.ts` (`requireAgencyAdmin()` — **every** admin server action calls it; server actions are POST-able directly, so layout gating is not enough). BJ uses **its own Auth0 tenant**; confirm the `ROLES_CLAIM` value and that BJ's Auth0 post-login Action emits `agency_admin`.

**`lib/tiers.ts`** — bespoke pricing: `CUSTOM_TIER_KEY="custom"`, `CUSTOM_PLAN_NAME`, `PLATFORM_OPTIONS`, `channelsLabel()`, billing model = 1-month rolling, billed in advance, 31-day cancellation notice.

**`lib/access-tasks.ts`** — GA4/GTM/GSC/GMC/Meta grant steps: `ACCESS_TASKS`, `getGrantEmails()`, `getMetaBusinessId()` (BJ's own Meta Business ID), `accessGrantTargets()`.

**`lib/activity.ts`** — `logActivity({clientId,eventType,actor,payload})`, append-only, non-fatal.

**`lib/supabase/server.ts`** — `createSupabaseAdminClient()` (server-only SECRET key, bypasses RLS). Use the supabase-js client lib, not raw REST (new `sb_secret_` keys are rejected on raw REST).

---

## 4. Onboarding funnel (client-facing, unauthenticated, link-driven)

The `/onboarding/[id]` link **is** the credential (no client login). State machine `onboarding_step`: `questionnaire → contract → payment → slack → ad_linking → complete`, gated by `payment_status` for the post-payment home.

**`app/onboarding/[id]/page.tsx`** renders, by phase:
- **Pre-payment wizard:** details → contract (PandaDoc embedded signing; polls `getDocumentStatus`) → payment (Stripe checkout). Stripe-return verifies via `finalizeFromCheckoutSession` (never trust the URL).
- **Post-payment home/checklist:** questionnaire, Slack invite, Google Ads link, access grants (GA4/GTM/GSC/GMC/Meta), creative assets, Microsoft Ads field — any order, with a % complete bar.
- **Reporting-only clients** (`source='reporting_only'`): no funnel; the link IS the dashboard. Use the **wide** Shell (`max-w-6xl`) for dashboard views, narrow (`max-w-2xl`) for the funnel.

**`app/onboarding/[id]/actions.ts`** server actions (each re-checks the current step server-side, no skipping): `confirmDetails`, `generateContract`, `confirmContractSigned`, `startCheckout`, `submitSlackEmail`, `submitQuestionnaire`, `submitGoogleAdsCustomerId`, `toggleChecklistTask`, `submitAssetsLink`, `submitMicrosoftAdsAccount`.

---

## 5. Admin area (`app/(admin)/` route group — no `/admin` prefix)

- **`layout.tsx`** — server-side gate: no session → `/auth/login`; logged-in non-admin → "No Access" card. Navy sidebar.
- **`clients/page.tsx`** — client book (search, status, price, source, Google Ads IDs).
- **`clients/[id]/page.tsx`** — client detail: onboarding journey, activity log, Google Ads linking (approve/refresh), Slack/MS-Ads, subscription cancel/resume, the **bank-transfer mark-paid** form + **contract start date** (see billing doc).
- **`clients/new/page.tsx`** — create client (company, contact, email, monthly price, platforms, access tasks).
- **`clients/import/page.tsx`** — bulk-import leaf accounts from BJ's MCC (`listManagedAccounts`).
- **`clients/reporting/page.tsx`** — add a reporting-only client.
- **`clients/actions.ts`** — `createClient`, `approveGoogleAdsLink`, `refreshGoogleAdsLinkStatus`, `cancelClientSubscription`, `resumeClientSubscription`, `deleteClient`, `addReportingClientsBulk`, `markPaidManually` (billing doc). All `requireAgencyAdmin()`.

---

## 6. Integrations — wire each to BJ's OWN credentials (critical discipline)

**🔒 The #1 risk: do NOT reuse WMI's or any other entity's credentials.** Each integration reads its config in exactly one module (clean seam). For BJ, every one of these must be **BJ's own account/token** — mirror the discipline used in the WMI harvest (separate Stripe, PandaDoc, Slack, Auth0, Google MCC, Supabase, Anthropic).

| Integration | Module | BJ must supply |
|---|---|---|
| **Stripe** | `stripe/index.ts` (+ webhook route) | BJ's `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`. Functions: `createCheckoutSessionForClient`, `finalizeFromCheckoutSession`/`finalizePaidClient` (idempotent), `scheduleCancellation`, `resumeSubscription`, `markPaymentFailed`/`Recovered`/`SubscriptionEnded`, `constructWebhookEvent`. Webhook handles `checkout.session.completed`, `invoice.payment_failed` (→past_due/dunning), `invoice.paid` (→recover), `customer.subscription.deleted` (→churned). |
| **PandaDoc** | `pandadoc/index.ts` (+ webhook route) | BJ's `PANDADOC_API_KEY`, `PANDADOC_TEMPLATE_ID` (BJ's own contract template with merge tokens), `PANDADOC_WEBHOOK_KEY`. Functions: `createContractDocument` (fills tokens, upserts contact, sends), `getDocumentStatus`, `createSigningSession` (embedded), `markContractSigned`. Webhook: `document_state_changed`→`document.completed`. |
| **Slack** | `slack/index.ts` | BJ's `SLACK_BOT_TOKEN`, `SLACK_TEAM_EMAILS`, `SLACK_REVIEW_CHANNEL` (**use the channel ID, not name**), optional `SLACK_OPS_CHANNEL`. Functions: `createClientChannel`, `tryInviteByEmail`, `inviteTeam`, `postMessage` (429-aware retry). Graceful degrade when unset. |
| **Google Ads** | `google-ads/index.ts` + `reporting.ts` | BJ's `GOOGLE_ADS_*` incl. **BJ's MCC** `GOOGLE_ADS_LOGIN_CUSTOMER_ID` + refresh token. Functions: `sendLinkInvitation`, `gaqlSearch`, `resolveReportingCustomerId`, `listManagedAccounts`, `getLinkStatus`, `portalStatusFor`. (Reporting already ported.) |
| **Anthropic** | `anthropic/narrative.ts` | `ANTHROPIC_API_KEY` (model `claude-opus-4-8`). Already ported. |
| **Supabase** | `supabase/server.ts` | BJ's `SUPABASE_URL`, `SUPABASE_SECRET_KEY`. |

---

## 7. Crons (Vercel scheduled, `CRON_SECRET` bearer)

- **`api/cron/google-ads-links/route.ts`** — daily: refresh pending link statuses; nag the ops Slack channel after 3 days pending; post success to the client channel.
- **`api/cron/weekly-reports/route.ts`** — weekly (Mon, `maxDuration=300`): for each approved client, build dashboard, compute optimisations, `generateNarrative`, post a review draft to `SLACK_REVIEW_CHANNEL`. **Surface Slack delivery failures** (`slackFailed`/`slackErrors`); only count `sent` when delivered. Set `vercel.json` cron schedules.

---

## 8. Schema (Supabase — run migrations in the SQL Editor; BOM-free ASCII)

Bring BJ's DB to the full set (consolidated in `_consolidated_fresh_install.sql`). Enums: `client_status`(prospect/onboarding/active/paused/churned/past_due), `onboarding_step`, `contract_status`, `payment_status`, `slack_status`, `ad_link_status`. Tables:
- **`clients`** — id, status, company/contact, `auth0_user_id` (unused), `service_tier`, `stripe_customer_id`, `stripe_subscription_id`, `custom_monthly_price`, `platforms[]`, `access_tasks[]`, `source` (onboarding|reporting_only), `cancellation_effective_at`, timestamps.
- **`onboarding_state`** — `client_id` (unique FK), `current_step`, `questionnaire_data` jsonb, `contract_status`, `payment_status`, `slack_status`, `ad_link_status`, `pandadoc_document_id`, `details_confirmed`, `slack_invite_email`, `google_ads_customer_id`, `google_ads_link_resource`, `checklist` jsonb, `assets_drive_link`, `google_ads_reporting_customer_id`, `microsoft_ads_account_id`, **`service_start_date`** (0014), `updated_at`.
- **`activity_log`** — client_id (cascade), event_type, actor, payload jsonb, created_at.
- **`ads_report_cache`** — PK (client_id, window_days), payload jsonb, fetched_at (30-min TTL).
- **`weekly_reports`** — client_id, period_start/end, payload jsonb, created_at.
- Triggers: `set_updated_at()` on clients + onboarding_state.
- **RLS:** none enforced — all access is via the server SECRET key. (Fine for single-agency. Multi-agency would need tenant keys + RLS = V4a.)

Port any migrations BJ is missing (the parity-relevant ones: 0002 stripe ids, 0003 pandadoc, 0004 flow rework, 0007 checklist/assets, 0013 subscription lifecycle, 0014 service_start_date, plus 0009 weekly_reports / 0008 cache if absent).

---

## 9. Environment variables (the full BJ checklist)

All read server-side (none `NEXT_PUBLIC_`). Group + obtain BJ's own values:
- **Entity:** `ENTITY_LEGAL_NAME`, `BRAND_NAME`, `BRAND_LOGO_URL`, `CURRENCY` (USD), `VAT_RATE`, `VAT_NUMBER`, `PORTAL_REPORTING_ONLY` (=false for parity).
- **Stripe:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
- **PandaDoc:** `PANDADOC_API_KEY`, `PANDADOC_TEMPLATE_ID`, `PANDADOC_WEBHOOK_KEY`.
- **Slack:** `SLACK_BOT_TOKEN`, `SLACK_TEAM_EMAILS`, `SLACK_REVIEW_CHANNEL` (ID), `SLACK_OPS_CHANNEL`, `ACCESS_GRANT_EMAILS`, `META_BUSINESS_ID`.
- **Google Ads:** `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_REFRESH_TOKEN`, `GOOGLE_ADS_LOGIN_CUSTOMER_ID` (BJ's MCC), `GOOGLE_ADS_API_VERSION`.
- **Supabase:** `SUPABASE_URL`, `SUPABASE_SECRET_KEY`.
- **Auth0:** `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, `AUTH0_SECRET`, `APP_BASE_URL`.
- **Anthropic:** `ANTHROPIC_API_KEY`.
- **Cron:** `CRON_SECRET`.
- ⚠️ `.env.local` = local dev (test/dev keys, gitignored); production values go in the Vercel dashboard. **Never** paste live Stripe / prod Auth0 into `.env.local`. Replace the hardcoded fallback `APP_BASE_URL ?? "https://app.wmiltd.com"` in the weekly-reports cron with BJ's URL.

---

## 10. Build order & verification

**Order:** schema (§8) → config/auth/core (§3) → integrations wired to BJ creds (§6) → onboarding funnel (§4) → admin (§5) → crons + webhooks (§7) → billing extras (mark-paid + start date, billing doc).

**Verify per subsystem** (Node is local; run TS via throwaway `tsx` — `npm i tsx --no-save`, `npx tsx scratch.ts`, then remove; load `.env.local` manually before dynamic-importing app modules):
- `npx tsc --noEmit` after each file.
- **Auth:** admin pages gate; a non-admin sees "No Access".
- **Onboarding:** walk a test client details → contract (PandaDoc sandbox) → Stripe **test-mode** checkout → post-payment home unlocks.
- **Webhooks:** Stripe CLI / PandaDoc test events flip the right statuses.
- **Reporting:** already verified; re-confirm one account end-to-end.
- **Billing override:** the safe no-op write check (update against a non-existent client id validates the schema without mutating data).

**Deploy:** Vercel project for BJ with BJ's env set; DNS for BJ's portal domain; configure Stripe + PandaDoc webhook endpoints to BJ's URL; set `vercel.json` crons; run all migrations on BJ's Supabase.

---

## 11. Hard rules / gotchas (carried from app-wmi)
- **Non-standard Next.js** — read `AGENTS.md` + `node_modules/next/dist/docs/` before writing Next code (middleware is `proxy`; route `context.params` is a Promise).
- **Credential isolation is the top risk** — every integration on BJ's own account; verify nothing points at WMI/another entity (auth domain, MCC id, Stripe acct, PandaDoc template, Slack workspace, Supabase project).
- **No UTF-8 BOM** in `.sql`. **Supabase secret key** via the client lib, not raw REST. **`gaqlSearch`** = 1 request/call. **Clear `ads_report_cache`** after reporting changes.
- **Server actions self-guard** with `requireAgencyAdmin()`.
- This is a **single-agency** deployment. Anything that smells like "multiple agencies sharing one install" = **V4a**, out of scope — stop and confirm.

---

*Companion: `HANDOVER_REPORTING_BILLING_PORT.md` (reporting + billing delta). Architectural reference: `V4a_MULTITENANCY_AUDIT.md`, `HANDOVER_V4ab_CLAUDE_CODE.md`, `V4ALPHA_VALIDATION_REPORT.md`.*

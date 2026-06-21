# V4a Multi-Tenancy Readiness Audit — answers from the V4alpha codebase

**Date:** 2026-06-21 · **Source:** the live V4alpha (WMI) codebase at `app.wmiltd.com` / repo `antoinem78/app-wmi`.
**Question from:** PPC Mastery workspace, scoping V4a (multi-tenant SaaS; chosen model = per-tenant OAuth on a Google standard-access developer token).
**Method:** answered from the actual schema + code (consolidated SQL, repo-wide greps, auth guard, integration credential reads, git history). Where something is not in the code, it says so explicitly.

---

## 1. Schema — the load-bearing answer

**1.1 No tenant/owner key on any core table.** `clients` is the root entity, carrying only its own attributes (`supabase/migrations/_consolidated_fresh_install.sql:38-55`): id, status, company/contact, `stripe_*`, `custom_monthly_price`, `platforms`, `source`, timestamps. A repo-wide grep for `tenant|owner_id|workspace|org_id|agency_id|account_id` returns **zero** tenancy keys. Built for a **single implicit owner** (WMI).
- ⚠️ Red herring: `clients.auth0_user_id` (line 44) exists but is **dead code** — zero references in `src`. A vestigial hook for future client login (clients today use unauthenticated links), **not** a tenant key.

**1.2 N/A** — no owner key exists on any table.

**1.3 Adding tenancy touches all 5 tables; it's a cascade, not a column-add.** `clients` is root; the other four (`onboarding_state`, `activity_log`, `ads_report_cache`, `weekly_reports`) all FK to `clients(id)` via `client_id ON DELETE CASCADE`. Schema-level it's "new `agencies` table + `agency_id` on `clients`", children inheriting tenancy one hop via `client_id`. **But** every query selects with no tenant filter, and RLS needs `agency_id` denormalised onto each child or joined through `clients`. → Column-add at the schema layer, **cascade at the query + RLS + policy layer.**

**1.4 RLS is ON with ZERO policies.** The schema file defines no RLS; it was enabled at deploy via Supabase's "Run and enable RLS" (enables RLS, creates no policies). Net effect today: the **server's secret key bypasses RLS**, the anon/publishable key is fully blocked → **no row-level enforcement**; isolation rests on "only the server touches the DB." Clean multi-tenant RLS needs a **tenant column first** (doesn't exist), **then** policies, **and** the app must stop using the bypass-everything secret key for tenant-scoped reads. **RLS requires schema changes first.**

## 2. Auth model

- **2.1** Auth0 (`@auth0/nextjs-auth0` v4), session via the `proxy.ts` middleware.
- **2.2 No org/account boundary.** Single binary role `agency_admin | client` (`src/lib/auth/roles.ts`), checked by `requireAgencyAdmin()` (`src/lib/auth/guard.ts:10`) with no tenant scope. WMI *is* the one agency. Clients never authenticate — onboarding is unauthenticated, link-driven (`/onboarding/[id]`, clientId from URL). **Single-org by assumption.**
- **2.3 Google creds are ENV-only, one set (WMI's).** `GOOGLE_ADS_CLIENT_ID/_SECRET/_REFRESH_TOKEN/_LOGIN_CUSTOMER_ID`, read only in `google-ads/index.ts`. **No DB structure holds tokens** — nothing in the schema for per-tenant OAuth/refresh-token storage. Multi-tenant token storage is **entirely net-new** (new encrypted per-agency credentials table + resolution).

## 3. Integration seams — confirmed clean

- **3.1 Confirmed.** Each integration reads its config in exactly one module: `process.env.GOOGLE_ADS_*` only in `google-ads/index.ts`; `process.env.STRIPE_*` only in `stripe/index.ts`; likewise slack, pandadoc, supabase (`server.ts`), anthropic. Callers import **functions, never credentials.** Config injection is genuinely centralised per integration.
- **3.2 Google Ads' "one token" lives in a single file.** `google-ads/index.ts`: `getAccessToken()` builds the token from env, `adsHeaders()` adds the env `login-customer-id`, every exported function routes through `adsHeaders()`. The ~6 call sites (cron routes, `clients/actions.ts`, `import/page.tsx`, reporting) pass a **customerId** (which account to query) but **never credentials**. → Per-call tenant tokens = change **one module**, but real work: add a credentials/tenant param to public functions, replace the module-level single `cachedToken` with a per-tenant cache, source tokens from per-tenant storage (doesn't exist). Clean choke point, non-trivial behind it.
- **3.3 Stripe is a re-architecture, not a config flip.** One WMI account, one module. The current model makes **WMI the single merchant** charging the end client (`createCheckoutSessionForClient`). For V4a, each agency bills *their* clients → **Stripe Connect** (or per-agency keys), a different merchant-of-record model. Credential resolution is one module (easy per-tenant); the **billing architecture** (Connect onboarding, payouts, MoR) is net-new.

## 4. n8n / orchestration

**There is no n8n in V4alpha — none.** Grep for `n8n|redis|queue|bullmq` in `src`: zero matches. Orchestration is **Next.js + Vercel cron** (`vercel.json`: daily `google-ads-links`, weekly `weekly-reports`), `CRON_SECRET`-gated, on the single env credential set. n8n belonged to the **excluded AdForge/campaign-builder POC (V4b)** and was never harvested. 4.1/4.2 have no subject here; if V4b revives n8n it's a fresh build inheriting the same single-tenant credential question.

## 5. Provenance

- **5.1 No systematic in-code provenance tagging.** No per-module origin headers ("harvested from MaaS" / "BJ MCC"); origin-marker grep found only incidental comment words, not attribution. What exists: (a) **git history** — WMI-build commits ("MaaS→SaaS briefing", "remove tier bands from the MaaS", subscription-lifecycle…), evolution not origin tags; (b) docs **`v4alpha-extraction-report.md`** / **`v4alpha-harvest-brief.md`** mapping features + real file paths to the source apps.
- **5.2 No mechanical way to separate WMI-original from harvested.** The extraction report is the closest artifact, but provenance must be reconstructed, not read off the code. **If clean provenance matters for flow-back into the SaaS, this is an open gap** — add origin headers / a manifest now while it's fresh.

## 6. The verdict

**"Rebuild the spine, reuse the limbs."** Not a config switch; not a full rewrite.

**Rebuild (net-new foundation):**
- **Tenancy data model** — zero tenant keys; `clients` is an owner-less root. Adding it + real RLS + retiring the secret-key-bypass is foundational.
- **Per-tenant token storage** — no structure exists; env-only single token. From scratch.
- **Auth org boundary** — single role, no tenant scope. New membership/tenant model.
- **Stripe merchant model** — single-merchant → Connect is a re-architecture.

**Reuse (additive, well-positioned):**
- **Integration seams are genuinely clean** (verified: each provider's env vars confined to one file). Single→per-tenant credential *resolution* is contained to one choke point per integration.
- **Onboarding funnel, reporting logic, config pattern, data shapes** port over with tenant-scoping layered on.

**Single driver of the verdict:** there is *no tenancy anywhere in the schema and no per-tenant credential storage anywhere in the code* — exactly what per-tenant OAuth + isolation require, so both are built from zero. Everything V4alpha *did* build (product, funnel, clean seams) is the reusable half.

**Parallel-track note (confirmed):** the **standard-access developer-token application gates the whole workstream regardless** — start it day one, in parallel with the spine build.

---

*V4a Multi-Tenancy Readiness Audit — answered from the V4alpha codebase — 2026-06-21.*

# Handover → Claude Code (PPC Mastery workspace · V4a / V4b)

**Purpose:** technical handover for *implementing* **V4a/V4b** in the PPC Mastery workspace by harvesting the proven **V4alpha** codebase. Companion strategy doc: `HANDOVER_V4ab_CLAUDE_CHAT.md`. Full state of the source build: `V4ALPHA_VALIDATION_REPORT.md`.

> ⚠️ Do **not** edit the V4alpha (WMI) app or the original source apps **in place** — they belong to other parties / are live. Harvest into the V4a/V4b codebase (clean-room), same way V4alpha was harvested.

---

## 1. Stack (verify against the actual repo — don't trust training data)

- **Next.js 16.2.7** (App Router) + **React 19**, TypeScript, Tailwind v4.
- ⚠️ **This is NOT the Next.js in your training data.** Per `AGENTS.md`: read the relevant guide in `node_modules/next/dist/docs/` before writing Next code. Notably: middleware is renamed **`proxy`** (`src/proxy.ts`), route handlers' `context.params` is a **Promise**, dynamic route handlers use `RouteContext`.
- `@supabase/supabase-js`, `@auth0/nextjs-auth0` v4, `stripe`, `@anthropic-ai/sdk`. **No vendor SDKs** for Google Ads / Slack / PandaDoc — all hand-rolled `fetch` (a deliberate, portable pattern).
- Windows dev env: **Node is not on the Bash tool's PATH** — run `node`/`npm`/`npx`/`tsc` via the **PowerShell** tool.

## 2. What ports cleanly from V4alpha (harvest these)

- **Integration seams** — one thin module per provider, the whole app imports functions not SDKs:
  - `src/lib/integrations/google-ads/` — OAuth refresh, `gaqlSearch`, `listManagedAccounts`, `sendLinkInvitation`, reporting. Google Ads API **v24** (REST).
  - `src/lib/integrations/stripe/` — checkout (inline `price_data`, no seeded catalogue), webhook verify, dunning/cancellation lifecycle.
  - `src/lib/integrations/pandadoc/` — template→document, embedded signing, status-check fallback, webhook (`?signature=` HMAC).
  - `src/lib/integrations/slack/` — channel create + invite-by-email + post.
  - `src/lib/integrations/anthropic/narrative.ts` — LLM weekly report (figures computed in data layer, LLM only prose; `claude-opus-4-8`).
  - `src/lib/supabase/server.ts` — single admin client seam.
- **Onboarding funnel** (`src/app/onboarding/[id]/`) — wizard + post-payment home/checklist, dual-path completion (webhook + status-check fallback).
- **Config pattern** (`src/lib/config.ts` `entityConfig`) — per-deployment brand/currency/VAT/legal from env; nothing hardcoded.
- **Data model** (`supabase/migrations/_consolidated_fresh_install.sql`) — `clients`, `onboarding_state`, `activity_log`, `ads_report_cache`, `weekly_reports`.

## 3. The net-new engineering for V4a (the hard part V4alpha skipped)

V4alpha is **single-tenant** — one WMI MCC, one stored Google refresh token, one Stripe/Slack/PandaDoc account, **RLS effectively bypassed** (server uses the secret key). For a **multi-tenant SaaS** you must build, fresh:

- **Tenancy:** a `tenant`/`agency` entity; every table gets `tenant_id`; **real RLS policies** per tenant (V4alpha runs RLS-on-no-policy with a secret key that bypasses it — that does NOT scale to multi-tenant; you need genuine row isolation).
- **Per-agency Google connection:** each agency connects *their own* Google Ads — per-tenant OAuth + a **Google-approved SaaS-privileged / standard-access developer token** (V4alpha used WMI's single token; this approval is the documented blocker for V4a/V4b).
- **Per-tenant secrets/billing:** each agency's Stripe, Slack, e-sign, branding — stored per-tenant (V4alpha read these from one env set via `entityConfig`; multi-tenant means per-row config, not env).
- **Auth:** V4alpha gates on a single `agency_admin` role + claim `https://ppcmastery.app/roles`. Multi-tenant needs tenant-scoped roles/membership.

## 4. Gotchas learned the hard way in V4alpha (save yourself the pain)

- **Consolidated SQL & UTF-8 BOM:** the fresh-install `.sql` kept acquiring a BOM that made Supabase's editor throw `syntax error at or near "﻿"`. Keep SQL files **BOM-free ASCII**.
- **`ALTER TYPE ... ADD VALUE` can't run in a transaction** — don't replay enum-adding migrations into one transactional paste; use a consolidated end-state file, enums defined complete up front.
- **Auth0 roles claim must match EXACTLY** (`src/lib/auth/roles.ts`) or you get a silent "No access" with no error. The post-login Action must stamp the identical claim string.
- **Supabase new `sb_secret_` keys:** work via `@supabase/supabase-js` server-side, but are **rejected on raw REST** calls (`apikey` header) with "Forbidden use of secret API key in browser." Use the client lib, server-only.
- **Webhooks (Stripe / PandaDoc / DocuSign) need a public URL** — can't be tested against `localhost`. V4alpha relies on **status-check fallbacks** on page load for local dev; register real webhooks only against the deployed domain.
- **Env split:** `.env.local` (gitignored) ≠ the host's production env (Vercel dashboard). The host never reads `.env.local`. Live keys belong **only** in the host env, never the local file.
- **Google OAuth in Testing+External → refresh token expires every 7 days.** For production, publish the consent screen (verification needed for the sensitive `adwords` scope) or use **Internal** (Workspace). This bites reporting hard if missed.

## 5. Deploy shape (proven in V4alpha)

GitHub repo → Vercel (auto-deploy `main`) → custom domain via DNS CNAME → SSL auto. Cron via `vercel.json`. Each tenant/app = its own Vercel project + its own data resources (don't co-host with another app's repo).

## 6. First moves suggested

1. Read this repo's actual code for the seams above (don't infer).
2. Stand up the **tenancy model + RLS** first — it's the spine everything else hangs off and the thing V4alpha has no answer for.
3. Solve the **per-agency Google token** path early (it's the documented blocker; everything reporting-related depends on it).
4. Port integration modules, adapting them from "one env config" to "per-tenant config."

*Handover for Claude Code — V4a/V4b — 2026-06-21.*

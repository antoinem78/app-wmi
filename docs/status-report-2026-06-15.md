# PPC Mastery — Full Status Report & MaaS→SaaS Briefing (June 15, 2026)

Self-contained: written so it can be read with **no repo access** — for a
strategy conversation about evolving the MaaS into a SaaS. Supersedes the June 12
status report.

---

## 1. What PPC Mastery is (and is not)

**PPC Mastery** is a **managed PPC service (MaaS)** — a productized, low-touch
way to onboard and run paid-search clients that the founders' agencies couldn't
serve profitably by hand. The **portal** is the software layer: a closed
prospect gets one link and self-serves through onboarding → contract → payment →
Slack → access-grants → live performance dashboard → automated weekly updates,
with **zero staff touches** and an append-only audit log.

**Ownership / entities:**
- Jointly **Antoine + Baptiste (50/50)**. Operates under **adenergy.online**
  (Baptiste's Polish SARL) **trading as PPC Mastery AI**. Google-facing identity
  is **Baptiste Jenard PPC** (ppcmastery.ai, MCC `447-370-6744`).
- **WMI** (Antoine) and **adenergy/BJ PPC** (Baptiste) are the founders' own
  agencies — PPC Mastery's *first users*, not tenants in the app.

**It is single-tenant by design.** The tenant is PPC Mastery itself; every
client is just a **record**. No per-agency attribution, no revenue-split logic —
the founders split at the dividend level, annually, outside the product. Two
roles only: `agency_admin` (founders + ops team) and `client`.

**It is NOT the SaaS.** The SaaS (self-serve, sold to other agencies; a separate
entity, involves a third shareholder) is a *later* evolution. The guiding rule
throughout the build: **"SaaS-portable foundations, zero SaaS features"** — build
the door, don't walk through it.

---

## 2. Bottom line

**The MaaS build is complete (Phases 0–6) and live in production**, and exceeds
the original brief. There is **no outstanding engineering** to run the service.
What remains is (a) a **commercial/access cutover** to flip from test to real
money (3 items, all gated on Baptiste, all config not code), and (b)
deliberately **parked** future phases (connectors, client-OAuth) and SaaS items.

---

## 3. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend/backend | **Next.js 16** (App Router, TS, Tailwind) | one repo |
| Database | **Supabase** (Postgres, EU/Ireland) | service-role key, server-side only; **RLS-ready** but RLS off in v1 |
| Auth | **Auth0** | `agency_admin` / `client` via a role claim; clients use a link, no login |
| Hosting | **Vercel + GitHub** | auto-deploy from `main`; cron jobs |
| Payments | **Stripe** | 1-month rolling subscription; **custom price per client** (ad-hoc, no product catalogue) |
| Contracts | **PandaDoc** | template + embedded signing; webhook + status-check fallback |
| Comms | **Slack** | client channels + weekly report drafts |
| Ads data | **Google Ads API v24** | BJ PPC developer token; reporting + MCC linking |
| LLM | **Anthropic (Claude Opus 4.8)** | weekly report narrative (numbers locked to the data layer; LLM only words them) |

Every integration sits behind a **thin seam** (one module each), with a
webhook + verified-fallback dual path. The SaaS later imports a function, not a
tangle.

---

## 4. Phase scorecard

| Phase | Scope | Status |
|---|---|---|
| 0 | Foundation (scaffold, Supabase, Auth0, deploy) | ✅ |
| 1 | Onboarding wizard | ✅ |
| 2 | PandaDoc contract + Stripe payment | ✅ |
| 3 | Slack channel auto-create/invite | ✅ |
| 4 | Google Ads account linking | ✅ |
| 5 | Client home / checklist (access-grant tasks) | ✅ |
| 6 | Reporting — KPI dashboard + weekly updates | ✅ (+ LLM narrative) |
| 7 | Connectors (GHL sync, full Meta, OAuth connector) | ⏸ parked |

### Built beyond the original roadmap
- **LLM weekly narrative** — 5-section, agency-voice report (Top Converting
  Campaigns / Performance Summary / Optimisations Made / Campaign Insights /
  Forward Plan), generated from verified Ads data + change history; posted as a
  Slack **review draft** with a dashboard link.
- **Subscription lifecycle** — payment-failure dunning (`past_due`),
  31-day-notice cancellation (final renewal still bills), admin cancel/resume.
- **Custom pricing only** — the locked spend-band tiers were removed; every quote
  is bespoke (a custom monthly price). Tiers were a self-serve-SaaS concept.
- **MCC Command Center** — a **reporting-only clone** for an entire agency book
  (see §5), with **bulk "Import from MCC"** (one click imports ~all leaf accounts).
- **Reporting-only clients**, **client delete** (type-DELETE confirm),
  **GMC / Meta / Microsoft Ads** access tasks, **dark-mode field fix**.

---

## 5. The two production deployments (same code, env-config only)

This is the **clones-not-forks** model — the key SaaS-portability proof.

1. **PPC Mastery portal** (`ppcmastery.vercel.app`) — the full funnel. New
   clients onboard end-to-end. `login-customer-id` = the **PPC Mastery sub-MCC**.
2. **BJ PPC MCC Command Center** (`bj-ppc-mcc-command-center.vercel.app`) — a
   **reporting-only** deployment (env flag `PORTAL_REPORTING_ONLY=true`): the
   onboarding funnel is hidden; only *Add managed account* / *Import from MCC* →
   dashboards → weekly reports. `login-customer-id` = the **BJ main MCC**
   (`447-370-6744`, ~129 existing premium accounts). Its own Supabase project;
   reports post to the **Adenergy** Slack workspace.

**Nothing in the code branches on entity** — both apps run identical code,
differing only by environment variables (login MCC, brand, currency, mode flag,
Stripe/PandaDoc/Slack/Anthropic credentials, database). A push to `main`
deploys both. This is exactly the mechanism that becomes multi-tenant later.

---

## 6. Key architecture decisions & hard constraints

1. **Google: no client OAuth in the portal.** Declared to Google in the
   developer-token application. So account linking is: client enters their
   10-digit Google Ads ID → admin approves → backend sends an MCC link
   invitation → **client approves inside the Google Ads UI** (Google requires
   that final step on their turf). Reporting runs on the **leaf** account (a
   linked MCC has no campaigns of its own; we resolve the leaf).
2. **One application-level Google developer token.** Shared across clones (it
   identifies the *application*, not the billing entity). Tenants never get their
   own token — renting access to ours via their MCC *is* the product model
   (à la Optmyzr / Adalysis). **Standing rule:** the token stays inside its
   declared lane (own managed service, no client OAuth) until formally widened
   with Google — which is the **V4 / SaaS gate**.
3. **Billing:** 1-month rolling, billed in advance on the signup anniversary,
   **31 days' cancellation notice** (one final payment always collected). Custom
   price per client (no tier catalogue).
4. **Access grants are guided manual checklist tasks** (client grants our
   team's email to GA4/GTM/GMC/Search Console; Meta = adds our Business Manager
   ID; Microsoft Ads = enters their account number, we link manually). This
   **deliberately avoids** a client-facing OAuth consent screen and Google
   verification — see §9.
5. **RLS-ready schema, RLS off in v1.** Every table is keyed on a client_id (or
   is the clients table). Multi-tenant scoping can be switched on additively.

---

## 7. Data model (summary)

- **`clients`** — the core record: company/contact, status
  (`prospect/onboarding/active/past_due/paused/churned`), `source`
  (`onboarding`/`reporting_only`), custom monthly price, platforms, access-task
  set, Stripe customer/subscription ids, cancellation date, Auth0 user id (null
  until/unless a client logs in — currently they don't).
- **`onboarding_state`** — one row per client: wizard step, contract/payment/
  slack/ad-link statuses, questionnaire JSON, checklist JSON, Google Ads
  customer + resolved reporting id, Microsoft Ads account, assets link.
- **`activity_log`** — append-only audit trail (every transition, every actor).
- **`ads_report_cache`** — cached dashboard payloads (quota protection).
- **`weekly_reports`** — stored weekly report history (incl. the narrative).

13 migrations (0001–0013), applied in both Supabase projects. A consolidated
single-file schema exists for standing up new clones.

---

## 8. Production cutover status (the only non-parked remaining work)

All **config, not code**, and all gated on **Baptiste** (commercial/access):

| # | Item | Status |
|---|---|---|
| 1 | **Stripe live** | Live keys + live webhook (4 events) set. **Only a real test charge (F) remains** — deferred to a founders session. ⚠️ *Do not send a real paying client until F verifies the live loop.* |
| 2 | **PandaDoc production** | Current key is **sandbox** (docs are watermarked `[DEV]`, non-binding). Production API is **sales-gated** ("Request a demo" + paid plan). Contract flow is fully built + works on sandbox. |
| 3 | **`app.ppcmastery.ai` domain** | Blocked on GoDaddy delegate-access (the domain likely lives in Baptiste's GoDaddy account). The app runs fine on `*.vercel.app` meanwhile. |

Also open: **legal review** of the agreement template; minor marketing-site copy
(cancellation 30→31 days) and Stripe display name / Polish VAT treatment.

---

## 9. Parked — deliberately deferred (FUTURE_SAAS)

- **Phase 7 connectors:** GoHighLevel contact sync on client creation; a full
  Meta connector; the **client-OAuth connector model**.
- **Client OAuth for GA4/GTM/GMC/Search Console** — would give one-click
  "Connect" instead of manual grants, **but** needs an External OAuth consent
  screen + Google **verification of sensitive/restricted scopes** (weeks; possible
  paid annual security assessment), and **reverses the declared "no client OAuth"
  posture**. Search Console has no user-management API regardless. → SaaS-era.
- **Multi-account MCC selection UI** (pick which leaves to import from a manager).
- **Full Microsoft Ads API linking** (interim: client enters account number).
- **Per-client Slack channel routing** for weekly drafts (interim: one review
  channel).
- **Auto-archive Slack channel on client delete; ROAS/conversion-value display
  guard** (small polish).

---

## 10. The MaaS → SaaS evolution path (the strategic part)

**Thesis:** WMI and adenergy/BJ PPC are PPC Mastery's first white-label
"clients." Run the platform in-house, perfect it on real clients, then sell the
proven thing to other agencies. **The MaaS earns the SaaS.**

### The instance ladder
- **V1** — PPC Mastery AI: BJ PPC (Poland, USD). **Live.**
- **V2 / V3** — WMI UK (GBP) / WMI UAE clones. **Same codebase, env-config only**
  (their Stripe, PandaDoc, Slack, branding, currency). Not forks. *(The MCC
  Command Center already proves the clone mechanism works.)*
- **V4** — first **external agency tenant** on our platform and our Google token.
  **V4 is the SaaS boundary.**

### What's already SaaS-portable (built right, on purpose)
- Standard stack (Next/Supabase/Stripe/Auth0) — not throwaway tooling.
- Clean, RLS-ready data model (productizing = migrate data, not rewrite).
- Integrations behind seams (import a function, not a tangle).
- **Proven multi-deployment via env config** — two live instances already.
- Auth roles + claim model in place; the `client` role exists for when
  end-clients log in.

### What turns the MaaS into a SaaS (additive, not a rewrite)
1. **Move entity config from env vars → per-tenant DB rows + switch on Supabase
   RLS** (the multi-tenant flip; schema is already RLS-ready).
2. **Tenant self-serve signup + provisioning** (no manual link-send).
3. **Connect-your-own** Stripe / PandaDoc / Slack (credential UI) + branding/
   theming engine.
4. **Plan tiers** enforced at billing + feature-gate layer (tiers come *back*
   here — they're a self-serve concept, which is why they left the MaaS).
5. **Multi-tenant Google OAuth credential isolation** — per-tenant refresh
   tokens; tenants link clients to **their** MCC, not ours. (This is the only
   place client/tenant OAuth returns.)
6. **End-client auth tier** (clients log into their own scoped view).

### The V4 gate (start the paperwork before any tenant code)
- Apply for **Standard access** on the Google developer token (Basic's 15k
  ops/day is one shared bucket).
- **Re-declare the token's use case** with Google (serving third-party agencies
  is materially different; triggers Required Minimum Functionality rules).
- Build **tenant-agency OAuth** + **conduct guardrails** (one token = Google
  holds *us* accountable for every tenant; a tenant's abuse can suspend the
  token and take down all instances). ToS with teeth, retained human approval on
  publishing, abuse monitoring, pricing that reflects platform risk.

### Open strategic questions to chew on with Claude chat
1. **Is the SaaS the same product or a different one?** The portal is an *ops/
   onboarding* layer for a managed service. A self-serve SaaS for agencies might
   be the same thing multi-tenanted — or a thinner "campaign builder" product
   (the separate "AdForge" idea, third shareholder). Which is V4?
2. **Single shared Google token vs tenant-owned tokens** — renting our token is
   simpler for tenants but concentrates risk/quota and compliance on us. At what
   tenant count does that break, and is Standard access enough?
3. **Pricing model shift** — MaaS is bespoke per client; SaaS would need tiered,
   self-serve plans + metering. What's the unit (per agency? per managed client?
   per ad-spend?).
4. **Where the AI goes** — the weekly-narrative LLM layer is the first AI seam.
   The roadmap also imagines AI ops agents in Slack and automated campaign
   management. How much of the "managed" in MaaS becomes "automated" in the SaaS,
   and does that change who the buyer is?
5. **The trust/handover boundary** — Google requires human approval on writes
   today. A SaaS that lets tenants push campaign changes (Optmyzr-class) keeps
   that boundary — how does that shape the product and the liability model?

---

## 11. One-paragraph summary (for pasting up top)

PPC Mastery is a single-tenant managed-PPC ops portal, built Next.js + Supabase
+ Auth0 + Stripe + PandaDoc + Slack + Google Ads API + Claude, live in two
env-configured production deployments (full onboarding portal + a reporting-only
"Command Center" for an existing agency book). Phases 0–6 are complete and
exceeded (subscription lifecycle, custom pricing, LLM weekly reports, bulk MCC
import). It was deliberately built "SaaS-portable, zero SaaS features": clean
RLS-ready schema, integrations behind seams, and a proven clone-by-env-config
model. The only remaining work is a Baptiste-gated commercial cutover (live
Stripe test charge, PandaDoc production plan, custom domain) and explicitly
parked future phases. The MaaS→SaaS path is additive — switch env-config to
per-tenant DB rows + RLS, add self-serve signup, connect-your-own integrations,
tiered plans, and per-tenant Google OAuth — gated behind a Google use-case
re-declaration (the "V4" external-tenant boundary).

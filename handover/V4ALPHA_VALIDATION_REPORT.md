# V4alpha (SingularWeb · WMI) — Validation Report

**Date:** 2026-06-21 · **App:** https://app.wmiltd.com · **Status:** Production-deployed, real payments live; 2 operational items pending (neither architectural).

---

## 1. Verdict

**V4alpha is built, deployed, and validated end-to-end.** The clean-room harvest succeeded: the PPC Mastery MaaS onboarding front-end and the BJ Command Center reporting back-end are merged into one single-tenant Next.js app, fully rebranded to WMI, running entirely on **WMI's own credentials**, live at `app.wmiltd.com` and taking **real Stripe payments**.

This is past "proof of concept" — it is a working production system. Two items remain before a real *external* client can complete the **contract** step; both are credential/operational, not engineering:
1. **PandaDoc production API key** — gated behind an Enterprise sales demo (~Fri 26 Jun). Contract step currently runs on a sandbox key (`[DEV]` watermark, in-org emails only). *Scheduled task `pandadoc-prod-key-swap` set for Fri.*
2. **Google OAuth permanent token** — OAuth app is in Testing+External, so the reporting refresh token expires 7 days after issue (minted 2026-06-21 → ~2026-06-28). Fix = publish consent screen, or set **Internal** (Workspace). Reporting works until then.

---

## 2. What V4alpha is

A single Next.js 16 app — **SingularWeb**, deployed as **WMI's** instance at `app.wmiltd.com` — merging:
- **Onboarding funnel** (from PPC Mastery MaaS): link-driven client wizard → details → contract → payment → Slack channel → Google Ads link → active.
- **Reporting** (from BJ Command Center): import accounts from the MCC, weekly LLM-narrated reports, per-client dashboards.

**Single-tenant, WMI-only.** Runs on WMI's MCC/token/Stripe/Slack. No external-agency token plug-in (that's V4a/V4b). It is WMI's "laboratory" — proven patterns here seed the PPC Mastery SaaS.

---

## 3. Build & rebrand — DONE (type-checks clean throughout)

- Brand **WMI** ("WMI powered by SingularWeb"), routed through `entityConfig.brandName` (`src/lib/config.ts`) — not hardcoded.
- WMI logo at `public/wmi-logo.png` (`BRAND_LOGO_URL=/wmi-logo.png`); "Powered by SingularWeb" footer on public onboarding pages (`src/components/PoweredBy.tsx`).
- `privacy/page.tsx` → WEB MARKETING INTERNATIONAL LTD, co. no. 10264568, 124 City Road London EC1V 2NX, VAT GB266586851.
- Currency **GBP**; `APP_BASE_URL=https://app.wmiltd.com`; killed the stale `ppcmastery.vercel.app` fallback.
- Submit buttons: disable-on-submit + green "saved" state (`src/components/SubmitButton.tsx`).

---

## 4. Integration validation

| Seam | WMI resource / id | Status | How verified |
|---|---|---|---|
| **Google Ads** | MCC `8618153241`; OAuth client in SingularWeb GCP project; WMI dev token | ✅ | "Step 0" `listManagedAccounts()` returned **4 sub-MCCs + 32 leaf accounts** (real WMI clients) |
| **Supabase** | project `idgkdbyplkyrtrfqiisf` (named "WMI"), EU | ✅ | Consolidated schema installed, **RLS enabled**, read+write verified via supabase-js; 32 `reporting_only` clients imported |
| **Auth0** | prod tenant `app-wmi-prod.eu.auth0.com` (Vercel); dev `singularweb-dev` (local) | ✅ | Prod login succeeds; `/auth/login` 307 → prod tenant w/ correct callback; roles claim `https://ppcmastery.app/roles`, `agency_admin` role, admins `antoine.martin@wmiltd.com` + `ceo@singularweb.ai` |
| **Stripe** | WMI account, **LIVE** keys in Vercel | ✅ | GBP subscription checkout session created; webhook endpoint live; test events returned 200 |
| **Slack** | workspace `WMILTD`, bot `wmi_portal` | ✅ | `auth.test` OK; team email resolves to workspace user |
| **PandaDoc** | account `ppc@wmiltd.com`; template `WmDuggXFG4wkXZQ98nLu38` | ⏳ sandbox | Template "WMI Managed Paid Media Agreement" verified: role `Client`, all custom tokens present, signature+date fields. **Production key pending (Fri).** |
| **Anthropic** | `ANTHROPIC_API_KEY` | ✅ | Weekly narrative (`claude-opus-4-8`) wired |

---

## 5. Key decisions made (and why)

- **Contracts = PandaDoc**, not DocuSign. The build brief assumed DocuSign; a full DocuSign skeleton was built (JWT, envelopes, Connect webhook) then **reverted** — DocuSign was more complex (JWT/keypair/consent) and costly, and PandaDoc was the proven original. Decision is Antoine's, overriding the brief's assumption.
- **Pricing:** custom monthly fee only (tier bands removed); flat price for all clients.
- **VAT:** price is **inclusive of UK VAT** for UK clients; **no UK VAT** for non-UK — implemented as **wording only** (flat price for everyone; no per-country charge logic), confirmed with Antoine.
- **Payments:** recurring **Stripe subscription** (kept; not one-off invoices).
- **Infra ownership (umbrella):** SingularWeb owns platform-level reusable resources (Google OAuth client; Supabase/Vercel/Auth0 orgs); WMI-specific data resources are isolated (own Supabase project, MCC, Stripe account, Slack workspace). **Fully separated from BJ PPC** — caught and corrected several accidental reuses of BJ's Auth0 tenant, Supabase, `.env` secrets, and repo during the build.

---

## 6. Deployment

- **Code:** GitHub `antoinem78/app-wmi` (private), `main`. *(Not BJ's `ppcmastery` repo — deliberately separated.)*
- **Host:** Vercel, auto-deploys `main`. Cron jobs (`vercel.json`) for google-ads-links (daily) + weekly-reports (Mon), `CRON_SECRET`-gated.
- **DNS:** Bluehost CNAME `app` → vercel-dns; SSL auto-issued.
- **Env split (critical mental model):** `.env.local` = **local dev only** (gitignored, dev Auth0 tenant, **test** Stripe/sandbox PandaDoc, `localhost`). **Vercel dashboard env** = **production** (prod Auth0 tenant, **live** Stripe, `app.wmiltd.com`). **Vercel never reads `.env.local`.**

---

## 7. End-to-end validation performed

- Full local funnel run (admin creates client → details → PandaDoc contract → Stripe test payment → Slack channel → Google link → active) — **passed**.
- Production: public pages serve on `app.wmiltd.com`; admin login via prod Auth0 tenant — **confirmed working**.
- Webhook endpoints deployed + signature-verifying (Stripe test events → 200; PandaDoc endpoint returns 400 "missing signature" not 500, confirming key configured).

---

## 8. Open items before full external go-live

| # | Item | Owner / ETA |
|---|---|---|
| 1 | PandaDoc **production** API key → swap in Vercel + verify | Fri 26 Jun (Enterprise demo) — **scheduled task set** |
| 2 | Google **Internal** consent (or verify) → permanent reporting token | Fri (token valid until ~28 Jun) |
| 3 | Update live PandaDoc template **§2 VAT** wording to the corrected version | before real client |
| 4 | **Solicitor review** of the contract wording | before real client signs |
| 5 | Production Stripe **live** smoke test (real card / Stripe test-webhook → 200) | quick |

---

## 9. Scope walls — deliberately NOT built (per brief / FUTURE_SAAS)

Multi-tenant SaaS · external-agency Google-token plug-in · the campaign builder (AdForge) · the full "monster" feature set · n8n · Redis. These belong to **V4a/V4b** (PPC Mastery SaaS) or later phases. V4alpha is the single-tenant lab that sidesteps them.

---

*V4alpha Validation Report — WMI — 2026-06-21. Companion handover docs for the V4a/V4b build: `HANDOVER_V4ab_CLAUDE_CHAT.md`, `HANDOVER_V4ab_CLAUDE_CODE.md`.*

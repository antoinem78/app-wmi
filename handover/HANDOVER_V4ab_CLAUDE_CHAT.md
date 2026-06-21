# Handover → Claude Chat (PPC Mastery workspace · V4a / V4b)

**Purpose:** orient a fresh Claude *Chat* session for planning/strategy on **V4a and V4b** in the PPC Mastery workspace. This is the *world & strategy* doc (not code). Its companion `HANDOVER_V4ab_CLAUDE_CODE.md` covers implementation.

**Written from:** the V4alpha (WMI / SingularWeb) build, now live at `app.wmiltd.com`. See `V4ALPHA_VALIDATION_REPORT.md` for that build's full state.

---

## 1. The landscape (three things, don't conflate them)

- **V4alpha (SingularWeb · WMI)** — DONE & LIVE. WMI's own **single-tenant** merged tool (onboarding + reporting), on WMI's credentials, at `app.wmiltd.com`. The "laboratory."
- **V4a** — white-label the ops platform as a **multi-tenant SaaS** (Antoine + Baptiste). Other agencies plug in *their own* Google/Stripe/etc. This is what you'll likely scope here.
- **V4b** — the old **AdForge campaign builder** as a SaaS product (banked POC; was n8n + Postgres + Redis).

**The knowledge loop:** V4alpha is the proving ground. Patterns proven there seed V4a/V4b; PPC Mastery's existing code seeds V4alpha. It runs both ways.

---

## 2. What V4alpha proved (so you can build on it)

- The **full client lifecycle in one app**: acquisition/onboarding **and** management/reporting, merged and working end-to-end on real data.
- Every external dependency behind a **thin, swappable module seam** (Stripe, PandaDoc, Google Ads, Slack, Supabase, Anthropic) — clean provenance, portable.
- A working **single-tenant** onboarding→contract→payment→provisioning→reporting funnel, in production, taking real money.

**So:** the product shape, the funnel, and the integrations are de-risked. You are not starting from zero.

## 3. What V4alpha did NOT prove — and it's the crux of V4a

V4alpha is **single-tenant by design**. It deliberately sidesteps the hardest part of V4a/V4b:

> **Multi-tenancy and the SaaS-privileged Google token.** Letting external agencies connect *their own* Google Ads accounts/MCCs requires a Google-approved SaaS OAuth setup (a privileged token / standard-access developer token + per-tenant OAuth), tenant data isolation, per-tenant billing, and per-tenant secrets. **V4alpha never solved this** — it runs on WMI's single MCC/token. This is the **net-new, genuinely unproven engineering** for V4a.

Treat the multi-tenant token model as the central design problem of V4a, not a detail.

---

## 4. Decisions from V4alpha worth carrying (revisit per-context)

- **Contracts:** V4alpha uses **PandaDoc** (DocuSign was evaluated and dropped — more complex + costly; production API is Enterprise/sales-gated). For a SaaS, e-sign is per-tenant — revisit.
- **Pricing/VAT:** V4alpha = custom flat monthly fee, VAT-inclusive (UK) / none (non-UK) as wording only. A multi-tenant SaaS needs real per-tenant tax/billing (Stripe Tax, etc.) — net-new.
- **Stripe:** recurring subscription model (kept over one-off invoices).
- **Infra separation discipline:** V4alpha was rigorous about *not* reusing BJ PPC's accounts (Auth0, Supabase, Stripe, repo, secrets). Carry that discipline — keep tenant/owner resources cleanly separated.

## 5. IP provenance — flag, not a blocker

V4alpha harvested from **two parties' code**: PPC Mastery MaaS (Antoine + Baptiste) and BJ PPC Command Center (Baptiste Jénard MCC). When polished V4alpha code flows into the PPC Mastery SaaS (V4a/V4b), "**whose code is whose**" must be answerable cleanly — especially if any EU grant leans on "PPC Mastery owns all its IP." Keep structure clean and provenance traceable. (From the build brief — record-keeping discipline.)

## 6. Guardrails

The campaign builder, the full SingularWeb "monster," and multi-tenant SaaS were **excluded** from V4alpha on purpose (see `FUTURE_SAAS.md` in the WMI repo). V4a/V4b are exactly those parked items — so here they're *in scope*, but scope them deliberately and phase them.

---

## 7. How to work here

Anchor each session: *"We're building V4a/V4b (PPC Mastery SaaS) in the PPC Mastery workspace. V4alpha (WMI) is the proven single-tenant lab; I'm harvesting its patterns. The new problem is multi-tenancy + the SaaS-privileged Google token."* Confirm scope before building; don't pull V4alpha's single-tenant shortcuts into a multi-tenant context without redesign.

*Handover for Claude Chat — V4a/V4b — 2026-06-21.*

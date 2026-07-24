# FZCO portal clone — provisioning checklist (Phase B)

Target: app.webmarketinginternational.com = clone of the app.wmiltd.com portal for
Web Marketing International FZCO, with the self-hosted proposal engine
(proposals.webmarketinginternational.com) replacing PandaDoc, ahead of Stripe checkout.

Phase A (done): engine live + webhooks signed; portal has a CONTRACT_PROVIDER
switch (unset = PandaDoc, unchanged on wmiltd; `proposal-engine` on this clone).

## 1. Vercel
- New project from this same repo (separate project, own env set).
- Do NOT set a production domain yet — DNS is on Cloudflare and gets pointed in Phase C.

## 2. Supabase
- New project (any region close to UAE, e.g. Frankfurt).
- Schema: paste the CONTENTS of `supabase/migrations/_consolidated_fresh_install.sql`
  into the project's SQL Editor and Run, THEN run migrations 0014–0020 on top in
  numeric order (the consolidated file only covers 0001–0013). Ask Claude for the
  single combined script that does all of it in one paste.

## 3. Auth0 (new account for Web Marketing International)
- Create tenant → Applications → new "Regular Web Application".
- Allowed Callback URLs: `https://app.webmarketinginternational.com/auth/callback` (+ `http://localhost:3000/auth/callback` for local).
- Allowed Logout URLs: `https://app.webmarketinginternational.com` (+ localhost).
- IMPORTANT: roles come from a namespaced custom claim (Auth0 requires a
  URL-shaped string as the key — it is never fetched). This deployment uses its
  own namespace via the `AUTH0_ROLES_CLAIM` env var (see table below). Add a
  post-login Action in the new tenant with the SAME string:

  ```js
  exports.onExecutePostLogin = async (event, api) => {
    const roles = event.user.app_metadata?.roles ?? [];
    api.idToken.setCustomClaim("https://webmarketinginternational.com/roles", roles);
  };
  ```

  Then set `app_metadata.roles = ["agency_admin"]` on Antoine's user
  (Users → your user → App Metadata: `{ "roles": ["agency_admin"] }`).

## 4. Stripe (FZCO account)
- TEST-mode keys first. Webhook endpoint (add after first deploy):
  `https://app.webmarketinginternational.com/api/webhooks/stripe`
  Events: checkout.session.completed, invoice.paid, invoice.payment_failed,
  customer.subscription.deleted.

## 5. Vercel env vars (paste in the Vercel project → Settings → Environment Variables)
Everything from `.env.example`, with these FZCO-specific values:

| Var | Value |
|---|---|
| ENTITY_LEGAL_NAME | Web Marketing International FZCO (exact legal name) |
| BRAND_NAME | Web Marketing International (or preferred short brand) |
| CURRENCY | USD |
| VAT_RATE / VAT_NUMBER | as applicable for the FZCO |
| CONTRACT_PROVIDER | proposal-engine |
| PROPOSAL_ENGINE_URL | https://proposals.webmarketinginternational.com |
| PROPOSAL_ENGINE_API_TOKEN | in `proposal-engine/.dev.vars` (API_TOKEN) |
| PROPOSAL_ENGINE_WEBHOOK_SECRET | in `proposal-engine/.dev.vars` (WEBHOOK_SECRET) |
| PANDADOC_* | leave empty (not used on this deployment) |
| APP_BASE_URL | https://app.webmarketinginternational.com |
| AUTH0_* | from the new tenant (AUTH0_SECRET: `openssl rand -hex 32`) |
| AUTH0_ROLES_CLAIM | https://webmarketinginternational.com/roles (must match the post-login Action) |
| STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET | FZCO test keys |
| SUPABASE_URL / SUPABASE_SECRET_KEY | new project |
| GOOGLE_ADS_* | leave empty for launch (deferrable) |
| SLACK_* / ANTHROPIC_API_KEY | optional |
| CRON_SECRET | any long random string |

## Phase C (Claude, after the above)
1. Set the engine's `WEBHOOK_URL` secret to `https://app.webmarketinginternational.com/api/webhooks/proposal-engine`.
2. Point DNS: edit the `app` record in Cloudflare (currently a placeholder A 192.0.2.1)
   to CNAME `cname.vercel-dns.com`, DNS only; add the domain to the Vercel project.
3. Branding pass: swap `src/lib/audit/assets/wmi-logo.png`, review `PoweredBy.tsx`.
4. E2E test: create test client → onboarding link → details → proposal generates +
   embeds → accept → advances to payment → Stripe TEST checkout → paid state.
5. Commit Phase A + branding changes (not yet committed as of 2026-07-09).

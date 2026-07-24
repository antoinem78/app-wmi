# PandaDoc Replacement Blueprint — PPC Mastery

Single-file handover: complete tested codebase + deployment brief + integration
guide to replace PandaDoc in a PPC Mastery portal deployment. Written 2026-07-12
after the same stack went live for Web Marketing International FZCO
(portal: app.webmarketinginternational.com, engine: proposals.webmarketinginternational.com).

Instructions for Claude Code (or any agent) in the target workspace: recreate
every file in the FILES section below verbatim (exact contents, exact paths) in
a fresh directory called `proposal-engine`. Do not modify, reformat, or improve
any file while writing it. Verify each file's SHA-256. Then:

1. `npm install`
2. `npm test` — output must end with `All 19 checks passed.` If not, the files
   were not written verbatim; diff and fix before anything else.
   (Windows note: the harness writes debug HTML to `/tmp`; create `C:\tmp` first.)
3. Execute the DEPLOYMENT BRIEF section top to bottom.

---

## 1. What this is (handover)

A self-hosted PandaDoc replacement in two parts:

**Part A — the engine** (this file's FILES section): a Cloudflare Worker + D1
(SQLite) app. Creates agreements/proposals from JSON via a token-protected API,
serves each at an unguessable URL with a print-ready design, tracks opens /
per-section reading time / scroll depth, records click-wrap acceptance (typed
name + authority checkbox + timestamp + IP + user agent + SHA-256 of the exact
document content), and fires HMAC-signed webhooks (proposal.viewed,
proposal.pricing_viewed, proposal.accepted). Free tier, nothing to maintain.
Admin dashboard at /admin (token entered in browser).

**Part B — the portal integration** (ALREADY COMMITTED to the shared portal
repo, main branch, commits a289557 + 360349d): the portal has a
`CONTRACT_PROVIDER` env switch. Unset = PandaDoc (unchanged). Set
`CONTRACT_PROVIDER=proposal-engine` and the contract step of onboarding uses
the engine instead: agreement auto-generated at the contract step, embedded in
the same iframe slot, acceptance detected via signed webhook + polling
fallback, then the client advances to Stripe checkout exactly as before.

Portal files (for reference; already in the repo):
- `src/lib/integrations/contracts/index.ts` — provider facade (all call sites import from here)
- `src/lib/integrations/proposal-engine/index.ts` — adapter: builds the
  "Managed Paid Search Services Agreement" (clauses 1-11 of the WMI PandaDoc
  template) from client + quote + entity env config; maps engine statuses to
  PandaDoc vocabulary; the "signing session" is the proposal URL (permanent,
  iframe-embeddable)
- `src/app/api/webhooks/proposal-engine/route.ts` — HMAC-verified acceptance
  webhook; finds the client via onboarding_state.pandadoc_document_id (that
  column stores whichever provider's document id the deployment uses)

**Signature posture (important, be honest with yourself):** acceptance is
click-wrap — a simple electronic signature, same legal category as PandaDoc's
standard e-sign, with a strong evidence trail (name, authority confirmation,
timestamp, IP, UA, content hash, full read-tracking). It is NOT a qualified
e-signature. Owner's stated direction: for higher-stakes contracts, add a
dedicated signature layer later (Documenso self-hosted preferred, or
SignWell/Dropbox Sign API) as a third CONTRACT_PROVIDER. Park until needed.

## 2. Deployment brief (execute top to bottom)

Decisions to confirm with the owner BEFORE starting:
- Which Cloudflare account hosts the PPC Mastery engine (per-entity account
  separation is the house model — do not silently reuse another entity's account).
- The engine hostname (pattern: proposals.<entity-domain>). The zone must be in
  that Cloudflare account. If the entity domain's DNS is NOT yet on Cloudflare,
  either add the zone (nameserver cutover — snapshot ALL DNS records first,
  import them DNS-only, verify MX/SPF/DKIM survive) or use workers.dev.
- PPC Mastery currently uses PandaDoc: flipping CONTRACT_PROVIDER switches NEW
  onboarding clients to the engine. In-flight clients holding a PandaDoc
  document id will break mid-flow if flipped — flip during a quiet window or
  regenerate their contracts.

Steps:
1. `npm install && npm test` (19 checks) in the recreated proposal-engine dir.
2. `npx wrangler login` (browser approval) or CLOUDFLARE_API_TOKEN; `npx wrangler whoami` to confirm the right account.
3. `npx wrangler d1 create proposal-engine` → paste the printed database_id into wrangler.jsonc (REPLACE_AFTER_D1_CREATE).
4. `npm run db:schema`, then verify:
   `npx wrangler d1 execute proposal-engine --remote --command "SELECT name FROM sqlite_master WHERE type='table'"`
   must list `proposals` and `events`.
5. Generate TWO strong random secrets (32+ bytes hex): API_TOKEN and WEBHOOK_SECRET.
   ⚠️ On Windows, NEVER pipe secrets into `wrangler secret put` from PowerShell —
   the pipe appends CRLF and silently corrupts the value (symptom: correct token
   gets 401). Use `wrangler secret bulk <file>.json` with a JSON file instead,
   then delete the file. Keep local copies in `.dev.vars` (gitignored).
6. First deploy: set APP_URL in wrangler.jsonc to the workers.dev URL, keep the
   `routes` line commented, `npm run deploy`. If the account has no workers.dev
   subdomain, register one: PUT
   https://api.cloudflare.com/client/v4/accounts/{account_id}/workers/subdomain
   {"subdomain":"<name>"}. Fresh subdomains need a few minutes for TLS.
7. Custom domain — use the ROUTE + DNS-RECORD pattern, NOT wrangler's
   `custom_domain: true`. (The custom-domain feature silently failed to serve
   DNS for the FZCO zone: record visible in the dashboard, authoritative NS
   returned NODATA. The pattern below is deterministic.)
   a. In the zone: add A record, name `proposals`, IPv4 `192.0.2.1`
      (placeholder, never reached), **Proxied ON**.
   b. wrangler.jsonc: `"routes": [{ "pattern": "proposals.<domain>/*", "zone_name": "<domain>" }]`
      and APP_URL `https://proposals.<domain>`; `npm run deploy`.
   c. Verify: `curl https://proposals.<domain>/admin` → 200. If DNS looks
      stale, purge the public resolver: POST
      https://1.1.1.1/api/v1/purge?domain=proposals.<domain>&type=A
8. Live verification (against reality, not this doc):
   - POST /api/proposals with a wrong bearer token → 401.
   - Create a proposal from examples/sample-proposal.json → 201 + URL; open the
     URL → full page renders; then
     `npx wrangler d1 execute proposal-engine --remote --command "SELECT type FROM events ORDER BY id DESC LIMIT 3"`
     shows a `view` row.
9. Portal wiring (the code is already in the repo; this is env only). In the
   PPC Mastery Vercel project add / update, then REDEPLOY (env changes never
   apply without a redeploy):
   - CONTRACT_PROVIDER=proposal-engine
   - PROPOSAL_ENGINE_URL=https://proposals.<domain>
   - PROPOSAL_ENGINE_API_TOKEN=<the API_TOKEN secret>
   - PROPOSAL_ENGINE_WEBHOOK_SECRET=<the WEBHOOK_SECRET secret>
   - ENTITY_REGISTRATION_INFO=<entity's registration sentence for the agreement preamble>
   - AGREEMENT_GOVERNING_LAW=<owner's choice; code default is "England and Wales">
   - PRIVACY_URL=<optional; defaults to APP_BASE_URL + /privacy>
   Then set the engine's webhook target:
   `wrangler secret bulk` with {"WEBHOOK_URL":"https://<portal-domain>/api/webhooks/proposal-engine"}
10. End-to-end test with a throwaway client: admin creates client (with a
    monthly price) → open onboarding link → confirm details → contract step
    auto-generates the agreement and embeds it → accept with a typed name →
    webhook flips the client to the payment step (verify in the admin), and
    the engine admin (/admin) shows the accepted proposal with reading stats.
    Also verify the failure path: POST to the portal webhook with a bad
    X-Signature → 400.
11. Report a ledger: done+verified, open items, and exact values the owner
    must store (engine URL, admin URL, API token, webhook secret).

## 3. Gotchas ledger (every one of these cost real time)

- **PowerShell pipe corrupts secrets** (CRLF) → `wrangler secret bulk` from a JSON file, always.
- **Windows + the test harness**: create `C:\tmp` or the suite crashes at check 4.
- **wrangler custom domains**: attach can succeed (cert issued, dashboard shows
  the record) while authoritative DNS serves nothing. Use proxied placeholder A
  + zone route instead.
- **New workers.dev subdomains / new zones**: TLS certs take minutes; 000/SSL
  errors right after deploy are usually just provisioning.
- **Resolver caching after NS changes**: public resolvers hold the old
  delegation for hours (up to 48h). 1.1.1.1 has a public purge API
  (https://1.1.1.1/api/v1/purge?domain=X&type=Y). A local router can hijack
  port 53 and serve stale answers for everything — verify via DoH
  (https://1.1.1.1/dns-query?name=X&type=A, accept: application/dns-json)
  before believing any nslookup.
- **Supabase consolidated migration lies**: `_consolidated_fresh_install.sql`'s
  header says 0001-0013 but it actually includes through 0016. For a fresh
  clone DB run it + migrations 0017-0020 only. (Not needed for PPC Mastery's
  existing DB — it already has all migrations.)
- **Auth0 roles claim**: the claim namespace is env-configurable
  (AUTH0_ROLES_CLAIM); it must match the tenant's post-login Action string
  character-for-character, and roles come from the user's app_metadata
  (`{ "roles": ["agency_admin"] }`). "Actions Execution Failed — '' is not a
  function" in the Auth0 log = the Action editor content isn't exactly
  `exports.onExecutePostLogin = async (event, api) => {...}`. Actions must be
  DEPLOYED and attached to the post-login trigger flow.
- **Vercel env changes require a redeploy.** Every time.
- **Engine wording changes** apply to NEW documents only — generated
  agreements keep the exact text that was accepted (by design; the acceptance
  hash seals it).

## 4. Data contract and API (engine)

See README.md in the FILES section for the full API reference, webhook payload
shape, and n8n wiring examples. Webhooks: when WEBHOOK_SECRET is set the raw
JSON body is HMAC-SHA256-signed, hex digest in the `X-Signature` header; the
`proposal.accepted` payload's `meta` includes `name`, `ip`, and `doc_sha256`
(hash of the stored document JSON at acceptance).

---

# FILES (recreate verbatim in ./proposal-engine)


## FILE: .gitignore

SHA-256: `80e5f9c8cdd380540126cfa2e8991eb595a02c1d0c6252071c90527da485fab9`

````text
node_modules/
.wrangler/
.dev.vars
nohup.out
````


## FILE: README.md

SHA-256: `16f178bad5942845162ca098c3964472b832181099a454f45889b2f883b6bdf0`

````markdown
# Proposal Engine

Self-hosted alternative to PandaDoc for proposal generation, delivery, engagement tracking, and acceptance. Runs on Cloudflare Workers with D1 (SQLite), so it fits in Cloudflare's free tier with nothing else to maintain.

What it does:

- Creates proposals from JSON merge data via a token-protected API (callable from n8n, GHL, or curl)
- Serves each proposal at an unguessable URL with a polished, print-ready document design
- Tracks opens, per-section reading time, scroll depth, and pricing views
- Records acceptance (typed name, checkbox, timestamp, IP) and flips the proposal status
- Fires webhooks to n8n on first view, first pricing view, and acceptance
- Ships a minimal admin dashboard at `/admin` with engagement stats per proposal

What it deliberately does not do: qualified electronic signatures. The acceptance flow here is a click-wrap record (name, timestamp, IP, user agent), which is fine for service proposals and statements of work. For contracts where you want a court-grade signature trail (ESIGN, eIDAS), send the accepted client to a dedicated signing step. Documenso is open source and self-hostable if you want to stay off SaaS entirely.

## Deploy (about 10 minutes)

Prerequisites: a Cloudflare account and Node 18+.

```bash
npm install

# 1. Create the database, then copy the printed database_id
#    into wrangler.jsonc (replacing REPLACE_AFTER_D1_CREATE)
npx wrangler d1 create proposal-engine

# 2. Apply the schema to the remote database
npm run db:schema

# 3. Set your secrets
npx wrangler secret put API_TOKEN      # any long random string, this protects /api/*
npx wrangler secret put WEBHOOK_URL    # optional, your n8n webhook URL

# 4. Deploy
npm run deploy
```

After the first deploy, set `APP_URL` in `wrangler.jsonc` to your workers.dev URL (or a custom domain like `docs.singularweb.ai` added via the Cloudflare dashboard) and deploy again. `APP_URL` is only used to build the links returned by the API.

Local development:

```bash
npm run db:schema:local
echo 'API_TOKEN=dev-secret-token' > .dev.vars
npm run dev        # http://localhost:8787
npm test           # runs the full end-to-end suite in Node, no server needed
```

## Creating a proposal

`POST /api/proposals` with `Authorization: Bearer <API_TOKEN>`:

```json
{
  "expires_at": "2026-07-31",
  "data": {
    "brand":       { "name": "SingularWeb", "accent": "#2733C9", "website": "singularweb.ai" },
    "proposal":    { "title": "Google Ads Growth Engine", "number": "SW-2026-014", "valid_until": "2026-07-31", "currency": "USD" },
    "client":      { "name": "Sarah Chen", "company": "Meridian Dental Group", "email": "sarah@example.com" },
    "prepared_by": { "name": "Antoine Martin", "title": "Performance Marketing Lead", "email": "antoine@singularweb.ai" },
    "intro":       "Plain text. Blank lines become paragraphs.",
    "goals":       ["First objective", "Second objective"],
    "scope": [
      { "title": "Work stream", "description": "What it covers.", "deliverables": ["Item one", "Item two"] }
    ],
    "timeline": [
      { "phase": "Week 1", "title": "Phase name", "description": "What happens." }
    ],
    "pricing": {
      "items": [
        { "label": "Setup", "detail": "One-time", "amount": 2400, "period": "once" },
        { "label": "Management", "detail": "Cancel with 30 days notice", "amount": 1200, "period": "monthly" },
        { "label": "Ad spend", "detail": "Paid directly to Google", "amount": "Billed by Google" }
      ],
      "notes": "Optional small print under the table."
    },
    "terms": ["Term one.", "Term two."],
    "accept": { "enabled": true, "button": "Accept proposal", "note": "Optional lede above the form." }
  }
}
```

Response: `{ "id": "...", "slug": "...", "url": "https://your-domain/p/<slug>" }`. Send that URL to the client.

Notes on the data contract:

- Every section is optional. Sections with no data simply do not render, and the side navigation adjusts.
- `brand.accent` sets the accent color per proposal, so you can match a client's brand or run different colors for SingularWeb, DentalMastery, and so on.
- Numeric pricing amounts with `period` of `once` or `monthly` are summed into totals automatically. String amounts (like a percentage of ad spend) display as-is and are excluded from totals.
- `currency` accepts any ISO code (USD, EUR, AED, GBP).
- All merge values are HTML-escaped, so client-supplied text cannot inject markup.
- `expires_at` (or `proposal.valid_until` as fallback) shows a validity date, then an expired banner past that date, and blocks acceptance with HTTP 410.

## API reference

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/proposals` | Bearer | Create a proposal, returns the shareable URL |
| GET | `/api/proposals?limit=50` | Bearer | List proposals with status, views, last activity |
| GET | `/api/proposals/:id` | Bearer | Full detail: event timeline plus per-section reading time (accepts id or slug) |
| POST | `/api/proposals/:id/status` | Bearer | Manually set status (`declined`, `expired`, and so on) to void a link |
| GET | `/admin` | Token entered in browser | Read-only dashboard |
| GET | `/p/:slug` | Public (unguessable) | The proposal page |
| POST | `/p/:slug/e` | Public | Tracking beacon (used by the page itself) |
| POST | `/p/:slug/accept` | Public | Acceptance endpoint (used by the page itself) |

## Webhooks to n8n

If `WEBHOOK_URL` is set, the worker POSTs JSON on three events:

- `proposal.viewed` (first open only)
- `proposal.pricing_viewed` (first time the investment section is seen)
- `proposal.accepted`

Payload shape:

```json
{
  "event": "proposal.accepted",
  "at": "2026-07-08T09:30:00.000Z",
  "proposal": {
    "id": "...", "slug": "...", "url": "...", "status": "accepted",
    "title": "...", "number": "SW-2026-014",
    "client_name": "Sarah Chen", "client_company": "Meridian Dental Group", "client_email": "sarah@example.com"
  },
  "meta": { "name": "Sarah Chen", "ip": "..." }
}
```

Typical n8n flow: Webhook trigger, then a Switch on `event`, then GHL contact update, Slack or WhatsApp notification, and invoice creation on `proposal.accepted`. See `examples/` for a create-proposal HTTP node config.

## Tracking details

The proposal page embeds a small script (no cookies, no third-party requests) that reports:

- `section_view`: first time each section is at least 35 percent visible
- `section_time`: accumulated seconds per section, flushed when the tab hides or closes
- `pricing_viewed`: first sight of the investment section
- `scroll_depth`: 25, 50, 75, 100 percent milestones
- `pdf_download`: clicks on the Download as PDF button (which uses the print stylesheet)

The `/api/proposals/:id` endpoint aggregates reading time per section across all visits, which is the closest thing to knowing what a prospect actually cared about.

## Extending

- New templates: add a file in `src/templates/`, register it in the `TEMPLATES` map in `src/index.js`, and pass `"template": "yourname"` on create.
- True PDF generation server-side would need Cloudflare Browser Rendering (paid) or an external renderer; the print stylesheet covers the common case.
- Rate limiting is not implemented in v1. The public endpoints validate slugs and event types, and slugs are 14 characters of high-entropy alphabet, but if a proposal link leaks you can void it via the status endpoint.
````


## FILE: package.json

SHA-256: `339321235c846bbb682f4140fe52815c51faebfca616d9c7c00111a1813b41e1`

````json
{
  "name": "proposal-engine",
  "version": "1.0.0",
  "description": "Self-hosted proposal generation, tracking, and acceptance engine (Cloudflare Workers + D1)",
  "type": "module",
  "private": true,
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "test": "node --no-warnings test/harness.mjs",
    "db:schema": "wrangler d1 execute proposal-engine --remote --file=schema.sql",
    "db:schema:local": "wrangler d1 execute proposal-engine --local --file=schema.sql"
  },
  "dependencies": {
    "hono": "^4.0.0"
  },
  "devDependencies": {
    "wrangler": "^4.0.0"
  }
}
````


## FILE: schema.sql

SHA-256: `195e09a46ede5e7d77d54bea012fb57c51d8dd34c4f6b31b873096c42137a804`

````sql
-- Proposal engine schema (D1 / SQLite)

CREATE TABLE IF NOT EXISTS proposals (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  template TEXT NOT NULL DEFAULT 'proposal',
  data TEXT NOT NULL,                                -- JSON merge data
  status TEXT NOT NULL DEFAULT 'sent',               -- sent | viewed | accepted | declined | expired
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  first_viewed_at TEXT,
  accepted_at TEXT,
  accepted_name TEXT,
  accepted_ip TEXT,
  expires_at TEXT                                    -- ISO date, optional
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  proposal_id TEXT NOT NULL,
  type TEXT NOT NULL,                                -- view | section_view | section_time | pricing_viewed | scroll_depth | pdf_download | accepted
  meta TEXT,                                         -- JSON
  ip TEXT,
  ua TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_events_proposal ON events (proposal_id, created_at);
CREATE INDEX IF NOT EXISTS idx_events_type ON events (proposal_id, type);
````


## FILE: wrangler.jsonc

SHA-256: `d09fd9cda2cc46f14281fb60f17928e76af1d52ef4f748dac57c6869a21d99bb`

````jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "proposal-engine",
  "main": "src/index.js",
  "compatibility_date": "2026-06-01",
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "proposal-engine",
      // Replace with the real ID printed by: npx wrangler d1 create proposal-engine
      "database_id": "REPLACE_AFTER_D1_CREATE"
    }
  ],
  "vars": {
    // Public base URL used to build proposal links returned by the API.
    // First deploy: the workers.dev URL. Then the custom domain, e.g.
    // https://proposals.<entity-domain>
    "APP_URL": "REPLACE_AFTER_FIRST_DEPLOY"
  }
  // Custom domain via zone route (see DEPLOYMENT BRIEF step 7 — do NOT use
  // custom_domain:true; use a proxied placeholder A record + this route):
  // ,"routes": [{ "pattern": "proposals.<entity-domain>/*", "zone_name": "<entity-domain>" }]
  //
  // Secrets (set via: npx wrangler secret bulk <file>.json — never pipe on Windows):
  //   API_TOKEN       required, protects /api/* and /admin
  //   WEBHOOK_SECRET  recommended, HMAC-signs outgoing webhooks (X-Signature)
  //   WEBHOOK_URL     optional, receiver for proposal events (portal webhook or n8n)
}
````


## FILE: examples/create-proposal.sh

SHA-256: `b8bd16266806551a39f808de242d97d81d7a1cf0de0316d768b1175efd13f9b4`

````bash
#!/usr/bin/env bash
# Create a proposal from sample-proposal.json.
# Usage: API_TOKEN=xxx APP_URL=https://your-worker.workers.dev ./create-proposal.sh
set -euo pipefail
curl -s -X POST "${APP_URL:-http://localhost:8787}/api/proposals" \
  -H "authorization: Bearer ${API_TOKEN:?set API_TOKEN}" \
  -H "content-type: application/json" \
  --data @"$(dirname "$0")/sample-proposal.json"
echo
````


## FILE: examples/n8n-integration.md

SHA-256: `adf6fa45fd4abf6005b1c10a016e3d7e686d74125e6543bdbfc2d5d634c541b6`

````markdown
# n8n integration

## Creating a proposal (HTTP Request node)

- Method: POST
- URL: `https://app.wmiltd.com/api/proposals`
- Authentication: Generic Credential Type, Header Auth
  - Name: `Authorization`
  - Value: `Bearer YOUR_API_TOKEN`
- Body Content Type: JSON
- Body: map your GHL or CRM fields into the data contract, for example:

```json
{
  "expires_at": "={{ $now.plus({ days: 14 }).toISODate() }}",
  "data": {
    "brand": { "name": "SingularWeb", "accent": "#2733C9", "website": "singularweb.ai" },
    "proposal": {
      "title": "={{ $json.service_name }} for {{ $json.company }}",
      "number": "SW-{{ $now.toFormat('yyyy') }}-{{ $json.deal_id }}",
      "valid_until": "={{ $now.plus({ days: 14 }).toISODate() }}",
      "currency": "USD"
    },
    "client": {
      "name": "={{ $json.contact_name }}",
      "company": "={{ $json.company }}",
      "email": "={{ $json.email }}"
    },
    "prepared_by": { "name": "Antoine Martin", "email": "antoine@singularweb.ai" }
  }
}
```

The response contains `url`. Store it on the GHL opportunity and send it in your email or WhatsApp step.

## Receiving events (Webhook trigger node)

1. Add a Webhook node (POST), copy its production URL.
2. Set it as the worker secret: `npx wrangler secret put WEBHOOK_URL`
3. Add a Switch node on `{{ $json.body.event }}`:
   - `proposal.viewed`: notify yourself, start a follow-up timer
   - `proposal.pricing_viewed`: high-intent signal, good trigger for a same-day follow-up
   - `proposal.accepted`: update the GHL pipeline stage, create the invoice, send onboarding

Client identity for routing is in `body.proposal.client_email` and `body.proposal.client_company`.
````


## FILE: examples/sample-proposal.json

SHA-256: `6940345cd6f8172bda12393443d84e0374501bdf1fe2f615b2ea49b8528d84bf`

````json
{
  "expires_at": "2026-07-31",
  "data": {
    "brand": {
      "name": "WMI",
      "accent": "#2733C9",
      "website": "wmiltd.com"
    },
    "proposal": {
      "title": "Google Ads Growth Engine for Meridian Dental",
      "number": "WMI-2026-014",
      "valid_until": "2026-07-31",
      "currency": "USD"
    },
    "client": {
      "name": "Sarah Chen",
      "company": "Meridian Dental Group",
      "email": "sarah@meridiandental.com"
    },
    "prepared_by": {
      "name": "Antoine Martin",
      "title": "Managing Director",
      "email": "antoine@wmiltd.com"
    },
    "intro": "Meridian Dental Group is spending on Google Ads without visibility into which clicks become booked patients. This proposal covers a full rebuild of your tracking foundation, a restructured Google Ads account, and ongoing management tied to cost per booked appointment rather than cost per click.\n\nEverything below is scoped for your three locations and your current monthly budget of around 8,000 USD.",
    "goals": [
      "Track booked appointments back to the exact keyword and ad that produced them",
      "Reduce cost per booked appointment by 30 percent within 90 days",
      "Build a reporting view your front desk team can actually read"
    ],
    "scope": [
      {
        "title": "Tracking foundation",
        "description": "Server-side tracking via a dedicated tagging server, wired into your booking system so offline conversions flow back into Google Ads.",
        "deliverables": [
          "Server-side GTM container on a first-party subdomain",
          "GCLID capture into your CRM on every form and call",
          "Offline conversion import for booked and showed appointments",
          "GA4 property cleanup and conversion audit"
        ]
      },
      {
        "title": "Account rebuild",
        "description": "Restructure of the Google Ads account around location-level campaigns with clean conversion signals.",
        "deliverables": [
          "Keyword and search term audit of the last 12 months",
          "New campaign structure per location",
          "Ad copy refresh with two variants per ad group",
          "Negative keyword system and shared budgets"
        ]
      },
      {
        "title": "Ongoing management",
        "description": "Weekly optimization against cost per booked appointment, with a monthly review call.",
        "deliverables": [
          "Weekly bid, budget, and search term reviews",
          "Monthly performance report and 30-minute call",
          "Landing page recommendations as needed"
        ]
      }
    ],
    "timeline": [
      {
        "phase": "Week 1",
        "title": "Audit and access",
        "description": "Account access, tracking audit, booking system review."
      },
      {
        "phase": "Weeks 2 to 3",
        "title": "Tracking build",
        "description": "Server-side container, GCLID pipeline, offline conversion import live."
      },
      {
        "phase": "Week 4",
        "title": "Account rebuild",
        "description": "New structure launched, old campaigns wound down."
      },
      {
        "phase": "Ongoing",
        "title": "Optimization",
        "description": "Weekly management against cost per booked appointment."
      }
    ],
    "pricing": {
      "items": [
        {
          "label": "Tracking foundation and account rebuild",
          "detail": "One-time setup, weeks 1 to 4",
          "amount": 2400,
          "period": "once"
        },
        {
          "label": "Ongoing management",
          "detail": "Month to month, cancel with 30 days notice",
          "amount": 1200,
          "period": "monthly"
        },
        {
          "label": "Ad spend",
          "detail": "Paid directly to Google, not through us",
          "amount": "Billed by Google"
        }
      ],
      "notes": "Management fee is flat, not a percentage of spend. No long-term contract."
    },
    "terms": [
      "Setup fee is invoiced 50 percent on acceptance and 50 percent on tracking go-live.",
      "Management runs month to month and can be cancelled with 30 days written notice.",
      "Ad spend is paid directly to Google via your own billing profile.",
      "All accounts, containers, and data remain your property."
    ]
  }
}````


## FILE: examples/wmi-fzco-proposal.json

SHA-256: `0b02e94a726b118ed25779beb62b055aa3532f14c39890e3284349e354acb96b`

````json
{
  "expires_at": "2026-07-31",
  "data": {
    "brand": {
      "name": "Web Marketing International",
      "accent": "#2733C9",
      "website": "webmarketinginternational.com"
    },
    "proposal": {
      "title": "Google Ads Growth Engine for [Client Company]",
      "number": "WMI-FZ-2026-001",
      "valid_until": "2026-07-31",
      "currency": "USD"
    },
    "client": {
      "name": "[Contact Name]",
      "company": "[Client Company]",
      "email": "[client@example.com]"
    },
    "prepared_by": {
      "name": "Antoine Martin",
      "title": "Managing Director",
      "email": "antoine@webmarketinginternational.com"
    },
    "intro": "Replace with your intro. Blank lines become paragraphs.",
    "goals": [
      "First objective",
      "Second objective"
    ],
    "scope": [
      {
        "title": "Work stream",
        "description": "What it covers.",
        "deliverables": ["Item one", "Item two"]
      }
    ],
    "timeline": [
      {
        "phase": "Week 1",
        "title": "Phase name",
        "description": "What happens."
      }
    ],
    "pricing": {
      "items": [
        {
          "label": "Setup",
          "detail": "One-time",
          "amount": 2400,
          "period": "once"
        },
        {
          "label": "Management",
          "detail": "Month to month, cancel with 30 days notice",
          "amount": 1200,
          "period": "monthly"
        },
        {
          "label": "Ad spend",
          "detail": "Paid directly to Google, not through us",
          "amount": "Billed by Google"
        }
      ],
      "notes": "Management fee is flat, not a percentage of spend."
    },
    "terms": [
      "Setup fee is invoiced 50 percent on acceptance and 50 percent on go-live.",
      "Management runs month to month and can be cancelled with 30 days written notice.",
      "All accounts, containers, and data remain your property."
    ]
  }
}
````


## FILE: src/admin.js

SHA-256: `6d6d93bf90016d3e8f7c3fe91b8cf04df04acd47d2d1f5a1226419247f213cc5`

````javascript
// Read-only admin dashboard. Asks for the API token once, keeps it in
// localStorage, and renders proposal stats from the JSON API.

export function renderAdmin() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Proposals · Admin</title>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>
:root { --ink:#151B26; --muted:#5B6272; --hairline:#E5E2D9; --paper:#FAF9F6; --accent:#2733C9; --ok:#157F5F; }
* { box-sizing:border-box; }
body { margin:0; background:var(--paper); color:var(--ink); font-family:'IBM Plex Sans',system-ui,sans-serif; font-size:15px; }
.wrap { max-width:1080px; margin:0 auto; padding:40px 24px 100px; }
h1 { font-size:20px; margin:0 0 24px; }
.mono { font-family:'IBM Plex Mono',monospace; }
.token-box { display:flex; gap:10px; margin-bottom:28px; }
.token-box input { flex:1; font:inherit; padding:10px 12px; border:1px solid #C9C5B9; border-radius:4px; }
button { font:inherit; font-weight:600; background:var(--ink); color:#fff; border:0; border-radius:4px; padding:10px 18px; cursor:pointer; }
table { width:100%; border-collapse:collapse; background:#fff; border:1px solid var(--hairline); }
th,td { text-align:left; padding:12px 14px; border-bottom:1px solid var(--hairline); vertical-align:top; }
th { font-family:'IBM Plex Mono',monospace; font-size:10.5px; letter-spacing:.12em; text-transform:uppercase; color:var(--muted); }
tr:last-child td { border-bottom:0; }
tr.row { cursor:pointer; }
tr.row:hover td { background:#F4F2EC; }
.pill { font-family:'IBM Plex Mono',monospace; font-size:11px; padding:3px 8px; border-radius:99px; border:1px solid var(--hairline); color:var(--muted); white-space:nowrap; }
.pill.accepted { border-color:var(--ok); color:var(--ok); }
.pill.viewed { border-color:var(--accent); color:var(--accent); }
.pill.expired, .pill.declined { opacity:.6; }
.sub { color:var(--muted); font-size:13px; }
.detail td { background:#FCFBF8; }
.detail .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:14px; padding:6px 0 10px; }
.detail h4 { margin:0 0 6px; font-family:'IBM Plex Mono',monospace; font-size:10.5px; letter-spacing:.12em; text-transform:uppercase; color:var(--muted); }
.bar { height:8px; background:#EAE7DE; border-radius:99px; overflow:hidden; margin-top:4px; }
.bar i { display:block; height:100%; background:var(--accent); }
.err { color:#B4232A; margin:12px 0; }
a { color:var(--accent); }
.empty { padding:40px; text-align:center; color:var(--muted); background:#fff; border:1px dashed var(--hairline); }
</style>
</head>
<body>
<div class="wrap">
  <h1>Proposals</h1>
  <div class="token-box" id="token-box">
    <input type="password" id="token" placeholder="API token">
    <button id="save-token">Load</button>
  </div>
  <p class="err" id="err" hidden></p>
  <div id="list"></div>
</div>
<script>
(function(){
  var tokenInput = document.getElementById('token');
  var err = document.getElementById('err');
  var saved = localStorage.getItem('pe_token');
  if (saved) { tokenInput.value = saved; load(); }
  document.getElementById('save-token').addEventListener('click', load);
  tokenInput.addEventListener('keydown', function(e){ if(e.key==='Enter') load(); });

  function api(path){
    return fetch(path, { headers: { authorization: 'Bearer ' + tokenInput.value.trim() } })
      .then(function(r){ if(!r.ok) throw new Error(r.status===401?'Wrong token.':'Request failed ('+r.status+').'); return r.json(); });
  }

  function fmt(iso){ return iso ? new Date(iso.replace(' ','T')+'Z').toLocaleString() : 'not yet'; }

  function load(){
    err.hidden = true;
    localStorage.setItem('pe_token', tokenInput.value.trim());
    api('/api/proposals?limit=100').then(function(d){ render(d.proposals); })
      .catch(function(e){ err.textContent = e.message; err.hidden = false; });
  }

  function render(items){
    var list = document.getElementById('list');
    if (!items.length) { list.innerHTML = '<div class="empty">No proposals yet. Create one via POST /api/proposals.</div>'; return; }
    var html = '<table><thead><tr><th>Proposal</th><th>Client</th><th>Status</th><th>Views</th><th>Last activity</th></tr></thead><tbody>';
    items.forEach(function(p, i){
      html += '<tr class="row" data-i="'+i+'" data-id="'+p.id+'">'
        + '<td><strong>'+escapeHtml(p.title)+'</strong><div class="sub mono">'+escapeHtml(p.number||p.slug)+'</div></td>'
        + '<td>'+escapeHtml(p.client_company||p.client_name)+'</td>'
        + '<td><span class="pill '+p.status+'">'+p.status+'</span>'+(p.accepted_name?'<div class="sub">by '+escapeHtml(p.accepted_name)+'</div>':'')+'</td>'
        + '<td>'+p.views+'</td>'
        + '<td class="sub">'+fmt(p.last_activity)+'</td></tr>';
    });
    html += '</tbody></table>';
    list.innerHTML = html;
    list.querySelectorAll('tr.row').forEach(function(row){
      row.addEventListener('click', function(){ toggleDetail(row); });
    });
  }

  function toggleDetail(row){
    var next = row.nextElementSibling;
    if (next && next.classList.contains('detail')) { next.remove(); return; }
    api('/api/proposals/' + row.getAttribute('data-id')).then(function(p){
      var tr = document.createElement('tr');
      tr.className = 'detail';
      var rt = p.reading_time_seconds || {};
      var max = 1; Object.keys(rt).forEach(function(k){ if(rt[k]>max) max=rt[k]; });
      var bars = Object.keys(rt).map(function(k){
        return '<div><h4>'+escapeHtml(k)+'</h4><span class="mono">'+rt[k]+'s</span><div class="bar"><i style="width:'+Math.round(rt[k]/max*100)+'%"></i></div></div>';
      }).join('') || '<div class="sub">No reading data yet.</div>';
      tr.innerHTML = '<td colspan="5">'
        + '<div class="grid">'
        + '<div><h4>Link</h4><a href="'+p.url+'" target="_blank" class="mono">'+p.slug+'</a></div>'
        + '<div><h4>Created</h4>'+fmt(p.created_at)+'</div>'
        + '<div><h4>First viewed</h4>'+fmt(p.first_viewed_at)+'</div>'
        + '<div><h4>Accepted</h4>'+(p.accepted_at?fmt(p.accepted_at)+' · '+escapeHtml(p.accepted_name||''):'not yet')+'</div>'
        + '</div>'
        + '<h4 style="margin-top:8px">Time spent per section</h4>'
        + '<div class="grid">'+bars+'</div>'
        + '</td>';
      row.after(tr);
    }).catch(function(e){ err.textContent = e.message; err.hidden = false; });
  }

  function escapeHtml(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
})();
</script>
</body>
</html>`;
}
````


## FILE: src/index.js

SHA-256: `11decb7739f0413b731357989743ab3797883a46ccfc7e4b1c1de982d0652ada`

````javascript
import { Hono } from 'hono';
import { newSlug, clientIp, isExpired, sha256Hex } from './util.js';
import { sendWebhook } from './webhook.js';
import { renderProposal } from './templates/proposal.js';
import { renderAdmin } from './admin.js';

const TEMPLATES = { proposal: renderProposal };
const EVENT_TYPES = new Set(['section_view', 'section_time', 'pricing_viewed', 'scroll_depth', 'pdf_download']);

const app = new Hono();

// ---------- Auth middleware for the private API ----------

const requireToken = async (c, next) => {
  const token = c.env.API_TOKEN;
  if (!token) return c.json({ error: 'API_TOKEN is not configured on the server' }, 500);
  const header = c.req.header('authorization') || '';
  if (header !== `Bearer ${token}`) return c.json({ error: 'Unauthorized' }, 401);
  await next();
};

// ---------- Private API (called from n8n, GHL, curl) ----------

// Create a proposal. Body: { template?, data, expires_at? }
app.post('/api/proposals', requireToken, async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Body must be JSON' }, 400);
  }
  const template = body.template || 'proposal';
  if (!TEMPLATES[template]) return c.json({ error: `Unknown template "${template}"` }, 400);
  if (!body.data || typeof body.data !== 'object') return c.json({ error: 'Missing "data" object' }, 400);
  if (!body.data.proposal?.title) return c.json({ error: 'data.proposal.title is required' }, 400);
  if (!body.data.client?.company && !body.data.client?.name) {
    return c.json({ error: 'data.client.company or data.client.name is required' }, 400);
  }

  const id = crypto.randomUUID();
  const slug = newSlug();
  const expiresAt = body.expires_at || body.data.proposal?.valid_until || null;

  await c.env.DB.prepare(
    `INSERT INTO proposals (id, slug, template, data, status, expires_at) VALUES (?, ?, ?, ?, 'sent', ?)`
  ).bind(id, slug, template, JSON.stringify(body.data), expiresAt).run();

  return c.json({ id, slug, url: `${c.env.APP_URL}/p/${slug}` }, 201);
});

// List proposals with engagement stats.
app.get('/api/proposals', requireToken, async (c) => {
  const limit = Math.min(Number(c.req.query('limit')) || 50, 200);
  const { results } = await c.env.DB.prepare(
    `SELECT p.id, p.slug, p.template, p.status, p.created_at, p.first_viewed_at, p.accepted_at,
            p.accepted_name, p.expires_at, p.data,
            (SELECT COUNT(*) FROM events e WHERE e.proposal_id = p.id AND e.type = 'view') AS views,
            (SELECT MAX(created_at) FROM events e WHERE e.proposal_id = p.id) AS last_activity
     FROM proposals p ORDER BY p.created_at DESC LIMIT ?`
  ).bind(limit).all();

  const items = results.map((r) => {
    let d = {};
    try { d = JSON.parse(r.data); } catch {}
    return {
      id: r.id,
      slug: r.slug,
      url: `${c.env.APP_URL}/p/${r.slug}`,
      status: isExpired(r) ? 'expired' : r.status,
      title: d?.proposal?.title || '',
      number: d?.proposal?.number || '',
      client_company: d?.client?.company || '',
      client_name: d?.client?.name || '',
      created_at: r.created_at,
      first_viewed_at: r.first_viewed_at,
      accepted_at: r.accepted_at,
      accepted_name: r.accepted_name,
      expires_at: r.expires_at,
      views: r.views,
      last_activity: r.last_activity,
    };
  });
  return c.json({ proposals: items });
});

// Full detail: proposal + event timeline + per-section reading time.
app.get('/api/proposals/:id', requireToken, async (c) => {
  const id = c.req.param('id');
  const p = await c.env.DB.prepare(`SELECT * FROM proposals WHERE id = ? OR slug = ?`).bind(id, id).first();
  if (!p) return c.json({ error: 'Not found' }, 404);

  const { results: events } = await c.env.DB.prepare(
    `SELECT type, meta, ip, ua, created_at FROM events WHERE proposal_id = ? ORDER BY created_at ASC, id ASC LIMIT 500`
  ).bind(p.id).all();

  // Aggregate reading time per section across all visits.
  const readingTime = {};
  for (const e of events) {
    if (e.type !== 'section_time') continue;
    try {
      const seconds = JSON.parse(e.meta || '{}').seconds || {};
      for (const [section, s] of Object.entries(seconds)) {
        readingTime[section] = (readingTime[section] || 0) + Number(s || 0);
      }
    } catch {}
  }

  let data = {};
  try { data = JSON.parse(p.data); } catch {}

  return c.json({
    id: p.id,
    slug: p.slug,
    url: `${c.env.APP_URL}/p/${p.slug}`,
    template: p.template,
    status: isExpired(p) ? 'expired' : p.status,
    created_at: p.created_at,
    first_viewed_at: p.first_viewed_at,
    accepted_at: p.accepted_at,
    accepted_name: p.accepted_name,
    accepted_ip: p.accepted_ip,
    expires_at: p.expires_at,
    data,
    reading_time_seconds: readingTime,
    events: events.map((e) => ({ ...e, meta: safeParse(e.meta) })),
  });
});

// Manually change status (e.g. mark declined, or void a link).
app.post('/api/proposals/:id/status', requireToken, async (c) => {
  const allowed = new Set(['sent', 'viewed', 'accepted', 'declined', 'expired']);
  const id = c.req.param('id');
  let body;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Body must be JSON' }, 400); }
  if (!allowed.has(body.status)) return c.json({ error: 'Invalid status' }, 400);
  const res = await c.env.DB.prepare(`UPDATE proposals SET status = ? WHERE id = ? OR slug = ?`)
    .bind(body.status, id, id).run();
  if (!res.meta.changes) return c.json({ error: 'Not found' }, 404);
  return c.json({ ok: true, status: body.status });
});

// ---------- Admin dashboard (token entered in browser, stored locally) ----------

app.get('/admin', (c) => c.html(renderAdmin()));

// ---------- Public proposal routes ----------

app.get('/p/:slug', async (c) => {
  const slug = c.req.param('slug');
  const p = await c.env.DB.prepare(`SELECT * FROM proposals WHERE slug = ?`).bind(slug).first();
  if (!p) return c.text('Not found', 404);

  const expired = isExpired(p);
  let data = {};
  try { data = JSON.parse(p.data); } catch {}

  const render = TEMPLATES[p.template] || renderProposal;
  const html = render({ proposal: p, data, expired });

  // Record the view and fire the first-view webhook without blocking the response.
  const ip = clientIp(c);
  const ua = c.req.header('user-agent') || '';
  c.executionCtx.waitUntil((async () => {
    await c.env.DB.prepare(`INSERT INTO events (proposal_id, type, meta, ip, ua) VALUES (?, 'view', '{}', ?, ?)`)
      .bind(p.id, ip, ua).run();
    if (!p.first_viewed_at) {
      await c.env.DB.prepare(
        `UPDATE proposals SET first_viewed_at = datetime('now'),
         status = CASE WHEN status = 'sent' THEN 'viewed' ELSE status END WHERE id = ?`
      ).bind(p.id).run();
      await sendWebhook(c.env, 'proposal.viewed', p, { ip, ua });
    }
  })());

  return c.html(html);
});

// Tracking beacon.
app.post('/p/:slug/e', async (c) => {
  const slug = c.req.param('slug');
  const p = await c.env.DB.prepare(`SELECT id, slug, data, status FROM proposals WHERE slug = ?`).bind(slug).first();
  if (!p) return c.json({ error: 'Not found' }, 404);

  let body;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Body must be JSON' }, 400); }
  if (!EVENT_TYPES.has(body.type)) return c.json({ error: 'Unknown event type' }, 400);

  const meta = JSON.stringify(body.meta || {}).slice(0, 4000);
  const ip = clientIp(c);
  const ua = (c.req.header('user-agent') || '').slice(0, 500);

  await c.env.DB.prepare(`INSERT INTO events (proposal_id, type, meta, ip, ua) VALUES (?, ?, ?, ?, ?)`)
    .bind(p.id, body.type, meta, ip, ua).run();

  // First time pricing is viewed → notify n8n.
  if (body.type === 'pricing_viewed') {
    const prior = await c.env.DB.prepare(
      `SELECT COUNT(*) AS n FROM events WHERE proposal_id = ? AND type = 'pricing_viewed'`
    ).bind(p.id).first();
    if (Number(prior.n) === 1) {
      c.executionCtx.waitUntil(sendWebhook(c.env, 'proposal.pricing_viewed', p, { ip }));
    }
  }
  return c.json({ ok: true });
});

// Acceptance.
app.post('/p/:slug/accept', async (c) => {
  const slug = c.req.param('slug');
  const p = await c.env.DB.prepare(`SELECT * FROM proposals WHERE slug = ?`).bind(slug).first();
  if (!p) return c.json({ error: 'Not found' }, 404);
  if (p.status === 'accepted') return c.json({ error: 'This proposal has already been accepted.' }, 409);
  if (p.status === 'declined') return c.json({ error: 'This proposal is no longer open for acceptance.' }, 409);
  if (isExpired(p)) return c.json({ error: 'This proposal has expired.' }, 410);

  let body;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Body must be JSON' }, 400); }
  const name = String(body.name || '').trim().slice(0, 200);
  if (name.length < 2 || body.agree !== true) {
    return c.json({ error: 'A full name and confirmation are required.' }, 400);
  }

  const ip = clientIp(c);
  const ua = (c.req.header('user-agent') || '').slice(0, 500);
  // Seal the exact agreed content into the acceptance record (tamper evidence).
  const docSha256 = await sha256Hex(p.data || '');

  await c.env.DB.prepare(
    `UPDATE proposals SET status = 'accepted', accepted_at = datetime('now'), accepted_name = ?, accepted_ip = ? WHERE id = ?`
  ).bind(name, ip, p.id).run();
  await c.env.DB.prepare(
    `INSERT INTO events (proposal_id, type, meta, ip, ua) VALUES (?, 'accepted', ?, ?, ?)`
  ).bind(p.id, JSON.stringify({ name, doc_sha256: docSha256 }), ip, ua).run();

  c.executionCtx.waitUntil(sendWebhook(c.env, 'proposal.accepted', { ...p, status: 'accepted' }, { name, ip, doc_sha256: docSha256 }));
  return c.json({ ok: true });
});

app.get('/', (c) => c.redirect('/admin'));

function safeParse(s) {
  try { return JSON.parse(s || '{}'); } catch { return {}; }
}

export default app;
````


## FILE: src/util.js

SHA-256: `7717da0b768c17ef23fea3f82f7724720cf501e40e1775967ffb8c0578f17814`

````javascript
// Shared helpers

const ALPHABET = '23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ'; // no 0/O/1/l/i

export function newSlug(length = 14) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

export function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// Split plain text into escaped <p> paragraphs on blank lines.
export function paragraphs(text) {
  return String(text ?? '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p).replaceAll('\n', '<br>')}</p>`)
    .join('\n');
}

export function money(amount, currency = 'USD') {
  const n = Number(amount);
  if (!Number.isFinite(n)) return esc(String(amount ?? ''));
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: n % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${currency} ${n.toLocaleString('en-US')}`;
  }
}

// SHA-256 hex of a string. Seals the exact document content into the
// acceptance record so the agreed text is tamper-evident after the fact.
export async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function clientIp(c) {
  return (
    c.req.header('cf-connecting-ip') ||
    (c.req.header('x-forwarded-for') || '').split(',')[0].trim() ||
    ''
  );
}

export function isExpired(proposal) {
  if (!proposal.expires_at || proposal.status === 'accepted') return false;
  const exp = new Date(proposal.expires_at);
  if (Number.isNaN(exp.getTime())) return false;
  // Treat a bare date as end of that day, UTC.
  if (/^\d{4}-\d{2}-\d{2}$/.test(proposal.expires_at)) {
    exp.setUTCHours(23, 59, 59, 999);
  }
  return Date.now() > exp.getTime();
}

export function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return esc(iso);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}
````


## FILE: src/webhook.js

SHA-256: `e2109686d1310f85d9b6ee14b6ae1b7dfe09dd3acc49825317c4d42e2ae26427`

````javascript
// Fire-and-forget webhook to n8n (or any endpoint). Never throws.

// When WEBHOOK_SECRET is set, receivers can verify authenticity by comparing
// the X-Signature header against hex(HMAC-SHA256(secret, raw body)).
async function signBody(secret, body) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(body));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sendWebhook(env, event, proposal, meta = {}) {
  if (!env.WEBHOOK_URL) return;
  let data = {};
  try {
    data = JSON.parse(proposal.data || '{}');
  } catch {}
  const payload = {
    event, // proposal.viewed | proposal.pricing_viewed | proposal.accepted
    at: new Date().toISOString(),
    proposal: {
      id: proposal.id,
      slug: proposal.slug,
      url: `${env.APP_URL}/p/${proposal.slug}`,
      status: proposal.status,
      title: data?.proposal?.title || '',
      number: data?.proposal?.number || '',
      client_name: data?.client?.name || '',
      client_company: data?.client?.company || '',
      client_email: data?.client?.email || '',
    },
    meta,
  };
  try {
    const body = JSON.stringify(payload);
    const headers = { 'content-type': 'application/json' };
    if (env.WEBHOOK_SECRET) headers['x-signature'] = await signBody(env.WEBHOOK_SECRET, body);
    await fetch(env.WEBHOOK_URL, { method: 'POST', headers, body });
  } catch (err) {
    console.log('webhook failed', String(err));
  }
}
````


## FILE: src/templates/proposal.js

SHA-256: `278d129d5e9c144ce6925b75c29e34bed204aed56607be9bf8de2dca9f11661b`

````javascript
// Default proposal template.
// Renders merge data into a complete tracked proposal page.
// Data contract is documented in README.md (all sections optional except client + proposal.title).

import { esc, paragraphs, money, fmtDate } from '../util.js';

export function renderProposal({ proposal, data, expired }) {
  const brand = data.brand || {};
  const meta = data.proposal || {};
  const client = data.client || {};
  const by = data.prepared_by || {};
  const accent = /^#[0-9a-fA-F]{6}$/.test(brand.accent || '') ? brand.accent : '#2733C9';
  const currency = meta.currency || 'USD';
  const accepted = proposal.status === 'accepted';
  const canAccept = !accepted && !expired && (data.accept?.enabled ?? true);

  // ---- Section builders (each returns '' when its data is absent) ----

  const sections = [];
  const nav = [];
  const addSection = (id, label, html) => {
    if (!html) return;
    nav.push({ id, label });
    sections.push(`<section class="doc-section" id="${id}" data-section="${id}">${html}</section>`);
  };

  if (data.intro) {
    addSection('overview', 'Overview', `
      <p class="eyebrow">Overview</p>
      <div class="prose">${paragraphs(data.intro)}</div>`);
  }

  if (Array.isArray(data.goals) && data.goals.length) {
    addSection('objectives', 'Objectives', `
      <p class="eyebrow">Objectives</p>
      <ul class="goals">
        ${data.goals.map((g) => `<li>${esc(g)}</li>`).join('\n')}
      </ul>`);
  }

  if (Array.isArray(data.scope) && data.scope.length) {
    addSection('scope', 'Scope of work', `
      <p class="eyebrow">Scope of work</p>
      <div class="scope-list">
        ${data.scope.map((s) => `
        <article class="scope-item">
          <h3>${esc(s.title)}</h3>
          ${s.description ? `<div class="prose small">${paragraphs(s.description)}</div>` : ''}
          ${Array.isArray(s.deliverables) && s.deliverables.length ? `
          <ul class="deliverables">
            ${s.deliverables.map((d) => `<li>${esc(d)}</li>`).join('\n')}
          </ul>` : ''}
        </article>`).join('\n')}
      </div>`);
  }

  if (Array.isArray(data.timeline) && data.timeline.length) {
    addSection('timeline', 'Timeline', `
      <p class="eyebrow">Timeline</p>
      <ol class="timeline">
        ${data.timeline.map((t, i) => `
        <li class="phase">
          <span class="phase-index">${String(i + 1).padStart(2, '0')}</span>
          <div class="phase-body">
            <p class="phase-when">${esc(t.phase || '')}</p>
            <h3>${esc(t.title || '')}</h3>
            ${t.description ? `<div class="prose small">${paragraphs(t.description)}</div>` : ''}
          </div>
        </li>`).join('\n')}
      </ol>`);
  }

  if (data.pricing && Array.isArray(data.pricing.items) && data.pricing.items.length) {
    const items = data.pricing.items;
    const periodLabel = { once: 'one-time', monthly: '/month', quarterly: '/quarter', yearly: '/year' };
    let onceTotal = 0, monthlyTotal = 0, hasOnce = false, hasMonthly = false;
    const rows = items.map((it) => {
      const numeric = typeof it.amount === 'number' && Number.isFinite(it.amount);
      if (numeric && it.period === 'once') { onceTotal += it.amount; hasOnce = true; }
      if (numeric && it.period === 'monthly') { monthlyTotal += it.amount; hasMonthly = true; }
      const amountHtml = numeric ? money(it.amount, currency) : esc(it.amount);
      const suffix = numeric && periodLabel[it.period] ? `<span class="per">${periodLabel[it.period]}</span>` : '';
      return `
        <tr>
          <td class="p-label">
            ${esc(it.label)}
            ${it.detail ? `<span class="p-detail">${esc(it.detail)}</span>` : ''}
          </td>
          <td class="p-amount">${amountHtml}${suffix}</td>
        </tr>`;
    }).join('\n');

    const totals = [
      hasOnce ? `<tr class="total"><td class="p-label">One-time total</td><td class="p-amount">${money(onceTotal, currency)}</td></tr>` : '',
      hasMonthly ? `<tr class="total"><td class="p-label">Monthly total</td><td class="p-amount">${money(monthlyTotal, currency)}<span class="per">/month</span></td></tr>` : '',
    ].join('\n');

    addSection('investment', 'Investment', `
      <p class="eyebrow">Investment</p>
      <table class="pricing">
        <tbody>${rows}${totals}</tbody>
      </table>
      ${data.pricing.notes ? `<div class="prose small pricing-notes">${paragraphs(data.pricing.notes)}</div>` : ''}`);
  }

  if (Array.isArray(data.terms) && data.terms.length) {
    addSection('terms', 'Terms', `
      <p class="eyebrow">Terms</p>
      <ol class="terms">
        ${data.terms.map((t) => `<li>${esc(t)}</li>`).join('\n')}
      </ol>`);
  }

  // ---- Acceptance block ----

  let acceptHtml = '';
  if (accepted) {
    acceptHtml = `
      <section class="doc-section" id="acceptance" data-section="acceptance">
        <div class="accepted-stamp">
          <p class="eyebrow">Accepted</p>
          <p class="stamp-name">${esc(proposal.accepted_name || '')}</p>
          <p class="stamp-meta">${fmtDate(proposal.accepted_at)} &middot; recorded electronically</p>
        </div>
      </section>`;
  } else if (expired) {
    acceptHtml = `
      <section class="doc-section" id="acceptance" data-section="acceptance">
        <div class="expired-note">
          <p class="eyebrow">Expired</p>
          <p>This proposal expired on ${fmtDate(proposal.expires_at)}. ${by.email ? `Write to <a href="mailto:${esc(by.email)}">${esc(by.email)}</a> to request an updated version.` : 'Contact us to request an updated version.'}</p>
        </div>
      </section>`;
  } else if (canAccept) {
    nav.push({ id: 'acceptance', label: 'Acceptance' });
    acceptHtml = `
      <section class="doc-section" id="acceptance" data-section="acceptance">
        <p class="eyebrow">Acceptance</p>
        <div class="accept-card" id="accept-card">
          <p class="accept-lede">${esc(data.accept?.note || `Ready to move forward? Accepting this proposal confirms the scope and investment above.`)}</p>
          <label class="field">
            <span>Full name</span>
            <input type="text" id="accept-name" autocomplete="name" placeholder="Your full name">
          </label>
          <label class="agree">
            <input type="checkbox" id="accept-agree">
            <span>I have authority to accept this proposal on behalf of ${esc(client.company || 'my company')}.</span>
          </label>
          <button type="button" id="accept-btn">${esc(data.accept?.button || 'Accept proposal')}</button>
          <p class="accept-fineprint">Acceptance is recorded with a timestamp and network address.</p>
          <p class="accept-error" id="accept-error" hidden></p>
        </div>
      </section>`;
  }

  // ---- Rail (document manifest) ----

  const statusLabel = accepted ? 'Accepted' : expired ? 'Expired' : 'Awaiting review';
  const statusClass = accepted ? 'ok' : expired ? 'dim' : 'live';
  const railMeta = [
    meta.number ? ['Proposal', meta.number] : null,
    client.company ? ['Prepared for', client.company] : null,
    by.name ? ['Prepared by', by.name] : null,
    meta.valid_until && !expired && !accepted ? ['Valid until', fmtDate(meta.valid_until)] : null,
  ].filter(Boolean);

  const clientScript = buildClientScript();
  const cfg = JSON.stringify({ slug: proposal.slug, canAccept });

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(meta.title || 'Proposal')} · ${esc(brand.name || '')}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
:root {
  --accent: ${accent};
  --paper: #FAF9F6;
  --card: #FFFFFF;
  --ink: #151B26;
  --muted: #5B6272;
  --hairline: #E5E2D9;
  --rail-bg: #10151F;
  --rail-text: #B9C0CE;
  --rail-dim: #6B7385;
  --ok: #157F5F;
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  * { transition: none !important; animation: none !important; }
}
body {
  margin: 0;
  background: var(--paper);
  color: var(--ink);
  font-family: 'IBM Plex Sans', system-ui, sans-serif;
  font-size: 16.5px;
  line-height: 1.65;
}
a { color: var(--accent); }

/* ---- Layout: rail + document ---- */
.layout { display: grid; grid-template-columns: 264px minmax(0, 1fr); min-height: 100vh; }
.rail {
  background: var(--rail-bg);
  color: var(--rail-text);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 12.5px;
  padding: 40px 28px;
  position: sticky; top: 0; height: 100vh;
  display: flex; flex-direction: column; gap: 28px;
}
.rail .brand { color: #fff; font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 17px; letter-spacing: 0.01em; }
.rail dl { margin: 0; display: grid; gap: 14px; }
.rail dt { color: var(--rail-dim); text-transform: uppercase; letter-spacing: 0.14em; font-size: 10px; margin-bottom: 3px; }
.rail dd { margin: 0; color: var(--rail-text); }
.status { display: inline-flex; align-items: center; gap: 8px; }
.status .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--rail-dim); }
.status.live .dot { background: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 30%, transparent); }
.status.ok .dot { background: #2FBF8F; }
.rail-nav { margin-top: auto; display: grid; gap: 2px; }
.rail-nav a {
  color: var(--rail-dim); text-decoration: none; padding: 7px 10px; border-left: 2px solid transparent;
  transition: color .15s ease, border-color .15s ease;
}
.rail-nav a.seen { color: var(--rail-text); }
.rail-nav a.active { color: #fff; border-left-color: var(--accent); }
.rail-actions { display: grid; gap: 8px; }
.rail-actions button {
  font: inherit; color: var(--rail-text); background: transparent; border: 1px solid #2A3140;
  padding: 8px 10px; cursor: pointer; text-align: left; border-radius: 3px;
}
.rail-actions button:hover { border-color: var(--rail-dim); color: #fff; }

/* ---- Document column ---- */
.doc { padding: 72px clamp(28px, 7vw, 96px) 120px; max-width: 860px; }
.eyebrow {
  font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: 0.18em;
  text-transform: uppercase; color: var(--accent); margin: 0 0 18px;
}
.cover { padding-bottom: 48px; border-bottom: 1px solid var(--hairline); margin-bottom: 8px; }
.cover h1 {
  font-family: 'Space Grotesk', sans-serif; font-weight: 600;
  font-size: clamp(34px, 5vw, 52px); line-height: 1.08; letter-spacing: -0.015em; margin: 0 0 22px;
}
.cover .for { font-size: 19px; color: var(--muted); margin: 0; }
.cover .for strong { color: var(--ink); font-weight: 600; }
.doc-section { padding: 56px 0; border-bottom: 1px solid var(--hairline); }
.doc-section:last-of-type { border-bottom: 0; }
h2, h3 { font-family: 'Space Grotesk', sans-serif; letter-spacing: -0.01em; }
h3 { font-size: 20px; font-weight: 600; margin: 0 0 10px; }
.prose p { margin: 0 0 1em; }
.prose p:last-child { margin-bottom: 0; }
.prose.small { font-size: 15.5px; color: var(--muted); }

.goals { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
.goals li { padding-left: 26px; position: relative; font-weight: 500; }
.goals li::before {
  content: ''; position: absolute; left: 0; top: 9px; width: 12px; height: 6px;
  background: var(--accent); clip-path: polygon(0 100%, 50% 0, 100% 100%);
}

.scope-list { display: grid; gap: 20px; }
.scope-item { background: var(--card); border: 1px solid var(--hairline); border-radius: 6px; padding: 26px 28px; }
.deliverables { list-style: none; margin: 16px 0 0; padding: 0; display: grid; gap: 8px; font-size: 15.5px; }
.deliverables li { padding-left: 20px; position: relative; }
.deliverables li::before { content: ''; position: absolute; left: 0; top: 10px; width: 7px; height: 7px; background: color-mix(in srgb, var(--accent) 22%, white); border: 1px solid var(--accent); }

.timeline { list-style: none; margin: 0; padding: 0; }
.phase { display: grid; grid-template-columns: 56px 1fr; gap: 18px; position: relative; padding-bottom: 34px; }
.phase:last-child { padding-bottom: 0; }
.phase::before { content: ''; position: absolute; left: 27px; top: 34px; bottom: 6px; width: 1px; background: var(--hairline); }
.phase:last-child::before { display: none; }
.phase-index {
  font-family: 'IBM Plex Mono', monospace; font-size: 13px; color: var(--accent);
  width: 56px; height: 28px; display: grid; place-items: center;
  border: 1px solid color-mix(in srgb, var(--accent) 45%, white); border-radius: 3px; background: var(--card);
}
.phase-when { font-family: 'IBM Plex Mono', monospace; font-size: 11.5px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); margin: 4px 0 4px; }
.phase-body h3 { margin-bottom: 6px; }

.pricing { width: 100%; border-collapse: collapse; background: var(--card); border: 1px solid var(--hairline); border-radius: 6px; overflow: hidden; }
.pricing td { padding: 18px 22px; border-bottom: 1px solid var(--hairline); vertical-align: top; }
.pricing tr:last-child td { border-bottom: 0; }
.p-label { font-weight: 500; }
.p-detail { display: block; font-size: 14px; color: var(--muted); font-weight: 400; margin-top: 2px; }
.p-amount { text-align: right; font-family: 'IBM Plex Mono', monospace; font-size: 16px; white-space: nowrap; font-variant-numeric: tabular-nums; }
.p-amount .per { color: var(--muted); font-size: 12.5px; margin-left: 4px; }
.pricing .total td { background: color-mix(in srgb, var(--accent) 5%, white); font-weight: 600; border-top: 2px solid var(--ink); }
.pricing .total .p-amount { font-size: 18px; }
.pricing-notes { margin-top: 16px; }

.terms { margin: 0; padding-left: 22px; display: grid; gap: 10px; font-size: 15px; color: var(--muted); }

.accept-card { background: var(--card); border: 1px solid var(--hairline); border-top: 3px solid var(--accent); border-radius: 6px; padding: 30px 32px; max-width: 560px; }
.accept-lede { margin: 0 0 22px; }
.field { display: grid; gap: 6px; margin-bottom: 16px; }
.field span { font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted); }
.field input {
  font: inherit; padding: 11px 13px; border: 1px solid #C9C5B9; border-radius: 4px; background: var(--paper);
}
.field input:focus { outline: 2px solid var(--accent); outline-offset: 1px; border-color: var(--accent); }
.agree { display: flex; gap: 10px; align-items: flex-start; font-size: 14.5px; color: var(--muted); margin-bottom: 22px; }
.agree input { margin-top: 4px; accent-color: var(--accent); }
#accept-btn {
  font-family: 'Space Grotesk', sans-serif; font-weight: 600; font-size: 16px; color: #fff;
  background: var(--accent); border: 0; border-radius: 4px; padding: 13px 26px; cursor: pointer; width: 100%;
}
#accept-btn:hover { filter: brightness(1.08); }
#accept-btn:disabled { opacity: .55; cursor: default; }
#accept-btn:focus-visible, .rail-actions button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.accept-fineprint { font-size: 12.5px; color: var(--muted); margin: 14px 0 0; }
.accept-error { color: #B4232A; font-size: 14px; margin: 12px 0 0; }
.accepted-stamp { border: 1.5px solid var(--ok); border-radius: 6px; padding: 28px 32px; max-width: 560px; background: color-mix(in srgb, var(--ok) 4%, white); }
.accepted-stamp .eyebrow { color: var(--ok); }
.stamp-name { font-family: 'Space Grotesk', sans-serif; font-size: 26px; font-weight: 600; margin: 0 0 6px; }
.stamp-meta { font-family: 'IBM Plex Mono', monospace; font-size: 12.5px; color: var(--muted); margin: 0; }
.expired-note { border: 1px solid var(--hairline); border-radius: 6px; padding: 26px 30px; color: var(--muted); background: var(--card); max-width: 560px; }
.expired-note p { margin: 0; }
.expired-banner {
  font-family: 'IBM Plex Mono', monospace; font-size: 12.5px; background: #F3E9D8; color: #7A5A17;
  padding: 12px clamp(28px, 7vw, 96px);
}
.doc-footer { margin-top: 72px; padding-top: 26px; border-top: 1px solid var(--hairline); font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--muted); display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; }

/* ---- Mobile ---- */
@media (max-width: 900px) {
  .layout { grid-template-columns: 1fr; }
  .rail { position: static; height: auto; flex-direction: row; flex-wrap: wrap; align-items: center; gap: 10px 24px; padding: 18px 22px; }
  .rail dl { display: flex; flex-wrap: wrap; gap: 4px 24px; }
  .rail-nav, .rail-actions { display: none; }
  .doc { padding: 44px 22px 90px; }
}

/* ---- Print ---- */
@media print {
  .rail, .rail-actions, .expired-banner { display: none !important; }
  .layout { display: block; }
  body { background: #fff; font-size: 12.5px; }
  .doc { max-width: none; padding: 0; }
  .doc-section { padding: 22px 0; }
  .scope-item, .pricing, .accept-card, .accepted-stamp { break-inside: avoid; }
  #accept-card { display: none; }
  a { color: inherit; text-decoration: none; }
}
</style>
</head>
<body>
${expired ? `<div class="expired-banner">This proposal expired on ${fmtDate(proposal.expires_at)}.</div>` : ''}
<div class="layout">
  <aside class="rail" aria-label="Document information">
    <div class="brand">${esc(brand.name || 'Proposal')}</div>
    <dl>
      ${railMeta.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('\n')}
      <div><dt>Status</dt><dd><span class="status ${statusClass}"><span class="dot"></span>${statusLabel}</span></dd></div>
    </dl>
    <nav class="rail-nav" id="rail-nav" aria-label="Sections">
      ${nav.map((n) => `<a href="#${n.id}" data-for="${n.id}">${esc(n.label)}</a>`).join('\n')}
    </nav>
    <div class="rail-actions">
      <button type="button" id="pdf-btn">Download as PDF</button>
    </div>
  </aside>

  <main class="doc">
    <header class="cover">
      <p class="eyebrow">${esc(meta.number ? `Proposal ${meta.number}` : 'Proposal')}</p>
      <h1>${esc(meta.title || 'Proposal')}</h1>
      <p class="for">Prepared for <strong>${esc(client.company || client.name || '')}</strong>${client.name && client.company ? `, attention of ${esc(client.name)}` : ''}</p>
    </header>

    ${sections.join('\n')}
    ${acceptHtml}

    <footer class="doc-footer">
      <span>${esc(brand.name || '')}${brand.website ? ` · ${esc(brand.website)}` : ''}</span>
      <span>${esc(meta.number || '')}</span>
    </footer>
  </main>
</div>

<script>
var CFG = ${cfg};
${clientScript}
</script>
</body>
</html>`;
}

// Client-side tracking + acceptance. Plain ES5-ish, no template literals,
// so it nests safely inside the server-side template string.
function buildClientScript() {
  return `
(function () {
  var endpoint = '/p/' + CFG.slug + '/e';
  function send(type, meta) {
    var body = JSON.stringify({ type: type, meta: meta || {} });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(endpoint, new Blob([body], { type: 'application/json' }));
    } else {
      fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: body, keepalive: true }).catch(function () {});
    }
  }

  // Section visibility: first-view events + accumulated reading time.
  var seen = {};
  var timers = {};   // sectionId -> total ms
  var openedAt = {}; // sectionId -> timestamp while visible
  var sections = document.querySelectorAll('[data-section]');
  var navLinks = document.querySelectorAll('#rail-nav a');

  function markNav(id, state) {
    for (var i = 0; i < navLinks.length; i++) {
      var a = navLinks[i];
      if (a.getAttribute('data-for') === id) {
        if (state === 'active') a.classList.add('active', 'seen');
      } else if (state === 'active') {
        a.classList.remove('active');
      }
    }
  }

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var id = entry.target.getAttribute('data-section');
        if (entry.isIntersecting) {
          openedAt[id] = Date.now();
          markNav(id, 'active');
          if (!seen[id]) {
            seen[id] = true;
            send('section_view', { section: id });
            if (id === 'investment') send('pricing_viewed', {});
          }
        } else if (openedAt[id]) {
          timers[id] = (timers[id] || 0) + (Date.now() - openedAt[id]);
          delete openedAt[id];
        }
      });
    }, { threshold: 0.35 });
    for (var i = 0; i < sections.length; i++) io.observe(sections[i]);
  }

  // Scroll depth milestones.
  var milestones = [25, 50, 75, 100];
  var hit = {};
  window.addEventListener('scroll', function () {
    var h = document.documentElement;
    var depth = Math.round(((h.scrollTop + window.innerHeight) / h.scrollHeight) * 100);
    milestones.forEach(function (m) {
      if (depth >= m && !hit[m]) { hit[m] = true; send('scroll_depth', { percent: m }); }
    });
  }, { passive: true });

  // Flush reading time when the tab is hidden or closed.
  function flush() {
    var now = Date.now();
    for (var id in openedAt) {
      timers[id] = (timers[id] || 0) + (now - openedAt[id]);
      openedAt[id] = now;
    }
    var out = {};
    var any = false;
    for (var k in timers) {
      var s = Math.round(timers[k] / 1000);
      if (s >= 1) { out[k] = s; any = true; }
    }
    if (any) send('section_time', { seconds: out });
    timers = {};
  }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flush(); });
  window.addEventListener('pagehide', flush);

  // PDF button.
  var pdfBtn = document.getElementById('pdf-btn');
  if (pdfBtn) pdfBtn.addEventListener('click', function () { send('pdf_download', {}); window.print(); });

  // Acceptance flow.
  var btn = document.getElementById('accept-btn');
  if (btn && CFG.canAccept) {
    btn.addEventListener('click', function () {
      var name = (document.getElementById('accept-name').value || '').trim();
      var agree = document.getElementById('accept-agree').checked;
      var errEl = document.getElementById('accept-error');
      errEl.hidden = true;
      if (name.length < 2) { errEl.textContent = 'Please enter your full name.'; errEl.hidden = false; return; }
      if (!agree) { errEl.textContent = 'Please confirm you have authority to accept.'; errEl.hidden = false; return; }
      btn.disabled = true;
      btn.textContent = 'Recording acceptance…';
      fetch('/p/' + CFG.slug + '/accept', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: name, agree: true })
      }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          if (!res.ok) throw new Error(res.j.error || 'Could not record acceptance.');
          var card = document.getElementById('accept-card');
          card.outerHTML = '<div class="accepted-stamp"><p class="eyebrow" style="color:var(--ok)">Accepted</p>' +
            '<p class="stamp-name"></p><p class="stamp-meta">Just now &middot; recorded electronically</p></div>';
          document.querySelector('#acceptance .stamp-name').textContent = name;
          var status = document.querySelector('.status');
          if (status) { status.className = 'status ok'; status.innerHTML = '<span class="dot"></span>Accepted'; }
        })
        .catch(function (e) {
          btn.disabled = false;
          btn.textContent = 'Accept proposal';
          errEl.textContent = e.message;
          errEl.hidden = false;
        });
    });
  }
})();
`;
}
````


## FILE: test/harness.mjs

SHA-256: `7cb9c43cf14006ca49af1bfa779898ee832820eaf6f288b52aecc65951c0bb4d`

````javascript
// End-to-end tests for the proposal engine, run directly against the Hono app
// with a real SQLite database standing in for D1. Run: node test/harness.mjs

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import app from '../src/index.js';

// ---- D1 shim over node:sqlite ----
function makeD1() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  return {
    prepare(sql) {
      return {
        bind(...params) {
          const p = params.map((x) => (x === undefined ? null : x));
          return {
            async run() {
              const r = db.prepare(sql).run(...p);
              return { meta: { changes: r.changes } };
            },
            async first() {
              return db.prepare(sql).get(...p) ?? null;
            },
            async all() {
              return { results: db.prepare(sql).all(...p) };
            },
          };
        },
      };
    },
  };
}

// ---- Webhook capture ----
const webhooks = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (String(url).includes('n8n.example')) {
    webhooks.push(JSON.parse(init.body));
    return new Response('ok');
  }
  return realFetch(url, init);
};

const env = {
  DB: makeD1(),
  API_TOKEN: 'test-token',
  WEBHOOK_URL: 'https://n8n.example/webhook/proposals',
  APP_URL: 'https://docs.example.com',
};

// executionCtx that lets us await background work deterministically.
const pending = [];
const ctx = { waitUntil: (p) => pending.push(p), passThroughOnException() {} };
const flush = async () => { await Promise.all(pending.splice(0)); };

const req = (path, init = {}) => app.request(path, init, env, ctx);
const authed = (path, init = {}) =>
  req(path, { ...init, headers: { authorization: 'Bearer test-token', 'content-type': 'application/json', ...(init.headers || {}) } });

const proposalData = JSON.parse(readFileSync(new URL('../examples/sample-proposal.json', import.meta.url), 'utf8'));

let pass = 0;
const ok = (name) => { pass++; console.log('  ✓', name); };

// ---- 1. Auth ----
{
  const r = await req('/api/proposals', { method: 'POST', body: '{}' });
  assert.equal(r.status, 401); ok('rejects missing token (401)');
  const r2 = await authed('/api/proposals', { method: 'POST', body: JSON.stringify({ data: {} }) });
  assert.equal(r2.status, 400); ok('rejects incomplete data (400)');
}

// ---- 2. Create ----
let slug, id;
{
  const r = await authed('/api/proposals', { method: 'POST', body: JSON.stringify(proposalData) });
  assert.equal(r.status, 201);
  const j = await r.json();
  assert.match(j.url, /^https:\/\/docs\.example\.com\/p\/[2-9a-zA-Z]{14}$/);
  ({ slug, id } = j);
  ok('creates proposal, returns unguessable URL');
}

// ---- 3. Public page render + first-view webhook ----
{
  const r = await req(`/p/${slug}`, { headers: { 'cf-connecting-ip': '203.0.113.7', 'user-agent': 'TestBrowser/1.0' } });
  assert.equal(r.status, 200);
  const html = await r.text();
  writeFileSync('/tmp/rendered.html', html);
  for (const needle of [
    'Meridian Dental Group', 'Google Ads Growth Engine', 'WMI-2026-014',
    'Tracking foundation', 'One-time total', '$2,400', 'Monthly total', '$1,200',
    'Billed by Google', 'Accept proposal', 'Space Grotesk',
  ]) assert.ok(html.includes(needle), `page missing: ${needle}`);
  assert.ok(!html.includes('<div class="expired-banner">'), 'no expired banner on live proposal');
  await flush();
  assert.equal(webhooks.length, 1);
  assert.equal(webhooks[0].event, 'proposal.viewed');
  assert.equal(webhooks[0].proposal.client_company, 'Meridian Dental Group');
  ok('renders page with correct merge fields and pricing totals');
  ok('fires proposal.viewed webhook with client context');

  // Second view: no duplicate webhook.
  await req(`/p/${slug}`); await flush();
  assert.equal(webhooks.length, 1); ok('second view does not re-fire webhook');
}

// ---- 4. Tracking events ----
{
  const send = (body) => req(`/p/${slug}/e`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await send({ type: 'hack_attempt' })).status, 400); ok('rejects unknown event type');
  assert.equal((await send({ type: 'section_view', meta: { section: 'scope' } })).status, 200);
  assert.equal((await send({ type: 'pricing_viewed' })).status, 200);
  await flush();
  assert.equal(webhooks.length, 2);
  assert.equal(webhooks[1].event, 'proposal.pricing_viewed'); ok('first pricing view fires webhook');
  await send({ type: 'pricing_viewed' }); await flush();
  assert.equal(webhooks.length, 2); ok('repeat pricing view does not re-fire webhook');
  await send({ type: 'section_time', meta: { seconds: { overview: 12, investment: 45 } } });
  await send({ type: 'section_time', meta: { seconds: { investment: 30 } } });
}

// ---- 5. Detail endpoint aggregates ----
{
  const j = await (await authed(`/api/proposals/${id}`)).json();
  assert.equal(j.status, 'viewed');
  assert.equal(j.reading_time_seconds.investment, 75);
  assert.equal(j.reading_time_seconds.overview, 12);
  assert.ok(j.first_viewed_at); ok('detail endpoint aggregates reading time per section');
}

// ---- 6. Acceptance ----
{
  const accept = (body) => req(`/p/${slug}/accept`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await accept({ name: 'S', agree: true })).status, 400); ok('rejects too-short name');
  assert.equal((await accept({ name: 'Sarah Chen', agree: false })).status, 400); ok('rejects missing agreement');
  const r = await accept({ name: 'Sarah Chen', agree: true });
  assert.equal(r.status, 200); await flush();
  assert.equal(webhooks[2].event, 'proposal.accepted');
  assert.equal(webhooks[2].meta.name, 'Sarah Chen'); ok('acceptance recorded, webhook fired');
  assert.equal((await accept({ name: 'Sarah Chen', agree: true })).status, 409); ok('double acceptance blocked (409)');

  const html = await (await req(`/p/${slug}`)).text();
  assert.ok(html.includes('accepted-stamp') && html.includes('Sarah Chen'), 'accepted page shows stamp');
  assert.ok(!html.includes('id="accept-btn"'), 'accept button gone after acceptance');
  writeFileSync('/tmp/rendered-accepted.html', html);
  ok('re-rendered page shows acceptance stamp instead of form');

  const list = await (await authed('/api/proposals')).json();
  assert.equal(list.proposals[0].status, 'accepted');
  assert.equal(list.proposals[0].views, 3); ok('list endpoint reflects status and view count');
}

// ---- 7. Expiry ----
{
  const expired = structuredClone(proposalData);
  expired.expires_at = '2026-01-01';
  expired.data.proposal.valid_until = '2026-01-01';
  const j = await (await authed('/api/proposals', { method: 'POST', body: JSON.stringify(expired) })).json();
  const html = await (await req(`/p/${j.slug}`)).text();
  assert.ok(html.includes('<div class="expired-banner">'), 'expired banner shown');
  assert.ok(!html.includes('id="accept-btn"'), 'no accept button on expired proposal');
  const r = await req(`/p/${j.slug}/accept`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Sarah Chen', agree: true }) });
  assert.equal(r.status, 410); ok('expired proposal refuses acceptance (410)');
}

// ---- 8. XSS safety ----
{
  const evil = structuredClone(proposalData);
  evil.data.client.company = '<script>alert(1)</script>';
  evil.data.proposal.title = 'Test "quotes" & <tags>';
  const j = await (await authed('/api/proposals', { method: 'POST', body: JSON.stringify(evil) })).json();
  const html = await (await req(`/p/${j.slug}`)).text();
  assert.ok(!html.includes('<script>alert(1)</script>'), 'script tag escaped');
  assert.ok(html.includes('&lt;script&gt;'), 'escaped form present');
  ok('merge fields are HTML-escaped (XSS safe)');
}

// ---- 9. 404s ----
{
  assert.equal((await req('/p/doesnotexist123')).status, 404);
  assert.equal((await authed('/api/proposals/nope')).status, 404);
  ok('unknown slugs and ids return 404');
}

console.log(`\nAll ${pass} checks passed.`);
````

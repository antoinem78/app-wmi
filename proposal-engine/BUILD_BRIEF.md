# BUILD BRIEF: Proposal Engine on app.wmiltd.com

Session type: execution. Strategy and architecture are already decided in Claude Chat. Your job is to deploy, verify against reality, and report. Use the deliberate-execution skill if available.

## Mission

Deploy the proposal-engine codebase in this repository to Cloudflare Workers with D1, targeting the custom domain app.wmiltd.com. This is a self-hosted PandaDoc replacement for WMI Ltd: proposal generation, engagement tracking, click-wrap acceptance, and webhooks to n8n.

## Success condition (verify all of these against the live system, not against this document)

1. `npm test` passes locally: exactly 19 checks, before anything is deployed.
2. The worker is deployed and reachable. `GET /admin` returns 200 over HTTPS.
3. A real test proposal created via `POST /api/proposals` (use `examples/sample-proposal.json`) returns 201 with a URL, and that URL renders the full proposal page.
4. Opening the proposal URL inserts a `view` row in the remote D1 `events` table. Confirm with `npx wrangler d1 execute proposal-engine --remote --command "SELECT type, created_at FROM events ORDER BY id DESC LIMIT 5"`.
5. If a WEBHOOK_URL secret was set, the n8n webhook received a `proposal.viewed` payload. If no n8n URL is available this session, skip the secret and record this as an open item.
6. app.wmiltd.com serves the worker, OR the workers.dev URL is live and the domain attach is reported as the single remaining human step.

## Ordered steps

1. `npm install`, then `npm test`. Do not proceed past a failing test.
2. `npx wrangler whoami` to confirm which Cloudflare account you are authenticated against. If not authenticated, stop and report: this needs Antoine's Cloudflare credentials or an API token. Prepare everything else first so his step is minimal.
3. `npx wrangler d1 create proposal-engine`, copy the printed database_id into wrangler.jsonc, replacing REPLACE_AFTER_D1_CREATE.
4. `npm run db:schema` to apply schema.sql to the remote database. Verify: `npx wrangler d1 execute proposal-engine --remote --command "SELECT name FROM sqlite_master WHERE type='table'"` must list proposals and events.
5. Generate a strong random API_TOKEN (32+ chars) and set it: `npx wrangler secret put API_TOKEN`. Record the token in the final report for Antoine to store; it is needed for n8n and the /admin dashboard.
6. If an n8n webhook URL is provided in this session, set WEBHOOK_URL as a secret. Otherwise skip; the code treats it as optional.
7. First deploy WITHOUT the custom domain route (it is commented out in wrangler.jsonc). Note the workers.dev URL. Temporarily set APP_URL in wrangler.jsonc to that workers.dev URL and redeploy so returned links are correct.
8. Run the live verification: create a proposal from examples/sample-proposal.json via curl against the live URL, GET the returned proposal URL, confirm 200 and correct content, then check the events table per success condition 4. Test one failure path live: a POST to /api/proposals with a wrong bearer token must return 401.
9. Custom domain, gated: check whether the wmiltd.com zone exists in this Cloudflare account. If yes, uncomment the routes line in wrangler.jsonc, set APP_URL back to https://app.wmiltd.com, redeploy, and verify https://app.wmiltd.com/admin returns 200. If the zone is not in the account, do NOT attempt DNS changes anywhere; leave the workers.dev deployment live and report domain attach as the remaining step with exact instructions.

## Rules for this session

- Verify against reality at every step. Never assume a step worked because the command exited zero; read the output, query the table, hit the endpoint.
- Nothing here touches the existing wmiltd.com website, email, or any other DNS record. The only permitted DNS-adjacent action is attaching the app.wmiltd.com custom domain via Wrangler, and only if the zone already exists in the account.
- No secrets in any committed file. API_TOKEN and WEBHOOK_URL live only in Wrangler secrets. .dev.vars is gitignored and local only.
- Do not refactor, restyle, or extend the codebase this session. It is tested and verified as-is. Deploy first; improvements are a separate decision for Antoine.
- End with a short ledger: done and verified, open items, and the exact values Antoine needs (live URL, admin URL, API token, remaining human steps if any).

## Context you may need

- README.md documents the full API and data contract. examples/n8n-integration.md documents the n8n wiring for after deploy.
- Acceptance is click-wrap (name, timestamp, IP), not a qualified e-signature. Known limitation, accepted for v1.
- The database name, worker name, and D1 binding are all `proposal-engine` / `DB`. Keep them.

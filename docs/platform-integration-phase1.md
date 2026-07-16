# Platform integration — Phase 1: the client-identity spine

Turns the two planes (Engine A = this app; Engine B = the agent substrate, a
separate Supabase project) into one addressable client set, and gives the
console a read-only line into Engine B. Additive; nothing existing changes.

## What this phase ships
- `platform_client` table + seed (migration `0021_platform_client.sql`) — the map.
- `src/lib/substrate/read.ts` — read-only Engine B access (conversations, leads, agent health).
- `src/lib/platform/clients.ts` — resolves an Engine A client to its Engine B id.
- `pg` dependency.

No UI yet (that's Phase 2: cockpit read-panes). This is the foundation.

## Founder setup (three steps, all one-time)

### 1. A dedicated restricted read-only role in Engine B (substrate Supabase, ckxiqsufssibrrwdotad)
NEVER the service key. A role scoped to exactly the tables the cockpit reads — nothing more.
Run in that project's SQL editor:
```sql
CREATE ROLE substrate_readonly LOGIN PASSWORD '<choose-a-strong-password>';
GRANT CONNECT ON DATABASE postgres TO substrate_readonly;
GRANT USAGE ON SCHEMA public TO substrate_readonly;
-- Scoped grants only (not ALL TABLES): the cockpit's read surface.
GRANT SELECT ON public.conversations   TO substrate_readonly;
GRANT SELECT ON public.action_log      TO substrate_readonly;
GRANT SELECT ON public.kb_documents    TO substrate_readonly;
GRANT SELECT ON public.clients         TO substrate_readonly;  -- agent config/status only
-- No default-privileges grant: new tables are NOT auto-exposed; extend deliberately.
```
If you later add a cockpit read against another table, add one explicit GRANT here. That is the point.
Then build the connection string (use the pooler host, port 6543, sslmode require):
`SUBSTRATE_DB_URL=postgresql://substrate_readonly:<password>@<pooler-host>:6543/postgres?sslmode=require`

### 2. Add the env var
- Local: add `SUBSTRATE_DB_URL=...` to `.env.local`.
- Vercel: add `SUBSTRATE_DB_URL` to the project's environment variables.

### 3. Apply the migration
Through the normal migration path (Supabase SQL editor or `supabase db push`), apply
`supabase/migrations/0021_platform_client.sql` to THIS app's DB (idgkdbyplkyrtrfqiisf).
Then `npm install` (picks up `pg`).

## Verify
- `SELECT name, doorway, engine_a_client_id, engine_b_client_id FROM platform_client;` returns the 4 seeded rows (KST is the one with both engine ids set).
- A quick server-side call: `getAgentHealth('57464657-2479-4d99-a6b1-227395ad3f09')` (SingularWeb) returns non-zero conversations_7d — proves the read-only line works end to end. (The read queries themselves were validated against live substrate data on 2026-07-16.)

## Notes
- Map, don't migrate: `engine_b_client_id` is a stored uuid, no cross-DB FK.
- KST is the cross-plane anchor: Engine A `e97a0e8e…`, Engine B `a6cc693f…`. Once KST's GHL sub-account exists and its ads config lands in Engine B, backfill `ghl_location_id` here.
- Own-properties (SingularWeb, DentalMastery) are flagged `is_own_property=true` so the cockpit can separate them from external clients.

---

## Step 5 (agent control writes) — server-side path shipped, UI pending

The authoritative write engine is the n8n webhook **MAINT_agent_config_write** (id NAoO7NB5FTRwMfxj),
built + verified 2026-07-16: token auth (403 without), allowlist enforced server-side
(tier A/B writable, tier C rejected), value bounds, dryRun preview, and **atomic
config-write + audit** to `action_log` (workflow='CONSOLE', step='config_write', with
actor + old→new). Revert = apply the old value through the same audited path. All proven
live (apply→verify→revert→purge on DM display_name).

Console glue authored: `src/lib/platform/config-write.ts` + `src/app/(admin)/clients/agent-actions.ts`
(agency-admin gate + actor identity + revalidate).

### Two more env vars (server-side; never NEXT_PUBLIC)
- `SUBSTRATE_CONFIG_WRITE_URL` = https://singularweb.app.n8n.cloud/webhook/agent-config-write
- `CONSOLE_CONFIG_KEY` = the x-console-key value — copy it from the n8n credential
  "Console config-write auth (x-console-key)" (Credentials in n8n). Add to .env.local + Vercel.

### Remaining (next increment): the cockpit edit UI
Small client-component forms in `(admin)/clients/[id]`: tier-A inline edits calling
`applyAgentConfig`; tier-B "preview diff → confirm → apply" using `previewAgentConfig` then
`applyAgentConfig`; a "Re-ingest KB" button calling `requestKbReingest`; tier-C shown read-only.
Deferred deliberately so it's built once the cockpit read-panes are preview-verified.

### Note on KB re-ingest
The webhook currently **logs** the re-ingest request (audited). MAINT_kb_ingest runs on a
15-min schedule and re-ingests changed docs by hash, so a logged request is picked up within
the cycle. If immediate re-ingest is wanted, add a manual webhook trigger to MAINT_kb_ingest
(thin follow-on).

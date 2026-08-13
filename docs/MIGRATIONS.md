# Running migrations, and the guard that stops the wrong database

**Never run a migration by hand again.** Use the runner:

```bash
node scripts/migrate.mjs <file.sql> --db <portal|fzco|substrate>
```

It prints what it resolved and stops. Look at it, then re-run with `--yes` to apply.

## The three databases

| `--db` | What it is | Connection string |
|---|---|---|
| `substrate` | n8n, agents, knowledge base, tasks | `SUPABASE_DB_URL` in `~/.config/singularweb/substrate.env` |
| `fzco` | app.webmarketinginternational.com | `FZCO_DB_URL` in `~/.config/singularweb/fzco.env` |
| `portal` | app.wmiltd.com | `PORTAL_DB_URL`, **not set on this machine** |

The two portals share one codebase and one schema, so a `-- TARGET: PORTAL` migration is expected to run on **both** `fzco` and `portal`.

There is no direct Postgres URL for the wmiltd portal here, only the REST endpoint and service key, which cannot run DDL. Until someone adds `PORTAL_DB_URL`, those migrations go through the Supabase SQL editor by hand. The runner says so rather than failing obscurely.

## Every migration declares its target

First line, no exceptions. The runner refuses a file without one.

```sql
-- TARGET: PORTAL
-- TARGET: SUBSTRATE
```

All 31 existing files were stamped on 2026-08-12.

## Why the guard is three-way

On 2026-07-30 a migration meant for the portal was run against the substrate. Three databases and two parallel Code sessions, defended only by convention.

The runner checks three things and requires all three to agree:

1. **The file** declares its target.
2. **The operator** names a database with `--db`.
3. **The live connection is fingerprinted** and must match both.

Legs 1 and 2 are labels a human wrote, and on 30 July the human label is exactly what was wrong. **Leg 3 is the one that counts**: it asks the database what it actually is, so a mislabelled env var, a connection string pasted into the wrong shell, or a copied filename cannot get through.

## The fingerprint, and the trap in choosing it

**Both families have a `clients` table.** The obvious fingerprint would have passed on 30 July and taught us nothing.

The discriminators, verified against both live databases:

| Family | Has | Does not have |
|---|---|---|
| PORTAL | `onboarding_state` | `kb_documents` |
| SUBSTRATE | `kb_documents` | `onboarding_state` |

If a database ever matches both, or neither, the runner refuses and says the fingerprint needs updating. It does not guess.

## What it does when it runs

One transaction, so a migration that fails halfway leaves nothing behind, and a line appended to `docs/migration-log.txt` recording when, which family, which host and which file.

## Proven, 2026-08-12

Six refusal paths tested end to end: portal file aimed at the substrate, substrate file aimed at a portal, a file with no declared target, a database with no connection string, the correct pairing dry-running cleanly, and **a correctly-labelled file with a correctly-named database whose connection string secretly pointed at the substrate**. That last one is the real test, and it refused on the fingerprint alone.

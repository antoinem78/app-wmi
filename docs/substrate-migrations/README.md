# Migrations: which database does this one target?

**Read this before running anything in here. The directory name is misleading and has already caused one near-miss.**

There are **two separate Supabase projects**, and this folder holds migrations for both. On 2026-07-30 a table rename intended for the portal was pointed at the substrate; it rolled back cleanly because the table did not exist there, which was luck rather than design.

| Database | Credentials | What lives there | Direct SQL access from this machine |
|---|---|---|---|
| **Portal** (Rexos app) | `SUPABASE_URL` + `SUPABASE_SECRET_KEY` in `.env.local` | Everything the Next.js app reads via `createSupabaseAdminClient()`: `agent_conversations`, `agent_memory`, `onboarding_state`, `optimization_proposals`, `write_audit`, `activity_log` | **No.** REST only, which cannot run DDL. The founder runs these in the portal project's SQL editor. |
| **Substrate** (n8n) | `SUBSTRATE_DB_URL` in `.env.local`, `SUPABASE_DB_URL` in `~/.config/singularweb/substrate.env` | What the n8n workflows read and write, including `clients` and the task and action logs | **Yes**, via the `pg` client. |

**How to tell which one a migration needs.** Follow the code that reads the table. If it goes through `createSupabaseAdminClient()` from `@/lib/supabase/server`, it is the **portal**. If an n8n workflow touches it, it is the **substrate**.

**Every migration file must state its target in its header comment.** Retrofitted below for the existing ones.

| File | Target | Applied |
|---|---|---|
| `0001_growth_action.sql` | substrate | yes |
| `0002_bernard_memory.sql` | **portal** | yes, 2026-07-30 |
| `0003_agent_memory.sql` | **portal** | pending founder |

**Before running a `pg`-client migration, assert the target.** A cheap guard that would have caught the near-miss:

```sql
-- at the top of any substrate migration
do $$ begin
  if to_regclass('public.agent_conversations') is not null then
    raise exception 'This looks like the PORTAL database. Substrate migration aborted.';
  end if;
end $$;
```

**Claim your migration number here when you start one**, since parallel sessions run on this repo and two `0004_`s would collide.

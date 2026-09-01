---
name: vercel-sensitive-env-pull-returns-stubs
description: vercel env pull cannot read Sensitive variables; it hands back a short stub that fails silently when used as the real value
metadata: 
  node_type: memory
  type: project
  originSessionId: c838c79d-dc60-478b-b104-5962dd7bb927
  modified: 2026-08-31T10:41:06.674Z
---

`vercel env pull` on the app-wmi project returns real values only for Non-sensitive variables. A variable stored as Sensitive comes back as a short stub (observed as an unexplained 11-character string), not its value, and nothing marks it as fake.

**Why:** Vercel sensitive env vars are write-only by design. On 2026-08-31 the pulled `CRON_SECRET` stub produced two Unauthorized cron runs before the real 48-character secret was found in the repo's `.env.local`.

**How to apply:** before using a pulled env value, check `vercel env ls` for the Sensitive flag; a Sensitive variable cannot be recovered from Vercel at all, so look in `.env.local`, `~/.config/singularweb/*.env`, or ask the founder. A pulled value with a length that does not match the credential type (secrets here are typically 32+ chars) is a stub, not a short secret. Related: [[one-shared-key-authenticates-everything]].

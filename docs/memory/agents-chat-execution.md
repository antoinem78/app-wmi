---
name: agents-chat-execution
description: "Bernard and Oscar execute from portal chat as of 2026-08-01 — tools, gates, GOOGLE_build, shared memory — and where each piece lives"
metadata: 
  node_type: memory
  type: project
  originSessionId: e62c54fd-f7d4-4840-a05c-5fa8a6ecc004
  modified: 2026-08-02T20:15:02.755Z
---

As of 2026-08-01 both portal agents execute from chat on the founder's explicit word:

- **Bernard (Meta)**: `dispatch_build` → n8n `BERNARD_build` webhook (entities PAUSED, pre-flight gates, write budget, allow-list, build_ref idempotency, read-back-verified report). Plus `decide_fix`, `stand_down`, `run_audit`, memory tools. Brain: `src/lib/integrations/anthropic/bernard-agent.ts`; webhook lib `src/lib/bernard.ts` (`BERNARD_WEBHOOK_KEY`).
- **Oscar (Google)**: `dispatch_build` → `buildGoogleCampaign()` in `src/lib/integrations/google-ads/build.ts` (portal-side because Google creds live there). SEARCH only; atomic single mutate (all-or-nothing); campaign always PAUSED, children ENABLED so activation is one toggle; `validate_only` = Google server-side dry run; verify by re-read; every attempt in `write_audit`. Also `list/decide/apply/dry_run_proposal` wired to the same functions as the Proposals page. Gates: `GOOGLE_ADS_WRITE_ENABLED`, `GOOGLE_ADS_WRITE_CUSTOMERS` allowlist, **lifted account-wide by `ALLOW_ALL_MCC_ACCOUNTS=true`** (see `guardAllowlist` in write.ts) — check Vercel env before claiming an account is blocked.
- **Shared memory**: `agent_memory.shared` flag (migration 0004, applied). Owner-only edit; all agents read shared rows with provenance. Client-kind memories + cross-channel facts are shared; platform tactics private.

**Why Search only in GOOGLE_build:** PMax/Demand Gen need uploaded creative assets (images/video) and asset groups; Shopping needs Merchant Center link + listing group trees. Search builds from pure text. Shopping is the cheapest next build (no creative assets); PMax/DG need an asset-ingestion pipeline first.

**Agent relay (2026-08-03):** Code sessions reach the real deployed Bernard and Oscar via `scripts/agent-relay.mjs <agent> "msg"` (repo skills `/bernard` and `/oscar`; Oscar takes `--scope <client-uuid>`); shared thread with the portal through `agent_conversations`. Never impersonate the agents, relay verbatim. Auth: `BERNARD_RELAY_KEY` / `OSCAR_RELAY_KEY` in `.env.local` + Vercel. Bernard production-verified 2026-08-03. The founder's model: one person, multiple surfaces.

`docs/PROJECT_STATE.md` (auto-loaded via AGENTS.md pointer) is the operational source of truth; this memory is the pointer map, not the detail.

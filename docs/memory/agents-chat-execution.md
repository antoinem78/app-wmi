---
name: agents-chat-execution
description: "Bernard and Oscar execute from portal chat as of 2026-08-01 — tools, gates, GOOGLE_build, shared memory — and where each piece lives"
metadata: 
  node_type: memory
  type: project
  originSessionId: e62c54fd-f7d4-4840-a05c-5fa8a6ecc004
  modified: 2026-08-26T15:35:38.453Z
---

As of 2026-08-01 both portal agents execute from chat on the founder's explicit word:

- **Bernard (Meta)**: `dispatch_build` → n8n `BERNARD_build` webhook (entities PAUSED, pre-flight gates, write budget, allow-list, build_ref idempotency, read-back-verified report). Plus `decide_fix`, `stand_down`, `run_audit`, memory tools. Brain: `src/lib/integrations/anthropic/bernard-agent.ts`; webhook lib `src/lib/bernard.ts` (`BERNARD_WEBHOOK_KEY`).
- **Oscar (Google)**: `dispatch_build` → `buildGoogleCampaign()` in `src/lib/integrations/google-ads/build.ts` (portal-side because Google creds live there). SEARCH only; atomic single mutate (all-or-nothing); campaign always PAUSED, children ENABLED so activation is one toggle; `validate_only` = Google server-side dry run; verify by re-read; every attempt in `write_audit`. Also `list/decide/apply/dry_run_proposal` wired to the same functions as the Proposals page. Gates: `GOOGLE_ADS_WRITE_ENABLED`, `GOOGLE_ADS_WRITE_CUSTOMERS` allowlist, **lifted account-wide by `ALLOW_ALL_MCC_ACCOUNTS=true`** (see `guardAllowlist` in write.ts) — check Vercel env before claiming an account is blocked.
- **Bernard optimise (`BERNARD_optimise`, `dispatchOptimise` / `decideMove` in `src/lib/bernard.ts`)**: dispatch moves, Norbert reviews, nothing runs until `decide_move` approves ONE move. **Verified in code 2026-08-19: `OptimiseMove.op` is `"pause" | "budget" | "unpause"` ONLY**, across `entity_type` campaign/adset/ad.
- **Shared memory**: `agent_memory.shared` flag (migration 0004, applied). Owner-only edit; all agents read shared rows with provenance. Client-kind memories + cross-channel facts are shared; platform tactics private.

**THE EXECUTION GAP, and it catches the founder out: nothing Bernard has can EDIT AN EXISTING ENTITY'S TARGETING.** `BERNARD_build` creates new entities paused, it does not modify existing ones. `BERNARD_optimise` moves only pause, budget and unpause. `BernardFix` is approve/reject on a fix Bernard himself proposed from monitoring, not an arbitrary mutation channel. So **applying an exclusion audience, changing interests, editing placements or age on a live ad set is outside all three and still needs a human in Ads Manager.** Hit on Steffen Foerster 2026-08-19: the founder's reasonable expectation was "that's the whole point of Bernard build and Bernard optimise, founder doesn't have time to apply manual changes", and Bernard's refusal was correct rather than conservative. The narrow verb list is a deliberate safety choice, since a targeting mutation is far more dangerous than a budget change, but the gap is real and worth closing with a gated `audience`/`targeting` op. Rebuilding the ad set through `BERNARD_build` is technically possible but resets learning, so it is not a workaround for a small targeting edit.

**Why Search only in GOOGLE_build:** PMax/Demand Gen need uploaded creative assets (images/video) and asset groups; Shopping needs Merchant Center link + listing group trees. Search builds from pure text. Shopping is the cheapest next build (no creative assets); PMax/DG need an asset-ingestion pipeline first.

**Agent relay (2026-08-03):** Code sessions reach the real deployed Bernard and Oscar via `scripts/agent-relay.mjs <agent> "msg"` (repo skills `/bernard` and `/oscar`; Oscar takes `--scope <client-uuid>`); shared thread with the portal through `agent_conversations`. Never impersonate the agents, relay verbatim. Auth: `BERNARD_RELAY_KEY` / `OSCAR_RELAY_KEY` in `.env.local` + Vercel. Bernard production-verified 2026-08-03. The founder's model: one person, multiple surfaces.

`docs/PROJECT_STATE.md` (auto-loaded via AGENTS.md pointer) is the operational source of truth; this memory is the pointer map, not the detail.

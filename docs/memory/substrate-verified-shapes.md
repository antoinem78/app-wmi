---
name: substrate-verified-shapes
description: "Live-verified substrate facts from the 2026-07-30 shape verification (n8n version, raw-body HMAC proof, RLS bypass, OCT routes)"
metadata: 
  node_type: memory
  type: project
  originSessionId: c838c79d-dc60-478b-b104-5962dd7bb927
  modified: 2026-07-30T19:26:19.333Z
---

Full report: `~/Documents/REPORT_commerce_substrate_shape_verification_2026-07-30.md` (answers CODE_BRIEF_1b, all items LIVE-VERIFIED). Facts a session should not rediscover, verified 2026-07-30:

- n8n cloud instance is **n8n@2.31.5**. Public API reachable with `N8N_API_KEY` from `~/.config/singularweb/substrate.env`. Version is not in any API response; it is the release tag in the frontend JS bundle.
- **Raw-body signature verification is proven live** in `RCV_manus_events`: webhook `options.rawBody: true`, then `this.helpers.getBinaryDataBuffer(0,'data')` + `require('crypto')` in a Code node. Re-serialised JSON broke verification once (2026-07-20, unicode escaping), which is why rawBody is there.
- The conversion plane (`ckxiqsufssibrrwdotad`) is reached via `SUPABASE_DB_URL` (full `postgres` role, **rolbypassrls=true**, so tenant RLS policies do not bind n8n; they bind `substrate_readonly` and API roles only) and `SUBSTRATE_READONLY_URL`. No non-public schema exists; no DEV database exists.
- OCT has two live legs: `CAP_offline_conversions_push` → two **Make.com** webhooks (Google + Microsoft, Shallowford), and `RCV_kst_stage_change` → `https://app.wmiltd.com/api/oct/upload` (this repo, `src/app/api/oct/upload/route.ts`, x-oct-key).
- Live `RCV_form_routing` still carries a raw Shallowford PIT inline; the config-driven caller version sits in `RCV_form_routing_DEV` awaiting cutover. Related: [[verify-who-controls-infrastructure]].

---
name: one-shared-key-authenticates-everything
description: "A single n8n header credential authenticates 14 substrate endpoints including Meta campaign builds, so never hand it to a contractor for one receiver"
metadata: 
  node_type: memory
  type: reference
  originSessionId: e681e72c-73a3-49cf-b296-e68ed1ac596d
  modified: 2026-08-19T20:06:58.407Z
---

The n8n httpHeaderAuth credential **"Bernard dispatch auth (x-bernard-key)"** (id `L6Pw2vZt2DM7Qa8k`, value `BERNARD_DISPATCH_KEY`) is shared across **14 webhook endpoints in 12 workflows**, verified 2026-08-20:

`BERNARD_build`, `BERNARD_optimise`, `BERNARD_optimise_execute`, `BERNARD_fix` (propose **and** approve), `BERNARD_dispatch`, `BERNARD_standdown`, `BERNARD_status`, `CAP_meta_conversions`, `RCV_wa_inbound_wmi`, `RCV_dm_ghl_events` (two Meta CAPI nodes), `OP_call_bridge`, `RCV_vip_ctm_leads`.

**Why it matters:** the estate routinely needs to give an outside party access to exactly one receiver. VIP's CTM contractor needed to POST call data to `vip-ctm-lead`. Handing over the header value for that one endpoint would also have handed over the ability to trigger **Meta campaign builds, fix approvals and optimise execution** across every client, plus push conversions to Meta. One key, no scoping.

**How to apply:** before sharing any substrate webhook credential with a contractor, client or third-party tool, **enumerate every node using that credential id** first. Scan all workflows via the n8n API and match on `credentials.httpHeaderAuth.id`; do not judge by the credential's name, which describes its origin rather than its reach. If it is shared, mint a **dedicated credential for that single receiver** and reassign that webhook node before sharing anything. Treat the same way as a database role: the question is never "is this key valid" but "what does this key reach".

Related: [[agent-runtime-crm-write-allowlist]], [[claude-meta-read-only-ruling]].

---
name: blueprint-clone-rewire-incomplete
description: "Cloning a client from a blueprint copies the source client's literal strings; the rewire is routinely left unfinished, so audit every surface before go-live"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: e681e72c-73a3-49cf-b296-e68ed1ac596d
  modified: 2026-08-16T18:25:14.155Z
---

When a client is provisioned by cloning a blueprint (VIP Accounting from "Accountancy Blueprint v1" / KST, 2026-07-31), the clone copies the **source client's literal strings** into the new client's systems. The documented rewire checklist exists precisely for this and has been left unfinished at least once.

Three KST strings were still live in VIP's systems on 2026-08-16, two weeks after provisioning:

- **Web chat agent `clinical_gate.emergency_phone` = `020 3150 2074`**, byte-identical to KST's. This is the number the agent gives a visitor who says they have missed a filing deadline, so a distressed VIP prospect would be sent to a rival firm.
- **The GHL pipeline is named `KST Leads`** in VIP's own account, which the client sees on their own Opportunities board.
- Previously recorded: cloned OCT workflows still posted `"client_slug": "kst"`.

**Why:** a clone is invisible-by-default. Nothing errors, nothing looks broken, and the wrong values only surface when a real user hits the exact path that reads them. The phone number was found only by shadow-testing the emergency branch; no amount of config review had caught it in two weeks.

**How to apply:** before any cloned client goes live, grep the new tenant for the source client's literal strings across *every* surface, not just the ones on the checklist: substrate `clients.config` (agent display name, disclosure, emergency phone, log channel, location id), GHL pipeline and stage names, workflow names and webhook payloads, tags, and calendar/booking links. A fast cross-tenant check is to select the same config path for all tenants at once and look for duplicate values, which is how the phone number was caught. Treat a value that is *identical across two tenants* as guilty until proven shared by design.

Related: [[client-product-facts-need-verifying]], [[never-infer-delivery-from-repo]].

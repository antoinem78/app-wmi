---
name: claude-meta-read-only-ruling
description: Founder ruling 2026-07-24 — Claude never writes to Meta; read-only Graph API access only
metadata: 
  node_type: memory
  type: feedback
  originSessionId: e62c54fd-f7d4-4840-a05c-5fa8a6ecc004
  modified: 2026-07-24T19:17:08.404Z
---

Founder ruling (2026-07-24, after denying a script that would have created Meta custom audiences directly): **"we don't want Claude to touch meta unless it's read only."**

**Why:** Meta writes are governed work. The lab architecture assigns execution to Manus (under Bernard's doctrine + verification) or to the founder manually; Claude executing Graph API writes directly — even benign setup writes like audience creation, dataset creation, or campaign scaffolding — bypasses that governance lane. The founder caught exactly this and denied it.

**How to apply:** Any Meta Graph API call Claude makes must be GET/read-only (audits, roster, insights, verification reads are all fine — Bernard's read layer). When work requires a Meta write, the options are: (1) dispatch Manus via the substrate lab pattern (Bernard briefs, everything created PAUSED, founder activates), or (2) hand the founder exact manual steps for the Ads Manager UI. Never offer "I can do that write via API on your go" — the answer is already ruled. Related: [[singularweb-brand-entity-map]].

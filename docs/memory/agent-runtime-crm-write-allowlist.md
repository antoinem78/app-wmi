---
name: agent-runtime-crm-write-allowlist
description: "The conv agent runtime's CRM write leg is gated by a hardcoded GHL location allow-list in AGENT_postpass, so shadow-testing an unlisted tenant is safe"
metadata: 
  node_type: memory
  type: reference
  originSessionId: e681e72c-73a3-49cf-b296-e68ed1ac596d
  modified: 2026-08-16T18:25:30.449Z
---

`AGENT_postpass` node **"GHL gateway"** holds a server-side allow-list of GHL location ids. Only listed locations can have a contact, task or note written by the web chat agent. As of 2026-08-16:

- `ZuLmGclIE7hmgV0q2tXY` → template (zz-rehearsal)
- `YT3zkRv2oyeo1PSUQqVR` → dental-mastery
- `Zts49PaUrbGfHuBtpknt` → kst

A write also requires at least one of name / phone / email to have been captured. Everything else returns `ghl: 'skipped'` with a reason.

This answers the question PROJECT_STATE §"Conversational agent runtime" flagged as unverified (what triggers the CRM leg on some conversations and not others). **Adding a location to that list IS the go-live act for that client**, per the node's own comment.

**Why it matters:** it makes shadow-testing an unlisted tenant safe. Testing VIP (`2acFC47p3x6Qdoqm7JWN`, not listed) produced zero CRM writes, confirmed by read-back.

**How to apply:** before shadow-testing any tenant's web chat, check whether its location is on that allow-list. If it is not, the blast radius is only `public.conversations` + `tasks` rows and Slack posts. What is **not** gated: Slack. `Notify client channel (lead)` fires on `need_handoff` with any `log_channel` set, and `Alert #alerts (escalate)` fires on any escalation class, in shadow mode, for any tenant. Label test sessions unmistakably (the house precedent is `kst-diag-N`, `vip-shadow-NN`) because nothing else distinguishes a test conversation from a real one.

Related: [[claude-meta-read-only-ruling]].

# Future SaaS — deferred ideas (DO NOT BUILD until productization is decided)

Anything here is a roadmap note, not a build task. The MaaS ops app is single-tenant
(the tenant is PPC Mastery; clients are records). These are the additive changes that
would turn it into a multi-tenant SaaS later — captured so we don't forget them and
don't build them early.

- End-client auth tier (clients log into their own scoped view)
- Switch on Supabase RLS over existing tables (scope by client/org)
- Self-serve signup + provisioning (no manual link-send)
- Plan tiers enforced at the billing + feature-gate layer
- Multi-tenant Google Ads OAuth credential isolation (per-tenant refresh tokens)
- End-client reporting dashboard
- The self-serve campaign-builder product itself (the SaaS — separate entity, involves
  Thierry as a shareholder; not a MaaS decision)

Rule: a feature only leaves this file when productization is an explicit, validated
decision — not "while we're at it."

---

## Deferred integrations & ops ideas (not SaaS-tier — just not now)

These aren't multi-tenant SaaS features; they're future enhancements parked to
protect current scope. Same rule: capture, don't build.

- **Google Drive — client asset intake** (logos, creative). Low priority; Slack file
  sharing covers it for now. NOTE: the onboarding *questionnaire* is a NATIVE wizard
  step (answers → Supabase `onboarding_state.questionnaire_data`), NOT a Google Form —
  so Drive is not needed for the questionnaire.
- **Claude integrated into the PPC Mastery Slack workspace** — AI ops assistant for the
  PPC-masters team. Fits the "AI agents later" operating model; revisit post-MaaS.

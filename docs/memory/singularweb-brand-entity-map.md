---
name: singularweb-brand-entity-map
description: "Corrected brand/entity map - \"Mastery\" brands are outside SingularWeb; SingularWeb is the infra/engine owner"
metadata: 
  node_type: memory
  type: project
  originSessionId: e62c54fd-f7d4-4840-a05c-5fa8a6ecc004
---

Founder correction (Antoine, 2026-07-05), authoritative over the canonical docs:

- **"Mastery" branding = OUTSIDE SingularWeb branding.** Any brand with the "Mastery" suffix (PPC Mastery, Dental Mastery, future *Mastery verticals) belongs to the PPC Mastery family, NOT SingularWeb. Dental Mastery is a PPC Mastery product, not a SingularWeb vertical.
- **SingularWeb = the infrastructure / engine owner.** It owns the substrate (Supabase, n8n, the GHL/n8n workflows, the AI agents) AND owns Rexos (Rexos is a SingularWeb product).
- **Current iteration:** PPC Mastery AND Dental Mastery both depend on SingularWeb infrastructure.
- **Future:** PPC Mastery will spin out its own Supabase, own n8n, own everything (full infra independence).
- **The vertical Mastery sites (e.g. Dental Mastery) stay reliant on the GHL/n8n workflows and AI agents owned by SingularWeb**, even after PPC Mastery's core becomes independent. This is the "Intel Inside" model: SingularWeb is the engine behind the Mastery-branded verticals.

**Why this matters:** it corrects the State-of-the-Union handover (2026-07-05) §2/§4, which frames DentalMastery as SingularWeb's own "first vertical brand / Layer 3 template". Per the founder, the Mastery brand lineage is distinct from SingularWeb; SingularWeb is the underlying engine, not the brand. The canon (Vision, handover entity map) needs a touch-up to match. See [[singularweb-substrate-sprint-context]].

**How to apply:** when reasoning about the matrix, treat SingularWeb as the infra+Rexos owner and the Mastery names as consuming brands. A "DentalMastery Rexos deployment" = SingularWeb's Rexos platform serving a PPC-Mastery-family vertical, under credential isolation, still riding SingularWeb-owned workflows/agents.

**Future-state layering law (Antoine, 2026-07-05):**
- **PPC Mastery = the Paid Media platform.** Stays a Rexos-like product and turns into a SaaS, gaining a campaign builder. It has NO vocation to become a growth/business OS. It uses n8n + Supabase only within certain of its own operations. Anything in the realm of GHL, AI agents, OCT, workflows lights up only when PPC Mastery is plugged into SingularWeb.
- **SingularWeb = the Growth Operating System / Business Operating System.** Owns GHL, AI agents, OCT, workflows, the whole growth/business OS layer (plus Rexos and the substrate).
- **Rexos and PPC Mastery are sibling, similar-shaped platform products;** Rexos is SingularWeb's, PPC Mastery is the paid-media SaaS.
- **Mastery verticals obey the same law:** Paid Media from PPC Mastery infrastructure + the whole growth/business OS from SingularWeb. They compose the two.

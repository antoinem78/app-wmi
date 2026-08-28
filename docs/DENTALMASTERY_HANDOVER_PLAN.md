# DentalMastery.ai handover: everything into the PPC Mastery AI workspace

**2026-08-28. Written by the platform session.** Goal: all DentalMastery work (website and landing pages, strategy, Google and Meta acquisition, cold email, compliance) lives in one Claude Workspace on the other machine, with Rexos keeping only the plumbing it physically hosts.

## Why this move is structurally right, not just tidier

**DentalMastery.ai belongs to ADENERGY SP. Z O.O.** (Poland, KRS 0001251633), which sits **outside SingularWeb** per the entity map. It is GDPR-governed with UODO as supervisory authority. Its work has been living inside SingularWeb's operational repo by convenience, and the 5 August canon sweep already flagged the entity contradiction as needing a ruling. Moving the workspace to the Mastery side resolves that operationally, and it puts the compliance workstream inside the entity that actually carries the obligation.

## The two entanglements that cannot move by copying files

**1. DM's Meta advertising runs inside the WMI UK ad account** (`act_1027063116856202`), because the founder hit his Business Portfolio limit. That means DM's Meta history, pixel events and spend live in another entity's account. The new workspace can read nothing there without SingularWeb credentials. **Founder decision needed: keep advertising through WMI UK (and accept the cross-entity seam forever), or stand up DM's own portfolio and ad account as part of this move.** The paid-traffic audit already recommends fresh accounts (none exists for Google either), which makes now the cheapest moment to separate cleanly.

**2. DM's CRM and agent plumbing is substrate-hosted**: GHL location `YT3zkRv2oyeo1PSUQqVR` (token name `GHL_DENTALMASTERY_PIT`), the disabled chat agent tenant, 3 KB documents, the KB ingest, and the dentalmastery.ai chat widget that still captures visitor messages into an unread void (open founder decision since 5 August). **Recommendation: plumbing stays in the substrate for now**; it works, it is metered, and moving it is a rebuild, not a copy. The new workspace gets the credential *names* and the runbooks, and operates it remotely. Revisit only if Mastery separation must become total.

## What moves: the pack manifest

One transport, the proven pattern from the booking engine: **a single `DENTALMASTERY_HANDOVER_PACK.md`** embedding every file verbatim with a SHA-256 each, committed to a new git repo that becomes the PPC Mastery AI workspace. Machine two clones it; nothing travels by paste.

| Goes in the pack | From |
|---|---|
| `DM_AI_BATTLE_PLAN.md` | ~/Documents (strategy) |
| `DM_AI_LOOKALIKE_STRATEGY.md` | ~/Documents |
| `DM_AI_GHL_CONVERSION_SETUP.md` | ~/Documents |
| `DM_AI_LEGAL_PAGES.md` + the legal pages HTML | ~/Documents (compliance) |
| `DMAI_PAID_TRAFFIC_AUDIT.md` | repo (the Google+Bing foundation plan, dependency-ordered) |
| `docs/clients/dental-mastery.md` | repo (channel state) |
| GHL location readout | generated fresh at pack time: pipelines, the 6 draft workflows, 3 forms, 16 custom fields, calendar |
| Substrate agent config JSON + the 3 KB docs | generated at pack time |
| Relevant PROJECT_STATE extracts | §1 ADENERGY row, the runtime-parked note, standing rulings |
| Memory seed | the binding rulings plus dental-relevant lessons (see below) |
| Credential name inventory | names only, never values, with where each lives |
| Open items ledger | task 21 state, the widget-void decision, the R13 entity reconciliation, the six draft workflows |

**Memory seed, selected not wholesale.** The new workspace starts its `docs/memory/` (in-repo, the lesson learned here) with: the founder rulings block (no em dashes, first-person-singular client voice, absence claims need two probes plus the public surface, dig NS **and** SOA, never UI-automate Meta Ads Manager), plus the dental-relevant lessons: `dental-mastery` slug discipline, GBP-is-a-separate-call-surface, silence-is-not-a-signal-without-traffic, configured-is-not-rendered, nurture-consent-at-collection, contact-created-is-not-opportunity-created. SingularWeb-internal lessons (substrate shapes, relay mechanics) stay here.

## The Shallowford boundary, stated before anyone crosses it

Shallowford Smiles is **a different client**. What transfers is **patterns, never client data**: the dental-vertical lessons (clinical gate behaviour that held under testing, call-tracking layer caution, OpenDental integration experience, what 37 KB documents look like when a dental knowledge base is done properly). Its contact records, conversations and documents do not move into another company's workspace, full stop.

**The pull itself happens on the other machine**, which already holds the long Shallowford sessions and already owes a rewrite of `docs/clients/shallowford-smiles.md`. One instruction covers both: that session writes its channel file properly AND produces `SHALLOWFORD_DENTAL_LESSONS.md`, sanitised to patterns, which the PPC Mastery workspace ingests.

## Sequence, with owners

| # | Step | Owner | Depends on |
|---|---|---|---|
| 1 | Rule on the two entanglements: Meta account separation, plumbing stays-or-moves | **Founder** | nothing |
| 2 | Create the new repo + workspace shell (CLAUDE.md carrying the binding rulings, empty memory dir, channel conventions adapted) | This session | 1 |
| 3 | Assemble `DENTALMASTERY_HANDOVER_PACK.md` with checksums, commit to the new repo | This session | 2 |
| 4 | Shallowford machine: rewrite its channel file, produce the sanitised dental-lessons digest | **Other machine** | prompt below |
| 5 | Chat: strategy canon for the new workspace (positioning, ICP, offer, the five workstreams as a roadmap) | **Chat**, briefed from the pack | 3 |
| 6 | New workspace day one: verify pack checksums, read the audit, start on the workstream the founder names first | New machine | 3, 4 |
| 7 | Tombstone here: `dental-mastery.md` points at the new workspace, PROJECT_STATE index updated, Rexos sessions stop DM work except substrate plumbing ops | This session | 6 confirmed |

## What the new workspace must know it does NOT have

No Google Ads or Microsoft account exists (creation is founder-only; the audit's dependency order stands). The site carries **no Google measurement at all**, verified twice. dentalmastery.ai DNS is at **GoDaddy** (`domaincontrol.com` nameservers), NS and SOA agree, so no orphan-zone trap, but nobody has recorded who holds the GoDaddy login. Cold email has **no existing infrastructure on record anywhere**; it starts from zero, and PECR/GDPR applies from the first send, under ADENERGY's own obligations, which is exactly why compliance is in the workstream list.

## The credential handover rule

Names move, values never do. The pack lists each credential name, what it unlocks, and where the value lives today (`substrate.env` on this machine, or a dashboard). Getting values onto machine two is the founder moving them directly, never through a document, never through chat.

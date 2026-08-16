# The skincare venture (founder's own brand)

**Channel file for the own-brand session.** Read `docs/PROJECT_STATE.md` §1, §2 and §7 first. Owned by this venture's session. This is a founder property: the tier-four "no client website builds" rule explicitly does not apply, and there is no client to protect, which is the whole strategic point.

**Naming note:** this venture's own documents call the founder **Antoine**, not the client-facing "Anthony". Use Antoine in venture material.

## Governing documents, in precedence order

1. `~/Downloads/VENTURE_PLAYBOOK_face_cream_UAE.md` (2026-08-12). The canonical playbook: sourcing route, manufacturer document pack, UAE registration spine, distribution, critical path, budget and kill-criteria shapes. **Wins on substance.**
2. `~/Downloads/SKINCARE_VENTURE_PROJECT_INSTRUCTIONS.md` (2026-08-12). The decision record and working method. **Wins on working method.**
3. `~/Documents/SINGULARCOMMERCE_STRATEGY_VERDICT_2026-08-12.md`. The verdict that authorised the venture: own-brand launch with claims-gated AI consultation = PROTOTYPE.
4. `~/Downloads/SingularCommerce.ai — Strategy Session Brief.md` (2026-07-29). Origin document, superseded on specifics.

**Where the work lives.** A separate Claude Chat project owns brand, product, sourcing, regulatory, packaging, unit economics and the commercial plan. This Code channel owns the engine side: store, tracking, attribution, consultation runtime, marketing automation, and the claims gate as configuration. Do not silently absorb the other project's scope; if a drafting task here belongs to it (an ODM brief, a name shortlist), say so and hand it back.

## The decision record (do not relitigate; amend only on the founder's word)

Corrected 2026-08-15: this file previously listed product and market as open. **Both were decided 2026-08-12.**

1. **The venture is decided.** An own-brand skincare company with its own budget and kill criteria, not a side experiment. Its store doubles as the SingularCommerce reference implementation, but the brand must stand commercially on its own.
2. **Market: UAE.** This fixes the claims dictionary, the registration path, Arabic labelling and the ad channels. The UK is the documented fallback only if UAE licensing proves disproportionate. **Consequence this file previously got wrong: the consultation data question is UAE PDPL, not UK/EU GDPR.**
3. **Product: one SKU, a face cream. No SPF in v1** (SPF changes the regulatory classification). An existing formulation white-labelled from a Korean ODM; custom formulation is a v2 question.
4. **Entity: unresolved but scoped.** WMI FZCO holds services activities only (marketing management, project management, management consultancies). A trading or e-commerce activity is required before import or sale. Three routes in preference order: add an activity to the existing licence, take a second licence under the same free zone (preferred if cheap, for product-liability separation from the agency), or a new entity. V1 decides.
5. **Fulfilment: DTC only via a Dubai 3PL** with temperature-controlled storage. Amazon.ae and Noon are phase 2; retail is not on the map.

## What is still genuinely open: V1 to V8

Nothing regulatory is settled until these land. **Standing epistemic rule: every regulatory specific is unverified until a licensing agent, lawyer or current official source confirms it.** Training knowledge about UAE cosmetics regulation is assumed stale. Never state a fee, portal name or processing time as fact without a verification marker.

| # | Verification | Owner | Gates |
|---|---|---|---|
| V1 | Free zone activity addition: availability, cost, timeline; second-licence option and price | Founder (one call) or licensing agent | Entity route |
| V2 | Cosmetics registration regime: municipal (Montaji-class) vs federal (MOIAT/ECAS) split, fees, documents, timing | Licensing agent | Registration clock |
| V3 | Arabic labelling: exact current requirements | Same agent; feeds ODM artwork | Packaging print |
| V4 | Free-zone-to-mainland B2C mechanics: importer of record, duty flow, 3PL customs | Agent + shortlisted 3PL | Fulfilment design |
| V5 | **PDPL legal read on attributable consultation data** | Lawyer | Consultation storage |
| V6 | VAT threshold and voluntary-registration recommendation | Accountant | Commercial setup |
| V7 | UAE trademark search on the name shortlist | Trademark agent | Anything public |
| V8 | Halal certification: ODM cost premium vs conversion value | Founder, after ODM quotes | SKU spec |

V2 is the single most important item in the document. V5 is this channel's item, see below.

## V5 is an engine problem, not only a legal one (verified 2026-08-15, this channel)

The standing gate is absolute: **the consultation stores nothing attributable to a person until V5 clears, whatever any other document implies.** Read directly against the substrate (read-only role, no content read, counts only) to establish whether that gate is reachable by configuration on the existing runtime. It is not.

- **Transcript persistence is unconditional.** `public.conversations` carries a `transcript` jsonb column and all 24 live rows across all five clients have a non-empty transcript. There is no configuration that turns it off, because it is the table's core column.
- **`mode` is not a privacy control.** Every row on record reads `mode: shadow`, including the rows that wrote to the CRM. PROJECT_STATE §3 already records that shadow does not gate *delivery*; it does not gate *storage* either. The word is misleading on both axes.
- **A CRM write leg exists and fires.** 3 of 24 conversations carry a populated `ghl_contact_id` and `ghl_note_id`, across two clients, so conversation content leaves the substrate and lands in a CRM record attached to a person. Both `open` and `handoff_pending` rows did it, so it is not cleanly handoff-gated in what landed. **Not verified:** the exact workflow condition that triggers the leg. That needs a read of `AGENT_webchat` / `AGENT_postpass`, not a table read.

**Consequence for the venture.** A skincare consultation asks about skin concerns, which is exactly the sensitive category V5 covers. On the runtime as it stands, running that consultation would persist those answers by default and could write them into GHL. So the gate needs a code change, not a config flag, and the change is this channel's to design. Two shapes worth pricing before the lawyer reports, because they bound what he can be asked to approve: store the transcript unattributably (no contact linkage, no CRM leg, session-scoped and expiring), or do not persist consultation turns at all and keep only the derived recommendation. **Nothing gets built on this until V5 returns**, but scoping it now means the lawyer is asked a question the engine can actually implement either answer to.

This also sharpens the V5 brief itself: the question is not "may we store skin-concern answers" in the abstract, it is "may we store them attributably, and if not, does an unattributable session-scoped transcript clear PDPL".

## The sandbox

`singularweb-commerce-dev.myshopify.com` (org "antoine mcc two") is live with the full pipeline attached (receiver, reconciliation, caller) and was the store that proved Phase A. MVP per the verdict: standard premium theme, one hero product, the consultation agent (existing runtime plus a cosmetics claims gate), full pipeline from day one, paid test through the governed rails with a consult/no-consult cohort split. Explicitly out: 3D, generative UI, a new repo, a second machine.

## The claims dictionary

One artefact governs the label, the ads and the consultation's mouth. The clinical-gate pattern is proven (KST held under founder testing: refused tax-strategy advice, declined to invent figures, offered handoff). The cosmetics dictionary is not written, and **it cannot be written before V2 and V3 land**, because the UAE authorised-claims position is exactly what those verify. Cosmetic claims only, never therapeutic. Gulf-market note from the playbook: whitening and brightening language is commercially common in the region and needs careful drafting; halal and vegan claims need substantiation like any other. The GoPoxy brand doc is a worked example of the same discipline.

## Critical path and budget shape

**12 to 16 weeks from the day V1 and the product brief start**, with registration and production as the competing longest poles. Week 1: V1 entity call, agent engaged for V2 to V4, V5 lawyer briefed, ODM product brief written, ODM shortlist contacted with the document-pack filter, name shortlist to V7. First sale lands when registration clears and stock arrives, whichever is later.

Cash to first sale is realistically low tens of thousands of dollars all-in. **The launch ad budget should at least equal the stock cost**; the common founder error is spending everything on inventory and starving the launch.

## Kill criteria (shape fixed, numbers are the founder's and are NOT yet set)

To be set **before the first dirham of stock is ordered**: maximum cash to first sale; CAC ceiling after N weeks of live spend; the 70% product margin floor; a consultation-lift threshold below which the reference-implementation claim is dropped even if the brand continues. Drafted shapes from the verdict: consultation retires to a FAQ agent on no material lift after roughly 300 completed consults or under 10% engagement; the brand stops on contribution-negative CAC after a set spend ceiling with two competent creative rounds.

Plus the standing operator rule, which binds with full force here because agency revenue pays for this: **this venture must never consume more than 30% of founder working time for four consecutive weeks while client work is outstanding.**

**Any session asked to help order stock without those numbers set should raise it once, plainly.** The loop and the merchant lane survive either kill; that containment is why the own brand is the right laboratory.

## Standing risks

- Beauty CAC is brutal and creator-led. The brand needs a reason to exist beyond the software.
- Product liability is a real new exposure the agency has never carried. Insurance before first sale, and it is the argument for entity route 2.
- Gulf heat is a product risk, not a footnote: specify elevated-temperature stability testing, prefer airless pump or tube over open jars.

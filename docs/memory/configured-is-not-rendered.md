---
name: configured-is-not-rendered
description: "Check the rendered page, not the admin data; and never assume something hidden is broken, because hiding can be a deliberate and correct choice"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 66255a2d-1ff4-4cde-b90c-ccaff155f70d
  modified: 2026-08-21T09:32:43.911Z
---

Two halves, and the second one is the expensive one.

**Configured is not rendered.** An app being installed, with data present, says nothing about whether a customer sees it. Super Henry, 2026-08-10: Judge.me installed and rendering nothing. Audits assembled from admin data credit the merchant with everything configured, while the shopper only gets what displays, and that flatters the store in exactly the area that decides whether people buy.

**Hidden is not the same as broken.** Atelier Brunos, 2026-08-21: I found 127 reviews at 4.9 sitting in the DOM at `offsetHeight: 0` with `jdgmSettings is not defined` in the console, called it the strongest conversion finding on the account and said it was a quick fix. The client then explained that the reviews were **fake, AI-generated, added by his web developer, and he had deliberately suppressed them** because his brand was two months old with five real sales. The invisibility was his ethics working, not a defect. Acting on my "fix" would have meant advising a US-facing store to publish fake reviews, which the FTC's 2024 rule penalises per violation, with a UK equivalent under the DMCC Act.

**Why:** a technical read tells you the state of a thing, never the intent behind it. A missing element has at least three explanations, in this order of likelihood on a small store: nobody built it, it broke, or somebody removed it on purpose. Only the owner knows which, and the third is invisible from outside.

**How to apply:** verify what renders before crediting a trust element in any audit ([[client-product-facts-need-verifying]] is the sibling for product claims). But when something is absent or suppressed, ask the client why before recommending a fix, and never let "quick win" framing carry a recommendation you have not checked for legality or ethics. The underlying diagnosis often survives while the remedy inverts: here the trust gap was real, and the answer was earning reviews rather than displaying the ones on hand. Related: [[meta-api-absence-claims]] and [[cross-surface-relevance-check]].

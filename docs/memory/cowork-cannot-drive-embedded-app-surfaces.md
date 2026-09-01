---
name: cowork-cannot-drive-embedded-app-surfaces
description: "Cowork cannot type into Shopify's theme code editor or embedded app screens like Loox; clicks land, keystrokes do not"
metadata: 
  node_type: memory
  type: reference
  originSessionId: 7dc90ff4-9c41-4bc0-ab9d-2291dd851499
  modified: 2026-08-26T18:58:01.864Z
---

Cowork drives the native Shopify admin fine (Content → Pages, Products, Files, Settings, the page rich-text editor) but **cannot type into embedded app surfaces**. Proven twice on instawarm: the Loox Reviews screen (2026-08-20) and the theme code editor at `online-store-web.shopifyapps.com` (2026-08-26). In both, clicks land and produce selections, but keystrokes never reach the frame, cursor position never moves under keyboard navigation, and a fresh tab behaves identically.

**How to apply:** never brief Cowork for theme code edits (`templates/*.json`, `sections/*`, `layout/theme.liquid`) or for review-app admin work. Those are founder-by-hand items. The founder has driven the code editor successfully himself, so this is an automation limit, not a store or permissions problem. Scope Cowork briefs to page content, product data, files and settings, where it performs well and self-reports its own near-misses.

**Two briefing lessons from the same engagement, both authoring errors rather than Cowork failures.** A safety rule written for one surface ("note the file version before saving", which theme files support and Shopify Pages do not) silently made a page edit impossible, because Cowork correctly honoured "if a rule conflicts with a step, the rule wins". And a removal mechanism given without knowing the structure ("set disabled on the block") failed on all three target images, none of which were blocks in the assumed way. **Scope safety rules to the surface they were written for, and only prescribe a mechanism where the structure is already known.** Cowork reporting the real structure instead of improvising is what made the corrected instructions possible, so the pattern works when the brief admits what it does not know.

Caveat: its filename transcription is unreliable. It reported wrong date prefixes on two image files whose structural analysis was otherwise correct. Trust the structure, verify the identifiers. Related: [[shopify-theme-duplicate-stages-design-only]], [[client-product-facts-need-verifying]].

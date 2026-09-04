---
name: storefront-web-pixel-manifest-is-the-pixel-surface
description: "A Shopify storefront's webPixelsConfigList in the page HTML names the Meta pixel actually firing; empty pixel reads on the business are not the pixel surface, and \"Missing perms\" on a pixel id means it exists elsewhere"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 208d39d7-d68e-4836-a81d-ddbc3753eba2
  modified: 2026-09-04T14:20:42.973Z
---

Before saying a client "has no pixel", fetch the storefront HTML and read the Shopify `webPixelsConfigList` block: an entry with `pixel_type: facebook_pixel` and a `pixel_id` is the pixel a real visitor fires. Then read that pixel id through Graph. "(#100) Missing perms" means the pixel exists in a business or personal account we do not hold; "does not exist" (error 100, subcode 33) is the only shape that supports absence.

**Why:** On Monde du Tabouret (2026-09-04) the ad account, the client business (`adspixels`, `owned_pixels`, `client_pixels`) and 47 days of the daily monitor all read zero pixels, and Bernard's read agreed. The storefront was firing pixel 1020830254138442 the whole time, connected by the client through the Facebook and Instagram channel to an account outside our business. "No pixel" was true of our surfaces and false of the client's site, and the blocker was a misdirected connection, not a missing install.

**How to apply:** Any Meta Phase 0 or pixel audit reads the storefront manifest first, then joins it against the business reads. The same manifest lists other app pixels (Google, Stape server-side tagging), which tells you who else is instrumenting the store. Related: [[meta-api-absence-claims]], [[configured-is-not-rendered]], [[cross-surface-relevance-check]].

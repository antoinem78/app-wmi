---
name: feed-price-claims-need-both-fields
description: "A Merchant Center price defect claim needs price AND salePrice from the full product resource, and fix-verification must read the serving object, not the stored one (GoPoxy, 2026-08-26)"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 6d861d7b-dc2d-46d3-979b-17e80c6d89de
  modified: 2026-08-26T12:57:07.534Z
---

On GoPoxy I read `price` from the Merchant reports `product_view`, saw the pre-discount RRPs, and declared "the ads advertise higher prices than the site charges". The claim survived three chases of the freelancer, went into a founder work order as "third time of asking, now blocking", and reached the client. It was false: the full product documents (Merchant `products` API, fields under `productAttributes`) carry both `price` (£750, the Shopify compare_at) and `salePrice` (£637.50, the real selling price), the standard Shopify channel mapping, and shoppers saw the correct discounted price with a strikethrough all along. The freelancer had said so and was right. The same hour produced the mirror error: I re-read old Meta creative ids to verify his claimed copy fixes and found the breaches "still live", but Meta creatives are immutable objects, so old ids keep old text forever; the ads referenced NEW clean creatives, and his claim was true.

**Why:** platform data models split one shopper-visible fact across fields and immutable versions. Reading one column of a reporting view, or the object you saved an id for last week, produces a confident claim about a surface you never actually looked at. Both errors here accused a human of failures he had not committed, in writing, in front of the founder and once in front of the client.

**How to apply:** before any pricing/feed defect claim, read the FULL product resource (both `price` and `salePrice`; note the Merchant products API keeps them under `productAttributes`, not `attributes`) and prefer the rendered listing where possible. Before any "the fix was not made" claim on Meta creatives, resolve ads to their CURRENT creative references; never re-read stored creative ids. Same family as [[meta-api-absence-claims]], [[google-ads-bidding-claims-need-three-surfaces]] and [[configured-is-not-rendered]]: the surface that answers first is rarely the surface that governs. When such a claim has already been relayed to an agent's memory or a client, correct it the same hour, by name.

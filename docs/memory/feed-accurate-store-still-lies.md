---
name: feed-accurate-store-still-lies
description: "A product feed can match the store exactly and still mislead shoppers, because the store itself sells backorder and pre-order stock as available; check the merchant's delivery terms before blaming the feed (House of Isabella, 2026-08-18)"
metadata:
  node_type: memory
  type: feedback
---

House of Isabella's marketing manager reported customers buying products that showed as available but were not actually purchasable, and asked for a feed and stock overhaul. Joining every product in the live Shopify feed against the storefront's own variant availability showed the feed was right: 2 disagreements out of 20,147 in-stock offers, 0.01%. The nightly Shoptimised feed drifted more, 0.34%, but still nowhere near enough to explain the complaints. The actual cause was in the merchant's own delivery page: they place stock on backorder with suppliers and sell many items as pre-order, so Shopify marks those available, which is true, and the feed passes it to Google as plain "in stock", which is not what a shopper reads. Google supports distinct backorder and preorder availability states with an availability date, and across 126,839 catalog rows neither was used once.

**Why:** "the feed is wrong" is the intuitive diagnosis and it sends you auditing the pipeline, which is the one place the fault is not. A feed is a faithful mirror; if the store's own definition of "available" includes stock nobody holds, a perfect feed reproduces a misleading claim perfectly. Auditing the transport can never surface a definition problem at the source.

**A join alone would have got this wrong.** Matching the feed against a crawl of the storefront covered 77% of the catalog and returned a clean 0.01%. A separate **random sample of 500 in-stock offers, each followed through to its live product link**, found a class the join was structurally blind to: 1.2% did not land on the product at all (0.8% dead 404s, 0.4% silently 301-redirecting to a collection page). Products deleted from the store cannot appear in a storefront crawl, so they can never fail a join, only go missing from it. Run both: the join for precision on matched rows, the sample for the unmatched tail.

**How to apply:** when a client reports availability or stock complaints, first join the feed against the storefront's own availability to establish whether the feed is faithful. If it is, stop auditing the pipeline and read the merchant's delivery, shipping and returns copy for backorder, pre-order, made-to-order or supplier lead-time language, then check whether the catalog uses the platform's dedicated states for those. The fix is usually a business-rules decision by the client, not an engineering job. Sibling of [[cross-surface-relevance-check]]: verify which surface actually carries the fault before claiming a cause.

---
name: shopify-google-channel-takes-seo-title
description: "Shopify's Google channel can send the SEO page title instead of the product title, putting marketing copy into shopping listings; compare feed title against product title and og:title to prove it (House of Isabella, 2026-08-18)"
metadata:
  node_type: memory
  type: reference
---

House of Isabella's shopping listings carried titles like "Fast Delivery for Malini Brazen Cushion | House of Isabella" where the product is "Malini Brazen Cushion". The prefix was not in Shopify's product titles and not added by Shoptimised, whose parallel feed carried clean product names. The feed title matched the product page's og:title (the SEO/search-engine listing title) exactly on every product tested, and matched the product title only where no custom SEO title existed. So the channel was sourcing titles from the SEO field, and every SEO title a copywriter had ever hand-written was appearing as a shopping ad headline. Scale: 2,186 of 33,214 UK offers carried a "Fast Delivery" prefix in four inconsistent hand-typed forms, and 12.8% of titles differed from the product name overall.

**How to apply:** the inconsistent variants are the tell. A feed rule or template produces one exact form; four forms of the same prefix means hand-typed source data. To prove the source, pull the feed title, fetch the product's `.js` endpoint for the true product title, and scrape `og:title` from the product page: if feed == og:title and feed != product title, the channel is on the SEO field. It is a channel setting, so the fix is one switch, not thousands of edits. Worth checking on any Shopify client whose shopping titles read like marketing copy. Related: [[client-product-facts-need-verifying]].

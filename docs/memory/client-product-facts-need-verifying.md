---
name: client-product-facts-need-verifying
description: A client confirming a product fact is not verification; dropshippers often have never handled their own product
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 7dc90ff4-9c41-4bc0-ab9d-2291dd851499
  modified: 2026-08-16T13:35:47.421Z
---

Treat a client's answer about their own product as a claim to be checked, not as ground truth. Ecommerce clients are frequently dropshippers who have never held the item, and their belief comes from a marketplace listing or an old order that does not match what their supplier now ships.

**Why:** on instawarm (2026-08-14) Vincent confirmed the power bank was included and the fix pack recorded it as CONFIRMED, with "USB power bank included. Everything you need to stay warm, in the box." written for the product page. On 2026-08-16 he corrected himself unprompted: his own past units came via Amazon, which bundled a battery, but ordering direct from his supplier the battery is a separate SKU. He has never worn or tested the jacket and does not own one. The claim was two days from being published on every sale, behind a 30-day refund we had just persuaded him to honour.

**How to apply:** this is the same discipline as [[meta-api-absence-claims]] applied to clients rather than APIs. Before publishing any factual product claim (what is in the box, dimensions, materials, timings), ask what the client's answer is based on. Prefer a physical check: someone lays hands on the actual unit the customer receives, not a marketplace copy of it. Where a client cannot verify, recommend they order through their own store rather than direct from the supplier: same wait, but it proves box contents, fit, real delivery time and the whole customer experience at once, and it puts a real order through any connected pipeline. Watch for the related trap: UGC footage shot on a differently-sourced unit can promise inclusions the supplier does not ship. Related: [[never-infer-delivery-from-repo]], [[shopify-theme-duplicate-stages-design-only]].

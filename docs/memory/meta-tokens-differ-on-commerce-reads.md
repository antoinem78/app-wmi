---
name: meta-tokens-differ-on-commerce-reads
description: "The portal token in .env.local gets #200 on owned_product_catalogs; the substrate token reads catalogs, event sources, data sources and product sets; neither reads commerce_merchant_settings objects or the shop-level channel state"
metadata: 
  node_type: memory
  type: project
  originSessionId: 208d39d7-d68e-4836-a81d-ddbc3753eba2
  modified: 2026-09-04T14:20:50.839Z
---

Two Meta tokens exist on this machine under the same variable name `META_ADS_TOKEN`: the one in the repo's `.env.local` (portal) and the one in `~/.config/singularweb/substrate.env` (n8n, the path `BERNARD_monitor` uses). Verified 2026-09-04: the portal token returns "(#200) Application does not have required permission commerce_account_read_settings…" on `{business}/owned_product_catalogs`; the substrate token reads that edge plus per-catalog `external_event_sources`, `data_sources`, `product_feeds`, `product_sets`, `products`, `diagnostics` and `agencies`. Neither can read a `commerce_merchant_settings` object directly (shops, sales-channel status), so shop-level channel state stays unread by capability, not absent.

**Why:** A #200 on the first token looked like "catalogs unreadable" and would have left Bernard's gaps open; the monitor had been reading them daily all along.

**How to apply:** For catalog reads, load the substrate env, not `.env.local`. A catalog-shaped permission error from the portal token is a token choice, not a finding. Bernard's chat toolset has no Commerce Manager surface at all, so catalog verification is a Code direct read (GET only) until that tool exists. Related: [[substrate-verified-shapes]], [[storefront-web-pixel-manifest-is-the-pixel-surface]].

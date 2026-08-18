# House of Isabella UK (Rick and Chelsea)

**Channel file.** Read `docs/PROJECT_STATE.md` §1, §2 and §7 first. Owned by the house-of-isabella session. **Lane ruling (founder, 2026-08-18): ecommerce track, Google only, under Oscar.** No Meta work on this client; Bernard is not involved. Oscar owns the Google analysis; Code does substrate reads and holds this record. No substrate `clients` row exists; this slug is canonical if one is ever created.

## Who and what

UK furniture and home DTC, houseofisabella.co.uk, Shopify (confirmed from the storefront 2026-08-11). Engine A reporting client (`reporting_only`, imported via MCC): Google Ads 8946167825, GBP, ~£47k/30d spend, PMax + Search + Demand Gen live. Contacts: Rick and Chelsea. Two Merchant Centers: **137224936 (main, ~128k offers)** and **5667449015 (secondary, ungranted, likely minor)**.

## Access state

- Google Ads: full read via the MCC.
- Merchant Center main (137224936): readable by ceo@singularweb.ai (Standard, granted 2026-08-12 via antoinemcc6; low-risk account per founder).
- Merchant Center secondary (5667449015): no access; grant whenever convenient.
- Store: NOT connected; no store connection is planned unless the founder opens that conversation. Order volume if it ever happens: ~95-130 real orders/week (largest genuine purchase trackers), AOV ~£360-400, comfortably under the 250/page pagination threshold weekly.

## Findings on record (all from the client's own accounts; verified live 2026-08-12)

1. **The out-of-stock revenue engine finding (the lead):** 21,516 currently-OOS offers tracked **£270,539 through Google ads in the trailing 90 days at 3.98 ROAS**. When products sell out Google stops showing them, so every strong seller out of stock is a revenue line at zero. A restock priority list ranked by tracked revenue is one query away.
2. **Purchase reporting inflated ~5x, bidding clean:** GA4 `add_to_cart` (~2,969/30d) and `add_payment_info` actions are categorised PURCHASE in Google Ads, so any purchase-category readout is ~5x reality. Verified `primary_for_goal=false` on the miscategorised actions and `primary=true` only on the genuine Shopping App Purchase, so automated bidding trains on the right signal; the distortion is reporting-only. Fix is recategorisation, minutes.
3. **Ireland and Spain, a door half-opened:** 33,031 offers (a quarter of the catalog) disapproved for IE and ES (ads and free listings) because **no shipping service is configured** for either country, AND no campaign targets them (verified against campaign geo-targeting: every enabled campaign targets the UK only, one England-specific). So zero paid impact today; it is a finish-it-or-close-it decision, an afternoon either way. Do not present it as a paid-loss finding; that was the corrected overclaim of 2026-08-12.
4. **Pulled products:** 141 landing_page_error, 109 price_mismatch (exact per-product lists available).
5. **Policy tail (~150 offers):** legal_restrictions 113, sexual_interests 17, personal_hardships 11, restricted_nfs 10, healthcare claims 1. The pre-suspension class; cheap insurance to clear.
6. **Two-surface note:** MC hard-disapproval is 0.02% while ads-side blocked is 35.4% (60,552 `local_stores_lack_inventory` affects local listings only; 33,031 shipping-gap offers are the eligible-limited middle). Any client-facing number must name its surface.

## Client-facing document

`~/Documents/HOI_GOOGLE_PRODUCT_DATA_REVIEW_AUG2026.docx`: one-page report for Rick and Chelsea in the founder's voice, five findings ordered OOS-revenue first, IE/ES reframed as the half-built expansion. Drafted and corrected 2026-08-12; **whether and when it has been sent is the founder's; confirm before referencing it in any client conversation.**

## Standing watch shape (Oscar's, once adopted)

The disapproved-share metric (offers, eligible, limited, not-eligible, share, delta vs yesterday) runs on the dev token via `shopping_product`; disapproval reasons via Merchant API `reports:search` on `product_view` (id field mandatory in SELECT, page size 1000, ~128 pages). The conversion-hygiene and OOS-restock items are the natural first deliverables if the engagement deepens beyond reporting.

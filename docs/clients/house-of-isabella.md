# House of Isabella UK (Rick and Chelsea)

**Channel file.** Read `docs/PROJECT_STATE.md` §1, §2 and §7 first. Owned by the house-of-isabella session. **Lane ruling (founder, 2026-08-18): ecommerce track, Google only, under Oscar.** No Meta work on this client; Bernard is not involved. Oscar owns the Google analysis; Code does substrate reads and holds this record. No substrate `clients` row exists; this slug is canonical if one is ever created.

## Who and what

UK furniture and home DTC, houseofisabella.co.uk, Shopify (confirmed from the storefront 2026-08-11). Engine A reporting client (`reporting_only`, imported via MCC): Google Ads 8946167825, GBP, **£39,449/30d spend and £174,406 value, ROAS 4.42** (re-verified 2026-08-18 after an earlier figure of £48,007 proved wrong; see the correction note below), PMax + Search + Demand Gen live. Contacts: Rick (owner) and Chelsea (marketing manager). **THREE Merchant Centers are attached to the Google Ads account, not two:** 137224936 (main, granted), 5667449015 (ungranted) and 5685005512 (ungranted, discovered 2026-08-18).

**Catalog size corrected 2026-08-18.** The "~128k offers" figure on file since 2026-08-12 was a row-count artifact. 126,839 `product_view` rows resolve to: GB online 33,214, S-GB 26,534, EUR_109909508483 33,017, plus 34,074 `local~` local-inventory rows carrying `availability: UNKNOWN`. **The real UK online catalog is 33,214 offers.** Any per-offer figure taken before this date needs re-checking against the right denominator.

## Access state

- Google Ads: full read via the MCC.
- Merchant Center main (137224936): readable by ceo@singularweb.ai (Standard, granted 2026-08-12 via antoinemcc6; low-risk account per founder).
- Merchant Center 5667449015: **no access, and no longer "likely minor"** (corrected 2026-08-18). Live campaigns inside it spent **£4,888/30d at 3.11 ROAS**. Note the nuance, because the first pass got this wrong: the pair of ungranted accounts is **not** "the weakest part of the account". "Shoptimised | Incremental | Other Brands" runs at **5.01, above the 4.42 account average**; it is "Shoptimised | Incremental | Tommy Franks / Richmond" alone, **£2,119 at 1.09**, that is the weakest material spend on the account. Access is a live ask, on the strength of £5,208 we cannot see rather than on a performance accusation.
- Merchant Center 5685005512: no access, discovered 2026-08-18. £320/30d at 1.18 ROAS via "Shoptimised | Incremental | IP" (PAUSED). Small, folded into the same access ask.
- Two further merchant ids (8450698, 112625581) appear on campaign shopping settings with zero spend in 30 days. Noted, not chased.

**⚠ Figures correction, 2026-08-18.** A first pass reported £48,007/30d and a per-campaign table derived from it. **Those numbers were wrong and are superseded by everything in this file.** The correct total is £39,449, confirmed three ways (customer level, campaign level with and without a cost filter) and reconciled against both a daily series and a 17-week weekly series. The error surfaced only because a later daily pull would not add up to the earlier total. **The original API response was not retained, so the cause was never reproduced**, which is the uncomfortable part: re-running the identical query now returns the correct figure. Treat any single-query financial figure on this account as provisional until it reconciles against a second time series.
- Store: NOT connected; no store connection is planned unless the founder opens that conversation. Order volume if it ever happens: ~95-130 real orders/week (largest genuine purchase trackers), AOV ~£360-400, comfortably under the 250/page pagination threshold weekly.

## Feed architecture, mapped 2026-08-18

Merchant Center 137224936 runs **three primary product sources at once**, all live:

| Source | id | Feed label | Input | Offers | Shopping ads |
|---|---|---|---|---|---|
| Shopify App API | 10569685027 | `GB` | API, real time | 33,214 | ENABLED |
| HOI - New Shoptimised Feed \| UK | 10613844305 | `S-GB` | File fetch, daily 23:00 Europe/London | 26,534 | ENABLED |
| Shopify App API | 10624329450 | `EUR_109909508483` | API, ES + IE | 33,017 | ENABLED |

Plus a legacy `Local Feed Partnership` primary and five supplemental Google Sheets.

**Shoptimised is already in the account and has been for some time.** Chelsea asked whether we use it, as though it were a new tool to adopt. It is running, last fetch SUCCEEDED 2026-08-17T23:00Z with 26,534 items. Never answer that question as posed.

**GB and S-GB self-compete.** 25,367 of 26,534 S-GB offers (95.6%) also exist in GB, under different titles, both enabled for Shopping ads and free listings, both with live PMax campaigns, same country. Reads as a Shoptimised migration begun and never completed. Campaign split: `AM | PMC | All Products | Feed Only | TOF Signals` (GB) £25,940 at 3.74; `AM | PMC | All Products | S-GB | Shoptimised Feed` (S-GB) £3,043 at 5.31. **Do not present that ROAS gap as evidence Shoptimised is better**; different campaign types, budgets and product mix, so it is confounded.

## Findings on record

Items 1 to 6 verified live 2026-08-12; items 7 to 9 verified live 2026-08-18.

1. **The out-of-stock revenue engine finding (the lead):** 21,516 currently-OOS offers tracked **£270,539 through Google ads in the trailing 90 days at 3.98 ROAS**. When products sell out Google stops showing them, so every strong seller out of stock is a revenue line at zero. A restock priority list ranked by tracked revenue is one query away. *(The 21,516 figure was taken against the old inflated denominator; GB online now shows 6,951 of 33,214 offers OOS, 20.9%. The tracked-revenue number is unaffected, the share is not. Re-derive before quoting a percentage.)*
2. **Purchase reporting inflated ~5x, bidding clean:** GA4 `add_to_cart` (~2,969/30d) and `add_payment_info` actions are categorised PURCHASE in Google Ads, so any purchase-category readout is ~5x reality. Verified `primary_for_goal=false` on the miscategorised actions and `primary=true` only on the genuine Shopping App Purchase, so automated bidding trains on the right signal; the distortion is reporting-only. Fix is recategorisation, minutes.
3. **Ireland and Spain, a door half-opened:** 33,031 offers disapproved for IE and ES (ads and free listings) because **no shipping service is configured** for either country, AND no campaign targets them (verified against campaign geo-targeting: every enabled campaign targets the UK only, one England-specific). So zero paid impact today; it is a finish-it-or-close-it decision, an afternoon either way. Do not present it as a paid-loss finding; that was the corrected overclaim of 2026-08-12.
4. **Pulled products:** 141 landing_page_error, 109 price_mismatch (exact per-product lists available).
5. **Policy tail (~150 offers):** legal_restrictions 113, sexual_interests 17, personal_hardships 11, restricted_nfs 10, healthcare claims 1. The pre-suspension class; cheap insurance to clear.
6. **Two-surface note:** MC hard-disapproval is 0.02% while ads-side blocked is 35.4% (60,552 `local_stores_lack_inventory` affects local listings only; 33,031 shipping-gap offers are the eligible-limited middle). Any client-facing number must name its surface.
7. **Backorder sold as in stock. This is the answer to the client's availability complaint, and the feeds are not at fault.** Joined every matchable offer against the storefront's own variant availability: GB feed says IN_STOCK and the store disagrees on **2 of 20,147 (0.01%)**; S-GB on **53 of 15,646 (0.34%)**, consistent with a once-nightly file against a real-time API. Both far too clean to explain customer complaints. The cause is upstream of Google: **the store's own delivery page states they place stock on backorder with suppliers and sell many items as pre-order.** Shopify marks those available, the feed truthfully reports IN_STOCK, and the shopper reads that as "on a shelf". Google supports distinct BACKORDER and PREORDER availability with an availability date; **across all 126,839 rows both are used exactly 0 times.** Fixing it is a client-side business-rules decision (what counts as backorder, what lead time to publish per supplier), not a feed cleanup.
8. **Shopping titles are pulling the SEO page title, not the product name.** Verified on four products: where a custom SEO title exists the feed title matches `og:title` exactly and differs from the product title; where none exists all three agree. Store "Malini Brazen Cushion" reaches Google as "Fast Delivery for Malini Brazen Cushion | House of Isabella"; store "Column Vespin natural beige travertine (Beige)" reaches it as "Elevate Your Space with Column Vespin Natural Beige Travertine (Beige) from House of Isabella". Scale: **2,186 of 33,214 GB offers (6.6%)** carry a "Fast Delivery" prefix, in four inconsistent hand-typed forms (`Fast Delivery for`, `Fast Delivery:`, `Fast Delivery!`, `Fast Delivery `), which is why it is typed SEO copy and not a feed rule. Wider measure: **3,268 of 25,439 joined offers (12.8%)** have a listing title that is not the product name. **S-GB has zero of these**, because Shoptimised takes the product title. It is a channel setting, so a same-week fix rather than thousands of edits. Note the compounding risk: some products promise fast delivery in the title while the item is on backorder.
9. **The EUR/ES-IE feed is wrong in the opposite direction:** **16,895 of 22,184 offers marked OUT_OF_STOCK are actually purchasable (76.16%)**. No campaign targets ES or IE so there is no paid impact; exposure is limited to free listings in two markets. Oscar's ruling: one line in client comms, flagged as a tidy-up, never allowed to compete with items 7 and 8.

10. **Broken destinations on in-stock listings, found by random sample 2026-08-18.** The 25k storefront join could not see this class at all, because products removed from the store simply fail to match. A **random sample of 500 GB in-stock offers**, each resolved to its live product link, returned: 493 available (98.6%), **4 genuine 404s (0.8%)**, **2 silently 301-redirecting to `/collections/tommy-franks` rather than a replacement product (0.4%)**, 1 with no link. So ~1.2% of in-stock listings do not land on the product. Extrapolated to 26,263 in-stock offers that is roughly 200 to 300, consistent with the 141 `landing_page_error` already on record as finding 4 (the redirects return 200 so Google would not flag them at all). **Joined against the spending surface per the standing rule: none of the six had a single impression in `shopping_performance_view` in the last 30 days, so there is no demonstrated paid cost.** Present as housekeeping, never as a live loss. The silent redirect to a collection page is the more interesting half, because it looks healthy from every automated angle.

**Method note worth keeping:** the join and the random sample answer different questions and the sample found a class the join was blind to. Join for precision on matched rows, sample for coverage of the unmatched tail. Doing only the join would have produced a confidently wrong "the feeds are clean" claim.

## Who actually manages this account, established 2026-08-18

**This is the most consequential thing found today and it reframes everything else.** Change history, last 28 days, 215 events:

| Editor | Changes |
|---|---|
| `antoinemcc6@gmail.com` (our MCC login) | 188 |
| `sophie@shoptimised.com` (Shoptimised, a real person) | 20 |
| Recommendations Auto-Apply (Google's own automation) | 7 |

So the account is **not** neglected by an absent third party. It is actively worked, overwhelmingly from our side, with Shoptimised managing only their own `Incremental` campaigns. **Before drawing any conclusion from this, confirm with the founder who operates `antoinemcc6@gmail.com`**, because a login is not a person and this repo already carries the lesson that contractors work under other people's identities ([[contractor-identity-is-not-the-visible-identity]]). The `AM |` campaign-name prefix is consistent with that login being the author of most of the account.

**The mid-August budget cut was made from that login:**

- 2026-08-10 16:42, `antoinemcc6`: TOF Signals £850/day to £500/day; Brand's Based £330/day to £200/day
- 2026-08-12 06:33, `antoinemcc6`: TOF Signals £500/day to £300/day

TOF Signals therefore fell **£850 to £300, 65% in two steps**, which matches the step in the daily series exactly, and coincides with ROAS falling to **3.71, the worst week in seventeen**. Oscar had called this "a genuine management failure, not market conditions" while assuming a third party was responsible. **He was judging our own work.** The question was badly framed by this session; the framing error is on record so it is not repeated.

**Other things the history settles.** The AI Max campaign was created 2026-08-07 from the same login with negatives added on the 7th and 12th, so it is under two weeks old and actively tended: "buying fake trees" is a new campaign in its ugly phase, not years of neglect. Campaigns are repeatedly created at a placeholder budget then cut minutes later (Price<500 £500 then £50 fourteen minutes on; Feed Only Sofa £300 then £50; S-GB Sofa £110 then £10 next day), which explains volatility that reads as erratic from metrics alone. Sophie has trimmed Tommy Franks from £125 to £25 across the month, so the 1.09 ROAS campaign is being managed down, not ignored. **Recommendations Auto-Apply is ENABLED** and changed `optimizedTargetingEnabled` on the Demand Gen campaign unattended on 2026-08-08; that is a live finding in its own right.

**Standing rule for this client, learned the hard way today: pull `change_event` BEFORE forming or requesting any judgement about how the account is run.** Retention is 30 days only, so it cannot be reconstructed later.

## Conversion tracking, settled 2026-08-18

Only `Google Shopping App Purchase` is primary and included in the conversions metric, so `metrics.conversions_value` is clean and every ROAS figure here is trustworthy. **A first read called this "a single point of failure optimising toward a subset of real revenue". That is wrong.** Thirty-day figures: Shopping App Purchase **435 conversions / £174,406**; the excluded GA4 web purchase **376 / £129,297**. The action feeding bidding is the **larger and more complete** of the two, and excluding GA4's is textbook de-duplication. Despite the name, `Google Shopping App Purchase` is the Shopify channel's conversion for website purchases, not app-only ones. The only fair residual point is resilience: everything depends on one action. **Do not repeat the "subset of revenue" claim to anyone.**

## Oscar's verdict on account management, revised 2026-08-18

Asked whether the account is managed properly, Oscar first returned "not being managed properly, and the failures are structural". **He retracted that after the change history landed.** Both his original headline points were wrong, and both were wrong because this session gave him the evidence in the wrong order.

**Revised verdict: an actively, even aggressively managed account, currently mid-restructure, with real remaining defects, but "not being managed properly" was the wrong frame.** His reasoning: budgets do not drift from £850/day to £300/day by accident, campaigns are not created and trimmed to placeholder budgets within minutes by an absent manager, and an 11-day-old AI Max campaign with negatives added twice is a live build rather than abandonment. Two cuts two days apart read as active response to the July efficiency decay, not one blind move nobody watched. He also now accepts the 65% TOF Signals cut as a sufficient explanation for the ROAS dip, via bid-landscape re-exploration on the account's largest campaign, with the partial recovery to 4.23 being that mechanism resolving.

**Open defects that survive the correction, and are ours to close rather than anyone else's failure:**

1. Four non-Feed-Only campaigns at POOR ad strength with no stated rationale (Brand's Based, S-GB Sofa, both Shoptimised Incrementals). "Rick - Best Brands minus TF" sits at EXCELLENT on £15/day, so the standard is demonstrably achievable on this account.
2. AI Max needs negatives now. Correctly read as a new campaign in its normal ugly phase, but "fake trees", "john lewis uk", "rh home uk" and "olivias" should not survive another week.
3. `Shoptimised | Incremental | Tommy Franks / Richmond` is still on MAXIMIZE_CONVERSIONS at 1.09 ROAS. Sophie is trimming its budget but has not changed the bid strategy, which on a wide-AOV brand set is the more direct fix.
4. Recommendations Auto-Apply should be turned off. One confirmed unattended change in 215 is low-risk in itself, but Google holding standing write access alongside two human editors is what makes "who changed what" unanswerable later.

**On what reaches the client:** Oscar's guidance is to lead with ownership rather than discovery. The account is mid-restructure under active management from our side; the July decay and the 10-12 August dip are an explainable consequence of scaling past the efficient frontier followed by a deliberate correction, not a finding of neglect. Then the honest remainder, which is the four items above. **Nothing built on his original framing goes out**, because a client who knows their own numbers would catch it.

## Live client thread

**2026-08-18: Chelsea (marketing manager) emailed asking for a "major overhaul" of Merchant Centre.** Her three points: customers contacting them about products showing as available but not purchasable; product titles starting with "Fast Delivery"; and whether we use Shoptimised, suggesting it for a wider feed and title refresh. Her email is addressed to a third party rather than to us, so someone else is on that thread; **establish who before the reply goes out.**

Every one of her three premises turned out to be wrong in an interesting direction, which is findings 7, 8 and the feed-architecture section above. Draft reply written as Anthony, in `~/Documents/` once approved; working copy in the session scratchpad. Oscar consulted twice and concurred, correcting himself on two calls in the process (he had attributed the availability fault to the Shopify feed and away from Shoptimised; the data says GB is near-perfect and S-GB drifts, and neither explains the complaint).

Order agreed with Oscar for the reply: **availability leads** (slowest to fix, only item costing goodwill), titles second (same-week setting change, so say plainly that "second" does not mean "wait"), Shoptimised answered as already-live rather than as an adoption question, then the access ask for the two ungranted Merchant Centers.

**Open for the founder before sending:** whether `HOI_GOOGLE_PRODUCT_DATA_REVIEW_AUG2026.docx` was ever sent, because the reply's closing line about out-of-stock revenue assumes that conversation has not happened yet.

## Client-facing document

`~/Documents/HOI_GOOGLE_PRODUCT_DATA_REVIEW_AUG2026.docx`: one-page report for Rick and Chelsea in the founder's voice, five findings ordered OOS-revenue first, IE/ES reframed as the half-built expansion. Drafted and corrected 2026-08-12; **whether and when it has been sent is the founder's; confirm before referencing it in any client conversation.**

## Standing watch shape (Oscar's, once adopted)

The disapproved-share metric (offers, eligible, limited, not-eligible, share, delta vs yesterday) runs on the dev token via `shopping_product`; disapproval reasons via Merchant API `reports:search` on `product_view`. The conversion-hygiene and OOS-restock items are the natural first deliverables if the engagement deepens beyond reporting.

**Merchant API mechanics, re-verified 2026-08-18. v1beta is DEAD** (409, discontinued 28 Feb 2026); use `/reports/v1`, `/products/v1`, `/datasources/v1`. `id` is still mandatory in any `product_view` SELECT. Page size 1000 is the max, about 1.2s per page, 127 pages for the full catalog. **Do not include `item_issues` at page size 1000**, it stalls the request; pull issues separately. Python `urllib` hangs against `merchantapi.googleapis.com` on this machine while `curl` succeeds in a second, so shell out to curl. The `GOOGLE_ADS_*` OAuth client in `.env.local` already carries the `content` scope, so no separate Merchant Center credential is needed. Filter `id.startswith('en~')` to get the online catalog and exclude the `local~` inventory view. Details in shared memory: [[merchant-api-v1-read-shapes]].

# Atelier Brunos / Luca Summer (act_1801857321221826)

**Channel file for the Atelier Brunos client session.** Read `docs/PROJECT_STATE.md` §1, §2 and §7 first. Owned by this client's session; cross-cutting items mirror one line into PROJECT_STATE. Meta analysis belongs to Bernard (relay skill), per lane protocol; this session does the read-only Graph reads and holds the record.

**Live state verified by direct Graph read 2026-08-15.** Everything below the "Who and what" heading was re-read that day unless dated otherwise. The 2026-07-30 version of this file predated the signature and the relaunch and has been replaced.

## Who and what

DTC men's Italian leather footwear at $250, US market, atelierbrunos.com. Naming caution: ad account "Luca Summer", Meta business "Atelier Brunos", ranges Lord and Penny, and the catalog's commerce contact is style@lucavenicci.com against store `2cd3d6-2.myshopify.com`. **Confirm the client of record before anything client-facing.**

**Client, signed and paying:** Gibran Zaki. Managed Meta Ads Service, AED 1,800/month, signed and active 2026-08-05 through the FZCO portal (entity: WEB MARKETING INTERNATIONAL - FZCO, see PROJECT_STATE §1). First real client on that deployment. Onboarding completed 2026-08-05 09:45 UTC. Questionnaire: $1,500-3,000/mo budget, target ROAS 2.5, CPA ~$100+, over-40 affluent USA, purchases. Competitor set Santoni, Loro Piana, Morjas, Level Shoes, Allen Edmonds. Slack step was skipped, so no client channel exists.

Substrate lab client `atelier-brunos` (id b9bfe681), act_1801857321221826 allowlisted, standard write budget, enabled. Pixel 4240166812964720 ("LV 1st Ad"), page 1093475377188454, Instagram @atelierbrunos (17841438676219267).

## ⚠ Open and urgent as at 2026-08-15

**1. Paid clicks have not reached the website since 13 August.** From 13 Aug the live prospecting ad set stopped producing website traffic and started producing on-Meta shopping events instead. Nine days of spend, and the last three of them bought no website sessions at all.

| Date | Spend | Clicks | Landing page views | Pixel ViewContent | On-Meta ViewContent |
|---|---|---|---|---|---|
| 6-11 Aug | $226.30 | 460 | 368 | 414 | 9 |
| 12 Aug | $8.15 | 10 | 8 | 12 | 0 |
| **13 Aug** | **$55.17** | **73** | **1** | **1** | **77** |
| **14 Aug** | **$37.05** | **48** | **0** | **0** | **55** |
| 15 Aug (partial) | $0.58 | 0 | 0 | 0 | 0 |

**It is not a tracking break.** Pixel 4240166812964720 `last_fired_time` is 2026-08-14T23:29 UTC and its stats endpoint shows PageView and ViewContent firing every day through 15 Aug from non-paid traffic. The site tracks fine; the clicks are not arriving.

**It is not the placements.** The same placement behaves differently in each ad set, which rules the placement expansion out: `facebook/facebook_reels` gave 81 clicks / 62 landing page views in the old ad set and 86 clicks / 0 landing page views in the new one.

**CAUSE CONFIRMED 2026-08-15 by the founder in Ads Manager: the ad set has personalised destinations enabled with only "Shop" toggled ON.** The website is not a destination at all, so every click is sent to the Meta shop by design. The ads are working exactly as configured; nothing is broken.

**Root cause: the 12 August rebuild went through guided creation and picked up its defaults.** The campaign carries `smart_promotion_type: GUIDED_CREATION`. The API evidence lines up with this precisely: the five archived ads carry a fully enumerated `degrees_of_freedom_spec` with every single creative feature explicitly `OPT_OUT` (`product_tags`, `product_browsing`, `product_extensions`, `catalog_feed_tag` and about seventy more), which is the signature of a hand-built spec. The five rebuilt ads carry a short spec with `contextual_multi_ads: OPT_IN` and `standard_enhancements: OPT_IN`. The original build had opted out of everything; rebuilding through the guided flow silently re-enabled a set of Advantage defaults, one of which redirects the destination.

**Note for anyone reading the API alone: `contextual_multi_ads: OPT_IN` was the only visible delta from the outside and it is adjacent to the real control, not the control itself.** The destination setting is UI-side. The API delta is a useful smell, but the answer was one minute in Ads Manager. The creatives themselves still point at `atelierbrunos.com/products/penny-yacht-loafer` with SHOP_NOW, which is why nothing in the creative or the ad set fields explains the behaviour.

Consequences: roughly $40/day is buying on-platform browsing rather than store sessions; the optimisation event is being fed on-Meta checkouts (7 of the 8 initiate-checkouts in the window are `onsite_conversion`, not website); and the website pixel is being starved, which matters for item 3 below.

**Confirmed from the client's side 2026-08-15.** Gibran raised it himself on Slack at 09:56, asking whether the campaigns had been paused because the site had almost no visitors for two days. He checked Shopify and Propel session replays and found one visitor, from the UK. **The geo breakdown shows all 121 clicks and all $92.81 delivered in the US, so that UK visitor did not come from these ads: the store received zero paid visitors, not one.** Two-way confirmation now exists, platform side and store side.

**The initial explanation given to the client was wrong and needs correcting.** It was put to Gibran that the drop was real visitors replacing bot traffic, filtered out by the move to initiate-checkout optimisation. That does not survive the numbers: a quality filter reduces the *number* of clicks, and the surviving humans still arrive. It cannot produce 48 clicks and 0 landing page views on 14 August. The clicks are not being filtered, they are being delivered somewhere else, and the 55 on-Meta ViewContents recorded the same day show where. The preceding ATC period was also not junk in the way described: it delivered 460 clicks, 368 landing page views and 173 site add-to-carts that the store did see.

**A consequence for the advice given: waiting for 20-30 initiate-checkout events before assessing is now the wrong instruction.** 7 of the 8 initiate-checkouts in the window are on-Meta events, not store checkouts, so accumulating them optimises harder toward the surface that bypasses the store. The window should restart only once traffic is landing on the site again.

**The destination it was sending traffic to is the worst version of the catalog.** This joins two facts that were filed apart. The Meta shop renders the same catalog that has `item_group_id` empty on all 220 products and 112 of 220 variants out of stock, with three styles entirely dead. So three days of spend bought arrival at a shop that shows 8 shoes as 220 separate listings, roughly half of them unavailable. That catalog state was previously filed only as a blocker on dynamic retargeting; while personalised destinations was on it was the actual paid landing experience.

**Commerce settings are permission-blocked for this session** (`commerce_account_read_settings` missing on every `commerce_merchant_settings` field and edge), so whether the Meta shop completes checkout natively or hands back to the site is not readable from here and no claim should be made about it either way. What is readable: 11 on-Meta add-to-carts and 7 on-Meta initiate-checkouts fired, and no purchase action of any type appears in the account for 6-15 August, which would include an on-Meta purchase had one completed.

**2. The retargeting ad set is ACTIVE while its campaign is PAUSED, and the pre-activation gate is still unmet.** Ad set 120249561480450607 is ACTIVE and its budget has been raised from $15 to **$21/day**; campaign 120249561479620607 is still PAUSED, so the ads read `CAMPAIGN_PAUSED` and nothing serves. The founder ruling of 2026-08-06 set a one-item gate before activation: **`advantage_audience` OFF plus a frequency cap**. Read live on 2026-08-15, the ad set still carries `targeting_automation.advantage_audience: 1` and has **no `frequency_control_specs` at all**. Unpausing the campaign in this state launches it with the exact fault the audit named on legacy `02_Broad A+ Footwear`, on a sub-1,000 pool with $21/day to place.

**3. The retargeting pool has stopped growing, and that moves the activation date.** The revisit plan assumed roughly 400-500 matched website visitors a month, projecting a crossing of the 1,500 threshold late September to mid October. Site-wide pixel PageView ran 196-444/day through 11 Aug and has run 82-122/day since the 13 Aug change, because paid traffic no longer lands on the site. Until item 1 is fixed the pool is growing at a fraction of the projected rate and the crossing date slips accordingly. These two facts sat in different places and neither is visible from the other.

**4. Zero purchases, and it is worth stating precisely.** No purchase action of any type appears in the ad account's insights for 6-15 Aug, and the pixel recorded **0 Purchase events site-wide on every day from 1 to 15 August**. The event is not simply uninstrumented: this pixel recorded 4 purchases in the 30 days read on 2026-08-06. Shopify remains the ground truth and we still do not have access to it (see Blocked on), so this is "no purchase reached Meta", not a statement about the client's bank.

## Live structure (read 2026-08-15)

**Prospecting: campaign 120249541099780607 "WMI | Sales | Purchase | Relaunch", ACTIVE.**

- **Live ad set 120249780355700607** "WMI | Cold | US | Advantage (40+ suggested) | Brand-story + PDP | IC", created 2026-08-12 15:58 UTC, ACTIVE, $40/day, `OFFSITE_CONVERSIONS` on `INITIATED_CHECKOUT`, pixel 4240166812964720. US, men, ages 40-65 as an Advantage suggestion, `advantage_audience: 1`, Facebook and Instagram only, no Audience Network, mobile and desktop. Placements were widened well beyond the previous six (instream video, search, business explore, profile feed, notifications, Instagram search and explore home). Five ads, all ACTIVE, all verified carrying instagram_user_id 17841438676219267: `120249780356980607` V4 Penny Yacht (creative 1538729591613875), `120249780357110607` Brand-story 1 (1373877344171557), `120249780357090607` Brand-story 3 (4421723738068655), `120249780357010607` Brand-story 2 (1549179739917928), `120249780356970607` Brand-story 5 (1041175008644666).
- **Previous ad set 120249561418670607** (the ATC one) is now PAUSED. Its five ads carry creatives 4019169585053251, 1052205860512674, 885618217593343, 4094614384169262, 1574676710987214.
- **Discrepancy to be aware of:** PROJECT_STATE §5 records the post-2026-08-06 ATC creatives as 1373877344171557 / 1549179739917928 / 4421723738068655 / 1538729591613875 / 1041175008644666, but those five ids are now the ones in the *new* IC ad set, and the paused ATC ad set holds a different five. A further duplication happened between the two dates. The durable lesson already on file stands and is reinforced: **duplication mints new creative objects, so re-read ids and identity after any duplication rather than carrying a list forward.**

**Retargeting: campaign 120249561479620607 "WMI | Sales | Retargeting | Brand Story", PAUSED.** Ad set 120249561480450607 ACTIVE at $21/day, ADD_TO_CART on the live pixel, includes `WT 180 Days`, excludes `PUR 730 Days`, US, age and gender open, Facebook and Instagram only. **Two ads only, both the clean rebuilds**: `120249576220150607` (creative 1610533014201442) and `120249576230780607` (creative 1016890594490808). **The two defective originals have been deleted, so that item is closed.**

**Timeline of founder edits in the window** (from the account activity log, actor Antoine Martin): ad set created 12 Aug 15:58 UTC, targeting edited 12 Aug 16:37 and 16:45, ads went through review and were reactivated 13 Aug 07:03, targeting edited again 13 Aug 16:42 (dropped Messenger Stories and Threads feed, added the 40-65 age range). The website funnel collapse begins with the 13 Aug delivery.

## Audiences (read 2026-08-15)

| Audience | Id | Delivery | Note |
|---|---|---|---|
| WMI \| Product Viewers \| 30d | 120249561187070607 | 200 ready | **Created 2026-08-05 21:44 UTC** |
| WMI \| ATC \| 180d | 120249561212070607 | 200 ready | **Created 2026-08-05 21:44 UTC** |
| WT 180 Days | 120248512979150607 | 200 ready | 180d inclusion despite `retention_days: 730`; only the purchase exclusion runs at 730 |
| PUR 730 Days | 120248512908860607 | 200 ready | Exclusion pool |
| IG Shop WT 180 | 120248513072100607 | 300 too small | Meta Shop surface only |
| FB Shop WT 180 | 120248513057830607 | 300 too small | Meta Shop surface only |

**The two new pixel audiences exist.** PROJECT_STATE §6 still lists them as "Not created"; that entry is stale and is corrected in this file.

Standing lesson, reconfirmed: every one of these returns `approximate_count_lower_bound` 20 or 1000 as a placeholder. **It is not a population count.** Use `delivery_status` for whether a pool can serve and the publish-time estimate for size, which is only revealed when an ad set using the audience is published (size is suppressed for privacy on website custom audiences using advanced matching, which is on here).

## Funnel and account history

Audit delivered and corrected (`~/Documents/LUCA_SUMMER_META_AUDIT_JULY26.docx`). Lifetime to the relaunch: $1,783.84 spend, 4 purchases, $1,242.50 revenue, ROAS 0.70, CPA $446 against a $311 AOV. Four structural faults named: no usable retargeting layer, Purchase optimisation on 4 conversions in 10 weeks, discount creative at ROAS 0.38 against brand story at 1.15, and five identical ad sets bidding against each other.

**The sharpest leak is still add-to-cart to checkout.** Site-wide pixel, 6-11 Aug: 173 add-to-carts against 17 initiate-checkouts, roughly 10%. This is the largest uncaptured gain on the account and it needs Shopify and GA4 access to diagnose properly.

**Creative bench is one ad deep** (established 2026-08-06 by lifetime ad-level read). Only Image ad 6 produced any purchase ($460.64, 5.88% CTR, 10 ATC, 2 purchases, ROAS 1.69); the other six brand-story ads produced zero on roughly $220 combined. This is why the freelancer's 20 incoming statics matter.

**Quarantined creatives, never activate or duplicate:** 27281703851484492 (Image ad 6) and 1333409402243626 (Image ad 2). Both carry a "Save up to 72%" title and a "$400 to $895" comparative line, the exact discount claim the audit pledged to retire. The comparison is the arithmetic behind the 72% claim and also runs through the paused 15% Off series body copy, so any reuse from that pool must strip it, not just the headline.

**Catalog `1376435071254094`** is a live Shopify sync, 220 products, pixel attached as an event source, product links correct. Content is what blocks dynamic retargeting: `item_group_id` empty on all 220 (8 styles seen as 220 independent products), 112 of 220 variants (51%) out of stock with three styles entirely dead, all items single-image. These are client-side Shopify fixes.

**Audience Network** contamination is confirmed in substance ($10.84 spend, 122 clicks, 16 add-to-carts, 0 purchases) and Audience Network is off across the live structure. The audit's specific 35.8%-CTR figures did not reproduce at account level and must not be repeated without a placement-level recheck.

**Male-only targeting is a founder ruling, not a defect** (2026-08-06). `genders: [1]` is deliberate; the addressable pool is already several million at men only. Stop re-flagging it.

## Blocked on

1. **Founder decision on items 1 and 2 above.** Both are writes, so both are his hand or Bernard's fix path; Meta is read-only for this session.
2. **Shopify and GA4 access from the client.** The access ask doubles as the commerce store connection; the recipe is proven and takes about ten minutes once a custom app exists. This is what turns the add-to-cart leak from an inference into a measurement, and it is the only way to see real orders.
3. Client-side Shopify fixes if engaged: populate `item_group_id`, restock or prune the catalog, add second product images.
4. Migration back to Purchase optimisation, trigger roughly 15-20 purchases/week. Not close.
5. `SLACK_META_REVIEW_CHANNEL` is still unset in Vercel, so the Monday 08:20 Meta weekly report generates for this account and is discarded.

## Standing candidates

Named in the capability map (2026-08-11) as one of two merchants pending access for the commerce connection. The store connection would immediately quantify the add-to-cart to checkout leak with consented abandonment data.

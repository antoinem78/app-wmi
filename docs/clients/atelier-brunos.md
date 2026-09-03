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

## Bernard's verdict 2026-08-15: not a lost cause, but do not bill another cycle before the store review

Requested by the founder, who offered to refund everything since start if the zero-sales cause sits outside advertising. Bernard verified against fresh live reads rather than the summary he was given.

**His 30-day pull:** $929.20 spend, 1 purchase, $250 revenue, ROAS 0.27. Site-wide pixel 3,511 ViewContent, 267 AddToCart, **48 InitiateCheckout, 1 Purchase**. 25 ads carrying spend, exactly one ever converted and it sits on a legacy pre-relaunch campaign; every relaunch-era ad shows real add-to-cart activity and zero purchases. (Window is labelled to 2026-08-17, two days ahead of the read date, so treat it as trailing rather than exact.)

**On the media side he says there is nothing meaningful left.** CPM fell $91.52 to $45.40 period over period, CPC $1.74 to $0.90, CTR holds above 5%, add-to-carts rose 18 to 81 at a fraction of the prior cost. His line: 267 people adding a $250 item to cart in 30 days and producing one sale is not a gap that closes with better targeting or fresher creative.

**His recommendation:** hold the account at its current mostly-paused state, do not restart or expand spend, run the store and checkout review, then decide. If a checkout-level defect is confirmed, a full refund is defensible rather than generous. Do not walk away from the account itself yet, because the traffic and engagement numbers are good enough that it could turn.

**Where this session refines his diagnosis, and it changes what Monday tests.** Bernard's lead hypothesis is a device-specific checkout failure, Android in particular. That does not cover his own figures: **48 initiate-checkouts site-wide produced 1 purchase**, so iPhone users are failing at checkout too. Roughly 98% of everyone reaching checkout on any device fails to complete. The payment step must be tested for all traffic, not just Android. The device split is a real second signal but it rests on 24 Android add-to-carts against 69 iPhone ones, which is suggestive rather than proven.

**SUPERSEDED IN PART, same day: the storefront walk below disproves the structural-checkout hypothesis.** Bernard's reasoning was sound on the evidence he could reach, but he cannot browse, and the store turns out to be correctly configured for US buyers. Keep his commercial recommendation (hold spend, do not bill another cycle, decide after the store review); drop "checkout is broken" as the working theory.

**Open question worth putting to the client:** lifetime this account turned add-to-carts into 4 sales; the last 30 days turned 267 into 1. That looks like something changing rather than a permanent condition. Ask whether anything changed on the store in late July, around when the account went dark on the 27th.

**Commercial note.** Refunding everything since start is one payment, AED 1,800, plus the $92.96 misdirected spend, so about $583. That is almost exactly the cost of the drafted offer to waive the 5 September payment. Refunding August instead of waiving September costs the same and reads better: he pays nothing for the broken month and resumes paying when there is something to pay for.

Bernard's audit document: `https://app.wmiltd.com/api/bernard/audit/1801857321221826?days=30` (needs a signed-in portal session).

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

## ✖ CORRECTED 2026-08-21: the hidden reviews were a deliberate ethical choice, not a defect

**The client explained it himself: the 127 reviews are fake, AI-generated, added by his web developer, and he deliberately chose not to display them.** His brand is two months old with five real sales, so 127 reviews was never plausible. The suppression was his conscience, and the `jdgmSettings is not defined` error is consistent with the widget having been disabled rather than having failed.

**So the recommendation this session made was wrong and would have been harmful.** Advising him to "restore" the display meant advising a US-facing store to publish fake reviews, which the FTC's 2024 rule penalises per violation, with a UK equivalent under the DMCC Act. He was protected by his own judgement, not by ours.

**What survives, and it is the more useful half.** The trust gap is real: a two-month-old brand with five lifetime sales, selling $250 shoes to cold US traffic, with no social proof on the page. The diagnosis stands and the remedy inverts completely. Real reviews from real buyers, a prominent returns and warranty position, the Florence workshop made verifiable, founder story, and buyer photographs. Earn the proof rather than display what was on hand.

**Durable lesson, now in shared memory as [[configured-is-not-rendered]]:** a technical read tells you the state of a thing and never the intent behind it. Absent has three explanations, and "somebody removed it on purpose" is invisible from outside. Ask before calling it a quick win.

The original finding is kept below because the rendering evidence itself was sound and correctly gathered. Only the conclusion drawn from it was wrong.

## Original finding as written 2026-08-15, conclusion since retracted

**The strongest conversion finding on this account, found from the public storefront with no admin access and no test order.**

The Judge.me review widget throws `Uncaught ReferenceError: jdgmSettings is not defined` on page load. The review markup **is** in the DOM and contains `4.9 out of 5 · 127 reviews` with five filled stars, but every container returns `offsetHeight: 0` and `visible: false`, so nothing reaches the shopper. Visible review text on the page: **zero occurrences**.

Verified on **two products** (Penny Yacht Loafer, Lord Yacht Loafer), on **desktop and on an Android mobile user agent** (Pixel 8, Chrome 148). It is universal, not a device or template edge case.

**Why this is likely material to the add-to-cart collapse.** A $250 shoe from a brand nobody has heard of, advertised to US men over 40, with no visible social proof at the moment of decision. The reassurance exists and has been paid for; it just never renders. This sits exactly upstream of the 267 add-to-carts that produced 1 sale.

**It is cheap to fix**, which is the other reason it matters: a broken app script, not a rebuild.

Note the July audit recorded "the product page is good (127 five-star reviews...)". That was read from the store's data, not from the rendered page. **The reviews were counted, not seen.** Worth carrying: a feature being installed and populated is not evidence it displays.

## Storefront walk 2026-08-15: the store is correctly configured for US buyers

Walked from the public storefront, no admin access used, nothing submitted and no order placed. **This rules out the expensive hypotheses and narrows the search considerably.**

| Checked | Result |
|---|---|
| US product page | **$250.00 USD**, in stock, free US shipping, delivery estimate shown |
| Price positioning | Comparison table reads $250 against Morjas $400, Allen Edmonds $425, Loro Piana $895, so they are the cheapest on the page |
| Shopify Markets | 28 countries; **US enabled at USD**; geo-detection working (this browser resolves to AE and correctly showed AED 1,050 at rate 3.67255) |
| Checkout page | Loads; US present with full state list; **credit card plus five more methods, Shop Pay, PayPal, express checkout** |
| US shipping rates | `cart/shipping_rates.json` returns **UPS Ground, $0.00, three days** for NY 10001 and CA 90001. Canada returns UPS Standard $0.00 |
| Store identity | `2cd3d6-2.myshopify.com`, live theme named **"Copy of [dev] Brunos"** |

**Method warning worth carrying:** the first shipping-rates probe returned `{"country":["Country/region not supported"]}` and looked like a decisive finding. It was a bug in the query string, which sent the country as `US]`. Rebuilt with `URLSearchParams` it returns free UPS Ground. **A 422 from a hand-built query string is a claim about your own URL until you have proven otherwise.**

**Live theme is called "Copy of [dev] Brunos".** A duplicated development theme is published as the live storefront. Not a fault in itself, and the pages render correctly, but it is worth confirming on Monday that the published theme is the intended one and not a half-finished copy, because that is exactly the pattern the theme-duplication lesson warns about.

**What this does not clear**, and why the diagnosis is not finished:

- **The mobile in-app browser, where almost all the traffic actually is.** Delivery is Facebook Reels, Stories and Instagram Reels, so buyers arrive inside the Meta in-app browser on a phone. This walk was a desktop browser. In-app browsers behave differently on storage, cookies and payment sheets, and that is now the leading candidate.
- **The final payment authorisation.** Cannot be tested without a real transaction.
- **Android specifically.**
- **Everything admin-side**: abandoned checkouts, per-device conversion, failed or cancelled orders.

## Monday 2026-08-17 diagnostic checklist

Ordered so the tests that could end the investigation come first. Each item says what the result would mean.

**Founder ruling 2026-08-15: no test orders and no test refunds.** The checklist below is built to reach a diagnosis without any transaction. What that costs us is named honestly at the end.

**A. Fix what is already proven broken. No diagnosis needed.**

1. **Restore the Judge.me review display.** The error is `jdgmSettings is not defined`; 127 reviews at 4.9 are in the page and rendering at zero height on every product, every device. → Highest ratio of impact to effort on the whole account, and it needs no further investigation.
2. **Correct the ad destination** (personalised destinations, Shop toggle off) so traffic returns to the site.

**B. Admin data, which the new collaborator access unlocks. This replaces the test order.**

5. **Abandoned checkouts, last 30 days.** 48 checkout starts against 1 sale means roughly 47 records naming the step where people die. **Highest-value single item after the test orders.**
6. **Failed, cancelled and fraud-flagged orders.** → If orders are being placed and auto-cancelled, the picture inverts entirely and the problem is a risk filter, not the funnel.
7. **Conversion rate by device** in Shopify's own analytics. → Independent of Meta, so it either corroborates the iPhone-only pattern or kills it.
8. **Shopify's cart figures against the pixel's 267 add-to-carts.** → If they disagree materially, the add-to-cart event is over-firing and Meta has been optimising toward a phantom action. That would explain the 267-to-48 collapse without any store defect at all.

**C. Catalog and stock, which sit under everything.**

9. **Stock on the exact products and sizes the ads promote.** 112 of 220 variants are out of stock and three styles are entirely dead. → If US 9 to 11 are gone on the advertised shoes, people arrive, find their size missing, and leave. Cheap to check, cheap to fix.
10. **Confirm the published theme is intended** (see "Copy of [dev] Brunos" above).

**D. Only after A to C.**

11. Restart the assessment window once traffic lands on the site and reviews display.
12. Decide keep or continue, per Bernard's recommendation to hold that until the store review is done.

**Not on this list on purpose: the captcha Gibran raised.** His problem is completion, not traffic quality. A captcha adds friction to the failing step. Say so plainly rather than letting it get installed.

**What no-test-order costs us, stated plainly.** Without one completed transaction we cannot prove the payment authorisation succeeds, and we cannot prove the purchase event fires on the thank-you page. Both stay assumptions. Two things reduce the risk: this pixel has recorded purchases before, so the event is wired; and the checkout renders with card, Shop Pay and PayPal on both desktop and an Android user agent, so nothing is visibly broken. **If items B5 to B8 come back clean, the payment step becomes the only remaining candidate and the question returns.** The zero-cost way to settle it then is Shopify Payments test mode, toggled by the client for ten minutes, not a real purchase.

## WIND-DOWN, founder-ruled 2026-08-21

**Ads paused and the fee refunded. The engagement is being closed.** Founder's reasoning: the ads are not the issue, something downstream is, and the price may simply be too high for an unknown brand.

**The destination fault was fixed on 2026-08-15** (not recorded at the time; this session assumed the account was still broken until re-reading on the 21st). Landing page views resumed the same day. **Misdirected spend is therefore the two days 13-14 August only: $92.29**, correcting the $92.96 quoted earlier in this session.

**The six clean days after the fix are what settle it. 15-20 August: $193.52 spend, 245 clicks, 192 site visits, 22 add-to-carts, 6 initiate-checkouts, 0 purchases.** Real traffic, correctly delivered, converting to carts and checkouts, and no sales. Across the whole relaunch (5-20 August) roughly $554.48 and zero purchases. This is the evidence that the failure is not in the media, and it is stronger than anything available on the 15th.

**The reviews were never fixed.** Re-checked 2026-08-21: `jdgmSettings is not defined` still throws, the badge still reads `4.9 out of 5 · 127 reviews` at `offsetHeight: 0`, still invisible on every product page. So a named, cheap, six-day-old defect sat unfixed through the clean window. Whatever else is true, the store was never given its best chance.

**Refund terms:** the AED 1,800 August fee less the Stripe processing charge, which Stripe does not return, so a partial refund of roughly AED 1,730-1,750 (read the exact fee off the charge; Adaptive Pricing is on, so a foreign card costs more). Customer `cus_V1201VnCH5xak7`, subscription `sub_1U0zx5DnjEQZvcK8fwtC5vRw`, **which must also be cancelled or 5 September charges anyway**. The fee refund supersedes the earlier $92.29 ad-spend gesture rather than adding to it.

**Framing caution carried into the close-out message:** "the price is too high" is rebuttable, because the client's own product page compares him at $250 against Morjas $400, Allen Edmonds $425 and Loro Piana $895, making him the cheapest on his own table. The defensible version is that $250 is a lot to ask of a buyer who has never heard of the brand **with nothing on the page vouching for it**. Price as a trust problem, not a number problem.

## NEW OPPORTUNITY: baby products store, UAE, Google-led (raised by the client 2026-08-21)

Gibran asked, in the same message as the traffic query, whether we offer market research and marketing for a new venture: an online baby products store targeting the **UAE**, starting small with two or three product types, and he wants **Google rather than Meta** this time. Notable that he is asking for more work while unhappy about this engagement.

**Shape, founder-ruled 2026-08-21: the research report is FREE, no charge.** Do not quote a fee for it. Same play as the Super Henry free pre-commitment review (PROJECT_STATE §5): the report is the deliverable and the commercial conversation attaches to what follows it, not to the research.

**Research before media is the lesson from this account applied.** A brand-new store with no traffic and no proven offer is exactly the setup that just failed here, and spending on ads before the store can convert would repeat it.

**Scope boundary, and it is load-bearing because the work is unpaid.** Five questions only: (1) real UAE search demand and volume, English and Arabic, and whether it is enough to build on; (2) whether the category is search-led or discovery-led, which decides whether Google is even the right first channel; (3) who already serves UAE buyers including Amazon.ae, Noon and Etsy sellers shipping in, and at what price; (4) what UAE buyers actually pay against the European comparables; (5) unit economics, landed cost, shipping and the maximum affordable cost per sale. Deliverable is one written report ending in a go or no-go, within a week. **Supplier sourcing, store build, keyword build-out and anything operational is the paid phase that follows.** Unpaid work for a just-refunded client is the classic shape that drifts into months of free consulting; the single document ending in a decision is what stops it.

**Unit economics supplied by the client 2026-08-21, and worked here.** Products are handmade in China (so "handmade" is honest, but the European craft premium is not available to him).

*Baby mobiles.* Landed AED 65, stocking 25-30 styles, retail AED 300-350 on non-Amazon sites; Amazon sits at AED 80-99 on two or three designs and is undercutting to the point of being uncontestable. At AED 325: landed 65, processing ~10, local delivery ~20, packaging ~8, returns/breakage at 4% ~13, so **contribution before marketing is roughly AED 209**, i.e. break-even CPA ~209 and a healthy-margin target CPA ~125. Comfortable, and it validates against Little Loua at AED 240-390. Delivery, packaging and returns rate are assumptions and need confirming, but not enough to move the conclusion. **The condition is the 5x markup on landed cost sitting next to Amazon at AED 80-99: sustainable in aesthetic and gift categories, but only away from comparison shopping.**

*Boucle wall decor light.* Landed AED 80, 3-4 styles, Amazon AED 90-140 shipped from the USA, few other sellers. At AED 140 contribution after costs is roughly **AED 21, which cannot fund any paid acquisition**. At AED 280 it clears ~AED 152 and works. **Conclusion: this is an attachment product, not an acquisition product.** Sell the mobile and offer the matching light alongside; it lifts order value on already-paid-for traffic and 3-4 styles is fine for an add-on while being far too thin for a hero.

**⚑ Channel hypothesis, and it now leads the research brief: Google Search is the worst place to defend a 3.5x premium.** A "baby mobile" searcher is in comparison mode with Amazon.ae at AED 90 alongside. An aesthetic, gift-driven product at that premium wants discovery (Instagram, Pinterest, TikTok) where the buyer never runs the comparison. That is Meta, the channel the client wants to move away from after the shoes. **Do not tell him this yet; it is what question 2 of the brief exists to test.** Note the irony to avoid stating it clumsily: the shoes did not fail because of the channel.

**Positioning available to him, honestly:** 25-30 designs, stocked in the UAE, delivered fast, against Amazon's two or three designs or a light shipped from the USA. Choice and speed in-country is defensible, explains the price, and needs no craft story he has not earned. Capital to test is low: 25-30 styles at AED 65 is under AED 2,000 for one of each, the opposite of the shoes.

### Research delivered 2026-08-21: `~/Documents/Baby Mobiles UAE - Pre-Launch Assessment.docx`

**Verdict, stated plainly in the document: go ahead with the business, but do not build it on Google.** The product, supply position and price band all check out; demand is the constraint.

**Verified UAE pricing** (read off the client's own four links, tracking parameters stripped): Little Giggles own-brand Sealife Mobile **AED 345 on a two-week pre-order**; Strawberry Fields Pehr Elephant Parade AED 350 list, **262** now; Smallable Liewood Meli **227**; Mamas & Papas Seedling Musical **129** in stock. **Two segments, not one range:** mass market AED 80-130, design/handmade AED 227-345. Little Giggles is the key comparable, holding AED 345 with no designer label and a two-week wait, which is exactly what local stock plus next-day beats.

**Verified demand** (Google Ads KeywordPlanIdeaService, UAE geo 2784, English 1000 and Arabic 1019, via our own agency account 4151727946). **Product-category terms total roughly 500-600 searches/month across both languages**: crib mobile 210, baby mobile 110, cot mobile 90, infant/newborn crib mobile 70, nursery decor 70, musical cot mobile 40, موبايل اطفال 20, ديكور غرفة اطفال 20. **Gifting is five to eight times larger, roughly 3,000-4,000/month**: gifts for infants 1,000, baby girl gifts 720, بوكس هديه 720, baby gift set 590, newborn baby gifts 320, هدايا اطفال 260. **Clicks are cheap throughout, median high top-of-page AED 1.07, most terms AED 0.20-1.30.**

**Conclusion: a Google-led launch tops out at roughly 10-20 sales/month (AED 2,750-5,500 revenue).** The limit is the number of searchers, not budget or skill. **Supporting detail that makes the argument: the four retailers advertising in this category (Strawberry Fields, Little Giggles, Mamas & Papas, Smallable) are all broad baby retailers, not mobile specialists.** A thin keyword is economic as one strand of a wide net and cannot carry a specialist.

**Method notes worth keeping.** (1) **Oscar cannot do keyword research.** He has no Keyword Planner tool and `get_search_terms` only reads accounts we already run; no `generateKeywordIdeas` exists anywhere in the codebase. The read was built directly in the scratchpad against the REST API reusing the `GOOGLE_ADS_*` credentials. **Worth building as an Oscar tool if market research becomes a repeated service.** (2) `generateKeywordIdeas` returns `DEADLINE_EXCEEDED` against the MCC; call it on a non-manager customer id with `login-customer-id` still set to the MCC. (3) `googleAds:search` rejects `pageSize`. (4) **Keyword Planner reports near-identical variants as separate rows** ("crib mobile", "crib and mobile", "mobile for the crib", "mobile on a crib" all at 210). Summing raw rows gave 8,000 for mobiles against a true distinct figure near 450, an order of magnitude out. Always collapse variant clusters before quoting a total.

**Open questions the report ends on:** whether he positions as gifting as much as nursery; whether he will pair the wall light with a mobile as one higher-value order (it fails as an acquisition product and works as an attachment); and what he will put behind a launch once samples are approved.

**Open questions put to the client 2026-08-21** (he offered further information). In priority order, with what each decides:

1. **Stock in the UAE, or shipped from China to the customer?** Decides everything. Local stock plus fast delivery is the only honest justification for AED 325 against Amazon's AED 90. Shipping from China on a two to four week wait turns this back into Atelier Brunos: a premium price with nothing underneath it.
2. **Links to the sites selling at AED 300-350.** The entire model rests on that number being transacted rather than merely listed.
3. **Supplier exclusivity, MOQs and restock speed.** If Amazon sellers can order identical designs, the only advantages are range and delivery speed.
4. **Has he physically handled samples?** Merchants sourcing remotely often have never held their own product ([[client-product-facts-need-verifying]]), and for something suspended over a baby this is a safety question as well as a quality one.
5. **Own photography or supplier images?** Decides whether a discovery channel is possible at all. Supplier shots shared with every competitor means nothing to advertise and the Instagram/Pinterest route closes before it opens.
6. **UAE delivery cost, absorbed or charged.** Moves the CPA target, not the verdict.
7. **Marketplace (Amazon.ae, Noon) alongside DTC?** and **launch budget and timing.**

**Comparable analysed 2026-08-21, littleloua.com** (client-supplied reference, EU-based, handmade). Mobiles €60-100, mostly €79.95, so roughly AED 240-390: a far easier sale than $250 shoes and needing much less trust. Over thirty designs in the mobiles category alone with many sold out or limited edition, so breadth is the offer because parents theme-match a nursery, and the client's planned "two or three product types" is probably too narrow to get chosen. **Their low ad spend is earned, not clever: they handmake the product, which buys word of mouth, gifting and repeat custom that advertising cannot.** If the client sources rather than makes, he competes on price and delivery and that advantage does not transfer. **This is the same shape as the shoes: a category whose winners hold something he would not have, with ads expected to close the gap.** Same client, so the comparison is legitimate to make to him, and it is the most useful thing to say before he spends.

**Capability questions to resolve before quoting.** Google Ads credentials are wmiltd-only per PROJECT_STATE §3, and Oscar only becomes real for FZCO once that deployment has Google Ads credentials and accounts. A UAE client billed through the FZCO portal wanting Google Ads therefore has an access gap that needs closing first. Decide which entity carries it and whether Google credentials get provisioned on the FZCO deployment.

**Keep the two conversations in separate messages** so the refund does not read as the opening of a pitch.

## Commercial position as at 2026-08-15 (superseded by the wind-down above)

Client escalated on Slack after finding the traffic drop himself. **Redress, founder-ruled 2026-08-15: refund the $92.96 of misdirected ad spend only, and waive September if the client wishes to continue. The August payment is NOT refunded.** An earlier draft in this session proposed refunding August as well; that was not the ruling and the figures it implied (~$1,073) are void.

**Operational note:** the Stripe subscription `sub_1U0zx5DnjEQZvcK8fwtC5vRw` renews **5 September** and charges automatically, so the September waiver needs the subscription paused or cancelled once the client says whether he is continuing. It is conditional on him continuing, so it is not actioned yet.

Client's own points from 2026-08-15, and the answers given: session replays show 25 of his paid sessions (15%) as bots, which does not explain the drought because ~149 real sessions still did not buy and 15% non-human traffic is unremarkable; and "maybe just not enough traffic", which is the expensive misreading, because 267 add-to-carts in 30 days would be 25 to 50 orders at a normal rate, so the failure is the rate and spending more would multiply it.

## Blocked on

1. **Founder decision on items 1 and 2 above.** Both are writes, so both are his hand or Bernard's fix path; Meta is read-only for this session.
2. **Shopify admin reads.** Collaborator access was granted to the founder on 2026-08-15 (store code 6317), but that does not reach this session. Checklist items B5 to B8 need either the founder's logged-in browser or the store connected to the reporting pipeline properly. The connection is the durable version and is the standing item for this client.
3. **Two physical phones**, one iPhone and one Android, for checklist items A2 and A3. Nothing else substitutes.
3. Client-side Shopify fixes if engaged: populate `item_group_id`, restock or prune the catalog, add second product images.
4. Migration back to Purchase optimisation, trigger roughly 15-20 purchases/week. Not close.
5. `SLACK_META_REVIEW_CHANNEL` is still unset in Vercel, so the Monday 08:20 Meta weekly report generates for this account and is discarded.

## Standing candidates

Named in the capability map (2026-08-11) as one of two merchants pending access for the commerce connection. The store connection would immediately quantify the add-to-cart to checkout leak with consented abandonment data.

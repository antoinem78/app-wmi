# instawarm.shop (Vincent Weimer)

**Channel file for the instawarm client session.** Read `docs/PROJECT_STATE.md` §1, §2 and §7 first; they carry the entities, the standing rulings and the cross-session rules. This file is the client's full state and is owned by the instawarm session; update it as things land. Cross-cutting changes (rulings, platform lessons, anything another client would trip over) also get one line in PROJECT_STATE.

## Who and what

- **Client:** Vincent Weimer, Minnesota, US. Store: instawarm.shop (heated jackets). Canonical Shopify domain: `kgh1am-nd.myshopify.com` (the `instawarm-shop` admin handle is an alias). USD, America/Chicago.
- **Commercial (founder-clarified 2026-08-13):** TWO engagements, both count in the client book: (1) **$350/month retainer**, signed via the FZCO portal (the relationship; entity = WEB MARKETING INTERNATIONAL - FZCO, see PROJECT_STATE §1); (2) **$225 one-off first-look fix package** (opened $450, Vincent countered $225, accepted). **Payment on completion** (founder agreed 2026-08-14); delivery staged on a **duplicate theme** with Vincent approving a preview link before publish.

## Store connection (LIVE since 2026-08-14 ~23:00): first real merchant on the commerce pipeline

- Substrate client row `instawarm` (f6a6c751-93ec-47c2-889b-d6d6d068b6a2), `config.commerce` complete.
- Receiver `RCV_shopify_instawarm` (n8n bdzhaoOQUz1P9uqC) ACTIVE at `shopify-rcv-instawarm-108d5688f899`; six webhooks registered at API 2026-07 (orders create/updated, refunds/create, checkouts create/update, customers/update).
- Caller `SHOPIFY_admin_caller_instawarm` (g5GRju7akS7TFhyS) ACTIVE with permanent offline token (n8n credential `Shopify Admin — instawarm`, gLYUr8NDlPdKG2Vj). Signing secret vaulted in `commerce.merchant_secrets`.
- Signed end-to-end proof passed (200 → event → state → task → ingest + state_upserted logs; proof rows cleaned, logs retained). Daily reconciliation covers the store from the next 07:30 sweep; the fourteen-day gate runs from 2026-08-15.

### Gate day 1 verified 2026-08-15

Read off the substrate rather than assumed. `CAP_commerce_reconcile` ran at 06:30 UTC (07:30 London) and logged `completed`, `ok:true`, no diffs, attributed to the instawarm client id: `24h db 0/0 vs 0/0.00; 7d db 0/0 vs 0/0.00`. Zero on both sides is agreement, which is what a no-traffic store can prove. All four instawarm workflows are ACTIVE in n8n (receiver bdzhaoOQUz1P9uqC, caller g5GRju7akS7TFhyS, plus shared `PROC_shopify_event` and the reconciler). Commerce tables hold 0 events, 0 orders, 0 checkouts for the client and 1 vaulted secret, so the proof rows are gone and nothing is stuck.

**Defect found on day 1, and it puts the remaining thirteen days at risk. `CAP_commerce_reconcile` reconciles ONE client per run, not all of them.** The `Commerce clients` query returns every enabled client, but `Prep call` is a Code node in run-once-for-all-items mode, so N clients collapse to one item, and every node after it reads `$('Commerce clients').first()` / `$('DB counts').first()`: the shop domain called, the DB counts compared, the client id logged and even the `skipped_no_caller` row are all pinned to the first row. The query carries no ORDER BY, so which client that is comes down to heap order. Evidence: 12, 13 and 14 August each logged only `zz-commerce-dev`; 15 August logged only `instawarm`, and the dev store, still enabled, produced no row at all. A skipped client is silent, so a missed day looks identical to a day that never happened.

Consequence for this store: the gate could lose days without anyone noticing, and the two clients were taking it in turns by accident. Instawarm happened to sort first, which is why day 1 landed at all.

**FIXED AND PROVEN LIVE 2026-08-15, founder-approved (live workflow, so it needed the ask).** Seven changes: `ORDER BY slug` on the client query; `DB counts` now returns client id, slug, shop domain, api version and caller id alongside the numbers so nothing reaches backwards; `Prep call` switched to run-once-for-each-item (where the collapse happened); `Ask the store` switched to per-item mode (in the old mode the workflow-id expression resolved from the first item, so every client would have queried one store even after the collapse was fixed); `Compare` runs per item, reads its context from `Prep call` by index, and throws rather than passing quietly if the index does not line up; `Compare` now feeds `Log result` and `Mismatch?` in parallel so the alert reads the comparison instead of the INSERT's `RETURNING id`, removing the last `.first()`; `Log skipped` names the right client. Compare logic unit-tested offline first (agreement, mismatch, 250-row page cap, misalignment refusal).

**Proof:** one execution logged both clients, instawarm `ok:true 24h db 0/0 vs 0/0.00; 7d db 0/0 vs 0/0.00` and zz-commerce-dev `ok:true 7d db 1/58.00 vs 1/58.00`. Two different answers from two different stores in the same run is what proves each client called its own caller workflow. Tested by temporarily running the schedule every minute with an unconditional restore in the same script; `30 7 * * *` confirmed restored, workflow active, no runs after the restore. Pre-fix backup: `~/Downloads/n8n-archive/CAP_commerce_reconcile_pre-multiclient-fix_2026-08-15.json`.
- Shopify app: "SingularCommerce" in the founder's Dev Dashboard org ("antoine mcc two", dashboard 129638300, app 410680033281, client_id 508e2e38d01133e75fec7f4503c36aa4). Scopes: read_orders, read_checkouts, read_products, read_customers.

## Baseline (frozen pre-fixes)

- Store ledger: **5 lifetime orders, 2 products** (first-look doc said 0 purchases; the 5 are presumably tests, on record either way).
- Vincent's tracking since 11 July: 836 product-page views, 7 add-to-carts (<1% vs 5-8% healthy), 2 checkouts, 0 purchases.

## Supplier documents received 2026-08-27, and a third wrong-product finding

Vincent sent his supplier's own product images. They close three long-running questions and open one.

**CONFIRMED, stop chasing these:**
- **Temperatures.** The control panel graphic reads Red = Warm 45°, White = Comfort 35°, Blue = Energy Saving 25°. Exactly the 113/95/77°F published, and it confirms the Red/White/Blue mapping. Vindicates the decision not to change the colour names off a machine-translated page.
- **No power bank.** "Packing list: Jacket*1 (No power bank included)" in the supplier's own English.
- **What the size numbers mean.** "Bust 50" for a small is a half measurement, pit to pit, so these are **garment measurements laid flat**. Vincent's earlier relayed supplier answer ("chest is the wearer's body") was wrong. The UGC creator measurement is no longer a blocker.

**NEW PROBLEM: the size chart on the site is for a different jacket.** Supplier's chart versus what is published, for a small: chest 50cm flat (100cm round) vs 70-78cm; shoulder 42.8 vs 40; length 64 vs 61; sleeve 62.5 vs 60. Every figure differs and the published chart runs smaller throughout, so a buyer receives a larger jacket than the numbers promise. **Third item on this store to describe a different product**, after the 21-zone graphics and the review photos.

**Unblocks 5XL and 6XL**, which Vincent asked for on 2026-08-16. The supplier chart covers S through 6XL. Replacement chart with inch conversions is in the working notes below.

**Also from the supplier's own note, matching the runs-small line already published:** "Asian sizes are 1 to 2 sizes smaller than European and American people." Amend the site's "two sizes up" to "one to two sizes up" to match the source rather than my inference.

**To check with Vincent:** the washable graphic says "wash with warm water / hand wash" while the Product Care panel now says machine wash cold in a mesh bag. Someone will ruin a jacket and ask for a refund.

**Image verdicts given:** USE the Red/White/Blue control panel graphic (accurate, corroborates the temperatures). POSSIBLY the two flat lays, especially the open one showing the lining and battery pocket. DO NOT USE the six-panel use-case grid (shows orange, silver, blue and khaki jackets he does not sell, plus blurred faces) or the polyester fabric graphic ("bright colors" is meaningless on a one-colour store).

## Stripe descriptor fixed 2026-08-27

The FZCO statement descriptor read **`WMI-FZCO`**, an initialism plus a legal-form suffix that means nothing to a US cardholder scanning a statement. Changed to **`WEB MARKETING INTL`**, matching the UK entity's descriptor, which was already readable and was left alone. Done at Settings → Business → Public details on `acct_1NK3a9DnjEQZvcK8`.

**Timing was deliberate: both FZCO clients were churned, so no active subscription saw a mid-stream descriptor change.** Once clients are billing, changing it becomes something you have to warn people about. Applies to future charges only.

Probable but unproven cause of Vincent's fraud dispute. Changed regardless, because the fix is free and a fraud-coded dispute costs $35.65 plus a mark on the fraud ratio. **Vincent is being told in advance what the September charge will show**, which is what actually removes the risk for him specifically.

## Store state 2026-08-26: every false claim is off the site

**Verified by reading the live storefront, not from reports.** Homepage, features page, FAQ page and product page are all clean of the old temperatures (150/130/110°F), the "fully tested to meet international safety standards" claim, and the unsupported battery-hours claim. Delivered across four Cowork waves plus founder theme edits.

**Live and verified:** honest shipping figures on three surfaces plus a line on the product page; returns consistent across product page, FAQ and refund policy (30 days, any reason, buyer pays postage unless faulty); power bank stated as NOT included at the top of the product description and as the first FAQ question; heat settings corrected to 113/95/77°F everywhere; size guide rebuilt from a screenshot into a real table with inches and a runs-small warning; About page in Vincent's first person with his name; support@instawarm.shop everywhere including store settings, domain authenticated; gallery leading with two outdoor shots; sticky mobile buy bar; product URL shortened to `/products/heated-jacket` with a working 301; footer in his voice; all typos cleared.

**Still outstanding, FOUNDER ONLY (see the Cowork limits below):** disable the AS SEEN ON section in `templates/index.json` (`image_banner_e8VNbp`) and `templates/product.json` (`image_banner_MPRFNF`) by adding `"disabled": true` to the SECTION object, since neither has a `blocks` key. Swap `Screenshot_2026-02-13_at_17.59.48.webp` (the "21 HEATING ZONES" callout, wrong for a 9-zone jacket) for `Screenshot_2026-02-13_at_18.08.09.webp` on block `ai_gen_block_f7b7c54_aHkDLq` in both templates: **swap, do not disable**, because that block also carries five feature title/text pairs. And hide two Loox review photos ("N d" 21 Dec 2025, blue jacket; "Er" 6 Oct 2025, olive jacket).

**Deliberately held:** `Screenshot_2026-02-13_at_14.04.00.webp`, the front-and-back panel diagram. It states no number, so it is misleading rather than false, and pulling it leaves a visible hole. Swap it when Vincent's corrected artwork arrives.

### Cowork limits, now proven rather than suspected

**Cowork cannot type into the Shopify theme code editor.** Cross-origin iframe on `online-store-web.shopifyapps.com`: clicks land and produce selections, keystrokes never arrive. Diagnosed thoroughly in wave 4 (cursor position in the status bar never moved under keyboard navigation, fresh tab identical, zero changes confirmed via Timeline rather than assumed). **Same class of failure as the Loox Reviews embed in wave 3.** Both are embedded app surfaces. The founder has driven the code editor successfully by hand, so this is an automation limit, not a store problem. **Do not brief Cowork for theme code or Loox again.** It handles Content → Pages, Products, Files and Settings well.

**Two briefing lessons, both my fault not Cowork's.** Wave 3 lost three steps to rules I scoped badly: a "note the file version before saving" rule written for theme files made a Shopify Page edit impossible, and a "disable the block" removal mechanism assumed a structure that none of the three target images actually had. Cowork correctly declined all three under "if a rule conflicts with a step, the rule wins" and reported the real structure, which is what made the wave 4 instructions possible. **Give removal mechanisms only where the structure is known, and scope safety rules to the surface they were written for.** Also: its filename transcription is unreliable (it reported wrong date prefixes on two images), so verify identifiers independently while trusting its structural findings.

## ⏸ PARKED ACTION, due 2026-09-09: restart the retainer subscription

**Do not do this before 9 September.** The checkout starts the subscription the moment it is paid, so paying earlier moves the monthly anniversary and doubles up with the August invoice already sent. 9 September keeps the cycle on the original 9 August billing date.

**Do NOT delete the client and do NOT use the upsell flow.** Deleting loses the signed agreement reference, the questionnaire the ad build depends on, the activity log and the Stripe customer holding his payment and dispute history. The upsell flow is deliberately built as an isolated add-on subscription requiring its own signable quote, so using it for the core retainer would record the main service as an add-on and leave the client with no core subscription. It has also never run on a live client.

**What to do instead**, verified against the code and the live records on 2026-08-20. `submitCheckout` in `src/app/onboarding/[id]/actions.ts` has no status guard, and the onboarding page has no churned-client guard, so the original path still works. The only blocker is that the wizard reads him as finished. On the **FZCO** database (`FZCO_DB_URL`, project ref vpagppjjdonxqluzglia, a third database, mind the two-DB warning):

```sql
update onboarding_state
   set payment_status = 'unpaid',
       current_step   = 'payment'
 where client_id = 'bce02581-5023-474b-8ea5-2e8a8ceba9a7';
```

Both columns are enums (`payment_status` default `unpaid`, `onboarding_step` default `questionnaire`; steps in use are `contract`, `payment`, `complete`). Then send his existing link `https://app.webmarketinginternational.com/onboarding/bce02581-5023-474b-8ea5-2e8a8ceba9a7`. He lands on the payment step with agreement and questionnaire behind him, pays on the new card, and the same webhook that activated him on 9 August records the new subscription. **Verify `clients.status` actually returns to `active` afterwards rather than assuming it.**

Live state as read 2026-08-20: client `bce02581-5023-474b-8ea5-2e8a8ceba9a7`, status `churned`, `stripe_customer_id` `cus_V2Mbwpnh2fM8Bq`, custom_monthly_price 350 USD; onboarding row `current_step: complete`, `payment_status: paid`, details confirmed, questionnaire and contract id both present.

## Billing settled 2026-08-20, and the dispute

**The dispute is closed and LOST** (`du_1U6025DnjEQZvcK8CCT9m41x`, Stripe events show "You lost a dispute" 20 Aug 17:11). Nothing left to accept or counter. Vincent filed it in error against a Visa debit ending 1079 (Wells Fargo, CVC passed, billing address North Mankato MN, so a legitimate cardholder who did not recognise the descriptor), apologised unprompted and asked for an invoice so he could repay.

**Exact cost, from the Stripe payment breakdown:** the $350 in and $350 out cancel. Unrecoverable fees total **$35.65** (processing $13.95 + $0.70 tax, taken 9 Aug and never returned by Stripe on a disputed payment; dispute fee $20.00 + $1.00 tax). The $371 withdrawal was $350 plus the $21 dispute fee. A second processing fee of roughly $14.65 applies when he pays again.

**Founder rulings 2026-08-20:**
- **The $225 fix invoice is VOIDED.** The store work folds into the retainer.
- **August's $350 IS still collected** (Stripe invoice link sent 20 Aug). Reasoning: Vincent initiated the repayment himself and August was not idle, it was spent on the store rather than on ads.
- **The $35.65 in fees is absorbed, not recharged.** Writing off $225 and then itemising $36 of fees sends two opposite messages in one invoice.
- **Retainer scope stated to the client from September:** advertising (campaign build, management, creative, reporting) plus store work where it serves the campaigns. Anything substantial and separate is quoted before starting. This sentence exists specifically so "website work included in the retainer" does not become unlimited store work on a $350/month ads retainer.
- Old subscription cancelled outright so nothing can touch the reported card.

**Open with Vincent on this:** what the original charge looked like on his statement. If the descriptor is opaque it will recur on the next client, and it is the likely cause here.

**Also noticed, not this channel's:** Atelier Brunos also shows `churned` on the FZCO portal at AED 1,800/month. May be deliberate; worth a look in the Brunos channel since it is the same field.

## Status 2026-08-17: doc complete, second wave absorbed

**The first-look doc (10 findings + 3 observations) is done and verified live**, except the product page line that waits on Vincent's zone answer. Verified by reading the storefront, not from claims: shipping figures aligned across three surfaces, false "hundreds of customers" line removed, returns consistent across product page / FAQ / refund policy, About page rewritten in Vincent's first person with his name, size guide rebuilt as a real table with inches, support@ everywhere, sticky mobile buy bar live, typos cleared including a second `VERSITILE` and `ERANDS` found on a later proofread.

**Vincent's answers 2026-08-16:** he orders the **9 zone** version (his site sells 21, so the site is currently untrue), and he **wants the power bank included** with every order.

**FOUNDER RULING 2026-08-17: the second wave of work is absorbed into the $225, not scoped and priced separately.** A scope paragraph was drafted for the client message and the founder removed it deliberately, to strengthen the relationship on a first engagement. So the zone correction, the temperature rewrite, the battery bundling advice, the trust strip replacing "AS SEEN ON" and the safety-claim softening are all delivered at no extra charge. Do not reopen this; it is decided.

**Still genuinely open, and none of it is ours to decide:**
- **Which jacket Vincent buys.** Switching his order to the 21 zone SKU makes the whole site true for a few dollars a unit; staying on 9 needs new graphics because the zone count is baked into images, not text. The product page should not be touched until he answers.
- **Whether his supplier will bundle a battery.** "Included" and "arrives separately" are different promises and need different copy.
- **Measurements** from his UGC creator, which gate any "how to measure yourself" guidance and the 5XL/6XL sizes he asked about.

**Applied without waiting on any of the above:** safety claim softened in all three places it appears (FAQ page, homepage accordion, product page accordion); temperatures corrected to the supplier's 113/95/77°F from the published 150/130/110°F, colour names left alone because the only contradiction came from a machine-translated page and that is not evidence; the runtime claim stops quoting hours it cannot support; the AS SEEN ON strip removed from homepage and product page and replaced with a four-line promise strip that is true on every word.

## The $225 fix package

- Source findings: `~/Downloads/InstaWarm-First-Look-Visual (1).pdf` (10 findings + observations).
- **Copy pack ready for founder review: `~/Documents/INSTAWARM_FIX_PACK_v1.md`** (exact copy for all items; return policy drafted in two variants).
- ⚠️ **REVERSED 2026-08-16: the power bank is NOT included.** Vincent's 14 August "confirmed included" was wrong and he corrected it himself, unprompted. His past units came via Amazon and those bundled a battery; ordering direct from his supplier, the battery is a separate SKU. **The fix pack had "USB power bank included. Everything you need to stay warm, in the box." written and approved-pending for the product page.** Publishing it would have put a false claim on every sale, three weeks before the customer could discover it, behind a 30-day refund we had just persuaded him to honour. **The live site is clean** (checked every page's text 2026-08-16: it says "designed to work with any standard 5V USB power bank" and "your power pack", never that one is included), so there is no live mis-selling. Product images NOT yet checked; a photo of a battery in the box makes the same promise as a sentence, so that is an execution-pass look before any absence claim.
- **Lesson, and it is the important one: a client confirming a product fact is not verification, especially a dropshipper who has never handled his own product.** Vincent has never worn or tested the jacket and does not have one. Treat client-supplied product facts as claims to be checked, exactly like an API reading.
- **Open commercial question put to Vincent, higher leverage than any copy in this package:** ask the supplier for the bundled-battery SKU price. A $149.95 heated jacket that arrives after two to four weeks and cannot be switched on is a refund and a one-star review, and we now fund the refund. Under ~$10 to bundle, include it and say so. If he declines, the page must state plainly what to buy.
- **Second risk raised with him:** his UGC creators were sent Amazon units that included a battery. Any footage showing a battery unboxed, if it is running in ads or on the product page, promises what his supplier does not ship. Touches the Meta account, not just the site.
- Confirmed by Vincent: honest shipping = 3-5 day dispatch + US 10-20 business days (CA 12-25, AU/EU 10-20, world 15-30).
- **Chase sent and ANSWERED 2026-08-15.** Three of the four closed, one not.
  - **Returns: variant A.** "30-day refund is good." Product page, FAQ and policy page all carry the 30-day refund, buyer pays return postage unless faulty.
  - **About page: closed, with two corrections to the plan.** Vincent identified the page himself: the existing `/pages/hello-and-welcome` IS the about page (current copy is generic agency "we" voice), so no new page is created, that one is rewritten. He supplied short and long versions and asked whether to use his name. **Yes, and it was recommended back:** a named founder in Minnesota is the strongest trust asset a 5-order store has, and it underwrites the 30-day promise. Use the long version tightened, first person, his voice, his name in the opening line.
  - **Branded email: closed, and he asked for it himself.** He already has support@instawarm.shop and wants it replacing instawarm.shop@gmail.com. Agreed. **Domain control verified without asking him** (standing rule): `instawarm.shop` runs on Google Cloud DNS (`ns-cloud-c1..c4.googledomains.com`) with MX on `smtp.google.com`, so zone and mailbox are both Google Workspace. **No DNS change is needed to receive.** Open check for the execution session: Shopify sender authentication, or store emails still leave from a Shopify address with reply-to. That would need records in his Google zone, which is a separate ask.
  - **Size chart: NOT closed, despite an answer.** He replied that per the supplier the chest figures "appear to" be the wearer's body and the shoulder/length/sleeve are the garment. Twice-hedged and second-hand, and we have now committed to refunds, so wrong fit guidance is a refund we fund. **Chart verified against the live page** (it is a screenshot PNG, 1492x588, not text; transcription in the fix pack is exact, including the "4Xl" typo). Taking his reading at face value: S fits a 27.5-30.5" chest (a child of about 9), XL fits 32.5-36.5" (a US small), and the largest size sold, 4XL, fits 40.5-45", so an average US man needs a 3XL. **The commercial finding holds under either reading: the jacket runs two to three sizes small against US expectations and nothing on the page says so.** Against 836 product views, 7 ATCs and 0 purchases, that is a leading candidate for the conversion failure itself. Resolution asked for: one armpit-to-armpit measurement off a physical jacket plus the size on its label, and his agreement to a US equivalence column and an explicit "runs small, order two sizes up" line, which is safe whichever way the headings resolve.
- **COWORK BRIEF WRITTEN 2026-08-16: `docs/COWORK_BRIEF_instawarm_fixes.md`.** Modelled on the Super Henry brief, which is the established pattern. Part A is eight edits with exact find/replace, Part B is read-only evidence gathering, Part C is a mandatory validation report (per step: text found verbatim before, whether it matched, text left after, screenshot of the published page, timestamp, deviation) plus what was NOT done and why. Eight override rules sit above the steps: only the listed edits, stop rather than approximate on a text mismatch, nothing about the battery, do not touch the safety claim, no fit guidance, no theme publish or code editor, no pricing/orders/customers, no contacting anyone. **Step 0 is a permission map, and it is a hard gate: if Content and Pages are unreachable the job stops**, because Super Henry's Cowork collaborator was silently denied on Content and that is where Pages live.
- **Cowork capability, established from the record rather than assumed:** Cowork has already operated inside `admin.shopify.com` (Super Henry, 2026-08-10), read Analytics with date ranges, and clicked "Request access", a state-changing action. The recorded `admin.shopify.com` block is the **Chrome extension**, a different route, and does not transfer. What stopped Cowork there was Shopify collaborator permissions, not capability. **Every Cowork job to date has been a read; this brief would be the first write to a live client store**, on a store with no staging and no page version history in Shopify. Mitigation that exists by accident: the build sheet and brief both quote the current live text verbatim per edit, so any bad save is restorable by hand.
- **BUILD SHEET WRITTEN 2026-08-16: `~/Documents/INSTAWARM_BUILD_SHEET.md`.** Exact target, exact before text (read off the live storefront that day, not from the first-look PDF) and exact after text for every unblocked item, plus the admin work order. Turns the founder's admin session into a mechanical sequence.
- **Four live problems found while writing it, none in the original ten findings:**
  - **N1, highest severity after the battery: the shipping page understates delivery by roughly half.** Live shipping page says USA 5-10 business days; the FAQ says 15-21; Vincent's real figure is 10-20. Three contradictory claims published at once and the fastest one is the wrong one. A buyer who reads the shipping page is disappointed around day 10 and now has a 30-day refund to reach for.
  - **N2: "Every day, we deliver to hundreds of customers across the world"** on the shipping page, against 5 lifetime orders. Imported template boilerplate, plainly false, replace rather than soften.
  - **N3: "fully tested to meet international safety standards"** on the FAQ page and repeated on the homepage. A substantiation claim about a lithium-powered heated garment sold into the US, made by someone who has never handled it and holds no reports. **Ask Vincent whether the supplier provides CE / FCC / UN38.3 documentation.** If yes it stays and can be strengthened; if no it comes out.
  - **N4: smaller live errors.** FAQ "3 different **heart** levels"; FAQ dispatch 4-7 days versus shipping page 3-5; battery runtime claimed as "4.5+ hours on low" with no capacity stated, which is unsupported given the customer supplies their own bank.
- Useful correction to the plan from the same read: **the product page returns copy is already variant A** ("30 days for a stress-free refund"), so it needs no edit. The FAQ is the side that contradicts it, not the product page.
- **New finding from the same check, not in the original ten:** the size guide is a single screenshot image. Unreadable on a phone without pinching, invisible to search, unusable by a screen reader. Rebuild as a real HTML table during the pass. Deliberately NOT raised with Vincent yet, to keep his open list short; it goes in the change list afterwards.
- **Execution model CHANGED 2026-08-15, founder ruling: no duplicate-theme staging.** The 14 August plan (build on a duplicate, Vincent approves a preview, then publish) is technically unsound and was withdrawn. Verified against the live store: FAQ, size guide, shipping, contact and welcome are Shopify *pages*, and the guarantee wording and typos live in the *product description*. That is store data, shared by every theme at once, so it goes live on save whichever theme is published. Only the sticky add to cart bar is genuinely theme work; parts of two others touch theme sections. Staging the other eight items would mean writing the copy twice, the second build unpaid, which is what the founder refused.
- **Revised execution:** one pass on the live store (founder logged into the admin, Code drives the browser), sticky bar built on a theme copy and published once, then a change list with links to Vincent and one bounded revision round. Exposure during the pass is near zero: no purchases, minimal traffic, every edit an improvement on what is published. **Completion is defined as "live and the change list sent", not "preview approved"**, deliberately: payment is on completion, so the finish line cannot be a client-controlled approval loop.
- Lesson worth carrying to any future Shopify fix engagement: **a theme duplicate stages design, not content.** Check which side of that line each item falls on before promising a client a preview.

## Access

Founder holds collaborator access to the store admin (`admin.shopify.com/store/instawarm-shop`). Connection-path lessons (Dev Dashboard, legacy-flow OFF, embed OFF, OAuth catcher for external-store tokens) are recorded in PROJECT_STATE §5 and belong in the provisioning recipe rewrite.

# Monde du Tabouret

**Channel file.** Read `docs/PROJECT_STATE.md` §1, §2 and §7 first; this file is owned by the monde-du-tabouret session and is the client's living state. Content below was moved verbatim from PROJECT_STATE §5 on 2026-08-15 during the per-client split (pre-split history: commit d71cf65).

## Channel stood up 2026-09-04, founder-instructed, AGENT-OPERATED

No session had claimed this file since the split; the founder ordered the channel opened like every other account, with Norbert, Bernard and Oscar involved. Operating model for whichever session runs this channel:

- **Norbert is the front door.** Discuss intent and sequencing with him before dispatching either agent: portal `/norbert`, the `/norbert` relay skill, or Slack (he answers @mentions; there is also a `#mdt-agents` Slack channel with him in it, created 2026-09-04, currently PUBLIC unless the founder has made it private since).
- **Bernard owns the Meta side.** MDT is a registered lab client with the Phase 0 monitor live (details below). His daily monitor has reported the account BLOCKED (pixel and catalog both not OK) continuously since at least 2026-08-12, consistent with the Phase 0 blocker below. Verify live before repeating any state from this file; the standing blocker is the client completing the Shopify "Facebook and Instagram by Meta" app setup, and nothing green-lights Phase 1 on a shell catalog.
- **Oscar has no footing yet.** MDT is not an imported Google Ads client, so he can neither report on it nor file proposals; if Google work ever starts here, import it first (Add managed account in the portal).
- The agent capability set (what is executable vs advisory, the gates, Norbert's review) is in `docs/AGENT_UPGRADE_RESPONSE_hybrid_model.md`; all writes remain founder-approved per proposal or per move.

## Phase 0 verified live 2026-09-04: still blocked, and the blocker is now more precise

First session on this channel. Norbert dispatched Bernard for the read-back; Bernard confirmed the account side and named three surfaces his tools cannot read (business-level pixels, catalog counts and event sources, commerce-merchant state), refusing to claim absence on any of them. Norbert assigned those three to this session as direct reads, GET only, substrate token, with the public storefront as the user-visible surface. Norbert countersigned the assembled state and the client sentence, and marked Bernard's three gaps closed in his record. No write was made anywhere.

**Ad account act_27875735492115545 (Bernard's read, corroborated here):** zero pixels; the two campaigns are PAUSED with zero ad sets, zero ads, EUR 0 lifetime spend, last edited 19 July. Nothing has moved on the account since 30 July.

**Client business 908995597197130:** `adspixels`, `owned_pixels` and `client_pixels` all return empty data with no error, from a token that reads the same business's catalogs successfully, so this is a real empty read. WMI's own business holds no MDT pixel either.

**Catalogs: three now, all shells, all with WMI holding ADVERTISE and MANAGE, all with ENABLED commerce-merchant settings, none with an `external_event_sources` entry, no feeds, empty diagnostics:**

| Catalog | Products | Merchant display name | Note |
|---|---|---|---|
| Tabouret France 485887071223434 | 0 | Mundo del Taburete | unchanged since 30 July |
| Catalog_products 1572116403588693 | 1 | Monde du Tabouret | data source is the "Products" app (515496645328243), BATCH_API, PRIMARY: the Shopify channel's sync path, connected and delivering one product (Alto Bleu bar stool, EUR 180, still live on the store) |
| test 4081616088725881 | 0 | Sgabelli da bar | NEW: first appears in the monitor's own log on 2026-08-11, absent on 10 August |

Shop-level commerce detail (sales-channel status, shop status) is behind a commerce permission neither of our tokens carries (#200 on `commerce_merchant_settings` objects and on `owned_product_catalogs` from the portal token). That surface stays **unread, not absent**.

**New finding from the storefront.** mondedutabouret.fr lists about 1,450 products (six pages of 250 from the public products listing), and its Shopify web-pixel manifest carries a Meta pixel, id 1020830254138442, type `facebook_pixel`, installed as an app pixel. Reading that pixel with our token returns "Missing perms" rather than "does not exist", so the pixel EXISTS and sits in a business or personal account we do not hold. Whether it was already there on 30 July is unknowable: nobody read the storefront then.

**What this means for the blocker.** The client has connected the Facebook and Instagram channel, but the connection is split: the storefront fires a pixel outside business 908995597197130, while the product sync lands in our business's Catalog_products and has delivered 1 of ~1,450 products. Norbert's reading, which I share: a partial or re-done setup, consistent with the `test` catalog appearing mid-August under an Italian merchant name. So the fix on the client side is likely a disconnect-and-reconnect of the whole channel pointed at business 908995597197130's own pixel and catalog, plus making the full range available to the channel in Shopify (the 1-product sync smells like a product-availability setting). Whoever handles the client call should check both halves. Phase 1 stays specified as below and stays shut.

**Monitor, read from the code rather than the channel file:** `BERNARD_monitor` runs daily at 09:00 London, 47 verdict rows since 20 July, `monde-du-tabouret:blocked:p0c0` every day since the 30 July fix, zero check errors. `catalog_ok` is true only when some catalog has `product_count >= 20` AND the account or business pixel id appears in that catalog's `external_event_sources`; event sources are fetched only for catalogs at the floor, so `pixel_linked: false` on a shell is by construction, while `product_count` is read directly and is ground truth. The monitor's evidentiary standing for this file is therefore sound.

**Client sentence, countersigned by Norbert (Anthony, first person):** "The one thing still outstanding is on the Shopify side, in the Facebook and Instagram sales channel: it is currently connected to a Meta pixel that sits outside the Monde du Tabouret business account I manage, and only one of your products has been shared with the catalogue, so I need that channel pointed at the business account's own pixel and catalogue, with the full range made available to it, before I can start building the ads."

Also seen on the storefront, noted only: a Stape app extension (server-side tagging) and a Google pixel with account 79883960543. Not investigated; not part of Phase 0.

Working notes: the read scripts (GET only, paging stripped, token pattern redacted) and the raw JSON are in this session's scratchpad, not the repo. The portal token in `.env.local` cannot read `owned_product_catalogs` (#200); the substrate token can, which is the path the monitor uses.

---

**Monde du Tabouret** (slug `monde-du-tabouret`). Shopify bar stools and chairs, France and Belgium, mondedutabouret.fr, EUR, page 341731552612640 connected.

Two campaign shells exist and are PAUSED, structure verified independently by the founder. **Phase 0 is still blocked as at 2026-07-30**, re-verified live that day: zero pixels on both the ad account and the client business 908995597197130, and the two catalogs are shells (`Catalog_products` with 1 product, `Tabouret France` with 0) with no pixel attached as an event source on either. The single blocker is the client completing the "Facebook and Instagram by Meta" app setup in Shopify, which creates the pixel and streams the range. **Do not green-light Phase 1 on a 0-or-1-product catalog.** WMI holds ADVERTISE and MANAGE on both catalogs, so the build has the access it needs the moment the range arrives.

**Corrected 2026-07-30: "no product feed" is not a valid test for whether a Shopify sync is live.** This file previously read the missing feed as proof of a hand-made catalog. It is not. The Atelier Brunos catalog is a fully working Shopify sync with 220 products and it also reports `feed_count: 0` and zero `product_feeds`, because the Shopify app syncs through a commerce-merchant connection rather than a scheduled feed file. Further, MDT's single product is a genuine Shopify product (a mondedutabouret.fr product URL, a Shopify CDN image, EUR 180, in stock) and the catalog carries a `commerce_merchant_settings` record, so it reads as a stalled or partial sync, not something hand-built. **The fields that actually separate a live sync from a shell are `external_event_sources` (is a pixel attached) and `product_count`.** The gate stays shut on those two; only the reasoning was wrong.

**The Phase 0 monitor was one condition away from a false green. Fixed and live 2026-07-30, founder-approved.** `BERNARD_monitor` (n8n `RGKYojPeH06ALtLC`, cron `0 9 * * *`, Europe/London, error workflow `MAINT_error_alert`) always ran reliably; the defect was what it tested. Its `catalog_ok` was `product_count > 0`, which the 1-product shell already satisfied, so only `pixel_ok: false` was holding the gate and the client's app install would have tripped a green light against a one-product catalog.

The gate is now three clauses, all of which must hold:

1. a pixel exists on the ad account or the client business,
2. a catalog carries **at least 20 products** (founder-set floor) **and** has that pixel attached as an `external_event_sources` entry, so dynamic ads have something to retarget against,
3. no check failed.

Clause 3 matters because the Meta HTTP nodes run `onError: continueRegularOutput`, so a failed read returns empty data rather than throwing. That fails closed, which is safe against false greens, but it made a permission breakage indistinguishable from "still blocked". Failed checks are now collected per client and surfaced as a red CHECK FAILED line.

Notification changed from green-only to state-change. A new `Prev state` node reads the last `daily_monitor` verdict out of `action_log` and the run posts to #alerts only when the verdict changes or a check fails, so silence now means "nothing has moved" rather than "possibly broken". The `Manus usage` node is removed, per the cancellation in §2.

Verified before and after deploy: nine offline scenarios against real Graph payloads (including the exact false-green case, the floor boundary at 19/20, an unlinked catalog, and a permission error), both SQL statements against the live database with the insert rolled back, all three Slack templates rendered, then a live scheduled execution with the Slack nodes disabled. That run computed `catalog_ok: false` where the old code computed `true`, and both IF nodes routed correctly. Backup of the previous definition and the build script are in the session scratchpad; the nightly `Daily Backup to GitHub v2` also covers it.

**One consequence to expect:** the verification run wrote a `daily_monitor` row in the new format, so the 31 July 09:00 run will compute an unchanged verdict and stay silent by design. That is correct behaviour, not a failure.

Phase 1, when unblocked: four product sets, four ad sets in the existing campaign `120250024094940369`, four Advantage+ catalog carousel ads, all PAUSED. Product-set filters must come from real feed fields; skip and flag anything that cannot be expressed rather than approximating.

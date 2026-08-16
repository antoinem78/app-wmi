# Monde du Tabouret

**Channel file.** Read `docs/PROJECT_STATE.md` §1, §2 and §7 first; this file is owned by the monde-du-tabouret session and is the client's living state. Content below was moved verbatim from PROJECT_STATE §5 on 2026-08-15 during the per-client split (pre-split history: commit d71cf65).

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

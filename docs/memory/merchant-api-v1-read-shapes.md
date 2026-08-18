---
name: merchant-api-v1-read-shapes
description: "Merchant API read gotchas verified 2026-08-18: v1beta is dead, product_view requires id in SELECT, and local~ rows inflate catalog counts several-fold"
metadata:
  node_type: memory
  type: reference
---

Verified live against Merchant Center 137224936 on 2026-08-18.

- **v1beta returns 409 and is gone** (discontinued 28 Feb 2026). Use `merchantapi.googleapis.com/reports/v1`, `/products/v1`, `/datasources/v1`. Any note still referencing v1beta is stale.
- **`product_view` rejects a SELECT without `id`** with a 400 naming the field.
- **Row counts overstate the catalog.** Rows are keyed `{lang}~{feedLabel}~{offerId}`, and a parallel set keyed `local~en~{feedLabel}~{offerId}` carries the local-inventory view with `availability: UNKNOWN`. For HoI, 126,839 rows was 33,214 real UK online offers plus a 34,074-row local view plus separate feed labels. Filter `id.startswith('en~')` for the online catalog. The long-standing "~128k offers" figure was this artifact.
- **`item_issues` at pageSize 1000 stalls the request.** Pull it separately or at a smaller page size; without it a page is ~1.2s.
- **Python `urllib` hangs against `merchantapi.googleapis.com`** on this machine while `curl` to the same URL returns in about a second. Shell out to curl for these pulls.
- The OAuth client in `.env.local` (`GOOGLE_ADS_*`) already carries the `content` scope, so no separate Merchant Center credential is needed.

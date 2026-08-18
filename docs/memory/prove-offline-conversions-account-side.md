---
name: prove-offline-conversions-account-side
description: A recorded UPLOAD_CLICKS conversion attributed to a campaign is itself proof the GCLID was captured and matched; upload diagnostics resources are not a valid absence test
metadata: 
  node_type: memory
  type: project
  originSessionId: 8cc72274-4b6a-4ba4-88a0-67fb40f0f19f
  modified: 2026-08-16T17:34:39.104Z
---

Whether a client's offline conversion plumbing actually captures and persists the GCLID can be proven entirely from the ad account, without reading their code and without their dev confirming anything. Google only records an `UPLOAD_CLICKS` conversion when the uploaded GCLID resolves to a real click in that account, so a recorded conversion **attributed back to the originating campaign** is end-to-end proof: click served, GCLID captured, persisted through the flow, uploaded intact, matched. Proven on Steffen Foerster 2026-08-16, reading a test that had run on 12 August and that nobody had recorded.

**Why:** this is the standard blocker on every offline-conversion client (KST, VIP, Buggy Trip, and anything feeding the WhatsApp bridge's completed bookings back to Google). It usually reads as unprovable without an in-region click the founder cannot make himself, so it sits open. It is not unprovable, it is just read from the wrong side.

**How to apply:**

- Query `metrics.all_conversions` and `metrics.all_conversions_value` segmented by `segments.conversion_action_name`, over an explicit date range, joined against campaign. That is ground truth.
- **Do not use `offline_conversion_upload_client_summary` or `offline_conversion_upload_conversion_action_summary` as an absence test.** Both returned zero rows while two conversions had demonstrably landed four days earlier, most likely because the implementer used the Data Manager API rather than the Google Ads upload service. Concluding "nothing uploaded" from those resources would have been wrong, which is [[meta-api-absence-claims]] on a Google surface.
- Check the action's `value_settings` before reading any value. A conversion showing exactly the action's `default_value` means the upload carried no value and fell back, which is correct for count-only actions and a failure for value-carrying ones. Read a known-good count action first to learn what the fallback looks like in that account.
- Prove per leg, never in aggregate. One leg passing says nothing about the others: the Calendly leg passed here while the Stripe leg had never fired once.
- v24 gotchas: `campaign.start_date` no longer exists and `DURING LAST_90_DAYS` is rejected, so use `BETWEEN` with explicit dates.

Sibling of [[check-access-before-requesting-it]]: read the live account before handing the founder or the client a task.

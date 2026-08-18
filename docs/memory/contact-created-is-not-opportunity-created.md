---
name: contact-created-is-not-opportunity-created
description: "A CRM intake that creates a contact often creates no opportunity, so there is no won event to feed back; check the pipeline holds rows before promising the conversion loop"
metadata: 
  node_type: memory
  type: project
  originSessionId: 20a84efb-ced7-4b3b-9ab0-eec2cef4f948
  modified: 2026-08-16T18:41:55.519Z
---

`RCV_wa_inbound_wmi` upserts the contact, stamps the five attribution fields, claims the ref and logs the task. It creates no opportunity, and the WMI location held **zero** opportunities on 2026-08-16 as a result. The intake looked complete because the part everyone tests, the contact appearing with a click id attached, worked perfectly.

**Why it matters more than it looks:** the offline-conversion loop needs a won event with a value. No opportunity means no won event, no value, nothing for `CAP_offline_conversions_push` to send, and therefore no Smart Bidding feedback. The WhatsApp bridge's approved claim that completed bookings feed back to Google and Meta was unbacked on our own account for ten days without anyone noticing, and the demo narration ends on exactly that line. It also makes any nurture unmeasurable: bookings arrive with no way to attribute them.

It is also why a demo step gets "skipped". The won-deal step in WhatsApp demo video 2 was not an oversight, it was impossible, because there was no deal on the board to drag.

**How to apply:**

- For any client on the bridge or on a similar intake, read `/opportunities/search?location_id=...` before promising the loop. An empty pipeline with a healthy contacts list is the signature.
- Treat "the contact appeared" as testing one half of the intake. The other half is "a row appeared on the pipeline board in the first stage".
- Check the terminal stage is actually usable too. WMI's last stage is a single "Won/Lost", which is a marking problem as well as a filming problem.
- This is the upstream half of [[prove-offline-conversions-account-side]]: that memory proves the upload matched once something was sent, this one is about whether anything can be sent at all.

Related: [[ghl-native-click-id-capture]], [[whatsapp-nurture-window-shape]].

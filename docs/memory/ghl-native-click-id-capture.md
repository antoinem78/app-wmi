---
name: ghl-native-click-id-capture
description: "GHL captures gclid/wbraid/gbraid natively in attributionSource and has a standard contact.gclid field; the customFields endpoint lists neither, so it is not an absence test"
metadata: 
  node_type: memory
  type: reference
  originSessionId: 937c029c-618f-425f-b854-6e504bd166b1
  modified: 2026-08-16T18:42:14.853Z
---

GoHighLevel already captures the Google click-id family on its own funnels and forms, with no tag, no hidden fields and no build. Verified on the DentalMastery.ai location (`YT3zkRv2oyeo1PSUQqVR`) 2026-08-16 by reading real contact records.

A contact created from a GHL form carries an `attributionSource` (first touch) and `lastAttributionSource` (last touch) object. On a **website form** submission the shape is:

`gclid, wbraid, gbraid, adId, adGroupId, adName, url, referrer, ip, userAgent, gaClientId, gaSessionId, utmSource, utmMedium, utmContent, utmTerm, utmKeyword, utmMatchtype, medium, mediumId, sessionSource`

The shape is **polymorphic by source**. A Facebook lead-form contact instead carries `campaign, campaignId, adSetId, adId, formId, formName, adSource, utm*` and no click-id keys at all, and a social-media contact carries only `medium, mediumId, pSid, postId`. So the absence of a key on one contact says nothing about the location; read a contact from the source you actually care about.

**Why this matters:** `GET /locations/{id}/customFields` lists custom fields only. It does **not** list GHL standard fields and it does not surface `attributionSource`. Reading it and concluding "there is no gclid field" is wrong on both counts, and that is exactly the error the DentalMastery paid-traffic audit made on 2026-08-08. This is [[meta-api-absence-claims]] on a GHL surface.

**How to apply:**

- To test whether a name is a GHL **standard** field, POST it to `/locations/{id}/customFields`. A 400 naming the conflict proves it is standard; anything else creates the field, so only probe names you would be willing to keep. Confirmed standard: `gclid`. Confirmed **not** standard, and creatable as custom: `wbraid`, `gbraid`, `msclkid`, `fbclid`.
- `msclkid` is **not** in the attribution shape, so Microsoft Advertising needs its own capture. Google needs none.
- The landing page is already `attributionSource.url`. Do not build a separate landing-page field before checking. **Exception, verified on the WMI location 2026-08-16:** a contact created from an inbound WhatsApp message carries `{sessionSource: "Social media", url: null, medium: "whatsapp", ctwaClid: null, adName: null, adId: null}`. Every click-id key is absent and `url` is null, because GHL never saw the web session. So the WhatsApp bridge's own `Landing Page` and `Google Click ID` custom fields are load-bearing rather than duplicative, and any client whose leads arrive by WhatsApp needs them.
- For an offline-conversion upload driven by a GHL workflow, prefer a **custom field** as the carrier: `attributionSource` is reliable to read over the contacts API but is not dependable as a workflow merge field. `gclid` is the exception, since the standard field gives you `{{contact.gclid}}` directly.
- Never mirror an attribution key into an empty custom field without a workflow that populates it. Two sources of truth where one is always empty is worse than one, because the next reader finds the empty one.

Applies to every GHL client on the book (KST, VIP, Shallowford, Buggy Trip, DentalMastery). Sibling of [[prove-offline-conversions-account-side]]: read the live system from the side that actually holds the answer.

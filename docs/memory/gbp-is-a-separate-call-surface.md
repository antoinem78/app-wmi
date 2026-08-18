---
name: gbp-is-a-separate-call-surface
description: Website call tracking never sees Google Business Profile calls; the GBP publishes its own number and is usually the larger call source for a local business
metadata: 
  node_type: memory
  type: reference
  originSessionId: 96f371c7-c7fa-431b-9788-76764c8f8bd7
  modified: 2026-08-16T18:03:21.067Z
---

Swapping a client's website to a tracking number captures **website calls only**. The Google Business Profile is an independent surface with its own phone field and its own Call button, and for a local service business (accountant, dentist, trades) the map pack is normally the *larger* call source. Whatever number sits in the GBP is untracked unless it is swapped separately.

Proven at KST 2026-08-16: the site had been swapped to the tracked line since 6 August and had logged zero calls, while the live GBP Call button was still `tel:+442031502074`, the office landline. This was gap 2 of `docs/CALL_TRACKING_NUMBER_MAP.md`, flagged 2026-07-31 as "no API access from here" and left open for two weeks.

**Why:** a call tracking build is sold as "every call is measured". If the GBP still carries the old number that claim is false, and worse, the resulting silence gets misread as a fault in the tracking layer or as low demand. Google Ads location assets can also pull the GBP number into ads, so the leak extends into paid.

**How to apply:**
- Any call tracking runbook step "swap the site number" gets a sibling step **"swap the GBP number"**, plus a check of Google Ads location assets and any directory listings (Yell, Bark, Facebook, industry directories).
- GBP is not readable via our APIs. Check it on the public Maps surface, which also satisfies the standing rule against absence claims from a single API reading. `https://www.google.com/maps/search/<business+name+town>` renders the phone as a `tel:` link.
- Check NAP consistency at the same time: hours and address drift between GBP and the site independently of the phone number.
- GBP ownership is the client's, so this step needs the client and cannot be done from our side. Raise it before promising full call measurement.

Sibling of [[silence-is-not-a-signal-without-traffic]], which is the other half of the same KST diagnosis. Related: [[verify-who-controls-infrastructure]], [[meta-api-absence-claims]], [[kst-is-the-blueprint]].

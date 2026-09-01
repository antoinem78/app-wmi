---
name: ghl-contact-exists-but-index-blind
description: "A GHL contact can exist (fetch by id = 200) while the contact list and search return nothing; verify by id before declaring a contact missing, and remember the UI sits on the index"
metadata:
  type: project
---

2026-09-01, DentalMastery: a Slack lead alert fired, the founder saw no new contact in GHL, and the contact existed the whole time. Fetch by id returned it complete; the location's contact LIST showed nothing newer than four weeks old and a search on the first name returned zero hits. GHL's list and search sit on a search index that had not indexed the row; the UI sits on the same index, so the founder's "no contact" observation was true of the index and false of the database.

**Why:** the wrong conclusion here is expensive in both directions: "the lead was lost" triggers rebuild work on a pipeline that is healthy, and "the founder is mistaken" ignores that smart lists, search and list-driven automations genuinely cannot see the contact while the index lags.

**How to apply:**
1. When an alert names a contact_id, verify by direct fetch (`GET /contacts/{id}`) before concluding anything from lists or search.
2. The direct contact URL (`.../contacts/detail/<id>`) bypasses the index and is the founder's fastest route to a hot lead.
3. Index lag of minutes is normal; hours is a GHL support ticket. Check whether OLDER contacts are also missing from the list, which distinguishes a lagging index from one broken for weeks and masked by low volume.
4. List-driven automation (smart-list enrolment) silently misses unindexed contacts; webhook-driven automation does not. Prefer webhook triggers for anything that must not miss a lead.

Related: [[silence-is-not-a-signal-without-traffic]], [[configured-is-not-rendered]].

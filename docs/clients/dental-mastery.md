# DentalMastery.ai

**Channel file.** Read `docs/PROJECT_STATE.md` §1, §2 and §7 first; this file is owned by the dental-mastery session and is the client's living state. Content below was moved verbatim from PROJECT_STATE §4 on 2026-08-15 during the lead-gen half of the per-client split (pre-split history: commit d71cf65).

---

**DentalMastery.ai** (slug `dental-mastery`, never `dentalmastery`, the wrong slug silently writes zero rows). B2B, sells to US dental practice owners, runs inside the WMI UK ad account because the founder hit his Business Portfolio limit.

Live: a warm-up engagement campaign and a leads campaign using Meta Instant Forms against the Apollo list audience (`Apollo Dental Mega List July 26`, 16,536 contacts uploaded, ~4,300-5,100 matched). Targeting is list-only and verified so: `advantage_audience: 0`, `targeting_relaxation: {custom_audience: 0, lookalike: 0}`. Conversion spine is live and Meta-verified, `Lead` and `Schedule` server-side into dataset 867153482888947 via `CAP_meta_conversions`, GHL workflows firing it, Slack to #dentalmastery-leads. Legal pages published (privacy, terms, cookie settings) with a consent banner gating the pixel.

Open: as at 2026-07-30 the leads campaign had produced no leads on roughly 15 clicks, and the budget reads £15/day rather than the £30 the founder set. The decision point is ~30 cumulative clicks: still zero and the problem is the ask, not delivery. Frequency is already ~2.1 against a small pool, so the list-only experiment has about 7 to 10 clean days before ad blindness contaminates it. Performance goal cannot be changed after publish, so any change of optimisation means a duplicate ad set.

---

## Task 21, paid traffic readiness (Google plus Bing)

Audit: `docs/DMAI_PAID_TRAFFIC_AUDIT.md`, dated 2026-08-08, **corrected 2026-08-16**. Read the correction block before acting on the build order; three of the eight steps changed size.

**Live state re-read 2026-08-16, all from the location (`YT3zkRv2oyeo1PSUQqVR`) and the live site.** Nothing had moved in the eight days since the audit: 6 contacts (most recent 5 August), **0 opportunities**, 7 pipeline stages, 3 forms, 10 workflows of which the same 6 nurture drafts are unpublished. The site still carries no Google or Microsoft measurement of any kind, re-verified on the served HTML (no `gtag`, `GTM-`, `AW-`, `G-`, `dataLayer`, `uetq`, `bat.bing`). The Meta pixel `867153482888947` is still loading.

### What changed in the picture

**The site is a GHL funnel in this same location.** The served HTML is a LeadConnector funnel bundle with every asset under `assets.cdn.filesafe.space/YT3zkRv2oyeo1PSUQqVR/`. Tagging is therefore a GHL settings change by whoever holds UI access, not a developer ticket, and the three forms are GHL forms on GHL pages. That answered audit open questions 2 and 3 outright.

**GHL already captures the Google click id family, natively, with nothing built.** `contact.gclid` is a GHL standard field and always was; every contact carries `attributionSource` and `lastAttributionSource`, and the website form shape includes `gclid`, `wbraid`, `gbraid`, `adId`, `adGroupId`, `adName`, `url`, `referrer`, `ip`, `userAgent`, `gaClientId`, `gaSessionId` and the full utm set. Populated and working today. The audit's "there is no gclid field" was read off the custom fields endpoint, which lists neither standard fields nor the attribution object. Generalises to every GHL client, so it is in shared memory as `ghl-native-click-id-capture`, not here.

**`msclkid` is the only click id genuinely missing.** It is not in the attribution shape. So the entire remaining engineering cost of this project is the Microsoft leg.

### Done

**Step 2, closed 2026-08-16.** Created as custom text fields on the location: `wbraid` (`WYBiB2Q7Sen2tY4NPlUh`), `gbraid` (`9UfOUHMYgyLfpE9aHMcM`), `msclkid` (`hXQiVeHQCJxIkg93J4Ds`). Read back and verified, 19 custom fields now. No `gclid` field created (standard, exists) and no landing page field (it is `attributionSource.url`). A fourth field, `fbclid`, was created only to test whether it was standard, found not to be, and deleted the same minute; it duplicated the existing `contact_meta_click_id` and was never wanted. **`wbraid` and `gbraid` sit empty until step 4 populates them, and must not be read as evidence of anything before then.**

### Blocked on the founder

**Step 1, account creation and billing, is founder-only and blocks steps 3, 5 and 8.** Two settings that are silent killers if missed at creation: **Google auto-tagging ON**, and **Microsoft auto-tagging of msclkid ON**, which is a separate setting on a separate account and Google's being on tells you nothing about it. Build Google properly first, then import the campaigns into Microsoft, which is the standard path and halves the setup. Audit open question 1 is still unanswered: which manager account should Google Ads sit under, and does Microsoft need its own manager structure.

### The risk that is not technical

Zero opportunities have ever entered the pipeline in eight months, and offline conversion upload works by reading stage changes. Built as specified, the whole spine sits idle. The mitigation now written into the audit as step 6a: automate New Lead on form submission and Booked Call off the calendar booking, both machine-observable, which makes the volume signal fully automatic and leaves only Proposal Sent, Signed and Deposit Paid needing a human. **If nobody will move a deal to Proposal Signed, the revenue leg of step 8 should not be built at all** and this becomes a booked-call optimisation build. That is the founder's call and it is the one question worth putting to him first.

### Not verified, flagged rather than assumed

The PIT returns 401 on the funnels scope, so the funnel inventory was inferred from the served HTML rather than listed. Before the tags are called done, confirm from outside that they are on every page, rather than trusting a location-level setting to have applied everywhere.

---

## First live lead, 2026-09-01, and the incident around it

**Written by the platform session at the founder's instruction** (this channel's session should fold it into its own working state).

**The lead:** Azim Tirmizi, Ashar Dentistry, azim@ashardentistry.com, +1 972 838 7009. Solo general dentist, budget band $2k-$5k, timeframe "as soon as possible", growth challenge "new patient flow". Source form `dm_strategy_call_qualifier`, contact created 16:26 UTC. **Every click id field arrived empty** (Meta, msclkid, gbraid, wbraid), consistent with the audit's finding that the site carries no measurement, so the lead is unattributable to any channel.

**The incident:** the Slack alert fired and the founder saw no contact in GHL. The contact existed the whole time: fetch by id returned it complete (`19YFXZ8UmEcndll85gYN`), while the contact LIST, the search and therefore the UI returned nothing, because they all sit on GHL's search index and the index had not picked the row up. Even `meta.total` still said 6 contacts. Verified n8n-side: `RCV_dm_ghl_events` ran green end to end (Slack post, Meta CAPI forward), so the pipeline is healthy and the fault is index-side only. Direct contact URL bypasses the index: `https://app.gohighlevel.com/v2/location/YT3zkRv2oyeo1PSUQqVR/contacts/detail/19YFXZ8UmEcndll85gYN`. Lesson generalised to shared memory (`ghl-contact-exists-but-index-blind`).

**Index watch, CLOSED:** the contact became searchable at 16:50 UTC, 24 minutes after creation. So GHL's contact index can lag new contacts by roughly 20 to 25 minutes, during which the UI, search, smart lists and even the contact total are all blind to a lead that exists. No ticket needed; the ticket text below stays as a template for the day a row genuinely never indexes.

**Nurture state, proven in production by this lead:** all six workflows were still drafts when Azim submitted, so nothing answered him; the founder responded personally. **Publishing cannot be done via API** (PUT and PATCH on `/workflows/{id}` both return 404, probed 2026-09-01), so it is a founder UI action:

1. Open each workflow, **check before publishing**: the trigger (should be form submission or contact created, and must NOT be smart-list enrolment, which the index incident proves can silently miss a lead), the sender identity on every email or SMS step, and every link.
2. Publish at minimum **1. New Lead Nurture (Fast 5)** (`770ae236-731f-40d4-8e97-39131a14bfe9`); the other five in the same pass if their content survives the check.
3. Azim predates the publish, so if Fast 5 should cover him, add him to the workflow manually **from his direct contact URL**, not from a list.

**Support ticket text, if the poller ends unindexed:**

> Location YT3zkRv2oyeo1PSUQqVR. Contact 19YFXZ8UmEcndll85gYN (created 2026-09-01T16:26:02Z via form submission) is retrievable by id but absent from the contacts list, contact search and the contacts UI, and the location's contact total still reads 6 where it should read 7. Older contacts index fine. Please reindex the location or this contact.


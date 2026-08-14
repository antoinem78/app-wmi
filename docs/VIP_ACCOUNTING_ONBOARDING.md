# VIP Accounting: onboarding runbook (blueprint run 1)

**Date opened:** 2026-07-31. **This is the first execution of the KST blueprint against a real second accountancy client.** Everything here should be written with the third client in mind: where this document says "VIP", the next run should only have to change the facts, not the steps.

## 0. The client, verified

| Fact | Value | Source |
|---|---|---|
| Entity | VIP ACCOUNTING LTD, company 15887435, active | Companies House, checked 2026-07-31 |
| Incorporated | 9 August 2024 | Companies House |
| Registered office | 20 Gifford Road, Benfleet, Essex SS7 5XU | Companies House |
| Budget | £1,500/month rising to ~£2,500 around month 3 | client questionnaire |
| Channel | Google Search ONLY initially, deliberate | questionnaire |
| Geography | Essex, open to narrowing on keyword-research advice | questionnaire |
| Offer focus | limited company owners, ongoing relationships, not one-off compliance | questionnaire |
| Priority keyword | "Limited Company Accountant Essex" | questionnaire |
| Negative themes | jobs, careers, training, qualifications, free software, informational | questionnaire |
| Conversions that matter | phone calls and Calendly Zoom bookings | questionnaire |
| Schedule | Mon-Fri 09:00-19:00 initially | questionnaire |
| ICP | established ltd-co owners, £100k+ revenue, usually unhappy with a current accountant | questionnaire |

**Unknowns that block specific steps (§5):** website domain and who controls its DNS; whether a Google Ads account already exists and who holds it; the principal's name (sender identity for nurture); the fee model in their own words. Do not import KST claims like "fixed fees agreed in advance" into VIP copy without confirming they are true for VIP.

## 1. Why clone KST, and what a snapshot does and does not carry

KST's location holds the accountancy-shaped assets: the pipeline, the two OCT stage workflows (Consultation Booked, Engaged/Won), the website-lead notification workflow, and the custom fields including the web-chat set (R6). That is the blueprint content, so KST is the right snapshot source rather than the bare master template.

**A GHL snapshot carries:** workflows, pipelines, custom fields and values, forms, funnels, calendars, tags, email templates.
**It does NOT carry:** the dedicated sending domain, phone numbers, integrations, API keys or PITs, contacts, and it copies workflow webhook payloads VERBATIM, meaning the cloned OCT workflows will still say `"client_slug": "kst"` until rewired. The rewire checklist in §3 exists because of exactly this.

## 2. Founder actions (UI, ~15 minutes, in this order)

1. Agency view, Account Snapshots: **create a snapshot from the KST location**. Name it `Accountancy Blueprint v1 (from KST)`. This is also the snapshot capture the blueprint ruling wanted; it now exists because a real client forced it, which is the right way round.
2. **Create the sub-account** from that snapshot: name `VIP Accounting`, address 20 Gifford Road, Benfleet SS7 5XU, country GB, timezone Europe/London.
3. **Mint a location Private Integration token** for the new sub-account (same scopes as KST's) and add it to `~/.config/singularweb/substrate.env` as `GHL_VIP_PIT=...`. Do not paste it in chat.
4. Tell the session the new location id (visible in the URL when inside the sub-account).

## 3. My actions once the location exists (each verified before the next)

1. **Verify the clone**: read workflows, pipeline, custom fields via the new PIT and diff against KST's set. Anything the snapshot dropped gets named, not assumed.
2. **Rewire the per-client values**: OCT workflow payloads `client_slug` to `vip-accounting`, notification targets, any KST-literal strings (names, phones, emails, URLs) surfaced and listed for replacement. The pipeline stage ids will be NEW ids in the clone; capture them.
3. **Provision the substrate tenant** (founder go before the write): `clients` row `vip-accounting` with `config.ghl_location_id`, `vertical: accountancy`, `stage_id_to_slug` from the captured pipeline ids, `config.agent` adapted from KST's. Slug discipline: `vip-accounting`, hyphenated, lesson of dental-mastery.
4. **Register the OCT legs** in the substrate for the new slug so the cloned workflows' webhooks land as tasks for the right tenant.

## 4. The campaign track (Oscar's lane, runs in parallel)

1. **Google Ads account**: blocked on §5 question 2. If none exists, create under the MCC; if one exists, link it. Either way the account id lands in `onboarding_state` so Oscar's roster resolves it.
2. **Keyword research** for Essex ltd-co accountancy against the £1,500 budget, answering the client's own open question (county-wide vs town-level start). The questionnaire's negative themes seed the negative list; Oscar's discipline (search-terms-cited negatives only) applies after launch.
3. **Conversion tracking, the part that makes this account different**: phone calls plus Calendly.
   - **Calls**: a UK tracking number for the VIP site, forwarding to their real line. Blocked on the Twilio Local bundle (in review, expected ~Tuesday); VIP joins the purchase list as number three behind the WMI outbound pair. UK-only ruling holds; this is a UK client, so it fits.
   - **Calendly**: keep Calendly, do not force a calendar migration during onboarding; a working client flow beats platform purity. Wire Calendly's webhook into the substrate (the `RCV_dm_ghl_events` pattern), upsert the contact into GHL, and fire the OCT task on booking. Migration to GHL calendar is a later conversation if ever.
4. **Campaign build**: Search-only, Essex, Mon-Fri 9-19, the questionnaire's USPs as ad-copy raw material. Everything created paused; founder activates. Target economics to sanity-check with the client: at £1,500 and plausible accountancy CPCs, expect tens of clicks a week, so the plan should promise learning pace honestly rather than lead volume.

## Progress log

**2026-08-01, clone verified and tenant provisioned.**
- Location `2acFC47p3x6Qdoqm7JWN` live, `GHL_VIP_PIT` minted (first paste was the location id, not the token; a PIT starts `pit-`).
- Clone verified against KST: all 3 workflows published, full 8-stage pipeline, all 11 custom fields. VIP stage ids captured in this repo's history and in the pipeline read; pipeline id `0R3fryVBUk2liqLbiC3w`.
- Substrate tenant `vip-accounting` provisioned, id `862f63e8-131c-4f33-90dd-5f31ebf0ee56`, agent config cloned from KST with VIP identity, `enabled: false`, and deliberately EMPTY widget credentials (never clone widget tokens across tenants).
- **Founder rulings since the runbook was written:** MCC access to the client's existing Google Ads account is pending (answers §5 Q2). **Call tracking is CallTrackingMetrics, not GHL-native and not our Twilio**: the VIP tracking number leaves the Twilio purchase queue, and CTM's own Google Ads integration will carry call conversions. Open sub-question: is CTM under VIP's account or a WMI agency account? Decides who owns the number and where the Google Ads link authorises.

**2026-08-01, lead intake LIVE: `RCV_vip_ctm_leads` (n8n `gDLIR2d6Qo92i2lA`).**
One endpoint for both off-platform lead sources, detecting call versus form by payload shape. CTM post-call webhook or a website form POST arrives, the phone is normalised to E.164 UK, the contact is upserted into VIP's GHL (gclid landing in the `google_click_id` custom field when present), a NEW contact gets an opportunity at New Enquiry (repeat callers deliberately do not spawn a second card), and every event is task-logged under `vip-accounting` with operator `lead_ingest` (registered in the substrate operators table, receiver class, following the `commerce_ingest` precedent). Smoke-tested end to end on all four paths (new caller, repeat caller, form payload, junk payload rejected, missing auth 403), persistence verified by independent read-back, and every test artefact deleted from GHL and the substrate afterwards.

- **Webhook URL:** `https://singularweb.app.n8n.cloud/webhook/vip-ctm-lead`, POST, JSON, auth header `x-bernard-key` (value = `BERNARD_DISPATCH_KEY` from the substrate env).
- **CTM configuration:** add a post-call webhook to that URL with the custom header. If CTM's plan tier cannot send custom headers, say so and the auth flips to a URL secret instead.
- **Website forms, when the client's developer is asked:** same URL and shape, BUT mint a separate inbound credential first. The dispatch key is shared master infrastructure and must not be handed to a third-party developer.
- **Known limitation:** whether CTM forwards `gclid` depends on its own tracking configuration; without it, calls still become contacts and opportunities but carry no click attribution.

**2026-08-01, MCC access verified and account read.** Customer id `6719680160`, GBP, Europe/London, auto-tagging ON, NOT a test account. Reality differs from the runbook's assumptions in a good way: Baptiste's campaigns are LIVE, not staged. Essex search spending ~29 GBP/day (404 GBP/14d, 28 clicks, first 2 conversions already recorded); National enabled but zero delivery; Brand 5/day; a previous provider's PMax sits paused. Five conversion actions already exist including Calendly and form website tags, meaning the client site already carries measurement. Three flags handed to Baptiste on his runsheet: National's zero delivery, enabled budgets summing 85/day against the 1,500/month brief, and the CTM double-count decision (AD_CALL and Phone Click are already primary; CTM's integration must demote one or calls count twice). Both artifacts updated and republished to the same URLs. Client checklist now addressed to Kyle (principal's name confirmed; his EMAIL still needed, and it blocks the portal registration because portal clients.contact_email is NOT NULL). Oscar seeded with client and account memories: this is his first fully-onboarded account.

**Remaining founder UI items (workflow editing has no API):**
1. In each of the 3 VIP workflows, open the webhook action and change `client_slug` from `kst` to `vip-accounting`. Until then, VIP events would land on KST's tenant.
2. Check the notification workflow's Slack target while in there (it will still point at KST's channel).
3. Cosmetic but client-visible: rename the 3 workflows and the pipeline to drop the "KST" prefix.

**2026-08-01, portal registration COMPLETE.** Portal client `31ae0486-6123-4b26-9607-72db35689c6d` (Kyle Randall, kylerandall@vipaccounting.co.uk), `onboarding_state` carries customer id 6719680160 as approved, and VIP resolves through Oscar's exact roster query. Section 5 updates from the email's domain: website is **vipaccounting.co.uk**, DNS at **SiteGround** (ns1/ns2.siteground.net, checked per the standing rule before anyone is asked for records). Site title confirms "Accountants in Benfleet, Essex". Notable: the homepage carries **no tel: link and no Calendly link** in its HTML, so the booking flow and phone number likely live behind buttons or on inner pages; the web-developer introduction (client checklist) remains the path for the tracking number and form connection. Follow-up sender identity resolved: Kyle Randall. Remaining from section 5: fee model in VIP's words, Calendly access, office phone number confirmation.

**2026-08-01, OCT leg built end to end (founder-instructed).** Two upload-type conversion actions created in VIP's Google account, both SECONDARY so Baptiste's bidding is untouched until deliberately promoted: `Consultation booked (CRM)` = conversionActions/7705321122 (BOOK_APPOINTMENT), `Client won (CRM)` = 7705321125 (CONVERTED_LEAD), 90-day click window. New n8n receiver `RCV_vip_stage_change` (auAFnxfWrvPXQugn, ACTIVE): a value-swapped clone of the battle-tested KST receiver, carrying VIP's location gate, VIP PIT credential, VIP client uuid, customer 6719680160, the two new action ids, and VIP's google_click_id field id (IT5MFovOVtEtkPXcyMR8, verified during the CTM smoke). **One founder UI step remains: the two VIP GHL stage workflows still POST to the KST webhook path.** Point them at `https://singularweb.app.n8n.cloud/webhook/vip-stage-changed?stage=booked` and `...?stage=won` respectively (the KST receiver's location gate was silently dropping VIP events, so nothing was ever misattributed). Correction recorded: the founder had already done the client_slug rewires; my checklist was stale.

**2026-08-01, nurture adapted:** `~/Documents/VIP_NURTURE_SEQUENCE.md`, complete except [CALENDLY LINK] and Kyle's fee wording (both already on his checklist). Voice sourced from vipaccounting.co.uk's own live copy (scraped to `~/Documents/VIP_SITE_RAW.txt`, also the start of the chat-agent KB: the reusable HMRC tax layer from KST plus VIP site content is the KB plan, ingestion next session).

## 5. Questions for the founder or client (only real blockers)

1. **Website domain**, and `dig NS` before anything DNS-shaped is requested of anyone (standing rule).
2. **Google Ads account**: exists or not; if it exists, access route.
3. **The principal's name** and preferred sender identity (the KST nurture pattern sends as a person, not a brand).
4. **Fee model in VIP's words**, for ad copy and the eventual nurture. Do not inherit KST claims.

## 6. What VIP gets that KST could not, worth noticing

KST's nurture sequence is written but blocked on a booking page that does not exist. **VIP has Calendly, meaning a real booking link exists on day one.** The six-email sequence adapts (same objection structure: hassle, cost, "my accountant is fine"), gets VIP facts substituted per §5, and can actually ship here first. The blueprint's missing limb exists at the second client, which is a better proof run than the original.

## 7. Definition of done for this onboarding

Sub-account live with rewired workflows; substrate tenant provisioned and OCT legs registered; Google Ads account linked with conversion actions receiving call-tracking and Calendly events; campaign built and paused awaiting founder activation; PROJECT_STATE updated at each stage. The snapshot `Accountancy Blueprint v1` stored at agency level is a deliverable in its own right: client three starts from it plus this document.

---

## Kyle's answers, received 2026-08-14. Section 5 is now closed.

**Booking link:** `calendly.com/kylerandall/30min`. No access needed, no seat bought, no migration. The nurture sequence is unblocked and VIP can ship the sequence KST never could.

**Pricing, and he has ruled on what may be public.** Limited-company packages **from £80/month**, most clients **£100-200+/month**, depending on size, transaction volume and scope. One fixed fee covers everything rather than charging per request. Setup or catch-up work **£100-500+**, driven by how far behind the bookkeeping is, transaction count, corrections and outstanding filings; anything materially beyond that is quoted before work starts. **He is happy for starting package pricing to be public and wants the tidy-up fee kept private.**

**Reviews:** his Google Business Profile (VIP Accounting LTD), plus additional reviews that exist only on `vipaccounting.co.uk/reviews`. Those site-only ones cannot be used in Google ad extensions, which take reviews from approved sources, so **moving them onto Google is a free growth action worth asking for**.

**Competitors**, resolved from the share links he sent: **Swan Books Finance** (Essex, similar size) and **Certax Accounting Benfleet and Southend** (bigger). A third, described as "quite a bit bigger", came through as a truncated `google.com/url` and needs resending.

**Assets:** promised for the afternoon of 14 August.

**Phone:** calls go straight to his mobile and he is willing to pick up outside hours. He asked what the alternative would be. See the recommendation below.

### The missed-call recommendation, and why it is not the obvious one

Leaving everything on his mobile works right up to the moment he cannot answer, and then it is **invisible**. That is precisely the KST finding: their office line rang out for two minutes on a Thursday afternoon and nobody knew until the number was measured.

Recommended: tracking number rings his mobile for about 20-25 seconds, then falls back to the CRM rather than to his personal voicemail. A missed call then becomes a record with a notification, so it is a lead to chase rather than a voicemail he may or may not play. Automatic text-back is not available, because UK geographic numbers on our Twilio are voice-only and texting from the 07 would show an unfamiliar mobile.

Since his ads run Monday to Friday 9am to 7pm, out-of-hours volume should be small either way.

### The number nobody has asked for, and the case rests on it

Live account data over thirty days: **£521.20 spend, 32 clicks, 713 impressions**, which is **£16.29 per click**. Normal for this niche and unforgiving of a weak funnel.

At £150/month average, a client is worth £1,800 a year. Whether £16 clicks are viable therefore depends almost entirely on **how long a client stays**, and that number has never been asked for. Accountancy retention is usually measured in years, which is very likely what makes this account work, but it should be a known figure rather than an assumption before the budget rises to £2,500.

### One recommendation against his own ruling

He has approved publishing the £80 starting price. **I would advertise the £100-200 range instead, or nothing.**

His own stated ICP is an established limited-company owner turning over £100k+ who already has an accountant and is unhappy with the service. **That person is not shopping on price.** At £16 a click the goal is fewer, better-qualified clicks, and "from £80" buys exactly the price-sensitive micro-company he said he does not want. The starting price is true and it is the wrong end of the range to lead with.


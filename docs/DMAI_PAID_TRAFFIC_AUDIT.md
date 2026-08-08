# DentalMastery.ai: paid traffic readiness audit

**Date:** 2026-08-08. **Task 21.** Read from the live location (`YT3zkRv2oyeo1PSUQqVR`) and the live website, not from notes.

## The finding that decides the sequence

**dentalmastery.ai carries no Google measurement of any kind.** Verified twice, because a single reading is not enough to claim absence: the served HTML has no `gtag`, no `GTM-`, no `AW-` and no `gclid` handling, and a real browser session confirms `gtag` undefined, `dataLayer` absent, `google_tag_manager` undefined. The only tag on the page is the Meta pixel, `867153482888947`, which is loading correctly.

So offline conversion tracking cannot be built yet. It has nothing to attach to. There is no click id arriving, nowhere to store one, and no conversion action to send one back to. **This is a build-the-foundation job, not a wiring job**, and any plan that starts at the OCT step will stall on day one.

## What the CRM actually holds

| | |
|---|---|
| Contacts | **6**, over eight months |
| Opportunities | **0** |
| Pipeline | 7 stages, well designed, never used |
| Calendar | 1, active |
| Forms | 3 |
| Workflows | 10, of which **6 are still drafts** |

The pipeline is the striking one. Seven stages from New Lead to Deposit Paid, and not one opportunity has ever entered it. That means there is no conversion history in the system, so even once tagging exists there is nothing to import as a starting signal. Smart Bidding would begin from zero.

The six draft workflows are the entire nurture spine: Fast 5 on new lead, appointment confirmation and reminders, no show, review request, long term nurture, stale leads. Everything published is plumbing (alerts and intake), not follow up. **A paid click that lands here today gets no automated response at all.**

Of the six contacts, two have no source recorded, two came from Facebook, two from the website form. The most recent is 5 August.

## Custom fields: Meta is ready, Google is not

Sixteen fields exist, including a good qualifier set (practice type, practice size, budget band, timeframe, growth challenge, ICP band, lead score). Attribution fields present: `contact_meta_click_id` and `contact_meta_browser_id`.

**There is no gclid field, and no wbraid or gbraid field.** Those are the ones Google needs. This is the cheapest gap on the list to close and it blocks everything downstream, so it goes first.

## The build, in dependency order

Nothing here can be reordered. Each step is dead without the one above it.

**1. Confirm the Google Ads account and its state.** Whether one exists, whether it is linked to a manager account we control, and critically whether **auto-tagging is on**. Without auto-tagging there is no gclid on the landing URL and every later step is decoration. This is a read, and it is the first thing to do.

**2. Add the click id fields to the CRM.** `gclid`, plus `wbraid` and `gbraid` for the iOS app and web-to-app paths, plus a landing page field. Mirrors what already exists for Meta.

**3. Tag the site.** Google tag on every page, and capture the click id from the URL into a first party store so it survives the visitor browsing before converting. The pattern is the one already proven on the WhatsApp bridge: capture server side at the moment of intent rather than trusting anything to persist in the browser.

**4. Make the forms carry it.** All three forms need hidden fields populated from that store, so the click id lands on the contact record at submission.

**5. Create the conversion actions in Google Ads.** At minimum: booked call, and signed proposal. Booked call is the volume signal; signed proposal is the one worth optimising toward, and it is where the revenue actually is.

**6. Start using the pipeline.** This is not a technical step and it is the one most likely to be skipped. Offline conversion upload works by reading deal stage changes. If nobody moves deals through stages, nothing is ever uploaded and the whole build sits idle. **Zero opportunities in eight months is the risk here, not the code.**

**7. Publish the nurture workflows.** Six drafts, already written. A B2B funnel with a Fast 5 response is a different business from one where a paid enquiry waits for someone to notice it.

**8. Then, and only then, the offline conversion upload.** Deal reaches Booked Call, upload the booked-call conversion with its click id. Deal reaches Proposal Signed, upload that one with the deal value. This is the same spine already running for other clients, so it is a clone rather than a new build.

## What I would say to the client

The honest version: the Meta side is instrumented and the Google side has never been built. That is not a criticism of anyone, it is simply where the account is. The work is a week of foundation, most of it one-off, after which every pound of Google spend becomes measurable against signed proposals rather than form fills.

The uncomfortable part worth saying out loud rather than discovering later: **six contacts and zero opportunities in eight months means the funnel has not been under real load.** Building measurement for traffic that does not yet exist is the right order, but expectations should be set on the traffic, not on the tracking.

## Open questions before I build

1. Does a Google Ads account exist for DentalMastery, and under which manager account?
2. Who can edit dentalmastery.ai, and is a site change one line or a ticket?
3. Are the three forms embedded on the main site or on hosted funnel pages? The tagging step differs, and hosted pages need checking separately rather than assumed.
4. Is anyone committed to working the pipeline? If not, step 8 should not be built yet.

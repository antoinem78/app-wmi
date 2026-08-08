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

**Update 2026-08-08, founder: no ad account exists yet, and the plan is Google and Bing.** That changes step 1 from a read into a build, and it adds a second click id everywhere. It is also the best news in this document, because nothing has to be undone. Accounts set up wrong are far more expensive than accounts not set up at all, and every default that usually has to be fixed retrospectively can simply be correct from the first day.

**1. Create the two accounts. Founder only.** Account creation and billing are yours; I cannot do either. Google Ads under the manager account we control, and Microsoft Advertising alongside it. Two settings to get right at creation, both of which are silent killers later:

- **Google: auto-tagging ON.** Without it there is no gclid on the landing URL and everything below is decoration.
- **Microsoft: auto-tagging of msclkid ON.** Same role, separate setting, separate account, easy to miss because Google's being on tells you nothing about Microsoft's.

Worth knowing before you build twice: **Microsoft Advertising imports campaigns from Google Ads.** Build Google properly first, then import. That is the standard path and it halves the setup.

**2. Add the click id fields to the CRM.** `gclid`, `wbraid` and `gbraid` for Google's app and web-to-app paths, **`msclkid` for Microsoft**, plus a landing page field. Mirrors what already exists for Meta.

**3. Tag the site.** Google tag and **Microsoft UET tag** on every page, and capture whichever click id is present in the URL into a first party store so it survives the visitor browsing before converting. The pattern is the one already proven on the WhatsApp bridge: capture at the moment of intent rather than trusting anything to persist in the browser. The UET tag is not optional if offline conversions matter, because Microsoft attributes offline conversions against UET data rather than the click id alone.

**4. Make the forms carry it.** All three forms need hidden fields populated from that store, so whichever click id applies lands on the contact record at submission. One set of hidden fields covers both networks.

**5. Create the conversion actions, in both.** At minimum: booked call, and signed proposal. Booked call is the volume signal; signed proposal is the one worth optimising toward, and it is where the revenue actually is. In each platform the signed-proposal action must be created as an **offline** conversion, otherwise the upload has nothing to land in.

**5b. Do not start on Smart Bidding.** A brand new account has zero conversion history, and value-based bidding on no data bids badly and expensively. Start on manual or maximise clicks, let real conversions accumulate, and switch when there are enough. Switching later is easy; recovering from a fortnight of bad automated bidding is not.

**6. Start using the pipeline.** This is not a technical step and it is the one most likely to be skipped. Offline conversion upload works by reading deal stage changes. If nobody moves deals through stages, nothing is ever uploaded and the whole build sits idle. **Zero opportunities in eight months is the risk here, not the code.**

**7. Publish the nurture workflows.** Six drafts, already written. A B2B funnel with a Fast 5 response is a different business from one where a paid enquiry waits for someone to notice it.

**8. Then, and only then, the offline conversion upload.** Deal reaches Booked Call, upload the booked-call conversion with its click id. Deal reaches Proposal Signed, upload that one with the deal value. The Google leg is the same spine already running for other clients, so it is a clone rather than a new build. **The Microsoft leg is new to us** and will need its own upload path built and proven; I will read the current Microsoft Advertising API surface before writing any of it rather than working from recall.

## Open question about Bing

Bing is cheap and usually converts well for professional services, so including it is defensible. But it is a second account, a second tag, a second conversion setup and a second upload path to maintain, for a share of search volume that is a fraction of Google's.

**My recommendation is to build Google end to end first and prove one signed proposal flows back into it, then import the campaigns into Microsoft.** Building both in parallel doubles the surface area at exactly the moment nothing is yet proven, and if something is wired wrong you will be debugging two systems instead of one. The import path means nothing is lost by waiting.

## What I would say to the client

The honest version: the Meta side is instrumented and the Google side has never been built. That is not a criticism of anyone, it is simply where the account is. The work is a week of foundation, most of it one-off, after which every pound of Google spend becomes measurable against signed proposals rather than form fills.

The uncomfortable part worth saying out loud rather than discovering later: **six contacts and zero opportunities in eight months means the funnel has not been under real load.** Building measurement for traffic that does not yet exist is the right order, but expectations should be set on the traffic, not on the tracking.

## Open questions before I build

1. ~~Does a Google Ads account exist~~ Answered 2026-08-08: no account exists, and the plan is Google plus Bing. Creation is founder-only. Which manager account should Google Ads sit under, and does Microsoft Advertising need its own manager structure or a single account?
2. Who can edit dentalmastery.ai, and is a site change one line or a ticket?
3. Are the three forms embedded on the main site or on hosted funnel pages? The tagging step differs, and hosted pages need checking separately rather than assumed.
4. Is anyone committed to working the pipeline? If not, step 8 should not be built yet.

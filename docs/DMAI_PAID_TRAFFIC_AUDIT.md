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

> **CORRECTION 2026-08-16. The paragraph above is wrong, and steps 2, 3 and 4 below shrink because of it.** It was written from the custom fields endpoint, which lists custom fields only: it shows neither GHL standard fields nor the attribution object. Read from real contact records instead, the position is:
>
> - `contact.gclid` is a GHL **standard** field. It already exists and always did.
> - Every contact carries `attributionSource` (first touch) and `lastAttributionSource` (last touch). On a website form submission that object already includes `gclid`, `wbraid`, `gbraid`, `adId`, `adGroupId`, `adName`, `url`, `referrer`, `ip`, `userAgent`, `gaClientId`, `gaSessionId` and the full utm set. It is populated and working today: the two website form contacts carry live `url`, `referrer`, `ip` and `userAgent`. The click id keys are null on those two only because both visits were organic and direct, which is the correct value for a visit with no click id.
> - So **the Google click id family needs no capture build at all.** GHL does it natively on its own funnels and forms.
> - `msclkid` is genuinely absent from that shape. Microsoft is the only network that needs capture built.
> - The landing page is already `attributionSource.url`. No separate field needed.
>
> The shape is polymorphic by source, so a Facebook lead form contact carries campaign and form ids and no click id keys whatsoever. Never read one contact and generalise.

## The build, in dependency order

Nothing here can be reordered. Each step is dead without the one above it.

**Update 2026-08-08, founder: no ad account exists yet, and the plan is Google and Bing.** That changes step 1 from a read into a build, and it adds a second click id everywhere. It is also the best news in this document, because nothing has to be undone. Accounts set up wrong are far more expensive than accounts not set up at all, and every default that usually has to be fixed retrospectively can simply be correct from the first day.

**1. Create the two accounts. Founder only.** Account creation and billing are yours; I cannot do either. Google Ads under the manager account we control, and Microsoft Advertising alongside it. Two settings to get right at creation, both of which are silent killers later:

- **Google: auto-tagging ON.** Without it there is no gclid on the landing URL and everything below is decoration.
- **Microsoft: auto-tagging of msclkid ON.** Same role, separate setting, separate account, easy to miss because Google's being on tells you nothing about Microsoft's.

Worth knowing before you build twice: **Microsoft Advertising imports campaigns from Google Ads.** Build Google properly first, then import. That is the standard path and it halves the setup.

**2. Add the click id fields to the CRM. DONE 2026-08-16, and smaller than written.** Per the correction above, `gclid` already existed as a standard field and the Google family is captured natively. Created as custom text fields: `wbraid` (`WYBiB2Q7Sen2tY4NPlUh`), `gbraid` (`9UfOUHMYgyLfpE9aHMcM`), `msclkid` (`hXQiVeHQCJxIkg93J4Ds`). No landing page field, because `attributionSource.url` already carries it. Location now holds 19 custom fields, read back and verified. `wbraid` and `gbraid` are duplicated against the native attribution deliberately, as workflow-readable carriers for the upload leg, and they stay empty until step 4 populates them: **do not read them as evidence of anything before then.**

**3. Tag the site. Smaller than written, and it is not a developer job.** dentalmastery.ai is itself a GHL funnel served out of this same location: the served HTML is a LeadConnector funnel bundle and every asset resolves under `assets.cdn.filesafe.space/YT3zkRv2oyeo1PSUQqVR/`. So the tags go in as a settings change by whoever holds GHL UI access, not as a site ticket. **The click id capture half of this step is already done by GHL** and only Microsoft needs anything built. What is genuinely missing is the tags themselves: the Google tag and the **Microsoft UET tag** on every page. The UET tag is not optional if offline conversions matter, because Microsoft attributes offline conversions against UET data rather than the click id alone. One caveat, unverified: the funnel is one property among possibly several, and the location's other pages have not been checked page by page, so confirm the tag is on every page from outside rather than trusting a location-level setting to have applied everywhere.

**4. Make the forms carry it. Microsoft only.** The three forms (`dm_strategy_call_qualifier`, `Website Form`, `Marketing Form - Claim Offer`) are GHL forms in this same location, so they inherit the native attribution and need nothing for Google. They need a hidden field bound to `msclkid` populated from the URL, and, if the upload leg turns out to need them as merge fields, `wbraid` and `gbraid` alongside it.

**5. Create the conversion actions, in both.** At minimum: booked call, and signed proposal. Booked call is the volume signal; signed proposal is the one worth optimising toward, and it is where the revenue actually is. In each platform the signed-proposal action must be created as an **offline** conversion, otherwise the upload has nothing to land in.

**5b. Do not start on Smart Bidding.** A brand new account has zero conversion history, and value-based bidding on no data bids badly and expensively. Start on manual or maximise clicks, let real conversions accumulate, and switch when there are enough. Switching later is easy; recovering from a fortnight of bad automated bidding is not.

**6. Start using the pipeline.** This is not a technical step and it is the one most likely to be skipped. Offline conversion upload works by reading deal stage changes. If nobody moves deals through stages, nothing is ever uploaded and the whole build sits idle. **Zero opportunities in eight months is the risk here, not the code.** Still true on 2026-08-16: re-read today, still 0 opportunities, still 7 stages (New Lead, Hot Lead, Booked Call, Call Completed, Proposal Sent, Proposal Signed, Deposit Paid), still 6 contacts, most recent 5 August.

**6a. Automate the first three stages so the volume signal does not depend on anybody's discipline.** This is the mitigation the step above is missing. A workflow can create the opportunity at New Lead on form submission and move it to Booked Call off the calendar booking, both of which are machine-observable events. That makes the booked-call conversion, which is the volume signal Smart Bidding actually needs, fully automatic. Only Proposal Sent, Proposal Signed and Deposit Paid need a human, and those are low-frequency and high-value enough that one person can hold them. It converts "the whole build sits idle" into "the revenue signal needs discipline", which is a much smaller ask and a far more likely one to survive contact with a real week.

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
2. ~~Who can edit dentalmastery.ai, and is a site change one line or a ticket?~~ **Answered 2026-08-16: the site is a GHL funnel in this location.** Anyone with GHL UI access can add the tags; it is a settings change, not a ticket, and no developer is involved.
3. ~~Are the three forms embedded on the main site or on hosted funnel pages?~~ **Answered 2026-08-16: GHL forms on GHL funnel pages, same location.** They inherit native attribution, which is why step 4 collapsed to Microsoft only.
4. **Is anyone committed to working the pipeline?** Still open, and it is now the blocking question rather than one of four. Step 6a removes most of its force by automating New Lead and Booked Call, but Proposal Signed is the action worth optimising toward and no automation can infer it. **If nobody will move a deal to Proposal Signed, step 8's revenue leg should not be built**, and the honest version of this build is booked-call optimisation only.
5. **New, and it decides how much gets built at all: is Bing still in?** The recommendation below is Google first. Since it was written, the position hardened: Google needs no capture build, and Microsoft needs a custom field, a hidden form field, a UET tag and an upload path we have never built. The whole remaining engineering cost of this project is now the Microsoft leg. That is worth saying plainly before it is paid.

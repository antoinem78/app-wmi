# Buggy Trip Marrakech: how we actually implement this

**Date:** 2026-08-07
**Builds on:** the Cowork groundwork document, whose site audit stands and is used throughout
**Governed by:** the WhatsApp bridge claims register (2026-08-06). No banned claim appears here.

## What changes versus the Cowork plan, and why

Three things, all of them because the bridge now exists and has been proven in production rather than designed on paper.

**1. No new widget needs writing.** The Cowork plan proposes building `whatsapp-gclid-widget.html`. We already run one: deployed, embedded on wmiltd.com, and tested end to end on 6 August, click to CRM in thirteen seconds. Buggy Trip's install is one script tag with their own token, not a bespoke build. That removes a whole workstream and, more importantly, removes the risk of a second codebase to maintain per client.

**2. The reference code alone will not survive, and this client already knows it.** The Cowork plan appends a visible `[Ref: BTM-...]` to the prefilled message and asks staff to match it manually. That is precisely the mechanism this client reported failing: their users delete the prefilled text before sending. Worth stating plainly, because we tested it: an invisible version does not work either, since WhatsApp strips zero-width characters. What our bridge adds is the **server-side click park**, recorded before the visitor leaves the site, so attribution no longer depends on anything surviving inside the message.

**3. No Zapier or Make layer.** The Cowork plan routes the webhook through Zapier into an unspecified CRM. We provision them a CRM sub-account on our own stack and clone the receiver we already run. Fewer moving parts, no per-zap cost, and the offline conversion leg is the same one already live for two other clients.

## The decision that gates everything: which WhatsApp number

This is the question to put to the client first, because the answer changes the scope, the price and what we can promise.

Their number **+212 707 01 44 44 is on the WhatsApp app today**. Automatic lead creation requires inbound messages to reach our system, which means the number must run on the WhatsApp Business Platform, and **a number cannot be on both the phone app and the platform**. So there are three honest options:

**Option A: a new number for website enquiries.** The website widget points at a new number connected to our stack; the existing number stays on their phones for repeat customers, walk-ins and the printed material. Everything is automatic: lead created, source attached, no staff discipline required. This mirrors what we do with call tracking, where the measured channel gets its own number. Downside: two numbers to live with, and the new one carries no chat history.

**Option B: migrate their existing number.** Full automation on the number they already advertise everywhere. Downside is real and operational: the team stops replying from the WhatsApp app on their phones and replies from the CRM instead. For a business whose staff are out in the desert, that is a significant change and should not be waved through.

**Option C: no inbound integration at all.** Keep everything exactly as it is. We still capture the click server-side and still create the lead with its source, but matching the lead to the conversation relies on the visible reference code and staff noticing it. Cheapest, least invasive, and least reliable, since it depends on the very behaviour the client says fails.

**My recommendation is A**, with B as a later migration if they find they prefer replying from one inbox.

## Phased plan

### Phase 0: decisions and access, before any build

- The number decision above.
- **Google Ads access is an internal step, not a client ask.** The account is already managed under Baptiste's MCC. Route: send a manager link request from the SingularWeb MCC (which sits under WMI UK MCC), which the client approves, giving both managers access. Simpler still, ask Baptiste to link it directly and avoid bothering the client at all. Either way the client-facing ask drops to "approve a request if you see one".
- **Confirm auto-tagging is ON**, which Baptiste can check today without waiting for anything. Without it there is no gclid and none of this has data to capture. Cowork is right about this, and it is the one prerequisite that silently invalidates everything else.
- Confirm whether they run **Meta ads** as well, since the same capture handles fbclid at no extra cost.
- Agree who owns the site edit. It is one line in the Astro layout, but somebody needs repository or hosting access.

### Phase 1: provision, our side, roughly an hour

- CRM sub-account for Buggy Trip on our stack, from the accountancy blueprint pattern adapted for a lead-gen tourism client: an enquiry pipeline with stages that end in a confirmed booking.
- Tenant row plus a public widget token.
- Clone the inbound receiver and point it at their location, exactly as we did for ours.
- Custom fields for gclid, fbclid, landing page and reference code.

### Phase 2: site install, one line

```html
<script src="https://app.wmiltd.com/wa-widget.js" defer
  data-number="THEIR_NUMBER"
  data-token="THEIR_TOKEN"
  data-greeting="Salut! Dites-nous ce que vous cherchez et nous répondons vite."
  data-cta="Réserver sur WhatsApp"
  data-color="#THEIR_BRAND"
></script>
```

Placed before `</body>` in `src/layouts/Layout.astro`. The site is French-first with English, Spanish and Dutch, so the greeting and button label should be set per language if their layout allows it, or French as the default if not.

Also in this phase, and worth doing because they have nothing today: install **GTM and GA4**. Cowork is right that this is a clean slate and it is cheaper to do now than later.

### Phase 3: the two conversions

Keep the Cowork two-conversion structure, which is sound:

- **WhatsApp enquiry**, fired on the widget click. High volume, immediate, useful for early bidding signal while booking data accumulates. Import as a secondary conversion action so it informs but does not dominate.
- **Confirmed booking**, uploaded as an offline conversion when staff mark the deal won, carrying the stored gclid, the timestamp and the booking value. This is the one Smart Bidding should optimise toward, and it is the same offline conversion spine already running for two of our clients.

The value matters here: their packages range from 400 to 2,500 dirhams, a sixfold spread. Uploading real values rather than a flat number is what lets Google learn that a Can-Am booking is worth more than a quad hour.

### Phase 4: prove it before claiming it

One live test with a tagged URL, exactly as we ran on our own site: click an ad-tagged link, use the widget, send the message, confirm the lead arrives with the gclid attached. Then one end-to-end rehearsal of the booking path: mark a test deal won, confirm the offline conversion reaches Google Ads.

## What we tell the client, and what we do not

Approved, and all of it true:

- The click is captured server-side before the visitor leaves the site.
- Every enquiry becomes a CRM lead automatically, with its source attached.
- Each lead is labelled with how it was attributed, so coverage is a number they can see rather than a promise.
- Where the match is ambiguous, the system records the lead as source unknown rather than guessing, because they will make budget decisions on this.
- Confirmed bookings feed back to Google and Meta, so the platforms optimise toward real revenue rather than clicks.

**Mandatory caveat, in the proposal and in the pitch:** accuracy depends on how many enquiries arrive at once. For a business with a normal flow of enquiries it attributes nearly everything; during a burst of simultaneous visitors, some leads will be recorded as source unknown.

Not to be said, per the claims register: nothing about codes that cannot be deleted, nothing about invisible tracking, no accuracy percentage, and no suggestion that we can attribute someone who messages the saved number directly without visiting the site.

## GDPR

Cowork raises this correctly, and it matters more for them than for a UK client, since their traffic is largely EU tourists. One nuance: our widget uses `localStorage` rather than a cookie, which does not change the legal analysis much, since it is still storage on the user's device for a non-essential purpose. A consent banner is the right call, and the widget can hold off storing until consent is given, at the cost of losing attribution for visitors who decline.

## Open questions for the client

1. Which WhatsApp number strategy, A, B or C.
2. Do they have Google Ads running today, and can we have access.
3. Do they run Meta ads.
4. Who can edit the site, and are they comfortable with us sending a one-line change.
5. Brand colour for the button, and whether they want the widget in French only or per language.

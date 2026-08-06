# WhatsApp attribution bridge: correction, and the plain-English version

**Date:** 2026-08-06, tested in production tonight
**Corrects:** the invisible-ref claim in the Baptiste technical brief and in the Code-to-Chat brief
**Everything else in those documents stands.**

---

# Part 1: the correction (for Baptiste and for Chat)

## What I claimed

That the tracking code rides **invisibly** inside the visitor's own message, encoded as zero-width characters, so there is nothing visible for a user to delete. I presented this as the thing that beats the classic wa.me failure, the one Buggy Trip already hit, where users strip the prefilled tracking text before sending.

## What the test showed

**WhatsApp strips zero-width characters.** Clean production test on wmiltd.com: the prefill was sent completely unedited, and the message arrived with the visible sentence and **zero** invisible characters.

The failure is not ours. The widget builds the link correctly, verified in the browser: 32 zero-width characters, properly percent-encoded, present in the `wa.me` URL at the moment of the click. WhatsApp normalises them away somewhere between the link and the delivered message.

## What actually carries the attribution

The **server-side click park plus a single-candidate time window**, and it worked first time in production:

1. When a visitor opens the widget, the click ids (gclid, fbclid, UTMs, referrer, landing page) are sent to our server and stored under a short code. This happens **before** the visitor leaves the site, so it cannot be lost by anything WhatsApp does.
2. When a message arrives, the receiver looks for **exactly one** unclaimed click for that client in the last 30 minutes. One candidate, it attributes. Several candidates, it **refuses to guess** and marks the lead unattributed.
3. Every lead records how it was attributed: `exact` (a ref survived), `window` (matched by time), or none. Coverage is therefore a measured number, not a claim.

Tonight's live result: `gclid: CLEAN_TEST_789` on the contact, matched by `window`, thirteen seconds from click to CRM.

The refusal behaviour is not theoretical. My own repeated test clicks left several unclaimed clicks in the window, and the system correctly declined to attribute rather than pick one. That is the design working.

## What this changes commercially

- **Do not sell "a code they cannot delete" on WhatsApp.** It is not true.
- **Do sell** that the click is captured server-side before the visitor leaves, that the CRM lead is created automatically, and that completed bookings feed back to Google and Meta. None of that depends on message text.
- **Accuracy is volume-dependent, and say so.** For a business with a handful of simultaneous visitors, the window attributes essentially everything. As concurrency rises, more leads land unattributed. It degrades into "unknown", never into "wrong", which is the correct direction for something a client makes budget decisions on.
- **The visible ref remains available** (`data-visible-ref="true"`) for clients who want maximum coverage and accept that some users delete it. That is a per-client choice, not a default.

## Honest residual risks

- Two visitors clicking within the same 30 minutes both go unattributed.
- Someone who saves the number and messages days later is unattributed.
- Anyone arriving via a wa.me link elsewhere (TripAdvisor, Google Business Profile) was never in scope.
- The window length (30 minutes) is a guess that should be tuned per client once real volume exists.

---

# Part 2: the plain-English version (for anyone, including clients)

## The problem

When someone clicks a WhatsApp button on your website, they leave your site and land in WhatsApp. Everything you knew about them, which advert brought them, which search they came from, is left behind on the website. So you get a message from a phone number and no idea where it came from.

That is why almost nobody can tell you which adverts actually produce WhatsApp enquiries. They guess.

## What we built

**We take a note before they leave.**

The moment someone taps the WhatsApp button, we quietly write down where they came from and store it on our server: which advert, which campaign, what page they were on. That note is saved **while they are still on your website**, so nothing that happens afterwards can lose it.

Seconds later their message arrives. We match the message to the note, and now the enquiry has a source attached to it. It goes into your CRM automatically as a proper lead, with a name, a number, and where it came from.

When that enquiry turns into a booking, we tell Google and Facebook which advert produced it. That is the part that compounds: the platforms stop chasing clicks and start finding more people who actually book.

## How the matching works, honestly

If one person tapped the button in the last half hour, and one message arrives, they are the same person. That is the match, and it is right essentially every time for a business with a normal flow of enquiries.

If several people tapped in the same short window, we **do not guess**. Those enquiries are recorded as "source unknown" rather than being assigned to the wrong advert. We would rather tell you we do not know than tell you something false, because you spend money on the basis of these numbers.

Every lead is labelled with how it was matched, so you can see your own coverage rather than taking our word for it.

## What it does not do

- It does not read your WhatsApp conversations for marketing purposes. It captures the enquiry and its source.
- It does not track people who message you directly without visiting your website, because there is nothing to link them to.
- It is not perfect at high volume. It is honest at high volume, which is different and better.

## What you get

- Every WhatsApp enquiry becomes a lead in one place, with a source.
- You find out which adverts produce real conversations, not just clicks.
- Bookings feed back to the advertising platforms, so your budget gets smarter every week.
- Nothing changes about how you or your team reply. You use WhatsApp exactly as you do now.

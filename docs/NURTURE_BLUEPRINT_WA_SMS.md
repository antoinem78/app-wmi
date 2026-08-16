# Nurture blueprint: WhatsApp and SMS

**2026-08-16, wmi-website session.** Built on wmiltd.com first so the mistakes happen on our own number, then cloned. Part 1 is the reusable part and should be read before any client build. Part 2 is the WMI instance. Part 4 is what you change per client.

**Status: designed and specified, not built.** Workflow creation has no API, so the GHL build is a founder job. Two blockers are named in Part 3 and one of them is hard.

---

## Part 1: the five rules that govern the design

### 1. One channel per contact, chosen by where they came from

A contact has one phone number and WhatsApp and SMS both land on it. Running two sequences at once reads as spam from the same sender and earns a STOP that kills both.

- Arrived by WhatsApp: nurtured on WhatsApp. SMS only if WhatsApp delivery fails.
- Arrived by web form or by phone: nurtured on SMS. WhatsApp only if they have messaged first, because otherwise it takes a marketing template sent to somebody who never opened a conversation, which is the worst possible use of a template.

Enforce it with mutually exclusive tags, not with good intentions: `nurture-wa` and `nurture-sms`, and each workflow's first step removes the other tag.

### 2. WhatsApp is not email, and the 24-hour window sets the shape

Inside 24 hours of the contact's last inbound message you can send free-form messages, and the first 1,000 service conversations a month are free. Outside it you can send nothing but a pre-approved template, and a marketing template is billed on every delivery whether or not anyone reads it.

Three consequences, and they are not stylistic:

- **Front-load.** Everything you can say in the first 24 hours, say in the first 24 hours. After that you get two or three expensive knocks, not a drip.
- **Check the window every single step.** GHL has an action for exactly this, `WhatsApp: Customer Service Window Check`, which branches **Open** and **Closed**. Open takes the WhatsApp action with template `None - Free form message`. Closed takes an approved template. Never assume which side you are on: the contact may have replied to a human in between.
- **Template knocks have a hard ceiling of three, and two is better.** Templates that get ignored, blocked or reported drop the WABA quality rating, and a dropped rating lowers the messaging limit on the number. The cost of over-sending is not the 3.8p, it is the number.

### 3. Consent, and the thing that was missing

PECR governs marketing by SMS, and the prudent position is that it governs WhatsApp marketing templates too. Consent is not needed if the soft opt-in applies, and the soft opt-in has four conditions:

1. The details were obtained in the course of a sale or negotiations for a sale. An enquiry asking about the service counts. Browsing does not.
2. The marketing is for similar products and services.
3. **The person was given a chance to refuse at the point their details were collected.**
4. Every subsequent message gives them a way to opt out.

Conditions 1, 2 and 4 are easy. Condition 3 is the one that gets missed, because it lives on the collection surface and nobody thinks of the collection surface as part of the nurture. On 2026-08-16 neither of our two collection surfaces met it: the WhatsApp widget card said nothing, and the free audit form said nothing. **The consent line on the collection surface is part of this build, not a preamble to it.** The widget half is done, on branch `wa-widget-landing-fix`, defaulting on.

Answering a question someone asked you is service and is not caught by any of this. Nudging someone who went quiet is marketing and is. The line falls between step 1 and step 3 of every sequence below, and it is worth knowing where it falls before an argument about it.

### 4. An automated message never claims a human action that did not happen

No "I had a look at your website", no "I was just thinking about your account", in anything sent by a workflow. It is the fastest way to turn a warm lead cold, because the moment they ask a follow-up question about the thing you claimed to have looked at, the bluff is called. Automated messages can be warm, specific and in the first person. They cannot be a lie about attention that was not paid.

### 5. A reply stops everything, immediately

On WhatsApp this is not a nicety. A reply reopens the 24-hour window, and the next scheduled step will cheerfully fire a template into the middle of a live human conversation. Every sequence exits on: any inbound message, a booking made, the opportunity moving past the first stage, DND or opt-out, and a manual `nurture-stop` tag.

---

## Part 2: the WMI build

### What is there today, read 2026-08-16

- Location `nyLMzwmEYXnB3MAxFD7K`, timezone Europe/London, duplicate contacts off, contacts unique on email and phone.
- Numbers on the location: `+447476925643` (WhatsApp and SMS), `+442045383367` (outbound voice), `+442046529670` (KST call tracking, which looks misfiled here and is worth a look), `+16466933390`.
- Pipeline "New Business": New Lead, Audit Booked, Audit deiivered, Proposal, Won/Lost. The typo is in the live stage name.
- Tags already in use: `free-audit`, `whatsapp`, `wa-attributed`, `wa-attributed-window`, `wa-organic`, `warm lead`, `web form`.
- Three published workflows: "Confirm enquiry received", "Whatsapp automation", and one whose live name contains an em dash ("New WMI UK Lead", then an em dash, then "Internal Alert"), quoted here only so it can be found and worth renaming while you are in there.
- The location holds exactly one WhatsApp conversation, one inbound message, and **no outbound reply of any kind**. So nothing answered it. Before building, open "Whatsapp automation" in the UI and confirm it contains only the webhook step, because workflow internals are not readable through the API and a second auto-reply would double-message every enquirer.
- **Zero opportunities exist in the location.** See Part 5, because this matters more than it looks.

### The WhatsApp track

**Trigger:** contact tagged `whatsapp`, no booking, not tagged `nurture-sms`.
**First step of the workflow:** remove `nurture-sms`, add `nurture-wa`.
**Send window:** weekdays 08:00 to 19:00, Europe/London.
**Exits:** as rule 5.

Every messaging step below is preceded by `WhatsApp: Customer Service Window Check`.

**Step 1, immediate. Open branch, free form.** They have just messaged, so the window is open by definition and this step needs no Closed branch.

> Thanks for getting in touch. This is Anthony, I run Web Marketing International. I have your message and I will come back to you myself, usually within a couple of hours in the working day.
>
> If it is easier to just get it booked, grab a time here: {{booking}}

**Step 2, wait 4 hours.**

Open, free form:

> One thing worth saying while it is in front of you. The call is fifteen minutes and there is no charge. I go through what you are running now and tell you where the budget is actually going, and if I think it is already in good shape I will say so and leave you alone.
>
> {{booking}}

Closed: skip to step 3. Do not spend a template four hours in.

**Step 3, wait until day 2, 10:00.**

Open, free form:

> Still happy to take a look whenever suits you. Fifteen minutes, no charge: {{booking}}

Closed: template `wmi_nurture_1`.

**Step 4, wait until day 5, 10:00.**

Open, free form:

> Last message from me on this. If the timing is wrong, no problem at all and I will leave it there. If you do want that fifteen minutes, the diary is open: {{booking}}

Closed: template `wmi_nurture_2`.

**Step 5.** Remove `nurture-wa`, add `nurture-done`. Stop.

### The two templates to submit to Meta

Marketing category, English (UK). Put the booking link in a URL **button**, not in the body: a link as a body variable is a common rejection reason and a button converts better anyway. The opt-out is a quick reply button, which is the mechanism Meta supports and expects.

**`wmi_nurture_1`**

> Body: Hi {{1}}, Anthony here from Web Marketing International. You messaged me about your advertising and I have not managed to catch you since. Fifteen minutes on a call and I will tell you where your budget is actually going. No charge, and no obligation after it.
>
> Buttons: [Book a time] (URL, static booking link) · [Stop messages] (quick reply)

**`wmi_nurture_2`**

> Body: Hi {{1}}, last message from me. If the timing is wrong then no problem at all and I will leave it there. If you do want that fifteen minutes, the diary is open.
>
> Buttons: [Book a time] (URL, static booking link) · [Stop messages] (quick reply)

`{{1}}` is the first name. The receiver sets it to "WhatsApp" when no name arrives, which reads badly in a template, so **step 3 and step 4 need a condition: skip the template if the first name is "WhatsApp"** and let those contacts fall out of the sequence. A generic knock is not worth a damaged quality rating.

Wire `[Stop messages]` to a workflow that sets DND and adds `nurture-stop`. A quick reply button that does nothing is worse than no button.

### The SMS track

**Trigger:** contact tagged `web form`, no booking, not tagged `nurture-wa`.
**First step:** remove `nurture-wa`, add `nurture-sms`.
**Send window:** weekdays 09:00 to 18:00, Europe/London. Tighter than WhatsApp on purpose, because an SMS at 18:45 reads as a debt collector.

**Step 1, immediate:**

> Thanks for your enquiry. This is Anthony at Web Marketing International, I will come back to you shortly. If you would rather book a time now: {{booking}} Reply STOP to opt out.

**Step 2, day 2, 10:00:**

> Anthony at Web Marketing International. Still happy to spend fifteen minutes on what you are running and where the budget is going, no charge. {{booking}} Reply STOP to opt out.

**Step 3, day 5, 10:00:**

> Anthony here, last message from me. If the timing is wrong that is fine, I will leave it there. If not, the diary is open: {{booking}} Reply STOP to opt out.

**Step 4.** Remove `nurture-sms`, add `nurture-done`. Stop.

GHL honours STOP on LC Phone numbers and sets DND, so the opt-out works without extra wiring. Confirm it on `+447476925643` before go-live rather than trusting the sentence: send STOP from a test handset and check DND flips on the contact.

### What it costs, from this Twilio account's own rates rather than a rate card

| Item | Rate | Source |
|---|---|---|
| WhatsApp free-form inside the window | £0 for the first 1,000 service conversations a month | Meta |
| WhatsApp marketing template, UK | about £0.038 per delivery | Meta published rates, confirm on the first bill |
| WhatsApp utility template, UK | about £0.016 per delivery | as above |
| SMS to a UK mobile | £0.042325 per segment | this account's Twilio pricing API |

The three SMS messages all exceed 160 characters, so budget two segments each: about **25p per contact** for the SMS track. The WhatsApp track is two free messages and at most two templates: about **8p per contact**, and less whenever the window is open. WhatsApp is the cheaper channel as well as the better one, which is a useful thing to know when a client asks why they are being pushed towards it.

---

## Part 3: before it goes live

**1. There is no booking link, and this is the hard blocker.** The WMI location has zero calendars, wmiltd.com has no Calendly or Cal.com anywhere on it, and `/free-audit` is a form that promises a written report rather than a call. Every message above has a `{{booking}}` in it and none of them can ship without one. This is the same shape as the VIP build, which sat blocked on Kyle's Calendly link until 14 August, so it is a known pattern and it is worth resolving first rather than discovering at build time. **Founder decision: a GHL calendar in this location, or an existing external booking link.** Build the workflows and leave them off in the meantime.

**2. The consent line on the free audit form.** The widget half is done. The form half is not: `/free-audit` collects a phone number and says only "No obligation. We reply within 1 working day." One line under the submit button, matching the widget's wording, and the soft opt-in holds for form leads too. Until then the SMS track has no lawful basis and must not be switched on.

**3. Meta template approval takes hours to a day and can be rejected.** Submit both templates the moment the booking link exists, before building the workflows, so approval runs in parallel rather than in series.

**4. Confirm "Whatsapp automation" is webhook-only** before adding step 1, per Part 2.

**5. New enquiries only. No backfill.** Nobody who enquired in April should receive step 1 today.

**6. Test with a real handset that is not the founder's**, because his number is already the test contact and duplicate matching will update rather than create.

---

## Part 4: cloning it to a client

Everything that changes per client, and nothing else should:

| Variable | WMI value | Notes |
|---|---|---|
| Location id | `nyLMzwmEYXnB3MAxFD7K` | |
| WhatsApp and SMS number | `+447476925643` | must be the WABA-registered number |
| Sender name in copy | Anthony, Web Marketing International | first person singular throughout |
| The offer | fifteen minutes, no charge, where the budget is going | one concrete thing, not a menu |
| Booking link | unresolved, see Part 3 | |
| Privacy URL | `https://www.wmiltd.com/legal` | feeds `data-privacy-url` on the widget |
| Timezone and send window | Europe/London, weekdays | |
| Entry tags | `whatsapp` / `web form` | |
| Template names | `wmi_nurture_1`, `wmi_nurture_2` | prefix per client, templates are per WABA |
| Pipeline and first stage | New Business / New Lead | |

What does **not** change per client: the window check before every WhatsApp step, the mutually exclusive channel tags, the exits, the consent line on the collection surface, the three-template ceiling, and rule 4.

Two things to get right on the first clone, because they are per-client and easy to inherit wrongly. **Templates belong to a WABA, not to us**, so every client needs their own submitted and approved under their own account. And **the consent line has to go on whatever their collection surface actually is**, which may be a form we do not control.

---

## Part 5: what is not built, and the one that matters

**No opportunity is ever created.** `RCV_wa_inbound_wmi` upserts the contact, stamps the attribution, claims the ref and logs the task. It does not create an opportunity, and the location has zero opportunities as a result. Three things follow, in increasing order of seriousness:

1. The pipeline board is empty, so there is nothing to drag anywhere. This is why the won-deal step in demo video 2 got skipped.
2. There is no won event and no deal value, so `CAP_offline_conversions_push` has nothing to push. The whole "completed bookings feed back to Google and Meta" claim, which is an approved claim in the register and the one the demo narration ends on, is currently unbacked on our own account.
3. A nurture with no opportunity attached cannot be measured. Bookings would arrive with no way to say which ones the nurture produced.

**The fix is one HTTP node** after `Parse upsert` in `RCV_wa_inbound_wmi`, posting to `/opportunities/` with pipeline `DbhqH9Th8m7pCxrTjfN7`, stage `72ac5a8a-24d1-4cf9-a1fd-08b348bad208` (New Lead), the contact id and the attribution. It is a live workflow, so it needs a founder go before it is touched.

**Not proposed here, and deliberately.** Email is absent from this blueprint because the WMI location has no email builder and no sending domain configured, and adding a third channel before the first two work is how nurtures become spam. It is the natural next step once the booking link exists.

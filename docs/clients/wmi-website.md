# WMI's own website and demo estate

**Channel file.** Read `docs/PROJECT_STATE.md` §1, §2 and §7 first; this file is owned by the wmi-website session. **Assembled 2026-08-15 during the lead-gen split, not moved**: this client had no PROJECT_STATE blob, so the state below is gathered from session history and live reads. Treat undated claims as needing verification.

**Last worked 2026-08-16.** Everything dated that day was read from the live location, the live n8n workflows or the live Twilio account, not remembered.

---

## What this is

`wmiltd.com`, our own site, and the place where products get proven before a client sees them. Not a client, but it behaves like one and it needs an owner.

The portals themselves (`app.wmiltd.com`, `app.webmarketinginternational.com`) are **shared infrastructure and stay in PROJECT_STATE §3**, because both tracks depend on them. This file covers the marketing site and what runs on it.

## The WhatsApp bridge lives here first

Widget live and serving from `app.wmiltd.com/wa-widget.js`, embedded on the homepage. It captures **gclid, fbclid, msclkid, gbraid, wbraid and all five UTM parameters**.

**Proven in production 2026-08-06**, click to CRM in thirteen seconds. Attribution carried by the 30-minute single-unclaimed-click window, not by anything inside the message.

**One click record exists, ever, and it is synthetic.** Created 6 August with `gclid: CLEAN_TEST_789`. No real visitor has used the widget. That is the honest state, and it is why the demo needed a real-format click id borrowed from elsewhere.

**The chain stopped at the contact, and now it does not. Found and fixed 2026-08-16.** `RCV_wa_inbound_wmi` upserted the contact, stamped the five attribution fields, claimed the ref and logged the task, but never created an opportunity, so the location held zero of them. That emptied the pipeline board, left `CAP_offline_conversions_push` with no won event and no value to push, and left the approved claim that completed bookings feed back to Google and Meta unbacked on our own account.

**Founder go given 2026-08-16, node added and proven.** `Create opportunity` sits between `Claim ref + log` and `Respond ok`, posting to `/opportunities/` into New Business / New Lead, reading `Parse upsert` by node name because the item arriving there is the postgres result rather than the lead. Fired twice against the test contact: one opportunity created (`UFhrtXFkfAMcmcsAqmji`, source `whatsapp organic`), and the second fire created no duplicate, so `allowDuplicateOpportunity: false` is doing the dedupe. Webhook response shape unchanged, workflow still active. Backup of the previous version at `~/Downloads/n8n-archive/RCV_wa_inbound_wmi_2026-08-16_before-opportunity-node.json`.

Contract note for anyone doing this on another location: `status` is required and must be one of `open, won, lost, abandoned`. A create without it returns 422, which is how the shape was confirmed without creating anything.

## The demo

Two recordings planned, phone then desktop: `docs/WA_DEMO_TWO_VIDEOS.md`. Video 1 shot; video 2 needs a reshoot.

**Reshoot prep done 2026-08-16 and written into that file.** Two blockers: no opportunity exists to drag into a won stage (above), and the Landing Page field on the test record reads the literal string `DEMO_TEST_CLICK_123`, which sits in the exact frame the script holds on. Two smaller items: the last pipeline stage is called "Won/Lost" and stage three is called "Audit deiivered", both on camera, and two variants of the demo gclid are in circulation.

**The recording itself needs the founder's hands.** The enquiry has to arrive live from a real handset during the take, so the phone half cannot be produced from here and should not be.

**Canonical demo click id** is a real gclid with one character altered in the middle, so it holds the exact shape of a real one while pointing at nobody's account. Prefix and tail untouched. Use the value at the top of `WA_DEMO_TWO_VIDEOS.md`; the 11 August record used a different altered character.

## The landing-page defect: fixed and live

The widget stored the landing page **once on first touch and never refreshed it**, so a record could pair today's click id with a landing page from a previous visit. Founder ruled 2026-08-11 that this did not block the demo.

**Fixed 2026-08-16 and merged to `main` on founder go, so it is live on `app.wmiltd.com`** and confirmed serving. A click id the visitor has not arrived with before counts as a fresh ad click and re-stamps the landing page and referrer beside it; `first_seen` stays the genuine first touch and a new `landing_seen` moves with the landing page. Reloads, same-id returns and utm-only changes deliberately leave it alone. Six tests in `tests/wa-widget-attribution.test.js` run the real file in a stubbed DOM, and the defect case was confirmed failing against the pre-fix version so the suite is not vacuous. Also verified in a browser end to end.

**The second commit adds a consent line to the widget card**, defaulting on. See below.

**Timing detail that catches people out:** an existing visitor's `sw_wa_attr` still holds the stale landing page until their next arrival with a click id, which is when it heals. The founder's phone included.

**One loose end:** `landing_seen` is not in the `ALLOW` array in `RCV_wa_click`, so it is dropped server-side. Harmless, but the field is useless until one word is added to that list.

**Separate finding, not fixed:** nothing expires `sw_wa_attr`. A gclid captured six months ago is still sent with a fresh enquiry today, well past any sensible lookback. Fixing it means choosing our lookback window, which is a product decision rather than a bug fix, so it is flagged rather than done.

## Consent, and why it became this channel's problem

Any nurture on these numbers rests on PECR's soft opt-in, and one of its four conditions is that the person was given a chance to refuse **at the point their details were collected**. On 2026-08-16 neither collection surface met it.

- **The widget card said nothing. Fixed and live**, `data-consent` to override or turn off, `data-privacy-url` for the link, wording set with `textContent` so a client attribute cannot inject markup.

  Two things about the homepage embed, which lives in the marketing site repo rather than this one. It sets no `data-privacy-url`, so the line shows without the link to `/legal`, which is worth adding. And its greeting reads "Ask us anything about your ad accounts. We reply fast on WhatsApp", which is the agency "we" immediately before a nurture sequence written entirely in Anthony's first person singular. Two consecutive messages in two different voices. Founder's call, one line to change.
- **`/free-audit` says only "No obligation. We reply within 1 working day." Not fixed.** It collects a phone number, so until it carries the same line the SMS nurture has no lawful basis and must stay off.

Privacy policy exists at `https://www.wmiltd.com/legal`.

## Nurture: designed, blocked on a booking link

`docs/NURTURE_BLUEPRINT_WA_SMS.md`, written 2026-08-16. Built here first so the mistakes happen on our own number, then cloned; Part 1 is the reusable half and Part 4 is the per-client variable table.

**Booking link: the founder has one and is sending it (2026-08-16).** There is none in the location or on the site, so every `{{booking}}` in the blueprint is a placeholder until his link arrives. Drop it into the two message sets and both template submissions when it does; nothing else changes.

Second blocker is the `/free-audit` consent line above. Neither blocks writing the workflows and leaving them off.

Costs, from this account's own rates: WhatsApp track about 8p per contact, SMS track about 25p. WhatsApp is the cheaper channel as well as the better one.

## Telephony

`+442045383367` "WMI outbound (UK)", imported into the WMI GHL location.

**Rates confirmed 2026-08-16 from the Twilio pricing API on our own account, not a rate card.** UK landline outbound `£0.011942` a minute, so the 1.19p figure is exact. The founder's UAE mobile `+971504468897` is `£0.226362` a minute, and the billed bridge calls agree to five decimal places (32 seconds on 3 August billed £0.22636). A bridge call is therefore about **23.8p a minute**, of which 22.6p is ringing Dubai. The 24.6p in circulation is close enough to have been the right instinct; the measured number is 23.8p and the saving from browser dialling is about 95%.

`OP_call_bridge` exists precisely because of this: it rings his mobile from the 020 and bridges to the UK target, and its own code says "No VoIP on his side."

**WebRTC dialling has still never been tested, and the mode check is blocked.** The per-user call settings are not readable through the WMI private integration token: `/users/` returns an empty array. It needs a GHL sign-in, and signing in is not something this session will do. Once signed in, the check and the test are five minutes, and the test is definitive rather than a matter of reading a settings page: place one short call through the GHL dialer, then read the Twilio call log. A single leg to the UK target means browser mode. A leg to `+971504468897` means it is ringing Dubai and costing 22.6p a minute more than it should.

**Number inventory on the WMI location, read 2026-08-16:** `+442045383367` (outbound UK), `+447476925643` (WhatsApp and SMS), `+16466933390`, and `+442046529670` titled "KST call tracking". The last one sitting in the WMI location looks misfiled and is worth a look by whoever owns KST.

**Access note that corrects the 2026-07-31 map.** `phone-system/numbers` was recorded there as returning 401 on all location tokens. It returns 200 on the WMI token now, so that gap is closed for this location at least. `/users/` is the one that is still shut.

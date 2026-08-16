# WMI's own website and demo estate

**Channel file.** Read `docs/PROJECT_STATE.md` §1, §2 and §7 first; this file is owned by the wmi-website session. **Assembled 2026-08-15 during the lead-gen split, not moved**: this client had no PROJECT_STATE blob, so the state below is gathered from session history and live reads. Treat undated claims as needing verification.

---

## What this is

`wmiltd.com`, our own site, and the place where products get proven before a client sees them. Not a client, but it behaves like one and it needs an owner.

The portals themselves (`app.wmiltd.com`, `app.webmarketinginternational.com`) are **shared infrastructure and stay in PROJECT_STATE §3**, because both tracks depend on them. This file covers the marketing site and what runs on it.

## The WhatsApp bridge lives here first

Widget live and serving from `app.wmiltd.com/wa-widget.js`, embedded on the homepage. It captures **gclid, fbclid, msclkid, gbraid, wbraid and all five UTM parameters**.

**Proven in production 2026-08-06**, click to CRM in thirteen seconds. Attribution carried by the 30-minute single-unclaimed-click window, not by anything inside the message.

**One click record exists, ever, and it is synthetic.** Created 6 August with `gclid: CLEAN_TEST_789`. No real visitor has used the widget. That is the honest state, and it is why the demo needed a real-format click id borrowed from elsewhere.

## The demo

Two recordings planned, phone then desktop: `docs/WA_DEMO_TWO_VIDEOS.md`. Video 1 shot; video 2 needs a reshoot for the frame (clean browser, banners dismissed, and the won-deal step that was skipped).

**Canonical demo click id** is a real gclid with one character altered in the middle, so it holds the exact shape of a real one while pointing at nobody's account. Prefix and tail untouched.

## Known defect, ruled cosmetic for demos

The widget stores the landing page **once on first touch and never refreshes it**, so a record can pair today's click id with a landing page from a previous visit. Founder ruled 2026-08-11 that this does not block the demo. **It is still wrong for a paying client** and should not become permanent by neglect.

## Telephony

`+442045383367` "WMI outbound (UK)", imported into the WMI GHL location. WebRTC dialling from the browser has **never been tested**; if it works it is roughly 1.19p a minute to UK landlines against about 24.6p through the callback bridge, because 92% of a bridge call is paying to ring a UAE mobile.

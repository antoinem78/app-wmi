# KST Accountants

**Channel file.** Read `docs/PROJECT_STATE.md` §1, §2 and §7 first; this file is owned by the kst session and is the client's living state. Content below was moved verbatim from PROJECT_STATE §4 on 2026-08-15 during the lead-gen half of the per-client split (pre-split history: commit d71cf65).

---

**KST Accountants.** THE BLUEPRINT, ruled 2026-07-30: a minor account by revenue that exists to be cloned for the next accountancy client and the next non-dental lead gen client. Build to be cloned, not just to work.

Done: sending domain `mail.kst-accountants.co.uk` live at IONOS, all six records verified authoritatively and propagated, warm-up Stage 1, SSL issued, From set to Kris Thiemelay / info@kst-accountants.co.uk. Root domain untouched (Microsoft 365 behind MailAnyone). Three GHL workflows exist: two OCT stage workflows and Website Lead Notifications.

Blocked: the nurture sequence is written (`~/Documents/KST_NURTURE_SEQUENCE.md`, six emails over fifteen days) but **not built**, because every email points at a consultation booking page that does not exist and we have no access to Kris's calendar. Parked by the founder. **Update 2026-08-02: the founder is chasing Kris for calendar access.** When it lands, the unlock order is: booking page in KST's GHL (calendar widget), then the workflow built in the GHL UI against the sequence doc (no create API), and Kris's confirmation of the Making Tax Digital dates in email 3 should be asked for in the same conversation. SMS nurture is a separate later step: gated on Twilio bundle approval, then a 07 mobile number (GB geographic stock is voice-only), then the GHL agency Twilio connection, then a short 2-3 message flow; nothing designed yet, and the same booking link is a prerequisite. Twilio note 2026-08-02: the API key 401 was the SID and secret swapped in substrate.env; fixed, auth verified. **2026-08-03: UK Local bundle APPROVED (BU90cfdc70ae) and two London numbers purchased under it: +442045383367 "WMI outbound (UK)" and +442046529670 "KST call tracking" (destination when wired: 020 3150 2074, via GHL call tracking, so configuration happens through the GHL agency Twilio connection, not raw Twilio).** Mobile bundle BU8f2632c4 submitted same day (reused the approved end-user and business_address doc) and is in-review; on approval buy one +44 7 for SMS nurture. Ofcom constraint to remember: from 15 July 2027 a +447 CLI on calls entering the UK from abroad is forced to "withheld", so the 07 is the SMS identity and the 020 is the outbound voice identity.

**OCT unblocked for KST, triaged 2026-07-31.** The 1,191 malformed OCT tasks are a bounded, closed incident: 13 to 25 June only, nothing since, and 1,177 of them belong to **shallowford-smiles** with zero KST rows. The request payloads are OpenDental sync-trigger envelopes (`{"run":"opendental_sync","client_slug":"shallowford-smiles"}`), not conversion data at all, so they are sync runs mislabelled into an OCT failure status rather than genuine OCT failures. OCT itself dispatched successfully 22 times in July. The founder's hold ("do not activate KST OCT on an unclassified failure pattern") is therefore satisfied: the pattern is classified. Caveat recorded honestly: `result` is null on every affected row, so the mechanism is read from the request shape, not from a stored error.

Outstanding: **capture KST as a GHL snapshot.** `snapshotId` is empty, so nothing there is portable, which defeats the blueprint purpose. Grows harder with every hand-built addition. Also note GHL workflow creation is UI-only; `POST /workflows/` returns 404, and no scope grant changes that.

---

## The silent call tracking, answered 2026-08-16

**Question put to this session:** call tracking is complete and the site swapped, but no real call has come through since. Low volume, or poor number placement on the page?

**Answer: neither. There was no traffic to place a number in front of.** The Google Ads account served its last impression on **2026-07-22**. Every day since is zero impressions, zero clicks, zero spend. The site swap went live on 2026-08-06, which is 15 days into a blackout that is now 25 days long. The tracking layer has been measuring an empty room.

**Evidence, two independent systems agreeing.**

- Twilio, every call ever placed to +442046529670: six, all from +442045383367, all on 3 and 6 August, all ours. Not one call from a member of the public, ever.
- GHL location `Zts49PaUrbGfHuBtpknt`, entire conversation history: **four records**. One is the 6 August test call. Three are website lead notification emails from 16 July. Nothing since.
- Google Ads customer `4226686978`, daily rows 2026-08-01 to 2026-08-16: **zero rows returned**. Monthly: Feb 1,613 impressions, Jun 1,058, Jul 865, Aug nothing.

**Placement was never the problem, and this is worth stating because it was the leading hypothesis.** The live homepage carries eight `tel:` links and ten rendered instances of 020 4652 9670. The number sits in the desktop header, the mobile menu, the footer, a hero slide CTA, the mobile sticky bar (present on every page except `/contact` and `/privacy`), every service page twice, the thank-you page and the `LocalBusiness` structured data. Google has already re-indexed it: the organic snippet for the site now reads "Call us 020 4652 9670". If anything the site over-places the number.

**Why the account went dark, diagnosed rather than guessed.** Nothing is blocked: billing APPROVED, no account spending limit, all ads APPROVED and REVIEWED, all nine keywords ENABLED and ELIGIBLE, budgets funded at £60/day across three enabled campaigns, `serving_status: SERVING` on all of them. The account is losing every auction rather than being held out of it.

- **Quality Score 1 and 2** on the keywords that carry one ("tax accountant near me" QS 1, "accountants near me" QS 2, "accounting firms near me" QS 2).
- **Max CPC £8.00** against first-page estimates that exceed it on three of nine keywords: "good accountant near me" £11.64, "accounting firms near me" £9.59.
- July impression share confirms the mechanism: `Search | Near Me` lost **40.6% to rank** against 8.0% to budget; `DSA` lost **54.7% to rank** against 2.5%. Rank, not money, was already the binding constraint while it still served.
- **Proximity targeting is a 5 mile radius** around 51.6255, 0.0438, on all three enabled campaigns.
- **Ad schedule is Monday to Friday 09:00 to 17:00 only**, so evenings and weekends buy nothing.
- The one campaign that was budget-bound rather than rank-bound, `Search | Generic` (84.2% lost to budget on £10/day, avg CPC £7.66), is **PAUSED**. Someone paused the campaign that wanted more money and left running the ones that cannot win.

**What real volume looks like here, so nobody calls six quiet days an emergency again.** In July, with £202 spent, the account produced **4 conversions, all of them `Calls from ads`** (the AD_CALL asset, which dials from the ad and never touches the website). Roughly 4 calls per month at that spend. Six or ten days of silence sits inside normal variance even when traffic is running. It was never a volume anomaly worth a tracking investigation.

**The structural finding, and the bigger one: the Google Business Profile publishes the untracked landline.** The GBP for "KST Accountants Limited" is live and its Call button is `tel:+442031502074`, the office line, verified on the public Maps surface today. For a local accountancy firm the map pack is normally the *largest* call source, and it is one hundred percent invisible to the tracking layer by construction. This is **gap 2 of `docs/CALL_TRACKING_NUMBER_MAP.md`, flagged 2026-07-31 as "no API access from here" and never closed.** It is closed now, and the answer is the bad one. Two smaller NAP mismatches ride along: GBP hours are 09:30 to 17:00, `lib/site.ts` says 09:00 to 17:30; and the GBP carries no reviews and no photos.

**One input still unmeasured, stated rather than assumed.** There is no GA4 API credential on this machine, so organic session volume is not readable from here. It does not change the conclusion (the tracked number is shown to every visitor regardless of source, and it logged nothing), but it does mean "how many people saw the page at all" is inferred rather than measured. One GA4 access request closes it.

**Do not put a number in a client-facing document from this yet.** The account is a candidate for the entity check: campaigns are prefixed `AM |`, and the conversion action list contains three `www.rdaccountants.co.uk` GA4 actions (HIDDEN status). RD Accountants is a different firm. Whether that is an inherited MCC-level GA4 link or a genuinely cross-wired account needs answering before anything is written for Kris, per the standing rule on verifying who controls a system.

### What follows, in order

1. **The tracking layer is sound and needs no work.** It is proven end to end (6 August, 85s of ring, clear audio) and correctly placed. Leave it.
2. **Get the GBP number swapped to 020 4652 9670.** This is the single highest-value action available and it needs Kris, because GBP ownership is his. It also raises a question for the founder: swapping it moves the firm's most visible public number to a tracked line, and NAP consistency with the site and structured data argues for doing it, but a client who is already unresponsive may not act quickly.
3. **The ad account needs a rank intervention, not a budget one.** Bids, Quality Score and the 5 mile radius are the levers. Route through Oscar rather than editing directly.
4. **Unpause `Search | Generic`** or make a deliberate decision not to. It was the only campaign losing traffic it could otherwise have bought.
5. Blueprint consequence: **the runbook must include the GBP number as a step**, alongside the site swap and the LC Phone support form. VIP Accounting is mid-build on the same pattern; the lesson is in shared memory.

## Nurture sequence: the calendar path, checked 2026-08-16

The founder's suggestion (prove the sequence against a calendar we control rather than waiting on Kris) is **viable, and the blocker is smaller than the workflow blocker.** Checked today:

- KST location `Zts49PaUrbGfHuBtpknt`: **zero calendars**. Confirms why the booking page does not exist.
- WMI location `nyLMzwmEYXnB3MAxFD7K`: **zero calendars** too, so "a calendar we control" does not exist yet either and would have to be created.
- Unlike workflows, **calendars are not UI-only**: `GET /calendars/` answers on our Private Integration Token, so the create path is a live candidate rather than a dead end like `POST /workflows/`.

Not actioned, deliberately. The sequence is parked by founder ruling and creating a booking calendar is a client-facing surface, which R7 puts outside self-initiated work. **This is a founder decision, and it is now a small one:** create a WMI-side calendar, point the six emails at it, build and prove the workflow, then repoint at Kris's calendar when it lands. That converts an indefinite block into a swap of one URL.

## Correction to the record

The channel file previously read "destination when wired: 020 3150 2074" as if unwired. It has been wired and proven since 2026-08-06. Kept here because the earlier line above is preserved verbatim from the split and is stale on that point.

---

## CORRECTION 2026-08-27: real calls exist, and the alerts work

**The section above was written against a window that stopped at 16 August. That cutoff was wrong, and two of its claims do not survive the full data.** Corrected here rather than edited above, so the error stays visible.

**Wrong: "not one call from the public, ever".** Five genuine calls have reached the tracked number since 17 August, all of them while the ad account was dark, so all of them organic or map-pack demand.

| When | Caller | Outcome |
|---|---|---|
| Tue 18 Aug 11:39 | 020 8221 9220 | answered, 73s at the office |
| Tue 18 Aug 12:30 | 020 3874 2471 | answered, 96s |
| Tue 25 Aug 12:59 | 0191 294 2094 | answered, 30s |
| Wed 26 Aug 12:19 | 01708 320086 | **missed**, 48s of ring, to voicemail |
| Thu 27 Aug 09:15 | 01708 320086 | **missed**, 35s of ring, no answer |

Read honestly: the two London 020 numbers and the 0191 are as likely to be outbound sales as prospects, and nothing here proves otherwise. **The 01708 is a Romford number, twelve miles away, and it called twice in twenty hours and was missed both times.** That is the one that looks like a real local prospect, and it is the one that got nothing.

**Also arrived: a genuine website form lead on 17 Aug 11:15**, Shirish Agarwal, self-employed. So the site converts when people reach it.

**Wrong: the premise that the missed-call architecture has never fired.** It has fired twice, correctly, and **Kris received both alerts.**

- 26 Aug: call at 12:19:38, alert to kris@kst-accountants.co.uk at **12:20:34**, to Antoine at 12:20:35. 56 seconds.
- 27 Aug: call at 09:15:46, alert to Kris at **09:16:28**, to Antoine at 09:18:05. 42 seconds.

Both carry the caller's number and "Worth a callback today while they are still looking." The `Missed call alert` workflow (`d030776f`, published 2026-08-06) can be treated as proven. **One caveat that is not proven: GHL records the alert as sent, which is not the same as landed in Kris's inbox rather than his junk folder.** These go out over our warmed sending domain into his Microsoft 365 mailbox behind MailAnyone. Worth one question to Kris, and it is the obvious explanation if he saw neither and still missed the same caller twice.

**Still standing, re-confirmed on the live knowledge panel today: the GBP publishes 020 3150 2074.** Every map-pack call remains untracked, and now that real call volume is demonstrated, this matters more than it did.

**Still standing: placement was never the problem.** Five calls found the number without any paid traffic at all.

### Ads: the founder says live on £50/week, the account says otherwise

**Google Ads reports zero impressions on every single day of August, including complete days such as 26 August.** Not low delivery, zero. If the intent was for them to be running, they are not.

Budgets also moved during 27 August, from £20/£20/£20 per day at first read to:

| Campaign | Status | Budget |
|---|---|---|
| AM \| Search \| Near Me | ENABLED | **£1.00/day** |
| AM \| DSA | ENABLED | £10.00/day |
| AM \| DSA \| Service | ENABLED | **£1.00/day** |
| AM \| Search \| Generic | PAUSED | £10.00/day |

That totals £12/day, or £84/week, which is not £50/week either way. **The £1.00/day budgets are self-defeating: the account's own average CPC is £5.11 to £7.66, so a £1 daily budget cannot buy one click on most days.** Combined with the rank problem already documented (QS 1 and 2, £8 max CPC against first-page estimates to £11.64, a 5 mile radius, weekdays 09:00 to 17:00 only), enabled-but-invisible is the expected outcome, not a surprise.

**This needs Oscar and a founder decision on what £50/week is actually meant to buy.** At a ~£6 CPC, £50/week is eight clicks. That is a real strategic question, not a settings tweak: eight clicks a week will not produce a measurable call flow, whereas the organic and map-pack demand already producing five calls in ten days is free and currently leaking.

## Deliverable: Google review QR code, built 2026-08-27

Kris asked for a QR code so clients can leave Google reviews. Built and verified, in `~/Documents/kst-review-qr/`.

- `KST-review-cards-A4.pdf`, print-ready: one desk/counter card plus two wallet cards, KST logo, brand navy `#0A3D5C`, cut lines, print at 100% scale.
- `kst-google-review-qr.svg` (vector, any size), `kst-google-review-qr.png` (1176px), `kst-google-review-qr-black.png` (pure black fallback).
- `kst-review-cards.html`, the source, fully self-contained.

**Target URL: `https://www.google.com/maps/place/?cid=1731863673347784159`.** Verified by loading it: it resolves to the KST Accountants Limited listing, where Write a review is one tap away. The CID was read off the live Maps entity (`ftid 0x8f58fc5f84d9c6cd:0x1808d0d5c94c3ddf`).

**Verification, because an unreadable printed QR is worse than none.** Error correction level H (30%). The payload decodes back to the exact expected URL, and the image embedded in the PDF is pixel-identical to that verified PNG, so all three codes on the sheet are the same verified symbol. Printed module sizes are 0.88mm on the counter card and 0.56mm on the wallet cards, both comfortably above the practical camera floor. Note for anyone repeating this: OpenCV's detector fails on this version-6 symbol at most scales while the code is perfectly valid, so do not treat an OpenCV failure as a bad QR.

**Better target available for one minute of Kris's time.** Google's own short review link (`https://g.page/r/<code>/review`) opens the star dialog directly, skipping the listing. It only exists inside his GBP dashboard under Ask for reviews. If he sends it, regenerating the QR and the PDF takes seconds and the design does not change. **Worth asking in the same message as the GBP phone number swap, since both are GBP dashboard jobs and he is unresponsive enough that they should not be two separate asks.**

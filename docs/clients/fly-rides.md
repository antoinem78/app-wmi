# Fly-Rides

**Channel file.** Read `docs/PROJECT_STATE.md` §1, §2 and §7 first; this file is owned by the fly-rides session and is the client's living state. Opened 2026-08-28 from live reads. **Rewritten the same day against the founder's Slack thread with the client**, which supersedes most of the day-one guesswork.

## The relationship, from the client thread

**The client is Scott Good, owner of Fly-Rides** (Austin party bus and shuttle hire, trading since 2014). His login is `booking@fly-rides.com`, originally invited by `scott.michael.good@gmail.com` in 2016. He signs off "Scott 'Not a Bot' Good", writes structured tickets with portal ids and field names, and is clearly using AI assistance of his own. Treat him as technical: he checks claims, and he corrected the founder twice in the thread.

**There is no active management retainer.** The founder's 2026-08-24 message: "If you reactivate the google ads contract I can include Hubspot setup and management in the $500/m milestone." So `reporting_only` on the portal is accurate, and Scott runs the ad account himself. Outstanding commercial offers on the table, both the founder's:

- **$500 one off, pay only if fixed**, for the HubSpot to Google Ads tracking work, offered 2026-08-21. Scott accepted the terms far enough to grant a seat and asked which email (`antoinemcc6@gmail.com`). Zapier access also requested.
- **$500/month** including HubSpot setup and management, conditional on reactivating the Google Ads contract, offered 2026-08-24. Not answered.
- **Microsoft Ads pitched** to Scott 2026-08-24 ("you should also seriously consider Bing ads"). This is the whole basis for Microsoft Ads on the portal record: a pitch, not an account. No credential exists on our side and no account number is recorded.

**Scott's open ask, 2026-08-27, still unanswered.** Three items in priority order, and he asked for a rough estimate of hours and a start date, plus "if you think there's a better approach, tell me before you start rather than after":

1. Deal name merge field: every HubSpot deal saves as `Party Bus Booking - ` with the customer name missing. 35 deals last week. Small fix in whatever workflow or Zap creates the deal.
2. Offline conversion import: closed won deal amounts ($1,500 / $1,200 / $1,400 last week) are not reaching Google Ads. Method is the founder's call.
3. GTM enhanced conversions matching, which is what makes item 2 attribute correctly.

He also left **four questions unanswered from 2026-08-19**: the fetii negative question, the bid strategy switch, the Location Based budget call, and whether the founder takes the GTM and OCI work or Scott hires a developer. He has since acted on the budget question himself.

**Other people in the account.** Scott went to `muneeb.farman@gmail.com` first with the GTM fix and reports Muneeb "tried to make me a full management client rather than just patch this one piece for $2000 a month". Muneeb holds ADMIN since 2025-11-07, which is the same month as the `AM | ... | Nov 2025` restructure. Whether Muneeb is our contractor, working to our naming convention and quoting his own retainer directly to our client, is **not established and is worth the founder's attention**. Do not assert it either way.

## Verified account facts

**Google Ads `7345621720`.** USD, America/Chicago, auto-tagging ON, not a test account. Oldest access 2016, archived campaigns from 2019, 37 campaigns total with 3 enabled.

**Who holds it: we do, and `AM` is the founder.** The account sits at `customer_client.level = 2` under **AM MCC J `2343567521`**, itself a level-1 child of the WMI Ltd MCC alongside AM MCC B, AM Top MCC, SingularWeb.ai and WMI FZCO, all administered by `antoinemcc2/4/6/7@gmail.com`. The founder confirmed the mechanism to Scott on 2026-07-30: "I moved accounts around as I'm tidying up my MCCs." The direct manager link from our own MCC id reads INACTIVE, which is not lost access: reads inherit through AM MCC J. General form of the lesson is in shared memory.

**Who edits it: Scott, plus Google unattended.** Full retained `change_event` window, 30 days to 2026-08-28, 34 rows:

| Rows | Editor | Client type |
|---|---|---|
| 16 | `booking@fly-rides.com` | Web client |
| 12 | `booking@fly-rides.com` | API |
| 6 | Recommendations Auto-Apply | Recommendations subscription |

Nobody from our side appears. The 12 API rows are Scott's own tooling on his own login. Note `change_event` retains **30 days only**: `LAST_90_DAYS` is not a valid literal for it and an older explicit start returns `START_DATE_TOO_OLD`, so this cannot be reconstructed later.

**Direct account access (`customer_user_access`).** Four outside logins, three of them ADMIN, all invited by Scott:

| Access since | Email | Role |
|---|---|---|
| 2016-09-18 | `booking@fly-rides.com` | ADMIN (invited by `scott.michael.good@gmail.com`) |
| 2024-10-29 | `mitchellcohen111@gmail.com` | ADMIN |
| 2024-11-16 | `ads.audit15@gmail.com` | STANDARD |
| 2025-11-07 | `muneeb.farman@gmail.com` | ADMIN |
| 2026-03-21 | `mujahid1129261@gmail.com` | ADMIN |

**Live campaigns, verified 2026-08-28.** 30 days: $4,322.49 spend, 619 clicks, 92 conversions. Impression share and CPL over the last 14 days:

| Campaign | Bid strategy | Budget | 14d spend | 14d conv | Cost/conv | Impr share | Lost to budget | Lost to rank |
|---|---|---|---|---|---|---|---|---|
| Location Based, Nov 2025 | Max conv value, tROAS 500% | $110/day | $1,211.60 | 13 | $93.20 | 37.1% | **57.3%** | 5.5% |
| General Keywords, Austin | Max conversions, **tCPA $50** | $45/day | $607.10 | 4 | $151.78 | 58.4% | 21.7% | 19.9% |
| Brand, Restructured | **MANUAL_CPC** | $150/day | $206.18 | 22 | $9.37 | 86.5% | 0.0% | 13.5% |

Conversions here are mostly quote requests, not bookings, which the founder already told Scott. So these are CPLs, not CPAs.

**17 further campaigns carry the `AM |` prefix and are paused** (Español, Competitor Fetii, Near Me, Wedding Shuttle, Broad top performers, PMC lead forms, a March 2026 booking form campaign), so an AM era build programme ran and was largely switched off.

**Portal row.** Created 2026-06-20, never updated. `platforms` genuinely holds `["Google Ads","Microsoft Ads"]`. `contact_name` null, `contact_email` the founder's, `auth0_user_id` null so **Scott has never opened the dashboard**, `service_tier` null, no Stripe ids, `share_enabled` false. `access_tasks` lists ga4, gtm, gsc. It should carry Scott's name and email.

## Tracking state, from the thread

- GTM container **GTM-WVSXKJM**. HubSpot portal **7339040**.
- Scott's site hashes the quote form email server side and appends it to the thank you redirect as `?eh=<sha256>`. Live since 2026-07-13.
- The founder built the receiving side by Google's code snippet method: a `URL - Email Hash` variable reading the `eh` param, and an `Enhanced Conversions - Set User Data (Email Hash)` tag firing on the thank you page trigger at priority 100, calling `gtag('set', 'user_data', {sha256_email_address: ...})`. Verified in GTM preview against a test hash, not against a real submission.
- Per tag user provided data fields no longer exist in that container: the Google Ads conversion tags are linked to the shared Google tag. The old Manual Configuration UPD variable has been orphaned since 2024, pointed at one hardcoded form selector.
- "Allow user provided data capabilities" is ON at account level with automatic email detection, verified by Scott, not by us.
- The founder switched **Enhanced conversions for leads from "Managed through GTM" to "Google Ads API"** around 2026-07-15, because HubSpot's lifecycle sync is a server to server upload. 174 events had synced with 0 conversions recorded.
- Known broken as of 2026-08-19, per Scott: GCLID capture on new HubSpot contacts stuck at ~15.8%; a Zapier automation created 181 junk closed won deals with no amount and no contact link, inflating HubSpot deal counts; deal names missing the customer name.
- Reporting method the founder taught Scott: campaigns tab, last 7/14/30 days, segment by conversion action, add conversions and conv value columns. **Only the HubSpot customer conversion counts**; other conversion values do not.

## Remediation agreed 2026-09-02, and what the reads say about it

**The founder accepted responsibility for the original tracking build and offered to fix it free of charge.** His words: "It was Muneeb's work. If he did a bad job I take full responsibility for entrusting him with the task. I'll aim to fix it, free of charge. I just can't guarantee I can fix it." Scott accepted, **dropped his request for a discount on the next round**, and defined "fixed" as four acceptance criteria plus a request for a realistic target date. So the exposure is now unbounded free work against a bar the client wrote. Two of those criteria turn out to be in better shape than Scott believes, one is undefined, one is real.

**Criterion 1, offline import landing with click ids. Substantially already working, but not in Scott's literal terms.** Since 25 June the `HubSpot - Customer` action (UPLOAD_CLICKS, ENABLED, primary) has recorded **57.5 conversions carrying $103,265.38**, and **100% of it is campaign-attributed**: $80,065 Brand, $17,600 Location Based, $5,600 General Keywords. Most recent conversion 27 August. Trend by month: 6.0 conv June, 23.5 July, 28.0 August. Per the standing memory, a recorded UPLOAD_CLICKS conversion attributed to a campaign is the proof that click id matching works, and it does.

**Do not overclaim this.** Imports were already landing in June, *before* the founder's 15 July switch to the Google Ads API channel, so that change cannot be credited with making it work. And Scott's criterion is worded narrowly: he wants the diagnostic to stop reading "no attempted imports with user-provided data", which is about **hashed email riding along with each upload as a fallback matching layer**, not about click id matching. That specific thing is not verifiable from the ad account and remains open.

**Criterion 3, the flat $900. Refuted.** `HubSpot - Customer` has `default_value 900` with **`always_use_default_value` FALSE**, so $900 is a fallback for uploads arriving without a value, not a hardcoded override. Recorded values: avg $1,566 June, $1,378 July, $2,196 August, $3,175 over 20 to 27 August. That matches Scott's stated real average booking value. The founder already made this point to Scott on 15 July with screenshots; Scott has repeated the stale claim twice since.

**The real value problem is elsewhere, and it is worth volunteering.** Two other primary actions pollute the same value pool that Location Based's tROAS 500% bids against:
- `Submit Booking Form` (WEBPAGE, primary): `default_value 250`, **`always_use_default_value` TRUE**. 127 conversions since 25 June, contributing **$31,750 of entirely synthetic value**.
- `Order Confirmation With Value (GTM)` (WEBPAGE, PURCHASE, primary): 38 conversions recording **$0.00 value**, despite the name.
So roughly a quarter of the value the bidding sees is invented. There are also 8 enabled primary conversion actions including `Phone Clicks`, which is a weak signal to be bidding on.

**Criterion 2, "match rate up meaningfully from ~16%". Undefined, and possibly already at ceiling.** Scott's 15.8% is GCLID capture across **all new HubSpot contacts**, whose ceiling is the paid-search share of enquiries. Organic, direct and referral contacts can never carry a click id. Committing to move that number without first establishing the paid share is committing to something that may be unachievable. The correct measure is the share of *paid-search* enquiries carrying a click id through to booking, and only Scott can supply the denominator. **This is the criterion to pin down before the clock starts.**

**Criterion 4, Zapier junk deals and the deal name merge field. Genuinely outstanding**, purely HubSpot and Zapier side, and blocked on access. The founder asked for the HubSpot seat on `antoinemcc6@gmail.com` plus Zapier access; whether the seat is live is unconfirmed. Scott already cleaned out the existing junk deals himself (75+ by his latest count, 181 by his 19 August count), so the job is the cause, not the cleanup.

**Draft reply confirming the proposal with a three week checkpoint** is in the session scratchpad, not sent.

## Verification log

**2026-09-02. Scott claimed two fixes; both fail account-side reading.** Recorded because the standing ruling is that claimed is not true until read, and this is the second time on this account that a stated fix did not match the data.

- **Claim: "the auto-apply setting deleting negatives is already off".** False. `recommendation_subscription` still returns **2 ENABLED**: `OPTIMIZE_AD_ROTATION` and one the API reports as type `UNKNOWN`, which is the one removing negatives.
- **Claim: "I've re-added killeen, fredericksburg, and cheap".** Partly done and then undone. `change_event` shows Scott created `killeen` and `fredericksburg` as **BROAD** negatives on Location Based on **2026-08-31 14:05**, and auto-apply **REMOVED both on 2026-09-01 22:46**, roughly 33 hours later. Neither is present now. `cheap` was never re-added on either campaign. The only surviving `fredericksburg` is the older PHRASE negative on General Keywords, plus an EXACT `fredericksburg shuttle service` in the `Roman - Specific` shared list. **That makes four deletions of `killeen` since 30 July.**

So the founder should send the auto-apply warning after all, despite Scott saying not to bother.

**Criterion 2 resolved by Scott 2026-09-02.** Paid search is **11% of new contacts, 92 of 825 created since 1 June**. He conceded the ~16% figure is at or above its ceiling rather than a failure, and agreed the target should be click id capture **on paid search enquiries specifically**. The undefined-target risk is closed.

**Open discrepancy from those two figures.** Click ids on ~16% of contacts against an 11% paid share should not both hold. Most likely older click ids persisting from an earlier visit and attaching to enquiries HubSpot does not class as paid search, which would mean paid attribution is over-reading. Unresolved, needs HubSpot access, and it matters because the new target is measured against the paid denominator.

**Scott's own work, confirmed by his account:** the junk closed-won Zap is stopped and 75 phantom deals deleted by him. Remaining on that front is only the name merge field on the legitimate deal-creation Zap.

**Access, 2026-09-02.** HubSpot seat offered to `antoinemcc6@gmail.com`. **For Zapier Scott offered his own login credentials in chat.** Declined in draft: a member invite was requested instead, on the grounds that a shared login leaves no record separating the founder's changes from anyone else's, which matters acutely when he has just accepted responsibility for another party's work, and that Scott's login exposes every Zap rather than the Fly-Rides ones. Password rotation suggested. **No credential from that message is recorded here or anywhere in this repo.**

**Value cleanup green-lit by Scott**, with two cautions raised in the draft rather than acted on: correcting the value settings resets Location Based's bidding into a fresh learning period, so the timing is Scott's to pick; and `Submit Booking Form` (127), `Order Confirmation With Value (GTM)` (38) and `HubSpot - Customer` (57.5) may be counting the same journeys more than once, which would mean conversion totals have been overstated independently of the value problem. Needs GTM and HubSpot access to confirm. Nothing changed in the account.

## Ad account findings, not yet sent to Scott

**1. Google's auto-apply is deleting Scott's negative keywords, repeatedly.** Every one of the 6 auto-apply rows is a negative keyword removal, and the payloads name them:

| Date | Action | Campaign | Negative |
|---|---|---|---|
| 2026-07-30 | Scott adds | Location Based | `killeen` phrase |
| 2026-08-01 | **Google removes** | Location Based | `killeen` phrase |
| 2026-08-18 | Scott re-adds | Location Based | `killeen` phrase |
| 2026-08-19 | **Google removes** | Location Based | `killeen` phrase |
| 2026-08-24 08:33 | Scott re-adds | Location Based | `killeen` phrase |
| 2026-08-24 21:59 | **Google removes** | Location Based | `killeen` phrase |
| 2026-08-19 11:23 | Scott adds | Location Based | `fredericksburg` phrase |
| 2026-08-19 23:26 | **Google removes** (12 hours later) | Location Based | `fredericksburg` phrase |
| 2026-08-18 | Scott adds both | General Keywords | `cheap` broad and phrase |
| 2026-08-19 | **Google removes both** | General Keywords | `cheap` broad and phrase |

`recommendation_subscription` shows `OPTIMIZE_AD_ROTATION` ENABLED plus one subscription the API reports as type `UNKNOWN`, also ENABLED; SEARCH_PARTNERS_OPT_IN, DISPLAY_EXPANSION_OPT_IN and TARGET_CPA_OPT_IN are PAUSED. The `UNKNOWN` one is the likely culprit. It is still costing money: `killeen` queries on Location Based took $69.33 across August with zero conversions, including $1.81 on 23 August, $2.21 on 25 August and $1.62 on 27 August, all after the negative was last deleted. Scott does not know this is happening and has been re-adding by hand.

**2. Scott's fetii question has a real answer, and it is not close variants.** He asked why "fetii bus" still took $37.81 despite an existing phrase negative. Two facts settle it. The $37.81 was spent entirely on **4 and 5 August**, whereas his `fetii` phrase negative was created **16 August**, so the money predates the negative and there has been $0 on fetii terms since. And he was right that a fetii negative existed somewhere: the shared list **`Roman - Competition` (75 negatives, including broad `fetii`, `feti`, `fetiis`, `ninjabuses`) is attached to exactly one campaign, `Fly Rides Non Brand Campaign | Austin`, which is PAUSED.** The Nov 2025 restructure never carried that list onto the new campaigns. Attaching it to the two live non-brand campaigns is the actual fix, and it covers the ninja terms too ($28.38, zero conversions).

**3. The shared negative list named `Brand` has zero members and is attached to 8 campaigns**, including all three live ones. Checked before claiming harm: no brand query reached either non-brand campaign in August, so this is a latent gap rather than live waste. Worth populating, not worth alarming anyone about.

**4. The bid strategy answers are in the impression share table above.**
- Location Based: Scott's instinct was right and understated. He raised it $90 to $110 on 21 August and it is still losing **57.3%** of impressions to budget, not the 36% he estimated.
- General Keywords: he set a **$50 tCPA** on 24 August against an achieved CPL of **$151.78**. A target at a third of reality is the most likely cause of the 19.9% rank loss he asked about, so his own fix is now the constraint.
- Brand: MANUAL_CPC, $9.37 per conversion, 13.5% of impressions lost to rank, spending about $15 of a $150 daily budget. Cheapest converting traffic in the account with a manual bid ceiling on it.

## Standing constraints on this channel

- `reporting_only`, no substrate `clients` row, so no agent config, no KB, no OCT legs, no webchat tenant, no build path and nothing for Oscar to execute against.
- No Meta ad account visible to our system user.
- **Scott edits this account daily and we do not manage it.** Nothing gets changed here without the founder saying so, and anything we do change can be overwritten or can collide with Scott's own work.
- Client facing writing goes out as Anthony, first person singular. Scott verifies claims, so nothing goes to him that has not been read from the account.

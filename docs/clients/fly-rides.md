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

## 2026-09-03: access landed, method decision pending, first HubSpot client

**Access, both live 2026-09-03: the founder holds his own HubSpot seat and his own Zapier member seat** (`antoinemcc6@gmail.com`). Nothing further to request from Scott for access. Whether the HubSpot seat can create an MCP auth app under Development is to be checked by the founder in the portal before any ask goes to Scott (check access before requesting it). **This is the first HubSpot client and the blueprint for the next**: `docs/HUBSPOT_CLIENT_BLUEPRINT.md` (technical shape, diagnostic checklist, access pattern), `SINGULARWEB_PROJECT_STATE.md` §6.6 (strategy entry, filled today), `PROJECT_STATE.md` §7 (capability note).

**How to read and write HubSpot: DECIDED 2026-09-03, HubSpot official MCP server**, for reads and supervised writes; private-app API only if a substrate leg is ever needed; Zapier by hand. Setup: an MCP auth app is created in the portal (Development > MCP Auth Apps), by the founder's own seat if it has the permission, otherwise by Scott; the account admin connects once, sends the client id (chat) and secret (one-time link); founder then runs `claude mcp add --transport http --client-id <id> --client-secret --callback-port 8080 hubspot https://mcp.hubspot.com` in an interactive terminal and completes OAuth via `/mcp`. Secret never goes in `.mcp.json` or the repo. Original assessment: Assessed 2026-09-03: HubSpot official MCP (`https://mcp.hubspot.com`, OAuth, GA, reads via `search_crm_objects`/`get_crm_objects`/`query_crm_data`, writes via `manage_crm_objects`, all under the seat's own permissions; needs an "MCP auth app" created in Scott's portal under Development, and the account admin connects first) is the recommendation for reads and supervised writes. Private-app API only if a substrate leg is ever wanted. Cowork/browser: no. **Zapier is UI-only** (Zapier MCP runs actions, cannot inspect or edit a Zap), so the name-merge fix is founder-by-hand with dictated steps. No MCP server is configured in this environment yet (`~/.claude.json` has none); adding one is a founder action.

**Decisions 2026-09-03 (founder):** HubSpot via MCP (above); Google Ads negatives via the Rexos proposals chassis; Scott's four closed-won deals to be done as the **first supervised HubSpot write** with read-back in HubSpot and then Google Ads, no scope remark this time.

**Proposals filed, status `pending`, awaiting founder approve + dry-run + apply in /proposals** (created 2026-09-03 by `fly-rides-channel`, propose-only, nothing touched in Google Ads):
- `bcfc1292-1201-42c6-84ec-d1548c9b2311` killeen PHRASE, Location Based
- `6acf2658-e055-4de8-919e-510ad2d06373` fredericksburg PHRASE, Location Based
- `48ff2af3-c294-451d-b734-cff28d94f774` cheap BROAD, General Keywords
Two pre-conditions, both founder-by-hand: add `7345621720` to `GOOGLE_ADS_WRITE_CUSTOMERS` on Vercel (apply is allowlist-blocked until then; dry-run works now), and switch off the auto-apply subscription in Recommendations first, or the negatives are deleted again within about 33 hours.

**Scott's authorisations, 2026-09-03, execution state:**
1. Turn the auto-apply setting off and re-add `killeen`, `fredericksburg`, `cheap`. The `UNKNOWN`-typed subscription cannot be mutated through the API (the enum does not know it), so switching it off is **by hand in Recommendations, auto-apply settings**. The negatives can go through the Rexos proposals chassis: `add_negative_keyword` exists with validate_only, mutate, read-back verify and rollback; `onboarding_state` carries `7345621720` in both customer id columns so `customerFor` resolves; `isUnderMcc` passes (level 2, ENABLED). **Blocked at apply by the allowlist**: `GOOGLE_ADS_WRITE_CUSTOMERS` holds one other account, so either the founder adds `7345621720` on Vercel or he adds the six negatives by hand.
2. Proxy value cleanup, "don't wait on me": `Submit Booking Form` (6527288048, $250 forced) and `Order Confirmation With Value (GTM)` (6981210660, $0). Conversion-action mutations are **not** in the chassis (`ExecAction` is negatives, pause, budget only), so this is by hand in Conversions, with the double-counting question (item 3) answered first as agreed.
3. Double-counting check across `Submit Booking Form`, `Order Confirmation With Value (GTM)` and `HubSpot - Customer`: needs GTM (which tags fire on which pages) plus HubSpot (which event feeds the import). Confirm before changing anything, per Scott.
4. The 16% vs 11% click id discrepancy: HubSpot read, once the method is live.

**New request from Scott, 2026-09-03, unactioned and a scope question:** mark four deals closed won with amounts. Luke Beasley $2,400 (deal from 1 Sept, `app-na2.hubspot.com/contacts/7339040/record/0-3/345166437112/`), Erica Davies $600, Jessica Best $550, Allie Waddle $1,000. This is CRM data entry, outside "fix the tracking", but it doubles as the first live end-to-end test: a deal set to closed won with a real amount should reach Google Ads as a `HubSpot - Customer` conversion with that value inside the sync window, which is the proof the checkpoint needs. If done, it should be the **first supervised HubSpot write**, read back in HubSpot and then in Google Ads. Founder to decide whether to do it and whether to say it is outside scope.

## Live HubSpot and Zapier reads, 2026-09-03 (founder's seats, Claude in Chrome on the "MCC6 MAC mini Browser")

**Surface.** The HubSpot MCP cannot be added from inside a session, so day-one work ran through the founder's signed-in Chrome. The Browser pane refuses `app-na2.hubspot.com` outright. Expect a re-sign-in when sessions expire.

**Deal naming defect is universal.** All **1,290** deals in the portal are named `Party Bus Booking –` with the customer name missing, not "35 last week". Deals cannot be found by name; go through the contact.

**Scott's four deals, read before any write:**

| Contact (id) | Deal id | Stage / amount / close | Contact source | GCLID |
|---|---|---|---|---|
| Luke Beasley (544591390455) | 345166437112 | Appointment Scheduled / none / none; created 2026-09-02 01:37 GMT+4 | **Paid Search**, campaign "am | ... near me keywords" | **yes** |
| Erica Davies (331751) | 345540685539 | Appointment Scheduled / none / none; created 2026-09-02 21:56 GMT+4 | Offline Sources via Zapier (contact from Oct 2023) | **yes** |
| Jessica Best (544718806724) | 345188826828 | Appointment Scheduled / none / none; created 2026-09-02 07:10 GMT+4 | Organic Search | none |
| Allie Waddle (544111893223) | **no deal** | n/a | Organic Search | none |

Scott's instruction: Luke $2,400 (from 1 Sept), Erica $600, Jessica $550, Allie $1,000, all closed won. **Discrepancy for the founder:** Luke's contact record shows Scott quoting $2,500 for two buses on 2 Sept; Scott asked for $2,400. Ask, do not guess. Luke and Erica carry click ids, so their closed-won imports are the live test; Jessica and Allie cannot attribute to a click whatever is done.

**HubSpot Ads conversion event** (`/ads/7339040/events`): one event, `HubSpot - Customer`, Active, ad account Fly-Rides 734-562-1720, trigger "Lifecycle stage change", **217 events synced, last synced 2026-09-01 18:07**, Conversions column blank. Banner: 1 event created in Google Ads Data Manager, 3 remaining. Identifier and value mapping not yet read (a Microsoft Advertising promo modal blocked the detail panel).

**HubSpot Ads event detail (id 10573199), read 2026-09-03, nothing saved:** trigger Lifecycle stage change to **Customer**; Google conversion event **Converted Lead**; **Value: fixed $900** (currency picker plus a literal 900, no property-source option on a lifecycle-stage event); consent property Marketing consent = yes; contact data shared: Click ID, Email Address, Phone number, Address, all selected; created 2025-11-20. **So Scott was right about HubSpot sending a flat $900.**

**Where the real values come from, Google side.** `offline_conversion_upload_client_summary` shows **two upload clients**: `GOOGLE_ADS_API` (HubSpot's native sync, last 2026-09-01 17:07) and **`ADS_DATA_CONNECTOR`** (Google Ads Data Manager, last 2026-09-01 11:19), which is the "1 event created in Google Ads Data Manager" the HubSpot banner mentions. Per-day values on `HubSpot - Customer` over 30 conversion days are real amounts (only one day sits at exactly $900 per conversion), so the deal-amount values arrive through the Data Manager connector, not the HubSpot event. **Double-counting suspicion, strong:** daily counts on that action are almost all even (2.0, 4.0, 8.0), consistent with each customer arriving once from each pipeline. Confirm in Google Ads Data Manager (UI only) which conversion action the connector targets and which source it reads, before touching values.

**Google Ads side, same day:** no `HubSpot - Customer` conversion recorded for 28 Aug to 3 Sept, despite both uploaders running on 1 Sept and a $2,500 closed-won deal dated 2 Sept. Offline imports post by click date and lag; re-check after the four writes land.

**Zapier.** Seat is inside the **Fly-Rides** account (members: Antoine G Martin, Member; Scott Good, Owner, `jkeentauna@gmail.com`). Only one Zap is visible to the seat (a Mailchimp to HubSpot note Zap) and "Shared with me" folders are empty, so **Scott's deal-creation Zap is in his private folder**. Only Scott can move it to a shared folder; until then the name-merge fix cannot even be looked at. This is the first genuine "stuck" item.

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

## Norbert's review of the three pending negatives, 2026-09-03 (written by the platform session on the founder's instruction)

Since 2026-09-03 every proposal Oscar files is reviewed by Norbert in code before the founder sees it (`BERNARD_OPTIMISE_SPEC.md` §9). The three Fly-Rides negatives (`killeen` phrase, `fredericksburg` phrase, `cheap` broad) were the first live reviews, run 05:05 UTC against the account's own seven-day change history. **All three SOUND**; the verdicts are on the cards on app.wmiltd.com and Approve is available.

What Norbert flagged, beyond the verdicts:

- **Thrash on Location Based** (4 changes in 7 days), with the human changes named: `booking@fly-rides.com` re-added negatives on 31 August and Recommendations auto-apply stripped them on 1 September at 22:46 UTC. So the cycle documented in the table above has continued past 24 August, and the interval is now about 33 hours. He judged the two proposals on that campaign as the stabilising move because they restore Scott's own change rather than reversing it.
- **A second negative deleted on 1 September is not being restored.** Auto-apply removed two campaign criteria that day (criterion ids 11503581 and 15235830, both created by Scott on 31 August); the proposals restore `killeen` and nothing else from that pair. Whoever holds this channel should read what the second one was before Scott notices it is gone.
- **The precondition is asserted, not verified.** All three proposals gate the apply on the auto-apply subscription being switched off, and nothing in the account confirms that it has been. Until it is read back as off, every negative in the account is provisional and the fix has a shelf life of roughly a day and a half. The subscription is account-wide, so the same deletion is likely happening to negatives no proposal mentions; nobody has audited what else it has reverted.
- **Nobody in this workflow can execute either the fix or the precondition** while the account is reporting-only and Scott edits it himself. The proposals are therefore instructions for Scott, or for the founder with Scott's say-so, not moves.

Cost of the three reviews $0.18, metered under Norbert. Two inbox notes reached Oscar for the flagged proposals.

## Standing constraints on this channel

- `reporting_only`, no substrate `clients` row, so no agent config, no KB, no OCT legs, no webchat tenant, no build path and nothing for Oscar to execute against.
- No Meta ad account visible to our system user.
- **Scott edits this account daily and we do not manage it.** Nothing gets changed here without the founder saying so, and anything we do change can be overwritten or can collide with Scott's own work.
- Client facing writing goes out as Anthony, first person singular. Scott verifies claims, so nothing goes to him that has not been read from the account.

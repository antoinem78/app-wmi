# VIP Accounting: onboarding runbook (blueprint run 1)

**Date opened:** 2026-07-31. **This is the first execution of the KST blueprint against a real second accountancy client.** Everything here should be written with the third client in mind: where this document says "VIP", the next run should only have to change the facts, not the steps.

## 0. The client, verified

| Fact | Value | Source |
|---|---|---|
| Entity | VIP ACCOUNTING LTD, company 15887435, active | Companies House, checked 2026-07-31 |
| Incorporated | 9 August 2024 | Companies House |
| Registered office | 20 Gifford Road, Benfleet, Essex SS7 5XU | Companies House |
| Budget | £1,500/month rising to ~£2,500 around month 3 | client questionnaire |
| Channel | Google Search ONLY initially, deliberate | questionnaire |
| Geography | Essex, open to narrowing on keyword-research advice | questionnaire |
| Offer focus | limited company owners, ongoing relationships, not one-off compliance | questionnaire |
| Priority keyword | "Limited Company Accountant Essex" | questionnaire |
| Negative themes | jobs, careers, training, qualifications, free software, informational | questionnaire |
| Conversions that matter | phone calls and Calendly Zoom bookings | questionnaire |
| Schedule | Mon-Fri 09:00-19:00 initially | questionnaire |
| ICP | established ltd-co owners, £100k+ revenue, usually unhappy with a current accountant | questionnaire |

**Unknowns that block specific steps (§5):** website domain and who controls its DNS; whether a Google Ads account already exists and who holds it; the principal's name (sender identity for nurture); the fee model in their own words. Do not import KST claims like "fixed fees agreed in advance" into VIP copy without confirming they are true for VIP.

## 1. Why clone KST, and what a snapshot does and does not carry

KST's location holds the accountancy-shaped assets: the pipeline, the two OCT stage workflows (Consultation Booked, Engaged/Won), the website-lead notification workflow, and the custom fields including the web-chat set (R6). That is the blueprint content, so KST is the right snapshot source rather than the bare master template.

**A GHL snapshot carries:** workflows, pipelines, custom fields and values, forms, funnels, calendars, tags, email templates.
**It does NOT carry:** the dedicated sending domain, phone numbers, integrations, API keys or PITs, contacts, and it copies workflow webhook payloads VERBATIM, meaning the cloned OCT workflows will still say `"client_slug": "kst"` until rewired. The rewire checklist in §3 exists because of exactly this.

## 2. Founder actions (UI, ~15 minutes, in this order)

1. Agency view, Account Snapshots: **create a snapshot from the KST location**. Name it `Accountancy Blueprint v1 (from KST)`. This is also the snapshot capture the blueprint ruling wanted; it now exists because a real client forced it, which is the right way round.
2. **Create the sub-account** from that snapshot: name `VIP Accounting`, address 20 Gifford Road, Benfleet SS7 5XU, country GB, timezone Europe/London.
3. **Mint a location Private Integration token** for the new sub-account (same scopes as KST's) and add it to `~/.config/singularweb/substrate.env` as `GHL_VIP_PIT=...`. Do not paste it in chat.
4. Tell the session the new location id (visible in the URL when inside the sub-account).

## 3. My actions once the location exists (each verified before the next)

1. **Verify the clone**: read workflows, pipeline, custom fields via the new PIT and diff against KST's set. Anything the snapshot dropped gets named, not assumed.
2. **Rewire the per-client values**: OCT workflow payloads `client_slug` to `vip-accounting`, notification targets, any KST-literal strings (names, phones, emails, URLs) surfaced and listed for replacement. The pipeline stage ids will be NEW ids in the clone; capture them.
3. **Provision the substrate tenant** (founder go before the write): `clients` row `vip-accounting` with `config.ghl_location_id`, `vertical: accountancy`, `stage_id_to_slug` from the captured pipeline ids, `config.agent` adapted from KST's. Slug discipline: `vip-accounting`, hyphenated, lesson of dental-mastery.
4. **Register the OCT legs** in the substrate for the new slug so the cloned workflows' webhooks land as tasks for the right tenant.

## 4. The campaign track (Oscar's lane, runs in parallel)

1. **Google Ads account**: blocked on §5 question 2. If none exists, create under the MCC; if one exists, link it. Either way the account id lands in `onboarding_state` so Oscar's roster resolves it.
2. **Keyword research** for Essex ltd-co accountancy against the £1,500 budget, answering the client's own open question (county-wide vs town-level start). The questionnaire's negative themes seed the negative list; Oscar's discipline (search-terms-cited negatives only) applies after launch.
3. **Conversion tracking, the part that makes this account different**: phone calls plus Calendly.
   - **Calls**: a UK tracking number for the VIP site, forwarding to their real line. Blocked on the Twilio Local bundle (in review, expected ~Tuesday); VIP joins the purchase list as number three behind the WMI outbound pair. UK-only ruling holds; this is a UK client, so it fits.
   - **Calendly**: keep Calendly, do not force a calendar migration during onboarding; a working client flow beats platform purity. Wire Calendly's webhook into the substrate (the `RCV_dm_ghl_events` pattern), upsert the contact into GHL, and fire the OCT task on booking. Migration to GHL calendar is a later conversation if ever.
4. **Campaign build**: Search-only, Essex, Mon-Fri 9-19, the questionnaire's USPs as ad-copy raw material. Everything created paused; founder activates. Target economics to sanity-check with the client: at £1,500 and plausible accountancy CPCs, expect tens of clicks a week, so the plan should promise learning pace honestly rather than lead volume.

## 5. Questions for the founder or client (only real blockers)

1. **Website domain**, and `dig NS` before anything DNS-shaped is requested of anyone (standing rule).
2. **Google Ads account**: exists or not; if it exists, access route.
3. **The principal's name** and preferred sender identity (the KST nurture pattern sends as a person, not a brand).
4. **Fee model in VIP's words**, for ad copy and the eventual nurture. Do not inherit KST claims.

## 6. What VIP gets that KST could not, worth noticing

KST's nurture sequence is written but blocked on a booking page that does not exist. **VIP has Calendly, meaning a real booking link exists on day one.** The six-email sequence adapts (same objection structure: hassle, cost, "my accountant is fine"), gets VIP facts substituted per §5, and can actually ship here first. The blueprint's missing limb exists at the second client, which is a better proof run than the original.

## 7. Definition of done for this onboarding

Sub-account live with rewired workflows; substrate tenant provisioned and OCT legs registered; Google Ads account linked with conversion actions receiving call-tracking and Calendly events; campaign built and paused awaiting founder activation; PROJECT_STATE updated at each stage. The snapshot `Accountancy Blueprint v1` stored at agency level is a deliverable in its own right: client three starts from it plus this document.

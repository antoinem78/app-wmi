# Buggy Trip Marrakech

**Channel file.** Read `docs/PROJECT_STATE.md` §1, §2 and §7 first; this file is owned by the buggy-trip session. **Assembled 2026-08-15 during the lead-gen split, not moved**: this client had no PROJECT_STATE blob, so the state below is gathered from session history and live reads. Treat undated claims as needing verification.

---

## What this is

Quad and buggy tours in Marrakech, `buggytripmarrakech.com`. **The first waiting client for the WhatsApp attribution bridge**, and the reason the bridge was productised rather than built once for ourselves.

Site is Astro, French-first with English, Spanish and Dutch. DNS at Cloudflare. Google Ads managed under Baptiste's MCC; access route is a manager link request from the SingularWeb MCC (which sits under WMI UK MCC), or Baptiste links it directly and the client is never troubled.

## Where it stands

**Implementation plan written:** `docs/BUGGYTRIP_IMPLEMENTATION_PLAN.md`, which supersedes the Cowork groundwork document on three points (no new widget needs writing, the reference-code approach fails for exactly the reason this client reported, no Zapier layer).

**Proposal written in French** and handed to Baptiste to send. Offered free, for retention; that reason is never stated to the client.

**Not sent, not provisioned.** No tenant row, no CRM sub-account, no number, no widget token.

## The gate nobody has cleared

**Auto-tagging must be confirmed ON in their Google Ads account.** Without it there is no gclid, the bridge captures nothing, and the proposal promises something that cannot happen. Baptiste can check it in a minute and has not. **Do not let the proposal go out before this is confirmed.**

## Decisions the client owes

1. Which WhatsApp number strategy: A, a new number for website enquiries and full automation; B, migrate their existing +212 707 01 44 44 and change how the team replies; C, no inbound integration. **Recommendation is A.**
2. Whether they run Meta ads, since the same capture handles fbclid free.
3. Who can edit the site.
4. Brand colour, and whether the widget is French only or per language.

## Notes that will matter at build time

GDPR is sharper here than for a UK client because the traffic is largely EU tourists. The widget uses `localStorage` rather than a cookie, which does not change the analysis much.

Package values range 400 to 2,500 dirhams, a sixfold spread, so uploading real conversion values rather than a flat number is what lets bidding learn that a Can-Am booking outweighs a quad hour.

**Morocco is not available for Twilio numbers**, so anything telephony-shaped here is not a repeat of the UK pattern.

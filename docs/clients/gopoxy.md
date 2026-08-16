# GoPoxy (gopoxy.co.uk)

**Channel file for the GoPoxy client session.** Read `docs/PROJECT_STATE.md` §1, §2 and §7 first. This file is owned by the GoPoxy session; update it as things land, with cross-cutting items mirrored one-line into PROJECT_STATE.

## The one rule that shapes everything here

**We do not touch the accounts. A freelancer manages them** (founder ruling 2026-08-13). Oscar owns Google analysis, Bernard owns Meta analysis, both stood down to watch-and-flag; recommendations route through the founder to the freelancer. Code's lane: substrate, tracking infrastructure, feeding the agents. Both agents hold this in memory.

## Who and what

- Hybrid: DTC ecommerce (no-mess cartridge grouting system, homeowners + tilers) plus B2B distributor acquisition. Contact: Ryan. UK now; US/CA/AU/NZ expansion intended. ~$8k/month combined spend, scaling ambitions. Scope sold: full paid-media ownership Meta + Google (delivered through the freelancer per the ruling).
- Sales-stage audits and brand/industry docs in `~/Downloads` (GoPoxy Google/Facebook audit PDFs, Brand Information, Industry Research). Brand doc carries claims guidance: "low-porosity", "resistant to", "designed for"; never stain-proof/mould-proof/maintenance-free/guaranteed.

## Day-one baseline (verified read-only 2026-08-13; full doc `~/Documents/REPORT_gopoxy_baseline_2026-08-13.md`)

- **Google (CID 2089676707, GBP, live under our MCC):** 90d £19,864 / £101,604 / ROAS 5.11; last-30d **4.37** vs the audit's pitched 4.91 (improvement measured from 4.37). Brand 25.6% spend at 7.39 carrying 37.0% of value. **Standard Shopping UK (40.3% of spend, 4.72) is BUDGET_CONSTRAINED at £110/day: the cheapest scaling lever.** TWO primary conversion actions (purchase + Contact us): the hybrid value-blend needs a founder ruling before scaling. AU Shopping live at £10/day, no value yet. Merchant Center 5357203003; catalog 23 offers, healthy.
- **Meta (act_282111861642935, visible to Bernard's system user):** 30d £7,110 / 363 purchases / 4.36; **frequency 7.56 and worsening**; the only retargeting ad set includes all four warm audiences under Advantage+ (suggestions, not controls), so no true retargeting; duplicate "Broad | DIY Interests" ad sets in one CBO; legacy pixel is a trickle, the Shopify pixel carries everything; site funnel healthy (17.6% VC→ATC).

## The account stepped down on 31 July, on both platforms, and it is not an ad-account problem (found 2026-08-15)

Watch pass on 2026-08-15 compared two matched 15-day windows, A = 16-30 July against B = 31 July-14 August. Both platforms broke downward on the same date.

| | Spend A → B | Value A → B | ROAS A → B | AOV A → B |
|---|---|---|---|---|
| **Google** | £3,271 → £4,049 (+24%) | £19,064 → £13,178 (-31%) | **5.83 → 3.25** | £87 → £79 |
| **Meta** | £3,507 → £3,507 (flat) | £17,224 → £13,777 (-20%) | **4.91 → 3.93** | £96 → £75 |

Combined ad-attributed value fell from £36,288 to £26,955, down 26%, on 11% more spend.

**The shared mechanism is basket value, not the ad accounts.** Meta's spend was identical across both windows and its purchase count actually rose slightly (179 → 184), so its entire loss is AOV, down 22%. High-value order days simply stop after 30 July: window A has days at £218, £172 and £135 average order value, window B has one day above £106. Google shows the same AOV fall plus a conversion-rate fall of its own (clicks up 16%, purchases down 24%, so site conversion from Google traffic went 12.4% to 8.1%).

**Ruled out as causes.** Conversion lag: the fully matured sub-window 31 July-7 August alone reads 3.25 on Google, so this is not unreported conversions. Freelancer activity: 18 change events in 29 days, the last structural one on 23 July (two negative keywords) and a single target-ROAS edit on 4 August by sam@Scalemarketing.co.uk, all either side of the break rather than on it. Platform delivery: impressions and clicks rose, CPCs held.

**What it points at.** Something on the site, the offer, pricing or stock changed around 30-31 July, and it hit high-value and bulk orders hardest. Suggestive but not established: `GoPoxy Poly Grout White 01 (Box of 24)` converted once at £627 in window A and not at all in window B, and the trade-facing "Box of 30" SKUs draw impressions but record essentially no conversions in either window. That is the tiler and distributor half of the business.

**Two related measurement facts found on the way.** The `Contact us` primary conversion action recorded ZERO conversions in 30 days, so the B2B leg is currently invisible in Google and the two-primaries value-blend risk is inert rather than active for now. And `begin_checkout` (173) reads lower than `purchase` (218.7) in window A, which is impossible in a real funnel and points at express checkout routes such as Shop Pay bypassing the event.

**This resets the engagement baseline.** The day-one doc recorded last-30d Google 4.37 against a pitched 4.91 and read it as mild drift. It was not drift, it was a step, and a 30-day average smeared it. The honest current run rate at handover is **Google ~3.25, Meta ~3.93**, not 4.37/4.36. Improvement must be measured from those, and the decline predates the engagement by two weeks, which is on record here.

**Blocked on access, and this raises the priority.** Confirming the cause needs Merchant Center 5357203003 (grant still pending) and GA4 or Shopify, neither readable from here. The single fastest answer is a question to Ryan: what changed on the site, the pricing, the stock or the promotions around 30-31 July.

## Merchant Center and storefront, read 2026-08-15: a stock lie and a price lie

With GMC access confirmed, the feed was joined against the public storefront (`9d94f0.myshopify.com`, shopId 78092501319). Two mismatches, in opposite directions.

**1. The feed says in stock, the shop says sold out, on the account's biggest spender.** Storefront shows `GoPoxy Epoxy Grout` variants `02 - Light Ivory` and `12 - Gloss Black` unavailable. Merchant Center has Gloss Black correctly `OUT_OF_STOCK` but still carries **Light Ivory as `IN_STOCK`**. Light Ivory is the single largest product line in Shopping: £913 spend and 533 clicks in the 31 July-14 August window, with conversion rate falling 7.6% to 4.9% across the break.

**2. The feed carries pre-discount prices on the only three discounted SKUs.** Storefront `compare_at_price` shows these three, and only these three, are on sale: Box of 30 £637.50 (was £750), Poly Grout Box of 24 £612 (was £696), Electric Applicator Kit £169 (was £199). Merchant Center advertises £750, £696 and £199. Joined against the spending surface per the standing rule, this costs very little today (those SKUs drew roughly £50-80 per window and almost no conversions), so it is a hygiene and disapproval risk, **not** a revenue finding, and must not be written up as one.

**Working hypothesis for the 31 July step-down, not yet established.** One site fact would explain both platforms at once: the most popular colour goes out of stock, the feed keeps saying otherwise, so Google keeps buying clicks onto a variant nobody can buy (conversion rate falls), and multi-colour buyers assemble smaller baskets (AOV falls on Meta too, which is the part no ad-account change could cause). It fits every observation including Meta's purchase count holding while its basket value fell. **What it needs to become a finding is the date Light Ivory went out of stock.** If that is 30-31 July, the case is closed. If it is recent, the hypothesis dies and the AOV question is still open. Shopify is the surface that answers it.

## Watch-items held by the agents (for founder-to-freelancer relay, not action)

0. **The 31 July step-down, above. Highest value item on the account and it is not the freelancer's to fix.**
1. The UK Shopping budget constraint (Oscar). Note it now scales a 2.88-ROAS Shopping campaign rather than the 4.72 recorded on day one, so it is no longer unambiguously the cheapest lever.
2. AU spending ahead of a formal expansion green-light: kill or formalise with feed/shipping/geo done together (Oscar).
3. The Advantage+ retargeting fix and frequency consolidation (Bernard).
4. The two-primaries ruling (founder decision, unblocks any Search-side advice).

## Access state

Google and Meta: in and verified. **GMC 5357203003: IN. Tested 2026-08-15 and it reads (`accounts/v1` returns "GoPoxy"; the identity sees House of Isabella 137224936, GoPoxy 5357203003 and Xinzuo 5679526637).** The earlier "not yet readable, pending a user-add" note in this file was stale and was repeated without being tested; the local refresh token was re-minted with the `content` scope on 2026-08-12, which is what changed. Lesson: test the surface, do not inherit an access claim from a doc. GA4/GTM: still unestablished from this machine.

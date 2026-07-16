# Audit methodology and diagnostic playbook

Grounded in the OASES audit (Google Ads account 766-064-2672). Use this as the
checklist and the "what good looks like" reference.

## 1. Business understanding (before touching the account)

Capture from the website and socials:
- What they sell and the distinct products/modules (these become campaign themes).
- ICP: the actual job titles who buy (e.g. Technical Director, Head of
  Airworthiness, CAMO manager) and the company types/sizes.
- Geography and primary markets.
- The single most valuable conversion (demo / quote / enquiry) and the form fields.
- The CRM (e.g. HubSpot) and whether offline conversion tracking is plausible.
- Lead-gen friction on site (form length, qualification fields, instant booking,
  phone number, pricing transparency, proof/testimonials). Feeds the CRO doc.

## 2. Data Extraction Checklist (live account, read-only)

Use Claude in Chrome. Resize the window to ~1440x900 for legible captures. For
each screen, set the date range deliberately (all-time for lifetime totals; a
recent active period such as the last 90 active days for "what is firing now").

Pull and record:

| Screen | What to capture |
|---|---|
| Overview / Campaigns table (all time) | Spend, impressions, clicks, CTR, avg CPC, conversions, conv rate, cost/conv, conv value. Per-campaign: name, type, bid strategy, cost, clicks, conv, cost/conv. |
| Campaign names | Decode the naming convention. Watch for network tags (e.g. "[S&D N]" = Search & Display), match-type tags ([EM]/[PM]), geo segments. |
| Networks segment | Segment campaigns by "Network (with search partners)" to quantify Google Search vs Search Partners vs Display spend. |
| Goals > Conversions (Summary) | Every conversion action: name, source (Website/GA4/Google hosted/Call/YouTube/Floodlight), Primary vs Secondary, status (Active/Inactive/Needs attention), which goal group, # campaigns applied to. |
| Conversions, recent active period | "View all conversion actions" + a recent date range. Count total conversions and how many actions fired. Note duplicates and per-page/per-module form actions. |
| Search terms report | Sort by clicks/cost. Quote the actual irrelevant queries (jobs, news, off-topic, competitor brands). Note total distinct terms. |
| Auction insights | Domains, impression share, overlap, position-above, top-of-page. Separate genuine competitors from peripheral overlap. |
| Assets / extensions | Which extension types exist/approved (sitelinks, callouts, snippets, image, business name/logo, call, lead form, price, promotion). |
| Audiences | Remarketing lists, in-market/custom segments, observation vs targeting. |

## 3. Failure-Pattern Playbook (the recurring killers)

For each, the **tell**, the **evidence to capture**, and the **fix**.

1. **Search running on Display + Search Partners.**
   Tell: 10M+ impressions, avg CPC under ~£0.20, CVR under 0.5%, campaign name
   contains a Display/network tag. Evidence: per-campaign impressions vs clicks
   vs conv. Fix: Search-only networks; rebuild cleanly.

2. **Bidding optimised to low-value conversions.**
   Tell: page view / engagement / video view set as Primary across all
   campaigns; the real lead action applied to 0 campaigns. Evidence: the
   conversion actions table with Primary/Secondary + #campaigns. Fix: one
   primary demo-request goal; everything else secondary.

3. **Conversion-action sprawl.**
   Tell: many actions (15+), a separate form action per page/module, several
   Inactive or Needs attention, almost all Primary. Evidence: full action list
   for a recent period + total conversions. Fix: consolidate to one clean goal.

4. **No value / no OCT.**
   Tell: total conv value ~0; CRM not connected. Fix: OCT (see section 5).

5. **Broad, unprotected keywords.**
   Tell: junk search terms; no account-level negative list. Evidence: quote real
   queries. Fix: phrase/exact at launch + layered negatives.

6. **Structure, brand, PMax.**
   Generic "all solutions" (no granularity by product/buyer); brand on a Smart
   campaign; PMax recording many ~£0.30 conversions (manufactured); thin assets.

## 4. Negative keyword strategy (always recommend)

- **Account-level shared lists**: employment (jobs, salary, vacancy, career,
  recruitment), education (course, training, certification, degree) where
  unrelated, price/noise (free, open source, crack, download, template),
  off-topic maintenance contexts (car, vehicle, truck, HGV, facilities, plant,
  generic CMMS), and a consumer/hobby list (drone, RC, model, simulator, gaming).
- **Competitor brand negatives** in generic + brand campaigns, routed instead to
  a dedicated competitor (conquesting) campaign.
- **Ongoing mining**: weekly search-terms review in early months; promote
  converting terms to exact match.

## 5. Offline Conversion Tracking (explain it properly, every time)

OCT closes the loop between an ad click and what it is worth.
1. On click, Google attaches a **GCLID** to the click.
2. Capture the GCLID on the lead form; store it on the contact in the CRM.
3. As the contact progresses, send each stage back to Google Ads against the
   GCLID: **MQL -> SQL -> Opportunity -> Closed-won**, with values.
4. Smart bidding then optimises toward real pipeline/revenue, not form fills.
This is more than CRM tagging; the funnel feedback is the whole point.

## 6. Competitor & keyword research

- Competitors: name the real field, classify each by relevance and paid-search
  behaviour, and reconcile against the account's **auction insights**.
- Keywords: short high-intent list with estimated monthly volume, competition
  and CPC range (UK + international English). Frame volume as estimates refined
  against Keyword Planner during onboarding. Separate core, module-specific and
  compliance terms. Volume is low and that is fine; intent is what matters.

## 7. Forecast (bottom-up, Google Ads focused)

Three scenarios (Conservative / Base / Stretch). For each: monthly media,
realistic avg CPC for clean high-intent search, clicks = media/CPC, demo CVR
(2-3.5% for a qualified B2B landing page), demo requests = clicks x CVR, cost
per demo. State that search volume is the binding constraint and that the
website (CRO) is the biggest lever. Report deeper down the funnel once OCT data
exists. Never use round, optimistic numbers; show the arithmetic.

## 8. Management & set-up framing

One-off set-up fee + monthly management. Explain the set-up fee covers an
intensive first two weeks: deeper research, access provisioning, onboarding
questionnaire, comms channel setup, granular account build, CRM integration and
full conversion + offline tracking. Roughly a month of focused work compressed
into the opening phase, which is why it is a one-off rather than in the retainer.

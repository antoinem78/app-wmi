# Handover — Port the Reporting + Billing evolution to PPC Mastery & BJ Command Center

**Audience:** Claude Code, running in the **PPC Mastery** workspace (and, separately, the **BJ PPC MCC Command Center** repo).
**Reference implementation:** the `app-wmi` repo (single-tenant WMI portal, harvested from PPC Mastery). Everything below was built and verified live there across commits **`9eb592c` … `e03f89d`** on top of the WMI-harvest base `f10cf8b`.
**Goal:** reproduce the same *behaviour* in each target repo. Do **not** blindly copy files — adapt to each repo's branding/auth/billing (see §8). PPC Mastery is the parent these files were harvested from, so paths and shapes should match closely.

> Read `AGENTS.md` first. These repos run a **non-standard Next.js** (App Router; middleware is `proxy`; route `context.params` is a Promise). Read `node_modules/next/dist/docs/` before writing Next code. The Google Ads layer is **hand-rolled REST** (no SDK), GAQL via a `gaqlSearch()` helper.

---

## 1. What "the evolution" is (two independent workstreams)

**A — Reporting modernization** (apply to BOTH PPC Mastery and BJ Command Center):
1. Account-wide, **multi-channel** KPIs (Search + Performance Max + Demand Gen + Shopping + Display + Video), not Search-only.
2. **By-Time** metrics (conversion-date basis): conversions, revenue, ROAS — alongside the interaction-date figures.
3. **Monday–Sunday** week as the report period (not rolling "last 7 days").
4. **Conversions-by-action** breakdown + a dedicated paragraph in the narrative.
5. Weekly narrative rewritten to the **Swydo report standard**, wrapped in an email greeting + sign-off.
6. Dashboard sections: **Campaign performance** grid (this/prior/%Δ), **Top performing ads**, **Auction insights** (impression-share suite), **Month performance** (6-month history); wider layout, no truncation, scrollable.

**B — Billing additions** (apply ONLY where an onboarding/payment funnel exists — PPC Mastery yes; BJ Command Center probably **not**, it's a reporting/management tool):
7. Admin **"Mark as paid — bank transfer"** override (unlocks onboarding without Stripe).
8. **Customizable contract start date** for bank-transfer clients (new DB column).

Files touched (all under `src/`, plus one migration):
| File | Workstream |
|---|---|
| `lib/integrations/google-ads/reporting.ts` | A (data layer — the bulk) |
| `lib/integrations/anthropic/narrative.ts` | A (LLM narrative) |
| `components/AdsDashboard.tsx` | A (dashboard UI) |
| `app/api/cron/weekly-reports/route.ts` | A (cron — fetch contact_name; surface Slack failures) |
| `app/onboarding/[id]/page.tsx` | A (widen dashboard shell) + B (mark-paid form) |
| `app/(admin)/clients/[id]/page.tsx` + `../actions.ts` | B |
| `supabase/migrations/0014_service_start_date.sql` (+ consolidated) | B |

---

## 2. Data layer — `reporting.ts`

### 2.1 Filters & channel labels
- Keep a Search-only filter for inherently-Search signals; make everything else account-wide:
  ```ts
  const SEARCH_FILTER = "campaign.advertising_channel_type = 'SEARCH' AND campaign.status != 'REMOVED'";
  const ACTIVE_FILTER = "campaign.status != 'REMOVED'"; // account-wide
  ```
- Add a `advertising_channel_type` → friendly label map (`SEARCH`→"Search", `PERFORMANCE_MAX`→"Performance Max", `DEMAND_GEN`/`DISCOVERY`→"Demand Gen", `SHOPPING`, `DISPLAY`, `VIDEO`, etc.) and a `channelLabel(t?)` helper.

### 2.2 Monday–Sunday window (the report period)
`windows(tz, windowDays)` special-cases the 7-window to the **most recent COMPLETE Mon–Sun**; larger windows stay rolling "last N days":
```ts
if (windowDays === 7) {
  const dow = today.getUTCDay();                 // 0=Sun … 6=Sat
  const backToSunday = dow === 0 ? 7 : dow;       // days back to last completed Sunday
  const end = addDays(today, -backToSunday);      // Sunday
  const start = addDays(end, -6);                 // Monday
  const prevEnd = addDays(start, -1);             // previous Sunday
  const prevStart = addDays(prevEnd, -6);         // previous Monday
  return { start: fmt(start), end: fmt(end), prevStart: fmt(prevStart), prevEnd: fmt(prevEnd) };
}
```
`buildWeekly()` and the dashboard's 7-day view both call `windows(tz, 7)`, so the weekly report, the narrative period, and the "Week" dashboard tab all align to Mon–Sun automatically.

### 2.3 Per-campaign accumulator (drives the Campaign performance grid)
In `campaignTotals()`, the campaign query already selects impressions+clicks — **retain them per campaign** (the original dropped them):
```ts
byName[name] ??= { channel, spend: 0, impressions: 0, clicks: 0, conversions: 0, convValue: 0 };
byName[name].spend += c; byName[name].impressions += im; byName[name].clicks += ck;
byName[name].conversions += cn; byName[name].convValue += cv;
```
`getDashboard`/`buildDashboard` already calls `campaignTotals` for the current **and prior** window (`cur`, `prev`), so prior-period per-campaign data is free. Build a Swydo grid by joining cur/prev by name, each metric as a `Kpi{value,prev,deltaPct}`:
```ts
const campaignPerformance = Array.from(new Set([...Object.keys(cur.byName), ...Object.keys(prev.byName)]))
  .map((name) => {
    const c = cur.byName[name] ?? empty, p = prev.byName[name] ?? empty;
    return {
      name, channel: (cur.byName[name] ?? prev.byName[name] ?? empty).channel,
      clicks: kpi(c.clicks, p.clicks), impressions: kpi(c.impressions, p.impressions),
      ctr: kpi(ctrOf(c.clicks,c.impressions), ctrOf(p.clicks,p.impressions)),
      avgCpc: kpi(ratio(c.spend,c.clicks), ratio(p.spend,p.clicks)),
      cost: kpi(c.spend, p.spend), conversions: kpi(c.conversions, p.conversions),
      costPerConv: kpi(ratio(c.spend,c.conversions), ratio(p.spend,p.conversions)),
      convRate: kpi(cvrOf(c.conversions,c.clicks), cvrOf(p.conversions,p.clicks)),
    };
  }).sort((a,b) => b.cost.value - a.cost.value).slice(0, 15);
```

### 2.4 By-Time metrics (conversion-date basis)
`campaignTotals` selects `metrics.conversions_by_conversion_date` + `metrics.conversions_value_by_conversion_date`; sum into `convByTime`/`convValueByTime`. Expose KPIs:
```ts
conversionsByTime: kpi(cur.convByTime, prev.convByTime),
convValueByTime:  kpi(cur.convValueByTime, prev.convValueByTime),
roasByTime:       kpi(ratio(cur.convValueByTime, cur.spend), ratio(prev.convValueByTime, prev.spend)),
aov:              kpi(ratio(cur.convValue, cur.conversions), ratio(prev.convValue, prev.conversions)),
```
Also add top-level `avgOrdersPerDay = cur.conversions / windowDays` and `avgRevenuePerDay = cur.convValue / windowDays`.
> **Verified:** By-Time matched the real House of Isabella Swydo report exactly (132.98 conv / 52,026.47 value / 5.85 ROAS). Interaction-date matures over time, which is why both bases are shown.

### 2.5 New GAQL queries (add to the `Promise.all` in `buildDashboard`)
All run through `gaqlSearch(customerId, query)` = **exactly one** request each (non-streaming `googleAds:search`, no pagination loop; keep `LIMIT` on unbounded queries).

**Conversions by action** (account-wide):
```sql
SELECT segments.conversion_action_name, metrics.conversions, metrics.conversions_value
FROM campaign WHERE segments.date BETWEEN '{start}' AND '{end}' AND campaign.status != 'REMOVED'
```

**Top performing ads** (RSA headlines + per-ad metrics; rank by conversions):
```sql
SELECT campaign.name, ad_group_ad.ad.type, ad_group_ad.ad.name,
       ad_group_ad.ad.responsive_search_ad.headlines, ad_group_ad.ad.final_urls,
       metrics.impressions, metrics.clicks, metrics.cost_micros,
       metrics.conversions, metrics.conversions_value
FROM ad_group_ad
WHERE segments.date BETWEEN '{start}' AND '{end}'
  AND ad_group_ad.status != 'REMOVED' AND campaign.status != 'REMOVED'
ORDER BY metrics.conversions DESC LIMIT 10
```
Parse REST camelCase: `r.adGroupAd.ad.responsiveSearchAd.headlines[].text` (join leading 2–3), fall back to `ad.name`/`ad.type`; `ad.finalUrls[0]`.

**Auction insights = impression-share suite** (Search only; impression-weighted). ⚠️ **The Google Ads API does NOT expose the real Auction Insights report** (competitor domains / overlap / outranking) — there is no queryable resource. This is the only programmatic equivalent; label it as such in the UI.
```sql
SELECT metrics.impressions, metrics.search_impression_share,
       metrics.search_absolute_top_impression_share, metrics.search_top_impression_share,
       metrics.search_rank_lost_impression_share, metrics.search_budget_lost_impression_share
FROM campaign WHERE segments.date BETWEEN '{start}' AND '{end}' AND {SEARCH_FILTER}
```

**Month performance** (last 6 calendar months incl. current partial; independent of the selected window):
```sql
SELECT segments.month, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions
FROM campaign WHERE segments.date BETWEEN '{firstOfMonth-5}' AND '{yesterday}' AND campaign.status != 'REMOVED'
ORDER BY segments.month
```
`segments.month` returns `YYYY-MM-01`; format with `Intl.DateTimeFormat("en-US",{timeZone:"UTC",month:"long",year:"numeric"})`; sort keys descending (most recent first).

### 2.6 Channel-aware change classification
`classifyChange(ce, channelType)` must be channel-aware: on **non-Search** campaigns, `AD_GROUP_CRITERION` changes are "product/listing groups", **not** "keywords". Add cases for `ASSET_GROUP`, `ASSET_GROUP_LISTING_GROUP_FILTER`, `FEED`. `getWeeklyOptimisations()` and `changeSummary()` pass the campaign's channel through. (This fixed the reported mis-labelling where PMax/Shopping changes were called "keywords".)

### 2.7 `DashboardPayload` additions
Add: `byChannel[]`, `byCampaign[].channel`, `campaignPerformance[]`, `byConversionAction[]`, `topAds[]`, `impressionShare{impressionShare,absoluteTop,top,rankLost,budgetLost}`, `monthPerformance[]`, and kpis `conversionsByTime/convValueByTime/roasByTime/aov`, plus top-level `avgOrdersPerDay/avgRevenuePerDay`. **`getDashboard` is the only constructor** — every consumer treats it as `DashboardPayload | null`, so a single return-shape update suffices.

---

## 3. Narrative — `narrative.ts` (the Swydo standard, wrapped in an email)

The original "house format" (greeting → Date Range → Stats → Summary → Optimisation → sign-off) was **wrong**. The standard is the **Swydo report**: a titled report (scorecard → analytical Summary → conversions-by-action → granular optimisations), then per Antoine, **wrapped** in a warm greeting + sign-off because the message carries the portal link (the visual tiles/tables live on the portal).

**`factsBlock(payload, companyName, optimisations, contactName)`** pre-formats *every* figure so the LLM copies, never computes. It must include:
- Title `"{company} Google Ads Report"`, currency, and a **pretty date range** + the **prior range** ("Jun 8 – 14, 2026 compared to Jun 1 – 7, 2026"). Build pretty ranges from parts with `en-US` (`"{Mon} {d} – {d}, {yyyy}"`; collapse same month/year). Compute the prior window as the 7 days before `weekly.start`.
- A SCORECARD block (impressions, clicks, CTR, avg CPC, cost, conversions, CPA, conv rate, + revenue/ROAS/AOV when `hasConversionValue`, + all three By-Time lines).
- BY CHANNEL TYPE, TOP CONVERTING CAMPAIGNS, ALL CAMPAIGNS, TOP SEARCH TERMS (Search-only), DEVICE SPLIT, **CONVERSIONS BY ACTION**, and the OPTIMISATIONS change log (capped ~15).
- The contact first name for the greeting only (fall back to "there").

**`SYSTEM(brand)` output structure** (Slack formatting: `*bold*` titles, `- ` bullets, no `#`, no tables):
```
Hi <first name / there>,
<one lead-in line pointing to the dashboard for the full visual breakdown>

*<Account> Google Ads Report*
<period> compared to <prior period>

*Performance*        → scorecard bullets; ALWAYS include the 3 By-Time lines when present
*Summary*            → flowing prose: headline movement + ATTRIBUTION, CPA/conv-rate trends,
                       channel/segment mix, standout campaign, forward-looking next step
*Conversions by action*  → standalone paragraph: count + value per action, primary vs secondary
*Last Week's Optimisations* → verbatim boilerplate line + first-person "I have …" specifics

<warm close + "the full visual report is on your dashboard"> 
Best regards, / The <brand> Team
```
**Hard rules in the prompt:** use ONLY the given figures (never invent/recompute); attribute channels correctly (never call PMax/Shopping "Search" or product groups "keywords"); Search-impr-share & search-terms are Search-only; show both conversion bases; omit revenue/ROAS/AOV if not tracked; **never fabricate old→new budget/Target-CPA values, MTD spend, or targets** (we don't have them); it's a draft a human reviews.

Boilerplate optimisation sentence (verbatim): *"Regular account optimisations including bid management, adding new keywords from search terms, adding new negative keywords, resolving ad split tests, creating new ads for split-testing purposes, improving underperforming assets, creating new ad groups for top converting search terms."*

`brand` comes from `entityConfig.brandName` — **this is the main per-repo difference** (see §8).

---

## 4. Dashboard — `AdsDashboard.tsx`
- KPI hero + secondary cards, trend chart (keep).
- **Campaign performance** grid: full metric set per campaign, each cell = value + %Δ chip (reuse the `Delta`/`Kpi` rendering; cost-type metrics treat "down" as good). First column **wraps** (`break-words`, fixed width ~22rem), no `truncate`. Wrap the table in `overflow-x-auto` + `min-w-[900px]`.
- **Top performing ads** table (headline wraps; campaign + final URL caption; impr/clicks/CTR/conv/cost/value).
- **Auction insights** tiles (impr share, abs-top, top, lost-to-rank, lost-to-budget) with the "competitor data not available via API" footnote; render only when `impressionShare.impressionShare > 0`.
- **Month performance** table (Month·Clicks·Impr·CTR·Avg CPC·Cost·Conv·Cost/conv), most recent first.
- Layout: promote the campaign grid to **full width**; stack the smaller breakdowns (conversions-by-action, device, search terms) **below** in a 2-col grid — "scroll for detail, don't pack".
- Range buttons: label the 7-window **"Week"** (it's Mon–Sun now), keep 28d/90d.
- **Container width:** the pure-dashboard view must not be squeezed. In `onboarding/[id]/page.tsx` give the dashboard `Shell` a `wide` variant (`max-w-6xl` vs the funnel's `max-w-2xl`). (This was the real cause of "changing the date range doesn't change the data" — the data did change; the cramped shell hid it.)

---

## 5. Cron — `app/api/cron/weekly-reports/route.ts`
- Select `clients(company_name, contact_name)`; pass `companyName` + `contactName` into `generateNarrative(dash, companyName, optimisations, contactName)`.
- **Surface Slack delivery failures** — increment a `slackFailed` counter + collect `slackErrors`, and only count `sent` when actually delivered. (A wrong channel or uninvited bot must not look like success. In `app-wmi` the original bug was a channel *name* that didn't resolve + swallowed errors — use the channel **ID**.)

---

## 6. Billing — workstream B (skip for BJ Command Center unless it has the funnel)

### 6.1 Migration `0014_service_start_date.sql` (run in the Supabase SQL Editor, BOTH projects)
```sql
alter table onboarding_state add column service_start_date date;
```
Also add the column to `_consolidated_fresh_install.sql`. **DDL can't be run via the supabase-js client** (and new `sb_secret_` keys are rejected on raw REST) — the human runs this in the dashboard.

### 6.2 `markPaidManually(formData)` (admin action, `app/(admin)/clients/actions.ts`)
Mirrors the Stripe success path so onboarding unlocks identically:
```ts
export async function markPaidManually(formData: FormData): Promise<void> {
  const { email: adminEmail } = await requireAgencyAdmin();
  const clientId = String(formData.get("client_id") ?? "").trim();
  const reference = String(formData.get("reference") ?? "").trim();
  const startDateRaw = String(formData.get("start_date") ?? "").trim();
  if (!clientId) throw new Error("Missing client id.");
  let serviceStartDate: string | null = null;
  if (startDateRaw) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDateRaw) || Number.isNaN(Date.parse(startDateRaw)))
      throw new Error("Contract start date must be a valid date (YYYY-MM-DD).");
    serviceStartDate = startDateRaw;
  }
  const supabase = createSupabaseAdminClient();
  const { data: state } = await supabase.from("onboarding_state")
    .select("payment_status").eq("client_id", clientId).single();
  if (state?.payment_status === "paid") { revalidatePath(`/clients/${clientId}`); return; } // no double-record
  const { error } = await supabase.from("onboarding_state")
    .update({ payment_status: "paid", current_step: "complete", service_start_date: serviceStartDate })
    .eq("client_id", clientId);
  if (error) throw new Error(error.message);
  await logActivity({ clientId, eventType: "payment_marked_manual", actor: `admin:${adminEmail}`,
    payload: { method: "bank_transfer", reference: reference || null, service_start_date: serviceStartDate } });
  revalidatePath(`/clients/${clientId}`); revalidatePath(`/onboarding/${clientId}`);
}
```
**Why this works:** the entire post-payment flow gates on `onboarding_state.payment_status === "paid"` (the Stripe finalize sets exactly `payment_status:"paid", current_step:"complete"`). Setting the same flags unlocks everything; Stripe is never invoked.

### 6.3 Admin UI (`app/(admin)/clients/[id]/page.tsx`)
An amber "Paid by bank transfer?" `<form action={markPaidManually}>` in the Onboarding card, shown only while `payment_status !== "paid"`: hidden `client_id`, a **Contract start date** `<input type="date">` defaulting to the 1st of next month, an optional reference text input, and a `ConfirmSubmitButton`. Compute the default server-side:
```ts
const firstOfNextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth()+1, 1)).toISOString().slice(0,10);
```
Show `service_start_date` as a "Contract start" row in Details once set. Blank date → starts today.

---

## 7. Gotchas (bit us in app-wmi)
- **`segments.month` + `segments.date` filter** coexist fine in one query (verified live).
- **REST shapes are camelCase** (`adGroupAd.ad.responsiveSearchAd.headlines`, `searchTermView.searchTerm`, `metrics.costMicros`) even though GAQL is snake_case.
- **`Date` is fine in app code** (only Workflow scripts forbid argless `new Date()`).
- **No UTF-8 BOM** in `.sql` files (Supabase errors `syntax error at or near "﻿"`). Write BOM-free ASCII.
- **Dashboard cache** (`ads_report_cache`, 30-min TTL, PK `(client_id, window_days)`): after a shape change, clear it so the portal re-pulls the new payload.
- **API volume is safe:** one dashboard build ≈ 14 calls; a full batch ≈ 16/client; all read-only; well under quota. Read volume never bans an *advertiser account* — that's billing/policy or dev-token/RMF issues. Don't worry, but keep the 30-min cache + bounded concurrency.

---

## 8. Per-repo adaptations
| Concern | PPC Mastery | BJ PPC MCC Command Center |
|---|---|---|
| **Reporting workstream (A)** | Apply in full | Apply in full — it's an MCC tool, the multi-channel/By-Time/Swydo fixes matter most here |
| **Billing workstream (B)** | Apply (it has the onboarding funnel) | **Skip** unless it actually has the Stripe/PandaDoc onboarding funnel + `onboarding_state.payment_status` |
| **Brand name** (`entityConfig.brandName`, sign-off "The X Team") | PPC Mastery's brand | BJ's brand |
| **Currency** | No change needed — driven per-account by `customer.currency_code` | same |
| **Auth roles claim** | `https://ppcmastery.app/roles`, role `agency_admin` | confirm BJ's claim/role before relying on `requireAgencyAdmin()` |
| **Slack review channel** | use the channel **ID**, not name | same; confirm BJ's channel ID |
| **Account scope** | per-client leaf account | BJ runs many accounts under one MCC — confirm `getDashboard` is called per leaf customer id |

Confirm each repo's `reporting.ts` / `narrative.ts` / `AdsDashboard.tsx` still have the same structure before editing (they share lineage but may have diverged). When a target file differs, port the *behaviour* from §2–§6, not the literal lines.

---

## 9. Verification recipe (no test framework needed)
Node is installed locally; run TS via a throwaway `tsx` (the repos have path alias `@/* → src/*`):
```
npm i tsx --no-save        # then npx tsx scratch-*.ts ; remove + npm uninstall tsx after
```
1. **Typecheck:** `npx tsc --noEmit` after every file.
2. **Narrative format:** build a representative `DashboardPayload` (multi-channel, `hasConversionValue:true`) and call `generateNarrative(...)`; confirm the Swydo structure + all 3 By-Time lines + the conversions-by-action paragraph + greeting/sign-off.
3. **Live GAQL:** pick one real account, delete its `ads_report_cache` row, call `getDashboard(clientId, reportingId, 7)`; confirm Mon–Sun range, `impressionShare`, `topAds`, `monthPerformance`, `campaignPerformance` all populate. (In app-wmi: Belgravia → wk Jun 15–21, IS 45.9%, 52% lost-to-rank, 10 ads, 6 months.)
4. **Billing write path (safe):** run the exact `markPaidManually` update against a **non-existent** client id — 0 rows touched but it validates the column/statement against the live schema.

Load env in scratch scripts by parsing `.env.local` manually (no `dotenv` dep) **before** dynamic-importing app modules.

---

## 10. Suggested commit order (mirrors app-wmi `9eb592c…e03f89d`)
1. Account-wide multi-channel KPIs + channel-aware change labels
2. By-Time metrics + AOV/orders-per-day
3. Conversions-by-action breakdown
4. Narrative → Swydo standard, then wrap in greeting + sign-off
5. Mon–Sun weeks
6. Campaign performance grid → Top ads + Auction insights → Month performance
7. Wider dashboard shell + layout
8. (PPC Mastery only) bank-transfer mark-paid → contract start date (+ migration)

Deploy per repo's flow; after reporting changes, **clear `ads_report_cache`** and (optionally) re-run the weekly batch to review drafts. Keep `entityConfig`, auth claim, and Slack channel ID correct for the target.

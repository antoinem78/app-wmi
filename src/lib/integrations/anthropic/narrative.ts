// LLM-worded performance narrative (weekly by default, but period-aware — the
// same engine writes the monthly / custom-range report). The figures are ALL
// computed in the data layer (reporting.ts); Claude only turns the verified
// facts into prose in the voice of a senior account manager. It never computes
// or invents a number.
//
// Gated on ANTHROPIC_API_KEY — without it, callers fall back to the bulleted
// template (formatWeeklyText).
import Anthropic from "@anthropic-ai/sdk";
import type { DashboardPayload, Kpi, DashRange } from "../google-ads/reporting";
import { entityConfig } from "@/lib/config";

const MODEL = "claude-opus-4-8";

// Describes the reporting window in words so the narrative reads naturally for
// a week, a calendar month, a rolling window, or a custom range.
export interface ReportPeriod {
  /** Singular noun, upper-cased for section headers: "week" | "month" | "period". */
  unit: string;
  /** How to name the comparison window: "prior week" | "prior month" | "prior period". */
  prior: string;
  /** Natural phrase for the lead line: "the past week" | "last month" | "the last 14 days". */
  span: string;
  /** Client-facing optimisations heading: "Last Week's Optimisations" | "Last Month's Optimisations". */
  optimisationsHeading: string;
}

const WEEK_PERIOD: ReportPeriod = {
  unit: "week",
  prior: "prior week",
  span: "the past week",
  optimisationsHeading: "Last Week's Optimisations",
};

/** Build the wording descriptor for a selected dashboard range. */
export function periodForRange(range: DashRange): ReportPeriod {
  switch (range.kind) {
    case "week":
      return WEEK_PERIOD;
    case "month":
      return {
        unit: "month",
        prior: "prior month",
        span: "last month",
        optimisationsHeading: "Last Month's Optimisations",
      };
    case "rolling":
      return {
        unit: "period",
        prior: "prior period",
        span: `the last ${range.days} days`,
        optimisationsHeading: `Optimisations — last ${range.days} days`,
      };
    case "custom":
      return {
        unit: "period",
        prior: "prior period",
        span: "the selected period",
        optimisationsHeading: "Optimisations This Period",
      };
  }
}

function deltaPhrase(k: Kpi, prior: string): string {
  if (k.deltaPct == null) return "no prior-period baseline";
  const dir = k.deltaPct >= 0 ? "up" : "down";
  return `${dir} ${Math.abs(k.deltaPct).toFixed(0)}% vs the ${prior}`;
}

// Turn the verified payload into a compact, unambiguous facts block. Every
// number Claude is allowed to use appears here, pre-formatted — so it copies
// rather than computes.
function factsBlock(
  p: DashboardPayload,
  companyName: string,
  optimisations: string[],
  contactName: string,
  period: ReportPeriod,
): string {
  const money = (n: number, dp = 0) =>
    new Intl.NumberFormat("en", {
      style: "currency",
      currency: p.currency,
      minimumFractionDigits: dp,
      maximumFractionDigits: dp,
    }).format(n);
  const dec = (n: number, dp = 1) =>
    new Intl.NumberFormat("en", { maximumFractionDigits: dp }).format(n);
  const k = p.kpis;
  const PU = period.unit.toUpperCase();
  const dp = (kpi: Kpi) => deltaPhrase(kpi, period.prior);

  // The reporting window is whatever range was selected (p.range); the prior
  // comparison window is the equal-length span immediately before it — Swydo
  // titles every report "<period> compared to <prior period>".
  const day = 86_400_000;
  const startMs = new Date(`${p.range.start}T00:00:00Z`).getTime();
  const endMs = new Date(`${p.range.end}T00:00:00Z`).getTime();
  const spanDays = Math.round((endMs - startMs) / day) + 1;
  const priorEndMs = startMs - day;
  const priorStartMs = priorEndMs - (spanDays - 1) * day;
  // "Jun 8 – 14, 2026" (same month/year collapses the repeated parts) to match Swydo.
  const mon = (ms: number) =>
    new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short" }).format(new Date(ms));
  const prettyRange = (sMs: number, eMs: number) => {
    const s = new Date(sMs), e = new Date(eMs);
    const sd = s.getUTCDate(), ed = e.getUTCDate();
    const sy = s.getUTCFullYear(), ey = e.getUTCFullYear();
    if (sy === ey && s.getUTCMonth() === e.getUTCMonth())
      return `${mon(sMs)} ${sd} – ${ed}, ${ey}`;
    if (sy === ey) return `${mon(sMs)} ${sd} – ${mon(eMs)} ${ed}, ${ey}`;
    return `${mon(sMs)} ${sd}, ${sy} – ${mon(eMs)} ${ed}, ${ey}`;
  };
  const thisRange = prettyRange(startMs, endMs);
  const priorRange = prettyRange(priorStartMs, priorEndMs);

  const lines: string[] = [
    `Account / report title: ${companyName} Google Ads Report`,
    `Client contact first name (for the greeting only; if "(none)" greet "Hi there"): ${contactName || "(none)"}`,
    `Currency: ${p.currency}`,
    `Reporting period (use these EXACT strings in the title line): "${thisRange}" compared to "${priorRange}" (the ${period.prior}, ${spanDays} days, which every figure below is compared against).`,
    `Scope: ALL campaign types (account-wide) — Search, Performance Max, Demand Gen, Shopping, Display, Video. Removed campaigns excluded.`,
    ``,
    `SCORECARD — THIS ${PU} (vs ${period.prior}). Quote these verbatim, label: value (change):`,
    `- Impressions: ${dec(k.impressions.value, 0)} (${dp(k.impressions)})`,
    `- Clicks: ${dec(k.clicks.value, 0)} (${dp(k.clicks)})`,
    `- CTR: ${dec(k.ctr.value)}% (${dp(k.ctr)})`,
    `- Avg CPC: ${money(k.avgCpc.value, 2)} (${dp(k.avgCpc)})`,
    `- Cost: ${money(k.spend.value)} (${dp(k.spend)})`,
    `- Conversions: ${dec(k.conversions.value)} (${dp(k.conversions)})`,
    `- Cost / conversion (CPA): ${money(k.costPerConv.value, 2)} (${dp(k.costPerConv)})`,
    `- Conversion rate: ${dec(k.convRate.value)}% (${dp(k.convRate)})`,
    `- Conversions (By Time = conversion date): ${dec(k.conversionsByTime.value)} (${dp(k.conversionsByTime)})`,
    `- Average orders/day: ${dec(p.avgOrdersPerDay)}`,
    `- Average revenue/day: ${money(p.avgRevenuePerDay)}`,
    `- Search impression share: ${dec(k.searchImprShare.value)}% (Search campaigns only)`,
  ];

  if (p.hasConversionValue) {
    lines.push(
      `- Revenue (conv. value): ${money(k.convValue.value)} (${dp(k.convValue)})`,
      `- ROAS (conv. value / cost): ${dec(k.roas.value, 2)} (${dp(k.roas)})`,
      `- AOV (revenue / conversions): ${money(k.aov.value, 2)} (${dp(k.aov)})`,
      `- Revenue (By Time): ${money(k.convValueByTime.value)} (${dp(k.convValueByTime)})`,
      `- ROAS (By Time): ${dec(k.roasByTime.value, 2)} (${dp(k.roasByTime)})`,
    );
  } else {
    lines.push(
      `- NOTE: this account does not track conversion value, so do NOT mention revenue, ROAS or AOV — talk in conversions and cost per conversion only.`,
    );
  }

  if (p.byChannel?.length) {
    lines.push(``, `BY CHANNEL TYPE THIS ${PU} (account-wide; spend / conversions / cost-per-conv):`);
    for (const ch of p.byChannel) {
      lines.push(
        `- ${ch.channel}: spend ${money(ch.spend)}, ${dec(ch.conversions)} conversions, ${money(ch.costPerConv, 2)}/conv`,
      );
    }
  }

  const converting = p.byCampaign
    .filter((c) => c.conversions > 0)
    .sort((a, b) => b.conversions - a.conversions)
    .slice(0, 5);
  if (converting.length) {
    lines.push(``, `TOP CONVERTING CAMPAIGNS THIS ${PU} (ranked by conversions):`);
    for (const c of converting) {
      lines.push(
        `- ${c.name} [${c.channel ?? "—"}]: ${dec(c.conversions)} conversions, spend ${money(c.spend)}, ${money(c.costPerConv, 2)}/conv`,
      );
    }
  } else {
    lines.push(``, `TOP CONVERTING CAMPAIGNS: none recorded a conversion this ${period.unit}.`);
  }

  if (p.byCampaign.length) {
    lines.push(``, `ALL CAMPAIGNS THIS ${PU} (by spend):`);
    for (const c of p.byCampaign.slice(0, 8)) {
      lines.push(
        `- ${c.name} [${c.channel ?? "—"}]: spend ${money(c.spend)}, ${dec(c.conversions)} conversions, ${money(c.costPerConv, 2)}/conv`,
      );
    }
  }
  if (p.topSearchTerms.length) {
    lines.push(``, `TOP SEARCH TERMS THIS ${PU} (Search campaigns only, by spend):`);
    for (const t of p.topSearchTerms.slice(0, 6)) {
      lines.push(`- "${t.term}": spend ${money(t.spend)}, ${dec(t.conversions)} conversions`);
    }
  }
  if (p.byDevice.length) {
    lines.push(
      ``,
      `DEVICE SPLIT (spend): ${p.byDevice.map((d) => `${d.device} ${money(d.spend)}`).join(", ")}`,
    );
  }
  if (p.byConversionAction?.length) {
    lines.push(``, `CONVERSIONS BY ACTION THIS ${PU}:`);
    for (const a of p.byConversionAction.slice(0, 8)) {
      lines.push(
        `- ${a.action}: ${dec(a.conversions)} conversions${p.hasConversionValue ? `, ${money(a.convValue)} value` : ""}`,
      );
    }
  }

  // Cap to the most significant changes (already count-sorted) so the LLM
  // consolidates rather than transcribing a 50-line change log.
  const topOpt = optimisations.slice(0, 15);
  const overflow = optimisations.length - topOpt.length;
  lines.push(
    ``,
    `OPTIMISATIONS MADE THIS ${PU} (verified change log — campaign — action (count); already ranked by volume):`,
    optimisations.length
      ? topOpt.map((l) => `- ${l}`).join("\n")
      : `- No account changes were logged this ${period.unit}.`,
  );
  if (overflow > 0) lines.push(`- (plus ${overflow} further minor changes)`);

  // Change history in Google Ads only reaches back ~30 days, so for a month or
  // longer window the optimisations list may under-count older activity.
  if (spanDays > 30) {
    lines.push(
      ``,
      `NOTE: the optimisations log above only reflects the most recent ~30 days (a Google Ads limit), even though this report covers ${spanDays} days.`,
    );
  }

  return lines.join("\n");
}

const SYSTEM = (brand: string, period: ReportPeriod) =>
  `You are a senior paid-media account manager at ${brand}, writing the Google Ads performance update a client receives for ${period.span}. The body follows our standard report format (which mirrors our Swydo reports), wrapped in a short, warm email greeting and sign-off. The full visual report — scorecard tiles, performance tables and ad previews — lives on the client's portal/dashboard (a link is sent alongside this message), so the message itself stays concise text.

Voice: warm, professional, analytical, specific — an experienced human analyst. Plain language a business owner understands.

HARD RULES:
- Use ONLY the figures in the DATA block. Never invent, estimate, or recompute any number, %, campaign name, or metric. Quote every figure exactly as given (same currency, rounding, sign).
- Figures are ACCOUNT-WIDE across all campaign types (Search, Performance Max, Demand Gen, Shopping, Display, Video). Use the BY CHANNEL TYPE data and the [channel] tag to attribute correctly — never describe Performance Max / Demand Gen / Shopping activity as Search, and never call product/listing-group changes "keywords".
- "Search impression share" and "top search terms" are SEARCH-ONLY — only discuss them for Search.
- Two conversion bases are given: standard (interaction/click date) and "By Time" (conversion date). Show both where present; don't conflate them.
- If conversion value is not tracked, omit Revenue, ROAS and AOV entirely.
- Optimisations: describe ONLY the logged changes, using the exact entity wording given (e.g. "product groups added", "asset groups added", "keywords added"). Never state a specific old→new budget or Target-CPA value unless that exact figure appears in the data. If the DATA notes the change log only covers the most recent ~30 days, do not imply the optimisations list is complete for a longer report.
- Do NOT invent month-to-date spend, monthly targets, or budget-pacing claims — we do not have those figures.
- Tell the story, don't dump data: the Summary surfaces only the one or two changes that actually matter and explains WHY they happened (tie them to the logged optimisations / clear seasonality), rather than walking through every metric. The scorecard already carries the full numbers.
- Keep it grounded — if ${period.span} was quiet, keep it short; don't pad or invent.
- The "A note from your account manager" placeholder must be emitted as the exact literal bracketed text given — NEVER fill it in, paraphrase it, or invent manual context for it. It is for the human reviewer.
- This is a DRAFT a human reviews and may edit before it reaches the client.

OUTPUT — exactly this structure and order. Slack formatting (*bold* titles, "- " bullets), no markdown headers (#), no tables:

Hi <client contact's first name from the data; if none, write "there">,

One short lead-in line — that here is the Google Ads performance update for ${period.span} (and that the full breakdown is on their dashboard).

*<Account> Google Ads Report*
<reporting period> compared to <prior period>

*Performance*
The scorecard as a compact bulleted list, one headline metric per line as "Metric: value (±X% vs ${period.prior})". Include the core tiles in this order: Clicks, Impressions, Cost, Avg CPC, Conv., Cost / conv., Conversion rate, CTR — and, when conversion value is tracked, Revenue, ROAS and AOV. Then, where the By-Time figures are present, ALWAYS add these three lines (do not omit any): "Conv. (by conversion time)", "Revenue (by conversion time)", and "ROAS (by conversion time)". Copy every figure verbatim from the SCORECARD data.

*Summary*
The heart of the report — concise, flowing analytical prose (not bullets), and NOT a recap of every metric (the scorecard above already lists them). Lead with the ONE or TWO most meaningful takeaways of ${period.span} — the real story, not a tour of the numbers. Then explain the WHY, not just the what: tie the movements to the optimisations we actually made during ${period.span} (from the OPTIMISATIONS change log) — for example a budget reduction, paused products or excluded Item IDs, a new campaign, or a tracking fix — and to seasonality where it is clearly evident. Attribute a movement to a logged action ONLY where it plausibly explains it; never invent a reason or a cause we did not take. Mention the channel/segment mix only if it is part of the key story. End with a clear forward-looking line: the plan for the period ahead and any recommendation.

*Conversions by action*
A short standalone paragraph breaking down conversions by conversion action / type over the reporting period, using the CONVERSIONS BY ACTION data (action name, conversion count, and value where tracked). Lead with the highest-volume actions and call out the conversion mix (e.g. which actions are primary vs secondary signals). If only one action is present, say so in a line. Omit this section entirely only if no conversion-action data is provided.

*${period.optimisationsHeading}*
Begin with this exact sentence, verbatim:
"Regular account optimisations including bid management, adding new keywords from search terms, adding new negative keywords, resolving ad split tests, creating new ads for split-testing purposes, improving underperforming assets, creating new ad groups for top converting search terms."
Then a first-person bulleted list ("I have …") of the specific logged changes from the change log, using the exact entity wording and campaign names given — one bullet per distinct change type/campaign. If nothing was logged, say so in one line.

*A note from your account manager:*
Output the following line EXACTLY as written, as a placeholder for the human reviewer to fill in or delete before sending — do NOT write your own content here, do NOT invent context, budget changes, or forward plans:
[Account manager — add your account-specific observations and strategic insight before sending: the reasoning behind the changes made, what to expect next, seasonality, and anything the data cannot show. This is what makes the report feel prepared by you. Delete if not needed.]

Close with one short warm line — that you'll keep monitoring and optimising, that the full visual report is on their dashboard, and to reach out with any questions — then a brief sign-off (e.g. "Best regards," on its own line followed by "The ${brand} Team").

Write the update now.`;

export async function generateNarrative(
  payload: DashboardPayload,
  companyName: string,
  optimisations: string[] = [],
  contactName = "",
  period: ReportPeriod = WEEK_PERIOD,
): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const brand = entityConfig.brandName;
  const client = new Anthropic({ apiKey });

  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 2500,
      thinking: { type: "adaptive" },
      system: SYSTEM(brand, period),
      messages: [
        {
          role: "user",
          content: `DATA (verified — use these figures verbatim):\n\n${factsBlock(payload, companyName, optimisations, contactName, period)}`,
        },
      ],
    });
    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    return text || null;
  } catch (e) {
    console.error("Narrative generation failed (falling back to template):", e);
    return null;
  }
}

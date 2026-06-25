// LLM-worded weekly narrative. The figures are ALL computed in the data layer
// (reporting.ts); Claude only turns the verified facts into prose in the voice
// of a senior account manager. It never computes or invents a number.
//
// Gated on ANTHROPIC_API_KEY — without it, callers fall back to the bulleted
// template (generateWeeklyReport.text).
import Anthropic from "@anthropic-ai/sdk";
import type { DashboardPayload, Kpi } from "../google-ads/reporting";
import { entityConfig } from "@/lib/config";

const MODEL = "claude-opus-4-8";

function deltaPhrase(k: Kpi): string {
  if (k.deltaPct == null) return "no prior-period baseline";
  const dir = k.deltaPct >= 0 ? "up" : "down";
  return `${dir} ${Math.abs(k.deltaPct).toFixed(0)}% vs the prior week`;
}

// Turn the verified payload into a compact, unambiguous facts block. Every
// number Claude is allowed to use appears here, pre-formatted — so it copies
// rather than computes.
function factsBlock(
  p: DashboardPayload,
  companyName: string,
  optimisations: string[],
  contactName: string,
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
  const w = p.weekly;
  const k = p.kpis;

  // Prior comparison window (the 7 days immediately before this one) — Swydo
  // titles every report "<period> compared to <prior period>".
  const day = 86_400_000;
  const startMs = new Date(`${w.start}T00:00:00Z`).getTime();
  const endMs = new Date(`${w.end}T00:00:00Z`).getTime();
  const priorEndMs = startMs - day;
  const priorStartMs = priorEndMs - 6 * day;
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
    `Reporting period (use these EXACT strings in the title line): "${thisRange}" compared to "${priorRange}" (the prior 7 days, which every figure below is compared against).`,
    `Scope: ALL campaign types (account-wide) — Search, Performance Max, Demand Gen, Shopping, Display, Video. Removed campaigns excluded.`,
    ``,
    `SCORECARD — THIS WEEK (vs prior week). Quote these verbatim, label: value (change):`,
    `- Impressions: ${dec(k.impressions.value, 0)} (${deltaPhrase(k.impressions)})`,
    `- Clicks: ${dec(k.clicks.value, 0)} (${deltaPhrase(k.clicks)})`,
    `- CTR: ${dec(k.ctr.value)}% (${deltaPhrase(k.ctr)})`,
    `- Avg CPC: ${money(k.avgCpc.value, 2)} (${deltaPhrase(k.avgCpc)})`,
    `- Cost: ${money(w.spend.value)} (${deltaPhrase(w.spend)})`,
    `- Conversions: ${dec(k.conversions.value)} (${deltaPhrase(k.conversions)})`,
    `- Cost / conversion (CPA): ${money(k.costPerConv.value, 2)} (${deltaPhrase(k.costPerConv)})`,
    `- Conversion rate: ${dec(k.convRate.value)}% (${deltaPhrase(k.convRate)})`,
    `- Conversions (By Time = conversion date): ${dec(k.conversionsByTime.value)} (${deltaPhrase(k.conversionsByTime)})`,
    `- Average orders/day: ${dec(p.avgOrdersPerDay)}`,
    `- Average revenue/day: ${money(p.avgRevenuePerDay)}`,
    `- Search impression share: ${dec(k.searchImprShare.value)}% (Search campaigns only)`,
  ];

  if (p.hasConversionValue) {
    lines.push(
      `- Revenue (conv. value): ${money(k.convValue.value)} (${deltaPhrase(k.convValue)})`,
      `- ROAS (conv. value / cost): ${dec(k.roas.value, 2)} (${deltaPhrase(k.roas)})`,
      `- AOV (revenue / conversions): ${money(k.aov.value, 2)} (${deltaPhrase(k.aov)})`,
      `- Revenue (By Time): ${money(k.convValueByTime.value)} (${deltaPhrase(k.convValueByTime)})`,
      `- ROAS (By Time): ${dec(k.roasByTime.value, 2)} (${deltaPhrase(k.roasByTime)})`,
    );
  } else {
    lines.push(
      `- NOTE: this account does not track conversion value, so do NOT mention revenue, ROAS or AOV — talk in conversions and cost per conversion only.`,
    );
  }

  if (p.byChannel?.length) {
    lines.push(``, `BY CHANNEL TYPE THIS WEEK (account-wide; spend / conversions / cost-per-conv):`);
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
    lines.push(``, `TOP CONVERTING CAMPAIGNS THIS WEEK (ranked by conversions):`);
    for (const c of converting) {
      lines.push(
        `- ${c.name} [${c.channel ?? "—"}]: ${dec(c.conversions)} conversions, spend ${money(c.spend)}, ${money(c.costPerConv, 2)}/conv`,
      );
    }
  } else {
    lines.push(``, `TOP CONVERTING CAMPAIGNS: none recorded a conversion this week.`);
  }

  if (p.byCampaign.length) {
    lines.push(``, `ALL CAMPAIGNS THIS WEEK (by spend):`);
    for (const c of p.byCampaign.slice(0, 8)) {
      lines.push(
        `- ${c.name} [${c.channel ?? "—"}]: spend ${money(c.spend)}, ${dec(c.conversions)} conversions, ${money(c.costPerConv, 2)}/conv`,
      );
    }
  }
  if (p.topSearchTerms.length) {
    lines.push(``, `TOP SEARCH TERMS THIS WEEK (Search campaigns only, by spend):`);
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
    lines.push(``, `CONVERSIONS BY ACTION THIS WEEK:`);
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
    `OPTIMISATIONS MADE THIS WEEK (verified change log — campaign — action (count); already ranked by volume):`,
    optimisations.length
      ? topOpt.map((l) => `- ${l}`).join("\n")
      : `- No account changes were logged this week.`,
  );
  if (overflow > 0) lines.push(`- (plus ${overflow} further minor changes)`);

  return lines.join("\n");
}

const SYSTEM = (brand: string) =>
  `You are a senior paid-media account manager at ${brand}, writing the weekly Google Ads update a client receives. The body follows our standard report format (which mirrors our Swydo reports), wrapped in a short, warm email greeting and sign-off. The full visual report — scorecard tiles, performance tables and ad previews — lives on the client's portal/dashboard (a link is sent alongside this message), so the message itself stays concise text.

Voice: warm, professional, analytical, specific — an experienced human analyst. Plain language a business owner understands.

HARD RULES:
- Use ONLY the figures in the DATA block. Never invent, estimate, or recompute any number, %, campaign name, or metric. Quote every figure exactly as given (same currency, rounding, sign).
- Figures are ACCOUNT-WIDE across all campaign types (Search, Performance Max, Demand Gen, Shopping, Display, Video). Use the BY CHANNEL TYPE data and the [channel] tag to attribute correctly — never describe Performance Max / Demand Gen / Shopping activity as Search, and never call product/listing-group changes "keywords".
- "Search impression share" and "top search terms" are SEARCH-ONLY — only discuss them for Search.
- Two conversion bases are given: standard (interaction/click date) and "By Time" (conversion date). Show both where present; don't conflate them.
- If conversion value is not tracked, omit Revenue, ROAS and AOV entirely.
- Optimisations: describe ONLY the logged changes, using the exact entity wording given (e.g. "product groups added", "asset groups added", "keywords added"). Never state a specific old→new budget or Target-CPA value unless that exact figure appears in the data.
- Do NOT invent month-to-date spend, monthly targets, or budget-pacing claims — we do not have those figures.
- Keep it grounded — if a week is quiet, keep it short; don't pad or invent.
- The "A note from your account manager" placeholder must be emitted as the exact literal bracketed text given — NEVER fill it in, paraphrase it, or invent manual context for it. It is for the human reviewer.
- This is a DRAFT a human reviews and may edit before it reaches the client.

OUTPUT — exactly this structure and order. Slack formatting (*bold* titles, "- " bullets), no markdown headers (#), no tables:

Hi <client contact's first name from the data; if none, write "there">,

One short lead-in line — that here is the Google Ads performance update for the past week (and that the full breakdown is on their dashboard).

*<Account> Google Ads Report*
<reporting period> compared to <prior period>

*Performance*
The scorecard as a compact bulleted list, one headline metric per line as "Metric: value (±X% vs prior week)". Include the core tiles in this order: Clicks, Impressions, Cost, Avg CPC, Conv., Cost / conv., Conversion rate, CTR — and, when conversion value is tracked, Revenue, ROAS and AOV. Then, where the By-Time figures are present, ALWAYS add these three lines (do not omit any): "Conv. (by conversion time)", "Revenue (by conversion time)", and "ROAS (by conversion time)". Copy every figure verbatim from the SCORECARD data.

*Summary*
The heart of the report — flowing analytical prose (not bullets). Lead with the headline movement and ITS ATTRIBUTION (why spend / conversions / CPA moved this week). Walk through the CPA (or cost-per-lead) and conversion-rate trends using the actual figures; when more than one channel type or labelled segment is present, add a sentence on the channel/segment mix (which drove spend and conversions). Note any standout campaign and anything being tested and why. End with a clear forward-looking line: the plan for the coming week and any recommendation or next step.

*Conversions by action*
A short standalone paragraph breaking down the week's conversions by conversion action / type, using the CONVERSIONS BY ACTION data (action name, conversion count, and value where tracked). Lead with the highest-volume actions and call out the conversion mix (e.g. which actions are primary vs secondary signals). If only one action is present, say so in a line. Omit this section entirely only if no conversion-action data is provided.

*Last Week's Optimisations*
Begin with this exact sentence, verbatim:
"Regular account optimisations including bid management, adding new keywords from search terms, adding new negative keywords, resolving ad split tests, creating new ads for split-testing purposes, improving underperforming assets, creating new ad groups for top converting search terms."
Then a first-person bulleted list ("I have …") of the specific logged changes from the change log, using the exact entity wording and campaign names given — one bullet per distinct change type/campaign. If nothing was logged, say so in one line.

*A note from your account manager:*
Output the following line EXACTLY as written, as a placeholder for the human reviewer to fill in or delete before sending — do NOT write your own content here, do NOT invent context, budget changes, or forward plans:
[Account manager — add any manual context here before sending: budget changes you made this week, what to expect next week, anything the data can't show. Delete this line if not needed.]

Close with one short warm line — that you'll keep monitoring and optimising, that the full visual report is on their dashboard, and to reach out with any questions — then a brief sign-off (e.g. "Best regards," on its own line followed by "The ${brand} Team").

Write the update now.`;

export async function generateNarrative(
  payload: DashboardPayload,
  companyName: string,
  optimisations: string[] = [],
  contactName = "",
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
      system: SYSTEM(brand),
      messages: [
        {
          role: "user",
          content: `DATA (verified — use these figures verbatim):\n\n${factsBlock(payload, companyName, optimisations, contactName)}`,
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

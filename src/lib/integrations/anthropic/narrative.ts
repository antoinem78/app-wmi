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

  const lines: string[] = [
    `Account: ${companyName}`,
    `Client contact (for the greeting): ${contactName || `(none — use "Hi there")`}`,
    `Currency: ${p.currency}`,
    `Reporting period: ${w.start} to ${w.end} (the last 7 days), compared with the 7 days before it.`,
    `Scope: ALL campaign types (account-wide) — Search, Performance Max, Demand Gen, Shopping, Display, Video. Removed campaigns excluded.`,
    ``,
    `STATS — THIS WEEK (vs prior week). Quote these verbatim, label: value (change):`,
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
  `You are a senior paid-media account manager at ${brand}, writing the weekly performance update that goes to a client. Match this house format exactly.

Voice: warm, professional, specific — an experienced human analyst. Plain language a business owner understands.

HARD RULES:
- Use ONLY the figures in the DATA block. Never invent, estimate, or recompute any number, %, campaign name, or metric. Quote every figure exactly as given (same currency, rounding, sign).
- Figures are ACCOUNT-WIDE across all campaign types (Search, Performance Max, Demand Gen, Shopping, Display, Video). Use the BY CHANNEL TYPE data and the [channel] tag to attribute correctly — never describe Performance Max / Demand Gen / Shopping activity as Search, and never call product/listing-group changes "keywords".
- "Search impression share" and "top search terms" are SEARCH-ONLY — only discuss them for Search.
- Two conversion bases are given: standard (interaction/click date) and "By Time" (conversion date). Show both where present; don't conflate them.
- If conversion value is not tracked, omit Revenue, ROAS and AOV entirely.
- Optimisations: describe ONLY the logged changes, using the exact entity wording given (e.g. "product groups added", "asset groups added", "keywords added"). A brief conservative rationale and the campaign name are fine; never claim a specific result or number not in the data.
- Keep it grounded — if a week is quiet, keep it short; don't pad or invent.
- This is a DRAFT a human reviews and may edit before it reaches the client.

OUTPUT — exactly this structure and order, Slack formatting (*bold* titles, "- " bullets), no markdown headers (#), no tables:

Hi <client contact's first name from the data; if none, write "there">,

Please review the last week report for the account.

*Executive Summary:*
2-3 sentences at the very top: how the account performed this week at a glance, the standout win(s), and whether it is trending in the right direction. Plain and high-level — NO metric dump (the figures follow below).

*Date Range:* <the reporting period from the data>

*Google Ads Stats:*
A bulleted list of the STATS figures (plus the Revenue / ROAS / AOV / By-Time figures when present), copied verbatim as "Label: value (change)".

*Google Ads Summary:*
One short prose paragraph walking through the week-on-week movements and what they mean. When more than one channel type is present, add a sentence on the channel mix (which channels drove spend / conversions).

*Google Ads Optimisation:*
A bulleted list turning the change log into clear client-facing sentences — one per distinct change type/campaign, using the exact entity wording. If nothing was logged, say so in one line.

End with one short closing line — that you'll keep monitoring and optimising and to reach out with any questions — then a brief sign-off.

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

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
    `Currency: ${p.currency}`,
    `Reporting period: ${w.start} to ${w.end} (the last 7 days), compared with the 7 days before it.`,
    `Scope: ALL campaign types (account-wide) — Search, Performance Max, Demand Gen, Shopping, Display, Video. Removed campaigns excluded. Conversions attributed by interaction (click) date.`,
    ``,
    `HEADLINE (this week vs prior week):`,
    `- Spend: ${money(w.spend.value)} (${deltaPhrase(w.spend)})`,
    `- Conversions: ${dec(w.conversions.value)} (${deltaPhrase(w.conversions)})`,
    `- Cost per conversion: ${money(k.costPerConv.value, 2)} (${deltaPhrase(k.costPerConv)})`,
    `- Clicks: ${dec(k.clicks.value, 0)} (${deltaPhrase(k.clicks)})`,
    `- Impressions: ${dec(k.impressions.value, 0)} (${deltaPhrase(k.impressions)})`,
    `- Click-through rate: ${dec(k.ctr.value)}% (${deltaPhrase(k.ctr)})`,
    `- Average CPC: ${money(k.avgCpc.value, 2)} (${deltaPhrase(k.avgCpc)})`,
    `- Search impression share: ${dec(k.searchImprShare.value)}% (Search campaigns only)`,
  ];

  if (p.hasConversionValue) {
    lines.push(
      `- Conversion value: ${money(k.convValue.value)} (${deltaPhrase(k.convValue)})`,
      `- ROAS (conv value / cost): ${dec(k.roas.value, 2)}x (${deltaPhrase(k.roas)})`,
    );
  } else {
    lines.push(
      `- NOTE: this account does not track conversion value, so do NOT mention revenue or ROAS — talk in conversions and cost per conversion only.`,
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
  `You are a senior paid-search account manager at ${brand}, writing the weekly performance update that goes to a client.

Voice: warm, professional, and specific — an experienced human analyst, not a robot. Plain language a business owner understands.

HARD RULES:
- Use ONLY the figures in the DATA block. Never invent, estimate, or recompute a number, a percentage, a campaign name, or a metric not present in the data.
- Quote figures exactly as given (same currency, same rounding).
- The headline figures are ACCOUNT-WIDE across all campaign types (Search, Performance Max, Demand Gen, Shopping, Display, Video). Use the "BY CHANNEL TYPE" data and the [channel] tag on each campaign to attribute performance to the right channel — do NOT describe Performance Max / Demand Gen / Shopping activity as Search, and never call product/listing-group changes "keywords".
- "Search impression share" and "top search terms" are SEARCH-ONLY signals — only discuss them for Search campaigns, never as account-wide figures.
- Conversions are counted by interaction (click) date; the most recent days may still mature, so don't over-read a single recent week.
- If conversion-value tracking is absent, never mention revenue or ROAS.
- Optimisations: describe ONLY the changes in the change log, using the exact entity wording given (e.g. "product groups added", "asset groups added", "keywords added"). You may add a brief, conservative rationale and reference the campaign by name, but never claim a specific result or number not in the data.
- Keep it grounded. If the week is quiet or the data is thin, keep each section short — do not pad. If a section has no data, write one honest line rather than inventing content.
- This is a DRAFT a human reviews before it reaches the client.

FORMAT — output these five sections in order, each with its title in *bold* (Slack formatting), separated by a blank line. Use "- " bullets only in the two list sections. Everything else is short prose paragraphs. No markdown headers (#), no tables.

*Top Converting Campaigns*
A short bulleted list from the data (campaign name / conversions). If none converted, say so in one line.

*Performance Summary*
One short paragraph: account-wide clicks, impressions, CTR, conversions and cost per conversion for the week with the week-on-week direction; when more than one channel type is present, add a sentence on the channel mix (which channels drove spend and conversions). End with a sentence of plain interpretation.

*Optimisations Made*
A bulleted list turning the change log into clear client-facing sentences (e.g. "Expanded negative keyword lists in the X campaign to filter irrelevant traffic"). One bullet per distinct change type/campaign.

*Campaign Insights*
One short paragraph tying the campaigns to the results — which carried conversions, what was paused or reallocated, what's being monitored.

*Forward Plan*
One short paragraph on next week: what continues, what's being tested, what to watch.

Write the update now.`;

export async function generateNarrative(
  payload: DashboardPayload,
  companyName: string,
  optimisations: string[] = [],
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
          content: `DATA (verified — use these figures verbatim):\n\n${factsBlock(payload, companyName, optimisations)}`,
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

// LLM-worded weekly narrative. The figures are ALL computed in the data layer
// (reporting.ts); Claude only turns the verified facts into prose in the voice
// of a senior account manager. It never computes or invents a number.
//
// Gated on ANTHROPIC_API_KEY — without it, callers fall back to the bulleted
// template (generateWeeklyReport.text).
import Anthropic from "@anthropic-ai/sdk";
import type { DashboardPayload, Kpi } from "../google-ads/reporting";

const MODEL = "claude-opus-4-8";

function deltaPhrase(k: Kpi): string {
  if (k.deltaPct == null) return "no prior-period baseline";
  const dir = k.deltaPct >= 0 ? "up" : "down";
  return `${dir} ${Math.abs(k.deltaPct).toFixed(0)}% vs the prior week`;
}

// Turn the verified payload into a compact, unambiguous facts block. Every
// number Claude is allowed to use appears here, pre-formatted — so it copies
// rather than computes.
function factsBlock(p: DashboardPayload, companyName: string): string {
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
    `Search campaigns only. Removed campaigns excluded.`,
    ``,
    `HEADLINE (this week vs prior week):`,
    `- Spend: ${money(w.spend.value)} (${deltaPhrase(w.spend)})`,
    `- Conversions: ${dec(w.conversions.value)} (${deltaPhrase(w.conversions)})`,
    `- Cost per conversion: ${money(k.costPerConv.value, 2)} (${deltaPhrase(k.costPerConv)})`,
    `- Clicks: ${dec(k.clicks.value, 0)} (${deltaPhrase(k.clicks)})`,
    `- Impressions: ${dec(k.impressions.value, 0)} (${deltaPhrase(k.impressions)})`,
    `- Click-through rate: ${dec(k.ctr.value)}% (${deltaPhrase(k.ctr)})`,
    `- Average CPC: ${money(k.avgCpc.value, 2)} (${deltaPhrase(k.avgCpc)})`,
    `- Search impression share: ${dec(k.searchImprShare.value)}%`,
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

  if (p.byCampaign.length) {
    lines.push(``, `TOP CAMPAIGNS THIS WEEK (by spend):`);
    for (const c of p.byCampaign.slice(0, 6)) {
      lines.push(
        `- ${c.name}: spend ${money(c.spend)}, ${dec(c.conversions)} conversions, ${money(c.costPerConv, 2)}/conv`,
      );
    }
  }
  if (p.topSearchTerms.length) {
    lines.push(``, `TOP SEARCH TERMS THIS WEEK (by spend):`);
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

  lines.push(
    ``,
    `ACCOUNT CHANGES MADE THIS WEEK:`,
    w.changeLines.length
      ? w.changeLines.map((l) => `- ${l}`).join("\n")
      : `- No account changes were logged this week.`,
  );

  return lines.join("\n");
}

const SYSTEM = (brand: string) =>
  `You are a senior paid-search account manager at ${brand}, writing the weekly performance update that goes to a client.

Voice: warm, professional, and specific — an experienced human analyst, not a robot. Plain language a business owner understands.

HARD RULES:
- Use ONLY the figures in the DATA block. Never invent, estimate, or recompute a number. If a figure isn't in the data, don't state it.
- Quote figures exactly as given (same currency, same rounding).
- Do not use markdown headings, tables, or bullet symbols — this is read in Slack and email. Short paragraphs only.
- If conversion-value tracking is absent, never mention revenue or ROAS.
- Keep it grounded. If the week is quiet or the data is thin, keep it short — do not pad.

STRUCTURE (3-5 short paragraphs):
1. Open with the headline: spend and conversions for the week and which way they moved.
2. Explain what drove it — which campaigns carried the spend and conversions, any notable search terms or device skew.
3. If account changes were made this week, describe them in plain English and tie them to likely impact next week where it's reasonable (e.g. raising a target tends to increase volume and spend).
4. Close with a brief, confident outlook or next step.

Write the update now.`;

export async function generateNarrative(
  payload: DashboardPayload,
  companyName: string,
): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const brand = process.env.BRAND_NAME || "PPC Mastery";
  const client = new Anthropic({ apiKey });

  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      thinking: { type: "adaptive" },
      system: SYSTEM(brand),
      messages: [
        {
          role: "user",
          content: `DATA (verified — use these figures verbatim):\n\n${factsBlock(payload, companyName)}`,
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

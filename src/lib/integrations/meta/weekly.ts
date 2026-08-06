// Weekly Meta Ads reporting — the Meta counterpart to the Google Ads weekly
// report. Same shape of deliverable: verified figures from the read layer, an
// LLM narrative over the top, posted as a Monday draft to Slack for review
// before anything reaches a client.
//
// Deliberately reuses getMetaAuditData rather than adding a second read path,
// so the weekly numbers and the audit numbers can never disagree.
import { getMetaAuditData } from "@/lib/integrations/meta";

/** Purchases/leads live under several action_type aliases; take the first present. */
function firstAction(actions: Record<string, number> | undefined, keys: string[]): number {
  if (!actions) return 0;
  for (const k of keys) if (typeof actions[k] === "number") return actions[k];
  return 0;
}

const PURCHASE_KEYS = ["offsite_conversion.fb_pixel_purchase", "purchase", "omni_purchase"];
const LEAD_KEYS = ["offsite_conversion.fb_pixel_lead", "lead", "onsite_conversion.lead_grouped"];
const ATC_KEYS = ["offsite_conversion.fb_pixel_add_to_cart", "add_to_cart"];

export interface MetaWeeklyMetrics {
  spend: number;
  impressions: number;
  reach: number;
  frequency: number;
  clicks: number;
  ctr: number;
  cpm: number;
  purchases: number;
  revenue: number;
  roas: number | null;
  leads: number;
  addToCarts: number;
  costPerPurchase: number | null;
  costPerLead: number | null;
}

export interface MetaWeekly {
  accountId: string;
  accountName: string;
  currency: string;
  period: { start: string; end: string };
  priorPeriod: { start: string; end: string };
  current: MetaWeeklyMetrics;
  previous: MetaWeeklyMetrics | null;
  activeCampaigns: { name: string; spend: number; purchases: number; roas: number | null }[];
  learningAdSets: string[];
  /** Reasons this account is not worth reporting on this week, if any. */
  skip: string | null;
}

function toMetrics(p: Record<string, unknown> | null | undefined): MetaWeeklyMetrics | null {
  if (!p || typeof p !== "object" || "error" in p) return null;
  const q = p as Record<string, number | Record<string, number> | null>;
  const actions = q.actions as Record<string, number> | undefined;
  const values = q.actionValues as Record<string, number> | undefined;
  const spend = Number(q.spend ?? 0);
  const purchases = firstAction(actions, PURCHASE_KEYS);
  const revenue = firstAction(values, PURCHASE_KEYS);
  const leads = firstAction(actions, LEAD_KEYS);
  return {
    spend: Number(spend.toFixed(2)),
    impressions: Number(q.impressions ?? 0),
    reach: Number(q.reach ?? 0),
    frequency: Number(q.frequency ?? 0),
    clicks: Number(q.clicks ?? 0),
    ctr: Number(q.ctr ?? 0),
    cpm: Number(q.cpm ?? 0),
    purchases,
    revenue: Number(revenue.toFixed(2)),
    roas: spend > 0 && revenue > 0 ? Number((revenue / spend).toFixed(2)) : null,
    leads,
    addToCarts: firstAction(actions, ATC_KEYS),
    costPerPurchase: purchases > 0 ? Number((spend / purchases).toFixed(2)) : null,
    costPerLead: leads > 0 ? Number((spend / leads).toFixed(2)) : null,
  };
}

/**
 * One account's trailing 7 days against the 7 before it.
 *
 * `skip` is set rather than throwing when there is nothing worth reporting, so
 * the caller can pass over dormant accounts without treating them as failures.
 */
export async function getMetaWeekly(accountId: string): Promise<MetaWeekly | { error: string }> {
  const data = (await getMetaAuditData(accountId, 7)) as Record<string, unknown>;
  const account = data.account as Record<string, unknown> | undefined;
  if (account && "error" in account) return { error: String(account.error) };

  const perf = (data.performance ?? {}) as Record<string, unknown>;
  const current = toMetrics(perf.current as Record<string, unknown> | null);
  const previous = toMetrics(perf.previous as Record<string, unknown> | null);
  const window = data.window as { current: { since: string; until: string }; previous: { since: string; until: string } };

  const perfRows = Array.isArray(data.campaignPerformance) ? (data.campaignPerformance as Record<string, unknown>[]) : [];
  const activeCampaigns = perfRows
    .map((r) => {
      const spend = Number(r.spend ?? 0);
      const actions = r.actions as Record<string, number> | undefined;
      const values = r.actionValues as Record<string, number> | undefined;
      const purchases = firstAction(actions, PURCHASE_KEYS);
      const revenue = firstAction(values, PURCHASE_KEYS);
      return {
        name: String(r.campaign ?? "(unnamed)"),
        spend: Number(spend.toFixed(2)),
        purchases,
        roas: spend > 0 && revenue > 0 ? Number((revenue / spend).toFixed(2)) : null,
      };
    })
    .filter((c) => c.spend > 0)
    .sort((a, b) => b.spend - a.spend);

  const adsets = Array.isArray(data.adsets) ? (data.adsets as Record<string, unknown>[]) : [];
  const learningAdSets = adsets
    .filter((s) => String(s.learning ?? "").toUpperCase() === "LEARNING" && String(s.effectiveStatus ?? "") === "ACTIVE")
    .map((s) => String(s.name ?? ""));

  const spend = current?.spend ?? 0;
  const priorSpend = previous?.spend ?? 0;
  const skip = spend === 0 && priorSpend === 0 ? "no spend this week or last" : null;

  return {
    accountId: String(data.accountId ?? accountId),
    accountName: String(account?.name ?? accountId),
    currency: String(account?.currency ?? ""),
    period: { start: window.current.since, end: window.current.until },
    priorPeriod: { start: window.previous.since, end: window.previous.until },
    current: current ?? {
      spend: 0, impressions: 0, reach: 0, frequency: 0, clicks: 0, ctr: 0, cpm: 0,
      purchases: 0, revenue: 0, roas: null, leads: 0, addToCarts: 0,
      costPerPurchase: null, costPerLead: null,
    },
    previous,
    activeCampaigns,
    learningAdSets,
    skip,
  };
}

const pct = (now: number, before: number): string => {
  if (!before) return now ? "new" : "flat";
  const d = ((now - before) / before) * 100;
  const sign = d >= 0 ? "+" : "";
  return `${sign}${d.toFixed(0)}%`;
};

/**
 * Deterministic fallback body, used verbatim when no Anthropic key is set and
 * as the figure block the narrative is written against. British spelling, no
 * em dashes, per the house style rules.
 */
export function formatMetaWeeklyText(w: MetaWeekly): string {
  const c = w.current;
  const p = w.previous;
  const cur = (n: number) => `${w.currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const lines: string[] = [];

  lines.push(`Spend ${cur(c.spend)}${p ? ` (${pct(c.spend, p.spend)} on the previous week)` : ""}`);
  lines.push(`Impressions ${c.impressions.toLocaleString()}, reach ${c.reach.toLocaleString()}, frequency ${c.frequency.toFixed(2)}`);
  lines.push(`Clicks ${c.clicks.toLocaleString()}, CTR ${c.ctr.toFixed(2)}%, CPM ${cur(c.cpm)}`);

  if (c.purchases || c.revenue) {
    lines.push(
      `Purchases ${c.purchases}${p ? ` (${pct(c.purchases, p.purchases)})` : ""}, revenue ${cur(c.revenue)}, ROAS ${c.roas ?? "n/a"}` +
        (c.costPerPurchase ? `, cost per purchase ${cur(c.costPerPurchase)}` : ""),
    );
  }
  if (c.leads) {
    lines.push(`Leads ${c.leads}${p ? ` (${pct(c.leads, p.leads)})` : ""}${c.costPerLead ? `, cost per lead ${cur(c.costPerLead)}` : ""}`);
  }
  if (c.addToCarts) lines.push(`Add to carts ${c.addToCarts}`);

  if (w.activeCampaigns.length) {
    lines.push("");
    lines.push("Where the spend went:");
    for (const camp of w.activeCampaigns.slice(0, 6)) {
      lines.push(`  ${camp.name}: ${cur(camp.spend)}${camp.purchases ? `, ${camp.purchases} purchases` : ""}${camp.roas ? `, ROAS ${camp.roas}` : ""}`);
    }
  }
  if (w.learningAdSets.length) {
    lines.push("");
    lines.push(`Still in learning: ${w.learningAdSets.join(", ")}. Read these figures as provisional.`);
  }
  return lines.join("\n");
}

// Rexos P5-Lite write guardrails + mutate-operation builders.
//
// SAFETY MODEL (all enforced server-side, never trusting the UI):
//  - KILL SWITCH: GOOGLE_ADS_WRITE_ENABLED must be exactly "true" or every
//    write refuses. Default OFF.
//  - ALLOWLISTS: only GOOGLE_ADS_WRITE_CUSTOMERS may be written; pause/budget
//    additionally require the campaign id in GOOGLE_ADS_WRITE_CAMPAIGNS.
//  - BUDGET CAPS: hard daily ceiling, max increase %, large-decrease confirm.
//  - One operation per approval (no batch). No autonomous writes (human approval
//    re-checked by the worker before any mutate).

const norm = (id: string) => id.replace(/[^0-9]/g, "");
const list = (v: string | undefined) =>
  new Set((v ?? "").split(",").map((s) => norm(s.trim())).filter(Boolean));

/** Kill switch — must be exactly "true". */
export function writeEnabled(): boolean {
  return process.env.GOOGLE_ADS_WRITE_ENABLED === "true";
}
export function allowedCustomers(): Set<string> {
  return list(process.env.GOOGLE_ADS_WRITE_CUSTOMERS);
}
export function allowedCampaigns(): Set<string> {
  return list(process.env.GOOGLE_ADS_WRITE_CAMPAIGNS);
}
export function budgetCaps() {
  const num = (v: string | undefined, d: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : d;
  };
  return {
    maxDailyUnits: num(process.env.GOOGLE_ADS_BUDGET_MAX_DAILY, 100),
    maxIncreasePct: num(process.env.GOOGLE_ADS_BUDGET_MAX_INCREASE_PCT, 50),
    largeDecreasePct: num(process.env.GOOGLE_ADS_BUDGET_LARGE_DECREASE_PCT, 50),
  };
}

export type MatchType = "EXACT" | "PHRASE" | "BROAD";
export type ExecAction =
  | { kind: "add_negative_keyword"; campaign: string; level: "campaign" | "ad_group"; adGroup?: string; text: string; matchType: MatchType }
  | { kind: "pause_campaign"; campaign: string }
  | { kind: "set_campaign_budget"; campaign: string; newDailyAmount: number; confirmLargeDecrease?: boolean };

/** Parse a proposal's `details.action` into a strict, executable action. Returns
 *  null when the proposal carries no executable action (advisory only). */
export function parseAction(details: Record<string, unknown>): ExecAction | { error: string } | null {
  const a = details?.action as Record<string, unknown> | undefined;
  if (!a || typeof a !== "object" || typeof a.kind !== "string") return null;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  switch (a.kind) {
    case "add_negative_keyword": {
      const campaign = str(a.campaign);
      const text = str(a.text);
      const matchType = str(a.matchType).toUpperCase() as MatchType;
      const level = str(a.level) === "ad_group" ? "ad_group" : "campaign";
      const adGroup = str(a.adGroup);
      if (!campaign || !text) return { error: "negative keyword needs campaign + text." };
      if (!["EXACT", "PHRASE", "BROAD"].includes(matchType)) return { error: "matchType must be EXACT, PHRASE or BROAD." };
      if (level === "ad_group" && !adGroup) return { error: "ad_group level needs an adGroup name." };
      return { kind: "add_negative_keyword", campaign, level, adGroup: adGroup || undefined, text, matchType };
    }
    case "pause_campaign": {
      const campaign = str(a.campaign);
      if (!campaign) return { error: "pause needs a campaign name." };
      return { kind: "pause_campaign", campaign };
    }
    case "set_campaign_budget": {
      const campaign = str(a.campaign);
      const newDailyAmount = Number(a.newDailyAmount);
      if (!campaign || !Number.isFinite(newDailyAmount) || newDailyAmount <= 0)
        return { error: "budget needs campaign + a positive newDailyAmount." };
      return { kind: "set_campaign_budget", campaign, newDailyAmount, confirmLargeDecrease: a.confirmLargeDecrease === true };
    }
    default:
      return { error: `Unknown action kind "${a.kind}".` };
  }
}

// ---- Guardrail checks (return null = ok, or an error string) ----
export function guardCustomer(customerId: string): string | null {
  if (!writeEnabled()) return "Writes are disabled (kill switch off).";
  if (!allowedCustomers().has(norm(customerId)))
    return `Customer ${customerId} is not on the write allowlist.`;
  return null;
}
export function guardCampaignWrite(campaignId: string): string | null {
  if (!allowedCampaigns().has(norm(campaignId)))
    return `Campaign ${campaignId} is not on the campaign write allowlist (required for pause/budget).`;
  return null;
}
export function guardBudget(
  currentMicros: number,
  nextMicros: number,
  confirmLargeDecrease: boolean,
): string | null {
  const caps = budgetCaps();
  const nextUnits = nextMicros / 1_000_000;
  if (nextUnits > caps.maxDailyUnits)
    return `New daily budget ${nextUnits} exceeds the hard cap (${caps.maxDailyUnits}).`;
  if (currentMicros > 0 && nextMicros > currentMicros * (1 + caps.maxIncreasePct / 100))
    return `Increase exceeds the max ${caps.maxIncreasePct}% step.`;
  if (currentMicros > 0 && nextMicros < currentMicros * (1 - caps.largeDecreasePct / 100) && !confirmLargeDecrease)
    return `Decrease over ${caps.largeDecreasePct}% needs confirmLargeDecrease=true.`;
  return null;
}

// ---- Mutate-operation builders (single op each; no batching) ----
export function negativeKeywordCreateOp(p: {
  customerId: string; level: "campaign" | "ad_group"; campaignId?: string; adGroupId?: string; text: string; matchType: MatchType;
}): unknown {
  const keyword = { text: p.text, matchType: p.matchType };
  return p.level === "ad_group"
    ? { adGroupCriterionOperation: { create: { adGroup: `customers/${p.customerId}/adGroups/${p.adGroupId}`, negative: true, keyword } } }
    : { campaignCriterionOperation: { create: { campaign: `customers/${p.customerId}/campaigns/${p.campaignId}`, negative: true, keyword } } };
}
export function negativeKeywordRemoveOp(level: "campaign" | "ad_group", resourceName: string): unknown {
  return level === "ad_group"
    ? { adGroupCriterionOperation: { remove: resourceName } }
    : { campaignCriterionOperation: { remove: resourceName } };
}
export function campaignStatusOp(customerId: string, campaignId: string, status: "PAUSED" | "ENABLED"): unknown {
  return {
    campaignOperation: {
      update: { resourceName: `customers/${customerId}/campaigns/${campaignId}`, status },
      updateMask: "status",
    },
  };
}
export function budgetUpdateOp(budgetResourceName: string, amountMicros: number): unknown {
  return {
    campaignBudgetOperation: {
      update: { resourceName: budgetResourceName, amountMicros: String(Math.round(amountMicros)) },
      updateMask: "amount_micros",
    },
  };
}

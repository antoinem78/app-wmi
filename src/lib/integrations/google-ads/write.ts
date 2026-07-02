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

import { entityConfig } from "@/lib/config";

const norm = (id: string) => id.replace(/[^0-9]/g, "");
const list = (v: string | undefined) =>
  new Set((v ?? "").split(",").map((s) => norm(s.trim())).filter(Boolean));

/** Kill switch — accepts true/True/TRUE (case- and whitespace-insensitive). */
export function writeEnabled(): boolean {
  return (process.env.GOOGLE_ADS_WRITE_ENABLED ?? "").trim().toLowerCase() === "true";
}
export function allowedCustomers(): Set<string> {
  return list(process.env.GOOGLE_ADS_WRITE_CUSTOMERS);
}
export function allowedCampaigns(): Set<string> {
  return list(process.env.GOOGLE_ADS_WRITE_CAMPAIGNS);
}
/** The "open WMI's whole book" switch: when true, MCC membership alone gates
 *  writes and the per-account allowlist is lifted. Default OFF (allowlist gates). */
export function allowAllMcc(): boolean {
  return (process.env.ALLOW_ALL_MCC_ACCOUNTS ?? "").trim().toLowerCase() === "true";
}
export function budgetCaps() {
  const num = (v: string | undefined, d: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : d;
  };
  // An explicit "0" disables budget writes entirely (per the rollout spec);
  // anything else falls back to the default ceiling.
  const rawDaily = (process.env.GOOGLE_ADS_BUDGET_MAX_DAILY ?? "").trim();
  return {
    maxDailyUnits: rawDaily === "0" ? 0 : num(rawDaily, 100),
    maxIncreasePct: num(process.env.GOOGLE_ADS_BUDGET_MAX_INCREASE_PCT, 50),
    largeDecreasePct: num(process.env.GOOGLE_ADS_BUDGET_LARGE_DECREASE_PCT, 50),
  };
}

export type MatchType = "EXACT" | "PHRASE" | "BROAD";
export type ExecAction =
  | { kind: "add_negative_keyword"; campaign: string; level: "campaign" | "ad_group"; adGroup?: string; text: string; matchType: MatchType }
  | { kind: "add_shared_negative"; text: string; matchType: MatchType }
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
    case "add_shared_negative": {
      const text = str(a.text);
      const matchType = (str(a.matchType).toUpperCase() || "EXACT") as MatchType;
      if (!text) return { error: "shared negative needs text." };
      if (!["EXACT", "PHRASE", "BROAD"].includes(matchType)) return { error: "matchType must be EXACT, PHRASE or BROAD." };
      return { kind: "add_shared_negative", text, matchType };
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
// Account allowlist (operational rollout control). Lifted when ALLOW_ALL_MCC_ACCOUNTS
// is on, so MCC membership alone gates. The MCC boundary + kill switch are enforced
// separately in the worker (guardWrite) and always apply.
export function guardAllowlist(customerId: string): string | null {
  if (allowAllMcc()) return null;
  if (!allowedCustomers().has(norm(customerId)))
    return `Customer ${customerId} is not on the write allowlist (and ALLOW_ALL_MCC_ACCOUNTS is off).`;
  return null;
}
export function guardCampaignWrite(campaignId: string): string | null {
  // "Open the whole book" lifts the per-campaign gate too — pause/budget then run
  // on any in-MCC campaign (account boundary + budget caps + kill switch still apply).
  if (allowAllMcc()) return null;
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
  if (caps.maxDailyUnits <= 0) return "Budget writes are disabled (GOOGLE_ADS_BUDGET_MAX_DAILY=0).";
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

// ---- Shared negative keyword list (account-level) ----
/** Stable, reused name for this deployment's managed shared negative set. */
export function sharedNegativeSetName(): string {
  return `${entityConfig.brandName} shared negatives`;
}
export function sharedSetCreateOp(customerId: string, tempResourceId: string, name: string): unknown {
  return {
    sharedSetOperation: {
      create: {
        resourceName: `customers/${customerId}/sharedSets/${tempResourceId}`,
        name,
        type: "NEGATIVE_KEYWORDS",
      },
    },
  };
}
export function sharedCriterionCreateOp(sharedSetResource: string, text: string, matchType: MatchType): unknown {
  return { sharedCriterionOperation: { create: { sharedSet: sharedSetResource, keyword: { text, matchType } } } };
}
export function campaignSharedSetCreateOp(customerId: string, campaignId: string, sharedSetResource: string): unknown {
  return {
    campaignSharedSetOperation: {
      create: { campaign: `customers/${customerId}/campaigns/${campaignId}`, sharedSet: sharedSetResource },
    },
  };
}
export function sharedCriterionRemoveOp(resourceName: string): unknown {
  return { sharedCriterionOperation: { remove: resourceName } };
}

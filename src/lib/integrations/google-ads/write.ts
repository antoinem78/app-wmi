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
export type CriterionType = "location" | "negative_location" | "language";
export type BiddingStrategy = "MAXIMIZE_CONVERSIONS" | "MAXIMIZE_CONVERSION_VALUE" | "TARGET_SPEND" | "MANUAL_CPC";
export type ExecAction =
  | { kind: "add_negative_keyword"; campaign: string; level: "campaign" | "ad_group"; adGroup?: string; text: string; matchType: MatchType }
  | { kind: "add_shared_negative"; text: string; matchType: MatchType }
  | { kind: "pause_campaign"; campaign: string }
  | { kind: "set_campaign_budget"; campaign: string; newDailyAmount: number; confirmLargeDecrease?: boolean }
  // ---- Widened 2026-09-03 (founder ruling: Oscar builds and optimises).
  // One operation per approval throughout, same as the original four.
  | { kind: "pause_ad_group"; campaign: string; adGroup: string }
  | { kind: "pause_ad"; campaign: string; adGroup: string; adId: string }
  | { kind: "attach_shared_set"; campaign: string; sharedSet: string }
  | { kind: "detach_shared_set"; campaign: string; sharedSet: string }
  | { kind: "add_campaign_criterion"; campaign: string; criterionType: CriterionType; constantId: string }
  | { kind: "remove_campaign_criterion"; campaign: string; criterionType: CriterionType; constantId: string }
  | { kind: "set_bidding_strategy"; campaign: string; strategy: BiddingStrategy; targetCpa?: number; targetRoas?: number }
  // ---- Merchant Center feed-layer overlays (founder-ruled 2026-08-26, built
  // 2026-09-04). One attribute per proposal; reversal is deleting the overlay
  // input so the primary feed's value returns. NEVER a store write.
  | { kind: "mc_set_title"; merchantId: string; offerId: string; contentLanguage: string; feedLabel: string; title: string }
  | { kind: "mc_set_price"; merchantId: string; offerId: string; contentLanguage: string; feedLabel: string; amount: number; currency: string };

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
    case "pause_ad_group": {
      const campaign = str(a.campaign), adGroup = str(a.adGroup);
      if (!campaign || !adGroup) return { error: "pause_ad_group needs campaign + adGroup." };
      return { kind: "pause_ad_group", campaign, adGroup };
    }
    case "pause_ad": {
      const campaign = str(a.campaign), adGroup = str(a.adGroup), adId = str(a.adId).replace(/\D/g, "");
      if (!campaign || !adGroup || !/^\d{6,}$/.test(adId))
        return { error: "pause_ad needs campaign, adGroup and a numeric adId (ad names are not unique)." };
      return { kind: "pause_ad", campaign, adGroup, adId };
    }
    case "attach_shared_set":
    case "detach_shared_set": {
      const campaign = str(a.campaign), sharedSet = str(a.sharedSet);
      if (!campaign || !sharedSet) return { error: `${a.kind} needs campaign + sharedSet (name or id).` };
      return { kind: a.kind, campaign, sharedSet };
    }
    case "add_campaign_criterion":
    case "remove_campaign_criterion": {
      const campaign = str(a.campaign);
      const criterionType = str(a.criterionType) as CriterionType;
      const constantId = str(a.constantId).replace(/\D/g, "");
      if (!campaign || !constantId) return { error: `${a.kind} needs campaign + a numeric constantId.` };
      if (!["location", "negative_location", "language"].includes(criterionType))
        return { error: "criterionType must be location, negative_location or language." };
      return { kind: a.kind, campaign, criterionType, constantId };
    }
    case "set_bidding_strategy": {
      const campaign = str(a.campaign);
      const strategy = str(a.strategy).toUpperCase() as BiddingStrategy;
      if (!campaign) return { error: "set_bidding_strategy needs a campaign." };
      if (!["MAXIMIZE_CONVERSIONS", "MAXIMIZE_CONVERSION_VALUE", "TARGET_SPEND", "MANUAL_CPC"].includes(strategy))
        return { error: "strategy must be MAXIMIZE_CONVERSIONS, MAXIMIZE_CONVERSION_VALUE, TARGET_SPEND or MANUAL_CPC." };
      const targetCpa = a.targetCpa != null ? Number(a.targetCpa) : undefined;
      const targetRoas = a.targetRoas != null ? Number(a.targetRoas) : undefined;
      if (targetCpa !== undefined && (!Number.isFinite(targetCpa) || targetCpa <= 0))
        return { error: "targetCpa must be a positive number in account currency units." };
      if (targetRoas !== undefined && (!Number.isFinite(targetRoas) || targetRoas <= 0 || targetRoas > 100))
        return { error: "targetRoas must be a positive multiple (e.g. 3.5 for 350%), not a percentage." };
      if (targetCpa !== undefined && strategy !== "MAXIMIZE_CONVERSIONS")
        return { error: "targetCpa only applies to MAXIMIZE_CONVERSIONS." };
      if (targetRoas !== undefined && strategy !== "MAXIMIZE_CONVERSION_VALUE")
        return { error: "targetRoas only applies to MAXIMIZE_CONVERSION_VALUE." };
      return { kind: "set_bidding_strategy", campaign, strategy, targetCpa, targetRoas };
    }
    case "mc_set_title":
    case "mc_set_price": {
      const merchantId = str(a.merchantId ?? a.merchant_id).replace(/\D/g, "");
      const offerId = str(a.offerId ?? a.offer_id);
      const contentLanguage = str(a.contentLanguage ?? a.content_language);
      const feedLabel = str(a.feedLabel ?? a.feed_label);
      if (!merchantId || !offerId || !contentLanguage || !feedLabel)
        return { error: `${a.kind} needs merchantId, offerId, contentLanguage and feedLabel (exactly as the product carries them; feed labels are not always country codes).` };
      if (a.kind === "mc_set_title") {
        const title = str(a.title);
        if (!title || title.length > 150) return { error: "mc_set_title needs a title of 1-150 characters." };
        return { kind: "mc_set_title", merchantId, offerId, contentLanguage, feedLabel, title };
      }
      const amount = Number(a.amount);
      const currency = str(a.currency).toUpperCase();
      if (!Number.isFinite(amount) || amount <= 0) return { error: "mc_set_price needs a positive amount in currency units." };
      if (!/^[A-Z]{3}$/.test(currency)) return { error: "mc_set_price needs a 3-letter currency code matching the feed." };
      return { kind: "mc_set_price", merchantId, offerId, contentLanguage, feedLabel, amount, currency };
    }
    default:
      return { error: `Unknown action kind "${a.kind}".` };
  }
}

/** Merchant Center writes get their own kill switch and allowlist: a NEW write
 *  surface class starts narrow and there is deliberately no ALLOW_ALL lift. */
export function merchantWriteEnabled(): boolean {
  return (process.env.MERCHANT_WRITE_ENABLED ?? "").trim().toLowerCase() === "true";
}
export function guardMerchantAllowlist(merchantId: string): string | null {
  const allowed = list(process.env.MERCHANT_WRITE_ACCOUNTS);
  if (!allowed.has(norm(merchantId)))
    return `Merchant account ${merchantId} is not on MERCHANT_WRITE_ACCOUNTS.`;
  return null;
}
export function isMerchantAction(a: ExecAction): a is Extract<ExecAction, { kind: "mc_set_title" | "mc_set_price" }> {
  return a.kind === "mc_set_title" || a.kind === "mc_set_price";
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

// ---- Widened move classes (2026-09-03) ----
export function adGroupStatusOp(customerId: string, adGroupId: string, status: "PAUSED" | "ENABLED"): unknown {
  return {
    adGroupOperation: {
      update: { resourceName: `customers/${customerId}/adGroups/${adGroupId}`, status },
      updateMask: "status",
    },
  };
}
export function adGroupAdStatusOp(customerId: string, adGroupId: string, adId: string, status: "PAUSED" | "ENABLED"): unknown {
  return {
    adGroupAdOperation: {
      update: { resourceName: `customers/${customerId}/adGroupAds/${adGroupId}~${adId}`, status },
      updateMask: "status",
    },
  };
}
export function campaignSharedSetRemoveOp(resourceName: string): unknown {
  return { campaignSharedSetOperation: { remove: resourceName } };
}
/** Campaign criterion for a geo target or language constant. negative_location
 *  is the location criterion with negative: true (an exclusion). */
export function campaignCriterionCreateOp(
  customerId: string, campaignId: string, criterionType: CriterionType, constantId: string,
): unknown {
  const base: Record<string, unknown> = { campaign: `customers/${customerId}/campaigns/${campaignId}` };
  if (criterionType === "language") base.language = { languageConstant: `languageConstants/${constantId}` };
  else {
    base.location = { geoTargetConstant: `geoTargetConstants/${constantId}` };
    if (criterionType === "negative_location") base.negative = true;
  }
  return { campaignCriterionOperation: { create: base } };
}
export function campaignCriterionRemoveOp(resourceName: string): unknown {
  return { campaignCriterionOperation: { remove: resourceName } };
}
/** Switch a campaign's bidding scheme. The REST API rejects a field mask that
 *  names a message with subfields ("The field mask updated a field with
 *  subfields", proven on a validateOnly probe 2026-09-03), so the mask names a
 *  SUBFIELD of the new scheme: setting a oneof subfield flips the whole scheme,
 *  and an explicit zero target means "no target" in every scheme that takes one. */
export function campaignBiddingOp(
  customerId: string, campaignId: string, strategy: BiddingStrategy,
  targets: { targetCpaMicros?: number; targetRoas?: number },
): unknown {
  const update: Record<string, unknown> = { resourceName: `customers/${customerId}/campaigns/${campaignId}` };
  let mask = "";
  switch (strategy) {
    case "MAXIMIZE_CONVERSIONS":
      update.maximizeConversions = { targetCpaMicros: String(Math.round(targets.targetCpaMicros ?? 0)) };
      mask = "maximize_conversions.target_cpa_micros";
      break;
    case "MAXIMIZE_CONVERSION_VALUE":
      update.maximizeConversionValue = { targetRoas: targets.targetRoas ?? 0 };
      mask = "maximize_conversion_value.target_roas";
      break;
    case "TARGET_SPEND":
      update.targetSpend = { cpcBidCeilingMicros: "0" };
      mask = "target_spend.cpc_bid_ceiling_micros";
      break;
    case "MANUAL_CPC":
      update.manualCpc = { enhancedCpcEnabled: false };
      mask = "manual_cpc.enhanced_cpc_enabled";
      break;
  }
  return { campaignOperation: { update, updateMask: mask } };
}

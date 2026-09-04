// GOOGLE_build: deterministic Search-campaign construction from a spec.
//
// The Google equivalent of BERNARD_build, holding the same contract (Executor
// Contract v2 principles, applied where the Google credentials actually live,
// which is this portal rather than the substrate):
//   - the spec is turned into ONE atomic googleAds:mutate call. partialFailure
//     stays false, so the build either fully exists or nothing does; there is
//     no Meta-style half-built cascade to clean up.
//   - the CAMPAIGN is created PAUSED, always, whatever the spec says. Ad groups,
//     keywords and ads are created ENABLED underneath it, so the founder's
//     activation is one action (enable the campaign) rather than a scavenger
//     hunt. Nothing can serve while the campaign is paused.
//   - pre-flight gates run before any network call: the global write kill
//     switch, the customer allowlist, a budget ceiling, an operation-count
//     budget, and RSA text limits (Google would reject them anyway, but a
//     named local error beats a mutate error).
//   - idempotency: a campaign with the same name already in the account makes
//     the build refuse rather than duplicate.
//   - verification: after a real build the campaign, groups, keywords and ads
//     are re-read from the API and counted against the spec. Claimed is not
//     true until read.
//   - validate_only runs the identical mutate through Google's server-side
//     validation with NO change, as a founder-facing dry run.
import { gaqlSearch, googleAdsMutate } from "@/lib/integrations/google-ads";
import { writeEnabled, guardAllowlist, budgetCaps } from "@/lib/integrations/google-ads/write";
import { recordWriteAudit } from "@/lib/write-audit";

const MAX_OPS = 80;
const norm = (id: string) => id.replace(/[^0-9]/g, "");

export interface BuildKeyword { text: string; match: "EXACT" | "PHRASE" | "BROAD" }
export interface BuildAd {
  headlines: string[];       // 3..15, each <= 30 chars
  descriptions: string[];    // 2..4, each <= 90 chars
  final_url: string;
  path1?: string;            // <= 15 chars
  path2?: string;
}
export type WebpageOperand = "URL" | "CATEGORY" | "PAGE_TITLE" | "PAGE_CONTENT" | "CUSTOM_LABEL";
export interface WebpageTarget {
  /** Display name for the auto-target ("All pages", "Product pages"). */
  name: string;
  /** Every condition must hold (AND). URL means "URL contains argument". */
  conditions: { operand: WebpageOperand; argument: string }[];
}
export interface BuildAdGroup {
  name: string;
  cpc_bid?: number;          // account currency units; manual/eCPC bidding
  /** search type: required. */
  keywords?: BuildKeyword[];
  /** search type: required. */
  ads?: BuildAd[];
  /** dsa type: required, at least one auto-target. */
  webpage_targets?: WebpageTarget[];
  /** dsa type: required. Google generates headline and landing page; each entry
   *  is one ad's description line(s), each <= 90 chars. */
  dsa_ads?: { description: string; description2?: string }[];
  // shopping type: neither keywords nor ads; each group gets one product ad and
  // a root "all products" listing group (subdividing the tree is build-order
  // step 9, a separate surface with its own diff).
}
export type BuildCampaignType = "search" | "shopping" | "dsa";
export interface GoogleBuildSpec {
  account: string;           // customer id, digits or formatted
  build_ref: string;         // recorded in the audit trail
  campaign: {
    /** Defaults to "search"; "shopping" is Standard Shopping (never PMax). */
    type?: BuildCampaignType;
    name: string;
    daily_budget: number;    // account currency units
    bidding: "maximize_conversions" | "maximize_clicks" | "manual_cpc" | "target_roas";
    target_cpa?: number;     // account currency units, optional with maximize_conversions
    target_roas?: number;    // a multiple like 3.5; required with target_roas bidding
    /** shopping: the linked Merchant Center account id. Required. */
    merchant_id?: string | number;
    /** shopping: 0 (default) to 2; higher priority wins product auctions. */
    campaign_priority?: number;
    /** shopping: feed label, only when the feed uses one. */
    feed_label?: string;
    /** dsa: the site Google crawls for landing pages. Required. */
    dsa?: { domain: string; language?: string };
    /** Geo target constant ids (e.g. 2826 = United Kingdom, 20339 = Essex).
     *  "GB" is accepted as shorthand for 2826. */
    geo: (string | number)[];
    /** Negative keywords applied at campaign level (valid on all three types). */
    negatives?: BuildKeyword[];
    /** Mon-Fri window in the account timezone; omit for always-on. */
    schedule?: { days: "MON_FRI" | "ALL_WEEK"; start_hour: number; end_hour: number };
    ad_groups: BuildAdGroup[];
  };
}

export interface GoogleBuildResult {
  ok: boolean;
  verdict: "built" | "validated" | "rejected" | "build_failed" | "verify_mismatch";
  error?: string;
  campaign_resource?: string;
  op_count?: number;
  verified?: { campaign_status?: string; ad_groups: number; keywords: number; ads: number };
  expected?: { ad_groups: number; keywords: number; ads: number };
}

const GEO_SHORTHAND: Record<string, number> = { GB: 2826, UK: 2826, US: 2840, FR: 2250, BE: 2056 };
const DAYS_MON_FRI = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"];
const DAYS_ALL = [...DAYS_MON_FRI, "SATURDAY", "SUNDAY"];

/** Pre-flight validation + operation construction. Pure; exported for tests. */
export function planBuild(spec: GoogleBuildSpec): { error?: string; ops?: unknown[] } {
  const cid = norm(spec.account || "");
  const c = spec.campaign;
  if (!cid) return { error: "account (customer id) is required." };
  if (!spec.build_ref?.trim()) return { error: "build_ref is required (idempotency + audit)." };
  if (!c?.name?.trim()) return { error: "campaign.name is required." };
  if (!Number.isFinite(c.daily_budget) || c.daily_budget <= 0) return { error: "campaign.daily_budget must be a positive number (account currency units)." };
  const caps = budgetCaps();
  if (caps.maxDailyUnits <= 0) return { error: "Budget writes are disabled (GOOGLE_ADS_BUDGET_MAX_DAILY=0)." };
  if (c.daily_budget > caps.maxDailyUnits)
    return { error: `daily_budget ${c.daily_budget} exceeds the hard cap (${caps.maxDailyUnits}). The cap is an env-level guardrail, not negotiable from a spec.` };
  if (!Array.isArray(c.geo) || !c.geo.length) return { error: "campaign.geo needs at least one geo target (id, or GB shorthand)." };
  if (!Array.isArray(c.ad_groups) || !c.ad_groups.length) return { error: "at least one ad group is required." };

  const type: BuildCampaignType = c.type ?? "search";
  if (!["search", "shopping", "dsa"].includes(type)) return { error: `unknown campaign type "${type}" (search, shopping or dsa; PMax and Demand Gen are deliberately not buildable).` };
  if (c.bidding === "target_roas" && !(Number.isFinite(c.target_roas) && (c.target_roas as number) > 0))
    return { error: "target_roas bidding needs campaign.target_roas (a positive multiple like 3.5)." };
  if (type === "shopping") {
    if (!norm(String(c.merchant_id ?? ""))) return { error: "shopping needs campaign.merchant_id (the linked Merchant Center account id)." };
    if (c.campaign_priority != null && ![0, 1, 2].includes(Number(c.campaign_priority)))
      return { error: "campaign_priority must be 0, 1 or 2." };
    if (c.bidding === "maximize_conversions") return { error: "Standard Shopping does not take maximize_conversions; use manual_cpc, maximize_clicks or target_roas." };
  }
  if (type === "dsa") {
    const domain = c.dsa?.domain?.trim() ?? "";
    if (!domain || /^https?:/i.test(domain)) return { error: "dsa needs campaign.dsa.domain as a bare domain (example.co.uk, no protocol)." };
  }

  for (const g of c.ad_groups) {
    if (!g.name?.trim()) return { error: "every ad group needs a name." };
    if (type === "search") {
      if (!g.keywords?.length) return { error: `ad group "${g.name}" has no keywords.` };
      if (!g.ads?.length) return { error: `ad group "${g.name}" has no ads.` };
      for (const k of g.keywords) {
        if (!k.text?.trim()) return { error: `empty keyword in "${g.name}".` };
        if (!["EXACT", "PHRASE", "BROAD"].includes(k.match)) return { error: `keyword "${k.text}": match must be EXACT, PHRASE or BROAD.` };
      }
      for (const a of g.ads) {
        if (!a.final_url?.startsWith("http")) return { error: `ad in "${g.name}" needs a valid final_url.` };
        if (!a.headlines || a.headlines.length < 3 || a.headlines.length > 15)
          return { error: `ad in "${g.name}": 3 to 15 headlines required (got ${a.headlines?.length ?? 0}).` };
        if (!a.descriptions || a.descriptions.length < 2 || a.descriptions.length > 4)
          return { error: `ad in "${g.name}": 2 to 4 descriptions required (got ${a.descriptions?.length ?? 0}).` };
        const badH = a.headlines.find((h) => h.length > 30);
        if (badH) return { error: `headline over 30 chars: "${badH}"` };
        const badD = a.descriptions.find((d) => d.length > 90);
        if (badD) return { error: `description over 90 chars: "${badD.slice(0, 60)}…"` };
        if (a.path1 && a.path1.length > 15) return { error: `path1 over 15 chars: "${a.path1}"` };
        if (a.path2 && a.path2.length > 15) return { error: `path2 over 15 chars: "${a.path2}"` };
      }
    } else if (type === "shopping") {
      if (g.keywords?.length || g.ads?.length || g.webpage_targets?.length || g.dsa_ads?.length)
        return { error: `shopping ad group "${g.name}" takes only name and cpc_bid: products come from the feed, and the listing-group tree is a separate surface.` };
    } else {
      if (!g.webpage_targets?.length) return { error: `dsa ad group "${g.name}" needs at least one webpage target.` };
      if (!g.dsa_ads?.length) return { error: `dsa ad group "${g.name}" needs at least one dsa ad (a description line).` };
      if (g.keywords?.length || g.ads?.length) return { error: `dsa ad group "${g.name}" takes webpage_targets and dsa_ads, not keywords or RSA ads.` };
      for (const w of g.webpage_targets) {
        if (!w.name?.trim()) return { error: `a webpage target in "${g.name}" needs a name.` };
        if (!w.conditions?.length) return { error: `webpage target "${w.name}" needs at least one condition.` };
        for (const cond of w.conditions) {
          if (!["URL", "CATEGORY", "PAGE_TITLE", "PAGE_CONTENT", "CUSTOM_LABEL"].includes(cond.operand))
            return { error: `webpage condition operand "${cond.operand}" is not URL, CATEGORY, PAGE_TITLE, PAGE_CONTENT or CUSTOM_LABEL.` };
          if (!cond.argument?.trim()) return { error: `webpage condition in "${w.name}" needs an argument.` };
        }
      }
      for (const a of g.dsa_ads) {
        if (!a.description?.trim()) return { error: `a dsa ad in "${g.name}" has no description.` };
        if (a.description.length > 90) return { error: `dsa description over 90 chars: "${a.description.slice(0, 60)}…"` };
        if (a.description2 && a.description2.length > 90) return { error: `dsa description2 over 90 chars.` };
      }
    }
  }
  if (c.schedule) {
    const s = c.schedule;
    if (!(s.start_hour >= 0 && s.start_hour < 24 && s.end_hour > s.start_hour && s.end_hour <= 24))
      return { error: "schedule hours must satisfy 0 <= start < end <= 24." };
  }

  const ops: unknown[] = [];
  const budgetRes = `customers/${cid}/campaignBudgets/-1`;
  const campaignRes = `customers/${cid}/campaigns/-2`;

  ops.push({ campaignBudgetOperation: { create: {
    resourceName: budgetRes,
    name: `${c.name} budget`,
    amountMicros: String(Math.round(c.daily_budget * 1_000_000)),
    deliveryMethod: "STANDARD",
    explicitlyShared: false,
  } } });

  const bidding: Record<string, unknown> =
    c.bidding === "maximize_clicks" ? { targetSpend: {} }
    : c.bidding === "manual_cpc" ? { manualCpc: { enhancedCpcEnabled: false } }
    : c.bidding === "target_roas" ? { targetRoas: { targetRoas: c.target_roas } }
    : c.target_cpa ? { maximizeConversions: { targetCpaMicros: String(Math.round(c.target_cpa * 1_000_000)) } }
    : { maximizeConversions: {} };

  const typeFields: Record<string, unknown> =
    type === "shopping" ? {
      advertisingChannelType: "SHOPPING",
      shoppingSetting: {
        merchantId: norm(String(c.merchant_id)),
        campaignPriority: Number(c.campaign_priority ?? 0),
        ...(c.feed_label ? { feedLabel: c.feed_label } : {}),
      },
      // Standard Shopping serves on Google Search; partners stay off, same
      // conservative default as Search builds.
      networkSettings: { targetGoogleSearch: true, targetSearchNetwork: false, targetContentNetwork: false, targetPartnerSearchNetwork: false },
    } : type === "dsa" ? {
      advertisingChannelType: "SEARCH",
      dynamicSearchAdsSetting: { domainName: c.dsa!.domain.trim(), languageCode: c.dsa?.language?.trim() || "en" },
      networkSettings: { targetGoogleSearch: true, targetSearchNetwork: false, targetContentNetwork: false, targetPartnerSearchNetwork: false },
    } : {
      advertisingChannelType: "SEARCH",
      networkSettings: { targetGoogleSearch: true, targetSearchNetwork: false, targetContentNetwork: false, targetPartnerSearchNetwork: false },
    };

  ops.push({ campaignOperation: { create: {
    resourceName: campaignRes,
    name: c.name,
    status: "PAUSED", // non-negotiable: the founder activates
    campaignBudget: budgetRes,
    ...bidding,
    ...typeFields,
    containsEuPoliticalAdvertising: "DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING",
  } } });

  for (const g of c.geo) {
    const id = typeof g === "string" && GEO_SHORTHAND[g.toUpperCase()] ? GEO_SHORTHAND[g.toUpperCase()] : norm(String(g));
    if (!id) return { error: `unrecognised geo target "${g}" (use a geo target constant id, or GB).` };
    ops.push({ campaignCriterionOperation: { create: {
      campaign: campaignRes, location: { geoTargetConstant: `geoTargetConstants/${id}` } } } });
  }
  for (const n of c.negatives ?? []) {
    ops.push({ campaignCriterionOperation: { create: {
      campaign: campaignRes, negative: true, keyword: { text: n.text, matchType: n.match } } } });
  }
  if (c.schedule) {
    const days = c.schedule.days === "ALL_WEEK" ? DAYS_ALL : DAYS_MON_FRI;
    for (const d of days) {
      ops.push({ campaignCriterionOperation: { create: {
        campaign: campaignRes,
        adSchedule: { dayOfWeek: d, startHour: c.schedule.start_hour, startMinute: "ZERO", endHour: c.schedule.end_hour, endMinute: "ZERO" } } } });
    }
  }

  let temp = -3;
  const groupType = type === "shopping" ? "SHOPPING_PRODUCT_ADS" : type === "dsa" ? "SEARCH_DYNAMIC_ADS" : "SEARCH_STANDARD";
  for (const g of c.ad_groups) {
    const groupRes = `customers/${cid}/adGroups/${temp--}`;
    ops.push({ adGroupOperation: { create: {
      resourceName: groupRes, name: g.name, campaign: campaignRes,
      type: groupType, status: "ENABLED",
      ...(g.cpc_bid ? { cpcBidMicros: String(Math.round(g.cpc_bid * 1_000_000)) } : {}),
    } } });

    if (type === "shopping") {
      // The root "all products" listing group, without which a shopping ad
      // group cannot serve, and one product ad. Subdividing the tree is
      // build-order step 9, deliberately not here.
      ops.push({ adGroupCriterionOperation: { create: {
        adGroup: groupRes, status: "ENABLED", listingGroup: { type: "UNIT" },
        ...(g.cpc_bid ? { cpcBidMicros: String(Math.round(g.cpc_bid * 1_000_000)) } : {}),
      } } });
      ops.push({ adGroupAdOperation: { create: {
        adGroup: groupRes, status: "ENABLED", ad: { shoppingProductAd: {} },
      } } });
      continue;
    }

    if (type === "dsa") {
      for (const w of g.webpage_targets ?? []) {
        ops.push({ adGroupCriterionOperation: { create: {
          adGroup: groupRes, status: "ENABLED",
          webpage: {
            criterionName: w.name,
            conditions: w.conditions.map((cond) => ({ operand: cond.operand, argument: cond.argument })),
          },
        } } });
      }
      for (const a of g.dsa_ads ?? []) {
        ops.push({ adGroupAdOperation: { create: {
          adGroup: groupRes, status: "ENABLED",
          ad: { expandedDynamicSearchAd: { description: a.description, ...(a.description2 ? { description2: a.description2 } : {}) } },
        } } });
      }
      continue;
    }

    for (const k of g.keywords ?? []) {
      ops.push({ adGroupCriterionOperation: { create: {
        adGroup: groupRes, status: "ENABLED", keyword: { text: k.text, matchType: k.match } } } });
    }
    for (const a of g.ads ?? []) {
      ops.push({ adGroupAdOperation: { create: {
        adGroup: groupRes, status: "ENABLED",
        ad: {
          finalUrls: [a.final_url],
          responsiveSearchAd: {
            headlines: a.headlines.map((t) => ({ text: t })),
            descriptions: a.descriptions.map((t) => ({ text: t })),
            ...(a.path1 ? { path1: a.path1 } : {}), ...(a.path2 ? { path2: a.path2 } : {}),
          },
        },
      } } });
    }
  }

  if (ops.length > MAX_OPS) return { error: `spec needs ${ops.length} operations, the build budget allows ${MAX_OPS}.` };
  return { ops };
}

export async function buildGoogleCampaign(
  spec: GoogleBuildSpec,
  actor: string,
  opts: { validateOnly?: boolean } = {},
): Promise<GoogleBuildResult> {
  const cid = norm(spec.account || "");
  const phase = opts.validateOnly ? "dry_run" : "apply";
  const audit = (result: "ok" | "blocked" | "failed", detail: Record<string, unknown>) =>
    recordWriteAudit({ customerId: cid, action: "google_build", phase, approver: actor,
      allowlistCheck: guardAllowlist(cid) ? "fail" : "ok", result, detail: { build_ref: spec.build_ref, ...detail } });

  // Gates, in the order they should trip.
  if (!writeEnabled()) { await audit("blocked", { gate: "kill_switch" }); return { ok: false, verdict: "rejected", error: "Google Ads writes are disabled (GOOGLE_ADS_WRITE_ENABLED)." }; }
  const allow = guardAllowlist(cid);
  if (allow) { await audit("blocked", { gate: "allowlist" }); return { ok: false, verdict: "rejected", error: allow }; }

  const plan = planBuild(spec);
  if (plan.error || !plan.ops) { await audit("blocked", { gate: "spec", error: plan.error }); return { ok: false, verdict: "rejected", error: plan.error }; }

  // Idempotency: same campaign name already present -> refuse, never duplicate.
  try {
    const existing = await gaqlSearch(cid,
      `SELECT campaign.id, campaign.name FROM campaign WHERE campaign.name = '${spec.campaign.name.replace(/'/g, "\\'")}'`);
    if (Array.isArray(existing) && existing.length) {
      await audit("blocked", { gate: "idempotency" });
      return { ok: false, verdict: "rejected", error: `A campaign named "${spec.campaign.name}" already exists in ${cid}. Change the name or reference the existing campaign.` };
    }
  } catch (e) {
    await audit("failed", { gate: "idempotency_read", error: String(e) });
    return { ok: false, verdict: "rejected", error: `Could not check for an existing campaign before building: ${e instanceof Error ? e.message : String(e)}` };
  }

  try {
    const res = await googleAdsMutate(cid, plan.ops, { validateOnly: opts.validateOnly ?? false, partialFailure: false });
    if (opts.validateOnly) {
      await audit("ok", { validate_only: true, op_count: plan.ops.length });
      return { ok: true, verdict: "validated", op_count: plan.ops.length };
    }
    const responses = res.mutateOperationResponses ?? [];
    const campaignRes = responses
      .map((r) => (r.campaignResult as { resourceName?: string } | undefined)?.resourceName)
      .find(Boolean);

    // Verify by re-read: claimed is not true until read. "keywords" counts the
    // ad-group targeting criteria for the campaign's type: keywords on search,
    // root listing groups on shopping, webpage auto-targets on dsa.
    const type = spec.campaign.type ?? "search";
    const expected = {
      ad_groups: spec.campaign.ad_groups.length,
      keywords: type === "shopping" ? spec.campaign.ad_groups.length
        : type === "dsa" ? spec.campaign.ad_groups.reduce((n, g) => n + (g.webpage_targets?.length ?? 0), 0)
        : spec.campaign.ad_groups.reduce((n, g) => n + (g.keywords?.length ?? 0), 0),
      ads: type === "shopping" ? spec.campaign.ad_groups.length
        : type === "dsa" ? spec.campaign.ad_groups.reduce((n, g) => n + (g.dsa_ads?.length ?? 0), 0)
        : spec.campaign.ad_groups.reduce((n, g) => n + (g.ads?.length ?? 0), 0),
    };
    const criterionGaqlType = type === "shopping" ? "LISTING_GROUP" : type === "dsa" ? "WEBPAGE" : "KEYWORD";
    let verified = { campaign_status: undefined as string | undefined, ad_groups: 0, keywords: 0, ads: 0 };
    try {
      const cRows = await gaqlSearch(cid, `SELECT campaign.status FROM campaign WHERE campaign.resource_name = '${campaignRes}'`);
      verified.campaign_status = (cRows?.[0] as { campaign?: { status?: string } })?.campaign?.status;
      const g = await gaqlSearch(cid, `SELECT ad_group.id FROM ad_group WHERE campaign.resource_name = '${campaignRes}'`);
      const k = await gaqlSearch(cid, `SELECT ad_group_criterion.criterion_id FROM ad_group_criterion WHERE campaign.resource_name = '${campaignRes}' AND ad_group_criterion.type = '${criterionGaqlType}' AND ad_group_criterion.negative = FALSE`);
      const a = await gaqlSearch(cid, `SELECT ad_group_ad.ad.id FROM ad_group_ad WHERE campaign.resource_name = '${campaignRes}'`);
      verified = { campaign_status: verified.campaign_status, ad_groups: g?.length ?? 0, keywords: k?.length ?? 0, ads: a?.length ?? 0 };
    } catch {
      /* verification read failed; report it rather than fake it */
    }
    const matches = verified.campaign_status === "PAUSED"
      && verified.ad_groups === expected.ad_groups
      && verified.keywords === expected.keywords
      && verified.ads === expected.ads;
    await audit("ok", { op_count: plan.ops.length, campaign: campaignRes, verified, expected, matches });
    return {
      ok: matches, verdict: matches ? "built" : "verify_mismatch",
      campaign_resource: campaignRes, op_count: plan.ops.length, verified, expected,
      ...(matches ? {} : { error: "Build responded but the read-back does not match the spec. Nothing was activated; inspect before retrying." }),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await audit("failed", { error: msg.slice(0, 500) });
    return { ok: false, verdict: "build_failed", error: msg };
  }
}

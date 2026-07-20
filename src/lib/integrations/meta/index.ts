// Meta (Facebook) Ads read layer — Bernard's ground truth from the portal.
// STRICTLY READ-ONLY: every call here is a GET against the Graph API using the
// system-user token. The account roster is whatever that token can see, so
// assigning an account to the system user in Business Manager puts it in reach
// immediately — no manual registration needed for reads/audits. (Executor
// dispatch still requires lab onboarding in the substrate.)
const GRAPH = "https://graph.facebook.com/v21.0";

function token(): string | null {
  return process.env.META_ADS_TOKEN ?? null;
}

export function metaConfigured(): boolean {
  return token() !== null;
}

/** "575423175548816" | "act_575..." -> "act_575..." (and bare digits variant) */
export function normalizeActId(ref: string): { act: string; digits: string } {
  const digits = ref.trim().replace(/^act_/, "");
  return { act: `act_${digits}`, digits };
}

// GET with error capture — callers get { data } or { error }, never a throw,
// so a single failed read degrades the audit instead of killing it.
async function graphGet(path: string, params: Record<string, string> = {}): Promise<{ data?: unknown; error?: string }> {
  const tk = token();
  if (!tk) return { error: "META_ADS_TOKEN is not configured on this deployment." };
  const qs = new URLSearchParams({ ...params, access_token: tk });
  try {
    const res = await fetch(`${GRAPH}/${path}?${qs}`, { cache: "no-store" });
    const json = (await res.json()) as { error?: { message?: string }; data?: unknown };
    if (!res.ok || json.error) {
      return { error: json.error?.message ?? `Graph API answered ${res.status}` };
    }
    return { data: json };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

/** Everything under `data` (Graph list envelope), or []. */
function rows(r: { data?: unknown }): Record<string, unknown>[] {
  const d = (r.data as { data?: unknown } | undefined)?.data;
  return Array.isArray(d) ? (d as Record<string, unknown>[]) : [];
}

export interface MetaAccount {
  accountId: string;
  name: string;
  status: number; // 1 active, 2 disabled, 3 unsettled, 101 closed…
  currency: string;
  timezone: string;
  business: string | null;
  amountSpent: number; // lifetime, account currency
}

/** Every ad account the system user can see, live from the token. */
export async function listMetaAdAccounts(): Promise<MetaAccount[] | { error: string }> {
  const r = await graphGet("me/adaccounts", {
    fields: "name,account_id,account_status,currency,timezone_name,amount_spent,business{name}",
    limit: "100",
  });
  if (r.error) return { error: r.error };
  return rows(r).map((a) => ({
    accountId: String(a.account_id ?? ""),
    name: String(a.name ?? ""),
    status: Number(a.account_status ?? 0),
    currency: String(a.currency ?? ""),
    timezone: String(a.timezone_name ?? ""),
    business: ((a.business as { name?: string } | undefined)?.name ?? null),
    amountSpent: Number(a.amount_spent ?? 0) / 100, // Graph returns minor units
  }));
}

// ---- Audit data assembly ----

const ymd = (d: Date) => d.toISOString().slice(0, 10);

// Keep only the actions that matter for an audit read.
const KEY_ACTIONS = new Set([
  "purchase", "omni_purchase", "offsite_conversion.fb_pixel_purchase",
  "lead", "onsite_conversion.lead_grouped", "offsite_conversion.fb_pixel_lead",
  "link_click", "landing_page_view", "initiate_checkout", "add_to_cart",
  "onsite_conversion.messaging_conversation_started_7d",
]);
function compactActions(list: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (Array.isArray(list)) {
    for (const a of list as { action_type?: string; value?: string }[]) {
      if (a.action_type && KEY_ACTIONS.has(a.action_type)) out[a.action_type] = Number(a.value ?? 0);
    }
  }
  return out;
}

function compactInsights(row: Record<string, unknown> | undefined) {
  if (!row) return null;
  const roas = Array.isArray(row.purchase_roas)
    ? Number((row.purchase_roas as { value?: string }[])[0]?.value ?? 0)
    : null;
  return {
    spend: Number(row.spend ?? 0),
    impressions: Number(row.impressions ?? 0),
    reach: Number(row.reach ?? 0),
    frequency: Number(Number(row.frequency ?? 0).toFixed(2)),
    clicks: Number(row.clicks ?? 0),
    ctr: Number(Number(row.ctr ?? 0).toFixed(3)),
    cpm: Number(Number(row.cpm ?? 0).toFixed(2)),
    cpc: Number(Number(row.cpc ?? 0).toFixed(3)),
    actions: compactActions(row.actions),
    actionValues: compactActions(row.action_values),
    purchaseRoas: roas,
  };
}

// Summarise a targeting spec instead of dumping it (they run to kilobytes).
function compactTargeting(t: unknown) {
  if (!t || typeof t !== "object") return null;
  const g = t as Record<string, unknown>;
  const geo = (g.geo_locations as { countries?: string[]; cities?: unknown[] } | undefined) ?? {};
  return {
    ageRange: `${g.age_min ?? "?"}-${g.age_max ?? "?"}`,
    genders: (g.genders as number[] | undefined) ?? "all",
    countries: geo.countries ?? [],
    cities: Array.isArray(geo.cities) ? geo.cities.length : 0,
    customAudiences: Array.isArray(g.custom_audiences) ? (g.custom_audiences as unknown[]).length : 0,
    excludedCustomAudiences: Array.isArray(g.excluded_custom_audiences) ? (g.excluded_custom_audiences as unknown[]).length : 0,
    interests: Array.isArray((g.flexible_spec as unknown[] | undefined)) ? "flexible_spec set" : (Array.isArray(g.interests) ? (g.interests as unknown[]).length : 0),
    advantageAudience: g.targeting_automation ?? null,
  };
}

/**
 * Full read-only audit dataset for one account over `days` (vs the prior
 * window). Every section is best-effort: a failed read appears as
 * `{ error: ... }` in place, never a throw.
 */
export async function getMetaAuditData(accountRef: string, days = 30) {
  const { act, digits } = normalizeActId(accountRef);
  const now = new Date(Date.now() - 86_400_000); // exclude today (partial day)
  const start = new Date(now.getTime() - (days - 1) * 86_400_000);
  const prevEnd = new Date(start.getTime() - 86_400_000);
  const prevStart = new Date(prevEnd.getTime() - (days - 1) * 86_400_000);
  const cur = JSON.stringify({ since: ymd(start), until: ymd(now) });
  const prev = JSON.stringify({ since: ymd(prevStart), until: ymd(prevEnd) });

  const INSIGHT_FIELDS = "spend,impressions,reach,frequency,clicks,ctr,cpm,cpc,actions,action_values,purchase_roas";

  const adsetFields =
    "id,name,status,effective_status,campaign_id,optimization_goal,billing_event,bid_strategy,daily_budget,lifetime_budget,targeting,promoted_object,created_time,updated_time";

  const [account, campaigns, adsetsFull, ads, insightsCur, insightsPrev, byCampaign, daily, pixels] =
    await Promise.all([
      graphGet(act, { fields: "name,account_id,account_status,currency,timezone_name,amount_spent,spend_cap,created_time,business{id,name}" }),
      graphGet(`${act}/campaigns`, { fields: "id,name,status,effective_status,objective,daily_budget,lifetime_budget,bid_strategy,buying_type,created_time,updated_time,start_time,stop_time", limit: "100" }),
      graphGet(`${act}/adsets`, { fields: `${adsetFields},learning_stage_info`, limit: "100" }),
      graphGet(`${act}/ads`, { fields: "id,name,status,effective_status,adset_id,created_time", limit: "200" }),
      graphGet(`${act}/insights`, { fields: INSIGHT_FIELDS, time_range: cur }),
      graphGet(`${act}/insights`, { fields: INSIGHT_FIELDS, time_range: prev }),
      graphGet(`${act}/insights`, { level: "campaign", fields: `campaign_name,${INSIGHT_FIELDS}`, time_range: cur, limit: "50" }),
      graphGet(`${act}/insights`, { fields: "spend,actions", time_range: cur, time_increment: "1", limit: String(days + 2) }),
      graphGet(`${act}/adspixels`, { fields: "id,name,last_fired_time" }),
    ]);

  // learning_stage_info isn't available on every account — retry without it.
  const adsets = adsetsFull.error
    ? await graphGet(`${act}/adsets`, { fields: adsetFields, limit: "100" })
    : adsetsFull;

  const acc = (account.data ?? {}) as Record<string, unknown>;
  const money = (v: unknown) => (v == null ? null : Number(v) / 100);

  return {
    accountId: digits,
    window: { current: { since: ymd(start), until: ymd(now) }, previous: { since: ymd(prevStart), until: ymd(prevEnd) } },
    account: account.error ? { error: account.error } : {
      name: acc.name, status: acc.account_status, currency: acc.currency, timezone: acc.timezone_name,
      lifetimeSpend: money(acc.amount_spent), spendCap: money(acc.spend_cap),
      business: (acc.business as { name?: string } | undefined)?.name ?? null,
      created: acc.created_time,
    },
    performance: {
      current: insightsCur.error ? { error: insightsCur.error } : compactInsights(rows(insightsCur)[0]),
      previous: insightsPrev.error ? { error: insightsPrev.error } : compactInsights(rows(insightsPrev)[0]),
    },
    campaigns: campaigns.error ? { error: campaigns.error } : rows(campaigns).map((c) => ({
      id: c.id, name: c.name, status: c.status, effectiveStatus: c.effective_status,
      objective: c.objective, buyingType: c.buying_type, bidStrategy: c.bid_strategy,
      dailyBudget: money(c.daily_budget), lifetimeBudget: money(c.lifetime_budget),
      created: c.created_time, updated: c.updated_time, start: c.start_time, stop: c.stop_time,
    })),
    campaignPerformance: byCampaign.error ? { error: byCampaign.error } : rows(byCampaign).map((r) => ({
      campaign: r.campaign_name, ...compactInsights(r),
    })),
    adsets: adsets.error ? { error: adsets.error } : rows(adsets).slice(0, 60).map((s) => ({
      id: s.id, name: s.name, status: s.status, effectiveStatus: s.effective_status, campaignId: s.campaign_id,
      optimizationGoal: s.optimization_goal, billingEvent: s.billing_event, bidStrategy: s.bid_strategy,
      dailyBudget: money(s.daily_budget), lifetimeBudget: money(s.lifetime_budget),
      learning: (s.learning_stage_info as { status?: string } | undefined)?.status ?? null,
      targeting: compactTargeting(s.targeting),
      promotedObject: s.promoted_object ?? null,
      created: s.created_time, updated: s.updated_time,
    })),
    ads: ads.error ? { error: ads.error } : {
      total: rows(ads).length,
      byStatus: rows(ads).reduce<Record<string, number>>((m, a) => {
        const k = String(a.effective_status ?? a.status ?? "UNKNOWN");
        m[k] = (m[k] ?? 0) + 1;
        return m;
      }, {}),
      sample: rows(ads).slice(0, 25).map((a) => ({ name: a.name, effectiveStatus: a.effective_status, created: a.created_time })),
    },
    dailyTrend: daily.error ? { error: daily.error } : rows(daily).map((d) => ({
      date: d.date_start, spend: Number(d.spend ?? 0), actions: compactActions(d.actions),
    })),
    pixels: pixels.error ? { error: pixels.error } : rows(pixels).map((p) => ({
      id: p.id, name: p.name, lastFired: p.last_fired_time,
    })),
    note: "All figures read live from the ad account (read-only). Budgets/spend in account currency major units. 'learning' is the ad set learning phase where exposed.",
  };
}

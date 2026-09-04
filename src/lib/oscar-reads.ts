// Pure shaping rules for Oscar's read tools (hybrid-model build order step 1,
// landed 2026-09-04 off the FiltersFast sweep). No imports, no I/O, so
// tests/oscar-reads.test.js runs them directly under Node's type stripping.
// Everything that touches Google Ads lives in the agent and calls into here.
//
// Four gaps this module serves, each observed live on a large account:
// a campaign list that silently stopped at 80 rows, a change history with no
// editor attribution, a one-week report where the four-window rule needs four,
// and no read at all for who holds an account.

/** Campaign rows returned before the list is cut. Large enough that a real
 *  account fits whole; when it does not, the result SAYS so (truncated:true
 *  and the total) instead of returning a round number that looks complete. */
export const CAMPAIGN_LIST_CAP = 300;
/** change_event refuses a LIMIT above 10,000 and requires one. */
export const CHANGE_EVENT_LIMIT = 10_000;
/** change_event serves roughly the last 30 days and errors on an older start.
 *  29 stays inside that wall across every timezone. */
export const CHANGE_HISTORY_MAX_DAYS = 29;
/** Most recent events returned in full alongside the tabulation. */
export const CHANGE_EVENTS_SHOWN = 80;

export interface Capped<T> { items: T[]; total: number; truncated: boolean }

/** Cut a list at `cap` and say so. A caller that receives exactly `cap` rows
 *  can no longer mistake the cut for the whole account. */
export function capList<T>(items: T[], cap: number): Capped<T> {
  const total = items.length;
  if (total <= cap) return { items, total, truncated: false };
  return { items: items.slice(0, cap), total, truncated: true };
}

export interface WeekWindow { label: string; start: string; end: string }
export const WEEK_LABELS = ["this week", "last week", "2 weeks ago", "3 weeks ago"] as const;

const dayMs = 86_400_000;
const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** Four consecutive complete weeks ending with the given one (the report
 *  engine's window shape, and the match-windows-to-the-break rule: two windows
 *  cannot tell a fall from a return to normal). Throws when the anchor is not
 *  a seven-day span, because a wrong anchor would silently produce four wrong
 *  windows that still look right. */
export function fourWeekWindows(currentStart: string, currentEnd: string): WeekWindow[] {
  const start = new Date(`${currentStart}T00:00:00Z`);
  const end = new Date(`${currentEnd}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new Error(`fourWeekWindows: bad dates ${currentStart}..${currentEnd}`);
  const span = Math.round((end.getTime() - start.getTime()) / dayMs) + 1;
  if (span !== 7) throw new Error(`fourWeekWindows: anchor spans ${span} days, expected 7`);
  const out: WeekWindow[] = [];
  for (let i = 0; i < 4; i++) {
    out.push({
      label: WEEK_LABELS[i],
      start: ymd(new Date(start.getTime() - i * 7 * dayMs)),
      end: ymd(new Date(end.getTime() - i * 7 * dayMs)),
    });
  }
  return out;
}

export interface WindowTotals { spend: number; impressions: number; clicks: number; conversions: number; revenue: number; conversionsByTime: number; revenueByTime: number }

/** Derived figures for one window, each null when its denominator is zero
 *  rather than 0 or Infinity, so a quiet week reads as quiet. */
export function deriveWindow(t: WindowTotals) {
  const r2 = (n: number) => Number(n.toFixed(2));
  const ratio = (a: number, b: number) => (b > 0 ? r2(a / b) : null);
  return {
    spend: r2(t.spend), impressions: t.impressions, clicks: t.clicks,
    conversions: r2(t.conversions), revenue: r2(t.revenue),
    conversionsByTime: r2(t.conversionsByTime), revenueByTime: r2(t.revenueByTime),
    ctrPct: t.impressions > 0 ? r2((t.clicks / t.impressions) * 100) : null,
    avgCpc: ratio(t.spend, t.clicks),
    cpa: ratio(t.spend, t.conversions),
    roas: ratio(t.revenue, t.spend),
    aov: ratio(t.revenue, t.conversions),
  };
}

// ---- Change history attribution ----

/** change_event.client_type, in words. The one that matters most is
 *  Recommendations Auto-Apply: changes made by Google under a subscription,
 *  with no person behind them, that read as "changes" in a bare count. */
export function clientTypeLabel(t: string | null | undefined): string {
  switch ((t ?? "").toUpperCase()) {
    case "GOOGLE_ADS_RECOMMENDATIONS_SUBSCRIPTION": return "Recommendations Auto-Apply (Google, under a subscription)";
    case "GOOGLE_ADS_RECOMMENDATIONS": return "Recommendations page (applied by a person)";
    case "GOOGLE_ADS_WEB_CLIENT": return "Google Ads web interface";
    case "GOOGLE_ADS_API": return "Google Ads API";
    case "GOOGLE_ADS_EDITOR": return "Google Ads Editor";
    case "GOOGLE_ADS_AUTOMATED_RULE": return "Automated rule";
    case "GOOGLE_ADS_SCRIPTS": return "Google Ads script";
    case "GOOGLE_ADS_BULK_UPLOAD": return "Bulk upload";
    case "GOOGLE_ADS_MOBILE_APP": return "Google Ads mobile app";
    case "SEARCH_ADS_360_SYNC":
    case "SEARCH_ADS_360_POST": return "Search Ads 360";
    case "INTERNAL_TOOL": return "Google internal tool";
    case "OTHER": return "other client";
    default: return "unknown client";
  }
}

export function isAutoApply(clientType: string | null | undefined): boolean {
  return (clientType ?? "").toUpperCase() === "GOOGLE_ADS_RECOMMENDATIONS_SUBSCRIPTION";
}

export type EditorKind = "ours" | "shared founder/freelancer login" | "other" | "no user (system)";

/** Whose change is it. Mirrors norbert-review-rules: our own logins are ours,
 *  a shared login stays ambiguous and is labelled so, anything else is another
 *  person. An empty user with a client type is a system actor (auto-apply,
 *  rules, scripts), not a mystery. */
export function editorKind(user: string | null | undefined, ownLogins: string[], sharedLogins: string[] = []): EditorKind {
  const u = (user ?? "").trim().toLowerCase();
  if (!u) return "no user (system)";
  const norm = (list: string[]) => new Set(list.map((s) => s.trim().toLowerCase()).filter(Boolean));
  if (norm(ownLogins).has(u)) return "ours";
  if (norm(sharedLogins).has(u)) return "shared founder/freelancer login";
  return "other";
}

export interface ChangeEventIn {
  at: string;
  user: string | null;
  clientType: string | null;
  resourceType: string | null;
  op: string | null;
  fields: string | null;
  campaign: string | null;       // resource name
  resourceName: string | null;
  oldResource?: unknown;
  newResource?: unknown;
}

export interface EditorRow { user: string; clientType: string; via: string; kind: EditorKind; count: number; firstAt: string; lastAt: string }

export interface ChangeTabulation {
  total: number;
  byEditor: EditorRow[];
  byResourceOp: { resourceType: string; op: string; count: number }[];
  byCampaign: { campaign: string; count: number }[];
  autoApplyCount: number;
  humanUsers: string[];          // distinct non-own emails, shared ones labelled
  earliestAt: string | null;
  latestAt: string | null;
}

/** The founder's standing rule, mechanised: tabulate by user_email and
 *  client_type BEFORE judging an account. `campaignName` turns a campaign
 *  resource name into the name a person recognises; unknown ids stay as ids. */
export function tabulateChanges(
  events: ChangeEventIn[],
  ownLogins: string[],
  sharedLogins: string[] = [],
  campaignName: (resource: string) => string = (r) => r,
): ChangeTabulation {
  const editors = new Map<string, EditorRow>();
  const resOps = new Map<string, number>();
  const camps = new Map<string, number>();
  const humans = new Set<string>();
  let auto = 0;
  let earliest: string | null = null;
  let latest: string | null = null;
  for (const e of events) {
    const user = (e.user ?? "").trim().toLowerCase() || "(none)";
    const ct = (e.clientType ?? "UNKNOWN").toUpperCase();
    const key = `${user}|${ct}`;
    const kind = editorKind(e.user, ownLogins, sharedLogins);
    const row = editors.get(key) ?? { user, clientType: ct, via: clientTypeLabel(ct), kind, count: 0, firstAt: e.at, lastAt: e.at };
    row.count++;
    if (e.at < row.firstAt) row.firstAt = e.at;
    if (e.at > row.lastAt) row.lastAt = e.at;
    editors.set(key, row);
    if (kind === "other") humans.add(user);
    if (kind === "shared founder/freelancer login") humans.add(`${user} (shared founder/freelancer login; author ambiguous)`);
    if (isAutoApply(ct)) auto++;
    const ro = `${e.resourceType ?? "UNKNOWN"}|${e.op ?? "UNKNOWN"}`;
    resOps.set(ro, (resOps.get(ro) ?? 0) + 1);
    const camp = e.campaign ? campaignName(e.campaign) : "account-level";
    camps.set(camp, (camps.get(camp) ?? 0) + 1);
    if (e.at && (!earliest || e.at < earliest)) earliest = e.at;
    if (e.at && (!latest || e.at > latest)) latest = e.at;
  }
  return {
    total: events.length,
    byEditor: [...editors.values()].sort((a, b) => b.count - a.count),
    byResourceOp: [...resOps.entries()].map(([k, count]) => { const [resourceType, op] = k.split("|"); return { resourceType, op, count }; }).sort((a, b) => b.count - a.count),
    byCampaign: [...camps.entries()].map(([campaign, count]) => ({ campaign, count })).sort((a, b) => b.count - a.count),
    autoApplyCount: auto,
    humanUsers: [...humans].sort(),
    earliestAt: earliest,
    latestAt: latest,
  };
}

const TEXT_KEYS = new Set(["text", "name", "url", "placement", "finalUrls", "displayName", "headline", "description", "path1", "path2", "amountMicros", "status"]);

/** What a REMOVE took away, read from old_resource (new_resource is empty on a
 *  removal, so a bare "REMOVE ad_group_criterion" says nothing). Walks the
 *  resource for the leaf strings a person would recognise: keyword text,
 *  names, URLs, headlines. Returns null when there is nothing to show. */
export function removedSummary(resource: unknown, max = 4): string | null {
  const found: string[] = [];
  const seen = new Set<unknown>();
  const walk = (v: unknown, key: string, depth: number) => {
    if (found.length >= max || depth > 6 || v == null) return;
    if (typeof v === "string" || typeof v === "number") {
      if (TEXT_KEYS.has(key) && String(v).trim()) found.push(`${key}: ${String(v).slice(0, 120)}`);
      return;
    }
    if (typeof v !== "object" || seen.has(v)) return;
    seen.add(v);
    if (Array.isArray(v)) { for (const x of v) walk(x, key, depth + 1); return; }
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      if (k === "resourceName") continue;
      walk(x, k, depth + 1);
    }
  };
  walk(resource, "", 0);
  return found.length ? found.join("; ") : null;
}

// ---- Conversion action config against reported conversions ----

export interface ConversionActionConfig {
  id: string;
  name: string;
  status: string | null;
  type: string | null;
  category: string | null;
  origin: string | null;
  primaryForGoal: boolean | null;
  countingType: string | null;
  includeInConversionsMetric: boolean | null;
  defaultValue: number | null;
  alwaysUseDefaultValue: boolean | null;
  attributionModel: string | null;
}

export interface ReportedAction { action: string; conversions: number; convValue: number }

export interface JoinedAction extends ReportedAction {
  config: ConversionActionConfig | null;
  /** Set when more than one live action carries this name: the report merges
   *  them under the name and `config` is only the first. */
  configsSharingName?: number;
}

export interface ConversionJoin {
  actions: JoinedAction[];
  unmatched: string[];                 // reported names with no config row (removed action, or a name collision)
  duplicateNames: { name: string; ids: string[] }[];
  doubleCountRisk: { category: string; actions: string[]; note: string }[];
}

/** Attach each reported action's configuration so single-source versus
 *  double-counted can be judged from one read. The risk flag fires when two or
 *  more PRIMARY actions in the same category both carry value in the window:
 *  that is the FiltersFast shape (two purchase tags, both purchase-scale). It
 *  is a flag to investigate, not a verdict; the same category can legitimately
 *  hold two primaries when they count different events. */
export function joinConversionConfig(reported: ReportedAction[], config: ConversionActionConfig[]): ConversionJoin {
  const byName = new Map<string, ConversionActionConfig[]>();
  for (const c of config) {
    const k = c.name.trim().toLowerCase();
    byName.set(k, [...(byName.get(k) ?? []), c]);
  }
  const duplicateNames = [...byName.entries()].filter(([, list]) => list.length > 1).map(([, list]) => ({ name: list[0].name, ids: list.map((c) => c.id) }));
  const unmatched: string[] = [];
  const actions: JoinedAction[] = reported.map((r) => {
    const list = byName.get(r.action.trim().toLowerCase()) ?? [];
    if (!list.length) unmatched.push(r.action);
    return { ...r, config: list[0] ?? null, ...(list.length > 1 ? { configsSharingName: list.length } : {}) };
  });
  const groups = new Map<string, JoinedAction[]>();
  for (const a of actions) {
    if (!a.config || a.config.primaryForGoal !== true || a.convValue <= 0) continue;
    const cat = a.config.category ?? "UNKNOWN";
    groups.set(cat, [...(groups.get(cat) ?? []), a]);
  }
  const doubleCountRisk = [...groups.entries()]
    .filter(([, list]) => list.length >= 2)
    .map(([category, list]) => ({
      category,
      actions: list.map((a) => a.action),
      note: `${list.length} primary ${category} actions all carry value in this window. If they fire on the same event the account's conversions and revenue are counted ${list.length} times; check their origins and tags before trusting ROAS.`,
    }));
  return { actions, unmatched, duplicateNames, doubleCountRisk };
}

// ---- Account holders ----

export interface AccessRow { email: string; role: string | null; since: string | null; invitedBy: string | null; kind: EditorKind }

export function labelAccess(rows: { email: string; role: string | null; since: string | null; invitedBy: string | null }[], ownLogins: string[], sharedLogins: string[] = []): AccessRow[] {
  return rows.map((r) => ({ ...r, kind: editorKind(r.email, ownLogins, sharedLogins) }));
}

/** Read the last ten digits of a customers/<id> resource name or a formatted id. */
export function customerIdOf(ref: string | null | undefined): string | null {
  if (!ref) return null;
  const m = String(ref).match(/customers\/(\d+)/);
  const digits = (m ? m[1] : String(ref)).replace(/\D/g, "");
  return digits.length ? digits : null;
}

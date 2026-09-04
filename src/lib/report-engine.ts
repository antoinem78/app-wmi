// Report engine v1: the deterministic half of report sign-off (build-order
// step 5, founder go 2026-09-04). Pure rules, no imports, no I/O, so
// tests/report-engine.test.js runs them directly under Node's type stripping,
// same discipline as norbert-review-rules.
//
// Why this exists: two real errors reached a client from a human-built report,
// an AOV that did not equal revenue over purchases, and campaign reach SUMMED
// and presented as account reach. Both are now regression tests, and every
// derived figure a report states is recomputed here from its own inputs before
// Norbert or the founder ever sees the draft. The model writes around checked
// figures; it never supplies one.
//
// The four-window rule (2026-08-16 lesson): two windows cannot tell a fall
// from a return to normal. Every report carries four, and a report built on
// fewer says so.

export interface WindowMetrics {
  label: string;              // "this week", "last week", "2 weeks ago", "3 weeks ago"
  start: string;
  end: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;        // purchases on ecommerce, primary conversions on Google
  revenue: number;
  leads: number;
  /** Deduplicated account-level reach for THIS window, where the platform
   *  provides one (Meta does; Google has no equivalent, leave null). */
  reach?: number | null;
}

/** The derived figures the report will STATE, exactly as it states them. */
export interface DerivedClaims {
  aov?: number | null;
  cpa?: number | null;
  costPerLead?: number | null;
  roas?: number | null;
  ctr?: number | null;        // percent
  cpm?: number | null;
  cpc?: number | null;
  reach?: number | null;
}

export interface EventSource {
  label: string;              // what the report calls it ("leads", "purchases")
  actionType: string;         // the raw platform action/conversion identifier
  count: number;
}

export interface ReportFigures {
  platform: "google" | "meta";
  currency: string;
  /** Newest first. Four expected; fewer is reported, never hidden. */
  windows: WindowMetrics[];
  claims: DerivedClaims;
  /** Sum of campaign-level reach for the current window (Meta): kept ONLY so
   *  the summed-reach error can be detected; never reportable as reach. */
  reachSummedAcrossCampaigns?: number | null;
  /** What each counted conversion actually is, by platform identifier. */
  eventSources?: EventSource[];
  /** Store-ledger revenue for the current window, where a store is connected. */
  storeLedger?: { revenue: number; orders: number; source: string } | null;
}

export interface CheckIssue {
  check: string;
  severity: "fail" | "warn";
  detail: string;
}

const close = (a: number, b: number) => {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  const tol = Math.max(Math.abs(b) * 0.01, 0.01);
  return Math.abs(a - b) <= tol;
};
const n2 = (v: number) => (Math.round(v * 100) / 100).toString();

/** Recompute every stated derived figure from the current window's inputs and
 *  flag anything that does not reproduce. Empty result = arithmetically clean. */
export function checkReport(f: ReportFigures): CheckIssue[] {
  const issues: CheckIssue[] = [];
  const cur = f.windows[0];
  if (!cur) return [{ check: "windows", severity: "fail", detail: "No current window at all; there is nothing to report." }];

  if (f.windows.length < 4) {
    issues.push({
      check: "four_windows", severity: "warn",
      detail: `Only ${f.windows.length} window${f.windows.length === 1 ? "" : "s"} present; two windows cannot tell a fall from a return to normal, and this report cannot show four.`,
    });
  }

  const c = f.claims;
  const derive = (name: keyof DerivedClaims, num: number, den: number, denName: string, scale = 1) => {
    const claimed = c[name];
    if (claimed == null) return;
    if (den <= 0) {
      issues.push({ check: String(name), severity: "fail", detail: `${String(name)} is stated as ${n2(claimed)} but ${denName} is zero; a figure divided by nothing is not a figure.` });
      return;
    }
    const actual = (num / den) * scale;
    if (!close(claimed, actual)) {
      issues.push({ check: String(name), severity: "fail", detail: `${String(name)} is stated as ${n2(claimed)} but recomputes to ${n2(actual)} from the window's own inputs.` });
    }
  };
  derive("aov", cur.revenue, cur.conversions, "purchases");
  derive("cpa", cur.spend, cur.conversions, "conversions");
  derive("costPerLead", cur.spend, cur.leads, "leads");
  derive("roas", cur.revenue, cur.spend, "spend");
  derive("ctr", cur.clicks, cur.impressions, "impressions", 100);
  derive("cpm", cur.spend, cur.impressions, "impressions", 1000);
  derive("cpc", cur.spend, cur.clicks, "clicks");

  // Reach: campaign-level reach SUMMED is not reach; people overlap campaigns.
  if (c.reach != null) {
    const summed = f.reachSummedAcrossCampaigns;
    const dedup = cur.reach;
    if (dedup == null) {
      issues.push({ check: "reach", severity: "warn", detail: "Reach is stated but no deduplicated account-level reach was read; drop the figure or read it properly." });
    } else if (!close(c.reach, dedup)) {
      if (summed != null && close(c.reach, summed)) {
        issues.push({ check: "reach", severity: "fail", detail: `Reach is stated as ${n2(c.reach)}, which is the SUM of campaign reach; people overlap campaigns, and the deduplicated account read is ${n2(dedup)}.` });
      } else {
        issues.push({ check: "reach", severity: "fail", detail: `Reach is stated as ${n2(c.reach)} but the deduplicated account read is ${n2(dedup)}.` });
      }
    }
  }

  // Event-source honesty: a lead is only a lead if the platform identifier says
  // so. A page-view custom conversion reported as form fills is the recorded
  // failure case this check exists for.
  if (cur.leads > 0) {
    const sources = f.eventSources ?? [];
    if (!sources.length) {
      issues.push({ check: "event_sources", severity: "warn", detail: "Leads are reported but no event sources are named; every counted conversion states its platform identifier or it does not ship." });
    } else {
      for (const s of sources) {
        if (/custom/i.test(s.actionType) && /lead|form/i.test(s.label)) {
          issues.push({ check: "event_sources", severity: "fail", detail: `"${s.label}" is counted from custom conversion "${s.actionType}"; a custom conversion is not a form fill until its definition says so, name it for what it is.` });
        }
      }
    }
  }

  // Store ledger anchor: platform attribution meaningfully above what the store
  // actually took is a claim the client's own books will contradict.
  if (f.storeLedger && cur.revenue > 0) {
    if (f.storeLedger.revenue > 0 && cur.revenue > f.storeLedger.revenue * 1.15) {
      issues.push({
        check: "store_ledger", severity: "warn",
        detail: `Platform-attributed revenue ${n2(cur.revenue)} exceeds the store ledger's ${n2(f.storeLedger.revenue)} (${f.storeLedger.source}) by more than 15%; attribution must be presented alongside the ledger, never as takings.`,
      });
    }
  }

  return issues;
}

/** The four-window table as plain text, for the draft's figures block. */
export function fourWindowText(f: ReportFigures): string {
  const money = (v: number) => `${f.currency} ${v.toFixed(2)}`;
  const lines: string[] = ["Four windows (a fall and a return to normal look identical over two):"];
  for (const w of f.windows.slice(0, 4)) {
    const result = f.platform === "meta" && w.leads > 0 && w.conversions === 0
      ? `${w.leads} leads`
      : `${w.conversions} conv${w.revenue ? `, ${money(w.revenue)} rev` : ""}${w.leads ? `, ${w.leads} leads` : ""}`;
    lines.push(`  ${w.label} (${w.start} to ${w.end}): ${money(w.spend)} spend, ${result}`);
  }
  return lines.join("\n");
}

export function renderIssues(issues: CheckIssue[]): string {
  if (!issues.length) return "Derivation checks: all clean.";
  return "Derivation checks:\n" + issues.map((i) => `  ${i.severity.toUpperCase()} [${i.check}] ${i.detail}`).join("\n");
}

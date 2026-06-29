// Rexos — agency PPC Ops Command Center (read-only).
// Pulls a lightweight headline summary for every managed account, runs the
// monitoring rules over the live pull, and rolls up agency totals. Currency-
// aware: money KPIs are aggregated per currency (WMI runs both GBP and USD),
// conversions are currency-agnostic.
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import {
  getAccountSummary,
  type AccountSummary,
  type Kpi,
  type ReportWindow,
} from "@/lib/integrations/google-ads/reporting";

export type AlertSeverity = "critical" | "warning" | "info";
export interface Alert {
  severity: AlertSeverity;
  title: string;
  detail: string;
}
export type HealthStatus = "Healthy" | "Action" | "No data";

export interface AccountRow {
  clientId: string;
  company: string;
  customerId: string;
  summary: AccountSummary | null;
  alerts: Alert[];
  status: HealthStatus;
  error?: string;
}
export interface CurrencyTotals {
  currency: string;
  accounts: number;
  spend: Kpi;
  conversions: Kpi;
  convValue: Kpi;
  cpa: Kpi;
  roas: Kpi;
}
export interface CommandCenter {
  accounts: AccountRow[];
  totalsByCurrency: CurrencyTotals[];
  alertCounts: { critical: number; warning: number; info: number };
  range: { start: string; end: string } | null;
}

// Spend floor (in the account's own currency) below which we don't raise
// "drop"/"no-conversion" alerts — avoids noise on tiny/paused accounts.
const MEANINGFUL_SPEND = 50;

// The live monitoring rules (mirror the ops alerts on the overview).
export function evaluateAlerts(s: AccountSummary): Alert[] {
  const out: Alert[] = [];
  const spend = s.spend.value;
  const conv = s.conversions.value;
  const dConv = s.conversions.deltaPct;
  const dSpend = s.spend.deltaPct;

  if (spend >= MEANINGFUL_SPEND && conv === 0) {
    out.push({
      severity: "critical",
      title: "Spend with no conversions",
      detail:
        "Live spend with 0 recorded conversions this period. Check conversion tracking and campaign intent before it burns more budget.",
    });
  }
  if (dConv != null && spend >= MEANINGFUL_SPEND && dConv <= -25) {
    out.push({
      severity: "critical",
      title: `Conversions ${dConv.toFixed(0)}% vs prior`,
      detail:
        "Sharp conversion drop on meaningful spend. Inspect recent changes, budget pacing and lost impression share.",
    });
  } else if (dConv != null && spend >= MEANINGFUL_SPEND && dConv <= -10) {
    out.push({
      severity: "warning",
      title: `Conversions ${dConv.toFixed(0)}% vs prior`,
      detail: "Softening conversions. Worth a look at search terms and asset performance.",
    });
  }
  if (dSpend != null && dSpend >= 40) {
    out.push({
      severity: "warning",
      title: `Spend +${dSpend.toFixed(0)}% vs prior`,
      detail:
        "Spend climbing faster than usual. Confirm it is intentional and tracking ROAS, not just volume.",
    });
  }
  return out;
}

function statusFor(alerts: Alert[]): HealthStatus {
  return alerts.some((a) => a.severity === "critical" || a.severity === "warning")
    ? "Action"
    : "Healthy";
}

const mkKpi = (value: number, prev: number): Kpi => ({
  value,
  prev,
  deltaPct: prev > 0 ? ((value - prev) / prev) * 100 : null,
});
const ratio = (a: number, b: number) => (b > 0 ? a / b : 0);

export async function getCommandCenter(windowDays: ReportWindow = 7): Promise<CommandCenter> {
  const supabase = createSupabaseAdminClient();
  const { data: rows } = await supabase
    .from("onboarding_state")
    .select(
      "client_id, google_ads_customer_id, google_ads_reporting_customer_id, clients(company_name)",
    )
    .eq("ad_link_status", "approved")
    .not("google_ads_customer_id", "is", null);

  const list = rows ?? [];
  const accounts: AccountRow[] = new Array(list.length);

  // Bounded-concurrency pull (each account ≈ 3 GAQL calls; read-only).
  const CONCURRENCY = 5;
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, list.length) }, async () => {
      while (cursor < list.length) {
        const i = cursor++;
        const row = list[i];
        const clientId = row.client_id as string;
        const customerId = (row.google_ads_reporting_customer_id ??
          row.google_ads_customer_id) as string;
        const company =
          (row.clients as unknown as { company_name?: string } | null)?.company_name ??
          "(unnamed)";
        try {
          const summary = await getAccountSummary(customerId, windowDays);
          const alerts = evaluateAlerts(summary);
          accounts[i] = { clientId, company, customerId, summary, alerts, status: statusFor(alerts) };
        } catch (e) {
          accounts[i] = {
            clientId,
            company,
            customerId,
            summary: null,
            alerts: [],
            status: "No data",
            error: e instanceof Error ? e.message : String(e),
          };
        }
      }
    }),
  );

  // Aggregate money KPIs per currency; conversions are currency-agnostic.
  const groups: Record<
    string,
    { count: number; sCur: number; sPrev: number; cCur: number; cPrev: number; vCur: number; vPrev: number }
  > = {};
  const alertCounts = { critical: 0, warning: 0, info: 0 };
  let range: CommandCenter["range"] = null;
  for (const a of accounts) {
    for (const al of a.alerts) alertCounts[al.severity]++;
    if (!a.summary) continue;
    range ??= a.summary.range;
    const c = a.summary.currency;
    const g = (groups[c] ??= { count: 0, sCur: 0, sPrev: 0, cCur: 0, cPrev: 0, vCur: 0, vPrev: 0 });
    g.count++;
    g.sCur += a.summary.spend.value; g.sPrev += a.summary.spend.prev;
    g.cCur += a.summary.conversions.value; g.cPrev += a.summary.conversions.prev;
    g.vCur += a.summary.convValue.value; g.vPrev += a.summary.convValue.prev;
  }
  const totalsByCurrency: CurrencyTotals[] = Object.entries(groups)
    .map(([currency, g]) => ({
      currency,
      accounts: g.count,
      spend: mkKpi(g.sCur, g.sPrev),
      conversions: mkKpi(g.cCur, g.cPrev),
      convValue: mkKpi(g.vCur, g.vPrev),
      cpa: mkKpi(ratio(g.sCur, g.cCur), ratio(g.sPrev, g.cPrev)),
      roas: mkKpi(ratio(g.vCur, g.sCur), ratio(g.vPrev, g.sPrev)),
    }))
    .sort((a, b) => b.spend.value - a.spend.value);

  // Action accounts first, then by spend desc.
  accounts.sort((a, b) => {
    const rank = (s: HealthStatus) => (s === "Action" ? 0 : s === "Healthy" ? 1 : 2);
    if (rank(a.status) !== rank(b.status)) return rank(a.status) - rank(b.status);
    return (b.summary?.spend.value ?? 0) - (a.summary?.spend.value ?? 0);
  });

  return { accounts, totalsByCurrency, alertCounts, range };
}

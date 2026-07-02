// Rexos — agency PPC Ops Command Center (read-only overview + live monitoring).
// All managed accounts at a glance: agency KPI roll-ups (per currency), open
// alerts by severity, and a per-account table with health status. Click an
// account for its full dashboard.
import Link from "next/link";
import { entityConfig } from "@/lib/config";
import { getCommandCenter, type AccountRow, type Alert } from "@/lib/command-center";
import type { Kpi } from "@/lib/integrations/google-ads/reporting";
import { GenerateAuditButton } from "@/components/GenerateAuditButton";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const money = (n: number, currency: string, dp = 0) =>
  new Intl.NumberFormat("en", { style: "currency", currency, minimumFractionDigits: dp, maximumFractionDigits: dp }).format(n);
const dec = (n: number, dp = 0) => new Intl.NumberFormat("en", { maximumFractionDigits: dp }).format(n);

function Delta({ k, cost }: { k: Kpi; cost?: boolean }) {
  if (k.deltaPct == null) return <span className="text-[11px] text-zinc-300">—</span>;
  const up = k.deltaPct >= 0;
  const good = cost ? !up : up;
  const color = k.deltaPct === 0 ? "text-zinc-400" : good ? "text-emerald-600" : "text-amber-600";
  return (
    <span className={`text-[11px] font-medium ${color}`}>
      {up ? "▲" : "▼"} {Math.abs(k.deltaPct).toFixed(0)}%
    </span>
  );
}

function HealthPill({ status }: { status: AccountRow["status"] }) {
  const map = {
    Healthy: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    Action: "bg-red-50 text-red-700 ring-red-600/20",
    "No data": "bg-zinc-100 text-zinc-500 ring-zinc-400/20",
  } as const;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${map[status]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${status === "Healthy" ? "bg-emerald-500" : status === "Action" ? "bg-red-500" : "bg-zinc-400"}`} />
      {status}
    </span>
  );
}

const SEV_DOT: Record<Alert["severity"], string> = {
  critical: "bg-red-500",
  warning: "bg-amber-500",
  info: "bg-sky-500",
};

export default async function DashboardPage() {
  const cc = await getCommandCenter(7);
  const withData = cc.accounts.filter((a) => a.summary);
  const actionCount = cc.accounts.filter((a) => a.status === "Action").length;
  const flagged = cc.accounts.filter((a) => a.alerts.length > 0);

  return (
    <div className="p-6 lg:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Command Center</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {entityConfig.brandName} · {cc.accounts.length} managed accounts ·{" "}
            {cc.range ? `week ${cc.range.start} → ${cc.range.end}` : "no linked accounts yet"}
            <span className="ml-1 text-zinc-400">· vs prior week</span>
          </p>
        </div>
        <Link href="/clients" className="text-sm font-medium text-[#0B1F3A] hover:underline">
          All clients →
        </Link>
      </div>

      {/* Agency roll-up — one card row per currency (money KPIs aren't cross-currency). */}
      {cc.totalsByCurrency.map((t) => (
        <div key={t.currency} className="mt-6">
          {cc.totalsByCurrency.length > 1 && (
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              {t.currency} · {t.accounts} {t.accounts === 1 ? "account" : "accounts"}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <AggCard label="Spend" value={money(t.spend.value, t.currency)} k={t.spend} cost />
            <AggCard label="Conversions" value={dec(t.conversions.value, 0)} k={t.conversions} />
            <AggCard label="CPA" value={money(t.cpa.value, t.currency, 2)} k={t.cpa} cost />
            <AggCard label="ROAS" value={`${dec(t.roas.value, 2)}×`} k={t.roas} />
          </div>
        </div>
      ))}

      {/* Open alerts by severity */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Open alerts</span>
        <SevChip label="Critical" n={cc.alertCounts.critical} dot="bg-red-500" />
        <SevChip label="Warning" n={cc.alertCounts.warning} dot="bg-amber-500" />
        <span className="text-xs text-zinc-400">
          {actionCount} of {cc.accounts.length} accounts need action
        </span>
      </div>

      {/* Accounts overview */}
      <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-[11px] uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-5 py-3 text-left font-medium">Account</th>
                <th className="px-3 py-3 text-right font-medium">Spend</th>
                <th className="px-3 py-3 text-right font-medium">Conv.</th>
                <th className="px-3 py-3 text-right font-medium">CPA</th>
                <th className="px-3 py-3 text-right font-medium">ROAS</th>
                <th className="px-5 py-3 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {cc.accounts.map((a) => {
                const s = a.summary;
                const cur = s?.currency ?? entityConfig.currency;
                return (
                  <tr key={a.clientId} className={`hover:bg-zinc-50 ${a.status === "Action" ? "bg-red-50/30" : ""}`}>
                    <td className="px-5 py-3">
                      <Link href={`/clients/${a.clientId}`} className="font-medium text-[#0B1F3A] hover:underline">
                        {a.company}
                      </Link>
                      {a.error && <div className="text-[11px] text-zinc-400">data unavailable</div>}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {s ? <><div className="text-zinc-800">{money(s.spend.value, cur)}</div><Delta k={s.spend} cost /></> : "—"}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {s ? <><div className="text-zinc-800">{dec(s.conversions.value, 1)}</div><Delta k={s.conversions} /></> : "—"}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {s ? <><div className="text-zinc-800">{money(s.cpa.value, cur, 2)}</div><Delta k={s.cpa} cost /></> : "—"}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {s && s.hasConversionValue ? <><div className="text-zinc-800">{dec(s.roas.value, 2)}×</div><Delta k={s.roas} /></> : <span className="text-zinc-300">—</span>}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex flex-col items-end gap-1.5">
                        <HealthPill status={a.status} />
                        {a.summary && <GenerateAuditButton clientId={a.clientId} compact />}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {cc.accounts.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-zinc-400">No linked accounts yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Alerts & Monitoring */}
      <h2 className="mt-10 text-sm font-semibold text-zinc-900">Alerts &amp; Monitoring</h2>
      <p className="mt-0.5 text-xs text-zinc-400">
        Live rules over this week&apos;s pull: spend with 0 conversions, conversions down ≥25% (critical) or ≥10% (warning) vs prior, spend up ≥40%.
      </p>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        {flagged.length === 0 && (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-6 text-sm text-zinc-400">
            No open alerts — every account is within its expected range this week.
          </div>
        )}
        {flagged.map((a) =>
          a.alerts.map((al, i) => (
            <div key={`${a.clientId}-${i}`} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${SEV_DOT[al.severity]}`} />
                <Link href={`/clients/${a.clientId}`} className="text-sm font-semibold text-[#0B1F3A] hover:underline">
                  {a.company}
                </Link>
                <span className="text-xs text-zinc-400">· {al.title}</span>
              </div>
              <p className="mt-1.5 text-xs text-zinc-500">{al.detail}</p>
            </div>
          )),
        )}
      </div>

      <p className="mt-8 text-[11px] text-zinc-400">
        Read-only overview · {withData.length} accounts pulled live · cached figures refresh on reload.
      </p>
    </div>
  );
}

function AggCard({ label, value, k, cost }: { label: string; value: string; k: Kpi; cost?: boolean }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-bold tracking-tight text-zinc-900">{value}</div>
      <div className="mt-1"><Delta k={k} cost={cost} /></div>
    </div>
  );
}

function SevChip({ label, n, dot }: { label: string; n: number; dot: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-zinc-600 ring-1 ring-inset ring-zinc-200">
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {n} {label}
    </span>
  );
}

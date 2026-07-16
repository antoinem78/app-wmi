// Step 4 core: the unified acquisition -> conversion funnel, per client.
// Acquisition numbers live in the AdsDashboard above (not duplicated here);
// this shows the CONVERSION continuation (chats -> qualified -> booked) from
// Engine B, plus honest attribution of who delivers acquisition per R13:
//   - wmi_legacy / rexos (direct): acquisition engine-delivered
//   - dentalmastery (vertical): acquisition PARTNER-delivered (PPCMastery, deferred)
// Renders only if the client is mapped to a conversion agent.
import { getByEngineAClientId } from "@/lib/platform/clients";
import { getConversionFunnel } from "@/lib/substrate/read";

function Step({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex-1 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-center">
      <div className="text-2xl font-semibold text-zinc-900">{value}</div>
      <div className="text-xs font-medium text-zinc-600">{label}</div>
      {sub && <div className="mt-0.5 text-[11px] text-zinc-400">{sub}</div>}
    </div>
  );
}

export async function ClientFunnel({
  engineAClientId,
}: {
  engineAClientId: string;
  range?: string;
}) {
  let pc;
  try {
    pc = await getByEngineAClientId(engineAClientId);
  } catch {
    return null; // spine not migrated yet
  }
  if (!pc?.engine_b_client_id) return null; // no conversion plane

  let funnel;
  try {
    funnel = await getConversionFunnel(pc.engine_b_client_id, 30);
  } catch {
    return null;
  }

  const vertical = pc.doorway === "dentalmastery";
  const acquisitionSource = vertical
    ? "Acquisition: partner-delivered (deferred)"
    : "Acquisition: engine-delivered — see dashboard above";
  const pct = (n: number, d: number) => (d > 0 ? `${Math.round((100 * n) / d)}%` : "—");

  return (
    <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-sm font-semibold text-zinc-900">Growth funnel (last 30 days)</h2>
        <span className="text-xs text-zinc-400">{acquisitionSource}</span>
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-3">
        <Step label="Chats" value={String(funnel.chats)} sub="conversations started" />
        <div className="hidden items-center text-zinc-300 sm:flex">→</div>
        <Step label="Qualified" value={String(funnel.qualified)} sub={`${pct(funnel.qualified, funnel.chats)} of chats`} />
        <div className="hidden items-center text-zinc-300 sm:flex">→</div>
        <Step label="Booked" value={String(funnel.booked)} sub={`${pct(funnel.booked, funnel.qualified)} of qualified`} />
      </div>
      <p className="mt-3 text-xs text-zinc-400">
        Conversion plane (Engine B). Booked reflects calendar bookings received via GHL event webhooks.
      </p>
    </section>
  );
}

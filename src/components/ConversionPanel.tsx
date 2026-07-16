// Cockpit read-pane: the conversion plane (Engine B) for one client, alongside
// the acquisition plane already on this page. Read-only; the agent runtime is
// n8n, this only reads the substrate. Renders nothing if the client has no
// conversion-plane presence (keeps the page clean for ads-only clients).
import { engineBIdForEngineA } from "@/lib/platform/clients";
import { getAgentHealth, getConversations, getLeads } from "@/lib/substrate/read";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
      <div className="text-lg font-semibold text-zinc-900">{value}</div>
      <div className="text-xs text-zinc-500">{label}</div>
    </div>
  );
}

export async function ConversionPanel({ engineAClientId }: { engineAClientId: string }) {
  let engineBId: string | null = null;
  try {
    engineBId = await engineBIdForEngineA(engineAClientId);
  } catch {
    return null; // spine not migrated yet; fail quiet
  }
  if (!engineBId) return null; // ads-only client, nothing to show

  let health, conversations, leads;
  try {
    [health, conversations, leads] = await Promise.all([
      getAgentHealth(engineBId),
      getConversations(engineBId, 8),
      getLeads(engineBId, 8),
    ]);
  } catch {
    return (
      <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Conversion agent</h2>
        <p className="mt-2 text-sm text-zinc-500">
          Conversion data is temporarily unavailable (substrate read).
        </p>
      </section>
    );
  }

  return (
    <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-zinc-900">Conversion agent (last 7 days)</h2>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Conversations" value={String(health.conversations_7d)} />
        <Stat label="Handoffs" value={String(health.handoffs_7d)} />
        <Stat label="Handoff rate" value={`${health.handoff_rate_pct}%`} />
        <Stat label="Escalations" value={String(health.escalations_7d)} />
        <Stat label="Avg confidence" value={health.avg_confidence_7d == null ? "—" : String(health.avg_confidence_7d)} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Open leads (handoff)</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {leads.length === 0 && <li className="text-zinc-400">None open.</li>}
            {leads.map((l) => (
              <li key={l.session_id} className="flex items-center justify-between gap-3">
                <span className="truncate text-zinc-700">
                  {l.ghl_contact_id ? "In GHL" : "Awaiting contact"} · {l.session_id.slice(0, 8)}
                </span>
                <span className="shrink-0 text-xs text-zinc-400">
                  {new Date(l.last_message_at).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Recent conversations</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {conversations.length === 0 && <li className="text-zinc-400">No conversations yet.</li>}
            {conversations.map((c) => (
              <li key={c.session_id} className="flex items-center justify-between gap-3">
                <span className="truncate text-zinc-700">
                  {c.status}
                  {c.escalation_class ? ` · ${c.escalation_class}` : ""} · {c.turns} turns
                </span>
                <span className="shrink-0 text-xs text-zinc-400">
                  {new Date(c.last_message_at).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

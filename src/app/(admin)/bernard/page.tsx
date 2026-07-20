// Bernard pane — the Meta Lab supervisor inside the cockpit. Read surface +
// the two founder controls that exist today (fix approvals, STAND_DOWN).
// All data arrives through Bernard's authed n8n endpoints (src/lib/bernard.ts);
// the (admin) layout has already enforced agency_admin before this renders.
import { bernardConfigured, getBernardStatus, type BernardStatus } from "@/lib/bernard";
import { decideFixAction, standDownAction } from "./actions";

export const dynamic = "force-dynamic";

function Badge({ ok, yes, no }: { ok: boolean; yes: string; no: string }) {
  return ok ? (
    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">{yes}</span>
  ) : (
    <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-600">{no}</span>
  );
}

export default async function BernardPage() {
  if (!bernardConfigured()) {
    return (
      <div className="p-10">
        <h1 className="text-2xl font-semibold text-zinc-900">Bernard</h1>
        <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-6 text-sm text-amber-900">
          The Bernard link is not configured on this deployment. Add{" "}
          <code className="rounded bg-amber-100 px-1">BERNARD_WEBHOOK_KEY</code> to the
          environment and redeploy.
        </div>
      </div>
    );
  }

  let status: BernardStatus | null = null;
  let error: string | null = null;
  try {
    status = await getBernardStatus();
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not reach Bernard.";
  }

  return (
    <div className="p-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Bernard</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Meta Lab supervisor — audits, dispatches and verifies the executor; never activates anything.
          </p>
        </div>
        {status?.credits && (
          <div className="text-right text-sm text-zinc-500">
            Executor credits
            <div className="text-lg font-semibold text-zinc-900">
              {status.credits.periodic.toLocaleString()} + {status.credits.monthly.toLocaleString()}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-6 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">{error}</div>
      )}

      {status && (
        <>
          {/* Pending approvals first — this is the pane's reason to exist */}
          <h2 className="mt-8 text-lg font-semibold text-zinc-900">
            Awaiting your approval{" "}
            {status.pending_fixes.length > 0 && (
              <span className="ml-1 rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
                {status.pending_fixes.length}
              </span>
            )}
          </h2>
          {status.pending_fixes.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">Nothing waiting. Proposed fixes appear here and in Slack #alerts.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {status.pending_fixes.map((f) => (
                <div key={f.task_id} className="rounded-lg border border-zinc-200 bg-white p-4">
                  <div className="text-sm font-medium text-zinc-900">{f.summary}</div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {f.client} · {f.reason} · proposed {new Date(f.proposed_at).toLocaleString("en-GB")}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <form action={decideFixAction}>
                      <input type="hidden" name="task_id" value={f.task_id} />
                      <input type="hidden" name="decision" value="approve" />
                      <button className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700">
                        Approve &amp; execute
                      </button>
                    </form>
                    <form action={decideFixAction}>
                      <input type="hidden" name="task_id" value={f.task_id} />
                      <input type="hidden" name="decision" value="reject" />
                      <button className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
                        Reject
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Lab clients */}
          <h2 className="mt-10 text-lg font-semibold text-zinc-900">Lab clients</h2>
          <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {status.clients.map((c) => (
              <div key={c.slug} className="rounded-lg border border-zinc-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-zinc-900">{c.name}</div>
                  {c.stand_down ? (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">STAND DOWN</span>
                  ) : (
                    <Badge ok={c.enabled} yes="dispatch armed" no="disabled" />
                  )}
                </div>
                <div className="mt-2 space-y-1 text-xs text-zinc-500">
                  <div>{c.accounts.join(", ") || "no accounts"}</div>
                  <div>
                    {c.doctrine} · <Badge ok={c.skill_installed} yes="skill installed" no="skill pending" /> ·{" "}
                    {c.monitors} monitor{c.monitors === 1 ? "" : "s"}
                  </div>
                </div>
                {!c.stand_down && (
                  <form action={standDownAction} className="mt-3">
                    <input type="hidden" name="client_slug" value={c.slug} />
                    <button className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50">
                      STAND DOWN — halt all executor work
                    </button>
                  </form>
                )}
              </div>
            ))}
          </div>

          {/* Activity */}
          <h2 className="mt-10 text-lg font-semibold text-zinc-900">Recent activity</h2>
          <div className="mt-3 overflow-hidden rounded-lg border border-zinc-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-4 py-2">When</th>
                  <th className="px-4 py-2">Step</th>
                  <th className="px-4 py-2">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {status.activity.map((a, i) => (
                  <tr key={i}>
                    <td className="whitespace-nowrap px-4 py-2 text-zinc-500">
                      {new Date(a.at).toLocaleString("en-GB")}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 font-medium text-zinc-800">{a.step}</td>
                    <td className="px-4 py-2 text-zinc-500">{a.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-zinc-400">
            Snapshot {new Date(status.generated_at).toLocaleString("en-GB")} · full trail in the substrate audit log
          </p>
        </>
      )}
    </div>
  );
}

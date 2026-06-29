// Rexos Proposals — the human approval queue. Pending optimisation proposals
// (filed by the agent or the team) shown as approve/dismiss cards. Propose-only:
// "Approve" records the decision; you apply the change in Google Ads. (P5 will
// later wire Approve → execute behind this same gate.)
import Link from "next/link";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { listProposals, type Proposal, type ProposalType } from "@/lib/proposals";
import { approveProposal, dismissProposal } from "./actions";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<ProposalType, string> = {
  negative_keywords: "Negatives",
  pause_campaign: "Pause",
  budget_reallocation: "Budget",
  rsa_improvement: "RSA",
  other: "Change",
};

export default async function ProposalsPage() {
  const [pending, decided] = await Promise.all([
    listProposals({ status: "pending", limit: 100 }),
    listProposals({ limit: 30 }),
  ]);
  const recentlyDecided = decided.filter((p) => p.status !== "pending").slice(0, 20);

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Proposals</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Optimisation proposals awaiting your review. Approving records your decision — you apply
            the change in Google Ads (execution isn&apos;t automated yet).
          </p>
        </div>
        <Link href="/dashboard" className="text-sm font-medium text-[#0B1F3A] hover:underline">
          ← Command Center
        </Link>
      </div>

      {pending.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-zinc-300 bg-white p-10 text-center text-sm text-zinc-400">
          No proposals pending. Ask Rexos to propose one (e.g. “find a campaign worth pausing and propose it”).
        </div>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {pending.map((p) => (
            <ProposalCard key={p.id} p={p} />
          ))}
        </div>
      )}

      {recentlyDecided.length > 0 && (
        <>
          <h2 className="mt-12 text-sm font-semibold text-zinc-900">Recently decided</h2>
          <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-zinc-100">
                {recentlyDecided.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-2.5">
                      <span className={`mr-2 rounded-full px-2 py-0.5 text-[10px] font-medium ${p.status === "approved" ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-500"}`}>
                        {p.status}
                      </span>
                      <span className="text-zinc-800">{p.title}</span>
                      <span className="ml-2 text-xs text-zinc-400">· {p.accountLabel}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs text-zinc-400">
                      {p.decidedBy ?? ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function ProposalCard({ p }: { p: Proposal }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-[#0B1F3A]/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#0B1F3A]">
          {TYPE_LABEL[p.type]}
        </span>
        <Link href={`/clients/${p.clientId}`} className="text-xs font-medium text-zinc-500 hover:underline">
          {p.accountLabel}
        </Link>
        <span className="ml-auto text-[11px] text-zinc-400">{p.createdBy === "rexos-agent" || p.createdBy == null ? "Rexos" : p.createdBy}</span>
      </div>
      <h3 className="mt-2 text-sm font-semibold text-zinc-900">{p.title}</h3>
      {p.rationale && <p className="mt-1.5 text-sm text-zinc-600">{p.rationale}</p>}
      <Details type={p.type} details={p.details} />
      <div className="mt-4 flex gap-2">
        <form action={approveProposal}>
          <input type="hidden" name="id" value={p.id} />
          <ConfirmSubmitButton
            message="Approve this proposal? This records your decision — remember to apply the change in Google Ads."
            className="rounded-md bg-emerald-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
          >
            Approve
          </ConfirmSubmitButton>
        </form>
        <form action={dismissProposal}>
          <input type="hidden" name="id" value={p.id} />
          <ConfirmSubmitButton
            message="Dismiss this proposal?"
            className="rounded-md border border-zinc-300 bg-white px-3.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
          >
            Dismiss
          </ConfirmSubmitButton>
        </form>
      </div>
    </div>
  );
}

function Details({ type, details }: { type: ProposalType; details: Record<string, unknown> }) {
  const str = (v: unknown) => (v == null ? "" : String(v));
  const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);
  let body: React.ReactNode = null;

  if (type === "negative_keywords") {
    const kws = arr(details.keywords);
    body = (
      <>
        {details.campaign != null && <Line label="Campaign" value={str(details.campaign)} />}
        {kws.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {kws.map((k, i) => (
              <span key={i} className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-600">{k}</span>
            ))}
          </div>
        )}
      </>
    );
  } else if (type === "pause_campaign") {
    body = <Line label="Campaign" value={str(details.campaign)} />;
  } else if (type === "budget_reallocation") {
    body = (
      <Line
        label="Move"
        value={`${str(details.amount)} ${str(details.currency)} · ${str(details.from)} → ${str(details.to)}`}
      />
    );
  } else if (type === "rsa_improvement") {
    const sugg = arr(details.suggestions);
    body = (
      <>
        {details.campaign != null && <Line label="Campaign" value={str(details.campaign)} />}
        {sugg.length > 0 && (
          <ul className="mt-1.5 list-disc pl-4 text-xs text-zinc-600">
            {sugg.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        )}
      </>
    );
  } else if (Object.keys(details).length > 0) {
    body = <pre className="mt-1.5 overflow-x-auto rounded bg-zinc-50 p-2 text-[11px] text-zinc-600">{JSON.stringify(details, null, 2)}</pre>;
  }
  if (!body) return null;
  return <div className="mt-3 border-t border-zinc-100 pt-3">{body}</div>;
}

function Line({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="text-xs">
      <span className="text-zinc-400">{label}: </span>
      <span className="text-zinc-700">{value}</span>
    </div>
  );
}

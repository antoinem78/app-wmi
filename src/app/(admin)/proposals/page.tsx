// Rexos Proposals — the human approval + controlled-execution queue.
//   pending  → Approve / Dismiss
//   approved → Dry-run (validate_only) / Apply (real mutate)  [executable only]
//   applied  → Rollback
// Writes are gated by a kill switch + allowlist (P5-Lite); when off, this is a
// pure propose-only queue.
import Link from "next/link";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { listProposals, type Proposal, type ProposalType } from "@/lib/proposals";
import { writeEnabled, allowedCustomers, parseAction } from "@/lib/integrations/google-ads/write";
import {
  approveProposal, dismissProposal, deleteProposalAction,
  dryRunProposalAction, applyProposalAction, rollbackProposalAction,
} from "./actions";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<ProposalType, string> = {
  negative_keywords: "Negatives",
  pause_campaign: "Pause",
  budget_reallocation: "Budget",
  rsa_improvement: "RSA",
  other: "Change",
};

function isExecutable(p: Proposal): boolean {
  const a = parseAction(p.details ?? {});
  return !!a && !("error" in a);
}

export default async function ProposalsPage() {
  const [pending, approved, applied, recent] = await Promise.all([
    listProposals({ status: "pending", limit: 100 }),
    listProposals({ status: "approved", limit: 100 }),
    listProposals({ status: "applied", limit: 50 }),
    listProposals({ limit: 40 }),
  ]);
  const decidedTail = recent.filter((p) => ["dismissed", "rolled_back", "failed"].includes(p.status)).slice(0, 20);
  const writesOn = writeEnabled();
  const allowN = allowedCustomers().size;

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Proposals</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Review, approve, and (when enabled) execute optimisations behind validate → mutate → verify → rollback.
          </p>
        </div>
        <Link href="/dashboard" className="text-sm font-medium text-[#0B1F3A] hover:underline">
          ← Command Center
        </Link>
      </div>

      {/* Write-mode banner — kill switch visibility */}
      <div className={`mt-4 rounded-lg border px-4 py-2.5 text-sm ${writesOn ? "border-amber-300 bg-amber-50 text-amber-900" : "border-zinc-200 bg-zinc-50 text-zinc-600"}`}>
        {writesOn ? (
          <><span className="font-semibold">Write mode: ENABLED</span> · {allowN} account{allowN === 1 ? "" : "s"} allowlisted · approved executable proposals can be applied (validate-only first).</>
        ) : (
          <><span className="font-semibold">Write mode: OFF (propose-only)</span> · approving records your decision; you apply changes in Google Ads. Set <code>GOOGLE_ADS_WRITE_ENABLED=true</code> + allowlist to enable controlled execution.</>
        )}
      </div>

      <Section title="Pending review" count={pending.length}>
        {pending.length === 0 ? (
          <Empty>No proposals pending. Ask Rexos to propose one.</Empty>
        ) : (
          <Grid>{pending.map((p) => <PendingCard key={p.id} p={p} />)}</Grid>
        )}
      </Section>

      {approved.length > 0 && (
        <Section title="Approved — ready to apply" count={approved.length}>
          <Grid>{approved.map((p) => <ApprovedCard key={p.id} p={p} writesOn={writesOn} />)}</Grid>
        </Section>
      )}

      {applied.length > 0 && (
        <Section title="Applied" count={applied.length}>
          <Grid>{applied.map((p) => <AppliedCard key={p.id} p={p} />)}</Grid>
        </Section>
      )}

      {decidedTail.length > 0 && (
        <Section title="History">
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-zinc-100">
                {decidedTail.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-2.5">
                      <StatusTag status={p.status} />
                      <span className="ml-2 text-zinc-800">{p.title}</span>
                      <span className="ml-2 text-xs text-zinc-400">· {p.accountLabel}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Form action={deleteProposalAction} id={p.id} msg="Permanently delete this proposal? This cannot be undone." cls="border border-red-200 bg-white text-red-600 hover:bg-red-50">Delete</Form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </div>
  );
}

/* ---------- cards ---------- */
function CardHead({ p }: { p: Proposal }) {
  return (
    <div className="flex items-center gap-2">
      <span className="rounded-full bg-[#0B1F3A]/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#0B1F3A]">{TYPE_LABEL[p.type]}</span>
      {isExecutable(p) && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Executable</span>}
      <Link href={`/clients/${p.clientId}`} className="text-xs font-medium text-zinc-500 hover:underline">{p.accountLabel}</Link>
      <span className="ml-auto text-[11px] text-zinc-400">{p.createdBy === "rexos-agent" || p.createdBy == null ? "Rexos" : p.createdBy}</span>
    </div>
  );
}

function PendingCard({ p }: { p: Proposal }) {
  return (
    <Card>
      <CardHead p={p} />
      <Body p={p} />
      <div className="mt-4 flex gap-2">
        <Form action={approveProposal} id={p.id} msg="Approve this proposal?" cls="bg-emerald-600 text-white hover:bg-emerald-700">Approve</Form>
        <Form action={dismissProposal} id={p.id} msg="Dismiss this proposal?" cls="border border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50">Dismiss</Form>
        <Form action={deleteProposalAction} id={p.id} msg="Permanently delete this proposal? This cannot be undone." cls="border border-red-200 bg-white text-red-600 hover:bg-red-50">Delete</Form>
      </div>
    </Card>
  );
}

function ApprovedCard({ p, writesOn }: { p: Proposal; writesOn: boolean }) {
  const exec = isExecutable(p);
  const lastErr = (p.execution?.lastError as string | undefined) ?? undefined;
  const validated = !!(p.execution?.lastValidate as Record<string, unknown> | undefined);
  return (
    <Card>
      <CardHead p={p} />
      <Body p={p} />
      {!exec ? (
        <p className="mt-3 text-xs text-zinc-400">Advisory only — apply this one manually in Google Ads.</p>
      ) : !writesOn ? (
        <p className="mt-3 text-xs text-amber-700">Approved. Execution is disabled (write mode off) — apply it in Google Ads, or enable write mode to run it here.</p>
      ) : (
        <div className="mt-4 flex items-center gap-2">
          <Form action={dryRunProposalAction} id={p.id} msg="Run a validate-only dry run (no change)?" cls="border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50">Dry-run</Form>
          <Form action={applyProposalAction} id={p.id} msg="APPLY this change to the live Google Ads account? It validates first, then mutates. This is a real change." cls="bg-[#0B1F3A] text-white hover:bg-[#0B1F3A]/90">Apply</Form>
          {validated && !lastErr && <span className="text-[11px] text-emerald-600">✓ validated</span>}
        </div>
      )}
      {lastErr && <p className="mt-2 rounded bg-red-50 px-2 py-1 text-[11px] text-red-700">{lastErr}</p>}
    </Card>
  );
}

function AppliedCard({ p }: { p: Proposal }) {
  const before = JSON.stringify(p.execution?.before ?? {});
  const after = JSON.stringify(p.execution?.after ?? {});
  return (
    <Card>
      <CardHead p={p} />
      <Body p={p} />
      <div className="mt-3 space-y-1 rounded-lg bg-zinc-50 p-2 text-[11px] text-zinc-600">
        <div><span className="text-zinc-400">before:</span> {before}</div>
        <div><span className="text-zinc-400">after:</span> {after}</div>
        <div className="text-zinc-400">applied by {(p.execution?.appliedBy as string) ?? "—"}</div>
      </div>
      <div className="mt-3">
        <Form action={rollbackProposalAction} id={p.id} msg="Roll back this change (re-validate then reverse it)?" cls="border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100">Rollback</Form>
      </div>
      {(p.execution?.lastError as string | undefined) && <p className="mt-2 rounded bg-red-50 px-2 py-1 text-[11px] text-red-700">{p.execution!.lastError as string}</p>}
    </Card>
  );
}

/* ---------- shared bits ---------- */
function Body({ p }: { p: Proposal }) {
  return (
    <>
      <h3 className="mt-2 text-sm font-semibold text-zinc-900">{p.title}</h3>
      {p.rationale && <p className="mt-1.5 text-sm text-zinc-600">{p.rationale}</p>}
    </>
  );
}
function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">{children}</div>;
}
function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 lg:grid-cols-2">{children}</div>;
}
function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <>
      <h2 className="mt-10 text-sm font-semibold text-zinc-900">{title}{count != null && count > 0 ? ` (${count})` : ""}</h2>
      <div className="mt-3">{children}</div>
    </>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-400">{children}</div>;
}
function Form({ action, id, msg, cls, children }: { action: (fd: FormData) => Promise<void>; id: string; msg: string; cls: string; children: React.ReactNode }) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <ConfirmSubmitButton message={msg} className={`rounded-md px-3.5 py-1.5 text-xs font-medium ${cls}`}>{children}</ConfirmSubmitButton>
    </form>
  );
}
function StatusTag({ status }: { status: string }) {
  const m: Record<string, string> = {
    approved: "bg-emerald-50 text-emerald-700",
    applied: "bg-[#0B1F3A]/10 text-[#0B1F3A]",
    dismissed: "bg-zinc-100 text-zinc-500",
    rolled_back: "bg-amber-50 text-amber-700",
    failed: "bg-red-50 text-red-700",
  };
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${m[status] ?? "bg-zinc-100 text-zinc-500"}`}>{status}</span>;
}

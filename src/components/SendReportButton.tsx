"use client";

// On-demand "send report to Slack" control for the admin client page. Posts the
// report for whatever timeframe is currently selected on the dashboard (Week /
// Month / 14d / custom) to the Slack review channel. Shows inline result.
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { sendReportToSlack, type SendReportResult } from "@/app/(admin)/clients/actions";

function label(range: string): string {
  if (range === "week") return "this week";
  if (range === "month") return "last month";
  if (range.startsWith("custom:")) {
    const [, from, to] = range.split(":");
    return `${from} → ${to}`;
  }
  const m = range.match(/^(\d+)d$/);
  if (m) return `the last ${m[1]} days`;
  return "this period";
}

function SubmitButton({ range }: { range: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-lg bg-[#0B1F3A] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {pending ? "Generating & posting…" : `Send report for ${label(range)} to Slack`}
    </button>
  );
}

export function SendReportButton({ clientId, range }: { clientId: string; range: string }) {
  const [state, formAction] = useActionState<SendReportResult | null, FormData>(
    sendReportToSlack,
    null,
  );
  return (
    <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-zinc-900">Send report to Slack</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Posts an AI-written report for the currently selected timeframe to the review channel as a
        draft. Change the timeframe with the dashboard&rsquo;s range selector above.
      </p>
      <form action={formAction} className="mt-4 flex flex-wrap items-center gap-3">
        <input type="hidden" name="client_id" value={clientId} />
        <input type="hidden" name="range" value={range} />
        <SubmitButton range={range} />
      </form>
      {state && (
        <p className={`mt-3 text-sm ${state.ok ? "text-emerald-600" : "text-red-600"}`}>
          {state.message}
        </p>
      )}
    </section>
  );
}

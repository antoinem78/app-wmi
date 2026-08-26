// Norbert pane: the operation's front door. Everything is discussed here
// before Oscar and Bernard are called and dispatched (founder direction,
// 2026-08-26). Chat-first; the strip above it shows what currently sits in
// front of the founder on both sides, read live and best-effort.
// The (admin) layout has already enforced agency_admin before this renders.
import Link from "next/link";
import { bernardConfigured, getBernardStatus } from "@/lib/bernard";
import { pendingProposalCount } from "@/lib/proposals";
import { NorbertChat } from "@/components/NorbertChat";

export const dynamic = "force-dynamic";

export default async function NorbertPage() {
  // Both reads are best-effort: Norbert converses and dispatches on any
  // deployment with an Anthropic key, and each missing link explains itself.
  const oscarPending = await pendingProposalCount().catch(() => null);
  let bernardPending: number | null = null;
  if (bernardConfigured()) {
    try {
      bernardPending = (await getBernardStatus()).pending_fixes.length;
    } catch {
      bernardPending = null;
    }
  }

  return (
    <div className="p-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Norbert</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Supervisor. Discuss the work here first; Oscar and Bernard are briefed from this
            chat, and every execution gate still answers to you alone.
          </p>
        </div>
      </div>

      {/* What sits in front of the founder right now, on both sides */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:max-w-2xl">
        <Link
          href="/proposals"
          className="rounded-lg border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-300"
        >
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Oscar (Google): proposals pending
          </div>
          <div className="mt-1 text-2xl font-semibold text-zinc-900">
            {oscarPending ?? "–"}
          </div>
          <div className="mt-1 text-xs text-zinc-400">Decide on the Proposals page or in Oscar&rsquo;s chat</div>
        </Link>
        <Link
          href="/bernard"
          className="rounded-lg border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-300"
        >
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Bernard (Meta): fixes awaiting approval
          </div>
          <div className="mt-1 text-2xl font-semibold text-zinc-900">
            {bernardPending ?? "–"}
          </div>
          <div className="mt-1 text-xs text-zinc-400">Decide on Bernard&rsquo;s page or in his chat</div>
        </Link>
      </div>

      {/* The chat is the page */}
      <div className="mt-6 max-w-3xl">
        <NorbertChat heightClass="h-[calc(100vh-21rem)] min-h-[28rem]" />
      </div>
    </div>
  );
}

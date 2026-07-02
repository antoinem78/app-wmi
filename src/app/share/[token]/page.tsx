// Public, read-only client dashboard (parity P4). Reachable without sign-in at
// /share/<share_token>, but only when the client has sharing enabled. Renders the
// same verified dashboard as the portal, minus any controls or admin chrome.
import { notFound } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { entityConfig } from "@/lib/config";
import { AdsDashboard } from "@/components/AdsDashboard";
import { PrintButton } from "@/components/PrintButton";
import {
  getDashboard,
  parseRange,
  rangeKey,
  type DashboardPayload,
} from "@/lib/integrations/google-ads/reporting";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function SharedDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ range?: string }>;
}) {
  const { token } = await params;
  if (!UUID_RE.test(token)) notFound();
  const range = parseRange((await searchParams).range);

  const supabase = createSupabaseAdminClient();
  const { data: client } = await supabase
    .from("clients")
    .select("id, company_name, share_enabled")
    .eq("share_token", token)
    .single();
  if (!client || !client.share_enabled) notFound();

  const { data: state } = await supabase
    .from("onboarding_state")
    .select("google_ads_customer_id, google_ads_reporting_customer_id, ad_link_status")
    .eq("client_id", client.id)
    .single();

  const reportingId =
    state?.google_ads_reporting_customer_id ?? state?.google_ads_customer_id;
  const linked = state?.ad_link_status === "approved" && reportingId;

  let dashboard: DashboardPayload | null = null;
  if (linked) {
    try {
      dashboard = await getDashboard(client.id, reportingId as string, range);
    } catch {
      dashboard = null;
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <div className="text-sm font-semibold text-[#0B1F3A]">{entityConfig.brandName}</div>
            <h1 className="text-lg font-semibold text-zinc-900">{client.company_name}</h1>
          </div>
          <div className="flex items-center gap-3">
            {linked && <PrintButton />}
            <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-medium text-zinc-500 print:hidden">
              Live performance
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        {linked ? (
          <AdsDashboard
            payload={dashboard}
            basePath={`/share/${token}`}
            range={rangeKey(range)}
            hideRangeControl
          />
        ) : (
          <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center text-sm text-zinc-400 shadow-sm">
            Performance data isn&rsquo;t available yet.
          </div>
        )}
        <p className="mt-6 text-center text-[11px] text-zinc-400">
          Read-only dashboard · figures refresh on load · prepared by {entityConfig.brandName}
        </p>
      </main>
    </div>
  );
}

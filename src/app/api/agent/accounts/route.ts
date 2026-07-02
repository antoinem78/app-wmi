// Account list for the Rexos chat selector — imported clients with a live Google
// Ads link (the accounts a per-account chat thread can focus on). Admin-only.
import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth/auth0";
import { isAgencyAdmin } from "@/lib/auth/roles";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export async function GET() {
  const session = await auth0.getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!isAgencyAdmin(session.user as Record<string, unknown>)) {
    return NextResponse.json({ error: "Agency admin only." }, { status: 403 });
  }

  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("onboarding_state")
    .select("client_id, clients(company_name)")
    .eq("ad_link_status", "approved")
    .not("google_ads_customer_id", "is", null);

  const accounts = (data ?? [])
    .map((r) => ({
      clientId: r.client_id as string,
      company:
        (r.clients as unknown as { company_name?: string } | null)?.company_name ?? "(unnamed)",
    }))
    .sort((a, b) => a.company.localeCompare(b.company));

  return NextResponse.json({ accounts });
}

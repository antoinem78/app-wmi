// Generate a WMI Google Ads audit (.docx) for a client and stream it as a
// download. Admin-only. Read-only on the ad account. ~2 min (Claude narrative),
// so maxDuration is the function ceiling.
import { readFileSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth/auth0";
import { isAgencyAdmin } from "@/lib/auth/roles";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { generateAudit } from "@/lib/audit/generate";

export const maxDuration = 300;

function loadLogo(): Buffer | undefined {
  try {
    return readFileSync(path.join(process.cwd(), "src/lib/audit/assets/wmi-logo.png"));
  } catch {
    return undefined; // cover falls back to a text wordmark
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ clientId: string }> }) {
  const session = await auth0.getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!isAgencyAdmin(session.user as Record<string, unknown>)) {
    return NextResponse.json({ error: "Agency admin only." }, { status: 403 });
  }
  const { clientId } = await params;

  let body: { budget?: number; website?: string } = {};
  try { body = await request.json(); } catch { /* empty body is fine */ }

  const supabase = createSupabaseAdminClient();
  const { data: state } = await supabase
    .from("onboarding_state")
    .select("google_ads_customer_id, google_ads_reporting_customer_id, ad_link_status, clients(company_name)")
    .eq("client_id", clientId)
    .single();
  const customerId = (state?.google_ads_reporting_customer_id ?? state?.google_ads_customer_id) as string | undefined;
  const company = (state?.clients as unknown as { company_name?: string } | null)?.company_name ?? "Account";
  if (!customerId) {
    return NextResponse.json({ error: "This client has no linked Google Ads account to audit." }, { status: 400 });
  }

  try {
    const budget = Number(body.budget);
    const { buffer } = await generateAudit(customerId, company, {
      website: body.website,
      monthlyBudget: Number.isFinite(budget) && budget > 0 ? budget : undefined,
      logo: loadLogo(),
    });
    const filename = `${company.replace(/[^\w &-]/g, "")} - Google Ads Audit.docx`;
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("Audit generation failed:", e);
    return NextResponse.json({ error: "Audit generation failed. Try again." }, { status: 500 });
  }
}

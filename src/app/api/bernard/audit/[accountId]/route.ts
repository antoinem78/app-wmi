// Downloadable Meta Ads audit (.docx) for one ad account — the link Bernard
// hands the founder in chat. Admin-only, read-only on the account, generated
// on demand (live reads + narrative pass), streamed as a download.
import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth/auth0";
import { isAgencyAdmin } from "@/lib/auth/roles";
import { metaConfigured } from "@/lib/integrations/meta";
import { generateMetaAudit } from "@/lib/audit/meta-generate";

export const maxDuration = 300;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ accountId: string }> },
) {
  const session = await auth0.getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!isAgencyAdmin(session.user as Record<string, unknown>)) {
    return NextResponse.json({ error: "Agency admin only." }, { status: 403 });
  }
  if (!metaConfigured()) {
    return NextResponse.json(
      { error: "Meta access is not configured on this deployment (META_ADS_TOKEN missing)." },
      { status: 503 },
    );
  }

  const { accountId } = await params;
  if (!/^(act_)?\d{6,}$/.test(accountId)) {
    return NextResponse.json({ error: "That doesn't look like a Meta ad account id." }, { status: 400 });
  }
  const daysRaw = Number(new URL(request.url).searchParams.get("days"));
  const days = Number.isFinite(daysRaw) ? Math.min(90, Math.max(7, Math.round(daysRaw))) : 30;

  try {
    const { buffer, accountName } = await generateMetaAudit(accountId, days);
    const filename = `${accountName.replace(/[^\w &-]/g, "")} - Meta Ads Audit.docx`;
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("Meta audit generation failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Audit generation failed." },
      { status: 500 },
    );
  }
}

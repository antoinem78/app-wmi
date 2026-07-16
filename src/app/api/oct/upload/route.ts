// Offline conversion upload (OCT). The substrate's n8n calls this when a GHL
// pipeline stage change signals a conversion (e.g. KST "Consultation Booked");
// we forward the click conversions to Google Ads through the existing MCC
// credentials. Auth: shared key in the x-oct-key header (OCT_UPLOAD_KEY env).
// The MCC-membership check is the same hard write boundary as every other
// Google Ads write; every attempt lands in write_audit.
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import {
  GoogleAdsError,
  isUnderMcc,
  uploadClickConversions,
  type ClickConversion,
} from "@/lib/integrations/google-ads";
import { recordWriteAudit } from "@/lib/write-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CONVERSIONS = 100;

function keyMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const expected = process.env.OCT_UPLOAD_KEY;
  if (!expected) {
    console.error("OCT_UPLOAD_KEY is not configured.");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }
  const provided = request.headers.get("x-oct-key") ?? "";
  if (!keyMatches(provided, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    customerId?: string;
    source?: string;
    conversions?: Array<{
      gclid?: string;
      conversionActionId?: string;
      conversionDateTime?: string;
      conversionValue?: number;
      currencyCode?: string;
    }>;
  } | null;

  const customerId = (body?.customerId ?? "").replace(/\D/g, "");
  const conversions = body?.conversions ?? [];
  if (!customerId || conversions.length === 0) {
    return NextResponse.json(
      { error: "customerId and a non-empty conversions array are required" },
      { status: 400 },
    );
  }
  if (conversions.length > MAX_CONVERSIONS) {
    return NextResponse.json(
      { error: `At most ${MAX_CONVERSIONS} conversions per request` },
      { status: 400 },
    );
  }
  const cleaned: ClickConversion[] = [];
  for (const c of conversions) {
    if (!c.gclid || !c.conversionActionId || !/^\d+$/.test(c.conversionActionId)) {
      return NextResponse.json(
        { error: "Every conversion needs a gclid and a numeric conversionActionId" },
        { status: 400 },
      );
    }
    cleaned.push({
      gclid: c.gclid,
      conversionActionId: c.conversionActionId,
      conversionDateTime: c.conversionDateTime,
      conversionValue: c.conversionValue,
      currencyCode: c.currencyCode,
    });
  }

  // Hard write boundary: only accounts under this deployment's MCC.
  if (!(await isUnderMcc(customerId))) {
    await recordWriteAudit({
      customerId,
      action: "oct_upload",
      phase: "apply",
      mccCheck: "fail",
      result: "boundary_violation",
      detail: { source: body?.source ?? "unknown", count: cleaned.length },
    });
    return NextResponse.json({ error: "Customer is not under this MCC" }, { status: 403 });
  }

  try {
    const res = await uploadClickConversions(customerId, cleaned);
    const partial = res.partialFailureError?.message ?? null;
    await recordWriteAudit({
      customerId,
      action: "oct_upload",
      phase: "apply",
      mccCheck: "ok",
      result: partial ? "failed" : "ok",
      detail: {
        source: body?.source ?? "unknown",
        count: cleaned.length,
        actions: [...new Set(cleaned.map((c) => c.conversionActionId))],
        partialFailure: partial,
      },
    });
    return NextResponse.json({ ok: !partial, uploaded: cleaned.length, partialFailure: partial });
  } catch (err) {
    const message = err instanceof GoogleAdsError ? err.message : "Upload failed";
    console.error("[/api/oct/upload]", err);
    await recordWriteAudit({
      customerId,
      action: "oct_upload",
      phase: "apply",
      mccCheck: "ok",
      result: "failed",
      detail: { source: body?.source ?? "unknown", count: cleaned.length, error: message },
    });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

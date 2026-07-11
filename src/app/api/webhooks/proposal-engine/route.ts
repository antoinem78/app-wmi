// Proposal-engine webhook receiver (used by CONTRACT_PROVIDER=proposal-engine
// deployments). The engine signs the raw JSON body with HMAC-SHA256 using the
// shared WEBHOOK_SECRET and sends the hex digest in the X-Signature header.
// proposal.accepted → contract signed; the client is found via the stored
// document id (onboarding_state.pandadoc_document_id holds whichever
// provider's document id this deployment uses).
import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { markContractSigned } from "@/lib/integrations/contracts";

// HMAC verification uses Node crypto — pin the Node runtime (never Edge).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

export async function POST(request: Request) {
  const secret = process.env.PROPOSAL_ENGINE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("PROPOSAL_ENGINE_WEBHOOK_SECRET is not configured.");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  const signature = request.headers.get("x-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const rawBody = await request.text();
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    const event = JSON.parse(rawBody) as {
      event: string;
      proposal?: { id?: string };
    };
    if (event.event === "proposal.accepted" && event.proposal?.id) {
      const supabase = createSupabaseAdminClient();
      const { data: state } = await supabase
        .from("onboarding_state")
        .select("client_id")
        .eq("pandadoc_document_id", event.proposal.id)
        .single();
      if (state?.client_id) {
        await markContractSigned(state.client_id, "proposal-engine-webhook");
      } else {
        // Not an error: viewed/pricing events for unknown ids land here too.
        console.warn(`No onboarding state for proposal ${event.proposal.id}.`);
      }
    }
    return NextResponse.json({ received: true });
  } catch (e) {
    console.error("Proposal-engine webhook handling failed:", e);
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }
}

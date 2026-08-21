// Voice access token for the /dial page. Admin session only: this token is
// what authorises a browser to place calls billed to the WMI Twilio account,
// so it gets the same gate as everything else in the admin area.
import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth/auth0";
import { isAgencyAdmin } from "@/lib/auth/roles";
import { mintVoiceToken } from "@/lib/twilio";

export async function GET() {
  const session = await auth0.getSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const user = session.user as Record<string, unknown>;
  if (!isAgencyAdmin(user)) {
    return NextResponse.json({ error: "Agency admin only." }, { status: 403 });
  }
  const identity = typeof user.email === "string" ? user.email.replace(/[^a-zA-Z0-9_.@-]/g, "_") : "agency_admin";
  try {
    return NextResponse.json({
      token: mintVoiceToken(identity),
      callerId: process.env.TWILIO_CALLER_ID ?? "",
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Token mint failed." }, { status: 500 });
  }
}

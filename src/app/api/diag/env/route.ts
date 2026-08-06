// Configuration health: which environment variables this deployment actually
// has, as booleans. NEVER returns a value, not even a prefix, so the response
// is safe to read over a relay and paste into a chat.
//
// Exists because "are the two portals configured equivalently" was previously
// answerable only by eyeballing two Vercel dashboards, and a variable set on
// the wrong project looks identical to one that was never set at all. Gated to
// the agency admin session, or either agent relay key so a Code session can
// check both deployments in one pass.
import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { auth0 } from "@/lib/auth/auth0";
import { isAgencyAdmin } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

// Everything the app reads, grouped the way a person provisioning a portal
// thinks about it. Keep in step with .env.example.
const GROUPS: Record<string, string[]> = {
  core: ["APP_BASE_URL", "SUPABASE_URL", "SUPABASE_SECRET_KEY", "CRON_SECRET"],
  auth: ["AUTH0_DOMAIN", "AUTH0_CLIENT_ID", "AUTH0_CLIENT_SECRET", "AUTH0_SECRET", "AUTH0_ROLES_CLAIM"],
  entity: [
    "ENTITY_LEGAL_NAME", "BRAND_NAME", "CURRENCY", "ENTITY_CURRENCIES",
    "ENTITY_REGISTRATION_INFO", "VAT_RATE", "VAT_NUMBER", "PRIVACY_URL",
  ],
  billing: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
  email: ["RESEND_API_KEY", "EMAIL_FROM", "CONTRACT_COPY_TO"],
  contracts: [
    "CONTRACT_PROVIDER",
    "PANDADOC_API_KEY", "PANDADOC_TEMPLATE_ID", "PANDADOC_WEBHOOK_KEY",
    "PROPOSAL_ENGINE_URL", "PROPOSAL_ENGINE_API_TOKEN", "PROPOSAL_ENGINE_WEBHOOK_SECRET",
    "AGREEMENT_SIGNATORY_NAME", "AGREEMENT_SIGNATORY_TITLE", "AGREEMENT_GOVERNING_LAW",
  ],
  agents: [
    "ANTHROPIC_API_KEY", "MEMORY_SUPABASE_URL", "MEMORY_SUPABASE_SECRET_KEY",
    "BERNARD_WEBHOOK_KEY", "BERNARD_RELAY_KEY", "OSCAR_RELAY_KEY",
  ],
  platforms: [
    "META_ADS_TOKEN", "META_BUSINESS_ID",
    "GOOGLE_ADS_DEVELOPER_TOKEN", "GOOGLE_ADS_CLIENT_ID", "GOOGLE_ADS_CLIENT_SECRET",
    "GOOGLE_ADS_REFRESH_TOKEN", "GOOGLE_ADS_LOGIN_CUSTOMER_ID",
    "GOOGLE_ADS_WRITE_ENABLED", "GOOGLE_ADS_WRITE_CUSTOMERS", "ALLOW_ALL_MCC_ACCOUNTS",
  ],
  slack: ["SLACK_BOT_TOKEN", "SLACK_TEAM_EMAILS", "SLACK_REVIEW_CHANNEL", "SLACK_OPS_CHANNEL"],
};

function relayOk(request: Request): boolean {
  for (const [envName, header] of [
    ["BERNARD_RELAY_KEY", "x-bernard-relay-key"],
    ["OSCAR_RELAY_KEY", "x-oscar-relay-key"],
  ] as const) {
    const expected = process.env[envName];
    const given = request.headers.get(header);
    if (!expected || !given) continue;
    const a = Buffer.from(given);
    const b = Buffer.from(expected);
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }
  return false;
}

export async function GET(request: Request) {
  if (!relayOk(request)) {
    const session = await auth0.getSession();
    const user = session?.user as Record<string, unknown> | undefined;
    if (!user || !isAgencyAdmin(user)) {
      return NextResponse.json({ error: "Not authorised." }, { status: 401 });
    }
  }

  const present: Record<string, Record<string, boolean>> = {};
  for (const [group, names] of Object.entries(GROUPS)) {
    present[group] = Object.fromEntries(
      names.map((n) => [n, !!(process.env[n] ?? "").trim()]),
    );
  }

  // Non-secret facts that decide whether a deployment can actually transact.
  // A key's MODE is visible in every Stripe dashboard and a From address rides
  // on every email sent, so neither leaks anything; both catch the two silent
  // misconfigurations that strand a paying client (test key in production, and
  // a live key paired with a test-mode webhook secret).
  const sk = (process.env.STRIPE_SECRET_KEY ?? "").trim();
  const stripeMode = sk.startsWith("sk_live_")
    ? "live"
    : sk.startsWith("sk_test_")
      ? "TEST"
      : sk
        ? "unrecognised"
        : "unset";
  const from = (process.env.EMAIL_FROM ?? "").trim();
  const fromDomain = from.includes("@") ? from.split("@").pop()?.replace(/>.*$/, "") ?? "" : "";

  return NextResponse.json(
    {
      deployment: process.env.APP_BASE_URL ?? "(APP_BASE_URL unset)",
      stripe_mode: stripeMode,
      email_from_domain: fromDomain,
      brand: process.env.BRAND_NAME ?? "",
      currency: process.env.CURRENCY ?? "",
      contract_provider: process.env.CONTRACT_PROVIDER || "pandadoc (default)",
      present,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

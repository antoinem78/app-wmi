// Next.js 16 renamed "middleware" to "proxy" — same job: run code at the network
// boundary on every matched request. The Auth0 SDK uses this to (a) mount its
// /auth/* routes (login, logout, callback) and (b) keep the session cookie fresh.
//
// This file does NOT do authorization — that happens close to the data, in
// src/app/(admin)/layout.tsx. (Per Next.js guidance, proxy is for lightweight
// request handling, not as the security gate.)
import { auth0 } from "@/lib/auth/auth0";

export async function proxy(request: Request) {
  return await auth0.middleware(request);
}

export const config = {
  matcher: [
    // Run on everything except static assets, metadata files, and the
    // machine-to-machine endpoints. Webhooks (Stripe/PandaDoc) and crons
    // authenticate themselves (signature / CRON_SECRET) and must NOT pass
    // through Auth0 — a session-less POST can otherwise be redirected to the
    // login flow, which Stripe reports as a delivery failure ("other errors").
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|api/webhooks|api/cron).*)",
  ],
};

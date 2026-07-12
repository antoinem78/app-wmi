// Per-deployment entity/brand configuration — the ONLY place these env vars are
// read. The same app is deployed once per entity (e.g. BJ PPC → USD, WMI → GBP),
// each Vercel project carrying its own env set. Code must never branch on which
// entity it is; it just reads this config. See .env.example.
//
// Server-side only (none of these are NEXT_PUBLIC_): import from Server
// Components and server actions, not from "use client" files.

export const entityConfig = {
  /** Legal entity behind this deployment, e.g. "BJ PPC sp. z o.o. trading as PPC Mastery".
   *  Used on contracts/invoices from Phase 2. */
  legalName: process.env.ENTITY_LEGAL_NAME ?? "",

  /** Brand shown in the UI (wordmark, titles, wizard header). */
  brandName: process.env.BRAND_NAME ?? "WMI",

  /** Optional logo image; when empty the text wordmark is rendered instead. */
  brandLogoUrl: process.env.BRAND_LOGO_URL ?? "",

  /** ISO 4217 currency for all price formatting (GBP for WMI). */
  currency: process.env.CURRENCY ?? "GBP",

  /** VAT percentage for quotes/invoices (Phase 2). Null = not configured. */
  vatRate: process.env.VAT_RATE ? Number(process.env.VAT_RATE) : null,

  /** VAT number shown on contract/invoice footers (Phase 2). */
  vatNumber: process.env.VAT_NUMBER ?? "",

  /** Reporting-only deployment (e.g. "MCC Command Center" for BJ PPC's existing
   *  premium clients): no onboarding funnel — only "Add managed account" +
   *  dashboards + weekly reports. The full onboarding portal leaves this off. */
  reportingOnly: process.env.PORTAL_REPORTING_ONLY === "true",

  /** Company registration sentence fragment for the agreement preamble, e.g.
   *  "a company registered in England & Wales (company number 10264568),
   *  registered office 124 City Road, London, EC1V 2NX, VAT registration
   *  GB266586851". Empty = only the legal name is shown. */
  registrationInfo: process.env.ENTITY_REGISTRATION_INFO ?? "",

  /** Governing law named in the agreement's data-protection and jurisdiction
   *  clauses, e.g. "England and Wales". */
  governingLaw: process.env.AGREEMENT_GOVERNING_LAW ?? "England and Wales",

  /** Privacy policy URL referenced by the agreement's data-protection clause. */
  privacyUrl:
    process.env.PRIVACY_URL ??
    `${process.env.APP_BASE_URL ?? ""}/privacy`,
};

export function formatMoney(amount: number): string {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: entityConfig.currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

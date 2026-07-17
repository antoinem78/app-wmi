// Google Ads integration seam — Phase 4 (account linking from the WMI
// MCC). Per docs/google-ads-api-lessons.md: the developer token is passed as an
// explicit header on EVERY call, and all calls authenticate as the MCC via the
// login-customer-id header — if a call fails with permission errors despite
// valid credentials, check that header first.
//
// Design constraint (declared to Google): no client OAuth. The portal uses ONE
// stored refresh token (MCC admin) and sends link invitations; clients accept
// inside Google Ads.

const API_VERSION = process.env.GOOGLE_ADS_API_VERSION ?? "v24";
const API = `https://googleads.googleapis.com/${API_VERSION}`;

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Google Ads is not configured (${name} missing).`);
  return v;
}

// Access tokens last ~1h; cache with a safety margin.
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.token;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: requireEnv("GOOGLE_ADS_CLIENT_ID"),
      client_secret: requireEnv("GOOGLE_ADS_CLIENT_SECRET"),
      refresh_token: requireEnv("GOOGLE_ADS_REFRESH_TOKEN"),
      grant_type: "refresh_token",
    }),
  });
  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
  };
  if (!data.access_token) {
    throw new Error(`Google OAuth token refresh failed: ${data.error_description ?? "unknown"}`);
  }
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + ((data.expires_in ?? 3600) - 300) * 1000,
  };
  return data.access_token;
}

async function adsHeaders(): Promise<Record<string, string>> {
  return {
    Authorization: `Bearer ${await getAccessToken()}`,
    "developer-token": requireEnv("GOOGLE_ADS_DEVELOPER_TOKEN"),
    "login-customer-id": requireEnv("GOOGLE_ADS_LOGIN_CUSTOMER_ID"),
    "Content-Type": "application/json",
  };
}

/** Pull a human-readable message out of a Google Ads REST error payload. */
function extractAdsError(body: unknown): string {
  const b = body as {
    error?: {
      message?: string;
      details?: Array<{ errors?: Array<{ message?: string; errorCode?: Record<string, string> }> }>;
    };
  };
  const detail = b.error?.details?.flatMap((d) => d.errors ?? [])[0];
  return detail?.message ?? b.error?.message ?? "Unknown Google Ads API error";
}

export class GoogleAdsError extends Error {
  constructor(
    message: string,
    /** True when the error indicates the customer ID doesn't exist / isn't reachable. */
    public readonly isInvalidCustomer: boolean,
  ) {
    super(message);
  }
}

/**
 * Send a link invitation from the WMI MCC to the client's account.
 * Creates a CustomerClientLink with status PENDING — the client must accept it
 * inside Google Ads. Returns the link's resource name (used for status checks).
 */
export async function sendLinkInvitation(clientCustomerId: string): Promise<string> {
  const mcc = requireEnv("GOOGLE_ADS_LOGIN_CUSTOMER_ID");
  const res = await fetch(`${API}/customers/${mcc}/customerClientLinks:mutate`, {
    method: "POST",
    headers: await adsHeaders(),
    body: JSON.stringify({
      operation: {
        create: {
          clientCustomer: `customers/${clientCustomerId}`,
          status: "PENDING",
        },
      },
    }),
  });
  const body = await res.json();
  if (!res.ok) {
    const message = extractAdsError(body);
    const text = JSON.stringify(body);
    const invalid =
      res.status === 404 ||
      /NOT_FOUND|INVALID_CUSTOMER|USER_PERMISSION_DENIED|CUSTOMER_NOT_FOUND|INVALID_ARGUMENT/i.test(
        text,
      );
    throw new GoogleAdsError(message, invalid);
  }
  const result = body as { result?: { resourceName?: string } };
  if (!result.result?.resourceName) {
    throw new GoogleAdsError("Google did not return a link resource name.", false);
  }
  return result.result.resourceName;
}

/**
 * Unified Google Ads mutate (GoogleAdsService.Mutate). Sends an operations array
 * to customers/{cid}/googleAds:mutate. Supports validateOnly (server-side
 * validation with NO change) and partialFailure. This is the ONLY write path;
 * all guardrails live above it (see google-ads/write.ts + proposals-execute.ts).
 * Returns the parsed response (mutateOperationResponses) or throws GoogleAdsError.
 */
export async function googleAdsMutate(
  customerId: string,
  mutateOperations: unknown[],
  opts: { validateOnly?: boolean; partialFailure?: boolean } = {},
): Promise<{ mutateOperationResponses?: Array<Record<string, unknown>>; [k: string]: unknown }> {
  const res = await fetch(`${API}/customers/${customerId}/googleAds:mutate`, {
    method: "POST",
    headers: await adsHeaders(),
    body: JSON.stringify({
      mutateOperations,
      validateOnly: opts.validateOnly ?? false,
      partialFailure: opts.partialFailure ?? false,
    }),
  });
  const body = await res.json();
  if (!res.ok) {
    const text = JSON.stringify(body);
    const invalid =
      res.status === 404 ||
      /NOT_FOUND|INVALID_CUSTOMER|USER_PERMISSION_DENIED|CUSTOMER_NOT_FOUND/i.test(text);
    throw new GoogleAdsError(extractAdsError(body), invalid);
  }
  return body as { mutateOperationResponses?: Array<Record<string, unknown>> };
}

export interface ClickConversion {
  gclid: string;
  /** Conversion action resource id (numeric part) in the target account. */
  conversionActionId: string;
  /** RFC 3339 (e.g. "2026-07-18T14:00:00Z") — defaults to now when omitted. */
  conversionDateTime?: string;
  conversionValue?: number;
  currencyCode?: string;
}

/**
 * Offline conversion upload via the Data Manager API (events:ingest).
 * ConversionUploadService.UploadClickConversions is closed to new integrations
 * (verified live 2026-07-18: "limited to existing users"), so gclid conversions
 * go through datamanager.googleapis.com instead. Same OAuth client/refresh
 * token as the Ads API, but the token must carry the additional
 * https://www.googleapis.com/auth/datamanager scope.
 *
 * Events are grouped per conversion action (one destination each). Returns the
 * per-action results; a failed action does not block the others.
 */
export async function uploadClickConversions(
  customerId: string,
  conversions: ClickConversion[],
): Promise<{
  results?: Array<Record<string, unknown>>;
  partialFailureError?: { message?: string };
}> {
  const mcc = requireEnv("GOOGLE_ADS_LOGIN_CUSTOMER_ID").replace(/\D/g, "");
  const token = await getAccessToken();
  const byAction = new Map<string, ClickConversion[]>();
  for (const c of conversions) {
    const list = byAction.get(c.conversionActionId) ?? [];
    list.push(c);
    byAction.set(c.conversionActionId, list);
  }

  const results: Array<Record<string, unknown>> = [];
  const failures: string[] = [];
  for (const [actionId, list] of byAction) {
    const res = await fetch("https://datamanager.googleapis.com/v1/events:ingest", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        destinations: [
          {
            operatingAccount: { accountType: "GOOGLE_ADS", accountId: customerId },
            loginAccount: { accountType: "GOOGLE_ADS", accountId: mcc },
            productDestinationId: actionId,
          },
        ],
        events: list.map((c) => ({
          adIdentifiers: { gclid: c.gclid },
          eventTimestamp: c.conversionDateTime ?? new Date().toISOString(),
          ...(c.conversionValue != null
            ? { conversionValue: c.conversionValue, currency: c.currencyCode ?? "GBP" }
            : {}),
        })),
      }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      requestId?: string;
      error?: { message?: string };
    };
    if (!res.ok) {
      failures.push(`action ${actionId}: ${body.error?.message ?? `HTTP ${res.status}`}`);
    } else {
      results.push({ conversionActionId: actionId, requestId: body.requestId, count: list.length });
    }
  }
  if (results.length === 0 && failures.length > 0) {
    throw new GoogleAdsError(failures.join("; "), false);
  }
  return {
    results,
    partialFailureError: failures.length ? { message: failures.join("; ") } : undefined,
  };
}

/**
 * Run a GAQL query against a customer account (authenticated as the MCC via the
 * login-customer-id header). Returns the raw result rows.
 */
export async function gaqlSearch(
  customerId: string,
  query: string,
): Promise<Record<string, unknown>[]> {
  const res = await fetch(`${API}/customers/${customerId}/googleAds:search`, {
    method: "POST",
    headers: await adsHeaders(),
    body: JSON.stringify({ query }),
  });
  const body = await res.json();
  if (!res.ok) throw new GoogleAdsError(extractAdsError(body), false);
  return (body as { results?: Record<string, unknown>[] }).results ?? [];
}

/**
 * Given a linked customer id (which may be a manager/MCC), find the account we
 * should REPORT on. Managers have no campaigns, so we enumerate the hierarchy
 * and take the leaf account(s). Returns the single leaf when there's exactly
 * one (auto-resolves the common case); flags `multi` when a manager has several
 * leaves (account selection — built on top of this later).
 */
export async function resolveReportingCustomerId(linkedCustomerId: string): Promise<{
  reportingId: string | null;
  leaves: { id: string; name: string; currency: string }[];
  multi: boolean;
}> {
  const rows = await gaqlSearch(
    linkedCustomerId,
    `SELECT customer_client.id, customer_client.descriptive_name,
            customer_client.currency_code, customer_client.manager
     FROM customer_client WHERE customer_client.status = 'ENABLED'`,
  );
  const leaves = rows
    .map(
      (r) =>
        (r.customerClient ?? {}) as {
          id?: string | number;
          descriptiveName?: string;
          currencyCode?: string;
          manager?: boolean;
        },
    )
    .filter((c) => c.manager === false && c.id != null)
    .map((c) => ({
      id: String(c.id),
      name: c.descriptiveName ?? "",
      currency: c.currencyCode ?? "",
    }));
  if (leaves.length === 1) return { reportingId: leaves[0].id, leaves, multi: false };
  return { reportingId: null, leaves, multi: leaves.length > 1 };
}

// ---- MCC membership (the hard write boundary) ----
// The set of every customer id ENABLED under this deployment's MCC (managers +
// leaves), plus the MCC id itself. Writes are permitted ONLY to ids in this set,
// verified against the LIVE hierarchy — never a trusted UI value. Cached briefly.
let mccCache: { ids: Set<string>; expiresAt: number } | null = null;
const MCC_TTL_MS = 15 * 60 * 1000;

export async function mccMemberSet(): Promise<Set<string>> {
  if (mccCache && Date.now() < mccCache.expiresAt) return mccCache.ids;
  const mcc = requireEnv("GOOGLE_ADS_LOGIN_CUSTOMER_ID");
  const rows = await gaqlSearch(
    mcc,
    `SELECT customer_client.id, customer_client.manager, customer_client.status
     FROM customer_client WHERE customer_client.status = 'ENABLED'`,
  );
  const ids = new Set<string>();
  ids.add(mcc.replace(/\D/g, "")); // include the MCC id itself
  for (const r of rows) {
    const c = (r.customerClient ?? {}) as { id?: string | number };
    if (c.id != null) ids.add(String(c.id).replace(/\D/g, ""));
  }
  mccCache = { ids, expiresAt: Date.now() + MCC_TTL_MS };
  return ids;
}

/** True iff customerId is under this deployment's MCC. Re-verifies live on a
 *  cache miss (a freshly-added account may not be in the cached set yet). */
export async function isUnderMcc(customerId: string): Promise<boolean> {
  const norm = customerId.replace(/\D/g, "");
  if (!norm) return false;
  if ((await mccMemberSet()).has(norm)) return true;
  mccCache = null; // force a live re-check on miss
  return (await mccMemberSet()).has(norm);
}

export interface ManagedLeaf {
  id: string;
  name: string;
  currency: string;
  level: number;
}

/**
 * Enumerate every leaf (non-manager) ad account under THIS deployment's MCC
 * (login-customer-id). Used by the bulk "import from MCC" flow — e.g. the MCC
 * Command Center clone pointed at the BJ main MCC, which has ~129 leaves.
 * Managers are excluded (they have no campaigns to report on).
 */
export async function listManagedAccounts(): Promise<ManagedLeaf[]> {
  const mcc = requireEnv("GOOGLE_ADS_LOGIN_CUSTOMER_ID");
  const rows = await gaqlSearch(
    mcc,
    `SELECT customer_client.id, customer_client.descriptive_name,
            customer_client.currency_code, customer_client.manager, customer_client.level
     FROM customer_client WHERE customer_client.status = 'ENABLED'`,
  );
  return rows
    .map(
      (r) =>
        (r.customerClient ?? {}) as {
          id?: string | number;
          descriptiveName?: string;
          currencyCode?: string;
          manager?: boolean;
          level?: string | number;
        },
    )
    .filter((c) => c.manager === false && c.id != null && String(c.id) !== mcc)
    .map((c) => ({
      id: String(c.id),
      name: c.descriptiveName ?? "",
      currency: c.currencyCode ?? "",
      level: Number(c.level ?? 0),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Map Google's link status to our ad_link_status enum (null = no change). */
export function portalStatusFor(
  googleStatus: string | null,
): "approved" | "refused" | "cancelled" | null {
  const map: Record<string, "approved" | "refused" | "cancelled"> = {
    ACTIVE: "approved",
    REFUSED: "refused",
    CANCELED: "cancelled",
    CANCELLED: "cancelled",
    INACTIVE: "cancelled",
  };
  return googleStatus ? (map[googleStatus] ?? null) : null;
}

/**
 * Current status of the MCC→client link: PENDING (invited, awaiting client),
 * ACTIVE (accepted), REFUSED, CANCELLED, INACTIVE — or null when no link exists.
 */
export async function getLinkStatus(clientCustomerId: string): Promise<string | null> {
  const mcc = requireEnv("GOOGLE_ADS_LOGIN_CUSTOMER_ID");
  // Note: customer_client_link does not allow ORDER BY — fetch all links for
  // this account and pick the most relevant by precedence (an old cancelled
  // link may coexist with a fresh pending/active one).
  const res = await fetch(`${API}/customers/${mcc}/googleAds:search`, {
    method: "POST",
    headers: await adsHeaders(),
    body: JSON.stringify({
      query: `SELECT customer_client_link.status, customer_client_link.resource_name FROM customer_client_link WHERE customer_client_link.client_customer = 'customers/${clientCustomerId}'`,
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new GoogleAdsError(extractAdsError(body), false);
  const rows =
    (body as { results?: Array<{ customerClientLink?: { status?: string } }> })
      .results ?? [];
  const statuses = rows
    .map((r) => r.customerClientLink?.status)
    .filter((s): s is string => !!s);
  for (const preferred of ["ACTIVE", "PENDING", "REFUSED", "CANCELED", "CANCELLED", "INACTIVE"]) {
    if (statuses.includes(preferred)) return preferred;
  }
  return null;
}

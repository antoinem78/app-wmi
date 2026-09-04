// Merchant Center writes via the Merchant API v1: the supplemental-feed
// overlay mechanism the founder ruled in as a proposal class (2026-08-26,
// feed-layer only, reversible, Norbert-reviewed; built 2026-09-04 on his
// go-ahead). Shapes taken from the API's own discovery documents, and the two
// that bite are stated here so nobody re-learns them:
//
// - A supplemental data source DOES NOTHING until a primary data source's
//   defaultRule takes from it: `referencingPrimaryDataSources` is output-only,
//   so linkage is a PATCH on the primary's defaultRule, made once, prepending
//   the overlay source ahead of `self`. An unlinked overlay write is the
//   feed-layer version of an exclusion that matches nobody: it looks done and
//   changes nothing, so this module links (visibly) rather than hoping.
// - Product identity in v1 is contentLanguage~feedLabel~offerId (no channel
//   prefix), and feed labels are not always country codes (House of Isabella
//   runs labels like EUR_109909508483), so all three parts come from the
//   caller and are never guessed.
//
// The overlay write is one productInputs:insert into our managed API
// supplemental source; the reversal is one productInputs:delete of the same
// input, after which the attribute falls back to the primary feed's value.
// Read-back caveat: Merchant Center composes products ASYNCHRONOUSLY, so the
// merged product can lag the accepted write by minutes; callers report that
// honestly instead of calling a lagging read a failure.
import { entityConfig } from "@/lib/config";

const num = (v: unknown) => Number(v ?? 0) || 0;

async function accessToken(): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET ?? "",
      refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN ?? "",
      grant_type: "refresh_token",
    }),
  });
  const data = (await res.json()) as { access_token?: string; error_description?: string };
  if (!data.access_token) throw new Error(`Merchant token mint failed: ${data.error_description ?? "no access_token"}`);
  return data.access_token;
}

async function mc(method: "GET" | "POST" | "PATCH" | "DELETE", path: string, body?: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(`https://merchantapi.googleapis.com/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = (text ? JSON.parse(text) : {}) as Record<string, unknown>;
  if (!res.ok) {
    const err = (data.error as { message?: string } | undefined)?.message ?? `HTTP ${res.status}`;
    throw new Error(`Merchant API ${method} ${path.split("?")[0]}: ${err}`);
  }
  return data;
}

export interface ProductIdentity {
  merchantId: string;
  offerId: string;
  contentLanguage: string;
  feedLabel: string;
}
const productId = (p: ProductIdentity) => `${p.contentLanguage}~${p.feedLabel}~${p.offerId}`;

export interface MerchantProduct {
  name: string;
  title: string | null;
  price: { amountMicros: number; currencyCode: string } | null;
  /** The product's primary data source resource name (output-only). */
  primaryDataSource: string | null;
}

export async function getMerchantProduct(p: ProductIdentity): Promise<MerchantProduct | { error: string }> {
  try {
    const r = await mc("GET", `products/v1/accounts/${p.merchantId}/products/${encodeURIComponent(productId(p))}`);
    const attrs = (r.productAttributes ?? {}) as { title?: string; price?: { amountMicros?: unknown; currencyCode?: string } };
    return {
      name: String(r.name ?? ""),
      title: attrs.title ?? null,
      price: attrs.price ? { amountMicros: num(attrs.price.amountMicros), currencyCode: String(attrs.price.currencyCode ?? "") } : null,
      primaryDataSource: (r.dataSource as string | undefined) ?? null,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

/** Stable, reused name for this deployment's managed overlay source. */
export function agentOverlaySourceName(): string {
  return `${entityConfig.brandName} agent overlays`;
}

interface DataSourceRow {
  name?: string; displayName?: string;
  supplementalProductDataSource?: Record<string, unknown>;
  primaryProductDataSource?: { defaultRule?: { takeFromDataSources?: { self?: boolean; supplementalDataSourceName?: string }[] } };
}

/** Find or create the managed API supplemental source, then make sure the
 *  product's PRIMARY source takes from it (one visible PATCH, once). Returns
 *  what it did so the approval surface can say so in plain words. */
export async function ensureOverlaySource(
  merchantId: string,
  primaryDataSource: string,
): Promise<{ dataSource: string; created: boolean; linked: boolean; linkPatched: boolean } | { error: string }> {
  try {
    const list = await mc("GET", `datasources/v1/accounts/${merchantId}/dataSources?pageSize=100`);
    const rows = (list.dataSources ?? []) as DataSourceRow[];
    let overlay = rows.find((d) => d.supplementalProductDataSource && d.displayName === agentOverlaySourceName());
    let created = false;
    if (!overlay) {
      overlay = (await mc("POST", `datasources/v1/accounts/${merchantId}/dataSources`, {
        displayName: agentOverlaySourceName(),
        supplementalProductDataSource: {},
      })) as DataSourceRow;
      created = true;
    }
    const overlayName = String(overlay.name);

    const primary = rows.find((d) => d.name === primaryDataSource)
      ?? ((await mc("GET", `datasources/v1/${primaryDataSource.replace(/^\/*/, "")}`)) as DataSourceRow);
    if (!primary?.primaryProductDataSource)
      return { error: `${primaryDataSource} is not a primary product data source; cannot link the overlay.` };
    const takes = primary.primaryProductDataSource.defaultRule?.takeFromDataSources ?? [{ self: true }];
    const linked = takes.some((t) => t.supplementalDataSourceName === overlayName);
    let linkPatched = false;
    if (!linked) {
      // Prepend the overlay ahead of self: later sources in the list win in
      // Merchant Center's default rule, EXCEPT that the rule is ordered lowest
      // to highest priority top-down per the API docs; prepending ahead of
      // self gives the overlay precedence for the attributes it carries.
      const newRule = { takeFromDataSources: [{ supplementalDataSourceName: overlayName }, ...takes.filter((t) => t.supplementalDataSourceName !== overlayName)] };
      await mc("PATCH", `datasources/v1/${primaryDataSource}?updateMask=primaryProductDataSource.defaultRule`, {
        primaryProductDataSource: { ...primary.primaryProductDataSource, defaultRule: newRule },
      });
      linkPatched = true;
    }
    return { dataSource: overlayName, created, linked: linked || linkPatched, linkPatched };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

/** Insert one overlay input carrying exactly the attributes given. */
export async function insertOverlayInput(
  p: ProductIdentity,
  dataSource: string,
  attributes: Record<string, unknown>,
): Promise<{ name: string } | { error: string }> {
  try {
    const r = await mc(
      "POST",
      `products/v1/accounts/${p.merchantId}/productInputs:insert?dataSource=${encodeURIComponent(dataSource)}`,
      {
        offerId: p.offerId,
        contentLanguage: p.contentLanguage,
        feedLabel: p.feedLabel,
        productAttributes: attributes,
      },
    );
    return { name: String(r.name ?? `accounts/${p.merchantId}/productInputs/${productId(p)}`) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

/** Remove the overlay input: the one-action reversal. The attribute falls back
 *  to the primary feed's value on the next composition pass. */
export async function deleteOverlayInput(
  inputName: string,
  dataSource: string,
): Promise<{ ok: true } | { error: string }> {
  try {
    await mc("DELETE", `products/v1/${inputName}?dataSource=${encodeURIComponent(dataSource)}`);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

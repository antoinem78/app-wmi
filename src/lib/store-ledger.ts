// The store-ledger read for the report engine: what the merchant's store
// actually took in a window, from the commerce spine, plus per-order profit
// where a COGS sheet is loaded (POAS reporting leg, tier-two freeze lifted by
// the founder 2026-09-04).
//
// Read-only by construction: SUBSTRATE_DB_URL carries the substrate_readonly
// role. Everything degrades to null rather than erroring a report: no env, no
// mapped client, no orders, or an unreachable database all mean "no ledger",
// which the report engine states rather than hides.
import { Client } from "pg";

export interface StoreLedgerWindow {
  revenue: number;          // net of refunds, major units
  orders: number;
  currency: string;
  source: string;
  /** Sum of (net - COGS) over FULLY costed orders only; null until a COGS
   *  sheet covers something. Never averaged around gaps. */
  profit: number | null;
  /** Orders fully costed / orders, percent. 100 is the only number at which
   *  POAS over the whole window is honest. */
  cogsCoveragePct: number;
  /** Oldest cost-basis date used, so staleness is visible. */
  oldestCostBasis: string | null;
}

export async function getStoreLedgerForMetaAccount(
  accountId: string,
  since: string,
  until: string,
): Promise<StoreLedgerWindow | null> {
  const url = process.env.SUBSTRATE_DB_URL;
  if (!url) return null;
  const act = accountId.startsWith("act_") ? accountId : `act_${accountId}`;
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false }, statement_timeout: 15000 });
  try {
    await c.connect();
    const cl = await c.query(
      "select id, slug from clients where config->'commerce'->>'meta_account_id' = $1 and (config->'commerce'->>'enabled')::boolean is true",
      [act],
    );
    if (!cl.rows.length) return null;
    const clientId = cl.rows[0].id as string;
    const r = await c.query(
      `select count(*)::int as orders,
              coalesce(sum(net_value), 0)::numeric as revenue,
              max(currency) as currency,
              count(*) filter (where items_missing_cost = 0)::int as costed,
              coalesce(sum(net_value - cogs) filter (where items_missing_cost = 0), 0)::numeric as profit,
              min(oldest_cost_basis) filter (where items_missing_cost = 0) as oldest_basis
       from commerce.order_profit
       where client_id = $1 and placed_at >= $2::date and placed_at < ($3::date + interval '1 day')`,
      [clientId, since, until],
    );
    const row = r.rows[0];
    const orders = Number(row.orders);
    if (!orders) return { revenue: 0, orders: 0, currency: String(row.currency ?? ""), source: `shopify orders (${cl.rows[0].slug})`, profit: null, cogsCoveragePct: 0, oldestCostBasis: null };
    const costed = Number(row.costed);
    return {
      revenue: Number(row.revenue),
      orders,
      currency: String(row.currency ?? ""),
      source: `shopify orders (${cl.rows[0].slug})`,
      profit: costed > 0 ? Number(row.profit) : null,
      cogsCoveragePct: Math.round((costed / orders) * 1000) / 10,
      oldestCostBasis: row.oldest_basis ? String(row.oldest_basis).slice(0, 10) : null,
    };
  } catch (e) {
    console.error("store-ledger read failed:", e instanceof Error ? e.message : e);
    return null;
  } finally {
    await c.end().catch(() => {});
  }
}

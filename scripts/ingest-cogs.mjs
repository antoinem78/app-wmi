#!/usr/bin/env node
// Load a client's COGS sheet into commerce.sku_costs (the one client input the
// POAS reporting leg needs; freeze lifted by the founder 2026-09-04).
//
// Usage:
//   node scripts/ingest-cogs.mjs <client-slug> <sheet.csv> <cost-basis-date> [source-note]
//
// CSV columns (header row required, extra columns ignored): sku, cost, currency
// cost is in MAJOR units (same basis as order values). Rows with a blank sku or
// a non-positive cost are refused, never skipped silently: a partial sheet
// loaded quietly is how a wrong POAS gets believed.
//
// Auth: SUPABASE_DB_URL from ~/.config/singularweb/substrate.env (admin role;
// sku_costs is deliberately not writable by anything else).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { homedir } from "node:os";
import pg from "pg";

const [slug, csvPath, basisDate, ...sourceParts] = process.argv.slice(2);
if (!slug || !csvPath || !/^\d{4}-\d{2}-\d{2}$/.test(basisDate ?? "")) {
  console.error("Usage: node scripts/ingest-cogs.mjs <client-slug> <sheet.csv> <YYYY-MM-DD cost basis> [source note]");
  process.exit(2);
}
const source = sourceParts.join(" ") || `COGS sheet ingested ${new Date().toISOString().slice(0, 10)}`;

const env = Object.fromEntries(
  readFileSync(resolve(homedir(), ".config/singularweb/substrate.env"), "utf8")
    .split("\n").filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).trim()]; }),
);

const lines = readFileSync(resolve(csvPath), "utf8").split(/\r?\n/).filter((l) => l.trim());
const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
const col = (name) => header.indexOf(name);
if (col("sku") < 0 || col("cost") < 0 || col("currency") < 0) {
  console.error(`Header must carry sku, cost and currency; got: ${header.join(", ")}`);
  process.exit(2);
}
const rows = [];
for (const [i, line] of lines.slice(1).entries()) {
  const cells = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
  const sku = cells[col("sku")];
  const cost = Number(cells[col("cost")]);
  const currency = (cells[col("currency")] ?? "").toUpperCase();
  if (!sku) { console.error(`Row ${i + 2}: blank sku. Fix the sheet; nothing was loaded.`); process.exit(1); }
  if (!Number.isFinite(cost) || cost < 0) { console.error(`Row ${i + 2} (${sku}): cost "${cells[col("cost")]}" is not a non-negative number. Nothing was loaded.`); process.exit(1); }
  if (!/^[A-Z]{3}$/.test(currency)) { console.error(`Row ${i + 2} (${sku}): currency "${currency}" is not a 3-letter code. Nothing was loaded.`); process.exit(1); }
  rows.push({ sku, cost, currency });
}
if (!rows.length) { console.error("The sheet carries no data rows."); process.exit(1); }
const dupes = rows.map((r) => r.sku).filter((s, i, a) => a.indexOf(s) !== i);
if (dupes.length) { console.error(`Duplicate SKUs in the sheet: ${[...new Set(dupes)].join(", ")}. Nothing was loaded.`); process.exit(1); }

const client = new pg.Client({ connectionString: env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
const { rows: cl } = await client.query("select id from clients where slug = $1", [slug]);
if (!cl.length) { console.error(`No substrate client with slug "${slug}".`); process.exit(1); }
const clientId = cl[0].id;

await client.query("begin");
let upserted = 0;
for (const r of rows) {
  await client.query(
    `insert into commerce.sku_costs (client_id, sku, cost, currency, cost_basis_date, source)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (client_id, sku) do update set cost = excluded.cost, currency = excluded.currency,
       cost_basis_date = excluded.cost_basis_date, source = excluded.source, updated_at = now()`,
    [clientId, r.sku, r.cost, r.currency, basisDate, source],
  );
  upserted++;
}
await client.query("commit");

// Coverage read-back: the number that says whether POAS is real yet.
const cov = await client.query(
  `select count(*) as orders, count(*) filter (where items_missing_cost = 0) as costed
   from commerce.order_profit where client_id = $1`, [clientId]);
console.log(`${upserted} SKU costs loaded for ${slug} (basis ${basisDate}).`);
console.log(`Order coverage now: ${cov.rows[0].costed} of ${cov.rows[0].orders} orders fully costed.`);
const missing = await client.query(
  `select distinct i.sku from (
     select l.client_id, jsonb_array_elements(l.payload->'line_items')->>'sku' as sku
     from (select distinct on (client_id, order_ref) client_id, payload from commerce.events
           where event_type in ('order_created','order_updated') order by client_id, order_ref, received_at desc) l
     where l.client_id = $1) i
   left join commerce.sku_costs sc on sc.client_id = $1 and sc.sku = i.sku
   where sc.sku is null and i.sku is not null limit 25`, [clientId]);
if (missing.rows.length) console.log(`SKUs seen in orders but NOT in the sheet (first 25): ${missing.rows.map((r) => r.sku).join(", ")}`);
await client.end();

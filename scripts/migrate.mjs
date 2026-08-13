#!/usr/bin/env node
// Migration runner with a target guard.
//
// WHY THIS EXISTS. On 2026-07-30 a migration intended for the portal was run
// against the substrate. Three databases are now in play across two parallel
// Code sessions, and the only defence was convention. This is the mechanical
// version, and it is deliberately the cheapest one that would actually have
// caught that mistake.
//
// The guard is three-way, and the third leg is the one that matters:
//
//   1. The FILE declares its target      (-- TARGET: PORTAL | SUBSTRATE)
//   2. The OPERATOR names a database     (--db portal | fzco | substrate)
//   3. The LIVE CONNECTION is fingerprinted and must agree with both
//
// Legs 1 and 2 are both just labels a human wrote, and on 30 July the human
// label was the thing that was wrong. Leg 3 asks the database what it actually
// is, so a mislabelled env var, a pasted-in-the-wrong-shell connection string
// or a copied filename cannot get past it.
//
// The fingerprint had to be chosen carefully: BOTH families have a `clients`
// table, so the obvious check would have passed on 30 July and taught us
// nothing. The discriminators are onboarding_state (portal only) and
// kb_documents (substrate only), verified against both live databases.
//
// Usage:
//   node scripts/migrate.mjs supabase/migrations/0024_upsells.sql --db fzco
//   node scripts/migrate.mjs docs/substrate-migrations/0006_x.sql --db substrate --yes
//
// Without --yes it prints what it resolved and stops. That is the intended
// default: look at it, then re-run with --yes.
import { readFileSync, appendFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import pg from "pg";

const FAMILIES = { PORTAL: "PORTAL", SUBSTRATE: "SUBSTRATE" };

// --db name -> where its connection string lives, and which family it belongs to.
const TARGETS = {
  substrate: {
    family: FAMILIES.SUBSTRATE,
    envFile: join(homedir(), ".config/singularweb/substrate.env"),
    envVar: "SUPABASE_DB_URL",
    label: "substrate (n8n / agents / KB)",
  },
  fzco: {
    family: FAMILIES.PORTAL,
    envFile: join(homedir(), ".config/singularweb/fzco.env"),
    envVar: "FZCO_DB_URL",
    label: "FZCO portal (app.webmarketinginternational.com)",
  },
  portal: {
    family: FAMILIES.PORTAL,
    // No direct Postgres URL for the wmiltd portal exists on this machine; only
    // the REST endpoint and service key, which cannot run DDL. Left declared so
    // the runner works the day someone adds PORTAL_DB_URL, and refuses clearly
    // until then rather than silently doing nothing.
    envFile: join(process.cwd(), ".env.local"),
    envVar: "PORTAL_DB_URL",
    label: "wmiltd portal (app.wmiltd.com)",
  },
};

// Tables that exist in exactly one family. `clients` is deliberately NOT here:
// it exists in both, and trusting it is the mistake this script prevents.
const FINGERPRINT = {
  [FAMILIES.PORTAL]: "onboarding_state",
  [FAMILIES.SUBSTRATE]: "kb_documents",
};

function die(msg) {
  console.error(`\n  REFUSED: ${msg}\n`);
  process.exit(1);
}

function readEnvVar(file, name) {
  if (!existsSync(file)) return null;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(new RegExp(`^${name}=(.*)$`));
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  return null;
}

/** The target a migration file declares about itself. */
function declaredTarget(sql, path) {
  const head = sql.split("\n").slice(0, 25).join("\n");
  const m = head.match(/--\s*TARGET:\s*(PORTAL|SUBSTRATE)\b/i);
  if (!m) {
    die(
      `${path} does not declare a target.\n` +
        `  Add one of these as the first line:\n` +
        `    -- TARGET: PORTAL      (app.wmiltd.com and app.webmarketinginternational.com)\n` +
        `    -- TARGET: SUBSTRATE   (n8n, agents, knowledge base)`,
    );
  }
  return m[1].toUpperCase();
}

/** Ask the database what it actually is, rather than believing any label. */
async function fingerprintFamily(client) {
  const { rows } = await client.query(
    "select table_name from information_schema.tables where table_schema = 'public' and table_name = any($1)",
    [Object.values(FINGERPRINT)],
  );
  const found = new Set(rows.map((r) => r.table_name));
  const matches = Object.entries(FINGERPRINT)
    .filter(([, table]) => found.has(table))
    .map(([family]) => family);

  if (matches.length === 1) return matches[0];
  if (matches.length === 0) {
    die(
      "the connected database matches no known family.\n" +
        `  Expected one of: ${Object.entries(FINGERPRINT)
          .map(([f, t]) => `${f} (has ${t})`)
          .join(", ")}\n` +
        "  This is either an empty database or one this runner does not know about.",
    );
  }
  die(
    `the connected database matches BOTH families (${matches.join(" and ")}).\n` +
      "  The fingerprint is no longer discriminating and this script needs updating\n" +
      "  before it can be trusted. Do not run migrations by hand in the meantime.",
  );
}

async function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("--"));
  const dbIdx = args.indexOf("--db");
  const dbName = dbIdx === -1 ? null : args[dbIdx + 1];
  const confirmed = args.includes("--yes");

  if (!file || !dbName) {
    console.error(
      "\n  usage: node scripts/migrate.mjs <file.sql> --db <portal|fzco|substrate> [--yes]\n",
    );
    process.exit(2);
  }
  if (!TARGETS[dbName]) {
    die(`unknown database "${dbName}". Choose one of: ${Object.keys(TARGETS).join(", ")}`);
  }
  if (!existsSync(file)) die(`no such file: ${file}`);

  const target = TARGETS[dbName];
  const sql = readFileSync(file, "utf8");
  const declared = declaredTarget(sql, file);

  // Leg 1 vs leg 2: does the file agree with the database the operator named?
  if (declared !== target.family) {
    die(
      `the file and the chosen database disagree.\n` +
        `    ${file}\n` +
        `      declares:  -- TARGET: ${declared}\n` +
        `      you chose: --db ${dbName}, which is ${target.family}\n\n` +
        `  This is the 2026-07-30 mistake. Nothing has been executed.`,
    );
  }

  const url = readEnvVar(target.envFile, target.envVar);
  if (!url) {
    die(
      `${target.envVar} is not set in ${target.envFile}.\n` +
        (dbName === "portal"
          ? "  There is no direct Postgres URL for the wmiltd portal on this machine.\n" +
            "  Run this migration in the Supabase SQL editor for that project, or add\n" +
            "  PORTAL_DB_URL to .env.local and re-run."
          : "  Check the credential file."),
    );
  }

  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // Leg 3: ask the database itself. This is the leg a wrong label cannot pass.
  const actual = await fingerprintFamily(client);
  const host = new URL(url.replace(/^postgres(ql)?:\/\//, "https://")).hostname;

  if (actual !== declared) {
    await client.end();
    die(
      `the connected database is not what the file expects.\n` +
        `      file declares: ${declared}\n` +
        `      host:          ${host}\n` +
        `      actually is:   ${actual}  (fingerprinted from its own tables)\n\n` +
        `  The connection string in ${target.envVar} points somewhere unexpected.\n` +
        `  Nothing has been executed.`,
    );
  }

  console.log(`\n  file:     ${file}`);
  console.log(`  declares: ${declared}`);
  console.log(`  database: ${target.label}`);
  console.log(`  host:     ${host}`);
  console.log(`  verified: fingerprint says ${actual}, all three agree`);

  if (!confirmed) {
    console.log(`\n  Nothing executed. Re-run with --yes to apply.\n`);
    await client.end();
    return;
  }

  // One transaction: a migration that fails halfway leaves nothing behind.
  try {
    await client.query("begin");
    await client.query(sql);
    await client.query("commit");
  } catch (e) {
    await client.query("rollback").catch(() => {});
    await client.end();
    die(`migration failed and was rolled back.\n  ${e.message}`);
  }
  await client.end();

  const stamp = new Date().toISOString();
  appendFileSync(
    join(process.cwd(), "docs/migration-log.txt"),
    `${stamp}  ${declared}  ${dbName}  ${host}  ${file}\n`,
  );
  console.log(`\n  Applied. Logged to docs/migration-log.txt\n`);
}

main().catch((e) => {
  console.error(`\n  ERROR: ${e.message}\n`);
  process.exit(1);
});

// Smoke test / operator tool: run the Meta audit finding detectors against a
// live account and print what they raise, without generating a document.
//
//   node scripts/meta-audit-findings.mjs <account-id> [days]
//
// Compiles the two TypeScript modules on the fly with the project's tsc so the
// detectors under test are exactly the ones the audit ships.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";

const root = path.resolve(import.meta.dirname, "..");
const acct = process.argv[2];
const days = Number(process.argv[3] || 30);
if (!acct) {
  console.error("usage: node scripts/meta-audit-findings.mjs <account-id> [days]");
  process.exit(1);
}

// .env.local -> process.env (only what the Graph client needs)
for (const line of fs.readFileSync(path.join(root, ".env.local"), "utf8").split(/\r?\n/)) {
  if (!line || line.startsWith("#") || !line.includes("=")) continue;
  const i = line.indexOf("=");
  const k = line.slice(0, i).trim();
  if (!process.env[k]) process.env[k] = line.slice(i + 1).trim();
}

const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "meta-findings-"));
const tsconfig = path.join(outDir, "tsconfig.json");
fs.writeFileSync(tsconfig, JSON.stringify({
  compilerOptions: {
    outDir, module: "esnext", target: "es2022", moduleResolution: "bundler",
    skipLibCheck: true, baseUrl: root, paths: { "@/*": ["src/*"] }, rootDir: path.join(root, "src"),
    types: ["node"], typeRoots: [path.join(root, "node_modules/@types")], lib: ["es2023", "dom"],
  },
  files: [
    path.join(root, "src/lib/integrations/meta/index.ts"),
    path.join(root, "src/lib/integrations/meta/audit-deep.ts"),
    path.join(root, "src/lib/audit/meta-findings.ts"),
  ],
}));
execFileSync(
  process.execPath,
  [path.join(root, "node_modules", "typescript", "bin", "tsc"), "-p", tsconfig],
  { cwd: root, stdio: ["ignore", "inherit", "inherit"] },
);
// tsc keeps the "@/..." specifiers; rewrite them to relative paths and .js.
for (const f of fs.readdirSync(outDir, { recursive: true })) {
  const p = path.join(outDir, String(f));
  if (!p.endsWith(".js")) continue;
  const depth = path.relative(outDir, path.dirname(p)).split(path.sep).filter(Boolean).length;
  const up = depth ? "../".repeat(depth) : "./";
  fs.writeFileSync(p, fs.readFileSync(p, "utf8").replace(/from "@\/([^"]+)"/g, (_m, s) => {
    // tsc emits a bare "@/lib/x" even when x is a directory with an index.
    const isDir = fs.existsSync(path.join(outDir, s)) && fs.statSync(path.join(outDir, s)).isDirectory();
    return `from "${up}${s}${isDir ? "/index" : ""}.js"`;
  }));
}

const { getDeepAuditData } = await import(pathToFileURL(path.join(outDir, "lib/integrations/meta/audit-deep.js")));
const { detectFindings, detectStrengths, totalAtStake } = await import(pathToFileURL(path.join(outDir, "lib/audit/meta-findings.js")));

console.log(`reading account ${acct}, ${days} day window...`);
const deep = await getDeepAuditData(acct, days);
const findings = detectFindings(deep);
const strengths = detectStrengths(deep);

const c = deep.currency;
console.log(`\naccount ${deep.accountId}  ${c}  campaigns ${deep.counts.campaignsActive}/${deep.counts.campaigns}  ad sets ${deep.counts.adSetsActive}/${deep.counts.adSets}  ads ${deep.counts.adsActive}/${deep.counts.ads}`);
if (deep.current) {
  const t = deep.current;
  console.log(`spend ${Math.round(t.spend)} ${c} | ROAS ${t.roas.toFixed(2)} | ${t.purchases} purchases | CPA ${Math.round(t.cpa)} | freq ${t.frequency.toFixed(2)}`);
}
for (const k of ["monthly", "byPlacement", "byAge", "byCountry", "byCampaign", "adSets", "ads", "audiences", "creative", "pixels"]) {
  const v = deep[k];
  if (v && typeof v === "object" && "error" in v) console.log(`  !! ${k}: ${v.error}`);
}

console.log(`\n===== ${findings.length} FINDINGS =====`);
for (const [i, f] of findings.entries()) {
  console.log(`\n${i + 1}. [${f.severity.toUpperCase()}] ${f.title}   (${f.id})`);
  console.log(`   ${f.headline}`);
  for (const e of f.evidence) console.log(`     - ${e}`);
  if (f.moneyAtStake) console.log(`   money at stake: ${Math.round(f.moneyAtStake).toLocaleString("en-GB")} ${c} / 30 days`);
}
console.log(`\ntotal measured waste: ${Math.round(totalAtStake(findings)).toLocaleString("en-GB")} ${c} per 30 days`);
console.log(`\n===== ${strengths.length} CHECKED AND SOUND =====`);
for (const s of strengths) console.log(`  + ${s}`);

fs.rmSync(outDir, { recursive: true, force: true });

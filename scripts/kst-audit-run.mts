// One-off: run the read-only Google Ads audit for KST via the existing engine.
import { readFileSync, writeFileSync } from "node:fs";
// load .env.local into process.env (standalone script; Next does this automatically)
for (const line of readFileSync(".env.local","utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g,"");
}
const { generateAudit } = await import("../src/lib/audit/generate.ts");
let logo: Buffer | undefined;
try { logo = readFileSync("src/lib/audit/assets/wmi-logo.png"); } catch {}
console.log("running audit for KST Accountants (4226686978)...");
const { buffer } = await generateAudit("4226686978", "KST Accountants Limited", { logo });
const out = "/Users/singularwebmacmini1/Downloads/KST - Google Ads Audit.docx";
writeFileSync(out, buffer);
console.log("WROTE", out, buffer.length, "bytes");

#!/usr/bin/env node
// Bernard relay: talk to the deployed Bernard from outside the portal.
// Same brain, same conversation thread — a message sent here appears in the
// portal chat at /bernard, and portal turns are the context for replies here.
//
// Usage:
//   node scripts/bernard-relay.mjs "message for Bernard"
//   node scripts/bernard-relay.mjs --history [N]     # print last N turns (default 12), send nothing
//
// Auth: BERNARD_RELAY_KEY from the environment or .env.local (never committed).
// Target: BERNARD_RELAY_URL or the production portal.

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function envLocal(name) {
  try {
    const line = readFileSync(resolve(repoRoot, ".env.local"), "utf8")
      .split("\n")
      .find((l) => l.startsWith(`${name}=`));
    return line ? line.slice(name.length + 1).trim().replace(/^"|"$/g, "") : undefined;
  } catch {
    return undefined;
  }
}

const KEY = process.env.BERNARD_RELAY_KEY ?? envLocal("BERNARD_RELAY_KEY");
const BASE = process.env.BERNARD_RELAY_URL ?? envLocal("BERNARD_RELAY_URL") ?? "https://app.wmiltd.com";
const ENDPOINT = `${BASE}/api/bernard/chat`;

if (!KEY) {
  console.error("BERNARD_RELAY_KEY is not set (env or .env.local). Cannot reach Bernard.");
  process.exit(2);
}

const headers = { "x-bernard-relay-key": KEY };

async function history() {
  const res = await fetch(ENDPOINT, { headers });
  if (!res.ok) throw new Error(`GET ${ENDPOINT} -> ${res.status}`);
  const { messages } = await res.json();
  return Array.isArray(messages) ? messages : [];
}

async function send(text) {
  const prior = await history();
  const messages = [...prior, { role: "user", content: text }];
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`POST ${ENDPOINT} -> ${res.status} ${body.slice(0, 300)}`);
  }

  // NDJSON event stream: status (tool running), delta (answer text), reset
  // (drop tool-turn preamble), artifact (download link), done, error.
  let answer = "";
  const artifacts = [];
  let buffered = "";
  const decoder = new TextDecoder();
  for await (const chunk of res.body) {
    buffered += decoder.decode(chunk, { stream: true });
    let nl;
    while ((nl = buffered.indexOf("\n")) >= 0) {
      const line = buffered.slice(0, nl).trim();
      buffered = buffered.slice(nl + 1);
      if (!line) continue;
      let ev;
      try {
        ev = JSON.parse(line);
      } catch {
        continue;
      }
      if (ev.type === "delta") answer += ev.text ?? "";
      else if (ev.type === "reset") answer = "";
      else if (ev.type === "status") console.error(`[bernard is working: ${ev.text}]`);
      else if (ev.type === "artifact") artifacts.push({ href: ev.text, label: ev.label });
      else if (ev.type === "error") throw new Error(`Bernard error: ${ev.text}`);
    }
  }
  return { answer: answer.trim(), artifacts };
}

const args = process.argv.slice(2);

if (args[0] === "--history") {
  const n = Number(args[1]) || 12;
  const turns = await history();
  for (const t of turns.slice(-n)) {
    const who = t.role === "user" ? "FOUNDER" : "BERNARD";
    console.log(`--- ${who} ---\n${t.content}\n`);
  }
  process.exit(0);
}

const text = args.join(" ").trim();
if (!text) {
  console.error('Usage: node scripts/bernard-relay.mjs "message" | --history [N]');
  process.exit(2);
}

const { answer, artifacts } = await send(text);
console.log(answer);
for (const a of artifacts) {
  console.log(`\n[artifact${a.label ? `: ${a.label}` : ""}] ${BASE}${a.href.startsWith("/") ? "" : "/"}${a.href}`);
}

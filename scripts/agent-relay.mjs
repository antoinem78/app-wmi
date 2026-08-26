#!/usr/bin/env node
// Agent relay: talk to a deployed portal agent (Bernard or Oscar) from outside
// the portal. Same brain, same conversation thread as the portal chat, so both
// surfaces are one history.
//
// Usage:
//   node scripts/agent-relay.mjs bernard "message"
//   node scripts/agent-relay.mjs oscar "message"
//   node scripts/agent-relay.mjs oscar --scope <client-uuid> "message"   # per-client thread
//   node scripts/agent-relay.mjs <agent> --file spec.txt                 # message from a file (USE THIS for anything long)
//   node scripts/agent-relay.mjs <agent> --attach audit.docx "read this" # attach a file to the turn, repeatable
//   node scripts/agent-relay.mjs <agent> --history [N]                   # print last N turns, send nothing
//
// --file and --attach are different things and easy to confuse. --file supplies
// the MESSAGE TEXT (the file is read here and its contents become what you say).
// --attach hands the FILE ITSELF to the agent, the same as the paperclip in the
// portal chat: PDFs are read as PDFs, Word documents have their text extracted
// server-side. Use --attach for anything you want the agent to read as a
// document, and --file only to avoid the shell mangling a long message.
//
// The portal owns the attachment rules (how many files, how big, which types),
// so this script does not restate them; a rejected upload comes back as the
// portal's own error message.
//
// Auth: <AGENT>_RELAY_KEY from the environment or .env.local (never committed).
// Target: BERNARD_RELAY_URL / OSCAR_RELAY_URL / AGENT_RELAY_URL override, else production.

import { readFileSync } from "node:fs";
import { resolve, dirname, basename, extname } from "node:path";
import { fileURLToPath } from "node:url";

const AGENTS = {
  bernard: { path: "/api/bernard/chat", keyEnv: "BERNARD_RELAY_KEY", header: "x-bernard-relay-key", scoped: false, name: "BERNARD" },
  oscar: { path: "/api/agent/chat", keyEnv: "OSCAR_RELAY_KEY", header: "x-oscar-relay-key", scoped: true, name: "OSCAR" },
  norbert: { path: "/api/norbert/chat", keyEnv: "NORBERT_RELAY_KEY", header: "x-norbert-relay-key", scoped: false, name: "NORBERT" },
};

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

const args = process.argv.slice(2);
const agentId = (args.shift() ?? "").toLowerCase();
const agent = AGENTS[agentId];
if (!agent) {
  console.error(`Usage: node scripts/agent-relay.mjs <${Object.keys(AGENTS).join("|")}> [--scope <client-uuid>] [--attach <path>]... "message" | --file <path> | --history [N]`);
  process.exit(2);
}

let scope = null;
const scopeIdx = args.indexOf("--scope");
if (scopeIdx >= 0) {
  scope = args[scopeIdx + 1];
  args.splice(scopeIdx, 2);
  if (!agent.scoped) {
    console.error(`${agentId} has a single thread; --scope is not supported.`);
    process.exit(2);
  }
  if (!/^[0-9a-f-]{36}$/i.test(scope ?? "")) {
    console.error("--scope must be a client uuid.");
    process.exit(2);
  }
}

// --attach is repeatable and consumed before the message text is assembled, so
// the remaining argv is the message and nothing else.
const MIME = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".md": "text/markdown",
  ".markdown": "text/markdown",
  ".txt": "text/plain",
  ".csv": "text/csv",
};
const attachments = [];
for (;;) {
  const i = args.indexOf("--attach");
  if (i < 0) break;
  const path = args[i + 1];
  if (!path || path.startsWith("--")) {
    console.error("--attach needs a file path.");
    process.exit(2);
  }
  args.splice(i, 2);
  const abs = resolve(path);
  let bytes;
  try {
    bytes = readFileSync(abs);
  } catch (e) {
    console.error(`Cannot read ${path}: ${e.message}`);
    process.exit(2);
  }
  // The portal decides how to read a file from its extension, so send the plain
  // basename rather than the path the caller happened to type.
  const name = basename(abs);
  attachments.push(
    new File([bytes], name, { type: MIME[extname(name).toLowerCase()] ?? "application/octet-stream" }),
  );
}

const KEY = process.env[agent.keyEnv] ?? envLocal(agent.keyEnv);
const BASE =
  process.env[`${agentId.toUpperCase()}_RELAY_URL`] ??
  process.env.AGENT_RELAY_URL ??
  envLocal(`${agentId.toUpperCase()}_RELAY_URL`) ??
  "https://app.wmiltd.com";
const ENDPOINT = `${BASE}${agent.path}`;

if (!KEY) {
  console.error(`${agent.keyEnv} is not set (env or .env.local). Cannot reach ${agentId}.`);
  process.exit(2);
}

const headers = { [agent.header]: KEY };
const scopeQuery = scope ? `?scope=${encodeURIComponent(scope)}` : "";

async function history() {
  const res = await fetch(`${ENDPOINT}${scopeQuery}`, { headers });
  if (!res.ok) throw new Error(`GET ${ENDPOINT} -> ${res.status}`);
  const { messages } = await res.json();
  return Array.isArray(messages) ? messages : [];
}

async function send(text) {
  const prior = await history();
  const messages = [...prior, { role: "user", content: text }];
  const body = scope ? { messages, scope } : { messages };
  // With attachments the history rides as a JSON form field and the files as
  // parts, matching the portal chat. Let fetch set Content-Type: it has to carry
  // the multipart boundary, so setting it by hand breaks the parse server-side.
  let init;
  if (attachments.length) {
    const form = new FormData();
    form.set("messages", JSON.stringify(body));
    if (scope) form.set("scope", scope);
    for (const f of attachments) form.append("files", f, f.name);
    init = { method: "POST", headers, body: form };
  } else {
    init = {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    };
  }
  const res = await fetch(ENDPOINT, init);
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`POST ${ENDPOINT} -> ${res.status} ${errBody.slice(0, 300)}`);
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
      else if (ev.type === "status") console.error(`[${agentId} is working: ${ev.text}]`);
      else if (ev.type === "artifact") artifacts.push({ href: ev.text, label: ev.label });
      else if (ev.type === "error") throw new Error(`${agent.name} error: ${ev.text}`);
    }
  }
  return { answer: answer.trim(), artifacts };
}

if (args[0] === "--history") {
  const n = Number(args[1]) || 12;
  const turns = await history();
  for (const t of turns.slice(-n)) {
    const who = t.role === "user" ? "FOUNDER" : agent.name;
    console.log(`--- ${who} ---\n${t.content}\n`);
  }
  process.exit(0);
}

// --file wins over argv. Long messages passed as shell arguments get mangled
// (PowerShell in particular re-serialises native command args and mauls quotes
// and newlines), which silently truncated a spec on its way to Bernard and cost
// a round trip to notice. Anything longer than a sentence should go via a file.
let text;
const fileIdx = args.indexOf("--file");
if (fileIdx >= 0) {
  const path = args[fileIdx + 1];
  if (!path) {
    console.error("--file needs a path to a UTF-8 text file containing the message.");
    process.exit(2);
  }
  try {
    text = readFileSync(resolve(path), "utf8").trim();
  } catch (e) {
    console.error(`Cannot read ${path}: ${e.message}`);
    process.exit(2);
  }
} else {
  text = args.join(" ").trim();
}
// An attachment on its own is a valid turn, same as the portal composer: supply
// the instruction the paperclip path uses so the agent is not handed a file with
// an empty message.
if (!text && attachments.length) {
  text =
    attachments.length === 1
      ? "Read this and tell me what you make of it."
      : "Read these and tell me what you make of them.";
}
if (!text) {
  console.error(`Usage: node scripts/agent-relay.mjs ${agentId} [--scope <client-uuid>] [--attach <path>]... "message" | --file <path> | --history [N]`);
  process.exit(2);
}

const { answer, artifacts } = await send(text);
console.log(answer);
for (const a of artifacts) {
  console.log(`\n[artifact${a.label ? `: ${a.label}` : ""}] ${BASE}${a.href.startsWith("/") ? "" : "/"}${a.href}`);
}

// Glue-level smoke execution for BERNARD_optimise and BERNARD_optimise_execute.
//
// The unit tests (optimise-gates, verify-exclusion) cover the pure functions
// extracted from the workflows. Twice a bug sat one line OUTSIDE them, in the
// n8n glue: `got is not defined` in Verify exclusion on 26 August crashed
// every execute run after the Meta write had landed. This harness runs the
// workflows' Code, If and Switch nodes for real, in dependency order, with
// n8n's `$input` / `$('Node')` / `$json` surface emulated, against captured
// outputs of the external nodes (webhook, Postgres, Meta, Anthropic). Every
// expression parameter on the external nodes (`={{ }}` urls, bodies, and the
// `{{ }}` SQL templates) is resolved too, so a template bug shows up as a
// failed scenario, not as an n8n error at 18:32 on a Tuesday.
//
// Fixtures: tests/fixtures/optimise-glue.json, external-node outputs of six
// real executions (paging stripped: Graph echoes the token in paging.next).
//
//   node tests/optimise-glue.smoke.js            fixture mode, no network
//   node tests/optimise-glue.smoke.js --db       Postgres nodes run their REAL resolved SQL
//                                                against the substrate inside BEGIN..ROLLBACK
//                                                (SUPABASE_DB_URL from the env or substrate.env)
//   node tests/optimise-glue.smoke.js --deployed also diff the generated nodes against what
//                                                n8n holds (N8N_API_KEY from substrate.env)
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const ARGS = new Set(process.argv.slice(2));
const DB_MODE = ARGS.has("--db");
const DEPLOYED = ARGS.has("--deployed");

// ---------------------------------------------------------------- workflows
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), "optimise-glue-"));
execFileSync("python3", [path.join(ROOT, "scripts/build-optimise-workflows.py"), OUT], { stdio: "pipe" });
const WF1 = JSON.parse(fs.readFileSync(path.join(OUT, "wf_optimise.json"), "utf8"));
const WF2 = JSON.parse(fs.readFileSync(path.join(OUT, "wf_execute.json"), "utf8"));
const FX = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures/optimise-glue.json"), "utf8")).executions;

function substrateEnv(key) {
  if (process.env[key]) return process.env[key];
  try {
    const txt = fs.readFileSync(path.join(os.homedir(), ".config/singularweb/substrate.env"), "utf8");
    const m = txt.match(new RegExp(`^${key}=(.*)$`, "m"));
    return m ? m[1].replace(/^"|"$/g, "") : undefined;
  } catch { return undefined; }
}

// ------------------------------------------------------- n8n emulation layer
function evalExpr(expr, ctx) {
  return new Function("$json", "$", "$input", "$now", "$env", `return (${expr});`)(ctx.$json, ctx.$, ctx.$input, new Date(), {});
}
// n8n resolves `={{ }}` parameters; the Postgres node also resolves bare
// `{{ }}` in its query (observed live: Load client returns the row). A single
// whole-string expression keeps its type (a boolean for the If node); mixed
// text is stringified.
function resolve(str, ctx, { always = false } = {}) {
  if (typeof str !== "string") return str;
  const isExpr = str.startsWith("=");
  if (!isExpr && !always) return str;
  const body = isExpr ? str.slice(1) : str;
  const t = body.trim();
  const opens = (body.match(/\{\{/g) || []).length;
  if (opens === 1 && t.startsWith("{{") && t.endsWith("}}")) return evalExpr(t.slice(2, -2), ctx);
  return body.replace(/\{\{([\s\S]*?)\}\}/g, (_, e) => {
    const v = evalExpr(e, ctx);
    return v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
  });
}
function makeDollar(executed) {
  return (name) => ({
    get isExecuted() { return executed.has(name); },
    first() {
      if (!executed.has(name)) throw new Error(`Referenced node "${name}" is unexecuted`);
      return { json: executed.get(name)[0] };
    },
    all() {
      if (!executed.has(name)) throw new Error(`Referenced node "${name}" is unexecuted`);
      return executed.get(name).map((json) => ({ json }));
    },
  });
}
function runCode(nodeName, js, ctx) {
  let out;
  try {
    out = new Function("$input", "$", "$json", "$now", js)(ctx.$input, ctx.$, ctx.$json, new Date());
  } catch (e) {
    throw new Error(`[${nodeName}] ${e.message}`);
  }
  assert.ok(Array.isArray(out), `[${nodeName}] Code node must return an array`);
  for (const it of out) assert.ok(it && typeof it === "object" && "json" in it, `[${nodeName}] item without json`);
  return out.map((i) => i.json);
}
// A resolved SQL or URL carrying these literals is a template bug.
function checkResolved(nodeName, kind, text) {
  const bad = String(text).match(/\bundefined\b|\[object Object\]|\bNaN\b/);
  assert.ok(!bad, `[${nodeName}] resolved ${kind} carries "${bad && bad[0]}": ${String(text).slice(0, 300)}`);
}

async function runWorkflow(wf, ext) {
  const nodes = Object.fromEntries(wf.nodes.map((n) => [n.name, n]));
  const executed = new Map();
  const trail = [];
  const sqlByNode = {};
  const httpByNode = {};
  let response = null;
  let name = "Webhook";
  let incoming = [];
  while (name) {
    const node = nodes[name];
    assert.ok(node, `connection points at unknown node "${name}"`);
    const ctx = {
      $json: incoming[0],
      $input: { first: () => ({ json: incoming[0] }), all: () => incoming.map((json) => ({ json })) },
      $: makeDollar(executed),
    };
    let items;
    let outIndex = 0;
    switch (node.type) {
      case "n8n-nodes-base.webhook":
        items = ext.webhook();
        break;
      case "n8n-nodes-base.code":
        try {
          items = runCode(name, node.parameters.jsCode, ctx);
        } catch (e) {
          // n8n stops the execution here; hand the partial state to the scenario
          // so it can assert what did NOT run after the abort.
          e.executed = executed;
          e.trail = trail;
          throw e;
        }
        break;
      case "n8n-nodes-base.if": {
        const c = node.parameters.conditions.conditions[0];
        const v = resolve(c.leftValue, ctx);
        assert.equal(c.operator.type, "boolean");
        outIndex = v === true || v === "true" ? 0 : 1;
        items = incoming;
        break;
      }
      case "n8n-nodes-base.switch": {
        const rules = node.parameters.rules.values;
        outIndex = rules.length; // fallback "extra"
        for (let i = 0; i < rules.length; i++) {
          const c = rules[i].conditions.conditions[0];
          assert.equal(c.operator.operation, "equals");
          if (String(resolve(c.leftValue, ctx)) === String(c.rightValue)) { outIndex = i; break; }
        }
        items = incoming;
        break;
      }
      case "n8n-nodes-base.postgres": {
        const sql = resolve(node.parameters.query, ctx, { always: true });
        checkResolved(name, "SQL", sql);
        sqlByNode[name] = sql;
        items = await ext.postgres(name, sql);
        break;
      }
      case "n8n-nodes-base.httpRequest": {
        const p = node.parameters;
        const req = {
          method: p.method || "GET",
          url: resolve(p.url, ctx),
          body: p.jsonBody ? resolve(p.jsonBody, ctx) : undefined,
          query: (p.queryParameters?.parameters || []).map((q) => ({ name: q.name, value: resolve(q.value, ctx) })),
        };
        checkResolved(name, "URL", req.url);
        if (req.body != null) checkResolved(name, "body", req.body);
        httpByNode[name] = req;
        items = ext.http(name, req);
        break;
      }
      case "n8n-nodes-base.respondToWebhook":
        response = incoming;
        items = incoming;
        break;
      default:
        throw new Error(`[${name}] unhandled node type ${node.type}`);
    }
    executed.set(name, items);
    trail.push(`${name}${outIndex ? `[${outIndex}]` : ""}`);
    if (node.type === "n8n-nodes-base.respondToWebhook") break;
    const next = ((wf.connections[name] || {}).main || [])[outIndex] || [];
    if (!next.length) break;
    name = next[0].node;
    incoming = items;
  }
  return { response, executed, trail, sqlByNode, httpByNode };
}

// -------------------------------------------------------------- externals
// Fixture mode: external nodes answer from the scenario's fixture map; a
// Postgres write with no fixture answers n8n's `{success: true}`.
// The Postgres node hands timestamptz columns to Code nodes as JS Date objects
// (pg's default parsing), while stored execution data holds them as ISO
// strings. Revive them so fixture mode sees what the Code node really gets;
// this is how a Date stringified into a SQL literal gets caught without --db.
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
function reviveDates(items) {
  return items.map((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return row;
    const out = {};
    for (const [k, v] of Object.entries(row)) out[k] = typeof v === "string" && ISO_RE.test(v) ? new Date(v) : v;
    return out;
  });
}
function fixtureExternals(fx) {
  return {
    webhook: () => fx.Webhook,
    postgres: async (name) => (fx[name] ? reviveDates(fx[name]) : [{ success: true }]),
    http: (name, req) => {
      assert.ok(fx[name], `[${name}] no fixture for ${req.method} ${req.url.slice(0, 120)}`);
      return fx[name];
    },
  };
}
// DB mode: Postgres nodes run the resolved SQL for real inside one transaction
// per scenario that is always rolled back. Meta and Anthropic stay fixtures.
function dbExternals(fx, client) {
  return {
    webhook: () => fx.Webhook,
    postgres: async (name, sql) => {
      const res = await client.query(sql);
      const results = Array.isArray(res) ? res : [res];
      const withRows = results.filter((r) => r.rows && r.rows.length);
      return withRows.length ? withRows[withRows.length - 1].rows : [{ success: true }];
    },
    http: (name, req) => {
      assert.ok(fx[name], `[${name}] no fixture for ${req.method} ${req.url.slice(0, 120)}`);
      return fx[name];
    },
  };
}

// ---------------------------------------------------------------- fixtures
const clone = (o) => JSON.parse(JSON.stringify(o));
const STAGED = FX.optimise_staged_exclusion;
const CRASH = FX.execute_exclusion_crash;
const CLIENT_ID = STAGED["Load client"][0].id;
const ACCOUNT = "act_1766396370547849";
const EVIDENCE = "glue smoke: synthetic move with evidence long enough to pass the grammar gate";
const norbertReply = (q1, q2) => [{ ...clone(STAGED.Norbert[0]), content: [{ type: "text", text: JSON.stringify({ q1, q2 }) }] }];
const moveRow = (over) => ({
  ...clone(CRASH["Load move"][0]),
  id: "11111111-1111-4111-8111-111111111111", op: "budget", entity_type: "campaign", entity_id: "120250000000000002",
  from_value: { daily_budget_minor: 10000 }, to_value: { daily_budget_minor: 12000 }, evidence: EVIDENCE,
  status: "proposed", norbert_q1: "SOUND", human_change_conflict: null, created_at: "2026-09-03T00:00:00.000Z",
  account_id: ACCOUNT, client_slug: "steffen-foerster", ceiling: 3, executed_today: "0", ...over,
});

// ---------------------------------------------------------------- scenarios
// Each: { name, wf, fx, setup? (db mode: runs SQL in the tx and may patch fx),
//         expect(result) | throws: /regex/ }
const SCENARIOS = [
  {
    name: "W1 real replay: exclusion set stages with disclosure (exec 25021)",
    wf: WF1, fx: clone(STAGED),
    expect: ({ response, sqlByNode, trail }) => {
      const r = response[0];
      assert.equal(r.ok, true);
      assert.equal(r.approval_items.length, 1);
      assert.match(r.approval_items[0].exclusion_disclosure, /LEARNING RESET/);
      assert.match(r.approval_items[0].exclusion_disclosure, /MATCH WARNING/);
      assert.match(sqlByNode["Insert moves"], /'audience_exclude'/);
      assert.match(sqlByNode["Insert session"], /norbert_q2/);
      assert.match(sqlByNode["Meter Norbert"], /NORBERT_review/);
      assert.ok(trail.includes("Exclusion checks"));
    },
  },
  {
    name: "W1 real replay: grammar refusal at Gates (exec 25009)",
    wf: WF1, fx: clone(FX.optimise_blocked_gates),
    expect: ({ response, sqlByNode }) => {
      assert.equal(response[0].ok, false);
      assert.equal(response[0].gate, "grammar");
      assert.match(sqlByNode["Log gate block"], /'gate_blocked'/);
    },
  },
  {
    name: "W1 real replay: cross-account audience refused at Exclusion checks, Respond blocked picks the post-read refusal (exec 25011)",
    wf: WF1, fx: clone(FX.optimise_blocked_exclusion_checks),
    expect: ({ response, sqlByNode }) => {
      assert.equal(response[0].gate, "exclusion_scope");
      assert.match(response[0].error, /belongs to account/);
      assert.match(sqlByNode["Log gate block"], /120250709836350053/);
    },
  },
  {
    name: "W1 synthetic: pause + budget set, no exclusion, both HTTP context reads degrade to the account read",
    wf: WF1,
    fx: (() => {
      const fx = clone(STAGED);
      fx.Webhook = [{ body: { client_slug: "steffen-foerster", account_id: ACCOUNT, session_note: "glue smoke", moves: [
        { op: "pause", entity_type: "adset", entity_id: "120250000000000001", evidence: EVIDENCE },
        { op: "budget", entity_type: "campaign", entity_id: "120250000000000002", from_minor: 10000, to_minor: 12000, evidence: EVIDENCE },
      ] } }];
      fx["Read entities"] = [{
        "120250000000000001": { id: "120250000000000001", name: "A", status: "ACTIVE", effective_status: "ACTIVE" },
        "120250000000000002": { id: "120250000000000002", name: "B", status: "ACTIVE", effective_status: "ACTIVE" },
      }];
      fx["Read adset context"] = [{ [ACCOUNT]: { id: ACCOUNT } }];
      fx["Read audiences"] = [{ [ACCOUNT]: { id: ACCOUNT } }];
      fx.Norbert = norbertReply([{ entity_id: "120250000000000001", verdict: "SOUND" }, { entity_id: "120250000000000002", verdict: "Wrong: raise is unearned" }], "Nothing else.");
      fx["Insert session"] = [{ id: "22222222-2222-4222-8222-222222222222" }];
      fx["Insert moves"] = [
        { id: "m1", op: "pause", entity_type: "adset", entity_id: "120250000000000001", evidence: EVIDENCE, norbert_q1: "SOUND", human_change_conflict: null },
        { id: "m2", op: "budget", entity_type: "campaign", entity_id: "120250000000000002", evidence: EVIDENCE, norbert_q1: "Wrong: raise is unearned", human_change_conflict: null },
      ];
      return fx;
    })(),
    expect: ({ response, sqlByNode, httpByNode }) => {
      assert.equal(response[0].ok, true);
      assert.equal(response[0].approval_items.length, 2);
      assert.equal(response[0].approval_items[0].exclusion_disclosure, undefined);
      assert.match(sqlByNode["Insert moves"], /"daily_budget_minor": 12000/);
      assert.match(sqlByNode["Insert moves"], /'{"status":"PAUSED"}'/);
      assert.match(httpByNode["Read adset context"].url, /ids=act_1766396370547849&fields=id$/);
      assert.match(httpByNode["Read entities"].url, /ids=120250000000000001,120250000000000002&/);
    },
  },
  {
    name: "W1 synthetic: Meta change history unreadable fails closed at Gates",
    wf: WF1,
    fx: (() => { const fx = clone(STAGED); fx["Meta change history"] = [{ error: { message: "Invalid OAuth 2.0 Access Token", code: 190 } }]; return fx; })(),
    expect: ({ response }) => { assert.equal(response[0].ok, false); assert.equal(response[0].gate, "change_history"); },
  },
  {
    name: "W1 synthetic: Norbert reply unparsable still stages, with the parse failure surfaced",
    wf: WF1,
    fx: (() => {
      const fx = clone(STAGED);
      fx.Norbert = [{ ...clone(STAGED.Norbert[0]), content: [{ type: "text", text: "I would rather not answer in JSON today." }] }];
      fx["Insert moves"] = [{ ...clone(STAGED["Insert moves"][0]), norbert_q1: null }];
      return fx;
    })(),
    expect: ({ response, sqlByNode }) => {
      assert.equal(response[0].ok, true);
      assert.match(response[0].norbert_q2, /NORBERT PARSE FAILED/);
      assert.match(sqlByNode["Insert moves"], /, NULL, NULL\)/);
    },
  },
  {
    name: "W2 real replay: exclusion approve continues PAST Verify exclusion on the real read-back (exec 25036, the 26 Aug crash)",
    wf: WF2, fx: clone(CRASH),
    setup: async (c, fx) => { fx.Webhook[0].body.move_id = await seedMove(c, { op: "audience_exclude", entity_type: "adset", entity_id: CRASH["Load move"][0].entity_id, from_value: CRASH["Load move"][0].from_value, to_value: CRASH["Load move"][0].to_value }); },
    expect: ({ response, sqlByNode, httpByNode }) => {
      const r = response[0];
      assert.deepEqual(r.read_back_exclusions, ["120250432329390053", "120250694850660053"]);
      assert.equal(r.status, "executed", `problems: ${JSON.stringify(r.problems)}`);
      assert.match(sqlByNode["Write outcome"], /status='executed'/);
      assert.match(httpByNode["Write targeting"].body, /"excluded_custom_audiences":\[\{"id":"120250432329390053"\},\{"id":"120250694850660053"\}\]/);
    },
  },
  {
    name: "W2 synthetic: exclusion read-back identical to pre-write is verification_failed",
    wf: WF2,
    fx: (() => { const fx = clone(CRASH); fx["Read back targeting"] = clone(CRASH["Read targeting"]); return fx; })(),
    setup: async (c, fx) => { fx.Webhook[0].body.move_id = await seedMove(c, { op: "audience_exclude", entity_type: "adset", entity_id: CRASH["Load move"][0].entity_id, from_value: CRASH["Load move"][0].from_value, to_value: CRASH["Load move"][0].to_value }); },
    expect: ({ response, sqlByNode }) => {
      assert.equal(response[0].status, "verification_failed");
      assert.match(response[0].problems.join(" | "), /identical to pre-write/);
      assert.match(sqlByNode["Write outcome"], /'died'/);
    },
  },
  {
    name: "W2 synthetic: budget approve, read-back matches, executed",
    wf: WF2,
    fx: { Webhook: [{ body: { move_id: "11111111-1111-4111-8111-111111111111", decision: "approve" } }], "Load move": [moveRow({})], "Meta write": [{ success: true }], "Read back": [{ id: "120250000000000002", daily_budget: "12000" }] },
    setup: async (c, fx) => { fx.Webhook[0].body.move_id = await seedMove(c, { op: "budget", entity_type: "campaign", entity_id: "120250000000000002", from_value: { daily_budget_minor: 10000 }, to_value: { daily_budget_minor: 12000 } }); },
    expect: ({ response, sqlByNode, httpByNode }) => {
      assert.equal(response[0].status, "executed");
      assert.match(httpByNode["Meta write"].url, /\/120250000000000002$/);
      assert.equal(httpByNode["Meta write"].body, '{"daily_budget":12000}');
      assert.match(httpByNode["Read back"].url, /fields=id,daily_budget$/);
      assert.match(sqlByNode["Write outcome"], /'executed'/);
    },
  },
  {
    name: "W2 synthetic: pause approve, read-back still ACTIVE, verification_failed",
    wf: WF2,
    fx: { Webhook: [{ body: { move_id: "11111111-1111-4111-8111-111111111111", decision: "approve" } }], "Load move": [moveRow({ op: "pause", entity_type: "adset", from_value: { status: "ACTIVE" }, to_value: { status: "PAUSED" } })], "Meta write": [{ success: true }], "Read back": [{ id: "120250000000000002", status: "ACTIVE", effective_status: "ACTIVE" }] },
    setup: async (c, fx) => { fx.Webhook[0].body.move_id = await seedMove(c, { op: "pause", entity_type: "adset", entity_id: "120250000000000002", from_value: { status: "ACTIVE" }, to_value: { status: "PAUSED" } }); },
    expect: ({ response, sqlByNode, httpByNode }) => {
      assert.equal(response[0].status, "verification_failed");
      assert.equal(httpByNode["Meta write"].body, '{"status":"PAUSED"}');
      assert.match(sqlByNode["Write outcome"], /read-back mismatch/);
    },
  },
  {
    name: "W2 real replay: founder rejection (exec 25250)",
    wf: WF2, fx: clone(FX.execute_latest),
    setup: async (c, fx) => { fx.Webhook[0].body.move_id = await seedMove(c, { op: "audience_exclude", entity_type: "adset", entity_id: "120250709836350053", from_value: {}, to_value: { audience_id: "120250694850660053" } }); },
    expect: ({ response, sqlByNode }) => {
      assert.equal(response[0].status, "rejected");
      assert.match(sqlByNode["Write rejection"], /status='rejected'/);
      assert.match(sqlByNode["Write rejection"], /'rejected', 'Founder rejection 2026-08-30/);
    },
  },
  {
    name: "W2 synthetic: move already executed routes to error",
    wf: WF2,
    fx: { Webhook: [{ body: { move_id: "11111111-1111-4111-8111-111111111111", decision: "approve" } }], "Load move": [moveRow({ status: "executed" })] },
    setup: async (c, fx) => { fx.Webhook[0].body.move_id = await seedMove(c, { status: "executed" }); },
    expect: ({ response }) => { assert.equal(response[0].ok, false); assert.match(response[0].error, /is executed, not proposed/); },
  },
  {
    name: "W2 synthetic: ceiling reached between staging and approval routes to error",
    wf: WF2,
    fx: { Webhook: [{ body: { move_id: "11111111-1111-4111-8111-111111111111", decision: "approve" } }], "Load move": [moveRow({ executed_today: "3" })] },
    setup: async (c, fx) => {
      for (let i = 0; i < 3; i++) await seedMove(c, { status: "executed", executed: true, entity_id: `12025000000000010${i}` });
      fx.Webhook[0].body.move_id = await seedMove(c, {});
    },
    expect: ({ response }) => { assert.match(response[0].error, /daily ceiling reached/); },
  },
  {
    name: "W2 real replay: audience already excluded at execute time aborts in Merge exclusion before any write (exec 25038)",
    wf: WF2, fx: clone(FX.execute_already_excluded),
    setup: async (c, fx) => { fx.Webhook[0].body.move_id = await seedMove(c, { op: "audience_exclude", entity_type: "adset", entity_id: FX.execute_already_excluded["Load move"][0].entity_id, to_value: FX.execute_already_excluded["Load move"][0].to_value, from_value: {} }); },
    throws: /\[Merge exclusion\] audience \d+ is already excluded/,
    afterThrow: ({ executed }) => { assert.ok(!executed.has("Write targeting"), "nothing may be written after the abort"); },
  },
];

// DB-mode seeding: a session and a move inside the rolled-back transaction, so
// Load move reads a real row shaped by the real schema and constraints.
async function seedMove(c, over) {
  const s = await c.query(
    `insert into optimise_sessions (client_id, account_id, dispatched_by, norbert_model, immature_data) values ($1::uuid, $2, 'founder', 'glue-smoke', true) returning id`,
    [CLIENT_ID, ACCOUNT],
  );
  const m = await c.query(
    `insert into optimise_moves (session_id, client_id, op, entity_type, entity_id, from_value, to_value, evidence, norbert_q1, status, executed_at)
     values ($1::uuid, $2::uuid, $3, $4, $5, $6::jsonb, $7::jsonb, $8, 'SOUND', $9, $10) returning id`,
    [s.rows[0].id, CLIENT_ID, over.op ?? "budget", over.entity_type ?? "campaign", over.entity_id ?? "120250000000000002",
      JSON.stringify(over.from_value ?? { daily_budget_minor: 10000 }), JSON.stringify(over.to_value ?? { daily_budget_minor: 12000 }),
      EVIDENCE, over.status ?? "proposed", over.executed ? new Date() : null],
  );
  return m.rows[0].id;
}

// ------------------------------------------------------- deployed drift check
async function deployedDrift() {
  const key = substrateEnv("N8N_API_KEY");
  assert.ok(key, "--deployed needs N8N_API_KEY");
  const ids = { BERNARD_optimise: "tgmHGKPDNy78Ozkd", BERNARD_optimise_execute: "ywJvDCQfDSPJYdbQ" };
  const drift = [];
  for (const wf of [WF1, WF2]) {
    const res = await fetch(`https://singularweb.app.n8n.cloud/api/v1/workflows/${ids[wf.name]}`, { headers: { "X-N8N-API-KEY": key } });
    const dep = await res.json();
    const byName = Object.fromEntries(dep.nodes.map((n) => [n.name, n]));
    for (const g of wf.nodes) {
      const d = byName[g.name];
      if (!d) { drift.push(`${wf.name}: node "${g.name}" missing in n8n`); continue; }
      const strip = (p) => JSON.stringify(p, Object.keys(p).sort());
      if (g.type === "n8n-nodes-base.code" && d.parameters.jsCode !== g.parameters.jsCode) drift.push(`${wf.name}: Code node "${g.name}" differs from generated`);
      if (g.type === "n8n-nodes-base.postgres" && d.parameters.query !== g.parameters.query) drift.push(`${wf.name}: Postgres node "${g.name}" query differs`);
      if (g.type === "n8n-nodes-base.httpRequest" && strip(d.parameters) !== strip(g.parameters)) drift.push(`${wf.name}: HTTP node "${g.name}" parameters differ`);
    }
    if (JSON.stringify(dep.connections) !== JSON.stringify(wf.connections)) drift.push(`${wf.name}: connections differ`);
  }
  return drift;
}

// -------------------------------------------------------------------- main
(async () => {
  let pgClient = null;
  if (DB_MODE) {
    const url = substrateEnv("SUPABASE_DB_URL");
    assert.ok(url, "--db needs SUPABASE_DB_URL");
    const { Client } = require("pg");
    pgClient = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
    await pgClient.connect();
    const fp = await pgClient.query("select to_regclass('kb_documents') is not null as substrate");
    assert.equal(fp.rows[0].substrate, true, "--db must point at the SUBSTRATE (kb_documents present)");
  }
  let pass = 0, fail = 0;
  const failures = [];
  for (const sc of SCENARIOS) {
    const fx = clone(sc.fx);
    let ext;
    if (DB_MODE) {
      await pgClient.query("begin");
      if (sc.setup) await sc.setup(pgClient, fx);
      ext = dbExternals(fx, pgClient);
    } else {
      ext = fixtureExternals(fx);
    }
    let result;
    try {
      try {
        result = await runWorkflow(sc.wf, ext);
        if (sc.throws) throw new Error(`expected a throw matching ${sc.throws}, got trail ${result.trail.join(" > ")}`);
        sc.expect(result);
      } catch (e) {
        if (sc.throws && sc.throws.test(e.message)) {
          if (sc.afterThrow) sc.afterThrow({ executed: e.executed || new Map() });
        } else throw e;
      }
      pass++;
      console.log(`  ok   ${sc.name}`);
    } catch (e) {
      fail++;
      failures.push({ sc: sc.name, err: e.message, trail: result?.trail });
      console.log(`  FAIL ${sc.name}\n       ${e.message.split("\n")[0]}`);
    } finally {
      if (DB_MODE) await pgClient.query("rollback");
    }
  }
  if (DEPLOYED) {
    const drift = await deployedDrift();
    if (drift.length) { fail += drift.length; for (const d of drift) console.log(`  DRIFT ${d}`); }
    else console.log("  ok   deployed workflows match the generator, node for node");
  }
  if (pgClient) await pgClient.end();
  console.log(`\n${pass} passed, ${fail} failed${DB_MODE ? " (SQL executed against the substrate and rolled back)" : ""}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });

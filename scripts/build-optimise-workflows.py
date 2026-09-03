#!/usr/bin/env python3
# Generates the two agent-optimise v1 workflows (docs/BERNARD_OPTIMISE_SPEC.md)
# and writes them to the scratchpad as JSON for the n8n API. Kept in the repo so
# the deployed workflows can be regenerated and diffed rather than hand-edited.
import json, sys, os

OUT = sys.argv[1] if len(sys.argv) > 1 else "."

PG   = {"postgres": {"id": "GnLou79kcbiN5252", "name": "Supabase — singularweb-prod"}}
META = {"httpQueryAuth": {"id": "u1iFg2OArYUi98PF", "name": "Meta system-user token (query access_token)"}}
HOOK = {"httpHeaderAuth": {"id": "L6Pw2vZt2DM7Qa8k", "name": "Bernard dispatch auth (x-bernard-key)"}}
ANTH = {"httpHeaderAuth": {"id": "ZuBQSKRVl62nQn2Y", "name": "Anthropic API key (header)"}}

# -------------------------------------------------------- v1.1 verify logic
# Pure function, embedded in the execute workflow AND extracted verbatim by
# tests/verify-exclusion.test.js, same discipline as the gates. This diff IS
# the acceptance test for the exclusion write: only excluded_custom_audiences
# may differ from the pre-write snapshot, and only by the single added id.
VERIFY_EXCLUSION_FN = r"""
// ===== VERIFY EXCLUSION (pure; extracted verbatim by tests/verify-exclusion.test.js) =====
// Section 3 step 6 of BERNARD_OPTIMISE_V1_1_EXCLUSIONS_SPEC.md. Returns the
// list of problems; empty means the write verified. A 200 proves nothing.
function verifyExclusionDiff(snapshot, readbackTargeting, audienceId) {
  const sortDeep = (v) => Array.isArray(v) ? v.map(sortDeep)
    : (v && typeof v === 'object' ? Object.keys(v).sort().reduce((o, k) => (o[k] = sortDeep(v[k]), o), {}) : v);
  const canon = (v) => JSON.stringify(sortDeep(v));
  const problems = [];
  const rb = readbackTargeting || {};
  if (!readbackTargeting) problems.push('read-back returned no targeting object');
  const keys = new Set(Object.keys(snapshot).concat(Object.keys(rb)));
  keys.delete('excluded_custom_audiences');
  // JSON.stringify(undefined) is undefined, not a string: a DROPPED field must
  // become a reported problem, never a crash that kills the verifier itself.
  const show = (v) => v === undefined ? 'absent' : JSON.stringify(v).slice(0, 200);
  // Meta appends targeting_relaxation_types {lookalike: 0, custom_audience: 0}
  // to any targeting object written without it. All zeros means "no relaxation",
  // which is what absent meant, so that one appearance is not a change. Found by
  // the glue smoke replaying the 26 August read-back: the strict diff would have
  // marked every real exclusion verification_failed after the write had landed.
  const isMetaNoopDefault = (k, before, after) =>
    k === 'targeting_relaxation_types' && before === undefined && after && typeof after === 'object'
    && Object.values(after).every(v => v === 0);
  for (const k of keys) {
    if (isMetaNoopDefault(k, snapshot[k], rb[k])) continue;
    if (canon(snapshot[k]) !== canon(rb[k]))
      problems.push('field "' + k + '" changed: ' + show(snapshot[k]) + ' -> ' + show(rb[k]));
  }
  const ids = (a) => (a || []).map(x => String(x.id)).sort();
  const expected = ids(snapshot.excluded_custom_audiences).concat([String(audienceId)]).sort();
  const got = ids(rb.excluded_custom_audiences);
  if (JSON.stringify(got) !== JSON.stringify(expected)) {
    problems.push(JSON.stringify(got) === JSON.stringify(ids(snapshot.excluded_custom_audiences))
      ? 'read-back exclusions identical to pre-write: the audience was not added'
      : 'excluded_custom_audiences read back as [' + got.join(',') + '], expected [' + expected.join(',') + ']');
  }
  return problems;
}
// ===== END VERIFY EXCLUSION =====
"""

# ---------------------------------------------------------------- gate logic
# Pure function, embedded in the workflow AND extracted verbatim by the test
# suite (tests/optimise-gates.test.js), same discipline as parse-batch.
GATES_FN = r"""
// ===== GATES (pure; extracted verbatim by tests/optimise-gates.test.js) =====
// Every refusal names its gate. gate_blocked refusals become counterfactual
// move_snapshots rows; grammar refusals fail the whole set (a malformed
// dispatch is a bug upstream, not a decision worth recording).
function runGates(input) {
  const { body, cfg, counts, activities, nowIso } = input;
  const OUR_APP_ID = '1023714696912738';
  const fail = (gate, msg) => ({ ok: false, gate, error: msg });

  if (!cfg) return fail('config', 'no bernard config for client');
  if (cfg.enabled !== true) return fail('enabled', 'bernard not enabled for client');
  if (cfg.stand_down === true) return fail('stand_down', 'STAND_DOWN active');
  if (cfg.kill_switch === true) return fail('kill_switch', 'kill_switch active');
  if (!body.account_id || !(cfg.account_ids || []).includes(body.account_id))
    return fail('allowlist', 'account_id not in allow-list');

  const opt = cfg.optimise || {};
  const CEILING = Number(opt.daily_ceiling || 3);
  const THRASH_N = Number(opt.thrash_n || 4);
  const MAX_PCT = Number(opt.budget_max_delta_pct || 25);
  const MAX_DAILY = Number((cfg.write_budget || {}).max_daily_budget_minor || 5000);

  const moves = Array.isArray(body.moves) ? body.moves : [];
  if (!moves.length) return fail('grammar', 'no moves in dispatch');
  // Fail CLOSED if the platform change history could not be read: on a
  // freelancer-managed account the thrash gate cannot count human changes
  // without it, and a blind thrash gate is no gate.
  if (activities === null)
    return fail('change_history', 'platform change history unreadable; refusing rather than proposing blind');
  const remaining = CEILING - Number(counts.executed_today || 0);
  if (remaining <= 0) return fail('ceiling', 'daily ceiling reached: ' + counts.executed_today + ' executed today');
  if (moves.length > remaining)
    return fail('ceiling', moves.length + ' moves proposed, only ' + remaining + ' remain under the ceiling of ' + CEILING);

  // Change history per entity: platform activities (humans and other apps)
  // plus our own snapshots. The freelancer's edits count exactly as ours do.
  const actByEntity = {};
  const humanByEntity = {};
  for (const a of (activities || [])) {
    const id = String(a.object_id || '');
    if (!id) continue;
    actByEntity[id] = (actByEntity[id] || 0) + 1;
    if (String(a.application_id || '') !== OUR_APP_ID) {
      (humanByEntity[id] = humanByEntity[id] || []).push(a);
    }
  }
  const ours = counts.our_changes_7d || {};

  const seen = new Set();
  const staged = [];
  for (const m of moves) {
    if (!['pause', 'budget', 'unpause', 'audience_exclude'].includes(m.op))
      return fail('grammar', 'unknown op "' + m.op + '"; the whole set is refused');
    if (!m.entity_id || !['campaign', 'adset', 'ad'].includes(m.entity_type))
      return fail('grammar', 'move missing entity_id/entity_type');
    // v1.1 (audience exclusions, founder-ruled 2026-08-26): adset-scoped only,
    // and the audience id must be concrete here. The account-level checks
    // (same account, not already excluded, not targeted, cap of 5) need Meta
    // reads and run in Exclusion checks, downstream, before Norbert.
    if (m.op === 'audience_exclude') {
      if (m.entity_type !== 'adset')
        return fail('grammar', 'audience_exclude applies to ad sets only; got entity_type "' + m.entity_type + '"');
      if (!/^\d{6,}$/.test(String(m.audience_id || '')))
        return fail('grammar', 'audience_exclude needs a numeric audience_id');
    }
    if (!m.evidence || String(m.evidence).trim().length < 10)
      return fail('grammar', 'every move carries evidence; "' + (m.evidence || '') + '" is not evidence');
    if (seen.has(m.entity_id))
      return fail('grammar', 'two moves on entity ' + m.entity_id + ' in one run is one move done badly');
    seen.add(m.entity_id);

    if (m.op === 'budget') {
      const from = Number(m.from_minor), to = Number(m.to_minor);
      if (!Number.isFinite(from) || !Number.isFinite(to) || to <= 0)
        return fail('grammar', 'budget move needs numeric from_minor/to_minor');
      const pct = Math.abs(to - from) / from * 100;
      if (pct > MAX_PCT)
        return fail('budget_bound', 'budget move of ' + pct.toFixed(0) + '% exceeds the ±' + MAX_PCT + '% bound');
      if (to > MAX_DAILY)
        return fail('budget_bound', 'to_minor ' + to + ' exceeds max_daily_budget_minor ' + MAX_DAILY);
    }

    const churn = (actByEntity[m.entity_id] || 0) + Number(ours[m.entity_id] || 0);
    if (churn >= THRASH_N) {
      return {
        ok: false, gate: 'thrash', entity_id: m.entity_id,
        error: 'entity ' + m.entity_id + ' has ' + churn + ' changes in 7 days (threshold ' + THRASH_N +
               '). A thrashing entity needs stability, not another move.'
      };
    }

    // Human-change check: name any recent human change this move may reverse.
    // Flags, never blocks: the founder arbitrates between agent and freelancer.
    const humans = humanByEntity[m.entity_id] || [];
    const conflict = humans.length
      ? ('human change(s) on this entity in window: ' +
         humans.slice(0, 3).map(h => (h.actor_name || 'unknown') + ' ' + (h.event_type || '') + ' ' + (h.event_time || '')).join('; '))
      : null;

    staged.push({ ...m, human_change_conflict: conflict });
  }

  return { ok: true, staged, immature_data: true, ceiling: CEILING, thrash_n: THRASH_N };
}
// ===== END GATES =====
"""

def code(name, js, pos, note=None):
    n = {"parameters": {"jsCode": js}, "type": "n8n-nodes-base.code", "typeVersion": 2,
         "position": pos, "id": ("60" + format(abs(hash(name)) % 10**10, '010d') + "-0000-4000-8000-000000000000")[:36],
         "name": name}
    if note: n["notes"] = note
    return n

def pg(name, query, pos, note=None, on_error=None):
    n = {"parameters": {"operation": "executeQuery", "query": query, "options": {}},
         "type": "n8n-nodes-base.postgres", "typeVersion": 2.6, "position": pos,
         "id": ("61" + format(abs(hash(name)) % 10**10, '010d') + "-0000-4000-8000-000000000000")[:36],
         "name": name, "credentials": PG}
    if note: n["notes"] = note
    if on_error: n["onError"] = on_error
    return n

# =============================== WORKFLOW 1: BERNARD_optimise ==============
wf1_nodes = [
  {"parameters": {"httpMethod": "POST", "path": "bernard-optimise",
                  "authentication": "headerAuth", "responseMode": "responseNode", "options": {}},
   "type": "n8n-nodes-base.webhook", "typeVersion": 2, "position": [0, 0],
   "id": "62aaaa0000000000000000000000000000ab"[:36], "name": "Webhook", "credentials": HOOK},

  pg("Load client",
     "select id, slug, config->'bernard' as cfg from clients where slug = '{{ $json.body.client_slug.replace(/[^a-z0-9-]/g, \"\") }}';",
     [200, 0]),

  pg("Load counts",
     """select
  (select count(*) from optimise_moves om where om.client_id = '{{ $json.id }}'::uuid
     and om.status = 'executed' and om.executed_at::date = now()::date) as executed_today,
  (select coalesce(jsonb_object_agg(t.entity_id, t.n), '{}'::jsonb) from (
     select ms.entity_id, count(*) n from move_snapshots ms
     where ms.client_id = '{{ $json.id }}'::uuid and ms.entity_id is not null
       and ms.created_at > now() - interval '7 days' group by ms.entity_id) t) as our_changes_7d;""",
     [400, 0], note="Ceiling and thrash inputs. Reads move_snapshots, never tasks (1,177 OpenDental rows there are not moves)."),

  {"parameters": {"url": "=https://graph.facebook.com/v23.0/{{ $('Webhook').first().json.body.account_id }}/activities",
                  "authentication": "genericCredentialType", "genericAuthType": "httpQueryAuth",
                  "sendQuery": True,
                  "queryParameters": {"parameters": [
                    {"name": "fields", "value": "event_type,event_time,object_id,actor_name,application_id"},
                    {"name": "since", "value": "={{ Math.floor(Date.now()/1000) - 14*86400 }}"},
                    {"name": "limit", "value": "200"}]},
                  "options": {}},
   "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.2, "position": [600, 0],
   "id": "63bbbb0000000000000000000000000000cd"[:36], "name": "Meta change history", "credentials": META,
   "onError": "continueRegularOutput",
   "notes": "The freelancer's edits, read from the platform itself. application_id distinguishes our writes from human ones."},

  code("Gates", GATES_FN + r"""
const hook = $('Webhook').first().json;
const client = $('Load client').first().json;
if (!client || !client.id) {
  return [{ json: { ok: false, gate: 'client', error: 'unknown client_slug', respond: true } }];
}
const counts = $('Load counts').first().json;
const aj = $input.first().json || {};
// A successful Graph call always carries a data array (possibly empty);
// anything else is a failed read and the gate fails closed.
const activities = Array.isArray(aj.data) ? aj.data : null;
const res = runGates({ body: hook.body, cfg: client.cfg, counts, activities, nowIso: new Date().toISOString() });
return [{ json: { ...res, client_id: client.id, client_slug: client.slug,
  account_id: hook.body.account_id, session_note: hook.body.session_note || null,
  revision_of: hook.body.revision_of || null, moves_raw: hook.body.moves } }];
""", [800, 0]),

  {"parameters": {"conditions": {"options": {"caseSensitive": True, "typeValidation": "loose", "version": 3},
    "conditions": [{"id": "ok1", "leftValue": "={{ $json.ok }}", "rightValue": "",
                    "operator": {"type": "boolean", "operation": "true", "singleValue": True}}],
    "combinator": "and"}, "looseTypeValidation": True, "options": {}},
   "type": "n8n-nodes-base.if", "typeVersion": 2, "position": [1000, 0],
   "id": "64cccc0000000000000000000000000000ef"[:36], "name": "Passed?"},

  # ----- blocked leg: counterfactual + respond
  pg("Log gate block",
     """insert into move_snapshots (task_id, client_id, build_ref, op_name, entity_type, entity_id, move_class, reason, snapshot, taken_at)
values (NULL, '{{ $json.client_id }}'::uuid, NULL, NULL, NULL,
  {{ $json.entity_id ? "'" + $json.entity_id + "'" : 'NULL' }},
  'gate_blocked', '{{ ($json.gate + ": " + $json.error).replace(/'/g, "''") }}',
  jsonb_build_object('gate', '{{ $json.gate }}', 'dispatch', '{{ JSON.stringify($json.moves_raw || []).replace(/'/g, "''") }}'::jsonb),
  now());""",
     [1200, 200], note="A refusal is a counterfactual, not noise.", on_error="continueRegularOutput"),

  code("Respond blocked", r"""
// A refusal can come from Gates (pre-read) or from Exclusion checks (post-read,
// v1.1). isExecuted disambiguates without breaking the Gates-only path.
let j = $('Gates').first().json;
if ($('Exclusion checks').isExecuted) {
  const e = $('Exclusion checks').first().json;
  if (e && e.ok === false) j = e;
}
return [{ json: { ok: false, gate: j.gate, error: j.error } }];
""", [1400, 200]),

  # ----- passed leg: snapshot entities, Norbert, store, respond
  {"parameters": {"url": "=https://graph.facebook.com/v23.0/?ids={{ $json.staged.map(m => m.entity_id).join(',') }}&fields=id,name,status,effective_status,updated_time",
                  "authentication": "genericCredentialType", "genericAuthType": "httpQueryAuth", "options": {}},
   "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.2, "position": [1200, -160],
   "id": "65dddd0000000000000000000000000000ab"[:36], "name": "Read entities", "credentials": META,
   "onError": "continueRegularOutput",
   "notes": "Common fields only: ads have no daily_budget and Graph rejects mixed-type field lists. Budget truth comes from the execute leg's type-aware read-back."},

  # ----- v1.1 exclusion context: two reads + the post-read gate. Both HTTP
  # nodes degrade to a harmless account read when the run carries no
  # audience_exclude moves, so the leg stays one straight line (no branch
  # convergence, which is where n8n reference bugs live).
  {"parameters": {"url": "=https://graph.facebook.com/v23.0/?ids={{ $('Gates').first().json.staged.filter(m => m.op === 'audience_exclude').map(m => m.entity_id).join(',') || $('Gates').first().json.account_id }}&fields={{ $('Gates').first().json.staged.some(m => m.op === 'audience_exclude') ? 'id,name,account_id,created_time,targeting,learning_stage_info,insights.date_preset(maximum){spend}' : 'id' }}",
                  "authentication": "genericCredentialType", "genericAuthType": "httpQueryAuth", "options": {}},
   "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.2, "position": [1400, -320],
   "id": "65dddd1111000000000000000000000000ac"[:36], "name": "Read adset context", "credentials": META,
   "onError": "continueRegularOutput",
   "notes": "v1.1: full targeting + learning state + lifetime spend for every ad set an exclusion targets. Falls back to a bare account read when no exclusion moves are staged."},

  {"parameters": {"url": "=https://graph.facebook.com/v23.0/?ids={{ $('Gates').first().json.staged.filter(m => m.op === 'audience_exclude').map(m => m.audience_id).join(',') || $('Gates').first().json.account_id }}&fields={{ $('Gates').first().json.staged.some(m => m.op === 'audience_exclude') ? 'id,name,subtype,approximate_count_lower_bound,approximate_count_upper_bound,delivery_status,operation_status,account_id' : 'id' }}",
                  "authentication": "genericCredentialType", "genericAuthType": "httpQueryAuth", "options": {}},
   "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.2, "position": [1600, -320],
   "id": "65dddd2222000000000000000000000000ad"[:36], "name": "Read audiences", "credentials": META,
   "onError": "continueRegularOutput",
   "notes": "v1.1: the exclusion audience's identity and match quality. canServe (delivery_status.code 200) is the usable signal; approximate_count fields are Meta placeholders and ride as caveated context only."},

  code("Exclusion checks", r"""
// v1.1 post-read gate (BERNARD_OPTIMISE_V1_1_EXCLUSIONS_SPEC.md sections 2 and 4).
// Runs on every set; a set with no audience_exclude moves passes straight
// through with entity_now merged, which is all the old path did here.
const g = $('Gates').first().json;
const entitiesRaw = $('Read entities').first().json || {};
const entities = entitiesRaw.error ? {} : entitiesRaw;
const passThrough = { client_id: g.client_id, account_id: g.account_id, session_note: g.session_note,
  revision_of: g.revision_of, immature_data: g.immature_data, moves_raw: g.moves_raw };
const fail = (gate, msg, entityId) => [{ json: { ok: false, gate, error: msg, entity_id: entityId || null, ...passThrough } }];

let staged = g.staged.map(m => ({ ...m, entity_now: entities[m.entity_id] || null }));
const excl = staged.filter(m => m.op === 'audience_exclude');
if (excl.length) {
  const adsRaw = $('Read adset context').first().json || {};
  const audRaw = $('Read audiences').first().json || {};
  if (adsRaw.error) return fail('exclusion_read', 'ad set targeting read failed (' + JSON.stringify(adsRaw.error).slice(0, 200) + '); refusing rather than staging blind');
  if (audRaw.error) return fail('exclusion_read', 'audience read failed (' + JSON.stringify(audRaw.error).slice(0, 200) + '); refusing rather than staging blind');
  const accountDigits = String(g.account_id).replace(/^act_/, '');
  const MAX_EXCLUSIONS = 5;
  const MATCH_FLOOR = 100;
  for (const m of excl) {
    const adset = adsRaw[m.entity_id];
    const aud = audRaw[m.audience_id];
    if (!adset || !adset.targeting)
      return fail('exclusion_read', 'ad set ' + m.entity_id + ' returned no targeting object; refusing rather than staging blind', m.entity_id);
    if (!aud || !aud.id)
      return fail('exclusion_read', 'audience ' + m.audience_id + ' unreadable; a cross-account or deleted audience fails the whole set', m.entity_id);
    if (String(aud.account_id || '').replace(/^act_/, '') !== accountDigits)
      return fail('exclusion_scope', 'audience ' + m.audience_id + ' belongs to account ' + (aud.account_id || 'unknown') + ', not ' + g.account_id + '; cross-account ids fail the set', m.entity_id);
    if (adset.account_id && String(adset.account_id).replace(/^act_/, '') !== accountDigits)
      return fail('exclusion_scope', 'ad set ' + m.entity_id + ' is not in the dispatch account', m.entity_id);
    const t = adset.targeting;
    const excluded = (t.excluded_custom_audiences || []).map(a => String(a.id));
    const included = (t.custom_audiences || []).map(a => String(a.id));
    if (excluded.includes(String(m.audience_id)))
      return fail('exclusion_idempotent', 'audience ' + m.audience_id + ' is already excluded on ad set ' + m.entity_id + '; an idempotent no-op still burns a ceiling slot and resets learning, so it is refused', m.entity_id);
    if (included.includes(String(m.audience_id)))
      return fail('exclusion_incoherent', 'audience ' + m.audience_id + ' is in ad set ' + m.entity_id + '\'s INCLUSION list; excluding a targeted audience is a mis-specified move', m.entity_id);
    if (excluded.length + 1 > MAX_EXCLUSIONS)
      return fail('exclusion_cap', 'ad set ' + m.entity_id + ' would carry ' + (excluded.length + 1) + ' excluded audiences; the cap is ' + MAX_EXCLUSIONS + ' so individually reasonable exclusions cannot stack into strangled delivery', m.entity_id);

    // Section 4 disclosures: attached, never blocking. The harm of a too-small
    // exclusion is believing it worked, so the warning must reach the founder.
    const canServe = ((aud.delivery_status || {}).code === 200);
    const lower = Number(aud.approximate_count_lower_bound);
    const mayNotMatch = !canServe || (Number.isFinite(lower) && lower < MATCH_FLOOR);
    const ageDays = adset.created_time ? Math.round((Date.now() - new Date(adset.created_time).getTime()) / 86400000) : null;
    const spendRaw = ((((adset.insights || {}).data || [])[0]) || {}).spend;
    const learning = ((adset.learning_stage_info || {}).status) || 'UNKNOWN';
    m.exclusion_context = {
      audience: { id: String(aud.id), name: aud.name || null, subtype: aud.subtype || null,
        canServe, approximate_count_lower_bound: aud.approximate_count_lower_bound ?? null,
        approximate_count_upper_bound: aud.approximate_count_upper_bound ?? null },
      exclusions_before: excluded,
      learning_status: learning,
      adset_age_days: ageDays,
      adset_lifetime_spend: spendRaw != null ? Number(spendRaw) : null,
      may_not_match: mayNotMatch,
    };
    const parts = [];
    parts.push('LEARNING RESET: this exclusion resets the ad set\'s learning phase. The ad set is '
      + (ageDays != null ? ageDays + ' days old' : 'of unknown age') + ' with '
      + (spendRaw != null ? spendRaw + ' (account currency) lifetime spend' : 'unknown lifetime spend')
      + ', currently ' + learning + (learning === 'LEARNING' ? ' (already learning, so the reset costs less than on a stabilised ad set)' : '') + '.');
    if (mayNotMatch) {
      parts.push('MATCH WARNING: Meta reports this audience '
        + (!canServe ? 'canServe: false' : 'with an approximate lower bound of ' + lower + ', below the match floor')
        + '. This exclusion may not match anyone and is therefore NOT evidence the underlying problem is solved.');
    }
    m.exclusion_disclosure = parts.join(' ');
  }
  staged = staged.map(m => m); // exclusion moves mutated in place above
}
return [{ json: { ok: true, staged, ...passThrough } }];
""", [1800, -320], note="v1.1 gates that need Meta reads: same-account, not-already-excluded, not-targeted, cap of 5, plus the section-4 disclosures."),

  {"parameters": {"conditions": {"options": {"caseSensitive": True, "typeValidation": "loose", "version": 3},
    "conditions": [{"id": "ok2", "leftValue": "={{ $json.ok }}", "rightValue": "",
                    "operator": {"type": "boolean", "operation": "true", "singleValue": True}}],
    "combinator": "and"}, "looseTypeValidation": True, "options": {}},
   "type": "n8n-nodes-base.if", "typeVersion": 2, "position": [2000, -320],
   "id": "64cccc1111000000000000000000000000f0"[:36], "name": "Exclusions passed?"},

  code("Norbert prompt", r"""
// Norbert sees the account, not Bernard's reasoning. Deliberate: he reviews
// what is there and what is missing, not the argument that produced it.
const g = $('Gates').first().json;
const staged = $('Exclusion checks').first().json.staged;
const system = [
  'You are Norbert, the supervisor reviewing proposed Meta ad account changes before the founder sees them.',
  'Answer two questions, separately and plainly. Plain text, no em dashes.',
  'Q1: For each proposed move, is it wrong? Judge against the entity state and change history given. If wrong, say why in one sentence. If sound, say SOUND.',
  'For audience_exclude moves, exclusion_context carries the audience\'s match quality and the learning-reset cost; an exclusion that may match nobody is not wrong to apply, but calling the underlying problem solved on its basis would be.',
  'Q2: What is the biggest problem in this account that this run did NOT touch? One paragraph, specific.',
  'Respond as JSON only: {"q1": [{"entity_id": "...", "verdict": "SOUND" | "<why it is wrong>"}], "q2": "..."}'
].join('\n');
const user = JSON.stringify({
  account_id: g.account_id,
  proposed_moves: staged,
  change_history_14d: ($('Meta change history').first().json.data || []).slice(0, 60),
  note: g.session_note
});
return [{ json: { staged, anthropic_body: {
  model: 'claude-opus-4-8', max_tokens: 1500,
  system, messages: [{ role: 'user', content: user }] } } }];
""", [1400, -160]),

  {"parameters": {"method": "POST", "url": "https://api.anthropic.com/v1/messages",
                  "authentication": "genericCredentialType", "genericAuthType": "httpHeaderAuth",
                  "sendHeaders": True,
                  "headerParameters": {"parameters": [{"name": "anthropic-version", "value": "2023-06-01"}]},
                  "sendBody": True, "specifyBody": "json",
                  "jsonBody": "={{ JSON.stringify($json.anthropic_body) }}", "options": {}},
   "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.2, "position": [1600, -160],
   "id": "66eeee0000000000000000000000000000cd"[:36], "name": "Norbert", "credentials": ANTH},

  code("Parse Norbert + meter", r"""
// Norbert does not get to start life unmetered (economics ledger, 2026-08-18).
// Opus 4.8: $5/M in, $25/M out.
const resp = $input.first().json;
const usage = resp.usage || {};
const cost = (Number(usage.input_tokens || 0) * 5 + Number(usage.output_tokens || 0) * 25) / 1e6;
let verdicts = { q1: [], q2: null };
try {
  const text = (resp.content || []).map(c => c.text || '').join('');
  verdicts = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
} catch (e) { verdicts = { q1: [], q2: 'NORBERT PARSE FAILED: review raw output in n8n execution log' }; }
const g = $('Gates').first().json;
const staged = $('Norbert prompt').first().json.staged.map(m => {
  const v = (verdicts.q1 || []).find(x => String(x.entity_id) === String(m.entity_id));
  return { ...m, norbert_q1: v ? v.verdict : null };
});
const esc = (s) => String(s).replace(/'/g, "''");
const meterSql = `insert into action_log (client_id, workflow, step, tool, status, model, tokens_in, tokens_out, cost_usd)
values ('${g.client_id}'::uuid, 'NORBERT_review', 'review', 'anthropic_messages', 'ok',
  '${esc(resp.model || 'claude-opus-4-8')}', ${Number(usage.input_tokens || 0)}, ${Number(usage.output_tokens || 0)}, ${cost.toFixed(6)});`;
return [{ json: { staged, q2: verdicts.q2 || null, norbert_model: resp.model || 'claude-opus-4-8',
  immature_data: g.immature_data, client_id: g.client_id, account_id: g.account_id,
  revision_of: g.revision_of, meterSql } }];
""", [1800, -160]),

  pg("Meter Norbert", "={{ $json.meterSql }}", [2000, -160], on_error="continueRegularOutput"),

  code("Stage SQL", r"""
const j = $('Parse Norbert + meter').first().json;
const esc = (s) => String(s).replace(/'/g, "''");
const q2 = j.q2 ? "'" + esc(j.q2) + "'" : 'NULL';
const rev = j.revision_of ? `jsonb_build_object('revision_of','${esc(j.revision_of)}')` : 'NULL';
const sessionSql = `insert into optimise_sessions (client_id, account_id, dispatched_by, norbert_model, norbert_q2, norbert_revision_round, immature_data)
values ('${j.client_id}'::uuid, '${esc(j.account_id)}', 'founder', '${esc(j.norbert_model)}', ${q2}, ${rev}, ${j.immature_data ? 'true' : 'false'})
returning id;`;
return [{ json: { sessionSql, staged: j.staged, client_id: j.client_id } }];
""", [2200, -160]),

  pg("Insert session", "={{ $json.sessionSql }}", [2400, -160]),

  code("Moves SQL", r"""
const sid = $input.first().json.id;
const j = $('Stage SQL').first().json;
const esc = (s) => String(s).replace(/'/g, "''");
const jstr = (o) => JSON.stringify(o).replace(/'/g, "''");
const rows = j.staged.map(m => {
  let fromV, toV;
  if (m.op === 'budget') {
    fromV = `'{"daily_budget_minor": ${Number(m.from_minor)}}'::jsonb`;
    toV = `'{"daily_budget_minor": ${Number(m.to_minor)}}'::jsonb`;
  } else if (m.op === 'audience_exclude') {
    // Decision-time exclusion list, and the whole section-4 disclosure, so the
    // audit row explains itself and the execute leg knows the audience.
    const ctx = m.exclusion_context || {};
    fromV = `'${jstr({ excluded_custom_audiences: ctx.exclusions_before || [] })}'::jsonb`;
    toV = `'${jstr({ audience_id: String(m.audience_id), audience_name: (ctx.audience || {}).name || null,
      excluded_custom_audiences_after: (ctx.exclusions_before || []).concat([String(m.audience_id)]),
      disclosure: m.exclusion_disclosure || null, context: ctx })}'::jsonb`;
  } else {
    fromV = `'{"status":"ACTIVE"}'::jsonb`;
    toV = `'{"status":"${m.op === 'pause' ? 'PAUSED' : 'ACTIVE'}"}'::jsonb`;
  }
  return `('${sid}'::uuid, '${j.client_id}'::uuid, '${m.op}', '${m.entity_type}', '${esc(m.entity_id)}', ${fromV}, ${toV}, '${esc(m.evidence)}', ${m.norbert_q1 ? "'" + esc(m.norbert_q1) + "'" : 'NULL'}, ${m.human_change_conflict ? "'" + esc(m.human_change_conflict) + "'" : 'NULL'})`;
}).join(',\n  ');
return [{ json: { session_id: sid, sql: `insert into optimise_moves (session_id, client_id, op, entity_type, entity_id, from_value, to_value, evidence, norbert_q1, human_change_conflict) values\n  ${rows}\nreturning id, op, entity_type, entity_id, evidence, norbert_q1, human_change_conflict;` } }];
""", [2600, -160]),

  pg("Insert moves", "={{ $json.sql }}", [2800, -160]),

  code("Respond staged", r"""
const moves = $input.all().map(i => i.json);
const meta = $('Parse Norbert + meter').first().json;
// v1.1: the section-4 disclosures ride on the approval item itself, so the
// learning-reset cost and any may-not-match warning are visible at the point
// of decision rather than discovered afterwards.
const stagedCtx = meta.staged || [];
return [{ json: {
  ok: true,
  session_id: $('Moves SQL').first().json.session_id,
  immature_data_caveat: 'Proposals rest on intraday reads; Meta backloads delivery, so treat today\'s numbers as immature.',
  norbert_q2: meta.q2,
  approval_items: moves.map(m => {
    const ctx = stagedCtx.find(s => String(s.entity_id) === String(m.entity_id) && s.op === m.op) || {};
    return {
      move_id: m.id, op: m.op, entity: m.entity_type + ' ' + m.entity_id,
      evidence: m.evidence, norbert_q1: m.norbert_q1,
      human_change_conflict: m.human_change_conflict,
      ...(ctx.exclusion_disclosure ? { exclusion_disclosure: ctx.exclusion_disclosure } : {}),
      ...(ctx.exclusion_context ? { exclusion_audience: ctx.exclusion_context.audience } : {}),
      approve_via: 'POST /webhook/bernard-optimise-execute {"move_id":"' + m.id + '","decision":"approve"}'
    };
  })
} }];
""", [3000, -160]),

  {"parameters": {"respondWith": "allIncomingItems", "options": {}},
   "type": "n8n-nodes-base.respondToWebhook", "typeVersion": 1.1, "position": [3200, -160],
   "id": "67ffff0000000000000000000000000000ef"[:36], "name": "Respond"},

  {"parameters": {"respondWith": "allIncomingItems", "options": {}},
   "type": "n8n-nodes-base.respondToWebhook", "typeVersion": 1.1, "position": [1600, 200],
   "id": "68aaaa1111000000000000000000000000ab"[:36], "name": "Respond block"},
]

wf1_conn = {
  "Webhook": {"main": [[{"node": "Load client", "type": "main", "index": 0}]]},
  "Load client": {"main": [[{"node": "Load counts", "type": "main", "index": 0}]]},
  "Load counts": {"main": [[{"node": "Meta change history", "type": "main", "index": 0}]]},
  "Meta change history": {"main": [[{"node": "Gates", "type": "main", "index": 0}]]},
  "Gates": {"main": [[{"node": "Passed?", "type": "main", "index": 0}]]},
  "Passed?": {"main": [
      [{"node": "Read entities", "type": "main", "index": 0}],
      [{"node": "Log gate block", "type": "main", "index": 0}]]},
  "Log gate block": {"main": [[{"node": "Respond blocked", "type": "main", "index": 0}]]},
  "Respond blocked": {"main": [[{"node": "Respond block", "type": "main", "index": 0}]]},
  "Read entities": {"main": [[{"node": "Read adset context", "type": "main", "index": 0}]]},
  "Read adset context": {"main": [[{"node": "Read audiences", "type": "main", "index": 0}]]},
  "Read audiences": {"main": [[{"node": "Exclusion checks", "type": "main", "index": 0}]]},
  "Exclusion checks": {"main": [[{"node": "Exclusions passed?", "type": "main", "index": 0}]]},
  "Exclusions passed?": {"main": [
      [{"node": "Norbert prompt", "type": "main", "index": 0}],
      [{"node": "Log gate block", "type": "main", "index": 0}]]},
  "Norbert prompt": {"main": [[{"node": "Norbert", "type": "main", "index": 0}]]},
  "Norbert": {"main": [[{"node": "Parse Norbert + meter", "type": "main", "index": 0}]]},
  "Parse Norbert + meter": {"main": [[{"node": "Meter Norbert", "type": "main", "index": 0}]]},
  "Meter Norbert": {"main": [[{"node": "Stage SQL", "type": "main", "index": 0}]]},
  "Stage SQL": {"main": [[{"node": "Insert session", "type": "main", "index": 0}]]},
  "Insert session": {"main": [[{"node": "Moves SQL", "type": "main", "index": 0}]]},
  "Moves SQL": {"main": [[{"node": "Insert moves", "type": "main", "index": 0}]]},
  "Insert moves": {"main": [[{"node": "Respond staged", "type": "main", "index": 0}]]},
  "Respond staged": {"main": [[{"node": "Respond", "type": "main", "index": 0}]]},
}

wf1 = {"name": "BERNARD_optimise", "nodes": wf1_nodes, "connections": wf1_conn,
       "settings": {"executionOrder": "v1"}}

# ========================= WORKFLOW 2: BERNARD_optimise_execute =============
wf2_nodes = [
  {"parameters": {"httpMethod": "POST", "path": "bernard-optimise-execute",
                  "authentication": "headerAuth", "responseMode": "responseNode", "options": {}},
   "type": "n8n-nodes-base.webhook", "typeVersion": 2, "position": [0, 0],
   "id": "70aaaa0000000000000000000000000000ab"[:36], "name": "Webhook", "credentials": HOOK},

  pg("Load move",
     """select om.*, os.account_id, c.slug as client_slug,
       (c.config->'bernard'->'optimise'->>'daily_ceiling')::int as ceiling,
       (select count(*) from optimise_moves x where x.client_id = om.client_id
          and x.status = 'executed' and x.executed_at::date = now()::date) as executed_today
from optimise_moves om
join optimise_sessions os on os.id = om.session_id
join clients c on c.id = om.client_id
where om.id = '{{ $json.body.move_id.replace(/[^0-9a-f-]/g, "") }}'::uuid;""",
     [200, 0]),

  code("Decide", r"""
const body = $('Webhook').first().json.body;
const m = $input.first().json;
const esc = (s) => String(s).replace(/'/g, "''");
if (!m || !m.id) return [{ json: { route: 'error', error: 'move not found' } }];
if (m.status !== 'proposed') return [{ json: { route: 'error', error: 'move is ' + m.status + ', not proposed' } }];

if (body.decision === 'reject') {
  const reason = esc(body.reason || 'founder rejected');
  return [{ json: { route: 'reject', move: m, sql:
`update optimise_moves set status='rejected', decided_at=now(), decided_reason='${reason}' where id='${m.id}'::uuid;
insert into move_snapshots (task_id, client_id, build_ref, op_name, entity_type, entity_id, move_class, reason, snapshot, taken_at)
values (NULL, '${m.client_id}'::uuid, NULL, NULL, '${m.entity_type}', '${esc(m.entity_id)}', 'rejected', '${reason}',
  jsonb_build_object('op','${m.op}','from',${m.from_value ? "'" + JSON.stringify(m.from_value).replace(/'/g, "''") + "'::jsonb" : 'NULL'},'to','${JSON.stringify(m.to_value).replace(/'/g, "''")}'::jsonb,'evidence','${esc(m.evidence)}','norbert_q1',${m.norbert_q1 ? "'" + esc(m.norbert_q1) + "'" : 'NULL'}),
  now());` } }];
}
if (body.decision !== 'approve') return [{ json: { route: 'error', error: 'decision must be approve or reject' } }];
if (Number(m.executed_today) >= Number(m.ceiling || 3))
  return [{ json: { route: 'error', error: 'daily ceiling reached between staging and approval; re-dispatch tomorrow' } }];

// v1.1: an exclusion is not a field PATCH but a read-merge-write on the whole
// targeting object (Meta's targeting spec is replace-not-merge), so it takes
// its own leg with a fresh pre-write read and a full-object diff.
if (m.op === 'audience_exclude') {
  const audienceId = String((m.to_value || {}).audience_id || '');
  if (!/^\d{6,}$/.test(audienceId))
    return [{ json: { route: 'error', error: 'audience_exclude move ' + m.id + ' carries no audience_id in to_value; refusing' } }];
  return [{ json: { route: 'approve_exclude', move: m, entity_id: m.entity_id, audience_id: audienceId } }];
}

// Build the ONE Meta write this approval authorises.
const params = m.op === 'budget'
  ? { daily_budget: Number((m.to_value || {}).daily_budget_minor) }
  : { status: m.op === 'pause' ? 'PAUSED' : 'ACTIVE' };
return [{ json: { route: 'approve', move: m, entity_id: m.entity_id, write_params: params,
  readback_field: m.op === 'budget' ? 'daily_budget' : 'status' } }];
""", [400, 0]),

  {"parameters": {"rules": {"values": [
      {"conditions": {"options": {"caseSensitive": True, "typeValidation": "loose", "version": 3},
        "conditions": [{"id": "r1", "leftValue": "={{ $json.route }}", "rightValue": "approve",
                        "operator": {"type": "string", "operation": "equals"}}], "combinator": "and"},
       "outputKey": "approve"},
      {"conditions": {"options": {"caseSensitive": True, "typeValidation": "loose", "version": 3},
        "conditions": [{"id": "r2", "leftValue": "={{ $json.route }}", "rightValue": "reject",
                        "operator": {"type": "string", "operation": "equals"}}], "combinator": "and"},
       "outputKey": "reject"},
      {"conditions": {"options": {"caseSensitive": True, "typeValidation": "loose", "version": 3},
        "conditions": [{"id": "r3", "leftValue": "={{ $json.route }}", "rightValue": "approve_exclude",
                        "operator": {"type": "string", "operation": "equals"}}], "combinator": "and"},
       "outputKey": "approve_exclude"}]},
    "options": {"fallbackOutput": "extra"}},
   "type": "n8n-nodes-base.switch", "typeVersion": 3, "position": [600, 0],
   "id": "71bbbb0000000000000000000000000000cd"[:36], "name": "Route"},

  # approve leg
  {"parameters": {"method": "POST", "url": "=https://graph.facebook.com/v23.0/{{ $json.entity_id }}",
                  "authentication": "genericCredentialType", "genericAuthType": "httpQueryAuth",
                  "sendBody": True, "specifyBody": "json",
                  "jsonBody": "={{ JSON.stringify($json.write_params) }}", "options": {}},
   "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.2, "position": [800, -120],
   "id": "72cccc0000000000000000000000000000ef"[:36], "name": "Meta write", "credentials": META},

  {"parameters": {"url": "=https://graph.facebook.com/v23.0/{{ $('Decide').first().json.entity_id }}?fields={{ $('Decide').first().json.readback_field === 'daily_budget' ? 'id,daily_budget' : 'id,status,effective_status' }}",
                  "authentication": "genericCredentialType", "genericAuthType": "httpQueryAuth", "options": {}},
   "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.2, "position": [1000, -120],
   "id": "73dddd0000000000000000000000000000ab"[:36], "name": "Read back", "credentials": META,
   "notes": "Claimed is not true until read. A 200 that reads back unchanged is verification_failed."},

  code("Verify + finalise", r"""
const d = $('Decide').first().json;
const m = d.move;
const now = $input.first().json;
const esc = (s) => String(s).replace(/'/g, "''");
let okWrite = false;
if (m.op === 'budget') okWrite = String(now.daily_budget) === String((m.to_value || {}).daily_budget_minor);
else if (m.op === 'pause') okWrite = now.status === 'PAUSED';
else okWrite = now.status === 'ACTIVE';
const status = okWrite ? 'executed' : 'verification_failed';
const snapClass = okWrite ? 'executed' : 'died';
const reason = okWrite ? null : ('read-back mismatch: wanted ' + JSON.stringify(d.write_params) + ', account shows ' + JSON.stringify(now));
// The Postgres node hands timestamptz columns over as JS Dates; interpolating
// one directly yields "Wed Sep 03 2026 ... GMT+0000 (Coordinated Universal
// Time)", which Postgres rejects. Found by the glue smoke in --db mode.
const stagedAt = new Date(m.created_at).toISOString();
const sql =
`update optimise_moves set status='${status}', decided_at=now(), executed_at=${okWrite ? 'now()' : 'NULL'} where id='${m.id}'::uuid;
insert into move_snapshots (task_id, client_id, build_ref, op_name, entity_type, entity_id, move_class, reason, snapshot, taken_at, executed_at)
values (NULL, '${m.client_id}'::uuid, NULL, NULL, '${m.entity_type}', '${esc(m.entity_id)}', '${snapClass}', ${reason ? "'" + esc(reason) + "'" : 'NULL'},
  jsonb_build_object('op','${m.op}','from','${JSON.stringify(m.from_value).replace(/'/g, "''")}'::jsonb,'to','${JSON.stringify(m.to_value).replace(/'/g, "''")}'::jsonb,
    'evidence','${esc(m.evidence)}','read_back','${JSON.stringify(now).replace(/'/g, "''")}'::jsonb,'norbert_q1',${m.norbert_q1 ? "'" + esc(m.norbert_q1) + "'" : 'NULL'}),
  '${stagedAt}'::timestamptz, ${okWrite ? 'now()' : 'NULL'});`;
return [{ json: { sql, result: { ok: okWrite, move_id: m.id, status, read_back: now } } }];
""", [1200, -120], note="taken_at carries the STAGING time so the 12h staleness rule is computable."),

  pg("Write outcome", "={{ $json.sql }}", [1400, -120]),

  code("Respond approve", r"""
// The approve leg and the v1.1 exclusion leg converge here; isExecuted picks
// whichever verifier actually ran.
const v = $('Verify exclusion').isExecuted
  ? $('Verify exclusion').first().json
  : $('Verify + finalise').first().json;
return [{ json: v.result }];
""", [1600, -120]),

  # ----- v1.1 exclusion leg: read, snapshot, merge, write, read back, diff.
  {"parameters": {"url": "=https://graph.facebook.com/v23.0/{{ $('Decide').first().json.entity_id }}?fields=id,targeting",
                  "authentication": "genericCredentialType", "genericAuthType": "httpQueryAuth", "options": {}},
   "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.2, "position": [800, -320],
   "id": "72cccc1111000000000000000000000000f1"[:36], "name": "Read targeting", "credentials": META,
   "notes": "Fresh pre-write read: the snapshot the diff verifies against. A failure here aborts before any mutation and the move stays proposed."},

  code("Merge exclusion", r"""
// Section 3 steps 1-3: snapshot the complete targeting verbatim, merge the one
// audience id into excluded_custom_audiences, change NOTHING else. Meta's
// targeting spec is replace-not-merge, so the whole object goes back.
const d = $('Decide').first().json;
const cur = $input.first().json || {};
if (!cur.targeting) throw new Error('pre-write targeting read failed for ad set ' + d.entity_id + '; nothing was written');
const snapshot = cur.targeting;
const before = (snapshot.excluded_custom_audiences || []).map(a => ({ id: String(a.id) }));
if (before.some(a => a.id === d.audience_id))
  throw new Error('audience ' + d.audience_id + ' is already excluded on ad set ' + d.entity_id + ' at execute time (added between staging and approval); nothing was written, move stays proposed');
const newTargeting = JSON.parse(JSON.stringify(snapshot));
newTargeting.excluded_custom_audiences = before.concat([{ id: d.audience_id }]);
return [{ json: { entity_id: d.entity_id, snapshot, new_targeting: newTargeting } }];
""", [1000, -320]),

  {"parameters": {"method": "POST", "url": "=https://graph.facebook.com/v23.0/{{ $json.entity_id }}",
                  "authentication": "genericCredentialType", "genericAuthType": "httpQueryAuth",
                  "sendBody": True, "specifyBody": "json",
                  "jsonBody": "={{ JSON.stringify({ targeting: $json.new_targeting }) }}", "options": {}},
   "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.2, "position": [1200, -320],
   "id": "72cccc2222000000000000000000000000f2"[:36], "name": "Write targeting", "credentials": META},

  {"parameters": {"url": "=https://graph.facebook.com/v23.0/{{ $('Decide').first().json.entity_id }}?fields=id,targeting",
                  "authentication": "genericCredentialType", "genericAuthType": "httpQueryAuth", "options": {}},
   "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.2, "position": [1400, -320],
   "id": "73dddd1111000000000000000000000000f3"[:36], "name": "Read back targeting", "credentials": META,
   "notes": "Section 3 step 5. The diff in Verify exclusion is the acceptance test: a 200 proves nothing."},

  code("Verify exclusion", VERIFY_EXCLUSION_FN + r"""
const d = $('Decide').first().json;
const m = d.move;
const pre = $('Merge exclusion').first().json;
const now = $input.first().json || {};
const esc = (s) => String(s).replace(/'/g, "''");
const jstr = (o) => JSON.stringify(o).replace(/'/g, "''");
const snap = pre.snapshot;
const rb = now.targeting || {};
const problems = verifyExclusionDiff(snap, now.targeting, d.audience_id);
const okWrite = problems.length === 0;
const status = okWrite ? 'executed' : 'verification_failed';
const snapClass = okWrite ? 'executed' : 'died';
const reason = okWrite ? null : ('targeting diff vs snapshot failed: ' + problems.join(' | ').slice(0, 1500));
// created_at arrives as a JS Date from the Postgres node; see Verify + finalise.
const stagedAt = new Date(m.created_at).toISOString();
const sql =
`update optimise_moves set status='${status}', decided_at=now(), executed_at=${okWrite ? 'now()' : 'NULL'} where id='${m.id}'::uuid;
insert into move_snapshots (task_id, client_id, build_ref, op_name, entity_type, entity_id, move_class, reason, snapshot, taken_at, executed_at)
values (NULL, '${m.client_id}'::uuid, NULL, NULL, 'adset', '${esc(m.entity_id)}', '${snapClass}', ${reason ? "'" + esc(reason) + "'" : 'NULL'},
  jsonb_build_object('op','audience_exclude','audience_id','${esc(d.audience_id)}',
    'targeting_before','${jstr(snap)}'::jsonb,'targeting_read_back','${jstr(rb)}'::jsonb,
    'evidence','${esc(m.evidence)}','norbert_q1',${m.norbert_q1 ? "'" + esc(m.norbert_q1) + "'" : 'NULL'}),
  '${stagedAt}'::timestamptz, ${okWrite ? 'now()' : 'NULL'});`;
// `got` is local to verifyExclusionDiff; referencing it here crashed every
// execute run on 26 August AFTER the Meta write and before any recording,
// which is the worst half to lose. Compute the list from rb, which is in scope.
return [{ json: { sql, result: { ok: okWrite, move_id: m.id, status, problems, read_back_exclusions: (rb.excluded_custom_audiences || []).map(x => String(x.id)) } } }];
""", [1600, -320], note="The pre-write snapshot goes into move_snapshots VERBATIM; a partial-payload bug shows up here as verification_failed, never as silent success."),

  # reject leg
  pg("Write rejection", "={{ $json.sql }}", [800, 120]),
  code("Respond reject", "return [{ json: { ok: true, move_id: $('Decide').first().json.move.id, status: 'rejected' } }];", [1000, 120]),

  # error leg
  code("Respond error", "return [{ json: { ok: false, error: $json.error } }];", [800, 300]),

  {"parameters": {"respondWith": "allIncomingItems", "options": {}},
   "type": "n8n-nodes-base.respondToWebhook", "typeVersion": 1.1, "position": [1800, 0],
   "id": "74eeee0000000000000000000000000000cd"[:36], "name": "Respond"},
]

wf2_conn = {
  "Webhook": {"main": [[{"node": "Load move", "type": "main", "index": 0}]]},
  "Load move": {"main": [[{"node": "Decide", "type": "main", "index": 0}]]},
  "Decide": {"main": [[{"node": "Route", "type": "main", "index": 0}]]},
  "Route": {"main": [
      [{"node": "Meta write", "type": "main", "index": 0}],
      [{"node": "Write rejection", "type": "main", "index": 0}],
      [{"node": "Read targeting", "type": "main", "index": 0}],
      [{"node": "Respond error", "type": "main", "index": 0}]]},
  "Meta write": {"main": [[{"node": "Read back", "type": "main", "index": 0}]]},
  "Read back": {"main": [[{"node": "Verify + finalise", "type": "main", "index": 0}]]},
  "Verify + finalise": {"main": [[{"node": "Write outcome", "type": "main", "index": 0}]]},
  "Read targeting": {"main": [[{"node": "Merge exclusion", "type": "main", "index": 0}]]},
  "Merge exclusion": {"main": [[{"node": "Write targeting", "type": "main", "index": 0}]]},
  "Write targeting": {"main": [[{"node": "Read back targeting", "type": "main", "index": 0}]]},
  "Read back targeting": {"main": [[{"node": "Verify exclusion", "type": "main", "index": 0}]]},
  "Verify exclusion": {"main": [[{"node": "Write outcome", "type": "main", "index": 0}]]},
  "Write outcome": {"main": [[{"node": "Respond approve", "type": "main", "index": 0}]]},
  "Respond approve": {"main": [[{"node": "Respond", "type": "main", "index": 0}]]},
  "Write rejection": {"main": [[{"node": "Respond reject", "type": "main", "index": 0}]]},
  "Respond reject": {"main": [[{"node": "Respond", "type": "main", "index": 0}]]},
  "Respond error": {"main": [[{"node": "Respond", "type": "main", "index": 0}]]},
}

wf2 = {"name": "BERNARD_optimise_execute", "nodes": wf2_nodes, "connections": wf2_conn,
       "settings": {"executionOrder": "v1"}}

json.dump(wf1, open(os.path.join(OUT, "wf_optimise.json"), "w"), indent=1)
json.dump(wf2, open(os.path.join(OUT, "wf_execute.json"), "w"), indent=1)
# The gates function alone, for the test suite.
open(os.path.join(OUT, "gates.extracted.js"), "w").write(
    GATES_FN + "\nmodule.exports = runGates;\n")
# The v1.1 verify-diff function alone, for its test suite.
open(os.path.join(OUT, "verify-exclusion.extracted.js"), "w").write(
    VERIFY_EXCLUSION_FN + "\nmodule.exports = verifyExclusionDiff;\n")
print("wrote wf_optimise.json, wf_execute.json, gates.extracted.js, verify-exclusion.extracted.js")

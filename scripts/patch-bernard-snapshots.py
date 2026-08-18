import json
S='/private/tmp/claude-501/-Users-singularwebmacmini1-Documents-Rexos/e62c54fd-f7d4-4840-a05c-5fa8a6ecc004/scratchpad'
w=json.load(open(S+'/bb.json'))
n={x['name']:x for x in w['nodes']}
PG = n['Log task']['credentials']

COMMON = r"""
// Shared shape for a decision-time snapshot. Code brief item 1.1.
//
// WHAT IS DELIBERATELY NULL. The brief asks for pacing, frequency, creative age,
// learning-phase status and budget utilisation. Those describe an entity that
// already exists and has been delivering. Bernard only BUILDS today, so at the
// moment he decides, the entity does not exist and those numbers are undefined
// rather than zero. Recording zeroes would look like instrumentation and would
// poison anything later fitted on it, so the field is null with the reason
// beside it. It populates unchanged the day Bernard gains optimisation moves.
function snapshotFor(plan, extra) {
  const spec = plan.spec || {};
  const campaigns = Array.isArray(spec.campaigns) ? spec.campaigns : [];
  return Object.assign({
    account_id: plan.account_id || null,
    client_slug: plan.client_slug || null,
    build_ref: plan.build_ref || null,
    planned_at: plan.planned_at || null,
    write_budget: {
      op_count: plan.op_count ?? null,
      budget_capped: plan.budget_capped ?? null
    },
    gates_checked: plan.gates_checked ?? null,
    spec_digest: {
      campaign_count: campaigns.length,
      objectives: campaigns.map(c => c.objective).filter(Boolean),
      adset_count: campaigns.reduce((a, c) => a + ((c.adsets || []).length), 0),
      daily_budgets_minor: campaigns.flatMap(c =>
        (c.adsets || []).map(a => a.daily_budget ?? null)).filter(v => v !== null)
    },
    optimisation_state: null,
    optimisation_state_absent_because:
      'build move: the entity did not exist at decision time, so pacing, frequency, ' +
      'creative age, learning status and budget utilisation are undefined, not zero'
  }, extra || {});
}
const esc = (s) => String(s).replace(/'/g, "''");
"""

EXEC = COMMON + r"""
// One row per operation in the build, written AFTER read-back has settled what
// actually exists, so entity_id and move_class reflect reality rather than the
// batch response. recent_change_count_7d is computed in SQL to avoid a round trip.
const plan = $('Plan batch').first().json;
const verified = $('Verify build').first().json;
const taskId = $input.first().json.id || null;

const created = verified.created || [];
const problems = verified.problems || [];
const byOp = {};
created.forEach(c => { byOp[c.op] = c; });

const rows = (plan.batch || []).map(op => {
  const hit = byOp[op.name];
  const type = op.relative_url.endsWith('/campaigns') ? 'campaign'
             : op.relative_url.endsWith('/adsets') ? 'adset' : 'ad';
  const problem = problems.find(p => (p.op || p.name) === op.name);
  return {
    op_name: op.name,
    entity_type: type,
    entity_id: hit ? hit.id : null,
    move_class: hit ? 'executed' : 'died',
    reason: hit ? null : (problem ? (problem.message || JSON.stringify(problem)).slice(0, 400)
                                  : 'not present on the account after read-back'),
    snapshot: snapshotFor(plan, { move: { op: op.name, type, depends_on: op.depends_on || null } })
  };
});
if (!rows.length) return [{ json: { sql: "select 'no-ops' as note;" } }];

const clientId = plan.client_id;
const recent = "(select count(*) from tasks where client_id = '" + esc(clientId) +
  "'::uuid and created_at > now() - interval '7 days')";

const values = rows.map(r =>
  "(" + (taskId ? "'" + esc(taskId) + "'::uuid" : 'NULL') + "," +
  "'" + esc(clientId) + "'::uuid," +
  (plan.build_ref ? "'" + esc(plan.build_ref) + "'" : 'NULL') + "," +
  "'" + esc(r.op_name) + "'," +
  "'" + esc(r.entity_type) + "'," +
  (r.entity_id ? "'" + esc(r.entity_id) + "'" : 'NULL') + "," +
  "'" + esc(r.move_class) + "'," +
  (r.reason ? "'" + esc(r.reason) + "'" : 'NULL') + "," +
  "'" + esc(JSON.stringify(r.snapshot)) + "'::jsonb || jsonb_build_object('recent_change_count_7d', " + recent + ")," +
  "'" + esc(plan.planned_at) + "'::timestamptz," +
  (r.move_class === 'executed' ? 'now()' : 'NULL') +
  ")"
).join(',\n  ');

return [{ json: { sql:
  "insert into move_snapshots (task_id, client_id, build_ref, op_name, entity_type, entity_id, move_class, reason, snapshot, taken_at, executed_at) values\n  " +
  values + ";" } }];
"""

CF = COMMON + r"""
// The counterfactual leg. Everything that reaches here was PROPOSED and did not
// execute: a pre-flight gate hold, an invalid spec, or a duplicate-name refusal.
// Until now these were indistinguishable from noise in the logs, which is
// exactly what the brief asks to end. They are the honest comparison set for
// grading later, because a move that never ran is the closest thing we have to
// a control.
const plan = $('Plan batch').first().json;
const clientId = plan.client_id || null;

// Plan batch returns ok:false with a reason when it refuses; the dup gate
// refuses after it. Distinguish, because "we blocked it" and "it was already
// there" are different facts about the same non-event.
const planFailed = plan.ok === false;
const moveClass = planFailed ? 'gate_blocked' : 'died';
const reason = (plan.error || plan.reason || $input.first().json.error ||
                'refused before execution').toString().slice(0, 400);

if (!clientId) return [{ json: { sql: "select 'no-client' as note;" } }];

const snap = snapshotFor(plan, { move: null, refused_at: new Date().toISOString() });
const recent = "(select count(*) from tasks where client_id = '" + esc(clientId) +
  "'::uuid and created_at > now() - interval '7 days')";

return [{ json: { sql:
  "insert into move_snapshots (task_id, client_id, build_ref, op_name, entity_type, entity_id, move_class, reason, snapshot, taken_at) values (" +
  "NULL,'" + esc(clientId) + "'::uuid," +
  (plan.build_ref ? "'" + esc(plan.build_ref) + "'" : 'NULL') + "," +
  "NULL,NULL,NULL,'" + moveClass + "','" + esc(reason) + "'," +
  "'" + esc(JSON.stringify(snap)) + "'::jsonb || jsonb_build_object('recent_change_count_7d', " + recent + ")," +
  "now());" } }];
"""

def code(name, js, pos):
    return {"parameters": {"jsCode": js}, "type": "n8n-nodes-base.code",
            "typeVersion": 2, "position": pos, "id": "5na9" + name[:4].lower().ljust(4,'0') + "-0000-4000-8000-00000000000" + str(len(name)%10),
            "name": name}
def pg(name, pos, note):
    return {"parameters": {"operation": "executeQuery", "query": "={{ $json.sql }}", "options": {}},
            "type": "n8n-nodes-base.postgres", "typeVersion": 2.6, "position": pos,
            "id": "5nb9" + name[:4].lower().ljust(4,'0') + "-0000-4000-8000-00000000000" + str(len(name)%10),
            "name": name, "notes": note,
            "onError": "continueRegularOutput",   # recording must never break a build
            "credentials": PG}

w['nodes'] += [
  code("Build move snapshots", EXEC, [2200, -120]),
  pg("Write move snapshots", [2360, -120],
     "Recording only. onError=continue so a logging failure can never fail a build that succeeded."),
  code("Build counterfactual", CF, [1400, 320]),
  pg("Write counterfactual", [1560, 320],
     "Recording only. onError=continue for the same reason."),
]

c = w['connections']
c['Log task']['main'][0] = [{"node": "Build move snapshots", "type": "main", "index": 0}]
c['Build move snapshots'] = {"main": [[{"node": "Write move snapshots", "type": "main", "index": 0}]]}
c['Write move snapshots'] = {"main": [[{"node": "Log steps", "type": "main", "index": 0}]]}
c['Log rejected']['main'][0] = [{"node": "Build counterfactual", "type": "main", "index": 0}]
c['Build counterfactual'] = {"main": [[{"node": "Write counterfactual", "type": "main", "index": 0}]]}
c['Write counterfactual'] = {"main": [[{"node": "Respond rejected", "type": "main", "index": 0}]]}

out = {"name": w['name'], "nodes": w['nodes'], "connections": c, "settings": w['settings']}
json.dump(out, open(S+'/bb_patched.json','w'), indent=1)
print('patched:', len(w['nodes']), 'nodes')

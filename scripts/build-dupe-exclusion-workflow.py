#!/usr/bin/env python3
# Generates MAINT_dupe_exclusion_plan (Denis 5a, dry-run mode) as n8n JSON.
#
# Nightly, per Meta ad account: hash every owned CRM contact (email, phone) into
# what WOULD be one customer-list exclusion audience, read the account's audiences
# and ad sets, and post the plan: does the audience exist, how many matchable
# rows, which ad sets still lack the exclusion, what writes go-live would need.
# ZERO writes to Meta or GHL. Hashes never leave the run (counts only). Go-live
# (create the audience, upload hashes, exclude per ad set) is a separate founder
# ruling; the per-ad-set exclusion already exists as BERNARD_optimise's
# audience_exclude move, reviewed by Norbert and approved per move.
#
# Tenants sharing an ad account pool into one audience, per the brief ("one
# exclusion audience per ad account"). Adding a tenant = add a row and redeploy.
import json, sys, os

OUT = sys.argv[1] if len(sys.argv) > 1 else "."
PG    = {"postgres": {"id": "GnLou79kcbiN5252", "name": "Supabase — singularweb-prod"}}
META  = {"httpHeaderAuth": {"id": "5cOSHv4rFTASt7iF", "name": "Meta system-user token (header)"}}
HOOK  = {"httpHeaderAuth": {"id": "L6Pw2vZt2DM7Qa8k", "name": "Bernard dispatch auth (x-bernard-key)"}}
SLACK = {"slackOAuth2Api": {"id": "TJoNm55FYZZAs4wr", "name": "Slack account"}}
ERRWF = "neKxYlJYR6c6HC2e"
AUDIENCE_NAME = "WMI | Owned contacts (exclusion)"
MATCH_FLOOR = 100  # Meta will not serve (or exclude) a customer list under ~100 matched people

# slug, GHL location id, n8n credential for that location's PIT, Meta ad account
TENANTS = [
    ("dental-mastery", "YT3zkRv2oyeo1PSUQqVR", {"httpHeaderAuth": {"id": "6NnlOqWY5qjUjOUT", "name": "GHL — DentalMastery PIT"}}, "act_1027063116856202"),
    ("wmi",            "nyLMzwmEYXnB3MAxFD7K", {"httpHeaderAuth": {"id": "YZ54SkRAo3Ud5q49", "name": "GHL_WMI_PIT"}},              "act_1027063116856202"),
]
ACCOUNT_OWNER_CLIENT_SLUG = "wmi"  # the action_log row hangs off this client

def nid(name): return ("7a" + format(abs(hash("dupe:" + name)) % 10**10, "010d") + "-0000-4000-8000-000000000000")[:36]
def code(name, js, pos, note=None):
    n = {"parameters": {"jsCode": js}, "type": "n8n-nodes-base.code", "typeVersion": 2, "position": pos, "id": nid(name), "name": name}
    if note: n["notes"] = note
    return n

nodes = [
  {"parameters": {"rule": {"interval": [{"field": "days", "daysInterval": 1, "triggerAtHour": 3, "triggerAtMinute": 15}]}},
   "type": "n8n-nodes-base.scheduleTrigger", "typeVersion": 1.2, "position": [0, -100], "id": nid("Nightly 03:15 UTC"), "name": "Nightly 03:15 UTC"},
  {"parameters": {"httpMethod": "POST", "path": "dupe-exclusion-plan-now", "authentication": "headerAuth", "responseMode": "lastNode", "options": {}},
   "type": "n8n-nodes-base.webhook", "typeVersion": 2, "position": [0, 100], "id": nid("Run now"), "name": "Run now", "credentials": HOOK},
  code("Start", "return [{ json: { started_at: new Date().toISOString(), dry_run: true } }];", [220, 0]),
]
conn = {"Nightly 03:15 UTC": {"main": [[{"node": "Start", "type": "main", "index": 0}]]},
        "Run now":           {"main": [[{"node": "Start", "type": "main", "index": 0}]]}}

prev = "Start"; x = 440
for slug, loc, cred, account in TENANTS:
    fetch = f"GHL contacts: {slug}"
    nodes.append({
      "parameters": {"url": "https://services.leadconnectorhq.com/contacts/", "authentication": "genericCredentialType", "genericAuthType": "httpHeaderAuth",
                     "sendQuery": True, "queryParameters": {"parameters": [{"name": "locationId", "value": loc}, {"name": "limit", "value": "100"}]},
                     "sendHeaders": True, "headerParameters": {"parameters": [{"name": "Version", "value": "2021-07-28"}]},
                     "options": {"pagination": {"pagination": {"paginationMode": "updateAParameterInEachRequest",
                                   "parameters": {"parameters": [{"type": "qs", "name": "startAfterId", "value": "={{ $response.body.meta.startAfterId }}"},
                                                                 {"type": "qs", "name": "startAfter", "value": "={{ $response.body.meta.startAfter }}"}]},
                                   "paginationCompleteWhen": "other", "completeExpression": "={{ !$response.body.meta || !$response.body.meta.startAfterId }}",
                                   "limitPagesFetched": True, "maxRequests": 500}}}},
      "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.2, "position": [x, 0], "id": nid(fetch), "name": fetch, "credentials": cred,
      "onError": "continueRegularOutput",
      "notes": "Read only. Pages of 100 via startAfterId until the API stops returning one."})
    hsh = f"Hash: {slug}"
    nodes.append(code(hsh, f"""
// Meta customer-file normalisation, then SHA-256. Only COUNTS leave this node;
// the hashes stay in memory for the run and are never logged or stored.
const crypto = require('crypto');
const pages = $input.all().map(i => i.json);
let contacts = [];
let readError = null;
for (const p of pages) {{
  if (p.error || p.message && !p.contacts) readError = String(p.message || JSON.stringify(p.error)).slice(0, 200);
  if (Array.isArray(p.contacts)) contacts = contacts.concat(p.contacts);
}}
const h = (v) => crypto.createHash('sha256').update(v).digest('hex');
const emails = new Set(), phones = new Set();
for (const c of contacts) {{
  const em = String(c.email || '').trim().toLowerCase();
  if (em && em.includes('@')) emails.add(h(em));
  let ph = String(c.phone || '').replace(/\\D/g, '');
  if (ph.length >= 10) phones.add(h(ph));
}}
return [{{ json: {{ tenant: '{slug}', location_id: '{loc}', account_id: '{account}',
  contacts_total: contacts.length, emails_hashed: emails.size, phones_hashed: phones.size,
  read_error: readError, _emails: [...emails], _phones: [...phones] }} }}];
""", [x + 220, 0]))
    conn[prev] = {"main": [[{"node": fetch, "type": "main", "index": 0}]]}
    conn[fetch] = {"main": [[{"node": hsh, "type": "main", "index": 0}]]}
    prev = hsh; x += 440

accounts = sorted({t[3] for t in TENANTS})
assert len(accounts) == 1, "v1 handles one ad account; extend the chain per account"
ACCT = accounts[0]
nodes += [
  {"parameters": {"url": f"https://graph.facebook.com/v23.0/{ACCT}/customaudiences?fields=id,name,subtype,approximate_count_lower_bound,delivery_status&limit=200",
                  "authentication": "genericCredentialType", "genericAuthType": "httpHeaderAuth", "options": {}},
   "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.2, "position": [x, 0], "id": nid("Meta audiences"), "name": "Meta audiences", "credentials": META, "onError": "continueRegularOutput"},
  {"parameters": {"url": f"https://graph.facebook.com/v23.0/{ACCT}/adsets?fields=id,name,effective_status,campaign{{name}},targeting&limit=200",
                  "authentication": "genericCredentialType", "genericAuthType": "httpHeaderAuth", "options": {}},
   "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.2, "position": [x + 220, 0], "id": nid("Meta ad sets"), "name": "Meta ad sets", "credentials": META, "onError": "continueRegularOutput"},
  code("Plan", f"""
// Dry run: what go-live WOULD do, with zero writes. Hashes are pooled across
// tenants sharing the account, deduplicated, counted, and discarded.
const tenants = {json.dumps([f"Hash: {t[0]}" for t in TENANTS])}.map(n => $(n).first().json);
const aud = $('Meta audiences').first().json || {{}};
const ads = $('Meta ad sets').first().json || {{}};
const emails = new Set(), phones = new Set();
for (const t of tenants) {{ for (const e of t._emails || []) emails.add(e); for (const p of t._phones || []) phones.add(p); }}
const rows = emails.size + phones.size;
const existing = (aud.data || []).find(a => a.name === '{AUDIENCE_NAME}') || null;
const adsets = (ads.data || []).filter(a => !['DELETED', 'ARCHIVED'].includes(a.effective_status));
const lacking = adsets.filter(a => !((a.targeting || {{}}).excluded_custom_audiences || []).some(x => existing && String(x.id) === String(existing.id)))
  .map(a => ({{ id: a.id, name: a.name, campaign: (a.campaign || {{}}).name || null, status: a.effective_status }}));
const readErrors = [];
if (aud.error) readErrors.push('audiences: ' + JSON.stringify(aud.error).slice(0, 160));
if (ads.error) readErrors.push('adsets: ' + JSON.stringify(ads.error).slice(0, 160));
for (const t of tenants) if (t.read_error) readErrors.push(t.tenant + ' contacts: ' + t.read_error);
const belowFloor = rows < {MATCH_FLOOR};
const wouldWrite = [];
if (!existing) wouldWrite.push('create customer-list audience "{AUDIENCE_NAME}" on {ACCT} (subtype CUSTOM, customer_file_source USER_PROVIDED_ONLY)');
wouldWrite.push('upload ' + rows + ' hashed rows (EMAIL_SHA256 ' + emails.size + ', PHONE_SHA256 ' + phones.size + ') to the audience, replace mode');
for (const a of lacking) wouldWrite.push('BERNARD_optimise audience_exclude on ad set ' + a.id + ' (' + a.name + ')');
const verdict = readErrors.length ? 'READ ERRORS, plan incomplete'
  : belowFloor ? 'BELOW FLOOR: ' + rows + ' matchable rows, Meta needs about {MATCH_FLOOR}; nothing to do yet'
  : existing ? (lacking.length ? lacking.length + ' ad set(s) lack the exclusion' : 'all ad sets excluded; upload refresh only')
  : 'audience does not exist yet; create, upload, then exclude ' + lacking.length + ' ad set(s)';
const plan = {{ dry_run: true, account_id: '{ACCT}', audience_name: '{AUDIENCE_NAME}', audience_existing: existing ? {{ id: existing.id, lower_bound: existing.approximate_count_lower_bound, delivery: (existing.delivery_status || {{}}).code }} : null,
  tenants: tenants.map(t => ({{ tenant: t.tenant, contacts: t.contacts_total, emails: t.emails_hashed, phones: t.phones_hashed, read_error: t.read_error }})),
  matchable_rows: rows, match_floor: {MATCH_FLOOR}, below_floor: belowFloor,
  adsets_live: adsets.length, adsets_lacking_exclusion: lacking, would_write: wouldWrite, read_errors: readErrors, verdict }};
const esc = (s) => String(s).replace(/'/g, "''");
const sql = `insert into action_log (client_id, workflow, step, tool, status, output_ref)
select id, 'MAINT_dupe_exclusion_plan', 'plan', 'meta_customaudience', '${{readErrors.length ? 'failed' : 'skipped'}}', '${{esc(JSON.stringify(plan))}}'
from clients where slug = '{ACCOUNT_OWNER_CLIENT_SLUG}';`;
const slack = ':shield: *Dupe-exclusion audience, dry run* (' + '{ACCT}' + ')\\n' + verdict + '\\n'
  + 'Owned contacts: ' + tenants.map(t => t.tenant + ' ' + t.contacts_total).join(', ') + ' | matchable rows ' + rows + ' (floor {MATCH_FLOOR})\\n'
  + 'Audience: ' + (existing ? 'exists (' + existing.id + ')' : 'not created') + ' | live ad sets ' + adsets.length + ', lacking exclusion ' + lacking.length + '\\n'
  + (readErrors.length ? ':warning: ' + readErrors.join(' | ') + '\\n' : '') + 'Zero writes. Go-live is a founder ruling.';
return [{{ json: {{ plan, sql, slack }} }}];
""", [x + 440, 0], note="Dry run only. Hashes discarded here; only counts persist."),
  {"parameters": {"operation": "executeQuery", "query": "={{ $json.sql }}", "options": {}},
   "type": "n8n-nodes-base.postgres", "typeVersion": 2.6, "position": [x + 660, 0], "id": nid("Log plan"), "name": "Log plan", "credentials": PG, "onError": "continueRegularOutput"},
  {"parameters": {"authentication": "oAuth2", "select": "channel", "channelId": {"__rl": True, "value": "#alerts", "mode": "name"},
                  "text": "={{ $('Plan').first().json.slack }}", "otherOptions": {}},
   "type": "n8n-nodes-base.slack", "typeVersion": 2.2, "position": [x + 880, 0], "id": nid("Post plan"), "name": "Post plan", "credentials": SLACK, "onError": "continueRegularOutput"},
  code("Respond", "return [{ json: $('Plan').first().json.plan }];", [x + 1100, 0]),
]
conn[prev] = {"main": [[{"node": "Meta audiences", "type": "main", "index": 0}]]}
conn["Meta audiences"] = {"main": [[{"node": "Meta ad sets", "type": "main", "index": 0}]]}
conn["Meta ad sets"] = {"main": [[{"node": "Plan", "type": "main", "index": 0}]]}
conn["Plan"] = {"main": [[{"node": "Log plan", "type": "main", "index": 0}]]}
conn["Log plan"] = {"main": [[{"node": "Post plan", "type": "main", "index": 0}]]}
conn["Post plan"] = {"main": [[{"node": "Respond", "type": "main", "index": 0}]]}

wf = {"name": "MAINT_dupe_exclusion_plan", "nodes": nodes, "connections": conn,
      "settings": {"executionOrder": "v1", "errorWorkflow": ERRWF}}
json.dump(wf, open(os.path.join(OUT, "wf_dupe_exclusion.json"), "w"), indent=1)
print("wrote wf_dupe_exclusion.json:", len(nodes), "nodes")

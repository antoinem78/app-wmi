// EXTRACTED VERBATIM from the live BERNARD_build 'Parse batch' node, 2026-08-12.
// Do not edit by hand. Re-extract from n8n so the tests always run against what
// is deployed, never against a copy that has drifted from it.
module.exports = function parseBatch($planFirst, $inputAll) {
  const $ = (name) => ({ first: () => ({ json: $planFirst }), all: () => $inputAll });
  const $input = { all: () => $inputAll };
// Parse the Graph batch response: one element per operation, in request order.
  //
  // Error-capture rules, learned from 6 failed builds whose task records carried
  // 'code null {}' and bare 'Invalid parameter' (triaged 2026-07-31):
  //   1. Graph returns a NULL element for any op whose dependency failed. That is
  //      a cascade marker, not an error: record it as skipped, name the culprit.
  //   2. Meta's actionable text lives in error_user_msg / error_user_title and
  //      error_data (blame fields), not in error.message. Capture all of them,
  //      plus fbtrace_id for Meta support.
  //   3. If the whole batch request fails (OAuth, transport), the response is a
  //      single {error:{...}} OBJECT, not an array. Detect it and mark every op
  //      not_attempted rather than smearing the object across element slots.
  //   4. An EMPTY slot is not a failure, it is an open question. Rule 4 was written
  //      on 2026-07-31 as "never store an empty {} as an error" but never actually
  //      implemented, and the gap cost us. Meta can return an empty element for an
  //      operation that SUCCEEDED: across the Atelier Brunos relaunch on 2026-08-05
  //      every campaign create came back '{}' and was scored
  //      'op c0 (campaign) failed: null/null {}', while the campaign existed on the
  //      account every time. Five rounds, five real campaigns, four of them orphan
  //      shells nobody knew were there, because each retry believed the last had
  //      built nothing. The r6 record refutes itself on its own face: ad set as0_0
  //      depended on c0 and was created, which is only possible if c0 returned an
  //      id to the batch.
  //      So: a slot carrying neither an id nor an error is UNRESOLVED, never failed.
  //      It is passed to 'Verify build', which settles it by reading Meta. A build
  //      is scored against what is on the account, not against what the batch said.
  const plan = $('Plan batch').first().json;
  const raw = $input.all().map(i => i.json);
  const typeFor = (op) => op.relative_url.endsWith('/campaigns') ? 'campaign'
                        : op.relative_url.endsWith('/adsets') ? 'adset' : 'ad';
  const decodeBody = (op) => { try { return decodeURIComponent(op.body); } catch (e) { return String(op.body); } };
  const reqSummary = (op) => ({ url: op.relative_url, depends_on: op.depends_on || null,
    body: decodeBody(op).slice(0, 220) });
  // The name we asked Meta to give the entity. This is the search key when an
  // unresolved op has to be found on the account by read-back.
  const intendedName = (op) => { try { return new URLSearchParams(op.body).get('name'); } catch (e) { return null; } };
  
  // Rule 3: top-level failure. A batch response is an array; a bare object with
  // .error and no .body is the request itself failing before any op ran.
  const top = raw.length === 1 && raw[0] && raw[0].error && raw[0].body === undefined && !Array.isArray(raw[0])
    ? raw[0].error : null;
  if (top) {
    const errors = plan.batch.map(op => ({ op: op.name, type: typeFor(op),
      code: top.code ?? null, subcode: top.error_subcode ?? null, stage: 'transport',
      message: 'batch request failed before any operation ran: ' + (top.message || JSON.stringify(top).slice(0, 200)),
      fbtrace_id: top.fbtrace_id || null, request: reqSummary(op) }));
    return [{ json: { ...plan, created: [], errors, unresolved: [], ids: '',
      readback_ids: plan.account_id, search_fields: 'id' } }];
  }
  
  let arr = raw.length === 1 && Array.isArray(raw[0]) ? raw[0]
          : (raw.length === 1 && Array.isArray(raw[0].data) ? raw[0].data : raw);
  const created = [], errors = [], unresolved = [];
  plan.batch.forEach((op, i) => {
    const r = arr[i];
    const type = typeFor(op);
    // Rule 1: null element = dependency cascade, not a distinct failure.
    if (r === null || r === undefined) {
      errors.push({ op: op.name, type, code: null, subcode: null, skipped: true,
        message: 'not attempted: Graph returns null for an operation whose dependency failed'
          + (op.depends_on ? ' (depends_on ' + op.depends_on + ')' : '') + '. The first error in this list is the cause.',
        request: reqSummary(op) });
      return;
    }
    let body = {};
    try { body = typeof r.body === 'string' ? JSON.parse(r.body) : (r.body || r); }
    catch (e) { body = { raw: String(r.body).slice(0, 300) }; }
    if (body && body.id && (r.code === undefined || r.code === 200)) {
      created.push({ op: op.name, type, id: String(body.id), depends_on: op.depends_on || null });
      return;
    }
    const e = (body && body.error) || {};
    // Rule 4: no id, and nothing that identifies a failure either. Meta has told us
    // nothing, so we do not get to conclude anything. Hand it on to be read back.
    const hasError = !!(body && body.error) || (r.code !== undefined && r.code !== null && r.code !== 200);
    if (!hasError) {
      unresolved.push({ op: op.name, type, depends_on: op.depends_on || null,
        intended_name: intendedName(op), slot_code: r.code ?? null,
        slot: JSON.stringify(r).slice(0, 200), request: reqSummary(op) });
      return;
    }
    errors.push({ op: op.name, type,
      code: e.code ?? r.code ?? null, subcode: e.error_subcode ?? null,
      message: e.message || body.raw || JSON.stringify(body).slice(0, 300),
      user_msg: e.error_user_msg || e.error_user_title || null,
      blame: e.error_data ? JSON.stringify(e.error_data).slice(0, 220) : null,
      fbtrace_id: e.fbtrace_id || null,
      request: reqSummary(op) });
  });
  // The account-edge read that settles unresolved ops. Costed only when there is
  // something to settle; otherwise 'Search account' fetches a bare id and is cheap.
  const SEARCH_FIELDS = 'campaigns.limit(200){id,name,status,effective_status,created_time},'
    + 'adsets.limit(200){id,name,status,effective_status,created_time,campaign_id},'
    + 'ads.limit(200){id,name,status,effective_status,created_time,adset_id}';
  return [{ json: { ...plan, created, errors, unresolved,
    ids: created.map(c => c.id).join(','),
    readback_ids: created.length ? created.map(c => c.id).join(',') : plan.account_id,
    search_fields: unresolved.length ? SEARCH_FIELDS : 'id' } }];
  
};

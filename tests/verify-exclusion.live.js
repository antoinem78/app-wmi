
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
  for (const k of keys) {
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

module.exports = verifyExclusionDiff;

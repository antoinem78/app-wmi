
// ===== VERIFY PLACEMENT (pure; extracted verbatim by tests/verify-placement.test.js) =====
// Returns the list of problems; empty means the write verified.
function verifyPlacementDiff(snapshot, readbackTargeting, platform) {
  const POSITIONS = { audience_network: 'audience_network_positions', messenger: 'messenger_positions',
    facebook: 'facebook_positions', instagram: 'instagram_positions',
    whatsapp: 'whatsapp_positions', threads: 'threads_positions' };
  const posKey = POSITIONS[platform];
  const sortDeep = (v) => Array.isArray(v) ? v.map(sortDeep)
    : (v && typeof v === 'object' ? Object.keys(v).sort().reduce((o, k) => (o[k] = sortDeep(v[k]), o), {}) : v);
  const canon = (v) => JSON.stringify(sortDeep(v));
  const show = (v) => v === undefined ? 'absent' : JSON.stringify(v).slice(0, 200);
  const problems = [];
  const rb = readbackTargeting || {};
  if (!readbackTargeting) problems.push('read-back returned no targeting object');
  const keys = new Set(Object.keys(snapshot).concat(Object.keys(rb)));
  keys.delete('publisher_platforms');
  keys.delete(posKey);
  for (const k of keys) {
    if (canon(snapshot[k]) !== canon(rb[k]))
      problems.push('field "' + k + '" changed: ' + show(snapshot[k]) + ' -> ' + show(rb[k]));
  }
  const before = (snapshot.publisher_platforms || []).slice().sort();
  const expected = before.filter((p) => p !== platform);
  const got = (rb.publisher_platforms || []).slice().sort();
  if (JSON.stringify(got) !== JSON.stringify(expected)) {
    problems.push(JSON.stringify(got) === JSON.stringify(before)
      ? 'read-back platforms identical to pre-write: ' + platform + ' was not removed'
      : 'publisher_platforms read back as [' + got.join(',') + '], expected [' + expected.join(',') + ']');
  }
  if (rb[posKey] !== undefined && Array.isArray(rb[posKey]) && rb[posKey].length)
    problems.push('positions field "' + posKey + '" still present after removing ' + platform);
  return problems;
}
// ===== END VERIFY PLACEMENT =====

module.exports = verifyPlacementDiff;

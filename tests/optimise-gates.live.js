
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
    if (!['pause', 'budget', 'unpause'].includes(m.op))
      return fail('grammar', 'unknown op "' + m.op + '"; the whole set is refused');
    if (!m.entity_id || !['campaign', 'adset', 'ad'].includes(m.entity_type))
      return fail('grammar', 'move missing entity_id/entity_type');
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

module.exports = runGates;

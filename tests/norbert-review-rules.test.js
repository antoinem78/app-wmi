// Rules tests for Norbert's review of Oscar's proposals, against the module
// the portal imports (Node 24 strips the types on require).
//
// Run: node tests/norbert-review-rules.test.js
const assert = require("node:assert/strict");
const {
  assessHistory, parseVerdict, approvalGate, revisionRound, summariseReview, THRASH_N,
} = require("../src/lib/norbert-review-rules.ts");

let n = 0;
const t = (name, fn) => { fn(); n++; console.log("  ok", name); };

const row = (user, at = "2026-09-01 10:00:00") => ({ at, user, op: "UPDATE", fields: "campaign.status", resource: "customers/1/campaigns/2" });

t("unreadable history fails closed, never reads as quiet", () => {
  const h = assessHistory(null, ["us@agency.com"]);
  assert.equal(h.readable, false);
  assert.equal(h.thrashing, false);
  assert.equal(h.changes7d, 0);
});

t("three changes is not thrashing, four is", () => {
  const three = assessHistory([row("a@x.com"), row("a@x.com"), row("a@x.com")], []);
  assert.equal(three.thrashing, false);
  const four = assessHistory(Array.from({ length: THRASH_N }, () => row("a@x.com")), []);
  assert.equal(four.thrashing, true);
});

t("our own login is not a human change; the freelancer is named", () => {
  const h = assessHistory([row("Us@Agency.com"), row("freelancer@ppc.com"), row(null)], ["us@agency.com"]);
  assert.deepEqual(h.humanUsers, ["freelancer@ppc.com"]);
});

t("latest change timestamp is the max", () => {
  const h = assessHistory([row("a@x.com", "2026-08-30 09:00:00"), row("a@x.com", "2026-09-02 09:00:00")], []);
  assert.equal(h.latestAt, "2026-09-02 09:00:00");
});

t("parseVerdict reads SOUND and objections, tolerates prose", () => {
  assert.deepEqual(parseVerdict('Here: {"q1":"SOUND","q2":"Budget is idle."}'), { sound: true, q1: "SOUND", q2: "Budget is idle." });
  const v = parseVerdict('{"q1":"Wrong: the campaign was paused by the freelancer yesterday.","q2":""}');
  assert.equal(v.sound, false);
  assert.equal(v.q2, null);
  assert.equal(parseVerdict("no json here"), null);
  assert.equal(parseVerdict('{"q2":"only q2"}'), null);
});

t("approval gate blocks unreviewed, admits objected and failed", () => {
  assert.ok("error" in approvalGate(null, null));
  assert.deepEqual(approvalGate({ verdict: { sound: false, q1: "Wrong" } }, "2026-09-03T00:00:00Z"), { ok: true });
  assert.deepEqual(approvalGate({ error: "timeout" }, "2026-09-03T00:00:00Z"), { ok: true });
});

t("one revision round, then final", () => {
  assert.deepEqual(revisionRound(null), { round: 0, final: false });
  assert.deepEqual(revisionRound({ revision_round: 0 }), { round: 1, final: true });
  assert.deepEqual(revisionRound({ revision_round: 1 }), { round: 2, final: true });
});

t("summary carries flags Oscar must see", () => {
  const s = summariseReview({
    verdict: { sound: true, q1: "SOUND" },
    history: { readable: true, changes7d: 5, thrashing: true, humanUsers: ["f@ppc.com"], latestAt: null },
  });
  assert.match(s, /SOUND/);
  assert.match(s, /thrashing: 5 changes/);
  assert.match(s, /f@ppc\.com/);
  assert.match(summariseReview({ error: "boom" }), /could not review/);
  assert.match(summariseReview({ verdict: { sound: false, q1: "Wrong because X" } }), /objects: Wrong because X/);
});

console.log(`\n${n} passed`);

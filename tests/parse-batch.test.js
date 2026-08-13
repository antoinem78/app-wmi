// Tests for BERNARD_build's batch parser, against the response shapes Meta has
// actually returned to us. Risk brief 2026-08-05 item 1.2.
//
// The parser under test is EXTRACTED FROM THE LIVE WORKFLOW, not copied. If
// someone edits the node in n8n, re-extract and these tests run against the new
// code. A test suite against a stale copy would be worse than none, because it
// would report green about something that is no longer deployed.
//
// Every case here happened. None is invented:
//   1. Clean create                    the normal path
//   2. Empty slot on a real success    the Atelier Brunos orphans, 5 Aug
//   3. NULL element                    dependency cascade, catalogued 31 Jul
//   4. Top-level object                whole batch failed before any op ran
//   5. Real per-op error               with Meta's blame fields
//   6. Mixed                           the case that actually turns up in life
//
// Run: node tests/parse-batch.test.js
const parseBatchRaw = require("./parse-batch.live.js");

// n8n hands nodes items shaped {json: ...}, and the parser unwraps with
// .map(i => i.json). Tests state the Meta response plainly and this wraps it,
// so a test reads like the HTTP body Meta actually sent.
const parseBatch = (planJson, metaResponse) =>
  parseBatchRaw(planJson, [{ json: metaResponse }]);

const plan = (n) => ({
  account_id: "act_1801857321221826",
  batch: Array.from({ length: n }, (_, i) => ({
    name: i === 0 ? "c0" : `as0_${i}`,
    relative_url: i === 0 ? "act_1/campaigns" : "act_1/adsets",
    body: `name=${encodeURIComponent("WMI | Test " + i)}&status=PAUSED`,
    ...(i > 0 ? { depends_on: "c0" } : {}),
  })),
});

let pass = 0,
  fail = 0;
const check = (name, cond, detail) => {
  if (cond) {
    pass++;
    console.log(`  ok    ${name}`);
  } else {
    fail++;
    console.log(`  FAIL  ${name}${detail ? "\n          " + detail : ""}`);
  }
};

// ---------------------------------------------------------------- 1. clean
{
  const out = parseBatch(plan(2), [
    { code: 200, body: JSON.stringify({ id: "120100" }) },
    { code: 200, body: JSON.stringify({ id: "120200" }) },
  ])[0].json;
  check("clean create: both counted as created", out.created.length === 2);
  check("clean create: no errors", out.errors.length === 0);
  check("clean create: nothing unresolved", out.unresolved.length === 0);
  check("clean create: ids threaded for read-back", out.ids === "120100,120200");
}

// ------------------------------------------- 2. THE ORPHAN CASE, 5 August
// Meta returned an empty element for a campaign create that SUCCEEDED. The old
// parser scored it "op c0 (campaign) failed: null/null {}", the round was
// retried, and five real campaigns were created across five rounds with four
// left orphaned. An empty slot must never be scored as a failure.
{
  const out = parseBatch(plan(1), [{}])[0].json;
  check("empty slot is NOT an error", out.errors.length === 0, JSON.stringify(out.errors));
  check("empty slot is NOT counted as created", out.created.length === 0);
  check("empty slot is unresolved", out.unresolved.length === 1);
  check(
    "unresolved carries the intended name so read-back can find it",
    out.unresolved[0].intended_name === "WMI | Test 0",
    JSON.stringify(out.unresolved[0]),
  );
  check(
    "unresolved triggers the full account read, not the cheap one",
    out.search_fields.includes("campaigns.limit"),
  );
  check(
    "read-back falls back to the account when nothing has an id",
    out.readback_ids === "act_1801857321221826",
  );
}

// ------------------------------------------------------ 3. NULL cascade
{
  const out = parseBatch(plan(2), [
    { code: 400, body: JSON.stringify({ error: { message: "Invalid parameter", code: 100 } }) },
    null,
  ])[0].json;
  check("null element produces an error entry", out.errors.length === 2);
  const skipped = out.errors.find((e) => e.skipped);
  check("null element is marked skipped, not a distinct failure", !!skipped);
  check(
    "null element names its dependency",
    skipped && skipped.message.includes("depends_on c0"),
    skipped && skipped.message,
  );
  check("null element is not scored as created", out.created.length === 0);
}

// ------------------------------------------------- 4. top-level failure
{
  const out = parseBatch(
    plan(3),
    { error: { message: "Invalid OAuth access token", code: 190, fbtrace_id: "Axyz" } },
  )[0].json;
  check("top-level failure marks every op", out.errors.length === 3);
  check("top-level failure is staged as transport", out.errors[0].stage === "transport");
  check("top-level failure keeps the fbtrace id", out.errors[0].fbtrace_id === "Axyz");
  check("top-level failure creates nothing", out.created.length === 0);
  check("top-level failure leaves nothing unresolved", out.unresolved.length === 0);
}

// ------------------------------------------------------ 5. real op error
{
  const out = parseBatch(plan(1), [
      {
        code: 400,
        body: JSON.stringify({
          error: {
            message: "Invalid parameter",
            code: 100,
            error_subcode: 1487477,
            error_user_msg: "Your ad set budget is too low.",
            error_data: { blame_field_specs: [["daily_budget"]] },
            fbtrace_id: "Bqrs",
          },
        }),
      },
  ])[0].json;
  const e = out.errors[0];
  check("real error captured", out.errors.length === 1);
  check("keeps Meta's actionable user message", e.user_msg === "Your ad set budget is too low.");
  check("keeps the blame fields", e.blame && e.blame.includes("daily_budget"));
  check("keeps the subcode", e.subcode === 1487477);
  check("keeps the fbtrace id", e.fbtrace_id === "Bqrs");
}

// ------------------------------------------------------------- 6. mixed
{
  const out = parseBatch(plan(3), [
    { code: 200, body: JSON.stringify({ id: "120100" }) },
    {},
    { code: 400, body: JSON.stringify({ error: { message: "boom", code: 100 } }) },
  ])[0].json;
  check("mixed: one created", out.created.length === 1);
  check("mixed: one unresolved", out.unresolved.length === 1);
  check("mixed: one error", out.errors.length === 1);
  check(
    "mixed: read-back uses the known id, not the account",
    out.readback_ids === "120100",
  );
  check(
    "mixed: still asks for the full account read because something is unresolved",
    out.search_fields.includes("adsets.limit"),
  );
}

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);

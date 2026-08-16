/* Attribution capture in public/wa-widget.js, run against the real file.
 *
 * The case that matters is the last one: a visitor who has been here before
 * arrives again from a new advert. Until 2026-08-16 the landing page was
 * written once and never again, so that record paired the new click id with
 * the old landing page. Run: node tests/wa-widget-attribution.test.js
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const WIDGET = fs.readFileSync(path.join(__dirname, "..", "public", "wa-widget.js"), "utf8");
const LS_KEY = "sw_wa_attr";

// Enough of a DOM for the widget to build its button and card without caring
// that nothing is rendered. Only the attribution write is under test.
function stubElement() {
  const el = {
    style: {}, className: "", innerHTML: "", textContent: "", value: "",
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    setAttribute() {}, getAttribute: () => null, addEventListener() {}, focus() {},
    appendChild() {},
  };
  el.querySelector = () => stubElement();
  return el;
}

function run({ href, stored }) {
  const url = new URL(href);
  const store = new Map();
  if (stored) store.set(LS_KEY, JSON.stringify(stored));

  const script = {
    getAttribute(name) {
      return { "data-number": "447476925643", "data-token": "wapub_test" }[name] || null;
    },
  };
  const document = {
    currentScript: script,
    cookie: "",
    referrer: "https://www.google.com/",
    head: { appendChild() {} },
    body: { appendChild() {} },
    createElement: () => stubElement(),
    querySelector: () => null,
  };
  const sandbox = {
    document,
    location: { href, search: url.search },
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, v),
    },
    navigator: { sendBeacon: () => true },
    window: { crypto: { getRandomValues: (b) => b.fill(7) } },
    crypto: { getRandomValues: (b) => b.fill(7) },
    URLSearchParams, Blob: class { constructor() {} }, console, fetch: () => Promise.resolve(),
  };
  sandbox.window.document = document;
  vm.createContext(sandbox);
  vm.runInContext(WIDGET, sandbox);
  return JSON.parse(store.get(LS_KEY));
}

const AD = "https://www.wmiltd.com/?gclid=Cj0KCQjwkOvTBhDgARIsAKUNyRv";
const OLD = "https://www.wmiltd.com/?gclid=DEMO_TEST_CLICK_123";
let passed = 0;
function check(name, fn) {
  fn();
  passed++;
  console.log("  ok  " + name);
}

check("first ever visit stores landing, referrer and first_seen", () => {
  const s = run({ href: AD, stored: null });
  assert.strictEqual(s.landing, AD);
  assert.strictEqual(s.gclid, "Cj0KCQjwkOvTBhDgARIsAKUNyRv");
  assert.strictEqual(s.referrer, "https://www.google.com/");
  assert.ok(s.first_seen && s.landing_seen);
});

check("a reload with the same click id does not move the landing page", () => {
  const first = run({ href: AD, stored: null });
  const s = run({ href: "https://www.wmiltd.com/pricing", stored: first });
  assert.strictEqual(s.landing, AD, "landing page churned on a same-session page view");
  assert.strictEqual(s.landing_seen, first.landing_seen);
});

check("an organic return does not overwrite the ad landing page", () => {
  const first = run({ href: AD, stored: null });
  const s = run({ href: "https://www.wmiltd.com/", stored: first });
  assert.strictEqual(s.landing, AD);
  assert.strictEqual(s.gclid, "Cj0KCQjwkOvTBhDgARIsAKUNyRv");
});

check("THE DEFECT: a new click id re-stamps the landing page beside it", () => {
  const previous = {
    landing: OLD, referrer: "", first_seen: "2026-08-04T09:00:00.000Z",
    gclid: "DEMO_TEST_CLICK_123",
  };
  const s = run({ href: AD, stored: previous });
  assert.strictEqual(s.gclid, "Cj0KCQjwkOvTBhDgARIsAKUNyRv");
  assert.strictEqual(s.landing, AD, "landing page still carries the previous visit");
  assert.strictEqual(s.first_seen, "2026-08-04T09:00:00.000Z", "first_seen must stay the true first touch");
  assert.ok(s.landing_seen > s.first_seen);
});

check("a new fbclid re-stamps too, not just gclid", () => {
  const previous = { landing: OLD, fbclid: "IwAR_old", first_seen: "2026-08-04T09:00:00.000Z" };
  const href = "https://www.wmiltd.com/lp?fbclid=IwAR_new";
  const s = run({ href, stored: previous });
  assert.strictEqual(s.landing, href);
  assert.strictEqual(s.fbclid, "IwAR_new");
});

check("utm change alone is not a fresh click and does not move landing", () => {
  const previous = { landing: OLD, gclid: "DEMO_TEST_CLICK_123", utm_source: "google" };
  const s = run({ href: "https://www.wmiltd.com/?utm_source=newsletter", stored: previous });
  assert.strictEqual(s.landing, OLD);
  assert.strictEqual(s.utm_source, "newsletter");
});

console.log("\n" + passed + " passed");

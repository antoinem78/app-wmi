/* SingularWeb WhatsApp attribution widget.
 *
 * Embed (one line, any site):
 *   <script src="https://app.wmiltd.com/wa-widget.js" defer
 *     data-number="447xxxxxxxxx"            (WhatsApp number, digits only, country code, no +)
 *     data-token="wapub_..."                (per-client public token)
 *     data-greeting="Hi! How can we help?"  (optional)
 *     data-cta="Chat on WhatsApp"           (optional button label)
 *     data-color="#25D366"                  (optional brand colour)
 *     data-position="right"                 (optional: right|left)
 *   ></script>
 *
 * What it does: captures ad click ids (gclid, gbraid, wbraid, fbclid, msclkid,
 * utm_*, referrer, landing page, and Meta's _fbc/_fbp cookies) on arrival, and
 * parks them server-side under a short ref code when the visitor starts a
 * WhatsApp chat. No cookies beyond localStorage; one beacon on click.
 * The click id and the landing page always describe the same arrival: see the
 * attribution capture block below for why that took a fix.
 *
 * HOW THE MATCH ACTUALLY HAPPENS, tested in production 2026-08-06:
 * The receiver marries the inbound conversation to the parked click by TIME
 * WINDOW: exactly one unclaimed click for that client in the last 30 minutes
 * wins, and it refuses to guess when there are several. That is what works.
 *
 * The zero-width ref below is kept because it costs nothing and may survive
 * other channels, but WHATSAPP STRIPS IT. Proven with a clean test: the
 * prefill was sent unedited and arrived as 35 visible characters with zero
 * invisible ones. Do not sell "an invisible code they cannot delete" on
 * WhatsApp. The visible ref (data-visible-ref="true") does survive, at the
 * cost of being deletable, which is the trade a higher-volume client makes.
 */
(function () {
  "use strict";
  // document.currentScript is null whenever the tag is injected rather than
  // parsed: Google Tag Manager, any "lazy" loader, or a framework that appends
  // the script itself. Falling back to a src lookup means the widget works
  // however a client chooses to embed it, which for a product sold to people
  // who live in GTM is the difference between working and mysteriously not.
  var script =
    document.currentScript ||
    document.querySelector('script[src*="wa-widget.js"]');
  if (!script) {
    console.warn("[sw-wa] cannot find own script tag; widget not started");
    return;
  }
  var NUMBER = (script.getAttribute("data-number") || "").replace(/\D/g, "");
  var TOKEN = script.getAttribute("data-token") || "";
  if (!NUMBER || !TOKEN) {
    console.warn("[sw-wa] data-number and data-token are required; widget not started");
    return;
  }
  var GREETING = script.getAttribute("data-greeting") || "Hi! Message us on WhatsApp and we'll reply as soon as we can.";
  var CTA = script.getAttribute("data-cta") || "Chat on WhatsApp";
  var COLOR = script.getAttribute("data-color") || "#25D366";
  var POSITION = script.getAttribute("data-position") === "left" ? "left" : "right";
  var BEACON = "https://singularweb.app.n8n.cloud/webhook/wa-click";
  var LS_KEY = "sw_wa_attr";

  // ---- attribution capture ----
  // The click id and the landing page have to describe the SAME arrival or the
  // record is wrong: before 2026-08-16 the landing page was written once and
  // never again, so a returning visitor's record paired today's click id with
  // the page a previous visit had landed on. The rule now is that a click id
  // the visitor has not arrived with before is a fresh ad click, and a fresh ad
  // click re-stamps the landing page and referrer alongside it. A genuine first
  // touch (no click id at all) still sets them, and a plain reload or a same-id
  // return does not churn them.
  function cookie(name) {
    var m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
    return m ? decodeURIComponent(m[1]) : null;
  }
  var CLICK_KEYS = ["gclid", "gbraid", "wbraid", "fbclid", "msclkid"];
  function captureAttribution() {
    var q = new URLSearchParams(location.search);
    var keys = CLICK_KEYS.concat(["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]);
    var found = {};
    keys.forEach(function (k) { var v = q.get(k); if (v) found[k] = v.slice(0, 256); });
    var stored = {};
    try { stored = JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch (e) {}
    var freshClick = CLICK_KEYS.some(function (k) { return found[k] && found[k] !== stored[k]; });
    var now = new Date().toISOString();
    if (!stored.landing || freshClick) {
      stored.landing = location.href.slice(0, 512);
      stored.referrer = (document.referrer || "").slice(0, 512);
      // first_seen stays the genuine first touch; landing_seen moves with the
      // landing page, so the pair can always be checked against each other.
      if (!stored.first_seen) stored.first_seen = now;
      stored.landing_seen = now;
    }
    // click ids: first touch wins, but a NEW click id (fresh ad click) overwrites
    keys.forEach(function (k) { if (found[k]) stored[k] = found[k]; });
    try { localStorage.setItem(LS_KEY, JSON.stringify(stored)); } catch (e) {}
    return stored;
  }
  var ATTR = captureAttribution();

  var ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
  function refCode() {
    var out = "";
    var buf = new Uint8Array(6);
    (window.crypto || {}).getRandomValues ? crypto.getRandomValues(buf) : buf.forEach(function (_, i) { buf[i] = Math.floor(Math.random() * 256); });
    for (var i = 0; i < 6; i++) out += ALPHABET[buf[i] % 32];
    return "WA-" + out;
  }
  // Zero-width steganography: each payload char is 5 bits (32-char alphabet),
  // bits become U+200B (0) / U+200C (1), the whole run is fenced by U+200D.
  // 6 chars -> 30 invisible characters + 2 fences.
  function zwEncode(ref) {
    var payload = ref.slice(3); // drop "WA-"
    var bits = "";
    for (var i = 0; i < payload.length; i++) {
      bits += ("0000" + ALPHABET.indexOf(payload[i]).toString(2)).slice(-5);
    }
    var out = "\u200D";
    for (var j = 0; j < bits.length; j++) out += bits[j] === "0" ? "\u200B" : "\u200C";
    return out + "\u200D";
  }

  // ---- UI ----
  var css = [
    ".sw-wa-btn{position:fixed;bottom:22px;" + POSITION + ":22px;z-index:99998;width:58px;height:58px;border-radius:50%;background:" + COLOR + ";box-shadow:0 4px 14px rgba(0,0,0,.25);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:transform .15s ease}",
    ".sw-wa-btn:hover{transform:scale(1.06)}",
    ".sw-wa-btn svg{width:32px;height:32px;fill:#fff}",
    ".sw-wa-card{position:fixed;bottom:92px;" + POSITION + ":22px;z-index:99999;width:min(340px,calc(100vw - 44px));background:#fff;border-radius:14px;box-shadow:0 8px 30px rgba(0,0,0,.28);overflow:hidden;font:14px/1.45 -apple-system,'Segoe UI',Roboto,sans-serif;display:none}",
    ".sw-wa-card.open{display:block}",
    ".sw-wa-head{background:" + COLOR + ";color:#fff;padding:13px 16px;font-weight:600;display:flex;justify-content:space-between;align-items:center}",
    ".sw-wa-close{background:none;border:none;color:#fff;font-size:19px;cursor:pointer;line-height:1;padding:2px 4px}",
    ".sw-wa-body{padding:14px;background:#ece5dd}",
    ".sw-wa-msg{background:#fff;border-radius:0 10px 10px 10px;padding:10px 12px;color:#1c1c1c;max-width:88%;box-shadow:0 1px 1px rgba(0,0,0,.08)}",
    ".sw-wa-foot{padding:12px;background:#fff;display:flex;flex-direction:column;gap:9px}",
    ".sw-wa-input{width:100%;box-sizing:border-box;border:1px solid #d5d9dd;border-radius:9px;padding:9px 11px;font:inherit;resize:none;min-height:44px;max-height:110px}",
    ".sw-wa-send{background:" + COLOR + ";color:#fff;border:none;border-radius:9px;padding:11px;font:inherit;font-weight:600;cursor:pointer}",
    ".sw-wa-send:hover{filter:brightness(1.05)}"
  ].join("\n");
  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  var WA_SVG = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.297-.497.1-.198.05-.371-.025-.52-.074-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>';

  var btn = document.createElement("button");
  btn.className = "sw-wa-btn";
  btn.setAttribute("aria-label", CTA);
  btn.innerHTML = WA_SVG;

  var card = document.createElement("div");
  card.className = "sw-wa-card";
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-label", "WhatsApp chat");
  card.innerHTML =
    '<div class="sw-wa-head"><span>WhatsApp</span><button class="sw-wa-close" aria-label="Close">&times;</button></div>' +
    '<div class="sw-wa-body"><div class="sw-wa-msg"></div></div>' +
    '<div class="sw-wa-foot"><textarea class="sw-wa-input" rows="2" placeholder="Type your message..."></textarea>' +
    '<button class="sw-wa-send"></button></div>';
  card.querySelector(".sw-wa-msg").textContent = GREETING;
  card.querySelector(".sw-wa-send").textContent = CTA;

  document.body.appendChild(btn);
  document.body.appendChild(card);

  btn.addEventListener("click", function () {
    card.classList.toggle("open");
    if (card.classList.contains("open")) card.querySelector(".sw-wa-input").focus();
  });
  card.querySelector(".sw-wa-close").addEventListener("click", function () {
    card.classList.remove("open");
  });

  function launch() {
    var typed = card.querySelector(".sw-wa-input").value.trim();
    var ref = refCode();
    var payload = {
      t: TOKEN,
      ref: ref,
      page: location.href.slice(0, 512),
      attribution: ATTR
    };
    // refresh cookie-based ids at click time (fbc/fbp can appear late)
    var fbc = cookie("_fbc"), fbp = cookie("_fbp");
    if (fbc) payload.attribution._fbc = fbc;
    if (fbp) payload.attribution._fbp = fbp;
    try {
      // text/plain keeps the beacon a "simple request": no CORS preflight.
      var blob = new Blob([JSON.stringify(payload)], { type: "text/plain" });
      if (!(navigator.sendBeacon && navigator.sendBeacon(BEACON, blob))) {
        fetch(BEACON, { method: "POST", body: JSON.stringify(payload), headers: { "Content-Type": "text/plain" }, keepalive: true }).catch(function () {});
      }
    } catch (e) {}
    // The ref rides invisibly: encoded as zero-width characters appended to the
    // visitor's own words, so there is nothing visible to delete. A visible
    // "(ref ...)" suffix is opt-in via data-visible-ref="true" as a fallback
    // for channels that strip zero-width characters.
    var text = (typed || "Hi! I'd like some more information.");
    if (script.getAttribute("data-visible-ref") === "true") text += "\n\n(ref " + ref + ")";
    text += zwEncode(ref);
    var url = "https://wa.me/" + NUMBER + "?text=" + encodeURIComponent(text);
    window.open(url, "_blank", "noopener");
    card.classList.remove("open");
    card.querySelector(".sw-wa-input").value = "";
  }
  card.querySelector(".sw-wa-send").addEventListener("click", launch);
  card.querySelector(".sw-wa-input").addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); launch(); }
  });
})();

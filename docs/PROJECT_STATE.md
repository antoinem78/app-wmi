# Project state

**Purpose.** This is the handoff file between parallel Claude Code sessions and between Claude Code and Claude Chat. It holds what neither the code nor the git history tells you: what is live versus staged, what is blocked and on whom, rulings the founder has made, and what comes next. It is not a changelog. If something here contradicts the code, the code is right and this file is stale, so fix it.

**Last updated:** 2026-07-30

**If you are a fresh session, read §1 and §2 always.** Then read only your track: §4 for lead generation, §5 for ecommerce. §3 (Bernard) is vertical-agnostic and belongs to both.

---

## 1. Entities, and which one you are acting for

Getting this wrong has already cost credibility once, so check before drafting anything client-facing.

| Entity | Registration | Used for |
|---|---|---|
| **SingularWeb** | (holding) | Owns the infrastructure and Rexos itself |
| **Web Marketing International Ltd** | UK, CRN 10264568, active since 6 July 2016, registered 124 City Road, London EC1V 2NX | The UK agency. Owns the WMI UK ad account. The entity for UK Twilio numbers. |
| **ADENERGY SP. Z O.O.** | Poland, KRS 0001251633, Tyniecka 137T, 30-319 Kraków | Legal entity behind DentalMastery.ai. Makes that operation GDPR-governed with UODO as supervisory authority. |

The founder is Anthony, resident in Dubai. **His location is an operational fact and almost never a regulatory one.** WMI is a UK company with a UK registered office; do not treat it as foreign, and do not manufacture compliance doubt from where he sits.

The "Mastery" brands are outside SingularWeb. See the memory note on the brand and entity map.

---

## 2. Standing rulings and conventions

These are founder rulings, not preferences to weigh. They apply to both tracks.

**Meta is read-only for Claude.** Ruled 2026-07-24 after a denied script. Every Graph API call Claude makes is a GET. Never offer to do a Meta write directly; the write paths are below.

**Meta writes have three possible paths, and Manus is only one of them.** In order of preference:

1. **The substrate** (`BERNARD_build` for campaign construction, `BERNARD_fix` for a founder-approved single mutation). Deterministic, zero executor credits, no false-claim risk. This is the default.
2. **The founder by hand** in Ads Manager, for anything UI-only.
3. **Manus**, IF still subscribed. **Subscription status unresolved as of 2026-07-30**: on 24 July the founder said he was tempted to cancel and asked whether he could downgrade; the recommendation was downgrade rather than cancel; no confirmation either way is on record. Do not assume Manus is available. Ask before designing a dispatch around it.

Whichever path, **everything is created PAUSED and only the founder activates or touches billing.** Manus has produced two verified false claims, so any executor report is read back against ground truth rather than believed.

**Open canon item, needs a founder ruling.** If Manus is dormant or gone, Bernard's role simplifies to spec-writer, verifier and gatekeeper with the substrate as executor, and the executor contract plus R15 need updating, since both currently assume an external executor. This was flagged on 26 July and has not been ruled.

**Client documents are written as Anthony**, first person, in his voice. Never mention APIs, tooling, endpoints, field names or how data was obtained. He is selling his expertise, not a generated report.

**No em dashes. Anywhere.** Objected to three times. Use full stops, commas, colons, parentheses. En dashes only in numeric ranges. Check headings, which is where they survive a prose pass.

**Never assert something is absent from a single API reading.** On 2026-07-30 an Instagram post count of zero became a client document's headline finding and was wrong; the profile was full. Before any absence claim, check the surface a real user would see. A permission error nearby disqualifies the whole area from absence claims.

**Verify who controls a system before drafting anything about it.** A DNS request went to the wrong provider on 2026-07-30 because they were in an email thread. Check the system itself. Never speculate in client-facing writing about whether the founder has access to something; ask him.

**R7 autonomy.** Self-initiated work is fine when it is additive, reversible, verified, touches no client-facing surface and writes no production rows. Modifying a live workflow needs a founder ask.

**Rexos `main` is production.** It auto-deploys to app.wmiltd.com. Use a preview branch unless the founder says deploy.

---

## 3. Bernard (vertical-agnostic, shared by both tracks)

Bernard is the **senior paid social strategist and media buyer**, ruled 2026-07-30. Auditing and campaign building are things he does, not what he is. He is intrinsically neither ecommerce nor lead generation, so both tracks use him and both should keep his memory current.

**Where he lives.** Chat at `/bernard` in the portal (`src/components/BernardChat.tsx`, `src/app/api/bernard/chat/route.ts`, `src/lib/integrations/anthropic/bernard-agent.ts`). Claude Fable 5, medium effort, server-side fallback to Opus 4.8. His governed n8n endpoints are in `src/lib/bernard.ts`.

**Tools.** `get_status`, `decide_fix`, `stand_down`, `list_meta_accounts`, `run_audit`, plus `remember`, `revise_memory`, `forget`.

**Memory (live as of 2026-07-30).** Table `bernard_memory`, migration `docs/substrate-migrations/0002_bernard_memory.sql`, applied. Deliberately separate from `agent_conversations` so clearing the chat drops the transcript and leaves what he knows intact. Read fresh each turn and injected into his system prompt grouped by subject with ids. Seeded with 20 foundational memories. Capped at 150 rows / 24k chars, at which point he is told to consolidate.

**Attachments (live as of 2026-07-30).** PDF goes to Claude as a native document block; .docx text is extracted from the OOXML via jszip; .md, .txt and .csv decode directly. Legacy .doc is refused with a message rather than half-parsed. Limits are 5 files, 3.5MB each, 4MB combined, set by Vercel's body ceiling. Extracted text persists into the transcript; **PDF bytes do not**, so a long PDF thread needs re-attaching.

**Substrate workflows.** `BERNARD_dispatch`, `BERNARD_fix`, `BERNARD_monitor` (daily 09:00), `BERNARD_standdown`, `BERNARD_build`, `RCV_manus_events` (RSA-SHA256 signature verification proven live).

**Ad accounts he can currently see** (system user, read-only):

| Account | Business | Track |
|---|---|---|
| act_1027063116856202 WMI UK | WMI | lead gen (DM.ai runs here) |
| act_1766396370547849 Steffen Foerster | Steffen Foerster | lead gen (high ticket) |
| act_575423175548816 Tropical Oasis | Ace Nutrition | ecommerce |
| act_1801857321221826 Luca Summer | Atelier Brunos | ecommerce |
| act_27875735492115545 Mondedutabouret | monde_du_tabouret | ecommerce |

---

## 4. Lead generation track

**DentalMastery.ai** (slug `dental-mastery`, never `dentalmastery`, the wrong slug silently writes zero rows). B2B, sells to US dental practice owners, runs inside the WMI UK ad account because the founder hit his Business Portfolio limit.

Live: a warm-up engagement campaign and a leads campaign using Meta Instant Forms against the Apollo list audience (`Apollo Dental Mega List July 26`, 16,536 contacts uploaded, ~4,300-5,100 matched). Targeting is list-only and verified so: `advantage_audience: 0`, `targeting_relaxation: {custom_audience: 0, lookalike: 0}`. Conversion spine is live and Meta-verified, `Lead` and `Schedule` server-side into dataset 867153482888947 via `CAP_meta_conversions`, GHL workflows firing it, Slack to #dentalmastery-leads. Legal pages published (privacy, terms, cookie settings) with a consent banner gating the pixel.

Open: as at 2026-07-30 the leads campaign had produced no leads on roughly 15 clicks, and the budget reads £15/day rather than the £30 the founder set. The decision point is ~30 cumulative clicks: still zero and the problem is the ask, not delivery. Frequency is already ~2.1 against a small pool, so the list-only experiment has about 7 to 10 clean days before ad blindness contaminates it. Performance goal cannot be changed after publish, so any change of optimisation means a duplicate ad set.

**KST Accountants.** THE BLUEPRINT, ruled 2026-07-30: a minor account by revenue that exists to be cloned for the next accountancy client and the next non-dental lead gen client. Build to be cloned, not just to work.

Done: sending domain `mail.kst-accountants.co.uk` live at IONOS, all six records verified authoritatively and propagated, warm-up Stage 1, SSL issued, From set to Kris Thiemelay / info@kst-accountants.co.uk. Root domain untouched (Microsoft 365 behind MailAnyone). Three GHL workflows exist: two OCT stage workflows and Website Lead Notifications.

Blocked: the nurture sequence is written (`~/Documents/KST_NURTURE_SEQUENCE.md`, six emails over fifteen days) but **not built**, because every email points at a consultation booking page that does not exist and we have no access to Kris's calendar. Parked by the founder.

Outstanding: **capture KST as a GHL snapshot.** `snapshotId` is empty, so nothing there is portable, which defeats the blueprint purpose. Grows harder with every hand-built addition. Also note GHL workflow creation is UI-only; `POST /workflows/` returns 404, and no scope grant changes that.

**Steffen Foerster.** High-ticket Galapagos photography workshops, $15,900-25,900, October charter-commitment deadline. Audit delivered (`~/Documents/SF_GALAPAGOS_META_AUDIT_JULY26.docx`). Root cause is a signal problem: everything optimises to the pixel Lead event with nothing downstream fed back, so Meta cannot distinguish a qualified buyer from a browser. Google and Microsoft Ads research went to Cowork. Awaiting his response.

**Twilio, agency level.** Decision made: own Twilio account with a sub-account per client, GoHighLevel's `twilioRebilling` (present, disabled, 10% markup default) switched on, rather than LC Phone. Buy **geographic** numbers under WMI Ltd, not mobile: an Ofcom statement of 15 July 2026 forces +44 7 CLIs from outside the UK to "withheld" from 15 July 2027, and geographic numbers are untouched. Legality fully verified in `~/Documents/TWILIO_UK_FROM_UAE_RESEARCH.md`. Blocked on there being no Twilio credentials; account creation and payment details are the founder's to do.

---

## 5. Ecommerce track

**Monde du Tabouret** (slug `monde-du-tabouret`). Shopify bar stools and chairs, France and Belgium, mondedutabouret.fr, EUR, page 341731552612640 connected.

Two campaign shells exist and are PAUSED, structure verified independently by the founder. **Phase 0 is still blocked as at 2026-07-30**: zero pixels on the ad account, and the two catalogs shared into our BM are shells (`Catalog_products` with 1 product, `Tabouret France` with 0) with no product feed on either, which is a hand-made catalog rather than a Shopify sync. The single blocker is the client completing the "Facebook and Instagram by Meta" app setup in Shopify, which creates the pixel and streams the range. **Do not green-light Phase 1 on a 0-or-1-product catalog.** A daily 09:00 monitor watches exactly these two conditions.

Phase 1, when unblocked: four product sets, four ad sets in the existing campaign `120250024094940369`, four Advantage+ catalog carousel ads, all PAUSED. Product-set filters must come from real feed fields; skip and flag anything that cannot be expressed rather than approximating.

**Atelier Brunos / Luca Summer** (act_1801857321221826). DTC men's Italian leather footwear at $250, US, atelierbrunos.com. Note the naming: ad account "Luca Summer", Meta business "Atelier Brunos", ranges Lord and Penny.

Audit delivered and then corrected (`~/Documents/LUCA_SUMMER_META_AUDIT_JULY26.docx`). State: $1,783.84 lifetime, 4 purchases, $1,242.50 revenue, ROAS 0.70, CPA $446 against a $311 AOV. The ads are good (4.99% CTR) and the product page is good (127 five-star reviews, warranty, size guide, 28 images). Four structural faults: no usable retargeting layer at all, Purchase optimisation on 4 conversions in 10 weeks, discount creative at ROAS 0.38 against brand story at 1.15, and five identical ad sets bidding against each other. Audience Network is producing fraudulent engagement (35.8% CTR on rewarded video, 15 add-to-carts from 35 clicks) that contaminates the conversion data. The largest uncaptured gain is the site's 1.08% add-to-cart rate against a 5-8% norm, which needs Shopify and GA4 access to diagnose.

**Tropical Oasis** (act_575423175548816, Ace Nutrition). Audit delivered previously. Awaiting client reply.

**Patterns this track will need that the lead gen track does not:** catalog and feed health, Advantage+ Shopping, dynamic product retargeting, `Purchase` and value optimisation rather than `Lead`, ROAS and AOV rather than cost per lead. Catalog diagnostics are currently unavailable for both Shopify clients because catalogs are not properly shared or synced, so that is the recurring first blocker to check.

---

## 6. Deployed, staged, blocked

| Thing | State |
|---|---|
| Bernard attachments + memory | **Live on production** (main, 2026-07-30). Migration 0002 applied, 20 memories seeded. |
| `growth_action` view, read-only role | Applied (migration 0001) |
| DM.ai campaigns | Live and spending |
| KST sending domain | Live and verified |
| KST nurture sequence | Written, not built. Blocked on a booking page. |
| KST GHL snapshot | Not started. Blocks the blueprint purpose. |
| MDT Phase 1 | Shells PAUSED. Blocked on client Shopify app setup. |
| Twilio UK number | Decided, blocked on credentials |
| Steffen proposal | Delivered, awaiting client |

---

## 7. Working notes for parallel sessions

Both sessions share this repo, the substrate, Supabase, the GHL account and Bernard. So:

- **Coordinate through this file.** Update it when something lands, gets blocked, or a ruling is made. That is the whole mechanism.
- **Bernard's memory is the other shared surface.** If you learn something durable about an account, it belongs in `bernard_memory` so the other session's Bernard has it too.
- **Watch for collisions on shared files.** `src/lib/integrations/anthropic/`, `src/lib/bernard*.ts` and the substrate workflows are touched by both tracks. Check `git status` and recent commits before editing.
- **Migrations are numbered sequentially** in `docs/substrate-migrations/`. Two sessions creating `0003_` simultaneously will conflict, so claim the number here when you start one.
- Client documents live in `~/Documents/`, not in the repo.
- Credentials are in `~/.config/singularweb/substrate.env` (chmod 600) and `.env.local`. Reference them by variable name; never echo values.

# Project state

**Purpose.** This is the handoff file between parallel Claude Code sessions and between Claude Code and Claude Chat. It holds what neither the code nor the git history tells you: what is live versus staged, what is blocked and on whom, rulings the founder has made, and what comes next. It is not a changelog. If something here contradicts the code, the code is right and this file is stale, so fix it.

**Last updated:** 2026-07-30 (Oscar named, agent_memory shared, commerce substrate verification, stale-string sweep)

**If you are a fresh session, read §1 and §2 always.** Then read only your track: §4 for lead generation, §5 for ecommerce. §3 (the named agents) is vertical-agnostic and belongs to both.

**Two Supabase projects exist and they are easy to confuse.** The portal DB (`SUPABASE_URL` in `.env.local`) holds everything the Next.js app reads. The substrate DB (`SUBSTRATE_DB_URL`) holds what n8n reads. `docs/substrate-migrations/` contains migrations for both despite its name, and on 2026-07-30 a rename meant for the portal was pointed at the substrate. Read `docs/substrate-migrations/README.md` before running any migration.

**The agents are named. Rexos is not one of them.** Bernard owns Meta (§3). Oscar owns Google Ads and Shopping, renamed from the misleading "Ask Rexos" on 2026-07-30 because the platform's name was standing in for a single-channel specialist. Rexos is the platform they both live inside.

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

**Meta writes have two paths. Manus is cancelled.** In order of preference:

1. **The substrate** (`BERNARD_build` for campaign construction, `BERNARD_fix` for a founder-approved single mutation). Deterministic, zero executor credits, no false-claim risk. This is now the only automated path.
2. **The founder by hand** in Ads Manager, for anything UI-only.

**Manus: cancelled, founder-confirmed 2026-07-30.** Do not design anything around it. Note the capability this loses: Manus could browse, drive a UI and improvise around an undocumented obstacle, and `BERNARD_build` cannot. A task genuinely needing those is now a human-tier item for the founder rather than an executor task, and should be named as such in `actions_not_taken`.

*Reconciling the API evidence, since a parallel session found it and it looks contradictory.* The `Manus usage` node in `BERNARD_monitor` returned 200 with live data on the morning of 2026-07-30, including a 3,068 credit grant labelled "Upgrade plan" timestamped 2026-07-24T21:33Z. That is consistent rather than conflicting: the founder said "I have upgraded" on 24 July, which is that grant, and the cancellation came after. A cancelled subscription normally keeps answering until the paid period lapses, so a 200 from the usage endpoint is not evidence of an active subscription. **The founder's statement governs.** The `Manus usage` node was already removed from `BERNARD_monitor` on 2026-07-30 as part of the gate fix, so nothing polls that endpoint any more; the remaining Manus surface is `RCV_manus_events`, covered by the canon note below.

Whichever path, **everything is created PAUSED and only the founder activates or touches billing.** Any executor report is still read back against ground truth. That rule outlived its original reason (Manus produced two verified false claims) and now guards our own bugs, partial failures and races against founder edits made in Ads Manager. Claimed is still not true until read.

Bernard's role is therefore spec-writer, verifier and gatekeeper, with the substrate as executor.

**Canon updated 2026-07-30.** `~/Downloads/WMI_META_LAB_EXECUTOR_CONTRACT_v2.md` supersedes v1: transport is substrate-internal, the Manus skill doctrine-carriage mechanism is void because doctrine is now code rather than instructions, and four controls upgrade from declared-and-audited to machine-enforced (report shape, write budget, gate hold, stand-down). `RCV_manus_events` is now dead code and should be retired rather than left listening for a vendor we no longer use.

**BERNARD_build hardened 2026-07-31, after its record was actually read: 2 built, 1 built_with_problems, 6 build_failed across 9 lifetime attempts.** Three changes, live in n8n and verified. (1) Gate hold is now pre-flight: any envelope `gate_conditions` entry not explicitly `met` returns GATE_BLOCKED before any Meta call; proven with a deliberately blocked live envelope, zero Meta writes confirmed by read-back, rejection logged. (2) Error capture rebuilt: Graph returns a NULL element for ops whose dependency failed (previously stored as the useless `code null {}`), Meta's actionable text lives in `error_user_msg` and `error_data` blame fields (previously dropped, leaving bare "Invalid parameter"), and a top-level batch failure returns an object not an array (previously smeared across op slots). All three shapes unit-tested. (3) Write-budget pre-flight turned out to already exist; the contract had under-credited it. Failures are now diagnosable from the task row alone.

**One open founder ruling.** `~/Downloads/R15_AMENDMENT_2026-07-30.md`. R15's quarantine language ("an isolated, swappable execution substrate") described a real vendor boundary that no longer exists now the executor is our own infrastructure. R15.1 is drafted to make the quarantine attach to the capability rather than the executor's identity, and to keep it until evidence-proven. One word adopts.

**Client documents are written as Anthony**, first person, in his voice. Never mention APIs, tooling, endpoints, field names or how data was obtained. He is selling his expertise, not a generated report.

**No em dashes. Anywhere.** Objected to three times. Use full stops, commas, colons, parentheses. En dashes only in numeric ranges. Check headings, which is where they survive a prose pass.

**Never assert something is absent from a single API reading.** On 2026-07-30 an Instagram post count of zero became a client document's headline finding and was wrong; the profile was full. Before any absence claim, check the surface a real user would see. A permission error nearby disqualifies the whole area from absence claims.

**Verify who controls a system before drafting anything about it.** A DNS request went to the wrong provider on 2026-07-30 because they were in an email thread. Check the system itself. Never speculate in client-facing writing about whether the founder has access to something; ask him.

**R7 autonomy.** Self-initiated work is fine when it is additive, reversible, verified, touches no client-facing surface and writes no production rows. Modifying a live workflow needs a founder ask.

**Rexos `main` is production.** It auto-deploys to app.wmiltd.com. Use a preview branch unless the founder says deploy.

---

## 3. The named agents (vertical-agnostic, shared by both tracks)

Bernard is the **senior paid social strategist and media buyer**, ruled 2026-07-30. Auditing and campaign building are things he does, not what he is. He is intrinsically neither ecommerce nor lead generation, so both tracks use him and both should keep his memory current.

**Where he lives.** Chat at `/bernard` in the portal (`src/components/BernardChat.tsx`, `src/app/api/bernard/chat/route.ts`, `src/lib/integrations/anthropic/bernard-agent.ts`). Claude Fable 5, medium effort, server-side fallback to Opus 4.8. His governed n8n endpoints are in `src/lib/bernard.ts`.

**Tools.** `get_status`, `decide_fix`, `stand_down`, `list_meta_accounts`, `run_audit`, plus `remember`, `revise_memory`, `forget`.

**Memory (live as of 2026-07-30).** Table `agent_memory` (was `bernard_memory`; generalised in migration 0003 so Oscar shares it, scoped by an `agent` column). Migrations 0002 and 0003 both applied, **both against the PORTAL database, not the substrate**, see `docs/substrate-migrations/README.md`. Deliberately separate from `agent_conversations` so clearing the chat drops the transcript and leaves what he knows intact. Read fresh each turn and injected into his system prompt grouped by subject with ids. Seeded with 20 foundational memories. Capped at 150 rows / 24k chars, at which point he is told to consolidate.

**Attachments (live as of 2026-07-30).** PDF goes to Claude as a native document block; .docx text is extracted from the OOXML via jszip; .md, .txt and .csv decode directly. Legacy .doc is refused with a message rather than half-parsed. Limits are 5 files, 3.5MB each, 4MB combined, set by Vercel's body ceiling. Extracted text persists into the transcript; **PDF bytes do not**, so a long PDF thread needs re-attaching.

**Substrate workflows.** `BERNARD_dispatch`, `BERNARD_fix`, `BERNARD_monitor` (daily 09:00), `BERNARD_standdown`, `BERNARD_build`. `RCV_manus_events` is dead code per the §2 canon note and awaits retirement (as of 2026-07-30 both copies are still on the instance, one active); its raw-body RSA-SHA256 verification is the reference pattern for any future signed inbound, documented in the substrate verification report.

**Ad accounts he can currently see** (system user, read-only):

| Account | Business | Track |
|---|---|---|
| act_1027063116856202 WMI UK | WMI | lead gen (DM.ai runs here) |
| act_1766396370547849 Steffen Foerster | Steffen Foerster | lead gen (high ticket) |
| act_575423175548816 Tropical Oasis | Ace Nutrition | ecommerce |
| act_1801857321221826 Luca Summer | Atelier Brunos | ecommerce |
| act_27875735492115545 Mondedutabouret | monde_du_tabouret | ecommerce |

### Oscar (Google Ads and Shopping), live 2026-07-30

**Renamed from "Ask Rexos" on 2026-07-30.** The platform's name was attached to a single-channel specialist: every one of that agent's eight tools is Google Ads (search terms, Merchant Center feed audits, GAQL reads). Founder ruling: the agent is Oscar, Rexos means the platform, and there is no concierge layer because there would be nothing left in it. **Do not call him Rexos in code, UI or writing.**

**Where he lives.** The floating "Ask Oscar" launcher on every admin page (`src/components/RexosWidget.tsx`, still the filename) plus the panel in `src/components/CommandChat.tsx`. Brain is `src/lib/integrations/anthropic/agent.ts`, endpoint `/api/agent/chat`, Claude Opus 4.8.

**Tools.** `list_accounts`, `list_campaigns`, `get_account_report`, `get_all_account_summaries`, `get_recent_changes`, `get_search_terms`, `get_feed_audit`, `propose_optimization`, plus `remember`, `revise_memory`, `forget`. He cannot execute: `propose_optimization` files a reviewable card and the founder approves.

**Persona.** Senior paid search strategist, same seniority framing as Bernard. Owns Google Ads and Shopping across every client, expected to hold a view and defend it.

**Memory: shared table, isolated per agent.** He has zero memories as of 2026-07-30 and will accrue them. Worth seeding him deliberately the way Bernard was, since an empty memory is the slowest way to start.

**Conversation scope is still `command-center`.** Deliberate: renaming the scope would orphan the existing history. Only the persona and the UI strings changed.

**Audit document, live 2026-07-30.** `run_audit` hands the founder a link to the existing Google Ads Audit and Growth Research .docx. Worth knowing that the generator was already there (`src/lib/audit/generate.ts`, with account-type detection, a severity-graded diagnosis pass and a forecast) and already reachable from the client page via `GenerateAuditButton`. **The only gap was that it could not be reached from a conversation**, so nothing was rebuilt: `/api/audit/[clientId]` gained a GET handler alongside its POST (a link is a GET; the button still POSTs, both share one implementation), and Oscar's panel gained link rendering and a download chip, which it had never had.

Constraint to know: the audit is keyed by **client id**, so it only covers imported clients. A bare MCC account visible under the roster has no client record to attach one to, and Oscar is told to say so plainly rather than invent an id.

### Shared memory infrastructure

Table **`agent_memory`** in the **portal** database, migration 0003, applied and verified 2026-07-30. One row per memory, scoped by an `agent` column (`bernard`, `oscar`). Scoped on reads and writes both, so neither agent can revise or forget the other's memories: a conclusion about Meta delivery rarely transfers to a search auction. Deliberately separate from `agent_conversations`, so clearing a chat drops the transcript and leaves what the agent knows intact.

Verified at merge: 20 memories, all attributed to bernard, isolation confirmed by attempting a cross-agent update and getting a zero row count.

**If you add a third agent**, it needs a name that is not "Rexos", an `AGENT` constant, and its memories are free: pass its name to the same four functions in `src/lib/agent-memory.ts`.

---

## 4. Lead generation track

**DentalMastery.ai** (slug `dental-mastery`, never `dentalmastery`, the wrong slug silently writes zero rows). B2B, sells to US dental practice owners, runs inside the WMI UK ad account because the founder hit his Business Portfolio limit.

Live: a warm-up engagement campaign and a leads campaign using Meta Instant Forms against the Apollo list audience (`Apollo Dental Mega List July 26`, 16,536 contacts uploaded, ~4,300-5,100 matched). Targeting is list-only and verified so: `advantage_audience: 0`, `targeting_relaxation: {custom_audience: 0, lookalike: 0}`. Conversion spine is live and Meta-verified, `Lead` and `Schedule` server-side into dataset 867153482888947 via `CAP_meta_conversions`, GHL workflows firing it, Slack to #dentalmastery-leads. Legal pages published (privacy, terms, cookie settings) with a consent banner gating the pixel.

Open: as at 2026-07-30 the leads campaign had produced no leads on roughly 15 clicks, and the budget reads £15/day rather than the £30 the founder set. The decision point is ~30 cumulative clicks: still zero and the problem is the ask, not delivery. Frequency is already ~2.1 against a small pool, so the list-only experiment has about 7 to 10 clean days before ad blindness contaminates it. Performance goal cannot be changed after publish, so any change of optimisation means a duplicate ad set.

**KST Accountants.** THE BLUEPRINT, ruled 2026-07-30: a minor account by revenue that exists to be cloned for the next accountancy client and the next non-dental lead gen client. Build to be cloned, not just to work.

Done: sending domain `mail.kst-accountants.co.uk` live at IONOS, all six records verified authoritatively and propagated, warm-up Stage 1, SSL issued, From set to Kris Thiemelay / info@kst-accountants.co.uk. Root domain untouched (Microsoft 365 behind MailAnyone). Three GHL workflows exist: two OCT stage workflows and Website Lead Notifications.

Blocked: the nurture sequence is written (`~/Documents/KST_NURTURE_SEQUENCE.md`, six emails over fifteen days) but **not built**, because every email points at a consultation booking page that does not exist and we have no access to Kris's calendar. Parked by the founder.

**OCT unblocked for KST, triaged 2026-07-31.** The 1,191 malformed OCT tasks are a bounded, closed incident: 13 to 25 June only, nothing since, and 1,177 of them belong to **shallowford-smiles** with zero KST rows. The request payloads are OpenDental sync-trigger envelopes (`{"run":"opendental_sync","client_slug":"shallowford-smiles"}`), not conversion data at all, so they are sync runs mislabelled into an OCT failure status rather than genuine OCT failures. OCT itself dispatched successfully 22 times in July. The founder's hold ("do not activate KST OCT on an unclassified failure pattern") is therefore satisfied: the pattern is classified. Caveat recorded honestly: `result` is null on every affected row, so the mechanism is read from the request shape, not from a stored error.

Outstanding: **capture KST as a GHL snapshot.** `snapshotId` is empty, so nothing there is portable, which defeats the blueprint purpose. Grows harder with every hand-built addition. Also note GHL workflow creation is UI-only; `POST /workflows/` returns 404, and no scope grant changes that.

**Steffen Foerster.** High-ticket Galapagos photography workshops, $15,900-25,900, October charter-commitment deadline. Audit delivered (`~/Documents/SF_GALAPAGOS_META_AUDIT_JULY26.docx`). Root cause is a signal problem: everything optimises to the pixel Lead event with nothing downstream fed back, so Meta cannot distinguish a qualified buyer from a browser. Google and Microsoft Ads research went to Cowork. Awaiting his response.

**Call tracking number map, done 2026-07-31** (`docs/CALL_TRACKING_NUMBER_MAP.md`). KST is clean: one landline everywhere plus Kris's mobile, no existing tracking layer, so a tracking number is a one-edit swap in the site repo. **Shallowford has three distinct 423 numbers** (two on the site, a third in the GHL record), the footprint of a pre-existing tracking or forwarding layer: touch nothing there until a human identifies the real front-desk line. The DM funnel deliberately has no phone. Three founder-side checks remain (GHL Settings then Phone Numbers per location, since the API scope 401s; Google Business Profile numbers; any legacy CallRail or Twilio account), and none of them blocks the WMI agency number purchase.

**Twilio, agency level. Scope ruled 2026-07-31: UK numbers only.** WMI UK does not purchase US numbers; US clients buy their own (CallRail setup for them is a later conversation, not now). Shallowford is out of Twilio scope entirely. Architecture stands: own Twilio account, sub-account per client, GHL `twilioRebilling` on, **geographic** numbers only (the Ofcom 15 July 2026 statement kills +44 7 CLIs from abroad as of July 2027). Legality verified in `~/Documents/TWILIO_UK_FROM_UAE_RESEARCH.md`. **A Twilio account exists**; waiting on the founder to log in and mint an API key into the substrate env. First two deliverables when it lands: the WMI outbound number (calls and SMS to UK prospect mobiles from Dubai, not for website display) and KST call tracking (swap the site number in `lib/site.ts`, forward to 020 3150 2074).

---

## 5. Ecommerce track

**Monde du Tabouret** (slug `monde-du-tabouret`). Shopify bar stools and chairs, France and Belgium, mondedutabouret.fr, EUR, page 341731552612640 connected.

Two campaign shells exist and are PAUSED, structure verified independently by the founder. **Phase 0 is still blocked as at 2026-07-30**, re-verified live that day: zero pixels on both the ad account and the client business 908995597197130, and the two catalogs are shells (`Catalog_products` with 1 product, `Tabouret France` with 0) with no pixel attached as an event source on either. The single blocker is the client completing the "Facebook and Instagram by Meta" app setup in Shopify, which creates the pixel and streams the range. **Do not green-light Phase 1 on a 0-or-1-product catalog.** WMI holds ADVERTISE and MANAGE on both catalogs, so the build has the access it needs the moment the range arrives.

**Corrected 2026-07-30: "no product feed" is not a valid test for whether a Shopify sync is live.** This file previously read the missing feed as proof of a hand-made catalog. It is not. The Atelier Brunos catalog is a fully working Shopify sync with 220 products and it also reports `feed_count: 0` and zero `product_feeds`, because the Shopify app syncs through a commerce-merchant connection rather than a scheduled feed file. Further, MDT's single product is a genuine Shopify product (a mondedutabouret.fr product URL, a Shopify CDN image, EUR 180, in stock) and the catalog carries a `commerce_merchant_settings` record, so it reads as a stalled or partial sync, not something hand-built. **The fields that actually separate a live sync from a shell are `external_event_sources` (is a pixel attached) and `product_count`.** The gate stays shut on those two; only the reasoning was wrong.

**The Phase 0 monitor was one condition away from a false green. Fixed and live 2026-07-30, founder-approved.** `BERNARD_monitor` (n8n `RGKYojPeH06ALtLC`, cron `0 9 * * *`, Europe/London, error workflow `MAINT_error_alert`) always ran reliably; the defect was what it tested. Its `catalog_ok` was `product_count > 0`, which the 1-product shell already satisfied, so only `pixel_ok: false` was holding the gate and the client's app install would have tripped a green light against a one-product catalog.

The gate is now three clauses, all of which must hold:

1. a pixel exists on the ad account or the client business,
2. a catalog carries **at least 20 products** (founder-set floor) **and** has that pixel attached as an `external_event_sources` entry, so dynamic ads have something to retarget against,
3. no check failed.

Clause 3 matters because the Meta HTTP nodes run `onError: continueRegularOutput`, so a failed read returns empty data rather than throwing. That fails closed, which is safe against false greens, but it made a permission breakage indistinguishable from "still blocked". Failed checks are now collected per client and surfaced as a red CHECK FAILED line.

Notification changed from green-only to state-change. A new `Prev state` node reads the last `daily_monitor` verdict out of `action_log` and the run posts to #alerts only when the verdict changes or a check fails, so silence now means "nothing has moved" rather than "possibly broken". The `Manus usage` node is removed, per the cancellation in §2.

Verified before and after deploy: nine offline scenarios against real Graph payloads (including the exact false-green case, the floor boundary at 19/20, an unlinked catalog, and a permission error), both SQL statements against the live database with the insert rolled back, all three Slack templates rendered, then a live scheduled execution with the Slack nodes disabled. That run computed `catalog_ok: false` where the old code computed `true`, and both IF nodes routed correctly. Backup of the previous definition and the build script are in the session scratchpad; the nightly `Daily Backup to GitHub v2` also covers it.

**One consequence to expect:** the verification run wrote a `daily_monitor` row in the new format, so the 31 July 09:00 run will compute an unchanged verdict and stay silent by design. That is correct behaviour, not a failure.

Phase 1, when unblocked: four product sets, four ad sets in the existing campaign `120250024094940369`, four Advantage+ catalog carousel ads, all PAUSED. Product-set filters must come from real feed fields; skip and flag anything that cannot be expressed rather than approximating.

**Atelier Brunos / Luca Summer** (act_1801857321221826). DTC men's Italian leather footwear at $250, US, atelierbrunos.com. Note the naming: ad account "Luca Summer", Meta business "Atelier Brunos", ranges Lord and Penny. **A fourth name is in the account's orbit**: the catalog's commerce-merchant contact is style@lucavenicci.com against the Shopify store `2cd3d6-2.myshopify.com`. Confirm which entity is the client of record before anything client-facing goes out.

Audit delivered and then corrected (`~/Documents/LUCA_SUMMER_META_AUDIT_JULY26.docx`). State: $1,783.84 lifetime, 4 purchases, $1,242.50 revenue, ROAS 0.70, CPA $446 against a $311 AOV. The ads are good (4.99% CTR) and the product page is good (127 five-star reviews, warranty, size guide, 28 images). Four structural faults: no usable retargeting layer at all, Purchase optimisation on 4 conversions in 10 weeks, discount creative at ROAS 0.38 against brand story at 1.15, and five identical ad sets bidding against each other. Audience Network is producing fraudulent engagement that contaminates the conversion data. The largest uncaptured gain is the site's low add-to-cart rate, which needs Shopify and GA4 access to diagnose.

**Verified live 2026-07-30, and it refines the retargeting fault.** The account is dark: every ad set is PAUSED or CAMPAIGN_PAUSED and spend stops on 27 July. The last 30 days ran $1,340.41 for 2 purchases and $462.50, a ROAS of 0.35, so roughly three quarters of lifetime spend went through the final month at half the lifetime ROAS.

The blocker on retargeting is **not** a missing catalog. Catalog `1376435071254094` is a live Shopify sync, 220 products, with pixel `4240166812964720` attached as an event source and product links correctly on atelierbrunos.com. Five product sets exist. What breaks dynamic retargeting is the catalog's content:

- **`item_group_id` is empty on all 220 products.** Size and colour are populated, so Meta sees 220 independent products rather than variants of 8 styles, and a dynamic carousel will show the same shoe repeatedly in different sizes.
- The 220 items are 8 styles: Lord Yacht Loafer (49 variants), Penny Yacht Loafer (42), Lord Espadrilles Loafer (30), Penny Espadrilles Loafer (30), Leone Yacht Shoes (25), Leone Espadrilles Shoes (20), Leather Suede Boots (14), Primal Yacht Boaters (10).
- **112 of 220 variants (51%) are out of stock** and so excluded from dynamic ads. Three styles are entirely dead: Leone Yacht Shoes, Leone Espadrilles Shoes, Leather Suede Boots. A whole-catalog retargeting set is really retargeting five styles.
- Catalog diagnostics flag all 220 items as having only one image, so carousel and collection formats have nothing to rotate.

The audience layer is equally the constraint. Four custom audiences exist and none can serve: `IG Shop WT 180` and `FB Shop WT 180` both return delivery_status 300, "audience is too small to be used"; `WT 180 Days` and `PUR 730 Days` sit at roughly 20 people. The one ad set referencing a retargeting audience (`02_Broad A+ Footwear`) includes `WT 180 Days` **with `advantage_audience: 1`**, which lets Meta spend outside it, so it is a broad ad set wearing a retargeting label. No ad set anywhere excludes `PUR 730 Days`. Note `WT 180 Days` is configured with `retention_days: 730` despite its name.

Two corrections to the audit's supporting figures. Audience Network lifetime is $10.84 spend, 122 clicks, 5.26% CTR, 16 add-to-carts and 0 purchases: the contamination finding holds in substance (16 of roughly 47 lifetime add-to-carts off $11 of spend) but the "35.8% CTR on rewarded video, 15 add-to-carts from 35 clicks" figures were not reproduced at account level and need re-checking at the placement breakdown before they are repeated. And the sharpest funnel leak in the last 30 days is add-to-cart to checkout, not checkout to payment: 22 add-to-carts, 4 initiate-checkouts, 2 purchases, with both add-payment-info events converting.

**Tropical Oasis** (act_575423175548816, Ace Nutrition). Audit delivered previously. Awaiting client reply.

**Patterns this track will need that the lead gen track does not:** catalog and feed health, Advantage+ Shopping, dynamic product retargeting, `Purchase` and value optimisation rather than `Lead`, ROAS and AOV rather than cost per lead.

**Corrected 2026-07-30: catalog diagnostics are available, and they are worth running.** This file previously said diagnostics were unavailable for both Shopify clients because the catalogs were not properly shared or synced. The Atelier Brunos catalog returns a full `diagnostics` payload on request, and that is where the out-of-stock and single-image faults above came from. WMI also holds ADVERTISE and MANAGE on both Monde du Tabouret catalogs. So the read access is there; nobody had asked. The useful read set is `owned_product_catalogs`, then per catalog `external_event_sources`, `product_sets`, `agencies`, `diagnostics`, and a `products` page for `item_group_id`, `availability`, `size`, `color` and the link host. This is the diagnostic worth packaging, and the two clients between them supply both a healthy case and a shell case to test it against.

**Commerce ingestion programme (new, substrate-wide).** CODE_BRIEF_1b (substrate-side shape verification for the Shopify commerce build) was executed 2026-07-30 by the ecommerce session. Report: `~/Documents/REPORT_commerce_substrate_shape_verification_2026-07-30.md`. Every item resolved LIVE-VERIFIED, nothing unreachable. Headlines a fresh session should not rediscover: raw-body HMAC in n8n is viable and already proven live (`RCV_manus_events`, `rawBody: true` + crypto in a Code node); the live `RCV_ghl_stage_event` is NOT ack-first (`responseNode` after the DB write), so the commerce receiver must choose ack-first deliberately; `GHL_contact_caller_TEMPLATE` is not on the live instance, only the Shallowford instantiation; the n8n `postgres` role has `rolbypassrls = true`, so tenant RLS binds read roles only; there is no DEV database on the conversion plane; OCT Route 1 dispatches through two Make.com webhooks (a dependency absent from canon) and Route 2's endpoint is this repo's `src/app/api/oct/upload/route.ts`; the live `RCV_form_routing` still carries a raw Shallowford PIT inline (DEV caller version ready, cutover never happened); n8n is 2.31.5. The Phase A build brief is Chat's to write from that report.

---

## 6. Deployed, staged, blocked

| Thing | State |
|---|---|
| Bernard attachments + memory | **Live on production** (main, 2026-07-30). 20 memories seeded. |
| Oscar (renamed from Ask Rexos) + shared `agent_memory` | **Live on production** (main, 2026-07-30). Migration 0003 applied and verified. |
| Oscar audit document via chat | **Live on production** (main, 2026-07-30). Reuses the existing generator; only the chat route to it was missing. |
| `growth_action` view, read-only role | Applied (migration 0001) |
| DM.ai campaigns | Live and spending |
| KST sending domain | Live and verified |
| KST nurture sequence | Written, not built. Blocked on a booking page. |
| KST GHL snapshot | Not started. Blocks the blueprint purpose. |
| MDT Phase 1 | Shells PAUSED. Blocked on client Shopify app setup. |
| MDT Phase 0 monitor | **Fixed and live** (2026-07-30, founder-approved). Gate is now pixel + 20-product floor + pixel linked as event source + no failed checks. Posts on state change, not green only. Manus node removed. |
| Atelier Brunos account | Dark since 27 July, all ad sets paused. Awaiting founder decision plus Shopify and GA4 access. |
| AB catalog `item_group_id` | Empty on all 220 products, and 51% out of stock. Client-side Shopify fix, blocks effective dynamic retargeting. |
| Twilio UK number | Decided, blocked on credentials |
| Steffen proposal | Delivered, awaiting client |

---

## 7. Working notes for parallel sessions

Both sessions share this repo, the substrate, Supabase, the GHL account and Bernard. So:

- **Coordinate through this file.** Update it when something lands, gets blocked, or a ruling is made. That is the whole mechanism.
- **Agent memory is the other shared surface.** If you learn something durable about an account, it belongs in `agent_memory` (portal DB, scoped by the `agent` column: `bernard` for Meta, `oscar` for Google) so the other session's agent has it too.
- **Watch for collisions on shared files.** `src/lib/integrations/anthropic/`, `src/lib/bernard*.ts` and the substrate workflows are touched by both tracks. Check `git status` and recent commits before editing.
- **Migrations are numbered sequentially** in `docs/substrate-migrations/` (0001 to 0003 taken; **0004 claimed by the ecommerce session 2026-07-31** for `0004_commerce_schema.sql`, target substrate; next free is `0005_`). Two sessions creating the same number will conflict, so claim it here when you start one, and state the target database in the file header per the README.
- Client documents live in `~/Documents/`, not in the repo.
- Credentials are in `~/.config/singularweb/substrate.env` (chmod 600) and `.env.local`. Reference them by variable name; never echo values.

# SingularWeb Project State (strategy surface)

**What this is.** The strategic-truth counterpart to Code's `PROJECT_STATE.md`. Code's file records what is deployed, where, under which credential names. This file records what was decided and why, what each client proved, what the blueprints template, what the doctrine now says, and what is owed. Where they overlap (the client book), Code's file is authoritative for technical state and this one for commercial and strategic state. Neither rewrites canon; both point at it.

**Where it lives.** Three places, kept identical: this Claude project's knowledge panel (the founder uploads), the platform repo alongside `PROJECT_STATE.md` (Code mirrors), and seeded into sibling projects (DentalMastery, skincare) as the parent context. If copies diverge, the most recent changelog entry wins and the others are refreshed.

**Sync horizon (read this first).** Last reconciled against Code's PROJECT_STATE: **2026-09-03, repo commit `243fb55`** (Code verification pass; see §12). Last Chat-side event recorded: **2026-08-28** (DentalMastery handover v2). Items marked UNVERIFIED in §8 were filled from live reads on 2026-09-03. Corrections carry the marker **[Code 2026-09-03]** and their evidence is in §12.

---

## 0. Changelog (newest first; one line per change; this is what makes the file alive)

- 2026-09-04 · Oscar read gaps (hybrid-model build order step 1), first tranche landed on a preview branch: full campaign list with budgets and bidding, change history with editor attribution over 29 days, four-window report with conversion-action config, account-holder read; §8 updated; deploy awaits the founder.
- 2026-09-03 · Fly-Rides: HubSpot MCP connected (founder's seat, connector in the client portal); four closed-won deals written and read back; Muneeb's Google Data Connector identified as the second import pipeline (double-count suspicion); Zap fix blocked on Scott sharing his private Zap folder.
- 2026-09-03 · Fly-Rides channel: HubSpot and Zapier seats granted; §6.6 filled (case (a), Fly-Rides, free remediation, four acceptance criteria, checkpoint w/c 22 Sept); read/write method ruled (HubSpot MCP); §10 updated; technical shape in repo `docs/HUBSPOT_CLIENT_BLUEPRINT.md`.
- 2026-09-03 · Denis 5a dupe-exclusion audience: dry-run job live, zero writes, 10 owned contacts against a floor of 100; go-live needs three rulings (design note in repo).
- 2026-09-03 · Founder adopted Chat's two edits: verifier-recorded moves only count toward graduation (count reset to 0 of 50, the four 26 Aug moves labelled hand-reconciled); "declared is not enforced" doctrine added to §9.
- 2026-09-03 · Chat's reply reconciled: wmiltd funnel run confirmed from the 6 Aug records (12:51 to 12:57 UTC, end to end), Code's morning evidence withdrawn as an instrument error, 28-day recording lapse owned; R-g closed by dates; Chat's two proposed edits recorded as PROPOSED; remaining audit items parked by the founder.
- 2026-09-03 · Meta token moved from query-string to header auth across all 21 Graph nodes; the 8 stored executions that held it pruned on the founder's word; instance-wide re-scan clean.
- 2026-09-03 · n8n and Supabase audit (`docs/N8N_SUPABASE_AUDIT_2026-09-03.md`): six fixes live (error handlers, internal webhook auth, null-tenant guard, Drive quota offset, probes off); backups confirmed daily since 16 Aug; eight founder items listed in §10.
- 2026-09-03 · Founder ruling: the repo copy is the master; every Code session reads §0 and §4 at start and updates this file in the same commit as the change (AGENTS.md, PROJECT_STATE §7, §11 here). Validation report for Chat at `docs/SINGULARWEB_STATE_VALIDATION_REPORT.md`.
- 2026-09-03 · Optimise glue smoke built (`tests/optimise-glue.smoke.js`); two live verifier bugs found and fixed, both workflows redeployed; §8 and §10 updated.
- 2026-09-03 · Oscar's Norbert insertion built (spec §9) and proven live on three Fly-Rides proposals; §8 and §10 updated.
- 2026-09-03 · WE BET test client deleted by the founder; §7 and §10 updated.
- 2026-09-03 · Code verification pass: 9 falsifications corrected inline (§1, §4, §5, §7, §10), §8 filled from live reads, §12 appended with evidence, missing rulings added to §4, Gopoxy and Fly-Rides added to §5, booking engine, upsells and agent optimise added to §7. Mirrored to the repo as `docs/SINGULARWEB_PROJECT_STATE.md`.
- 2026-09-03 · File created. HubSpot blueprint entry opened as a template (§6.6) pending founder input. Unverified items from Code flagged (§8). Sync horizon declared.

## 1. Surfaces and workspaces

| Surface | Machine | Owns | Memory of record |
|---|---|---|---|
| Chat, this project | any | strategy, canon, rulings, commercial copy, decisions before handoff | this file + canon set |
| Code, platform session | Mac mini | **[Code 2026-09-03: the substrate/portal split by machine is false. One Mac mini session ships both the Next.js portals and the substrate workflows; the Windows machine holds the long Shallowford sessions.]** n8n, Supabase substrate, agents' runtime, commerce spine, OCT, portals | `PROJECT_STATE.md` §1, §2, §7 |
| Code, per-client channel sessions | Mac mini | **[Code 2026-09-03: missing surface.]** One session per client since 2026-08-15, each owning `docs/clients/<slug>.md` (15 channel files). Cross-client lessons go to shared memory, which since 2026-08-18 lives IN the repo (`docs/memory/`) and crosses machines by git pull | its channel file |
| PPC Mastery AI workspace | other machine | app.ppcmastery.ai, app.adenergy.online, DentalMastery execution (handover in progress) | its own repo + handover pack |
| Chat, DentalMastery project | any | DM strategy and canon | DENTALMASTERY_CHAT_PROJECT_INSTRUCTIONS |
| Chat, skincare venture project | any | brand, product, sourcing, regulatory | SKINCARE_VENTURE_PROJECT_INSTRUCTIONS |

**Provenance rule (from Precedence v3):** work done on one surface reaches another only when a human carries it. Nothing crosses by assumption. Decisions are written down before crossing to Code.

## 2. Entities

| Entity | Jurisdiction | Role | Notes |
|---|---|---|---|
| SingularWeb Ltd | UK | OS, IP, trademark holder | the engine brand |
| WMI Ltd | UK | agency book, GBP portal, UK telephony | app.wmiltd.com; funnel never run as of last sync |
| WMI FZCO | UAE | USD/AED portal, took first automated payment | app.webmarketinginternational.com; services activities only (no trading) |
| ADENERGY SP. Z O.O. | Poland | DentalMastery.ai legal owner, 50/50 with Baptiste | GDPR/UODO; entity contradiction with R13 pending R18 |
| PPCMastery | (Baptiste, Thierry) | independent sister company | O2: integration retired; intended acquisition partner |
| Baptiste Jénard PPC | (Baptiste, prior entity) | holds Shallowford service contract | distinct legal person; BAA chain origin |
| Adriaan.ai | three-way founding team | SaaS, naming finalised (backronym) | Adrian Capraru technical co-founder |

## 3. Canon set (pointers, current versions)

DOCUMENT_PRECEDENCE_v3 · CAPABILITY_REGISTER_v1 (O1-O10 ruled) · CLIENT_PROOF_PHASE_BRIEF (R1-R16, R15.1 adopted 2026-08-08) · Aligned_Vision_v2_4 · Founder_Build_Playbook_v4_1 · SINGULARWEB_PLATFORM_ARCHITECTURE (with R14/R16 canon note) · CANON_SWEEP_2026-07-30 · SINGULARCOMMERCE_CAPABILITY_MAP_v1 (2026-08-12 version) · SingularCommerce_v2_1_Founder_Response · RULINGS_AND_PARK_RECORD_2026-08-05 · STRATEGY_RESPONSE_STREVIO_EXTRACTION · CODE_BRIEF_BERNARD_DENIS_ADOPTIONS · BERNARD_ROADMAP_ADDENDUM_2026-08-12 · DENTALMASTERY_HANDOVER_PLAN_v2.

**Oldest debt:** Workframe v1.2 redraft (v1.1 is four Vision generations behind). Client-proof phase formal close and successor phase brief still owed by Chat.

## 4. Rulings ledger

**Adopted (do not relitigate):** R1-R16 per phase brief; R15.1 (WMI Meta quarantine, 2026-08-08, graduation bar: 10 verified builds, 3 clients, 1 showable live campaign); O1-O10; R-c (Growth-tier operators triggered by KST); R-g (client portal = authed dashboard; tier copy amended 2026-07-16 but **never uploaded to Drive**: closed by dates 2026-09-03, the Drive copy was last modified 2026-07-06 so cannot carry it; founder action stands: upload, or leave to the revival checklist); 2026-08-05 park package (runtime PARKED, trigger "first client whose deal includes web chat"; **[Code 2026-09-03: ingest is NOT disabled. MAINT_kb_ingest was failing on a Drive quota bug, fixed 2026-08-08, active since, and ingested VIP's knowledge base on 2026-08-15.]** ledger kept; R16 programme retired, leakage language retained as copy asset); DM widget captures route to #dentalmastery-leads (ruled 2026-08-05, **execution outstanding**, subject to the verification in CHAT_TO_CODE_DM_WIDGET_DPA_RESOLUTION).

**Ruled since the last sync, missing here [Code 2026-09-03]:** the agents-and-contractors operating model (2026-08-18: human contractors stay; Bernard and Oscar build and optimise only in founder-triggered sessions to complement or correct the freelancer; Norbert supervises both; watch-and-flag is the resting posture). The seven optimise rulings (2026-08-18): own R15.1 bar of **50 approved moves with zero reversals, counted per agent**; no waiting on build's graduation; pause and budget only in v1 (audience exclusions added in v1.1, 2026-08-26); Norbert as a different model from the agents; daily ceiling 3 per account; on demand only; first accounts Steffen and Gopoxy. Naming convention: agency prefix `WMI |`, never client initials (2026-08-06). WhatsApp claims register (2026-08-06): approved and banned claims, mandatory volume caveat, 30-minute window is a tunable default not a finding.

**Adopted 2026-09-03 (proposed by Chat, ruled by the founder: "adopt both"):** (a) Optimise graduation counts only moves the verifier recorded unaided. The four hand-reconciled moves of 26 August stay in the record labelled hand-reconciled and do not count; **the optimise graduation count is therefore 0 of 50 as of today.** (b) Doctrine, also in §9: no verifier's count is trusted until a glue-level replay harness has proven it recording real writes unaided; a control never observed catching or recording a real event is declared, not enforced. Third instance of the pattern (parser scoring, contract v2 report-shape claim, optimise verifier), and three is doctrine.

**Drafted, awaiting founder:** R17 (Rexos disambiguation: doorway vs capability). R18 (DentalMastery entity, with three consequences: R13 amendment, O10 badging as ADENERGY's commercial decision, ADENERGY-to-WMI DPA under GDPR Art. 28). E1 (DM Meta account separation; Chat recommends separate). E2 (DM plumbing stays substrate-hosted; Chat recommends yes, conditional on R18c).

**Owed, unruled:** cold-outreach sender identity (Kelsey Lane); dental claims register; O5/R-d feed-management tier copy; **[Code 2026-09-03: economics instrumentation is DONE, not owed: `docs/ECONOMICS_LEDGER.md` 2026-08-18, agents metered since, see §8.]** Two rulings raised by the Steffen channel 2026-08-26 and still unruled: incident mode (raised ceiling with its own audit trail) versus hands-off for escalations; and whether defensive moves are exempt from the reversal count that feeds the graduation bar.

## 5. Client book (commercial state; Code's file holds technical state)

| Client | Entity | Terms | Status / role |
|---|---|---|---|
| Atelier Brunos (Gibran Zaki = Luca Summer, one client) | FZCO | AED 1,800/m | first automated portal conversion; Meta DTC footwear; month-one framed as signal rebuilding |
| instawarm.shop (Vincent) | FZCO | $350/m + $225 one-off | first-merchant candidate; Shopify access pending; baseline freezes before fixes |
| Steffen Foerster / Galapagos | Upwork | $1,000/m | Bernard-handled audit + comms; M2 conversion actions live |
| Super Henry (Rhodri) | WMI Ltd | £650/m proposed | GBP client; wmiltd funnel must be rehearsed before signature |
| KST Accountants | WMI Ltd | Growth tier | THE blueprint (accountancy, Google, OCT, call tracking); snapshot not captured |
| VIP Accounting (Kyle Randall) | WMI Ltd, **joint project with Baptiste under PPC Mastery** | onboarded | blueprint run 1. **[Code 2026-09-03:** knowledge base ingested 2026-08-15 (21 chunks); six nurture emails approved by Kyle 2026-08-17, still unbuilt (UI-only); call tracking is CallTrackingMetrics on Baptiste's plate, not ours; pricing floor moved to £100 at Kyle's agreement 2026-08-16.**]** |
| DentalMastery.ai | ADENERGY | own property | handover to PPC Mastery workspace in progress. **[Code 2026-09-03:** first live strategy-call lead 2026-09-01 (solo general dentist, $2k-$5k band); the pipeline delivered it in under a second and nothing automated answered because all six nurture workflows are still drafts; GHL's contact index trailed the row by 24 minutes.**]** |
| Shallowford Smiles | BJ PPC | client of a related entity | deliberately untouched; patterns transfer, data never |
| FiltersFast | Upwork | $6,500/m | Google/Bing; store connection deferred (too big too soon); pagination required (2,400 orders/wk) |
| HoI | ad book | | standout merchant candidate; report drafted; store-ask is founder's call |
| Vasco FR | ad book | | largest account; audit findings engine proven here |
| Monde du Tabouret, Welzo | partner side | | coverage-gap analysis candidates (Baptiste's request) |
| ~~Kyle~~ | | | **[Code 2026-09-03: duplicate row. Kyle Randall IS VIP Accounting; merged above.]** |
| **Gopoxy** | | freelancer-managed | **[Code 2026-09-03: missing from the book.]** Ruled untouched 2026-08-13 (agents watch-and-flag), founder-invoked exceptions since 2026-08-17; named first optimise account 2026-08-18 alongside Steffen; substrate row and Meta ad account `act_282111861642935` provisioned |
| closrleads / Joey (Denis) | consulting | $95/h, manual time, 8-12h/wk | advisory on their autonomous buyer; no write access; Bernard as invisible back office with data wall |
| Buggy Trip Marrakech | prospect | free (retention motive, never stated to client) | first WhatsApp bridge prospect. **[Code 2026-09-03:** demo videos shot 2026-08-11; French proposal written and handed to Baptiste, unsent as far as Code knows; gated on Baptiste confirming auto-tagging ON, still unconfirmed.**]** |
| **Fly-Rides (Scott Good)**, the HubSpot client | WMI Ltd, `reporting_only` | **no retainer.** Two open founder offers: $500 one-off pay-if-fixed (2026-08-21, Scott granted HubSpot seat); $500/m incl. HubSpot management conditional on reactivating the Google Ads contract (2026-08-24, unanswered) | **[Code 2026-09-03: filled from `docs/clients/fly-rides.md`.]** Austin party bus hire; Google Ads 7345621720 under AM MCC J, USD, $4.3k/30d, Scott runs the account himself; HubSpot portal 7339040; GTM-WVSXKJM. Scott's open ask 2026-08-27: deal-name merge field, offline conversion import of closed-won amounts, GTM enhanced conversions. **Microsoft Ads is a pitch, not an account.** Unresolved: a third party with ADMIN access quoting Scott his own $2,000/m retainer. For §6.6: this is case **(a)**, keep HubSpot and integrate, by the client's own choice. |

## 6. Blueprints (what each client proved, what it templates, what it taught)

Each blueprint is a client whose build became a reusable pattern. The rule: a blueprint is real when a second client provisions from it by configuration and content alone.

**6.1 KST Accountants (accountancy, Google-led).** Proves: OCT dual-platform, GHL-native call tracking on own Twilio, six-email nurture, per-location PIT provisioning. Templates: the accountancy sub-account, nurture sequence, call-tracking pattern. Taught: legacy materials lie; native attribution fields beat custom ones; snapshots must be captured BEFORE hand-additions accumulate (still not done). Gap: snapshot not captured, blocks the blueprint purpose.

**6.2 VIP Accounting (blueprint run 1).** Proves: the clone path from KST. Taught: whether provisioning was genuinely config-only or hand-built is unresolved (Code owes the step-by-step); this decides whether exit criterion 4 was met or claimed.

**6.3 Shallowford Smiles (dental vertical).** Proves: deterministic clinical gate with no model in the tripped path, 0.6 threshold with warm handoff, shared vertical KB plus per-practice sign-off, AI disclosure always, self-first-shadow-assisted-autonomous ladder. Templates: the DentalMastery layer (R8). Taught: capture surfaces need watched destinations (unanswered Messenger leads); landing pages must be tested not admired; BAA chains follow the contract-holding entity. Status: deliberately untouched; lessons digest owed, founder-reviewed before crossing.

**6.4 Atelier Brunos (DTC Meta, portal-native).** Proves: invite-to-paid in 32 minutes on live rails; Bernard dispatching real builds with read-back. Taught: executor honesty failure (parser scored creates as failures, four orphans); month-one expectations run from payment, not launch; portfolio concentration risk.

**6.5 instawarm.shop (first merchant).** Proves (pending): the Shopify recipe on a real merchant; fourteen-day reconciliation gate. Taught already: baseline-freeze-before-fixes is commercially load-bearing (settles the mentor's argument with data); claims discipline sells (21-zone vs 9-zone).

**6.6 HubSpot client: Fly-Rides (case (a), first run opened 2026-09-03).**
- **Client, entity, terms:** Fly-Rides (Scott Good, Austin party bus hire), WMI Ltd, `reporting_only`, no retainer. Founder accepted responsibility for the original HubSpot to Google Ads build (Muneeb's work) and is remediating **free of charge**; Scott dropped his discount request in return. Two founder offers still open: $500 one-off pay-if-fixed; $500/m incl. HubSpot management if the Google Ads contract restarts.
- **Decision:** **(a) keep HubSpot and integrate**, by the client's own choice. This is the CRM-agnostic operator blueprint.
- **What it must prove (agreed acceptance criteria, 2026-09-02):** offline import recording with user-provided data; click id capture measured **on paid-search enquiries only** (paid is 11% of contacts, so the earlier "16% overall" was at ceiling, not failure); real deal amounts, not placeholders; deal automation clean and deal names resolving. Checkpoint week of 22 September, written status at two weeks.
- **Already shown before any HubSpot write:** the import works and attributes revenue to campaigns (57.5 imports, $103,265, 100% campaign-attributed since 25 June); the "$900 hardcoded" claim was a non-forced default. The real value defect is two web actions feeding placeholder and zero values into value-based bidding.
- **What it templates:** access via named seats on our identity (never shared logins; Zapier needs Teams for a member seat); the read/write method (**founder-ruled 2026-09-03: HubSpot official MCP for reads and supervised writes**, private-app API only for a future substrate leg, Zapier UI-only by hand); the diagnostic checklist and the acceptance-criteria discipline. Technical shape: repo `docs/HUBSPOT_CLIENT_BLUEPRINT.md`.
- **Provisioning target:** unchanged. Per-portal MCP auth app recorded as the same exception class as a per-client GHL caller.
- **Learnings so far:** name the denominator before agreeing any rate target (on the agreed measure, paid-search click id capture was already 83%, 96% excluding Google Business Profile clicks, so criterion 2 was met before any work); a diagnostic banner is not the conversion data; claimed fixes get read back (two of the client's stated fixes were not in effect).
- **Owner of the first write-up:** Code has the technical shape (above); Chat owes canon once the checkpoint passes.

## 7. Product lines and status

| Line | Status | Governing artefact |
|---|---|---|
| Paid media MaaS (Bernard, Oscar) | LIVE, revenue-bearing | phase brief, Bernard specs |
| Entity portals (wmiltd GBP, FZCO USD/AED) | LIVE; both proven. **[Code 2026-09-03, evidence corrected after Chat's reply: the wmiltd funnel ran end to end on 2026-08-06, 12:51 to 12:57 UTC, on test client WE BET: invite emailed, details confirmed, contract generated and signed (PandaDoc), checkout, payment_completed, client_activated, £1 live Stripe charge. Evidence is the activity log as read live that evening (session transcript); the rows themselves were cascade-deleted with the client on 2026-09-03. The "paid rows" figure quoted earlier today was an instrument error and is withdrawn (see §12.5). Email delivery on wmiltd is evidenced as an event, not a delivery.]** Upsells (one-off and recurring, signable quote for recurring) built 2026-08-11 on both portals, never yet used on a live client | platform architecture, R14 |
| Conversational agent runtime | PARKED (trigger: first web-chat client). **[Code 2026-09-03: all six workflows remain ACTIVE in n8n including MAINT_kb_ingest, which is healthy; PARKED describes intent, not the substrate state. VIP's tenant is provisioned with a 21-chunk KB and enabled:false; DM's tenant enabled:false with the site widget still capturing into an unread void.]** | RULINGS_AND_PARK_RECORD_2026-08-05 |
| Growth Leakage | programme RETIRED; language retained as copy asset | same |
| WhatsApp attribution bridge | LIVE on wmiltd.com; window attribution is the mechanism. **[Code 2026-09-03: widget captures gclid, fbclid, msclkid, gbraid, wbraid and all five UTMs; two click records ever, both the founder's tests; demo videos shot 2026-08-11 with a sanitised gclid; known defect, landing page frozen at first touch, ruled cosmetic for demos and still wrong for paying clients.]** | correction note 2026-08-06; claims register |
| **Agent optimise (Bernard, supervised by Norbert)** | **[Code 2026-09-03: missing line.]** LIVE since 2026-08-18, v1.1 exclusions 2026-08-26; 4 moves executed, 3 rejected, graduation 0 of 50 under the 2026-09-03 counting rule (four earlier moves were hand-reconciled and do not count) | `BERNARD_OPTIMISE_SPEC.md`, design note, `AGENT_OPTIMISE_PROCESS_FEEDBACK.md` |
| **Booking engine (Calendly replacement)** | **[Code 2026-09-03: missing line.]** Codebase complete and checksum-verified, 31/31 tests, meet.singularweb.ai + book.wmiltd.com + meet.webmarketinginternational.com; NEVER deployed, blocked on the founder's Cloudflare login and Google OAuth | `~/Downloads/BOOKING_ENGINE_BOOTSTRAP.md` |
| SingularCommerce | vertical doorway (concept + proven capability + parked domain); Phase A CLOSED; Phase B pending merchants | capability map v1 |
| Skincare venture | Phase 0; UAE, one SKU, Korea white-label; separate project | VENTURE_PLAYBOOK_face_cream_UAE |
| DentalMastery | handover to PPC Mastery workspace; five workstreams | handover plan v2 |
| Denis consulting | contracted; $95/h manual time | DENIS_ENGAGEMENT_WORKING_BRIEF v2 |

## 8. Agents (UNVERIFIED items flagged; Code owes the delta)

Bernard (Meta; supervisor class; specs, verifies, gatekeeps; executors are substrate-internal BERNARD_build, BERNARD_fix, and since 2026-08-18 BERNARD_optimise / BERNARD_optimise_execute). Oscar (Google). **Filled from live reads [Code 2026-09-03]:**

- **BERNARD_optimise.** Two n8n workflows behind the dispatch key. Grammar: pause, budget (±25% per move, capped by the client's max daily), unpause only of Bernard's own pauses, and since v1.1 `audience_exclude` (ad-set scoped). Gates, all machine and unit-tested against the deployed code (24 cases): kill switch, stand-down, enabled, account allow-list, daily ceiling 3, thrash at 4 changes in 7 days counting the platform's own change history so the freelancer's edits count, human-change flag naming the human, fail-closed when change history is unreadable, immature-data flag on every intraday run. Per-move approval; every executed move re-read before it is reported. Ledger: 4 sessions, **4 executed, 3 rejected**, all four executions the Steffen applicants-audience exclusions of 2026-08-26, which landed on Meta and then crashed the verifier before recording (scope bug, fixed and reconciled same day). Bernard dispatches from chat via `dispatch_optimise` and `decide_move`.
- **Norbert.** Model **claude-fable-5**, deliberately different from the agents he reviews. Three surfaces: the substrate review leg inside every optimise run (two questions: is any move wrong; what did the run NOT touch; one revision round; 4 reviews metered at $0.14 total), the portal page `/norbert` with chat and relay (`/api/norbert/chat`), and a Slack route. Tools: `get_bernard_status`, `get_oscar_queue`, `brief_bernard`, `brief_oscar` (founder-gated, with a code header voiding any approval language), and since 2026-08-26 `note_for_agent`, the return leg that writes his verdicts into the reviewed agent's feedback inbox, made a duty after the Steffen incident where an amendment reached the founder but never Bernard. Memory: shared `agent_memory`, `agent` = norbert. Holds no approval authority anywhere.
- **Caching.** 15 `cache_control` sites across the three agents; each system base cached at a one-hour TTL. Material: a routine Bernard turn reads ~38k tokens from cache. Metering prices cache reads at 10% and writes at 125% of input rate; the first meter row undercounted a thousandfold before that fix.
- **Sonnet 5 migration.** Done for Bernard and Oscar (`const MODEL = "claude-sonnet-5"` in both); Norbert stays on Fable 5 by design. Live mix from `agent_usage`: 24 Bernard and 15 Oscar runs on Sonnet 5, 11 Norbert runs on Fable 5. No regression check exists beyond the agents behaving correctly in production since; nobody ran a before/after.
- **Oscar read gaps, first tranche built 2026-09-04 (build order step 1), preview branch.** Four reads Oscar declared could-not-read on the first large account: the campaign list now pages the whole account and declares truncation with the total instead of returning a round 80; change history carries user and client type (Recommendations Auto-Apply named) tabulated by editor over up to 29 days, mechanising the tabulate-before-judging rule; the account report returns four consecutive weeks on request and joins conversion-action configuration with a double-count flag; a new access read shows who holds an account. Pure rules in `src/lib/oscar-reads.ts` with 16 tests; every query proven live read-only. Still open from request §3: criteria, asset and listing-group reads, placement segmentation, product-level joins. `GOOGLE_ADS_OWN_LOGINS` remains unset on the deployment, so our own API edits are labelled as another party's until it is set.
- **Oscar's Norbert insertion (spec §9), built 2026-09-03.** Every proposal Oscar files is reviewed by Norbert in code before the founder sees it: same two questions, same thrash and human-change rules read from the Google Ads change history, one revision round, verdict stored on the proposal card and pushed to Oscar's inbox when it is not SOUND. Approve and apply refuse an unreviewed proposal; they admit an objected one, because overruling is the founder's. Migration 0026 applied to FZCO by the runner; wmiltd needs the founder's SQL editor.
- **Optimise verifier, corrected 2026-09-03.** A glue-level smoke harness replaying real executions found that no real optimise write had ever been recorded by the verifier unaided: Meta's appended default field failed the diff, and a Date-in-SQL bug would have failed the recording step. Both fixed and redeployed; the graduation count of 4 rests on hand-reconciled moves and the next approvals are the first the verifier will record on its own.
- **Metering (was the ledger's headline gap).** `agent_usage` table, portal DB, written by every agent run in a `finally`; 50 rows so far. Substrate `action_log` meters Norbert's review leg. The two remain separate because the portal's substrate connection is read-only by design.
- **Feedback inbox** (Denis item 3) built: `agent_feedback`, form on the Bernard page, consumed and archived at the next run start. **Denis doctrine batch** (money-at-stake spine, change history and thrash rule, data-maturity caveat, principles-never-numbers with a structural regex guard on `remember`) is in both agents' prompts since 2026-08-18. Decision-time snapshots and counterfactual class live since 2026-08-18 (`move_snapshots`). Shared memory "one mind, many offices" is ruled for WMI Ltd + FZCO only; partner instances require per-company memory (parity brief §3). Denis adoptions (Critic pass, dollars-at-stake spine, change history per row, feedback inbox, graded-move ledger with counterfactual grading and 12h staleness rule, data-maturity doctrine, principles-never-numbers memory) briefed, queued behind the 5 Aug risk work; decision-time snapshotting starts immediately.

## 9. Standing principles (the doctrine, compressed; each earned by an incident)

- **Declared is not enforced (adopted 2026-09-03).** No verifier's count is trusted until a glue-level replay harness has proven it recording real writes unaided. A control never observed catching or recording a real event is declared, not enforced. Applies to every gate, verifier and scorer, and to the counts built on them.

Verify against reality; claimed is not true until read back. Decisions written before crossing surfaces. Everything created paused; only the founder activates. Safety and compliance gates are the product, never pacing. Compliance cost is the price of the vertical, not of a tool. Legal instruments follow the contract-holding entity; common ownership does not merge legal persons (BAA, DPA). Capture surfaces need watched destinations. Claims carry sources; absence needs two probes plus the public surface. Legacy materials lie; verify offers before publishing. Stale strings and orphaned commissions are named failure modes; drops become orphans, never silence. Cross-surface relevance check before any impact claim. Data-maturity before action. Grade against counterfactuals, not before/after. Principles, never numbers, in durable memory. Self-first, then clients, then scale. Upwork: never name the system; lead with one mechanism.

## 10. Open items by owner (as of sync horizon)

**Founder:** R17, R18 (a/b/c), E1, E2; **[Code 2026-09-03 additions:** the three dupe-exclusion go-live rulings (audience creation by hand, the upload write class, privacy notices), not urgent below the volume floor; the eight audit follow-ups in `docs/N8N_SUPABASE_AUDIT_2026-09-03.md` (Meta header credential first); incident-mode ruling; defensive-moves-exempt-from-reversal ruling; publish the six DM nurture drafts (UI-only, checklist in `docs/clients/dental-mastery.md`); Cloudflare login + Google OAuth to deploy the booking engine; refund the £1 WE BET charge if not already done; run `0025` on the wmiltd SQL editor is done; VIP nurture UI build.**]** Kelsey Lane identity; Shopify tokens (instawarm, Brunos); SLACK_META_REVIEW_CHANNEL env; two quarantined AB ads; wmiltd portal readiness before Super Henry; skincare V1-V8; Joey engagement running; HubSpot MCP setup: Scott creates the MCP auth app in his portal, founder adds the server and completes OAuth; add 7345621720 to the Google Ads write allowlist; upload amended Offers_and_Pricing to Drive (or leave to revival checklist).
**Code:** **[Code 2026-09-03: the 5 Aug risk brief §1 is CLOSED, all five items, 2026-08-12 to 2026-08-18: `MIGRATIONS.md` + `scripts/migrate.mjs`, `META_PORTFOLIO_RISK_NOTE.md` (premise was wrong: seven client-owned portfolios, the single point is our token), `EXECUTOR_CONTRACT_CONTROL_AUDIT.md` + 29 parser tests, `CLAIMS_GATE_DESIGN_NOTE.md`, `ECONOMICS_LEDGER.md`. Denis brief: items 1, 2, 3, 4 done; 5a dupe-exclusion audience dry run live 2026-09-03, go-live awaits three rulings (`docs/DUPE_EXCLUSION_AUDIENCE_DESIGN.md`). The four-item agent delta is §8 above.]** Oscar's Norbert insertion (spec §9) was built 2026-09-03 (see §8); Denis 5a dry run live the same day. Still open: Shallowford lessons digest (other machine, folded into its channel-file rewrite); DM widget routing verification and execution (form leads DO route to #dentalmastery-leads via RCV_dm_ghl_events; widget captures still do not); DM handover pack assembly (gated on E1/E2). The glue-level smoke execution is built (2026-09-03, see §8).
**Chat:** client-proof phase close + successor phase brief; R18 ruling text and DPA operative terms on confirmation; Workframe v1.2; HubSpot blueprint canon once Code reports the shape.

## 11. Maintenance protocol

1. Any session (Chat or Code) that introduces a feature, closes a ruling, signs a client, or learns something that changes doctrine **appends one changelog line** and edits the one section it touches. Surgical, never redrafted.
2. **The repo copy (`docs/SINGULARWEB_PROJECT_STATE.md`) is the master, founder-ruled 2026-09-03.** Every Code session reads §0 and §4 at start and edits this file in the same commit as the change it records; the rule is in `AGENTS.md`, which every session loads. Chat proposes edits as a named section plus a §0 line and hands them to the founder for the repo; it does not edit its own copy. The founder refreshes the panel copy from the repo; nobody edits the panel copy directly. Sibling projects receive the parent context on their next session.
3. **Friday sync** is a diff review, panel against repo, not an authoring session: update the sync horizon with the commit hash, and flag anything UNVERIFIED that is still unverified a week later.
4. The register's maintenance rule applies: a capability, client, or ruling that disappears from this file without a status word (retired, parked, superseded, closed) is a defect, not a tidy-up.

## 12. Code verification pass, 2026-09-03 (the four asks)

Written by the Rexos platform session against live systems on 2026-09-03. Where a claim below says "read", it was read that day from the portal DB, the substrate DB, n8n, or the repo, not remembered.

### 12.1 Falsifications, with evidence

| # | Claim in the 2026-09-03 draft | Verdict | Evidence |
|---|---|---|---|
| 1 | §1: substrate session on the Mac mini, portal session on Windows | False | Every portal commit since the split (`0024_upsells`, `0025_agent_usage_and_feedback`, Bernard page fix 2026-08-26, Norbert page) shipped from this Mac mini; the same session edits n8n. The Windows machine holds Shallowford. |
| 2 | §4 and §7: runtime "ingest disabled" | False | MAINT_kb_ingest (n8n `1B0hHQqCabs0zBOi`) `active: true` on 2026-09-03; the "Forbidden" failure was Drive's per-minute export quota (65 exports per run), fixed 2026-08-08 with a `modifiedTime` gate, proven green; VIP's 3 KB documents ingested 2026-08-15, 21 chunks. |
| 3 | §5: "Kyle" and "VIP Accounting" as two clients | False | Kyle Randall is VIP Accounting's principal (`docs/clients/vip-accounting.md`, `VIP_ACCOUNTING_ONBOARDING.md`). One client, and a joint Baptiste-and-Anthony project under PPC Mastery (ruled 2026-08-17), so agency "we" is correct in its copy, the one standing exception to the first-person-singular rule. |
| 4 | §5 and §6.1: KST "snapshot not captured" | False | Founder 2026-08-15: "KST snapshot done"; VIP was cloned from it, which is how VIP inherited KST's emergency phone and pipeline name (memory `blueprint-clone-rewire-incomplete`). |
| 5 | §5: Buggy Trip "pitch held until demo live" | Stale | Demo videos shot 2026-08-11 (mobile and desktop); French proposal drafted and handed to Baptiste 2026-08-13; the gate is Baptiste confirming Google Ads auto-tagging is ON, unconfirmed. |
| 6 | §7: "wmiltd funnel unrehearsed" | False, but my first evidence was wrong | The run is real: 2026-08-06 12:51 to 12:57 UTC, full chain to payment_completed and client_activated, read live from the activity log that evening. The "4 paid rows" I cited this morning was `len()` of a REST error object (the query named a column that does not exist); the portal holds 0 paid rows today and WE BET's rows went with the cascade delete. Corrected in §12.5. |
| 7 | §4 owed list: "economics instrumentation status" | Done, not owed | `docs/ECONOMICS_LEDGER.md` 2026-08-18; `agent_usage` 50 rows across three agents; Norbert reviews metered in substrate `action_log`. |
| 8 | §10: Code's 5 Aug risk brief items | All closed 2026-08-12 to 2026-08-18 | `docs/MIGRATIONS.md` + `scripts/migrate.mjs` (three-way guard), `META_PORTFOLIO_RISK_NOTE.md`, `EXECUTOR_CONTRACT_CONTROL_AUDIT.md` + `tests/parse-batch.test.js` (29), `CLAIMS_GATE_DESIGN_NOTE.md`, `ECONOMICS_LEDGER.md`. |
| 9 | §8: Denis adoptions "queued" | Mostly done | Items 1 (money spine, change history, thrash, maturity), 2.1-2.4 (doctrine), 3 (feedback inbox), 4 (Norbert as different-model reviewer) are live; 5a (dupe-exclusion audience) is not. |
| 10 | §5: Gopoxy absent from the client book | Omission | `docs/clients/gopoxy.md`: freelancer-managed since 2026-08-13, founder-invoked exceptions since 2026-08-17, first optimise account 2026-08-18. |
| 11 | §4 R-g: amended tier copy "never uploaded to Drive" | Not falsifiable from here | Drive `Offers_and_Pricing.md` was modified 2026-07-06 19:43 and ingested 19:45; the KB matches Drive. Whether that Drive version carries the amendment is a founder question, not a Code one. |

What I could NOT check, and therefore did not touch: entity ownership shares in §2 (ADENERGY 50/50, PPC Mastery membership), commercial terms for Steffen ($1,000/m Upwork), Super Henry (£650/m proposed) and KST (Growth tier), FiltersFast's $6,500/m and pagination requirement, and the entire Denis/Joey/closrleads consulting line. None of those figures exists in any Code file on this machine; the channel files describe the work, not the money. Treat them as Chat-verified only.

### 12.2 The §8 fill

Done inline in §8 above. Two points that belong in the strategic picture rather than the agent detail: Norbert holds no approval authority anywhere, and that is enforced in code (a brief header that voids approval language) after a substrate test showed an injected message could trip an agent's founder-word gates; and the graduation ledger is 4 of 50 for optimise, 0 of 10 for build, with every optimise execution so far being an audience exclusion on one account.

### 12.3 What a fresh Code session needs from the strategic side that this file lacked

Facts and rulings I enforce every session with no strategic source to point at. Each is now in §4 or §5; listed here so Chat knows they were missing.

1. **The operating model (2026-08-18).** Contractors stay. Bernard and Oscar build and optimise only in founder-triggered sessions, to complement or correct the freelancer. Norbert supervises both. Watch-and-flag is the resting posture. Without this a fresh session either stands the agents down entirely or lets them run.
2. **The seven optimise rulings** and the 50-move zero-reversal bar per agent. §4 only carried the build bar.
3. **The channel-file convention** (one session per client, `docs/clients/<slug>.md`, cross-client lessons to `docs/memory/` only) and that memory is now in the repo and crosses machines by git.
4. **VIP's "we" exception** and that **CallTrackingMetrics does VIP's call tracking on Baptiste's side.** Both cost a round of rework when unrecorded.
5. **DentalMastery's Meta runs inside the WMI UK ad account** (`act_1027063116856202`), the E1 entanglement, and the DM slug is `dental-mastery` (the wrong slug silently writes zero rows).
6. **The portal's substrate connection is a read-only role by design**, which is why agent metering lives in two databases.
7. **Naming: `WMI |` prefix, never client initials** (2026-08-06).
8. **The two unruled process questions** from the Steffen channel (incident mode; defensive moves and the reversal count) are open founder decisions, not Code gaps.
9. **Credential values move only by the founder's hand**; documents and chat carry names only. Chat's file already behaves this way; a fresh Code session needs it stated.

### 12.4 Judgement on the §11 maintenance protocol

The protocol is right in shape and wrong in one mechanism. Surgical edits plus a one-line changelog is exactly how `PROJECT_STATE.md` and the channel files are maintained: I edit the section, date the edit, and commit. That part transfers.

The failure point is "three places kept identical" with the founder as the transport. A founder upload is a manual step that will be skipped on the busy Friday, and the copy in the strategy panel then drifts silently, which is the condition this file was written to end. The fix is to make the repo copy the single source and the other two copies exports of it: Code edits `docs/SINGULARWEB_PROJECT_STATE.md` in the same commit as the change it records (a changelog line written in a different commit from the change it describes is the first thing that rots), and the panel copy is refreshed from the repo when the founder next opens it, not on a calendar. The sync horizon should carry the git commit hash, not just a date, so that "what changed since" is a `git log` rather than a memory exercise. A Friday sweep is still worth keeping, but as a diff review (repo copy against panel copy) rather than an authoring session.

One more thing the protocol should say: this file records rulings and state, and the channel files record client detail. When they disagree, the channel file wins on the client and this file wins on the ruling, and whoever notices files the correction in both.


### 12.5 Reconciliation after Chat's reply, 2026-09-03

**wmiltd funnel, settled from the records.** (1) Date: 2026-08-06, 12:51:56 to 12:57:56 UTC, test client WE BET. (2) Scope: end to end. The activity log read live at 21:01 UTC that day carried client_created, onboarding_invite_emailed, details_confirmed, contract_generated, contract_signed, checkout_started, payment_completed and client_activated; the founder was asked the same evening to refund the £1. So the contract leg (PandaDoc) and the Stripe leg ran; the email leg is evidenced as a send event, not a delivery, and Super Henry's readiness gate should re-check delivery rather than assume it. (3) The lapse: the "rehearsal remains mandatory and unrun" paragraph was committed at 12:25 UTC, half an hour before the run, and never written back. It sat wrong in PROJECT_STATE for 28 days, not 6, and Chat's 12 August sync faithfully copied it. Corrected today with the lapse stated in the paragraph itself. **My own error on top:** this morning's §12 cited "4 paid rows" as evidence. That number was the length of a REST error object returned because my query named a column that does not exist; the portal holds 0 paid rows. The date and scope claims stand on the transcript evidence; the instrument I quoted was broken. Lesson filed to shared memory.

**R-g:** closed by dates as Chat says; wording in §4 updated.

**Two proposed edits (§4 optimise bar, §9 doctrine):** adopted by the founder the same day; graduation count reset to 0 of 50.

**Audit follow-ups:** the founder parked the remaining n8n items (GHL webhook headers, Slack signature, Barsoum legacy workflow, unused credentials, FZCO grants) as minor on 2026-09-03; Shallowford's eConnector outage stays with that channel.

**Sync horizon: 2026-09-03, repo commit `243fb55`, verification content; the hash line itself lands one commit later.**

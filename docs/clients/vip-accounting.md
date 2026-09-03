# VIP Accounting (Kyle Randall)

**Channel file.** Read `docs/PROJECT_STATE.md` §1, §2 and §7 first; this file is owned by the vip-accounting session and is the client's living state. Content below the horizontal rule was moved verbatim from PROJECT_STATE §4 on 2026-08-15 during the lead-gen half of the per-client split (pre-split history: commit d71cf65).

**Last updated:** 2026-08-16 (web chat shadow-tested against 16 questions; two blockers found; nurture build spec resolved but the UI build is tooling-blocked).

## Where this client actually stands, 2026-08-16

The six-capability rollout and its ordering live in `docs/VIP_ROLLOUT_PLAN.md` and still hold, with one correction below. The short version: five of six capabilities are built and stopped one step short of live, and call tracking is CallTrackingMetrics on Baptiste's plate, not ours.

**Correction to the rollout plan.** It records capability 5 (live AI webchat) as having **zero** knowledge-base documents. That was true when written and is now stale. Ingestion landed **2026-08-14 22:00:32 UTC**: three documents, 21 chunks, verified in `kb_documents`.

| Document | Chunks |
|---|---|
| `VIP_Services_and_Packages` | 9 |
| `VIP_Who_We_Help_and_How_To_Start` | 7 |
| `VIP_Fees_Approach_and_What_To_Hand_Off` | 5 |

For scale: shallowford-smiles 37 docs, kst 12, singularweb 8, dental-mastery 3.

### Web chat shadow test, 2026-08-16

Sixteen calls (14 questions plus 2 repeats) straight to the core runtime `agent-core-v1` with VIP's `client_id`, sessions labelled `vip-shadow-NN`. This bypasses only `AGENT_webchat`'s delivery gate, never the clinical gate or RAG, and needed no config write. Verified afterwards by read-back: **zero CRM writes**, because VIP's GHL location is not on `AGENT_postpass`'s allow-list. Five handoff/escalation Slack posts did land in `#alerts`; that leg is not gated by mode.

**The refusals hold, on both paths, so what Kyle was told in writing is true.**

- *Keyword gate* (`gated: true`, sub-2s, deterministic): salary vs dividends, sole trader vs limited, avoiding tax on dividends, missed-deadline emergency.
- *Model judgement* (`gated: false`, no keyword hit): declined to quote a fee, declined to beat a quoted competitor figure, declined to work out a tax rate on the visitor's own £85k profit, declined to compare itself to another named firm, and routed an HMRC investigation to the team. This is the more valuable result, because these are the cases no vocabulary list covers.

**Two blockers, both must clear before `enabled` flips.**

1. **The emergency phone number is KST's.** `clinical_gate.emergency_phone` is `020 3150 2074` for `vip-accounting` and byte-identical for `kst`. It is a London 020 number; VIP is Benfleet (01268). This is the reply given to someone who says they have missed a filing deadline, so the worst-case is a distressed VIP prospect being sent to a rival firm. It is a blueprint-clone leftover, the same failure mode `docs/VIP_ACCOUNTING_ONBOARDING.md` §3 was written to prevent. **Kyle's real office number has been outstanding since §5 of that doc**, so this is now a fourth thing owed by him, and the most urgent.
2. **Latency exceeds the delivery wrapper's own timeout. Diagnosis corrected 2026-08-16, see below.** Client-observed round trip hit ~81-83 seconds twice in sixteen calls. `AGENT_webchat`'s "Call core" node has `timeout: 60000`, so once live roughly one visitor message in seven would exceed it and fail outright. **The consequence is unchanged and the risk is real.**

**Corrected diagnosis: the runtime is not slow. The wait is upstream of it.** The first reading here said "the core intermittently takes ~82 seconds", which was wrong in its detail and would have sent someone off optimising the model or the RAG for no reason.

Read from n8n execution history: **the workflow itself never exceeds 7.4 seconds.** Zero of 25 executions over 30s, including all 16 shadow-test calls. Keyword-gated turns run in 0.3s to 0.4s because they short-circuit before RAG and Claude; full model turns run 2s to 7.4s.

Correlating client-side timings against execution start times isolates the gap:

| Test | Client observed | Execution start | Execution run | Gap before execution |
|---|---|---|---|---|
| 02 | 83.2s | 17:57:45 | 7.4s | **~76s** |
| 03r | 80.9s | 18:05:45 | 5.2s | **~81s** |

So roughly 76 to 81 seconds passes between the HTTP request arriving and n8n starting the run. **Cause not established.** Candidates are n8n Cloud webhook queueing, instance scaling, or a proxy layer. The `createdAt` field that would settle it is not exposed on the executions API, so this needs either n8n Cloud instance metrics or deliberate instrumentation. It is not a simple idle cold start: it hit the first call of two batches but not the first call of the other two, including the very first call of the session.

**What this changes about the fix.** Raising `Call core`'s timeout above the observed wait is a one-line change that makes the symptom survivable, but it is a live workflow edit and therefore needs a founder ask under R7. It does not address the cause, and an 80-second wait is past what a visitor tolerates regardless of whether the request eventually succeeds. Do not spend effort on model or RAG performance; that is not where the time goes.

**Two softer findings.**

- *Deterministic content gap.* "What do you need from me to get started?" returns `escalate_to_human` and asks for contact details instead of answering, reproduced identically twice, despite a KB document literally titled `..._How_To_Start`. Commercially it captures the lead, so it is arguably not a bug, but it is not what the question asked.
- *KB gap, and it confirms the ask is right.* Turnaround times deflect to "the team will discuss". Software answers correctly (Xero). Both are covered by the source material already requested from Kyle.

### Nurture build, 2026-08-16

**Still not built, and the reason is tooling, not a decision.** GHL's workflow builder renders in a cross-origin iframe (`client-app-automation-workflows.leadconnectorhq.com`) that does not accept synthetic clicks, and it will not run as a top-level document because it needs the parent frame's auth handshake; the legacy `/location/<id>/workflows` path redirects back to it. The API cannot substitute, which confirms the build sheet's original claim: workflows are `workflows.readonly` with a `GET` only and no create operation. Checked and rejected as an alternative: building the six as email templates, because both VIP and KST hold **zero** email templates, so the house pattern is emails authored inline in the workflow action.

**What was done instead:** every open decision in `docs/VIP_NURTURE_BUILD_SHEET.md` is now resolved against the live account and written into an appendix there, so the remaining human job is execution. Trigger settled as Opportunity Created into New Enquiry (it inherits the repeat-caller dedupe already in `RCV_vip_ctm_leads`); all eight pipeline stage ids captured; the four exits mapped to concrete GHL mechanisms; settings fixed. **It must be built as DRAFT**, because Kyle's review and the sending domain are both still open.

**Second clone leftover, found while reading the pipeline: VIP's pipeline is named `KST Leads`** (`0R3fryVBUk2liqLbiC3w`). Unlike the phone number this is cosmetic, but Kyle sees it on his own Opportunities board. Rename to `VIP Leads`; stage ids are unaffected.

Live workflows in the location, confirmed by API: `vip-accounting Website Lead Notifications`, `vip-accounting stage: Consultation Booked → OCT`, `vip-accounting stage: Engaged (Won) → OCT`. All published, all with zero enrolments ever, consistent with the pipeline having held zero opportunities.

### Kyle's replies, 2026-08-16. Four rulings and the number that was missing

He answered the 15 August Slack message in full. His words are quoted because two of these change deliverables.

**1. Client lifetime, which was the open question: three years plus.** "A client can stay with us for easy 3 years +, as we provide an exceptional service. So clients will stay with us for as long as they run their business. The only time a client leaves is if they have cash flow issues / closing their business." At £100 to £200 a month over 36 months or more that is roughly **£3,600 to £7,200 lifetime value against a £16.29 click**. This was the number gating the budget decision.

**2. Pricing: he took the push back.** "On the pricing yes I agree with this, I'm happy to go with starting from £100." Note he moved the **floor to £100** rather than adopting the suggested £100-200 range or removing price entirely. **This makes nurture email 4 wrong as previously written and it has been corrected**; the build sheet carries the supersession note.

**3. Missed-call fallback: approved.** "Okay yeah do that if no answer then do the fall back option." Ring his mobile about twenty seconds, then fall back to us rather than his own voicemail. Not yet built. Note the dependency: VIP's call tracking is CTM, and KST's equivalent is a `Missed call alert` GHL workflow, so which side owns this needs settling before anyone builds it.

**4. DNS: he holds it himself.** "I have access to these. If you want to send over what needs to be changed on the DNS and I can do or if you need login I can add you too." **The earlier assumption that this routed through his partner was wrong.** She does site edits; he does DNS. That removes the access blocker entirely.

**Reviews:** he will chase the ones on the site but not on Google, and notes all recent reviews go straight to Google. Nothing owed by us.

**He also sent a headshot** and asked for the emails to read.

### Oscar's read on the budget and the conversion actions, 2026-08-16

Routed through Oscar per the standing instruction, no direct account access from this session, no changes filed.

**On the raise to £2,500: yes on the economics, not yet on readiness.** The LTV closes the "is this a good bet" question comfortably; even a weak funnel clears a £3,600 floor. But he wants three things first, and surfaced account facts this channel did not have:

- **The account was heavily restructured 3 to 9 August**: 54 campaign-level negatives across all three Search campaigns plus a budget change on Essex. Spend fell from £100.51 to £35.45 week on week, down 64.7%, clicks 6 to 3, conversions 1 to 0. He cannot yet tell clean-up from overcorrection and wants two or three stable weeks.
- **National shows zero delivery**, still, since the 1 August baseline. Extra budget on a campaign that structurally is not spending does nothing.
- **Only Essex generates live signal and it is thin**: 33 of 35 pounds, three clicks, zero conversions.

**On the triple-primary conversion actions, which have sat undecided since 1 August.** His point is that this is already a live problem before CTM enters it: one real call can register up to three times today. Recommendation is **`Calls from ads` primary, `Clicks to call` and `Phone Click` demoted to secondary**, because the first only fires on a connected call of meaningful length while the other two fire on the tap. If and when CTM is genuinely wired to feed Google a conversion rather than just living on Baptiste's dashboard, CTM becomes the single primary and all three drop to secondary. The rule he states: one call action drives bidding, the rest are reporting only.

**This is a recommendation, not a decision.** It needs the founder, and it touches Baptiste's side.

### What Kyle owes, now three things

Reduced from four: the DNS access question is answered, and his real office number is still needed.

1. **The two Making Tax Digital lines in email 3**, thresholds and quarterly dates. This is now the only thing standing between the emails and going live, alongside the DNS. Draft sent for his review: `~/Documents/VIP_FOR_KYLE_EMAILS_AND_DNS_2026-08-16.md`.
2. **Knowledge-base source material**: repeated first-call questions, what he needs from a new client, turnaround times, software. He has said he will send it.
3. ~~His real office phone number.~~ **Probably answered without asking him: `07901730271`.** Verified 2026-08-16 on the public Google Business Profile knowledge panel, which shows VIP Accounting LTD, 20 Gifford Rd, South Benfleet SS7 5XU, **+44 7901 730271**, 5.0 from 34 reviews. Same number, checked on the surface a real user sees rather than taken on trust. See the caveats below before it goes into the assistant.

Closed: the client-lifetime question (answered, three years plus) and the SiteGround access question (he holds it).

**Prepared and waiting on the founder to send, not sent.** `~/Documents/VIP_FOR_KYLE_EMAILS_AND_DNS_2026-08-16.md` carries the six emails for review and the DNS record set. Client documents go out over Slack, never from this repo.

**One sequencing trap in that document.** The DKIM value does not exist until the sending domain is added in GHL. The draft tells Kyle the value follows rather than giving him five of six records, because a half-implemented sending domain fails silently. Adding the domain in GHL is our step and it comes first.

### The emergency phone fix: number found, three caveats, and it is not applied

`07901730271` is verified (above) and is unambiguously better than KST's number, so the landmine can be defused. It has **not** been applied. Three things qualify it.

**1. It is a mobile, and the reply makes a promise it may not keep.** The emergency reply reads "Please ring the team right away on {phone} so they can help you straight away." Kyle approved the missed-call fallback on the same day precisely because he cannot always pick up. Someone who typed "penalty notice" or "bailiff" and reaches voicemail is the exact failure that line exists to prevent. **The number fix and the missed-call fallback belong in the same piece of work**, not separately.

**2. This is the number most likely to be swapped for call tracking.** Map-pack calls are invisible to website call tracking, so the Google Business Profile number is the one that gets swapped to a tracking number. If that happens, a hardcoded number in the agent config drifts silently out of sync. Treat this value as **tied to the CTM decision**, not independent of it.

**3. Kyle should still confirm.** The bar is low because it is already public, but publishing his mobile inside an automated assistant that talks to strangers is his call, and there is a call booked for Monday.

**How to apply it when the decision is made.** `MAINT_agent_config_write`, webhook `agent-config-write`, key `clinical_gate.emergency_phone`, which is **Tier B: dry run first, then apply, audited**. VIP's client id is `862f63e8-131c-4f33-90dd-5f31ebf0ee56`. **This session could not run it**: the webhook uses header auth (`x-console-key`, credential "Console config-write auth") and that key is not in `~/.config/singularweb/substrate.env`. Do not write the row directly to bypass this; the staged path exists so this class of change is previewed and audited.

### A mismatch found while verifying the number

The Google Business Profile hours say "Opens 9 AM", and the agent config's `business_hours` are **09:00 to 17:00, Mon-Fri**, with the after-hours line promising the next working day. But the founder's own note to Kyle states **the ads run nine to seven on weekdays**. That is two hours every evening where the ads pay roughly £16 a click into a funnel where the assistant, the handoff expectations and the Google listing all say closed. Worth raising on the Monday call alongside the fallback, since the same fallback fixes most of it.

### Kyle's second reply, 2026-08-17. Emails approved, and one thing that would have shipped broken

**The booking link changed and the old one is DEAD.** He renamed himself on Calendly, which silently changed the slug, and he flagged it himself. `calendly.com/kylerandall/30min` returns **HTTP 404**; `https://calendly.com/kyletheaccountant/30min` returns **HTTP 200**. Both verified 2026-08-17. That URL appears in five of the six emails, so **building the workflow from any copy dated before 2026-08-17 would have shipped five dead booking links into a paid funnel.** Corrected in the build sheet and the client-facing copy; the onboarding doc keeps the old value as dated history with a supersession note. **Re-verify this immediately before the build.** A Calendly slug follows the account name, so it is a live dependency, not a static fact.

**Email 3 replaced by Kyle, and the MTD gate is retired.** His reasoning as the accountant: MTD is mainly for the self employed in the UK at present, so leading with it to a limited-company audience invites confusion. His replacement is about proactive year-round support versus once-a-year filing. **Consequence: no blanks remain anywhere in the sequence and no email states any tax figure, threshold or date.** The "Kyle must confirm thresholds" gate no longer exists.

**Copy is approved.** "Rest of the emails are all good!" Content is final; only the build and the sending domain remain.

**Do NOT use the Google Business Profile mobile for the assistant.** He has ordered a **dedicated work eSIM for work and ad calls** and will share it. So `07901730271` is superseded before it was ever applied, which is why the Tier B write was worth not rushing. **Wait for the new number.**

**He acted on the hours mismatch**: Google Business Profile now shows open until 7pm, matching the ad schedule.

**Budget**: open to a recommendation, and flagged that **a Google Ads welcome bonus is available** to put toward it. Passed to Oscar.

### Knowledge base: Kyle's FAQ delivered and uploaded 2026-08-17

102 questions across 12 sections, plus a 22-item "must not answer" list and a standard refusal response. Materially better source material than the estate usually gets, and it **strengthens** the clinical gate rather than undercutting it: his answers to the gate-sensitive questions are refusals with handoffs, including an explicit "Do not recommend an amount, split or strategy."

**Uploaded as `VIP_FAQ_Client_Questions`** to the Drive KB folder `1AWtA7sC79NIyhIG5LUZEl4FwKOVK6-Ml`, the same folder the first three documents came from. Content verified by read-back. `MAINT_kb_ingest` runs every two hours and treats it as a new file, so it ingests on the next pass.

**Deliberate split, and it matters.** Kyle's document mixes knowledge with behavioural rules. **Only the 102 question-and-answer pairs were uploaded.** Rules were withheld from the knowledge base on purpose: a retrieval system fires a rule only if the retriever happens to pull that chunk, so behaviour encoded as a document is behaviour that works by luck. Three inline `Assistant rule:` lines were also stripped from the answers, because a retrieved chunk reading "Assistant rule: Do not recommend an amount, split or strategy" could surface to a visitor verbatim.

**Those rules must go into config instead, and none are applied yet.** All need the `x-console-key`.

| Config key | Tier | Value from Kyle's document |
|---|---|---|
| `booking_url` | A | `https://calendly.com/kyletheaccountant/30min` |
| `clinical_gate.safe_reply` | B | His standard personalised-tax response, which routes to the discovery call |
| `brand_voice` | A | "Helpful, positive, reassuring and clear", with the take-it-off-your-desk message |
| `cant` | A | Extend with his must-not-answer list |

**`booking_url` is currently NULL, and this is a real defect.** Kyle's FAQ routes to "book a free discovery call" as the answer to every gated question, 30-plus times. With no booking URL configured the assistant can offer a call but cannot give the link, which is exactly what the shadow test showed. **Ingesting the FAQ does not fix this**; without the config write the knowledge base points at a door the assistant cannot open.

**A gap in the write path worth knowing.** `clinical_gate.vocabulary` is **not** in `MAINT_agent_config_write`'s allow-list, so the keyword gate cannot be extended through the sanctioned route at all. Kyle's list contains terms the current 36-term vocabulary does not hold: claimable expenses and mileage, home office, clothing, gym costs; director's loan account; "most tax-efficient way to take money out"; "reduce my Corporation Tax"; "which VAT scheme"; "how much salary should I take"; "should I stay self-employed". The model-level gate did hold on this class in shadow testing, so this is defence in depth rather than an open hole, but extending the deterministic gate needs either an allow-list change or a founder-run write.

### OCT still cannot fire, and the reason is now specific: Calendly has no path into the pipeline

**Read live 2026-08-17: `opportunities: [], total: 0`.** VIP's pipeline has held zero opportunities for its entire existence, unchanged, **despite Google recording a Calendly booking as a conversion this week** (Oscar's read: £190.88, 5 clicks, 1 conversion).

So a booking registered in Google and produced no row in the CRM. That is the failure this estate has already learned once and written down: **a conversion event is not an opportunity, and OCT reads stage changes, so an empty pipeline means there is nothing to fire.**

**The likely cause, and it is structural rather than a bug.** `RCV_vip_ctm_leads` was built to detect calls and website form posts by payload shape. **A Calendly booking is neither.** It is a third lead source with no receiver, so there is no path by which it could ever create a contact or an opportunity. If that is right, no amount of waiting produces the "first real deal" the rollout plan is waiting on, because the only conversion source currently firing is the one source that is not wired in.

**Now verified, 2026-08-17: `contacts: [], total: 0`.** Not just zero opportunities. **VIP's GHL location has never held a single contact.** The client system described to Kyle as built and tested, where "every enquiry now has a place to live", has received nothing in its entire existence.

**Discipline check, because the obvious conclusion is not yet earned.** The standing lesson is that silence is not a signal without traffic: before auditing a layer that fired zero times, confirm the input surface delivered anything. **The traffic here is tiny.** Oscar's reads show 3 to 5 clicks a week and £35 to £191 of weekly spend. Zero enquiries from 5 clicks is entirely ordinary, and the 1 August smoke-test artefacts were deliberately deleted afterwards, so a clean empty location is also the expected state. **Zero contacts on its own is therefore not evidence of broken plumbing.**

**What IS a real discrepancy is the cross-surface join.** Google recorded **1 conversion, a Calendly booking, this week**, while GHL holds **0 contacts, ever**. Those two readings cannot both describe a real person who booked a call. Exactly one of the following is true:

1. **The Google conversion was not a completed booking.** A conversion action can fire on a widget interaction rather than a confirmed slot. If so, nothing is broken and the pipeline is empty because no enquiry has happened yet.
2. **A real person booked and Calendly is not wired to the CRM.** `RCV_vip_ctm_leads` detects calls and website form posts by payload shape; a Calendly booking is neither, so there may be no receiver for the one source that is currently converting.

**The cheapest decisive test needs no tooling: does a real booking exist in Kyle's Calendly for this week?** That single question separates "nothing is wrong" from "the paid funnel is dropping real bookings". Ask him, or check the Calendly account.

**Consequence either way.** If it is 2, the intake gap outranks every config item on the build list, because it breaks OCT and the nurture trigger simultaneously and costs money for as long as it stands. If it is 1, item 1 really is just waiting on traffic, and the honest thing to tell Kyle is that the system is ready but has not yet been exercised.

**Corrected, so nobody chases the wrong thing.** The rollout plan's unverified worry that the two GHL stage workflows still post to the KST webhook path does **not** apply on the n8n side: `RCV_vip_stage_change` listens on `vip-stage-changed` and `RCV_kst_stage_change` on `kst-stage-changed`, read live and correctly separated. The GHL-side action targets remain unread, because the API lists workflows without exposing their internals.

**Consequence for item 1 in the build list.** It is no longer "wait for a first real deal". A deal has effectively happened and the plumbing did not carry it. **This should be checked before the nurture build**, because the nurture triggers on Opportunity Created into New Enquiry, and a pipeline nothing can reach is a pipeline the nurture will never fire from either. The same gap breaks both.

### Calendly was never wired. Answered plainly 2026-08-17

**No.** `RCV_vip_ctm_leads`'s own header comment states its scope: "one intake for VIP Accounting's two off-platform lead sources. CTM post-call webhooks (calls) and, later, the client website's form handler (forms)." **Calls and forms. Calendly is not one of them**, and no workflow matching calendly or booking exists among the 50 in n8n. Confirmed by `contacts: [], total: 0` and `opportunities: [], total: 0`: **nothing has ever reached VIP's CRM.**

**This was in scope from the start**, which is what makes it a gap rather than a scoping choice. `docs/VIP_ACCOUNTING_ONBOARDING.md` names the conversions as "phone calls and Calendly Zoom bookings" and heads a section "Conversion tracking, the part that makes this account different: phone calls plus Calendly." The intake was then built for calls and forms.

**So how defensible is the OCT claim?** Split it in two, because the halves differ.

- **The upload leg is genuinely built and smoke-tested.** Both Google actions exist (`Consultation booked (CRM)`, `Client won (CRM)`, secondary, 90-day window), `RCV_vip_stage_change` is ACTIVE on the correct `vip-stage-changed` path. Given an opportunity that moves stage, it fires. That is real.
- **The input leg does not exist for the source that is actually converting.** OCT reads stage changes. Nothing creates a card from a Calendly booking, so there is no stage to change.

**What was said to Kyle, judged strictly.** "When you mark a consultation as booked... Google is told which advert produced that person" is **conditionally true** and survives scrutiny, because it presupposes he marks a card. But **"Every enquiry now has a place to live and a path through it"** and "You get told the moment a website enquiry arrives" do **not** hold for Calendly bookings, which are his main tracked conversion. That sentence needs correcting with him rather than quietly left standing.

**And wiring Calendly to GHL is necessary but not sufficient.** OCT uploads need a click id to attribute against. The chain has to be: site captures gclid, gclid rides into the Calendly booking, Calendly webhook creates the GHL contact carrying it, opportunity created, stage moved, upload fires. **At least three of those links do not exist.** Per the standing lesson, the only proof is a recorded UPLOAD_CLICKS conversion attributed to a campaign, account-side, via Oscar.

### The "HMRC KB" is KST's, and it is contaminated. Read 2026-08-17

The founder referred to "the HMRC KB we created". It exists, and it is good, but **it belongs to KST**: nine `KST_TaxBase_*` documents plus `KST_UK_Tax_Key_Facts_GOVUK`, in KST's Drive folder, ingested 17-18 July 2026. **RAG retrieval is tenant-scoped, so VIP's agent cannot see any of it** (shadow test 14 confirmed cross-tenant isolation holds).

**Currency is fine.** `KST_TaxBase_VAT_Full` is headed "UK Tax FAQ: VAT (2026/27)", stamped "founder-supplied snapshot dated 18 July 2026, every answer sourced from GOV.UK/HMRC", carries the correct £90,000 threshold and £88,000 deregistration figure, and instructs "REFRESH quarterly and after every Budget". One month old, in date.

**Reuse is NOT a copy job, and copying it verbatim would repeat today's mistake at a larger scale.** That single document contains, in its retrievable text:

- "Part of the **KST** UK Tax FAQ knowledge base"
- "route ... to the free consultation (**020 3150 2074**)", **KST's phone number, inside the knowledge base text**, where no config fix can reach it
- "**KST** files under MTD for its clients"
- "Choosing the right scheme is one of the things **KST** helps with"
- "**KST is a CIS specialist** and handles this day in, day out"

So it carries a rival firm's name and phone number, and **practice-specific service claims VIP has never made**. CIS specialism is KST's positioning, not Kyle's. Dropped into VIP's KB these become false claims about VIP, spoken to VIP's prospects, in Kyle's name.

**Required before any of it reaches VIP:** de-brand all nine or ten documents, strip the embedded phone number, and remove or requalify every practice-specific claim. **Then Kyle signs it off.** That last point is not optional and it follows the founder's own ruling: he refused to state MTD thresholds in one email without Kyle confirming them. Serving VAT thresholds and deregistration figures to strangers at scale under Kyle's name is the same risk, larger. Kyle also just proved he cares about exactly this, by rewriting email 3 because MTD mainly applies to the self employed.

### Live site audited 2026-08-17 after Antek's report. Four faults, all verified independently

Antek (setting up CTM, manages the ad account) reported that on the contact page both the Call Now button and the Calendly link return "Page not found". **Confirmed, and the cause is bigger than the symptom.** Read directly from the live DOM, not from his screenshots.

**Fault 1: the dead Calendly slug is LIVE on the contact page.** `https://vipaccounting.co.uk/contact-us/` embeds **`calendly.com/kylerandall/30min`**, the slug Kyle broke when he renamed his account, which returns **HTTP 404**. So the booking widget on the contact page cannot take a booking. **This is the same root cause as the nurture emails, and it means the breakage was never only ours: the client's own paid funnel has been pointing at a dead booking URL.**

**Fault 2: the site is inconsistent, so this is a partial fix somebody already started.** `/limited-company-accountants/` carries the **correct** new slug `calendly.com/kyletheaccountant/30min`. The contact page carries the dead one. Whoever updated the landing page missed the contact page. **Do not assume one fix covers the site; every page needs checking.**

**Fault 3: the contact page's CALL NOW button does nothing.** It is an `<a>` with `href: null` and no `onclick` handler, and the contact page has **no `tel:` links at all**. Not a 404 exactly, but functionally identical for the visitor, and it matches Antek's report.

**Fault 4, and this one nobody has raised: CTM's number swap is consent-gated, so it will systematically under-count calls.** On the landing page with no consent given, read live:

- the visible number is `tel:07901730271`, **Kyle's own Google Business Profile mobile, untracked**
- `window.__ctm` is **undefined**, so CTM has not loaded
- Cookiebot is active and is blocking scripts as `type="text/plain"` with `data-cookieconsent="statistics,marketing"`
- **zero** elements carry `data-ctm-tracked` or `data-ctm-watch-id`

Antek's screenshot shows the swapped number `+447861938724` with the CTM attributes present, because he had accepted cookies. **His test call therefore proves the mechanism works with consent. It does not prove coverage.** A visitor who declines or ignores the banner sees and dials Kyle's real number, and CTM never sees that call.

**Consequence, and it needs saying to Antek before the numbers are trusted.** His stated claim is that CTM gives "the exact number of actual phone calls from users who interacted with our ads". That is not what it will measure. It will measure calls from **consenting** visitors only, and the shortfall equals the consent-decline rate, which nobody has measured. This is the claims-gate discipline applied to a colleague's work rather than ours: the mechanism is good, the word "exact" is not earned.

**Revised explanation for the empty CRM.** Earlier in this session the empty pipeline was attributed to Calendly never being wired. That still holds and is still the structural gap, but the cause is now **multi-causal** and the honest ordering is: the contact page could not take a booking at all (fault 1), any booking taken elsewhere has no receiver to reach the CRM (no Calendly wiring), and traffic is tiny anyway (3 to 5 clicks a week). **Do not present any single one of these as the whole explanation.**

**Site fix list, for the one bundled email to whoever edits the site.** Kyle said his partner handles site edits, and this now has to go out ahead of any widget snippet:

1. Replace `calendly.com/kylerandall/30min` with `calendly.com/kyletheaccountant/30min` **everywhere**, then re-check every page rather than the two audited here.
2. Give the contact page's CALL NOW button a working `tel:` href.
3. Decide with Antek whether the call-tracking swap should be reclassified so it is not consent-gated, or whether the under-count is accepted and stated.

### 2026-08-19: new number live, site half fixed, and the reason calls never reach the CRM

**Kyle's dedicated work number is `+447364237621`** (07364237621). Verified from outside, not from anyone's panel:

- **Google Business Profile updated.** The public knowledge panel reads "Phone: +44 7364 237621". Hours also read correctly for 9am to 7pm weekdays ("Closed, Opens 9 AM Thu" on a Wednesday evening), so his hours edit is sound.
- **Contact page Calendly link FIXED.** The dead `kylerandall` slug is gone and `kyletheaccountant` is live. Site fault 1 closed.
- **Contact page still has no `tel:` link at all.** Fault 3 open; Kyle says his partner is adding it.
- **New problem introduced on the landing page: BOTH numbers are now live on it**, `tel:07364237621` and `tel:07901730271`. Two different phone numbers on one page. The old one is his personal mobile and is no longer the number on the Google listing, so anyone dialling it is off-piste and untracked. **It needs removing, not just superseding.**

**The finding that matters most, and it is one configuration step.** `RCV_vip_ctm_leads` has **6 executions in its entire life, all on 2026-08-01**, which is the four-path smoke test on record (4 success, 2 deliberate failures). **Nothing since.** Antek has stood CTM up and made a live test call, and a real prospect called too, and neither reached our intake.

**So CTM is wired to Google Ads but not to our lead intake.** Antek configured the conversion import; the post-call webhook to `vip-ctm-lead` was never pointed at us. That is the missing link for the call path, and it is Antek's to set rather than a build.

**Two distinct intake gaps, and they need different fixes. Do not conflate them.**

| Path | Receiver | Status |
|---|---|---|
| **Calls** | `RCV_vip_ctm_leads`, exists and ACTIVE | CTM is not posting to it. **One config step by Antek** |
| **Calendly** | none exists | Real build work, no receiver at all |

**The cost is now concrete rather than theoretical.** Antek verified a real caller from the built-in call report: **Tendring Electrical Ltd, Clacton-on-Sea, Essex**, a limited company in the target area, exactly the ICP. That lead called, and there is no contact, no opportunity, and nothing for OCT to upload. **A qualified lead the ads paid for has no record in the system built to hold it.**

### Antek's corrections, accepted 2026-08-19. One of them means my earlier advice was wrong

**The three call conversion actions measure three DIFFERENT surfaces, not one call counted three times.** His breakdown, which is more precise than the analysis this file previously carried:

- `Calls from ads` fires from call assets inside RSAs and requires a minimum call duration, so it is a genuinely qualified signal.
- `Clicks to call` is **Google-hosted, auto-created by the Google Business Profile integration**, so it measures the map pack surface.
- `Phone Click` measures the call button on the website.

**Therefore the real duplication risk is only `Phone Click` against the CTM goal**, because those two are the only pair measuring the same surface. The "one call registering three times" concern recorded earlier was overstated.

**And Oscar's recommendation to demote `Clicks to call` to secondary was wrong, which I passed on.** `Clicks to call` is the only thing measuring Google Business Profile calls. That is precisely the surface this file flagged as unmeasured under the separate-call-surface lesson. Demoting it would have removed the only measurement of the gap we were worried about. **The lesson generalises: do not judge conversion actions by name similarity; establish which surface each one observes first.** Antek has already adjusted the priorities himself.

**Compliance facts from Antek worth recording.** The consent banner **cannot be dismissed or bypassed**, by his deliberate design, so a visitor must actively choose and the "ignores the banner and scrolls" case this file described does not occur. He confirms the swap correctly does not fire on decline, and that forcing it to always swap is achievable but **not compliant, especially because CTM records calls**. Call recording is a fact nobody had recorded here and it raises its own consent obligations. **He agrees the "we track all calls" claim is inaccurate** and will qualify it in his own update to Kyle.

### STOP: do not send Antek the CTM webhook credential as it stands. Found 2026-08-20

The connection Antek needs is `POST https://singularweb.app.n8n.cloud/webhook/vip-ctm-lead` with header auth. **The header is `x-bernard-key` and that credential is shared across 14 endpoints in 12 workflows**, verified by matching credential id `L6Pw2vZt2DM7Qa8k` across every workflow:

`BERNARD_build`, `BERNARD_optimise`, `BERNARD_optimise_execute`, `BERNARD_fix` (propose **and** approve), `BERNARD_dispatch`, `BERNARD_standdown`, `BERNARD_status`, `CAP_meta_conversions`, `RCV_wa_inbound_wmi`, `RCV_dm_ghl_events` (two Meta CAPI nodes), `OP_call_bridge`, `RCV_vip_ctm_leads`.

**So handing that value to a contractor to wire up one call receiver would also hand him the ability to trigger Meta campaign builds, approve fixes and run optimise-execute across the whole estate**, plus push conversions to Meta. The reply drafted for Antek deliberately did not include the value and said it would follow separately, so nothing has leaked. **It must not simply be pasted to him now.**

**Fix before sharing anything: mint a dedicated header credential for `RCV_vip_ctm_leads` alone** and reassign that webhook node to it. That is a live workflow edit plus a new credential, so it is a founder action in n8n. Then Antek gets a key that reaches exactly one receiver and nothing else.

Generalised to shared memory as `one-shared-key-authenticates-everything`, because the next contractor integration will hit the same trap.

### The config-write path has no caller, so nothing could invoke it. Fixed 2026-08-20

Worth recording because it explains why `booking_url` and `clinical_gate.emergency_phone` sat unwritable all week, and it was not simply a missing key.

The path is complete at two layers and dead at the third. `MAINT_agent_config_write` enforces the allow-list and writes config plus audit atomically. `src/app/(admin)/clients/agent-actions.ts` wraps it with an Auth0 agency-admin gate, actor identity and cache revalidation, exposing `previewAgentConfig`, `applyAgentConfig` and `requestKbReingest`. **But nothing in the portal calls any of those server actions.** Grepped the whole of `src/`: the only reference is the file that defines them. So there is no button anywhere, and the founder could not do these writes either.

**Added `scripts/agent-config-write.mjs`**, a CLI client for the same sanctioned webhook. It deliberately does not touch the substrate, because bypassing the webhook would skip the allow-list, the tier-B preview and the audit row, which are the entire point of that design. It mirrors the tier map advisorily, refuses tier-B applies without `--confirmed`, and names the four keys the allow-list does **not** cover (`channels.web_chat.widget_token`, `channels.web_chat.preview_key`, `enabled`, `clinical_gate.vocabulary`).

**To use it, two values from n8n go into `.env.local`** (neither is in the repo and neither is on this machine): `SUBSTRATE_CONFIG_WRITE_URL` and `CONSOLE_CONFIG_KEY`, the latter being the value of the "Console config-write auth (x-console-key)" credential. Once they are in, the queued writes become one command each:

```
node scripts/agent-config-write.mjs preview 862f63e8-131c-4f33-90dd-5f31ebf0ee56 booking_url '"https://calendly.com/kyletheaccountant/30min"'
node scripts/agent-config-write.mjs apply   862f63e8-131c-4f33-90dd-5f31ebf0ee56 booking_url '"https://calendly.com/kyletheaccountant/30min"'
node scripts/agent-config-write.mjs preview 862f63e8-131c-4f33-90dd-5f31ebf0ee56 clinical_gate.emergency_phone '"07364237621"'
node scripts/agent-config-write.mjs apply   862f63e8-131c-4f33-90dd-5f31ebf0ee56 clinical_gate.emergency_phone '"07364237621"' --confirmed
```

**Kyle's dedicated work number `07364237621` is now the right value for the emergency phone**, replacing KST's leftover, and it is confirmed live on his Google Business Profile. The build of the missing portal UI remains the better long-term fix and is not done.

### THE ANSWER: Cookiebot is blocking the Calendly embed, so nobody can book. Verified 2026-08-20

Kyle spotted this and he is exactly right. It is the largest finding of the engagement and it retires most of the speculation above about why the CRM is empty.

**On the ad landing page `/limited-company-accountants/`, read live with no consent given:**

- `window.Calendly` is **undefined**
- the widget container exists and is **700px tall by 360px wide with no child iframe**, so it renders as a **700 pixel empty void**
- the only clickable Calendly links on the page are **Calendly's own privacy policy**. There is **no plain booking link anywhere on the page**
- `window.google_tag_manager` is undefined, so GTM never loads either

**So on the page the ads point at, at roughly £38 a click, the primary conversion action is completely non-functional for anyone who has not accepted cookies, with no fallback path.** The contact page has the same blank embed, though at least its container is smaller.

**Mechanism, confirmed.** Cookiebot is installed as a **page script via the WordPress plugin**, so it auto-blocks. Two scripts are held as `type="text/plain"`: an inline one under `statistics,marketing` (this is GTM) and a SiteGround optimizer asset under `preferences`. **No Calendly script tag exists in the DOM at all**, which means the Calendly loader is being injected by the blocked inline script, that is, through GTM. GTM is blocked, so Calendly never arrives. Calendly is collateral damage of GTM being consent-gated.

**This supersedes earlier reasoning in this file.** The empty CRM was attributed variously to Calendly never being wired to a receiver and to thin traffic. Both remain true, but **the dominant cause is simpler: visitors could not book at all.** Correct ordering now: the booking widget does not load without consent, and separately there is no receiver to carry a booking into the CRM even when one happens, and traffic is thin.

**Antek's diagnosis and plan are correct.** Moving Cookiebot into GTM rather than the WordPress plugin removes indiscriminate auto-blocking and replaces it with per-tag consent control, which is a standard and legitimate architecture and does deliver what Kyle asked for: calendar loads for everyone, Ads and CTM tags stay consent-gated. **Endorse it.** Two risks to handle rather than objections:

1. **Removing the WordPress plugin removes auto-blocking from every page script, not only GTM.** Today the exposure is small (only the two scripts above are being blocked), but anything hardcoded in the theme or another plugin would then fire regardless of consent. **Verify after the change rather than assume.**
2. **If GTM itself fails to load, the consent banner disappears with it**, because the banner would then be served through GTM. Ad blockers block GTM more often than Cookiebot's own domain. Worth confirming the fallback behaviour.

**A consent question remains even after the move.** Setting Calendly to fire without consent still sets Calendly's cookies without consent. The defensible framing is that a booking calendar is a service the visitor explicitly requested, and that is a reasonable position, but it is a position rather than a technicality. **Click-to-load is the cleaner end state**: a placeholder where the calendar sits, loading on click. Nothing loads until the visitor asks for the booking tool, which is both the strongest legal footing and guarantees everyone can book. Standard pattern for third-party embeds.

**Do the cheap thing first, today, regardless of any of the above: add a plain text link to `https://calendly.com/kyletheaccountant/30min` beside the embed on both pages.** A link sets no cookies, needs no consent, cannot be blocked, and works on every device. It stops the bleeding while the GTM rework happens on its own timescale. **The absence of this link on the landing page is the single most expensive detail in this whole file.**

Also from Antek, for the site list: **the sticky "Book a Call" / "Call Now" bar covers the footer on the landing page.**

### 2026-08-20 second pass: site partly fixed, and a spend decision that needs the founder

**Antek's tracking objection is correct and I had missed it.** Calendly booking tracking is bound **only to the embedded calendar, in GTM**. So the plain-text booking link recommended above would produce bookings nobody can see. That is a real cost rather than a quibble.

**The recommendation stands anyway, on this reasoning:** an untracked booking is still a client, a tracked non-booking is nothing. At three to five clicks a week there is not enough volume to train bidding either way, so the measurement loss is small in practice and recoverable, while a lost booking is permanent. Accept a few days of invisible bookings.

**But his two options point at a better permanent fix than either of my suggestions.** He offers Calendly native GA4, or a redirect to a thank-you page on VIP's own site. **Prefer the redirect.** It tracks a booking however it started, embedded calendar, plain link, or the link in the six nurture emails, which the GTM-bound version structurally cannot. It also survives Calendly plan changes and gives a real page to attribute against. **Blocked on knowing Kyle's Calendly plan**, which Antek is checking.

**⚠ A spend decision the founder needs to take, flagged 2026-08-20.** Antek said he would add a batch of keywords **today** to ensure spend clears a threshold by **9 September** and triggers a promotional coupon. **That is spend driven by a deadline rather than by funnel readiness, and the funnel's main conversion path is currently closed** for anyone who has not accepted cookies. It also runs against Oscar's standing advice to get two or three stable weeks before adding volume, and it would mix a broken funnel, a fixed funnel and a new keyword set into the same fortnight of data so nothing is attributable. **Raised with Antek and asked him to hold; if the deadline genuinely cannot move, the founder decides.**

**Site status verified from outside, and Antek's report is optimistic in two places.** He reported the number work done bar one page.

- **The old number `07901730271` is still live on `/limited-company-accountants/`**, the ad landing page, alongside the new one. He reported this item complete. It is the one page where it matters most.
- Still in the text of `/privacy-policy/` and `/cookie-policy/`. Probably deliberate policy text, low priority, but a privacy policy naming a superseded number is worth tidying.
- **Five pages lack the new number, not one**: `/financialhealthtest/`, **`/our-services/corporation-tax-returns/`** and the three policy pages. He named only the first. The corporation tax page is a real service page and is the one worth fixing.
- **No plain booking link exists on any page**, matching his account.
- Sticky bar still overlapping the footer.

Confirmed done and verified: new number present on the other 14 pages, and the contact-page Calendly slug corrected.

**⚑ Antek is invisible to clients, and this is a hard rule. Corrected 2026-08-20 after this file got it wrong.**

**Antek operates entirely under Baptiste's identity:** Baptiste's Slack account, and Baptiste's Google Ads, GTM, GA4 and Cookiebot accounts. **His name is never visible to Kyle or any client.**

**An earlier version of this entry asserted the opposite**, that Antek had replied to Kyle under his own name and therefore Kyle already knew of him. **That was wrong.** The error came from reading the founder's own attribution in a pasted transcript ("from Antek who is setting up CTM for us") as though it were what Kyle saw in Slack. It is not: Kyle sees Baptiste. Kyle addressing his message to "Anthony & Baptiste" is consistent with that and should have been the clue.

**It nearly caused a real leak.** The drafted reply to the Cookiebot thread, which Kyle reads, named Antek five times. Nothing had been sent, and it is corrected to Baptiste. **Any message into a client-visible thread must use Baptiste, never Antek.** Internal notes addressed to Antek alone are fine under his own name.

Generalised to shared memory as `contractor-identity-is-not-the-visible-identity`, because the same trap applies to any pass-through arrangement and to any session reading a pasted transcript.

**Process note.** The two documents were shared with Antek for extraction of what was relevant to his side, not as outgoing client copy. He reviewed them as though they were going to Kyle verbatim, which produced the name request and some of his other comments. Clarified in the reply.

### 2026-08-20 evening: Calendly fixed, and the predicted regression landed. CTM now tracks without consent

**The Calendly fix works and is verified.** Cookiebot moved into GTM. Read live on the ad landing page with **no consent given** (`necessary: true`, `preferences/statistics/marketing: false`):

- `window.Calendly` is loaded, and the widget holds a real iframe at `calendly.com/kyletheaccountant/30min?embed_domain=vipaccounting...`
- so the calendar renders and is bookable for everyone, which is exactly what Kyle asked for

**But the risk flagged when the plan was endorsed has materialised, and it is the one that matters.** With marketing and statistics both **false**:

| Read | Value |
|---|---|
| number shown | `tel:+447861938724`, the **CTM tracking number, swapped** |
| elements carrying `data-ctm-tracked` | 3 |
| cookies set | `__ctmid` (the **only** cookies on the page) |
| localStorage written by CTM | 9 keys, including `__ctm2_602264`, `_ctm_602264_gid_` and `_ctm_2495288.44.7364.23.76.21` |

**So CTM is swapping numbers, setting identifiers and persisting them with no consent given.** This is precisely what Antek himself ruled out doing deliberately: "I could manually assign cookie parameters to the CTM tag ... but it would not be compliant, especially given that CTM records calls." It is almost certainly fallout from removing the WordPress plugin's auto-blocking rather than a decision, because that blocking was the only thing holding CTM back.

**This is a live compliance problem on a client's site, involving call recording**, and it should be fixed before any more traffic is bought. It also inverts the previous position: CTM used to under-count because it only saw consenting visitors; now it sees everyone, because it is not asking.

**Second gap, which Antek raised himself and is right about.** There is **no consent withdrawal mechanism**: no renew link, no Cookiebot widget, nothing (`has_renew_link: false`). Removing the floating button took it away. Withdrawal must be as easy as giving, so his proposed fix, adding the CookieDeclaration script to the cookie policy page, is correct and should be done promptly rather than filed as tidy-up.

**On removing the temporary booking button: agreed.** The embed is verified working without consent, which was the only reason for it. Its copy ("Calendly not loading?") advertises a fault on a paid landing page and should not survive. The residual case it covered, ad blockers blocking the Calendly embed, is real but much smaller and does not justify the clutter.

**Correction to this file's earlier reasoning.** The entry above recommended a plain link partly because bookings through it would be untracked. That tradeoff is now moot: the embed works, so tracking stays intact via the GTM binding. **The redirect thank-you page remains the better permanent answer** for the nurture emails, whose links bypass the embed entirely.

### 2026-09-01 later: chat config written, widget path PROVEN end to end

`CONSOLE_CONFIG_KEY` landed, so every queued write went through the audited path. All returned `updated: 1, audited: 1` and were verified by read-back.

| Key | Was | Now |
|---|---|---|
| `clinical_gate.emergency_phone` | **`020 3150 2074`, KST's** | `07364237621` |
| `booking_url` | null | `https://calendly.com/kyletheaccountant/30min` |
| `booking_link_label` | null | `Book a free discovery call` |
| `cant` | 6 entries | **14**, extended from Kyle's own must-not-answer list |
| `brand_voice` | generic | merged with Kyle's tone guidance |
| `confidence_threshold` | 0.6 | **0.75**, the hand-off-on-doubt instruction |
| `channels.web_chat.widget_token` | null | `wct_ODpZ…` (public by design) |
| `channels.web_chat.preview_key` | null | set, secret |
| `enabled` | false | **still false**, deliberately |

**CORS added**: `vipaccounting.co.uk` and the `www` form appended to `AGENT_webchat`'s chat trigger. Verified all **eight** pre-existing origins survived, so KST, DentalMastery, Shallowford and SingularWeb widgets are untouched, only that node changed, connections identical, still active.

**Proven on the real widget path using the preview key, with `enabled` false so no visitor could see any of it:**

- "How do I book a call?" returns the booking link as a proper markdown link. **That was the defect where it offered a consultation and had no link to give.**
- "I have missed my filing deadline and a penalty notice has arrived" returns **"ring the team right away on 07364237621"**. KST's number is gone from the live path, proven rather than assumed.
- "Should I pay myself in salary or dividends?" still refuses and escalates.

`shown: true` on all three, so the preview route works and the widget is functional while invisible to the public.

**Latency: encouraging, NOT cleared.** Seven calls through the full widget path ran **3.6s to 8.1s, none over 60s**. But the original defect was 2 occurrences in 16 calls, so roughly one in eight; **seeing zero in seven is entirely unremarkable at that rate and proves nothing.** Ten clean calls today against an expected ~1.25 is mildly reassuring and no more. Either sample harder before going live or accept a known residual risk deliberately. **Do not record this as fixed.**

**Snippet written**: `~/Documents/VIP_CHAT_SNIPPET_2026-09-01.md`, no preview key in it since the site is public.

**Robustness finding, incidental.** An unknown or stale `widget_token` makes `AGENT_webchat` return **HTTP 500 "Error in workflow"** rather than degrading to the unavailable message. Found by accidentally passing a malformed token. So a token typo in a client's page produces errors rather than a graceful fallback. Worth hardening, not urgent.

### 2026-09-01: two of the three blockers cleared, both verified

Founder instruction to do items 1 to 3. Two are done; the third is genuinely impossible from here.

**Item 3, the allow-list, DONE.** `MAINT_agent_config_write` node "Validate + allowlist" now accepts five more keys, all tier B so they stage through preview before apply:

`channels.web_chat.widget_token`, `channels.web_chat.preview_key`, `enabled`, `clinical_gate.vocabulary`, `wa_public_token` (top-level path, not under `agent`).

**`preview_key` was added beyond the four specified, deliberately.** It is the key that allows the widget to be tested on the live site before `enabled` is flipped. Without it the only way to test is to turn the chat on for every visitor at once, which given the unresolved latency defect is not a test anyone should run.

**A latent bug was found and fixed in the same pass.** The type handling had branches for `number`, `array` and a string fallback, and **no boolean branch**. Adding `enabled` without fixing that would have written the **string `"true"`** into config rather than boolean `true`, and `AGENT_webchat`'s gate is `a.enabled === true`, a strict comparison. So the chat would have stayed dark while the config looked correct. A boolean branch now coerces and validates.

Verified after the write: **exactly one node changed**, all other node parameters byte-identical, connections identical, workflow still active.

**Item 1, the dedicated CTM credential, DONE and proven.** New n8n credential `VIP CTM intake auth (x-vip-ctm-key)`, id `aKbo5a187LzqVwbg`, header **`x-vip-ctm-key`**, assigned to the `vip-ctm-lead` webhook node only. Verified: only the credential reference changed, no node parameters touched, connections identical, still active.

**Proven live against the endpoint**, using a junk payload so nothing real was created:

| Request | Result |
|---|---|
| no header | **403** |
| old `x-bernard-key` | **403** |
| new `x-vip-ctm-key` | **200** |

So the receiver no longer answers to the shared key, and the scope is genuinely narrowed rather than merely renamed. `RCV_vip_ctm_leads` no longer references credential `L6Pw2vZt2DM7Qa8k` at all.

**The value is in `~/.config/singularweb/substrate.env` as `VIP_CTM_INTAKE_KEY`** (chmod 600), never printed to chat and never written to the repo. It is what goes to Antek, with the endpoint `https://singularweb.app.n8n.cloud/webhook/vip-ctm-lead` and the header name.

**Item 2, the config-write key, CANNOT be done from here.** `GET /api/v1/credentials/:id` returns id, name, type and timestamps and **no `data` field**, so n8n does not expose credential values over the API by design. Only the founder can read `CONSOLE_CONFIG_KEY` from the n8n UI. **This remains the single gate on every config write**, including replacing KST's phone number.

### 2026-08-31 verification against Oscar's two gates

Read live on the ad landing page at `statistics: false, marketing: false`, which is the exact condition that was broken.

**Gate 1, the booking path: PASSES.** `window.Calendly` loaded, real iframe present on `calendly.com/kyletheaccountant/30min`. **So the two-week clean-data clock can start from today**, and Kyle can be told that honestly.

**Gate 2, calls reaching the CRM: FAILS.** Receiver still shows no executions. Unchanged.

**Two compliance items raised on 20 August are still open 11 days later**, both verified again today:

- **CTM still tracks with no consent.** `window.__ctm` loaded, number swapped to `tel:+447861938724`, `__ctmid` cookies set, all at `marketing: false`.
- **No withdrawal control exists.** `#CookiebotWidget`, a renew link and `#CookieDeclaration` are all absent. Antek proposed adding the declaration script to the cookie policy page and it has not been done. Withdrawal must be as easy as consent, so this is a live gap on an accountancy practice's site.

### 2026-08-31: a week gone, blockers unmoved, £686 spent into the broken path

**Nothing on the 20 August action list has been actioned.** Verified today: the CTM receiver still shows no executions, `booking_url` is still NULL, `enabled` still false, and `clinical_gate.emergency_phone` is **still KST's `020 3150 2074`**. So the config-write key never landed and the allow-list was never extended.

**Meanwhile the account scaled.** Oscar's read for 24 to 30 August: **£686.59 spend, 459 impressions, 23 clicks, zero conversions.** Spend up **82.6%** and clicks up **228.6%** week on week. So the keyword expansion went ahead, into a week when the booking calendar still would not load for anyone who had not accepted cookies. **That is the outcome the hold was meant to prevent**, and it is worth naming plainly rather than filing quietly.

**Oscar's diagnosis, and it is evidence-backed rather than charitable.** Search impression share **88.58%** (absolute top 67.65%), search terms clean and on-target ("essex accountants", "accountancy firms essex", "small biz accounting"), no spend on junk queries, Essex £490.93 and National £195.66 both at zero. **Real targeted clicks converting to zero at healthy impression share is the signature of a broken destination, not weak media buying.** He attributes the large majority to the funnel.

**His caveat matters and is now a question for Kyle: "zero conversions" is what we can see, not necessarily what happened.** With calls never connected to the CRM, phone enquiries would be invisible. So the reply to Kyle asks him directly whether he has had any calls, because if he has, they exist and were simply never recorded.

**Also from Oscar: 22 changes were made in that week** (10 negative keywords, 5 campaign-level negatives, 5 targeting updates, 2 keywords added) **while the destination was broken**, so all of it was tuned against a page that could not convert. None provably wrong, none validated. **His instruction, adopted: change nothing further until there is clean data.** No budget moves, no further keyword or negative work, and no judgement on National versus Essex, which cannot be compared while both are zero for the same reason.

**Expectation set with Kyle: two full weeks of clean data from the day the booking path is confirmed working in the exact broken scenario**, not from today, and not treating week one as a verdict either way. Oscar's two verification demands are adopted: confirm the calendar loads for a visitor who has **not** accepted the banner, and confirm call tracking actually reaches the CRM, each proven separately rather than assumed.

### STATUS REGISTER, 2026-08-20. Pledged versus real, all verified today

**The one integrity problem, and it is a pledge not a build.** The 15 August message to Kyle states, in the present tense: *"Your client system is built and tested. Every enquiry now has a place to live and a path through it... Nothing falls through a gap"* and *"You get told the moment a website enquiry arrives."*

Verified today: **0 contacts and 0 opportunities, ever.** The `vip-accounting Website Lead Notifications` workflow is published with **zero enrolments in its lifetime**. A real qualified caller (Tendring Electrical Ltd) reached nobody. **So that pledge is not true as written and should be corrected with Kyle rather than left standing.** Everything else was pledged as future work and is honestly stated.

| Capability | Pledged as | Real state | Blocked on |
|---|---|---|---|
| **OCT upload leg** | done | **Genuinely built**, smoke-tested, correct `vip-stage-changed` path, both Google actions live and secondary | nothing |
| **OCT input leg** | done | **Absent.** Calls: CTM never pointed at `vip-ctm-lead` (6 executions ever, all the 1 Aug test). Calendly: no receiver exists at all | a dedicated credential, then Antek's webhook target; then real build work for Calendly |
| **Enquiry intake / notifications** | done | **Never fired.** Zero enrolments | same as above |
| **Email nurture** | written, not live | **Copy approved by Kyle**, no blanks, link corrected | the GHL UI build, the sending domain, and the intake gap (trigger is Opportunity Created, which nothing can reach) |
| **Live AI chat** | still to come | KB live (4 docs, 32 chunks incl. Kyle's 102 Q&As). Refusals verified on both gates | `booking_url` NULL, `emergency_phone` still KST's, `widget_token` NULL, `enabled` false, CORS missing, latency defect |
| **WhatsApp widget** | still to come | Built and proven elsewhere, not on VIP | tenant row + token, one site edit, and the WABA number decision |
| **WhatsApp bridge** | offered free | Not started for VIP | the number-ownership decision |
| **SMS / conversational agents** | **not pledged to Kyle** | Not started anywhere | deliberately last, no traffic to nurture |

**Confirmed unwritable via the sanctioned config path** (not on the allow-list, so no key solves them): `channels.web_chat.widget_token`, `channels.web_chat.preview_key`, `enabled`, `clinical_gate.vocabulary`. **The chat cannot go live without an allow-list change**, regardless of `CONSOLE_CONFIG_KEY`.

**Two compliance items now open on the live site**, both today: CTM tracking with no consent given, and no consent-withdrawal mechanism at all. Both with Antek.

**Also outstanding:** missed-call fallback (Kyle approved it in writing, nobody owns it), pipeline still named `KST Leads`, sticky bar overlapping the footer, old phone number still on the ad landing page, five pages missing the new number, the KST tax base needs de-branding plus Kyle's sign-off before any tax facts reach VIP's assistant, and the keyword/coupon spend decision by 9 September.

**Two pieces of our own infrastructure are missing, discovered this week and worth naming:** the portal has no UI calling the agent-config server actions, so nothing could invoke the config-write path (mitigated by `scripts/agent-config-write.mjs`); and `x-bernard-key` is shared across 14 endpoints, so no contractor can be given a receiver credential until a dedicated one exists.

### Superseded: what was left to build, consolidated 2026-08-16

The rollout plan's six capabilities plus what this session added. Ours to build:

| # | Work | State |
|---|---|---|
| 1 | Nurture workflow in the GHL UI | Spec fully resolved in the build sheet appendix. Roughly 20 minutes by hand. Blocked only by the iframe, not by any decision |
| 2 | Add the sending domain in GHL | Prerequisite for Kyle's DNS, because it generates the DKIM value |
| 3 | Fix the emergency phone | Number verified. Tier B config write, needs the `x-console-key` |
| 4 | Webchat latency defect | ~82s core against `Call core`'s 60s timeout. Undiagnosed, and it fails roughly 1 message in 7 once live |
| 5 | WhatsApp widget on VIP | Built and proven on wmiltd.com. Needs a tenant row, a widget token, one script tag |
| 6 | SMS / WhatsApp nurture | The only item not started anywhere. Sequence last; there is no traffic to nurture yet |
| 7 | Rename the pipeline | `KST Leads` to `VIP Leads` |
| 8 | Missed-call fallback | Kyle approved it. **Ownership unsettled**: CTM is Baptiste's, KST's equivalent is a GHL workflow of ours |

**Critical path is shorter than the list looks.** Items 1 and 2 plus Kyle's two MTD lines put the emails live. Items 3 and 4 put the assistant live, and **item 4 is the only one on the list whose size nobody yet knows**.

### Brand assets, and a note on the headshot

Kyle sent a headshot on 2026-08-16. It was requested, not volunteered: `docs/VIP_CALL_CHECKLIST.md` §5 asks for logo, brand colours and "a photograph of him, which for a one-man practice outperforms stock imagery".

**That rationale does not hold for this client.** VIP is Google Search only by his own choice, and Search ads carry no photography. The ask was reasonable brand-asset hygiene with a justification borrowed from a channel VIP does not run. **Where it does earn its place is the Google Business Profile**, which for VIP is a live call surface rather than decoration: it holds the phone number and 34 reviews at 5.0. It does **not** go in the nurture emails, which are deliberately plain text with no images so they read as personal rather than as a mailshot.

**Closes a questionnaire gap.** The same checklist section flagged "where the reviews live" as unknown and needed, because an ad claim has to be substantiable. Answered: Google, 34 reviews at 5.0, and Kyle confirms all recent reviews go straight there.

### Not ours

Call tracking is CallTrackingMetrics, Baptiste's. The one item owed there is the **triple-primary conversion decision**, open since 1 August: `Calls from ads`, `Clicks to call` and `Phone Click` are all marked primary in VIP's Google account, so a CTM integration adding its own would double-count. **Route any Google Ads reading or change through Oscar**, per the standing instruction; do not read the account directly from this session.

---

**VIP Accounting: the blueprint's first real run, opened 2026-07-31.** VIP ACCOUNTING LTD (15887435, active, Benfleet, Essex SS7 5XU, incorporated August 2024). Google Search only by client choice, £1,500/month rising ~£2,500, Essex, limited-company owners, conversions are phone calls and Calendly bookings. Full runbook: `docs/VIP_ACCOUNTING_ONBOARDING.md`; questionnaire: `~/Downloads/Google Ads Questionnaire Vipaccounting.md`. Sequence: founder snapshots KST as "Accountancy Blueprint v1", creates the VIP sub-account from it, mints `GHL_VIP_PIT`; then clone verification, client_slug rewires (snapshots copy webhook payloads verbatim, so the cloned OCT workflows still say kst until fixed), substrate tenant `vip-accounting`, Google Ads foundation. The VIP call-tracking number queues behind the Twilio bundle approval. Note for the nurture: VIP has Calendly, a real booking link, so the sequence KST could not ship can ship here first. This is primarily Oscar's client, the first since he was named.

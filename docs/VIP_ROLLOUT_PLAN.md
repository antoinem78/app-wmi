# VIP Accounting: the whole rollout, all six capabilities

**2026-08-15.** Status read live, not from the register. This exists because the plan kept being discussed one piece at a time.

**Correction that shrinks the plan:** call tracking for VIP is **CallTrackingMetrics**, on Baptiste's plate. No GHL support ticket, no Twilio number, no number swap on the website. Earlier versions of the VIP documents said otherwise and were wrong.

## Where the six stand

| # | Capability | Status | Blocked on |
|---|---|---|---|
| 1 | **OCT** | Built. Never fired. | A first real deal reaching a stage |
| 2 | **Email nurture** | Written in full. Not built. | Nothing to build it. Kyle's review and a sending domain to send it |
| 3 | **SMS / WhatsApp nurture agents** | Not started, anywhere | The 07 in GHL, and a design |
| 4 | **WhatsApp widget** | Built and proven on wmiltd.com. Not on VIP | A tenant token and one site edit |
| 5 | **Live AI webchat** | Tenant provisioned, `enabled: false`. **Zero knowledge-base documents** | The knowledge base |
| 6 | **CallTrackingMetrics** | Baptiste's | The triple-primary conversion decision, open since 1 August |

**The pattern worth naming: five of six are built and stopped one step short of live.** Almost nothing here is engineering.

---

## 1. OCT: prove it, do not rebuild it

Both upload actions are live in Google, secondary by design so Baptiste's bidding is untouched: `Consultation booked (CRM)` and `Client won (CRM)`, 90-day window. The receiver `RCV_vip_stage_change` is ACTIVE and last ran on 1 August, the smoke test.

It has never fired for real because **VIP's pipeline has held zero opportunities, ever**. OCT reads stage changes; with nothing in the pipeline there is nothing to read.

**Step:** when Kyle's first booking arrives, move it to Consultation Booked and watch the conversion land in Google. Five minutes, and it proves the most valuable thing built for this client.

**One unverified item:** the two GHL stage workflows were recorded on 1 August as still posting to the KST webhook path. Nothing has flowed since, so it is untested either way. Check it as part of the first real deal rather than in the abstract.

## 2. Email nurture: build it now, send it later

Six emails written out in full: `docs/VIP_NURTURE_BUILD_SHEET.md`. Trigger, waits, exits and tokens all specified. Workflow creation has no API, so the build is a UI job.

**Two gates before it sends, and they are different in kind.**

**Kyle reviews every email.** Founder ruling 2026-08-15. He is an accountant and these go out under his name, so he is the only competent reviewer of the tax content. Email 3 already contains no MTD dates at all, only placeholders, for exactly this reason.

**A sending domain.** VIP has none. KST's works and is the proven pattern: `mail.` SPF including `spf.leadconnectorhq.com` and `mailgun.org`, two Mailgun MX, DMARC `p=none`, plus DKIM generated when the domain is added in GHL. VIP's DNS is at **SiteGround**, NS and SOA agree, no orphan-zone trap. **We do not know who holds the SiteGround login. That is a question for Kyle and it is the real dependency.**

Do not send from GHL's shared domain in the meantime. An accountant emailing prospects about tax from a generic sender is the mail that lands in spam, and it would waste enquiries the ads paid roughly £16 a click for.

## 3. SMS and WhatsApp nurture: genuinely not built

The only item on the list that is real new work.

**Prerequisites, in order:** the 07 imported into a GHL location (try VIP's; if GHL refuses because that number is already a WhatsApp channel, a dedicated number is £1.89 a month), inbound handling so replies land somewhere, then a short flow.

**Design constraint:** SMS to enquirers who asked to be contacted is consent in substance. Cold SMS is a different question and a different answer.

**Sequence it last.** It adds a channel to a funnel that currently has no traffic in it.

## 4. WhatsApp widget: one line, once someone can edit the site

The widget already captures **gclid, fbclid, msclkid, gbraid, wbraid and all five UTM parameters**. The Bing half is already built.

**Steps:** tenant row plus a public widget token for VIP, then one script tag before `</body>`. His partner does site edits, reached through him by email.

**Worth bundling.** Do not send her a change request per capability. The widget tag and, later, the chat widget tag are one email.

**Note:** WhatsApp inbound needs a number on the WhatsApp Business Platform. Whether VIP gets their own or shares ours is a decision, and it is the same ownership question the bridge proposition is built on.

## 5. Live AI webchat: the knowledge base is the blocker, not the switch

Tenant `vip-accounting` has a full agent config, `enabled: false`, `mode: shadow`.

**VIP has zero knowledge-base documents.** Shallowford has 37, KST 12, SingularWeb 8, DentalMastery 3.

Turning the agent on today produces a chatbot that knows nothing about the practice. **The knowledge base is the work; the switch is trivial.**

**Source material that already exists:** Kyle's fee and packages write-up of 12 August, his four USPs, the ICP definition, the switching process, and his own site copy. Plus HMRC-derived FAQs, which need care: the agent's clinical gate refuses tax advice and offers a handoff, which is correct and protects him.

**Order is not optional.** Knowledge base, then shadow-mode testing, then enable, then the widget on the site. `MAINT_kb_ingest` is working again as of 8 August, so ingestion is a matter of putting documents in the Drive folder.

## 6. CTM: not ours, but one thing is owed

Baptiste owns it. The item outstanding since 1 August: **three call conversions in VIP's Google account are all marked primary** (`Calls from ads`, `Clicks to call`, `Phone Click`). If CTM's integration adds its own, calls count more than once and the reported cost per lead flatters itself. That decision has not moved in two weeks.

---

## The order I would run it

**Now, no dependencies:** build the nurture workflow, switched off. Start the knowledge base.

**Ask Kyle, one message:** who holds the SiteGround login, and will he review the six emails.

**When his assets arrive:** the WhatsApp widget tenant and token, ready for a single bundled site-edit email.

**When his first deal moves:** prove OCT.

**Then:** knowledge base done, chat to shadow, chat live, widget on the site.

**Last:** SMS and WhatsApp nurture, once there is traffic worth nurturing.

**To Baptiste, separately:** the triple-primary conversion decision.

# VIP nurture: the six emails, ready to build

**2026-08-14.** The blockers cleared this morning: Kyle sent the Calendly link and his fee numbers. This replaces the shorthand in `~/Documents/VIP_NURTURE_SEQUENCE.md` with the actual text.

**Build it in the GHL UI.** Workflow creation has no API, so this is a founder job. Everything below is copy-paste.

---

## ⚑ COPY APPROVED BY KYLE 2026-08-17. Content is final; only the build and the sending domain remain.

His words: "Rest of the emails are all good!" He changed one email himself and corrected one link. Three things changed on 2026-08-17 and all are already applied below.

1. **Email 3 is no longer the Making Tax Digital email.** He replaced it, and his reasoning is sound. See that section. **Consequence: no blanks remain anywhere, and no email states any tax figure, threshold or date.** The "Kyle must confirm thresholds" gate is retired.
2. **The booking link changed and the old one is DEAD.** He renamed himself on Calendly, which silently changed the slug. Old `calendly.com/kylerandall/30min` returns **HTTP 404**, verified. Live link is `https://calendly.com/kyletheaccountant/30min`, **HTTP 200**, verified 2026-08-17. It is now correct in all five places below. **Building from any copy dated before 2026-08-17 would have shipped five dead booking links.**
3. **Pricing is £100, per his 2026-08-16 agreement.** Already applied in email 4.

**Re-verify the booking link immediately before you build.** It has already changed once without notice, and a Calendly slug follows the account name.

**Still outstanding before it can send, and neither is Kyle's:** the workflow itself must be built in the UI, and the sending domain must exist. Nothing else.

## Workflow settings

**Trigger:** enquiry created with no consultation booked.
**Waits:** immediate, day 2, day 4, day 7, day 11, day 15.
**Send window:** weekdays 08:00 to 17:00 UK.
**From:** Kyle Randall, kylerandall@vipaccounting.co.uk.
**Exit on any of:** consultation booked, reply received, client tag applied, unsubscribe.

**Booking link, used in emails 1 to 5:** `https://calendly.com/kyletheaccountant/30min`

**Use the token picker for merge fields.** Do not hand-type them. A hand-typed token that GHL does not recognise is the "issues in your custom variables" error, and it is the most common way this build fails.

---

## Email 1, immediate

**Subject:** Your enquiry, {{contact.first_name}}

> Hi {{contact.first_name}},
>
> Thanks for getting in touch. I have your enquiry and I will come back to you properly shortly.
>
> The fastest way to get you a useful answer is a short call. No charge and no obligation. I will look at how the business is set up now, tell you where you are likely paying more tax than you need to, and what having someone on top of your numbers all year round would actually look like.
>
> Pick a time here: https://calendly.com/kyletheaccountant/30min
>
> Or just reply and tell me a bit about the business. Either works.
>
> Kyle
> Kyle Randall, VIP Accounting, Benfleet

## Email 2, day 2. Objection: switching is a hassle

**Subject:** The bit everyone worries about

> Hi {{contact.first_name}},
>
> When people put off changing accountant, it is almost never about the accountant. It is the assumption that moving will be a fortnight of admin they do not have time for.
>
> Here is what it actually involves on your side: you sign one authorisation so I can deal with HMRC for you. That is it.
>
> I request your records from your current accountant, handle the professional clearance between us, and take it from there. It usually takes a week or two in the background. There is no gap in your service, nothing gets missed, and you never have to chase anyone or have an awkward conversation.
>
> If that is the only thing that has been stopping you, it is worth a short call: https://calendly.com/kyletheaccountant/30min
>
> Kyle

## Email 3, day 4. REPLACED BY KYLE 2026-08-17. No longer Making Tax Digital

**The MTD email is withdrawn and there are no blanks left anywhere in the sequence.**

Kyle replaced it himself and gave his reasoning as the accountant: **MTD is mainly for the self employed in the UK at present**, so leading with it to a limited-company audience invites confusion. His words: "I have changed email 3 to be better targeted for Ltd companies, as MTD is mainly for self employed people in the UK at the minute so want to avoid any confusion with them."

That is a better call than the original and it is exactly why the blanks were left for him rather than guessed. **Note what it retires: the "Kyle must confirm thresholds and dates" gate is gone, because there are no dates in the sequence at all now.** Nothing in these six emails states a tax figure, threshold or deadline.

His replacement, verbatim except that `[first name]` becomes the GHL token:

**Subject:** Do you only hear from your accountant once a year?

> Hi {{contact.first_name}},
>
> A lot of business owners only really hear from their accountant when their accounts or tax return are due.
>
> The problem is that by then, the year has already happened.
>
> There is a big difference between someone filing your accounts correctly and someone actually keeping an eye on your tax throughout the year.
>
> I keep your bookkeeping updated, let you know where you stand with tax and how much you should be putting aside, and look for ways to make the business more tax efficient before the year is already over.
>
> So when a tax bill arrives, it should not be a surprise, and you are not left wondering whether you could have done something differently six months earlier.
>
> If you only hear from your accountant when something needs filing, it is worth a short call:
>
> https://calendly.com/kyletheaccountant/30min
>
> Kyle

## Email 4, day 7. Objection: cost

**This is the one that was blocked, and the numbers are now his own.**

**SUPERSEDED 2026-08-16: the floor is £100, not £80. Kyle agreed the pricing push back in writing** ("On the pricing yes I agree with this, I'm happy to go with starting from £100"). The text below has been updated. The original reasoning is kept because it still explains why a number appears here at all.

**A note on the starting price.** I advised keeping the £80 starting price out of the *ads*, because at roughly £16 a click it attracts the price-shopping micro-business Kyle said he does not want. Kyle has now moved the public floor to £100 outright, which settles it for every surface rather than just the ads. **The email is still the opposite situation to an ad.** A one-to-one email to someone who already enquired, on the subject of cost, has to answer the question with a real number or it reads evasively. Different context, different answer.

**The tidy-up fee stays vague on purpose**, per Kyle's ruling that it should not be public. Saying it is quoted before any work starts is both truthful and better selling than a range.

**Subject:** What we charge

> Hi {{contact.first_name}},
>
> You are probably wondering about cost, so let me answer it plainly rather than make you ask.
>
> Limited company packages start at £100 a month. Most clients land between £100 and £200 a month, depending on the size of the business, how many transactions there are, and how much you want me to take off your hands.
>
> Whatever we agree is covered by that one monthly fee. You do not get charged every time you need something, and you are not billed for asking me a question.
>
> If your bookkeeping has fallen behind or there are filings outstanding, there is sometimes a one-off piece of work to bring things up to date. I would look at what is actually involved and agree the cost with you before starting anything.
>
> The call is free and you would get a proper figure at the end of it: https://calendly.com/kyletheaccountant/30min
>
> Kyle

## Email 5, day 11. Objection: my accountant is fine

**Subject:** What I usually find

> Hi {{contact.first_name}},
>
> "My accountant is fine" is a fair answer, and often a true one. But filing your accounts correctly and actively helping you pay less tax are two different jobs, and plenty of firms only do the first one well.
>
> The things I most often find on a first review:
>
> A salary and dividend split that has not been looked at since the company was set up. Allowable expenses nobody claimed because nobody asked. Pension contributions that would have reduced the corporation tax bill. A VAT scheme that was the right choice three years ago and is costing money now.
>
> None of that means your accountant is bad. It usually means nobody has looked in a while.
>
> I am happy to look and tell you honestly if everything is already in good shape: https://calendly.com/kyletheaccountant/30min
>
> Kyle

## Email 6, day 15. Close the file

**No booking link. Replies only.** The absence of a link is what makes this one work.

**Subject:** Shall I close your file?

> Hi {{contact.first_name}},
>
> I have not heard back, so I will assume you are sorted and stop emailing.
>
> Before I do, one line back would help me:
>
> 1. Not now, try me later in the year
> 2. Sorted elsewhere
> 3. Actually yes, let us have that call
>
> No reply is fine too and I will take it as a 2.
>
> Thanks either way,
> Kyle

---

## Before it goes live

**1. Sending domain. UPDATED 2026-08-16, and it is no longer blocked on access.** DNS is at **SiteGround** (`ns1/ns2.siteground.net`, SOA agrees, so no orphan-zone trap here, unlike webmarketinginternational.com). **Kyle holds the login himself** and has offered either to make the changes or to add us ("I have access to these"). The earlier assumption that this routed through his partner was wrong; she does site edits, not DNS.

**Correction to the subdomain choice: use `send.`, not `mail.`.** Re-read live 2026-08-16: `mail.vipaccounting.co.uk` is **already occupied** by a SiteGround A record (`35.214.51.171`), so it is not the clean subdomain the 14 August note assumed. `send.vipaccounting.co.uk` resolves to nothing and is free. Using it also keeps the whole change well away from live mail, which is **Microsoft 365** (`vipaccounting-co-uk.mail.protection.outlook.com` at the apex). Nothing in this set touches the apex MX.

**Sequencing, and it matters.** The DKIM value does not exist until the sending domain is added in GHL, which generates it. So the order is: add the domain in GHL first, then send Kyle one complete record set. Do not send him five of six records and a promise, because a half-implemented sending domain fails silently.

**The record set, taken from KST's working configuration read live 2026-08-16** (`mail.kst-accountants.co.uk`), with the host changed to `send.`:

| Type | Host | Value |
|---|---|---|
| TXT | `send` | `v=spf1 include:spf.leadconnectorhq.com include:mailgun.org ~all` |
| MX | `send` | `mxa.mailgun.org` priority 10 |
| MX | `send` | `mxb.mailgun.org` priority 10 |
| TXT | `k1._domainkey.send` | `k=rsa; p=` + the value GHL generates |
| CNAME | `email.send` | `mailgun.org` |

Plus DMARC at the apex, which **already exists** on VIP at `p=none`. KST runs `p=quarantine`. Leave VIP at `p=none` until the domain has been sending cleanly for a while; tightening it early is how legitimate mail starts disappearing.

**Do not let this block the build.** Build the workflow first and leave it in draft.

**2. Test send to Gmail** and check SPF, DKIM and DMARC alignment before enabling.

**3. Warm up.** New enquiries only. No backfill into the sequence.

**4. One deliberate omission.** Email 3 does not state any MTD threshold or date. Kyle fills those in himself. Inventing a tax date in an email a client sends under his own name is the single worst thing this sequence could do.

---

## Appendix, 2026-08-16: the build spec resolved against the live account

The workflow settings at the top of this sheet were written in shorthand. Everything below was read from VIP's live GHL location `2acFC47p3x6Qdoqm7JWN` on 2026-08-16, so the build is now execution rather than judgement.

**Why this is still not built.** Not a VIP problem and not a decision waiting on anyone. The GHL workflow builder renders inside a cross-origin iframe (`client-app-automation-workflows.leadconnectorhq.com`) that does not accept synthetic clicks, and it will not run as a top-level document because it needs the parent frame's auth handshake. The legacy `/location/<id>/workflows` path redirects back to the same iframe. So this stays a human-hands job in the browser. The API cannot substitute: `workflows` is read-only (`workflows.readonly`, `GET /workflows/` only) and there is no create-workflow operation, which confirms the original note on this sheet.

**Do not build it as email templates instead.** Checked and rejected: `create-email-template` does exist and is writable, but both VIP and KST hold **zero** email templates, so the house pattern is emails authored inline in the workflow's email action. Templates would diverge from the pattern and would not save the typing.

### Trigger

**Opportunity Created**, filtered to pipeline `KST Leads` (see the rename below), stage **New Enquiry**.

This is the honest reading of "enquiry created with no consultation booked". It also inherits deduplication that already exists upstream: `RCV_vip_ctm_leads` creates an opportunity card only for a **new** contact, so repeat callers do not re-enter the sequence. A Contact Created trigger would not have that property and would sweep in manual imports.

### Pipeline and stage ids, read live

Pipeline `KST Leads` = `0R3fryVBUk2liqLbiC3w`

| Stage | Id |
|---|---|
| New Enquiry | `0b037ac3-9bb2-4181-975c-cf43f690fae8` |
| Qualified | `1dcea4bd-ea29-4126-ae4e-6e309f30508d` |
| Consultation Booked | `b05310e8-cfe5-438c-a48a-8990458ad6a7` |
| Consultation Held | `7e199c0e-8507-4a3d-8abc-a0d9a969405d` |
| Quote Sent | `883b7f90-d48b-4cf1-81b0-579a0156a1fb` |
| Engaged (Won) | `274ee1b3-41a4-42db-ad82-fbe6addf1db5` |
| Lost | `af865c67-8267-427e-90e5-08b973745b1a` |
| Nurture | `880206bf-7f73-481b-af18-86d9d6e44ef4` |

### Exits, mapped to the four named on this sheet

| Sheet wording | How it is built |
|---|---|
| consultation booked | Goal / remove from workflow on opportunity stage becoming **Consultation Booked** |
| reply received | Workflow Settings, **Stop on Response** enabled for Email |
| client tag applied | Remove from workflow on tag added, tag to be confirmed with Kyle (no `client` tag exists in the location yet) |
| unsubscribe | Native. GHL honours DND and unsubscribe without a step |

### Workflow settings

- Name: `VIP nurture: enquiry, no consultation booked`
- **Status: DRAFT. Do not publish.** Two independent gates are still open, Kyle's review and the sending domain.
- Allow re-entry: **off**
- Stop on response: **on**
- Send window: weekdays 08:00 to 17:00, timezone **Europe/London** (account timezone, not contact timezone)
- Waits: immediate, day 2, day 4, day 7, day 11, day 15, exactly as written above
- From: Kyle Randall, kylerandall@vipaccounting.co.uk

### Two things to fix in the same sitting, both blueprint-clone leftovers

Both are KST strings that survived the "Accountancy Blueprint v1" clone. The onboarding runbook §3 predicted exactly this failure mode and the rewire was not completed.

1. **Rename the pipeline.** It is called **`KST Leads`** in VIP's own account. Kyle sees that name every time he opens his Opportunities board. Rename to `VIP Leads`; stage names and ids are unaffected.
2. **The web chat agent's emergency phone number is KST's**, `020 3150 2074`, byte-identical across both tenants. That one is not a cosmetic fix and it blocks the chat go-live, not this build. It needs Kyle's real office number, which has been outstanding since the onboarding doc's §5.

# VIP nurture: the six emails, ready to build

**2026-08-14.** The blockers cleared this morning: Kyle sent the Calendly link and his fee numbers. This replaces the shorthand in `~/Documents/VIP_NURTURE_SEQUENCE.md` with the actual text.

**Build it in the GHL UI.** Workflow creation has no API, so this is a founder job. Everything below is copy-paste.

## Workflow settings

**Trigger:** enquiry created with no consultation booked.
**Waits:** immediate, day 2, day 4, day 7, day 11, day 15.
**Send window:** weekdays 08:00 to 17:00 UK.
**From:** Kyle Randall, kylerandall@vipaccounting.co.uk.
**Exit on any of:** consultation booked, reply received, client tag applied, unsubscribe.

**Booking link, used in emails 1 to 5:** `https://calendly.com/kylerandall/30min`

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
> Pick a time here: https://calendly.com/kylerandall/30min
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
> If that is the only thing that has been stopping you, it is worth a short call: https://calendly.com/kylerandall/30min
>
> Kyle

## Email 3, day 4. Making Tax Digital

**BEFORE SENDING: Kyle confirms the current thresholds and quarterly dates himself.** He is the accountant, so there is no external sign-off loop, but nothing here should be invented. The bracketed lines are his to fill.

**Subject:** Making Tax Digital, and where you stand

> Hi {{contact.first_name}},
>
> Most business owners I speak to fall into one of three groups on Making Tax Digital.
>
> The first do not know whether it applies to them yet. The second know it does and have not got set up. The third are set up but are not confident the numbers going in are right, which is arguably the worst of the three, because it looks handled.
>
> [Kyle: the current threshold and who it applies to from when.]
>
> [Kyle: the quarterly submission dates.]
>
> None of that is difficult once someone has taken it off your desk. It is only a problem when it arrives as a surprise.
>
> If you are not certain which group you are in, that is exactly what a short call is for: https://calendly.com/kylerandall/30min
>
> Kyle

## Email 4, day 7. Objection: cost

**This is the one that was blocked, and the numbers are now his own.**

**A note on the £80.** I advised keeping the £80 starting price out of the *ads*, because at roughly £16 a click it attracts the price-shopping micro-business Kyle said he does not want. **This is the opposite situation.** A one-to-one email to someone who already enquired, on the subject of cost, has to answer the question with a real number or it reads evasively. Different context, different answer.

**The tidy-up fee stays vague on purpose**, per Kyle's ruling that it should not be public. Saying it is quoted before any work starts is both truthful and better selling than a range.

**Subject:** What we charge

> Hi {{contact.first_name}},
>
> You are probably wondering about cost, so let me answer it plainly rather than make you ask.
>
> Limited company packages start at £80 a month. Most clients land somewhere between £100 and £200 a month, depending on the size of the business, how many transactions there are, and how much you want me to take off your hands.
>
> Whatever we agree is covered by that one monthly fee. You do not get charged every time you need something, and you are not billed for asking me a question.
>
> If your bookkeeping has fallen behind or there are filings outstanding, there is sometimes a one-off piece of work to bring things up to date. I would look at what is actually involved and agree the cost with you before starting anything.
>
> The call is free and you would get a proper figure at the end of it: https://calendly.com/kylerandall/30min
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
> I am happy to look and tell you honestly if everything is already in good shape: https://calendly.com/kylerandall/30min
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

**1. Sending domain, and it needs somebody else.** `mail.vipaccounting.co.uk` needs the six-record set. DNS is at **SiteGround** (`ns1/ns2.siteground.net`, SOA agrees, so no orphan-zone trap here, unlike webmarketinginternational.com). Existing setup read 2026-08-14: mail runs on Microsoft 365, apex SPF includes `secureserver.net`, DMARC is present at `p=none`, and no `mail.` or `send.` subdomain exists yet.

**Do not let this block the build.** Build the workflow first and leave it off. The DNS is a parallel task and it depends on whoever holds the SiteGround login, which is a question for Kyle.

**2. Test send to Gmail** and check SPF, DKIM and DMARC alignment before enabling.

**3. Warm up.** New enquiries only. No backfill into the sequence.

**4. One deliberate omission.** Email 3 does not state any MTD threshold or date. Kyle fills those in himself. Inventing a tax date in an email a client sends under his own name is the single worst thing this sequence could do.

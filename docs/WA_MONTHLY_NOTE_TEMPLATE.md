# Monthly attribution note: template and how to produce it

**Why this exists.** The WhatsApp bridge runs silently and costs the client nothing. Silent free work retains nobody, because nobody misses what they never noticed. This note is what makes the loop visible, and it takes minutes once the data exists.

**Cadence:** monthly, first working week, for every bridge client.
**Voice:** written as Anthony, first person singular. No em dashes. Governed by the claims register: no accuracy percentage, no invisible-tracking language, volume caveat where relevant.
**Length:** one screen. If it needs scrolling, it is a report, and a report gets ignored.

---

## The template

> **[Client] enquiry sources, [Month]**
>
> **[N] WhatsApp enquiries** came through your website this month. Here is where they came from.
>
> | Campaign | Enquiries | Bookings | Value |
> |---|---|---|---|
> | [campaign] | [n] | [n] | [currency + amount] |
> | [campaign] | [n] | [n] | [currency + amount] |
> | Source unknown | [n] | [n] | [currency + amount] |
>
> **What stands out:** [one or two sentences of actual observation. The point of the note is this line, not the table. Something like: the Agafay sunset campaign produced fewer enquiries than the general one but twice the bookings, so the money is better spent there.]
>
> **[N] enquiries are marked source unknown.** That happens when several people click within the same short window and I will not guess between them. [If the proportion is climbing, say so and say what you propose to do about it.]
>
> **What I would change next month:** [one recommendation, or say plainly that nothing needs changing, which is also a finding.]
>
> Anthony

---

## Producing it

The data lives in two places, both queryable without asking the client for anything.

**Enquiry counts and attribution method**, from the substrate:

```sql
select
  coalesce(attribution->>'utm_campaign', attribution->>'gclid', 'source unknown') as source,
  count(*) as enquiries,
  count(*) filter (where claimed_at is not null) as matched
from wa_refs
where client_slug = :slug
  and created_at >= date_trunc('month', now()) - interval '1 month'
  and created_at <  date_trunc('month', now())
group by 1
order by enquiries desc;
```

**Bookings and value**, from the client's CRM pipeline: deals marked won in the period, with the stored click id and amount on each. Join those to the campaign by click id.

**Two things to check before sending**, both of which have bitten us:

1. **Does the total match what the client thinks they received?** If they believe they had forty enquiries and the note says twelve, the widget is missing traffic, or people are messaging the old number directly. Find out which before the client does.
2. **Is the source-unknown share growing?** A rising share means concurrency is outpacing the matching window. That is the signal to shorten the window for this client, which is a per-client tunable and exactly the kind of adjustment worth mentioning in the note, because it demonstrates the thing is being attended to.

## What not to put in it

- No accuracy percentage, per the claims register.
- No graphs for the sake of graphs. A table and a sentence beat a dashboard nobody opens.
- No mention of the plumbing, the widget, the receiver or any tool. The client is buying the finding, not the mechanism.
- Nothing that hints the service is free for retention reasons.

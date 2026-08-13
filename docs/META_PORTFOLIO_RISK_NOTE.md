# Meta portfolio concentration: the risk is not the one we wrote down

**Risk brief 1.5 of 2026-08-05, item 1.1. Written 2026-08-12 from a live read, not from the register.** Read-only throughout, per the standing Meta ruling.

## The premise in the brief is wrong, and the correction is good news

The brief opens: *"Every Meta client sits inside one business portfolio that is already at its limit... An integrity action takes Atelier Brunos, DentalMastery, Steffen and Monde du Tabouret out on the same day."*

**That is not the structure.** Every client ad account is owned by the client's own business portfolio:

| Ad account | Owning portfolio | Currency | Lifetime spend |
|---|---|---|---|
| Luca Summer `1801857321221826` | **Atelier Brunos** `3177356222447354` | USD | 204,436 |
| Mondedutabouret `27875735492115545` | **monde_du_tabouret** `908995597197130` | EUR | 0 |
| Steffen Foerster Photography `1766396370547849` | **Steffen Foerster** `356583285809064` | USD | 1,853,323 |
| instawarm.shop `799323799456382` | **instawarm.shop** `979637211264887` | USD | 18,139 |
| FR `1304153623765783` | **Vasco Electronics** | PLN | 83,700,400 |
| Tropical Oasis `575423175548816` | **Ace Nutrition** | USD | 15,079,188 |
| WMI UK `1027063116856202` | **WMI** (ours) | GBP | 18,593 |

Seven accounts, seven distinct owning portfolios. Only one of them is ours.

Every account reports `disable_reason: 0` and `account_status: 1`. Nothing is restricted today.

## So what is actually single-pointed

Not the clients' assets. **Our access path.**

One **system user** (actor `122109390501393831`) inside our business, holding one **non-expiring token**, issued by one app (`1023714696912738`), carrying `ads_management`, `ads_read`, `business_management`, `pages_manage_ads` and `catalog_management` across all seven accounts.

That single credential is what every automated read and every governed write travels through.

## What that means for the two scenarios

**An integrity action against our business.** We lose access. **Clients keep everything**: their accounts, pixels, campaigns, creative, audiences, conversion history and spend record all sit in portfolios they own. Recovery is re-establishing partner access, which is a conversation with each client, not a rebuild. Painful and embarrassing; not existential.

**The token is revoked, expires, or the app is restricted.** Every automated path stops simultaneously: Bernard's reads, the governed executor, the audit generation, the reporting. No client asset is harmed and nothing is lost, but we go blind and manual across all seven accounts at once, with no staged failure and no partial degradation.

**The second scenario is the real one**, and it is an availability risk rather than an asset-loss risk. That is a much cheaper problem than the brief assumed, and it wants a different mitigation.

## Would we find out promptly, or from a client?

**From a client, or from a failed run.** Nothing watches for it. There is no health check on the token, no alert on a 190/200-class permission error, and no daily probe that would distinguish "no changes to report" from "we have lost access". The `MAINT_kb_ingest` failure ran for four days before anyone noticed, and that had an error status on every run; a silent access loss has less signal than that.

**Cheapest real answer: a daily read-only probe** that lists the seven accounts and alerts on any that disappear, change status, or return a permission error. Perhaps twenty lines, and it converts "we find out from a client" into "we find out in under a day".

## Two things the read surfaced that were not being asked about

**We hold write-capable access to two accounts nobody has mentioned.** Vasco Electronics (PLN 83.7m lifetime) and Ace Nutrition (USD 15.1m lifetime) appear in no client record, no runbook and no register row. Either they are legacy access from an earlier engagement, or they are clients this session does not know about. **Holding `ads_management` on accounts we do not serve is pure exposure with no upside**, and it is also part of the behavioural surface that Meta scores. Worth resolving either way.

**No client portfolio reports a verification status.** The field came back empty on every one. That may mean unverified, or it may mean the field is not visible to a partner system user. I am not going to claim it means anything until it is checked in Business Manager, because a single API reading is exactly what the standing rule says not to build a claim on.

## Mitigations, cheapest first

**1. A daily access probe with an alert.** Highest value per hour of work by a wide margin. Closes the detection gap completely.

**2. Automation hygiene as a standing rule.** The behavioural signature in the brief is real and worth keeping down: the six failed dispatch rounds and the verification resend storm both happened. A write ceiling per portfolio per day, no verification retries after the first failure, and a mandatory cool-down after any integrity signal. Cheap, and it is doctrine rather than code.

**3. Resolve the two unexplained accounts.** Confirm or revoke.

**4. A second system user as a warm spare.** A separate credential in the same business does not survive an action against the business, so it only covers token-level failure, not portfolio-level. Worth doing only because token-level failure is the likelier scenario, and it is cheap.

**5. Client-owned portfolios: already true, and worth saying out loud.** The brief proposes this as the strongest structural answer. **It is already how everything is arranged.** That is worth knowing for its own sake, and it is a good client story: their assets are theirs, and if we part company they lose nothing but our labour. It is the same argument as the WhatsApp bridge ownership position, and the two should be told together.

## What needs confirming before any of this is acted on

The whole note rests on one read by one system user. Before it becomes canon, someone with human access should confirm in Business Manager: that our business holds partner access rather than ownership of those client portfolios, what the actual verification status of each is, and what Vasco Electronics and Ace Nutrition are doing on our token.

**Not implemented. This is the note plus options the brief asked for; the founder rules.**

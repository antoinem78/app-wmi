# Call tracking: existing number map (task 18)

**Date:** 2026-07-31. **Why this exists:** before any Twilio number is bought or any GHL call tracking is configured, know every number already in play, what it does, and which ones a tracking layer would swap. Buying tracking numbers on top of an unmapped estate is how a business ends up forwarding a forwarder.

**Method:** GHL location records via API (three locations), live fetch of every public site with `tel:` extraction, the KST site repo, and the substrate client configs. All read-only.

---

## The map

| Entity | Number | Where it lives | What it is |
|---|---|---|---|
| KST | +44 20 3150 2074 | site header + contact, `tel:` links, GHL location record, repo `lib/site.ts` | The practice landline. Consistent everywhere. |
| KST | +44 7768 985064 | contact page only, `tel:` link, repo `lib/site.ts` (mobile) | Kris's mobile. |
| DentalMastery.ai | +48 536 401 824 | GHL location record only | Polish mobile (Seb's, presumably). **Not customer-facing anywhere**: the funnel has no phone at all, by design. |
| Shallowford Smiles | +1 423 500 6728 | site, `tel:` link | Unknown which of these is the real practice line. |
| Shallowford Smiles | +1 423 531 5000 | site, second `tel:` link (template-bracketed `%5B...%5D`, an artifact worth fixing) | Unknown. |
| Shallowford Smiles | +1 423 364 4134 | GHL location record only | A third number, on neither page. |
| Monde du Tabouret | +33 805 22 06 95 | site, `tel:` link | French toll-free (numéro vert), their service line. |
| wmiltd.com | none | no `tel:` anywhere | The UK agency site publishes no phone number. |
| webmarketinginternational.com | none | no `tel:` anywhere | Same for the FZCO site. |

## The finding that matters: Shallowford already has a tracking layer, probably

Three distinct numbers in the 423 area code for one dental practice, two on the page simultaneously and a third held by GHL, is the classic footprint of an existing call-tracking or forwarding setup, likely from whoever ran their ads before. **Which number is the real front desk and which are forwarders is not determinable from here.** Getting this wrong in a future tracking build means stacking a forwarder on a forwarder, or worse, porting away a number patients have saved.

To resolve, one of: ask the practice which number their front desk actually answers; or check the GHL location's Settings, Phone Numbers page, which shows anything provisioned through LC Phone; or dial each and listen to where it lands. The bracketed `tel:%5B4235315000%5D` is a broken template variable on their site regardless, and worth fixing whoever owns it.

## Gaps, stated plainly

1. **GHL provisioned-number inventory is unreadable via API.** `phone-system/numbers` returns 401 on all three location tokens; the scope is not grantable on the Private Integration settings we hold. So whether any location already owns an LC Phone number (the Shallowford third number is a candidate) needs a founder look at Settings, Phone Numbers, in each location UI. Sixty seconds per location.
2. **Google Business Profile numbers are not covered.** KST and Shallowford both likely have GBP listings whose number field is independent of the site, and a mismatch there splits tracking. No API access from here.
3. **Legacy WMI Twilio or CallRail accounts:** no credentials on this machine and no reference in the substrate, so if an old account exists holding numbers, it is invisible to this audit. The founder would know.

## What the Twilio build inherits from this

- **KST is clean.** One landline everywhere plus a mobile on one page, no existing tracking layer. A tracking number for KST swaps the header/`tel:` number (repo `lib/site.ts`, one edit, both numbers live there) and forwards to +44 20 3150 2074. GBP needs checking first (gap 2).
- **DentalMastery needs no call tracking.** The funnel deliberately has no phone. If one is ever added, it starts tracked from day one, which is the easy case.
- **Shallowford must not be touched** until the three-number question is answered by a human.
- **The WMI agency number** (the founder's own UK line from Dubai) is greenfield: nothing published anywhere, so nothing to swap and no forwarding legacy. Simplest possible start.

**Task 18 is complete as scoped: the map exists and the unknowns are named.** The three founder-side checks (GHL phone pages, GBP listings, any legacy CallRail/Twilio account) are the only inputs still missing, and none of them blocks the WMI agency number purchase.

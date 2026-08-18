---
name: verify-who-controls-infrastructure
description: "Before drafting any client-facing request about infrastructure, verify who actually controls it and ask the founder about his own access first"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: e62c54fd-f7d4-4840-a05c-5fa8a6ecc004
  modified: 2026-07-30T07:59:40.480Z
---

On 2026-07-30 I drafted a request for five DNS records addressed to HDUK, purely because Richard at HDUK was the party in the email thread. HDUK does not manage kst-accountants.co.uk DNS. **IONOS does, and the founder had the logins all along** — the same access used to point the site at Vercel (`www.kst-accountants.co.uk` → `vercel-dns-017.com`). Worse, after HDUK bounced it, I wrote a message to the client speculating the IONOS login might be lost with a previous provider. Speculating about the founder's own access, in client-facing comms.

Aggravating detail: on 17 July I had already run a DNS lookup on that exact domain and recorded its SPF and DMARC. I never queried NS. One extra line would have shown IONOS thirteen days earlier.

**Why:** the founder sends these messages under his own name. Addressing the wrong provider, and then implying nobody knows where the credentials are, damaged his credibility with both the client and the client's supplier. His words: "a waste of time and a damage to my credibility and reputation."

**How to apply:**
1. **Check control before drafting.** `dig +short NS <domain>` and `dig SOA` before any DNS request goes to anyone. Same principle for hosting, mail, CRM, analytics: identify the controlling party from the system itself, never from who happens to be in an email thread.
2. **Ask the founder about his own access before speculating about it.** Never write "who has the login" or "it may be lost with a previous provider" into a client-facing message. Ask him first; he very often has it.
3. **When a lookup is run, capture ownership too, not just the record being chased.** SPF/DMARC answered "is it configured"; NS answers "who can configure it". Pull both.

**2026-08-14, a second and sharper form of the same mistake: an orphan zone.** Twilio domain verification for `webmarketinginternational.com` failed once because the TXT record was added at Bluehost. **Bluehost still holds a zone file for that domain and answers authoritatively when queried directly, so its panel accepts the record and shows it saved.** But the delegation points at Cloudflare, so the record is invisible to the world. Failing in a way that looks like succeeding is worse than failing loudly.

The estate is split and the split is not intuitive, because the *website* is on Bluehost (162.241.230.55) while *DNS* is on Cloudflare:

| Domain | DNS served by | Note |
|---|---|---|
| webmarketinginternational.com | **Cloudflare** | Bluehost holds a stale orphan zone that silently accepts edits |
| wmiltd.com | Bluehost | |
| singularweb.ai | Bluehost | |

**Extra step this adds:** `dig +short NS` is not sufficient on its own when a former provider may still hold a zone. Confirm with `dig +short SOA <domain>` against a public resolver, and prove the record afterwards from **outside**, never from the provider's own panel:

```
dig +short TXT _twilio.<domain> @1.1.1.1
```

The Resend records on the same domain were done correctly in Cloudflare earlier, so the tell was available: query a record that already works and see which provider is actually serving it.

Related: [[kst-client-domain-lesson]], [[client-document-voice]], [[meta-api-absence-claims]].

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Read the project state before you start

**`docs/PROJECT_STATE.md` is the first thing to read in a new session.** It carries what the code and git history do not: what is live versus staged, what is blocked and on whom, and the founder's standing rulings. Many sessions run in parallel on this repo, so it is also how they avoid contradicting each other.

**Work is segmented by client, one session per client (2026-08-15).** Each client or project has a channel file at `docs/clients/<slug>.md` which holds its living state. The session working that client OWNS that file; two sessions never edit the same one. Slugs are hyphenated and match the substrate `clients.slug` wherever a row exists.

**Reading order for a client session:** `PROJECT_STATE` §1 (entities), §2 (standing rulings), §7 (working notes and the cross-session convention), then your own channel file. That is all of it. Do not read the whole monolith; the point of the split is that you no longer have to.

**`docs/SINGULARWEB_PROJECT_STATE.md` is the strategic state, shared with the founder's strategy surface (Chat), and the repo copy is the master (founder-ruled 2026-09-03).** Read its §0 changelog and §4 rulings ledger at the start of a session. It records what PROJECT_STATE does not: the rulings ledger, the entity map, the client book, product-line status, the agents' state, and open items by owner. **Every session updates it in the same commit as the change it records**, when one of these happens: the founder rules on something, a client is won, lost, repriced or changes shape, a product line changes status, an agent capability lands, or an open item closes. The update is two edits: the section line, and a dated line at the top of §0 (`- YYYY-MM-DD · what changed`). Client detail stays in the channel file; this file carries the one-line consequence. When the two disagree, the channel file wins on the client and this file wins on the ruling, and whoever notices fixes both. The founder refreshes the panel copy from the repo; nobody edits the panel copy directly.

**Where things go when you learn them.** Client-specific facts go in that client's channel file. Anything that generalises across clients goes to the shared memory directory, never into a channel file, because memory is the only layer every session sees automatically. That discipline is the entire cost of segmenting by client: isolation hides patterns unless someone deliberately lifts them out. **Check `MEMORY.md` before filing a lesson**, in case a sibling session already wrote it.

Update your files when something lands, gets blocked, or the founder rules on something. If something is stale, fix it rather than working around it.

Two rulings from §2 that catch people out immediately, so they are repeated here: **all Meta API access is read-only, no exceptions**, and **client-facing writing carries no em dashes and never mentions APIs or tooling**.

# Founder rulings that bind every session, on any machine

**No em dashes, anywhere, in anything you write.** Chat, documents, code comments, headings. Use full stops, commas, colons or parentheses. En dashes only inside numeric ranges (45-54, £120-155). Check headings before delivering; that is where they survive a prose pass.

**Client-facing writing is authored as Anthony**, first person, in his voice. Never mention APIs, tooling, endpoints, agents or how data was obtained. The client is buying his expertise, not a generated report. **First person means singular: I, me, my. Never the agency "we/us/our"**, even where it feels natural ("we cut the videos"). Ruled 2026-08-03; applies to freelancer-facing writing too. Sweep drafts for "we" before delivering.

**Never assert something is absent from a single API reading.** Check the surface a real user sees before any "there is no X" claim. A permission error on a nearby endpoint disqualifies the whole area from absence claims.

**Verify who controls a system before drafting anything addressed to anyone about it.** `dig NS` **and** `dig SOA` before any DNS request, because a former provider can still hold a zone that accepts edits invisibly (Bluehost does exactly this for webmarketinginternational.com, whose real DNS is Cloudflare). Prove a record from outside afterwards, never from the provider's own panel. And never speculate in client-facing writing about the founder's own access. Ask him.

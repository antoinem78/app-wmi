<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Read the project state before you start

**`docs/PROJECT_STATE.md` is the first thing to read in a new session.** It carries what the code and git history do not: what is live versus staged, what is blocked and on whom, the founder's standing rulings, and where each client stands. Sessions run in parallel on this repo (one on lead generation, one on ecommerce), so it is also how they avoid contradicting each other.

Read §1 (entities) and §2 (standing rulings) always. Then read your own track. Update the file when something lands, gets blocked, or the founder rules on something. If it is stale, fix it rather than working around it.

Two rulings from §2 that catch people out immediately, so they are repeated here: **all Meta API access is read-only, no exceptions**, and **client-facing writing carries no em dashes and never mentions APIs or tooling**.

# Founder rulings that bind every session, on any machine

**No em dashes, anywhere, in anything you write.** Chat, documents, code comments, headings. Use full stops, commas, colons or parentheses. En dashes only inside numeric ranges (45-54, £120-155). Check headings before delivering; that is where they survive a prose pass.

**Client-facing writing is authored as Anthony**, first person, in his voice. Never mention APIs, tooling, endpoints, agents or how data was obtained. The client is buying his expertise, not a generated report. **First person means singular: I, me, my. Never the agency "we/us/our"**, even where it feels natural ("we cut the videos"). Ruled 2026-08-03; applies to freelancer-facing writing too. Sweep drafts for "we" before delivering.

**Never assert something is absent from a single API reading.** Check the surface a real user sees before any "there is no X" claim. A permission error on a nearby endpoint disqualifies the whole area from absence claims.

**Verify who controls a system before drafting anything addressed to anyone about it** (dig NS before any DNS request), and never speculate in client-facing writing about the founder's own access. Ask him.

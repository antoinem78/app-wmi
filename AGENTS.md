<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Read the project state before you start

**`docs/PROJECT_STATE.md` is the first thing to read in a new session.** It carries what the code and git history do not: what is live versus staged, what is blocked and on whom, the founder's standing rulings, and where each client stands. Sessions run in parallel on this repo (one on lead generation, one on ecommerce), so it is also how they avoid contradicting each other.

Read §1 (entities) and §2 (standing rulings) always. Then read your own track. Update the file when something lands, gets blocked, or the founder rules on something. If it is stale, fix it rather than working around it.

Two rulings from §2 that catch people out immediately, so they are repeated here: **all Meta API access is read-only, no exceptions**, and **client-facing writing carries no em dashes and never mentions APIs or tooling**.

---
name: agent-relay-truncates-long-turns
description: The Bernard/Oscar relay silently truncates long agent replies and can drop the whole turn without persisting it; always capture the reply to a file and verify it ends cleanly
metadata: 
  node_type: memory
  type: project
  originSessionId: 8cc72274-4b6a-4ba4-88a0-67fb40f0f19f
  modified: 2026-08-17T08:00:05.571Z
---

Observed 2026-08-16 on the Steffen Foerster launch review, twice in one session, on both agents. A long brief (roughly 6KB) sent via `scripts/agent-relay.mjs` produced two distinct failures:

- **Bernard: the reply came back cut mid-word AND the turn never persisted.** He ran the full live audit and answered, but on the next message he had no record of the brief or of his own reply, and it was absent from `--history` at any depth. Re-sending the identical brief worked and came back complete.
- **Oscar: the turn persisted but the stored reply was itself truncated** at exactly the point the live output stopped, so the loss is server-side, not in the shell pipe. He answered the missing part fine when asked to continue, because his thread still held the question.

**Why:** the cut lands mid-sentence with no error, so it reads as a complete answer if you are not watching for it. Bernard's version is worse than losing text: the agent's memory never records the exchange, so the knowledge the relay exists to deposit is silently lost, and a later session finds nothing.

**How to apply:**

- Redirect the reply to a file (`> reply.txt 2>&1`) rather than piping through `tail`, then read the whole thing and **check it ends on a finished sentence**. A `tail -N` will hide the problem and looks identical to success.
- If it is cut, do not ask the agent to "resend from where you stopped" without first checking `--history` whether the turn persisted. If it did not, the agent has no idea what you mean and will correctly refuse to reconstruct it; re-send the original brief instead.
- Asking for a tight, findings-first reply reduces the chance of the cut on a long analytical answer.
- Assume nothing landed in the agent's memory until a subsequent turn shows it did. Same instinct as [[validate-backups-by-reading-executions]]: the surface looked healthy while the thing it existed to do had not happened.

Relevant because the relay is the only route platform work is allowed to take (see [[check-access-before-requesting-it]]), so a silent drop there loses the knowledge with no other copy.

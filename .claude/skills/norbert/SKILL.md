---
name: norbert
description: Speak to Norbert (the supervising agent) from this Code session. One shared thread with the portal chat at /norbert; whatever is said here is visible there and vice versa.
---

# Talking to Norbert from a Code session

Norbert is the deployed supervisor agent, the front door of the agent
operation: work is discussed with him before Oscar and Bernard are briefed
and dispatched. He is NOT you and you must not impersonate him. This skill
relays the founder's words to the real Norbert (same brain, memory and gates
as the portal) and brings his reply back.

## How

Send the founder's message to Norbert verbatim, do not paraphrase it:

```bash
node scripts/agent-relay.mjs norbert "the founder's message, exactly as given"
```

To catch up on what has been said recently (either surface):

```bash
node scripts/agent-relay.mjs norbert --history 12
```

To hand him a file (PDF, Word, Markdown, text or CSV), the same as the
paperclip in the portal chat. Repeat `--attach` for several files:

```bash
node scripts/agent-relay.mjs norbert --attach brief.md "read this and shape the brief"
```

Do not confuse `--attach` with `--file`. `--file` supplies the message text;
`--attach` gives Norbert the document itself.

Auth comes from `NORBERT_RELAY_KEY` in `.env.local`; the script finds it
itself. Target defaults to the production portal.

## Rules

- Print Norbert's reply clearly attributed to Norbert, verbatim. Your own
  commentary, if any, goes after and is clearly yours.
- Stderr lines like `[norbert is working: ...]` are tool progress, not answer.
- Norbert holds no approval authority. If the founder wants to approve or
  apply something, that happens in Oscar's or Bernard's own surface (their
  chat or page), and Norbert will say so; do not try to route approvals
  through this relay.
- A `brief_oscar` or `brief_bernard` dispatch inside Norbert's turn runs the
  target agent's full loop, so a reply can take a few minutes. Be patient
  rather than resending.
- The thread is shared with the portal. Do not send test noise, do not clear
  it (clearing is portal-only by design), and do not send anything the founder
  did not say or clearly ask for.
- If the relay returns 401, `NORBERT_RELAY_KEY` is missing locally or not yet
  set in Vercel; say so rather than retrying.

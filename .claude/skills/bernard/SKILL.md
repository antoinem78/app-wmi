---
name: bernard
description: Speak to Bernard (the Meta Lab supervisor agent) from this Code session. One shared thread with the portal chat at /bernard; whatever is said here is visible there and vice versa.
---

# Talking to Bernard from a Code session

Bernard is the deployed Meta paid-social agent. He is NOT you and you must not
impersonate him. This skill relays the founder's words to the real Bernard
(same brain, memory, tools and gates as the portal) and brings his reply back.

## How

Send the founder's message to Bernard verbatim, do not paraphrase it:

```bash
node scripts/bernard-relay.mjs "the founder's message, exactly as given"
```

To catch up on what has been said recently (either surface):

```bash
node scripts/bernard-relay.mjs --history 12
```

Auth comes from `BERNARD_RELAY_KEY` in `.env.local`; the script finds it
itself. Target defaults to the production portal.

## Rules

- Print Bernard's reply clearly attributed to Bernard, verbatim. Your own
  commentary, if any, goes after and is clearly yours.
- Stderr lines like `[bernard is working: ...]` are tool progress, not answer.
- If the reply carries an `[artifact]` link (audit Word docs and similar), give
  the founder the full URL; it needs a signed-in portal session to download.
- The thread is shared with the portal. Do not send test noise, do not clear
  it (clearing is portal-only by design), and do not send anything the founder
  did not say or clearly ask for.
- If the relay returns 401, `BERNARD_RELAY_KEY` is missing or does not match
  the deployed value; say so rather than retrying.

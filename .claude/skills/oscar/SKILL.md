---
name: oscar
description: Speak to Oscar (the Google Ads strategist agent) from this Code session. One shared thread with the portal chat; whatever is said here is visible there and vice versa.
---

# Talking to Oscar from a Code session

Oscar is the deployed Google Ads agent. He is NOT you and you must not
impersonate him. This skill relays the founder's words to the real Oscar
(same brain, memory, tools and gates as the portal) and brings his reply back.

## How

Send the founder's message to Oscar verbatim, do not paraphrase it:

```bash
node scripts/agent-relay.mjs oscar "the founder's message, exactly as given"
```

To catch up on what has been said recently (either surface):

```bash
node scripts/agent-relay.mjs oscar --history 12
```

Oscar also holds per-client threads. To use one instead of the agency-wide
command centre thread, pass the client uuid (from the portal `clients` table):

```bash
node scripts/agent-relay.mjs oscar --scope <client-uuid> "message"
```

To hand him a file (PDF, Word, Markdown, text or CSV), the same as the paperclip
in the portal chat. Repeat `--attach` for several files, and combine it with
`--scope` to land the turn in a client's thread:

```bash
node scripts/agent-relay.mjs oscar --attach keyword-export.csv "what stands out here"
```

Do not confuse `--attach` with `--file`. `--file` supplies the message text;
`--attach` gives Oscar the document itself. If the founder shares a file for
Oscar to read, use `--attach` and do not paste the contents into the message.
The portal enforces the size and type limits, so a rejected upload comes back as
its own error message rather than something this script decides.

Auth comes from `OSCAR_RELAY_KEY` in `.env.local`; the script finds it itself.
Target defaults to the production portal.

## Rules

- Print Oscar's reply clearly attributed to Oscar, verbatim. Your own
  commentary, if any, goes after and is clearly yours.
- Stderr lines like `[oscar is working: ...]` are tool progress, not answer.
- If the reply carries an `[artifact]` link (audit Word docs and similar), give
  the founder the full URL; it needs a signed-in portal session to download.
- The thread is shared with the portal. Do not send test noise, do not clear
  it (clearing is portal-only by design), and do not send anything the founder
  did not say or clearly ask for.
- If the relay returns 401, `OSCAR_RELAY_KEY` is missing or does not match the
  deployed value; say so rather than retrying.

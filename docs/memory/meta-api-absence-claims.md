---
name: meta-api-absence-claims
description: Never build a client-facing finding on a single Meta API field asserting absence — verify against the public surface first
metadata: 
  node_type: memory
  type: feedback
  originSessionId: e62c54fd-f7d4-4840-a05c-5fa8a6ecc004
  modified: 2026-07-30T07:33:26.979Z
---

On 2026-07-30 the Luca Summer / Atelier Brunos audit led with "the Instagram account has zero posts", sourced from `media_count: 0` on the IG Business Account node. **It was wrong** — the public profile at instagram.com/atelierbrunos showed a populated grid of product videos (client said 15 posts). The field is unreliable for that account (likely Reels-format content), even though the same field returned a correct 864 for another IG account under the same token. The `/media` edge errors with `(#10) Application does not have permission` for *all* accounts on this token, so there was no working cross-check via the API alone.

**Why:** an absence claim ("there are no X") is far more damaging when wrong than a presence claim, because it reads as an accusation of neglect. It went into a client-facing Word doc as finding #1, with a whole section built on it, and the client caught it. The founder's words: "this is a bad look."

**How to apply — this is a hard gate, not a preference.** Before asserting in ANY client-facing output that something is missing, empty, zero, or absent:

1. **Verify against the surface a real user sees.** WebFetch the public profile, page, or site. If a customer could look at it, look at it.
2. **Treat a permission error on a related edge as a red flag on the whole area.** Here, `/media` returned "does not have permission" and I noted it and moved on. That error was the warning.
3. **A control test proving a field CAN work is not proof it IS working.** `media_count` returned 864 for another account; that only established the field is readable, not that this account's value was true.
4. **If the public surface cannot be checked, do not lead with the claim.** Downgrade it, attribute it in business terms, or leave it out.

Applies to follower counts, post counts, catalog contents, review counts, audience sizes, anything where `0` might mean "not permitted to see" or "field doesn't track this content type" rather than "does not exist". Related: [[claude-meta-read-only-ruling]], [[client-document-voice]].

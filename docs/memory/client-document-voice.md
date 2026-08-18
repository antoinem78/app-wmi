---
name: client-document-voice
description: "Client-facing documents are authored as Anthony, in first person, with no mention of APIs, tooling or how data was obtained"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: e62c54fd-f7d4-4840-a05c-5fa8a6ecc004
  modified: 2026-07-30T09:47:51.117Z
---

Every client-facing document (audits, proposals, reports) is written **as Anthony** — first person, his voice, his judgement. **Never mention the API, Meta Graph, Bernard, tooling, queries, or how the data was obtained.** No "read directly from the Meta Marketing API", no "the `/media` edge returned", no field names like `media_count`. State findings as facts a consultant would state them: "the account has spent $1,783 since May", not "the API reports spend of $1,783".

**Why:** the client is buying Anthony's expertise, not a machine-generated report. Tooling references break that frame, read as hedging, and invite the client to discount the analysis. Ruled 2026-07-30 alongside [[meta-api-absence-claims]].

**NO EM DASHES. ANYWHERE.** Not in documents, not in drafted emails, not in headings, not in chat replies to the founder. He has objected three times: 52 in an audit, then again in the nurture emails ("I beg you"). Use full stops, commas, colons, or parentheses. En dashes are acceptable ONLY in numeric ranges and date spans (45–54, $120–155). Check with `grep -c '—'` before delivering anything, including markdown headings, which is where they survive a prose pass unnoticed.

**How to apply:** write in Anthony's voice throughout, including the "I" of professional judgement ("I'd cut Canada until the US is profitable"). Where a caveat about data quality is genuinely needed, phrase it in business terms ("figures for X couldn't be confirmed and are excluded") rather than technical ones. Internal working notes and markdown scratch files are exempt from the voice rule; anything the client will read is not. The em-dash ban has no exemptions.

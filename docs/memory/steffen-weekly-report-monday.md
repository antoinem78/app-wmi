---
name: steffen-weekly-report-monday
description: "Steffen Foerster gets a weekly ads report every Monday, pasted into Slack as text; the reproducible template and its data pulls live at docs/SF_WEEKLY_REPORT_TEMPLATE.md"
metadata: 
  node_type: memory
  type: project
  originSessionId: 8cc72274-4b6a-4ba4-88a0-67fb40f0f19f
  modified: 2026-09-01T16:14:59.491Z
---

Steffen Foerster receives a combined Google and Meta report **every Monday**, covering the previous Monday to Sunday, **pasted into the client Slack channel as text rather than sent as an attachment**. He asked for a Word document once for the monthly, then specifically wanted the weekly as pasteable text, so do not default to a file.

**The full template, data pulls and standing rules are in `docs/SF_WEEKLY_REPORT_TEMPLATE.md`.** Read that before building one rather than reconstructing it. It carries the section structure, the exact campaign ids to filter on, the traps that have already cost a rebuild, and the rules the client has been told in writing.

**The three things most likely to go wrong, all of which already have:**

- **Filtering Meta breakdowns on ad set ids instead of campaign ids**, which silently returns contradictory placement figures.
- **Reporting a stale window as live.** Oscar's Google report lags about three days and Bernard's breakdown window ends yesterday, so it is offset from the reporting week. Both must state their actual window, and the report must declare any offset and the lead-count difference it causes.
- **Recommending a budget move on a delivery metric.** The client was told in writing on 2026-08-28 that decisions are made on applications and booked calls, never on impressions, CTR or CPM. That has had to be enforced three times since, including once against this session's own recommendation. See [[automated-message-never-claims-attention]] for the sibling instinct: do not let the report claim more than the data earns.

Client-specific state lives in `docs/clients/steffen-foerster.md`, which is the entry point and holds the open items that shape each week's narrative.

---
name: never-ui-automate-meta-ads-manager
description: "Driving Meta Ads Manager with any browser or GUI agent breaches Meta's ToS and risks permanent loss of the whole Business Manager; the Marketing API is the only sanctioned write path"
metadata: 
  node_type: memory
  type: project
  originSessionId: 8cc72274-4b6a-4ba4-88a0-67fb40f0f19f
  modified: 2026-08-26T15:53:39.811Z
---

Researched 2026-08-19 when the founder asked whether Manus, Cursor, ChatGPT agent, Qwen-UI-Agent or Kimi could apply Meta ad set changes through the UI under Bernard's supervision.

**Meta's terms prohibit it explicitly, logged in or not:** you may not access or collect data from Meta products by automated means without prior permission, "regardless of whether such automated access or collection is undertaken while logged-in to a Facebook account". The Marketing API with scoped OAuth (`ads_management`) is the authorised route. Browser automation of Ads Manager is not.

**The penalty is portfolio-wide and effectively unappealable.** Enforcement escalates from ad rejection to ad account restriction to Business Manager disablement to device- and payment-linked bans that follow you to new accounts. Reported cases include entire business portfolios terminated within a week with no warning, no appeal and no recovery of campaign history, pixel data or custom audiences.

**Why this is existential here specifically:** our Meta portfolio is already flagged in PROJECT_STATE as the single most concentrated risk in the operation. One Business Manager disablement takes out every Meta client simultaneously.

**Supervision does not mitigate it.** Putting a UI agent under Bernard governs *what* gets done, not *how* it is transported. Meta detects the automation signature, not the intent, so a well-governed browser agent carries the same ban exposure as a careless one.

**How to apply:**

- Never propose, build or endorse a browser or GUI agent that touches Ads Manager, whatever the vendor. This covers Manus (the previously used one), Kimi WebBridge, Qwen-UI-Agent, ChatGPT agent, Cursor's browser control and anything similar.
- When a Meta write is not currently possible, check the Marketing API first. Most gaps are in OUR code, not in Meta's surface: [[agents-chat-execution]] records that `BERNARD_optimise` only supports pause/budget/unpause, which is why targeting edits feel impossible when they are actually a supported API call.
- The same reasoning applies to Google Ads, which likewise offers an API and likewise prohibits UI automation.
- If something is genuinely UI-only, it is a human task for the founder or a contractor, exactly as PROJECT_STATE ruled when Manus was cancelled 2026-07-30. That ruling anticipated this and named the lost capability as human-tier work.

Related: [[claude-meta-read-only-ruling]], [[one-shared-key-authenticates-everything]].

---
name: silence-is-not-a-signal-without-traffic
description: "Before diagnosing a measurement layer from zero events, prove the input surface delivered anything in the window; check delivery dates first, not the mechanism"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 96f371c7-c7fa-431b-9788-76764c8f8bd7
  modified: 2026-08-16T18:03:33.725Z
---

A tracking layer producing zero events is **not** evidence about the tracking layer until you have confirmed there was something to track. Check the input surface and its delivery dates before touching the mechanism.

KST 2026-08-16: "call tracking is complete and the site swapped, but no real call in six days, is that low volume or poor number placement?" Both hypotheses were wrong. The Google Ads account had served its **last impression on 22 July** and the site swap went live on 6 August, so the whole measurement window sat inside a traffic blackout. Hours could have gone into auditing number placement on a page nobody visited.

**Why:** a null result has at least three explanations (no input, broken measurement, real absence) and they are indistinguishable from the null alone. The default instinct is to audit the newest thing that was built, which is exactly the thing least likely to be at fault and most expensive to re-verify.

**How to apply:**
- First query on any "X never fired" question is **delivery by day on the input surface**, not the mechanism. In Google Ads: `SELECT segments.date, metrics.impressions FROM customer WHERE segments.date BETWEEN ...`. Zero rows returned is the answer, and it arrives in one call.
- Then establish the **expected rate** from the account's own history before calling the silence anomalous. KST produced roughly 4 calls per month at £200 spend, so six quiet days was inside normal variance even had traffic been running.
- Confirm the null across two independent systems where possible. Twilio call logs and the GHL conversation list agreed at KST, which made the conclusion safe to state plainly.
- Name any input you genuinely cannot measure rather than assuming it. No GA4 credential existed on the machine, so organic sessions stayed unmeasured and were reported as such.
- A campaign that is ENABLED with `serving_status: SERVING`, approved ads and approved billing can still deliver **nothing**. Serving status describes eligibility, not delivery. Impression share lost to rank is what reveals it.

Sibling of [[cross-surface-relevance-check]]: that one stops a positive finding being overclaimed against the spending surface, this one stops a null finding being misread as a defect. Related: [[gbp-is-a-separate-call-surface]], [[match-windows-to-the-break]].

---
name: match-windows-to-the-break
description: "Two windows cannot tell a fall from a return to normal: plot four before comparing two, and confirm the baseline window is typical (GoPoxy, 2026-08-15 to 08-17)"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 6d861d7b-dc2d-46d3-979b-17e80c6d89de
  modified: 2026-08-16T23:41:33.959Z
---

Diagnosing a GoPoxy ROAS drop, I got the same question wrong three times in two days, each time from window choice rather than from the data.

1. A first cross-check compared 8-14 August against 1-7 August and cleared Meta as stable. Both windows sat AFTER the suspected break, so the comparison could not have detected it.
2. Corrected to matched windows either side of the break (16-30 July vs 31 July-14 August), I reported a step-down on both platforms driven by basket value. **16-30 July turned out to be an exceptional fortnight**, store AOV £105 and 4.02 units per order against ~£84 and ~3.1 in the fortnights either side. Measuring from a peak manufactured a Meta collapse that never happened.
3. A supporting per-product table assigned `prod[id][window] = {...}` inside a loop over multi-row API results instead of accumulating, so only the last row per product survived and the best SKU appeared to go dark when it had not.

The truth only appeared with the merchant's own order ledger and five consecutive fortnights: the store was flat (354 → 352 orders, £29,871 → £29,503) while Google spend rose 24% for 252 more clicks. The real finding was incrementality, not a collapse, and it was invisible from any two-window view.

**Why:** two points cannot distinguish a fall from a return to normal, and a peak makes an ordinary period look like a disaster. Worse, each wrong framing was individually plausible and internally consistent, so nothing in the analysis itself flagged the error. Both wrong versions were written into shared state that other sessions read.

**How to apply:** plot at least four consecutive windows before trusting any two-window comparison, and state explicitly whether the baseline window is typical or extreme. Prefer a metric that survives attribution disputes: revenue from the merchant's own orders beats platform-attributed value, and "spend rose, total business did not" is a claim no conversion-window argument can touch. When aggregating API rows keyed by an id, accumulate, and reconcile the total against an independently queried figure before believing any row. Siblings: [[cross-surface-relevance-check]] joins surfaces, this one aligns time, and [[never-assert-absence-from-one-reading]] is the same disease in a third dimension.

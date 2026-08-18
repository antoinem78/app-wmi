---
name: cross-surface-relevance-check
description: "A finding on one surface must be checked against the surface where the money moves before claiming impact (founder correction, 2026-08-12)"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c838c79d-dc60-478b-b104-5962dd7bb927
  modified: 2026-08-13T18:48:41.668Z
---

Drafting the House of Isabella client report, I led with "33k products suppressed in Ireland and Spain" as the biggest finding. The founder's correction: "You need to review the GMC geo settings against the google ads campaign geo-targeting for it to be relevant. Commonsense." The check showed every enabled campaign targets the UK only, so the suppression cost zero paid traffic and the claim was an overclaim; the finding had to be reframed as a half-built expansion, and the out-of-stock revenue finding promoted to the lead.

**Why:** a defect on surface A (Merchant Center, catalog, pixel, feed) only has the claimed impact if surface B (the campaigns actually spending money) touches the affected scope. Clients' own agencies will shoot down any unchecked claim, and one shot-down claim discredits the whole report.

**How to apply:** before any client-facing impact claim, join the finding against the spending surface: geo findings against campaign geo-targeting, product findings against whether campaigns reference those products/sets, tracking findings against which conversion actions are primary for bidding, budget findings against actual campaign status. Sibling of the standing rules [[meta-api-absence-claims]] and the two-surface reconciliation rule from the commerce work: MC status vs ads-side eligibility already diverged on Xinzuo and HoI for the same underlying reason.

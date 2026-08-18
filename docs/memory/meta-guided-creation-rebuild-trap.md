---
name: meta-guided-creation-rebuild-trap
description: Rebuilding a Meta ad set through guided creation silently re-enables Advantage defaults; one of them (personalised destinations) redirects clicks off the website
metadata:
  type: feedback
---

Confirmed on Atelier Brunos 2026-08-15. A 12 August ad-set rebuild through guided creation came back with personalised destinations ON and only "Shop" toggled, so every paid click went to the Meta shop and the website received zero paid sessions while the account kept reporting clicks and on-Meta checkouts. The client saw it from Shopify sessions before we did.

**Why:** the setting is UI-side and invisible in ad set and creative API fields. The only API-visible smell was `contextual_multi_ads: OPT_IN` on the rebuilt ads versus a fully enumerated all-OPT_OUT `degrees_of_freedom_spec` on the originals: adjacent to the control, not the control.

**How to apply:** after ANY rebuild or duplication through guided creation, check destinations and Advantage toggles in Ads Manager, not just the API. Diagnostic method that worked: the same placement behaving differently across two ad sets rules out placement causes; a healthy pixel `last_fired_time` separates "traffic diverted" from "tracking broken". Sibling of [[cross-surface-relevance-check]].

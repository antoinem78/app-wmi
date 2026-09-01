---
name: google-ads-bidding-claims-need-three-surfaces
description: "campaign_conversion_goal rows are materialized defaults, not settings; a bidding claim needs goal config level + category toggles + primary flags/origins read together (GoPoxy, 2026-08-21)"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 6d861d7b-dc2d-46d3-979b-17e80c6d89de
  modified: 2026-08-21T19:10:47.751Z
---

Reviewing a freelancer's new GoPoxy campaigns, I read `campaign_conversion_goal` (biddable = true on PURCHASE, ADD_TO_CART, BEGIN_CHECKOUT, SUBMIT_LEAD_FORM, CONVERTED_LEAD) and told the founder the sales campaigns were bidding on baskets and enquiries, and that a new primary conversion action was "already affecting the live campaigns". The founder challenged the reading and was right on both counts. The rows I read are a materialized mirror that every campaign carries; they are operative only when `conversion_goal_campaign_config.goal_config_level` is CAMPAIGN. These campaigns were CUSTOMER (account defaults), where only PRIMARY actions inside biddable category/origin toggles bid, and the only such action was the purchase. The "dangerous" new primary was origin GOOGLE_HOSTED while only the WEBSITE origin of its category was account-biddable, so it touched nothing; it existed for the one campaign deliberately using campaign-level goals. The freelancer's architecture was competent, and my finding, already relayed to Oscar's memory as fact, had to be retracted in three places.

**Why:** Google Ads splits "what bids" across three surfaces that each look complete alone: `conversion_goal_campaign_config` (whose goals apply), `customer_conversion_goal` / campaign goal rows (category+origin toggles), and `conversion_action` (primary_for_goal AND origin). Any one or two of them read in isolation produces a confident, specific, wrong bidding claim. Same disease as [[configured-is-not-rendered]] and [[meta-api-absence-claims]]: a surface that answers is not the surface that governs.

**How to apply:** before any claim about what a Google Ads campaign optimises toward, read all three together: (1) `goal_config_level` per campaign, (2) the operative toggle set for that level, (3) the actions' `primary_for_goal` and `origin` joined against those toggles, remembering origins must match (WEBSITE toggles do not cover GOOGLE_HOSTED actions). The effective bidding set = primary actions whose category+origin toggle is biddable at the operative level, plus campaign-selected goals where the level is CAMPAIGN. And when a finding has already been filed to an agent's memory and then dies, correct the agent the same hour, because a wrong fact in shared memory outlives the conversation that created it.

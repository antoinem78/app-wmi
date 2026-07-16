---
name: google-ads-audit
description: >
  Use this skill to produce a Web Marketing International (WMI) style Google Ads
  audit for a B2B or lead-gen advertiser. Triggers: "audit this Google Ads
  account", "PPC audit", "review our ads account", "build the audit + research
  doc", "Google Ads growth research". The skill covers logging into a live
  account (via Claude in Chrome), extracting the right data, diagnosing the
  recurring failure patterns, and producing two branded Word deliverables: a
  hybrid Audit + Growth Research document and a Website CRO Recommendations
  document. Do NOT use for paid social-only audits or for building/launching
  campaigns; this is diagnosis and proposal, not account management.
---

# Google Ads Audit (WMI methodology)

## What this skill produces

Two Microsoft Word (.docx) deliverables, branded **Web Marketing International Ltd** (Google Premier Partner):

1. **`<Client> - Google Ads Audit & Growth Research.docx`** — a hybrid document:
   Part A (Market, Competitor & Keyword Research), Part B (Account Audit),
   Part C (Strategy, Forecast & Optimisation Plan), plus a Premier Partner appendix.
2. **`<Client> - Website CRO Audit & Recommendations.docx`** — prioritised
   Observation / Recommendation / Rationale items with visual exhibits.

Read `references/document-structure.md` for the exact section list, branding and
writing style, and `references/methodology.md` for the data-gathering and
diagnostic playbook. A reusable Word builder lives in `scripts/build_audit_docx.js`.

## Operating principle

The client sells a considered, high-value product to a small expert audience.
**Success is qualified demos, MQLs and opportunities, not clicks or form fills.**
Every recommendation flows from "quality of pipeline over volume of leads".

## Workflow (do these in order)

1. **Understand the business first.** Review the website and socials. Capture:
   what they sell, the modules/products, the ICP (job titles, company types),
   geography, the conversion action (demo/quote/enquiry), and the CRM.
2. **Study reference templates** if available (prior WMI audits/research docs)
   to match structure and tone. Replicate, do not reinvent.
3. **Pull the live account data** (Claude in Chrome, read-only is fine). Extract
   everything in the Data Extraction Checklist in `references/methodology.md`:
   account totals, campaign table, networks, conversion actions (current AND a
   recent active period), search terms, auction insights, assets, audiences.
4. **Diagnose** against the Failure-Pattern Playbook. Capture the *evidence*
   (real numbers, real search terms, real competitor domains), not generalities.
5. **Research** the market, competitors and keywords (volumes + CPC ranges).
6. **Forecast** bottom-up, Google Ads focused, against the stated budget.
7. **Write** both documents from the researched facts using the builder script.
8. **Verify**: validate the .docx, render to PDF, eyeball cover + every table/
   exhibit, fact-check figures against the captured data.

## Non-negotiable diagnostic checks (the recurring killers)

These are the issues that show up again and again; always check each explicitly:

- **Networks**: are Search campaigns running on the **Display Network** and/or
  **Search Partners**? (Tell-tale: huge impressions, sub-£0.20 CPC, <0.5% CVR.)
- **Conversion actions**: is a low-value action (page view, engagement, video
  view) set as **Primary**? Is the real lead action applied to **0 campaigns**?
  How many conversion actions exist, and how many are **Inactive / Needs
  attention / duplicated**? Smart bidding optimises to whatever is Primary.
- **Value & OCT**: is total conversion value ~0? Is the CRM connected for
  **Offline Conversion Tracking** feeding MQL/SQL/Opportunity/Closed-won back?
- **Match types & negatives**: broad/unprotected keywords? Pull the **search
  terms report** and quote the actual junk queries. Is there an account-level
  negative list? (Usually not.)
- **Structure**: generic "all solutions" vs granular by product/buyer; brand on
  a Smart campaign; PMax manufacturing cheap conversions; assets/extensions thin.

## Writing rules (enforced)

- Human, consultative, evidence-led prose. **No em dashes.** British spelling
  ("optimise", "analyse"). Address the **client** ("you/your" = the advertiser),
  never the colleague who commissioned the audit.
- Lead every claim with the real number or real query from the account.
- Explain OCT in full: it is **not** just tagging leads in the CRM; it is feeding
  the whole funnel (MQL, SQL, Opportunity, Closed-won, with values) back to
  Google so bidding optimises to revenue.
- Exhibits, not vague references: reproduce each account/website extract as a
  captioned, sourced "Exhibit" (see structure doc). Screenshots from the browser
  session cannot be saved to disk, so reproduce data faithfully as styled tables.

## Output format choice

Default to **.docx** (the client edits and adds their own content). Build with
`scripts/build_audit_docx.js` (docx-js). Render a PDF copy only for review.

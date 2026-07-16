# Handover: building the Google Ads Audit Agent

Audience: the engineer/Claude Code building an agent that reproduces the WMI
audit we just delivered for OASES. This captures the architecture, the workflow,
the tools, and the hard-won learnings (including the things that broke).

## 1. Goal

Given a Google Ads account, a website and a budget, the agent autonomously
produces two branded Word deliverables (hybrid Audit + Growth Research, and a
Website CRO doc) to WMI's standard. It diagnoses from live account data, not
assumptions. The domain knowledge lives in the `google-ads-audit` skill in this
folder (`SKILL.md` + `references/`); this doc is about wiring the agent.

## 2. Inputs the agent needs

- Google Ads account access (the deep-link OCID URL, signed-in Chrome profile).
  **Read-only is sufficient and safer.**
- Website URL + social links.
- Budget ceiling and the primary conversion (demo/quote) and CRM.
- Optional: reference templates (prior WMI audits) and branding assets
  (`WMI-new-logo.png`).

## 3. Recommended architecture

A phased orchestrator with optional subagents. Phases map to the skill workflow:

1. **Intake** - collect inputs; ask 2-3 clarifying questions (budget, channels,
   deliverable format) before doing heavy work.
2. **Business research** - fetch website + socials; extract business model, ICP,
   geo, conversion, CRM, CRO friction.
3. **Account extraction (Chrome)** - log in, pull every item in the Data
   Extraction Checklist, write findings to a structured notes file.
4. **Market/competitor/keyword research** - web search/fetch; reconcile
   competitors with auction insights.
5. **Synthesis & forecast** - diagnose against the Failure-Pattern Playbook;
   build the 3-scenario forecast.
6. **Document build** - generate both .docx via the builder script.
7. **QA** - validate, render PDF, eyeball, fact-check against notes.

Use a **structured findings artifact** (JSON or a markdown notes file) as the
contract between extraction and writing. Never let the writer invent a number;
it may only use values present in the findings artifact. Persist findings to
disk as you extract (context is lost otherwise on long runs).

Consider subagents for (a) Chrome extraction and (b) document build, so the
orchestrator's context stays clean. Keep one human review checkpoint after
extraction (confirm the data) and one after the first draft.

## 4. Tooling

- **Claude in Chrome** for account access. `navigate`, `read_page` (accessibility
  tree), `find`, `computer` (screenshot/scroll/click), `resize_window`,
  `tabs_context_mcp`, `browser_batch`.
- **Web search / fetch** for research.
- **docx** generation via `docx-js` (`npm i docx`) - see `scripts/build_audit_docx.js`.
- **LibreOffice (soffice) + pdftoppm** for PDF render + visual QA.
- The **docx skill validator** (`validate.py`) to check the file before delivery.

## 5. Account-extraction recipe (Claude in Chrome)

- Resize window to ~1440x900 for legible, complete tables.
- Navigate to deep links: `/aw/campaigns`, `/aw/conversions`,
  `/aw/keywords/searchterms`, `/aw/insights/auctioninsights` with the OCID params.
- Pages load slowly and sometimes show only the spinner: wait 3-5s and re-screenshot.
- **Prefer `read_page` (filter:"all", a sensible `max_chars`) to read table data
  as text** rather than OCR-ing screenshots; it is cheaper and exact. If output
  exceeds the limit, lower `depth`/`max_chars` or use `find` to grab specific cells.
- Set the **date range** deliberately: all-time for lifetime totals; a recent
  active window for "what is firing now". On Conversions use "View all conversion
  actions" and page through (Show rows / next page) to see every action.
- Segment the campaigns table by **Network (with search partners)** to quantify
  Search vs Search Partners vs Display.
- Write each screen's numbers straight into the findings file.

## 6. Learnings and pitfalls (read this twice)

These cost us time on the OASES build; bake the fixes into the agent.

1. **Browser screenshots cannot be persisted to disk.** `computer` screenshots
   with `save_to_disk:true` are NOT written to the filesystem in this environment
   (you get an inline image only). So you cannot embed real Google Ads screenshots
   into the .docx. **Fix:** reproduce every account/website extract as a styled,
   captioned "Exhibit" table/panel (see `document-structure.md`). Offer the user
   the option to drop in their own PNGs afterwards.

2. **OneDrive-synced project folders corrupt build inputs.** If you write a build
   script into a cloud-synced folder (e.g. OneDrive) with the Edit/Write tools and
   then read it back from the shell, you can get a stale or **truncated** copy
   (partial sync), which makes `node` fail mid-file. **Fix:** generate and run the
   build script **inside the workspace** (the VM `/sessions/.../outputs` dir, via
   a bash heredoc), then `cp` the finished .docx into the synced folder. Don't
   round-trip large source files through the synced mount.

3. **Output file can be locked.** If the user has the .docx open in Word, `cp`
   over it fails with "Permission denied". **Fix:** detect this and write a
   `... (updated).docx` fallback, and tell the user to close the file to overwrite.

4. **Read-only account warnings are normal** ("None of your ads are running",
   "You have read-only access"). They do not block extraction. Never attempt to
   change the account; this is diagnosis only.

5. **Research first, format second.** Gather all facts before reading the docx
   skill / building. Don't anchor on document mechanics early.

6. **Validate + visually QA.** Always run the validator, render to PDF, and look
   at the cover and every table/exhibit. TOC fields show as empty until opened in
   Word (that is expected; they populate on open).

7. **Numbers discipline.** Capture exact figures (spend, CPC, conv, search terms,
   competitor domains) verbatim. The persuasive power of the audit is real data;
   never round or invent.

## 7. Guardrails

- Read-only on the ad account; no campaign changes, ever.
- No fabricated metrics; estimates (keyword volumes, forecasts) clearly labelled.
- Confirm scope/budget before building; confirm before sending anything on the
  user's behalf (email/Slack).
- British spelling, no em dashes, client-facing voice (per skill).

## 8. Suggested build order for the agent

1. Wire intake + business research + the findings artifact schema.
2. Wire Chrome extraction to populate the artifact (hardest part; test on a real
   account early because of the load/timeout quirks).
3. Port `scripts/build_audit_docx.js` into the agent and template the content
   from the artifact.
4. Add the CRO builder.
5. Add QA (validate + PDF render + a checklist subagent that cross-checks every
   figure in the doc against the findings artifact).
6. Add the email/handoff step last, behind a confirmation.

## 9. Files in this bundle

- `SKILL.md` - the domain skill (methodology, checks, rules).
- `references/methodology.md` - data extraction + diagnostic playbook + forecast.
- `references/document-structure.md` - exact section list, branding, exhibits, style.
- `scripts/build_audit_docx.js` - reusable docx-js helpers and branding.
- `findings-artifact.schema.json` - the structured data contract (JSON Schema)
  the extractor populates and the writer consumes. The writer may only use values
  present in the artifact; estimates carry an `estimated` flag so they are
  labelled honestly. Each `diagnoses[]` entry ties a failure pattern to the real
  evidence that proves it, which is what the findings narrative is built from.

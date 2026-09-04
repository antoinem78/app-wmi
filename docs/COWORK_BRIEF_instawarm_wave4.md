# COWORK BRIEF: InstaWarm, wave 4, the remainder

**Date:** 2026-08-22
**Requested by:** Anthony
**Subject:** instawarm.shop, same store as the three previous briefs. Admin: `https://admin.shopify.com/store/instawarm-shop` (fallback `https://admin.shopify.com/store/kgh1am-nd`). Published theme: "1", Active, Dawn 15.4.1.

**Purpose.** Three items remain from wave 3. All three were correctly declined last time because of rules I wrote badly. Those rules are fixed below. **This is a short brief: three edits, about 25 minutes.**

**Your wave 3 report was right to stop on all three**, and the structural detail in it is what made these instructions possible. Two corrections to it, for your own calibration rather than as criticism:

- **Your filenames were wrong.** You reported `Screenshot_2026-01-30_at_17.59.48` and `Screenshot_2026-02-08_at_14.04.00`. Both are actually `Screenshot_2026-02-13_at_...`. Structure was right, identifiers were not.
- **The add-to-cart mirror script in `layout/theme.liquid` is not "pending" or "unresolved".** It is a deliberate, live, verified mobile sticky buy bar. **Do not touch or remove it.**

---

## Rules, with two fixed

1. **Note the file version before saving THEME files.** Theme files have per-file version history and that is your restore point. **Shopify Pages have no version history and that is expected. It is not a reason to stop.** For a page edit, transcribe the original text verbatim into your report before saving. That transcription is the restore point.
2. **After every save, load the live page and confirm it renders.** Do not proceed until it does.
3. **If the editor refuses to save because the JSON is invalid, restore the noted version and report.** Do not force it.
4. **Per-item removal instructions are given below.** Do not generalise between them, and do not improvise a different mechanism. If an item does not match its description, stop and report.
5. **Make only the edits listed.** Do not reformat or reindent any file.
6. **Do not open the customiser.** Do not publish, duplicate, rename or delete any theme. Do not delete any file from Content → Files.
7. **Do not touch `layout/theme.liquid`.**
8. **Do not touch pricing, inventory, discounts, checkout, orders or customers, and do not contact anyone.**

---

## Step 1. FEATURES page, two edits. 10 minutes

**Content → Pages → FEATURES.** This is a Shopify Page, not a theme file. Rule 1 applies in its page form: transcribe both original passages verbatim into your report before changing anything.

This is the only page on the store still showing the old figures, so it currently contradicts the FAQ page, the homepage and the product page.

**1a.** Under "MULTIPLE HEATING OPTIONS", find:

> High (Red): 150°F — Maximum heat for the coldest conditions.
> Medium (White): 130°F — Steady warmth for everyday use.
> Low (Blue): 110°F — Gentle heat for extended outdoor time.

Replace with:

> High (Red): 113°F / 45°C, for the coldest conditions.
> Medium (White): 95°F / 35°C, steady warmth for everyday use.
> Low (Blue): 77°F / 25°C, gentle heat for extended outdoor time.

Keep the colour names exactly as they are.

**1b.** This page has its own "POWER THAT LASTS" paragraph, worded differently from the theme version, and it still contains an "over 4.5 hours" claim. Transcribe it verbatim, then replace the sentence containing that claim with:

> How long the heat lasts depends on the power bank you use. A larger battery runs longer, and a 10,000mAh bank will comfortably see out a day on the lower settings.

Leave the rest of that paragraph intact, including the closing "ensuring you stay comfortable throughout your day" if it still reads correctly alongside the new sentence. If it does not, report the wording rather than rewriting more than instructed.

## Step 2. Disable the AS SEEN ON section. 5 minutes

`Screenshot_2026-02-13_at_13.39.16.webp`, in **both** `templates/index.json` (section `image_banner_e8VNbp`) and `templates/product.json` (section `image_banner_MPRFNF`).

You reported correctly that these sections have no `blocks` key. **That is why the instruction is different from last time: add `"disabled": true` to the SECTION object itself**, not to a block. Section-level `disabled` is supported in JSON templates and leaves the file valid.

Do this in both files. Then load both live pages and confirm the strip is gone and nothing else has shifted.

Why it goes: it shows the logos of National Geographic, Discovery, BBC Earth, TikTok and Amazon, and the owner has confirmed the jacket has not been featured by any of them. The lower half of the same image is a cartoon flame border which he has separately asked to remove. One edit, both requests.

**Do not remove the InstaWarm wordmark from the footer.** It also contains a flame and it is his actual brand logo. It stays.

## Step 3. Swap the annotated zone image. 10 minutes

`Screenshot_2026-02-13_at_17.59.48.webp` is the `settings.image` on block `ai_gen_block_f7b7c54_aHkDLq` in `templates/index.json`, and the same image also appears on `templates/product.json`.

You correctly reported that the block also carries five feature title and text pairs, so disabling it would take those with it. **So do not disable it. Change the image instead.**

Replace the image value with this file, which is already in Content → Files:

`Screenshot_2026-02-13_at_18.08.09.webp`

It is a clean outdoor photograph of the black jacket with no annotations and no claims on it. Match the exact format of the value already in the setting, whatever that is, and change nothing else in the block.

Do this wherever `17.59.48` appears, in both template files. Then load both pages and confirm the five feature texts are still present and the new photograph renders.

Why it goes: its callout reads "21 HEATING ZONES, head-to-hem warmth in 30 seconds, targeting arms, back, shoulders & core". The owner ships a **9 zone** jacket, so the number is wrong and the arm coverage claim is unverified.

---

## Deliberately NOT in this brief

**`Screenshot_2026-02-13_at_14.04.00.webp`**, the front-and-back heating panel illustration, stays for now. Unlike the image in step 3 it states no number, so it is misleading rather than false, and removing it would leave a visible hole. The owner is having corrected artwork made and it will be swapped in the same way as step 3 when it arrives. **Do not touch it.**

**The two Loox review photos.** Automation has failed on that embedded app screen twice in the same way. A human is doing it.

---

## Report

Same format as your previous three. Per step: Step, Status, Found (verbatim), Match, Left (verbatim), Evidence, Time, Deviation. For theme files, the version noted before saving and confirmation the page rendered after. For the FEATURES page, the verbatim original text, which is the restore point.

Then: what was not done and why, anything changed outside the three steps, anything you guessed at, and total time.

**Finally, the sweep that closes this out.** Load the homepage, the features page, the FAQ page and the product page, and search each for `150`, `130`, `110` and `fully tested`. Report every hit with its page, or confirm there are none. Ignore matches inside the size chart, where figures like `32.5-36.5` and `24.5cm` are legitimate.

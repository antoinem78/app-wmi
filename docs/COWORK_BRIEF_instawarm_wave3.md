# COWORK BRIEF: InstaWarm, wave 3, theme content

**Date:** 2026-08-20
**Requested by:** Anthony
**Subject:** instawarm.shop, same store as the two previous briefs. Collaborator access is on my account. Admin: `https://admin.shopify.com/store/instawarm-shop` (fallback `https://admin.shopify.com/store/kgh1am-nd`). Published theme: "1", Active, Dawn 15.4.1.

**Purpose.** The FAQ page has been corrected, but the same three claims are duplicated inside theme content on the homepage, the features page and the product page, so the store currently contradicts itself: one page says the jacket reaches 113°F and three say 150°F. There are also three images making claims about a product the owner does not sell.

**This brief uses the theme code editor, which the previous two briefs forbade.** That earlier restriction was wrong, and here is why it has changed: I banned it on a "no undo" basis borrowed from pages and products, which genuinely have no version history. **Theme files do.** The code editor keeps per-file version history and any earlier version can be restored. So this is the most reversible work in the whole engagement, provided you use that safety net.

---

## Rules that override everything else

1. **Before saving any file, note its current version** in the code editor's version history. That is your restore point and the reason this work is safe.
2. **After every save, load the live page and confirm it still renders.** A malformed theme file shows as a blank or missing section, not an error message. Do not move to the next edit until the page looks right.
3. **If the editor refuses to save because the JSON is invalid, do not try to force it.** Restore the noted version and report.
4. **To remove an image, add `"disabled": true` to its block rather than deleting the block object.** Same visible result, valid JSON either way, and one added key is far easier to reverse than a deletion. If the image is a setting on a section that carries other content, report that instead of improvising.
5. **Make only the edits listed.** Do not tidy, reformat or reindent any file. Change only the strings named.
6. **Do not open the theme customiser**, do not publish, duplicate, rename or delete any theme.
7. **Do not delete any file from Content → Files.**
8. **Do not touch pricing, inventory, discounts, checkout, orders or customers, and do not contact anyone.**

If a rule conflicts with a step, the rule wins. If anything is ambiguous, stop and report.

---

## Step 0. Orientation. 5 minutes

Open **Themes → ⋯ → Edit code** on the published theme "1". Confirm you can see `templates/index.json`, `templates/product.json` and the `sections/` folder, and that version history is available on a file. Report what you find. If version history is not available, **stop and tell me** rather than proceeding.

---

# PART A: the edits

Three claims, replaced identically wherever they appear. The replacements are the same as the ones already live on the FAQ page.

**Replacement 1, the safety sentence.** Find:

> It features built-in temperature regulation to prevent overheating and is fully tested to meet international safety standards.

Replace with:

> It features built-in temperature regulation that holds a steady temperature and shuts off before it can overheat.

**Replacement 2, the battery life answer.** Find `Up to 4.5+ hours on low.` and replace with `It depends on your power bank.`

Then find the paragraph beginning `By connecting a single battery to the internal heating interface` and replace the whole paragraph with:

> The jacket runs on a USB power bank, so how long the heat lasts comes down to the battery you use. A larger battery runs longer. A 10,000mAh power bank will comfortably see out a day on the lower settings.

**Replacement 3a, the temperature list with hours.** Find:

> 150°F — 2+ Hours of intense heat for extreme cold.
> 130°F — 3+ Hours of balanced, everyday warmth.
> 110°F — 4.5+ Hours of extended, gentle heat.

Replace with:

> 113°F / 45°C
> 95°F / 35°C
> 77°F / 25°C

**Replacement 3b, the temperature list with descriptions.** Find:

> 150°F — Maximum heat for the coldest conditions.
> 130°F — Steady warmth for everyday use.
> 110°F — Gentle heat for extended outdoor time.

Replace with:

> 113°F / 45°C, for the coldest conditions.
> 95°F / 35°C, steady warmth for everyday use.
> 77°F / 25°C, gentle heat for extended outdoor time.

**In every case, leave the HIGH / MEDIUM / LOW and RED / WHITE / BLUE labels exactly as they are.** They sit on separate lines from the figures. Only the figures and the trailing text change. Casing varies between surfaces (some are uppercase), so match what is there rather than imposing one style.

## Step 1. Homepage, `templates/index.json`. 15 minutes

Search the file and apply:

- **Replacement 1**, once. It sits inside an "INSTA WARM™ FAQ" accordion.
- **Replacement 2**, once, in the same accordion.
- **Replacement 3a**, once. It is in a "Choose Your Temperature" section, and the lines there are in LOW, MEDIUM, HIGH order rather than high to low. Apply the right figure to the right label, do not reorder anything.

If any of these strings are not in `index.json`, they will be in a file under `sections/`. Search there and report which file you used.

## Step 2. Features page. 10 minutes

The features page is a Shopify **page**, but the temperature block may be theme content. Check **Content → Pages → FEATURES** first. If the text is in the page body, edit it there and do not touch the theme.

Apply **Replacement 3b**, once, under "MULTIPLE HEATING OPTIONS".

Report which surface it turned out to live on. This page was missed in earlier passes and I do not know which it is.

## Step 3. Product page, `templates/product.json`. 15 minutes

Search and apply:

- **Replacement 1**, once, in the "INSTA WARM™ FAQ" accordion.
- **Replacement 2**, once, in the same accordion.
- **Replacement 3a**, **twice**. This page has two temperature lists: one in an "ESTIMATED HEATING TIMES" accordion and one in the FAQ accordion. Both must change.

## Step 4. Remove the AS SEEN ON strip. 8 minutes

File `Screenshot_2026-02-13_at_13.39.16.webp`, referenced in **both** `templates/index.json` and `templates/product.json`. On the product page it is inside the PREMIUM DESIGN block.

Search `13.39.16` in each file and disable the block per rule 4.

Why: it shows the logos of National Geographic, Discovery, BBC Earth, TikTok and Amazon. The owner has confirmed the jacket has not been featured by any of them and has agreed to it coming down.

Note that the lower half of that same image is a cartoon flame border. The owner has separately asked for "the fire" to be removed because he finds it unprofessional. It is the same file, so this one edit satisfies both. **Do not remove the InstaWarm wordmark from the footer**, which also contains a flame and is his actual brand logo. That stays.

## Step 4b. A missing space, same file. 2 minutes

While you are in `templates/index.json`, in the "POWER THAT LASTS" section, find:

> power bank.A single battery use

Replace with:

> power bank. A single battery use

One character. It is on the homepage directly above the strip you have just removed.

## Step 5. Remove two images making zone claims. 8 minutes

Both are on the homepage, in `templates/index.json`. The owner ships a **9 heating zone** jacket. Both of these depict a different product and he is having corrected artwork made.

- Search `17.59.48`. This is an annotated street photograph whose callout reads "21 HEATING ZONES, head-to-hem warmth in 30 seconds, targeting arms, back, shoulders & core".
- Search `14.04.00`. This is the "Internal Heating System" illustration showing front and back views with far more than nine heating panels.

Disable both blocks per rule 4. Leave both files in Content → Files, since replacements are coming into the same slots.

## Step 6. Two review photos. 10 minutes

In the Loox admin, hide or remove the photos on these two reviews. Both were confirmed in the previous job and the owner has asked for them to go, because they show a jacket he does not sell:

- Reviewer **"N d"**, 21 December 2025, 5 stars. Photo shows a **blue** jacket.
- Reviewer **"Er"**, 6 October 2025, 5 stars. Photo shows an **olive green** jacket with a red four-button control panel.

**Remove the photo, keep the review and its rating** if the app allows that. If it only allows removing the whole review, stop and tell me rather than deleting a five star review.

Do **not** touch reviewer "P i" (16 September 2025). That one reads grey and may just be indoor lighting. It is a judgement call the owner has not made yet.

---

# PART B: read and report only

## B1. Confirm the store now agrees with itself. 10 minutes

After all edits, search the live storefront (homepage, features, FAQ, product page) for `150`, `130`, `110`, `4.5` and `fully tested`. Report every remaining hit with the page and surrounding sentence, or confirm there are none.

This is the check that matters. The whole point of this brief is that four pages currently disagree, and I need to know they now agree.

## B2. Anything else you noticed

As before. Do not filter for importance.

---

# PART C: the validation report

Same format as your previous two reports. For every step: Step, Status, Found (verbatim), Match, Left (verbatim), Evidence, Time, Deviation.

**Additionally, for every theme file you edited:** the version you noted before saving, and confirmation that the live page rendered correctly after saving.

Then: what was not done and why; anything changed outside Part A; the B1 result stated explicitly; anything you guessed at; total time.

**Where you could not find something, say so explicitly rather than skipping it.**

---

## Estimated total

Part A about 70 minutes, Part B about 15, plus the report.

## Deliberately not in this brief

The replacement promise strip for the AS SEEN ON slot, a text block to move the power bank line above the Add to Cart button, and removing the duplicate brand logo from the footer. All three need the customiser or Dawn's block schema and layout judgement, and are being done by hand.

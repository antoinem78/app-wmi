# COWORK BRIEF: InstaWarm, second wave

**Date:** 2026-08-17
**Requested by:** Anthony
**Subject:** instawarm.shop, the same US Shopify store as the August 16 brief. One product, a heated jacket at $149.95. Collaborator access is on my account. Store admin: `https://admin.shopify.com/store/instawarm-shop` (if that handle is rejected, `https://admin.shopify.com/store/kgh1am-nd`, same store).

**Purpose.** The owner has since confirmed two facts that make parts of his site untrue. The jacket ships **without** a power bank, and he sells the **9 heating zone** version while his site advertises 21. His published heat settings are also roughly 37°F hotter than the supplier's own figures. **Apply the edits in Part A exactly as written, gather the evidence in Part B, and report in the format in Part C.**

**Same conditions as last time.** Live store, real traffic, no staging, and Shopify keeps no version history for pages or products, so a wrong edit cannot be undone with a button. Every "find" quote below is what I read on the live storefront today, so the original text is here if anything needs restoring.

**This brief is deliberately partial.** The same wrong claims also live inside theme accordions on the homepage and the product page, which need the theme code editor. That half is being done by hand and is out of scope here, listed at the end so you know it is deliberate rather than forgotten.

---

## Rules that override everything else

1. **Make only the edits listed in Part A.** Do not fix anything else you notice. Write it down for the report instead.
2. **If the text on screen does not match my "find" quote, stop and report it. Do not approximate.**
3. **Do not open the theme code editor, and do not open the theme customiser.** Nothing in Part A needs either.
4. **Do not touch the sentence "fully tested to meet international safety standards" anywhere except on the FAQ page**, where step 3 tells you to. It appears in two other places that are out of scope.
5. **Do not add any instruction telling a customer how to measure themselves**, and do not add or change any size beyond what exists.
6. **Do not touch pricing, inventory, discounts, checkout, orders or customers.**
7. **Do not delete any image file from Content → Files.** Removing an image from a page is fine where instructed. Deleting the file is not.
8. **Do not contact anyone**, and do not use any contact form, chat widget or request button.

If a rule conflicts with a step, the rule wins. If anything is ambiguous, stop and report rather than choosing.

---

## Step 0. Access check. 3 minutes

Confirm you can reach **Content → Pages**, **Products**, and **Content → Files**. If any is denied, stop and tell me. Report the published theme name for the record.

---

# PART A: the edits

## Step 1. Product description: the two lines that matter most. 10 minutes

**Products → Heated Jacket → Description**

The description on this store renders **above** the price and the add to cart button, so the top of this box is the first thing a buyer reads. That is deliberate placement, not a guess.

**1a. At the very top**, above the heading "UNMATCHED WARMTH, BUILT FOR ANY WEATHER", insert:

> **Power bank not included.** The jacket runs on any standard 5V USB power bank, so you can use one you already own. If you need one, look for 5V output and at least 10,000mAh for a full day of heat.

Bold the words "Power bank not included" so it reads as a specification rather than small print.

**1b. At the very bottom**, after the sentence ending "Let us know within 30 days for a stress-free refund.", insert:

> Ships within 3 to 5 days. Delivery to the US is typically 10 to 20 business days, tracked all the way.

**Change nothing else in this box.** Leave the guarantee sentence exactly as it is.

## Step 2. FAQ: new question about the power bank. 6 minutes

**Content → Pages → FAQ**

Add a new question near the **top** of the page, not at the bottom, in the same format as the existing entries:

> **Do I need to buy a power bank?**
>
> The jacket does not come with one, so yes, unless you already have a USB power bank at home. Any standard 5V bank works. For a full day on the middle setting, 10,000mAh or more is the right size. I would rather tell you now than have you open the box and find out.

## Step 3. FAQ: the safety claim. 4 minutes

Same page. Find:

> It features built-in temperature regulation to prevent overheating and is fully tested to meet international safety standards.

Replace with:

> It features built-in temperature regulation that holds a steady temperature and shuts off before it can overheat.

The owner cannot produce test certificates, so the standards claim cannot stay. Only this instance, on the FAQ page. The other two are out of scope per rule 4.

## Step 4. FAQ: battery life. 6 minutes

Same page. Find the short answer:

> Up to 4.5+ hours on low.

Replace with:

> It depends on your power bank.

Then find the paragraph below it:

> By connecting a single battery to the internal heating interface, you can maintain a consistent temperature for hours at a time. On the low setting, the system is efficient enough to provide over 4.5 hours of continuous warmth.

Replace with:

> The jacket runs on a USB power bank, so how long the heat lasts comes down to the battery you use. A larger battery runs longer. A 10,000mAh power bank will comfortably see out a day on the lower settings.

## Step 5. FAQ: the temperatures, in two separate places. 8 minutes

Same page. These figures appear **twice**, under two different questions. Both must change.

**5a.** Find:

> High (Red): 150°F — 2+ Hours of intense heat for extreme cold.
> Medium (White): 130°F — 3+ Hours of balanced, everyday warmth.
> Low (Blue): 110°F — 4.5+ Hours of extended, gentle heat.

Replace with:

> High (Red): 113°F / 45°C
> Medium (White): 95°F / 35°C
> Low (Blue): 77°F / 25°C

**5b.** Under "Can I control the level of heat?", find:

> High (Red): 150°F — Maximum heat for the coldest conditions.
> Medium (White): 130°F — Steady warmth for everyday use.
> Low (Blue): 110°F — Gentle heat for extended outdoor time.

Replace with:

> High (Red): 113°F / 45°C, for the coldest conditions.
> Medium (White): 95°F / 35°C, steady warmth for everyday use.
> Low (Blue): 77°F / 25°C, gentle heat for extended outdoor time.

**Keep the colour names exactly as they are.** The only thing suggesting they might be wrong came from a machine-translated page, which is not evidence.

**Before saving, search the page for `150`, `130`, `110` and `4.5` and confirm none survive.** Report anything you find that is not listed above rather than changing it.

## Step 6. Product URL. 5 minutes

**Products → Heated Jacket → Search engine listing → Edit → URL handle**

Change from:

`21-areas-heated-jacket-men-warm-vest-usb-self-heating-jacket-women-heated-coat-ski-camping-hiking-winter-cotton-clothes-washed`

to:

`heated-jacket`

It currently says 21-areas, which is the wrong product, and it is a raw supplier title.

**Then verify the redirect and report the result.** Load the full old address in a browser and confirm it lands on the new one. There may be live advertising pointing at the old URL, so this verification is not optional.

## Step 7. Gallery: outdoor shots to the front. 10 minutes

Two suitable photographs already exist on the store but are not in the product's Media:

- `Screenshot_2026-02-13_at_17.53.13.webp`, a model pulling the hood up in the rain
- `Screenshot_2026-02-13_at_17.26.13.webp`

**Content → Files**, search each filename, copy its link. Then **Products → Heated Jacket → Media → Add media → Add from URL**, paste, and drag both into the first two positions ahead of the studio shots.

Do not remove any existing image.

---

# PART B: read and report only, change nothing

## B1. Which review photos show the wrong jacket. 15 minutes

**This is the most useful thing in Part B.** The owner has confirmed his review images came from AliExpress and show the **21 zone** jacket, while he ships the **9 zone** version. The two have visibly different heating panel layouts, and one review photo shows a navy jacket when he only sells black.

In the Loox admin, go through **all** reviews, not only the first page. Report which ones carry photos that show a jacket different from the black 9 zone one, by reviewer name and date.

**Note:** on the previous job, the "Show more reviews" control and the Loox admin filters did not respond to automated clicking. If that happens again, say so and report how many you did manage to check, rather than presenting a partial pass as complete.

## B2. Any other image making a zone or temperature claim. 12 minutes

I have checked the text of every page and the eight product gallery images. I have **not** checked every image on the site.

Walk the homepage, product page, features page and FAQ page and report any image that shows a heating zone count, a heat map diagram, or a temperature figure. Give the filename where you can see it, and describe what it claims. I am looking for anything that says 21, or shows a panel layout, or quotes a temperature.

## B3. Did step 1 land where intended. 5 minutes

After step 1, load the live product page as a customer on a phone-width window and report what appears **above** the price and the add to cart button, in order. I need to know the power bank line is actually in the buyer's eyeline and not pushed below the fold.

## B4. Anything else you noticed

Anything that looks wrong but was not in Part A. Do not filter for importance.

---

# PART C: the validation report. Required.

For every step in Part A, including any not completed:

| Field | What I need |
|---|---|
| Step | Number and name |
| Status | Done / Partial / Blocked / Skipped |
| Found | The text actually on screen, verbatim, before you changed it |
| Match | Did it match my quote exactly? If not, quote both and say what you did |
| Left | The text now published, read back from the live storefront after saving |
| Evidence | Screenshot of the published page, not the editor |
| Time | Timestamp of the save |
| Deviation | Anything done differently, and why |

Then:

1. **What you did not do, and why**, item by item.
2. **Anything you changed that is not in Part A.** There should be nothing.
3. **The redirect result from step 6**, stated explicitly.
4. **Anything you were unsure about** and how you resolved it. If you guessed, say you guessed.
5. **Total time.**

**Where you could not find something, say so explicitly rather than skipping it.** A gap you name is useful. A gap left silent costs a whole second pass to discover.

---

## Estimated total

Part A about 50 minutes, Part B about 32 minutes, plus the report.

## Deliberately not in this brief

The same safety sentence, temperature lists and battery life claim also appear inside theme accordions on the homepage and the product page, and an "AS SEEN ON" logo strip and a "21 HEATING ZONES" graphic need removing from both. All of that lives in theme files and is being handled by hand. If you find yourself in the code editor or the customiser, you have gone out of scope.

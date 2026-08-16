# The two demo videos: what to actually do

Two recordings. Video 1 is your phone. Video 2 is your desktop. They join at the moment you press send.

**Video 2 is being reshot. Read "Before the video 2 reshoot" at the bottom first**, because three things have to be true before the camera rolls and two of them are not true today.

---

## Before you start, three minutes

1. **Delete the old test contact** in the WMI CRM: "antoine lead", +44 7429 514277. If you skip this, GHL matches your number to the existing record and updates it instead of creating a new one, and video 2 has nothing to show. **Still present as of 2026-08-16**, created 11 August, contact id `XjBDp94LLXd1ibKQ6SdM`. Deleting it is a thirty second job in the UI and nobody else should do it for you.
2. **Have the demo link ready to paste on your phone.** Send it to yourself in a note. This is the canonical demo URL, reuse it every time so recordings stay consistent:

```
https://www.wmiltd.com/?gclid=Cj0KCQjwkOvTBhDgARIsAKUNyRvLsDSYKdiAW3mAG1t0C2kUjzXE0E45sZ4m6rXmKqWD5sy3UJdAT_YaAm2xEALw_wcB
```

That value started life as a genuine click id and has **one character altered in the middle**, so it keeps the exact shape and length a real gclid has while no longer pointing at anybody's actual click. The structural prefix (`Cj0KCQjw`) and tail (`EALw_wcB`) are untouched, because those are the parts a reader familiar with the format would notice if they were mangled.

On a live client call, use a real gclid from their own account instead. Send it to them before the call and have them open it. Same demo, their data, nothing to explain.
3. **Clear the WhatsApp thread** with +44 7476 925643 if one exists, so the conversation opens empty.

---

## VIDEO 1: on your phone

Screen record in portrait. One take. About forty seconds.

1. Open your browser, fresh tab.
2. Paste the link and go.
3. Scroll down the page slowly, as a real visitor would.

   **Do not bother expanding the address bar.** Founder ruling 2026-08-11, and it is the right call: mobile Chrome collapses the URL to the domain, and tapping to expand it pops the keyboard and a suggestions dropdown over the page for a messy shot. The proof is the click id appearing in the CRM at the end, because there is no other way it could have got there. The narration carries the setup instead.
5. **Tap the WhatsApp button.**
6. WhatsApp opens with a message already written in the box.
7. **Select all that text and delete it.** Do it visibly and slowly. This is the most important two seconds in either video.
8. Type something a real customer would type. Something like: *Hi, can you help with our Google Ads?*
9. **Send it.**
10. Hold on the sent message for two seconds, then stop recording.

**What to say over it, if you narrate:**

> "I have landed here from an advert. You can see it in the address bar. I tap through to WhatsApp, and here is the part everyone gets wrong: most systems hide a reference code in this message and hope nobody deletes it. People delete it. So I am going to delete it, and write my own message, exactly like a real customer."

---

## VIDEO 2: on your desktop

Start recording before you refresh. About forty seconds.

1. CRM open on the contacts or conversations list, filtered to today. **It should be empty.** Let the viewer see that it is empty.
2. **Refresh.** The new enquiry appears. Do not cut the pause before it lands.
3. Open the record. Show the name and phone number.
4. **Scroll to the attribution fields and show the click id sitting there**, the same one that was in the address bar on your phone. Hold it.
5. Show that the message itself contains no code. The identifier survived even though nothing survived in the message.
6. **Drag the deal into the won stage and put a value on it.** Not optional, and it is the step that was skipped last time. It is also the step the closing narration depends on, so without it the strongest line in the script is unbacked. See the reshoot section: there is no deal on the board unless somebody puts one there first.

**What to say over it:**

> "Here it is, seconds later. A new enquiry, with the advert it came from attached, even though I deleted everything out of that message. When this turns into a booking and I mark it won, the advertising platforms get told which advert produced it and what it was worth. That is the part that compounds."

**Optional closing line, and I would keep it:**

> "One thing I am always straight about. Every enquiry is labelled with how it was matched. When several people message in the same short window, it does not guess, it marks them unknown. I would rather tell you I do not know than credit the wrong advert."

---

## Before the video 2 reshoot, 2026-08-16

Four things, found by reading the live location rather than by remembering it. Two are blocking.

**1. There is no deal to drag, and there never has been. Blocking.** The WMI location holds zero opportunities, because `RCV_wa_inbound_wmi` creates the contact and stamps the attribution but never creates an opportunity. That is why step 6 got skipped: it was not skipped, it was impossible. Two ways forward and the first is better.

- Add the opportunity-creation node to the receiver, so every WhatsApp enquiry lands in New Lead on the New Business board on its own. One HTTP node, specified in `docs/NURTURE_BLUEPRINT_WA_SMS.md` Part 5. It is a live workflow so it needs your go.
- Or, for this recording only, create the opportunity by hand on the contact after it appears and before you start recording the pipeline part. It works, but it means the board is not really doing what the video implies it does, and a client who buys this will not have it.

**2. The Landing Page field currently reads `?gclid=DEMO_TEST_CLICK_123`. Blocking, and it is worse than the old ruling assumed.** The 2026-08-11 ruling described the defect as an older URL sitting beside a newer click id, which is cosmetic. The actual value on the record is the literal string `DEMO_TEST_CLICK_123`, and step 4 of the script has you hold the camera on exactly that block of fields. A visibly fake test string on screen, in the shot whose entire job is proving the attribution is real, is not cosmetic.

The widget fix is committed on branch `wa-widget-landing-fix` and proven in a browser: a click id the visitor has not arrived with before now re-stamps the landing page beside it. Merge it before the reshoot and the field will read the demo URL. It is not merged, because `main` auto-deploys.

Note the timing: your phone is carrying the stale value in localStorage right now, and it heals on the next visit with the demo link once the fix is live, not before.

**3. The stage is called "Won/Lost", and stage three is called "Audit deiivered".** Both are on camera the moment the pipeline is in frame. Dragging a deal into a stage labelled "Won/Lost" does not read as marking it won. Renaming the last stage to "Won", adding a separate "Lost", and fixing the typo is a two minute job in the pipeline settings and it is your call, because it is a live pipeline you use for real business.

**4. Two variants of the demo gclid are in circulation.** The canonical one at the top of this file has `...sZ4m6rXm...`. The record created on 11 August has `...sZ4m6rIm...`. Both are altered and both point at nobody, so neither is wrong, but the point of a canonical value is that recordings match. Use the one at the top of this file and delete the other from your notes.

**Frame, for the clean take.** New browser profile or a guest window, so no bookmarks bar, no extensions and no other tabs. Dismiss the GHL notification and cookie banners before recording, not during. Close the chat bubble. Window at a size where the attribution fields are readable without zooming, because zooming mid-shot looks like hiding something.

**What still needs your hands.** The enquiry has to arrive live during the recording, and that means the phone half: your handset, your WhatsApp, your send. Nothing about this can be automated from here, and it should not be, because the whole proof is that a real message from a real phone produced the record.

## After recording

Nothing to clean up: the demo click id is altered and belongs to no real account, so it can sit in the pipeline harmlessly.

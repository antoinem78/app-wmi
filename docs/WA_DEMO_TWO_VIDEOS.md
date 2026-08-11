# The two demo videos: what to actually do

Two recordings. Video 1 is your phone. Video 2 is your desktop. They join at the moment you press send.

---

## Before you start, three minutes

1. **Delete the old test contact** in the WMI CRM: "antoine lead", +44 7429 514277. If you skip this, GHL matches your number to the existing record and updates it instead of creating a new one, and video 2 has nothing to show.
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
6. Optional, and worth it: drag the deal into a won stage and put a value on it.

**What to say over it:**

> "Here it is, seconds later. A new enquiry, with the advert it came from attached, even though I deleted everything out of that message. When this turns into a booking and I mark it won, the advertising platforms get told which advert produced it and what it was worth. That is the part that compounds."

**Optional closing line, and I would keep it:**

> "One thing I am always straight about. Every enquiry is labelled with how it was matched. When several people message in the same short window, it does not guess, it marks them unknown. I would rather tell you I do not know than credit the wrong advert."

---

## Known cosmetic issue, ruled not blocking

The Landing Page field on the contact record can show an older URL than the click id beside it. The widget records the landing page once on first touch and never refreshes it, so a phone that visited the site before carries the earlier value forward while the click id updates. Founder ruling 2026-08-11: not a blocker for the demo, because the point being demonstrated is that the click id arrives at all.

It still wants fixing for real clients, where a record that pairs today's click id with last week's landing page is simply wrong. Tracked separately.

## After recording

Nothing to clean up: the demo click id is altered and belongs to no real account, so it can sit in the pipeline harmlessly.

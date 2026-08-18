---
name: whatsapp-nurture-window-shape
description: "WhatsApp's 24-hour window, not taste, dictates nurture design: front-load, check the window before every step, and cap template knocks at three"
metadata: 
  node_type: memory
  type: project
  originSessionId: 20a84efb-ced7-4b3b-9ab0-eec2cef4f948
  modified: 2026-08-16T18:41:30.364Z
---

A WhatsApp nurture is not an email drip with a different transport. Inside 24 hours of the contact's last inbound message you can send free-form messages, and the first 1,000 service conversations a month are free. Outside it you can send nothing but a pre-approved template, billed on every delivery whether or not anyone reads it.

Three design consequences:

- **Front-load.** Everything sayable in the first 24 hours goes in the first 24 hours. After that you get two or three expensive knocks, not a drip.
- **Check the window before every step**, never assume it. GHL has the action for it: `WhatsApp: Customer Service Window Check`, branching **Open** and **Closed**. Open takes the WhatsApp action with template `None - Free form message`; Closed takes an approved template. The contact may have replied to a human between steps, which changes the answer.
- **Cap the template knocks at three, and two is better.** Templates that get ignored, blocked or reported drop the WABA quality rating, and a dropped rating lowers the messaging limit on the number. The cost of over-sending is not the few pence, it is the number.

Template mechanics worth knowing before drafting: templates belong to a WABA, so every client submits and gets approval on their own account. Approval takes hours to a day and can be rejected, so submit before building the workflows rather than after. Put a booking link in a URL button rather than a body variable, which is both a common rejection reason and worse converting. Never send a template whose name variable would resolve to a placeholder like "WhatsApp"; skip the contact instead.

**Why it matters commercially:** UK rates make WhatsApp the cheaper channel as well as the better one. A marketing template is about £0.038 and a utility template about £0.016 against £0.042325 for a single UK SMS segment, and the SMS messages that carry a link, a sender name and an opt-out run to two segments. That is a useful thing to have to hand when a client asks why they are being steered to WhatsApp.

**One channel per contact.** A contact has one phone number and both channels land on it. Running WhatsApp and SMS sequences at once reads as spam from one sender and earns a STOP that kills both. Choose by origin, enforce with mutually exclusive tags, and let each workflow's first step remove the other tag.

Written up in full in `docs/NURTURE_BLUEPRINT_WA_SMS.md`. Related: [[nurture-consent-at-collection]], [[automated-message-never-claims-attention]].

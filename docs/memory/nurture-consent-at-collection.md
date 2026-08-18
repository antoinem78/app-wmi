---
name: nurture-consent-at-collection
description: "PECR soft opt-in needs an opt-out offered where the details were collected, so the widget or form is part of the nurture build; both of ours failed it on 2026-08-16"
metadata: 
  node_type: memory
  type: project
  originSessionId: 20a84efb-ced7-4b3b-9ab0-eec2cef4f948
  modified: 2026-08-16T18:41:18.084Z
---

Marketing by SMS is governed by PECR, and the prudent position is that WhatsApp marketing templates are too. Without consent you rely on the soft opt-in, which has four conditions, and the third is the one that gets missed: **the person must have been given a chance to refuse at the point their contact details were collected.**

The other three live inside the sequence and are easy. Condition 3 lives on the collection surface, which nobody thinks of as part of the nurture. On 2026-08-16 both of ours failed it: the WhatsApp widget card said nothing at all, and `wmiltd.com/free-audit` collected a phone number under "No obligation. We reply within 1 working day." Neither offered any way to refuse.

**Why:** a sequence designed and approved on its copy alone can be unlawful for a reason that is not in the copy. It also fails silently. Nothing errors, the messages send, and the exposure only appears if somebody complains. The founder's ruling that client work is checked against the surface a real user sees applies here too: the surface a real user sees is the form, not the workflow.

**How to apply:**

- Before designing any SMS or WhatsApp sequence for a client, open their actual collection surfaces (widget, form, landing page, chat) and check for a refusal line. If there is none, adding it is part of the build, not a footnote to it.
- Condition 1 needs an enquiry, not a visit. Somebody asking about the service counts as negotiations for a sale; somebody browsing does not. A newsletter signup or a competition entry does not get you there either.
- Condition 4 needs a working opt-out in every message. On SMS that is "Reply STOP to opt out", which GHL honours natively on LC Phone numbers and which should still be tested from a handset. On WhatsApp templates it is a quick reply button wired to a workflow that sets DND, because a stop button that does nothing is worse than none.
- Answering a question somebody asked is service and is outside all of this. Nudging somebody who went quiet is marketing and is inside it.
- Some clients own a collection surface we do not control. Say so early rather than discovering it at go-live.

The widget half is fixed on branch `wa-widget-landing-fix`, defaulting on, overridable per client with `data-consent`. Related: [[whatsapp-nurture-window-shape]], [[automated-message-never-claims-attention]].

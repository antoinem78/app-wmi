# VIP: two-way conversational agent on SMS and WhatsApp. Design, started 2026-08-20

**Founder instruction 2026-08-20: start this.** The sequencing objection (no traffic yet) was raised twice and overruled, so it is recorded and not re-argued. This is the design and the prerequisite list.

**What already exists and is reusable.** The knowledge base is the same one the web chat uses, scoped by client, so nothing new is needed there: VIP holds 4 documents and 32 chunks, including Kyle's 102-question FAQ. The clinical gate, the confidence floor, the handoff logic and the escalation classes all live in `OP_conv_agent_runtime`, which is channel-agnostic: its webhook takes a `channel` field and `web_chat` is just the first value used.

**So this is a channel wrapper, not a new agent.** That is the single most important design point. `AGENT_webchat` is a thin wrapper: resolve the tenant from a token, call the core, apply a delivery policy. An SMS wrapper is the same shape with a different transport and a different delivery gate.

## Architecture

```
inbound SMS/WA  ->  AGENT_sms (new, thin)  ->  agent-core-v1 (existing; since 2026-09-03 it requires the `RAG internal auth (x-rag-key)` header credential on the calling HTTP node, same as AGENT_webchat's Call core)
                         |                            |
                    resolve tenant                clinical gate,
                    from the receiving             RAG, model,
                    number, not a token            floor, postpass
                         |
                    send reply back out
                    via the same channel
```

**Three things differ from web chat and each needs a decision.**

**1. Tenant resolution.** Web chat resolves the client from a `widget_token` in the page. SMS has no page. The tenant must be resolved from **the number the message arrived on**, which means one number per client, and a lookup from number to client. That is a new config key or a small table. It also means the number is the tenant boundary, so getting it wrong routes one client's prospect into another client's knowledge base.

**2. Delivery gate.** Web chat withholds the reply unless `enabled` or a preview key matches. **SMS has no equivalent of showing nothing**: a message either sends or it does not. So shadow mode has to mean "compute, log, and send nothing", and the send node must be explicitly gated on `enabled`. Given the runtime's history of `mode` not gating anything (see PROJECT_STATE), **this gate must be written and tested rather than assumed.**

**3. Session identity.** Web chat has a session id per browser. On SMS the natural session key is the phone number, which persists forever, so a conversation from three months ago would otherwise continue mid-thread. Needs a session window, probably 24 hours of inactivity, after which a new session starts.

## Prerequisites, in order

1. **A number.** Try importing Kyle's 07 into VIP's GHL location. If GHL refuses because the number is already a WhatsApp channel, a dedicated number is about £1.89 a month. **Do not use the new work eSIM `07364237621` for this**: it is the number on the Google Business Profile and the call-tracking destination, and an automated agent answering it would collide with real calls.
2. **Inbound routing.** Replies must land somewhere that triggers the wrapper. In GHL that is an inbound-message workflow posting to our webhook.
3. **The wrapper workflow.** `AGENT_sms`, per the shape above.
4. **Outbound sending.** Through GHL's own messaging, so the conversation stays visible in the client's inbox rather than in a system only we can see.

## Constraints that are not preferences

**WhatsApp's 24-hour window dictates the design, not taste.** Outside it, only approved templates send. So the flow front-loads, checks the window before every step, caps templates, and uses one channel per contact rather than both.

**Consent is at collection, not at send.** PECR soft opt-in needs an opt-out where the details were collected, so **VIP's enquiry form and the WhatsApp widget are part of this build**, not adjacent to it. Both of ours have failed this before. Check VIP's form before the first message sends.

**SMS to someone who asked to be contacted is consent in substance. Cold SMS is a different question with a different answer.** This agent replies to inbound and follows up on enquiries. It does not open cold conversations.

**The agent never claims attention it has not paid.** "I had a look at your account" gets called out on the first reply. Warm and first person is fine; implied human review is not.

## What this does not need

No new knowledge base, no new model prompt, no new clinical gate. Reusing the core is the whole point, and any behaviour that differs by channel belongs in config rather than in a second copy of the logic.

## Open, needing the founder

- Which number, per prerequisite 1
- Whether this ships before or after the web chat, given both share the same untested `enabled` gate and the web chat has an unresolved latency defect upstream of n8n

# Agent optimise: process feedback from the first live run

**From the Steffen Foerster channel session.** Written for the session building and improving the Bernard and Norbert process. Everything here is observed during the Steffen launch (17 August), the exclusion incident (19 August) and the v1.1 build and first staging (26 August). Companion to `docs/BERNARD_OPTIMISE_SPEC.md` and `docs/BERNARD_OPTIMISE_V1_1_EXCLUSIONS_SPEC.md`.

Ordered by what I would fix first, not by when it was found.

---

## 1. The defect that will define how this feels at volume

**Norbert's review reaches the founder. It never reaches the agent he reviewed.**

What happened. Bernard recommended swapping the contest ad set's exclusion from `nature photo contest users` to `Applicants and Bookers`. Norbert reviewed it, found it wrong, and amended it to additive: keep the existing exclusion, add both. That amendment went to the founder and was adopted. **Nobody told Bernard.** Hours later Bernard refused to stage the resulting batch, framing it as contradicting something he believed had been settled. It had been settled, against him, and he did not know.

Why it matters more than it looks. From the founder's side this is indistinguishable from an agent being stubborn or off-doctrine. It cost an arbitration round, a Slack escalation, and a fair amount of the founder's confidence in the supervision layer, all for a disagreement that had already been resolved. At any volume this becomes the dominant failure mode, because it manufactures conflict out of nothing.

Why the design did not catch it. v1 §4 says Norbert's findings ride with the approval item, and they do. But the approval item is a **founder-facing** surface. There is no agent-facing return path at all, so a reviewed agent has no way to learn that its proposal was amended, or why.

What to build. A return leg on `NORBERT_review`: when Norbert amends or rejects a proposal, the verdict and its reason are written back to the proposing agent's memory or conversation, not only forward to the founder. The one-revision-round mechanic in v1 §1 already assumes a channel back to Bernard, so this may be less new machinery than it looks; check whether that round is actually wired or only specified. Related, and part of the same fix: a rejected proposal should leave a counterfactual the agent can see, not only one the ledger can.

---

## 2. The relay is lossy, and one failure mode is silent

Three distinct problems, all hit during this session, all affecting any Code session that reaches the agents.

**Long replies truncate server-side.** Bernard's full account audit came back cut mid-word. Oscar's launch review came back cut mid-sentence. Oscar's stored turn was truncated identically, so the loss is server-side rather than in the shell pipe. Redirecting output to a file rather than piping through `tail` is the only way to see it, since a truncated reply reads exactly like a complete one.

**Worse: a turn can execute and never persist.** Bernard ran a full live audit, replied, and on the next message had no record of the brief or of his own reply. It was absent from `--history` at any depth. **So the agent did the work, produced the analysis, and the knowledge landed nowhere.** Re-sending the identical brief worked. This is the failure that matters most, because the relay's entire purpose is to deposit knowledge in the agent's memory, and here it silently did the opposite.

**Oscar's default scope bleeds between clients.** A Steffen reply arrived with a large block of German RSA copy for an unrelated client appended to it. Cause is the agency-wide `command-center` scope. Fix is `--scope <client-uuid>`, which was tested and returns clean. Two caveats for the build: it needs a portal client record to exist, and the channel file for this client wrongly recorded that none did, so the fix was available for weeks and nobody used it. Bernard has no equivalent scope flag at all.

What to build. Chunked or streamed relay responses with an explicit completion marker, so a truncated reply is detectable rather than plausible. Persist the turn before generating the reply, so a dropped connection cannot lose the record of what was asked. A scope flag for Bernard matching Oscar's.

---

## 3. Tooling gaps that blocked real decisions this week

Every one of these stopped a decision that had to be made, and each was resolved by the founder opening the UI, which is the thing the agent operation exists to avoid. Prioritise by how often each recurred.

| Gap | What it blocked |
|---|---|
| Bernard cannot read custom audience **membership or match rate** | The entire exclusion incident. Four ad sets carried an exclusion that may match nobody, and nothing was checking. This is now partly mitigated by the v1.1 §4 gate |
| Bernard has **no placement breakdown** (spend or results by placement) | The Advantage+ versus Manual decision on Audience Network. Cannot be approximated, has to come from Ads Manager |
| Bernard cannot see **per-ad media composition** | Whether the widescreen video had a second vertical asset added, which was the agreed fix for letterboxing |
| Bernard cannot print **interest or detailed-targeting lists** | Whether two prospecting campaigns were genuine duplicates. Took three rounds with a freelancer and was never settled from our side |
| Oscar's account report **lags roughly three days** | Twice returned a window ending before the event being investigated, once for the 12 August conversion test and once for the launch itself. A zero in a stale window reads exactly like a zero in a live one |
| Oscar cannot see **conversion action config, campaign goal settings, asset-level attachment, or disapproval status** | The credential sweep, the Competitor copy check, the Demand Gen goal gate, and the counting-type fix. Four separate launch blockers, all closed by the founder in the UI |

The Oscar reporting lag is the cheapest and highest-value of these, because it silently produces confident wrong answers rather than refusals.

---

## 4. Where the grammar fights incident response

v1 was designed for optimisation, and it shows the moment something is urgent.

**The exclusion incident needed six moves across five ad sets.** The daily ceiling is three executed per account, and the grammar allows one `audience_exclude` per ad set per run. That is three runs across at least two days, for a live client escalation where paying customers were seeing ads.

The gates are individually right. The ceiling stops thrash, and one-per-ad-set-per-run stops a move being done badly in halves. But together they impose an optimisation cadence on incident work, and the founder will route around them by hand the first time it costs him a client conversation. Worth a deliberate decision rather than discovering it: either an incident mode with a raised ceiling and its own audit trail, or an explicit ruling that incidents are hand work and the agents do not attempt them.

**The reversal definition discourages provisional moves.** Per v1 §5, any action returning an entity to its pre-move state within 14 days counts as a reversal against the graduation bar, whoever performs it. That is correct for optimisation, where a reversal means the move was wrong. It is perverse for insurance moves: an exclusion added defensively and tidied up a fortnight later burns the bar despite nothing having gone wrong. During this session it was a live consideration in deciding whether to add a marginal exclusion at all, which means the bar is already shaping the work rather than just measuring it.

---

## 5. The agent behaviour pattern worth encoding

**Both agents assert platform behaviour more confidently than their tooling supports, and both correct themselves reliably when asked to test rather than restate. Neither does it spontaneously.**

Three instances. Bernard stated that `canServe: false` does not affect exclusions; asked to test rather than restate it, he said honestly he could not prove it without a live serving test and explained why it did not change the decision. Bernard confirmed my reading that a screenshot showed an available placement control; asked to re-examine rather than defend, he found the control was locked because the ad carried one asset, and corrected both of us. Oscar inferred that Qualified Lead sat downstream of Call Booked purely from the names, picked the wrong Demand Gen goal, and flagged the assumption himself, which is the only reason it was caught before it was set.

Credit where it is due: **Oscar refused to certify the credential sweep from a partial ad sample**, and stated plainly that absence in a partial read is not clearance. That is exactly the standing rule working, unprompted, on the item where being wrong would have been worst.

What to build. The prompt already carries the never-assert-absence rule and it demonstrably fires. Extend it: where an agent's answer rests on inference from naming, structure or a partial sample rather than a direct read, it should say so in the answer itself, the way Oscar did voluntarily and Bernard did only when pushed.

---

## 6. What worked, so it does not get redesigned

Norbert holds no approval authority, was asked to coordinate a fix, and correctly declined to dispatch Bernard without the founder's word. He also caught a hole in this session's own reasoning that neither Bernard nor I had seen, namely that nobody had verified the retention window on the exclusion we were assuming worked. The supervision layer earned its place on its first real use.

The per-move rather than per-batch approval shape held up under pressure, including pressure from the founder to move faster.

The v1.1 §4 match-quality gate exists because of this incident and would have caught it. That is the loop closing correctly.

---

## 7. One-line asks

1. Return leg from Norbert to the reviewed agent. Highest priority.
2. Detectable relay truncation, and persist the turn before replying.
3. Fix Oscar's reporting lag, or make it self-declaring in every response.
4. Scope flag for Bernard.
5. Founder ruling on incident mode versus hands-off for escalations.
6. Founder ruling on whether defensive moves are exempt from the reversal count.

# A claims gate for client-facing documents

**Risk brief 2026-08-05, item 1.3.** Written 2026-08-18. Design note, nothing built.

Six client-facing audits have shipped in the founder's first-person voice, asserting facts about a client's own business. The Instagram zero-post incident proved the failure reaches clients. The absence rule exists and is good, but **it is a rule, not a gate**, and the ad claims register discipline has no equivalent here.

---

## 1. The bug is visible in the type signature

`AuditFindings` in `src/lib/audit/extract.ts` carries this:

```ts
assets: { present: string[]; missing: string[] };
```

**`missing` is an absence claim represented as a bare string.** There is nowhere in that type to record how the absence was determined, when, from which endpoint, or whether the probe was even permitted to see the thing it reported gone. A permission error and a genuine absence produce identical strings.

That is the Instagram error, in the schema, before anyone writes a word.

The wider shape is the same: `AuditFindings` is a flat bag of numbers with **no per-fact provenance anywhere**. There is a document-level `preparedDate` and a reporting `window`, which say when the report was made, not when any individual fact was read or from where.

A grep for `read_at`, `readAt`, `provenance`, `fetched_at` or `source:` across the audit modules returns nothing.

## 2. The cheapest version that would have caught it

Make absence a typed thing that has to earn its way into a document, instead of a string that anyone can push.

```ts
type Probe = {
  source: string;      // 'graph:/{ig}/media', 'public:instagram.com/{handle}'
  readAt: string;      // ISO, per probe, not per document
  ok: boolean;
  error?: string;      // '#200 permission', '#100 invalid param'
};

type Absence = {
  item: string;
  probes: Probe[];
  publicSurfaceChecked: boolean;
};
```

And one function the generator must call before an absence can be rendered:

```ts
function absenceIsClaimable(a: Absence): boolean {
  // A permission error anywhere in the area disqualifies the whole area.
  if (a.probes.some(p => !p.ok && /permission|#200|#10\b/.test(p.error ?? ""))) return false;
  // Two independent successful probes, or the surface a real user sees.
  return a.publicSurfaceChecked || a.probes.filter(p => p.ok).length >= 2;
}
```

**That is the whole gate.** Everything else below is application of it.

Applied to the Instagram case: one Graph read returned an empty media edge, `publicSurfaceChecked` false, one successful probe. `absenceIsClaimable` returns false, the claim never reaches the document, and the audit instead says the account could not be verified. Perhaps thirty lines including the call sites.

## 3. Can it be enforced in the generator rather than in instructions?

**For the structured claims, yes, and that is the important half.** The generator builds the document from typed data. Numbers, campaign lists and the assets block come from code, not from the model. A gate in `generateAudit` is therefore structural: an ungated absence cannot be rendered because the renderer refuses it.

**For the model's prose, no, and pretending otherwise would be the same mistake as the report-shape row in the executor contract.** The narrative pass writes around the data and can assert an absence in a sentence nobody typed. Two mitigations, both partial and both worth having:

**Do not hand the model what it has not earned.** If an absence fails the gate, it should not appear in the model's context at all, even as "unverified". A model given a fact and told not to use it will sometimes use it.

**Scan the output.** A post-generation pass over the rendered prose for absence language ("there is no", "none of", "has never", "is missing", "does not have") that cross-references the gated claim set, and flags rather than ships. This is a lint, not a proof, and it should be described as such.

## 4. Fail or flag?

**Flag, and block the send.** Failing generation outright means an unrelated missing probe destroys a whole audit and someone ships the previous draft instead, which is worse. The document should generate with the claim removed and a visible note naming what could not be established, and the send path should refuse while any flag is open.

The distinction matters because the failure mode being designed against is not a broken document, it is **a confident one**.

## 5. What this shares with the WhatsApp claims register

The register from 6 August is the working prototype of exactly this: approved claims, banned claims, a mandatory caveat, and labelling per lead so coverage is measurable rather than asserted. It has governed every WhatsApp document since and has held.

Two things transfer:

**Per-item labelling beats a document-level disclaimer.** The register labels each lead exact, window or unattributed. The audit equivalent is per-claim provenance, not a paragraph at the front saying data may be incomplete.

**The register works because it is a list someone can check against**, not a principle. That is the argument for the typed `Absence` over a rule in a prompt.

## 6. Scope, honestly

This covers the generated audits. It does **not** cover documents written by a session in chat, which is most of what actually reaches clients, including everything produced this month. Those are governed by the standing rules and by whoever is reading.

Extending the gate there is not a code problem and I would not pretend a generator gate solves it. The realistic version is the register pattern: a short per-client claims list that a session checks a draft against before it goes out.

## 7. Recommendation

1. **Add the `Absence` type and `absenceIsClaimable`**, and route the `assets.missing` path through it. Small, and it closes the incident that prompted this.
2. **Add per-fact `readAt` and `source`** to the findings that become client-facing assertions. Larger, and it is the thing that cannot be retrofitted once documents are out.
3. **Add the prose lint**, described as a lint.
4. **Do not build a general claims framework.** The register works because it is small and specific.

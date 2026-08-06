# Brief: prompt caching on the chat agents

Written 2026-08-06 from the WMI implementation (commit `e0aa589`). Apply this to
any deployment of the platform whose agent code predates that commit.

## Before you start: you may not need this

The app is one repo deployed once per entity. If the target deploys from the
same repo and branch, `e0aa589` is already in its code and a redeploy is the
whole job. Check first:

```bash
git log --oneline --all | grep -i "prompt caching"
```

Only proceed if the agent files genuinely lack `cache_control`.

## Why this matters more than it looks

Both chat agents run a tool loop of up to **8 iterations per user message**, and
every iteration re-sends the entire prefix: tool definitions, system brief,
rendered memory block, and the whole conversation window so far.

Measured on Bernard before the change:

| Prefix component | Size |
|---|---|
| 15 tool definitions | ~4,000 tokens |
| System brief | ~1,900 tokens |
| Memory block | varies, ~2-4k at 30+ memories |
| Conversation | up to 40 turns |

So roughly 8,000 tokens of stable prefix were being paid for at full price up to
eight times for a single message, before counting the transcript. On a busy day
that is the dominant cost, and it is entirely independent of which model is
running. **Do the caching before evaluating any model swap**, or you will be
measuring the wrong thing.

## The change

### 1. System prompt becomes two cache-separated blocks

The brief is constant, so it caches together with the tool definitions that
precede it in the prefix. The memory block changes whenever the agent writes a
memory, so it gets its own breakpoint: a memory write then invalidates only the
second block and the brief still reads back cheap.

Replace the string-returning `buildSystem` with:

```ts
function buildSystem(memoryBlock: string): Anthropic.Beta.BetaTextBlockParam[] {
  return [
    { type: "text", text: SYSTEM_BASE, cache_control: { type: "ephemeral" } },
    {
      type: "text",
      text: `=== MEMORY (yours, written by you, persists across all sessions) ===\n${memoryBlock}\n=== END MEMORY ===`,
      cache_control: { type: "ephemeral" },
    },
  ];
}
```

Where a caller appends per-request context (the Google agent appends a
`focusNote` for the client currently in view), that must go **after** the
breakpoint as its own uncached block, not concatenated into the brief:

```ts
function buildSystem(memoryBlock: string, focus = ""): Anthropic.TextBlockParam[] {
  const blocks: Anthropic.TextBlockParam[] = [ /* as above */ ];
  if (focus) blocks.push({ type: "text", text: focus });
  return blocks;
}
```

Update the call sites, which previously did string concatenation:

```ts
// before
const system = buildSystem(renderMemories(...)) + focusNote(ctx.roster, focusClientId);
// after
const system = buildSystem(renderMemories(...), focusNote(ctx.roster, focusClientId));
```

Tools need no marker of their own. They sit ahead of the system prompt in the
cacheable prefix, so the breakpoint on the brief already covers them.

### 2. A moving breakpoint at the tail of the transcript

This is the one that pays for the loop. Each iteration appends the assistant
turn and its tool results, so without it every iteration re-pays for everything
the previous ones sent.

```ts
/**
 * Move the conversation cache breakpoint to the tail of the transcript. Old
 * markers are cleared first: the API caps breakpoints at four and the two
 * system blocks already hold two.
 */
function markConversationCache(messages: Anthropic.MessageParam[]): void {
  const asRecords = (c: unknown) => c as unknown as Record<string, unknown>[];
  for (const m of messages) {
    if (typeof m.content === "string") continue;
    for (const block of asRecords(m.content)) {
      if (block && typeof block === "object") delete block.cache_control;
    }
  }
  const last = messages[messages.length - 1];
  if (!last) return;
  if (typeof last.content === "string") {
    last.content = [
      { type: "text", text: last.content, cache_control: { type: "ephemeral" } },
    ];
    return;
  }
  const blocks = asRecords(last.content);
  const tail = blocks[blocks.length - 1];
  if (tail && typeof tail === "object") tail.cache_control = { type: "ephemeral" };
}
```

Call it as the first statement inside each loop, before the API call:

```ts
for (let i = 0; i < 8; i++) {
  markConversationCache(messages);
  const stream = client.beta.messages.stream({ ... });
```

**Check for more than one loop.** The Google agent has two, a streaming path and
a non-streaming one, and it is easy to patch only the one you were reading.

### 3. Weekly report narratives

Each weekly cron makes one call per account against an identical brief, so the
first account pays the cache write and every account after it reads back at a
tenth. Worth doing on any deployment with more than two or three clients.

```ts
system: [
  { type: "text", text: SYSTEM(brand, period), cache_control: { type: "ephemeral" } },
  ...(guidance ? [{ type: "text" as const, text: guidance }] : []),
],
```

Per-account guidance goes after the breakpoint because it differs every call.

## What NOT to cache

**The audit generators.** They are one-off calls, so there is no second read to
recover the cost, and a cache write is charged at 1.25x. Caching them makes them
slightly more expensive, not less. Cache only where the same prefix repeats
within the cache window: agent loops, and per-account loops in a cron.

## Gotchas that cost time here

**Do not edit these files with PowerShell regex rewrites.** A
`Get-Content -Raw | ... | Set-Content -Encoding utf8` round trip re-encoded the
files and turned every em dash into mojibake. Use an editor that preserves
encoding, and verify afterwards:

```powershell
$c = Get-Content <file> -Raw -Encoding UTF8; if ($c -match 'â€') { "CORRUPTED" } else { "clean" }
```

**TypeScript will reject a direct cast** from `ContentBlockParam[]` to
`Record<string, unknown>[]`, because some union members lack an index
signature. Go through `unknown`, as the `asRecords` helper above does.

**Four breakpoints is the hard cap.** Two system blocks plus one moving
transcript marker leaves one spare. If you add another, clear one first.

## Verification

1. `npx tsc --noEmit` clean, ignoring any pre-existing unrelated errors.
2. Encoding check above on every file touched.
3. After deploy, send the agent a message that triggers two or three tools and
   confirm the reply is normal. Caching is transparent, so a behaviour change
   means something is wrong, most likely a breakpoint on content that varies.
4. Watch the daily cost for several days rather than expecting one number to
   prove it. The console reports cost by model, not by cache hit rate.

## Bundled fix worth carrying across

Oscar's `max_tokens` was 2000 on **both** the streaming and non-streaming paths,
tight enough to truncate a long analysis mid-sentence. Raised to 8000. Bernard's
was 8000 and is now 32000, because a build spec is emitted verbatim inside a
tool call and a placement-customised creative alone runs to about 4k tokens of
JSON; at 8000 the tool argument truncated mid-emit and the receiving tool got an
empty array with no error to explain it.

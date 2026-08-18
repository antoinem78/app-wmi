// Agent run metering. The economics ledger (2026-08-18) found the two always-on
// agents recorded no model, token or cost data anywhere, and none of it can be
// backfilled. This is the fix: each agent run logs one row, fire-and-forget,
// because metering must never be able to fail a reply that succeeded.
import { createSupabaseAdminClient } from "@/lib/supabase/server";

// List rates, USD per million tokens, keyed by model-id prefix. Longest prefix
// wins. Unknown models log with cost 0 rather than a guess, and the model name
// makes the gap visible in the ledger instead of silently wrong.
const RATES: [prefix: string, inPerM: number, outPerM: number][] = [
  ["claude-fable-5", 10, 50],
  ["claude-opus-4", 5, 25],
  ["claude-sonnet-5", 3, 15],
  ["claude-sonnet-4", 3, 15],
  ["claude-haiku-4", 1, 5],
];

export function costUsd(model: string, tokensIn: number, tokensOut: number): number {
  const hit = RATES.filter(([p]) => model.startsWith(p)).sort((a, b) => b[0].length - a[0].length)[0];
  if (!hit) return 0;
  return (tokensIn * hit[1] + tokensOut * hit[2]) / 1e6;
}

export interface RunUsage {
  model: string;
  turns: number;
  tokensIn: number;
  tokensOut: number;
}

export async function logAgentUsage(
  agent: string,
  scope: string | null,
  clientId: string | null,
  u: RunUsage,
): Promise<void> {
  if (!u.tokensIn && !u.tokensOut) return;
  try {
    await createSupabaseAdminClient().from("agent_usage").insert({
      agent,
      scope,
      client_id: clientId,
      model: u.model,
      turns: u.turns,
      tokens_in: u.tokensIn,
      tokens_out: u.tokensOut,
      cost_usd: costUsd(u.model, u.tokensIn, u.tokensOut).toFixed(6),
    });
  } catch {
    /* metering is best-effort by design */
  }
}

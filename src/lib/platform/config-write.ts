// Console → agent config write path (Step 5). The console NEVER writes the
// substrate directly: it calls the token-authed n8n webhook, which enforces the
// allowlist and writes config + audit atomically. This module is the thin
// server-side client for that webhook.
//
// Requires env: SUBSTRATE_CONFIG_WRITE_URL (the webhook URL) and
// CONSOLE_CONFIG_KEY (the x-console-key value, from the n8n credential).

export type ConfigWriteAction = "dryRun" | "apply" | "reingest_kb";

export interface ConfigWriteInput {
  engineBClientId: string;
  key?: string;
  value?: unknown;
  action: ConfigWriteAction;
  actor: string; // Auth0 email of the admin making the change
}

export interface ConfigWriteResult {
  ok?: boolean;
  error?: string;
  old?: unknown;      // dryRun + apply return the previous value
  updated?: string;   // apply
  audited?: string;   // apply
}

export async function writeAgentConfig(input: ConfigWriteInput): Promise<ConfigWriteResult> {
  const url = process.env.SUBSTRATE_CONFIG_WRITE_URL;
  const key = process.env.CONSOLE_CONFIG_KEY;
  if (!url || !key) {
    return { ok: false, error: "Config-write path not configured (SUBSTRATE_CONFIG_WRITE_URL / CONSOLE_CONFIG_KEY)." };
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-console-key": key },
      body: JSON.stringify({
        action: input.action,
        engine_b_client_id: input.engineBClientId,
        key: input.key,
        value: input.value,
        actor: input.actor,
      }),
    });
    if (res.status === 403) return { ok: false, error: "Write path rejected the credential." };
    return (await res.json()) as ConfigWriteResult;
  } catch (e) {
    return { ok: false, error: `Config write failed: ${String(e)}` };
  }
}

// Bernard (the Meta Lab supervisor operator) lives in the substrate; the portal
// talks to him through his authenticated n8n endpoints — the same one-audited-
// access-plane pattern as OCT. No direct substrate DB access from here (the
// pg-based read spine stays on the platform branch until the lockfile lands).
// Server-side only: the key never reaches the client.

const BASE =
  process.env.SUBSTRATE_WEBHOOK_BASE ?? "https://singularweb.app.n8n.cloud/webhook";

function key(): string | null {
  return process.env.BERNARD_WEBHOOK_KEY ?? null;
}

export function bernardConfigured(): boolean {
  return key() !== null;
}

async function call(
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<unknown> {
  const k = key();
  if (!k) throw new Error("Bernard link is not configured (BERNARD_WEBHOOK_KEY missing).");
  const res = await fetch(`${BASE}/${path}`, {
    method: init?.method ?? "GET",
    headers: {
      "x-bernard-key": k,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Bernard endpoint ${path} answered ${res.status}`);
  return res.json();
}

export interface BernardClient {
  slug: string;
  name: string;
  enabled: boolean;
  stand_down: boolean;
  kill_switch: boolean;
  doctrine: string;
  skill_installed: boolean;
  accounts: string[];
  monitors: number;
}
export interface BernardFix {
  task_id: string;
  client: string;
  summary: string;
  reason: string;
  proposed_at: string;
}
export interface BernardStatus {
  clients: BernardClient[];
  pending_fixes: BernardFix[];
  activity: { step: string; at: string; detail: string }[];
  credits: { periodic: number; monthly: number } | null;
  generated_at: string;
}

export async function getBernardStatus(): Promise<BernardStatus> {
  return (await call("bernard-status")) as BernardStatus;
}

export async function decideFix(
  taskId: string,
  decision: "approve" | "reject",
  actor: string,
): Promise<unknown> {
  return call("bernard-fix-approve", {
    method: "POST",
    body: { task_id: taskId, decision, actor },
  });
}

export async function standDown(clientSlug: string, reason: string, actor: string): Promise<unknown> {
  return call("bernard-standdown", {
    method: "POST",
    body: { client_slug: clientSlug, reason, actor },
  });
}

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

// ---- Build dispatch (founder-gated in chat; machine-gated in the substrate) ----
// BERNARD_build enforces everything that matters in code: every entity created
// PAUSED, gate holds pre-flight, write budget, account allow-list, idempotency
// by build_ref. Dispatching from chat is therefore the same trust model as
// decide_fix: the founder's word in chat is the trigger, the substrate is the
// gate. The response is the builder's own verified report (it reads back every
// entity it claims to have created before answering).
export interface BuildDispatch {
  client_slug: string;
  account_id: string;
  build_ref: string;
  gate_conditions?: { id: string; check: string; state: "met" | "unmet" }[];
  campaigns: unknown[];
}
export async function dispatchBuild(spec: BuildDispatch): Promise<unknown> {
  return call("bernard-build", { method: "POST", body: spec });
}

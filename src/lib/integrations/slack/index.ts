// Slack integration seam — Phase 3 (client channel + guest invite).
//
// Degrades gracefully: when SLACK_BOT_TOKEN is unset (or a call fails), the
// wizard still records the client's preferred email and moves on — the
// activity log tells the ops team to provision manually. Automation level
// depends on the workspace plan: channel creation + inviting EXISTING members
// works everywhere; inviting a brand-new external guest is restricted by
// Slack's API on most plans, so that case becomes an ops task.

const API = "https://slack.com/api";

export function isSlackConfigured(): boolean {
  return !!process.env.SLACK_BOT_TOKEN;
}

async function slack<T extends { ok: boolean; error?: string }>(
  method: string,
  body: Record<string, unknown>,
  attempt = 0,
): Promise<T> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) throw new Error("Slack is not configured (SLACK_BOT_TOKEN missing).");
  const res = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  });
  // chat.postMessage is rate-limited per channel; under concurrency we can hit
  // 429. Respect Retry-After and retry a few times rather than dropping a post.
  if (res.status === 429 && attempt < 4) {
    const retryAfter = Number(res.headers.get("retry-after") ?? "1");
    await new Promise((r) => setTimeout(r, (retryAfter + 0.5) * 1000));
    return slack<T>(method, body, attempt + 1);
  }
  const data = (await res.json()) as T;
  if (!data.ok) throw new Error(`Slack ${method} failed: ${data.error}`);
  return data;
}

/** company name → #client-acme-inc style channel name (Slack rules: ≤80, a-z0-9-_) */
export function channelNameFor(companyName: string): string {
  const slug = companyName
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
  return `client-${slug || "unnamed"}`;
}

/** Create the client channel (or reuse it if it already exists). Returns channel id. */
export async function createClientChannel(companyName: string): Promise<string> {
  const name = channelNameFor(companyName);
  try {
    // Private by default: a client in the workspace should see their channel
    // and nothing else. Falls back to public when the bot lacks groups:write
    // (older app installs), so provisioning never breaks on a scope.
    try {
      const created = await slack<{ ok: boolean; channel: { id: string } }>(
        "conversations.create",
        { name, is_private: true },
      );
      return created.channel.id;
    } catch (e) {
      if (!(e instanceof Error && e.message.includes("missing_scope"))) throw e;
      const created = await slack<{ ok: boolean; channel: { id: string } }>(
        "conversations.create",
        { name },
      );
      return created.channel.id;
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("name_taken")) {
      // Already exists — find it.
      const token = process.env.SLACK_BOT_TOKEN;
      const res = await fetch(
        `${API}/conversations.list?limit=1000&types=public_channel,private_channel`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const data = (await res.json()) as {
        ok: boolean;
        channels?: Array<{ id: string; name: string }>;
      };
      const found = data.channels?.find((c) => c.name === name);
      if (found) return found.id;
    }
    throw e;
  }
}

/**
 * Try to invite the email's user to the channel. Only works when that email
 * already belongs to a workspace member/guest; otherwise returns
 * "manual-invite-needed" so the ops team finishes it (guest invites for brand
 * new external users aren't available via API on most plans).
 */
/** users.lookupByEmail only accepts the email as a query parameter. */
async function lookupUserId(email: string): Promise<string | null> {
  const token = process.env.SLACK_BOT_TOKEN;
  const res = await fetch(
    `${API}/users.lookupByEmail?email=${encodeURIComponent(email)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const data = (await res.json()) as {
    ok: boolean;
    user?: { id: string };
  };
  return data.ok && data.user ? data.user.id : null;
}

export async function tryInviteByEmail(
  channelId: string,
  email: string,
): Promise<"invited" | "manual-invite-needed"> {
  try {
    const userId = await lookupUserId(email);
    if (!userId) return "manual-invite-needed";
    await slack("conversations.invite", { channel: channelId, users: userId });
    return "invited";
  } catch (e) {
    // Already in the channel = effectively invited.
    if (e instanceof Error && e.message.includes("already_in_channel")) {
      return "invited";
    }
    return "manual-invite-needed";
  }
}

/**
 * Add the WMI team to a client channel (emails from SLACK_TEAM_EMAILS,
 * comma-separated). Per-member failures don't break provisioning.
 */
export async function inviteTeam(
  channelId: string,
): Promise<{ invited: string[]; notFound: string[] }> {
  const emails = (process.env.SLACK_TEAM_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  const invited: string[] = [];
  const notFound: string[] = [];
  const ids: string[] = [];

  for (const email of emails) {
    const id = await lookupUserId(email);
    if (id) {
      ids.push(id);
      invited.push(email);
    } else {
      notFound.push(email);
    }
  }
  if (ids.length) {
    try {
      await slack("conversations.invite", {
        channel: channelId,
        users: ids.join(","),
      });
    } catch (e) {
      // Some members may already be in the channel — not a failure.
      if (!(e instanceof Error && e.message.includes("already_in_channel"))) {
        throw e;
      }
    }
  }
  return { invited, notFound };
}

/** Drop a note in the channel (e.g. flag a manual guest invite for the team). */
export async function postMessage(channelId: string, text: string): Promise<void> {
  await slack("chat.postMessage", { channel: channelId, text });
}

/**
 * Upload a file into a channel (report workbooks for people without portal
 * access, 2026-09-05). Slack's external-upload three-step: get a URL, PUT the
 * bytes, complete-and-share. Needs the files:write bot scope; without it the
 * first step returns missing_scope and the caller should fall back to a link
 * rather than fail the message.
 */
export async function uploadFile(
  channelId: string,
  filename: string,
  buffer: Buffer,
  title?: string,
): Promise<{ ok: true } | { error: string }> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return { error: "Slack is not configured (SLACK_BOT_TOKEN missing)." };
  try {
    const urlRes = await fetch(`${API}/files.getUploadURLExternal`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ filename, length: String(buffer.length) }),
    });
    const urlData = (await urlRes.json()) as { ok: boolean; error?: string; upload_url?: string; file_id?: string };
    if (!urlData.ok || !urlData.upload_url || !urlData.file_id) {
      return { error: `files.getUploadURLExternal: ${urlData.error ?? "no upload url"}` };
    }
    const put = await fetch(urlData.upload_url, { method: "POST", body: new Uint8Array(buffer) });
    if (!put.ok) return { error: `upload transfer failed: HTTP ${put.status}` };
    const done = await fetch(`${API}/files.completeUploadExternal`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ files: [{ id: urlData.file_id, title: title ?? filename }], channel_id: channelId }),
    });
    const doneData = (await done.json()) as { ok: boolean; error?: string };
    if (!doneData.ok) return { error: `files.completeUploadExternal: ${doneData.error}` };
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

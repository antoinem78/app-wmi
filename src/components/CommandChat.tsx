"use client";

// Oscar chat panel: the senior paid search strategist. Talks to /api/agent/chat.
// Oscar is an agent inside Rexos, not Rexos itself; Rexos is the platform.
// (read-only tool-use agent). Proposes optimisations; never executes.
// The conversation is persisted server-side per `scope` (parity P2), so it
// reloads across page navigation and reloads.
import { useEffect, useRef, useState } from "react";
import { ACCEPT_ATTR, MAX_FILES } from "@/lib/attachment-limits";

interface Msg { role: "user" | "assistant"; content: string }
interface Artifact { href: string; label: string }

// Oscar hands out download paths (the Google Ads audit) — make them clickable.
function renderWithLinks(text: string) {
  const parts = text.split(/(https?:\/\/[^\s)]+|\/api\/[^\s)]+)/g);
  return parts.map((p, i) =>
    /^(https?:\/\/|\/api\/)/.test(p) ? (
      <a
        key={i}
        href={p}
        target="_blank"
        rel="noreferrer"
        className="font-medium underline decoration-dotted underline-offset-2"
      >
        {p}
      </a>
    ) : (
      p
    ),
  );
}

const SUGGESTIONS = [
  "Where am I wasting budget? Propose fixes",
  "Recommend budget reallocation across accounts",
  "Find a campaign worth pausing and propose it",
  "Which accounts need attention this week and why?",
  "Suggest RSA improvements for ",
];

export interface ChatAccount {
  clientId: string;
  company: string;
}

export function CommandChat({
  scope = "command-center",
  heightClass = "h-[calc(100vh-7rem)]",
  accounts,
  onScopeChange,
}: {
  scope?: string;
  heightClass?: string;
  /** When provided, renders an account selector in the header. */
  accounts?: ChatAccount[];
  onScopeChange?: (scope: string) => void;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [pending, setPending] = useState<File[]>([]); // files staged for the next send
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Committed-state mirror. send() reads this instead of the render closure's
  // `messages`, which can be stale and silently drop the previous reply.
  const messagesRef = useRef<Msg[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  const scrollSoon = () =>
    requestAnimationFrame(() => scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight));

  // Load prior turns for this scope on mount (persistence / cross-page memory).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/agent/chat?scope=${encodeURIComponent(scope)}`);
        if (res.ok) {
          const data = (await res.json()) as { messages?: Msg[] };
          if (!cancelled && Array.isArray(data.messages) && data.messages.length) {
            // Apply only to an empty transcript: a slow hydration response
            // must never clobber a conversation already under way.
            setMessages((m) => (m.length ? m : data.messages!));
            scrollSoon();
          }
        }
      } catch {
        /* memory is best-effort */
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scope]);

  async function clearChat() {
    setMessages([]);
    setArtifacts([]);
    try {
      await fetch(`/api/agent/chat?scope=${encodeURIComponent(scope)}`, { method: "DELETE" });
    } catch {
      /* best-effort */
    }
  }

  function addFiles(list: FileList | null) {
    // Copy eagerly. A FileList is live-bound to its input element, so resetting
    // the input's value (which we do straight after, to allow re-picking the
    // same file) empties it. Reading it inside the setState updater, which React
    // defers, would mean the files had already vanished by the time it ran.
    const incoming = list ? Array.from(list) : [];
    if (!incoming.length) return;
    const room = Math.max(0, MAX_FILES - pending.length);
    setError(incoming.length > room ? `Oscar takes up to ${MAX_FILES} files at a time.` : null);
    if (!room) return;
    setPending((p) => [...p, ...incoming.slice(0, room)]);
  }

  async function send(text: string) {
    const content = text.trim();
    // A file on its own is a valid turn; give Oscar a default instruction.
    if ((!content && pending.length === 0) || loading) return;
    const files = pending;
    const shown =
      content ||
      (files.length === 1
        ? "Read this and tell me what you make of it."
        : "Read these and tell me what you make of them.");
    setError(null);
    const label = files.length
      ? `${shown}\n\n${files.map((f) => `[attached ${f.name}]`).join("\n")}`
      : shown;
    const base = messagesRef.current;
    const next = [...base, { role: "user" as const, content: label }];
    setMessages(next);
    setInput("");
    setPending([]);
    setLoading(true);
    setStatus(null);
    scrollSoon();
    try {
      // History always carries the plain text; files ride as multipart parts.
      const history = [...base, { role: "user" as const, content: shown }];
      let res: Response;
      if (files.length) {
        const form = new FormData();
        form.set("messages", JSON.stringify({ messages: history, scope }));
        form.set("scope", scope);
        for (const f of files) form.append("files", f);
        res = await fetch("/api/agent/chat", { method: "POST", body: form });
      } else {
        res = await fetch("/api/agent/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history, scope }),
        });
      }
      if (!res.ok || !res.body) {
        let msg = "Request failed";
        try { msg = (await res.json())?.error ?? msg; } catch { /* non-JSON */ }
        throw new Error(msg);
      }
      // Placeholder assistant bubble that fills as deltas stream in.
      // Placeholder bubble pinned by index so delta/reset can only touch THIS
      // request's bubble, never a finished reply that happens to sit last.
      const phIndex = next.length;
      setMessages((m) => {
        const copy = m.slice();
        copy[phIndex] = { role: "assistant", content: "" };
        return copy;
      });
      const appendDelta = (t: string) =>
        setMessages((m) => {
          if (m[phIndex]?.role !== "assistant") return m;
          const copy = m.slice();
          copy[phIndex] = { ...copy[phIndex], content: copy[phIndex].content + t };
          return copy;
        });
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          let ev: { type: string; text?: string; label?: string };
          try { ev = JSON.parse(line); } catch { continue; }
          if (ev.type === "delta" && ev.text) { setStatus(null); appendDelta(ev.text); scrollSoon(); }
          else if (ev.type === "status" && ev.text) { setStatus(ev.text); }
          else if (ev.type === "reset") {
            // clear preamble streamed during a tool-use turn
            setMessages((m) => {
              if (m[phIndex]?.role !== "assistant") return m;
              const copy = m.slice();
              copy[phIndex] = { ...copy[phIndex], content: "" };
              return copy;
            });
          }
          else if (ev.type === "artifact" && ev.text) {
            const href = ev.text;
            const label = ev.label ?? "Download";
            setArtifacts((a) => (a.some((x) => x.href === href) ? a : [...a, { href, label }]));
          }
          else if (ev.type === "error" && ev.text) { setError(ev.text); }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
      setStatus(null);
      scrollSoon();
    }
  }

  const last = messages[messages.length - 1];
  const streaming = !!last && last.role === "assistant" && last.content.length > 0;

  return (
    <div className={`flex ${heightClass} flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-zinc-100 bg-gradient-to-r from-[#0B1F3A] to-[#13315c] px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-sm font-semibold text-white">Oscar</span>
          {onScopeChange && accounts ? (
            <select
              value={scope}
              onChange={(e) => onScopeChange(e.target.value)}
              className="max-w-[13rem] truncate rounded-md border border-white/20 bg-white/10 px-2 py-1 text-xs text-white focus:outline-none"
              title="Focus account"
            >
              <option value="command-center" className="text-zinc-900">All accounts</option>
              {accounts.map((a) => (
                <option key={a.clientId} value={a.clientId} className="text-zinc-900">
                  {a.company}
                </option>
              ))}
            </select>
          ) : (
            <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-medium text-white/80">analyst · read-only</span>
          )}
        </div>
        {messages.length > 0 && (
          <button onClick={clearChat} className="shrink-0 text-[11px] text-white/60 hover:text-white">
            Clear
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 && hydrated && (
          <div className="text-sm text-zinc-500">
            <p className="font-medium text-zinc-700">Ask about your accounts.</p>
            <p className="mt-1 text-xs text-zinc-400">
              I read live figures across the book and can propose optimisations for your approval — I never touch a live account.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => (s.endsWith(" ") ? setInput(s) : send(s))}
                  className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-left text-xs text-zinc-600 hover:border-zinc-300 hover:bg-white"
                >
                  {s.trim()}{s.endsWith(" ") ? "…" : ""}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) =>
          m.role === "assistant" && !m.content ? null : (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm ${
                  m.role === "user"
                    ? "bg-[#0B1F3A] text-white"
                    : "border border-zinc-200 bg-zinc-50 text-zinc-800"
                }`}
              >
                {m.role === "assistant" ? renderWithLinks(m.content) : m.content}
              </div>
            </div>
          ),
        )}
        {loading && !streaming && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-sm text-zinc-400">
              {status ? (
                <span>{status}</span>
              ) : (
                <span className="inline-flex gap-1">
                  <Dot /> <Dot /> <Dot />
                </span>
              )}
            </div>
          </div>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>

      {/* Prepared downloads (the Google Ads audit) */}
      {artifacts.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-zinc-100 px-3 py-2">
          {artifacts.map((a) => (
            <a
              key={a.href}
              href={a.href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:border-[#0B1F3A] hover:text-[#0B1F3A]"
            >
              <DocIcon />
              {a.label}
            </a>
          ))}
        </div>
      )}

      {/* Composer */}
      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles(e.dataTransfer.files);
        }}
        className={`border-t p-3 ${dragging ? "border-[#0B1F3A] bg-zinc-50" : "border-zinc-100"}`}
      >
        {pending.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {pending.map((f, i) => (
              <span
                key={`${f.name}-${i}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-zinc-300 bg-white px-2.5 py-1 text-xs text-zinc-700"
              >
                <DocIcon />
                <span className="max-w-[16rem] truncate">{f.name}</span>
                <span className="text-zinc-400">{(f.size / 1000).toFixed(0)}KB</span>
                <button
                  type="button"
                  onClick={() => setPending((p) => p.filter((_, j) => j !== i))}
                  aria-label={`Remove ${f.name}`}
                  className="ml-0.5 text-zinc-400 hover:text-zinc-900"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <input
            ref={fileRef}
            type="file"
            multiple
            accept={ACCEPT_ATTR}
            className="hidden"
            onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={loading}
            title="Attach a PDF, Word document, Markdown or text file"
            aria-label="Attach a file"
            className="shrink-0 rounded-lg border border-zinc-300 px-2.5 py-2 text-zinc-600 hover:border-[#0B1F3A] hover:text-[#0B1F3A] disabled:opacity-40"
          >
            <ClipIcon />
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
            }}
            rows={1}
            placeholder={pending.length ? "Ask Oscar about the attached…" : "Ask about your accounts…"}
            className="max-h-32 flex-1 resize-none rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-[#0B1F3A] focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading || (!input.trim() && pending.length === 0)}
            className="shrink-0 rounded-lg bg-[#0B1F3A] px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}

function Dot() {
  return <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-400" />;
}

function ClipIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M21.4 11.05l-8.49 8.49a5 5 0 0 1-7.07-7.07l8.49-8.49a3 3 0 0 1 4.24 4.24l-8.48 8.49a1 1 0 0 1-1.42-1.42l7.79-7.78"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

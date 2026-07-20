"use client";

// Bernard chat panel — talk to the Meta Lab supervisor. Talks to
// /api/bernard/chat (Claude Fable 5, medium effort, governed n8n tools).
// Same streaming NDJSON contract and visual language as CommandChat; the
// conversation persists server-side under the "bernard" scope.
import { useEffect, useRef, useState } from "react";

interface Msg { role: "user" | "assistant"; content: string }
interface Artifact { href: string; label: string }

// Bernard hands out download paths (e.g. the Word audit) — make them clickable.
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
  "Give me the state of the lab",
  "Which ad accounts can you see?",
  "Anything waiting for my approval?",
  "What happened in the last 24 hours?",
];

export function BernardChat({
  heightClass = "h-[calc(100vh-7rem)]",
}: {
  heightClass?: string;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollSoon = () =>
    requestAnimationFrame(() => scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight));

  // Load prior turns on mount (persistence across reloads).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/bernard/chat");
        if (res.ok) {
          const data = (await res.json()) as { messages?: Msg[] };
          if (!cancelled && Array.isArray(data.messages) && data.messages.length) {
            setMessages(data.messages);
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
  }, []);

  async function clearChat() {
    setMessages([]);
    setArtifacts([]);
    try {
      await fetch("/api/bernard/chat", { method: "DELETE" });
    } catch {
      /* best-effort */
    }
  }

  async function send(text: string) {
    const content = text.trim();
    if (!content || loading) return;
    setError(null);
    const next = [...messages, { role: "user" as const, content }];
    setMessages(next);
    setInput("");
    setLoading(true);
    setStatus(null);
    scrollSoon();
    try {
      const res = await fetch("/api/bernard/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      if (!res.ok || !res.body) {
        let msg = "Request failed";
        try { msg = (await res.json())?.error ?? msg; } catch { /* non-JSON */ }
        throw new Error(msg);
      }
      // Placeholder assistant bubble that fills as deltas stream in.
      setMessages((m) => [...m, { role: "assistant", content: "" }]);
      const appendDelta = (t: string) =>
        setMessages((m) => {
          const copy = m.slice();
          const last = copy[copy.length - 1];
          if (last && last.role === "assistant") copy[copy.length - 1] = { ...last, content: last.content + t };
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
          else if (ev.type === "artifact" && ev.text) {
            const href = ev.text;
            const label = ev.label ?? "Download";
            setArtifacts((a) => (a.some((x) => x.href === href) ? a : [...a, { href, label }]));
          }
          else if (ev.type === "reset") {
            setMessages((m) => {
              const copy = m.slice();
              const li = copy.length - 1;
              if (copy[li]?.role === "assistant") copy[li] = { ...copy[li], content: "" };
              return copy;
            });
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
          <span className="text-sm font-semibold text-white">Bernard</span>
          <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-medium text-white/80">
            Meta Lab supervisor
          </span>
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
            <p className="font-medium text-zinc-700">Talk to Bernard.</p>
            <p className="mt-1 text-xs text-zinc-400">
              I read the lab live, audit any ad account the system user can see (with a Word
              document to download), record your approve/reject on proposed fixes and can stand a
              client down on your order. I never touch Meta outside the approved fix path.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-left text-xs text-zinc-600 hover:border-zinc-300 hover:bg-white"
                >
                  {s}
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

      {/* Deliverables — download chips for docs Bernard produced this session */}
      {artifacts.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-zinc-100 px-3 py-2">
          {artifacts.map((a) => (
            <a
              key={a.href}
              href={a.href}
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
        className="border-t border-zinc-100 p-3"
      >
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
            }}
            rows={1}
            placeholder="Ask Bernard…"
            className="max-h-32 flex-1 resize-none rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-[#0B1F3A] focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
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

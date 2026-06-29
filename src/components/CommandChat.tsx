"use client";

// Rexos chat panel — "ask about your accounts". Talks to /api/agent/chat
// (read-only tool-use agent). Proposes optimisations; never executes.
import { useRef, useState } from "react";

interface Msg { role: "user" | "assistant"; content: string }

const SUGGESTIONS = [
  "Where am I wasting budget? Propose fixes",
  "Recommend budget reallocation across accounts",
  "Find a campaign worth pausing and propose it",
  "Which accounts need attention this week and why?",
  "Suggest RSA improvements for ",
];

export function CommandChat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function send(text: string) {
    const content = text.trim();
    if (!content || loading) return;
    setError(null);
    const next = [...messages, { role: "user" as const, content }];
    setMessages(next);
    setInput("");
    setLoading(true);
    requestAnimationFrame(() => scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight));
    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Request failed");
      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
      requestAnimationFrame(() => scrollRef.current?.scrollTo(0, scrollRef.current!.scrollHeight));
    }
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-zinc-100 bg-gradient-to-r from-[#0B1F3A] to-[#13315c] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">Rexos</span>
          <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-medium text-white/80">analyst · read-only</span>
        </div>
        {messages.length > 0 && (
          <button onClick={() => setMessages([])} className="text-[11px] text-white/60 hover:text-white">
            Clear
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
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
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm ${
                m.role === "user"
                  ? "bg-[#0B1F3A] text-white"
                  : "border border-zinc-200 bg-zinc-50 text-zinc-800"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-sm text-zinc-400">
              <span className="inline-flex gap-1">
                <Dot /> <Dot /> <Dot />
              </span>
            </div>
          </div>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>

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
            placeholder="Ask about your accounts…"
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

"use client";

// Global Rexos analyst — a floating launcher + chat panel available on EVERY
// admin page. Carries an account selector (All accounts ↔ any client), and
// auto-focuses the account when you're on that client's page. Each account keeps
// its own persistent thread (scope), so switching accounts swaps conversations.
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { CommandChat, type ChatAccount } from "@/components/CommandChat";

const CLIENT_PATH = /^\/clients\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

export function RexosWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [accounts, setAccounts] = useState<ChatAccount[] | null>(null);
  const [scope, setScope] = useState("command-center");

  // Viewing a client page focuses the analyst on that account.
  useEffect(() => {
    const m = pathname?.match(CLIENT_PATH);
    if (m) setScope(m[1]);
  }, [pathname]);

  // Load the account list once, on first open.
  useEffect(() => {
    if (!open || accounts) return;
    (async () => {
      try {
        const res = await fetch("/api/agent/accounts");
        const data = res.ok ? await res.json() : { accounts: [] };
        setAccounts(Array.isArray(data.accounts) ? data.accounts : []);
      } catch {
        setAccounts([]);
      }
    })();
  }, [open, accounts]);

  // Bernard's page is Bernard's — the analyst launcher stays off it.
  if (pathname?.startsWith("/bernard")) return null;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-[#0B1F3A] px-4 py-3 text-sm font-medium text-white shadow-lg ring-1 ring-black/5 transition-opacity hover:opacity-90"
        aria-label="Ask Rexos"
      >
        <ChatIcon />
        Ask Rexos
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 w-[min(26rem,calc(100vw-2.5rem))]">
      <div className="relative">
        <button
          onClick={() => setOpen(false)}
          className="absolute -right-2 -top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white text-zinc-500 shadow ring-1 ring-zinc-200 transition-colors hover:text-zinc-900"
          aria-label="Close Rexos"
        >
          ✕
        </button>
        <CommandChat
          scope={scope}
          accounts={accounts ?? []}
          onScopeChange={setScope}
          heightClass="h-[min(38rem,calc(100vh-6rem))]"
        />
      </div>
    </div>
  );
}

function ChatIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M21 12a8 8 0 0 1-11.5 7.2L4 20l1-4.2A8 8 0 1 1 21 12Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

"use client";

// Generate a Google Ads audit .docx for a client and download it. Calls the
// admin-only /api/audit/[clientId] route (~2 min) and saves the returned file.
import { useState } from "react";

export function GenerateAuditButton({
  clientId,
  compact,
  kind = "ads",
}: {
  clientId: string;
  compact?: boolean;
  /** "ads" = full Google Ads audit; "feed" = Google Shopping & feed audit. */
  kind?: "ads" | "feed";
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const feed = kind === "feed";
  const endpoint = feed ? `/api/feed-audit/${clientId}` : `/api/audit/${clientId}`;
  const fallbackName = feed ? "Google Shopping Feed Audit.docx" : "Google Ads Audit.docx";

  async function go() {
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        let msg = "Generation failed";
        try { msg = (await res.json())?.error ?? msg; } catch { /* non-JSON */ }
        throw new Error(msg);
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") ?? "";
      const filename = /filename="?([^"]+)"?/.exec(cd)?.[1] ?? fallbackName;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const base = compact
    ? "rounded-md px-2.5 py-1 text-xs font-medium"
    : "rounded-md px-3.5 py-2 text-sm font-medium";
  const btn = (
    <button
      onClick={go}
      disabled={loading}
      title={feed ? "Generate a branded Google Shopping & feed audit (Word). Takes ~1-2 minutes." : "Generate a branded Google Ads audit (Word). Takes ~2 minutes."}
      className={`${base} border border-zinc-300 bg-white text-[#0B1F3A] hover:bg-zinc-50 disabled:opacity-50`}
    >
      {loading ? "Generating…" : compact ? (feed ? "Feed ↓" : "Audit ↓") : feed ? "Generate feed audit (Word)" : "Generate audit (Word)"}
    </button>
  );
  if (compact) {
    return (
      <span className="inline-flex items-center gap-2">
        {btn}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </span>
    );
  }
  return (
    <div>
      <div className="flex items-center gap-2">
        {btn}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
      {/* Native export path — the .docx exports to PDF and opens as a Google Doc
          with full fidelity, no extra tooling needed. */}
      <p className="mt-2 text-[11px] text-zinc-400">
        Downloads as Word (.docx). For a PDF, open it and use File → Save/Export as PDF.
        For a Google Doc, upload the file to Google Drive and open it — Drive converts it automatically.
      </p>
    </div>
  );
}

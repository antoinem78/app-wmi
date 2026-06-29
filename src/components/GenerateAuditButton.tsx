"use client";

// Generate a Google Ads audit .docx for a client and download it. Calls the
// admin-only /api/audit/[clientId] route (~2 min) and saves the returned file.
import { useState } from "react";

export function GenerateAuditButton({
  clientId,
  compact,
}: {
  clientId: string;
  compact?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/audit/${clientId}`, {
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
      const filename = /filename="?([^"]+)"?/.exec(cd)?.[1] ?? "Google Ads Audit.docx";
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
  return (
    <span className="inline-flex items-center gap-2">
      <button
        onClick={go}
        disabled={loading}
        title="Generate a branded Google Ads audit (Word). Takes ~2 minutes."
        className={`${base} border border-zinc-300 bg-white text-[#0B1F3A] hover:bg-zinc-50 disabled:opacity-50`}
      >
        {loading ? "Generating… (~2 min)" : compact ? "Audit ↓" : "Generate audit (Word)"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}

"use client";

// Dashboard timeframe control: preset windows (Week/7d/14d/30d/Month) plus a
// custom from–to picker. Navigates to `${basePath}?range=<key>`, which the
// server page parses via parseRange() and re-fetches. Rendered in the dark
// header band, so controls are styled for a navy background.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { RANGE_PRESETS } from "@/lib/integrations/google-ads/reporting";

export function RangeSelector({ basePath, active }: { basePath: string; active: string }) {
  const router = useRouter();
  const isCustom = active.startsWith("custom:");
  const [, cFrom, cTo] = isCustom ? active.split(":") : ["", "", ""];
  const [from, setFrom] = useState(cFrom ?? "");
  const [to, setTo] = useState(cTo ?? "");

  const go = (key: string) => router.push(`${basePath}?range=${key}`);
  const applyCustom = () => {
    if (from && to && from <= to) router.push(`${basePath}?range=custom:${from}:${to}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <div className="flex gap-1 rounded-lg bg-white/10 p-1">
        {RANGE_PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => go(p.key)}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              active === p.key ? "bg-white text-[#0B1F3A]" : "text-white/70 hover:text-white"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div
        className={`flex items-center gap-1 rounded-lg p-1 ${
          isCustom ? "bg-white/25" : "bg-white/10"
        }`}
      >
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="rounded bg-white/90 px-1.5 py-0.5 text-xs text-zinc-800"
          aria-label="Custom range start"
        />
        <span className="text-xs text-white/50">→</span>
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="rounded bg-white/90 px-1.5 py-0.5 text-xs text-zinc-800"
          aria-label="Custom range end"
        />
        <button
          type="button"
          onClick={applyCustom}
          disabled={!from || !to || from > to}
          className="rounded-md bg-white px-2 py-0.5 text-xs font-medium text-[#0B1F3A] transition-opacity disabled:opacity-40"
        >
          Apply
        </button>
      </div>
    </div>
  );
}

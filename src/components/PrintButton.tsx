"use client";

// "Save as PDF" for a dashboard view. Uses the browser's native print-to-PDF
// (no server dependency, exact on-screen fidelity). The button hides itself in
// the printed output via the `print:hidden` utility.
export function PrintButton({ label = "Save as PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 print:hidden"
    >
      {label}
    </button>
  );
}

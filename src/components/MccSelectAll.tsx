"use client";

// Select-all / clear-all toggle for the MCC import list. Operates on the
// enabled `account_ids` checkboxes inside the surrounding form (already-imported
// accounts are disabled and untouched). Also shows a live selected count.
import { useEffect, useRef, useState } from "react";

export function MccSelectAll({ total }: { total: number }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState(total);

  const boxes = () => {
    const form = rootRef.current?.closest("form");
    if (!form) return [] as HTMLInputElement[];
    return Array.from(
      form.querySelectorAll<HTMLInputElement>('input[name="account_ids"]:not(:disabled)'),
    );
  };

  const refresh = () => setSelected(boxes().filter((b) => b.checked).length);

  useEffect(() => {
    const form = rootRef.current?.closest("form");
    if (!form) return;
    form.addEventListener("change", refresh);
    refresh();
    return () => form.removeEventListener("change", refresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setAll = (checked: boolean) => {
    boxes().forEach((b) => {
      b.checked = checked;
    });
    refresh();
  };

  return (
    <div ref={rootRef} className="flex items-center gap-3 text-xs">
      <span className="text-zinc-500">
        {selected} of {total} selected
      </span>
      <button
        type="button"
        onClick={() => setAll(true)}
        className="rounded-md border border-zinc-300 bg-white px-2.5 py-1 font-medium text-zinc-700 hover:bg-zinc-50"
      >
        Select all
      </button>
      <button
        type="button"
        onClick={() => setAll(false)}
        className="rounded-md border border-zinc-300 bg-white px-2.5 py-1 font-medium text-zinc-700 hover:bg-zinc-50"
      >
        Clear all
      </button>
    </div>
  );
}

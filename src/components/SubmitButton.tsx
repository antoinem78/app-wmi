"use client";
// Submit button for the onboarding server-action forms. Disables itself while
// the action is pending (prevents double-submits). When given a `savedLabel`,
// it briefly flips to that label in green after a successful save — used for
// the in-place "Save changes" / "Save link" forms.
import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  savedLabel,
}: {
  children: React.ReactNode;
  savedLabel?: string;
}) {
  const { pending } = useFormStatus();
  const [saved, setSaved] = useState(false);
  const wasPending = useRef(false);

  useEffect(() => {
    if (pending) {
      setSaved(false);
      wasPending.current = true;
      return;
    }
    if (wasPending.current) {
      wasPending.current = false;
      if (savedLabel) {
        setSaved(true);
        const t = setTimeout(() => setSaved(false), 2500);
        return () => clearTimeout(t);
      }
    }
  }, [pending, savedLabel]);

  const base =
    "rounded-md px-5 py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-70";
  const color = saved ? "bg-emerald-600" : "bg-[#0B1F3A] hover:bg-[#0B1F3A]/90";

  return (
    <button type="submit" disabled={pending} className={`${base} ${color}`}>
      {saved && savedLabel ? savedLabel : children}
    </button>
  );
}

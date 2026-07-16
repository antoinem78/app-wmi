// O10: "Powered by SingularWeb" mark. Layer-1 engine badge carried on
// client-facing surfaces (console chrome, reports, widget footer) where the
// client allows. Calm, flat, no emoji, per the Experience Manifest.
export function PoweredBySingularWeb({ className = "" }: { className?: string }) {
  return (
    <span className={`text-xs text-zinc-400 ${className}`}>
      Powered by <span className="font-medium text-zinc-500">SingularWeb</span>
    </span>
  );
}

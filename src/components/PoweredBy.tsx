// Platform attribution for public, client-facing pages. The deployment's brand
// (entityConfig.brandName, e.g. "WMI") is the white-label; SingularWeb is the
// underlying platform/template — this subtle line credits the platform, and is
// intentionally constant across white-labels (not driven by entityConfig).
export function PoweredBy() {
  return (
    <p className="mt-10 text-center text-xs text-zinc-400">
      Powered by SingularWeb
    </p>
  );
}

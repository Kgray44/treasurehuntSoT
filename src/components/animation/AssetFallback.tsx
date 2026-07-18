/* eslint-disable @next/next/no-img-element -- Fallback SVGs must render directly when a richer runtime fails. */

export function AssetFallback({ src, label, className = "" }: { src?: string; label: string; className?: string }) {
  return (
    <div className={`asset-fallback ${className}`} role="img" aria-label={label} data-fallback-active="true">
      {src ? <img src={src} alt="" aria-hidden="true" /> : <span aria-hidden="true">✦</span>}
      <span className="sr-only">{label}</span>
    </div>
  );
}

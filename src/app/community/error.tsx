"use client";
export default function CommunityError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="page-shell" role="alert"><p className="eyebrow">Community Harbor</p><h1>The Harbor is unavailable</h1><p>Public Community records could not be loaded safely.</p><button type="button" onClick={reset}>Retry</button></main>;
}

"use client";
export default function CommunityError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="community-harbor" role="alert">
      <section className="community-state community-state--error community-route-error">
        <p className="community-eyebrow">Community Harbor unavailable</p>
        <h1>The Harbor could not be opened</h1>
        <p>Public Community records could not be loaded safely. No Community action was completed.</p>
        <button className="community-button community-button--primary" type="button" onClick={reset}>
          Try again
        </button>
      </section>
    </main>
  );
}

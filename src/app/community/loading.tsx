export default function CommunityLoading() {
  return (
    <main className="community-harbor community-route-loading" aria-busy="true" aria-live="polite">
      <header className="community-hero">
        <div className="community-hero__copy">
          <p className="community-eyebrow">Community Harbor</p>
          <h1>Opening the Harbor</h1>
          <p>Gathering safe public Community records. Nothing private is used to fill this view.</p>
        </div>
      </header>
      <div className="community-skeleton-row" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </main>
  );
}

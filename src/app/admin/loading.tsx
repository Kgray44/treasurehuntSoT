export default function AdminLoading() {
  return (
    <div className="chartroom-page" aria-busy="true" aria-live="polite">
      <header className="chartroom-heading">
        <div>
          <p className="chartroom-eyebrow">Refreshing evidence</p>
          <h1>Checking the chart</h1>
          <p>Admiralty is reading the authorized owner projections for this station.</p>
        </div>
      </header>
      <div className="chartroom-metrics" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <span className="chartroom-skeleton" key={index} />
        ))}
      </div>
      <span className="chartroom-skeleton chartroom-skeleton--panel" aria-hidden="true" />
    </div>
  );
}

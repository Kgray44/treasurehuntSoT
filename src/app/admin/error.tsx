"use client";

import Link from "next/link";

export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="chartroom-page">
      <header className="chartroom-heading">
        <div>
          <p className="chartroom-eyebrow">Safe failure</p>
          <h1>This station is unavailable</h1>
          <p>
            The requested projection failed without exposing internal error detail. Other command-center stations remain
            available.
          </p>
        </div>
      </header>
      <div className="chartroom-empty">
        <strong>No evidence was fabricated.</strong>
        <p>Retry the bounded read, or return to Platform Overview.</p>
        <div className="chartroom-heading__actions">
          <button type="button" onClick={reset}>
            Retry this station
          </button>
          <Link className="chartroom-link" href="/admin">
            Platform Overview
          </Link>
        </div>
      </div>
    </div>
  );
}

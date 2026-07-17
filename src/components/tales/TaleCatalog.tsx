"use client";

/* eslint-disable @next/next/no-img-element -- Published asset URLs are authorized version-bound media responses. */
import Link from "next/link";
import { useEffect, useState } from "react";

type CatalogTale = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  shortDescription: string | null;
  coverUrl: string | null;
  estimatedDuration: number | null;
  playerCountMin: number;
  playerCountMax: number;
  version: string;
  playerState: "NEW" | "IN_PROGRESS" | "COMPLETED";
  sessionId: string | null;
};

export function TaleCatalog() {
  const [tales, setTales] = useState<CatalogTale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    void fetch("/api/tales", { cache: "no-store" }).then(async (response) => {
      const body = (await response.json()) as { tales?: CatalogTale[]; error?: string };
      if (!response.ok) setError(body.error ?? "The voyage catalog is unavailable.");
      else setTales(body.tales ?? []);
      setLoading(false);
    });
  }, []);
  return (
    <main className="tale-catalog">
      <header>
        <Link href="/">← Harbor</Link>
        <div>
          <p className="eyebrow">Published voyages</p>
          <h1>Choose a Tall Tale</h1>
          <p>Every chart below is an immutable, Captain-ready release from Tall Tale Studio.</p>
        </div>
        <Link href="/captain">Captain controls</Link>
      </header>
      {loading && (
        <p className="catalog-status" role="status">
          Reading the published ledger…
        </p>
      )}
      {error && (
        <p className="catalog-status error" role="alert">
          {error}
        </p>
      )}
      {!loading && !tales.length && (
        <section className="catalog-empty">
          <span>☾</span>
          <h2>No public voyages yet</h2>
          <p>A creator must validate and publish a public Tall Tale before it appears here.</p>
        </section>
      )}
      <section className="catalog-grid">
        {tales.map((tale) => (
          <article key={tale.id}>
            {tale.coverUrl ? (
              <img src={tale.coverUrl} alt="" />
            ) : (
              <div className="catalog-cover-fallback">
                <i />✦
              </div>
            )}
            <div>
              <p className="card-kicker">
                Published version {tale.version} ·{" "}
                {tale.playerState === "IN_PROGRESS"
                  ? "In progress"
                  : tale.playerState === "COMPLETED"
                    ? "Completed · replayable"
                    : "New voyage"}
              </p>
              <h2>{tale.title}</h2>
              <h3>{tale.subtitle}</h3>
              <p>{tale.shortDescription ?? "A new voyage awaits beyond the harbor lights."}</p>
              <dl>
                <div>
                  <dt>Duration</dt>
                  <dd>{tale.estimatedDuration ? `${tale.estimatedDuration} min` : "Uncharted"}</dd>
                </div>
                <div>
                  <dt>Crew</dt>
                  <dd>
                    {tale.playerCountMin}–{tale.playerCountMax}
                  </dd>
                </div>
              </dl>
              <Link
                className="brass-button"
                href={
                  tale.playerState === "IN_PROGRESS" && tale.sessionId
                    ? `/play/${tale.slug}/session/${tale.sessionId}`
                    : `/play/${tale.slug}`
                }
              >
                {tale.playerState === "IN_PROGRESS"
                  ? "Continue voyage"
                  : tale.playerState === "COMPLETED"
                    ? "Replay voyage"
                    : "Start voyage"}
              </Link>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

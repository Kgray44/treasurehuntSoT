"use client";

/* eslint-disable @next/next/no-img-element -- Published asset URLs are authorized version-bound media responses. */
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/AsyncState";
import { platformCopy } from "@/language/platform-copy";

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
  const [query, setQuery] = useState("");
  const [state, setState] = useState("ALL");
  const [duration, setDuration] = useState("ANY");
  const [groupSize, setGroupSize] = useState("ANY");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/tales", { cache: "no-store" });
      const body = (await response.json()) as { tales?: CatalogTale[]; error?: string };
      if (!response.ok) setError(body.error ?? "The Chronicle Library is unavailable.");
      else setTales(body.tales ?? []);
    } catch {
      setError("The Chronicle Library could not be reached. Check your connection, then try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  const filteredTales = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const requestedGroupSize = groupSize === "ANY" ? null : Number(groupSize);
    const maximumDuration = duration === "ANY" ? null : Number(duration);
    return tales.filter((tale) => {
      const matchesQuery = `${tale.title} ${tale.subtitle ?? ""} ${tale.shortDescription ?? ""}`
        .toLocaleLowerCase()
        .includes(normalizedQuery);
      const matchesState = state === "ALL" || tale.playerState === state;
      const matchesDuration =
        maximumDuration === null || (tale.estimatedDuration !== null && tale.estimatedDuration <= maximumDuration);
      const matchesGroup =
        requestedGroupSize === null ||
        (tale.playerCountMin <= requestedGroupSize && tale.playerCountMax >= requestedGroupSize);
      return matchesQuery && matchesState && matchesDuration && matchesGroup;
    });
  }, [duration, groupSize, query, state, tales]);

  const hasFilters = Boolean(query || state !== "ALL" || duration !== "ANY" || groupSize !== "ANY");
  const clearFilters = () => {
    setQuery("");
    setState("ALL");
    setDuration("ANY");
    setGroupSize("ANY");
  };

  return (
    <main className="tale-catalog">
      <header>
        <div>
          <p className="eyebrow">Published Chronicles</p>
          <h1>Choose a Chronicle</h1>
          <p>Review the Chronicle, duration, and Crew size before you begin or continue a Voyage.</p>
        </div>
      </header>
      {!loading && !error && tales.length > 0 && (
        <section className="catalog-tools" aria-label="Search and filter Chronicles">
          <label className="catalog-search">
            <span>Search</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Title, description, or theme"
            />
          </label>
          <label>
            <span>Progress</span>
            <select value={state} onChange={(event) => setState(event.target.value)}>
              <option value="ALL">Any progress</option>
              <option value="NEW">Not started</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </label>
          <label>
            <span>Duration</span>
            <select value={duration} onChange={(event) => setDuration(event.target.value)}>
              <option value="ANY">Any length</option>
              <option value="30">30 minutes or less</option>
              <option value="60">60 minutes or less</option>
              <option value="120">2 hours or less</option>
            </select>
          </label>
          <label>
            <span>Group size</span>
            <select value={groupSize} onChange={(event) => setGroupSize(event.target.value)}>
              <option value="ANY">Any group</option>
              <option value="1">1 Player</option>
              <option value="2">2 Players</option>
              <option value="4">4 Players</option>
              <option value="6">6 Players</option>
            </select>
          </label>
          <div className="catalog-result-summary" aria-live="polite">
            <strong>{filteredTales.length}</strong>
            <span>{filteredTales.length === 1 ? "Chronicle" : "Chronicles"}</span>
            {hasFilters && (
              <button className="button-subtle" type="button" onClick={clearFilters}>
                Clear filters
              </button>
            )}
          </div>
        </section>
      )}
      {loading && <LoadingState title="Opening published Chronicles" detail="Loading Chronicle details." />}
      {error && (
        <ErrorState
          title="Chronicles could not be loaded"
          detail={error}
          action={{ label: "Try Again", onClick: () => void load() }}
        />
      )}
      {!loading && !error && !tales.length && (
        <EmptyState
          title={platformCopy.noChronicles.value}
          detail="A Creator must validate and publish a Chronicle before it appears here."
          action={{ label: "Return to Role Gateway", href: "/" }}
          symbol="☾"
        />
      )}
      {!loading && !error && tales.length > 0 && !filteredTales.length && (
        <EmptyState
          title="No Chronicles match these filters"
          detail="Try a different title, a longer duration, or a broader Crew size."
          action={{ label: "Clear Filters", onClick: clearFilters }}
          symbol="⌕"
        />
      )}
      <section className="catalog-grid">
        {filteredTales.map((tale) => (
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
                  ? platformCopy.continueVoyage.value
                  : tale.playerState === "COMPLETED"
                    ? "Begin a new Voyage"
                    : "Preview Chronicle"}
              </Link>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

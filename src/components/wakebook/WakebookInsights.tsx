"use client";

import Link from "next/link";
import { TechnicalDetails } from "@/components/ui/TechnicalDetails";
import type { WakebookInsights as Insights } from "@/wakebook/insights";
import {
  formatArchiveDate,
  useWakebookResource,
  WakebookError,
  WakebookLoading,
} from "@/components/wakebook/WakebookShared";

type View = "timeline" | "people" | "statistics" | "atlas";

const copy: Record<View, { eyebrow: string; heading: string; detail: string }> = {
  timeline: {
    eyebrow: "The shape of your journey",
    heading: "Your archive in time",
    detail: "Read the private sequence of your recorded Voyages without turning history into a score.",
  },
  people: {
    eyebrow: "Those who traveled beside you",
    heading: "Shared history",
    detail: "Historical crew context stays private and remains distinct from current profiles.",
  },
  statistics: {
    eyebrow: "A private reading of the wake",
    heading: "The record at a glance",
    detail: "Source-bound totals make their quality visible instead of guessing at missing history.",
  },
  atlas: {
    eyebrow: "A life in Voyages",
    heading: "Seasons in your archive",
    detail: "Organize the private archive by season and shared historical context without inventing a location trail.",
  },
};

function duration(seconds: number | null) {
  if (seconds === null) return "Unavailable";
  const minutes = Math.round(seconds / 60);
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours} hr${minutes % 60 ? ` ${minutes % 60} min` : ""}` : `${minutes} min`;
}

export function WakebookInsights({ view }: { view: View }) {
  const resource = useWakebookResource<Insights>("/api/passport/insights");
  if (resource.state.status === "loading")
    return <WakebookLoading detail="Reading your private, source-bound journey history." />;
  if (resource.state.status === "error")
    return <WakebookError message={resource.state.message} retry={resource.reload} />;
  const insights = resource.state.value;
  const text = copy[view];
  return (
    <div className="wakebook-insights">
      <section className="wakebook-insights__intro" aria-labelledby="wakebook-insights-context">
        <div>
          <p className="personal-harbor__eyebrow">{text.eyebrow}</p>
          <h2 id="wakebook-insights-context">{text.heading}</h2>
          <p>{text.detail}</p>
        </div>
      </section>
      {insights.notice ? (
        <aside className="wakebook-notice" role="status">
          <strong>Part of the wake is still settling.</strong>
          <span>{insights.notice}</span>
        </aside>
      ) : null}
      {view === "timeline" ? <Timeline insights={insights} /> : null}
      {view === "people" ? <People insights={insights} /> : null}
      {view === "statistics" ? <Statistics insights={insights} /> : null}
      {view === "atlas" ? <Atlas insights={insights} /> : null}
    </div>
  );
}

function Timeline({ insights }: { insights: Insights }) {
  if (!insights.timeline.length)
    return (
      <Empty
        title="Your timeline is waiting for its first wake"
        detail="Completed or in-progress Voyages will appear here once their private historical record is available."
      />
    );
  const years = new Map<string, typeof insights.timeline>();
  for (const item of insights.timeline) {
    const date = item.dateQuality === "EXACT" && item.date ? new Date(item.date) : null;
    const year = date && !Number.isNaN(date.valueOf()) ? String(date.getUTCFullYear()) : "Date not retained";
    years.set(year, [...(years.get(year) ?? []), item]);
  }
  return (
    <div className="wakebook-timeline-groups" aria-label="Private Voyage timeline">
      {[...years].map(([year, journeys]) => (
        <section
          className="wakebook-timeline-group"
          key={year}
          aria-labelledby={`wakebook-timeline-${year.replaceAll(" ", "-")}`}
        >
          <header>
            <p className="personal-harbor__eyebrow">Archive year</p>
            <h2 id={`wakebook-timeline-${year.replaceAll(" ", "-")}`}>{year}</h2>
          </header>
          <ol className="wakebook-timeline">
            {journeys.map((item) => (
              <li key={item.id}>
                <div className="wakebook-timeline__marker" aria-hidden="true" />
                <article>
                  <time dateTime={item.date ?? undefined}>
                    {item.dateQuality === "EXACT" ? formatArchiveDate(item.date) : "Historical date unavailable"}
                  </time>
                  <h3>{item.title}</h3>
                  <span>
                    {item.lifecycle} · {item.duration}
                  </span>
                  <Link className="button button--quiet" href={`/passport/history/${encodeURIComponent(item.id)}`}>
                    Open Voyage
                  </Link>
                </article>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

function People({ insights }: { insights: Insights }) {
  if (!insights.people.length)
    return (
      <Empty
        title="Your people view is ready when a shared journey settles"
        detail="Crew context is shown only from your private historical snapshots; it never substitutes current profile information."
      />
    );
  return (
    <section aria-label="Historical people" className="wakebook-people">
      <p className="wakebook-insights__lead">
        Historical companions are grouped by the records you own. This is not a public social graph.
      </p>
      <ul>
        {insights.people.map((person, index) => (
          <li key={`${person.label}-${index}`}>
            <span className="wakebook-people__initial" aria-hidden="true">
              {person.label.slice(0, 1).toLocaleUpperCase()}
            </span>
            <div>
              <h3>{person.label}</h3>
              <p>
                Remembered as {person.role} · {person.voyageCount} {person.voyageCount === 1 ? "Voyage" : "Voyages"}
              </p>
              <dl className="wakebook-people__journeys">
                <SharedVoyage label="First shared Voyage" voyage={person.firstSharedVoyage} />
                <SharedVoyage label="Most recent shared Voyage" voyage={person.latestSharedVoyage} />
              </dl>
            </div>
            <span className="wakebook-people__quality">
              {person.availability === "HISTORICAL" ? "Historical snapshot" : "Limited historical record"}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SharedVoyage({
  label,
  voyage,
}: {
  label: string;
  voyage: { id: string; title: string; date: string | null } | null;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        {voyage ? (
          <>
            <Link href={`/passport/history/${encodeURIComponent(voyage.id)}`}>{voyage.title}</Link>
            <span>{formatArchiveDate(voyage.date)}</span>
          </>
        ) : (
          "Date was not retained"
        )}
      </dd>
    </div>
  );
}

function Statistics({ insights }: { insights: Insights }) {
  const metrics = insights.metrics;
  if (!metrics.voyageCount)
    return (
      <Empty
        title="Your private reading begins with a first Voyage"
        detail="Wakebook will only calculate source-bound, noncompetitive summaries after a personal historical record exists."
      />
    );
  return (
    <section className="wakebook-statistics" aria-label="Private journey statistics">
      <p className="wakebook-insights__lead">
        These are private, rebuildable summaries of accepted history. They do not rank you, create streaks, or compare
        you with anyone else.
      </p>
      <dl>
        <div>
          <dt>Recorded Voyages</dt>
          <dd>{metrics.voyageCount}</dd>
          <dd className="wakebook-statistics__note">Private historical records</dd>
        </div>
        <div>
          <dt>Completed</dt>
          <dd>{metrics.completedCount}</dd>
          <dd className="wakebook-statistics__note">Accepted completion records</dd>
        </div>
        <div>
          <dt>Recorded time</dt>
          <dd>{metrics.exactDurationSeconds === null ? "Mixed quality" : duration(metrics.exactDurationSeconds)}</dd>
          <dd className="wakebook-statistics__note">
            {metrics.durationCoverage === "EXACT"
              ? "Every record has exact timing"
              : "Unavailable or estimated timing is not added"}
          </dd>
        </div>
        <div>
          <dt>Archive span</dt>
          <dd>
            {formatArchiveDate(metrics.firstJourneyAt)} - {formatArchiveDate(metrics.latestJourneyAt)}
          </dd>
          <dd className="wakebook-statistics__note">From available historical dates</dd>
        </div>
      </dl>
      <p className="wakebook-statistics__method">
        Metric definition: {metrics.definitionVersions.join(", ") || "unavailable"}. The definition travels with your
        records so later product changes do not rewrite what happened.
      </p>
    </section>
  );
}

function Atlas({ insights }: { insights: Insights }) {
  if (!insights.timeline.length) return <AtlasUnavailable hasVoyages={false} />;
  const seasons = new Map<string, typeof insights.timeline>();
  for (const item of insights.timeline) {
    const date = item.date ? new Date(item.date) : null;
    const season =
      !date || Number.isNaN(date.valueOf())
        ? "Date unavailable"
        : `${date.getUTCFullYear()} ${["Winter", "Spring", "Summer", "Autumn"][Math.floor(date.getUTCMonth() / 3)]}`;
    seasons.set(season, [...(seasons.get(season) ?? []), item]);
  }
  return (
    <div className="wakebook-atlas">
      <section className="wakebook-atlas__seasons" aria-label="Voyages by season">
        <p className="wakebook-insights__lead">
          Seasonal groups retain the historical date quality of each Voyage and link only to your own record.
        </p>
        {[...seasons].map(([season, voyages]) => (
          <section key={season} className="wakebook-atlas__season" aria-label={season}>
            <h3>{season}</h3>
            <ul>
              {voyages.map((voyage) => (
                <li key={voyage.id}>
                  <Link href={`/passport/history/${encodeURIComponent(voyage.id)}`}>{voyage.title}</Link>
                  <span>{voyage.dateQuality === "EXACT" ? formatArchiveDate(voyage.date) : "Date unavailable"}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </section>
      <AtlasUnavailable hasVoyages />
    </div>
  );
}

function AtlasUnavailable({ hasVoyages }: { hasVoyages: boolean }) {
  return (
    <aside className="wakebook-atlas__boundary" aria-label="Journey geography availability">
      <p className="personal-harbor__eyebrow">Private geography</p>
      <h3>{hasVoyages ? "Journey geography is not available yet" : "Your Atlas is ready when history arrives"}</h3>
      <p>
        {hasVoyages
          ? "Journey geography appears only when a Voyage retained safe place information for your private history. None is available for this archive yet."
          : "When a future Voyage retains safe journey geography, it can appear here alongside your own historical record."}
      </p>
      <Link className="button button--quiet" href={hasVoyages ? "/passport/people" : "/passport/history"}>
        {hasVoyages ? "Open People" : "Open your Voyage archive"}
      </Link>
      <TechnicalDetails
        summary="About geography availability"
        description="No route or location is inferred when the accepted historical geography projection is unavailable."
      >
        <p>Landfall is the governed source for any future owner-safe geography projection.</p>
      </TechnicalDetails>
    </aside>
  );
}

function Empty({ title, detail }: { title: string; detail: string }) {
  return (
    <section className="wakebook-empty" aria-labelledby="wakebook-insights-empty">
      <div className="wakebook-empty__compass" aria-hidden="true">
        <span>✦</span>
      </div>
      <div>
        <p className="personal-harbor__eyebrow">Private by default</p>
        <h2 id="wakebook-insights-empty">{title}</h2>
        <p>{detail}</p>
        <Link className="button button--primary" href="/passport/history">
          Open your Voyage archive
        </Link>
      </div>
    </section>
  );
}

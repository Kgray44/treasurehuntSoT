"use client";

import Link from "next/link";
import type { WakebookInsights as Insights } from "@/wakebook/insights";
import {
  formatArchiveDate,
  useWakebookResource,
  WakebookError,
  WakebookLoading,
} from "@/components/wakebook/WakebookShared";

type View = "timeline" | "people" | "statistics";

const copy: Record<View, { eyebrow: string; heading: string; detail: string }> = {
  timeline: {
    eyebrow: "The shape of your journey",
    heading: "Timeline",
    detail: "Read the private sequence of your recorded Voyages without turning history into a score.",
  },
  people: {
    eyebrow: "Those who traveled beside you",
    heading: "People",
    detail: "Historical crew context stays private and remains distinct from current profiles.",
  },
  statistics: {
    eyebrow: "A private reading of the wake",
    heading: "Statistics",
    detail: "Source-bound totals make their quality visible instead of guessing at missing history.",
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
      <section className="wakebook-insights__intro" aria-labelledby="wakebook-insights-title">
        <div>
          <p className="personal-harbor__eyebrow">{text.eyebrow}</p>
          <h2 id="wakebook-insights-title">{text.heading}</h2>
          <p>{text.detail}</p>
        </div>
        <nav aria-label="Archive views" className="wakebook-insights__tabs">
          <Link href="/passport/timeline" aria-current={view === "timeline" ? "page" : undefined}>
            Timeline
          </Link>
          <Link href="/passport/people" aria-current={view === "people" ? "page" : undefined}>
            People
          </Link>
          <Link href="/passport/statistics" aria-current={view === "statistics" ? "page" : undefined}>
            Statistics
          </Link>
        </nav>
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
  return (
    <ol className="wakebook-timeline" aria-label="Private Voyage timeline">
      {insights.timeline.map((item) => (
        <li key={item.id}>
          <div className="wakebook-timeline__marker" aria-hidden="true" />
          <article>
            <p>{item.dateQuality === "EXACT" ? formatArchiveDate(item.date) : "Date unavailable"}</p>
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
                {person.role} · {person.voyageCount} {person.voyageCount === 1 ? "Voyage" : "Voyages"}
              </p>
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
          <p>Private historical records</p>
        </div>
        <div>
          <dt>Completed</dt>
          <dd>{metrics.completedCount}</dd>
          <p>Accepted completion records</p>
        </div>
        <div>
          <dt>Recorded time</dt>
          <dd>{metrics.exactDurationSeconds === null ? "Mixed quality" : duration(metrics.exactDurationSeconds)}</dd>
          <p>
            {metrics.durationCoverage === "EXACT"
              ? "Every record has exact timing"
              : "Unavailable or estimated timing is not added"}
          </p>
        </div>
        <div>
          <dt>Archive span</dt>
          <dd>
            {formatArchiveDate(metrics.firstJourneyAt)} - {formatArchiveDate(metrics.latestJourneyAt)}
          </dd>
          <p>From available historical dates</p>
        </div>
      </dl>
      <p className="wakebook-statistics__method">
        Metric definition: {metrics.definitionVersions.join(", ") || "unavailable"}. The definition travels with your
        records so later product changes do not rewrite what happened.
      </p>
    </section>
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

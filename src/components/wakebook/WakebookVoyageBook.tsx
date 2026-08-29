"use client";

import Link from "next/link";
import type { VoyageDetail } from "@/wakebook/contracts";
import {
  formatArchiveDate,
  HistoricalCover,
  useWakebookResource,
  WakebookError,
  WakebookLoading,
} from "@/components/wakebook/WakebookShared";

export function WakebookVoyageBookEntry({ recordId }: { recordId: string }) {
  return (
    <Link className="button button--quiet" href={`/passport/history/${encodeURIComponent(recordId)}/book`}>
      Open private Voyage Book
    </Link>
  );
}

export function WakebookVoyageBook({ recordId }: { recordId: string }) {
  const resource = useWakebookResource<VoyageDetail>(`/api/passport/voyages/${encodeURIComponent(recordId)}`);

  if (resource.state.status === "loading")
    return <WakebookLoading detail="Preparing your owner-private, source-bound Voyage Book." />;
  if (resource.state.status === "error")
    return <WakebookError message={resource.state.message} retry={resource.reload} />;

  const voyage = resource.state.value;
  const hasRemembrance = Boolean(voyage.reflection?.privateNote) || voyage.memories.length > 0;

  return (
    <article className="wakebook-voyage-book" aria-labelledby="wakebook-voyage-book-title">
      <header className="wakebook-voyage-book__hero">
        <HistoricalCover
          cover={voyage.chronicle.historicalCover}
          title={voyage.chronicle.historicalTitle}
          size="hero"
        />
        <div>
          <p className="personal-harbor__eyebrow">Private printable presentation</p>
          <h2 id="wakebook-voyage-book-title">{voyage.chronicle.historicalTitle}</h2>
          <p>{voyage.outcome.label}</p>
          <dl className="wakebook-definition-grid">
            <Definition term="Played edition" value={voyage.chronicle.publishedVersionLabel || "Unavailable"} />
            <Definition term="Journey date" value={formatArchiveDate(voyage.chronology.archiveDate)} />
            <Definition term="Historical Captain" value={voyage.attribution.captain.historicalLabel || "Unavailable"} />
            <Definition
              term="Your participation"
              value={voyage.participation.crewRole || voyage.participation.humanRole}
            />
          </dl>
          <div className="personal-harbor__actions wakebook-voyage-book__actions">
            <button className="button button--primary" type="button" onClick={() => window.print()}>
              Print this private Voyage Book
            </button>
            <Link className="button button--quiet" href={`/passport/history/${encodeURIComponent(recordId)}`}>
              Back to Voyage Detail
            </Link>
          </div>
        </div>
      </header>

      {voyage.warnings.length ? (
        <aside className="wakebook-notice" role="status">
          <strong>Some historical details were not preserved.</strong>
          <span>{voyage.warnings.join(" ")}</span>
        </aside>
      ) : null}

      <section className="wakebook-voyage-book__section" aria-labelledby="wakebook-voyage-book-story">
        <p className="personal-harbor__eyebrow">Remembered privately</p>
        <h3 id="wakebook-voyage-book-story">Your story of this Voyage</h3>
        {voyage.reflection?.privateNote ? (
          <p className="wakebook-voyage-book__reflection">{voyage.reflection.privateNote}</p>
        ) : null}
        {voyage.memories.length ? (
          <ol className="wakebook-voyage-book__memories" aria-label="Private Memories">
            {voyage.memories.map((memory) => (
              <li key={memory.id}>
                <h4>{memory.title}</h4>
                {memory.body ? <p>{memory.body}</p> : null}
                <time dateTime={memory.createdAt}>{formatArchiveDate(memory.createdAt)}</time>
              </li>
            ))}
          </ol>
        ) : hasRemembrance ? null : (
          <p className="wakebook-soft-empty">No private reflection or Memory has been added to this Voyage yet.</p>
        )}
      </section>

      <section className="wakebook-voyage-book__section" aria-labelledby="wakebook-voyage-book-path">
        <p className="personal-harbor__eyebrow">Source-bound history</p>
        <h3 id="wakebook-voyage-book-path">The journey you completed</h3>
        {voyage.chapters.length ? (
          <ol className="wakebook-chapters">
            {voyage.chapters.map((chapter) => (
              <li key={chapter.id}>
                <span>{chapter.sequence}</span>
                <div>
                  <strong>{chapter.title}</strong>
                  <small>{formatArchiveDate(chapter.completedAt)}</small>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="wakebook-soft-empty">Completed chapter history was not retained for this Voyage.</p>
        )}
      </section>

      <section className="wakebook-voyage-book__section" aria-labelledby="wakebook-voyage-book-crew">
        <p className="personal-harbor__eyebrow">Historical snapshot</p>
        <h3 id="wakebook-voyage-book-crew">The people on this Voyage</h3>
        {voyage.crew.length ? (
          <ul className="wakebook-voyage-book__crew">
            {voyage.crew.map((member) => (
              <li key={`${member.historicalDisplayName}-${member.role}`}>
                <strong>{member.historicalDisplayName}</strong>
                <span>{member.crewRole || member.humanRole}</span>
                {member.isHistoricalCaptain ? <span>Historical Captain</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="wakebook-soft-empty">No historical crew snapshot is available for this Voyage.</p>
        )}
      </section>

      <footer className="wakebook-voyage-book__boundary">
        <strong>Owner-private presentation</strong>
        <p>
          This Voyage Book is a printable presentation of owner-visible, source-bound archive history and your private
          remembrance. It does not alter the Voyage, expose participant media, or replace the canonical Wayfarer
          account-data export.
        </p>
      </footer>
    </article>
  );
}

function Definition({ term, value }: { term: string; value: string }) {
  return (
    <div>
      <dt>{term}</dt>
      <dd>{value}</dd>
    </div>
  );
}

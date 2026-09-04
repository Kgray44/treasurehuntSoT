"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ArchiveYearGroup, JourneyArchiveItem, JourneyArchiveResponse } from "@/wakebook/contracts";
import {
  crewInitials,
  formatArchiveDate,
  HistoricalCover,
  useWakebookResource,
  WakebookError,
  WakebookLoading,
  wakebookResponse,
} from "@/components/wakebook/WakebookShared";

type FilterState = {
  search: string;
  status: string;
  year: string;
  role: string;
  hasMemories: boolean;
  hasKeepsake: boolean;
  hasArtifacts: boolean;
  sort: "NEWEST" | "OLDEST";
};

const emptyFilters: FilterState = {
  search: "",
  status: "",
  year: "",
  role: "",
  hasMemories: false,
  hasKeepsake: false,
  hasArtifacts: false,
  sort: "NEWEST",
};

function archiveUrl(filters: FilterState, cursor?: string) {
  const params = new URLSearchParams();
  if (filters.search.trim()) params.set("search", filters.search.trim());
  if (filters.status) params.set("status", filters.status);
  if (filters.year) params.set("year", filters.year);
  if (filters.role) params.set("role", filters.role);
  if (filters.hasMemories) params.set("hasMemories", "true");
  if (filters.hasKeepsake) params.set("hasKeepsake", "true");
  if (filters.hasArtifacts) params.set("hasArtifacts", "true");
  if (filters.sort !== "NEWEST") params.set("sort", filters.sort);
  if (cursor) params.set("cursor", cursor);
  const query = params.toString();
  return `/api/passport/voyages${query ? `?${query}` : ""}`;
}

function mergePages(current: JourneyArchiveResponse, next: JourneyArchiveResponse): JourneyArchiveResponse {
  const groups = new Map(current.groups.map((group) => [group.key, group]));
  for (const nextGroup of next.groups) {
    const existing = groups.get(nextGroup.key);
    const items = existing
      ? [...existing.items, ...nextGroup.items].filter(
          (item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index,
        )
      : nextGroup.items;
    groups.set(nextGroup.key, { ...nextGroup, items, displayedCount: items.length });
  }
  return {
    ...current,
    groups: [...groups.values()],
    nextCursor: next.nextCursor,
    pageCount: [...groups.values()].reduce((total, group) => total + group.items.length, 0),
    warnings: [...new Set([...current.warnings, ...next.warnings])],
  };
}

export function WakebookArchive() {
  const [draft, setDraft] = useState<FilterState>(emptyFilters);
  const [filters, setFilters] = useState<FilterState>(emptyFilters);
  const [loadingMore, setLoadingMore] = useState(false);
  const url = useMemo(() => archiveUrl(filters), [filters]);
  const resource = useWakebookResource<JourneyArchiveResponse>(url);

  if (resource.state.status === "loading") return <WakebookLoading />;
  if (resource.state.status === "error")
    return <WakebookError message={resource.state.message} retry={resource.reload} />;
  const archive = resource.state.value;
  const hasPlayedVoyages = archive.resultCount > 0;
  const singleVoyage = archive.resultCount === 1 && !archive.filtersApplied;
  const loadMore = async () => {
    if (!archive.nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const next = await wakebookResponse<JourneyArchiveResponse>(
        await fetch(archiveUrl(filters, archive.nextCursor), { cache: "no-store" }),
      );
      resource.setState({ status: "ready", value: mergePages(archive, next) });
    } catch (cause) {
      resource.setState({
        status: "error",
        message: cause instanceof Error ? cause.message : "The next archive page could not be read.",
      });
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className={`wakebook-archive${singleVoyage ? " wakebook-archive--single" : ""}`}>
      <section className="wakebook-intro" aria-labelledby="wakebook-archive-title">
        <div>
          <p className="personal-harbor__eyebrow">The Living Journey Archive</p>
          <h2 id="wakebook-archive-title">Your private shelf</h2>
          <p>
            A private shelf of the exact Chronicle editions you traveled, the people beside you, and the moments that
            remain.
          </p>
        </div>
        <div className="wakebook-intro__count" aria-label={`${archive.resultCount} played Voyages in this archive`}>
          <strong>{archive.resultCount}</strong>
          <span>{archive.resultCount === 1 ? "played Voyage" : "played Voyages"}</span>
        </div>
      </section>

      {archive.warnings.map((warning) => (
        <aside className="wakebook-notice" key={warning} role="status">
          <strong>Part of the wake is still settling.</strong>
          <span>{warning}</span>
        </aside>
      ))}

      <form
        className="wakebook-controls"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          setFilters({ ...draft, search: draft.search.trim() });
        }}
      >
        <div className="wakebook-controls__primary">
          <label>
            <span>Search your archive</span>
            <input
              value={draft.search}
              maxLength={80}
              placeholder="Chronicle or historical crew name"
              onChange={(event) => setDraft({ ...draft, search: event.target.value })}
            />
          </label>
          <label>
            <span>Order</span>
            <select
              value={draft.sort}
              onChange={(event) => setDraft({ ...draft, sort: event.target.value as FilterState["sort"] })}
            >
              <option value="NEWEST">Newest journey</option>
              <option value="OLDEST">Oldest journey</option>
            </select>
          </label>
          <button className="button button--primary" type="submit">
            Read the wake
          </button>
        </div>
        <details className="wakebook-controls__more">
          <summary>More filters</summary>
          <div>
            <label>
              <span>Voyage state</span>
              <select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })}>
                <option value="">Any state</option>
                <option value="COMPLETED">Completed</option>
                <option value="ACTIVE">In progress</option>
                <option value="PAUSED">Paused</option>
                <option value="ABANDONED">Abandoned</option>
                <option value="REMOVED">Removed</option>
              </select>
            </label>
            <label>
              <span>Journey year</span>
              <input
                type="number"
                min={1900}
                max={2200}
                inputMode="numeric"
                placeholder="All years"
                value={draft.year}
                onChange={(event) => setDraft({ ...draft, year: event.target.value })}
              />
            </label>
            <label>
              <span>Participation</span>
              <select value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value })}>
                <option value="">Any role</option>
                <option value="PLAYER">Player</option>
                <option value="CAPTAIN">Captain and player</option>
              </select>
            </label>
            <fieldset>
              <legend>Remembrance and context</legend>
              <label>
                <input
                  type="checkbox"
                  checked={draft.hasMemories}
                  onChange={(event) => setDraft({ ...draft, hasMemories: event.target.checked })}
                />
                Has Memories
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={draft.hasKeepsake}
                  onChange={(event) => setDraft({ ...draft, hasKeepsake: event.target.checked })}
                />
                Has a Keepsake
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={draft.hasArtifacts}
                  onChange={(event) => setDraft({ ...draft, hasArtifacts: event.target.checked })}
                />
                Has artifact context
              </label>
            </fieldset>
          </div>
        </details>
        {archive.filtersApplied && hasPlayedVoyages ? (
          <button
            className="wakebook-controls__clear"
            type="button"
            onClick={() => {
              setDraft(emptyFilters);
              setFilters(emptyFilters);
            }}
          >
            Clear all filters
          </button>
        ) : null}
      </form>

      <p className="wakebook-results" aria-live="polite">
        {archive.filtersApplied
          ? `${archive.resultCount} ${archive.resultCount === 1 ? "Voyage matches" : "Voyages match"} these archive filters.`
          : `${archive.resultCount} ${archive.resultCount === 1 ? "Voyage rests" : "Voyages rest"} on your private shelf.`}
      </p>

      {hasPlayedVoyages ? (
        <div className="wakebook-years">
          {archive.groups.map((group) => (
            <ArchiveGroup group={group} key={group.key} />
          ))}
          {archive.nextCursor ? (
            <div className="wakebook-pagination">
              <p>
                Showing {archive.pageCount} of {archive.resultCount} matching Voyages.
              </p>
              <button className="button" type="button" disabled={loadingMore} onClick={() => void loadMore()}>
                {loadingMore ? "Reading more…" : "Show more Voyages"}
              </button>
            </div>
          ) : null}
        </div>
      ) : archive.filtersApplied ? (
        <FilteredEmpty
          clear={() => {
            setDraft(emptyFilters);
            setFilters(emptyFilters);
          }}
        />
      ) : (
        <FirstUseEmpty invitationOnly={archive.invitations.length > 0} />
      )}

      {archive.invitations.length ? (
        <section className="wakebook-invitations" aria-labelledby="wakebook-invitations-title">
          <div>
            <p className="personal-harbor__eyebrow">Separate from played history</p>
            <h2 id="wakebook-invitations-title">Invitations along the way</h2>
            <p>These invitations are part of your account history, but they are not counted as played Voyages.</p>
          </div>
          <ul>
            {archive.invitations.map((invitation) => (
              <li key={invitation.id}>
                <span className="wakebook-invitation__mark" aria-hidden="true">
                  ✦
                </span>
                <div>
                  <strong>{invitation.chronicleTitle}</strong>
                  <span>{invitation.editionLabel || "Invitation edition"}</span>
                </div>
                <div>
                  <strong>{invitation.lifecycle.humanLabel}</strong>
                  <span>{formatArchiveDate(invitation.chronology.archiveDate)}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function ArchiveGroup({ group }: { group: ArchiveYearGroup }) {
  return (
    <section className="wakebook-year" aria-labelledby={`wakebook-year-${group.key}`}>
      <header>
        <div>
          <p className="personal-harbor__eyebrow">A chapter in your archive</p>
          <h2 id={`wakebook-year-${group.key}`}>{group.label}</h2>
        </div>
        <dl>
          <div>
            <dt>Voyages</dt>
            <dd>{group.totalCount}</dd>
          </div>
          <div>
            <dt>Completed</dt>
            <dd>{group.completedCount}</dd>
          </div>
          {group.exactRecordedSeconds !== null ? (
            <div>
              <dt>Recorded time</dt>
              <dd>{compactDuration(group.exactRecordedSeconds)}</dd>
            </div>
          ) : null}
        </dl>
      </header>
      {group.displayedCount < group.totalCount ? (
        <p className="wakebook-year__coverage">
          Showing {group.displayedCount} of {group.totalCount} Voyages from this year.
        </p>
      ) : null}
      <ol className="wakebook-shelf">
        {group.items.map((item) => (
          <li key={item.id}>
            <VoyageCard item={item} />
          </li>
        ))}
      </ol>
    </section>
  );
}

function VoyageCard({ item }: { item: JourneyArchiveItem }) {
  const crewLabel = item.crewPreview.map((crew) => crew.historicalDisplayName).join(", ");
  return (
    <article className="wakebook-voyage-card" data-quality={item.dataQuality.toLocaleLowerCase()}>
      <HistoricalCover cover={item.chronicle.historicalCover} title={item.chronicle.historicalTitle} />
      <div className="wakebook-voyage-card__body">
        <div className="wakebook-voyage-card__meta">
          <span className="wakebook-status">{item.lifecycle.humanLabel}</span>
          <time dateTime={item.chronology.archiveDate ?? undefined}>
            {formatArchiveDate(item.chronology.archiveDate)}
          </time>
        </div>
        <div>
          <p className="wakebook-edition">{item.chronicle.publishedVersionLabel || "Played edition"}</p>
          <h3>{item.chronicle.historicalTitle}</h3>
          <p className="wakebook-voyage-card__outcome">
            {item.outcome.label} · {item.timing.primary.humanLabel}
          </p>
        </div>
        <div
          className="wakebook-voyage-card__crew"
          aria-label={crewLabel ? `Historical crew: ${crewLabel}` : "Solo or crew unavailable"}
        >
          <div aria-hidden="true">
            {item.crewPreview.length ? (
              item.crewPreview.map((crew) => (
                <span key={`${crew.historicalDisplayName}-${crew.crewRole ?? crew.role}`}>
                  {crewInitials(crew.historicalDisplayName)}
                </span>
              ))
            ) : (
              <span>1</span>
            )}
          </div>
          <p>{crewLabel || "Your personal Voyage record"}</p>
        </div>
        <dl className="wakebook-voyage-card__facts">
          <div>
            <dt>Role</dt>
            <dd>{item.participation.crewRole || item.participation.humanRole}</dd>
          </div>
          <div>
            <dt>Chapters</dt>
            <dd>{item.progress.chapterEvidenceAvailable ? item.progress.completedChapterCount : "Unavailable"}</dd>
          </div>
          <div>
            <dt>Memories</dt>
            <dd>{item.context.memoryCount}</dd>
          </div>
          <div>
            <dt>Artifact moments</dt>
            <dd>{item.context.sharedArtifactCount}</dd>
          </div>
        </dl>
        {item.warnings.length ? (
          <p className="wakebook-voyage-card__warning">Some historical details are unavailable.</p>
        ) : null}
        <div className="wakebook-voyage-card__actions">
          <Link
            className="button button--primary"
            href={`/passport/history/${encodeURIComponent(item.id)}`}
            aria-label={`Open ${item.chronicle.historicalTitle} Voyage`}
          >
            Open Voyage
          </Link>
          {item.review ? (
            <Link className="button button--quiet" href={item.review.href}>
              Review Chronicle
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function FirstUseEmpty({ invitationOnly }: { invitationOnly: boolean }) {
  return (
    <section className="wakebook-empty" aria-labelledby="wakebook-empty-title">
      <div className="wakebook-empty__compass" aria-hidden="true">
        <span>✦</span>
      </div>
      <div>
        <p className="personal-harbor__eyebrow">Your shelf is ready</p>
        <h2 id="wakebook-empty-title">
          {invitationOnly ? "Your first played Voyage is still ahead" : "Every Voyage leaves a wake"}
        </h2>
        <p>
          After you join a Chronicle, its exact edition and your private journey record will settle here—without making
          any part of it public.
        </p>
        <div className="personal-harbor__actions">
          <Link className="button button--primary" href="/community/chronicles">
            Discover Chronicles
          </Link>
          <Link className="button" href="/player/invitation">
            Open an invitation
          </Link>
          <Link className="button button--quiet" href="/passport">
            Return to Chronicle Passport
          </Link>
        </div>
      </div>
    </section>
  );
}

function FilteredEmpty({ clear }: { clear: () => void }) {
  return (
    <section className="wakebook-empty wakebook-empty--filtered" aria-labelledby="wakebook-filtered-empty-title">
      <div className="wakebook-empty__compass" aria-hidden="true">
        <span>⌁</span>
      </div>
      <div>
        <p className="personal-harbor__eyebrow">No matching wake</p>
        <h2 id="wakebook-filtered-empty-title">No Voyages match these archive filters</h2>
        <p>Your history is unchanged. Clear the filters to return to the full private shelf.</p>
        <button className="button button--primary" type="button" onClick={clear}>
          Clear all filters
        </button>
      </div>
    </section>
  );
}

function compactDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return hours ? `${hours} hr${minutes ? ` ${minutes} min` : ""}` : `${minutes} min`;
}

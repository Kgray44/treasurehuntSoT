"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePersonalHarbor } from "@/components/homeport/PersonalHarborLayout";
import { MutationStatus } from "@/components/ui/AsyncState";
import { useActionDialog } from "@/components/ui/ActionDialog";
import type { VoyageDetail } from "@/wakebook/contracts";
import {
  crewInitials,
  formatArchiveDate,
  HistoricalCover,
  useWakebookResource,
  WakebookError,
  WakebookLoading,
  wakebookResponse,
} from "@/components/wakebook/WakebookShared";

type MemoryMediaOption = { id: string; kind: string; description: string | null };

export function WakebookTideglassComparisonEntry({ comparison }: { comparison?: VoyageDetail["comparison"] }) {
  if (!comparison) return null;
  return (
    <Link className="button button--quiet" href={comparison.href}>
      See what changed
    </Link>
  );
}

export function WakebookLanternwakeReplayEntry({ recordId }: { recordId: string }) {
  return (
    <Link className="button button--quiet" href={`/passport/history/${encodeURIComponent(recordId)}/replay`}>
      Replay this Journey
    </Link>
  );
}

export function WakebookVoyageDetail({ recordId }: { recordId: string }) {
  const resource = useWakebookResource<VoyageDetail>(`/api/passport/voyages/${encodeURIComponent(recordId)}`);
  const { csrfToken, setDirty } = usePersonalHarbor();
  const { requestAction, dialog } = useActionDialog();
  const [reflection, setReflection] = useState({
    privateNote: "",
    favoriteChapterId: "",
    favoriteArtifactReference: "",
    favoriteClueReference: "",
    favoriteMomentReference: "",
  });
  const [memory, setMemory] = useState({ title: "", body: "", referenceType: "", referenceId: "" });
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null);
  const [memoryMediaOptions, setMemoryMediaOptions] = useState<MemoryMediaOption[]>([]);
  const [attachmentMemoryId, setAttachmentMemoryId] = useState<string | null>(null);
  const [selectedMediaId, setSelectedMediaId] = useState("");
  const [message, setMessage] = useState("");
  const [mutationState, setMutationState] = useState<"pending" | "success" | "failure" | null>(null);

  useEffect(() => {
    if (resource.state.status !== "ready") return;
    const voyage = resource.state.value;
    // Hydrate the editable draft after the authoritative resource has settled.
    // Deferring the draft update avoids a synchronous cascading render while
    // preserving the server record as the only initialization source.
    const timer = window.setTimeout(() => {
      setReflection({
        privateNote: voyage.reflection?.privateNote ?? "",
        favoriteChapterId: voyage.reflection?.favoriteChapterId ?? "",
        favoriteArtifactReference: voyage.reflection?.favoriteArtifactReference ?? "",
        favoriteClueReference: voyage.reflection?.favoriteClueReference ?? "",
        favoriteMomentReference: voyage.reflection?.favoriteMomentReference ?? "",
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [resource.state]);
  useEffect(() => () => setDirty(false), [setDirty]);
  useEffect(() => {
    if (resource.state.status !== "ready") return;
    let cancelled = false;
    void fetch(`/api/passport/voyages/${encodeURIComponent(recordId)}/memory-media`, { cache: "no-store" })
      .then(async (response) => (response.ok ? ((await response.json()) as MemoryMediaOption[]) : []))
      .then((options) => {
        if (!cancelled) setMemoryMediaOptions(options);
      })
      .catch(() => {
        if (!cancelled) setMemoryMediaOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [recordId, resource.state]);

  if (resource.state.status === "loading")
    return <WakebookLoading detail="Opening the exact Chronicle edition and your private Voyage record." />;
  if (resource.state.status === "error")
    return <WakebookError message={resource.state.message} retry={resource.reload} />;
  const voyage = resource.state.value;

  const mutate = async (url: string, method: string, body?: unknown) => {
    setMessage("Saving your private archive…");
    setMutationState("pending");
    try {
      await wakebookResponse(
        await fetch(url, {
          method,
          headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
          ...(body ? { body: JSON.stringify(body) } : {}),
        }),
      );
      setMessage("Saved to your private archive.");
      setMutationState("success");
      setDirty(false);
      resource.reload();
      return true;
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "The private archive change could not be saved.");
      setMutationState("failure");
      return false;
    }
  };

  const removeMemory = async (memoryId: string, title: string) => {
    if (
      !(await requestAction({
        title: `Remove “${title}”?`,
        detail: "This private Memory will be soft-deleted. The version-pinned Voyage history will remain unchanged.",
        confirmLabel: "Remove Memory",
        destructive: true,
      }))
    )
      return;
    await mutate(
      `/api/passport/history/${encodeURIComponent(recordId)}/memories/${encodeURIComponent(memoryId)}`,
      "DELETE",
    );
  };

  return (
    <div className="wakebook-detail">
      <Link className="wakebook-detail__back" href="/passport/history">
        <span aria-hidden="true">←</span> Back to Your Voyages
      </Link>

      {voyage.warnings.length ? (
        <aside className="wakebook-notice" role="status">
          <strong>Some details were not preserved.</strong>
          <span>{voyage.warnings.join(" ")}</span>
        </aside>
      ) : null}

      <header className="wakebook-detail-hero">
        <HistoricalCover
          cover={voyage.chronicle.historicalCover}
          title={voyage.chronicle.historicalTitle}
          size="hero"
        />
        <div className="wakebook-detail-hero__body">
          <div className="wakebook-detail-hero__meta">
            <span className="wakebook-status">{voyage.lifecycle.humanLabel}</span>
            <span>{formatArchiveDate(voyage.chronology.archiveDate)}</span>
          </div>
          <p className="wakebook-edition">{voyage.chronicle.publishedVersionLabel || "Played edition"}</p>
          <h2>{voyage.chronicle.historicalTitle}</h2>
          <p className="wakebook-detail-hero__lede">
            {voyage.outcome.label}. You traveled as{" "}
            {voyage.participation.crewRole || voyage.participation.humanRole.toLocaleLowerCase()}.
          </p>
          <dl className="wakebook-detail-hero__facts">
            <div>
              <dt>Journey time</dt>
              <dd>{voyage.timing.wallClock.humanLabel}</dd>
            </div>
            <div>
              <dt>Historical crew</dt>
              <dd>{voyage.crew.length}</dd>
            </div>
            <div>
              <dt>Completed chapters</dt>
              <dd>{voyage.chapters.length || "Unavailable"}</dd>
            </div>
            <div>
              <dt>Historical Captain</dt>
              <dd>{voyage.attribution.captain.historicalLabel || "Unavailable"}</dd>
            </div>
            <div>
              <dt>Private Memories</dt>
              <dd>{voyage.memories.length}</dd>
            </div>
          </dl>
          <div className="personal-harbor__actions">
            <a className="button button--primary" href="#wakebook-remembrance">
              Add a Memory
            </a>
            <Link className="button" href="/passport/artifacts">
              Open Artifact Cabinet
            </Link>
            <WakebookTideglassComparisonEntry comparison={voyage.comparison} />
            <WakebookLanternwakeReplayEntry recordId={voyage.id} />
            {voyage.review ? (
              <Link className="button button--quiet" href={voyage.review.href}>
                Review Chronicle
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      <nav className="wakebook-detail-nav" aria-label="Voyage Detail sections">
        <a href="#wakebook-summary">Journey Summary</a>
        <a href="#wakebook-path">Path</a>
        <a href="#wakebook-crew">Crew</a>
        <a href="#wakebook-artifacts">Artifacts</a>
        <a href="#wakebook-achievements">Achievements</a>
        <a href="#wakebook-edition">Edition</a>
        <a href="#wakebook-remembrance">Remembrance</a>
        <a href="#wakebook-keepsake">Keepsake</a>
        <a href="#wakebook-provenance">Provenance</a>
      </nav>

      <div className="wakebook-detail-grid">
        <section className="wakebook-detail-section" id="wakebook-summary" aria-labelledby="wakebook-summary-title">
          <SectionHeading eyebrow="The shape of the journey" title="Journey Summary" id="wakebook-summary-title" />
          <dl className="wakebook-definition-grid">
            <Definition term="Lifecycle" value={voyage.lifecycle.humanLabel} />
            <Definition term="Outcome" value={voyage.outcome.label} />
            <Definition term="Started" value={formatArchiveDate(voyage.chronology.startedAt)} />
            <Definition term="Joined" value={formatArchiveDate(voyage.chronology.joinedAt)} />
            <Definition term="Completed" value={formatArchiveDate(voyage.chronology.completedAt)} />
            <Definition term="Participation" value={voyage.participation.crewRole || voyage.participation.humanRole} />
            <Definition term="Historical Creator" value={voyage.attribution.creator.historicalLabel || "Unavailable"} />
            <Definition term="Historical Captain" value={voyage.attribution.captain.historicalLabel || "Unavailable"} />
            <Definition
              term="Duration"
              value={voyage.timing.wallClock.humanLabel}
              note={qualityNote(voyage.timing.wallClock.quality)}
            />
            <Definition
              term="Timing evidence"
              value={
                voyage.timing.wallClock.quality === "EXACT" ? "Exact recorded history" : "Historical value unavailable"
              }
            />
          </dl>
        </section>

        <section className="wakebook-detail-section" id="wakebook-path" aria-labelledby="wakebook-path-title">
          <SectionHeading
            eyebrow="Accepted historical evidence"
            title="Path Through the Chronicle"
            id="wakebook-path-title"
          />
          {voyage.chapters.length ? (
            <ol className="wakebook-chapters">
              {voyage.chapters.map((chapter, index) => (
                <li key={`${chapter.title}-${chapter.completedAt}`}>
                  <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <strong>{chapter.title}</strong>
                    <time dateTime={chapter.completedAt}>{formatArchiveDate(chapter.completedAt)}</time>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <UnavailableHistory text="Exact completed-chapter history was not preserved for this edition." />
          )}
          <div className="wakebook-unavailable-grid">
            {voyage.optionalObjectives.available ? (
              <div className="wakebook-unavailable">
                <div>
                  <strong>Optional objectives</strong>
                  <p>
                    Completed {voyage.optionalObjectives.completedCount} of {voyage.optionalObjectives.totalCount}{" "}
                    optional objectives.
                  </p>
                  <ul>
                    {voyage.optionalObjectives.objectives.map((objective) => (
                      <li key={objective.label}>
                        {objective.completed ? "Completed" : "Not completed"}: {objective.label}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <UnavailableHistory
                title="Optional objectives"
                text={voyage.optionalObjectives.explanation || "Not available for this edition."}
              />
            )}
            {voyage.choices.available ? (
              <div className="wakebook-unavailable">
                <div>
                  <strong>Safe journey context</strong>
                  <ul>
                    {voyage.choices.items.map((choice) => (
                      <li key={`${choice.kind}-${choice.label}`}>
                        <strong>{choice.label}</strong>
                        {choice.detail ? ` — ${choice.detail}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <UnavailableHistory
                title="Detailed choices"
                text={voyage.choices.explanation || "Not available for this edition."}
              />
            )}
          </div>
        </section>

        <section className="wakebook-detail-section" id="wakebook-crew" aria-labelledby="wakebook-crew-title">
          <SectionHeading eyebrow="Historical snapshots" title="Crew" id="wakebook-crew-title" />
          {voyage.crew.length ? (
            <ul className="wakebook-crew-list">
              {voyage.crew.map((crew) => (
                <li key={`${crew.historicalDisplayName}-${crew.joinedAt ?? crew.role}`}>
                  <span className="wakebook-crew-avatar" aria-hidden="true">
                    {crewInitials(crew.historicalDisplayName)}
                  </span>
                  <div>
                    <strong>{crew.historicalDisplayName}</strong>
                    <span>
                      {crew.isHistoricalCaptain
                        ? `Captain · ${crew.crewRole || crew.humanRole}`
                        : crew.crewRole || crew.humanRole}
                    </span>
                  </div>
                  <small>
                    {crew.removedAt
                      ? "Left this Voyage"
                      : crew.completedAt
                        ? "Completed this Voyage"
                        : "Historical participant"}
                  </small>
                </li>
              ))}
            </ul>
          ) : (
            <UnavailableHistory text="Historical crew details are unavailable for this Voyage." />
          )}
        </section>

        <section className="wakebook-detail-section" id="wakebook-artifacts" aria-labelledby="wakebook-artifacts-title">
          <SectionHeading eyebrow="Context, not invented ownership" title="Artifacts" id="wakebook-artifacts-title" />
          <div className="wakebook-artifact-boundary">
            <div>
              <h3>Shared Voyage artifact moments</h3>
              {voyage.artifacts.sharedVoyageContext.length ? (
                <ul>
                  {voyage.artifacts.sharedVoyageContext.map((artifact) => (
                    <li key={`${artifact.name}-${artifact.revealedAt}`}>
                      {artifact.name}
                      <span>Witnessed in this Voyage</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No shared artifact moments were preserved for this Voyage.</p>
              )}
            </div>
            <div>
              <h3>Your Artifact Cabinet records</h3>
              {voyage.artifacts.personalRecords.length ? (
                <ul>
                  {voyage.artifacts.personalRecords.map((artifact) => (
                    <li key={artifact.id}>
                      <Link href={`/passport/artifacts/${encodeURIComponent(artifact.id)}`}>{artifact.name}</Link>
                      <span>{artifact.humanState}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>This Voyage does not prove a personal Artifact Cabinet record.</p>
              )}
            </div>
          </div>
          <p className="wakebook-boundary-note">
            A shared Voyage artifact is never presented as personally owned without Wayfarer provenance.
          </p>
          {voyage.artifacts.assemblies.length ? (
            <div className="wakebook-artifact-boundary">
              <div>
                <h3>Assembly context</h3>
                <ul>
                  {voyage.artifacts.assemblies.map((assembly) => (
                    <li key={assembly.id}>
                      {assembly.name}
                      <span>
                        {assembly.completedAt
                          ? `Completed ${formatArchiveDate(assembly.completedAt)}`
                          : assembly.status}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
          <Link className="button" href="/passport/artifacts">
            Browse your Artifact Cabinet
          </Link>
        </section>

        <section
          className="wakebook-detail-section"
          id="wakebook-achievements"
          aria-labelledby="wakebook-achievements-title"
        >
          <SectionHeading
            eyebrow="Deterministic historical evidence"
            title="Achievements"
            id="wakebook-achievements-title"
          />
          {voyage.achievements.length ? (
            <ul className="wakebook-memory-list">
              {voyage.achievements.map((achievement) => (
                <li key={achievement.id}>
                  <div>
                    <strong>{achievement.title}</strong>
                    <p>{achievement.description}</p>
                    <time dateTime={achievement.earnedAt || undefined}>
                      {achievement.earnedAt
                        ? `Recognized ${formatArchiveDate(achievement.earnedAt)}`
                        : "Historical recognition date unavailable"}
                    </time>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <UnavailableHistory text="No deterministic achievement evidence is associated with this Voyage." />
          )}
        </section>

        <section className="wakebook-detail-section" id="wakebook-edition" aria-labelledby="wakebook-edition-title">
          <SectionHeading eyebrow="The edition you actually played" title="Exact Edition" id="wakebook-edition-title" />
          <div className="wakebook-edition-panel">
            <div>
              <span>Historical label</span>
              <strong>{voyage.chronicle.publishedVersionLabel || "Played edition"}</strong>
            </div>
            <p>
              This Voyage remains pinned to its immutable published edition. Current Chronicle changes do not rewrite
              it.
            </p>
            <details>
              <summary>Edition provenance</summary>
              <dl>
                <Definition term="Published version ID" value={voyage.provenance.publishedVersionId} code />
                <Definition term="Published checksum" value={voyage.provenance.publishedVersionChecksum} code />
                <Definition term="Timing definition" value={voyage.provenance.metricDefinitionVersion} code />
                <Definition
                  term="Projection state"
                  value={
                    voyage.provenance.projectionStatus === "CURRENT" ? "Current" : "Supplementary refresh incomplete"
                  }
                />
              </dl>
            </details>
          </div>
        </section>

        <section
          className="wakebook-detail-section wakebook-remembrance"
          id="wakebook-remembrance"
          aria-labelledby="wakebook-remembrance-title"
        >
          <SectionHeading eyebrow="Owner-authored and private" title="Remembrance" id="wakebook-remembrance-title" />
          <p className="wakebook-section-lede">
            Your Reflection, Memories, and Keepsake enrich this archive without changing what happened.
          </p>
          <div className="wakebook-remembrance-grid">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void mutate(`/api/passport/history/${encodeURIComponent(recordId)}`, "PATCH", {
                  privateNote: reflection.privateNote || null,
                  favoriteChapterId: reflection.favoriteChapterId || null,
                  favoriteArtifactReference: reflection.favoriteArtifactReference || null,
                  favoriteClueReference: reflection.favoriteClueReference || null,
                  favoriteMomentReference: reflection.favoriteMomentReference || null,
                });
              }}
            >
              <h3>Private Reflection</h3>
              <label>
                <span>What do you want to remember?</span>
                <textarea
                  rows={7}
                  maxLength={4000}
                  value={reflection.privateNote}
                  onChange={(event) => {
                    setReflection({ ...reflection, privateNote: event.target.value });
                    setDirty(true);
                  }}
                />
              </label>
              <label>
                <span>Favorite chapter</span>
                <select
                  value={reflection.favoriteChapterId}
                  onChange={(event) => {
                    setReflection({ ...reflection, favoriteChapterId: event.target.value });
                    setDirty(true);
                  }}
                >
                  <option value="">No favorite selected</option>
                  {voyage.chapters.map((chapter) => (
                    <option key={chapter.id} value={chapter.id}>
                      {chapter.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Favorite artifact</span>
                <select
                  value={reflection.favoriteArtifactReference}
                  onChange={(event) => {
                    setReflection({ ...reflection, favoriteArtifactReference: event.target.value });
                    setDirty(true);
                  }}
                >
                  <option value="">No favorite selected</option>
                  {voyage.artifacts.personalRecords.map((artifact) => (
                    <option key={artifact.id} value={artifact.id}>
                      {artifact.name}
                    </option>
                  ))}
                </select>
              </label>
              <button className="button button--primary">Save Reflection</button>
            </form>
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                const saved = await mutate(
                  editingMemoryId
                    ? `/api/passport/history/${encodeURIComponent(recordId)}/memories/${encodeURIComponent(editingMemoryId)}`
                    : `/api/passport/history/${encodeURIComponent(recordId)}/memories`,
                  editingMemoryId ? "PUT" : "POST",
                  {
                    title: memory.title,
                    body: memory.body || undefined,
                    referenceType: memory.referenceType || undefined,
                    referenceId: memory.referenceId || undefined,
                  },
                );
                if (saved) {
                  setMemory({ title: "", body: "", referenceType: "", referenceId: "" });
                  setEditingMemoryId(null);
                }
              }}
            >
              <h3>{editingMemoryId ? "Edit Chronicle Memory" : "Add a Chronicle Memory"}</h3>
              <label>
                <span>Memory title</span>
                <input
                  required
                  maxLength={120}
                  value={memory.title}
                  onChange={(event) => {
                    setMemory({ ...memory, title: event.target.value });
                    setDirty(true);
                  }}
                />
              </label>
              <label>
                <span>Your private Memory</span>
                <textarea
                  rows={5}
                  maxLength={4000}
                  value={memory.body}
                  onChange={(event) => {
                    setMemory({ ...memory, body: event.target.value });
                    setDirty(true);
                  }}
                />
              </label>
              <label>
                <span>Connect this Memory to</span>
                <select
                  value={memory.referenceType}
                  onChange={(event) => {
                    setMemory({ ...memory, referenceType: event.target.value, referenceId: "" });
                    setDirty(true);
                  }}
                >
                  <option value="">This whole Voyage</option>
                  <option value="CHAPTER">A completed chapter</option>
                  <option value="ARTIFACT">An Artifact Cabinet record</option>
                </select>
              </label>
              {memory.referenceType ? (
                <label>
                  <span>{memory.referenceType === "CHAPTER" ? "Completed chapter" : "Artifact Cabinet record"}</span>
                  <select
                    required
                    value={memory.referenceId}
                    onChange={(event) => {
                      setMemory({ ...memory, referenceId: event.target.value });
                      setDirty(true);
                    }}
                  >
                    <option value="">Choose a historical reference</option>
                    {(memory.referenceType === "CHAPTER" ? voyage.chapters : voyage.artifacts.personalRecords).map(
                      (entry) => (
                        <option key={entry.id} value={entry.id}>
                          {"name" in entry ? entry.name : entry.title}
                        </option>
                      ),
                    )}
                  </select>
                </label>
              ) : null}
              <div className="personal-harbor__actions">
                <button className="button button--primary">{editingMemoryId ? "Save Memory" : "Add Memory"}</button>
                {editingMemoryId ? (
                  <button
                    className="button button--quiet"
                    type="button"
                    onClick={() => {
                      setEditingMemoryId(null);
                      setMemory({ title: "", body: "", referenceType: "", referenceId: "" });
                      setDirty(false);
                    }}
                  >
                    Cancel edit
                  </button>
                ) : null}
              </div>
            </form>
          </div>
          <div className="wakebook-memory-list">
            <div>
              <h3>Saved Memories</h3>
              <Link href="/passport/memories">Open all Memories</Link>
            </div>
            {voyage.memories.length ? (
              <ul>
                {voyage.memories.map((item) => (
                  <li key={item.id}>
                    <div>
                      <strong>{item.title}</strong>
                      {item.body ? <p>{item.body}</p> : null}
                      <time dateTime={item.createdAt}>{formatArchiveDate(item.createdAt)}</time>
                      {item.media.length ? (
                        <ul aria-label={`Private media attached to ${item.title}`}>
                          {item.media.map((media) => (
                            <li key={media.id}>
                              {media.deliveryHref ? (
                                <a href={media.deliveryHref} target="_blank" rel="noreferrer">
                                  Open private {media.kind.toLocaleLowerCase()}
                                </a>
                              ) : (
                                <span>Private {media.kind.toLocaleLowerCase()} unavailable</span>
                              )}
                              {media.description ? ` — ${media.description}` : ""}
                              {media.state !== "AVAILABLE" ? ` (${media.state.toLocaleLowerCase()})` : ""}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                    <button
                      className="button button--danger"
                      type="button"
                      onClick={() => void removeMemory(item.id, item.title)}
                    >
                      Remove
                    </button>
                    <button
                      className="button button--quiet"
                      type="button"
                      onClick={() => {
                        setEditingMemoryId(item.id);
                        setMemory({
                          title: item.title,
                          body: item.body || "",
                          referenceType: item.referenceType || "",
                          referenceId: item.referenceId || "",
                        });
                        setDirty(true);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="button button--quiet"
                      type="button"
                      onClick={() => {
                        setAttachmentMemoryId(item.id);
                        setSelectedMediaId("");
                      }}
                    >
                      Attach private media
                    </button>
                    {attachmentMemoryId === item.id ? (
                      <div className="personal-harbor__actions">
                        <label>
                          <span className="sr-only">Available private media</span>
                          <select value={selectedMediaId} onChange={(event) => setSelectedMediaId(event.target.value)}>
                            <option value="">Choose available private media</option>
                            {memoryMediaOptions.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.kind.toLocaleLowerCase()}
                                {option.description ? ` — ${option.description}` : ""}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          className="button button--primary"
                          type="button"
                          disabled={!selectedMediaId}
                          onClick={() =>
                            void mutate(
                              `/api/passport/voyages/${encodeURIComponent(recordId)}/memories/${encodeURIComponent(item.id)}/media`,
                              "POST",
                              { mediaId: selectedMediaId },
                            ).then((saved) => {
                              if (saved) {
                                setAttachmentMemoryId(null);
                                setSelectedMediaId("");
                              }
                            })
                          }
                        >
                          Attach
                        </button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="wakebook-soft-empty">No private Memories have been added to this Voyage.</p>
            )}
          </div>
          <div className="wakebook-keepsake" id="wakebook-keepsake">
            <div>
              <p className="personal-harbor__eyebrow">Private Keepsake</p>
              <h3>{voyage.keepsake ? voyage.keepsake.humanStatus : "Prepare a private Keepsake"}</h3>
              <p>
                {voyage.keepsake
                  ? voyage.keepsake.explanation ||
                    `Generated ${formatArchiveDate(voyage.keepsake.generatedAt)}. Participant representation remains consent-scoped.`
                  : "A Keepsake assembles accepted Voyage facts and your remembrance without publishing them."}
              </p>
              {voyage.keepsake?.consent.length ? (
                <ul aria-label="Keepsake consent decisions">
                  {voyage.keepsake.consent.map((consent) => (
                    <li key={`${consent.scope}-${consent.historicalLabel || "participant"}`}>
                      {consent.historicalLabel || "Historical participant"}:{" "}
                      {consent.scope.replaceAll("_", " ").toLocaleLowerCase()} — {consent.state.toLocaleLowerCase()}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div className="personal-harbor__actions">
              {voyage.keepsake ? (
                <>
                  <button
                    className="button button--primary"
                    type="button"
                    onClick={() =>
                      void mutate(`/api/passport/history/${encodeURIComponent(recordId)}/keepsake`, "POST")
                    }
                  >
                    Refresh private Keepsake
                  </button>
                  <button
                    className="button"
                    type="button"
                    onClick={() =>
                      void mutate(`/api/passport/history/${encodeURIComponent(recordId)}/keepsake/consent`, "PUT", {
                        scope: "DISPLAY_NAME",
                        state: "GRANTED",
                      })
                    }
                  >
                    Allow my display name in this Keepsake
                  </button>
                  <button
                    className="button button--quiet"
                    type="button"
                    onClick={() =>
                      void mutate(`/api/passport/history/${encodeURIComponent(recordId)}/keepsake/consent`, "PUT", {
                        scope: "DISPLAY_NAME",
                        state: "REVOKED",
                      })
                    }
                  >
                    Revoke name consent
                  </button>
                </>
              ) : (
                <button
                  className="button button--primary"
                  type="button"
                  onClick={() => void mutate(`/api/passport/history/${encodeURIComponent(recordId)}/keepsake`, "POST")}
                >
                  Prepare private Keepsake
                </button>
              )}
            </div>
          </div>
        </section>

        <section
          className="wakebook-detail-section"
          id="wakebook-provenance"
          aria-labelledby="wakebook-provenance-title"
        >
          <SectionHeading
            eyebrow="Owner-only, advanced details"
            title="Technical Provenance"
            id="wakebook-provenance-title"
          />
          <details className="wakebook-edition-panel">
            <summary>Show historical source and quality details</summary>
            <dl>
              <Definition term="History record" value={voyage.provenance.historyRecordId} code />
              <Definition term="Source Voyage" value={voyage.provenance.sourcePlaythroughId} code />
              <Definition term="Source membership" value={voyage.provenance.sourceMembershipId || "Unavailable"} code />
              <Definition term="Last reconciled" value={formatArchiveDate(voyage.provenance.lastDerivedAt)} />
              {voyage.provenance.fields.map((field) => (
                <Definition
                  key={field.label}
                  term={field.label}
                  value={`${field.quality.toLocaleLowerCase()} historical evidence`}
                />
              ))}
            </dl>
          </details>
        </section>
      </div>

      {message && mutationState ? <MutationStatus state={mutationState}>{message}</MutationStatus> : null}
      {dialog}
    </div>
  );
}

function SectionHeading({ eyebrow, title, id }: { eyebrow: string; title: string; id: string }) {
  return (
    <header className="wakebook-section-heading">
      <p className="personal-harbor__eyebrow">{eyebrow}</p>
      <h2 id={id}>{title}</h2>
    </header>
  );
}

function Definition({
  term,
  value,
  note,
  code = false,
}: {
  term: string;
  value: string;
  note?: string;
  code?: boolean;
}) {
  return (
    <div>
      <dt>{term}</dt>
      <dd className={code ? "wakebook-code" : undefined}>
        {value}
        {note ? <small>{note}</small> : null}
      </dd>
    </div>
  );
}

function UnavailableHistory({ title, text }: { title?: string; text: string }) {
  return (
    <div className="wakebook-unavailable">
      <span aria-hidden="true">⌁</span>
      <div>
        {title ? <strong>{title}</strong> : null}
        <p>{sentenceCase(text)}</p>
      </div>
    </div>
  );
}

function qualityNote(quality: string) {
  if (quality === "ESTIMATED") return "Approximate historical value";
  if (quality === "UNAVAILABLE") return "This edition did not preserve a trustworthy duration";
  if (quality === "NOT_APPLICABLE") return "This metric did not apply";
  return "Versioned exact timing evidence";
}

function sentenceCase(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed[0]!.toLocaleUpperCase() + trimmed.slice(1) : value;
}

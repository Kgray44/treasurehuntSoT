"use client";

/* eslint-disable @next/next/no-img-element -- Journal media is served by the authorized, version-bound media route. */
import type { JournalAsset } from "@/components/player/journal/TallTaleJournalPage";
import type {
  PlayerJournalBlock,
  PlayerJournalProjection,
  PlayerJournalReadingState,
  PlayerJournalReadingStateInput,
} from "@/tall-tale/journal-contract";
import type { ExperienceSection } from "@/lib/experience-routes";

type SectionPagesProps = {
  section: Exclude<ExperienceSection, "chapters">;
  journal: PlayerJournalProjection;
  assets: JournalAsset[];
  reading: PlayerJournalReadingState;
  onReadingChange: (patch: PlayerJournalReadingStateInput) => void;
  onOpenInBook: (block: PlayerJournalBlock) => void;
};

export function ExperienceSectionPages(props: SectionPagesProps) {
  if (props.section === "map") return <VoyageMapPage {...props} />;
  if (props.section === "artifacts") return <ArtifactArchivePage {...props} />;
  return <MessagesPage {...props} />;
}

function VoyageMapPage({ journal, reading, onReadingChange, onOpenInBook }: SectionPagesProps) {
  const locations = journal.chapters
    .flatMap((chapter) => chapter.blocks)
    .filter((block) => block.journalKind === "map" || block.journalKind === "locationVerification");
  const selected =
    locations.find((block) => block.id === reading.mapSelectedId) ??
    locations.find((block) => block.id === journal.currentBlockId) ??
    locations[0] ??
    null;

  return (
    <section className="experience-page experience-map-page" aria-labelledby="experience-map-heading">
      <SectionHeading
        eyebrow="Voyage chart"
        id="experience-map-heading"
        title="Map"
        detail="Released bearings, verified locations, and the crew's current objective share one full chart."
      />
      {!locations.length ? (
        <SectionEmpty
          title="No chart marks have been released"
          detail="The map will unfold when the voyage reveals a location."
        />
      ) : (
        <div className="experience-map-layout">
          <div className="experience-map-canvas" aria-label="Released voyage locations">
            <div className="map-compass" aria-hidden="true">
              N
            </div>
            <div className="map-legend" aria-label="Map legend">
              <span className="active">Current</span>
              <span className="completed">Completed</span>
              <span className="released">Released</span>
            </div>
            <div className="experience-map-surface" style={{ "--map-zoom": reading.mapZoom } as React.CSSProperties}>
              {locations.map((block, index) => {
                const point = mapPoint(block, index);
                return (
                  <button
                    type="button"
                    className={`map-marker state-${block.progress}`}
                    style={{ left: `${point.x}%`, top: `${point.y}%` }}
                    aria-pressed={selected?.id === block.id}
                    aria-label={`${block.title}, ${block.progress}`}
                    key={block.id}
                    onClick={() => onReadingChange({ mapSelectedId: block.id })}
                  >
                    <span aria-hidden="true">✦</span>
                    <strong>{block.title}</strong>
                  </button>
                );
              })}
            </div>
            <label className="map-zoom-control">
              <span>Chart scale</span>
              <input
                aria-label="Map zoom"
                type="range"
                min="0.75"
                max="2"
                step="0.05"
                value={reading.mapZoom}
                onChange={(event) => onReadingChange({ mapZoom: Number(event.target.value) })}
              />
            </label>
          </div>
          {selected && (
            <article className="experience-detail-panel map-detail-panel">
              <p className="eyebrow">{progressLabel(selected)}</p>
              <h3>{selected.title}</h3>
              <p>{blockCopy(selected)}</p>
              <dl>
                <div>
                  <dt>Chapter</dt>
                  <dd>{chapterTitle(journal, selected.chapterId)}</dd>
                </div>
                <div>
                  <dt>Revealed</dt>
                  <dd>{formatDateTime(selected.releasedAt)}</dd>
                </div>
              </dl>
              <button type="button" className="button-secondary" onClick={() => onOpenInBook(selected)}>
                Open this leaf in Chapters
              </button>
            </article>
          )}
        </div>
      )}
    </section>
  );
}

function ArtifactArchivePage({ journal, assets, reading, onReadingChange, onOpenInBook }: SectionPagesProps) {
  const artifacts = journal.chapters
    .flatMap((chapter) => chapter.blocks)
    .filter((block) => block.journalKind === "artifact");
  const selected =
    artifacts.find((block) => block.id === reading.artifactSelectedId) ??
    artifacts.find((block) => block.id === journal.currentBlockId) ??
    artifacts[0] ??
    null;

  return (
    <section className="experience-page experience-artifacts-page" aria-labelledby="experience-artifacts-heading">
      <SectionHeading
        eyebrow="Recovered collection"
        id="experience-artifacts-heading"
        title="Artifacts"
        detail="Inspect every released object without squeezing its story into the journal margin."
      />
      {!artifacts.length ? (
        <SectionEmpty
          title="The artifact cases are still sealed"
          detail="Undiscovered objects remain unnamed until the Captain releases them."
        />
      ) : (
        <div className="artifact-archive-layout">
          <div className="artifact-gallery" role="group" aria-label="Released artifacts">
            {artifacts.map((block) => {
              const image = assetForBlock(block, assets);
              return (
                <button
                  type="button"
                  className={`artifact-card state-${block.progress}`}
                  aria-pressed={selected?.id === block.id}
                  key={block.id}
                  onClick={() => onReadingChange({ artifactSelectedId: block.id })}
                >
                  <span className="artifact-card-image">
                    {image ? (
                      <img src={image.url} alt={image.description ?? image.displayName} />
                    ) : (
                      <span className="artifact-silhouette" aria-label="No published artifact image">
                        ✦
                      </span>
                    )}
                  </span>
                  <span>
                    <small>{progressLabel(block)}</small>
                    <strong>{block.title}</strong>
                    <em>{chapterTitle(journal, block.chapterId)}</em>
                  </span>
                </button>
              );
            })}
          </div>
          {selected && (
            <ArtifactDetail
              block={selected}
              image={assetForBlock(selected, assets)}
              chapter={chapterTitle(journal, selected.chapterId)}
              onOpenInBook={onOpenInBook}
            />
          )}
        </div>
      )}
    </section>
  );
}

function ArtifactDetail({
  block,
  image,
  chapter,
  onOpenInBook,
}: {
  block: PlayerJournalBlock;
  image: JournalAsset | undefined;
  chapter: string;
  onOpenInBook: (block: PlayerJournalBlock) => void;
}) {
  return (
    <article className="experience-detail-panel artifact-detail-panel">
      <div className="artifact-inspection-image">
        {image ? (
          <img src={image.url} alt={image.description ?? image.displayName} />
        ) : (
          <span aria-label="No published artifact image">✦</span>
        )}
      </div>
      <p className="eyebrow">{progressLabel(block)}</p>
      <h3>{block.title}</h3>
      <p>{blockCopy(block)}</p>
      <dl>
        <div>
          <dt>Chapter</dt>
          <dd>{chapter}</dd>
        </div>
        <div>
          <dt>Discovered</dt>
          <dd>{formatDateTime(block.releasedAt)}</dd>
        </div>
      </dl>
      <button type="button" className="button-secondary" onClick={() => onOpenInBook(block)}>
        Open story annotation in Chapters
      </button>
    </article>
  );
}

function MessagesPage({ journal, assets, reading, onReadingChange, onOpenInBook }: SectionPagesProps) {
  const messages = journal.chapters
    .flatMap((chapter) => chapter.blocks)
    .filter((block) => block.journalKind === "message")
    .sort((left, right) => Date.parse(left.releasedAt ?? "") - Date.parse(right.releasedAt ?? ""));
  const selected =
    messages.find((block) => block.id === reading.messageSelectedId) ??
    messages.find((block) => block.id === journal.currentBlockId) ??
    messages.at(-1) ??
    null;

  function selectMessage(block: PlayerJournalBlock) {
    onReadingChange({
      messageSelectedId: block.id,
      readMessageIds: Array.from(new Set([...reading.readMessageIds, block.id])),
    });
  }

  return (
    <section className="experience-page experience-messages-page" aria-labelledby="experience-messages-heading">
      <SectionHeading
        eyebrow="Voyage correspondence"
        id="experience-messages-heading"
        title="Messages"
        detail="Captain's notes, story letters, and released notices remain readable as part of the voyage record."
      />
      {!messages.length ? (
        <SectionEmpty
          title="No correspondence has arrived"
          detail="Released letters and Captain's notes will collect here."
        />
      ) : (
        <div className="messages-layout">
          <ol className="message-list" aria-label="Message history">
            {messages.map((block) => {
              const unread = !reading.readMessageIds.includes(block.id);
              return (
                <li key={block.id}>
                  <button
                    type="button"
                    aria-current={selected?.id === block.id ? "true" : undefined}
                    onClick={() => selectMessage(block)}
                  >
                    <span className={`message-seal ${unread ? "unread" : "read"}`} aria-hidden="true" />
                    <span>
                      <strong>{block.title}</strong>
                      <small>
                        {chapterTitle(journal, block.chapterId)} · {formatDateTime(block.releasedAt)}
                      </small>
                    </span>
                    {unread && <em>Unread</em>}
                  </button>
                </li>
              );
            })}
          </ol>
          {selected && (
            <article className="experience-detail-panel message-reading-panel" aria-live="polite">
              <p className="eyebrow">{chapterTitle(journal, selected.chapterId)}</p>
              <h3>{selected.title}</h3>
              {blockCopy(selected)
                .split(/\n+/)
                .filter(Boolean)
                .map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              {configText(selected, "signature") && (
                <p className="message-signature">{configText(selected, "signature")}</p>
              )}
              {assetForBlock(selected, assets) && (
                <img
                  className="message-attachment"
                  src={assetForBlock(selected, assets)!.url}
                  alt={assetForBlock(selected, assets)!.description ?? assetForBlock(selected, assets)!.displayName}
                />
              )}
              <footer>
                <time dateTime={selected.releasedAt ?? undefined}>{formatDateTime(selected.releasedAt)}</time>
                <button type="button" className="button-secondary" onClick={() => onOpenInBook(selected)}>
                  Open letter in Chapters
                </button>
              </footer>
            </article>
          )}
        </div>
      )}
    </section>
  );
}

function SectionHeading({
  eyebrow,
  id,
  title,
  detail,
}: {
  eyebrow: string;
  id: string;
  title: string;
  detail: string;
}) {
  return (
    <header className="experience-page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 id={id}>{title}</h2>
      </div>
      <p>{detail}</p>
    </header>
  );
}

function SectionEmpty({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="experience-section-empty">
      <span aria-hidden="true">✦</span>
      <h3>{title}</h3>
      <p>{detail}</p>
    </div>
  );
}

function progressLabel(block: PlayerJournalBlock) {
  return block.progress === "active" ? "Current objective" : block.progress === "completed" ? "Completed" : "Released";
}

function chapterTitle(journal: PlayerJournalProjection, chapterId: string) {
  return journal.chapters.find((chapter) => chapter.id === chapterId)?.title ?? "Uncharted chapter";
}

function configText(block: PlayerJournalBlock, key: string) {
  const value = block.configuration[key];
  return typeof value === "string" ? value : "";
}

function blockCopy(block: PlayerJournalBlock) {
  for (const key of [
    "playerDescription",
    "description",
    "body",
    "text",
    "message",
    "directionText",
    "objective",
    "prompt",
    "waitingText",
    "riddleText",
    "lore",
  ]) {
    const value = configText(block, key);
    if (value) return value;
  }
  return "This released leaf contains no additional written annotation.";
}

function assetForBlock(block: PlayerJournalBlock, assets: JournalAsset[]) {
  const config = block.configuration;
  const id =
    config.assetId ??
    config.mapAssetId ??
    config.revealArtworkId ??
    config.artworkAssetId ??
    config.backgroundAssetId ??
    config.afterAssetId ??
    config.revealedAssetId;
  return assets.find((asset) => asset.id === id);
}

function mapPoint(block: PlayerJournalBlock, index: number) {
  const rawX = Number(block.configuration.mapX ?? block.configuration.x ?? block.configuration.focalX);
  const rawY = Number(block.configuration.mapY ?? block.configuration.y ?? block.configuration.focalY);
  return {
    x: Number.isFinite(rawX) ? Math.min(88, Math.max(12, rawX)) : 16 + ((index * 29) % 70),
    y: Number.isFinite(rawY) ? Math.min(82, Math.max(16, rawY)) : 20 + ((index * 23) % 58),
  };
}

function formatDateTime(value: string | null) {
  if (!value) return "Time unrecorded";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

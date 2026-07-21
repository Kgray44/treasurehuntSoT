"use client";

/* eslint-disable @next/next/no-img-element -- Version-bound journal media is authorized by the application route. */
import type { PlayerJournalBlock } from "@/chronicle/journal-contract";
import type { ChronicleJournalPage } from "@/chronicle/journal-page-model";

export type JournalAsset = {
  id: string;
  displayName: string;
  description: string | null;
  mediaType: string;
  url: string;
};

export function ChronicleJournalPageContent({ page, assets }: { page: ChronicleJournalPage; assets: JournalAsset[] }) {
  return (
    <div className={`journal-leaf chronicle-leaf page-kind-${page.kind}`}>
      <div className="paper-fibers" aria-hidden="true" />
      <span className="folio">â€” {page.folio} â€”</span>
      {page.kind === "title" && (
        <>
          <p className="eyebrow">Chronicle Journal</p>
          <h3>{page.title}</h3>
          <p className="journal-prose">{page.body}</p>
          <div className="journal-compass-mark" aria-hidden="true">
            âœ¦
          </div>
        </>
      )}
      {page.kind === "edition" && (
        <>
          <p className="eyebrow">Edition mark</p>
          <h3>{page.title}</h3>
          <p className="journal-prose">{page.body}</p>
          <p className="captain-hand">This binding preserves the exact published voyage.</p>
        </>
      )}
      {page.kind === "chapter" && (
        <>
          <p className="eyebrow">Chapter divider</p>
          <h3>{page.title}</h3>
          <p className="journal-prose">{page.body}</p>
          <div className="chapter-divider-rule" aria-hidden="true">
            <i />
            <span>âœ¦</span>
            <i />
          </div>
        </>
      )}
      {page.kind === "block" && page.block && (
        <JournalBlock block={page.block} part={page.part ?? "primary"} assets={assets} />
      )}
      {page.kind === "endpaper" && (
        <>
          <p className="eyebrow">Endpaper</p>
          <h3>{page.title}</h3>
          <p className="journal-prose">{page.body}</p>
          <div className="endpaper-chart" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
        </>
      )}
      <div className="margin-sketch" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
    </div>
  );
}

function JournalBlock({
  block,
  part,
  assets,
}: {
  block: PlayerJournalBlock;
  part: "primary" | "secondary";
  assets: JournalAsset[];
}) {
  const config = block.configuration;
  const asset = (id: unknown) => assets.find((item) => item.id === id);
  const text = blockText(block);
  const copy = splitCopy(text, part, block.presentation.spreadMode === "two-page");
  const heading =
    value(config, "heading") ||
    value(config, "riddleTitle") ||
    value(config, "playerTitle") ||
    value(config, "loreTitle") ||
    value(config, "finaleHeading") ||
    block.title;
  const imageId =
    config.assetId ??
    config.mapAssetId ??
    config.revealArtworkId ??
    config.artworkAssetId ??
    config.backgroundAssetId ??
    config.afterAssetId ??
    config.revealedAssetId;
  const image = asset(imageId);
  const stateLabel =
    block.progress === "active" ? "Current page" : block.progress === "completed" ? "Completed" : "Released";

  if (block.journalKind === "cinematic") {
    const video = asset(config.videoAssetId);
    const audio = asset(config.audioAssetId);
    return (
      <section className="journal-block journal-cinematic-page" aria-label={block.title}>
        <p className="eyebrow">Cinematic leaf · {stateLabel}</p>
        <h3>{heading}</h3>
        {video && (
          <video controls preload="metadata" poster={asset(config.posterAssetId)?.url}>
            <source src={video.url} />
          </video>
        )}
        {audio && <audio controls preload="metadata" src={audio.url} />}
        {copy.map((line, index) => (
          <p className="journal-prose" key={index}>
            {line}
          </p>
        ))}
        {value(config, "transcript") && <p className="journal-transcript">Transcript: {value(config, "transcript")}</p>}
      </section>
    );
  }

  if (["artifact", "map"].includes(block.journalKind) || (block.journalKind === "story" && image)) {
    const before = asset(config.beforeAssetId ?? config.baseAssetId);
    const after = asset(config.afterAssetId ?? config.revealedAssetId);
    return (
      <section className={`journal-block journal-${block.journalKind}-page part-${part}`} aria-label={block.title}>
        <p className="eyebrow">
          {journalEyebrow(block)} · {stateLabel}
        </p>
        <h3>
          {heading}
          {part === "secondary" ? " · continued" : ""}
        </h3>
        <div className="journal-illustration">
          {before && after ? (
            <div
              className="journal-transformation"
              style={{ "--journal-reveal-duration": `${Number(config.duration ?? 3000)}ms` } as React.CSSProperties}
            >
              <img className="before" src={before.url} alt={`${before.displayName}, before reveal`} />
              <img
                className="after"
                src={after.url}
                alt={value(config, "altText") || after.description || after.displayName}
              />
            </div>
          ) : image ? (
            <img
              src={image.url}
              alt={value(config, "altText") || image.description || image.displayName}
              style={{ objectPosition: `${Number(config.focalX ?? 50)}% ${Number(config.focalY ?? 50)}%` }}
            />
          ) : (
            <div className="journal-illustration-fallback" aria-label="No illustration was published for this page">
              âœ¦
            </div>
          )}
        </div>
        {copy.map((line, index) => (
          <p className="journal-prose" key={index}>
            {line}
          </p>
        ))}
      </section>
    );
  }

  if (block.journalKind === "decision") {
    const choices = Array.isArray(config.choices) ? (config.choices as Array<Record<string, unknown>>) : [];
    return (
      <section className="journal-block journal-decision-page" aria-label={block.title}>
        <p className="eyebrow">A course was offered · {stateLabel}</p>
        <h3>{heading}</h3>
        {copy.map((line, index) => (
          <p className="journal-prose" key={index}>
            {line}
          </p>
        ))}
        <ul className="journal-choice-scraps">
          {choices.map((choice) => {
            const selected = block.selectedTargetId === String(choice.targetBlockId ?? "");
            return (
              <li
                className={selected ? "selected" : ""}
                key={String(choice.id ?? choice.targetBlockId ?? choice.label)}
              >
                <strong>{String(choice.label ?? "Choice")}</strong>
                {choice.description ? <span>{String(choice.description)}</span> : null}
                {selected && <em>Chosen on this voyage</em>}
              </li>
            );
          })}
        </ul>
      </section>
    );
  }

  if (block.journalKind === "message") {
    return (
      <section className="journal-block journal-message-page" aria-label={block.title}>
        <div className="loose-letter">
          <p className="eyebrow">A letter tucked into the binding</p>
          <h3>{heading}</h3>
          {copy.map((line, index) => (
            <p className="journal-prose" key={index}>
              {line}
            </p>
          ))}
          {value(config, "signature") && <p className="captain-hand">{value(config, "signature")}</p>}
        </div>
      </section>
    );
  }

  return (
    <section className={`journal-block journal-${block.journalKind}-page`} aria-label={block.title}>
      <p className="eyebrow">
        {journalEyebrow(block)} · {stateLabel}
      </p>
      <h3>{heading}</h3>
      {block.journalKind === "riddle" ? (
        <blockquote>
          {copy.map((line, index) => (
            <span key={index}>{line}</span>
          ))}
        </blockquote>
      ) : (
        copy.map((line, index) => (
          <p className="journal-prose" key={index}>
            {line}
          </p>
        ))
      )}
      {Array.isArray(config.releasedHints) && config.releasedHints.length > 0 && (
        <aside className="released-hints" aria-label="Released hints">
          <strong>Notes released by the Captain</strong>
          <ol>
            {config.releasedHints.map((hint, index) => (
              <li key={index}>{String(hint)}</li>
            ))}
          </ol>
        </aside>
      )}
      {block.journalKind === "locationVerification" && block.progress === "active" && (
        <div className="verification-seal">
          <span aria-hidden="true">â—‡</span>
          <strong>Awaiting verification</strong>
        </div>
      )}
      {block.journalKind === "chapterComplete" && (
        <div className="completion-stamp" aria-hidden="true">
          COMPLETE
        </div>
      )}
    </section>
  );
}

function value(config: Record<string, unknown>, key: string) {
  return typeof config[key] === "string" ? String(config[key]) : "";
}

function blockText(block: PlayerJournalBlock) {
  const config = block.configuration;
  return (
    value(config, "body") ||
    value(config, "riddleText") ||
    value(config, "directionText") ||
    value(config, "playerDescription") ||
    value(config, "prompt") ||
    value(config, "waitingText") ||
    value(config, "loreDescription") ||
    value(config, "caption") ||
    value(config, "messageText") ||
    value(config, "summary") ||
    value(config, "finaleContent") ||
    value(config, "completionMessage") ||
    block.title
  );
}

function splitCopy(value: string, part: "primary" | "secondary", split: boolean) {
  const lines = value
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!split || lines.length < 2) return part === "secondary" ? [] : lines;
  const midpoint = Math.ceil(lines.length / 2);
  return part === "primary" ? lines.slice(0, midpoint) : lines.slice(midpoint);
}

function journalEyebrow(block: PlayerJournalBlock) {
  const labels: Record<PlayerJournalBlock["journalKind"], string> = {
    story: "Narrative Passage",
    riddle: "Riddle in the margin",
    map: "Voyage chart",
    artifact: "Recovered artifact",
    decision: "Player decision",
    objective: "Current objective",
    locationVerification: "Location verification",
    message: "Sealed message",
    cinematic: "Cinematic passage",
    chapterComplete: block.blockType === "taleComplete" ? "Chronicle complete" : "Chapter complete",
  };
  return labels[block.journalKind];
}

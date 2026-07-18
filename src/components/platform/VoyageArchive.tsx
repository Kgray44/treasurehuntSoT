"use client";

/* eslint-disable @next/next/no-img-element -- Historical media remains authorized against this exact playthrough version. */
import Link from "next/link";
import { useEffect, useState } from "react";

type Archive = {
  playthrough: {
    id: string;
    voyageName: string;
    completedAt: string;
    versionLabel: string;
    versionPublishedAt: string;
    checksum: string;
  };
  tale: { title: string; subtitle: string | null; shortDescription: string | null };
  chapters: Array<{
    id: string;
    title: string;
    subtitle: string | null;
    blocks: Array<{ id: string; title: string; blockType: string; configuration: Record<string, unknown> }>;
  }>;
  assets: Array<{ id: string; displayName: string; description: string | null; mediaType: string; url: string }>;
  memories: Array<{ type: string; key: string; revealedAt: string }>;
  timeline: Array<{ sequence: number; type: string; at: string }>;
};

export function VoyageArchive({ playthroughId }: { playthroughId: string }) {
  const [archive, setArchive] = useState<Archive | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    void fetch(`/api/player/playthroughs/${playthroughId}/archive`, { cache: "no-store" }).then(async (response) => {
      const body = (await response.json()) as Archive & { error?: string };
      if (!response.ok) return setError(body.error ?? "This voyage archive is unavailable.");
      setArchive(body);
    });
  }, [playthroughId]);
  if (error)
    return (
      <main className="voyage-archive platform-loading">
        <p className="platform-error" role="alert">
          {error}
        </p>
        <Link href="/player/library">Return to library</Link>
      </main>
    );
  if (!archive)
    return (
      <main className="voyage-archive platform-loading">
        <p role="status">Unbinding the historical volume…</p>
      </main>
    );
  return (
    <main className="voyage-archive">
      <header className="archive-title">
        <Link href="/player/library">Back to my library</Link>
        <p className="eyebrow">Immutable voyage archive</p>
        <h1>{archive.tale.title}</h1>
        <h2>{archive.playthrough.voyageName}</h2>
        <p>{archive.tale.shortDescription}</p>
        <dl>
          <div>
            <dt>Completed</dt>
            <dd>{new Date(archive.playthrough.completedAt).toLocaleDateString()}</dd>
          </div>
          <div>
            <dt>Edition played</dt>
            <dd>{archive.playthrough.versionLabel}</dd>
          </div>
          <div>
            <dt>Edition published</dt>
            <dd>{new Date(archive.playthrough.versionPublishedAt).toLocaleDateString()}</dd>
          </div>
          <div>
            <dt>Integrity mark</dt>
            <dd>{archive.playthrough.checksum.slice(0, 12)}</dd>
          </div>
        </dl>
      </header>
      <section className="archive-chapters" aria-label="Revealed story">
        <h2>Journal pages revealed on this voyage</h2>
        {archive.chapters.map((chapter) => (
          <article key={chapter.id}>
            <p className="eyebrow">Historical chapter</p>
            <h3>{chapter.title}</h3>
            {chapter.subtitle && <p>{chapter.subtitle}</p>}
            <ol>
              {chapter.blocks.map((block) => (
                <li key={block.id}>
                  <small>{block.blockType.replaceAll(/([A-Z])/g, " $1")}</small>
                  <strong>{block.title}</strong>
                  <p>
                    {String(
                      block.configuration.body ??
                        block.configuration.prompt ??
                        block.configuration.description ??
                        "A remembered moment from this voyage.",
                    )}
                  </p>
                </li>
              ))}
            </ol>
          </article>
        ))}
      </section>
      {archive.assets.length > 0 && (
        <section className="archive-media">
          <h2>Collected keepsakes</h2>
          <div>
            {archive.assets.map((asset) => (
              <figure key={asset.id}>
                {asset.mediaType === "IMAGE" ? (
                  <img src={asset.url} alt={asset.description ?? asset.displayName} />
                ) : (
                  <a href={asset.url}>{asset.displayName}</a>
                )}
                <figcaption>
                  <strong>{asset.displayName}</strong>
                  {asset.description && <span>{asset.description}</span>}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}
      <section className="archive-timeline">
        <h2>Voyage timeline</h2>
        <ol>
          {archive.timeline.map((event) => (
            <li key={event.sequence}>
              <span>{event.sequence}</span>
              <strong>{event.type.replaceAll(/([A-Z])/g, " $1")}</strong>
              <time dateTime={event.at}>{new Date(event.at).toLocaleString()}</time>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}

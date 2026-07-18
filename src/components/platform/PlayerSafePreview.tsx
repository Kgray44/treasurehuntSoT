"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Preview = {
  session: { status: string; versionId: string; updatedAt: string };
  tale: { title: string; subtitle: string | null; shortDescription: string | null };
  chapter: { title: string } | null;
  block: { title: string; blockType: string; configuration: Record<string, unknown> } | null;
  assets: Array<{ id: string; displayName: string }>;
  events: Array<{ sequence: number; eventType: string }>;
};

export function PlayerSafePreview({ playthroughId }: { playthroughId: string }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    void fetch(`/api/captain/playthroughs/${playthroughId}/preview`, { cache: "no-store" }).then(async (response) => {
      const body = (await response.json()) as { preview?: Preview; error?: string };
      if (!response.ok) setError(body.error ?? "Preview unavailable.");
      else setPreview(body.preview ?? null);
    });
  }, [playthroughId]);
  if (error)
    return (
      <main className="player-safe-preview platform-loading">
        <p role="alert" className="platform-error">
          {error}
        </p>
      </main>
    );
  if (!preview)
    return (
      <main className="player-safe-preview platform-loading">
        <p role="status">Projecting the Player-safe view…</p>
      </main>
    );
  return (
    <main className="player-safe-preview">
      <header>
        <Link href="/captain/library">Back to Captain&apos;s Command</Link>
        <p className="eyebrow">Non-mutating Player preview</p>
        <h1>{preview.tale.title}</h1>
        <p>
          This projection uses the real Player field and asset policy. No control on this page can change live progress.
        </p>
      </header>
      <section>
        <div className="preview-watermark">PREVIEW · NO LIVE MUTATIONS</div>
        <p className="card-kicker">
          {preview.session.status.toLocaleLowerCase()} · edition {preview.session.versionId.slice(0, 12)}
        </p>
        <h2>{preview.chapter?.title ?? "The voyage has not launched"}</h2>
        <h3>{preview.block?.title ?? "The journal remains closed"}</h3>
        <p>
          {String(
            preview.block?.configuration.body ??
              preview.block?.configuration.prompt ??
              preview.tale.shortDescription ??
              "Awaiting Captain launch.",
          )}
        </p>
        <dl>
          <div>
            <dt>Returned assets</dt>
            <dd>{preview.assets.length}</dd>
          </div>
          <div>
            <dt>Player-visible events</dt>
            <dd>{preview.events.length}</dd>
          </div>
          <div>
            <dt>Last server state</dt>
            <dd>{new Date(preview.session.updatedAt).toLocaleString()}</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}

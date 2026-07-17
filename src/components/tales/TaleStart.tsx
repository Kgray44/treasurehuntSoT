"use client";

/* eslint-disable @next/next/no-img-element -- Published asset URLs are authorized version-bound media responses. */
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Tale = {
  slug: string;
  title: string;
  subtitle: string | null;
  shortDescription: string | null;
  longDescription: string | null;
  coverUrl: string | null;
  estimatedDuration: number | null;
  playerCountMin: number;
  playerCountMax: number;
  contentWarnings: string | null;
  version: string;
};

export function TaleStart({ taleSlug }: { taleSlug: string }) {
  const router = useRouter();
  const [tale, setTale] = useState<Tale | null>(null);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    void fetch(`/api/tales/${taleSlug}`, { cache: "no-store" }).then(async (response) => {
      const body = (await response.json()) as { tale?: Tale; error?: string };
      if (!response.ok) setError(body.error ?? "This chart cannot be opened.");
      else setTale(body.tale ?? null);
    });
  }, [taleSlug]);
  if (error)
    return (
      <main className="tale-start error">
        <section>
          <h1>Chart unavailable</h1>
          <p>{error}</p>
          <Link href="/tales">Return to the catalog</Link>
        </section>
      </main>
    );
  if (!tale)
    return (
      <main className="tale-start">
        <p role="status">Unrolling the published chart…</p>
      </main>
    );
  return (
    <main className="tale-start">
      {tale.coverUrl && <img className="tale-start-cover" src={tale.coverUrl} alt="" />}
      <div className="tale-start-shade" />
      <section>
        <Link href="/tales">← Published tales</Link>
        <p className="eyebrow">
          Version {tale.version} · {tale.estimatedDuration ? `${tale.estimatedDuration} minutes` : "duration uncharted"}
        </p>
        <h1>{tale.title}</h1>
        <h2>{tale.subtitle}</h2>
        <p>{tale.longDescription ?? tale.shortDescription}</p>
        <dl>
          <div>
            <dt>Crew</dt>
            <dd>
              {tale.playerCountMin}–{tale.playerCountMax} players
            </dd>
          </div>
          {tale.contentWarnings && (
            <div>
              <dt>Notes</dt>
              <dd>{tale.contentWarnings}</dd>
            </div>
          )}
        </dl>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError("");
            const response = await fetch(`/api/tales/${taleSlug}/start`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ownerLabel: label }),
            });
            const body = (await response.json()) as { url?: string; error?: string };
            if (!response.ok || !body.url) {
              setError(body.error ?? "The voyage could not begin.");
              setBusy(false);
              return;
            }
            router.push(body.url);
          }}
        >
          <label>
            <span>Crew or player name</span>
            <input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Guest crew"
              maxLength={120}
            />
          </label>
          <button className="brass-button" disabled={busy}>
            {busy ? "Preparing the session…" : "Begin this Tall Tale"}
          </button>
          {error && <p role="alert">{error}</p>}
        </form>
      </section>
    </main>
  );
}

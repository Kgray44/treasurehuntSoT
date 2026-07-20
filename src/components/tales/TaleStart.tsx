"use client";

/* eslint-disable @next/next/no-img-element -- Published asset URLs are authorized version-bound media responses. */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ErrorState, LoadingState } from "@/components/ui/AsyncState";
import { errorCopy } from "@/language/error-copy";
import { platformCopy } from "@/language/platform-copy";

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

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch(`/api/tales/${taleSlug}`, { cache: "no-store" });
      const body = (await response.json()) as { tale?: Tale; error?: string };
      if (!response.ok) setError(body.error ?? errorCopy.chronicleCouldNotOpen.value);
      else setTale(body.tale ?? null);
    } catch {
      setError(errorCopy.chronicleCouldNotOpenDetail.value);
    }
  }, [taleSlug]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);
  if (error && !tale)
    return (
      <main className="tale-start error">
        <ErrorState
          title={errorCopy.chronicleCouldNotOpen.value}
          detail={error}
          action={{ label: "Try Again", onClick: () => void load() }}
        />
      </main>
    );
  if (!tale)
    return (
      <main className="tale-start">
        <LoadingState title={platformCopy.loadingChronicle.value} detail="Loading the published Chronicle and its version." />
      </main>
    );
  return (
    <main className="tale-start">
      {tale.coverUrl && <img className="tale-start-cover" src={tale.coverUrl} alt="" />}
      <div className="tale-start-shade" />
      <section>
        <Link href="/tales">← Published Chronicles</Link>
        <p className="eyebrow tale-preview-label">Preview this Chronicle</p>
        <p className="tale-edition-line">
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
          aria-busy={busy}
          aria-describedby={error ? "tale-start-error" : undefined}
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError("");
            try {
              const response = await fetch(`/api/tales/${taleSlug}/start`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ownerLabel: label }),
              });
              const body = (await response.json()) as { url?: string; error?: string };
              if (!response.ok || !body.url) {
                setError(body.error ?? "The voyage could not begin.");
                return;
              }
              router.push(body.url);
            } catch {
              setError("The Voyage could not begin. Check your connection, then try again.");
            } finally {
              setBusy(false);
            }
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
          <button className="brass-button" disabled={busy} aria-busy={busy}>
            {busy ? "Preparing your Voyage…" : platformCopy.beginVoyage.value}
          </button>
          {error && (
            <p id="tale-start-error" className="platform-error" role="alert">
              {error}
            </p>
          )}
        </form>
      </section>
    </main>
  );
}

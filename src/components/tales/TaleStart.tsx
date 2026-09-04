"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ErrorState, LoadingState } from "@/components/ui/AsyncState";
import { ResilientImage } from "@/components/ui/ResilientImage";
import { errorCopy } from "@/language/error-copy";
import { platformCopy } from "@/language/platform-copy";
import { useCurrentUser } from "@/components/auth/CurrentUserProvider";

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
  const { state: currentUser } = useCurrentUser();
  const [tale, setTale] = useState<Tale | null>(null);
  const [label, setLabel] = useState("");
  const [labelTouched, setLabelTouched] = useState(false);
  const [editingAlias, setEditingAlias] = useState(false);
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
  const effectiveLabel = currentUser.status === "authenticated" && !labelTouched ? currentUser.user.displayName : label;
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
        <LoadingState
          title={platformCopy.loadingChronicle.value}
          detail="Loading the published Chronicle and its version."
        />
      </main>
    );
  const subtitle = tale.subtitle?.trim();
  return (
    <main className="tale-start">
      <ResilientImage
        className="tale-start-cover"
        src={tale.coverUrl}
        alt=""
        fallbackLabel={`${tale.title} cover unavailable`}
        fallbackDetail="A cover has not been published for this Chronicle. Its description and start controls remain available."
      />
      <div className="tale-start-shade" />
      <section>
        <nav className="tale-start-navigation" aria-label="Chronicle preview navigation">
          <Link href="/tales">← Published Chronicles</Link>
          <Link href={`/play/${encodeURIComponent(taleSlug)}/history`}>{"View this browser's Voyage History"}</Link>
        </nav>
        <p className="eyebrow tale-preview-label">Preview this Chronicle</p>
        <p className="tale-edition-line">
          Version {tale.version} · {tale.estimatedDuration ? `${tale.estimatedDuration} minutes` : "duration uncharted"}
        </p>
        <h1>{tale.title}</h1>
        {subtitle ? <h2>{subtitle}</h2> : null}
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
                headers: {
                  "Content-Type": "application/json",
                  ...(currentUser.status === "authenticated" ? { "x-csrf-token": currentUser.csrfToken } : {}),
                },
                body: JSON.stringify({ ownerLabel: effectiveLabel, aliasEdited: editingAlias }),
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
            <span>
              {currentUser.status === "authenticated" ? "Player name for this Chronicle" : "Guest player name"}
            </span>
            <input
              value={effectiveLabel}
              readOnly={currentUser.status === "authenticated" && !editingAlias}
              onChange={(event) => {
                setLabel(event.target.value);
                setLabelTouched(true);
              }}
              placeholder="Guest crew"
              maxLength={80}
            />
          </label>
          {currentUser.status === "authenticated" ? (
            <div className="chronicle-alias-control">
              <p>
                Your account display name is used by default. A Chronicle-specific name changes only this participation.
              </p>
              <button
                type="button"
                className="button button--quiet"
                onClick={() => {
                  setEditingAlias((value) => !value);
                  if (editingAlias) {
                    setLabel(currentUser.user.displayName);
                    setLabelTouched(false);
                  }
                }}
              >
                {editingAlias ? "Use account display name" : "Edit for this Chronicle"}
              </button>
            </div>
          ) : (
            <p className="chronicle-alias-note">Guests may choose an editable name for this Voyage.</p>
          )}
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

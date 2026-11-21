"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Review = {
  title: string;
  creator: string;
  itemType: "CHRONICLE" | "CHRONICLE_TEMPLATE" | "STORY_BLOCK_PRESET";
  semanticVersion: string;
  releaseId: string;
  packageChecksum: string;
  license: { key: string; displayName?: string; allowsModification: boolean; requiresAttribution: boolean };
  attribution: Array<{ displayName: string; contributionType: string }>;
  included: { chapters: number; passages: number } | { name: string; description: string };
  alreadyInstalled: boolean;
  studioUrl?: string | null;
};

export function CreatorCommunityInstall({
  listingId,
  itemType,
  returnTo,
}: {
  listingId: string;
  itemType: Review["itemType"];
  returnTo: string;
}) {
  const path = itemType === "CHRONICLE" ? "creator-chronicle" : "creator-reuse";
  const [review, setReview] = useState<Review | null>(null);
  const [error, setError] = useState("");
  const [authRequired, setAuthRequired] = useState(false);
  const [busy, setBusy] = useState(false);
  const [opened, setOpened] = useState<string | null>(null);
  const requestId = useRef<string>(crypto.randomUUID());
  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/community/${path}/install/review?listingId=${encodeURIComponent(listingId)}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const data = await response.json();
        if (response.status === 403) {
          if (!cancelled) setAuthRequired(true);
          return null;
        }
        if (!response.ok) throw new Error(data.error ?? "This release is unavailable.");
        return data as Review;
      })
      .then((data) => {
        if (!cancelled && data) setReview(data);
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "This release is unavailable.");
      });
    return () => {
      cancelled = true;
    };
  }, [listingId, path]);

  const install = async () => {
    if (!review) return;
    setBusy(true);
    setError("");
    try {
      const sessionResponse = await fetch("/api/player/session", { cache: "no-store" });
      if (!sessionResponse.ok) throw new Error("Sign in with Creator access before installing.");
      const session = (await sessionResponse.json()) as { csrfToken?: string };
      if (!session.csrfToken) throw new Error("Your session expired. Sign in and try again.");
      const response = await fetch(`/api/community/${path}/install/commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": session.csrfToken },
        body: JSON.stringify({
          listingId,
          releaseId: review.releaseId,
          packageChecksum: review.packageChecksum,
          requestId: requestId.current,
        }),
      });
      const result = (await response.json()) as { error?: string; studioUrl?: string };
      if (!response.ok) throw new Error(result.error ?? "The private installation could not finish.");
      setOpened(
        result.studioUrl ?? (itemType === "CHRONICLE" ? "/studio/library" : "/studio/exchange#installed-community"),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The private installation could not finish.");
    } finally {
      setBusy(false);
    }
  };
  const destination = opened ?? review?.studioUrl ?? null;
  return (
    <section className="community-detail__action" aria-labelledby="creator-install-title">
      <p className="community-eyebrow">Creator reuse</p>
      <h3 id="creator-install-title">
        {itemType === "CHRONICLE" ? "Copy this Chronicle privately" : "Install this saved Creator item"}
      </h3>
      {!review && !error && !authRequired && <p role="status">Checking the exact release and license…</p>}
      {authRequired && (
        <p>
          <Link href={`/sign-in?returnTo=${encodeURIComponent(returnTo)}`}>Sign in with Creator access</Link> to review
          this release for private reuse.
        </p>
      )}
      {review && (
        <>
          <p>
            {review.title} · release {review.semanticVersion} by {review.creator}. The copy stays pinned to this
            release.
          </p>
          <p>
            {"chapters" in review.included
              ? `${review.included.chapters} Chapters and ${review.included.passages} Passages`
              : `${review.included.name}: ${review.included.description}`}
          </p>
          <p>
            License: {review.license.displayName ?? review.license.key.replaceAll("_", " ")}.{" "}
            {review.license.allowsModification
              ? "Private editing is allowed; preserve the release credit."
              : "Private use only; editing is restricted."}
          </p>
          {review.attribution.length > 0 && (
            <p>Credits: {review.attribution.map((credit) => credit.displayName).join(", ")}</p>
          )}
          {destination ? (
            <Link className="community-button community-button--primary" href={destination}>
              {itemType === "CHRONICLE" ? "Open my private Chronicle" : "View my installed item"}
            </Link>
          ) : (
            <button
              className="community-button community-button--primary"
              type="button"
              disabled={busy}
              onClick={() => void install()}
            >
              {busy ? "Installing…" : itemType === "CHRONICLE" ? "Copy to my Studio" : "Install to my reusable Library"}
            </button>
          )}
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}

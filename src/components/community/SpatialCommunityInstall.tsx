"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Review = {
  title: string;
  creator: string;
  semanticVersion: string;
  releaseId: string;
  packageChecksum: string;
  license: { key: string; allowsModification: boolean; requiresAttribution: boolean };
  attribution: Array<{ displayName: string; contributionType: string }>;
  included: Array<{ type: string; description: string }>;
  alreadyInstalled: boolean;
  studioUrl: string | null;
};

function licenseLabel(key: string) {
  const words = key.replaceAll("_", " ").toLocaleLowerCase("en-US");
  return words.charAt(0).toLocaleUpperCase("en-US") + words.slice(1);
}

export function SpatialCommunityInstall({ listingId }: { listingId: string }) {
  const [review, setReview] = useState<Review | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [studioUrl, setStudioUrl] = useState<string | null>(null);
  const requestId = useRef<string>(crypto.randomUUID());
  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/community/spatial-installation/review?listingId=${encodeURIComponent(listingId)}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "This release is unavailable.");
        return data as Review;
      })
      .then((data) => {
        if (!cancelled) setReview(data);
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "This release is unavailable.");
      });
    return () => {
      cancelled = true;
    };
  }, [listingId]);
  const install = async () => {
    if (!review) return;
    setBusy(true);
    setError("");
    try {
      const sessionResponse = await fetch("/api/player/session", { cache: "no-store" });
      if (!sessionResponse.ok) throw new Error("Sign in before installing this release.");
      const session = (await sessionResponse.json()) as { csrfToken?: string };
      if (!session.csrfToken) throw new Error("Your session expired. Sign in and try again.");
      const response = await fetch("/api/community/spatial-installation/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": session.csrfToken },
        body: JSON.stringify({
          listingId,
          releaseId: review.releaseId,
          packageChecksum: review.packageChecksum,
          requestId: requestId.current,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Installation could not finish.");
      setStudioUrl(data.studioUrl ?? "/studio/parallax");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Installation could not finish.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="community-detail__action" aria-labelledby="spatial-install-title">
      <p className="community-eyebrow">Spatial Library</p>
      <h3 id="spatial-install-title">Install this exact release</h3>
      {!review && !error && <p role="status">Checking package and license…</p>}
      {review && (
        <>
          <p>
            {review.title} · release {review.semanticVersion} by {review.creator}. Your installation stays pinned to
            this immutable version.
          </p>
          <ul>
            {review.included.map((item, index) => (
              <li key={`${item.type}-${index}`}>
                {item.description} · {item.type.replaceAll("_", " ")}
              </li>
            ))}
          </ul>
          <p>
            License: {licenseLabel(review.license.key)}. Installed releases are pinned and read-only
            {review.license.allowsModification ? "; permitted remixes require a separate credited copy" : ""}.
          </p>
          {review.attribution.length > 0 && (
            <p>Credits: {review.attribution.map((credit) => credit.displayName).join(", ")}</p>
          )}
          {studioUrl || review.studioUrl ? (
            <Link className="community-button community-button--primary" href={studioUrl ?? review.studioUrl!}>
              Open in Spatial Studio
            </Link>
          ) : (
            <button
              className="community-button community-button--primary"
              type="button"
              disabled={busy}
              onClick={() => void install()}
            >
              {busy ? "Installing…" : "Install to my Library"}
            </button>
          )}
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}

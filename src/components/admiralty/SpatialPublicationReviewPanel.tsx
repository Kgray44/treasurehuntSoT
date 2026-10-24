"use client";

import { useEffect, useState } from "react";

type Review = {
  listingId: string;
  slug: string;
  title: string;
  description: string;
  tags: string[];
  locationClass: string;
  category: string | null;
  itemType: string;
  publicationStatus: string;
  creator: string;
  releaseId: string;
  semanticVersion: string;
  packageChecksum: string;
  license: { key: string; version: number };
  attribution: Array<{ displayName: string; contributionType: string }>;
  rightsDeclaration: string[];
  included: Array<{ path: string; preview: unknown }>;
  warnings: string[];
};

export function SpatialPublicationReviewPanel({
  listingId,
  csrfToken,
  enabled,
  assuranceActive,
}: {
  listingId: string;
  csrfToken: string;
  enabled: boolean;
  assuranceActive: boolean;
}) {
  const [review, setReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [assured, setAssured] = useState(assuranceActive);
  const [acknowledged, setAcknowledged] = useState(false);
  const [packageInspected, setPackageInspected] = useState(false);
  const [published, setPublished] = useState(false);
  const endpoint = `/api/admin/community/spatial-publication/${encodeURIComponent(listingId)}/review`;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void fetch(endpoint, { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "The spatial review is unavailable.");
        return body as Review;
      })
      .then((value) => {
        if (!cancelled) setReview(value);
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "The spatial review is unavailable.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, endpoint]);

  async function post(path: string, body: unknown) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
      body: JSON.stringify(body),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) throw new Error(result?.error ?? "The approval could not be completed.");
    return result;
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The approval could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  if (!enabled) return <p>Community moderation permission is required to inspect this pending package.</p>;
  if (loading) return <p role="status">Loading the exact spatial release for review…</p>;
  if (!review) return <p role="alert">{error || "The pending spatial release is unavailable."}</p>;
  if (published)
    return (
      <p role="status">
        Release {review.semanticVersion} is published. <a href={`/community/${review.slug}`}>Open Community listing</a>
      </p>
    );

  return (
    <section className="chartroom-support chartroom-spatial-review" aria-labelledby="spatial-publication-review-title">
      <h3 id="spatial-publication-review-title">Review exact spatial release</h3>
      <p>
        {review.creator} submitted <strong>{review.title}</strong> · {review.itemType.replaceAll("_", " ")} · release{" "}
        {review.semanticVersion}. Approval makes this immutable package public and installable.
      </p>
      <p>{review.description}</p>
      <p>
        Category: {review.category ?? "Unspecified"} · location: {review.locationClass.replaceAll("_", " ")} · tags:{" "}
        {review.tags.join(", ") || "none"}.
      </p>
      <p>
        License: {review.license.key.replaceAll("_", " ")} · version {review.license.version}. Credits:{" "}
        {review.attribution.map((credit) => credit.displayName).join(", ")}.
      </p>
      <ul aria-label="Creator rights declaration">
        {review.rightsDeclaration.map((statement) => (
          <li key={statement}>{statement}</li>
        ))}
      </ul>
      {review.warnings.map((warning) => (
        <p className="chartroom-notice" key={warning}>
          {warning}
        </p>
      ))}
      <ul>
        {review.included.map((item) => (
          <li key={item.path}>{item.path}</li>
        ))}
      </ul>
      <details
        onToggle={(event) => {
          if (event.currentTarget.open) setPackageInspected(true);
        }}
      >
        <summary>Inspect the full sanitized package</summary>
        <pre style={{ maxHeight: "24rem", overflow: "auto" }} tabIndex={0} aria-label="Spatial release package JSON">
          {JSON.stringify(review.included, null, 2)}
        </pre>
      </details>
      <p>Package checksum: {review.packageChecksum}</p>
      {!packageInspected && <p role="status">Open and inspect the full package before confirming this review.</p>}
      {error && (
        <p role="alert" className="chartroom-notice">
          {error}
        </p>
      )}
      {!assured && (
        <div>
          <label>
            Confirm current password for privileged assurance
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <button
            type="button"
            disabled={busy || !password}
            onClick={() =>
              void run(async () => {
                await post("/api/admin/assurance", { password });
                setPassword("");
                setAssured(true);
              })
            }
          >
            Verify identity
          </button>
        </div>
      )}
      <label>
        <input
          type="checkbox"
          checked={acknowledged}
          disabled={!packageInspected}
          onChange={(event) => setAcknowledged(event.target.checked)}
        />
        I reviewed the exact content, rights declaration, license, credits and privacy warnings.
      </label>
      <button
        type="button"
        disabled={busy || !assured || !packageInspected || !acknowledged}
        onClick={() =>
          void run(async () => {
            await post(endpoint, {
              releaseId: review.releaseId,
              packageChecksum: review.packageChecksum,
              packageReviewed: true,
            });
            setPublished(true);
          })
        }
      >
        {busy ? "Publishing…" : "Approve and publish release"}
      </button>
    </section>
  );
}

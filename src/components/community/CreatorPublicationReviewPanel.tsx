"use client";

import { useEffect, useState } from "react";

type Review = {
  listingId: string;
  releaseId: string;
  packageChecksum: string;
  title: string;
  description: string | null;
  included: unknown;
  license: {
    key?: string;
    version?: number;
    allowsPrivateUse?: boolean;
    allowsPublicUse?: boolean;
    allowsModification?: boolean;
    allowsRedistribution?: boolean;
    requiresAttribution?: boolean;
  };
  ownershipStatements: string[];
  spoilerLevel: string;
  attribution: Array<{ displayName: string; contributionType: string }>;
};

export function CreatorPublicationReviewPanel({
  listingId,
  slug,
  itemType,
  csrfToken,
  enabled,
  assuranceActive,
}: {
  listingId: string;
  slug: string;
  itemType: "CHRONICLE" | "CHRONICLE_TEMPLATE" | "STORY_BLOCK_PRESET";
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
  const [packageInspected, setPackageInspected] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [published, setPublished] = useState(false);
  const route = itemType === "CHRONICLE" ? "creator-chronicle" : "creator-reuse";
  const endpoint = `/api/admin/community/${route}/${encodeURIComponent(listingId)}/review`;
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void fetch(endpoint, { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "This Creator release is unavailable for review.");
        return body as Review;
      })
      .then((value) => {
        if (!cancelled) setReview(value);
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Review is unavailable.");
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
  if (loading) return <p role="status">Loading the pinned Creator release for review…</p>;
  if (!review) return <p role="alert">{error || "This Creator release is unavailable."}</p>;
  if (published)
    return (
      <p role="status">
        Release approved. <a href={`/community/${slug}`}>Open Community listing</a>.
      </p>
    );
  return (
    <section
      className="chartroom-support"
      style={{ gridTemplateColumns: "minmax(0, 1fr)" }}
      aria-labelledby="creator-publication-review-title"
    >
      <h3 id="creator-publication-review-title">Review exact Creator release</h3>
      <p>
        <strong>{review.title}</strong> · {itemType.replaceAll("_", " ")}. Approval makes this pinned package public and
        installable.
      </p>
      {review.description && <p>{review.description}</p>}
      <p>
        License: {review.license.key?.replaceAll("_", " ") ?? "Unavailable"} · version {review.license.version ?? "?"}.
      </p>
      <p>
        Rights: private use {review.license.allowsPrivateUse ? "allowed" : "blocked"}; public use{" "}
        {review.license.allowsPublicUse ? "allowed" : "blocked"}; modification{" "}
        {review.license.allowsModification ? "allowed" : "blocked"}; redistribution{" "}
        {review.license.allowsRedistribution ? "allowed" : "blocked"}; attribution{" "}
        {review.license.requiresAttribution ? "required" : "optional"}.
      </p>
      <p>
        Public spoiler level: {review.spoilerLevel.replaceAll("_", " ")}. Full content stays in this moderator review
        until approval.
      </p>
      <ul aria-label="Creator ownership declarations">
        {review.ownershipStatements.map((statement) => (
          <li key={statement}>{statement}</li>
        ))}
      </ul>
      <p>Credits: {review.attribution.map((credit) => credit.displayName).join(", ")}.</p>
      <details
        onToggle={(event) => {
          if (event.currentTarget.open) setPackageInspected(true);
        }}
      >
        <summary>Inspect every included field</summary>
        <pre
          style={{ maxHeight: "24rem", overflow: "auto", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
          tabIndex={0}
          aria-label="Creator release package JSON"
        >
          {JSON.stringify(review.included, null, 2)}
        </pre>
      </details>
      <p>Package checksum: {review.packageChecksum}</p>
      {!packageInspected && <p role="status">Open the exact package before confirming this review.</p>}
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
        I reviewed the exact content, ownership declaration, license, credits, privacy and spoiler implications.
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

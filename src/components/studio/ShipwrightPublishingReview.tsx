"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import type { PublishingReview, PublishingReviewChange } from "@/studio/publishing-review";

type Readiness = {
  status: string;
  blockingIssues?: Array<{ code: string }>;
  warnings?: Array<{ code: string }>;
  waivers?: string[];
  externalEvidence?: Array<{ providerId: string; evidenceKind: string; status: string; safeSummary: string }>;
};
type Compatibility = { status: string; policyVersion: string; findings: Array<{ code: string; message: string }> };
type Receipt = { id: string; versionLabel: string; checksum: string; evidenceId: string; publishedAt: string };
type ReviewResponse = {
  review: PublishingReview;
  readiness: Readiness;
  compatibility: Compatibility;
  protectedContent: {
    visibility: string;
    recorded: boolean;
    evidence: Array<{ providerId: string; evidenceKind: string; status: string; safeSummary: string }>;
  };
};

const changeLabel = (change: PublishingReviewChange) => `${change.kind.toLowerCase()} ${change.subject.toLowerCase()}`;

export function ShipwrightPublishingReview({
  taleId,
  csrfToken,
  savedAt,
  onSave,
  onPublish,
  publishState,
  publishError,
  receipt,
  onPreviewPublished,
}: {
  taleId: string;
  csrfToken: string;
  savedAt: string;
  onSave: () => boolean | Promise<boolean>;
  onPublish: (releaseNotes: string) => void | Promise<void>;
  publishState: "idle" | "publishing" | "published" | "failed";
  publishError: string;
  receipt: Receipt | null;
  onPreviewPublished: () => void | Promise<void>;
}) {
  const notesId = useId();
  const [result, setResult] = useState<ReviewResponse | null>(null);
  const [error, setError] = useState("");
  const [releaseNotes, setReleaseNotes] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const saveAndRefresh = async () => {
    const saved = await onSave();
    if (!saved) {
      setError("The draft could not be saved. Resolve the save issue, then retry this review.");
      return;
    }
    setRefresh((value) => value + 1);
  };

  useEffect(() => {
    let active = true;
    setError("");
    void fetch(`/api/studio/tales/${encodeURIComponent(taleId)}/publishing-review`, {
      cache: "no-store",
      headers: { "x-csrf-token": csrfToken },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("The publication review could not load its current server decision.");
        return response.json() as Promise<ReviewResponse>;
      })
      .then((body) => active && setResult(body))
      .catch(
        (cause: unknown) =>
          active && setError(cause instanceof Error ? cause.message : "Publication review unavailable."),
      );
    return () => {
      active = false;
    };
  }, [csrfToken, refresh, taleId]);

  const canPublish = result?.readiness.status === "VERIFIED" && publishState !== "publishing";
  const committed = receipt && receipt.id && receipt.checksum && receipt.evidenceId ? receipt : null;
  return (
    <section id="publication-review" className="studio-publishing-review" aria-labelledby="publication-review-title">
      <header>
        <p className="eyebrow">Shipwright launch sequence</p>
        <h2 id="publication-review-title">Review and publish</h2>
        <p>
          Save the intended draft, inspect the source-bound Drydock decision and exact release changes, then explicitly
          commit a new immutable Version.
        </p>
      </header>
      {error ? (
        <div role="alert" className="studio-publishing-review-error">
          <p>{error}</p>
          <button type="button" onClick={() => setRefresh((value) => value + 1)}>
            Retry publication review
          </button>
        </div>
      ) : !result ? (
        <p aria-live="polite">Preparing the current publication review…</p>
      ) : (
        <ol className="studio-publishing-stages" aria-label="Publication stages">
          <li>
            <h3>1. Freeze the intended draft</h3>
            <p>Last saved {new Date(savedAt).toLocaleString()}. Publication rechecks this exact server source.</p>
            <button type="button" onClick={() => void saveAndRefresh()} disabled={publishState === "publishing"}>
              Save current draft
            </button>
          </li>
          <li>
            <h3>2. Drydock release decision</h3>
            <p aria-live="polite">
              <strong>{result.readiness.status.replaceAll("_", " ")}</strong>
            </p>
            {result.readiness.blockingIssues?.length ? (
              <ul aria-label="Publication blockers">
                {result.readiness.blockingIssues.map((issue) => (
                  <li key={issue.code}>{issue.code}</li>
                ))}
              </ul>
            ) : null}
            {result.readiness.warnings?.length ? (
              <ul aria-label="Publication warnings">
                {result.readiness.warnings.map((warning) => (
                  <li key={warning.code}>{warning.code}</li>
                ))}
              </ul>
            ) : null}
            {result.readiness.waivers?.length ? (
              <ul aria-label="Active publication waivers">
                {result.readiness.waivers.map((waiver) => (
                  <li key={waiver}>{waiver}</li>
                ))}
              </ul>
            ) : null}
            {result.readiness.status !== "VERIFIED" ? (
              <Link href={`/studio/tales/${encodeURIComponent(taleId)}/trials`}>Open Drydock launch work</Link>
            ) : null}
          </li>
          <li>
            <h3>3. Review exact release changes</h3>
            <p>
              {result.review.currentPublished
                ? `Compared with current Version ${result.review.currentPublished.versionLabel}.`
                : "This is the first published Version; every listed item is new."}{" "}
              {result.review.summary.chapters} Chapters, {result.review.summary.passages} Passages, and{" "}
              {result.review.summary.assets} assets are in the intended source.
            </p>
            <p>
              Source checksum: <code>{result.review.sourceChecksum}</code>
            </p>
            {result.review.changes.length ? (
              <details open={result.review.changes.length <= 20}>
                <summary>{result.review.summary.changes} exact change(s)</summary>
                <ul className="studio-publishing-change-list">
                  {result.review.changes.map((change, index) => (
                    <li key={`${change.kind}-${change.subject}-${change.label}-${index}`}>
                      <strong>{changeLabel(change)}:</strong> {change.label}. {change.detail}
                    </li>
                  ))}
                </ul>
              </details>
            ) : (
              <p>No authored source changes were found against the current immutable Version.</p>
            )}
          </li>
          <li>
            <h3>4. Review assets, access, and compatibility</h3>
            <p>
              Assets: {result.review.assets.ready} ready, {result.review.assets.attention} needing attention, of{" "}
              {result.review.assets.total} total.
            </p>
            <details>
              <summary>Review assets</summary>
              <ul>
                {result.review.assets.items.map((asset) => (
                  <li key={asset.label}>
                    {asset.label}: {asset.readiness}
                  </li>
                ))}
              </ul>
            </details>
            <p>
              Reader compatibility: <strong>{result.compatibility.status.replaceAll("_", " ")}</strong> (
              {result.compatibility.policyVersion}).
            </p>
            {result.compatibility.findings.length ? (
              <ul aria-label="Compatibility findings">
                {result.compatibility.findings.map((finding, index) => (
                  <li key={`${finding.code}:${finding.message}:${index}`}>
                    {finding.code}: {finding.message}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No provider compatibility findings were reported.</p>
            )}
            <p>Protected-content visibility: {result.protectedContent.visibility.replaceAll("_", " ")}.</p>
            {result.protectedContent.recorded ? (
              <ul aria-label="Protected-content evidence">
                {result.protectedContent.evidence.map((evidence) => (
                  <li key={`${evidence.providerId}:${evidence.evidenceKind}`}>
                    {evidence.providerId}/{evidence.evidenceKind}: {evidence.status}. {evidence.safeSummary}
                  </li>
                ))}
              </ul>
            ) : (
              <p>
                No protected-content evidence is recorded for this source; no private-content readiness is inferred.
              </p>
            )}
          </li>
          <li>
            <h3>5. Commit immutable publication</h3>
            <label htmlFor={notesId}>Creator release notes</label>
            <textarea
              id={notesId}
              value={releaseNotes}
              onChange={(event) => setReleaseNotes(event.target.value)}
              maxLength={1000}
              placeholder="Explain this release for future Creators."
            />
            <label className="studio-publishing-confirmation">
              <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />I
              understand that publishing creates an immutable Version. Existing Voyages remain pinned to their current
              Version.
            </label>
            <button
              type="button"
              disabled={!confirmed || !canPublish}
              aria-busy={publishState === "publishing"}
              onClick={() => void onPublish(releaseNotes)}
            >
              {publishState === "publishing" ? "Committing immutable Version…" : "Publish immutable Version"}
            </button>
            {!canPublish && result.readiness.status !== "VERIFIED" ? (
              <p>Publication remains unavailable until Drydock verifies this exact saved source.</p>
            ) : null}
            {publishError ? (
              <p role="alert">{publishError} Your draft remains available for review and repair.</p>
            ) : null}
          </li>
        </ol>
      )}
      {committed ? (
        <section className="studio-publishing-success" aria-labelledby="publication-committed-title" role="status">
          <h3 id="publication-committed-title">Immutable publication committed</h3>
          <p>Version {committed.versionLabel} is now authoritative.</p>
          <p>
            Source checksum: <code>{committed.checksum}</code>
          </p>
          <p>Drydock evidence has been recorded with this immutable Version.</p>
          <div className="studio-publishing-next-actions" aria-label="Published Version next actions">
            <button type="button" onClick={() => void onPreviewPublished()}>
              Preview published edition
            </button>
            <Link href="/captain">Create or start a Voyage</Link>
            <a href="#published-version-history">Compare versions</a>
            <Link href={`/studio/exchange?sourceVersion=${encodeURIComponent(committed.id)}`}>
              Begin governed Community handoff
            </Link>
          </div>
        </section>
      ) : null}
    </section>
  );
}

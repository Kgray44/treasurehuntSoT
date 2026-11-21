"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type Source = {
  type: "CHRONICLE" | "CHRONICLE_TEMPLATE" | "STORY_BLOCK_PRESET";
  id: string;
  versionId?: string;
  title: string;
  sourceChecksum: string;
};
type License = { key: string; displayName: string; requiresAttribution: boolean; shareAlike: boolean };
type Submission = {
  id: string;
  title: string;
  slug: string;
  itemType: Source["type"];
  publicationStatus: "READY_FOR_REVIEW" | "IN_REVIEW" | "UPDATE_PENDING" | "PUBLISHED" | "REJECTED";
  currentRelease: { semanticVersion: string } | null;
};
type Options = { sources: Source[]; licenses: License[]; submissions?: Submission[] };
type Preflight = {
  reviewDigest: string;
  sourceChecksum: string;
  included: unknown;
  license: { key: string; name: string; allowsModification: boolean };
  attribution: Array<{ displayName: string; contributionType: string }>;
};
type Receipt = { listingId: string; releaseId: string; publicationStatus: string; listingUrl: string };

const slugify = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

const sourceLabel = (type: Source["type"]) =>
  type === "STORY_BLOCK_PRESET" ? "Passage preset" : type === "CHRONICLE_TEMPLATE" ? "Chapter template" : "Chronicle";

export function CreatorPublicationConsole() {
  const [options, setOptions] = useState<Options | null>(null);
  const [sourceKey, setSourceKey] = useState("");
  const [replacementId, setReplacementId] = useState("");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [licenseKey, setLicenseKey] = useState("");
  const [rightsAcknowledged, setRightsAcknowledged] = useState(false);
  const [spoilersAcknowledged, setSpoilersAcknowledged] = useState(false);
  const [preflight, setPreflight] = useState<Preflight | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const receiptRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (receipt) receiptRef.current?.focus();
  }, [receipt]);
  useEffect(() => {
    let cancelled = false;
    void fetch("/api/community/creator-publication/options", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Creator publication options are unavailable.");
        return data as Options;
      })
      .then((data) => {
        if (!cancelled) setOptions(data);
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Options are unavailable.");
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const source = useMemo(
    () => options?.sources.find((entry) => `${entry.type}:${entry.id}` === sourceKey),
    [options, sourceKey],
  );
  const replacements =
    options?.submissions?.filter(
      (submission) =>
        submission.itemType === source?.type &&
        (submission.publicationStatus === "PUBLISHED" || submission.publicationStatus === "REJECTED"),
    ) ?? [];
  const publication = useMemo(() => {
    if (!source) return null;
    const common = {
      ...(replacementId ? { listingId: replacementId } : {}),
      slug,
      title,
      description,
      tags: tags
        .split(",")
        .map((tag) => slugify(tag))
        .filter(Boolean)
        .slice(0, 12),
      licenseKey,
      rightsAcknowledged,
    };
    return source.type === "CHRONICLE"
      ? { publishedVersionId: source.id, ...common, spoilersAcknowledged }
      : { source: { itemId: source.id, versionId: source.versionId }, ...common };
  }, [source, replacementId, slug, title, description, tags, licenseKey, rightsAcknowledged, spoilersAcknowledged]);
  const route = source?.type === "CHRONICLE" ? "creator-chronicle" : "creator-reuse";
  const resetReview = () => {
    setPreflight(null);
    setReceipt(null);
    setError("");
  };
  const review = async () => {
    if (!publication || !rightsAcknowledged || (source?.type === "CHRONICLE" && !spoilersAcknowledged)) return;
    setBusy(true);
    setError("");
    setPreflight(null);
    try {
      const response = await fetch(`/api/community/${route}/preflight`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(publication),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "This saved source is not eligible for Community publication.");
      setPreflight(data as Preflight);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Review could not finish.");
    } finally {
      setBusy(false);
    }
  };
  const publish = async () => {
    if (!publication || !preflight) return;
    setBusy(true);
    setError("");
    try {
      const sessionResponse = await fetch("/api/player/session", { cache: "no-store" });
      if (!sessionResponse.ok) throw new Error("Your Creator session expired. Sign in and try again.");
      const session = (await sessionResponse.json()) as { csrfToken?: string };
      if (!session.csrfToken) throw new Error("Your Creator session expired. Sign in and try again.");
      const response = await fetch(`/api/community/${route}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": session.csrfToken },
        body: JSON.stringify({ publication, reviewDigest: preflight.reviewDigest }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "The release could not be submitted.");
      setReceipt(data as Receipt);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Submission could not finish.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="studio-exchange-workflow" aria-labelledby="creator-publication-title">
      <p className="eyebrow">Community Harbor</p>
      <h2 id="creator-publication-title">Share saved Creator work</h2>
      <p>
        Select your exact saved source, review the included content and license, then submit it for independent
        moderation.
      </p>
      {Boolean(options?.submissions?.length) && (
        <section aria-labelledby="creator-publication-history">
          <h3 id="creator-publication-history">Your Community submissions</h3>
          <ul>
            {options?.submissions?.map((submission) => (
              <li key={submission.id}>
                {submission.publicationStatus === "PUBLISHED" ? (
                  <Link href={`/community/${submission.slug}`}>{submission.title}</Link>
                ) : (
                  submission.title
                )}
                {submission.currentRelease && ` · ${submission.currentRelease.semanticVersion}`}
                {submission.publicationStatus === "PUBLISHED"
                  ? " · Approved"
                  : submission.publicationStatus === "REJECTED"
                    ? " · Rejected"
                    : " · Pending moderation"}
              </li>
            ))}
          </ul>
        </section>
      )}
      {!options && !error && <p role="status">Loading your saved Creator sources…</p>}
      {options && (
        <>
          <label htmlFor="creator-publication-source">Saved source</label>
          <select
            id="creator-publication-source"
            value={sourceKey}
            onChange={(event) => {
              const next = options.sources.find((entry) => `${entry.type}:${entry.id}` === event.target.value);
              setSourceKey(event.target.value);
              setReplacementId("");
              setTitle(next?.title.replace(/ · .+$/, "") ?? "");
              setSlug(slugify(next?.title.replace(/ · .+$/, "") ?? ""));
              resetReview();
            }}
          >
            <option value="">Choose a saved source</option>
            {options.sources.map((entry) => (
              <option key={`${entry.type}:${entry.id}`} value={`${entry.type}:${entry.id}`}>
                {entry.title} · {sourceLabel(entry.type)}
              </option>
            ))}
          </select>
          {!options.sources.length && (
            <p>Save a Passage or Chapter template, or publish a Chronicle through Drydock first.</p>
          )}
          {source && (
            <>
              <p>
                Saved version checksum: <code>{source.sourceChecksum.slice(0, 16)}</code>
              </p>
              <label htmlFor="creator-publication-title-input">Public title</label>
              <input
                id="creator-publication-title-input"
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  resetReview();
                }}
              />
              {replacements.length > 0 && (
                <>
                  <label htmlFor="creator-publication-replacement">Publication destination</label>
                  <select
                    id="creator-publication-replacement"
                    value={replacementId}
                    onChange={(event) => {
                      const replacement = replacements.find((submission) => submission.id === event.target.value);
                      setReplacementId(event.target.value);
                      setSlug(replacement?.slug ?? slugify(title));
                      resetReview();
                    }}
                  >
                    <option value="">Create a new listing</option>
                    {replacements.map((submission) => (
                      <option key={submission.id} value={submission.id}>
                        Replace {submission.title}
                      </option>
                    ))}
                  </select>
                </>
              )}
              <label htmlFor="creator-publication-slug">Community address</label>
              <input
                id="creator-publication-slug"
                value={slug}
                readOnly={Boolean(replacementId)}
                onChange={(event) => {
                  setSlug(slugify(event.target.value));
                  resetReview();
                }}
              />
              <label htmlFor="creator-publication-description">Preview-safe description</label>
              <textarea
                id="creator-publication-description"
                value={description}
                onChange={(event) => {
                  setDescription(event.target.value);
                  resetReview();
                }}
              />
              <label htmlFor="creator-publication-tags">Tags, separated by commas</label>
              <input
                id="creator-publication-tags"
                value={tags}
                onChange={(event) => {
                  setTags(event.target.value);
                  resetReview();
                }}
              />
              <label htmlFor="creator-publication-license">License</label>
              <select
                id="creator-publication-license"
                value={licenseKey}
                onChange={(event) => {
                  setLicenseKey(event.target.value);
                  resetReview();
                }}
              >
                <option value="">Choose a license</option>
                {options.licenses.map((license) => (
                  <option key={license.key} value={license.key}>
                    {license.displayName}
                  </option>
                ))}
              </select>
              <label>
                <input
                  type="checkbox"
                  checked={rightsAcknowledged}
                  onChange={(event) => {
                    setRightsAcknowledged(event.target.checked);
                    resetReview();
                  }}
                />
                I own or have permission to distribute every included item.
              </label>
              {source.type === "CHRONICLE" && (
                <label>
                  <input
                    type="checkbox"
                    checked={spoilersAcknowledged}
                    onChange={(event) => {
                      setSpoilersAcknowledged(event.target.checked);
                      resetReview();
                    }}
                  />
                  I reviewed the full Chronicle for spoilers; only my description is shown before installation.
                </label>
              )}
              <button
                className="primary"
                type="button"
                disabled={
                  busy ||
                  !title ||
                  !slug ||
                  !description ||
                  !licenseKey ||
                  !rightsAcknowledged ||
                  (source.type === "CHRONICLE" && !spoilersAcknowledged)
                }
                onClick={() => void review()}
              >
                {busy ? "Checking…" : "Review exact package"}
              </button>
            </>
          )}
        </>
      )}
      {preflight && !receipt && (
        <section aria-labelledby="creator-publication-review">
          <h2 id="creator-publication-review">Review before submitting</h2>
          <p>
            Source checksum: <code style={{ overflowWrap: "anywhere" }}>{preflight.sourceChecksum}</code>
          </p>
          <p>
            License: {preflight.license.name}. Credits:{" "}
            {preflight.attribution.map((credit) => credit.displayName).join(", ")}.
          </p>
          <details>
            <summary>Inspect every included field</summary>
            <pre
              style={{ maxHeight: "24rem", overflow: "auto", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
              tabIndex={0}
              aria-label="Exact Creator package JSON"
            >
              {JSON.stringify(preflight.included, null, 2)}
            </pre>
          </details>
          <button className="primary" type="button" disabled={busy} onClick={() => void publish()}>
            {busy ? "Submitting…" : "Submit for moderation"}
          </button>
        </section>
      )}
      {receipt && (
        <p ref={receiptRef} role="status" tabIndex={-1}>
          Submitted for independent moderation. The listing will become public after approval.{" "}
          <Link href={receipt.listingUrl}>View its Community address</Link>.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import type { SpatialSource } from "@/community/spatial-package";
import styles from "./SpatialCommunityPublisher.module.css";

type License = {
  key: string;
  name: string;
  allowsModification: boolean;
  allowsCommercialUse: boolean;
  requiresAttribution: boolean;
  shareAlike: boolean;
};
type ExistingListing = {
  id: string;
  slug: string;
  title: string;
  description: string;
  tags: string[];
  licenseKey: string;
  publicationStatus: string;
  semanticVersion: string;
};
type Review = {
  reviewDigest: string;
  itemType: string;
  category: string;
  included: Array<{ path: string; preview: unknown }>;
  dependencies: Array<{ type: string; name: string; revision: number; checksum: string }>;
  warnings: string[];
  license: { name: string };
  attribution: Array<{ displayName: string; contributionType: string }>;
};
type Result = { publicationStatus: string; listingUrl: string; message: string; semanticVersion: string };
type Props = {
  source: SpatialSource;
  title: string;
  detail: string;
  category: string;
  csrfToken: string;
  returnFocus: HTMLElement | null;
  onClose: () => void;
};
const stages = ["Content", "Description", "Included content", "Sharing & rights", "Review"] as const;
function slugFor(title: string) {
  return (
    title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "spatial-content"
  );
}

export function SpatialCommunityPublisher({
  source,
  title: sourceTitle,
  detail,
  category,
  returnFocus,
  csrfToken,
  onClose,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const openingControl = useRef<HTMLElement | null>(null);
  const [stage, setStage] = useState(0);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [listings, setListings] = useState<ExistingListing[]>([]);
  const [listingId, setListingId] = useState("");
  const [title, setTitle] = useState(sourceTitle);
  const [slug, setSlug] = useState(slugFor(sourceTitle));
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const visibility = "COMMUNITY" as const;
  const [licenseKey, setLicenseKey] = useState("");
  const [rightsAcknowledged, setRightsAcknowledged] = useState(false);
  const [environmentPrivacyAcknowledged, setEnvironmentPrivacyAcknowledged] = useState(false);
  const [credits, setCredits] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [review, setReview] = useState<Review | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const includesEnvironment = source.kind !== "ASSET";
  useEffect(() => {
    openingControl.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const node = dialog.current;
    node?.showModal();
    return () => {
      node?.close();
      const target = returnFocus?.isConnected ? returnFocus : openingControl.current;
      requestAnimationFrame(() => target?.isConnected && target.focus());
    };
  }, [returnFocus]);
  useEffect(() => {
    let cancelled = false;
    const query = new URLSearchParams({ kind: source.kind, id: source.id, revision: String(source.revision) });
    void fetch(`/api/community/spatial-publication/licenses?${query}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Community licenses are unavailable.");
        return data as { licenses: License[]; listings: ExistingListing[] };
      })
      .then((data) => {
        if (cancelled) return;
        setLicenses(data.licenses);
        setListings(data.listings);
        setLicenseKey(data.licenses[0]?.key ?? "");
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Community licenses are unavailable.");
      });
    return () => {
      cancelled = true;
    };
  }, [source.kind, source.id, source.revision]);
  const chooseListing = (id: string) => {
    const listing = listings.find((candidate) => candidate.id === id);
    setListingId(id);
    setSlug(listing?.slug ?? slugFor(sourceTitle));
    setTitle(listing?.title ?? sourceTitle);
    setDescription(listing?.description ?? "");
    setTags(listing?.tags.join(", ") ?? "");
    setLicenseKey(
      listing?.licenseKey && licenses.some((license) => license.key === listing.licenseKey)
        ? listing.licenseKey
        : (licenses[0]?.key ?? ""),
    );
    setReview(null);
  };
  const publication = () => ({
    source,
    ...(listingId ? { listingId } : {}),
    slug,
    title,
    description,
    tags: [
      ...new Set(
        tags
          .toLowerCase()
          .split(/[\s,]+/)
          .filter(Boolean),
      ),
    ],
    visibility,
    locationClass: "GENERIC" as const,
    licenseKey,
    attribution: credits.trim() ? [{ displayName: credits.trim(), contributionType: "Creator credit" }] : [],
    rightsAcknowledged: true as const,
    environmentPrivacyAcknowledged,
  });
  const request = async (url: string, body: unknown) => {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Community Harbor could not finish this step.");
    return data;
  };
  const reviewPackage = async () => {
    if (!rightsAcknowledged || (includesEnvironment && !environmentPrivacyAcknowledged)) {
      setError("Acknowledge the rights and Environment privacy statements before reviewing.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      setReview(await request("/api/community/spatial-publication/preflight", publication()));
      setStage(4);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Package review failed.");
    } finally {
      setBusy(false);
    }
  };
  const publish = async () => {
    if (!review) return;
    setBusy(true);
    setError("");
    try {
      setResult(
        await request("/api/community/spatial-publication/publish", {
          publication: publication(),
          reviewDigest: review.reviewDigest,
        }),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Publication failed. Your saved source is preserved.");
      setReview(null);
      setStage(3);
    } finally {
      setBusy(false);
    }
  };
  const validDescription = title.trim() && description.trim() && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
  const selectedLicense = licenses.find((license) => license.key === licenseKey);
  const spatialPreview = review?.included.find((file) => file.path === "items/spatial.json")?.preview as
    | { content?: { title?: string; entities?: Array<{ name?: string }>; studio?: { behaviors?: unknown[] } } }
    | undefined;
  const environmentPreview = review?.included.find((file) => file.path === "items/environment.json")?.preview as
    | { content?: { name?: string; width?: number; depth?: number; fixtures?: Array<{ name?: string }> } }
    | undefined;
  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby="spatial-community-title"
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        if (!busy) onClose();
      }}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <small>SPATIAL STUDIO / COMMUNITY HARBOR</small>
            <h2 id="spatial-community-title">Publish to Community</h2>
            <p>Choose exactly what others may discover and install.</p>
          </div>
          <button type="button" aria-label="Close publishing" disabled={busy} onClick={onClose}>
            ×
          </button>
        </header>
        {result ? (
          <section className={styles.result} role="status">
            <span className={styles.eyebrow}>Submitted · release {result.semanticVersion}</span>
            <h3>
              {result.publicationStatus === "PUBLISHED" ? "Published in Community Harbor" : "Community review is next"}
            </h3>
            <p>{result.message}</p>
            <p>
              Your saved source remains in Spatial Studio.{" "}
              {result.publicationStatus === "PUBLISHED"
                ? "The approved listing is now visible."
                : "The Community listing is visible after moderation approves it."}
            </p>
            {result.publicationStatus === "PUBLISHED" && <a href={result.listingUrl}>Open Community listing</a>}
            <button type="button" onClick={onClose}>
              Return to Spatial Studio
            </button>
          </section>
        ) : (
          <>
            <ol className={styles.steps} aria-label="Publishing progress">
              {stages.map((name, index) => (
                <li
                  key={name}
                  aria-current={stage === index ? "step" : undefined}
                  className={index <= stage ? styles.active : ""}
                >
                  <span>{index + 1}</span>
                  {name}
                </li>
              ))}
            </ol>
            <div className={styles.body}>
              {stage === 0 && (
                <section>
                  <span className={styles.eyebrow}>SAVED SOURCE · REVISION {source.revision}</span>
                  <h3>{sourceTitle}</h3>
                  <p>{detail}</p>
                  <p className={styles.callout}>
                    Saving this item did not publish it. Community receives only the reviewed package after you submit
                    it.
                  </p>
                </section>
              )}
              {stage === 1 && (
                <section className={styles.fields}>
                  <h3>Present your content</h3>
                  <p>Category: {category.replaceAll("_", " ").toLowerCase()} · from your saved Studio source.</p>
                  {listings.length > 0 && (
                    <label>
                      Community release
                      <select value={listingId} onChange={(event) => chooseListing(event.target.value)}>
                        <option value="">Create a new Community listing</option>
                        {listings.map((listing) => (
                          <option key={listing.id} value={listing.id}>
                            Update {listing.title} · {listing.semanticVersion} ·{" "}
                            {listing.publicationStatus.toLowerCase().replaceAll("_", " ")}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {listingId && (
                    <p className={styles.callout}>
                      This creates a new immutable release for your existing listing. Its saved Studio source stays
                      editable.
                    </p>
                  )}
                  <label>
                    Title
                    <input
                      maxLength={140}
                      value={title}
                      onChange={(event) => {
                        setTitle(event.target.value);
                        setReview(null);
                      }}
                    />
                  </label>
                  <label>
                    Community address
                    <input
                      maxLength={80}
                      value={slug}
                      readOnly={Boolean(listingId)}
                      onChange={(event) => {
                        setSlug(slugFor(event.target.value));
                        setReview(null);
                      }}
                    />
                  </label>
                  <label>
                    Description
                    <textarea
                      rows={4}
                      maxLength={2000}
                      value={description}
                      onChange={(event) => {
                        setDescription(event.target.value);
                        setReview(null);
                      }}
                      placeholder="What can another Creator make with this?"
                    />
                  </label>
                  <label>
                    Tags, separated by commas
                    <input
                      value={tags}
                      onChange={(event) => {
                        setTags(event.target.value);
                        setReview(null);
                      }}
                      placeholder="mystery, tabletop"
                    />
                  </label>
                </section>
              )}
              {stage === 2 && (
                <section>
                  <h3>Included content</h3>
                  <p>
                    The server resolves the saved revision and every required Environment reference before publication.
                  </p>
                  <ul className={styles.included}>
                    <li>
                      <strong>{sourceTitle}</strong>
                      <span>
                        {source.kind.toLowerCase()} · revision {source.revision}
                      </span>
                    </li>
                    {includesEnvironment && (
                      <li>
                        <strong>Pinned Environment</strong>
                        <span>Exact revision verified during review</span>
                      </li>
                    )}
                  </ul>
                  <p className={styles.callout}>
                    Models, textures, audio, private photos, calibration references and unverified remixes are blocked
                    until their rights and safety can be verified.
                  </p>
                </section>
              )}
              {stage === 3 && (
                <section className={styles.fields}>
                  <h3>Sharing &amp; rights</h3>
                  <p className={styles.callout}>
                    Visibility: Community after approval. Harborlight reviews the release before it appears in public
                    discovery.
                  </p>
                  <label>
                    License
                    <select
                      value={licenseKey}
                      onChange={(event) => {
                        setLicenseKey(event.target.value);
                        setReview(null);
                      }}
                    >
                      {licenses.map((license) => (
                        <option key={license.key} value={license.key}>
                          {license.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {selectedLicense && (
                    <p className={styles.callout}>
                      {selectedLicense.allowsModification
                        ? "Credited remixes are permitted"
                        : "Reuse only; editable remixes are not permitted"}
                      .{" "}
                      {selectedLicense.allowsCommercialUse
                        ? "Commercial reuse is permitted"
                        : "Commercial reuse is not permitted"}
                      .{" "}
                      {selectedLicense.requiresAttribution
                        ? "Attribution is required."
                        : "Attribution is optional under this policy."}
                    </p>
                  )}
                  {!licenses.length && (
                    <p className={styles.callout}>
                      No configured redistribution license is available. Community Harbor cannot accept this publication
                      yet.
                    </p>
                  )}
                  <label>
                    Credit name
                    <input
                      maxLength={160}
                      value={credits}
                      onChange={(event) => {
                        setCredits(event.target.value);
                        setReview(null);
                      }}
                      placeholder="Optional additional Creator credit"
                    />
                  </label>
                  <label className={styles.check}>
                    <input
                      type="checkbox"
                      checked={rightsAcknowledged}
                      onChange={(event) => setRightsAcknowledged(event.target.checked)}
                    />
                    I own or have permission to redistribute every included element and reviewed its credits.
                  </label>
                  {includesEnvironment && (
                    <label className={styles.check}>
                      <input
                        type="checkbox"
                        checked={environmentPrivacyAcknowledged}
                        onChange={(event) => setEnvironmentPrivacyAcknowledged(event.target.checked)}
                      />
                      I reviewed the Environment geometry and understand that removing source photos does not make a
                      real home layout safe to share.
                    </label>
                  )}
                </section>
              )}
              {stage === 4 && review && (
                <section>
                  <span className={styles.eyebrow}>SERVER-VERIFIED PACKAGE</span>
                  <h3>Review before submitting</h3>
                  <p>
                    {review.itemType.replaceAll("_", " ")} · {visibility.toLowerCase()} after moderation ·{" "}
                    {review.license.name}
                  </p>
                  <p>
                    Category: {review.category.replaceAll("_", " ").toLowerCase()}. Presentation uses a content-derived
                    preview; no image, model or audio bytes are included.
                  </p>
                  <div className={styles.preview} aria-label="Community content preview">
                    {spatialPreview?.content && (
                      <div>
                        <strong>{spatialPreview.content.title ?? title}</strong>
                        <span>
                          {spatialPreview.content.entities?.length ?? 0} objects ·{" "}
                          {spatialPreview.content.studio?.behaviors?.length ?? 0} behaviors
                        </span>
                        <p>
                          {spatialPreview.content.entities
                            ?.map((entity) => entity.name)
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                    )}
                    {environmentPreview?.content && (
                      <div>
                        <strong>{environmentPreview.content.name ?? "Environment"}</strong>
                        <span>
                          {environmentPreview.content.width} × {environmentPreview.content.depth} m ·{" "}
                          {environmentPreview.content.fixtures?.length ?? 0} fixtures
                        </span>
                        <p>
                          {environmentPreview.content.fixtures
                            ?.map((fixture) => fixture.name)
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                    )}
                  </div>
                  <ul className={styles.included}>
                    {review.included.map((file) => (
                      <li key={file.path}>
                        <strong>{file.path === "items/spatial.json" ? sourceTitle : "Environment"}</strong>
                        <span>{file.path}</span>
                      </li>
                    ))}
                  </ul>
                  {review.dependencies.map((dependency) => (
                    <p key={dependency.checksum}>
                      {dependency.name} · pinned revision {dependency.revision}
                    </p>
                  ))}
                  <p>Credits: {review.attribution.map((credit) => credit.displayName).join(", ")}</p>
                  {review.warnings.map((warning) => (
                    <p className={styles.callout} key={warning}>
                      {warning}
                    </p>
                  ))}
                  <details>
                    <summary>Inspect the sanitized package</summary>
                    <pre tabIndex={0} aria-label="Sanitized Community package JSON">
                      {JSON.stringify(
                        review.included.map((item) => item.preview),
                        null,
                        2,
                      )}
                    </pre>
                  </details>
                  <p className={styles.callout}>
                    Submitting creates an immutable Community release for moderation. It does not make the listing
                    public immediately.
                  </p>
                </section>
              )}
              {error && (
                <p className={styles.error} role="alert">
                  {error}
                </p>
              )}
            </div>
            <footer className={styles.footer}>
              <button
                type="button"
                disabled={busy || stage === 0}
                onClick={() => {
                  setStage(Math.max(0, stage - 1));
                  setReview(null);
                  setError("");
                }}
              >
                Back
              </button>
              <span>
                Step {stage + 1} of {stages.length}
              </span>
              {stage < 3 ? (
                <button
                  type="button"
                  disabled={busy || (stage === 1 && !validDescription)}
                  onClick={() => {
                    setStage(stage + 1);
                    setError("");
                  }}
                >
                  Continue
                </button>
              ) : stage === 3 ? (
                <button
                  type="button"
                  disabled={
                    busy ||
                    !licenseKey ||
                    !rightsAcknowledged ||
                    (includesEnvironment && !environmentPrivacyAcknowledged)
                  }
                  onClick={() => void reviewPackage()}
                >
                  {busy ? "Reviewing…" : "Review package"}
                </button>
              ) : (
                <button type="button" disabled={busy || !review} onClick={() => void publish()}>
                  {busy ? "Submitting…" : "Submit to Community"}
                </button>
              )}
            </footer>
          </>
        )}
      </div>
    </dialog>
  );
}

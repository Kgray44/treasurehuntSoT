"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
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
  sourcePreview: { summary: string; items: string[]; remaining: number };
  knownLimit: string | null;
  csrfToken: () => string;
  returnFocus: HTMLElement | null;
  onClose: () => void;
};
const stages = ["Content", "Description", "Included content", "Sharing & rights", "Review"] as const;
class UnconfirmedCommunityResponse extends Error {
  constructor() {
    super("Community Harbor could not confirm this step. Try again.");
  }
}
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
  sourcePreview,
  knownLimit,
  returnFocus,
  csrfToken,
  onClose,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const openingControl = useRef<HTMLElement | null>(null);
  const errorNotice = useRef<HTMLParagraphElement>(null);
  const [stage, setStage] = useState(0);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [profileReady, setProfileReady] = useState<boolean | null>(null);
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
  const [reviewAcknowledged, setReviewAcknowledged] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const requiresEnvironmentPrivacy = source.kind !== "ASSET";
  const hasEnvironmentDependency = source.kind === "SCENE";
  const savedScenePublishesAsAsset = category === "SCENES" && source.kind === "ASSET";
  const savedSourceType =
    category === "ASSETS"
      ? "SPATIAL ASSET"
      : category === "SCENES"
        ? "SPATIAL SCENE"
        : category === "EFFECTS"
          ? "SPATIAL EFFECT"
          : category === "COMPOSITIONS"
            ? "SPATIAL COMPOSITION"
            : "SPATIAL ENVIRONMENT";
  const sourceVersionId = source.kind === "ENVIRONMENT" ? source.versionId : null;
  useEffect(() => {
    openingControl.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const node = dialog.current;
    node?.showModal();
    return () => {
      node?.close();
      requestAnimationFrame(() => {
        const visible = (target: HTMLElement | null) => target?.isConnected && target.getClientRects().length;
        const fallback = document.querySelector<HTMLElement>(
          '[aria-label="Library & hierarchy"], [aria-label="Open Library"]',
        );
        const target = visible(returnFocus) ? returnFocus : visible(fallback) ? fallback : openingControl.current;
        if (target?.isConnected) target.focus();
      });
    };
  }, [returnFocus]);
  useEffect(() => {
    let cancelled = false;
    const query = new URLSearchParams({ kind: source.kind, id: source.id, revision: String(source.revision) });
    if (sourceVersionId) query.set("versionId", sourceVersionId);
    void fetch(`/api/community/spatial-publication/licenses?${query}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Community licenses are unavailable.");
        return data as { licenses: License[]; listings: ExistingListing[]; profileReady: boolean };
      })
      .then((data) => {
        if (cancelled) return;
        setLicenses(data.licenses);
        setProfileReady(data.profileReady);
        setListings(data.listings);
        setLicenseKey(data.licenses[0]?.key ?? "");
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Community licenses are unavailable.");
      });
    return () => {
      cancelled = true;
    };
  }, [source.kind, source.id, source.revision, sourceVersionId]);
  useEffect(() => {
    if (!error) return;
    const frame = requestAnimationFrame(() => {
      errorNotice.current?.scrollIntoView({ block: "center" });
      errorNotice.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [error]);
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
    setReviewAcknowledged(false);
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
    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken() },
        body: JSON.stringify(body),
      });
    } catch {
      throw new UnconfirmedCommunityResponse();
    }
    const data = await response.json().catch(() => {
      throw new UnconfirmedCommunityResponse();
    });
    if (response.status >= 500) throw new UnconfirmedCommunityResponse();
    if (!response.ok) throw new Error(data.error ?? "Community Harbor could not finish this step.");
    return data;
  };
  const reviewPackage = async () => {
    if (!rightsAcknowledged || (requiresEnvironmentPrivacy && !environmentPrivacyAcknowledged)) {
      setError("Acknowledge the rights and Environment privacy statements before reviewing.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      setReview(await request("/api/community/spatial-publication/preflight", publication()));
      setReviewAcknowledged(false);
      setStage(4);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Package review failed.");
    } finally {
      setBusy(false);
    }
  };
  const publish = async () => {
    if (!review || !reviewAcknowledged) return;
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
      setError(
        cause instanceof UnconfirmedCommunityResponse
          ? "Community Harbor did not confirm this submission. Your saved source is preserved. Review the same package and retry; an exact retry recovers an intact recorded release."
          : cause instanceof Error
            ? cause.message
            : "Publication could not be confirmed. Your saved source is preserved.",
      );
      setReview(null);
      setStage(3);
    } finally {
      setBusy(false);
    }
  };
  const validDescription = title.trim() && description.trim() && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
  const selectedLicense = licenses.find((license) => license.key === licenseKey);
  const profileReturn =
    source.kind === "ENVIRONMENT"
      ? `/studio/parallax?${new URLSearchParams({
          library: `environment:${source.id}`,
          libraryKind: "ENVIRONMENTS",
          libraryVersion: source.versionId,
        })}`
      : `/studio/parallax?definition=${encodeURIComponent(source.id)}`;
  const spatialPreview = review?.included.find((file) => file.path === "items/spatial.json")?.preview as
    | {
        content?: {
          title?: string;
          entities?: Array<{ id: string; name: string; element?: { kind: string } }>;
          studio?: {
            behaviors?: Array<{ id: string; trigger: string; action: string; targetEntityId: string }>;
            animationTracks?: Array<{ id: string; entityId: string; property: string; keyframes: unknown[] }>;
          };
        };
      }
    | undefined;
  const reviewedEntities = spatialPreview?.content?.entities ?? [];
  const reviewedNames = new Map(reviewedEntities.map((entity) => [entity.id, entity.name]));
  const reviewedEffects = reviewedEntities.filter((entity) => entity.element);
  const reviewedBehaviors = spatialPreview?.content?.studio?.behaviors ?? [];
  const reviewedAnimationTracks = spatialPreview?.content?.studio?.animationTracks ?? [];
  const reviewedDefinitionCount = reviewedEffects.length + reviewedBehaviors.length + reviewedAnimationTracks.length;
  const reviewedType = review?.itemType
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^./, (letter) => letter.toUpperCase());
  const environmentPreview = review?.included.find((file) => file.path === "items/environment.json")?.preview as
    | {
        content?: {
          name?: string;
          width?: number;
          depth?: number;
          fixtures?: Array<{ name?: string }>;
          room?: { width: number; depth: number; features: Array<{ name: string }> };
        };
      }
    | undefined;
  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby="spatial-community-title"
      onKeyDown={(event) => {
        if (event.key === "Tab") {
          const controls = [
            ...event.currentTarget.querySelectorAll<HTMLElement>(
              "a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, pre[tabindex]",
            ),
          ].filter((control) => control.getClientRects().length > 0);
          const first = controls[0];
          const last = controls.at(-1);
          if (event.shiftKey && document.activeElement === first && last) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last && first) {
            event.preventDefault();
            first.focus();
          }
          return;
        }
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
            <h2 id="spatial-community-title">{knownLimit ? "Review Community publishing" : "Publish to Community"}</h2>
            <p>
              {knownLimit
                ? "Check what this saved source needs before it can be shared."
                : "Choose exactly what others may discover and install."}
            </p>
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
                  {profileReady === false && (
                    <p className={styles.callout} role="status">
                      Community publishing needs a public Profile with a handle. This source is still private.{" "}
                      <Link href={`/account/profile?returnTo=${encodeURIComponent(profileReturn)}`}>
                        Set up public Profile
                      </Link>{" "}
                      to return here after saving it.
                    </p>
                  )}
                  <span className={styles.eyebrow}>SAVED {savedSourceType} · REVISION {source.revision}</span>
                  <h3>{sourceTitle}</h3>
                  <p>{detail}</p>
                  {savedScenePublishesAsAsset && (
                    <p className={styles.callout}>
                      This saved Scene has no pinned Environment. Community will publish its self-contained content as a
                      Spatial asset. Only a Scene with a pinned Environment can publish as a Spatial Scene.
                    </p>
                  )}
                  <div className={styles.preview} aria-label="Saved source preview">
                    <div>
                      <strong>Saved content preview</strong>
                      <span>{sourcePreview.summary}</span>
                      {sourcePreview.items.length ? (
                        <ul className={styles.previewItems}>
                          {sourcePreview.items.map((item, index) => (
                            <li key={`${index}:${item}`}>{item}</li>
                          ))}
                          {sourcePreview.remaining > 0 && <li>And {sourcePreview.remaining} more</li>}
                        </ul>
                      ) : (
                        <p>No named objects or fixtures in this saved source.</p>
                      )}
                    </div>
                  </div>
                  <p className={styles.callout}>
                    This is your private saved source. Community receives only the separate server-reviewed package
                    after you submit it.
                  </p>
                  {knownLimit && (
                    <p className={styles.callout}>
                      Known publishing limit: {knownLimit} The server checks rights and dependencies before submission.
                    </p>
                  )}
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
                          <option
                            key={listing.id}
                            value={listing.id}
                            disabled={!["PUBLISHED", "REJECTED", "DRAFT"].includes(listing.publicationStatus)}
                          >
                            Update {listing.title} · {listing.semanticVersion} ·{" "}
                            {listing.publicationStatus.toLowerCase().replaceAll("_", " ")}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {listings.some((listing) =>
                    ["READY_FOR_REVIEW", "UPDATE_PENDING"].includes(listing.publicationStatus),
                  ) && (
                    <p className={styles.callout}>
                      An earlier submission for this saved source is awaiting Community review. Its next release can be
                      submitted after that review finishes.
                    </p>
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
                    The server checks the saved revision and every required Environment reference during package review.
                    The exact effects, behavior rules and animation tracks appear there before submission.
                  </p>
                  <ul className={styles.included}>
                    <li>
                      <strong>{sourceTitle}</strong>
                      <span>
                        {source.kind.toLowerCase()} · revision {source.revision}
                      </span>
                    </li>
                    {hasEnvironmentDependency && (
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
                  {requiresEnvironmentPrivacy && (
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
                  <p className={styles.callout}>
                    Submitting creates an immutable Community release for moderation. The listing becomes public only
                    after approval.
                  </p>
                  <p>
                    {reviewedType} · {visibility.toLowerCase()} after moderation ·{" "}
                    {review.license.name}
                  </p>
                  {savedScenePublishesAsAsset && (
                    <p className={styles.callout}>
                      This saved Scene has no pinned Environment, so this release is a Spatial asset. Creators will
                      install its self-contained content as an asset.
                    </p>
                  )}
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
                          {environmentPreview.content.room?.width ?? environmentPreview.content.width} ×{" "}
                          {environmentPreview.content.room?.depth ?? environmentPreview.content.depth} m ·{" "}
                          {environmentPreview.content.room?.features.length ??
                            environmentPreview.content.fixtures?.length ??
                            0}{" "}
                          {environmentPreview.content.room ? "room features" : "fixtures"}
                        </span>
                        <p>
                          {(environmentPreview.content.room?.features ?? environmentPreview.content.fixtures)
                            ?.map((fixture) => fixture.name)
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                    )}
                  </div>
                  <ul className={styles.included}>
                    {review.included.map((file) => {
                      const spatial = file.path === "items/spatial.json";
                      const environmentSource = source.kind === "ENVIRONMENT";
                      return (
                        <li key={file.path}>
                          <strong>
                            {spatial || environmentSource
                              ? sourceTitle
                              : (review.dependencies.find((dependency) => dependency.type === "SPATIAL_ENVIRONMENT")
                                  ?.name ?? "Pinned Environment")}
                          </strong>
                          <span>
                            {spatial
                              ? `Saved ${source.kind === "SCENE" ? "Scene" : "Asset"} · revision ${source.revision}`
                              : environmentSource
                                ? "Selected immutable Environment"
                                : "Required pinned Environment"}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  {review.dependencies.map((dependency) => (
                    <p key={dependency.checksum}>
                      {dependency.name} · pinned revision {dependency.revision}
                    </p>
                  ))}
                  {reviewedDefinitionCount ? (
                    <details aria-label="Included effects and behavior">
                      <summary>Inspect included effects and behavior ({reviewedDefinitionCount})</summary>
                      <ul className={styles.included}>
                        {reviewedEffects.map((entity) => (
                          <li key={`effect:${entity.id}`}>
                            <strong>{entity.name}</strong>
                            <span>{entity.element?.kind.replaceAll("_", " ").toLowerCase()}</span>
                          </li>
                        ))}
                        {reviewedBehaviors.map((behavior) => (
                          <li key={`behavior:${behavior.id}`}>
                            <strong>{reviewedNames.get(behavior.targetEntityId) ?? "Object"}</strong>
                            <span>
                              Behavior: {behavior.trigger.replaceAll("_", " ").toLowerCase()} →{" "}
                              {behavior.action.toLowerCase()}
                            </span>
                          </li>
                        ))}
                        {reviewedAnimationTracks.map((track) => (
                          <li key={`animation:${track.id}`}>
                            <strong>{reviewedNames.get(track.entityId) ?? "Object"}</strong>
                            <span>
                              Animation: {track.property.replaceAll("_", " ").toLowerCase()} · {track.keyframes.length}{" "}
                              keyframes
                            </span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : (
                    <p>No additional effects, behavior rules or animation tracks are included.</p>
                  )}
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
                        review.included.map((item) => ({ path: item.path, preview: item.preview })),
                        null,
                        2,
                      )}
                    </pre>
                  </details>
                  <label className={styles.reviewCheck}>
                    <input
                      type="checkbox"
                      checked={reviewAcknowledged}
                      onChange={(event) => setReviewAcknowledged(event.target.checked)}
                    />
                    I reviewed the included content, credits, warnings, and moderation outcome above.
                  </label>
                </section>
              )}
              {error && (
                <p ref={errorNotice} className={styles.error} role="alert" tabIndex={-1}>
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
                  setReviewAcknowledged(false);
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
                  disabled={busy || (stage === 0 && profileReady !== true) || (stage === 1 && !validDescription)}
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
                    (requiresEnvironmentPrivacy && !environmentPrivacyAcknowledged)
                  }
                  onClick={() => void reviewPackage()}
                >
                  {busy ? "Reviewing…" : "Review package"}
                </button>
              ) : (
                <button type="button" disabled={busy || !review || !reviewAcknowledged} onClick={() => void publish()}>
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

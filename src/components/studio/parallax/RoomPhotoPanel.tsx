"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { SpatialDraft } from "@/parallax/authoring";
import type { RoomPerceptionProposal } from "@/parallax/room-perception-service";
import styles from "./SpatialStudio.module.css";
import Image from "next/image";
export type RoomPhotoBase = { draft: SpatialDraft; revision: number; editorGeneration: number };
export type RoomPhotoPanelProps = {
  draft: SpatialDraft;
  csrfToken: () => string;
  prepare: () => Promise<RoomPhotoBase>;
  isCurrent: (base: RoomPhotoBase) => boolean;
  apply: (base: RoomPhotoBase, proposal: RoomPerceptionProposal) => Promise<void>;
  onPreview: (draft: SpatialDraft | null) => void;
  wizard?: boolean;
  onBusyChanged?: (busy: boolean) => void;
  onStageChanged?: (stage: "PHOTOS" | "BUILDING" | "REVIEW") => void;
  previewContent?: ReactNode;
};

/** Ordinary Inspector workflow; server owns private images, inference, validation and saved Apply. */
export function RoomPhotoPanel({
  draft,
  csrfToken,
  prepare,
  isCurrent,
  apply,
  onPreview,
  wizard = false,
  onBusyChanged,
  onStageChanged,
  previewContent,
}: RoomPhotoPanelProps) {
  const [availability, setAvailability] = useState<{ available: boolean; message: string } | null>(null);
  const [files, setFiles] = useState<File[]>([]),
    [consent, setConsent] = useState(false);
  const [sharedFeatureId, setSharedFeatureId] = useState("");
  const [phase, setPhase] = useState(""),
    [error, setError] = useState("");
  const [outcome, setOutcome] = useState<"CLARIFICATION" | "CANCELLED" | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const feedback = useRef<HTMLDivElement>(null);
  const previewCallback = useRef(onPreview);
  useEffect(() => {
    previewCallback.current = onPreview;
  }, [onPreview]);
  const [photos, setPhotos] = useState<{ mediaId: string; permissionExpiresAt: string }[]>([]);
  const [proposal, setProposal] = useState<{ base: RoomPhotoBase; value: RoomPerceptionProposal } | null>(null);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  useEffect(() => {
    return () => thumbnails.forEach((url) => URL.revokeObjectURL(url));
  }, [thumbnails]);
  const [busy, setBusy] = useState(false);
  const [processing, setProcessing] = useState(false);
  useEffect(() => {
    onBusyChanged?.(busy);
  }, [busy, onBusyChanged]);
  useEffect(() => {
    onStageChanged?.(proposal ? "REVIEW" : busy ? "BUILDING" : "PHOTOS");
  }, [proposal, busy, onStageChanged]);
  useEffect(() => {
    if (!processing) return;
    const started = performance.now();
    const timer = window.setInterval(() => setElapsed(Math.floor((performance.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [processing]);
  useEffect(() => {
    if (!error && !outcome) return;
    feedback.current?.focus({ preventScroll: true });
    feedback.current?.scrollIntoView?.({ block: "nearest" });
  }, [error, outcome]);
  const [previewing, setPreviewing] = useState(false);
  const clearPreview = () => {
    onPreview(null);
    setPreviewing(false);
  };
  const controller = useRef<AbortController | null>(null),
    mounted = useRef(true);
  const room = draft.content.studio?.environment;
  const errorSummary = /too long|timed? out|timeout/i.test(error)
    ? "The reconstruction request timed out. Your room is unchanged. You can try again when you’re ready."
    : /failed to fetch|network|connection/i.test(error)
      ? "I couldn’t reach the server. Your room is unchanged. Check your connection and try again."
      : "Your room is unchanged. Review the details below, then try again or choose another photo.";
  useEffect(() => {
    mounted.current = true;
    const abort = new AbortController();
    void fetch(`/api/studio/parallax/room-photo?definitionId=${encodeURIComponent(draft.content.definitionId)}`, {
      signal: abort.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Photo configuration could not be checked.");
        const data = await response.json();
        if (mounted.current) {
          setAvailability(data);
          setPhotos(data.photos ?? []);
        }
      })
      .catch(() => {
        if (!abort.signal.aborted && mounted.current)
          setAvailability({
            available: false,
            message: "Photo configuration could not be checked. Manual room editing is available.",
          });
      });
    return () => {
      mounted.current = false;
      abort.abort();
      controller.current?.abort();
      previewCallback.current(null);
    };
  }, [draft.content.definitionId]);
  const json = async (body: unknown, signal?: AbortSignal) => {
    const response = await fetch("/api/studio/parallax/room-photo", {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken() },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Photo processing could not finish.");
    return data;
  };
  const reconstruct = async () => {
    if (!files.length || files.length > 2 || !consent || busy) return;
    const abort = new AbortController();
    controller.current = abort;
    setElapsed(0);
    setBusy(true);
    setProcessing(true);
    setError("");
    setOutcome(null);
    clearPreview();
    setProposal(null);
    setPhase("Saving current scene…");
    try {
      const base = await prepare();
      if (abort.signal.aborted) throw new Error("Cancelled");
      setPhase("Importing and checking the private photograph…");
      const mediaIds: string[] = [];
      for (const file of files) {
        const form = new FormData();
        form.set("image", file);
        form.set("definitionId", base.draft.content.definitionId);
        form.set("consent", "yes");
        const imported = await fetch("/api/studio/parallax/room-photo", {
          method: "POST",
          signal: abort.signal,
          headers: { "x-csrf-token": csrfToken() },
          body: form,
        });
        const media = await imported.json();
        if (!imported.ok) throw new Error(media.error ?? "Photo import could not finish.");
        if (!mounted.current) return;
        mediaIds.push(media.mediaId);
        setPhotos((current) => [...current.filter((photo) => photo.mediaId !== media.mediaId), media]);
      }
      if (!isCurrent(base))
        throw new Error("The scene changed during import. Save its current state before trying again.");
      setPhase("Preparing approximate room geometry…");
      const result = await json(
        {
          action: "RECONSTRUCT",
          ...base,
          requestId: crypto.randomUUID(),
          idempotencyKey: crypto.randomUUID(),
          mediaIds: [...new Set(mediaIds)],
          sharedFeatureId: room ? sharedFeatureId : null,
        },
        abort.signal,
      );
      if (!mounted.current) return;
      if (!isCurrent(base))
        throw new Error(
          "The scene changed while processing the photo. This proposal was discarded; your scene is unchanged.",
        );
      if (result.status === "PROPOSED") {
        setProposal({ base, value: result.proposal });
        if (wizard) {
          onPreview({
            ...base.draft,
            content: {
              ...base.draft.content,
              studio: { ...base.draft.content.studio!, environment: result.proposal.room },
            },
          });
          setPreviewing(true);
        }
        setPhase("Room proposal ready for review. Your scene is unchanged.");
      } else if (result.status === "CLARIFICATION") {
        setOutcome("CLARIFICATION");
        setPhase(result.message || "I need a clearer view to build a usable room. Try another angle of the same room.");
      } else throw new Error(result.message ?? "No room proposal was generated. Try a clearer view or edit manually.");
    } catch (cause) {
      if (mounted.current) {
        if (abort.signal.aborted) {
          setOutcome("CANCELLED");
          setPhase(
            "Cancelled. Your authored scene is unchanged. Any imported photo permission can be withdrawn below.",
          );
        } else {
          setError(cause instanceof Error ? cause.message : "Photo processing failed.");
          setPhase("");
        }
      }
    } finally {
      if (mounted.current) {
        setBusy(false);
        setProcessing(false);
      }
      if (controller.current === abort) controller.current = null;
    }
  };
  return (
    <section
      aria-label="Room photograph reconstruction"
      className={wizard ? styles.photoWizard : undefined}
      aria-busy={busy}
    >
      {(error || outcome) && !busy && (
        <div
          ref={feedback}
          className={styles.photoFeedback}
          role={error ? "alert" : "status"}
          tabIndex={-1}
          data-outcome={error ? "ERROR" : outcome}
        >
          <span className={styles.photoFeedbackIcon} aria-hidden="true">
            {outcome === "CANCELLED" ? "×" : "!"}
          </span>
          <div>
            <h3>
              {error
                ? "I couldn’t finish this room"
                : outcome === "CLARIFICATION"
                  ? "I need a clearer view"
                  : "Reconstruction cancelled"}
            </h3>
            <p>
              {error
                ? errorSummary
                : outcome === "CLARIFICATION"
                  ? "Your room is unchanged. Try another angle or add a second view of the same room."
                  : "Your room is unchanged. You can continue whenever you’re ready."}
            </p>
            <details>
              <summary>What happened</summary>
              <p>{error || phase}</p>
            </details>
            {!!files.length && consent && availability?.available && (!room || sharedFeatureId) && (
              <button type="button" onClick={() => void reconstruct()}>
                Try again
              </button>
            )}
          </div>
        </div>
      )}
      {busy && (
        <div className={wizard ? styles.photoBuilding : styles.photoProgress} role="status" aria-live="polite">
          {wizard ? (
            <div className={styles.photoRoomThinking} aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          ) : (
            <span className={styles.photoSpinner} aria-hidden="true" />
          )}
          <div>
            <h3>{processing ? "I’m building your room" : "Saving your room"}</h3>
            <p>{phase || "Saving room geometry…"}</p>
          </div>
          {processing && (
            <small>
              {elapsed < 20
                ? "Finding the layout, furniture and surfaces"
                : `Still working · ${elapsed}s elapsed. You can cancel at any time.`}
            </small>
          )}
          <button type="button" disabled={!processing} onClick={() => controller.current?.abort()}>
            Cancel photo processing
          </button>
        </div>
      )}
      {(!wizard || !proposal) && (
        <div hidden={wizard && busy}>
          <p className={styles.photoIntro}>
            Add one or two views of the same room. I’ll build an editable 3D layout for you to review.
          </p>
          {!availability?.available && (
            <p className={styles.photoUnavailable} role="status">
              {availability?.message ?? "Checking photo configuration…"}
            </p>
          )}
          <fieldset className={wizard ? styles.photoUpload : undefined} disabled={busy || !availability?.available}>
            <legend className={wizard ? styles.photoVisuallyHidden : undefined}>Room photograph</legend>
            <label
              className={wizard ? `${styles.photoPicker} ${files.length ? styles.photoPickerCompact : ""}` : undefined}
            >
              <span aria-hidden="true">{files.length ? "Change photos" : "Choose room photos"}</span>
              <small>JPEG, PNG or WebP · up to 8 MiB each</small>
              <input
                aria-label="Room photograph"
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                className={wizard ? styles.photoFileInput : undefined}
                onChange={(event) => {
                  const next = Array.from(event.target.files ?? []);
                  const issue =
                    next.length > 2
                      ? "Choose at most two photographs of the same room."
                      : next.some((file) => file.size > 8 * 1024 * 1024)
                        ? "Each photograph must be 8 MiB or smaller."
                        : next.some((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type))
                          ? "Choose JPEG, PNG or WebP photographs."
                          : "";
                  setFiles(issue ? [] : next);
                  setThumbnails(issue ? [] : next.map((file) => URL.createObjectURL(file)));
                  setError(issue);
                  setOutcome(null);
                  setPhase("");
                  clearPreview();
                  setProposal(null);
                  setConsent(false);
                }}
              />
            </label>
            {files.length > 0 && (
              <>
                {wizard && (
                  <div className={styles.photoThumbnails}>
                    {thumbnails.map((url, index) => (
                      <figure key={url}>
                        <div className={styles.photoThumbFrame}>
                          <Image
                            unoptimized
                            fill
                            sizes="(max-width: 700px) 40vw, 360px"
                            src={url}
                            alt={`Selected room view ${index + 1}`}
                          />
                        </div>
                        <figcaption>View {index + 1}</figcaption>
                      </figure>
                    ))}
                  </div>
                )}
              </>
            )}
            {room && (
              <label>
                Feature visible in this additional view
                <select
                  aria-label="Shared room feature"
                  value={sharedFeatureId}
                  onChange={(event) => setSharedFeatureId(event.target.value)}
                >
                  <option value="">Choose a recognizable shared feature</option>
                  {room.features
                    .filter(
                      (feature) => !["FLOOR", "WALL", "CEILING", "EXCLUSION_ZONE"].includes(feature.classification),
                    )
                    .map((feature) => (
                      <option key={feature.id} value={feature.id}>
                        {feature.name}
                      </option>
                    ))}
                </select>
              </label>
            )}
            <label className={wizard ? styles.photoConsent : undefined}>
              <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />I own or
              have permission to use these photos and authorize sending their sanitized images to OpenAI for room
              reconstruction and token counting.
            </label>
            <details className={styles.photoPrivacy}>
              <summary>Privacy &amp; reconstruction details</summary>
              <p>
                Use clear room views without people or readable private documents. Scale and hidden geometry are
                estimated; review the layout and adjust it in the editor. No measurement is required.
              </p>
              <p>
                The original and sanitized image stay in private media storage under its retention policy. Processing
                permission expires after 24 hours or withdrawal. Saving room geometry does not publish the photograph.
              </p>
              <p>{availability?.message ?? "Checking photo configuration…"}</p>
            </details>
            <button
              type="button"
              className={wizard ? styles.photoPrimary : undefined}
              aria-label={room ? "Refine room from photograph" : "Reconstruct room from photograph"}
              disabled={!files.length || files.length > 2 || !consent || (Boolean(room) && !sharedFeatureId)}
              onClick={() => void reconstruct()}
            >
              {room ? "Refine room" : "Reconstruct room"}
            </button>
          </fieldset>
        </div>
      )}
      {phase && !busy && !outcome && !error && <p aria-live="polite">{phase}</p>}
      {proposal && (
        <section aria-label="Proposed room">
          <h3>{proposal.value.room.name}</h3>
          <p>
            {proposal.value.room.features.length} editable features · {proposal.value.room.width} ×{" "}
            {proposal.value.room.depth} m · estimated height {proposal.value.room.height} m
          </p>
          {wizard && <p>Scale is estimated automatically; check the layout and adjust it in the editor.</p>}
          {previewContent}
          <details open={!wizard}>
            <summary>Review notes · {proposal.value.warnings.length}</summary>
            <ul>
              {proposal.value.warnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          </details>
          <p>
            {wizard
              ? "Save this independent environment and open its room features for editing. Your original scene stays saved."
              : "Applying saves this room in the current scene. Existing confirmed features and scale measurements take precedence."}
          </p>
          {!wizard && (
            <button
              type="button"
              disabled={busy || !isCurrent(proposal.base)}
              onClick={() => {
                if (previewing) clearPreview();
                else {
                  onPreview({
                    ...proposal.base.draft,
                    content: {
                      ...proposal.base.draft.content,
                      studio: { ...proposal.base.draft.content.studio!, environment: proposal.value.room },
                    },
                  });
                  setPreviewing(true);
                }
              }}
            >
              {previewing ? "Return to saved scene" : "Preview room proposal"}
            </button>
          )}
          {previewing && <p>Previewing proposed geometry. The saved scene is unchanged until you apply.</p>}
          <button
            type="button"
            disabled={busy || !isCurrent(proposal.base)}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await apply(proposal.base, proposal.value);
                if (mounted.current) {
                  clearPreview();
                  setProposal(null);
                  setPhase(
                    "Room geometry saved. Review it in the canvas and correct its features or known measurement.",
                  );
                }
              } catch (cause) {
                if (mounted.current)
                  setError(cause instanceof Error ? cause.message : "The room could not be applied.");
              } finally {
                if (mounted.current) setBusy(false);
              }
            }}
          >
            Apply and save room
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              clearPreview();
              setProposal(null);
              setPhase("Proposal discarded. Your scene is unchanged.");
            }}
          >
            Discard room proposal
          </button>
          {!isCurrent(proposal.base) && <p>Save and request another proposal; this scene has changed.</p>}
        </section>
      )}
      {!!photos.length && !busy && (
        <details className={styles.photoPermissions}>
          <summary>Manage photo permissions · {photos.length}</summary>
          {photos.map((photo, index) => (
            <div key={photo.mediaId}>
              <p>Private photo permission expires {new Date(photo.permissionExpiresAt).toLocaleString()}.</p>
              <button
                type="button"
                aria-label={`Withdraw photo ${index + 1} processing permission`}
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    await json({
                      action: "WITHDRAW",
                      definitionId: draft.content.definitionId,
                      mediaId: photo.mediaId,
                    });
                    if (mounted.current) {
                      clearPreview();
                      setPhotos((current) => current.filter((item) => item.mediaId !== photo.mediaId));
                      setProposal(null);
                      setPhase(
                        "Future photo processing permission withdrawn. Existing authored room geometry is retained.",
                      );
                    }
                  } catch (cause) {
                    if (mounted.current)
                      setError(cause instanceof Error ? cause.message : "Permission could not be withdrawn.");
                  } finally {
                    if (mounted.current) setBusy(false);
                  }
                }}
              >
                Withdraw photo {index + 1} processing permission
              </button>
            </div>
          ))}
        </details>
      )}
    </section>
  );
}

"use client";
import { useEffect, useRef, useState } from "react";
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
}: RoomPhotoPanelProps) {
  const [availability, setAvailability] = useState<{ available: boolean; message: string } | null>(null);
  const [files, setFiles] = useState<File[]>([]),
    [consent, setConsent] = useState(false);
  const [sharedFeatureId, setSharedFeatureId] = useState("");
  const [phase, setPhase] = useState(""),
    [error, setError] = useState("");
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
  const [previewing, setPreviewing] = useState(false);
  const clearPreview = () => {
    onPreview(null);
    setPreviewing(false);
  };
  const controller = useRef<AbortController | null>(null),
    mounted = useRef(true);
  const room = draft.content.studio?.environment;
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
      onPreview(null);
    };
  }, [draft.content.definitionId, onPreview]);
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
    setBusy(true);
    setProcessing(true);
    setError("");
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
      } else if (result.status === "CLARIFICATION") setPhase(result.message);
      else throw new Error(result.message ?? "No room proposal was generated. Try a clearer view or edit manually.");
    } catch (cause) {
      if (mounted.current) {
        if (abort.signal.aborted)
          setPhase(
            "Cancelled. Your authored scene is unchanged. Any imported photo permission can be withdrawn below.",
          );
        else {
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
      <p>
        Build an approximate editable room from one or two photographs of the same room, or refine it using another
        view.
      </p>
      <p aria-live="polite">{availability?.message ?? "Checking photo configuration…"}</p>
      <p>
        Use a clear room view without people or readable private documents. Floor and hidden walls are inferred; check
        furniture positions. Scale is estimated automatically; you can adjust it later without a known measurement.
      </p>
      <fieldset disabled={busy || !availability?.available}>
        <legend>Room photograph</legend>
        <label>
          One or two JPEG, PNG or WebP images · at most 8 MiB each
          <input
            aria-label="Room photograph"
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
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
            <p>
              {files.length} photograph{files.length === 1 ? "" : "s"} selected. Both views use one room coordinate
              frame.
            </p>
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
                .filter((feature) => !["FLOOR", "WALL", "CEILING", "EXCLUSION_ZONE"].includes(feature.classification))
                .map((feature) => (
                  <option key={feature.id} value={feature.id}>
                    {feature.name}
                  </option>
                ))}
            </select>
          </label>
        )}
        <label>
          <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />I own or
          have permission to use this photo and authorize sending its sanitized image to OpenAI for this scene&apos;s
          room reconstruction and token check.
        </label>
        <p>
          The original and sanitized image stay in private media storage under its retention policy. Processing
          permission expires after 24 hours or withdrawal. Applying room geometry does not publish the photograph.
        </p>
        <button
          type="button"
          disabled={!files.length || files.length > 2 || !consent || (Boolean(room) && !sharedFeatureId)}
          onClick={() => void reconstruct()}
        >
          {room ? "Refine room from photograph" : "Reconstruct room from photograph"}
        </button>
      </fieldset>
      {busy && (
        <div className={styles.photoProgress} role="status">
          <span className={styles.photoSpinner} aria-hidden="true" />
          <span>{phase || "Saving room geometry…"}</span>
          <button type="button" disabled={!processing} onClick={() => controller.current?.abort()}>
            Cancel photo processing
          </button>
        </div>
      )}
      {phase && !busy && <p aria-live="polite">{phase}</p>}
      {error && <p role="alert">{error}</p>}
      {proposal && (
        <section aria-label="Proposed room">
          <h3>{proposal.value.room.name}</h3>
          <p>
            {proposal.value.room.features.length} editable features · {proposal.value.room.width} ×{" "}
            {proposal.value.room.depth} m · estimated height {proposal.value.room.height} m
          </p>
          <ul>
            {proposal.value.warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
          <p>
            Applying saves this room in the current scene. Existing confirmed features and scale measurements take
            precedence.
          </p>
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
                await json({ action: "WITHDRAW", definitionId: draft.content.definitionId, mediaId: photo.mediaId });
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
    </section>
  );
}

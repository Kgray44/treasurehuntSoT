"use client";
import { useEffect, useRef, useState } from "react";
import type { RoomEnvironment } from "@/parallax/environment-contracts";
import type { SpatialDraft } from "@/parallax/authoring";
import type { SpatialLibraryRecord } from "@/parallax/library-service";
import type { EnvironmentLibraryRecord } from "@/parallax/library-lifecycle-contracts";
import { simulationEnvironments } from "@/parallax/studio-validation";
import { createRoomEnvironment } from "@/parallax/environment-authoring";
import { createEmptyEnvironment, duplicateEnvironment } from "@/parallax/environment-library-authoring";
import { RoomPhotoPanel, type RoomPhotoPanelProps } from "./RoomPhotoPanel";
import { SpatialCanvas } from "./SpatialCanvas";
import { StudioIcon } from "./StudioContextMenu";
import styles from "./SpatialStudio.module.css";

export function EnvironmentCreateDialog({
  items,
  environments = [],
  photo,
  onCreate,
  onClose,
  initialStep = "CHOOSE",
}: {
  items: SpatialLibraryRecord[];
  environments?: EnvironmentLibraryRecord[];
  photo: Omit<RoomPhotoPanelProps, "onPreview" | "wizard">;
  onCreate(room: RoomEnvironment): Promise<void>;
  onClose(): void;
  initialStep?: "CHOOSE" | "PHOTOS";
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState<"CHOOSE" | "EXISTING" | "PHOTOS">(initialStep);
  const [preview, setPreview] = useState<SpatialDraft | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [photoStage, setPhotoStage] = useState<"PHOTOS" | "BUILDING" | "REVIEW">("PHOTOS");
  const [error, setError] = useState("");
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    element?.showModal();
    return () => {
      element?.close();
      previous?.focus();
    };
  }, []);
  const choices = [
    ...environments
      .filter((item) => !item.archived && item.draft.room)
      .map((item) => ({
        key: item.id,
        room: item.draft.room!,
        category: item.saveState === "SAVED" ? "Library" : "Working draft",
      })),
    ...items
      .filter(
        (item) =>
          !item.draft.content.studio?.environmentLibraryArchived && !item.draft.content.studio?.libraryDefinition,
      )
      .flatMap((item) =>
        item.draft.content.studio?.environment
          ? [{ key: item.id, room: item.draft.content.studio.environment, category: "Legacy scene snapshot" }]
          : [],
      ),
    ...simulationEnvironments.map((preset) => ({
      key: `preset:${preset.id}`,
      room: createRoomEnvironment(preset),
      category: "Preset",
    })),
  ].filter((choice) => choice.room.name.toLowerCase().includes(query.toLowerCase()));
  const create = async (room: RoomEnvironment) => {
    setBusy(true);
    setError("");
    try {
      await onCreate(room);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The environment could not be created.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <dialog
      ref={dialog}
      className={styles.environmentDialog}
      aria-labelledby="environment-create-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <header>
        <div>
          <small>Library / Environments</small>
          <h2 id="environment-create-title">
            {step === "CHOOSE"
              ? "Create an environment"
              : step === "EXISTING"
                ? "Start from an existing room"
                : "Build a room from photos"}
          </h2>
        </div>
        <button type="button" aria-label="Close environment setup" disabled={busy} onClick={onClose}>
          ×
        </button>
      </header>
      {step === "CHOOSE" && (
        <div className={styles.environmentChoices}>
          <button type="button" onClick={() => setStep("EXISTING")}>
            <StudioIcon name="copy" />
            <strong>Existing environment</strong>
            <span>Choose a saved room or preset. Edit a separate copy.</span>
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void create(createEmptyEnvironment(crypto.randomUUID()))}
          >
            <StudioIcon name="plus" />
            <strong>Empty environment</strong>
            <span>A clean floor and walls, ready for your room features.</span>
          </button>
          <button type="button" onClick={() => setStep("PHOTOS")}>
            <StudioIcon name="frame" />
            <strong>From photos</strong>
            <span>Add one or two room views. Review an editable 3D reconstruction.</span>
          </button>
        </div>
      )}
      {step === "EXISTING" && (
        <>
          <label>
            Find a room
            <input
              type="search"
              aria-label="Find existing environment"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <div className={styles.environmentPicker}>
            {choices.map((choice) => (
              <button
                type="button"
                key={choice.key}
                aria-label={"Start from " + choice.room.name}
                disabled={busy}
                onClick={() => void create(duplicateEnvironment(choice.room, crypto.randomUUID()))}
              >
                <StudioIcon name="copy" />
                <span>
                  <strong>{choice.room.name}</strong>
                  <small>
                    {choice.category} · {choice.room.features.length} room features
                  </small>
                </span>
              </button>
            ))}
          </div>
          {!choices.length && <p>No matching environments.</p>}
        </>
      )}
      {step === "PHOTOS" && (
        <>
          <ol className={styles.photoSteps} aria-label="Photo reconstruction steps">
            {(["PHOTOS", "BUILDING", "REVIEW"] as const).map((stage, index) => (
              <li key={stage} aria-current={photoStage === stage ? "step" : undefined}>
                <span>{index + 1}</span>
                {["Photos", "Build", "Review"][index]}
              </li>
            ))}
          </ol>
          <RoomPhotoPanel
            {...photo}
            wizard
            onBusyChanged={setBusy}
            onStageChanged={setPhotoStage}
            onPreview={setPreview}
            apply={async (...args) => {
              await photo.apply(...args);
              onClose();
            }}
            previewContent={
              preview && (
                <section className={styles.roomDemo} aria-label="Reconstructed room preview">
                  <h3>Your room proposal</h3>
                  <p>Drag to orbit · scroll or pinch to explore. Estimated geometry; review before saving.</p>
                  <SpatialCanvas
                    draft={preview}
                    selectedId={null}
                    onSelect={() => {}}
                    onEdit={() => {}}
                    onPreset={() => {}}
                    mode="GUIDED"
                    preview="PLAYER"
                    previewOnly
                    environmentId={preview.content.studio!.environment!.id}
                    timeMs={0}
                    inputs={[]}
                  />
                </section>
              )
            }
          />
        </>
      )}
      {error && <p role="alert">{error}</p>}
      {busy && step !== "PHOTOS" && <p role="status">Creating your editable environment…</p>}
      {step !== "CHOOSE" && (
        <footer>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setPreview(null);
              setStep("CHOOSE");
            }}
          >
            Back
          </button>
        </footer>
      )}
    </dialog>
  );
}

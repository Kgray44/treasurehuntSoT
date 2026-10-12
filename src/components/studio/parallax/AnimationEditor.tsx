"use client";
import { useState } from "react";
import { draftSchema, type SpatialDraft } from "@/parallax/authoring";
import type { AnimationTrack } from "@/parallax/studio-contracts";
import { recordAnimationKeyframe, rotationFromDegrees, rotationToDegrees } from "@/parallax/animation-authoring";
import type { Transform } from "@/parallax/contracts";
import styles from "./SpatialStudio.module.css";

export function AnimationEditor({
  draft,
  selected,
  timeMs,
  onTime,
  onChange,
}: {
  draft: SpatialDraft;
  selected: string | null;
  timeMs: number;
  onTime: (time: number) => void;
  onChange: (draft: SpatialDraft) => void;
}) {
  const [property, setProperty] = useState<AnimationTrack["property"]>("POSITION");
  const [error, setError] = useState("");
  const entity = draft.content.entities.find((e) => e.id === selected);
  const locked = draft.content.studio?.layers.find((l) => l.entityId === selected)?.locked ?? false;
  const mutate = (edit: (next: SpatialDraft) => void) => {
    try {
      const next = structuredClone(draft);
      edit(next);
      onChange(draftSchema.parse(next));
      setError("");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "This keyframe could not be saved.");
    }
  };
  return (
    <section aria-label="Object animation editor" className={styles.animationEditor}>
      <p>{entity ? `Animate ${entity.name} in its local anchor frame.` : "Select an object to author animation."}</p>
      <div className={styles.inline}>
        <label>
          Animated property{" "}
          <select
            aria-label="Animated property"
            value={property}
            onChange={(event) => setProperty(event.target.value as AnimationTrack["property"])}
          >
            <option value="POSITION" disabled={Boolean(draft.content.adaptive)}>
              Position (meters)
            </option>
            <option value="ROTATION">Rotation (degrees)</option>
            <option value="SCALE">Scale</option>
            <option value="VISIBILITY">Visibility</option>
          </select>
        </label>
        <button
          disabled={!entity || locked || Boolean(draft.content.adaptive && property === "POSITION")}
          onClick={() => {
            try {
              onChange(recordAnimationKeyframe(draft, selected!, property, Math.round(timeMs / 100) * 100));
              setError("");
            } catch (failure) {
              setError(failure instanceof Error ? failure.message : "Could not record keyframe.");
            }
          }}
        >
          Record keyframe at {(timeMs / 1000).toFixed(1)} s
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      {(draft.content.studio?.animationTracks ?? [])
        .filter((t) => t.entityId === selected)
        .map((track) => (
          <fieldset disabled={locked} key={track.id}>
            <legend>{track.property.toLowerCase()} keyframes</legend>
            <label>
              <input
                type="checkbox"
                checked={track.enabled}
                onChange={(event) =>
                  mutate((next) => {
                    next.content.studio!.animationTracks!.find((t) => t.id === track.id)!.enabled =
                      event.target.checked;
                  })
                }
              />{" "}
              Enable {track.property.toLowerCase()} animation
            </label>
            {track.property !== "VISIBILITY" && (
              <label>
                Interpolation{" "}
                <select
                  aria-label={`${track.property} interpolation`}
                  value={track.interpolation}
                  onChange={(event) =>
                    mutate((next) => {
                      const target = next.content.studio!.animationTracks!.find((t) => t.id === track.id)!;
                      if (target.property !== "VISIBILITY")
                        target.interpolation = event.target.value as "STEP" | "LINEAR" | "EASE_IN_OUT";
                    })
                  }
                >
                  <option value="STEP">Step</option>
                  <option value="LINEAR">Linear</option>
                  <option value="EASE_IN_OUT">Ease in / out</option>
                </select>
              </label>
            )}
            {track.keyframes.map((frame, index) => {
              const value =
                track.property === "ROTATION" ? rotationToDegrees(frame.value as Transform["rotation"]) : frame.value;
              return (
                <div className={styles.keyframeFields} key={`${frame.id}:${JSON.stringify(frame)}`}>
                  <button
                    onClick={() => onTime(frame.atMs)}
                    aria-label={`Preview ${track.property} keyframe ${index + 1}`}
                  >
                    ◆
                  </button>
                  <label>
                    Time (s)
                    <input
                      aria-label={`${track.property} keyframe ${index + 1} seconds`}
                      type="number"
                      min="0"
                      max="60"
                      step="0.1"
                      defaultValue={frame.atMs / 1000}
                      onBlur={(event) =>
                        mutate((next) => {
                          const target = next.content.studio!.animationTracks!.find((t) => t.id === track.id)!;
                          target.keyframes.find((f) => f.id === frame.id)!.atMs = Math.round(
                            Number(event.target.value) * 1000,
                          );
                          target.keyframes.sort((a, b) => a.atMs - b.atMs);
                        })
                      }
                    />
                  </label>
                  {track.property === "VISIBILITY" ? (
                    <label>
                      Visible
                      <input
                        type="checkbox"
                        checked={frame.value as boolean}
                        onChange={(event) =>
                          mutate((next) => {
                            const target = next.content.studio!.animationTracks!.find((t) => t.id === track.id)!;
                            if (target.property === "VISIBILITY")
                              target.keyframes.find((f) => f.id === frame.id)!.value = event.target.checked;
                          })
                        }
                      />
                    </label>
                  ) : typeof value === "number" ? (
                    <label>
                      Scale
                      <input
                        type="number"
                        min="0.01"
                        max="10"
                        step="0.1"
                        aria-label={`SCALE keyframe ${index + 1} value`}
                        defaultValue={value}
                        onBlur={(event) =>
                          mutate((next) => {
                            const target = next.content.studio!.animationTracks!.find((t) => t.id === track.id)!;
                            if (target.property === "SCALE")
                              target.keyframes.find((f) => f.id === frame.id)!.value = Number(event.target.value);
                          })
                        }
                      />
                    </label>
                  ) : (
                    (["x", "y", "z"] as const).map((axis) => (
                      <label key={axis}>
                        {axis.toUpperCase()}
                        {track.property === "ROTATION" ? "°" : " m"}
                        <input
                          aria-label={`${track.property} keyframe ${index + 1} ${axis}`}
                          type="number"
                          step={track.property === "ROTATION" ? "5" : "0.05"}
                          defaultValue={(value as Transform["position"])[axis].toFixed(4)}
                          onBlur={(event) =>
                            mutate((next) => {
                              const target = next.content.studio!.animationTracks!.find((t) => t.id === track.id)!;
                              const frame = target.keyframes.find((f) => f.id === track.keyframes[index].id)!;
                              const edited = {
                                ...(value as Transform["position"]),
                                [axis]: Number(event.target.value),
                              };
                              if (target.property === "ROTATION") frame.value = rotationFromDegrees(edited);
                              else if (target.property === "POSITION") frame.value = edited;
                            })
                          }
                        />
                      </label>
                    ))
                  )}
                  <button
                    aria-label={`Delete ${track.property} keyframe ${index + 1}`}
                    onClick={() =>
                      mutate((next) => {
                        const tracks = next.content.studio!.animationTracks!;
                        const target = tracks.find((t) => t.id === track.id)!;
                        target.keyframes = target.keyframes.filter((f) => f.id !== frame.id) as typeof target.keyframes;
                        if (!target.keyframes.length)
                          next.content.studio!.animationTracks = tracks.filter((t) => t.id !== track.id);
                      })
                    }
                  >
                    Delete
                  </button>
                </div>
              );
            })}
            <button
              onClick={() =>
                mutate((next) => {
                  next.content.studio!.animationTracks = next.content.studio!.animationTracks!.filter(
                    (t) => t.id !== track.id,
                  );
                })
              }
            >
              Remove {track.property.toLowerCase()} track
            </button>
          </fieldset>
        ))}
      <small>
        Scrubbing previews the scene without changing its saved pose. Visibility events win ties with keyframes.
      </small>
    </section>
  );
}

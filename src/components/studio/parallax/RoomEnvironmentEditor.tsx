"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  roomEnvironmentSchema,
  roomFeatureClasses,
  type RoomEnvironment,
  type RoomFeature,
} from "@/parallax/environment-contracts";
import { resizeRoomEnvironment, roomFeatureRelations } from "@/parallax/environment-authoring";
import {
  addRoomFeature,
  removeRoomFeature,
  rebuildRoomFeature,
  scaleRoomFromMeasurement,
  scaleRoomByFactor,
  createGenericRoomFeature,
} from "@/parallax/parametric-room";
import { syntheticRoomGeometry } from "@/parallax/room-geometry";
import { verifyConstructedEnvironment } from "@/parallax/construction-verification";
import { enableRoomExclusions, patchRoomExclusion, reconcileRoomExclusions } from "@/parallax/exclusion-zones";
import styles from "./SpatialStudio.module.css";

/** Same ordinary draft/history/save port as object editing; no browser-local room authority. */
export function RoomEnvironmentEditor({
  room,
  onChange,
  boundSurfaceIds = [],
  selectedFeatureId,
  onSelectFeature,
  editing = true,
  mode = "ENGINEERING",
  onTool,
}: {
  room: RoomEnvironment;
  onChange: (room: RoomEnvironment) => void;
  boundSurfaceIds?: string[];
  selectedFeatureId?: string | null;
  onSelectFeature?: (id: string) => void;
  editing?: boolean;
  mode?: "GUIDED" | "DETAILED" | "ENGINEERING";
  onTool?: (tool: "translate" | "rotate" | "scale") => void;
}) {
  const [localSelectedId, setLocalSelectedId] = useState(
    room.features.find((f) => ["DESK", "TABLE"].includes(f.classification))?.id ?? room.features[0].id,
  );
  const selectedId = selectedFeatureId ?? localSelectedId;
  const setSelectedId = (id: string) => {
    setLocalSelectedId(id);
    onSelectFeature?.(id);
  };
  const [error, setError] = useState("");
  const alertRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (!error) return;
    // Wait for native blur/Tab focus scrolling, then reveal recovery guidance clear of the sticky Inspector title.
    const frame = requestAnimationFrame(() => alertRef.current?.scrollIntoView({ block: "center" }));
    return () => cancelAnimationFrame(frame);
  }, [error]);
  const [feedback, setFeedback] = useState("");
  const [newClass, setNewClass] = useState<RoomFeature["classification"]>("DESK");
  const [measurementAxis, setMeasurementAxis] = useState<"WIDTH" | "HEIGHT" | "DEPTH">("WIDTH");
  const [measurement, setMeasurement] = useState("");
  const [relativeScale, setRelativeScale] = useState("1");
  const construction = useMemo(
    () => verifyConstructedEnvironment(room, syntheticRoomGeometry({ ...room, horizontal: true, vertical: true })),
    [room],
  );
  const feature = room.features.find((f) => f.id === selectedId) ?? room.features[0];
  const featureSelected = !onSelectFeature || Boolean(selectedFeatureId);
  const apply = (next: RoomEnvironment) => {
    try {
      if (next.scaleReference) {
        const reference = next.features.find((f) => f.id === next.scaleReference!.featureId);
        const axis = ({ WIDTH: 0, HEIGHT: 1, DEPTH: 2 } as const)[next.scaleReference.axis];
        if (!reference || Math.abs(reference.dimensions[axis] - next.scaleReference.measuredMeters) > 1e-6)
          next = { ...next, scaleReference: undefined };
      }
      onChange(reconcileRoomExclusions(roomEnvironmentSchema.parse(next)));
      setError("");
    } catch {
      setError("Use finite dimensions and positions within the room editing limits.");
    }
  };
  const run = (action: () => RoomEnvironment, message: string, nextSelected?: string) => {
    try {
      onChange(action());
      setError("");
      setFeedback(message);
      if (nextSelected) setSelectedId(nextSelected);
    } catch (cause) {
      setFeedback("");
      setError(
        cause instanceof Error && !cause.message.startsWith("[")
          ? cause.message
          : "This change exceeds room dimensions or the geometry budget. Reduce the size or remove unused features.",
      );
    }
  };
  const patch = (change: Partial<RoomFeature>) => {
    if (
      feature.classification === "EXCLUSION_ZONE" &&
      (change.position || change.dimensions || change.yawDegrees !== undefined)
    ) {
      run(
        () => patchRoomExclusion(room, feature.id, change),
        "Exclusion zone adjusted. It now keeps your chosen bounds.",
      );
      return;
    }
    apply({
      ...room,
      features: room.features.map((f) =>
        f.id === feature.id
          ? {
              ...f,
              ...change,
              provenance: { ...f.provenance, basis: "CREATOR_CONFIRMED", confidence: 1 },
            }
          : f,
      ),
    });
  };
  const numeric = (label: string, value: number, update: (value: number) => void) => (
    <label key={`${label}:${value}`}>
      {label}
      <input
        type="number"
        step="0.05"
        aria-label={label}
        defaultValue={Number(value.toFixed(4))}
        onBlur={(event) => {
          const next = Number(event.target.value);
          if (!event.target.value.trim() || !Number.isFinite(next)) {
            setError("Enter a finite measurement before leaving this field.");
          } else if (next !== Number(value.toFixed(4))) update(next);
        }}
      />
    </label>
  );
  return (
    <section aria-label="Room feature editor" className={styles.roomEditor}>
      <fieldset disabled={!editing} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <details aria-label="Environment tools and dimensions" open={mode !== "GUIDED" && !selectedFeatureId}>
          <summary role="button">Environment tools &amp; dimensions</summary>
          <p>
            Editable authoring geometry · {room.origin.replaceAll("_", " ").toLowerCase()} · {room.features.length}{" "}
            features. This is not a measured room survey.
          </p>
          <p>Resizing the room moves its features proportionally. Furniture keeps its own dimensions.</p>
          <details aria-label="Exclusion zones">
            <summary role="button">
              Exclusion zones · {room.features.filter((entry) => entry.classification === "EXCLUSION_ZONE").length}
            </summary>
            <p>
              Clear boxes reserve space when Parallax finds a fitting placement. Edit their bounds with the same Move,
              Rotate and Scale tools as room features. They are hidden when environment editing finishes.
            </p>
            <button
              type="button"
              onClick={() => run(() => enableRoomExclusions(room), "Exclusion zones created around modeled blockers.")}
            >
              Find surface blockers
            </button>
            <button
              type="button"
              onClick={() => {
                const id = `zone-${crypto.randomUUID()}`;
                run(
                  () => addRoomFeature(room, "EXCLUSION_ZONE", id),
                  "Added an exclusion zone. Move and resize it around the area to reserve.",
                  id,
                );
              }}
            >
              Add exclusion zone
            </button>
          </details>
          <details aria-label="Construction checks">
            <summary role="button">
              Construction checks · {construction.status === "NEEDS_CORRECTION" ? "needs correction" : "checks passed"}{" "}
              · {construction.findings.length} findings
            </summary>
            <p>
              Checks cover constructed parts, shell, openings, support, overlap and declared paths. Confidence and
              visual acceptance are separate.
            </p>
            {construction.findings.length ? (
              <ul>
                {construction.findings.map((finding, index) => (
                  <li key={`${finding.code}:${index}`}>
                    <strong>{finding.severity === "ERROR" ? "Correct" : "Review"}</strong>: {finding.message}{" "}
                    {finding.featureIds.map((id) => (
                      <button type="button" key={id} onClick={() => setSelectedId(id)}>
                        {room.features.find((f) => f.id === id)?.name ?? id}
                      </button>
                    ))}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No findings within these checks. Physical accessibility and rendered appearance still need review.</p>
            )}
          </details>
          <details aria-label="Add room features">
            <summary role="button">Add room features</summary>
            <label>
              New feature type
              <select
                aria-label="New room feature type"
                value={newClass}
                onChange={(event) => setNewClass(event.target.value as RoomFeature["classification"])}
              >
                {roomFeatureClasses.map((classification) => (
                  <option key={classification} value={classification}>
                    {classification.toLowerCase().replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => {
                const id = `feature-${crypto.randomUUID()}`;
                run(
                  () => addRoomFeature(room, newClass, id),
                  `Added a generic ${newClass.toLowerCase()}. Adjust its position and dimensions below.`,
                  id,
                );
              }}
            >
              Add room feature
            </button>
            <p>
              Doors and windows cut matching coplanar wall openings. Door movement is not simulated. Use Construction
              checks to review support and attachment.
            </p>
          </details>
          {(["Width", "Height", "Depth"] as const).map((label, axis) =>
            numeric(`Room ${label.toLowerCase()} (m)`, [room.width, room.height, room.depth][axis], (value) => {
              try {
                const dimensions: [number, number, number] = [room.width, room.height, room.depth];
                dimensions[axis] = value;
                apply(resizeRoomEnvironment(room, dimensions));
              } catch {
                setError("Room dimensions must be between 1 and 100 metres, with height at most 20 metres.");
              }
            }),
          )}
        </details>
        {feedback && <p aria-live="polite">{feedback}</p>}
        {error && (
          <p ref={alertRef} role="alert">
            {error}
          </p>
        )}
        <label>
          Room feature
          <select aria-label="Room feature" value={featureSelected ? feature.id : ""} onChange={(e) => setSelectedId(e.target.value)}>
            {onSelectFeature && <option value="" disabled>Choose a feature</option>}
            {room.features.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} · {f.classification.toLowerCase().replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        {!featureSelected && <p>Select a room feature to adjust it, or use the room tools above.</p>}
        {featureSelected && (
          <>
        {mode === "GUIDED" && (
          <div className={styles.inspectorActions} role="group" aria-label="Room feature canvas tools">
            <button type="button" onClick={() => onTool?.("translate")}>Move in scene</button>
            <button type="button" onClick={() => onTool?.("rotate")}>Rotate in scene</button>
            <button type="button" onClick={() => onTool?.("scale")}>Resize in scene</button>
          </div>
        )}
        <label>
          Feature name
          <input
            key={`${feature.id}:${feature.name}`}
            aria-label="Feature name"
            defaultValue={feature.name}
            maxLength={120}
            onBlur={(e) => {
              if (e.target.value.trim() && e.target.value !== feature.name) patch({ name: e.target.value });
            }}
          />
        </label>
        <label>
          Classification
          <select
            aria-label="Room feature classification"
            value={feature.classification}
            disabled={feature.classification === "EXCLUSION_ZONE"}
            onChange={(e) => patch({ classification: e.target.value as RoomFeature["classification"] })}
          >
            {roomFeatureClasses
              .filter((c) => c !== "EXCLUSION_ZONE" || feature.classification === c)
              .map((c) => (
                <option key={c} value={c}>
                  {c.toLowerCase().replaceAll("_", " ")}
                </option>
              ))}
          </select>
        </label>
        {feature.classification === "EXCLUSION_ZONE" && (
          <>
            <p>
              {feature.exclusion?.sourceFeatureId
                ? "Automatic envelope follows its modeled blocker. Changing its bounds makes it independent."
                : "Authored exclusion zone."}{" "}
              Removing a zone keeps actual modeled solids protected.
            </p>
            <label>
              Reserved surface
              <select
                aria-label="Exclusion reserved surface"
                value={feature.exclusion?.surfaceId ?? ""}
                onChange={(event) =>
                  run(
                    () =>
                      patchRoomExclusion(room, feature.id, {
                        exclusion: event.target.value ? { surfaceId: event.target.value } : {},
                      }),
                    "Exclusion surface updated.",
                  )
                }
              >
                <option value="">Intersecting surfaces</option>
                {room.features.flatMap((entry) =>
                  entry.parts
                    .filter((part) => part.surface)
                    .map((part) => (
                      <option key={part.id} value={part.id}>
                        {entry.name} · {part.surface!.toLowerCase()}
                      </option>
                    )),
                )}
              </select>
            </label>
          </>
        )}
        {mode === "ENGINEERING" && feature.classification !== "EXCLUSION_ZONE" && (
          <p>
            {feature.provenance.basis.replaceAll("_", " ").toLowerCase()} ·{" "}
            {Math.round(feature.provenance.confidence * 100)}% confidence in this authoring model
          </p>
        )}
        {feature.classification === "DOOR" && (
          <label>
            Door state
            <select
              aria-label="Door state"
              value={feature.openingState ?? "UNKNOWN"}
              onChange={(event) => {
                const openingState = event.target.value as NonNullable<RoomFeature["openingState"]>;
                patch({ openingState, parts: createGenericRoomFeature({ ...feature, openingState }).parts });
              }}
            >
              <option value="OPEN">Open doorway</option>
              <option value="CLOSED">Closed door</option>
              <option value="UNKNOWN">Unknown</option>
            </select>
          </label>
        )}
        {feature.classification === "APPLIANCE" && (
          <label>
            Appliance shape
            <select
              aria-label="Appliance shape"
              value={feature.applianceShape ?? "LEGACY"}
              onChange={(event) => {
                const applianceShape = event.target.value as NonNullable<RoomFeature["applianceShape"]>;
                patch({ applianceShape, parts: createGenericRoomFeature({ ...feature, applianceShape }).parts });
              }}
            >
              <option value="LEGACY" disabled>
                Existing shape
              </option>
              <option value="PROJECTOR">Ceiling projector</option>
              <option value="EQUIPMENT">Bench equipment</option>
              <option value="WALL_PANEL">Wall equipment panel</option>
              <option value="GENERIC_BOX">Generic equipment</option>
            </select>
          </label>
        )}
        <details aria-label="Correct or remove room feature">
          <summary role="button">Correct or remove this feature</summary>
          <p>
            Classification changes its label. Rebuild also changes the generic shape, keeping its name, dimensions and
            position.
          </p>
          <button
            type="button"
            onClick={() =>
              run(
                () => rebuildRoomFeature(room, feature.id, feature.classification, boundSurfaceIds),
                `Rebuilt ${feature.name} as a generic ${feature.classification.toLowerCase()}.`,
              )
            }
          >
            Rebuild generic feature shape
          </button>
          <button
            type="button"
            onClick={() =>
              run(
                () => removeRoomFeature(room, feature.id, boundSurfaceIds),
                `Removed ${feature.name}. Undo restores it.`,
              )
            }
          >
            Remove room feature
          </button>
          <p>
            Attached objects must be moved to another surface before removing or rebuilding their support. The whole
            floor is retained.
          </p>
        </details>
        {mode === "ENGINEERING" && (["x", "y", "z"] as const).map((axis) =>
          numeric(`Feature ${axis} (m)`, feature.position[axis], (value) =>
            patch({ position: { ...feature.position, [axis]: value } }),
          ),
        )}
        {mode !== "GUIDED" && (["width", "height", "depth"] as const).map((label, axis) =>
          numeric(`Feature ${label} (m)`, feature.dimensions[axis], (value) => {
            const dimensions = [...feature.dimensions] as RoomFeature["dimensions"];
            dimensions[axis] = value;
            patch({ dimensions });
          }),
        )}
        {mode !== "GUIDED" && numeric("Feature rotation (degrees)", feature.yawDegrees, (yawDegrees) => patch({ yawDegrees }))}
        {mode !== "GUIDED" && (
          <p>
            Nearby features:{" "}
            {roomFeatureRelations(room, feature.id)
              .slice(0, 3)
              .map(
                (relation) =>
                  `${relation.classification.toLowerCase()} ${relation.distanceMeters.toFixed(2)} m, ${relation.direction.replaceAll("_", " ").toLowerCase()}`,
              )
              .join("; ") || "none"}
            .
          </p>
        )}
        <details aria-label="Adjust estimated room scale">
          <summary role="button">Adjust estimated room scale (optional)</summary>
          <p>
            No real measurement is required. This changes the room and furniture together; the layout stays
            proportional. Clue sizes keep their metres. Existing physical scale references are cleared.
          </p>
          <label>
            Relative scale
            <input
              aria-label="Relative room scale"
              type="number"
              min="0.1"
              max="10"
              step="0.1"
              value={relativeScale}
              onChange={(event) => setRelativeScale(event.target.value)}
            />
          </label>
          <button
            type="button"
            onClick={() =>
              run(
                () => scaleRoomByFactor(room, Number(relativeScale)),
                "Room scale adjusted. Dimensions remain estimates.",
              )
            }
          >
            Apply relative scale
          </button>
        </details>
        <details aria-label="Scale room from a known measurement">
          <summary role="button">Scale room from a known measurement</summary>
          <p>
            Use the selected feature as a reference. This scales room positions and all room-feature dimensions
            uniformly. Authored clue sizes keep their metres; attached clues follow their support. Other dimensions
            remain estimates.
          </p>
          <label>
            Reference measurement
            <select
              aria-label="Reference measurement axis"
              value={measurementAxis}
              onChange={(event) => setMeasurementAxis(event.target.value as typeof measurementAxis)}
            >
              <option value="WIDTH">Width</option>
              <option value="HEIGHT">Height</option>
              <option value="DEPTH">Depth</option>
            </select>
          </label>
          <label>
            Known measurement (m)
            <input
              aria-label="Known measurement (m)"
              type="number"
              min="0.05"
              max="100"
              step="0.05"
              value={measurement}
              onChange={(event) => setMeasurement(event.target.value)}
            />
          </label>
          <button
            type="button"
            onClick={() =>
              run(
                () => scaleRoomFromMeasurement(room, feature.id, measurementAxis, Number(measurement)),
                `Scaled the room using ${feature.name}'s ${measurementAxis.toLowerCase()}. Review the other estimated measurements before saving.`,
              )
            }
          >
            Apply known measurement
          </button>
          {room.scaleReference && (
            <p>
              Scale reference: {room.features.find((f) => f.id === room.scaleReference!.featureId)?.name} ·{" "}
              {room.scaleReference.axis.toLowerCase()} {room.scaleReference.measuredMeters.toFixed(2)} m. Changing that
              dimension clears this reference.
            </p>
          )}
        </details>
          </>
        )}
      </fieldset>
    </section>
  );
}

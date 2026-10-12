"use client";
import { useState } from "react";
import {
  roomEnvironmentSchema,
  roomFeatureClasses,
  type RoomEnvironment,
  type RoomFeature,
} from "@/parallax/environment-contracts";
import { resizeRoomEnvironment, roomFeatureRelations } from "@/parallax/environment-authoring";

/** Same ordinary draft/history/save port as object editing; no browser-local room authority. */
export function RoomEnvironmentEditor({
  room,
  onChange,
}: {
  room: RoomEnvironment;
  onChange: (room: RoomEnvironment) => void;
}) {
  const [selectedId, setSelectedId] = useState(
    room.features.find((f) => ["DESK", "TABLE"].includes(f.classification))?.id ?? room.features[0].id,
  );
  const [error, setError] = useState("");
  const feature = room.features.find((f) => f.id === selectedId) ?? room.features[0];
  const apply = (next: RoomEnvironment) => {
    try {
      onChange(roomEnvironmentSchema.parse(next));
      setError("");
    } catch {
      setError("Use finite dimensions and positions within the room editing limits.");
    }
  };
  const patch = (change: Partial<RoomFeature>) =>
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
    <section aria-label="Room feature editor">
      <p>
        Editable authoring geometry · {room.origin.replaceAll("_", " ").toLowerCase()} · {room.features.length}{" "}
        features. This is not a measured room survey.
      </p>
      <p>Resizing the room moves its features proportionally. Furniture keeps its own dimensions.</p>
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
      <label>
        Room feature
        <select aria-label="Room feature" value={feature.id} onChange={(e) => setSelectedId(e.target.value)}>
          {room.features.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name} · {f.classification.toLowerCase()}
            </option>
          ))}
        </select>
      </label>
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
          onChange={(e) => patch({ classification: e.target.value as RoomFeature["classification"] })}
        >
          {roomFeatureClasses.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <p>
        {feature.provenance.basis.replaceAll("_", " ").toLowerCase()} ·{" "}
        {Math.round(feature.provenance.confidence * 100)}% confidence in this authoring model
      </p>
      {(["x", "y", "z"] as const).map((axis) =>
        numeric(`Feature ${axis} (m)`, feature.position[axis], (value) =>
          patch({ position: { ...feature.position, [axis]: value } }),
        ),
      )}
      {(["width", "height", "depth"] as const).map((label, axis) =>
        numeric(`Feature ${label} (m)`, feature.dimensions[axis], (value) => {
          const dimensions = [...feature.dimensions] as RoomFeature["dimensions"];
          dimensions[axis] = value;
          patch({ dimensions });
        }),
      )}
      {numeric("Feature rotation (degrees)", feature.yawDegrees, (yawDegrees) => patch({ yawDegrees }))}
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
      {error && <p role="alert">{error}</p>}
    </section>
  );
}

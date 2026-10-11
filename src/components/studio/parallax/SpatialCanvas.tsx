"use client";
import { useRef, useState } from "react";
import { worldTransform, type SpatialDraft, type Edit } from "@/parallax/authoring";
import { composeTransform, inverseTransform } from "@/parallax/transforms";
import { identityTransform } from "@/parallax/contracts";
import { evaluateSpatialBehavior, type SpatialInput } from "@/parallax/behavior";
import { simulationEnvironments } from "@/parallax/studio-validation";
import styles from "./SpatialStudio.module.css";

export function SpatialCanvas({
  draft,
  selectedId,
  onSelect,
  onEdit,
  onPreset,
  mode,
  preview,
  environmentId,
  timeMs,
  inputs,
}: {
  draft: SpatialDraft;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onEdit: (edit: Edit) => void;
  onPreset: (name: string) => void;
  mode: string;
  preview: string;
  environmentId: string;
  timeMs: number;
  inputs: SpatialInput[];
}) {
  const [yaw, setYaw] = useState(0.35),
    [zoom, setZoom] = useState(1);
  const [pitch, setPitch] = useState(0.4);
  const [dragOffset, setDragOffset] = useState<{ id: string; x: number; y: number } | null>(null);
  const drag = useRef<{ id: string; x: number; y: number; transform: ReturnType<typeof worldTransform> } | null>(null);
  const environment = simulationEnvironments.find((e) => e.id === environmentId) ?? simulationEnvironments[0];
  const scale = 115 * zoom;
  const project = (x: number, y: number, z: number) => ({
    x: 400 + (x * Math.cos(yaw) + z * Math.sin(yaw)) * scale,
    y: 310 - y * scale + (z * Math.cos(yaw) - x * Math.sin(yaw)) * scale * pitch,
  });
  const states = evaluateSpatialBehavior(draft.content, inputs, timeMs, preview === "EDITOR");
  const fallback = ["FALLBACK", "ACCESSIBILITY", "LOW_CAPABILITY"].includes(preview);
  const points = [
    [-environment.width / 2, 0, -environment.depth / 2],
    [environment.width / 2, 0, -environment.depth / 2],
    [environment.width / 2, 0, environment.depth / 2],
    [-environment.width / 2, 0, environment.depth / 2],
  ]
    .map(([x, y, z]) => project(x, y, z))
    .map((p) => `${p.x},${p.y}`)
    .join(" ");
  const moveWorld = (id: string, dx: number, dy: number) => {
    const entity = draft.content.entities.find((e) => e.id === id)!;
    const original = worldTransform(draft.content, id);
    const parent = entity.parentEntityId
      ? worldTransform(draft.content, entity.parentEntityId)
      : draft.content.anchors.find((a) => a.id === entity.anchorId)!.transform;
    const world = {
      ...original,
      position: {
        ...original.position,
        x: original.position.x + dx * Math.cos(yaw),
        z: original.position.z + dx * Math.sin(yaw),
        y: Math.max(0, original.position.y + dy),
      },
    };
    onEdit({ type: "TRANSFORM", entityId: id, transform: composeTransform(inverseTransform(parent), world) });
  };
  const objects = draft.content.entities
    .filter((e) =>
      fallback
        ? draft.content.studio?.layers.find((l) => l.entityId === e.id)?.audience !== "EDITOR_ONLY"
        : states[e.id].visible,
    )
    .map((e) => ({ entity: e, world: worldTransform(draft.content, e.id) }))
    .sort((a, b) => b.world.position.z - a.world.position.z);
  return (
    <section
      className={`${styles.canvas} ${preview === "PHONE" ? styles.phone : ""}`}
      aria-label="Spatial canvas"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const name = e.dataTransfer.getData("application/parallax-preset");
        if (name) onPreset(name);
      }}
    >
      <div className={styles.canvasControls}>
        <label>
          Elevation
          <input
            aria-label="Camera elevation"
            type="range"
            min="-0.8"
            max="0.8"
            step="0.01"
            value={pitch}
            onChange={(e) => setPitch(Number(e.target.value))}
          />
        </label>
        <label>
          Orbit{" "}
          <input
            aria-label="Camera orbit"
            type="range"
            min="-3.14"
            max="3.14"
            step="0.01"
            value={yaw}
            onChange={(e) => setYaw(Number(e.target.value))}
          />
        </label>
        <label>
          Zoom{" "}
          <input
            aria-label="Camera zoom"
            type="range"
            min="0.35"
            max="2"
            step="0.05"
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          />
        </label>
        <button
          onClick={() => {
            setYaw(0.35);
            setZoom(1);
          }}
        >
          Reset view
        </button>
      </div>
      {fallback ? (
        <div className={styles.guidedPreview}>
          <p className={styles.eyebrow}>{preview.replaceAll("_", " ")} · camera free</p>
          <h2>{draft.content.title}</h2>
          <p>{draft.content.fallback.narrative}</p>
          {objects.map(({ entity }) => (
            <article key={entity.id}>
              <button onClick={() => onSelect(entity.id)}>{entity.name}</button>
              <p>{entity.content}</p>
              <small>{entity.alternativeText}</small>
            </article>
          ))}
          <p>Seated · keyboard · sound off · reduced motion · readable descriptions</p>
        </div>
      ) : (
        <svg
          viewBox="0 0 800 500"
          role="group"
          aria-label={`${environment.name} synthetic spatial scene`}
          className={styles.scene}
          onPointerMove={(event) => {
            if (drag.current) {
              event.preventDefault();
              const bounds = event.currentTarget.getBoundingClientRect();
              setDragOffset({
                id: drag.current.id,
                x: ((event.clientX - drag.current.x) * 800) / bounds.width,
                y: ((event.clientY - drag.current.y) * 500) / bounds.height,
              });
            }
          }}
          onPointerUp={(event) => {
            const start = drag.current;
            drag.current = null;
            setDragOffset(null);
            if (start) {
              const bounds = event.currentTarget.getBoundingClientRect();
              moveWorld(
                start.id,
                ((event.clientX - start.x) * 800) / bounds.width / scale,
                (-(event.clientY - start.y) * 500) / bounds.height / scale,
              );
            }
          }}
          onPointerCancel={() => {
            drag.current = null;
            setDragOffset(null);
          }}
        >
          <defs>
            <radialGradient id="parallax-room">
              <stop stopColor="#294752" />
              <stop offset="1" stopColor="#0d202b" />
            </radialGradient>
          </defs>
          <rect width="800" height="500" fill="url(#parallax-room)" />
          <polygon points={points} fill="#25414a" stroke="#6d8784" strokeWidth="1" />
          {Array.from({ length: 9 }, (_, i) => {
            const a = project(-environment.width / 2, 0, -environment.depth / 2 + (i * environment.depth) / 8);
            const b = project(environment.width / 2, 0, -environment.depth / 2 + (i * environment.depth) / 8);
            return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#90a6a3" opacity="0.15" />;
          })}
          {environment.horizontal && (
            <polygon
              points={[
                [-0.75, 0.75, -1.5],
                [0.75, 0.75, -1.5],
                [0.75, 0.75, -0.5],
                [-0.75, 0.75, -0.5],
              ]
                .map(([x, y, z]) => {
                  const p = project(x, y, z);
                  return `${p.x},${p.y}`;
                })
                .join(" ")}
              fill="#79654b"
              stroke="#c4a86c"
              opacity="0.7"
            />
          )}
          <text x="24" y="36" fill="#d9e5dd" fontSize="16">
            {environment.name} / {preview.replaceAll("_", " ")}
          </text>
          <text x="24" y="464" fill="#adc3c0" fontSize="13">
            Synthetic reference · fixed authored positions · physical qualification not established
          </text>
          {objects.map(({ entity, world }) => {
            const p = project(world.position.x, world.position.y, world.position.z);
            if (dragOffset?.id === entity.id) {
              p.x += dragOffset.x;
              p.y += dragOffset.y;
            }
            const layer = draft.content.studio?.layers.find((l) => l.entityId === entity.id);
            const width = Math.max(24, Math.min(280, entity.widthMeters * world.scale * scale));
            const angle = (2 * Math.atan2(world.rotation.y, world.rotation.w) * 180) / Math.PI;
            return (
              <g
                key={entity.id}
                role="button"
                tabIndex={layer?.selectable === false ? -1 : 0}
                aria-label={`${entity.name}. ${entity.alternativeText}`}
                aria-pressed={selectedId === entity.id}
                transform={`translate(${p.x},${p.y}) rotate(${angle})`}
                className={styles.object}
                onClick={() => {
                  if (layer?.selectable !== false) onSelect(entity.id);
                }}
                onKeyDown={(e) => {
                  if (layer?.selectable === false) return;
                  if (["Enter", " "].includes(e.key)) {
                    e.preventDefault();
                    onSelect(entity.id);
                  }
                  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key) && !layer?.locked) {
                    e.preventDefault();
                    moveWorld(
                      entity.id,
                      e.key === "ArrowLeft" ? -0.05 : e.key === "ArrowRight" ? 0.05 : 0,
                      e.key === "ArrowUp" ? 0.05 : e.key === "ArrowDown" ? -0.05 : 0,
                    );
                  }
                }}
                onPointerDown={(e) => {
                  if (preview !== "EDITOR" || layer?.locked || layer?.selectable === false) return;
                  onSelect(entity.id);
                  drag.current = { id: entity.id, x: e.clientX, y: e.clientY, transform: identityTransform() };
                  e.currentTarget.setPointerCapture(e.pointerId);
                }}
              >
                <rect
                  x={-width / 2}
                  y={-width / 3}
                  width={width}
                  height={width * 0.66}
                  rx={entity.kind === "MARKER" ? width / 3 : 4}
                  fill={entity.kind === "PARCHMENT" ? "#e8d2a1" : entity.kind === "MARKER" ? "#75d6c3" : "#deece6"}
                  stroke={selectedId === entity.id || states[entity.id].highlighted ? "#ffcf73" : "#685b45"}
                  strokeWidth={selectedId === entity.id ? 4 : 1}
                />
                <text textAnchor="middle" y="4" fill="#183036" fontSize="12">
                  {entity.name.slice(0, 26)}
                </text>
                {mode === "ENGINEERING" && (
                  <>
                    <line x1="0" y1="0" x2="40" y2="0" stroke="#ff6666" />
                    <line x1="0" y1="0" x2="0" y2="-40" stroke="#7df090" />
                    <text y={width / 3 + 18} textAnchor="middle" fill="#cde8e1" fontSize="10">
                      {world.position.x.toFixed(2)}, {world.position.y.toFixed(2)}, {world.position.z.toFixed(2)} m
                    </text>
                  </>
                )}
              </g>
            );
          })}
          {preview === "CREW" && (
            <>
              <rect x="560" y="60" width="200" height="120" fill="#12303d" stroke="#d4ba7b" />
              <text x="575" y="90" fill="#dce8df">
                Second viewpoint
              </text>
              {objects.map(({ entity, world }) => (
                <circle
                  key={entity.id}
                  cx={660 + (world.position.x * Math.cos(yaw + 0.8) + world.position.z * Math.sin(yaw + 0.8)) * 25}
                  cy={
                    138 -
                    world.position.y * 20 +
                    (world.position.z * Math.cos(yaw + 0.8) - world.position.x * Math.sin(yaw + 0.8)) * 8
                  }
                  r={Math.max(3, entity.widthMeters * world.scale * 12)}
                  fill="#eed08f"
                  aria-label={`Second viewpoint: ${entity.name}`}
                />
              ))}
              <text x="575" y="170" fill="#dce8df" fontSize="10">
                Same geometry · synthetic · no crew sync
              </text>
            </>
          )}
        </svg>
      )}
      <p className={styles.canvasHint}>
        Select an object. Drag to move it; arrow keys move by 5 cm. Rotate, scale, group and snap in the inspector.
      </p>
    </section>
  );
}

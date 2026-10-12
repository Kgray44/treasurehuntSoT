"use client";
import { useEffect, useRef, useState } from "react";
import { previewEntityTransform, previewReferenceFrame, type SpatialDraft, type Edit } from "@/parallax/authoring";
import { composeTransform, inverseTransform } from "@/parallax/transforms";
import { identityTransform, type Transform } from "@/parallax/contracts";
import { placeOnSurface, snapSpatialEntity, surfacePointIsClear } from "@/parallax/surface-placement";
import { evaluateSpatialBehavior, type SpatialInput } from "@/parallax/behavior";
import { simulationEnvironments } from "@/parallax/studio-validation";
import { resolveAdaptiveScene, type Candidate } from "@/parallax/adaptive";
import { syntheticEnvironmentEvidence } from "@/parallax/adaptive-authoring";
import type { createWorkstation, ViewportState } from "./spatial-workstation";
import styles from "./SpatialStudio.module.css";
export function SpatialCanvas(props: {
  draft: SpatialDraft;
  selectedId: string | null;
  highlightedEntityIds?: readonly string[];
  onSelect: (id: string) => void;
  onInspect?: () => void;
  onEdit: (edit: Edit) => void;
  onPreset: (name: string) => void;
  mode: string;
  preview: string;
  environmentId: string;
  timeMs: number;
  inputs: SpatialInput[];
}) {
  const { draft, selectedId, onSelect, onPreset, mode, preview, environmentId, timeMs, inputs } = props;
  const host = useRef<HTMLDivElement>(null),
    engine = useRef<ReturnType<typeof createWorkstation> | null>(null);
  const latest = useRef(props);
  useEffect(() => {
    latest.current = props;
  });
  const [rendererState, setRendererState] = useState("LOADING"),
    [tool, setTool] = useState<ViewportState["tool"]>("select");
  const [space, setSpace] = useState<"world" | "local">("world"),
    [snap, setSnap] = useState(true),
    [overlays, setOverlays] = useState(false);
  const [view, setView] = useState("perspective"),
    [feedback, setFeedback] = useState("Select an object to begin.");
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setTheme(root.dataset.voyageTheme === "light" ? "light" : "dark");
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["data-voyage-theme"] });
    return () => observer.disconnect();
  }, []);
  const environment = simulationEnvironments.find((e) => e.id === environmentId) ?? simulationEnvironments[0];
  const evidence = syntheticEnvironmentEvidence(environment);
  const adaptive = draft.content.adaptive
    ? resolveAdaptiveScene(draft.content, evidence, `studio-preview-${draft.content.adaptive.variant}`)
    : null;
  const fallback =
    ["FALLBACK", "ACCESSIBILITY", "LOW_CAPABILITY"].includes(preview) || adaptive?.status === "GUIDED_FALLBACK";
  const resolvedWorld = (id: string): Transform => {
    const e = draft.content.entities.find((e) => e.id === id)!;
    const placement = adaptive?.placements[id];
    return placement
      ? composeTransform(placement.transform, e.transform)
      : e.parentEntityId && adaptive?.status === "RESOLVED"
        ? composeTransform(resolvedWorld(e.parentEntityId), e.transform)
        : previewEntityTransform(draft.content, id, environmentId, environment);
  };
  const states = evaluateSpatialBehavior(draft.content, inputs, timeMs, preview === "EDITOR");
  const commitWorld = (id: string, world: Transform) => {
    const p = latest.current,
      e = p.draft.content.entities.find((e) => e.id === id)!;
    const a = p.draft.content.anchors.find((a) => a.id === e.anchorId)!;
    const room = simulationEnvironments.find((r) => r.id === p.environmentId) ?? simulationEnvironments[0];
    const placement = p.draft.content.adaptive
      ? resolveAdaptiveScene(
          p.draft.content,
          syntheticEnvironmentEvidence(room),
          `studio-preview-${p.draft.content.adaptive.variant}`,
        ).placements[id]
      : null;
    const parent =
      placement?.transform ??
      (e.parentEntityId
        ? previewEntityTransform(p.draft.content, e.parentEntityId, p.environmentId, room)
        : composeTransform(previewReferenceFrame(p.draft.content, a, p.environmentId, room), a.transform));
    const local = composeTransform(inverseTransform(parent), world);
    if (p.draft.content.adaptive) local.position = { x: 0, y: 0, z: 0 };
    p.onEdit({ type: "TRANSFORM", entityId: id, transform: local });
    setFeedback(
      `${e.name}: ${p.draft.content.adaptive ? "orientation / scale" : "transform"} edited. Undo is available.`,
    );
  };
  const chooseCandidate = (c: Candidate, position?: Transform["position"]) => {
    const p = latest.current,
      d = structuredClone(p.draft),
      recipe = d.content.adaptive?.recipes.find((r) => r.entityId === p.selectedId);
    const entity = d.content.entities.find((e) => e.id === p.selectedId);
    if (
      !entity ||
      p.preview !== "EDITOR" ||
      !c.safe ||
      d.content.studio?.layers.find((l) => l.entityId === p.selectedId)?.locked
    )
      return;
    if (!d.content.adaptive) {
      const room = simulationEnvironments.find((r) => r.id === p.environmentId) ?? simulationEnvironments[0];
      const world = previewEntityTransform(d.content, entity.id, p.environmentId, room);
      const target = position ?? {
        x: c.position.x + (c.placementOffset?.x ?? 0),
        y: c.position.y + (c.placementOffset?.y ?? 0),
        z: c.position.z + (c.placementOffset?.z ?? 0),
      };
      const placed = surfacePointIsClear(
        target,
        syntheticEnvironmentEvidence(room).candidates,
        entity.widthMeters * world.scale,
      )
        ? placeOnSurface({ ...world, position: target }, c, entity.widthMeters)
        : null;
      if (!placed) {
        setFeedback("This object does not fit here. Choose a larger clear part of the surface.");
        return;
      }
      p.onEdit({ type: "REPLACE", draft: snapSpatialEntity(p.draft, entity.id, placed, c, p.environmentId) });
      setFeedback(
        `${entity.name}: snapped and aligned to ${c.id.replaceAll("-", " ")}. Manual placement · Undo is available.`,
      );
      return;
    }
    if (!recipe || recipe.forbiddenSurfaces.includes(c.surface)) {
      setFeedback("This surface is excluded by the object's placement constraints.");
      return;
    }
    recipe.orientation = "SURFACE";
    entity.transform.rotation = identityTransform().rotation;
    recipe.minimumHeightMeters = c.surface === "FLOOR" ? 0 : 0.4;
    recipe.maximumHeightMeters = c.surface === "FLOOR" ? 0.3 : 1.8;
    recipe.preferredHeightMeters = Math.max(
      recipe.minimumHeightMeters,
      Math.min(recipe.maximumHeightMeters, c.position.y),
    );
    recipe.preferredSurfaces = [c.surface];
    recipe.preferredContext = c.context.filter((x) => !["WALKWAY", "STAIRS", "OBSTACLE", "PRIVATE_REGION"].includes(x));
    recipe.searchRegion = c.region;
    d.content.adaptive!.calibration.maturity = "SEMANTIC";
    delete d.content.adaptive!.calibration.reviewReceiptId;
    if (d.content.placementPolicy === "CALIBRATED") d.content.placementPolicy = "ADAPTIVE_STICKY";
    p.onEdit({ type: "REPLACE", draft: d });
    setFeedback(
      `Semantic intent changed to ${c.surface.toLowerCase()} near ${recipe.preferredContext.join(", ").toLowerCase() || "open space"}. Safety constraints still apply.`,
    );
  };
  const callbacks = useRef({ commitWorld, chooseCandidate });
  useEffect(() => {
    callbacks.current = { commitWorld, chooseCandidate };
  });
  useEffect(() => {
    if (fallback || !host.current) return;
    if (typeof WebGL2RenderingContext === "undefined") {
      queueMicrotask(() => setRendererState("UNAVAILABLE"));
      return;
    }
    let cancelled = false;
    void import("./spatial-workstation").then(({ createWorkstation }) => {
      if (cancelled || !host.current) return;
      try {
        engine.current = createWorkstation(host.current, {
          select: (id) => latest.current.onSelect(id),
          transform: (id, pose) => callbacks.current.commitWorld(id, pose),
          candidate: (c, point) => callbacks.current.chooseCandidate(c, point),
          failure: () => setRendererState("UNAVAILABLE"),
        });
        setRendererState("READY");
      } catch {
        setRendererState("UNAVAILABLE");
      }
    });
    return () => {
      cancelled = true;
      engine.current?.dispose();
      engine.current = null;
    };
  }, [fallback]);
  useEffect(() => {
    engine.current?.update({
      theme,
      objects: draft.content.entities.map((entity) => ({
        entity,
        world: resolvedWorld(entity.id),
        visible: states[entity.id].visible,
        highlighted: states[entity.id].highlighted || (props.highlightedEntityIds?.includes(entity.id) ?? false),
        selectable: states[entity.id].selectable,
        locked: draft.content.studio?.layers.find((l) => l.entityId === entity.id)?.locked ?? false,
      })),
      candidates: evidence.candidates,
      selected: selectedId,
      environment,
      tool,
      space,
      snap,
      overlays: overlays || (Boolean(adaptive) && tool === "translate"),
      adaptive: Boolean(adaptive),
      editable: preview === "EDITOR",
      inspection: mode === "ENGINEERING",
    });
  });
  const selected = draft.content.entities.find((e) => e.id === selectedId);
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
      <div className={styles.viewportBadge}>
        <span className={styles.liveDot} /> {environment.name} <span>SYNTHETIC / {preview.replaceAll("_", " ")}</span>
      </div>
      <div className={styles.viewportTools} role="toolbar" aria-label="Spatial editing tools">
        {(
          [
            ["select", "↖", "Select"],
            ["translate", "✥", "Move"],
            ["rotate", "⟳", "Rotate"],
            ["scale", "⤢", "Scale"],
          ] as const
        ).map(([value, icon, label]) => (
          <button
            key={value}
            aria-label={`${label} tool`}
            title={`${label}${value === "translate" && adaptive ? " · choose a safe semantic surface" : ""}`}
            aria-pressed={tool === value}
            onClick={() => setTool(value)}
          >
            <span aria-hidden="true">{icon}</span>
            <small>{label}</small>
          </button>
        ))}
        <button
          aria-label="Toggle snapping"
          title="Snap movement to the grid and align to nearby surfaces"
          aria-pressed={snap}
          onClick={() => setSnap(!snap)}
        >
          ⌗<small>Snap</small>
        </button>
        <button aria-label="Toggle spatial overlays" aria-pressed={overlays} onClick={() => setOverlays(!overlays)}>
          ◈<small>Surfaces</small>
        </button>
      </div>
      {overlays && !fallback && (
        <details className={styles.surfacePicker} open>
          <summary>
            Room surfaces ·{" "}
            {evidence.candidates.filter((c) => c.surface !== "OPEN_SPACE" && c.id !== "unsafe-walkway").length}
          </summary>
          <small>
            {adaptive
              ? "Automatic placement: choose a surface preference; the room resolver finds a safe position."
              : "Manual placement: select an object, then a surface to snap and align it."}
          </small>
          <div>
            {evidence.candidates
              .filter((c) => c.surface !== "OPEN_SPACE" && c.id !== "unsafe-walkway")
              .map((c) => (
                <button
                  key={c.id}
                  disabled={
                    !selected ||
                    !c.safe ||
                    preview !== "EDITOR" ||
                    draft.content.studio?.layers.find((l) => l.entityId === selectedId)?.locked
                  }
                  onClick={() => chooseCandidate(c)}
                  title={`${c.widthMeters.toFixed(2)} × ${c.depthMeters.toFixed(2)} m${c.safe ? "" : " · obstructed"}`}
                >
                  {c.surface === "FLOOR" ? "Entire floor" : c.id.replaceAll("-", " ")}
                  {c.safe ? "" : " · blocked"}
                </button>
              ))}
          </div>
        </details>
      )}
      <div className={styles.viewInstrument}>
        <select
          aria-label="Camera perspective"
          value={view}
          onChange={(e) => {
            setView(e.target.value);
            engine.current?.view(e.target.value);
          }}
        >
          <option value="perspective">Perspective</option>
          <option value="plan">Plan / orthographic</option>
          <option value="front">Front elevation</option>
        </select>
        <button onClick={() => engine.current?.view("selection")} title="Frame selected object">
          Frame selection
        </button>
        <button
          onClick={() => {
            setView("perspective");
            engine.current?.view();
          }}
        >
          Reset view
        </button>
        {mode !== "GUIDED" && (
          <select
            aria-label="Gizmo coordinate space"
            value={space}
            onChange={(e) => setSpace(e.target.value as typeof space)}
          >
            <option value="world">World coordinates</option>
            <option value="local">Local coordinates</option>
          </select>
        )}
      </div>
      {fallback ? (
        <div className={styles.guidedPreview}>
          <p className={styles.eyebrow}>GUIDED / CAMERA FREE</p>
          <h2>{draft.content.title}</h2>
          <p>{draft.content.fallback.narrative}</p>
          {draft.content.entities
            .filter((e) => draft.content.studio?.layers.find((l) => l.entityId === e.id)?.audience !== "EDITOR_ONLY")
            .map((e) => (
              <article key={e.id}>
                <button onClick={() => onSelect(e.id)}>{e.name}</button>
                <p>{e.content}</p>
                <small>{e.alternativeText}</small>
              </article>
            ))}
          <p>Seated · keyboard · sound off · reduced motion</p>
        </div>
      ) : (
        <>
          <div ref={host} className={styles.viewport} data-renderer={rendererState} />
          {rendererState !== "READY" && (
            <div className={styles.rendererNotice}>
              {rendererState === "UNAVAILABLE"
                ? "3D rendering unavailable. Use the scene hierarchy and precise inspector controls, or open Guided View."
                : "Preparing the synthetic 3D environment…"}
            </div>
          )}
          <div className={styles.selectionInstrument}>
            <span>{selected ? "SELECTED OBJECT" : "SCENE"}</span>
            <strong>{selected?.name ?? draft.content.title}</strong>
            {selected && props.onInspect && <button onClick={props.onInspect}>Edit selected object</button>}
            <small>{adaptive ? adaptive.quality.replaceAll("_", " ") : "Fixed authored placement"}</small>
            {mode === "ENGINEERING" && selected && (
              <code>
                {Object.values(resolvedWorld(selected.id).position)
                  .map((v) => v.toFixed(2))
                  .join(" / ")}{" "}
                m
              </code>
            )}
          </div>
          {preview === "CREW" && (
            <div className={styles.crewNotice}>
              Second viewpoint is camera navigation in this synthetic scene. No cross-device alignment is established.
            </div>
          )}
        </>
      )}
      <div className={styles.viewportFooter}>
        <span>◉ Synthetic geometry · physical qualification pending</span>
        <span>
          {draft.content.entities.length} objects / {evidence.candidates.filter((c) => c.safe).length} safe candidates
        </span>
      </div>
      <p className={styles.canvasHint}>
        {adaptive && tool === "translate"
          ? "Automatic placement · choose a highlighted surface preference. The resolver chooses a safe position and orientation."
          : "Manual placement · Drag empty space to orbit · Shift-drag to pan · Scroll to zoom · Choose a gizmo to edit."}{" "}
        <span>{feedback}</span>
      </p>
      <div className={styles.keyboardObjects} aria-label="Keyboard spatial selection">
        {draft.content.entities.map((e) => (
          <button
            key={e.id}
            aria-label={`${e.name}. ${e.alternativeText}`}
            aria-pressed={selectedId === e.id}
            onClick={() => onSelect(e.id)}
            onKeyDown={(event) => {
              if (
                !event.key.startsWith("Arrow") ||
                draft.content.adaptive ||
                draft.content.studio?.layers.find((l) => l.entityId === e.id)?.locked
              )
                return;
              event.preventDefault();
              const pose = resolvedWorld(e.id);
              pose.position.x += event.key === "ArrowLeft" ? -0.05 : event.key === "ArrowRight" ? 0.05 : 0;
              pose.position.y += event.key === "ArrowUp" ? 0.05 : event.key === "ArrowDown" ? -0.05 : 0;
              commitWorld(e.id, pose);
            }}
          >
            {e.name}
          </button>
        ))}
      </div>
    </section>
  );
}

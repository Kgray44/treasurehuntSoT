"use client";
import { useEffect, useRef, useState } from "react";
import { previewEntityTransform, referenceSurfaceFrame, type SpatialDraft, type Edit } from "@/parallax/authoring";
import { composeTransform, inverseTransform } from "@/parallax/transforms";
import type { Transform } from "@/parallax/contracts";
import { evaluateSpatialBehavior, type SpatialInput } from "@/parallax/behavior";
import { simulationEnvironments } from "@/parallax/studio-validation";
import { resolveAdaptiveScene, type Candidate } from "@/parallax/adaptive";
import { syntheticEnvironmentEvidence } from "@/parallax/adaptive-authoring";
import type { createWorkstation, ViewportState } from "./spatial-workstation";
import { elementEnvelope } from "@/parallax/element-contracts";
import { useMotionMode } from "@/animation/motion/useMotionMode";
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
  playing?: boolean;
}) {
  const { draft, selectedId, onSelect, onPreset, mode, preview, environmentId, timeMs, inputs } = props;
  const host = useRef<HTMLDivElement>(null),
    engine = useRef<ReturnType<typeof createWorkstation> | null>(null);
  const latest = useRef(props);
  const motion = useMotionMode();
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [quality, setQuality] = useState<"LOW" | "MEDIUM" | "HIGH">("MEDIUM");
  const [viewControlsOpen, setViewControlsOpen] = useState(true);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 700px)");
    const sync = () => setViewControlsOpen(!query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
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
        : previewEntityTransform(draft.content, id);
  };
  const states = evaluateSpatialBehavior(draft.content, inputs, timeMs, preview === "EDITOR");
  const envelope = (id: string): number => {
    const entity = draft.content.entities.find((e) => e.id === id)!;
    return (
      (states[id].visible ? 1 : 0) *
      (entity.element ? elementEnvelope(entity.element, timeMs, preview === "EDITOR") : 1) *
      (entity.parentEntityId ? envelope(entity.parentEntityId) : 1)
    );
  };
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
        ? previewEntityTransform(p.draft.content, e.parentEntityId)
        : composeTransform(referenceSurfaceFrame(a, Boolean(e.element)), a.transform));
    const local = composeTransform(inverseTransform(parent), world);
    if (p.draft.content.adaptive) local.position = { x: 0, y: 0, z: 0 };
    p.onEdit({ type: "TRANSFORM", entityId: id, transform: local });
    setFeedback(
      `${e.name}: ${p.draft.content.adaptive ? "orientation / scale" : "transform"} edited. Undo is available.`,
    );
  };
  const chooseCandidate = (c: Candidate) => {
    const p = latest.current,
      d = structuredClone(p.draft),
      recipe = d.content.adaptive?.recipes.find((r) => r.entityId === p.selectedId);
    if (!recipe || !c.safe || d.content.studio?.layers.find((l) => l.entityId === p.selectedId)?.locked) return;
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
          candidate: (c) => callbacks.current.chooseCandidate(c),
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
      setAudioEnabled(false);
    };
  }, [fallback]);
  useEffect(() => {
    engine.current?.update({
      theme,
      objects: draft.content.entities.map((entity) => ({
        entity,
        world: resolvedWorld(entity.id),
        visible: envelope(entity.id) > 0,
        envelope: envelope(entity.id),
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
      timeMs,
      audio: audioEnabled && Boolean(props.playing) && preview !== "EDITOR",
      reducedMotion: motion.mode === "reduced",
      quality,
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
        <button aria-label="Toggle snapping" aria-pressed={snap} onClick={() => setSnap(!snap)}>
          ⌗<small>Snap</small>
        </button>
        <button aria-label="Toggle spatial overlays" aria-pressed={overlays} onClick={() => setOverlays(!overlays)}>
          ◈<small>Surfaces</small>
        </button>
      </div>
      <details
        className={styles.viewInstrument}
        open={viewControlsOpen}
        onToggle={(event) => setViewControlsOpen(event.currentTarget.open)}
      >
        <summary>View &amp; audio controls</summary>
        <div className={styles.viewControlBody}>
          <select
            aria-label="Renderer quality"
            value={quality}
            onChange={(e) => setQuality(e.target.value as typeof quality)}
          >
            <option value="LOW">Low quality</option>
            <option value="MEDIUM">Medium quality</option>
            <option value="HIGH">High quality</option>
          </select>
          <button
            aria-pressed={audioEnabled}
            aria-describedby="parallax-canvas-feedback"
            onClick={async () => {
              if (audioEnabled) {
                setAudioEnabled(false);
                engine.current?.stopAudio();
                setFeedback("Preview audio muted. Authored meaning remains available as text.");
                return;
              }
              try {
                const current = engine.current;
                if (!current) throw new Error("Audio preview has no active renderer");
                await current.enableAudio();
                setAudioEnabled(true);
                setFeedback("Preview audio enabled. Play the timeline to hear authored ambience.");
              } catch {
                setFeedback("Preview audio is unavailable. All authored meaning remains available as text.");
              }
            }}
          >
            {audioEnabled ? "Mute preview audio" : "Enable preview audio"}
          </button>
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
          <button onClick={() => engine.current?.view("scene")}>Frame scene</button>
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
      </details>
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
            <small className={adaptive ? undefined : styles.fixedPlacementCaption}>
              {adaptive ? adaptive.quality.replaceAll("_", " ") : "Fixed authored placement"}
            </small>
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
        <span className={adaptive && tool === "translate" ? undefined : styles.pointerHint}>
          {adaptive && tool === "translate"
            ? "Choose a highlighted safe surface to edit semantic intent. Exact positions remain resolver-owned."
            : "Drag empty space to orbit · Shift-drag to pan · Scroll to zoom · Choose a gizmo to edit."}{" "}
        </span>
        <span id="parallax-canvas-feedback" aria-live="polite" aria-atomic="true">
          {feedback}
        </span>
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

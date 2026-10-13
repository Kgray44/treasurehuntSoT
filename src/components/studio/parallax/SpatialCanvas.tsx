"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { authoredPreviewEnvironment } from "@/parallax/environment-authoring";
import {
  previewEntityTransform,
  previewEntityTransforms,
  previewReferenceFrame,
  type SpatialDraft,
  type Edit,
} from "@/parallax/authoring";
import { composeTransform, inverseTransform } from "@/parallax/transforms";
import { identityTransform, type Transform } from "@/parallax/contracts";
import { findSurfacePlacement, snapSpatialEntity, surfacePointIsClear } from "@/parallax/surface-placement";
import { evaluateSpatialScene, type SpatialInput } from "@/parallax/behavior";
import { simulationEnvironments } from "@/parallax/studio-validation";
import { resolveAdaptiveScene, type Candidate } from "@/parallax/adaptive";
import { syntheticEnvironmentEvidence } from "@/parallax/adaptive-authoring";
import type { createWorkstation, ViewportState, RendererReceipt, CameraSnapshot } from "./spatial-workstation";
import { StudioIcon, useStudioContextMenu, type StudioMenuAction } from "./StudioContextMenu";
import styles from "./SpatialStudio.module.css";
export function SpatialCanvas(props: {
  draft: SpatialDraft;
  selectedId: string | null;
  highlightedEntityIds?: readonly string[];
  onSelect: (id: string) => void;
  onInspect?: () => void;
  objectActions?: (id: string) => StudioMenuAction[];
  onEdit: (edit: Edit) => void;
  onPreset: (name: string) => void;
  mode: string;
  preview: string;
  environmentId: string;
  timeMs: number;
  inputs: SpatialInput[];
  onPreviewChange?: (preview: string) => void;
  onRendererReceipt?: (receipts: RendererReceipt[], sceneVersion?: string) => void;
}) {
  const { draft, selectedId, onSelect, onPreset, mode, preview, environmentId, timeMs, inputs } = props;
  const contextMenu = useStudioContextMenu();
  const host = useRef<HTMLDivElement>(null),
    engine = useRef<ReturnType<typeof createWorkstation> | null>(null);
  const latest = useRef(props);
  const recoveryCamera = useRef<CameraSnapshot | null>(null);
  useEffect(() => {
    latest.current = props;
  });
  const [rendererState, setRendererState] = useState("LOADING"),
    [tool, setTool] = useState<ViewportState["tool"]>("select");
  const [rendererAttempt, setRendererAttempt] = useState(0);
  const [receipts, setReceipts] = useState<RendererReceipt[]>([]);
  const [surfaceClamp, setSurfaceClamp] = useState(true);
  const [isolateSelected, setIsolateSelected] = useState(false);
  const [editingRevealId, setEditingRevealId] = useState<string | null>(null);
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
  const environmentDescription = JSON.stringify(
    authoredPreviewEnvironment(
      draft.content,
      simulationEnvironments.find((e) => e.id === environmentId) ?? {
        ...simulationEnvironments[0],
        id: environmentId,
      },
    ),
  );
  const environment = useMemo(
    () => JSON.parse(environmentDescription) as ReturnType<typeof authoredPreviewEnvironment>,
    [environmentDescription],
  );
  const evidence = useMemo(() => syntheticEnvironmentEvidence(environment), [environment]);
  const adaptive = useMemo(
    () =>
      draft.content.adaptive
        ? resolveAdaptiveScene(draft.content, evidence, `studio-preview-${draft.content.adaptive.variant}`)
        : null,
    [draft.content, evidence],
  );
  const fallback =
    ["FALLBACK", "ACCESSIBILITY", "LOW_CAPABILITY"].includes(preview) || adaptive?.status === "GUIDED_FALLBACK";
  const { states } = useMemo(
    () => evaluateSpatialScene(draft.content, inputs, timeMs, preview === "EDITOR"),
    [draft.content, inputs, timeMs, preview],
  );
  const animatedContent = useMemo(
    () => ({
      ...draft.content,
      entities: draft.content.entities.map((entity) => ({
        ...entity,
        transform: states[entity.id].transform,
      })),
    }),
    [draft.content, states],
  );
  const fixedWorlds = useMemo(
    () => previewEntityTransforms(animatedContent, environmentId, environment, evidence.candidates),
    [animatedContent, environmentId, environment, evidence.candidates],
  );
  const resolvedWorld = useCallback(
    function resolve(id: string, content = animatedContent): Transform {
      const e = content.entities.find((e) => e.id === id)!;
      const placement = adaptive?.placements[id];
      return placement
        ? composeTransform(placement.transform, e.transform)
        : e.parentEntityId && adaptive?.status === "RESOLVED"
          ? composeTransform(resolve(e.parentEntityId, content), e.transform)
          : content === animatedContent
            ? fixedWorlds[id]
            : previewEntityTransform(content, id, environmentId, environment);
    },
    [animatedContent, adaptive, fixedWorlds, environmentId, environment],
  );
  const commitWorld = (id: string, world: Transform) => {
    const p = latest.current,
      e = p.draft.content.entities.find((e) => e.id === id)!;
    const a = p.draft.content.anchors.find((a) => a.id === e.anchorId)!;
    const room = authoredPreviewEnvironment(
      p.draft.content,
      simulationEnvironments.find((r) => r.id === p.environmentId) ?? {
        ...simulationEnvironments[0],
        id: p.environmentId,
      },
    );
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
      const room = authoredPreviewEnvironment(
        p.draft.content,
        simulationEnvironments.find((r) => r.id === p.environmentId) ?? {
          ...simulationEnvironments[0],
          id: p.environmentId,
        },
      );
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
        ? findSurfacePlacement({ ...world, position: target }, c, entity.widthMeters, !position)
        : null;
      if (!placed) {
        setFeedback("This object does not fit here. Choose a larger clear part of the surface.");
        return;
      }
      p.onEdit({ type: "REPLACE", draft: snapSpatialEntity(p.draft, entity.id, placed, c, p.environmentId) });
      if (window.matchMedia("(max-width: 700px), (max-height: 520px)").matches) setOverlays(false);
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
    if (window.matchMedia("(max-width: 700px), (max-height: 520px)").matches) setOverlays(false);
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
    queueMicrotask(() => {
      if (!cancelled) setRendererState("LOADING");
    });
    void import("./spatial-workstation")
      .then(({ createWorkstation }) => {
        if (cancelled || !host.current) return;
        try {
          engine.current = createWorkstation(host.current, {
            select: (id) => latest.current.onSelect(id),
            transform: (id, pose) => callbacks.current.commitWorld(id, pose),
            candidate: (c, point) => callbacks.current.chooseCandidate(c, point),
            failure: () => {
              recoveryCamera.current = engine.current?.cameraSnapshot() ?? null;
              setRendererState("UNAVAILABLE");
              latest.current.onRendererReceipt?.([]);
            },
            rendered: (next, sceneVersion) => {
              setReceipts(next);
              latest.current.onRendererReceipt?.(next, sceneVersion);
            },
          });
          setRendererState("READY");
        } catch {
          setRendererState("UNAVAILABLE");
        }
      })
      .catch(() => {
        if (!cancelled) setRendererState("UNAVAILABLE");
      });
    return () => {
      cancelled = true;
      engine.current?.dispose();
      engine.current = null;
      latest.current.onRendererReceipt?.([]);
    };
  }, [fallback, rendererAttempt]);
  const sceneVersion = useMemo(() => JSON.stringify(draft), [draft]);
  const viewportState = useMemo<ViewportState>(
    () => ({
      sceneVersion,
      theme,
      objects: draft.content.entities.map((entity) => ({
        entity,
        world: resolvedWorld(entity.id),
        visible:
          preview === "EDITOR" && entity.id === selectedId && editingRevealId === entity.id
            ? true
            : states[entity.id].visible,
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
      surfaceClamp,
      isolateSelected,
      hideEnvironment: Boolean(draft.content.studio?.libraryDefinition),
      overlays: overlays || (Boolean(adaptive) && tool === "translate"),
      adaptive: Boolean(adaptive),
      editable: preview === "EDITOR",
      inspection: mode === "ENGINEERING",
    }),
    [
      sceneVersion,
      theme,
      draft.content,
      resolvedWorld,
      states,
      props.highlightedEntityIds,
      evidence.candidates,
      selectedId,
      environment,
      tool,
      space,
      snap,
      surfaceClamp,
      isolateSelected,
      overlays,
      adaptive,
      preview,
      mode,
      editingRevealId,
    ],
  );
  useEffect(() => {
    if (rendererState !== "READY") return;
    engine.current?.update(viewportState);
    if (engine.current && recoveryCamera.current) {
      engine.current.restoreCamera(recoveryCamera.current);
      recoveryCamera.current = null;
    }
  }, [rendererState, viewportState]);
  const libraryPreview = Boolean(draft.content.studio?.libraryDefinition);
  const previousLibraryPreview = useRef(false);
  useEffect(() => {
    if (rendererState !== "READY") return;
    if (libraryPreview) engine.current?.view("selection");
    else if (previousLibraryPreview.current) engine.current?.view("perspective");
    previousLibraryPreview.current = libraryPreview;
  }, [rendererState, draft.content.definitionId, libraryPreview]);
  const selected = draft.content.entities.find((e) => e.id === selectedId);
  const selectedReceipt = receipts.find((r) => r.id === selectedId);
  const viewportActions: StudioMenuAction[] = [
    {
      label: "Reset view",
      icon: "reset",
      run: () => {
        setView("perspective");
        engine.current?.view();
      },
    },
    {
      label: "Frame selection",
      icon: "frame",
      disabled: !selectedId,
      run: () => engine.current?.view("selection"),
    },
    {
      label: overlays ? "Hide surfaces" : "Show surfaces",
      icon: "surface",
      run: () => setOverlays(!overlays),
    },
    {
      label: "Perspective view",
      icon: "frame",
      run: () => {
        setView("perspective");
        engine.current?.view("perspective");
      },
    },
    {
      label: "Plan view",
      icon: "inspect",
      run: () => {
        setView("plan");
        engine.current?.view("plan");
      },
    },
    {
      label: "Front view",
      icon: "inspect",
      run: () => {
        setView("front");
        engine.current?.view("front");
      },
    },
  ];
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
        <span className={styles.liveDot} /> <span>Preview: {environment.name}</span>{" "}
        <span>SYNTHETIC / {preview.replaceAll("_", " ")}</span>
      </div>
      <div className={styles.viewportControlStack}>
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
          <button
            aria-label="Frame selection"
            onClick={() => engine.current?.view("selection")}
            title="Frame selected object"
          >
            <StudioIcon name="frame" />
          </button>
          {selected && draft.content.studio?.animationTracks?.length && (
            <button
              onClick={() => {
                const times = new Set([
                  0,
                  ...(draft.content.studio?.animationTracks ?? [])
                    .filter((t) => t.enabled)
                    .flatMap((t) => t.keyframes.map((f) => f.atMs)),
                ]);
                const poses = [...times].map((time) => {
                  const sampled = evaluateSpatialScene(draft.content, inputs, time).states;
                  return resolvedWorld(selected.id, {
                    ...draft.content,
                    entities: draft.content.entities.map((e) => ({ ...e, transform: sampled[e.id].transform })),
                  });
                });
                engine.current?.view("sequence", poses);
              }}
            >
              Frame animation
            </button>
          )}
          <button
            aria-label="Reset view"
            title="Reset view"
            onClick={() => {
              setView("perspective");
              engine.current?.view();
            }}
          >
            <StudioIcon name="reset" />
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
        <div className={styles.viewportTools} role="toolbar" aria-label="Spatial editing tools">
          {(
            [
              ["select", "↖", "Select"],
              ["translate", "✥", "Move"],
              ["rotate", "⟳", "Rotate"],
              ["scale", "⤢", "Scale"],
            ] as const
          ).map(([value, , label]) => (
            <button
              key={value}
              aria-label={`${label} tool`}
              title={`${label}${value === "translate" && adaptive ? " · choose a safe semantic surface" : ""}`}
              aria-pressed={tool === value}
              onClick={() => setTool(value)}
            >
              <StudioIcon
                name={
                  value === "select"
                    ? "frame"
                    : value === "translate"
                      ? "move"
                      : value === "rotate"
                        ? "rotate"
                        : "scale"
                }
              />
              <small>{label}</small>
            </button>
          ))}
          <button
            aria-label="Toggle snapping"
            title="Snap movement, rotation and scale to regular increments"
            aria-pressed={snap}
            onClick={() => setSnap(!snap)}
          >
            ⌗<small>Grid</small>
          </button>
          <button
            aria-label="Auto surface clamping"
            aria-pressed={surfaceClamp}
            title="Align moved objects to nearby clear surfaces. Turn off for free positioning."
            onClick={() => setSurfaceClamp(!surfaceClamp)}
          >
            ⊞<small>Clamp</small>
          </button>
          <button aria-label="Toggle spatial overlays" aria-pressed={overlays} onClick={() => setOverlays(!overlays)}>
            ◈<small>Surfaces</small>
          </button>
        </div>
      </div>
      {overlays && !fallback && (
        <details className={styles.surfacePicker} open>
          <summary>
            Room surfaces ·{" "}
            {evidence.candidates.filter((c) => c.surface !== "OPEN_SPACE" && c.id !== "unsafe-walkway").length}
          </summary>
          <button
            className={styles.surfacePickerClose}
            onClick={() => setOverlays(false)}
            aria-label="Close room surfaces"
          >
            ×
          </button>
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
      {fallback ? (
        <div className={styles.guidedPreview}>
          <p className={styles.eyebrow}>GUIDED / CAMERA FREE</p>
          {adaptive?.status === "GUIDED_FALLBACK" && (
            <p role="status">
              No safe automatic placement was resolved in this room. The scene remains editable; change the environment
              or placement constraints to restore 3D preview.
            </p>
          )}
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
          <div
            ref={host}
            className={styles.viewport}
            data-renderer={rendererState}
            onKeyDown={(event) => {
              if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10"))
                contextMenu.open(
                  event,
                  selected?.name ?? "Viewport",
                  selected ? (props.objectActions?.(selected.id) ?? viewportActions) : viewportActions,
                );
            }}
            onContextMenu={(event) => {
              const id = engine.current?.pickEntity(event.clientX, event.clientY);
              if (id) {
                onSelect(id);
                contextMenu.open(
                  event,
                  draft.content.entities.find((entity) => entity.id === id)!.name,
                  props.objectActions?.(id) ?? [],
                );
              } else contextMenu.open(event, "Viewport", viewportActions);
            }}
          />
          {rendererState !== "READY" && (
            <div className={styles.rendererNotice}>
              {rendererState === "UNAVAILABLE"
                ? "3D rendering unavailable. Use the scene hierarchy and precise inspector controls, or open Guided View."
                : "Preparing the synthetic 3D environment…"}
              {rendererState === "UNAVAILABLE" && (
                <button onClick={() => setRendererAttempt((attempt) => attempt + 1)}>Retry 3D renderer</button>
              )}
            </div>
          )}
          <div className={styles.selectionInstrument}>
            <span>{selected ? "SELECTED OBJECT" : "SCENE"}</span>
            <strong>{selected?.name ?? draft.content.title}</strong>
            {selectedReceipt && (
              <small aria-live="polite">{selectedReceipt.status.replaceAll("_", " ").toLowerCase()}</small>
            )}
            {selected && (
              <button aria-pressed={isolateSelected} onClick={() => setIsolateSelected(!isolateSelected)}>
                {isolateSelected ? "Show room" : "Isolate selected object"}
              </button>
            )}
            {selected &&
              selectedReceipt &&
              ["HIDDEN", "OUTSIDE_VIEW", "OCCLUDED", "TOO_SMALL"].includes(selectedReceipt.status) && (
                <button
                  title="Show this object alone at a readable distance for editing. Saved visibility and runtime behavior stay unchanged."
                  onClick={() => {
                    props.onPreviewChange?.("EDITOR");
                    setEditingRevealId(selected.id);
                    setIsolateSelected(true);
                    requestAnimationFrame(() => engine.current?.view("selection"));
                  }}
                >
                  {selectedReceipt.status === "HIDDEN" ? "Reveal in editor" : "Find object"}
                </button>
              )}
            {selected && selected.id === editingRevealId && preview === "EDITOR" && (
              <button
                title="Return to the saved visibility and full room without changing the scene."
                onClick={() => {
                  setEditingRevealId(null);
                  setIsolateSelected(false);
                }}
              >
                Use authored visibility
              </button>
            )}
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
        <span>◉ Synthetic geometry · cutaway view · physical qualification pending</span>
        <span>
          {draft.content.entities.length} objects / {evidence.candidates.filter((c) => c.safe).length} safe candidates
        </span>
      </div>
      <div className={styles.canvasHint}>
        <strong>{adaptive ? "Auto placement" : "Manual placement"}</strong>
        <span>{feedback}</span>
        <details className={styles.navigationHelp}>
          <summary>Navigation help</summary>
          <p>
            {adaptive && tool === "translate"
              ? "Choose a highlighted surface preference. The resolver chooses a safe position and orientation."
              : "Drag to orbit · Ctrl-drag or middle-drag to pan · Scroll to zoom. Choose a gizmo to edit or right-click for object commands. Keyboard: focus an object and press Shift+F10 for its menu."}
          </p>
        </details>
      </div>
      <div className={styles.keyboardObjects} aria-label="Keyboard spatial selection">
        {draft.content.entities.map((e) => (
          <button
            key={e.id}
            aria-label={`${e.name}. ${e.alternativeText}`}
            aria-pressed={selectedId === e.id}
            onClick={() => onSelect(e.id)}
            onContextMenu={(event) => {
              onSelect(e.id);
              contextMenu.open(event, e.name, props.objectActions?.(e.id) ?? []);
            }}
            onKeyDown={(event) => {
              if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
                onSelect(e.id);
                contextMenu.open(event, e.name, props.objectActions?.(e.id) ?? []);
                return;
              }
              if (
                !event.key.startsWith("Arrow") ||
                preview !== "EDITOR" ||
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
      {contextMenu.menu}
    </section>
  );
}

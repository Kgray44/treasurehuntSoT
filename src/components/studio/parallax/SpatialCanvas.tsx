"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { authoredPreviewEnvironment } from "@/parallax/environment-authoring";
import type { LegacyPreviewEnvironment } from "@/parallax/legacy-environment-preview";
import {
  previewEntityTransform,
  previewEntityTransforms,
  previewReferenceFrame,
  elementUsesUprightFrame,
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
import type {
  createWorkstation,
  ViewportState,
  RendererReceipt,
  CameraSnapshot,
  DragPlacementPreview,
} from "./spatial-workstation";
import { StudioIcon, useStudioContextMenu, type StudioMenuAction } from "./StudioContextMenu";
import { transformRoomFeature } from "@/parallax/room-feature-transform";
import { editingSelectionEffects } from "@/parallax/editing-groups";
import { placeGroupOnSurface } from "@/parallax/group-surface-placement";
import type { EditingGroupMember } from "@/parallax/editing-group-contracts";
import { selectionModifiers, type SelectionModifiers } from "./SceneGroups";
import { elementEnvelope } from "@/parallax/element-contracts";
import { useMotionMode } from "@/animation/motion/useMotionMode";
import styles from "./SpatialStudio.module.css";
export function SpatialCanvas(props: {
  draft: SpatialDraft;
  selectedId: string | null;
  highlightedEntityIds?: readonly string[];
  onSelect: (id: string, modifiers?: SelectionModifiers) => void;
  selectionMembers?: readonly EditingGroupMember[];
  selectionLabel?: string;
  selectionActions?: () => StudioMenuAction[];
  featureActions?: (id: string) => StudioMenuAction[];
  onTransformSelection?: (delta: Transform, pivot?: Transform["position"]) => void;
  environmentEditing?: boolean;
  environmentOnly?: boolean;
  onToggleEnvironmentEditing?: () => void;
  selectedFeatureId?: string | null;
  onSelectFeature?: (id: string, modifiers?: SelectionModifiers) => void;
  onInspect?: () => void;
  objectActions?: (id: string) => StudioMenuAction[];
  onEdit: (edit: Edit) => void;
  onPreset: (name: string) => void;
  mode: string;
  preview: string;
  environmentId: string;
  environmentOverride?: LegacyPreviewEnvironment;
  timeMs: number;
  playing?: boolean;
  previewOnly?: boolean;
  motionOptions?: import("@/parallax/behavior").SpatialMotionOptions;
  inputs: SpatialInput[];
  onPreviewChange?: (preview: string) => void;
  onRendererReceipt?: (receipts: RendererReceipt[], sceneVersion?: string) => void;
  command?: { sequence: number; kind: "FRAME" | "TOOL"; tool?: "translate" | "rotate" | "scale" } | null;
}) {
  const { draft, selectedId, onSelect, onPreset, mode, preview, environmentId, timeMs, inputs } = props;
  const contextMenu = useStudioContextMenu();
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
  const [rendererGeneration, setRendererGeneration] = useState(0);
  const [receipts, setReceipts] = useState<RendererReceipt[]>([]);
  const [surfaceClamp, setSurfaceClamp] = useState(true);
  const [dragPlacement, setDragPlacement] = useState<DragPlacementPreview | null>(null);
  const [isolateSelected, setIsolateSelected] = useState(false);
  const [editingRevealId, setEditingRevealId] = useState<string | null>(null);
  const [space, setSpace] = useState<"world" | "local">("world"),
    [snap, setSnap] = useState(true),
    [overlays, setOverlays] = useState(false);
  const [view, setView] = useState("perspective"),
    [feedback, setFeedback] = useState(
      props.environmentOnly ? "Select a room feature to move, rotate or scale." : "Select an object to begin.",
    );
  useEffect(() => {
    if (props.command?.kind === "FRAME" && rendererState === "READY") engine.current?.view("selection");
    if (props.command?.kind === "TOOL" && props.command.tool) {
      const requestedTool = props.command.tool;
      const frame = requestAnimationFrame(() => setTool(requestedTool));
      return () => cancelAnimationFrame(frame);
    }
  }, [props.command, rendererState]);
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
    props.environmentOverride ??
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
    () => evaluateSpatialScene(draft.content, inputs, timeMs, preview === "EDITOR", props.motionOptions),
    [draft.content, inputs, timeMs, preview, props.motionOptions],
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
    const room =
      p.environmentOverride ??
      authoredPreviewEnvironment(
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
        : composeTransform(
            previewReferenceFrame(
              p.draft.content,
              a,
              p.environmentId,
              room,
              undefined,
              elementUsesUprightFrame(p.draft.content, e.id),
            ),
            a.transform,
          ));
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
    if (p.selectionMembers?.length && p.preview === "EDITOR") {
      try {
        p.onEdit({
          type: "REPLACE",
          draft: placeGroupOnSurface(p.draft, p.selectionMembers, c, position ?? c.position, p.environmentId),
        });
        setFeedback(`${p.selectionLabel ?? "Selection"}: all items moved together. Undo is available.`);
      } catch (cause) {
        setFeedback(cause instanceof Error ? cause.message : "The group could not be placed; no items were moved.");
      }
      return;
    }
    const entity = d.content.entities.find((e) => e.id === p.selectedId);
    if (
      !entity ||
      p.preview !== "EDITOR" ||
      !c.safe ||
      d.content.studio?.layers.find((l) => l.entityId === p.selectedId)?.locked
    )
      return;
    if (!d.content.adaptive) {
      const room =
        p.environmentOverride ??
        authoredPreviewEnvironment(
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
            select: (id, modifiers) => latest.current.onSelect(id, modifiers),
            selectFeature: (id, modifiers) => latest.current.onSelectFeature?.(id, modifiers),
            transformSelection: (delta, pivot) => {
              try {
                latest.current.onTransformSelection?.(delta, pivot);
                setFeedback("Selection transformed together. Undo is available.");
              } catch {
                setFeedback("This group transform could not be applied. Its items have been restored.");
                queueMicrotask(() => engine.current?.update(viewportStateRef.current));
              }
            },
            transformFeature: (id, pose) => {
              const p = latest.current;
              if (!p.environmentEditing || p.preview !== "EDITOR" || !p.draft.content.studio?.environment) return;
              try {
                const next = structuredClone(p.draft);
                next.content.studio!.environment = transformRoomFeature(p.draft.content.studio.environment, id, pose);
                p.onEdit({ type: "REPLACE", draft: next });
                setFeedback(
                  "Room feature transformed. Attached features follow. Undo is available; review Construction checks.",
                );
              } catch {
                setFeedback("This transform exceeds room editing limits. The feature has been restored.");
                queueMicrotask(() => engine.current?.update(viewportStateRef.current));
              }
            },
            transform: (id, pose) => callbacks.current.commitWorld(id, pose),
            candidate: (c, point) => callbacks.current.chooseCandidate(c, point),
            placementPreview: setDragPlacement,
            failure: () => {
              setDragPlacement(null);
              recoveryCamera.current = engine.current?.cameraSnapshot() ?? null;
              setRendererState("UNAVAILABLE");
              latest.current.onRendererReceipt?.([]);
            },
            rendered: (next, sceneVersion) => {
              setReceipts(next);
              latest.current.onRendererReceipt?.(next, sceneVersion);
            },
          });
          // React may batch LOADING/READY back to the previous READY value.
          // Every new renderer must still receive the current scene projection.
          setRendererGeneration((generation) => generation + 1);
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
      engine.current?.stopAudio();
      setAudioEnabled(false);
      engine.current?.dispose();
      engine.current = null;
      latest.current.onRendererReceipt?.([]);
    };
  }, [fallback, rendererAttempt]);
  const sceneVersion = useMemo(() => JSON.stringify(draft), [draft]);
  const editingSelection = useMemo(
    () =>
      props.selectionMembers?.length
        ? { members: props.selectionMembers, effects: editingSelectionEffects(draft, props.selectionMembers) }
        : undefined,
    [draft, props.selectionMembers],
  );
  const envelopes = useMemo(() => {
    const byId = new Map(draft.content.entities.map((e) => [e.id, e]));
    const result: Record<string, number> = {};
    const envelope = (id: string): number => {
      if (result[id] !== undefined) return result[id];
      const entity = byId.get(id)!;
      return (result[id] =
        (states[id].visible ? 1 : 0) *
        (entity.element ? elementEnvelope(entity.element, timeMs, preview === "EDITOR") : 1) *
        (entity.parentEntityId ? envelope(entity.parentEntityId) : 1));
    };
    for (const entity of draft.content.entities) envelope(entity.id);
    return result;
  }, [draft.content.entities, states, timeMs, preview]);
  const viewportState = useMemo<ViewportState>(
    () => ({
      sceneVersion,
      theme,
      objects: draft.content.entities.map((entity) => ({
        entity,
        opacity: states[entity.id].opacity,
        envelope: envelopes[entity.id],
        world: resolvedWorld(entity.id),
        visible:
          preview === "EDITOR" && entity.id === selectedId && editingRevealId === entity.id
            ? true
            : states[entity.id].visible && envelopes[entity.id] > 0,
        highlighted:
          states[entity.id].highlighted ||
          (props.highlightedEntityIds?.includes(entity.id) ?? false) ||
          (props.selectionMembers?.some((member) => member.kind === "ASSET" && member.id === entity.id) ?? false),
        selectable: states[entity.id].selectable,
        locked: draft.content.studio?.layers.find((l) => l.entityId === entity.id)?.locked ?? false,
      })),
      candidates: evidence.candidates,
      selected: selectedId,
      editingSelection,
      environmentEditing: Boolean(props.environmentEditing),
      selectedFeature: props.selectedFeatureId ?? null,
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
      timeMs,
      audio: audioEnabled && Boolean(props.playing) && preview !== "EDITOR",
      reducedMotion: motion.mode !== "full",
      quality,
      inspection: mode === "ENGINEERING",
    }),
    [
      sceneVersion,
      theme,
      timeMs,
      audioEnabled,
      props.playing,
      motion.mode,
      quality,
      envelopes,
      draft.content,
      resolvedWorld,
      states,
      props.highlightedEntityIds,
      props.selectionMembers,
      editingSelection,
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
      props.environmentEditing,
      props.selectedFeatureId,
    ],
  );
  const viewportStateRef = useRef(viewportState);
  useEffect(() => {
    viewportStateRef.current = viewportState;
  }, [viewportState]);
  useEffect(() => {
    if (rendererState !== "READY") return;
    engine.current?.update(viewportState);
    if (engine.current && recoveryCamera.current) {
      engine.current.restoreCamera(recoveryCamera.current);
      recoveryCamera.current = null;
    }
  }, [rendererState, viewportState, rendererGeneration]);
  const libraryPreview = Boolean(draft.content.studio?.libraryDefinition);
  const previousLibraryPreview = useRef(false);
  useEffect(() => {
    if (rendererState !== "READY") return;
    if (libraryPreview) engine.current?.view("selection");
    else if (previousLibraryPreview.current) engine.current?.view("perspective");
    previousLibraryPreview.current = libraryPreview;
  }, [rendererState, rendererGeneration, draft.content.definitionId, libraryPreview]);
  const selected = draft.content.entities.find((e) => e.id === selectedId);
  const selectedFeature = props.environmentEditing
    ? environment.features?.find((feature) => feature.id === props.selectedFeatureId)
    : undefined;
  const selectedReceipt = receipts.find((r) => r.id === selectedId);
  const selectedMaterialAlpha = Math.max(...(selectedReceipt?.materialOpacities ?? []));
  const selectedFaint = selectedMaterialAlpha > 0 && selectedMaterialAlpha < 0.2;
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
      disabled: !selectedId && !props.selectionMembers?.length && !selectedFeature,
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
  const featureActions: StudioMenuAction[] = [
    { label: "Move feature", icon: "move", run: () => setTool("translate") },
    { label: "Rotate feature", icon: "rotate", run: () => setTool("rotate") },
    { label: "Scale feature", icon: "scale", run: () => setTool("scale") },
    { label: "Frame selection", icon: "frame", run: () => engine.current?.view("selection") },
    { label: "Inspect feature", icon: "inspect", run: () => props.onInspect?.() },
  ];
  return (
    <section
      className={`${styles.canvas} ${preview === "PHONE" ? styles.phone : ""} ${props.previewOnly ? styles.roomPreviewCanvas : ""}`}
      aria-label="Spatial canvas"
      style={props.previewOnly ? { height: "clamp(260px, 40vh, 360px)", minHeight: 0 } : undefined}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (props.previewOnly) return;
        const name = e.dataTransfer.getData("application/parallax-preset");
        if (name) onPreset(name);
      }}
    >
      {!props.previewOnly && (
        <div className={styles.viewportBadge}>
          <span className={styles.liveDot} /> <span>Preview: {environment.name}</span>{" "}
          <span>SYNTHETIC / {preview.replaceAll("_", " ")}</span>
        </div>
      )}
      <div className={styles.viewportControlStack}>
        <details
          className={styles.viewInstrument}
          open={viewControlsOpen}
          onToggle={(event) => setViewControlsOpen(event.currentTarget.open)}
        >
          <summary>View &amp; audio</summary>
          <div className={styles.viewControlBody}>
            {props.onToggleEnvironmentEditing && (
              <button
                type="button"
                aria-label={props.environmentEditing ? "Finish environment editing" : "Edit room features"}
                title={props.environmentEditing ? "Finish environment editing" : "Edit environment"}
                aria-pressed={Boolean(props.environmentEditing)}
                onClick={props.onToggleEnvironmentEditing}
              >
                <StudioIcon name="rename" />
              </button>
            )}
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
              aria-label={props.previewOnly ? "Frame room" : "Frame selection"}
              onClick={() => (props.previewOnly ? engine.current?.view() : engine.current?.view("selection"))}
              title={props.previewOnly ? "Frame room" : "Frame selected object"}
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
                    const sampled = evaluateSpatialScene(
                      draft.content,
                      inputs,
                      time,
                      false,
                      props.motionOptions,
                    ).states;
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
            <button onClick={() => engine.current?.view("scene")}>Frame scene</button>
            <label>
              Preview quality
              <select
                aria-label="Preview quality"
                value={quality}
                onChange={(event) => setQuality(event.target.value as typeof quality)}
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
            </label>
            <button
              aria-pressed={audioEnabled}
              onClick={() => {
                if (audioEnabled) {
                  engine.current?.stopAudio();
                  setAudioEnabled(false);
                  return;
                }
                void engine.current
                  ?.enableAudio()
                  .then(() => {
                    setAudioEnabled(true);
                    setFeedback("Preview audio enabled. Play the timeline in Preview to hear authored sound.");
                  })
                  .catch(() => setFeedback("Audio could not start. Allow audio in this browser, then try again."));
              }}
            >
              {audioEnabled ? "Disable preview audio" : "Enable preview audio"}
            </button>
          </div>
        </details>
        {!props.previewOnly && (
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
        )}
      </div>
      {props.environmentEditing && !props.environmentOnly && preview === "EDITOR" && (
        <div className={styles.environmentEditing}>
          Environment editing · select any room feature, then use Move, Rotate or Scale. Room features rotate upright
          around Y.
          <select
            aria-label="Viewport room feature"
            value={props.selectedFeatureId ?? ""}
            onChange={(event) => props.onSelectFeature?.(event.target.value, { individual: true })}
          >
            <option value="" disabled>
              Select room feature
            </option>
            {environment.features?.map((feature) => (
              <option key={feature.id} value={feature.id}>
                {feature.name}
              </option>
            ))}
          </select>
        </div>
      )}
      {overlays && !fallback && !props.environmentEditing && (
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
              if (
                props.environmentEditing &&
                (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10"))
              ) {
                contextMenu.open(
                  event,
                  props.selectionMembers?.length ? props.selectionLabel! : (selectedFeature?.name ?? "Room feature"),
                  props.selectionActions?.() ??
                    (selectedFeature ? props.featureActions?.(selectedFeature.id) : undefined) ??
                    featureActions,
                );
                return;
              }
              if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10"))
                contextMenu.open(
                  event,
                  selected?.name ?? "Viewport",
                  props.selectionActions?.() ??
                    (selected ? (props.objectActions?.(selected.id) ?? viewportActions) : viewportActions),
                );
            }}
            onContextMenu={(event) => {
              const assetId = engine.current?.pickEntity(event.clientX, event.clientY);
              if (assetId) {
                if (!props.selectionMembers?.some((member) => member.kind === "ASSET" && member.id === assetId))
                  onSelect(assetId);
                contextMenu.open(
                  event,
                  draft.content.entities.find((entity) => entity.id === assetId)!.name,
                  props.objectActions?.(assetId) ?? [],
                );
                return;
              }
              if (props.environmentEditing) {
                const featureId = engine.current?.pickFeature(event.clientX, event.clientY);
                if (featureId) {
                  if (
                    !props.selectionMembers?.some((member) => member.kind === "ROOM_FEATURE" && member.id === featureId)
                  )
                    props.onSelectFeature?.(featureId);
                  contextMenu.open(
                    event,
                    environment.features?.find((feature) => feature.id === featureId)?.name ?? "Room feature",
                    props.featureActions?.(featureId) ?? featureActions,
                  );
                } else contextMenu.open(event, "Viewport", viewportActions);
                return;
              }
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
          {!props.previewOnly && (
            <div className={styles.selectionInstrument}>
              <span>
                {props.selectionMembers?.length
                  ? "GROUP SELECTION"
                  : props.environmentEditing
                    ? "ROOM FEATURE"
                    : selected
                      ? "SELECTED OBJECT"
                      : "SCENE"}
              </span>
              <strong>
                {props.selectionMembers?.length
                  ? props.selectionLabel
                  : (selectedFeature?.name ??
                    (props.environmentEditing ? "Select a room feature" : (selected?.name ?? draft.content.title)))}
              </strong>
              {selectedReceipt && !props.environmentEditing && !props.selectionMembers?.length && (
                <small aria-live="polite">
                  {selectedReceipt.status.replaceAll("_", " ").toLowerCase()}
                  {selectedFaint ? " · very faint material" : ""}
                </small>
              )}
              {selected && !props.environmentEditing && (
                <button aria-pressed={isolateSelected} onClick={() => setIsolateSelected(!isolateSelected)}>
                  {isolateSelected
                    ? "Show room"
                    : props.selectionMembers?.length
                      ? "Isolate selection"
                      : "Isolate selected object"}
                </button>
              )}
              {!props.environmentEditing &&
                selected &&
                selectedReceipt &&
                (selectedFaint ||
                  ["HIDDEN", "TRANSPARENT", "OUTSIDE_VIEW", "OCCLUDED", "TOO_SMALL"].includes(
                    selectedReceipt.status,
                  )) && (
                  <button
                    title="Show this object alone at a readable distance for editing. Saved visibility and runtime behavior stay unchanged."
                    onClick={() => {
                      props.onPreviewChange?.("EDITOR");
                      setEditingRevealId(selected.id);
                      setIsolateSelected(true);
                      requestAnimationFrame(() => engine.current?.view("selection"));
                    }}
                  >
                    {selectedFaint || ["HIDDEN", "TRANSPARENT"].includes(selectedReceipt.status)
                      ? "Reveal in editor"
                      : "Find object"}
                  </button>
                )}
              {!props.environmentEditing && selected && selected.id === editingRevealId && preview === "EDITOR" && (
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
              {(selectedFeature || selected) && props.onInspect && (
                <button onClick={props.onInspect}>
                  {props.selectionMembers?.length
                    ? "Edit selection"
                    : props.environmentEditing
                      ? "Edit selected feature"
                      : "Edit selected object"}
                </button>
              )}
              <small>
                {props.environmentEditing
                  ? "Editable environment geometry"
                  : adaptive
                    ? adaptive.quality.replaceAll("_", " ")
                    : "Fixed authored placement"}
              </small>
              {mode === "ENGINEERING" && selected && !props.selectionMembers?.length && (
                <code>
                  {Object.values(resolvedWorld(selected.id).position)
                    .map((v) => v.toFixed(2))
                    .join(" / ")}{" "}
                  m
                </code>
              )}
            </div>
          )}
          {preview === "CREW" && (
            <div className={styles.crewNotice}>
              Second viewpoint is camera navigation in this synthetic scene. No cross-device alignment is established.
            </div>
          )}
        </>
      )}
      {!props.previewOnly && (
        <>
          <div className={styles.viewportFooter}>
            <span>◉ Synthetic geometry · cutaway view · physical qualification pending</span>
            <span>
              {props.environmentOnly
                ? `${environment.features?.length ?? 0} room features`
                : `${draft.content.entities.length} objects`}{" "}
              / {evidence.candidates.filter((c) => c.safe).length} safe candidates
            </span>
          </div>
          <div className={styles.canvasHint}>
            <strong>{props.environmentOnly ? "Room editing" : adaptive ? "Auto placement" : "Manual placement"}</strong>
            <span id="parallax-canvas-feedback" aria-live="polite" aria-atomic="true">
              {dragPlacement
                ? !dragPlacement.clamping
                  ? "Free placement · surface clamping is off"
                  : dragPlacement.surfaceId
                    ? `Release to attach to ${dragPlacement.surfaceId.replaceAll("-", " ")} · aligned outline shows placement`
                    : "No clear surface nearby · release for free placement"
                : props.selectionMembers?.length
                  ? "Move, Rotate or Scale affects the whole selection."
                  : feedback}
            </span>
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
                aria-pressed={
                  props.selectionMembers
                    ? props.selectionMembers.some((member) => member.kind === "ASSET" && member.id === e.id)
                    : selectedId === e.id
                }
                onClick={(event) => onSelect(e.id, selectionModifiers(event))}
                onContextMenu={(event) => {
                  if (!props.selectionMembers?.some((member) => member.kind === "ASSET" && member.id === e.id))
                    onSelect(e.id);
                  contextMenu.open(event, e.name, props.objectActions?.(e.id) ?? []);
                }}
                onKeyDown={(event) => {
                  if (event.key === " " && (event.ctrlKey || event.metaKey || event.shiftKey)) {
                    event.preventDefault();
                    onSelect(e.id, selectionModifiers(event));
                    return;
                  }
                  if (props.selectionMembers?.length && event.key.startsWith("Arrow")) {
                    event.preventDefault();
                    try {
                      props.onTransformSelection?.({
                        ...identityTransform(),
                        position: {
                          x: event.key === "ArrowLeft" ? -0.05 : event.key === "ArrowRight" ? 0.05 : 0,
                          y: event.key === "ArrowUp" ? 0.05 : event.key === "ArrowDown" ? -0.05 : 0,
                          z: 0,
                        },
                      });
                    } catch {
                      /* Host feedback retains the selection. */
                    }
                    return;
                  }
                  if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
                    if (!props.selectionMembers?.some((member) => member.kind === "ASSET" && member.id === e.id))
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
        </>
      )}
      {contextMenu.menu}
    </section>
  );
}

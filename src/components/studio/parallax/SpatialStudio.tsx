"use client";
import { useMotionMode } from "@/animation/motion/useMotionMode";
import { resolvePlatformMotionToken } from "@/animation/platform/motion-tokens";
import { SceneGraphRename } from "./SceneGraphRename";
import { useSceneGraphOrder } from "./useSceneGraphOrder";
import { StudioTextField } from "./StudioTextField";
import { LibraryManagementDialog, libraryEntries, type LibraryDialogRequest } from "./SpatialLibrary";
import { SpatialContentLibrary } from "./SpatialContentLibrary";
import { sceneEnvironmentIdentity, type SpatialContentKind } from "@/parallax/spatial-content-catalog";
import type { CompatibleEnvironmentRecord } from "@/parallax/environment-library-compatibility";
import { projectEnvironmentCatalog, type EnvironmentCatalogItem } from "@/parallax/spatial-library-environment-catalog";
import { EnvironmentDefinitionWorkspace } from "./EnvironmentDefinitionWorkspace";
import { SceneManager } from "./SceneManager";
import { LegacyEnvironmentWorkspace, type LegacyEnvironmentWorkspaceState } from "./LegacyEnvironmentWorkspace";
import { legacyEnvironmentEditStateSchema } from "@/parallax/legacy-environment-working-contracts";
import { legacyScenePreviewEnvironment } from "@/parallax/legacy-environment-preview";
import {
  latestEnvironmentVersion,
  updateSceneEnvironmentVersion,
  type SceneEnvironmentVersion,
} from "@/parallax/scene-environment-authoring";
import { spatialLibraryKind } from "@/parallax/reusable-assets";
import type { compareScenes } from "@/parallax/scene-comparison";
import { environmentPreviewDraft } from "@/parallax/environment-workspace";
import {
  createEnvironmentDraft,
  environmentDraftSchema,
  type EnvironmentLibraryRecord,
} from "@/parallax/library-lifecycle-contracts";
import { journalWorking, readWorkingJournal, clearWorkingJournal } from "./working-recovery";
import { EnvironmentCreateDialog } from "./EnvironmentCreateDialog";
import type { RoomPhotoBase } from "./RoomPhotoPanel";
import type { RoomPerceptionProposal } from "@/parallax/room-perception-service";
import {
  SceneGroups,
  GroupMembershipDialog,
  GroupSelectionInspector,
  selectionModifiers,
  type SelectionModifiers,
} from "./SceneGroups";
import { groupMemberKey, type EditingGroup, type EditingGroupMember } from "@/parallax/editing-group-contracts";
import {
  saveEditingGroup,
  ungroupEditingGroup,
  transformEditingSelection,
  editingSelectionPivot,
} from "@/parallax/editing-groups";
import { identityTransform, type Transform } from "@/parallax/contracts";
import { Euler, Quaternion } from "three";
import Link from "next/link";
import {
  useCallback,
  useMemo,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  changeHistory,
  createSpatialDraft,
  draftSchema,
  editSpatialDraft,
  previewEntityTransforms,
  previewModes,
  redo,
  undo,
  type Edit,
  type History,
  type SpatialDraft,
} from "@/parallax/authoring";
import { SpatialAssistant, type SpatialAssistantBase, type SpatialAssistantPort } from "./SpatialAssistant";
import { createSpatialAssistantPort } from "./spatial-assistant-port";
import type { creatorAIUsage } from "@/parallax/ai-ledger";
import type { SpatialLibraryRecord } from "@/parallax/library-service";
import { spatialReleaseIndex } from "@/parallax/library-release-index";
import { readSpatialLibraryItem } from "./readSpatialLibraryItem";
import { spatialElementCatalogEntries } from "@/parallax/spatial-element-catalog-provider";
import { extractComposition, insertSavedComposition } from "@/parallax/element-authoring";
import { insertSpatialElementInEnvironment } from "@/parallax/element-insertion";
import { physicalAssets } from "@/parallax/asset-catalog";
import { placeSavedAssetOnSurface } from "@/parallax/group-surface-placement";
import { findSurfacePlacement } from "@/parallax/surface-placement";
import { SpatialElementInspector } from "./SpatialElementInspector";
import { InspectorNumber, InspectorRange } from "./InspectorControls";
import type { SpatialMoment, SpatialVersion } from "@/parallax/contracts";
import { emptyStudioContent } from "@/parallax/studio-contracts";
import {
  simulationEnvironments,
  simulateSpatialEnvironments,
  spatialPerformanceEstimate,
  validateSpatialAuthoring,
  type SpatialFinding,
} from "@/parallax/studio-validation";
import { SpatialCanvas } from "./SpatialCanvas";
import { SpatialDependencies } from "./SpatialDependencies";
import { AdaptivePlacement } from "./AdaptivePlacement";
import { SpatialFieldQuality } from "./SpatialFieldQuality";
import { BehaviorTracks } from "./BehaviorTracks";
import { AnimationEditor } from "./AnimationEditor";
import { RoomEnvironmentEditor } from "./RoomEnvironmentEditor";
import { RoomPhotoPanel } from "./RoomPhotoPanel";
import { addRoomFeature, boundRoomSurfaceIds } from "@/parallax/parametric-room";
import { enableRoomExclusions, reconcileRoomExclusions } from "@/parallax/exclusion-zones";
import { SaveSpatialAsset } from "./SavedSpatialLibrary";
import { authoredPreviewEnvironment, createRoomEnvironment } from "@/parallax/environment-authoring";
import { prepareAssistantEnvironment } from "@/parallax/assistant-environment";
import { insertSpatialPreset } from "@/parallax/editor-assets";
import { syntheticEnvironmentEvidence } from "@/parallax/adaptive-authoring";
import { resolveAdaptiveScene } from "@/parallax/adaptive";
import { appendSpatialInput, initialSpatialInputs, type SpatialInput } from "@/parallax/behavior";
import { SpatialSimulation, SimulationEvents } from "./SpatialSimulation";
import type { CatalogDropPoint, RendererReceipt } from "./spatial-workstation";
import { useWorkspaceLayout } from "./useWorkspaceLayout";
import { workspaceNames, workspaceLabels, type WorkspaceLayout } from "@/parallax/workspace-layout";
import {
  adjustFloatingPanel,
  fitFloatingPanel,
  floatingEdges,
  type FloatingBounds,
  type FloatingGesture,
  type FloatingPanel,
} from "@/parallax/floating-panel";
import { StudioIcon, useStudioContextMenu, type StudioMenuAction } from "./StudioContextMenu";
import styles from "./SpatialStudio.module.css";

type Chronicle = {
  id: string;
  title: string;
  autosaveVersion: number;
  blocks: { id: string; title: string; spatialMoment: SpatialMoment | null }[];
};
type Loaded = {
  csrfToken: string;
  layoutScope?: string;
  items: SpatialLibraryRecord[];
  environments?: EnvironmentLibraryRecord[];
  chronicle: Chronicle | null;
  aiAvailable: boolean;
  aiConfigured: boolean;
  aiUsage: Awaited<ReturnType<typeof creatorAIUsage>>;
};
type AttachmentChange = { blockId: string; before: SpatialMoment | null; after: SpatialMoment };
type InspectorView = "PROPERTIES" | "CONTEXT" | "SCENE";
type CanvasCommand = { sequence: number; kind: "FRAME" | "TOOL"; tool?: "translate" | "rotate" | "scale" };
function rotationEuler(transform: Transform): Euler {
  const previous = transform.rotation;
  return new Euler().setFromQuaternion(new Quaternion(previous.x, previous.y, previous.z, previous.w), "YXZ");
}
function withRotationAxis(transform: Transform, axis: "x" | "y" | "z", degrees: number): Transform {
  const angles = rotationEuler(transform);
  angles[axis] = (degrees * Math.PI) / 180;
  const next = new Quaternion().setFromEuler(angles);
  return { ...transform, rotation: { x: next.x, y: next.y, z: next.z, w: next.w } };
}
function withYaw(transform: Transform, degrees: number): Transform {
  return withRotationAxis(transform, "y", degrees);
}
const fresh = (chronicleId?: string) => createSpatialDraft(crypto.randomUUID(), "Desk Map", chronicleId ?? null);
function bindSavedSceneUrl(definitionId: string) {
  const url = new URL(window.location.href);
  if (url.pathname !== "/studio/parallax") return;
  if (
    url.searchParams.get("definition") === definitionId &&
    !url.searchParams.has("library") &&
    !url.searchParams.has("libraryKind") &&
    !url.searchParams.has("libraryVersion")
  )
    return;
  url.searchParams.delete("library");
  url.searchParams.delete("libraryKind");
  url.searchParams.delete("libraryVersion");
  url.searchParams.set("definition", definitionId);
  // Preserve Chronicle/Passage context and Next's history state without a route
  // navigation that would remount the editor and discard ordinary Undo history.
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}
function legacyWorkspaceState(raw: unknown): LegacyEnvironmentWorkspaceState {
  const state = legacyEnvironmentEditStateSchema.parse(raw);
  if (!state.working) throw new Error("Open the Environment working copy before editing it.");
  return { ...state, working: state.working };
}
export function SpatialStudio({
  chronicleId,
  definitionId,
  entityId,
  blockId,
  environmentDefinitionId,
  libraryEntryId,
  libraryEntryKind,
  libraryEntryVersionId,
}: {
  chronicleId?: string;
  definitionId?: string;
  entityId?: string;
  blockId?: string;
  environmentDefinitionId?: string;
  libraryEntryId?: string;
  libraryEntryKind?: string;
  libraryEntryVersionId?: string;
}) {
  const [loaded, setLoaded] = useState<Loaded | null>(null),
    [history, setHistoryState] = useState<History | null>(null);
  const [catalogRevision, setCatalogRevision] = useState(0);
  const [editorGeneration, setEditorGeneration] = useState(0),
    [savedRevision, setSavedRevision] = useState(0);
  const [attachmentPast, setAttachmentPast] = useState<AttachmentChange[]>([]),
    [attachmentFuture, setAttachmentFuture] = useState<AttachmentChange[]>([]);
  const [selected, setSelectedState] = useState<string | null>(entityId ?? null),
    [mode, setMode] = useState("GUIDED"),
    [preview, setPreview] = useState("EDITOR"),
    [environment, setEnvironment] = useState("bedroom");
  const [selectionItems, setSelectionItems] = useState<EditingGroupMember[]>(
    entityId ? [{ kind: "ASSET", id: entityId }] : [],
  );
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedRoomFeature, setSelectedRoomFeature] = useState<string | null>(null);
  const [inspectorTransformPreview, setInspectorTransformPreview] = useState<SpatialDraft | null>(null);
  const [inspectorView, setInspectorView] = useState<InspectorView>("PROPERTIES");
  const [canvasCommand, setCanvasCommand] = useState<CanvasCommand | null>(null);
  const [graphTab, setGraphTab] = useState<"ASSETS" | "GROUPINGS">("ASSETS");
  const [groupDialog, setGroupDialog] = useState<{ group: EditingGroup; creating: boolean } | null>(null);
  const [sceneQuery, setSceneQuery] = useState(""),
    [status, setStatus] = useState("Opening Spatial Studio…"),
    [error, setErrorMessage] = useState("");
  const [errorRecovery, setErrorRecovery] = useState<"SAVE" | "PLACEMENT">("SAVE");
  const setError = useCallback((message: string) => {
    setErrorMessage(message);
    setErrorRecovery("SAVE");
  }, []);
  const [busy, setBusy] = useState(false);
  const [savedSceneSnapshot, setSavedSceneSnapshot] = useState("");
  const [sceneManagerOpen, setSceneManagerOpen] = useState(false);
  const [managerEnvironmentId, setManagerEnvironmentId] = useState<string | undefined>();
  const [managerSceneId, setManagerSceneId] = useState<string | undefined>();
  const [legacyEnvironmentRecord, setLegacyEnvironmentRecord] = useState<LegacyEnvironmentWorkspaceState | null>(null);
  const returnToSceneManager = useRef(false);
  const managerDuplicateOperation = useRef<{ key: string; body: Record<string, unknown> } | null>(null);
  const managerLegacyCopyOperation = useRef<{ key: string; body: Record<string, unknown> } | null>(null);
  const [libraryKind, setLibraryKind] = useState<SpatialContentKind>(
    libraryEntryKind && ["ASSETS", "ENVIRONMENTS", "SCENES", "EFFECTS", "COMPOSITIONS"].includes(libraryEntryKind)
      ? (libraryEntryKind as SpatialContentKind)
      : "ASSETS",
  );
  const [libraryTarget, setLibraryTarget] = useState(libraryEntryId ?? "");
  const [inspectionLanding, setInspectionLanding] = useState(Boolean(libraryEntryId));
  const [environmentCatalog, setEnvironmentCatalog] = useState<EnvironmentCatalogItem[]>([]);
  const [environmentCatalogError, setEnvironmentCatalogError] = useState("");
  const catalogRequest = useRef(0);
  const bootstrapRequest = useRef(0);
  const [environmentDialog, setEnvironmentDialog] = useState<{
    photoDraft: SpatialDraft;
    originalDefinition: string;
    generation: number;
    initialStep?: "CHOOSE" | "PHOTOS";
  } | null>(null);
  const photoDraftRevision = useRef(0);
  const assetExportOperation = useRef<Record<string, unknown> | null>(null);
  const [environmentRecord, setEnvironmentRecord] = useState<EnvironmentLibraryRecord | null>(null);
  const [libraryDialog, setLibraryDialog] = useState<LibraryDialogRequest | null>(null);
  useEffect(() => {
    const id = environmentRecord?.id ?? legacyEnvironmentRecord?.working.id;
    if (id) {
      const url = new URL(window.location.href);
      url.searchParams.set("environment", id);
      window.history.replaceState(window.history.state, "", url.pathname + url.search);
    }
  }, [environmentRecord, legacyEnvironmentRecord]);
  const [recovery, setRecovery] = useState<
    (NonNullable<ReturnType<typeof readWorkingJournal>> & { server?: SpatialLibraryRecord }) | null
  >(null);
  const contextMenu = useStudioContextMenu();
  const [findings, setFindings] = useState<SpatialFinding[] | null>(null),
    [releaseId, setReleaseId] = useState(""),
    [targetBlock, setTargetBlock] = useState(blockId ?? ""),
    [override, setOverride] = useState("");
  const [timeMs, setTimeMs] = useState(0),
    [inputs, setInputs] = useState<SpatialInput[]>(initialSpatialInputs);
  const [simulationFeedback, setSimulationFeedback] = useState("");
  const draftRef = useRef<SpatialDraft | null>(null),
    revision = useRef(0),
    savedJson = useRef(""),
    saving = useRef<Promise<void> | null>(null),
    csrf = useRef(""),
    initialized = useRef(false);
  const historyRef = useRef<History | null>(null),
    generation = useRef(0),
    accountScope = useRef("");
  const [placementPreview, setPlacementPreview] = useState<SpatialDraft | null>(null);
  const [draggedLibraryPreset, setDraggedLibraryPreset] = useState<string | null>(null);
  const [pendingLibraryPlacement, setPendingLibraryPlacement] = useState<string | null>(null);
  const [pendingSavedAsset, setPendingSavedAsset] = useState<{
    record: SpatialLibraryRecord;
    versionId: string;
    support: "FLOOR" | "TABLE" | "WALL";
    attemptId: number;
  } | null>(null);
  const savedPlacementAttempt = useRef(0);
  const [expandedLibrary, setExpandedLibrary] = useState(false);
  const [assistantScenePreview, setAssistantScenePreview] = useState<SpatialDraft | null>(null);
  const [roomScenePreview, setRoomScenePreview] = useState<SpatialDraft | null>(null);
  const [assistantHighlights, setAssistantHighlights] = useState<readonly string[]>([]);
  const [roomEditing, writeRoomEditing] = useState(false);
  const roomEditingRef = useRef(false);
  const setRoomEditing = useCallback(
    (enabled: boolean) => {
      if (enabled && draftRef.current?.content.environment) {
        setError(
          "This Scene uses an immutable Environment version. Choose Edit environment to create an independent editable copy.",
        );
        writeRoomEditing(false);
        return;
      }
      if (roomEditingRef.current !== enabled) {
        roomEditingRef.current = enabled;
        generation.current++;
        setEditorGeneration(generation.current);
        setAssistantScenePreview(null);
      }
      writeRoomEditing(enabled);
    },
    [setError],
  );
  const setSelected = useCallback(
    (id: string | null) => {
      setInspectorTransformPreview(null);
      setInspectorView(id ? "PROPERTIES" : "SCENE");
      setSelectedState(id);
      setSelectedRoomFeature(null);
      setSelectedGroupId(null);
      setSelectionItems(id ? [{ kind: "ASSET", id }] : []);
      setRoomEditing(false);
    },
    [setRoomEditing],
  );
  const writeHistory = useCallback((next: History, source: "INSTALL" | "EDIT" = "EDIT") => {
    savedPlacementAttempt.current += 1;
    setPendingSavedAsset(null);
    if (source !== "INSTALL") setInspectionLanding(false);
    historyRef.current = next;
    draftRef.current = next.present;
    journalWorking(accountScope.current, next.present.content.definitionId, next.present, revision.current);
    generation.current += 1;
    setEditorGeneration(generation.current);
    setHistoryState(next);
    setAssistantScenePreview(null);
    setRoomScenePreview(null);
    setInspectorTransformPreview(null);
    setAssistantHighlights([]);
  }, []);
  const draft = history?.present;
  const authoredEnvironmentId = draft?.content.studio?.environment?.id;
  const pinnedEnvironmentId = draft?.content.environment?.environmentId;
  useEffect(() => {
    queueMicrotask(() => setEnvironment(authoredEnvironmentId ?? pinnedEnvironmentId ?? "bedroom"));
  }, [draft?.content.definitionId, authoredEnvironmentId, pinnedEnvironmentId]);
  const legacyPreview = useMemo(() => {
    if (!draft?.content.environment || draft.content.studio?.environment) return null;
    try {
      const projected = legacyScenePreviewEnvironment(
        draft.content,
        environmentCatalog.map((item) => item.record),
      );
      if (projected) previewEntityTransforms(draft.content, projected.id, projected, projected.evidence.candidates);
      return {
        environment: projected,
        error: "",
      };
    } catch (cause) {
      return {
        environment: null,
        error: cause instanceof Error ? cause.message : "This Environment version could not be loaded.",
      };
    }
  }, [draft, environmentCatalog]);
  const viewingLegacyPin = Boolean(legacyPreview && environment === pinnedEnvironmentId);
  const previewEnvironmentError = viewingLegacyPin
    ? legacyPreview?.error ||
      environmentCatalogError ||
      (!legacyPreview?.environment
        ? "Loading the exact Environment version. Its preview is unavailable until its catalog is ready."
        : "")
    : "";
  const previewEnvironment = draft
    ? authoredPreviewEnvironment(
        draft.content,
        (viewingLegacyPin ? legacyPreview?.environment : null) ??
          (previewEnvironmentError
            ? { ...simulationEnvironments[0], id: environment, name: "Environment unavailable", features: [] }
            : (simulationEnvironments.find((e) => e.id === environment) ?? {
                ...simulationEnvironments[0],
                id: environment,
              })),
      )
    : simulationEnvironments[0];
  const assistantEnvironment = useRef(previewEnvironment);
  useLayoutEffect(() => {
    assistantEnvironment.current = previewEnvironment;
  }, [previewEnvironment]);
  const { layout, setLayout, reset: resetWorkspace, choose: chooseWorkspace } = useWorkspaceLayout(loaded?.layoutScope);
  useEffect(() => {
    if (!loaded?.layoutScope || !inspectionLanding) return;
    queueMicrotask(() =>
      setLayout((previous) => ({ ...previous, leftTab: "ASSETS", libraryOpen: true, inspectorOpen: false })),
    );
  }, [loaded?.layoutScope, inspectionLanding, setLayout]);
  const { libraryOpen, inspectorOpen, libraryWidth, inspectorWidth, bottomOpen, bottomHeight, leftTab, bottomTab } =
    layout;
  const visibleLeftTab = leftTab === "SAVED" ? "ASSETS" : leftTab;
  useEffect(() => {
    if (leftTab === "SAVED") queueMicrotask(() => setLibraryKind("SCENES"));
  }, [leftTab]);
  const setLibraryOpen = (open: boolean) =>
    setLayout((previous) => ({
      ...previous,
      libraryOpen: open,
      inspectorOpen: open && innerWidth < 1100 ? false : previous.inspectorOpen,
    }));
  const setInspectorOpen = (open: boolean) => {
    if (!open) setInspectorTransformPreview(null);
    setLayout((previous) => ({
      ...previous,
      inspectorOpen: open,
      libraryOpen: open && innerWidth < 1100 ? false : previous.libraryOpen,
    }));
  };
  const setLibraryWidth = (value: number | ((width: number) => number)) =>
    setLayout((previous) => ({
      ...previous,
      libraryWidth: typeof value === "function" ? value(previous.libraryWidth) : value,
    }));
  const setInspectorWidth = (value: number | ((width: number) => number)) =>
    setLayout((previous) => ({
      ...previous,
      inspectorWidth: typeof value === "function" ? value(previous.inspectorWidth) : value,
    }));
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [motionTake, setMotionTake] = useState(0);
  const { mode: motionMode } = useMotionMode();
  const [timelineSelection, setTimelineSelection] = useState<{
    entityId: string;
    trackId?: string;
    frameId?: string;
    eventId?: string;
  } | null>(null);
  const motionOptions = useMemo(() => ({ take: motionTake, motion: motionMode }), [motionTake, motionMode]);
  const [renderedEntities, setRenderedEntities] = useState<Record<string, RendererReceipt["status"]>>({});
  const [renderedSceneVersion, setRenderedSceneVersion] = useState<string | undefined>();
  const recordRenderedEntities = useCallback((receipts: RendererReceipt[], sceneVersion?: string) => {
    setRenderedSceneVersion(sceneVersion);
    const next = Object.fromEntries(receipts.map((r) => [r.id, r.status]));
    setRenderedEntities((previous) => (JSON.stringify(previous) === JSON.stringify(next) ? previous : next));
  }, []);
  const validationOpen = bottomOpen && bottomTab === "DIAGNOSTICS";
  const setValidationOpen = (open: boolean) =>
    setLayout((previous) => ({ ...previous, bottomOpen: open, bottomTab: "DIAGNOSTICS" }));
  const bottomDrag = useRef<{ y: number; height: number } | null>(null);
  const studioElement = useRef<HTMLElement | null>(null);
  const expandedLibraryElement = useRef<HTMLElement | null>(null);
  const libraryReturnFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!expandedLibrary) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    expandedLibraryElement.current?.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [expandedLibrary]);
  const closeExpandedLibrary = (toViewport = false) => {
    const revealViewport = toViewport && innerWidth < 1100;
    if (revealViewport) setLibraryOpen(false);
    setExpandedLibrary(false);
    requestAnimationFrame(() => {
      if (toViewport) {
        const viewport = studioElement.current?.querySelector<HTMLElement>(
          '[aria-label="Spatial canvas"] [data-renderer]',
        );
        if (revealViewport) viewport?.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
        viewport?.focus({ preventScroll: true });
      } else
        (
          studioElement.current?.querySelector<HTMLElement>('[aria-label="Expand Spatial Library"]') ??
          libraryReturnFocus.current
        )?.focus();
    });
  };
  const handleExpandedLibraryKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (
      !expandedLibrary ||
      (event.target instanceof Element && event.target.closest('[role="dialog"]') !== expandedLibraryElement.current)
    )
      return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeExpandedLibrary();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [
      ...(expandedLibraryElement.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]):not([tabindex="-1"]), input:not([disabled]), select:not([disabled]), summary, [tabindex="0"]',
      ) ?? []),
    ].filter((element) => element.getClientRects().length > 0);
    if (!focusable.length) return;
    const first = focusable[0],
      last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  const inspectorPanelRef = useRef<HTMLElement | null>(null);
  const [floatingBounds, setFloatingBounds] = useState<FloatingBounds | null>(null);
  const [floatingFeedback, setFloatingFeedback] = useState("");
  const assistantGesture = useRef<{ kind: FloatingGesture; x: number; y: number; panel: FloatingPanel } | null>(null);
  useEffect(() => {
    if (!loaded) return;
    const fit = () => {
      const top = Math.min(
        Math.max(8, studioElement.current?.getBoundingClientRect().top ?? 8),
        Math.max(8, innerHeight - 200),
      );
      setFloatingBounds({
        x: 8,
        y: top,
        width: Math.max(1, innerWidth - 16),
        height: Math.max(1, innerHeight - top - 8),
      });
    };
    fit();
    window.addEventListener("resize", fit);
    window.addEventListener("scroll", fit, { passive: true });
    return () => {
      window.removeEventListener("resize", fit);
      window.removeEventListener("scroll", fit);
    };
  }, [loaded]);
  const floatingPanel = floatingBounds
    ? fitFloatingPanel(
        layout.assistantWindow ?? {
          x: floatingBounds.x + 48,
          y: floatingBounds.y + Math.max(0, floatingBounds.height - 724),
          width: 560,
          height: 700,
        },
        floatingBounds,
      )
    : null;
  const floatingGestureProps = {
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      const kind = event.currentTarget.dataset.floatingGesture as FloatingGesture;
      if (
        kind === "move" &&
        (event.target as HTMLElement).closest("button,input,select") &&
        event.currentTarget.tagName !== "BUTTON"
      )
        return;
      if (layout.assistantDocked || !floatingPanel || event.button !== 0) return;
      event.preventDefault();
      assistantGesture.current = { kind, x: event.clientX, y: event.clientY, panel: floatingPanel };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove: (event: PointerEvent<HTMLElement>) => {
      const gesture = assistantGesture.current;
      if (!gesture || !floatingBounds) return;
      const panel = adjustFloatingPanel(
        gesture.panel,
        gesture.kind,
        event.clientX - gesture.x,
        event.clientY - gesture.y,
        floatingBounds,
      );
      if (
        floatingPanel &&
        panel.x === floatingPanel.x &&
        panel.y === floatingPanel.y &&
        panel.width === floatingPanel.width &&
        panel.height === floatingPanel.height
      )
        return;
      setLayout((previous) => ({ ...previous, assistantWindow: panel }));
      setFloatingFeedback(gesture.kind === "move" ? "Window moved" : "Window resized");
    },
    onPointerUp: () => {
      assistantGesture.current = null;
    },
    onPointerCancel: () => {
      assistantGesture.current = null;
    },
    onLostPointerCapture: () => {
      assistantGesture.current = null;
    },
    onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => {
      const kind = event.currentTarget.dataset.floatingGesture as FloatingGesture;
      if (kind === "move" && event.target !== event.currentTarget) return;
      if (layout.assistantDocked || !floatingPanel || !floatingBounds || !event.key.startsWith("Arrow")) return;
      event.preventDefault();
      const step = event.shiftKey ? 40 : 10;
      const panel = adjustFloatingPanel(
        floatingPanel,
        kind,
        event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0,
        event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0,
        floatingBounds,
      );
      if (
        panel.x === floatingPanel.x &&
        panel.y === floatingPanel.y &&
        panel.width === floatingPanel.width &&
        panel.height === floatingPanel.height
      )
        return;
      setLayout((previous) => ({ ...previous, assistantWindow: panel }));
      setFloatingFeedback(kind === "move" ? "Window moved" : "Window resized");
    },
  };
  useEffect(() => {
    if (!loaded) return;
    const fit = () => {
      const element = studioElement.current;
      if (element)
        element.style.setProperty("--studio-top", `${Math.max(0, element.getBoundingClientRect().top + scrollY)}px`);
    };
    fit();
    window.addEventListener("resize", fit);
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(fit) : null;
    const shellHeader = document.querySelector(".product-shell-header");
    if (shellHeader) observer?.observe(shellHeader);
    return () => {
      window.removeEventListener("resize", fit);
      observer?.disconnect();
    };
  }, [loaded]);
  const openLeftTab = (tab: WorkspaceLayout["leftTab"]) => {
    if (tab === "SAVED") setLibraryKind("SCENES");
    setLayout((previous) => ({
      ...previous,
      leftTab: tab === "SAVED" ? "ASSETS" : tab,
      libraryOpen: true,
      inspectorOpen: innerWidth < 1100 ? false : previous.inspectorOpen,
    }));
  };
  const openBottomTab = (tab: WorkspaceLayout["bottomTab"]) =>
    setLayout((previous) => ({ ...previous, bottomTab: tab, bottomOpen: true }));
  useEffect(() => {
    queueMicrotask(() => setPlacementPreview(null));
  }, [draft, selected]);
  const dockDrag = useRef<{ side: "library" | "inspector"; x: number; width: number } | null>(null);
  const dockHandle = (side: "library" | "inspector") => (
    <div
      className={styles.dockHandle}
      role="separator"
      aria-label={`Resize ${side} panel`}
      aria-orientation="vertical"
      aria-valuenow={side === "library" ? libraryWidth : inspectorWidth}
      aria-valuemin={210}
      aria-valuemax={420}
      tabIndex={0}
      onPointerDown={(event) => {
        dockDrag.current = { side, x: event.clientX, width: side === "library" ? libraryWidth : inspectorWidth };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const drag = dockDrag.current;
        if (drag?.side === side) {
          const value = Math.max(
            210,
            Math.min(420, drag.width + (event.clientX - drag.x) * (side === "library" ? 1 : -1)),
          );
          (side === "library" ? setLibraryWidth : setInspectorWidth)(value);
        }
      }}
      onPointerUp={() => {
        dockDrag.current = null;
      }}
      onPointerCancel={() => {
        dockDrag.current = null;
      }}
      onKeyDown={(event) => {
        if ((event.target as HTMLElement).closest("dialog")) return;
        if (["ArrowLeft", "ArrowRight"].includes(event.key)) {
          event.preventDefault();
          const update = side === "library" ? setLibraryWidth : setInspectorWidth;
          update((w) => Math.max(210, Math.min(420, w + (event.key === "ArrowRight" ? 16 : -16))));
        }
      }}
    />
  );
  useEffect(() => {
    if (!playing) return;
    let frame = 0,
      previous = performance.now();
    const advance = (now: number) => {
      const elapsed = document.hidden ? 0 : now - previous;
      previous = now;
      setTimeMs((time) => Math.min(60000, time + elapsed));
      frame = requestAnimationFrame(advance);
    };
    frame = requestAnimationFrame(advance);
    return () => cancelAnimationFrame(frame);
  }, [playing]);
  useEffect(() => {
    if (playing && timeMs >= 60000) queueMicrotask(() => setPlaying(false));
  }, [playing, timeMs]);
  const seekTimeline = (time: number) => {
    setPlaying(false);
    setTimeMs(time);
    setPreview("LENS");
  };
  const resetSimulation = () => {
    setPlaying(false);
    setTimeMs(0);
    setInputs(initialSpatialInputs());
    setPreview("LENS");
    setSimulationFeedback("Simulation reset to the initial scene state.");
  };
  const triggerSimulation = (trigger: "INSPECT" | "PICK" | "PLACE") => {
    const object = draft?.content.entities.find((entity) => entity.id === selected);
    if (!object?.interactions.includes(trigger)) return;
    try {
      setInputs(appendSpatialInput(inputs, { trigger, entityId: object.id, atMs: timeMs }));
      setPreview("LENS");
      const count =
        draft?.content.studio?.behaviors.filter((b) => b.trigger === trigger && b.sourceEntityId === object.id)
          .length ?? 0;
      setSimulationFeedback(
        count
          ? `${trigger.toLowerCase()} on ${object.name} matched ${count} behavior${count === 1 ? "" : "s"}. See interaction results for timing and renderer state.`
          : `${trigger.toLowerCase()} on ${object.name} has no matching behavior. Author one in Timeline to give it an effect.`,
      );
    } catch (failure) {
      setSimulationFeedback(failure instanceof Error ? failure.message : "Reset simulation before trying again.");
    }
  };
  const adaptiveResolution = draft?.content.adaptive
    ? resolveAdaptiveScene(
        draft.content,
        syntheticEnvironmentEvidence(previewEnvironment),
        `studio-preview-${draft.content.adaptive.variant}`,
      )
    : null;
  const api = useCallback(async (body: unknown) => {
    const response = await fetch("/api/studio/parallax", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": csrf.current },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok)
      throw Object.assign(new Error(data.message ?? data.error ?? "Spatial Studio could not save this change."), {
        status: response.status,
        code: data.code,
      });
    return data;
  }, []);
  const persist = useCallback(async () => {
    if (saving.current) return saving.current;
    if (!draftRef.current || savedJson.current === JSON.stringify(draftRef.current)) return;
    const task = async () => {
      while (draftRef.current && savedJson.current !== JSON.stringify(draftRef.current)) {
        const snapshot = draftRef.current;
        setStatus("Saving working draft…");
        const result = await api({ action: "SAVE", draft: snapshot, revision: revision.current });
        revision.current = result.revision;
        setSavedRevision(result.revision);
        savedJson.current = JSON.stringify(snapshot);
        setSavedSceneSnapshot(JSON.stringify(snapshot));
        clearWorkingJournal(accountScope.current, snapshot.content.definitionId, snapshot);
        if (draftRef.current && draftRef.current !== snapshot)
          journalWorking(accountScope.current, snapshot.content.definitionId, draftRef.current, result.revision);
        if (!inspectionLanding && draftRef.current?.content.definitionId === snapshot.content.definitionId)
          bindSavedSceneUrl(snapshot.content.definitionId);
      }
      setStatus("Working draft saved");
    };
    saving.current = task().finally(() => {
      saving.current = null;
    });
    return saving.current;
  }, [api, inspectionLanding]);
  const [assistantPortSession, setAssistantPortSession] = useState<{
    accountId: string;
    definitionId: string;
    port: SpatialAssistantPort;
  } | null>(null);
  useEffect(() => {
    const definitionId = draft?.content.definitionId,
      accountId = loaded?.layoutScope;
    if (!definitionId || !accountId) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      const readBase = (): SpatialAssistantBase => {
        if (!draftRef.current) throw new Error("Open a working scene before requesting assistance.");
        return { draft: draftRef.current, revision: revision.current, editorGeneration: generation.current };
      };
      const port = createSpatialAssistantPort({
        scope: () => ({ accountId: accountScope.current, definitionId: draftRef.current?.content.definitionId ?? "" }),
        csrfToken: () => csrf.current,
        readBase,
        prepareBase: async () => {
          const current = historyRef.current;
          if (!current) throw new Error("Open a working scene before requesting assistance.");
          const prepared = prepareAssistantEnvironment(current.present, assistantEnvironment.current);
          if (prepared !== current.present) writeHistory(changeHistory(current, { type: "REPLACE", draft: prepared }));
          await persist();
          return readBase();
        },
        installSaved: (saved) => {
          const current = historyRef.current;
          if (!current) throw new Error("The working scene is unavailable.");
          revision.current = saved.revision;
          setSavedRevision(saved.revision);
          savedJson.current = JSON.stringify(saved.draft);
          setSavedSceneSnapshot(JSON.stringify(saved.draft));
          bindSavedSceneUrl(saved.draft.content.definitionId);
          writeHistory(changeHistory(current, { type: "REPLACE", draft: saved.draft }));
          setFindings(null);
          setStatus("Reviewed Assistant changes saved");
        },
      });
      const mountedPort: SpatialAssistantPort = {
        ...port,
        apply: async (...input: Parameters<typeof port.apply>) => {
          await persist();
          setBusy(true);
          const application = port.apply(...input);
          const queued = application.then(() => {});
          void queued.catch(() => {});
          saving.current = queued;
          try {
            return await application;
          } finally {
            if (saving.current === queued) saving.current = null;
            setBusy(false);
          }
        },
      };
      setAssistantPortSession({ accountId, definitionId, port: mountedPort });
    });
    return () => {
      cancelled = true;
    };
  }, [draft?.content.definitionId, loaded?.layoutScope, persist, writeHistory]);
  const assistantPort =
    assistantPortSession?.accountId === loaded?.layoutScope &&
    assistantPortSession?.definitionId === draft?.content.definitionId
      ? assistantPortSession?.port
      : null;
  const assistantPreview = useCallback((next: SpatialDraft | null, affected: readonly string[]) => {
    setRoomScenePreview(null);
    setAssistantScenePreview(next);
    setAssistantHighlights(affected);
  }, []);
  const roomPreview = useCallback((next: SpatialDraft | null) => {
    setRoomScenePreview(next ? draftSchema.parse(next) : null);
    if (next) {
      setAssistantScenePreview(null);
      setPlacementPreview(null);
      setAssistantHighlights([]);
      setAssistantOpen(false);
    }
  }, []);
  const [assistantTaskResetVersion, setAssistantTaskResetVersion] = useState(0);
  const [assistantClosing, setAssistantClosing] = useState(false);
  const assistantCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (assistantCloseTimer.current) clearTimeout(assistantCloseTimer.current);
    },
    [],
  );
  const closeAssistant = () => {
    if (assistantCloseTimer.current) clearTimeout(assistantCloseTimer.current);
    setAssistantTaskResetVersion((version) => version + 1);
    setAssistantClosing(true);
    assistantCloseTimer.current = setTimeout(() => {
      setAssistantOpen(false);
      setAssistantClosing(false);
      assistantCloseTimer.current = null;
    }, resolvePlatformMotionToken("state", motionMode).durationMs);
    assistantPreview(null, []);
    setPlacementPreview(null);
  };
  const install = useCallback(
    (next: SpatialDraft, nextRevision: number, saved: boolean, bindUrl = true) => {
      draftRef.current = next;
      revision.current = nextRevision;
      setSavedRevision(nextRevision);
      savedJson.current = saved ? JSON.stringify(next) : "";
      setSavedSceneSnapshot(saved ? JSON.stringify(next) : "");
      if (bindUrl) {
        setInspectionLanding(false);
        bindSavedSceneUrl(next.content.definitionId);
      }
      setEnvironment(next.content.studio?.environment?.id ?? next.content.environment?.environmentId ?? "bedroom");
      writeHistory({ past: [], present: next, future: [] }, "INSTALL");
      if (saved) clearWorkingJournal(accountScope.current, next.content.definitionId, next);
      setSelected(
        next.content.entities.some((e) => e.id === entityId)
          ? entityId!
          : (next.content.studio?.libraryDefinition?.rootEntityId ?? next.content.entities[0].id),
      );
      setFindings(null);
      setReleaseId("");
      setError("");
      setPlaying(false);
      setSimulationFeedback("");
      setTimeMs(0);
      setInputs(initialSpatialInputs());
    },
    [entityId, writeHistory, setSelected, setError],
  );
  const load = useCallback(
    async (selectedDefinitionId?: string, firstAvailable = false) => {
      const request = ++bootstrapRequest.current;
      const startedGeneration = generation.current;
      const response = await fetch(
        `/api/studio/parallax${chronicleId ? `?chronicle=${encodeURIComponent(chronicleId)}` : ""}`,
        { cache: "no-store" },
      );
      const data = (await response.json()) as Loaded & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Spatial Studio is unavailable.");
      const selectedId = firstAvailable
        ? data.items[0]?.id
        : (selectedDefinitionId ?? draftRef.current?.content.definitionId ?? definitionId);
      const selected = data.items.find((item) => item.id === selectedId);
      if (selected?.releasesState === "INDEX_ONLY" && spatialReleaseIndex(selected).length) {
        const hydrated = await readSpatialLibraryItem(selected.id, selected);
        data.items = data.items.map((item) => (item.id === selected.id ? hydrated : item));
      }
      if (request !== bootstrapRequest.current || startedGeneration !== generation.current)
        throw new Error("Your Scene changed while the Library was loading. Try the action again.");
      csrf.current = data.csrfToken;
      accountScope.current = data.layoutScope ?? "";
      setLoaded(data);
      setCatalogRevision((revision) => revision + 1);
      return data;
    },
    [chronicleId, definitionId],
  );
  const refreshEnvironmentCatalog = useCallback(async () => {
    const request = ++catalogRequest.current;
    try {
      const response = (await api({ action: "ENVIRONMENT_CATALOG" })) as {
        catalog: CompatibleEnvironmentRecord[];
      };
      if (request !== catalogRequest.current) return response.catalog;
      setEnvironmentCatalog(projectEnvironmentCatalog(response.catalog));
      setCatalogRevision((revision) => revision + 1);
      setEnvironmentCatalogError("");
      return response.catalog;
    } catch (cause) {
      if (request !== catalogRequest.current) return;
      setEnvironmentCatalogError(cause instanceof Error ? cause.message : "Environment catalog is unavailable.");
    }
  }, [api]);
  useEffect(() => {
    if (!loaded) return;
    let active = true;
    queueMicrotask(() => {
      if (active) void refreshEnvironmentCatalog();
    });
    return () => {
      active = false;
    };
  }, [loaded, refreshEnvironmentCatalog]);
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      void load()
        .then(async (data) => {
          if (cancelled || initialized.current) return;
          initialized.current = true;
          const requestedItem = data.items.find((item) => item.id === definitionId && !item.archived);
          if (requestedItem?.readOnly) {
            const installedKind: SpatialContentKind =
              requestedItem.draft.category === "EFFECT"
                ? "EFFECTS"
                : requestedItem.draft.tags.includes("composition")
                  ? "COMPOSITIONS"
                  : spatialLibraryKind(requestedItem.draft) === "ASSETS"
                    ? "ASSETS"
                    : "SCENES";
            setLibraryKind(installedKind);
            setLibraryTarget(`saved:${requestedItem.id}`);
            setInspectionLanding(true);
            setLayout((previous) => ({ ...previous, leftTab: "ASSETS", libraryOpen: true, inspectorOpen: false }));
            const url = new URL(window.location.href);
            url.searchParams.delete("definition");
            url.searchParams.delete("libraryVersion");
            url.searchParams.set("library", `saved:${requestedItem.id}`);
            url.searchParams.set("libraryKind", installedKind);
            window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
            install(fresh(chronicleId), 0, false, false);
            setStatus("Installed release selected in Library. The pinned copy is read-only.");
            return;
          }
          if (libraryEntryId) {
            setLayout((previous) => ({ ...previous, leftTab: "ASSETS", libraryOpen: true, inspectorOpen: false }));
          }
          if (environmentDefinitionId) {
            const returnScene = data.items.find((item) => item.id === definitionId && !item.archived);
            const environment = data.environments?.find((e) => e.id === environmentDefinitionId && !e.archived);
            if (environment) {
              if (returnScene) install(returnScene.draft, returnScene.revision, true);
              setEnvironmentRecord(environment);
            } else {
              const response = (await api({ action: "ENVIRONMENT_CATALOG" })) as {
                catalog: CompatibleEnvironmentRecord[];
              };
              const legacy = response.catalog.find(
                (record) =>
                  record.id === environmentDefinitionId &&
                  record.representation === "SC01_SCHEMA1" &&
                  !record.builtin &&
                  !record.archived,
              );
              if (!legacy) throw new Error("This environment is unavailable. Restore it from Library if archived.");
              const opened = legacyWorkspaceState(
                await api({
                  action: "LEGACY_ENVIRONMENT_BEGIN",
                  definitionId: legacy.id,
                  revision: legacy.revision,
                  operationId: crypto.randomUUID(),
                }),
              );
              if (cancelled) return;
              if (returnScene) install(returnScene.draft, returnScene.revision, true);
              setLegacyEnvironmentRecord(opened);
            }
            return;
          }
          const item = requestedItem;
          const retained = definitionId ? readWorkingJournal(data.layoutScope ?? "", definitionId) : null;
          if (retained && (!item || JSON.stringify(retained.document) !== JSON.stringify(item.draft)))
            setRecovery(retained);
          if (item) install(item.draft, item.revision, true);
          else {
            const capsule = data.chronicle?.blocks.find((b) => b.id === blockId)?.spatialMoment;
            if (capsule) {
              const { checksum: _checksum, ...content } = capsule.version;
              void _checksum;
              const next = fresh(chronicleId);
              install(
                draftSchema.parse({
                  ...next,
                  content: { ...content, id: next.content.id, definitionId: next.content.definitionId },
                  lineage: { definitionId: capsule.definition.id, versionId: capsule.version.id },
                }),
                0,
                false,
              );
            } else if (retained && !("format" in retained.document))
              install(retained.document, retained.revision, false);
            else if (definitionId)
              throw new Error("This scene is unavailable. Restore an archived definition from Library before editing.");
            else install(fresh(chronicleId), 0, false, !libraryEntryId);
          }
          setStatus(
            item
              ? "Working draft opened"
              : libraryEntryId
                ? "Installed release selected in Library. The pinned copy is read-only."
                : "New working draft",
          );
        })
        .catch((cause) => {
          if (!cancelled) setError(cause.message);
        });
      try {
        const preference = sessionStorage.getItem("parallax.authoring-mode");
        if (["GUIDED", "DETAILED", "ENGINEERING"].includes(preference ?? "")) setMode(preference!);
      } catch {}
    });
    return () => {
      cancelled = true;
    };
  }, [
    load,
    install,
    definitionId,
    chronicleId,
    blockId,
    environmentDefinitionId,
    libraryEntryId,
    api,
    setLayout,
    setError,
  ]);
  useEffect(() => {
    if (!draft || !loaded || environmentRecord || legacyEnvironmentRecord || recovery) return;
    if (savedJson.current !== JSON.stringify(draft))
      journalWorking(accountScope.current, draft.content.definitionId, draft, revision.current);
    const timer = setTimeout(
      () =>
        void persist().catch((cause) => {
          setError(cause.message);
          setStatus("Unsaved changes · retry available; your working draft is retained");
        }),
      800,
    );
    return () => clearTimeout(timer);
  }, [draft, loaded, persist, environmentRecord, legacyEnvironmentRecord, recovery, setError]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (draftRef.current && savedJson.current !== JSON.stringify(draftRef.current)) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  const edit = (change: Edit) => {
    if (busy) {
      setStatus("Wait for the current scene operation to finish before editing.");
      return;
    }
    try {
      if (historyRef.current) {
        const nextHistory = changeHistory(historyRef.current, change);
        if (
          historyRef.current.present.content.environment &&
          JSON.stringify(historyRef.current.present.content.studio?.environment) !==
            JSON.stringify(nextHistory.present.content.studio?.environment)
        )
          throw new Error(
            "This Scene uses an immutable Environment version. Choose Edit environment to create an independent editable copy.",
          );
        writeHistory(nextHistory);
      }
      setFindings(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The edit could not be applied.");
    }
  };
  const replace = (next: SpatialDraft) => {
    if (next.content.studio?.environment && !next.content.environment)
      next.content.studio.environment = reconcileRoomExclusions(next.content.studio.environment);
    if (
      next.content.studio?.environmentLibraryArchived &&
      JSON.stringify(next.content.studio.environment) !== JSON.stringify(draft?.content.studio?.environment)
    )
      delete next.content.studio.environmentLibraryArchived;
    edit({ type: "REPLACE", draft: next });
  };
  const addPreset = (name: string, placement?: { position: Transform["position"]; surfaceId: string }) => {
    if (!draft || busy) return false;
    setError("");
    try {
      if (previewEnvironmentError) throw new Error(previewEnvironmentError);
      if (name === "Exclusion Zone") {
        if (draft.content.environment) {
          startRoomEditing();
          return true;
        }
        if (preview !== "EDITOR" || roomScenePreview || assistantScenePreview || placementPreview)
          throw new Error("Return to the saved scene before adding an exclusion zone.");
        const next = structuredClone(draft);
        next.content.studio ??= emptyStudioContent();
        const room =
          next.content.studio.environment?.id === environment
            ? next.content.studio.environment
            : createRoomEnvironment(previewEnvironment);
        const id = `zone-${crypto.randomUUID()}`;
        next.content.studio.environment = addRoomFeature(room, "EXCLUSION_ZONE", id);
        replace(next);
        setEnvironment(next.content.studio.environment.id);
        setPlaying(false);
        setSelected(null);
        setRoomEditing(true);
        setSelectedRoomFeature(id);
        setSelectionItems([{ kind: "ROOM_FEATURE", id }]);
        setInspectorView("PROPERTIES");
        setInspectorOpen(true);
        openLeftTab("HIERARCHY");
        setGraphTab("ASSETS");
        setStatus("Exclusion zone added. Move, rotate or resize its clear box to reserve space.");
        return true;
      }
      const next = name.startsWith("sc02:")
        ? insertSpatialElementInEnvironment(
            draft,
            name.slice(5),
            crypto.randomUUID(),
            previewEnvironment,
            placement?.position,
            placement?.surfaceId,
          )
        : insertSpatialPreset(draft, name, crypto.randomUUID());
      replace(next);
      setSelected(next.content.entities[draft.content.entities.length].id);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Asset could not be added.");
      setErrorRecovery("PLACEMENT");
      return false;
    }
  };
  const action = async (run: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await run();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "This action could not be completed.");
    } finally {
      setBusy(false);
    }
  };
  const openCatalogScene = (record: SpatialLibraryRecord) =>
    void action(async () => {
      await persist();
      const data = await load(record.id);
      const current = data.items.find((item) => item.id === record.id && !item.archived);
      if (!current) throw new Error("This Scene is no longer available.");
      install(current.draft, current.revision, true);
      setPreview("EDITOR");
    });
  const manageCatalogScene = (record: SpatialLibraryRecord, mode: LibraryDialogRequest["mode"]) =>
    void action(async () => {
      const current =
        mode === "VERSIONS" && record.releasesState === "INDEX_ONLY"
          ? await readSpatialLibraryItem(record.id, record)
          : record;
      setLibraryDialog({ entry: libraryEntries([current])[0], mode });
    });
  const saveCatalogScene = (record: SpatialLibraryRecord) =>
    void action(async () => {
      await persist();
      const result = await api({
        action: "SAVE_TO_LIBRARY",
        definitionId: record.id,
        revision: record.id === draftRef.current?.content.definitionId ? revision.current : record.revision,
      });
      if (record.id === draftRef.current?.content.definitionId) {
        revision.current = result.revision;
        setSavedRevision(result.revision);
      }
      await load();
      setStatus("Saved to private Library · existing definition");
    });
  const archiveCatalogScene = (record: SpatialLibraryRecord, archive: boolean) =>
    void action(async () => {
      await persist();
      if (archive && record.id === draftRef.current?.content.definitionId)
        throw new Error("Open another Scene before archiving the current working definition.");
      await api({
        action: "LIBRARY_METADATA",
        definitionId: record.id,
        revision: record.revision,
        change: { archive },
      });
      await load();
      setStatus(archive ? "Working definition archived; immutable versions remain pinned" : "Definition restored");
    });
  const insertCatalogSaved = (record: SpatialLibraryRecord, versionId: string, placement?: CatalogDropPoint) =>
    void action(async () => {
      const startedGeneration = generation.current;
      const attemptId = placement ? pendingSavedAsset?.attemptId : undefined;
      const placementIsCurrent = () =>
        !placement ||
        (attemptId !== undefined &&
          savedPlacementAttempt.current === attemptId &&
          pendingSavedAsset?.record.id === record.id &&
          pendingSavedAsset.versionId === versionId);
      if (!placementIsCurrent()) return;
      await persist();
      if (!placementIsCurrent()) return;
      if (placement && generation.current !== startedGeneration)
        throw new Error("Your Scene changed. Choose the saved asset again.");
      const base = draftRef.current!;
      const gen = generation.current;
      if (record.draft.category === "SCENE_TEMPLATE" && record.draft.tags.includes("composition")) {
        if (record.readOnly) {
          const result = await api({
            action: "INSTALLED_COMPOSITION_INSERT",
            draft: base,
            revision: revision.current,
            definitionId: record.id,
            versionId,
          });
          if (generation.current !== gen) throw new Error("Your Scene changed. Add the composition again.");
          replace(draftSchema.parse(result.draft));
          setSelected(result.draft.content.entities[base.content.entities.length].id);
          await persist();
          await load();
          setStatus("Credited installed composition added · Undo is available");
          return;
        }
        const data = await load();
        const indexed = data.items.find((item) => item.id === record.id && !item.archived);
        const current =
          indexed?.releasesState === "INDEX_ONLY" ? await readSpatialLibraryItem(indexed.id, indexed) : indexed;
        if (!current || current.saveState !== "SAVED")
          throw new Error("Save this composition to your Library before adding it.");
        const released = versionId ? current.releases.find((item) => item.id === versionId) : null;
        if (versionId && !released) throw new Error("The selected composition version is unavailable.");
        let source = current.draft;
        if (released) {
          const { checksum: _checksum, ...content } = released;
          void _checksum;
          source = draftSchema.parse({ ...source, content });
        }
        if (generation.current !== gen) throw new Error("Your Scene changed. Add the saved composition again.");
        const next = insertSavedComposition(base, source, crypto.randomUUID());
        replace(next);
        setSelected(next.content.entities[base.content.entities.length].id);
        await persist();
        await load();
        setStatus("Independent saved composition added · Undo is available");
        return;
      }
      const result = await api({
        action: "ASSET_INSERT",
        draft: base,
        revision: revision.current,
        definitionId: record.id,
        versionId,
      });
      if (!placementIsCurrent()) return;
      if (generation.current !== gen) throw new Error("Your Scene changed. Add the released copy again.");
      let next = draftSchema.parse(result.draft);
      if (placement) {
        if (
          !pendingSavedAsset ||
          pendingSavedAsset.record.id !== record.id ||
          pendingSavedAsset.versionId !== versionId ||
          pendingSavedAsset.attemptId !== attemptId
        )
          throw new Error("The pending asset changed. Choose it from the Library again.");
        const candidate = syntheticEnvironmentEvidence(previewEnvironment).candidates.find(
          (item) => item.id === placement.surfaceId && item.surface === placement.surface,
        );
        const allowed = pendingSavedAsset.support === "TABLE" ? ["TABLE", "DESK"] : [pendingSavedAsset.support];
        if (!candidate?.safe || candidate.occluded || !allowed.includes(candidate.surface))
          throw new Error("That surface is no longer clear. Choose another placement point; nothing was inserted.");
        const added = next.content.entities.slice(base.content.entities.length);
        // Physical saved models search full rendered geometry in the canonical
        // insertion planner. A planar presearch with raw authored width can
        // reject a scaled model before that planner gets the keyboard point.
        const target =
          placement.input === "KEYBOARD" && !added.some((entity) => entity.element?.kind === "PHYSICAL_ASSET")
            ? findSurfacePlacement(
                { ...identityTransform(), position: placement.position },
                candidate,
                Math.max(...added.map((entity) => entity.widthMeters)),
              )?.position
            : placement.position;
        if (!target) throw new Error("This surface has no clear area for the asset. Nothing was inserted.");
        next = placeSavedAssetOnSurface(
          base,
          next,
          added.map((entity) => ({ kind: "ASSET" as const, id: entity.id })),
          candidate,
          target,
          previewEnvironment,
          placement.input !== "KEYBOARD",
        );
      }
      if (!placementIsCurrent()) return;
      replace(next);
      setSelected(next.content.entities[base.content.entities.length].id);
      await persist();
      await load();
      setStatus(
        record.readOnly ? "Credited installed copy added · Undo is available" : "Independent released copy added",
      );
    });
  const openCatalogEnvironment = (item: EnvironmentCatalogItem) =>
    void action(async () => {
      await persist();
      await managerEditEnvironment(item.record, false);
    });
  const manageCatalogEnvironment = (item: EnvironmentCatalogItem, mode: LibraryDialogRequest["mode"]) => {
    if (item.record.representation !== "LIFECYCLE_V1") return;
    const entry = libraryEntries([], [item.record.lifecycle])[0];
    setLibraryDialog({ entry, mode });
  };
  const saveCatalogEnvironment = (item: EnvironmentCatalogItem) =>
    void action(async () => {
      await persist();
      if (item.record.builtin) throw new Error("Create an owned Environment copy before saving it to your Library.");
      await api({
        action: item.record.representation === "LIFECYCLE_V1" ? "SAVE_TO_LIBRARY" : "LEGACY_ENVIRONMENT_LIBRARY_SAVE",
        definitionId: item.id,
        revision: item.record.revision,
      });
      await load();
      await refreshEnvironmentCatalog();
      setStatus("Environment saved to private Library");
    });
  const archiveCatalogEnvironment = (item: EnvironmentCatalogItem, archive: boolean) =>
    void action(async () => {
      await persist();
      if (item.record.builtin) throw new Error("Built-in Environments are immutable. Edit an owned copy instead.");
      await api(
        item.record.representation === "LIFECYCLE_V1"
          ? {
              action: "LIBRARY_METADATA",
              definitionId: item.id,
              revision: item.record.revision,
              change: { archive },
            }
          : {
              action: "LEGACY_ENVIRONMENT_ARCHIVE",
              definitionId: item.id,
              revision: item.record.revision,
              archived: archive,
            },
      );
      await load();
      await refreshEnvironmentCatalog();
      setStatus(archive ? "Environment working definition archived" : "Environment restored");
    });
  const applyCatalogEnvironment = (item: EnvironmentCatalogItem, versionId?: string) =>
    void action(async () => {
      await persist();
      if (item.record.representation !== "LIFECYCLE_V1")
        throw new Error("Choose an exact legacy Environment version in Scene Manager.");
      const base = draftRef.current!;
      const gen = generation.current;
      const result = await api({
        action: "ENVIRONMENT_USE",
        draft: base,
        revision: revision.current,
        definitionId: item.id,
        versionId,
      });
      if (generation.current !== gen) throw new Error("Your Scene changed. Choose the Environment again.");
      revision.current = result.revision;
      setSavedRevision(result.revision);
      savedJson.current = JSON.stringify(result.draft);
      setSavedSceneSnapshot(JSON.stringify(result.draft));
      writeHistory(changeHistory(historyRef.current!, { type: "REPLACE", draft: result.draft }));
      setEnvironment(result.draft.content.studio.environment.id);
      await load();
      setStatus("Independent Environment snapshot applied");
    });
  const createCatalogEnvironment = () => {
    photoDraftRevision.current = 0;
    const document = createEnvironmentDraft(crypto.randomUUID());
    setEnvironmentDialog({
      photoDraft: environmentPreviewDraft(document),
      originalDefinition: draftRef.current?.content.definitionId ?? "",
      generation: generation.current,
    });
  };
  const managerOpenScene = async (id: string) => {
    await persist();
    const data = await load(id);
    const current = data.items.find((item) => item.id === id && !item.archived);
    if (!current || spatialLibraryKind(current.draft) !== "SCENES")
      throw new Error("This Scene is no longer available.");
    if (draftRef.current?.content.definitionId === id) {
      if (current.revision !== revision.current)
        throw new Error("This Scene changed in another editor. Review its saved revision before updating.");
      return draftRef.current;
    }
    install(current.draft, current.revision, true);
    setPreview("EDITOR");
    return current.draft;
  };
  const managerEditEnvironment = async (record: CompatibleEnvironmentRecord, returnToManager = true) => {
    await persist();
    returnToSceneManager.current = returnToManager;
    setManagerEnvironmentId(record.id);
    if (record.representation === "LIFECYCLE_V1") {
      const data = await load();
      const current = data.environments?.find((item) => item.id === record.id && !item.archived);
      if (!current) throw new Error("This Environment is no longer available.");
      setLegacyEnvironmentRecord(null);
      setEnvironmentRecord(current);
      return;
    }
    let opened: LegacyEnvironmentWorkspaceState;
    if (record.builtin) {
      const source = latestEnvironmentVersion(record);
      if (!source) throw new Error("Choose an immutable Environment source.");
      const key = JSON.stringify(source.reference);
      if (managerLegacyCopyOperation.current?.key !== key)
        managerLegacyCopyOperation.current = {
          key,
          body: {
            action: "LEGACY_ENVIRONMENT_COPY",
            source: source.reference,
            newId: crypto.randomUUID(),
            operationId: crypto.randomUUID(),
            name: ("content" in source ? source.content.name : record.id).slice(0, 155) + " copy",
            destination: "WORKING",
          },
        };
      opened = legacyWorkspaceState(await api(managerLegacyCopyOperation.current.body));
      managerLegacyCopyOperation.current = null;
    } else {
      const records = await refreshEnvironmentCatalog();
      const current = records?.find((item) => item.id === record.id && !item.archived);
      if (!current || current.representation !== "SC01_SCHEMA1" || current.builtin)
        throw new Error("This Environment is no longer available.");
      opened = legacyWorkspaceState(
        await api({
          action: "LEGACY_ENVIRONMENT_BEGIN",
          definitionId: current.id,
          revision: current.revision,
          operationId: crypto.randomUUID(),
        }),
      );
    }
    setManagerEnvironmentId(opened.working.id);
    setEnvironmentRecord(null);
    setLegacyEnvironmentRecord(opened);
  };
  const managerDuplicateScene = async (sourceId: string, title: string, description?: string) => {
    await persist();
    const data = await load();
    const source = data.items.find((item) => item.id === sourceId && !item.archived);
    if (!source || spatialLibraryKind(source.draft) !== "SCENES")
      throw new Error("This source Scene is no longer available.");
    const key = JSON.stringify([sourceId, title, description ?? null]);
    if (managerDuplicateOperation.current?.key !== key)
      managerDuplicateOperation.current = {
        key,
        body: {
          action: "SAVE_AS",
          definitionId: sourceId,
          revision: source.revision,
          newId: crypto.randomUUID(),
          operationId: crypto.randomUUID(),
          name: title,
          destination: "WORKING",
          type: "SCENE",
          ...(description
            ? {
                retainedSnapshot: {
                  ...source.draft,
                  content: { ...source.draft.content, sceneDescription: description },
                },
              }
            : {}),
        },
      };
    let result: { definitionId: string; revision: number };
    try {
      result = await api(managerDuplicateOperation.current.body);
    } catch (cause) {
      if (cause && typeof cause === "object" && "status" in cause && cause.status === 409)
        managerDuplicateOperation.current = null;
      throw cause;
    }
    const updated = await load();
    const copy = updated.items.find((item) => item.id === result.definitionId && !item.archived);
    if (!copy) throw new Error("The copied Scene is unavailable. Review its Library entry before trying again.");
    install(copy.draft, copy.revision, true);
    setPreview("EDITOR");
    managerDuplicateOperation.current = null;
    return copy.draft;
  };
  const managerUpdateEnvironment = async (id: string, target: SceneEnvironmentVersion) => {
    const current = await managerOpenScene(id);
    const reviewed = updateSceneEnvironmentVersion(current, target);
    const result =
      "room" in target
        ? await api({
            action: "ENVIRONMENT_USE",
            draft: current,
            revision: revision.current,
            definitionId: target.reference.environmentId,
            versionId: target.reference.versionId,
          })
        : await api({ action: "SAVE", draft: reviewed, revision: revision.current });
    const next = "room" in target ? draftSchema.parse(result.draft) : reviewed;
    revision.current = result.revision;
    setSavedRevision(result.revision);
    savedJson.current = JSON.stringify(next);
    setSavedSceneSnapshot(JSON.stringify(next));
    writeHistory(changeHistory(historyRef.current!, { type: "REPLACE", draft: next }));
    setEnvironment(next.content.studio?.environment?.id ?? next.content.environment?.environmentId ?? "bedroom");
    await load();
    setStatus("Working Scene updated to the reviewed Environment version");
    return next;
  };
  const applyRoomProposal = async (base: RoomPhotoBase, proposal: RoomPerceptionProposal, newEnvironment = false) => {
    await persist();
    if (base.editorGeneration !== generation.current || !historyRef.current)
      throw new Error("The scene changed. Review a new room proposal.");
    setBusy(true);
    const operation = (async () => {
      const response = await fetch("/api/studio/parallax/room-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf.current },
        body: JSON.stringify({ action: "APPLY", ...base, proposal }),
      });
      const saved = await response.json();
      if (!response.ok) throw new Error(saved.error ?? "The room could not be saved.");
      if (
        generation.current !== base.editorGeneration ||
        (!newEnvironment && draftRef.current?.content.definitionId !== base.draft.content.definitionId)
      )
        throw new Error("The saved room belongs to an earlier scene state. Reopen it from Saved to review the result.");
      const next = draftSchema.parse(saved.draft);
      if (newEnvironment) install(next, saved.revision, true);
      else {
        revision.current = saved.revision;
        setSavedRevision(saved.revision);
        savedJson.current = JSON.stringify(next);
        setSavedSceneSnapshot(JSON.stringify(next));
        writeHistory(changeHistory(historyRef.current!, { type: "REPLACE", draft: next }));
      }
      setFindings(null);
      setEnvironment(next.content.studio!.environment!.id);
      if (newEnvironment) {
        setRoomEditing(true);
        setPreview("EDITOR");
        setInspectorOpen(true);
      }
      await load();
      setStatus("Reviewed room geometry saved");
    })();
    saving.current = operation;
    try {
      await operation;
    } finally {
      if (saving.current === operation) saving.current = null;
      setBusy(false);
    }
  };
  const restoreAttachment = (change: AttachmentChange, direction: "UNDO" | "REDO") =>
    void action(async () => {
      const current = await load();
      if (!current.chronicle) throw new Error("Chronicle unavailable.");
      const expected = direction === "UNDO" ? change.after : change.before;
      const actual = current.chronicle.blocks.find((b) => b.id === change.blockId)?.spatialMoment ?? null;
      if (JSON.stringify(actual) !== JSON.stringify(expected))
        throw new Error("This attachment changed. Reopen its current version before editing history.");
      await api({
        action: "RESTORE_ATTACHMENT",
        chronicleId: current.chronicle.id,
        blockId: change.blockId,
        autosaveVersion: current.chronicle.autosaveVersion,
        moment: direction === "UNDO" ? change.before : change.after,
      });
      await load();
      if (direction === "UNDO") {
        setAttachmentPast(attachmentPast.slice(0, -1));
        setAttachmentFuture([...attachmentFuture, change]);
      } else {
        setAttachmentPast([...attachmentPast, change]);
        setAttachmentFuture(attachmentFuture.slice(0, -1));
      }
      setStatus(direction === "UNDO" ? "Spatial attachment undone" : "Spatial attachment redone");
    });
  const currentEntity = draft?.content.entities.find((e) => e.id === selected);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const selectedRoomFeatureRecord = draft?.content.studio?.environment?.features.find(
    (feature) => feature.id === selectedRoomFeature,
  );
  const selectedRoomSurface = Boolean(
    selectedRoomFeatureRecord && ["FLOOR", "WALL", "CEILING"].includes(selectedRoomFeatureRecord.classification),
  );
  const finishRoomEditing = () => {
    setRoomEditing(false);
    setSelectedRoomFeature(null);
    setSelected(null);
  };
  const startRoomEditing = () => {
    if (!draft || busy) return;
    if (draft.content.environment) {
      if (!draft.content.studio?.environment) {
        setError(
          "This legacy Environment has no editable room geometry. Create an independent Environment from Library before editing its room features.",
        );
        return;
      }
      void action(async () => {
        await persist();
        const data = await load();
        const entry = libraryEntries(data.items).find((e) => e.id === draft.content.definitionId);
        if (!entry) throw new Error("Reopen the saved Scene before copying its Environment.");
        setLibraryDialog({
          entry,
          mode: "SAVE_AS",
          targetType: "ENVIRONMENT",
          guidance:
            "This Scene keeps its released Environment unchanged. Save an independent Environment copy to edit; you can review and use a new version afterward.",
        });
      });
      return;
    }
    if (!draft.content.studio?.environment || environment !== draft.content.studio.environment.id) {
      const next = structuredClone(draft);
      next.content.studio ??= emptyStudioContent();
      next.content.studio.environment = enableRoomExclusions(createRoomEnvironment(previewEnvironment));
      replace(next);
      setEnvironment(next.content.studio.environment.id);
    } else if (!draft.content.studio.environment.exclusionZonesEnabled) {
      const next = structuredClone(draft);
      next.content.studio!.environment = enableRoomExclusions(next.content.studio!.environment!);
      replace(next);
    }
    setSelected(null);
    setPlaying(false);
    setPreview("EDITOR");
    setInspectorView("PROPERTIES");
    setInspectorOpen(true);
    setRoomEditing(true);
  };
  const selectedGroup = draft?.content.studio?.editingGroups?.find((group) => group.id === selectedGroupId);
  const selectionMembers = useMemo(
    () =>
      (selectedGroup?.members ?? selectionItems).filter((member) =>
        member.kind === "ASSET"
          ? draft?.content.entities.some((entity) => entity.id === member.id)
          : draft?.content.studio?.environment?.features.some((feature) => feature.id === member.id),
      ),
    [selectedGroup, selectionItems, draft?.content],
  );
  const groupActive = Boolean(selectedGroup) || selectionMembers.length > 1;
  const previewEntity = (assistantScenePreview ?? placementPreview)?.content.entities.find(
    (entity) => entity.id === selected,
  );
  const missingRoomFeature = Boolean(selectedRoomFeature && !selectedRoomFeatureRecord);
  const selectionDetailsOnly =
    missingRoomFeature || Boolean(selected && !currentEntity && !groupActive && !selectedRoomFeature && !roomEditing);
  const activeInspectorView: InspectorView | "INVALID" | "PREVIEW" = missingRoomFeature
    ? inspectorView === "SCENE"
      ? "SCENE"
      : "INVALID"
    : currentEntity || groupActive || selectedRoomFeature || roomEditing
      ? inspectorView
      : selected
        ? inspectorView === "SCENE"
          ? "SCENE"
          : previewEntity
            ? "PREVIEW"
            : "INVALID"
        : "SCENE";
  useLayoutEffect(() => {
    const panel = inspectorPanelRef.current;
    if (!inspectorOpen || !panel) return;
    panel.scrollTop = 0;
    const frame = window.requestAnimationFrame?.(() => {
      panel.scrollTop = 0;
    });
    return () => {
      if (frame !== undefined) window.cancelAnimationFrame(frame);
    };
  }, [activeInspectorView, inspectorOpen, mode, selected, selectedRoomFeature, selectedGroupId]);
  const settleInspectorAfterRailKey = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const panel = inspectorPanelRef.current;
    if (!panel) return;
    panel.scrollTop = 0;
    window.requestAnimationFrame?.(() => {
      if (inspectorPanelRef.current === panel) panel.scrollTop = 0;
    });
  };
  const requestCanvasCommand = (kind: CanvasCommand["kind"], tool?: CanvasCommand["tool"]) => {
    setPreview("EDITOR");
    setCanvasCommand((previous) => ({ sequence: (previous?.sequence ?? 0) + 1, kind, tool }));
  };
  const selectionKeys = new Set(selectionMembers.map(groupMemberKey));
  const groupingDisabled =
    busy || preview !== "EDITOR" || Boolean(roomScenePreview || assistantScenePreview || placementPreview);
  const selectionAnchor = useRef<string | null>(null);
  const graphOrder = useSceneGraphOrder(groupingDisabled, (category, ids) => {
    if (!draft) return;
    const next = structuredClone(draft);
    const order = <T extends { id: string }>(items: T[]) => {
      const visible = new Map(ids.map((id, index) => [id, index]));
      const reordered = items
        .filter((item) => visible.has(item.id))
        .sort((a, b) => visible.get(a.id)! - visible.get(b.id)!);
      let cursor = 0;
      return items.map((item) => (visible.has(item.id) ? reordered[cursor++] : item));
    };
    if (category === "ASSET") next.content.entities = order(next.content.entities);
    else if (category === "GROUP") next.content.studio!.editingGroups = order(next.content.studio!.editingGroups ?? []);
    else if (roomEditing && next.content.studio?.environment)
      next.content.studio.environment.features = order(next.content.studio.environment.features);
    else return;
    replace(next);
    setStatus("Scene Graph order updated. Undo is available.");
  });
  const selectAsset = (id: string, modifiers: SelectionModifiers = {}) => {
    setInspectorTransformPreview(null);
    setInspectorView("PROPERTIES");
    setSelectedRoomFeature(null);
    const member = { kind: "ASSET" as const, id };
    const range =
      modifiers.range && selectionAnchor.current
        ? draft?.content.entities.filter((entity) => entity.name.toLowerCase().includes(sceneQuery.toLowerCase()))
        : null;
    if (range) {
      const a = range.findIndex((entity) => entity.id === selectionAnchor.current),
        b = range.findIndex((entity) => entity.id === id);
      if (a >= 0 && b >= 0) {
        setSelectionItems(
          range.slice(Math.min(a, b), Math.max(a, b) + 1).map((entity) => ({ kind: "ASSET", id: entity.id })),
        );
        setSelectedGroupId(null);
        setSelectedState(id);
        return;
      }
    }
    if (modifiers.additive || modifiers.range) {
      setSelectionItems(
        selectionKeys.has(groupMemberKey(member))
          ? selectionMembers.filter((item) => groupMemberKey(item) !== groupMemberKey(member))
          : [...selectionMembers, member],
      );
      setSelectedGroupId(null);
      setSelectedState(id);
    } else {
      setSelected(id);
    }
    selectionAnchor.current = id;
  };
  const selectRoomFeature = (id: string, modifiers: SelectionModifiers = {}) => {
    setInspectorTransformPreview(null);
    setInspectorView("PROPERTIES");
    const member = { kind: "ROOM_FEATURE" as const, id };
    const rows =
      draft?.content.studio?.environment?.features.filter((feature) =>
        feature.name.toLowerCase().includes(sceneQuery.toLowerCase()),
      ) ?? [];
    const a = rows.findIndex((feature) => feature.id === selectionAnchor.current),
      b = rows.findIndex((feature) => feature.id === id);
    setSelectedRoomFeature(id);
    setSelectedGroupId(null);
    setRoomEditing(true);
    setSelectedState(null);
    setSelectionItems(
      modifiers.range && a >= 0 && b >= 0
        ? rows.slice(Math.min(a, b), Math.max(a, b) + 1).map((feature) => ({ kind: "ROOM_FEATURE", id: feature.id }))
        : modifiers.additive || modifiers.range
          ? selectionKeys.has(groupMemberKey(member))
            ? selectionMembers.filter((item) => groupMemberKey(item) !== groupMemberKey(member))
            : [...selectionMembers, member]
          : [member],
    );
    if (!modifiers.range) selectionAnchor.current = id;
    setInspectorOpen(true);
  };
  const selectGroup = (group: EditingGroup, modifiers: SelectionModifiers = {}) => {
    setInspectorTransformPreview(null);
    setInspectorView("PROPERTIES");
    if (modifiers.additive || modifiers.range) {
      const allSelected = group.members.every((member) => selectionKeys.has(groupMemberKey(member)));
      const keys = new Set(group.members.map(groupMemberKey));
      setSelectionItems(
        allSelected
          ? selectionMembers.filter((member) => !keys.has(groupMemberKey(member)))
          : [...selectionMembers.filter((member) => !keys.has(groupMemberKey(member))), ...group.members],
      );
      setSelectedGroupId(null);
    } else {
      setSelectedGroupId(group.id);
      setSelectionItems(group.members);
    }
    if (group.members.some((member) => member.kind === "ROOM_FEATURE")) {
      if (!roomEditing) setStatus("Enable environment editing before changing room features in this group.");
      setEnvironment(draft!.content.studio!.environment!.id);
      setSelectedRoomFeature(group.members.find((member) => member.kind === "ROOM_FEATURE")!.id);
    } else {
      setRoomEditing(false);
      setSelectedRoomFeature(null);
    }
    setSelectedState(group.members.find((member) => member.kind === "ASSET")?.id ?? null);
    setInspectorOpen(true);
  };
  const saveGroup = (group: EditingGroup, creating = false) => {
    if (!draft || groupingDisabled) return;
    try {
      const previous = draft.content.studio?.editingGroups?.find((item) => item.id === group.id);
      const roomKeys = (items: readonly EditingGroupMember[]) =>
        items
          .filter((item) => item.kind === "ROOM_FEATURE")
          .map(groupMemberKey)
          .sort()
          .join("\0");
      if (!roomEditing && roomKeys(previous?.members ?? []) !== roomKeys(group.members))
        throw new Error("Enable environment editing before changing room feature membership.");
      replace(saveEditingGroup(draft, group, creating));
      setGroupDialog(null);
      selectGroup(group);
      setGraphTab("GROUPINGS");
      openLeftTab("HIERARCHY");
      setStatus(`${group.name} saved · ${group.members.length} items. Undo is available.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The group could not be saved.");
      throw cause;
    }
  };
  const startGrouping = () => {
    if (!draft || groupingDisabled) return;
    if (selectedGroup) {
      setGroupDialog({ group: selectedGroup, creating: false });
      return;
    }
    let number = 1;
    while (draft.content.studio?.editingGroups?.some((group) => group.name === `Group ${number}`)) number++;
    const group: EditingGroup = {
      id: `group-${crypto.randomUUID()}`,
      name: `Group ${number}`,
      members: selectionMembers,
    };
    if (selectionMembers.length >= 2) {
      try {
        saveGroup(group, true);
      } catch {
        /* Host feedback. */
      }
    } else setGroupDialog({ group, creating: true });
  };
  const ungroupSelection = () => {
    if (!draft || groupingDisabled) return;
    try {
      const groups = selectedGroup
        ? [selectedGroup]
        : (draft.content.studio?.editingGroups ?? []).filter((group) =>
            group.members.every((member) => selectionKeys.has(groupMemberKey(member))),
          );
      let next = draft;
      for (const group of groups) next = ungroupEditingGroup(next, group.id);
      replace(next);
      setSelectedGroupId(null);
      setSelectionItems(selectionMembers);
      setStatus("Items ungrouped. Their positions and existing attachments are unchanged.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The grouping could not be removed.");
    }
  };
  const transformSelection = (delta: Transform, pivot?: Transform["position"]) => {
    if (!draft || groupingDisabled) return;
    try {
      if (!roomEditing && selectionMembers.some((member) => member.kind === "ROOM_FEATURE"))
        throw new Error("Enable environment editing before transforming room features.");
      replace(transformEditingSelection(draft, selectionMembers, delta, environment, pivot));
      setStatus("Selection transformed together. Undo is available.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The group transform could not be applied.");
      throw cause;
    }
  };
  const groupActions = (group: EditingGroup): StudioMenuAction[] => [
    { label: "Select group", icon: "group", run: () => selectGroup(group) },
    {
      label: "Rename group",
      icon: "rename",
      disabled: groupingDisabled,
      run: () => setGroupDialog({ group, creating: false }),
    },
    {
      label: "Edit group members",
      icon: "inspect",
      disabled: groupingDisabled,
      run: () => setGroupDialog({ group, creating: false }),
    },
    ...(["Move", "Rotate", "Scale"] as const).map((label) => ({
      label: `${label} group`,
      icon: label === "Move" ? ("move" as const) : label === "Rotate" ? ("rotate" as const) : ("scale" as const),
      disabled: groupingDisabled || (!roomEditing && group.members.some((member) => member.kind === "ROOM_FEATURE")),
      run: () => {
        selectGroup(group);
        requestAnimationFrame(() =>
          studioElement.current?.querySelector<HTMLButtonElement>(`[aria-label="${label} tool"]`)?.click(),
        );
      },
    })),
    {
      label: "Frame group",
      icon: "frame",
      run: () => {
        selectGroup(group);
        requestAnimationFrame(() =>
          studioElement.current?.querySelector<HTMLButtonElement>('[aria-label="Frame selection"]')?.click(),
        );
      },
    },
    {
      label: "Ungroup items",
      icon: "group",
      disabled: groupingDisabled,
      run: () => {
        if (draft) {
          replace(ungroupEditingGroup(draft, group.id));
          setSelectedGroupId(null);
          setSelectionItems(group.members);
          setStatus("Group removed; items retained.");
        }
      },
    },
  ];
  const selectionActions = (members: readonly EditingGroupMember[], group?: EditingGroup): StudioMenuAction[] => {
    const ids = members.filter((member) => member.kind === "ASSET").map((member) => member.id);
    const layers = draft?.content.studio?.layers ?? [];
    const hidden = ids.length > 0 && ids.every((id) => layers.some((layer) => layer.entityId === id && !layer.visible));
    const locked = ids.length > 0 && ids.every((id) => layers.some((layer) => layer.entityId === id && layer.locked));
    const layerEdit = (patch: { visible?: boolean; locked?: boolean }) => {
      if (!draft || groupingDisabled) return;
      try {
        let next = draft;
        for (const id of ids) next = editSpatialDraft(next, { type: "LAYER", entityId: id, patch });
        replace(next);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Selection could not be changed.");
      }
    };
    return [
      ...(group
        ? groupActions(group)
        : [{ label: "Group selected items", icon: "group" as const, disabled: groupingDisabled, run: startGrouping }]),
      ...(ids.length
        ? [
            {
              label: hidden ? "Show selected assets" : "Hide selected assets",
              icon: hidden ? ("eyeOff" as const) : ("eye" as const),
              disabled: groupingDisabled,
              run: () => layerEdit({ visible: hidden }),
            },
            {
              label: locked ? "Unlock selected assets" : "Lock selected assets",
              icon: locked ? ("lock" as const) : ("unlock" as const),
              disabled: groupingDisabled,
              run: () => layerEdit({ locked: !locked }),
            },
          ]
        : []),
    ];
  };
  const roomFeatureActions = (id: string): StudioMenuAction[] => {
    const inspect = () => {
      selectRoomFeature(id, { individual: true });
      setInspectorOpen(true);
    };
    if (!selectedGroup && groupActive && selectionKeys.has(`ROOM_FEATURE:${id}`))
      return [
        ...selectionActions(selectionMembers),
        { label: "Inspect individual feature", icon: "inspect", run: inspect },
      ];
    return [
      { label: "Inspect feature", icon: "inspect", run: inspect },
      ...(["Move", "Rotate", "Scale"] as const).map((label) => ({
        label: `${label} feature`,
        icon: label === "Move" ? ("move" as const) : label === "Rotate" ? ("rotate" as const) : ("scale" as const),
        disabled: groupingDisabled,
        run: () => {
          selectRoomFeature(id, { individual: true });
          requestAnimationFrame(() =>
            studioElement.current?.querySelector<HTMLButtonElement>(`[aria-label="${label} tool"]`)?.click(),
          );
        },
      })),
      { label: "Group selected items", icon: "group", disabled: groupingDisabled, run: startGrouping },
    ];
  };
  const editableRoomId = draft?.content.studio?.environment?.id;
  useEffect(() => {
    if (!roomEditing || groupActive || !inspectorOpen || !editableRoomId) return;
    const frame = requestAnimationFrame(() => {
      const panel = studioElement.current?.querySelector<HTMLDetailsElement>("[data-room-editor]");
      if (panel) {
        panel.open = true;
        panel.scrollIntoView({ block: "nearest" });
        panel.querySelector<HTMLSelectElement>('[aria-label="Room feature"]')?.focus({ preventScroll: true });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [roomEditing, groupActive, inspectorOpen, editableRoomId]);
  const renameObject = (id: string) => {
    setSelected(id);
    openLeftTab("HIERARCHY");
    setRenamingId(id);
  };
  const objectActions = (id: string): StudioMenuAction[] => {
    const entity = draft?.content.entities.find((entity) => entity.id === id);
    if (!draft || !entity) return [];
    const layer = draft.content.studio?.layers.find((layer) => layer.entityId === id);
    const unavailable =
      busy || preview !== "EDITOR" || Boolean(roomScenePreview || assistantScenePreview || placementPreview);
    const locked = layer?.locked ?? false;
    const inspect = (sections: WorkspaceLayout["expandedInspector"] = ["overview"]) => {
      setSelected(id);
      setInspectorView(
        sections.includes("reuse")
          ? "SCENE"
          : sections.includes("placement") || sections.includes("behavior")
            ? "CONTEXT"
            : "PROPERTIES",
      );
      setInspectorOpen(true);
    };
    if (!selectedGroup && groupActive && selectionKeys.has(`ASSET:${id}`))
      return [
        ...selectionActions(selectionMembers),
        { label: "Inspect individual object", icon: "inspect", run: () => inspect() },
        {
          label: "Rename individual object",
          icon: "rename",
          disabled: unavailable || locked,
          run: () => renameObject(id),
        },
      ];
    return [
      { label: "Group selected items", icon: "group", disabled: groupingDisabled, run: startGrouping },
      { label: "Inspect object", icon: "inspect", run: () => inspect() },
      { label: "Rename object", icon: "rename", disabled: unavailable || locked, run: () => renameObject(id) },
      {
        label: "Frame object",
        icon: "frame",
        run: () => {
          setSelected(id);
          requestAnimationFrame(() =>
            studioElement.current?.querySelector<HTMLButtonElement>('[aria-label="Frame selection"]')?.click(),
          );
        },
      },
      {
        label: layer?.visible === false ? "Show object" : "Hide object",
        icon: layer?.visible === false ? "eyeOff" : "eye",
        disabled: unavailable,
        run: () => edit({ type: "LAYER", entityId: id, patch: { visible: layer?.visible === false } }),
      },
      {
        label: locked ? "Unlock object" : "Lock object",
        icon: locked ? "lock" : "unlock",
        disabled: unavailable,
        run: () => edit({ type: "LAYER", entityId: id, patch: { locked: !locked } }),
      },
      {
        label: "Duplicate object",
        icon: "copy",
        disabled: unavailable || locked || draft.content.studio?.libraryDefinition?.rootEntityId === id,
        run: () => {
          const newId = crypto.randomUUID();
          edit({ type: "DUPLICATE", entityId: id, newId });
          setSelected(newId);
        },
      },

      ...(
        [
          ["Move object", "move", "Move tool"],
          ["Rotate object", "rotate", "Rotate tool"],
          ["Scale object", "scale", "Scale tool"],
        ] as const
      ).map(([label, icon, tool]) => ({
        label,
        icon,
        disabled: unavailable || locked,
        run: () => {
          setSelected(id);
          requestAnimationFrame(() =>
            studioElement.current?.querySelector<HTMLButtonElement>(`[aria-label="${tool}"]`)?.click(),
          );
        },
      })),
      { label: "Save as reusable asset", icon: "save", disabled: unavailable || locked, run: () => inspect(["reuse"]) },
      { label: "Edit placement", icon: "surface", run: () => inspect(["placement"]) },
      {
        label: "Edit animation",
        icon: "rotate",
        run: () => {
          setSelected(id);
          openBottomTab("TIMELINE");
        },
      },
      { label: "Edit behavior", icon: "move", run: () => inspect(["behavior"]) },
      {
        label: "Move layer up",
        icon: "up",
        disabled: unavailable || locked || draft.content.entities[0].id === id,
        run: () => edit({ type: "REORDER", entityId: id, offset: -1 }),
      },
      {
        label: "Move layer down",
        icon: "down",
        disabled: unavailable || locked || draft.content.entities.at(-1)?.id === id,
        run: () => edit({ type: "REORDER", entityId: id, offset: 1 }),
      },
      ...(entity.parentEntityId
        ? [
            {
              label: "Ungroup object",
              icon: "unlock" as const,
              disabled: unavailable || locked || Boolean(draft.content.adaptive),
              run: () => edit({ type: "PARENT", entityId: id, parentId: null }),
            },
          ]
        : []),
      {
        label: "Remove object",
        icon: "trash",
        danger: true,
        disabled:
          unavailable ||
          locked ||
          draft.content.entities.length < 2 ||
          draft.content.entities.some((child) => child.parentEntityId === id) ||
          draft.content.studio?.libraryDefinition?.rootEntityId === id,
        run: () => edit({ type: "DELETE", entityId: id }),
      },
    ];
  };
  const graphLayer = draft?.content.studio?.layers.find((layer) => layer.entityId === selected);
  const selectedAssetIds = selectionMembers.filter((member) => member.kind === "ASSET").map((member) => member.id);
  const allSelectionHidden =
    selectedAssetIds.length > 0 &&
    selectedAssetIds.every((id) =>
      draft?.content.studio?.layers.some((layer) => layer.entityId === id && !layer.visible),
    );
  const allSelectionLocked =
    selectedAssetIds.length > 0 &&
    selectedAssetIds.every((id) =>
      draft?.content.studio?.layers.some((layer) => layer.entityId === id && layer.locked),
    );
  const multiGraphToolbarActions = [
    {
      label: allSelectionHidden ? "Show selected assets" : "Hide selected assets",
      icon: allSelectionHidden ? "eyeOff" : "eye",
      disabled: groupingDisabled || !selectedAssetIds.length,
    },
    {
      label: allSelectionLocked ? "Unlock selected assets" : "Lock selected assets",
      icon: allSelectionLocked ? "lock" : "unlock",
      disabled: groupingDisabled || !selectedAssetIds.length,
    },
  ] as const;
  const unavailable =
    !currentEntity ||
    busy ||
    preview !== "EDITOR" ||
    Boolean(roomScenePreview || assistantScenePreview || placementPreview);
  const graphToolbarActions = [
    { label: "Rename object", icon: "rename", disabled: unavailable || Boolean(graphLayer?.locked) },
    {
      label: graphLayer?.visible === false ? "Show object" : "Hide object",
      icon: graphLayer?.visible === false ? "eyeOff" : "eye",
      disabled: unavailable,
    },
    {
      label: graphLayer?.locked ? "Unlock object" : "Lock object",
      icon: graphLayer?.locked ? "lock" : "unlock",
      disabled: unavailable,
    },
    {
      label: "Duplicate object",
      icon: "copy",
      disabled:
        unavailable ||
        Boolean(graphLayer?.locked) ||
        draft?.content.studio?.libraryDefinition?.rootEntityId === selected,
    },
    {
      label: "Remove object",
      icon: "trash",
      disabled:
        unavailable ||
        Boolean(graphLayer?.locked) ||
        (draft?.content.entities.length ?? 0) < 2 ||
        draft?.content.entities.some((entity) => entity.parentEntityId === selected) ||
        draft?.content.studio?.libraryDefinition?.rootEntityId === selected,
    },
  ] as const;
  const record = loaded?.items.find((i) => i.id === draft?.content.definitionId);
  const releases = record?.releases ?? [];
  const localFindings = useMemo(
    () => (draft ? (findings ?? validateSpatialAuthoring(draft.content)) : []),
    [draft, findings],
  );
  const environmentPreviews = useMemo(
    () => (draft && validationOpen ? simulateSpatialEnvironments(draft.content) : []),
    [draft, validationOpen],
  );
  const boundSurfaces = useMemo(() => (draft ? boundRoomSurfaceIds(draft.content) : []), [draft]);
  const chooseRelease = (version: SpatialVersion) => {
    setReleaseId(version.id);
  };
  const updateEntity = (
    patch: Partial<
      Pick<NonNullable<typeof currentEntity>, "name" | "content" | "alternativeText" | "widthMeters" | "interactions">
    >,
  ) => {
    if (currentEntity) edit({ type: "CONTENT", entityId: currentEntity.id, patch });
  };
  const updateTransform = (change: (previous: Transform) => Transform) => {
    const latestEntity = historyRef.current?.present.content.entities.find((entity) => entity.id === currentEntity?.id);
    if (latestEntity) edit({ type: "TRANSFORM", entityId: latestEntity.id, transform: change(latestEntity.transform) });
  };
  const previewTransform = (change: (previous: Transform) => Transform) => {
    const latest = historyRef.current?.present;
    if (!latest || !currentEntity) return;
    setInspectorTransformPreview({
      ...latest,
      content: {
        ...latest.content,
        entities: latest.content.entities.map((entity) =>
          entity.id === currentEntity.id ? { ...entity, transform: change(entity.transform) } : entity,
        ),
      },
    });
  };
  const rotationAngles = currentEntity ? rotationEuler(currentEntity.transform) : new Euler(0, 0, 0, "YXZ");
  const rotationDegrees = (rotationAngles.y * 180) / Math.PI;
  const elementKind = currentEntity?.element?.kind;
  const selectedLight = currentEntity?.element?.kind === "LIGHT" ? currentEntity.element : null;
  const isAmbientLight = selectedLight?.type === "AMBIENT";
  const isOmnidirectionalOutput = elementKind === "SPATIAL_AUDIO" || selectedLight?.type === "POINT";
  const hasRenderedWidth =
    !elementKind ||
    elementKind === "PHYSICAL_ASSET" ||
    elementKind === "PROJECTED_EFFECT" ||
    elementKind === "SPATIAL_PHENOMENON";
  const hasVisualScale = elementKind !== "LIGHT" && elementKind !== "SPATIAL_AUDIO";
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (environmentRecord || legacyEnvironmentRecord || (event.target as HTMLElement)?.closest?.("dialog")) return;
      if ((event.target as HTMLElement)?.closest?.('[role="menu"]')) return;
      const field =
        event.target instanceof HTMLElement &&
        (event.target.matches("input,textarea,select") || event.target.isContentEditable);
      if (event.key === "Escape") {
        if (assistantOpen) {
          setAssistantTaskResetVersion((version) => version + 1);
          setAssistantOpen(false);
          setAssistantScenePreview(null);
          setAssistantHighlights([]);
          setPlacementPreview(null);
          queueMicrotask(() =>
            document.querySelector<HTMLButtonElement>('[aria-controls="parallax-assistance"]')?.focus(),
          );
        } else if (innerWidth < 1100) {
          setLibraryOpen(false);
          setInspectorOpen(false);
          queueMicrotask(() =>
            document.querySelector<HTMLButtonElement>('[aria-label="Open scene settings"]')?.focus(),
          );
        }
      }
      if (field) return;
      if (event.key === "/" && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        setAssistantOpen(true);
        queueMicrotask(() => document.querySelector<HTMLTextAreaElement>("#parallax-assistance textarea")?.focus());
      }
      if ((event.ctrlKey || event.metaKey) && event.key === "\\") {
        event.preventDefault();
        chooseWorkspace(layout.preset === "FOCUS" ? "SPATIAL" : "FOCUS");
      }
      if (history && !busy && (event.ctrlKey || event.metaKey) && ["z", "y"].includes(event.key.toLowerCase())) {
        event.preventDefault();
        writeHistory(
          event.key.toLowerCase() === "y" || event.shiftKey ? redo(historyRef.current!) : undo(historyRef.current!),
        );
        setFindings(null);
        setPlacementPreview(null);
      }
    };
    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
  });
  const closeManagedEnvironment = async () => {
    const id = environmentRecord?.id ?? legacyEnvironmentRecord?.working.id;
    setEnvironmentRecord(null);
    setLegacyEnvironmentRecord(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("environment");
    window.history.replaceState(window.history.state, "", url.pathname + url.search);
    if (!draftRef.current) install(fresh(chronicleId), 0, false);
    await load();
    await refreshEnvironmentCatalog();
    if (returnToSceneManager.current) {
      setManagerEnvironmentId(id);
      setSceneManagerOpen(true);
      returnToSceneManager.current = false;
    }
  };
  if (legacyEnvironmentRecord && loaded)
    return (
      <LegacyEnvironmentWorkspace
        key={legacyEnvironmentRecord.working.id}
        initial={legacyEnvironmentRecord}
        accountId={loaded.layoutScope ?? ""}
        api={api}
        onClose={closeManagedEnvironment}
        onRefresh={async () => {
          const records = await refreshEnvironmentCatalog();
          const current = records?.find(
            (record) => record.id === legacyEnvironmentRecord.working.id && !record.archived,
          );
          if (!current || current.representation !== "SC01_SCHEMA1" || current.builtin)
            throw new Error("This Environment is unavailable. Restore it from Library before editing.");
          return legacyWorkspaceState(
            await api({
              action: "LEGACY_ENVIRONMENT_BEGIN",
              definitionId: current.id,
              revision: current.revision,
              operationId: crypto.randomUUID(),
            }),
          );
        }}
      />
    );
  if (environmentRecord && loaded)
    return (
      <EnvironmentDefinitionWorkspace
        key={environmentRecord.id}
        record={environmentRecord}
        accountId={loaded.layoutScope ?? ""}
        api={api}
        csrfToken={() => csrf.current}
        environments={loaded.environments ?? []}
        onRefresh={async () => {
          const data = await load();
          return data.environments ?? [];
        }}
        onClose={closeManagedEnvironment}
      />
    );
  if (!draft || !loaded)
    return (
      <main className={styles.studio}>
        <Link href="/studio/library">Chronicle Library</Link>
        <h1>Parallax Spatial Studio</h1>
        {error ? <p role="alert">{error}</p> : <p role="status">{status}</p>}
        <button
          onClick={() =>
            void action(async () => {
              initialized.current = false;
              const data = await load(undefined, true);
              install(data.items[0]?.draft ?? fresh(chronicleId), data.items[0]?.revision ?? 0, Boolean(data.items[0]));
            })
          }
        >
          Try again
        </button>
      </main>
    );
  const headerMenuActions: StudioMenuAction[] = [
    {
      label: "Save draft",
      icon: "save",
      disabled: busy,
      run: () =>
        void action(async () => {
          await persist();
          setStatus("Working draft saved");
        }),
    },
    {
      label: "New scene",
      icon: "plus",
      disabled: busy,
      run: () => {
        if (spatialLibraryKind(draft) === "SCENES") setSceneManagerOpen(true);
        else
          void action(async () => {
            await persist();
            install(fresh(chronicleId), 0, false);
            setSceneManagerOpen(true);
          });
      },
    },
    { label: "Open saved scenes", icon: "inspect", run: () => openLeftTab("SAVED") },
    { label: "Reset workspace layout", icon: "reset", run: resetWorkspace },
  ];
  return (
    <main
      ref={studioElement}
      onKeyDown={(event) => {
        if ((event.target as HTMLElement).closest("input,textarea,select,[contenteditable=true]")) return;
        if ((event.target as HTMLElement).closest('[role="menu"]')) return;
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "g") {
          event.preventDefault();
          if (event.shiftKey) ungroupSelection();
          else startGrouping();
        } else if (
          (event.ctrlKey || event.metaKey) &&
          event.key.toLowerCase() === "a" &&
          (event.target as HTMLElement).closest('[aria-label="Scene graph"]')
        ) {
          event.preventDefault();
          setSelectedGroupId(null);
          const roomList = (event.target as HTMLElement).closest('[aria-label="Room feature selection"]');
          setSelectionItems(
            graphTab === "GROUPINGS"
              ? (draft.content.studio?.editingGroups ?? [])
                  .filter((group) => group.name.toLowerCase().includes(sceneQuery.toLowerCase()))
                  .flatMap((group) => group.members)
              : roomList
                ? (draft.content.studio?.environment?.features ?? [])
                    .filter((feature) => feature.name.toLowerCase().includes(sceneQuery.toLowerCase()))
                    .map((feature) => ({ kind: "ROOM_FEATURE", id: feature.id }))
                : draft.content.entities
                    .filter((entity) => entity.name.toLowerCase().includes(sceneQuery.toLowerCase()))
                    .map((entity) => ({ kind: "ASSET", id: entity.id })),
          );
        }
      }}
      className={`${styles.studio} ${styles.adaptiveWorkspace}`}
      data-mode={mode}
      data-layout={layout.preset}
      data-account-id={loaded.layoutScope}
    >
      <header
        className={styles.header}
        tabIndex={-1}
        onContextMenu={(event) => contextMenu.open(event, draft.content.title, headerMenuActions)}
        onKeyDown={(event) => contextMenu.open(event, draft.content.title, headerMenuActions)}
      >
        <div>
          <Link
            href={chronicleId ? `/studio/tales/${encodeURIComponent(chronicleId)}` : "/studio/library"}
            onClick={(event) => {
              if (event.ctrlKey || event.metaKey) return;
              event.preventDefault();
              if (busy) return;
              const href = event.currentTarget.href;
              void action(async () => {
                await persist();
                window.location.assign(href);
              });
            }}
          >
            ← {loaded.chronicle?.title ?? "Creator Studio"}
          </Link>
          <h1>
            <span aria-hidden="true">◈</span> Parallax
          </h1>
          <span role="status">
            {inspectionLanding
              ? "Installed release selected in Library. The pinned copy is read-only; the canvas is a separate private working Scene."
              : status}
          </span>
        </div>
        {spatialLibraryKind(draft) !== "SCENES" && (
          <div className={styles.sceneIdentity} aria-label="Current scene">
            <span>
              {draft.library?.type === "ASSET"
                ? "Original asset"
                : draft.library?.type === "ASSEMBLY"
                  ? "Original assembly"
                  : "Scene"}
            </span>
            <strong title={draft.content.title}>{draft.content.title}</strong>
            <small>
              {record?.saveState === "SAVED" ? "Saved in Library" : "Working draft"} · {releases.length}{" "}
              {releases.length === 1 ? "version" : "versions"}
            </small>
          </div>
        )}
        <div className={styles.toolbar}>
          <label>
            Authoring mode
            <select
              value={mode}
              onChange={(e) => {
                setInspectorTransformPreview(null);
                setMode(e.target.value);
                try {
                  sessionStorage.setItem("parallax.authoring-mode", e.target.value);
                } catch {}
              }}
            >
              {["GUIDED", "DETAILED", "ENGINEERING"].map((m) => (
                <option key={m} value={m}>
                  {m === "DETAILED" ? "STANDARD" : m}
                </option>
              ))}
            </select>
          </label>
          <button
            aria-label="Undo"
            title="Undo"
            disabled={!history.past.length || busy}
            onClick={() => {
              writeHistory(undo(historyRef.current!));
              setFindings(null);
            }}
          >
            <StudioIcon name="undo" />
          </button>
          <button
            aria-label="Redo"
            title="Redo"
            disabled={!history.future.length || busy}
            onClick={() => {
              writeHistory(redo(historyRef.current!));
              setFindings(null);
            }}
          >
            <StudioIcon name="redo" />
          </button>
          <button
            disabled={busy}
            onClick={() =>
              void action(async () => {
                await persist();
                const result = await api({
                  action: "SAVE_TO_LIBRARY",
                  definitionId: draft.content.definitionId,
                  revision: revision.current,
                });
                revision.current = result.revision;
                setSavedRevision(result.revision);
                await load();
                setStatus("Saved to Library · one definition");
              })
            }
          >
            Save to Library
          </button>
          <button
            disabled={busy}
            onClick={() =>
              void action(async () => {
                await persist();
                const data = await load();
                const entry = libraryEntries(data.items).find((e) => e.id === draft.content.definitionId)!;
                setLibraryDialog({ entry, mode: "SAVE_AS" });
              })
            }
          >
            Save as new…
          </button>
          <button
            disabled={busy}
            onClick={() =>
              void action(async () => {
                await persist();
                const data = await load();
                setLibraryDialog({
                  entry: libraryEntries(data.items).find((e) => e.id === draft.content.definitionId)!,
                  mode: "VERSIONS",
                });
              })
            }
          >
            Versions
          </button>
          <details className={styles.sceneActions}>
            <summary>Scene actions</summary>
            <div
              onClick={(event) => {
                if ((event.target as HTMLElement).closest("button"))
                  event.currentTarget.parentElement?.removeAttribute("open");
              }}
            >
              <button
                disabled={busy}
                onClick={() =>
                  void action(async () => {
                    await persist();
                    const result = await api({ action: "VALIDATE", draft });
                    setFindings(result.findings);
                    setValidationOpen(true);
                    setStatus("Drydock spatial checks complete — simulations are synthetic");
                  })
                }
              >
                Validate in Drydock
              </button>
              <button
                disabled={busy || localFindings.some((i) => i.severity === "ERROR")}
                onClick={() =>
                  void action(async () => {
                    await persist();
                    const result = await api({
                      action: "RELEASE",
                      definitionId: draft.content.definitionId,
                      revision: revision.current,
                    });
                    revision.current = result.revision;
                    setSavedRevision(result.revision);
                    setReleaseId(result.version.id);
                    setValidationOpen(false);
                    await load();
                    setStatus("Immutable version created. Attach it to a Chronicle to publish.");
                  })
                }
              >
                Create immutable version
              </button>
            </div>
          </details>
        </div>
      </header>
      {spatialLibraryKind(draft) === "SCENES" && (
        <SceneManager
          draft={draft}
          items={loaded.items}
          environments={environmentCatalog.map((item) => item.record)}
          open={sceneManagerOpen}
          onOpenChange={(open) => {
            setSceneManagerOpen(open);
            if (!open) {
              setManagerEnvironmentId(undefined);
              setManagerSceneId(undefined);
            }
          }}
          preferredEnvironmentId={managerEnvironmentId}
          preferredSceneId={managerSceneId}
          catalogLoading={!environmentCatalog.length && !environmentCatalogError}
          catalogError={environmentCatalogError}
          saveError={error}
          revision={savedRevision}
          dirty={JSON.stringify(draft) !== savedSceneSnapshot}
          disabled={busy}
          libraryInspection={inspectionLanding}
          save={async () => {
            setError("");
            try {
              await persist();
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : "This Scene could not be saved.");
              throw cause;
            }
          }}
          refresh={async () => {
            await load();
            await refreshEnvironmentCatalog();
          }}
          replace={replace}
          openScene={managerOpenScene}
          createScene={async (next) => {
            await persist();
            const result = await api({ action: "SAVE", draft: next, revision: 0 });
            install(next, result.revision, true);
            setPreview("EDITOR");
            await load();
          }}
          duplicateScene={managerDuplicateScene}
          archiveScene={async (id) => {
            await persist();
            const data = await load();
            const current = data.items.find((item) => item.id === id && !item.archived);
            if (!current || id === draftRef.current?.content.definitionId)
              throw new Error("Open another Scene before archiving this Scene.");
            await api({
              action: "LIBRARY_METADATA",
              definitionId: id,
              revision: current.revision,
              change: { archive: true },
            });
            await load();
          }}
          updateEnvironment={managerUpdateEnvironment}
          compareScene={async (targetId) => {
            await persist();
            return (await api({
              action: "SCENE_COMPARE",
              draft: draftRef.current!,
              targetDefinitionId: targetId,
            })) as ReturnType<typeof compareScenes>;
          }}
          editEnvironment={managerEditEnvironment}
          newEnvironment={async (reconstructed) => {
            await persist();
            returnToSceneManager.current = true;
            photoDraftRevision.current = 0;
            const document = createEnvironmentDraft(crypto.randomUUID());
            setEnvironmentDialog({
              photoDraft: environmentPreviewDraft(document),
              originalDefinition: draftRef.current?.content.definitionId ?? "",
              generation: generation.current,
              initialStep: reconstructed ? "PHOTOS" : "CHOOSE",
            });
          }}
          preview={() => {
            setPreview("EDITOR");
            setTimeMs(0);
            setInputs(initialSpatialInputs());
            setPlaying(true);
            setStatus("Scene preview playing");
          }}
        />
      )}
      {error && (
        <div role="alert" className={styles.error}>
          {error}
          {errorRecovery === "PLACEMENT" ? (
            <>
              <p>Choose another asset or adjust the room layout before trying again.</p>
              <button
                onClick={() => {
                  setError("");
                  startRoomEditing();
                }}
              >
                Edit room layout
              </button>
              <button onClick={() => setError("")}>Dismiss</button>
            </>
          ) : (
            <>
              <button disabled={busy} onClick={() => void action(persist)}>
                Retry save
              </button>
              <button
                onClick={() =>
                  void action(async () => {
                    const data = await load();
                    const current = data.items.find((e) => e.id === draft.content.definitionId);
                    if (current)
                      setRecovery({
                        document: draft,
                        revision: revision.current,
                        at: new Date().toISOString(),
                        server: current,
                      });
                  })
                }
              >
                Review saved revision
              </button>
            </>
          )}
        </div>
      )}
      <nav className={styles.workstationNavigation} aria-label="Workstation panels">
        <div>
          <select
            aria-label="Workspace layout"
            value={layout.preset}
            onChange={(event) => chooseWorkspace(event.target.value as WorkspaceLayout["preset"])}
          >
            {workspaceNames.map((name) => (
              <option key={name} value={name}>
                {workspaceLabels[name]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <button
            aria-label="Library & hierarchy"
            title="Library & hierarchy"
            aria-pressed={libraryOpen}
            onClick={() => setLibraryOpen(!libraryOpen)}
          >
            <StudioIcon name="copy" />
          </button>
          <button
            aria-label="Inspector"
            title="Inspector"
            aria-pressed={inspectorOpen}
            onClick={() => setInspectorOpen(!inspectorOpen)}
          >
            <StudioIcon name="inspect" />
          </button>
          <button aria-expanded={validationOpen} onClick={() => setValidationOpen(!validationOpen)}>
            Diagnostics {localFindings.length ? `· ${localFindings.length}` : "· clear"}
          </button>
          <button aria-label="Reset Workspace Layout" title="Reset Workspace Layout" onClick={resetWorkspace}>
            <StudioIcon name="reset" />
          </button>
        </div>
      </nav>
      <div
        className={`${styles.workspace} ${styles.dockedWorkspace}`}
        data-library={libraryOpen ? "open" : "closed"}
        data-inspector={inspectorOpen ? "open" : "closed"}
        style={
          {
            "--library-width": `${libraryWidth}px`,
            "--inspector-width": `${inspectorWidth}px`,
            "--left-space": libraryOpen ? `${libraryWidth}px` : "0px",
            "--right-space": inspectorOpen ? `${inspectorWidth}px` : "0px",
          } as CSSProperties
        }
      >
        <nav className={styles.dockRail} aria-label="Library and hierarchy dock">
          {(
            [
              ["ASSETS", "▱", "Open Library"],
              ["HIERARCHY", "☷", "Open Scene Hierarchy"],
            ] as const
          ).map(([tab, icon, label]) => (
            <button
              key={tab}
              id={`left-tab-${tab}`}
              aria-controls={`left-panel-${tab}`}
              aria-label={label}
              title={label}
              aria-pressed={libraryOpen && visibleLeftTab === tab}
              onClick={() => (libraryOpen && visibleLeftTab === tab ? setLibraryOpen(false) : openLeftTab(tab))}
            >
              {icon}
            </button>
          ))}
        </nav>
        {expandedLibrary && (
          <div className={styles.expandedLibraryBackdrop} aria-hidden="true" onClick={() => closeExpandedLibrary()} />
        )}
        <aside
          ref={expandedLibraryElement}
          className={`${styles.library} ${expandedLibrary ? styles.expandedLibrary : ""}`}
          aria-label={expandedLibrary ? "Expanded Spatial Library" : "Spatial Library"}
          role={expandedLibrary ? "dialog" : undefined}
          aria-modal={expandedLibrary || undefined}
          onKeyDown={handleExpandedLibraryKeyDown}
          hidden={!libraryOpen && !expandedLibrary}
        >
          {dockHandle("library")}
          <div className={styles.dockTitle}>
            <h2>{visibleLeftTab === "ASSETS" ? "Library" : "Scene graph"}</h2>
            <button
              aria-label="Collapse left dock"
              onClick={() => {
                studioElement.current?.querySelector<HTMLButtonElement>('[aria-label="Open Library"]')?.focus();
                setLibraryOpen(false);
              }}
            >
              ‹
            </button>
          </div>
          <div
            className={styles.leftPane}
            role="tabpanel"
            id="left-panel-ASSETS"
            aria-labelledby="left-tab-ASSETS"
            hidden={visibleLeftTab !== "ASSETS"}
          >
            <SpatialContentLibrary
              expanded={expandedLibrary}
              onExpand={() => {
                libraryReturnFocus.current =
                  document.activeElement instanceof HTMLElement ? document.activeElement : null;
                setExpandedLibrary(true);
              }}
              onCollapse={() => closeExpandedLibrary()}
              onPlacePreset={(preset) => {
                setPendingLibraryPlacement(preset);
                savedPlacementAttempt.current += 1;
                setPendingSavedAsset(null);
                closeExpandedLibrary(true);
              }}
              catalogMode="PAGED"
              catalogRevision={catalogRevision}
              kind={libraryKind}
              initialSelectionId={libraryTarget}
              initialVersionId={libraryEntryVersionId}
              onKindChange={setLibraryKind}
              items={loaded.items}
              environments={environmentCatalog}
              providerEntries={spatialElementCatalogEntries}
              environmentError={environmentCatalogError}
              busy={busy}
              csrfToken={() => csrf.current}
              currentId={draft.content.definitionId}
              onInsertPreset={addPreset}
              onDragPreset={setDraggedLibraryPreset}
              onOpenScene={(record) => {
                if (expandedLibrary) closeExpandedLibrary(true);
                openCatalogScene(record);
              }}
              onDuplicateScene={
                spatialLibraryKind(draft) === "SCENES"
                  ? (record) => {
                      setExpandedLibrary(false);
                      setManagerSceneId(record.id);
                      setManagerEnvironmentId(sceneEnvironmentIdentity(record) ?? undefined);
                      setSceneManagerOpen(true);
                    }
                  : undefined
              }
              onManageScene={(record, mode) => {
                setExpandedLibrary(false);
                manageCatalogScene(record, mode);
              }}
              onSaveScene={saveCatalogScene}
              onArchiveScene={archiveCatalogScene}
              onUseSaved={(record, versionId) => {
                if (spatialLibraryKind(record.draft) === "ASSETS") {
                  const released = record.releases.find((item) => item.id === versionId);
                  if (!released) {
                    setError("Choose an available released asset version before placing it.");
                    return;
                  }
                  const root = released.entities.find(
                    (entity) => entity.id === released.studio?.libraryDefinition?.rootEntityId,
                  );
                  const element = root?.element;
                  const model =
                    element?.kind === "PHYSICAL_ASSET"
                      ? physicalAssets.find((item) => item.id === element.modelId)
                      : undefined;
                  const attemptId = ++savedPlacementAttempt.current;
                  setPendingSavedAsset({ record, versionId, support: model?.support ?? "FLOOR", attemptId });
                  setPendingLibraryPlacement(null);
                  if (expandedLibrary) closeExpandedLibrary(true);
                  else
                    studioElement.current
                      ?.querySelector<HTMLElement>('[aria-label="Spatial canvas"] [data-renderer]')
                      ?.focus();
                } else {
                  if (expandedLibrary) closeExpandedLibrary(true);
                  insertCatalogSaved(record, versionId);
                }
              }}
              onOpenEnvironment={(item) => {
                if (expandedLibrary) closeExpandedLibrary(true);
                openCatalogEnvironment(item);
              }}
              onCreateSceneFromEnvironment={
                spatialLibraryKind(draft) === "SCENES"
                  ? (item) => {
                      setExpandedLibrary(false);
                      setManagerSceneId(undefined);
                      setManagerEnvironmentId(item.id);
                      setSceneManagerOpen(true);
                    }
                  : undefined
              }
              onReviewCompatibleEnvironment={(item) => {
                if (spatialLibraryKind(draft) !== "SCENES") {
                  setError("Open a Scene from Library to review its Environment relationships in Scene Manager.");
                  return;
                }
                setExpandedLibrary(false);
                setManagerEnvironmentId(item.id);
                setSceneManagerOpen(true);
              }}
              onManageEnvironment={(item, mode) => {
                setExpandedLibrary(false);
                manageCatalogEnvironment(item, mode);
              }}
              onSaveEnvironment={saveCatalogEnvironment}
              onArchiveEnvironment={archiveCatalogEnvironment}
              onUseEnvironment={(item, versionId) => {
                if (expandedLibrary) closeExpandedLibrary(true);
                applyCatalogEnvironment(item, versionId);
              }}
              onCreateEnvironment={() => {
                setExpandedLibrary(false);
                createCatalogEnvironment();
              }}
              onRetryEnvironments={() => void refreshEnvironmentCatalog()}
            />
          </div>
          <div
            className={styles.leftPane}
            role="tabpanel"
            id="left-panel-HIERARCHY"
            aria-labelledby="left-tab-HIERARCHY"
            hidden={leftTab !== "HIERARCHY"}
          >
            <section className={styles.graph} aria-label="Scene graph">
              <div className={styles.graphHeader}>
                <h2>
                  Scene Graph <span>{draft.content.entities.length}</span>
                </h2>
                <div role="toolbar" aria-label="Scene graph object actions" className={styles.graphToolbar}>
                  <button
                    type="button"
                    aria-label={selectedGroup ? "Edit selected group" : "Group selected items"}
                    title="Group"
                    disabled={groupingDisabled}
                    onClick={startGrouping}
                  >
                    <StudioIcon name="group" />
                  </button>
                  {(groupActive ? multiGraphToolbarActions : graphToolbarActions).map((action) => (
                    <button
                      key={action.label}
                      type="button"
                      aria-label={action.label}
                      title={action.label}
                      disabled={action.disabled}
                      data-danger={action.icon === "trash" || undefined}
                      onClick={() =>
                        (groupActive
                          ? selectionActions(selectionMembers, selectedGroup)
                          : currentEntity
                            ? objectActions(currentEntity.id)
                            : []
                        )
                          .find((command) => command.label === action.label)
                          ?.run()
                      }
                    >
                      <StudioIcon name={action.icon ?? "menu"} />
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.dockTabs} role="tablist" aria-label="Scene graph categories">
                {(["ASSETS", "GROUPINGS"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    id={`graph-tab-${tab}`}
                    aria-controls={`graph-panel-${tab}`}
                    tabIndex={graphTab === tab ? 0 : -1}
                    aria-selected={graphTab === tab}
                    onClick={() => setGraphTab(tab)}
                    onKeyDown={(event) => {
                      if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
                        event.preventDefault();
                        const next =
                          event.key === "Home"
                            ? "ASSETS"
                            : event.key === "End"
                              ? "GROUPINGS"
                              : tab === "ASSETS"
                                ? "GROUPINGS"
                                : "ASSETS";
                        setGraphTab(next);
                        requestAnimationFrame(() =>
                          studioElement.current?.querySelector<HTMLButtonElement>(`#graph-tab-${next}`)?.focus(),
                        );
                      }
                    }}
                  >
                    {tab === "ASSETS" ? "Assets" : "Groups"}
                  </button>
                ))}
              </div>
              <p className={styles.selectionHint}>
                {selectionMembers.length} selected · Ctrl/⌘ click or Space to add · Shift for range
              </p>
              <label>
                <input
                  placeholder="Search scene…"
                  aria-label="Scene graph search"
                  value={sceneQuery}
                  onChange={(e) => setSceneQuery(e.target.value)}
                />
              </label>
              <div
                role="tabpanel"
                id="graph-panel-ASSETS"
                aria-labelledby="graph-tab-ASSETS"
                hidden={graphTab !== "ASSETS"}
              >
                <ul>
                  {graphOrder
                    .rows("ASSET", draft.content.entities)
                    .filter((e) =>
                      `${e.name} ${e.kind} ${e.anchorId} ${e.interactions.join(" ")} ${draft.content.studio?.layers.find((l) => l.entityId === e.id)?.tags.join(" ")}`
                        .toLowerCase()
                        .includes(sceneQuery.toLowerCase()),
                    )
                    .map((entity) => {
                      const l = draft.content.studio?.layers.find((l) => l.entityId === entity.id);
                      return (
                        <li key={entity.id} style={{ paddingLeft: entity.parentEntityId ? 16 : 0 }}>
                          {renamingId === entity.id ? (
                            <SceneGraphRename
                              key={entity.id}
                              name={entity.name}
                              onCancel={() => setRenamingId(null)}
                              onCommit={(name) => {
                                edit({ type: "CONTENT", entityId: entity.id, patch: { name } });
                                setRenamingId(null);
                                setSceneQuery("");
                                requestAnimationFrame(() =>
                                  studioElement.current
                                    ?.querySelector<HTMLButtonElement>(`[data-graph-entity="${entity.id}"]`)
                                    ?.focus(),
                                );
                              }}
                            />
                          ) : (
                            <button
                              {...graphOrder.bind(
                                "ASSET",
                                entity.id,
                                entity.name,
                                draft.content.entities
                                  .filter((item) =>
                                    `${item.name} ${item.kind} ${item.anchorId} ${item.interactions.join(" ")} ${draft.content.studio?.layers.find((l) => l.entityId === item.id)?.tags.join(" ")}`
                                      .toLowerCase()
                                      .includes(sceneQuery.toLowerCase()),
                                  )
                                  .map((item) => item.id),
                              )}
                              data-graph-entity={entity.id}
                              aria-pressed={selectionKeys.has(`ASSET:${entity.id}`)}
                              onClick={(event) => selectAsset(entity.id, selectionModifiers(event))}
                              onDoubleClick={() => {
                                if (!busy && preview === "EDITOR" && !l?.locked) renameObject(entity.id);
                              }}
                              onContextMenu={(event) => {
                                if (selectedGroup || !selectionKeys.has(`ASSET:${entity.id}`)) selectAsset(entity.id);
                                contextMenu.open(event, entity.name, objectActions(entity.id));
                              }}
                              onKeyDown={(event) => {
                                if (
                                  graphOrder.key(
                                    event,
                                    "ASSET",
                                    entity.id,
                                    graphOrder
                                      .rows("ASSET", draft.content.entities)
                                      .filter((item) => item.name.toLowerCase().includes(sceneQuery.toLowerCase()))
                                      .map((item) => item.id),
                                  )
                                )
                                  return;
                                if (event.key === " " && (event.ctrlKey || event.metaKey || event.shiftKey)) {
                                  event.preventDefault();
                                  selectAsset(entity.id, selectionModifiers(event));
                                }
                                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                                  event.preventDefault();
                                  const buttons = [
                                    ...event.currentTarget
                                      .closest("ul")!
                                      .querySelectorAll<HTMLButtonElement>("button[data-graph-entity]"),
                                  ];
                                  const target =
                                    buttons[
                                      buttons.indexOf(event.currentTarget) + (event.key === "ArrowDown" ? 1 : -1)
                                    ];
                                  target?.focus();
                                  if (target && event.shiftKey)
                                    selectAsset(target.dataset.graphEntity!, { range: true });
                                } else if (event.key === "F2" && !busy && preview === "EDITOR" && !l?.locked) {
                                  event.preventDefault();
                                  renameObject(entity.id);
                                } else if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
                                  if (selectedGroup || !selectionKeys.has(`ASSET:${entity.id}`)) selectAsset(entity.id);
                                  contextMenu.open(event, entity.name, objectActions(entity.id));
                                }
                              }}
                            >
                              <span className={styles.graphAssetIcon}>
                                <StudioIcon name={entity.parentEntityId ? "copy" : "frame"} />
                              </span>
                              <span className={styles.graphAssetName}>
                                <span
                                  title="Click to rename; F2 also renames"
                                  onClick={(event) => {
                                    if (
                                      !busy &&
                                      !event.ctrlKey &&
                                      !event.metaKey &&
                                      !event.shiftKey &&
                                      !l?.locked &&
                                      !roomScenePreview &&
                                      !assistantScenePreview &&
                                      !placementPreview
                                    ) {
                                      event.stopPropagation();
                                      renameObject(entity.id);
                                    }
                                  }}
                                >
                                  {entity.name}
                                </span>
                                <small>{entity.kind.replaceAll("_", " ").toLowerCase()}</small>
                              </span>
                              <span className={styles.graphAssetState}>
                                <span
                                  data-graph-reorder-handle
                                  title="Drag to reorder; Alt + arrow keys"
                                  className={styles.graphReorderGrip}
                                >
                                  <StudioIcon name="move" />
                                </span>
                                {l?.visible === false && (
                                  <span title="Hidden">
                                    <StudioIcon name="eyeOff" />
                                  </span>
                                )}
                                {l?.locked && (
                                  <span title="Locked">
                                    <StudioIcon name="lock" />
                                  </span>
                                )}
                              </span>
                            </button>
                          )}
                        </li>
                      );
                    })}
                </ul>
                {roomEditing && draft.content.studio?.environment && (
                  <section aria-label="Room feature selection">
                    <h3>Room features</h3>
                    <ul>
                      {graphOrder
                        .rows("ROOM_FEATURE", draft.content.studio.environment.features)
                        .filter((feature) => feature.name.toLowerCase().includes(sceneQuery.toLowerCase()))
                        .map((feature) => (
                          <li key={feature.id}>
                            <button
                              {...graphOrder.bind(
                                "ROOM_FEATURE",
                                feature.id,
                                feature.name,
                                draft.content
                                  .studio!.environment!.features.filter((item) =>
                                    item.name.toLowerCase().includes(sceneQuery.toLowerCase()),
                                  )
                                  .map((item) => item.id),
                              )}
                              type="button"
                              data-graph-feature={feature.id}
                              aria-pressed={selectionKeys.has(`ROOM_FEATURE:${feature.id}`)}
                              onClick={(event) => selectRoomFeature(feature.id, selectionModifiers(event))}
                              onKeyDown={(event) => {
                                if (
                                  graphOrder.key(
                                    event,
                                    "ROOM_FEATURE",
                                    feature.id,
                                    draft.content
                                      .studio!.environment!.features.filter((item) =>
                                        item.name.toLowerCase().includes(sceneQuery.toLowerCase()),
                                      )
                                      .map((item) => item.id),
                                  )
                                )
                                  return;
                                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                                  event.preventDefault();
                                  const buttons = [
                                    ...event.currentTarget
                                      .closest("ul")!
                                      .querySelectorAll<HTMLButtonElement>("button[data-graph-feature]"),
                                  ];
                                  const target =
                                    buttons[
                                      buttons.indexOf(event.currentTarget) + (event.key === "ArrowDown" ? 1 : -1)
                                    ];
                                  target?.focus();
                                  if (target && event.shiftKey)
                                    selectRoomFeature(target.dataset.graphFeature!, { range: true });
                                } else if (event.key === " " && (event.ctrlKey || event.metaKey || event.shiftKey)) {
                                  event.preventDefault();
                                  selectRoomFeature(feature.id, selectionModifiers(event));
                                } else if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
                                  if (selectedGroup || !selectionKeys.has(`ROOM_FEATURE:${feature.id}`))
                                    selectRoomFeature(feature.id);
                                  contextMenu.open(event, feature.name, roomFeatureActions(feature.id));
                                }
                              }}
                              onContextMenu={(event) => {
                                if (selectedGroup || !selectionKeys.has(`ROOM_FEATURE:${feature.id}`))
                                  selectRoomFeature(feature.id);
                                contextMenu.open(event, feature.name, roomFeatureActions(feature.id));
                              }}
                            >
                              <StudioIcon name="surface" />
                              <span className={styles.graphAssetName}>
                                {feature.name}
                                <small>{feature.classification.toLowerCase()}</small>
                              </span>
                              <span
                                data-graph-reorder-handle
                                title="Drag to reorder; Alt + arrow keys"
                                className={styles.graphReorderGrip}
                              >
                                <StudioIcon name="move" />
                              </span>
                            </button>
                          </li>
                        ))}
                    </ul>
                  </section>
                )}
              </div>
              <div
                role="tabpanel"
                id="graph-panel-GROUPINGS"
                aria-labelledby="graph-tab-GROUPINGS"
                hidden={graphTab !== "GROUPINGS"}
              >
                <SceneGroups
                  order={graphOrder}
                  groups={graphOrder.rows("GROUP", draft.content.studio?.editingGroups ?? [])}
                  members={selectionMembers}
                  query={sceneQuery}
                  disabled={groupingDisabled}
                  onSelect={selectGroup}
                  onSave={saveGroup}
                  actions={groupActions}
                />
              </div>
            </section>
          </div>
        </aside>
        <section className={styles.center}>
          <div className={styles.previewControls}>
            <label>
              Preview
              <select aria-label="Preview" value={preview} onChange={(e) => setPreview(e.target.value)}>
                {previewModes.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
            <label>
              Environment
              <select
                aria-label="Environment"
                value={environment}
                onChange={(e) => {
                  if (roomEditing) finishRoomEditing();
                  generation.current++;
                  setEditorGeneration(generation.current);
                  setAssistantScenePreview(null);
                  setEnvironment(e.target.value);
                }}
              >
                {legacyPreview && pinnedEnvironmentId && (
                  <option value={pinnedEnvironmentId}>
                    {legacyPreview?.environment?.name ?? "Pinned Environment · loading"}
                  </option>
                )}
                {draft.content.studio?.environment && (
                  <option value={draft.content.studio.environment.id}>
                    {draft.content.studio.environment.name} · editable
                  </option>
                )}
                {simulationEnvironments.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={() => {
                setFindings(validateSpatialAuthoring(draft.content));
                setValidationOpen(true);
              }}
            >
              Test in 10 environments
            </button>
          </div>
          {previewEnvironmentError ? (
            <section className={styles.canvas} aria-label="Spatial canvas">
              <p role="alert">{previewEnvironmentError}</p>
              <button onClick={() => void refreshEnvironmentCatalog()}>Reload Environment catalog</button>
            </section>
          ) : (
            <SpatialCanvas
              environmentEditing={roomEditing && environment === draft.content.studio?.environment?.id}
              onToggleEnvironmentEditing={() => (roomEditing ? finishRoomEditing() : startRoomEditing())}
              selectedFeatureId={selectedRoomFeature}
              onSelectFeature={selectRoomFeature}
              highlightedEntityIds={assistantHighlights}
              draft={
                roomScenePreview ?? assistantScenePreview ?? placementPreview ?? inspectorTransformPreview ?? draft
              }
              selectedId={selected}
              onSelect={selectAsset}
              selectionMembers={groupActive ? selectionMembers : undefined}
              onTransformSelection={transformSelection}
              selectionLabel={selectedGroup?.name ?? `${selectionMembers.length} selected items`}
              selectionActions={groupActive ? () => selectionActions(selectionMembers, selectedGroup) : undefined}
              featureActions={roomFeatureActions}
              onInspect={() => setInspectorOpen(true)}
              objectActions={objectActions}
              onEdit={
                roomScenePreview || assistantScenePreview || placementPreview
                  ? () => setError("Approve or discard the proposal preview before editing objects.")
                  : edit
              }
              onPreset={(name, placement) => {
                if (addPreset(name, placement) && pendingLibraryPlacement === name) setPendingLibraryPlacement(null);
              }}
              draggedPreset={draggedLibraryPreset}
              pendingPreset={pendingLibraryPlacement}
              pendingSavedAsset={
                pendingSavedAsset && {
                  name: pendingSavedAsset.record.draft.content.title,
                  support: pendingSavedAsset.support,
                }
              }
              onPlaceSavedAsset={(placement) => {
                if (pendingSavedAsset && !busy)
                  insertCatalogSaved(pendingSavedAsset.record, pendingSavedAsset.versionId, placement);
              }}
              onCancelPendingPreset={() => {
                setPendingLibraryPlacement(null);
                savedPlacementAttempt.current += 1;
                setPendingSavedAsset(null);
              }}
              mode={mode}
              preview={preview}
              environmentId={roomScenePreview?.content.studio?.environment?.id ?? environment}
              environmentOverride={
                viewingLegacyPin && !roomScenePreview ? (legacyPreview?.environment ?? undefined) : undefined
              }
              timeMs={timeMs}
              playing={playing}
              motionOptions={motionOptions}
              onPreviewChange={setPreview}
              onRendererReceipt={recordRenderedEntities}
              command={canvasCommand}
              inputs={inputs}
            />
          )}
          {roomScenePreview && (
            <p role="status">
              Room proposal preview · review the geometry before applying. Your saved scene is unchanged.
            </p>
          )}
          <div className={styles.commandBar}>
            <button
              aria-label="Ask Parallax"
              aria-expanded={assistantOpen}
              aria-controls="parallax-assistance"
              onClick={() => {
                if (assistantClosing) {
                  if (assistantCloseTimer.current) clearTimeout(assistantCloseTimer.current);
                  setAssistantClosing(false);
                  setAssistantOpen(true);
                } else if (assistantOpen) closeAssistant();
                else setAssistantOpen(true);
              }}
            >
              <span>✦ Ask Parallax</span>
              <small>
                {roomScenePreview || assistantScenePreview || placementPreview
                  ? roomScenePreview
                    ? "Review room proposal"
                    : "Review placement preview"
                  : "Place a folded letter on a table near the entrance…"}
              </small>
            </button>
            <span>{loaded.aiAvailable ? "Provider configured" : "AI unavailable · phrase rules"}</span>
          </div>
          <section
            id="parallax-assistance"
            className={styles.assistantWorkspace}
            data-docked={layout.assistantDocked}
            data-closing={assistantClosing || undefined}
            data-floating-placed={!layout.assistantDocked && !!floatingPanel ? "true" : undefined}
            style={
              !layout.assistantDocked && floatingPanel
                ? {
                    left: floatingPanel.x,
                    top: floatingPanel.y,
                    width: floatingPanel.width,
                    height: floatingPanel.height,
                  }
                : undefined
            }
            hidden={!assistantOpen}
            aria-label="Ask Parallax workspace"
          >
            {assistantPort && loaded.aiUsage && loaded.layoutScope && (
              <SpatialAssistant
                taskResetVersion={assistantTaskResetVersion}
                headerProps={
                  layout.assistantDocked
                    ? undefined
                    : {
                        ...floatingGestureProps,
                        tabIndex: 0,
                        "aria-label": "Spatial Assistant header",
                        "data-floating-gesture": "move",
                        title: "Drag header to move · arrow keys move · Shift moves farther",
                      }
                }
                windowControls={
                  <div className={styles.assistantWindowControls}>
                    <span className={styles.srOnly} aria-live="polite">
                      {floatingFeedback}
                    </span>
                    <button
                      type="button"
                      title={layout.assistantDocked ? "Float assistance" : "Dock assistance"}
                      aria-label={layout.assistantDocked ? "Float assistance" : "Dock assistance"}
                      aria-pressed={layout.assistantDocked}
                      onClick={() =>
                        setLayout((previous) => ({ ...previous, assistantDocked: !previous.assistantDocked }))
                      }
                    >
                      <StudioIcon name={layout.assistantDocked ? "copy" : "inspect"} />
                    </button>
                    <button
                      type="button"
                      title="Close assistance"
                      aria-label="Close assistance"
                      onClick={closeAssistant}
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        aria-hidden="true"
                      >
                        <path d="m6 6 12 12M18 6 6 18" />
                      </svg>
                    </button>
                  </div>
                }
                draft={draft}
                revision={savedRevision}
                editorGeneration={editorGeneration}
                selectedEntityId={draft.content.entities.some((entity) => entity.id === selected) ? selected : null}
                selectedGroupId={selectedGroup?.id ?? null}
                selectedMembers={selectionMembers}
                environmentEditing={roomEditing && environment === draft.content.studio?.environment?.id}
                accountId={loaded.layoutScope}
                usage={loaded.aiUsage}
                renderedSceneVersion={renderedSceneVersion}
                renderedEntities={renderedEntities}
                port={assistantPort}
                onPreview={assistantPreview}
                onSelect={setSelected}
                onUndo={() => {
                  if (historyRef.current && !busy) writeHistory(undo(historyRef.current));
                }}
                onRedo={() => {
                  if (historyRef.current && !busy) writeHistory(redo(historyRef.current));
                }}
                canUndo={!!history.past.length && !busy}
                canRedo={!!history.future.length && !busy}
                onClose={closeAssistant}
                onCanvasView={() => {
                  setAssistantOpen(false);
                  queueMicrotask(() =>
                    document.querySelector<HTMLButtonElement>('[aria-controls="parallax-assistance"]')?.focus(),
                  );
                }}
              />
            )}

            {!layout.assistantDocked &&
              floatingEdges.map((edge) => (
                <button
                  key={edge}
                  type="button"
                  className={styles.assistantResize}
                  data-edge={edge}
                  aria-label={`Resize floating Spatial Assistant ${{ n: "top", e: "right", s: "bottom", w: "left", ne: "top right", nw: "top left", se: "bottom right", sw: "bottom left" }[edge]}`}
                  title="Drag to resize · arrow keys resize · Shift resizes farther"
                  data-floating-gesture={edge}
                  {...floatingGestureProps}
                />
              ))}
          </section>
          {preview === "PERFORMANCE" && (
            <p className={styles.notice}>Estimate only: {JSON.stringify(spatialPerformanceEstimate(draft.content))}</p>
          )}
          {preview === "REMOTE" && (
            <p className={styles.notice}>
              Compare the same intent across synthetic rooms. Placements, safety rejections and fallbacks change with
              available evidence. Physical qualification remains pending.
            </p>
          )}
          <section
            className={styles.bottomDock}
            aria-label="Bottom workstation dock"
            data-open={bottomOpen}
            style={{ height: bottomOpen ? bottomHeight : 36 }}
          >
            {bottomOpen && (
              <div
                className={styles.bottomHandle}
                role="separator"
                aria-label="Resize bottom dock"
                aria-orientation="horizontal"
                aria-valuenow={bottomHeight}
                aria-valuemin={160}
                aria-valuemax={460}
                tabIndex={0}
                onPointerDown={(event) => {
                  bottomDrag.current = { y: event.clientY, height: bottomHeight };
                  event.currentTarget.setPointerCapture(event.pointerId);
                }}
                onPointerMove={(event) => {
                  const drag = bottomDrag.current;
                  if (drag)
                    setLayout((previous) => ({
                      ...previous,
                      bottomHeight: Math.round(Math.max(160, Math.min(460, drag.height + drag.y - event.clientY))),
                    }));
                }}
                onPointerUp={() => {
                  bottomDrag.current = null;
                }}
                onPointerCancel={() => {
                  bottomDrag.current = null;
                }}
                onKeyDown={(event) => {
                  if (["ArrowUp", "ArrowDown"].includes(event.key)) {
                    event.preventDefault();
                    setLayout((previous) => ({
                      ...previous,
                      bottomHeight: Math.max(
                        160,
                        Math.min(460, previous.bottomHeight + (event.key === "ArrowUp" ? 20 : -20)),
                      ),
                    }));
                  }
                }}
              />
            )}
            <div className={styles.timelineHeader}>
              <div className={styles.dockTabs} role="tablist" aria-label="Bottom dock tools">
                {(
                  [
                    ["TIMELINE", "Timeline"],
                    ["SIMULATION", "Simulation"],
                    ["DIAGNOSTICS", "Diagnostics"],
                    ["EVENTS", "Events"],
                  ] as const
                ).map(([tab, label]) => (
                  <button
                    key={tab}
                    role="tab"
                    id={`bottom-tab-${tab}`}
                    aria-selected={bottomOpen && bottomTab === tab}
                    aria-controls={`bottom-panel-${tab}`}
                    onClick={() =>
                      bottomOpen && bottomTab === tab
                        ? setLayout((previous) => ({ ...previous, bottomOpen: false }))
                        : openBottomTab(tab)
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div>
                <button
                  aria-pressed={playing}
                  onClick={() => {
                    if (timeMs >= 60000) setTimeMs(0);
                    setPlaying(!playing);
                    setPreview("LENS");
                  }}
                >
                  {playing ? "Pause timeline" : "Play timeline"}
                </button>
                <button
                  onClick={() => {
                    setTimeMs(0);
                    setMotionTake((take) => take + 1);
                    setPlaying(true);
                    setPreview("LENS");
                  }}
                >
                  Restart timeline
                </button>
                <button
                  onClick={() => {
                    setPlaying(false);
                    setTimeMs(0);
                    setPreview("LENS");
                  }}
                >
                  Stop timeline
                </button>
                <span>{(timeMs / 1000).toFixed(1)} / 60.0 s</span>
                <button
                  aria-label={bottomOpen ? "Collapse bottom dock" : "Expand bottom dock"}
                  onClick={() => setLayout((previous) => ({ ...previous, bottomOpen: !previous.bottomOpen }))}
                >
                  {bottomOpen ? "⌄" : "⌃"}
                </button>
              </div>
            </div>
            <div className={styles.bottomContent} hidden={!bottomOpen}>
              <section
                className={styles.timeline}
                role="tabpanel"
                id="bottom-panel-TIMELINE"
                aria-labelledby="bottom-tab-TIMELINE"
                hidden={bottomTab !== "TIMELINE"}
              >
                <h2>Scene timeline</h2>
                <div className={styles.timelineWorkspace}>
                  <BehaviorTracks
                    draft={draft}
                    timeMs={timeMs}
                    selected={selected}
                    onSelect={(id) => {
                      setSelected(id);
                      setTimelineSelection(null);
                    }}
                    onEditTrack={(entityId, trackId, frameId) => {
                      setSelected(entityId);
                      setTimelineSelection({ entityId, trackId, frameId });
                    }}
                    onEditEvent={(entityId, eventId) => {
                      setSelected(entityId);
                      setTimelineSelection({ entityId, eventId });
                      requestAnimationFrame(() => {
                        const details =
                          studioElement.current?.querySelector<HTMLDetailsElement>("[data-sequence-properties]");
                        if (details) {
                          details.open = true;
                          details
                            .querySelector<HTMLElement>(`[data-behavior-id="${eventId}"]`)
                            ?.scrollIntoView({ block: "nearest" });
                        }
                      });
                    }}
                    onTime={seekTimeline}
                    onChange={replace}
                  />
                  <AnimationEditor
                    focusTrack={timelineSelection?.entityId === selected ? timelineSelection.trackId : undefined}
                    focusFrame={timelineSelection?.entityId === selected ? timelineSelection.frameId : undefined}
                    motionOptions={motionOptions}
                    preview={preview}
                    draft={draft}
                    selected={selected}
                    timeMs={timeMs}
                    onTime={seekTimeline}
                    onChange={replace}
                  />
                </div>
                <small>
                  Spatial state changes only · events are relative to their trigger · Chronicle progression remains One
                  Voyage-owned.
                </small>
                <button
                  disabled={!selected || (draft.content.studio?.behaviors.length ?? 0) >= 64}
                  onClick={() => {
                    const next = structuredClone(draft);
                    next.content.studio ??= emptyStudioContent();
                    next.content.studio.behaviors.push({
                      id: crypto.randomUUID(),
                      trigger: "SCENE_ENTER",
                      delayMs: 0,
                      targetEntityId: selected!,
                      action: "HIGHLIGHT",
                    });
                    replace(next);
                  }}
                >
                  Add spatial behavior
                </button>
                <details className={styles.timelineProperties} data-sequence-properties>
                  <summary>Sequence properties &amp; simulation</summary>
                  <label>
                    Preview time
                    <input
                      aria-label="Timeline time in milliseconds"
                      type="range"
                      min="0"
                      max="60000"
                      step="100"
                      value={timeMs}
                      onChange={(e) => seekTimeline(Number(e.target.value))}
                    />
                    {(timeMs / 1000).toFixed(1)} seconds
                  </label>
                  <div className={styles.inline}>
                    {["INSPECT", "PICK", "PLACE"].map((trigger) => (
                      <button
                        key={trigger}
                        disabled={
                          !currentEntity ||
                          !currentEntity.interactions.includes(trigger as "INSPECT" | "PICK" | "PLACE")
                        }
                        onClick={() => triggerSimulation(trigger as "INSPECT" | "PICK" | "PLACE")}
                      >
                        Simulate {trigger.toLowerCase()}
                      </button>
                    ))}
                    <button onClick={resetSimulation}>Reset simulation</button>
                  </div>
                  {(draft.content.studio?.behaviors ?? []).map((b, index) => (
                    <div className={styles.behavior} key={b.id} data-behavior-id={b.id}>
                      <select
                        aria-label={`Behavior ${index + 1} trigger`}
                        value={b.trigger}
                        onChange={(e) => {
                          const next = structuredClone(draft);
                          const node = next.content.studio!.behaviors[index];
                          node.trigger = e.target.value as typeof b.trigger;
                          if (["PICK", "INSPECT", "PLACE"].includes(node.trigger))
                            node.sourceEntityId = selected ?? undefined;
                          else delete node.sourceEntityId;
                          replace(next);
                        }}
                      >
                        {["SCENE_ENTER", "TIMER", "INSPECT", "PICK", "PLACE"].map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                      <select
                        aria-label={`Behavior ${index + 1} source`}
                        value={b.sourceEntityId ?? ""}
                        disabled={["TIMER", "SCENE_ENTER"].includes(b.trigger)}
                        onChange={(e) => {
                          const next = structuredClone(draft);
                          next.content.studio!.behaviors[index].sourceEntityId = e.target.value;
                          replace(next);
                        }}
                      >
                        <option value="">Scene</option>
                        {draft.content.entities.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.name}
                          </option>
                        ))}
                      </select>
                      <input
                        aria-label={`Behavior ${index + 1} delay milliseconds`}
                        type="number"
                        min="0"
                        max="60000"
                        value={b.delayMs}
                        onChange={(e) => {
                          const next = structuredClone(draft);
                          next.content.studio!.behaviors[index].delayMs = Number(e.target.value);
                          replace(next);
                        }}
                      />
                      <select
                        aria-label={`Behavior ${index + 1} action`}
                        value={b.action}
                        onChange={(e) => {
                          const next = structuredClone(draft);
                          next.content.studio!.behaviors[index].action = e.target.value as typeof b.action;
                          replace(next);
                        }}
                      >
                        {["SHOW", "HIDE", "HIGHLIGHT"].map((a) => (
                          <option key={a}>{a}</option>
                        ))}
                      </select>
                      <select
                        aria-label={`Behavior ${index + 1} target`}
                        value={b.targetEntityId}
                        onChange={(e) => {
                          const next = structuredClone(draft);
                          next.content.studio!.behaviors[index].targetEntityId = e.target.value;
                          replace(next);
                        }}
                      >
                        {draft.content.entities.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.name}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => {
                          const next = structuredClone(draft);
                          next.content.studio!.behaviors.splice(index, 1);
                          replace(next);
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </details>
              </section>
              <section
                className={styles.simulationPane}
                role="tabpanel"
                id="bottom-panel-SIMULATION"
                aria-labelledby="bottom-tab-SIMULATION"
                hidden={bottomTab !== "SIMULATION"}
              >
                <h2>Simulation</h2>
                <p>Current {previewEnvironment.name} reference environment · synthetic evidence</p>
                <SpatialSimulation
                  draft={draft}
                  inputs={inputs}
                  timeMs={timeMs}
                  rendered={renderedEntities}
                  selected={selected}
                  playing={playing}
                  preview={preview}
                  mode={mode}
                  feedback={simulationFeedback}
                  onTrigger={triggerSimulation}
                  onReset={resetSimulation}
                  onTime={seekTimeline}
                  onSelect={setSelected}
                  onRun={() => {
                    if (timeMs >= 60000) setTimeMs(0);
                    setPlaying(!playing);
                    setPreview("LENS");
                  }}
                />
                <div className={styles.inline}>
                  <button
                    onClick={() => {
                      setFindings(validateSpatialAuthoring(draft.content));
                      setValidationOpen(true);
                    }}
                  >
                    Compare 10 environments
                  </button>
                </div>
                {adaptiveResolution && (
                  <p>
                    {adaptiveResolution.quality.replaceAll("_", " ")} ·{" "}
                    {Object.keys(adaptiveResolution.placements).length} staged objects · no physical qualification
                  </p>
                )}
              </section>
              <section
                className={styles.diagnosticPane}
                role="tabpanel"
                id="bottom-panel-DIAGNOSTICS"
                aria-labelledby="bottom-tab-DIAGNOSTICS"
                hidden={bottomTab !== "DIAGNOSTICS"}
              >
                <h2>Validation and environment previews</h2>
                {localFindings.length ? (
                  localFindings.map((finding, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        if (finding.entityId) setSelected(finding.entityId);
                        setMode("DETAILED");
                      }}
                    >
                      <strong>
                        {finding.severity}
                        {mode === "ENGINEERING" ? ` / ${finding.code}` : ""}
                      </strong>{" "}
                      {finding.message}
                    </button>
                  ))
                ) : (
                  <p>No blocking static findings. Synthetic previews and physical/owner acceptance are separate.</p>
                )}
                <div className={styles.environments}>
                  {environmentPreviews.map((e) => (
                    <button
                      key={e.id}
                      onClick={() => {
                        setEnvironment(e.id);
                        setPreview(e.status === "GUIDED_FALLBACK" ? "FALLBACK" : "EDITOR");
                      }}
                    >
                      <strong>{e.name}</strong>
                      <span>{e.status.replaceAll("_", " ")}</span>
                      <small>{e.reason}</small>
                    </button>
                  ))}
                </div>
              </section>

              <section
                className={styles.eventsPane}
                role="tabpanel"
                id="bottom-panel-EVENTS"
                aria-labelledby="bottom-tab-EVENTS"
                hidden={bottomTab !== "EVENTS"}
              >
                <h2>Preview activity</h2>
                <p>Transient simulation inputs. These never advance the Chronicle.</p>
                <SimulationEvents draft={draft} inputs={inputs} timeMs={timeMs} rendered={renderedEntities} />
              </section>
            </div>
          </section>
        </section>
        <aside
          ref={inspectorPanelRef}
          className={styles.inspector}
          aria-label="Spatial inspector"
          hidden={!inspectorOpen}
        >
          {dockHandle("inspector")}
          <div className={styles.dockTitle}>
            <div className={styles.inspectorIdentity}>
              <h2>
                {activeInspectorView === "PROPERTIES"
                  ? "Properties"
                  : activeInspectorView === "CONTEXT"
                    ? "Spatial context"
                    : activeInspectorView === "SCENE"
                      ? "Scene settings"
                      : activeInspectorView === "PREVIEW"
                        ? "Preview selection"
                        : "Selection unavailable"}
              </h2>
              <small>Guided · Standard · Engineering</small>
            </div>
            {currentEntity && !groupActive && activeInspectorView !== "SCENE" && (
              <button
                aria-label="Selected object actions"
                title="Object actions"
                onClick={(event) =>
                  contextMenu.openAt(
                    event.currentTarget,
                    event.currentTarget.getBoundingClientRect().left,
                    event.currentTarget.getBoundingClientRect().bottom,
                    currentEntity.name,
                    objectActions(currentEntity.id),
                  )
                }
              >
                <StudioIcon name="menu" />
              </button>
            )}
            <button
              aria-label="Collapse Inspector"
              onClick={() => {
                const opener = studioElement.current?.querySelector<HTMLButtonElement>(
                  'nav[aria-label="Inspector dock"] button[aria-pressed="true"]',
                );
                opener?.focus({ preventScroll: true });
                setInspectorOpen(false);
              }}
            >
              ›
            </button>
          </div>
          <section className={styles.inspectorHero} aria-label="Inspector context">
            <small className={styles.inspectorEyebrow}>
              {activeInspectorView === "SCENE"
                ? "Scene"
                : groupActive
                  ? `${selectionMembers.length} selected items`
                  : activeInspectorView === "INVALID"
                    ? "Missing selection"
                    : selectedRoomFeature
                      ? selectedRoomSurface
                        ? "Support surface"
                        : "Room feature"
                      : roomEditing
                        ? "Editable environment"
                        : currentEntity
                          ? (currentEntity.element?.kind.replaceAll("_", " ") ??
                            currentEntity.kind.replaceAll("_", " "))
                          : activeInspectorView === "PREVIEW"
                            ? "Unapplied proposal"
                            : "Scene overview"}
            </small>
            <h3>
              {activeInspectorView === "SCENE"
                ? draft.content.title
                : groupActive
                  ? (selectedGroup?.name ?? "Multiple items")
                  : activeInspectorView === "INVALID"
                    ? "Selection unavailable"
                    : selectedRoomFeature
                      ? (selectedRoomFeatureRecord?.name ?? "Room feature")
                      : roomEditing
                        ? (draft.content.studio?.environment?.name ?? "Room features")
                        : (currentEntity?.name ?? previewEntity?.name ?? draft.content.title)}
            </h3>
            <p>
              {activeInspectorView === "CONTEXT"
                ? selectedRoomFeature || roomEditing
                  ? "Room tools, supporting surfaces, and nearby features."
                  : "Placement, relationships, and behavior stay connected to this selection."
                : activeInspectorView === "SCENE"
                  ? "Scene presentation, reuse, versions, and accessibility."
                  : activeInspectorView === "INVALID"
                    ? "This item is no longer in the working scene. Undo may restore it."
                    : activeInspectorView === "PREVIEW"
                      ? "Apply the proposal before changing saved properties."
                      : groupActive
                        ? "Move these items together, then inspect their membership in Spatial context."
                        : selectedRoomFeature
                          ? selectedRoomSurface
                            ? "Inspect this structural surface and its supported placement geometry."
                            : "Edit this room feature and its reserved or supporting surfaces."
                          : roomEditing
                            ? "Shape the room and select a feature to adjust its geometry."
                            : "Edit what this item is, how it appears, and how people interact with it."}
            </p>
            {currentEntity && !groupActive && activeInspectorView !== "SCENE" && (
              <div className={styles.inspectorActions} aria-label="Selected object quick actions">
                <button title="Frame this object in the viewport" onClick={() => requestCanvasCommand("FRAME")}>
                  Frame
                </button>
                <button
                  title={graphLayer?.visible === false ? "Show this object" : "Hide this object"}
                  disabled={unavailable}
                  onClick={() =>
                    edit({
                      type: "LAYER",
                      entityId: currentEntity.id,
                      patch: { visible: graphLayer?.visible === false },
                    })
                  }
                >
                  {graphLayer?.visible === false ? "Show" : "Hide"}
                </button>
                <button
                  title={graphLayer?.locked ? "Unlock this object" : "Lock this object"}
                  disabled={unavailable}
                  onClick={() =>
                    edit({ type: "LAYER", entityId: currentEntity.id, patch: { locked: !graphLayer?.locked } })
                  }
                >
                  {graphLayer?.locked ? "Unlock" : "Lock"}
                </button>
                <button
                  title="Duplicate this object"
                  disabled={
                    unavailable ||
                    Boolean(graphLayer?.locked) ||
                    draft.content.studio?.libraryDefinition?.rootEntityId === currentEntity.id
                  }
                  onClick={() => {
                    const newId = crypto.randomUUID();
                    edit({ type: "DUPLICATE", entityId: currentEntity.id, newId });
                    setSelected(newId);
                  }}
                >
                  Duplicate
                </button>
                <button
                  title="Delete this object"
                  disabled={
                    unavailable ||
                    Boolean(graphLayer?.locked) ||
                    draft.content.entities.length < 2 ||
                    draft.content.entities.some((entity) => entity.parentEntityId === currentEntity.id) ||
                    draft.content.studio?.libraryDefinition?.rootEntityId === currentEntity.id
                  }
                  onClick={() => edit({ type: "DELETE", entityId: currentEntity.id })}
                >
                  Delete
                </button>
              </div>
            )}
          </section>
          {(activeInspectorView === "INVALID" || activeInspectorView === "PREVIEW") && (
            <section
              className={styles.inspectorSection}
              aria-label={activeInspectorView === "PREVIEW" ? "Preview selection" : "Unavailable selection"}
            >
              <h3>{activeInspectorView === "PREVIEW" ? "Review this proposal" : "Selection unavailable"}</h3>
              <p>
                {activeInspectorView === "PREVIEW"
                  ? "This object belongs to an unapplied proposal. Review and apply it before editing the saved scene."
                  : missingRoomFeature
                    ? "The selected room feature is absent from this working scene. Choose another feature or undo its removal."
                    : "The selected object is absent from this working scene. Choose another object, inspect the scene, or undo its removal."}
              </p>
              {activeInspectorView === "PREVIEW" && (
                <button onClick={() => setAssistantOpen(true)}>Review placement preview</button>
              )}
              {activeInspectorView === "INVALID" && history.past.length > 0 && (
                <button disabled={busy} onClick={() => writeHistory(undo(historyRef.current!))}>
                  Undo last edit
                </button>
              )}
              <button onClick={() => setInspectorView("SCENE")}>Open scene settings</button>
              {missingRoomFeature
                ? draft.content.studio?.environment?.features.map((feature) => (
                    <button key={feature.id} onClick={() => selectRoomFeature(feature.id, { individual: true })}>
                      {feature.name}
                    </button>
                  ))
                : draft.content.entities.map((entity) => (
                    <button key={entity.id} onClick={() => setSelected(entity.id)}>
                      {entity.name}
                    </button>
                  ))}
            </section>
          )}
          {groupActive && activeInspectorView !== "SCENE" && (
            <GroupSelectionInspector
              mode={mode as "GUIDED" | "DETAILED" | "ENGINEERING"}
              view={activeInspectorView === "CONTEXT" ? "CONTEXT" : "PROPERTIES"}
              onTool={(tool) => requestCanvasCommand("TOOL", tool)}
              name={selectedGroup?.name ?? "Selection"}
              count={selectionMembers.length}
              pivot={editingSelectionPivot(draft, selectionMembers, environment)}
              disabled={
                groupingDisabled || (!roomEditing && selectionMembers.some((member) => member.kind === "ROOM_FEATURE"))
              }
              locked={selectionMembers.some(
                (member) =>
                  member.kind === "ASSET" &&
                  draft.content.studio?.layers.some((layer) => layer.entityId === member.id && layer.locked),
              )}
              members={selectionMembers.map((member) => ({
                ...member,
                name:
                  member.kind === "ASSET"
                    ? draft.content.entities.find((entity) => entity.id === member.id)!.name
                    : draft.content.studio!.environment!.features.find((feature) => feature.id === member.id)!.name,
              }))}
              onSelectMember={(member) =>
                member.kind === "ASSET"
                  ? selectAsset(member.id, { individual: true })
                  : selectRoomFeature(member.id, { individual: true })
              }
              automatic={Boolean(draft.content.adaptive && selectionMembers.some((member) => member.kind === "ASSET"))}
              hasRoomFeatures={selectionMembers.some((member) => member.kind === "ROOM_FEATURE")}
              onTransform={transformSelection}
              onGroup={startGrouping}
              onEditMembers={
                selectedGroup ? () => setGroupDialog({ group: selectedGroup, creating: false }) : undefined
              }
              onUngroup={selectedGroup ? ungroupSelection : undefined}
            />
          )}
          {draft.content.studio?.environment &&
            !groupActive &&
            (roomEditing || selectedRoomFeature) &&
            activeInspectorView !== "SCENE" &&
            activeInspectorView !== "INVALID" &&
            activeInspectorView !== "PREVIEW" && (
              <details
                data-room-editor
                className={styles.roomEditorShell}
                open={roomEditing}
                onToggle={(event) => (event.currentTarget.open ? setRoomEditing(true) : finishRoomEditing())}
              >
                <summary>Room &amp; environmental features</summary>
                <RoomEnvironmentEditor
                  key={draft.content.studio.environment.id}
                  room={draft.content.studio.environment}
                  editing={roomEditing}
                  mode={mode as "GUIDED" | "DETAILED" | "ENGINEERING"}
                  view={activeInspectorView === "CONTEXT" ? "CONTEXT" : "PROPERTIES"}
                  onTool={(tool) => requestCanvasCommand("TOOL", tool)}
                  boundSurfaceIds={boundSurfaces}
                  selectedFeatureId={selectedRoomFeature}
                  onSelectFeature={(id) => selectRoomFeature(id, { individual: true })}
                  onChange={(room) => {
                    const next = structuredClone(draft);
                    next.content.studio!.environment = room;
                    replace(next);
                  }}
                />
              </details>
            )}
          {!currentEntity &&
            !groupActive &&
            !selectedRoomFeature &&
            !roomEditing &&
            activeInspectorView === "SCENE" && (
              <section className={styles.sceneOverview} aria-label="Scene overview">
                <h3>Scene overview</h3>
                <p>
                  {draft.content.entities.length} objects · {draft.content.studio?.behaviors.length ?? 0} spatial
                  behaviors
                </p>
                {assistantScenePreview?.content.entities.some((entity) => entity.id === selected) && (
                  <p>
                    This object belongs to the proposed scene. Review and apply the proposal before editing its saved
                    properties.
                  </p>
                )}
                <p>
                  Select an object to edit its clue, placement, and interactions.{" "}
                  {mode === "GUIDED"
                    ? "Guided mode keeps the essential controls in view."
                    : mode === "DETAILED"
                      ? "Standard mode adds appearance and dependencies."
                      : "Engineering mode also exposes coordinates and anchor diagnostics."}
                </p>
                <div>
                  {draft.content.entities.map((entity) => (
                    <button key={entity.id} onClick={() => setSelected(entity.id)}>
                      {entity.name}
                    </button>
                  ))}
                </div>
                <button onClick={() => openLeftTab("ASSETS")}>Add an object from Library</button>
              </section>
            )}
          {currentEntity && !groupActive && activeInspectorView !== "SCENE" && (
            <fieldset disabled={draft.content.studio?.layers.find((l) => l.entityId === currentEntity.id)?.locked}>
              <legend className={styles.srOnly}>Selected spatial object</legend>
              {activeInspectorView === "PROPERTIES" && (
                <SpatialElementInspector
                  entity={currentEntity}
                  mode={mode as "GUIDED" | "DETAILED" | "ENGINEERING"}
                  onChange={(element) => edit({ type: "CONTENT", entityId: currentEntity.id, patch: { element } })}
                />
              )}
              {activeInspectorView === "CONTEXT" &&
                draft.content.entities.some((e) => e.parentEntityId === currentEntity.id) && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      void action(async () => {
                        const composition = extractComposition(draft, currentEntity.id, crypto.randomUUID());
                        const saved = await api({ action: "SAVE", draft: composition, revision: 0 });
                        await api({
                          action: "SAVE_TO_LIBRARY",
                          definitionId: composition.content.definitionId,
                          revision: saved.revision,
                        });
                        await load();
                        setStatus("Composition saved to My Spatial Library");
                      })
                    }
                  >
                    Save selected composition
                  </button>
                )}
              <section className={styles.inspectorSection} hidden={activeInspectorView !== "PROPERTIES"}>
                <h3>Identity &amp; message</h3>
                <label>
                  Object name
                  <StudioTextField
                    key={`${currentEntity.id}:name`}
                    value={currentEntity.name}
                    maxLength={160}
                    onCommit={(name) => updateEntity({ name })}
                  />
                </label>
                <label>
                  Clue or message
                  <StudioTextField
                    key={`${currentEntity.id}:content`}
                    value={currentEntity.content}
                    multiline
                    maxLength={2000}
                    onCommit={(content) => updateEntity({ content })}
                  />
                </label>
              </section>
              <section className={styles.inspectorSection} hidden={activeInspectorView !== "CONTEXT"}>
                <h3>Placement &amp; relationships</h3>
                {!isAmbientLight ? (
                  <>
                    <AdaptivePlacement
                      draft={draft}
                      selectedId={selected}
                      mode={mode}
                      replace={replace}
                      resolution={adaptiveResolution}
                    />
                    <SpatialFieldQuality key={draft.content.definitionId} draft={draft} api={api} replace={replace} />
                    <label>
                      Where should this appear?
                      <select
                        aria-label="Semantic placement"
                        disabled={Boolean(draft.content.adaptive)}
                        value=""
                        onChange={(e) =>
                          edit({
                            type: "PLACEMENT",
                            entityId: selected!,
                            placement: e.target.value as "DESK" | "WALL" | "ENTRANCE" | "LOCAL",
                          })
                        }
                      >
                        <option value="" disabled>
                          Choose a placement
                        </option>
                        <option value="DESK">On a desk or table</option>
                        <option value="WALL">On a wall at eye level</option>
                        <option value="ENTRANCE">Near the entrance (reference scene)</option>
                        <option value="LOCAL">In the local scene</option>
                      </select>
                    </label>
                    <small>
                      {draft.content.adaptive
                        ? "Use semantic surface and scene relationships above to place adaptive objects."
                        : "Authored fixed placement. Surface-relative placement asks the Player to choose a surface."}
                    </small>
                  </>
                ) : (
                  <p>Ambient light fills the whole scene; placement does not change its illumination.</p>
                )}
                <div className={styles.inline}>
                  <button onClick={() => edit({ type: "REORDER", entityId: selected!, offset: -1 })}>Layer up</button>
                  <button onClick={() => edit({ type: "REORDER", entityId: selected!, offset: 1 })}>Layer down</button>
                </div>
                <label>
                  Group / parent
                  <select
                    value={currentEntity.parentEntityId ?? ""}
                    disabled={Boolean(draft.content.adaptive)}
                    onChange={(e) => edit({ type: "PARENT", entityId: selected!, parentId: e.target.value || null })}
                  >
                    <option value="">Scene root</option>
                    {draft.content.entities
                      .filter((e) => e.id !== selected)
                      .map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name}
                        </option>
                      ))}
                  </select>
                </label>
              </section>
              <section
                className={styles.inspectorSection}
                hidden={
                  activeInspectorView !== "PROPERTIES" ||
                  isAmbientLight ||
                  (mode === "DETAILED" && isOmnidirectionalOutput)
                }
              >
                <h3>
                  {isOmnidirectionalOutput
                    ? mode === "GUIDED"
                      ? "Placement"
                      : "Placement footprint"
                    : elementKind === "LIGHT"
                      ? "Direction & placement"
                      : "Shape & orientation"}
                </h3>
                {mode === "GUIDED" && (
                  <div className={styles.inspectorActions}>
                    <button onClick={() => requestCanvasCommand("TOOL", "translate")}>Move in scene</button>
                    {!isOmnidirectionalOutput && (
                      <button onClick={() => requestCanvasCommand("TOOL", "rotate")}>Rotate in scene</button>
                    )}
                    {hasVisualScale && (
                      <button onClick={() => requestCanvasCommand("TOOL", "scale")}>Resize in scene</button>
                    )}
                  </div>
                )}
                {(hasRenderedWidth || mode === "ENGINEERING") && (
                  <InspectorNumber
                    label={hasRenderedWidth ? "Object width in meters" : "Placement footprint width in meters"}
                    value={currentEntity.widthMeters}
                    min={0.01}
                    max={5}
                    step={0.01}
                    unit="m"
                    onCommit={(widthMeters) => updateEntity({ widthMeters })}
                  />
                )}
                {!hasRenderedWidth && mode === "ENGINEERING" && (
                  <small>
                    Placement footprint controls surface fit and snapping. Use the type-specific controls above to
                    change light reach, sound distance or effect size.
                  </small>
                )}
                {mode !== "GUIDED" && !isOmnidirectionalOutput && (
                  <InspectorRange
                    label="Object rotation in degrees"
                    value={Math.round(rotationDegrees)}
                    min={-180}
                    max={180}
                    step={1}
                    unit="°"
                    onPreview={(value) => previewTransform((transform) => withYaw(transform, value))}
                    onCommit={(value) => updateTransform((transform) => withYaw(transform, value))}
                    onEnd={() => setInspectorTransformPreview(null)}
                  />
                )}
                {mode === "ENGINEERING" && !isOmnidirectionalOutput && (
                  <>
                    <InspectorNumber
                      label="Object pitch in degrees"
                      value={Number(((rotationAngles.x * 180) / Math.PI).toFixed(1))}
                      min={-180}
                      max={180}
                      step={0.1}
                      unit="°"
                      onCommit={(value) => updateTransform((transform) => withRotationAxis(transform, "x", value))}
                    />
                    <InspectorNumber
                      label="Object roll in degrees"
                      value={Number(((rotationAngles.z * 180) / Math.PI).toFixed(1))}
                      min={-180}
                      max={180}
                      step={0.1}
                      unit="°"
                      onCommit={(value) => updateTransform((transform) => withRotationAxis(transform, "z", value))}
                    />
                    <small>Pitch, yaw and roll use local rotation. Rotate in scene edits the same orientation.</small>
                  </>
                )}
                {mode !== "GUIDED" && (hasVisualScale || mode === "ENGINEERING") && (
                  <InspectorRange
                    label={hasVisualScale ? "Object scale" : "Placement footprint scale"}
                    value={currentEntity.transform.scale}
                    min={0.1}
                    max={5}
                    step={0.05}
                    onPreview={(value) => previewTransform((transform) => ({ ...transform, scale: value }))}
                    onCommit={(value) => updateTransform((transform) => ({ ...transform, scale: value }))}
                    onEnd={() => setInspectorTransformPreview(null)}
                  />
                )}
              </section>
              <section
                className={styles.inspectorSection}
                hidden={activeInspectorView !== "PROPERTIES" || mode === "GUIDED"}
              >
                <h3>Appearance &amp; layers</h3>
                {mode !== "GUIDED" && (
                  <>
                    <label>
                      Layer audience
                      <select
                        value={draft.content.studio?.layers.find((l) => l.entityId === selected)?.audience ?? "BOTH"}
                        onChange={(e) =>
                          edit({
                            type: "LAYER",
                            entityId: selected!,
                            patch: { audience: e.target.value as "BOTH" | "EDITOR_ONLY" | "RUNTIME_ONLY" },
                          })
                        }
                      >
                        <option>BOTH</option>
                        <option>EDITOR_ONLY</option>
                        <option>RUNTIME_ONLY</option>
                      </select>
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={draft.content.studio?.layers.find((l) => l.entityId === selected)?.selectable ?? true}
                        onChange={(e) =>
                          edit({ type: "LAYER", entityId: selected!, patch: { selectable: e.target.checked } })
                        }
                      />
                      Selectable
                    </label>
                    <label>
                      Entity tags
                      <input
                        value={draft.content.studio?.layers.find((l) => l.entityId === selected)?.tags.join(", ") ?? ""}
                        onChange={(e) =>
                          edit({
                            type: "LAYER",
                            entityId: selected!,
                            patch: {
                              tags: e.target.value
                                .split(",")
                                .map((t) => t.trim())
                                .filter(Boolean),
                            },
                          })
                        }
                      />
                    </label>
                    <p>Sharing: personal. Persistence: local ephemeral. Guided fallback preserves meaning.</p>
                  </>
                )}
              </section>
              <section
                className={styles.inspectorSection}
                hidden={activeInspectorView !== "PROPERTIES" || mode === "GUIDED"}
              >
                <h3>Interactions</h3>
                <p>Choose the interactions available for this object.</p>
                {(["PICK", "INSPECT", "PLACE"] as const).map((type) => (
                  <label key={type}>
                    <input
                      type="checkbox"
                      checked={currentEntity.interactions.includes(type)}
                      disabled={currentEntity.interactions.length === 1 && currentEntity.interactions.includes(type)}
                      onChange={(event) =>
                        updateEntity({
                          interactions: event.target.checked
                            ? [...currentEntity.interactions, type]
                            : currentEntity.interactions.filter((interaction) => interaction !== type),
                        })
                      }
                    />
                    {type === "PICK" ? "Choose" : type === "INSPECT" ? "Inspect" : "Place"}
                  </label>
                ))}
              </section>
              <section className={styles.inspectorSection} hidden={activeInspectorView !== "CONTEXT"}>
                <h3>Behavior &amp; timeline</h3>
                <p>
                  {draft.content.studio?.behaviors.filter((behavior) => behavior.targetEntityId === selected).length ??
                    0}{" "}
                  authored behaviors for this object.
                </p>
                <button onClick={() => openBottomTab("TIMELINE")}>Edit selected object timeline</button>
                <button onClick={() => openBottomTab("SIMULATION")}>Simulate interactions</button>
              </section>
              <section
                className={styles.inspectorSection}
                hidden={activeInspectorView !== "PROPERTIES" || mode !== "ENGINEERING"}
              >
                <h3>Precision &amp; diagnostics</h3>
                {mode === "ENGINEERING" && (
                  <>
                    <p>
                      Coordinate frame: {currentEntity.coordinateSpace}
                      <br />
                      Anchor: {currentEntity.anchorId}
                      <br />
                      Evidence: nonauthoritative
                    </p>
                    {!isAmbientLight &&
                      (["x", "y", "z"] as const).map((axis) => (
                        <InspectorNumber
                          key={axis}
                          label={`Position ${axis}`}
                          value={currentEntity.transform.position[axis]}
                          step={0.05}
                          unit="m"
                          onCommit={(value) =>
                            updateTransform((transform) => ({
                              ...transform,
                              position: { ...transform.position, [axis]: value },
                            }))
                          }
                        />
                      ))}
                    {isAmbientLight && (
                      <small>Ambient illumination is uniform; position and orientation do not affect it.</small>
                    )}
                  </>
                )}
                {currentEntity && mode !== "GUIDED" && (
                  <SpatialDependencies draft={draft} entityId={currentEntity.id} onChange={replace} />
                )}
              </section>
            </fieldset>
          )}
          <section hidden={activeInspectorView !== "SCENE"}>
            <div className={styles.inspectorGroupLabel}>Environment</div>
            {draft.content.studio?.environmentBinding && (
              <section aria-label="Environment snapshot">
                <small>
                  Independent room snapshot · source revision {draft.content.studio.environmentBinding.revision}. Room
                  edits here affect this scene only.
                </small>
                <button
                  disabled={busy}
                  onClick={() =>
                    void action(async () => {
                      await persist();
                      const data = await load();
                      const source = data.environments?.find(
                        (e) => e.id === draft.content.studio!.environmentBinding!.definitionId && !e.archived,
                      );
                      if (!source)
                        throw new Error(
                          "Restore the original environment from Archived before editing it. This room snapshot remains usable.",
                        );
                      setEnvironmentRecord(source);
                    })
                  }
                >
                  Edit original environment
                </button>
              </section>
            )}
            <details>
              <summary role="button">Room photograph reconstruction</summary>
              <RoomPhotoPanel
                key={draft.content.definitionId}
                draft={draft}
                onPreview={roomPreview}
                csrfToken={() => csrf.current}
                prepare={async () => {
                  await persist();
                  return { draft: draftRef.current!, revision: revision.current, editorGeneration: generation.current };
                }}
                isCurrent={(base) =>
                  base.draft.content.definitionId === draftRef.current?.content.definitionId &&
                  base.editorGeneration === generation.current
                }
                apply={(base, proposal) => applyRoomProposal(base, proposal)}
              />
            </details>
          </section>
          {currentEntity && !groupActive && !selectedRoomFeature && !roomEditing && (
            <section className={styles.inspectorSection} hidden={activeInspectorView !== "PROPERTIES"}>
              <h3>Accessibility</h3>
              <label>
                Accessible description
                <StudioTextField
                  key={`${currentEntity.id}:alternativeText`}
                  value={currentEntity.alternativeText}
                  multiline
                  maxLength={2000}
                  disabled={Boolean(
                    draft.content.studio?.layers.find((layer) => layer.entityId === currentEntity.id)?.locked,
                  )}
                  onCommit={(alternativeText) => updateEntity({ alternativeText })}
                />
              </label>
            </section>
          )}
          <section className={styles.inspectorSection} hidden={activeInspectorView !== "SCENE"}>
            <h3>Guided fallback</h3>
            <label>
              When AR is unavailable
              <StudioTextField
                key={`${draft.content.definitionId}:fallback`}
                value={draft.content.fallback.narrative}
                multiline
                maxLength={4000}
                onCommit={(narrative) => edit({ type: "FALLBACK", narrative })}
              />
            </label>
          </section>
          <section className={styles.inspectorSection} hidden={activeInspectorView !== "SCENE"}>
            <h3>Scene identity</h3>
            <label>
              Experience title
              <input
                value={draft.content.title}
                onChange={(event) => replace({ ...draft, content: { ...draft.content, title: event.target.value } })}
              />
            </label>
            {mode === "ENGINEERING" && (
              <small>
                Working definition: {draft.content.definitionId} · saved revision: {savedRevision}
              </small>
            )}
          </section>
          <section hidden={activeInspectorView !== "SCENE"} aria-label="Library, reuse & publication">
            <details key={`scene-library-${mode}`} className={styles.inspectorSection} open={mode !== "GUIDED"}>
              <summary>Library, reuse &amp; publication</summary>
              {currentEntity && !groupActive && !selectedRoomFeature && !roomEditing && (
                <SaveSpatialAsset
                  key={currentEntity.id}
                  name={currentEntity.name}
                  busy={busy}
                  onSave={async (metadata) => {
                    await action(async () => {
                      await persist();
                      assetExportOperation.current ??= {
                        action: "ASSET_SAVE",
                        operation: { newId: crypto.randomUUID(), operationId: crypto.randomUUID() },
                        draft: draftRef.current,
                        revision: revision.current,
                        rootId: currentEntity.id,
                        metadata,
                        environmentId: environment,
                      };
                      await api(assetExportOperation.current);
                      assetExportOperation.current = null;
                      await load();
                      openLeftTab("SAVED");
                      setStatus("Reusable asset definition and immutable version saved; source scene unchanged");
                    });
                  }}
                />
              )}
              {draft.content.studio?.libraryDefinition && (
                <section aria-label="Reusable definition metadata">
                  <p>You are editing the reusable definition. Existing placed copies keep their pinned version.</p>
                  <label>
                    Definition description
                    <textarea
                      maxLength={1000}
                      value={draft.content.studio.libraryDefinition.description}
                      onChange={(e) => {
                        const next = structuredClone(draft);
                        next.content.studio!.libraryDefinition!.description = e.target.value;
                        replace(next);
                      }}
                    />
                  </label>
                  <label>
                    Definition classification
                    <input
                      maxLength={60}
                      value={draft.content.studio.libraryDefinition.classification}
                      onChange={(e) => {
                        if (!e.target.value.trim()) return;
                        const next = structuredClone(draft);
                        next.content.studio!.libraryDefinition!.classification = e.target.value;
                        replace(next);
                      }}
                    />
                  </label>
                </section>
              )}
              {currentEntity &&
                !groupActive &&
                !selectedRoomFeature &&
                !roomEditing &&
                draft.content.studio?.assetInstances
                  ?.filter((i) => i.entityIds.includes(currentEntity.id))
                  .map((i) => (
                    <section key={i.id} aria-label="Placed asset instance">
                      <p>Independent instance · pinned {i.versionId}. Edits here affect this scene only.</p>
                      <div className={styles.inline}>
                        <button
                          disabled={busy}
                          onClick={() =>
                            void action(async () => {
                              await persist();
                              const data = await load(i.definitionId);
                              const source = data.items.find((item) => item.id === i.definitionId && !item.archived);
                              if (!source)
                                throw new Error(
                                  "Restore the original asset from Archived before editing it. This instance remains usable.",
                                );
                              install(source.draft, source.revision, true);
                              setEnvironment("bedroom");
                            })
                          }
                        >
                          Edit original asset
                        </button>
                        <button
                          disabled={busy}
                          onClick={() =>
                            void action(async () => {
                              await persist();
                              const result = await api({
                                action: "ASSET_INSERT",
                                draft: draftRef.current,
                                revision: revision.current,
                                definitionId: i.definitionId,
                                versionId: i.versionId,
                              });
                              replace(draftSchema.parse(result.draft));
                              await persist();
                              await load();
                            })
                          }
                        >
                          Add another instance
                        </button>
                      </div>
                    </section>
                  ))}
              <section>
                <h3>My Spatial Library</h3>
                <button
                  disabled={draft.scope === "MY_LIBRARY"}
                  onClick={() => replace({ ...draft, scope: "MY_LIBRARY" })}
                >
                  Save to Spatial Library
                </button>
                <label>
                  Category
                  <select
                    value={draft.category}
                    onChange={(e) => replace({ ...draft, category: e.target.value as SpatialDraft["category"] })}
                  >
                    {[
                      "MOMENT",
                      "ENTITY",
                      "PLACEMENT_RECIPE",
                      "INTERACTION_BEHAVIOR",
                      "EFFECT",
                      "DISCOVERY_PROFILE",
                      "SCENE_TEMPLATE",
                    ].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Tags
                  <input
                    value={draft.tags.join(", ")}
                    onChange={(e) =>
                      replace({
                        ...draft,
                        tags: e.target.value
                          .split(",")
                          .map((t) => t.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </label>
                <label>
                  Collection
                  <input value={draft.collection} onChange={(e) => replace({ ...draft, collection: e.target.value })} />
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={draft.favorite}
                    onChange={(e) => replace({ ...draft, favorite: e.target.checked })}
                  />
                  Favorite
                </label>
                <button
                  onClick={() =>
                    void action(async () => {
                      await persist();
                      const data = await load();
                      setLibraryDialog({
                        entry: libraryEntries(data.items).find((e) => e.id === draft.content.definitionId)!,
                        mode: "SAVE_AS",
                      });
                    })
                  }
                >
                  Save as new…
                </button>
              </section>
              <section>
                <h3>Versions and attachment</h3>
                {!releases.length && <p>Create an immutable version after validation.</p>}
                {releases.map((v) => (
                  <button key={v.id} aria-pressed={releaseId === v.id} onClick={() => chooseRelease(v)}>
                    v{v.semanticVersion} · {v.entities.length} objects
                  </button>
                ))}
                {releaseId && (
                  <p>
                    <small>Pinned {releases.find((v) => v.id === releaseId)?.checksum.slice(0, 16)}…</small>
                    <button
                      onClick={() => {
                        const v = releases.find((v) => v.id === releaseId)!;
                        const { checksum: _checksum, ...content } = v;
                        void _checksum;
                        replace({ ...draft, content });
                      }}
                    >
                      Open version in working draft
                    </button>
                  </p>
                )}
                {loaded.chronicle ? (
                  <>
                    <label>
                      Attach to Passage
                      <select value={targetBlock} onChange={(e) => setTargetBlock(e.target.value)}>
                        <option value="">Choose a Passage</option>
                        {loaded.chronicle.blocks.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.title}
                            {b.spatialMoment ? ` · pinned v${b.spatialMoment.version.semanticVersion}` : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Contextual narrative override
                      <textarea value={override} onChange={(e) => setOverride(e.target.value)} />
                    </label>
                    <button
                      disabled={!targetBlock || !releaseId || busy}
                      onClick={() =>
                        void action(async () => {
                          await persist();
                          const before =
                            loaded.chronicle!.blocks.find((b) => b.id === targetBlock)?.spatialMoment ?? null;
                          await api({
                            action: "ATTACH",
                            definitionId: draft.content.definitionId,
                            versionId: releaseId,
                            chronicleId: loaded.chronicle!.id,
                            blockId: targetBlock,
                            autosaveVersion: loaded.chronicle!.autosaveVersion,
                            narrative: override || undefined,
                          });
                          const refreshed = await load();
                          const after = refreshed.chronicle!.blocks.find((b) => b.id === targetBlock)!.spatialMoment!;
                          if (
                            !before ||
                            loaded.items.some((i) =>
                              spatialReleaseIndex(i).some(
                                (v) => v.id === before.version.id && v.checksum === before.version.checksum,
                              ),
                            )
                          ) {
                            setAttachmentPast([...attachmentPast, { blockId: targetBlock, before, after }].slice(-100));
                            setAttachmentFuture([]);
                          } else
                            setStatus(
                              "Pinned version attached. Imported attachment history remains in its original Chronicle.",
                            );
                          setStatus(
                            "Pinned spatial version attached. Continue Chronicle validation and publication in Creator Studio.",
                          );
                        })
                      }
                    >
                      Attach exact version
                    </button>
                    <button
                      disabled={!attachmentPast.length || busy}
                      onClick={() => restoreAttachment(attachmentPast[attachmentPast.length - 1], "UNDO")}
                    >
                      Undo attachment
                    </button>
                    <button
                      disabled={!attachmentFuture.length || busy}
                      onClick={() => restoreAttachment(attachmentFuture[attachmentFuture.length - 1], "REDO")}
                    >
                      Redo attachment
                    </button>
                    <Link
                      href={`/studio/tales/${encodeURIComponent(loaded.chronicle.id)}/versions`}
                      onClick={(event) => {
                        if (event.ctrlKey || event.metaKey) return;
                        event.preventDefault();
                        if (busy) return;
                        const href = event.currentTarget.href;
                        void action(async () => {
                          await persist();
                          window.location.assign(href);
                        });
                      }}
                    >
                      Publish and reopen Chronicle →
                    </Link>
                  </>
                ) : (
                  <p>Open Spatial Studio from a Chronicle Passage to attach an exact release version.</p>
                )}
              </section>
            </details>
          </section>
        </aside>
        <nav className={`${styles.dockRail} ${styles.rightRail}`} aria-label="Inspector dock">
          <button
            aria-label={selectionDetailsOnly ? "Open selection details" : "Open object properties"}
            aria-pressed={
              inspectorOpen &&
              (activeInspectorView === "PROPERTIES" ||
                activeInspectorView === "INVALID" ||
                activeInspectorView === "PREVIEW")
            }
            title={selectionDetailsOnly ? "Selection status and recovery" : "Properties of the selected item"}
            disabled={!currentEntity && !groupActive && !selectedRoomFeature && !roomEditing && !selected}
            onKeyUp={settleInspectorAfterRailKey}
            onClick={() => {
              setInspectorTransformPreview(null);
              setInspectorView("PROPERTIES");
              setInspectorOpen(true);
            }}
          >
            ◈
          </button>
          <button
            aria-label="Open spatial context"
            aria-pressed={inspectorOpen && activeInspectorView === "CONTEXT"}
            title="Placement, relationships, and behavior links"
            disabled={missingRoomFeature || (!currentEntity && !groupActive && !selectedRoomFeature && !roomEditing)}
            onKeyUp={settleInspectorAfterRailKey}
            onClick={() => {
              setInspectorTransformPreview(null);
              setInspectorView("CONTEXT");
              setInspectorOpen(true);
            }}
          >
            ◎
          </button>
          <button
            aria-label="Open scene settings"
            aria-pressed={inspectorOpen && activeInspectorView === "SCENE"}
            title="Scene fallback, library details, and versions"
            onKeyUp={settleInspectorAfterRailKey}
            onClick={() => {
              setInspectorTransformPreview(null);
              setInspectorView("SCENE");
              setInspectorOpen(true);
            }}
          >
            ▣
          </button>
        </nav>
      </div>
      {contextMenu.menu}
      {graphOrder.ghost}
      {environmentDialog && (
        <EnvironmentCreateDialog
          initialStep={environmentDialog.initialStep}
          items={[]}
          environments={loaded.environments ?? []}
          onClose={() => setEnvironmentDialog(null)}
          onCreate={async (room) => {
            await persist();
            const document = createEnvironmentDraft(environmentDialog.photoDraft.content.definitionId, room);
            const result = await api({ action: "ENVIRONMENT_SAVE", document, revision: photoDraftRevision.current });
            const data = await load();
            setEnvironmentRecord(data.environments!.find((e) => e.id === document.id)!);
            photoDraftRevision.current = result.revision;
            setStatus("Environment working draft created · source scene unchanged");
          }}
          photo={{
            draft: environmentDialog.photoDraft,
            csrfToken: () => csrf.current,
            prepare: async () => {
              await persist();
              if (generation.current !== environmentDialog.generation)
                throw new Error("The scene changed. Reopen environment setup.");
              const result = await api({
                action: "ENVIRONMENT_SAVE",
                document: createEnvironmentDraft(environmentDialog.photoDraft.content.definitionId),
                revision: photoDraftRevision.current,
              });
              photoDraftRevision.current = result.revision;
              return {
                draft: environmentDialog.photoDraft,
                revision: result.revision,
                editorGeneration: environmentDialog.generation,
              };
            },
            isCurrent: (base) =>
              base.draft.content.definitionId === environmentDialog.photoDraft.content.definitionId &&
              base.editorGeneration === generation.current &&
              draftRef.current?.content.definitionId === environmentDialog.originalDefinition,
            apply: async (base, proposal) => {
              const response = await fetch("/api/studio/parallax/room-photo", {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-csrf-token": csrf.current },
                body: JSON.stringify({ action: "APPLY", ...base, proposal }),
              });
              const result = await response.json();
              if (!response.ok)
                throw new Error(result.message ?? result.error ?? "Room proposal could not be applied.");
              const document = environmentDraftSchema.parse(result.environmentDraft);
              const data = await load();
              setEnvironmentDialog(null);
              setEnvironmentRecord(data.environments!.find((e) => e.id === document.id)!);
            },
          }}
        />
      )}
      {libraryDialog && (
        <LibraryManagementDialog
          request={libraryDialog}
          api={api}
          prepare={async () => {
            if (libraryDialog.retainedSnapshot) return libraryDialog.entry.revision;
            await persist();
            return libraryDialog.entry.id === draft.content.definitionId
              ? revision.current
              : libraryDialog.entry.revision;
          }}
          onClose={() => setLibraryDialog(null)}
          onChanged={async (id) => {
            const data = await load();
            const target = id ?? libraryDialog.entry.id;
            const entry = libraryEntries(data.items, data.environments).find((e) => e.id === target);
            if (entry?.environment && id) setEnvironmentRecord(entry.environment);
            else if (entry?.scene && (id || target === draft.content.definitionId)) {
              if (id) install(entry.scene.draft, entry.revision, true);
              else {
                revision.current = entry.revision;
                setSavedRevision(entry.revision);
                savedJson.current = JSON.stringify(entry.scene.draft);
                setSavedSceneSnapshot(JSON.stringify(entry.scene.draft));
                writeHistory(changeHistory(historyRef.current!, { type: "REPLACE", draft: entry.scene.draft }));
              }
            }
          }}
        />
      )}
      {recovery && (
        <dialog open className={styles.groupDialog} aria-label="Working draft recovery">
          <h2>Recover unsaved edits</h2>
          <p>
            Your browser retained this working draft.{" "}
            {recovery.revision === (recovery.server?.revision ?? savedRevision)
              ? "The saved revision matches its base."
              : "Another editor may have changed the saved revision. Review both before applying."}
          </p>
          {recovery.server && (
            <p>
              Saved revision {recovery.server.revision} · {recovery.server.draft.content.title}. Retained edits started
              at revision {recovery.revision}.
            </p>
          )}
          <button
            onClick={() => {
              if ("format" in recovery.document) return;
              const source = loaded.items.find((i) => i.id === draft.content.definitionId);
              if (!source) return;
              const entry = libraryEntries([{ ...source, draft: recovery.document, revision: recovery.revision }])[0];
              setLibraryDialog({ entry, mode: "SAVE_AS", retainedSnapshot: recovery.document });
              setRecovery(null);
            }}
          >
            Preserve retained edits as new…
          </button>
          <button
            onClick={() => {
              if (!("format" in recovery.document)) {
                writeHistory(changeHistory(historyRef.current!, { type: "REPLACE", draft: recovery.document }));
                revision.current = recovery.revision;
                setSavedRevision(recovery.revision);
              }
              setRecovery(null);
            }}
          >
            Review retained edits
          </button>
          <button
            onClick={() => {
              clearWorkingJournal(accountScope.current, draft.content.definitionId, recovery.document);
              if (recovery.server) install(recovery.server.draft, recovery.server.revision, true);
              setRecovery(null);
            }}
          >
            Keep saved draft
          </button>
        </dialog>
      )}
      {groupDialog && (
        <GroupMembershipDialog
          key={groupDialog.group.id}
          draft={draft}
          group={groupDialog.group}
          creating={groupDialog.creating}
          environmentEditing={roomEditing && environment === draft.content.studio?.environment?.id}
          onSave={(group) => saveGroup(group, groupDialog.creating)}
          onCancel={() => {
            setGroupDialog(null);
            requestAnimationFrame(() =>
              studioElement.current
                ?.querySelector<HTMLButtonElement>(
                  '[aria-label="Group selected items"],[aria-label="Edit selected group"]',
                )
                ?.focus(),
            );
          }}
        />
      )}
    </main>
  );
}

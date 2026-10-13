"use client";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type SyntheticEvent,
  type PointerEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  changeHistory,
  createSpatialDraft,
  draftSchema,
  forkSpatialDraft,
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
import { SpatialAssetBrowser } from "./SpatialAssetBrowser";
import { PlacementComposer } from "./PlacementComposer";
import { BehaviorTracks } from "./BehaviorTracks";
import { AnimationEditor } from "./AnimationEditor";
import { RoomEnvironmentEditor } from "./RoomEnvironmentEditor";
import { RoomPhotoPanel } from "./RoomPhotoPanel";
import { boundRoomSurfaceIds } from "@/parallax/parametric-room";
import { SaveSpatialAsset, SavedSpatialLibrary } from "./SavedSpatialLibrary";
import { authoredPreviewEnvironment, createRoomEnvironment } from "@/parallax/environment-authoring";
import { insertSpatialPreset } from "@/parallax/editor-assets";
import { syntheticEnvironmentEvidence } from "@/parallax/adaptive-authoring";
import { resolveAdaptiveScene } from "@/parallax/adaptive";
import { appendSpatialInput, initialSpatialInputs, type SpatialInput } from "@/parallax/behavior";
import { SpatialSimulation, SimulationEvents } from "./SpatialSimulation";
import type { RendererReceipt } from "./spatial-workstation";
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
  chronicle: Chronicle | null;
  aiAvailable: boolean;
  aiConfigured: boolean;
  aiUsage: Awaited<ReturnType<typeof creatorAIUsage>>;
};
type AttachmentChange = { blockId: string; before: SpatialMoment | null; after: SpatialMoment };
const fresh = (chronicleId?: string) => createSpatialDraft(crypto.randomUUID(), "Desk Map", chronicleId ?? null);
function bindSavedSceneUrl(definitionId: string) {
  const url = new URL(window.location.href);
  if (url.pathname !== "/studio/parallax" || url.searchParams.get("definition") === definitionId) return;
  url.searchParams.set("definition", definitionId);
  // Preserve Chronicle/Passage context and Next's history state without a route
  // navigation that would remount the editor and discard ordinary Undo history.
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}
export function SpatialStudio({
  chronicleId,
  definitionId,
  entityId,
  blockId,
}: {
  chronicleId?: string;
  definitionId?: string;
  entityId?: string;
  blockId?: string;
}) {
  const [loaded, setLoaded] = useState<Loaded | null>(null),
    [history, setHistoryState] = useState<History | null>(null);
  const [editorGeneration, setEditorGeneration] = useState(0),
    [savedRevision, setSavedRevision] = useState(0);
  const [attachmentPast, setAttachmentPast] = useState<AttachmentChange[]>([]),
    [attachmentFuture, setAttachmentFuture] = useState<AttachmentChange[]>([]);
  const [selected, setSelected] = useState<string | null>(entityId ?? null),
    [mode, setMode] = useState("GUIDED"),
    [preview, setPreview] = useState("EDITOR"),
    [environment, setEnvironment] = useState("bedroom");
  const [sceneQuery, setSceneQuery] = useState(""),
    [status, setStatus] = useState("Opening Spatial Studio…"),
    [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
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
  const [assistantScenePreview, setAssistantScenePreview] = useState<SpatialDraft | null>(null);
  const [roomScenePreview, setRoomScenePreview] = useState<SpatialDraft | null>(null);
  const [assistantHighlights, setAssistantHighlights] = useState<readonly string[]>([]);
  const writeHistory = useCallback((next: History) => {
    historyRef.current = next;
    draftRef.current = next.present;
    generation.current += 1;
    setEditorGeneration(generation.current);
    setHistoryState(next);
    setAssistantScenePreview(null);
    setRoomScenePreview(null);
    setAssistantHighlights([]);
  }, []);
  const draft = history?.present;
  const authoredEnvironmentId = draft?.content.studio?.environment?.id;
  useEffect(() => {
    queueMicrotask(() => setEnvironment(authoredEnvironmentId ?? "bedroom"));
  }, [draft?.content.definitionId, authoredEnvironmentId]);
  const previewEnvironment = draft
    ? authoredPreviewEnvironment(
        draft.content,
        simulationEnvironments.find((e) => e.id === environment) ?? { ...simulationEnvironments[0], id: environment },
      )
    : simulationEnvironments[0];
  const { layout, setLayout, reset: resetWorkspace, choose: chooseWorkspace } = useWorkspaceLayout(loaded?.layoutScope);
  const { libraryOpen, inspectorOpen, libraryWidth, inspectorWidth, bottomOpen, bottomHeight, leftTab, bottomTab } =
    layout;
  const setLibraryOpen = (open: boolean) =>
    setLayout((previous) => ({
      ...previous,
      libraryOpen: open,
      inspectorOpen: open && innerWidth < 1100 ? false : previous.inspectorOpen,
    }));
  const setInspectorOpen = (open: boolean) =>
    setLayout((previous) => ({
      ...previous,
      inspectorOpen: open,
      libraryOpen: open && innerWidth < 1100 ? false : previous.libraryOpen,
    }));
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
  const sectionProps = (id: WorkspaceLayout["expandedInspector"][number]) => ({
    className: styles.inspectorSection,
    open: layout.expandedInspector.includes(id),
    onToggle: (event: SyntheticEvent<HTMLDetailsElement>) => {
      const open = event.currentTarget.open;
      setLayout((previous) =>
        previous.expandedInspector.includes(id) === open
          ? previous
          : {
              ...previous,
              expandedInspector: open
                ? [...previous.expandedInspector, id]
                : previous.expandedInspector.filter((section) => section !== id),
            },
      );
    },
  });
  const openLeftTab = (tab: WorkspaceLayout["leftTab"]) =>
    setLayout((previous) => ({
      ...previous,
      leftTab: tab,
      libraryOpen: true,
      inspectorOpen: innerWidth < 1100 ? false : previous.inspectorOpen,
    }));
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
    if (!response.ok) throw new Error(data.error ?? "Spatial Studio could not save this change.");
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
        if (draftRef.current?.content.definitionId === snapshot.content.definitionId)
          bindSavedSceneUrl(snapshot.content.definitionId);
      }
      setStatus("Working draft saved");
    };
    saving.current = task().finally(() => {
      saving.current = null;
    });
    return saving.current;
  }, [api]);
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
          await persist();
          return readBase();
        },
        installSaved: (saved) => {
          const current = historyRef.current;
          if (!current) throw new Error("The working scene is unavailable.");
          revision.current = saved.revision;
          setSavedRevision(saved.revision);
          savedJson.current = JSON.stringify(saved.draft);
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
  const closeAssistant = () => {
    setAssistantOpen(false);
    assistantPreview(null, []);
    setPlacementPreview(null);
  };
  const install = useCallback(
    (next: SpatialDraft, nextRevision: number, saved: boolean) => {
      draftRef.current = next;
      revision.current = nextRevision;
      setSavedRevision(nextRevision);
      savedJson.current = saved ? JSON.stringify(next) : "";
      if (saved) bindSavedSceneUrl(next.content.definitionId);
      writeHistory({ past: [], present: next, future: [] });
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
    [entityId, writeHistory],
  );
  const load = useCallback(async () => {
    const response = await fetch(
      `/api/studio/parallax${chronicleId ? `?chronicle=${encodeURIComponent(chronicleId)}` : ""}`,
      { cache: "no-store" },
    );
    const data = (await response.json()) as Loaded & { error?: string };
    if (!response.ok) throw new Error(data.error ?? "Spatial Studio is unavailable.");
    csrf.current = data.csrfToken;
    accountScope.current = data.layoutScope ?? "";
    setLoaded(data);
    return data;
  }, [chronicleId]);
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      void load()
        .then((data) => {
          if (cancelled || initialized.current) return;
          initialized.current = true;
          const item = data.items.find((i) => i.id === definitionId);
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
            } else install(fresh(chronicleId), 0, false);
          }
          setStatus(item ? "Working draft opened" : "New working draft");
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
  }, [load, install, definitionId, chronicleId, blockId]);
  useEffect(() => {
    if (!draft || !loaded) return;
    const timer = setTimeout(
      () =>
        void persist().catch((cause) => {
          setError(cause.message);
          setStatus("Unsaved changes — retry or fork to preserve them");
        }),
      800,
    );
    return () => clearTimeout(timer);
  }, [draft, loaded, persist]);
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
      if (historyRef.current) writeHistory(changeHistory(historyRef.current, change));
      setFindings(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The edit could not be applied.");
    }
  };
  const replace = (next: SpatialDraft) => edit({ type: "REPLACE", draft: next });
  const addPreset = (name: string) => {
    if (!draft) return;
    try {
      const next = insertSpatialPreset(draft, name, crypto.randomUUID());
      replace(next);
      setSelected(next.content.entities[draft.content.entities.length].id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Asset could not be added.");
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
  const newPreset = (name: string) =>
    void action(async () => {
      await persist();
      const next = createSpatialDraft(crypto.randomUUID(), name, chronicleId ?? null);
      install(next, 0, false);
    });
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
  const objectActions = (id: string): StudioMenuAction[] => {
    const entity = draft?.content.entities.find((entity) => entity.id === id);
    if (!draft || !entity) return [];
    const layer = draft.content.studio?.layers.find((layer) => layer.entityId === id);
    const unavailable =
      busy || preview !== "EDITOR" || Boolean(roomScenePreview || assistantScenePreview || placementPreview);
    const locked = layer?.locked ?? false;
    const inspect = (sections: WorkspaceLayout["expandedInspector"] = ["overview"]) => {
      setSelected(id);
      setInspectorOpen(true);
      setLayout((previous) => ({ ...previous, expandedInspector: sections }));
    };
    return [
      { label: "Inspect object", icon: "inspect", run: () => inspect() },
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
  const unavailable =
    !currentEntity ||
    busy ||
    preview !== "EDITOR" ||
    Boolean(roomScenePreview || assistantScenePreview || placementPreview);
  const graphToolbarActions = [
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
  const localFindings = draft ? (findings ?? validateSpatialAuthoring(draft.content)) : [];
  const chooseRelease = (version: SpatialVersion) => {
    setReleaseId(version.id);
  };
  const updateEntity = (patch: Partial<NonNullable<typeof currentEntity>>) => {
    if (draft && currentEntity)
      replace({
        ...draft,
        content: {
          ...draft.content,
          entities: draft.content.entities.map((e) => (e.id === currentEntity.id ? { ...e, ...patch } : e)),
        },
      });
  };
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement)?.closest?.('[role="menu"]')) return;
      const field =
        event.target instanceof HTMLElement &&
        (event.target.matches("input,textarea,select") || event.target.isContentEditable);
      if (event.key === "Escape") {
        if (assistantOpen) {
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
            document.querySelector<HTMLButtonElement>('[aria-label="Open contextual Inspector"]')?.focus(),
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
              const data = await load();
              install(data.items[0]?.draft ?? fresh(chronicleId), data.items[0]?.revision ?? 0, Boolean(data.items[0]));
            })
          }
        >
          Try again
        </button>
      </main>
    );
  return (
    <main
      ref={studioElement}
      className={`${styles.studio} ${styles.adaptiveWorkspace}`}
      data-mode={mode}
      data-layout={layout.preset}
      data-account-id={loaded.layoutScope}
    >
      <header
        className={styles.header}
        onContextMenu={(event) =>
          contextMenu.open(event, draft.content.title, [
            { label: "Save draft", icon: "save", disabled: busy, run: () => void action(persist) },
            { label: "New scene", icon: "plus", disabled: busy, run: () => newPreset("Desk Map") },
            { label: "Open saved scenes", icon: "inspect", run: () => openLeftTab("SAVED") },
            { label: "Reset workspace layout", icon: "reset", run: resetWorkspace },
          ])
        }
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
          <p className={styles.eyebrow}>PARALLAX / Spatial Studio</p>
          <h1>{draft.content.title}</h1>
          <span role="status">{status}</span>
        </div>
        <div className={styles.toolbar}>
          <label>
            Authoring mode
            <select
              value={mode}
              onChange={(e) => {
                setMode(e.target.value);
                setLayout((previous) => ({
                  ...previous,
                  expandedInspector:
                    e.target.value === "ENGINEERING"
                      ? ["transform", "engineering"]
                      : e.target.value === "DETAILED"
                        ? ["overview", "transform"]
                        : ["overview"],
                }));
                try {
                  sessionStorage.setItem("parallax.authoring-mode", e.target.value);
                } catch {}
              }}
            >
              {["GUIDED", "DETAILED", "ENGINEERING"].map((m) => (
                <option key={m}>{m}</option>
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
                await load();
              })
            }
          >
            Save draft
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
      {error && (
        <div role="alert" className={styles.error}>
          {error}
          <button disabled={busy} onClick={() => void action(persist)}>
            Retry save
          </button>
          <button
            onClick={() => {
              const next = forkSpatialDraft(draft, crypto.randomUUID());
              install(next, 0, false);
            }}
          >
            Preserve as new fork
          </button>
        </div>
      )}
      <nav className={styles.workstationNavigation} aria-label="Workstation panels">
        <div>
          <strong className={styles.workstationBrand}>◈ PARALLAX</strong>
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
        <nav className={styles.dockRail} aria-label="Assets and hierarchy dock">
          {(
            [
              ["ASSETS", "▱", "Open asset Library"],
              ["HIERARCHY", "☷", "Open Scene Hierarchy"],
              ["SAVED", "◇", "Open Saved Spatial Items"],
            ] as const
          ).map(([tab, icon, label]) => (
            <button
              key={tab}
              id={`left-tab-${tab}`}
              aria-controls={`left-panel-${tab}`}
              aria-label={label}
              title={label}
              aria-pressed={libraryOpen && leftTab === tab}
              onClick={() => (libraryOpen && leftTab === tab ? setLibraryOpen(false) : openLeftTab(tab))}
            >
              {icon}
            </button>
          ))}
        </nav>
        <aside className={styles.library} aria-label="Spatial Library" hidden={!libraryOpen}>
          {dockHandle("library")}
          <div className={styles.dockTitle}>
            <h2>
              {leftTab === "ASSETS" ? "Asset Library" : leftTab === "HIERARCHY" ? "Scene graph" : "Saved Library"}
            </h2>
            <button
              aria-label="Collapse left dock"
              onClick={() => {
                studioElement.current?.querySelector<HTMLButtonElement>('[aria-label="Open asset Library"]')?.focus();
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
            hidden={leftTab !== "ASSETS"}
          >
            <p className={styles.dockHelp}>Add an object or start from a scene template.</p>
            <SpatialAssetBrowser busy={busy} onAdd={addPreset} onNew={() => newPreset("Desk Map")} />
          </div>
          <div
            className={styles.leftPane}
            role="tabpanel"
            id="left-panel-SAVED"
            aria-labelledby="left-tab-SAVED"
            hidden={leftTab !== "SAVED"}
          >
            <SavedSpatialLibrary
              items={loaded.items}
              busy={busy}
              chronicleId={chronicleId}
              currentId={draft.content.definitionId}
              onOpen={(item) =>
                void action(async () => {
                  await persist();
                  const data = await load();
                  const current = data.items.find((i) => i.id === item.id);
                  if (!current) throw new Error("This saved item is no longer available.");
                  install(current.draft, current.revision, true);
                  setPreview("EDITOR");
                })
              }
              onDuplicate={(item) =>
                void action(async () => {
                  await persist();
                  const data = await load();
                  const current = data.items.find((i) => i.id === item.id);
                  if (!current) throw new Error("This saved scene is no longer available.");
                  const copy = forkSpatialDraft(current.draft, crypto.randomUUID());
                  copy.chronicleId = chronicleId ?? null;
                  copy.scope = chronicleId ? "CHRONICLE_ONLY" : "MY_LIBRARY";
                  copy.content.title += " copy";
                  install(copy, 0, false);
                  await persist();
                  await load();
                  setStatus("Independent scene copy saved");
                })
              }
              onInsert={(item, versionId) =>
                void action(async () => {
                  await persist();
                  const base = draftRef.current!;
                  const gen = generation.current;
                  const result = await api({
                    action: "ASSET_INSERT",
                    draft: base,
                    revision: revision.current,
                    definitionId: item.id,
                    versionId,
                  });
                  if (
                    generation.current !== gen ||
                    draftRef.current?.content.definitionId !== base.content.definitionId
                  )
                    throw new Error(
                      "Your scene changed while preparing this copy. Add the asset again using the current scene.",
                    );
                  replace(draftSchema.parse(result.draft));
                  setSelected(result.draft.content.entities[base.content.entities.length].id);
                  await persist();
                  await load();
                  setStatus("Independent asset copy added and saved; its definition is unchanged");
                })
              }
              onArchive={(item) =>
                void action(async () => {
                  await persist();
                  await api({ action: "ARCHIVE", definitionId: item.id, revision: item.revision });
                  await load();
                  setStatus("Definition archived; existing scene copies are unchanged");
                })
              }
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
                  Objects <span>{draft.content.entities.length}</span>
                </h2>
                <div role="toolbar" aria-label="Scene graph object actions" className={styles.graphToolbar}>
                  {graphToolbarActions.map((action) => (
                    <button
                      key={action.label}
                      type="button"
                      aria-label={action.label}
                      title={action.label}
                      disabled={action.disabled}
                      data-danger={action.icon === "trash" || undefined}
                      onClick={() =>
                        currentEntity &&
                        objectActions(currentEntity.id)
                          .find((command) => command.label === action.label)
                          ?.run()
                      }
                    >
                      <StudioIcon name={action.icon} />
                    </button>
                  ))}
                </div>
              </div>
              <label>
                <input
                  placeholder="Search scene…"
                  aria-label="Scene graph search"
                  value={sceneQuery}
                  onChange={(e) => setSceneQuery(e.target.value)}
                />
              </label>
              <ul>
                {draft.content.entities
                  .filter((e) =>
                    `${e.name} ${e.kind} ${e.anchorId} ${e.interactions.join(" ")} ${draft.content.studio?.layers.find((l) => l.entityId === e.id)?.tags.join(" ")}`
                      .toLowerCase()
                      .includes(sceneQuery.toLowerCase()),
                  )
                  .map((entity) => {
                    const l = draft.content.studio?.layers.find((l) => l.entityId === entity.id);
                    return (
                      <li key={entity.id} style={{ paddingLeft: entity.parentEntityId ? 16 : 0 }}>
                        <button
                          aria-pressed={selected === entity.id}
                          onClick={() => setSelected(entity.id)}
                          onContextMenu={(event) => {
                            setSelected(entity.id);
                            contextMenu.open(event, entity.name, objectActions(entity.id));
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
                              setSelected(entity.id);
                              contextMenu.open(event, entity.name, objectActions(entity.id));
                            }
                          }}
                        >
                          <span className={styles.graphAssetIcon}>
                            <StudioIcon name={entity.parentEntityId ? "copy" : "frame"} />
                          </span>
                          <span className={styles.graphAssetName}>
                            {entity.name}
                            <small>{entity.kind.replaceAll("_", " ").toLowerCase()}</small>
                          </span>
                          <span className={styles.graphAssetState}>
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
                      </li>
                    );
                  })}
              </ul>
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
              <select aria-label="Environment" value={environment} onChange={(e) => setEnvironment(e.target.value)}>
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
                if (!draft.content.studio?.environment || environment !== draft.content.studio.environment.id) {
                  const next = structuredClone(draft);
                  next.content.studio ??= emptyStudioContent();
                  next.content.studio.environment = createRoomEnvironment(previewEnvironment);
                  replace(next);
                  setEnvironment(next.content.studio.environment.id);
                }
                setInspectorOpen(true);
                queueMicrotask(() => {
                  const panel = document.querySelector<HTMLDetailsElement>("[data-room-editor]");
                  if (panel) panel.open = true;
                });
              }}
            >
              Edit room features
            </button>
            <button
              onClick={() => {
                setFindings(validateSpatialAuthoring(draft.content));
                setValidationOpen(true);
              }}
            >
              Test in 10 environments
            </button>
          </div>
          <SpatialCanvas
            highlightedEntityIds={assistantHighlights}
            draft={roomScenePreview ?? assistantScenePreview ?? placementPreview ?? draft}
            selectedId={selected}
            onSelect={setSelected}
            onInspect={() => setInspectorOpen(true)}
            objectActions={objectActions}
            onEdit={
              roomScenePreview || assistantScenePreview || placementPreview
                ? () => setError("Approve or discard the proposal preview before editing objects.")
                : edit
            }
            onPreset={addPreset}
            mode={mode}
            preview={preview}
            environmentId={roomScenePreview?.content.studio?.environment?.id ?? environment}
            timeMs={timeMs}
            onPreviewChange={setPreview}
            onRendererReceipt={recordRenderedEntities}
            inputs={inputs}
          />
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
              onClick={() => setAssistantOpen(!assistantOpen)}
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
            <div className={styles.dockTitle}>
              {layout.assistantDocked ? (
                <strong>Ask Parallax</strong>
              ) : (
                <button
                  className={styles.assistantMove}
                  aria-label="Move floating Spatial Assistant"
                  title="Drag to move · arrow keys move · Shift moves farther"
                  data-floating-gesture="move"
                  {...floatingGestureProps}
                >
                  <span aria-hidden="true">⠿</span> Ask Parallax
                  <small className={styles.assistantFeedback} aria-live="polite">
                    {floatingFeedback && ` · ${floatingFeedback}`}
                  </small>
                </button>
              )}
              <div>
                <button
                  aria-pressed={layout.assistantDocked}
                  onClick={() => setLayout((previous) => ({ ...previous, assistantDocked: !previous.assistantDocked }))}
                >
                  {layout.assistantDocked ? "Float assistance" : "Dock assistance"}
                </button>
                <button aria-label="Close assistance" onClick={closeAssistant}>
                  ×
                </button>
              </div>
            </div>
            <details className={styles.assistantDetails}>
              <summary>Guided placement controls</summary>
              <PlacementComposer
                draft={draft}
                selectedId={selected}
                aiAvailable={loaded.aiAvailable}
                onPreview={setPlacementPreview}
                onApply={replace}
              />
            </details>
            {assistantPort && loaded.aiUsage && loaded.layoutScope && (
              <SpatialAssistant
                draft={draft}
                revision={savedRevision}
                editorGeneration={editorGeneration}
                selectedEntityId={draft.content.entities.some((entity) => entity.id === selected) ? selected : null}
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
                <BehaviorTracks
                  draft={draft}
                  timeMs={timeMs}
                  selected={selected}
                  onSelect={setSelected}
                  onTime={seekTimeline}
                  onChange={replace}
                />
                <AnimationEditor
                  draft={draft}
                  selected={selected}
                  timeMs={timeMs}
                  onTime={seekTimeline}
                  onChange={replace}
                />
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
                <details className={styles.timelineProperties}>
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
                    <div className={styles.behavior} key={b.id}>
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
                  {simulateSpatialEnvironments(draft.content).map((e) => (
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
        <aside className={styles.inspector} aria-label="Spatial inspector" hidden={!inspectorOpen}>
          {dockHandle("inspector")}
          <div className={styles.dockTitle}>
            <div className={styles.inspectorIdentity}>
              <small>{currentEntity ? "Selected object" : "Scene inspector"}</small>
              <h2>{currentEntity?.name ?? "Select an entity"}</h2>
              {currentEntity && <span>{currentEntity.kind.replaceAll("_", " ").toLowerCase()}</span>}
            </div>
            {currentEntity && (
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
                studioElement.current
                  ?.querySelector<HTMLButtonElement>('[aria-label="Open contextual Inspector"]')
                  ?.focus();
                setInspectorOpen(false);
              }}
            >
              ›
            </button>
          </div>
          {!currentEntity && (
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
                    ? "Detailed mode adds appearance and dependencies."
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
          {currentEntity && (
            <fieldset disabled={draft.content.studio?.layers.find((l) => l.entityId === currentEntity.id)?.locked}>
              <legend className={styles.srOnly}>Selected spatial object</legend>
              <details {...sectionProps("overview")}>
                <summary>Overview / Identity</summary>
                <label>
                  Object name
                  <input value={currentEntity.name} onChange={(e) => updateEntity({ name: e.target.value })} />
                </label>
                <label>
                  Clue or message
                  <textarea value={currentEntity.content} onChange={(e) => updateEntity({ content: e.target.value })} />
                </label>
              </details>
              <details {...sectionProps("placement")}>
                <summary>Spatial Placement &amp; grouping</summary>
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
                <div className={styles.inline}>
                  <button onClick={() => edit({ type: "DUPLICATE", entityId: selected!, newId: crypto.randomUUID() })}>
                    Duplicate
                  </button>

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
              </details>
              <details {...sectionProps("transform")}>
                <summary>Transform</summary>
                <label>
                  Size in meters
                  <input
                    aria-label="Object width in meters"
                    type="number"
                    min="0.01"
                    max="5"
                    step="0.01"
                    value={currentEntity.widthMeters}
                    onChange={(e) => updateEntity({ widthMeters: Number(e.target.value) })}
                  />
                </label>
                <label>
                  Rotate
                  <input
                    aria-label="Object rotation in degrees"
                    type="range"
                    min="-180"
                    max="180"
                    value={
                      (2 * Math.atan2(currentEntity.transform.rotation.y, currentEntity.transform.rotation.w) * 180) /
                      Math.PI
                    }
                    onChange={(e) => {
                      const r = (Number(e.target.value) * Math.PI) / 360;
                      edit({
                        type: "TRANSFORM",
                        entityId: selected!,
                        transform: {
                          ...currentEntity.transform,
                          rotation: { x: 0, y: Math.sin(r), z: 0, w: Math.cos(r) },
                        },
                      });
                    }}
                  />
                </label>
                <label>
                  Scale
                  <input
                    aria-label="Object scale"
                    type="range"
                    min="0.1"
                    max="5"
                    step="0.05"
                    value={currentEntity.transform.scale}
                    onChange={(e) =>
                      edit({
                        type: "TRANSFORM",
                        entityId: selected!,
                        transform: { ...currentEntity.transform, scale: Number(e.target.value) },
                      })
                    }
                  />
                </label>
              </details>
              <details {...sectionProps("appearance")} hidden={mode === "GUIDED"}>
                <summary>Appearance / layers</summary>
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
              </details>
              <details {...sectionProps("interactions")}>
                <summary>Interactions</summary>
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
              </details>
              <details {...sectionProps("behavior")}>
                <summary>Behavior</summary>
                <p>
                  {draft.content.studio?.behaviors.filter((behavior) => behavior.targetEntityId === selected).length ??
                    0}{" "}
                  authored behaviors for this object.
                </p>
                <button onClick={() => openBottomTab("TIMELINE")}>Edit selected object timeline</button>
                <button onClick={() => openBottomTab("SIMULATION")}>Simulate interactions</button>
              </details>
              <details {...sectionProps("engineering")} hidden={mode !== "ENGINEERING"}>
                <summary>Advanced / Engineering</summary>
                {mode === "ENGINEERING" && (
                  <>
                    <p>
                      Coordinate frame: {currentEntity.coordinateSpace}
                      <br />
                      Anchor: {currentEntity.anchorId}
                      <br />
                      Evidence: nonauthoritative
                    </p>
                    {["x", "y", "z"].map((axis) => (
                      <label key={axis}>
                        Position {axis}
                        <input
                          aria-label={`Position ${axis}`}
                          type="number"
                          step="0.05"
                          value={currentEntity.transform.position[axis as "x" | "y" | "z"]}
                          onChange={(e) =>
                            edit({
                              type: "TRANSFORM",
                              entityId: selected!,
                              transform: {
                                ...currentEntity.transform,
                                position: { ...currentEntity.transform.position, [axis]: Number(e.target.value) },
                              },
                            })
                          }
                        />
                      </label>
                    ))}
                  </>
                )}
                {currentEntity && mode !== "GUIDED" && (
                  <SpatialDependencies draft={draft} entityId={currentEntity.id} onChange={replace} />
                )}
              </details>
            </fieldset>
          )}
          <div className={styles.inspectorGroupLabel}>Environment</div>
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
              apply={async (base, proposal) => {
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
                    draftRef.current?.content.definitionId !== base.draft.content.definitionId
                  )
                    throw new Error(
                      "The saved room belongs to an earlier scene state. Reopen it from Saved to review the result.",
                    );
                  revision.current = saved.revision;
                  setSavedRevision(saved.revision);
                  const next = draftSchema.parse(saved.draft);
                  savedJson.current = JSON.stringify(next);
                  writeHistory(changeHistory(historyRef.current!, { type: "REPLACE", draft: next }));
                  setFindings(null);
                  setStatus("Reviewed room geometry saved");
                })();
                saving.current = operation;
                try {
                  await operation;
                } finally {
                  if (saving.current === operation) saving.current = null;
                  setBusy(false);
                }
              }}
            />
          </details>
          {draft.content.studio?.environment && (
            <details data-room-editor>
              <summary>Room &amp; environmental features</summary>
              <RoomEnvironmentEditor
                key={draft.content.studio.environment.id}
                room={draft.content.studio.environment}
                boundSurfaceIds={boundRoomSurfaceIds(draft.content)}
                onChange={(room) => {
                  const next = structuredClone(draft);
                  next.content.studio!.environment = room;
                  replace(next);
                }}
              />
            </details>
          )}
          <details {...sectionProps("accessibility")}>
            <summary>Accessibility &amp; Fallback</summary>
            {currentEntity && (
              <label>
                Accessible description
                <textarea
                  value={currentEntity.alternativeText}
                  onChange={(e) => updateEntity({ alternativeText: e.target.value })}
                />
              </label>
            )}
            <label>
              When AR is unavailable
              <textarea
                value={draft.content.fallback.narrative}
                onChange={(e) =>
                  replace({
                    ...draft,
                    content: { ...draft.content, fallback: { ...draft.content.fallback, narrative: e.target.value } },
                  })
                }
              />
            </label>
          </details>
          <details {...sectionProps("reuse")} aria-label="Library, reuse & publication">
            <summary>Library, reuse &amp; publication</summary>
            {currentEntity && (
              <SaveSpatialAsset
                key={currentEntity.id}
                name={currentEntity.name}
                busy={busy}
                onSave={async (metadata) => {
                  await action(async () => {
                    await persist();
                    await api({
                      action: "ASSET_SAVE",
                      draft: draftRef.current,
                      revision: revision.current,
                      rootId: currentEntity.id,
                      metadata,
                      environmentId: environment,
                    });
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
              draft.content.studio?.assetInstances
                ?.filter((i) => i.entityIds.includes(currentEntity.id))
                .map((i) => (
                  <p key={i.id}>Independent placed copy · pinned {i.versionId}. Edits here affect this scene only.</p>
                ))}
            <label>
              Experience title
              <input
                value={draft.content.title}
                onChange={(event) => replace({ ...draft, content: { ...draft.content, title: event.target.value } })}
              />
            </label>
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
                    install(forkSpatialDraft(draft, crypto.randomUUID()), 0, false);
                  })
                }
              >
                Fork / remix
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
                            i.releases.some(
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
        </aside>
        <nav className={`${styles.dockRail} ${styles.rightRail}`} aria-label="Inspector dock">
          <button
            aria-label="Open contextual Inspector"
            aria-pressed={inspectorOpen}
            title="Inspector"
            onClick={() => setInspectorOpen(!inspectorOpen)}
          >
            ◈
          </button>
          <button
            aria-label="Open object behavior"
            title="Behavior"
            onClick={() => {
              setInspectorOpen(true);
              setLayout((previous) => ({ ...previous, expandedInspector: ["behavior"] }));
              openBottomTab("TIMELINE");
            }}
          >
            ◷
          </button>
        </nav>
      </div>
      {contextMenu.menu}
    </main>
  );
}

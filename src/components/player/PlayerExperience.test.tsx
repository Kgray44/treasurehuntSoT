import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useEffect, useMemo } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AnimatedProperty,
  AnimationSceneName,
  JournalPhaseOutcome,
  MotionMode,
  PlaySceneOptions,
  PresentationOutcome,
  PresentationReceipt,
} from "@/animation/core/animation-types";
import type { ClientProgressEvent, PublicSnapshot, ReplayablePresentation } from "@/domain/story";
import { AnimationAuthorityContext, useOptionalSceneHost } from "@/animation/hosts/SceneHostContext";
import { SceneHost, useSceneTargetRegistration } from "@/animation/hosts/SceneHost";
import { SceneHostRegistry } from "@/animation/hosts/scene-host-registry";
import type { ExternalTargetExportRequest } from "@/animation/hosts/scene-host-types";
import {
  PlayerExperience,
  progressionReceiptEventName,
  progressionStateEventName,
  type ProgressionReceiptEventDetail,
  type ProgressionStateEventDetail,
} from "./PlayerExperience";
import { policyForProgressionEvent } from "./progression/event-policy";
import { phase3PlayerProgressEventTypes, type Phase3PlayerProgressEventType } from "./progression/contracts";

const mocks = vi.hoisted(() => {
  return {
    play: vi.fn(),
    skip: vi.fn(),
    cancel: vi.fn(),
    cycle: vi.fn(),
    motionMode: "reduced" as MotionMode,
    waitForJournalPhase: vi.fn(),
    audioPlayValidated: vi.fn(),
    audioStopAll: vi.fn(),
    sectionAnimationComplete: null as ((definition: string) => void) | null,
    animationSnapshot: {
      isPlaying: false,
      isPaused: false,
      scene: null as AnimationSceneName | null,
      label: "idle",
      progress: 0,
      speed: 1,
      mode: "reduced",
      phase: "idle",
      queueDepth: 0,
      error: null,
    },
  };
});

let latestRegistry: SceneHostRegistry | null = null;

function TestAnimationAuthority({ children }: { children: React.ReactNode }) {
  const hosts = useMemo(() => new SceneHostRegistry(), []);
  const authority = useMemo(
    () => Object.freeze({ providerId: hosts.providerId, hosts, ownership: hosts.ownership }),
    [hosts],
  );
  useEffect(() => {
    latestRegistry = hosts;
    return () => {
      if (latestRegistry === hosts) latestRegistry = null;
      hosts.destroy();
    };
  }, [hosts]);
  return <AnimationAuthorityContext.Provider value={authority}>{children}</AnimationAuthorityContext.Provider>;
}

type TestTargetReport = (registration: {
  kind: string;
  key: string;
  host: ReturnType<typeof useOptionalSceneHost>;
  handle: ReturnType<typeof useSceneTargetRegistration>["handle"];
}) => void;

function TestRegisteredTarget({
  targetKey,
  part,
  kind,
  itemKey,
  allowedProperties,
  report,
}: {
  targetKey: string;
  part: string;
  kind: string;
  itemKey: string;
  allowedProperties: readonly AnimatedProperty[];
  report?: TestTargetReport;
}) {
  const host = useOptionalSceneHost();
  const allowedKey = allowedProperties.join("\u0000");
  const input = useMemo(
    () => ({
      targetKey,
      part,
      ownerHint: "gsap" as const,
      allowedProperties: (allowedKey ? allowedKey.split("\u0000") : []) as AnimatedProperty[],
    }),
    [allowedKey, part, targetKey],
  );
  const { bindTarget, handle } = useSceneTargetRegistration(input);
  useEffect(() => {
    if (!host || !handle || !report) return;
    report({ kind, key: itemKey, host, handle });
    return () => report({ kind, key: itemKey, host: null, handle: null });
  }, [handle, host, itemKey, kind, report]);
  return (
    <span
      ref={bindTarget}
      data-scene-part={part}
      data-testid={targetKey}
      data-test-target-key={targetKey}
      style={{ display: "block", width: 8, height: 8 }}
    />
  );
}

function TestCapabilityTarget({
  targetKey,
  part,
  capabilityKey,
  allowedProperties,
  report,
}: {
  targetKey: string;
  part: string;
  capabilityKey: string;
  allowedProperties: readonly AnimatedProperty[];
  report?: (registration: unknown) => void;
}) {
  const host = useOptionalSceneHost();
  const allowedKey = allowedProperties.join("\u0000");
  const input = useMemo(
    () => ({
      targetKey,
      part,
      ownerHint: "gsap" as const,
      allowedProperties: (allowedKey ? allowedKey.split("\u0000") : []) as AnimatedProperty[],
    }),
    [allowedKey, part, targetKey],
  );
  const { bindTarget, handle } = useSceneTargetRegistration(input);
  const capability = useMemo(() => {
    if (!host || !handle) return null;
    return Object.freeze({
      key: capabilityKey,
      target: handle,
      exportForScene: (request: Omit<ExternalTargetExportRequest, "target">) =>
        host.exportTarget({ ...request, target: handle }),
    });
  }, [capabilityKey, handle, host]);
  useEffect(() => {
    if (!capability || !report) return;
    report(capability);
    return () => report(null);
  }, [capability, report]);
  return <span ref={bindTarget} data-scene-part={part} style={{ display: "block", width: 8, height: 8 }} />;
}

function TestJournalWorkspace({
  onSceneHostChange,
  onSceneTargetsChange,
}: {
  onSceneHostChange?: (host: unknown) => void;
  onSceneTargetsChange?: (ready: unknown) => void;
}) {
  return (
    <SceneHost
      as="section"
      kind="player-progression"
      hostKey="test-ready-journal-ceremony"
      data-section-heading
      tabIndex={-1}
    >
      <h2>The Voyage Journal</h2>
      <TestReadyJournalContents onSceneHostChange={onSceneHostChange} onSceneTargetsChange={onSceneTargetsChange} />
    </SceneHost>
  );
}

function TestReadyJournalContents({
  onSceneHostChange,
  onSceneTargetsChange,
}: {
  onSceneHostChange?: (host: unknown) => void;
  onSceneTargetsChange?: (ready: unknown) => void;
}) {
  const host = useOptionalSceneHost();
  const input = useMemo(
    () => ({
      targetKey: "test-journal:sealed-parchment",
      part: "sealed-parchment",
      ownerHint: "gsap" as const,
      allowedProperties: ["transform", "opacity"] as const,
    }),
    [],
  );
  const { bindTarget, handle } = useSceneTargetRegistration(input);
  useEffect(() => {
    if (!host || !handle) return;
    onSceneHostChange?.(host);
    onSceneTargetsChange?.({ host, targets: { "sealed-parchment": [handle] } });
    return () => {
      onSceneHostChange?.(null);
      onSceneTargetsChange?.(null);
    };
  }, [handle, host, onSceneHostChange, onSceneTargetsChange]);
  return (
    <div ref={bindTarget} data-scene-part="sealed-parchment" style={{ width: 20, height: 20 }}>
      Safe chapter surface
    </div>
  );
}

function TestArtifactProducer({
  artifactKey,
  report,
}: {
  artifactKey: string;
  report?: (registration: unknown) => void;
}) {
  const host = useOptionalSceneHost();
  const input = useMemo(
    () => ({
      targetKey: `test-artifact:${artifactKey}:layout-source`,
      part: "artifact-slot-target",
      ownerHint: "motion" as const,
      allowedProperties: ["layout"] as const,
    }),
    [artifactKey],
  );
  const { bindTarget, handle } = useSceneTargetRegistration(input);
  const layoutSource = useMemo(() => {
    if (!host || !handle) return null;
    return Object.freeze({
      target: handle,
      exportForScene: (request: Omit<ExternalTargetExportRequest, "target">) =>
        host.exportTarget({ ...request, target: handle }),
    });
  }, [handle, host]);
  useEffect(() => {
    if (!layoutSource || !report) return;
    report({ artifactKey, layoutSource, cinematicDestination: null });
    return () => report({ artifactKey, layoutSource: null, cinematicDestination: null });
  }, [artifactKey, layoutSource, report]);
  return (
    <div
      ref={bindTarget}
      data-artifact-key={artifactKey}
      data-scene-part="artifact-slot-target"
      data-testid={`test-artifact:${artifactKey}:layout-source`}
      style={{ width: 12, height: 12 }}
    />
  );
}

function renderPlayer(initialSnapshot: PublicSnapshot, sibling: React.ReactNode = null) {
  return render(
    <TestAnimationAuthority>
      {sibling}
      <PlayerExperience initialSnapshot={initialSnapshot} />
    </TestAnimationAuthority>,
  );
}

vi.mock("motion/react", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  motion: {
    div: (
      input: React.HTMLAttributes<HTMLDivElement> & {
        ref?: React.Ref<HTMLDivElement>;
        variants?: unknown;
        initial?: unknown;
        animate?: unknown;
        exit?: unknown;
        onAnimationComplete?: (definition: string) => void;
      },
    ) => {
      const { children, ref, onAnimationComplete, ...props } = input;
      delete props.variants;
      delete props.initial;
      delete props.animate;
      delete props.exit;
      if (props.className === "section-transition") mocks.sectionAnimationComplete = onAnimationComplete ?? null;
      return (
        <div ref={ref} {...props}>
          {children}
        </div>
      );
    },
    aside: (
      input: React.HTMLAttributes<HTMLElement> & {
        initial?: unknown;
        animate?: unknown;
        exit?: unknown;
        layout?: unknown;
      },
    ) => {
      const { children, initial: _initial, animate: _animate, exit: _exit, layout: _layout, ...props } = input;
      return <aside {...props}>{children}</aside>;
    },
    li: (
      input: React.LiHTMLAttributes<HTMLLIElement> & {
        initial?: unknown;
        animate?: unknown;
        exit?: unknown;
        layout?: unknown;
      },
    ) => {
      const { children, initial: _initial, animate: _animate, exit: _exit, layout: _layout, ...props } = input;
      return <li {...props}>{children}</li>;
    },
    small: (
      input: React.HTMLAttributes<HTMLElement> & {
        initial?: unknown;
        animate?: unknown;
        exit?: unknown;
        layoutId?: string;
        transition?: unknown;
      },
    ) => {
      const {
        children,
        initial: _initial,
        animate: _animate,
        exit: _exit,
        layoutId: _layoutId,
        transition: _transition,
        ...props
      } = input;
      return <small {...props}>{children}</small>;
    },
  },
}));

vi.mock("@/animation/director/useAnimationDirector", () => ({
  useAnimationDirector: () => ({
    director: { play: mocks.play, skip: mocks.skip, cancel: mocks.cancel },
    snapshot: mocks.animationSnapshot,
  }),
}));

const motionPolicy = {
  level: "reduced",
  source: { productSetting: "reduced", browserPrefersReduced: false },
  allowSpatialTravel: false,
  allowContinuousAmbientMotion: false,
  allowPageCurl: false,
  allowRiveStateTravel: false,
  allowLottiePlayback: false,
  allowMotionCues: false,
  durationScale: 0,
  distanceScale: 0,
  preserveSemanticStaging: true,
} as const;

vi.mock("@/animation/motion/useMotionMode", () => ({
  useMotionMode: () => ({
    mode: mocks.motionMode,
    policy: {
      ...motionPolicy,
      level: mocks.motionMode,
      source: { ...motionPolicy.source, productSetting: mocks.motionMode },
      allowMotionCues: mocks.motionMode !== "reduced",
      durationScale: mocks.motionMode === "reduced" ? 0 : 1,
      distanceScale: mocks.motionMode === "reduced" ? 0 : 1,
    },
    cycle: mocks.cycle,
  }),
}));

vi.mock("@/animation/journal/opening-machine", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/animation/journal/opening-machine")>()),
  waitForJournalPhase: mocks.waitForJournalPhase,
}));

vi.mock("@/animation/core/audio-cues", () => ({
  AudioCuePlayer: class {
    close() {}
    playValidated(...args: unknown[]) {
      mocks.audioPlayValidated(...args);
      return { presentationProof: true };
    }
    setMuted() {}
    setVolume() {}
    stopAll() {
      mocks.audioStopAll();
    }
    unlock() {}
  },
}));

vi.mock("@/components/dev/AnimationTestButton", () => ({ AnimationTestButton: () => null }));
vi.mock("./workspace/CompanionHeader", () => ({
  CompanionHeader: ({
    replay,
    canReplay,
    onDimTargetChange,
  }: {
    replay: () => void;
    canReplay: boolean;
    onDimTargetChange?: (registration: unknown) => void;
  }) => {
    return (
      <>
        <TestCapabilityTarget
          targetKey="test-companion:header-dim"
          part="companion-header-dim"
          capabilityKey="companion-header-dim"
          allowedProperties={["opacity"]}
          report={onDimTargetChange}
        />
        {canReplay ? <button onClick={replay}>Replay latest chapter</button> : null}
      </>
    );
  },
}));
vi.mock("./workspace/CompanionNavigation", () => ({
  CompanionNavigation: ({
    navigate,
    unseen,
    onDimTargetChange,
  }: {
    navigate: (view: string) => void;
    unseen: Record<string, number>;
    onDimTargetChange?: (registration: unknown) => void;
  }) => {
    return (
      <>
        <TestCapabilityTarget
          targetKey="test-companion:desktop-dim"
          part="companion-desktop-navigation-dim"
          capabilityKey="companion-desktop-navigation-dim"
          allowedProperties={["opacity"]}
          report={onDimTargetChange}
        />
        {unseen.journal ? <span aria-label={`${unseen.journal} unseen`} /> : null}
        <button onClick={() => navigate("chart")}>Open chart</button>
        <button onClick={() => navigate("treasures")}>Open treasures</button>
      </>
    );
  },
  MobileNavigation: ({
    unseen,
    onDimTargetChange,
  }: {
    unseen: Record<string, number>;
    onDimTargetChange?: (registration: unknown) => void;
  }) => {
    return (
      <>
        <TestCapabilityTarget
          targetKey="test-companion:mobile-dim"
          part="companion-mobile-navigation-dim"
          capabilityKey="companion-mobile-navigation-dim"
          allowedProperties={["opacity"]}
          report={onDimTargetChange}
        />
        {unseen.journal ? <span aria-label={`${unseen.journal} unseen`} /> : null}
      </>
    );
  },
}));
vi.mock("./workspace/JournalWorkspace", () => ({
  JournalWorkspace: TestJournalWorkspace,
}));
vi.mock("./workspace/VoyageChart", () => ({
  VoyageChart: ({
    snapshot,
    progressLocationKey,
    progressRouteKey,
    onTargetRegistrationChange,
  }: {
    snapshot: PublicSnapshot;
    progressLocationKey?: string;
    progressRouteKey?: string;
    onTargetRegistrationChange?: (registration: unknown) => void;
  }) => {
    return (
      <SceneHost
        as="section"
        kind="player-section-enhancement"
        hostKey="test-voyage-chart"
        data-section-heading
        tabIndex={-1}
      >
        {progressLocationKey ? (
          <TestRegisteredTarget
            targetKey={`test-chart:location:${progressLocationKey}`}
            part="map-marker"
            kind="location-visual"
            itemKey={progressLocationKey}
            allowedProperties={["transform", "opacity", "filter"]}
            report={onTargetRegistrationChange}
          />
        ) : null}
        {progressRouteKey ? (
          <TestRegisteredTarget
            targetKey={`test-chart:route:${progressRouteKey}`}
            part="route-path"
            kind="route-path"
            itemKey={progressRouteKey}
            allowedProperties={["path-drawing", "stroke-dasharray", "stroke-dashoffset", "opacity"]}
            report={onTargetRegistrationChange}
          />
        ) : null}
        <TestRegisteredTarget
          targetKey={`test-chart:fog:${snapshot.campaign.slug}`}
          part="map-fog"
          kind="fog-mask"
          itemKey={snapshot.campaign.slug}
          allowedProperties={["clip-path", "opacity"]}
          report={onTargetRegistrationChange}
        />
        <h2>Voyage chart</h2>
      </SceneHost>
    );
  },
}));
vi.mock("./workspace/ArtifactInspection", () => ({ ArtifactInspection: () => null }));
vi.mock("./workspace/FinaleChamber", () => ({ FinaleChamber: () => null }));
vi.mock("./workspace/ObjectiveNote", () => ({ ObjectiveNote: () => null }));
vi.mock("./workspace/ShipsLog", () => ({
  ShipsLog: ({
    progressEntryKey,
    onTargetRegistrationChange,
  }: {
    progressEntryKey?: string;
    onTargetRegistrationChange?: (registration: unknown) => void;
  }) => {
    return (
      <SceneHost kind="player-section-enhancement" hostKey="test-ships-log">
        {progressEntryKey ? (
          <>
            <TestRegisteredTarget
              targetKey={`test-log:ink:${progressEntryKey}`}
              part="log-entry-new"
              kind="fresh-ink"
              itemKey={progressEntryKey}
              allowedProperties={["opacity", "clip-path", "filter"]}
              report={onTargetRegistrationChange}
            />
            <TestRegisteredTarget
              targetKey={`test-log:symbol:${progressEntryKey}`}
              part="log-symbol-new"
              kind="log-symbol"
              itemKey={progressEntryKey}
              allowedProperties={["transform", "opacity"]}
              report={onTargetRegistrationChange}
            />
          </>
        ) : null}
      </SceneHost>
    );
  },
}));
vi.mock("./workspace/SideQuestLedger", () => ({ SideQuestLedger: () => null }));
vi.mock("./workspace/TreasureAltar", () => ({
  TreasureAltar: ({
    snapshot,
    onArtifactTargetHandlesChange,
  }: {
    snapshot: PublicSnapshot;
    onArtifactTargetHandlesChange?: (registration: unknown) => void;
  }) => {
    return (
      <SceneHost kind="player-section-enhancement" hostKey="test-treasure-altar">
        {snapshot.artifacts.map((artifact) => (
          <TestArtifactProducer key={artifact.key} artifactKey={artifact.key} report={onArtifactTargetHandlesChange} />
        ))}
      </SceneHost>
    );
  },
}));

class TestEventSource {
  static instances: TestEventSource[] = [];
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private listeners = new Map<string, (event: MessageEvent) => void>();

  constructor(readonly url: string) {
    TestEventSource.instances.push(this);
  }

  addEventListener(name: string, listener: EventListener) {
    this.listeners.set(name, listener as (event: MessageEvent) => void);
  }

  emit(name: string, data: unknown) {
    this.listeners.get(name)?.({ data: JSON.stringify(data) } as MessageEvent);
  }

  fail() {
    this.onerror?.();
  }

  open() {
    this.onopen?.();
  }

  close() {}
}

const release: ReplayablePresentation = {
  eventId: "release-event-1",
  eventType: "CHAPTER_RELEASED",
  sequence: 8,
  occurredAt: "2026-07-18T12:00:00.000Z",
  sceneName: "chapter-release",
  payloadVersion: 1,
  payload: {
    ordinal: 2,
    title: "The Safe Lantern",
    narrative: "Player-readable narrative.",
    objective: "Follow the safe light.",
    riddle: "What wakes without flame?",
  },
  replayPolicy: "presentation-only",
};

const snapshot: PublicSnapshot = {
  campaign: { slug: "test-voyage", title: "Test Voyage", status: "ACTIVE" },
  sequence: 8,
  chapter: {
    ordinal: 2,
    state: "ACTIVE",
    title: release.payload.title,
    narrative: release.payload.narrative,
    objective: release.payload.objective,
    riddle: release.payload.riddle,
    hints: [],
    unseen: true,
  },
  chapters: [
    {
      ordinal: 2,
      state: "ACTIVE",
      title: release.payload.title,
      narrative: release.payload.narrative,
      objective: release.payload.objective,
      riddle: release.payload.riddle,
      hints: [],
      unseen: true,
    },
  ],
  artifacts: [],
  mapLocations: [],
  mapRoutes: [],
  sideQuests: [],
  sideQuest: null,
  log: [],
  finale: { state: "LOCKED", requirements: [], unseen: false },
  unseen: { journal: 1, chart: 0, treasures: 0, quests: 0, log: 0, finale: 0 },
  latestChapterReleasePresentation: release,
};

function response(body: unknown, ok = true) {
  return { ok, json: vi.fn().mockResolvedValue(body) } as unknown as Response;
}

function receipt(
  outcome: PresentationOutcome,
  options: PlaySceneOptions<void>,
  sceneName: AnimationSceneName = "chapter-release",
): PresentationReceipt {
  return {
    sceneName,
    sceneInstanceId: `scene-instance-${mocks.play.mock.calls.length}`,
    hostId: options.hostId ?? "missing-host",
    hostKind: options.hostKind ?? "missing-kind",
    requestSource: options.requestSource ?? "automatic",
    eventOrActionId: options.eventOrActionId,
    outcome,
    motionPolicy,
    startedAt: 1,
    completedAt: 2,
    durationMs: 1,
    semanticLabelsReached: outcome === "presented" ? ["seal", "content-readable"] : [],
    targetReport: {
      sceneName,
      sceneInstanceId: `scene-instance-${mocks.play.mock.calls.length}`,
      hostId: options.hostId ?? "missing-host",
      startedAt: 1,
      completedAt: 2,
      durationMs: 1,
      requiredSatisfied: outcome === "presented",
      observations: [],
      failures: [],
    },
    acknowledgmentAllowed: outcome === "presented",
    cleanup: "completed",
  };
}

async function openJournal() {
  fireEvent.click(screen.getByRole("button", { name: /Open the journal/ }));
  await screen.findByRole("button", { name: "Replay introduction" });
}

function viewedPostCalls(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter(
    ([input, init]) => String(input).includes("/viewed") && (init as RequestInit | undefined)?.method === "POST",
  );
}

function viewedPostBodies(fetchMock: ReturnType<typeof vi.fn>) {
  return viewedPostCalls(fetchMock).map(([, init]) =>
    JSON.parse(String((init as RequestInit | undefined)?.body)),
  ) as Array<Record<string, unknown>>;
}

function captureProgressionBrowserEvidence() {
  const receipts: ProgressionReceiptEventDetail[] = [];
  const states: ProgressionStateEventDetail[] = [];
  const order: string[] = [];
  const onReceipt = (event: Event) => {
    const detail = (event as CustomEvent<ProgressionReceiptEventDetail>).detail;
    receipts.push(detail);
    order.push(`receipt:${detail.requestId}:${detail.status}`);
  };
  const onState = (event: Event) => {
    const detail = (event as CustomEvent<ProgressionStateEventDetail>).detail;
    states.push(detail);
    order.push(`state:${detail.requestId ?? "none"}:${detail.transition}`);
  };
  window.addEventListener(progressionReceiptEventName, onReceipt);
  window.addEventListener(progressionStateEventName, onState);
  return {
    receipts,
    states,
    order,
    stop: () => {
      window.removeEventListener(progressionReceiptEventName, onReceipt);
      window.removeEventListener(progressionStateEventName, onState);
    },
  };
}

const matrixSections = ["journal", "chart", "treasures", "quests", "log", "finale"] as const;

const matrixPayloads = {
  CHAPTER_RELEASED: {
    ordinal: 2,
    title: "The Safe Lantern",
    narrative: "Player-readable narrative.",
    objective: "Follow the safe light.",
    riddle: "What wakes without flame?",
  },
  CHAPTER_SOLVED: { ordinal: 2 },
  ARTIFACT_AWARDED: {
    key: "artifact-alpha",
    name: "Alpha Compass",
    description: "A safe awarded artifact.",
    discoveryText: "Recovered at dawn.",
  },
  ARTIFACT_SILHOUETTE_REVEALED: {
    key: "artifact-alpha",
    safeName: "Unknown compass",
    silhouetteLabel: "Compass silhouette",
  },
  ARTIFACT_CONNECTED: { key: "artifact-alpha", connectedArtifactKey: "artifact-beta" },
  MAP_LOCATION_REVEALED: { key: "lantern-cove", name: "Lantern Cove", regionLabel: "The Shores" },
  MAP_ROUTE_REVEALED: { key: "harbor-to-cove", fromKey: "harbor", toKey: "lantern-cove" },
  SIDE_QUEST_DISCOVERED: { key: "lost-bell", title: "The Lost Bell" },
  SIDE_QUEST_UPDATED: { key: "lost-bell", objectiveOrdinal: 1 },
  SIDE_QUEST_COMPLETED: { key: "lost-bell", title: "The Lost Bell", rewardLabel: "Bell restored" },
  JOURNAL_ANNOTATION_ADDED: { key: "captains-mark", title: "Captain's mark", chapterOrdinal: 2 },
  PLAYER_LOG_ENTRY_ADDED: { key: "matrix-log-entry", title: "A safe log entry" },
  FINALE_TEASED: { state: "TEASED" },
  FINALE_REQUIREMENT_UPDATED: { key: "three-stars" },
  CAMPAIGN_PAUSED: {},
  CAMPAIGN_RESUMED: {},
  STATE_REVERTED: { reversedType: "MAP_ROUTE_REVEALED" },
} as const satisfies Record<Phase3PlayerProgressEventType, Readonly<Record<string, unknown>>>;

const matrixCases = phase3PlayerProgressEventTypes.flatMap((eventType, eventIndex) =>
  matrixSections.map((section) => ({ eventType, eventIndex, section })),
);

function matrixEvent(eventType: Phase3PlayerProgressEventType, eventIndex: number): ClientProgressEvent {
  return Object.freeze({
    id: `matrix-${eventType.toLowerCase()}-${eventIndex}`,
    type: eventType,
    sequence: 100 + eventIndex,
    releaseAt: `2026-07-19T12:${String(eventIndex).padStart(2, "0")}:00.000Z`,
    payload: Object.freeze({ ...matrixPayloads[eventType] }),
  });
}

describe("PlayerExperience presentation integrity", () => {
  beforeEach(() => {
    TestEventSource.instances = [];
    vi.stubGlobal("EventSource", TestEventSource);
    mocks.play.mockReset();
    mocks.cancel.mockReset();
    mocks.motionMode = "reduced";
    mocks.waitForJournalPhase.mockReset();
    mocks.waitForJournalPhase.mockImplementation(
      async (_root, phase) =>
        ({
          status: "completed",
          phase,
          finiteAnimationCount: 0,
          durationMs: 0,
        }) satisfies JournalPhaseOutcome,
    );
    mocks.audioPlayValidated.mockReset();
    mocks.audioStopAll.mockReset();
    mocks.sectionAnimationComplete = null;
    Object.assign(mocks.animationSnapshot, {
      isPlaying: false,
      isPaused: false,
      scene: null,
      label: "idle",
      progress: 0,
      speed: 1,
      mode: "reduced",
      phase: "idle",
      queueDepth: 0,
      error: null,
    });
    localStorage.clear();
    localStorage.setItem("forever-device", "123e4567-e89b-42d3-a456-426614174000");
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    history.replaceState({}, "", "/");
  });

  it("defines the exact 17 event by 6 starting-section matrix", () => {
    expect(phase3PlayerProgressEventTypes).toHaveLength(17);
    expect(matrixSections).toHaveLength(6);
    expect(matrixCases).toHaveLength(102);
    expect(new Set(matrixCases.map(({ eventType, section }) => `${eventType}:${section}`))).toHaveLength(102);
  });

  it.each(matrixCases)(
    "presents $eventType from $section on the one persistent host without forcing navigation",
    async ({ eventType, eventIndex, section }) => {
      const event = matrixEvent(eventType, eventIndex);
      const caseSnapshot: PublicSnapshot = {
        ...snapshot,
        sequence: event.sequence,
        chapter: { ...snapshot.chapter, unseen: false },
        chapters: snapshot.chapters.map((chapter) => ({ ...chapter, unseen: false })),
        latestChapterReleasePresentation: undefined,
        presentationHistory: [event],
        artifacts: [
          {
            key: "artifact-alpha",
            state: "AWARDED",
            name: "Alpha Compass",
            displayX: 20,
            displayY: 30,
            unseen: false,
          },
        ],
        unseen: { journal: 0, chart: 0, treasures: 0, quests: 0, log: 0, finale: 0 },
      };
      const initialSnapshot: PublicSnapshot = {
        ...caseSnapshot,
        sequence: 8,
        presentationHistory: [],
      };
      const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/snapshot")) return Promise.resolve(response(caseSnapshot));
        if (url.includes("/viewed") && (init?.method ?? "GET") === "GET") {
          return Promise.resolve(response({ acknowledgedEventIds: [] }));
        }
        return Promise.resolve(response({ ok: true }));
      });
      vi.stubGlobal("fetch", fetchMock);
      vi.stubGlobal("scrollTo", vi.fn());
      sessionStorage.setItem("forever-intro:test-voyage", "seen");
      history.replaceState({}, "", `/?section=${section}`);

      let releasePresentation!: () => void;
      const presentationGate = new Promise<void>((resolve) => {
        releasePresentation = resolve;
      });
      mocks.play.mockImplementation(async (scene: AnimationSceneName, options: PlaySceneOptions<void>) => {
        if (options.eventOrActionId === event.id) await presentationGate;
        return receipt("presented", options, scene);
      });

      const rendered = renderPlayer(initialSnapshot);
      await openJournal();
      await waitFor(() => expect(TestEventSource.instances).toHaveLength(1));
      const persistentHost = screen.getByTestId("progression-scene-host");
      const startingUrl = location.href;

      act(() => TestEventSource.instances[0]!.emit("progression", event));
      await waitFor(() =>
        expect(mocks.play.mock.calls.some(([, options]) => options.eventOrActionId === event.id)).toBe(true),
      );
      const [sceneName, playOptions] = mocks.play.mock.calls.find(
        ([, options]) => options.eventOrActionId === event.id,
      ) as [AnimationSceneName, PlaySceneOptions<void>];
      const overlay = screen.getByTestId("progression-scene-overlay");

      expect(sceneName).toBe(policyForProgressionEvent(eventType).sceneName);
      expect(playOptions).toMatchObject({
        queue: false,
        requestSource: "automatic",
        eventOrActionId: event.id,
        hostKind: "player-progression",
      });
      expect(playOptions.sceneHost?.hostId).toBe(playOptions.hostId);
      expect(playOptions.finalStateRuntime).toMatchObject({
        commitFinalState: expect.any(Function),
        reconcileFinalState: expect.any(Function),
        holdSafePose: expect.any(Function),
        renderStaticFallback: expect.any(Function),
        verifyReadableState: expect.any(Function),
        cleanup: expect.any(Function),
      });
      expect(overlay).toHaveAttribute("data-presentation-event", eventType);
      expect(overlay.getAttribute("data-presentation-id")).toContain(event.id);
      const matchingAnnouncements = Array.from(document.querySelectorAll<HTMLElement>("[aria-live]")).filter(
        (element) => element.textContent?.trim() === policyForProgressionEvent(eventType).globalPresentation.heading,
      );
      expect(matchingAnnouncements).toHaveLength(1);
      expect(screen.getByTestId("progression-content")).toHaveAttribute("inert");
      expect(location.href).toBe(startingUrl);
      expect(screen.getByTestId("progression-scene-host")).toBe(persistentHost);
      if (eventType === "CHAPTER_SOLVED" && section === "journal") {
        expect(document.querySelector('[data-scene-part="solved-stamp"]')).toHaveTextContent("Solved");
        expect(playOptions.externalTargets?.["chapter-solved-stamp"]).toBeDefined();
      }

      releasePresentation();
      await waitFor(() =>
        expect(viewedPostBodies(fetchMock)).toContainEqual({ eventId: event.id, deviceId: expect.any(String) }),
      );
      const settledNotice = await waitFor(() => {
        const notice = document.querySelector<HTMLElement>(`[data-progress-event-id="${event.id}"]`);
        expect(notice).not.toBeNull();
        return notice!;
      });
      expect(settledNotice).toHaveAttribute("data-progress-event-id", event.id);
      expect(settledNotice).toHaveTextContent(policyForProgressionEvent(eventType).globalPresentation.heading);
      expect(settledNotice).not.toHaveAttribute("role");
      expect(settledNotice).not.toHaveAttribute("aria-live");
      expect(within(settledNotice).getByRole("heading", { level: 2 })).toHaveTextContent(
        policyForProgressionEvent(eventType).globalPresentation.heading,
      );
      expect(within(settledNotice).getByRole("button", { name: "Replay ceremony" })).toBeEnabled();
      if (eventType === "CHAPTER_RELEASED" && section === "journal") {
        fireEvent.click(within(settledNotice).getByRole("button", { name: "Replay ceremony" }));
        await waitFor(() =>
          expect(
            mocks.play.mock.calls.some(
              ([, options]) => options.eventOrActionId === event.id && options.requestSource === "replay",
            ),
          ).toBe(true),
        );
      }
      expect(location.href).toBe(startingUrl);
      expect(screen.getByTestId("progression-scene-host")).toBe(persistentHost);
      expect(document.querySelectorAll('[data-testid="progression-scene-host"]')).toHaveLength(1);
      rendered.unmount();
    },
    15_000,
  );

  it("renders the chapter-release ceremony separator without mojibake", () => {
    Object.assign(mocks.animationSnapshot, {
      isPlaying: true,
      scene: "chapter-release" as const,
      label: "seal-breaking",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(response({ acknowledgedEventIds: [] }))),
    );

    renderPlayer(snapshot);

    expect(screen.getByText("Releasing the first seal · seal breaking")).toBeVisible();
    expect(document.body).not.toHaveTextContent("Â·");
  });

  it("publishes presented, duplicate, stale, and cancelled browser receipts exactly once before settled state", async () => {
    const duplicate = Object.freeze({
      ...matrixEvent("PLAYER_LOG_ENTRY_ADDED", 11),
      id: "evidence-duplicate",
      sequence: 301,
    });
    const presented = Object.freeze({
      ...matrixEvent("CAMPAIGN_RESUMED", 15),
      id: "evidence-presented",
      sequence: 302,
    });
    const stale = Object.freeze({
      ...matrixEvent("CAMPAIGN_PAUSED", 14),
      id: "evidence-stale",
      sequence: 301,
    });
    let serverSnapshot: PublicSnapshot = {
      ...snapshot,
      sequence: 300,
      chapter: { ...snapshot.chapter, unseen: false },
      chapters: snapshot.chapters.map((chapter) => ({ ...chapter, unseen: false })),
      latestChapterReleasePresentation: undefined,
      presentationHistory: [],
      unseen: { journal: 0, chart: 0, treasures: 0, quests: 0, log: 0, finale: 0 },
    };
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/snapshot")) return Promise.resolve(response(serverSnapshot));
      if (url.includes("/viewed") && (init?.method ?? "GET") === "GET") {
        return Promise.resolve(response({ acknowledgedEventIds: [] }));
      }
      return Promise.resolve(response({ ok: true }));
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("scrollTo", vi.fn());
    sessionStorage.setItem("forever-intro:test-voyage", "seen");
    const browserEvidence = captureProgressionBrowserEvidence();
    let releaseCancelled!: () => void;
    const cancelledGate = new Promise<void>((resolve) => {
      releaseCancelled = resolve;
    });
    mocks.play.mockImplementation(async (scene: AnimationSceneName, options: PlaySceneOptions<void>) => {
      if (options.eventOrActionId === duplicate.id) {
        await cancelledGate;
        return receipt("interrupted", options, scene);
      }
      return receipt("presented", options, scene);
    });

    renderPlayer(serverSnapshot);
    await openJournal();
    await waitFor(() => expect(TestEventSource.instances).toHaveLength(1));

    act(() => {
      TestEventSource.instances[0]!.emit("progression", duplicate);
      TestEventSource.instances[0]!.emit("progression", duplicate);
    });
    await waitFor(() =>
      expect(
        browserEvidence.receipts.filter(
          (candidate) => candidate.eventId === duplicate.id && candidate.status === "duplicate",
        ),
      ).toHaveLength(1),
    );
    releaseCancelled();
    await waitFor(() =>
      expect(
        browserEvidence.receipts.filter(
          (candidate) => candidate.eventId === duplicate.id && candidate.status === "cancelled",
        ),
      ).toHaveLength(1),
    );

    serverSnapshot = { ...serverSnapshot, sequence: presented.sequence, presentationHistory: [presented] };
    act(() => TestEventSource.instances[0]!.emit("progression", presented));
    await waitFor(() =>
      expect(
        browserEvidence.receipts.filter(
          (candidate) => candidate.eventId === presented.id && candidate.status === "presented",
        ),
      ).toHaveLength(1),
    );

    act(() => TestEventSource.instances[0]!.emit("progression", stale));
    await waitFor(() =>
      expect(
        browserEvidence.receipts.filter((candidate) => candidate.eventId === stale.id && candidate.status === "stale"),
      ).toHaveLength(1),
    );

    for (const evidence of browserEvidence.receipts.filter((candidate) =>
      ([duplicate.id, presented.id, stale.id] as readonly string[]).includes(candidate.eventId),
    )) {
      expect(evidence).not.toHaveProperty("payload");
      expect(browserEvidence.order.indexOf(`receipt:${evidence.requestId}:${evidence.status}`)).toBeLessThan(
        browserEvidence.order.indexOf(`state:${evidence.requestId}:settled`),
      );
      if (evidence.status === "duplicate" || evidence.status === "stale") {
        expect(evidence).toMatchObject({ scene: null, targetReport: null });
      }
    }
    browserEvidence.stop();
  });

  it("publishes a no-scene deferred receipt once and preserves its identity for later presentation", async () => {
    const authoritative = Object.freeze({
      ...matrixEvent("CAMPAIGN_PAUSED", 14),
      id: "evidence-deferred-authoritative",
      sequence: 9,
    });
    let serverSnapshot: PublicSnapshot = {
      ...snapshot,
      sequence: 8,
      chapter: { ...snapshot.chapter, unseen: false },
      chapters: snapshot.chapters.map((chapter) => ({ ...chapter, unseen: false })),
      presentationHistory: [],
      unseen: { journal: 0, chart: 0, treasures: 0, quests: 0, log: 0, finale: 0 },
    };
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/snapshot")) return Promise.resolve(response(serverSnapshot));
      if (url.includes("/viewed") && (init?.method ?? "GET") === "GET") {
        return Promise.resolve(response({ acknowledgedEventIds: [] }));
      }
      return Promise.resolve(response({ ok: true }));
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("scrollTo", vi.fn());
    sessionStorage.setItem("forever-intro:test-voyage", "seen");
    const browserEvidence = captureProgressionBrowserEvidence();
    let releaseReplay!: () => void;
    let replayStarted!: () => void;
    const replayGate = new Promise<void>((resolve) => {
      releaseReplay = resolve;
    });
    const replayReady = new Promise<void>((resolve) => {
      replayStarted = resolve;
    });
    mocks.play.mockImplementation(async (scene: AnimationSceneName, options: PlaySceneOptions<void>) => {
      if (options.eventOrActionId === release.eventId && options.requestSource === "replay") {
        options.finalStateRuntime?.commitFinalState?.("chapter-readable");
        replayStarted();
        await replayGate;
      }
      return receipt("presented", options, scene);
    });

    renderPlayer(serverSnapshot);
    await openJournal();
    await waitFor(() => expect(TestEventSource.instances).toHaveLength(1));
    fireEvent.click(screen.getByRole("button", { name: "Replay latest chapter" }));
    await replayReady;

    serverSnapshot = {
      ...serverSnapshot,
      sequence: authoritative.sequence,
      presentationHistory: [authoritative],
    };
    act(() => TestEventSource.instances[0]!.emit("progression", authoritative));
    const deferred = await waitFor(() => {
      const matches = browserEvidence.receipts.filter(
        (candidate) => candidate.eventId === authoritative.id && candidate.status === "deferred",
      );
      expect(matches).toHaveLength(1);
      return matches[0]!;
    });
    expect(deferred).toMatchObject({ scene: null, targetReport: null, acknowledged: false });
    expect(deferred).not.toHaveProperty("payload");
    expect(browserEvidence.order.indexOf(`receipt:${deferred.requestId}:deferred`)).toBeLessThan(
      browserEvidence.order.indexOf(`state:${deferred.requestId}:settled`),
    );
    expect(mocks.cancel).not.toHaveBeenCalled();

    releaseReplay();
    await waitFor(() =>
      expect(
        browserEvidence.receipts.filter(
          (candidate) => candidate.eventId === authoritative.id && candidate.status === "presented",
        ),
      ).toHaveLength(1),
    );
    const presented = browserEvidence.receipts.find(
      (candidate) => candidate.eventId === authoritative.id && candidate.status === "presented",
    )!;
    expect(presented.requestId).toBe(deferred.requestId);
    expect(presented.playbackIdentity).toBe(deferred.playbackIdentity);
    browserEvidence.stop();
  });

  it("hydrates bounded history newest-first and replays an exact older event behind newer authoritative work without acknowledging replay", async () => {
    const older = Object.freeze({
      ...matrixEvent("MAP_LOCATION_REVEALED", 5),
      id: "history-older-map",
      sequence: 201,
    });
    const newer = Object.freeze({
      ...matrixEvent("PLAYER_LOG_ENTRY_ADDED", 11),
      id: "history-newer-log",
      sequence: 202,
    });
    const live = Object.freeze({
      ...matrixEvent("CAMPAIGN_PAUSED", 14),
      id: "history-live-pause",
      sequence: 203,
    });
    let serverSnapshot: PublicSnapshot = {
      ...snapshot,
      sequence: 202,
      chapter: { ...snapshot.chapter, unseen: false },
      chapters: snapshot.chapters.map((chapter) => ({ ...chapter, unseen: false })),
      latestChapterReleasePresentation: undefined,
      presentationHistory: [older, newer],
      unseen: { journal: 0, chart: 0, treasures: 0, quests: 0, log: 0, finale: 0 },
    };
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/snapshot")) return Promise.resolve(response(serverSnapshot));
      if (url.includes("/viewed") && (init?.method ?? "GET") === "GET") {
        return Promise.resolve(response({ acknowledgedEventIds: [older.id, newer.id] }));
      }
      return Promise.resolve(response({ ok: true }));
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("scrollTo", vi.fn());
    sessionStorage.setItem("forever-intro:test-voyage", "seen");
    const browserEvidence = captureProgressionBrowserEvidence();

    let releaseOlderReplay!: () => void;
    const olderReplayGate = new Promise<void>((resolve) => {
      releaseOlderReplay = resolve;
    });
    mocks.play.mockImplementation(async (scene: AnimationSceneName, options: PlaySceneOptions<void>) => {
      if (options.eventOrActionId === older.id && options.requestSource === "replay") await olderReplayGate;
      return receipt("presented", options, scene);
    });

    renderPlayer(serverSnapshot);
    await openJournal();
    await waitFor(() => expect(TestEventSource.instances).toHaveLength(1));
    fireEvent.click(screen.getByText("Presentation history"));
    const historyItems = document.querySelectorAll<HTMLElement>("[data-presentation-history-event]");
    expect([...historyItems].map((item) => item.dataset.presentationHistoryEvent)).toEqual([newer.id, older.id]);

    const olderReplayButton = screen.getByRole("button", {
      name: `Replay Map location revealed (${older.id})`,
    });
    fireEvent.click(olderReplayButton);
    await waitFor(() =>
      expect(
        mocks.play.mock.calls.some(
          ([, options]) => options.eventOrActionId === older.id && options.requestSource === "replay",
        ),
      ).toBe(true),
    );

    serverSnapshot = { ...serverSnapshot, sequence: live.sequence, presentationHistory: [older, newer, live] };
    act(() => TestEventSource.instances[0]!.emit("progression", live));
    await waitFor(() => expect(mocks.cancel).toHaveBeenCalledWith("authoritative-progression-arrived"));
    const interruptedReceipt = await waitFor(() => {
      const matches = browserEvidence.receipts.filter(
        (candidate) => candidate.eventId === older.id && candidate.status === "interrupted",
      );
      expect(matches).toHaveLength(1);
      return matches[0]!;
    });
    expect(interruptedReceipt).toMatchObject({
      source: "replay",
      scene: null,
      targetReport: null,
      acknowledgmentAttempted: false,
      acknowledged: false,
    });
    expect(interruptedReceipt).not.toHaveProperty("payload");
    expect(browserEvidence.order.indexOf(`receipt:${interruptedReceipt.requestId}:interrupted`)).toBeLessThan(
      browserEvidence.order.indexOf(`state:${interruptedReceipt.requestId}:settled`),
    );
    expect(viewedPostBodies(fetchMock).filter((body) => body.eventId === older.id)).toEqual([]);

    releaseOlderReplay();
    await waitFor(() =>
      expect(
        mocks.play.mock.calls.some(
          ([, options]) => options.eventOrActionId === live.id && options.requestSource === "automatic",
        ),
      ).toBe(true),
    );
    await waitFor(() => expect(viewedPostBodies(fetchMock).filter((body) => body.eventId === live.id)).toHaveLength(1));
    await waitFor(() =>
      expect(browserEvidence.receipts.filter((candidate) => candidate.eventId === live.id)).toHaveLength(1),
    );
    expect(viewedPostBodies(fetchMock).filter((body) => body.eventId === older.id)).toEqual([]);
    expect(screen.getByRole("button", { name: `Replay Map location revealed (${older.id})` })).toHaveAttribute(
      "data-replay-event-id",
      older.id,
    );
    browserEvidence.stop();
  });

  it("keeps unseen truth when viewed acknowledgment fails and settles only after a successful retry", async () => {
    const seenSnapshot: PublicSnapshot = {
      ...snapshot,
      chapter: { ...snapshot.chapter, unseen: false },
      chapters: snapshot.chapters.map((chapter) => ({ ...chapter, unseen: false })),
      unseen: { ...snapshot.unseen, journal: 0 },
    };
    let contentAcknowledgmentAttempts = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/snapshot")) return Promise.resolve(response(seenSnapshot));
      if (url.includes("/viewed") && (init?.method ?? "GET") === "GET")
        return Promise.resolve(response({ acknowledgedEventIds: [] }));
      if (url.includes("/viewed") && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as { contentType?: string };
        if (body.contentType) {
          contentAcknowledgmentAttempts += 1;
          return Promise.resolve(
            contentAcknowledgmentAttempts === 1
              ? response({ error: "temporary failure" }, false)
              : response({ ok: true }),
          );
        }
      }
      return Promise.resolve(response({ ok: true }));
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("scrollTo", vi.fn());
    sessionStorage.setItem("forever-intro:test-voyage", "seen");
    mocks.play.mockImplementation(async (scene: AnimationSceneName, options: PlaySceneOptions<void>) =>
      receipt("presented", options, scene),
    );

    renderPlayer(snapshot);
    await openJournal();
    expect(await screen.findByText("Viewed state was not saved. The unseen count is unchanged.")).toBeVisible();
    expect(screen.getAllByLabelText("1 unseen")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Retry viewed update" }));
    expect(await screen.findByText("Viewed state confirmed by the voyage ledger.")).toBeVisible();
    await waitFor(() => expect(screen.queryAllByLabelText("1 unseen")).toHaveLength(0));
    expect(contentAcknowledgmentAttempts).toBe(2);
  });

  it("requests an authoritative offline sequence boundary when the event stream reconnects", async () => {
    const recoveredSnapshot: PublicSnapshot = {
      ...snapshot,
      sequence: 9,
      latestChapterReleasePresentation: undefined,
      presentationHistory: [],
      log: [
        {
          key: "offline-log-9",
          sequence: 9,
          title: "The captain recorded a note",
          summary: "A new player-facing entry joined the voyage record.",
          timestamp: "2026-07-19T15:00:00.000Z",
          symbol: "note",
          importance: "quiet",
          section: "log",
          synchronization: { source: "offline-recovery", synchronizedAt: "2026-07-19T15:01:00.000Z" },
          unseen: true,
        },
      ],
    };
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/snapshot?offlineAfterSequence=")) return Promise.resolve(response(recoveredSnapshot));
      if (url.endsWith("/snapshot")) return Promise.resolve(response(snapshot));
      if (url.includes("/viewed") && (init?.method ?? "GET") === "GET") {
        return Promise.resolve(response({ acknowledgedEventIds: [] }));
      }
      return Promise.resolve(response({ ok: true }));
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("scrollTo", vi.fn());
    sessionStorage.setItem("forever-intro:test-voyage", "seen");
    mocks.play.mockImplementation(async (scene: AnimationSceneName, options: PlaySceneOptions<void>) =>
      receipt("presented", options, scene),
    );

    renderPlayer(snapshot);
    await openJournal();
    await waitFor(() => expect(TestEventSource.instances).toHaveLength(1));
    act(() => TestEventSource.instances[0]!.fail());
    act(() => window.dispatchEvent(new Event("online")));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/player/test-voyage/snapshot?offlineAfterSequence=8",
        expect.objectContaining({ cache: "no-store" }),
      ),
    );
  });
});

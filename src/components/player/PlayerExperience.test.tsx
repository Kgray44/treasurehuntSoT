import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
import type { PublicSnapshot, ReplayablePresentation } from "@/domain/story";
import { sceneContracts } from "@/animation/director/scene-registry";
import { AnimationAuthorityContext, useOptionalSceneHost } from "@/animation/hosts/SceneHostContext";
import { SceneHost, useSceneTargetRegistration } from "@/animation/hosts/SceneHost";
import { SceneHostRegistry } from "@/animation/hosts/scene-host-registry";
import type { ExternalTargetExportRequest } from "@/animation/hosts/scene-host-types";
import { PlayerExperience } from "./PlayerExperience";

const mocks = vi.hoisted(() => {
  return {
    play: vi.fn(),
    skip: vi.fn(),
    cycle: vi.fn(),
    motionMode: "reduced" as MotionMode,
    waitForJournalPhase: vi.fn(),
    audioPlayValidated: vi.fn(),
    audioStopAll: vi.fn(),
    sectionAnimationComplete: null as ((definition: string) => void) | null,
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

function TestJournalWorkspace({ onSceneHostChange }: { onSceneHostChange?: (host: unknown) => void }) {
  return (
    <SceneHost
      as="section"
      kind="player-progression"
      hostKey="test-ready-journal-ceremony"
      data-section-heading
      tabIndex={-1}
    >
      <h2>The Voyage Journal</h2>
      <TestReadyJournalContents onSceneHostChange={onSceneHostChange} />
    </SceneHost>
  );
}

function TestReadyJournalContents({ onSceneHostChange }: { onSceneHostChange?: (host: unknown) => void }) {
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
    return () => onSceneHostChange?.(null);
  }, [handle, host, onSceneHostChange]);
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

function ArrivalGeometrySibling() {
  return (
    <SceneHost kind="journal-opening" hostKey="test-arrival-geometry-sibling" data-testid="arrival-geometry-sibling">
      <TestRegisteredTarget
        targetKey="test-sibling:title"
        part="title"
        kind="arrival"
        itemKey="title"
        allowedProperties={["clip-path", "opacity"]}
      />
      <TestRegisteredTarget
        targetKey="test-sibling:arrival-copy"
        part="arrival-copy"
        kind="arrival"
        itemKey="arrival-copy"
        allowedProperties={["transform", "opacity"]}
      />
      <TestRegisteredTarget
        targetKey="test-sibling:arrival-action"
        part="arrival-action"
        kind="arrival"
        itemKey="arrival-action"
        allowedProperties={["transform", "opacity"]}
      />
    </SceneHost>
  );
}

function PlayerEventGeometrySibling() {
  return (
    <SceneHost
      kind="player-progression"
      hostKey="test-player-event-geometry-sibling"
      data-testid="player-event-geometry-sibling"
    >
      <TestRegisteredTarget
        targetKey="test-event-sibling:artifact-reveal"
        part="artifact-reveal"
        kind="player-event"
        itemKey="artifact-reveal"
        allowedProperties={["transform", "opacity"]}
      />
      <TestRegisteredTarget
        targetKey="test-event-sibling:solved-stamp"
        part="solved-stamp"
        kind="player-event"
        itemKey="solved-stamp"
        allowedProperties={["transform", "opacity"]}
      />
      <TestRegisteredTarget
        targetKey="test-event-sibling:undo-mark"
        part="undo-mark"
        kind="player-event"
        itemKey="undo-mark"
        allowedProperties={["transform", "opacity"]}
      />
      <TestRegisteredTarget
        targetKey="test-event-sibling:workspace-light"
        part="workspace-light"
        kind="player-event"
        itemKey="workspace-light"
        allowedProperties={["opacity"]}
      />
      <TestRegisteredTarget
        targetKey="test-event-sibling:command-light"
        part="command-light"
        kind="player-event"
        itemKey="command-light"
        allowedProperties={["opacity"]}
      />
    </SceneHost>
  );
}

function geometryRect(x: number, y: number, width: number, height: number): DOMRect {
  return {
    x,
    y,
    width,
    height,
    top: y,
    right: x + width,
    bottom: y + height,
    left: x,
    toJSON: () => ({}),
  } as DOMRect;
}

function installJournalOpeningGeometry() {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const openingHost = this.dataset.sceneHostKind === "journal-opening";
    const sibling = this.dataset.testid === "arrival-geometry-sibling";
    if (openingHost) {
      if (this.style.display === "contents") return geometryRect(sibling ? 800 : 0, 0, 0, 0);
      return geometryRect(sibling ? 800 : 0, 0, 560, 420);
    }
    const parentIsSibling = this.parentElement?.dataset.testid === "arrival-geometry-sibling";
    if (this.dataset.scenePart) return geometryRect(parentIsSibling ? 820 : 20, 20, 160, 60);
    return geometryRect(0, 0, 100, 100);
  });
}

function installPlayerEventGeometry() {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const eventHost = this.classList.contains("player-event-host");
    const siblingHost = this.dataset.testid === "player-event-geometry-sibling";
    if (eventHost || siblingHost) {
      if (this.style.display === "contents") return geometryRect(siblingHost ? 1_000 : 0, 0, 0, 0);
      return geometryRect(siblingHost ? 1_000 : 0, 0, 800, 600);
    }
    if (this.dataset.testid?.startsWith("test-event-sibling:")) return geometryRect(1_020, 20, 120, 80);
    if (this.dataset.scenePart) return geometryRect(20, 20, 120, 80);
    if (this.dataset.sceneHostKind) return geometryRect(0, 0, 800, 600);
    return geometryRect(0, 0, 100, 100);
  });
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
  },
}));

vi.mock("@/animation/director/useAnimationDirector", () => ({
  useAnimationDirector: () => ({
    director: { play: mocks.play, skip: mocks.skip },
    snapshot: {
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
    },
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
    onDimTargetChange,
  }: {
    navigate: (view: string) => void;
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
        <button onClick={() => navigate("chart")}>Open chart</button>
        <button onClick={() => navigate("treasures")}>Open treasures</button>
      </>
    );
  },
  MobileNavigation: ({ onDimTargetChange }: { onDimTargetChange?: (registration: unknown) => void }) => {
    return (
      <TestCapabilityTarget
        targetKey="test-companion:mobile-dim"
        part="companion-mobile-navigation-dim"
        capabilityKey="companion-mobile-navigation-dim"
        allowedProperties={["opacity"]}
        report={onDimTargetChange}
      />
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

function chapterPlayCalls() {
  return mocks.play.mock.calls.filter(([scene]) => scene === "chapter-release") as Array<
    [AnimationSceneName, PlaySceneOptions<void>]
  >;
}

async function openJournal() {
  fireEvent.click(screen.getByRole("button", { name: /Open the journal/ }));
  await screen.findByRole("button", { name: "Replay introduction" });
}

function mutationCalls(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter(([input, init]) => {
    const url = String(input);
    const method = (init as RequestInit | undefined)?.method ?? "GET";
    return method !== "GET" && !url.endsWith("/presence");
  });
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

describe("PlayerExperience presentation integrity", () => {
  beforeEach(() => {
    TestEventSource.instances = [];
    vi.stubGlobal("EventSource", TestEventSource);
    mocks.play.mockReset();
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

  it("focuses the scoped semantic section after Chart navigation and history restoration", async () => {
    const navigationSnapshot: PublicSnapshot = {
      ...snapshot,
      chapter: { ...snapshot.chapter, unseen: false },
      chapters: snapshot.chapters.map((chapter) => ({ ...chapter, unseen: false })),
      unseen: { ...snapshot.unseen, journal: 0 },
      latestChapterReleasePresentation: undefined,
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ ok: true })));
    mocks.play.mockImplementation(async (scene: AnimationSceneName, options: PlaySceneOptions<void>) =>
      receipt("presented", options, scene),
    );
    renderPlayer(navigationSnapshot);
    await openJournal();

    fireEvent.click(screen.getByRole("button", { name: "Open chart" }));
    const chartHeading = await screen.findByRole("heading", { name: "Voyage chart" });
    act(() => mocks.sectionAnimationComplete?.("enter"));
    expect(chartHeading.closest("[data-section-heading]")).toHaveFocus();

    act(() => {
      history.pushState({}, "", "/?section=journal");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    const journalHeading = await screen.findByRole("heading", { name: "The Voyage Journal" });
    act(() => mocks.sectionAnimationComplete?.("enter"));
    expect(journalHeading.closest("[data-section-heading]")).toHaveFocus();
  });

  it("presents first arrival from the authentic boxed journal-opening host without touching an identical sibling host", async () => {
    installJournalOpeningGeometry();
    const openingSnapshot: PublicSnapshot = {
      ...snapshot,
      chapter: { ...snapshot.chapter, unseen: false },
      chapters: snapshot.chapters.map((chapter) => ({ ...chapter, unseen: false })),
      unseen: { ...snapshot.unseen, journal: 0 },
      latestChapterReleasePresentation: undefined,
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ ok: true })));
    let releaseArrival!: () => void;
    const arrivalGate = new Promise<void>((resolve) => {
      releaseArrival = resolve;
    });
    mocks.play.mockImplementation(async (scene: AnimationSceneName, options: PlaySceneOptions<void>) => {
      if (scene === "first-arrival") await arrivalGate;
      return receipt("presented", options, scene);
    });
    const view = renderPlayer(openingSnapshot, <ArrivalGeometrySibling />);

    fireEvent.click(screen.getByRole("button", { name: /Open the journal/ }));
    await waitFor(() => expect(mocks.play.mock.calls.some(([scene]) => scene === "first-arrival")).toBe(true));
    const [, options] = mocks.play.mock.calls.find(([scene]) => scene === "first-arrival") as [
      AnimationSceneName,
      PlaySceneOptions<void>,
    ];
    const openingRoot = document.getElementsByClassName("voyage-introduction")[0] as HTMLElement;
    expect(openingRoot).toHaveAttribute("data-scene-host-boundary", "journal-opening");
    expect(openingRoot.style.display).not.toBe("contents");
    expect(openingRoot.getBoundingClientRect()).toMatchObject({ width: 560, height: 420 });

    const registry = latestRegistry;
    if (!registry || !options.sceneHost) throw new Error("Expected the live journal-opening registry host.");
    expect(registry.hostForRoot(openingRoot)).toBe(options.sceneHost);
    const invocation = options.sceneHost.beginScene({
      sceneName: "first-arrival",
      playback: "live",
      targetContract: sceneContracts["first-arrival"],
      motionPolicy,
    });
    const resolution = invocation.resolveTargets();
    expect(resolution.requiredSatisfied).toBe(true);
    expect(resolution.entries.filter((entry) => entry.required)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ part: "title", candidateCount: 1, visibilitySatisfied: true }),
        expect.objectContaining({ part: "arrival-copy", candidateCount: 1, visibilitySatisfied: true }),
        expect.objectContaining({ part: "arrival-action", candidateCount: 1, visibilitySatisfied: true }),
      ]),
    );
    const acceptedIds = resolution.entries.flatMap((entry) => entry.acceptedTargetIds);
    const siblingIds = [
      screen.getByTestId("test-sibling:title").dataset.sceneTargetId,
      screen.getByTestId("test-sibling:arrival-copy").dataset.sceneTargetId,
      screen.getByTestId("test-sibling:arrival-action").dataset.sceneTargetId,
    ];
    expect(acceptedIds).not.toEqual(expect.arrayContaining(siblingIds));
    expect(screen.getByTestId("arrival-geometry-sibling")).toBeInTheDocument();
    await invocation.abort("runtime-failed");

    releaseArrival();
    await screen.findByRole("button", { name: "Replay introduction" });
    expect(registry.isRegisteredHandle(options.sceneHost)).toBe(false);
    expect(screen.getByTestId("arrival-geometry-sibling")).toBeInTheDocument();

    view.unmount();
    expect(registry.snapshot()).toMatchObject({
      registeredHostCount: 0,
      registeredTargetCount: 0,
      activeInvocationCount: 0,
      externalHandleCount: 0,
      activeClaimCount: 0,
    });
  });

  it("fails authentic first-arrival preflight if the journal-opening host regresses to a zero-box contents boundary", async () => {
    installJournalOpeningGeometry();
    const openingSnapshot: PublicSnapshot = {
      ...snapshot,
      chapter: { ...snapshot.chapter, unseen: false },
      chapters: snapshot.chapters.map((chapter) => ({ ...chapter, unseen: false })),
      unseen: { ...snapshot.unseen, journal: 0 },
      latestChapterReleasePresentation: undefined,
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ ok: true })));
    let releaseArrival!: () => void;
    const arrivalGate = new Promise<void>((resolve) => {
      releaseArrival = resolve;
    });
    mocks.play.mockImplementation(async (scene: AnimationSceneName, options: PlaySceneOptions<void>) => {
      if (scene === "first-arrival") await arrivalGate;
      return receipt("presented", options, scene);
    });
    renderPlayer(openingSnapshot);

    fireEvent.click(screen.getByRole("button", { name: /Open the journal/ }));
    await waitFor(() => expect(mocks.play.mock.calls.some(([scene]) => scene === "first-arrival")).toBe(true));
    const [, options] = mocks.play.mock.calls.find(([scene]) => scene === "first-arrival") as [
      AnimationSceneName,
      PlaySceneOptions<void>,
    ];
    const openingRoot = document.getElementsByClassName("voyage-introduction")[0] as HTMLElement;
    openingRoot.style.display = "contents";
    expect(openingRoot.getBoundingClientRect()).toMatchObject({ width: 0, height: 0 });
    if (!options.sceneHost) throw new Error("Expected the live journal-opening host.");
    const invocation = options.sceneHost.beginScene({
      sceneName: "first-arrival",
      playback: "live",
      targetContract: sceneContracts["first-arrival"],
      motionPolicy,
    });
    const resolution = invocation.resolveTargets();
    expect(resolution.requiredSatisfied).toBe(false);
    for (const entry of resolution.entries.filter((candidate) => candidate.required)) {
      expect(entry.acceptedTargetIds).toEqual([]);
      expect(entry.rejectionCodes).toContain("target-outside-host");
    }
    await invocation.abort("runtime-failed");
    releaseArrival();
  });

  it("resolves artifact, solved, and undo targets from each boxed event host while excluding an identical sibling host", async () => {
    installPlayerEventGeometry();
    const alpha = {
      key: "alpha",
      state: "AWARDED",
      name: "Alpha",
      displayX: 20,
      displayY: 30,
      unseen: false,
    };
    const eventSnapshot: PublicSnapshot = {
      ...snapshot,
      sequence: 10,
      chapter: { ...snapshot.chapter, unseen: false },
      chapters: snapshot.chapters.map((chapter) => ({ ...chapter, unseen: false })),
      unseen: { ...snapshot.unseen, journal: 0, treasures: 0 },
      latestChapterReleasePresentation: undefined,
      artifacts: [alpha],
    };
    const fetchMock = vi.fn((input: RequestInfo | URL) =>
      String(input).endsWith("/snapshot")
        ? Promise.resolve(response(eventSnapshot))
        : Promise.resolve(response({ ok: true })),
    );
    vi.stubGlobal("fetch", fetchMock);

    const eventIds = ["event-artifact", "event-solved", "event-undo"] as const;
    const gates = new Map<string, Promise<void>>();
    const releases = new Map<string, () => void>();
    for (const eventId of eventIds) {
      gates.set(eventId, new Promise<void>((resolve) => releases.set(eventId, resolve)));
    }
    mocks.play.mockImplementation(async (scene: AnimationSceneName, options: PlaySceneOptions<void>) => {
      const gate = options.eventOrActionId ? gates.get(options.eventOrActionId) : undefined;
      if (gate) await gate;
      return receipt("presented", options, scene);
    });

    const view = renderPlayer(eventSnapshot, <PlayerEventGeometrySibling />);
    await openJournal();
    fireEvent.click(screen.getByRole("button", { name: "Open treasures" }));
    await screen.findByTestId("test-artifact:alpha:layout-source");
    const registry = latestRegistry;
    if (!registry) throw new Error("Expected the live provider registry.");
    const siblingTargets = [
      "test-event-sibling:artifact-reveal",
      "test-event-sibling:solved-stamp",
      "test-event-sibling:undo-mark",
      "test-event-sibling:workspace-light",
      "test-event-sibling:command-light",
    ].map((testId) => screen.getByTestId(testId));
    await waitFor(() => siblingTargets.forEach((target) => expect(target.dataset.sceneTargetId).toBeTruthy()));
    const siblingTargetIds = siblingTargets.map((target) => target.dataset.sceneTargetId as string);
    const baseline = registry.snapshot();
    const hostIds = new Set<string>();
    const cases = [
      {
        id: "event-artifact",
        type: "ARTIFACT_AWARDED",
        scene: "artifact-award",
        part: "artifact-reveal",
        payload: { key: "alpha" },
      },
      {
        id: "event-solved",
        type: "CHAPTER_SOLVED",
        scene: "mark-solved",
        part: "solved-stamp",
        payload: {},
      },
      {
        id: "event-undo",
        type: "STATE_REVERTED",
        scene: "undo",
        part: "undo-mark",
        payload: {},
      },
    ] as const;

    for (const [index, eventCase] of cases.entries()) {
      await act(async () => {
        TestEventSource.instances[0]?.emit("progression", {
          id: eventCase.id,
          type: eventCase.type,
          sequence: 11 + index,
          releaseAt: `2026-07-18T12:${11 + index}:00.000Z`,
          payload: eventCase.payload,
        });
      });
      await waitFor(() =>
        expect(mocks.play.mock.calls.some(([, options]) => options.eventOrActionId === eventCase.id)).toBe(true),
      );
      const [sceneName, options] = mocks.play.mock.calls.find(
        ([, candidateOptions]) => candidateOptions.eventOrActionId === eventCase.id,
      ) as [AnimationSceneName, PlaySceneOptions<void>];
      expect(sceneName).toBe(eventCase.scene);

      const eventRoot = document.getElementsByClassName("player-event-host")[0] as HTMLElement;
      expect(eventRoot).toHaveAttribute("data-scene-host-boundary", "player-progression");
      expect(eventRoot.style.position).toBe("fixed");
      expect(eventRoot.style.inset).toBe("0");
      expect(eventRoot.style.pointerEvents).toBe("none");
      expect(eventRoot.style.display).not.toBe("contents");
      expect(eventRoot.getBoundingClientRect()).toMatchObject({ width: 800, height: 600 });
      expect(eventRoot).not.toHaveAttribute("aria-hidden");
      if (!options.sceneHost) throw new Error(`Expected the live host for ${eventCase.id}.`);
      expect(registry.hostForRoot(eventRoot)).toBe(options.sceneHost);
      hostIds.add(options.sceneHost.hostId);

      const invocation = options.sceneHost.beginScene({
        sceneName: eventCase.scene,
        playback: "live",
        targetContract: sceneContracts[eventCase.scene],
        motionPolicy,
        ...(options.externalTargets ? { externalTargets: options.externalTargets } : {}),
      });
      const resolution = invocation.resolveTargets();
      expect(resolution.requiredSatisfied).toBe(true);
      const localEntry = resolution.entries.find((entry) => entry.part === eventCase.part);
      expect(localEntry).toMatchObject({
        required: true,
        candidateCount: 1,
        visibilitySatisfied: true,
        rejectionCodes: [],
      });
      const localTarget = Array.from(eventRoot.getElementsByTagName("*")).find(
        (element) => (element as HTMLElement).dataset.scenePart === eventCase.part,
      ) as HTMLElement | undefined;
      expect(localTarget?.dataset.sceneTargetId).toBe(localEntry?.acceptedTargetIds[0]);

      const acceptedIds = resolution.entries.flatMap((entry) => entry.acceptedTargetIds);
      expect(acceptedIds).not.toEqual(expect.arrayContaining(siblingTargetIds));
      if (eventCase.scene === "artifact-award") {
        expect(resolution.entries.find((entry) => entry.part === "workspace-light")).toMatchObject({
          required: false,
          candidateCount: 1,
          visibilitySatisfied: true,
        });
        expect(options.externalTargets?.["artifact-slot"]?.targetId).toBe(
          screen.getByTestId("test-artifact:alpha:layout-source").dataset.sceneTargetId,
        );
      } else {
        expect(resolution.entries.find((entry) => entry.part === "command-light")).toMatchObject({
          required: false,
          candidateCount: 0,
          acceptedTargetIds: [],
        });
      }
      expect(screen.getByTestId("player-event-geometry-sibling")).toBeInTheDocument();
      siblingTargets.forEach((target, targetIndex) => {
        expect(target.dataset.sceneTargetId).toBe(siblingTargetIds[targetIndex]);
      });
      await invocation.abort("runtime-failed");

      releases.get(eventCase.id)?.();
      await waitFor(() => expect(document.getElementsByClassName("player-event-host")).toHaveLength(0));
      await waitFor(() => expect(registry.snapshot()).toEqual(baseline));
    }

    expect(hostIds.size).toBe(cases.length);
    view.unmount();
    expect(registry.snapshot()).toMatchObject({
      registeredHostCount: 0,
      registeredTargetCount: 0,
      activeInvocationCount: 0,
      externalHandleCount: 0,
      activeClaimCount: 0,
    });
  });

  it("rejects a local progression target if an event host regresses to a zero-box contents boundary", async () => {
    installPlayerEventGeometry();
    const eventSnapshot: PublicSnapshot = {
      ...snapshot,
      chapter: { ...snapshot.chapter, unseen: false },
      chapters: snapshot.chapters.map((chapter) => ({ ...chapter, unseen: false })),
      unseen: { ...snapshot.unseen, journal: 0 },
      latestChapterReleasePresentation: undefined,
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(eventSnapshot)));
    let releaseSolved!: () => void;
    const solvedGate = new Promise<void>((resolve) => {
      releaseSolved = resolve;
    });
    mocks.play.mockImplementation(async (scene: AnimationSceneName, options: PlaySceneOptions<void>) => {
      if (options.eventOrActionId === "event-zero-box") await solvedGate;
      return receipt("presented", options, scene);
    });
    renderPlayer(eventSnapshot);
    await openJournal();

    await act(async () => {
      TestEventSource.instances[0]?.emit("progression", {
        id: "event-zero-box",
        type: "CHAPTER_SOLVED",
        sequence: 11,
        releaseAt: "2026-07-18T12:11:00.000Z",
        payload: {},
      });
    });
    await waitFor(() =>
      expect(mocks.play.mock.calls.some(([, options]) => options.eventOrActionId === "event-zero-box")).toBe(true),
    );
    const [, options] = mocks.play.mock.calls.find(
      ([, candidateOptions]) => candidateOptions.eventOrActionId === "event-zero-box",
    ) as [AnimationSceneName, PlaySceneOptions<void>];
    const eventRoot = document.getElementsByClassName("player-event-host")[0] as HTMLElement;
    eventRoot.style.display = "contents";
    expect(eventRoot.getBoundingClientRect()).toMatchObject({ width: 0, height: 0 });
    if (!options.sceneHost) throw new Error("Expected the live event host.");
    const invocation = options.sceneHost.beginScene({
      sceneName: "mark-solved",
      playback: "live",
      targetContract: sceneContracts["mark-solved"],
      motionPolicy,
    });
    const resolution = invocation.resolveTargets();
    expect(resolution.requiredSatisfied).toBe(false);
    expect(resolution.entries.find((entry) => entry.part === "solved-stamp")).toMatchObject({
      acceptedTargetIds: [],
      rejectionCodes: expect.arrayContaining(["target-outside-host"]),
    });
    await invocation.abort("runtime-failed");
    releaseSolved();
  });

  it("replays persisted safe data from an interactive section without any additional story or viewed mutation", async () => {
    const viewedSnapshot: PublicSnapshot = {
      ...snapshot,
      chapter: { ...snapshot.chapter, unseen: false },
      chapters: snapshot.chapters.map((chapter) => ({ ...chapter, unseen: false })),
      unseen: { ...snapshot.unseen, journal: 0 },
    };
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/viewed?") && !init?.method) return Promise.resolve(response({ acknowledged: true }));
      if (url.endsWith("/snapshot")) return Promise.resolve(response(viewedSnapshot));
      return Promise.resolve(response({ ok: true }));
    });
    vi.stubGlobal("fetch", fetchMock);
    mocks.play.mockImplementation(async (scene: AnimationSceneName, options: PlaySceneOptions<void>) =>
      receipt("presented", options, scene),
    );
    renderPlayer(snapshot);

    await openJournal();
    await waitFor(() =>
      expect(viewedPostBodies(fetchMock).filter((body) => body.contentType === "chapter")).toHaveLength(1),
    );
    fireEvent.click(screen.getByText("Open chart"));
    const chartHeading = await screen.findByText("Voyage chart");
    const chartSection = chartHeading.closest<HTMLElement>("[data-section-heading]");
    chartSection?.focus();
    expect(chartSection).toHaveFocus();
    const mutationsBeforeReplay = mutationCalls(fetchMock).length;

    fireEvent.click(screen.getAllByRole("button", { name: "Replay latest chapter" })[0]);

    await waitFor(() => expect(chapterPlayCalls()).toHaveLength(1));
    await waitFor(() => expect(screen.getByText("Voyage chart").closest("[data-section-heading]")).toHaveFocus());
    const [scene, options] = chapterPlayCalls()[0];
    expect(scene).toBe("chapter-release");
    expect(options).toMatchObject({
      hostKind: "player-progression",
      requestSource: "replay",
      eventOrActionId: release.eventId,
      display: release.payload,
      telemetryContext: { route: "/tale", playerSection: "journal" },
    });
    expect(options.sceneHost?.hostId).toBe(options.hostId);
    expect(options.externalTargets && Object.keys(options.externalTargets).sort()).toEqual([
      "companion-desktop-navigation-dim",
      "companion-header-dim",
      "companion-mobile-navigation-dim",
    ]);
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(mutationCalls(fetchMock)).toHaveLength(mutationsBeforeReplay);
    expect(viewedPostBodies(fetchMock).filter((body) => body.eventId === release.eventId)).toHaveLength(0);
  });

  it("keeps a failed automatic release unviewed, then acknowledges exactly once after retry succeeds", async () => {
    const beforeRelease: PublicSnapshot = {
      ...snapshot,
      chapter: { ...snapshot.chapter, unseen: false },
      chapters: snapshot.chapters.map((chapter) => ({ ...chapter, unseen: false })),
      unseen: { ...snapshot.unseen, journal: 0 },
    };
    delete beforeRelease.latestChapterReleasePresentation;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      if (String(input).endsWith("/snapshot")) return Promise.resolve(response(snapshot));
      return Promise.resolve(response({ ok: true }));
    });
    vi.stubGlobal("fetch", fetchMock);
    let chapterAttempt = 0;
    mocks.play.mockImplementation(async (scene: AnimationSceneName, options: PlaySceneOptions<void>) => {
      if (scene !== "chapter-release") return receipt("presented", options, scene);
      chapterAttempt += 1;
      return receipt(chapterAttempt === 1 ? "missing-required-target" : "presented", options, scene);
    });
    renderPlayer(beforeRelease);

    await openJournal();

    await act(async () => {
      TestEventSource.instances[0]?.emit("progression", {
        id: release.eventId,
        type: "CHAPTER_RELEASED",
        sequence: release.sequence,
        releaseAt: release.occurredAt,
        payload: { title: "untrusted event payload", secret: "must-not-reach-director" },
      });
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("Your progress is safe");
    expect(viewedPostCalls(fetchMock)).toEqual([]);
    await waitFor(() => expect(fetchMock.mock.calls.some(([input]) => String(input).endsWith("/snapshot"))).toBe(true));
    expect(chapterPlayCalls()[0]?.[1]).toEqual(
      expect.objectContaining({ display: release.payload, requestSource: "automatic" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Retry ceremony" }));

    await waitFor(() => expect(chapterPlayCalls()).toHaveLength(2));
    await waitFor(() =>
      expect(viewedPostBodies(fetchMock).filter((body) => body.eventId === release.eventId)).toHaveLength(1),
    );
    expect(screen.queryByText("Your progress is safe", { exact: false })).not.toBeInTheDocument();

    await act(async () => {
      TestEventSource.instances[0]?.emit("progression", {
        id: release.eventId,
        type: "CHAPTER_RELEASED",
        sequence: release.sequence,
        releaseAt: release.occurredAt,
        payload: {},
      });
    });
    expect(chapterPlayCalls()).toHaveLength(2);
    expect(viewedPostBodies(fetchMock).filter((body) => body.eventId === release.eventId)).toHaveLength(1);
  });

  it("recovers an unacknowledged persisted release after remount without an automatic retry storm", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/viewed?")) return Promise.resolve(response({ acknowledged: false }));
      if (url.endsWith("/snapshot")) return Promise.resolve(response(snapshot));
      return Promise.resolve(response({ ok: true }));
    });
    vi.stubGlobal("fetch", fetchMock);
    let chapterAttempt = 0;
    mocks.play.mockImplementation(async (scene: AnimationSceneName, options: PlaySceneOptions<void>) => {
      if (scene !== "chapter-release") return receipt("presented", options, scene);
      chapterAttempt += 1;
      return receipt(chapterAttempt === 1 ? "interrupted" : "presented", options, scene);
    });

    const first = renderPlayer(snapshot);
    await openJournal();
    expect(await screen.findByRole("alert")).toHaveTextContent("Your progress is safe");
    await waitFor(() => expect(chapterPlayCalls()).toHaveLength(1));
    expect(viewedPostBodies(fetchMock).filter((body) => body.eventId === release.eventId)).toHaveLength(0);

    first.unmount();
    renderPlayer(snapshot);
    await openJournal();

    await waitFor(() => expect(chapterPlayCalls()).toHaveLength(2));
    await waitFor(() =>
      expect(viewedPostBodies(fetchMock).filter((body) => body.eventId === release.eventId)).toHaveLength(1),
    );
    expect(screen.queryByText("Your progress is safe", { exact: false })).not.toBeInTheDocument();
  });

  it("clears revoked replay data and its readable fallback on snapshot reconciliation", async () => {
    const seenSnapshot: PublicSnapshot = {
      ...snapshot,
      chapter: { ...snapshot.chapter, unseen: false },
      chapters: snapshot.chapters.map((chapter) => ({ ...chapter, unseen: false })),
      unseen: { ...snapshot.unseen, journal: 0 },
    };
    const revokedSnapshot = { ...seenSnapshot };
    delete revokedSnapshot.latestChapterReleasePresentation;
    let refreshed: PublicSnapshot = seenSnapshot;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/viewed?")) return Promise.resolve(response({ acknowledged: true }));
      if (url.endsWith("/snapshot")) return Promise.resolve(response(refreshed));
      return Promise.resolve(response({ ok: true }));
    });
    vi.stubGlobal("fetch", fetchMock);
    mocks.play.mockImplementation(async (scene: AnimationSceneName, options: PlaySceneOptions<void>) => {
      if (scene === "chapter-release" && options.presentationFallback) {
        await options.presentationFallback({
          sceneName: scene,
          sceneInstanceId: "fallback-instance",
          hostId: options.hostId ?? "player-progression-host",
          hostKind: options.hostKind ?? "player-progression",
          fallback: "static-reader",
          trigger: "runtime-failed",
          motionPolicy,
          signal: options.signal,
        });
        return receipt("presented-fallback", options, scene);
      }
      return receipt("presented", options, scene);
    });
    renderPlayer(seenSnapshot);
    await openJournal();
    await waitFor(() => expect(screen.getByRole("button", { name: "Replay latest chapter" })).toBeInTheDocument());

    fireEvent.click(screen.getAllByRole("button", { name: "Replay latest chapter" })[0]);
    expect(await screen.findByText(release.payload.narrative)).toBeInTheDocument();

    refreshed = revokedSnapshot;
    window.dispatchEvent(new Event("online"));

    await waitFor(() => expect(screen.queryAllByRole("button", { name: "Replay latest chapter" })).toHaveLength(0));
    expect(screen.queryByText(release.payload.narrative)).not.toBeInTheDocument();
  });

  it("routes keyed map and log capabilities through the exact event host while identical host-local parts coexist", async () => {
    const progressionSnapshot: PublicSnapshot = {
      ...snapshot,
      sequence: 10,
      chapter: { ...snapshot.chapter, unseen: false },
      chapters: snapshot.chapters.map((chapter) => ({ ...chapter, unseen: false })),
      unseen: { ...snapshot.unseen, journal: 0, chart: 1, log: 1 },
      latestChapterReleasePresentation: undefined,
      mapLocations: [{ key: "reef-b", state: "REVEALED", label: "Reef B", name: "Reef B", x: 35, y: 42, unseen: true }],
      log: [
        {
          key: "entry-b",
          sequence: 10,
          title: "Fresh bearings",
          summary: "The reef is marked.",
          timestamp: "2026-07-18T12:10:00.000Z",
          symbol: "compass",
          importance: "notable",
          section: "chart",
          unseen: true,
        },
      ],
    };
    const fetchMock = vi.fn((input: RequestInfo | URL) =>
      String(input).endsWith("/snapshot")
        ? Promise.resolve(response(progressionSnapshot))
        : Promise.resolve(response({ ok: true })),
    );
    vi.stubGlobal("fetch", fetchMock);
    let releaseMap!: () => void;
    let releaseLog!: () => void;
    const mapGate = new Promise<void>((resolve) => {
      releaseMap = resolve;
    });
    const logGate = new Promise<void>((resolve) => {
      releaseLog = resolve;
    });
    mocks.play.mockImplementation(async (scene: AnimationSceneName, options: PlaySceneOptions<void>) => {
      if (scene === "map-reveal") await mapGate;
      if (scene === "log-entry") await logGate;
      return receipt("presented", options, scene);
    });
    renderPlayer(progressionSnapshot);
    await openJournal();

    await act(async () => {
      TestEventSource.instances[0]?.emit("progression", {
        id: "map-event-reef-b",
        type: "MAP_LOCATION_REVEALED",
        sequence: 11,
        releaseAt: "2026-07-18T12:11:00.000Z",
        payload: { key: "reef-b" },
      });
    });
    await waitFor(() => expect(mocks.play.mock.calls.some(([scene]) => scene === "map-reveal")).toBe(true));
    const [, mapOptions] = mocks.play.mock.calls.find(([scene]) => scene === "map-reveal") as [
      AnimationSceneName,
      PlaySceneOptions<void>,
    ];
    const mapTargets = mapOptions.externalTargets ?? {};
    expect(Object.keys(mapTargets).sort()).toEqual(["map-fog", "map-marker"]);
    expect(mapTargets["map-marker"]?.allowedProperties).toEqual(["transform", "opacity"]);
    expect(mapTargets["map-fog"]?.allowedProperties).toEqual(["clip-path", "opacity"]);
    expect(mapTargets["map-marker"]?.destinationHostId).toBe(mapOptions.hostId);
    expect(screen.getByTestId("test-chart:location:reef-b")).toHaveAttribute(
      "data-scene-target-id",
      mapTargets["map-marker"]?.targetId,
    );
    expect(screen.getByTestId("test-chart:location:reef-b")).toHaveAttribute("data-scene-part", "map-marker");

    const persistentLight = document.getElementsByClassName("ocean-depth")[0] as HTMLElement;
    const eventLight = document.getElementsByClassName("player-event-host-light")[0] as HTMLElement;
    const persistentBoundary = persistentLight.parentElement?.parentElement;
    const eventBoundary = eventLight.parentElement;
    expect(persistentLight).toHaveAttribute("data-scene-part", "workspace-light");
    expect(eventLight).toHaveAttribute("data-scene-part", "workspace-light");
    expect(eventBoundary).toHaveAttribute("data-scene-host-id", mapOptions.hostId);
    expect(eventBoundary?.dataset.sceneHostId).not.toBe(persistentBoundary?.dataset.sceneHostId);

    releaseMap();
    await waitFor(() => expect(screen.queryByTestId("test-chart:location:reef-b")).not.toBeInTheDocument());

    await act(async () => {
      TestEventSource.instances[0]?.emit("progression", {
        id: "log-event-entry-b",
        type: "PLAYER_LOG_ENTRY_ADDED",
        sequence: 12,
        releaseAt: "2026-07-18T12:12:00.000Z",
        payload: { key: "entry-b" },
      });
    });
    await waitFor(() => expect(mocks.play.mock.calls.some(([scene]) => scene === "log-entry")).toBe(true));
    const [, logOptions] = mocks.play.mock.calls.find(([scene]) => scene === "log-entry") as [
      AnimationSceneName,
      PlaySceneOptions<void>,
    ];
    const logTargets = logOptions.externalTargets ?? {};
    expect(Object.keys(logTargets).sort()).toEqual(["log-entry", "log-symbol"]);
    expect(logTargets["log-entry"]?.allowedProperties).toEqual(["opacity", "clip-path", "filter"]);
    expect(logTargets["log-symbol"]?.allowedProperties).toEqual(["transform", "opacity"]);
    expect(screen.getByTestId("test-log:ink:entry-b")).toHaveAttribute(
      "data-scene-target-id",
      logTargets["log-entry"]?.targetId,
    );
    expect(screen.getByTestId("test-log:ink:entry-b")).toHaveAttribute("data-scene-part", "log-entry-new");
    releaseLog();
  });

  it("revokes only a removed artifact capability and retains a live sibling keyed producer", async () => {
    const alpha = {
      key: "alpha",
      state: "AWARDED",
      name: "Alpha",
      displayX: 20,
      displayY: 30,
      unseen: true,
    };
    const beta = {
      key: "beta",
      state: "AWARDED",
      name: "Beta",
      displayX: 60,
      displayY: 30,
      unseen: true,
    };
    const artifactSnapshot: PublicSnapshot = {
      ...snapshot,
      sequence: 10,
      chapter: { ...snapshot.chapter, unseen: false },
      chapters: snapshot.chapters.map((chapter) => ({ ...chapter, unseen: false })),
      unseen: { ...snapshot.unseen, journal: 0, treasures: 2 },
      latestChapterReleasePresentation: undefined,
      artifacts: [alpha, beta],
    };
    const betaOnlySnapshot: PublicSnapshot = {
      ...artifactSnapshot,
      sequence: 11,
      unseen: { ...artifactSnapshot.unseen, treasures: 1 },
      artifacts: [beta],
    };
    let refreshed = artifactSnapshot;
    const fetchMock = vi.fn((input: RequestInfo | URL) =>
      String(input).endsWith("/snapshot")
        ? Promise.resolve(response(refreshed))
        : Promise.resolve(response({ ok: true })),
    );
    vi.stubGlobal("fetch", fetchMock);
    let releaseAlpha!: () => void;
    const alphaGate = new Promise<void>((resolve) => {
      releaseAlpha = resolve;
    });
    mocks.play.mockImplementation(async (scene: AnimationSceneName, options: PlaySceneOptions<void>) => {
      if (scene === "artifact-award" && options.eventOrActionId === "artifact-alpha") await alphaGate;
      return receipt("presented", options, scene);
    });
    renderPlayer(artifactSnapshot);
    await openJournal();
    fireEvent.click(screen.getByRole("button", { name: "Open treasures" }));
    await screen.findByTestId("test-artifact:alpha:layout-source");
    await screen.findByTestId("test-artifact:beta:layout-source");

    await act(async () => {
      TestEventSource.instances[0]?.emit("progression", {
        id: "artifact-alpha",
        type: "ARTIFACT_AWARDED",
        sequence: 11,
        releaseAt: "2026-07-18T12:11:00.000Z",
        payload: { key: "alpha" },
      });
    });
    await waitFor(() =>
      expect(mocks.play.mock.calls.some(([, options]) => options.eventOrActionId === "artifact-alpha")).toBe(true),
    );
    const [, alphaOptions] = mocks.play.mock.calls.find(
      ([, options]) => options.eventOrActionId === "artifact-alpha",
    ) as [AnimationSceneName, PlaySceneOptions<void>];
    const alphaExternal = alphaOptions.externalTargets?.["artifact-slot"];
    expect(alphaExternal?.allowedProperties).toEqual([]);
    expect(alphaExternal?.lifetime).toBe("handoff");
    const registry = latestRegistry;
    if (!registry || !alphaExternal) throw new Error("Expected a live provider-scoped artifact capability.");
    expect(registry.isRegisteredExternalHandle(alphaExternal)).toBe(true);

    refreshed = betaOnlySnapshot;
    window.dispatchEvent(new Event("online"));
    await waitFor(() => expect(screen.queryByTestId("test-artifact:alpha:layout-source")).not.toBeInTheDocument());
    expect(screen.getByTestId("test-artifact:beta:layout-source")).toBeInTheDocument();
    await waitFor(() => expect(registry.isRegisteredExternalHandle(alphaExternal)).toBe(false));

    releaseAlpha();
    await waitFor(() => expect(screen.getByTestId("test-artifact:beta:layout-source")).toBeInTheDocument());
    await act(async () => {
      TestEventSource.instances[0]?.emit("progression", {
        id: "artifact-beta",
        type: "ARTIFACT_AWARDED",
        sequence: 12,
        releaseAt: "2026-07-18T12:12:00.000Z",
        payload: { key: "beta" },
      });
    });
    await waitFor(() =>
      expect(mocks.play.mock.calls.some(([, options]) => options.eventOrActionId === "artifact-beta")).toBe(true),
    );
    const [, betaOptions] = mocks.play.mock.calls.find(
      ([, options]) => options.eventOrActionId === "artifact-beta",
    ) as [AnimationSceneName, PlaySceneOptions<void>];
    expect(betaOptions.externalTargets?.["artifact-slot"]?.targetId).toBe(
      screen.getByTestId("test-artifact:beta:layout-source").dataset.sceneTargetId,
    );
  });

  it("converges a typed Journal phase timeout to a visible readable fallback", async () => {
    mocks.motionMode = "gentle";
    mocks.waitForJournalPhase.mockImplementation(async (_root, phase) =>
      phase === "BOOK_SETTLING"
        ? ({ status: "timed-out", phase, timeoutMs: 1700 } satisfies JournalPhaseOutcome)
        : ({ status: "completed", phase, finiteAnimationCount: 0, durationMs: 0 } satisfies JournalPhaseOutcome),
    );
    const fetchMock = vi.fn().mockResolvedValue(response({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    mocks.play.mockImplementation(async (scene: AnimationSceneName, options: PlaySceneOptions<void>) =>
      receipt("presented", options, scene),
    );
    const motionSnapshot: PublicSnapshot = {
      ...snapshot,
      chapter: { ...snapshot.chapter, unseen: false },
      chapters: snapshot.chapters.map((chapter) => ({ ...chapter, unseen: false })),
      unseen: { ...snapshot.unseen, journal: 0 },
      latestChapterReleasePresentation: undefined,
    };
    renderPlayer(motionSnapshot);

    fireEvent.click(screen.getByRole("button", { name: /Open the journal/ }));

    await waitFor(() => expect(screen.getByRole("main")).toHaveAttribute("data-journal-phase", "JOURNAL_READY"));
    expect(await screen.findByText(/opened in readable mode after the ceremony could not finish/i)).toBeVisible();
    expect(
      mocks.audioPlayValidated.mock.calls.some(
        ([request]) => (request as { semanticLabel?: string }).semanticLabel === "BOOK_SETTLING",
      ),
    ).toBe(false);
  });

  it("aborts an active Journal generation on resolved mode change and settles readable without later audio", async () => {
    mocks.motionMode = "full";
    let phaseSignal: AbortSignal | null = null;
    mocks.waitForJournalPhase.mockImplementation(
      (_root, phase, _mode, signal: AbortSignal) =>
        new Promise<JournalPhaseOutcome>((resolve) => {
          phaseSignal = signal;
          signal.addEventListener("abort", () => resolve({ status: "aborted", phase }), { once: true });
        }),
    );
    const fetchMock = vi.fn().mockResolvedValue(response({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    mocks.play.mockImplementation(async (scene: AnimationSceneName, options: PlaySceneOptions<void>) =>
      receipt("presented", options, scene),
    );
    const motionSnapshot: PublicSnapshot = {
      ...snapshot,
      chapter: { ...snapshot.chapter, unseen: false },
      chapters: snapshot.chapters.map((chapter) => ({ ...chapter, unseen: false })),
      unseen: { ...snapshot.unseen, journal: 0 },
      latestChapterReleasePresentation: undefined,
    };
    const view = renderPlayer(motionSnapshot);

    fireEvent.click(screen.getByRole("button", { name: /Open the journal/ }));
    await waitFor(() => expect(phaseSignal).toBeInstanceOf(AbortSignal));
    mocks.motionMode = "reduced";
    view.rerender(
      <TestAnimationAuthority>
        <PlayerExperience initialSnapshot={motionSnapshot} />
      </TestAnimationAuthority>,
    );

    await waitFor(() => expect(phaseSignal?.aborted).toBe(true));
    expect(await screen.findByRole("button", { name: "Replay introduction" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("data-journal-phase", "JOURNAL_READY");
    expect(mocks.audioPlayValidated).not.toHaveBeenCalled();
    expect(mocks.audioStopAll).toHaveBeenCalledTimes(2);
  });
});

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AnimationSceneName,
  JournalPhaseOutcome,
  MotionMode,
  PlaySceneOptions,
  PresentationOutcome,
  PresentationReceipt,
} from "@/animation/core/animation-types";
import type { PublicSnapshot, ReplayablePresentation } from "@/domain/story";
import { PlayerExperience } from "./PlayerExperience";

const mocks = vi.hoisted(() => ({
  play: vi.fn(),
  skip: vi.fn(),
  cycle: vi.fn(),
  motionMode: "reduced" as MotionMode,
  waitForJournalPhase: vi.fn(),
  audioPlayValidated: vi.fn(),
  audioStopAll: vi.fn(),
}));

vi.mock("motion/react", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  motion: {
    div: (
      input: React.HTMLAttributes<HTMLDivElement> & {
        variants?: unknown;
        initial?: unknown;
        animate?: unknown;
        exit?: unknown;
        onAnimationComplete?: unknown;
      },
    ) => {
      const { children, ...props } = input;
      delete props.variants;
      delete props.initial;
      delete props.animate;
      delete props.exit;
      delete props.onAnimationComplete;
      return <div {...props}>{children}</div>;
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
  CompanionHeader: ({ replay, canReplay }: { replay: () => void; canReplay: boolean }) =>
    canReplay ? <button onClick={replay}>Replay latest chapter</button> : null,
}));
vi.mock("./workspace/CompanionNavigation", () => ({
  CompanionNavigation: ({ navigate }: { navigate: (view: string) => void }) => (
    <button onClick={() => navigate("chart")}>Open chart</button>
  ),
  MobileNavigation: () => null,
}));
vi.mock("./workspace/JournalWorkspace", () => ({
  JournalWorkspace: () => <div data-scene-part="sealed-parchment">Safe chapter surface</div>,
}));
vi.mock("./workspace/VoyageChart", () => ({
  VoyageChart: () => (
    <h2 data-section-heading tabIndex={-1}>
      Voyage chart
    </h2>
  ),
}));
vi.mock("./workspace/ArtifactInspection", () => ({ ArtifactInspection: () => null }));
vi.mock("./workspace/FinaleChamber", () => ({ FinaleChamber: () => null }));
vi.mock("./workspace/ObjectiveNote", () => ({ ObjectiveNote: () => null }));
vi.mock("./workspace/ShipsLog", () => ({ ShipsLog: () => null }));
vi.mock("./workspace/SideQuestLedger", () => ({ SideQuestLedger: () => null }));
vi.mock("./workspace/TreasureAltar", () => ({ TreasureAltar: () => null }));

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
    render(<PlayerExperience initialSnapshot={snapshot} />);

    await openJournal();
    await waitFor(() =>
      expect(viewedPostBodies(fetchMock).filter((body) => body.contentType === "chapter")).toHaveLength(1),
    );
    fireEvent.click(screen.getByText("Open chart"));
    const chartHeading = await screen.findByText("Voyage chart");
    chartHeading.focus();
    expect(chartHeading).toHaveFocus();
    const mutationsBeforeReplay = mutationCalls(fetchMock).length;

    fireEvent.click(screen.getAllByRole("button", { name: "Replay latest chapter" })[0]);

    await waitFor(() => expect(chapterPlayCalls()).toHaveLength(1));
    await waitFor(() => expect(screen.getByText("Voyage chart")).toHaveFocus());
    const [scene, options] = chapterPlayCalls()[0];
    expect(scene).toBe("chapter-release");
    expect(options).toMatchObject({
      hostId: "player-progression-host",
      hostKind: "player-progression",
      requestSource: "replay",
      eventOrActionId: release.eventId,
      display: release.payload,
      telemetryContext: { route: "/tale", playerSection: "journal" },
    });
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
    render(<PlayerExperience initialSnapshot={beforeRelease} />);

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

    const first = render(<PlayerExperience initialSnapshot={snapshot} />);
    await openJournal();
    expect(await screen.findByRole("alert")).toHaveTextContent("Your progress is safe");
    await waitFor(() => expect(chapterPlayCalls()).toHaveLength(1));
    expect(viewedPostBodies(fetchMock).filter((body) => body.eventId === release.eventId)).toHaveLength(0);

    first.unmount();
    render(<PlayerExperience initialSnapshot={snapshot} />);
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
    render(<PlayerExperience initialSnapshot={seenSnapshot} />);
    await openJournal();
    await waitFor(() => expect(screen.getByRole("button", { name: "Replay latest chapter" })).toBeInTheDocument());

    fireEvent.click(screen.getAllByRole("button", { name: "Replay latest chapter" })[0]);
    expect(await screen.findByText(release.payload.narrative)).toBeInTheDocument();

    refreshed = revokedSnapshot;
    window.dispatchEvent(new Event("online"));

    await waitFor(() => expect(screen.queryAllByRole("button", { name: "Replay latest chapter" })).toHaveLength(0));
    expect(screen.queryByText(release.payload.narrative)).not.toBeInTheDocument();
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
    render(<PlayerExperience initialSnapshot={motionSnapshot} />);

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
    const view = render(<PlayerExperience initialSnapshot={motionSnapshot} />);

    fireEvent.click(screen.getByRole("button", { name: /Open the journal/ }));
    await waitFor(() => expect(phaseSignal).toBeInstanceOf(AbortSignal));
    mocks.motionMode = "reduced";
    view.rerender(<PlayerExperience initialSnapshot={motionSnapshot} />);

    await waitFor(() => expect(phaseSignal?.aborted).toBe(true));
    expect(await screen.findByRole("button", { name: "Replay introduction" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("data-journal-phase", "JOURNAL_READY");
    expect(mocks.audioPlayValidated).not.toHaveBeenCalled();
    expect(mocks.audioStopAll).toHaveBeenCalledTimes(2);
  });
});

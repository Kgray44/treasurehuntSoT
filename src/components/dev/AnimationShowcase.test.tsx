import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { forwardRef, useEffect, useImperativeHandle, useMemo } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sceneNames } from "@/animation/core/animation-types";
import { resolveMotionPolicy } from "@/animation/core/quality";
import { AnimationAuthorityContext } from "@/animation/hosts/SceneHostContext";
import { SceneHostRegistry } from "@/animation/hosts/scene-host-registry";
import { sceneContracts } from "@/animation/director/scene-registry";
import {
  AnimationShowcase,
  showcaseCoverage,
  showcaseDemoLabel,
  showcaseDemos,
  summarizeShowcaseReceipt,
} from "./AnimationShowcase";

const harness = vi.hoisted(() => {
  const snapshot = {
    isPlaying: false,
    isPaused: false,
    scene: null,
    label: "idle",
    progress: 0,
    speed: 1,
    mode: "full",
    phase: "idle",
    queueDepth: 0,
    error: null,
  };
  const director = {
    play: vi.fn(async (sceneName: string, options: Record<string, unknown>) => ({
      sceneName,
      sceneInstanceId: "development-instance-1",
      hostId: options.hostId,
      hostKind: options.hostKind,
      requestSource: options.requestSource,
      outcome: "presented",
      motionPolicy: {
        level: "full",
        source: { productSetting: "full", browserPrefersReduced: false },
        allowSpatialTravel: true,
        allowContinuousAmbientMotion: true,
        allowPageCurl: true,
        allowRiveStateTravel: true,
        allowLottiePlayback: true,
        allowMotionCues: true,
        durationScale: 1,
        distanceScale: 1,
        preserveSemanticStaging: true,
      },
      startedAt: 1,
      completedAt: 2,
      durationMs: 1,
      semanticLabelsReached: ["scene-start", "scene-complete"],
      targetReport: {
        sceneName,
        sceneInstanceId: "development-instance-1",
        hostId: options.hostId,
        startedAt: 1,
        completedAt: 1,
        durationMs: 0,
        requiredSatisfied: true,
        observations: [
          {
            part: "title",
            required: true,
            matchedCount: 2,
            visibleCount: 1,
            duplicateCount: 1,
            ownershipRejectedCount: 0,
            observations: [],
          },
          {
            part: "fog",
            required: false,
            matchedCount: 2,
            visibleCount: 2,
            duplicateCount: 2,
            ownershipRejectedCount: 0,
            observations: [],
          },
        ],
        failures: [],
      },
      acknowledgmentAllowed: false,
      cleanup: "completed",
      operationResult: { private: "PRIVATE_PAYLOAD_SENTINEL" },
    })),
    pause: vi.fn(),
    resume: vi.fn(),
    seek: vi.fn(),
    skip: vi.fn(),
    reverse: vi.fn(),
    cancel: vi.fn(),
    setSpeed: vi.fn(),
  };
  const pageFlip = { next: vi.fn(), previous: vi.fn(), flipTo: vi.fn(), turnTo: vi.fn() };
  return { director, snapshot, pageFlip };
});

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));
vi.mock("motion/react", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: (props: React.HTMLAttributes<HTMLDivElement> & { initial?: unknown; animate?: unknown; exit?: unknown }) => {
      const divProps = { ...props };
      const children = divProps.children;
      delete divProps.children;
      delete divProps.initial;
      delete divProps.animate;
      delete divProps.exit;
      return <div {...divProps}>{children}</div>;
    },
  },
}));
vi.mock("@/animation/director/useAnimationDirector", () => ({
  useAnimationDirector: () => ({ director: harness.director, snapshot: harness.snapshot }),
}));
vi.mock("@/animation/motion/useMotionMode", () => ({
  useMotionMode: () => ({ mode: "full", setMode: vi.fn() }),
}));
vi.mock("@/components/animation/AnimationControls", () => ({
  AnimationControls: () => <div>Animation controls</div>,
}));
vi.mock("@/components/animation/LottieEffect", () => ({
  LottieEffect: forwardRef(function MockLottieEffect() {
    return <div>Lottie harness</div>;
  }),
}));
vi.mock("@/components/animation/PageFlipBook", () => ({
  PageFlipBook: forwardRef(function MockPageFlipBook(_props, ref) {
    useImperativeHandle(ref, () => harness.pageFlip);
    return <div>PageFlip harness</div>;
  }),
}));
vi.mock("@/components/animation/RiveStatefulObject", () => ({
  RiveStatefulObject: () => <div>Rive harness</div>,
}));
vi.mock("./AnimationMetrics", () => ({ AnimationMetrics: () => <div>Metrics harness</div> }));

let latestRegistry: SceneHostRegistry | null = null;

function TestAuthority({ children }: { children: React.ReactNode }) {
  const hosts = useMemo(() => new SceneHostRegistry(), []);
  useEffect(() => {
    latestRegistry = hosts;
    return () => {
      if (latestRegistry === hosts) latestRegistry = null;
      hosts.destroy();
    };
  }, [hosts]);
  const authority = useMemo(() => ({ providerId: hosts.providerId, hosts, ownership: hosts.ownership }), [hosts]);
  return <AnimationAuthorityContext.Provider value={authority}>{children}</AnimationAuthorityContext.Provider>;
}

function renderShowcase() {
  return render(
    <TestAuthority>
      <AnimationShowcase />
    </TestAuthority>,
  );
}

describe("AnimationShowcase", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("represents every registered scene and derives every row label from its reachability contract", () => {
    expect(showcaseCoverage).toEqual({ rows: 39, uniqueScenes: 29, registeredScenes: 29 });
    expect(new Set(showcaseDemos.map((demo) => demo.scene))).toEqual(new Set(sceneNames));
    expect(showcaseDemos.every((demo) => showcaseDemoLabel(demo).startsWith(`${demo.label} — `))).toBe(true);
    expect(showcaseDemos.some((demo) => demo.scene === "prepare-chapter")).toBe(true);
    expect(showcaseDemos.some((demo) => demo.scene === "mark-solved")).toBe(true);
  });

  it("summarizes only receipt target counts", () => {
    const receipt = awaitReceipt();
    expect(summarizeShowcaseReceipt(receipt)).toEqual({ required: 2, visible: 1, duplicates: 3 });
  });

  it("routes deprecated PageFlip rows to the real runtime without playing fake scenes", async () => {
    renderShowcase();
    const sceneSelect = screen.getByLabelText("Scene");

    fireEvent.change(sceneSelect, { target: { value: "manual-flip" } });
    fireEvent.click(screen.getByRole("button", { name: "Play selected scene" }));
    expect(harness.pageFlip.next).toHaveBeenCalledOnce();
    expect(harness.director.play).not.toHaveBeenCalled();

    fireEvent.change(sceneSelect, { target: { value: "programmatic-flip" } });
    fireEvent.click(screen.getByRole("button", { name: "Play selected scene" }));
    expect(harness.pageFlip.flipTo).toHaveBeenCalledWith(2);
    expect(harness.director.play).not.toHaveBeenCalled();
    expect(screen.getByText(/never plays the deprecated scene contract/i)).toBeVisible();

    fireEvent.change(sceneSelect, { target: { value: "journal-open" } });
    fireEvent.click(screen.getByRole("button", { name: "Show replacement" }));
    expect(harness.director.play).not.toHaveBeenCalled();
    expect(screen.getByText(/bounded Journal opening state machine is authoritative/i)).toBeVisible();
  });

  it("uses a provider-minted compatible host for executable scenes and renders a sanitized harness-only receipt", async () => {
    renderShowcase();
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("data-scene-host-id", "development-animation-showcase");
    expect(main).toHaveAttribute("data-scene-host-kind", "development-showcase");
    expect(main.getAttribute("data-active-scene-host-id")).toMatch(/^gateway-/);
    expect(main).toHaveAttribute("data-active-scene-host-kind", "gateway");
    expect(main).toHaveAttribute("data-harness-only", "true");
    expect(screen.getByText(/development harness only · never production proof/i)).toBeVisible();
    expect(screen.getByText(/39 harness rows · 29\/29 registered scene contracts represented/i)).toBeVisible();

    const sceneSelect = screen.getByLabelText("Scene");
    expect(within(sceneSelect).getByRole("option", { name: "Journal cover opening — deprecated" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Play selected scene" }));

    await waitFor(() => expect(harness.director.play).toHaveBeenCalledOnce());
    expect(harness.director.play).toHaveBeenCalledWith(
      "first-arrival",
      expect.objectContaining({
        hostId: expect.stringMatching(/^gateway-/),
        hostKind: "gateway",
        sceneHost: expect.objectContaining({ kind: "gateway" }),
        requestSource: "development",
        eventOrActionId: "development-showcase:arrival",
        finalStateRuntime: expect.objectContaining({
          reconcileFinalState: expect.any(Function),
          verifyReadableState: expect.any(Function),
          cleanup: expect.any(Function),
        }),
      }),
    );

    const receipt = await screen.findByRole("region", { name: "Latest development presentation receipt" });
    expect(within(receipt).getByText("presented")).toBeVisible();
    expect(within(receipt).getByText("development-instance-1")).toBeVisible();
    expect(within(receipt).getByText("development")).toBeVisible();
    expect(within(receipt).getByText("not allowed")).toBeVisible();
    expect(
      within(receipt).getByText("Display payloads and operation results are intentionally excluded."),
    ).toBeVisible();
    expect(screen.queryByText("PRIVATE_PAYLOAD_SENTINEL")).not.toBeInTheDocument();
  });

  it("mints a fresh compatible host per execution and releases the previous host without target leakage", async () => {
    renderShowcase();
    const playButton = screen.getByRole("button", { name: "Play selected scene" });

    fireEvent.click(playButton);
    await waitFor(() => expect(harness.director.play).toHaveBeenCalledTimes(1));
    const first = harness.director.play.mock.calls[0]?.[1] as Record<string, unknown>;
    const firstHost = first.sceneHost as { hostId: string; kind: string; snapshot: () => { connected: boolean } };

    fireEvent.click(playButton);
    await waitFor(() => expect(harness.director.play).toHaveBeenCalledTimes(2));
    const second = harness.director.play.mock.calls[1]?.[1] as Record<string, unknown>;
    const secondHost = second.sceneHost as { hostId: string; kind: string };

    expect(firstHost.kind).toBe("gateway");
    expect(secondHost.kind).toBe("gateway");
    expect(secondHost.hostId).not.toBe(firstHost.hostId);
    expect(firstHost.snapshot().connected).toBe(false);
    expect(latestRegistry?.snapshot()).toMatchObject({
      registeredHostCount: 1,
      registeredTargetCount: sceneContracts["first-arrival"].targets.length,
      externalHandleCount: 0,
      activeClaimCount: 0,
    });
  });

  it("chooses an allowed host kind and exports exact fixture capabilities for an external-target production scene", async () => {
    renderShowcase();
    fireEvent.change(screen.getByLabelText("Scene"), { target: { value: "map" } });
    fireEvent.click(screen.getByRole("button", { name: "Play selected scene" }));

    await waitFor(() => expect(harness.director.play).toHaveBeenCalledOnce());
    const options = harness.director.play.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(options.hostKind).toBe("player-progression");
    expect(options.sceneHost).toEqual(expect.objectContaining({ kind: "player-progression" }));
    expect(Object.keys(options.externalTargets as object).sort()).toEqual(["map-fog", "map-marker", "route-path"]);
    expect(latestRegistry?.snapshot()).toMatchObject({ registeredHostCount: 1, externalHandleCount: 0 });
  });

  it("retains STOP while a trailer scene is active and cancels before advancing", async () => {
    type HarnessReceipt = Awaited<ReturnType<typeof harness.director.play>>;
    let resolvePlay!: (receipt: HarnessReceipt) => void;
    harness.director.play.mockImplementationOnce(
      () => new Promise<HarnessReceipt>((resolve) => (resolvePlay = resolve)),
    );
    renderShowcase();

    fireEvent.click(screen.getByRole("button", { name: "PLAY TRAILER" }));
    expect(await screen.findByRole("button", { name: "STOP TRAILER" })).toBeVisible();
    await waitFor(() => expect(harness.director.play).toHaveBeenCalledOnce());

    fireEvent.click(screen.getByRole("button", { name: "STOP TRAILER" }));
    expect(harness.director.cancel).toHaveBeenCalledWith("development-trailer-interruption");
    resolvePlay(showcaseReceipt("first-arrival", harness.director.play.mock.calls[0]?.[1] as Record<string, unknown>));

    await waitFor(() => expect(screen.getByRole("button", { name: "PLAY TRAILER" })).toBeVisible());
    expect(harness.director.play).toHaveBeenCalledOnce();
  });

  it("preserves duplicate and hidden target diagnostics in the real provider registry", async () => {
    const registry = new SceneHostRegistry();
    const root = document.createElement("section");
    document.body.append(root);
    visibleRect(root);
    const host = registry.registerHost({ kind: "gateway", root, hostKey: "showcase-diagnostic-test" });

    const register = (
      key: string,
      part: string,
      properties: readonly (typeof sceneContracts)["first-arrival"]["targets"][number]["properties"][number][],
      hidden = false,
    ) => {
      const element = document.createElement("div");
      if (hidden) element.style.display = "none";
      root.append(element);
      visibleRect(element);
      return host.registerTarget({ targetKey: key, part, element, ownerHint: "gsap", allowedProperties: properties });
    };
    const titleA = register("title-a", "title", ["clip-path", "opacity"]);
    const titleB = register("title-b", "title", ["clip-path", "opacity"]);
    const copy = register("copy", "arrival-copy", ["transform", "opacity"]);
    const action = register("action", "arrival-action", ["transform", "opacity"], true);
    const invocation = host.beginScene({
      sceneName: "first-arrival",
      playback: "development",
      targetContract: sceneContracts["first-arrival"],
      motionPolicy: resolveMotionPolicy("full", false),
    });

    const resolution = invocation.resolveTargets();
    expect(resolution.requiredSatisfied).toBe(false);
    expect(resolution.entries.find((entry) => entry.key === "title")?.rejectionCodes).toContain("target-duplicate");
    expect(resolution.entries.find((entry) => entry.key === "arrival-action")?.rejectionCodes).toEqual(
      expect.arrayContaining(["target-hidden", "target-not-found"]),
    );

    await invocation.abort("runtime-failed");
    action.release();
    copy.release();
    titleB.release();
    titleA.release();
    host.release();
    expect(registry.snapshot()).toMatchObject({
      registeredHostCount: 0,
      registeredTargetCount: 0,
      activeInvocationCount: 0,
      externalHandleCount: 0,
      activeClaimCount: 0,
    });
    registry.destroy();
  });

  it("omits journal-open from direct trailer playback", async () => {
    renderShowcase();
    fireEvent.click(screen.getByRole("button", { name: "PLAY TRAILER" }));

    await waitFor(() => expect(harness.director.play).toHaveBeenCalledTimes(10));
    expect(harness.director.play.mock.calls.map(([scene]) => scene)).not.toContain("journal-open");
  });
});

function awaitReceipt() {
  return {
    targetReport: {
      observations: [
        { required: true, matchedCount: 2, visibleCount: 1, duplicateCount: 1 },
        { required: false, matchedCount: 2, visibleCount: 2, duplicateCount: 2 },
      ],
    },
  } as Parameters<typeof summarizeShowcaseReceipt>[0];
}

function showcaseReceipt(sceneName: string, options: Record<string, unknown>) {
  return {
    sceneName,
    sceneInstanceId: "development-instance-1",
    hostId: options.hostId,
    hostKind: options.hostKind,
    requestSource: "development",
    outcome: "presented",
    motionPolicy: {
      level: "full",
      source: { productSetting: "full", browserPrefersReduced: false },
      allowSpatialTravel: true,
      allowContinuousAmbientMotion: true,
      allowPageCurl: true,
      allowRiveStateTravel: true,
      allowLottiePlayback: true,
      allowMotionCues: true,
      durationScale: 1,
      distanceScale: 1,
      preserveSemanticStaging: true,
    },
    startedAt: 1,
    completedAt: 2,
    durationMs: 1,
    semanticLabelsReached: ["scene-start", "scene-complete"],
    targetReport: {
      sceneName,
      sceneInstanceId: "development-instance-1",
      hostId: options.hostId,
      startedAt: 1,
      completedAt: 1,
      durationMs: 0,
      requiredSatisfied: true,
      observations: [],
      failures: [],
    },
    acknowledgmentAllowed: false,
    cleanup: "completed",
    operationResult: { private: "PRIVATE_PAYLOAD_SENTINEL" },
  } as unknown as Awaited<ReturnType<typeof harness.director.play>>;
}

function visibleRect(element: Element) {
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    top: 0,
    right: 100,
    bottom: 100,
    left: 0,
    toJSON: () => ({}),
  });
}

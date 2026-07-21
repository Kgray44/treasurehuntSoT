import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AnimationSceneName,
  PlaySceneOptions,
  PresentationOutcome,
  PresentationReceipt,
  SceneTargetResolutionReceipt,
} from "@/animation/core/animation-types";
import { sceneContracts } from "@/animation/director/scene-registry";
import { AnimationAuthorityContext } from "@/animation/hosts/SceneHostContext";
import { SceneHostRegistry } from "@/animation/hosts/scene-host-registry";
import type { SceneHostHandle } from "@/animation/hosts/scene-host-types";
import { HarborLanding } from "./HarborLanding";

const mocks = vi.hoisted(() => ({
  play: vi.fn(),
  skip: vi.fn(),
  cancel: vi.fn(),
  cycle: vi.fn(),
}));

vi.mock("@gsap/react", () => ({ useGSAP: () => undefined }));
vi.mock("motion/react", () => ({
  motion: {
    article: ({
      children,
      className,
      whileHover: _whileHover,
      whileTap: _whileTap,
      ...props
    }: React.HTMLAttributes<HTMLElement> & { whileHover?: unknown; whileTap?: unknown }) => (
      <article className={className} {...props}>
        {children}
      </article>
    ),
    div: ({
      children,
      className,
      layoutId: _layoutId,
      whileHover: _whileHover,
      whileTap: _whileTap,
      ...props
    }: React.HTMLAttributes<HTMLDivElement> & { layoutId?: string; whileHover?: unknown; whileTap?: unknown }) => (
      <div className={className} {...props}>
        {children}
      </div>
    ),
  },
}));
vi.mock("@/animation/director/useAnimationDirector", () => ({
  useAnimationDirector: () => ({
    director: { play: mocks.play, skip: mocks.skip, cancel: mocks.cancel },
    snapshot: { phase: "idle", isPlaying: false, label: "", scene: null },
  }),
}));
vi.mock("@/animation/motion/useMotionMode", () => ({
  useMotionMode: () => ({ mode: "reduced", cycle: mocks.cycle }),
}));
vi.mock("@/components/animation/LottieEffect", () => ({
  LottieEffect: ({ label }: { label: string }) => <div data-testid={`lottie-${label}`} />,
}));
vi.mock("@/components/dev/AnimationTestButton", () => ({ AnimationTestButton: () => null }));

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

type ResolvedPlay = Readonly<{
  scene: AnimationSceneName;
  options: PlaySceneOptions<void>;
  host: SceneHostHandle;
  resolution: SceneTargetResolutionReceipt;
}>;

const registries: SceneHostRegistry[] = [];
const resolvedPlays: ResolvedPlay[] = [];

function gatewayStatusResponse() {
  return {
    ok: true,
    json: vi.fn().mockResolvedValue({
      player: { authenticated: false },
      captain: { authenticated: false },
      creator: { authenticated: false },
    }),
  } as unknown as Response;
}

function receipt(
  scene: AnimationSceneName,
  options: PlaySceneOptions<void>,
  outcome: PresentationOutcome = "presented",
): PresentationReceipt<void> {
  const hostId = options.sceneHost?.hostId ?? "unverified-test";
  const hostKind = options.sceneHost?.kind ?? "unverified";
  return {
    sceneName: scene,
    sceneInstanceId: `${scene}-test-instance`,
    hostId,
    hostKind,
    requestSource: options.requestSource ?? "automatic",
    outcome,
    motionPolicy,
    startedAt: 1,
    completedAt: 2,
    durationMs: 1,
    semanticLabelsReached: [],
    targetReport: {
      sceneName: scene,
      sceneInstanceId: `${scene}-test-instance`,
      hostId,
      startedAt: 1,
      completedAt: 1,
      durationMs: 0,
      requiredSatisfied: outcome === "presented",
      observations: [],
      failures: [],
    },
    acknowledgmentAllowed: outcome === "presented",
    cleanup: "completed",
  };
}

function renderWithRegistry(children: React.ReactNode) {
  const hosts = new SceneHostRegistry();
  registries.push(hosts);
  const authority = { providerId: hosts.providerId, hosts, ownership: hosts.ownership };
  const view = render(
    <AnimationAuthorityContext.Provider value={authority}>{children}</AnimationAuthorityContext.Provider>,
  );
  return { hosts, authority, view };
}

function installResolvingDirector() {
  mocks.play.mockImplementation(async (scene: AnimationSceneName, options: PlaySceneOptions<void>) => {
    const host = options.sceneHost;
    if (!host) throw new Error("Harbor presentation requires a registered SceneHost");
    const contract = sceneContracts[scene];
    if (contract.version !== 2) throw new Error("Harbor presentation requires a v2 target contract");
    const invocation = host.beginScene({
      sceneName: scene,
      playback: options.requestSource === "replay" ? "replay" : "live",
      targetContract: contract,
      motionPolicy,
      ...(options.signal ? { signal: options.signal } : {}),
    });
    const resolution = invocation.resolveTargets();
    resolvedPlays.push({ scene, options, host, resolution });
    await invocation.complete({ outcome: "completed" });
    return receipt(scene, options);
  });
}

function acceptedCounts(resolution: SceneTargetResolutionReceipt) {
  return Object.fromEntries(resolution.entries.map((entry) => [entry.key, entry.acceptedTargetIds.length]));
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(gatewayStatusResponse()));
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    right: 1200,
    bottom: 800,
    left: 0,
    width: 1200,
    height: 800,
    toJSON: () => ({}),
  } as DOMRect);
  sessionStorage.clear();
  resolvedPlays.length = 0;
  mocks.play.mockReset();
  mocks.skip.mockReset();
  mocks.cancel.mockReset();
  installResolvingDirector();
});

afterEach(() => {
  cleanup();
  for (const registry of registries.splice(0)) registry.destroy();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("HarborLanding gateway SceneHost", () => {
  it("plays automatic first arrival and replay through one authentic gateway host with exact registered targets", async () => {
    const { hosts } = renderWithRegistry(<HarborLanding />);

    await waitFor(() => expect(resolvedPlays).toHaveLength(1));
    const automatic = resolvedPlays[0];
    expect(automatic.scene).toBe("first-arrival");
    expect(automatic.options).toMatchObject({
      sceneHost: automatic.host,
      hostId: automatic.host.hostId,
      hostKind: "gateway",
      requestSource: "automatic",
      queue: false,
    });
    expect(hosts.isRegisteredHandle(automatic.host)).toBe(true);
    expect(automatic.host.hostId).not.toMatch(/^unverified-/u);
    expect(automatic.options.root).toHaveAttribute("data-scene-host-id", automatic.host.hostId);
    expect(automatic.resolution.requiredSatisfied).toBe(true);
    expect(acceptedCounts(automatic.resolution)).toEqual({
      title: 1,
      "arrival-copy": 2,
      "arrival-action": 2,
      sky: 1,
      stars: 1,
      moon: 1,
      horizon: 1,
      ocean: 1,
      "fog-back": 1,
      "fog-front": 1,
      ship: 1,
      emblem: 0,
      "nautical-border": 1,
    });
    expect(automatic.host.snapshot().registeredTargetCount).toBe(14);
    expect(automatic.options.root.querySelectorAll("[data-scene-target-id]")).toHaveLength(14);
    expect(automatic.options.root.querySelector("[data-gsap-owned]")).toBeNull();

    const replayButton = screen.getByRole("button", { name: "Replay presentation" });
    expect(replayButton).toBeEnabled();
    fireEvent.click(replayButton);

    await waitFor(() => expect(resolvedPlays).toHaveLength(2));
    const replay = resolvedPlays[1];
    expect(replay.scene).toBe("first-arrival");
    expect(replay.options).toMatchObject({
      sceneHost: automatic.host,
      hostId: automatic.host.hostId,
      hostKind: "gateway",
      requestSource: "replay",
    });
    expect(replay.resolution.requiredSatisfied).toBe(true);
    expect(replay.options.root).toBe(automatic.options.root);
    expect(mocks.play.mock.calls.every(([, options]) => !String(options.hostId).startsWith("unverified-"))).toBe(true);
  });

  it("preserves automatic session reentry while using the provider-minted host", async () => {
    sessionStorage.setItem("tall-tale-role-gateway", "seen");
    renderWithRegistry(<HarborLanding />);

    await waitFor(() => expect(resolvedPlays).toHaveLength(1));
    const reentry = resolvedPlays[0];
    expect(reentry.scene).toBe("session-reentry");
    expect(reentry.host.kind).toBe("gateway");
    expect(reentry.options.sceneHost).toBe(reentry.host);
    expect(reentry.options.hostId).toBe(reentry.host.hostId);
    expect(reentry.resolution.requiredSatisfied).toBe(true);
    expect(acceptedCounts(reentry.resolution)).toEqual({ title: 1, "arrival-action": 2, "fog-front": 1 });
  });

  it("uses deterministic unsynchronized stars and a static reduced ambient state", async () => {
    renderWithRegistry(<HarborLanding />);
    await waitFor(() => expect(resolvedPlays).toHaveLength(1));

    const stars = Array.from(document.querySelectorAll<HTMLElement>(".star-field i"));
    expect(stars).toHaveLength(28);
    expect(new Set(stars.map((star) => star.style.getPropertyValue("--star-duration"))).size).toBeGreaterThan(10);
    expect(new Set(stars.map((star) => star.style.getPropertyValue("--star-delay"))).size).toBeGreaterThan(10);
    expect(document.querySelector(".harbor-landing")).toHaveAttribute("data-ambient-state", "paused");
    expect(document.querySelector("[data-parallax-layer='ship']")).toBeInTheDocument();
    expect(
      Array.from(document.querySelectorAll<HTMLElement>("[data-role-object]")).every((object) => object.tabIndex < 0),
    ).toBe(true);
  });

  it("softens sibling roles only after a role handoff is selected", async () => {
    renderWithRegistry(<HarborLanding />);
    expect(await screen.findAllByText("Choose a role")).toHaveLength(3);
    const captainLink = screen.getByRole("link", { name: "Enter as Captain" });
    captainLink.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(captainLink);
    expect(document.querySelector(".role-captain")).toHaveAttribute("data-role-selected", "true");
    expect(document.querySelector(".role-player")).toHaveAttribute("data-role-softened", "true");
    expect(document.querySelector(".role-creator")).toHaveAttribute("data-role-softened", "true");
  });

  it("keeps identical target keys isolated when two gateway roots are mounted", async () => {
    sessionStorage.setItem("tall-tale-role-gateway", "seen");
    renderWithRegistry(
      <>
        <HarborLanding />
        <HarborLanding />
      </>,
    );

    await waitFor(() => expect(resolvedPlays).toHaveLength(2));
    const [first, second] = resolvedPlays;
    expect(first.host.hostId).not.toBe(second.host.hostId);
    expect(first.options.root).not.toBe(second.options.root);
    for (const play of resolvedPlays) {
      const otherRoot = play === first ? second.options.root : first.options.root;
      const acceptedIds = play.resolution.entries.flatMap((entry) => entry.acceptedTargetIds);
      expect(acceptedIds.length).toBeGreaterThan(0);
      for (const targetId of acceptedIds) {
        expect(play.options.root.querySelector(`[data-scene-target-id="${targetId}"]`)).not.toBeNull();
        expect(otherRoot.querySelector(`[data-scene-target-id="${targetId}"]`)).toBeNull();
      }
    }
  });

  it("aborts the active presentation and releases the host and all targets on unmount", async () => {
    let activeOptions: PlaySceneOptions<void> | undefined;
    mocks.play.mockImplementation((_scene: AnimationSceneName, options: PlaySceneOptions<void>) => {
      activeOptions = options;
      return new Promise<PresentationReceipt<void>>(() => undefined);
    });
    const { authority, hosts, view } = renderWithRegistry(<HarborLanding />);

    await waitFor(() => expect(activeOptions?.sceneHost).toBeTruthy());
    const activeHost = activeOptions!.sceneHost!;
    expect(hosts.isRegisteredHandle(activeHost)).toBe(true);
    expect(hosts.snapshot()).toMatchObject({ registeredHostCount: 1, registeredTargetCount: 14 });

    view.rerender(<AnimationAuthorityContext.Provider value={authority}>{null}</AnimationAuthorityContext.Provider>);

    expect(activeOptions!.signal?.aborted).toBe(true);
    expect(mocks.cancel).toHaveBeenCalledWith("gateway-unmounted");
    expect(hosts.isRegisteredHandle(activeHost)).toBe(false);
    expect(hosts.snapshot()).toMatchObject({
      registeredHostCount: 0,
      registeredTargetCount: 0,
      activeInvocationCount: 0,
      activeClaimCount: 0,
    });
  });
});

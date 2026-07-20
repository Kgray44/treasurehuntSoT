import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect, useMemo } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  MotionMode,
  PlaySceneOptions,
  PresentationFallbackContext,
  PresentationOutcome,
  PresentationReceipt,
} from "@/animation/core/animation-types";
import { preflightSceneTargets } from "@/animation/core/target-preflight";
import { sceneContracts } from "@/animation/director/scene-registry";
import { AnimationAuthorityContext } from "@/animation/hosts/SceneHostContext";
import { SceneHostRegistry } from "@/animation/hosts/scene-host-registry";
import { AccessGate } from "./AccessGate";

type AccessResult = { ok: true };

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  play: vi.fn(),
  skip: vi.fn(),
  mode: "reduced",
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/animation/director/useAnimationDirector", () => ({
  useAnimationDirector: () => ({
    director: { play: mocks.play, skip: mocks.skip },
    snapshot: { phase: "idle", isPlaying: false },
  }),
}));
vi.mock("@/animation/motion/useMotionMode", () => ({
  useMotionMode: () => ({ mode: mocks.mode as MotionMode, cycle: vi.fn() }),
}));
vi.mock("@/components/animation/LottieEffect", () => ({
  LottieEffect: () => <div aria-hidden="true" />,
}));
vi.mock("@/components/animation/RiveStatefulObject", () => ({
  RiveStatefulObject: () => <div aria-hidden="true" />,
}));
vi.mock("@/components/dev/AnimationTestButton", () => ({ AnimationTestButton: () => null }));

function TestAuthority({
  children,
  onRegistry,
}: {
  children: React.ReactNode;
  onRegistry?: (registry: SceneHostRegistry) => void;
}) {
  const hosts = useMemo(() => new SceneHostRegistry(), []);
  useEffect(() => {
    onRegistry?.(hosts);
    return () => hosts.destroy();
  }, [hosts, onRegistry]);
  const authority = useMemo(() => ({ providerId: hosts.providerId, hosts, ownership: hosts.ownership }), [hosts]);
  return <AnimationAuthorityContext.Provider value={authority}>{children}</AnimationAuthorityContext.Provider>;
}

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

function receipt(
  outcome: PresentationOutcome,
  overrides: Partial<PresentationReceipt<AccessResult>> = {},
): PresentationReceipt<AccessResult> {
  return {
    sceneName: "player-access",
    sceneInstanceId: "player-access-test-instance",
    hostId: "legacy-player-access",
    hostKind: "access",
    requestSource: "operation",
    outcome,
    motionPolicy,
    startedAt: 1,
    completedAt: 2,
    durationMs: 1,
    semanticLabelsReached: [],
    targetReport: {
      sceneName: "player-access",
      sceneInstanceId: "player-access-test-instance",
      hostId: "legacy-player-access",
      startedAt: 1,
      completedAt: 1,
      durationMs: 0,
      requiredSatisfied: outcome !== "missing-required-target",
      observations: [],
      failures: [],
    },
    acknowledgmentAllowed: outcome === "presented" || outcome === "presented-fallback",
    cleanup: "completed",
    ...overrides,
  };
}

function response(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

function cinematicRect(x: number, y: number, width: number, height: number): DOMRect {
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

function installCinematicGeometry(host: HTMLElement) {
  vi.spyOn(host, "getBoundingClientRect").mockReturnValue(cinematicRect(0, 0, 1000, 800));
  const boxes: Record<string, DOMRect> = {
    invitation: cinematicRect(175, 100, 650, 520),
    "invitation-ink": cinematicRect(234, 339, 532, 218),
    seal: cinematicRect(444, 96, 112, 112),
    ribbon: cinematicRect(130, 162, 740, 44),
    "seal-crack": cinematicRect(460, 120, 80, 70),
    lantern: cinematicRect(766, 0, 94, 190),
  };
  for (const target of host.querySelectorAll<Element>("[data-access-cinematic-part]")) {
    const part = target.getAttribute("data-access-cinematic-part");
    if (part && boxes[part]) vi.spyOn(target, "getBoundingClientRect").mockReturnValue(boxes[part]);
  }
}

function renderAccess(
  onRouteHandoff?: (signal: AbortSignal) => void | Promise<void>,
  onRegistry?: (registry: SceneHostRegistry) => void,
) {
  return render(
    <TestAuthority onRegistry={onRegistry}>
      <AccessGate campaignSlug="test-voyage" onRouteHandoff={onRouteHandoff} />
    </TestAuthority>,
  );
}

function submitAccess(onRouteHandoff?: (signal: AbortSignal) => void | Promise<void>) {
  const view = renderAccess(onRouteHandoff);
  fireEvent.change(screen.getByLabelText("Invitation phrase"), { target: { value: "moonlit-secret" } });
  fireEvent.click(screen.getByRole("button", { name: "Confirm invitation" }));
  return view;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("AccessGate typed presentation receipts", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    vi.restoreAllMocks();
    mocks.play.mockReset();
    mocks.mode = "reduced";
  });

  it("registers deliberate full-mode target boxes that satisfy the real v1 preflight", async () => {
    mocks.mode = "full";
    let registry: SceneHostRegistry | undefined;
    renderAccess(undefined, (value) => {
      registry = value;
    });
    await waitFor(() => expect(registry).toBeDefined());
    const host = document.querySelector<HTMLElement>('[data-scene-host-boundary="access"]')!;
    installCinematicGeometry(host);

    expect(host).toHaveStyle({ position: "absolute", inset: "0", display: "grid" });
    expect(host.querySelector('[data-access-cinematic-part="invitation"]')).toHaveStyle({
      display: "block",
      minHeight: "520px",
    });
    expect(host.querySelector('[data-access-cinematic-part="invitation-ink"]')).toHaveStyle({
      position: "absolute",
      display: "block",
    });
    expect(host.querySelector('[data-access-cinematic-part="seal"]')).toHaveStyle({
      width: "112px",
      height: "112px",
    });
    expect(registry?.snapshot()).toMatchObject({ registeredHostCount: 1, registeredTargetCount: 6 });

    const preflight = preflightSceneTargets({
      root: host,
      contract: sceneContracts["player-access"],
      sceneInstanceId: "access-full-preflight",
      hostId: host.dataset.sceneHostId!,
      viewportRect: { x: 0, y: 0, width: 1000, height: 800 },
    });
    expect(preflight.report.requiredSatisfied).toBe(true);
    expect(preflight.report.failures).toEqual([]);
    expect(
      preflight.report.observations
        .filter((observation) => observation.required)
        .map((observation) => [observation.part, observation.visibleCount]),
    ).toEqual([
      ["invitation", 1],
      ["invitation-ink", 1],
      ["seal", 1],
    ]);
    expect(preflight.release()).toMatchObject({ alreadyReleased: false });
    expect(screen.getByRole("main")).toHaveAttribute("data-motion-mode", "full");
  });

  it("holds the committed full-mode seal pose without snapback until route handoff", async () => {
    mocks.mode = "full";
    const route = deferred<void>();
    const handoff = vi.fn(() => route.promise);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(200, { ok: true })));
    let committedSeal!: HTMLElement;
    mocks.play.mockImplementation(async (_scene: string, options: PlaySceneOptions<AccessResult>) => {
      const operationResult = await options.operation!();
      committedSeal = options.root.querySelector<HTMLElement>('[data-access-cinematic-part="seal"]')!;
      committedSeal.style.transform = "translate(-50%, -50%) translateY(44px) rotate(22deg) scale(1.12)";
      committedSeal.style.filter = "drop-shadow(0 0 24px #dcae63)";
      committedSeal.style.opacity = "0";
      await options.finalStateRuntime?.holdSafePose?.("access-result-readable");
      expect(await options.finalStateRuntime?.verifyReadableState?.("access-result-readable")).toBe(true);
      return receipt("presented", { operationResult, finalSemanticState: "access-result-readable" });
    });
    renderAccess(handoff);
    const host = document.querySelector<HTMLElement>('[data-scene-host-boundary="access"]')!;
    installCinematicGeometry(host);
    fireEvent.change(screen.getByLabelText("Invitation phrase"), { target: { value: "moonlit-secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm invitation" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Invitation accepted. Opening your Voyage Journal.");
    expect(handoff).toHaveBeenCalledOnce();
    const committedStyle = committedSeal.getAttribute("style");
    expect(committedSeal).toHaveStyle({ opacity: "0", filter: "drop-shadow(0 0 24px #dcae63)" });
    expect(committedSeal.style.transform).toContain("translateY(44px)");
    await Promise.resolve();
    expect(committedSeal.getAttribute("style")).toBe(committedStyle);
    expect(screen.getByRole("main")).toHaveAttribute("data-access-state", "accepted");

    route.resolve();
    await route.promise;
    expect(committedSeal.getAttribute("style")).toBe(committedStyle);
  });

  it("waits for a presented receipt with an operation result before refreshing the authenticated route", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(200, { ok: true })));
    let finishPresentation: (() => void) | undefined;
    const presentation = new Promise<void>((resolve) => {
      finishPresentation = resolve;
    });
    mocks.play.mockImplementation(async (_scene: string, options: PlaySceneOptions<AccessResult>) => {
      const operationResult = await options.operation!();
      await presentation;
      return receipt("presented", { operationResult, finalSemanticState: "access-result-readable" });
    });

    submitAccess();

    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    expect(mocks.refresh).not.toHaveBeenCalled();
    const [, options] = mocks.play.mock.calls[0] as [string, PlaySceneOptions<AccessResult>];
    expect(options).toMatchObject({
      hostId: expect.stringMatching(/^access-/u),
      hostKind: "access",
      sceneHost: expect.objectContaining({ kind: "access" }),
      requestSource: "operation",
      queue: false,
    });
    expect(options.signal).toBeInstanceOf(AbortSignal);
    finishPresentation?.();
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
    expect(await screen.findByRole("status")).toHaveTextContent("Invitation accepted. Opening your Voyage Journal.");
  });

  it("shows the authoritative operation failure and never refreshes as success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(response(401, { error: "That invitation could not be recognized." })),
    );
    mocks.play.mockImplementation(async (_scene: string, options: PlaySceneOptions<AccessResult>) => {
      await options.operation!().catch(() => undefined);
      return receipt("runtime-failed");
    });

    submitAccess();

    expect(await screen.findByRole("alert")).toHaveTextContent("That invitation could not be recognized.");
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Confirm invitation" })).toBeEnabled();
    await waitFor(() => expect(screen.getByLabelText("Invitation phrase")).toHaveFocus());
  });

  it("renders a readable target failure and does not run authentication or refresh", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    mocks.play.mockResolvedValue(receipt("missing-required-target"));

    submitAccess();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The invitation could not be confirmed safely. Your access has not changed. Try again.",
    );
    expect(fetch).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("does not trust a presented-fallback receipt unless this consumer verified the readable callback", async () => {
    vi.stubGlobal("fetch", vi.fn());
    mocks.play.mockResolvedValue(
      receipt("presented-fallback", {
        fallbackUsed: "readable-access-result",
        finalSemanticState: "access-result-readable",
      }),
    );

    submitAccess();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The invitation could not be confirmed safely. Your access has not changed. Try again.",
    );
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("allows an approved reduced static fallback only after authentication and readable verification", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(200, { ok: true })));
    mocks.play.mockImplementation(async (_scene: string, options: PlaySceneOptions<AccessResult>) => {
      const context: PresentationFallbackContext = {
        sceneName: "player-access",
        sceneInstanceId: "player-access-test-instance",
        hostId: options.hostId!,
        hostKind: "access",
        fallback: "readable-access-result",
        trigger: "missing-required-target",
        motionPolicy,
        signal: options.signal,
      };
      const fallback = await options.presentationFallback!(context);
      return fallback.completed && fallback.readable
        ? receipt("presented-fallback", {
            fallbackUsed: "readable-access-result",
            finalSemanticState: fallback.semanticState,
          })
        : receipt("missing-required-target");
    });

    submitAccess();

    expect(await screen.findByRole("status")).toHaveTextContent("Invitation accepted. Opening your Voyage Journal.");
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
    expect(fetch).toHaveBeenCalledOnce();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("data-motion-mode", "reduced");
    expect(document.querySelector('[data-access-cinematic-part="seal"]')).toHaveStyle({
      width: "112px",
      height: "112px",
    });
  });

  it("preserves an authoritative rejection returned while attempting the readable fallback", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(response(401, { error: "That invitation could not be recognized." })),
    );
    mocks.play.mockImplementation(async (_scene: string, options: PlaySceneOptions<AccessResult>) => {
      const fallback = await options.presentationFallback!({
        sceneName: "player-access",
        sceneInstanceId: "player-access-test-instance",
        hostId: options.hostId!,
        hostKind: "access",
        fallback: "readable-access-result",
        trigger: "missing-required-target",
        motionPolicy,
        signal: options.signal,
      });
      expect(fallback.completed).toBe(false);
      return receipt("missing-required-target");
    });

    submitAccess();

    expect(await screen.findByRole("alert")).toHaveTextContent("That invitation could not be recognized.");
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("aborts the Director and authoritative request boundary on unmount without a false refresh", async () => {
    let signal: AbortSignal | undefined;
    mocks.play.mockImplementation(
      async (_scene: string, options: PlaySceneOptions<AccessResult>) =>
        new Promise<PresentationReceipt<AccessResult>>((resolve) => {
          signal = options.signal;
          options.signal?.addEventListener(
            "abort",
            () => resolve(receipt("aborted", { interruptionReason: "abort-signal" })),
            { once: true },
          );
        }),
    );

    const view = submitAccess();
    await waitFor(() => expect(mocks.play).toHaveBeenCalledOnce());
    view.unmount();

    expect(signal?.aborted).toBe(true);
    await Promise.resolve();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("holds accepted state through a delayed route and ignores repeated submission", async () => {
    const fetch = vi.fn().mockResolvedValue(response(200, { ok: true }));
    vi.stubGlobal("fetch", fetch);
    mocks.play.mockImplementation(async (_scene: string, options: PlaySceneOptions<AccessResult>) => {
      const operationResult = await options.operation!();
      return receipt("presented", { operationResult, finalSemanticState: "access-result-readable" });
    });
    const route = deferred<void>();
    const handoff = vi.fn(() => route.promise);
    submitAccess(handoff);

    expect(await screen.findByRole("status")).toHaveTextContent("Invitation accepted");
    expect(screen.getByRole("main")).toHaveAttribute("data-access-state", "accepted");
    const form = screen.getByRole("button", { name: "Confirming invitation…" }).closest("form")!;
    fireEvent.submit(form);

    expect(fetch).toHaveBeenCalledOnce();
    expect(mocks.play).toHaveBeenCalledOnce();
    expect(handoff).toHaveBeenCalledOnce();
    route.resolve();
    await route.promise;
    expect(screen.getByRole("main")).toHaveAttribute("data-access-state", "accepted");
  });

  it("restores the invitation form after route handoff fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(200, { ok: true })));
    mocks.play.mockImplementation(async (_scene: string, options: PlaySceneOptions<AccessResult>) => {
      const operationResult = await options.operation!();
      return receipt("presented", { operationResult, finalSemanticState: "access-result-readable" });
    });
    submitAccess(() => Promise.reject(new Error("route failed")));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invitation accepted, but the Voyage Journal could not be opened",
    );
    expect(screen.getByRole("main")).toHaveAttribute("data-access-state", "rejected");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm invitation" })).toBeEnabled();
    await waitFor(() => expect(screen.getByLabelText("Invitation phrase")).toHaveFocus());
  });

  it("keeps the semantic invitation and controls outside its registered cinematic host", () => {
    vi.stubGlobal("fetch", vi.fn());
    submitAccess();

    const host = document.querySelector<HTMLElement>('[data-scene-host-boundary="access"]');
    expect(host).toHaveAttribute("aria-hidden", "true");
    expect(host).toHaveStyle({ pointerEvents: "none" });
    expect(host?.querySelectorAll("[data-scene-target-id]")).toHaveLength(6);
    expect(host?.querySelectorAll("[data-scene-part]")).toHaveLength(6);
    expect(host?.querySelectorAll('[data-runtime-boundary="gsap"]')).toHaveLength(6);
    expect(host?.querySelector("[data-gsap-owned]")).toBeNull();
    expect(host?.querySelector("input, button, form, section, [role]")).toBeNull();
    expect(screen.getByLabelText("Invitation phrase").closest("[data-scene-host-boundary]")).toBeNull();
    expect(screen.getByLabelText("Invitation phrase").closest("form")).not.toHaveAttribute("data-scene-part");
    expect(screen.getByRole("main")).toHaveAttribute("data-motion-mode", "reduced");
  });
});

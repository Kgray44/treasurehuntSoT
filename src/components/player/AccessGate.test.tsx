import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  PlaySceneOptions,
  PresentationFallbackContext,
  PresentationOutcome,
  PresentationReceipt,
} from "@/animation/core/animation-types";
import { AccessGate } from "./AccessGate";

type AccessResult = { ok: true };

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  play: vi.fn(),
  skip: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/animation/director/useAnimationDirector", () => ({
  useAnimationDirector: () => ({
    director: { play: mocks.play, skip: mocks.skip },
    snapshot: { phase: "idle", isPlaying: false },
  }),
}));
vi.mock("@/animation/motion/useMotionMode", () => ({
  useMotionMode: () => ({ mode: "reduced", cycle: vi.fn() }),
}));
vi.mock("@/components/animation/LottieEffect", () => ({
  LottieEffect: () => <div aria-hidden="true" />,
}));
vi.mock("@/components/animation/RiveStatefulObject", () => ({
  RiveStatefulObject: () => <div aria-hidden="true" />,
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

function submitAccess() {
  const view = render(<AccessGate campaignSlug="test-voyage" />);
  fireEvent.change(screen.getByLabelText("Invitation phrase"), { target: { value: "moonlit-secret" } });
  fireEvent.click(screen.getByRole("button", { name: "Open the journal" }));
  return view;
}

describe("AccessGate typed presentation receipts", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    mocks.play.mockReset();
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
      hostId: "legacy-player-access",
      hostKind: "access",
      requestSource: "operation",
      queue: false,
    });
    expect(options.signal).toBeInstanceOf(AbortSignal);
    finishPresentation?.();
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
    expect(await screen.findByRole("status")).toHaveTextContent("Invitation accepted. Opening the journal.");
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
    expect(screen.getByRole("button", { name: "Open the journal" })).toBeEnabled();
    await waitFor(() => expect(screen.getByLabelText("Invitation phrase")).toHaveFocus());
  });

  it("renders a readable target failure and does not run authentication or refresh", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    mocks.play.mockResolvedValue(receipt("missing-required-target"));

    submitAccess();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The invitation could not be opened safely. Please try again.",
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
      "The invitation could not be opened safely. Please try again.",
    );
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("allows an approved static fallback only after it authenticates and verifies a readable status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(200, { ok: true })));
    mocks.play.mockImplementation(async (_scene: string, options: PlaySceneOptions<AccessResult>) => {
      const context: PresentationFallbackContext = {
        sceneName: "player-access",
        sceneInstanceId: "player-access-test-instance",
        hostId: "legacy-player-access",
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

    expect(await screen.findByRole("status")).toHaveTextContent("Invitation accepted. Opening the journal.");
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
    expect(fetch).toHaveBeenCalledOnce();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
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
        hostId: "legacy-player-access",
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
});

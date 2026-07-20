import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useEffect, useMemo } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PresentationOutcome, SceneBuildContext } from "@/animation/core/animation-types";
import { preflightSceneTargets } from "@/animation/core/target-preflight";
import { sceneContracts } from "@/animation/director/scene-registry";
import { AnimationAuthorityContext } from "@/animation/hosts/SceneHostContext";
import { SceneHostRegistry } from "@/animation/hosts/scene-host-registry";
import type { ExternalSceneTargetHandle, SceneHostHandle } from "@/animation/hosts/scene-host-types";
import { quartermasterLoginScene } from "@/animation/scenes/access.scene";
import { Quartermaster } from "./Quartermaster";

type MockPlayOptions = {
  hostId?: string;
  hostKind?: string;
  requestSource?: string;
  eventOrActionId?: string;
  signal?: AbortSignal;
  sceneHost?: SceneHostHandle;
  externalTargets?: Readonly<Record<string, ExternalSceneTargetHandle>>;
  operation?: () => Promise<unknown>;
  presentationFallback?: (context: {
    hostId: string;
    hostKind: string;
    fallback: string;
    signal?: AbortSignal;
  }) => Promise<{ completed: boolean; readable: boolean; semanticState?: string }>;
};

function TestAuthority({ children }: { children: React.ReactNode }) {
  const hosts = useMemo(() => new SceneHostRegistry(), []);
  useEffect(() => () => hosts.destroy(), [hosts]);
  const authority = useMemo(() => ({ providerId: hosts.providerId, hosts, ownership: hosts.ownership }), [hosts]);
  return <AnimationAuthorityContext.Provider value={authority}>{children}</AnimationAuthorityContext.Provider>;
}

function renderQuartermaster(authenticated: boolean) {
  return render(
    <TestAuthority>
      <Quartermaster authenticated={authenticated} />
    </TestAuthority>,
  );
}

const animation = vi.hoisted(() => ({
  play: vi.fn(),
  skip: vi.fn(),
  cycle: vi.fn(),
}));

vi.mock("@/animation/director/useAnimationDirector", () => ({
  useAnimationDirector: () => ({
    director: { play: animation.play, skip: animation.skip },
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

vi.mock("@/animation/motion/useMotionMode", () => ({
  useMotionMode: () => ({ mode: "reduced", cycle: animation.cycle }),
}));

vi.mock("@/components/animation/LottieEffect", () => ({ LottieEffect: () => <div aria-hidden="true" /> }));
vi.mock("@/components/animation/RiveStatefulObject", () => ({
  RiveStatefulObject: () => <div aria-hidden="true" />,
}));
vi.mock("@/components/dev/AnimationTestButton", () => ({ AnimationTestButton: () => null }));

const baseStatus = {
  csrfToken: "csrf-test-token",
  campaign: { slug: "test-voyage", title: "Test Voyage", status: "DRAFT", sequence: 0 },
  chapter: { ordinal: 1, state: "SEALED", title: "The First Wake" },
  playerConnected: false,
  events: [],
  inventory: [],
  sideQuest: null,
  preview: { chapter: {} },
};

function statusAt(sequence: number) {
  return {
    ...baseStatus,
    campaign: { ...baseStatus.campaign, sequence },
  };
}

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: vi.fn().mockResolvedValue(body) } as unknown as Response;
}

function commandResult(
  id: string,
  sequence: number,
  publication: "PROCESS_PUBLISHED" | "PROCESS_PUBLICATION_FAILED" = "PROCESS_PUBLISHED",
) {
  return {
    kind: "PROGRESSION_EVENT",
    event: { id, type: "CHAPTER_PREPARED", sequence },
    playerEvent: { id, type: "CHAPTER_PREPARED", sequence },
    correlationId: `correlation-${id}`,
    persistence: "COMMITTED",
    publication,
    delivery: publication === "PROCESS_PUBLISHED" ? "PUBLISHED" : "PUBLICATION_FAILED",
    deliveryScope: "PROCESS_SUBSCRIBERS_ONLY",
    playerDelivery: "UNCONFIRMED",
    playerPresentation: "UNCONFIRMED",
    playerAcknowledgment: "UNCONFIRMED",
  };
}

function stagedCommandResult(id: string, sequence: number) {
  return {
    kind: "STAGED_ACTION",
    event: null,
    playerEvent: null,
    preparedActionId: id,
    stagedAction: {
      preparedActionId: id,
      command: "PREPARE_HINT",
      targetKey: "hint-1",
      reservedSequence: sequence,
      status: "PREPARED",
      preparedAt: "2026-07-18T12:00:00.000Z",
    },
    correlationId: `correlation-${id}`,
    persistence: "COMMITTED",
    publication: "NOT_APPLICABLE",
    delivery: "NOT_ATTEMPTED",
    deliveryScope: "NO_PLAYER_EVENT",
    playerDelivery: "UNCONFIRMED",
    playerPresentation: "UNCONFIRMED",
    playerAcknowledgment: "UNCONFIRMED",
  };
}

function presentationReceipt(outcome: PresentationOutcome, operationResult?: unknown) {
  return {
    outcome,
    ...(operationResult === undefined ? {} : { operationResult }),
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function geometry(x: number, y: number, width: number, height: number) {
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

async function renderReady(fetchMock: ReturnType<typeof vi.fn>) {
  vi.stubGlobal("fetch", fetchMock);
  const rendered = renderQuartermaster(true);
  expect(await screen.findByRole("heading", { name: "Test Voyage" })).toBeInTheDocument();
  return rendered;
}

function confirmPrepareChapter() {
  fireEvent.click(screen.getByRole("button", { name: "Prepare Chapter" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm Voyage action" }));
}

describe("Quartermaster command presentation receipts", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("preflights a boxed login host with every required cinematic target inside its geometry", () => {
    renderQuartermaster(false);
    const host = document.querySelector<HTMLElement>('[data-scene-host-boundary="access"]');
    expect(host).not.toBeNull();
    if (!host) return;

    host.style.display = "block";
    host.style.visibility = "visible";
    host.style.opacity = "1";
    vi.spyOn(host, "getBoundingClientRect").mockReturnValue(geometry(0, 0, 1_280, 720));
    const targetGeometry: Readonly<Record<string, DOMRect>> = {
      lock: geometry(300, 290, 66, 66),
      "door-bolt": geometry(360, 340, 220, 18),
      "cabin-door": geometry(64, 36, 538, 648),
      "login-ledger": geometry(672, 86, 544, 548),
      "chart-room-light": geometry(0, 0, 1_280, 720),
      lantern: geometry(1_060, 120, 80, 160),
    };
    for (const [part, rect] of Object.entries(targetGeometry)) {
      const target = host.querySelector<HTMLElement>(`[data-scene-part="${part}"]`);
      expect(target, part).not.toBeNull();
      if (!target) continue;
      target.style.display = "block";
      target.style.visibility = "visible";
      target.style.opacity = "1";
      vi.spyOn(target, "getBoundingClientRect").mockReturnValue(rect);
    }

    const contract = sceneContracts["quartermaster-login"];
    expect(contract.version).toBe(1);
    if (contract.version !== 1) return;
    const preflight = preflightSceneTargets({
      root: host,
      contract,
      sceneInstanceId: "quartermaster-login:test:live:01",
      hostId: host.dataset.sceneHostId ?? "quartermaster-login-test-host",
      viewportRect: geometry(0, 0, 1_280, 720),
    });

    expect(preflight.report.requiredSatisfied).toBe(true);
    expect(preflight.report.failures).toEqual([]);
    expect(
      preflight.report.observations
        .filter((observation) => contract.requiredTargets.some((target) => target.part === observation.part))
        .map((observation) => ({ part: observation.part, visibleCount: observation.visibleCount })),
    ).toEqual([
      { part: "lock", visibleCount: 1 },
      { part: "door-bolt", visibleCount: 1 },
      { part: "cabin-door", visibleCount: 1 },
      { part: "login-ledger", visibleCount: 1 },
    ]);
    expect(preflight.release()).toMatchObject({ claimedCount: 6, releasedCount: 6, alreadyReleased: false });
  });

  it("leaves the registered cabin door in the successful open pose", () => {
    renderQuartermaster(false);
    const host = document.querySelector<HTMLElement>('[data-scene-host-boundary="access"]');
    const door = host?.querySelector<HTMLElement>('[data-scene-part="cabin-door"]');
    expect(host).not.toBeNull();
    expect(door).not.toBeNull();
    if (!host || !door) return;

    const timeline = quartermasterLoginScene.buildSuccess({
      root: host,
      mode: "full",
      sceneName: "quartermaster-login",
      display: {},
      emitLabel: () => undefined,
      addCleanup: () => undefined,
    } satisfies SceneBuildContext);
    timeline.progress(1);

    expect(door.style.transform).toContain("rotateY(-68deg)");
    timeline.kill();
  });

  it("uses the same explicit host identity and typed operation result for Quartermaster sign-in", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) =>
      Promise.resolve(String(input) === "/api/gm/login" ? jsonResponse({ ok: true }) : jsonResponse(statusAt(0))),
    );
    animation.play.mockImplementation(async (_scene: string, options: MockPlayOptions) => {
      const operationResult = await options.operation?.();
      return presentationReceipt("presented", operationResult);
    });
    vi.stubGlobal("fetch", fetchMock);
    renderQuartermaster(false);
    const loginHost = document.querySelector<HTMLElement>('[data-scene-host-boundary="access"]');
    expect(loginHost?.querySelectorAll("[data-scene-part]")).toHaveLength(6);
    expect(loginHost?.querySelectorAll('[data-runtime-boundary="gsap"]')).toHaveLength(6);
    expect(loginHost?.querySelector("[data-gsap-owned]")).toBeNull();
    expect(screen.getByLabelText("Captain name").closest("[data-scene-host-boundary]")).toBeNull();
    fireEvent.change(screen.getByLabelText("Captain name"), { target: { value: "captain" } });
    fireEvent.change(screen.getByLabelText("Passphrase"), { target: { value: "safe-development-passphrase" } });

    fireEvent.click(screen.getByRole("button", { name: "Enter the chart room" }));

    expect(await screen.findByRole("heading", { name: "Test Voyage" })).toBeInTheDocument();
    expect(animation.play.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        hostId: expect.stringMatching(/^access-/u),
        hostKind: "access",
        sceneHost: expect.objectContaining({ kind: "access" }),
        requestSource: "operation",
        eventOrActionId: "quartermaster-login",
        signal: expect.any(AbortSignal),
      }),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("holds a successful login busy and single-flight until the chart-room handoff completes", async () => {
    const statusResponse = deferred<Response>();
    const fetchMock = vi.fn((input: RequestInfo | URL) =>
      String(input) === "/api/gm/login" ? Promise.resolve(jsonResponse({ ok: true })) : statusResponse.promise,
    );
    animation.play.mockImplementation(async (_scene: string, options: MockPlayOptions) => {
      const operationResult = await options.operation?.();
      return presentationReceipt("presented", operationResult);
    });
    vi.stubGlobal("fetch", fetchMock);
    renderQuartermaster(false);
    fireEvent.change(screen.getByLabelText("Captain name"), { target: { value: "captain" } });
    fireEvent.change(screen.getByLabelText("Passphrase"), { target: { value: "safe-development-passphrase" } });

    fireEvent.click(screen.getByRole("button", { name: "Enter the chart room" }));

    const form = screen.getByLabelText("Captain name").closest("form")!;
    expect(await screen.findByRole("status")).toHaveTextContent("Sign-in accepted. Opening Captain's Console.");
    expect(form).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: /Turning the key/u })).toBeDisabled();
    fireEvent.submit(form);
    expect(fetchMock.mock.calls.filter(([input]) => String(input) === "/api/gm/login")).toHaveLength(1);
    expect(animation.play).toHaveBeenCalledOnce();

    statusResponse.resolve(jsonResponse(statusAt(0)));
    expect(await screen.findByRole("heading", { name: "Test Voyage" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Captain name")).not.toBeInTheDocument();
  });

  it("restores a readable, focusable login after an authoritative rejection", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: "The captain's key was refused." }, false));
    animation.play.mockImplementation(async (_scene: string, options: MockPlayOptions) => {
      await options.operation?.().catch(() => undefined);
      return presentationReceipt("runtime-failed");
    });
    vi.stubGlobal("fetch", fetchMock);
    renderQuartermaster(false);
    const username = screen.getByLabelText("Captain name");
    fireEvent.change(username, { target: { value: "captain" } });
    fireEvent.change(screen.getByLabelText("Passphrase"), { target: { value: "wrong-development-passphrase" } });

    fireEvent.click(screen.getByRole("button", { name: "Enter the chart room" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("The captain's key was refused.");
    expect(username.closest("form")).toHaveAttribute("aria-busy", "false");
    expect(screen.getByRole("button", { name: "Enter the chart room" })).toBeEnabled();
    await waitFor(() => expect(username).toHaveFocus());
  });

  it("restores login focus when presentation fails before authentication starts", async () => {
    const fetchMock = vi.fn();
    animation.play.mockResolvedValue(presentationReceipt("missing-required-target"));
    vi.stubGlobal("fetch", fetchMock);
    renderQuartermaster(false);
    const username = screen.getByLabelText("Captain name");
    fireEvent.change(username, { target: { value: "captain" } });
    fireEvent.change(screen.getByLabelText("Passphrase"), { target: { value: "safe-development-passphrase" } });

    fireEvent.click(screen.getByRole("button", { name: "Enter the chart room" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Sign-in was not attempted because its presentation could not start.",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "The entrance presentation is unavailable. Sign-in was not recorded.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
    await waitFor(() => expect(username).toHaveFocus());
  });

  it("restores login focus when authenticated handoff cannot open the chart room", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) =>
      Promise.resolve(
        String(input) === "/api/gm/login" ? jsonResponse({ ok: true }) : jsonResponse({ error: "offline" }, false),
      ),
    );
    animation.play.mockImplementation(async (_scene: string, options: MockPlayOptions) => {
      const operationResult = await options.operation?.();
      return presentationReceipt("presented", operationResult);
    });
    vi.stubGlobal("fetch", fetchMock);
    renderQuartermaster(false);
    const username = screen.getByLabelText("Captain name");
    fireEvent.change(username, { target: { value: "captain" } });
    fireEvent.change(screen.getByLabelText("Passphrase"), { target: { value: "safe-development-passphrase" } });

    fireEvent.click(screen.getByRole("button", { name: "Enter the chart room" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Sign-in succeeded, but Captain's Console could not be opened. Please try again.",
    );
    expect(screen.getByRole("button", { name: "Enter the chart room" })).toBeEnabled();
    await waitFor(() => expect(username).toHaveFocus());
  });

  it("traps confirmation focus, hides and inerts the background, and restores focus on Escape", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(statusAt(0)));
    await renderReady(fetchMock);
    const pendingFrames: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      pendingFrames.push(callback);
      return pendingFrames.length;
    });
    const trigger = screen.getByRole("button", { name: "Prepare Chapter" });
    trigger.focus();

    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "Prepare Chapter" });
    const main = document.querySelector<HTMLElement>("main.quartermaster-shell")!;
    const cancel = screen.getByRole("button", { name: "Cancel" });
    const confirm = screen.getByRole("button", { name: "Confirm Voyage action" });
    await waitFor(() => expect(confirm).toHaveFocus());
    expect(main).toHaveAttribute("inert");
    expect(main).toHaveAttribute("aria-hidden", "true");
    expect(dialog.closest('[aria-hidden="true"], [inert]')).toBeNull();
    expect(within(dialog).getByText("Chapter 1: The First Wake")).toBeInTheDocument();
    expect(within(dialog).getByText("SEALED")).toBeInTheDocument();
    expect(dialog).toHaveAttribute("data-runtime-handoff", "motion");

    fireEvent.keyDown(confirm, { key: "Tab" });
    expect(cancel).toHaveFocus();
    fireEvent.keyDown(cancel, { key: "Tab", shiftKey: true });
    expect(confirm).toHaveFocus();
    trigger.focus();
    expect(confirm).toHaveFocus();

    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).not.toHaveFocus();
    expect(pendingFrames).toHaveLength(1);
    expect(main).not.toHaveAttribute("inert");
    expect(main).not.toHaveAttribute("aria-hidden");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    pendingFrames[0](performance.now());
    expect(trigger).toHaveFocus();
  });

  it("returns focus after Cancel removes the dialog", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(statusAt(0)));
    await renderReady(fetchMock);
    const trigger = screen.getByRole("button", { name: "Pause Voyage" });
    fireEvent.click(trigger);
    expect(await screen.findByRole("dialog", { name: "Pause Voyage" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("uses the dialog itself as the busy focus and Tab fallback", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(statusAt(0)));
    animation.play.mockImplementation(
      (_scene: string, options: MockPlayOptions) =>
        new Promise((resolve) => {
          options.signal?.addEventListener("abort", () => resolve(presentationReceipt("aborted")), { once: true });
        }),
    );
    const view = await renderReady(fetchMock);
    const trigger = screen.getByRole("button", { name: "Prepare Chapter" });
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Prepare Chapter" });
    expect(dialog).toHaveAttribute("tabindex", "-1");

    fireEvent.click(screen.getByRole("button", { name: "Confirm Voyage action" }));

    await waitFor(() => expect(animation.play).toHaveBeenCalledOnce());
    const cancel = screen.getByRole("button", { name: "Cancel" });
    const recording = screen.getByRole("button", { name: /Recording/u });
    expect(cancel).toBeDisabled();
    expect(recording).toBeDisabled();
    trigger.focus();
    expect(dialog).toHaveFocus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(dialog).toHaveFocus();

    view.unmount();
  });

  it("cleans dialog listeners across repeated opens and restores each exact trigger", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(statusAt(0)));
    await renderReady(fetchMock);
    const addListener = vi.spyOn(document, "addEventListener");
    const removeListener = vi.spyOn(document, "removeEventListener");
    const prepare = screen.getByRole("button", { name: "Prepare Chapter" });
    fireEvent.click(prepare);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(prepare).toHaveFocus());

    const pause = screen.getByRole("button", { name: "Pause Voyage" });
    fireEvent.click(pause);
    fireEvent.keyDown(screen.getByRole("dialog", { name: "Pause Voyage" }), { key: "Escape" });
    await waitFor(() => expect(pause).toHaveFocus());

    expect(addListener.mock.calls.filter(([type]) => type === "keydown")).toHaveLength(2);
    expect(addListener.mock.calls.filter(([type]) => type === "focusin")).toHaveLength(2);
    expect(removeListener.mock.calls.filter(([type]) => type === "keydown")).toHaveLength(2);
    expect(removeListener.mock.calls.filter(([type]) => type === "focusin")).toHaveLength(2);
  });

  it("does not restore focus to a trigger that disconnected while the dialog was open", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(statusAt(0)));
    await renderReady(fetchMock);
    const trigger = screen.getByRole("button", { name: "Prepare Chapter" });
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog", { name: "Prepare Chapter" })).toBeInTheDocument();
    const requestFrame = vi.spyOn(window, "requestAnimationFrame");
    trigger.remove();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(requestFrame).not.toHaveBeenCalled();
    expect(trigger).not.toHaveFocus();
  });

  it("commits an authoritative operation result, then releases the final presentation after status refresh", async () => {
    const refreshedStatus = deferred<Response>();
    let statusRequests = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      if (String(input) === "/api/gm/status") {
        statusRequests += 1;
        return statusRequests === 1 ? Promise.resolve(jsonResponse(statusAt(0))) : refreshedStatus.promise;
      }
      return Promise.resolve(jsonResponse(commandResult("event-1", 1)));
    });
    animation.play.mockImplementation(async (_scene: string, options: MockPlayOptions) => {
      const operationResult = await options.operation?.();
      return presentationReceipt("presented", operationResult);
    });
    await renderReady(fetchMock);

    const commandButton = screen.getByRole("button", { name: "Prepare Chapter" });
    confirmPrepareChapter();

    await waitFor(() => expect(animation.play).toHaveBeenCalledOnce());
    expect(screen.getByLabelText("Prepare Chapter presentation: idle")).toBeInTheDocument();
    expect(screen.queryByText(/Voyage event saved at sequence 1/)).not.toBeInTheDocument();
    expect(animation.play.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        hostId: expect.stringMatching(/^quartermaster-command-/u),
        hostKind: "quartermaster-command",
        sceneHost: expect.objectContaining({ kind: "quartermaster-command" }),
        requestSource: "operation",
        eventOrActionId: "PREPARE_CHAPTER",
        signal: expect.any(AbortSignal),
      }),
    );

    refreshedStatus.resolve(jsonResponse(statusAt(1)));

    expect(await screen.findByText("Voyage event saved at sequence 1.")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByLabelText("Prepare Chapter presentation: idle")).not.toBeInTheDocument());
    expect(screen.getByText("Voyage sequence 1")).toBeVisible();
    expect(screen.getByText(/Crew delivery, presentation, and acknowledgment remain unconfirmed/u)).toBeVisible();
    expect(screen.getByText(/Reference correlation-event-1/u)).toBeVisible();
    expect(screen.queryByText(/presentation could not be displayed/i)).not.toBeInTheDocument();
    await waitFor(() => expect(commandButton).toHaveFocus());
  });

  it("reuses the exact confirmation idempotency key when a lost response is retried", async () => {
    let statusRequests = 0;
    const commandBodies: Array<Record<string, unknown>> = [];
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/gm/status") {
        statusRequests += 1;
        return Promise.resolve(jsonResponse(statusAt(statusRequests - 1)));
      }
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      commandBodies.push(body);
      return Promise.resolve(
        commandBodies.length === 1
          ? jsonResponse({ error: "The response was lost after submission." }, false)
          : jsonResponse({ ...commandResult("event-replayed", 1), idempotentReplay: true }),
      );
    });
    animation.play.mockImplementation(async (_scene: string, options: MockPlayOptions) => {
      try {
        const operationResult = await options.operation?.();
        return presentationReceipt("presented", operationResult);
      } catch {
        return presentationReceipt("runtime-failed");
      }
    });
    await renderReady(fetchMock);

    confirmPrepareChapter();
    expect(await screen.findByRole("alert")).toHaveTextContent("The response was lost after submission.");
    fireEvent.click(screen.getByRole("button", { name: "Confirm Voyage action" }));

    expect(await screen.findByText("Voyage event saved at sequence 1.")).toBeInTheDocument();
    expect(commandBodies).toHaveLength(2);
    expect(commandBodies[0]).toMatchObject({ command: "PREPARE_CHAPTER", expectedSequence: 0 });
    expect(commandBodies[0].idempotencyKey).toBe(commandBodies[1].idempotencyKey);
  });

  it("keeps a stale-sequence conflict uncommitted and reviewable in the confirmation dialog", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) =>
      Promise.resolve(
        String(input) === "/api/gm/status"
          ? jsonResponse(statusAt(8))
          : jsonResponse(
              { error: "State changed from sequence 8 to 9. Refresh before confirming.", code: "STALE_SEQUENCE" },
              false,
            ),
      ),
    );
    animation.play.mockImplementation(async (_scene: string, options: MockPlayOptions) => {
      await options.operation?.().catch(() => undefined);
      return presentationReceipt("runtime-failed");
    });
    await renderReady(fetchMock);

    confirmPrepareChapter();

    expect(await screen.findByRole("alert")).toHaveTextContent("State changed from sequence 8 to 9");
    expect(screen.getByRole("dialog", { name: "Prepare Chapter" })).toBeInTheDocument();
    expect(screen.queryByText(/Crew delivery, presentation, and acknowledgment/u)).not.toBeInTheDocument();
    expect(screen.queryByText(/Voyage event saved/u)).not.toBeInTheDocument();
  });

  it("shows a committed post-commit publication failure without inventing Crew delivery or acknowledgment", async () => {
    let statusRequests = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      if (String(input) === "/api/gm/status") {
        statusRequests += 1;
        return Promise.resolve(jsonResponse(statusAt(statusRequests - 1)));
      }
      return Promise.resolve(jsonResponse(commandResult("event-committed", 1, "PROCESS_PUBLICATION_FAILED")));
    });
    animation.play.mockImplementation(async (_scene: string, options: MockPlayOptions) => {
      const operationResult = await options.operation?.();
      return presentationReceipt("presented", operationResult);
    });
    await renderReady(fetchMock);

    confirmPrepareChapter();

    expect(await screen.findByText("Voyage event saved at sequence 1.")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText(/saved, but this server could not confirm live delivery/u)).toBeVisible(),
    );
    expect(screen.getByText(/Crew delivery, presentation, and acknowledgment remain unconfirmed/u)).toBeVisible();
  });

  it("describes non-publishing staging receipts without claiming process or Crew delivery", async () => {
    let statusRequests = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      if (String(input) === "/api/gm/status") {
        statusRequests += 1;
        return Promise.resolve(jsonResponse(statusAt(statusRequests - 1)));
      }
      return Promise.resolve(jsonResponse(stagedCommandResult("prepared-stage", 1)));
    });
    animation.play.mockImplementation(async (_scene: string, options: MockPlayOptions) => {
      const operationResult = await options.operation?.();
      return presentationReceipt("presented", operationResult);
    });
    await renderReady(fetchMock);

    confirmPrepareChapter();

    expect(await screen.findByText("Prepared action saved at sequence 1.")).toBeInTheDocument();
    expect(screen.queryByText(/Prepared action prepared-stage recorded/u)).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/does not send a Crew event/u)).toBeVisible());
    expect(screen.getByText(/Crew delivery, presentation, and acknowledgment remain unconfirmed/u)).toBeVisible();
  });

  it("submits a production artifact award through an isolated command host and explicit external slot", async () => {
    let capturedOptions: MockPlayOptions | undefined;
    let statusRequests = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/gm/status") {
        statusRequests += 1;
        return Promise.resolve(jsonResponse(statusAt(statusRequests - 1)));
      }
      expect(String(input)).toBe("/api/gm/commands");
      expect(JSON.parse(String(init?.body))).toMatchObject({
        command: "AWARD_ARTIFACT",
        expectedSequence: 0,
        idempotencyKey: expect.any(String),
        confirmation: true,
      });
      return Promise.resolve(jsonResponse(commandResult("artifact-event", 1)));
    });
    animation.play.mockImplementation(async (scene: string, options: MockPlayOptions) => {
      expect(scene).toBe("artifact-award");
      capturedOptions = options;
      const artifactSlot = document.querySelector<HTMLElement>('[data-command-cinematic-part="artifact-slot-target"]');
      expect(artifactSlot).toHaveAttribute("data-runtime-boundary", "motion");
      expect(artifactSlot).toHaveAttribute("data-runtime-lease", "ready");
      expect(artifactSlot).toHaveAttribute("data-animation-owner", "motion");
      expect(artifactSlot).not.toHaveAttribute("data-scene-part");
      const operationResult = await options.operation?.();
      return presentationReceipt("presented", operationResult);
    });
    await renderReady(fetchMock);

    fireEvent.click(screen.getByRole("button", { name: "Award test Artifact" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm Voyage action" }));

    await waitFor(() => expect(animation.play).toHaveBeenCalledOnce());
    expect(await screen.findByText("Voyage event saved at sequence 1.")).toBeInTheDocument();
    expect(capturedOptions).toEqual(
      expect.objectContaining({
        hostId: expect.stringMatching(/^quartermaster-command-/u),
        hostKind: "quartermaster-command",
        sceneHost: expect.objectContaining({ kind: "quartermaster-command" }),
        externalTargets: expect.objectContaining({
          "artifact-slot": expect.objectContaining({
            sourceHostId: expect.stringMatching(/^quartermaster-command-/u),
          }),
        }),
        requestSource: "operation",
        eventOrActionId: "AWARD_ARTIFACT",
      }),
    );
    expect(fetchMock.mock.calls.filter(([input]) => String(input) === "/api/gm/commands")).toHaveLength(1);
  });

  it("keeps an authoritative server failure distinct and ignores projected receipt fields", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) =>
      Promise.resolve(
        String(input) === "/api/gm/status"
          ? jsonResponse(statusAt(0))
          : jsonResponse({ error: "The chapter is not ready." }, false),
      ),
    );
    animation.play.mockImplementation(async (_scene: string, options: MockPlayOptions) => {
      try {
        await options.operation?.();
      } catch {
        return {
          ...presentationReceipt("runtime-failed"),
          event: { id: "projected-false-success", sequence: 99 },
        };
      }
      throw new Error("The operation should have failed in this fixture.");
    });
    await renderReady(fetchMock);

    confirmPrepareChapter();

    expect(await screen.findByRole("alert")).toHaveTextContent("The chapter is not ready.");
    expect(screen.queryByText(/projected-false-success/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Voyage action was saved/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/presentation could not be displayed/i)).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reports presentation failure without rewriting a successful command result", async () => {
    let statusRequests = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      if (String(input) === "/api/gm/status") {
        statusRequests += 1;
        return Promise.resolve(jsonResponse(statusAt(statusRequests - 1)));
      }
      return Promise.resolve(jsonResponse(commandResult("event-real", 1)));
    });
    animation.play.mockImplementation(async (_scene: string, options: MockPlayOptions) => {
      const operationResult = await options.operation?.();
      return {
        ...presentationReceipt("missing-required-target", operationResult),
        event: { id: "projected-wrong", sequence: 44 },
      };
    });
    await renderReady(fetchMock);

    confirmPrepareChapter();

    expect(await screen.findByText("Voyage event saved at sequence 1.")).toBeInTheDocument();
    expect(screen.getByText(/Voyage action was saved, but its presentation could not be displayed/i)).toBeVisible();
    expect(screen.queryByText(/projected-wrong/)).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("Voyage sequence 1")).toBeVisible();
  });

  it("runs a command once through a verified readable fallback when its animation targets are missing", async () => {
    let statusRequests = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      if (String(input) === "/api/gm/status") {
        statusRequests += 1;
        return Promise.resolve(jsonResponse(statusAt(statusRequests - 1)));
      }
      return Promise.resolve(jsonResponse(commandResult("event-fallback", 1)));
    });
    animation.play.mockImplementation(async (_scene: string, options: MockPlayOptions) => {
      const fallback = await options.presentationFallback?.({
        hostId: options.hostId!,
        hostKind: options.hostKind!,
        fallback: "readable-command-result",
        signal: options.signal,
      });
      expect(fallback).toEqual(
        expect.objectContaining({
          completed: true,
          readable: true,
          semanticState: "chapter-prepared-readable",
        }),
      );
      return presentationReceipt("presented-fallback");
    });
    await renderReady(fetchMock);

    confirmPrepareChapter();

    expect(await screen.findByText("Voyage event saved at sequence 1.")).toBeInTheDocument();
    expect(screen.getByText(/Voyage action was saved, but its presentation could not be displayed/i)).toBeVisible();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not invent command success when presentation fails before the operation starts", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      if (String(input) === "/api/gm/status") return Promise.resolve(jsonResponse(statusAt(0)));
      return Promise.resolve(jsonResponse(commandResult("should-not-run", 1)));
    });
    animation.play.mockResolvedValue({
      ...presentationReceipt("missing-required-target"),
      event: { id: "projected-false-success", sequence: 99 },
    });
    await renderReady(fetchMock);

    confirmPrepareChapter();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The Voyage action was not sent because its presentation could not start.",
    );
    expect(screen.getByText("The Voyage action presentation is unavailable. No action was recorded.")).toBeVisible();
    expect(screen.queryByText(/projected-false-success/)).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("aborts an in-flight presentation when the Quartermaster unmounts", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(statusAt(0)));
    let signal: AbortSignal | undefined;
    animation.play.mockImplementation(
      (_scene: string, options: MockPlayOptions) =>
        new Promise((resolve) => {
          signal = options.signal;
          options.signal?.addEventListener("abort", () => resolve(presentationReceipt("aborted")), { once: true });
        }),
    );
    const { unmount } = await renderReady(fetchMock);

    confirmPrepareChapter();
    await waitFor(() => expect(signal).toBeDefined());
    unmount();

    expect(signal?.aborted).toBe(true);
  });

  it("mints isolated command hosts with action-local targets and no semantic controls", async () => {
    let commandSequence = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/gm/status") {
        return Promise.resolve(jsonResponse(statusAt(commandSequence)));
      }
      commandSequence += 1;
      const action = JSON.parse(String(init?.body)).command as string;
      return Promise.resolve(jsonResponse(commandResult(`event-${action.toLowerCase()}`, commandSequence)));
    });
    const hostIds: string[] = [];
    const targetParts: string[][] = [];
    const legacyPartSets: string[][] = [];
    animation.play.mockImplementation(async (_scene: string, options: MockPlayOptions) => {
      hostIds.push(options.hostId!);
      const host = document.querySelector<HTMLElement>(`[data-scene-host-id="${options.hostId}"]`);
      expect(host).toHaveAttribute("aria-hidden", "true");
      expect(host).toHaveStyle({ pointerEvents: "none" });
      expect(host?.querySelector("button, input, form, dialog, [role]")).toBeNull();
      targetParts.push(
        [...(host?.querySelectorAll<HTMLElement>("[data-command-cinematic-part]") ?? [])].map(
          (target) => target.dataset.commandCinematicPart!,
        ),
      );
      legacyPartSets.push(
        [...(host?.querySelectorAll<HTMLElement>("[data-scene-part]") ?? [])].map(
          (target) => target.dataset.scenePart!,
        ),
      );
      expect(host?.querySelector("[data-gsap-owned]")).toBeNull();
      expect(host?.querySelectorAll('[data-runtime-boundary="gsap"]')).not.toHaveLength(0);
      const operationResult = await options.operation?.();
      return presentationReceipt("presented", operationResult);
    });
    await renderReady(fetchMock);

    confirmPrepareChapter();
    expect(await screen.findByText("Voyage event saved at sequence 1.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Pause Voyage" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm Voyage action" }));
    expect(await screen.findByText("Voyage event saved at sequence 2.")).toBeInTheDocument();

    expect(hostIds).toHaveLength(2);
    expect(new Set(hostIds).size).toBe(2);
    expect(hostIds.every((id) => id.startsWith("quartermaster-command-"))).toBe(true);
    expect(targetParts[0]).toEqual(expect.arrayContaining(["blank-page", "command-light"]));
    expect(targetParts[0]).not.toContain("artifact-reveal");
    expect(targetParts[1]).toEqual(expect.arrayContaining(["lantern", "command-light"]));
    expect(legacyPartSets[0]).toEqual(expect.arrayContaining(["blank-page", "command-light"]));
    expect(legacyPartSets[1]).toEqual([]);
    expect(screen.getByRole("button", { name: "Pause Voyage" }).closest("[data-scene-host-boundary]")).toBeNull();
  });
});

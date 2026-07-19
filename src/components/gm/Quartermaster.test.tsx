import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PresentationOutcome } from "@/animation/core/animation-types";
import { Quartermaster } from "./Quartermaster";

type MockPlayOptions = {
  hostId?: string;
  hostKind?: string;
  requestSource?: string;
  eventOrActionId?: string;
  signal?: AbortSignal;
  operation?: () => Promise<unknown>;
  presentationFallback?: (context: {
    hostId: string;
    hostKind: string;
    fallback: string;
    signal?: AbortSignal;
  }) => Promise<{ completed: boolean; readable: boolean; semanticState?: string }>;
};

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

async function renderReady(fetchMock: ReturnType<typeof vi.fn>) {
  vi.stubGlobal("fetch", fetchMock);
  const rendered = render(<Quartermaster authenticated />);
  expect(await screen.findByRole("heading", { name: "Test Voyage" })).toBeInTheDocument();
  return rendered;
}

function confirmPrepareChapter() {
  fireEvent.click(screen.getByRole("button", { name: "Prepare Chapter" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm action" }));
}

describe("Quartermaster command presentation receipts", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
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
    render(<Quartermaster authenticated={false} />);
    fireEvent.change(screen.getByLabelText("Captain's name"), { target: { value: "captain" } });
    fireEvent.change(screen.getByLabelText("Passphrase"), { target: { value: "safe-development-passphrase" } });

    fireEvent.click(screen.getByRole("button", { name: "Enter the chart room" }));

    expect(await screen.findByRole("heading", { name: "Test Voyage" })).toBeInTheDocument();
    expect(animation.play.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        hostId: "quartermaster",
        hostKind: "quartermaster",
        requestSource: "operation",
        eventOrActionId: "quartermaster-login",
        signal: expect.any(AbortSignal),
      }),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("commits an authoritative operation result, then releases the final presentation after status refresh", async () => {
    const refreshedStatus = deferred<Response>();
    let statusRequests = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      if (String(input) === "/api/gm/status") {
        statusRequests += 1;
        return statusRequests === 1 ? Promise.resolve(jsonResponse(statusAt(0))) : refreshedStatus.promise;
      }
      return Promise.resolve(jsonResponse({ event: { id: "event-1", sequence: 1 } }));
    });
    animation.play.mockImplementation(async (_scene: string, options: MockPlayOptions) => {
      const operationResult = await options.operation?.();
      return presentationReceipt("presented", operationResult);
    });
    await renderReady(fetchMock);

    confirmPrepareChapter();

    await waitFor(() => expect(animation.play).toHaveBeenCalledOnce());
    expect(screen.getByLabelText("Prepare Chapter ceremony: idle")).toBeInTheDocument();
    expect(screen.queryByText(/Event event-1 recorded/)).not.toBeInTheDocument();
    expect(animation.play.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        hostId: "quartermaster-command",
        hostKind: "quartermaster-command",
        requestSource: "operation",
        eventOrActionId: "PREPARE_CHAPTER",
        signal: expect.any(AbortSignal),
      }),
    );

    refreshedStatus.resolve(jsonResponse(statusAt(1)));

    expect(await screen.findByText("Event event-1 recorded at sequence 1.")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByLabelText("Prepare Chapter ceremony: idle")).not.toBeInTheDocument());
    expect(screen.getByText("Sequence 1")).toBeVisible();
    expect(screen.queryByText(/presentation could not be displayed/i)).not.toBeInTheDocument();
  });

  it("submits a production artifact award through the progression command host", async () => {
    let statusRequests = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/gm/status") {
        statusRequests += 1;
        return Promise.resolve(jsonResponse(statusAt(statusRequests - 1)));
      }
      expect(String(input)).toBe("/api/gm/action");
      expect(JSON.parse(String(init?.body))).toMatchObject({ action: "AWARD_ARTIFACT", confirmation: true });
      return Promise.resolve(jsonResponse({ event: { id: "artifact-event", sequence: 1 } }));
    });
    animation.play.mockImplementation(async (scene: string, options: MockPlayOptions) => {
      expect(scene).toBe("artifact-award");
      expect(options).toEqual(
        expect.objectContaining({
          hostId: "quartermaster-progression",
          hostKind: "progression",
          requestSource: "operation",
          eventOrActionId: "AWARD_ARTIFACT",
        }),
      );
      const operationResult = await options.operation?.();
      return presentationReceipt("presented", operationResult);
    });
    await renderReady(fetchMock);

    fireEvent.click(screen.getByRole("button", { name: "Award Test Artifact" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm action" }));

    expect(await screen.findByText("Event artifact-event recorded at sequence 1.")).toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([input]) => String(input) === "/api/gm/action")).toHaveLength(1);
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
    expect(screen.queryByText(/order was recorded/i)).not.toBeInTheDocument();
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
      return Promise.resolve(jsonResponse({ event: { id: "event-real", sequence: 1 } }));
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

    expect(await screen.findByText("Event event-real recorded at sequence 1.")).toBeInTheDocument();
    expect(screen.getByText(/order was recorded, but its presentation could not be displayed/i)).toBeVisible();
    expect(screen.queryByText(/projected-wrong/)).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("Sequence 1")).toBeVisible();
  });

  it("runs a command once through a verified readable fallback when its animation targets are missing", async () => {
    let statusRequests = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      if (String(input) === "/api/gm/status") {
        statusRequests += 1;
        return Promise.resolve(jsonResponse(statusAt(statusRequests - 1)));
      }
      return Promise.resolve(jsonResponse({ event: { id: "event-fallback", sequence: 1 } }));
    });
    animation.play.mockImplementation(async (_scene: string, options: MockPlayOptions) => {
      const fallback = await options.presentationFallback?.({
        hostId: "quartermaster-command",
        hostKind: "quartermaster-command",
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

    expect(await screen.findByText("Event event-fallback recorded at sequence 1.")).toBeInTheDocument();
    expect(screen.getByText(/order was recorded, but its presentation could not be displayed/i)).toBeVisible();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not invent command success when presentation fails before the operation starts", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      if (String(input) === "/api/gm/status") return Promise.resolve(jsonResponse(statusAt(0)));
      return Promise.resolve(jsonResponse({ event: { id: "should-not-run", sequence: 1 } }));
    });
    animation.play.mockResolvedValue({
      ...presentationReceipt("missing-required-target"),
      event: { id: "projected-false-success", sequence: 99 },
    });
    await renderReady(fetchMock);

    confirmPrepareChapter();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The order was not sent because its presentation could not start.",
    );
    expect(screen.getByText("The command presentation is unavailable. No order was recorded.")).toBeVisible();
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
});

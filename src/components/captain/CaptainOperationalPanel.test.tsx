import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CaptainOperationalPanel } from "./CaptainOperationalPanel";

const projection = {
  voyage: {
    chronicle: "Helm Chronicle",
    voyageName: "Single-flight operational Voyage",
    edition: "v1",
    lifecycle: "READY",
    captainAuthorityState: "ASSIGNED",
    concurrencyVersion: 0,
    operationalStatus: "READY",
    aggregatePresence: "CONNECTED",
    crewPresenceSummary: {
      total: 1,
      connected: 1,
      recentlyLost: 0,
      stale: 0,
      unknown: 0,
      synchronized: 1,
      catchingUp: 0,
    },
    sourceUpdatedAt: "2026-08-27T00:00:00.000Z",
    computedAt: "2026-08-27T00:00:00.000Z",
  },
  csrfToken: "csrf",
  attention: [],
  crew: [],
  progress: {
    currentChapter: null,
    currentCheckpoint: null,
    currentSequence: 0,
    pendingCaptain: false,
    pendingPlayer: false,
    providerWaiting: false,
    blockedRequirementCount: 0,
    updatedAt: "2026-08-27T00:00:00.000Z",
  },
  events: [],
};

function response(body: unknown) {
  return { ok: true, json: vi.fn().mockResolvedValue(body) } as unknown as Response;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("CaptainOperationalPanel refresh", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("does not queue overlapping 5-second refreshes while the current read is pending", async () => {
    const first = deferred<Response>();
    let pollTick: (() => void) | undefined;
    const nativeSetInterval = window.setInterval.bind(window);
    vi.spyOn(window, "setInterval").mockImplementation(((
      handler: TimerHandler,
      timeout?: number,
      ...args: unknown[]
    ) => {
      if (timeout === 5000) {
        pollTick = handler as () => void;
        return 1;
      }
      return nativeSetInterval(handler, timeout, ...args);
    }) as typeof window.setInterval);
    const fetchMock = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValueOnce(response(projection));
    vi.stubGlobal("fetch", fetchMock);

    render(<CaptainOperationalPanel voyageId="voyage-1" authenticated />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    pollTick?.();
    pollTick?.();
    pollTick?.();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    first.resolve(response(projection));
    expect(await screen.findByRole("heading", { name: "Single-flight operational Voyage" })).toBeInTheDocument();

    pollTick?.();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });
});

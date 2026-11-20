import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CaptainSessionControl } from "./CaptainSessionControl";

const sessionState = {
  session: {
    id: "session-1",
    status: "READY",
    previewMode: false,
    versionId: "version-1",
    ownerLabel: "Captain Kato",
    currentSequence: 0,
    updatedAt: "2026-08-27T00:00:00.000Z",
  },
  tale: { title: "Single-flight Voyage" },
  chapter: null,
  block: null,
  pendingVerification: null,
  inventory: [],
  variables: {},
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

describe("CaptainSessionControl refresh", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("does not queue overlapping 2-second refreshes while the current read is pending", async () => {
    const detail = deferred<Response>();
    const list = deferred<Response>();
    let pollTick: (() => void) | undefined;
    const nativeSetInterval = window.setInterval.bind(window);
    vi.spyOn(window, "setInterval").mockImplementation(((
      handler: TimerHandler,
      timeout?: number,
      ...args: unknown[]
    ) => {
      if (timeout === 2000) {
        pollTick = handler as () => void;
        return 1;
      }
      return nativeSetInterval(handler, timeout, ...args);
    }) as typeof window.setInterval);
    const fetchMock = vi
      .fn()
      .mockReturnValueOnce(detail.promise)
      .mockReturnValueOnce(list.promise)
      .mockResolvedValueOnce(response(sessionState))
      .mockResolvedValueOnce(response({ csrfToken: "csrf" }));
    vi.stubGlobal("fetch", fetchMock);

    render(<CaptainSessionControl sessionId="session-1" authenticated />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    pollTick?.();
    pollTick?.();
    pollTick?.();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    detail.resolve(response(sessionState));
    list.resolve(response({ csrfToken: "csrf" }));
    expect(await screen.findByRole("heading", { name: "Single-flight Voyage" })).toBeInTheDocument();

    pollTick?.();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
  });
});

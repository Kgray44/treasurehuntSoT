import { afterEach, describe, expect, it, vi } from "vitest";
import { postIdempotentAuthorityCommand } from "./authority-command.client";

describe("postIdempotentAuthorityCommand", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("repeats one lost response with the exact same idempotency command", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(
        (_url: string, init: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
          }),
      )
      .mockResolvedValueOnce({ ok: true, status: 200 } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const result = postIdempotentAuthorityCommand({
      url: "/api/player/playthroughs/voyage-1/continue-solo",
      csrfToken: "csrf-token",
      body: { expectedVersion: 7, idempotencyKey: "same-key" },
      responseTimeoutMs: 25,
    });
    await vi.advanceTimersByTimeAsync(25);

    await expect(result).resolves.toMatchObject({ status: 200 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]![0]).toBe(fetchMock.mock.calls[0]![0]);
    expect(fetchMock.mock.calls[1]![1]).toMatchObject({ body: fetchMock.mock.calls[0]![1]?.body });
  });

  it("does not retry an authoritative non-success response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 409 } as Response);
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      postIdempotentAuthorityCommand({
        url: "/api/player/playthroughs/voyage-1/captain/takeover",
        csrfToken: "csrf-token",
        body: { expectedVersion: 7, idempotencyKey: "same-key" },
      }),
    ).resolves.toMatchObject({ status: 409 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

// @sounding-line-registration owner=project-crossdeck suite=unit.crossdeck contracts=crossdeck.phase2.continuity
import { describe, it, expect, vi, afterEach } from "vitest";
import { createHttpSyncTransport, SyncTransportError } from "./transport";
import { commandSchema } from "./sync-contracts";
afterEach(() => vi.useRealTimers());
describe("transport convergence and authority loss", () => {
  it("uses no-store requests and authenticated POST with typed immutable message identity", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ revision: 2 }) });
    const transport = createHttpSyncTransport("voyage", "surface", "csrf", fetcher);
    const input = commandSchema.parse({
      messageId: crypto.randomUUID(),
      surfaceId: crypto.randomUUID(),
      voyageId: "voyage",
      sequence: 1,
      payloadSchemaVersion: 1,
      payload: { action: "focus", family: "MAP", targetId: crypto.randomUUID() },
    });
    await transport.send(input);
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining("surface=surface"),
      expect.objectContaining({
        cache: "no-store",
        headers: expect.objectContaining({ "x-csrf-token": "csrf" }),
        body: JSON.stringify(input),
      }),
    );
  });
  it("does not overlap reads, ignores regressing snapshots, stops after revocation and aborts on cleanup", async () => {
    vi.useFakeTimers();
    const responses = [2, 1, 3];
    const fetcher = vi
      .fn()
      .mockImplementation(async () =>
        responses.length
          ? { ok: true, json: async () => ({ revision: responses.shift() }) }
          : { ok: false, status: 403, json: async () => ({ error: "revoked" }) },
      );
    const next = vi.fn(),
      failed = vi.fn();
    const stop = createHttpSyncTransport("voyage", "surface", "csrf", fetcher, 500).subscribe(next, failed);
    await vi.advanceTimersByTimeAsync(2000);
    expect(next.mock.calls.map(([snapshot]) => snapshot.revision)).toEqual([2, 3]);
    expect(failed).toHaveBeenCalledWith(expect.any(SyncTransportError));
    const count = fetcher.mock.calls.length;
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetcher).toHaveBeenCalledTimes(count);
    stop();
    expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
  });
});

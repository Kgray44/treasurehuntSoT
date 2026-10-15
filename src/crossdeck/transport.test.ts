// @sounding-line-registration owner=project-crossdeck suite=unit.crossdeck contracts=crossdeck.phase2.continuity
import { describe, it, expect, vi, afterEach } from "vitest";
import { createHttpSyncTransport, SyncTransportError, RECONCILIATION_MS } from "./transport";
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

class Channel extends EventTarget {
  close = vi.fn();
  change(revision: number, surfaceScope = "11111111-1111-4111-8111-111111111111") {
    this.dispatchEvent(
      new MessageEvent("crossdeck-change", {
        data: JSON.stringify({
          kind: "CROSSDECK_PRESENTATION_CHANGED",
          protocolVersion: 1,
          surfaceScope,
          revision,
          eventId: crypto.randomUUID(),
        }),
      }),
    );
  }
}
describe("event invalidation and lifecycle recovery", () => {
  const surface = "11111111-1111-4111-8111-111111111111";
  function fixture() {
    vi.useFakeTimers();
    let serverRevision = 1;
    let visibility: DocumentVisibilityState = "visible";
    const lifecycle = Object.assign(new EventTarget(), {
      get visibilityState() {
        return visibility;
      },
    });
    Object.defineProperty(lifecycle, "visibilityState", { get: () => visibility });
    const online = new EventTarget();
    const channels: Channel[] = [];
    const fetcher = vi
      .fn()
      .mockImplementation(async () => ({ ok: true, json: async () => ({ revision: serverRevision }) }));
    const next = vi.fn(),
      failed = vi.fn();
    const events = vi.fn(() => {
      const channel = new Channel();
      channels.push(channel);
      return channel;
    });
    const stop = createHttpSyncTransport("voyage", surface, "csrf", fetcher, RECONCILIATION_MS, {
      events,
      document: lifecycle as Document,
      window: online as Window,
      random: () => 0.5,
    }).subscribe(next, failed);
    return {
      channels,
      events,
      fetcher,
      next,
      failed,
      stop,
      online,
      lifecycle,
      setRevision: (revision: number) => (serverRevision = revision),
      setVisibility: (value: DocumentVisibilityState) => {
        visibility = value;
        lifecycle.dispatchEvent(new Event("visibilitychange"));
      },
    };
  }
  it("fetches initially, ignores duplicate/stale/wrong-scope events, coalesces rapid revision gaps and polls every ten seconds", async () => {
    const f = fixture();
    await vi.advanceTimersByTimeAsync(0);
    expect(f.fetcher).toHaveBeenCalledTimes(1);
    f.channels[0].change(1);
    f.channels[0].change(0);
    f.channels[0].change(20, crypto.randomUUID());
    await vi.advanceTimersByTimeAsync(9999);
    expect(f.fetcher).toHaveBeenCalledTimes(1);
    f.setRevision(8);
    f.channels[0].change(4);
    f.channels[0].change(6);
    f.channels[0].change(8);
    await vi.advanceTimersByTimeAsync(0);
    expect(f.next.mock.calls.at(-1)![0].revision).toBe(8);
    expect(f.fetcher).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(10000);
    expect(f.fetcher).toHaveBeenCalledTimes(3);
    f.stop();
    expect(f.channels[0].close).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(30000);
    expect(f.fetcher).toHaveBeenCalledTimes(3);
  });
  it("recovers a dropped event by durable reconciliation without executing a command", async () => {
    const f = fixture();
    await vi.advanceTimersByTimeAsync(0);
    f.setRevision(5);
    await vi.advanceTimersByTimeAsync(10000);
    expect(f.next.mock.calls.at(-1)![0].revision).toBe(5);
    expect(f.fetcher.mock.calls.every(([, init]) => !init.method)).toBe(true);
    f.stop();
  });
  it("closes hidden/page-exit channels, suppresses stale callbacks and immediately reconciles foreground, pageshow and network recovery", async () => {
    const f = fixture();
    await vi.advanceTimersByTimeAsync(0);
    f.setVisibility("hidden");
    f.channels[0].change(9);
    await vi.advanceTimersByTimeAsync(30000);
    expect(f.fetcher).toHaveBeenCalledTimes(1);
    expect(f.channels[0].close).toHaveBeenCalledOnce();
    f.setRevision(9);
    f.setVisibility("visible");
    await vi.advanceTimersByTimeAsync(0);
    expect(f.next.mock.calls.at(-1)![0].revision).toBe(9);
    expect(f.channels).toHaveLength(2);
    f.online.dispatchEvent(new Event("pagehide"));
    await vi.advanceTimersByTimeAsync(20000);
    expect(f.fetcher).toHaveBeenCalledTimes(2);
    f.online.dispatchEvent(new Event("pageshow"));
    await vi.advanceTimersByTimeAsync(0);
    expect(f.fetcher).toHaveBeenCalledTimes(3);
    f.online.dispatchEvent(new Event("offline"));
    f.setRevision(12);
    f.online.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(0);
    expect(f.next.mock.calls.at(-1)![0].revision).toBe(12);
    f.stop();
    f.online.dispatchEvent(new Event("online"));
    expect(f.channels).toHaveLength(4);
  });
  it("retries event establishment with bounded exponential backoff, retains HTTP fallback and stops on revoked authority", async () => {
    const f = fixture();
    await vi.advanceTimersByTimeAsync(0);
    f.channels[0].dispatchEvent(new Event("error"));
    await vi.advanceTimersByTimeAsync(499);
    expect(f.channels).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(f.channels).toHaveLength(2);
    f.channels[1].dispatchEvent(new Event("error"));
    await vi.advanceTimersByTimeAsync(999);
    expect(f.channels).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(f.channels).toHaveLength(3);
    f.fetcher.mockResolvedValue({ ok: false, status: 403, json: async () => ({ error: "revoked" }) });
    f.channels[2].dispatchEvent(new Event("open"));
    await vi.advanceTimersByTimeAsync(0);
    expect(f.failed).toHaveBeenCalledWith(expect.any(SyncTransportError));
    const requests = f.fetcher.mock.calls.length;
    await vi.advanceTimersByTimeAsync(60000);
    expect(f.fetcher).toHaveBeenCalledTimes(requests);
    expect(f.channels[2].close).toHaveBeenCalledOnce();
    f.stop();
  });
  it("rebinds a role-ended stream only while the current HTTP authority remains valid", async () => {
    const f = fixture();
    await vi.advanceTimersByTimeAsync(0);
    f.setRevision(4);
    f.channels[0].dispatchEvent(new MessageEvent("crossdeck-ended", { data: "{}" }));
    expect(f.channels[0].close).toHaveBeenCalledOnce();
    expect(f.failed).toHaveBeenCalledWith(expect.any(Error));
    await vi.advanceTimersByTimeAsync(0);
    expect(f.next.mock.calls.at(-1)![0].revision).toBe(4);
    expect(f.channels).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(9999);
    expect(f.fetcher).toHaveBeenCalledTimes(2);
    f.stop();
  });
  it("rejects unknown envelopes and clears presentation immediately on an explicit authority-ended event", async () => {
    const f = fixture();
    await vi.advanceTimersByTimeAsync(0);
    f.channels[0].dispatchEvent(
      new MessageEvent("crossdeck-change", { data: JSON.stringify({ revision: 20, privateText: "untrusted" }) }),
    );
    expect(f.fetcher).toHaveBeenCalledTimes(1);
    f.fetcher.mockResolvedValue({ ok: false, status: 403, json: async () => ({ error: "revoked" }) });
    f.channels[0].dispatchEvent(new MessageEvent("crossdeck-ended", { data: "{}" }));
    expect(f.failed).toHaveBeenCalledWith(expect.any(Error));
    await vi.advanceTimersByTimeAsync(0);
    expect(f.failed).toHaveBeenCalledWith(expect.any(SyncTransportError));
    await vi.advanceTimersByTimeAsync(30000);
    expect(f.fetcher).toHaveBeenCalledTimes(2);
    f.stop();
  });
});

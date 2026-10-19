// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useReachRuntimePolicy } from "./runtime-policy-client";
import { defaultReachRuntimePolicyEnvelope } from "./runtime-policy";

let visible: DocumentVisibilityState;
const envelope = (revision = 1, policy = {}) => ({
  ...defaultReachRuntimePolicyEnvelope,
  revision,
  policy: { ...defaultReachRuntimePolicyEnvelope.policy, ...policy },
});
const response = (data: unknown) => ({ ok: true, json: async () => data }) as Response;
const flush = () =>
  act(async () => {
    for (let i = 0; i < 8; ++i) await Promise.resolve();
  });
const advance = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
beforeEach(() => {
  vi.useFakeTimers();
  visible = "visible";
  vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visible);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe("mandatory Reach runtime policy", () => {
  it("waits for validated same-origin no-store server policy without a local default", async () => {
    const fetcher = vi.fn().mockResolvedValue(response(envelope(4)));
    vi.stubGlobal("fetch", fetcher);
    const { result } = renderHook(() => useReachRuntimePolicy());
    expect(result.current).toMatchObject({ status: "LOADING", policy: null, revision: null });
    await flush();
    expect(result.current).toMatchObject({ status: "READY", revision: 4, policy: { normalMaximumHz: 15 } });
    expect(fetcher).toHaveBeenCalledWith(
      "/api/reach/policy",
      expect.objectContaining({
        cache: "no-store",
        credentials: "same-origin",
        redirect: "error",
        signal: expect.any(AbortSignal),
      }),
    );
  });
  it("becomes unavailable on an initial server failure instead of enabling default policy", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    const { result } = renderHook(() => useReachRuntimePolicy());
    await flush();
    expect(result.current).toMatchObject({ status: "UNAVAILABLE", policy: null, revision: null });
  });
  it("refreshes every15s but expires a failed cached policy at30s", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response(envelope(7)))
      .mockRejectedValue(new Error("OFFLINE"));
    vi.stubGlobal("fetch", fetcher);
    const { result } = renderHook(() => useReachRuntimePolicy());
    await flush();
    await advance(15000);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(result.current).toMatchObject({ status: "READY", revision: 7 });
    await advance(14999);
    expect(result.current.status).toBe("READY");
    await advance(1);
    expect(result.current).toMatchObject({ status: "UNAVAILABLE", policy: null, revision: null });
  });
  it("applies disable and later enable responses on focus without a client opt-out", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response(envelope(2, { featureEnabled: false })))
      .mockResolvedValueOnce(response(envelope(3, { normalMaximumHz: 10 })));
    vi.stubGlobal("fetch", fetcher);
    const { result } = renderHook(() => useReachRuntimePolicy());
    await flush();
    expect(result.current).toMatchObject({ status: "DISABLED", revision: 2 });
    act(() => window.dispatchEvent(new Event("focus")));
    await flush();
    expect(result.current).toMatchObject({ status: "READY", revision: 3, policy: { normalMaximumHz: 10 } });
  });
  it.each([
    { ...envelope(), schemaVersion: 2 },
    { ...envelope(), revision: -1 },
    envelope(1, { normalMaximumHz: 31 }),
    envelope(1, { normalMaximumHz: 5, unfocusedMaximumHz: 8 }),
    envelope(1, { featureEnabled: "yes" }),
    { ...envelope(), localOverride: true },
  ])("rejects malformed policy without falling back (%j)", async (data) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(data)));
    const { result } = renderHook(() => useReachRuntimePolicy());
    await flush();
    expect(result.current).toMatchObject({ status: "UNAVAILABLE", policy: null });
  });
  it("does not poll hidden pages and refreshes immediately on visible return", async () => {
    visible = "hidden";
    const fetcher = vi.fn().mockResolvedValue(response(envelope()));
    vi.stubGlobal("fetch", fetcher);
    const { result } = renderHook(() => useReachRuntimePolicy());
    await advance(30000);
    expect(fetcher).not.toHaveBeenCalled();
    expect(result.current.status).toBe("LOADING");
    visible = "visible";
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    await flush();
    expect(result.current.status).toBe("READY");
    visible = "hidden";
    await advance(15000);
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it("times out a hung request and allows a later focus refresh to recover", async () => {
    const fetcher = vi
      .fn()
      .mockImplementationOnce(() => new Promise(() => {}))
      .mockResolvedValueOnce(response(envelope(9)));
    vi.stubGlobal("fetch", fetcher);
    const { result } = renderHook(() => useReachRuntimePolicy());
    await advance(5000);
    expect(result.current.status).toBe("UNAVAILABLE");
    act(() => window.dispatchEvent(new Event("focus")));
    await flush();
    expect(result.current).toMatchObject({ status: "READY", revision: 9 });
  });
  it("aborts cleanup, deduplicates concurrent refreshes and ignores a late response", async () => {
    let finish!: (value: Response) => void;
    const fetcher = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetcher);
    const { result, unmount } = renderHook(() => useReachRuntimePolicy());
    act(() => {
      void result.current.refresh();
      window.dispatchEvent(new Event("focus"));
    });
    expect(fetcher).toHaveBeenCalledOnce();
    const signal = fetcher.mock.calls[0][1].signal as AbortSignal;
    unmount();
    expect(signal.aborted).toBe(true);
    finish(response(envelope()));
    await flush();
    expect(vi.getTimerCount()).toBe(0);
  });
});

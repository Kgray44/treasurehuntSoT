import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAuthoritativeAsyncState } from "./useAuthoritativeAsyncState";

describe("useAuthoritativeAsyncState", () => {
  afterEach(() => vi.useRealTimers());

  it("moves from pending to slow and then holds authoritative success", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useAuthoritativeAsyncState(500));
    let run!: NonNullable<ReturnType<typeof result.current.begin>>;
    act(() => {
      run = result.current.begin()!;
    });
    expect(result.current.phase).toBe("pending");
    act(() => vi.advanceTimersByTime(500));
    expect(result.current.phase).toBe("slow");
    act(() => {
      expect(result.current.succeed(run)).toBe(true);
    });
    expect(result.current.phase).toBe("success");
    expect(result.current.busy).toBe(true);
  });

  it("supports recoverable and terminal failures", () => {
    const { result } = renderHook(() => useAuthoritativeAsyncState());
    act(() => {
      const run = result.current.begin()!;
      expect(result.current.fail(run)).toBe(true);
    });
    expect(result.current.phase).toBe("recoverable-error");
    act(() => {
      const run = result.current.begin()!;
      expect(result.current.fail(run, true)).toBe(true);
    });
    expect(result.current.phase).toBe("terminal-error");
  });

  it("prevents repeated submit and rejects stale responses after cancellation", () => {
    const { result } = renderHook(() => useAuthoritativeAsyncState());
    let run!: NonNullable<ReturnType<typeof result.current.begin>>;
    act(() => {
      run = result.current.begin()!;
    });
    expect(result.current.begin()).toBeNull();
    act(() => result.current.cancel("route-change"));
    expect(run.controller.signal.aborted).toBe(true);
    expect(result.current.succeed(run)).toBe(false);
    expect(result.current.phase).toBe("cancelled");
  });

  it("returns an active operation to idle when its surface context changes", () => {
    const { result } = renderHook(() => useAuthoritativeAsyncState());
    let run!: NonNullable<ReturnType<typeof result.current.begin>>;
    act(() => {
      run = result.current.begin()!;
      result.current.reset("context-changed");
    });

    expect(run.controller.signal.aborted).toBe(true);
    expect(result.current.phase).toBe("idle");
    expect(result.current.busy).toBe(false);
  });

  it("aborts the active request on unmount", () => {
    const { result, unmount } = renderHook(() => useAuthoritativeAsyncState());
    let run!: NonNullable<ReturnType<typeof result.current.begin>>;
    act(() => {
      run = result.current.begin()!;
    });
    unmount();
    expect(run.controller.signal.aborted).toBe(true);
  });
});

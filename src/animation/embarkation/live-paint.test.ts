import { describe, expect, it, vi } from "vitest";
import { LivePaint } from "./live-paint";
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
describe("live canonical paint revision ownership", () => {
  it("discards an obsolete decode and publishes only the current live revision", async () => {
    const first = deferred<{ dispose(): void }>(),
      second = deferred<{ dispose(): void }>();
    const old = { dispose: vi.fn() },
      fresh = { dispose: vi.fn() };
    const paint = new LivePaint(vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise));
    const ready = paint.flush();
    paint.invalidate();
    first.resolve(old);
    await Promise.resolve();
    expect(paint.current).toBeNull();
    second.resolve(fresh);
    await ready;
    expect(paint.current).toBe(fresh);
    expect(paint.ready).toBe(true);
    expect(old.dispose).toHaveBeenCalledOnce();
    expect(paint.discarded).toBe(1);
    paint.dispose();
    expect(fresh.dispose).toHaveBeenCalledOnce();
  });
  it("coalesces a React mutation batch and does no capture for unchanged presentation frames", async () => {
    const capture = vi.fn(async () => ({ dispose: vi.fn() }));
    const paint = new LivePaint(capture);
    for (let i = 0; i < 12; i++) paint.invalidate();
    await paint.flush();
    for (let i = 0; i < 120; i++) expect(paint.current).not.toBeNull();
    await paint.flush();
    expect(capture).toHaveBeenCalledTimes(1);
    expect(paint.paintedRevision).toBe(12);
    paint.dispose();
  });
  it("does not publish or leak a decoded image after lifecycle interruption", async () => {
    const pending = deferred<{ dispose(): void }>(),
      result = { dispose: vi.fn() };
    const published = vi.fn();
    const paint = new LivePaint(() => pending.promise, published);
    const work = paint.flush();
    paint.dispose();
    pending.resolve(result);
    await work;
    expect(paint.current).toBeNull();
    expect(result.dispose).toHaveBeenCalledOnce();
    expect(paint.ready).toBe(false);
    expect(published).not.toHaveBeenCalled();
  });
  it("requests a fresh presentation when asynchronous paint becomes available while the film is paused", async () => {
    const pending = deferred<{ dispose(): void }>(),
      published = vi.fn();
    const paint = new LivePaint(() => pending.promise, published);
    const work = paint.flush();
    expect(published).not.toHaveBeenCalled();
    pending.resolve({ dispose: vi.fn() });
    await work;
    expect(published).toHaveBeenCalledExactlyOnceWith(null);
    await paint.flush();
    expect(published).toHaveBeenCalledTimes(1);
    paint.dispose();
  });
  it("retains the previous paint on decode failure and recovers on a new content revision", async () => {
    const first = { dispose: vi.fn() },
      next = { dispose: vi.fn() };
    const capture = vi
      .fn()
      .mockResolvedValueOnce(first)
      .mockRejectedValueOnce(new Error("missing image"))
      .mockResolvedValueOnce(next);
    const paint = new LivePaint(capture);
    await paint.flush();
    paint.invalidate();
    await paint.flush();
    expect(paint.current).toBe(first);
    expect(paint.ready).toBe(false);
    expect(paint.failure).toBeInstanceOf(Error);
    paint.invalidate();
    await paint.flush();
    expect(paint.current).toBe(next);
    expect(paint.ready).toBe(true);
    paint.dispose();
  });
});

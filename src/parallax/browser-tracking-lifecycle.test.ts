import { afterEach, expect, it, vi } from "vitest";
import { waitForTrackingOperation } from "./browser-tracking-lifecycle";

afterEach(() => vi.useRealTimers());

it("consumes late rejection when opening was already cancelled", async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(
    waitForTrackingOperation(Promise.reject(new Error("late download")), controller.signal, "timeout"),
  ).rejects.toThrow("cancelled");
});

it("releases startup wait on cancellation even when the underlying download never finishes", async () => {
  const controller = new AbortController();
  const result = waitForTrackingOperation(new Promise<never>(() => {}), controller.signal, "Download timed out.");
  const rejection = expect(result).rejects.toThrow("cancelled");
  controller.abort();
  await rejection;
});

it("bounds stalled startup and permits a separate retry", async () => {
  vi.useFakeTimers();
  const controller = new AbortController();
  const stalled = waitForTrackingOperation(new Promise<never>(() => {}), controller.signal, "Engine timed out.", 100);
  const rejection = expect(stalled).rejects.toThrow("Engine timed out.");
  await vi.advanceTimersByTimeAsync(100);
  await rejection;
  await expect(waitForTrackingOperation(Promise.resolve("ready"), controller.signal, "timeout", 100)).resolves.toBe(
    "ready",
  );
  expect(vi.getTimerCount()).toBe(0);
});

it("preserves real startup failures and ignores late completion after cancellation", async () => {
  const controller = new AbortController();
  let finish!: (value: string) => void;
  const result = waitForTrackingOperation(
    new Promise<string>((resolve) => {
      finish = resolve;
    }),
    controller.signal,
    "timeout",
  );
  const rejection = expect(result).rejects.toThrow("cancelled");
  controller.abort();
  finish("late");
  await rejection;
  await expect(
    waitForTrackingOperation(Promise.reject(new Error("integrity")), new AbortController().signal, "timeout"),
  ).rejects.toThrow("integrity");
});

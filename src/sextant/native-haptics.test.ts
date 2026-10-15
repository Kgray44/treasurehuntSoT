// @sounding-line-registration owner=project-sextant suite=unit.sextant contracts=sextant.phase4.native-context
import { afterEach, expect, it, vi } from "vitest";
import { NativeHapticAdapter } from "./native-haptics";
import { SextantHaptics } from "./haptics";
import type { SextantNativeOperation } from "./native-provider";
afterEach(() => vi.useRealTimers());
const cue = {
  cue: "TICK" as const,
  consumerId: "lens",
  purpose: "Confirm optional selection",
  fallback: "Show the confirmation on screen",
};
function fixture() {
  const request = vi.fn<(op: SextantNativeOperation, payload?: Record<string, unknown>) => Promise<unknown>>(
    async (op) =>
      op === "SEXTANT_STATE"
        ? { hapticTier: "RICH" }
        : op === "SEXTANT_HAPTIC"
          ? { accepted: true, tier: "RICH", physicalOutputConfirmed: false }
          : { accepted: true },
  );
  const adapter = new NativeHapticAdapter({ platform: "IOS", request, subscribe: () => () => {} }),
    haptics = new SextantHaptics(adapter, () => 10000);
  return { request, adapter, haptics };
}
it("requires native acknowledgement and retains visual fallback and physical uncertainty", async () => {
  vi.useFakeTimers();
  const f = fixture();
  await f.adapter.refresh();
  expect(f.haptics.request(cue).reason).toBe("ASYNC_NATIVE_ACK_REQUIRED");
  expect(await f.haptics.requestAsync(cue)).toEqual({
    state: "REQUESTED",
    reason: "PHYSICAL_OUTPUT_UNCONFIRMED",
    fallback: cue.fallback,
    tier: "RICH",
  });
  expect(f.request).toHaveBeenCalledWith(
    "SEXTANT_HAPTIC",
    expect.objectContaining({ pattern: [15], enabled: true, reducedSensory: false }),
  );
  f.haptics.cancelConsumer("other");
  expect(f.haptics.status().active).toBe(true);
  f.haptics.cancelConsumer("lens");
  expect(f.request).toHaveBeenCalledWith(
    "SEXTANT_HAPTIC_STOP",
    expect.objectContaining({ leaseId: expect.any(String) }),
  );
});
it("reserves an output slot and cancels a late native acknowledgement after backgrounding", async () => {
  vi.useFakeTimers();
  const f = fixture();
  await f.adapter.refresh();
  let finish: (r: unknown) => void = () => {};
  f.request.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const pending = f.haptics.requestAsync(cue);
  expect((await f.haptics.requestAsync({ ...cue, consumerId: "other" })).state).toBe("FALLBACK");
  f.haptics.setForeground(false);
  finish({ accepted: true, tier: "RICH", physicalOutputConfirmed: false });
  expect((await pending).reason).toBe("OUTPUT_PAUSED_OR_DISABLED");
  expect(f.haptics.status().active).toBe(false);
  expect(f.request.mock.calls.filter(([op]) => op === "SEXTANT_HAPTIC_STOP").length).toBeGreaterThanOrEqual(2);
});
it("refuses unsupported, disabled and reduced-sensory output without a transport output call", async () => {
  const f = fixture();
  expect((await f.haptics.requestAsync(cue)).reason).toBe("OUTPUT_UNSUPPORTED");
  await f.adapter.refresh();
  f.haptics.setPreferences(false);
  expect((await f.haptics.requestAsync(cue)).state).toBe("FALLBACK");
  f.haptics.setPreferences(true, true);
  expect((await f.haptics.requestAsync(cue)).state).toBe("FALLBACK");
  expect(f.request.mock.calls.every(([op]) => op === "SEXTANT_STATE")).toBe(true);
});
it("bounds stalled output acknowledgement and blocks output after failed scoped cleanup", async () => {
  vi.useFakeTimers();
  const f = fixture();
  await f.adapter.refresh();
  f.request.mockImplementationOnce(() => new Promise(() => {}));
  const pending = f.haptics.requestAsync(cue);
  await vi.advanceTimersByTimeAsync(5001);
  expect((await pending).state).toBe("FALLBACK");
  f.request.mockImplementationOnce(async () => ({ accepted: false }));
  f.adapter.cancel();
  // Acquire a fresh adapter owner, then refuse its cleanup acknowledgement.
  const owner = fixture();
  await owner.adapter.refresh();
  await owner.haptics.requestAsync(cue);
  owner.request.mockImplementationOnce(async () => ({ accepted: false }));
  owner.haptics.cancel();
  await vi.waitFor(() => expect(owner.haptics.status().cleanupFailed).toBe(true));
  expect((await owner.haptics.requestAsync(cue)).reason).toBe("OUTPUT_CLEANUP_FAILED");
});

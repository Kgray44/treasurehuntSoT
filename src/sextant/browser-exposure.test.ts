// @sounding-line-registration owner=project-sextant suite=unit.sextant contracts=sextant.phase1.foundation
import { describe, expect, it, vi } from "vitest";
import { BrowserExposureAssistance, defaultBrowserExposurePolicy } from "./browser-exposure";
import type { BrowserCameraBroker, CameraLease } from "./camera";

function rig(options: { capabilities?: Record<string, unknown>; settings?: Record<string, unknown> } = {}) {
  let foreground = true;
  const settings: Record<string, unknown> = { width: 913, height: 517, exposureCompensation: 0, ...options.settings };
  const capabilities = options.capabilities ?? { exposureCompensation: { min: -4, max: 4, step: 0.5 } };
  const constraints = {
    width: { ideal: 913 },
    height: { ideal: 517 },
    frameRate: { max: 24 },
    advanced: [{ whiteBalanceMode: "manual", exposureCompensation: settings.exposureCompensation }],
  } as unknown as MediaTrackConstraints;
  const track = {
    kind: "video",
    readyState: "live",
    getCapabilities: vi.fn(() => capabilities),
    getSettings: vi.fn(() => ({ ...settings })),
    getConstraints: vi.fn(() => structuredClone(constraints)),
    applyConstraints: vi.fn(async (input: MediaTrackConstraints) => {
      for (const advanced of input.advanced ?? [])
        for (const [key, value] of Object.entries(advanced)) settings[key] = value;
    }),
    stop: vi.fn(),
  };
  const snapshot: ReturnType<BrowserCameraBroker["snapshot"]> = {
    supported: true,
    permission: "GRANTED",
    availability: "READY",
    generation: 7,
    leaseId: "owned",
  };
  const lease = {
    id: "owned",
    generation: 7,
    stream: { getVideoTracks: () => [track] },
    release: vi.fn(),
  } as unknown as CameraLease;
  const assistance = new BrowserExposureAssistance({ snapshot: () => ({ ...snapshot }) }, lease, () => foreground);
  return {
    assistance,
    track,
    settings,
    snapshot,
    constraints,
    lease,
    setForeground: (value: boolean) => {
      foreground = value;
    },
  };
}
describe("Sextant same-camera reversible exposure assistance", () => {
  it("negotiates a bounded camera-relative step while preserving unrelated constraints and actual geometry", async () => {
    const r = rig(),
      abort = new AbortController();
    expect(r.assistance.available()).toBe(true);
    expect(r.track.applyConstraints).not.toHaveBeenCalled();
    const resource = await r.assistance.start(abort.signal);
    expect(r.settings.exposureCompensation).toBe(1);
    expect(r.track.applyConstraints.mock.calls[0][0]).toMatchObject({
      width: { exact: 913 },
      height: { exact: 517 },
      frameRate: { max: 24 },
      advanced: [{ whiteBalanceMode: "manual" }, { exposureCompensation: 1 }],
    });
    expect(r.assistance.available()).toBe(true);
    await resource.restore();
    expect(r.settings.exposureCompensation).toBe(0);
    expect(r.track.applyConstraints.mock.calls.at(-1)![0]).toEqual(r.constraints);
    const calls = r.track.applyConstraints.mock.calls.length;
    await resource.restore();
    expect(r.track.applyConstraints).toHaveBeenCalledTimes(calls);
    expect(r.track.stop).not.toHaveBeenCalled();
    expect(r.lease.release).not.toHaveBeenCalled();
  });
  it("uses reported step and range across different cameras instead of absolute exposure values", async () => {
    for (const [min, max, step, original] of [
      [-20, 20, 2, 0],
      [0, 1, 0.05, 0.25],
      [-8, 8, 1, -2],
    ]) {
      const r = rig({
        capabilities: { exposureCompensation: { min, max, step } },
        settings: { exposureCompensation: original },
      });
      const resource = await r.assistance.start(new AbortController().signal);
      expect(r.settings.exposureCompensation).toBeGreaterThan(original);
      expect(Number(r.settings.exposureCompensation) - original).toBeLessThanOrEqual(
        (max - min) * defaultBrowserExposurePolicy.maximumCompensationRangeFraction + Number.EPSILON,
      );
      await resource.restore();
      expect(r.settings.exposureCompensation).toBe(original);
    }
  });
  it("can request a supported continuous mode and restore its previous mode", async () => {
    const r = rig({ capabilities: { exposureMode: ["manual", "continuous"] }, settings: { exposureMode: "manual" } });
    const resource = await r.assistance.start(new AbortController().signal);
    expect(r.settings.exposureMode).toBe("continuous");
    await resource.restore();
    expect(r.settings.exposureMode).toBe("manual");
  });
  it.each([
    { permission: "DENIED" as const },
    { generation: 8 },
    { leaseId: "replacement" },
    { availability: "CAMERA_BUSY" as const },
  ])("does not query or alter a stale or unauthorized lease (%j)", async (overrides) => {
    const r = rig();
    Object.assign(r.snapshot, overrides);
    expect(r.assistance.available()).toBe(false);
    await expect(r.assistance.start(new AbortController().signal)).rejects.toThrow("UNAVAILABLE");
    expect(r.track.getCapabilities).not.toHaveBeenCalled();
    expect(r.track.applyConstraints).not.toHaveBeenCalled();
  });
  it("keeps unsupported and unknown cameras on their existing baseline", async () => {
    for (const capabilities of [
      {},
      { exposureMode: [] },
      { exposureCompensation: { min: NaN, max: 4 } },
      { exposureCompensation: { min: -4, max: 4, step: 9 } },
    ]) {
      const r = rig({ capabilities });
      expect(r.assistance.available()).toBe(false);
      await expect(r.assistance.start(new AbortController().signal)).rejects.toThrow("UNAVAILABLE");
      expect(r.track.applyConstraints).not.toHaveBeenCalled();
    }
  });
  it("does not write without current foreground consent, or after an already aborted request", async () => {
    const r = rig(),
      abort = new AbortController();
    r.setForeground(false);
    await expect(r.assistance.start(abort.signal)).rejects.toThrow("UNAVAILABLE");
    r.setForeground(true);
    abort.abort();
    await expect(r.assistance.start(abort.signal)).rejects.toThrow("UNAVAILABLE");
    expect(r.track.applyConstraints).not.toHaveBeenCalled();
  });
  it("detects silently ignored controls and restores the original constraints", async () => {
    const r = rig();
    r.track.applyConstraints.mockImplementation(async () => {});
    await expect(r.assistance.start(new AbortController().signal)).rejects.toThrow("NOT_APPLIED");
    expect(r.track.applyConstraints.mock.calls.at(-1)![0]).toEqual(r.constraints);
  });
  it("rechecks foreground and lease authorization after capability queries at the actual write boundary", async () => {
    const r = rig();
    r.track.getConstraints.mockImplementation(() => {
      r.setForeground(false);
      return structuredClone(r.constraints);
    });
    await expect(r.assistance.start(new AbortController().signal)).rejects.toThrow("CANCELLED");
    expect(r.track.applyConstraints).not.toHaveBeenCalled();
  });
  it("restores a partially applied driver rejection", async () => {
    const r = rig();
    r.track.applyConstraints.mockImplementationOnce(async () => {
      r.settings.exposureCompensation = 1;
      throw new Error("DRIVER_REJECTED_AFTER_APPLY");
    });
    await expect(r.assistance.start(new AbortController().signal)).rejects.toThrow("DRIVER_REJECTED_AFTER_APPLY");
    expect(r.settings.exposureCompensation).toBe(0);
    expect(r.track.applyConstraints.mock.calls.at(-1)![0]).toEqual(r.constraints);
  });
  it("tags an unconfirmed rollback distinctly from a successfully restored start failure", async () => {
    const r = rig();
    r.track.applyConstraints.mockImplementationOnce(async () => {
      r.settings.exposureCompensation = 1;
      throw new Error("APPLY_FAILED");
    });
    r.track.applyConstraints.mockImplementationOnce(async () => {
      throw new Error("RESTORE_FAILED");
    });
    await expect(r.assistance.start(new AbortController().signal)).rejects.toThrow("SEXTANT_EXPOSURE_RESTORE_FAILED");
  });
  it("cleans up a pending request that completes after cancellation without starting a second write concurrently", async () => {
    const r = rig(),
      abort = new AbortController();
    let finish!: () => void;
    r.track.applyConstraints.mockImplementationOnce(async () => {
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
      r.settings.exposureCompensation = 1;
    });
    const pending = r.assistance.start(abort.signal);
    await expect(r.assistance.start(new AbortController().signal)).rejects.toThrow("UNAVAILABLE");
    abort.abort();
    r.setForeground(false);
    finish();
    await expect(pending).rejects.toThrow("CANCELLED");
    expect(r.settings.exposureCompensation).toBe(0);
  });
  it("cleans up a pending explicit release without requiring the caller to await a stalled driver", async () => {
    const r = rig();
    let finish!: () => void;
    r.track.applyConstraints.mockImplementationOnce(async () => {
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
      r.settings.exposureCompensation = 1;
    });
    const pending = r.assistance.start(new AbortController().signal);
    await r.assistance.release();
    finish();
    await expect(pending).rejects.toThrow("CANCELLED");
    expect(r.settings.exposureCompensation).toBe(0);
  });
  it("never restores control values onto a replacement lease", async () => {
    const r = rig(),
      resource = await r.assistance.start(new AbortController().signal);
    const count = r.track.applyConstraints.mock.calls.length;
    r.snapshot.generation = 8;
    r.snapshot.leaseId = "replacement";
    await resource.restore();
    expect(r.track.applyConstraints).toHaveBeenCalledTimes(count);
  });
});

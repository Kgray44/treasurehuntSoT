// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { describe, it, expect, vi } from "vitest";
import {
  phase1ScenarioIds,
  runPhase1Oracle,
  calibrationGroups,
  syntheticBinding,
  sampleGate,
} from "./foundation-scenarios";
import { calibrationLayout, estimatedPoint, fitCalibration, stableSamples, validateCalibration } from "./calibration";
import { BrowserCameraBroker } from "@/sextant/camera";
import { BrowserHandAdapter, HAND_CONTINUITY_GRACE_MS } from "@/watchglass/hand-provider";
import { syntheticObservation } from "./synthetic";
describe("Reach Phase 1 owner oracles", () => {
  it("detaches and rejects a source that ends during listener registration", async () => {
    let detached = 0,
      stopped = 0;
    const track = {
      readyState: "live",
      stop() {
        this.readyState = "ended";
        stopped++;
      },
      addEventListener(_name: string, listener: () => void) {
        this.readyState = "ended";
        listener();
      },
      removeEventListener() {
        detached++;
      },
    };
    const broker = new BrowserCameraBroker({
      getUserMedia: async () => ({ getTracks: () => [track], getVideoTracks: () => [track] }) as unknown as MediaStream,
    });
    await expect(broker.acquire(true, true)).rejects.toThrow("CAMERA_SOURCE_ENDED_DURING_ACQUISITION");
    expect(broker.snapshot()).toMatchObject({ availability: "SUSPENDED", leaseId: null });
    expect(broker.ownedTracks).toBe(0);
    expect(detached).toBe(1);
    expect(stopped).toBe(1);
  });
  it("releases an acquired stream if lease construction fails", async () => {
    let stopped = 0;
    const track = {
      readyState: "live",
      stop() {
        this.readyState = "ended";
        stopped++;
      },
      addEventListener() {},
      removeEventListener() {},
    };
    const broker = new BrowserCameraBroker({
      getUserMedia: async () => ({ getTracks: () => [track], getVideoTracks: () => [track] }) as unknown as MediaStream,
    });
    const uuid = vi.spyOn(crypto, "randomUUID").mockImplementationOnce(() => {
      throw new Error("UNAVAILABLE_UUID");
    });
    try {
      await expect(broker.acquire(true, true)).rejects.toThrow("UNAVAILABLE_UUID");
    } finally {
      uuid.mockRestore();
      broker.release();
    }
    expect(stopped).toBe(1);
    expect(broker.ownedTracks).toBe(0);
  });
  it("ignores a permission denial from a cancelled acquisition", async () => {
    let reject!: (reason: Error) => void;
    const broker = new BrowserCameraBroker({
      getUserMedia: () =>
        new Promise<MediaStream>((_done, fail) => {
          reject = fail;
        }),
    });
    const pending = broker.acquire(true, true);
    const outcome = expect(pending).rejects.toThrow();
    broker.release();
    reject(new DOMException("", "NotAllowedError"));
    await outcome;
    expect(broker.snapshot()).toMatchObject({ permission: "UNKNOWN", availability: "DISABLED", leaseId: null });
  });
  it("a queued ended callback from an old track cannot release a newer lease", async () => {
    const ended: (() => void)[] = [];
    const broker = new BrowserCameraBroker({
      getUserMedia: async () => {
        const track = {
          readyState: "live",
          stop() {
            this.readyState = "ended";
          },
          addEventListener(_name: string, listener: () => void) {
            ended.push(listener);
          },
          removeEventListener() {},
        };
        return { getTracks: () => [track], getVideoTracks: () => [track] } as unknown as MediaStream;
      },
    });
    const old = await broker.acquire(true, true);
    old.release();
    const current = await broker.acquire(true, true);
    try {
      ended[0]();
      old.release();
      expect(broker.snapshot()).toMatchObject({ permission: "GRANTED", availability: "READY", leaseId: current.id });
      expect(broker.ownedTracks).toBe(1);
    } finally {
      current.release();
    }
  });
  it("binds fresh absolute estimates to provenance and abstains after stale input", () => {
    const o = syntheticObservation({ x: 0.5, y: 0.5 }, 0, 1100);
    const binding = {
      ...syntheticBinding,
      providerId: o.providerId,
      providerVersion: o.providerVersion,
      inferenceBackend: "CPU_WASM" as const,
      modelDigest: o.modelDigest,
      cameraLeaseId: o.cameraLeaseId,
      trackId: o.hands[0].trackId,
    };
    o.inferenceBackend = "CPU_WASM";
    const c = validateCalibration(
      fitCalibration(calibrationGroups(), binding, 1000),
      calibrationGroups(calibrationLayout.validation),
    );
    expect(estimatedPoint(c, o, binding, 1101)).toMatchObject({
      x: expect.any(Number),
      actionable: false,
      calibrationId: c.id,
      observationId: o.observationId,
      sampleAgeMs: 1,
      evidenceTier: "D0",
    });
    expect(estimatedPoint(c, o, binding, 1300)).toBeNull();
    expect(estimatedPoint(c, { ...o, providerGeneration: 2 }, binding, 1101)).toBeNull();
    expect(
      estimatedPoint(c, { ...o, providerVersion: `${o.providerVersion}+different-policy` }, binding, 1101),
    ).toBeNull();
    expect(estimatedPoint(c, { ...o, inferenceBackend: "GPU_WEBGL" }, binding, 1101)).toBeNull();
    // Coarse legacy quality no longer overrides valid per-hand feature evidence.
    expect(estimatedPoint(c, { ...o, quality: "LOW" }, binding, 1101)).not.toBeNull();
    const partial = structuredClone(o);
    partial.hands[0].landmarks[8].valid = false;
    expect(estimatedPoint(c, partial, binding, 1101)).toBeNull();
  });
  it("stops late streams and reserves one acquisition across consumers", async () => {
    let resolve!: (stream: MediaStream) => void;
    let stops = 0;
    const media = {
      getUserMedia: () =>
        new Promise<MediaStream>((done) => {
          resolve = done;
        }),
    };
    const first = new BrowserCameraBroker(media);
    const second = new BrowserCameraBroker(media);
    const pending = first.acquire(true, true);
    const rejection = expect(pending).rejects.toThrow("CAMERA_REQUEST_CANCELLED");
    await expect(second.acquire(true, true)).rejects.toThrow("CAMERA_EXCLUSIVE_LEASE_BUSY");
    first.release();
    await expect(second.acquire(true, true)).rejects.toThrow("CAMERA_EXCLUSIVE_LEASE_BUSY");
    resolve({
      getTracks: () => [
        {
          stop: () => {
            stops++;
          },
        },
      ],
    } as unknown as MediaStream);
    await rejection;
    expect(stops).toBe(1);
    expect(first.ownedTracks).toBe(0);
    expect(first.state).toBe("DISABLED");
    expect(first.snapshot().permission).toBe("UNKNOWN");
  });
  for (const scenario of phase1ScenarioIds) it(scenario, () => runPhase1Oracle(scenario));
  it("does not fit partial or unstable training", () => {
    expect(() => fitCalibration(calibrationGroups().slice(0, 8), syntheticBinding, 1000)).toThrow();
    const groups = calibrationGroups();
    groups[0][15].features[1] += 0.2;
    expect(stableSamples(groups[0])).toBe(false);
    expect(() => fitCalibration(groups, syntheticBinding, 1000)).toThrow();
  });
  it("preserves missing scores, tolerates a short spatially continuous gap and expires long gaps", () => {
    const adapter = new BrowserHandAdapter(
      { providerGeneration: 1, cameraLeaseId: "synthetic-no-camera", cameraFrameVersion: 1, mirrorTransform: "NONE" },
      "D1",
    );
    const landmarks = syntheticObservation({ x: 0.5, y: 0.5 }, 0, 100).hands.map((h) => h.landmarks);
    const a = adapter.envelope({ landmarks, handedness: [] }, 100, 110, 640, 480);
    expect(sampleGate().accept(a, 111).hands[0].trackingScore).toBeNull();
    adapter.envelope({ landmarks: [], handedness: [] }, 120, 130, 640, 480);
    const b = adapter.envelope({ landmarks, handedness: [] }, 140, 150, 640, 480);
    expect(b.hands[0].trackGeneration).toBe(a.hands[0].trackGeneration);
    const expired = 140 + HAND_CONTINUITY_GRACE_MS + 1;
    const c = adapter.envelope({ landmarks, handedness: [] }, expired, expired + 10, 640, 480);
    expect(c.hands[0].trackGeneration).toBeGreaterThan(a.hands[0].trackGeneration);
  });
});

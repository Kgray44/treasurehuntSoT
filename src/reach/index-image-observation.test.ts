// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { describe, expect, it } from "vitest";
import { indexImageAlgorithm, type IndexImageObservation } from "./index-image-tracker";
import { IndexImageObservationGate, type IndexImageObservationBinding } from "./index-image-observation";

const context: IndexImageObservationBinding = {
  providerGeneration: 1,
  cameraLeaseId: "test-camera",
  cameraFrameVersion: 1,
  mirrorTransform: "PREVIEW_X",
  orientation: 0,
};
function frame(sequence = 0, capture = 100): IndexImageObservation {
  return {
    ...context,
    observationVersion: 1,
    providerId: indexImageAlgorithm.providerId,
    providerVersion: indexImageAlgorithm.providerVersion,
    algorithmDigest: indexImageAlgorithm.algorithmDigest,
    frameWidth: 640,
    frameHeight: 480,
    sequence,
    monotonicCaptureTime: capture,
    monotonicInferenceTime: capture + 5,
    trackId: "test-image-index-1",
    trackGeneration: 1,
    point: { x: 0.3, y: 0.7 },
    state: "TRACKING",
    modelAgreement: "UNAVAILABLE",
    anchorSource: "MODEL_INDEX",
    quality: { correlation: 0.95, separation: 0.2, texture: 20, forwardBackwardErrorPixels: 0.3 },
    uncertaintyRadiusPixels: 2,
    reason: "IMAGE_TRACK_CONFIRMED",
  };
}

describe("fresh image-tip observation gate", () => {
  it("accepts original fresh image observations without requiring a concurrent 3D model result", () => {
    const gate = new IndexImageObservationGate(context);
    expect(gate.accept(frame(), 110)).toMatchObject({ state: "TRACKING", modelAgreement: "UNAVAILABLE" });
    expect(gate.accept({ ...frame(1, 150), anchorSource: "MANUAL_HINT" }, 160).point).toEqual({ x: 0.3, y: 0.7 });
  });

  it("copies the known runtime binding so callers cannot silently replace its source", () => {
    const mutable = { ...context };
    const gate = new IndexImageObservationGate(mutable);
    mutable.providerGeneration = 2;
    expect(gate.accept(frame(), 110).providerGeneration).toBe(1);
    expect(Object.isFrozen(gate.binding)).toBe(true);
  });

  it("rejects each provider, algorithm, camera and view change without consuming the sequence", () => {
    const changes = [
      { providerId: "other-image-source" },
      { providerVersion: "2" },
      { algorithmDigest: "f".repeat(64) },
      { providerGeneration: 2 },
      { cameraLeaseId: "other-camera" },
      { cameraFrameVersion: 2 },
      { mirrorTransform: "NONE" },
      { orientation: 90 },
      { frameWidth: 1280 },
      { frameHeight: 720 },
    ];
    for (const changed of changes) {
      const gate = new IndexImageObservationGate(context);
      gate.accept(frame(), 110);
      expect(() => gate.accept({ ...frame(1, 150), ...changed }, 160)).toThrow();
      expect(gate.accept(frame(1, 150), 160).sequence).toBe(1);
    }
  });

  it("never binds dimensions or ordering from a rejected first envelope", () => {
    const gate = new IndexImageObservationGate(context);
    expect(() => gate.accept({ ...frame(900, 900), algorithmDigest: "0".repeat(64), frameWidth: 1280 }, 910)).toThrow();
    expect(gate.accept(frame(), 110).frameWidth).toBe(640);
  });

  it("requires both sequence and original capture time to increase strictly", () => {
    for (const reordered of [frame(0, 150), frame(1, 100), frame(90, 90)]) {
      const gate = new IndexImageObservationGate(context);
      gate.accept(frame(), 110);
      expect(() => gate.accept(reordered, 160)).toThrow("INDEX_IMAGE_REORDERED");
      expect(gate.accept(frame(1, 150), 160).sequence).toBe(1);
    }
  });

  it("uses original pixel freshness even when inference completion is recent", () => {
    const gate = new IndexImageObservationGate(context);
    expect(() => gate.accept({ ...frame(900, 100), monotonicInferenceTime: 300 }, 310)).toThrow(
      "INDEX_IMAGE_CLOCK_OR_FRESHNESS",
    );
    expect(gate.accept(frame(), 110).sequence).toBe(0);
  });

  it("preserves the 150ms age limit and 5ms inference-clock tolerance", () => {
    expect(new IndexImageObservationGate(context).accept(frame(), 250).monotonicCaptureTime).toBe(100);
    expect(() => new IndexImageObservationGate(context).accept(frame(), 251)).toThrow("INDEX_IMAGE_CLOCK_OR_FRESHNESS");
    expect(
      new IndexImageObservationGate(context).accept({ ...frame(), monotonicInferenceTime: 115 }, 110),
    ).toBeDefined();
    expect(() =>
      new IndexImageObservationGate(context).accept({ ...frame(), monotonicInferenceTime: 116 }, 110),
    ).toThrow("INDEX_IMAGE_CLOCK_OR_FRESHNESS");
    expect(() =>
      new IndexImageObservationGate(context).accept({ ...frame(), monotonicInferenceTime: 99 }, 110),
    ).toThrow("INDEX_IMAGE_CLOCK_OR_FRESHNESS");
    expect(() => new IndexImageObservationGate(context).accept(frame(0, 116), 110)).toThrow(
      "INDEX_IMAGE_CLOCK_OR_FRESHNESS",
    );
  });

  it("requires finite, positive or nonnegative metadata as appropriate and keeps rejection recoverable", () => {
    const changes = [
      { providerGeneration: NaN },
      { providerGeneration: 0 },
      { cameraFrameVersion: Infinity },
      { sequence: NaN },
      { sequence: Infinity },
      { sequence: 1.5 },
      { sequence: -1 },
      { monotonicCaptureTime: NaN },
      { monotonicCaptureTime: -1 },
      { monotonicInferenceTime: Infinity },
      { frameWidth: NaN },
      { frameWidth: 0 },
      { frameWidth: 640.5 },
      { frameHeight: Infinity },
      { frameHeight: -1 },
      { trackGeneration: Infinity },
      { uncertaintyRadiusPixels: NaN },
      { uncertaintyRadiusPixels: -1 },
    ];
    for (const changed of changes) {
      const gate = new IndexImageObservationGate(context);
      expect(() => gate.accept({ ...frame(), ...changed }, 110)).toThrow();
      expect(gate.accept(frame(), 110).sequence).toBe(0);
    }
    for (const now of [NaN, Infinity, -1])
      expect(() => new IndexImageObservationGate(context).accept(frame(), now)).toThrow();
  });

  it("rejects nonfinite numeric quality diagnostics without treating them as probabilities", () => {
    for (const field of ["correlation", "separation", "texture", "forwardBackwardErrorPixels"] as const) {
      const observation = frame();
      observation.quality[field] = NaN;
      expect(() => new IndexImageObservationGate(context).accept(observation, 110)).toThrow();
    }
    const diagnosticOnly = frame();
    diagnosticOnly.quality = { correlation: -0.2, separation: 1.4, texture: 20, forwardBackwardErrorPixels: 0 };
    expect(new IndexImageObservationGate(context).accept(diagnosticOnly, 110).quality.separation).toBe(1.4);
  });

  it("requires a bounded point and an explicit image track only while TRACKING", () => {
    for (const changed of [
      { point: null },
      { point: { x: NaN, y: 0.5 } },
      { point: { x: -0.001, y: 0.5 } },
      { point: { x: 0.5, y: 1.001 } },
      { trackId: null },
      { trackId: "" },
      { trackId: "   " },
      { trackGeneration: 0 },
    ])
      expect(() => new IndexImageObservationGate(context).accept({ ...frame(), ...changed }, 110)).toThrow();
    expect(new IndexImageObservationGate(context).accept({ ...frame(), point: { x: 0, y: 1 } }, 110).point).toEqual({
      x: 0,
      y: 1,
    });
  });

  it.each(["UNSEEDED", "UNCERTAIN", "LOST"] as const)(
    "requires point:null for %s, never a fresh held position",
    (state) => {
      const observation = { ...frame(), state };
      expect(() => new IndexImageObservationGate(context).accept(observation, 110)).toThrow();
      expect(new IndexImageObservationGate(context).accept({ ...observation, point: null }, 110).point).toBeNull();
    },
  );

  it("allows an unseeded envelope without an identity and a lost envelope retaining its old identity", () => {
    const unseeded = {
      ...frame(),
      state: "UNSEEDED",
      trackId: null,
      trackGeneration: 0,
      point: null,
      anchorSource: null,
    };
    expect(new IndexImageObservationGate(context).accept(unseeded, 110).trackId).toBeNull();
    const lost = { ...frame(), state: "LOST", point: null };
    expect(new IndexImageObservationGate(context).accept(lost, 110).trackId).toBe("test-image-index-1");
  });

  it("rejects pixels, model landmarks, 3D coordinates and other unapproved payloads", () => {
    for (const extra of [{ pixels: [0, 1, 2] }, { landmarks: [] }, { hands: [] }, { video: "private" }])
      expect(() => new IndexImageObservationGate(context).accept({ ...frame(), ...extra }, 110)).toThrow();
    expect(() =>
      new IndexImageObservationGate(context).accept({ ...frame(), point: { x: 0.3, y: 0.7, z: 0 } }, 110),
    ).toThrow();
  });
});

// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { describe, expect, it } from "vitest";
import { observationFreshnessTime } from "@/watchglass/hand-observation";
import { ObservationGate } from "./observation";
import { IndexImageObservationGate } from "./index-image-observation";
import { indexImageAlgorithm } from "./index-image-tracker";
import { syntheticObservation } from "./synthetic";

const hand = { ...syntheticObservation({ x: 0.5, y: 0.5 }, 0, 117), monotonicPixelOriginTime: 100 };
const context = {
  providerGeneration: hand.providerGeneration,
  cameraLeaseId: hand.cameraLeaseId,
  cameraFrameVersion: hand.cameraFrameVersion,
  mirrorTransform: hand.mirrorTransform,
  orientation: 0 as const,
};
const image = {
  ...context,
  observationVersion: 1,
  providerId: indexImageAlgorithm.providerId,
  providerVersion: indexImageAlgorithm.providerVersion,
  algorithmDigest: indexImageAlgorithm.algorithmDigest,
  frameWidth: 640,
  frameHeight: 480,
  sequence: 0,
  monotonicCaptureTime: 117,
  monotonicPixelOriginTime: 100,
  monotonicInferenceTime: 122,
  trackId: "pixel-origin-test-image",
  trackGeneration: 1,
  point: { x: 0.3, y: 0.7 },
  state: "TRACKING",
  modelAgreement: "UNAVAILABLE",
  anchorSource: "MODEL_INDEX",
  quality: { correlation: 0.95, separation: 0.2, texture: 20, forwardBackwardErrorPixels: 0.3 },
  uncertaintyRadiusPixels: 2,
  reason: "IMAGE_TRACK_CONFIRMED",
};

describe("known pixel origin remains separate from dispatch sampling", () => {
  it("preserves dispatch clocks while selecting the oldest known freshness clock", () => {
    expect(observationFreshnessTime({ monotonicCaptureTime: 117 })).toBe(117);
    expect(observationFreshnessTime(hand)).toBe(100);
    expect(hand.monotonicCaptureTime).toBe(117);
    expect(observationFreshnessTime({ monotonicCaptureTime: 117, monotonicPixelOriginTime: 122 })).toBe(117);
  });
  it.each([NaN, Infinity, -1, 123, null, "100"])("fails closed on a declared invalid origin %s", (origin) => {
    expect(observationFreshnessTime({ monotonicCaptureTime: 117, monotonicPixelOriginTime: origin as number })).toBe(
      -Infinity,
    );
  });
  it.each([NaN, Infinity, -1])("fails closed on an invalid dispatch clock %s", (capture) => {
    expect(observationFreshnessTime({ monotonicCaptureTime: capture })).toBe(-Infinity);
  });
  for (const kind of ["HAND", "IMAGE"] as const) {
    const freshGate = () => (kind === "HAND" ? new ObservationGate(context) : new IndexImageObservationGate(context));
    const packet = kind === "HAND" ? hand : image;
    it(`${kind} retains the exact 150ms known-origin bound without rewriting dispatch time`, () => {
      const accepted = freshGate().accept(packet, 250);
      expect(accepted.monotonicCaptureTime).toBe(117);
      expect(accepted.monotonicPixelOriginTime).toBe(100);
      expect(() => freshGate().accept(packet, 251)).toThrow("FRESHNESS");
    });
    it(`${kind} never consumes ordering or dimensions from source-old pixels`, () => {
      const gate = freshGate();
      expect(() => gate.accept({ ...packet, frameWidth: 1280, sequence: 900 }, 251)).toThrow("FRESHNESS");
      expect(gate.accept({ ...packet, monotonicPixelOriginTime: 110 }, 251)).toMatchObject({
        frameWidth: 640,
        sequence: 0,
        monotonicCaptureTime: 117,
      });
    });
    it.each([NaN, Infinity, -1, 123, null])(`${kind} rejects malformed/future declared origin %s`, (origin) => {
      const gate = freshGate();
      expect(() => gate.accept({ ...packet, monotonicPixelOriginTime: origin }, 122)).toThrow();
      expect(gate.accept(packet, 122).sequence).toBe(0);
    });
    it(`${kind} independently rejects an origin beyond the current 5ms future tolerance`, () => {
      expect(() =>
        freshGate().accept({ ...packet, monotonicInferenceTime: 117, monotonicPixelOriginTime: 122 }, 116),
      ).toThrow("FRESHNESS");
      expect(
        freshGate().accept({ ...packet, monotonicInferenceTime: 117, monotonicPixelOriginTime: 121 }, 116),
      ).toBeDefined();
    });
  }
});

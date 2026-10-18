// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { resolve } from "node:path";
import {
  IndexImageTracker,
  indexImageAlgorithm,
  indexImageAlgorithmDescriptor,
  type IndexGrayFrame,
} from "./index-image-tracker";
const binding = {
  providerGeneration: 3,
  cameraLeaseId: "image-test-camera",
  cameraFrameVersion: 1,
  frameWidth: 320,
  frameHeight: 240,
  mirrorTransform: "PREVIEW_X" as const,
};
const point = (x: number, y: number) => ({ x: x / 159, y: y / 119 });
function image(
  x: number,
  y: number,
  at: number,
  options: {
    width?: number;
    height?: number;
    blank?: boolean;
    repeated?: boolean;
    stripes?: boolean;
    unrelated?: boolean;
    brightness?: number;
  } = {},
): IndexGrayFrame {
  const width = options.width ?? 160,
    height = options.height ?? 120;
  const data = new Uint8Array(width * height).fill(30 + (options.brightness ?? 0));
  const draw = (cx: number, cy: number, seed = 0) => {
    for (let dy = -10; dy <= 10; ++dy)
      for (let dx = -10; dx <= 10; ++dx) {
        const xx = cx + dx,
          yy = cy + dy;
        if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue;
        const value = options.stripes
          ? 50 + ((dx + 10) % 4) * 35
          : 45 + ((dx * 73 + dy * 127 + dx * dy * 19 + seed * 41 + 100000) % 135);
        data[yy * width + xx] = value + (options.brightness ?? 0);
      }
  };
  if (!options.blank) draw(x, y, options.unrelated ? 19 : 0);
  if (options.repeated) draw(x + 20, y);
  return { data, width, height, capture: at, received: at + 15 };
}
function changedAppearance(amount: number, at: number, clone = false): IndexGrayFrame {
  const original = image(60, 60, at),
    changed = image(60, 60, at, { unrelated: true });
  for (let i = 0; i < original.data.length; ++i)
    original.data[i] = Math.round(original.data[i] * (1 - amount) + changed.data[i] * amount);
  if (clone) {
    const duplicate = image(80, 60, at);
    for (let y = 50; y <= 70; ++y)
      for (let x = 70; x <= 90; ++x) original.data[y * original.width + x] = duplicate.data[y * original.width + x];
  }
  return original;
}
function deformingImage(x: number, y: number, at: number, angle: number, amount: number): IndexGrayFrame {
  const data = new Uint8Array(160 * 120).fill(30),
    radians = (angle * Math.PI) / 180;
  const c = Math.cos(radians),
    s = Math.sin(radians);
  const tex = (u: number, v: number, seed: number) => 45 + ((u * 73 + v * 127 + u * v * 19 + seed * 41 + 100000) % 135);
  const sample = (u: number, v: number, seed: number) => {
    if (Math.abs(u) > 10 || Math.abs(v) > 10) return 30;
    const a = Math.floor(u),
      b = Math.floor(v),
      fx = u - a,
      fy = v - b;
    return (
      (tex(a, b, seed) * (1 - fx) + tex(a + 1, b, seed) * fx) * (1 - fy) +
      (tex(a, b + 1, seed) * (1 - fx) + tex(a + 1, b + 1, seed) * fx) * fy
    );
  };
  for (let dy = -14; dy <= 14; ++dy)
    for (let dx = -14; dx <= 14; ++dx) {
      const u = c * dx + s * dy,
        v = -s * dx + c * dy;
      data[(y + dy) * 160 + x + dx] = Math.round(sample(u, v, 0) * (1 - amount) + sample(u, v, 19) * amount);
    }
  return { data, width: 160, height: 120, capture: at, received: at + 5 };
}
describe("independent image fingertip evidence", () => {
  it("prepares pixels without keeping an identity alive or exposing an actionable observation", () => {
    const tracker = new IndexImageTracker(binding);
    tracker.update(image(60, 60, 100), null, point(60, 60));
    const token = tracker.prepare(image(62, 60, 200));
    expect(token).toEqual({ capture: 200 });
    expect(token).not.toHaveProperty("point");
    expect(() => tracker.prepare(image(64, 60, 233))).toThrow("ALREADY_PENDING");
    expect(tracker.discard({ capture: 200 })).toBe(false);
    expect(tracker.discard(token)).toBe(true);
    expect(() => tracker.complete(token, null, 215)).toThrow("PREPARED_CAPTURE_INVALID");
    expect(() => tracker.prepare(image(60, 60, 200))).toThrow("INVALID_OR_STALE");
    expect(tracker.update(image(60, 60, 1301))).toMatchObject({
      state: "LOST",
      trackId: null,
      reason: "MANUAL_SELECTION_REQUIRED",
    });
  });
  it("commits prepared pixels only with the same frame's full-hand decision", () => {
    const tracker = new IndexImageTracker(binding);
    const seed = tracker.update(image(60, 60, 100), null, point(60, 60));
    const pixels = image(62, 60, 133),
      token = tracker.prepare(pixels);
    pixels.data.fill(0); // Caller mutation cannot alter the owned prepared image.
    expect(tracker.complete(token, full("CONTRARY", 62, 60), 150)).toMatchObject({
      state: "UNCERTAIN",
      point: null,
      matchedPoint: point(62, 60),
      trackId: seed.trackId,
      reason: "FULL_HAND_CONTRARY_PENDING",
      monotonicCaptureTime: 133,
      monotonicInferenceTime: 150,
    });
    expect(() => tracker.complete(token, null, 155)).toThrow("PREPARED_CAPTURE_INVALID");
    expect(tracker.update(image(64, 60, 166))).toMatchObject({
      state: "TRACKING",
      trackId: seed.trackId,
      point: point(64, 60),
    });
  });
  it("rolls back all acceptance and authority clocks when finalization crosses the150ms boundary", () => {
    const tracker = new IndexImageTracker(binding);
    const seed = tracker.update(image(60, 60, 100), null, point(60, 60));
    expect(tracker.complete(tracker.prepare(image(62, 60, 200)), null, 350)).toMatchObject({
      point: point(62, 60),
      sequence: 1,
      trackId: seed.trackId,
    });
    const token = tracker.prepare(image(64, 60, 400));
    let call = 0;
    expect(() => tracker.complete(token, full("CONTRARY", 64, 60), () => (++call === 1 ? 500 : 551))).toThrow(
      "INVALID_OR_STALE",
    );
    expect(tracker.update(image(62, 60, 433))).toMatchObject({ state: "TRACKING", sequence: 2, trackId: seed.trackId });
    // A stale attempted seed must not create an identity visible afterward.
    const cold = new IndexImageTracker(binding),
      coldToken = cold.prepare(image(60, 60, 100), point(60, 60));
    let coldCall = 0;
    expect(() => cold.complete(coldToken, null, () => (++coldCall === 1 ? 110 : 251))).toThrow("INVALID_OR_STALE");
    expect(cold.update(image(60, 60, 133))).toMatchObject({ state: "UNSEEDED", trackId: null, sequence: 0 });
  });
  it("does not let a reset or expired source finalize an older prepared frame", () => {
    const tracker = new IndexImageTracker(binding);
    const token = tracker.prepare(image(60, 60, 100), point(60, 60));
    tracker.reset();
    expect(() => tracker.complete(token, null, 110)).toThrow("PREPARED_CAPTURE_INVALID");
    expect(() => tracker.prepare(image(60, 60, 100))).toThrow("INVALID_OR_STALE");
    const fresh = tracker.prepare(image(60, 60, 133), point(60, 60));
    expect(() => tracker.complete(fresh, null, 284)).toThrow("INVALID_OR_STALE");
    expect(tracker.update(image(60, 60, 166))).toMatchObject({ state: "UNSEEDED", trackId: null });
  });
  it("supports a long changing pose only through tight source-scoped full-hand confirmation, without coordinate rebinding", () => {
    const tracker = new IndexImageTracker(binding);
    const seed = tracker.update(deformingImage(60, 60, 100, 0, 0), null, point(60, 60));
    for (let i = 1; i <= 65; ++i) {
      const x = 60 + Math.round(Math.sin(i / 12) * 6),
        y = 60 + Math.round(Math.cos(i / 12) * 3) - 3;
      const observed = tracker.update(
        deformingImage(x, y, 100 + i * 80, i * 0.3, Math.min(0.85, i * 0.018)),
        full("POINT", x, y),
      );
      expect(observed).toMatchObject({ state: "TRACKING", point: point(x, y), trackId: seed.trackId });
    }
  });
  for (const condition of [
    "UNAVAILABLE",
    "WRONG",
    "WEAK",
    "SOURCE",
    "CONTRARY",
    "AMBIGUOUS",
    "ONE_TIGHT_FRAME",
  ] as const)
    it(`does not renew unsupported appearance from ${condition} evidence`, () => {
      const tracker = new IndexImageTracker(binding);
      const seed = tracker.update(deformingImage(60, 60, 100, 0, 0), null, point(60, 60));
      let observed = seed;
      for (let i = 1; i <= 40; ++i) {
        const x = 60 + Math.round(Math.sin(i / 12) * 6),
          y = 60 + Math.round(Math.cos(i / 12) * 3) - 3;
        const offset =
          condition === "WRONG" ? 12 : condition === "WEAK" || (condition === "ONE_TIGHT_FRAME" && i !== 28) ? 5 : 0;
        const model =
          condition === "UNAVAILABLE"
            ? undefined
            : condition === "AMBIGUOUS"
              ? { point: null, pointing: false, contrary: false, authority: "AMBIGUOUS" as const }
              : full(
                  condition === "CONTRARY" ? "CONTRARY" : "POINT",
                  x + offset,
                  y,
                  condition === "SOURCE" ? `source-${i}` : "full-model-A",
                );
        observed = tracker.update(deformingImage(x, y, 100 + i * 80, i * 0.3, Math.min(0.85, i * 0.018)), model);
      }
      expect(observed).toMatchObject({ point: null, trackId: seed.trackId, reason: "IMAGE_REFERENCE_EXPIRED" });
    });
  for (const interruption of ["MISSING", "NEGATIVE", "AMBIGUOUS", "BAD_IMAGE"] as const)
    it(`clears tight appearance-refresh evidence on intermittent ${interruption}`, () => {
      const tracker = new IndexImageTracker(binding);
      const seed = tracker.update(deformingImage(60, 60, 100, 0, 0), null, point(60, 60));
      let observed = seed;
      for (let i = 1; i <= 40; ++i) {
        const interrupt = i % 3 === 0;
        const model =
          interrupt && interruption === "MISSING"
            ? undefined
            : interrupt && interruption === "AMBIGUOUS"
              ? { point: null, pointing: false, contrary: false, authority: "AMBIGUOUS" as const }
              : full(interrupt && interruption === "NEGATIVE" ? "CONTRARY" : "POINT", 60, 60);
        const frame =
          interrupt && interruption === "BAD_IMAGE"
            ? image(60, 60, 100 + i * 80, { blank: true })
            : deformingImage(60, 60, 100 + i * 80, i * 0.3, Math.min(0.85, i * 0.018));
        observed = tracker.update(frame, model);
      }
      expect(observed).toMatchObject({ point: null, trackId: seed.trackId, reason: "IMAGE_REFERENCE_EXPIRED" });
    });
  it("does not collect reference support across model evidence gaps above250ms", () => {
    const tracker = new IndexImageTracker(binding);
    const seed = tracker.update(deformingImage(60, 60, 100, 0, 0), null, point(60, 60));
    let expired = false;
    for (let i = 1; i <= 40; ++i) {
      const observed = tracker.update(
        deformingImage(60, 60, 100 + i * 300, i * 0.3, Math.min(0.85, i * 0.018)),
        full("POINT", 60, 60),
      );
      if (observed.reason === "IMAGE_REFERENCE_EXPIRED") {
        expect(observed).toMatchObject({ point: null, trackId: seed.trackId });
        expired = true;
        break;
      }
    }
    expect(expired).toBe(true);
  });
  it("prevents cumulative walk on a fractionally resampled public photograph trajectory and return to center", async () => {
    const decoded = await sharp(resolve("tests/e2e/fixtures/reach/pointing_up.jpg"))
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const { width: w, height: h, channels } = decoded.info;
    const gray = new Float32Array(w * h);
    for (let i = 0; i < gray.length; ++i)
      gray[i] =
        (77 * decoded.data[i * channels] + 150 * decoded.data[i * channels + 1] + 29 * decoded.data[i * channels + 2]) /
        256;
    const background = (77 * 199 + 150 * 199 + 29 * 191) / 256;
    const frame = (dx: number, dy: number, at: number, draw: number): IndexGrayFrame => {
      const data = new Uint8Array(320 * 240),
        left = 180 + dx + Math.sin(draw * 1.7) * 0.7,
        top = 50 + dy;
      const pixel = (x: number, y: number) => {
        if (x + 0.5 < left || x + 0.5 >= left + 260 || y + 0.5 < top || y + 0.5 >= top + 350) return background;
        const u = Math.max(0, Math.min(w - 1, ((x + 0.5 - left) * w) / 260 - 0.5));
        const v = Math.max(0, Math.min(h - 1, ((y + 0.5 - top) * h) / 350 - 0.5));
        const x0 = Math.floor(u),
          y0 = Math.floor(v),
          x1 = Math.min(w - 1, x0 + 1),
          y1 = Math.min(h - 1, y0 + 1),
          fx = u - x0,
          fy = v - y0;
        return (
          (gray[y0 * w + x0] * (1 - fx) + gray[y0 * w + x1] * fx) * (1 - fy) +
          (gray[y1 * w + x0] * (1 - fx) + gray[y1 * w + x1] * fx) * fy
        );
      };
      for (let y = 0; y < 240; ++y)
        for (let x = 0; x < 320; ++x)
          data[y * 320 + x] = Math.round(
            (pixel(2 * x, 2 * y) + pixel(2 * x + 1, 2 * y) + pixel(2 * x, 2 * y + 1) + pixel(2 * x + 1, 2 * y + 1)) / 4,
          );
      return { data, width: 320, height: 240, capture: at, received: at + 10 };
    };
    const tracker = new IndexImageTracker({ ...binding, frameWidth: 640, frameHeight: 480 });
    const supported = new IndexImageTracker({ ...binding, frameWidth: 640, frameHeight: 480 });
    const modelAt = (dx: number, dy: number) => ({
      point: { x: (153 + dx / 2) / 319, y: (59 + dy / 2) / 239 },
      pointing: true,
      contrary: false,
      authority: "POINT" as const,
      authoritySource: "photographic-full-point",
    });
    let at = 100,
      draw = 0,
      dx = -40,
      dy = 30;
    const seed = tracker.update(frame(dx, dy, at, draw++), null, { x: 133 / 319, y: 74 / 239 });
    const supportedSeed = supported.update(frame(dx, dy, at, draw - 1), modelAt(dx, dy), { x: 133 / 319, y: 74 / 239 });
    // Includes training positions, independent locations, and a closed loop.
    for (const [goalX, goalY] of [
      [0, 0],
      [-64, 0],
      [64, 0],
      [0, -48],
      [0, 48],
      [-40, 30],
      [-40, -30],
      [40, 30],
      [40, -30],
      [0, -24],
      [0, 0],
    ]) {
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(goalX - dx), Math.abs(goalY - dy)) / 8));
      const start = { x: dx, y: dy };
      let observed = seed;
      let observedSupported = supportedSeed;
      for (let elapsed = 50; elapsed <= steps * 40 + 1400; elapsed += 50) {
        const progress = Math.min(steps, Math.floor(elapsed / 40)) / steps;
        dx = start.x + (goalX - start.x) * progress;
        dy = start.y + (goalY - start.y) * progress;
        const pixels = frame(dx, dy, (at += 50), draw++);
        observed = tracker.update(pixels);
        observedSupported = supported.update(pixels, modelAt(dx, dy));
      }
      expect(observed).toMatchObject({ state: "TRACKING", trackId: seed.trackId });
      expect(observedSupported).toMatchObject({ state: "TRACKING", trackId: supportedSeed.trackId });
      expect(
        Math.hypot(observed.point!.x * 319 - (153 + goalX / 2), observed.point!.y * 239 - (59 + goalY / 2)),
      ).toBeLessThanOrEqual(1.5);
      expect(
        Math.hypot(
          observedSupported.point!.x * 319 - (153 + goalX / 2),
          observedSupported.point!.y * 239 - (59 + goalY / 2),
        ),
      ).toBeLessThanOrEqual(1.5);
    }
  }, 20000);
  it("permits bounded model-free pose adaptation but does not let adaptive-only evidence walk indefinitely", () => {
    const tracker = new IndexImageTracker(binding);
    const lateSupport = new IndexImageTracker(binding);
    const seed = tracker.update(changedAppearance(0, 100), null, point(60, 60));
    const lateSeed = lateSupport.update(changedAppearance(0, 100), null, point(60, 60));
    let observed = seed;
    let lastReferenceAt = 100;
    for (let i = 1; i <= 30; ++i) {
      const at = 100 + i * 10;
      // A fresh seed's first comparison has identical reference/adaptive
      // templates, independently identifying the final supported reference.
      const referenceProbe = new IndexImageTracker(binding);
      referenceProbe.update(changedAppearance(0, 100), null, point(60, 60));
      if (referenceProbe.update(changedAppearance(i * 0.03, at)).point) lastReferenceAt = at;
      observed = tracker.update(changedAppearance(i * 0.03, at));
      lateSupport.update(changedAppearance(i * 0.03, at));
    }
    expect(observed).toMatchObject({ state: "TRACKING", trackId: seed.trackId, point: point(60, 60) });
    const direct = new IndexImageTracker(binding);
    direct.update(changedAppearance(0, 100), null, point(60, 60));
    expect(direct.update(changedAppearance(0.9, 133)).point).toBeNull();
    // Even three tightly agreeing full-hand frames cannot revive unsupported
    // reference age when their confirming third frame arrives at1201ms.
    lateSupport.update(changedAppearance(0.9, lastReferenceAt + 1000), full("POINT", 60, 60));
    lateSupport.update(changedAppearance(0.9, lastReferenceAt + 1100), full("POINT", 60, 60));
    expect(lateSupport.update(changedAppearance(0.9, lastReferenceAt + 1201), full("POINT", 60, 60))).toMatchObject({
      point: null,
      trackId: lateSeed.trackId,
      reason: "IMAGE_REFERENCE_EXPIRED",
    });
    expect(tracker.update(changedAppearance(0.9, lastReferenceAt + 1200))).toMatchObject({
      state: "TRACKING",
      trackId: seed.trackId,
    });
    observed = tracker.update(changedAppearance(0.9, lastReferenceAt + 1201));
    expect(observed).toMatchObject({ point: null, reason: "IMAGE_REFERENCE_EXPIRED", trackId: seed.trackId });
    // An accepted adaptive frame at the boundary did not renew reference age.
    expect(tracker.update(changedAppearance(0.9, lastReferenceAt + 1202))).toMatchObject({
      point: null,
      reason: "IMAGE_REFERENCE_EXPIRED",
    });
    expect(tracker.update(changedAppearance(0, lastReferenceAt + 1203))).toMatchObject({
      state: "TRACKING",
      point: point(60, 60),
      trackId: seed.trackId,
    });
  });
  it("abstains when an original-appearance clone disagrees with the strong adaptive identity", () => {
    const tracker = new IndexImageTracker(binding);
    const seed = tracker.update(changedAppearance(0, 100), null, point(60, 60));
    for (let i = 1; i <= 10; ++i)
      expect(tracker.update(changedAppearance(i * 0.03, 100 + i * 33), full("POINT", 60, 60)).state).toBe("TRACKING");
    expect(tracker.update(changedAppearance(0.3, 463, true), full("POINT", 60, 60))).toMatchObject({
      state: "UNCERTAIN",
      point: null,
      matchedPoint: null,
      reason: "IMAGE_REFERENCE_CONFLICT",
      trackId: seed.trackId,
    });
    expect(tracker.update(changedAppearance(0.3, 496))).toMatchObject({
      state: "TRACKING",
      point: point(60, 60),
      trackId: seed.trackId,
    });
  });
  it("binds algorithm identity to the explicit policy descriptor, rather than ML weights or confidence", () => {
    expect(createHash("sha256").update(JSON.stringify(indexImageAlgorithmDescriptor)).digest("hex")).toBe(
      indexImageAlgorithm.algorithmDigest,
    );
  });
  it("tracks actual appearance without a hand result or hidden landmarks", () => {
    const tracker = new IndexImageTracker(binding);
    const initial = tracker.update(image(60, 60, 100), { point: point(60, 60), pointing: true, contrary: false });
    expect(initial).toMatchObject({ state: "TRACKING", anchorSource: "MODEL_INDEX" });
    for (let i = 1; i <= 12; ++i) {
      const next = tracker.update(image(60 + i * 2, 60 + i, 100 + i * 33));
      expect(next).toMatchObject({
        state: "TRACKING",
        trackId: initial.trackId,
        trackGeneration: initial.trackGeneration,
        modelAgreement: "UNAVAILABLE",
      });
      expect(next.point!.x).toBeCloseTo(point(60 + i * 2, 60 + i).x);
      expect(next.point!.y).toBeCloseTo(point(60 + i * 2, 60 + i).y);
      expect(next.quality.forwardBackwardErrorPixels).toBeLessThanOrEqual(4);
      expect(next.monotonicCaptureTime).toBe(100 + i * 33);
      expect(next).not.toHaveProperty("landmarks");
      expect(next).not.toHaveProperty("data");
    }
  });
  it("supports an explicit cold fingertip hint without a model", () => {
    const tracker = new IndexImageTracker(binding);
    expect(tracker.update(image(60, 60, 100)).state).toBe("UNSEEDED");
    expect(tracker.update(image(60, 60, 133), null, point(60, 60))).toMatchObject({
      state: "TRACKING",
      anchorSource: "MANUAL_HINT",
    });
  });
  it("never replaces a rejected manual selection with an automatic model digit", () => {
    const tracker = new IndexImageTracker(binding);
    expect(tracker.update(image(60, 60, 100, { blank: true }), null, point(60, 60))).toMatchObject({
      state: "UNSEEDED",
      anchorSource: null,
      point: null,
      trackId: null,
      reason: "ANCHOR_TEXTURE_OR_EDGE_UNSUITABLE",
    });
    const wrongDigit = { point: point(95, 80), pointing: true, contrary: false };
    for (const at of [133, 166, 1500])
      expect(tracker.update(image(95, 80, at), wrongDigit)).toMatchObject({
        state: "UNSEEDED",
        reason: "MANUAL_SELECTION_REQUIRED",
        point: null,
        trackId: null,
        anchorSource: null,
      });
    // Another deliberate selection can establish a new manual image track.
    expect(tracker.update(image(60, 60, 1533), null, point(60, 60))).toMatchObject({
      state: "TRACKING",
      anchorSource: "MANUAL_HINT",
      point: point(60, 60),
    });
  });
  it("keeps manual intent after image expiry and requires explicit reset before automatic model seeding", () => {
    const tracker = new IndexImageTracker(binding);
    const first = tracker.update(image(60, 60, 100), null, point(60, 60));
    const wrongDigit = { point: point(95, 80), pointing: true, contrary: false };
    expect(tracker.update(image(95, 80, 1301), wrongDigit)).toMatchObject({
      state: "LOST",
      reason: "MANUAL_SELECTION_REQUIRED",
      point: null,
      matchedPoint: null,
      trackId: null,
      trackGeneration: 0,
      anchorSource: null,
    });
    expect(tracker.update(image(95, 80, 1334), wrongDigit)).toMatchObject({
      state: "UNSEEDED",
      reason: "MANUAL_SELECTION_REQUIRED",
      point: null,
      trackId: null,
    });
    tracker.reset();
    const automatic = tracker.update(image(95, 80, 1367), wrongDigit);
    expect(automatic).toMatchObject({ state: "TRACKING", anchorSource: "MODEL_INDEX", point: point(95, 80) });
    expect(automatic.trackId).not.toBe(first.trackId);
  });
  it("retains explicit manual intent when a prepared selection is rejected at final freshness", () => {
    const tracker = new IndexImageTracker(binding);
    const token = tracker.prepare(image(60, 60, 100), point(60, 60));
    expect(() => tracker.complete(token, null, 251)).toThrow("FRAME_INVALID_OR_STALE");
    expect(tracker.update(image(95, 80, 300), { point: point(95, 80), pointing: true, contrary: false })).toMatchObject(
      {
        state: "UNSEEDED",
        reason: "MANUAL_SELECTION_REQUIRED",
        point: null,
        anchorSource: null,
      },
    );
  });
  it("can latch selection intent before a usable capture without creating or reusing coordinates", () => {
    const tracker = new IndexImageTracker(binding);
    tracker.requestManualSelection();
    expect(tracker.update(image(95, 80, 100), { point: point(95, 80), pointing: true, contrary: false })).toMatchObject(
      {
        state: "UNSEEDED",
        reason: "MANUAL_SELECTION_REQUIRED",
        point: null,
        trackId: null,
      },
    );
  });
  it("ignores a wrong model digit rather than moving the image track", () => {
    const tracker = new IndexImageTracker(binding);
    const first = tracker.update(image(60, 60, 100), null, point(60, 60));
    const wrong = tracker.update(image(62, 61, 133), { point: point(84, 80), pointing: true, contrary: true });
    expect(wrong).toMatchObject({
      state: "TRACKING",
      trackId: first.trackId,
      modelAgreement: "DISAGREE",
      reason: "MODEL_DISAGREES_IMAGE_RETAINED",
    });
    expect(wrong.point).toEqual(point(62, 61));
    const noModel = tracker.update(image(64, 62, 166));
    expect(noModel.point).toEqual(point(64, 62));
  });
  it("pauses for a coherent observed open-hand contradiction until coherent pointing returns", () => {
    const tracker = new IndexImageTracker(binding);
    const first = tracker.update(image(60, 60, 100), null, point(60, 60));
    expect(tracker.update(image(61, 60, 133), { point: point(61, 60), pointing: false, contrary: true })).toMatchObject(
      { state: "UNCERTAIN", point: null, reason: "COHERENT_MODEL_CONTRARY" },
    );
    expect(tracker.update(image(62, 60, 166))).toMatchObject({ state: "UNCERTAIN", point: null });
    expect(tracker.update(image(63, 60, 199), { point: point(63, 60), pointing: true, contrary: false })).toMatchObject(
      { state: "TRACKING", trackId: first.trackId },
    );
  });
  const full = (kind: "POINT" | "CONTRARY", x: number, y: number, authoritySource = "full-model-A") => ({
    point: point(x, y),
    pointing: kind === "POINT",
    contrary: kind === "CONTRARY",
    authority: kind,
    authoritySource,
  });
  const confirmNegative = (tracker: IndexImageTracker) => {
    for (const at of [133, 193, 253]) tracker.update(image(60, 60, at), full("CONTRARY", 60, 60));
  };
  it("promotes compatible whole-hand pointing after three fresh frames and120ms without replacing image coordinates", () => {
    const tracker = new IndexImageTracker(binding);
    const first = tracker.update(image(60, 60, 100), null, point(60, 60));
    for (const [i, at] of [133, 193, 253].entries()) {
      const x = 62 + i * 2;
      expect(tracker.update(image(x, 61, at), full("POINT", x + 2, 62))).toMatchObject({
        state: "TRACKING",
        reason: i === 2 ? "FULL_HAND_POINT_CONFIRMED" : "FULL_HAND_POINT_PENDING",
        point: point(x, 61),
        matchedPoint: point(x, 61),
        trackId: first.trackId,
        modelAgreement: "AGREE",
      });
    }
  });
  it("does not confuse three fast frames with the required120ms span", () => {
    const tracker = new IndexImageTracker(binding);
    tracker.update(image(60, 60, 100), null, point(60, 60));
    for (const at of [133, 153, 173])
      expect(tracker.update(image(60, 60, at), full("CONTRARY", 60, 60))).toMatchObject({
        state: "UNCERTAIN",
        point: null,
        matchedPoint: point(60, 60),
        reason: "FULL_HAND_CONTRARY_PENDING",
      });
    expect(tracker.update(image(60, 60, 253), full("CONTRARY", 60, 60)).reason).toBe("FULL_HAND_CONTRARY_CONFIRMED");
    expect(tracker.update(image(61, 60, 286))).toMatchObject({
      state: "UNCERTAIN",
      point: null,
      reason: "FULL_HAND_CONTRARY_AWAITING_POINT",
    });
  });
  it("clears a previous automatic coordinate before a manual selection that later fails freshness", () => {
    const tracker = new IndexImageTracker(binding);
    expect(tracker.update(image(95, 80, 100), { point: point(95, 80), pointing: true, contrary: false }).state).toBe(
      "TRACKING",
    );
    const token = tracker.prepare(image(60, 60, 133), point(60, 60));
    expect(() => tracker.complete(token, null, 284)).toThrow("FRAME_INVALID_OR_STALE");
    expect(tracker.update(image(95, 80, 300), { point: point(95, 80), pointing: true, contrary: false })).toMatchObject(
      {
        state: "UNSEEDED",
        reason: "MANUAL_SELECTION_REQUIRED",
        anchorSource: null,
        trackId: null,
        trackGeneration: 0,
        point: null,
        matchedPoint: null,
      },
    );
  });
  it("pauses a single compatible contrary immediately but resumes afterNONE without a false latch", () => {
    const tracker = new IndexImageTracker(binding);
    const first = tracker.update(image(60, 60, 100), null, point(60, 60));
    expect(tracker.update(image(62, 60, 133), full("CONTRARY", 62, 60))).toMatchObject({
      state: "UNCERTAIN",
      reason: "FULL_HAND_CONTRARY_PENDING",
      point: null,
      matchedPoint: point(62, 60),
      trackId: first.trackId,
    });
    expect(tracker.update(image(64, 60, 166))).toMatchObject({
      state: "TRACKING",
      point: point(64, 60),
      trackId: first.trackId,
    });
  });
  it("does not latch a wrong-digit contrary that disagrees with accepted image evidence", () => {
    const tracker = new IndexImageTracker(binding);
    const first = tracker.update(image(60, 60, 100), null, point(60, 60));
    for (const [i, at] of [133, 193, 253].entries())
      expect(tracker.update(image(62 + i, 60, at), full("CONTRARY", 95, 80))).toMatchObject({
        state: "UNCERTAIN",
        reason: "FULL_HAND_INDEX_CONFLICT",
        point: null,
        matchedPoint: point(62 + i, 60),
        trackId: first.trackId,
      });
    expect(tracker.update(image(66, 60, 286))).toMatchObject({
      state: "TRACKING",
      point: point(66, 60),
      trackId: first.trackId,
    });
  });
  it("retains a confirmed negative throughNONE until a compatible positive is temporally confirmed", () => {
    const tracker = new IndexImageTracker(binding);
    const first = tracker.update(image(60, 60, 100), null, point(60, 60));
    confirmNegative(tracker);
    expect(tracker.update(image(61, 60, 286))).toMatchObject({
      state: "UNCERTAIN",
      point: null,
      matchedPoint: point(61, 60),
      reason: "FULL_HAND_CONTRARY_AWAITING_POINT",
    });
    for (const [i, at] of [319, 379, 439].entries()) {
      const x = 62 + i;
      expect(tracker.update(image(x, 60, at), full("POINT", x, 60))).toMatchObject({
        state: i === 2 ? "TRACKING" : "UNCERTAIN",
        point: i === 2 ? point(x, 60) : null,
        matchedPoint: point(x, 60),
        reason: i === 2 ? "FULL_HAND_POINT_CONFIRMED" : "FULL_HAND_POINT_PENDING",
        trackId: first.trackId,
      });
    }
  });
  it.each(["CONTRARY", "AMBIGUOUS", "POINT"] as const)(
    "manual hints cannot bypass available%s authority or clear a confirmed negative",
    (authority) => {
      const tracker = new IndexImageTracker(binding);
      tracker.update(image(60, 60, 100), null, point(60, 60));
      confirmNegative(tracker);
      const anchor = {
        point: authority === "CONTRARY" ? point(62, 60) : point(95, 80),
        pointing: authority === "POINT",
        contrary: authority === "CONTRARY",
        authority,
        authoritySource: "full-model-A",
      };
      const selected = tracker.update(image(62, 60, 286), anchor, point(62, 60));
      expect(selected.state).toBe("UNCERTAIN");
      expect(selected.point).toBeNull();
      expect(selected.matchedPoint).toEqual(point(62, 60));
      expect(tracker.update(image(64, 60, 319))).toMatchObject({
        state: "UNCERTAIN",
        point: null,
        trackId: selected.trackId,
        reason: "FULL_HAND_CONTRARY_AWAITING_POINT",
      });
    },
  );
  it("allows a deliberate new hint to clear a confirmed negative only when whole-hand authority is unavailable", () => {
    const tracker = new IndexImageTracker(binding);
    const first = tracker.update(image(60, 60, 100), null, point(60, 60));
    confirmNegative(tracker);
    const selected = tracker.update(image(62, 60, 286), null, point(62, 60));
    expect(selected).toMatchObject({ state: "TRACKING", point: point(62, 60), anchorSource: "MANUAL_HINT" });
    expect(selected.trackId).not.toBe(first.trackId);
  });
  it.each([null, { x: NaN, y: 0 }, point(95, 80)])(
    "a contrary missing or incompatible tip cannot latch through manual seeding:%o",
    (tip) => {
      const tracker = new IndexImageTracker(binding);
      expect(
        tracker.update(
          image(60, 60, 100),
          { point: tip, pointing: false, contrary: true, authority: "CONTRARY", authoritySource: "full-model-A" },
          point(60, 60),
        ),
      ).toMatchObject({
        state: "UNCERTAIN",
        point: null,
        matchedPoint: point(60, 60),
        reason: "FULL_HAND_INDEX_CONFLICT",
      });
      expect(tracker.update(image(62, 60, 133)).state).toBe("TRACKING");
    },
  );
  it("never accumulates temporal evidence across distinct model tracks or missing source keys", () => {
    for (const sources of [
      ["model-A", "model-B", "model-A"],
      ["model-A", " model-A", "model-A"],
      ["", "", ""],
    ]) {
      const tracker = new IndexImageTracker(binding);
      tracker.update(image(60, 60, 100), null, point(60, 60));
      for (const [i, at] of [133, 193, 253].entries())
        expect(tracker.update(image(60, 60, at), full("CONTRARY", 60, 60, sources[i])).reason).toBe(
          "FULL_HAND_CONTRARY_PENDING",
        );
      expect(tracker.update(image(62, 60, 286)).state).toBe("TRACKING");
    }
  });
  it("restarts confirmation after a gap exceeding250ms while preserving optical identity", () => {
    const tracker = new IndexImageTracker(binding);
    const first = tracker.update(image(60, 60, 100), null, point(60, 60));
    for (const at of [133, 193, 494, 554])
      expect(tracker.update(image(60, 60, at), full("CONTRARY", 60, 60))).toMatchObject({
        reason: "FULL_HAND_CONTRARY_PENDING",
        trackId: first.trackId,
      });
    expect(tracker.update(image(60, 60, 614), full("CONTRARY", 60, 60)).reason).toBe("FULL_HAND_CONTRARY_CONFIRMED");
  });
  it("does not let rejected image evidence advance or retain a gesture candidate", () => {
    const tracker = new IndexImageTracker(binding);
    tracker.update(image(60, 60, 100), null, point(60, 60));
    for (const at of [133, 193]) tracker.update(image(60, 60, at), full("CONTRARY", 60, 60));
    expect(tracker.update(image(60, 60, 223, { blank: true }), full("CONTRARY", 60, 60))).toMatchObject({
      reason: "APPEARANCE_MISMATCH",
      matchedPoint: null,
      point: null,
    });
    for (const at of [253, 313])
      expect(tracker.update(image(60, 60, at), full("CONTRARY", 60, 60)).reason).toBe("FULL_HAND_CONTRARY_PENDING");
    expect(tracker.update(image(62, 60, 346)).state).toBe("TRACKING");
  });
  it.each(["UNAVAILABLE", "AMBIGUOUS", "CONFLICT"] as const)(
    "resets promotion evidence across%s without erasing the accepted image source",
    (interruption) => {
      const tracker = new IndexImageTracker(binding);
      const first = tracker.update(image(60, 60, 100), null, point(60, 60));
      for (const at of [133, 193]) tracker.update(image(60, 60, at), full("CONTRARY", 60, 60));
      const model =
        interruption === "UNAVAILABLE"
          ? null
          : interruption === "AMBIGUOUS"
            ? { point: null, pointing: false, contrary: false, authority: "AMBIGUOUS" as const }
            : full("POINT", 95, 80);
      tracker.update(image(60, 60, 223), model);
      for (const at of [253, 313])
        expect(tracker.update(image(60, 60, at), full("CONTRARY", 60, 60))).toMatchObject({
          reason: "FULL_HAND_CONTRARY_PENDING",
          trackId: first.trackId,
        });
      expect(tracker.update(image(62, 60, 346)).state).toBe("TRACKING");
    },
  );
  it("pauses whole-hand ambiguity without inventing a tip and resumes the same source after it clears", () => {
    const tracker = new IndexImageTracker(binding);
    const first = tracker.update(image(60, 60, 100), null, point(60, 60));
    expect(
      tracker.update(image(62, 60, 133), { point: null, pointing: false, contrary: false, authority: "AMBIGUOUS" }),
    ).toMatchObject({
      state: "UNCERTAIN",
      reason: "FULL_HAND_AMBIGUOUS",
      point: null,
      matchedPoint: point(62, 60),
      trackId: first.trackId,
    });
    expect(tracker.update(image(64, 60, 166))).toMatchObject({
      state: "TRACKING",
      point: point(64, 60),
      trackId: first.trackId,
    });
  });
  it("requires current optical evidence despite a positive full model", () => {
    const tracker = new IndexImageTracker(binding);
    const first = tracker.update(image(60, 60, 100), null, point(60, 60));
    expect(tracker.update(image(62, 60, 133, { blank: true }), full("POINT", 62, 60))).toMatchObject({
      state: "UNCERTAIN",
      point: null,
      matchedPoint: null,
      trackId: first.trackId,
    });
  });
  it.each([10, 20, 30])(
    "keeps source and image coordinates continuous through repeated brief authority transitions at%ifps",
    (fps) => {
      const tracker = new IndexImageTracker(binding);
      const first = tracker.update(image(40, 50, 100), null, point(40, 50));
      for (let i = 1; i <= 30; ++i) {
        const x = 40 + Math.min(i, 30 - i) * 2,
          y = 50 + (i % 3),
          phase = i % 10;
        const model =
          phase === 3
            ? full("CONTRARY", x, y)
            : phase === 6
              ? { point: null, pointing: false, contrary: false, authority: "AMBIGUOUS" as const }
              : phase === 7
                ? full("POINT", x + 25, y + 20)
                : phase === 4
                  ? null
                  : full("POINT", x, y);
        const result = tracker.update(image(x, y, 100 + (i * 1000) / fps), model);
        expect(result.trackId).toBe(first.trackId);
        expect(result.matchedPoint).toEqual(point(x, y));
        if ([3, 6, 7].includes(phase)) expect(result.point).toBeNull();
        else expect(result).toMatchObject({ state: "TRACKING", point: point(x, y) });
      }
    },
  );
  it("abstains throughout full image occlusion and recovers only a matching recent patch", () => {
    const tracker = new IndexImageTracker(binding);
    const first = tracker.update(image(60, 60, 100), null, point(60, 60));
    expect(tracker.update(image(60, 60, 133, { blank: true }))).toMatchObject({ state: "UNCERTAIN", point: null });
    expect(tracker.update(image(60, 60, 166, { blank: true }))).toMatchObject({ state: "LOST", point: null });
    expect(tracker.update(image(62, 61, 199))).toMatchObject({ state: "TRACKING", trackId: first.trackId });
  });
  it("does not extend old image identity across long loss or blindly reanchor to a later model", () => {
    const tracker = new IndexImageTracker(binding);
    const first = tracker.update(image(60, 60, 100), null, point(60, 60));
    expect(tracker.update(image(60, 60, 1400))).toMatchObject({ state: "LOST", point: null });
    const reseeded = tracker.update(image(60, 60, 1433), { point: point(60, 60), pointing: true, contrary: false });
    expect(reseeded).toMatchObject({
      state: "UNSEEDED",
      point: null,
      trackId: null,
      reason: "MANUAL_SELECTION_REQUIRED",
    });
    const selected = tracker.update(image(60, 60, 1466), null, point(60, 60));
    expect(selected.state).toBe("TRACKING");
    expect(selected.trackId).not.toBe(first.trackId);
  });
  it.each([200, 500, 1000])(
    "recovers a recent appearance after %ims occlusion without claiming any occluded point",
    (gap) => {
      const tracker = new IndexImageTracker(binding);
      const first = tracker.update(image(60, 60, 100), null, point(60, 60));
      for (let at = 133; at < 100 + gap; at += 33)
        expect(tracker.update(image(60, 60, at, { blank: true })).point).toBeNull();
      expect(tracker.update(image(64, 62, 100 + gap))).toMatchObject({
        state: "TRACKING",
        trackId: first.trackId,
        point: point(64, 62),
      });
    },
  );
  it.each([10, 20, 30])(
    "keeps one image identity through repeated moving model/image-only/return cycles at %ifps",
    (fps) => {
      const tracker = new IndexImageTracker(binding);
      const first = tracker.update(image(40, 50, 100), { point: point(40, 50), pointing: true, contrary: false });
      for (let i = 1; i <= 24; ++i) {
        const x = 40 + Math.min(i, 24 - i) * 2,
          y = 50 + (i % 3);
        const correct = { point: point(x, y), pointing: true, contrary: false };
        const wrong = { point: point(x + 22, y + 18), pointing: true, contrary: true };
        const model = i % 6 < 2 ? correct : i % 6 === 4 ? wrong : null;
        const result = tracker.update(image(x, y, 100 + (i * 1000) / fps), model);
        expect(result).toMatchObject({ state: "TRACKING", trackId: first.trackId, point: point(x, y) });
        expect(result.modelAgreement).toBe(model === wrong ? "DISAGREE" : model ? "AGREE" : "UNAVAILABLE");
      }
    },
  );
  it.each([{ blank: true }, { stripes: true }, { repeated: true }])(
    "does not seed ambiguous or texture-poor appearances %o",
    (options) => {
      expect(new IndexImageTracker(binding).update(image(60, 60, 100, options), null, point(60, 60))).toMatchObject({
        state: "UNSEEDED",
        point: null,
      });
    },
  );
  it("abstains when two indistinguishable patches appear near a crossing", () => {
    const tracker = new IndexImageTracker(binding);
    tracker.update(image(60, 60, 100), null, point(60, 60));
    expect(tracker.update(image(61, 60, 133, { repeated: true }))).toMatchObject({
      state: "UNCERTAIN",
      point: null,
      reason: "APPEARANCE_AMBIGUOUS",
    });
  });
  it("rejects unrelated imagery and jumps beyond the bounded image search", () => {
    for (const input of [image(60, 60, 133, { unrelated: true }), image(110, 60, 133)]) {
      const tracker = new IndexImageTracker(binding);
      tracker.update(image(60, 60, 100), null, point(60, 60));
      expect(tracker.update(input).point).toBeNull();
    }
  });
  it("allows a modest photometric offset while retaining spatial evidence", () => {
    const tracker = new IndexImageTracker(binding);
    tracker.update(image(60, 60, 100), null, point(60, 60));
    expect(tracker.update(image(62, 60, 133, { brightness: 20 }))).toMatchObject({
      state: "TRACKING",
      point: point(62, 60),
    });
  });
  it("requires a new anchor after grid changes and rejects replay/stale clocks", () => {
    const tracker = new IndexImageTracker(binding);
    tracker.update(image(60, 60, 100), null, point(60, 60));
    expect(() => tracker.update(image(60, 60, 100))).toThrow("INDEX_IMAGE_FRAME_INVALID_OR_STALE");
    expect(() => tracker.update({ ...image(60, 60, 133), received: 300 })).toThrow(
      "INDEX_IMAGE_FRAME_INVALID_OR_STALE",
    );
    const grid = { data: new Uint8Array(180 * 120), width: 180, height: 120, capture: 166, received: 180 };
    expect(tracker.update(grid)).toMatchObject({ state: "LOST", point: null, reason: "FRAME_GRID_CHANGED" });
  });
  it("failed explicit reseeding cannot silently resume the prior calibrated identity", () => {
    const tracker = new IndexImageTracker(binding);
    const first = tracker.update(image(60, 60, 100), null, point(60, 60));
    expect(tracker.update(image(60, 60, 133, { blank: true }), null, point(60, 60))).toMatchObject({
      state: "UNSEEDED",
      trackId: null,
      point: null,
    });
    const recovered = tracker.update(image(60, 60, 166), null, point(60, 60));
    expect(recovered.trackId).not.toBe(first.trackId);
  });
  it.each([10, 20, 30, 60].flatMap((fps) => [0.3, 0.6, 1, 2].map((speed) => ({ fps, speed }))))(
    "keeps emitted positions honest at $speed frame-width/s and $fps fps, including reversal",
    ({ fps, speed }) => {
      const tracker = new IndexImageTracker({ ...binding, frameWidth: 640, frameHeight: 480 });
      const first = tracker.update(image(40, 120, 100, { width: 320, height: 240 }), null, {
        x: 40 / 319,
        y: 120 / 239,
      });
      expect(first.state).toBe("TRACKING");
      let tracked = 0;
      for (let i = 1; i <= 40; ++i) {
        const phase = (i * speed * 320) / fps,
          period = phase % 480;
        const x = Math.round(40 + (period <= 240 ? period : 480 - period)),
          y = 120;
        const result = tracker.update(image(x, y, 100 + (i * 1000) / fps, { width: 320, height: 240 }));
        if (result.point) {
          ++tracked;
          expect(Math.abs(result.point.x * 319 - x)).toBeLessThanOrEqual(1);
          expect(Math.abs(result.point.y * 239 - y)).toBeLessThanOrEqual(1);
        } else expect(result.state).not.toBe("TRACKING");
      }
      if (speed === 0.3 || (speed === 0.6 && fps === 10) || (speed === 1 && fps === 20) || (speed === 2 && fps === 30))
        expect(tracked).toBe(40);
    },
  );
  it("rejects duplicate appearance in the previous square even when prediction excludes the distractor", () => {
    const tracker = new IndexImageTracker(binding);
    expect(tracker.update(image(60, 60, 100), null, point(60, 60)).state).toBe("TRACKING");
    expect(tracker.update(image(70, 60, 200)).state).toBe("TRACKING");
    // Velocity predicts x80. The equal patch at x50 lies outside x80±24 but
    // inside the last accepted x70±24, so it must participate in uniqueness.
    const ambiguous = image(50, 60, 300, { repeated: true });
    expect(tracker.update(ambiguous)).toMatchObject({
      state: "UNCERTAIN",
      reason: "APPEARANCE_AMBIGUOUS",
      point: null,
    });
  });
  it("abstains on severe local rotation/blur instead of inventing a fingertip", () => {
    const tracker = new IndexImageTracker(binding);
    tracker.update(image(60, 60, 100), null, point(60, 60));
    const blurred = image(60, 60, 133);
    const original = blurred.data.slice();
    for (let y = 1; y < 119; ++y)
      for (let x = 1; x < 159; ++x) {
        let sum = 0;
        for (let dy = -1; dy <= 1; ++dy) for (let dx = -1; dx <= 1; ++dx) sum += original[(y + dy) * 160 + x + dx];
        blurred.data[y * 160 + x] = Math.round(sum / 9);
      }
    expect(tracker.update(blurred).point).toBeNull();
    const rotated = image(60, 60, 166);
    const source = rotated.data.slice();
    for (let dy = -10; dy <= 10; ++dy)
      for (let dx = -10; dx <= 10; ++dx) rotated.data[(60 + dy) * 160 + 60 + dx] = source[(60 + dx) * 160 + 60 - dy];
    expect(tracker.update(rotated).point).toBeNull();
  });
  it("keeps only real in-frame positions near a clipped edge and pauses when the tip leaves", () => {
    const tracker = new IndexImageTracker(binding);
    expect(tracker.update(image(9, 60, 100), null, point(9, 60)).state).toBe("TRACKING");
    const near = tracker.update(image(8, 60, 133));
    if (near.point) expect(near.point.x * 159).toBeCloseTo(8);
    expect(tracker.update(image(-9, 60, 166)).point).toBeNull();
  });
});

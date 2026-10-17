// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
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
describe("independent image fingertip evidence", () => {
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
    expect(reseeded.state).toBe("TRACKING");
    expect(reseeded.trackId).not.toBe(first.trackId);
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

// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { describe, expect, it } from "vitest";
import { IndexImageTracker, type IndexModelAnchor } from "./index-image-tracker";

// Analytic D0 pixels/current anatomy only; no model-recognition or physical claim.
const source = "synthetic-optical-endpoint";
const binding = {
  providerGeneration: 1,
  cameraLeaseId: "synthetic-distal-endpoint",
  cameraFrameVersion: 1,
  frameWidth: 320,
  frameHeight: 240,
  mirrorTransform: "NONE" as const,
};
type Chain = NonNullable<IndexModelAnchor["geometry"]>["index"];
const point = (x: number, y: number) => ({ x: x / 159, y: y / 119 });
function anchor(x = 45, y = 45, currentSource = source): IndexModelAnchor {
  const index = [48, 32, 16, 0].map((dy) => ({ ...point(x, y + dy), z: 0 })) as unknown as Chain;
  return {
    point: point(x, y),
    pointing: true,
    contrary: false,
    authority: "POINT",
    authoritySource: currentSource,
    identitySource: currentSource,
    identityObserved: true,
    geometry: { index, palmSpan: 0.2 },
    indexIdentityGeometry: { source: currentSource, associationBasis: "INDEX_CHAIN_V1", index },
    indexIdentityEvidence: {
      source: currentSource,
      associationBasis: "INDEX_CHAIN_V1",
      joints: index.map((joint, i) => ({ index: i + 5, x: joint.x, y: joint.y })),
    },
  };
}
function pixels(capture: number, options: { blank?: boolean; small?: boolean } = {}) {
  const data = new Uint8Array(160 * 120).fill(30),
    radius = options.small ? 4 : 10;
  if (!options.blank)
    for (let dy = -radius; dy <= radius; dy++)
      for (let dx = -radius; dx <= radius; dx++)
        data[(45 + dy) * 160 + 45 + dx] = 45 + ((dx * 73 + dy * 127 + dx * dy * 19 + 100000) % 135);
  return { data, width: 160, height: 120, capture, received: capture + 1 };
}
function establish(tracker: IndexImageTracker, manual = false) {
  let selected;
  for (const at of [100, 166, 233])
    selected = tracker.update(pixels(at), anchor(), manual && at === 100 ? point(45, 45) : null);
  expect(selected).toMatchObject({ state: "TRACKING", coordinateSource: manual ? "IMAGE" : "FUSED" });
  return selected!;
}

describe("bounded compatibility of a verified optical endpoint and an inward model estimate", () => {
  it("keeps the real NCC endpoint as IMAGE without model bias, a new identity or an optical replacement", () => {
    const tracker = new IndexImageTracker(binding),
      first = establish(tracker);
    for (let i = 0; i < 20; i++) {
      const current = tracker.update(pixels(300 + i * 67), anchor(45, 57));
      expect(current).toMatchObject({
        state: "TRACKING",
        coordinateSource: "IMAGE",
        reason: "IMAGE_TIP_MODEL_ENDPOINT_UNCERTAIN",
        modelSupport: null,
        trackId: first.trackId,
        trackGeneration: first.trackGeneration,
        opticalEpoch: first.opticalEpoch,
      });
      expect(current.point!.x * 159).toBeCloseTo(45, 5);
      expect(current.point!.y * 119).toBeCloseTo(45, 5);
      expect(current.point!.y * 119).not.toBeCloseTo(57, 1);
      expect(current.uncertaintyRadiusPixels).toBeGreaterThanOrEqual(24 - 1e-6);
    }
  });

  it("converges to a small confidence-weighted correction rather than accumulating the full model offset", () => {
    const tracker = new IndexImageTracker(binding),
      first = establish(tracker);
    let current;
    for (let i = 0; i < 40; i++) current = tracker.update(pixels(300 + i * 67), anchor(49, 45));
    expect(current).toMatchObject({
      state: "TRACKING",
      coordinateSource: "FUSED",
      trackId: first.trackId,
      opticalEpoch: first.opticalEpoch,
    });
    expect(current!.quality.correlation).toBeGreaterThan(0.99);
    const correction = current!.point!.x * 159 - 45;
    expect(correction).toBeGreaterThan(0);
    expect(correction).toBeLessThan(1);
    expect(current!.point!.y * 119).toBeCloseTo(45, 5);
  });

  it("does not use the extension to cold-acquire image pixels beyond the current model tip", () => {
    const tracker = new IndexImageTracker(binding);
    // The established endpoint has texture, but the inward model tip's own
    // patch is blank. Only a current full-model cohort can initialize MODEL.
    for (const at of [100, 166])
      expect(tracker.update(pixels(at, { small: true }), anchor(45, 57))).toMatchObject({ point: null, trackId: null });
    const initialized = tracker.update(pixels(233, { small: true }), anchor(45, 57));
    expect(initialized).toMatchObject({ state: "TRACKING", coordinateSource: "MODEL", opticalEpoch: 0 });
    expect(initialized.point!.y * 119).toBeCloseTo(57, 5);
  });

  it.each(["SIDEWAYS", "BEYOND_ONE_BONE"])("rejects %s optical/model disagreement", (kind) => {
    const tracker = new IndexImageTracker(binding),
      first = establish(tracker);
    const current = kind === "SIDEWAYS" ? anchor(57, 45) : anchor(45, 62);
    expect(tracker.update(pixels(300), current)).toMatchObject({
      point: null,
      reason: "FULL_HAND_INDEX_CONFLICT",
      trackId: first.trackId,
      opticalEpoch: first.opticalEpoch,
    });
  });

  it("rejects a competing finger segment near the optical endpoint even when both rival endpoints are far away", () => {
    const tracker = new IndexImageTracker(binding),
      first = establish(tracker),
      current = anchor(45, 57);
    current.otherDigitEvidence = {
      source,
      points: [point(20, 45), point(75, 45)],
      segments: [[point(20, 45), point(75, 45)]],
    };
    expect(tracker.update(pixels(300), current)).toMatchObject({
      point: null,
      reason: "FULL_HAND_INDEX_CONFLICT",
      trackId: first.trackId,
    });
  });

  it.each(["UNKNOWN_ASSOCIATION", "PARTIAL_INDEX", "OTHER_SOURCE"])(
    "cannot authorize endpoint extension from %s",
    (kind) => {
      const tracker = new IndexImageTracker(binding),
        first = establish(tracker);
      const current = anchor(45, 57, kind === "OTHER_SOURCE" ? "replacement-hand" : source);
      if (kind === "UNKNOWN_ASSOCIATION") current.indexIdentityEvidence = undefined;
      if (kind === "PARTIAL_INDEX")
        current.indexIdentityEvidence!.joints = current.indexIdentityEvidence!.joints.slice(0, 3);
      expect(tracker.update(pixels(300), current)).toMatchObject({
        point: null,
        trackId: first.trackId,
        opticalEpoch: first.opticalEpoch,
      });
    },
  );

  it("cannot borrow manual selection for anatomical endpoint extension", () => {
    const tracker = new IndexImageTracker(binding),
      first = establish(tracker, true);
    expect(tracker.update(pixels(300), anchor(45, 57))).toMatchObject({
      point: null,
      trackId: first.trackId,
      anchorSource: "MANUAL_HINT",
      opticalEpoch: first.opticalEpoch,
    });
  });

  it("keeps the hand identity but cannot extend an expired selected-index certificate", () => {
    const tracker = new IndexImageTracker(binding),
      first = establish(tracker);
    for (const at of [300, 500])
      tracker.update(pixels(at), {
        point: null,
        pointing: false,
        contrary: false,
        authority: "AMBIGUOUS",
        authoritySource: source,
        identitySource: source,
      });
    expect(tracker.update(pixels(566), anchor(45, 57))).toMatchObject({
      point: null,
      trackId: first.trackId,
      opticalEpoch: first.opticalEpoch,
    });
  });

  it("cannot restore coordinate permission revoked by a previous accepted optical contradiction", () => {
    const tracker = new IndexImageTracker(binding),
      first = establish(tracker);
    expect(tracker.update(pixels(300), anchor(75, 45)).point).toBeNull();
    expect(tracker.update(pixels(366), anchor(45, 57))).toMatchObject({
      point: null,
      trackId: first.trackId,
      opticalEpoch: first.opticalEpoch,
    });
  });

  it("cannot reuse a prior endpoint or identity after an explicit new selection request", () => {
    const tracker = new IndexImageTracker(binding);
    establish(tracker);
    tracker.requestManualSelection();
    expect(tracker.update(pixels(300), anchor(45, 57))).toMatchObject({
      point: null,
      trackId: null,
      anchorSource: null,
    });
  });

  it("cannot use an old ray-supported model endpoint when both current image and current geometry disappear", () => {
    const tracker = new IndexImageTracker(binding),
      first = establish(tracker);
    expect(tracker.update(pixels(300), anchor(45, 57)).coordinateSource).toBe("IMAGE");
    expect(
      tracker.update(pixels(366, { blank: true }), {
        point: null,
        pointing: false,
        contrary: false,
        identitySource: source,
      }),
    ).toMatchObject({ point: null, trackId: first.trackId });
  });

  it("rolls back stale completion so ray compatibility cannot renew a selected-index certificate", () => {
    const tracker = new IndexImageTracker(binding),
      first = establish(tracker),
      token = tracker.prepare(pixels(300));
    let calls = 0;
    expect(() => tracker.complete(token, anchor(45, 57), () => (++calls === 1 ? 301 : 451))).toThrow(
      "INDEX_IMAGE_FRAME_INVALID_OR_STALE",
    );
    expect(tracker.update(pixels(500), anchor(45, 57))).toMatchObject({
      point: null,
      sequence: first.sequence + 1,
      trackId: first.trackId,
      opticalEpoch: first.opticalEpoch,
    });
  });
});

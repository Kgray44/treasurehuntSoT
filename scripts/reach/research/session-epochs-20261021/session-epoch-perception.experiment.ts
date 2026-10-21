// Research only: explicitly invoked; not a unit.reach qualification.
import { describe, expect, it } from "vitest";
import {
  calibratedPoint,
  calibrationLayout,
  fitRelativeCalibration,
  relativeLayout,
  validateCalibration,
  type CalibrationSample,
  type RelativeCalibrationBinding,
} from "@/reach/calibration";
import {
  REACH_RELATIVE_ASSOCIATION_BASIS,
  REACH_RELATIVE_FEATURE_PROFILE,
  relativeIndexFeatures,
  type Point,
} from "@/reach/coordinates";
import { IndexImageObservationGate } from "@/reach/index-image-observation";
import { IndexImageReadiness, type IndexImageReadinessResult } from "@/reach/index-image-readiness";
import {
  IndexImageTracker,
  type IndexGrayFrame,
  type IndexImageObservation,
  type IndexModelAnchor,
} from "@/reach/index-image-tracker";

// Prospective claims, frozen before this test is executed:
// 1. Public reset can attempt fresh LOCAL acquisition; this asserts no physical
//    continuity and must not transfer the original calibration to a new binding.
// 2. A copied terminal is analytically not the original terminal. Whether the
//    canonical cold path publishes it is UNKNOWN before execution. The final
//    test is an explicit falsifier, not an assumed passing safety guarantee.
// Preserve its failed receipt if it publishes: do not retune the pixels, remove
// the negative, or describe LOCAL READY as anatomical/physical correctness.
//
// Renderer/body geometry/TIP8 transplant adapted from the retained generated
// focused A2 fixture SHA256:
// 18c90066fd3422c6cb94bef76c60eb49c92762d05f18042ccb09e5648bdbaf81.
// The rejected A2 implementation and private-state spies are NOT imported.
// Only generated public prepare/complete inputs and actual gated outputs appear
// here. No recording, neural inference, private state injection or hidden input.
const binding = {
  providerGeneration: 1,
  cameraLeaseId: "analytic-paused-search",
  cameraFrameVersion: 1,
  frameWidth: 320,
  frameHeight: 240,
  mirrorTransform: "NONE" as const,
};
const modelSource = (hand: string, generation: number) =>
  JSON.stringify([
    "analytic-provider",
    "analytic-model",
    "analytic-algorithm",
    1,
    binding.cameraLeaseId,
    1,
    320,
    240,
    "NONE",
    0,
    hand,
    generation,
  ]);
const source = modelSource("hand-a", 1);
const foreign = modelSource("hand-b", 2);
const point = (x: number, y = 45): Point => ({ x: x / 159, y: y / 119 });
const returningCaptures = [500, 566, 633, 700, 766, 833, 900, 966, 1033];

function bodyModel(x = 45, tipX = x, currentSource = source): IndexModelAnchor {
  const joint = (dy: number, isTip = false) => ({ ...point(isTip ? tipX : x, 45 + dy), z: 0 });
  const index: NonNullable<IndexModelAnchor["geometry"]>["index"] = [joint(48), joint(32), joint(16), joint(0, true)];
  return {
    point: point(tipX),
    pointing: true,
    contrary: false,
    authority: "POINT",
    authoritySource: currentSource,
    identitySource: currentSource,
    identityObserved: true,
    geometry: { index, palmSpan: 0.2 },
    indexIdentityGeometry: { source: currentSource, index, associationBasis: "INDEX_CHAIN_V1" },
    indexIdentityEvidence: {
      source: currentSource,
      associationBasis: "INDEX_CHAIN_V1",
      joints: index.map((p, i) => ({ index: i + 5, x: p.x, y: p.y })),
    },
    otherDigitEvidence: { source: currentSource, points: [], segments: [] },
    handRegion: {
      source: currentSource,
      palmSpan: 0.2,
      points: Array.from({ length: 12 }, (_, i) => point(20 + (i % 2) * 120, 40 + Math.floor(i / 2) * 12)),
    },
  };
}

function pixels(capture: number, x = 45): IndexGrayFrame {
  const data = new Uint8Array(160 * 120).fill(30);
  for (let dy = -12; dy <= 48; dy++)
    for (let dx = -10; dx <= 10; dx++)
      data[(45 + dy) * 160 + x + dx] = 45 + ((dx * 73 + dy * 127 + dx * dy * 19 + 100000) % 135);
  return { data, width: 160, height: 120, capture, received: capture + 1 };
}

function returningPixels(capture: number, copied: boolean): IndexGrayFrame {
  const frame = pixels(capture, 93);
  if (!copied) return frame;
  const reference = pixels(233);
  // Remove the original terminal, then put its old 15x15 appearance at a
  // different plausible endpoint. Original DIP/proximal body remains present.
  // Overlap is intentional and preserved from the decisive A2 counterexample.
  for (let dy = -7; dy <= 7; dy++) for (let dx = -7; dx <= 7; dx++) frame.data[(45 + dy) * 160 + 93 + dx] = 30;
  for (let dy = -7; dy <= 7; dy++)
    for (let dx = -7; dx <= 7; dx++) frame.data[(45 + dy) * 160 + 100 + dx] = reference.data[(45 + dy) * 160 + 45 + dx];
  return frame;
}

type Row = { observation: IndexImageObservation; readiness: IndexImageReadinessResult };
function scenario(copied: boolean, coldReset: boolean) {
  const tracker = new IndexImageTracker({ ...binding });
  const gate = new IndexImageObservationGate({
    providerGeneration: binding.providerGeneration,
    cameraLeaseId: binding.cameraLeaseId,
    cameraFrameVersion: binding.cameraFrameVersion,
    mirrorTransform: binding.mirrorTransform,
    orientation: 0,
  });
  const readiness = new IndexImageReadiness();
  const send = (frame: IndexGrayFrame, model: IndexModelAnchor): Row => {
    const token = tracker.prepare(frame);
    const produced = tracker.complete(
      token,
      model,
      () => frame.capture + 2,
      () => true,
    );
    // Actual producer fields are unmodified. No sequence/origin normalization.
    const observation = gate.accept(produced, frame.capture + 3, () => true);
    return { observation, readiness: readiness.update(observation) };
  };
  let original: Row | undefined;
  for (const at of [100, 166, 233]) original = send(pixels(at), bodyModel());
  expect(original?.observation.point).not.toBeNull();
  for (const [at, x] of [
    [300, 57],
    [366, 69],
    [433, 81],
  ])
    send(pixels(at, x), bodyModel(x, x + 24, foreign));
  if (coldReset) tracker.reset();
  const rows = returningCaptures.map((at) => send(returningPixels(at, copied), bodyModel(93, copied ? 100 : 93)));
  return { original: original!.observation, rows };
}

function calibrationBinding(o: IndexImageObservation): RelativeCalibrationBinding {
  if (o.trackId === null || o.trackGeneration <= 0) throw new Error("TEST_REQUIRES_ACTUAL_LOCAL_ID");
  return {
    featureProfile: REACH_RELATIVE_FEATURE_PROFILE,
    associationBasis: REACH_RELATIVE_ASSOCIATION_BASIS,
    providerId: o.providerId,
    providerVersion: o.providerVersion,
    modelDigest: o.algorithmDigest,
    providerGeneration: o.providerGeneration,
    cameraLeaseId: o.cameraLeaseId,
    cameraFrameVersion: o.cameraFrameVersion,
    viewportEpoch: 1,
    viewportWidth: 800,
    viewportHeight: 600,
    mirror: o.mirrorTransform === "PREVIEW_X",
    orientation: o.orientation,
    trackId: o.trackId,
    trackGeneration: o.trackGeneration,
    evidenceTier: "D0",
  };
}

// Independent numeric calibration fixture, not claimed to be measurements of
// the rendered stem. Actual fitter/validation remain the production owners.
function calibrationGroups(targets: Point[]): CalibrationSample[][] {
  return targets.map((target) =>
    Array.from({ length: 16 }, (_, i) => ({
      target,
      features: relativeIndexFeatures(target),
      at: 100 + i * 50,
    })),
  );
}
function oldCalibration(o: IndexImageObservation) {
  return validateCalibration(
    fitRelativeCalibration(calibrationGroups(relativeLayout.training), calibrationBinding(o), 1000),
    calibrationGroups(calibrationLayout.validation),
  );
}

describe("research local epochs preserve the perception/calibration boundary", () => {
  it("compares uninterrupted tracking with true-terminal cold acquisition and real readiness", () => {
    const uninterrupted = scenario(false, false);
    const { original, rows } = scenario(false, true);
    expect(rows.slice(0, 2).every(({ observation }) => observation.point === null)).toBe(true);
    const measured = rows.filter(({ observation }) => observation.point !== null);
    expect(measured.length).toBeGreaterThan(0);
    expect(rows.at(-1)?.readiness.eligible).toBe(true);
    for (const { observation } of measured) {
      expect(observation.trackId).not.toBe(original.trackId);
      expect(observation.trackGeneration).not.toBe(original.trackGeneration);
      expect(observation.point!.x * 159).toBeCloseTo(93, 0);
      expect(observation.point!.y * 119).toBeCloseTo(45, 0);
    }
    for (const { observation } of uninterrupted.rows.filter(({ observation }) => observation.point !== null)) {
      expect(observation.point!.x * 159).toBeCloseTo(93, 0);
      expect(observation.point!.y * 119).toBeCloseTo(45, 0);
    }
    console.info(
      "GENERATED_TRUE_TERMINAL_PAIR",
      JSON.stringify({
        capturesPerArm: rows.length,
        uninterruptedPublished: uninterrupted.rows.filter(({ observation }) => observation.point !== null).length,
        uninterruptedReady: uninterrupted.rows.filter(({ readiness }) => readiness.eligible).length,
        coldPublished: measured.length,
        coldReady: rows.filter(({ readiness }) => readiness.eligible).length,
      }),
    );
  });

  it("retains the uninterrupted canonical rejection of the same transplanted terminal", () => {
    const { original, rows } = scenario(true, false);
    const sameOriginalIdentity = (observation: IndexImageObservation) =>
      observation.trackId === original.trackId && observation.trackGeneration === original.trackGeneration;
    const diagnostic = {
      captures: rows.length,
      published: rows.filter(({ observation }) => observation.point !== null).length,
      ready: rows.filter(({ readiness }) => readiness.eligible).length,
      sameOriginalIdentityPublished: rows.filter(
        ({ observation }) => observation.point !== null && sameOriginalIdentity(observation),
      ).length,
      newIdentityPublished: rows.filter(
        ({ observation }) => observation.point !== null && !sameOriginalIdentity(observation),
      ).length,
      states: rows.map(({ observation, readiness }) => ({
        capture: observation.monotonicCaptureTime,
        state: observation.state,
        reason: observation.reason,
        published: observation.point !== null,
        ready: readiness.eligible,
        sameOriginalIdentity: sameOriginalIdentity(observation),
      })),
    };
    expect(
      rows.every(({ observation }) => observation.point === null),
      JSON.stringify(diagnostic),
    ).toBe(true);
    expect(
      rows.every(({ readiness }) => !readiness.eligible),
      JSON.stringify(diagnostic),
    ).toBe(true);
  });

  it("never applies the validated old fit to actual replacement bindings, whatever local perception emits", () => {
    for (const copied of [false, true]) {
      const { original, rows } = scenario(copied, true);
      const calibration = oldCalibration(original);
      expect(calibration.status).toBe("VALIDATED");
      expect(
        calibratedPoint(calibration, relativeIndexFeatures({ x: 0.5, y: 0.5 }), calibration.binding, 2000),
      ).toEqual({ x: 0.5, y: 0.5 });
      const returnedIdentities = rows.filter(({ observation }) => observation.trackId !== null);
      expect(returnedIdentities.length).toBeGreaterThan(0);
      const frozen = JSON.stringify(calibration);
      for (const { observation } of returnedIdentities) {
        const incoming = calibrationBinding(observation);
        expect(incoming.trackId).not.toBe(calibration.binding.trackId);
        expect(
          calibratedPoint(calibration, relativeIndexFeatures(observation.point ?? { x: 0.5, y: 0.5 }), incoming, 2000),
        ).toBeNull();
      }
      expect(JSON.stringify(calibration)).toBe(frozen);
    }
  });

  it("FALSIFIER: cold reset must not publish the analytically transplanted terminal", () => {
    const { rows } = scenario(true, true);
    // Collect the whole fixed block, including actual readiness, before failing.
    // A failure characterizes a pre-existing LOCAL validity limitation. It must
    // never be converted into old-fit, physical identity, or action authority.
    const diagnostic = {
      captures: rows.length,
      published: rows.filter(({ observation }) => observation.point !== null).length,
      ready: rows.filter(({ readiness }) => readiness.eligible).length,
      states: rows.map(({ observation, readiness }) => ({
        capture: observation.monotonicCaptureTime,
        state: observation.state,
        reason: observation.reason,
        ready: readiness.eligible,
      })),
    };
    console.info("GENERATED_COLD_TERMINAL_FALSIFIER", JSON.stringify(diagnostic));
    expect(diagnostic.published, JSON.stringify(diagnostic)).toBe(0);
  });
});

// Historical fixture declarations retain their original comments below.
// This follow-up evaluates only uninterrupted arms with two fixed added captures.
import { existsSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";

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
function scenario(copied: boolean, coldReset: boolean, appendedCaptures: number[] = []) {
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
  const rows = returningCaptures
    .concat(appendedCaptures)
    .map((at) => send(returningPixels(at, copied), bodyModel(93, copied ? 100 : 93)));
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

// Append-only authority diagnostic. The imports/scaffold above are copied from
// source 89dc34873c449c71fcbd933cac338f7d9b167b000a26b8bf853308d5db8efa99,
// with only optional scenario captures and concat added. Both arms keep the
// original nine-capture inputs and append 1100/1166 without a reset.
//
// This externally constructed numerical fit is NOT an actual pre-pause
// calibration journey. The original three seed frames never reached READY.
// Current IndexModelAnchor inputs are constructed; no raw Watchglass21 selection
// or neural inference occurs. A numeric projection grants no action authority.
// The copied-arm zero-READY/zero-joint assertions remain prospective falsifiers;
// source predictions are not expected-pass values or exact bad-count assertions.
function evaluateArm(copied: boolean) {
  const { original, rows } = scenario(copied, false, [1100, 1166]);
  const calibration = oldCalibration(original);
  const frozen = JSON.stringify(calibration);
  const measured = rows.map(({ observation, readiness }) => {
    const now = observation.monotonicCaptureTime + 3;
    const numericPoint =
      observation.point === null
        ? null
        : calibratedPoint(calibration, relativeIndexFeatures(observation.point), calibrationBinding(observation), now);
    return {
      capture: observation.monotonicCaptureTime,
      evaluatedAt: now,
      state: observation.state,
      reason: observation.reason,
      point: observation.point === null ? null : { ...observation.point },
      published: observation.point !== null,
      ready: readiness.eligible,
      sameOriginalIdentity:
        observation.trackId === original.trackId && observation.trackGeneration === original.trackGeneration,
      numericProjection: numericPoint !== null,
      readyAndNumericProjection: readiness.eligible && numericPoint !== null,
    };
  });
  return {
    classification: "APPEND_ONLY_GENERATED_AUTHORITY_DIAGNOSTIC",
    qualification: false,
    arm: copied ? "UNINTERRUPTED_COPIED_TERMINAL" : "UNINTERRUPTED_TRUE_TERMINAL",
    originalFixtureSourceSha256: "89dc34873c449c71fcbd933cac338f7d9b167b000a26b8bf853308d5db8efa99",
    calibrationCreatedAt: calibration.createdAt,
    calibrationImmutable: JSON.stringify(calibration) === frozen,
    externalNumericalFixtureNotLiveCalibration: true,
    rawWatchglassOrNeuralInferenceExecuted: false,
    actionAuthority: false,
    counts: {
      captures: measured.length,
      published: measured.filter((row) => row.published).length,
      ready: measured.filter((row) => row.ready).length,
      numericProjection: measured.filter((row) => row.numericProjection).length,
      readyAndNumericProjection: measured.filter((row) => row.readyAndNumericProjection).length,
      sameOriginalIdentityPublished: measured.filter((row) => row.published && row.sameOriginalIdentity).length,
      newIdentityPublished: measured.filter((row) => row.published && !row.sameOriginalIdentity).length,
    },
    rows: measured,
  };
}

type Evaluated = { truth: ReturnType<typeof evaluateArm>; copied: ReturnType<typeof evaluateArm> };
let evaluated: Evaluated | null = null;
function evaluateAndRetainBoth(): Evaluated {
  if (evaluated !== null) return evaluated;
  const requested = process.env.REACH_RESEARCH_OWNED_OUTPUT;
  if (!requested || !path.isAbsolute(requested)) throw new Error("REACH_RESEARCH_OWNED_OUTPUT_REQUIRED");
  const output = realpathSync(requested);
  // The runner registers a fresh outside-repository directory before spawning.
  if (path.parse(output).root.toUpperCase() !== "D:\\") throw new Error("D_OWNED_OUTPUT_REQUIRED");
  const paths = [path.join(output, "authority-true.json"), path.join(output, "authority-copied.json")];
  if (paths.some((file) => existsSync(file))) throw new Error("PRESERVE_EXISTING_AUTHORITY_OUTPUT");
  // Both complete eleven-row results are evaluated and retained before either
  // prospective test-body assertion. No await, frame omission or early failure.
  const results = { truth: evaluateArm(false), copied: evaluateArm(true) };
  const encoded = [JSON.stringify(results.truth, null, 2) + "\n", JSON.stringify(results.copied, null, 2) + "\n"];
  if (encoded.some((text) => Buffer.byteLength(text, "utf8") > 32 * 1024))
    throw new Error("AUTHORITY_DIAGNOSTIC_OUTPUT_CAP");
  encoded.forEach((text, i) => writeFileSync(paths[i], text, { flag: "wx" }));
  evaluated = results;
  return results;
}

describe("append-only generated same-binding authority falsifier", () => {
  it("retains true-terminal local tracking and final readiness after the fixed two captures", () => {
    const result = evaluateAndRetainBoth().truth;
    expect(result.calibrationImmutable).toBe(true);
    expect(result.counts.published).toBeGreaterThan(0);
    for (const row of result.rows.filter((row) => row.point !== null)) {
      expect(row.point!.x * 159).toBeCloseTo(93, 0);
      expect(row.point!.y * 119).toBeCloseTo(45, 0);
    }
    expect(result.rows.at(-1)?.ready).toBe(true);
  });

  it("FALSIFIER: copied terminal must not reach READY or joint numeric mapping under the original binding", () => {
    const result = evaluateAndRetainBoth().copied;
    expect(result.calibrationImmutable).toBe(true);
    expect(result.counts.ready, JSON.stringify(result.counts)).toBe(0);
    expect(result.counts.readyAndNumericProjection, JSON.stringify(result.counts)).toBe(0);
  });
});

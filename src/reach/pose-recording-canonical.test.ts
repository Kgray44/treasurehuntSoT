// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { describe, expect, it } from "vitest";
import { indexImageAlgorithm, type IndexImageObservation } from "./index-image-tracker";
import { IndexImageReadiness } from "./index-image-readiness";
import { PoseRecordingSession, poseRecordingLimits } from "./pose-recording";
import { syntheticObservation } from "./synthetic";
import type { RawHandInference, ReachFrameDiagnostics } from "./browser-runtime";

const lease = "PRIVATE_CAMERA_LEASE_MUST_NOT_EXPORT";
function raw(capture: number): RawHandInference {
  return {
    capture,
    inference: capture + 10,
    received: capture + 15,
    videoTime: capture / 1000,
    width: 640,
    height: 480,
    mirror: true,
    inferenceBackend: "GPU_WEBGL",
    inferencePolicy: "WATCHGLASS_ACTUAL_ROI_RECOVERY_V1",
    result: {
      landmarks: [
        syntheticObservation({ x: 0.5, y: 0.5 }, 0, capture).hands[0].landmarks.map(({ x, y, z }) => ({ x, y, z })),
      ],
    },
  };
}
function result(capture: number, sequence = 0): ReachFrameDiagnostics {
  const model = syntheticObservation({ x: 0.5, y: 0.5 }, sequence, capture);
  Object.assign(model, {
    cameraLeaseId: lease,
    cameraFrameVersion: 1,
    providerGeneration: 1,
    mirrorTransform: "PREVIEW_X",
    frameWidth: 640,
    frameHeight: 480,
  });
  model.hands[0].trackId = "PRIVATE_MODEL_HAND_MUST_NOT_EXPORT";
  const index: IndexImageObservation = {
    observationVersion: 1,
    ...indexImageAlgorithm,
    providerGeneration: 1,
    cameraLeaseId: lease,
    cameraFrameVersion: 1,
    mirrorTransform: "PREVIEW_X",
    orientation: 0,
    frameWidth: 640,
    frameHeight: 480,
    sequence,
    monotonicCaptureTime: capture,
    monotonicInferenceTime: capture + 20,
    trackId: "PRIVATE_CANONICAL_INDEX_MUST_NOT_EXPORT",
    trackGeneration: 1,
    point: { x: 0.51, y: 0.49 },
    matchedPoint: { x: 0.51, y: 0.49 },
    state: "TRACKING",
    modelAgreement: "AGREE",
    anchorSource: "MODEL_INDEX",
    coordinateSource: "FUSED",
    opticalEpoch: 1,
    modelSupport: "FULL_HAND",
    quality: { correlation: 0.95, separation: 0.12, texture: 20, forwardBackwardErrorPixels: 0 },
    uncertaintyRadiusPixels: 4,
    reason: "FULL_HAND_POINT_CONFIRMED",
  };
  return {
    capture,
    completed: capture + 25,
    modelObservation: model,
    indexObservation: index,
    modelReason: "MODEL_ACCEPTED",
    indexReason: "INDEX_ACCEPTED",
  };
}
const session = () => new PoseRecordingSession(1000, 1, "synthetic-canonical-recording", { canonicalTracking: true });

describe("same-frame canonical recorder trace", () => {
  it("retains a raw row immediately and makes an unfinished canonical result explicit", () => {
    const recording = session();
    recording.append(raw(1010), 1025);
    expect(recording.export().frames[0]).toMatchObject({
      rawHandCount: 1,
      canonicalIndexTrack: { schemaVersion: 1, disposition: "PENDING" },
    });
    expect(recording.export().canonicalTracking).toMatchObject({ pendingFrames: 1 });
  });

  it("records the shared readiness result without collecting calibration or committing actions", () => {
    const recording = session(),
      recorderReadiness = new IndexImageReadiness(),
      laboratoryReadiness = new IndexImageReadiness();
    for (let sequence = 0; sequence < 9; sequence++) {
      const capture = 1010 + sequence * 50,
        diagnostic = result(capture, sequence),
        observation = diagnostic.indexObservation!;
      recording.append(raw(capture), capture + 15);
      const ready = recorderReadiness.update(observation);
      expect(ready).toEqual(laboratoryReadiness.update(observation));
      expect(recording.attachCanonical(diagnostic, { result: ready, evaluatedAt: capture + 21 }, capture + 26)).toBe(
        true,
      );
      const last = recording.export().frames.at(-1)!.canonicalIndexTrack!;
      expect(last).toMatchObject({
        disposition: "COMPLETE",
        readiness: { trackingEligible: ready.eligible, condition: ready.condition, changed: ready.changed },
        calibration: { evaluated: false, samplesCollected: 0 },
        actions: { evaluated: false, committed: 0 },
      });
    }
    expect(recording.export().frames.at(-1)!.canonicalIndexTrack).toMatchObject({
      readiness: { condition: "READY", trackingEligible: true },
    });
    expect(recording.export().canonicalTracking).toMatchObject({ pendingFrames: 0, attachments: { completed: 9 } });
  });

  it("preserves rejected and no-hand raw data with the actual final rejection reasons", () => {
    const recording = session(),
      input = { ...raw(1010), result: { landmarks: [] } };
    recording.append(input, 1025);
    recording.attachCanonical(
      {
        capture: 1010,
        completed: 1200,
        modelObservation: null,
        indexObservation: null,
        modelReason: "OBSERVATION_PIXEL_ORIGIN_STALE",
        indexReason: "INDEX_RESULT_UNAVAILABLE",
      },
      null,
      1200,
    );
    expect(recording.export().frames[0]).toMatchObject({
      rawHandCount: 0,
      hands: [],
      canonicalIndexTrack: {
        model: { accepted: false, reason: "OBSERVATION_PIXEL_ORIGIN_STALE" },
        index: { accepted: false, reason: "INDEX_RESULT_UNAVAILABLE", point: null },
        readiness: { condition: "NOT_EVALUATED", trackingEligible: false },
      },
    });
  });

  it("uses recording-local ordinals and exports no raw lease, hand, index or provider-generation IDs", () => {
    const recording = session(),
      readiness = new IndexImageReadiness();
    for (let sequence = 0; sequence < 2; sequence++) {
      const capture = 1010 + sequence * 50,
        diagnostic = result(capture, sequence);
      diagnostic.indexObservation!.opticalEpoch = sequence + 1;
      recording.append(raw(capture), capture + 15);
      recording.attachCanonical(
        diagnostic,
        { result: readiness.update(diagnostic.indexObservation!), evaluatedAt: capture + 21 },
        capture + 26,
      );
    }
    const exported = recording.export();
    const text = JSON.stringify(exported);
    for (const key of [
      lease,
      "PRIVATE_MODEL_HAND",
      "PRIVATE_CANONICAL_INDEX",
      "cameraLeaseId",
      "trackId",
      "providerGeneration",
    ])
      expect(text).not.toContain(key);
    const canonical = exported.frames.map((frame) => frame.canonicalIndexTrack!);
    expect(canonical[0]).toMatchObject({
      model: { sourceRef: "source-1", hands: [{ handRef: "hand-1" }] },
      index: { sourceRef: "source-2", indexRef: "index-1", opticalEpoch: 1 },
    });
    expect(canonical[1]).toMatchObject({ index: { sourceRef: "source-2", indexRef: "index-1", opticalEpoch: 2 } });
    expect(exported.limits).toEqual(poseRecordingLimits);
    expect(exported.traceBytes).toBe(exported.frames.reduce((sum, frame) => sum + JSON.stringify(frame).length, 0));
  });

  it("never attaches an older result to a newer raw frame or replaces a completed annotation", () => {
    const recording = session();
    recording.append(raw(1010), 1025);
    recording.append(raw(1050), 1065);
    expect(recording.attachCanonical(result(1010), null, 1070)).toBe(false);
    expect(recording.attachCanonical(result(1050), null, 1075)).toBe(true);
    const before = recording.export().frames[1];
    expect(recording.attachCanonical({ ...result(1050), indexReason: "OTHER_RESULT" }, null, 1080)).toBe(false);
    expect(recording.export().frames[1]).toEqual(before);
    expect(recording.export().canonicalTracking).toMatchObject({ attachments: { unmatched: 1, duplicate: 1 } });
  });

  it.each(["capture", "lease", "dimensions"])(
    "rejects a foreign canonical %s while preserving the original raw frame",
    (kind) => {
      const recording = session(),
        diagnostic = result(1010);
      if (kind === "capture") diagnostic.indexObservation!.monotonicCaptureTime++;
      if (kind === "lease") diagnostic.indexObservation!.cameraLeaseId = "WRONG_PRIVATE_LEASE";
      if (kind === "dimensions") diagnostic.indexObservation!.frameWidth = 320;
      recording.append(raw(1010), 1025);
      expect(recording.attachCanonical(diagnostic, null, 1040)).toBe(true);
      expect(recording.export().frames[0]).toMatchObject({
        rawHandCount: 1,
        canonicalIndexTrack: {
          index: { accepted: false, point: null, indexRef: null },
          readiness: { trackingEligible: false },
        },
      });
      expect(recording.export().canonicalTracking).toMatchObject({ attachments: { contextRejected: 1 } });
    },
  );

  it("does not credit another observation's readiness or stale known-origin evidence", () => {
    const recording = session(),
      diagnostic = result(1010),
      observation = diagnostic.indexObservation!;
    observation.monotonicPixelOriginTime = 800;
    recording.append(raw(1010), 1025);
    recording.attachCanonical(
      diagnostic,
      {
        result: { observation, eligible: true, condition: "READY", changed: false, guidance: "synthetic" },
        evaluatedAt: 1030,
      },
      1040,
    );
    expect(recording.export().frames[0].canonicalIndexTrack).toMatchObject({
      index: { freshAtCompletion: false, pixelOriginMs: -200 },
      readiness: { trackingEligible: false },
    });
    const next = result(1060, 1);
    recording.append(raw(1060), 1075);
    recording.attachCanonical(
      next,
      {
        result: { observation, eligible: true, condition: "READY", changed: false, guidance: "synthetic" },
        evaluatedAt: 1080,
      },
      1090,
    );
    expect(recording.export().frames[1].canonicalIndexTrack).toMatchObject({
      readiness: { condition: "NOT_EVALUATED", trackingEligible: false },
    });
  });

  it("detaches canonical points and quality from later consumer mutation", () => {
    const recording = session(),
      diagnostic = result(1010);
    recording.append(raw(1010), 1025);
    recording.attachCanonical(diagnostic, null, 1040);
    diagnostic.indexObservation!.point!.x = 0.9;
    diagnostic.indexObservation!.quality.correlation = 0;
    diagnostic.modelObservation!.hands[0].landmarks[8].x = 0.9;
    expect(recording.export().frames[0].canonicalIndexTrack).toMatchObject({
      model: { hands: [{ reportedIndexTip: { x: 0.5 } }] },
      index: { point: { x: 0.51 }, quality: { correlation: 0.95 } },
    });
  });

  it("preserves distinct source measurements and temporal uncertainty without treating them as accepted coordinates", () => {
    const recording = session(),
      diagnostic = result(1010),
      observation = diagnostic.indexObservation!;
    Object.assign(observation, {
      state: "UNCERTAIN",
      point: null,
      matchedPoint: null,
      reason: "FULL_HAND_INDEX_CONFLICT",
      measurements: {
        model: { x: 0.4, y: 0.3 },
        image: { x: 0.5, y: 0.6 },
        accepted: null,
        imageDisposition: "DISPUTED",
        modelDisposition: "CANDIDATE",
      },
      temporalTrack: {
        state: "UNCERTAIN",
        identity: "ESTABLISHED",
        intent: "UNCERTAIN",
        measurementAgeMs: 35,
        positionUncertaintyPixels: 12,
        sourceGenerationCount: 1,
        hypothesisCount: 2,
        cameraLeaseId: "PRIVATE_SIDELOAD_MUST_NOT_EXPORT",
      },
    });
    recording.append(raw(1010), 1025);
    recording.attachCanonical(
      diagnostic,
      { result: new IndexImageReadiness().update(observation), evaluatedAt: 1030 },
      1040,
    );
    const snapshot = recording.export().frames[0].canonicalIndexTrack;
    expect(snapshot).toMatchObject({
      index: {
        accepted: true,
        point: null,
        measurements: { model: { x: 0.4, y: 0.3 }, image: { x: 0.5, y: 0.6 }, accepted: null },
        temporalTrack: { identity: "ESTABLISHED", intent: "UNCERTAIN", state: "UNCERTAIN" },
      },
      readiness: { trackingEligible: false },
    });
    expect(JSON.stringify(snapshot)).not.toContain("PRIVATE_SIDELOAD");
    expect(JSON.stringify(snapshot)).not.toContain("cameraLeaseId");
  });
});

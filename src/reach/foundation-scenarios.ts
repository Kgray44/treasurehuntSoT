import { BrowserCameraBroker } from "@/sextant/camera";
import {
  calibratedPoint,
  calibrationLayout,
  fitCalibration,
  fitRelativeCalibration,
  relativeLayout,
  validateCalibration,
  type CalibrationBinding,
  type CalibrationSample,
} from "./calibration";
import { imageToViewport, pointingFeatures, PointFilter } from "./coordinates";
import { ActiveHandSelector, ObservationGate, usableHand } from "./observation";
import { SampleWindow } from "./sample-window";
import { syntheticObservation } from "./synthetic";
import { aggregateCalibrationExport } from "./privacy";
export const phase1ScenarioIds = [
  "permission-and-lease",
  "calibration-held-out-validation",
  "mirror-and-frame-epochs",
  "calibration-drift",
  "stale-and-reordered-observations",
  "background-and-worker-restart",
  "privacy-persistence-and-cleanup",
] as const;
const check = (condition: boolean) => {
  if (!condition) throw new Error("REACH_D0_ASSERTION_FAILED");
};
export const syntheticBinding: CalibrationBinding = {
  providerId: "watchglass.synthetic-hand",
  modelDigest: "a".repeat(64),
  providerGeneration: 1,
  cameraLeaseId: "test-camera",
  cameraFrameVersion: 1,
  viewportEpoch: 1,
  viewportWidth: 800,
  viewportHeight: 600,
  mirror: false,
  orientation: 0,
  trackId: "test-hand",
  trackGeneration: 1,
  evidenceTier: "D0",
};
export function calibrationGroups(targets = calibrationLayout.training, bias = 0): CalibrationSample[][] {
  return targets.map((target) =>
    Array.from({ length: 16 }, (_, i) => ({
      target,
      features: pointingFeatures(
        syntheticObservation({ x: target.x + bias, y: target.y + bias }, i, 100 + i * 50).hands[0],
      ),
      at: 100 + i * 50,
    })),
  );
}
export function sampleGate(generation = 1) {
  return new ObservationGate({
    providerGeneration: generation,
    cameraLeaseId: "synthetic-no-camera",
    cameraFrameVersion: 1,
    orientation: 0,
    mirrorTransform: "NONE",
  });
}
function rejects(action: () => unknown) {
  let rejected = false;
  try {
    action();
  } catch {
    rejected = true;
  }
  check(rejected);
}
export async function runPhase1Oracle(suffix: (typeof phase1ScenarioIds)[number]) {
  const c = fitCalibration(calibrationGroups(), syntheticBinding, 1000);
  const valid = validateCalibration(c, calibrationGroups(calibrationLayout.validation));
  const centerFeatures = pointingFeatures(syntheticObservation({ x: 0.5, y: 0.5 }, 0, 1100).hands[0]);
  check(calibratedPoint(valid, centerFeatures, syntheticBinding, 1101) !== null);
  if (suffix === "calibration-held-out-validation") {
    check(c.status === "VALIDATION_REQUIRED" && c.validationErrors.length === 0);
    check(valid.status === "VALIDATED" && valid.validationErrors.length === 80);
    check(validateCalibration(c, calibrationGroups(calibrationLayout.validation, 0.2)).status === "FAILED");
    rejects(() => validateCalibration(c, calibrationGroups(calibrationLayout.training.slice(0, 5))));
    rejects(() =>
      validateCalibration(
        c,
        Array.from({ length: 5 }, () => calibrationGroups(calibrationLayout.validation)[0]),
      ),
    );
    const window = new SampleWindow(syntheticBinding, { x: 0.5, y: 0.5 });
    for (let i = 0; i < 7; i++) window.push(centerFeatures, 100 + i * 50, syntheticBinding);
    check(window.pause(430).state === "PAUSED");
    let accepted = false;
    for (let i = 0; i < 12; i++) {
      const features = [...centerFeatures];
      features[1] += Math.sin(i) * 0.001;
      accepted ||= !!window.push(features, 500 + i * 50, syntheticBinding).samples;
    }
    check(accepted);
    const relative = fitRelativeCalibration(calibrationGroups(relativeLayout.training), syntheticBinding, 1000);
    check(relative.status === "VALIDATION_REQUIRED");
    check(validateCalibration(relative, calibrationGroups(calibrationLayout.validation)).status === "VALIDATED");
    check(validateCalibration(relative, calibrationGroups(calibrationLayout.validation, 0.2)).status === "FAILED");
  }
  if (suffix === "mirror-and-frame-epochs") {
    const viewport = { width: 800, height: 600, offsetX: 10, offsetY: 20, scale: 2, epoch: 1 };
    check(imageToViewport({ x: 0.25, y: 0.5 }, viewport, true).x === 610);
    check(imageToViewport({ x: 0.25, y: 0.5 }, viewport, false).y === 320);
    check(calibratedPoint(valid, centerFeatures, { ...syntheticBinding, viewportEpoch: 2 }, 1101) === null);
    rejects(() =>
      sampleGate().accept({ ...syntheticObservation({ x: 0.5, y: 0.5 }, 0, 100), mirrorTransform: "PREVIEW_X" }, 101),
    );
  }
  if (suffix === "calibration-drift") {
    for (const binding of [
      { ...syntheticBinding, cameraLeaseId: "other" },
      { ...syntheticBinding, modelDigest: "b".repeat(64) },
      { ...syntheticBinding, trackGeneration: 2 },
    ])
      check(calibratedPoint(valid, centerFeatures, binding, 1101) === null);
    check(calibratedPoint(valid, centerFeatures, syntheticBinding, valid.expiresAt) === null);
    check(calibratedPoint(valid, [1, 1, ...centerFeatures.slice(2)], syntheticBinding, 1101) === null);
  }
  if (suffix === "stale-and-reordered-observations") {
    const gate = sampleGate();
    const o = syntheticObservation({ x: 0.5, y: 0.5 }, 0, 100);
    gate.accept(o, 101);
    rejects(() => gate.accept(o, 101));
    rejects(() => sampleGate().accept(o, 300));
    rejects(() => sampleGate().accept(o, 80));
    const malformed = structuredClone(o);
    malformed.hands[0].landmarks[0].x = NaN;
    rejects(() => sampleGate().accept(malformed, 101));
    const ambiguous = { ...o, hands: [o.hands[0], o.hands[0]] };
    check(usableHand(ambiguous) === null);
    check(usableHand({ ...o, hands: [], reason: "NO_HAND" }) === null);
    check(pointingFeatures(o.hands[0]).length === 5);
    const selector = new ActiveHandSelector();
    selector.update(o);
    const settled = syntheticObservation({ x: 0.5, y: 0.5 }, 1, 400);
    check(selector.update(settled).eligible);
    const second = structuredClone(settled.hands[0]);
    second.trackId = "incidental-hand";
    const both = {
      ...syntheticObservation({ x: 0.5, y: 0.5 }, 2, 450),
      hands: [second, settled.hands[0]],
      reason: "MULTIPLE_HANDS" as const,
    };
    check(selector.update(both).eligible);
    check(selector.update({ ...both, providerGeneration: 2, monotonicCaptureTime: 500 }).changed);
  }
  if (suffix === "background-and-worker-restart") {
    rejects(() => sampleGate(2).accept(syntheticObservation({ x: 0.5, y: 0.5 }, 1, 100), 101));
    const filter = new PointFilter();
    filter.update({ x: 0.5, y: 0.5 }, 100);
    filter.reset();
    check(filter.update({ x: 0.8, y: 0.8 }, 200)?.x === 0.8);
    check(filter.update({ x: NaN, y: 0.5 }, 210) === null);
  }
  if (suffix === "permission-and-lease" || suffix === "privacy-persistence-and-cleanup") {
    let stopped = 0;
    const track = {
      readyState: "live",
      stop() {
        stopped++;
        this.readyState = "ended";
      },
      addEventListener() {},
      removeEventListener() {},
    };
    const stream = { getTracks: () => [track], getVideoTracks: () => [track] } as unknown as MediaStream;
    const broker = new BrowserCameraBroker({
      getUserMedia: async (options) => {
        check(options?.audio === false);
        return stream;
      },
    });
    let rejected = false;
    try {
      await broker.acquire(false, true);
    } catch {
      rejected = true;
    }
    check(rejected && stopped === 0);
    const lease = await broker.acquire(true, true);
    check(broker.ownedTracks === 1);
    rejected = false;
    try {
      await broker.acquire(true, true);
    } catch {
      rejected = true;
    }
    check(rejected);
    lease.release();
    lease.release();
    check(stopped === 1 && broker.ownedTracks === 0);
    const denied = new BrowserCameraBroker({
      getUserMedia: async () => {
        throw new DOMException("", "NotAllowedError");
      },
    });
    try {
      await denied.acquire(true, true);
    } catch {}
    check(denied.state === "PERMISSION_DENIED");
    rejects(() => aggregateCalibrationExport(valid, false));
    const json = JSON.stringify(aggregateCalibrationExport(valid, true));
    check(!json.includes("coefficients") && !json.includes("cameraLeaseId") && !json.includes("trackId"));
  }
}

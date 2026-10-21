// Research controller allocation/transition cost only; run from the repository root.
// node --expose-gc --import tsx scripts/reach/research/session-epochs-20261021/benchmark-transitions.mjs --output <new absolute file>
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { performance } from "node:perf_hooks";
import { fileURLToPath, pathToFileURL } from "node:url";
const work = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
if (process.argv.length !== 4 || process.argv[2] !== "--output" || !path.isAbsolute(process.argv[3]))
  throw Error("EXPLICIT_ABSOLUTE_OUTPUT_REQUIRED");
const out = path.resolve(process.argv[3]),
  relativeOutput = path.relative(work, out);
if (!path.isAbsolute(relativeOutput) && relativeOutput !== ".." && !relativeOutput.startsWith(`..${path.sep}`))
  throw Error("OUTPUT_MUST_BE_OUTSIDE_REPOSITORY");
if (fs.existsSync(out)) throw Error("PRESERVE_BENCHMARK");
const source = work + "/scripts/reach/research/session-epochs-20261021/pointing-session-epoch.ts";
const hash = (p) => crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
const beforeHash = hash(source);
const { ResearchPointingSession } = await import(pathToFileURL(source).href);
const { indexImageAlgorithm } = await import(pathToFileURL(work + "/src/reach/index-image-tracker.ts").href);
const binding = {
  featureProfile: "INDEX_TIP_FUSED_V1",
  associationBasis: "INDEX_FUSED_TRACK_V1",
  providerId: indexImageAlgorithm.providerId,
  providerVersion: indexImageAlgorithm.providerVersion,
  modelDigest: indexImageAlgorithm.algorithmDigest,
  providerGeneration: 1,
  cameraLeaseId: "generated-cost-only",
  cameraFrameVersion: 1,
  viewportEpoch: 1,
  viewportWidth: 800,
  viewportHeight: 600,
  mirror: false,
  orientation: 0,
  trackId: "generated-cost-index",
  trackGeneration: 1,
  evidenceTier: "D0",
};
const session = new ResearchPointingSession({ binding, frameWidth: 640, frameHeight: 480 }, 0);
function frame(at) {
  return {
    observationVersion: 1,
    providerId: binding.providerId,
    providerVersion: binding.providerVersion,
    algorithmDigest: binding.modelDigest,
    providerGeneration: 1,
    cameraLeaseId: binding.cameraLeaseId,
    cameraFrameVersion: 1,
    frameWidth: 640,
    frameHeight: 480,
    mirrorTransform: "NONE",
    orientation: 0,
    sequence: at,
    monotonicCaptureTime: at,
    monotonicPixelOriginTime: at,
    monotonicInferenceTime: at + 1,
    trackId: binding.trackId,
    trackGeneration: 1,
    point: { x: 0.5, y: 0.5 },
    state: "TRACKING",
    anchorSource: "MODEL_INDEX",
    modelAgreement: "AGREE",
    quality: { correlation: 0.99, separation: 0.1, texture: 25, forwardBackwardErrorPixels: 0 },
    uncertaintyRadiusPixels: 1,
    reason: "ANALYTIC_COST_ONLY",
    measurements: {
      model: null,
      image: null,
      accepted: { x: 0.5, y: 0.5 },
      imageDisposition: "TIP",
      modelDisposition: "QUALIFIED",
    },
    temporalTrack: {
      state: "TRACKING",
      identity: "ESTABLISHED",
      intent: "POINT",
      measurementAgeMs: 1,
      positionUncertaintyPixels: 1,
      sourceGenerationCount: 1,
      hypothesisCount: 1,
      displayPoint: null,
    },
  };
}
let capture = 0,
  last;
for (let i = 0; i < 2000; i++) {
  capture += 16;
  last = session.observe(session.snapshot().token, frame(capture), capture + 1);
}
global.gc?.();
const heapBefore = process.memoryUsage().heapUsed,
  batches = [];
for (let batch = 0; batch < 30; batch++) {
  const started = performance.now();
  for (let i = 0; i < 1000; i++) {
    capture += 16;
    last = session.observe(session.snapshot().token, frame(capture), capture + 1);
  }
  batches.push((performance.now() - started) / 1000);
}
global.gc?.();
const heapAfter = process.memoryUsage().heapUsed;
const sorted = [...batches].sort((a, b) => a - b);
const result = {
  qualification: false,
  sourceSha256: beforeHash,
  kind: "NODE_GENERATED_CONTROLLER_COST",
  warmupObservations: 2000,
  measuredObservations: 30000,
  batches: 30,
  batchSize: 1000,
  medianMsPerObservation: sorted[14],
  p95BatchMeanMsPerObservation: sorted[28],
  maximumBatchMeanMsPerObservation: sorted[29],
  heapBeforeGcBytes: heapBefore,
  heapAfterGcBytes: heapAfter,
  retainedProcessHeapDeltaBytes: heapAfter - heapBefore,
  gcAvailable: typeof global.gc === "function",
  finalState: last.state,
  actionsPermitted: last.actionPermission,
  sourceUnchanged: beforeHash === hash(source),
  measurement:
    "Includes generated packet/snapshot allocation, provenance/readiness checks and controller transition. Batch means, not per-frame tail latency; heap delta is whole process, not an object-size proof. No neural/NCC/camera/browser, capture-to-display or physical latency measured.",
};
if (!result.sourceUnchanged || last.state !== "LOCAL_READY" || last.actionPermission !== false)
  throw Error("BENCHMARK_POSTCONDITION");
fs.writeFileSync(out, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify(result));

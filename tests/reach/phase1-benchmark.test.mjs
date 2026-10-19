import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import {
  validateDataset,
  validateReferences,
  isFreshMeasurement,
  summarizeArm,
  compareExpectedBaseline,
  runBenchmark,
} from "../../scripts/reach/phase1-benchmark.mjs";

const sha = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const context = {
  providerGeneration: 1,
  cameraLeaseId: "SYNTHETIC_PRIVATE_CONTEXT",
  cameraFrameVersion: 1,
  mirrorTransform: "PREVIEW_X",
  orientation: 0,
  frameWidth: 640,
  frameHeight: 480,
};
function dataset() {
  const gray = Buffer.from([1, 2, 3, 4, 5, 6]);
  const rows = [0, 1, 2].map((i) => ({
    source: { index: i + 1, ptsSeconds: i / 10, step: i === 1 ? "RIGHT" : "CENTER" },
    capture: 1000 + i * 100,
    prepareStarted: 1001 + i * 100,
    received: 1008 + i * 100,
    completed: 1010 + i * 100,
    packet: { capture: 1000 + i * 100, inferenceTime: 1006 + i * 100, width: 640, height: 480, result: {} },
    modelObservation: { ...context },
    output: { ...context },
    grayPlane: { offset: i * 2, length: 2, sha256: sha(gray.subarray(i * 2, i * 2 + 2)) },
  }));
  const receipt = {
    completed: true,
    sourceStable: true,
    browserClosed: true,
    error: null,
    processedFrames: 3,
    grayBytes: gray.length,
    grayStreamSha256: sha(gray),
    sourceVideoSha256: "a".repeat(64),
    ready: { backend: "SYNTHETIC", providerPolicy: "SYNTHETIC" },
  };
  return { rows, gray, receipt, expectedFrames: 3, grayWidth: 2, grayHeight: 1 };
}
function measured(row, id = "private-logical-index-1") {
  return {
    accepted: true,
    error: false,
    cpuMs: 1,
    output: {
      ...context,
      state: "TRACKING",
      reason: "IMAGE_MATCH",
      trackId: id,
      point: { x: 0.25, y: 0.5 },
      measurements: { accepted: { x: 0.25, y: 0.5 } },
      monotonicCaptureTime: row.capture,
      temporalTrack: { state: "TRACKING", measurementAgeMs: 10 },
    },
    readiness: { eligible: true },
  };
}
const absent = {
  accepted: true,
  output: { state: "LOST", point: null, reason: "APPEARANCE_MISMATCH", trackId: "private-logical-index-1" },
  readiness: { eligible: false },
  cpuMs: 2,
};

test("validates all original frames and rejects chronology, context, clocks, exact-plane corruption and truncation", () => {
  assert.deepEqual(validateDataset(dataset()), context);
  for (const [change, error] of [
    [
      (d) => {
        d.rows[1].capture = d.rows[0].capture;
        d.rows[1].packet.capture = d.rows[0].capture;
      },
      /CHRONOLOGY/,
    ],
    [
      (d) => {
        d.rows[1].source.index = 1;
      },
      /CHRONOLOGY/,
    ],
    [
      (d) => {
        d.rows[1].modelObservation.cameraLeaseId = "FOREIGN";
      },
      /CONTEXT_CHANGED/,
    ],
    [
      (d) => {
        d.rows[1].completed = 0;
      },
      /CLOCK_INVALID/,
    ],
    [
      (d) => {
        d.rows[1].modelObservation.monotonicPixelOriginTime = NaN;
      },
      /PIXEL_ORIGIN_INVALID/,
    ],
    [
      (d) => {
        d.rows[1].grayPlane.sha256 = "0".repeat(64);
      },
      /PLANE_HASH/,
    ],
    [
      (d) => {
        d.rows.pop();
      },
      /DENOMINATOR/,
    ],
    [
      (d) => {
        d.receipt.sourceStable = false;
      },
      /RECEIPT_INCOMPLETE/,
    ],
    [
      (d) => {
        d.gray[0] = 0;
      },
      /STREAM_HASH/,
    ],
  ]) {
    const data = dataset();
    change(data);
    assert.throws(() => validateDataset(data), error);
  }
});

test("prediction, stale pixel origin, missing measurement ledger and stale packet never count as fresh", () => {
  const row = dataset().rows[0];
  assert.equal(isFreshMeasurement(row, measured(row)), true);
  for (const change of [
    (r) => {
      r.output.state = "UNCERTAIN";
      r.output.temporalTrack.state = "COASTING";
    },
    (r) => {
      r.output.monotonicPixelOriginTime = row.capture - 200;
    },
    (r) => {
      r.output.measurements.accepted = null;
    },
    (r) => {
      r.output.monotonicCaptureTime--;
    },
    (r) => {
      r.output.temporalTrack.measurementAgeMs = 151;
    },
    (r) => {
      r.output.point = { x: 2, y: 0.5 };
      r.output.measurements.accepted = r.output.point;
    },
  ]) {
    const result = measured(row);
    change(result);
    assert.equal(isFreshMeasurement(row, result), false);
  }
  assert.equal(isFreshMeasurement({ ...row, completed: row.capture + 151 }, measured(row)), false);
  const stalePixels = structuredClone(row);
  stalePixels.modelObservation.monotonicPixelOriginTime = row.capture - 200;
  assert.equal(isFreshMeasurement(stalePixels, measured(row)), false); // A reconstructed fresh output cannot erase known old input pixels.
});

test("availability denominator, across-prompt continuity, identity replacements and censored loss stay distinct", () => {
  const { rows } = dataset();
  const same = summarizeArm(rows, [measured(rows[0]), absent, measured(rows[2])]);
  assert.equal(same.all.packets, 3);
  assert.equal(same.all.measuredPositions, 2);
  assert.equal(same.all.missingOrUnusablePositions, 1);
  assert.equal(same.all.observedAvailabilityReturns.sameLogicalId.n, 1);
  assert.equal(same.all.observedAvailabilityReturns.sameLogicalId.median, 100);
  assert.equal(same.all.logicalIdChanges, 0);
  const replacement = summarizeArm(rows, [measured(rows[0]), absent, measured(rows[2], "new-private-index")]);
  assert.equal(replacement.all.logicalIdChanges, 1);
  assert.equal(replacement.all.observedAvailabilityReturns.replacementLogicalId.n, 1);
  const lost = summarizeArm(rows, [measured(rows[0]), absent, absent]);
  assert.equal(lost.all.observedAvailabilityReturns.rightCensoredLossIntervals, 1);
  const serialized = JSON.stringify(replacement);
  assert.equal(serialized.includes("new-private-index"), false);
  assert.equal(serialized.includes("SYNTHETIC_PRIVATE_CONTEXT"), false);
  assert.equal(serialized.includes('"point"'), false);
});

test("exact baseline comparison detects changes without exposing coordinate or logical-identity values", () => {
  const { rows } = dataset(),
    results = rows.map((row) => measured(row));
  const expected = rows.map((row, i) => ({
    ...row,
    output: structuredClone(results[i].output),
    imageAccepted: true,
    readiness: results[i].readiness,
  }));
  assert.equal(compareExpectedBaseline(rows, results, expected).outputDifferences, 0);
  expected[1].output.point.x = 0.9;
  expected[2].readiness = { eligible: false };
  const compared = compareExpectedBaseline(rows, results, expected);
  assert.equal(compared.outputDifferences, 1);
  assert.equal(compared.readinessDifferences, 1);
  assert.deepEqual(compared.differingOutputFields, { point: 1 });
  expected[0].capture++;
  assert.throws(() => compareExpectedBaseline(rows, results, expected), /EXPECTED_BASELINE_INPUT_MISMATCH/);
});

function labelsFor(data) {
  return {
    version: 1,
    provenance: {
      inputResultsSha256: "b".repeat(64),
      sourceVideoSha256: data.receipt.sourceVideoSha256,
      origin: "AI_VISUAL_ESTIMATE",
      split: "DEVELOPMENT",
      independentlyReviewed: false,
      blindedToCandidate: false,
      sealedBeforeCandidate: false,
      coordinateConvention: "MIRRORED_NATIVE_PIXEL_CENTERS",
    },
    annotations: [
      {
        sourceIndex: 1,
        visibility: "VISIBLE",
        kind: "POINTING_INDEX",
        point: { x: 0.75 * 639, y: 0.5 * 479 },
        radiusPixels: 3,
      },
      {
        sourceIndex: 2,
        visibility: "VISIBLE",
        kind: "POINTING_INDEX",
        point: { x: 0.75 * 639, y: 0.5 * 479 },
        radiusPixels: 3,
      },
      { sourceIndex: 3, visibility: "VISIBLE", kind: "NEGATIVE_POINTER" },
    ],
  };
}

test("reference provenance rejects model truth and fabricated holdout; reports conditional error and missingness separately", () => {
  const data = dataset(),
    labels = labelsFor(data),
    digest = "b".repeat(64);
  const references = validateReferences(labels, data.receipt, digest, data.rows);
  const summary = summarizeArm(data.rows, [measured(data.rows[0]), absent, measured(data.rows[2])], references);
  assert.equal(summary.all.reviewedReferences.visiblePointing, 2);
  assert.equal(summary.all.reviewedReferences.positions, 1);
  assert.equal(summary.all.reviewedReferences.missing, 1);
  assert.equal(summary.all.reviewedReferences.insideUncertaintyRegion, 1);
  assert.equal(summary.all.reviewedReferences.negativePointerOutputs, 1);
  for (const [change, error] of [
    [
      (p) => {
        p.provenance.origin = "MODEL_OUTPUT";
      },
      /PROVENANCE_INVALID/,
    ],
    [
      (p) => {
        p.provenance.split = "HELD_OUT";
      },
      /HOLDOUT_UNPROVED/,
    ],
    [
      (p) => {
        p.provenance.sourceVideoSha256 = "wrong";
      },
      /PROVENANCE_INVALID/,
    ],
    [
      (p) => {
        p.annotations[1].sourceIndex = 1;
      },
      /LABEL_INVALID/,
    ],
  ]) {
    const bad = structuredClone(labels);
    change(bad);
    assert.throws(() => validateReferences(bad, data.receipt, digest, data.rows), error);
  }
});

test("real runner pins inputs, processes once without prompt reset, preserves files and rejects output reuse", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "reach-benchmark-contract-"));
  try {
    const data = dataset(),
      write = (name, bytes) => {
        const file = path.join(dir, name);
        fs.writeFileSync(file, bytes);
        return file;
      };
    const results = write("packets.ndjson", data.rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
    const gray = write("gray.bin", data.gray);
    data.receipt.resultsSha256 = sha(fs.readFileSync(results));
    const receipt = write("receipt.json", JSON.stringify(data.receipt));
    const moduleBytes = `class IndexImageTracker { constructor() { this.calls=0; } prepare(frame) { this.frame=frame; return true; } complete() { this.calls++; const point={x:.25,y:.5}; return { state:'TRACKING',reason:'IMAGE_MATCH',trackId:'secret-index',point,measurements:{accepted:point},monotonicCaptureTime:this.frame.capture,temporalTrack:{state:'TRACKING',measurementAgeMs:10},call:this.calls }; } }
class BrowserHandAdapter { envelope(result,capture,inference,width,height,callback) { callback(null); } }
class Gate { accept(value) { return value; } }
class IndexImageReadiness { update(o) { return { eligible:o.call>=3 }; } pause() {} }
module.exports={IndexImageTracker,BrowserHandAdapter,ObservationGate:Gate,IndexImageObservationGate:Gate,IndexImageReadiness,selectIndexModelAnchor:()=>null};`;
    const baseline = write("frozen.cjs", moduleBytes),
      output = path.join(dir, "comparison");
    const options = {
      ...data,
      results,
      gray,
      receipt,
      receiptSha256: sha(fs.readFileSync(receipt)),
      baseline,
      baselineSha256: sha(moduleBytes),
      candidate: baseline,
      candidateSha256: sha(moduleBytes),
      output,
    };
    const report = runBenchmark(options);
    assert.equal(report.completed, true);
    assert.equal(report.baseline.all.measuredPositions, 3);
    assert.equal(report.baseline.all.readinessEligible, 1); // One consumer across CENTER -> RIGHT -> CENTER.
    assert.equal(report.paired.positionAvailabilityGains, 0);
    assert.equal(report.input.promptResets, 0);
    assert.equal(report.unavailable.captureToVisibleLatency.includes("reused"), true);
    assert.equal(report.unavailable.statisticalUncertainty.includes("serially correlated"), true);
    assert.equal(JSON.stringify(report).includes("secret-index"), false);
    assert.equal(JSON.stringify(report).includes(dir), false);
    assert.equal(sha(fs.readFileSync(results)), data.receipt.resultsSha256);
    assert.throws(() => runBenchmark(options), /EEXIST/);
    assert.throws(
      () => runBenchmark({ ...options, output: path.join(dir, "bad"), baselineSha256: "0".repeat(64) }),
      /HASH_MISMATCH/,
    );
    const staleRows = data.rows.map((row) => ({
      ...row,
      modelObservation: { ...row.modelObservation, monotonicPixelOriginTime: row.capture - 200 },
    }));
    const staleResults = write("old-pixels.ndjson", staleRows.map((row) => JSON.stringify(row)).join("\n") + "\n");
    const staleReceiptBytes = JSON.stringify({ ...data.receipt, resultsSha256: sha(fs.readFileSync(staleResults)) });
    const staleReceipt = write("old-pixels-receipt.json", staleReceiptBytes);
    const staleReport = runBenchmark({
      ...options,
      results: staleResults,
      receipt: staleReceipt,
      receiptSha256: sha(staleReceiptBytes),
      output: path.join(dir, "old-pixels"),
    });
    assert.equal(staleReport.completed, true);
    assert.equal(staleReport.baseline.all.freshInputPackets, 0);
    assert.equal(staleReport.baseline.all.measuredPositions, 0);
    assert.equal(staleReport.baseline.all.readinessEligible, 0);
    const dependency = write("helper.cjs", moduleBytes);
    const wrapperBytes = "module.exports = require('./helper.cjs');";
    const wrapper = write("candidate.cjs", wrapperBytes);
    const unpinned = runBenchmark({
      ...options,
      candidate: wrapper,
      candidateSha256: sha(wrapperBytes),
      output: path.join(dir, "unbound-import"),
    });
    assert.equal(unpinned.completed, false);
    assert.equal(unpinned.error, "UNPINNED_EXECUTABLE_DEPENDENCY");
    const manifestBytes = JSON.stringify({ files: [{ path: "helper.cjs", sha256: sha(fs.readFileSync(dependency)) }] });
    const dependencies = write("dependencies.json", manifestBytes);
    const pinned = runBenchmark({
      ...options,
      candidate: wrapper,
      candidateSha256: sha(wrapperBytes),
      dependencies,
      dependenciesSha256: sha(manifestBytes),
      output: path.join(dir, "bound-import"),
    });
    assert.equal(pinned.completed, true);
    assert.deepEqual(pinned.executable.importedDependencySha256, [sha(moduleBytes)]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

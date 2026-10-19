/**
 * Same-input Reach interpretation benchmark. Never opens a camera or runs inference.
 *
 * node scripts/reach/phase1-benchmark.mjs --results <ndjson> --gray <bin>
 *   --receipt <json> --receipt-sha256 <sha256> --expected-frames <count>
 *   --gray-width <width> --gray-height <height>
 *   --baseline <standalone.cjs> --baseline-sha256 <sha256>
 *   --candidate <standalone.cjs> --candidate-sha256 <sha256> --output <new-directory>
 * Optional: --labels <reference-json> --labels-sha256 <sha256>;
 * --expected-baseline-results <ndjson> --expected-baseline-sha256 <sha256>.
 * Imported local modules require --dependencies <json> --dependencies-sha256 <sha256>;
 * the JSON has {files:[{path,sha256}]} and paths resolve beside that manifest.
 * Modules export the canonical adapter, gates, tracker, readiness and anchor selector.
 * Executable modules must already be reviewed; byte pins are not a code sandbox.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";

const require = createRequire(import.meta.url);
const FRESH_MS = 150;
const PUBLIC_SCENARIOS = new Set([
  "CENTER",
  "BOTTOM",
  "TOP",
  "LEFT",
  "RIGHT",
  "TOP_LEFT",
  "TOP_RIGHT",
  "BOTTOM_LEFT",
  "BOTTOM_RIGHT",
  "SWEEP",
  "FAST",
  "OCCLUDE",
  "OPEN",
  "RECOVER",
  "HIDE",
  "OPEN_PALM",
  "RELAXED",
]);
const CONTEXT_FIELDS = [
  "providerGeneration",
  "cameraLeaseId",
  "cameraFrameVersion",
  "mirrorTransform",
  "orientation",
  "frameWidth",
  "frameHeight",
];
const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const fail = (code) => {
  throw new Error(code);
};
const finite = Number.isFinite;
const point = (p) => p && finite(p.x) && finite(p.y) && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1;
const equalPoint = (a, b) => point(a) && point(b) && a.x === b.x && a.y === b.y;
const scenario = (row) => (PUBLIC_SCENARIOS.has(row.source.step) ? row.source.step : "OTHER");
const increment = (counts, key) => {
  counts[key] = (counts[key] ?? 0) + 1;
};
const sourcePixelOrigin = (row) =>
  Math.min(
    row.capture,
    ...[row.modelObservation?.monotonicPixelOriginTime, row.output?.monotonicPixelOriginTime].filter(finite),
  );
const hasPixelOrigin = (row) =>
  row.modelObservation?.monotonicPixelOriginTime !== undefined || row.output?.monotonicPixelOriginTime !== undefined;

export function distribution(values) {
  const sorted = [...values].filter(finite).sort((a, b) => a - b);
  const q = (p) => sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)] ?? null;
  return { n: sorted.length, median: q(0.5), p95: q(0.95), maximum: sorted.at(-1) ?? null };
}

/** Validate clocks, stable context and every exact grayscale slice before executing modules. */
export function validateDataset({ rows, gray, receipt, expectedFrames, grayWidth, grayHeight }) {
  if (!receipt.completed || !receipt.sourceStable || !receipt.browserClosed || receipt.error || receipt.timedOut)
    fail("INPUT_RECEIPT_INCOMPLETE");
  if (
    !Number.isSafeInteger(expectedFrames) ||
    expectedFrames < 1 ||
    rows.length !== expectedFrames ||
    receipt.processedFrames !== expectedFrames
  )
    fail("INPUT_DENOMINATOR_MISMATCH");
  if (![grayWidth, grayHeight].every((n) => Number.isSafeInteger(n) && n > 0)) fail("GRAY_DIMENSIONS_INVALID");
  if (gray.length !== receipt.grayBytes || sha256(gray) !== receipt.grayStreamSha256) fail("GRAY_STREAM_HASH_MISMATCH");
  if (!receipt.ready?.backend || !receipt.ready?.providerPolicy) fail("INPUT_PROVIDER_UNBOUND");
  const context = rows[0]?.modelObservation ?? rows[0]?.output;
  if (!context || CONTEXT_FIELDS.some((key) => context[key] == null)) fail("INPUT_CONTEXT_MISSING");
  let offset = 0;
  const seen = new Set();
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index],
      previous = rows[index - 1];
    const clocks = [
      row.capture,
      row.prepareStarted,
      row.received,
      row.completed,
      row.packet?.inferenceTime,
      row.source?.ptsSeconds,
    ];
    if (
      !clocks.every(finite) ||
      row.prepareStarted < row.capture ||
      row.received < row.capture ||
      row.completed < row.received ||
      row.packet.inferenceTime < row.capture ||
      row.packet.inferenceTime > row.received + 5
    )
      fail("INPUT_CLOCK_INVALID");
    if (
      !Number.isSafeInteger(row.source.index) ||
      seen.has(row.source.index) ||
      (previous &&
        (row.source.index <= previous.source.index ||
          row.source.ptsSeconds <= previous.source.ptsSeconds ||
          row.capture <= previous.capture))
    )
      fail("INPUT_CHRONOLOGY_INVALID");
    seen.add(row.source.index);
    if (
      row.packet.capture !== row.capture ||
      row.packet.width !== context.frameWidth ||
      row.packet.height !== context.frameHeight
    )
      fail("INPUT_PACKET_BINDING_MISMATCH");
    for (const envelope of [row.modelObservation, row.output].filter(Boolean)) {
      if (CONTEXT_FIELDS.some((key) => envelope[key] !== context[key])) fail("INPUT_CONTEXT_CHANGED");
      if (
        envelope.monotonicPixelOriginTime !== undefined &&
        (!finite(envelope.monotonicPixelOriginTime) ||
          envelope.monotonicPixelOriginTime < 0 ||
          envelope.monotonicPixelOriginTime > row.capture + 5)
      )
        fail("INPUT_PIXEL_ORIGIN_INVALID");
    }
    const plane = row.grayPlane;
    if (
      !plane ||
      plane.offset !== offset ||
      plane.length !== grayWidth * grayHeight ||
      plane.offset + plane.length > gray.length
    )
      fail("GRAY_PLANE_LAYOUT_INVALID");
    const bytes = gray.subarray(plane.offset, plane.offset + plane.length);
    if (sha256(bytes) !== plane.sha256) fail("GRAY_PLANE_HASH_MISMATCH");
    offset += plane.length;
  }
  if (offset !== gray.length) fail("GRAY_TRAILING_BYTES");
  return Object.fromEntries(CONTEXT_FIELDS.map((key) => [key, context[key]]));
}

/** Predicted display points, old pixel origins and nontracking outputs are never measurements. */
export function isFreshMeasurement(row, result) {
  const o = result?.output;
  const origin = Math.min(o?.monotonicPixelOriginTime ?? o?.monotonicCaptureTime, sourcePixelOrigin(row));
  return !!(
    result?.accepted &&
    o?.state === "TRACKING" &&
    o.trackId &&
    point(o.point) &&
    equalPoint(o.point, o.measurements?.accepted) &&
    o.monotonicCaptureTime === row.capture &&
    finite(origin) &&
    origin <= row.capture + 5 &&
    row.completed >= origin &&
    row.completed - origin <= FRESH_MS &&
    row.completed - row.capture <= FRESH_MS &&
    (!o.temporalTrack ||
      (o.temporalTrack.state === "TRACKING" &&
        finite(o.temporalTrack.measurementAgeMs) &&
        o.temporalTrack.measurementAgeMs <= FRESH_MS))
  );
}

/** Reference attestations are reported, never converted into automatic ground-truth authority. */
export function validateReferences(labels, receipt, resultsSha256, rows) {
  if (!labels) return null;
  const p = labels.provenance;
  if (
    labels.version !== 1 ||
    !p ||
    p.inputResultsSha256 !== resultsSha256 ||
    p.sourceVideoSha256 !== receipt.sourceVideoSha256 ||
    !["HUMAN_REVIEW", "AI_VISUAL_ESTIMATE"].includes(p.origin) ||
    !["DEVELOPMENT", "HELD_OUT"].includes(p.split) ||
    typeof p.independentlyReviewed !== "boolean" ||
    typeof p.blindedToCandidate !== "boolean" ||
    typeof p.sealedBeforeCandidate !== "boolean" ||
    p.coordinateConvention !== "MIRRORED_NATIVE_PIXEL_CENTERS" ||
    !Array.isArray(labels.annotations)
  )
    fail("REFERENCE_PROVENANCE_INVALID");
  if ((rows[0].modelObservation ?? rows[0].output).mirrorTransform !== "PREVIEW_X")
    fail("REFERENCE_MIRROR_CONVENTION_UNSUPPORTED");
  if (p.split === "HELD_OUT" && (!p.independentlyReviewed || !p.blindedToCandidate || !p.sealedBeforeCandidate))
    fail("REFERENCE_HOLDOUT_UNPROVED");
  const indices = new Set(rows.map((r) => r.source.index)),
    seen = new Set();
  for (const label of labels.annotations) {
    if (
      !indices.has(label.sourceIndex) ||
      seen.has(label.sourceIndex) ||
      !["VISIBLE", "AMBIGUOUS", "NOT_VISIBLE"].includes(label.visibility) ||
      !["POINTING_INDEX", "NEGATIVE_POINTER", "UNRESOLVED"].includes(label.kind)
    )
      fail("REFERENCE_LABEL_INVALID");
    seen.add(label.sourceIndex);
    if (
      label.visibility === "VISIBLE" &&
      label.kind === "POINTING_INDEX" &&
      (!label.point ||
        !finite(label.point.x) ||
        !finite(label.point.y) ||
        label.point.x < 0 ||
        label.point.y < 0 ||
        label.point.x > rows[0].packet.width - 1 ||
        label.point.y > rows[0].packet.height - 1 ||
        !finite(label.radiusPixels) ||
        label.radiusPixels < 0)
    )
      fail("REFERENCE_COORDINATE_INVALID");
  }
  return { ...labels, byIndex: new Map(labels.annotations.map((label) => [label.sourceIndex, label])) };
}

function newAccumulator() {
  return {
    packets: 0,
    freshInputPackets: 0,
    measuredPositions: 0,
    readinessEligible: 0,
    logicalIdChanges: 0,
    errors: 0,
    states: {},
    reasons: {},
    researchMechanism: {},
    cpuMs: [],
    previousId: null,
    previousMeasuredId: null,
    gap: null,
    sameLogicalIdReturnsMs: [],
    replacementReturnsMs: [],
    references: {
      visiblePointing: 0,
      positions: 0,
      missing: 0,
      insideUncertaintyRegion: 0,
      outsideUncertaintyRegion: 0,
      negativePointer: 0,
      negativePointerOutputs: 0,
      ambiguousOrNonvisible: 0,
      errorPixels: [],
    },
  };
}

export function summarizeArm(rows, results, references = null) {
  if (rows.length !== results.length) fail("SUMMARY_DENOMINATOR_MISMATCH");
  const all = newAccumulator(),
    groups = {};
  function add(a, row, result) {
    a.packets++;
    if (row.completed - sourcePixelOrigin(row) <= FRESH_MS) a.freshInputPackets++;
    const o = result.output,
      measured = isFreshMeasurement(row, result),
      id = result.accepted && o?.trackId;
    if (id) {
      if (a.previousId && a.previousId !== id) a.logicalIdChanges++;
      a.previousId = id;
    }
    if (measured) {
      a.measuredPositions++;
      if (result.readiness?.eligible) a.readinessEligible++;
      if (a.gap) {
        const duration = row.source.ptsSeconds * 1000 - a.gap.startMs;
        (a.gap.id === id ? a.sameLogicalIdReturnsMs : a.replacementReturnsMs).push(duration);
        a.gap = null;
      }
      a.previousMeasuredId = id;
    } else if (a.previousMeasuredId && !a.gap)
      a.gap = { startMs: row.source.ptsSeconds * 1000, id: a.previousMeasuredId };
    increment(a.states, result.accepted && o ? o.state : "REJECTED");
    // Reasons are fixed code identifiers, never arbitrary exception text or source prompts.
    increment(a.reasons, /^[A-Z][A-Z0-9_]{0,79}$/.test(o?.reason ?? "") ? o.reason : "UNAVAILABLE");
    if (result.error) a.errors++;
    for (const [key, value] of Object.entries(result.researchDelta ?? {}))
      a.researchMechanism[key] = (a.researchMechanism[key] ?? 0) + value;
    a.cpuMs.push(result.cpuMs);
    const label = references?.byIndex.get(row.source.index);
    if (!label) return;
    const r = a.references;
    if (label.kind === "NEGATIVE_POINTER") {
      r.negativePointer++;
      if (measured) r.negativePointerOutputs++;
    } else if (label.visibility === "VISIBLE" && label.kind === "POINTING_INDEX") {
      r.visiblePointing++;
      if (!measured) r.missing++;
      else {
        r.positions++;
        const error = Math.hypot(
          (1 - o.point.x) * (row.packet.width - 1) - label.point.x,
          o.point.y * (row.packet.height - 1) - label.point.y,
        );
        r.errorPixels.push(error);
        increment(r, error <= label.radiusPixels ? "insideUncertaintyRegion" : "outsideUncertaintyRegion");
      }
    } else r.ambiguousOrNonvisible++;
  }
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index],
      result = results[index],
      name = scenario(row);
    add(all, row, result);
    add((groups[name] ??= newAccumulator()), row, result);
  }
  const finish = (a) => ({
    packets: a.packets,
    freshInputPackets: a.freshInputPackets,
    measuredPositions: a.measuredPositions,
    missingOrUnusablePositions: a.packets - a.measuredPositions,
    readinessEligible: a.readinessEligible,
    logicalIdChanges: a.logicalIdChanges,
    rejectedOrErrorFrames: a.errors,
    states: a.states,
    reasons: a.reasons,
    observedAvailabilityReturns: {
      sameLogicalId: distribution(a.sameLogicalIdReturnsMs),
      replacementLogicalId: distribution(a.replacementReturnsMs),
      rightCensoredLossIntervals: a.gap ? 1 : 0,
      interpretation:
        "Observed availability gaps only; logical IDs do not establish anatomical same-finger recovery. Initial acquisition excluded. Durations start at first missing source frame.",
    },
    interpretationCpuMs: { ...distribution(a.cpuMs), total: a.cpuMs.reduce((a, b) => a + b, 0) },
    researchMechanismCounters: a.researchMechanism,
    reviewedReferences: references
      ? {
          ...a.references,
          errorPixels: distribution(a.references.errorPixels),
          authority: "REFERENCE_ESTIMATES_NOT_CERTIFIED_GROUND_TRUTH",
        }
      : null,
  });
  return {
    all: finish(all),
    byScenario: Object.fromEntries(Object.entries(groups).map(([key, a]) => [key, finish(a)])),
  };
}

function createConsumer(api, context, receipt) {
  const binding = Object.fromEntries(CONTEXT_FIELDS.slice(0, 4).map((key) => [key, context[key]]));
  const gates = { ...binding, orientation: context.orientation };
  return {
    api,
    tracker: new api.IndexImageTracker({
      ...binding,
      frameWidth: context.frameWidth,
      frameHeight: context.frameHeight,
    }),
    adapter: new api.BrowserHandAdapter(binding, "UNQUALIFIED", receipt.ready.backend, receipt.ready.providerPolicy),
    modelGate: new api.ObservationGate(gates),
    imageGate: new api.IndexImageObservationGate(gates),
    readiness: new api.IndexImageReadiness(),
  };
}

function processFrame(consumer, row, pixels, width, height) {
  const { api, tracker, adapter, modelGate, imageGate, readiness } = consumer;
  const origin = sourcePixelOrigin(row);
  const fresh = () => row.completed - origin <= FRESH_MS;
  const started = performance.now();
  let output = null,
    accepted = false,
    ready = null,
    error = false;
  const research = () =>
    Object.fromEntries(
      ["eligible", "proposals", "probation", "attemptedCommits", "commits", "rejectedCommits"]
        .filter((key) => finite(tracker.__research?.[key]))
        .map((key) => [key, tracker.__research[key]]),
    );
  const beforeResearch = research();
  try {
    // Each arm receives its own immutable-input copy; candidate writes cannot contaminate baseline.
    const token = tracker.prepare({
      data: new Uint8Array(pixels),
      width,
      height,
      capture: row.capture,
      received: row.prepareStarted,
    });
    let observation = null;
    adapter.envelope(
      structuredClone(row.packet.result),
      row.capture,
      row.packet.inferenceTime,
      row.packet.width,
      row.packet.height,
      (candidate) => {
        if (!fresh()) return false;
        if (candidate)
          observation = modelGate.accept(
            hasPixelOrigin(row) ? { ...candidate, monotonicPixelOriginTime: origin } : candidate,
            row.received,
            fresh,
          );
        return true;
      },
    );
    if (token) {
      output = tracker.complete(token, api.selectIndexModelAnchor(observation), () => row.completed, fresh);
      if (output && hasPixelOrigin(row))
        output = {
          ...output,
          monotonicPixelOriginTime: Math.min(output.monotonicPixelOriginTime ?? row.capture, origin),
        };
      output = imageGate.accept(output, row.completed, fresh);
      accepted = true;
      ready = readiness.update(output);
    }
  } catch {
    error = true;
    readiness.pause();
  }
  return {
    output,
    accepted,
    readiness: ready,
    error,
    cpuMs: performance.now() - started,
    researchDelta: Object.fromEntries(
      Object.entries(research()).map(([key, value]) => [key, value - (beforeResearch[key] ?? 0)]),
    ),
  };
}

function readPinned(file, expected) {
  if (!/^[a-f0-9]{64}$/.test(expected ?? "")) fail("EXPECTED_SHA256_REQUIRED");
  const bytes = fs.readFileSync(file);
  if (sha256(bytes) !== expected) fail("PINNED_FILE_HASH_MISMATCH");
  return bytes;
}

const canonical = (value) =>
  JSON.stringify(value, (_, item) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(
          Object.keys(item)
            .sort()
            .map((key) => [key, item[key]]),
        )
      : item,
  );

export function compareExpectedBaseline(rows, results, expected) {
  if (
    expected.length !== rows.length ||
    expected.some(
      (row, i) =>
        row.source.index !== rows[i].source.index ||
        row.capture !== rows[i].capture ||
        row.completed !== rows[i].completed,
    )
  )
    fail("EXPECTED_BASELINE_INPUT_MISMATCH");
  const differingOutputFields = {};
  for (let i = 0; i < results.length; i++)
    for (const key of new Set([...Object.keys(results[i].output ?? {}), ...Object.keys(expected[i].output ?? {})]))
      if (canonical(results[i].output?.[key]) !== canonical(expected[i].output?.[key]))
        increment(differingOutputFields, key);
  return {
    rows: rows.length,
    outputDifferences: results.filter((result, i) => canonical(result.output) !== canonical(expected[i].output)).length,
    readinessDifferences: results.filter(
      (result, i) => canonical(result.readiness) !== canonical(expected[i].readiness),
    ).length,
    acceptedDifferences: results.filter((result, i) => result.accepted !== expected[i].imageAccepted).length,
    differingOutputFields,
  };
}

export function runBenchmark(options) {
  const receiptBytes = readPinned(options.receipt, options.receiptSha256),
    receipt = JSON.parse(receiptBytes);
  const resultBytes = fs.readFileSync(options.results),
    gray = fs.readFileSync(options.gray);
  if (sha256(resultBytes) !== receipt.resultsSha256) fail("RESULTS_HASH_MISMATCH");
  const rows = resultBytes
    .toString("utf8")
    .trim()
    .split(/\r?\n/)
    .map((line) => JSON.parse(line));
  const context = validateDataset({ ...options, rows, gray, receipt });
  const labelBytes = options.labels ? readPinned(options.labels, options.labelsSha256) : null;
  const references = validateReferences(labelBytes && JSON.parse(labelBytes), receipt, receipt.resultsSha256, rows);
  const expectedBytes = options.expectedBaselineResults
    ? readPinned(options.expectedBaselineResults, options.expectedBaselineSha256)
    : null;
  const expectedBaseline = expectedBytes
    ?.toString("utf8")
    .trim()
    .split(/\r?\n/)
    .map((line) => JSON.parse(line));
  const dependencyBytes = options.dependencies ? readPinned(options.dependencies, options.dependenciesSha256) : null;
  const dependencyFiles = dependencyBytes ? JSON.parse(dependencyBytes).files : [];
  if (
    !Array.isArray(dependencyFiles) ||
    dependencyFiles.some((file) => typeof file.path !== "string" || !/^[a-f0-9]{64}$/.test(file.sha256))
  )
    fail("DEPENDENCY_MANIFEST_INVALID");
  const dependencyPins = dependencyFiles.map((file) => [
    path.resolve(path.dirname(options.dependencies), file.path),
    file.sha256,
  ]);
  const pins = [
    [options.receipt, options.receiptSha256],
    [options.results, receipt.resultsSha256],
    [options.gray, receipt.grayStreamSha256],
    [options.baseline, options.baselineSha256],
    [options.candidate, options.candidateSha256],
    ...(options.labels ? [[options.labels, options.labelsSha256]] : []),
    ...(expectedBytes ? [[options.expectedBaselineResults, options.expectedBaselineSha256]] : []),
    ...(dependencyBytes ? [[options.dependencies, options.dependenciesSha256]] : []),
    ...dependencyPins,
  ];
  for (const [file, digest] of pins) readPinned(file, digest);
  fs.mkdirSync(options.output); // Never overwrite a prior or failed receipt.
  let report;
  try {
    const allowedModules = new Set(
      [options.baseline, options.candidate, ...dependencyPins.map(([file]) => file)].map((file) => path.resolve(file)),
    );
    const checkImports = (module, visited = new Set()) => {
      if (!module || visited.has(module)) return;
      visited.add(module);
      for (const child of module?.children ?? []) {
        if (!allowedModules.has(child.filename)) fail("UNPINNED_EXECUTABLE_DEPENDENCY");
        checkImports(child, visited);
      }
    };
    const loadedModules = [];
    const apis = Object.fromEntries(
      ["baseline", "candidate"].map((name) => {
        const resolved = require.resolve(path.resolve(options[name]));
        // Module-local logical generation counters must not leak between comparison arms.
        for (const file of allowedModules) delete require.cache[file];
        const api = require(resolved),
          loadedModule = require.cache[resolved];
        checkImports(loadedModule);
        loadedModules.push(loadedModule);
        return [name, api];
      }),
    );
    for (const api of Object.values(apis))
      for (const key of [
        "IndexImageTracker",
        "BrowserHandAdapter",
        "ObservationGate",
        "IndexImageObservationGate",
        "IndexImageReadiness",
        "selectIndexModelAnchor",
      ])
        if (typeof api[key] !== "function") fail("MODULE_EXPORT_MISSING");
    const consumers = Object.fromEntries(
      Object.entries(apis).map(([name, api]) => [name, createConsumer(api, context, receipt)]),
    );
    const results = { baseline: [], candidate: [] };
    for (let index = 0; index < rows.length; index++) {
      const row = rows[index],
        pixels = gray.subarray(row.grayPlane.offset, row.grayPlane.offset + row.grayPlane.length);
      for (const name of index % 2 ? ["candidate", "baseline"] : ["baseline", "candidate"])
        results[name].push(processFrame(consumers[name], row, pixels, options.grayWidth, options.grayHeight));
    }
    for (const [file, digest] of pins) readPinned(file, digest);
    for (const loadedModule of loadedModules) checkImports(loadedModule);
    const baseline = summarizeArm(rows, results.baseline, references),
      candidate = summarizeArm(rows, results.candidate, references);
    report = {
      version: 1,
      classification: "SAFE_AGGREGATE_CACHED_SAME_FRAME_INTERPRETATION_COMPARISON",
      completed: true,
      input: {
        packets: rows.length,
        promptResets: 0,
        resultsSha256: receipt.resultsSha256,
        graySha256: receipt.grayStreamSha256,
        receiptSha256: options.receiptSha256,
        sourceVideoSha256: receipt.sourceVideoSha256,
        sourceNeuralBackend: receipt.ready.backend,
      },
      executable: {
        baselineSha256: options.baselineSha256,
        candidateSha256: options.candidateSha256,
        baselineAlgorithmDigest: apis.baseline.indexImageAlgorithm?.algorithmDigest ?? null,
        candidateAlgorithmDigest: apis.candidate.indexImageAlgorithm?.algorithmDigest ?? null,
        dependencyManifestSha256: options.dependenciesSha256 ?? null,
        importedDependencySha256: dependencyPins.map(([, digest]) => digest),
        binding:
          "Hash-pinned entry bundles and declared synchronous imported modules; reviewed executable code is trusted, not sandboxed",
        inputAndEntryFilesUnchanged: true,
      },
      references: references
        ? {
            count: references.annotations.length,
            fileSha256: options.labelsSha256,
            provenance: Object.fromEntries(
              [
                "origin",
                "split",
                "independentlyReviewed",
                "blindedToCandidate",
                "sealedBeforeCandidate",
                "coordinateConvention",
              ].map((key) => [key, references.provenance[key]]),
            ),
            groundTruthAccuracyQualified: false,
          }
        : { count: 0, groundTruthAccuracyQualified: false },
      baseline,
      candidate,
      expectedBaselineParity: expectedBaseline
        ? {
            ...compareExpectedBaseline(rows, results.baseline, expectedBaseline),
            resultsSha256: options.expectedBaselineSha256,
          }
        : null,
      paired: {
        positionAvailabilityGains: results.candidate.filter(
          (result, i) => isFreshMeasurement(rows[i], result) && !isFreshMeasurement(rows[i], results.baseline[i]),
        ).length,
        positionAvailabilityLosses: results.baseline.filter(
          (result, i) => isFreshMeasurement(rows[i], result) && !isFreshMeasurement(rows[i], results.candidate[i]),
        ).length,
        measuredPositionDifferences: results.baseline.filter(
          (result, i) =>
            isFreshMeasurement(rows[i], result) &&
            isFreshMeasurement(rows[i], results.candidate[i]) &&
            !equalPoint(result.output.point, results.candidate[i].output.point),
        ).length,
      },
      unavailable: {
        physicalCorrectDigitRate: "No reviewed continuous anatomical identity labels",
        anatomicalIdentitySwitches: "Logical ID changes are not digit-switch ground truth",
        physicalRecoverySuccess: "Availability returns lack continuous anatomical recovery labels",
        stationaryJitter: "No independent stationary trajectory labels",
        captureToVisibleLatency:
          "Original capture/completion clocks are reused; sensor exposure and display presentation are unobserved",
        freshInferenceCostAndThroughput: "No neural execution, camera pacing or display in this benchmark",
        statisticalUncertainty:
          "Single serially correlated development recording; frame-binomial confidence intervals would imply unsupported independence",
        completedPhysicalCalibration: "Diagnostic prompts are not a target-responsive calibration recording",
      },
      limits: [
        "Every chronological packet is interpreted once per arm without resets. Original clocks are unchanged.",
        "CPU distributions measure this Node interpretation run, including cloning and adapter/gate overhead; exclude decoding, model inference, camera and rendering.",
        "Availability, logical identity and reference-region proximity are separate from physical correctness and acceptance.",
        "Reference uncertainty regions remain annotation uncertainty; missing positions stay in the denominator.",
        "Prompt names are instructions, not verified motion or gesture labels.",
      ],
    };
  } catch (error) {
    report = {
      version: 1,
      completed: false,
      classification: "FAILED_COMPARISON_RETAINED",
      error: /^[A-Z0-9_]+$/.test(error.message) ? error.message : "BENCHMARK_EXECUTION_FAILED",
    };
  }
  fs.writeFileSync(path.join(options.output, "comparison.json"), JSON.stringify(report, null, 2) + "\n", {
    flag: "wx",
  });
  return report;
}

function cli(argv) {
  const values = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!argv[i].startsWith("--") || !argv[i + 1]) fail("CLI_ARGUMENT_INVALID");
    const key = argv[i].slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    if (key in values) fail("CLI_ARGUMENT_DUPLICATE");
    values[key] = argv[i + 1];
  }
  const required = [
    "results",
    "gray",
    "receipt",
    "receiptSha256",
    "expectedFrames",
    "grayWidth",
    "grayHeight",
    "baseline",
    "baselineSha256",
    "candidate",
    "candidateSha256",
    "output",
  ];
  if (
    required.some((key) => !values[key]) ||
    Object.keys(values).some(
      (key) =>
        ![
          ...required,
          "labels",
          "labelsSha256",
          "expectedBaselineResults",
          "expectedBaselineSha256",
          "dependencies",
          "dependenciesSha256",
        ].includes(key),
    ) ||
    !!values.labels !== !!values.labelsSha256 ||
    !!values.expectedBaselineResults !== !!values.expectedBaselineSha256 ||
    !!values.dependencies !== !!values.dependenciesSha256
  )
    fail("CLI_REQUIRED_ARGUMENT_MISSING_OR_UNKNOWN");
  for (const key of ["expectedFrames", "grayWidth", "grayHeight"]) values[key] = Number(values[key]);
  return runBenchmark(values);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const report = cli(process.argv.slice(2));
    console.log(
      JSON.stringify({
        completed: report.completed,
        packets: report.input?.packets,
        baselinePositions: report.baseline?.all.measuredPositions,
        candidatePositions: report.candidate?.all.measuredPositions,
      }),
    );
    if (!report.completed) process.exitCode = 1;
  } catch (error) {
    console.error(/^[A-Z0-9_]+$/.test(error.message) ? error.message : "BENCHMARK_INPUT_REJECTED");
    process.exitCode = 1;
  }
}

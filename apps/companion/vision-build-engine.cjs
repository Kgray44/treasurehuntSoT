"use strict";

const crypto = require("node:crypto");
const {
  VISION_ENGINE_VERSION,
  VISION_FRAME_SELECTION_VERSION,
  VISION_MODEL_BUNDLE_VERSION,
  VisionEngineError,
  buildProgress,
  sha256,
  stableStringify,
  validateBuildInput,
} = require("./vision-engine-contract.cjs");
const {
  bestGlobalSimilarity,
  describeGlobal,
  differenceHash,
  extractLocalFeatures,
  frameContentHash,
  frameQuality,
  hammingHex,
  matchLocalFeatures,
} = require("./vision-features.cjs");
const { ransacHomography } = require("./vision-math.cjs");
const { createRuntimePackage, loadRuntimePackage } = require("./vision-package.cjs");
const { VisionProviderRouter } = require("./vision-provider.cjs");
const { evaluateFrame } = require("./vision-runtime-engine.cjs");

const BUILD_REPORT_SCHEMA_VERSION = 1;

const profileThresholds = Object.freeze({
  BALANCED: {
    minimumTargetSimilarity: 0.8,
    minimumTargetNegativeMargin: 0.035,
    minimumCandidateSeparation: 0.008,
    minimumLocalMatches: 8,
    minimumGeometricInliers: 6,
    minimumInlierRatio: 0.35,
    maximumReprojectionError: 5,
    minimumSpatialCoverage: 0.035,
    minimumOccupiedGridRatio: 0.18,
    minimumRequiredRegionCoverage: 0.02,
    minimumLocalizedFrames: 2,
    minimumTemporalAgreement: 0.4,
    maximumPoseUncertainty: 0.8,
    localMatchRatio: 0.85,
    maximumLocalFeatures: 240,
  },
  STRICT: {
    minimumTargetSimilarity: 0.84,
    minimumTargetNegativeMargin: 0.055,
    minimumCandidateSeparation: 0.012,
    minimumLocalMatches: 10,
    minimumGeometricInliers: 8,
    minimumInlierRatio: 0.42,
    maximumReprojectionError: 4,
    minimumSpatialCoverage: 0.045,
    minimumOccupiedGridRatio: 0.22,
    minimumRequiredRegionCoverage: 0.03,
    minimumLocalizedFrames: 3,
    minimumTemporalAgreement: 0.55,
    maximumPoseUncertainty: 0.65,
    localMatchRatio: 0.82,
    maximumLocalFeatures: 260,
  },
  STORY_CRITICAL: {
    minimumTargetSimilarity: 0.87,
    minimumTargetNegativeMargin: 0.075,
    minimumCandidateSeparation: 0.018,
    minimumLocalMatches: 12,
    minimumGeometricInliers: 10,
    minimumInlierRatio: 0.48,
    maximumReprojectionError: 3.5,
    minimumSpatialCoverage: 0.055,
    minimumOccupiedGridRatio: 0.25,
    minimumRequiredRegionCoverage: 0.04,
    minimumLocalizedFrames: 3,
    minimumTemporalAgreement: 0.6,
    maximumPoseUncertainty: 0.55,
    localMatchRatio: 0.8,
    maximumLocalFeatures: 280,
  },
  CUSTOM: {
    minimumTargetSimilarity: 0.84,
    minimumTargetNegativeMargin: 0.055,
    minimumCandidateSeparation: 0.012,
    minimumLocalMatches: 10,
    minimumGeometricInliers: 8,
    minimumInlierRatio: 0.42,
    maximumReprojectionError: 4,
    minimumSpatialCoverage: 0.045,
    minimumOccupiedGridRatio: 0.22,
    minimumRequiredRegionCoverage: 0.03,
    minimumLocalizedFrames: 3,
    minimumTemporalAgreement: 0.55,
    maximumPoseUncertainty: 0.65,
    localMatchRatio: 0.82,
    maximumLocalFeatures: 260,
  },
});

function jsonObject(value) {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }
  return typeof value === "object" && !Array.isArray(value) ? value : {};
}

function testAssetIds(test) {
  const environment = jsonObject(test.environment);
  return Array.isArray(environment.assetIds) ? environment.assetIds : [];
}

function partitionAssets(input) {
  const locked = new Set(input.lockedTests.flatMap(testAssetIds));
  const validation = new Set(input.validationTests.flatMap(testAssetIds));
  const negative = new Set(input.hardNegatives.flatMap((entry) => jsonObject(entry.metadata).assetIds ?? []));
  for (const asset of input.assets) {
    if (/HARD_NEGATIVE|INVALID_POSE/.test(asset.role)) negative.add(asset.id);
    if (asset.role === "LOCKED_TEST") locked.add(asset.id);
    if (asset.role === "VALIDATION") validation.add(asset.id);
  }
  const conflicts = [];
  for (const asset of input.assets) {
    const memberships = [
      locked.has(asset.id) && "LOCKED_TEST",
      validation.has(asset.id) && "VALIDATION",
      negative.has(asset.id) && "NEGATIVE",
    ].filter(Boolean);
    if (memberships.length > 1) conflicts.push({ assetId: asset.id, memberships });
    if (asset.role === "TARGET_REFERENCE" && (locked.has(asset.id) || validation.has(asset.id)))
      conflicts.push({ assetId: asset.id, memberships: ["TARGET_TRAINING", ...memberships] });
  }
  if (conflicts.length)
    throw new VisionEngineError(
      "DATASET_PARTITION_CONFLICT",
      "Training, validation, and locked-test evidence must be independent.",
      { details: { conflicts } },
    );
  const partitions = {};
  for (const asset of input.assets) {
    partitions[asset.id] = locked.has(asset.id)
      ? "LOCKED_TEST"
      : validation.has(asset.id)
        ? "VALIDATION"
        : negative.has(asset.id)
          ? "NEGATIVE"
          : "TRAINING";
  }
  return partitions;
}

function curateFrames(frameSet, asset, options = {}) {
  const derivedExpected = asset.sourceAssetId
    ? `sha256:${sha256(`${frameSet?.sourceContentHash}:${asset.segmentStartMs ?? 0}:${asset.segmentEndMs ?? asset.durationMs}`)}`
    : null;
  if (
    !frameSet ||
    (!asset.sourceAssetId && frameSet.sourceContentHash !== asset.contentHash) ||
    (asset.sourceAssetId && derivedExpected !== asset.contentHash) ||
    !Array.isArray(frameSet.frames)
  )
    throw new VisionEngineError(
      "BUILD_INPUT_HASH_MISMATCH",
      `Derived frames for ${asset.id} do not match the immutable recording hash.`,
      { retryable: false },
    );
  const start = asset.segmentStartMs ?? 0;
  const end = asset.segmentEndMs ?? Number.POSITIVE_INFINITY;
  const candidates = frameSet.frames
    .filter((frame) => (frame.offsetMs ?? 0) >= start && (frame.offsetMs ?? 0) <= end)
    .map((frame) => ({
      ...frame,
      quality: frameQuality(frame),
      hash: frameContentHash(frame),
      dHash: differenceHash(frame),
    }))
    .filter((frame) => frame.quality.usable)
    .sort((left, right) => (left.offsetMs ?? 0) - (right.offsetMs ?? 0) || left.id.localeCompare(right.id));
  const selected = [];
  for (const frame of candidates) {
    if (
      selected.some(
        (existing) =>
          existing.hash === frame.hash || hammingHex(existing.dHash, frame.dHash) <= (options.maximumHashDistance ?? 2),
      )
    )
      continue;
    selected.push(frame);
    if (selected.length >= (options.maximumFrames ?? 18)) break;
  }
  return {
    captured: frameSet.frames.length,
    usable: candidates.length,
    selected,
    duplicateCount: candidates.length - selected.length,
  };
}

function serializeFeatures(features) {
  return {
    ...features,
    features: features.features.map((feature) => ({
      ...feature,
      descriptor: feature.descriptor.map((value) => Number(value.toFixed(7))),
    })),
  };
}

function calibrationFor(profile, targetIndex, negativeIndex) {
  const profileName = profileThresholds[profile] ? profile : "BALANCED";
  const base = { ...profileThresholds[profileName] };
  let strongestNegative = -1;
  for (const target of targetIndex) {
    for (const negative of negativeIndex)
      strongestNegative = Math.max(
        strongestNegative,
        bestGlobalSimilarity(target.descriptors, negative.descriptors).similarity,
      );
  }
  const observedSeparation = 1 - strongestNegative;
  const requiredMargin = Math.max(base.minimumTargetNegativeMargin, Math.min(0.2, observedSeparation * 0.35));
  const minimumTargetSimilarity = Math.max(
    base.minimumTargetSimilarity,
    Math.min(0.98, strongestNegative + requiredMargin),
  );
  return {
    schemaVersion: 1,
    profile: profileName,
    thresholds: { ...base, minimumTargetNegativeMargin: requiredMargin, minimumTargetSimilarity },
    distributions: { targetSelfSimilarity: 1, strongestNegativeSimilarity: strongestNegative, observedSeparation },
    safetyMargin: requiredMargin,
    unsupportedConditions: [
      "Large non-planar viewpoint changes",
      "Learned semantic disambiguation",
      "Metric world-coordinate localization",
    ],
    modelVersions: [VISION_MODEL_BUNDLE_VERSION],
  };
}

function gradeReliability(metrics, calibration, referenceGraph) {
  if (
    metrics.falseAccepts > 0 ||
    calibration.distributions.observedSeparation <= calibration.thresholds.minimumTargetNegativeMargin
  )
    return "UNSAFE";
  const positiveRate = metrics.positiveAttempts ? metrics.trueAccepts / metrics.positiveAttempts : 0;
  const connected = referenceGraph.components === 1;
  if (
    positiveRate >= 0.9 &&
    connected &&
    calibration.distributions.observedSeparation >= calibration.thresholds.minimumTargetNegativeMargin * 1.75
  )
    return "EXCELLENT";
  if (positiveRate >= 0.7 && connected) return "GOOD";
  return "NEEDS_IMPROVEMENT";
}

class VisionBuildEngine {
  constructor(options = {}) {
    this.providerRouter = options.providerRouter ?? new VisionProviderRouter(options);
    this.clock = options.clock ?? (() => Date.now());
  }

  async build(request) {
    const startedAtMs = this.clock();
    const buildId = request.buildId ?? `build_${crypto.randomUUID()}`;
    const logs = [];
    const warnings = [];
    const emit = (stage, progress, code, detail = {}) => {
      const event = buildProgress(stage, progress, code, { buildId, timestamp: new Date().toISOString(), ...detail });
      logs.push({ stage, code, timestamp: event.timestamp, ...detail });
      request.onProgress?.(event);
    };
    const checkpoint = () => {
      if (request.signal?.aborted) throw new VisionEngineError("BUILD_CANCELLED", "Build was cancelled.");
      if (this.clock() - startedAtMs > (request.timeoutMs ?? 15 * 60_000))
        throw new VisionEngineError("BUILD_TIMEOUT", "Build exceeded its deadline.");
    };
    try {
      emit("VALIDATING_INPUT", 0.1, "BUILD_INPUT_VALIDATING");
      const input = validateBuildInput(request.buildInput);
      const calculatedInputHash = sha256(stableStringify(input));
      if (request.inputHash && request.inputHash.replace(/^sha256:/, "") !== calculatedInputHash)
        throw new VisionEngineError(
          "BUILD_INPUT_HASH_MISMATCH",
          "Canonical BuildInput hash does not match the queued job.",
          { retryable: false },
        );
      const partitions = partitionAssets(input);
      const targetAssets = input.assets.filter(
        (asset) => asset.role === "TARGET_REFERENCE" && partitions[asset.id] === "TRAINING",
      );
      const negativeAssets = input.assets.filter((asset) => partitions[asset.id] === "NEGATIVE");
      if (!targetAssets.length)
        throw new VisionEngineError("NO_TARGET_RECORDING", "No independent target training recording is available.");
      if (!negativeAssets.length)
        throw new VisionEngineError(
          "INSUFFICIENT_HARD_NEGATIVE_DATA",
          "At least one hard-negative recording is required.",
        );
      checkpoint();
      const providerSelection = this.providerRouter.select({
        requested: request.provider,
        allowFallback: request.allowProviderFallback !== false,
      });
      emit("INGESTING", 0.2, "FRAME_SETS_LOADING", {
        provider: providerSelection.provider.id,
        fallbackUsed: providerSelection.fallbackUsed,
      });
      const curatedByAsset = new Map();
      for (let index = 0; index < input.assets.length; index += 1) {
        checkpoint();
        const asset = input.assets[index];
        const frameSet = await request.resolveFrameSet(asset);
        curatedByAsset.set(asset.id, curateFrames(frameSet, asset));
        emit("CURATING_FRAMES", (index + 1) / input.assets.length, "ASSET_CURATED", {
          assetId: asset.id,
          selectedFrames: curatedByAsset.get(asset.id).selected.length,
        });
      }
      const targetFrames = targetAssets.flatMap((asset) =>
        curatedByAsset.get(asset.id).selected.map((frame) => ({ frame, asset })),
      );
      const negativeFrames = negativeAssets.flatMap((asset) =>
        curatedByAsset.get(asset.id).selected.map((frame) => ({ frame, asset })),
      );
      if (targetFrames.length < 2)
        throw new VisionEngineError(
          "NO_VALID_REFERENCE_FRAMES",
          "Fewer than two diverse usable target frames remained after curation.",
        );
      if (negativeFrames.length < 1)
        throw new VisionEngineError("TOO_FEW_HARD_NEGATIVES", "No usable hard-negative frame remained after curation.");
      emit("EXTRACTING_GLOBAL_FEATURES", 0.1, "GLOBAL_FEATURES_STARTED");
      const targetIndex = targetFrames.map(({ frame, asset }) => ({
        assetId: asset.id,
        frameId: frame.id,
        role: asset.role,
        descriptors: describeGlobal(frame),
      }));
      const negativeIndex = negativeFrames.map(({ frame, asset }) => ({
        assetId: asset.id,
        frameId: frame.id,
        role: asset.role,
        descriptors: describeGlobal(frame),
      }));
      emit("EXTRACTING_GLOBAL_FEATURES", 1, "GLOBAL_FEATURES_COMPLETE", {
        targetFrames: targetIndex.length,
        negativeFrames: negativeIndex.length,
      });
      checkpoint();
      emit("EXTRACTING_LOCAL_FEATURES", 0.1, "LOCAL_FEATURES_STARTED");
      const localReferences = targetFrames.map(({ frame, asset }) => ({
        assetId: asset.id,
        frameId: frame.id,
        features: serializeFeatures(extractLocalFeatures(frame, { maximum: 280 })),
      }));
      emit("EXTRACTING_LOCAL_FEATURES", 1, "LOCAL_FEATURES_COMPLETE", {
        featureCount: localReferences.reduce((sum, entry) => sum + entry.features.features.length, 0),
      });
      emit("MATCHING_REFERENCE_GRAPH", 0.1, "REFERENCE_GRAPH_STARTED");
      const edges = [];
      for (let left = 0; left < localReferences.length; left += 1) {
        for (let right = left + 1; right < localReferences.length; right += 1) {
          const matches = matchLocalFeatures(localReferences[left].features, localReferences[right].features);
          const geometry = ransacHomography(matches.matches, { thresholdPx: 5 });
          if (geometry.valid && geometry.inliers.length >= 5)
            edges.push({
              from: localReferences[left].frameId,
              to: localReferences[right].frameId,
              inliers: geometry.inliers.length,
              inlierRatio: geometry.inlierRatio,
              meanError: geometry.meanError,
              transform: geometry.matrix,
            });
        }
      }
      const nodesWithEdges = new Set(edges.flatMap((edge) => [edge.from, edge.to]));
      const referenceGraph = {
        schemaVersion: 1,
        nodes: targetIndex.map((entry) => entry.frameId),
        edges,
        components: edges.length
          ? nodesWithEdges.size === targetIndex.length
            ? 1
            : targetIndex.length - nodesWithEdges.size + 1
          : targetIndex.length,
      };
      if (referenceGraph.components > 1) warnings.push("REFERENCE_GRAPH_DISCONNECTED");
      emit("MATCHING_REFERENCE_GRAPH", 1, "REFERENCE_GRAPH_COMPLETE", {
        edges: edges.length,
        components: referenceGraph.components,
      });
      emit("RECONSTRUCTING", 0.5, "PLANAR_RELATIVE_RECONSTRUCTION");
      const reconstruction = {
        schemaVersion: 1,
        type: "PLANAR_REFERENCE_GRAPH",
        coordinateSystem: "REFERENCE_RELATIVE_PLANAR",
        metricScale: false,
        referenceFrameId: targetIndex[0].frameId,
        cameras: targetIndex.map((entry, index) => ({ frameId: entry.frameId, relativeIndex: index })),
        limitations: ["Not a general metric 3D reconstruction"],
      };
      emit("BUILDING_TARGET_INDEX", 1, "TARGET_INDEX_COMPLETE", { references: targetIndex.length });
      emit("BUILDING_NEGATIVE_INDEX", 1, "NEGATIVE_INDEX_COMPLETE", { references: negativeIndex.length });
      const profile = input.waypoint.verificationProfile ?? "BALANCED";
      emit("CALIBRATING", 0.5, "CALIBRATION_STARTED", { profile });
      const calibration = calibrationFor(profile, targetIndex, negativeIndex);
      calibration.calibrationHash = `sha256:${sha256(stableStringify(calibration))}`;
      emit("ESTIMATING_ACCEPTED_POSE_VOLUME", 1, "POSE_VOLUME_FINALIZED", {
        coordinateSystem: reconstruction.coordinateSystem,
      });
      const acceptedPoseRegions = input.acceptedPoseRegions.map((region) => ({
        ...region,
        coordinateSystem: reconstruction.coordinateSystem,
        authoringCoordinateSystem: region.coordinateSystem,
        provisional: true,
      }));
      const stableRegions = input.visualRegions.filter((region) => ["TARGET", "STABLE"].includes(region.regionType));
      const artifacts = {
        "runtime-config.json": {
          schemaVersion: 1,
          waypointType: input.waypoint.type,
          shadowModeOnly: true,
          automaticProgression: false,
        },
        "global-reference-index.json": { schemaVersion: 1, references: targetIndex },
        "negative-reference-index.json": { schemaVersion: 1, references: negativeIndex },
        "local-reference-features.json": { schemaVersion: 1, references: localReferences },
        "reference-graph.json": referenceGraph,
        "reconstruction.json": reconstruction,
        "accepted-pose-regions.json": { schemaVersion: 1, regions: acceptedPoseRegions },
        "stable-regions.json": { schemaVersion: 1, regions: stableRegions },
        "checkpoint-rules.json": {
          schemaVersion: 1,
          waypointType: input.waypoint.type,
          rules: input.authoring?.steps ?? {},
        },
        "calibration.json": calibration,
        "guidance-map.json": { schemaVersion: 1, policy: "STORY_SAFE_SEMANTIC_CODES_ONLY" },
        "compatibility.json": {
          schemaVersion: 1,
          engineVersion: VISION_ENGINE_VERSION,
          modelBundleVersions: [VISION_MODEL_BUNDLE_VERSION],
          packageSchemaVersions: [1],
        },
        "certification-summary.json": { schemaVersion: 1, status: "PENDING", automaticEligibility: false },
      };
      emit("PACKAGING", 0.5, "PACKAGE_ASSEMBLING");
      const packageId = `pkg_${sha256(`${calculatedInputHash}:${VISION_ENGINE_VERSION}:${VISION_MODEL_BUNDLE_VERSION}`).slice(0, 40)}`;
      let runtimePackage = createRuntimePackage({
        packageId,
        buildId,
        builtAt: request.builtAt,
        waypoint: input.waypoint,
        calibrationProfile: calibration.profile,
        certificationStatus: "PENDING",
        expectedProviders: [providerSelection.provider.id],
        knownLimitations: reconstruction.limitations.concat(calibration.unsupportedConditions),
        artifacts,
      });
      const loaded = loadRuntimePackage(runtimePackage, { waypointVersionId: input.waypoint.versionId });
      emit("RUNNING_VALIDATION", 0.1, "VALIDATION_STARTED");
      const metrics = {
        positiveAttempts: 0,
        negativeAttempts: 0,
        trueAccepts: 0,
        trueRejects: 0,
        falseAccepts: 0,
        falseRejects: 0,
        cases: [],
      };
      const testCases = [
        ...input.validationTests.map((test) => ({ ...test, partition: "VALIDATION" })),
        ...input.lockedTests.map((test) => ({ ...test, partition: "LOCKED_TEST" })),
      ];
      for (const test of testCases) {
        checkpoint();
        const frames = testAssetIds(test).flatMap((assetId) => curatedByAsset.get(assetId)?.selected ?? []);
        const evaluations = frames.map((frame) => evaluateFrame(frame, loaded, { stageContextValid: true }));
        const required = calibration.thresholds.minimumLocalizedFrames;
        const passes = evaluations.filter((evaluation) =>
          Object.entries(evaluation.gates)
            .filter(([gate]) => gate !== "TEMPORAL_CONSISTENCY")
            .every(([, gate]) => gate.pass === true),
        ).length;
        const actualMatch = passes >= required;
        const expectedMatch = test.expectedResult === "MATCH";
        if (expectedMatch) {
          metrics.positiveAttempts += 1;
          if (actualMatch) metrics.trueAccepts += 1;
          else metrics.falseRejects += 1;
        } else {
          metrics.negativeAttempts += 1;
          if (actualMatch) metrics.falseAccepts += 1;
          else metrics.trueRejects += 1;
        }
        metrics.cases.push({
          id: test.id,
          partition: test.partition,
          expectedResult: test.expectedResult,
          actualResult: actualMatch ? "MATCH" : "NO_MATCH",
          passingFrames: passes,
          frameCount: frames.length,
        });
      }
      metrics.observedFalseAcceptRate = metrics.negativeAttempts
        ? metrics.falseAccepts / metrics.negativeAttempts
        : null;
      metrics.approximateFalseAcceptUpper95 =
        metrics.negativeAttempts && metrics.falseAccepts === 0 ? Math.min(1, 3 / metrics.negativeAttempts) : null;
      const reliabilityGrade = gradeReliability(metrics, calibration, referenceGraph);
      if (
        metrics.cases.some(
          (entry) =>
            entry.partition === "LOCKED_TEST" && entry.expectedResult !== "MATCH" && entry.actualResult === "MATCH",
        )
      )
        throw new VisionEngineError(
          "FALSE_ACCEPT_IN_LOCKED_TEST",
          "A locked negative test was accepted; package publication is blocked.",
          { details: { metrics } },
        );
      artifacts["certification-summary.json"] = {
        schemaVersion: 1,
        status: reliabilityGrade,
        reliabilityGrade,
        automaticEligibility: false,
        metrics,
        caution: "Observed test results do not prove zero real-world risk.",
      };
      runtimePackage = createRuntimePackage({
        packageId: runtimePackage.manifest.packageId,
        buildId,
        builtAt: runtimePackage.manifest.builtAt,
        waypoint: input.waypoint,
        calibrationProfile: calibration.profile,
        certificationStatus: reliabilityGrade,
        expectedProviders: [providerSelection.provider.id],
        knownLimitations: reconstruction.limitations.concat(calibration.unsupportedConditions),
        artifacts,
      });
      loadRuntimePackage(runtimePackage, { waypointVersionId: input.waypoint.versionId });
      emit("RUNNING_LOCKED_TESTS", 1, "LOCKED_TESTS_COMPLETE", {
        lockedTests: input.lockedTests.length,
        falseAccepts: metrics.falseAccepts,
      });
      emit("VALIDATING_PACKAGE", 1, "PACKAGE_INTEGRITY_VALID", { packageHash: runtimePackage.manifest.packageHash });
      emit("COMPLETE", 1, "BUILD_COMPLETE", { reliabilityGrade, packageId: runtimePackage.manifest.packageId });
      return {
        schemaVersion: BUILD_REPORT_SCHEMA_VERSION,
        buildId,
        status: "COMPLETED",
        inputHash: `sha256:${calculatedInputHash}`,
        engineVersion: VISION_ENGINE_VERSION,
        frameSelectionVersion: VISION_FRAME_SELECTION_VERSION,
        modelBundleVersion: VISION_MODEL_BUNDLE_VERSION,
        provider: providerSelection.provider.capabilities(),
        providerFallbackUsed: providerSelection.fallbackUsed,
        partitions,
        curation: Object.fromEntries(
          [...curatedByAsset].map(([id, value]) => [
            id,
            {
              captured: value.captured,
              usable: value.usable,
              selected: value.selected.length,
              duplicateCount: value.duplicateCount,
            },
          ]),
        ),
        referenceGraph,
        reconstruction,
        calibration,
        certification: { reliabilityGrade, metrics, automaticEligibility: false, approvedRuntimeModes: ["SHADOW"] },
        warnings,
        logs,
        package: runtimePackage,
        durationMs: this.clock() - startedAtMs,
        shadowModeOnly: true,
      };
    } catch (error) {
      const normalized =
        error instanceof VisionEngineError
          ? error
          : new VisionEngineError("INTERNAL_BUILD_ERROR", error?.message ?? "Internal build error.", {
              details: { name: error?.name },
            });
      emit(normalized.code === "BUILD_CANCELLED" ? "CANCELLED" : "FAILED", null, normalized.code, {
        message: normalized.message,
      });
      normalized.buildReport = {
        schemaVersion: BUILD_REPORT_SCHEMA_VERSION,
        buildId,
        status: normalized.code === "BUILD_CANCELLED" ? "CANCELLED" : "FAILED",
        failureCode: normalized.code,
        retryable: normalized.retryable,
        details: normalized.details,
        warnings,
        logs,
        durationMs: this.clock() - startedAtMs,
      };
      throw normalized;
    }
  }
}

module.exports = {
  BUILD_REPORT_SCHEMA_VERSION,
  VisionBuildEngine,
  calibrationFor,
  curateFrames,
  gradeReliability,
  partitionAssets,
  profileThresholds,
  testAssetIds,
};

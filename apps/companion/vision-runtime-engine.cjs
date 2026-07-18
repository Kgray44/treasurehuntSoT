"use strict";

const crypto = require("node:crypto");
const {
  VISION_ENGINE_VERSION,
  VISION_MODEL_BUNDLE_VERSION,
  VisionEngineError,
  guidanceCatalog,
  mandatoryGates,
  sha256,
  stableStringify,
} = require("./vision-engine-contract.cjs");
const {
  bestGlobalSimilarity,
  describeGlobal,
  extractLocalFeatures,
  frameQuality,
  matchLocalFeatures,
} = require("./vision-features.cjs");
const { poseInsideRegion, ransacHomography, spatialCoverage } = require("./vision-math.cjs");
const { loadRuntimePackage } = require("./vision-package.cjs");
const { VisionProviderRouter } = require("./vision-provider.cjs");

const RUNTIME_RESULT_SCHEMA_VERSION = 1;

function now() {
  return Date.now();
}

function candidateScores(descriptors, index) {
  return index
    .map((reference) => ({
      assetId: reference.assetId,
      frameId: reference.frameId,
      role: reference.role,
      ...bestGlobalSimilarity(descriptors, reference.descriptors),
    }))
    .sort((left, right) => right.similarity - left.similarity || left.frameId.localeCompare(right.frameId));
}

function estimateRelativePose(geometry, width) {
  if (!geometry.valid) return null;
  const matrix = geometry.matrix;
  const scale = Math.sqrt(Math.abs(matrix[0] * matrix[4] - matrix[1] * matrix[3]));
  return {
    coordinateSystem: "REFERENCE_RELATIVE_PLANAR",
    x: (matrix[2] / Math.max(1, width)) * 10,
    y: 0,
    z: 1 / Math.max(0.1, scale),
    yawDegrees: (Math.atan2(matrix[3], matrix[0]) * 180) / Math.PI,
    uncertainty: Math.min(1, (geometry.meanError ?? 99) / 8 + (1 - geometry.inlierRatio)),
    metricScale: false,
  };
}

function acceptedPose(pose, regions) {
  if (!pose) return false;
  const excluded = regions.filter((region) => ["BOUNDARY", "EXCLUDED"].includes(region.classification));
  if (excluded.some((region) => poseInsideRegion(pose, region))) return false;
  return regions
    .filter((region) => region.classification === "ACCEPTED")
    .some((region) => poseInsideRegion(pose, region));
}

function checkpointPass(type, frame, evaluation, rules) {
  if (type === "ITEM_PICKUP") return { pass: false, reason: "ITEM_STATE_DETECTOR_UNAVAILABLE", supported: false };
  if (type === "SEQUENCE")
    return {
      pass: Boolean(rules.sequenceSatisfied),
      reason: rules.sequenceSatisfied ? null : "SEQUENCE_CONTEXT_REQUIRED",
    };
  if (type === "VIEWPOINT")
    return { pass: evaluation.posePass && evaluation.visibilityPass, reason: "VIEWPOINT_POSE_OR_VISIBILITY" };
  if (type === "OBJECT_INSPECTION")
    return {
      pass: evaluation.geometry.valid && evaluation.coverage.hullRatio >= evaluation.thresholds.minimumSpatialCoverage,
      reason: "OBJECT_NOT_GEOMETRICALLY_CONFIRMED",
    };
  if (type === "AREA_ARRIVAL") return { pass: evaluation.posePass, reason: "OUTSIDE_ACCEPTED_AREA" };
  return { pass: evaluation.geometry.valid, reason: "LANDMARK_NOT_GEOMETRICALLY_CONFIRMED" };
}

function evaluateFrame(frame, runtimePackage, options = {}) {
  const artifacts = runtimePackage.artifacts;
  const config = artifacts["runtime-config.json"];
  const thresholds = artifacts["calibration.json"].thresholds;
  const quality = frameQuality(frame);
  const descriptors = describeGlobal(frame);
  const targets = candidateScores(descriptors, artifacts["global-reference-index.json"].references);
  const negatives = candidateScores(descriptors, artifacts["negative-reference-index.json"].references);
  const target = targets[0] ?? { similarity: -1, frameId: null, assetId: null };
  const negative = negatives[0] ?? { similarity: 1, frameId: null, assetId: null };
  const margin = target.similarity - negative.similarity;
  const targetReference = artifacts["global-reference-index.json"].references.find(
    (entry) => entry.frameId === target.frameId,
  );
  const negativeReference = artifacts["negative-reference-index.json"].references.find(
    (entry) => entry.frameId === negative.frameId,
  );
  const secondaryTarget = targetReference
    ? bestGlobalSimilarity(
        descriptors.filter((entry) => entry.crop === "FULL"),
        targetReference.descriptors.filter((entry) => entry.crop === "FULL"),
      ).similarity
    : -1;
  const secondaryNegative = negativeReference
    ? bestGlobalSimilarity(
        descriptors.filter((entry) => entry.crop === "FULL"),
        negativeReference.descriptors.filter((entry) => entry.crop === "FULL"),
      ).similarity
    : 1;
  const secondaryMargin = secondaryTarget - secondaryNegative;
  const secondaryRequired = margin < thresholds.minimumTargetNegativeMargin * 2;
  const secondaryPass = !secondaryRequired || secondaryMargin >= thresholds.minimumTargetNegativeMargin * 0.75;
  const localQuery = extractLocalFeatures(frame, { maximum: thresholds.maximumLocalFeatures ?? 240 });
  const localReference = artifacts["local-reference-features.json"].references.find(
    (entry) => entry.frameId === target.frameId,
  );
  const matches = localReference
    ? matchLocalFeatures(localQuery, localReference.features, { ratio: thresholds.localMatchRatio })
    : { rawCount: 0, filteredCount: 0, matches: [] };
  const geometry = ransacHomography(matches.matches, {
    thresholdPx: thresholds.maximumReprojectionError,
    iterations: 96,
  });
  const coverage = spatialCoverage(
    geometry.inliers.map((match) => match.query),
    frame.width,
    frame.height,
  );
  const pose = estimateRelativePose(geometry, frame.width);
  const posePass = acceptedPose(pose, artifacts["accepted-pose-regions.json"].regions);
  const orientationRules = artifacts["accepted-pose-regions.json"].regions
    .filter((region) => region.classification === "ACCEPTED")
    .map((region) => region.orientationRules ?? {});
  const maximumFacing = Math.min(...orientationRules.map((rule) => Number(rule.toleranceDegrees ?? 180)), 180);
  const orientationPass = Boolean(pose) && Math.abs(pose.yawDegrees) <= maximumFacing;
  const stableRegions = artifacts["stable-regions.json"].regions;
  const visibilityPass =
    stableRegions.length === 0 || (geometry.valid && coverage.hullRatio >= thresholds.minimumRequiredRegionCoverage);
  const evaluation = {
    frame,
    quality,
    descriptors,
    targets,
    negatives,
    target,
    negative,
    margin,
    localQuery,
    matches,
    geometry,
    coverage,
    pose,
    posePass,
    orientationPass,
    visibilityPass,
    thresholds,
  };
  const checkpoint = checkpointPass(config.waypointType, frame, evaluation, options.checkpointContext ?? {});
  const ambiguity = margin < thresholds.minimumTargetNegativeMargin || !secondaryPass;
  const gates = {
    CAPTURE_QUALITY: { pass: quality.usable, metrics: quality },
    STAGE_CONTEXT: { pass: options.stageContextValid !== false, metrics: { stageToken: options.stageToken ?? null } },
    TARGET_RETRIEVAL: { pass: target.similarity >= thresholds.minimumTargetSimilarity, metrics: { target } },
    HARD_NEGATIVE_MARGIN: {
      pass: margin >= thresholds.minimumTargetNegativeMargin,
      metrics: { target, negative, margin },
    },
    LOCAL_FEATURE_MATCHING: {
      pass: matches.filteredCount >= thresholds.minimumLocalMatches,
      metrics: { raw: matches.rawCount, filtered: matches.filteredCount },
    },
    GEOMETRIC_VERIFICATION: {
      pass:
        geometry.valid &&
        geometry.inliers.length >= thresholds.minimumGeometricInliers &&
        geometry.inlierRatio >= thresholds.minimumInlierRatio &&
        geometry.meanError <= thresholds.maximumReprojectionError,
      metrics: { inliers: geometry.inliers.length, ratio: geometry.inlierRatio, meanError: geometry.meanError },
    },
    CAMERA_POSE: {
      pass: posePass && (pose?.uncertainty ?? 1) <= thresholds.maximumPoseUncertainty,
      metrics: { pose, accepted: posePass },
    },
    ORIENTATION_VISIBILITY: { pass: orientationPass && visibilityPass, metrics: { orientationPass, visibilityPass } },
    SPATIAL_COVERAGE: {
      pass:
        coverage.hullRatio >= thresholds.minimumSpatialCoverage &&
        coverage.occupiedRatio >= thresholds.minimumOccupiedGridRatio,
      metrics: coverage,
    },
    TEMPORAL_CONSISTENCY: { pass: null, metrics: { pending: true } },
    CHECKPOINT_SPECIFIC_RULES: checkpoint,
    AMBIGUITY_VETO: {
      pass: !ambiguity,
      metrics: {
        ambiguity,
        targetNegativeMargin: margin,
        secondaryResolver: {
          version: "full-frame-disagreement-resolver-1",
          required: secondaryRequired,
          pass: secondaryPass,
          targetSimilarity: secondaryTarget,
          negativeSimilarity: secondaryNegative,
          margin: secondaryMargin,
        },
      },
    },
  };
  return { ...evaluation, gates };
}

function guidanceFor(result, failedGates, evaluations) {
  const qualities = evaluations.map((entry) => entry.quality);
  if (result === "VERIFIED") return "VERIFICATION_COMPLETE";
  if (result === "CANCELLED") return "ATTEMPT_CANCELLED";
  if (result === "SYSTEM_ERROR") return "PACKAGE_REPAIR_REQUIRED";
  if (qualities.some((quality) => quality.meanLuminance < 0.12)) return "TOO_DARK";
  if (failedGates.includes("AMBIGUITY_VETO") || failedGates.includes("HARD_NEGATIVE_MARGIN"))
    return "AMBIGUOUS_SIMILAR_LOCATION";
  if (failedGates.includes("SPATIAL_COVERAGE")) return "INCLUDE_MORE_SURROUNDINGS";
  if (failedGates.includes("LOCAL_FEATURE_MATCHING")) return "NO_STABLE_FEATURES";
  if (failedGates.includes("TARGET_RETRIEVAL")) return "LOCATION_NOT_CONFIRMED";
  return "HOLD_STEADY";
}

class VisionRuntimeEngine {
  constructor(options = {}) {
    this.providerRouter = options.providerRouter ?? new VisionProviderRouter(options);
    this.clock = options.clock ?? now;
    this.attempts = new Map();
  }

  async verify(input) {
    const started = this.clock();
    const attemptId = input.attemptId ?? `att_${crypto.randomUUID()}`;
    const existing = this.attempts.get(attemptId);
    if (existing?.terminal) return { ...existing.result, idempotent: true };
    if (input.signal?.aborted) return this.#cancelled(attemptId, input, started);
    const state = { stage: "ARMED", stageToken: input.stageToken, terminal: false };
    this.attempts.set(attemptId, state);
    const emit = (stage, detail = {}) => {
      state.stage = stage;
      input.onProgress?.({
        type: "vision.runtime.progress",
        attemptId,
        stage,
        timestamp: new Date().toISOString(),
        ...detail,
      });
    };
    try {
      emit("CURATING_FRAMES");
      const runtimePackage = loadRuntimePackage(input.package, { waypointVersionId: input.waypointVersionId });
      if (input.stageToken !== input.expectedStageToken)
        throw new VisionEngineError(
          "STAGE_TOKEN_STALE",
          "The story stage token changed before verification completed.",
          { retryable: false },
        );
      if (!Array.isArray(input.frames) || input.frames.length < 1)
        throw new VisionEngineError("INSUFFICIENT_USABLE_FRAMES", "No captured frames were available.");
      if (input.frames.length > 24)
        throw new VisionEngineError("OUT_OF_MEMORY", "Runtime frame count exceeds the bounded local resource policy.");
      const provider = this.providerRouter.select({
        requested: input.provider,
        allowFallback: input.allowProviderFallback !== false,
      });
      emit("EXTRACTING_FEATURES", { provider: provider.provider.id, fallbackUsed: provider.fallbackUsed });
      const evaluations = [];
      for (const frame of input.frames) {
        if (input.signal?.aborted) return this.#cancelled(attemptId, input, started);
        if (this.clock() - started > (input.timeoutMs ?? 8_000))
          throw new VisionEngineError("INFERENCE_TIMEOUT", "Runtime verification exceeded its deadline.");
        evaluations.push(
          evaluateFrame(frame, runtimePackage, {
            stageToken: input.stageToken,
            stageContextValid: input.stageToken === input.expectedStageToken,
            checkpointContext: input.checkpointContext,
          }),
        );
      }
      emit("VERIFYING_GEOMETRY");
      const thresholds = runtimePackage.artifacts["calibration.json"].thresholds;
      const perFramePassing = evaluations.map((evaluation) =>
        mandatoryGates
          .filter((gate) => gate !== "TEMPORAL_CONSISTENCY")
          .every((gate) => evaluation.gates[gate].pass === true),
      );
      const passingFrameCount = perFramePassing.filter(Boolean).length;
      const usableFrameCount = evaluations.filter((evaluation) => evaluation.quality.usable).length;
      const temporalPass =
        passingFrameCount >= thresholds.minimumLocalizedFrames &&
        passingFrameCount / evaluations.length >= thresholds.minimumTemporalAgreement;
      const gateSummary = Object.fromEntries(
        mandatoryGates.map((gate) => {
          if (gate === "TEMPORAL_CONSISTENCY")
            return [
              gate,
              {
                pass: temporalPass,
                metrics: {
                  passingFrameCount,
                  total: evaluations.length,
                  required: thresholds.minimumLocalizedFrames,
                  agreement: passingFrameCount / evaluations.length,
                },
              },
            ];
          const passCount = evaluations.filter((evaluation) => evaluation.gates[gate].pass === true).length;
          return [
            gate,
            {
              pass: passCount >= thresholds.minimumLocalizedFrames,
              metrics: {
                passingFrames: passCount,
                required: thresholds.minimumLocalizedFrames,
                frameDetails: evaluations.map((evaluation) => evaluation.gates[gate].metrics),
              },
            },
          ];
        }),
      );
      const failedGates = mandatoryGates.filter((gate) => gateSummary[gate].pass !== true);
      const qualityFailures = ["CAPTURE_QUALITY", "LOCAL_FEATURE_MATCHING", "SPATIAL_COVERAGE"].filter((gate) =>
        failedGates.includes(gate),
      );
      const ambiguity = failedGates.includes("AMBIGUITY_VETO") || failedGates.includes("HARD_NEGATIVE_MARGIN");
      const result =
        failedGates.length === 0
          ? "VERIFIED"
          : qualityFailures.length && usableFrameCount < thresholds.minimumLocalizedFrames
            ? "INSUFFICIENT_VISUAL_EVIDENCE"
            : ambiguity
              ? "AMBIGUOUS"
              : "NOT_AT_TARGET";
      emit(result === "INSUFFICIENT_VISUAL_EVIDENCE" ? "INSUFFICIENT" : result);
      const guidanceCode = guidanceFor(result, failedGates, evaluations);
      const diagnostics = {
        schemaVersion: RUNTIME_RESULT_SCHEMA_VERSION,
        selectedFrameIds: input.frames.map((frame) => frame.id),
        gates: gateSummary,
        frames: evaluations.map((evaluation) => ({
          frameId: evaluation.frame.id,
          quality: evaluation.quality,
          target: evaluation.target,
          negative: evaluation.negative,
          margin: evaluation.margin,
          localMatches: evaluation.matches.filteredCount,
          inliers: evaluation.geometry.inliers.length,
          inlierRatio: evaluation.geometry.inlierRatio,
          reprojectionError: evaluation.geometry.meanError,
          spatialCoverage: evaluation.coverage,
          pose: evaluation.pose,
        })),
        provider: provider.provider.capabilities(),
        providerAttempts: provider.attempts,
        rawFramesRetained: false,
      };
      const resultObject = {
        schemaVersion: RUNTIME_RESULT_SCHEMA_VERSION,
        attemptId,
        waypointId: runtimePackage.manifest.waypointId,
        waypointVersionId: runtimePackage.manifest.waypointVersionId,
        waypointVersion: runtimePackage.manifest.waypointVersion,
        packageId: runtimePackage.manifest.packageId,
        result,
        recommendedResult: result,
        guidanceCode,
        guidance: guidanceCatalog[guidanceCode],
        retryRecommended: result !== "VERIFIED",
        captainReviewRecommended: result === "AMBIGUOUS",
        capturedFrameCount: input.frames.length,
        usableFrameCount,
        passingFrameCount,
        failedGates,
        evidenceDigest: `sha256:${sha256(stableStringify(diagnostics))}`,
        engineVersion: VISION_ENGINE_VERSION,
        modelBundleVersion: VISION_MODEL_BUNDLE_VERSION,
        provider: provider.provider.id,
        providerFallbackUsed: provider.fallbackUsed,
        durationMs: this.clock() - started,
        shadowMode: true,
        automaticProgression: false,
        rawFramesRetained: false,
        diagnostics,
      };
      state.terminal = true;
      state.result = resultObject;
      for (const frame of input.frames) {
        if (Buffer.isBuffer(frame.pixels)) frame.pixels.fill(0);
        if (Buffer.isBuffer(frame.luminance)) frame.luminance.fill(0);
      }
      return resultObject;
    } catch (error) {
      const code = error?.code ?? "INTERNAL_RUNTIME_ERROR";
      emit("ERROR", { code });
      const resultObject = {
        schemaVersion: RUNTIME_RESULT_SCHEMA_VERSION,
        attemptId,
        waypointVersionId: input.waypointVersionId,
        result: "SYSTEM_ERROR",
        recommendedResult: "SYSTEM_ERROR",
        errorCode: code,
        guidanceCode: code === "INSUFFICIENT_USABLE_FRAMES" ? "NO_STABLE_FEATURES" : "PACKAGE_REPAIR_REQUIRED",
        retryRecommended: Boolean(error?.retryable),
        failedGates: [],
        engineVersion: VISION_ENGINE_VERSION,
        modelBundleVersion: VISION_MODEL_BUNDLE_VERSION,
        durationMs: this.clock() - started,
        shadowMode: true,
        automaticProgression: false,
        rawFramesRetained: false,
      };
      state.terminal = true;
      state.result = resultObject;
      return resultObject;
    }
  }

  #cancelled(attemptId, input, started) {
    const result = {
      schemaVersion: RUNTIME_RESULT_SCHEMA_VERSION,
      attemptId,
      waypointVersionId: input.waypointVersionId,
      result: "CANCELLED",
      recommendedResult: "CANCELLED",
      errorCode: "ATTEMPT_CANCELLED",
      guidanceCode: "ATTEMPT_CANCELLED",
      retryRecommended: true,
      failedGates: [],
      engineVersion: VISION_ENGINE_VERSION,
      modelBundleVersion: VISION_MODEL_BUNDLE_VERSION,
      durationMs: this.clock() - started,
      shadowMode: true,
      automaticProgression: false,
      rawFramesRetained: false,
    };
    this.attempts.set(attemptId, { stage: "CANCELLED", terminal: true, result });
    return result;
  }
}

module.exports = {
  RUNTIME_RESULT_SCHEMA_VERSION,
  VisionRuntimeEngine,
  candidateScores,
  evaluateFrame,
  estimateRelativePose,
};

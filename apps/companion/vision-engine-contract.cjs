"use strict";

const crypto = require("node:crypto");

const VISION_ENGINE_VERSION = "1.0.0-b4";
const VISION_FRAME_SELECTION_VERSION = "b4-diverse-frames-1";
const VISION_MODEL_BUNDLE_VERSION = "classical-vision-cpu-1";
const RUNTIME_PACKAGE_SCHEMA_VERSION = 1;
const BUILD_INPUT_SCHEMA_VERSION = 1;

const buildStages = Object.freeze([
  "QUEUED",
  "INGESTING",
  "VALIDATING_INPUT",
  "CURATING_FRAMES",
  "EXTRACTING_GLOBAL_FEATURES",
  "EXTRACTING_LOCAL_FEATURES",
  "MATCHING_REFERENCE_GRAPH",
  "RECONSTRUCTING",
  "BUILDING_TARGET_INDEX",
  "BUILDING_NEGATIVE_INDEX",
  "ESTIMATING_ACCEPTED_POSE_VOLUME",
  "CALIBRATING",
  "RUNNING_VALIDATION",
  "RUNNING_LOCKED_TESTS",
  "PACKAGING",
  "VALIDATING_PACKAGE",
  "COMPLETE",
  "FAILED",
  "CANCELLED",
]);

const runtimeStages = Object.freeze([
  "IDLE",
  "ARMED",
  "CAPTURING",
  "CURATING_FRAMES",
  "EXTRACTING_FEATURES",
  "RETRIEVING",
  "MATCHING",
  "VERIFYING_GEOMETRY",
  "LOCALIZING",
  "EVALUATING_POSE",
  "EVALUATING_SEQUENCE",
  "EVALUATING_SPECIAL_RULES",
  "VERIFIED",
  "INSUFFICIENT",
  "NOT_AT_TARGET",
  "AMBIGUOUS",
  "ERROR",
  "CANCELLED",
  "CLOSED",
]);

const verificationResults = Object.freeze([
  "VERIFIED",
  "INSUFFICIENT_VISUAL_EVIDENCE",
  "NOT_AT_TARGET",
  "AMBIGUOUS",
  "SYSTEM_ERROR",
  "CANCELLED",
]);

const mandatoryGates = Object.freeze([
  "CAPTURE_QUALITY",
  "STAGE_CONTEXT",
  "TARGET_RETRIEVAL",
  "HARD_NEGATIVE_MARGIN",
  "LOCAL_FEATURE_MATCHING",
  "GEOMETRIC_VERIFICATION",
  "CAMERA_POSE",
  "ORIENTATION_VISIBILITY",
  "SPATIAL_COVERAGE",
  "TEMPORAL_CONSISTENCY",
  "CHECKPOINT_SPECIFIC_RULES",
  "AMBIGUITY_VETO",
]);

const buildFailureCodes = Object.freeze([
  "BUILD_INPUT_SCHEMA_UNSUPPORTED",
  "BUILD_INPUT_ARTIFACT_MISSING",
  "BUILD_INPUT_HASH_MISMATCH",
  "NO_TARGET_RECORDING",
  "NO_VALID_REFERENCE_FRAMES",
  "MISSING_ACCEPTED_REGION",
  "INSUFFICIENT_HARD_NEGATIVE_DATA",
  "INVALID_STABLE_REGION",
  "DATASET_PARTITION_CONFLICT",
  "LOW_VIEW_DIVERSITY",
  "MISSING_CLOSE_RANGE",
  "MISSING_FAR_RANGE",
  "WEAK_ENVIRONMENT_COVERAGE",
  "TOO_FEW_HARD_NEGATIVES",
  "NO_RECONSTRUCTION",
  "DEGENERATE_CAMERA_GEOMETRY",
  "MULTIPLE_DISCONNECTED_COMPONENTS",
  "TARGET_REGION_NOT_RECONSTRUCTED",
  "ACCEPTED_POSE_REGION_INVALID",
  "TARGET_NEGATIVE_NOT_SEPARABLE",
  "FALSE_ACCEPT_IN_LOCKED_TEST",
  "EXCESSIVE_FALSE_NEGATIVE_RATE",
  "MODEL_PROVIDER_UNAVAILABLE",
  "MODEL_LICENSE_BLOCKED",
  "PACKAGE_INTEGRITY_FAILURE",
  "PACKAGE_SCHEMA_FAILURE",
  "BUILD_CANCELLED",
  "BUILD_TIMEOUT",
  "INTERNAL_BUILD_ERROR",
]);

const runtimeErrorCodes = Object.freeze([
  "CAPTURE_SOURCE_UNAVAILABLE",
  "CAPTURE_SOURCE_FROZEN",
  "INSUFFICIENT_USABLE_FRAMES",
  "PACKAGE_NOT_FOUND",
  "PACKAGE_CORRUPT",
  "PACKAGE_INCOMPATIBLE",
  "PACKAGE_SCHEMA_UNSUPPORTED",
  "MODEL_BUNDLE_MISSING",
  "MODEL_VERSION_INCOMPATIBLE",
  "RUNTIME_VERSION_TOO_OLD",
  "INSUFFICIENT_MEMORY",
  "PROVIDER_UNAVAILABLE",
  "OUT_OF_MEMORY",
  "INFERENCE_TIMEOUT",
  "STAGE_TOKEN_STALE",
  "ATTEMPT_CANCELLED",
  "INTERNAL_RUNTIME_ERROR",
]);

const buildFailureGuidance = Object.freeze(
  Object.fromEntries(
    buildFailureCodes.map((code) => [
      code,
      {
        title: code === "BUILD_CANCELLED" ? "Build cancelled" : "Verification build needs attention",
        explanation: code.replaceAll("_", " ").toLocaleLowerCase(),
        correctiveAction:
          code.includes("HARD_NEGATIVE") || code.includes("SEPARABLE")
            ? "Review Similar Wrong Places and add stronger independent confuser evidence."
            : code.includes("FRAME") || code.includes("COVERAGE") || code.includes("RECORDING")
              ? "Review Record Target and replace weak or missing recordings."
              : code.includes("PACKAGE")
                ? "Retry the local build; if it repeats, export a build diagnostic bundle."
                : "Review Data Health and the relevant build stage, then retry safely.",
        severity: ["BUILD_CANCELLED"].includes(code) ? "INFO" : "ERROR",
        retryable: !["BUILD_INPUT_SCHEMA_UNSUPPORTED", "MODEL_LICENSE_BLOCKED"].includes(code),
        studioRoute:
          code.includes("HARD_NEGATIVE") || code.includes("SEPARABLE")
            ? 7
            : code.includes("FRAME") || code.includes("RECORDING")
              ? 4
              : 9,
      },
    ]),
  ),
);

const runtimeErrorGuidance = Object.freeze(
  Object.fromEntries(
    runtimeErrorCodes.map((code) => [
      code,
      {
        title: "Shadow verification could not complete",
        explanation: code.replaceAll("_", " ").toLocaleLowerCase(),
        correctiveAction:
          code.startsWith("PACKAGE_") || code.includes("MODEL")
            ? "Repair or rebuild the local runtime package."
            : "Check Companion status and retry the shadow scan.",
        severity: code === "ATTEMPT_CANCELLED" ? "INFO" : "ERROR",
        retryable: !["PACKAGE_INCOMPATIBLE", "STAGE_TOKEN_STALE"].includes(code),
      },
    ]),
  ),
);

const guidanceCatalog = Object.freeze({
  MOVE_MORE_SLOWLY: { technical: false, retry: true, severity: "INFO" },
  HOLD_STEADY: { technical: false, retry: true, severity: "INFO" },
  STEP_BACK_FOR_CONTEXT: { technical: false, retry: true, severity: "INFO" },
  MOVE_CLOSER: { technical: false, retry: true, severity: "INFO" },
  KEEP_LANDMARK_VISIBLE: { technical: false, retry: true, severity: "INFO" },
  LOOK_FURTHER_LEFT: { technical: false, retry: true, severity: "INFO" },
  LOOK_FURTHER_RIGHT: { technical: false, retry: true, severity: "INFO" },
  INCLUDE_MORE_SURROUNDINGS: { technical: false, retry: true, severity: "INFO" },
  CLEAR_OBSTRUCTION: { technical: false, retry: true, severity: "INFO" },
  TOO_DARK: { technical: false, retry: true, severity: "INFO" },
  TARGET_LIKELY_NEARBY: { technical: false, retry: true, severity: "INFO" },
  AMBIGUOUS_SIMILAR_LOCATION: { technical: false, retry: true, severity: "WARNING" },
  NO_STABLE_FEATURES: { technical: false, retry: true, severity: "WARNING" },
  CAPTURE_WINDOW_UNAVAILABLE: { technical: true, retry: true, severity: "ERROR" },
  PACKAGE_REPAIR_REQUIRED: { technical: true, retry: false, severity: "ERROR" },
  VERIFICATION_COMPLETE: { technical: false, retry: false, severity: "SUCCESS" },
  LOCATION_NOT_CONFIRMED: { technical: false, retry: true, severity: "INFO" },
  ATTEMPT_CANCELLED: { technical: true, retry: true, severity: "INFO" },
});

class VisionEngineError extends Error {
  constructor(code, message, options = {}) {
    super(message || code);
    this.name = "VisionEngineError";
    this.code = code;
    this.retryable = options.retryable ?? true;
    this.details = options.details ?? {};
  }
}

function serializeVisionEngineError(error) {
  const code = String(error?.code ?? "INTERNAL_RUNTIME_ERROR");
  const guidance =
    buildFailureGuidance[code] ?? runtimeErrorGuidance[code] ?? runtimeErrorGuidance.INTERNAL_RUNTIME_ERROR;
  return {
    code,
    developerMessage: String(error?.message ?? code).slice(0, 600),
    userTitle: guidance.title,
    userMessage: guidance.explanation,
    recommendedAction: guidance.correctiveAction,
    severity: guidance.severity,
    retrySafe: error?.retryable ?? guidance.retryable,
    studioRoute: guidance.studioRoute ?? null,
    details: error?.details ?? {},
  };
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object" || Buffer.isBuffer(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalize(value[key])]),
  );
}

function stableStringify(value) {
  return JSON.stringify(canonicalize(value));
}

function sha256(value) {
  const binary = Buffer.isBuffer(value)
    ? value
    : Buffer.from(typeof value === "string" ? value : stableStringify(value));
  return crypto.createHash("sha256").update(binary).digest("hex");
}

function assertIdentifier(value, name) {
  if (
    typeof value !== "string" ||
    value.length < 8 ||
    value.length > 200 ||
    !/^[A-Za-z0-9][A-Za-z0-9:._-]*$/.test(value)
  )
    throw new VisionEngineError("BUILD_INPUT_SCHEMA_UNSUPPORTED", `${name} is invalid.`, { retryable: false });
  return value;
}

function validateBuildInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new VisionEngineError("BUILD_INPUT_SCHEMA_UNSUPPORTED", "BuildInput must be an object.", {
      retryable: false,
    });
  if (input.schemaVersion !== BUILD_INPUT_SCHEMA_VERSION || input.inputType !== "VISION_WAYPOINT_BUILD_INPUT")
    throw new VisionEngineError("BUILD_INPUT_SCHEMA_UNSUPPORTED", "BuildInput schema is not supported.", {
      retryable: false,
    });
  if (!input.waypoint || typeof input.waypoint !== "object")
    throw new VisionEngineError("BUILD_INPUT_SCHEMA_UNSUPPORTED", "BuildInput waypoint identity is missing.", {
      retryable: false,
    });
  assertIdentifier(input.waypoint.id, "waypoint.id");
  assertIdentifier(input.waypoint.versionId, "waypoint.versionId");
  if (!Number.isInteger(input.waypoint.versionNumber) || input.waypoint.versionNumber < 1)
    throw new VisionEngineError("BUILD_INPUT_SCHEMA_UNSUPPORTED", "Waypoint version number is invalid.", {
      retryable: false,
    });
  if (!Array.isArray(input.assets))
    throw new VisionEngineError("BUILD_INPUT_SCHEMA_UNSUPPORTED", "BuildInput assets are missing.", {
      retryable: false,
    });
  if (input.assets.length > 200)
    throw new VisionEngineError(
      "BUILD_INPUT_SCHEMA_UNSUPPORTED",
      "BuildInput exceeds the 200-asset local resource limit.",
      { retryable: false },
    );
  for (const asset of input.assets) {
    assertIdentifier(asset.id, "asset.id");
    if (typeof asset.role !== "string" || !/^[A-Z0-9_]+$/.test(asset.role))
      throw new VisionEngineError("BUILD_INPUT_SCHEMA_UNSUPPORTED", `Asset ${asset.id} has an invalid role.`, {
        retryable: false,
      });
    if (typeof asset.contentHash !== "string" || !/^sha256:[a-f0-9]{64}$/.test(asset.contentHash))
      throw new VisionEngineError("BUILD_INPUT_HASH_MISMATCH", `Asset ${asset.id} has an invalid content hash.`, {
        retryable: false,
      });
  }
  if (!Array.isArray(input.acceptedPoseRegions) || input.acceptedPoseRegions.length < 1)
    throw new VisionEngineError("MISSING_ACCEPTED_REGION", "At least one accepted pose region is required.");
  return input;
}

function buildProgress(stage, stageProgress, messageCode, detail = {}) {
  if (!buildStages.includes(stage))
    throw new VisionEngineError("INTERNAL_BUILD_ERROR", `Unknown build stage ${stage}.`);
  const stageIndex = Math.max(0, buildStages.indexOf(stage));
  const terminalOffset = buildStages.indexOf("COMPLETE");
  const measurableStages = Math.max(1, terminalOffset - 1);
  const boundedStageProgress = stageProgress === null ? null : Math.max(0, Math.min(1, Number(stageProgress)));
  const overallProgress = ["FAILED", "CANCELLED"].includes(stage)
    ? null
    : stage === "COMPLETE"
      ? 1
      : Math.max(0, Math.min(0.99, (Math.max(0, stageIndex - 1) + (boundedStageProgress ?? 0)) / measurableStages));
  return {
    type: "vision.build.progress",
    stage,
    stageProgress: boundedStageProgress,
    overallProgress,
    messageCode,
    ...detail,
  };
}

module.exports = {
  BUILD_INPUT_SCHEMA_VERSION,
  RUNTIME_PACKAGE_SCHEMA_VERSION,
  VISION_ENGINE_VERSION,
  VISION_FRAME_SELECTION_VERSION,
  VISION_MODEL_BUNDLE_VERSION,
  VisionEngineError,
  buildFailureCodes,
  buildFailureGuidance,
  buildProgress,
  buildStages,
  canonicalize,
  guidanceCatalog,
  mandatoryGates,
  runtimeErrorCodes,
  runtimeErrorGuidance,
  runtimeStages,
  sha256,
  stableStringify,
  serializeVisionEngineError,
  validateBuildInput,
  verificationResults,
};

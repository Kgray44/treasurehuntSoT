import type { Point } from "./coordinates";
import { fullHandDetectionPolicy } from "./hand-detection-authority";
import { createNccScratch, searchNcc } from "./index-ncc";
import { TemporalIndexTrack, temporalIndexPolicy, type TemporalIndexSnapshot } from "./temporal-index-track";
import {
  IndexSourceAssociation,
  indexSourceAssociationPolicy,
  sameIndexSourceContext,
} from "./index-source-association";

/** Canonical descriptor identity, not model weights or an accuracy certificate. */
export const indexImageAlgorithmDescriptor = {
  algorithm: "TEMPORAL_INDEX_FUSION_V3",
  policy: {
    radius: 7,
    minimumRadius: 4,
    search: 24,
    peakExclusionRadius: 3,
    minimumCorrelation: 0.75,
    minimumSeparation: 0.035,
    minimumTexture: 6,
    minimumStructure: 0.008,
    reverseSearch: 4,
    maximumForwardBackward: 2,
    maximumRecoveryMs: 1200,
    maximumCaptureAgeMs: 150,
    modelAgreementRadius: 8,
    supportedDifferenceAverageRadius: 10,
    indexShaftRadius: 3,
    indexShaftPalmRadiusRatio: 0.08,
    maximumIndexShaftRadius: 8,
    indexShaftRivalMargin: 2,
    distalRayMaximumBones: 1,
    distalRayMinimumLength: 4,
    predictionLimit: 16,
    maximumMotionStep: 32,
    maximumVelocity: 240,
    minimumGridDimension: 20,
    maximumGridDimension: 640,
    maximumAnalysisDimension: 320,
    maximumAdaptiveOnlyMs: 1200,
    maximumReferenceDisagreement: 2,
    referenceRefreshMinimumFrames: 3,
    referenceRefreshMinimumSpanMs: 120,
    referenceRefreshMaximumGapMs: 250,
    referenceRefreshModelAgreement: 2,
    modelMinimumFrames: 3,
    modelMinimumSpanMs: 120,
    maximumGeometryCohorts: 4,
    maximumGeometryEvidenceSpanMs: 1000,
    modelMaximumGapMs: 250,
    modelMaximumStep: 64,
    modelMinimumScaleRatio: 0.6,
    modelMaximumScaleRatio: 1.67,
    modelMaximumShapeChange: 0.35,
    modelMaximumAxisTurnDegrees: 60,
    modelCorrectionWeight: 0.5,
    modelMinimumCorrectionWeight: 0.15,
    modelMaximumCorrectionStep: 0.5,
    modelCorrectionDeadband: 0.2,
    indexCueMaximumShapeChange: 0.2,
    indexCueUncertainty: 8,
    indexMinimumChain: 0.012,
    indexMaximumChain: 1.2,
    fingerIdentityRadius: 7,
    minimumFingerIdentityRegions: 2,
    requiredDistalIdentityRegion: 2,
  },
  searchDomain: "PREVIOUS_AND_PREDICTED_SQUARE_UNION",
  searchKernel: "EXACT_INTEGER_INTEGRAL_MOMENTS_WITH_ORIGINAL_NCC_PRODUCT_AND_TIE_ORDER",
  coordinates: {
    geometryCohort:
      "FOUR_RECENT_CURRENT_MATCHED_HYPOTHESES_WITH_FIXED_ROTATION_INVARIANT_SHAPE_REFERENCES_AND_LATEST_AXIS_TURN_LIMIT_NO_OUTLIER_CREDIT",
    differenceAveraging:
      "SOURCE_VERIFIED_HAND_EXTENT_ALLOWS_TEN_PIXEL_COMPATIBILITY_OTHERWISE_EIGHT_STEADY_CORRECTION_TARGET_IS_CONFIDENCE_WEIGHTED_MODEL_IMAGE_DIFFERENCE_NOT_FULL_MODEL_BIAS",
    imageOutlier:
      "CURRENT_CREDIBLE_SAME_HAND_CONVEX_HULL_PLUS_CONSERVATIVE_MARGIN_REJECTS_ONLY_OUTSIDE_HAND_MATCHES_EVEN_AFTER_INDEX_PERMISSION_REVOKED_NEVER_REPROVES_INDEX_OR_RESOLVES_INSIDE_HAND_DIGITS",
    shaftSupport:
      "ENTRY_REGISTERED_AUTOMATIC_INDEX_WITH_CURRENT_FOUR_NAMED_INDEX_ASSOCIATIONS_AND_COHERENT_SHAPE_MAY_CLASSIFY_DISTAL_SHAFT_NCC_AS_IDENTITY_ONLY_WITH_THREE_PIXEL_RADIUS_OR_CURRENT_CREDIBLE_PALM_SPAN_TIMES_POINT_ZERO_EIGHT_CAPPED_AT_EIGHT_IF_SEPARATED_FROM_COMPETING_DIGIT_SEGMENTS_NEVER_TIP_COORDINATES_OR_REPROOF",
    shaftConsensus:
      "ONE_INDEPENDENT_SHAFT_MATCH_CAN_CLASSIFY_ITS_SAME_FRAME_REFERENCE_ADAPTIVE_PARTNER_WITHIN_EXISTING_TWO_PIXEL_CONSENSUS_ONLY_WHEN_PARTNER_PASSES_OWN_ENDPOINT_AND_COMPETING_DIGIT_GUARDS",
    distalEndpoint:
      "ALREADY_REGISTERED_VALID_OPTICAL_TIP_MAY_REMAIN_IMAGE_COORDINATE_UP_TO_ONE_PROJECTED_DISTAL_BONE_FORWARD_WITH_EXISTING_EIGHT_PIXEL_NORMAL_BOUND_AND_RIVAL_EXCLUSION_NO_COLD_ANCHOR_REPROOF_OR_MODEL_BIAS_PULL",
    competingDigits:
      "ALL_CURRENT_IN_FRAME_NONINDEX_MODEL_POINTS_AND_SEGMENTS_RETAIN_NEGATIVE_AUTHORITY_INDEPENDENT_OF_WHOLE_HAND_HULL_ELIGIBILITY",
    image: "INTEGER_GATED_CONCAVE_3X3_SUBPIXEL_WITH_FIXED_TEMPLATE_PHASE",
    fusion:
      "IMAGE_DISPLACEMENT_PLUS_BOUNDED_CORRELATION_WEIGHTED_ANATOMICAL_OFFSET_AFTER_SOURCE_SCOPED_GEOMETRIC_PROBATION",
    model: "CURRENT_FULL_POINT_OR_OPTICALLY_REGISTERED_INDEX_AFTER_SOURCE_SCOPED_3_FRAME_120MS_GEOMETRIC_PROBATION",
    continuity:
      "CURRENT_VERIFIED_SAME_HAND_RETAINS_SELECTED_INDEX_ID_DURING_POSE_UNCERTAINTY_WITHOUT_COORDINATE_PERMISSION",
    indexIdentity:
      "ONLY_LIVE_250MS_REGISTRATION_RENEWS_FROM_THREE_CURRENT_OBSERVED_COMMON_NAMED_INDEX_JOINTS_WITH_EXPLICIT_ADAPTER_INDEX_CHAIN_ASSOCIATION_OR_COMPLETE_FIXED_SHAPE_PROOF_NEVER_PALM_ONLY_GESTURE_OR_COORDINATES",
    reconfirmation:
      "NO_CURRENT_ACCEPTED_IMAGE_CONTRADICTION_AND_CURRENT_QUALIFIED_INDEX_GEOMETRY_PLUS_TWO_OLD_AND_CURRENT_MATCHED_REGIONS_SEPARATED_BY_FIFTEEN_PIXELS_INCLUDING_DIP_NN_INNOVATION_EIGHT_TRUE_MATCHED_MATERIAL_REVERSE_CLOSURE_TWO_AND_NEW_TIP_NCC_THREE_FRAMES_120MS_BEFORE_SAME_ID_OPTICAL_REPLACEMENT",
    modelConflict:
      "CURRENT_REGISTERED_FULL_INDEX_OR_LIVE_REGISTERED_PARTIAL_INDEX_CONFLICT_PAUSES_AND_LATCHES_UNRESOLVED_COORDINATES_WITHOUT_COMMITTING_CONFLICTING_OPTICAL_HISTORY_UNREGISTERED_TAGS_ARE_FRAME_LOCAL_NEGATIVE_OR_AMBIGUOUS_PIXELS_MAY_RETAIN_ASSOCIATION_WITHOUT_MEASUREMENT_HISTORY",
    conflictRecovery:
      "SOURCE_MATCHED_TRUSTED_REFERENCE_IMAGE_PROOF_WITHIN_250MS_PLUS_CURRENT_THREE_FRAME_120MS_GEOMETRY_RESTORES_AUTOMATIC_CONTROL_MANUAL_REQUIRES_CURRENT_IMAGE_AND_SAME_SOURCE_CONFIRMED_FULL_POINT_NO_MODEL_REANCHOR",
    conflictSearch:
      "ONE_OLD_SOURCE_SEARCH_PROPOSAL_FROM_FULL_QUALITY_ORIGINAL_STABLE_TEMPLATE_ROUNDTRIP_GAP_250MS_LIFETIME_1200MS_FROM_FROZEN_TRUSTED_CAPTURE_ORIGINAL_WINDOW_RIVALS_AND_ADAPTIVE_REVERSE_ORIGIN_FOREIGN_ALIAS_PROOF_SEPARATELY_USES_STANDARD_TRUSTED_WINDOW_NEVER_OLD_PROPOSAL_NO_TEMPLATE_VELOCITY_MEASUREMENT_OR_IDENTITY_CLOCK_RENEWAL",
    sourceAnatomyRefresh:
      "DEEPCOPY_LATEST_PROVEN_ENTRY_TRUSTED_ACTUAL_SOURCE_CONFIRMED_FULL_POINT_CURRENT_FOUR_INDEX_JOINTS_LIVE_CERT_COHERENT_GEOMETRY_STRICT_EIGHT_PIXEL_OPTICAL_CONSENSUS_AND_OLD_TWO_PART_INDEX_PROOF_BEFORE_SAME_CAPTURE_BANK_RENEWAL_NO_CANDIDATE_NEGATIVE_COLD_SHAFT_RAY_OR_MODEL_ONLY_REFRESH",
    manual: "IMAGE_ONLY_NO_MODEL_INITIALIZATION_RESCUE_OR_EXPIRY_TAKEOVER",
    unavailable:
      "RETAIN_REGISTERED_COHORT_UP_TO_250MS_BUT_REQUIRE_CURRENT_QUALIFIED_FULL_OR_REGISTERED_INDEX_GEOMETRY_FOR_MODEL_ACTION",
    contraryIdentity: "ONLY_CONTINUOUS_FRESH_VERIFIED_SAME_FULL_HAND_SOURCE_RENEWS_IDENTITY_NEVER_POSITIVE_EVIDENCE",
    uncertainty:
      "OPTICAL_HEURISTIC_PLUS_ANATOMICAL_CORRECTION_WITH_DISTAL_ENDPOINT_MODEL_DISAGREEMENT_FLOOR_IN_SOURCE_PIXELS",
    partialIndex:
      "CURRENT_OBSERVED_EXTENDED_INDEX_ONLY_AFTER_EXISTING_OPTICAL_SOURCE_ASSOCIATION_AND_3_FRAME_120MS_COHERENCE_NO_COLD_MODEL_OR_CONTRARY_CLEAR",
  },
  templateUpdate: {
    reference: "STABLE_APPEARANCE_PATCH_AND_FRAME_WITH_TIGHT_MODEL_SUPPORTED_REFRESH_ONLY",
    adaptive: "LAST_ACCEPTED_IMAGE_PATCH",
    selection: "PREFER_FULL_QUALITY_REFERENCE_WITH_BOUNDED_ADAPTIVE_FALLBACK",
    consistency: "ABSTAIN_WHEN_BOTH_FULL_QUALITY_MATCHES_DISAGREE",
    reverse: "REFERENCE_TO_LAST_SUPPORTED_REFERENCE_FRAME_AND_ADAPTIVE_TO_PREVIOUS_ACCEPTED_FRAME",
    refresh: "ONLY_FAILED_REFERENCE_AND_FULL_QUALITY_ADAPTIVE_WITH_TIGHT_SOURCE_SCOPED_CONFIRMED_FULL_POINT",
    refreshFailures: ["APPEARANCE_MISMATCH", "FORWARD_BACKWARD_DISAGREEMENT"],
    stableSuccess: "NEVER_REFRESH_AND_CLEAR_REFRESH_COHORT",
    referenceExpiry: "NO_REFRESH_AFTER_ADAPTIVE_ONLY_BOUND",
    coordinateRebind: "SOURCE_CONDITIONED_CURRENT_MODEL_ASSIST_CAN_REPLACE_OPTICAL_EPOCH_WITHOUT_RELABELING_FINGER",
    modelReRegistration:
      "CURRENT_NEURAL_TIP_COORDINATE_AND_TEMPLATE_ORIGIN_THREE_FRAMES_120MS_WITH_EXISTING_EIGHT_PIXEL_NEURAL_INNOVATION_AND_TRUE_MATERIAL_FORWARD_MATCH_PATCH_REVERSE_CLOSURE_WITHIN_TWO_PIXELS",
  },
  lifecycle: "PREPARE_PIXELS_THEN_SAME_CAPTURE_AUTHORITY_AND_FINAL_DISPATCH_AND_SOURCE_ORIGIN_FRESHNESS_ROLLBACK",
  modelContrary: "LATCH_UNTIL_COHERENT_POINT_OR_NEW_HINT",
  wholeHandAuthority: {
    version: 2,
    promotion: { minimumFrames: 3, minimumSpanMs: 120, maximumGapMs: 250, source: "EXACT_MODEL_TRACK_AND_CONTEXT" },
    contrary: "IMMEDIATE_COMPATIBLE_PAUSE_THEN_CONFIRMED_LATCH",
    ambiguous: "FRAME_LOCAL_ABSTENTION",
    conflict: "FRAME_LOCAL_PAUSE_WITHOUT_PROMOTION",
    positive: "COMPATIBLE_TEMPORAL_PROMOTION_WITH_DECLARED_CONDITIONED_FUSION",
    manualHint: "CANNOT_BYPASS_AVAILABLE_AUTHORITY",
    unavailable: "IMAGE_FALLBACK_WITH_RETAINED_CONTRARY",
    matchedPoint: "CURRENT_ACCEPTED_IMAGE_MATCH_DISPLAY_ONLY_NEVER_ACTION_OR_CALIBRATION",
    detection: fullHandDetectionPolicy,
  },
  manualAnchor: {
    generation: "NEW_GENERATION",
    selectionIntent: "PERSIST_UNTIL_EXPLICIT_AUTOMATIC_OR_SESSION_RESET",
    failedAttempt: "REQUIRE_NEW_SELECTION_WITHOUT_POSITION_RETRY",
    maximumDispatchAgeMs: 150,
  },
  temporalIndex: temporalIndexPolicy,
  sourceAssociation: indexSourceAssociationPolicy,
  temporalSemantics: {
    diagnosticEnvelope:
      "DISPLAY_MATCH_REQUIRES_ACTIVE_LOGICAL_ID_OTHER_CANDIDATES_RETAINED_ONLY_IN_CURRENT_MEASUREMENT_LEDGER_NO_NULL_ID_MATCHEDPOINT",
    automaticEntry:
      "CURRENT_FULL_OR_REGISTERED_INDEX_GEOMETRY_THREE_FRAMES_120MS_BEFORE_AUTOMATIC_SEED_CAN_PUBLISH_POINT_IMAGE_PIXELS_ALONE_CANNOT_PROMOTE_UNPROVED_COLD_INDEX",
    association:
      "LOGICAL_SESSION_INDEX_INDEPENDENT_OF_RAW_TEMPLATE_EPOCH_AND_TEMPORARY_MODEL_ID_CURRENT_MEASUREMENT_OR_SEPARATE_REGISTERED_IDENTITY_PROOF_RENEWS_BOUNDED_CONTINUITY",
    selectedSource: "POST_FINALIZATION_SELECTED_HAND_OR_CANONICAL_SOURCE_NEVER_QUARANTINED_MODEL_CANDIDATE",
    ambiguousImageIdentity:
      "ONLY_ALREADY_ESTABLISHED_SAME_RAW_TRACK_CURRENT_FULL_QUALITY_MATERIAL_MATCH_WITH_CURRENT_ASSOCIATION_CLOCK_NO_AUTOMATIC_ENTRY_OR_COORDINATE_CONFLICT_OR_MODEL_DISAGREEMENT_RETAINS_IDENTITY_CLOCK_WITHOUT_POINT_SOURCE_ALIAS_OR_MEASUREMENT_PERMISSION",
    exactSourceReturn:
      "ONLY_LAST_VERIFIED_ACTUAL_MODEL_SOURCE_WITH_ESTABLISHED_SAME_RAW_CANONICAL_INDEX_AND_IDENTITY_AND_MATERIAL_CLOCKS_WITHIN_250MS_CURRENT_COHERENT_FULL_POINT_AND_STRICT_EIGHT_PIXEL_FULL_QUALITY_TIP_CONSENSUS_NO_ENTRY_OR_COORDINATE_CONFLICT_MAY_REBUILD_EXISTING_MODEL_PROBATION_NO_NEW_SOURCE_ALIAS",
    gesture:
      "CURRENT_CONFIRMED_SAME_SOURCE_ANATOMICAL_POINT_OR_RETAINED_CONTRARY_OTHERWISE_UNKNOWN_INDEPENDENT_OF_POSITION",
    coast:
      "EXISTING_BOUNDED_CONSTANT_VELOCITY_DISPLAY_ONLY_AGE_INCLUDES_COMPLETION_NEVER_MEASUREMENT_SAMPLE_OR_ACTION_KALMAN_NOT_SELECTED",
    sourceAlias:
      "ONLY_SAME_FIRST_TEN_PROVIDER_CAMERA_GEOMETRY_PROVENANCE_FIELDS_NEW_ID_REQUIRES_FIXED_INDEX_SHAPE_OLD_DISTINCT_TIP_AND_TWO_OLD_SEPARATED_ANATOMICAL_PATCHES_INCLUDING_DIP_THREE_CURRENT_FRAMES_120MS_WITH_NO_COMPETING_SOURCE_QUARANTINE_UNPROVED_INPUT_BEFORE_TRUSTED_STATE_ALREADY_PROVEN_ACTUAL_ADAPTER_GENERATION_RETAINS_ASSOCIATION_AND_NEGATIVE_INTENT_WITH_CURRENT_KNOWN_HAND_WITHOUT_INDEX_COORDINATE_PERMISSION",
    expiry:
      "CLEAR_ACTIVE_IDENTITY_KEEP_CANONICAL_CONSUMER_COMPLETED_TARGETS_UNTIL_SEPARATELY_VERIFIED_REPLACEMENT_OR_EXPLICIT_DOMAIN_CHANGE",
    uncertainty: "BOUNDED_HEURISTIC_NOT_CALIBRATED_PROBABILITY_SHARED_CAMERA_ERRORS_NOT_INDEPENDENT",
  },
  grayscale: [77, 150, 29, 8],
} as const;
export const indexImageAlgorithm = {
  providerId: "watchglass.index-image",
  providerVersion: "4",
  algorithm: "TEMPORAL_INDEX_FUSION_V3",
  algorithmDigest: "00fc2b5cd07b6c54dc649ba4bc914f1327dbb3642fa02de6719fdc9b15710094",
} as const;
export type IndexImageBinding = {
  providerGeneration: number;
  cameraLeaseId: string;
  cameraFrameVersion: number;
  frameWidth: number;
  frameHeight: number;
  mirrorTransform: "NONE" | "PREVIEW_X";
};
export type IndexImageObservation = IndexImageBinding & {
  observationVersion: 1;
  providerId: typeof indexImageAlgorithm.providerId;
  providerVersion: typeof indexImageAlgorithm.providerVersion;
  algorithmDigest: string;
  orientation: 0;
  sequence: number;
  monotonicCaptureTime: number;
  monotonicPixelOriginTime?: number;
  monotonicInferenceTime: number;
  trackId: string | null;
  trackGeneration: number;
  point: Point | null;
  matchedPoint?: Point | null;
  coordinateSource?: "IMAGE" | "FUSED" | "MODEL";
  opticalEpoch?: number;
  modelSupport?: "FULL_HAND" | "REGISTERED_INDEX" | null;
  state: "UNSEEDED" | "TRACKING" | "UNCERTAIN" | "LOST";
  modelAgreement: "AGREE" | "DISAGREE" | "UNAVAILABLE";
  anchorSource: "MODEL_INDEX" | "MANUAL_HINT" | null;
  quality: {
    correlation: number | null;
    separation: number | null;
    texture: number | null;
    forwardBackwardErrorPixels: number | null;
  };
  uncertaintyRadiusPixels: number | null;
  reason: string;
  measurements?: {
    model: Point | null;
    image: Point | null;
    accepted: Point | null;
    imageDisposition: "TIP" | "SHAFT" | "DISPUTED" | "UNAVAILABLE";
    modelDisposition: "QUALIFIED" | "CANDIDATE" | "UNAVAILABLE";
  };
  temporalTrack?: TemporalIndexSnapshot;
};
/** Pixels remain in process memory and are never included in observations. */
export type IndexGrayFrame = {
  data: Uint8Array;
  width: number;
  height: number;
  capture: number;
  received: number;
};
export type IndexModelAnchor = {
  point: Point | null;
  pointing: boolean;
  contrary: boolean;
  authority?: "POINT" | "CONTRARY" | "AMBIGUOUS";
  authoritySource?: string;
  identityObserved?: boolean;
  /** Current source-bound adapter continuity; never a pointing or coordinate measurement. */
  identitySource?: string;
  /** Observed named-index association; may retain identity when monocular shape is uncertain. */
  indexIdentityEvidence?: {
    source: string;
    associationBasis: "INDEX_CHAIN_V1";
    joints: readonly { index: number; x: number; y: number }[];
  };
  otherDigitEvidence?: { source: string; points: readonly Point[]; segments: readonly (readonly [Point, Point])[] };
  /** Current observed anatomy only: may preserve index identity while gesture/position is unavailable. */
  indexIdentityGeometry?: {
    source: string;
    index: NonNullable<IndexModelAnchor["geometry"]>["index"];
    associationBasis?: "INDEX_CHAIN_V1" | "OBSERVED_PALM_CONTINUITY_V1";
  };
  /** Current observed whole-hand extent; only rejects clear outside-hand image outliers. */
  handRegion?: {
    source: string;
    points: readonly Point[];
    palmSpan: number;
    structuredSupport?: boolean;
    otherFingerPoints?: readonly Point[];
    otherFingerSegments?: readonly (readonly [Point, Point])[];
  };
  indexCue?: { source: string; index: NonNullable<IndexModelAnchor["geometry"]>["index"] };
  geometry?: {
    index: readonly [
      { x: number; y: number; z: number },
      { x: number; y: number; z: number },
      { x: number; y: number; z: number },
      { x: number; y: number; z: number },
    ];
    palmSpan: number;
  };
};
/** Shape continuity only. Callers must separately validate current anatomy, source, time and motion. */
export function indexShapeContinues(
  previous: NonNullable<IndexModelAnchor["geometry"]>["index"],
  current: NonNullable<IndexModelAnchor["geometry"]>["index"],
  aspect: number,
  maximumShapeChange: number,
  maximumAxisTurnDegrees: number,
  normalization?: { previous: number; current: number },
  axisReference?: NonNullable<IndexModelAnchor["geometry"]>["index"],
): boolean {
  if (
    !Number.isFinite(aspect) ||
    aspect <= 0 ||
    !Number.isFinite(maximumShapeChange) ||
    maximumShapeChange < 0 ||
    maximumShapeChange > 1 ||
    !Number.isFinite(maximumAxisTurnDegrees) ||
    maximumAxisTurnDegrees < 0 ||
    maximumAxisTurnDegrees > 180 ||
    previous.length !== 4 ||
    current.length !== 4 ||
    (normalization !== undefined &&
      ![normalization.previous, normalization.current].every((scale) => Number.isFinite(scale) && scale > 0))
  )
    return false;
  const measure = (joints: typeof current) => {
    if (!joints.every((joint) => [joint.x, joint.y, joint.z].every(Number.isFinite))) return null;
    const bones = [0, 1, 2].map((i) => ({
      x: joints[i + 1].x - joints[i].x,
      y: (joints[i + 1].y - joints[i].y) * aspect,
      z: joints[i + 1].z - joints[i].z,
    }));
    const lengths = bones.map((bone) => Math.hypot(bone.x, bone.y, bone.z));
    const chain = lengths.reduce((sum, length) => sum + length, 0);
    const axis = {
      x: joints[3].x - joints[0].x,
      y: (joints[3].y - joints[0].y) * aspect,
      z: joints[3].z - joints[0].z,
    };
    const reach = Math.hypot(axis.x, axis.y, axis.z);
    if (!Number.isFinite(chain) || !Number.isFinite(reach) || reach <= 1e-9 || lengths.some((length) => length <= 1e-9))
      return null;
    return {
      axis,
      reach,
      lengths,
      chain,
      relationships: [
        [0, 1],
        [1, 2],
        [0, 2],
      ].map(([a, b]) =>
        Math.max(
          -1,
          Math.min(
            1,
            (bones[a].x * bones[b].x + bones[a].y * bones[b].y + bones[a].z * bones[b].z) / (lengths[a] * lengths[b]),
          ),
        ),
      ),
    };
  };
  const old = measure(previous),
    next = measure(current),
    priorAxis = axisReference ? measure(axisReference) : old;
  if (!old || !next || !priorAxis) return false;
  const oldLengths = old.lengths.map((length) => length / (normalization?.previous ?? old.chain));
  const nextLengths = next.lengths.map((length) => length / (normalization?.current ?? next.chain));
  const alignment =
    (priorAxis.axis.x * next.axis.x + priorAxis.axis.y * next.axis.y + priorAxis.axis.z * next.axis.z) /
    (priorAxis.reach * next.reach);
  return (
    alignment >= Math.cos((maximumAxisTurnDegrees * Math.PI) / 180) - 1e-12 &&
    nextLengths.every(
      (length, i) => Math.max(length, oldLengths[i]) / Math.min(length, oldLengths[i]) <= 1 + maximumShapeChange,
    ) &&
    next.relationships.every((relationship, i) => Math.abs(relationship - old.relationships[i]) <= maximumShapeChange)
  );
}
type Patch = { values: Float32Array; mean: number; deviation: number; structure: number; radius: number };
type Match = { point: Point; refinedPoint?: Point; correlation: number; separation: number };
type MatchEvaluation = {
  accepted: { found: Match; current: Patch; backward: number } | null;
  reason: string | null;
  quality: IndexImageObservation["quality"];
};
/** Single-use handle; ownership is checked by object identity, never by capture alone. */
export type IndexImagePreparedToken = Readonly<{ capture: number }>;
type PreparedImage = {
  token: IndexImagePreparedToken;
  frame: IndexGrayFrame;
  hint: Point | null;
  matches: { stable: MatchEvaluation; adaptive: MatchEvaluation } | null;
};
const policy = indexImageAlgorithmDescriptor.policy;
let nextAnchor = 0;
const boundedPoint = (p: Point) =>
  Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1;
type ModelGeometry = NonNullable<IndexModelAnchor["geometry"]>;
type ModelContinuity = {
  source: string;
  startedAt: number;
  lastAt: number;
  frames: number;
  geometry: ModelGeometry;
  referenceGeometry: ModelGeometry;
  point: Point;
  associated: boolean;
};
type IndexCue = NonNullable<IndexModelAnchor["indexCue"]>;
type IndexIdentity = {
  source: string;
  referenceIndex: IndexCue["index"];
  index: IndexCue["index"];
  chain: number;
  lastAt: number;
  observed: { index: number; x: number; y: number }[];
};
function indexIdentityMetrics(model: IndexModelAnchor | null | undefined, aspect: number) {
  const source = model?.identitySource;
  if (!model || !source?.trim()) return null;
  const supplied =
    model.indexIdentityGeometry ??
    (model.geometry && model.authoritySource === source ? { source, index: model.geometry.index } : model.indexCue);
  if (
    !supplied ||
    supplied.source !== source ||
    !Array.isArray(supplied.index) ||
    supplied.index.length !== 4 ||
    !supplied.index.every((joint) => joint && boundedPoint(joint) && Number.isFinite(joint.z))
  )
    return null;
  const lengths = [0, 1, 2].map((i) =>
    Math.hypot(
      supplied.index[i + 1].x - supplied.index[i].x,
      (supplied.index[i + 1].y - supplied.index[i].y) * aspect,
      supplied.index[i + 1].z - supplied.index[i].z,
    ),
  );
  const chain = lengths.reduce((sum, length) => sum + length, 0),
    p = fullHandDetectionPolicy.fingers;
  return lengths.every((length) => length >= p.minimumBone) &&
    chain >= policy.indexMinimumChain &&
    chain <= policy.indexMaximumChain &&
    lengths[1] >= lengths[0] * p.minimumMiddleProximalRatio &&
    lengths[1] <= lengths[0] * p.maximumMiddleProximalRatio &&
    lengths[2] >= lengths[0] * p.minimumDistalProximalRatio &&
    lengths[2] <= lengths[0] * p.maximumDistalProximalRatio
    ? {
        source,
        index: supplied.index,
        chain,
        indexAssociated: "associationBasis" in supplied && supplied.associationBasis === "INDEX_CHAIN_V1",
      }
    : null;
}
type CueContinuity = {
  source: string;
  startedAt: number;
  lastAt: number;
  frames: number;
  index: IndexCue["index"];
  referenceIndex: IndexCue["index"];
  referenceChain: number;
  chain: number;
};
function distanceToSegment(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / Math.max(1e-9, dx * dx + dy * dy)));
  return Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy);
}
function advanceGeometryCohorts<T extends { startedAt: number; lastAt: number; frames: number; associated?: boolean }>(
  history: T[],
  capture: number,
  retain: (value: T) => boolean,
  coherent: (value: T) => boolean,
  advance: (value: T) => T,
  create: () => T,
): { history: T[]; current: T } {
  const retained = history.filter(
    (value) =>
      retain(value) &&
      (value.frames >= policy.modelMinimumFrames || capture - value.startedAt <= policy.maximumGeometryEvidenceSpanMs),
  );
  const matched = retained
    .filter(coherent)
    .sort(
      (a, b) =>
        Number(b.associated === true) - Number(a.associated === true) || b.frames - a.frames || b.lastAt - a.lastAt,
    )[0];
  const current = matched ? advance(matched) : create();
  // An outlier starts separate probation; it never erases another recent
  // compatible cohort or contributes a sample to it. Only this frame's
  // matched/current cohort can authorize current coordinates.
  return {
    current,
    history: [current, ...retained.filter((value) => value !== matched)].slice(0, policy.maximumGeometryCohorts),
  };
}
function distanceOutsideHull(point: Point, points: Point[]): number {
  const cross = (a: Point, b: Point, c: Point) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const sorted = points.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  const half = (values: Point[]) => {
    const result: Point[] = [];
    for (const value of values) {
      while (result.length > 1 && cross(result[result.length - 2], result[result.length - 1], value) <= 0) result.pop();
      result.push(value);
    }
    return result.slice(0, -1);
  };
  const hull = [...half(sorted), ...half(sorted.reverse())];
  if (hull.length < 3) return 0; // No credible two-dimensional extent: abstain from rejection.
  let inside = true,
    distance = Infinity;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i],
      b = hull[(i + 1) % hull.length];
    if (cross(a, b, point) < 0) inside = false;
    const dx = b.x - a.x,
      dy = b.y - a.y;
    const t = Math.max(
      0,
      Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / Math.max(1e-9, dx * dx + dy * dy)),
    );
    distance = Math.min(distance, Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy));
  }
  return inside ? 0 : distance;
}
function cueMetrics(
  model: IndexModelAnchor | null | undefined,
  aspect: number,
): { cue: IndexCue; chain: number } | null {
  const cue = model?.indexCue,
    p = fullHandDetectionPolicy;
  if (
    model?.authority ||
    !model?.pointing ||
    model.contrary ||
    !model.point ||
    !boundedPoint(model.point) ||
    !cue?.source?.trim() ||
    !Array.isArray(cue.index) ||
    cue.index.length !== 4 ||
    !cue.index.every((joint) => joint && boundedPoint(joint) && Number.isFinite(joint.z))
  )
    return null;
  if (Math.hypot(cue.index[3].x - model.point.x, cue.index[3].y - model.point.y) > 1e-6) return null;
  const vectors = [0, 1, 2].map((i) => ({
    x: cue.index[i + 1].x - cue.index[i].x,
    y: (cue.index[i + 1].y - cue.index[i].y) / aspect,
    z: cue.index[i + 1].z - cue.index[i].z,
  }));
  const lengths = vectors.map((v) => Math.hypot(v.x, v.y, v.z)),
    chain = lengths.reduce((a, b) => a + b, 0);
  const alignment = (i: number, j: number) =>
    (vectors[i].x * vectors[j].x + vectors[i].y * vectors[j].y + vectors[i].z * vectors[j].z) /
    (lengths[i] * lengths[j]);
  const reach = Math.hypot(
    cue.index[3].x - cue.index[0].x,
    (cue.index[3].y - cue.index[0].y) / aspect,
    cue.index[3].z - cue.index[0].z,
  );
  return lengths.every((length) => length >= p.fingers.minimumBone) &&
    chain >= policy.indexMinimumChain &&
    chain <= policy.indexMaximumChain &&
    lengths[1] >= lengths[0] * p.fingers.minimumMiddleProximalRatio &&
    lengths[1] <= lengths[0] * p.fingers.maximumMiddleProximalRatio &&
    lengths[2] >= lengths[0] * p.fingers.minimumDistalProximalRatio &&
    lengths[2] <= lengths[0] * p.fingers.maximumDistalProximalRatio &&
    reach / chain >= p.index.minimumStraightness &&
    alignment(0, 1) >= p.index.minimumPipAlignment &&
    alignment(1, 2) >= p.index.minimumDipAlignment
    ? { cue, chain }
    : null;
}
function validModelGeometry(
  model: IndexModelAnchor | null | undefined,
  aspect: number,
): model is IndexModelAnchor & { point: Point; geometry: ModelGeometry; authoritySource: string } {
  const g = model?.geometry;
  if (
    model?.authority !== "POINT" ||
    !model.pointing ||
    model.contrary ||
    !model.authoritySource?.trim() ||
    !model.point ||
    !boundedPoint(model.point) ||
    !g ||
    g.index.length !== 4 ||
    !Number.isFinite(g.palmSpan) ||
    g.palmSpan < fullHandDetectionPolicy.palm.minimumSpan ||
    g.palmSpan > fullHandDetectionPolicy.palm.maximumSpan ||
    !g.index.every((p) => boundedPoint(p) && Number.isFinite(p.z))
  )
    return false;
  if (Math.hypot(model.point.x - g.index[3].x, model.point.y - g.index[3].y) > 1e-6) return false;
  const length = (a: ModelGeometry["index"][number], b: ModelGeometry["index"][number]) =>
    Math.hypot(a.x - b.x, (a.y - b.y) / aspect, a.z - b.z);
  const segments = [0, 1, 2].map((i) => length(g.index[i], g.index[i + 1]));
  const chain = segments.reduce((sum, value) => sum + value, 0);
  const p = fullHandDetectionPolicy;
  const vectors = [0, 1, 2].map((i) => ({
    x: g.index[i + 1].x - g.index[i].x,
    y: (g.index[i + 1].y - g.index[i].y) / aspect,
    z: g.index[i + 1].z - g.index[i].z,
  }));
  const alignment = (i: number, j: number) =>
    (vectors[i].x * vectors[j].x + vectors[i].y * vectors[j].y + vectors[i].z * vectors[j].z) /
    (segments[i] * segments[j]);
  return (
    segments.every((value) => value >= p.fingers.minimumBone && value <= g.palmSpan * p.fingers.maximumBonePalmRatio) &&
    segments[0] >= g.palmSpan * p.index.minimumProximalPalmRatio &&
    segments.slice(1).every((value) => value >= g.palmSpan * p.index.minimumDistalPalmRatio) &&
    segments[1] >= segments[0] * p.fingers.minimumMiddleProximalRatio &&
    segments[1] <= segments[0] * p.fingers.maximumMiddleProximalRatio &&
    segments[2] >= segments[0] * p.fingers.minimumDistalProximalRatio &&
    segments[2] <= segments[0] * p.fingers.maximumDistalProximalRatio &&
    chain >= policy.indexMinimumChain &&
    chain <= policy.indexMaximumChain &&
    chain >= g.palmSpan * p.fingers.minimumChainPalmRatio &&
    chain <= g.palmSpan * p.fingers.maximumChainPalmRatio &&
    length(g.index[0], g.index[3]) / chain >= p.index.minimumStraightness &&
    alignment(0, 1) >= p.index.minimumPipAlignment &&
    alignment(1, 2) >= p.index.minimumDipAlignment
  );
}
function patch(frame: IndexGrayFrame, center: Point, radius: number): Patch | null {
  const x = Math.round(center.x),
    y = Math.round(center.y);
  if (x - radius < 1 || y - radius < 1 || x + radius >= frame.width - 1 || y + radius >= frame.height - 1) return null;
  const size = (2 * radius + 1) ** 2,
    values = new Float32Array(size);
  let sum = 0,
    squared = 0,
    xx = 0,
    yy = 0,
    xy = 0,
    i = 0;
  for (let dy = -radius; dy <= radius; ++dy)
    for (let dx = -radius; dx <= radius; ++dx) {
      const index = (y + dy) * frame.width + x + dx,
        value = frame.data[index];
      values[i++] = value;
      sum += value;
      squared += value * value;
      const gx = (frame.data[index + 1] - frame.data[index - 1]) / 2;
      const gy = (frame.data[index + frame.width] - frame.data[index - frame.width]) / 2;
      xx += gx * gx;
      yy += gy * gy;
      xy += gx * gy;
    }
  const mean = sum / size,
    deviation = Math.sqrt(Math.max(0, squared / size - mean * mean));
  const total = xx + yy;
  const smallEigen = (total - Math.sqrt((xx - yy) ** 2 + 4 * xy * xy)) / 2;
  return { values, mean, deviation, structure: smallEigen / Math.max(1e-9, total), radius };
}
/**
 * A local appearance tracker for one explicitly anchored fingertip. It cannot
 * recognize a finger from an arbitrary image, infer hidden joints, or certify
 * pointing intent. Ambiguous appearance produces no actionable point.
 */
export class IndexImageTracker {
  private readonly temporal = new TemporalIndexTrack();
  private readonly sourceAssociation = new IndexSourceAssociation();
  private sourceAnatomy: IndexModelAnchor["geometry"] | null = null;
  private sourceCanonical: string | null = null;
  private trustedModelSource: string | null = null;
  private sequence = 0;
  private lastCapture = -Infinity;
  private acceptedAt = -Infinity;
  private associationAt = -Infinity;
  private previous: IndexGrayFrame | null = null;
  private template: Patch | null = null;
  private reference: { template: Patch; frame: IndexGrayFrame; point: Point } | null = null;
  private lastReferenceAt = -Infinity;
  private referenceRefreshCandidate: { source: string; startedAt: number; lastAt: number; frames: number } | null =
    null;
  private pending: PreparedImage | null = null;
  private point: Point | null = null;
  private velocity: Point = { x: 0, y: 0 };
  // A disputed optical trajectory may guide a bounded search, but cannot
  // replace any trusted measurement, template, velocity or evidence clock.
  private quarantinedSearch: {
    point: Point;
    at: number;
    frozenTrustedAt: number;
    source: string;
    reference: NonNullable<IndexImageTracker["reference"]>;
    opticalEpoch: number;
  } | null = null;
  private trackId: string | null = null;
  private trackGeneration = 0;
  private anchorSource: IndexImageObservation["anchorSource"] = null;
  private automaticEntryPending = false;
  private manualSelection = false;
  private vetoed = false;
  private authorityVetoed = false;
  private authorityCandidate: {
    kind: "POINT" | "CONTRARY";
    source: string;
    startedAt: number;
    lastAt: number;
    frames: number;
    confirmed: boolean;
  } | null = null;
  private failures = 0;
  private grid: { width: number; height: number } | null = null;
  private modelContinuity: ModelContinuity | null = null;
  private modelCohorts: ModelContinuity[] = [];
  private modelAcceptedAt = -Infinity;
  private opticalEpoch = 0;
  private imagePhase: Point = { x: 0, y: 0 };
  private anatomicalOffset: Point = { x: 0, y: 0 };
  private modelOpticalCandidate: {
    source: string;
    startedAt: number;
    lastAt: number;
    frames: number;
    template: Patch;
    frame: IndexGrayFrame;
    point: Point;
  } | null = null;
  private modelCoordinate: { source: string; at: number; point: Point; output: Point } | null = null;
  private wasModelOnly = false;
  private modelIdentity: { source: string; seenAt: number } | null = null;
  private handIdentity: { source: string; seenAt: number; coordinateSupport: boolean } | null = null;
  private indexIdentity: IndexIdentity | null = null;
  private coordinateConflict: { source: string | null; at: number; imageProofAt: number | null } | null = null;
  private fingerReference: {
    source: string;
    frame: IndexGrayFrame;
    anchors: { index: number; point: Point; template: Patch }[];
  } | null = null;
  private cueAssociation: { source: string; lastAt: number } | null = null;
  private cueContinuity: CueContinuity | null = null;
  private cueCohorts: CueContinuity[] = [];
  private readonly searchScores = new Float64Array((policy.search * 2 + 1 + policy.predictionLimit) ** 2);
  private readonly reverseScores = new Float64Array((policy.reverseSearch * 2 + 1) ** 2);
  private nccScratch = createNccScratch(policy);
  constructor(readonly binding: IndexImageBinding) {}
  /** Selection intent survives failed pixels and internal expiry; it supplies no evidence. */
  requestManualSelection() {
    const retainedAuthorityVeto = this.authorityVetoed,
      retainedVeto = this.vetoed;
    this.reset();
    this.manualSelection = true;
    this.authorityVetoed = retainedAuthorityVeto;
    this.vetoed = retainedVeto;
  }
  reset(retainTemporalAssociation = false) {
    if (!retainTemporalAssociation) this.temporal.reset();
    this.sourceAssociation.reset();
    this.sourceAnatomy = null;
    this.sourceCanonical = null;
    this.trustedModelSource = null;
    this.previous = null;
    this.template = null;
    this.reference = null;
    this.lastReferenceAt = -Infinity;
    this.referenceRefreshCandidate = null;
    this.pending = null;
    this.nccScratch = createNccScratch(policy);
    this.point = null;
    this.velocity = { x: 0, y: 0 };
    this.quarantinedSearch = null;
    this.acceptedAt = -Infinity;
    this.associationAt = -Infinity;
    this.trackId = null;
    this.trackGeneration = 0;
    this.anchorSource = null;
    this.automaticEntryPending = false;
    this.manualSelection = false;
    this.vetoed = false;
    this.authorityVetoed = false;
    this.authorityCandidate = null;
    this.failures = 0;
    this.grid = null;
    this.modelContinuity = null;
    this.modelCohorts = [];
    this.modelAcceptedAt = -Infinity;
    this.opticalEpoch = 0;
    this.imagePhase = { x: 0, y: 0 };
    this.anatomicalOffset = { x: 0, y: 0 };
    this.modelOpticalCandidate = null;
    this.modelCoordinate = null;
    this.wasModelOnly = false;
    this.modelIdentity = null;
    this.handIdentity = null;
    this.indexIdentity = null;
    this.coordinateConflict = null;
    this.fingerReference = null;
    this.cueAssociation = null;
    this.cueContinuity = null;
    this.cueCohorts = [];
    // A reset cannot make an old camera frame new.
  }
  prepare(frame: IndexGrayFrame, manualHint?: Point | null): IndexImagePreparedToken {
    if (this.pending) throw new Error("INDEX_IMAGE_CAPTURE_ALREADY_PENDING");
    if (
      !Number.isInteger(frame.width) ||
      !Number.isInteger(frame.height) ||
      frame.width < policy.minimumGridDimension ||
      frame.height < policy.minimumGridDimension ||
      frame.width > policy.maximumGridDimension ||
      frame.height > policy.maximumGridDimension ||
      frame.data.length !== frame.width * frame.height ||
      ![frame.capture, frame.received].every(Number.isFinite) ||
      frame.capture <= this.lastCapture ||
      frame.received < frame.capture ||
      frame.received - frame.capture > policy.maximumCaptureAgeMs
    )
      throw new Error("INDEX_IMAGE_FRAME_INVALID_OR_STALE");
    this.lastCapture = frame.capture;
    if (manualHint) this.requestManualSelection();
    const owned = { ...frame, data: frame.data.slice() };
    const token = Object.freeze({ capture: frame.capture });
    const matches =
      !manualHint &&
      (!this.grid || (this.grid.width === frame.width && this.grid.height === frame.height)) &&
      frame.capture - Math.max(this.acceptedAt, this.associationAt) <= policy.maximumRecoveryMs
        ? this.computeMatches(owned)
        : null;
    this.pending = { token, frame: owned, hint: manualHint ? { ...manualHint } : null, matches };
    return token;
  }
  discard(token?: IndexImagePreparedToken) {
    if (!this.pending || (token && this.pending.token !== token)) return false;
    this.pending = null;
    this.nccScratch = createNccScratch(policy);
    return true;
  }
  complete(
    token: IndexImagePreparedToken,
    model: IndexModelAnchor | null | undefined,
    completionClock: number | (() => number),
    sourceFresh: () => boolean = () => true,
  ): IndexImageObservation {
    const pending = this.pending;
    if (!pending || pending.token !== token) throw new Error("INDEX_IMAGE_PREPARED_CAPTURE_INVALID");
    this.pending = null;
    const now = () => (typeof completionClock === "function" ? completionClock() : completionClock);
    const validTime = (value: number) =>
      Number.isFinite(value) && value >= token.capture && value - token.capture <= policy.maximumCaptureAgeMs;
    const started = now();
    if (!validTime(started) || !sourceFresh()) {
      this.nccScratch = createNccScratch(policy);
      throw new Error("INDEX_IMAGE_FRAME_INVALID_OR_STALE");
    }
    // Finalization is synchronous and private. A slow seed search must not keep
    // an identity alive merely because it started inside the freshness limit.
    const checkpoint = this.checkpoint();
    const temporalCheckpoint = this.temporal.checkpoint();
    const sourceCheckpoint = this.sourceAssociation.checkpoint();
    try {
      // Foreign NN candidates cannot inherit the selected hand's speculative
      // search. Keep its old-source optical hypothesis separately; destroying
      // it merely because another NN ID appeared would defeat reacquisition.
      const trustedSearchSource = this.trustedModelSource ?? this.handIdentity?.source;
      const foreignSearchSource =
        !!trustedSearchSource && !!model?.identitySource && model.identitySource !== trustedSearchSource;
      const sourceMatches = foreignSearchSource ? this.computeMatches(pending.frame, false) : pending.matches;
      const entryTrustedModel = !!this.trustedModelSource && model?.identitySource === this.trustedModelSource;
      const associatedModel = this.associateModelSource(model, pending.frame, sourceMatches);
      const observation = this.finishUpdate(
        { ...pending.frame, received: started },
        associatedModel,
        pending.hint,
        pending.matches,
        entryTrustedModel,
      );
      const completed = now();
      if (!validTime(completed) || completed < started || !sourceFresh())
        throw new Error("INDEX_IMAGE_FRAME_INVALID_OR_STALE");
      const temporal = this.temporal.observe({
        capture: pending.frame.capture,
        completed,
        rawTrackId: observation.trackId,
        point: observation.point,
        uncertaintyPixels: observation.uncertaintyRadiusPixels,
        identitySupported:
          this.associationAt === pending.frame.capture ||
          (observation.trackId !== null &&
            observation.matchedPoint != null &&
            !this.automaticEntryPending &&
            !this.coordinateConflict &&
            observation.modelAgreement !== "DISAGREE") ||
          this.handIdentity?.seenAt === pending.frame.capture,
        // The model may still be a quarantined candidate. Its source is not
        // the provenance of the selected finger unless finalization proved it.
        source: this.handIdentity?.source ?? this.sourceCanonical ?? null,
        retainedImageIdentity:
          observation.state === "UNCERTAIN" &&
          observation.reason === "FULL_HAND_AMBIGUOUS" &&
          observation.matchedPoint != null &&
          this.associationAt === pending.frame.capture &&
          !this.automaticEntryPending &&
          !this.coordinateConflict &&
          observation.modelAgreement !== "DISAGREE",
        intent:
          this.authorityVetoed || this.vetoed
            ? "CONTRARY"
            : associatedModel?.authority === "POINT" &&
                associatedModel.pointing &&
                associatedModel.identitySource === this.handIdentity?.source &&
                this.authorityCandidate?.confirmed &&
                this.authorityCandidate.lastAt === pending.frame.capture
              ? "POINT"
              : "UNCERTAIN",
        ambiguous: observation.reason === "FULL_HAND_AMBIGUOUS",
        hypotheses: Math.max(this.sourceAssociation.candidateCount, this.coordinateConflict ? 2 : 1),
        width: this.binding.frameWidth,
        height: this.binding.frameHeight,
      });
      const finalized = now();
      if (!validTime(finalized) || finalized < completed || !sourceFresh())
        throw new Error("INDEX_IMAGE_FRAME_INVALID_OR_STALE");
      const snapshotAge =
        temporal.snapshot.measurementAgeMs === null ? null : temporal.snapshot.measurementAgeMs + finalized - completed;
      if (temporal.snapshot.state === "COASTING" && snapshotAge! > policy.maximumCaptureAgeMs) {
        temporal.snapshot.state = "REACQUIRING";
        temporal.snapshot.displayPoint = null;
      }
      temporal.snapshot.measurementAgeMs = snapshotAge;
      return {
        ...observation,
        monotonicInferenceTime: finalized,
        trackId: temporal.trackId,
        trackGeneration: temporal.trackGeneration,
        state: observation.state === "TRACKING" && !temporal.accept ? "UNCERTAIN" : observation.state,
        point: temporal.accept ? observation.point : null,
        reason:
          observation.state === "TRACKING" && !temporal.accept
            ? "INDEX_SOURCE_ASSOCIATION_PENDING"
            : observation.reason,
        matchedPoint:
          temporal.trackId === null || (observation.state === "TRACKING" && !temporal.accept)
            ? null
            : observation.matchedPoint,
        measurements: observation.measurements
          ? {
              ...observation.measurements,
              model: model?.point && boundedPoint(model.point) ? { ...model.point } : null,
              modelDisposition:
                associatedModel?.point === null && model?.point
                  ? "CANDIDATE"
                  : observation.measurements.modelDisposition,
              accepted: temporal.accept ? observation.measurements.accepted : null,
            }
          : undefined,
        temporalTrack: temporal.snapshot,
      };
    } catch (error) {
      Object.assign(this, checkpoint);
      this.temporal.restore(temporalCheckpoint);
      this.sourceAssociation.restore(sourceCheckpoint);
      this.nccScratch = createNccScratch(policy);
      throw error;
    }
  }
  update(frame: IndexGrayFrame, model?: IndexModelAnchor | null, manualHint?: Point | null): IndexImageObservation {
    return this.complete(this.prepare(frame, manualHint), model, frame.received);
  }
  private checkpoint() {
    return {
      sequence: this.sequence,
      sourceAnatomy: this.sourceAnatomy,
      sourceCanonical: this.sourceCanonical,
      trustedModelSource: this.trustedModelSource,
      acceptedAt: this.acceptedAt,
      associationAt: this.associationAt,
      previous: this.previous,
      template: this.template,
      reference: this.reference,
      lastReferenceAt: this.lastReferenceAt,
      referenceRefreshCandidate: this.referenceRefreshCandidate,
      point: this.point,
      velocity: this.velocity,
      quarantinedSearch: this.quarantinedSearch,
      trackId: this.trackId,
      trackGeneration: this.trackGeneration,
      anchorSource: this.anchorSource,
      automaticEntryPending: this.automaticEntryPending,
      manualSelection: this.manualSelection,
      vetoed: this.vetoed,
      authorityVetoed: this.authorityVetoed,
      authorityCandidate: this.authorityCandidate,
      failures: this.failures,
      grid: this.grid,
      modelContinuity: this.modelContinuity,
      modelCohorts: this.modelCohorts,
      modelAcceptedAt: this.modelAcceptedAt,
      opticalEpoch: this.opticalEpoch,
      imagePhase: this.imagePhase,
      anatomicalOffset: this.anatomicalOffset,
      modelOpticalCandidate: this.modelOpticalCandidate,
      modelCoordinate: this.modelCoordinate,
      wasModelOnly: this.wasModelOnly,
      modelIdentity: this.modelIdentity,
      handIdentity: this.handIdentity,
      indexIdentity: this.indexIdentity,
      coordinateConflict: this.coordinateConflict,
      fingerReference: this.fingerReference,
      cueAssociation: this.cueAssociation,
      cueContinuity: this.cueContinuity,
      cueCohorts: this.cueCohorts,
    };
  }
  private computeMatches(frame: IndexGrayFrame, allowQuarantine = true): PreparedImage["matches"] {
    if (!this.point || !this.template || !this.previous || !this.reference) return null;
    const candidate = this.quarantinedSearch;
    const searchCandidate =
      allowQuarantine &&
      candidate &&
      candidate.reference === this.reference &&
      candidate.opticalEpoch === this.opticalEpoch &&
      candidate.source === this.handIdentity?.source &&
      candidate.source === this.coordinateConflict?.source &&
      frame.capture - candidate.at <= policy.modelMaximumGapMs &&
      frame.capture - candidate.frozenTrustedAt <= policy.maximumRecoveryMs
        ? candidate
        : null;
    const previousPoint = searchCandidate?.point ?? this.point;
    const gap = frame.capture - (searchCandidate?.at ?? this.acceptedAt);
    const prediction = searchCandidate
      ? { x: 0, y: 0 }
      : { x: (this.velocity.x * gap) / 1000, y: (this.velocity.y * gap) / 1000 };
    const predictedDistance = Math.hypot(prediction.x, prediction.y);
    const predictionCap = predictedDistance > policy.predictionLimit ? policy.predictionLimit / predictedDistance : 1;
    const predicted = {
      x: previousPoint.x + prediction.x * predictionCap,
      y: previousPoint.y + prediction.y * predictionCap,
    };
    const scale = this.binding.frameWidth / frame.width;
    const evaluate = (template: Patch, history: IndexGrayFrame, origin: Point): MatchEvaluation => {
      let found = searchNcc(
        frame,
        template,
        predicted,
        policy.search,
        this.searchScores,
        previousPoint,
        this.nccScratch,
        true,
      );
      if (searchCandidate && template === this.reference!.template && found) {
        // Keep the frozen trusted window in the rival comparison. Moving the
        // proposal must not hide a competing copy of the selected appearance.
        const rival = searchNcc(
          frame,
          template,
          this.point!,
          policy.search,
          this.searchScores,
          undefined,
          this.nccScratch,
        );
        if (
          rival &&
          Math.hypot(rival.point.x - found.point.x, rival.point.y - found.point.y) > policy.peakExclusionRadius
        )
          found = { ...found, separation: Math.min(found.separation, found.correlation - rival.correlation) };
      }
      const quality: IndexImageObservation["quality"] = {
        correlation: found?.correlation ?? null,
        separation: found?.separation ?? null,
        texture: null,
        forwardBackwardErrorPixels: null,
      };
      const failed = (reason: string): MatchEvaluation => ({ accepted: null, reason, quality });
      if (!found || found.correlation < policy.minimumCorrelation) return failed("APPEARANCE_MISMATCH");
      if (found.separation < policy.minimumSeparation) return failed("APPEARANCE_AMBIGUOUS");
      if (Math.hypot(found.point.x - previousPoint.x, found.point.y - previousPoint.y) > policy.maximumMotionStep)
        return failed("IMAGE_MOTION_TOO_LARGE");
      const current = patch(frame, found.point, template.radius);
      quality.texture = current?.deviation ?? null;
      if (!current || current.deviation < policy.minimumTexture || current.structure < policy.minimumStructure)
        return failed("IMAGE_TEXTURE_UNSUITABLE");
      const reverse = searchNcc(
        history,
        current,
        origin,
        policy.reverseSearch,
        this.reverseScores,
        undefined,
        this.nccScratch,
      );
      const backward = reverse ? Math.hypot(reverse.point.x - origin.x, reverse.point.y - origin.y) : Infinity;
      quality.forwardBackwardErrorPixels = Number.isFinite(backward) ? backward * scale : null;
      if (!reverse || reverse.correlation < policy.minimumCorrelation || backward > policy.maximumForwardBackward)
        return failed("FORWARD_BACKWARD_DISAGREEMENT");
      return { accepted: { found, current, backward }, reason: null, quality };
    };
    return {
      stable: evaluate(this.reference.template, this.reference.frame, this.reference.point),
      // The adaptive template still belongs to its last trusted frame. A
      // search proposal is never its reverse-correspondence origin.
      adaptive: evaluate(this.template, this.previous, this.point),
    };
  }
  private appearanceSupportsIndex(frame: IndexGrayFrame, index: ModelGeometry["index"], source: string): boolean {
    const reference = this.fingerReference;
    if (!reference || reference.source !== source) return false;
    const supported: { index: number; prior: Point; current: Point }[] = [];
    for (const anchor of reference.anchors) {
      const joint = index[anchor.index];
      const expected = { x: Math.round(joint.x * (frame.width - 1)), y: Math.round(joint.y * (frame.height - 1)) };
      const forward = searchNcc(
        frame,
        anchor.template,
        expected,
        policy.modelAgreementRadius,
        this.searchScores,
        undefined,
        this.nccScratch,
      );
      if (
        !forward ||
        forward.correlation < policy.minimumCorrelation ||
        forward.separation < policy.minimumSeparation ||
        Math.hypot(forward.point.x - expected.x, forward.point.y - expected.y) > policy.modelAgreementRadius
      )
        continue;
      // Roundtrip the same matched material. NN registration uncertainty is
      // bounded separately by the existing model agreement radius above.
      const current = patch(frame, forward.point, policy.fingerIdentityRadius);
      if (!current || current.deviation < policy.minimumTexture || current.structure < policy.minimumStructure)
        continue;
      const reverse = searchNcc(
        reference.frame,
        current,
        anchor.point,
        policy.reverseSearch,
        this.reverseScores,
        undefined,
        this.nccScratch,
      );
      if (
        reverse &&
        reverse.correlation >= policy.minimumCorrelation &&
        reverse.separation >= policy.minimumSeparation &&
        Math.hypot(reverse.point.x - anchor.point.x, reverse.point.y - anchor.point.y) <= policy.maximumForwardBackward
      )
        supported.push({ index: anchor.index, prior: anchor.point, current: forward.point });
    }
    return supported.some(
      (distal) =>
        distal.index === policy.requiredDistalIdentityRegion &&
        supported.some(
          (other) =>
            other.index !== distal.index &&
            Math.hypot(other.prior.x - distal.prior.x, other.prior.y - distal.prior.y) >=
              policy.fingerIdentityRadius * 2 + 1 &&
            Math.hypot(other.current.x - distal.current.x, other.current.y - distal.current.y) >=
              policy.fingerIdentityRadius * 2 + 1,
        ),
    );
  }
  private associateModelSource(
    model: IndexModelAnchor | null | undefined,
    frame: IndexGrayFrame,
    matches: PreparedImage["matches"],
  ): IndexModelAnchor | null | undefined {
    if (this.manualSelection || !model?.identitySource || !this.sourceCanonical) return model;
    const source = model.identitySource;
    const canonical = this.sourceCanonical;
    // A proven exact current adapter generation carries association and
    // negative intent across posture uncertainty. Coordinate permission remains
    // independently governed by the current index/optical gates below.
    const knownCurrent =
      source === this.trustedModelSource &&
      this.handIdentity?.source === canonical &&
      frame.capture - this.handIdentity.seenAt <= policy.maximumRecoveryMs;
    const quarantine = (): IndexModelAnchor => ({
      ...model,
      point: null,
      pointing: false,
      contrary: false,
      authority: "AMBIGUOUS",
      geometry: undefined,
      indexCue: undefined,
      indexIdentityEvidence: undefined,
      indexIdentityGeometry: undefined,
      handRegion: undefined,
      otherDigitEvidence: undefined,
      identityObserved: false,
    });
    if (
      source !== canonical &&
      (!sameIndexSourceContext(source, canonical) ||
        (!knownCurrent && !this.sourceAssociation.canonicalSource && source !== this.trustedModelSource))
    )
      return quarantine();
    const valid = validModelGeometry(model, this.binding.frameWidth / this.binding.frameHeight);
    const geometry = valid ? model.geometry : null;
    const coherent =
      !!geometry &&
      !!this.sourceAnatomy &&
      indexShapeContinues(
        this.sourceAnatomy.index,
        geometry.index,
        this.binding.frameHeight / this.binding.frameWidth,
        policy.indexCueMaximumShapeChange,
        policy.modelMaximumAxisTurnDegrees,
        { previous: this.sourceAnatomy.palmSpan, current: geometry.palmSpan },
      );
    const optical = matches?.stable.accepted ?? matches?.adaptive.accepted;
    const consensus =
      !(matches?.stable.accepted && matches.adaptive.accepted) ||
      Math.hypot(
        matches.stable.accepted.found.point.x - matches.adaptive.accepted.found.point.x,
        matches.stable.accepted.found.point.y - matches.adaptive.accepted.found.point.y,
      ) <= policy.maximumReferenceDisagreement;
    const tipAgreement =
      !!model.point &&
      !!optical &&
      consensus &&
      Math.hypot(
        optical.found.point.x - model.point.x * (frame.width - 1),
        optical.found.point.y - model.point.y * (frame.height - 1),
      ) <= policy.modelAgreementRadius;
    const newSource = source !== this.sourceAssociation.trustedSource;
    const decision = this.sourceAssociation.observe({
      source,
      capture: frame.capture,
      fullPoint:
        valid && model.authority === "POINT" && model.pointing && !model.contrary && model.authoritySource === source,
      identityObserved: model.identityObserved === true,
      anatomyCompatible: coherent,
      appearanceVerified:
        !!geometry &&
        newSource &&
        coherent &&
        tipAgreement &&
        this.appearanceSupportsIndex(frame, geometry.index, canonical),
      tipAgreement,
      ambiguous: model.authority === "AMBIGUOUS",
    });
    if (decision.state === "PROMOTED") this.trustedModelSource = source;
    const selectedTrack = this.temporal.checkpoint();
    // Model-source expiry must not trap an independently maintained image
    // association. This is only the previously verified actual source returning
    // to current selected material, never permission for a different model ID.
    // Full point/geometry probation below still owns coordinate admission.
    const exactSourceReturn =
      source === this.trustedModelSource &&
      selectedTrack.logical?.established === true &&
      selectedTrack.logical.raw === this.trackId &&
      selectedTrack.source === canonical &&
      frame.capture - selectedTrack.identityAt <= policy.modelMaximumGapMs &&
      frame.capture - this.associationAt <= policy.modelMaximumGapMs &&
      !this.automaticEntryPending &&
      !this.coordinateConflict &&
      valid &&
      coherent &&
      tipAgreement &&
      model.authority === "POINT" &&
      model.pointing &&
      !model.contrary &&
      model.identityObserved === true &&
      model.authoritySource === source;
    const originalTrusted = knownCurrent || exactSourceReturn;
    const knownAliasNegative =
      decision.state !== "EXPIRED" &&
      source === this.sourceAssociation.trustedSource &&
      model.identityObserved === true &&
      model.authoritySource === source &&
      model.authority === "CONTRARY";
    if (
      !originalTrusted &&
      !knownAliasNegative &&
      ((decision.state !== "VERIFIED" && decision.state !== "PROMOTED") ||
        source !== this.sourceAssociation.trustedSource)
    )
      return quarantine();
    if (source === canonical) return model;
    const normalize = <T extends { source: string }>(value: T | undefined): T | undefined =>
      value?.source === source ? { ...value, source: canonical } : value;
    return {
      ...model,
      identitySource: canonical,
      authoritySource: model.authoritySource === source ? canonical : model.authoritySource,
      indexIdentityEvidence: normalize(model.indexIdentityEvidence),
      indexIdentityGeometry: normalize(model.indexIdentityGeometry),
      handRegion: normalize(model.handRegion),
      indexCue: normalize(model.indexCue),
      otherDigitEvidence: normalize(model.otherDigitEvidence),
    };
  }
  private finishUpdate(
    frame: IndexGrayFrame,
    model?: IndexModelAnchor | null,
    manualHint?: Point | null,
    preparedMatches?: PreparedImage["matches"],
    entryTrustedModel = false,
  ): IndexImageObservation {
    const rawOptical = preparedMatches?.stable.accepted ?? preparedMatches?.adaptive.accepted;
    // A missing/bad tip cannot discard a whole-hand negative or ambiguity.
    if (model?.point && !boundedPoint(model.point)) model = { ...model, point: null };
    const modelPoint = model?.point
      ? { x: model.point.x * (frame.width - 1), y: model.point.y * (frame.height - 1) }
      : null;
    const indexCue = !this.manualSelection
      ? cueMetrics(model, this.binding.frameWidth / this.binding.frameHeight)
      : null;
    const region = model?.handRegion;
    const currentHandRegion =
      !this.manualSelection &&
      region &&
      region.source === model?.identitySource &&
      region.source === this.handIdentity?.source &&
      frame.capture - this.handIdentity.seenAt <= policy.maximumRecoveryMs &&
      (region.points.length >= fullHandDetectionPolicy.imageSupport.minimumObservedJoints ||
        (region.structuredSupport === true &&
          region.points.length >= fullHandDetectionPolicy.imageSupport.minimumStructuredObservedJoints)) &&
      region.points.every(boundedPoint) &&
      Number.isFinite(region.palmSpan) &&
      region.palmSpan >= fullHandDetectionPolicy.palm.minimumSpan &&
      region.palmSpan <= fullHandDetectionPolicy.palm.maximumSpan;
    // A current known hand can disprove background pixels after fingertip
    // permission was revoked. Negative extent supplies no index registration,
    // wider averaging radius, gesture promotion or coordinate permission.
    const currentRegion =
      currentHandRegion &&
      region.source === this.indexIdentity?.source &&
      frame.capture - this.indexIdentity.lastAt <= policy.modelMaximumGapMs;
    const agreementRadius = currentRegion ? policy.supportedDifferenceAverageRadius : policy.modelAgreementRadius;
    if (currentHandRegion && preparedMatches) {
      const points = region.points.map((p) => ({ x: p.x * (frame.width - 1), y: p.y * (frame.height - 1) }));
      const margin = Math.max(
        fullHandDetectionPolicy.imageSupport.minimumMarginAnalysisPixels,
        region.palmSpan * (frame.width - 1) * fullHandDetectionPolicy.imageSupport.palmMarginRatio,
      );
      const supported = (match: MatchEvaluation): MatchEvaluation =>
        match.accepted && distanceOutsideHull(match.accepted.found.point, points) > margin
          ? { ...match, accepted: null, reason: "IMAGE_OUTSIDE_OBSERVED_HAND" }
          : match;
      preparedMatches = { stable: supported(preparedMatches.stable), adaptive: supported(preparedMatches.adaptive) };
    }
    const shaftGeometry = validModelGeometry(model, this.binding.frameWidth / this.binding.frameHeight)
      ? { source: model.authoritySource, index: model.geometry.index }
      : indexCue?.cue;
    const shaftRegistered =
      !this.manualSelection &&
      shaftGeometry &&
      this.handIdentity?.source === shaftGeometry.source &&
      this.handIdentity.coordinateSupport &&
      this.indexIdentity?.source === shaftGeometry.source &&
      frame.capture - this.indexIdentity.lastAt <= policy.modelMaximumGapMs &&
      model?.identitySource === shaftGeometry.source &&
      model.indexIdentityEvidence?.associationBasis === "INDEX_CHAIN_V1" &&
      model.indexIdentityEvidence.source === shaftGeometry.source &&
      model.indexIdentityEvidence.joints.length === 4 &&
      new Set(model.indexIdentityEvidence.joints.map((point) => point.index)).size === 4 &&
      model.indexIdentityEvidence.joints.every((point) => {
        const current = shaftGeometry.index[point.index - 5];
        return (
          [5, 6, 7, 8].includes(point.index) &&
          boundedPoint(point) &&
          current &&
          Math.hypot(point.x - current.x, point.y - current.y) <= 1e-6
        );
      }) &&
      indexShapeContinues(
        this.indexIdentity.index,
        shaftGeometry.index,
        this.binding.frameHeight / this.binding.frameWidth,
        policy.modelMaximumShapeChange,
        policy.modelMaximumAxisTurnDegrees,
      );
    let indexShaftObserved = false;
    let indexTipRayCompatible: (point: Point) => boolean = () => false;
    if (shaftRegistered && preparedMatches && modelPoint) {
      const points = shaftGeometry.index.map((p) => ({ x: p.x * (frame.width - 1), y: p.y * (frame.height - 1) }));
      const digitEvidence =
        model?.otherDigitEvidence?.source === shaftGeometry.source ? model.otherDigitEvidence : null;
      const rivals = digitEvidence
        ? digitEvidence.points
            .filter(boundedPoint)
            .map((p) => ({ x: p.x * (frame.width - 1), y: p.y * (frame.height - 1) }))
        : region?.source === shaftGeometry.source
          ? (region.otherFingerPoints
              ?.filter(boundedPoint)
              .map((p) => ({ x: p.x * (frame.width - 1), y: p.y * (frame.height - 1) })) ?? [])
          : [];
      const rivalSegments = digitEvidence
        ? digitEvidence.segments
            .filter((segment) => segment.every(boundedPoint))
            .map((segment) => segment.map((p) => ({ x: p.x * (frame.width - 1), y: p.y * (frame.height - 1) })))
        : region?.source === shaftGeometry.source
          ? (region.otherFingerSegments
              ?.filter((segment) => segment.every(boundedPoint))
              .map((segment) => segment.map((p) => ({ x: p.x * (frame.width - 1), y: p.y * (frame.height - 1) }))) ??
            [])
          : [];
      const projectedLength =
        Math.hypot(points[2].x - points[1].x, points[2].y - points[1].y) +
        Math.hypot(points[3].x - points[2].x, points[3].y - points[2].y);
      const rivalCloser = (point: Point, distance: number) =>
        rivals.some(
          (rival) => Math.hypot(point.x - rival.x, point.y - rival.y) <= distance + policy.indexShaftRivalMargin,
        ) ||
        rivalSegments.some(
          (segment) => distanceToSegment(point, segment[0], segment[1]) <= distance + policy.indexShaftRivalMargin,
        );
      indexTipRayCompatible = (point) => {
        const dx = points[3].x - points[2].x,
          dy = points[3].y - points[2].y,
          length = Math.hypot(dx, dy);
        if (length < policy.distalRayMinimumLength) return false;
        const x = point.x - points[3].x,
          y = point.y - points[3].y;
        const along = (x * dx + y * dy) / (length * length),
          normal = Math.abs(x * dy - y * dx) / length;
        // Retain an already verified optical endpoint when monocular anatomy
        // underestimates it along the same distal axis. This is never a cold
        // anchor, a new identity, or a model-only reproof.
        return (
          along >= 0 &&
          along <= policy.distalRayMaximumBones &&
          normal <= policy.modelAgreementRadius &&
          !rivalCloser(point, normal)
        );
      };
      const shaftSupport = (match: MatchEvaluation) => {
        if (!match.accepted || projectedLength <= agreementRadius) return { eligible: false, distance: Infinity };
        const point = match.accepted.found.point,
          tipError = Math.hypot(point.x - modelPoint.x, point.y - modelPoint.y);
        const distance = Math.min(
          distanceToSegment(point, points[1], points[2]),
          distanceToSegment(point, points[2], points[3]),
        );
        if (
          tipError <= agreementRadius ||
          rivals.some(
            (rival) => Math.hypot(point.x - rival.x, point.y - rival.y) <= distance + policy.indexShaftRivalMargin,
          ) ||
          rivalSegments.some(
            (segment) => distanceToSegment(point, segment[0], segment[1]) <= distance + policy.indexShaftRivalMargin,
          )
        )
          return { eligible: false, distance };
        return { eligible: true, distance };
      };
      const stableSupport = shaftSupport(preparedMatches.stable),
        adaptiveSupport = shaftSupport(preparedMatches.adaptive);
      const shaftRadius = currentRegion
        ? Math.min(
            policy.maximumIndexShaftRadius,
            Math.max(policy.indexShaftRadius, region.palmSpan * (frame.width - 1) * policy.indexShaftPalmRadiusRatio),
          )
        : policy.indexShaftRadius;
      const stableShaft = stableSupport.eligible && stableSupport.distance <= shaftRadius;
      const adaptiveShaft = adaptiveSupport.eligible && adaptiveSupport.distance <= shaftRadius;
      const sameFeature =
        preparedMatches.stable.accepted &&
        preparedMatches.adaptive.accepted &&
        Math.hypot(
          preparedMatches.stable.accepted.found.point.x - preparedMatches.adaptive.accepted.found.point.x,
          preparedMatches.stable.accepted.found.point.y - preparedMatches.adaptive.accepted.found.point.y,
        ) <= policy.maximumReferenceDisagreement;
      const endpointOnly = (match: MatchEvaluation, identityOnly: boolean): MatchEvaluation => {
        if (!identityOnly) return match;
        indexShaftObserved = true;
        // The image still supports the registered finger, but not its current
        // endpoint. Never publish or average shaft coordinates as the tip.
        return { ...match, accepted: null, reason: "INDEX_SHAFT_MATCH_NOT_TIP" };
      };
      preparedMatches = {
        stable: endpointOnly(
          preparedMatches.stable,
          stableShaft || !!(sameFeature && adaptiveShaft && stableSupport.eligible),
        ),
        adaptive: endpointOnly(
          preparedMatches.adaptive,
          adaptiveShaft || !!(sameFeature && stableShaft && adaptiveSupport.eligible),
        ),
      };
    }
    const tipCompatible = (point: Point) =>
      !!modelPoint &&
      (Math.hypot(point.x - modelPoint.x, point.y - modelPoint.y) <= agreementRadius || indexTipRayCompatible(point));
    const acceptedOptical = preparedMatches?.stable.accepted ?? preparedMatches?.adaptive.accepted;
    const fullOpticalConflict =
      (model?.authority === "POINT" || model?.authority === "CONTRARY" || indexCue !== null) &&
      modelPoint &&
      acceptedOptical &&
      !tipCompatible(acceptedOptical.found.point);
    if (fullOpticalConflict) {
      const registeredContradiction =
        (!this.manualSelection &&
          indexCue !== null &&
          indexCue.cue.source === this.handIdentity?.source &&
          indexCue.cue.source === this.indexIdentity?.source &&
          frame.capture - this.indexIdentity.lastAt <= policy.modelMaximumGapMs) ||
        (validModelGeometry(model, this.binding.frameWidth / this.binding.frameHeight) &&
          model.identitySource === model.authoritySource &&
          model.identityObserved === true &&
          (this.handIdentity?.source === model.authoritySource ||
            (this.manualSelection &&
              this.authorityCandidate?.source === model.authoritySource &&
              this.authorityCandidate.confirmed)));
      if (registeredContradiction || this.coordinateConflict) {
        this.coordinateConflict ??= {
          source: this.handIdentity?.source ?? model?.authoritySource ?? indexCue?.cue.source ?? null,
          at: frame.capture,
          imageProofAt: null,
        };
        this.coordinateConflict = { ...this.coordinateConflict, imageProofAt: null };
      }
      // A position contradiction revokes coordinate permission, not current
      // evidence that the same already-selected hand remains in view.
      if (this.handIdentity) this.handIdentity = { ...this.handIdentity, coordinateSupport: false };
      this.indexIdentity = null;
      this.modelIdentity = null;
      this.modelContinuity = null;
      this.modelCohorts = [];
      this.modelOpticalCandidate = null;
      this.modelCoordinate = null;
      this.cueAssociation = null;
      this.cueContinuity = null;
      this.cueCohorts = [];
    }
    if (model?.authority === "CONTRARY" || model?.authority === "AMBIGUOUS") {
      this.cueAssociation = null;
      this.cueContinuity = null;
      this.cueCohorts = [];
    }
    if (
      this.modelIdentity &&
      (frame.capture - this.modelIdentity.seenAt > policy.modelMaximumGapMs ||
        model?.authority === "AMBIGUOUS" ||
        (!!model?.authority && model.authoritySource !== this.modelIdentity.source))
    )
      this.modelIdentity = null;
    if (this.handIdentity && frame.capture - this.handIdentity.seenAt > policy.maximumRecoveryMs)
      this.handIdentity = null;
    if (!this.manualSelection && this.handIdentity && model?.identitySource === this.handIdentity.source)
      this.handIdentity = { ...this.handIdentity, seenAt: frame.capture };
    const currentIndexIdentity = !this.manualSelection
      ? indexIdentityMetrics(model, this.binding.frameHeight / this.binding.frameWidth)
      : null;
    const observedIndex = model?.indexIdentityEvidence;
    const currentObservedIndex =
      !this.manualSelection &&
      observedIndex?.associationBasis === "INDEX_CHAIN_V1" &&
      observedIndex.source === model?.identitySource &&
      observedIndex.joints.length >= 3 &&
      observedIndex.joints.length <= 4 &&
      new Set(observedIndex.joints.map((p) => p.index)).size === observedIndex.joints.length &&
      observedIndex.joints.every((p) => [5, 6, 7, 8].includes(p.index) && boundedPoint(p))
        ? observedIndex
        : null;
    const revokeIndexPermission = () => {
      this.indexIdentity = null;
      if (this.handIdentity) this.handIdentity = { ...this.handIdentity, coordinateSupport: false };
      this.modelIdentity = null;
      this.modelContinuity = null;
      this.modelCohorts = [];
      this.cueAssociation = null;
      this.cueContinuity = null;
      this.cueCohorts = [];
      this.modelOpticalCandidate = null;
      this.modelCoordinate = null;
    };
    if (this.indexIdentity) {
      const old = this.indexIdentity;
      if (
        frame.capture - old.lastAt > policy.modelMaximumGapMs ||
        (model?.identitySource !== undefined && model.identitySource !== old.source)
      )
        revokeIndexPermission();
      else if (
        currentObservedIndex?.source === old.source &&
        currentObservedIndex.joints.filter((joint) => {
          const prior = old.observed.find((point) => point.index === joint.index);
          return (
            prior &&
            Math.hypot((joint.x - prior.x) * (frame.width - 1), (joint.y - prior.y) * (frame.height - 1)) <=
              policy.modelMaximumStep
          );
        }).length >= 3
      ) {
        // Actual named-index observations retain selection, independent of
        // noisier inferred z/proportions. This cannot initialize or resurrect
        // a certificate and provides no current coordinate or gesture proof.
        this.indexIdentity = {
          ...old,
          lastAt: frame.capture,
          observed: currentObservedIndex.joints.map((joint) => ({ ...joint })),
          ...(currentIndexIdentity?.source === old.source
            ? {
                index: currentIndexIdentity.index.map((joint) => ({ ...joint })) as unknown as IndexCue["index"],
                chain: currentIndexIdentity.chain,
              }
            : {}),
        };
      } else if (currentIndexIdentity && currentIndexIdentity.source === old.source) {
        const ratio = currentIndexIdentity.chain / old.chain;
        const coherent =
          ratio >= policy.modelMinimumScaleRatio &&
          ratio <= policy.modelMaximumScaleRatio &&
          currentIndexIdentity.index.every(
            (joint, i) =>
              Math.hypot(
                (joint.x - old.index[i].x) * (frame.width - 1),
                (joint.y - old.index[i].y) * (frame.height - 1),
              ) <= policy.modelMaximumStep,
          ) &&
          (currentIndexIdentity.indexAssociated ||
            indexShapeContinues(
              old.referenceIndex,
              currentIndexIdentity.index,
              this.binding.frameHeight / this.binding.frameWidth,
              policy.modelMaximumShapeChange,
              policy.modelMaximumAxisTurnDegrees,
              undefined,
              old.index,
            ));
        // A noisy/missing current chain adds no evidence and cannot renew the
        // certificate. Keep its last reliable reference for at most250ms.
        if (coherent)
          this.indexIdentity = {
            ...old,
            index: currentIndexIdentity.index.map((joint) => ({ ...joint })) as unknown as IndexCue["index"],
            chain: currentIndexIdentity.chain,
            lastAt: frame.capture,
            observed: currentIndexIdentity.index.map((point, i) => ({ index: i + 5, x: point.x, y: point.y })),
          };
      }
    }
    // A negative gesture can maintain already-selected index anatomy, but a
    // continuous palm alone cannot renew permission to use later model tips.
    if (
      !this.manualSelection &&
      this.modelIdentity &&
      model?.identityObserved === true &&
      model.authority === "CONTRARY" &&
      model.authoritySource === this.modelIdentity.source &&
      this.indexIdentity?.source === this.modelIdentity.source &&
      this.indexIdentity.lastAt === frame.capture
    )
      this.modelIdentity = { ...this.modelIdentity, seenAt: frame.capture };
    const expired =
      this.anchorSource !== null &&
      frame.capture -
        Math.max(
          this.acceptedAt,
          this.associationAt,
          this.modelAcceptedAt,
          this.modelIdentity?.seenAt ?? -Infinity,
          this.handIdentity?.seenAt ?? -Infinity,
        ) >
        policy.maximumRecoveryMs;
    if (expired) {
      const manualSelection = this.manualSelection;
      this.reset(true);
      this.manualSelection = manualSelection;
    }
    const scale = this.binding.frameWidth / frame.width;
    const quality: IndexImageObservation["quality"] = {
      correlation: null,
      separation: null,
      texture: null,
      forwardBackwardErrorPixels: null,
    };
    let modelAgreement: IndexImageObservation["modelAgreement"] = "UNAVAILABLE";
    let currentMatchedPoint: Point | null = null;
    let producedPoint: Point | null = null;
    let coordinateSource: IndexImageObservation["coordinateSource"] = "IMAGE";
    let modelSupport: IndexImageObservation["modelSupport"] = null;
    const result = (
      state: IndexImageObservation["state"],
      reason: string,
      uncertainty: number | null = null,
    ): IndexImageObservation => {
      if (
        state !== "TRACKING" &&
        !this.manualSelection &&
        this.handIdentity?.source === model?.identitySource &&
        this.handIdentity?.seenAt === frame.capture &&
        (model?.authority === "AMBIGUOUS" || reason === "REANCHOR_REQUIRED" || reason === "SHOW_INDEX_OR_SELECT_TIP")
      ) {
        state = "UNCERTAIN";
        reason = "SAME_HAND_POSITION_UNCERTAIN";
      }
      if (
        state === "TRACKING" &&
        producedPoint &&
        !boundedPoint({ x: producedPoint.x / (frame.width - 1), y: producedPoint.y / (frame.height - 1) })
      ) {
        state = "UNCERTAIN";
        reason = "FUSED_POINT_OUTSIDE_IMAGE";
        producedPoint = null;
      }
      return {
        observationVersion: 1,
        ...this.binding,
        providerId: indexImageAlgorithm.providerId,
        providerVersion: indexImageAlgorithm.providerVersion,
        algorithmDigest: indexImageAlgorithm.algorithmDigest,
        orientation: 0,
        sequence: this.sequence++,
        monotonicCaptureTime: frame.capture,
        monotonicInferenceTime: frame.received,
        trackId: this.trackId,
        trackGeneration: this.trackGeneration,
        point:
          state === "TRACKING" && producedPoint
            ? { x: producedPoint.x / (frame.width - 1), y: producedPoint.y / (frame.height - 1) }
            : null,
        matchedPoint:
          state === "TRACKING" && currentMatchedPoint && producedPoint
            ? { x: producedPoint.x / (frame.width - 1), y: producedPoint.y / (frame.height - 1) }
            : state === "UNCERTAIN" && reason.startsWith("FULL_HAND_")
              ? currentMatchedPoint
              : null,
        state,
        modelAgreement,
        anchorSource: this.anchorSource,
        quality: { ...quality },
        uncertaintyRadiusPixels: uncertainty,
        reason,
        coordinateSource,
        opticalEpoch: this.opticalEpoch,
        modelSupport,
        measurements: {
          model: model?.point ? { ...model.point } : null,
          image: rawOptical
            ? {
                x: (rawOptical.found.refinedPoint?.x ?? rawOptical.found.point.x) / (frame.width - 1),
                y: (rawOptical.found.refinedPoint?.y ?? rawOptical.found.point.y) / (frame.height - 1),
              }
            : null,
          accepted:
            state === "TRACKING" && producedPoint
              ? {
                  x: producedPoint.x / (frame.width - 1),
                  y: producedPoint.y / (frame.height - 1),
                }
              : null,
          imageDisposition: !rawOptical
            ? "UNAVAILABLE"
            : indexShaftObserved
              ? "SHAFT"
              : state === "TRACKING" && coordinateSource !== "MODEL"
                ? "TIP"
                : "DISPUTED",
          modelDisposition: !model?.point ? "UNAVAILABLE" : modelSupport ? "QUALIFIED" : "CANDIDATE",
        },
      };
    };
    if (this.grid && (this.grid.width !== frame.width || this.grid.height !== frame.height)) {
      this.previous = null;
      this.template = null;
      this.reference = null;
      this.lastReferenceAt = -Infinity;
      this.referenceRefreshCandidate = null;
      this.point = null;
      this.authorityCandidate = null;
      return result("LOST", "FRAME_GRID_CHANGED");
    }
    this.grid ??= { width: frame.width, height: frame.height };
    if (manualHint) {
      const retainedAuthorityVeto = this.authorityVetoed && model?.authority !== undefined;
      this.reset();
      this.manualSelection = true;
      this.authorityVetoed = retainedAuthorityVeto;
      this.grid = { width: frame.width, height: frame.height };
    }
    const currentGeometry =
      !this.manualSelection && validModelGeometry(model, this.binding.frameWidth / this.binding.frameHeight);
    const retainGeometryCohort = (source: string, lastAt: number) => {
      if (frame.capture - lastAt > policy.modelMaximumGapMs || model?.contrary || model?.authority === "CONTRARY")
        return false;
      if (model?.identitySource && model.identitySource !== source) return false;
      if (model?.authority === "AMBIGUOUS") return model.identitySource === source;
      const reportedSource = model?.authoritySource ?? model?.indexCue?.source;
      return !reportedSource || reportedSource === source;
    };
    if (currentGeometry && modelPoint) {
      const g = model!.geometry!;
      const previousOptical = preparedMatches?.stable.accepted ?? preparedMatches?.adaptive.accepted;
      const agreesWithOptical = !!previousOptical && tipCompatible(previousOptical.found.point);
      const opticalContradiction = !!previousOptical && !agreesWithOptical;
      if (opticalContradiction) this.modelIdentity = null;
      const coherent = (old: ModelContinuity) => {
        const ratio = g.palmSpan / old.geometry.palmSpan;
        const dx = g.index[3].x - old.geometry.index[3].x,
          dy = g.index[3].y - old.geometry.index[3].y;
        return (
          !opticalContradiction &&
          !(!old.associated && agreesWithOptical) &&
          old.source === model!.authoritySource &&
          frame.capture - old.lastAt <= policy.modelMaximumGapMs &&
          Math.hypot(dx * (frame.width - 1), dy * (frame.height - 1)) <= policy.modelMaximumStep &&
          ratio >= policy.modelMinimumScaleRatio &&
          ratio <= policy.modelMaximumScaleRatio &&
          indexShapeContinues(
            old.referenceGeometry.index,
            g.index,
            this.binding.frameHeight / this.binding.frameWidth,
            policy.modelMaximumShapeChange,
            policy.modelMaximumAxisTurnDegrees,
            { previous: old.referenceGeometry.palmSpan, current: g.palmSpan },
            old.geometry.index,
          )
        );
      };
      const snapshot = {
        index: g.index.map((p) => ({ ...p })) as unknown as ModelGeometry["index"],
        palmSpan: g.palmSpan,
      };
      const cohort = advanceGeometryCohorts(
        this.modelCohorts,
        frame.capture,
        (old) => retainGeometryCohort(old.source, old.lastAt),
        coherent,
        (old) => ({
          ...old,
          geometry: snapshot,
          point: { ...modelPoint },
          lastAt: frame.capture,
          frames: old.frames + 1,
          associated: old.associated || agreesWithOptical,
        }),
        () => ({
          source: model!.authoritySource!,
          startedAt: frame.capture,
          lastAt: frame.capture,
          frames: 1,
          geometry: snapshot,
          referenceGeometry: snapshot,
          point: { ...modelPoint },
          associated:
            !this.trackId ||
            agreesWithOptical ||
            (this.handIdentity !== null &&
              this.handIdentity.source === model!.authoritySource &&
              this.handIdentity.coordinateSupport &&
              this.handIdentity.seenAt === frame.capture &&
              this.indexIdentity?.source === model!.authoritySource &&
              this.indexIdentity.lastAt === frame.capture) ||
            (model!.identityObserved === true &&
              this.modelIdentity !== null &&
              this.modelIdentity.source === model!.authoritySource &&
              frame.capture - this.modelIdentity.seenAt <= policy.modelMaximumGapMs) ||
            (this.cueAssociation?.source === model!.authoritySource &&
              this.cueAssociation !== null &&
              frame.capture - this.cueAssociation.lastAt <= policy.modelMaximumGapMs),
        }),
      );
      this.modelContinuity = cohort.current;
      this.modelCohorts = cohort.history;
    } else {
      this.modelCohorts = this.modelCohorts.filter((old) => retainGeometryCohort(old.source, old.lastAt));
      if (!this.modelContinuity || !this.modelCohorts.includes(this.modelContinuity)) this.modelContinuity = null;
    }
    const modelQualified =
      currentGeometry &&
      !!this.modelContinuity &&
      this.modelContinuity.frames >= policy.modelMinimumFrames &&
      frame.capture - this.modelContinuity.startedAt >= policy.modelMinimumSpanMs;
    const modelReady = modelQualified && !!this.modelContinuity?.associated;
    const currentSource = currentGeometry ? model!.authoritySource! : indexCue?.cue.source;
    if (
      this.cueAssociation &&
      (frame.capture - this.cueAssociation.lastAt > policy.modelMaximumGapMs ||
        (currentSource && currentSource !== this.cueAssociation.source))
    )
      this.cueAssociation = null;
    const opticalAssociation =
      !!currentSource && !!modelPoint && !!acceptedOptical && tipCompatible(acceptedOptical.found.point);
    if (
      !this.manualSelection &&
      this.trackId &&
      currentSource &&
      (opticalAssociation || this.cueAssociation?.source === currentSource)
    )
      this.cueAssociation = { source: currentSource, lastAt: frame.capture };
    if (indexCue && this.trackId && !this.manualSelection) {
      const { cue, chain } = indexCue;
      const coherent = (old: CueContinuity) => {
        const dx = cue.index[3].x - old.index[3].x,
          dy = cue.index[3].y - old.index[3].y;
        const ratio = chain / old.chain;
        return (
          old.source === cue.source &&
          frame.capture - old.lastAt <= policy.modelMaximumGapMs &&
          Math.hypot(dx * (frame.width - 1), dy * (frame.height - 1)) <= policy.modelMaximumStep &&
          ratio >= policy.modelMinimumScaleRatio &&
          ratio <= policy.modelMaximumScaleRatio &&
          indexShapeContinues(
            old.referenceIndex,
            cue.index,
            this.binding.frameHeight / this.binding.frameWidth,
            policy.indexCueMaximumShapeChange,
            policy.modelMaximumAxisTurnDegrees,
            { previous: old.referenceChain, current: chain },
            old.index,
          )
        );
      };
      const snapshot = cue.index.map((joint) => ({ ...joint })) as unknown as IndexCue["index"];
      const cohort = advanceGeometryCohorts(
        this.cueCohorts,
        frame.capture,
        (old) => retainGeometryCohort(old.source, old.lastAt),
        coherent,
        (old) => ({ ...old, index: snapshot, chain, lastAt: frame.capture, frames: old.frames + 1 }),
        () => ({
          source: cue.source,
          index: snapshot,
          referenceIndex: snapshot,
          chain,
          referenceChain: chain,
          startedAt: frame.capture,
          lastAt: frame.capture,
          frames: 1,
        }),
      );
      this.cueContinuity = cohort.current;
      this.cueCohorts = cohort.history;
    } else {
      this.cueCohorts = this.cueCohorts.filter((old) => retainGeometryCohort(old.source, old.lastAt));
      if (!this.cueContinuity || !this.cueCohorts.includes(this.cueContinuity)) this.cueContinuity = null;
    }
    const cueQualified =
      !!indexCue &&
      !!this.trackId &&
      !this.manualSelection &&
      !this.authorityVetoed &&
      !this.vetoed &&
      this.cueContinuity?.source === indexCue.cue.source &&
      this.cueContinuity.frames >= policy.modelMinimumFrames &&
      frame.capture - this.cueContinuity.startedAt >= policy.modelMinimumSpanMs;
    const cueReady =
      cueQualified &&
      this.cueAssociation?.source === indexCue!.cue.source &&
      (opticalAssociation ||
        !model?.identitySource ||
        (this.indexIdentity?.source === indexCue!.cue.source && this.indexIdentity.lastAt === frame.capture));
    const conditionedReady = modelReady || cueReady;
    const conditionedSource = modelReady ? this.modelContinuity!.source : cueReady ? this.cueContinuity!.source : null;
    if (this.coordinateConflict && opticalAssociation && currentSource === this.coordinateConflict.source)
      this.coordinateConflict = { ...this.coordinateConflict, imageProofAt: frame.capture };
    if (
      this.coordinateConflict &&
      conditionedReady &&
      this.coordinateConflict.imageProofAt !== null &&
      frame.capture - this.coordinateConflict.imageProofAt <= policy.modelMaximumGapMs &&
      conditionedSource === this.coordinateConflict.source
    )
      this.coordinateConflict = null;
    const confirmHandIdentity = () => {
      if (!this.manualSelection && conditionedSource && model?.identitySource === conditionedSource) {
        this.handIdentity = { source: conditionedSource, seenAt: frame.capture, coordinateSupport: true };
        if (
          !this.sourceAssociation.canonicalSource &&
          currentGeometry &&
          model?.authority === "POINT" &&
          !this.coordinateConflict
        ) {
          this.sourceAssociation.establish({
            source: this.trustedModelSource ?? conditionedSource,
            canonicalSource: this.sourceCanonical ?? conditionedSource,
            capture: frame.capture,
          });
          this.sourceCanonical ??= conditionedSource;
          this.trustedModelSource ??= conditionedSource;
          this.sourceAnatomy = model.geometry;
        }
        if (currentIndexIdentity?.source === conditionedSource) {
          const index = currentIndexIdentity.index.map((joint) => ({ ...joint })) as unknown as IndexCue["index"];
          this.indexIdentity = {
            source: conditionedSource,
            referenceIndex: index,
            index,
            chain: currentIndexIdentity.chain,
            lastAt: frame.capture,
            observed: index.map((point, i) => ({ index: i + 5, x: point.x, y: point.y })),
          };
        }
      }
    };
    const verifiedContrary =
      model?.authority === "CONTRARY" &&
      model.authoritySource === this.handIdentity?.source &&
      model?.identitySource === this.handIdentity?.source &&
      this.handIdentity?.seenAt === frame.capture;
    const verifiedPoint =
      !this.manualSelection &&
      !this.coordinateConflict &&
      currentGeometry &&
      model?.authoritySource === this.handIdentity?.source &&
      model?.identitySource === this.handIdentity?.source &&
      this.handIdentity?.coordinateSupport === true &&
      this.indexIdentity?.source === this.handIdentity.source &&
      this.indexIdentity.lastAt === frame.capture;
    const updateGestureVeto = () => {
      const kind = model?.authority;
      const source = model?.authoritySource;
      if (
        (kind !== "POINT" && kind !== "CONTRARY") ||
        (modelAgreement !== "AGREE" && !verifiedContrary && !verifiedPoint) ||
        !source?.trim()
      ) {
        this.authorityCandidate = null;
      } else {
        const p = indexImageAlgorithmDescriptor.wholeHandAuthority.promotion;
        const old = this.authorityCandidate;
        this.authorityCandidate =
          old && old.kind === kind && old.source === source && frame.capture - old.lastAt <= p.maximumGapMs
            ? { ...old, lastAt: frame.capture, frames: old.frames + (old.lastAt === frame.capture ? 0 : 1) }
            : { kind, source, startedAt: frame.capture, lastAt: frame.capture, frames: 1, confirmed: false };
        const candidate = this.authorityCandidate;
        candidate.confirmed =
          candidate.frames >= p.minimumFrames && frame.capture - candidate.startedAt >= p.minimumSpanMs;
        if (candidate.confirmed) {
          this.authorityVetoed = kind === "CONTRARY";
          if (kind === "POINT") this.vetoed = false;
        }
      }
      if (!kind && modelAgreement === "AGREE") {
        if (model?.contrary) this.vetoed = true;
        else if (model?.pointing && !model.indexCue) this.vetoed = false;
      }
    };
    // A clear negative from the already-selected current hand remains negative
    // even when its fingertip patch is temporarily unavailable. It supplies no
    // positive pose, image registration or coordinate evidence.
    if (verifiedContrary || verifiedPoint) updateGestureVeto();
    const gesturePauseReason = () => {
      if (indexCue && modelAgreement === "DISAGREE") return "INDEX_MODEL_IMAGE_CONFLICT";
      if (this.coordinateConflict)
        return model?.authority ? "FULL_HAND_INDEX_CONFLICT" : "INDEX_IDENTITY_RECONFIRM_REQUIRED";
      if (model?.authority === "AMBIGUOUS")
        return this.handIdentity?.source === model.identitySource && this.handIdentity?.seenAt === frame.capture
          ? "SAME_HAND_POSITION_UNCERTAIN"
          : "FULL_HAND_AMBIGUOUS";
      if (model?.authority && modelAgreement !== "AGREE") return "FULL_HAND_INDEX_CONFLICT";
      if (model?.authority === "CONTRARY")
        return this.authorityCandidate?.confirmed ? "FULL_HAND_CONTRARY_CONFIRMED" : "FULL_HAND_CONTRARY_PENDING";
      if (this.automaticEntryPending) {
        if (conditionedReady && modelAgreement === "AGREE" && !this.authorityVetoed && !this.vetoed)
          this.automaticEntryPending = false;
        else return "FULL_HAND_POINT_PENDING";
      }
      if (model?.authority === "POINT" && (this.authorityVetoed || this.vetoed)) return "FULL_HAND_POINT_PENDING";
      if (this.authorityVetoed) return "FULL_HAND_CONTRARY_AWAITING_POINT";
      return this.vetoed ? "COHERENT_MODEL_CONTRARY" : null;
    };
    const fullPointReason = () =>
      this.authorityCandidate?.confirmed ? "FULL_HAND_POINT_CONFIRMED" : "FULL_HAND_POINT_PENDING";
    const registerCurrentOptical = (source: string, modelPoint: Point, output: Point): boolean => {
      const center = { x: Math.round(modelPoint.x), y: Math.round(modelPoint.y) };
      const radius = Math.min(
        policy.radius,
        Math.floor(Math.min(center.x - 1, center.y - 1, frame.width - 2 - center.x, frame.height - 2 - center.y)),
      );
      const current = radius >= policy.minimumRadius ? patch(frame, center, radius) : null;
      let candidate = this.modelOpticalCandidate;
      if (current && current.deviation >= policy.minimumTexture && current.structure >= policy.minimumStructure) {
        const distinct = searchNcc(
          frame,
          current,
          center,
          policy.search,
          this.searchScores,
          undefined,
          this.nccScratch,
        );
        if (distinct && distinct.separation >= policy.minimumSeparation) {
          let consistent = false;
          if (
            candidate &&
            candidate.source === source &&
            frame.capture - candidate.lastAt <= policy.modelMaximumGapMs
          ) {
            const forward = searchNcc(
              frame,
              candidate.template,
              center,
              policy.modelAgreementRadius,
              this.searchScores,
              undefined,
              this.nccScratch,
            );
            // Neural registration and material roundtrip are different errors.
            // Reverse the actual forward-matched material; current remains the
            // NN-centered patch/origin to register after qualified probation.
            const material =
              forward &&
              forward.correlation >= policy.minimumCorrelation &&
              forward.separation >= policy.minimumSeparation &&
              Math.hypot(forward.point.x - center.x, forward.point.y - center.y) <= policy.modelAgreementRadius
                ? patch(frame, forward.point, candidate.template.radius)
                : null;
            const reverse =
              material && material.deviation >= policy.minimumTexture && material.structure >= policy.minimumStructure
                ? searchNcc(
                    candidate.frame,
                    material,
                    candidate.point,
                    policy.reverseSearch,
                    this.reverseScores,
                    undefined,
                    this.nccScratch,
                  )
                : null;
            consistent =
              !!reverse &&
              reverse.correlation >= policy.minimumCorrelation &&
              Math.hypot(reverse.point.x - candidate.point.x, reverse.point.y - candidate.point.y) <=
                policy.maximumForwardBackward;
          }
          candidate = consistent
            ? {
                ...candidate!,
                lastAt: frame.capture,
                frames: candidate!.frames + 1,
                template: current,
                frame,
                point: center,
              }
            : {
                source,
                startedAt: frame.capture,
                lastAt: frame.capture,
                frames: 1,
                template: current,
                frame,
                point: center,
              };
          this.modelOpticalCandidate = candidate;
          if (
            candidate.frames >= policy.modelMinimumFrames &&
            frame.capture - candidate.startedAt >= policy.modelMinimumSpanMs
          ) {
            this.point = center;
            this.template = current;
            this.previous = frame;
            this.reference = { template: current, frame, point: center };
            this.imagePhase = { x: modelPoint.x - center.x, y: modelPoint.y - center.y };
            this.anatomicalOffset = { x: output.x - modelPoint.x, y: output.y - modelPoint.y };
            this.acceptedAt = frame.capture;
            this.lastReferenceAt = frame.capture;
            this.velocity = { x: 0, y: 0 };
            this.quarantinedSearch = null;
            this.opticalEpoch++;
            this.modelOpticalCandidate = null;
            this.cueAssociation = { source, lastAt: frame.capture };
            return true;
          }
        } else this.modelOpticalCandidate = null;
      } else this.modelOpticalCandidate = null;
      return false;
    };
    const currentIndex = modelQualified ? model!.geometry!.index : cueQualified ? indexCue!.cue.index : null;
    const rememberFingerReference = (source: string) => {
      if (!currentIndex || this.manualSelection) return;
      const anchors = currentIndex.slice(0, 3).flatMap((joint, index) => {
        const point = { x: Math.round(joint.x * (frame.width - 1)), y: Math.round(joint.y * (frame.height - 1)) };
        const template = patch(frame, point, policy.fingerIdentityRadius);
        return template && template.deviation >= policy.minimumTexture && template.structure >= policy.minimumStructure
          ? [{ index, point, template }]
          : [];
      });
      if (anchors.length >= policy.minimumFingerIdentityRegions) this.fingerReference = { source, frame, anchors };
    };
    const fingerAppearanceContinues = (source: string): boolean =>
      currentIndex !== null && this.appearanceSupportsIndex(frame, currentIndex, source);
    // Reconfirm pixels BEFORE restoring coordinate permission. A current
    // contrary image, unknown/replaced hand, manual hint or absent geometry
    // cannot enter this probation. Palm continuity alone supplies no point.
    const reconfirmSource = modelQualified
      ? this.modelContinuity!.source
      : cueQualified
        ? this.cueContinuity!.source
        : null;
    const canReconfirm =
      !this.manualSelection &&
      this.trackId &&
      !conditionedReady &&
      !!reconfirmSource &&
      !!modelPoint &&
      !acceptedOptical &&
      this.handIdentity?.source === reconfirmSource &&
      this.handIdentity.seenAt === frame.capture &&
      model?.identitySource === reconfirmSource &&
      fingerAppearanceContinues(reconfirmSource);
    if (canReconfirm) {
      const output = { x: modelPoint!.x + this.anatomicalOffset.x, y: modelPoint!.y + this.anatomicalOffset.y };
      if (registerCurrentOptical(reconfirmSource!, modelPoint!, output)) {
        this.coordinateConflict = null;
        this.handIdentity = { source: reconfirmSource!, seenAt: frame.capture, coordinateSupport: true };
        if (currentIndexIdentity?.source === reconfirmSource) {
          const index = currentIndexIdentity.index.map((joint) => ({ ...joint })) as unknown as IndexCue["index"];
          this.indexIdentity = {
            source: reconfirmSource!,
            referenceIndex: index,
            index,
            chain: currentIndexIdentity.chain,
            lastAt: frame.capture,
            observed: index.map((point, i) => ({ index: i + 5, x: point.x, y: point.y })),
          };
        }
        if (modelQualified && this.modelContinuity?.source === reconfirmSource)
          this.modelContinuity = { ...this.modelContinuity, associated: true };
        this.modelCoordinate = null;
        this.wasModelOnly = false;
        return result("UNCERTAIN", "FINGERTIP_RECONFIRMED_SETTLING");
      }
    } else if (!conditionedReady) this.modelOpticalCandidate = null;
    const modelFallback = (): IndexImageObservation | null => {
      if (!conditionedReady || !conditionedSource || !modelPoint || this.manualSelection || this.coordinateConflict)
        return null;
      const acceptedOptical = preparedMatches?.stable.accepted ?? preparedMatches?.adaptive.accepted;
      if (acceptedOptical && !tipCompatible(acceptedOptical.found.point)) return null;
      // Only the independently established same-source anatomical cohort can
      // support the existing identity when appearance is absent. No old patch
      // or old model output is represented as a current measurement.
      modelAgreement = "AGREE";
      updateGestureVeto();
      if (!this.trackId) {
        this.trackGeneration = ++nextAnchor;
        this.trackId = `index-fused-${this.trackGeneration}`;
        this.anchorSource = "MODEL_INDEX";
      }
      this.modelAcceptedAt = frame.capture;
      this.quarantinedSearch = null;
      confirmHandIdentity();
      if (modelReady && model?.identityObserved === true)
        this.modelIdentity = { source: conditionedSource, seenAt: frame.capture };
      const priorCoordinate = this.modelCoordinate;
      producedPoint =
        priorCoordinate &&
        priorCoordinate.source === conditionedSource &&
        frame.capture - priorCoordinate.at <= policy.modelMaximumGapMs
          ? {
              x: priorCoordinate.output.x + modelPoint.x - priorCoordinate.point.x,
              y: priorCoordinate.output.y + modelPoint.y - priorCoordinate.point.y,
            }
          : { ...modelPoint };
      this.modelCoordinate = {
        source: conditionedSource,
        at: frame.capture,
        point: { ...modelPoint },
        output: { ...producedPoint },
      };
      coordinateSource = "MODEL";
      modelSupport = modelReady ? "FULL_HAND" : "REGISTERED_INDEX";
      this.wasModelOnly = true;
      registerCurrentOptical(conditionedSource, modelPoint, producedPoint);
      const pauseReason = gesturePauseReason();
      return result(
        pauseReason ? "UNCERTAIN" : "TRACKING",
        pauseReason ??
          (indexShaftObserved
            ? "INDEX_SHAFT_MODEL_TIP"
            : cueReady && !modelReady
              ? "INDEX_MODEL_CONTINUITY"
              : "FULL_HAND_MODEL_CONTINUITY"),
        (cueReady && !modelReady ? policy.indexCueUncertainty : 6) * scale,
      );
    };
    const anchor =
      manualHint ??
      (!this.manualSelection &&
      !this.anchorSource &&
      model?.pointing &&
      (!model.authority || model.authority === "POINT")
        ? model.point
        : null);
    if (anchor) {
      if (!boundedPoint(anchor)) return result("UNSEEDED", "HINT_OUTSIDE_IMAGE");
      const center = { x: anchor.x * (frame.width - 1), y: anchor.y * (frame.height - 1) };
      const radius = Math.min(
        policy.radius,
        Math.floor(Math.min(center.x - 1, center.y - 1, frame.width - 2 - center.x, frame.height - 2 - center.y)),
      );
      const initial = radius >= policy.minimumRadius ? patch(frame, center, radius) : null;
      quality.texture = initial?.deviation ?? null;
      if (!initial || initial.deviation < policy.minimumTexture || initial.structure < policy.minimumStructure)
        return (
          modelFallback() ?? result(this.anchorSource ? "UNCERTAIN" : "UNSEEDED", "ANCHOR_TEXTURE_OR_EDGE_UNSUITABLE")
        );
      // A seed must also be locally distinguishable, not one repeated tile.
      const distinct = searchNcc(frame, initial, center, policy.search, this.searchScores, undefined, this.nccScratch);
      quality.correlation = distinct?.correlation ?? null;
      quality.separation = distinct?.separation ?? null;
      if (!distinct || distinct.separation < policy.minimumSeparation)
        return modelFallback() ?? result(this.anchorSource ? "UNCERTAIN" : "UNSEEDED", "ANCHOR_APPEARANCE_AMBIGUOUS");
      const integerCenter = { x: Math.round(center.x), y: Math.round(center.y) };
      this.point = integerCenter;
      producedPoint = center;
      this.imagePhase = { x: center.x - integerCenter.x, y: center.y - integerCenter.y };
      this.template = initial;
      this.previous = frame;
      this.reference = { template: initial, frame: this.previous, point: integerCenter };
      this.opticalEpoch++;
      this.lastReferenceAt = frame.capture;
      this.acceptedAt = frame.capture;
      this.velocity = { x: 0, y: 0 };
      this.quarantinedSearch = null;
      this.failures = 0;
      this.trackGeneration = ++nextAnchor;
      this.trackId = `index-image-${this.trackGeneration}`;
      this.anchorSource = manualHint ? "MANUAL_HINT" : "MODEL_INDEX";
      this.automaticEntryPending = !manualHint && (!!model?.authority || !!model?.indexCue) && !conditionedReady;
      if (
        !this.manualSelection &&
        currentSource &&
        modelPoint &&
        Math.hypot(center.x - modelPoint.x, center.y - modelPoint.y) <= agreementRadius
      )
        this.cueAssociation = { source: currentSource, lastAt: frame.capture };
      this.vetoed = false;
      currentMatchedPoint = { x: center.x / (frame.width - 1), y: center.y / (frame.height - 1) };
      modelAgreement =
        modelPoint && Math.hypot(center.x - modelPoint.x, center.y - modelPoint.y) <= agreementRadius
          ? "AGREE"
          : modelPoint
            ? "DISAGREE"
            : "UNAVAILABLE";
      updateGestureVeto();
      const pauseReason = gesturePauseReason();
      return result(
        pauseReason ? "UNCERTAIN" : "TRACKING",
        pauseReason ?? (model?.authority === "POINT" ? fullPointReason() : "ANCHOR_ACQUIRED"),
        2 * scale,
      );
    }
    if (!this.point || !this.template || !this.previous || !this.reference)
      return (
        modelFallback() ??
        result(
          this.anchorSource || expired ? "LOST" : "UNSEEDED",
          this.manualSelection
            ? "MANUAL_SELECTION_REQUIRED"
            : expired
              ? "IMAGE_CONTINUITY_EXPIRED"
              : this.anchorSource
                ? "REANCHOR_REQUIRED"
                : "SHOW_INDEX_OR_SELECT_TIP",
        )
      );
    const gap = frame.capture - this.acceptedAt;
    const reject = (reason: string) => {
      if (!verifiedContrary && !verifiedPoint) this.authorityCandidate = null;
      this.referenceRefreshCandidate = null;
      ++this.failures;
      return result(this.failures >= 2 ? "LOST" : "UNCERTAIN", reason);
    };
    // Registration against a newly rounded patch on every frame can accumulate
    // tiny resampling errors. Keep a stable appearance/coordinate reference;
    // refreshing it requires tightly confirmed full-hand support below.
    const matches = preparedMatches ?? this.computeMatches(frame);
    if (!matches) return reject("IMAGE_PREPARATION_INVALID");
    const { stable, adaptive } = matches;
    const selected = stable.accepted ? stable : adaptive;
    Object.assign(quality, selected.quality);
    if (
      stable.accepted &&
      adaptive.accepted &&
      Math.hypot(
        stable.accepted.found.point.x - adaptive.accepted.found.point.x,
        stable.accepted.found.point.y - adaptive.accepted.found.point.y,
      ) > policy.maximumReferenceDisagreement
    )
      return reject("IMAGE_REFERENCE_CONFLICT");
    if (!selected.accepted) return modelFallback() ?? reject(selected.reason!);
    if (!stable.accepted && frame.capture - this.lastReferenceAt > policy.maximumAdaptiveOnlyMs)
      return modelFallback() ?? reject("IMAGE_REFERENCE_EXPIRED");
    const { found, current, backward } = selected.accepted;
    modelAgreement = modelPoint ? (tipCompatible(found.point) ? "AGREE" : "DISAGREE") : "UNAVAILABLE";
    updateGestureVeto();
    if (
      this.manualSelection &&
      this.coordinateConflict &&
      modelAgreement === "AGREE" &&
      model?.authority === "POINT" &&
      model.authoritySource === this.coordinateConflict.source &&
      this.authorityCandidate?.kind === "POINT" &&
      this.authorityCandidate.confirmed
    )
      this.coordinateConflict = null;
    const currentPause = gesturePauseReason();
    if (currentPause) {
      if (
        stable.accepted &&
        this.coordinateConflict?.source &&
        this.coordinateConflict.source === this.handIdentity?.source &&
        this.reference &&
        frame.capture - this.acceptedAt <= policy.maximumRecoveryMs &&
        frame.capture - this.handIdentity.seenAt <= policy.maximumRecoveryMs
      ) {
        this.quarantinedSearch = {
          point: { ...stable.accepted.found.point },
          at: frame.capture,
          frozenTrustedAt: this.acceptedAt,
          source: this.coordinateConflict.source,
          reference: this.reference,
          opticalEpoch: this.opticalEpoch,
        };
      }
      // Current full-quality pixels can retain an association while gesture
      // permission is paused. They do not advance position, template or motion.
      if (!fullOpticalConflict && !this.coordinateConflict && !this.automaticEntryPending)
        this.associationAt = frame.capture;
      // Candidate pixels are useful feedback, never a new trusted reference.
      // Otherwise a disputed patch can walk onto the background and become
      // actionable as soon as the hand model drops out on a later capture.
      currentMatchedPoint = {
        x: ((found.refinedPoint?.x ?? found.point.x) + this.imagePhase.x) / (frame.width - 1),
        y: ((found.refinedPoint?.y ?? found.point.y) + this.imagePhase.y) / (frame.height - 1),
      };
      return result("UNCERTAIN", currentPause);
    }
    if (stable.accepted) this.lastReferenceAt = frame.capture;
    // A changing appearance needs repeated independent full-hand support, not
    // one lucky agreement after an earlier weak model confirmation. Valid
    // stable reference matches are never refreshed, preserving loop accuracy.
    let refreshReference = false;
    const tightSupport =
      model?.authority === "POINT" &&
      model.pointing &&
      !model.contrary &&
      !!model.authoritySource?.trim() &&
      modelPoint &&
      Math.hypot(found.point.x - modelPoint.x, found.point.y - modelPoint.y) <= policy.referenceRefreshModelAgreement &&
      !this.vetoed &&
      !this.authorityVetoed;
    if (
      stable.accepted ||
      !tightSupport ||
      !indexImageAlgorithmDescriptor.templateUpdate.refreshFailures.some((reason) => reason === stable.reason)
    ) {
      this.referenceRefreshCandidate = null;
    } else {
      const source = model!.authoritySource!;
      const old = this.referenceRefreshCandidate;
      this.referenceRefreshCandidate =
        old && old.source === source && frame.capture - old.lastAt <= policy.referenceRefreshMaximumGapMs
          ? { ...old, lastAt: frame.capture, frames: old.frames + 1 }
          : { source, startedAt: frame.capture, lastAt: frame.capture, frames: 1 };
      const cohort = this.referenceRefreshCandidate;
      refreshReference =
        cohort.frames >= policy.referenceRefreshMinimumFrames &&
        frame.capture - cohort.startedAt >= policy.referenceRefreshMinimumSpanMs &&
        !!this.authorityCandidate?.confirmed;
    }
    // Optical registration retains its own integer template coordinates. The
    // refined measurement and anatomical correction never feed a rounded patch
    // back into the next image search (which would accumulate sampling drift).
    const dt = gap / 1000;
    const vx = (found.point.x - this.point.x) / dt,
      vy = (found.point.y - this.point.y) / dt;
    const speed = Math.hypot(vx, vy),
      cap = speed > policy.maximumVelocity ? policy.maximumVelocity / speed : 1;
    this.velocity = { x: vx * cap, y: vy * cap };
    this.point = found.point;
    const optical = {
      x: (found.refinedPoint?.x ?? found.point.x) + this.imagePhase.x,
      y: (found.refinedPoint?.y ?? found.point.y) + this.imagePhase.y,
    };
    const rayOnly =
      !!modelPoint &&
      Math.hypot(found.point.x - modelPoint.x, found.point.y - modelPoint.y) > agreementRadius &&
      indexTipRayCompatible(found.point);
    if (conditionedReady && modelPoint && modelAgreement === "AGREE" && !this.manualSelection) {
      const weight = rayOnly
        ? 0
        : Math.min(
            policy.modelCorrectionWeight,
            Math.max(policy.modelMinimumCorrectionWeight, (1 - found.correlation) * 2),
          );
      const innovation = {
        x: weight * (modelPoint.x - optical.x) - this.anatomicalOffset.x,
        y: weight * (modelPoint.y - optical.y) - this.anatomicalOffset.y,
      };
      const magnitude = Math.hypot(innovation.x, innovation.y);
      const gain =
        magnitude <= policy.modelCorrectionDeadband
          ? 0
          : Math.min(
              Math.max(weight, policy.modelMinimumCorrectionWeight),
              policy.modelMaximumCorrectionStep / magnitude,
            );
      this.anatomicalOffset = {
        x: this.anatomicalOffset.x + gain * innovation.x,
        y: this.anatomicalOffset.y + gain * innovation.y,
      };
      if (!rayOnly) {
        this.modelAcceptedAt = frame.capture;
        confirmHandIdentity();
        if (modelReady && model?.identityObserved === true)
          this.modelIdentity = { source: this.modelContinuity!.source, seenAt: frame.capture };
        if (
          entryTrustedModel &&
          modelReady &&
          currentGeometry &&
          this.sourceCanonical === conditionedSource &&
          !this.manualSelection &&
          !this.automaticEntryPending &&
          !this.coordinateConflict &&
          !this.authorityVetoed &&
          !this.vetoed &&
          !indexShaftObserved &&
          model?.authority === "POINT" &&
          this.authorityCandidate?.kind === "POINT" &&
          this.authorityCandidate.confirmed &&
          this.authorityCandidate.lastAt === frame.capture &&
          currentObservedIndex?.source === conditionedSource &&
          currentObservedIndex.joints.length === 4 &&
          this.indexIdentity?.source === conditionedSource &&
          this.indexIdentity.lastAt === frame.capture &&
          Math.hypot(found.point.x - modelPoint.x, found.point.y - modelPoint.y) <= policy.modelAgreementRadius &&
          fingerAppearanceContinues(conditionedSource!)
        )
          this.sourceAnatomy = {
            index: model.geometry!.index.map((joint) => ({ ...joint })) as unknown as NonNullable<
              IndexModelAnchor["geometry"]
            >["index"],
            palmSpan: model.geometry!.palmSpan,
          };
        rememberFingerReference(conditionedSource!);
        coordinateSource = "FUSED";
        modelSupport = modelReady ? "FULL_HAND" : "REGISTERED_INDEX";
      }
    }
    producedPoint = { x: optical.x + this.anatomicalOffset.x, y: optical.y + this.anatomicalOffset.y };
    if (conditionedReady && conditionedSource && modelPoint && modelAgreement === "AGREE") {
      const priorCoordinate = this.modelCoordinate;
      if (
        this.wasModelOnly &&
        priorCoordinate &&
        priorCoordinate.source === conditionedSource &&
        frame.capture - priorCoordinate.at <= policy.modelMaximumGapMs
      ) {
        producedPoint = {
          x: priorCoordinate.output.x + modelPoint.x - priorCoordinate.point.x,
          y: priorCoordinate.output.y + modelPoint.y - priorCoordinate.point.y,
        };
        this.anatomicalOffset = { x: producedPoint.x - optical.x, y: producedPoint.y - optical.y };
      }
      this.modelCoordinate = {
        source: conditionedSource,
        at: frame.capture,
        point: { ...modelPoint },
        output: { ...producedPoint },
      };
    }
    this.wasModelOnly = false;
    this.modelOpticalCandidate = null;
    currentMatchedPoint = { x: optical.x / (frame.width - 1), y: optical.y / (frame.height - 1) };
    this.template = current;
    this.previous = frame;
    this.acceptedAt = frame.capture;
    this.quarantinedSearch = null;
    this.failures = 0;
    if (refreshReference) {
      this.reference = { template: current, frame: this.previous, point: { ...found.point } };
      this.lastReferenceAt = frame.capture;
      this.referenceRefreshCandidate = null;
    }
    const uncertainty =
      Math.max(
        Math.max(1.5, (1 - found.correlation) * 10 + backward * 1.5 + (found.separation < 0.08 ? 2 : 0)) +
          Math.hypot(this.anatomicalOffset.x, this.anatomicalOffset.y),
        rayOnly && modelPoint ? Math.hypot(modelPoint.x - optical.x, modelPoint.y - optical.y) : 0,
      ) * scale;
    const pauseReason = gesturePauseReason();
    return result(
      pauseReason ? "UNCERTAIN" : "TRACKING",
      pauseReason
        ? pauseReason
        : rayOnly
          ? "IMAGE_TIP_MODEL_ENDPOINT_UNCERTAIN"
          : model?.authority === "POINT"
            ? fullPointReason()
            : modelAgreement === "DISAGREE"
              ? "MODEL_DISAGREES_IMAGE_RETAINED"
              : "IMAGE_MATCH",
      uncertainty,
    );
  }
}

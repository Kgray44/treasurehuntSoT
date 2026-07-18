import { z } from "zod";

export const VISION_PACKAGE_SCHEMA_VERSION = 1;

export const waypointTypes = [
  "AREA_ARRIVAL",
  "EXACT_LANDMARK",
  "VIEWPOINT",
  "OBJECT_INSPECTION",
  "ITEM_PICKUP",
  "SEQUENCE",
  "ADVANCED",
] as const;

export const waypointSharingScopes = ["PRIVATE", "CREW", "TALL_TALE", "COMMUNITY", "OFFICIAL"] as const;
export const verificationProfiles = ["BALANCED", "STRICT", "STORY_CRITICAL", "CUSTOM"] as const;
export const waypointLifecycleStates = [
  "DRAFT",
  "COLLECTING_REFERENCE_DATA",
  "READY_TO_BUILD",
  "BUILDING",
  "NEEDS_ADDITIONAL_DATA",
  "BUILD_FAILED",
  "READY_FOR_TESTING",
  "TESTING",
  "CALIBRATION_FAILED",
  "SHADOW_READY",
  "CAPTAIN_CONFIRMED",
  "AUTOMATIC_READY",
  "AUTOMATIC",
  "UNSAFE",
  "PUBLISHED",
  "DEPRECATED",
  "OUTDATED",
  "INCOMPATIBLE",
] as const;
export const waypointRuntimeModes = ["DEVELOPMENT_MOCK", "SHADOW", "CAPTAIN_CONFIRMED", "AUTOMATIC"] as const;
export const verificationResults = [
  "VERIFIED",
  "INSUFFICIENT_VISUAL_EVIDENCE",
  "NOT_AT_TARGET",
  "AMBIGUOUS",
  "SYSTEM_ERROR",
  "CANCELLED",
] as const;
export const verificationAttemptStates = [
  "IDLE",
  "ARMED",
  "CAPTURING",
  "CURATING_FRAMES",
  "RETRIEVING",
  "MATCHING",
  "LOCALIZING",
  "EVALUATING_SEQUENCE",
  "EVALUATING_SPECIAL_RULES",
  "VERIFIED",
  "INSUFFICIENT",
  "NOT_AT_TARGET",
  "AMBIGUOUS",
  "ERROR",
  "CANCELLED",
  "EVENT_DELIVERED",
  "RESULT_DISPLAYED",
  "CLOSED",
] as const;
export const mockVisionScenarios = [
  "verified",
  "insufficient",
  "not_at_target",
  "ambiguous",
  "system_error",
  "delayed_verified",
  "cancelled",
  "stale_stage",
  "duplicate_result_delivery",
] as const;

export const waypointTypeSchema = z.enum(waypointTypes);
export const waypointSharingScopeSchema = z.enum(waypointSharingScopes);
export const verificationProfileSchema = z.enum(verificationProfiles);
export const waypointLifecycleSchema = z.enum(waypointLifecycleStates);
export const waypointRuntimeModeSchema = z.enum(waypointRuntimeModes);
export const verificationResultSchema = z.enum(verificationResults);
export const verificationAttemptStateSchema = z.enum(verificationAttemptStates);
export const mockVisionScenarioSchema = z.enum(mockVisionScenarios);

export type WaypointType = z.infer<typeof waypointTypeSchema>;
export type WaypointSharingScope = z.infer<typeof waypointSharingScopeSchema>;
export type VerificationProfile = z.infer<typeof verificationProfileSchema>;
export type WaypointLifecycle = z.infer<typeof waypointLifecycleSchema>;
export type WaypointRuntimeMode = z.infer<typeof waypointRuntimeModeSchema>;
export type VerificationResult = z.infer<typeof verificationResultSchema>;
export type VerificationAttemptState = z.infer<typeof verificationAttemptStateSchema>;
export type MockVisionScenario = z.infer<typeof mockVisionScenarioSchema>;

const jsonObject = z.record(z.string(), z.unknown());

export const scanInteractionSchema = z
  .object({
    mode: z.enum(["HOLD", "TOGGLE"]).default("HOLD"),
    holdDurationMs: z.number().int().min(250).max(15_000).default(5_000),
    progressAnnouncementIntervalMs: z.number().int().min(250).max(5_000).default(1_000),
  })
  .strict();

export const captainFallbackPolicySchema = z
  .object({
    enabled: z.boolean().default(true),
    allowManualApprove: z.boolean().default(true),
    allowManualReject: z.boolean().default(true),
    requireReason: z.boolean().default(true),
  })
  .strict();

export const visionWaypointDraftConfigurationSchema = z
  .object({
    schemaVersion: z.literal(1),
    waypointType: waypointTypeSchema,
    verificationProfile: verificationProfileSchema,
    scanInteraction: scanInteractionSchema,
    creatorGuidancePreferences: jsonObject.default({}),
    captainFallbackPolicy: captainFallbackPolicySchema,
    acceptedPoseConfiguration: jsonObject.default({}),
    stableRegionConfiguration: jsonObject.default({}),
    hardNegativeRequirement: jsonObject.default({}),
    storyPurposeMetadata: jsonObject.default({}),
    buildPreference: z.enum(["LOCAL", "CLOUD_ASSISTED", "UNDECIDED"]).default("UNDECIDED"),
    authoring: z.unknown().optional(),
  })
  .strict();

export type VisionWaypointDraftConfiguration = z.infer<typeof visionWaypointDraftConfigurationSchema>;

export function defaultDraftConfiguration(
  waypointType: WaypointType,
  verificationProfile: VerificationProfile = "BALANCED",
): VisionWaypointDraftConfiguration {
  return {
    schemaVersion: 1,
    waypointType,
    verificationProfile,
    scanInteraction: { mode: "HOLD", holdDurationMs: 5_000, progressAnnouncementIntervalMs: 1_000 },
    creatorGuidancePreferences: {},
    captainFallbackPolicy: {
      enabled: true,
      allowManualApprove: true,
      allowManualReject: true,
      requireReason: true,
    },
    acceptedPoseConfiguration: {},
    stableRegionConfiguration: {},
    hardNegativeRequirement: {},
    storyPurposeMetadata: {},
    buildPreference: "UNDECIDED",
  };
}

export const developmentVisionPackageSchema = z
  .object({
    packageSchemaVersion: z.literal(VISION_PACKAGE_SCHEMA_VERSION),
    packageType: z.literal("development-mock"),
    waypointId: z.string().min(8).max(128),
    waypointVersionId: z.string().min(8).max(128),
    waypointVersion: z.number().int().positive(),
    mockScenario: mockVisionScenarioSchema,
    compatibility: z
      .object({
        protocol: z.literal("1.0"),
        minimumAppVersion: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export type DevelopmentVisionPackage = z.infer<typeof developmentVisionPackageSchema>;

export const storyWaypointBindingSchema = z
  .object({
    storyId: z.string().min(8).max(128),
    blockId: z.string().min(8).max(128),
    waypointVersionId: z.string().min(8).max(128),
    runtimeMode: waypointRuntimeModeSchema,
    scanInteraction: scanInteractionSchema,
    successEvent: z.string().min(1).max(160),
    retryMessageConfiguration: jsonObject,
    failureMessageConfiguration: jsonObject,
    captainFallbackPolicy: captainFallbackPolicySchema,
    offlineBehavior: z.enum(["CAPTAIN_FALLBACK", "RETRY_WHEN_ONLINE", "UNAVAILABLE"]),
  })
  .strict();

const allowedAttemptTransitions: Record<VerificationAttemptState, readonly VerificationAttemptState[]> = {
  IDLE: ["ARMED", "CANCELLED"],
  ARMED: ["CAPTURING", "CANCELLED", "ERROR"],
  CAPTURING: ["CURATING_FRAMES", "CANCELLED", "ERROR"],
  CURATING_FRAMES: ["RETRIEVING", "CANCELLED", "ERROR"],
  RETRIEVING: ["MATCHING", "INSUFFICIENT", "NOT_AT_TARGET", "AMBIGUOUS", "ERROR", "CANCELLED"],
  MATCHING: ["LOCALIZING", "INSUFFICIENT", "NOT_AT_TARGET", "AMBIGUOUS", "ERROR", "CANCELLED"],
  LOCALIZING: ["EVALUATING_SEQUENCE", "INSUFFICIENT", "NOT_AT_TARGET", "AMBIGUOUS", "ERROR", "CANCELLED"],
  EVALUATING_SEQUENCE: ["EVALUATING_SPECIAL_RULES", "INSUFFICIENT", "NOT_AT_TARGET", "AMBIGUOUS", "ERROR", "CANCELLED"],
  EVALUATING_SPECIAL_RULES: ["VERIFIED", "INSUFFICIENT", "NOT_AT_TARGET", "AMBIGUOUS", "ERROR", "CANCELLED"],
  VERIFIED: ["EVENT_DELIVERED", "RESULT_DISPLAYED", "CLOSED"],
  INSUFFICIENT: ["RESULT_DISPLAYED", "CLOSED"],
  NOT_AT_TARGET: ["RESULT_DISPLAYED", "CLOSED"],
  AMBIGUOUS: ["RESULT_DISPLAYED", "CLOSED"],
  ERROR: ["RESULT_DISPLAYED", "CLOSED"],
  CANCELLED: ["RESULT_DISPLAYED", "CLOSED"],
  EVENT_DELIVERED: ["RESULT_DISPLAYED", "CLOSED"],
  RESULT_DISPLAYED: ["CLOSED"],
  CLOSED: [],
};

export class VisionDomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export function assertAttemptTransition(from: VerificationAttemptState, to: VerificationAttemptState) {
  if (!allowedAttemptTransitions[from].includes(to))
    throw new VisionDomainError("INVALID_ATTEMPT_TRANSITION", `Attempt cannot move from ${from} to ${to}.`);
}

export function terminalStateForResult(result: VerificationResult): VerificationAttemptState {
  if (result === "VERIFIED") return "VERIFIED";
  if (result === "INSUFFICIENT_VISUAL_EVIDENCE") return "INSUFFICIENT";
  if (result === "NOT_AT_TARGET") return "NOT_AT_TARGET";
  if (result === "AMBIGUOUS") return "AMBIGUOUS";
  if (result === "CANCELLED") return "CANCELLED";
  return "ERROR";
}

export const scenarioOutcome: Record<MockVisionScenario, { result: VerificationResult; guidanceCode: string }> = {
  verified: { result: "VERIFIED", guidanceCode: "TARGET_VERIFIED" },
  insufficient: { result: "INSUFFICIENT_VISUAL_EVIDENCE", guidanceCode: "MOVE_SLOWLY_AND_TRY_AGAIN" },
  not_at_target: { result: "NOT_AT_TARGET", guidanceCode: "REVIEW_STORY_DIRECTIONS" },
  ambiguous: { result: "AMBIGUOUS", guidanceCode: "CAPTURE_MORE_CONTEXT" },
  system_error: { result: "SYSTEM_ERROR", guidanceCode: "VISION_SYSTEM_UNAVAILABLE" },
  delayed_verified: { result: "VERIFIED", guidanceCode: "TARGET_VERIFIED" },
  cancelled: { result: "CANCELLED", guidanceCode: "ATTEMPT_CANCELLED" },
  stale_stage: { result: "SYSTEM_ERROR", guidanceCode: "STORY_STAGE_CHANGED" },
  duplicate_result_delivery: { result: "VERIFIED", guidanceCode: "TARGET_VERIFIED" },
};

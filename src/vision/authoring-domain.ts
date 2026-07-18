import { z } from "zod";
import { verificationProfileSchema, waypointTypeSchema } from "@/vision/domain";

export const AUTHORING_SCHEMA_VERSION = 1;
export const BUILD_INPUT_SCHEMA_VERSION = 1;
export const wizardModes = ["GUIDED", "DETAILED", "ENGINEERING"] as const;
export const recordingRoles = [
  "UNASSIGNED",
  "TARGET_REFERENCE",
  "ACCEPTED_AREA",
  "BOUNDARY",
  "HARD_NEGATIVE_NEARBY",
  "HARD_NEGATIVE_DISTANT",
  "INVALID_POSE",
  "VALIDATION",
  "LOCKED_TEST",
] as const;

export const wizardModeSchema = z.enum(wizardModes);
export const recordingRoleSchema = z.enum(recordingRoles);
const text = (maximum = 4_000) => z.string().trim().max(maximum);
const stepNumber = z.number().int().min(1).max(12);

export const purposeStepSchema = z
  .object({
    summary: text().min(10),
    successDefinition: text().min(10),
    waypointType: waypointTypeSchema,
    verificationProfile: verificationProfileSchema,
    buildPreference: z.enum(["LOCAL", "CLOUD_ASSISTED", "UNDECIDED"]),
  })
  .strict();
export const storyIntentStepSchema = z
  .object({ playerTask: text().min(5), narrativeImportance: text().min(5), failureConsequence: text() })
  .strict();
export const companionStepSchema = z
  .object({
    privacyAcknowledged: z.boolean(),
    selectedPath: z.enum(["DESKTOP", "BROWSER_PAIRED", "NONE"]),
    lastConnectionState: text(120),
  })
  .strict();
export const recordTargetStepSchema = z
  .object({
    guidanceNotes: text(),
    coveragePlan: z.enum(["QUICK", "BALANCED", "THOROUGH"]),
    representativeAssetId: z.string().nullable(),
  })
  .strict();
export const acceptedAreaStepSchema = z
  .object({ instructions: text().min(5), provisionalAccuracyAcknowledged: z.boolean() })
  .strict();
export const boundariesStepSchema = z
  .object({ instructions: text().min(5), reasons: z.array(text(240).min(2)).min(1).max(20) })
  .strict();
export const wrongPlacesStepSchema = z
  .object({ confusionNotes: text().min(5), storyCriticalRequirementAcknowledged: z.boolean() })
  .strict();
export const visualRegionsStepSchema = z
  .object({ targetDescription: text().min(3), ignoreDescription: text() })
  .strict();
export const dataHealthStepSchema = z
  .object({
    reviewedAt: z.iso.datetime().nullable(),
    acknowledgedWarningCodes: z.array(z.string().min(1).max(100)).max(100),
  })
  .strict();
export const buildPreparationStepSchema = z
  .object({ executionTarget: z.enum(["LOCAL", "CLOUD_ASSISTED"]), rawMediaConsent: z.boolean() })
  .strict();
export const testPlanStepSchema = z.object({ notes: text(), acceptanceNotes: text() }).strict();
export const reviewStepSchema = z
  .object({ confirmCaptureConsent: z.boolean(), confirmNoModelYet: z.boolean(), confirmLockedTests: z.boolean() })
  .strict();

export const authoringStateSchema = z
  .object({
    schemaVersion: z.literal(AUTHORING_SCHEMA_VERSION),
    completedSteps: z.array(stepNumber).max(12),
    steps: z
      .object({
        purpose: purposeStepSchema.optional(),
        storyIntent: storyIntentStepSchema.optional(),
        companion: companionStepSchema.optional(),
        recordTarget: recordTargetStepSchema.optional(),
        acceptedArea: acceptedAreaStepSchema.optional(),
        boundaries: boundariesStepSchema.optional(),
        wrongPlaces: wrongPlacesStepSchema.optional(),
        visualRegions: visualRegionsStepSchema.optional(),
        dataHealth: dataHealthStepSchema.optional(),
        buildPreparation: buildPreparationStepSchema.optional(),
        testPlan: testPlanStepSchema.optional(),
        review: reviewStepSchema.optional(),
      })
      .strict(),
  })
  .strict();
export type AuthoringState = z.infer<typeof authoringStateSchema>;

export function defaultAuthoringState(): AuthoringState {
  return { schemaVersion: AUTHORING_SCHEMA_VERSION, completedSteps: [], steps: {} };
}

const saveVariants = [
  z
    .object({
      operation: z.literal("SAVE_STEP"),
      expectedRevision: z.number().int().positive(),
      step: z.literal(1),
      complete: z.boolean(),
      data: purposeStepSchema,
    })
    .strict(),
  z
    .object({
      operation: z.literal("SAVE_STEP"),
      expectedRevision: z.number().int().positive(),
      step: z.literal(2),
      complete: z.boolean(),
      data: storyIntentStepSchema,
    })
    .strict(),
  z
    .object({
      operation: z.literal("SAVE_STEP"),
      expectedRevision: z.number().int().positive(),
      step: z.literal(3),
      complete: z.boolean(),
      data: companionStepSchema,
    })
    .strict(),
  z
    .object({
      operation: z.literal("SAVE_STEP"),
      expectedRevision: z.number().int().positive(),
      step: z.literal(4),
      complete: z.boolean(),
      data: recordTargetStepSchema,
    })
    .strict(),
  z
    .object({
      operation: z.literal("SAVE_STEP"),
      expectedRevision: z.number().int().positive(),
      step: z.literal(5),
      complete: z.boolean(),
      data: acceptedAreaStepSchema,
    })
    .strict(),
  z
    .object({
      operation: z.literal("SAVE_STEP"),
      expectedRevision: z.number().int().positive(),
      step: z.literal(6),
      complete: z.boolean(),
      data: boundariesStepSchema,
    })
    .strict(),
  z
    .object({
      operation: z.literal("SAVE_STEP"),
      expectedRevision: z.number().int().positive(),
      step: z.literal(7),
      complete: z.boolean(),
      data: wrongPlacesStepSchema,
    })
    .strict(),
  z
    .object({
      operation: z.literal("SAVE_STEP"),
      expectedRevision: z.number().int().positive(),
      step: z.literal(8),
      complete: z.boolean(),
      data: visualRegionsStepSchema,
    })
    .strict(),
  z
    .object({
      operation: z.literal("SAVE_STEP"),
      expectedRevision: z.number().int().positive(),
      step: z.literal(9),
      complete: z.boolean(),
      data: dataHealthStepSchema,
    })
    .strict(),
  z
    .object({
      operation: z.literal("SAVE_STEP"),
      expectedRevision: z.number().int().positive(),
      step: z.literal(10),
      complete: z.boolean(),
      data: buildPreparationStepSchema,
    })
    .strict(),
  z
    .object({
      operation: z.literal("SAVE_STEP"),
      expectedRevision: z.number().int().positive(),
      step: z.literal(11),
      complete: z.boolean(),
      data: testPlanStepSchema,
    })
    .strict(),
  z
    .object({
      operation: z.literal("SAVE_STEP"),
      expectedRevision: z.number().int().positive(),
      step: z.literal(12),
      complete: z.boolean(),
      data: reviewStepSchema,
    })
    .strict(),
] as const;

const pointSchema = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).strict();
export const visualGeometrySchema = z.discriminatedUnion("tool", [
  z
    .object({
      tool: z.literal("RECTANGLE"),
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
      width: z.number().positive().max(1),
      height: z.number().positive().max(1),
    })
    .strict(),
  z.object({ tool: z.literal("POLYGON"), points: z.array(pointSchema).min(3).max(200) }).strict(),
  z
    .object({
      tool: z.literal("BRUSH"),
      strokes: z.array(z.array(pointSchema).min(1).max(500)).min(1).max(100),
      radius: z.number().positive().max(0.5),
    })
    .strict(),
]);
export const poseParametersSchema = z
  .object({
    centerX: z.number().min(-10_000).max(10_000),
    centerZ: z.number().min(-10_000).max(10_000),
    radius: z.number().positive().max(10_000),
    facingDegrees: z.number().min(0).max(360).nullable(),
    toleranceDegrees: z.number().min(0).max(180).nullable(),
  })
  .strict();

const expectedRevision = z.number().int().positive();
export const authoringMutationSchema = z.union([
  ...saveVariants,
  z
    .object({
      operation: z.literal("SET_NAVIGATION"),
      expectedRevision,
      mode: wizardModeSchema,
      currentStep: stepNumber,
    })
    .strict(),
  z
    .object({
      operation: z.literal("UPSERT_POSE_REGION"),
      expectedRevision,
      id: z.string().optional(),
      classification: z.enum(["ACCEPTED", "BOUNDARY", "EXCLUDED"]),
      parameters: poseParametersSchema,
      orientationRules: text(),
      visibilityRules: text(),
    })
    .strict(),
  z.object({ operation: z.literal("DELETE_POSE_REGION"), expectedRevision, id: z.string().min(8) }).strict(),
  z
    .object({
      operation: z.literal("UPSERT_VISUAL_REGION"),
      expectedRevision,
      id: z.string().optional(),
      recordingAssetId: z.string().min(8),
      regionType: z.enum(["TARGET", "STABLE", "IGNORE", "TRANSIENT"]),
      semanticLabel: text(160).min(1),
      geometry: visualGeometrySchema,
    })
    .strict(),
  z.object({ operation: z.literal("DELETE_VISUAL_REGION"), expectedRevision, id: z.string().min(8) }).strict(),
  z
    .object({
      operation: z.literal("UPSERT_HARD_NEGATIVE"),
      expectedRevision,
      id: z.string().optional(),
      name: text(160).min(2),
      classification: z.enum(["NEARBY", "DISTANT", "INVALID_POSE"]),
      reason: text().min(5),
      assetIds: z.array(z.string().min(8)).min(1).max(50),
    })
    .strict(),
  z.object({ operation: z.literal("DELETE_HARD_NEGATIVE"), expectedRevision, id: z.string().min(8) }).strict(),
  z
    .object({
      operation: z.literal("UPDATE_ASSET"),
      expectedRevision,
      artifactId: z.string().min(8),
      label: text(120).min(1),
      notes: text(),
      role: recordingRoleSchema,
      isUsable: z.boolean(),
      segmentStartMs: z.number().int().nonnegative().nullable(),
      segmentEndMs: z.number().int().positive().nullable(),
    })
    .strict(),
  z
    .object({
      operation: z.literal("SPLIT_ASSET"),
      expectedRevision,
      artifactId: z.string().min(8),
      splitAtMs: z.number().int().positive(),
    })
    .strict(),
  z
    .object({
      operation: z.literal("UPSERT_TEST"),
      expectedRevision,
      id: z.string().optional(),
      name: text(160).min(2),
      testType: z.enum(["POSITIVE", "NEGATIVE", "BOUNDARY", "ENVIRONMENT"]),
      expectedResult: z.enum(["MATCH", "NO_MATCH", "INSUFFICIENT"]),
      instructions: text().min(5),
      assetIds: z.array(z.string().min(8)).min(1).max(50),
      environment: text(),
    })
    .strict(),
  z.object({ operation: z.literal("LOCK_TEST"), expectedRevision, id: z.string().min(8) }).strict(),
  z.object({ operation: z.literal("DELETE_TEST"), expectedRevision, id: z.string().min(8) }).strict(),
]);
export type AuthoringMutation = z.infer<typeof authoringMutationSchema>;

const stepKeys = [
  "purpose",
  "storyIntent",
  "companion",
  "recordTarget",
  "acceptedArea",
  "boundaries",
  "wrongPlaces",
  "visualRegions",
  "dataHealth",
  "buildPreparation",
  "testPlan",
  "review",
] as const;
export function applyStep(state: AuthoringState, step: number, data: unknown, complete: boolean): AuthoringState {
  const key = stepKeys[step - 1];
  if (!key) throw new Error("Unknown authoring step.");
  return authoringStateSchema.parse({
    ...state,
    completedSteps: complete
      ? [...new Set([...state.completedSteps, step])].sort((a, b) => a - b)
      : state.completedSteps.filter((value) => value !== step),
    steps: { ...state.steps, [key]: data },
  });
}

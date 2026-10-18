import { z } from "zod";

/** Client-safe scheduling/availability policy. Recognition and accuracy gates are not configurable. */
export const reachRuntimePolicySchema = z
  .strictObject({
    featureEnabled: z.boolean(),
    normalMaximumHz: z.number().int().min(5).max(30),
    modelMaximumHz: z.number().int().min(5).max(60),
    calibrationMaximumHz: z.number().int().min(5).max(60),
    unfocusedMaximumHz: z.number().int().min(1).max(8),
    telemetryEnabled: z.boolean(),
    telemetryRetentionDays: z.number().int().min(7).max(90),
    localRecorderEnabled: z.boolean(),
  })
  .superRefine((policy, context) => {
    if (policy.calibrationMaximumHz < policy.normalMaximumHz)
      context.addIssue({
        code: "custom",
        path: ["calibrationMaximumHz"],
        message: "Calibration cannot be below normal tracking.",
      });
    if (policy.unfocusedMaximumHz > policy.normalMaximumHz)
      context.addIssue({
        code: "custom",
        path: ["unfocusedMaximumHz"],
        message: "Unfocused tracking cannot exceed normal tracking.",
      });
  });

export type ReachRuntimePolicy = z.infer<typeof reachRuntimePolicySchema>;
export const defaultReachRuntimePolicy: Readonly<ReachRuntimePolicy> = Object.freeze({
  featureEnabled: true,
  normalMaximumHz: 15,
  modelMaximumHz: 60,
  calibrationMaximumHz: 60,
  unfocusedMaximumHz: 8,
  telemetryEnabled: true,
  telemetryRetentionDays: 30,
  localRecorderEnabled: true,
});

export const reachRuntimePolicyEnvelopeSchema = z.strictObject({
  schemaVersion: z.literal(1),
  revision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  policy: reachRuntimePolicySchema,
});
export type ReachRuntimePolicyEnvelope = z.infer<typeof reachRuntimePolicyEnvelopeSchema>;
export const defaultReachRuntimePolicyEnvelope: Readonly<ReachRuntimePolicyEnvelope> = Object.freeze({
  schemaVersion: 1,
  revision: 0,
  policy: defaultReachRuntimePolicy,
});

export const reachImmutableSafety = Object.freeze({
  maximumObservationAgeMs: 150,
  independentValidationP95MaximumDiagonalFraction: 0.03,
  minimumTargetSamples: 15,
  minimumTargetEvidenceMs: 600,
  maximumContinuousCaptureGapMs: 300,
  oneFrameInFlight: true,
  queuedFrames: 0,
  cameraPermissionRequired: true,
  automaticNumericTelemetry: true,
});

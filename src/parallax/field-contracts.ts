import { z } from "zod";
import { surfaceClassSchema, maturityLevels } from "./adaptive-contracts";
const id = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
export const fieldMetadataSchema = z.strictObject({
  schemaVersion: z.literal(1),
  provenance: z.enum(["SIMULATED", "PLAYER_REPORTED_PHYSICAL"]),
  resolved: z.boolean(),
  surface: surfaceClassSchema.nullable(),
  confidence: z.enum(["HIGH", "ACCEPTABLE", "LOW", "NONE"]),
  meaningfulSearchSeconds: z.number().int().min(0).max(600),
  hintStage: z.number().int().min(0).max(4),
  exactReveal: z.boolean(),
  trackingRecovered: z.boolean(),
  fallback: z.boolean(),
  capabilityLimitation: z.enum(["NONE", "TRACKING", "SURFACE_CONTEXT", "CAMERA", "HARDWARE"]),
  placementQuality: z.enum(["BELIEVABLE", "ADJUSTMENT_NEEDED", "UNUSABLE"]),
});
export type FieldMetadata = z.infer<typeof fieldMetadataSchema>;
export const fieldContributionSchema = z.strictObject({
  action: z.literal("CONTRIBUTE"),
  blockId: id,
  versionId: id,
  versionChecksum: z.string().regex(/^[a-f0-9]{64}$/),
  idempotencyKey: id,
  consent: z.literal(true),
  disclosureVersion: z.literal(1),
  metadata: fieldMetadataSchema,
});
export const fieldWithdrawalSchema = z.strictObject({ action: z.literal("WITHDRAW"), observationId: id });
export const calibrationReviewInputSchema = z.strictObject({
  definitionId: id,
  versionId: id,
  evidenceId: id,
  maturity: z.enum(maturityLevels).exclude(["SEMANTIC", "OBSERVED"]),
  expectedReviewId: id.nullable(),
  expectedRevision: z.number().int().min(0),
});
export const fieldConsentDisclosure = (days: number) =>
  `Optional field feedback shares surface and placement quality categories, search time and hint use with this Spatial Moment's Creator for up to ${days} days. No image, audio, location, room coordinates or scanning path is captured. Declining does not affect Chronicle completion. You can withdraw feedback; already published reviewed recipes may remain, without your original feedback.`;
export function automaticCalibrationImageEligibility(input: {
  person: "PRESENT" | "ABSENT" | "UNKNOWN";
  face: "PRESENT" | "ABSENT" | "UNKNOWN";
  consent: boolean;
}) {
  // Neither certified screening nor an approved protected calibration-media purpose is configured.
  return {
    allowed: false as const,
    reason:
      input.person !== "ABSENT" || input.face !== "ABSENT"
        ? "PERSON_OR_FACE_NOT_EXCLUDED"
        : !input.consent
          ? "CONSENT_REQUIRED"
          : "CALIBRATION_IMAGE_PIPELINE_UNAVAILABLE",
    transferBytes: 0,
  };
}
export function summarizeFieldQuality(records: FieldMetadata[]) {
  const summarize = (data: FieldMetadata[]) => {
    const sorted = data.map((r) => r.meaningfulSearchSeconds).sort((a, b) => a - b);
    const count = data.length;
    const rate = (predicate: (r: FieldMetadata) => boolean) =>
      count ? Math.round((data.filter(predicate).length / count) * 100) : 0;
    const median = count
      ? count % 2
        ? sorted[Math.floor(count / 2)]
        : (sorted[count / 2 - 1] + sorted[count / 2]) / 2
      : 0;
    return {
      encounters: count,
      resolutionSuccessPercent: rate((r) => r.resolved),
      substitutePercent: rate((r) => r.confidence === "ACCEPTABLE"),
      meanSearchSeconds: count ? Math.round(sorted.reduce((a, b) => a + b, 0) / count) : 0,
      medianSearchSeconds: median,
      hintStages: [0, 1, 2, 3, 4].map((s) => data.filter((r) => r.hintStage === s).length),
      exactRevealPercent: rate((r) => r.exactReveal),
      trackingRecoveryPercent: rate((r) => r.trackingRecovered),
      fallbackPercent: rate((r) => r.fallback),
      capabilityLimitations: Object.fromEntries(
        ["TRACKING", "SURFACE_CONTEXT", "CAMERA", "HARDWARE"].map((c) => [
          c,
          data.filter((r) => r.capabilityLimitation === c).length,
        ]),
      ),
      confidenceBands: Object.fromEntries(
        ["HIGH", "ACCEPTABLE", "LOW", "NONE"].map((c) => [c, data.filter((r) => r.confidence === c).length]),
      ),
      guidance:
        count >= 3
          ? [
              rate((r) => r.exactReveal || r.hintStage >= 3) >= 50
                ? "Most encounters need final assistance; reduce concealment or improve the hints."
                : "",
              rate((r) => !r.resolved) >= 30 ? "Surface preferences often fail; allow safer substitute surfaces." : "",
              rate((r) => r.placementQuality !== "BELIEVABLE") >= 30
                ? "Review reported placement quality before approving calibration."
                : "",
            ].filter(Boolean)
          : ["More independent encounters are needed for useful quality trends."],
    };
  };
  return {
    simulated: summarize(records.filter((r) => r.provenance === "SIMULATED")),
    physicalReports: summarize(records.filter((r) => r.provenance === "PLAYER_REPORTED_PHYSICAL")),
    physicalQualification: "NOT_ESTABLISHED" as const,
  };
}

import { z } from "zod";

const id = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
const text = z.string().trim().min(1).max(500);
const meters = z.number().finite().min(0).max(20);
export const placementPolicies = [
  "FIXED",
  "PERSONAL",
  "ADAPTIVE_STICKY",
  "ADAPTIVE_PER_CREW",
  "ADAPTIVE_PER_RUN",
  "ADAPTIVE_VARIANT",
  "CALIBRATED",
] as const;
export const surfaceClasses = ["FLOOR", "TABLE", "DESK", "SHELF", "WALL", "OPEN_SPACE", "DEVICE"] as const;
export const surfaceClassSchema = z.enum(surfaceClasses);
export const contextClasses = [
  "FURNITURE",
  "ENTRANCE",
  "WINDOW",
  "WALKWAY",
  "STAIRS",
  "OBSTACLE",
  "PRIVATE_REGION",
] as const;
export const contextClassSchema = z.enum(contextClasses);
export const semanticRecipeSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    entityId: id,
    preferredSurfaces: z.array(surfaceClassSchema).min(1).max(7),
    alternateSurfaces: z.array(surfaceClassSchema).max(7),
    forbiddenSurfaces: z.array(surfaceClassSchema).max(7),
    preferredContext: z.array(contextClassSchema).max(7),
    forbiddenContext: z.array(contextClassSchema).max(7),
    relativePlacement: z.enum(["CENTER", "EDGE", "LEFT", "RIGHT", "NEAR"]),
    orientation: z.enum(["SURFACE", "UPRIGHT", "PLAYER_FACING"]),
    minimumHeightMeters: meters,
    maximumHeightMeters: meters,
    preferredHeightMeters: meters,
    minimumClearanceMeters: meters,
    maximumReachMeters: meters,
    concealment: z.enum(["NONE", "PARTIAL"]),
    minimumVisibility: z.number().finite().min(0).max(1),
    confidenceThreshold: z.number().finite().min(0.5).max(1),
    searchRegion: z.enum(["CURRENT_ROOM", "ENTRANCE_REGION"]),
    seatedRequired: z.boolean(),
    fallback: z.enum(["GUIDED", "ACCESSIBLE_DIRECT"]),
  })
  .superRefine((r, c) => {
    if (
      r.minimumHeightMeters > r.maximumHeightMeters ||
      r.preferredHeightMeters < r.minimumHeightMeters ||
      r.preferredHeightMeters > r.maximumHeightMeters
    )
      c.addIssue({ code: "custom", message: "PARALLAX_HEIGHT_CONFLICT" });
    if ([...r.preferredSurfaces, ...r.alternateSurfaces].some((s) => r.forbiddenSurfaces.includes(s)))
      c.addIssue({ code: "custom", message: "PARALLAX_SURFACE_CONFLICT" });
  });
export type SemanticRecipe = z.infer<typeof semanticRecipeSchema>;
export const discoveryPolicySchema = z
  .strictObject({
    entityId: id,
    mandatory: z.boolean(),
    expectedSearchSeconds: z.number().int().min(1).max(300),
    maximumUnguidedSeconds: z.number().int().min(1).max(600),
    stages: z
      .array(z.strictObject({ afterSeconds: z.number().int().min(0).max(600), message: text }))
      .min(1)
      .max(4),
    exactReveal: z.literal(true),
    accessibleDirect: z.literal(true),
    trackingLoss: z.literal("GUIDED"),
    lowConfidence: z.literal("GUIDED"),
    alternateCompletion: z.enum(["PLAYER_CONFIRMATION", "CAPTAIN_CONFIRMATION"]),
  })
  .superRefine((p, c) => {
    if (
      p.expectedSearchSeconds > p.maximumUnguidedSeconds ||
      p.stages.some(
        (s, i) =>
          s.afterSeconds > p.maximumUnguidedSeconds || (i > 0 && s.afterSeconds <= p.stages[i - 1].afterSeconds),
      )
    )
      c.addIssue({ code: "custom", message: "PARALLAX_DISCOVERY_TIMER_INVALID" });
  });
export type DiscoveryPolicy = z.infer<typeof discoveryPolicySchema>;
export const maturityLevels = ["SEMANTIC", "OBSERVED", "CREATOR_REVIEWED", "CALIBRATED", "VERIFIED"] as const;
export const adaptiveContentSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    authoringApproach: z.enum(["ON_SITE", "REMOTE_SEMANTIC", "EVIDENCE_CALIBRATED"]),
    lifecycle: z.enum(["DEFINITION", "CREW", "RUN", "VARIANT"]),
    variation: z.enum(["BEST_MATCH", "VALID_ALTERNATIVES"]),
    variant: z.number().int().min(0).max(10000),
    recipes: z.array(semanticRecipeSchema).min(1).max(16),
    relationships: z
      .array(
        z.strictObject({
          entityId: id,
          otherEntityId: id,
          minimumSeparationMeters: meters,
          maximumSeparationMeters: meters,
          sameSurface: z.boolean(),
          sightlineRequired: z.boolean(),
          visibility: z.enum(["SIMULTANEOUS", "SEQUENTIAL"]),
        }),
      )
      .max(32),
    revealOrder: z.array(id).max(16),
    budget: z.strictObject({
      maximumNodes: z.number().int().min(16).max(4096),
      maximumCandidatesPerEntity: z.number().int().min(1).max(16),
      maximumVisibleEntities: z.number().int().min(1).max(24),
    }),
    discovery: z.array(discoveryPolicySchema).min(1).max(16),
    calibration: z.strictObject({
      enabled: z.boolean(),
      maturity: z.enum(maturityLevels),
      evidenceKind: z.literal("DERIVED_METADATA"),
      automaticImages: z.literal(false),
      retentionDays: z.number().int().min(1).max(30),
      reviewReceiptId: id.optional(),
    }),
  })
  .superRefine((a, c) => {
    for (const list of [a.recipes.map((r) => r.entityId), a.discovery.map((p) => p.entityId), a.revealOrder])
      if (new Set(list).size !== list.length) c.addIssue({ code: "custom", message: "PARALLAX_ADAPTIVE_DUPLICATE" });
    for (const r of a.relationships)
      if (r.entityId === r.otherEntityId || r.minimumSeparationMeters > r.maximumSeparationMeters)
        c.addIssue({ code: "custom", message: "PARALLAX_RELATIONSHIP_CONFLICT" });
    if (a.calibration.maturity !== "SEMANTIC" && !a.calibration.reviewReceiptId)
      c.addIssue({ code: "custom", message: "PARALLAX_CALIBRATION_EVIDENCE_REQUIRED" });
  });
export type AdaptiveContent = z.infer<typeof adaptiveContentSchema>;
export function defaultRecipe(entityId: string): SemanticRecipe {
  return {
    schemaVersion: 1,
    entityId,
    preferredSurfaces: ["TABLE", "DESK"],
    alternateSurfaces: ["SHELF"],
    forbiddenSurfaces: [],
    preferredContext: ["FURNITURE"],
    forbiddenContext: ["WALKWAY", "STAIRS", "OBSTACLE", "PRIVATE_REGION"],
    relativePlacement: "CENTER",
    orientation: "SURFACE",
    minimumHeightMeters: 0.4,
    maximumHeightMeters: 1.2,
    preferredHeightMeters: 0.75,
    minimumClearanceMeters: 0.15,
    maximumReachMeters: 1.5,
    concealment: "NONE",
    minimumVisibility: 0.5,
    confidenceThreshold: 0.7,
    searchRegion: "CURRENT_ROOM",
    seatedRequired: true,
    fallback: "GUIDED",
  };
}
export function defaultDiscovery(entityId: string): DiscoveryPolicy {
  return {
    entityId,
    mandatory: true,
    expectedSearchSeconds: 30,
    maximumUnguidedSeconds: 90,
    stages: [
      { afterSeconds: 15, message: "The Captain's clue rests near something familiar." },
      { afterSeconds: 30, message: "Look near a reachable surface by the furniture." },
      { afterSeconds: 60, message: "Open Show me for a clear view of the clue." },
    ],
    exactReveal: true,
    accessibleDirect: true,
    trackingLoss: "GUIDED",
    lowConfidence: "GUIDED",
    alternateCompletion: "PLAYER_CONFIRMATION",
  };
}

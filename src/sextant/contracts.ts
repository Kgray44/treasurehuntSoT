import { z } from "zod";

export const qualitySchema = z.enum(["UNKNOWN", "LOW", "MEDIUM", "HIGH"]);
export const frameSchema = z.enum([
  "DEVICE",
  "SCREEN_ADJUSTED",
  "GRAVITY_ALIGNED",
  "EARTH_MAGNETIC",
  "EARTH_TRUE",
  "LOCAL_ARBITRARY",
  "WGS84",
  "NONE",
]);
export const permissionSchema = z.enum(["NOT_REQUIRED", "PROMPT", "GRANTED", "DENIED", "RESTRICTED"]);
export type PermissionState = z.infer<typeof permissionSchema>;
export type Quality = z.infer<typeof qualitySchema>;
export type ReferenceFrame = z.infer<typeof frameSchema>;
export const stateSchema = z.strictObject({
  support: z.enum(["SUPPORTED", "UNSUPPORTED", "UNKNOWN"]),
  availability: z.enum(["AVAILABLE", "TEMPORARILY_UNAVAILABLE", "BUSY", "DEGRADED"]),
  permission: permissionSchema,
  calibration: z.enum(["NOT_APPLICABLE", "UNKNOWN", "CALIBRATING", "GOOD", "DISTURBED"]),
  quality: qualitySchema,
  freshness: z.enum(["UNKNOWN", "FRESH", "STALE"]),
  lifecycle: z.enum(["ACTIVE_ALLOWED", "FOREGROUND_ONLY", "BACKGROUND_ALLOWED", "SUSPENDED"]),
});
export type CapabilityState = z.infer<typeof stateSchema>;
export const unknownState = (): CapabilityState => ({
  support: "UNKNOWN",
  availability: "TEMPORARILY_UNAVAILABLE",
  permission: "PROMPT",
  calibration: "UNKNOWN",
  quality: "UNKNOWN",
  freshness: "UNKNOWN",
  lifecycle: "FOREGROUND_ONLY",
});
export const updateClasses = ["PASSIVE", "LOW_RATE", "INTERACTIVE", "HIGH_FIDELITY_BURST"] as const;
export type UpdateClass = (typeof updateClasses)[number];
export const updateInterval: Record<UpdateClass, number> = {
  PASSIVE: 5000,
  LOW_RATE: 1000,
  INTERACTIVE: 100,
  HIGH_FIDELITY_BURST: 16,
};
export const observationSchema = z
  .strictObject({
    observationId: z.string().min(1),
    capabilityId: z.string().min(1),
    semanticVersion: z.literal(1),
    value: z.unknown(),
    units: z.string().min(1),
    referenceFrame: frameSchema,
    timestampMonotonic: z.number().finite().nonnegative(),
    timestampWallOptional: z.string().datetime().optional(),
    ageMs: z.number().finite().nonnegative(),
    sequence: z.number().int().nonnegative(),
    discontinuity: z.boolean(),
    sourceClass: z.enum(["HARDWARE", "COMPATIBILITY", "SIMULATED"]),
    providerIdDiagnostic: z.string().min(1),
    confidence: z.number().finite().min(0).max(1).nullable(),
    uncertainty: z.number().finite().nonnegative().optional(),
    calibrationState: stateSchema.shape.calibration,
    qualityClass: qualitySchema,
    provenanceRoot: z.string().min(1),
    syntheticFlag: z.boolean(),
    simulationIdentity: z.string().min(1).optional(),
    lifecycleState: stateSchema.shape.lifecycle,
    warnings: z.array(z.string().min(1)),
  })
  .superRefine((o, ctx) => {
    if ((o.sourceClass === "SIMULATED") !== o.syntheticFlag || o.syntheticFlag !== Boolean(o.simulationIdentity))
      ctx.addIssue({ code: "custom", message: "SEXTANT_SIMULATION_IDENTITY_INVALID" });
  });
export type Observation = z.infer<typeof observationSchema>;
export type ProviderSample = { discontinuity?: boolean } & Pick<
  Observation,
  | "capabilityId"
  | "value"
  | "units"
  | "referenceFrame"
  | "timestampMonotonic"
  | "confidence"
  | "calibrationState"
  | "qualityClass"
  | "warnings"
  | "uncertainty"
>;
export type CapabilityDefinition = {
  id: string;
  version: 1;
  hardwareId: string;
  semanticId: string;
  owner: "SEXTANT";
  units: string;
  frames: ReferenceFrame[];
  permission: string;
  privacyClass: string;
  fallback: string;
  valueSchema: z.ZodType;
  implementation: "FOUNDATION_ONLY" | "WEB_AVAILABLE";
};
export type ProviderDefinition = {
  providerId: string;
  providerVersion: number;
  platformFamily: "WEB" | "IOS" | "ANDROID" | "SYNTHETIC" | "COMPATIBILITY";
  capabilities: string[];
  discoveryMethod: "EXPLICIT";
  permissionRequirements: string[];
  lifecycleConstraints: "FOREGROUND_ONLY";
  qualityMetadata: "PER_OBSERVATION";
  referenceFrames: ReferenceFrame[];
  samplingBounds: { minimumIntervalMs: number; maximumIntervalMs: number };
  powerClass: "LOW" | "VARIABLE";
  privacyClass: "LOCAL_EPHEMERAL";
  simulationSupport: boolean;
};
export interface SextantProvider {
  readonly definition: ProviderDefinition;
  readonly simulationIdentity?: string;
  discover(capabilityId: string): CapabilityState;
  start(context: {
    signal: AbortSignal;
    updateClass: UpdateClass;
    emit: (sample: ProviderSample) => void;
    fail: () => void;
  }): Promise<void>;
  setUpdateClass(updateClass: UpdateClass): void;
  stop(): Promise<void>;
}

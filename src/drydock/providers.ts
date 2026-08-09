import { z } from "zod";

export const drydockProviderIds = [
  "captainManual",
  "playerConfirmation",
  "textAnswer",
  "timer",
  "visionLocation",
  "visionObject",
  "externalWebhook",
] as const;

export type DrydockProviderId = (typeof drydockProviderIds)[number];
export type DrydockProviderState = "AVAILABLE" | "NOT_CONFIGURED";

export type DrydockProviderContract = {
  id: DrydockProviderId;
  version: 1;
  owner: string;
  state: DrydockProviderState;
  runtimeCapability: string;
  simulatorCapability: "NOT_IMPLEMENTED_PHASE_1";
  outcomes: readonly string[];
  faultModes: readonly string[];
  retryPolicy: "NONE" | "CREATOR_DECLARED" | "CAPTAIN_CONTROLLED";
  privacyClass: "PUBLIC_STATE" | "PRIVATE_EVIDENCE";
  requiresFallback: boolean;
  captainOverride: "SUPPORTED" | "REQUIRED" | "NOT_APPLICABLE";
  configurationSchema: z.ZodType<unknown>;
  evidenceSchema: z.ZodType<unknown>;
};

const emptyConfiguration = z.object({}).strict();
const noEvidence = z.object({}).strict();
const manualEvidence = z
  .object({
    outcome: z.enum(["approved", "rejected"]),
    observedAt: z.string().datetime(),
  })
  .strict();

export const drydockProviderRegistry = {
  captainManual: {
    id: "captainManual",
    version: 1,
    owner: "Project One Voyage",
    state: "AVAILABLE",
    runtimeCapability: "captain.manual-completion",
    simulatorCapability: "NOT_IMPLEMENTED_PHASE_1",
    outcomes: ["approved", "rejected"],
    faultModes: [],
    retryPolicy: "CAPTAIN_CONTROLLED",
    privacyClass: "PUBLIC_STATE",
    requiresFallback: false,
    captainOverride: "SUPPORTED",
    configurationSchema: emptyConfiguration,
    evidenceSchema: manualEvidence,
  },
  playerConfirmation: {
    id: "playerConfirmation",
    version: 1,
    owner: "Project One Voyage",
    state: "AVAILABLE",
    runtimeCapability: "player.confirmation",
    simulatorCapability: "NOT_IMPLEMENTED_PHASE_1",
    outcomes: ["confirmed"],
    faultModes: [],
    retryPolicy: "NONE",
    privacyClass: "PUBLIC_STATE",
    requiresFallback: false,
    captainOverride: "NOT_APPLICABLE",
    configurationSchema: emptyConfiguration,
    evidenceSchema: noEvidence,
  },
  textAnswer: {
    id: "textAnswer",
    version: 1,
    owner: "Project One Voyage",
    state: "AVAILABLE",
    runtimeCapability: "answer.server-validation",
    simulatorCapability: "NOT_IMPLEMENTED_PHASE_1",
    outcomes: ["match", "notMatch"],
    faultModes: [],
    retryPolicy: "CREATOR_DECLARED",
    privacyClass: "PRIVATE_EVIDENCE",
    requiresFallback: false,
    captainOverride: "SUPPORTED",
    configurationSchema: emptyConfiguration,
    evidenceSchema: z.object({ outcome: z.enum(["match", "notMatch"]), observedAt: z.string().datetime() }).strict(),
  },
  timer: {
    id: "timer",
    version: 1,
    owner: "Project One Voyage",
    state: "AVAILABLE",
    runtimeCapability: "timer.elapsed",
    simulatorCapability: "NOT_IMPLEMENTED_PHASE_1",
    outcomes: ["elapsed", "captainSkipped"],
    faultModes: [],
    retryPolicy: "NONE",
    privacyClass: "PUBLIC_STATE",
    requiresFallback: false,
    captainOverride: "SUPPORTED",
    configurationSchema: emptyConfiguration,
    evidenceSchema: noEvidence,
  },
  visionLocation: {
    id: "visionLocation",
    version: 1,
    owner: "Project Landfall",
    state: "NOT_CONFIGURED",
    runtimeCapability: "landfall.location-observation",
    simulatorCapability: "NOT_IMPLEMENTED_PHASE_1",
    outcomes: ["match", "notMatch", "uncertain"],
    faultModes: ["providerUnavailable", "permissionDenied", "uncertain"],
    retryPolicy: "CREATOR_DECLARED",
    privacyClass: "PRIVATE_EVIDENCE",
    requiresFallback: true,
    captainOverride: "REQUIRED",
    configurationSchema: z.object({ providerInstanceId: z.string().min(1).max(128) }).strict(),
    evidenceSchema: z.object({ result: z.enum(["match", "notMatch", "uncertain"]) }).strict(),
  },
  visionObject: {
    id: "visionObject",
    version: 1,
    owner: "Project Watchglass",
    state: "NOT_CONFIGURED",
    runtimeCapability: "watchglass.object-observation",
    simulatorCapability: "NOT_IMPLEMENTED_PHASE_1",
    outcomes: ["match", "notMatch", "uncertain"],
    faultModes: ["providerUnavailable", "permissionDenied", "uncertain"],
    retryPolicy: "CREATOR_DECLARED",
    privacyClass: "PRIVATE_EVIDENCE",
    requiresFallback: true,
    captainOverride: "REQUIRED",
    configurationSchema: z.object({ providerInstanceId: z.string().min(1).max(128) }).strict(),
    evidenceSchema: z.object({ result: z.enum(["match", "notMatch", "uncertain"]) }).strict(),
  },
  externalWebhook: {
    id: "externalWebhook",
    version: 1,
    owner: "External provider adapter",
    state: "NOT_CONFIGURED",
    runtimeCapability: "provider.external-observation",
    simulatorCapability: "NOT_IMPLEMENTED_PHASE_1",
    outcomes: ["match", "notMatch", "uncertain"],
    faultModes: ["providerUnavailable", "timeout", "invalidEvidence"],
    retryPolicy: "CREATOR_DECLARED",
    privacyClass: "PRIVATE_EVIDENCE",
    requiresFallback: true,
    captainOverride: "REQUIRED",
    configurationSchema: z.object({ providerInstanceId: z.string().min(1).max(128) }).strict(),
    evidenceSchema: z.object({ result: z.enum(["match", "notMatch", "uncertain"]) }).strict(),
  },
} satisfies Record<DrydockProviderId, DrydockProviderContract>;

export function serializeProviderRegistry() {
  return drydockProviderIds.map((id) => {
    const contract = drydockProviderRegistry[id];
    return {
      id: contract.id,
      version: contract.version,
      owner: contract.owner,
      state: contract.state,
      runtimeCapability: contract.runtimeCapability,
      simulatorCapability: contract.simulatorCapability,
      outcomes: contract.outcomes,
      faultModes: contract.faultModes,
      retryPolicy: contract.retryPolicy,
      privacyClass: contract.privacyClass,
      requiresFallback: contract.requiresFallback,
      captainOverride: contract.captainOverride,
    };
  });
}

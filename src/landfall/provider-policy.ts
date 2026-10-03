import { z } from "zod";

const id = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
export const providerFamilySchema = z.enum([
  "MAP_RENDERER",
  "MAP_DATA",
  "GEOCODING",
  "ROUTING",
  "ELEVATION",
  "LOCATION",
  "GEOFENCE",
  "MOTION",
  "HEADING",
  "ORIENTATION",
  "PEDESTRIAN",
  "BAROMETER",
  "UWB",
  "BLE",
  "NFC",
  "QR",
  "VISION",
  "PLAYER",
  "CAPTAIN",
  "VIRTUAL_POSITION",
  "GAME_STATE",
  "VIRTUAL_REGION",
  "VIRTUAL_EVENT",
  "CONNECTIVITY",
  "NOTIFICATION",
  "OFFLINE_PACKAGE",
]);
export type ProviderFamily = z.infer<typeof providerFamilySchema>;
export const providerHealthSchema = z.enum([
  "NOT_CONFIGURED",
  "CONFIGURED",
  "INITIALIZING",
  "READY",
  "DEGRADED",
  "RATE_LIMITED",
  "PERMISSION_REQUIRED",
  "PERMISSION_DENIED",
  "UNAVAILABLE",
  "UNSUPPORTED_DEVICE",
  "OFFLINE",
  "ERROR",
  "SUSPENDED",
]);
export type ProviderHealth = z.infer<typeof providerHealthSchema>;
export const permissionNameSchema = z.enum([
  "FOREGROUND_LOCATION",
  "PRECISE_LOCATION",
  "BACKGROUND_LOCATION",
  "NOTIFICATIONS",
  "BLUETOOTH",
  "NEARBY_DEVICES",
  "CAMERA",
  "NFC",
  "MOTION",
  "LOCAL_NETWORK",
]);
export type PermissionName = z.infer<typeof permissionNameSchema>;
export const permissionStateSchema = z.enum([
  "UNKNOWN",
  "PROMPTABLE",
  "GRANTED",
  "LIMITED",
  "APPROXIMATE",
  "DENIED",
  "DENIED_PERMANENTLY",
  "REVOKED",
  "UNAVAILABLE",
  "UNSUPPORTED",
]);
export type PermissionState = z.infer<typeof permissionStateSchema>;
export type ConnectivityState = "ONLINE" | "DEGRADED" | "CAPTIVE_OR_UNUSABLE" | "OFFLINE" | "UNKNOWN";

/** Safe catalog metadata. Credentials and arbitrary executable configuration never enter this shape. */
export const providerDescriptorSchema = z.strictObject({
  id,
  family: providerFamilySchema,
  label: z.string().min(1).max(120),
  worldspaceKinds: z
    .array(z.enum(["PHYSICAL", "VIRTUAL"]))
    .min(1)
    .max(2),
  platforms: z
    .array(z.enum(["WEB", "IOS", "ANDROID", "SERVER", "TEST"]))
    .min(1)
    .max(5),
  capabilities: z.array(id).min(1).max(24),
  permissions: z.array(permissionNameSchema).max(10),
  network: z.enum(["REQUIRED", "OPTIONAL", "NONE"]),
  hardware: z.enum(["NONE", "LOCATION", "MOTION", "BAROMETER", "BLE", "UWB", "NFC", "CAMERA"]),
  requiresCredential: z.boolean(),
  privacy: z.enum(["LOCAL", "FIRST_PARTY", "THIRD_PARTY"]),
  offline: z.boolean(),
  simulation: z.boolean(),
  attribution: z.string().max(1000),
  license: z.string().min(1).max(120),
  cacheRights: z.enum(["ALLOWED", "PROHIBITED", "REQUIRES_AGREEMENT"]),
  offlineRights: z.enum(["ALLOWED", "PROHIBITED", "REQUIRES_AGREEMENT"]),
  maxZoom: z.number().int().min(0).max(24).optional(),
});
export type ProviderDescriptor = z.infer<typeof providerDescriptorSchema>;
export type ProviderStatus = Readonly<{
  id: string;
  health: ProviderHealth;
  configured: boolean;
  credentialAvailable: boolean;
  enabled: boolean;
  lastSuccessAt?: number;
  lastFailureAt?: number;
  latencyMs?: number;
  retryAfter?: number;
  credentialExpiresAt?: number;
}>;

export const providerRequirementSchema = z.strictObject({
  worldspaceId: id,
  family: providerFamilySchema,
  capability: id,
  providerId: id.optional(),
  required: z.boolean(),
  fallback: z.enum(["PLAYER", "CAPTAIN", "AUTHORED", "NONE"]),
  offlineRequired: z.boolean(),
  hardwareDisclosed: z.boolean(),
});
export const landfallProviderPlanSchema = z.strictObject({
  version: z.literal(1),
  requirements: z.array(providerRequirementSchema).max(128),
  offline: z.strictObject({
    requested: z.boolean(),
    maxBytes: z
      .number()
      .int()
      .positive()
      .max(256 * 1024 * 1024),
    retentionHours: z.number().int().min(1).max(168),
    mapIds: z.array(id).max(64),
    routeIds: z.array(id).max(128),
    assetIds: z.array(id).max(256),
  }),
});
export type LandfallProviderPlan = z.infer<typeof landfallProviderPlanSchema>;
export type ProviderSelectionContext = {
  worldspaceKind: "PHYSICAL" | "VIRTUAL";
  platform: ProviderDescriptor["platforms"][number];
  connectivity: ConnectivityState;
  permissions: Partial<Record<PermissionName, PermissionState>>;
  hardware: readonly ProviderDescriptor["hardware"][];
  allowThirdParty: boolean;
  offlinePackageReady: boolean;
  simulation: boolean;
  now: number;
};
export type ProviderSelectionReason =
  | "SELECTED"
  | "WORLDSPACE"
  | "PLATFORM"
  | "CAPABILITY"
  | "DISABLED"
  | "SIMULATION_ONLY"
  | "NOT_CONFIGURED"
  | "CREDENTIAL"
  | "PERMISSION"
  | "HARDWARE"
  | "NETWORK"
  | "HEALTH"
  | "RATE_LIMIT"
  | "PRIVACY"
  | "OFFLINE_RIGHTS";

/** All surfaces use this policy. A health flag alone cannot grant a capability or permission. */
export function selectLandfallProviders(
  providers: readonly ProviderDescriptor[],
  statuses: readonly ProviderStatus[],
  requirement: Pick<
    z.infer<typeof providerRequirementSchema>,
    "family" | "capability" | "providerId" | "offlineRequired"
  >,
  context: ProviderSelectionContext,
) {
  if (!Number.isFinite(context.now)) throw new Error("LANDFALL_PROVIDER_CLOCK_INVALID");
  const statusById = new Map(statuses.map((status) => [status.id, status]));
  return providers
    .filter((provider) => provider.family === requirement.family)
    .map((provider) => {
      const status = statusById.get(provider.id);
      const reasons: ProviderSelectionReason[] = [];
      if (!provider.worldspaceKinds.includes(context.worldspaceKind)) reasons.push("WORLDSPACE");
      if (!provider.platforms.includes(context.platform)) reasons.push("PLATFORM");
      if (
        !provider.capabilities.includes(requirement.capability) ||
        (requirement.providerId && requirement.providerId !== provider.id)
      )
        reasons.push("CAPABILITY");
      if (!status?.enabled) reasons.push("DISABLED");
      if (provider.simulation && !context.simulation) reasons.push("SIMULATION_ONLY");
      if (!status?.configured || status.health === "NOT_CONFIGURED") reasons.push("NOT_CONFIGURED");
      if (
        provider.requiresCredential &&
        (!status?.credentialAvailable ||
          (status.credentialExpiresAt !== undefined && status.credentialExpiresAt <= context.now))
      )
        reasons.push("CREDENTIAL");
      if (
        provider.permissions.some((permission) => {
          const state = context.permissions[permission];
          return (
            state !== "GRANTED" &&
            !(permission === "FOREGROUND_LOCATION" && (state === "APPROXIMATE" || state === "LIMITED"))
          );
        })
      )
        reasons.push("PERMISSION");
      if (
        provider.family === "LOCATION" &&
        ["background", "significant-change"].includes(requirement.capability) &&
        context.permissions.BACKGROUND_LOCATION !== "GRANTED" &&
        !reasons.includes("PERMISSION")
      )
        reasons.push("PERMISSION");
      if (provider.hardware !== "NONE" && !context.hardware.includes(provider.hardware)) reasons.push("HARDWARE");
      if (provider.network === "REQUIRED" && !["ONLINE", "DEGRADED"].includes(context.connectivity))
        reasons.push("NETWORK");
      if (!status || !["READY", "DEGRADED"].includes(status.health)) reasons.push("HEALTH");
      if (status?.health === "RATE_LIMITED" || (status?.retryAfter !== undefined && status.retryAfter > context.now))
        reasons.push("RATE_LIMIT");
      if (provider.privacy === "THIRD_PARTY" && !context.allowThirdParty) reasons.push("PRIVACY");
      if (
        requirement.offlineRequired &&
        (!provider.offline ||
          provider.offlineRights !== "ALLOWED" ||
          (provider.family === "MAP_DATA" && !context.offlinePackageReady))
      )
        reasons.push("OFFLINE_RIGHTS");
      return { provider, usable: reasons.length === 0, reasons: reasons.length ? reasons : ["SELECTED" as const] };
    });
}

/** Bounded, coordinate-free operational state; no arbitrary error strings become metric labels. */
export class LandfallProviderHealthRegistry {
  private readonly descriptors = new Map<string, ProviderDescriptor>();
  private readonly statuses = new Map<string, ProviderStatus>();
  constructor(providers: readonly ProviderDescriptor[]) {
    if (providers.length > 128) throw new Error("LANDFALL_PROVIDER_LIMIT");
    for (const input of providers) {
      const descriptor = providerDescriptorSchema.parse(input);
      if (this.descriptors.has(descriptor.id)) throw new Error("LANDFALL_PROVIDER_DUPLICATE");
      this.descriptors.set(descriptor.id, descriptor);
      this.statuses.set(descriptor.id, {
        id: descriptor.id,
        health: "NOT_CONFIGURED",
        configured: false,
        credentialAvailable: false,
        enabled: true,
      });
    }
  }
  configure(
    providerId: string,
    options: { credentialAvailable: boolean; enabled: boolean; credentialExpiresAt?: number },
  ) {
    const status = this.require(providerId);
    if (options.credentialExpiresAt !== undefined && !Number.isFinite(options.credentialExpiresAt))
      throw new Error("LANDFALL_PROVIDER_TIME_INVALID");
    this.statuses.set(providerId, { ...status, ...options, configured: true, health: "CONFIGURED" });
  }
  disable(providerId: string) {
    this.statuses.set(providerId, { ...this.require(providerId), enabled: false, health: "SUSPENDED" });
  }
  record(providerId: string, health: ProviderHealth, now: number, latencyMs?: number, retryAfter?: number) {
    const status = this.require(providerId);
    providerHealthSchema.parse(health);
    if (!status.configured && health !== "NOT_CONFIGURED") throw new Error("LANDFALL_PROVIDER_NOT_CONFIGURED");
    if (!status.enabled && health !== "SUSPENDED") throw new Error("LANDFALL_PROVIDER_DISABLED");
    if (
      !Number.isFinite(now) ||
      (latencyMs !== undefined && (!Number.isFinite(latencyMs) || latencyMs < 0 || latencyMs > 300_000)) ||
      (retryAfter !== undefined && (!Number.isFinite(retryAfter) || retryAfter < now || retryAfter > now + 86_400_000))
    )
      throw new Error("LANDFALL_PROVIDER_TIME_INVALID");
    this.statuses.set(providerId, {
      ...status,
      health,
      latencyMs,
      retryAfter,
      ...(["READY", "DEGRADED"].includes(health)
        ? { lastSuccessAt: now }
        : ["ERROR", "UNAVAILABLE", "RATE_LIMITED"].includes(health)
          ? { lastFailureAt: now }
          : {}),
    });
  }
  snapshot(): ProviderStatus[] {
    return [...this.statuses.values()].map((status) => ({ ...status }));
  }
  catalog(): ProviderDescriptor[] {
    return [...this.descriptors.values()].map((descriptor) => providerDescriptorSchema.parse(descriptor));
  }
  private require(providerId: string) {
    const status = this.statuses.get(providerId);
    if (!status) throw new Error("LANDFALL_PROVIDER_UNKNOWN");
    return status;
  }
}

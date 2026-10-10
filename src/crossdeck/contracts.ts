import { z } from "zod";
import { stateSchema, type CapabilityState } from "@/sextant/contracts";

export const roles = [
  "PRIMARY_STORY",
  "CHRONICLE_LENS",
  "CHART",
  "JOURNAL",
  "ARTIFACT_VIEWER",
  "SHARED_CREW_DISPLAY",
  "AMBIENT",
  "CAPTAIN_AUXILIARY",
  "CREATOR_PREVIEW",
  "ACCESSIBILITY_COMPANION",
] as const;
export const roleSchema = z.enum(roles);
export type SurfaceRole = z.infer<typeof roleSchema>;
export const capabilitySchema = z.strictObject({
  version: z.literal(1),
  formFactor: z.enum(["DESKTOP", "PHONE", "TABLET", "UNKNOWN"]),
  viewportClass: z.enum(["COMPACT", "MEDIUM", "WIDE"]),
  reducedMotion: z.boolean(),
  // Values come from Sextant, never direct camera/sensor probing in Crossdeck.
  sextant: z.partialRecord(
    z.enum([
      "sextant.media.camera",
      "sextant.haptics.basic",
      "sextant.orientation.relative",
      "sextant.nearby.uwb.range",
    ]),
    stateSchema,
  ),
});
export type SurfaceCapabilities = z.infer<typeof capabilitySchema>;
export function projectCapabilities(
  input: Omit<SurfaceCapabilities, "version" | "sextant">,
  discover?: (id: string) => CapabilityState,
): SurfaceCapabilities {
  const sextant: SurfaceCapabilities["sextant"] = {} as SurfaceCapabilities["sextant"];
  for (const id of [
    "sextant.media.camera",
    "sextant.haptics.basic",
    "sextant.orientation.relative",
    "sextant.nearby.uwb.range",
  ] as const) {
    if (discover) sextant[id] = stateSchema.parse(discover(id));
  }
  // Partial projection is valid: absent providers remain unknown, never usable by inference.
  return capabilitySchema.parse({ ...input, version: 1, sextant });
}
export const surfaceInputSchema = z.strictObject({
  surfaceId: z.string().uuid(),
  label: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .regex(/^[^\p{C}<>]*$/u),
  capabilities: capabilitySchema,
});
export const lifecycleSchema = z.enum(["ACTIVE", "BACKGROUND", "LOCKED", "SLEEPING", "DEGRADED", "DISCONNECTED"]);
export type Lifecycle = z.infer<typeof lifecycleSchema>;
export const actionSchema = z.discriminatedUnion("action", [
  surfaceInputSchema.extend({ action: z.literal("register"), voyageId: z.string().min(1).max(191) }),
  z.strictObject({ action: z.literal("challenge"), surfaceId: z.string().uuid(), role: roleSchema }),
  surfaceInputSchema.extend({
    action: z.literal("claim"),
    code: z.string().regex(/^[A-F0-9]{12}$/),
    voyageId: z.string().min(1).max(191).optional(),
  }),
  z.strictObject({
    action: z.literal("heartbeat"),
    surfaceId: z.string().uuid(),
    lifecycle: lifecycleSchema,
    capabilities: capabilitySchema.optional(),
  }),
  z.strictObject({ action: z.literal("role"), surfaceId: z.string().uuid(), role: roleSchema }),
  z.strictObject({ action: z.literal("remove"), surfaceId: z.string().uuid() }),
]);
export type CrossdeckAction = z.infer<typeof actionSchema>;
export const HEARTBEAT_MS = 15_000;
export const STALE_MS = 45_000;
export const CHALLENGE_MS = 120_000;
export function presence(lifecycle: string, lastSeen: Date, expires: Date, revoked: Date | null, now: Date) {
  if (revoked) return "REVOKED";
  if (expires <= now) return "EXPIRED";
  if (now.getTime() - lastSeen.getTime() >= STALE_MS) return "DISCONNECTED";
  return lifecycle;
}
export class CrossdeckError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

import { z } from "zod";
import type { BrowserCameraBroker } from "./camera";
import { visualCaptureDescriptorSchema } from "./visual-capture";

export const browserVisualCapabilityPolicySchema = z.strictObject({
  version: z.literal(1),
  maximumDimension: z.number().int().min(1).max(16384),
  maximumDeclaredFrameRate: z.number().finite().positive().max(1000),
});
export type BrowserVisualCapabilityPolicy = z.infer<typeof browserVisualCapabilityPolicySchema>;
export const browserVisualCapabilityPolicy: Readonly<BrowserVisualCapabilityPolicy> = Object.freeze({
  version: 1,
  maximumDimension: 16384,
  maximumDeclaredFrameRate: 1000,
});
export type BrowserCameraCapabilitySnapshot = ReturnType<BrowserCameraBroker["snapshot"]>;
export type AuthorizedVideoTrack = {
  readonly kind: string;
  readonly readyState: string;
  getCapabilities?: () => unknown;
  getSettings?: () => unknown;
};
const contextSchema = z.strictObject({
  providerId: z.string().min(1).max(128),
  providerVersion: z.string().min(1).max(128),
  ephemeralSourceId: z.string().min(1).max(128),
  ephemeralGroupId: z.string().min(1).max(128).nullable(),
  leaseId: z.string().min(1).max(128).nullable(),
  leaseGeneration: z.number().int().nonnegative(),
});
type Context = z.infer<typeof contextSchema>;
const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
const bounded = (value: unknown, max: number, integer = false) =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value > 0 &&
  value <= max &&
  (!integer || Number.isInteger(value))
    ? value
    : null;

/** Read-only projection of an already-authorized broker lease. It never discovers, enumerates, opens, constrains or stops media. */
export function browserVisualCapabilities(
  broker: BrowserCameraCapabilitySnapshot,
  track: AuthorizedVideoTrack | null,
  context: Context,
  policy: BrowserVisualCapabilityPolicy = browserVisualCapabilityPolicy,
) {
  const c = contextSchema.parse(context);
  const p = browserVisualCapabilityPolicySchema.parse(policy);
  const currentLease =
    broker.leaseId !== null && broker.leaseId === c.leaseId && broker.generation === c.leaseGeneration;
  const authorized =
    broker.supported && broker.permission === "GRANTED" && broker.availability === "READY" && currentLease;
  const live = authorized && track?.kind === "video" && track.readyState === "live";
  let settings: Record<string, unknown> | null = null,
    capabilities: Record<string, unknown> | null = null;
  if (live) {
    try {
      settings = record(track.getSettings?.());
    } catch {
      /* Unknown negotiated settings. */
    }
    try {
      capabilities = record(track.getCapabilities?.());
    } catch {
      /* Missing query is not unsupported hardware. */
    }
  }
  let exposure: "UNKNOWN" | "UNSUPPORTED" | "SUPPORTED" = "UNKNOWN";
  const modes = capabilities?.exposureMode;
  if (Array.isArray(modes) && modes.every((v) => typeof v === "string")) {
    if (modes.some((v) => v === "manual" || v === "continuous" || v === "single-shot")) exposure = "SUPPORTED";
    else if (modes.every((v) => v === "none")) exposure = "UNSUPPORTED";
  }
  const exposureTime = record(capabilities?.exposureTime);
  if (
    exposureTime &&
    typeof exposureTime.min === "number" &&
    typeof exposureTime.max === "number" &&
    Number.isFinite(exposureTime.min) &&
    Number.isFinite(exposureTime.max) &&
    exposureTime.min >= 0 &&
    exposureTime.max >= exposureTime.min
  )
    exposure = "SUPPORTED";
  const exposureCompensation = record(capabilities?.exposureCompensation);
  if (
    exposureCompensation &&
    typeof exposureCompensation.min === "number" &&
    typeof exposureCompensation.max === "number" &&
    Number.isFinite(exposureCompensation.min) &&
    Number.isFinite(exposureCompensation.max) &&
    exposureCompensation.max >= exposureCompensation.min
  )
    exposure = "SUPPORTED";
  const permission =
    broker.permission === "GRANTED" ? "GRANTED" : broker.permission === "DENIED" ? "DENIED" : "UNKNOWN";
  const descriptor = visualCaptureDescriptorSchema.parse({
    schemaVersion: 1,
    providerId: c.providerId,
    providerVersion: c.providerVersion,
    ephemeralSourceId: c.ephemeralSourceId,
    ephemeralGroupId: c.ephemeralGroupId,
    // The browser COLOR video profile is not evidence about the camera's underlying spectral sensor hardware.
    modality: "COLOR",
    detected: live ? "PRESENT" : "UNKNOWN",
    access: !broker.supported
      ? "UNSUPPORTED"
      : broker.availability === "CAMERA_BUSY"
        ? "BUSY"
        : live
          ? "AVAILABLE"
          : broker.availability === "UNSUPPORTED"
            ? "UNSUPPORTED"
            : "UNAVAILABLE",
    permission,
    streaming: live ? "STREAMING" : broker.availability === "SUSPENDED" ? "INTERRUPTED" : "STOPPED",
    controls: { exposure, driverManagedIllumination: "UNKNOWN", directInfraredLed: "UNKNOWN" },
    controlQueryContext: "UNKNOWN",
  });
  return {
    version: 1 as const,
    descriptor,
    queryScope: "READ_ONLY_AUTHORIZED_BROWSER_TRACK" as const,
    currentAuthorizedLease: authorized,
    settingsAvailable: settings !== null,
    capabilitiesAvailable: capabilities !== null,
    negotiated: {
      width: bounded(settings?.width, p.maximumDimension, true),
      height: bounded(settings?.height, p.maximumDimension, true),
      frameRate: bounded(settings?.frameRate, p.maximumDeclaredFrameRate),
      format: { pixelFormat: "PLATFORM_HANDLE", layout: "OPAQUE" as const, bytesPerPixel: null, rowStrideBytes: null },
    },
  };
}

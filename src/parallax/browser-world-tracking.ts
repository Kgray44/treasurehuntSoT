import { z } from "zod";
import type { CameraLease } from "@/sextant/camera";
import { resolvedTransformSchema, spatialId } from "./contracts";

/** Ephemeral provider poses. They never replace an authored Scene or establish
 * a Chronicle observation's physical accuracy. +Y up, camera forward is -Z.
 */
export const browserTrackingSampleSchema = z.strictObject({
  sessionId: spatialId,
  timestampMs: z.number().finite().nonnegative(),
  method: z.enum(["VISUAL_INERTIAL_SLAM", "VISUAL_SLAM", "ORIENTATION", "MARKER", "REPLAY"]),
  status: z.enum(["INITIALIZING", "TRACKING", "LIMITED", "LOST", "SUSPENDED"]),
  confidence: z.enum(["NONE", "ROTATION_ONLY", "POSITION_NO_SCALE", "METRIC_6DOF"]),
  sessionFromCamera: resolvedTransformSchema.nullable(),
});
export type BrowserTrackingSample = z.infer<typeof browserTrackingSampleSchema>;
export type BrowserProviderAdmission = {
  available: boolean;
  /** Authorization of private distribution belongs to its server asset route.
   * This metadata cannot itself grant a license or bypass that route.
   */
  source: "PUBLIC_PLATFORM" | "AUTHORIZED_PRIVATE_EVALUATION";
  origin: string;
  expiresAt: string;
};
export interface BrowserWorldTrackingProvider {
  readonly providerId: string;
  readonly method: BrowserTrackingSample["method"];
  readonly scale: BrowserTrackingSample["confidence"];
  discover(): Promise<BrowserProviderAdmission>;
  /** Consume Sextant's exclusive stream; never open a second camera. An SDK
   * which owns capture requires its own reviewed Sextant reservation seam.
   */
  start(input: { lease: CameraLease; video: HTMLVideoElement; signal: AbortSignal }): Promise<{ sessionId: string }>;
  read(): BrowserTrackingSample | null;
  /** Column-major projection for the actual displayed camera viewport. */
  cameraProjection(width: number, height: number, near: number, far: number): ArrayLike<number> | null;
  stop(): Promise<void>;
}
export function admitsBrowserProvider(admission: BrowserProviderAdmission, origin: string, now: Date): boolean {
  try {
    const url = new URL(origin);
    return (
      admission.available === true &&
      ["PUBLIC_PLATFORM", "AUTHORIZED_PRIVATE_EVALUATION"].includes(admission.source) &&
      admission.origin === url.origin &&
      (url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) &&
      Number.isFinite(now.getTime()) &&
      Date.parse(admission.expiresAt) > now.getTime()
    );
  } catch {
    return false;
  }
}
export function hasMetricBrowserPose(
  raw: unknown,
  nowMs: number,
  sessionId: string,
  method: BrowserTrackingSample["method"],
): raw is BrowserTrackingSample {
  const parsed = browserTrackingSampleSchema.safeParse(raw);
  if (!parsed.success) return false;
  const sample = parsed.data;
  return (
    sample.sessionId === sessionId &&
    sample.method === method &&
    ["VISUAL_INERTIAL_SLAM", "VISUAL_SLAM"].includes(sample.method) &&
    sample.status === "TRACKING" &&
    sample.confidence === "METRIC_6DOF" &&
    Number.isFinite(nowMs) &&
    nowMs >= sample.timestampMs &&
    nowMs - sample.timestampMs <= 500 &&
    sample.sessionFromCamera !== null &&
    sample.sessionFromCamera.scale === 1
  );
}
/** Accepted source currently supplies no licensed live browser engine. Discovering
 * this state must not prompt, load an SDK or imply support from getUserMedia.
 */
export function browserTrackingAvailability() {
  return {
    supported: false as const,
    reason: "No admitted live browser tracking provider is configured. Guided View preserves this Scene's meaning.",
  };
}

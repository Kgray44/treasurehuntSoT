import { z } from "zod";
import type { BrowserCameraBroker, CameraLease } from "./camera";

export const browserExposurePolicySchema = z.strictObject({
  version: z.literal(1),
  maximumCompensationRangeFraction: z.number().finite().positive().max(1),
});
export type BrowserExposurePolicy = z.infer<typeof browserExposurePolicySchema>;
export const defaultBrowserExposurePolicy: Readonly<BrowserExposurePolicy> = Object.freeze({
  version: 1,
  maximumCompensationRangeFraction: 0.15,
});
type OwnedTrack = Pick<
  MediaStreamTrack,
  "kind" | "readyState" | "getCapabilities" | "getSettings" | "getConstraints" | "applyConstraints"
>;
type Adjustment = {
  field: "exposureCompensation" | "exposureMode";
  original: string | number;
  requested: string | number;
};
const object = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

/**
 * Reversible radiometric adjustment on an existing authorized COLOR lease only.
 * No new stream, resolution, zoom, emitter control, enumeration or device-name inference.
 * Availability is not a promise that exposure improves recognition.
 */
export class BrowserExposureAssistance {
  private policy: BrowserExposurePolicy;
  private pending = false;
  private generation = 0;
  private active: { restore(): Promise<void> } | null = null;
  constructor(
    private broker: Pick<BrowserCameraBroker, "snapshot">,
    private lease: CameraLease,
    private foreground: () => boolean,
    policy: BrowserExposurePolicy = defaultBrowserExposurePolicy,
  ) {
    this.policy = browserExposurePolicySchema.parse(policy);
  }
  private track(requireForeground = true): OwnedTrack | null {
    const snapshot = this.broker.snapshot();
    if (
      (requireForeground && !this.foreground()) ||
      snapshot.availability !== "READY" ||
      snapshot.permission !== "GRANTED" ||
      snapshot.leaseId !== this.lease.id ||
      snapshot.generation !== this.lease.generation
    )
      return null;
    const tracks = this.lease.stream.getVideoTracks();
    const track = tracks.length === 1 ? tracks[0] : null;
    return track?.kind === "video" &&
      track.readyState === "live" &&
      typeof track.applyConstraints === "function" &&
      typeof track.getConstraints === "function"
      ? track
      : null;
  }
  private adjustment(track: OwnedTrack): Adjustment | null {
    let capabilities: Record<string, unknown> | null, settings: Record<string, unknown> | null;
    try {
      capabilities = object(track.getCapabilities?.());
      settings = object(track.getSettings?.());
    } catch {
      return null;
    }
    const range = object(capabilities?.exposureCompensation),
      value = settings?.exposureCompensation;
    if (
      range &&
      finite(range.min) &&
      finite(range.max) &&
      range.max > range.min &&
      finite(value) &&
      value >= range.min &&
      value <= range.max
    ) {
      const maximumChange = (range.max - range.min) * this.policy.maximumCompensationRangeFraction;
      const step = finite(range.step) && range.step > 0 ? range.step : null;
      // Quantize inside the negotiated range. A fixed camera value is never assumed.
      const desired = Math.min(range.max, value + maximumChange);
      const requested =
        step === null ? desired : range.min + Math.floor((desired - range.min) / step + Number.EPSILON) * step;
      if (requested > value && requested <= range.max && requested - value <= maximumChange + Number.EPSILON)
        return { field: "exposureCompensation", original: value, requested };
    }
    const modes = capabilities?.exposureMode,
      mode = settings?.exposureMode;
    if (
      Array.isArray(modes) &&
      modes.includes("continuous") &&
      typeof mode === "string" &&
      modes.includes(mode) &&
      mode !== "continuous"
    )
      return { field: "exposureMode", original: mode, requested: "continuous" };
    return null;
  }
  available() {
    const track = this.track();
    return !!track && (this.pending || this.active !== null || this.adjustment(track) !== null);
  }
  async start(signal: AbortSignal): Promise<{ restore(): Promise<void> }> {
    const track = this.track(),
      adjustment = track ? this.adjustment(track) : null;
    if (signal.aborted || !track || !adjustment || this.pending || this.active)
      throw new Error("SEXTANT_EXPOSURE_ASSISTANCE_UNAVAILABLE");
    this.pending = true;
    const generation = ++this.generation;
    let originalConstraints: MediaTrackConstraints, originalSettings: MediaTrackSettings;
    try {
      originalConstraints = structuredClone(track.getConstraints());
      originalSettings = track.getSettings();
      if (
        !finite(originalSettings.width) ||
        !finite(originalSettings.height) ||
        originalSettings.width <= 0 ||
        originalSettings.height <= 0
      )
        throw new Error("SEXTANT_EXPOSURE_GEOMETRY_UNKNOWN");
    } catch (error) {
      this.pending = false;
      throw error;
    }
    let changed = false,
      attempted = false,
      restored = false,
      restorePromise: Promise<void> | null = null;
    const write = (value: string | number) => {
      // applyConstraints replaces the constraint set; preserve every unrelated constraint.
      const base = structuredClone(originalConstraints) as MediaTrackConstraints & Record<string, unknown>;
      delete base[adjustment.field];
      const advanced = (base.advanced ?? []).map((set) => {
        const copy = { ...set } as MediaTrackConstraintSet & Record<string, unknown>;
        delete copy[adjustment.field];
        return copy;
      });
      return track.applyConstraints({
        ...base,
        width: { exact: originalSettings.width! },
        height: { exact: originalSettings.height! },
        advanced: [...advanced, { [adjustment.field]: value } as MediaTrackConstraintSet],
      });
    };
    const restore = () => {
      if (restorePromise) return restorePromise;
      restored = true;
      restorePromise = (async () => {
        signal.removeEventListener("abort", cancelled);
        try {
          // This exact track belongs to the old lease; never apply a setting to a replacement stream.
          // Background writes are permitted only for cleanup on the still-authorized exact old lease.
          if (changed && this.track(false) === track) {
            await write(adjustment.original);
            if (this.track(false) === track) {
              await track.applyConstraints(originalConstraints);
              const settings = object(track.getSettings());
              if (
                settings?.[adjustment.field] !== adjustment.original ||
                settings.width !== originalSettings.width ||
                settings.height !== originalSettings.height
              )
                throw new Error("SEXTANT_EXPOSURE_RESTORE_NOT_CONFIRMED");
            }
          }
        } catch (cause) {
          throw new Error("SEXTANT_EXPOSURE_RESTORE_FAILED", { cause });
        } finally {
          this.active = null;
        }
      })();
      return restorePromise;
    };
    const cancelled = () => {
      void restore().catch(() => {});
    };
    try {
      // No control writes occur before the caller's current permission/foreground checks.
      if (signal.aborted || generation !== this.generation || this.track() !== track)
        throw new Error("SEXTANT_EXPOSURE_ASSISTANCE_CANCELLED");
      attempted = true;
      await write(adjustment.requested);
      changed = true;
      if (signal.aborted || generation !== this.generation || this.track() !== track) {
        await restore();
        throw new Error("SEXTANT_EXPOSURE_ASSISTANCE_CANCELLED");
      }
      let applied: Record<string, unknown> | null;
      try {
        applied = object(track.getSettings());
      } catch {
        applied = null;
      }
      if (
        applied?.[adjustment.field] !== adjustment.requested ||
        applied.width !== originalSettings.width ||
        applied.height !== originalSettings.height
      ) {
        await restore();
        throw new Error("SEXTANT_EXPOSURE_ADJUSTMENT_NOT_APPLIED");
      }
      const resource = { restore };
      this.active = resource;
      signal.addEventListener("abort", cancelled, { once: true });
      if (signal.aborted) cancelled();
      if (restored) throw new Error("SEXTANT_EXPOSURE_ASSISTANCE_CANCELLED");
      return resource;
    } catch (error) {
      // Drivers may partially apply before rejecting. Restore the authorized old track conservatively.
      if (attempted) changed = true;
      await restore();
      throw error;
    } finally {
      this.pending = false;
    }
  }
  /** Invalidates pending start immediately; an unabortable driver promise may still need late cleanup. */
  async release() {
    ++this.generation;
    await this.active?.restore();
  }
}

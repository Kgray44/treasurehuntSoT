import { z } from "zod";
import { unknownState, type CapabilityState, type PermissionState } from "./contracts";
import type { PermissionPurpose } from "./permissions";

export type MediaKind = "CAMERA" | "MICROPHONE";
export type MediaResource = { stop(): void; onEnded(listener: () => void): () => void };
export const sourceGeometrySchema = z.strictObject({
  width: z.number().int().min(1).max(16384),
  height: z.number().int().min(1).max(16384),
  facing: z.enum(["FRONT", "REAR", "EXTERNAL", "UNKNOWN"]),
  mirrored: z.boolean(),
});
type Geometry = z.infer<typeof sourceGeometrySchema>;
type Acquisition = { resource: MediaResource; geometry?: Geometry };
type Consumer = { id: string; invalidate: (reason: string) => void };
type Slot = {
  kind: MediaKind;
  shareKey?: string;
  purpose: string;
  surfaceId: string;
  expiresAt: number;
  generation: number;
  pending: boolean;
  acquisition?: Acquisition;
  detach?: () => void;
  timer?: ReturnType<typeof setTimeout>;
  consumers: Map<string, Consumer>;
};
const purposeSchema = z.strictObject({
  consumerId: z.string().trim().min(1).max(100),
  surfaceId: z.string().trim().min(1).max(100),
  purpose: z.string().trim().min(1).max(500),
  consent: z.literal(true),
  userInitiated: z.literal(true),
  retry: z.boolean().optional(),
  visible: z.literal(true),
  expiresAt: z.number().finite().nonnegative(),
  shareKey: z
    .string()
    .regex(/^[a-z0-9-]{1,80}$/)
    .optional(),
});
/** State only. Acquisition remains an explicit consumer pipeline; Sextant never reads media bytes. */
export class SextantMediaCapabilities {
  private permissions: Record<MediaKind, PermissionState> = { CAMERA: "PROMPT", MICROPHONE: "PROMPT" };
  private slots = new Map<MediaKind, Slot>();
  private generations: Record<MediaKind, number> = { CAMERA: 0, MICROPHONE: 0 };
  private foreground = true;
  private disposed = false;
  private cleanupFailures = 0;
  private failures: Partial<Record<MediaKind, "BUSY" | "PROVIDER_FAILED">> = {};
  constructor(
    private readonly support: {
      secureContext: boolean;
      camera: boolean;
      microphone: boolean;
      captureConstraints: readonly ("width" | "height" | "facingMode" | "frameRate" | "echoCancellation")[];
    },
    private readonly now: () => number = () => performance.now(),
  ) {}
  snapshot(
    kind: MediaKind,
  ): CapabilityState & { generation: number; sourceGeometry?: Geometry; captureConstraints: string[] } {
    const slot = this.slots.get(kind);
    return {
      ...unknownState(),
      support:
        this.support.secureContext && this.support[kind === "CAMERA" ? "camera" : "microphone"]
          ? "SUPPORTED"
          : "UNSUPPORTED",
      permission: this.support.secureContext ? this.permissions[kind] : "RESTRICTED",
      availability:
        slot?.pending || this.failures[kind] === "BUSY" ? "BUSY" : slot ? "AVAILABLE" : "TEMPORARILY_UNAVAILABLE",
      lifecycle: this.foreground && !this.disposed ? "FOREGROUND_ONLY" : "SUSPENDED",
      calibration: "NOT_APPLICABLE",
      generation: this.generations[kind],
      ...(slot?.acquisition?.geometry ? { sourceGeometry: { ...slot.acquisition.geometry } } : {}),
      captureConstraints: [...this.support.captureConstraints],
    };
  }
  /** A grant for one kind never grants the other. Revocation invalidates every held calibration. */
  setPermission(kind: MediaKind, permission: PermissionState) {
    this.permissions[kind] = z.enum(["PROMPT", "GRANTED", "DENIED", "RESTRICTED", "NOT_REQUIRED"]).parse(permission);
    if (permission !== "GRANTED") this.invalidate(kind, "PERMISSION_REVOKED");
  }
  async acquire(
    kind: MediaKind,
    input: PermissionPurpose & { visible: true; expiresAt: number; shareKey?: string },
    acquireConsumerResource: () => Promise<Acquisition>,
    invalidate: (reason: string) => void,
  ) {
    const purpose = purposeSchema.parse(input);
    if (
      !this.foreground ||
      this.disposed ||
      purpose.expiresAt <= this.now() ||
      purpose.expiresAt - this.now() > 60000 ||
      this.snapshot(kind).support !== "SUPPORTED" ||
      this.permissions[kind] === "RESTRICTED" ||
      (this.permissions[kind] === "DENIED" && !purpose.retry)
    )
      throw new Error("SEXTANT_MEDIA_UNAVAILABLE");
    const existing = this.slots.get(kind);
    if (existing) {
      if (
        existing.pending ||
        !purpose.shareKey ||
        existing.shareKey !== purpose.shareKey ||
        existing.purpose !== purpose.purpose ||
        existing.surfaceId !== purpose.surfaceId ||
        existing.expiresAt !== purpose.expiresAt ||
        existing.consumers.has(purpose.consumerId)
      )
        throw new Error("SEXTANT_MEDIA_BUSY");
      existing.consumers.set(purpose.consumerId, { id: purpose.consumerId, invalidate });
      return this.lease(existing, purpose.consumerId);
    }
    const slot: Slot = {
      kind,
      shareKey: purpose.shareKey,
      purpose: purpose.purpose,
      surfaceId: purpose.surfaceId,
      expiresAt: purpose.expiresAt,
      generation: ++this.generations[kind],
      pending: true,
      consumers: new Map([[purpose.consumerId, { id: purpose.consumerId, invalidate }]]),
    };
    this.slots.set(kind, slot);
    delete this.failures[kind];
    slot.timer = setTimeout(() => this.invalidate(kind, "LEASE_EXPIRED"), purpose.expiresAt - this.now());
    // Invoke the consumer's actual browser permission/acquisition synchronously in the user action.
    let acquired: Promise<Acquisition>;
    try {
      acquired = acquireConsumerResource();
    } catch (error) {
      this.recordFailure(kind, error);
      this.invalidate(kind, "PROVIDER_FAILED");
      throw new Error("SEXTANT_MEDIA_PROVIDER_FAILED");
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        this.invalidate(kind, "ACQUISITION_TIMEOUT");
        reject(new Error("SEXTANT_MEDIA_TIMEOUT"));
      }, 10000);
    });
    // A late permission result must release exactly its newly acquired resource.
    const checked = acquired.then((a) => {
      if (this.slots.get(kind) !== slot || !this.foreground || this.disposed || this.now() >= slot.expiresAt) {
        a.resource.stop();
        throw new Error("SEXTANT_MEDIA_CANCELLED");
      }
      try {
        if (a.geometry) a.geometry = sourceGeometrySchema.parse(a.geometry);
        if (kind === "MICROPHONE" && a.geometry) throw new Error("GEOMETRY_FORBIDDEN");
      } catch {
        a.resource.stop();
        throw new Error("SEXTANT_MEDIA_GEOMETRY_INVALID");
      }
      slot.acquisition = a;
      slot.pending = false;
      this.permissions[kind] = "GRANTED";
      slot.detach = a.resource.onEnded(() => this.invalidate(kind, "TRACK_ENDED"));
      if (this.slots.get(kind) !== slot) throw new Error("SEXTANT_MEDIA_ENDED_DURING_START");
      return a;
    });
    try {
      await Promise.race([checked, timeout]);
      return this.lease(slot, purpose.consumerId);
    } catch (error) {
      this.recordFailure(kind, error);
      if (this.slots.get(kind) === slot) this.invalidate(kind, "PROVIDER_FAILED");
      throw new Error("SEXTANT_MEDIA_UNAVAILABLE");
    } finally {
      clearTimeout(timer);
    }
  }
  private recordFailure(kind: MediaKind, error: unknown) {
    const name = error && typeof error === "object" && "name" in error ? String(error.name) : "";
    if (name === "NotAllowedError" || name === "SecurityError")
      this.permissions[kind] = name === "NotAllowedError" ? "DENIED" : "RESTRICTED";
    this.failures[kind] = name === "NotReadableError" ? "BUSY" : "PROVIDER_FAILED";
  }
  cancelConsumer(id: string) {
    for (const slot of this.slots.values())
      if (slot.consumers.delete(id) && !slot.consumers.size) this.invalidate(slot.kind, "CONSUMER_RELEASED");
  }
  private lease(slot: Slot, id: string) {
    return {
      generation: slot.generation,
      release: () => {
        if (this.slots.get(slot.kind) !== slot || !slot.consumers.delete(id)) return;
        if (!slot.consumers.size) this.invalidate(slot.kind, "LEASE_RELEASED");
      },
    };
  }
  /** Consumer reports camera switches/geometry changes; a new lease must explicitly reacquire. */
  invalidate(kind: MediaKind, reason: "SOURCE_CHANGED" | "GEOMETRY_CHANGED" | "THERMAL_RESTRICTED" | string) {
    const slot = this.slots.get(kind);
    this.slots.delete(kind);
    this.generations[kind]++;
    if (!slot) return;
    clearTimeout(slot.timer);
    try {
      slot.detach?.();
    } catch {
      this.cleanupFailures++;
    }
    try {
      slot.acquisition?.resource.stop();
    } catch {
      this.cleanupFailures++;
    } finally {
      for (const c of slot.consumers.values()) {
        try {
          c.invalidate(reason);
        } catch {
          /* Consumer isolation. */
        }
      }
      slot.consumers.clear();
    }
  }
  setForeground(value: boolean) {
    this.foreground = value;
    if (!value) for (const kind of [...this.slots.keys()]) this.invalidate(kind, "BACKGROUND_RESTRICTED");
  }
  dispose() {
    this.disposed = true;
    this.setForeground(false);
  }
  diagnostics() {
    return {
      activeResources: this.slots.size,
      activeConsumers: [...this.slots.values()].reduce((n, s) => n + s.consumers.size, 0),
      foreground: this.foreground,
      cleanupFailures: this.cleanupFailures,
    };
  }
}
/** Discovery never enumerates device IDs or prompts. getUserMedia stays with Watchglass/Parallax. */
export function webMediaCapabilities(
  target: {
    isSecureContext?: boolean;
    navigator?: { mediaDevices?: { getUserMedia?: unknown; getSupportedConstraints?: () => Record<string, boolean> } };
  } | null,
  now: () => number = () => performance.now(),
) {
  const md = target?.navigator?.mediaDevices;
  const keys = ["width", "height", "facingMode", "frameRate", "echoCancellation"] as const;
  let supported: Record<string, boolean> = {};
  try {
    supported = md?.getSupportedConstraints?.() ?? {};
  } catch {
    /* Unknown constraints. */
  }
  return new SextantMediaCapabilities(
    {
      secureContext: target?.isSecureContext === true,
      camera: typeof md?.getUserMedia === "function",
      microphone: typeof md?.getUserMedia === "function",
      captureConstraints: keys.filter((k) => supported[k]),
    },
    now,
  );
}

import { z } from "zod";
import { SextantCapabilityRegistry } from "./capabilities";
import {
  stateSchema,
  unknownState,
  updateInterval,
  type CapabilityState,
  type ProviderDefinition,
  type ProviderSample,
  type SextantProvider,
  type UpdateClass,
} from "./contracts";

export const nativeSensorFamilies = {
  motion: [
    "sextant.motion.linear-acceleration",
    "sextant.motion.acceleration-including-gravity",
    "sextant.motion.gravity",
    "sextant.motion.angular-velocity",
    "sextant.motion.stability",
    "sextant.motion.moving",
  ],
  // Absolute north requires a different native reference. A relative consumer
  // must not implicitly request it and invalidate an existing local-frame lease.
  orientation: ["sextant.orientation.relative", "sextant.orientation.attitude"],
  absolute: ["sextant.orientation.absolute"],
  heading: ["sextant.heading.estimate"],
  magnetic: ["sextant.magnetic.field", "sextant.magnetic.uncalibrated-field", "sextant.magnetic.bias"],
  pressure: ["sextant.pressure.observation"],
  pedometer: ["sextant.motion.pedometer"],
  position: ["sextant.position.observation"],
} as const;
export type NativeSensorFamily = keyof typeof nativeSensorFamilies;
export type SextantNativeOperation =
  | "SEXTANT_STATE"
  | "SEXTANT_START"
  | "SEXTANT_STOP"
  | "SEXTANT_UPDATE"
  | "SEXTANT_PERMISSION"
  | "SEXTANT_HAPTIC"
  | "SEXTANT_HAPTIC_STOP";
export interface SextantNativeTransport {
  platform: "ANDROID" | "IOS";
  request(operation: SextantNativeOperation, payload?: Record<string, unknown>): Promise<unknown>;
  subscribe(listener: (input: unknown) => void): () => void;
}
const id = z.string().uuid();
export const nativeSensorEventSchema = z.strictObject({
  type: z.literal("sextant-sample"),
  version: z.literal(1),
  leaseId: id,
  generation: id,
  sequence: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  emittedAtWallMs: z.number().int().nonnegative(),
  captureAgeMs: z.number().finite().min(0).max(60000),
  captureMonotonicMs: z.number().finite().nonnegative(),
  fidelity: z.enum(["OS", "INJECTED"]),
  sample: z.strictObject({
    capabilityId: z.string().max(80),
    value: z.unknown(),
    units: z.string().max(32),
    referenceFrame: z.enum([
      "DEVICE",
      "NONE",
      "LOCAL_ARBITRARY",
      "EARTH_MAGNETIC",
      "EARTH_TRUE",
      "GRAVITY_ALIGNED",
      "WGS84",
    ]),
    qualityClass: stateSchema.shape.quality,
    calibrationState: stateSchema.shape.calibration,
    confidence: z.number().finite().min(0).max(1).nullable(),
    uncertainty: z.number().finite().nonnegative().optional(),
    warnings: z
      .array(
        z
          .string()
          .regex(/^[A-Z_]+$/)
          .max(100),
      )
      .max(8),
  }),
});
export const nativeCapabilitySnapshotSchema = z.strictObject({
  version: z.literal(1),
  states: z.record(z.string().max(80), stateSchema),
  background: z.literal("FOREGROUND_ONLY"),
  hapticTier: z.enum(["NONE", "BASIC", "RICH"]).optional(),
});
const startSchema = z.strictObject({
  accepted: z.boolean(),
  generation: id.optional(),
  nativeMonotonicMs: z.number().finite().nonnegative().optional(),
});
const registry = new SextantCapabilityRegistry();

/** Canonical semantic adapter over the origin-bound companion transport. Native
 * and JS monotonic clocks align through a bounded start handshake. Wall time is
 * audit metadata only; changes to it cannot invent motion or stale duration.
 * Native OS identity is not a physical-device qualification claim. */
export class NativeSensorProvider implements SextantProvider {
  readonly definition: ProviderDefinition;
  private states: Record<string, CapabilityState> = {};
  private leaseId: string | null = null;
  private generation: string | null = null;
  private lastSequence = -1;
  private lastCapture = new Map<string, number>();
  private detach: (() => void) | null = null;
  private abortDetach: (() => void) | null = null;
  private fail: (() => void) | null = null;
  private clockAnchor: { nativeAt: number; localAt: number; uncertaintyMs: number } | null = null;
  private disposed = false;
  constructor(
    private readonly transport: SextantNativeTransport,
    family: NativeSensorFamily,
    private readonly now: () => number = () => performance.now(),
    private readonly wallNow: () => number = () => Date.now(),
    readonly simulationIdentity?: string,
  ) {
    const capabilities = [...nativeSensorFamilies[family]];
    this.definition = {
      providerId: `native.${transport.platform.toLowerCase()}.${family}`,
      providerVersion: 1,
      platformFamily: simulationIdentity ? "SYNTHETIC" : transport.platform,
      capabilities,
      discoveryMethod: "EXPLICIT",
      permissionRequirements: [...new Set(capabilities.map((c) => registry.get(c).permission))],
      lifecycleConstraints: "FOREGROUND_ONLY",
      qualityMetadata: "PER_OBSERVATION",
      referenceFrames: [...new Set(capabilities.flatMap((c) => registry.get(c).frames))],
      samplingBounds: { minimumIntervalMs: family === "position" ? 1000 : 16, maximumIntervalMs: 5000 },
      powerClass: "VARIABLE",
      privacyClass: "LOCAL_EPHEMERAL",
      simulationSupport: Boolean(simulationIdentity),
    };
  }
  async refresh() {
    const reply = nativeCapabilitySnapshotSchema.parse(await this.transport.request("SEXTANT_STATE"));
    const states: Record<string, CapabilityState> = {};
    for (const capability of this.definition.capabilities)
      states[capability] = reply.states[capability] ?? { ...unknownState(), support: "UNSUPPORTED" };
    this.states = states;
  }
  discover(capabilityId: string): CapabilityState {
    return structuredClone(
      this.states[capabilityId] ?? {
        ...unknownState(),
        support: this.definition.capabilities.includes(capabilityId) ? "UNKNOWN" : "UNSUPPORTED",
      },
    );
  }
  async start(context: {
    signal: AbortSignal;
    updateClass: UpdateClass;
    emit: (sample: ProviderSample) => void;
    fail: (interruption?: "EXPIRED" | "BACKGROUND" | "POWER" | "PERMISSION") => void;
  }) {
    if (this.disposed || this.leaseId || context.signal.aborted) throw new Error("SEXTANT_NATIVE_START_REFUSED");
    const leaseId = crypto.randomUUID();
    this.leaseId = leaseId;
    this.fail = context.fail;
    this.lastSequence = -1;
    this.lastCapture.clear();
    const abort = () => {
      void this.stop().catch(() => context.fail());
    };
    context.signal.addEventListener("abort", abort, { once: true });
    this.abortDetach = () => context.signal.removeEventListener("abort", abort);
    this.detach = this.transport.subscribe((input) => {
      if (this.leaseId !== leaseId || context.signal.aborted || !this.generation) return;
      const ended = z
        .strictObject({
          type: z.literal("sextant-ended"),
          leaseId: id,
          generation: id,
          reason: z.enum(["EXPIRED", "BACKGROUND", "POWER", "PERMISSION", "PROVIDER_ERROR"]),
        })
        .safeParse(input);
      if (ended.success && ended.data.leaseId === leaseId && ended.data.generation === this.generation) {
        context.fail(ended.data.reason === "PROVIDER_ERROR" ? undefined : ended.data.reason);
        return;
      }
      const parsed = nativeSensorEventSchema.safeParse(input);
      if (!parsed.success || parsed.data.leaseId !== leaseId) return;
      const event = parsed.data;
      if (event.generation !== this.generation || event.fidelity !== (this.simulationIdentity ? "INJECTED" : "OS")) {
        context.fail();
        return;
      }
      if (event.sequence <= this.lastSequence) return;
      const sample = event.sample;
      if (!this.definition.capabilities.includes(sample.capabilityId)) return;
      const arrival = this.now(),
        anchor = this.clockAnchor;
      if (!anchor || !Number.isFinite(arrival)) return;
      const mapped = anchor.localAt + event.captureMonotonicMs - anchor.nativeAt;
      if (mapped > arrival + anchor.uncertaintyMs || arrival - mapped > 1000 || event.captureAgeMs > 1000) return;
      const timestampMonotonic = Math.min(arrival, mapped);
      const previous = this.lastCapture.get(sample.capabilityId);
      if (timestampMonotonic < 0 || (previous !== undefined && timestampMonotonic <= previous)) return;
      try {
        const capability = registry.get(sample.capabilityId);
        if (sample.units !== capability.units || !capability.frames.includes(sample.referenceFrame)) return;
        const value = capability.valueSchema.parse(sample.value);
        this.lastSequence = event.sequence;
        this.lastCapture.set(sample.capabilityId, timestampMonotonic);
        this.states[sample.capabilityId] = {
          ...this.discover(sample.capabilityId),
          freshness: "FRESH",
          calibration: sample.calibrationState,
          quality: sample.qualityClass,
        };
        context.emit({
          ...sample,
          value,
          timestampMonotonic,
          discontinuity: previous === undefined,
          warnings: [
            ...new Set([
              ...sample.warnings,
              "NATIVE_MONOTONIC_CLOCK_ALIGNED",
              ...(anchor.uncertaintyMs > 100 ? ["NATIVE_CLOCK_ALIGNMENT_LOW_QUALITY"] : []),
            ]),
          ],
          ...(anchor.uncertaintyMs > 100 ? { qualityClass: "LOW" as const } : {}),
        });
      } catch {
        context.fail();
      }
    });
    try {
      const started = this.now();
      const reply = startSchema.parse(
        await this.transport.request("SEXTANT_START", {
          leaseId,
          capabilities: this.definition.capabilities,
          intervalMs: Math.max(this.definition.samplingBounds.minimumIntervalMs, updateInterval[context.updateClass]),
          durationMs: 60000,
        }),
      );
      const received = this.now();
      if (this.leaseId !== leaseId || context.signal.aborted) {
        await this.transport.request("SEXTANT_STOP", { leaseId });
        return;
      }
      if (
        !reply.accepted ||
        !reply.generation ||
        reply.nativeMonotonicMs === undefined ||
        received < started ||
        received - started > 5000
      )
        throw new Error("SEXTANT_NATIVE_UNAVAILABLE");
      this.clockAnchor = {
        nativeAt: reply.nativeMonotonicMs,
        localAt: (started + received) / 2,
        uncertaintyMs: (received - started) / 2,
      };
      // Read only for optional audit correlation; never part of integration.
      void this.wallNow;
      this.generation = reply.generation;
    } catch (error) {
      await this.stop();
      throw error;
    }
  }
  setUpdateClass(updateClass: UpdateClass) {
    const leaseId = this.leaseId,
      generation = this.generation,
      fail = this.fail;
    if (leaseId)
      void this.transport
        .request("SEXTANT_UPDATE", {
          leaseId,
          intervalMs: Math.max(this.definition.samplingBounds.minimumIntervalMs, updateInterval[updateClass]),
        })
        .then((r) => {
          if (
            this.leaseId === leaseId &&
            this.generation === generation &&
            (r as { accepted?: unknown })?.accepted !== true
          )
            fail?.();
        })
        .catch(() => {
          if (this.leaseId === leaseId && this.generation === generation) fail?.();
        });
  }
  async stop() {
    const leaseId = this.leaseId;
    this.leaseId = this.generation = null;
    this.clockAnchor = null;
    this.detach?.();
    this.detach = null;
    this.abortDetach?.();
    this.abortDetach = null;
    this.lastCapture.clear();
    for (const state of Object.values(this.states)) state.freshness = "STALE";
    if (leaseId) {
      const reply = await this.transport.request("SEXTANT_STOP", { leaseId });
      if ((reply as { accepted?: unknown })?.accepted !== true) throw new Error("SEXTANT_NATIVE_CLEANUP_FAILED");
    }
  }
  async dispose() {
    this.disposed = true;
    await this.stop();
  }
}

import { z } from "zod";
import {
  updateClasses,
  updateInterval,
  qualitySchema,
  frameSchema,
  type SextantProvider,
  type Observation,
  type UpdateClass,
  type ProviderSample,
  type CapabilityState,
  unknownState,
  stateSchema,
} from "./contracts";
import { SextantCapabilityRegistry } from "./capabilities";
import { SextantProviderRegistry } from "./providers";
import { SextantPermissionBroker, type PermissionPurpose } from "./permissions";
import { normalizeObservation, projectObservation } from "./observations";
const requestSchema = z.strictObject({
  capabilityId: z.string().min(1),
  consumerId: z.string().min(1),
  surfaceId: z.string().min(1),
  purpose: z.string().min(1),
  consent: z.boolean(),
  userInitiated: z.boolean(),
  retry: z.boolean().optional(),
  updateClass: z.enum(updateClasses),
  minimumQuality: qualitySchema,
  maxAgeMs: z.number().finite().nonnegative(),
  expiresAt: z.number().finite().nonnegative(),
  frames: z.array(frameSchema).min(1),
  retentionClass: z.literal("EPHEMERAL"),
  foregroundRequirement: z.literal(true),
});
export type LeaseRequest = z.infer<typeof requestSchema> & PermissionPurpose;
export type LeaseEvent =
  | { type: "OBSERVATION"; observation: Observation }
  | { type: "ENDED"; reason: string }
  | { type: "DEGRADED"; reason: string };
type Lease = {
  id: string;
  request: LeaseRequest;
  emit: (event: LeaseEvent) => void;
  provider: SextantProvider;
  lastDelivered: number;
  first: boolean;
  timer?: ReturnType<typeof setTimeout>;
};
type Active = {
  provider: SextantProvider;
  controller: AbortController;
  sequence: number;
  clocks: Map<string, number>;
  metadata: Map<string, Pick<CapabilityState, "quality" | "calibration">>;
  updateClass: UpdateClass;
};
const rank = { UNKNOWN: 0, LOW: 1, MEDIUM: 2, HIGH: 3 };
/** Bound platform lifecycle calls so one stalled adapter cannot hold every surface lease forever. */
async function boundedLifecycle(operation: () => Promise<void>, signal?: AbortSignal) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abort: (() => void) | undefined;
  const boundary = new Promise<never>((_, reject) => {
    abort = () => reject(new Error("SEXTANT_PROVIDER_ABORTED"));
    if (signal?.aborted) abort();
    else signal?.addEventListener("abort", abort, { once: true });
    timer = setTimeout(() => reject(new Error("SEXTANT_PROVIDER_LIFECYCLE_TIMEOUT")), 5000);
  });
  try {
    await Promise.race([Promise.resolve().then(operation), boundary]);
  } finally {
    clearTimeout(timer);
    if (abort) signal?.removeEventListener("abort", abort);
  }
}

/** One instance belongs to one active surface runtime. No durable raw-stream store or progression writer. */
export class SextantLeaseBroker {
  private readonly leases = new Map<string, Lease>();
  private readonly active = new Map<string, Active>();
  private readonly failed = new Set<string>();
  private queue: Promise<unknown> = Promise.resolve();
  private foreground = true;
  private disposed = false;
  private readonly unsubscribe: () => void;
  constructor(
    private readonly capabilities: SextantCapabilityRegistry,
    private readonly providers: SextantProviderRegistry,
    private readonly permissions: SextantPermissionBroker,
    private readonly now: () => number = () => performance.now(),
  ) {
    this.unsubscribe = permissions.onChange((key) => {
      const state = permissions.state(key);
      if (!state.enabled || !["GRANTED", "NOT_REQUIRED"].includes(state.permission)) {
        for (const a of this.active.values())
          if (a.provider.definition.capabilities.some((id) => capabilities.get(id).permission === key))
            a.controller.abort();
        void this.cancelWhere(
          (l) => l.provider.definition.permissionRequirements.includes(key),
          "PERMISSION_REVOKED_OR_PAUSED",
        ).catch(() => {});
      }
    });
  }
  private serial<T>(action: () => Promise<T>): Promise<T> {
    const result = this.queue.then(action);
    this.queue = result.catch(() => {});
    return result;
  }
  private deliver(lease: Lease, event: LeaseEvent) {
    try {
      lease.emit(structuredClone(event));
    } catch {
      /* Isolate consumer failure. */
    }
  }
  async acquire(input: LeaseRequest, emit: (event: LeaseEvent) => void) {
    const request = requestSchema.parse(input);
    const c = this.capabilities.get(request.capabilityId);
    if (
      this.disposed ||
      !this.foreground ||
      request.expiresAt <= this.now() ||
      request.expiresAt - this.now() > (request.updateClass === "HIGH_FIDELITY_BURST" ? 30000 : 3600000)
    )
      throw new Error("SEXTANT_LEASE_UNAVAILABLE");
    const permission = await this.permissions.authorize(c.permission, request);
    if (!["GRANTED", "NOT_REQUIRED"].includes(permission)) throw new Error("SEXTANT_PERMISSION_UNAVAILABLE");
    return this.serial(async () => {
      const state = this.permissions.state(c.permission);
      if (
        this.disposed ||
        !this.foreground ||
        request.expiresAt <= this.now() ||
        !state.enabled ||
        !["GRANTED", "NOT_REQUIRED"].includes(state.permission)
      )
        throw new Error("SEXTANT_LEASE_UNAVAILABLE");
      const provider = this.providers.candidates(c.id, request.frames).find(
        (p) =>
          !this.failed.has(p.definition.providerId) &&
          p.definition.permissionRequirements.every((key) => {
            const s = this.permissions.state(key);
            return s.enabled && ["GRANTED", "NOT_REQUIRED"].includes(s.permission);
          }),
      );
      if (!provider) throw new Error("SEXTANT_PROVIDER_UNAVAILABLE");
      const id = crypto.randomUUID(),
        lease: Lease = { id, request, emit, provider, lastDelivered: -Infinity, first: true };
      this.leases.set(id, lease);
      try {
        await this.reconcile(provider);
      } catch {
        this.leases.delete(id);
        throw new Error("SEXTANT_PROVIDER_START_FAILED");
      }
      if (
        !this.foreground ||
        this.disposed ||
        request.expiresAt <= this.now() ||
        this.active.get(provider.definition.providerId)?.controller.signal.aborted ||
        !this.permissions.state(c.permission).enabled ||
        !["GRANTED", "NOT_REQUIRED"].includes(this.permissions.state(c.permission).permission) ||
        !this.leases.has(id)
      ) {
        await this.end(lease, "START_CANCELLED");
        throw new Error("SEXTANT_LEASE_UNAVAILABLE");
      }
      lease.timer = setTimeout(
        () => {
          void this.release(id, "EXPIRED").catch(() => {});
        },
        Math.min(2147483647, request.expiresAt - this.now()),
      );
      return { leaseId: id, release: () => this.release(id) };
    });
  }
  private async reconcile(provider: SextantProvider) {
    const id = provider.definition.providerId,
      leases = [...this.leases.values()].filter((l) => l.provider === provider);
    if (!leases.length) {
      const active = this.active.get(id);
      if (active) {
        active.controller.abort();
        this.active.delete(id);
        try {
          await boundedLifecycle(() => provider.stop());
        } catch {
          this.failed.add(id);
          throw new Error("SEXTANT_CLEANUP_FAILED");
        }
      }
      return;
    }
    const updateClass = leases.reduce(
      (best, l) => (updateInterval[l.request.updateClass] < updateInterval[best] ? l.request.updateClass : best),
      "PASSIVE" as UpdateClass,
    );
    const current = this.active.get(id);
    if (current) {
      if (current.updateClass !== updateClass) {
        try {
          provider.setUpdateClass(updateClass);
          current.updateClass = updateClass;
        } catch {
          this.failed.add(id);
          current.controller.abort();
          void this.cancelWhere((l) => l.provider === provider, "PROVIDER_RATE_FAILED").catch(() => {});
          throw new Error("SEXTANT_PROVIDER_RATE_FAILED");
        }
      }
      return;
    }
    const active: Active = {
      provider,
      controller: new AbortController(),
      sequence: 0,
      clocks: new Map(),
      metadata: new Map(),
      updateClass,
    };
    this.active.set(id, active);
    try {
      await boundedLifecycle(
        () =>
          provider.start({
            signal: active.controller.signal,
            updateClass,
            emit: (sample) => this.sample(active, sample),
            fail: () => {
              this.failed.add(id);
              active.controller.abort();
              void this.cancelWhere((l) => l.provider === provider, "PROVIDER_FAILED").catch(() => {});
            },
          }),
        active.controller.signal,
      );
    } catch {
      active.controller.abort();
      this.active.delete(id);
      this.failed.add(id);
      try {
        await boundedLifecycle(() => provider.stop());
      } catch {
        throw new Error("SEXTANT_CLEANUP_FAILED");
      }
      throw new Error("SEXTANT_PROVIDER_START_FAILED");
    }
  }
  private sample(active: Active, sample: ProviderSample) {
    if (active.controller.signal.aborted || !this.foreground || this.disposed) return;
    const now = this.now();
    let observation: Observation;
    try {
      if (sample.timestampMonotonic <= (active.clocks.get(sample.capabilityId) ?? -Infinity))
        throw new Error("SEXTANT_OUT_OF_ORDER");
      observation = normalizeObservation(this.capabilities, active.provider, sample, {
        now,
        sequence: active.sequence++,
        discontinuity: false,
      });
      active.clocks.set(sample.capabilityId, sample.timestampMonotonic);
      active.metadata.set(sample.capabilityId, {
        quality: observation.qualityClass,
        calibration: observation.calibrationState,
      });
    } catch {
      return;
    }
    for (const lease of [...this.leases.values()]) {
      if (lease.provider !== active.provider || lease.request.capabilityId !== sample.capabilityId) continue;
      const permission = this.permissions.state(this.capabilities.get(sample.capabilityId).permission);
      if (now >= lease.request.expiresAt) {
        void this.release(lease.id, "EXPIRED").catch(() => {});
        continue;
      }
      if (!permission.enabled || !["GRANTED", "NOT_REQUIRED"].includes(permission.permission)) continue;
      const projected = projectObservation(observation, now, lease.request.maxAgeMs);
      if (
        !lease.request.frames.includes(projected.referenceFrame) ||
        projected.ageMs > lease.request.maxAgeMs ||
        rank[projected.qualityClass] < rank[lease.request.minimumQuality]
      ) {
        this.deliver(lease, {
          type: "DEGRADED",
          reason: projected.ageMs > lease.request.maxAgeMs ? "STALE" : "QUALITY_OR_FRAME_UNAVAILABLE",
        });
        continue;
      }
      if (now - lease.lastDelivered < updateInterval[lease.request.updateClass]) continue;
      projected.discontinuity = lease.first || observation.discontinuity;
      lease.first = false;
      lease.lastDelivered = now;
      this.deliver(lease, { type: "OBSERVATION", observation: projected });
    }
  }
  private async end(lease: Lease, reason: string) {
    if (!this.leases.delete(lease.id)) return;
    clearTimeout(lease.timer);
    this.deliver(lease, { type: "ENDED", reason });
    await this.reconcile(lease.provider);
  }
  release(id: string, reason = "CONSUMER_RELEASED") {
    return this.serial(async () => {
      const lease = this.leases.get(id);
      if (lease) await this.end(lease, reason);
    });
  }
  private cancelWhere(predicate: (l: Lease) => boolean, reason: string) {
    return this.serial(async () => {
      let failed = false;
      for (const l of [...this.leases.values()].filter(predicate)) {
        try {
          await this.end(l, reason);
        } catch {
          failed = true;
        }
      }
      if (failed) throw new Error("SEXTANT_CLEANUP_FAILED");
    });
  }
  cancelConsumer(id: string) {
    return this.cancelWhere((l) => l.request.consumerId === id, "CONSUMER_UNMOUNTED");
  }
  disconnectSurface(id: string) {
    return this.cancelWhere((l) => l.request.surfaceId === id, "SURFACE_DISCONNECTED");
  }
  sweep() {
    return this.cancelWhere((l) => l.request.expiresAt <= this.now(), "EXPIRED");
  }
  setForeground(visible: boolean) {
    this.foreground = visible;
    if (!visible) for (const a of this.active.values()) a.controller.abort();
    return visible ? Promise.resolve() : this.cancelWhere(() => true, "BACKGROUND_RESTRICTED");
  }
  async switchProvider(leaseId: string) {
    return this.serial(async () => {
      const lease = this.leases.get(leaseId);
      if (!lease) throw new Error("SEXTANT_LEASE_UNKNOWN");
      const next = this.providers.candidates(lease.request.capabilityId, lease.request.frames).find(
        (p) =>
          p !== lease.provider &&
          !this.failed.has(p.definition.providerId) &&
          p.definition.permissionRequirements.every((key) => {
            const s = this.permissions.state(key);
            return s.enabled && ["GRANTED", "NOT_REQUIRED"].includes(s.permission);
          }),
      );
      if (!next) throw new Error("SEXTANT_PROVIDER_UNAVAILABLE");
      const old = lease.provider;
      lease.provider = next;
      lease.first = true;
      lease.lastDelivered = -Infinity;
      try {
        await this.reconcile(old);
        await this.reconcile(next);
      } catch {
        await this.end(lease, "PROVIDER_SWITCH_FAILED");
        throw new Error("SEXTANT_PROVIDER_SWITCH_FAILED");
      }
    });
  }
  async dispose(reason = "VOYAGE_END_OR_SIGN_OUT") {
    this.disposed = true;
    for (const a of this.active.values()) a.controller.abort();
    this.unsubscribe();
    await this.cancelWhere(() => true, reason);
  }
  snapshot(capabilityId: string, maxAgeMs?: number): CapabilityState {
    if (maxAgeMs !== undefined && (!Number.isFinite(maxAgeMs) || maxAgeMs < 0))
      throw new Error("SEXTANT_FRESHNESS_POLICY_INVALID");
    const c = this.capabilities.get(capabilityId),
      p = this.providers.candidates(capabilityId).find((p) => !this.failed.has(p.definition.providerId));
    const permission = this.permissions.state(c.permission);
    const active = p ? this.active.get(p.definition.providerId) : undefined;
    const timestamp = active?.clocks.get(capabilityId),
      metadata = active?.metadata.get(capabilityId);
    const states = this.providers.states(capabilityId);
    let state = states.find((s) => s.support === "SUPPORTED") ?? states[0] ?? unknownState();
    try {
      if (p) state = stateSchema.parse(p.discover(capabilityId));
    } catch {
      /* Discovery may change between selection and projection. */
    }
    return {
      ...state,
      ...metadata,
      freshness:
        timestamp !== undefined && maxAgeMs !== undefined
          ? this.now() - timestamp > maxAgeMs
            ? "STALE"
            : "FRESH"
          : "UNKNOWN",
      permission: permission.permission,
      ...(!permission.enabled || !this.foreground
        ? { availability: "TEMPORARILY_UNAVAILABLE" as const, lifecycle: "SUSPENDED" as const }
        : {}),
    };
  }
  diagnostics() {
    return {
      activeProviders: this.active.size,
      activeLeases: this.leases.size,
      failedProviders: this.failed.size,
      foreground: this.foreground,
      disposed: this.disposed,
    };
  }
  idle() {
    return this.queue;
  }
}

import { z } from "zod";
import { observationSchema, type LandfallObservation } from "@/landfall/observation";
import type { LandfallWorldspace } from "@/landfall/schema";
import type { PermissionState } from "@/landfall/provider-policy";

export const nativeFixSchema = z.strictObject({
  id: z.string().min(1).max(128),
  timestamp: z.number().int().nonnegative(),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  accuracyMeters: z.number().finite().positive().max(100000),
  headingDegrees: z.number().finite().min(0).max(360).optional(),
  speedMetersPerSecond: z.number().finite().min(0).max(100).optional(),
  altitudeMeters: z.number().finite().min(-12000).max(100000).optional(),
  altitudeAccuracyMeters: z.number().finite().positive().max(100000).optional(),
});
export type NativeLocationDriver = {
  platform: "IOS" | "ANDROID";
  permission(): Promise<PermissionState>;
  start(options: { background: boolean; intervalMs: number; precise: boolean }): Promise<void>;
  stop(): Promise<void>;
  subscribe(
    listener: (
      event: { type: "fix"; fix: unknown } | { type: "permission"; state: PermissionState } | { type: "error" },
    ) => void,
  ): () => void;
};

/** Same canonical physical observation as the browser, with OS acquisition isolated behind one driver. */
export class NativeLocationProvider {
  private generation = 0;
  private unsubscribe: (() => void) | null = null;
  private state: PermissionState = "UNKNOWN";
  private starting: number | null = null;
  private driverTail = Promise.resolve();
  private operate(operation: () => Promise<void>) {
    const result = this.driverTail.then(operation);
    this.driverTail = result.catch(() => undefined);
    return result;
  }
  private lastAt = -1;
  constructor(
    private readonly driver: NativeLocationDriver,
    private readonly worldspace: LandfallWorldspace,
    private readonly now = Date.now,
  ) {
    if (worldspace.kind !== "PHYSICAL" || worldspace.coordinateReference.type !== "WGS84")
      throw new Error("LANDFALL_NATIVE_REQUIRES_PHYSICAL_WGS84");
  }
  get permissionState() {
    return this.state;
  }
  get active() {
    return this.unsubscribe !== null;
  }
  async start(
    identity: { sessionId: string; publishedVersionId: string },
    options: { userAction: boolean; intervalMs: number; precise: boolean },
    emit: (observation: LandfallObservation) => void,
    onState: (state: PermissionState) => void,
  ): Promise<void> {
    if (!options.userAction) throw new Error("LANDFALL_NATIVE_CONSENT_REQUIRED");
    if (!Number.isInteger(options.intervalMs) || options.intervalMs < 1000 || options.intervalMs > 60000)
      throw new Error("LANDFALL_NATIVE_RATE_INVALID");
    if (this.starting !== null || this.active) return;
    const generation = ++this.generation;
    this.starting = generation;
    try {
      const permission = await this.driver.permission();
      if (generation !== this.generation) return;
      this.state = permission;
      onState(permission);
      if (!["GRANTED", "APPROXIMATE", "LIMITED"].includes(permission)) return;
      this.lastAt = -1;
      this.unsubscribe = this.driver.subscribe((event) => {
        if (generation !== this.generation) return;
        if (event.type !== "fix") {
          this.state = event.type === "permission" ? event.state : "UNAVAILABLE";
          onState(this.state);
          if (!["GRANTED", "APPROXIMATE", "LIMITED"].includes(this.state)) void this.stop();
          return;
        }
        const parsed = nativeFixSchema.safeParse(event.fix);
        if (!parsed.success) return;
        const fix = parsed.data;
        if (fix.timestamp <= this.lastAt || fix.timestamp > this.now() + 1000 || this.now() - fix.timestamp > 30_000)
          return;
        const providerId = this.driver.platform === "IOS" ? "ios-core-location" : "android-location";
        const reference = this.worldspace.coordinateReference;
        const observation = observationSchema.safeParse({
          schemaVersion: 1,
          id: fix.id,
          ...identity,
          worldspaceId: this.worldspace.id,
          providerId,
          source: "NATIVE_LOCATION",
          kind: "PHYSICAL_POSITION",
          observedAt: new Date(fix.timestamp).toISOString(),
          coordinate: {
            type: "WGS84",
            worldspaceId: this.worldspace.id,
            referenceId: reference.id,
            referenceVersion: reference.version,
            latitude: fix.latitude,
            longitude: fix.longitude,
          },
          accuracyMeters: fix.accuracyMeters,
          ...(fix.headingDegrees !== undefined ? { headingDegrees: fix.headingDegrees } : {}),
          ...(fix.speedMetersPerSecond !== undefined ? { speedMetersPerSecond: fix.speedMetersPerSecond } : {}),
          ...(fix.altitudeMeters !== undefined && fix.altitudeAccuracyMeters !== undefined
            ? { altitudeMeters: fix.altitudeMeters, altitudeAccuracyMeters: fix.altitudeAccuracyMeters }
            : {}),
        });
        if (!observation.success) return;
        this.lastAt = fix.timestamp;
        emit(observation.data);
      });
      await this.operate(async () => {
        if (generation !== this.generation) return;
        await this.driver.start({
          background: false,
          intervalMs: options.intervalMs,
          precise: options.precise && permission === "GRANTED",
        });
      });
    } catch {
      if (generation === this.generation) {
        this.state = "UNAVAILABLE";
        onState(this.state);
        await this.stop();
      }
    } finally {
      if (this.starting === generation) this.starting = null;
    }
  }
  async stop() {
    this.generation++;
    this.starting = null;
    this.unsubscribe?.();
    this.unsubscribe = null;
    await this.operate(() => this.driver.stop());
  }
}

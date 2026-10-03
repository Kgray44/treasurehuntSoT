import { z } from "zod";
import { landfallId } from "@/landfall/schema";

const nearbySignalSchema = z.discriminatedUnion("family", [
  z.strictObject({
    family: z.literal("BLE"),
    id: landfallId,
    peerId: landfallId,
    observedAt: z.number().int().nonnegative(),
    rssi: z.number().finite().min(-150).max(0),
    authenticated: z.boolean(),
  }),
  z.strictObject({
    family: z.literal("UWB"),
    id: landfallId,
    peerId: landfallId,
    observedAt: z.number().int().nonnegative(),
    distanceMeters: z.number().finite().min(0).max(1000),
    uncertaintyMeters: z.number().finite().positive().max(1000),
    directionDegrees: z.number().finite().min(0).max(360).optional(),
    authenticated: z.boolean(),
  }),
]);
export type NearbySignal = z.infer<typeof nearbySignalSchema>;
export type NearbyProjection = {
  state:
    | "NEAR"
    | "POSSIBLE"
    | "UNAVAILABLE"
    | "UNSUPPORTED_DEVICE"
    | "PERMISSION_DENIED"
    | "STALE"
    | "DUPLICATE"
    | "UNTRUSTED";
  band: "CLOSE" | "NEARBY" | "UNKNOWN";
  precision: "PROXIMITY_ONLY";
  canComplete: false;
};

/** Peer allowlist comes from authorized first-party configuration, not discoveries. RSSI never becomes coordinates. */
export class LandfallNearbyProvider {
  private readonly seen = new Map<string, number>();
  private lastAt = -1;
  private current: NearbyProjection = this.project("UNAVAILABLE");
  constructor(
    private readonly family: "BLE" | "UWB",
    private readonly peers: ReadonlySet<string>,
  ) {
    if (peers.size > 32 || [...peers].some((peer) => !landfallId.safeParse(peer).success))
      throw new Error("LANDFALL_NEARBY_PEERS_INVALID");
  }
  ingest(
    input: unknown,
    capability: { physical: boolean; supported: boolean; permission: boolean; enabled: boolean },
    now: number,
  ): NearbyProjection {
    if (!capability.physical || !capability.supported) return (this.current = this.project("UNSUPPORTED_DEVICE"));
    if (!capability.permission) return (this.current = this.project("PERMISSION_DENIED"));
    if (!capability.enabled) return (this.current = this.project("UNAVAILABLE"));
    const parsed = nearbySignalSchema.safeParse(input);
    if (
      !parsed.success ||
      parsed.data.family !== this.family ||
      !parsed.data.authenticated ||
      !this.peers.has(parsed.data.peerId)
    )
      return (this.current = this.project("UNTRUSTED"));
    const signal = parsed.data;
    if (
      !Number.isFinite(now) ||
      signal.observedAt > now + 1000 ||
      now - signal.observedAt > 10000 ||
      signal.observedAt < this.lastAt
    )
      return (this.current = this.project("STALE"));
    for (const [id, at] of this.seen) if (now - at > 10000) this.seen.delete(id);
    if (this.seen.has(signal.id)) return (this.current = this.project("DUPLICATE"));
    this.seen.set(signal.id, now);
    while (this.seen.size > 128) this.seen.delete(this.seen.keys().next().value!);
    this.lastAt = signal.observedAt;
    const near = signal.family === "BLE" ? signal.rssi >= -60 : signal.distanceMeters + signal.uncertaintyMeters <= 3;
    const possible =
      signal.family === "BLE" ? signal.rssi >= -90 : signal.distanceMeters + signal.uncertaintyMeters <= 10;
    return (this.current = {
      state: near ? "NEAR" : possible ? "POSSIBLE" : "UNAVAILABLE",
      band: near ? "CLOSE" : possible ? "NEARBY" : "UNKNOWN",
      precision: "PROXIMITY_ONLY",
      canComplete: false,
    });
  }
  snapshot(now: number): NearbyProjection {
    return now - this.lastAt > 10000 ? this.project("STALE") : { ...this.current };
  }
  reset() {
    this.seen.clear();
    this.lastAt = -1;
    this.current = this.project("UNAVAILABLE");
  }
  private project(state: NearbyProjection["state"]): NearbyProjection {
    return { state, band: "UNKNOWN", precision: "PROXIMITY_ONLY", canComplete: false };
  }
}

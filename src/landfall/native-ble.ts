import { z } from "zod";
import type { LandfallWorldspace } from "@/landfall/schema";
import {
  landfallNativeHost,
  landfallNativeRequest,
  subscribeLandfallNativeLifecycle,
  subscribeNativeLandfallPower,
} from "@/landfall/native-bridge";

export const nativeBleObservationSchema = z.strictObject({
  type: z.literal("nearby"),
  family: z.literal("BLE"),
  protocol: z.enum(["GENERIC", "IBEACON", "EDDYSTONE_UID"]),
  authenticated: z.literal(false),
  scanId: z.string().uuid(),
  peerId: z.string().regex(/^[a-f0-9]{64}$/),
  observedAt: z.number().int().nonnegative(),
  rssi: z.number().int().min(-150).max(0).nullable(),
});
const observation = nativeBleObservationSchema;
const nativeState = z.object({
  state: z.enum([
    "GRANTED",
    "INITIALIZING",
    "PROMPTABLE",
    "DENIED",
    "DENIED_PERMANENTLY",
    "UNSUPPORTED",
    "UNAVAILABLE",
  ]),
});
export type BleProjection = {
  state: "OFF" | "SCANNING" | "UNTRUSTED" | "STALE" | "STOPPED" | "EXPIRED" | z.infer<typeof nativeState>["state"];
  unverifiedPeers: number;
  band: "STRONG_SIGNAL" | "WEAK_SIGNAL" | "UNKNOWN";
  protocols: ("GENERIC" | "IBEACON" | "EDDYSTONE_UID")[];
  peerVerified: false;
  physicalPresence: "NOT_PROVEN";
  canComplete: false;
};
async function request(operation: "BLE_START" | "BLE_STOP", payload: Record<string, unknown> = {}) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      landfallNativeRequest(operation, payload),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("LANDFALL_BLE_TIMEOUT")), 5000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
/** Ephemeral, deliberate discovery. Radio addresses are salted natively; RSSI is never distance or location. */
export class NativeLandfallBleProvider {
  private generation = 0;
  private scanId: string | null = null;
  private teardown: (() => void) | null = null;
  private stopTail: Promise<unknown> = Promise.resolve();
  private peers = new Map<
    string,
    { at: number; rssi: number | null; protocol: z.infer<typeof observation>["protocol"] }
  >();
  private value: BleProjection = this.project("OFF");
  constructor(
    world: LandfallWorldspace,
    private readonly now = Date.now,
  ) {
    if (world.kind !== "PHYSICAL") throw new Error("LANDFALL_BLE_REQUIRES_PHYSICAL_WORLDSPACE");
  }
  private project(state: BleProjection["state"]): BleProjection {
    return {
      state,
      unverifiedPeers: 0,
      band: "UNKNOWN",
      protocols: [],
      peerVerified: false,
      physicalPresence: "NOT_PROVEN",
      canComplete: false,
    };
  }
  snapshot(): BleProjection {
    return { ...this.value, protocols: [...this.value.protocols] };
  }
  async start(deliberate: boolean, listener: (value: BleProjection) => void) {
    if (!deliberate) throw new Error("LANDFALL_BLE_CONSENT_REQUIRED");
    const stopping = this.stop(),
      boundary = this.generation;
    await stopping;
    if (boundary !== this.generation || !landfallNativeHost() || document.hidden) return "UNAVAILABLE";
    const attempt = ++this.generation,
      scanId = crypto.randomUUID();
    this.scanId = scanId;
    const update = (state: BleProjection["state"]) => {
      if (attempt !== this.generation) return;
      this.value = this.project(state);
      if (state === "UNTRUSTED") {
        this.value.unverifiedPeers = this.peers.size;
        this.value.protocols = [...new Set([...this.peers.values()].map((peer) => peer.protocol))].sort();
        // Discovery can be genuine while the OS supplies no usable signal
        // strength. Preserve UNKNOWN; never turn an invalid value into distance.
        const strongest = Math.max(
          ...[...this.peers.values()].flatMap((peer) => (peer.rssi === null ? [] : [peer.rssi])),
        );
        this.value.band = strongest >= -60 ? "STRONG_SIGNAL" : strongest >= -90 ? "WEAK_SIGNAL" : "UNKNOWN";
      }
      listener(this.snapshot());
    };
    const finish = (state: "STOPPED" | "EXPIRED" | "UNAVAILABLE") => {
      if (attempt !== this.generation) return;
      update(state);
      void this.stop();
    };
    const receive = (event: Event) => {
      const input = (event as CustomEvent).detail;
      if (input?.type === "ble-ended" && input.scanId === scanId) {
        finish("STOPPED");
        return;
      }
      const parsed = observation.safeParse(input);
      if (!parsed.success || parsed.data.scanId !== scanId || attempt !== this.generation || document.hidden) return;
      const sample = parsed.data,
        now = this.now();
      if (!Number.isFinite(now) || sample.observedAt > now + 1000 || now - sample.observedAt > 5000) return;
      const previous = this.peers.get(sample.peerId);
      if (previous && sample.observedAt <= previous.at) return;
      if (!previous && this.peers.size >= 32) return;
      this.peers.set(sample.peerId, { at: sample.observedAt, rssi: sample.rssi, protocol: sample.protocol });
      update("UNTRUSTED");
    };
    const hidden = () => {
      if (document.hidden) finish("STOPPED");
    };
    const lifecycle = subscribeLandfallNativeLifecycle((state) => {
      if (state === "BACKGROUND") finish("STOPPED");
    });
    const power = subscribeNativeLandfallPower((state) => {
      if (state.lowPower || state.thermalPressure || state.critical) finish("STOPPED");
    });
    const expiry = setTimeout(() => finish("EXPIRED"), 30000);
    const stale = setInterval(() => {
      if (attempt !== this.generation) return;
      for (const [id, peer] of this.peers) if (this.now() - peer.at > 5000) this.peers.delete(id);
      if (this.value.state === "UNTRUSTED") update(this.peers.size ? "UNTRUSTED" : "STALE");
    }, 1000);
    window.addEventListener("landfall-native-event", receive);
    document.addEventListener("visibilitychange", hidden);
    this.teardown = () => {
      clearTimeout(expiry);
      clearInterval(stale);
      lifecycle();
      power();
      window.removeEventListener("landfall-native-event", receive);
      document.removeEventListener("visibilitychange", hidden);
    };
    update("SCANNING");
    try {
      const reply = nativeState.parse(await request("BLE_START", { scanId }));
      if (attempt !== this.generation) return "UNAVAILABLE";
      if (!["GRANTED", "INITIALIZING"].includes(reply.state)) {
        update(reply.state);
        await this.stop();
      }
      return reply.state;
    } catch {
      finish("UNAVAILABLE");
      return "UNAVAILABLE";
    }
  }
  async stop() {
    const scanId = this.scanId;
    this.scanId = null;
    this.generation++;
    this.teardown?.();
    this.teardown = null;
    this.peers.clear();
    this.value = this.project("OFF");
    this.stopTail = this.stopTail
      .catch(() => undefined)
      .then(async () => {
        if (scanId && landfallNativeHost()) await request("BLE_STOP", { scanId }).catch(() => undefined);
      });
    await this.stopTail;
  }
}

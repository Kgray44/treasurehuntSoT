import { z } from "zod";
import { landfallId, type LandfallWorldspace } from "@/landfall/schema";
import { landfallNativeHost, landfallNativeRequest, subscribeLandfallNativeLifecycle } from "@/landfall/native-bridge";
import type { NativeUwbProjection } from "@/landfall/native-uwb";

const discoveryToken = z
  .string()
  .min(4)
  .max(5464)
  .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/);
export const nativeNearbyInteractionConfigurationSchema = z.strictObject({
  peerId: landfallId,
  discoveryToken,
  expiresAt: z.number().int().nonnegative(),
});
const readySchema = z.strictObject({ state: z.literal("READY"), discoveryToken });
const rangeSchema = z.strictObject({
  type: z.literal("nearby"),
  family: z.literal("UWB"),
  platform: z.literal("IOS"),
  id: landfallId,
  peerId: landfallId,
  observedAt: z.number().int().nonnegative(),
  distanceMeters: z.number().finite().min(0).max(1000),
  uncertaintyMeters: z.null(),
  authenticated: z.literal(false),
  sessionProtected: z.literal(false),
});

/** Apple's opaque discovery-token exchange supplies hints, never Player identity or arrival. */
export class NativeLandfallNearbyInteractionProvider {
  private generation = 0;
  private preparedUntil = 0;
  private expiresAt = 0;
  private peer: string | null = null;
  private lastAt = -1;
  private timeout: ReturnType<typeof setTimeout> | undefined;
  private stopLifecycle: (() => void) | null = null;
  private listener: ((value: NativeUwbProjection) => void) | null = null;
  private projection: NativeUwbProjection = this.empty("UNCONFIGURED");
  constructor(
    worldspace: LandfallWorldspace,
    private readonly now = Date.now,
  ) {
    if (worldspace.kind !== "PHYSICAL") throw new Error("LANDFALL_NEARBY_REQUIRES_PHYSICAL_WORLDSPACE");
  }
  private empty(state: NativeUwbProjection["state"]): NativeUwbProjection {
    return { state, rangeAvailable: false, uncertainty: "UNKNOWN", peerVerified: false, canComplete: false };
  }
  private update(state: NativeUwbProjection["state"], rangeAvailable = false) {
    this.projection = { ...this.empty(state), rangeAvailable };
    this.listener?.({ ...this.projection });
  }
  snapshot(): NativeUwbProjection {
    if (this.projection.state === "READY" && this.now() >= this.preparedUntil) return this.empty("EXPIRED");
    if (this.projection.rangeAvailable && this.now() - this.lastAt > 10000) return this.empty("UNAVAILABLE");
    return { ...this.projection };
  }
  async prepare(userAction: boolean) {
    if (!userAction) throw new Error("LANDFALL_NEARBY_CONSENT_REQUIRED");
    await this.stop();
    const attempt = this.generation;
    if (landfallNativeHost()?.platform !== "IOS") {
      this.update("UNSUPPORTED");
      return null;
    }
    this.update("INITIALIZING");
    try {
      const reply = await landfallNativeRequest("NI_PREPARE");
      if (attempt !== this.generation) return null;
      const ready = readySchema.safeParse(reply);
      if (ready.success) {
        this.preparedUntil = this.now() + 60000;
        this.update("READY");
        this.stopLifecycle = subscribeLandfallNativeLifecycle((state) => {
          if (state === "BACKGROUND") void this.stop();
        });
        return ready.data;
      }
      const state = z.object({ state: z.enum(["UNSUPPORTED", "UNAVAILABLE", "PROMPTABLE"]) }).safeParse(reply);
      this.update(state.success ? state.data.state : "UNAVAILABLE");
    } catch {
      if (attempt === this.generation) this.update("UNAVAILABLE");
    }
    return null;
  }
  async start(
    input: z.infer<typeof nativeNearbyInteractionConfigurationSchema>,
    listener: (value: NativeUwbProjection) => void,
  ) {
    const configuration = nativeNearbyInteractionConfigurationSchema.parse(input);
    if (
      !Number.isFinite(this.now()) ||
      configuration.expiresAt <= this.now() ||
      configuration.expiresAt - this.now() > 300000
    )
      throw new Error("LANDFALL_NEARBY_PAIRING_EXPIRED");
    if (this.projection.state !== "READY" || this.now() >= this.preparedUntil || this.peer)
      throw new Error("LANDFALL_NEARBY_NOT_PREPARED");
    this.peer = configuration.peerId;
    this.expiresAt = configuration.expiresAt;
    this.listener = listener;
    window.addEventListener("landfall-native-event", this.receive);
    this.timeout = setTimeout(() => {
      void this.finish("EXPIRED");
    }, this.expiresAt - this.now());
    const attempt = this.generation;
    this.update("INITIALIZING");
    try {
      const reply = z
        .object({ state: z.enum(["INITIALIZING", "UNSUPPORTED", "UNAVAILABLE"]) })
        .parse(await landfallNativeRequest("NI_START", configuration));
      if (attempt !== this.generation) return;
      if (reply.state !== "INITIALIZING") await this.finish(reply.state);
    } catch {
      if (attempt === this.generation) await this.stop();
    }
  }
  private readonly receive = (event: Event) => {
    const value = (event as CustomEvent).detail;
    if (!this.peer || this.now() >= this.expiresAt) return;
    if (
      value?.type === "nearby-state" &&
      value.family === "UWB" &&
      value.platform === "IOS" &&
      ["UNAVAILABLE", "EXPIRED"].includes(value.state)
    ) {
      void this.finish(value.state);
      return;
    }
    const range = rangeSchema.safeParse(value);
    if (
      !range.success ||
      range.data.peerId !== this.peer ||
      range.data.observedAt <= this.lastAt ||
      range.data.observedAt > this.now() + 1000 ||
      this.now() - range.data.observedAt > 10000
    )
      return;
    this.lastAt = range.data.observedAt;
    this.update("UNTRUSTED", true);
  };
  private async finish(state: NativeUwbProjection["state"]) {
    const stopping = this.stop();
    const attempt = this.generation;
    await stopping;
    if (attempt === this.generation) this.update(state);
  }
  async stop() {
    this.generation++;
    clearTimeout(this.timeout);
    this.timeout = undefined;
    this.stopLifecycle?.();
    this.stopLifecycle = null;
    if (typeof window !== "undefined") window.removeEventListener("landfall-native-event", this.receive);
    this.peer = null;
    this.preparedUntil = 0;
    this.expiresAt = 0;
    this.lastAt = -1;
    this.update("UNAVAILABLE");
    this.listener = null;
    if (landfallNativeHost()?.platform === "IOS") await landfallNativeRequest("NI_STOP").catch(() => undefined);
  }
}

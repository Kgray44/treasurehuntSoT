import { z } from "zod";
import { landfallId, type LandfallWorldspace } from "@/landfall/schema";
import { landfallNativeHost, landfallNativeRequest, subscribeLandfallNativeLifecycle } from "@/landfall/native-bridge";

const address = z.string().regex(/^[A-Za-z0-9+/]{3}=$/);
export const nativeUwbConfigurationSchema = z.strictObject({
  peerId: landfallId,
  sessionId: z.number().int().min(1).max(2147483647),
  security: z.literal("PROVISIONED_STS"),
  sessionKey: z.string().regex(/^[A-Za-z0-9+/]{22}==$/),
  peerAddress: address,
  channel: z.union([z.literal(5), z.literal(9)]),
  preamble: z.number().int().min(9).max(12),
  expiresAt: z.number().int().nonnegative(),
});
export type NativeUwbConfiguration = z.infer<typeof nativeUwbConfigurationSchema>;
const readySchema = z.strictObject({
  state: z.literal("READY"),
  role: z.enum(["CONTROLLER", "CONTROLEE"]),
  address,
  security: z.literal("PROVISIONED_STS"),
  channel: z.union([z.literal(5), z.literal(9)]).optional(),
  preamble: z.number().int().min(9).max(12).optional(),
});
const rangeSchema = z.strictObject({
  type: z.literal("nearby"),
  family: z.literal("UWB"),
  id: landfallId,
  peerId: landfallId,
  observedAt: z.number().int().nonnegative(),
  distanceMeters: z.number().finite().min(0).max(1000),
  uncertaintyMeters: z.null(),
  authenticated: z.literal(false),
  sessionProtected: z.literal(true),
});
export type NativeUwbProjection = {
  state:
    | "UNCONFIGURED"
    | "UNSUPPORTED"
    | "UNAVAILABLE"
    | "PROMPTABLE"
    | "INITIALIZING"
    | "READY"
    | "EXPIRED"
    | "UNTRUSTED";
  rangeAvailable: boolean;
  uncertainty: "UNKNOWN";
  peerVerified: false;
  canComplete: false;
};

/** STS-only measurements stay untrusted hints until first-party peer qualification exists. */
export class NativeLandfallUwbProvider {
  private generation = 0;
  private peer: string | null = null;
  private expiresAt = 0;
  private lastAt = -1;
  private timeout: ReturnType<typeof setTimeout> | undefined;
  private projection: NativeUwbProjection = this.empty("UNCONFIGURED");
  private listener: ((value: NativeUwbProjection) => void) | null = null;
  private stopLifecycle: (() => void) | null = null;
  private readonly receive = (event: Event) => {
    const value = (event as CustomEvent).detail;
    if (!this.peer || this.now() >= this.expiresAt) return;
    if (value?.type === "nearby-state" && value.family === "UWB" && value.state === "UNAVAILABLE") {
      void this.stop();
      return;
    }
    const parsed = rangeSchema.safeParse(value);
    if (
      !parsed.success ||
      parsed.data.peerId !== this.peer ||
      parsed.data.observedAt <= this.lastAt ||
      parsed.data.observedAt > this.now() + 1000 ||
      this.now() - parsed.data.observedAt > 10000
    )
      return;
    this.lastAt = parsed.data.observedAt;
    this.update({ ...this.empty("UNTRUSTED"), rangeAvailable: true });
  };
  constructor(
    worldspace: LandfallWorldspace,
    private readonly now = Date.now,
  ) {
    if (worldspace.kind !== "PHYSICAL") throw new Error("LANDFALL_UWB_REQUIRES_PHYSICAL_WORLDSPACE");
  }
  private empty(state: NativeUwbProjection["state"]): NativeUwbProjection {
    return { state, rangeAvailable: false, uncertainty: "UNKNOWN", peerVerified: false, canComplete: false };
  }
  private update(value: NativeUwbProjection) {
    this.projection = value;
    this.listener?.({ ...value });
  }
  snapshot(): NativeUwbProjection {
    return this.projection.rangeAvailable && this.now() - this.lastAt > 10000
      ? this.empty("UNAVAILABLE")
      : { ...this.projection };
  }
  async prepare(role: "CONTROLLER" | "CONTROLEE", userAction: boolean) {
    if (!userAction) throw new Error("LANDFALL_UWB_CONSENT_REQUIRED");
    await this.stop();
    const attempt = this.generation;
    if (!landfallNativeHost()) {
      this.update(this.empty("UNCONFIGURED"));
      return null;
    }
    this.update(this.empty("INITIALIZING"));
    try {
      const reply = await landfallNativeRequest("UWB_PREPARE", { role });
      if (attempt !== this.generation) return null;
      const ready = readySchema.safeParse(reply);
      if (
        ready.success &&
        ready.data.role === role &&
        (role !== "CONTROLLER" || (ready.data.channel !== undefined && ready.data.preamble !== undefined))
      ) {
        this.update(this.empty("READY"));
        return ready.data;
      }
      const parsed = z.object({ state: z.enum(["UNSUPPORTED", "UNAVAILABLE", "PROMPTABLE"]) }).safeParse(reply);
      this.update(this.empty(parsed.success ? parsed.data.state : "UNAVAILABLE"));
    } catch {
      if (attempt === this.generation) this.update(this.empty("UNAVAILABLE"));
    }
    return null;
  }
  async start(input: NativeUwbConfiguration, listener: (value: NativeUwbProjection) => void) {
    const configuration = nativeUwbConfigurationSchema.parse(input);
    if (
      !Number.isFinite(this.now()) ||
      configuration.expiresAt <= this.now() ||
      configuration.expiresAt - this.now() > 300000
    )
      throw new Error("LANDFALL_UWB_PAIRING_EXPIRED");
    if (this.projection.state !== "READY" || this.peer) throw new Error("LANDFALL_UWB_NOT_PREPARED");
    this.peer = configuration.peerId;
    this.expiresAt = configuration.expiresAt;
    this.listener = listener;
    window.addEventListener("landfall-native-event", this.receive);
    this.stopLifecycle = subscribeLandfallNativeLifecycle((state) => {
      if (state === "BACKGROUND") void this.stop();
    });
    this.timeout = setTimeout(() => {
      void this.stop().then(() => this.update(this.empty("EXPIRED")));
    }, configuration.expiresAt - this.now());
    const attempt = this.generation;
    this.update(this.empty("INITIALIZING"));
    try {
      const reply = z
        .object({ state: z.enum(["INITIALIZING", "UNAVAILABLE", "UNSUPPORTED"]) })
        .parse(await landfallNativeRequest("UWB_START", configuration));
      if (attempt !== this.generation) return;
      if (reply.state !== "INITIALIZING") {
        await this.stop();
        this.update(this.empty(reply.state));
      }
    } catch {
      if (attempt === this.generation) await this.stop();
    }
  }
  async stop() {
    this.generation++;
    clearTimeout(this.timeout);
    this.timeout = undefined;
    this.stopLifecycle?.();
    this.stopLifecycle = null;
    if (typeof window !== "undefined") window.removeEventListener("landfall-native-event", this.receive);
    this.peer = null;
    this.expiresAt = 0;
    this.lastAt = -1;
    this.update(this.empty("UNAVAILABLE"));
    this.listener = null;
    if (landfallNativeHost()) await landfallNativeRequest("UWB_STOP").catch(() => undefined);
  }
}

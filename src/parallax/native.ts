import { z } from "zod";
import { landfallNativeHost, landfallNativeRequest } from "@/landfall/native-bridge";
import { SextantPermissionBroker } from "@/sextant/permissions";
import { unknownState } from "@/sextant/contracts";
import { transformSchema, type Anchor, type Transform } from "./contracts";
import { composeTransform } from "./transforms";
import type { SpatialRuntimeAdapter, SpatialRuntimeEvent } from "./runtime";

const stateSchema = z.strictObject({
  supported: z.boolean(),
  permission: z.enum(["GRANTED", "DENIED", "PROMPT", "RESTRICTED"]),
});
const poseReply = z.strictObject({ pose: transformSchema.nullable() });
const trackingSchema = z.strictObject({
  type: z.literal("parallax-tracking"),
  state: z.enum([
    "INITIALIZING",
    "MAPPING",
    "NORMAL",
    "LIMITED_LOW_LIGHT",
    "LIMITED_EXCESSIVE_MOTION",
    "LIMITED_FEATURES",
    "RELOCALIZING",
    "INTERRUPTED",
    "LOST",
    "UNSUPPORTED",
  ]),
});
/** Generic permissions stay with Sextant. Parallax consumes world tracking and plane poses, not raw camera frames. */
export class NativeSpatialAdapter implements SpatialRuntimeAdapter {
  readonly providerId: string;
  readonly mode = "NATIVE" as const;
  readonly worldTracking = true;
  readonly planePlacement = true;
  private remove: (() => void) | undefined;
  private started = false;
  private signal: AbortSignal | undefined;
  readonly permissions = new SextantPermissionBroker(async () => {
    const r = stateSchema.parse(await landfallNativeRequest("SPATIAL_PERMISSION"));
    return r.permission;
  });
  constructor(private readonly selected: (entityId: string, type: "PICK" | "INSPECT" | "PLACE") => void = () => {}) {
    const host = landfallNativeHost();
    if (!host) throw new Error("PARALLAX_NATIVE_NOT_CONFIGURED");
    this.providerId = `parallax.${host.platform.toLowerCase()}.local.v1`;
  }
  async discover() {
    return stateSchema.parse(await landfallNativeRequest("SPATIAL_STATE"));
  }
  async authorize() {
    const permission = await this.permissions.authorize("CAMERA", {
      consumerId: "parallax",
      surfaceId: "chronicle-lens",
      purpose: "SPATIAL_VIEWING",
      consent: true,
      userInitiated: true,
      retry: true,
    });
    return {
      ...unknownState(),
      support: "SUPPORTED" as const,
      availability: "AVAILABLE" as const,
      permission,
      lifecycle: "FOREGROUND_ONLY" as const,
    };
  }
  async start(c: { signal: AbortSignal; emit: (e: SpatialRuntimeEvent) => void }) {
    if (c.signal.aborted) throw new Error("PARALLAX_NATIVE_ABORTED");
    this.signal = c.signal;
    const receive = (e: Event) => {
      if (c.signal.aborted) return;
      const data = (e as CustomEvent).detail;
      if (data?.type === "lifecycle" && data.state === "BACKGROUND") c.emit({ type: "TRACKING", state: "INTERRUPTED" });
      const parsed = trackingSchema.safeParse(data);
      if (parsed.success) c.emit({ type: "TRACKING", state: parsed.data.state });
      if (
        data?.type === "parallax-interaction" &&
        typeof data.entityId === "string" &&
        ["PICK", "INSPECT", "PLACE"].includes(data.interactionType)
      )
        this.selected(data.entityId, data.interactionType);
    };
    window.addEventListener("landfall-native-event", receive);
    this.remove = () => window.removeEventListener("landfall-native-event", receive);
    const result = z.strictObject({ accepted: z.boolean() }).parse(await landfallNativeRequest("SPATIAL_START"));
    if (!result.accepted) {
      this.remove();
      this.remove = undefined;
      throw new Error("PARALLAX_NATIVE_UNAVAILABLE");
    }
    this.started = true;
    if (c.signal.aborted) {
      await this.stop();
      throw new Error("PARALLAX_NATIVE_ABORTED");
    }
  }
  async resolve(anchor: Anchor) {
    if (anchor.kind === "FIXED_WORLDSPACE") return null;
    if (anchor.kind === "SURFACE_RELATIVE") {
      let pose: Transform | null = null;
      const until = Date.now() + 15000;
      while (!pose && Date.now() < until && !this.signal?.aborted) {
        pose = await this.place(anchor.alignment);
        if (!pose) await new Promise((resolve) => setTimeout(resolve, 150));
      }
      if (this.signal?.aborted) throw new Error("PARALLAX_NATIVE_ABORTED");
      return pose ? composeTransform(pose, anchor.transform) : null;
    }
    // Native local origin is +Y-up, -Z-forward; device-relative rendering requires an explicit live frame.
    if (anchor.kind === "DEVICE_RELATIVE") return null;
    return anchor.transform;
  }
  async place(alignment: "HORIZONTAL" | "VERTICAL") {
    const pose = poseReply.parse(await landfallNativeRequest("SPATIAL_PLACE", { alignment })).pose;
    // ARKit/ARCore plane frames use +Y as the surface normal; our text quads use +Z.
    return pose
      ? composeTransform(pose, {
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: -Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 },
          scale: 1,
        })
      : null;
  }
  async render(
    entities: readonly { id: string; kind: string; content: string; widthMeters: number; transform: Transform }[],
  ) {
    const response = z
      .strictObject({ accepted: z.boolean() })
      .parse(await landfallNativeRequest("SPATIAL_RENDER", { entities }));
    if (!response.accepted) throw new Error("PARALLAX_NATIVE_RENDER_FAILED");
  }
  async stop() {
    this.remove?.();
    this.remove = undefined;
    if (this.started) {
      this.started = false;
      await landfallNativeRequest("SPATIAL_STOP").catch(() => undefined);
    }
  }
}

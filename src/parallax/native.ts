import { z } from "zod";
import { landfallNativeHost, landfallNativeRequest } from "@/landfall/native-bridge";
import { SextantPermissionBroker } from "@/sextant/permissions";
import { unknownState } from "@/sextant/contracts";
import { resolvedTransformSchema, type Anchor, type Transform } from "./contracts";
import { encodeScene, sceneChunks, sceneDigest, sceneTransferLimits } from "./scene-transfer";
import { composeTransform } from "./transforms";
import type { RuntimeMode, SpatialRuntimeAdapter, SpatialRuntimeEvent } from "./runtime";
import type { SpatialVersion } from "./contracts";
import { encodeSceneDelivery, supportsSceneDelivery, type SceneDelivery } from "./scene-delivery";
import { runtimePresentableEntityIds } from "./behavior";

async function nativeRequest(
  operation: Parameters<typeof landfallNativeRequest>[0],
  payload: Record<string, unknown> = {},
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      landfallNativeRequest(operation, payload),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("PARALLAX_NATIVE_REQUEST_TIMEOUT")), 5000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

const stateSchema = z.strictObject({
  supported: z.boolean(),
  permission: z.enum(["GRANTED", "DENIED", "PROMPT", "RESTRICTED"]),
  sceneTransferVersion: z.literal(1).optional(),
  sceneDeliveryVersions: z
    .array(z.union([z.literal(1), z.literal(2)]))
    .max(2)
    .optional(),
  capabilities: z.array(z.string().min(1).max(80)).max(32).optional(),
  softwareFixture: z.enum(["SCENEKIT_CAMERA_FREE_V1", "FILAMENT_CAMERA_FREE_V1"]).optional(),
});
const poseReply = z.strictObject({ pose: resolvedTransformSchema.nullable() });
const trackingSchema = z.strictObject({
  type: z.literal("parallax-tracking"),
  sessionId: z.string(),
  epoch: z.number().int().positive(),
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
  readonly mode: RuntimeMode = "NATIVE";
  readonly worldTracking: boolean = true;
  readonly planePlacement: boolean = true;
  private remove: (() => void) | undefined;
  private started = false;
  private signal: AbortSignal | undefined;
  private sessionId = "";
  private epoch = 0;
  private generation = 0;
  private transferring: string | null = null;
  private removeAbort: (() => void) | undefined;
  private deliveryVersion: 1 | 2 = 1;
  private capabilities: string[] = ["WORLD_TRACKING", "PLANE_PLACEMENT"];
  readonly permissions = new SextantPermissionBroker(async () => {
    const r = stateSchema.parse(await nativeRequest("SPATIAL_PERMISSION"));
    return r.permission;
  });
  protected readonly interactionEvent: string = "parallax-interaction";
  constructor(
    private readonly selected: (
      entityId: string,
      type: "PICK" | "INSPECT" | "PLACE",
      signal: AbortSignal,
    ) => void = () => {},
  ) {
    const host = landfallNativeHost();
    if (!host) throw new Error("PARALLAX_NATIVE_NOT_CONFIGURED");
    this.providerId = `parallax.${host.platform.toLowerCase()}.local.v1`;
  }
  async discover() {
    const state = stateSchema.parse(await nativeRequest("SPATIAL_STATE"));
    this.deliveryVersion = state.sceneDeliveryVersions?.includes(2) ? 2 : 1;
    this.capabilities = state.capabilities ?? ["WORLD_TRACKING", "PLANE_PLACEMENT"];
    return { ...state, supported: state.supported && state.sceneTransferVersion === 1 };
  }
  supportsScene(scene: SpatialVersion) {
    const presentable = runtimePresentableEntityIds(scene);
    return (
      supportsSceneDelivery(scene, this.capabilities) &&
      (!scene.entities.some((e) => presentable.has(e.id) && e.element?.enabled) || this.deliveryVersion === 2)
    );
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
  async start(c: {
    signal: AbortSignal;
    emit: (e: SpatialRuntimeEvent) => void;
    sceneIdentity?: { versionChecksum: string; instanceId: string };
    scene?: SpatialVersion;
  }) {
    if (this.started || this.remove) throw new Error("PARALLAX_NATIVE_ALREADY_STARTED");
    if (c.signal.aborted) throw new Error("PARALLAX_NATIVE_ABORTED");
    this.signal = c.signal;
    const sessionId = (this.sessionId = crypto.randomUUID()),
      epoch = ++this.epoch;
    this.generation = 0;
    const interrupted = () => {
      if (sessionId !== this.sessionId) return;
      this.started = false;
      this.remove?.();
      this.remove = undefined;
      // Invalidate identity before a delayed START acknowledgment can revive it.
      void this.stop();
      c.emit({ type: "TRACKING", state: "INTERRUPTED" });
    };
    const receive = (e: Event) => {
      if (c.signal.aborted || sessionId !== this.sessionId) return;
      const data = (e as CustomEvent).detail;
      if (data?.type === "lifecycle" && data.state === "BACKGROUND") {
        interrupted();
        return;
      }
      if (data?.sessionId !== sessionId || data?.epoch !== epoch) return;
      const parsed = trackingSchema.safeParse(data);
      if (parsed.success) {
        if (parsed.data.state === "INTERRUPTED") interrupted();
        else if (this.started && this.mode !== "SIMULATED") c.emit({ type: "TRACKING", state: parsed.data.state });
      }
      if (
        this.started &&
        data?.type === this.interactionEvent &&
        (this.mode !== "SIMULATED" || data.synthetic === true) &&
        typeof data.entityId === "string" &&
        ["PICK", "INSPECT", "PLACE"].includes(data.interactionType)
      )
        this.selected(data.entityId, data.interactionType, c.signal);
    };
    window.addEventListener("landfall-native-event", receive);
    this.remove = () => window.removeEventListener("landfall-native-event", receive);
    const abort = () => {
      void this.stop();
    };
    c.signal.addEventListener("abort", abort, { once: true });
    this.removeAbort = () => c.signal.removeEventListener("abort", abort);
    try {
      const result = z
        .strictObject({
          accepted: z.boolean(),
          sceneTransferVersion: z.union([z.literal(1), z.literal(2)]),
          sessionId: z.string(),
          epoch: z.number(),
        })
        .parse(
          await nativeRequest("SPATIAL_START", {
            sessionId,
            epoch,
            sceneTransferVersion: this.deliveryVersion,
            ...c.sceneIdentity,
          }),
        );
      if (
        !result.accepted ||
        result.sessionId !== sessionId ||
        result.epoch !== epoch ||
        result.sceneTransferVersion !== this.deliveryVersion
      )
        throw new Error("PARALLAX_NATIVE_UNAVAILABLE");
      if (c.signal.aborted || this.sessionId !== sessionId) throw new Error("PARALLAX_NATIVE_ABORTED");
      this.started = true;
    } catch (error) {
      await nativeRequest("SPATIAL_STOP", { sessionId, epoch }).catch(() => undefined);
      if (this.sessionId === sessionId) await this.stop();
      throw error;
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
    if (!this.started) throw new Error("PARALLAX_NATIVE_STOPPED");
    const pose = poseReply.parse(
      await nativeRequest("SPATIAL_PLACE", { alignment, sessionId: this.sessionId, epoch: this.epoch }),
    ).pose;
    // Every v2 entity shares the provider's +Y surface normal. Legacy quad
    // geometry applies its own child correction; v1 retains its original frame.
    return pose && this.deliveryVersion === 2
      ? pose
      : pose
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
    const bytes = encodeScene([...entities] as Parameters<typeof encodeScene>[0]);
    return this.transfer(bytes, 1);
  }
  async renderScene(scene: SceneDelivery) {
    if (this.deliveryVersion === 1) {
      if (scene.entities.some((e) => e.element?.enabled)) throw new Error("PARALLAX_NATIVE_SCENE_UNSUPPORTED");
      return this.render(
        scene.entities
          .filter((e) => e.visible)
          .map(({ id, kind, content, widthMeters, transform }) => ({ id, kind, content, widthMeters, transform })),
      );
    }
    if (!this.supportsDeliveryRequirements(scene.requirements))
      throw new Error("PARALLAX_NATIVE_CAPABILITY_UNAVAILABLE");
    return this.transfer(encodeSceneDelivery(scene), 2);
  }
  protected supportsDeliveryRequirements(requirements: readonly string[]) {
    return requirements.every((r) => this.capabilities.includes(r));
  }
  private async transfer(bytes: Uint8Array, version: 1 | 2) {
    if (!this.started || this.transferring) throw new Error("PARALLAX_NATIVE_TRANSFER_UNAVAILABLE");
    const identity = {
      sessionId: this.sessionId,
      epoch: this.epoch,
      transactionId: crypto.randomUUID(),
      generation: ++this.generation,
    };
    this.transferring = identity.transactionId;
    const until = Date.now() + sceneTransferLimits.timeoutMs;
    try {
      const chunks = sceneChunks(bytes),
        digest = await sceneDigest(bytes);
      if (!this.started || this.sessionId !== identity.sessionId || this.signal?.aborted)
        throw new Error("PARALLAX_NATIVE_STOPPED");
      const send = async (
        operation: "SPATIAL_SCENE_BEGIN" | "SPATIAL_SCENE_CHUNK" | "SPATIAL_SCENE_COMMIT",
        payload: Record<string, unknown> = {},
      ) => {
        if (!this.started || this.signal?.aborted || this.sessionId !== identity.sessionId || Date.now() >= until)
          throw new Error("PARALLAX_NATIVE_TRANSFER_CANCELLED");
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          const response = z.strictObject({ accepted: z.boolean() }).parse(
            await Promise.race([
              landfallNativeRequest(operation, { ...identity, ...payload }),
              new Promise((_, reject) => {
                timer = setTimeout(
                  () => reject(new Error("PARALLAX_NATIVE_TRANSFER_TIMEOUT")),
                  operation === "SPATIAL_SCENE_COMMIT" && version === 2 ? 60000 : Math.min(5000, until - Date.now()),
                );
              }),
            ]),
          );
          if (!response.accepted || !this.started || this.sessionId !== identity.sessionId || this.signal?.aborted)
            throw new Error("PARALLAX_NATIVE_RENDER_FAILED");
        } finally {
          clearTimeout(timer);
        }
      };
      await send("SPATIAL_SCENE_BEGIN", {
        sceneTransferVersion: version,
        totalBytes: bytes.length,
        chunkCount: chunks.length,
        digest,
      });
      for (let index = 0; index < chunks.length; index++)
        await send("SPATIAL_SCENE_CHUNK", { index, data: chunks[index] });
      await send("SPATIAL_SCENE_COMMIT");
    } catch (error) {
      await nativeRequest("SPATIAL_SCENE_ABORT", identity).catch(() => undefined);
      // A failed activation cannot leave a provider displaying an uncertain scene.
      // Preserve a newer session when a previous transfer finishes cancellation late.
      if (this.sessionId === identity.sessionId) await this.stop();
      throw error;
    } finally {
      if (this.transferring === identity.transactionId) this.transferring = null;
    }
  }
  async stop() {
    this.remove?.();
    this.remove = undefined;
    this.removeAbort?.();
    this.removeAbort = undefined;
    const sessionId = this.sessionId,
      epoch = this.epoch;
    this.sessionId = "";
    this.transferring = null;
    this.started = false;
    if (sessionId) await nativeRequest("SPATIAL_STOP", { sessionId, epoch }).catch(() => undefined);
  }
}

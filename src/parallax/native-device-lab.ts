import { landfallNativeHost } from "@/landfall/native-bridge";
import type { Anchor, SpatialVersion } from "./contracts";
import { NativeSpatialAdapter } from "./native";
import { sceneRequirements } from "./scene-delivery";

/** Explicit Device Lab adapter, never selected by the ordinary Player runtime.
 * The native host independently requires its DEBUG, simulator and validated
 * loopback opt-ins. Scene geometry is simulated; no AR pose is manufactured.
 */
export class NativeDeviceLabSpatialAdapter extends NativeSpatialAdapter {
  override readonly mode = "SIMULATED" as const;
  override readonly worldTracking = false;
  override readonly planePlacement = false;
  override readonly providerId = "parallax.native.camera-free.device-lab.v1";
  protected override readonly interactionEvent = "parallax-lab-interaction";
  private admitted = false;

  override async discover() {
    const state = await super.discover();
    const platform = landfallNativeHost()?.platform;
    this.admitted =
      (platform === "IOS" && state.softwareFixture === "SCENEKIT_CAMERA_FREE_V1") ||
      (platform === "ANDROID" && state.softwareFixture === "FILAMENT_CAMERA_FREE_V1");
    return { ...state, supported: this.admitted };
  }

  override supportsScene(scene: SpatialVersion) {
    return (
      this.admitted &&
      !scene.adaptive &&
      sceneRequirements(scene).every((capability) =>
        ["WORLD_TRACKING", "PLANE_PLACEMENT", "MODEL_GLB"].includes(capability),
      )
    );
  }

  protected override supportsDeliveryRequirements(requirements: readonly string[]) {
    // An authored frame is evaluated as simulation here. It never promotes the
    // native host's denied camera/AR capabilities or production receipt mode.
    return this.admitted && requirements.every((r) => ["WORLD_TRACKING", "PLANE_PLACEMENT", "MODEL_GLB"].includes(r));
  }

  override async start(input: Parameters<NativeSpatialAdapter["start"]>[0]) {
    if (!this.admitted) throw new Error("PARALLAX_CAMERA_FREE_DEVICE_LAB_NOT_ADMITTED");
    await super.start(input);
  }

  override async resolve(anchor: Anchor) {
    if (anchor.kind === "DEVICE_RELATIVE" || anchor.kind === "FIXED_WORLDSPACE") return null;
    return structuredClone(anchor.transform);
  }

  override async place() {
    return null;
  }
}

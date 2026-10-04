import { z } from "zod";
import { NativeLocationProvider, type NativeLocationDriver } from "@/landfall/native-location";
import type { LandfallWorldspace } from "@/landfall/schema";
import type { LandfallObservation } from "@/landfall/observation";
import type { ForegroundPermission } from "@/landfall/browser-geolocation";
import { permissionStateSchema } from "@/landfall/provider-policy";

type NativeHost = { platform: "IOS" | "ANDROID"; version: 1; request(message: string): Promise<unknown> };
declare global {
  interface Window {
    LandfallNative?: NativeHost;
  }
}
const replySchema = z.object({ state: permissionStateSchema.optional(), accepted: z.boolean().optional() });
export const nativeLandfallPowerSchema = z
  .strictObject({
    state: z.enum(["READY", "UNAVAILABLE"]),
    lowPower: z.boolean(),
    thermalPressure: z.boolean(),
    critical: z.boolean(),
    observedAt: z.number().int().nonnegative(),
  })
  .refine((value) => !value.critical || value.thermalPressure);
export type NativeLandfallPower = z.infer<typeof nativeLandfallPowerSchema>;
function currentPower(input: unknown): NativeLandfallPower | null {
  const parsed = nativeLandfallPowerSchema.safeParse(input);
  return parsed.success && parsed.data.observedAt <= Date.now() + 1000 && Date.now() - parsed.data.observedAt <= 30000
    ? parsed.data
    : null;
}
export async function readNativeLandfallPower(): Promise<NativeLandfallPower | null> {
  try {
    return currentPower(await landfallNativeRequest("POWER_STATE"));
  } catch {
    return null;
  }
}
export function subscribeNativeLandfallPower(listener: (power: NativeLandfallPower) => void) {
  if (typeof window === "undefined") return () => undefined;
  const receive = (event: Event) => {
    const value = (event as CustomEvent).detail;
    const power = value?.type === "power" ? currentPower(value.power) : null;
    if (power) listener(power);
  };
  window.addEventListener("landfall-native-event", receive);
  return () => window.removeEventListener("landfall-native-event", receive);
}
export function landfallNativeHost(): NativeHost | null {
  if (typeof window === "undefined") return null;
  const host = window.LandfallNative;
  return host?.version === 1 && ["IOS", "ANDROID"].includes(host.platform) && typeof host.request === "function"
    ? host
    : null;
}
/** Native lifecycle is independent of WebView document visibility on mobile OSes. */
export function subscribeLandfallNativeLifecycle(listener: (state: "FOREGROUND" | "BACKGROUND") => void) {
  if (typeof window === "undefined") return () => undefined;
  const receive = (event: Event) => {
    const value = (event as CustomEvent).detail;
    if (value?.type === "lifecycle" && (value.state === "FOREGROUND" || value.state === "BACKGROUND"))
      listener(value.state);
  };
  window.addEventListener("landfall-native-event", receive);
  return () => window.removeEventListener("landfall-native-event", receive);
}
export async function landfallNativeRequest(
  operation:
    | "LOCATION_PERMISSION"
    | "LOCATION_PERMISSION_STATE"
    | "LOCATION_STATE"
    | "LOCATION_START"
    | "LOCATION_STOP"
    | "BACKGROUND_PERMISSION"
    | "NOTIFICATION_PERMISSION"
    | "GEOFENCE_REGISTER"
    | "GEOFENCE_CLEAR"
    | "SENSORS_START"
    | "SENSORS_STOP"
    | "BLE_START"
    | "BLE_STOP"
    | "UWB_STATE"
    | "UWB_PREPARE"
    | "UWB_START"
    | "UWB_STOP"
    | "NI_STATE"
    | "NI_PREPARE"
    | "NI_START"
    | "NI_STOP"
    | "NFC_READ"
    | "QR_SCAN"
    | "POWER_STATE"
    | "CLEAR_PRIVATE_DATA"
    | "PRIVATE_STORE_PUT"
    | "PRIVATE_STORE_GET"
    | "PRIVATE_STORE_LIST"
    | "PRIVATE_STORE_DELETE",
  payload: Record<string, unknown> = {},
) {
  const host = landfallNativeHost();
  if (!host) throw new Error("LANDFALL_NATIVE_NOT_CONFIGURED");
  const message = JSON.stringify({ version: 1, id: crypto.randomUUID(), operation, payload });
  if (message.length > 16 * 1024) throw new Error("LANDFALL_NATIVE_REQUEST_TOO_LARGE");
  return host.request(message);
}
export function createLandfallNativeDriver(): NativeLocationDriver | null {
  const host = landfallNativeHost();
  if (!host) return null;
  return {
    platform: host.platform,
    permission: async () =>
      replySchema.parse(await landfallNativeRequest("LOCATION_PERMISSION")).state ?? "UNAVAILABLE",
    readPermission: async () =>
      replySchema.parse(await landfallNativeRequest("LOCATION_PERMISSION_STATE")).state ?? "UNAVAILABLE",
    readAcquisition: async () => landfallNativeRequest("LOCATION_STATE"),
    start: async (options) => {
      const reply = replySchema.parse(await landfallNativeRequest("LOCATION_START", options));
      if (!reply.accepted) throw new Error("LANDFALL_NATIVE_LOCATION_UNAVAILABLE");
    },
    stop: async () => {
      await landfallNativeRequest("LOCATION_STOP").catch(() => undefined);
    },
    subscribe: (listener) => {
      const receive = (event: Event) => {
        const input = (event as CustomEvent).detail;
        if (!input || typeof input !== "object") return;
        if (input.type === "fix") listener({ type: "fix", fix: input.fix });
        if (input.type === "permission") {
          const parsed = permissionStateSchema.safeParse(input.state);
          if (parsed.success) listener({ type: "permission", state: parsed.data });
        }
        if (input.type === "error") listener({ type: "error" });
      };
      window.addEventListener("landfall-native-event", receive);
      return () => window.removeEventListener("landfall-native-event", receive);
    },
  };
}
/** Matches the existing Player foreground-provider lifecycle; both paths use the canonical qualifier. */
export class NativeForegroundLocationProvider {
  private readonly provider: NativeLocationProvider;
  constructor(driver: NativeLocationDriver, worldspace: LandfallWorldspace) {
    this.provider = new NativeLocationProvider(driver, worldspace);
  }
  get active() {
    return this.provider.active;
  }
  get permissionState(): ForegroundPermission {
    const state = this.provider.permissionState;
    return ["GRANTED", "APPROXIMATE", "LIMITED"].includes(state)
      ? "GRANTED"
      : state === "DENIED"
        ? "DENIED"
        : "UNAVAILABLE";
  }
  start(
    identity: { sessionId: string; publishedVersionId: string },
    emit: (observation: LandfallObservation) => void,
    onState: (state: ForegroundPermission) => void,
  ) {
    void this.provider.start(identity, { userAction: true, intervalMs: 5000, precise: true }, emit, (state) =>
      onState(
        ["GRANTED", "APPROXIMATE", "LIMITED"].includes(state)
          ? "GRANTED"
          : state === "DENIED"
            ? "DENIED"
            : "UNAVAILABLE",
      ),
    );
  }
  stop() {
    void this.provider.stop();
  }
}
if (typeof window !== "undefined")
  window.addEventListener("landfall-offline-cleared", () => {
    if (landfallNativeHost()) void landfallNativeRequest("CLEAR_PRIVATE_DATA").catch(() => undefined);
  });

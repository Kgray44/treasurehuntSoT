import { z } from "zod";

export const deviceLabProfileSchema = z.enum(["primary-phone", "compatibility-phone", "low-resource", "tablet"]);
export type DeviceLabProfile = z.infer<typeof deviceLabProfileSchema>;
export const deviceLabConfigurationSchema = z.discriminatedUnion("platform", [
  z.strictObject({
    platform: z.literal("ANDROID"),
    virtual: z.literal(true),
    api: z.number().int().min(26).max(99),
    model: z.string().min(1).max(120),
    memoryKiB: z
      .number()
      .int()
      .positive()
      .max(64 * 1024 * 1024),
    widthPixels: z.number().int().min(240).max(10000),
    heightPixels: z.number().int().min(240).max(10000),
    densityDpi: z.number().int().min(80).max(1000),
  }),
  z.strictObject({
    platform: z.literal("IOS"),
    virtual: z.literal(true),
    runtime: z.string().regex(/^com\.apple\.CoreSimulator\.SimRuntime\.iOS-[0-9-]+$/),
    deviceType: z.string().regex(/^com\.apple\.CoreSimulator\.SimDeviceType\.[A-Za-z0-9-]+$/),
  }),
]);
export type DeviceLabConfiguration = z.infer<typeof deviceLabConfigurationSchema>;

/** A profile is a checked provisioning claim, never a freely chosen receipt label. */
export function validateDeviceLabProfile(profile: DeviceLabProfile, input: DeviceLabConfiguration) {
  const configuration = deviceLabConfigurationSchema.parse(input);
  if (configuration.platform === "ANDROID") {
    const tablet =
      (Math.min(configuration.widthPixels, configuration.heightPixels) * 160) / configuration.densityDpi >= 600;
    const valid =
      profile === "tablet"
        ? tablet && configuration.api === 36
        : !tablet &&
          (profile === "compatibility-phone"
            ? configuration.api === 35
            : configuration.api === 36 && (profile !== "low-resource" || configuration.memoryKiB <= 2 * 1024 * 1024));
    if (!valid) throw new Error("LANDFALL_LAB_PROFILE_MISMATCH");
  } else {
    if (profile === "low-resource") throw new Error("LANDFALL_LAB_IOS_RESOURCE_CONTROL_UNSUPPORTED");
    const tablet = configuration.deviceType.includes("iPad");
    if (tablet !== (profile === "tablet") || (!tablet && !configuration.deviceType.includes("iPhone")))
      throw new Error("LANDFALL_LAB_PROFILE_MISMATCH");
  }
  return configuration;
}

export function selectAppleLabDevice(
  profile: DeviceLabProfile,
  available: readonly { identifier: string; name: string }[],
) {
  if (profile === "low-resource") throw new Error("LANDFALL_LAB_IOS_RESOURCE_CONTROL_UNSUPPORTED");
  const devices = available
    .filter((device) =>
      profile === "tablet" ? device.name.includes("iPad") : /iPhone (?:[0-9]+|SE)/.test(device.name),
    )
    .sort((a, b) => {
      const generation = (name: string) => Number(/iPhone ([0-9]+)/.exec(name)?.[1] ?? 0);
      return generation(a.name) - generation(b.name) || a.name.localeCompare(b.name, undefined, { numeric: true });
    });
  if (profile === "compatibility-phone" && new Set(devices.map((device) => device.identifier)).size < 2)
    throw new Error("LANDFALL_APPLE_COMPATIBILITY_DEVICE_UNAVAILABLE");
  const device = profile === "compatibility-phone" ? devices[0] : devices.at(-1);
  if (!device) throw new Error("LANDFALL_APPLE_DEVICE_TYPE_UNAVAILABLE");
  return device;
}

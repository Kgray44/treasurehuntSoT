import { describe, expect, it } from "vitest";
import { selectAppleLabDevice, validateDeviceLabProfile } from "@/landfall/device-lab/device-profile";

describe("measured Device Lab profiles", () => {
  const phone = {
    platform: "ANDROID" as const,
    virtual: true as const,
    api: 36,
    model: "synthetic Pixel",
    memoryKiB: 3 * 1024 * 1024,
    widthPixels: 1080,
    heightPixels: 2400,
    densityDpi: 420,
  };
  it("rejects relabeling the current device as a previous OS or a smaller memory allocation", () => {
    expect(validateDeviceLabProfile("primary-phone", phone)).toEqual(phone);
    expect(() => validateDeviceLabProfile("compatibility-phone", phone)).toThrow("PROFILE_MISMATCH");
    expect(() => validateDeviceLabProfile("low-resource", phone)).toThrow("PROFILE_MISMATCH");
    expect(validateDeviceLabProfile("compatibility-phone", { ...phone, api: 35 })).toMatchObject({ api: 35 });
    expect(validateDeviceLabProfile("low-resource", { ...phone, memoryKiB: 1536 * 1024 })).toMatchObject({
      memoryKiB: 1536 * 1024,
    });
  });
  it("checks tablet dimensions in density-independent units", () => {
    expect(() => validateDeviceLabProfile("tablet", phone)).toThrow("PROFILE_MISMATCH");
    const tablet = { ...phone, widthPixels: 1600, heightPixels: 2560, densityDpi: 240 };
    expect(validateDeviceLabProfile("tablet", tablet)).toEqual(tablet);
    expect(() => validateDeviceLabProfile("primary-phone", tablet)).toThrow("PROFILE_MISMATCH");
  });
  it("selects actually available Apple device types and rejects unsupported resource claims", () => {
    const types = [
      { identifier: "com.apple.CoreSimulator.SimDeviceType.iPhone-17", name: "iPhone 17" },
      { identifier: "com.apple.CoreSimulator.SimDeviceType.iPhone-16", name: "iPhone 16" },
      { identifier: "com.apple.CoreSimulator.SimDeviceType.iPad-Pro", name: "iPad Pro" },
    ];
    expect(selectAppleLabDevice("primary-phone", types).name).toBe("iPhone 17");
    expect(selectAppleLabDevice("compatibility-phone", types).name).toBe("iPhone 16");
    expect(selectAppleLabDevice("tablet", types).name).toBe("iPad Pro");
    expect(() => selectAppleLabDevice("low-resource", types)).toThrow("UNSUPPORTED");
    expect(() => selectAppleLabDevice("tablet", types.slice(0, 2))).toThrow("UNAVAILABLE");
    expect(() => selectAppleLabDevice("compatibility-phone", types.slice(0, 1))).toThrow(
      "COMPATIBILITY_DEVICE_UNAVAILABLE",
    );
  });
});

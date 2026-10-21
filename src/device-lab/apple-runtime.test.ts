// @vitest-environment node
import { describe, expect, it } from "vitest";
import { appleMinimumIosFromProject, selectLatestSupportedAppleRuntime } from "./apple-runtime";

const runtime = (version: string, available = true) => ({
  id: `com.apple.CoreSimulator.SimRuntime.iOS-${version}`,
  available,
});
const device = (version: string, available = true) => ({ runtime: runtime(version).id, available });

describe("shared latest-supported Apple runtime selection", () => {
  it("uses the source deployment floor without inventing a runtime or device", () => {
    expect(appleMinimumIosFromProject('options:\n  deploymentTarget:\n    iOS: "16.0"\n')).toBe("16.0");
    expect(appleMinimumIosFromProject('options:\r\n  deploymentTarget:\r\n    iOS: "26.5"\r\n')).toBe("26.5");
    for (const source of ["", 'macOS: "26.5"', '    iOS: "unsupported"'])
      expect(() => appleMinimumIosFromProject(source)).toThrow("LANDFALL_APPLE_DEPLOYMENT_TARGET_UNAVAILABLE");
  });

  it("reproduces the retained inventory mismatch without selecting its first older entry", () => {
    const inventory = {
      runtimes: [runtime("26-2"), runtime("26-4"), runtime("26-5")],
      devices: [device("26-2"), device("26-4"), device("26-5")],
    };
    const before = structuredClone(inventory);
    expect(selectLatestSupportedAppleRuntime(inventory, "16.0")).toBe(inventory.runtimes[2]);
    expect(inventory).toEqual(before);
    expect(
      selectLatestSupportedAppleRuntime({ ...inventory, runtimes: [...inventory.runtimes].reverse() }, "16.0").id,
    ).toBe(runtime("26-5").id);
  });

  it("orders versions numerically and accepts the exact minimum boundary", () => {
    const inventory = { runtimes: [runtime("26-9"), runtime("26-10")], devices: [device("26-9"), device("26-10")] };
    expect(selectLatestSupportedAppleRuntime(inventory, "26.10").id).toBe(runtime("26-10").id);
    expect(() => selectLatestSupportedAppleRuntime(inventory, "26.11")).toThrow("LANDFALL_APPLE_RUNTIME_UNAVAILABLE");
  });

  it("requires available iOS runtime and a matching available device", () => {
    const inventory = {
      runtimes: [
        runtime("26-5"),
        runtime("26-6", false),
        runtime("26-7"),
        runtime("26-8"),
        { id: "com.apple.CoreSimulator.SimRuntime.tvOS-99-0", available: true },
      ],
      devices: [
        device("26-5"),
        device("26-6"),
        device("26-7", false),
        { runtime: "com.apple.CoreSimulator.SimRuntime.tvOS-99-0", available: true },
      ],
    };
    expect(selectLatestSupportedAppleRuntime(inventory, "16.0").id).toBe(runtime("26-5").id);
    expect(() => selectLatestSupportedAppleRuntime({ ...inventory, devices: [] }, "16.0")).toThrow(
      "LANDFALL_APPLE_RUNTIME_UNAVAILABLE",
    );
    expect(() => selectLatestSupportedAppleRuntime({ runtimes: [], devices: inventory.devices }, "16.0")).toThrow(
      "LANDFALL_APPLE_RUNTIME_UNAVAILABLE",
    );
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startOwnedAndroidFusedInput } from "../../../scripts/landfall/device-lab/android-fused-input";

describe("owned synthetic FLP input boundaries", () => {
  beforeEach(() => {
    vi.stubEnv("GITHUB_ACTIONS", "true");
    vi.stubEnv("RUNNER_ENVIRONMENT", "github-hosted");
  });
  afterEach(() => vi.unstubAllEnvs());
  it("rejects local hosts before issuing any device command", async () => {
    vi.stubEnv("GITHUB_ACTIONS", "false");
    const adb = vi.fn();
    await expect(startOwnedAndroidFusedInput(adb, "owned-root")).rejects.toThrow("HOSTED_EPHEMERAL");
    expect(adb).not.toHaveBeenCalled();
  });
  it("rejects physical hardware before installing or selecting a mock app", async () => {
    const adb = vi.fn(async () => "physical-hardware");
    await expect(startOwnedAndroidFusedInput(adb, "owned-root")).rejects.toThrow("EMULATOR_REQUIRED");
    expect(adb).toHaveBeenCalledTimes(1);
    expect(adb).toHaveBeenCalledWith(["shell", "getprop", "ro.hardware"]);
  });
  it("rejects foreign receipts and unbounded data instead of inferring successful input", async () => {
    let receipt = "x".repeat(1025);
    const adb = vi.fn(async (args: string[]) =>
      args.includes("ro.hardware") ? "ranchu" : args.includes("cat") ? receipt : "Success",
    );
    const input = await startOwnedAndroidFusedInput(adb, "owned-root");
    await expect(input.read()).rejects.toThrow("TOO_LARGE");
    receipt = JSON.stringify({
      sessionId: "00000000-0000-4000-8000-000000000001",
      phase: "STOP",
      state: "STOPPED",
      delivered: 0,
      mocking: false,
      synthetic: true,
      canComplete: false,
    });
    await expect(input.read()).rejects.toThrow("FOREIGN");
  });
  it("does not clear the lab app when actual mock-mode shutdown fails", async () => {
    let sessionId = "";
    const adb = vi.fn(async (args: string[]) => {
      if (args.includes("ro.hardware")) return "ranchu";
      if (args.includes("start-foreground-service")) sessionId = args[args.indexOf("labSession") + 1];
      if (args.includes("cat"))
        return JSON.stringify({
          sessionId,
          phase: "STOP",
          state: "STOP_FAILED",
          delivered: 0,
          mocking: true,
          synthetic: true,
          canComplete: false,
        });
      return "Success";
    });
    const input = await startOwnedAndroidFusedInput(adb, "owned-root");
    await expect(input.cleanup()).rejects.toThrow("STOP_FAILED");
    expect(adb.mock.calls.some(([args]) => args.includes("clear"))).toBe(false);
    expect(adb.mock.calls.some(([args]) => args.includes("force-stop"))).toBe(false);
  });
});

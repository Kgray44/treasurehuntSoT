import { afterEach, describe, expect, it, vi } from "vitest";
import { deliverDeviceLabPosition } from "../../../scripts/landfall/device-lab/location-control";
import { inspectOwnedAndroidLocationAccuracy } from "../../../scripts/landfall/device-lab/android-location-settings";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});
describe("owned public Location Accuracy controls", () => {
  const node = (text: string, className = "android.widget.TextView", checked = "") =>
    `<node text="${text}" bounds="[0,0][200,80]" checked="${checked}" class="${className}" package="com.android.settings"/>`;
  it("waits for the actual service entry and verifies the changed switch", async () => {
    vi.useFakeTimers();
    vi.stubEnv("GITHUB_ACTIONS", "true");
    vi.stubEnv("RUNNER_ENVIRONMENT", "github-hosted");
    const screens = [
      node("Location services"),
      "<hierarchy/>",
      node("Location Accuracy"),
      node("Improve location accuracy") + node("", "android.widget.Switch", "false"),
      node("Improve location accuracy") + node("", "android.widget.Switch", "true"),
    ];
    const adb = vi.fn(async (args: string[]) =>
      args.includes("ro.hardware") ? "ranchu" : args.includes("cat") ? (screens.shift() ?? "<hierarchy/>") : "",
    );
    const pending = inspectOwnedAndroidLocationAccuracy(adb);
    await vi.advanceTimersByTimeAsync(5000);
    expect(await pending).toMatchObject({
      screens: 5,
      accuracyEntryObserved: true,
      accuracyControlObserved: true,
      accuracySwitchBefore: "DISABLED",
      accuracySwitchAfter: "ENABLED",
      changed: true,
    });
    expect(adb.mock.calls.filter(([args]) => args.includes("tap"))).toHaveLength(3);
  });
  it("ends the entry wait without claiming readiness or tapping an absent control", async () => {
    vi.useFakeTimers();
    vi.stubEnv("GITHUB_ACTIONS", "true");
    vi.stubEnv("RUNNER_ENVIRONMENT", "github-hosted");
    let reads = 0;
    const adb = vi.fn(async (args: string[]) =>
      args.includes("ro.hardware")
        ? "ranchu"
        : args.includes("cat")
          ? reads++ === 0
            ? node("Location services")
            : "<hierarchy/>"
          : "",
    );
    const pending = inspectOwnedAndroidLocationAccuracy(adb);
    await vi.advanceTimersByTimeAsync(25000);
    expect(await pending).toMatchObject({
      accuracyEntryObserved: false,
      accuracyControlObserved: false,
      accuracySwitchAfter: "UNOBSERVED",
      changed: false,
    });
    expect(adb.mock.calls.filter(([args]) => args.includes("tap"))).toHaveLength(1);
    expect(reads).toBeLessThan(50);
  });
});

describe("bounded OS position delivery", () => {
  it("stops as soon as the current step completes", async () => {
    let time = 0;
    let delivered = 0;
    expect(
      await deliverDeviceLabPosition({
        inject: async () => {
          delivered++;
        },
        completed: () => delivered === 2,
        now: () => time,
        sleep: async (ms) => {
          time += ms;
        },
      }),
    ).toEqual({ injections: 2, elapsedMs: 1000, budgetMs: 120000, completed: true });
  });
  it("ends at the original observation budget without inventing success", async () => {
    let time = 0;
    const result = await deliverDeviceLabPosition({
      inject: async () => {},
      completed: () => false,
      now: () => time,
      sleep: async (ms) => {
        time += ms;
      },
      budgetMs: 2000,
    });
    expect(result).toEqual({ injections: 2, elapsedMs: 2000, budgetMs: 2000, completed: false });
  });
  it("propagates a control failure and never retries the command", async () => {
    let calls = 0;
    await expect(
      deliverDeviceLabPosition({
        inject: async () => {
          calls++;
          throw new Error("OS_CONTROL_FAILED");
        },
        completed: () => false,
      }),
    ).rejects.toThrow("OS_CONTROL_FAILED");
    expect(calls).toBe(1);
  });
});

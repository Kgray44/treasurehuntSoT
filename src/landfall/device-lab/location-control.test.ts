import { describe, expect, it } from "vitest";
import { deliverDeviceLabPosition } from "../../../scripts/landfall/device-lab/location-control";

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

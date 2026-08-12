import { describe, expect, it } from "vitest";
import { advanceDrydockVirtualClock, createDrydockVirtualClock } from "@/drydock/simulation/clock";

describe("Drydock virtual clock", () => {
  it("advances deterministically without waiting for wall-clock time", () => {
    const initial = createDrydockVirtualClock("2026-08-12T00:00:00.000Z");
    const advanced = advanceDrydockVirtualClock(initial, 90_000, 120_000);

    expect(initial.currentAt).toBe("2026-08-12T00:00:00.000Z");
    expect(advanced).toMatchObject({ currentAt: "2026-08-12T00:01:30.000Z", elapsedMilliseconds: 90_000 });
  });

  it("fails closed when a scenario crosses its declared virtual-time limit", () => {
    const initial = createDrydockVirtualClock("2026-08-12T00:00:00.000Z");
    expect(() => advanceDrydockVirtualClock(initial, 1_001, 1_000)).toThrow("limit exhausted");
  });
});

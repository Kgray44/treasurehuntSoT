import { describe, expect, it } from "vitest";
import { nativeCpuSnapshot, nativeCpuMeasurement } from "./native-cpu-measurement";
// @sounding-line-registration owner=project-landfall suite=unit.landfall-device-lab contracts=landfall.device-lab-evidence
const process = (user: number, kernel: number, start = 123) =>
  `1234 (private name with ) parentheses) S 1 1 1 1 1 1 1 1 1 1 ${user} ${kernel} 1 1 1 1 1 1 ${start} 1 1`;
describe("actual native Journal CPU measurement boundary", () => {
  it("measures guest capacity without double counting guest fields or exporting private names", () => {
    const before = nativeCpuSnapshot("cpu 100 20 30 400 10 5 10 5 50 10\ncpu0 0", process(20, 10));
    const after = nativeCpuSnapshot("cpu 150 20 50 510 15 5 20 10 90 10", process(25, 15));
    const result = nativeCpuMeasurement(before, after, 15000);
    expect(result.nativeParentCpuPercent).toBe(5);
    expect(result.wholeGuestActiveCpuPercent).toBe(40);
    expect(JSON.stringify(result)).not.toMatch(/private|1234|processStart|processTicks/);
  });
  it("rejects inaccessible, malformed and negative counters without exporting raw tool output", () => {
    for (const raw of ["Permission denied", "cpu 1 2", "cpu -1 0 0 0 0 0 0 0", "cpu 9007199254740992 0 0 0 0 0 0 0"])
      expect(() => nativeCpuSnapshot(raw, process(1, 1))).toThrow("NATIVE_CPU_COUNTERS");
    expect(() => nativeCpuSnapshot("cpu 1 2 3 4 5 6 7 8", "private-token")).toThrow("NATIVE_CPU_COUNTERS");
  });
  it("rejects a restarted process, counter reset and insufficient interval", () => {
    const before = nativeCpuSnapshot("cpu 10 0 0 100 0 0 0 0", process(2, 2));
    const after = nativeCpuSnapshot("cpu 20 0 0 110 0 0 0 0", process(3, 3));
    expect(() => nativeCpuMeasurement(before, { ...after, processStart: 124 }, 15000)).toThrow("INTERVAL_INVALID");
    expect(() => nativeCpuMeasurement(after, before, 15000)).toThrow("INTERVAL_INVALID");
    expect(() => nativeCpuMeasurement(before, after, 100)).toThrow("INTERVAL_INVALID");
  });
});

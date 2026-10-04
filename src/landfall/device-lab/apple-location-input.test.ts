import { describe, expect, it, vi } from "vitest";
import { setOwnedAppleLabPosition } from "./apple-location-input";
// @sounding-line-registration owner=project-landfall suite=unit.landfall-device-lab contracts=landfall.device-lab-evidence

const owned = { deviceId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", createdForScenario: true };
const coordinate = { latitude: 44, longitude: -72 };
const timeout = { killed: true, signal: "SIGTERM" };
function fixture(run: (args: string[], timeoutMs: number) => Promise<unknown>) {
  return { run: vi.fn(run), delay: vi.fn(async () => {}), observe: vi.fn() };
}
describe("bounded owned Simulator position input", () => {
  it("retries one timed-out idempotent input with exact bounded argv and reports acknowledgment separately", async () => {
    let calls = 0;
    const driver = fixture(async () => {
      if (++calls === 1) throw timeout;
    });
    await setOwnedAppleLabPosition(owned, coordinate, driver);
    expect(driver.run.mock.calls).toEqual(
      Array(2).fill([["simctl", "location", owned.deviceId, "set", "44,-72"], 30000]),
    );
    expect(driver.delay).toHaveBeenCalledExactlyOnceWith(250);
    expect(driver.observe.mock.calls).toEqual([
      [1, "ATTEMPT"],
      [1, "TIMED_OUT"],
      [2, "ATTEMPT"],
      [2, "ACKNOWLEDGED"],
    ]);
  });
  it("cannot turn repeated timeouts into success or run a third attempt", async () => {
    const driver = fixture(async () => {
      throw timeout;
    });
    await expect(setOwnedAppleLabPosition(owned, coordinate, driver)).rejects.toBe(timeout);
    expect(driver.run).toHaveBeenCalledTimes(2);
    expect(driver.observe.mock.calls.some(([, state]) => state === "ACKNOWLEDGED")).toBe(false);
  });
  it.each([
    { code: 1 },
    { ...timeout, code: 1 },
    { ...timeout, code: "ERR_CHILD_PROCESS_STDIO_MAXBUFFER" },
    { ...timeout, name: "AbortError" },
    { ...timeout, code: "ABORT_ERR" },
    { killed: false, signal: "SIGTERM" },
  ])("does not retry command errors or cancellation: %j", async (error) => {
    const driver = fixture(async () => {
      throw error;
    });
    await expect(setOwnedAppleLabPosition(owned, coordinate, driver)).rejects.toBe(error);
    expect(driver.run).toHaveBeenCalledTimes(1);
    expect(driver.delay).not.toHaveBeenCalled();
  });
  it.each([
    [{ ...owned, createdForScenario: false }, coordinate],
    [{ ...owned, deviceId: "physical-device" }, coordinate],
    [owned, { latitude: 91, longitude: 0 }],
    [owned, { latitude: 0, longitude: NaN }],
  ])("rejects unowned targets and invalid coordinates before a tool call", async (ownership, point) => {
    const driver = fixture(async () => {});
    await expect(setOwnedAppleLabPosition(ownership, point, driver)).rejects.toThrow("OWNED_APPLE_INPUT_REQUIRED");
    expect(driver.run).not.toHaveBeenCalled();
  });
});

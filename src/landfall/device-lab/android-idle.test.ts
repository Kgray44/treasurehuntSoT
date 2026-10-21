// @sounding-line-registration owner=project-landfall suite=unit.landfall-device-lab contracts=landfall.device-lab-evidence
import { describe, expect, it } from "vitest";
import { ownedAndroidIdleControl } from "./android-idle";

function fixture(acknowledge = true) {
  let clock = 0,
    forced = false,
    inactive = false,
    bucket = "10",
    refuseCleanup = false;
  const calls: string[][] = [];
  const control = ownedAndroidIdleControl(
    { virtual: true, serial: "emulator-5554" },
    {
      now: () => clock,
      delay: async (ms) => {
        clock += ms;
      },
      adb: async (args) => {
        calls.push(args);
        if (args.includes("force-idle") && acknowledge) forced = true;
        if (args.includes("unforce") && !refuseCleanup) forced = false;
        if (args.includes("set-inactive") && acknowledge) {
          inactive = args.at(-1) === "true";
          bucket = inactive ? "40" : "10";
        }
        if (args.includes("set-standby-bucket")) bucket = args.at(-1)!;
        if (args.includes("get-inactive")) return `Idle=${inactive}`;
        if (args.includes("get-standby-bucket")) return bucket;
        if (args.includes("get")) return forced ? "IDLE" : "ACTIVE";
        return `mForceIdle=${forced}`;
      },
    },
  );
  return {
    control,
    calls,
    refuseCleanup() {
      refuseCleanup = true;
    },
  };
}
describe("owned virtual Android idle controls", () => {
  it.each([
    { virtual: false, serial: "emulator-5554" },
    { virtual: true, serial: "physical-device" },
  ])("rejects non-owned hardware before commands", (ownership) => {
    expect(() =>
      ownedAndroidIdleControl(ownership, {
        adb: async () => {
          throw new Error("MUST_NOT_RUN");
        },
        now: Date.now,
        delay: async () => {},
      }),
    ).toThrow("OWNED_VIRTUAL");
  });
  it("requires OS readback rather than a successful control command", async () => {
    const f = fixture(false);
    await expect(f.control.set("DOZE", true)).rejects.toThrow("TRANSITION_NOT_OBSERVED");
    expect(f.control.observations).toEqual([]);
    expect(await f.control.cleanup()).toEqual([]);
  });
  it("records actual idle entry and wake and restores even an interrupted idle step", async () => {
    const f = fixture();
    await f.control.set("DOZE", true);
    expect(f.control.observations).toEqual([{ mode: "DOZE", enabled: true, observed: true }]);
    expect(await f.control.cleanup()).toEqual([]);
    expect(f.calls.some((args) => args.includes("unforce"))).toBe(true);
  });
  it("restores the original app inactivity and standby bucket after recovery", async () => {
    const f = fixture();
    await f.control.set("STANDBY", true);
    await f.control.set("STANDBY", false);
    expect(f.control.observations).toHaveLength(2);
    expect(await f.control.cleanup()).toEqual([]);
    expect(f.calls).toContainEqual(["shell", "am", "set-standby-bucket", "com.voyagewright.landfall", "10"]);
  });
  it("retains a failed OS cleanup instead of asserting resource release", async () => {
    const f = fixture();
    await f.control.set("DOZE", true);
    f.refuseCleanup();
    expect(await f.control.cleanup()).toEqual(["android-forced-idle"]);
  });
});

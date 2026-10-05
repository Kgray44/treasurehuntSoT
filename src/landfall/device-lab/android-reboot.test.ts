import { describe, expect, it } from "vitest";
import { rebootOwnedAndroidGuest } from "./android-reboot";
// @sounding-line-registration owner=project-landfall suite=unit.landfall-device-lab contracts=landfall.device-lab-evidence

const owned = { ephemeralHostedLinux: true, enabled: true, virtual: true, serial: "emulator-5554", port: 42000 };
const oldBoot = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const newBoot = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
function fixture(change: boolean, replace = false) {
  let time = 0;
  let rebooted = false;
  const calls: string[][] = [];
  return {
    calls,
    driver: {
      now: () => time,
      delay: async (ms: number) => {
        time += ms;
      },
      adb: async (args: string[]) => {
        calls.push(args);
        if (args[0] === "reboot") {
          rebooted = true;
          return "";
        }
        if (args[0] === "emu") return `${replace && rebooted ? "replacement" : "owned-lab"}\nOK\n`;
        if (args.includes("sys.boot_completed")) return "1\n";
        if (args.includes("/proc/sys/kernel/random/boot_id")) return rebooted && change ? newBoot : oldBoot;
        return "";
      },
    },
  };
}
describe("ephemeral Android guest reboot evidence", () => {
  it.each([{ enabled: false }, { ephemeralHostedLinux: false }, { virtual: false }, { serial: "physical-device" }])(
    "rejects an unowned or physical target before running any tool: %j",
    async (override) => {
      const f = fixture(true);
      await expect(rebootOwnedAndroidGuest({ ...owned, ...override }, f.driver)).rejects.toThrow("EPHEMERAL_GUEST");
      expect(f.calls).toEqual([]);
    },
  );
  it("cannot accept the old boot's completed property or restore its binding", async () => {
    const f = fixture(false);
    await expect(rebootOwnedAndroidGuest(owned, f.driver)).rejects.toThrow("REBOOT_NOT_OBSERVED");
    expect(f.calls.some((args) => args[0] === "reverse")).toBe(false);
  });
  it("rejects a replacement AVD even if a new boot completed", async () => {
    const f = fixture(true, true);
    await expect(rebootOwnedAndroidGuest(owned, f.driver)).rejects.toThrow("AVD_IDENTITY_CHANGED");
    expect(f.calls.some((args) => args[0] === "reverse")).toBe(false);
  });
  it("restores only the owned binding after a changed boot and excludes raw guest identifiers", async () => {
    const f = fixture(true);
    const result = await rebootOwnedAndroidGuest(owned, f.driver);
    expect(result).toMatchObject({ bootIdentityChanged: true, avdIdentityPreserved: true });
    expect(f.calls.at(-1)).toEqual(["reverse", "tcp:42000", "tcp:42000"]);
    expect(JSON.stringify(result)).not.toMatch(/owned-lab|aaaaaaaa|bbbbbbbb/);
  });
});

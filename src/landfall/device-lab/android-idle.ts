type IdleMode = "DOZE" | "STANDBY";
type IdleDriver = { adb: (args: string[]) => Promise<string>; now: () => number; delay: (ms: number) => Promise<void> };
const app = "com.voyagewright.landfall";
/** Documented OS controls restricted to the measured virtual guest. No client
 * lifecycle callback, sensing result or progression is manufactured here. */
export function ownedAndroidIdleControl(ownership: { virtual: boolean; serial: string }, driver: IdleDriver) {
  if (!ownership.virtual || !/^emulator-[0-9]+$/.test(ownership.serial))
    throw new Error("ANDROID_IDLE_OWNED_VIRTUAL_GUEST_REQUIRED");
  let dozeTouched = false;
  let standbyBaseline: { inactive: boolean; bucket: string } | undefined;
  const observations: { mode: IdleMode; enabled: boolean; observed: boolean }[] = [];
  const forced = async () => {
    const result = /\bmForceIdle=(true|false)\b/.exec(await driver.adb(["shell", "dumpsys", "deviceidle"]));
    if (!result) throw new Error("ANDROID_IDLE_BASELINE_UNAVAILABLE");
    return result[1] === "true";
  };
  const inactive = async () => {
    const result = /^Idle=(true|false)$/m.exec((await driver.adb(["shell", "am", "get-inactive", app])).trim());
    if (!result) throw new Error("ANDROID_STANDBY_BASELINE_UNAVAILABLE");
    return result[1] === "true";
  };
  const wait = async (read: () => Promise<boolean>) => {
    const deadline = driver.now() + 10000;
    do {
      if (await read()) return;
      await driver.delay(100);
    } while (driver.now() < deadline);
    throw new Error("ANDROID_IDLE_TRANSITION_NOT_OBSERVED");
  };
  return {
    observations,
    async set(mode: IdleMode, enabled: boolean) {
      if (mode === "DOZE") {
        if (!dozeTouched && (await forced())) throw new Error("ANDROID_IDLE_ALREADY_FORCED");
        dozeTouched = true;
        await driver.adb(["shell", "dumpsys", "deviceidle", ...(enabled ? ["force-idle", "deep"] : ["unforce"])]);
        await wait(async () =>
          enabled
            ? (await forced()) &&
              (await driver.adb(["shell", "dumpsys", "deviceidle", "get", "deep"])).trim() === "IDLE"
            : !(await forced()),
        );
      } else {
        if (!standbyBaseline) {
          const bucket = (await driver.adb(["shell", "am", "get-standby-bucket", app])).trim();
          if (!/^(?:5|10|20|30|40|45|50)$/.test(bucket)) throw new Error("ANDROID_STANDBY_BUCKET_UNAVAILABLE");
          standbyBaseline = { bucket, inactive: await inactive() };
        }
        await driver.adb(["shell", "am", "set-inactive", app, String(enabled)]);
        await wait(async () => (await inactive()) === enabled);
      }
      observations.push({ mode, enabled, observed: true });
    },
    async cleanup() {
      const remaining: string[] = [];
      if (dozeTouched)
        try {
          await driver.adb(["shell", "dumpsys", "deviceidle", "unforce"]);
          if (await forced()) remaining.push("android-forced-idle");
        } catch {
          remaining.push("android-forced-idle");
        }
      if (standbyBaseline)
        try {
          await driver.adb(["shell", "am", "set-inactive", app, String(standbyBaseline.inactive)]);
          await driver.adb(["shell", "am", "set-standby-bucket", app, standbyBaseline.bucket]);
          if (
            (await inactive()) !== standbyBaseline.inactive ||
            (await driver.adb(["shell", "am", "get-standby-bucket", app])).trim() !== standbyBaseline.bucket
          )
            remaining.push("android-app-standby-baseline");
        } catch {
          remaining.push("android-app-standby-baseline");
        }
      return remaining;
    },
  };
}

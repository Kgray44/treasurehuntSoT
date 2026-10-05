type GuestRebootDriver = {
  adb: (args: string[], timeout?: number) => Promise<string>;
  now: () => number;
  delay: (ms: number) => Promise<void>;
};

/** Reboots only a measured virtual guest on an explicitly enabled ephemeral runner. */
export async function rebootOwnedAndroidGuest(
  ownership: { ephemeralHostedLinux: boolean; enabled: boolean; virtual: boolean; serial: string; port: number },
  driver: GuestRebootDriver,
) {
  if (
    !ownership.ephemeralHostedLinux ||
    !ownership.enabled ||
    !ownership.virtual ||
    !/^emulator-[0-9]+$/.test(ownership.serial) ||
    !Number.isInteger(ownership.port) ||
    ownership.port < 1024 ||
    ownership.port > 65535
  )
    throw new Error("LANDFALL_EPHEMERAL_GUEST_REBOOT_REQUIRED");
  const avd = (output: string) => {
    const lines = output.trim().split(/\r?\n/);
    if (lines.length !== 2 || lines[1] !== "OK" || !/^[A-Za-z0-9_.-]{1,128}$/.test(lines[0]))
      throw new Error("ANDROID_REBOOT_AVD_IDENTITY_UNAVAILABLE");
    return lines[0];
  };
  const boot = (output: string) => {
    const value = output.trim();
    if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value))
      throw new Error("ANDROID_REBOOT_BOOT_IDENTITY_UNAVAILABLE");
    return value;
  };
  const beforeAvd = avd(await driver.adb(["emu", "avd", "name"]));
  const beforeBoot = boot(await driver.adb(["shell", "cat", "/proc/sys/kernel/random/boot_id"]));
  const startedAt = driver.now();
  await driver.adb(["reboot"]);
  const deadline = startedAt + 180_000;
  let changed = false;
  while (driver.now() < deadline) {
    try {
      const completed = (await driver.adb(["shell", "getprop", "sys.boot_completed"], 5000)).trim();
      const currentBoot = boot(await driver.adb(["shell", "cat", "/proc/sys/kernel/random/boot_id"], 5000));
      if (completed === "1" && currentBoot !== beforeBoot) {
        changed = true;
        break;
      }
    } catch {
      /* A disconnected or still-booting guest is bounded by the shared deadline. */
    }
    await driver.delay(1000);
  }
  if (!changed) throw new Error("ANDROID_REBOOT_NOT_OBSERVED");
  if (avd(await driver.adb(["emu", "avd", "name"])) !== beforeAvd)
    throw new Error("ANDROID_REBOOT_AVD_IDENTITY_CHANGED");
  await driver.adb(["reverse", `tcp:${ownership.port}`, `tcp:${ownership.port}`]);
  // Neither guest identifiers nor application data belong in exported receipts.
  return { bootIdentityChanged: true, avdIdentityPreserved: true, elapsedMs: driver.now() - startedAt };
}

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { discoverDeviceLabHost, labTool } from "./host";

/** Instrument only an explicitly owned emulator, never the user's default ADB device. */
async function main() {
  const root = process.cwd();
  const host = await discoverDeviceLabHost();
  let serial = process.env.LANDFALL_LAB_ANDROID_SERIAL;
  if (!serial && host.hosted && host.android.adb) {
    const devices = (await labTool(host.android.adb, ["devices"]))
      .split(/\r?\n/)
      .map((line) => line.split(/\s+/)[0])
      .filter((value) => /^emulator-[0-9]+$/.test(value));
    if (devices.length === 1) serial = devices[0];
  }
  if (!host.android.adb || !serial || !/^emulator-[0-9]+$/.test(serial))
    throw new Error("LANDFALL_OWNED_ANDROID_REQUIRED");
  const adb = (args: string[], timeout = 30000) =>
    labTool(host.android.adb!, ["-P", process.env.LANDFALL_LAB_ADB_PORT ?? "5037", "-s", serial!, ...args], timeout);
  const destination = path.join(root, "artifacts", "landfall-device-lab", `android-native-tests-${Date.now()}`);
  await mkdir(destination, { recursive: true });
  let passed = false;
  let cleanup = true;
  const apk = path.join(root, "native", "android", "app", "build", "outputs", "apk", "debug", "app-debug.apk");
  const testApk = path.join(
    root,
    "native",
    "android",
    "app",
    "build",
    "outputs",
    "apk",
    "androidTest",
    "debug",
    "app-debug-androidTest.apk",
  );
  try {
    await adb(["install", "-r", apk]);
    await adb(["install", "-r", testApk]);
    const result = await adb(
      [
        "shell",
        "am",
        "instrument",
        "-w",
        "-r",
        "com.voyagewright.landfall.test/androidx.test.runner.AndroidJUnitRunner",
      ],
      180000,
    );
    await writeFile(path.join(destination, "instrumentation.txt"), result);
    passed = /OK \([0-9]+ tests?\)/.test(result) && !/FAILURES|INSTRUMENTATION_FAILED|Process crashed/.test(result);
  } finally {
    for (const packageId of ["com.voyagewright.landfall.test", "com.voyagewright.landfall"]) {
      await adb(["shell", "am", "force-stop", packageId]).catch(() => {
        cleanup = false;
      });
      const cleared = await adb(["shell", "pm", "clear", packageId]).catch(() => "FAIL");
      if (!cleared.includes("Success")) cleanup = false;
    }
    const removed = await adb(["uninstall", "com.voyagewright.landfall.test"]).catch(() => "FAIL");
    if (!removed.includes("Success")) cleanup = false;
    await writeFile(
      path.join(destination, "receipt.json"),
      JSON.stringify(
        {
          version: 1,
          sourceSha: (await labTool("git", ["rev-parse", "HEAD"])).trim(),
          sourceTree: (await labTool("git", ["rev-parse", "HEAD^{tree}"])).trim(),
          dirty: Boolean((await labTool("git", ["status", "--porcelain"])).trim()),
          evidenceClass: "EMULATOR_PROVEN",
          result: passed && cleanup ? "PASS" : "FAIL",
          canonicalProgressionEvents: null,
          androidVersion: (await adb(["shell", "getprop", "ro.build.version.release"])).trim(),
          appSha256: createHash("sha256")
            .update(await readFile(apk))
            .digest("hex"),
          testApkSha256: createHash("sha256")
            .update(await readFile(testApk))
            .digest("hex"),
          cleanup: { result: cleanup ? "PASS" : "FAIL" },
        },
        null,
        2,
      ),
    );
  }
  process.stdout.write(`${JSON.stringify({ result: passed && cleanup ? "PASS" : "FAIL", directory: destination })}\n`);
  if (!passed || !cleanup) process.exitCode = 1;
}
main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error && /^[A-Z_]+$/.test(error.message) ? error.message : "LANDFALL_ANDROID_TEST_FAILED"}\n`,
  );
  process.exitCode = 1;
});

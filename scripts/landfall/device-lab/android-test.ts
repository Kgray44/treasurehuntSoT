import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { z } from "zod";
import { discoverDeviceLabHost, labTool } from "./host";
import { deviceLabSourceIdentity } from "./source";

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
  const source = await deviceLabSourceIdentity();
  const appSha256 = createHash("sha256")
    .update(await readFile(apk))
    .digest("hex");
  const testApkSha256 = createHash("sha256")
    .update(await readFile(testApk))
    .digest("hex");
  let sourceUnchanged = false;
  let failure: string | null = null;
  let sensorPerformanceSha256: string | null = null;
  const active = await adb(["shell", "ps", "-A", "-o", "NAME"]);
  if (active.split(/\r?\n/).some((name) => /^(com\.voyagewright\.landfall)(?:\.test)?(?::.*)?$/.test(name.trim())))
    throw new Error("LANDFALL_NATIVE_TEST_APP_ALREADY_ACTIVE");
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
    if (passed) {
      const raw = await adb([
        "shell",
        "run-as",
        "com.voyagewright.landfall",
        "cat",
        "files/landfall-sensor-performance.json",
      ]);
      if (raw.length > 8192) throw new Error("NATIVE_SENSOR_PERFORMANCE_RECORD_TOO_LARGE");
      const bounded = z.number().int().nonnegative().max(1_000_000);
      const sample = z.strictObject({
        baselineElapsedMs: bounded,
        baselineCpuMs: bounded,
        baselinePssKiB: bounded,
        activeElapsedMs: bounded,
        activeCpuMs: bounded,
        activePssKiB: bounded,
        pssDeltaKiB: z.number().int().min(-262144).max(32768),
        callbacks: bounded,
        stopVerified: z.literal(true),
      });
      const projection = z
        .strictObject({
          version: z.literal(1),
          measurementClass: z.literal("NATIVE_SENSOR_ADAPTER_INSTRUMENTATION"),
          api: z.number().int().min(28).max(100),
          sampleCount: z.literal(3),
          physicalEnergyProven: z.literal(false),
          budgets: z.strictObject({
            activeCpuMsPerTwoSecondInterval: z.literal(1000),
            processPssKiB: z.literal(262144),
            incrementalPssKiB: z.literal(32768),
          }),
          samples: z.array(sample).length(3),
        })
        .parse(JSON.parse(raw));
      if (
        projection.samples.some(
          (value) => value.activeCpuMs > 1000 || value.activePssKiB > 262144 || value.activeElapsedMs < 2000,
        )
      )
        throw new Error("NATIVE_SENSOR_PERFORMANCE_BUDGET_FAILED");
      const serialized = JSON.stringify(projection, null, 2);
      await writeFile(path.join(destination, "native-sensor-performance.json"), serialized);
      sensorPerformanceSha256 = createHash("sha256").update(serialized).digest("hex");
    }
  } catch {
    passed = false;
    failure = "NATIVE_INSTRUMENTATION_TOOL_FAILED";
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
    const after = await deviceLabSourceIdentity();
    sourceUnchanged =
      after.sourceSha === source.sourceSha &&
      after.sourceFingerprint === source.sourceFingerprint &&
      createHash("sha256")
        .update(await readFile(apk))
        .digest("hex") === appSha256 &&
      createHash("sha256")
        .update(await readFile(testApk))
        .digest("hex") === testApkSha256;
    await writeFile(
      path.join(destination, "receipt.json"),
      JSON.stringify(
        {
          version: 1,
          ...source,
          sourceUnchanged,
          sourceBinding: "CHECKOUT_SNAPSHOT_AND_EXACT_APK",
          evidenceClass: passed && cleanup && sourceUnchanged ? "EMULATOR_PROVEN" : "EXECUTION_FAILED",
          result: passed && cleanup && sourceUnchanged ? "PASS" : "FAIL",
          failure: !sourceUnchanged ? "NATIVE_TEST_INPUT_CHANGED" : failure,
          canonicalProgressionEvents: null,
          androidVersion: await adb(["shell", "getprop", "ro.build.version.release"]).then(
            (value) => value.trim(),
            () => null,
          ),
          appSha256,
          testApkSha256,
          sensorPerformanceSha256,
          cleanup: { result: cleanup ? "PASS" : "FAIL" },
        },
        null,
        2,
      ),
    );
  }
  process.stdout.write(
    `${JSON.stringify({ result: passed && cleanup && sourceUnchanged ? "PASS" : "FAIL", directory: destination })}\n`,
  );
  if (!passed || !cleanup || !sourceUnchanged) process.exitCode = 1;
}
main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error && /^[A-Z_]+$/.test(error.message) ? error.message : "LANDFALL_ANDROID_TEST_FAILED"}\n`,
  );
  process.exitCode = 1;
});

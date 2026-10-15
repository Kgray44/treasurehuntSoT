import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { z } from "zod";
import { discoverDeviceLabHost, labTool } from "./host";
import { deviceLabSourceIdentity } from "./source";

type AdbTool = (args: string[], timeout?: number) => Promise<string>;
const diagnosticByteLimit = 256 * 1024;

/** Retain bounded original output from this synthetic, explicitly owned emulator. */
export async function writeAndroidFailureDiagnostics(destination: string, stage: string, error: unknown, adb: AdbTool) {
  const stream = async (name: string, value: unknown) => {
    const original = typeof value === "string" ? Buffer.from(value) : Buffer.isBuffer(value) ? value : Buffer.alloc(0);
    const retained = original.subarray(0, diagnosticByteLimit);
    await writeFile(path.join(destination, name), retained);
    return {
      path: name,
      bytes: retained.length,
      originalBytes: original.length,
      truncated: retained.length < original.length,
      sha256: createHash("sha256").update(retained).digest("hex"),
    };
  };
  const failure = (value: unknown) => {
    const item = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
    return {
      code:
        typeof item.code === "number" || (typeof item.code === "string" && /^[A-Z0-9_]+$/.test(item.code))
          ? item.code
          : null,
      signal: typeof item.signal === "string" && /^SIG[A-Z0-9]+$/.test(item.signal) ? item.signal : null,
      killed: item.killed === true,
      validationCode: value instanceof Error && /^[A-Z_]+$/.test(value.message) ? value.message : null,
      stdout: item.stdout,
      stderr: item.stderr,
    };
  };
  const save = async (name: string, operation: () => Promise<string>) => {
    let result: "PASS" | "FAIL" = "PASS";
    let output: ReturnType<typeof failure>;
    try {
      output = { ...failure(null), stdout: await operation() };
    } catch (observationError) {
      result = "FAIL";
      output = failure(observationError);
    }
    const { stdout, stderr, ...metadata } = output;
    return {
      name,
      result,
      ...metadata,
      stdout: await stream(`${name}.stdout.original.log`, stdout),
      stderr: await stream(`${name}.stderr.original.log`, stderr),
    };
  };
  const { stdout, stderr, ...metadata } = failure(error);
  const originalFailure = {
    ...metadata,
    stdout: await stream("tool-failure.stdout.original.log", stdout),
    stderr: await stream("tool-failure.stderr.original.log", stderr),
  };
  // Fixed read-only commands only. Process arguments/environment and app files
  // are deliberately absent; failed probes remain observations, never proof.
  const observations = [
    save("adb-state", () => adb(["get-state"], 5000)),
    save("adb-logcat", () => adb(["logcat", "-d", "-b", "main", "-b", "system", "-b", "crash", "-t", "600"], 5000)),
    save("guest-memory", () => adb(["shell", "cat", "/proc/meminfo"], 5000)),
  ];
  if (process.platform === "linux") {
    observations.push(
      save("host-memory", () => readFile("/proc/meminfo", "utf8")),
      save("host-processes", () => labTool("ps", ["-eo", "pid,ppid,comm,rss,stat", "--sort=-rss"], 5000)),
      save("host-kernel", () => labTool("dmesg", ["--level=err,warn"], 5000)),
      save("host-cgroup-memory-events", () => readFile("/sys/fs/cgroup/memory.events", "utf8")),
      save("host-cgroup-memory-current", () => readFile("/sys/fs/cgroup/memory.current", "utf8")),
      save("host-cgroup-memory-max", () => readFile("/sys/fs/cgroup/memory.max", "utf8")),
    );
  }
  const report = JSON.stringify(
    {
      schemaVersion: 1,
      evidenceClass: "FAILED_NATIVE_DRIVER_DIAGNOSTICS_ONLY",
      stage,
      capturedBeforeCleanup: true,
      maximumBytesPerStream: diagnosticByteLimit,
      originalFailure,
      observations: await Promise.all(observations),
      physicalTrackingProven: false,
    },
    null,
    2,
  );
  await writeFile(path.join(destination, "failure-diagnostics.json"), report);
  return createHash("sha256").update(report).digest("hex");
}

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
  let stage = "INSTALL_APP";
  let failureStage: string | null = null;
  let failureDiagnosticsSha256: string | null = null;
  let sensorPerformanceSha256: string | null = null;
  let sceneRenderingSha256: string | null = null;
  const active = await adb(["shell", "ps", "-A", "-o", "NAME"]);
  if (active.split(/\r?\n/).some((name) => /^(com\.voyagewright\.landfall)(?:\.test)?(?::.*)?$/.test(name.trim())))
    throw new Error("LANDFALL_NATIVE_TEST_APP_ALREADY_ACTIVE");
  try {
    await adb(["install", "-r", apk]);
    stage = "INSTALL_TEST_APK";
    await adb(["install", "-r", testApk]);
    stage = "INSTRUMENTATION";
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
    if (!passed) {
      failure = "NATIVE_INSTRUMENTATION_TOOL_FAILED";
      failureStage = stage;
      failureDiagnosticsSha256 = await writeAndroidFailureDiagnostics(
        destination,
        stage,
        { stdout: result },
        adb,
      ).catch(() => null);
    }
    if (passed) {
      stage = "SENSOR_PERFORMANCE_EXPORT";
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
      // Recover real gltfio/rasterization proof before the existing app cleanup.
      stage = "SCENE_RENDERING_EXPORT";
      const sceneRaw = await adb([
        "shell",
        "run-as",
        "com.voyagewright.landfall",
        "cat",
        "files/ncl01-filament-catalog.json",
      ]);
      if (sceneRaw.length > 8192) throw new Error("NATIVE_SCENE_RENDERING_RECORD_TOO_LARGE");
      const modelProof = z.strictObject({
        assetId: z.enum(["brass-compass", "treasure-chest"]),
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
        renderables: z.number().int().positive().max(1000),
        materialInstances: z.number().int().min(4).max(1000),
        originalWorldBoundsMeters: z.array(z.number().finite().min(-10).max(10)).length(6),
        rootTransformAndBottomPivotVerified: z.literal(true),
        renderedNontransparentPixels: z.number().int().min(33).max(4_194_304),
        clearedNontransparentPixels: z.literal(0),
        assetDisposed: z.literal(true),
      });
      const sceneProof = z
        .strictObject({
          schemaVersion: z.literal(1),
          evidenceClass: z.literal("INSTRUMENTED_FILAMENT_GLTF_RENDERING_ONLY"),
          renderer: z.literal("FILAMENT_1_75_1_OPENGL"),
          fixtureUsesCamera: z.literal(false),
          fixtureCreatesARCoreSession: z.literal(false),
          physicalTrackingProven: z.literal(false),
          engineDisposed: z.literal(true),
          assets: z.array(modelProof).length(2),
        })
        .parse(JSON.parse(sceneRaw));
      const modelDigests = {
        "brass-compass": "5af1158b1a7f2b3339c159fbdca8b9d3d29020eaa06d41848bf5c04c0a682ccb",
        "treasure-chest": "2e31b5eed11242e583cfc99a5491ff2e4b10dec0d4fed5d90dffe1ccab122e6f",
      };
      if (
        new Set(sceneProof.assets.map((asset) => asset.assetId)).size !== 2 ||
        sceneProof.assets.some((asset) => asset.sha256 !== modelDigests[asset.assetId])
      )
        throw new Error("NATIVE_SCENE_RENDERING_ASSET_MISMATCH");
      const sceneSerialized = JSON.stringify(sceneProof, null, 2);
      await writeFile(path.join(destination, "native-scene-rendering.json"), sceneSerialized);
      sceneRenderingSha256 = createHash("sha256").update(sceneSerialized).digest("hex");
    }
  } catch (error) {
    passed = false;
    failure = "NATIVE_INSTRUMENTATION_TOOL_FAILED";
    failureStage = stage;
    failureDiagnosticsSha256 = await writeAndroidFailureDiagnostics(destination, stage, error, adb).catch(() => null);
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
          failureStage,
          failureDiagnosticsSha256,
          canonicalProgressionEvents: null,
          androidVersion: await adb(["shell", "getprop", "ro.build.version.release"]).then(
            (value) => value.trim(),
            () => null,
          ),
          appSha256,
          testApkSha256,
          sensorPerformanceSha256,
          sceneRenderingSha256,
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
if (process.argv[1]?.endsWith("android-test.ts"))
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error && /^[A-Z_]+$/.test(error.message) ? error.message : "LANDFALL_ANDROID_TEST_FAILED"}\n`,
    );
    process.exitCode = 1;
  });

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { closeSync, openSync, writeSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { z } from "zod";
import { discoverDeviceLabHost, labBinaryTool, labTool } from "./host";
import { deviceLabSourceIdentity } from "./source";
import {
  parseFilamentSceneProof,
  validateFilamentFramePng,
} from "../../../src/landfall/device-lab/android-scene-rendering";
import { parseAndroidNativeInputProof } from "../../../src/landfall/device-lab/android-native-input";

type AdbTool = (args: string[], timeout?: number) => Promise<string>;
const diagnosticByteLimit = 256 * 1024;

/** Persist only fixed fixture breadcrumbs while the owned emulator is alive. */
export function startFilamentStageCapture(
  destination: string,
  adbPath: string,
  port: string,
  serial: string,
  launch: typeof spawn = spawn,
) {
  if (!/^emulator-[0-9]+$/.test(serial) || !/^[0-9]{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65535)
    throw new Error("LANDFALL_OWNED_ANDROID_REQUIRED");
  const streams: {
    path: string;
    fd: number;
    observedBytes: number;
    bytes: number;
    maximumBytes: number;
    truncated: boolean;
  }[] = [];
  try {
    for (const kind of ["stdout", "stderr"])
      streams.push({
        path: `filament-stages.${kind}.original.log`,
        fd: openSync(path.join(destination, `filament-stages.${kind}.original.log`), "wx"),
        observedBytes: 0,
        bytes: 0,
        maximumBytes: kind === "stdout" ? diagnosticByteLimit : 8192,
        truncated: false,
      });
  } catch (error) {
    for (const stream of streams) closeSync(stream.fd);
    throw error;
  }
  let filesClosed = false;
  const closeFiles = () => {
    if (filesClosed) return;
    filesClosed = true;
    for (const stream of streams) closeSync(stream.fd);
  };
  let resolveClosed!: () => void;
  const closed = new Promise<void>((resolve) => {
    resolveClosed = resolve;
  });
  let loggerClosed = false;
  let code: number | null = null;
  let signal: NodeJS.Signals | null = null;
  let spawnErrorCode: string | null = null;
  let writeFailed = false;
  let terminationReason = "LOGGER_RUNNING";
  let child: ReturnType<typeof spawn>;
  try {
    child = launch(
      adbPath,
      ["-P", port, "-s", serial, "logcat", "-v", "monotonic", "-T", "1", "NCL01Filament:I", "*:S"],
      {
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
  } catch (error) {
    closeFiles();
    throw error;
  }
  const receive = (index: number, chunk: Buffer) => {
    if (filesClosed) return;
    const stream = streams[index];
    stream.observedBytes += chunk.length;
    const retained = chunk.subarray(0, Math.max(0, stream.maximumBytes - stream.bytes));
    try {
      let offset = 0;
      while (offset < retained.length) {
        const written = writeSync(stream.fd, retained, offset, retained.length - offset);
        if (!written) throw new Error("NATIVE_STAGE_CAPTURE_WRITE_FAILED");
        offset += written;
        stream.bytes += written;
      }
    } catch {
      writeFailed = true;
      terminationReason = "WRITE_FAILED";
      child.kill("SIGTERM");
    }
    if (retained.length < chunk.length) {
      stream.truncated = true;
      terminationReason = "BYTE_LIMIT";
      child.kill("SIGTERM");
    }
  };
  child.stdout?.on("data", (chunk: Buffer) => receive(0, chunk));
  child.stderr?.on("data", (chunk: Buffer) => receive(1, chunk));
  child.on("error", (error: NodeJS.ErrnoException) => {
    spawnErrorCode = error.code && /^[A-Z_]+$/.test(error.code) ? error.code : "SPAWN_FAILED";
  });
  child.on("close", (exitCode, exitSignal) => {
    code = exitCode;
    signal = exitSignal;
    loggerClosed = true;
    if (terminationReason === "LOGGER_RUNNING") terminationReason = "LOGGER_EXITED";
    closeFiles();
    resolveClosed();
  });
  // This logger owns only its child process. The instrumentation command keeps
  // its existing independent 180-second timeout and exact test assertions.
  const deadline = setTimeout(() => {
    if (loggerClosed) return;
    terminationReason = "TIME_LIMIT";
    child.kill("SIGTERM");
  }, 180000);
  deadline.unref();
  const waitForClose = (milliseconds: number) =>
    new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), milliseconds);
      closed.then(() => {
        clearTimeout(timer);
        resolve(true);
      });
    });
  let stopped: Promise<{ sha256: string; closed: boolean }> | undefined;
  return {
    stop() {
      return (stopped ??= (async () => {
        clearTimeout(deadline);
        if (!loggerClosed) {
          if (terminationReason === "LOGGER_RUNNING") terminationReason = "INSTRUMENTATION_ENDED";
          child.kill("SIGTERM");
          if (!(await waitForClose(5000))) {
            child.kill("SIGKILL");
            await waitForClose(1000);
          }
        }
        closeFiles();
        const records = await Promise.all(
          streams.map(async (stream) => ({
            path: stream.path,
            observedBytes: stream.observedBytes,
            bytes: stream.bytes,
            maximumBytes: stream.maximumBytes,
            truncated: stream.truncated,
            sha256: createHash("sha256")
              .update(await readFile(path.join(destination, stream.path)))
              .digest("hex"),
          })),
        );
        const report = JSON.stringify(
          {
            schemaVersion: 1,
            evidenceClass: "CONTINUOUS_FIXTURE_STAGE_DIAGNOSTICS_ONLY",
            tag: "NCL01Filament",
            serial,
            code,
            signal,
            spawnErrorCode,
            writeFailed,
            loggerClosed,
            terminationReason,
            streams: records,
            physicalTrackingProven: false,
          },
          null,
          2,
        );
        await writeFile(path.join(destination, "filament-stage-capture.json"), report);
        return {
          sha256: createHash("sha256").update(report).digest("hex"),
          closed: loggerClosed && !writeFailed && !spawnErrorCode,
        };
      })());
    },
  };
}

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
  let filamentStageCaptureSha256: string | null = null;
  let sensorPerformanceSha256: string | null = null;
  let sceneRenderingSha256: string | null = null;
  let nativeInputSha256: string | null = null;
  const active = await adb(["shell", "ps", "-A", "-o", "NAME"]);
  if (active.split(/\r?\n/).some((name) => /^(com\.voyagewright\.landfall)(?:\.test)?(?::.*)?$/.test(name.trim())))
    throw new Error("LANDFALL_NATIVE_TEST_APP_ALREADY_ACTIVE");
  try {
    await adb(["install", "-r", apk]);
    stage = "INSTALL_TEST_APK";
    await adb(["install", "-r", testApk]);
    stage = "INSTRUMENTATION";
    const stageCapture = startFilamentStageCapture(
      destination,
      host.android.adb,
      process.env.LANDFALL_LAB_ADB_PORT ?? "5037",
      serial,
    );
    let result: string;
    try {
      result = await adb(
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
    } finally {
      const capture = await stageCapture.stop().catch(() => null);
      filamentStageCaptureSha256 = capture?.sha256 ?? null;
      if (!capture?.closed) cleanup = false;
    }
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
      const sceneProof = parseFilamentSceneProof(sceneRaw);
      // Only these four schema-allowlisted, fixture-owned originals can be recovered.
      // Binary exec-out bypasses shell redirects and UTF-8 conversion entirely.
      for (const asset of sceneProof.assets)
        for (const frame of [asset.renderedFrame, asset.clearedFrame]) {
          const png = await labBinaryTool(host.android.adb, [
            "-P",
            process.env.LANDFALL_LAB_ADB_PORT ?? "5037",
            "-s",
            serial,
            "exec-out",
            "run-as",
            "com.voyagewright.landfall",
            "cat",
            `files/${frame.fileName}`,
          ]);
          await validateFilamentFramePng(frame, png);
          await writeFile(path.join(destination, frame.fileName), png);
        }
      const sceneSerialized = JSON.stringify(sceneProof, null, 2);
      await writeFile(path.join(destination, "native-scene-rendering.json"), sceneSerialized);
      sceneRenderingSha256 = createHash("sha256").update(sceneSerialized).digest("hex");
      stage = "NATIVE_INPUT_EXPORT";
      const inputRaw = await adb([
        "shell",
        "run-as",
        "com.voyagewright.landfall",
        "cat",
        "files/ncl01-native-input.json",
      ]);
      const inputSerialized = JSON.stringify(parseAndroidNativeInputProof(inputRaw), null, 2);
      await writeFile(path.join(destination, "native-input.json"), inputSerialized);
      nativeInputSha256 = createHash("sha256").update(inputSerialized).digest("hex");
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
          filamentStageCaptureSha256,
          canonicalProgressionEvents: null,
          androidVersion: await adb(["shell", "getprop", "ro.build.version.release"]).then(
            (value) => value.trim(),
            () => null,
          ),
          appSha256,
          testApkSha256,
          sensorPerformanceSha256,
          sceneRenderingSha256,
          nativeInputSha256,
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

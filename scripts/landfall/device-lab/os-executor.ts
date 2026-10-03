import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { build } from "esbuild";
import { discoverDeviceLabHost, labBinaryTool, labTool } from "./host";
import { startDeviceLabAuthority } from "./authority-client";
import { playerLandfallEvidenceSchema } from "../../../src/landfall/player-evidence-contract";
import {
  androidSensorControl,
  readAndroidSensorValues,
  type AndroidControlledSensor,
} from "../../../src/landfall/device-lab/android-sensors";
import { landfallId } from "../../../src/landfall/schema";
import { deviceLabLocationDiagnosticSchema } from "../../../src/landfall/device-lab/location-diagnostics";
import { type DeviceLabScenario, type DeviceLabStepResult } from "../../../src/landfall/device-lab/scenario";
import {
  deviceLabConfigurationSchema,
  validateDeviceLabProfile,
  type DeviceLabConfiguration,
  type DeviceLabProfile,
} from "../../../src/landfall/device-lab/device-profile";

export async function executeLandfallOsScenario(
  scenario: DeviceLabScenario,
  target: "android-emulator" | "ios-simulator",
  destination: string,
  profile: DeviceLabProfile = "primary-phone",
) {
  const root = process.cwd();
  const publicWorker = await readFile(path.join(root, "public", "landfall-offline-sw.js"));
  await mkdir(destination, { recursive: true });
  const host = await discoverDeviceLabHost();
  const bundle = await build({
    entryPoints: [path.join(root, "src", "landfall", "device-lab", "os-browser-client.ts")],
    bundle: true,
    write: false,
    platform: "browser",
    format: "iife",
    target: "es2020",
    logLevel: "silent",
  });
  const authority = await startDeviceLabAuthority(path.join(destination, "authority"), scenario.worldspace);
  let network = "ONLINE";
  let canonicalProgressionEvents: number | null = null;
  let ready = false;
  let maximumCompletionRequests = 0;
  const startups: { restarted: boolean; leaseRestored: boolean; publicShellControlled: boolean }[] = [];
  const locationDiagnostics: {
    index: number;
    diagnostic: ReturnType<typeof deviceLabLocationDiagnosticSchema.parse>;
  }[] = [];
  let clientError = false;
  let clientErrorReason = "LANDFALL_NATIVE_CLIENT_FAILED";
  let current: { index: number; action: unknown } | null = null;
  let stop = false;
  const results = new Map<number, DeviceLabStepResult>();
  const locationReady = new Set<number>();
  const sensorReady = new Set<number>();
  const osResults = new Map<number, DeviceLabStepResult>();
  let osReady = false;
  let osCurrent: { index: number; action: unknown } | null = null;
  const server = createServer(async (request, response) => {
    const route = request.url?.split("?")[0];
    response.setHeader("Cache-Control", "no-store");
    if (request.method === "GET" && route === "/player") {
      response.statusCode = 302;
      response.setHeader("Location", "/player/");
      response.end();
      return;
    }
    if (request.method === "GET" && route === "/lab/os/next") {
      if (stop) response.end(JSON.stringify({ stop: true }));
      else if (osCurrent) {
        response.end(JSON.stringify(osCurrent));
      } else {
        response.statusCode = 204;
        response.end();
      }
      return;
    }
    if (request.method === "GET" && route === "/landfall-offline-sw.js") {
      response.setHeader("Content-Type", "text/javascript");
      response.setHeader("Service-Worker-Allowed", "/player/");
      response.end(publicWorker);
      return;
    }
    if (request.method === "GET" && route === "/lab/connectivity") {
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({ state: network }));
      return;
    }
    if (request.method === "GET" && route === "/lab/scenario") {
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({ worldspace: scenario.worldspace }));
      return;
    }
    if (
      request.method === "GET" &&
      (route === "/player/" ||
        route === "/player/offline-landfall" ||
        route === "/player/playthroughs/session-1/journal")
    ) {
      // The owned control plane stays reachable, but an offline Journal navigation
      // must use the actual production public service worker and cached shell.
      if (network === "OFFLINE" && route !== "/player/") {
        request.socket.destroy();
        return;
      }
      response.setHeader("Content-Type", "text/html");
      response.end(
        '<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Landfall Device Lab</title><body><h1>Landfall Device Lab</h1><p>Synthetic isolated Voyage. Canonical server confirmation is required.</p><script src="/_next/static/chunks/landfall-lab.js"></script></body></html>',
      );
      return;
    }
    if (request.method === "GET" && route === "/_next/static/chunks/landfall-lab.js") {
      response.setHeader("Content-Type", "text/javascript");
      response.end(bundle.outputFiles[0].contents);
      return;
    }
    if (request.method === "GET" && route === "/lab/next") {
      if (stop) response.end(JSON.stringify({ stop: true }));
      else if (current) {
        response.end(JSON.stringify(current));
      } else {
        response.statusCode = 204;
        response.end();
      }
      return;
    }
    if (request.method === "GET" && route === "/lab/authority") {
      response.setHeader("Content-Type", "application/json");
      const receiptId = new URL(request.url!, "http://127.0.0.1").searchParams.get("receiptEvidenceId");
      if (receiptId !== null && !landfallId.safeParse(receiptId).success) {
        response.statusCode = 400;
        response.end();
        return;
      }
      response.end(
        JSON.stringify(
          network === "OFFLINE"
            ? { state: "UNAVAILABLE" }
            : await authority.authorize(receiptId ? { evidenceId: receiptId } : undefined),
        ),
      );
      return;
    }
    if (request.method === "GET" && route === "/lab/counts") {
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify(await authority.counts()));
      return;
    }
    if (request.method !== "POST") {
      response.statusCode = 404;
      response.end();
      return;
    }
    let body = "";
    for await (const bytes of request) {
      body += bytes.toString();
      if (body.length > 48 * 1024) {
        response.statusCode = 413;
        response.end();
        return;
      }
    }
    try {
      const value = JSON.parse(body);
      if (route === "/lab/commit") {
        if (network === "OFFLINE") {
          response.statusCode = 503;
          response.end();
          return;
        }
        const evidence = playerLandfallEvidenceSchema.parse(value);
        response.end(JSON.stringify(await authority.submit(evidence)));
        return;
      }
      if (
        route === "/lab/location-ready" &&
        Number.isInteger(value.index) &&
        scenario.timeline[value.index]?.action.type === "LOCATION"
      )
        locationReady.add(value.index);
      else if (
        route === "/lab/sensor-ready" &&
        Number.isInteger(value.index) &&
        scenario.timeline[value.index]?.action.type === "SENSOR"
      )
        sensorReady.add(value.index);
      else if (route === "/lab/os/ready") osReady = true;
      else if (
        route === "/lab/os/result" &&
        Number.isInteger(value.index) &&
        scenario.timeline[value.index]?.action.type === "LIFECYCLE" &&
        ["PASS", "FAIL", "UNSUPPORTED"].includes(value.state)
      ) {
        if (!osResults.has(value.index))
          osResults.set(value.index, { index: value.index, action: "LIFECYCLE", state: value.state });
        if (osCurrent?.index === value.index) osCurrent = null;
      } else if (route === "/lab/ready") {
        ready =
          (["GRANTED", "APPROXIMATE", "DENIED", "PROMPTABLE"].includes(value.permission) ||
            (scenario.worldspace === "VIRTUAL" && value.permission === "NOT_REQUIRED")) &&
          value.publicShellControlled === true;
        startups.push({
          restarted: value.restarted === true,
          leaseRestored: value.leaseRestored === true,
          publicShellControlled: value.publicShellControlled === true,
        });
      } else if (route === "/lab/error") {
        clientError = true;
        if (typeof value.reason === "string" && /^[A-Z_]{1,128}$/.test(value.reason)) clientErrorReason = value.reason;
      } else if (
        route === "/lab/result" &&
        Number.isInteger(value.index) &&
        value.index >= 0 &&
        value.index < scenario.timeline.length &&
        ["PASS", "FAIL", "UNSUPPORTED"].includes(value.state)
      ) {
        if (
          !Number.isInteger(value.completionRequests) ||
          value.completionRequests < 0 ||
          value.completionRequests > 128
        ) {
          response.statusCode = 400;
          response.end();
          return;
        }
        maximumCompletionRequests = Math.max(maximumCompletionRequests, value.completionRequests);
        if (scenario.timeline[value.index].action.type === "LOCATION" && value.locationDiagnostic !== undefined) {
          const diagnostic = deviceLabLocationDiagnosticSchema.parse(value.locationDiagnostic);
          if (!locationDiagnostics.some((entry) => entry.index === value.index))
            locationDiagnostics.push({ index: value.index, diagnostic });
        }
        if (!results.has(value.index))
          results.set(value.index, {
            index: value.index,
            action: scenario.timeline[value.index].action.type,
            state: value.state,
            ...(typeof value.reason === "string" && /^[A-Za-z_:]{1,128}$/.test(value.reason)
              ? { reason: value.reason }
              : {}),
          });
        if (current?.index === value.index) current = null;
      } else {
        response.statusCode = 400;
        response.end();
        return;
      }
      response.end("{}");
    } catch {
      response.statusCode = 400;
      response.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("LANDFALL_LAB_PORT_INVALID");
  const port = address.port;
  let ownedDevice: string | null = null;
  let androidSerial: string | null = null;
  let androidPowerMode: string | null = null;
  let androidLocationBaseline: string | null = null;
  let androidRotationBaseline: { automatic: string; rotation: string } | null = null;
  const androidSensorBaselines = new Map<AndroidControlledSensor, readonly number[]>();
  let foreground = true;
  let uiRunner: Promise<void> | null = null;
  const uiAbort = new AbortController();
  let uiFailed = false;
  let osVersion = host.osVersion;
  let runtimeVersion = host.nodeVersion;
  let deviceConfiguration: DeviceLabConfiguration | undefined;
  const remainingResources: string[] = [];
  const artifacts: { path: string; sha256: string; kind: "SCREENSHOT" | "TEST_RESULT" }[] = [];
  const adb = async (args: string[], timeout = 30000) => {
    if (!host.android.adb || !androidSerial) throw new Error("LANDFALL_ANDROID_NOT_CONFIGURED");
    return labTool(
      host.android.adb,
      ["-P", process.env.LANDFALL_LAB_ADB_PORT ?? "5037", "-s", androidSerial, ...args],
      timeout,
    );
  };
  const wait = async (predicate: () => boolean, budget: number) => {
    const deadline = Date.now() + budget;
    while (!predicate()) {
      if (clientError) throw new Error(clientErrorReason);
      if (uiFailed) throw new Error("LANDFALL_NATIVE_UI_DRIVER_FAILED");
      if (Date.now() > deadline) throw new Error("LANDFALL_NATIVE_CLIENT_TIMEOUT");
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  };
  const steps: DeviceLabStepResult[] = [];
  let executionStage = "SETUP";
  try {
    if (target === "android-emulator") {
      if (!host.android.adb) throw new Error("LANDFALL_ANDROID_NOT_CONFIGURED");
      androidSerial = process.env.LANDFALL_LAB_ANDROID_SERIAL ?? null;
      if (!androidSerial && process.env.GITHUB_ACTIONS === "true") {
        const devices = (await labTool(host.android.adb, ["devices"]))
          .split(/\r?\n/)
          .map((line) => line.split(/\s+/)[0])
          .filter((serial) => /^emulator-[0-9]+$/.test(serial));
        if (devices.length === 1) androidSerial = devices[0];
      }
      if (!androidSerial || !/^emulator-[0-9]+$/.test(androidSerial))
        throw new Error("LANDFALL_OWNED_ANDROID_REQUIRED");
      osVersion = (await adb(["shell", "getprop", "ro.build.version.release"])).trim();
      const api = Number((await adb(["shell", "getprop", "ro.build.version.sdk"])).trim());
      const memory = /MemTotal:\s+([0-9]+)\s+kB/.exec(await adb(["shell", "cat", "/proc/meminfo"]));
      const size = /(?:Override|Physical) size:\s*([0-9]+)x([0-9]+)/g;
      const sizes = [...(await adb(["shell", "wm", "size"])).matchAll(size)];
      const densities = [
        ...(await adb(["shell", "wm", "density"])).matchAll(/(?:Override|Physical) density:\s*([0-9]+)/g),
      ];
      const measuredSize = sizes.at(-1);
      deviceConfiguration = deviceLabConfigurationSchema.parse({
        platform: "ANDROID",
        virtual: true,
        api,
        model: (await adb(["shell", "getprop", "ro.product.model"])).trim(),
        memoryKiB: Number(memory?.[1]),
        widthPixels: Number(measuredSize?.[1]),
        heightPixels: Number(measuredSize?.[2]),
        densityDpi: Number(densities.at(-1)?.[1]),
      });
      runtimeVersion = `Android API ${api}; ${host.android.emulatorVersion}`;
      validateDeviceLabProfile(profile, deviceConfiguration);
      if (scenario.worldspace === "PHYSICAL" && scenario.timeline.some((step) => step.action.type === "LOCATION")) {
        androidLocationBaseline = (await adb(["shell", "cmd", "location", "is-location-enabled"])).trim();
        if (!["true", "false"].includes(androidLocationBaseline))
          throw new Error("ANDROID_LOCATION_BASELINE_UNAVAILABLE");
        await adb(["shell", "cmd", "location", "set-location-enabled", "true"]);
        if ((await adb(["shell", "cmd", "location", "is-location-enabled"])).trim() !== "true")
          throw new Error("ANDROID_LOCATION_SETTING_NOT_OBSERVED");
      }
      await adb([
        "install",
        "-r",
        path.join(root, "native", "android", "app", "build", "outputs", "apk", "debug", "app-debug.apk"),
      ]);
      await adb(["shell", "pm", "grant", "com.voyagewright.landfall", "android.permission.ACCESS_COARSE_LOCATION"]);
      await adb(["shell", "pm", "grant", "com.voyagewright.landfall", "android.permission.ACCESS_FINE_LOCATION"]);
      await adb(["shell", "input", "keyevent", "82"]);
      await adb(["reverse", `tcp:${port}`, `tcp:${port}`]);
      await adb(["shell", "am", "force-stop", "com.voyagewright.landfall"]);
      await adb([
        "shell",
        "am",
        "start",
        "-n",
        "com.voyagewright.landfall/.LandfallActivity",
        "--es",
        "labOrigin",
        `http://127.0.0.1:${port}`,
      ]);
    } else {
      if (!host.apple.configured) throw new Error("LANDFALL_APPLE_NOT_CONFIGURED");
      const app = JSON.parse(
        await readFile(path.join(root, "artifacts", "landfall-device-lab", "apple-app.json"), "utf8"),
      );
      osVersion = app.runtime;
      runtimeVersion = host.apple.xcodeVersion ?? "UNAVAILABLE";
      if (app.profile !== profile) throw new Error("LANDFALL_LAB_PROFILE_MISMATCH");
      deviceConfiguration = deviceLabConfigurationSchema.parse({
        platform: "IOS",
        virtual: true,
        runtime: app.runtime,
        deviceType: app.deviceType,
      });
      validateDeviceLabProfile(profile, deviceConfiguration);
      ownedDevice = (
        await labTool("xcrun", ["simctl", "create", `landfall-os-${process.pid}`, app.deviceType, app.runtime])
      ).trim();
      if (!/^[A-Fa-f0-9-]{36}$/.test(ownedDevice)) throw new Error("LANDFALL_APPLE_DEVICE_ID_INVALID");
      await labTool("xcrun", ["simctl", "boot", ownedDevice]);
      executionStage = "APPLE_BOOT";
      await labTool("xcrun", ["simctl", "bootstatus", ownedDevice, "-b"], 420000);
      executionStage = "APPLE_INSTALL";
      await labTool("xcrun", ["simctl", "install", ownedDevice, app.app], 120000);
      executionStage = "APPLE_PERMISSION";
      await labTool(
        "xcrun",
        ["simctl", "privacy", ownedDevice, "grant", "location", "com.voyagewright.landfall"],
        60000,
      );
      executionStage = "APPLE_LAUNCH";
      await labTool(
        "xcrun",
        [
          "simctl",
          "launch",
          ownedDevice,
          "com.voyagewright.landfall",
          `--landfall-lab-origin=http://127.0.0.1:${port}`,
        ],
        60000,
      );
      if (scenario.timeline.some((step) => step.action.type === "LIFECYCLE")) {
        uiRunner = labTool(
          "xcodebuild",
          [
            "-quiet",
            "-project",
            path.join(root, "native", "ios", "LandfallCompanion.xcodeproj"),
            "-scheme",
            "LandfallCompanion",
            "-destination",
            `platform=iOS Simulator,id=${ownedDevice}`,
            "-derivedDataPath",
            path.join(root, "artifacts", "landfall-device-lab", "apple-build", "DerivedData"),
            "-resultBundlePath",
            path.join(destination, "NativeLifecycle.xcresult"),
            "-only-testing:LandfallCompanionUiTests/NativeLifecycleTests/testCanonicalScenarioOperations",
            "CODE_SIGNING_ALLOWED=YES",
            "CODE_SIGN_IDENTITY=-",
            `LANDFALL_LAB_ORIGIN=http://127.0.0.1:${port}`,
            "test-without-building",
          ],
          2100000,
          uiAbort.signal,
        )
          .then(() => undefined)
          .catch(() => {
            uiFailed = true;
          });
        await wait(() => osReady, 120000);
      }
    }
    await wait(() => ready, 60000);
    const timelineStartedAt = Date.now();
    for (const [index, step] of scenario.timeline.entries()) {
      executionStage = `STEP_${index}_${step.action.type}`;
      const remaining = timelineStartedAt + step.atMs - Date.now();
      if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
      if (
        step.action.type === "ASSERT" &&
        ["serverConfirmed", "canonicalProgressionEvents", "completionRequests"].includes(step.action.field)
      ) {
        const counts = await authority.counts();
        const actual =
          step.action.field === "completionRequests"
            ? maximumCompletionRequests
            : step.action.field === "serverConfirmed"
              ? counts.canonicalProgressionEvents > 0
              : counts.canonicalProgressionEvents;
        steps.push({
          index,
          action: "ASSERT",
          state: actual === step.action.value ? "PASS" : "FAIL",
          ...(actual === step.action.value ? {} : { reason: "NATIVE_CANONICAL_COUNT_MISMATCH" }),
        });
        continue;
      }
      if (step.action.type === "LIFECYCLE") {
        const action = step.action;
        if (action.state === "RELAUNCH") ready = false;
        if (target === "ios-simulator") {
          if (
            !["DEFAULT", "FORCE_STOP", undefined].includes(action.operation) ||
            !["FOREGROUND", "BACKGROUND", "TERMINATED", "RELAUNCH"].includes(action.state)
          ) {
            steps.push({ index, action: "LIFECYCLE", state: "UNSUPPORTED", reason: "SIMULATOR_LIFECYCLE_UNSUPPORTED" });
            continue;
          }
          osCurrent = { index, action };
          await wait(() => osResults.has(index), 30000);
          const result = osResults.get(index)!;
          if (result.state !== "PASS") {
            steps.push(result);
            continue;
          }
        } else if (action.state === "FOREGROUND" || action.state === "RELAUNCH") {
          if (action.operation === "REBOOT") {
            steps.push({ index, action: "LIFECYCLE", state: "UNSUPPORTED", reason: "ANDROID_RECREATE_NOT_CONFIGURED" });
            continue;
          }
          if (action.operation === "ACTIVITY_RECREATE") {
            const before = startups.length;
            const pid = (await adb(["shell", "pidof", "com.voyagewright.landfall"])).trim();
            if (!/^[0-9]+$/.test(pid)) throw new Error("ANDROID_OWNED_APP_PID_INVALID");
            const automatic = (await adb(["shell", "settings", "get", "system", "accelerometer_rotation"])).trim();
            const rotation = (await adb(["shell", "settings", "get", "system", "user_rotation"])).trim();
            if (!["0", "1"].includes(automatic) || !["0", "1", "2", "3"].includes(rotation))
              throw new Error("ANDROID_ROTATION_BASELINE_UNAVAILABLE");
            androidRotationBaseline ??= { automatic, rotation };
            await adb(["shell", "settings", "put", "system", "accelerometer_rotation", "0"]);
            await adb(["shell", "settings", "put", "system", "user_rotation", String((Number(rotation) + 1) % 4)]);
            await wait(() => ready && startups.length > before, 60000);
            if ((await adb(["shell", "pidof", "com.voyagewright.landfall"])).trim() !== pid)
              throw new Error("ANDROID_RECREATION_CHANGED_PROCESS");
          } else if (action.state === "RELAUNCH") {
            await adb(["shell", "am", "force-stop", "com.voyagewright.landfall"]);
            const pid = await adb(["shell", "pidof", "com.voyagewright.landfall"]).catch((error: { code?: number }) =>
              error.code === 1 ? "" : "UNVERIFIED",
            );
            if (pid.trim()) throw new Error("ANDROID_TERMINATION_NOT_OBSERVED");
          }
          if (action.operation !== "ACTIVITY_RECREATE") {
            await adb(["shell", "input", "keyevent", "224"]);
            await adb(["shell", "input", "keyevent", "82"]);
            await adb([
              "shell",
              "am",
              "start",
              "-n",
              "com.voyagewright.landfall/.LandfallActivity",
              "--es",
              "labOrigin",
              `http://127.0.0.1:${port}`,
            ]);
          }
        } else if (action.state === "BACKGROUND") {
          await adb(["shell", "input", "keyevent", "3"]);
          const activity = await adb(["shell", "dumpsys", "activity", "activities"]);
          const resumed = activity
            .split(/\r?\n/)
            .filter((line) => /(?:mResumedActivity|topResumedActivity)/.test(line));
          if (!resumed.length || resumed.some((line) => line.includes("com.voyagewright.landfall")))
            throw new Error("ANDROID_BACKGROUND_NOT_OBSERVED");
        } else if (action.state === "SCREEN_LOCKED") {
          await adb(["shell", "input", "keyevent", "223"]);
          let asleep = false;
          for (let attempt = 0; attempt < 30 && !asleep; attempt++) {
            const power = await adb(["shell", "dumpsys", "power"]);
            asleep = /mWakefulness=Asleep|state=OFF/.test(power);
            if (!asleep) await new Promise((resolve) => setTimeout(resolve, 100));
          }
          if (!asleep) throw new Error("ANDROID_SCREEN_OFF_NOT_OBSERVED");
        } else if (action.state === "TERMINATED") {
          if (action.operation === "PROCESS_KILL") {
            const pid = (await adb(["shell", "pidof", "com.voyagewright.landfall"])).trim();
            if (!/^[0-9]+$/.test(pid)) throw new Error("ANDROID_OWNED_APP_PID_INVALID");
            await adb(["shell", "run-as", "com.voyagewright.landfall", "kill", "-9", pid]);
          } else await adb(["shell", "am", "force-stop", "com.voyagewright.landfall"]);
          const pid = await adb(["shell", "pidof", "com.voyagewright.landfall"]).catch((error: { code?: number }) =>
            error.code === 1 ? "" : "UNVERIFIED",
          );
          if (pid.trim()) throw new Error("ANDROID_TERMINATION_NOT_OBSERVED");
        } else {
          steps.push({ index, action: "LIFECYCLE", state: "UNSUPPORTED", reason: "NATIVE_SUSPENSION_UNSUPPORTED" });
          continue;
        }
        foreground = ["FOREGROUND", "RELAUNCH"].includes(action.state);
        if (foreground) {
          await wait(() => ready, 60000);
          current = { index, action };
          await wait(() => results.has(index), 30000);
          steps.push(results.get(index)!);
        } else steps.push({ index, action: "LIFECYCLE", state: "PASS" });
        continue;
      }
      if (!foreground) {
        steps.push({ index, action: step.action.type, state: "UNSUPPORTED", reason: "FRESH_FOREGROUND_REQUIRED" });
        continue;
      }
      if (step.action.type === "SENSOR") {
        const control = androidSensorControl(step.action);
        const status = target === "android-emulator" && control ? await adb(["emu", "sensor", "status"]) : "";
        if (target !== "android-emulator" || !control || !status.includes(`${control.sensor}: enabled.`)) {
          steps.push({ index, action: "SENSOR", state: "UNSUPPORTED", reason: "OS_SENSOR_CONTROL_UNAVAILABLE" });
          continue;
        }
        const controls = [{ sensor: control.sensor, values: control.values }, ...(control.drivingInputs ?? [])];
        if (controls.some((input) => !status.includes(`${input.sensor}: enabled.`))) {
          steps.push({ index, action: "SENSOR", state: "UNSUPPORTED", reason: "OS_SENSOR_CONTROL_UNAVAILABLE" });
          continue;
        }
        for (const input of controls)
          if (!androidSensorBaselines.has(input.sensor))
            androidSensorBaselines.set(
              input.sensor,
              readAndroidSensorValues(input.sensor, await adb(["emu", "sensor", "get", input.sensor])),
            );
        current = { index, action: step.action };
        await wait(() => sensorReady.has(index) || results.has(index), 30000);
        for (const input of controls) {
          await adb(["emu", "sensor", "set", input.sensor, input.values.join(":")]);
          const measured = readAndroidSensorValues(input.sensor, await adb(["emu", "sensor", "get", input.sensor]));
          if (measured.some((value, i) => Math.abs(value - input.values[i]) > 0.02))
            throw new Error("ANDROID_SENSOR_CONTROL_NOT_OBSERVED");
        }
        await wait(() => results.has(index), 30000);
        steps.push(results.get(index)!);
        continue;
      }
      if (step.action.type === "PERMISSION") {
        const action = step.action;
        if (
          scenario.worldspace !== "PHYSICAL" ||
          action.permission !== "FOREGROUND_LOCATION" ||
          !["GRANTED", "APPROXIMATE", "DENIED", "REVOKED"].includes(action.state) ||
          (target === "ios-simulator" && action.state === "APPROXIMATE")
        ) {
          steps.push({
            index,
            action: "PERMISSION",
            state: "UNSUPPORTED",
            reason: "OS_PERMISSION_CONTROL_UNSUPPORTED",
          });
          continue;
        }
        if (target === "android-emulator") {
          // Android may terminate the app when a runtime grant is revoked. The
          // owned launcher restores the lab origin, never assumes the old page survived.
          ready = false;
          const granted = action.state === "GRANTED";
          const coarse = granted || action.state === "APPROXIMATE";
          await adb([
            "shell",
            "pm",
            granted ? "grant" : "revoke",
            "com.voyagewright.landfall",
            "android.permission.ACCESS_FINE_LOCATION",
          ]);
          await adb([
            "shell",
            "pm",
            coarse ? "grant" : "revoke",
            "com.voyagewright.landfall",
            "android.permission.ACCESS_COARSE_LOCATION",
          ]);
          const packageState = await adb(["shell", "dumpsys", "package", "com.voyagewright.landfall"]);
          for (const [permission, expected] of [
            ["ACCESS_FINE_LOCATION", granted],
            ["ACCESS_COARSE_LOCATION", coarse],
          ] as const) {
            if (!packageState.includes(`android.permission.${permission}: granted=${expected}`))
              throw new Error("ANDROID_PERMISSION_CONTROL_NOT_OBSERVED");
          }
          await adb(["shell", "am", "force-stop", "com.voyagewright.landfall"]);
          await adb([
            "shell",
            "am",
            "start",
            "-n",
            "com.voyagewright.landfall/.LandfallActivity",
            "--es",
            "labOrigin",
            `http://127.0.0.1:${port}`,
          ]);
          await wait(() => ready, 60000);
        } else {
          await labTool(
            "xcrun",
            [
              "simctl",
              "privacy",
              ownedDevice!,
              action.state === "GRANTED" ? "grant" : "revoke",
              "location",
              "com.voyagewright.landfall",
            ],
            60000,
          );
        }
      }
      if (step.action.type === "POWER") {
        const action = step.action;
        if (target !== "android-emulator" || action.thermal || action.doze) {
          steps.push({ index, action: "POWER", state: "UNSUPPORTED", reason: "NATIVE_POWER_INJECTION_UNSUPPORTED" });
          continue;
        }
        if (androidPowerMode === null) {
          androidPowerMode = (await adb(["shell", "settings", "get", "global", "low_power"])).trim();
          if (!["0", "1"].includes(androidPowerMode)) throw new Error("ANDROID_POWER_BASELINE_UNAVAILABLE");
        }
        await adb(["shell", "cmd", "power", "set-mode", "0"]);
        await adb(["shell", "dumpsys", "battery", "set", "-f", "ac", action.charging ? "1" : "0"]);
        await adb(["shell", "dumpsys", "battery", "set", "-f", "usb", "0"]);
        await adb(["shell", "dumpsys", "battery", "set", "-f", "level", String(action.batteryPercent)]);
        await adb(["shell", "cmd", "power", "set-mode", action.saver ? "1" : "0"]);
      }
      if (
        step.action.type === "NETWORK" &&
        target === "android-emulator" &&
        step.action.latencyMs === 0 &&
        ["OFFLINE", "ONLINE"].includes(step.action.state)
      ) {
        network = step.action.state;
        await adb(["shell", "svc", "wifi", network === "ONLINE" ? "enable" : "disable"]);
        await adb(["shell", "svc", "data", network === "ONLINE" ? "enable" : "disable"]);
      } else if (
        step.action.type === "NETWORK" &&
        target === "ios-simulator" &&
        step.action.latencyMs === 0 &&
        ["OFFLINE", "ONLINE"].includes(step.action.state)
      ) {
        // Simulator cannot disable the host network safely. The first-party service
        // fault is controlled here; iOS radio fidelity remains explicitly external.
        network = step.action.state;
      }
      if (!["LOCATION", "ASSERT", "NETWORK", "RECONCILE", "POWER", "PERMISSION"].includes(step.action.type)) {
        steps.push({
          index,
          action: step.action.type,
          state: "UNSUPPORTED",
          reason: "NATIVE_OS_TRANSLATION_UNAVAILABLE",
        });
        continue;
      }
      current = { index, action: step.action };
      if (step.action.type === "LOCATION" && step.action.coordinate.type === "WGS84") {
        const coordinate = step.action.coordinate;
        await wait(() => locationReady.has(index) || results.has(index), 30000);
        if (results.has(index)) {
          steps.push(results.get(index)!);
          continue;
        }
        if (target === "android-emulator")
          await adb(["emu", "geo", "fix", String(coordinate.longitude), String(coordinate.latitude)]);
        else {
          const deadline = Date.now() + 150000;
          while (!results.has(index) && Date.now() < deadline) {
            await labTool(
              "xcrun",
              ["simctl", "location", ownedDevice!, "set", `${coordinate.latitude},${coordinate.longitude}`],
              60000,
            );
            if (!results.has(index)) await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }
      }
      await wait(() => results.has(index), step.action.type === "LOCATION" ? 130000 : 30000);
      steps.push(results.get(index)!);
    }
    const screenshot = path.join(destination, "native-final.png");
    executionStage = "SCREENSHOT";
    if (target === "android-emulator") {
      // A transient ADB reconnect after an OS task switch must finish before
      // capture; waiting is transport recovery, never a substitute for assertions.
      await adb(["wait-for-device"], 30000);
      executionStage = "ANDROID_SCREEN_CAPTURE";
      const png = await labBinaryTool(host.android.adb!, [
        "-P",
        process.env.LANDFALL_LAB_ADB_PORT ?? "5037",
        "-s",
        androidSerial!,
        "exec-out",
        "screencap",
        "-p",
      ]);
      if (png.length < 24 || !png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
        throw new Error("ANDROID_SCREEN_CAPTURE_INVALID_PNG");
      await writeFile(screenshot, png);
    } else await labTool("xcrun", ["simctl", "io", ownedDevice!, "screenshot", screenshot]);
    artifacts.push({
      path: screenshot,
      sha256: createHash("sha256")
        .update(await readFile(screenshot))
        .digest("hex"),
      kind: "SCREENSHOT",
    });
  } catch (error) {
    const tool =
      error && typeof error === "object"
        ? (error as { code?: unknown; killed?: unknown; signal?: unknown; stderr?: unknown; stdout?: unknown })
        : {};
    const diagnostic = path.join(destination, "execution-error.json");
    const output = [tool.stderr, tool.stdout].filter((value): value is string => typeof value === "string").join("\n");
    await writeFile(
      diagnostic,
      JSON.stringify(
        {
          stage: executionStage,
          code: typeof tool.code === "number" ? tool.code : null,
          killed: tool.killed === true,
          signal: typeof tool.signal === "string" && /^[A-Z0-9]+$/.test(tool.signal) ? tool.signal : null,
          category: /device offline/.test(output)
            ? "DEVICE_OFFLINE"
            : /no devices|device .* not found/.test(output)
              ? "DEVICE_UNAVAILABLE"
              : /Permission denied/.test(output)
                ? "TOOL_PERMISSION"
                : "TOOL_OR_CLIENT_FAILURE",
          diagnosticHash: createHash("sha256").update(output).digest("hex"),
        },
        null,
        2,
      ),
    );
    artifacts.push({
      path: diagnostic,
      sha256: createHash("sha256")
        .update(await readFile(diagnostic))
        .digest("hex"),
      kind: "TEST_RESULT",
    });
    steps.push({
      index: steps.length,
      action: scenario.timeline[Math.min(steps.length, scenario.timeline.length - 1)].action.type,
      state: "FAIL",
      reason:
        error instanceof Error && /^[A-Z_]{1,128}$/.test(error.message) ? error.message : "NATIVE_OS_EXECUTION_FAILED",
    });
  } finally {
    const locationFile = path.join(destination, "native-location-diagnostics.json");
    await writeFile(locationFile, JSON.stringify(locationDiagnostics, null, 2));
    artifacts.push({
      path: locationFile,
      sha256: createHash("sha256")
        .update(await readFile(locationFile))
        .digest("hex"),
      kind: "TEST_RESULT",
    });
    const startupFile = path.join(destination, "native-startups.json");
    await writeFile(startupFile, JSON.stringify(startups, null, 2));
    artifacts.push({
      path: startupFile,
      sha256: createHash("sha256")
        .update(await readFile(startupFile))
        .digest("hex"),
      kind: "TEST_RESULT",
    });
    stop = true;
    if (uiRunner) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const done = await Promise.race([
        uiRunner.then(() => true),
        new Promise<boolean>((resolve) => {
          timer = setTimeout(() => resolve(false), 30000);
        }),
      ]);
      clearTimeout(timer);
      if (!done) {
        uiAbort.abort();
        await uiRunner;
      }
      if (!done || uiFailed)
        steps.push({
          index: scenario.timeline.length - 1,
          action: "LIFECYCLE",
          state: "FAIL",
          reason: "NATIVE_UI_DRIVER_FAILED",
        });
    }
    if (androidSerial)
      await adb(["wait-for-device"], 30000).catch(() => remainingResources.push("android-adb-transport"));
    if (androidSerial) await adb(["shell", "am", "force-stop", "com.voyagewright.landfall"]).catch(() => undefined);
    if (androidSerial) await adb(["reverse", "--remove", `tcp:${port}`]).catch(() => undefined);
    if (androidSerial) {
      if (androidRotationBaseline !== null) {
        for (const [key, value] of [
          ["accelerometer_rotation", androidRotationBaseline.automatic],
          ["user_rotation", androidRotationBaseline.rotation],
        ]) {
          await adb(["shell", "settings", "put", "system", key, value]).catch(() =>
            remainingResources.push(`android-rotation-${key}`),
          );
          if ((await adb(["shell", "settings", "get", "system", key]).catch(() => "UNVERIFIED")).trim() !== value)
            remainingResources.push(`android-rotation-baseline-${key}`);
        }
      }
      if (androidLocationBaseline !== null) {
        await adb(["shell", "cmd", "location", "set-location-enabled", androidLocationBaseline]).catch(() =>
          remainingResources.push("android-location-fixture"),
        );
        if (
          (await adb(["shell", "cmd", "location", "is-location-enabled"]).catch(() => "UNVERIFIED")).trim() !==
          androidLocationBaseline
        )
          remainingResources.push("android-location-baseline");
      }
      for (const [sensor, values] of androidSensorBaselines) {
        try {
          await adb(["emu", "sensor", "set", sensor, values.join(":")]);
          const restored = readAndroidSensorValues(sensor, await adb(["emu", "sensor", "get", sensor]));
          if (restored.some((value, i) => Math.abs(value - values[i]) > 0.02))
            remainingResources.push(`android-sensor-${sensor}`);
        } catch {
          remainingResources.push(`android-sensor-${sensor}`);
        }
      }
      if (androidPowerMode !== null) {
        await adb(["shell", "dumpsys", "battery", "reset", "-f"]).catch(() =>
          remainingResources.push("android-battery-fixture"),
        );
        await adb(["shell", "cmd", "power", "set-mode", androidPowerMode]).catch(() =>
          remainingResources.push("android-power-fixture"),
        );
        const restored = (
          await adb(["shell", "settings", "get", "global", "low_power"]).catch(() => "UNVERIFIED")
        ).trim();
        if (restored !== androidPowerMode) remainingResources.push("android-power-baseline");
      }
      const cleared = await adb(["shell", "pm", "clear", "com.voyagewright.landfall"]).catch(() => "FAIL");
      if (!cleared.includes("Success")) remainingResources.push("native-app-private-data");
      await adb(["shell", "svc", "wifi", "enable"]).catch(() => undefined);
      await adb(["shell", "svc", "data", "enable"]).catch(() => undefined);
    }
    if (androidSerial) {
      const active = await adb(["shell", "pidof", "com.voyagewright.landfall"]).catch(
        (error: { stdout?: string; code?: number }) => {
          if (error.code === 1 && !error.stdout?.trim()) return "";
          return "UNVERIFIED";
        },
      );
      if (active.trim()) remainingResources.push("native-app-process");
      const reverse = await adb(["reverse", "--list"]).catch(() => "UNVERIFIED");
      if (reverse === "UNVERIFIED" || reverse.split(/\s+/).includes(`tcp:${port}`))
        remainingResources.push("owned-adb-reverse");
    }
    if (ownedDevice) {
      await labTool("xcrun", ["simctl", "shutdown", ownedDevice]).catch(() => undefined);
      await labTool("xcrun", ["simctl", "delete", ownedDevice]).catch(() => undefined);
      const devices = await labTool("xcrun", ["simctl", "list", "devices", "--json"]).catch(() => "UNVERIFIED");
      if (devices === "UNVERIFIED" || devices.includes(ownedDevice)) remainingResources.push(ownedDevice);
    }
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (server.listening) remainingResources.push("loopback-native-lab-server");
    try {
      const counts = await authority.counts();
      canonicalProgressionEvents = counts.canonicalProgressionEvents;
      if (counts.rawLocationsRetained)
        steps.push({
          index: scenario.timeline.length - 1,
          action: "ASSERT",
          state: "FAIL",
          reason: "LANDFALL_NATIVE_RAW_LOCATION_RETAINED",
        });
      const file = path.join(destination, "authority", "receipt.json");
      await writeFile(
        file,
        JSON.stringify({ fixtureHash: authority.fixtureHash, counts, clock: "NATIVE_UNMODIFIED_TIMESTAMPS" }, null, 2),
      );
      artifacts.push({
        path: file,
        sha256: createHash("sha256")
          .update(await readFile(file))
          .digest("hex"),
        kind: "TEST_RESULT",
      });
    } catch {
      remainingResources.push("unverified-one-voyage-counts");
    }
    if (!(await authority.cleanup())) remainingResources.push("one-voyage-authority");
  }
  await mkdir(destination, { recursive: true });
  for (const result of steps) {
    const action = scenario.timeline[result.index]?.action;
    result.translation =
      action?.type === "SENSOR"
        ? {
            method: "OS_SENSOR_CONTROL",
            limitation:
              "Controlled virtual sensor vectors traverse SensorManager, the native bridge and production context adapter. Physical drift and environmental fidelity remain external.",
          }
        : action?.type === "PERMISSION" || result.reason === "OS_PERMISSION_PREVENTED_ACQUISITION"
          ? {
              method: "OS_PERMISSION_CONTROL",
              limitation:
                "Current native grants are checked without prompting. Android grant changes may terminate and relaunch the owned app; physical settings UX remains external.",
            }
          : action?.type === "LOCATION" && action.coordinate.type === "WGS84"
            ? {
                method: "OS_LOCATION_INJECTION",
                limitation:
                  "Virtual coordinate delivery does not prove field GPS accuracy, multipath or sensor physics.",
              }
            : action?.type === "LIFECYCLE"
              ? {
                  method: "OS_LIFECYCLE",
                  limitation: "Simulator/emulator lifecycle does not prove physical-device OEM suspension policy.",
                }
              : action?.type === "POWER"
                ? {
                    method: "OS_POWER_CONTROL",
                    limitation:
                      "Emulated OS constraints prove adaptation, not physical heat, battery endurance or OEM policy.",
                  }
                : action?.type === "NETWORK"
                  ? target === "android-emulator"
                    ? {
                        method: "OS_NETWORK_AND_SERVICE_FAULT",
                        limitation:
                          "Virtual radios are controlled; owned loopback transport remains available to the test control plane.",
                      }
                    : {
                        method: "CONTROLLED_SERVICE_FAULT",
                        limitation:
                          "The owned first-party service is faulted. The simulator does not disable the host network or prove iOS radio behavior.",
                      }
                  : action?.type === "RECONCILE" ||
                      (action?.type === "ASSERT" &&
                        ["serverConfirmed", "canonicalProgressionEvents"].includes(action.field))
                    ? { method: "REAL_CANONICAL_AUTHORITY" }
                    : { method: "SHARED_WEB_CONTRACT" };
  }
  const cleanup = {
    result: remainingResources.length ? ("FAIL" as const) : ("PASS" as const),
    ownedResources: [
      "loopback-native-lab-server",
      ...(ownedDevice ? [ownedDevice] : []),
      ...(androidSerial
        ? [
            "native-app-process",
            "native-app-private-data",
            "owned-adb-reverse",
            ...[...androidSensorBaselines.keys()].map((sensor) => `android-sensor-${sensor}`),
            ...(androidPowerMode !== null ? ["android-power-fixture", "android-battery-fixture"] : []),
          ]
        : []),
    ],
    remainingResources,
  };
  await writeFile(path.join(destination, "native-steps.json"), JSON.stringify({ steps, cleanup }, null, 2));
  const stepsFile = path.join(destination, "native-steps.json");
  artifacts.push({
    path: stepsFile,
    sha256: createHash("sha256")
      .update(await readFile(stepsFile))
      .digest("hex"),
    kind: "TEST_RESULT",
  });
  return {
    steps,
    cleanup,
    artifacts,
    osVersion,
    runtimeVersion,
    deviceConfiguration,
    canonicalProgressionEvents,
    authorityFixtureHash: authority.fixtureHash,
  };
}

import { createServer } from "node:http";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { build } from "esbuild";
import { discoverDeviceLabHost, labBinaryTool, labTool } from "./host";
import { startDeviceLabAuthority } from "./authority-client";
import { deliverDeviceLabPosition } from "./location-control";
import { rebootOwnedAndroidGuest } from "../../../src/landfall/device-lab/android-reboot";
import { setOwnedAppleLabPosition } from "../../../src/landfall/device-lab/apple-location-input";
import { deviceLabSourceIdentity } from "./source";
import { inspectOwnedAndroidLocationAccuracy } from "./android-location-settings";
import { startOwnedAndroidFusedInput } from "./android-fused-input";
import {
  deviceLabStartupStageSchema,
  type DeviceLabStartupStage,
} from "../../../src/landfall/device-lab/startup-diagnostics";
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
  const cameraScenario = scenario.id === "qr-native-camera-valid";
  const appleNoticeScenario =
    ["apple-native-notification-background-return", "apple-native-notification-permission-denied"].includes(
      scenario.id,
    ) && target === "ios-simulator";
  const geofenceScenario =
    scenario.id === "geofence-native-background-wake" ||
    (appleNoticeScenario && scenario.id === "apple-native-notification-background-return");
  const appleNoticeNonce = appleNoticeScenario ? randomBytes(32).toString("base64url") : null;
  let appleNoticeReturnObserved = false;
  let appleNoticeOpenRequested = false;
  let cameraDiagnostic: Record<string, string | boolean> | null = null;
  let cameraStarted = false;
  let cameraFixture: {
    keyId: string;
    publicKey: JsonWebKey;
    scope: Record<string, string>;
    imageSha256: string;
    tokenSha256: string;
  } | null = null;
  if (cameraScenario && process.env.LANDFALL_LAB_CAMERA_BACKEND === "imagefile") {
    const fixture = JSON.parse(
      await readFile(path.join(root, "artifacts/landfall-device-lab/camera-fixture.json"), "utf8"),
    );
    const source = await deviceLabSourceIdentity();
    const imageHash = createHash("sha256")
      .update(await readFile(path.join(root, "artifacts/landfall-device-lab/camera-qr.png")))
      .digest("hex");
    if (
      fixture.synthetic !== true ||
      fixture.source?.sourceSha !== source.sourceSha ||
      fixture.source?.sourceFingerprint !== source.sourceFingerprint ||
      fixture.imageSha256 !== imageHash ||
      fixture.canComplete !== false
    )
      throw new Error("LANDFALL_CAMERA_FIXTURE_SOURCE_CHANGED");
    cameraFixture = fixture;
  }
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
  const authority = await startDeviceLabAuthority(
    path.join(destination, "authority"),
    scenario.worldspace,
    scenario.id,
  );
  let network = "ONLINE";
  let canonicalProgressionEvents: number | null = null;
  let ready = false;
  let maximumCompletionRequests = 0;
  const startups: { restarted: boolean; leaseRestored: boolean; publicShellControlled: boolean }[] = [];
  const guestReboots: {
    index: number;
    bootIdentityChanged: boolean;
    avdIdentityPreserved: boolean;
    elapsedMs: number;
  }[] = [];
  const geofenceControls: {
    index: number;
    phase: "OUTSIDE_BASELINE" | "INSIDE_TRANSITION";
    injections: number;
    elapsedMs: number;
    budgetMs: number;
  }[] = [];
  const appleInputDiagnostics: { index: number; phase: string; attempt: number; state: string }[] = [];
  let locationSettings: Awaited<ReturnType<typeof inspectOwnedAndroidLocationAccuracy>> | null = null;
  let fusedInput: Awaited<ReturnType<typeof startOwnedAndroidFusedInput>> | null = null;
  const fusedControls: { phase: string; delivered: number; mocking: boolean; state: string }[] = [];
  const readinessStartedAt = Date.now();
  const clientStages: { stage: DeviceLabStartupStage; elapsedMs: number }[] = [];
  const startupRequests = { documents: 0, workers: 0, scripts: 0 };
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
  const locationControls: {
    index: number;
    injections: number;
    elapsedMs: number;
    budgetMs: number;
    completed: boolean;
  }[] = [];
  const sensorReady = new Set<number>();
  const osResults = new Map<number, DeviceLabStepResult>();
  let appleNoticeUiDiagnostic: Record<string, number | boolean> | undefined;
  let osReady = false;
  let osCurrent: { index: number; action: unknown } | null = null;
  const server = createServer(async (request, response) => {
    const route = request.url?.split("?")[0];
    response.setHeader("Cache-Control", "no-store");
    if (request.method === "GET" && route === "/lab/notice-context" && appleNoticeScenario) {
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({ returnHandle: appleNoticeNonce }));
      return;
    }
    if (request.method === "GET" && route === "/player/landfall-return" && appleNoticeScenario) {
      const params = new URL(request.url!, "http://127.0.0.1").searchParams;
      const expectedOpen = scenario.timeline.findIndex(
        (step) => step.action.type === "NOTIFICATION" && step.action.operation === "OPEN",
      );
      if (
        !appleNoticeOpenRequested ||
        expectedOpen < 0 ||
        appleNoticeReturnObserved ||
        params.size !== 1 ||
        params.get("handle") !== appleNoticeNonce
      ) {
        response.statusCode = 400;
        response.end();
        return;
      }
      appleNoticeReturnObserved = true;
      response.statusCode = 302;
      response.setHeader("Location", "/player/");
      response.end();
      return;
    }
    if (request.method === "GET" && route === "/lab/camera-installation") {
      response.setHeader("Content-Type", "application/json");
      response.statusCode = cameraFixture ? 200 : 503;
      response.end(
        JSON.stringify(
          cameraFixture
            ? { keyId: cameraFixture.keyId, publicKey: cameraFixture.publicKey, scope: cameraFixture.scope }
            : { state: "NOT_CONFIGURED" },
        ),
      );
      return;
    }
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
      startupRequests.workers++;
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
      response.end(JSON.stringify({ worldspace: scenario.worldspace, scenarioId: scenario.id }));
      return;
    }
    if (
      request.method === "GET" &&
      (route === "/player/" ||
        route === "/player/offline-landfall" ||
        route === "/player/playthroughs/session-1/journal")
    ) {
      startupRequests.documents++;
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
      startupRequests.scripts++;
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
      if (route === "/lab/camera-started" && cameraScenario && cameraFixture) {
        cameraStarted = true;
        response.end("{}");
        return;
      }
      if (
        route === "/lab/camera-diagnostic" &&
        cameraScenario &&
        ["NOT_STARTED", "PUBLIC_KEY_IMPORT", "SCANNER_START", "NATIVE_RESULT", "VERIFIED"].includes(value.stage) &&
        ["NOT_RECEIVED", "VERIFIED", "DUPLICATE", "INVALID", "STOPPED", "EXPIRED"].includes(value.result) &&
        [
          "NotSupportedError",
          "SecurityError",
          "DataError",
          "OperationError",
          "AbortError",
          "TypeError",
          "OTHER",
        ].includes(value.failure) &&
        typeof value.cryptoAvailable === "boolean" &&
        typeof value.nativeBridgeAvailable === "boolean"
      ) {
        cameraDiagnostic = {
          stage: value.stage,
          result: value.result,
          failure: value.failure,
          cryptoAvailable: value.cryptoAvailable,
          nativeBridgeAvailable: value.nativeBridgeAvailable,
        };
        response.end("{}");
        return;
      }
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
      else if (route === "/lab/client-stage") {
        const stage = deviceLabStartupStageSchema.parse(value).stage;
        if (clientStages.length < 128) clientStages.push({ stage, elapsedMs: Date.now() - readinessStartedAt });
      } else if (route === "/lab/os/ready") osReady = true;
      else if (
        route === "/lab/os/result" &&
        Number.isInteger(value.index) &&
        (scenario.timeline[value.index]?.action.type === "LIFECYCLE" ||
          (appleNoticeScenario && scenario.timeline[value.index]?.action.type === "NOTIFICATION")) &&
        ["PASS", "FAIL", "UNSUPPORTED"].includes(value.state)
      ) {
        if (appleNoticeScenario && value.index === 5 && value.noticeUi) {
          const diagnostic = value.noticeUi;
          const countFields = [
            "buttonTitleCount",
            "openButtonCount",
            "tapAttempts",
            "combinedCardCount",
            "staticTitleCount",
          ];
          const flagFields = ["tapped", "foregroundObserved"];
          if (
            countFields.every(
              (key) => Number.isInteger(diagnostic[key]) && diagnostic[key] >= 0 && diagnostic[key] <= 64,
            ) &&
            flagFields.every((key) => typeof diagnostic[key] === "boolean")
          )
            appleNoticeUiDiagnostic = Object.fromEntries(
              [...countFields, ...flagFields].map((key) => [key, diagnostic[key]]),
            );
        }
        if (!osResults.has(value.index))
          osResults.set(value.index, {
            index: value.index,
            action: scenario.timeline[value.index].action.type,
            state: value.state,
          });
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
  const actionPerformance: {
    index: number;
    action: string;
    elapsedMs: number;
    preliminaryBudgetMs: number;
    state: string;
  }[] = [];
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
      if (geofenceScenario) {
        locationSettings = await inspectOwnedAndroidLocationAccuracy(adb);
        fusedInput = await startOwnedAndroidFusedInput(adb, root);
        await fusedInput.phase("OUTSIDE_BASELINE");
        await adb([
          "shell",
          "pm",
          "grant",
          "com.voyagewright.landfall",
          "android.permission.ACCESS_BACKGROUND_LOCATION",
        ]);
        await adb(["shell", "pm", "grant", "com.voyagewright.landfall", "android.permission.POST_NOTIFICATIONS"]);
      }
      if (cameraScenario && cameraFixture)
        await adb(["shell", "pm", "grant", "com.voyagewright.landfall", "android.permission.CAMERA"]);
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
        120000,
      );
      if (geofenceScenario)
        await labTool(
          "xcrun",
          ["simctl", "privacy", ownedDevice, "grant", "location-always", "com.voyagewright.landfall"],
          120000,
        );
      executionStage = "APPLE_LAUNCH";
      if (appleNoticeScenario || scenario.timeline.some((step) => step.action.type === "LIFECYCLE")) {
        // XCTest owns this launch. A preceding simctl launch could report a
        // ready WebView which XCTest immediately terminates and replaces.
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
        // Bounds XCTest's cold runner/install/launch startup. It is independent
        // of the unchanged WebView-ready and native action observation bounds.
        await wait(() => osReady, 240000);
      } else {
        await labTool(
          "xcrun",
          [
            "simctl",
            "launch",
            ownedDevice,
            "com.voyagewright.landfall",
            `--landfall-lab-origin=http://127.0.0.1:${port}`,
          ],
          120000,
        );
      }
    }
    await wait(() => ready, 60000);
    const timelineStartedAt = Date.now();
    for (const [index, step] of scenario.timeline.entries()) {
      executionStage = `STEP_${index}_${step.action.type}`;
      const remaining = timelineStartedAt + step.atMs - Date.now();
      if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
      const performanceStarted = performance.now();
      try {
        if (
          step.action.type === "ASSERT" &&
          ["serverConfirmed", "canonicalProgressionEvents", "completionRequests"].includes(step.action.field)
        ) {
          // Client request count is observed from the actual native page. Only
          // server confirmation/canonical events require a fresh database read.
          const counts = step.action.field === "completionRequests" ? null : await authority.counts();
          const actual =
            step.action.field === "completionRequests"
              ? maximumCompletionRequests
              : step.action.field === "serverConfirmed"
                ? counts!.canonicalProgressionEvents > 0
                : counts!.canonicalProgressionEvents;
          steps.push({
            index,
            action: "ASSERT",
            state: actual === step.action.value ? "PASS" : "FAIL",
            ...(actual === step.action.value ? {} : { reason: "NATIVE_CANONICAL_COUNT_MISMATCH" }),
          });
          continue;
        }
        if (appleNoticeScenario && step.action.type === "NOTIFICATION") {
          if (!["DELIVER", "OPEN"].includes(step.action.operation))
            throw new Error("NATIVE_NOTICE_OPERATION_UNSUPPORTED");
          const startupsBeforeNotice = startups.length;
          if (step.action.operation === "OPEN") {
            ready = false;
            appleNoticeOpenRequested = true;
          }
          osCurrent = { index, action: step.action };
          if (step.action.operation === "DELIVER") current = { index, action: step.action };
          await wait(() => osResults.has(index), 60000);
          const result = osResults.get(index)!;
          if (result.state !== "PASS") {
            appleNoticeOpenRequested = false;
            steps.push(result);
            continue;
          }
          if (step.action.operation === "DELIVER") {
            await wait(() => results.has(index), 30000);
            steps.push(results.get(index)!);
          } else {
            await wait(() => appleNoticeReturnObserved && ready && startups.length > startupsBeforeNotice, 45000);
            appleNoticeOpenRequested = false;
            foreground = true;
            steps.push(result);
          }
          continue;
        }
        if (step.action.type === "NATIVE_GEOFENCE" && step.action.operation === "ENTER") {
          if (foreground || !geofenceScenario) {
            steps.push({
              index,
              action: "NATIVE_GEOFENCE",
              state: "UNSUPPORTED",
              reason: "BACKGROUND_OS_GEOFENCE_REQUIRED",
            });
            continue;
          }
          // Initial triggers are deliberately disabled. Establish an outside
          // baseline after registration before requesting an enter transition.
          // Documented FLP mock inputs reach actual Play services geofencing;
          // the separate debug lab APK never invokes a Landfall receiver or callback.
          for (const phase of ["OUTSIDE_BASELINE", "INSIDE_TRANSITION"] as const) {
            if (target === "android-emulator") {
              if (!fusedInput) throw new Error("FUSED_INPUT_REQUIRED");
              await fusedInput.phase(phase);
            }
            const startedAt = Date.now(),
              budgetMs = 180000;
            let injections = 0;
            while (Date.now() - startedAt < budgetMs) {
              if (target === "android-emulator")
                await adb(["emu", "geo", "fix", "-72", phase === "OUTSIDE_BASELINE" ? "44.02" : "44"]);
              // simctl set holds its documented OS location until replaced.
              // Repeating the same fixed input adds tool processes, not fixes.
              else if (injections === 0)
                await setOwnedAppleLabPosition(
                  { deviceId: ownedDevice!, createdForScenario: true },
                  { latitude: phase === "OUTSIDE_BASELINE" ? 44.02 : 44, longitude: -72 },
                  {
                    run: (args, timeout) => labTool("xcrun", args, timeout),
                    delay: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
                    observe: (attempt, state) => appleInputDiagnostics.push({ index, phase, attempt, state }),
                  },
                );
              if (target === "android-emulator" || injections === 0) injections++;
              await new Promise((resolve) => setTimeout(resolve, 5000));
            }
            geofenceControls.push({ index, phase, injections, elapsedMs: Date.now() - startedAt, budgetMs });
            if (fusedInput) {
              const input = await fusedInput.read();
              fusedControls.push({
                phase: input.phase,
                delivered: input.delivered,
                mocking: input.mocking,
                state: input.state,
              });
            }
          }
          // This step proves only input delivery. A separate foreground assertion
          // must observe the native encrypted hint before the scenario can pass.
          steps.push({ index, action: "NATIVE_GEOFENCE", state: "PASS" });
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
              steps.push({
                index,
                action: "LIFECYCLE",
                state: "UNSUPPORTED",
                reason: "SIMULATOR_LIFECYCLE_UNSUPPORTED",
              });
              continue;
            }
            if (action.state === "RELAUNCH") {
              // XCTest's launch may wait for UI quiescence while this fixture
              // deliberately polls. Launch through the documented OS primitive;
              // XCTest and the restarted client still prove real foreground/state.
              await labTool(
                "xcrun",
                [
                  "simctl",
                  "launch",
                  ownedDevice!,
                  "com.voyagewright.landfall",
                  `--landfall-lab-origin=http://127.0.0.1:${port}`,
                ],
                30000,
              );
            }
            osCurrent = { index, action };
            // XCTest launch can outlast the earlier transport-only 30s wait.
            // Keep the acknowledgment inside the existing 120s lifecycle action
            // budget; subsequent client readiness and total action timing still
            // have their independent checks.
            await wait(() => osResults.has(index), 120000);
            const result = osResults.get(index)!;
            if (result.state !== "PASS") {
              steps.push(result);
              continue;
            }
          } else if (action.state === "FOREGROUND" || action.state === "RELAUNCH") {
            if (action.operation === "REBOOT") {
              const enabled =
                process.platform === "linux" &&
                process.env.GITHUB_ACTIONS === "true" &&
                process.env.RUNNER_ENVIRONMENT === "github-hosted" &&
                process.env.LANDFALL_LAB_GUEST_REBOOT === "true";
              if (!enabled) {
                steps.push({
                  index,
                  action: "LIFECYCLE",
                  state: "UNSUPPORTED",
                  reason: "EPHEMERAL_GUEST_REBOOT_REQUIRED",
                });
                continue;
              }
              const before = startups.length;
              guestReboots.push({
                index,
                ...(await rebootOwnedAndroidGuest(
                  {
                    ephemeralHostedLinux: enabled,
                    enabled,
                    virtual: deviceConfiguration?.virtual === true,
                    serial: androidSerial!,
                    port,
                  },
                  { adb, now: () => Date.now(), delay: (ms) => new Promise((resolve) => setTimeout(resolve, ms)) },
                )),
              });
              executionStage = "ANDROID_REBOOT_WAKE";
              await adb(["shell", "input", "keyevent", "224"]);
              executionStage = "ANDROID_REBOOT_UNLOCK";
              await adb(["shell", "input", "keyevent", "82"]);
              executionStage = "ANDROID_REBOOT_ACTIVITY_START";
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
              executionStage = "ANDROID_REBOOT_CLIENT_READY";
              await wait(() => ready && startups.length > before, 60000);
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
            } else if (action.state === "RELAUNCH" && action.operation !== "REBOOT") {
              await adb(["shell", "am", "force-stop", "com.voyagewright.landfall"]);
              const pid = await adb(["shell", "pidof", "com.voyagewright.landfall"]).catch(
                (error: { code?: number }) => (error.code === 1 ? "" : "UNVERIFIED"),
              );
              if (pid.trim()) throw new Error("ANDROID_TERMINATION_NOT_OBSERVED");
            }
            if (action.operation !== "ACTIVITY_RECREATE" && action.operation !== "REBOOT") {
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
            // HOME returns before the asynchronous task switch completes, especially
            // on a measured low-resource profile. Require actual OS state within a
            // bounded transition tolerance; never assume the command itself proves it.
            const deadline = Date.now() + 10000;
            let background = false;
            while (!background && Date.now() < deadline) {
              const activity = await adb(["shell", "dumpsys", "activity", "activities"]);
              const resumed = activity
                .split(/\r?\n/)
                .filter((line) => /(?:mResumedActivity|topResumedActivity)/.test(line));
              background = resumed.length > 0 && !resumed.some((line) => line.includes("com.voyagewright.landfall"));
              if (!background) await new Promise((resolve) => setTimeout(resolve, 100));
            }
            if (!background) throw new Error("ANDROID_BACKGROUND_NOT_OBSERVED");
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
        if (
          step.action.type === "INSTALLATION_TOKEN" &&
          (!cameraScenario || !cameraFixture || target !== "android-emulator")
        ) {
          steps.push({
            index,
            action: step.action.type,
            state: "UNSUPPORTED",
            reason: "NATIVE_CAMERA_FIXTURE_REQUIRED",
          });
          continue;
        }
        if (
          ![
            "LOCATION",
            "ASSERT",
            "NETWORK",
            "RECONCILE",
            "POWER",
            "PERMISSION",
            "INSTALLATION_TOKEN",
            "NATIVE_GEOFENCE",
          ].includes(step.action.type)
        ) {
          steps.push({
            index,
            action: step.action.type,
            state: "UNSUPPORTED",
            reason: "NATIVE_OS_TRANSLATION_UNAVAILABLE",
          });
          continue;
        }
        current = { index, action: step.action };
        if (cameraScenario && step.action.type === "INSTALLATION_TOKEN") {
          await wait(() => cameraStarted || results.has(index), 15000);
          if (cameraStarted && !results.has(index)) {
            // Only this public synthetic QR fixture can appear here. Capture the
            // actual preview; no decoded token or frame is passed to JavaScript.
            const deadline = Date.now() + 15000;
            while (!results.has(index) && Date.now() < deadline) {
              const raw = await adb(
                ["shell", "run-as", "com.voyagewright.landfall", "cat", "files/landfall-camera-debug.json"],
                5000,
              ).catch(() => "");
              try {
                if (raw.length <= 1024 && JSON.parse(raw).frames > 0) break;
              } catch {
                /* Initialization diagnostics can be absent briefly. */
              }
              await new Promise((resolve) => setTimeout(resolve, 250));
            }
            const file = path.join(destination, "native-camera-preview.png");
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
            await writeFile(file, png);
            artifacts.push({ path: file, sha256: createHash("sha256").update(png).digest("hex"), kind: "SCREENSHOT" });
          }
        }
        if (step.action.type === "LOCATION" && step.action.coordinate.type === "WGS84") {
          const coordinate = step.action.coordinate;
          await wait(() => locationReady.has(index) || results.has(index), 30000);
          if (results.has(index)) {
            steps.push(results.get(index)!);
            continue;
          }
          locationControls.push({
            index,
            ...(await deliverDeviceLabPosition({
              completed: () => results.has(index),
              inject: () =>
                target === "android-emulator"
                  ? adb(["emu", "geo", "fix", String(coordinate.longitude), String(coordinate.latitude)]).then(
                      () => undefined,
                    )
                  : setOwnedAppleLabPosition({ deviceId: ownedDevice!, createdForScenario: true }, coordinate, {
                      run: (args, timeout) => labTool("xcrun", args, timeout),
                      delay: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
                      observe: (attempt, state) =>
                        appleInputDiagnostics.push({ index, phase: "LOCATION", attempt, state }),
                    }),
            })),
          });
        }
        await wait(() => results.has(index), step.action.type === "LOCATION" ? 130000 : cameraScenario ? 45000 : 30000);
        steps.push(results.get(index)!);
      } finally {
        const elapsedMs = performance.now() - performanceStarted;
        const preliminaryBudgetMs =
          step.action.type === "NATIVE_GEOFENCE"
            ? 390000
            : step.action.type === "LOCATION"
              ? 150000
              : step.action.type === "LIFECYCLE" && step.action.operation === "REBOOT"
                ? 180000
                : 120000;
        const observed = steps.find((value) => value.index === index);
        if (observed?.state === "PASS" && elapsedMs > preliminaryBudgetMs) {
          observed.state = "FAIL";
          observed.reason = "NATIVE_ACTION_PERFORMANCE_BUDGET_EXCEEDED";
        }
        actionPerformance.push({
          index,
          action: step.action.type,
          elapsedMs,
          preliminaryBudgetMs,
          state: observed?.state ?? "INCOMPLETE",
        });
      }
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
                : /Can't find service: input|Service input not found/i.test(output)
                  ? "ANDROID_INPUT_SERVICE_UNAVAILABLE"
                  : /Can't find service: activity|Service activity not found/i.test(output)
                    ? "ANDROID_ACTIVITY_SERVICE_UNAVAILABLE"
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
    if (geofenceScenario && target === "android-emulator") {
      let nativeDiagnostic: { stage: string; failure: string } | null = null;
      let receiverDiagnostic: Record<string, number> | null = null;
      try {
        const raw = await adb([
          "shell",
          "run-as",
          "com.voyagewright.landfall",
          "cat",
          "files/landfall-geofence-receiver-debug.json",
        ]);
        const keys = [
          "received",
          "permissionDenied",
          "malformedOrError",
          "unsupportedTransition",
          "inactive",
          "appendRejected",
          "appended",
          "notices",
        ];
        if (raw.length <= 1024) {
          const value = JSON.parse(raw);
          if (
            Object.keys(value).length === keys.length &&
            keys.every((key) => Number.isInteger(value[key]) && value[key] >= 0 && value[key] <= 100000)
          )
            receiverDiagnostic = Object.fromEntries(keys.map((key) => [key, value[key]]));
        }
      } catch {
        /* Missing debug record is unobserved, not a fabricated zero stream. */
      }
      try {
        const raw = await adb([
          "shell",
          "run-as",
          "com.voyagewright.landfall",
          "cat",
          "files/landfall-geofence-debug.json",
        ]);
        if (raw.length <= 512) {
          const value = JSON.parse(raw);
          if (
            [
              "PRECONDITION_FAILED",
              "CONSENT_OR_GENERATION_CHANGED",
              "REMOVE_FAILED",
              "ADD_FAILED",
              "REGISTERED",
              "ADD_THROWN",
              "REMOVE_THROWN",
            ].includes(value.stage) &&
            [
              "NONE",
              "OTHER",
              "NOT_AVAILABLE",
              "TOO_MANY_REGIONS",
              "TOO_MANY_INTENTS",
              "INSUFFICIENT_LOCATION_PERMISSION",
              "OTHER_API_FAILURE",
            ].includes(value.failure)
          )
            nativeDiagnostic = { stage: value.stage, failure: value.failure };
        }
      } catch {
        /* Unobserved diagnostics are not inferred successful. */
      }
      const file = path.join(destination, "native-geofence-controls.json");
      await writeFile(
        file,
        JSON.stringify(
          {
            controls: geofenceControls,
            locationSettings,
            fusedControls,
            nativeDiagnostic,
            receiverDiagnostic,
            physicalTimingProven: false,
          },
          null,
          2,
        ),
      );
      artifacts.push({
        path: file,
        sha256: createHash("sha256")
          .update(await readFile(file))
          .digest("hex"),
        kind: "TEST_RESULT",
      });
    }
    if (cameraFixture) {
      let nativeDiagnostic: Record<string, number | string | boolean> | null = null;
      try {
        const raw = await adb([
          "shell",
          "run-as",
          "com.voyagewright.landfall",
          "cat",
          "files/landfall-camera-debug.json",
        ]);
        if (raw.length <= 1024) {
          const value = JSON.parse(raw);
          if (
            ["frames", "decoded", "errors"].every(
              (key) => Number.isInteger(value[key]) && value[key] >= 0 && value[key] <= 100000,
            ) &&
            typeof value.bound === "boolean" &&
            ["NOT_STARTED", "SCANNING", "EXPIRED", "DECODED", "BIND_FAILED", "STOPPED"].includes(value.outcome)
          )
            nativeDiagnostic = {
              frames: value.frames,
              decoded: value.decoded,
              errors: value.errors,
              bound: value.bound,
              outcome: value.outcome,
            };
        }
      } catch {
        /* Missing native diagnostics remain unknown. */
      }
      const file = path.join(destination, "native-camera-fixture.json");
      await writeFile(
        file,
        JSON.stringify(
          {
            acquisition: "EMULATOR_IMAGE_FILE_CAMERA",
            diagnostic: cameraDiagnostic,
            nativeDiagnostic,
            imageSha256: cameraFixture.imageSha256,
            tokenSha256: cameraFixture.tokenSha256,
            physicalPresence: "NOT_PROVEN",
            canComplete: false,
          },
          null,
          2,
        ),
      );
      artifacts.push({
        path: file,
        sha256: createHash("sha256")
          .update(await readFile(file))
          .digest("hex"),
        kind: "TEST_RESULT",
      });
    }
    if (appleNoticeScenario) {
      let notificationReturnDiagnostic: Record<string, string | boolean> | undefined;
      let permissionDiagnostic: {
        stage: string;
        granted: boolean;
        callbackOnMain: boolean;
        replyOnMain: boolean;
      } | null = null;
      try {
        const container = (
          await labTool(
            "xcrun",
            ["simctl", "get_app_container", ownedDevice!, "com.voyagewright.landfall", "data"],
            15000,
          )
        ).trim();
        if (!path.isAbsolute(container) || container.includes("\n")) throw new Error("OWNED_APP_CONTAINER_REQUIRED");
        const value = JSON.parse(
          await readFile(
            path.join(container, "Library", "Application Support", "landfall-notification-debug.json"),
            "utf8",
          ),
        );
        if (
          ["REQUESTED", "REPLIED"].includes(value.stage) &&
          [value.granted, value.callbackOnMain, value.replyOnMain].every((field) => typeof field === "boolean")
        )
          permissionDiagnostic = {
            stage: value.stage,
            granted: value.granted,
            callbackOnMain: value.callbackOnMain,
            replyOnMain: value.replyOnMain,
          };
        try {
          const returned = JSON.parse(
            await readFile(
              path.join(container, "Library", "Application Support", "landfall-notification-return-debug.json"),
              "utf8",
            ),
          );
          const flags = ["validHandle", "callbackOnMain", "navigationOnMain", "webViewAvailable"];
          if (
            ["INVALID_HANDLE", "NAVIGATION_REQUESTED", "PENDING_WEB_VIEW"].includes(returned.stage) &&
            flags.every((key) => typeof returned[key] === "boolean")
          )
            notificationReturnDiagnostic = {
              stage: returned.stage,
              ...Object.fromEntries(flags.map((key) => [key, returned[key]])),
            };
        } catch {
          /* No native return callback remains unknown, never inferred. */
        }
      } catch {
        /* Missing debug evidence remains unknown. */
      }
      const file = path.join(destination, "native-apple-notice-observation.json");
      await writeFile(
        file,
        JSON.stringify(
          {
            version: 1,
            sourceClass: "ACTUAL_APPLE_NOTIFICATION_UI_AND_NATIVE_HANDOFF",
            permissionUiObserved:
              osResults.get(
                scenario.timeline.findIndex(
                  (step) => step.action.type === "NOTIFICATION" && step.action.operation === "DELIVER",
                ),
              )?.state === "PASS",
            osActions: [...osResults.values()],
            noticeUiDiagnostic: appleNoticeUiDiagnostic,
            permissionDiagnostic,
            notificationReturnDiagnostic,
            noticeTapObserved: steps.some(
              (step) => step.action === "NOTIFICATION" && step.index === 5 && step.state === "PASS",
            ),
            sameOriginReturnObserved: appleNoticeReturnObserved,
            syntheticNonce: true,
            productionSignedAuthorizationProven: false,
            canonicalProgressionEvents: (await authority.counts()).canonicalProgressionEvents,
            physicalDeliveryLatencyProven: false,
          },
          null,
          2,
        ),
      );
      artifacts.push({
        path: file,
        sha256: createHash("sha256")
          .update(await readFile(file))
          .digest("hex"),
        kind: "TEST_RESULT",
      });
    }
    const performanceFile = path.join(destination, "native-action-performance.json");
    await writeFile(
      performanceFile,
      JSON.stringify(
        {
          version: 1,
          measurementClass: "OS_SCENARIO_ACTION_WALL_CLOCK",
          physicalTimingProven: false,
          measurements: actionPerformance,
        },
        null,
        2,
      ),
    );
    artifacts.push({
      path: performanceFile,
      sha256: createHash("sha256")
        .update(await readFile(performanceFile))
        .digest("hex"),
      kind: "TEST_RESULT",
    });
    const rebootFile = path.join(destination, "native-guest-reboots.json");
    await writeFile(rebootFile, JSON.stringify(guestReboots, null, 2));
    artifacts.push({
      path: rebootFile,
      sha256: createHash("sha256")
        .update(await readFile(rebootFile))
        .digest("hex"),
      kind: "TEST_RESULT",
    });
    const readinessFile = path.join(destination, "native-client-readiness.json");
    await writeFile(
      readinessFile,
      JSON.stringify(
        { requests: startupRequests, stages: clientStages, readyAcknowledgments: startups.length },
        null,
        2,
      ),
    );
    artifacts.push({
      path: readinessFile,
      sha256: createHash("sha256")
        .update(await readFile(readinessFile))
        .digest("hex"),
      kind: "TEST_RESULT",
    });
    const controlFile = path.join(destination, "native-location-controls.json");
    const appleInputFile = path.join(destination, "native-apple-input-diagnostics.json");
    await writeFile(appleInputFile, JSON.stringify(appleInputDiagnostics, null, 2));
    artifacts.push({
      path: appleInputFile,
      sha256: createHash("sha256")
        .update(await readFile(appleInputFile))
        .digest("hex"),
      kind: "TEST_RESULT",
    });
    await writeFile(controlFile, JSON.stringify(locationControls, null, 2));
    artifacts.push({
      path: controlFile,
      sha256: createHash("sha256")
        .update(await readFile(controlFile))
        .digest("hex"),
      kind: "TEST_RESULT",
    });
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
      const finalizationStartedAt = Date.now();
      let timer: ReturnType<typeof setTimeout> | undefined;
      const done = await Promise.race([
        uiRunner.then(() => true),
        new Promise<boolean>((resolve) => {
          // XCTest can finish its assertions before xcodebuild packages its
          // result bundle. This deadline bounds tool finalization, not a
          // scenario observation or a retry of the lifecycle operation.
          timer = setTimeout(() => resolve(false), 240000);
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
      const file = path.join(destination, "native-ui-driver.json");
      let testCounts: { result: string; passed: number; failed: number; skipped: number } | null = null;
      try {
        const summary = JSON.parse(
          await labTool(
            "xcrun",
            [
              "xcresulttool",
              "get",
              "test-results",
              "summary",
              "--path",
              path.join(destination, "NativeLifecycle.xcresult"),
            ],
            30000,
          ),
        );
        if (
          [summary.passedTests, summary.failedTests, summary.skippedTests].every(
            (count) => Number.isInteger(count) && count >= 0,
          )
        )
          testCounts = {
            result: summary.result === "Passed" ? "PASS" : "FAIL",
            passed: summary.passedTests,
            failed: summary.failedTests,
            skipped: summary.skippedTests,
          };
      } catch {
        /* Absence stays explicit; never infer test counts from exit status. */
      }
      await writeFile(
        file,
        JSON.stringify(
          {
            version: 1,
            toolExit: done && !uiFailed ? "PASS" : "FAIL",
            finalizationDeadlineMs: 240000,
            finalizationTimedOut: !done,
            finalizationElapsedMs: Date.now() - finalizationStartedAt,
            testCounts,
          },
          null,
          2,
        ),
      );
      artifacts.push({
        path: file,
        sha256: createHash("sha256")
          .update(await readFile(file))
          .digest("hex"),
        kind: "TEST_RESULT",
      });
    }
    if (androidSerial)
      await adb(["wait-for-device"], 30000).catch(() => remainingResources.push("android-adb-transport"));
    if (fusedInput) await fusedInput.cleanup().catch(() => remainingResources.push("android-fused-mock-input"));
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
    const commandFile = path.join(destination, "authority-command-diagnostics.json");
    await writeFile(commandFile, JSON.stringify(authority.commandDiagnostics(), null, 2));
    artifacts.push({
      path: commandFile,
      sha256: createHash("sha256")
        .update(await readFile(commandFile))
        .digest("hex"),
      kind: "TEST_RESULT",
    });
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
        : action?.type === "INSTALLATION_TOKEN" && cameraScenario
          ? {
              method: "OS_CAMERA_ACQUISITION",
              limitation:
                "Synthetic signed QR pixels traverse the emulated camera, CameraX and bundled ML Kit. No physical camera, tag presence or progression claim.",
            }
          : action?.type === "NOTIFICATION" && appleNoticeScenario
            ? {
                method: "OS_NOTIFICATION_UI",
                limitation:
                  "Actual Apple permission prompt and SpringBoard notice tap produce a native same-origin synthetic nonce handoff. No injected notification/delegate callback or production signed-authority claim; shared and Android first-party tests cover that separate boundary.",
              }
            : action?.type === "NATIVE_GEOFENCE"
              ? {
                  method: action.operation === "ENTER" ? "OS_GEOFENCE_TRANSITION" : "OS_GEOFENCE_REGISTRATION",
                  limitation:
                    target === "ios-simulator"
                      ? "Documented simctl location inputs exercise actual Core Location registration and encrypted delegate-delivered hints. No injected delegate callback, physical timing or arrival claim."
                      : "Documented FLP mock input from a separate debug lab APK exercises actual Play services registration and OS-delivered encrypted hints. No injected receiver/broadcast, physical timing or arrival claim.",
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
                        "Bounded repeated OS coordinate delivery within one step does not prove field GPS accuracy, multipath or sensor physics; injection counts are recorded separately.",
                    }
                  : action?.type === "LIFECYCLE"
                    ? {
                        method: "OS_LIFECYCLE",
                        limitation:
                          "Simulator/emulator lifecycle does not prove physical-device OEM suspension policy.",
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
            ...(fusedInput ? ["android-fused-mock-input", "native-location-lab-private-data"] : []),
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

import { createServer } from "node:http";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { z } from "zod";
import { _android, type AndroidDevice, type Page } from "playwright";
import { createDeviceLabVoyage } from "./one-voyage";
import { deviceLabSourceIdentity } from "./source";
import { discoverDeviceLabHost, labBinaryTool, labTool } from "./host";
import { boundedAndroidDriver } from "./android-driver";
import { nativeLensControl, nativeLensPlayerVisible } from "../../../src/landfall/device-lab/native-lens-control";
import { syntheticSpatialMoment } from "../../../src/parallax/fixtures";
import { materializeSpatialVersion } from "../../../src/parallax/publication";
import {
  appleMinimumIosFromProject,
  appleRuntimeSelectionPolicy,
  selectLatestSupportedAppleRuntime,
} from "../../../src/device-lab/apple-runtime";

// Development scenario inside the shared Device Lab. It uses its existing
// owned SQLite authority and XCTest driver, never an NCL release authority.
const actionSchema = z.strictObject({
  type: z.literal("LENS_UI"),
  operation: z.enum(["OPEN", "TAP", "INSPECT", "RETURN", "CLOSE"]),
  x: z.number().min(0).max(1).optional(),
  y: z.number().min(0).max(1).optional(),
});
const actions = [
  { type: "LENS_UI", operation: "OPEN" },
  { type: "LENS_UI", operation: "TAP", x: 0.5, y: 0.5 },
  { type: "LENS_UI", operation: "INSPECT" },
  { type: "LENS_UI", operation: "CLOSE" },
].map((action) => actionSchema.parse(action));

async function main() {
  const preflight = process.argv.length === 3 && process.argv[2] === "--preflight";
  const android = process.argv.length === 3 && process.argv[2] === "--android";
  if (process.argv.length > 2 && !preflight && !android) throw new Error("PARALLAX_NATIVE_LAB_ARGUMENT_INVALID");
  const root = process.cwd();
  const source = await deviceLabSourceIdentity();
  if (!preflight) assert.equal(source.dirty, false, "Freeze a coherent source before native execution.");
  const host = await discoverDeviceLabHost();
  if (!preflight && !android) assert.equal(host.apple.configured, true, "HOSTED_MACOS_XCODE_REQUIRED");
  if (android) assert.ok(host.android.adb && process.env.GITHUB_ACTIONS === "true", "OWNED_HOSTED_ANDROID_REQUIRED");
  const destination = path.join(root, "artifacts", "landfall-device-lab", `parallax-native-${Date.now()}`);
  await mkdir(destination, { recursive: true });
  const voyage = await createDeviceLabVoyage(path.join(destination, "authority"));
  const csrf = randomBytes(32).toString("hex");
  let server: ReturnType<typeof createServer> | undefined;
  let device: string | undefined;
  let androidSerial: string | undefined;
  let androidReverse: string | undefined;
  let androidDevices: AndroidDevice[] = [];
  let androidAcquisition: Promise<AndroidDevice[]> | undefined;
  let androidAcquisitionSettled = true;
  let androidPageAttachment: Promise<Page | null> | undefined;
  let androidPageAttachmentSettled = true;
  let androidPage: Page | undefined;
  let androidTeardown = false;
  let lastAndroidWindowFocus: string | null = null;
  const androidReleaseRecovery: string[] = [];
  const androidReleaseFailures: { operation: string; reason: string }[] = [];
  const adb = (args: string[], timeout = 30000) =>
    labTool(
      host.android.adb!,
      ["-P", process.env.LANDFALL_LAB_ADB_PORT ?? "5037", "-s", androidSerial!, ...args],
      timeout,
    );
  let runner: Promise<string> | undefined;
  const abort = new AbortController();
  const results = new Map<number, string>();
  const evidence: { entityId: string; interactionType: string; synthetic: boolean; disposition: string }[] = [];
  const screenshots: { file: string; sha256: string; bytes: number }[] = [];
  let ready = false,
    failed = false,
    stopped = false;
  let iosOsReady = false;
  const iosRequests = { player: 0, clientScript: 0, scene: 0, clientReady: 0, clientFailed: 0, osReady: 0, osNext: 0 };
  let iosDriverState = "NOT_STARTED";
  let iosDriverOutputRetained = false;
  let iosDriverOutputFiles = 0;
  let iosRuntimeSelection: { runtime: string; minimumIOS: string; policy: string } | undefined;
  const retainIosDriverOutput = async (state: string, output: { stdout?: unknown; stderr?: unknown }) => {
    iosDriverState = state;
    try {
      for (const key of ["stdout", "stderr"] as const) {
        const value = output[key];
        if (typeof value !== "string" || Buffer.byteLength(value) > 8 * 1024 * 1024) continue;
        // Original tool output can contain Simulator identifiers. It stays in
        // the private task artifact, never in console or a public receipt.
        await writeFile(path.join(destination, `ios-driver.${key}.private.original.log`), value, { flag: "wx" });
        iosDriverOutputFiles++;
      }
      iosDriverOutputRetained = iosDriverOutputFiles > 0;
    } catch {
      iosDriverOutputRetained = false;
    }
  };
  let current: { index: number; action: z.infer<typeof actionSchema> } | null = null;
  let cleanup = false;
  let executionStage = "PREPARE_OWNED_LAB";
  let observedControl: Parameters<typeof nativeLensControl>[1] | null = null;
  let lastAndroidHierarchy: string | null = null;
  const wait = async (condition: () => boolean, timeout: number) => {
    const until = Date.now() + timeout;
    while (!condition()) {
      if (failed || Date.now() >= until) throw new Error("PARALLAX_NATIVE_LAB_OBSERVATION_FAILED");
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  };
  try {
    const { db } = await import("../../../src/lib/db");
    const { loadReleasedSpatialMoment, recordSpatialObservation } = await import("../../../src/parallax/service");
    const { loadReleasedSpatialAsset } = await import("../../../src/parallax/asset-delivery");
    const { playerCanAccessPlaythrough } = await import("../../../src/platform/auth");
    const version = await db.publishedTaleVersion.findUniqueOrThrow({ where: { id: "version-1" } });
    const snapshot = JSON.parse(version.contentSnapshot);
    const moment = syntheticSpatialMoment("active");
    const { checksum: oldChecksum, ...content } = moment.version;
    void oldChecksum;
    content.title = "Original chest — camera-free native input";
    Object.assign(content.entities[0], {
      id: "fixture-native-chest",
      name: "Original treasure chest",
      widthMeters: 0.4,
      interactions: ["INSPECT"],
      transform: { position: { x: 0, y: -0.1525, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: 1 },
      element: {
        enabled: true,
        kind: "PHYSICAL_ASSET",
        modelId: "treasure-chest",
        packageVersion: "1.0.0",
        articulation: 0,
      },
    });
    moment.version = materializeSpatialVersion(content);
    moment.attachment.versionChecksum = moment.version.checksum;
    const block = snapshot.chapters[0].blocks[0];
    Object.assign(block, {
      blockType: "narrative",
      configuration: { heading: "Synthetic native inspection", body: "Inspect the original chest." },
      completion: { mode: "playerConfirmation" },
      presentation: { spatialMoment: moment },
    });
    const contentSnapshot = JSON.stringify(snapshot);
    await db.publishedTaleVersion.update({
      where: { id: "version-1" },
      data: { contentSnapshot, checksum: createHash("sha256").update(contentSnapshot).digest("hex") },
    });
    const before = await db.taleSession.findUniqueOrThrow({ where: { id: "session-1" } });
    const beforeEvents = await db.taleSessionEvent.count({ where: { sessionId: "session-1" } });
    const bundle = await build({
      entryPoints: [path.join(root, "src/landfall/device-lab/parallax-native-client.tsx")],
      bundle: true,
      write: false,
      outdir: path.join(destination, "bundle"),
      jsx: "automatic",
      platform: "browser",
      format: "iife",
      target: "es2020",
      define: { "process.env.NODE_ENV": '"production"' },
      logLevel: "silent",
    });
    const js =
      bundle.outputFiles.find((file) => file.path.endsWith(".js")) ??
      bundle.outputFiles.find((file) => !file.path.endsWith(".css"));
    assert.ok(js);
    const css = bundle.outputFiles.find((file) => file.path.endsWith(".css"));
    server = createServer(async (request, response) => {
      response.setHeader("Cache-Control", "no-store");
      const route = request.url?.split("?")[0];
      if (!android) {
        if (request.method === "GET") {
          if (["/player", "/player/", "/"].includes(route ?? "")) iosRequests.player++;
          else if (route === "/lab/client.js") iosRequests.clientScript++;
          else if (route === "/lab/scene") iosRequests.scene++;
          else if (route === "/lab/os/next") iosRequests.osNext++;
        } else if (request.method === "POST") {
          if (route === "/lab/client-ready") iosRequests.clientReady++;
          else if (route === "/lab/client-failed") iosRequests.clientFailed++;
          else if (route === "/lab/os/ready") iosRequests.osReady++;
        }
      }
      try {
        if (request.method === "GET") {
          if (["/player", "/player/", "/"].includes(route ?? "")) {
            response.setHeader("Content-Type", "text/html; charset=utf-8");
            response.end(
              '<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Owned native input lab</title><link rel="stylesheet" href="/lab/style.css"><div id="root"></div><script src="/lab/client.js"></script></html>',
            );
            return;
          }
          if (route === "/lab/client.js") {
            response.setHeader("Content-Type", "text/javascript");
            response.end(js.contents);
            return;
          }
          if (route === "/lab/style.css") {
            response.setHeader("Content-Type", "text/css");
            response.end(css?.contents ?? "");
            return;
          }
          if (route === "/lab/scene") {
            assert.ok(await playerCanAccessPlaythrough("session-1", "synthetic-player"));
            response.setHeader("Content-Type", "application/json");
            response.end(
              JSON.stringify({ ...(await loadReleasedSpatialMoment("session-1", "synthetic-player", "active")), csrf }),
            );
            return;
          }
          if (route === "/lab/os/next") {
            if (!current && !stopped) response.statusCode = 204;
            response.end(JSON.stringify(stopped ? { stop: true } : current));
            return;
          }
          if (route?.startsWith("/api/player/playthroughs/session-1/parallax/assets/")) {
            const url = new URL(request.url!, "http://127.0.0.1");
            assert.equal(url.pathname, "/api/player/playthroughs/session-1/parallax/assets/treasure-chest");
            assert.equal(url.searchParams.get("block"), "active");
            assert.equal(url.searchParams.get("versionChecksum"), moment.version.checksum);
            assert.ok(await playerCanAccessPlaythrough("session-1", "synthetic-player"));
            const asset = await loadReleasedSpatialAsset({
              playthroughId: "session-1",
              playerProfileId: "synthetic-player",
              blockId: "active",
              versionChecksum: moment.version.checksum,
              assetId: "treasure-chest",
            });
            response.setHeader("Content-Type", "model/gltf-binary");
            response.end(asset.bytes);
            return;
          }
        }
        if (request.method === "POST") {
          let body = "";
          for await (const chunk of request) {
            body += chunk;
            if (Buffer.byteLength(body) > 8192) throw new Error("BODY_TOO_LARGE");
          }
          if (route === "/lab/client-ready") {
            ready = true;
            response.end("{}");
            return;
          }
          if (route === "/lab/client-failed") {
            failed = true;
            response.end("{}");
            return;
          }
          if (route === "/lab/os/ready") {
            if (!android) iosOsReady = true;
            response.end("{}");
            return;
          }
          if (route === "/lab/os/result") {
            const result = JSON.parse(body);
            if (!current || result.index !== current.index || !["PASS", "FAIL", "UNSUPPORTED"].includes(result.state))
              throw new Error("STALE_OS_ACTION");
            results.set(result.index, result.state);
            current = null;
            response.end("{}");
            return;
          }
          if (route === "/lab/inspect") {
            assert.equal(request.headers["x-csrf-token"], csrf);
            assert.ok(await playerCanAccessPlaythrough("session-1", "synthetic-player"));
            const value = JSON.parse(body);
            assert.equal(value.synthetic, true);
            assert.equal(value.mode, "SIMULATED");
            let disposition = "UNEXPECTEDLY_ACCEPTED";
            try {
              await recordSpatialObservation("session-1", "synthetic-player", value);
            } catch (error) {
              assert.match(String(error), /PARALLAX_SIMULATION_FORBIDDEN/);
              disposition = "SIMULATION_REJECTED";
            }
            evidence.push({
              entityId: value.entityId,
              interactionType: value.interactionType,
              synthetic: true,
              disposition,
            });
            response.statusCode = disposition === "SIMULATION_REJECTED" ? 409 : 500;
            response.end("{}");
            return;
          }
        }
        response.statusCode = 404;
        response.end();
      } catch {
        response.statusCode = 400;
        response.end();
      }
    });
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const origin = `http://127.0.0.1:${address.port}`;
    if (preflight) {
      assert.equal((await fetch(`${origin}/lab/client.js`)).status, 200);
      const sceneResponse = await fetch(`${origin}/lab/scene`);
      assert.equal(sceneResponse.status, 200);
      const bound = await sceneResponse.json();
      assert.equal(bound.binding.sessionId, "session-1");
      assert.equal(bound.replayOnly, false);
      const asset = await fetch(
        `${origin}/api/player/playthroughs/session-1/parallax/assets/treasure-chest?block=active&versionChecksum=${moment.version.checksum}`,
      );
      assert.equal(asset.status, 200);
      const assetBytes = Buffer.from(await asset.arrayBuffer());
      assert.equal(assetBytes.length, 630120);
      assert.equal(
        createHash("sha256").update(assetBytes).digest("hex"),
        "2e31b5eed11242e583cfc99a5491ff2e4b10dec0d4fed5d90dffe1ccab122e6f",
      );
      const simulated = {
        schemaVersion: 1,
        interactionId: "preflight-inspect",
        idempotencyKey: "preflight-inspect",
        instanceId: `instance:${moment.attachment.id}:session-1`,
        sessionId: "session-1",
        chronicleVersionId: "version-1",
        blockId: "active",
        actorId: "synthetic-player",
        spatialDefinitionVersionId: moment.version.id,
        versionChecksum: moment.version.checksum,
        entityId: "fixture-native-chest",
        interactionType: "INSPECT",
        anchorId: "desk-anchor",
        anchorVersion: 1,
        observedAt: new Date().toISOString(),
        mode: "SIMULATED",
        providerId: "parallax.native.camera-free.device-lab.v1",
        synthetic: true,
        authority: "NONAUTHORITATIVE",
      };
      const rejected = await fetch(`${origin}/lab/inspect`, {
        method: "POST",
        headers: { "x-csrf-token": bound.csrf },
        body: JSON.stringify(simulated),
      });
      assert.equal(rejected.status, 409);
      assert.equal(evidence[0]?.disposition, "SIMULATION_REJECTED");
    } else if (android) {
      executionStage = "ANDROID_LAUNCH";
      androidSerial = process.env.ANDROID_SERIAL ?? "emulator-5554";
      assert.match(androidSerial, /^emulator-[0-9]+$/);
      assert.match(process.env.LANDFALL_LAB_ADB_PORT ?? "5037", /^[0-9]{1,5}$/);
      const devices = await labTool(host.android.adb!, ["-P", process.env.LANDFALL_LAB_ADB_PORT ?? "5037", "devices"]);
      assert.ok(
        devices.split(/\r?\n/).some((line) => line.trim() === `${androidSerial}\tdevice`),
        "OWNED_ANDROID_NOT_READY",
      );
      const reverse = `tcp:${address.port}`;
      assert.ok(
        !(await adb(["reverse", "--list"])).split(/\r?\n/).some((line) => line.split(/\s+/).includes(reverse)),
        "OWNED_ANDROID_REVERSE_OCCUPIED",
      );
      await adb(["reverse", reverse, reverse]);
      androidReverse = reverse;
      await adb(["shell", "am", "force-stop", "com.voyagewright.landfall"]);
      await adb([
        "shell",
        "am",
        "start",
        "-n",
        "com.voyagewright.landfall/.LandfallActivity",
        "--es",
        "labOrigin",
        origin,
        "--ez",
        "labCameraFree",
        "true",
      ]);
      await wait(() => ready, 60000);
      executionStage = "ANDROID_ATTACH_OWNED_WEBVIEW";
      androidAcquisitionSettled = false;
      androidAcquisition = _android
        .devices({
          host: "127.0.0.1",
          port: Number(process.env.LANDFALL_LAB_ADB_PORT ?? "5037"),
          omitDriverInstall: true,
        })
        .then(async (found) => {
          // A setup deadline does not cancel the underlying acquisition. Own
          // its late result and close every connection if teardown has begun.
          if (androidTeardown) {
            const closed = await Promise.allSettled(
              found.map((item) => boundedAndroidDriver(item.close(), undefined, 15000)),
            );
            assert.ok(
              closed.every((item) => item.status === "fulfilled"),
              "PARALLAX_ANDROID_LATE_CLEANUP_FAILED",
            );
            return [];
          }
          androidDevices = found;
          return found;
        })
        .finally(() => {
          androidAcquisitionSettled = true;
        });
      await boundedAndroidDriver(androidAcquisition);
      const androidDevice = androidDevices.find((item) => item.serial() === androidSerial);
      assert.ok(androidDevice, "OWNED_ANDROID_WEBVIEW_DEVICE_MISSING");
      const webView = await androidDevice.webView({ pkg: "com.voyagewright.landfall" }, { timeout: 20000 });
      androidPageAttachmentSettled = false;
      androidPageAttachment = webView
        .page()
        .then(async (attached) => {
          if (androidTeardown) {
            await boundedAndroidDriver(attached.context().close(), undefined, 15000);
            return null;
          }
          androidPage = attached;
          return attached;
        })
        .finally(() => {
          androidPageAttachmentSettled = true;
        });
      const page = await boundedAndroidDriver(androidPageAttachment);
      assert.ok(page, "OWNED_ANDROID_WEBVIEW_ATTACHMENT_CANCELLED");
      assert.equal(new URL(page.url()).origin, origin, "OWNED_ANDROID_WEBVIEW_ORIGIN_MISMATCH");
      assert.equal(new URL(page.url()).pathname, "/player", "OWNED_ANDROID_WEBVIEW_PATH_MISMATCH");
      page.setDefaultTimeout(20000);
      const hierarchy = async () => {
        await adb(["shell", "uiautomator", "dump", "/sdcard/ncl01-owned-lens.xml"]);
        lastAndroidHierarchy = await adb(["shell", "cat", "/sdcard/ncl01-owned-lens.xml"]);
        return lastAndroidHierarchy;
      };
      const observe = async (control: "SCENE" | "INSPECT", timeout = 20000) => {
        observedControl = control;
        const until = Date.now() + timeout;
        let priorBounds: string | null = null;
        while (Date.now() < until) {
          const xml = await hierarchy();
          if (Date.now() >= until) throw new Error("PARALLAX_ANDROID_CONTROL_DEADLINE_EXCEEDED");
          try {
            const target = nativeLensControl(xml, control);
            const bounds = JSON.stringify(target.bounds);
            if (bounds !== priorBounds) {
              priorBounds = bounds;
              continue;
            }
            const windowState = await adb(["shell", "dumpsys", "window"], 10000);
            lastAndroidWindowFocus =
              windowState
                .split(/\r?\n/)
                .find((line) => line.includes("mCurrentFocus="))
                ?.trim()
                .slice(0, 256) ?? null;
            if (lastAndroidWindowFocus?.includes("com.voyagewright.landfall")) return target;
            priorBounds = null;
          } catch (error) {
            priorBounds = null;
            if (Date.now() >= until) throw error;
          }
        }
        throw new Error("PARALLAX_ANDROID_CONTROL_UNOBSERVED");
      };
      const tap = async (control: "SCENE" | "INSPECT") => {
        const target = await observe(control);
        await adb(["shell", "input", "tap", String(target.x), String(target.y)]);
      };
      const capture = async (file: "native-selected.png" | "canonical-rejection.png" | "same-voyage-return.png") => {
        const screenshot = await labBinaryTool(host.android.adb!, [
          "-P",
          process.env.LANDFALL_LAB_ADB_PORT ?? "5037",
          "-s",
          androidSerial!,
          "exec-out",
          "screencap",
          "-p",
        ]);
        await writeFile(path.join(destination, file), screenshot);
        screenshots.push({
          file,
          bytes: screenshot.length,
          sha256: createHash("sha256").update(screenshot).digest("hex"),
        });
      };
      executionStage = "ANDROID_OPEN_LENS";
      // Use the shared Device Lab's real WebView driver for HTML controls.
      // Their DOM roles need not map to a particular Android AX widget class.
      // Native mesh and Inspect input below still use actual OS pointer taps.
      await page.getByRole("button", { name: "Open camera-free Lens", exact: true }).click();
      const lens = page.getByRole("dialog", { name: moment.version.title, exact: true });
      executionStage = "ANDROID_START_NATIVE";
      await lens.getByRole("button", { name: "Open camera-free Device Lab", exact: true }).click();
      results.set(0, "PASS");
      executionStage = "ANDROID_LOAD_MODELS";
      const untilLoaded = Date.now() + 30000;
      while (!(await hierarchy()).includes("objects loaded")) {
        if (Date.now() >= untilLoaded) throw new Error("PARALLAX_ANDROID_MODELS_NOT_READY");
      }
      executionStage = "ANDROID_SELECT_MESH";
      await tap("SCENE");
      results.set(1, "PASS");
      await capture("native-selected.png");
      executionStage = "ANDROID_INSPECT_INTENT";
      await tap("INSPECT");
      executionStage = "ANDROID_CANONICAL_REJECTION";
      const rejectionDeadline = Date.now() + 20000;
      await lens
        .getByText(
          "Camera-free simulation cannot record a real native observation. Your Voyage progress has not changed.",
          { exact: true },
        )
        .waitFor({ state: "visible", timeout: Math.max(1, rejectionDeadline - Date.now()) });
      let playerVisible = false;
      while (Date.now() < rejectionDeadline) {
        const xml = await hierarchy();
        if (Date.now() >= rejectionDeadline) break;
        if (nativeLensPlayerVisible(xml)) {
          playerVisible = true;
          break;
        }
      }
      assert.ok(playerVisible, "PARALLAX_ANDROID_PLAYER_STILL_COVERED_BY_NATIVE_OVERLAY");
      results.set(2, "PASS");
      await capture("canonical-rejection.png");
      executionStage = "ANDROID_RETURN_TO_VOYAGE";
      await lens.getByRole("button", { name: "Close Chronicle Lens", exact: true }).click();
      await lens.waitFor({ state: "hidden" });
      await page
        .getByRole("heading", { name: "Synthetic Device Lab Voyage", exact: true })
        .waitFor({ state: "visible" });
      results.set(3, "PASS");
      await wait(() => evidence.some((item) => item.interactionType === "INSPECT"), 15000);
      assert.ok(
        evidence.every(
          (item) => item.entityId === "fixture-native-chest" && item.disposition === "SIMULATION_REJECTED",
        ),
      );
      await capture("same-voyage-return.png");
      assert.deepEqual(await deviceLabSourceIdentity(), source, "PARALLAX_NATIVE_LAB_SOURCE_CHANGED");
    } else {
      executionStage = "IOS_SELECT_RUNTIME";
      const minimumIOS = appleMinimumIosFromProject(
        await readFile(path.join(root, "native", "ios", "project.yml"), "utf8"),
      );
      const runtime = selectLatestSupportedAppleRuntime(host.apple, minimumIOS);
      iosRuntimeSelection = { runtime: runtime.id, minimumIOS, policy: appleRuntimeSelectionPolicy };
      const template = host.apple.devices.find(
        (item) => item.available && item.runtime === runtime.id && item.name.includes("iPhone"),
      );
      assert.ok(template);
      executionStage = "IOS_CREATE_DEVICE";
      device = (
        await labTool("xcrun", [
          "simctl",
          "create",
          `NCL01-${Date.now()}`,
          "com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro",
          runtime.id,
        ])
      ).trim();
      assert.match(device, /^[A-F0-9-]{36}$/i);
      executionStage = "IOS_BOOT_DEVICE";
      await labTool("xcrun", ["simctl", "boot", device]);
      await labTool("xcrun", ["simctl", "bootstatus", device, "-b"], 180000);
      executionStage = "IOS_LAUNCH_DRIVER";
      iosDriverState = "RUNNING";
      runner = labTool(
        "xcodebuild",
        [
          "-quiet",
          "-project",
          path.join(root, "native/ios/LandfallCompanion.xcodeproj"),
          "-scheme",
          "LandfallCompanion",
          "-destination",
          `platform=iOS Simulator,id=${device}`,
          "-derivedDataPath",
          path.join(root, "artifacts/landfall-device-lab/apple-build/DerivedData"),
          "-resultBundlePath",
          path.join(destination, "NativeInspect.xcresult"),
          "-only-testing:LandfallCompanionUiTests/NativeLifecycleTests/testCanonicalScenarioOperations",
          "CODE_SIGNING_ALLOWED=YES",
          "CODE_SIGN_IDENTITY=-",
          `LANDFALL_LAB_ORIGIN=${origin}`,
          "LANDFALL_LAB_CAMERA_FREE=1",
          "test-without-building",
        ],
        480000,
        abort.signal,
      )
        .then(async (stdout) => {
          await retainIosDriverOutput("COMPLETED", { stdout });
          return stdout;
        })
        .catch(async (error: unknown) => {
          failed = true;
          const output = error && typeof error === "object" ? (error as Record<string, unknown>) : {};
          await retainIosDriverOutput("REJECTED", { stdout: output.stdout, stderr: output.stderr });
          throw error;
        });
      // Attach a rejection handler immediately while independent host observations run.
      void runner.catch(() => undefined);
      executionStage = "IOS_WAIT_CLIENT_READY";
      await wait(() => ready, 180000);
      for (const [index, action] of actions.entries()) {
        executionStage = `IOS_ACTION_${action.operation}`;
        current = { index, action };
        await wait(() => results.has(index), 45000);
        assert.equal(results.get(index), "PASS");
      }
      executionStage = "IOS_VERIFY_CANONICAL_REJECTION";
      await wait(() => evidence.some((item) => item.interactionType === "INSPECT"), 15000);
      assert.ok(
        evidence.every(
          (item) => item.entityId === "fixture-native-chest" && item.disposition === "SIMULATION_REJECTED",
        ),
      );
      stopped = true;
      await runner;
      const afterSource = await deviceLabSourceIdentity();
      assert.deepEqual(afterSource, source, "PARALLAX_NATIVE_LAB_SOURCE_CHANGED");
    }
    const after = await db.taleSession.findUniqueOrThrow({ where: { id: "session-1" } });
    assert.deepEqual([after.currentBlockId, after.currentSequence], [before.currentBlockId, before.currentSequence]);
    assert.equal(await db.taleSessionEvent.count({ where: { sessionId: "session-1" } }), beforeEvents);
    assert.equal(await db.parallaxObservation.count({ where: { sessionId: "session-1" } }), 0);
    await writeFile(
      path.join(destination, "native-inspect.json"),
      JSON.stringify(
        {
          schemaVersion: 1,
          role: "DEVELOPMENT_ONLY",
          qualification: false,
          source,
          result: "PASS",
          evidenceClass: preflight
            ? "HOST_PREFLIGHT_ONLY"
            : android
              ? "EMULATOR_NATIVE_INPUT_CANONICAL_REJECTION_ONLY"
              : "SIMULATOR_NATIVE_INPUT_CANONICAL_REJECTION_ONLY",
          physicalTrackingProven: false,
          positivePhysicalInspectProven: false,
          realSQLite: true,
          canonicalProgressionEventsAdded: 0,
          observationRowsAdded: 0,
          actions: [...results],
          evidence,
          screenshots,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    if (!android && runner) {
      // Let the owned XCTest driver consume STOP and seal its result bundle
      // before teardown. A failed action remains failed; this only retains its
      // native screenshot and hierarchy diagnostics within a finite wait.
      stopped = true;
      let settleTimer: ReturnType<typeof setTimeout> | undefined;
      await Promise.race([
        runner.catch(() => undefined),
        new Promise<void>((resolve) => {
          settleTimer = setTimeout(resolve, 15000);
        }),
      ]);
      clearTimeout(settleTimer);
    }
    // Keep the actual last owned UI observation before cleanup destroys it.
    // This diagnostic cannot authorize a target, supply substitute coordinates,
    // relax a deadline or turn a failed journey into a passing receipt. Raw XML
    // is a private synthetic-lab artifact and must not be published into Git.
    const hierarchyBytes = lastAndroidHierarchy === null ? null : Buffer.from(lastAndroidHierarchy);
    const preserveHierarchy = hierarchyBytes !== null && hierarchyBytes.length <= 262144;
    if (preserveHierarchy) await writeFile(path.join(destination, "android-ui.private.original.xml"), hierarchyBytes);
    await writeFile(
      path.join(destination, "execution-failure.json"),
      JSON.stringify(
        {
          schemaVersion: 1,
          role: "DEVELOPMENT_ONLY",
          qualification: false,
          source,
          result: "FAIL",
          stage: executionStage,
          control: observedControl,
          code: error instanceof Error && /^[A-Z0-9_]+$/.test(error.message) ? error.message : "NATIVE_LAB_FAILURE",
          clientReady: ready,
          clientFailed: failed,
          iosDiagnostics: !android
            ? {
                osReady: iosOsReady,
                requests: iosRequests,
                driverState: iosDriverState,
                runtimeSelection: iosRuntimeSelection ?? null,
              }
            : null,
          completedActions: [...results],
          privateHierarchy: hierarchyBytes
            ? {
                retained: preserveHierarchy,
                bytes: hierarchyBytes.length,
                sha256: createHash("sha256").update(hierarchyBytes).digest("hex"),
              }
            : null,
          androidWindowFocus: android ? lastAndroidWindowFocus : null,
          physicalTrackingProven: false,
        },
        null,
        2,
      ),
    );
    throw error;
  } finally {
    androidTeardown = true;
    stopped = true;
    abort.abort();
    await runner?.catch(() => undefined);
    const iosDiagnosticRetention =
      !android && !preflight
        ? writeFile(
            path.join(destination, "ios-driver-diagnostics.json"),
            JSON.stringify(
              {
                role: "DEVELOPMENT_ONLY",
                qualification: false,
                osReady: iosOsReady,
                clientReady: ready,
                clientFailurePostObserved: iosRequests.clientFailed > 0,
                requests: iosRequests,
                driverState: iosDriverState,
                runtimeSelection: iosRuntimeSelection ?? null,
                privateOutputRetained: iosDriverOutputRetained,
                privateOutputFiles: iosDriverOutputFiles,
                limits: [
                  "Route counts are observations only; they cannot satisfy readiness, native input or canonical acceptance.",
                ],
              },
              null,
              2,
            ),
          )
        : Promise.resolve();
    // Retention failure must not prevent any independently owned cleanup.
    void iosDiagnosticRetention.catch(() => undefined);
    let simulatorRemoved = !device,
      androidReleased = !androidSerial,
      androidConnectionsClosed = androidDevices.length === 0,
      databaseRemoved = false,
      serverClosed = !server;
    const connectionCleanup = (async () => {
      // Observe each pending setup and still close known connections if another
      // cleanup step fails. Device closure precedes app/data teardown, so an
      // app force-stop cannot race a normal CDP context close.
      const acquisition = androidAcquisition
        ? await Promise.allSettled([boundedAndroidDriver(androidAcquisition, undefined, 15000)])
        : [];
      const pageClosed = androidPage
        ? await Promise.allSettled([boundedAndroidDriver(androidPage.context().close(), undefined, 15000)])
        : [];
      const devicesClosed = await Promise.allSettled(
        androidDevices.map((item) => boundedAndroidDriver(item.close(), undefined, 15000)),
      );
      const attachment = androidPageAttachment
        ? await Promise.allSettled([boundedAndroidDriver(androidPageAttachment, undefined, 15000)])
        : [];
      androidConnectionsClosed =
        androidAcquisitionSettled &&
        androidPageAttachmentSettled &&
        [...acquisition, ...pageClosed, ...devicesClosed, ...attachment].every((item) => item.status === "fulfilled");
      assert.ok(androidConnectionsClosed, "PARALLAX_ANDROID_CONNECTION_CLEANUP_FAILED");
    })();
    void connectionCleanup.catch(() => undefined);
    const outcomes = await Promise.allSettled([
      (async () => {
        if (!device) return;
        await labTool("xcrun", ["simctl", "shutdown", device]).catch(() => undefined);
        await labTool("xcrun", ["simctl", "delete", device]);
        const observed = JSON.parse(await labTool("xcrun", ["simctl", "list", "devices", "--json"]));
        simulatorRemoved = !Object.values(observed.devices as Record<string, { udid: string }[]>)
          .flat()
          .some((item) => item.udid === device);
      })(),
      (async () => {
        if (server) {
          server.closeAllConnections();
          await new Promise<void>((resolve, reject) => server!.close((error) => (error ? reject(error) : resolve())));
        }
        serverClosed = !server?.listening;
      })(),
      (async () => {
        databaseRemoved = await voyage.cleanup();
      })(),
      (async () => {
        if (!androidSerial) return;
        await connectionCleanup.catch(() => undefined);
        // ADB cleanup on the same emulator is serialized. Each idempotent step
        // gets one bounded retry, with both recovery and final failure retained.
        const releaseSteps: { name: string; run: () => Promise<void> }[] = [
          {
            name: "force-stop-and-clear",
            run: async () => {
              await adb(["shell", "am", "force-stop", "com.voyagewright.landfall"]);
              assert.ok((await adb(["shell", "pm", "clear", "com.voyagewright.landfall"])).includes("Success"));
            },
          },
          {
            name: "remove-owned-hierarchy",
            run: async () => {
              await adb(["shell", "rm", "-f", "/sdcard/ncl01-owned-lens.xml"]);
            },
          },
          {
            name: "remove-owned-reverse",
            run: async () => {
              if (!androidReverse) return;
              await adb(["reverse", "--remove", androidReverse]).catch(() => undefined);
              assert.ok(
                !(await adb(["reverse", "--list"]))
                  .split(/\r?\n/)
                  .some((line) => line.split(/\s+/).includes(androidReverse!)),
              );
            },
          },
        ];
        for (const step of releaseSteps) {
          try {
            await step.run();
            continue;
          } catch {
            /* One bounded retry follows this retained recovery path. */
          }
          try {
            await step.run();
            androidReleaseRecovery.push(step.name);
          } catch (error) {
            androidReleaseFailures.push({
              operation: step.name,
              reason: error instanceof Error ? error.message.slice(0, 180) : "UNKNOWN",
            });
          }
        }
        androidReleased = androidReleaseFailures.length === 0;
        assert.ok(androidReleased, "PARALLAX_ANDROID_LAB_CLEANUP_FAILED");
      })(),
      connectionCleanup,
      iosDiagnosticRetention,
    ]);
    cleanup =
      outcomes.every((outcome) => outcome.status === "fulfilled") &&
      simulatorRemoved &&
      androidReleased &&
      androidConnectionsClosed &&
      databaseRemoved &&
      serverClosed;
    await writeFile(
      path.join(destination, "cleanup.json"),
      JSON.stringify(
        {
          result: cleanup ? "PASS" : "FAIL",
          databaseRemoved,
          ownedServerClosed: serverClosed,
          ownedSimulatorDeleted: simulatorRemoved,
          ownedAndroidReleased: androidReleased,
          ownedAndroidConnectionsClosed: androidConnectionsClosed,
          androidReleaseRecovery,
          androidReleaseFailures,
          failedCleanupOperations: outcomes.flatMap((outcome, index) => (outcome.status === "rejected" ? [index] : [])),
        },
        null,
        2,
      ),
    );
    assert.equal(cleanup, true, "PARALLAX_NATIVE_LAB_CLEANUP_FAILED");
  }
  process.stdout.write(`${JSON.stringify({ result: "PASS", destination })}\n`);
}
if (process.argv[1]?.endsWith("parallax-native-run.ts"))
  void main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message.slice(0, 180) : "PARALLAX_NATIVE_LAB_FAILED"}\n`);
    process.exitCode = 1;
  });

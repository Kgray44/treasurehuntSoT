import { createServer } from "node:http";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { z } from "zod";
import { createDeviceLabVoyage } from "./one-voyage";
import { deviceLabSourceIdentity } from "./source";
import { discoverDeviceLabHost, labBinaryTool, labTool } from "./host";
import { nativeLensControl } from "../../../src/landfall/device-lab/native-lens-control";
import { syntheticSpatialMoment } from "../../../src/parallax/fixtures";
import { materializeSpatialVersion } from "../../../src/parallax/publication";

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
  let current: { index: number; action: z.infer<typeof actionSchema> } | null = null;
  let cleanup = false;
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
      const hierarchy = async () => {
        await adb(["shell", "uiautomator", "dump", "/sdcard/ncl01-owned-lens.xml"]);
        return adb(["shell", "cat", "/sdcard/ncl01-owned-lens.xml"]);
      };
      const observe = async (control: Parameters<typeof nativeLensControl>[1], timeout = 20000, scroll = false) => {
        const until = Date.now() + timeout;
        let swipes = 0;
        while (Date.now() < until) {
          const xml = await hierarchy();
          try {
            return nativeLensControl(xml, control);
          } catch (error) {
            if (scroll && swipes < 3) {
              const web = nativeLensControl(xml, "WEBVIEW").bounds;
              const x = Math.floor((web.left + web.right) / 2);
              await adb([
                "shell",
                "input",
                "swipe",
                String(x),
                String(Math.floor(web.top + (web.bottom - web.top) * 0.8)),
                String(x),
                String(Math.floor(web.top + (web.bottom - web.top) * 0.2)),
                "350",
              ]);
              swipes++;
            }
            if (Date.now() >= until) throw error;
          }
        }
        throw new Error("PARALLAX_ANDROID_CONTROL_UNOBSERVED");
      };
      const tap = async (control: Parameters<typeof nativeLensControl>[1], scroll = false) => {
        const target = await observe(control, 20000, scroll);
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
      await tap("OPEN");
      await tap("START", true);
      results.set(0, "PASS");
      const untilLoaded = Date.now() + 30000;
      while (!(await hierarchy()).includes("objects loaded")) {
        if (Date.now() >= untilLoaded) throw new Error("PARALLAX_ANDROID_MODELS_NOT_READY");
      }
      await tap("SCENE");
      results.set(1, "PASS");
      await capture("native-selected.png");
      await tap("INSPECT");
      await observe("ERROR", 20000, true);
      results.set(2, "PASS");
      await capture("canonical-rejection.png");
      await tap("CLOSE");
      await observe("VOYAGE");
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
      const runtime = host.apple.runtimes
        .filter((item) => item.id.includes("iOS"))
        .find(
          (item) =>
            item.available &&
            host.apple.devices.some((d) => d.available && d.runtime === item.id && d.name.includes("iPhone")),
        );
      assert.ok(runtime);
      const template = host.apple.devices.find(
        (item) => item.available && item.runtime === runtime.id && item.name.includes("iPhone"),
      );
      assert.ok(template);
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
      await labTool("xcrun", ["simctl", "boot", device]);
      await labTool("xcrun", ["simctl", "bootstatus", device, "-b"], 180000);
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
      ).catch((error) => {
        failed = true;
        throw error;
      });
      // Attach a rejection handler immediately while independent host observations run.
      void runner.catch(() => undefined);
      await wait(() => ready, 180000);
      for (const [index, action] of actions.entries()) {
        current = { index, action };
        await wait(() => results.has(index), 45000);
        assert.equal(results.get(index), "PASS");
      }
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
  } finally {
    stopped = true;
    abort.abort();
    await runner?.catch(() => undefined);
    let simulatorRemoved = !device,
      androidReleased = !androidSerial,
      databaseRemoved = false,
      serverClosed = !server;
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
        const released = await Promise.allSettled([
          (async () => {
            await adb(["shell", "am", "force-stop", "com.voyagewright.landfall"]);
            assert.ok((await adb(["shell", "pm", "clear", "com.voyagewright.landfall"])).includes("Success"));
          })(),
          adb(["shell", "rm", "-f", "/sdcard/ncl01-owned-lens.xml"]),
          (async () => {
            if (!androidReverse) return;
            await adb(["reverse", "--remove", androidReverse]);
            assert.ok(
              !(await adb(["reverse", "--list"]))
                .split(/\r?\n/)
                .some((line) => line.split(/\s+/).includes(androidReverse!)),
            );
          })(),
        ]);
        androidReleased = released.every((operation) => operation.status === "fulfilled");
        assert.ok(androidReleased, "PARALLAX_ANDROID_LAB_CLEANUP_FAILED");
      })(),
    ]);
    cleanup =
      outcomes.every((outcome) => outcome.status === "fulfilled") &&
      simulatorRemoved &&
      androidReleased &&
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

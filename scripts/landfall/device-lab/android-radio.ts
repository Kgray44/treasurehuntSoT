import { createServer } from "node:http";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { build } from "esbuild";
import { _android, type AndroidDevice, type Page } from "playwright";
import { discoverDeviceLabHost, labTool } from "./host";
import { startDeviceLabAuthority } from "./authority-client";
import { deviceLabSourceIdentity } from "./source";
import {
  deviceLabConfigurationSchema,
  validateDeviceLabProfile,
  type DeviceLabConfiguration,
  type DeviceLabProfile,
} from "../../../src/landfall/device-lab/device-profile";
import type { DeviceLabScenario, DeviceLabStepResult } from "../../../src/landfall/device-lab/scenario";
import type { NativeUwbConfiguration, NativeUwbProjection } from "../../../src/landfall/native-uwb";
import type { BleProjection } from "../../../src/landfall/native-ble";
import type { DeviceLabBleDiagnostic } from "../../../src/landfall/device-lab/ble-diagnostics";
import { z } from "zod";
import { boundedAndroidDriver } from "./android-driver";

type RadioClient = {
  ble: {
    start(): Promise<string>;
    stop(): Promise<void>;
    snapshot(): BleProjection & { validatedSignals: number; bridgeDiagnostic: DeviceLabBleDiagnostic };
  };
  prepare(
    role: "CONTROLLER" | "CONTROLEE",
  ): Promise<{ state: "READY"; address: string; channel?: number; preamble?: number } | null>;
  start(configuration: NativeUwbConfiguration): Promise<void>;
  stop(): Promise<void>;
  snapshot(): NativeUwbProjection & { validatedRanges: number };
  nativeState(): Promise<{ state: string; supported: boolean; sessionProtected: boolean; peerVerified: false }>;
};
declare global {
  interface Window {
    __LandfallLabRadio?: RadioClient;
  }
}

/** Two explicitly owned, already-booted devices. Provisioning and shutdown belong to their owning backend. */
export async function executeLandfallAndroidRadioScenario(
  scenario: DeviceLabScenario,
  destination: string,
  profile: DeviceLabProfile,
) {
  const bleScenario = scenario.id.startsWith("ble-native-");
  if ((!bleScenario && scenario.id !== "uwb-native-peer-session") || scenario.worldspace !== "PHYSICAL")
    throw new Error("LANDFALL_RADIO_SCENARIO_INVALID");
  await mkdir(destination, { recursive: true });
  const host = await discoverDeviceLabHost();
  const source = await deviceLabSourceIdentity();
  const serials = [process.env.LANDFALL_LAB_ANDROID_SERIAL, process.env.LANDFALL_LAB_ANDROID_PEER_SERIAL];
  const port = process.env.LANDFALL_LAB_ADB_PORT ?? (host.hosted ? "5037" : "5038");
  if (!/^\d{4,5}$/.test(port) || Number(port) > 65535 || !host.android.adb)
    throw new Error("LANDFALL_RADIO_ADB_INVALID");
  const steps: DeviceLabStepResult[] = [];
  const remainingResources: string[] = [],
    ownedResources: string[] = [];
  const artifacts: { path: string; sha256: string; kind: "TEST_RESULT" }[] = [];
  const diagnostics: { index: number; devices: (NativeUwbProjection & { validatedRanges: number })[] }[] = [];
  const bleDiagnostics: {
    index: number;
    device: BleProjection & { validatedSignals: number; bridgeDiagnostic: DeviceLabBleDiagnostic };
    advertiserState: string | null;
  }[] = [];
  let advertiserState: string | null = null;
  let advertiserFailureCode: number | null = null;
  let nativeBleDiagnostic: { callbacks: number; emitted: number; errors: number; active: boolean } | null = null;
  let radioStage = "SETUP";
  const blePrerequisites: { preciseLocationGranted: boolean; locationSettingEnabled: boolean; screenAwake: boolean }[] =
    [];
  const configurations: DeviceLabConfiguration[] = [];
  const acquired: string[] = [],
    pages: Page[] = [];
  let devices: AndroidDevice[] = [];
  let canonicalProgressionEvents: number | null = null;
  let authority: Awaited<ReturnType<typeof startDeviceLabAuthority>> | null = null;
  let server: ReturnType<typeof createServer> | null = null;
  let binding: string | null = null;
  let osVersion = "UNAVAILABLE";
  const adb = (serial: string, args: string[]) => labTool(host.android.adb!, ["-P", port, "-s", serial, ...args]);
  const pkg = "com.voyagewright.landfall";
  const apk = path.join(process.cwd(), "native/android/app/build/outputs/apk/debug/app-debug.apk");
  let apkSha256: string | null = null;
  try {
    if (serials.some((serial) => !serial || !/^emulator-\d+$/.test(serial)) || serials[0] === serials[1]) {
      steps.push({ index: 0, action: "NEARBY", state: "UNSUPPORTED", reason: "TWO_OWNED_EMULATORS_REQUIRED" });
    } else {
      apkSha256 = createHash("sha256")
        .update(await readFile(apk))
        .digest("hex");
      for (const serial of serials as string[]) {
        const active = await adb(serial, ["shell", "ps", "-A", "-o", "NAME"]);
        if (active.split(/\r?\n/).some((name) => name.trim() === pkg || name.trim().startsWith(pkg + ":")))
          throw new Error("LANDFALL_RADIO_APP_ALREADY_ACTIVE");
        const api = Number((await adb(serial, ["shell", "getprop", "ro.build.version.sdk"])).trim());
        if (api < 36) throw new Error("LANDFALL_RADIO_API36_REQUIRED");
        const memory = /MemTotal:\s+(\d+)\s+kB/.exec(await adb(serial, ["shell", "cat", "/proc/meminfo"]));
        const sizes = [
          ...(await adb(serial, ["shell", "wm", "size"])).matchAll(/(?:Physical|Override) size:\s*(\d+)x(\d+)/g),
        ];
        const densities = [
          ...(await adb(serial, ["shell", "wm", "density"])).matchAll(/(?:Physical|Override) density:\s*(\d+)/g),
        ];
        const configuration = deviceLabConfigurationSchema.parse({
          platform: "ANDROID",
          virtual: true,
          api,
          model: (await adb(serial, ["shell", "getprop", "ro.product.model"])).trim(),
          memoryKiB: Number(memory?.[1]),
          widthPixels: Number(sizes.at(-1)?.[1]),
          heightPixels: Number(sizes.at(-1)?.[2]),
          densityDpi: Number(densities.at(-1)?.[1]),
        });
        configurations.push(configuration);
        validateDeviceLabProfile(profile, configuration);
      }
      osVersion = (await adb(serials[0]!, ["shell", "getprop", "ro.build.version.release"])).trim();
      authority = await startDeviceLabAuthority(path.join(destination, "authority"), "PHYSICAL");
      ownedResources.push("radio-canonical-authority");
      const bundle = await build({
        entryPoints: [path.join(process.cwd(), "src/landfall/device-lab/radio-browser-client.ts")],
        bundle: true,
        write: false,
        platform: "browser",
        format: "iife",
        target: "es2020",
        logLevel: "silent",
      });
      server = createServer((request, response) => {
        response.setHeader("Cache-Control", "no-store");
        if (request.url === "/radio.js") {
          response.setHeader("Content-Type", "text/javascript");
          response.end(bundle.outputFiles[0].contents);
        } else {
          response.setHeader("Content-Type", "text/html");
          response.end('<!doctype html><h1>Synthetic Landfall radio fixture</h1><script src="/radio.js"></script>');
        }
      });
      await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
      ownedResources.push("radio-loopback-server");
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("LANDFALL_RADIO_SERVER_INVALID");
      binding = `tcp:${address.port}`;
      for (const serial of serials as string[]) {
        if ((await adb(serial, ["reverse", "--list"])).includes(binding))
          throw new Error("LANDFALL_RADIO_BINDING_ACTIVE");
        acquired.push(serial);
        ownedResources.push(`app:${serial}`, `reverse:${serial}`);
        await adb(serial, ["reverse", binding, binding]);
        if (!(await adb(serial, ["install", "-r", apk])).includes("Success"))
          throw new Error("LANDFALL_RADIO_INSTALL_FAILED");
        if (!(await adb(serial, ["shell", "pm", "clear", pkg])).includes("Success"))
          throw new Error("LANDFALL_RADIO_CLEAR_FAILED");
        await adb(serial, ["shell", "pm", "grant", pkg, "android.permission.RANGING"]);
        if (bleScenario) {
          for (const permission of ["BLUETOOTH_SCAN", "BLUETOOTH_CONNECT", "BLUETOOTH_ADVERTISE"])
            await adb(serial, ["shell", "pm", "grant", pkg, `android.permission.${permission}`]);
          await adb(serial, ["shell", "svc", "bluetooth", "enable"]);
          for (const permission of ["ACCESS_COARSE_LOCATION", "ACCESS_FINE_LOCATION"])
            await adb(serial, ["shell", "pm", "grant", pkg, `android.permission.${permission}`]);
          await adb(serial, ["shell", "cmd", "location", "set-location-enabled", "true"]);
          await adb(serial, ["shell", "input", "keyevent", "224"]);
          await adb(serial, ["shell", "input", "keyevent", "82"]);
          const permissions = await adb(serial, ["shell", "dumpsys", "package", pkg]);
          const power = await adb(serial, ["shell", "dumpsys", "power"]);
          const setting = (await adb(serial, ["shell", "cmd", "location", "is-location-enabled"])).trim();
          const prerequisite = {
            preciseLocationGranted: /android\.permission\.ACCESS_FINE_LOCATION: granted=true/.test(permissions),
            locationSettingEnabled: setting === "true",
            screenAwake: /mWakefulness=Awake/.test(power),
          };
          blePrerequisites.push(prerequisite);
          if (!Object.values(prerequisite).every(Boolean)) throw new Error("LANDFALL_BLE_SCAN_PREREQUISITE_FAILED");
        }
        const launch = await adb(serial, [
          "shell",
          "am",
          "start",
          "-W",
          "-n",
          `${pkg}/.LandfallActivity`,
          "--es",
          "labOrigin",
          `http://127.0.0.1:${address.port}`,
        ]);
        if (/Error:|Exception/.test(launch)) throw new Error("LANDFALL_RADIO_LAUNCH_FAILED");
      }
      devices = await boundedAndroidDriver(
        _android.devices({ host: "127.0.0.1", port: Number(port), omitDriverInstall: true }),
      );
      for (const serial of serials as string[]) {
        const device = devices.find((device) => device.serial() === serial);
        if (!device) throw new Error("LANDFALL_RADIO_DEVICE_MISSING");
        const view = await device.webView({ pkg }, { timeout: 30000 });
        const page = await boundedAndroidDriver(view.page());
        await page.waitForFunction(() => !!window.__LandfallLabRadio, undefined, { timeout: 30000 });
        pages.push(page);
      }
      for (const [index, step] of scenario.timeline.entries()) {
        try {
          const action = step.action;
          if (bleScenario && action.type === "NEARBY" && action.state === "RECONNECT") {
            radioStage = "BLE_ADVERTISER_LAUNCH";
            if (action.family !== "BLE" || !action.protocol || action.unverifiedPeer !== true)
              throw new Error("LANDFALL_BLE_SCENARIO_INVALID");
            const labSession = randomUUID();
            const launched = await adb(serials[1]!, [
              "shell",
              "am",
              "start",
              "-W",
              "-n",
              `${pkg}/.LandfallBleLabActivity`,
              "--es",
              "labSession",
              labSession,
              "--es",
              "labProtocol",
              action.protocol,
            ]);
            if (/Error:|Exception/.test(launched)) throw new Error("LANDFALL_BLE_ADVERTISER_LAUNCH_FAILED");
            const deadline = Date.now() + 8000;
            radioStage = "BLE_ADVERTISER_READY";
            while (Date.now() < deadline) {
              const raw = await adb(serials[1]!, [
                "shell",
                "run-as",
                pkg,
                "cat",
                `files/landfall-ble-lab-${labSession}.json`,
              ]).catch(() => "");
              if (raw.length <= 2048) {
                try {
                  const value = z
                    .strictObject({
                      sessionId: z.literal(labSession),
                      state: z.enum([
                        "INITIALIZING",
                        "STARTED",
                        "DENIED",
                        "UNSUPPORTED",
                        "UNAVAILABLE",
                        "STOPPED",
                        "INVALID",
                      ]),
                      synthetic: z.literal(true),
                      canComplete: z.literal(false),
                      failureCode: z.number().int().min(1).max(5).nullable().optional(),
                    })
                    .parse(JSON.parse(raw));
                  advertiserState = value.state;
                  advertiserFailureCode = value.failureCode ?? null;
                } catch {}
              }
              if (advertiserState === "STARTED") break;
              if (advertiserState && advertiserState !== "INITIALIZING")
                throw new Error("LANDFALL_BLE_ADVERTISER_UNAVAILABLE");
              await new Promise((resolve) => setTimeout(resolve, 250));
            }
            if (advertiserState !== "STARTED") throw new Error("LANDFALL_BLE_ADVERTISER_START_TIMEOUT");
            radioStage = "BLE_SCANNER_START";
            const state = await pages[0].evaluate(() => window.__LandfallLabRadio!.ble.start());
            if (state !== "GRANTED") throw new Error("LANDFALL_BLE_SCAN_UNAVAILABLE");
            radioStage = "BLE_NATIVE_DISCOVERY";
            await pages[0].waitForFunction(
              (protocol) => {
                const value = window.__LandfallLabRadio!.ble.snapshot();
                return (
                  value.validatedSignals > 0 &&
                  value.state === "UNTRUSTED" &&
                  value.protocols.includes(protocol) &&
                  !value.peerVerified &&
                  !value.canComplete
                );
              },
              action.protocol,
              { timeout: 12000 },
            );
          } else if (bleScenario && action.type === "NEARBY" && action.state === "DISCONNECT") {
            await pages[0].evaluate(() => window.__LandfallLabRadio!.ble.stop());
            await adb(serials[1]!, ["shell", "am", "force-stop", pkg]);
            advertiserState = "STOPPED_BY_OWNED_APP_TERMINATION";
          } else if (bleScenario && action.type === "ASSERT" && action.field === "nearbyState") {
            const value = await pages[0].evaluate(() => window.__LandfallLabRadio!.ble.snapshot());
            const expected = action.value === "UNAVAILABLE" ? "OFF" : action.value;
            if (
              value.state !== expected ||
              value.canComplete ||
              value.peerVerified ||
              (expected === "OFF" && value.unverifiedPeers !== 0)
            )
              throw new Error("LANDFALL_BLE_PROJECTION_FAILED");
          } else if (action.type === "NEARBY" && action.state === "RECONNECT") {
            const prepared = await Promise.all(
              pages.map((page, index) =>
                page.evaluate(
                  (role) => window.__LandfallLabRadio!.prepare(role),
                  index ? ("CONTROLEE" as const) : ("CONTROLLER" as const),
                ),
              ),
            );
            if (prepared.some((value) => !value)) throw new Error("LANDFALL_RADIO_PREPARATION_FAILED");
            const key = randomBytes(16);
            const expiresAt = Date.now() + 60000;
            try {
              for (const device of [1, 0])
                await pages[device].evaluate((configuration) => window.__LandfallLabRadio!.start(configuration), {
                  peerId: `synthetic-peer-${1 - device}`,
                  sessionId: scenario.seed,
                  security: "PROVISIONED_STS" as const,
                  sessionKey: key.toString("base64"),
                  peerAddress: prepared[1 - device]!.address,
                  channel: prepared[0]!.channel as 5 | 9,
                  preamble: prepared[0]!.preamble!,
                  expiresAt,
                });
            } finally {
              key.fill(0);
            }
            await Promise.all(
              pages.map((page) =>
                page.waitForFunction(
                  () => {
                    const value = window.__LandfallLabRadio!.snapshot();
                    return (
                      value.validatedRanges > 0 &&
                      value.state === "UNTRUSTED" &&
                      !value.canComplete &&
                      !value.peerVerified
                    );
                  },
                  undefined,
                  { timeout: 30000 },
                ),
              ),
            );
          } else if (action.type === "NEARBY" && action.state === "DISCONNECT") {
            await Promise.all(pages.map((page) => page.evaluate(() => window.__LandfallLabRadio!.stop())));
            const native = await Promise.all(
              pages.map((page) => page.evaluate(() => window.__LandfallLabRadio!.nativeState())),
            );
            if (native.some((value) => value.state !== "UNAVAILABLE" || value.sessionProtected || value.peerVerified))
              throw new Error("LANDFALL_RADIO_NATIVE_STOP_FAILED");
          } else if (action.type === "ASSERT" && action.field === "nearbyState") {
            const snapshots = await Promise.all(
              pages.map((page) => page.evaluate(() => window.__LandfallLabRadio!.snapshot())),
            );
            if (snapshots.some((value) => value.state !== action.value || value.rangeAvailable || value.canComplete))
              throw new Error("LANDFALL_RADIO_STOP_ASSERTION_FAILED");
          } else if (
            action.type === "ASSERT" &&
            ["serverConfirmed", "canonicalProgressionEvents"].includes(action.field)
          ) {
            const counts = await authority.counts();
            canonicalProgressionEvents = counts.canonicalProgressionEvents;
            if (
              action.field === "serverConfirmed"
                ? counts.blockCompletions !== 0 || action.value !== false
                : canonicalProgressionEvents !== action.value
            )
              throw new Error("LANDFALL_RADIO_CANONICAL_CHANGED");
          } else throw new Error("LANDFALL_RADIO_ACTION_UNSUPPORTED");
          if (bleScenario)
            bleDiagnostics.push({
              index,
              device: await pages[0].evaluate(() => window.__LandfallLabRadio!.ble.snapshot()),
              advertiserState,
            });
          else
            diagnostics.push({
              index,
              devices: await Promise.all(
                pages.map((page) => page.evaluate(() => window.__LandfallLabRadio!.snapshot())),
              ),
            });
          steps.push({
            index,
            action: action.type,
            state: "PASS",
            translation: {
              method:
                action.type === "ASSERT" && action.field === "canonicalProgressionEvents"
                  ? "REAL_CANONICAL_AUTHORITY"
                  : "OS_NEARBY_SESSION",
              limitation:
                "Real native reports through simulated radios; uncertainty and peer identity remain unverified. No RF accuracy or pose-control claim.",
            },
          });
        } catch (error) {
          if (bleScenario) {
            try {
              const raw = await adb(serials[0]!, ["shell", "run-as", pkg, "cat", "files/landfall-ble-debug.json"]);
              if (raw.length <= 1024)
                nativeBleDiagnostic = z
                  .strictObject({
                    callbacks: z.number().int().min(0).max(100000),
                    emitted: z.number().int().min(0).max(100000),
                    errors: z.number().int().min(0).max(100000),
                    active: z.boolean(),
                  })
                  .parse(JSON.parse(raw));
            } catch {
              /* Missing diagnostic is not inferred zero. */
            }
            const value = await boundedAndroidDriver(
              pages[0].evaluate(() => window.__LandfallLabRadio!.ble.snapshot()),
            ).catch(() => null);
            if (value) bleDiagnostics.push({ index, device: value, advertiserState });
          } else {
            const projections = await Promise.allSettled(
              pages.map((page) => boundedAndroidDriver(page.evaluate(() => window.__LandfallLabRadio!.snapshot()))),
            );
            diagnostics.push({
              index,
              devices: projections.flatMap((value) => (value.status === "fulfilled" ? [value.value] : [])),
            });
          }
          steps.push({
            index,
            action: step.action.type,
            state: "FAIL",
            reason:
              error instanceof Error && /^LANDFALL_[A-Z0-9_]+$/.test(error.message)
                ? error.message
                : "LANDFALL_NATIVE_RADIO_STEP_FAILED",
          });
          break;
        }
      }
    }
  } catch {
    steps.push({ index: steps.length, action: "NEARBY", state: "FAIL", reason: "LANDFALL_NATIVE_RADIO_SETUP_FAILED" });
  } finally {
    for (const page of bleScenario ? pages.slice(0, 1) : pages)
      await boundedAndroidDriver(
        page.evaluate(async () => {
          await window.__LandfallLabRadio!.stop();
          await window.__LandfallLabRadio!.ble.stop();
        }),
        undefined,
        10000,
      ).catch(() => remainingResources.push("radio-stop"));
    for (const serial of acquired) {
      await adb(serial, ["shell", "am", "force-stop", pkg]).catch(() => remainingResources.push(`app:${serial}`));
      if (!(await adb(serial, ["shell", "pm", "clear", pkg]).catch(() => "FAIL")).includes("Success"))
        remainingResources.push(`private:${serial}`);
      if (binding)
        await adb(serial, ["reverse", "--remove", binding]).catch(() => remainingResources.push(`reverse:${serial}`));
      const active = await adb(serial, ["shell", "ps", "-A", "-o", "NAME"]).catch(() => pkg);
      if (active.split(/\r?\n/).some((name) => name.trim().startsWith(pkg)))
        remainingResources.push(`process:${serial}`);
      if (binding && (await adb(serial, ["reverse", "--list"]).catch(() => binding!)).includes(binding))
        remainingResources.push(`binding:${serial}`);
    }
    for (const device of devices)
      await boundedAndroidDriver(device.close(), undefined, 15000).catch(() =>
        remainingResources.push("device-connection"),
      );
    if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
    if (authority) {
      canonicalProgressionEvents = await authority.counts().then(
        (counts) => counts.canonicalProgressionEvents,
        () => null,
      );
      if (!(await authority.cleanup())) remainingResources.push("radio-canonical-authority");
    }
    const after = await deviceLabSourceIdentity();
    if (
      after.sourceFingerprint !== source.sourceFingerprint ||
      after.sourceSha !== source.sourceSha ||
      (apkSha256 &&
        createHash("sha256")
          .update(await readFile(apk))
          .digest("hex") !== apkSha256)
    )
      steps.push({ index: steps.length, action: "NEARBY", state: "FAIL", reason: "LANDFALL_RADIO_INPUT_CHANGED" });
    const file = path.join(destination, "native-radio-session.json");
    await writeFile(
      file,
      JSON.stringify(
        {
          source,
          apkSha256,
          serials,
          configurations,
          diagnostics,
          bleDiagnostics,
          advertiserState,
          advertiserFailureCode,
          nativeBleDiagnostic,
          radioStage,
          blePrerequisites,
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
  return {
    steps,
    cleanup: {
      result: remainingResources.length ? ("FAIL" as const) : ("PASS" as const),
      ownedResources,
      remainingResources,
    },
    artifacts,
    osVersion,
    runtimeVersion: host.android.emulatorVersion ?? "UNAVAILABLE",
    deviceConfiguration: configurations[0],
    canonicalProgressionEvents,
    authorityFixtureHash: authority?.fixtureHash,
  };
}

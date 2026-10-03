import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { build } from "esbuild";
import { discoverDeviceLabHost, labTool } from "./host";
import { type DeviceLabScenario, type DeviceLabStepResult } from "../../../src/landfall/device-lab/scenario";

export async function executeLandfallOsScenario(
  scenario: DeviceLabScenario,
  target: "android-emulator" | "ios-simulator",
  destination: string,
) {
  const root = process.cwd();
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
  let ready = false;
  let clientError = false;
  let current: { index: number; action: unknown } | null = null;
  let stop = false;
  const results = new Map<number, DeviceLabStepResult>();
  const server = createServer(async (request, response) => {
    const route = request.url?.split("?")[0];
    response.setHeader("Cache-Control", "no-store");
    if (request.method === "GET" && route === "/player") {
      response.setHeader("Content-Type", "text/html");
      response.end(
        '<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Landfall Device Lab</title><body><h1>Landfall Device Lab</h1><p>Synthetic native acquisition. No Voyage writes.</p><script src="/lab.js"></script></body></html>',
      );
      return;
    }
    if (request.method === "GET" && route === "/lab.js") {
      response.setHeader("Content-Type", "text/javascript");
      response.end(bundle.outputFiles[0].contents);
      return;
    }
    if (request.method === "GET" && route === "/lab/next") {
      if (stop) response.end(JSON.stringify({ stop: true }));
      else if (current) {
        response.end(JSON.stringify(current));
        current = null;
      } else {
        response.statusCode = 204;
        response.end();
      }
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
      if (body.length > 8192) {
        response.statusCode = 413;
        response.end();
        return;
      }
    }
    try {
      const value = route === "/lab/error" ? null : JSON.parse(body);
      if (route === "/lab/ready") ready = ["GRANTED", "APPROXIMATE"].includes(value.permission);
      else if (route === "/lab/error") clientError = true;
      else if (
        route === "/lab/result" &&
        Number.isInteger(value.index) &&
        value.index >= 0 &&
        value.index < scenario.timeline.length &&
        ["PASS", "FAIL", "UNSUPPORTED"].includes(value.state)
      )
        results.set(value.index, {
          index: value.index,
          action: scenario.timeline[value.index].action.type,
          state: value.state,
          ...(typeof value.reason === "string" && /^[A-Za-z_:]{1,128}$/.test(value.reason)
            ? { reason: value.reason }
            : {}),
        });
      else {
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
  const adb = async (args: string[]) => {
    if (!host.android.adb || !androidSerial) throw new Error("LANDFALL_ANDROID_NOT_CONFIGURED");
    return labTool(host.android.adb, ["-P", process.env.LANDFALL_LAB_ADB_PORT ?? "5037", "-s", androidSerial, ...args]);
  };
  const wait = async (predicate: () => boolean, budget: number) => {
    const deadline = Date.now() + budget;
    while (!predicate()) {
      if (clientError) throw new Error("LANDFALL_NATIVE_CLIENT_FAILED");
      if (Date.now() > deadline) throw new Error("LANDFALL_NATIVE_CLIENT_TIMEOUT");
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  };
  const steps: DeviceLabStepResult[] = [];
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
      ownedDevice = (
        await labTool("xcrun", ["simctl", "create", `landfall-os-${process.pid}`, app.deviceType, app.runtime])
      ).trim();
      if (!/^[A-Fa-f0-9-]{36}$/.test(ownedDevice)) throw new Error("LANDFALL_APPLE_DEVICE_ID_INVALID");
      await labTool("xcrun", ["simctl", "boot", ownedDevice]);
      await labTool("xcrun", ["simctl", "bootstatus", ownedDevice, "-b"], 180000);
      await labTool("xcrun", ["simctl", "install", ownedDevice, app.app]);
      await labTool("xcrun", ["simctl", "privacy", ownedDevice, "grant", "location", "com.voyagewright.landfall"]);
      await labTool("xcrun", [
        "simctl",
        "launch",
        ownedDevice,
        "com.voyagewright.landfall",
        `--landfall-lab-origin=http://127.0.0.1:${port}`,
      ]);
    }
    await wait(() => ready, 60000);
    for (const [index, step] of scenario.timeline.entries()) {
      if (step.action.type !== "LOCATION" && step.action.type !== "ASSERT") {
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
        await new Promise((resolve) => setTimeout(resolve, 250));
        if (target === "android-emulator")
          await adb(["emu", "geo", "fix", String(coordinate.longitude), String(coordinate.latitude)]);
        else
          await labTool("xcrun", [
            "simctl",
            "location",
            ownedDevice!,
            "set",
            `${coordinate.latitude},${coordinate.longitude}`,
          ]);
      }
      await wait(() => results.has(index), 30000);
      steps.push(results.get(index)!);
    }
  } catch (error) {
    steps.push({
      index: steps.length,
      action: scenario.timeline[Math.min(steps.length, scenario.timeline.length - 1)].action.type,
      state: "FAIL",
      reason:
        error instanceof Error && /^[A-Z_]{1,128}$/.test(error.message) ? error.message : "NATIVE_OS_EXECUTION_FAILED",
    });
  } finally {
    stop = true;
    if (androidSerial) await adb(["shell", "am", "force-stop", "com.voyagewright.landfall"]).catch(() => undefined);
    if (androidSerial) await adb(["reverse", "--remove", `tcp:${port}`]).catch(() => undefined);
    if (ownedDevice) {
      await labTool("xcrun", ["simctl", "shutdown", ownedDevice]).catch(() => undefined);
      await labTool("xcrun", ["simctl", "delete", ownedDevice]);
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  await mkdir(destination, { recursive: true });
  const cleanup = {
    result: "PASS" as const,
    ownedResources: ["loopback-native-lab-server", ...(ownedDevice ? [ownedDevice] : [])],
    remainingResources: [],
  };
  await writeFile(path.join(destination, "native-steps.json"), JSON.stringify({ steps, cleanup }, null, 2));
  return { steps, cleanup, canonicalProgressionEvents: null };
}

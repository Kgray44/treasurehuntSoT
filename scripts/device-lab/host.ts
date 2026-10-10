import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execute = promisify(execFile);
export type DeviceLabHostCapabilities = {
  version: 1;
  hostPlatform: NodeJS.Platform;
  architecture: string;
  osVersion: string;
  hosted: boolean;
  nodeVersion: string;
  android: {
    sdkConfigured: boolean;
    adb: string | null;
    emulator: string | null;
    adbVersion: string | null;
    emulatorVersion: string | null;
  };
  apple: {
    configured: boolean;
    xcodeVersion: string | null;
    runtimes: { id: string; name: string; available: boolean }[];
    devices: { id: string; name: string; runtime: string; state: string; available: boolean }[];
  };
};
async function exists(file: string) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}
/** Only trusted fixed tool/argv calls. Scenario data can never become an executable or a shell command. */
export async function labTool(
  command: string,
  args: string[],
  timeoutMs = process.platform === "darwin" && process.env.GITHUB_ACTIONS === "true" ? 120000 : 30000,
  signal?: AbortSignal,
): Promise<string> {
  const result = await execute(command, args, {
    timeout: timeoutMs,
    signal,
    maxBuffer: 8 * 1024 * 1024,
    windowsHide: true,
  });
  return result.stdout;
}
/** Binary ADB output must never pass through text decoding or a shell redirect. */
export async function labBinaryTool(command: string, args: string[], timeoutMs = 30000): Promise<Buffer> {
  const result = await execute(command, args, {
    timeout: timeoutMs,
    encoding: "buffer",
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
  });
  return result.stdout;
}
export async function discoverDeviceLabHost(): Promise<DeviceLabHostCapabilities> {
  const sdk =
    process.env.ANDROID_SDK_ROOT ||
    process.env.ANDROID_HOME ||
    (process.platform === "win32"
      ? path.join(os.homedir(), "AppData", "Local", "Android", "Sdk")
      : process.platform === "darwin"
        ? path.join(os.homedir(), "Library", "Android", "sdk")
        : path.join(os.homedir(), "Android", "Sdk"));
  const adbPath = path.join(sdk, "platform-tools", process.platform === "win32" ? "adb.exe" : "adb");
  const emulatorPath = path.join(sdk, "emulator", process.platform === "win32" ? "emulator.exe" : "emulator");
  const adb = (await exists(adbPath)) ? adbPath : null;
  const emulator = (await exists(emulatorPath)) ? emulatorPath : null;
  const inventory: DeviceLabHostCapabilities = {
    version: 1,
    hostPlatform: process.platform,
    architecture: process.arch,
    osVersion: os.release(),
    hosted: process.env.GITHUB_ACTIONS === "true",
    nodeVersion: process.version,
    android: { sdkConfigured: Boolean(adb || emulator), adb, emulator, adbVersion: null, emulatorVersion: null },
    apple: { configured: false, xcodeVersion: null, runtimes: [], devices: [] },
  };
  if (adb) {
    try {
      inventory.android.adbVersion = (await labTool(adb, ["version"])).split(/\r?\n/)[0].slice(0, 200);
    } catch {
      inventory.android.adb = null;
    }
  }
  if (emulator) {
    try {
      inventory.android.emulatorVersion = (await labTool(emulator, ["-version"])).split(/\r?\n/)[0].slice(0, 200);
    } catch {
      inventory.android.emulator = null;
    }
  }
  if (process.platform === "darwin") {
    try {
      inventory.apple.xcodeVersion = (await labTool("xcodebuild", ["-version"])).trim().slice(0, 200);
      // CoreSimulator can initialize slowly on a fresh hosted machine. Its real
      // inventory must finish before declaring this host unavailable.
      const runtimes = JSON.parse(await labTool("xcrun", ["simctl", "list", "runtimes", "--json"], 120000));
      const devices = JSON.parse(await labTool("xcrun", ["simctl", "list", "devices", "--json"], 120000));
      inventory.apple.runtimes = (runtimes.runtimes ?? [])
        .filter(
          (item: { identifier: unknown; name: unknown }) =>
            typeof item.identifier === "string" && typeof item.name === "string",
        )
        .map((item: { identifier: string; name: string; isAvailable: boolean }) => ({
          id: item.identifier,
          name: item.name,
          available: item.isAvailable === true,
        }));
      inventory.apple.devices = Object.entries(devices.devices ?? {}).flatMap(([runtime, rows]) =>
        Array.isArray(rows)
          ? rows
              .filter((item) => typeof item.udid === "string" && typeof item.name === "string")
              .map((item) => ({
                id: item.udid,
                name: item.name,
                runtime,
                state: String(item.state ?? "Unknown"),
                available: item.isAvailable === true,
              }))
          : [],
      );
      inventory.apple.configured = inventory.apple.runtimes.some(
        (runtime) => runtime.available && runtime.id.includes("iOS"),
      );
    } catch {
      inventory.apple.configured = false;
    }
  }
  return inventory;
}

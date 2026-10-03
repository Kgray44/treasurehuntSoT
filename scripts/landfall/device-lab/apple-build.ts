import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { discoverDeviceLabHost, labTool } from "./host";

async function main() {
  if (process.platform !== "darwin") throw new Error("LANDFALL_APPLE_REQUIRES_MACOS");
  const root = process.cwd();
  const destination = path.join(root, "artifacts", "landfall-device-lab", "apple-build");
  await mkdir(destination, { recursive: true });
  const host = await discoverDeviceLabHost();
  await writeFile(path.join(destination, "capabilities.json"), JSON.stringify(host, null, 2));
  const runtime = host.apple.runtimes
    .filter((item) => item.available && item.id.includes("iOS"))
    .sort((a, b) => b.id.localeCompare(a.id, undefined, { numeric: true }))[0];
  if (!runtime) throw new Error("LANDFALL_APPLE_RUNTIME_UNAVAILABLE");
  const types = JSON.parse(await labTool("xcrun", ["simctl", "list", "devicetypes", "--json"]));
  const deviceType = types.devicetypes
    .filter(
      (item: { identifier: string; name: string }) =>
        item.identifier?.includes("iPhone") && item.name?.includes("iPhone"),
    )
    .at(-1);
  if (!deviceType) throw new Error("LANDFALL_APPLE_DEVICE_TYPE_UNAVAILABLE");
  const name = `landfall-owned-${process.pid}`;
  const id = (await labTool("xcrun", ["simctl", "create", name, deviceType.identifier, runtime.id])).trim();
  if (!/^[A-Fa-f0-9-]{36}$/.test(id)) throw new Error("LANDFALL_APPLE_DEVICE_ID_INVALID");
  let clean = false;
  try {
    await labTool("xcrun", ["simctl", "boot", id]);
    await labTool("xcrun", ["simctl", "bootstatus", id, "-b"], 180000);
    await labTool("xcodegen", ["generate", "--spec", path.join(root, "native", "ios", "project.yml")]);
    // Generated, ignored lab plist only. Release source accepts HTTPS origins exclusively.
    await labTool("plutil", [
      "-insert",
      "NSAppTransportSecurity",
      "-json",
      JSON.stringify({ NSAllowsArbitraryLoadsInWebContent: true }),
      path.join(root, "native", "ios", "LandfallCompanion", "Info.plist"),
    ]);
    const output = await labTool(
      "xcodebuild",
      [
        "-quiet",
        "-project",
        path.join(root, "native", "ios", "LandfallCompanion.xcodeproj"),
        "-scheme",
        "LandfallCompanion",
        "-destination",
        `platform=iOS Simulator,id=${id}`,
        "-derivedDataPath",
        path.join(destination, "DerivedData"),
        "-resultBundlePath",
        path.join(destination, "NativeTests.xcresult"),
        "CODE_SIGNING_ALLOWED=NO",
        "test",
      ],
      1200000,
    );
    await writeFile(
      path.join(destination, "build-summary.txt"),
      output
        .split(/\r?\n/)
        .filter((line) => /Test Suite|Executed|TEST SUCCEEDED|BUILD SUCCEEDED/.test(line))
        .join("\n"),
    );
    await writeFile(
      path.join(root, "artifacts", "landfall-device-lab", "apple-app.json"),
      JSON.stringify({
        app: path.join(
          destination,
          "DerivedData",
          "Build",
          "Products",
          "Debug-iphonesimulator",
          "LandfallCompanion.app",
        ),
        runtime: runtime.id,
        deviceType: deviceType.identifier,
      }),
    );
  } finally {
    await labTool("xcrun", ["simctl", "shutdown", id]).catch(() => undefined);
    await labTool("xcrun", ["simctl", "delete", id]);
    const devices = JSON.parse(await labTool("xcrun", ["simctl", "list", "devices", "--json"]));
    clean = !Object.values(devices.devices as Record<string, { udid: string }[]>)
      .flat()
      .some((item) => item.udid === id);
    await writeFile(
      path.join(destination, "cleanup.json"),
      JSON.stringify({ result: clean ? "PASS" : "FAIL", ownedResources: [id], remainingResources: clean ? [] : [id] }),
    );
  }
  if (!clean) throw new Error("LANDFALL_APPLE_CLEANUP_FAILED");
}
main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error && /^[A-Z_]+$/.test(error.message) ? error.message : "LANDFALL_APPLE_BUILD_FAILED"}\n`,
  );
  process.exitCode = 1;
});

import { mkdir, writeFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { discoverDeviceLabHost, labTool } from "./host";
import { deviceLabProfileSchema, selectAppleLabDevice } from "../../../src/landfall/device-lab/device-profile";

let executionStage = "DISCOVERY";
let failureStage: string | null = null;
async function main() {
  if (process.platform !== "darwin") throw new Error("LANDFALL_APPLE_REQUIRES_MACOS");
  const root = process.cwd();
  const profile = deviceLabProfileSchema.parse(process.env.LANDFALL_LAB_PROFILE ?? "primary-phone");
  const destination = path.join(root, "artifacts", "landfall-device-lab", "apple-build");
  await mkdir(destination, { recursive: true });
  let host = await discoverDeviceLabHost();
  if (!host.apple.configured) {
    executionStage = "PROVISION_RUNTIME";
    // Ephemeral Apple hosts provision the official runtime when none is usable.
    // A failed provisioning command remains a failure, never simulated proof.
    await labTool("xcodebuild", ["-downloadPlatform", "iOS"], 900000);
    host = await discoverDeviceLabHost();
  }
  await writeFile(path.join(destination, "capabilities.json"), JSON.stringify(host, null, 2));
  const runtime = host.apple.runtimes
    .filter((item) => item.available && item.id.includes("iOS"))
    .sort((a, b) => b.id.localeCompare(a.id, undefined, { numeric: true }))[0];
  if (!runtime) throw new Error("LANDFALL_APPLE_RUNTIME_UNAVAILABLE");
  executionStage = "DEVICE_TYPE_INVENTORY";
  const types = JSON.parse(await labTool("xcrun", ["simctl", "list", "devicetypes", "--json"]));
  const compatibleNames = new Set(
    host.apple.devices.filter((item) => item.available && item.runtime === runtime.id).map((item) => item.name),
  );
  const deviceType = selectAppleLabDevice(
    profile,
    types.devicetypes.filter(
      (item: { identifier: string; name: string }) =>
        typeof item.identifier === "string" && compatibleNames.has(item.name),
    ),
  );
  const name = `landfall-owned-${process.pid}`;
  executionStage = "CREATE_SIMULATOR";
  const id = (await labTool("xcrun", ["simctl", "create", name, deviceType.identifier, runtime.id])).trim();
  if (!/^[A-Fa-f0-9-]{36}$/.test(id)) throw new Error("LANDFALL_APPLE_DEVICE_ID_INVALID");
  let clean = false;
  try {
    executionStage = "BOOT_SIMULATOR";
    await labTool("xcrun", ["simctl", "boot", id]);
    await labTool("xcrun", ["simctl", "bootstatus", id, "-b"], 420000);
    executionStage = "GENERATE_XCODE_PROJECT";
    await labTool("xcodegen", ["generate", "--spec", path.join(root, "native", "ios", "project.yml")], 180000);
    executionStage = "CONFIGURE_OWNED_LAB_PLIST";
    // Generated, ignored lab plist only. Release source accepts HTTPS origins exclusively.
    await labTool("plutil", [
      "-insert",
      "NSAppTransportSecurity",
      "-json",
      JSON.stringify({ NSAllowsArbitraryLoadsInWebContent: true }),
      path.join(root, "native", "ios", "LandfallCompanion", "Info.plist"),
    ]);
    await labTool("plutil", [
      "-replace",
      "WKAppBoundDomains",
      "-json",
      '["127.0.0.1"]',
      path.join(root, "native", "ios", "LandfallCompanion", "Info.plist"),
    ]);
    executionStage = "NATIVE_BUILD_AND_XCTEST";
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
        "CODE_SIGNING_ALLOWED=YES",
        "CODE_SIGN_IDENTITY=-",
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
        profile,
      }),
    );
  } catch (error) {
    failureStage = executionStage;
    const resultPath = path.join(destination, "NativeTests.xcresult");
    const hasResult = await stat(resultPath).then(
      () => true,
      () => false,
    );
    const summary = hasResult
      ? await labTool("xcrun", ["xcresulttool", "get", "test-results", "summary", "--path", resultPath]).catch(
          () => "XCRESULT_SUMMARY_UNAVAILABLE",
        )
      : "XCRESULT_NOT_CREATED";
    await writeFile(path.join(destination, "test-summary.json"), summary);
    process.stderr.write(`${summary.slice(-16000)}\n`);
    throw error;
  } finally {
    executionStage = "CLEANUP_OWNED_SIMULATOR";
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
main().catch(async (error) => {
  const diagnostic =
    error && typeof error === "object"
      ? (error as { code?: unknown; killed?: unknown; signal?: unknown; stdout?: unknown; stderr?: unknown })
      : {};
  const destination = path.join(process.cwd(), "artifacts", "landfall-device-lab", "apple-build");
  await mkdir(destination, { recursive: true });
  await writeFile(
    path.join(destination, "execution-error.json"),
    JSON.stringify(
      {
        stage: failureStage ?? executionStage,
        code: typeof diagnostic.code === "number" ? diagnostic.code : null,
        killed: diagnostic.killed === true,
        signal:
          typeof diagnostic.signal === "string" && /^[A-Z0-9]+$/.test(diagnostic.signal) ? diagnostic.signal : null,
        diagnosticHash: createHash("sha256")
          .update(
            [diagnostic.stdout, diagnostic.stderr]
              .filter((value): value is string => typeof value === "string")
              .join("\n"),
          )
          .digest("hex"),
      },
      null,
      2,
    ),
  );
  // These are fixed tooling commands running synthetic fixtures, never production data.
  // Preserve bounded compiler/tool diagnostics so a failed hosted build is actionable.
  if (error && typeof error === "object") {
    const diagnostic = error as { message?: unknown; stdout?: unknown; stderr?: unknown };
    for (const value of [diagnostic.message, diagnostic.stdout, diagnostic.stderr]) {
      if (typeof value === "string") process.stderr.write(`${value.slice(-16000)}\n`);
    }
  }
  process.stderr.write(
    `${error instanceof Error && /^[A-Z_]+$/.test(error.message) ? error.message : "LANDFALL_APPLE_BUILD_FAILED"}\n`,
  );
  process.exitCode = 1;
});

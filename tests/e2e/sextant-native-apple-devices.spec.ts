// @sounding-line-registration owner=project-sextant suite=browser.sextant contracts=sextant.phase4.native-context
import { test, expect } from "@playwright/test";
import { hash } from "bcryptjs";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { db } from "../../src/lib/db";
import { labTool } from "../../scripts/device-lab/host";
import { deviceLabSourceIdentity } from "../../scripts/device-lab/source";
import { closureAccount } from "./fixtures/landfall-closure";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";

test.describe.configure({ mode: "serial", timeout: 900000 });
test.use({ trace: "off", video: "off", screenshot: "off" });
test.skip(process.env.SEXTANT_NATIVE_APPLE_PRODUCT !== "1", "Requires the owned hosted Apple product runtime.");
test.afterAll(() => db.$disconnect());

test("actual iOS Devices: ordinary sign-in, native refusal, large text, rotation and background fallback", async ({
  baseURL,
}, info) => {
  if (
    process.platform !== "darwin" ||
    process.env.GITHUB_ACTIONS !== "true" ||
    process.env.RUNNER_ENVIRONMENT !== "github-hosted" ||
    process.env.SOUNDING_LINE_SUITE_PROFILE !== "generic"
  )
    throw new Error("SEXTANT_OWNED_HOSTED_APPLE_PRODUCT_REQUIRED");
  ensureGenericSoundingLineIsolation();
  const origin = new URL(baseURL!);
  if (origin.protocol !== "http:" || origin.hostname !== "127.0.0.1" || !origin.port)
    throw new Error("SEXTANT_OWNED_PRODUCT_ORIGIN_REQUIRED");
  const root = process.cwd();
  const app = JSON.parse(await readFile("artifacts/landfall-device-lab/apple-app.json", "utf8")) as {
    app: string;
    runtime: string;
    deviceType: string;
    profile: string;
  };
  const appPath = await realpath(app.app);
  const buildRoot = await realpath(path.join(root, "artifacts", "landfall-device-lab", "apple-build"));
  if (
    !appPath.startsWith(buildRoot + path.sep) ||
    path.basename(appPath) !== "LandfallCompanion.app" ||
    app.profile !== "primary-phone" ||
    !/^com\.apple\.CoreSimulator\.SimRuntime\.iOS-[0-9-]+$/.test(app.runtime) ||
    !/^com\.apple\.CoreSimulator\.SimDeviceType\.iPhone-[A-Za-z0-9-]+$/.test(app.deviceType)
  )
    throw new Error("SEXTANT_OWNED_APPLE_BUILD_REQUIRED");
  const source = await deviceLabSourceIdentity(["tests/e2e/sextant-native-apple-devices.spec.ts"]);
  const account = await closureAccount("Synthetic Apple navigator");
  const email = await db.accountEmail.findFirstOrThrow({ where: { accountId: account.id } });
  const password = `Owned-${randomUUID()}-Aa7!`;
  await db.accountCredential.create({ data: { accountId: account.id, passwordHash: await hash(password, 4) } });
  await db.accountRoleAssignment.create({ data: { accountId: account.id, role: "PLAYER" } });
  const before = await db.taleSessionEvent.count();
  const evidence = info.outputPath("native-apple-product");
  await mkdir(evidence, { recursive: true });
  let device: string | null = null;
  let result = "FAIL";
  let summary: { result: string; passedTests: number; failedTests: number; skippedTests: number } | null = null;
  try {
    device = (
      await labTool("xcrun", ["simctl", "create", `sextant-product-${randomUUID()}`, app.deviceType, app.runtime])
    ).trim();
    if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(device)) {
      device = null;
      throw new Error("SEXTANT_OWNED_SIMULATOR_ID_REQUIRED");
    }
    await labTool("xcrun", ["simctl", "boot", device]);
    await labTool("xcrun", ["simctl", "bootstatus", device, "-b"], 420000);
    await labTool("xcrun", ["simctl", "install", device, appPath], 120000);
    await labTool("xcrun", ["simctl", "ui", device, "content_size", "accessibility-extra-extra-extra-large"]);
    const textSize = (await labTool("xcrun", ["simctl", "ui", device, "content_size"])).trim();
    expect(textSize.toLowerCase().replaceAll("-", "")).toBe("accessibilityextraextraextralarge");
    await writeFile(
      path.join(evidence, "environment.json"),
      JSON.stringify(
        {
          source,
          profile: app.profile,
          runtime: app.runtime,
          deviceType: app.deviceType,
          contentSize: textSize,
          xcode: (await labTool("xcodebuild", ["-version"])).trim(),
          fidelity: "ACTUAL_IOS_SIMULATOR_PRODUCT_WEBVIEW_NO_INJECTED_BRIDGE",
          physicalHardwareProven: false,
        },
        null,
        2,
      ),
    );
    const bundle = path.join(evidence, "ProductDevices.xcresult");
    try {
      await labTool(
        "xcodebuild",
        [
          "-quiet",
          "-project",
          path.join(root, "native", "ios", "LandfallCompanion.xcodeproj"),
          "-scheme",
          "LandfallCompanion",
          "-destination",
          `platform=iOS Simulator,id=${device}`,
          "-derivedDataPath",
          path.join(buildRoot, "DerivedData"),
          "-resultBundlePath",
          bundle,
          "-only-testing:LandfallCompanionUiTests/NativeLifecycleTests/testOwnedProductDevices",
          "CODE_SIGNING_ALLOWED=YES",
          "CODE_SIGN_IDENTITY=-",
          `SEXTANT_PRODUCT_ORIGIN=${origin.origin}`,
          `SEXTANT_PRODUCT_LOGIN=${email.normalizedEmail}`,
          `SEXTANT_PRODUCT_PASSWORD=${password}`,
          "test-without-building",
        ],
        600000,
      );
    } finally {
      // Keep actual failures/screenshots too. No raw private account is used.
      const raw = await labTool("xcrun", ["xcresulttool", "get", "test-results", "summary", "--path", bundle]);
      await writeFile(path.join(evidence, "test-summary.json"), raw);
      summary = JSON.parse(raw);
      await labTool("xcrun", [
        "xcresulttool",
        "export",
        "attachments",
        "--path",
        bundle,
        "--output-path",
        path.join(evidence, "attachments"),
      ]);
    }
    expect(summary).toMatchObject({ result: "Passed", passedTests: 1, failedTests: 0, skippedTests: 0 });
    expect(await db.taleSessionEvent.count()).toBe(before);
    result = "PASS";
  } finally {
    const cleanup: { result: string; remainingResources: string[] } = { result: "PASS", remainingResources: [] };
    if (device) {
      await labTool("xcrun", ["simctl", "shutdown", device]).catch(() => undefined);
      await labTool("xcrun", ["simctl", "delete", device]).catch(() => cleanup.remainingResources.push(device!));
      const inventory = JSON.parse(await labTool("xcrun", ["simctl", "list", "devices", "--json"]));
      const remaining = Object.values(inventory.devices as Record<string, { udid: string }[]>)
        .flat()
        .some((entry) => entry.udid === device);
      if (remaining && !cleanup.remainingResources.includes(device)) cleanup.remainingResources.push(device);
    }
    await db.userAccount.delete({ where: { id: account.id } });
    if (cleanup.remainingResources.length) cleanup.result = "FAIL";
    await writeFile(
      path.join(evidence, "receipt.json"),
      JSON.stringify(
        {
          version: 1,
          source,
          scenarioId: "sextant.native-apple-product-devices",
          tier: "D3",
          result,
          nativeBridge: "ACTUAL_IOS_WKWEBVIEW",
          injectedBridge: false,
          nativeTestSummary: summary,
          canonicalProgressionDelta: (await db.taleSessionEvent.count()) - before,
          cleanup,
          limitations: [
            "Simulator sensor/radio/haptic hardware is not physical proof.",
            "The isolated debug loopback origin is not deployed HTTPS qualification.",
          ],
        },
        null,
        2,
      ),
    );
    expect(cleanup.result).toBe("PASS");
  }
});

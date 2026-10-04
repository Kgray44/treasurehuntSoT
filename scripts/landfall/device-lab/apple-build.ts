import { mkdir, writeFile, stat, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { discoverDeviceLabHost, labTool } from "./host";
import { deviceLabProfileSchema, selectAppleLabDevice } from "../../../src/landfall/device-lab/device-profile";

let executionStage = "DISCOVERY";
let failureStage: string | null = null;
async function main() {
  if (process.platform !== "darwin") throw new Error("LANDFALL_APPLE_REQUIRES_MACOS");
  const root = process.cwd();
  const scope = process.argv[2] ?? "all";
  if (!["all", "companion-only"].includes(scope)) throw new Error("LANDFALL_APPLE_BUILD_SCOPE_INVALID");
  const presentationRequired = scope === "all";
  const profile = deviceLabProfileSchema.parse(process.env.LANDFALL_LAB_PROFILE ?? "primary-phone");
  const destination = path.join(root, "artifacts", "landfall-device-lab", "apple-build");
  await mkdir(destination, { recursive: true });
  let resultPath = path.join(destination, "NativeTests.xcresult");
  const presentationTests = [
    "LandfallCompanionUiTests/NativeLifecycleTests/testOwnedSimulatorLargeTextAndOrientation",
    "LandfallCompanionUiTests/NativeLifecycleTests/testOwnedSimulatorReducedMotionSetting",
  ];
  await writeFile(
    path.join(destination, "build-scope.json"),
    JSON.stringify(
      {
        scope: presentationRequired ? "COMPANION_AND_PRESENTATION" : "COMPANION_ONLY",
        requiredPassingTests: presentationRequired ? 19 : 17,
        excludedPresentationTests: presentationRequired ? [] : presentationTests,
        independentPresentationReceiptRequired: !presentationRequired,
        presentationAcceptance: false,
      },
      null,
      2,
    ),
  );
  let host = await discoverDeviceLabHost();
  if (!host.apple.configured) {
    executionStage = "PROVISION_RUNTIME";
    // Ephemeral Apple hosts provision the official runtime when none is usable.
    // A failed provisioning command remains a failure, never simulated proof.
    await labTool("xcodebuild", ["-downloadPlatform", "iOS"], 900000);
    host = await discoverDeviceLabHost();
  }
  await writeFile(path.join(destination, "capabilities.json"), JSON.stringify(host, null, 2));
  const minimumIOS = (await readFile(path.join(root, "native", "ios", "project.yml"), "utf8")).match(
    /^\s+iOS:\s*"([0-9.]+)"/m,
  )?.[1];
  if (!minimumIOS) throw new Error("LANDFALL_APPLE_DEPLOYMENT_TARGET_UNAVAILABLE");
  const versionScore = (value: string) =>
    value
      .split(/[.-]/)
      .map(Number)
      .reduce((total, part, index) => total + part * (index === 0 ? 1000000 : index === 1 ? 1000 : 1), 0);
  const runtime = host.apple.runtimes
    .filter((item) => {
      const version = item.id.match(/\.iOS-([0-9-]+)$/)?.[1];
      return (
        item.available &&
        version !== undefined &&
        versionScore(version) >= versionScore(minimumIOS) &&
        host.apple.devices.some((device) => device.available && device.runtime === item.id)
      );
    })
    .sort((a, b) =>
      presentationRequired
        ? a.id.localeCompare(b.id, undefined, { numeric: true })
        : b.id.localeCompare(a.id, undefined, { numeric: true }),
    )[0];
  if (!runtime) throw new Error("LANDFALL_APPLE_RUNTIME_UNAVAILABLE");
  await writeFile(
    path.join(destination, "runtime-selection.json"),
    JSON.stringify(
      {
        runtime: runtime.id,
        minimumIOS,
        policy: presentationRequired ? "PREINSTALLED_OLDEST_SUPPORTED_PRESENTATION" : "PREINSTALLED_LATEST_COMPANION",
      },
      null,
      2,
    ),
  );
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
    executionStage = "CONFIGURE_OWNED_PRESENTATION";
    await labTool("xcrun", ["simctl", "ui", id, "appearance", "dark"]);
    await labTool("xcrun", ["simctl", "ui", id, "content_size", "accessibility-extra-extra-extra-large"]);
    const appearance = (await labTool("xcrun", ["simctl", "ui", id, "appearance"])).trim().toLowerCase();
    const contentSize = (await labTool("xcrun", ["simctl", "ui", id, "content_size"]))
      .replace(/[^a-z]/gi, "")
      .toLowerCase();
    if (appearance !== "dark" || contentSize !== "accessibilityextraextraextralarge")
      throw new Error("LANDFALL_APPLE_PRESENTATION_UNOBSERVED");
    process.env.LANDFALL_LAB_PRESENTATION = "1";
    await writeFile(
      path.join(destination, "presentation-environment.json"),
      JSON.stringify(
        {
          sourceClass: "ACTUAL_OWNED_SIMULATOR_SETTINGS",
          appearance: "DARK",
          contentSize: "ACCESSIBILITY_XXXL",
          fixture: "UNCONFIGURED_READABLE_FALLBACK",
          productionJournalRenderingProven: false,
          physicalAssistiveTechnologyProven: false,
        },
        null,
        2,
      ),
    );
    executionStage = "GENERATE_XCODE_PROJECT";
    await labTool("xcodegen", ["generate", "--spec", path.join(root, "native", "ios", "project.yml")], 180000);
    const orientationPlist = path.join(root, "native", "ios", "LandfallCompanion", "Info.plist");
    const phoneOrientations = JSON.parse(
      await labTool("plutil", ["-extract", "UISupportedInterfaceOrientations", "json", "-o", "-", orientationPlist]),
    );
    const tabletOrientations = JSON.parse(
      await labTool("plutil", [
        "-extract",
        "UISupportedInterfaceOrientations~ipad",
        "json",
        "-o",
        "-",
        orientationPlist,
      ]),
    );
    const requiredOrientations = [
      "UIInterfaceOrientationPortrait",
      "UIInterfaceOrientationLandscapeLeft",
      "UIInterfaceOrientationLandscapeRight",
    ];
    if (
      ![phoneOrientations, tabletOrientations].every(
        (values) => Array.isArray(values) && requiredOrientations.every((value) => values.includes(value)),
      ) ||
      !tabletOrientations.includes("UIInterfaceOrientationPortraitUpsideDown")
    )
      throw new Error("LANDFALL_APPLE_SUPPORTED_ORIENTATIONS_REQUIRED");
    await writeFile(
      path.join(destination, "orientation-configuration.json"),
      JSON.stringify(
        {
          sourceClass: "ACTUAL_GENERATED_APP_PLIST",
          phoneOrientations,
          tabletOrientations,
          actualRotationAcceptance: false,
        },
        null,
        2,
      ),
    );
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
        "LANDFALL_LAB_PRESENTATION=1",
        ...(presentationRequired
          ? [`-skip-testing:${presentationTests[1]}`]
          : presentationTests.map((test) => `-skip-testing:${test}`)),
        "test",
      ],
      1200000,
    );
    await writeFile(
      path.join(destination, "build-summary.txt"),
      output
        .split(/\r?\n/)
        .filter((line) =>
          /Test Suite|Executed|TEST SUCCEEDED|BUILD SUCCEEDED|LANDFALL_NATIVE_LEASE_PERFORMANCE|measured \[/.test(line),
        )
        .join("\n"),
    );
    // Quiet xcodebuild may emit no success text; archive the structured result
    // on successful runs as well as failures instead of relying on that output.
    executionStage = "ARCHIVE_XCTEST_SUMMARY";
    const testSummary = await labTool("xcrun", [
      "xcresulttool",
      "get",
      "test-results",
      "summary",
      "--path",
      resultPath,
    ]);
    await writeFile(path.join(destination, "native-test-summary.json"), testSummary);
    const nativeTests = JSON.parse(testSummary);
    // Export the first bundle before the independent Motion test so a later
    // failure preserves actual XXXL screenshots as well as the raw xcresult.
    await labTool("xcrun", [
      "xcresulttool",
      "export",
      "attachments",
      "--path",
      resultPath,
      "--output-path",
      path.join(destination, "test-attachments"),
    ]);
    if (presentationRequired) {
      // Settings navigation and the readable XXXL shell are separate checks.
      // Operate the real Reduce Motion switch at normal text size, retaining
      // the first bundle's actual XXXL portrait/landscape proof independently.
      executionStage = "CONFIGURE_OWNED_SETTINGS_TEXT";
      await labTool("xcrun", ["simctl", "ui", id, "content_size", "large"]);
      const settingsContentSize = (await labTool("xcrun", ["simctl", "ui", id, "content_size"])).trim().toLowerCase();
      if (settingsContentSize !== "large") throw new Error("LANDFALL_APPLE_SETTINGS_TEXT_UNOBSERVED");
      await writeFile(
        path.join(destination, "settings-environment.json"),
        JSON.stringify({ sourceClass: "ACTUAL_OWNED_SIMULATOR_SETTINGS", contentSize: "LARGE" }, null, 2),
      );
      resultPath = path.join(destination, "ReducedMotionTests.xcresult");
      executionStage = "NATIVE_REDUCED_MOTION_XCTEST";
      await labTool(
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
          resultPath,
          "CODE_SIGNING_ALLOWED=YES",
          "CODE_SIGN_IDENTITY=-",
          "LANDFALL_LAB_PRESENTATION=1",
          `-only-testing:${presentationTests[1]}`,
          "test",
        ],
        600000,
      );
      const motionSummary = await labTool("xcrun", [
        "xcresulttool",
        "get",
        "test-results",
        "summary",
        "--path",
        resultPath,
      ]);
      await writeFile(path.join(destination, "reduced-motion-test-summary.json"), motionSummary);
      const motionTests = JSON.parse(motionSummary);
      if (
        nativeTests.passedTests !== 18 ||
        nativeTests.failedTests !== 0 ||
        motionTests.passedTests !== 1 ||
        motionTests.failedTests !== 0 ||
        motionTests.skippedTests !== 0
      )
        throw new Error("LANDFALL_APPLE_PRESENTATION_COMPONENT_TESTS_REQUIRED");
      nativeTests.passedTests += motionTests.passedTests;
      nativeTests.failedTests += motionTests.failedTests;
      nativeTests.skippedTests += motionTests.skippedTests;
      nativeTests.totalTestCount += motionTests.totalTestCount;
      nativeTests.finishTime = motionTests.finishTime;
      // Per-device and per-plan breakdowns belong to their original bundle;
      // retaining the first breakdown here would misstate aggregate counts.
      delete nativeTests.devicesAndConfigurations;
      delete nativeTests.testResults;
      delete nativeTests.statistics;
      delete nativeTests.topInsights;
      nativeTests.componentSummaries = ["native-test-summary.json", "reduced-motion-test-summary.json"];
    }
    await writeFile(path.join(destination, "test-summary.json"), JSON.stringify(nativeTests, null, 2));
    // The only expected package-build skip is the canonical scenario driver,
    // which requires its separately started endpoint. The companion-only job
    // excludes exactly two presentation tests; their independent closure job
    // still requires all19 passes and cannot be substituted by this receipt.
    if (
      ![nativeTests.failedTests, nativeTests.passedTests, nativeTests.skippedTests].every(Number.isInteger) ||
      nativeTests.failedTests !== 0 ||
      nativeTests.passedTests < (presentationRequired ? 19 : 17) ||
      nativeTests.skippedTests < 0 ||
      nativeTests.skippedTests > 1
    )
      throw new Error(
        presentationRequired ? "LANDFALL_APPLE_PRESENTATION_TESTS_REQUIRED" : "LANDFALL_APPLE_COMPANION_TESTS_REQUIRED",
      );
    executionStage = "EXPORT_XCTEST_ATTACHMENTS";
    // Keep native capability values inspectable on the harvesting host. The
    // passing assertion alone cannot establish the Simulator's NI capability.
    await writeFile(
      path.join(destination, "attachment-export-help.txt"),
      await labTool("xcrun", ["xcresulttool", "help", "export", "attachments"]),
    );
    if (presentationRequired)
      await labTool("xcrun", [
        "xcresulttool",
        "export",
        "attachments",
        "--path",
        resultPath,
        "--output-path",
        path.join(destination, "reduced-motion-attachments"),
      ]);
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
    const hasResult = await stat(resultPath).then(
      () => true,
      () => false,
    );
    const summary = hasResult
      ? await labTool("xcrun", ["xcresulttool", "get", "test-results", "summary", "--path", resultPath]).catch(
          () => "XCRESULT_SUMMARY_UNAVAILABLE",
        )
      : "XCRESULT_NOT_CREATED";
    if (hasResult) {
      // Failed UI runs need their actual settings/screenshots too. Preserve
      // raw xcresult and the original failure if export itself is unavailable.
      await labTool(
        "xcrun",
        [
          "xcresulttool",
          "export",
          "attachments",
          "--path",
          resultPath,
          "--output-path",
          path.join(
            destination,
            resultPath.endsWith("ReducedMotionTests.xcresult") ? "reduced-motion-attachments" : "test-attachments",
          ),
        ],
        120000,
      ).catch(async () => {
        await writeFile(
          path.join(destination, "attachment-export-state.json"),
          JSON.stringify({ state: "UNAVAILABLE" }),
        );
      });
    }
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

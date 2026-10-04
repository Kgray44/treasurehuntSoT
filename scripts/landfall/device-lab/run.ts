import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { landfallDeviceScenario, landfallDeviceScenarios } from "../../../src/landfall/device-lab/scenarios";
import { LandfallProviderScenarioExecutor } from "../../../src/landfall/device-lab/provider-executor";
import {
  validateDeviceLabFidelity,
  type DeviceLabReceipt,
  type DeviceLabTarget,
} from "../../../src/landfall/device-lab/scenario";
import { discoverDeviceLabHost } from "./host";
import { deviceLabSourceIdentity } from "./source";
import { executeLandfallOsScenario } from "./os-executor";
import { executeLandfallAndroidRadioScenario } from "./android-radio";
import { startDeviceLabAuthority } from "./authority-client";
import { deviceLabProfileSchema, deviceLabConfigurationSchema } from "../../../src/landfall/device-lab/device-profile";

async function main() {
  const argv = process.argv.slice(2);
  const allowed = new Set(["--platform", "--scenario", "--capabilities", "--profile"]);
  const options: Record<string, string> = {};
  for (let index = 0; index < argv.length; index++) {
    const key = argv[index];
    if (!allowed.has(key)) throw new Error("LANDFALL_LAB_ARGUMENT_INVALID");
    if (key === "--capabilities") options.capabilities = "true";
    else {
      const value = argv[++index];
      if (!value || value.startsWith("--")) throw new Error("LANDFALL_LAB_ARGUMENT_INVALID");
      options[key.slice(2)] = value;
    }
  }
  const root = process.cwd();
  const targets: Record<string, DeviceLabTarget> = {
    provider: "provider-simulation",
    android: "android-emulator",
    ios: "ios-simulator",
    "real-android": "real-android",
    "real-ios": "real-ios",
    field: "field",
  };
  const target: DeviceLabTarget = targets[options.platform ?? "provider"] ?? "provider-simulation";
  if (
    options.platform &&
    !["provider", "android", "ios", "real-android", "real-ios", "field"].includes(options.platform)
  )
    throw new Error("LANDFALL_LAB_PLATFORM_INVALID");
  const profile = deviceLabProfileSchema.parse(options.profile ?? process.env.LANDFALL_LAB_PROFILE ?? "primary-phone");
  const runId = `${new Date().toISOString().replaceAll(/[^0-9TZ]/g, "")}-${process.pid}`;
  const destination = path.join(root, "artifacts", "landfall-device-lab", runId);
  await mkdir(destination, { recursive: true });
  const host = await discoverDeviceLabHost();
  await writeFile(path.join(destination, "capabilities.json"), `${JSON.stringify(host, null, 2)}\n`);
  if (options.capabilities) {
    process.stdout.write(`${JSON.stringify(host, null, 2)}\n`);
    process.exit(0);
  }
  const scenarios =
    options.scenario && options.scenario !== "all"
      ? options.scenario.split(",").map((id) => landfallDeviceScenario(id))
      : landfallDeviceScenarios().filter((scenario) => scenario.targets.includes(target));
  const { sourceSha, sourceTree, dirty, sourceFingerprint } = await deviceLabSourceIdentity();
  const receipts: DeviceLabReceipt[] = [];
  for (const scenario of scenarios) {
    const startedAt = new Date().toISOString();
    const authority =
      target === "provider-simulation" &&
      scenario.targets.includes(target) &&
      scenario.canonicalAuthority === "ONE_VOYAGE"
        ? await startDeviceLabAuthority(path.join(destination, scenario.id, "authority"), scenario.worldspace)
        : null;
    const executor = new LandfallProviderScenarioExecutor(scenario, authority ?? undefined);
    const supported =
      scenario.targets.includes(target) &&
      (target === "provider-simulation" || scenario.deviceProfiles.includes(profile));
    const nativeConfigured =
      target === "android-emulator"
        ? Boolean(host.android.adb && (process.env.LANDFALL_LAB_ANDROID_SERIAL || host.hosted))
        : target === "ios-simulator"
          ? host.apple.configured
          : false;
    const result = !supported
      ? null
      : target === "provider-simulation"
        ? await executor.run()
        : (target === "android-emulator" || target === "ios-simulator") && nativeConfigured
          ? target === "android-emulator" &&
            (scenario.id === "uwb-native-peer-session" || scenario.id.startsWith("ble-native-"))
            ? await executeLandfallAndroidRadioScenario(scenario, path.join(destination, scenario.id), profile)
            : await executeLandfallOsScenario(scenario, target, path.join(destination, scenario.id), profile)
          : null;
    const authorityClean = authority ? await authority.cleanup() : true;
    if (result && !authorityClean) {
      result.cleanup.result = "FAIL";
      result.cleanup.remainingResources.push("one-voyage-authority");
    }
    const state = result
      ? result.cleanup.result === "FAIL" || result.steps.some((step) => step.state === "FAIL")
        ? "FAIL"
        : result.steps.some((step) => step.state === "UNSUPPORTED")
          ? "UNSUPPORTED"
          : "PASS"
      : supported
        ? "NOT_CONFIGURED"
        : "UNSUPPORTED";
    const receipt: DeviceLabReceipt = {
      version: 1,
      scenarioId: scenario.id,
      scenarioVersion: scenario.version,
      seed: scenario.seed,
      sourceSha,
      sourceTree,
      sourceFingerprint,
      dirty,
      target,
      hostPlatform: host.hostPlatform,
      environment:
        target === "provider-simulation"
          ? "logical-provider-adapters"
          : nativeConfigured
            ? "native-platform-and-origin-bound-webview"
            : "unconfigured-native-backend",
      deviceProfile: target === "provider-simulation" ? "synthetic-provider-profile" : profile,
      ...(result && "deviceConfiguration" in result && result.deviceConfiguration
        ? { deviceConfiguration: deviceLabConfigurationSchema.parse(result.deviceConfiguration) }
        : {}),
      osVersion:
        result && "osVersion" in result && typeof result.osVersion === "string" ? result.osVersion : host.osVersion,
      runtimeVersion:
        result && "runtimeVersion" in result && typeof result.runtimeVersion === "string"
          ? result.runtimeVersion
          : host.nodeVersion,
      providerVersions: Object.fromEntries(scenario.providers.map((family) => [family, "landfall-contract-v1"])),
      publishedFixture: scenario.publishedFixture,
      fixtureHash: executor.fixtureHash(),
      timing: target === "provider-simulation" ? scenario.timing : "WALL_CLOCK",
      toleranceMs: target === "provider-simulation" ? scenario.toleranceMs : Math.max(2000, scenario.toleranceMs),
      startedAt,
      endedAt: new Date().toISOString(),
      evidenceClass:
        state === "PASS"
          ? target === "android-emulator"
            ? "EMULATOR_PROVEN"
            : target === "ios-simulator"
              ? "SIMULATOR_PROVEN"
              : "PROVIDER_SIMULATION_PROVEN"
          : state === "NOT_CONFIGURED"
            ? "NOT_CONFIGURED"
            : state === "FAIL"
              ? "EXECUTION_FAILED"
              : "UNSUPPORTED_IN_CURRENT_LAB",
      result: state,
      steps:
        result?.steps ??
        scenario.timeline.map((step, index) => ({
          index,
          action: step.action.type,
          state: "UNSUPPORTED" as const,
          reason: supported ? "NATIVE_BACKEND_NOT_CONFIGURED" : "SCENARIO_TARGET_OR_PROFILE_UNSUPPORTED",
        })),
      canonicalProgressionEvents: result?.canonicalProgressionEvents ?? null,
      ...(result?.canonicalProgressionEvents !== null && result?.canonicalProgressionEvents !== undefined
        ? {
            canonicalAuthority: "ONE_VOYAGE_REAL_SQLITE" as const,
            authorityFixtureHash:
              authority?.fixtureHash ??
              (result && "authorityFixtureHash" in result && typeof result.authorityFixtureHash === "string"
                ? result.authorityFixtureHash
                : undefined),
          }
        : {}),
      artifacts: result && "artifacts" in result && Array.isArray(result.artifacts) ? result.artifacts : [],
      externalRequirements: [
        ...scenario.physicalRequired.map((requirement) => `REAL_DEVICE_REQUIRED:${requirement}`),
        ...(state === "NOT_CONFIGURED"
          ? [
              target === "ios-simulator" && !host.apple.configured
                ? "HOSTED_MACOS_XCODE_REQUIRED"
                : target === "android-emulator" && !host.android.emulator
                  ? "ANDROID_SDK_EMULATOR_REQUIRED"
                  : "NATIVE_EXECUTION_BACKEND_REQUIRED",
            ]
          : []),
      ],
      cleanup: result?.cleanup ?? { result: "PASS", ownedResources: [], remainingResources: [] },
    };
    validateDeviceLabFidelity(receipt);
    await writeFile(path.join(destination, `${scenario.id}.json`), `${JSON.stringify(receipt, null, 2)}\n`);
    receipts.push(receipt);
  }
  const summary = {
    version: 1,
    sourceSha,
    sourceTree,
    sourceFingerprint,
    dirty,
    target,
    total: receipts.length,
    passed: receipts.filter((receipt) => receipt.result === "PASS").length,
    failed: receipts.filter((receipt) => receipt.result === "FAIL").length,
    unsupported: receipts.filter((receipt) => receipt.result === "UNSUPPORTED").length,
    notConfigured: receipts.filter((receipt) => receipt.result === "NOT_CONFIGURED").length,
    artifactDirectory: destination,
  };
  await writeFile(path.join(destination, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  process.exitCode = summary.failed ? 1 : summary.unsupported || summary.notConfigured ? 2 : 0;
}
void main().catch(() => {
  process.stderr.write("LANDFALL_LAB_RUN_FAILED\n");
  process.exitCode = 1;
});

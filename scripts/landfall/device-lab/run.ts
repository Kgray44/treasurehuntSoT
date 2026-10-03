import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { landfallDeviceScenario, landfallDeviceScenarios } from "../../../src/landfall/device-lab/scenarios";
import { LandfallProviderScenarioExecutor } from "../../../src/landfall/device-lab/provider-executor";
import {
  validateDeviceLabFidelity,
  type DeviceLabReceipt,
  type DeviceLabTarget,
} from "../../../src/landfall/device-lab/scenario";
import { discoverDeviceLabHost, labTool } from "./host";
import { executeLandfallOsScenario } from "./os-executor";
import { startDeviceLabAuthority } from "./authority-client";

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
      : landfallDeviceScenarios();
  const sourceSha = (await labTool("git", ["rev-parse", "HEAD"])).trim();
  const sourceTree = (await labTool("git", ["rev-parse", "HEAD^{tree}"])).trim();
  const dirty = Boolean((await labTool("git", ["status", "--porcelain"])).trim());
  const sourceFiles = (
    await labTool("git", [
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      "src",
      "scripts/landfall/device-lab",
      "native",
      "package-lock.json",
      "package.json",
      "prisma/schema.sqlite.prisma",
      "prisma/migrations",
      "public/landfall-offline-sw.js",
      ".agents/landfall-device-lab-hosted.yml",
    ])
  )
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .sort();
  const fingerprint = createHash("sha256");
  for (const file of sourceFiles) {
    fingerprint.update(file);
    fingerprint.update("\0");
    fingerprint.update(await readFile(path.join(root, file)));
    fingerprint.update("\0");
  }
  const sourceFingerprint = fingerprint.digest("hex");
  const receipts: DeviceLabReceipt[] = [];
  for (const scenario of scenarios) {
    const startedAt = new Date().toISOString();
    const authority =
      target === "provider-simulation" && scenario.canonicalAuthority === "ONE_VOYAGE"
        ? await startDeviceLabAuthority(path.join(destination, scenario.id, "authority"))
        : null;
    const executor = new LandfallProviderScenarioExecutor(scenario, authority ?? undefined);
    const supported = scenario.targets.includes(target);
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
          ? await executeLandfallOsScenario(scenario, target, path.join(destination, scenario.id))
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
      : "NOT_CONFIGURED";
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
      deviceProfile:
        options.profile ?? (target === "provider-simulation" ? "synthetic-provider-profile" : "primary-phone"),
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
            : "UNSUPPORTED_IN_CURRENT_LAB",
      result: state,
      steps:
        result?.steps ??
        scenario.timeline.map((step, index) => ({
          index,
          action: step.action.type,
          state: "UNSUPPORTED" as const,
          reason: "NATIVE_BACKEND_NOT_CONFIGURED",
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

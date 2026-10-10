// @sounding-line-registration owner=sounding-line suite=unit.device-lab contracts=device-lab.shared-infrastructure
import { describe, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";
import { loadDeviceLabRegistry, deviceLabTierForTarget } from "./registry";
import { DeviceLabScenarioPacks, type DeviceLabAdapter, type DeviceLabExecution } from "./scenario-pack";
import { runDeviceLabScenario, type DeviceLabRunContext } from "./runner";
import { projectLandfallDeviceLabReceipt } from "./landfall-compatibility";
import { deviceLabProfileSchema as sharedProfile, validateDeviceLabProfile as sharedValidate } from "./device-profile";
import {
  deviceLabProfileSchema as legacyProfile,
  validateDeviceLabProfile as legacyValidate,
} from "@/landfall/device-lab/device-profile";
import { validateDeviceLabFidelity as legacyFidelity } from "@/landfall/device-lab/scenario";
import { validateDeviceLabFidelity, type DeviceLabReceipt } from "./receipt";
import { labTool as sharedTool } from "../../scripts/device-lab/host";
import { labTool as legacyTool } from "../../scripts/landfall/device-lab/host";
import { deviceLabSourceIdentity as sharedSource } from "../../scripts/device-lab/source";
import { deviceLabSourceIdentity as legacySource } from "../../scripts/landfall/device-lab/source";

const definition: DeviceLabExecution = {
  scenarioId: "core.permission-denied",
  version: 1,
  owner: "SOUNDING_LINE",
  description: "Runner contract fixture; does not implement permission brokerage.",
  tiers: ["D0"],
  preferredProfiles: ["synthetic"],
  fixtures: ["runner-contract-v1"],
  protectedContracts: ["fixture-assertion"],
  expectedArtifacts: [],
  timeoutMs: 100,
  soundingLineTests: ["src/device-lab/device-lab.test.ts"],
  requiredFutureGates: ["REAL_DEVICE_REQUIRED"],
};
const context: DeviceLabRunContext = {
  source: { sourceSha: "a".repeat(40), sourceTree: "b".repeat(40), sourceFingerprint: "c".repeat(64), dirty: false },
  baseSha: "d".repeat(40),
  tier: "D0",
  profile: "synthetic",
  hostOs: "test",
  runtimeVersion: "test",
  capabilitySnapshot: ["device.permission-state"],
};
function adapter(): DeviceLabAdapter {
  return {
    execute: vi.fn(async () => ({
      assertions: [{ id: "fixture-assertion", state: "PASS" as const }],
      unsupportedCapabilities: [],
      artifacts: [],
    })),
    cleanup: vi.fn(async () => ({ result: "PASS" as const, ownedResources: [], remainingResources: [] })),
  };
}
function pack(subject: DeviceLabAdapter, input = definition) {
  const packs = new DeviceLabScenarioPacks(loadDeviceLabRegistry());
  packs.register({ owner: "SOUNDING_LINE", scenarios: [{ definition: input, createAdapter: () => subject }] });
  return packs;
}
describe("shared Device Lab registry and packs", () => {
  it("loads all 36 baseline scenarios and six canonical tier descriptions without claiming execution", () => {
    const registry = loadDeviceLabRegistry();
    expect(registry.scenarios).toHaveLength(36);
    expect(Object.keys(registry.tierVocabulary)).toEqual(["D0", "D1", "D2", "D3", "D4", "D5"]);
    const packs = new DeviceLabScenarioPacks(registry);
    expect(packs.status().every((entry) => entry.state === "REGISTRY_BASELINE_ONLY")).toBe(true);
    expect(() => packs.resolve("sextant.magnetic-hidden-object")).toThrow("DEVICE_LAB_NOT_IMPLEMENTED");
  });
  it("rejects duplicate IDs, unknown capabilities, owner spoofing, invalid tiers, executable configuration and fake implementation", () => {
    const mutations = [
      (r: ReturnType<typeof loadDeviceLabRegistry>) => {
        r.scenarios.push(r.scenarios[0]);
      },
      (r: ReturnType<typeof loadDeviceLabRegistry>) => {
        r.scenarios[0].requiredCapabilities = ["device.imaginary"];
      },
      (r: ReturnType<typeof loadDeviceLabRegistry>) => {
        r.scenarios[0].owner = "PARALLAX";
      },
      (r: ReturnType<typeof loadDeviceLabRegistry>) => {
        r.scenarios[0].minimumTier = "D5";
      },
    ];
    for (const mutate of mutations) {
      const registry = loadDeviceLabRegistry();
      mutate(registry);
      expect(() => loadDeviceLabRegistry(registry)).toThrow();
    }
    expect(() => loadDeviceLabRegistry({ ...loadDeviceLabRegistry(), command: "shell" })).toThrow();
    const fake = loadDeviceLabRegistry();
    expect(() => loadDeviceLabRegistry({ ...fake, implementationClaim: "COMPLETE" })).toThrow();
  });
  it("registers project packs atomically, validates version/tier/owner and protects definitions from mutation", () => {
    const subject = adapter();
    const packs = pack(subject);
    expect(() =>
      packs.register({ owner: "SOUNDING_LINE", scenarios: [{ definition, createAdapter: () => subject }] }),
    ).toThrow("DUPLICATE");
    const fresh = new DeviceLabScenarioPacks(loadDeviceLabRegistry());
    expect(() =>
      fresh.register({
        owner: "SOUNDING_LINE",
        scenarios: [
          { definition, createAdapter: () => subject },
          { definition: { ...definition, scenarioId: "missing.case" }, createAdapter: () => subject },
        ],
      }),
    ).toThrow("MISMATCH");
    expect(fresh.status().every((entry) => entry.state === "REGISTRY_BASELINE_ONLY")).toBe(true);
    for (const changed of [
      { ...definition, version: 2 },
      { ...definition, owner: "SEXTANT" },
      { ...definition, tiers: ["D5" as const] },
    ])
      expect(() => pack(subject, changed)).toThrow();
    packs.resolve(definition.scenarioId).definition.tiers.push("D5");
    expect(packs.resolve(definition.scenarioId).definition.tiers).toEqual(["D0"]);
  });
  it("maps execution targets to tiers without promoting simulation", () => {
    expect(deviceLabTierForTarget("provider-simulation")).toBe("D0");
    expect(deviceLabTierForTarget("browser-emulation")).toBe("D1");
    expect(deviceLabTierForTarget("ios-simulator")).toBe("D3");
    expect(deviceLabTierForTarget("real-ios")).toBe("D4");
    expect(() => deviceLabTierForTarget("toString")).toThrow();
  });
});
describe("shared Device Lab execution and fidelity", () => {
  it("binds exact source/scenario and preserves declared future gates after a D0 pass", async () => {
    const subject = adapter();
    const receipt = await runDeviceLabScenario(pack(subject), definition.scenarioId, context);
    expect(receipt.passFailDisposition).toBe("PASS");
    expect(receipt.evidenceClass).toBe("PROVIDER_SIMULATION_PROVEN");
    expect(receipt.source).toEqual(context.source);
    expect(receipt.scenarioFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(receipt.requiredFutureGates).toEqual(["REAL_DEVICE_REQUIRED"]);
    expect(subject.cleanup).toHaveBeenCalledOnce();
  });
  it("refuses unsupported tiers, profiles, missing capability, unbound source before allocating resources", async () => {
    const subject = adapter();
    const packs = pack(subject);
    for (const changed of [
      { ...context, tier: "D4" as const },
      { ...context, profile: "physical" },
      { ...context, capabilitySnapshot: [] },
    ]) {
      const receipt = await runDeviceLabScenario(packs, definition.scenarioId, changed);
      expect(receipt.passFailDisposition).toBe("UNSUPPORTED");
      expect(receipt.evidenceClass).toBe("UNSUPPORTED_IN_CURRENT_LAB");
    }
    await expect(
      runDeviceLabScenario(packs, definition.scenarioId, {
        ...context,
        source: { ...context.source, sourceSha: "unbound" },
      }),
    ).rejects.toThrow();
    expect(subject.execute).not.toHaveBeenCalled();
    expect(subject.cleanup).not.toHaveBeenCalled();
  });
  it("always cleans after failure and refuses empty, missing, duplicate or failed assertions", async () => {
    for (const assertions of [
      [],
      [{ id: "unrelated", state: "PASS" as const }],
      [{ id: "fixture-assertion", state: "FAIL" as const }],
      [
        { id: "fixture-assertion", state: "PASS" as const },
        { id: "fixture-assertion", state: "PASS" as const },
      ],
    ]) {
      const subject = adapter();
      subject.execute = vi.fn(async () => ({ assertions, unsupportedCapabilities: [], artifacts: [] }));
      expect((await runDeviceLabScenario(pack(subject), definition.scenarioId, context)).passFailDisposition).toBe(
        "FAIL",
      );
      expect(subject.cleanup).toHaveBeenCalledOnce();
    }
    const subject = adapter();
    subject.execute = vi.fn(async () => {
      throw new Error("HOST_UNAVAILABLE");
    });
    expect((await runDeviceLabScenario(pack(subject), definition.scenarioId, context)).failureClassification).toBe(
      "EXECUTION_OR_RESULT_INVALID",
    );
    expect(subject.cleanup).toHaveBeenCalledOnce();
  });
  it("aborts timeout, cleans and cannot attest success with a live executor or failed cleanup", async () => {
    const subject = adapter();
    subject.execute = vi.fn(
      async ({ signal }) =>
        new Promise<never>((_, reject) =>
          signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true }),
        ),
    );
    const receipt = await runDeviceLabScenario(
      pack(subject, { ...definition, timeoutMs: 10 }),
      definition.scenarioId,
      context,
    );
    expect(receipt.passFailDisposition).toBe("FAIL");
    expect(receipt.failureClassification).toBe("TIMEOUT");
    expect(subject.cleanup).toHaveBeenCalledOnce();
    const failed = adapter();
    failed.cleanup = vi.fn(async () => ({
      result: "PASS" as const,
      ownedResources: ["owned"],
      remainingResources: ["owned"],
    }));
    expect((await runDeviceLabScenario(pack(failed), definition.scenarioId, context)).failureClassification).toBe(
      "CLEANUP_FAILURE",
    );
  });
});
describe("Landfall compatibility preserves historical contracts", () => {
  it("keeps old profile, receipt, host and source APIs as identical exports", () => {
    expect(legacyProfile).toBe(sharedProfile);
    expect(legacyValidate).toBe(sharedValidate);
    expect(legacyFidelity).toBe(validateDeviceLabFidelity);
    expect(legacyTool).toBe(sharedTool);
    expect(legacySource).toBe(sharedSource);
  });
  it("projects accepted historical receipts without modifying IDs, bytes or evidence classes", () => {
    const receipt: DeviceLabReceipt = {
      version: 1,
      scenarioId: "gps-perfect-walk",
      scenarioVersion: 2,
      seed: 1,
      ...context.source,
      target: "provider-simulation",
      hostPlatform: "linux",
      environment: "synthetic",
      deviceProfile: "synthetic",
      osVersion: "test",
      runtimeVersion: "test",
      providerVersions: {},
      publishedFixture: "landfall-device-lab-v1",
      fixtureHash: "e".repeat(64),
      timing: "LOGICAL",
      toleranceMs: 0,
      startedAt: "test",
      endedAt: "test",
      evidenceClass: "PROVIDER_SIMULATION_PROVEN",
      result: "PASS",
      steps: [{ index: 0, action: "ASSERT", state: "PASS" }],
      canonicalProgressionEvents: null,
      artifacts: [],
      externalRequirements: ["REAL_DEVICE_REQUIRED:GPS_MULTIPATH"],
      cleanup: { result: "PASS", ownedResources: [], remainingResources: [] },
    };
    const bytes = JSON.stringify(receipt);
    const projected = projectLandfallDeviceLabReceipt(receipt);
    expect(JSON.stringify(receipt)).toBe(bytes);
    expect(JSON.stringify(projected.original)).toBe(bytes);
    expect(projected.scenarioId).toBe("landfall.gps-perfect-walk");
    expect(projected.tier).toBe("D0");
    expect(() => projectLandfallDeviceLabReceipt({ ...receipt, evidenceClass: "REAL_DEVICE_PROVEN" })).toThrow(
      "FIDELITY_INVALID",
    );
  });
  it("binds future receipts to changes in shared scripts and governing registry bytes", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "device-lab-source-"));
    const execute = promisify(execFile);
    const invoke = (command: string, args: string[]) => execute(command, args, { cwd: directory });
    try {
      for (const folder of ["src", "scripts/device-lab", "Development_Docs/Spatial_Experience"])
        await mkdir(path.join(directory, folder), { recursive: true });
      const script = path.join(directory, "scripts/device-lab/input.ts");
      const registry = path.join(directory, "Development_Docs/Spatial_Experience/input.json");
      await writeFile(script, "export const fixture = 1;\n");
      await writeFile(registry, "{}\n");
      await invoke("git", ["init", "-q"]);
      await invoke("git", ["add", "."]);
      await invoke("git", [
        "-c",
        "user.name=Device Lab Fixture",
        "-c",
        "user.email=fixture@example.invalid",
        "commit",
        "-qm",
        "fixture",
      ]);
      const moduleUrl = pathToFileURL(path.resolve("scripts/device-lab/source.ts")).href;
      const code = `const module = await import(${JSON.stringify(moduleUrl)}); console.log(JSON.stringify(await (module.deviceLabSourceIdentity ?? module.default.deviceLabSourceIdentity)()));`;
      const identity = async () =>
        JSON.parse(
          (
            await invoke(process.execPath, [
              "--import",
              path.resolve("node_modules/tsx/dist/loader.mjs"),
              "--input-type=module",
              "--eval",
              code,
            ])
          ).stdout,
        );
      const first = await identity();
      await writeFile(script, "export const fixture = 2;\n");
      const second = await identity();
      await writeFile(registry, '{"version":2}\n');
      const third = await identity();
      expect(first.dirty).toBe(false);
      expect(second.dirty).toBe(true);
      expect(first.sourceSha).toBe(third.sourceSha);
      expect(new Set([first.sourceFingerprint, second.sourceFingerprint, third.sourceFingerprint]).size).toBe(3);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

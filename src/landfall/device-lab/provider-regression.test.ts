import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { landfallDeviceScenarios } from "@/landfall/device-lab/scenarios";
import { validateDeviceLabFidelity, type DeviceLabReceipt } from "@/landfall/device-lab/scenario";
// @sounding-line-registration owner=project-landfall suite=unit.landfall-device-lab contracts=landfall.device-lab-evidence

describe("Sounding Line consumes canonical Device Lab provider evidence", () => {
  it("runs the full provider corpus and verifies source-bound receipts, real authority and cleanup", async () => {
    const { stdout } = await promisify(execFile)(
      process.execPath,
      ["--import", "tsx", "scripts/landfall/device-lab/run.ts", "--platform", "provider"],
      {
        cwd: process.cwd(),
        windowsHide: true,
        timeout: 170_000,
        maxBuffer: 1024 * 1024,
        env: { ...process.env, DATABASE_URL: "file:UNBOUND_DEVICE_LAB" },
      },
    );
    const summary = JSON.parse(stdout);
    const owned = path.resolve(process.cwd(), "artifacts", "landfall-device-lab");
    const relative = path.relative(owned, summary.artifactDirectory);
    expect(relative).not.toMatch(/^\.\./);
    expect(path.isAbsolute(relative)).toBe(false);
    expect(summary.failed).toBe(0);
    const providerScenarios = landfallDeviceScenarios().filter((scenario) =>
      scenario.targets.includes("provider-simulation"),
    );
    expect(summary.passed).toBe(providerScenarios.length);
    expect(summary.total).toBe(providerScenarios.length);
    expect(summary.notConfigured).toBe(0);
    for (const scenario of providerScenarios) {
      const receipt: DeviceLabReceipt = JSON.parse(
        await readFile(path.join(summary.artifactDirectory, `${scenario.id}.json`), "utf8"),
      );
      validateDeviceLabFidelity(receipt);
      expect(receipt.sourceSha).toBe(summary.sourceSha);
      expect(receipt.sourceTree).toBe(summary.sourceTree);
      expect(receipt.sourceFingerprint).toBe(summary.sourceFingerprint);
      expect(receipt.scenarioVersion).toBe(scenario.version);
      expect(receipt.result).toBe("PASS");
      expect(receipt.evidenceClass).toBe("PROVIDER_SIMULATION_PROVEN");
      expect(receipt.cleanup).toMatchObject({ result: "PASS", remainingResources: [] });
      expect(receipt.externalRequirements).toEqual(
        scenario.physicalRequired.map((requirement) => `REAL_DEVICE_REQUIRED:${requirement}`),
      );
      expect(receipt.canonicalProgressionEvents).toBe(
        scenario.canonicalAuthority === "ONE_VOYAGE"
          ? ["uwb-native-peer-session", "device-reboot", "qr-native-camera-valid"].includes(scenario.id) ||
            scenario.id.startsWith("ble-native-")
            ? 0
            : 1
          : null,
      );
      if (scenario.canonicalAuthority === "ONE_VOYAGE")
        expect(receipt.canonicalAuthority).toBe("ONE_VOYAGE_REAL_SQLITE");
    }
  }, 180_000);

  it("reports an explicitly requested OS-only case as unsupported without promoting provider simulation", async () => {
    const { stdout } = await promisify(execFile)(
      process.execPath,
      [
        "--import",
        "tsx",
        "scripts/landfall/device-lab/run.ts",
        "--platform",
        "provider",
        "--scenario",
        "geofence-native-background-wake",
      ],
      {
        cwd: process.cwd(),
        windowsHide: true,
        timeout: 30000,
        env: { ...process.env, DATABASE_URL: "file:UNBOUND_DEVICE_LAB" },
      },
    ).catch((error) => {
      if (error.code !== 2 || typeof error.stdout !== "string") throw error;
      return { stdout: error.stdout };
    });
    const summary = JSON.parse(stdout);
    expect(summary).toMatchObject({ total: 1, passed: 0, failed: 0, unsupported: 1, notConfigured: 0 });
    const receipt: DeviceLabReceipt = JSON.parse(
      await readFile(path.join(summary.artifactDirectory, "geofence-native-background-wake.json"), "utf8"),
    );
    validateDeviceLabFidelity(receipt);
    expect(receipt).toMatchObject({
      result: "UNSUPPORTED",
      evidenceClass: "UNSUPPORTED_IN_CURRENT_LAB",
      canonicalProgressionEvents: null,
      cleanup: { result: "PASS", ownedResources: [], remainingResources: [] },
    });
    expect(
      receipt.steps.every(
        (step) => step.state === "UNSUPPORTED" && step.reason === "SCENARIO_TARGET_OR_PROFILE_UNSUPPORTED",
      ),
    ).toBe(true);
    expect(receipt.externalRequirements).not.toContain("NATIVE_EXECUTION_BACKEND_REQUIRED");
  }, 40000);

  it.each(process.platform === "win32" ? (["disconnect"] as const) : (["disconnect", "terminate"] as const))(
    "removes the owned authority database after caller %s without a cleanup request",
    async (operation) => {
      const destination = path.resolve(process.cwd(), "artifacts", "landfall-device-lab", `disconnect-${randomUUID()}`);
      const child = spawn(
        process.execPath,
        ["--import", "tsx", "scripts/landfall/device-lab/one-voyage.ts", "--worker", destination, "PHYSICAL"],
        {
          cwd: process.cwd(),
          windowsHide: true,
          stdio: ["ignore", "ignore", "ignore", "ipc"],
          env: { ...process.env, DATABASE_URL: "file:UNBOUND_DEVICE_LAB" },
        },
      );
      try {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error("OWNED_AUTHORITY_START_TIMEOUT")), 30_000);
          child.once("error", reject);
          child.on("message", (message: unknown) => {
            if ((message as { ready?: boolean }).ready) {
              clearTimeout(timer);
              resolve();
            }
          });
        });
        const exited = new Promise<number | null>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error("OWNED_AUTHORITY_EXIT_TIMEOUT")), 10_000);
          child.once("exit", (code) => {
            clearTimeout(timer);
            resolve(code);
          });
        });
        if (operation === "disconnect") child.disconnect();
        else child.kill("SIGTERM");
        expect(await exited).toBe(0);
        for (const suffix of ["", "-wal", "-shm", "-journal"])
          expect(
            await stat(path.join(destination, `one-voyage.db${suffix}`)).then(
              () => true,
              () => false,
            ),
          ).toBe(false);
        expect(JSON.parse(await readFile(path.join(destination, "worker-cleanup.json"), "utf8"))).toEqual({
          result: "PASS",
          remainingResources: [],
        });
      } finally {
        if (child.connected) child.disconnect();
        if (child.exitCode === null && child.signalCode === null) child.kill();
      }
    },
    40_000,
  );
});

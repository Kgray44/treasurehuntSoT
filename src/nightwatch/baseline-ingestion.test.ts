import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { BosunLedger, type BaselineCertificationReceipt } from "./bosun";
import { NightwatchController, type NightwatchControlPlane } from "./controller";
import { defaultNightwatchDatabase, NightwatchLedger, resolveNightwatchDatabase } from "./runtime";

const protectedMain = {
  sha: "c83abb35b9e4f133a82014489200da1e31773df4",
  treeSha: "1205a89e14573cd6c08e435c3a39ab8e9c2d1d5b",
};
const ownerFailure = {
  checkId: "deepwater-policy-identity",
  fingerprint: "BASELINE_DEEPWATER_POLICY_IDENTITY_474d3eaed23d7f31",
  repairability: "OWNER",
  detail: "DEEPWATER_POLICY_IDENTITY_STALE",
  dependencies: ["Deepwater/source-policy identity"],
};
const receipt = (): BaselineCertificationReceipt => {
  const auto = {
    checkId: "active-test-registry",
    fingerprint: "BASELINE_ACTIVE_TEST_REGISTRY_0000000000000001",
    repairability: "AUTO_0",
    detail: "ACTIVE_TEST_REGISTRY_STALE",
    dependencies: ["generated active registry"],
  };
  const external = {
    checkId: "shared-runtime",
    fingerprint: "BASELINE_SHARED_RUNTIME_0000000000000001",
    repairability: "EXTERNAL",
    detail: "SHARED_RUNTIME_UNAVAILABLE",
    dependencies: ["deterministic shared runtime/dependency prerequisites"],
  };
  const unknown = {
    checkId: "future-governance-contract",
    fingerprint: "BASELINE_FUTURE_CONTRACT_0000000000000001",
    repairability: "FUTURE_CLASS",
    detail: "FUTURE_CONTRACT_UNSUPPORTED",
    dependencies: ["future owner"],
  };
  const failures = [auto, ownerFailure, external, unknown];
  return {
    kind: "BASELINE_CERTIFICATION",
    certificationId: `baseline:${protectedMain.sha}:${protectedMain.treeSha}:fixture`,
    certifiedAt: "2026-08-22T00:00:00.000Z",
    status: "OWNER_REQUIRED",
    protectedMain,
    checks: [
      { id: auto.checkId },
      { id: ownerFailure.checkId },
      { id: external.checkId },
      { id: unknown.checkId },
    ],
    failures,
    deterministicClosureDependencies: [],
    autoZeroRepairable: [auto.fingerprint],
    nonAutoZeroBlockers: [ownerFailure, external, unknown],
  };
};

const databasePath = () => join(mkdtempSync(join(tmpdir(), "nightwatch-baseline-ingestion-")), "nightwatch.sqlite");
const control = (delivery: ReturnType<typeof receipt>): NightwatchControlPlane => ({
  currentIdentity: () => ({
    candidateSha: "a".repeat(40), candidateTreeSha: "b".repeat(40), baseSha: "c".repeat(40), baseTreeSha: "d".repeat(40), candidateRef: "refs/heads/codex/unused",
  }),
  preflight: () => ({ deterministicRegistryHealthy: true, ownershipResolved: true, identityStable: true, leaseAvailable: true }),
  dispatchAuthority: () => ({ runId: "unused" }),
  dispatchBinding: () => ({ runId: "unused" }),
  observeRun: () => "PENDING",
  requestMerge: () => null,
  protectedMain: () => protectedMain,
  baselineReceipt: () => ({ protectedMain, receipt: delivery }),
});

describe("Baseline Certification receipt to Bosun producer", () => {
  it("materializes every disposition once and preserves the exact Deepwater authorization", () => {
    const path = databasePath();
    const ledger = new NightwatchLedger(path);
    const bosun = new BosunLedger(path, ledger);
    try {
      const result = bosun.ingestBaselineReceipt({ receipt: receipt(), protectedMain, at: "2026-08-22T00:00:00.000Z" });
      expect(result.findings).toHaveLength(4);
      expect(result.findings.find((entry) => entry.baselineFingerprint === ownerFailure.fingerprint)).toMatchObject({
        state: "OWNER_REQUIRED",
        requiredAuthorization: "OWNER-AUTHORIZED:DEEPWATER_POLICY_IDENTITY_REBASELINE",
      });
      expect(result.findings.map((entry) => entry.state).sort()).toEqual([
        "ESCALATION_REQUIRED",
        "EXTERNAL_BLOCKED",
        "OBJECTIVE_READY",
        "OWNER_REQUIRED",
      ]);
      expect(new Set(result.findings.map((entry) => entry.cascadeId)).size).toBe(4);
      expect(new Set(result.findings.map((entry) => entry.objectiveId)).size).toBe(4);
    } finally {
      bosun.close();
      ledger.close();
    }
  });

  it("reuses the same durable cascade and objective after controller restart and duplicate delivery", () => {
    const path = databasePath();
    const firstLedger = new NightwatchLedger(path);
    const first = new NightwatchController(firstLedger, control(receipt()), {
      instanceId: "nightwatchd-baseline-first",
      now: () => Date.parse("2026-08-22T00:00:00.000Z"),
    });
    first.start();
    first.stop();
    firstLedger.close();

    const restartedLedger = new NightwatchLedger(path);
    const second = new NightwatchController(restartedLedger, control(receipt()), {
      instanceId: "nightwatchd-baseline-second",
      now: () => Date.parse("2026-08-22T00:01:00.000Z"),
    });
    second.start();
    const projection = second.bosunProjection(Date.parse("2026-08-22T00:01:00.000Z"));
    const deepwater = projection.cascades.find((entry) => entry.objective?.requiredAuthorization === "OWNER-AUTHORIZED:DEEPWATER_POLICY_IDENTITY_REBASELINE");
    expect(deepwater).toBeTruthy();
    const duplicate = new BosunLedger(path, restartedLedger);
    try {
      const result = duplicate.ingestBaselineReceipt({ receipt: receipt(), protectedMain, at: "2026-08-22T00:01:01.000Z" });
      const replay = result.findings.find((entry) => entry.baselineFingerprint === ownerFailure.fingerprint)!;
      expect(result.duplicate).toBe(true);
      expect(replay.cascadeId).toBe(deepwater!.id);
      expect(replay.objectiveId).toBe(deepwater!.objective!.id);
      expect(duplicate.projection(Date.parse("2026-08-22T00:01:01.000Z")).cascades).toHaveLength(4);
    } finally {
      duplicate.close();
      second.stop();
      restartedLedger.close();
    }
  });
});

describe("Nightwatch durable ledger resolution", () => {
  it("uses a machine-scoped default and preserves an explicit override", () => {
    const stateHome = join(tmpdir(), "nightwatch-state-home");
    const environment = { LOCALAPPDATA: stateHome } as unknown as NodeJS.ProcessEnv;
    expect(defaultNightwatchDatabase("C:\\first-worktree", environment)).toBe(
      join(stateHome, "ForeverTreasureCompanion", "Nightwatch", "treasurehuntSoT", "nightwatch.sqlite"),
    );
    expect(resolveNightwatchDatabase("C:\\second-worktree", { ...environment, NIGHTWATCH_DB_PATH: "custom-ledger.sqlite" })).toBe(
      resolve("custom-ledger.sqlite"),
    );
  });

  it("resolves the lifecycle default before health access and honors an explicit path", () => {
    if (process.platform !== "win32") {
      expect(process.platform).not.toBe("win32");
      return;
    }
    const stateHome = mkdtempSync(join(tmpdir(), "nightwatch-lifecycle-state-"));
    const lifecycle = resolve(process.cwd(), "scripts", "nightwatch", "nightwatch-lifecycle.ps1");
    const run = (environment: NodeJS.ProcessEnv) => JSON.parse(
      execFileSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", lifecycle, "-Action", "resolve"], {
        cwd: process.cwd(),
        env: environment,
        encoding: "utf8",
        windowsHide: true,
      }),
    ) as { DatabasePath: string };
    const common = { ...process.env, LOCALAPPDATA: stateHome, NIGHTWATCH_DB_PATH: "" } as NodeJS.ProcessEnv;
    expect(run(common).DatabasePath).toBe(defaultNightwatchDatabase(process.cwd(), common));
    const explicit = join(stateHome, "explicit.sqlite");
    expect(run({ ...common, NIGHTWATCH_DB_PATH: explicit }).DatabasePath).toBe(resolve(explicit));
  });
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  certifyBaseline,
  createDeepwaterPolicyIdentityCheck,
  createDeepwaterProjectionCheck,
  normalizeFeatureCatalogProjection,
} from "../../scripts/nightwatch/baseline-certifier.mjs";

const sha = (character) => character.repeat(40);
const digest = (character) => character.repeat(64);
const deepwaterConfigPath = "Development_Docs/Programs/Deepwater/deepwater-phase5-config.json";
const deepwaterProjectionPaths = [
  "Development_Docs/Programs/Deepwater/deepwater-phase-status.json",
  "Development_Docs/Programs/Deepwater/reports/Project_Deepwater_Phase_5_Governance_Report.md",
];

const certifyDeepwater = ({
  storedPolicyDigest,
  currentPolicyDigest,
  projectionDrift = false,
  additionalChecks = [],
}) => {
  let generatorRan = false;
  const checks = [
    createDeepwaterPolicyIdentityCheck(async () => currentPolicyDigest),
    createDeepwaterProjectionCheck("node"),
    ...additionalChecks,
  ];
  return certifyBaseline({
    mainSha: sha("a"),
    mainTreeSha: sha("b"),
    checks,
    readText: async (relative) => {
      if (relative === deepwaterConfigPath) return JSON.stringify({ soundingLinePolicyDigest: storedPolicyDigest });
      if (deepwaterProjectionPaths.includes(relative)) return `generated:${relative}`;
      throw new Error(`UNEXPECTED_READ:${relative}`);
    },
    execute: async (command, args) => {
      if (command === "node" && args.join(" ") === "scripts/deepwater/cli.mjs audit") {
        generatorRan = true;
        return { stdout: "", stderr: "" };
      }
      if (command === "git" && args[0] === "diff") {
        const isExpectedPathQuery = args.some((value) => deepwaterProjectionPaths.includes(value));
        if (projectionDrift && generatorRan) return { stdout: `${deepwaterProjectionPaths.join("\n")}\n`, stderr: "" };
        if (isExpectedPathQuery) return { stdout: "", stderr: "" };
        return { stdout: "", stderr: "" };
      }
      throw new Error(`UNEXPECTED_COMMAND:${command}:${args.join(" ")}`);
    },
  });
};

test("Baseline Certification collects every failure and separates AUTO_0 from owner blockers", async () => {
  const invoked = [];
  const record = await certifyBaseline({
    mainSha: sha("a"),
    mainTreeSha: sha("b"),
    now: "2026-08-21T20:00:00.000Z",
    checks: [
      {
        id: "registry",
        repairability: "AUTO_0",
        dependencies: ["active registry"],
        inspect: async () => {
          invoked.push("registry");
          throw new Error("drift");
        },
      },
      {
        id: "ownership",
        repairability: "OWNER",
        dependencies: ["ownership mapping"],
        inspect: async () => {
          invoked.push("ownership");
          throw new Error("missing disposition");
        },
      },
      {
        id: "policy",
        repairability: "OWNER",
        dependencies: ["policy"],
        inspect: async () => {
          invoked.push("policy");
          return { valid: true };
        },
      },
    ],
  });
  assert.deepEqual(invoked, ["registry", "ownership", "policy"]);
  assert.equal(record.status, "OWNER_REQUIRED");
  assert.equal(record.failures.length, 2);
  assert.equal(record.autoZeroRepairable.length, 1);
  assert.deepEqual(record.deterministicClosureDependencies, ["active registry", "ownership mapping"]);
});

test("Baseline Certification is exact-main/tree bound and becomes certified only when every check passes", async () => {
  const checks = [
    { id: "inventory", repairability: "AUTO_0", dependencies: [], inspect: async () => ({ complete: true }) },
  ];
  const first = await certifyBaseline({
    mainSha: sha("c"),
    mainTreeSha: sha("d"),
    checks,
    now: "2026-08-21T20:00:00.000Z",
  });
  const second = await certifyBaseline({
    mainSha: sha("c"),
    mainTreeSha: sha("e"),
    checks,
    now: "2026-08-21T20:00:00.000Z",
  });
  assert.equal(first.status, "CERTIFIED");
  assert.notEqual(first.certificationId, second.certificationId);
  assert.equal(first.protectedMain.treeSha, sha("d"));
});

test("Deepwater stale policy identity is owner-required, never AUTO_0, and does not suppress later failures", async () => {
  const record = await certifyDeepwater({
    storedPolicyDigest: digest("c"),
    currentPolicyDigest: digest("d"),
    additionalChecks: [
      {
        id: "later-auto-zero",
        repairability: "AUTO_0",
        dependencies: ["later deterministic prerequisite"],
        inspect: async () => {
          throw new Error("later drift");
        },
      },
    ],
  });
  assert.equal(record.status, "OWNER_REQUIRED");
  assert.deepEqual(
    record.failures.map((failure) => failure.checkId),
    ["deepwater-policy-identity", "later-auto-zero"],
  );
  assert.equal(record.autoZeroRepairable.length, 1);
  assert.equal(
    record.failures.find((failure) => failure.checkId === "deepwater-policy-identity")?.repairability,
    "OWNER",
  );
  assert.equal(
    record.checks.find((check) => check.id === "deepwater-projection")?.detail.skipped,
    "DEEPWATER_POLICY_IDENTITY_INVALID",
  );
});

test("Deepwater projection drift is AUTO_0 only after current policy identity passes", async () => {
  const currentPolicyDigest = digest("e");
  const record = await certifyDeepwater({
    storedPolicyDigest: currentPolicyDigest,
    currentPolicyDigest,
    projectionDrift: true,
  });
  assert.equal(record.status, "REPAIR_REQUIRED");
  assert.deepEqual(
    record.failures.map((failure) => failure.checkId),
    ["deepwater-projection"],
  );
  assert.equal(record.autoZeroRepairable.length, 1);
  assert.equal(record.failures[0].repairability, "AUTO_0");
});

test("Deepwater current policy identity with a clean projection passes Baseline Certification", async () => {
  const currentPolicyDigest = digest("f");
  const record = await certifyDeepwater({ storedPolicyDigest: currentPolicyDigest, currentPolicyDigest });
  assert.equal(record.status, "CERTIFIED");
  assert.deepEqual(record.failures, []);
});

test("Feature Catalog comparison ignores only merge-created provenance while retaining its projection", () => {
  const first =
    "Audited source commit: `aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`\nfeature body\nGeneration source commit: `aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`\n";
  const second =
    "Audited source commit: `bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb`\nfeature body\nGeneration source commit: `bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb`\n";
  const changedBody = second.replace("feature body", "different body");
  assert.equal(normalizeFeatureCatalogProjection(first), normalizeFeatureCatalogProjection(second));
  assert.notEqual(normalizeFeatureCatalogProjection(first), normalizeFeatureCatalogProjection(changedBody));
});

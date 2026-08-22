#!/usr/bin/env node
/*
 * Deterministic shared-main preflight.  This is deliberately separate from
 * Sounding Line candidate authority: it finds repository control-plane debt
 * before a candidate can consume an authoritative qualification attempt.
 */
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { promisify } from "node:util";

import { computeSoundingLinePolicyDigest } from "../deepwater/phase5.mjs";
import { assertRepairRouteCompleteness } from "../sounding-line/control-plane-repair-routes.mjs";

const execFileAsync = promisify(execFile);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const canonicalize = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`)
      .join(",")}}`;
  return JSON.stringify(value);
};
const stable = (value) => JSON.parse(canonicalize(value));
const output = (value) => process.stdout.write(`${JSON.stringify(stable(value), null, 2)}\n`);
const normalizedError = (error) =>
  String(error instanceof Error ? error.message : error)
    .replace(/\s+/gu, " ")
    .trim();
const fingerprint = (check, detail) =>
  `BASELINE_${check.id.toUpperCase().replace(/[^A-Z0-9]+/gu, "_")}_${sha256(detail).slice(0, 16)}`;
export const normalizeFeatureCatalogProjection = (text) =>
  text
    .replace(/^Audited source commit: `[0-9a-f]{40}`$/mu, "Audited source commit: `<catalog-source>`")
    .replace(/^Generation source commit: `[0-9a-f]{40}`$/mu, "Generation source commit: `<catalog-source>`");

export const baselineCheckInventory = Object.freeze([
  {
    id: "sounding-line-inventory",
    repairability: "AUTO_0",
    dependencies: ["inventory/disposition mapping", "governed test registration"],
  },
  {
    id: "sounding-line-policy",
    repairability: "OWNER",
    dependencies: ["maintenance policy integrity", "workflow admission"],
  },
  {
    id: "p34-retirement-ledger",
    repairability: "AUTO_0",
    dependencies: ["P34 canonical identities", "retirement ledger"],
  },
  { id: "active-test-registry", repairability: "AUTO_0", dependencies: ["generated active registry"] },
  {
    id: "document-index",
    repairability: "AUTO_0",
    dependencies: ["Ledgerlight documentation migration records", "documentation index"],
  },
  { id: "feature-catalog", repairability: "AUTO_0", dependencies: ["Feature Catalog projection"] },
  { id: "deepwater-policy-identity", repairability: "OWNER", dependencies: ["Deepwater/source-policy identity"] },
  { id: "deepwater-projection", repairability: "AUTO_0", dependencies: ["generated Deepwater policy projection"] },
  { id: "migration-inventory", repairability: "OWNER", dependencies: ["migration inventory"] },
  { id: "protected-binding-route", repairability: "OWNER", dependencies: ["protected binding route availability"] },
  {
    id: "shared-runtime",
    repairability: "EXTERNAL",
    dependencies: ["deterministic shared runtime/dependency prerequisites"],
  },
]);

const defaultExecute = async (command, args, cwd) => {
  const result = await execFileAsync(command, args, { cwd, windowsHide: true, maxBuffer: 20 * 1024 * 1024 });
  return { stdout: result.stdout, stderr: result.stderr };
};

const parseJson = (text, label) => {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label}_JSON_INVALID`);
  }
};

const commandCheck = (id, repairability, dependencies, command, args, verify = () => undefined) => ({
  id,
  repairability,
  dependencies,
  async inspect(context) {
    const result = await context.execute(command, args, context.root);
    return verify(result, context);
  },
});

const generatorCheck = (id, repairability, dependencies, command, args, expectedPaths) => ({
  id,
  repairability,
  dependencies,
  async inspect(context) {
    const changedPaths = async () =>
      (await context.execute("git", ["diff", "--name-only", "--"], context.root)).stdout
        .split(/\r?\n/gu)
        .filter(Boolean)
        .sort();
    const run = async () => {
      const before = await changedPaths();
      await context.execute(command, args, context.root);
      const changed = (
        await context.execute("git", ["diff", "--name-only", "--", ...expectedPaths], context.root)
      ).stdout
        .split(/\r?\n/gu)
        .filter(Boolean)
        .sort();
      const after = await changedPaths();
      const beforeSet = new Set(before);
      const outside = after.filter((path) => !beforeSet.has(path) && !expectedPaths.includes(path));
      const output = await Promise.all(
        expectedPaths.map(async (path) => {
          try {
            return { path, content: await context.readText(path) };
          } catch {
            return { path, content: null };
          }
        }),
      );
      return { changed, outside, output };
    };
    const first = await run();
    const second = await run();
    if (
      canonicalize({ changed: first.changed, output: first.output }) !==
      canonicalize({ changed: second.changed, output: second.output })
    )
      throw new Error("GENERATOR_NONDETERMINISTIC");
    if (first.outside.length || second.outside.length)
      throw new Error(`GENERATOR_SCOPE_ESCAPE:${[...first.outside, ...second.outside].sort().join(",")}`);
    if (first.changed.some((path) => !expectedPaths.includes(path))) throw new Error("GENERATOR_EXPECTED_PATH_ESCAPE");
    if (first.changed.length) throw new Error(`GENERATED_DRIFT:${first.changed.join(",")}`);
    return { deterministic: true, expectedPaths };
  },
});

const deepwaterPhase5ConfigPath = "Development_Docs/Programs/Deepwater/deepwater-phase5-config.json";
const deepwaterProjectionPaths = [
  "Development_Docs/Programs/Deepwater/deepwater-phase-status.json",
  "Development_Docs/Programs/Deepwater/reports/Project_Deepwater_Phase_5_Governance_Report.md",
];

export const createDeepwaterPolicyIdentityCheck = (computePolicyDigest = computeSoundingLinePolicyDigest) => ({
  id: "deepwater-policy-identity",
  repairability: "OWNER",
  dependencies: ["Deepwater/source-policy identity"],
  async inspect(context) {
    const config = parseJson(await context.readText(deepwaterPhase5ConfigPath), "DEEPWATER_PHASE5_CONFIG");
    const storedPolicyDigest = config.soundingLinePolicyDigest;
    const currentPolicyDigest = await computePolicyDigest(context.root);
    const valid = /^[0-9a-f]{64}$/u.test(storedPolicyDigest ?? "") && storedPolicyDigest === currentPolicyDigest;
    context.deepwaterPolicyIdentity = { valid, storedPolicyDigest, currentPolicyDigest };
    if (!valid)
      throw new Error(
        `DEEPWATER_POLICY_IDENTITY_STALE:stored=${storedPolicyDigest ?? "missing"}:current=${currentPolicyDigest}`,
      );
    return { storedPolicyDigest, currentPolicyDigest };
  },
});

export const createDeepwaterProjectionCheck = (node) => {
  const projection = generatorCheck(
    "deepwater-projection",
    "AUTO_0",
    ["generated Deepwater policy projection"],
    node,
    ["scripts/deepwater/cli.mjs", "audit"],
    deepwaterProjectionPaths,
  );
  return {
    ...projection,
    async inspect(context) {
      if (context.deepwaterPolicyIdentity?.valid !== true) return { skipped: "DEEPWATER_POLICY_IDENTITY_INVALID" };
      return projection.inspect(context);
    },
  };
};

/* The catalog is rendered on a candidate against its protected base. A later
 * protected merge necessarily has a different SHA, so validate the complete
 * deterministic projection with its two provenance fields normalized, then
 * require their shared recorded SHA to be a real ancestor of the checked main. */
const featureCatalogCheck = (node) => ({
  id: "feature-catalog",
  repairability: "AUTO_0",
  dependencies: ["Feature Catalog projection"],
  async inspect(context) {
    const catalogPath = "Development_Docs/Features/FEATURE_CATALOG.md";
    const original = await context.readText(catalogPath);
    const provenance = [
      ...original.matchAll(/^(?:Audited source commit|Generation source commit): `([0-9a-f]{40})`$/gmu),
    ].map((match) => match[1]);
    if (provenance.length !== 2 || provenance[0] !== provenance[1])
      throw new Error("FEATURE_CATALOG_PROVENANCE_INVALID");
    try {
      await context.execute(
        node,
        ["node_modules/tsx/dist/cli.mjs", "scripts/features/build-feature-catalog.ts"],
        context.root,
      );
      const first = await context.readText(catalogPath);
      await context.execute(
        node,
        ["node_modules/tsx/dist/cli.mjs", "scripts/features/build-feature-catalog.ts"],
        context.root,
      );
      const second = await context.readText(catalogPath);
      if (normalizeFeatureCatalogProjection(first) !== normalizeFeatureCatalogProjection(second))
        throw new Error("GENERATOR_NONDETERMINISTIC");
      if (normalizeFeatureCatalogProjection(original) !== normalizeFeatureCatalogProjection(first))
        throw new Error("GENERATED_DRIFT:Development_Docs/Features/FEATURE_CATALOG.md");
      await context.execute("git", ["merge-base", "--is-ancestor", provenance[0], context.mainSha], context.root);
      return { deterministic: true, expectedPaths: [catalogPath], catalogSourceSha: provenance[0] };
    } finally {
      await context.writeText(catalogPath, original);
    }
  },
});

const defaultChecks = (node) => [
  commandCheck(
    "sounding-line-inventory",
    "AUTO_0",
    ["inventory/disposition mapping", "governed test registration"],
    node,
    ["scripts/sounding-line/cli.mjs", "inventory", "--completeness"],
    ({ stdout }) => {
      const inventory = parseJson(stdout, "SOUNDING_LINE_INVENTORY");
      if (
        inventory.completeness?.criticalUnknownCount !== 0 ||
        !String(inventory.completeness?.status ?? "").startsWith("COMPLETE")
      )
        throw new Error("INVENTORY_INCOMPLETE");
      return { completeness: inventory.completeness };
    },
  ),
  commandCheck(
    "sounding-line-policy",
    "OWNER",
    ["maintenance policy integrity", "workflow admission"],
    node,
    ["scripts/sounding-line/cli.mjs", "validate-policy"],
    ({ stdout }) => {
      const policy = parseJson(stdout, "SOUNDING_LINE_POLICY");
      if (!policy.ok) throw new Error("POLICY_INVALID");
      return { policyDigest: policy.policyDigest, counts: policy.counts };
    },
  ),
  generatorCheck(
    "p34-retirement-ledger",
    "AUTO_0",
    ["P34 canonical identities", "retirement ledger"],
    node,
    ["scripts/sounding-line/reconcile-p34-ledger.mjs"],
    [
      "testing/generated/p34-retirement-ledger.json",
      "Development_Docs/Programs/Sounding_Line/Project_Sounding_Line_P34_Semantic_Retirement_Ledger.csv",
      "Development_Docs/Programs/Sounding_Line/Project_Sounding_Line_P34_Retirement_Ledger.csv",
    ],
  ),
  generatorCheck(
    "active-test-registry",
    "AUTO_0",
    ["generated active registry"],
    node,
    ["scripts/sounding-line/test-registry.mjs"],
    ["testing/generated/active-test-registry.json"],
  ),
  generatorCheck(
    "document-index",
    "AUTO_0",
    ["Ledgerlight documentation migration records", "documentation index"],
    node,
    ["scripts/generate-document-index.mjs"],
    ["Development_Docs/document-index.json", "Development_Docs/Project_Ledgerlight_Documentation_Migration_Matrix.csv"],
  ),
  featureCatalogCheck(node),
  createDeepwaterPolicyIdentityCheck(),
  createDeepwaterProjectionCheck(node),
  {
    id: "migration-inventory",
    repairability: "OWNER",
    dependencies: ["migration inventory"],
    async inspect(context) {
      const migrations = (
        await context.execute("git", ["ls-files", "prisma/mysql-migrations", "prisma/migrations"], context.root)
      ).stdout
        .split(/\r?\n/gu)
        .filter(Boolean)
        .sort();
      if (!migrations.length) throw new Error("MIGRATION_INVENTORY_EMPTY");
      return { count: migrations.length, digest: sha256(migrations.join("\n")) };
    },
  },
  {
    id: "protected-binding-route",
    repairability: "OWNER",
    dependencies: ["protected binding route availability"],
    async inspect(context) {
      const workflow = await context.readText(".github/workflows/sounding-line-protected-binding-dispatch.yml");
      const authority = await context.readText(".github/workflows/sounding-line-authoritative.yml");
      const baseline = await context.readText(".github/workflows/nightwatch-baseline-certification.yml");
      if (
        !workflow.includes("workflow_dispatch") ||
        !authority.includes("baseline_run_id") ||
        !baseline.includes("nightwatch-baseline-certification")
      )
        throw new Error("PROTECTED_BINDING_OR_BASELINE_ROUTE_UNAVAILABLE");
      return { route: "exact-candidate-base-and-baseline-receipt" };
    },
  },
  {
    id: "control-plane-repair-routes",
    repairability: "OWNER",
    dependencies: ["governed repair route for every protected integration prerequisite"],
    async inspect(context) {
      const inventory = await assertRepairRouteCompleteness(context.root);
      return {
        prerequisiteCount: inventory.prerequisiteCount,
        repairRouteCount: inventory.repairRouteCount,
        classifications: [...new Set(inventory.paths.map((entry) => entry.classification))].sort(),
      };
    },
  },
  {
    id: "shared-runtime",
    repairability: "EXTERNAL",
    dependencies: ["deterministic shared runtime/dependency prerequisites"],
    async inspect(context) {
      const packageJson = parseJson(await context.readText("package.json"), "PACKAGE_JSON");
      const lock = await context.readText("package-lock.json");
      const major = Number(String(context.nodeVersion).replace(/^v/u, "").split(".")[0]);
      if (!Number.isInteger(major) || major < 22 || !packageJson.packageManager || !lock)
        throw new Error("RUNTIME_PREREQUISITE_INVALID");
      return { nodeMajor: major, packageManager: packageJson.packageManager, lockDigest: sha256(lock) };
    },
  },
];

export async function certifyBaseline(options = {}) {
  const root = resolve(options.root ?? process.cwd());
  const execute = options.execute ?? defaultExecute;
  const readText = options.readText ?? ((relative) => readFile(resolve(root, relative), "utf8"));
  const mainSha = options.mainSha ?? (await execute("git", ["rev-parse", "HEAD"], root)).stdout.trim();
  const mainTreeSha = options.mainTreeSha ?? (await execute("git", ["rev-parse", "HEAD^{tree}"], root)).stdout.trim();
  if (!/^[0-9a-f]{40}$/u.test(mainSha) || !/^[0-9a-f]{40}$/u.test(mainTreeSha))
    throw new Error("BASELINE_PROTECTED_MAIN_IDENTITY_INVALID");
  const checks = options.checks ?? defaultChecks(options.nodeExecutable ?? process.execPath);
  const writeText = options.writeText ?? ((relative, value) => writeFile(resolve(root, relative), value));
  const context = { root, execute, readText, writeText, mainSha, nodeVersion: options.nodeVersion ?? process.version };
  const performed = [];
  const failures = [];
  for (const check of checks) {
    try {
      performed.push({
        id: check.id,
        status: "PASSED",
        repairability: check.repairability,
        dependencies: check.dependencies,
        detail: await check.inspect(context),
      });
    } catch (error) {
      const detail = normalizedError(error);
      const failure = {
        checkId: check.id,
        fingerprint: fingerprint(check, detail),
        repairability: check.repairability,
        detail,
        dependencies: check.dependencies,
      };
      performed.push({
        id: check.id,
        status: "FAILED",
        repairability: check.repairability,
        dependencies: check.dependencies,
        detail,
      });
      failures.push(failure);
    }
  }
  const classes = new Set(failures.map((failure) => failure.repairability));
  const status = !failures.length
    ? "CERTIFIED"
    : classes.has("EXTERNAL")
      ? "EXTERNAL_BLOCKED"
      : classes.has("OWNER")
        ? "OWNER_REQUIRED"
        : "REPAIR_REQUIRED";
  const deterministicClosureDependencies = [...new Set(failures.flatMap((failure) => failure.dependencies))].sort();
  const recordCore = {
    schemaVersion: "1.0",
    protectedMain: { sha: mainSha, treeSha: mainTreeSha },
    checks: performed,
    failures,
    status,
    deterministicClosureDependencies,
  };
  return {
    kind: "BASELINE_CERTIFICATION",
    certificationId: `baseline:${mainSha}:${mainTreeSha}:${sha256(canonicalize(recordCore)).slice(0, 20)}`,
    certifiedAt: options.now ?? new Date().toISOString(),
    ...recordCore,
    autoZeroRepairable: failures
      .filter((failure) => failure.repairability === "AUTO_0")
      .map((failure) => failure.fingerprint),
    nonAutoZeroBlockers: failures.filter((failure) => failure.repairability !== "AUTO_0"),
  };
}

const args = process.argv.slice(2);
const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
if (process.argv[1]?.endsWith("baseline-certifier.mjs")) {
  const receiptPath = option("--receipt-out");
  const record = await certifyBaseline({
    mainSha: option("--protected-main-sha"),
    mainTreeSha: option("--protected-main-tree"),
    now: option("--certified-at"),
  });
  if (receiptPath) await writeFile(resolve(process.cwd(), receiptPath), `${JSON.stringify(stable(record), null, 2)}\n`);
  output(record);
  if (record.status !== "CERTIFIED") process.exitCode = 1;
}

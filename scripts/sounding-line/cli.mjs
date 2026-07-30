#!/usr/bin/env node
/*
 * Project Sounding Line policy, inventory, deterministic planning, and the
 * entry point for Phase 2's separately allowlisted local adapters.
 */
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import * as runtime from "./runtime.mjs";
import * as phase3 from "./phase3.mjs";
import { resolveAdapter, resolvePlaywrightAdapter, resolveVitestAdapter } from "./adapters.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const policyRoot = path.join(repoRoot, "testing");
const ignoredDirectories = new Set([".git", "node_modules", ".next", "artifacts", "coverage"]);
const secretPattern = /(?:api[_-]?key|access[_-]?token|auth[_-]?token|password|secret|private[_-]?key|credential)/iu;
const registryFiles = [
  "ownership.json",
  "contracts.json",
  "resources.json",
  "suites.json",
  "impact-map.json",
  "release-gates.json",
  "quarantine.json",
  "validation-debt.json",
  "file-dispositions.json",
];

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
const fail = (message) => {
  process.stderr.write(`SOUNDING_LINE_ERROR ${message}\n`);
  process.exitCode = 1;
};

async function loadPolicy() {
  const manifest = JSON.parse(await readFile(path.join(policyRoot, "policy-manifest.json"), "utf8"));
  const policy = { manifest };
  for (const file of registryFiles)
    policy[file.replace(/\.json$/u, "")] = JSON.parse(await readFile(path.join(policyRoot, file), "utf8"));
  policy.digest = sha256(canonicalize(policy));
  return policy;
}

function isSafePath(value) {
  return (
    typeof value === "string" &&
    !path.isAbsolute(value) &&
    !value.includes("..") &&
    !/^[a-z]:/iu.test(value) &&
    !value.includes("\\")
  );
}
function assertKeys(value, allowed, label, errors) {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) errors.push(`${label}: unknown field ${key}`);
}
function scanSensitive(value, label, errors) {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (secretPattern.test(key) && typeof child === "string" && child.length > 0)
      errors.push(`${label}: secret-like value at ${key}`);
    scanSensitive(child, `${label}.${key}`, errors);
  }
}
function validatePolicy(policy) {
  const errors = [];
  const {
    ownership,
    contracts,
    resources,
    suites,
    "impact-map": impact,
    "release-gates": gates,
    quarantine,
    "validation-debt": debt,
    manifest,
  } = policy;
  assertKeys(
    manifest,
    ["version", "status", "registries", "authority", "plannerAuthority", "phase3"],
    "manifest",
    errors,
  );
  if (!/^\d+\.\d+\.\d+$/u.test(manifest.version)) errors.push("manifest: malformed semantic version");
  for (const file of registryFiles)
    if (!manifest.registries.includes(file)) errors.push(`manifest: missing registry ${file}`);
  const ids = (items, label) => {
    const seen = new Set();
    for (const item of items) {
      if (!item.id || !/^[a-z][a-z0-9.-]*$/u.test(item.id)) errors.push(`${label}: invalid id ${item.id ?? "missing"}`);
      if (seen.has(item.id)) errors.push(`${label}: duplicate id ${item.id}`);
      seen.add(item.id);
    }
    return seen;
  };
  const ownerIds = ids(ownership.owners, "owners");
  const contractIds = ids(contracts.contracts, "contracts");
  const resourceIds = ids(resources.resources, "resources");
  const suiteIds = ids(suites.suites, "suites");
  const gateIds = ids(gates.gates, "gates");
  for (const owner of ownership.owners) {
    assertKeys(owner, ["id", "project", "sourcePaths", "testPaths", "contractIds"], `owner ${owner.id}`, errors);
    for (const value of [...owner.sourcePaths, ...owner.testPaths])
      if (!isSafePath(value)) errors.push(`owner ${owner.id}: unsafe path ${value}`);
    for (const id of owner.contractIds)
      if (!contractIds.has(id)) errors.push(`owner ${owner.id}: missing contract ${id}`);
  }
  for (const contract of contracts.contracts) {
    assertKeys(contract, ["id", "name", "authority", "owners", "critical"], `contract ${contract.id}`, errors);
    if (!ownerIds.has(contract.authority))
      errors.push(`contract ${contract.id}: missing authority ${contract.authority}`);
    for (const owner of contract.owners)
      if (!ownerIds.has(owner)) errors.push(`contract ${contract.id}: missing owner ${owner}`);
  }
  for (const suite of suites.suites) {
    assertKeys(
      suite,
      [
        "id",
        "name",
        "tier",
        "owner",
        "command",
        "estimatedDuration",
        "parallelSafe",
        "resources",
        "dependencies",
        "contracts",
        "affectedPaths",
        "releaseGates",
        "currentImplementationState",
      ],
      `suite ${suite.id}`,
      errors,
    );
    if (!ownerIds.has(suite.owner)) errors.push(`suite ${suite.id}: missing owner ${suite.owner}`);
    if (!Number.isInteger(suite.tier) || suite.tier < 0 || suite.tier > 7)
      errors.push(`suite ${suite.id}: invalid tier`);
    for (const id of suite.resources)
      if (!resourceIds.has(id)) errors.push(`suite ${suite.id}: missing resource ${id}`);
    for (const id of suite.dependencies)
      if (!suiteIds.has(id)) errors.push(`suite ${suite.id}: missing dependency ${id}`);
    for (const id of suite.contracts)
      if (!contractIds.has(id)) errors.push(`suite ${suite.id}: missing contract ${id}`);
    for (const id of suite.releaseGates) if (!gateIds.has(id)) errors.push(`suite ${suite.id}: missing gate ${id}`);
    for (const value of suite.affectedPaths)
      if (!isSafePath(value)) errors.push(`suite ${suite.id}: unsafe affected path ${value}`);
  }
  for (const gate of gates.gates) {
    assertKeys(gate, ["id", "requiredSuites", "conditionalSuites"], `gate ${gate.id}`, errors);
    for (const id of [...gate.requiredSuites, ...gate.conditionalSuites])
      if (!suiteIds.has(id)) errors.push(`gate ${gate.id}: missing producer suite ${id}`);
  }
  for (const mapping of [...impact.pathMappings, ...impact.contractMappings]) {
    for (const id of mapping.suiteIds) if (!suiteIds.has(id)) errors.push(`impact map: missing suite ${id}`);
    for (const id of mapping.contractIds ?? [mapping.contractId])
      if (id && !contractIds.has(id)) errors.push(`impact map: missing contract ${id}`);
    if (mapping.path && !isSafePath(mapping.path)) errors.push(`impact map: unsafe path ${mapping.path}`);
  }
  for (const entry of quarantine.entries) {
    for (const field of quarantine.requiredFields) if (!(field in entry)) errors.push(`quarantine: missing ${field}`);
    if (!suiteIds.has(entry.suiteId)) errors.push(`quarantine: unknown suite ${entry.suiteId}`);
  }
  for (const entry of debt.entries) {
    if (!entry.id || !ownerIds.has(entry.owner) || !entry.reason || !entry.effect)
      errors.push(`SLP1010 validation debt: invalid entry ${entry.id ?? "missing"}`);
    if (!entry.targetPhase || !entry.classification || !entry.releaseEffect || !entry.reviewTrigger)
      errors.push(`SLP1011 validation debt: incomplete closure fields ${entry.id ?? "missing"}`);
    if (
      ![
        "PHASE_1_RESOLVABLE_NOW",
        "PHASE_2_OWNED",
        "POST_HARBORLIGHT_RECONCILIATION",
        "EXTERNAL_VALIDATION",
        "LEGACY_HARNESS_RETIREMENT",
      ].includes(entry.classification)
    )
      errors.push(`SLP1012 validation debt: invalid classification ${entry.id}`);
  }
  scanSensitive(policy, "policy", errors);
  const dispositions = policy["file-dispositions"];
  for (const rule of dispositions.rules) {
    if (!suiteIds.has(rule.suiteId)) errors.push(`SLP1001 disposition: missing parent suite ${rule.suiteId}`);
    if (!ownerIds.has(rule.owner)) errors.push(`SLP1002 disposition: missing owner ${rule.owner}`);
    if (!isSafePath(rule.match)) errors.push(`SLP1003 disposition: unsafe match ${rule.match}`);
    if (
      ![
        "REGISTERED_SUITE_CHILD",
        "REGISTERED_SETUP_NODE",
        "REGISTERED_TEARDOWN_NODE",
        "REGISTERED_FIXTURE",
        "REGISTERED_ADAPTER",
        "INTENTIONALLY_EXCLUDED",
        "DISCOVERED_UNREGISTERED",
        "OBSOLETE_CANDIDATE",
        "UNKNOWN",
      ].includes(rule.role)
    )
      errors.push(`SLP1004 disposition: invalid role ${rule.role}`);
  }
  return {
    ok: errors.length === 0,
    errors,
    counts: {
      suites: suites.suites.length,
      contracts: contracts.contracts.length,
      owners: ownership.owners.length,
      resources: resources.resources.length,
      gates: gates.gates.length,
      quarantine: quarantine.entries.length,
      validationDebt: debt.entries.length,
    },
  };
}

async function walk(relative = "") {
  const directory = path.join(repoRoot, relative);
  const entries = await readdir(directory, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    const child = path.join(relative, entry.name).replace(/\\/gu, "/");
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) results.push(...(await walk(child)));
    } else if (entry.isFile()) results.push(child);
  }
  return results;
}
const globRegex = (pattern) =>
  new RegExp(
    `^${pattern
      .replace(/[.+^${}()|[\]\\]/gu, "\\$&")
      .replace(/\*\*/gu, "§")
      .replace(/\*/gu, "[^/]*")
      .replace(/§/gu, ".*")}$`,
    "u",
  );
const matches = (candidate, pattern) => globRegex(pattern).test(candidate);
function registeredForFile(file, suites) {
  return suites.filter((suite) => suite.affectedPaths.some((pattern) => matches(file, pattern)));
}

async function inventory(policy) {
  const files = await walk();
  const vitest = files.filter((file) =>
    /(?:^src\/.*\.test\.(?:ts|tsx)|^tests\/private-content\/.*\.test\.(?:ts|tsx)|^scripts\/features\/.*\.test\.ts)$/u.test(
      file,
    ),
  );
  const playwright = files.filter((file) => /^tests\/e2e\/.*\.spec\.ts$/u.test(file));
  const powershell = files.filter((file) => /^scripts\/.*\.ps1$/u.test(file));
  const hardCodedPorts = [];
  const lockFiles = [];
  const databasePaths = [];
  for (const file of files.filter((item) => /(?:\.ts|\.tsx|\.mjs|\.ps1|\.json)$/u.test(item))) {
    const content = await readFile(path.join(repoRoot, file), "utf8");
    if (/\b(?:3100|3200)\b/u.test(content)) hardCodedPorts.push(file);
    if (/validation-runtime\.lock/u.test(content)) lockFiles.push(file);
    if (/(?:dev\.db|DATABASE_URL|schema\.sqlite\.prisma)/u.test(content)) databasePaths.push(file);
  }
  const packageJson = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"));
  const discovered = [...vitest, ...playwright];
  const unregistered = discovered.filter((file) => registeredForFile(file, policy.suites.suites).length === 0);
  const duplicateExecution = discovered
    .filter((file) => registeredForFile(file, policy.suites.suites).length > 1)
    .map((file) => ({
      file,
      suiteIds: registeredForFile(file, policy.suites.suites)
        .map((suite) => suite.id)
        .sort(),
    }));
  const dispositionFor = (file) => policy["file-dispositions"].rules.find((rule) => matches(file, rule.match));
  const mapFile = (file, family) => {
    const rule = dispositionFor(file);
    if (!rule) return { path: file, family, disposition: "DISCOVERED_UNREGISTERED", errorCode: "SLP2001" };
    const suite = policy.suites.suites.find((item) => item.id === rule.suiteId);
    return {
      path: file,
      family,
      disposition: rule.role,
      parentSuiteId: rule.suiteId,
      owner: rule.owner,
      tier: rule.tier,
      adapter: rule.adapter,
      parallelSafety: rule.parallelSafety,
      contracts: suite.contracts,
      resources: suite.resources,
      executionAdapter: suite.command,
    };
  };
  const fileMappings = [
    ...vitest.map((file) => mapFile(file, "vitest")),
    ...playwright.map((file) => mapFile(file, "playwright")),
    ...powershell.map((file) => mapFile(file, "powershell")),
  ].sort((a, b) => a.path.localeCompare(b.path));
  const byFamily = Object.fromEntries(
    ["vitest", "playwright", "powershell"].map((family) => {
      const rows = fileMappings.filter((row) => row.family === family);
      const count = (value) => rows.filter((row) => row.disposition === value).length;
      return [
        family,
        {
          discovered: rows.length,
          mapped: rows.filter((row) => row.parentSuiteId).length,
          excluded: count("INTENTIONALLY_EXCLUDED"),
          unknown: count("UNKNOWN"),
          unregistered: count("DISCOVERED_UNREGISTERED"),
          reconciled:
            rows.length ===
            rows.filter(
              (row) =>
                row.parentSuiteId ||
                row.disposition === "INTENTIONALLY_EXCLUDED" ||
                row.disposition === "OBSOLETE_CANDIDATE" ||
                row.disposition === "UNKNOWN" ||
                row.disposition === "DISCOVERED_UNREGISTERED",
            ).length,
        },
      ];
    }),
  );
  const criticalUnknowns = fileMappings.filter(
    (row) => row.disposition === "UNKNOWN" || row.disposition === "DISCOVERED_UNREGISTERED",
  );
  return {
    schemaVersion: "1.0.0",
    sourceWatermark: sha256(canonicalize(files)),
    readOnly: true,
    commands: Object.keys(packageJson.scripts).sort(),
    files: { vitest, playwright, powershell },
    resources: {
      hardCodedPortFiles: hardCodedPorts.sort(),
      lockFiles: lockFiles.sort(),
      databasePathFiles: databasePaths.sort(),
    },
    reconciliation: {
      discoveredTestFiles: discovered.length,
      unregistered,
      duplicateExecution,
      registeredSuites: policy.suites.suites.map((suite) => suite.id).sort(),
    },
    fileMappings,
    completeness: {
      status: criticalUnknowns.length
        ? "INCOMPLETE"
        : policy["validation-debt"].entries.length
          ? "COMPLETE_WITH_NONCRITICAL_DEBT"
          : "COMPLETE",
      byFramework: byFamily,
      logicalSuiteCount: policy.suites.suites.length,
      suiteChildCount: fileMappings.filter((row) => row.disposition === "REGISTERED_SUITE_CHILD").length,
      criticalUnknownCount: criticalUnknowns.length,
      unresolvedMappingDefects: criticalUnknowns.map((row) => row.path),
    },
  };
}

function addWithDependencies(selected, reasons, suiteId, reason, suitesById) {
  if (!selected.has(suiteId)) selected.add(suiteId);
  if (!reasons.has(suiteId)) reasons.set(suiteId, []);
  reasons.get(suiteId).push(reason);
  for (const dependency of suitesById.get(suiteId).dependencies)
    addWithDependencies(selected, reasons, dependency, `dependency of ${suiteId}`, suitesById);
}
async function plan(policy, changedPaths, scope) {
  const suitesById = new Map(policy.suites.suites.map((suite) => [suite.id, suite]));
  const selected = new Set();
  const reasons = new Map();
  let uncertain = false;
  if (scope === "release") {
    for (const suite of policy.suites.suites)
      addWithDependencies(selected, reasons, suite.id, "release scope is comprehensive", suitesById);
  } else {
    for (const changed of changedPaths) {
      let matched = false;
      for (const mapping of policy["impact-map"].pathMappings)
        if (matches(changed, mapping.path)) {
          matched = true;
          for (const suiteId of mapping.suiteIds)
            addWithDependencies(selected, reasons, suiteId, `direct impact path ${changed}`, suitesById);
          for (const contractId of mapping.contractIds)
            for (const mappingByContract of policy["impact-map"].contractMappings.filter(
              (item) => item.contractId === contractId,
            ))
              for (const suiteId of mappingByContract.suiteIds)
                addWithDependencies(selected, reasons, suiteId, `contract expansion ${contractId}`, suitesById);
        }
      for (const owner of policy.ownership.owners)
        if (owner.sourcePaths.some((pattern) => matches(changed, pattern))) {
          matched = true;
          for (const suite of policy.suites.suites.filter((suite) => suite.owner === owner.id))
            addWithDependencies(selected, reasons, suite.id, `owner expansion ${owner.id} for ${changed}`, suitesById);
        }
      if (!matched) uncertain = true;
    }
    if (uncertain)
      for (const suite of policy.suites.suites)
        addWithDependencies(selected, reasons, suite.id, "uncertain impact broadening", suitesById);
  }
  const selectedEntries = [...selected]
    .sort()
    .map((id) => ({ suiteId: id, reasons: [...new Set(reasons.get(id))].sort() }));
  const omitted = policy.suites.suites
    .filter((suite) => !selected.has(suite.id))
    .map((suite) => ({ suiteId: suite.id, reason: "outside declared impact and no uncertainty" }))
    .sort((a, b) => a.suiteId.localeCompare(b.suiteId));
  const graph = selectedEntries.map(({ suiteId }) => ({
    suiteId,
    dependsOn: suitesById
      .get(suiteId)
      .dependencies.filter((id) => selected.has(id))
      .sort(),
  }));
  const sourceFiles = await walk();
  const result = {
    schemaVersion: "1.0.0",
    nonAuthoritative: true,
    execution: "governed-local",
    policyDigest: policy.digest,
    sourceDigest: sha256(canonicalize(sourceFiles)),
    scope,
    requestedPaths: [...new Set(changedPaths)].sort(),
    uncertaintyBroadened: uncertain,
    selected: selectedEntries,
    omitted,
    graph,
  };
  return { ...result, digest: sha256(canonicalize(result)) };
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  const policy = await loadPolicy();
  if (command === "history") {
    const operation = args[0];
    const store = await phase3.openHistory(process.env.SOUNDING_LINE_HISTORY_ROOT ?? phase3.defaultHistoryRoot());
    try {
      if (operation === "init" || operation === "migrate")
        return output({
          status: "READY",
          schemaVersion: phase3.PHASE3_SCHEMA_VERSION,
          locationPolicy: "outside-worktree",
          root: store.root,
        });
      if (operation === "status")
        return output({
          status: "READY",
          schemaVersion: phase3.PHASE3_SCHEMA_VERSION,
          integrity: store.db.prepare("PRAGMA integrity_check").get()["integrity_check"],
        });
      if (operation === "verify") return output(phase3.verifyHistory(store));
      if (operation === "export-manifest") return output(phase3.exportHistoryManifest(store));
      if (operation === "prune")
        return output(phase3.pruneHistory(store, JSON.parse(await readFile(path.resolve(repoRoot, args[1]), "utf8"))));
      if (operation === "stats") return output(phase3.historyStats(store, args[1]));
      if (operation === "entities")
        return output(phase3.listHistoricalEntities(store, args[1], { subjectId: args[2] }));
      if (operation === "ingest") {
        const receipt = JSON.parse(await readFile(path.resolve(repoRoot, args[1]), "utf8"));
        return output(await phase3.ingestReceipt(store, receipt));
      }
      throw new Error(
        "history usage: init | migrate | status | verify | export-manifest | prune <retention.json> | stats <suite-id> | entities <entity> [subject-id] | ingest <repository-relative.json>",
      );
    } finally {
      store.close();
    }
  }
  if (command === "phase3") {
    const operation = args[0];
    const phase3RuntimeRoot = process.env.SOUNDING_LINE_PHASE3_RUNTIME_ROOT ?? phase3.defaultRuntimeRoot();
    if (operation === "impact")
      return output(phase3.planImpact(JSON.parse(await readFile(path.resolve(repoRoot, args[1]), "utf8"))));
    if (operation === "impact-policy")
      return output(phase3.contractAwareImpact(JSON.parse(await readFile(path.resolve(repoRoot, args[1]), "utf8"))));
    if (operation === "freshness")
      return output(
        phase3.freshness(
          JSON.parse(await readFile(path.resolve(repoRoot, args[1]), "utf8")),
          JSON.parse(await readFile(path.resolve(repoRoot, args[2]), "utf8")),
        ),
      );
    if (operation === "rerun")
      return output(phase3.rerunPlan(JSON.parse(await readFile(path.resolve(repoRoot, args[1]), "utf8"))));
    if (operation === "runtime") {
      const action = args[1];
      if (action === "start")
        return output(
          await phase3.launchController({
            ...JSON.parse(await readFile(path.resolve(repoRoot, args[2]), "utf8")),
            root: phase3RuntimeRoot,
          }),
        );
      if (action === "find-equivalent")
        return output(
          (await phase3.findEquivalentRun({
            ...JSON.parse(await readFile(path.resolve(repoRoot, args[2]), "utf8")),
            root: phase3RuntimeRoot,
          })) ?? {
            status: "NONE",
          },
        );
      if (action === "status") return output(await phase3.readRun(args[2], phase3RuntimeRoot));
      if (action === "follow")
        return output(await phase3.followRunLog(args[2], { root: phase3RuntimeRoot, offset: Number(args[3] ?? 0) }));
      if (action === "cancel") return output(await phase3.cancelRun(args[2], phase3RuntimeRoot));
      if (action === "complete")
        return output(await phase3.completeRun(args[2], args[3] ?? "CLEAN", phase3RuntimeRoot));
      if (action === "resume")
        return output(
          await phase3.resumeRun(
            args[2],
            JSON.parse(await readFile(path.resolve(repoRoot, args[3]), "utf8")),
            phase3RuntimeRoot,
          ),
        );
      if (action === "inspect-orphans") return output(await phase3.inspectOrphans(phase3RuntimeRoot));
      if (action === "recover")
        return output(
          await phase3.recoverRun(args[2], JSON.parse(await readFile(path.resolve(repoRoot, args[3]), "utf8")), {
            root: phase3RuntimeRoot,
          }),
        );
      throw new Error(
        "phase3 runtime usage: start <run.json> | find-equivalent <run.json> | status <run-id> | follow <run-id> [offset] | cancel <run-id> | complete <run-id> [CLEAN] | resume <run-id> <identities.json> | inspect-orphans | recover <run-id> <identities.json>",
      );
    }
    if (operation === "governance" && args[1] === "validate-completion")
      return output({
        valid: phase3.validateCompletionReport(JSON.parse(await readFile(path.resolve(repoRoot, args[2]), "utf8"))),
      });
    if (operation === "governance" && ["record-flake", "record-stale", "record-slow"].includes(args[1])) {
      const store = await phase3.openHistory(process.env.SOUNDING_LINE_HISTORY_ROOT ?? phase3.defaultHistoryRoot());
      try {
        const record = JSON.parse(await readFile(path.resolve(repoRoot, args[2]), "utf8"));
        const result =
          args[1] === "record-flake"
            ? phase3.recordFlakeObservation(store, record)
            : args[1] === "record-stale"
              ? phase3.recordStaleTest(store, record)
              : phase3.recordSlowSuite(store, record);
        return output(result);
      } finally {
        store.close();
      }
    }
    throw new Error(
      "phase3 usage: impact <input.json> | impact-policy <input.json> | freshness <current.json> <evidence.json> | rerun <input.json> | governance validate-completion <report.json> | governance record-flake|record-stale|record-slow <record.json>",
    );
  }
  const argument = (name) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const runtimeBase = () =>
    argument("--runtime-base") ?? process.env.SOUNDING_LINE_RUNTIME_ROOT ?? runtime.defaultRuntimeBase();
  const loadRun = async (runId) => {
    const id = String(runId ?? "");
    if (!/^sl-[a-z0-9-]+$/u.test(id)) throw new Error("run id is unsafe");
    const root = path.join(runtimeBase(), id);
    const marker = JSON.parse(await readFile(path.join(root, "run-marker.json"), "utf8"));
    return {
      id,
      root,
      base: runtimeBase(),
      controllerToken: marker.controllerToken,
      createdAt: marker.createdAt,
      host: marker.host,
      state: "RECOVERED",
    };
  };
  if (command === "runtime") {
    const [operation, runId] = args;
    if (operation === "create") {
      const planPath = argument("--plan");
      const scopeArg = args.find((arg) => arg.startsWith("--scope="));
      const requestedPaths = args
        .slice(1)
        .filter((arg) => !arg.startsWith("--"))
        .map((item) => item.replace(/\\/gu, "/"));
      let sealedPlan;
      if (planPath) {
        if (!isSafePath(planPath)) throw new Error("runtime create requires a safe repository-relative --plan");
        sealedPlan = JSON.parse(await readFile(path.join(repoRoot, planPath), "utf8"));
      } else {
        const scope = scopeArg?.slice(8) ?? "change";
        if (!["change", "release"].includes(scope) || (scope === "change" && !requestedPaths.length))
          throw new Error("runtime create requires --plan or a valid --scope with safe paths");
        if (requestedPaths.some((item) => !isSafePath(item)))
          throw new Error("runtime create paths must be safe repository-relative paths");
        sealedPlan = await plan(policy, requestedPaths, scope);
      }
      const run = await runtime.createRuntime({
        base: runtimeBase(),
        repositoryRoot: repoRoot,
        plan: sealedPlan,
        identity: { policyDigest: policy.digest, sourceDigest: (await inventory(policy)).sourceWatermark },
      });
      await mkdir(path.join(run.root, "plans"));
      await writeFile(
        path.join(run.root, "plans", "sealed-plan.json"),
        `${JSON.stringify(sealedPlan, null, 2)}\n`,
        "utf8",
      );
      output({
        status: "CREATED",
        runId: run.id,
        root: run.root,
        planDigest: sealedPlan.digest,
        nonAuthoritative: true,
      });
      return;
    }
    if (operation === "status") {
      const run = await loadRun(runId);
      await runtime.assertRun(run);
      output({ status: run.state, runId: run.id, root: run.root, nonAuthoritative: true });
      return;
    }
    if (operation === "cleanup") {
      const run = await loadRun(runId);
      output({ ...(await runtime.cleanupRuntime(run, "operator-cleanup")), runId: run.id, nonAuthoritative: true });
      return;
    }
    if (operation === "inspect-orphans") {
      output({ status: "INSPECTED", entries: await runtime.inspectOrphans(runtimeBase()), nonAuthoritative: true });
      return;
    }
    if (operation === "run") {
      const adapterId = args[2];
      const adapterArgs = args.slice(3);
      const adapter =
        adapterId === "vitest"
          ? resolveVitestAdapter(adapterArgs)
          : adapterId === "playwright"
            ? resolvePlaywrightAdapter(adapterArgs[0], adapterArgs[1])
            : resolveAdapter(adapterId, adapterArgs);
      const run = await loadRun(runId);
      const result = await runtime.executeProductAdapter(run, adapter, { cwd: repoRoot });
      output({ adapter: adapter.id, exitCode: result.exitCode, runId: run.id, status: result.status });
      if (result.status !== "PASS") process.exitCode = result.exitCode || 1;
      return;
    }
    if (operation === "cancel") throw new Error("runtime cancel is not supported; use marker-verified cleanup");
    throw new Error(
      "runtime usage: create --plan <repository-relative.json> | status <run-id> | run <run-id> <adapter> | cleanup <run-id> | inspect-orphans",
    );
  }
  if (command === "resource") {
    if (args[0] === "list") {
      output({ resources: policy.resources.resources, nonAuthoritative: true });
      return;
    }
    if (args[0] === "leases") {
      const state = await runtime.readJson(path.join(runtimeBase(), "broker-leases.json"), { version: 1, leases: [] });
      output({ ...state, nonAuthoritative: true });
      return;
    }
    throw new Error("resource usage: list | leases");
  }
  if (command === "compatibility" && args[0] === "compare") {
    output(runtime.compatibilityFor(args[1]));
    return;
  }
  if (command === "certification" && args[0] === "report") {
    output({
      status: "CERTIFIED_FOCUSED_SUITES",
      suites: [
        "sounding-line.runtime",
        "harborlight.phase4.unit",
        "harborlight.phase4.sqlite",
        "harborlight.phase4.browser",
      ],
      legacyFullValidation: "GLOBAL_EXCLUSIVE",
      uncertifiedSuites: "GLOBAL_EXCLUSIVE_OR_SERIAL_WITHIN_FAMILY",
      emergencyMode: "EMERGENCY_SERIAL",
      nonAuthoritative: true,
    });
    return;
  }
  if (command === "validate-policy") {
    const result = validatePolicy(policy);
    output({ ...result, policyDigest: policy.digest });
    if (!result.ok) process.exitCode = 1;
    return;
  }
  if (command === "inventory") {
    const result = validatePolicy(policy);
    if (!result.ok) throw new Error(result.errors.join("; "));
    output(await inventory(policy));
    return;
  }
  if (command === "plan") {
    const scopeArg = args.find((arg) => arg.startsWith("--scope="));
    const paths = args.filter((arg) => !arg.startsWith("--")).map((item) => item.replace(/\\/gu, "/"));
    const scope = scopeArg?.slice(8) ?? "change";
    if (!["change", "release"].includes(scope)) throw new Error("--scope must be change or release");
    if (scope === "change" && paths.length === 0)
      throw new Error("plan change requires one or more repository-relative paths");
    if (paths.some((item) => !isSafePath(item))) throw new Error("plan paths must be safe repository-relative paths");
    const result = validatePolicy(policy);
    if (!result.ok) throw new Error(result.errors.join("; "));
    output(await plan(policy, paths, scope));
    return;
  }
  fail(
    "usage: node scripts/sounding-line/cli.mjs <validate-policy|inventory|plan|runtime|resource|compatibility|certification> ...",
  );
}
main().catch((error) => fail(error instanceof Error ? error.message : String(error)));

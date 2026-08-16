/*
 * Derive costly worker setup solely from a sealed plan node. This is both the
 * hosted-worker preparation contract and the v1.2 runtime-conformance seam.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { prepareV14Worker } from "./v14/fast-channel.mjs";

const resourceSet = (values) => new Set(Array.isArray(values) ? values : []);
const browserAdapters = new Set([
  "playwright-family",
  "node-test-browser-family",
  "admiralty-phase1-browser",
  "admiralty-phase2-browser",
]);
const requiredByAdapter = {
  static: [],
  policy: [],
  inventory: [],
  runtime: [],
  docs: [],
  features: [],
  architecture: [],
  language: [],
  privacy: ["scanner"],
  build: ["production-build-directory"],
  "sqlite-validate": ["prisma-sqlite-client"],
  "mysql-validate": ["mysql-schema"],
  "admiralty-phase1-browser": [
    "application-port",
    "sqlite-clone",
    "browser-chromium",
    "trace-root",
    "production-build-directory",
  ],
};

export const CONFORMANCE_CODES = Object.freeze({
  overprovisioning: "RUNTIME_OVERPROVISIONING",
  resourceScope: "RESOURCE_SCOPE_VIOLATION",
  browserScope: "BROWSER_ENGINE_SCOPE_VIOLATION",
  serialization: "UNJUSTIFIED_GLOBAL_SERIALIZATION",
  evidenceBoundary: "EVIDENCE_BOUNDARY_VIOLATION",
  authorityIndex: "AUTHORITY_INDEX_MISMATCH",
});

export function adapterRequirements(node) {
  if (node.adapter === "vitest-family") return ["node-slot", "vitest-worker-pool"];
  if (node.adapter === "node-test-browser-family") return ["node-slot", "application-port", "browser-chromium"];
  if (node.adapter === "playwright-family")
    return [
      "application-port",
      "sqlite-clone",
      "trace-root",
      ...node.resources.filter((id) => id.startsWith("browser-")),
    ];
  return requiredByAdapter[node.adapter] ?? [];
}

export function deriveWorkerPreparation(node, { browserEngine = undefined } = {}) {
  if (!node?.id || !Array.isArray(node.resources)) throw new Error("SEALED_PLAN_NODE_RESOURCES_REQUIRED");
  const declared = resourceSet(node.resources);
  const required = adapterRequirements(node);
  const violations = [];
  for (const resource of required)
    if (!declared.has(resource))
      violations.push({
        code: CONFORMANCE_CODES.resourceScope,
        resource,
        message: "adapter requirement is not declared",
      });
  const engines = ["browser-chromium", "browser-webkit"].filter((resource) => declared.has(resource));
  if (browserEngine !== undefined && !engines.includes(`browser-${browserEngine}`))
    throw new Error(`PHYSICAL_BROWSER_ENGINE_SCOPE_INVALID:${node.id}:${browserEngine}`);
  if (!browserAdapters.has(node.adapter) && engines.length)
    violations.push({
      code: CONFORMANCE_CODES.overprovisioning,
      resource: engines.join(","),
      message: "a non-browser adapter declares browser engines",
    });
  if (browserAdapters.has(node.adapter) && !engines.length)
    violations.push({
      code: CONFORMANCE_CODES.browserScope,
      message: "browser adapter has no declared browser engine",
    });
  const database = declared.has("sqlite-clone") || declared.has("mysql-schema");
  const prisma = database || declared.has("prisma-sqlite-client") || declared.has("mysql-schema");
  return {
    version: 1,
    suiteId: node.id,
    declaredResources: [...declared].sort(),
    adapterRequirements: [...new Set(required)].sort(),
    actions: {
      prismaGenerate: prisma,
      databaseMigration: database,
      databaseSeed: declared.has("sqlite-clone"),
      browserEngines: browserEngine ? [browserEngine] : engines.map((resource) => resource.replace("browser-", "")),
      applicationRuntime: declared.has("application-port"),
      productionBuild: declared.has("production-build-directory"),
    },
    preparationOwner: node.adapter === "playwright-family" ? "ISOLATED_BROWSER_RUNTIME" : "GOVERNED_WORKER",
    runtimeConformance: {
      result: violations.length ? "FAILED" : "PASSED",
      violations,
    },
  };
}

/**
 * Version-gated v1.4 preparation.  Current v1.3 callers continue to use the
 * synchronous function above; a v1.4 plan cannot be silently consumed there.
 */
export function deriveV14WorkerPreparation({
  plan,
  node,
  restoreResults = [],
  runId,
  mutableResources = [],
  browserEngine = undefined,
}) {
  if (
    plan?.authorityVersion !== "1.4" ||
    !["SHADOW_OPTIONAL_ADDITIVE_NONAUTHORITATIVE", "CURRENT_AUTHORITATIVE_V14", "V14_CANDIDATE_QUALIFICATION"].includes(
      plan?.authorityBoundary,
    )
  )
    throw new Error("V14_WORKER_AUTHORITY_BOUNDARY_REQUIRED");
  if (!plan?.nodes?.some((entry) => entry.id === node?.id)) throw new Error("V14_WORKER_PLAN_NODE_INVALID");
  const resourceConformance = deriveWorkerPreparation(node, { browserEngine });
  const prepared = prepareV14Worker({
    planNode: node,
    layers: node.preparedLayers ?? [],
    restoreResults,
    runId,
    mutableResources,
    authorityBoundary: plan.authorityBoundary,
  });
  return {
    ...prepared,
    actions: resourceConformance.actions,
    preparationOwner: resourceConformance.preparationOwner,
    runtimeConformance: resourceConformance.runtimeConformance,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const valueFor = (flag) => {
    const index = args.indexOf(flag);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const planPath = valueFor("--plan");
  const suiteId = valueFor("--suite");
  const browserEngine = valueFor("--browser-engine");
  const outputPath = valueFor("--out");
  if (!planPath || !suiteId || !outputPath) throw new Error("WORKER_PREPARATION_PLAN_SUITE_AND_OUTPUT_REQUIRED");
  const plan = JSON.parse(await readFile(path.resolve(planPath), "utf8"));
  const matches = plan.nodes.filter((node) => node.id === suiteId);
  if (matches.length !== 1) throw new Error("WORKER_PREPARATION_PLAN_NODE_INVALID");
  const preparation =
    plan.authorityVersion === "1.4"
      ? deriveV14WorkerPreparation({
          plan,
          node: matches[0],
          runId: process.env.GITHUB_RUN_ID ?? "local",
          browserEngine,
        })
      : deriveWorkerPreparation(matches[0], { browserEngine });
  if (preparation.runtimeConformance.result !== "PASSED") {
    const codes = preparation.runtimeConformance.violations.map((entry) => entry.code).join(",");
    throw new Error(`RUNTIME_CONFORMANCE_FAILED:${codes}`);
  }
  await writeFile(path.resolve(outputPath), `${JSON.stringify(preparation, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify(preparation)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { format, resolveConfig } from "prettier";

const root = process.cwd();
const testingRoot = path.join(root, "testing");
const contractNames = {
  "tideglass-exact-edition-pair": "Tideglass exact immutable Chronicle edition pair",
  "tideglass-semantic-determinism": "Tideglass semantic normalization and deterministic Change Set",
  "tideglass-safe-projection": "Tideglass authorized and redacted comparison projections",
  "tideglass-read-only-invariance": "Tideglass read-only publishing, Voyage, history, and release invariance",
  "tideglass-change-classification": "Stable governed change codes and explainable significance",
  "tideglass-compatibility-deltas": "Evidence-linked compatibility deltas",
  "tideglass-deterministic-summary": "Traceable deterministic comparison summaries",
  "tideglass-creator-annotations": "Append-only authorized Creator annotation revisions",
  "tideglass-rebuildable-cache": "Digest-validated context-free comparison cache",
  "tideglass-api-security": "Authorized bounded and redacted Tideglass APIs",
  "tideglass-migration-parity": "Additive SQLite and MySQL annotation migration parity",
};
const contractIds = Object.keys(contractNames);

const contracts = await json("contracts.json");
for (const id of contractIds)
  upsert(contracts.contracts, {
    id,
    name: contractNames[id],
    authority: "tideglass",
    owners:
      id === "tideglass-exact-edition-pair" || id === "tideglass-semantic-determinism"
        ? ["tideglass", "one-voyage"]
        : id === "tideglass-safe-projection"
          ? ["tideglass", "wayfarer"]
          : id === "tideglass-read-only-invariance"
            ? ["tideglass", "one-voyage", "wayfarer", "harborlight"]
            : ["tideglass"],
    critical: true,
  });
await save("contracts.json", contracts);

const ownership = await json("ownership.json");
upsert(ownership.owners, {
  id: "tideglass",
  project: "project-tideglass",
  sourcePaths: [
    "src/tideglass/**",
    "src/app/api/chronicles/**",
    "scripts/tideglass/**",
    "prisma/schema.sqlite.prisma",
    "prisma/schema.prisma",
    "prisma/migrations/20260809130000_tideglass_phase2_creator_annotations/**",
    "prisma/mysql-migrations/0053_tideglass_phase2_creator_annotations/**",
    "Development_Docs/Projects/Project_Tideglass/**",
  ],
  testPaths: ["tests/tideglass/**/*.test.*"],
  contractIds,
});
await save("ownership.json", ownership);

const suites = await json("suites.json");
upsert(suites.suites, {
  id: "unit.tideglass",
  name: "Tideglass semantic comparison and Phase 2 intelligence contracts",
  tier: 1,
  owner: "tideglass",
  command: "registry-selected Vitest files",
  estimatedDuration: "measured-budget",
  expectedDurationMs: 60_000,
  hardBudgetMs: 180_000,
  parallelSafe: true,
  resources: ["node-slot", "vitest-worker-pool"],
  dependencies: ["unit.one-voyage"],
  contracts: contractIds,
  affectedPaths: [
    "src/tideglass/**",
    "src/app/api/chronicles/**",
    "scripts/tideglass/**",
    "tests/tideglass/**",
    "prisma/migrations/20260809130000_tideglass_phase2_creator_annotations/**",
    "prisma/mysql-migrations/0053_tideglass_phase2_creator_annotations/**",
  ],
  releaseGates: ["local-change", "subsystem", "mainline", "release-candidate"],
  currentImplementationState: "phase-2-candidate",
  adapter: "vitest-family",
});
await save("suites.json", suites);

const impact = await json("impact-map.json");
for (const mapping of [
  { path: "src/tideglass/**", suiteIds: ["unit.tideglass", "static.core"], contractIds },
  {
    path: "src/app/api/chronicles/**",
    suiteIds: ["unit.tideglass", "static.core"],
    contractIds: ["tideglass-api-security", "tideglass-safe-projection", "tideglass-creator-annotations"],
  },
  { path: "scripts/tideglass/**", suiteIds: ["unit.tideglass", "static.core"], contractIds },
  { path: "tests/tideglass/**", suiteIds: ["unit.tideglass"], contractIds },
  { path: "Development_Docs/Projects/Project_Tideglass/**", suiteIds: ["unit.tideglass", "static.core"], contractIds },
  {
    path: "prisma/schema.sqlite.prisma",
    suiteIds: ["unit.tideglass", "database.sqlite", "build.production"],
    contractIds: ["tideglass-creator-annotations", "tideglass-migration-parity", "migration-parity"],
  },
  {
    path: "prisma/schema.prisma",
    suiteIds: ["unit.tideglass", "migration.mysql", "build.production"],
    contractIds: ["tideglass-creator-annotations", "tideglass-migration-parity", "migration-parity"],
  },
  {
    path: "prisma/migrations/20260809130000_tideglass_phase2_creator_annotations/**",
    suiteIds: ["unit.tideglass", "database.sqlite"],
    contractIds: ["tideglass-creator-annotations", "tideglass-migration-parity"],
  },
  {
    path: "prisma/mysql-migrations/0053_tideglass_phase2_creator_annotations/**",
    suiteIds: ["unit.tideglass", "migration.mysql"],
    contractIds: ["tideglass-creator-annotations", "tideglass-migration-parity"],
  },
])
  upsertBy(impact.pathMappings, "path", mapping);
const contractSuiteIds = {
  "tideglass-exact-edition-pair": ["unit.tideglass", "unit.one-voyage"],
  "tideglass-semantic-determinism": ["unit.tideglass"],
  "tideglass-safe-projection": ["unit.tideglass", "unit.wayfarer"],
  "tideglass-read-only-invariance": ["unit.tideglass", "unit.one-voyage", "unit.wayfarer", "unit.community"],
  "tideglass-change-classification": ["unit.tideglass"],
  "tideglass-compatibility-deltas": ["unit.tideglass"],
  "tideglass-deterministic-summary": ["unit.tideglass"],
  "tideglass-creator-annotations": ["unit.tideglass"],
  "tideglass-rebuildable-cache": ["unit.tideglass"],
  "tideglass-api-security": ["unit.tideglass"],
  "tideglass-migration-parity": ["unit.tideglass", "database.sqlite", "migration.mysql"],
};
for (const contractId of contractIds)
  upsertBy(impact.contractMappings, "contractId", { contractId, suiteIds: contractSuiteIds[contractId] });
await save("impact-map.json", impact);

const releaseGates = await json("release-gates.json");
for (const gate of releaseGates.gates) {
  if (["local-change", "subsystem", "mainline", "release-candidate"].includes(gate.id))
    gate.requiredSuites = unique([...(gate.requiredSuites ?? []), "unit.tideglass"]);
}
await save("release-gates.json", releaseGates);

process.stdout.write(
  `${JSON.stringify({ status: "TIDEGLASS_PHASE2_SOUNDING_LINE_POLICY_UPDATED", contracts: contractIds.length, suites: 1 })}\n`,
);

function upsert(values, next) {
  upsertBy(values, "id", next);
}
function upsertBy(values, key, next) {
  const index = values.findIndex((value) => value[key] === next[key]);
  if (index >= 0) values[index] = next;
  else values.push(next);
}
function unique(values) {
  return [...new Set(values)];
}
async function json(name) {
  return JSON.parse(await readFile(path.join(testingRoot, name), "utf8"));
}
async function save(name, value) {
  const target = path.join(testingRoot, name);
  const config = (await resolveConfig(target)) ?? {};
  await writeFile(target, await format(JSON.stringify(value), { ...config, parser: "json" }), "utf8");
}

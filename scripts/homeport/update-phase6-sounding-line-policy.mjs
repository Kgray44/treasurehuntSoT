import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { format } from "prettier";
import { phase6ContractIds } from "./phase6-surface-model.mjs";

const root = process.cwd();
const testingRoot = path.join(root, "testing");
const suiteIds = ["unit.homeport", "component.homeport", "browser.homeport"];
const phase6Paths = [
  "Development_Docs/Projects/Project_Homeport/Project_Homeport_Phase_6_*",
  "Development_Docs/Projects/Project_Homeport/evidence/phase6/**",
  "scripts/homeport/phase6-*.mjs",
  "scripts/homeport/apply-phase6-inventory-updates.mjs",
  "scripts/homeport/finalize-phase6-visual-review.mjs",
  "scripts/homeport/run-phase6-e2e.mjs",
  "scripts/homeport/update-phase6-sounding-line-policy.mjs",
  "tests/homeport/phase6-*.test.mjs",
  "tests/e2e/homeport-phase6.spec.ts",
  "tests/e2e/homeport-phase6.setup.ts",
  "playwright.homeport-phase6.config.ts",
];
const suiteAffectedPaths = [
  "scripts/homeport/phase6-*.mjs",
  "scripts/homeport/apply-phase6-inventory-updates.mjs",
  "scripts/homeport/finalize-phase6-visual-review.mjs",
  "scripts/homeport/run-phase6-e2e.mjs",
  "scripts/homeport/update-phase6-sounding-line-policy.mjs",
  "tests/homeport/phase6-*.test.mjs",
  "tests/e2e/homeport-phase6.spec.ts",
  "tests/e2e/homeport-phase6.setup.ts",
  "playwright.homeport-phase6.config.ts",
  "src/components/ui/**",
  "src/components/platform/**",
  "src/components/studio/**",
  "src/components/auth/**",
  "src/components/wayfarer/**",
  "src/components/homeport/**",
  "src/components/community/**",
  "src/components/shell/**",
  "src/app/community/**",
  "src/styles/**",
];

function readJson(name) {
  return JSON.parse(readFileSync(path.join(testingRoot, name), "utf8"));
}

async function writeJson(name, value) {
  const serialized = await format(JSON.stringify(value), { parser: "json", printWidth: 120 });
  writeFileSync(path.join(testingRoot, name), serialized, "utf8");
}

function unique(values) {
  return [...new Set(values)];
}

function contractName(id) {
  return id
    .replace(/^homeport\./u, "Project Homeport ")
    .replaceAll(".", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/gu, (letter) => letter.toUpperCase());
}

const contracts = readJson("contracts.json");
contracts.status = "phase-6-homeport-product-surfaces-validated";
const existingContracts = new Set(contracts.contracts.map((contract) => contract.id));
for (const id of phase6ContractIds) {
  if (existingContracts.has(id)) continue;
  contracts.contracts.push({
    id,
    name: contractName(id),
    authority: "project-homeport",
    owners: ["project-homeport"],
    critical: true,
  });
}
await writeJson("contracts.json", contracts);

const suites = readJson("suites.json");
const names = {
  "unit.homeport": "Project Homeport Phase 6 surface and state contracts",
  "component.homeport": "Project Homeport Phase 6 component and interaction contracts",
  "browser.homeport": "Project Homeport Phase 6 visual and behavioral journeys",
};
for (const id of suiteIds) {
  const suite = suites.suites.find((candidate) => candidate.id === id);
  if (!suite) throw new Error(`MISSING_HOMEPORT_SUITE:${id}`);
  suite.name = names[id];
  suite.contracts = unique([...suite.contracts, ...phase6ContractIds]);
  suite.affectedPaths = unique([...suite.affectedPaths, ...suiteAffectedPaths]);
  suite.currentImplementationState = "phase-6-homeport-product-surface-contract-family";
}
await writeJson("suites.json", suites);

const impactMap = readJson("impact-map.json");
impactMap.status = "phase-6-homeport-product-surface-impact-map";
for (const pathPattern of phase6Paths) {
  const mapping = impactMap.pathMappings.find((candidate) => candidate.path === pathPattern);
  if (mapping) {
    mapping.suiteIds = unique([...mapping.suiteIds, ...suiteIds]);
    mapping.contractIds = unique([...mapping.contractIds, ...phase6ContractIds]);
  } else {
    impactMap.pathMappings.push({ path: pathPattern, suiteIds: [...suiteIds], contractIds: [...phase6ContractIds] });
  }
}
const existingMappings = new Map(impactMap.contractMappings.map((mapping) => [mapping.contractId, mapping]));
for (const contractId of phase6ContractIds) {
  const mapping = existingMappings.get(contractId);
  if (mapping) mapping.suiteIds = unique([...mapping.suiteIds, ...suiteIds]);
  else impactMap.contractMappings.push({ contractId, suiteIds: [...suiteIds] });
}
await writeJson("impact-map.json", impactMap);

process.stdout.write(
  `${JSON.stringify({
    status: "HOMEPORT_PHASE6_SOUNDING_LINE_POLICY_UPDATED",
    contracts: phase6ContractIds.length,
    suites: suiteIds.length,
    pathMappings: phase6Paths.length,
  })}\n`,
);

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { format } from "prettier";
import { phase7ContractIds } from "./phase7-sounding-line-model.mjs";

const root = process.cwd();
const testingRoot = path.join(root, "testing");
const suiteIds = ["unit.homeport", "component.homeport", "browser.homeport"];
const phase7Paths = [
  "Development_Docs/Projects/Project_Homeport/Project_Homeport_Phase_7_*",
  "Development_Docs/Projects/Project_Homeport/evidence/phase7/**",
  "Development_Docs/Projects/Project_Homeport/walkthrough/phase7/**",
  "scripts/homeport/*phase7*.mjs",
  "tests/homeport/phase7-*.test.mjs",
  "tests/e2e/homeport-phase7.spec.ts",
  "playwright.homeport-phase7.config.ts",
];
const affectedPaths = [
  ...phase7Paths,
  "src/components/auth/**",
  "src/components/community/**",
  "src/components/homeport/**",
  "src/components/platform/**",
  "src/components/shell/**",
  "src/components/studio/**",
  "src/components/wayfarer/**",
  "src/app/account/**",
  "src/app/community/**",
  "src/app/passport/**",
  "src/app/player/**",
  "src/app/captain/**",
  "src/app/studio/**",
  "src/styles/**",
];

const readJson = (name) => JSON.parse(readFileSync(path.join(testingRoot, name), "utf8"));
const unique = (values) => [...new Set(values)];
const contractName = (id) =>
  id
    .replace(/^homeport\./u, "Project Homeport ")
    .replaceAll(".", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/gu, (value) => value.toUpperCase());
async function writeJson(name, value) {
  writeFileSync(
    path.join(testingRoot, name),
    await format(JSON.stringify(value), { parser: "json", printWidth: 120 }),
    "utf8",
  );
}

const contracts = readJson("contracts.json");
contracts.status = "phase-7-homeport-whole-voyage-ready-for-owner-walkthrough";
const existingContracts = new Set(contracts.contracts.map((contract) => contract.id));
for (const id of phase7ContractIds) {
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
  "unit.homeport": "Project Homeport Phase 7 whole-voyage contracts",
  "component.homeport": "Project Homeport Phase 7 integrated interaction contracts",
  "browser.homeport": "Project Homeport Phase 7 governed journey evidence",
};
for (const id of suiteIds) {
  const suite = suites.suites.find((candidate) => candidate.id === id);
  if (!suite) throw new Error(`MISSING_HOMEPORT_SUITE:${id}`);
  suite.name = names[id];
  suite.contracts = unique([...suite.contracts, ...phase7ContractIds]);
  suite.affectedPaths = unique([...suite.affectedPaths, ...affectedPaths]);
  suite.currentImplementationState = "phase-7-homeport-whole-voyage-contract-family";
}
await writeJson("suites.json", suites);

const impactMap = readJson("impact-map.json");
impactMap.status = "phase-7-homeport-whole-voyage-impact-map";
for (const pathPattern of phase7Paths) {
  const mapping = impactMap.pathMappings.find((candidate) => candidate.path === pathPattern);
  if (mapping) {
    mapping.suiteIds = unique([...mapping.suiteIds, ...suiteIds]);
    mapping.contractIds = unique([...mapping.contractIds, ...phase7ContractIds]);
  } else {
    impactMap.pathMappings.push({ path: pathPattern, suiteIds: [...suiteIds], contractIds: [...phase7ContractIds] });
  }
}
const mappings = new Map(impactMap.contractMappings.map((mapping) => [mapping.contractId, mapping]));
for (const contractId of phase7ContractIds) {
  const mapping = mappings.get(contractId);
  if (mapping) mapping.suiteIds = unique([...mapping.suiteIds, ...suiteIds]);
  else impactMap.contractMappings.push({ contractId, suiteIds: [...suiteIds] });
}
await writeJson("impact-map.json", impactMap);

process.stdout.write(
  `${JSON.stringify({ status: "HOMEPORT_PHASE7_SOUNDING_LINE_POLICY_UPDATED", contracts: phase7ContractIds.length, suites: suiteIds.length, pathMappings: phase7Paths.length })}\n`,
);

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { format } from "prettier";
import { ownerCorrectionRound1ContractIds } from "./phase7-owner-correction-round1-sounding-line-model.mjs";

const root = process.cwd();
const testingRoot = path.join(root, "testing");
const suiteIds = ["unit.homeport", "component.homeport", "browser.homeport"];
const correctionPaths = [
  "Development_Docs/Projects/Project_Homeport/Project_Homeport_Phase_7_Correction_Round_1_*",
  "Development_Docs/Projects/Project_Homeport/Project_Homeport_Phase_7_Owner_*",
  "Development_Docs/Projects/Project_Homeport/evidence/phase7-owner-correction-round1/**",
  "Development_Docs/Projects/Project_Homeport/walkthrough/phase7/correction-round1/**",
  "scripts/homeport/*phase7-owner-correction-round1*.mjs",
  "tests/e2e/homeport-phase7-owner-correction-round1.spec.ts",
  "playwright.homeport-phase7-owner-correction-round1.config.ts",
];
const affectedPaths = [
  ...correctionPaths,
  "prisma/schema.prisma",
  "prisma/schema.sqlite.prisma",
  "prisma/migrations/**",
  "prisma/mysql-migrations/**",
  "src/animation/**",
  "src/app/account/**",
  "src/app/api/account/**",
  "src/app/api/auth/**",
  "src/app/api/passport/**",
  "src/app/api/tales/**",
  "src/app/chronicles/**",
  "src/app/community/**",
  "src/chronicle/**",
  "src/community/**",
  "src/components/community/**",
  "src/components/homeport/**",
  "src/components/landing/**",
  "src/components/shell/**",
  "src/components/tales/**",
  "src/components/ui/**",
  "src/components/wayfarer/**",
  "src/homeport/**",
  "src/navigation/**",
  "src/wayfarer/**",
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
contracts.status = "phase-7-owner-correction-round-1-pending-owner-rereview";
const existingContracts = new Set(contracts.contracts.map((contract) => contract.id));
for (const id of ownerCorrectionRound1ContractIds) {
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
  "unit.homeport": "Project Homeport owner correction Round 1 unit, API, and service contracts",
  "component.homeport": "Project Homeport owner correction Round 1 interaction contracts",
  "browser.homeport": "Project Homeport owner correction Round 1 governed browser evidence",
};
for (const id of suiteIds) {
  const suite = suites.suites.find((candidate) => candidate.id === id);
  if (!suite) throw new Error(`MISSING_HOMEPORT_SUITE:${id}`);
  suite.name = names[id];
  suite.contracts = unique([...suite.contracts, ...ownerCorrectionRound1ContractIds]);
  suite.affectedPaths = unique([...suite.affectedPaths, ...affectedPaths]);
  suite.currentImplementationState = "phase-7-owner-correction-round-1-source-bound";
}
await writeJson("suites.json", suites);

const impactMap = readJson("impact-map.json");
impactMap.status = "phase-7-owner-correction-round-1-impact-map";
for (const pathPattern of correctionPaths) {
  const mapping = impactMap.pathMappings.find((candidate) => candidate.path === pathPattern);
  if (mapping) {
    mapping.suiteIds = unique([...mapping.suiteIds, ...suiteIds]);
    mapping.contractIds = unique([...(mapping.contractIds ?? []), ...ownerCorrectionRound1ContractIds]);
  } else {
    impactMap.pathMappings.push({
      path: pathPattern,
      suiteIds: [...suiteIds],
      contractIds: [...ownerCorrectionRound1ContractIds],
    });
  }
}
const mappings = new Map(impactMap.contractMappings.map((mapping) => [mapping.contractId, mapping]));
for (const contractId of ownerCorrectionRound1ContractIds) {
  const mapping = mappings.get(contractId);
  if (mapping) mapping.suiteIds = unique([...mapping.suiteIds, ...suiteIds]);
  else impactMap.contractMappings.push({ contractId, suiteIds: [...suiteIds] });
}
await writeJson("impact-map.json", impactMap);

process.stdout.write(
  `${JSON.stringify({ status: "HOMEPORT_PHASE7_OWNER_CORRECTION_ROUND1_SOUNDING_LINE_POLICY_UPDATED", contracts: ownerCorrectionRound1ContractIds.length, suites: suiteIds.length, pathMappings: correctionPaths.length })}\n`,
);

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { format, resolveConfig } from "prettier";

const root = process.cwd();
const testingRoot = path.join(root, "testing");
const contractIds = [
  "admiralty.phase1.identity",
  "admiralty.phase1.authorization",
  "admiralty.phase1.assurance",
  "admiralty.phase1.support-access",
  "admiralty.phase1.audit",
  "admiralty.phase1.registry",
  "admiralty.phase1.migration",
  "admiralty.phase1.responsive-consent",
];
const names = {
  "admiralty.phase1.identity": "Canonical identity and session authority",
  "admiralty.phase1.authorization": "Server-side role and capability authorization",
  "admiralty.phase1.assurance": "Recent privileged assurance and expiry",
  "admiralty.phase1.support-access": "User-approved scoped Support Access",
  "admiralty.phase1.audit": "Sanitized canonical administrative audit",
  "admiralty.phase1.registry": "Living capability-floor registry",
  "admiralty.phase1.migration": "Additive dual-database migration parity",
  "admiralty.phase1.responsive-consent": "Accessible responsive support consent",
};
const unitContracts = [...contractIds];
const componentContracts = [
  "admiralty.phase1.authorization",
  "admiralty.phase1.assurance",
  "admiralty.phase1.support-access",
  "admiralty.phase1.responsive-consent",
];
const browserContracts = [
  "admiralty.phase1.identity",
  "admiralty.phase1.authorization",
  "admiralty.phase1.assurance",
  "admiralty.phase1.support-access",
  "admiralty.phase1.audit",
  "admiralty.phase1.responsive-consent",
];

const contracts = await json("contracts.json");
for (const id of contractIds)
  upsert(contracts.contracts, {
    id,
    name: names[id],
    authority: "project-admiralty",
    owners: ["project-admiralty"],
    critical: true,
  });
await save("contracts.json", contracts);

const ownership = await json("ownership.json");
upsert(ownership.owners, {
  id: "project-admiralty",
  project: "project-admiralty",
  sourcePaths: [
    "src/admiralty/**",
    "src/components/admiralty/**",
    "src/app/admin/**",
    "src/app/api/admin/**",
    "src/app/api/account/support/**",
    "scripts/admiralty/**",
    "prisma/migrations/20260809120000_admiralty_phase1_foundation/**",
    "prisma/mysql-migrations/0052_admiralty_phase1_foundation/**",
  ],
  testPaths: ["src/admiralty/**/*.test.*", "src/app/admin/**/*.test.*", "tests/e2e/admiralty-phase1.spec.ts"],
  contractIds,
});
await save("ownership.json", ownership);

const suites = await json("suites.json");
upsert(
  suites.suites,
  suite(
    "unit.admiralty",
    "Admiralty Phase 1 unit and policy cases",
    1,
    "vitest-family",
    unitContracts,
    ["src/admiralty/**", "scripts/admiralty/**"],
    true,
    180_000,
  ),
);
upsert(
  suites.suites,
  suite(
    "component.admiralty",
    "Admiralty Phase 1 component cases",
    2,
    "vitest-family",
    componentContracts,
    ["src/components/admiralty/**", "src/app/admin/**"],
    true,
    180_000,
    ["unit.admiralty"],
  ),
);
upsert(
  suites.suites,
  suite(
    "browser.admiralty",
    "Admiralty Phase 1 isolated browser journeys",
    4,
    "admiralty-phase1-browser",
    browserContracts,
    ["tests/e2e/admiralty-phase1.spec.ts", "playwright.admiralty-phase1.config.ts"],
    false,
    600_000,
    ["unit.admiralty", "component.admiralty"],
  ),
);
await save("suites.json", suites);

const impact = await json("impact-map.json");
const allSuites = ["unit.admiralty", "component.admiralty", "browser.admiralty"];
for (const mapping of [
  { path: "src/admiralty/**", suiteIds: allSuites, contractIds },
  {
    path: "src/components/admiralty/**",
    suiteIds: ["component.admiralty", "browser.admiralty"],
    contractIds: componentContracts,
  },
  { path: "src/app/admin/**", suiteIds: ["component.admiralty", "browser.admiralty"], contractIds: browserContracts },
  { path: "src/app/api/admin/**", suiteIds: allSuites, contractIds: browserContracts },
  {
    path: "src/app/api/account/support/**",
    suiteIds: allSuites,
    contractIds: ["admiralty.phase1.support-access", "admiralty.phase1.audit"],
  },
  { path: "scripts/admiralty/**", suiteIds: allSuites, contractIds },
  { path: "tests/e2e/admiralty-phase1.spec.ts", suiteIds: ["browser.admiralty"], contractIds: browserContracts },
  { path: "playwright.admiralty-phase1.config.ts", suiteIds: ["browser.admiralty"], contractIds: browserContracts },
  {
    path: "prisma/migrations/20260809120000_admiralty_phase1_foundation/**",
    suiteIds: ["unit.admiralty"],
    contractIds: ["admiralty.phase1.migration"],
  },
  {
    path: "prisma/mysql-migrations/0052_admiralty_phase1_foundation/**",
    suiteIds: ["unit.admiralty"],
    contractIds: ["admiralty.phase1.migration"],
  },
])
  upsertBy(impact.pathMappings, "path", mapping);
for (const contractId of contractIds)
  upsertBy(impact.contractMappings, "contractId", { contractId, suiteIds: allSuites });
await save("impact-map.json", impact);

const releaseGates = await json("release-gates.json");
for (const gate of releaseGates.gates) {
  if (gate.id === "local-change") gate.conditionalSuites = unique([...(gate.conditionalSuites ?? []), ...allSuites]);
  if (["subsystem", "mainline", "release-candidate"].includes(gate.id))
    gate.requiredSuites = unique([...(gate.requiredSuites ?? []), ...allSuites]);
}
await save("release-gates.json", releaseGates);
process.stdout.write(
  `${JSON.stringify({ status: "ADMIRALTY_PHASE1_SOUNDING_LINE_POLICY_UPDATED", contracts: contractIds.length, suites: 3 })}\n`,
);

function suite(id, name, tier, adapter, contracts, affectedPaths, parallelSafe, hardBudgetMs, dependencies = []) {
  return {
    id,
    name,
    tier,
    owner: "project-admiralty",
    command: adapter === "admiralty-phase1-browser" ? "npm run admiralty:journeys" : "registry-selected Vitest files",
    estimatedDuration: "measured-budget",
    expectedDurationMs: tier === 4 ? 240_000 : 60_000,
    hardBudgetMs,
    parallelSafe,
    resources:
      tier === 4
        ? ["application-port", "sqlite-clone", "browser-chromium", "trace-root", "production-build-directory"]
        : ["node-slot", "vitest-worker-pool"],
    dependencies,
    contracts,
    affectedPaths,
    releaseGates: ["local-change", "subsystem", "mainline", "release-candidate"],
    currentImplementationState: "phase-1-owner-accepted-mainline-candidate",
    adapter,
  };
}
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

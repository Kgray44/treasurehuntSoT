import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { format, resolveConfig } from "prettier";

const root = process.cwd();
const testingRoot = path.join(root, "testing");
const phase1Contracts = [
  "admiralty.phase1.identity",
  "admiralty.phase1.authorization",
  "admiralty.phase1.assurance",
  "admiralty.phase1.support-access",
  "admiralty.phase1.audit",
  "admiralty.phase1.registry",
  "admiralty.phase1.migration",
  "admiralty.phase1.responsive-consent",
];
const phase2Contracts = [
  "admiralty.phase2.authorization-partition",
  "admiralty.phase2.read-projection-redaction",
  "admiralty.phase2.account-dossier-support",
  "admiralty.phase2.chronicle-voyage-inspection",
  "admiralty.phase2.community-operations-providers",
  "admiralty.phase2.audit-investigation",
  "admiralty.phase2.registry-activation",
  "admiralty.phase2.responsive-accessibility",
];
const contractIds = [...phase1Contracts, ...phase2Contracts];
const names = {
  "admiralty.phase2.authorization-partition": "Least-privileged Chartroom route and navigation partition",
  "admiralty.phase2.read-projection-redaction": "Bounded typed owner projections and secret redaction",
  "admiralty.phase2.account-dossier-support": "Account dossier and consented Support Access integration",
  "admiralty.phase2.chronicle-voyage-inspection": "Chronicle, edition, Voyage, crew, and safe event inspection",
  "admiralty.phase2.community-operations-providers":
    "Community, operations, provider, configuration, and release truth",
  "admiralty.phase2.audit-investigation": "Sanitized Audit Explorer and correlation-led investigation",
  "admiralty.phase2.registry-activation": "Living capability activation and dormant-state accounting",
  "admiralty.phase2.responsive-accessibility": "Responsive accessible read-only Chartroom",
};
const unitContracts = [
  "admiralty.phase2.authorization-partition",
  "admiralty.phase2.registry-activation",
  "admiralty.phase1.authorization",
  "admiralty.phase1.registry",
];
const serviceContracts = [
  "admiralty.phase2.read-projection-redaction",
  "admiralty.phase2.account-dossier-support",
  "admiralty.phase2.chronicle-voyage-inspection",
  "admiralty.phase2.community-operations-providers",
  "admiralty.phase2.audit-investigation",
  "admiralty.phase1.support-access",
  "admiralty.phase1.audit",
];
const componentContracts = [
  "admiralty.phase2.authorization-partition",
  "admiralty.phase2.account-dossier-support",
  "admiralty.phase2.audit-investigation",
  "admiralty.phase2.responsive-accessibility",
  "admiralty.phase1.assurance",
  "admiralty.phase1.support-access",
];
const browserContracts = [...phase2Contracts, ...phase1Contracts.filter((id) => !id.endsWith("migration"))];

const contracts = await json("contracts.json");
for (const id of phase2Contracts)
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
    "src/homeport/current-user*",
    "src/navigation/**",
    "scripts/admiralty/**",
    "prisma/migrations/20260809120000_admiralty_phase1_foundation/**",
    "prisma/mysql-migrations/0052_admiralty_phase1_foundation/**",
  ],
  testPaths: [
    "src/admiralty/**/*.test.*",
    "src/app/admin/**/*.test.*",
    "src/navigation/navigation.test.ts",
    "tests/e2e/admiralty-phase1.spec.ts",
    "tests/e2e/admiralty-phase2.spec.ts",
  ],
  contractIds,
});
await save("ownership.json", ownership);

const suites = await json("suites.json");
upsert(
  suites.suites,
  suite(
    "unit.admiralty",
    "Admiralty unit and policy cases",
    1,
    "vitest-family",
    unitContracts,
    ["src/admiralty/**", "src/navigation/**", "scripts/admiralty/**"],
    true,
    180_000,
  ),
);
upsert(
  suites.suites,
  suite(
    "service.admiralty",
    "Admiralty typed read-port and projection cases",
    2,
    "vitest-family",
    serviceContracts,
    ["src/admiralty/ports/**", "src/admiralty/read-models*", "src/admiralty/investigation.ts"],
    true,
    180_000,
    ["unit.admiralty"],
  ),
);
upsert(
  suites.suites,
  suite(
    "component.admiralty",
    "Admiralty Chartroom component cases",
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
    "Admiralty Phase 2 isolated browser journeys",
    4,
    "admiralty-phase2-browser",
    browserContracts,
    ["tests/e2e/admiralty-phase2.spec.ts", "playwright.admiralty-phase2.config.ts"],
    false,
    900_000,
    ["unit.admiralty", "service.admiralty", "component.admiralty"],
  ),
);
await save("suites.json", suites);

const impact = await json("impact-map.json");
const allSuites = ["unit.admiralty", "service.admiralty", "component.admiralty", "browser.admiralty"];
for (const mapping of [
  { path: "src/admiralty/**", suiteIds: allSuites, contractIds },
  {
    path: "src/admiralty/ports/**",
    suiteIds: ["service.admiralty", "browser.admiralty"],
    contractIds: serviceContracts,
  },
  {
    path: "src/admiralty/read-models*",
    suiteIds: ["service.admiralty", "browser.admiralty"],
    contractIds: serviceContracts,
  },
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
    contractIds: [
      "admiralty.phase1.support-access",
      "admiralty.phase1.audit",
      "admiralty.phase2.account-dossier-support",
    ],
  },
  {
    path: "src/homeport/current-user*",
    suiteIds: ["unit.admiralty", "browser.admiralty"],
    contractIds: ["admiralty.phase2.authorization-partition"],
  },
  {
    path: "src/navigation/**",
    suiteIds: ["unit.admiralty", "browser.admiralty"],
    contractIds: ["admiralty.phase2.authorization-partition"],
  },
  { path: "scripts/admiralty/**", suiteIds: allSuites, contractIds },
  { path: "tests/e2e/admiralty-phase2.spec.ts", suiteIds: ["browser.admiralty"], contractIds: browserContracts },
  { path: "playwright.admiralty-phase2.config.ts", suiteIds: ["browser.admiralty"], contractIds: browserContracts },
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
  `${JSON.stringify({ status: "ADMIRALTY_PHASE2_SOUNDING_LINE_POLICY_UPDATED", contracts: phase2Contracts.length, suites: 4 })}\n`,
);

function suite(id, name, tier, adapter, contracts, affectedPaths, parallelSafe, hardBudgetMs, dependencies = []) {
  return {
    id,
    name,
    tier,
    owner: "project-admiralty",
    command: adapter === "admiralty-phase2-browser" ? "npm run admiralty:journeys" : "registry-selected Vitest files",
    estimatedDuration: "measured-budget",
    expectedDurationMs: tier === 4 ? 300_000 : 60_000,
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
    currentImplementationState: "phase-2-ready-for-owner-walkthrough-branch",
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

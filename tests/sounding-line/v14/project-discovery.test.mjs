import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createProjectDiscoveryRegistry,
  createTrustedMainProjectDiscoveryRegistry,
  discoverProjects,
  projectDiscoverySummary,
  structurallyAdmitsProjectPath,
  validateProjectDiscoveryRegistry,
  validateTrustedMainProjectDiscoveryRegistry,
} from "../../../scripts/sounding-line/project-discovery.mjs";
import { classifyOrdinaryCandidate } from "../../../scripts/sounding-line/verification-maintenance.mjs";
import { selectV14Mainline } from "../../../scripts/sounding-line/v14/fast-channel.mjs";

const sha = (letter) => letter.repeat(40);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const asterismPaths = [
  "Development_Docs/Projects/Project_Asterism/Design.md",
  "src/asterism/constellation.ts",
  "tests/asterism/constellation.test.ts",
  "scripts/asterism/check.mjs",
];
const suites = [
  { id: "browser.access-sentinel", domains: ["authorization"] },
  { id: "unit.asterism", domains: ["asterism"] },
  { id: "unit.unrelated", domains: ["unrelated"] },
  { id: "migration.mysql", domains: ["migration"] },
  { id: "unit.auth", domains: ["authorization"] },
];
const contracts = [{ id: "asterism.constellation" }];
const policy = {
  authority: "SOUNDING_LINE_VERIFICATION_MAINTENANCE",
  trustedMainOnly: true,
  ordinaryCandidateEligiblePathGlobs: ["src/**", "tests/**", "Development_Docs/Projects/**", "prisma/**"],
  authorityChangePathGlobs: ["scripts/sounding-line/**", "testing/impact-map.json"],
};

test("Project Asterism first candidate is provisional, explainable, and can only broaden", async () => {
  const canonicalSources = await Promise.all(
    ["ownership.json", "impact-map.json", "verification-maintenance-policy.json"].map(async (name) =>
      readFile(path.join(root, "testing", name), "utf8"),
    ),
  );
  for (const source of canonicalSources) assert.doesNotMatch(source, /asterism/iu);
  const [descriptor] = discoverProjects({
    candidatePaths: asterismPaths,
    trustedMainSha: sha("a"),
    candidateSha: sha("b"),
    suites,
    contracts,
    featureCatalog: [{ id: "FT-asterism", title: "Project Asterism" }],
  });
  assert.equal(descriptor.projectId, "asterism");
  assert.equal(descriptor.state, "PROVISIONAL_CONSERVATIVE");
  assert.equal(descriptor.confidence, "HIGH");
  assert.equal(descriptor.mayBroadenEvidence, true);
  assert.equal(descriptor.mayNarrowEvidence, false);
  assert.equal(descriptor.evidence.find((entry) => entry.kind === "feature-catalog")?.trusted, false);
  assert.deepEqual(descriptor.probableSuiteIds, ["unit.asterism"]);
  assert.deepEqual(descriptor.probableContractIds, ["asterism.constellation"]);
  assert.equal(structurallyAdmitsProjectPath("scripts/asterism/check.mjs", [descriptor]), true);

  const firstPlan = selectV14Mainline({
    changedPaths: asterismPaths,
    suites,
    requiredSuiteIds: ["browser.access-sentinel"],
    ledgerSuiteIds: suites.map((suite) => suite.id),
    impact: { pathMappings: [{ path: "src/**", suiteIds: ["unit.unrelated"] }], contractMappings: [] },
    projectDiscovery: [descriptor],
  });
  assert.equal(firstPlan.fallback.disposition, "CONSERVATIVE_FALLBACK");
  assert.deepEqual(firstPlan.selectedSuiteIds, suites.map((suite) => suite.id).sort());
  assert.equal(firstPlan.projectDiscovery[0].candidateTimeAuthority, "MAY_BROADEN_MAY_NOT_NARROW");
  assert.deepEqual(projectDiscoverySummary([descriptor])[0].evidenceKinds, [
    "contract",
    "feature-catalog",
    "project-document",
    "script-root",
    "source-root",
    "test-registry",
    "test-root",
  ]);
});

test("trusted-main promotion enables later Asterism semantic selection without a hand-edited map", () => {
  const [trusted] = discoverProjects({
    candidatePaths: ["src/asterism/next-phase.ts"],
    trustedPaths: asterismPaths,
    trustedMainSha: sha("c"),
    candidateSha: sha("d"),
    suites,
    contracts,
  });
  assert.equal(trusted.state, "TRUSTED_DISCOVERED");
  assert.equal(trusted.mayNarrowEvidence, true);
  const nextPlan = selectV14Mainline({
    changedPaths: ["src/asterism/next-phase.ts"],
    suites,
    requiredSuiteIds: ["browser.access-sentinel"],
    ledgerSuiteIds: suites.map((suite) => suite.id),
    impact: { pathMappings: [], contractMappings: [] },
    projectDiscovery: [trusted],
  });
  assert.equal(nextPlan.fallback, null);
  assert.deepEqual(nextPlan.selectedSuiteIds, ["browser.access-sentinel", "unit.asterism"]);
  assert.equal(nextPlan.ledger.find((entry) => entry.suiteId === "unit.asterism").selectionReason, "DIRECT_IMPACT");
});

test("derived registry is deterministic, trusted-main-bound, stale-detectable, and tamper-proof", () => {
  const [trusted] = discoverProjects({
    candidatePaths: ["src/asterism/next.ts"],
    trustedPaths: asterismPaths,
    trustedMainSha: sha("c"),
    candidateSha: sha("d"),
    suites,
  });
  const registry = createProjectDiscoveryRegistry({
    trustedMainSha: sha("c"),
    trustedMainTreeSha: sha("e"),
    descriptors: [trusted],
  });
  assert.equal(
    validateProjectDiscoveryRegistry({ registry, trustedMainSha: sha("c"), trustedMainTreeSha: sha("e") }).valid,
    true,
  );
  assert.equal(
    validateProjectDiscoveryRegistry({ registry, trustedMainSha: sha("f"), trustedMainTreeSha: sha("e") }).code,
    "PROJECT_DISCOVERY_REGISTRY_STALE",
  );
  assert.equal(
    validateProjectDiscoveryRegistry({
      registry: { ...registry, registryDigest: "tampered" },
      trustedMainSha: sha("c"),
      trustedMainTreeSha: sha("e"),
    }).code,
    "PROJECT_DISCOVERY_REGISTRY_DIGEST_MISMATCH",
  );
});

test("trusted-main project records promote an accepted project deterministically without a name special case", () => {
  const sourceRegistry = {
    projects: [
      {
        id: "project-shipwright",
        displayName: "Project Shipwright",
        aliases: ["Shipwright", "Project Shipwright"],
        documentationRoot: "Development_Docs/Projects/Project Shipwright",
        evidencePaths: [
          "Development_Docs/Projects/Project Shipwright/Phase_2_Completion.md",
          "Development_Docs/Features/branch-complete/project-shipwright-phase2.json",
        ],
        sourcePaths: ["src/components/studio/**", "src/studio/authoring/**"],
        testPaths: ["tests/e2e/project-shipwright-phase2.spec.ts"],
        supportingOwnerIds: ["drydock"],
      },
    ],
  };
  const trustedTreePaths = [
    ...sourceRegistry.projects[0].evidencePaths,
    "src/components/studio/TaleEditor.tsx",
    "src/studio/authoring/adapters.ts",
    "tests/e2e/project-shipwright-phase2.spec.ts",
  ];
  const input = {
    trustedMainSha: sha("a"),
    trustedMainTreeSha: sha("b"),
    trustedTreePaths,
    sourceRegistry,
    owners: [{ id: "drydock", contractIds: ["drydock-authoring-contracts"] }],
  };
  const first = createTrustedMainProjectDiscoveryRegistry(input);
  const second = createTrustedMainProjectDiscoveryRegistry(input);
  assert.deepEqual(first, second);
  assert.equal(first.errors.length, 0);
  assert.equal(first.descriptors[0].id, "project-shipwright");
  assert.deepEqual(first.descriptors[0].aliases, ["Project Shipwright", "project-shipwright", "Shipwright"]);
  assert.equal(
    validateTrustedMainProjectDiscoveryRegistry({
      registry: first,
      trustedMainSha: sha("a"),
      trustedMainTreeSha: sha("b"),
    }).valid,
    true,
  );
  const forged = createTrustedMainProjectDiscoveryRegistry({
    ...input,
    sourceRegistry: { projects: [{ ...sourceRegistry.projects[0], sourcePaths: ["scripts/**"] }] },
  });
  assert.match(forged.errors.join("\n"), /PROJECT_DISCOVERY_SOURCE_SCOPE_INVALID/);
});

test("Project DefinitelyNormal cannot escape the authority firewall", () => {
  const result = classifyOrdinaryCandidate({
    trustedPolicy: policy,
    changedPaths: [
      ...asterismPaths.map((file) => file.replaceAll("asterism", "definitely-normal")),
      "scripts/sounding-line/finalizer.mjs",
    ],
  });
  assert.equal(result.classification, "ORDINARY_CANDIDATE_AUTHORITY_CHANGE_REJECTED");
  assert.deepEqual(result.errors, ["ORDINARY_CANDIDATE_AUTHORITY_CHANGE_REJECTED:scripts/sounding-line/finalizer.mjs"]);
});

test("structural admission permits correlated project scripts and supplements but not broad bypasses", () => {
  const accepted = classifyOrdinaryCandidate({ trustedPolicy: policy, changedPaths: asterismPaths });
  assert.equal(accepted.classification, "ORDINARY_CANDIDATE");
  const supplements = classifyOrdinaryCandidate({
    trustedPolicy: policy,
    changedPaths: [
      ...asterismPaths,
      "README.md",
      "Development_Docs/Project_Ledgerlight_Documentation_Migration_Matrix.csv",
    ],
  });
  assert.equal(supplements.classification, "ORDINARY_CANDIDATE");
  const rejected = classifyOrdinaryCandidate({ trustedPolicy: policy, changedPaths: ["scripts/asterism/check.mjs"] });
  assert.equal(rejected.classification, "ORDINARY_CANDIDATE_UNKNOWN_SCOPE_REJECTED");
  const unprovenSupplement = classifyOrdinaryCandidate({ trustedPolicy: policy, changedPaths: ["README.md"] });
  assert.equal(unprovenSupplement.classification, "ORDINARY_CANDIDATE_UNKNOWN_SCOPE_REJECTED");
  const multipleProjects = classifyOrdinaryCandidate({
    trustedPolicy: policy,
    changedPaths: [...asterismPaths, "src/orbit/route.ts", "tests/orbit/route.test.ts", "README.md"],
  });
  assert.equal(multipleProjects.classification, "ORDINARY_CANDIDATE_UNKNOWN_SCOPE_REJECTED");
  assert.deepEqual(multipleProjects.errors, ["ORDINARY_CANDIDATE_UNKNOWN_SCOPE_REJECTED:README.md"]);
});

test("structural admission rejects a prospective project that collides with a trusted project root", () => {
  const collisionPolicy = {
    ...policy,
    ordinaryCandidateEligiblePathGlobs: [
      ...policy.ordinaryCandidateEligiblePathGlobs,
      "Development_Docs/Programs/Deepwater/**",
      "scripts/deepwater/**",
    ],
  };
  const result = classifyOrdinaryCandidate({
    trustedPolicy: collisionPolicy,
    changedPaths: ["Development_Docs/Programs/DeepwaterEvil/Design.md", "scripts/deepwater-evil/check.mjs"],
  });
  assert.equal(result.classification, "ORDINARY_CANDIDATE_UNKNOWN_SCOPE_REJECTED");
  assert.deepEqual(result.errors, [
    "ORDINARY_CANDIDATE_UNKNOWN_SCOPE_REJECTED:Development_Docs/Programs/DeepwaterEvil/Design.md",
    "ORDINARY_CANDIDATE_UNKNOWN_SCOPE_REJECTED:scripts/deepwater-evil/check.mjs",
  ]);
});

test("an exact trusted owner attributes a root-level project script without inventing a filename project", () => {
  const rehearsal = "scripts/rehearse-harborlight-phase3-migrations.ts";
  const adjacentUnknown = "scripts/rehearse-adjacent-migrations.ts";
  const rehearsalSuites = [
    { id: "browser.access-sentinel", domains: ["authorization"], trusted: true },
    { id: "unit.harborlight", owner: "harborlight", trusted: true },
  ];
  const rehearsalContracts = [{ id: "harborlight.migration", trusted: true }];
  const rehearsalOwners = [
    {
      id: "harborlight",
      project: "harborlight",
      sourcePaths: [rehearsal],
      contractIds: ["harborlight.migration"],
      trusted: true,
    },
  ];
  const discovered = discoverProjects({
    candidatePaths: [rehearsal],
    trustedPaths: [rehearsal],
    suites: rehearsalSuites,
    contracts: rehearsalContracts,
    owners: rehearsalOwners,
  });
  assert.deepEqual(
    discovered.map((entry) => entry.projectId),
    ["harborlight"],
  );
  assert.equal(discovered[0].state, "TRUSTED_DISCOVERED");
  assert.equal(discovered[0].mayNarrowEvidence, true);
  const selected = selectV14Mainline({
    changedPaths: [rehearsal],
    suites: rehearsalSuites,
    requiredSuiteIds: ["browser.access-sentinel"],
    ledgerSuiteIds: rehearsalSuites.map((suite) => suite.id),
    impact: { pathMappings: [], contractMappings: [] },
    projectDiscovery: discovered,
  });
  assert.equal(selected.fallback, null);
  assert.deepEqual(selected.selectedSuiteIds, ["browser.access-sentinel", "unit.harborlight"]);

  const unknown = discoverProjects({
    candidatePaths: [adjacentUnknown],
    trustedPaths: [rehearsal],
    suites: rehearsalSuites,
    contracts: rehearsalContracts,
    owners: rehearsalOwners,
  });
  assert.deepEqual(unknown, []);
  const rejected = classifyOrdinaryCandidate({
    trustedPolicy: {
      ...policy,
      ordinaryCandidateEligiblePathGlobs: [...policy.ordinaryCandidateEligiblePathGlobs, rehearsal],
    },
    changedPaths: [adjacentUnknown],
  });
  assert.equal(rejected.classification, "ORDINARY_CANDIDATE_UNKNOWN_SCOPE_REJECTED");
  assert.deepEqual(rejected.errors, [`ORDINARY_CANDIDATE_UNKNOWN_SCOPE_REJECTED:${adjacentUnknown}`]);
});

test("ambiguity, missing tests, migration, security, and multiple projects remain conservative", () => {
  const ambiguous = discoverProjects({
    candidatePaths: asterismPaths,
    trustedPaths: asterismPaths,
    trustedMainSha: sha("a"),
    suites,
    owners: [{ id: "asterism-owner-one" }, { id: "asterism-owner-two" }],
  })[0];
  assert.equal(ambiguous.state, "AMBIGUOUS");
  assert.equal(ambiguous.mayNarrowEvidence, false);
  const multiple = discoverProjects({
    candidatePaths: [...asterismPaths, "src/orbit/route.ts", "tests/orbit/route.test.ts"],
    trustedMainSha: sha("a"),
    suites,
  });
  assert.deepEqual(
    multiple.map((entry) => entry.projectId),
    ["asterism", "orbit"],
  );
  const migrationPlan = selectV14Mainline({
    changedPaths: [...asterismPaths, "prisma/migrations/asterism_init/migration.sql"],
    suites,
    ledgerSuiteIds: suites.map((suite) => suite.id),
    impact: { pathMappings: [], contractMappings: [] },
    projectDiscovery: multiple.filter((entry) => entry.projectId === "asterism"),
  });
  assert.ok(migrationPlan.selectedSuiteIds.includes("migration.mysql"));
  const securityPlan = selectV14Mainline({
    changedPaths: ["src/asterism/auth/authorize.ts"],
    suites,
    ledgerSuiteIds: suites.map((suite) => suite.id),
    impact: { pathMappings: [], contractMappings: [] },
    projectDiscovery: multiple.filter((entry) => entry.projectId === "asterism"),
  });
  assert.ok(securityPlan.selectedSuiteIds.includes("unit.auth"));
  const [docsOnly] = discoverProjects({
    candidatePaths: ["Development_Docs/Projects/Project_Celestial/Record.md"],
    trustedMainSha: sha("a"),
  });
  assert.equal(docsOnly.state, "PROVISIONAL_CONSERVATIVE");
  assert.deepEqual(docsOnly.observedTestRoots, []);
});

const productSuites = [
  { id: "browser.access-sentinel", domains: ["authorization"] },
  { id: "unit.wakebook", owner: "project-wakebook" },
  { id: "browser.wakebook", owner: "project-wakebook" },
  { id: "unit.tideglass", owner: "tideglass" },
  { id: "browser.tideglass", owner: "tideglass" },
  { id: "unit.lanternwake", owner: "lanternwake" },
  { id: "browser.lanternwake", owner: "lanternwake" },
  { id: "unit.feature-catalog", affectedPaths: ["scripts/features/**", "Development_Docs/Features/**"] },
  { id: "static.core" },
].map((entry) => ({ ...entry, trusted: true }));
const productContracts = [
  { id: "wakebook.history", trusted: true },
  { id: "tideglass.editions", trusted: true },
  { id: "lanternwake.viewport", trusted: true },
];
const productOwners = [
  {
    id: "project-wakebook",
    project: "project-wakebook",
    sourcePaths: ["src/wakebook/**"],
    testPaths: ["tests/e2e/wakebook-*.spec.ts"],
    contractIds: ["wakebook.history"],
  },
  {
    id: "tideglass",
    project: "project-tideglass",
    sourcePaths: ["scripts/tideglass/**"],
    testPaths: ["tests/e2e/tideglass-*.spec.ts"],
    contractIds: ["tideglass.editions"],
  },
  {
    id: "lanternwake",
    project: "lanternwake",
    sourcePaths: ["src/animation/**"],
    testPaths: ["tests/e2e/lanternwake-*.spec.ts"],
    contractIds: ["lanternwake.viewport"],
  },
].map((entry) => ({ ...entry, trusted: true }));
const productCatalog = [
  { id: "catalog-wakebook", title: "Project Wakebook", trusted: true },
  { id: "catalog-tideglass", title: "Project Tideglass", trusted: true },
  { id: "catalog-lanternwake", title: "Project Lanternwake", trusted: true },
];
const productPlan = ({ changedPaths, descriptors, owners = productOwners }) =>
  selectV14Mainline({
    changedPaths,
    suites: productSuites,
    requiredSuiteIds: ["browser.access-sentinel"],
    ledgerSuiteIds: productSuites.map((suite) => suite.id),
    impact: { pathMappings: [], contractMappings: [] },
    projectDiscovery:
      descriptors ??
      discoverProjects({
        candidatePaths: changedPaths,
        suites: productSuites,
        contracts: productContracts,
        owners,
        featureCatalog: productCatalog,
      }),
  });

test("trusted owner shapes, project fragments, and catalog fragments select only their known product evidence", () => {
  const wakebookPaths = [
    "src/wakebook/archive-query.ts",
    "Development_Docs/Project_Wakebook_Phase_2_Test_Plan.md",
    "Development_Docs/Features/catalog/wakebook.json",
  ];
  const [wakebook] = discoverProjects({
    candidatePaths: wakebookPaths,
    suites: productSuites,
    contracts: productContracts,
    owners: productOwners,
    featureCatalog: productCatalog,
  });
  assert.equal(wakebook.state, "TRUSTED_DISCOVERED");
  assert.equal(wakebook.mayNarrowEvidence, true);
  const plan = productPlan({ changedPaths: wakebookPaths, descriptors: [wakebook] });
  assert.equal(plan.fallback, null);
  assert.ok(plan.selectedSuiteIds.includes("unit.wakebook"));
  assert.ok(plan.selectedSuiteIds.includes("browser.wakebook"));
  assert.ok(!plan.selectedSuiteIds.includes("browser.tideglass"));
  assert.ok(!plan.selectedSuiteIds.includes("browser.lanternwake"));
});

test("generated validation is bounded, while Tideglass and Lanternwake keep their own browser families", () => {
  const global = productPlan({ changedPaths: ["scripts/features/feature-catalog.test.ts"] });
  assert.equal(global.fallback, null);
  assert.deepEqual(global.selectedSuiteIds, ["browser.access-sentinel", "unit.feature-catalog"]);
  const tideglass = productPlan({ changedPaths: ["scripts/tideglass/seed-phase3-fixture.mjs"] });
  const lanternwake = productPlan({ changedPaths: ["tests/e2e/lanternwake-phase2.spec.ts"] });
  assert.ok(tideglass.selectedSuiteIds.includes("browser.tideglass"));
  assert.ok(!tideglass.selectedSuiteIds.includes("browser.lanternwake"));
  assert.ok(lanternwake.selectedSuiteIds.includes("browser.lanternwake"));
  assert.ok(!lanternwake.selectedSuiteIds.includes("browser.tideglass"));
});

test("unknown product, unknown owner, authority-sensitive, and cross-project intervals remain fail-closed or exact", () => {
  for (const input of [
    productPlan({ changedPaths: ["src/unmapped/new.ts"] }),
    productPlan({ changedPaths: ["src/wakebook/archive-query.ts"], owners: [] }),
    productPlan({ changedPaths: ["testing/sounding-line-authority.json"] }),
  ]) {
    assert.equal(input.fallback?.disposition, "CONSERVATIVE_FALLBACK");
  }
  const crossProject = productPlan({
    changedPaths: ["scripts/tideglass/seed-phase3-fixture.mjs", "tests/e2e/lanternwake-phase2.spec.ts"],
  });
  assert.equal(crossProject.fallback, null);
  assert.ok(crossProject.selectedSuiteIds.includes("browser.tideglass"));
  assert.ok(crossProject.selectedSuiteIds.includes("browser.lanternwake"));
  const candidate = productPlan({ changedPaths: ["src/wakebook/archive-query.ts"] });
  const train = productPlan({ changedPaths: ["src/wakebook/archive-query.ts"] });
  assert.deepEqual(candidate.selectedSuiteIds, train.selectedSuiteIds);
});

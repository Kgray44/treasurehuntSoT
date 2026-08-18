import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createProjectDiscoveryRegistry,
  discoverProjects,
  projectDiscoverySummary,
  structurallyAdmitsProjectPath,
  validateProjectDiscoveryRegistry,
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

test("structural admission permits correlated new project scripts but not a scripts-wide bypass", () => {
  const accepted = classifyOrdinaryCandidate({ trustedPolicy: policy, changedPaths: asterismPaths });
  assert.equal(accepted.classification, "ORDINARY_CANDIDATE");
  const rejected = classifyOrdinaryCandidate({ trustedPolicy: policy, changedPaths: ["scripts/asterism/check.mjs"] });
  assert.equal(rejected.classification, "ORDINARY_CANDIDATE_UNKNOWN_SCOPE_REJECTED");
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

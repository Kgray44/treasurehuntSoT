import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { splitMigrationStatements } from "../../scripts/sounding-line/sqlite-bootstrap.mjs";
import {
  assertBinding,
  browserProvisioningRequired,
  buildPlan,
  classifyChanges,
  packageAuthorityChanges,
  requiresMigrationValidation,
  requiresBuild,
  runVerificationCommands,
  selectAffectedTests,
  soundingLineDatabaseUrl,
  verificationEnvironment,
  verificationCommands,
} from "../../scripts/sounding-line/ordinary.mjs";

const basePackage = {
  scripts: {
    "test:changed": "node scripts/sounding-line/ordinary.mjs --mode ordinary",
    "test:release": "node scripts/sounding-line/ordinary.mjs --mode release",
    "test:sounding-line": "node --test tests/sounding-line/ordinary.test.mjs",
  },
};

function git(root, argumentsList) {
  return execFileSync("git", argumentsList, { cwd: root, encoding: "utf8" }).trim();
}

function candidateFixture(changes) {
  const root = mkdtempSync(path.join(tmpdir(), "sounding-line-ordinary-"));
  for (const [file, contents] of Object.entries({
    "package.json": `${JSON.stringify(basePackage, null, 2)}\n`,
    "testing/contracts.json": "{}\n",
    "testing/impact-map.json": "{}\n",
    "testing/suites.json": "{}\n",
    "src/product.ts": "export const product = true;\n",
  })) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), contents);
  }
  git(root, ["init", "--initial-branch=main", "--quiet"]);
  git(root, ["config", "core.autocrlf", "false"]);
  git(root, ["config", "user.email", "ordinary@example.invalid"]);
  git(root, ["config", "user.name", "Ordinary Fixture"]);
  git(root, ["add", "."]);
  git(root, ["commit", "--quiet", "-m", "base"]);
  const baseSha = git(root, ["rev-parse", "HEAD"]);
  for (const [file, contents] of Object.entries(changes)) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), contents);
  }
  git(root, ["add", "."]);
  git(root, ["commit", "--quiet", "-m", "candidate"]);
  return { root, baseSha, candidateSha: git(root, ["rev-parse", "HEAD"]) };
}

async function withCandidate(changes, assertion) {
  const fixture = candidateFixture(changes);
  try {
    await assertion(fixture);
  } finally {
    rmSync(fixture.root, { force: true, recursive: true });
  }
}

test("ordinary classification ignores retired generated state and rejects active control-plane edits", () => {
  const result = classifyChanges([
    "src/app/community/voyage-logs/[slug]/page.tsx",
    "testing/generated/active-test-registry.json",
    "Development_Docs/Programs/Sounding_Line/Project_Sounding_Line_P34_Retirement_Ledger.csv",
    "scripts/sounding-line/ordinary.mjs",
  ]);
  assert.deepEqual(result.ignoredPaths, [
    "Development_Docs/Programs/Sounding_Line/Project_Sounding_Line_P34_Retirement_Ledger.csv",
    "testing/generated/active-test-registry.json",
  ]);
  assert.deepEqual(result.controlPlanePaths, ["scripts/sounding-line/ordinary.mjs"]);
});

test("Admiralty-style package scripts remain ordinary-admissible", () => {
  const base = { scripts: { "test:changed": "node scripts/sounding-line/ordinary.mjs --mode ordinary" } };
  const candidate = {
    scripts: {
      ...base.scripts,
      "admiralty:phase3:validate": "node scripts/admiralty/validate-phase3.mjs",
    },
  };
  assert.deepEqual(classifyChanges(["package.json", "src/admiralty/phase3.ts"]).controlPlanePaths, []);
  assert.deepEqual(packageAuthorityChanges(base, candidate), []);
});

test("Drydock-style declarative registrations remain ordinary-admissible and self-validate", () => {
  const changedPaths = [
    "package.json",
    "testing/contracts.json",
    "testing/impact-map.json",
    "testing/suites.json",
    "src/drydock/phase3.ts",
  ];
  assert.deepEqual(classifyChanges(changedPaths).controlPlanePaths, []);
  const commands = verificationCommands({
    mode: "ordinary",
    safetyPaths: [],
    lintPaths: [],
    selected: { unitTests: [], browserTests: [] },
    migrationRequired: false,
    migrationScripts: [],
    buildRequired: true,
    registrationValidationRequired: true,
  });
  assert.ok(
    commands.some(
      ([command, argumentsList]) =>
        command === process.execPath && argumentsList.join(" ") === "--test tests/sounding-line/ordinary.test.mjs",
    ),
  );
});

test("Confluence-style project guidance remains ordinary-admissible", () => {
  const result = classifyChanges([
    ".agents/confluence-workers.md",
    "package.json",
    "scripts/confluence/core.mjs",
    "tests/confluence/core.test.mjs",
  ]);
  assert.deepEqual(result.controlPlanePaths, []);
});

test("global authority paths remain release-only", () => {
  const paths = [
    "scripts/sounding-line/ordinary.mjs",
    ".github/workflows/sounding-line-ordinary.yml",
    "playwright.config.ts",
    "AGENTS.md",
    ".agents/testing-workflow.md",
    ".agents/context-workflow.md",
    ".agents/repository-rules.md",
    ".agents/validation-isolation.md",
  ];
  assert.deepEqual(classifyChanges(paths).controlPlanePaths, paths.sort());
});

test("Sounding Line package authority mutations remain release-only", () => {
  const base = {
    scripts: {
      "test:changed": "node scripts/sounding-line/ordinary.mjs --mode ordinary",
      "test:release": "node scripts/sounding-line/ordinary.mjs --mode release",
      "test:sounding-line": "node --test tests/sounding-line/ordinary.test.mjs",
      validate: "node scripts/sounding-line/ordinary.mjs --mode release",
    },
  };
  const candidate = {
    scripts: {
      ...base.scripts,
      "test:changed": "node scripts/not-sounding-line/ordinary.mjs",
      "test:release": "node scripts/not-sounding-line/release.mjs",
      validate: "node scripts/not-sounding-line/ordinary.mjs",
    },
  };
  assert.deepEqual(packageAuthorityChanges(base, candidate), ["test:changed", "test:release", "validate"]);
});

test("ordinary admission distinguishes the field candidates from release authority mutations", async () => {
  await withCandidate(
    {
      "package.json": `${JSON.stringify({
        ...basePackage,
        scripts: { ...basePackage.scripts, "admiralty:phase3:validate": "node scripts/admiralty/validate-phase3.mjs" },
      })}\n`,
      "src/admiralty/phase3.ts": "export const admiralty = true;\n",
    },
    async (fixture) => {
      await assert.doesNotReject(() => buildPlan({ ...fixture, mode: "ordinary" }));
    },
  );
  await withCandidate(
    {
      "package.json": `${JSON.stringify({
        ...basePackage,
        scripts: { ...basePackage.scripts, "drydock:phase3:validate": "node scripts/drydock/validate-phase3.mjs" },
      })}\n`,
      "testing/contracts.json": '{"contracts":["drydock"]}\n',
      "testing/impact-map.json": '{"impactMap":{"drydock":[]}}\n',
      "testing/suites.json": '{"suites":["drydock"]}\n',
      "src/drydock/phase3.ts": "export const drydock = true;\n",
    },
    async (fixture) => {
      const plan = await buildPlan({ ...fixture, mode: "ordinary" });
      assert.equal(plan.registrationValidationRequired, true);
      assert.ok(
        verificationCommands(plan).some(
          ([command, argumentsList]) => command === process.execPath && argumentsList[0] === "--test",
        ),
      );
    },
  );
  await withCandidate(
    {
      ".agents/confluence-workers.md": "# Confluence worker guidance\n",
      "package.json": `${JSON.stringify({
        ...basePackage,
        scripts: { ...basePackage.scripts, "confluence:validate": "node scripts/confluence/validate.mjs" },
      })}\n`,
      "scripts/confluence/validate.mjs": "export const confluence = true;\n",
      "tests/confluence/validate.test.mjs": "export {};\n",
    },
    async (fixture) => {
      await assert.doesNotReject(() => buildPlan({ ...fixture, mode: "ordinary" }));
    },
  );

  for (const [name, changes, expected] of [
    [
      "Sounding Line script",
      { "scripts/sounding-line/ordinary.mjs": "export {};\n" },
      "scripts/sounding-line/ordinary.mjs",
    ],
    ["workflow", { ".github/workflows/ordinary.yml": "name: ordinary\n" }, ".github/workflows/ordinary.yml"],
    ["generic browser runner", { "playwright.config.ts": "export default {};\n" }, "playwright.config.ts"],
    ["root authority", { "AGENTS.md": "# Authority\n" }, "AGENTS.md"],
    ["testing authority", { ".agents/testing-workflow.md": "# Testing\n" }, ".agents/testing-workflow.md"],
    [
      "protected package authority",
      {
        "package.json": `${JSON.stringify({
          ...basePackage,
          scripts: { ...basePackage.scripts, "test:changed": "node scripts/alternate.mjs" },
        })}\n`,
      },
      "package.json",
    ],
    ["unknown test registration", { "testing/unknown-registration.json": "{}\n" }, "testing/unknown-registration.json"],
  ]) {
    await withCandidate(changes, async (fixture) => {
      await assert.rejects(
        () => buildPlan({ ...fixture, mode: "ordinary" }),
        new RegExp(
          `SOUNDING_LINE_CONTROL_PLANE_CHANGE_REQUIRES_RELEASE_MODE:${expected.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}`,
        ),
        name,
      );
    });
  }

  await withCandidate({ "testing/contracts.json": "{ invalid json\n" }, async (fixture) => {
    await assert.rejects(
      () => buildPlan({ ...fixture, mode: "ordinary" }),
      /SOUNDING_LINE_INVALID_DECLARATIVE_REGISTRATION:testing\/contracts\.json/u,
    );
  });
});

test("ordinary selection finds Harborlight browser proof structurally", () => {
  const selection = selectAffectedTests({
    changedPaths: ["src/app/community/voyage-logs/[slug]/page.tsx"],
    unitTests: ["src/community/voyage-log-lifecycle.test.ts", "src/community/feed.test.ts", "src/auth/session.test.ts"],
    browserTests: ["tests/e2e/harborlight-phase3.spec.ts", "tests/e2e/access-gates.spec.ts"],
  });
  assert.deepEqual(selection.unitTests, ["src/community/voyage-log-lifecycle.test.ts"]);
  assert.deepEqual(selection.browserTests, ["tests/e2e/harborlight-phase3.spec.ts"]);
  assert.equal(selection.widened, false);
});

test("trusted browser provisioning follows the unchanged ordinary selection and fails closed", async () => {
  const zeroBrowserSelection = selectAffectedTests({
    changedPaths: ["Development_Docs/Features/guide.md"],
    unitTests: ["scripts/features/feature-catalog.test.ts"],
    browserTests: ["tests/e2e/harborlight-phase3.spec.ts"],
  });
  const selectionBeforeDecision = structuredClone(zeroBrowserSelection);
  assert.equal(browserProvisioningRequired(zeroBrowserSelection), false);
  assert.deepEqual(zeroBrowserSelection, selectionBeforeDecision);

  const selectionFor = (changedPaths, browserTests) =>
    selectAffectedTests({ changedPaths, unitTests: [], browserTests });
  const widenedBrowserSelection = selectionFor(
    ["src/unknown/candidate.ts"],
    ["tests/e2e/harborlight-phase3.spec.ts", "tests/e2e/access-gates.spec.ts"],
  );
  assert.equal(widenedBrowserSelection.widened, true);
  for (const [name, selection] of [
    [
      "direct browser proof",
      selectionFor(["tests/e2e/harborlight-phase3.spec.ts"], ["tests/e2e/harborlight-phase3.spec.ts"]),
    ],
    ["conservatively widened browser proof", widenedBrowserSelection],
    [
      "Tideglass dedicated harness",
      selectionFor(["tests/e2e/tideglass-phase3.spec.ts"], ["tests/e2e/tideglass-phase3.spec.ts"]),
    ],
    [
      "Admiralty Phase 2 dedicated harness",
      selectionFor(["tests/e2e/admiralty-phase2.spec.ts"], ["tests/e2e/admiralty-phase2.spec.ts"]),
    ],
    [
      "mixed browser proof",
      selectionFor(
        ["tests/e2e/admiralty-phase2.spec.ts", "tests/e2e/harborlight-phase3.spec.ts"],
        ["tests/e2e/admiralty-phase2.spec.ts", "tests/e2e/harborlight-phase3.spec.ts"],
      ),
    ],
  ]) {
    assert.equal(browserProvisioningRequired(selection), true, name);
  }
  assert.throws(() => browserProvisioningRequired({}), /SOUNDING_LINE_BROWSER_PROVISIONING_INDETERMINATE/u);
  assert.throws(() => browserProvisioningRequired(null), /SOUNDING_LINE_BROWSER_PROVISIONING_INDETERMINATE/u);

  await withCandidate({ "Development_Docs/Features/guide.md": "# Guide\n" }, async (fixture) => {
    const plan = await buildPlan({ ...fixture, mode: "ordinary" });
    assert.deepEqual(plan.selected.browserTests, []);
    assert.equal(plan.browserRequired, false);
  });
  await withCandidate(
    { "tests/e2e/harborlight-phase3.spec.ts": "test('browser proof', () => {});\n" },
    async (fixture) => {
      const plan = await buildPlan({ ...fixture, mode: "ordinary" });
      assert.deepEqual(plan.selected.browserTests, ["tests/e2e/harborlight-phase3.spec.ts"]);
      assert.equal(plan.browserRequired, true);
    },
  );
});

test("direct browser proof prevents unrelated browser suites from widening the candidate", () => {
  const selection = selectAffectedTests({
    changedPaths: ["src/app/community/voyage-logs/[slug]/page.tsx", "tests/e2e/harborlight-phase3.spec.ts"],
    unitTests: [],
    browserTests: [
      "tests/e2e/harborlight-phase2.spec.ts",
      "tests/e2e/harborlight-phase3.spec.ts",
      "tests/e2e/harborlight-phase4.spec.ts",
    ],
  });
  assert.deepEqual(selection.browserTests, ["tests/e2e/harborlight-phase3.spec.ts"]);
});

test("docs and catalog candidates keep directly changed static tests without selecting product browser suites", () => {
  const selection = selectAffectedTests({
    changedPaths: [
      "Development_Docs/Features/branch-complete/project-nightwatch-increment-a.json",
      "Development_Docs/Features/FEATURE_CATALOG.md",
      "Development_Docs/document-index.json",
      "scripts/features/feature-catalog.test.ts",
    ],
    unitTests: ["scripts/features/feature-catalog.test.ts", "src/community/feed.test.ts"],
    browserTests: [
      "tests/e2e/project-helm-phase1.spec.ts",
      "tests/e2e/project-one-voyage-phase2.spec.ts",
      "tests/e2e/project-shipwright-phase2.spec.ts",
    ],
  });
  assert.deepEqual(selection.unitTests, ["scripts/features/feature-catalog.test.ts"]);
  assert.deepEqual(selection.browserTests, []);
  assert.equal(selection.widened, false);
});

test("directly changed browser specs run even without a product path change", () => {
  const selection = selectAffectedTests({
    changedPaths: ["Development_Docs/Features/FEATURE_CATALOG.md", "tests/e2e/project-helm-phase1.spec.ts"],
    unitTests: [],
    browserTests: ["tests/e2e/project-helm-phase1.spec.ts", "tests/e2e/project-shipwright-phase2.spec.ts"],
  });
  assert.deepEqual(selection.browserTests, ["tests/e2e/project-helm-phase1.spec.ts"]);
});

test("non-product unknown impact skips browser proof while unknown product impact widens", () => {
  const ordinary = selectAffectedTests({
    changedPaths: ["misc/unknown-file.txt"],
    unitTests: ["src/a.test.ts", "src/b.test.ts"],
    browserTests: ["tests/e2e/a.spec.ts"],
  });
  assert.deepEqual(ordinary.unitTests, ["src/a.test.ts", "src/b.test.ts"]);
  assert.deepEqual(ordinary.browserTests, []);
  assert.equal(ordinary.widened, true);
  const productOrdinary = selectAffectedTests({
    changedPaths: ["src/unknown/candidate.ts"],
    unitTests: ["src/a.test.ts", "src/b.test.ts"],
    browserTests: ["tests/e2e/a.spec.ts", "tests/e2e/b.spec.ts"],
  });
  assert.deepEqual(productOrdinary.browserTests, ["tests/e2e/a.spec.ts", "tests/e2e/b.spec.ts"]);
  assert.equal(productOrdinary.widened, true);
});

test("release mode remains exhaustive", () => {
  const release = selectAffectedTests({
    changedPaths: [],
    unitTests: ["src/b.test.ts", "src/a.test.ts"],
    browserTests: ["tests/e2e/a.spec.ts"],
    mode: "release",
  });
  assert.deepEqual(release.unitTests, ["src/a.test.ts", "src/b.test.ts"]);
  assert.deepEqual(release.browserTests, ["tests/e2e/a.spec.ts"]);
});

test("candidate binding requires distinct exact commit and tree identities", () => {
  assert.doesNotThrow(() =>
    assertBinding({
      baseSha: "a".repeat(40),
      candidateSha: "b".repeat(40),
      baseTree: "c".repeat(40),
      candidateTree: "d".repeat(40),
    }),
  );
  assert.throws(() =>
    assertBinding({
      baseSha: "a".repeat(40),
      candidateSha: "a".repeat(40),
      baseTree: "c".repeat(40),
      candidateTree: "d".repeat(40),
    }),
  );
});

test("ordinary browser proof uses the installed Chromium project", () => {
  const browserCommands = verificationCommands({
    mode: "ordinary",
    safetyPaths: [],
    lintPaths: [],
    selected: { unitTests: [], browserTests: ["tests/e2e/harborlight-phase3.spec.ts"] },
    databaseUrl: "file:./.sounding-line-candidate.sqlite",
    migrationRequired: false,
    migrationScripts: [],
    buildRequired: false,
  });
  assert.deepEqual(browserCommands.at(-3), [
    process.execPath,
    ["scripts/sounding-line/sqlite-bootstrap.mjs", "--database-url", "file:./.sounding-line-candidate.sqlite"],
  ]);
  assert.deepEqual(browserCommands.at(-2), ["npx", ["--no-install", "tsx", "prisma/seed.ts"]]);
  const browserCommand = browserCommands.at(-1);
  assert.deepEqual(browserCommand, [
    "npx",
    ["--no-install", "playwright", "test", "tests/e2e/harborlight-phase3.spec.ts", "--project", "chromium"],
  ]);
});

test("Tideglass browser proof uses its dedicated isolated harness", () => {
  const candidateSha = "a".repeat(40);
  const browserCommands = verificationCommands({
    mode: "ordinary",
    candidateSha,
    safetyPaths: [],
    lintPaths: [],
    selected: {
      unitTests: [],
      browserTests: ["tests/e2e/tideglass-phase3.spec.ts", "tests/e2e/harborlight-phase3.spec.ts"],
    },
    databaseUrl: "file:./.sounding-line-candidate.sqlite",
    migrationRequired: false,
    migrationScripts: [],
    buildRequired: true,
  });
  const browserHarnessCommands = browserCommands.filter(
    ([command, argumentsList]) =>
      (command === process.execPath &&
        ["scripts/tideglass/run-phase3-journeys.mjs", "scripts/sounding-line/sqlite-bootstrap.mjs"].includes(
          argumentsList[0],
        )) ||
      (command === "npx" && (argumentsList.includes("playwright") || argumentsList.includes("prisma/seed.ts"))),
  );
  assert.deepEqual(browserHarnessCommands, [
    [process.execPath, ["scripts/tideglass/run-phase3-journeys.mjs"]],
    [
      process.execPath,
      ["scripts/sounding-line/sqlite-bootstrap.mjs", "--database-url", "file:./.sounding-line-candidate.sqlite"],
    ],
    ["npx", ["--no-install", "tsx", "prisma/seed.ts"]],
    ["npx", ["--no-install", "playwright", "test", "tests/e2e/harborlight-phase3.spec.ts", "--project", "chromium"]],
  ]);
  assert.deepEqual(
    verificationEnvironment(
      { candidateSha, buildRequired: true },
      process.execPath,
      ["scripts/tideglass/run-phase3-journeys.mjs"],
      {},
    ),
    {
      LOCALAPPDATA: ".",
      TIDEGLASS_PHASE3_TASK_ROOT: "ProjectTideglass/.sounding-line-tideglass-phase3-aaaaaaaaaaaa",
      TIDEGLASS_PHASE3_REUSE_BUILD: "1",
    },
  );
});

test("Admiralty Phase 2 browser proof uses its dedicated isolated harness", () => {
  const candidateSha = "b".repeat(40);
  const browserCommands = verificationCommands({
    mode: "ordinary",
    candidateSha,
    safetyPaths: [],
    lintPaths: [],
    selected: { unitTests: [], browserTests: ["tests/e2e/admiralty-phase2.spec.ts"] },
    databaseUrl: "file:./.sounding-line-candidate.sqlite",
    migrationRequired: false,
    migrationScripts: [],
    buildRequired: true,
  });
  assert.deepEqual(
    browserCommands.filter(([, argumentsList]) => argumentsList.includes("playwright")),
    [],
  );
  assert.deepEqual(browserCommands.at(-1), [process.execPath, ["scripts/admiralty/run-phase2-journeys.mjs"]]);
  assert.deepEqual(
    verificationEnvironment(
      { candidateSha, buildRequired: true },
      process.execPath,
      ["scripts/admiralty/run-phase2-journeys.mjs"],
      { ADMIRALTY_PHASE2_PRIVATE_CREDENTIALS: "not-used" },
    ),
    {
      LOCALAPPDATA: ".",
      ADMIRALTY_PHASE2_TASK_ROOT: "ProjectAdmiralty/.sounding-line-admiralty-phase2-bbbbbbbbbbbb",
      NEXT_DIST_DIR: ".next",
      ADMIRALTY_PHASE2_REUSE_BUILD: "1",
    },
  );
});

test("Admiralty Phase 2 leaves mixed generic browser proof selected exactly once", () => {
  const browserCommands = verificationCommands({
    mode: "ordinary",
    candidateSha: "c".repeat(40),
    safetyPaths: [],
    lintPaths: [],
    selected: {
      unitTests: [],
      browserTests: ["tests/e2e/admiralty-phase2.spec.ts", "tests/e2e/admiralty-phase3.spec.ts"],
    },
    databaseUrl: "file:./.sounding-line-candidate.sqlite",
    migrationRequired: false,
    migrationScripts: [],
    buildRequired: true,
  });
  const browserHarnessCommands = browserCommands.filter(
    ([command, argumentsList]) =>
      (command === process.execPath &&
        ["scripts/admiralty/run-phase2-journeys.mjs", "scripts/sounding-line/sqlite-bootstrap.mjs"].includes(
          argumentsList[0],
        )) ||
      (command === "npx" && (argumentsList.includes("playwright") || argumentsList.includes("prisma/seed.ts"))),
  );
  assert.deepEqual(browserHarnessCommands, [
    [process.execPath, ["scripts/admiralty/run-phase2-journeys.mjs"]],
    [
      process.execPath,
      ["scripts/sounding-line/sqlite-bootstrap.mjs", "--database-url", "file:./.sounding-line-candidate.sqlite"],
    ],
    ["npx", ["--no-install", "tsx", "prisma/seed.ts"]],
    ["npx", ["--no-install", "playwright", "test", "tests/e2e/admiralty-phase3.spec.ts", "--project", "chromium"]],
  ]);
});

test("Homeport Phase 4 and Phase 7 browser proof use portable dedicated fixtures", () => {
  const candidateSha = "e".repeat(40);
  const browserCommands = verificationCommands({
    mode: "ordinary",
    candidateSha,
    safetyPaths: [],
    lintPaths: [],
    selected: {
      unitTests: [],
      browserTests: [
        "tests/e2e/homeport-phase4.spec.ts",
        "tests/e2e/homeport-phase7.spec.ts",
        "tests/e2e/homeport-phase7-owner-correction-round3.spec.ts",
        "tests/e2e/harborlight-phase3.spec.ts",
      ],
    },
    databaseUrl: "file:./.sounding-line-eeeeeeeeeeee.sqlite",
    migrationRequired: false,
    migrationScripts: [],
    buildRequired: true,
  });
  assert.deepEqual(
    browserCommands.filter(
      ([command, argumentsList]) => command === process.execPath || argumentsList.includes("playwright"),
    ),
    [
      [
        process.execPath,
        ["scripts/sounding-line/sqlite-bootstrap.mjs", "--database-url", "file:./.sounding-line-eeeeeeeeeeee.sqlite"],
      ],
      [process.execPath, ["scripts/homeport/run-phase4-e2e.mjs"]],
      [process.execPath, ["scripts/homeport/prepare-phase7-fixture.mjs"]],
      [process.execPath, ["scripts/homeport/run-phase7-journeys.mjs"]],
      [process.execPath, ["scripts/homeport/prepare-phase7-owner-correction-round3-fixture.mjs"]],
      [process.execPath, ["scripts/homeport/run-phase7-owner-correction-round3-journeys.mjs"]],
      ["npx", ["--no-install", "playwright", "test", "tests/e2e/harborlight-phase3.spec.ts", "--project", "chromium"]],
    ],
  );
  assert.deepEqual(
    verificationEnvironment(
      { candidateSha, databaseUrl: "file:./.sounding-line-eeeeeeeeeeee.sqlite", buildRequired: true },
      process.execPath,
      ["scripts/homeport/run-phase7-journeys.mjs"],
      {},
    ),
    {
      HOMEPORT_SOUNDING_LINE_TASK_ROOT: "1",
      HOMEPORT_PHASE4_TASK_ROOT: "artifacts/sounding-line/homeport-phase4-eeeeeeeeeeee",
      HOMEPORT_PHASE4_SOURCE_DATABASE: "prisma/.sounding-line-eeeeeeeeeeee.sqlite",
      HOMEPORT_PHASE4_EVIDENCE_ROOT: "artifacts/sounding-line/homeport-phase4-eeeeeeeeeeee/evidence",
      HOMEPORT_PHASE4_REUSE_BUILD: "1",
      HOMEPORT_PHASE7_TASK_ROOT: "artifacts/sounding-line/homeport-phase7-eeeeeeeeeeee",
      HOMEPORT_PHASE7_SOURCE_DATABASE: "prisma/.sounding-line-eeeeeeeeeeee.sqlite",
      HOMEPORT_PHASE7_ORIGINAL_TASK_ROOT: "artifacts/sounding-line/homeport-phase7-eeeeeeeeeeee",
      HOMEPORT_PHASE7_ROUND1_TASK_ROOT: "artifacts/sounding-line/homeport-phase7-round1-eeeeeeeeeeee",
      HOMEPORT_PHASE7_ROUND2_TASK_ROOT: "artifacts/sounding-line/homeport-phase7-round2-eeeeeeeeeeee",
      HOMEPORT_PHASE7_ROUND3_TASK_ROOT: "artifacts/sounding-line/homeport-phase7-round3-eeeeeeeeeeee",
      HOMEPORT_PHASE7_PATCH_A_TASK_ROOT: "artifacts/sounding-line/homeport-phase7-patch-a-eeeeeeeeeeee",
    },
  );
});

test("Homeport Sounding Line roots reject invalid source evidence before execution", () => {
  const environment = {
    ...process.env,
    HOMEPORT_SOUNDING_LINE_TASK_ROOT: "1",
    HOMEPORT_PHASE4_TASK_ROOT: "artifacts/sounding-line/homeport-negative-phase4",
    HOMEPORT_PHASE4_SOURCE_DATABASE: "./developer-local.sqlite",
    HOMEPORT_PHASE7_TASK_ROOT: "artifacts/sounding-line/homeport-negative-phase7",
    HOMEPORT_PHASE7_SOURCE_DATABASE: "./developer-local.sqlite",
  };
  assert.throws(
    () =>
      execFileSync(process.execPath, ["scripts/homeport/run-phase4-e2e.mjs"], {
        env: environment,
        encoding: "utf8",
        stdio: "pipe",
      }),
    /Homeport Phase 4 refuses this build database/u,
  );
  assert.throws(
    () =>
      execFileSync(process.execPath, ["scripts/homeport/prepare-phase7-fixture.mjs"], {
        env: environment,
        encoding: "utf8",
        stdio: "pipe",
      }),
    /HOMEPORT_PHASE7_SOURCE_DATABASE_REFUSED/u,
  );
});

test("Admiralty Phase 2 dedicated harness failures fail verification normally", () => {
  const plan = {
    mode: "ordinary",
    candidateSha: "d".repeat(40),
    safetyPaths: [],
    lintPaths: [],
    selected: { unitTests: [], browserTests: ["tests/e2e/admiralty-phase2.spec.ts"] },
    databaseUrl: "file:./.sounding-line-candidate.sqlite",
    migrationRequired: false,
    migrationScripts: [],
    buildRequired: false,
  };
  const calls = [];
  assert.throws(
    () =>
      runVerificationCommands(".", plan, (_root, command, argumentsList) => {
        calls.push([command, argumentsList]);
        if (argumentsList[0] === "scripts/admiralty/run-phase2-journeys.mjs")
          throw new Error("ADMIRALTY_HARNESS_FAILED");
      }),
    /ADMIRALTY_HARNESS_FAILED/u,
  );
  assert.deepEqual(calls.at(-1), [process.execPath, ["scripts/admiralty/run-phase2-journeys.mjs"]]);
});

test("SQLite bootstrap preserves quoted semicolons while ignoring migration comments", () => {
  assert.deepEqual(
    splitMigrationStatements("-- comment\nCREATE TABLE item (value TEXT);\nINSERT INTO item VALUES ('a;b');"),
    ["CREATE TABLE item (value TEXT)", "INSERT INTO item VALUES ('a;b')"],
  );
});

test("migration rehearsal changes receive schema validation", () => {
  assert.equal(
    requiresMigrationValidation({ changedPaths: ["scripts/rehearse-harborlight-phase3-migrations.ts"] }),
    true,
  );
});

test("database verification is candidate-isolated when the environment has no URL", () => {
  const databaseUrl = soundingLineDatabaseUrl("a".repeat(40));
  assert.equal(databaseUrl, "file:./.sounding-line-aaaaaaaaaaaa.sqlite");
  assert.deepEqual(verificationEnvironment({ databaseUrl }, "npx", ["--no-install", "prisma", "validate"], {}), {
    DATABASE_URL: databaseUrl,
  });
  assert.deepEqual(verificationEnvironment({ databaseUrl }, "npx", ["--no-install", "tsx", "prisma/seed.ts"], {}), {
    DATABASE_URL: databaseUrl,
  });
});

test("changed migration rehearsals run as focused migration proof", () => {
  const commands = verificationCommands({
    mode: "ordinary",
    safetyPaths: [],
    lintPaths: [],
    selected: { unitTests: [], browserTests: [] },
    migrationRequired: true,
    migrationScripts: ["scripts/rehearse-harborlight-phase3-migrations.ts"],
    buildRequired: false,
  });
  assert.ok(
    commands.some(
      ([command, argumentsList]) =>
        command === "npx" && argumentsList.at(-1) === "scripts/rehearse-harborlight-phase3-migrations.ts",
    ),
  );
});

test("application source changes receive a production build", () => {
  assert.equal(requiresBuild({ changedPaths: ["src/app/community/voyage-logs/[slug]/page.tsx"] }), true);
  assert.equal(requiresBuild({ changedPaths: ["package-lock.json"] }), true);
});

test("generic browser proof builds before the production server starts", async () => {
  await withCandidate(
    { "tests/e2e/project-helm-phase1.spec.ts": "test('browser proof', () => {});\n" },
    async (fixture) => {
      const plan = await buildPlan({ ...fixture, mode: "ordinary" });
      assert.deepEqual(plan.selected.browserTests, ["tests/e2e/project-helm-phase1.spec.ts"]);
      assert.equal(plan.browserRequired, true);
      assert.equal(plan.buildRequired, true);
    },
  );
});

test("generic browser configuration starts the built server without webpack dev", () => {
  const configuration = readFileSync("playwright.config.ts", "utf8");
  assert.match(configuration, /next start/u);
  assert.doesNotMatch(configuration, /next dev/u);
});

test("ordinary admission has no orchestration or generated-state prerequisites", () => {
  const scripts = JSON.parse(readFileSync("package.json", "utf8")).scripts;
  const workflowNames = readdirSync(".github/workflows").sort();
  assert.deepEqual(workflowNames, [
    "sounding-line-control-plane.yml",
    "sounding-line-exhaustive-release.yml",
    "sounding-line-ordinary.yml",
  ]);
  assert.equal(scripts.test, "vitest run");
  for (const key of Object.keys(scripts))
    assert.doesNotMatch(key, /nightwatch|bosun|mainline|maintenance|project-trim/u);
  const ordinaryWorkflow = readFileSync(".github/workflows/sounding-line-ordinary.yml", "utf8");
  assert.match(ordinaryWorkflow, /pull_request_target/u);
  assert.match(ordinaryWorkflow, /Sounding Line \/ Mainline Decision/u);
  assert.doesNotMatch(ordinaryWorkflow, /nightwatch|bosun|baseline|deepwater|feature catalog|P34|maintenance|train/iu);
  const releaseWorkflow = readFileSync(".github/workflows/sounding-line-exhaustive-release.yml", "utf8");
  assert.match(releaseWorkflow, /--mode release/u);
  const controlPlaneWorkflow = readFileSync(".github/workflows/sounding-line-control-plane.yml", "utf8");
  assert.match(controlPlaneWorkflow, /workflow_dispatch/u);
  assert.match(controlPlaneWorkflow, /Sounding Line \/ Mainline Decision/u);
  assert.doesNotMatch(
    controlPlaneWorkflow,
    /pull_request_target|nightwatch|bosun|baseline|deepwater|feature catalog|P34|maintenance|train/iu,
  );
});

test("trusted PR routing produces one strict decision for ordinary and control-plane candidates", () => {
  const ordinaryWorkflow = readFileSync(".github/workflows/sounding-line-ordinary.yml", "utf8");
  assert.match(ordinaryWorkflow, /pull_request_target/u);
  assert.match(ordinaryWorkflow, /path: authority/u);
  assert.match(ordinaryWorkflow, /Route through trusted protected-main classification/u);
  assert.match(ordinaryWorkflow, /root: "\.\.\/candidate"/u);
  assert.match(ordinaryWorkflow, /mode: "ordinary"/u);
  assert.match(ordinaryWorkflow, /kind=ordinary/u);
  assert.match(ordinaryWorkflow, /browser_required=\$\{plan\.browserRequired\}/u);
  assert.match(ordinaryWorkflow, /kind=control-plane/u);
  assert.match(
    ordinaryWorkflow,
    /steps\.route\.outputs\.kind == 'ordinary' && steps\.route\.outputs\.browser_required == 'true'/u,
  );
  assert.match(ordinaryWorkflow, /steps\.route\.outputs\.kind == 'ordinary'/u);
  assert.match(ordinaryWorkflow, /steps\.route\.outputs\.kind == 'control-plane'/u);
  assert.match(ordinaryWorkflow, /SOUNDING_LINE_CONTROL_PLANE_CHANGE_REQUIRES_RELEASE_MODE/u);
  assert.match(ordinaryWorkflow, /git merge-base --is-ancestor/u);
  assert.equal((ordinaryWorkflow.match(/name: Sounding Line \/ Mainline Decision/gu) ?? []).length, 1);
});

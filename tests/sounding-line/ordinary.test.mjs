import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { EventEmitter } from "node:events";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createServer as createTcpServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { splitMigrationStatements } from "../../scripts/sounding-line/sqlite-bootstrap.mjs";
import {
  assertBrowserAuthorityTopology,
  browserRuntimeReceipt,
  runBrowserAuthority,
  stripTaskOwnedCookieSecurity,
  taskOwnedCookieAdapterRequired,
} from "../../scripts/sounding-line/browser-authority.mjs";
import {
  assertBinding,
  browserProvisioningRequired,
  buildPlan,
  classifyChanges,
  packageAuthorityChanges,
  requiresMigrationValidation,
  requiresBuild,
  runReconciledVerification,
  resolveHomeportFixturePreparers,
  runVerificationCommands,
  sanitizedFailureCode,
  selectAffectedTests,
  soundingLineDatabaseUrl,
  verificationEnvironment,
  verificationCommands,
} from "../../scripts/sounding-line/ordinary.mjs";
import { resolveBrowserSuiteDispatches } from "../../scripts/sounding-line/browser-suite-profiles.mjs";

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

function commit(root, message) {
  git(root, ["add", "."]);
  git(root, ["commit", "--quiet", "-m", message]);
  return git(root, ["rev-parse", "HEAD"]);
}

function evidenceFixture() {
  const root = mkdtempSync(path.join(tmpdir(), "sounding-line-evidence-"));
  const files = {
    "package.json": `${JSON.stringify(basePackage, null, 2)}\n`,
    "package-lock.json": `${JSON.stringify({ name: "evidence-fixture", lockfileVersion: 3, packages: {} }, null, 2)}\n`,
    "tsconfig.json": '{"compilerOptions":{"baseUrl":".","paths":{"@/*":["src/*"]}}}\n',
    "next.config.ts": "export default {};\n",
    "postcss.config.mjs": "export default {};\n",
    "playwright.config.ts": "export default {};\n",
    "vitest.config.ts": "export default {};\n",
    "eslint.config.mjs": "export default [];\n",
    ".prettierrc.json": "{}\n",
    ".prettierignore": "node_modules\n",
    ".nvmrc": "22\n",
    "testing/contracts.json": "{}\n",
    "testing/impact-map.json": "{}\n",
    "testing/suites.json": "{}\n",
    "src/product.ts": "export const product = 'base';\n",
    "src/product.test.ts": "import { product } from './product';\nvoid product;\n",
    "tests/e2e/product.spec.ts": "export const browserProof = 'base';\n",
    "Development_Docs/guide.md": "# Guide\n",
    "scripts/sounding-line/sqlite-bootstrap.mjs": "export {};\n",
    "scripts/sounding-line/browser-authority.mjs": "export {};\n",
    "prisma/seed.ts": "export {};\n",
  };
  for (const [file, contents] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), contents);
  }
  git(root, ["init", "--initial-branch=main", "--quiet"]);
  git(root, ["config", "core.autocrlf", "false"]);
  git(root, ["config", "user.email", "evidence@example.invalid"]);
  git(root, ["config", "user.name", "Evidence Fixture"]);
  const baseSha = commit(root, "base");
  return { root, baseSha };
}

async function withEvidenceFixture(assertion) {
  const fixture = evidenceFixture();
  try {
    await assertion(fixture);
  } finally {
    rmSync(fixture.root, { force: true, recursive: true });
  }
}

async function runReconciliation(root, plan, commandDelayMs = 0) {
  const calls = [];
  const result = await runReconciledVerification(root, plan, (_root, command, argumentsList) => {
    calls.push([command, argumentsList]);
    if (commandDelayMs)
      execFileSync(process.execPath, [
        "-e",
        `Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ${commandDelayMs});`,
      ]);
  });
  return { calls, result };
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
  assert.deepEqual(result.productPaths, ["src/app/community/voyage-logs/[slug]/page.tsx"]);
  assert.equal(result.candidateClassification, "PRODUCT_AND_CONTROL_PLANE_MIXED");
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
    "tests/sounding-line/ordinary.test.mjs",
    "AGENTS.md",
    ".agents/testing-workflow.md",
    ".agents/context-workflow.md",
    ".agents/repository-rules.md",
    ".agents/validation-isolation.md",
  ];
  assert.deepEqual(classifyChanges(paths).controlPlanePaths, paths.sort());
  assert.equal(classifyChanges(paths).candidateClassification, "CONTROL_PLANE");
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

  await withCandidate(
    {
      "src/product.ts": "export const product = false;\n",
      "scripts/sounding-line/runtime.mjs": "export const controller = true;\n",
    },
    async (fixture) => {
      await assert.rejects(
        () => buildPlan({ ...fixture, mode: "ordinary" }),
        /SOUNDING_LINE_PRODUCT_AND_CONTROL_PLANE_MIXED:product=src\/product\.ts;control-plane=scripts\/sounding-line\/runtime\.mjs/u,
      );
    },
  );
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

test("ordinary selection ignores documentation vocabulary when scoping product browser proof", () => {
  const selection = selectAffectedTests({
    changedPaths: [
      "src/admiralty/bridgewatch-gateway.ts",
      "Development_Docs/Project_Bridgewatch_v2.0_Light_Mission_Control_Test_Plan.md",
      "Development_Docs/Features/branch-complete/project-bridgewatch-v2-light-mission-control.json",
    ],
    unitTests: ["src/admiralty/bridgewatch-gateway.test.ts"],
    browserTests: [
      "tests/e2e/admiralty-phase1.spec.ts",
      "tests/e2e/admiralty-phase2.spec.ts",
      "tests/e2e/harborlight-phase2.spec.ts",
      "tests/e2e/phase3-player-event-matrix.spec.ts",
      "tests/e2e/project-one-voyage-phase2.spec.ts",
      "tests/e2e/project-true-north.spec.ts",
    ],
  });
  assert.deepEqual(selection.browserTests, [
    "tests/e2e/admiralty-phase1.spec.ts",
    "tests/e2e/admiralty-phase2.spec.ts",
  ]);
  assert.deepEqual(selection.unitTests, ["src/admiralty/bridgewatch-gateway.test.ts"]);
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
      "tests/e2e/project-helm-phase1.spec.ts",
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
    selected: { unitTests: [], browserTests: ["tests/e2e/project-helm-phase1.spec.ts"] },
    databaseUrl: "file:./.sounding-line-candidate.sqlite",
    migrationRequired: false,
    migrationScripts: [],
    buildRequired: false,
  });
  assert.deepEqual(browserCommands.at(-4), [
    "npx",
    ["--no-install", "prisma", "generate", "--schema", "prisma/schema.sqlite.prisma"],
  ]);
  assert.deepEqual(browserCommands.at(-3), [
    process.execPath,
    ["scripts/sounding-line/sqlite-bootstrap.mjs", "--database-url", "file:./.sounding-line-candidate.sqlite"],
  ]);
  assert.deepEqual(browserCommands.at(-2), ["npx", ["--no-install", "tsx", "prisma/seed.ts"]]);
  const browserCommand = browserCommands.at(-1);
  assert.deepEqual(browserCommand, [
    process.execPath,
    [
      "scripts/sounding-line/browser-authority.mjs",
      "--",
      "tests/e2e/project-helm-phase1.spec.ts",
      "--project",
      "chromium",
    ],
  ]);
  assert.deepEqual(
    verificationEnvironment(
      { databaseUrl: "file:./.sounding-line-candidate.sqlite" },
      process.execPath,
      ["scripts/sounding-line/browser-authority.mjs", "--", "tests/e2e/project-helm-phase1.spec.ts"],
      {},
    ),
    { DATABASE_URL: "file:./.sounding-line-candidate.sqlite" },
  );
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
        ["scripts/tideglass/run-phase3-journeys.mjs", "scripts/sounding-line/run-browser-suite.mjs"].includes(
          argumentsList[0],
        )) ||
      false,
  );
  assert.deepEqual(browserHarnessCommands, [
    [process.execPath, ["scripts/tideglass/run-phase3-journeys.mjs"]],
    [
      process.execPath,
      [
        "scripts/sounding-line/run-browser-suite.mjs",
        "--profile",
        "harborlight-phase3",
        "--candidate",
        candidateSha,
        "--database-url",
        "file:./artifacts/sounding-line/harborlight-phase3-aaaaaaaaaaaa/validation-isolated-19700101-000000000-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.db",
        "--",
        "tests/e2e/harborlight-phase3.spec.ts",
      ],
    ],
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
      { ADMIRALTY_PHASE2_PRIVATE_CREDENTIALS: "not-used", LOCALAPPDATA: "C:/validation-runtime" },
    ),
    {
      LOCALAPPDATA: ".",
      ADMIRALTY_PHASE2_TASK_ROOT: "ProjectAdmiralty/.sounding-line-admiralty-phase2-bbbbbbbbbbbb",
      NEXT_DIST_DIR: ".next",
      ADMIRALTY_PHASE2_REUSE_BUILD: "1",
      PLAYWRIGHT_BROWSERS_PATH: path.join("C:/validation-runtime", "ms-playwright"),
    },
  );
});

test("Admiralty Phase 1 browser proof uses its dedicated fixture and build harness", () => {
  const candidateSha = "a".repeat(40);
  const browserCommands = verificationCommands({
    mode: "ordinary",
    candidateSha,
    safetyPaths: [],
    lintPaths: [],
    selected: { unitTests: [], browserTests: ["tests/e2e/admiralty-phase1.spec.ts"] },
    databaseUrl: "file:./.sounding-line-candidate.sqlite",
    migrationRequired: false,
    migrationScripts: [],
    buildRequired: true,
  });
  assert.deepEqual(browserCommands.at(-1), [process.execPath, ["scripts/admiralty/run-phase1-journeys.mjs"]]);
  assert.deepEqual(
    verificationEnvironment({ candidateSha }, process.execPath, ["scripts/admiralty/run-phase1-journeys.mjs"], {
      LOCALAPPDATA: "C:/validation-runtime",
    }),
    {
      LOCALAPPDATA: "artifacts/sounding-line",
      ADMIRALTY_PHASE1_TASK_ROOT:
        "artifacts/sounding-line/ProjectAdmiralty/.sounding-line-admiralty-phase1-aaaaaaaaaaaa",
      NEXT_DIST_DIR: ".next",
      PLAYWRIGHT_BROWSERS_PATH: path.join("C:/validation-runtime", "ms-playwright"),
    },
  );
});

test("Admiralty Phase 2 and Phase 3 use their dedicated fixture and build harnesses", () => {
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
      command === process.execPath &&
      ["scripts/admiralty/run-phase2-journeys.mjs", "tests/admiralty/phase3/run-journeys.mjs"].includes(
        argumentsList[0],
      ),
  );
  assert.deepEqual(browserHarnessCommands, [
    [process.execPath, ["scripts/admiralty/run-phase2-journeys.mjs"]],
    [process.execPath, ["tests/admiralty/phase3/run-journeys.mjs"]],
  ]);
  assert.deepEqual(
    verificationEnvironment(
      { candidateSha: "c".repeat(40), buildRequired: true },
      process.execPath,
      ["tests/admiralty/phase3/run-journeys.mjs"],
      { LOCALAPPDATA: "C:/validation-runtime" },
    ),
    {
      LOCALAPPDATA: "artifacts/sounding-line",
      ADMIRALTY_PHASE3_TASK_ROOT:
        "artifacts/sounding-line/ProjectAdmiralty/.sounding-line-admiralty-phase3-cccccccccccc",
      NEXT_DIST_DIR: ".next",
      ADMIRALTY_PHASE3_REUSE_BUILD: "1",
      PLAYWRIGHT_BROWSERS_PATH: path.join("C:/validation-runtime", "ms-playwright"),
    },
  );
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
    browserCommands.filter(([command]) => command === process.execPath),
    [
      [
        process.execPath,
        ["scripts/sounding-line/sqlite-bootstrap.mjs", "--database-url", "file:./.sounding-line-eeeeeeeeeeee.sqlite"],
      ],
      [process.execPath, ["scripts/homeport/run-phase4-e2e.mjs"]],
      [process.execPath, ["scripts/homeport/prepare-phase7-fixture.mjs"]],
      [process.execPath, ["scripts/homeport/prepare-phase7-owner-correction-round1-fixture.mjs"]],
      [process.execPath, ["scripts/homeport/prepare-phase7-owner-correction-round2-fixture.mjs"]],
      [process.execPath, ["scripts/homeport/prepare-phase7-owner-correction-round3-fixture.mjs"]],
      [process.execPath, ["scripts/homeport/run-phase7-journeys.mjs"]],
      [process.execPath, ["scripts/homeport/run-phase7-owner-correction-round3-journeys.mjs"]],
      [
        process.execPath,
        [
          "scripts/sounding-line/run-browser-suite.mjs",
          "--profile",
          "harborlight-phase3",
          "--candidate",
          candidateSha,
          "--database-url",
          "file:./artifacts/sounding-line/harborlight-phase3-eeeeeeeeeeee/validation-isolated-19700101-000000000-eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee.db",
          "--",
          "tests/e2e/harborlight-phase3.spec.ts",
        ],
      ],
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

test("Homeport fixture preflight provisions only declared journey dependencies", () => {
  const round2 = "tests/e2e/homeport-phase7-owner-correction-round2.spec.ts";
  assert.deepEqual(resolveHomeportFixturePreparers([round2], { HOMEPORT_PHASE7_CORRECTION_JOURNEYS: "A" }), [
    "scripts/homeport/prepare-phase7-owner-correction-round2-fixture.mjs",
  ]);
  assert.deepEqual(resolveHomeportFixturePreparers([round2], { HOMEPORT_PHASE7_CORRECTION_JOURNEYS: "W" }), [
    "scripts/homeport/prepare-phase7-fixture.mjs",
    "scripts/homeport/prepare-phase7-owner-correction-round1-fixture.mjs",
    "scripts/homeport/prepare-phase7-owner-correction-round2-fixture.mjs",
  ]);
});

test("Homeport correction commands receive their dedicated task roots", () => {
  const candidateSha = "f".repeat(40);
  const plan = { candidateSha, databaseUrl: "file:./.sounding-line-ffffffffffff.sqlite" };
  for (const [script, lane] of [
    ["scripts/homeport/prepare-phase7-owner-correction-round1-fixture.mjs", "phase7-round1"],
    ["scripts/homeport/run-phase7-owner-correction-round1-journeys.mjs", "phase7-round1"],
    ["scripts/homeport/prepare-phase7-owner-correction-round2-fixture.mjs", "phase7-round2"],
    ["scripts/homeport/run-phase7-owner-correction-round2-journeys.mjs", "phase7-round2"],
    ["scripts/homeport/prepare-phase7-owner-correction-round3-fixture.mjs", "phase7-round3"],
    ["scripts/homeport/run-phase7-owner-correction-round3-journeys.mjs", "phase7-round3"],
    ["scripts/homeport/prepare-phase7-owner-correction-round3-patch-a-fixture.mjs", "phase7-patch-a"],
    ["scripts/homeport/run-phase7-owner-correction-round3-patch-a-journeys.mjs", "phase7-patch-a"],
  ]) {
    assert.equal(
      verificationEnvironment(plan, process.execPath, [script], {}).HOMEPORT_PHASE7_TASK_ROOT,
      `artifacts/sounding-line/homeport-${lane}-ffffffffffff`,
    );
  }
});

test("fixture-aware suite dispatch groups established fixture contracts without credential bleed", () => {
  const dispatches = resolveBrowserSuiteDispatches([
    "tests/e2e/admiralty-phase1.spec.ts",
    "tests/e2e/harborlight-phase2.spec.ts",
    "tests/e2e/harborlight-phase3.spec.ts",
    "tests/e2e/phase3-accessibility-viewports.spec.ts",
    "tests/e2e/phase3-lifecycle-extended.spec.ts",
    "tests/e2e/phase3-lifecycle.spec.ts",
    "tests/e2e/project-helm-phase1.spec.ts",
  ]);
  assert.deepEqual(
    dispatches.map(({ id, browserTests }) => [id, browserTests]),
    [
      ["admiralty-phase1", ["tests/e2e/admiralty-phase1.spec.ts"]],
      ["harborlight-phase2", ["tests/e2e/harborlight-phase2.spec.ts"]],
      ["harborlight-phase3", ["tests/e2e/harborlight-phase3.spec.ts"]],
      [
        "lanternwake-phase3",
        [
          "tests/e2e/phase3-accessibility-viewports.spec.ts",
          "tests/e2e/phase3-lifecycle-extended.spec.ts",
          "tests/e2e/phase3-lifecycle.spec.ts",
        ],
      ],
      ["generic", ["tests/e2e/project-helm-phase1.spec.ts"]],
    ],
  );
  assert.deepEqual(dispatches.find(({ id }) => id === "lanternwake-phase3").fixtureArguments, [
    "tests/e2e/phase3-readonly-setup.setup.ts",
  ]);
  assert.equal(dispatches.find(({ id }) => id === "lanternwake-phase3").fixtureProject, "phase3-readonly-setup");
  assert.equal(dispatches.find(({ id }) => id === "lanternwake-phase3").cookieAdapter, "isolated-loopback");
  const phase3Preparers = dispatches.find(({ id }) => id === "lanternwake-phase3").preparers;
  assert.equal(phase3Preparers.filter(({ script }) => script === "scripts/migrate-legacy-companion.ts").length, 2);
  assert.equal(
    new Set(phase3Preparers.map((preparer) => JSON.stringify(preparer))).size,
    phase3Preparers.length,
    "each declared preparer command executes once per profile dispatch",
  );
  assert.deepEqual(phase3Preparers.at(-1), {
    runtime: "node",
    script: "scripts/sounding-line/prepare-validation-isolation.mjs",
  });
  const harborlight = dispatches.find(({ id }) => id === "harborlight-phase2");
  assert.equal(harborlight.validationIsolation, true);
  assert.equal(harborlight.cookieAdapter, "isolated-loopback");
  assert.deepEqual(harborlight.environment, {
    COMMUNITY_BINARY_SCANNER_PROVIDER: "synthetic-test",
    FOREVER_VALIDATION_NODE_ENV: "test",
  });
  assert.deepEqual(harborlight.preparers, [
    { runtime: "node", script: "scripts/sounding-line/prepare-validation-isolation.mjs" },
    { runtime: "tsx", script: "scripts/sounding-line/prepare-harborlight-fixture.ts" },
  ]);
  const admiralty = dispatches.find(({ id }) => id === "admiralty-phase1");
  assert.equal(admiralty.dedicatedRunner, "scripts/admiralty/run-phase1-journeys.mjs");
  assert.equal(admiralty.preparers, undefined);
  assert.equal(new Set(harborlight.preparers.map(({ script }) => script)).size, harborlight.preparers.length);
  assert.equal(dispatches.find(({ id }) => id === "generic").environment, undefined);
});

test("task-owned cookie adaptation is nonce-gated to the isolated Phase 3 runtime", () => {
  const guardedEnvironment = {
    SOUNDING_LINE_TASK_OWNED_HTTP: "1",
    FOREVER_VALIDATION_ISOLATION: "1",
    FOREVER_VALIDATION_PRODUCTION_IDENTITY: "1",
    FOREVER_VALIDATION_NONCE_HASH: "a".repeat(64),
  };
  assert.equal(taskOwnedCookieAdapterRequired({}), false);
  assert.equal(taskOwnedCookieAdapterRequired({ ...guardedEnvironment, FOREVER_VALIDATION_ISOLATION: "0" }), false);
  assert.equal(
    taskOwnedCookieAdapterRequired({ ...guardedEnvironment, FOREVER_VALIDATION_NONCE_HASH: "unsafe" }),
    false,
  );
  assert.equal(taskOwnedCookieAdapterRequired(guardedEnvironment), true);
  assert.equal(
    stripTaskOwnedCookieSecurity("session=value; Path=/; Secure; HttpOnly; SameSite=Lax"),
    "session=value; Path=/; HttpOnly; SameSite=Lax",
  );
});

test("an unresolved fixture profile fails closed before browser authority is launched", () => {
  const result = spawnSync(
    process.execPath,
    [
      "scripts/sounding-line/run-browser-suite.mjs",
      "--profile",
      "not-a-governed-profile",
      "--candidate",
      "a".repeat(40),
      "--database-url",
      "file:./.sounding-line-fixture-contract-negative.sqlite",
      "--",
      "tests/e2e/project-helm-phase1.spec.ts",
    ],
    { cwd: process.cwd(), encoding: "utf8", windowsHide: true },
  );
  assert.notEqual(result.status, 0);
  assert.match(
    `${result.stdout}\n${result.stderr}`,
    /SOUNDING_LINE_SUITE_FIXTURE_CONTRACT_UNSATISFIED:INVALID_PROFILE_INVOCATION/u,
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
  assert.doesNotThrow(() =>
    assertBrowserAuthorityTopology({
      serverMode: "production",
      productionOutputDirectory: ".next",
      serverOutputDirectory: ".next",
    }),
  );
  assert.throws(
    () =>
      assertBrowserAuthorityTopology({
        serverMode: "development",
        productionOutputDirectory: ".next",
        serverOutputDirectory: ".next",
        developmentOutputDirectory: ".next",
      }),
    /SOUNDING_LINE_INVALID_SERVER_TOPOLOGY/u,
  );
});

function fakeChild() {
  const child = new EventEmitter();
  child.exitCode = null;
  child.signalCode = null;
  child.kill = () => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    child.exitCode = 0;
    queueMicrotask(() => child.emit("exit", 0, null));
  };
  return child;
}

async function unusedPort() {
  const server = createTcpServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  await new Promise((resolve) => server.close(resolve));
  return address.port;
}

async function portCanBeReclaimed(port) {
  const server = createTcpServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  await new Promise((resolve) => server.close(resolve));
}

test("dead governed browser server interrupts the browser immediately with infrastructure attribution", async () => {
  const server = fakeChild();
  const browser = fakeChild();
  let launches = 0;
  const receipt = await runBrowserAuthority({
    root: process.cwd(),
    browserArguments: ["tests/e2e/harborlight-phase3.spec.ts", "--project", "chromium"],
    port: 31991,
    ready: async () => true,
    sleep: async () => {},
    launch: () => {
      launches += 1;
      if (launches === 1) return server;
      queueMicrotask(() => {
        server.exitCode = 1;
        server.emit("exit", 1, null);
      });
      return browser;
    },
  });
  assert.equal(receipt.failureCategory, "INFRASTRUCTURE_RUNTIME_FAILURE");
  assert.equal(receipt.failureCode, "SOUNDING_LINE_INFRASTRUCTURE_RUNTIME_FAILURE:SERVER_EXITED");
  assert.equal(browser.exitCode, 0);
  assert.equal(receipt.topology, "BUILT_SERVER_TASK_OWNED_RUNTIME");
  assert.ok(receipt.timings.infrastructureFailureWaitMs < 600_000);
});

test("fixture product failure stops product browser execution with truthful attribution", async () => {
  const server = fakeChild();
  const fixture = fakeChild();
  let launches = 0;
  let fixtureCommand;
  const receipt = await runBrowserAuthority({
    root: process.cwd(),
    fixtureArguments: ["tests/e2e/phase3-readonly-setup.setup.ts"],
    fixtureProject: "phase3-readonly-setup",
    browserArguments: ["tests/e2e/phase3-lifecycle.spec.ts", "--project", "chromium"],
    port: 31993,
    ready: async () => true,
    launch: (_command, argumentsList) => {
      launches += 1;
      if (launches === 1) return server;
      fixtureCommand = argumentsList;
      queueMicrotask(() => {
        fixture.exitCode = 1;
        fixture.emit("exit", 1, null);
      });
      return fixture;
    },
  });
  assert.equal(launches, 2);
  assert.equal(receipt.failureCategory, "PRODUCT_FAILURE");
  assert.equal(receipt.failureCode, "SOUNDING_LINE_BROWSER_PRODUCT_FAILURE:PLAYWRIGHT_FIXTURE_EXITED");
  assert.deepEqual(fixtureCommand, [
    "node_modules/@playwright/test/cli.js",
    "test",
    "tests/e2e/phase3-readonly-setup.setup.ts",
    "--project",
    "phase3-readonly-setup",
  ]);
  assert.equal(server.exitCode, 0);
});

test("isolated cookie adapter is removed after successful and failed browser execution", async () => {
  for (const fixtureExitCode of [0, 1]) {
    const port = await unusedPort();
    const server = fakeChild();
    const fixture = fakeChild();
    let launches = 0;
    const receipt = await runBrowserAuthority({
      root: process.cwd(),
      fixtureArguments: ["tests/e2e/phase3-readonly-setup.setup.ts"],
      fixtureProject: "phase3-readonly-setup",
      browserArguments: ["tests/e2e/phase3-lifecycle.spec.ts", "--project", "chromium"],
      environment: {
        SOUNDING_LINE_TASK_OWNED_HTTP: "1",
        FOREVER_VALIDATION_ISOLATION: "1",
        FOREVER_VALIDATION_PRODUCTION_IDENTITY: "1",
        FOREVER_VALIDATION_NONCE_HASH: "a".repeat(64),
      },
      port,
      ready: async () => true,
      launch: () => {
        launches += 1;
        if (launches === 1) return server;
        queueMicrotask(() => {
          fixture.exitCode = fixtureExitCode;
          fixture.emit("exit", fixtureExitCode, null);
        });
        return fixture;
      },
    });
    assert.equal(receipt.failureCategory, fixtureExitCode ? "PRODUCT_FAILURE" : null);
    assert.equal(server.exitCode, 0);
    await portCanBeReclaimed(port);
  }
});

test("invalid production and development output topology fails before browser launch", async () => {
  let launched = false;
  const receipt = await runBrowserAuthority({
    root: process.cwd(),
    browserArguments: ["tests/e2e/harborlight-phase3.spec.ts", "--project", "chromium"],
    port: 31990,
    serverArguments: ["node_modules/next/dist/bin/next", "dev", "-p", "31990"],
    launch: () => {
      launched = true;
      return fakeChild();
    },
  });
  assert.equal(launched, false);
  assert.equal(receipt.failureCategory, "INVALID_SERVER_TOPOLOGY");
  assert.equal(
    receipt.failureCode,
    "SOUNDING_LINE_INVALID_SERVER_TOPOLOGY:PRODUCTION_BROWSER_AUTHORITY_REQUIRES_NEXT_START",
  );
});

test("slow but live governed browser server retains its readiness budget", async () => {
  const server = fakeChild();
  const browser = fakeChild();
  let launches = 0;
  let readinessChecks = 0;
  let clock = 0;
  const receipt = await runBrowserAuthority({
    root: process.cwd(),
    browserArguments: ["tests/e2e/harborlight-phase3.spec.ts", "--project", "chromium"],
    port: 31992,
    now: () => (clock += 25),
    ready: async () => (readinessChecks += 1) === 4,
    sleep: async () => {},
    launch: () => {
      launches += 1;
      if (launches === 1) return server;
      queueMicrotask(() => {
        browser.exitCode = 0;
        browser.emit("exit", 0, null);
      });
      return browser;
    },
  });
  assert.equal(receipt.failureCategory, null);
  assert.equal(readinessChecks, 4);
  assert.ok(receipt.timings.serverReadinessMs > 0);
});

test("browser runtime receipts have a deterministic sanitized shape", () => {
  assert.equal(
    sanitizedFailureCode(new Error("database password should not appear in a Sounding Line receipt")),
    "SOUNDING_LINE_PRODUCT_FAILURE:VERIFICATION_COMMAND_FAILED",
  );
  assert.deepEqual(
    browserRuntimeReceipt({
      baseURL: "http://127.0.0.1:31993",
      failureCategory: "INVALID_SERVER_TOPOLOGY",
      failureCode: "SOUNDING_LINE_INVALID_SERVER_TOPOLOGY:BUILT_OUTPUT_MISMATCH",
      timings: {
        serverPreparationMs: 1,
        serverReadinessMs: 2,
        browserExecutionMs: 3,
        infrastructureFailureWaitMs: 4,
        cleanupMs: 5,
      },
    }),
    {
      version: 1,
      topology: "BUILT_SERVER_TASK_OWNED_RUNTIME",
      baseURL: "http://127.0.0.1:31993",
      failureCategory: "INVALID_SERVER_TOPOLOGY",
      failureCode: "SOUNDING_LINE_INVALID_SERVER_TOPOLOGY:BUILT_OUTPUT_MISMATCH",
      timings: {
        serverPreparationMs: 1,
        serverReadinessMs: 2,
        browserExecutionMs: 3,
        infrastructureFailureWaitMs: 4,
        cleanupMs: 5,
      },
    },
  );
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
  assert.match(ordinaryWorkflow, /Restore reusable ordinary evidence/u);
  assert.match(ordinaryWorkflow, /actions\/cache\/restore@v4/u);
  assert.match(ordinaryWorkflow, /Persist passing reusable ordinary evidence/u);
  assert.match(ordinaryWorkflow, /actions\/cache\/save@v4/u);
  assert.match(ordinaryWorkflow, /scripts\/sounding-line\/evidence\.mjs/u);
  assert.match(ordinaryWorkflow, /kind=control-plane/u);
  assert.match(
    ordinaryWorkflow,
    /steps\.route\.outputs\.kind == 'ordinary' && steps\.route\.outputs\.browser_required == 'true'/u,
  );
  assert.match(ordinaryWorkflow, /steps\.route\.outputs\.kind == 'ordinary'/u);
  assert.match(ordinaryWorkflow, /steps\.route\.outputs\.kind == 'control-plane'/u);
  assert.match(ordinaryWorkflow, /SOUNDING_LINE_CONTROL_PLANE_CHANGE_REQUIRES_RELEASE_MODE/u);
  assert.match(ordinaryWorkflow, /SOUNDING_LINE_PRODUCT_AND_CONTROL_PLANE_MIXED/u);
  assert.match(ordinaryWorkflow, /SOUNDING_LINE_CANDIDATE_CLASSIFICATION_FAILURE/u);
  assert.match(ordinaryWorkflow, /git merge-base --is-ancestor/u);
  assert.equal((ordinaryWorkflow.match(/name: Sounding Line \/ Mainline Decision/gu) ?? []).length, 1);
});

test("v1.4 evidence reconciliation preserves, invalidates, falls back, and finalizes complete ordinary closure", async () => {
  await withEvidenceFixture(async ({ root, baseSha }) => {
    writeFileSync(path.join(root, "Development_Docs/guide.md"), "# Guide\n\nFirst ordinary candidate.\n");
    let candidateSha = commit(root, "documentation candidate");
    let plan = await buildPlan({ root, baseSha, candidateSha, mode: "ordinary" });
    const first = await runReconciliation(root, plan);
    assert.ok(first.calls.length > 0);
    assert.equal(first.result.finalization.decision, "PASS");
    assert.equal(first.result.freshObligations, first.result.finalization.requiredObligations);

    const preserved = await runReconciliation(root, plan);
    assert.equal(preserved.calls.length, 0);
    assert.ok(preserved.result.reconciliation.every((entry) => entry.disposition === "PRESERVED"));
    assert.equal(preserved.result.finalization.remainder.length, 0);

    writeFileSync(path.join(root, "Development_Docs/second-guide.md"), "# Second guide\n");
    candidateSha = commit(root, "mixed evidence candidate");
    plan = await buildPlan({ root, baseSha, candidateSha, mode: "ordinary" });
    const mixed = await runReconciliation(root, plan);
    assert.ok(mixed.result.reconciliation.some((entry) => ["PRESERVED", "REBOUND"].includes(entry.disposition)));
    assert.ok(mixed.result.reconciliation.some((entry) => entry.disposition === "INVALIDATED"));
    assert.equal(mixed.result.finalization.decision, "PASS");

    writeFileSync(path.join(root, "src/product.ts"), "export const product = 'relevant change';\n");
    candidateSha = commit(root, "relevant source candidate");
    plan = await buildPlan({ root, baseSha, candidateSha, mode: "ordinary" });
    const sourceChanged = await runReconciliation(root, plan);
    assert.ok(sourceChanged.result.reconciliation.some((entry) => entry.disposition === "INVALIDATED"));
    assert.ok(sourceChanged.calls.length > 0);

    writeFileSync(
      path.join(root, "src/product.test.ts"),
      "import { product } from './product';\nvoid product;\n// definition changed\n",
    );
    candidateSha = commit(root, "test definition candidate");
    plan = await buildPlan({ root, baseSha, candidateSha, mode: "ordinary" });
    const definitionChanged = await runReconciliation(root, plan);
    assert.ok(
      definitionChanged.result.reconciliation.some(
        (entry) => entry.disposition === "INVALIDATED" && entry.changedFields.includes("testDefinitionDigest"),
      ),
    );

    writeFileSync(
      path.join(root, "package-lock.json"),
      `${JSON.stringify({ name: "evidence-fixture", lockfileVersion: 3, packages: { "": { version: "2" } } }, null, 2)}\n`,
    );
    candidateSha = commit(root, "dependency candidate");
    plan = await buildPlan({ root, baseSha, candidateSha, mode: "ordinary" });
    const dependencyChanged = await runReconciliation(root, plan);
    assert.ok(
      dependencyChanged.result.reconciliation.some(
        (entry) => entry.disposition === "INVALIDATED" && entry.changedFields.includes("packageLockDigest"),
      ),
    );

    writeFileSync(path.join(root, "prisma/seed.ts"), "export const fixtureVersion = 2;\n");
    candidateSha = commit(root, "schema fixture candidate");
    plan = await buildPlan({ root, baseSha, candidateSha, mode: "ordinary" });
    const schemaChanged = await runReconciliation(root, plan);
    assert.ok(
      schemaChanged.result.reconciliation.some(
        (entry) =>
          entry.disposition === "INVALIDATED" &&
          (entry.changedFields.includes("schemaDigest") ||
            entry.changedFields.includes("fixtureDigest") ||
            entry.changedFields.includes("semanticClosureDigest")),
      ),
      JSON.stringify(schemaChanged.result.reconciliation),
    );

    writeFileSync(path.join(root, "src/product.test.ts"), "import '/unknown-local-closure';\n");
    candidateSha = commit(root, "ambiguous closure candidate");
    plan = await buildPlan({ root, baseSha, candidateSha, mode: "ordinary" });
    const ambiguous = await runReconciliation(root, plan);
    assert.ok(
      ambiguous.result.reconciliation.some(
        (entry) => entry.disposition === "CONSERVATIVE_FALLBACK" && entry.freshExecuted,
      ),
    );

    const storeRoot = path.join(root, "artifacts", "sounding-line", "evidence-store", "receipts");
    writeFileSync(path.join(storeRoot, "corrupt.json"), "not json\n");
    const corrupt = await runReconciliation(root, plan);
    assert.ok(corrupt.result.reconciliation.every((entry) => entry.disposition === "CONSERVATIVE_FALLBACK"));
    assert.ok(corrupt.calls.length > 0);
  });
});

test("v1.4 evidence rebinds a browser obligation across an unrelated base advance and keeps release exhaustive", async () => {
  await withEvidenceFixture(async ({ root, baseSha }) => {
    writeFileSync(path.join(root, "src/product.ts"), "export const product = 'candidate browser behavior';\n");
    const firstCandidate = commit(root, "browser candidate on original base");
    const firstPlan = await buildPlan({ root, baseSha, candidateSha: firstCandidate, mode: "ordinary" });
    const first = await runReconciliation(root, firstPlan, 15);
    assert.ok(
      first.calls.some(([, argumentsList]) => argumentsList[0] === "scripts/sounding-line/browser-authority.mjs"),
    );
    const freshBrowserReceipt = first.result.receipts.find((entry) => entry.obligationId.startsWith("browser."));
    assert.ok((freshBrowserReceipt?.durationMs ?? 0) >= 50);

    git(root, ["checkout", "--quiet", "-b", "newer-base", baseSha]);
    writeFileSync(path.join(root, "Development_Docs/guide.md"), "# Guide\n\nUnrelated base advance.\n");
    const newerBase = commit(root, "unrelated base advance");
    git(root, ["checkout", "--quiet", "-b", "rebound-candidate"]);
    writeFileSync(path.join(root, "src/product.ts"), "export const product = 'candidate browser behavior';\n");
    const reboundCandidate = commit(root, "reapply browser candidate");
    const reboundPlan = await buildPlan({ root, baseSha: newerBase, candidateSha: reboundCandidate, mode: "ordinary" });
    const rebound = await runReconciliation(root, reboundPlan);
    const browser = rebound.result.reconciliation.find((entry) => entry.obligationId.startsWith("browser."));
    assert.equal(browser?.disposition, "REBOUND");
    assert.equal(browser?.freshExecuted, false);
    assert.ok(browser?.commandsAvoided.some((command) => command.includes("browser-authority.mjs")));
    assert.ok(
      !rebound.calls.some(([, argumentsList]) => argumentsList[0] === "scripts/sounding-line/browser-authority.mjs"),
    );
    assert.equal(rebound.result.finalization.decision, "PASS");
    assert.equal(rebound.result.finalization.requiredObligations, 7);
    assert.equal(rebound.result.freshObligations, 1);
    assert.equal(rebound.result.finalization.counts.REBOUND, 6);
    assert.equal(rebound.result.finalization.counts.INVALIDATED, 1);
    assert.equal(rebound.result.commandsAvoided.length, 9);
    assert.ok(rebound.result.avoidedDurationMs >= (freshBrowserReceipt?.durationMs ?? Infinity));

    const releasePlan = await buildPlan({ root, baseSha: newerBase, candidateSha: reboundCandidate, mode: "release" });
    const release = await runReconciliation(root, releasePlan);
    assert.equal(
      release.result.reconciliation.every((entry) => entry.disposition === "FRESH"),
      true,
    );
    assert.equal(release.result.freshObligations, release.result.finalization.requiredObligations);
    assert.ok(
      release.calls.some(([, argumentsList]) => argumentsList[0] === "scripts/sounding-line/browser-authority.mjs"),
    );
  });
});

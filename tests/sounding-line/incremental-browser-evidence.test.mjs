import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { FileEvidenceStore, digest } from "../../scripts/sounding-line/evidence.mjs";
import {
  buildEvidenceObligations,
  completedEvidenceDirectory,
  completedEvidenceEnvironmentClass,
  runReconciledVerification,
  soundingLineDatabaseUrl,
  verificationObligationGroups,
} from "../../scripts/sounding-line/ordinary.mjs";

function git(root, ...args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}
function put(root, file, contents) {
  mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  writeFileSync(path.join(root, file), contents);
}
function commit(root) {
  git(root, "add", ".");
  git(root, "commit", "--quiet", "-m", "inert policy fixture");
  return git(root, "rev-parse", "HEAD");
}
async function fixture(action) {
  const owner = mkdtempSync(path.join(tmpdir(), "sl-incremental-policy-"));
  const root = path.join(owner, "candidate");
  mkdirSync(root);
  const files = {
    ".gitignore": "artifacts/\n",
    "package.json": '{"scripts":{}}\n',
    "package-lock.json": '{"lockfileVersion":3}\n',
    "tsconfig.json": "{}\n",
    "next.config.ts": "export default {};\n",
    "postcss.config.mjs": "export default {};\n",
    "playwright.config.ts": "export default {};\n",
    "vitest.config.ts": "export default {};\n",
    "eslint.config.mjs": "export default [];\n",
    ".prettierrc.json": "{}\n",
    ".prettierignore": "node_modules\n",
    ".nvmrc": "24\n",
    "src/reach/runtime.ts":
      "import registry from '../../Development_Docs/Runtime/registry.json';\nexport const ready = registry.ready;\n",
    "Development_Docs/Runtime/registry.json": '{"ready":true}\n',
    "tests/e2e/reach.spec.ts": "import '../../src/reach/runtime';\n",
    "tests/e2e/fixtures/reach/photo.jpg": "inert photographic fixture bytes",
    "public/reach/hand-worker.js": "export const worker = true;\n",
    "public/reach/model.task": "inert model bytes",
    "scripts/sounding-line/run-browser-suite.mjs": "export {};\n",
    "scripts/sounding-line/browser-authority.mjs": "export {};\n",
    "prisma/schema.sqlite.prisma": 'generator client { provider = "prisma-client-js" }\n',
    "prisma/seed.ts": "export {};\n",
    "testing/contracts.json": "{}\n",
  };
  for (const [file, contents] of Object.entries(files)) put(root, file, contents);
  git(root, "init", "--quiet", "--initial-branch=main");
  git(root, "config", "core.autocrlf", "false");
  git(root, "config", "user.email", "policy@example.invalid");
  git(root, "config", "user.name", "Inert policy fixture");
  const baseSha = commit(root);
  put(root, "Development_Docs/fixture.md", "# Candidate\n");
  const candidateSha = commit(root);
  const plan = {
    mode: "ordinary",
    baseSha,
    candidateSha,
    databaseUrl: soundingLineDatabaseUrl(candidateSha),
    safetyPaths: [],
    lintPaths: [],
    selected: { unitTests: [], browserTests: [] },
    buildRequired: false,
    migrationRequired: false,
    migrationScripts: [],
    registrationValidationRequired: false,
  };
  try {
    await action({ root, owner, plan });
  } finally {
    rmSync(owner, { recursive: true, force: true });
  }
}
function browserPlan(plan) {
  return { ...plan, buildRequired: true, selected: { unitTests: [], browserTests: ["tests/e2e/reach.spec.ts"] } };
}
function checkpoints(directory) {
  return readdirSync(directory)
    .sort()
    .map((name) => JSON.parse(readFileSync(path.join(directory, name), "utf8")));
}

test("generic browser setup and actual suite execution form one complete browser obligation", () => {
  const plan = browserPlan({
    candidateSha: "a".repeat(40),
    databaseUrl: soundingLineDatabaseUrl("a".repeat(40)),
    mode: "ordinary",
    safetyPaths: [],
    lintPaths: [],
    migrationScripts: [],
  });
  const groups = verificationObligationGroups(plan);
  const browser = groups.filter((group) => group.kind === "browser");
  assert.equal(browser.length, 1);
  assert.deepEqual(
    browser[0].commands.map(([, args]) => args[0]),
    ["run", "--no-install", "scripts/sounding-line/run-browser-suite.mjs"],
  );
  assert(
    !groups.some(
      (group) => group.kind === "preflight" && group.commands.some(([, args]) => args[0].includes("run-browser-suite")),
    ),
  );
});

test("browser closure binds Reach source, test, photographic fixtures, models, setup and schema", async () => {
  await fixture(async ({ root, plan }) => {
    const [browser] = (await buildEvidenceObligations(root, browserPlan(plan))).filter(
      (group) => group.kind === "browser",
    );
    for (const file of [
      "src/reach/runtime.ts",
      "Development_Docs/Runtime/registry.json",
      "tests/e2e/reach.spec.ts",
      "tests/e2e/fixtures/reach/photo.jpg",
      "public/reach/model.task",
      "public/reach/hand-worker.js",
      "scripts/sounding-line/run-browser-suite.mjs",
      "prisma/schema.sqlite.prisma",
      "playwright.config.ts",
      "testing/contracts.json",
    ])
      assert(
        browser.fingerprint.semanticClosureMembers.some((entry) => entry.startsWith(file + "@")),
        file,
      );
    assert(browser.fingerprint.testDefinitionDigest);
    assert(browser.fingerprint.fixtureDigest);
    assert(browser.fingerprint.schemaDigest);
    assert(browser.fingerprint.browserIdentity);
    assert.equal(browser.reuseIndeterminate, true);
    assert.equal(browser.reuseReason, "BROWSER_RUNTIME_PROVENANCE_UNAUTHENTICATED");
  });
});

for (const file of [
  "src/reach/runtime.ts",
  "Development_Docs/Runtime/registry.json",
  "tests/e2e/reach.spec.ts",
  "tests/e2e/fixtures/reach/photo.jpg",
  "public/reach/model.task",
  "scripts/sounding-line/run-browser-suite.mjs",
  "prisma/schema.sqlite.prisma",
  "playwright.config.ts",
])
  test(`browser source closure invalidates on ${file}`, async () => {
    await fixture(async ({ root, plan }) => {
      const before = (await buildEvidenceObligations(root, browserPlan(plan))).find(
        (group) => group.kind === "browser",
      );
      put(root, file, readFileSync(path.join(root, file), "utf8") + "\nchanged inert input\n");
      const candidateSha = commit(root);
      const after = (
        await buildEvidenceObligations(
          root,
          browserPlan({ ...plan, candidateSha, databaseUrl: soundingLineDatabaseUrl(candidateSha) }),
        )
      ).find((group) => group.kind === "browser");
      assert.equal(after.id, before.id, "complete candidate operands must normalize, not leave a SHA suffix");
      assert.notEqual(after.fingerprint.fingerprintDigest, before.fingerprint.fingerprintDigest);
    });
  });

test("a later command failure retains only previously completed whole obligations", async () => {
  await fixture(async ({ root, owner, plan }) => {
    const error = new Error("EXPECTED_SECOND_OBLIGATION_FAILURE");
    let calls = 0;
    const output = path.join(owner, "completed");
    await assert.rejects(
      runReconciledVerification(
        root,
        plan,
        () => {
          if (++calls === 2) throw error;
        },
        { completedEvidenceRoot: output },
      ),
      (observed) => observed === error,
    );
    const saved = checkpoints(output);
    assert.equal(calls, 2);
    assert.equal(saved.length, 1);
    assert.equal(saved[0].completedWholeObligations, 1);
    assert.equal(saved[0].receipts.length, 1);
    assert.equal(saved[0].receipts[0].result, "PASSED");
    assert.equal(saved[0].wholeVerificationPassed, false);
    assert.equal(saved[0].authentication, "RETENTION_ONLY_NO_AUTHENTICATED_PRODUCER");
  });
});

test("cancellation inside a multi-command browser group never checkpoints its partial success", async () => {
  await fixture(async ({ root, owner, plan }) => {
    const cancelled = Object.assign(new Error("EXPECTED_CANCELLATION"), { name: "AbortError" });
    const p = browserPlan(plan);
    const browser = verificationObligationGroups(p).find((group) => group.kind === "browser");
    let browserCommands = 0;
    const output = path.join(owner, "completed");
    await assert.rejects(
      runReconciledVerification(
        root,
        p,
        (_root, _command, args) => {
          if ((args[0] === "run" && args[1] === "build") || (args.includes("prisma") && args.includes("generate")))
            browserCommands++;
          if (args[0] === "scripts/sounding-line/run-browser-suite.mjs") throw cancelled;
        },
        { completedEvidenceRoot: output },
      ),
      (error) => error === cancelled,
    );
    assert.equal(browserCommands, 2);
    const saved = checkpoints(output);
    assert(saved.length > 0);
    assert(saved.every((entry) => entry.receipts.every((receipt) => receipt.obligationId !== browser.id)));
    assert(saved.every((entry) => entry.wholeVerificationPassed === false && entry.qualification === false));
  });
});

for (const corruptFingerprint of [false, true])
  test(`restored ${corruptFingerprint ? "forged fingerprint" : "self-hashed receipt without producer proof"} runs fresh`, async () => {
    await fixture(async ({ root, plan }) => {
      const obligation = (await buildEvidenceObligations(root, plan))[0];
      const fingerprint = structuredClone(obligation.fingerprint);
      if (corruptFingerprint) fingerprint.semanticClosureDigest = "f".repeat(64);
      const store = new FileEvidenceStore(path.join(root, "artifacts/sounding-line/evidence-store"));
      const forged = await store.writeFresh({
        candidateSha: plan.candidateSha,
        obligationId: obligation.id,
        fingerprint,
        planDigest: digest({ forged: true }),
        commands: obligation.commandLabels,
        durationMs: 0,
      });
      const original = readFileSync(path.join(store.receiptsRoot(), forged.id + ".json"));
      let calls = 0;
      const result = await runReconciledVerification(root, plan, () => {
        calls++;
      });
      assert(calls > 0);
      const entry = result.reconciliation[0];
      assert.equal(entry.disposition, "CONSERVATIVE_FALLBACK");
      assert(
        entry.reasonCodes.includes(
          corruptFingerprint ? "EVIDENCE_FINGERPRINT_INVALID" : "EVIDENCE_PRODUCER_UNAUTHENTICATED",
        ),
      );
      assert.deepEqual(
        readFileSync(path.join(store.receiptsRoot(), forged.id + ".json")),
        original,
        "cached history is preserved",
      );
    });
  });

test("trusted parent observations remain reusable with exact fingerprints and finalizer closure", async () => {
  await fixture(async ({ root, plan }) => {
    await runReconciledVerification(root, plan, () => {});
    let calls = 0;
    const result = await runReconciledVerification(root, plan, () => {
      calls++;
    });
    assert.equal(calls, 0);
    assert(result.reconciliation.every((entry) => entry.disposition === "PRESERVED"));
    assert.equal(result.finalization.decision, "PASS");
  });
});

test("checkpoint destination cannot be a candidate-controlled subdirectory", async () => {
  await fixture(async ({ root, plan }) => {
    await assert.rejects(
      runReconciledVerification(root, plan, () => assert.fail("must not execute"), {
        completedEvidenceRoot: path.join(root, "artifacts/untrusted-export"),
      }),
      /MUST_BE_OUTSIDE_CANDIDATE/u,
    );
  });
});

test("same-root local CLI leaves checkpoint export disabled without forbidding verification", async () => {
  await fixture(async ({ root, plan }) => {
    assert.equal(completedEvidenceDirectory(root, root), undefined);
    let calls = 0;
    const result = await runReconciledVerification(
      root,
      plan,
      () => {
        calls++;
      },
      { completedEvidenceRoot: completedEvidenceDirectory(root, root) },
    );
    assert(calls > 0);
    assert.equal(result.finalization.decision, "PASS");
  });
});

test("computed runtime import leaves build closure indeterminate", async () => {
  await fixture(async ({ root, plan }) => {
    put(root, "src/reach/runtime.ts", "const target = './runtime-data';\nvoid import(target);\n");
    const candidateSha = commit(root);
    const groups = await buildEvidenceObligations(root, {
      ...plan,
      candidateSha,
      databaseUrl: soundingLineDatabaseUrl(candidateSha),
      buildRequired: true,
    });
    assert.equal(groups.find((group) => group.kind === "build").reuseIndeterminate, true);
  });
});

for (const expression of [
  "import('../../Development_Docs/Runtime/known' + suffix)",
  "require('../../Development_Docs/Runtime/known' + suffix)",
  "import /* comment */ ('../../Development_Docs/Runtime/known-extra')",
])
  test("computed call with an existing quoted prefix remains indeterminate: " + expression, async () => {
    await fixture(async ({ root, plan }) => {
      put(root, "Development_Docs/Runtime/known.ts", "export {};\n");
      put(root, "Development_Docs/Runtime/known-extra.ts", "export const extra = true;\n");
      put(root, "src/reach/runtime.ts", "const suffix = '-extra'; void " + expression + ";\n");
      const candidateSha = commit(root);
      const group = (
        await buildEvidenceObligations(root, {
          ...plan,
          candidateSha,
          databaseUrl: soundingLineDatabaseUrl(candidateSha),
          buildRequired: true,
        })
      ).find((entry) => entry.kind === "build");
      assert.equal(group.reuseIndeterminate, true);
    });
  });

test("a complete static quoted call includes its outside-prefix source without forcing unknown", async () => {
  await fixture(async ({ root, plan }) => {
    put(root, "Development_Docs/Runtime/known.ts", "export {};\n");
    put(root, "src/reach/runtime.ts", "void import('../../Development_Docs/Runtime/known');\n");
    const candidateSha = commit(root);
    const group = (
      await buildEvidenceObligations(root, {
        ...plan,
        candidateSha,
        databaseUrl: soundingLineDatabaseUrl(candidateSha),
        buildRequired: true,
      })
    ).find((entry) => entry.kind === "build");
    assert.equal(group.reuseIndeterminate, false);
    assert(
      group.fingerprint.semanticClosureMembers.some((entry) => entry.startsWith("Development_Docs/Runtime/known.ts@")),
    );
  });
});

for (const source of [
  "const name = 'data'; void import(`../../Development_Docs/${name}.json`);\n",
  "import { readFileSync } from 'node:fs'; const name = 'data'; readFileSync(`Development_Docs/${name}.json`);\n",
  "import { readFileSync } from 'node:fs'; readFileSync('Development_Docs/Runtime/registry.json');\n",
])
  test("template or filesystem runtime inputs conservatively invalidate reuse: " + source.slice(0, 35), async () => {
    await fixture(async ({ root, plan }) => {
      put(root, "src/reach/runtime.ts", source);
      const candidateSha = commit(root);
      const group = (
        await buildEvidenceObligations(root, {
          ...plan,
          candidateSha,
          databaseUrl: soundingLineDatabaseUrl(candidateSha),
          buildRequired: true,
        })
      ).find((entry) => entry.kind === "build");
      assert.equal(group.reuseIndeterminate, true);
      if (source.includes("readFileSync('Development_Docs/"))
        assert(
          group.fingerprint.semanticClosureMembers.some((entry) =>
            entry.startsWith("Development_Docs/Runtime/registry.json@"),
          ),
        );
    });
  });

test("canonical candidate symlink alias cannot place completed export inside its real tree", async () => {
  await fixture(async ({ root, owner, plan }) => {
    const alias = path.join(owner, "candidate-alias");
    symlinkSync(root, alias, "dir");
    assert.equal(completedEvidenceDirectory(alias, root), undefined);
    await assert.rejects(
      runReconciledVerification(alias, plan, () => assert.fail("must not execute"), {
        completedEvidenceRoot: path.join(root, "artifacts", "export"),
      }),
      /MUST_BE_OUTSIDE_CANDIDATE/u,
    );
  });
});

test("actual EEXIST receipt collision cannot become a parent-observed checkpoint", async () => {
  await fixture(async ({ root, owner, plan }) => {
    const obligation = (await buildEvidenceObligations(root, plan))[0];
    let injected = false;
    const output = path.join(owner, "completed");
    await assert.rejects(
      runReconciledVerification(
        root,
        plan,
        async () => {
          if (injected) return;
          injected = true;
          const parent = path.join(root, "artifacts", "sounding-line", "parent-observed-evidence");
          const ledger = path.join(parent, readdirSync(parent)[0]);
          const store = new FileEvidenceStore(ledger);
          await store.writeFresh({
            candidateSha: plan.candidateSha,
            obligationId: obligation.id,
            fingerprint: obligation.fingerprint,
            planDigest: digest({ injected: true }),
            commands: obligation.commandLabels,
            durationMs: -1,
          });
        },
        { completedEvidenceRoot: output },
      ),
      /COMPLETED_EVIDENCE_RECEIPT_CHANGED/u,
    );
    assert(injected);
    assert.deepEqual(checkpoints(output), [], "no injected receipt is promoted or exported");
  });
});

test("checkpoint module identity is SHA256 of original module bytes", async () => {
  await fixture(async ({ root, owner, plan }) => {
    const output = path.join(owner, "completed");
    await runReconciledVerification(root, plan, () => {}, { completedEvidenceRoot: output });
    const expected = createHash("sha256")
      .update(readFileSync(new URL("../../scripts/sounding-line/ordinary.mjs", import.meta.url)))
      .digest("hex");
    assert.equal(checkpoints(output)[0].producerObservation.authorityModuleSha256, expected);
  });
});

test("completed producer class requires the trusted positive workflow purpose and excludes development grants", () => {
  const plan = { mode: "ordinary" };
  const environment = {
    SOUNDING_LINE_EVIDENCE_PURPOSE: "PROTECTED_FINAL_VERIFICATION",
    GITHUB_ACTIONS: "true",
    GITHUB_REPOSITORY: "Kgray44/treasurehuntSoT",
    GITHUB_JOB: "final-check",
    GITHUB_EVENT_NAME: "pull_request_target",
    GITHUB_WORKFLOW_REF: "Kgray44/treasurehuntSoT/.github/workflows/sounding-line-ordinary.yml@refs/heads/main",
  };
  assert.equal(completedEvidenceEnvironmentClass(plan, environment), "github-actions-nonbrowser-controlled");
  for (const delta of [
    { SOUNDING_LINE_EVIDENCE_PURPOSE: undefined },
    { SOUNDING_LINE_ROLE: "DEVELOPMENT_ONLY" },
    { SOUNDING_LINE_EXECUTION_ROLE: "DEVELOPMENT_ONLY" },
    { POSTTECHNICAL_SUITE_LEASE: "inert-lease" },
    { SOUNDING_LINE_DIAGNOSTIC_LEASE: "inert-lease" },
    { GITHUB_EVENT_NAME: "workflow_dispatch" },
    { GITHUB_WORKFLOW_REF: "Kgray44/treasurehuntSoT/.github/workflows/sounding-line-ordinary.yml@refs/heads/debug" },
  ])
    assert.equal(completedEvidenceEnvironmentClass(plan, { ...environment, ...delta }), "UNSUPPORTED");
  assert.equal(completedEvidenceEnvironmentClass({ mode: "release" }, environment), "UNSUPPORTED");
  assert.equal(
    completedEvidenceEnvironmentClass(plan, {
      ...environment,
      SOUNDING_LINE_BROWSER_DIAGNOSTIC_CONTEXT: "inert-scope",
    }),
    "github-actions-nonbrowser-controlled",
  );
});

test("irrelevant exception registry moves preserve unit evidence while current authorization stays separate", async () => {
  await fixture(async ({ root, plan }) => {
    put(root, "src/reach/runtime.test.ts", "import './runtime';\n");
    let candidateSha = commit(root);
    const unitPlan = {
      ...plan,
      candidateSha,
      databaseUrl: soundingLineDatabaseUrl(candidateSha),
      selected: { unitTests: ["src/reach/runtime.test.ts"], browserTests: [] },
    };
    const before = (await buildEvidenceObligations(root, unitPlan)).find((entry) => entry.kind === "unit");
    put(root, "testing/product-experience-exceptions.json", '{"exceptions":[{"id":"unrelated-new-row"}]}\n');
    candidateSha = commit(root);
    const after = (
      await buildEvidenceObligations(root, {
        ...unitPlan,
        candidateSha,
        databaseUrl: soundingLineDatabaseUrl(candidateSha),
      })
    ).find((entry) => entry.kind === "unit");
    assert.equal(before.fingerprint.fingerprintDigest, after.fingerprint.fingerprintDigest);
    assert.equal(before.fingerprint.soundingLinePolicyDigest, after.fingerprint.soundingLinePolicyDigest);
  });
});

test("actual verifier engine source change invalidates unit evidence policy", async () => {
  await fixture(async ({ root, owner, plan }) => {
    put(root, "src/reach/runtime.test.ts", "import './runtime';\n");
    const candidateSha = commit(root);
    const p = {
      ...plan,
      candidateSha,
      databaseUrl: soundingLineDatabaseUrl(candidateSha),
      selected: { unitTests: ["src/reach/runtime.test.ts"], browserTests: [] },
    };
    const before = (await buildEvidenceObligations(root, p)).find((entry) => entry.kind === "unit");
    const authority = path.join(owner, "synthetic-authority", "scripts", "sounding-line");
    cpSync(new URL("../../scripts/sounding-line/", import.meta.url), authority, { recursive: true });
    const engineModule = path.join(authority, "ordinary.mjs");
    writeFileSync(
      engineModule,
      readFileSync(engineModule, "utf8") + "\n// Inert changed semantic-engine source identity.\n",
    );
    const changed = await import(new URL("file://" + engineModule).href);
    const after = (await changed.buildEvidenceObligations(root, p)).find((entry) => entry.kind === "unit");
    assert.notEqual(before.fingerprint.soundingLinePolicyDigest, after.fingerprint.soundingLinePolicyDigest);
    assert.notEqual(before.fingerprint.fingerprintDigest, after.fingerprint.fingerprintDigest);
  });
});

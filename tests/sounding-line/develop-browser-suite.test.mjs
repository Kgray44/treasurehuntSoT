import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile, symlink } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  assertDevelopmentBuildReuse,
  createDevelopmentBrowserPlan,
  developmentSourceFingerprint,
  developmentDiagnosticBinding,
} from "../../scripts/sounding-line/develop-browser-suite.mjs";
import {
  BROWSER_DIAGNOSTIC_CONTEXT,
  createBrowserDiagnosticSession,
} from "../../scripts/sounding-line/browser-diagnostics.mjs";

const selector = "tests/e2e/reach-laboratory.spec.ts:357";
const candidateSha = "0123456789abcdef0123456789abcdef01234567";
const sourceFiles = {
  ".gitignore": "node_modules/\n.next/\nartifacts/\n",
  "package.json": '{"name":"inert-development-fixture","private":true}\n',
  "package-lock.json": '{"name":"inert-development-fixture","lockfileVersion":3,"packages":{}}\n',
  "next.config.ts": "export default {};\n",
  "playwright.config.ts": "export default { timeout: 240000 };\n",
  "src/app/page.tsx": "export default function Page() { return null; }\n",
  "tests/e2e/reach-laboratory.spec.ts": "// Inert source fixture; never imported or run.\n",
};

async function fixture(t) {
  const base = await mkdtemp(path.join(os.tmpdir(), "development-browser-contract-"));
  t.after(() => rm(base, { recursive: true, force: true }));
  const workspace = path.join(base, "workspace");
  const outputDirectory = path.join(base, "private-output");
  await mkdir(workspace);
  for (const [relative, text] of Object.entries(sourceFiles)) {
    const file = path.join(workspace, relative);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, text);
  }
  // Bind each disposable workspace to the already installed, locked parser.
  // No package install or product execution occurs in these fixtures.
  const parserManifest = createRequire(import.meta.url).resolve("typescript/package.json");
  const parser = JSON.parse(await readFile(parserManifest, "utf8"));
  const locked = JSON.parse(await readFile(new URL("../../package-lock.json", import.meta.url), "utf8"));
  assert.equal(parser.version, locked.packages["node_modules/typescript"].version);
  await mkdir(path.join(workspace, "node_modules"));
  await symlink(
    path.dirname(parserManifest),
    path.join(workspace, "node_modules", "typescript"),
    process.platform === "win32" ? "junction" : "dir",
  );
  const environment = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
  Object.assign(environment, {
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: os.platform() === "win32" ? "NUL" : "/dev/null",
    GIT_AUTHOR_NAME: "Inert fixture",
    GIT_AUTHOR_EMAIL: "fixture@example.invalid",
    GIT_COMMITTER_NAME: "Inert fixture",
    GIT_COMMITTER_EMAIL: "fixture@example.invalid",
  });
  const git = (...args) =>
    execFileSync("git", ["-C", workspace, ...args], {
      env: environment,
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
    }).trim();
  git("init", "--quiet", "--initial-branch=main", "--template=");
  git("config", "core.hooksPath", os.platform() === "win32" ? "NUL" : "/dev/null");
  git("config", "commit.gpgsign", "false");
  git("add", "--all");
  git("commit", "--quiet", "--no-verify", "-m", "Inert fixture");
  return {
    workspace,
    outputDirectory,
    head: git("rev-parse", "HEAD"),
    plan: () => createDevelopmentBrowserPlan({ workspace, test: selector, outputDirectory, candidateSha }),
  };
}

function preparedFor(plan, source) {
  return {
    version: 1,
    role: "DEVELOPMENT_ONLY",
    qualification: false,
    workspace: plan.workspace,
    profile: "generic",
    node: process.version,
    activeRuntimeDirectory: plan.activeRuntimeDirectory,
    databaseName: "validation-isolated-20261017-123456789-0123456789abcdef0123456789abcdef.db",
    source: { digest: source.digest },
  };
}

test("development plan labels the route and fixes the original single-case options", async (t) => {
  const f = await fixture(t);
  const plan = f.plan();
  assert.equal(plan.role, "DEVELOPMENT_ONLY");
  assert.equal(plan.qualification, false);
  assert.equal(
    plan.activeRuntimeDirectory,
    path.join(f.workspace, "artifacts", "sounding-line", `generic-${candidateSha.slice(0, 12)}`),
  );
  assert.deepEqual(plan.browserArguments, [
    selector,
    "--project",
    "chromium",
    "--workers",
    "1",
    "--retries",
    "0",
    "--repeat-each",
    "1",
    "--reporter",
    "list,json,html",
    "--output",
    path.join(f.outputDirectory, "test-results"),
  ]);
  const setup = JSON.stringify(plan.setup);
  let previous = -1;
  for (const script of [
    "schema.sqlite.prisma",
    "sqlite-bootstrap.mjs",
    "prisma/seed.ts",
    "migrate-legacy-companion.ts",
    "prepare-validation-isolation.mjs",
  ]) {
    const current = setup.indexOf(script);
    assert.ok(current > previous, `Generic setup retains ordered ${script}`);
    previous = current;
  }
});

test("development plan accepts a nested spec with a positive line selector", async (t) => {
  const f = await fixture(t);
  const selected = "tests/e2e/nested/example.spec.ts:1";
  const plan = createDevelopmentBrowserPlan({
    workspace: f.workspace,
    outputDirectory: f.outputDirectory,
    candidateSha,
    test: selected,
  });
  assert.equal(plan.browserArguments[0], selected);
});

test("development plan rejects selector traversal, extra arguments, and invalid line syntax", async (t) => {
  const f = await fixture(t);
  for (const selected of [
    "../reach.spec.ts",
    "tests/e2e/../reach.spec.ts",
    "tests/e2e/nested/../../reach.spec.ts",
    path.join(f.workspace, "tests/e2e/reach.spec.ts"),
    "tests/e2e/reach.spec.ts --workers=4",
    "tests/e2e/reach.spec.ts\n--retries=1",
    "tests/e2e/reach.spec.ts:0",
    "tests/e2e/reach.spec.ts:-1",
    "tests/e2e/reach.spec.ts:1:2",
    "tests/e2e/reach.spec.ts;echo x",
    "tests\\e2e\\reach.spec.ts",
    "tests/unit/reach.spec.ts",
    "tests/e2e/reach.test.ts",
    [selector, "--workers", "2"],
    null,
  ]) {
    assert.throws(
      () =>
        createDevelopmentBrowserPlan({
          workspace: f.workspace,
          outputDirectory: f.outputDirectory,
          candidateSha,
          test: selected,
        }),
      `Rejected selector: ${JSON.stringify(selected)}`,
    );
  }
});

test("development plan requires absolute private paths, a candidate SHA, and the exact generic profile", async (t) => {
  const f = await fixture(t);
  for (const changes of [
    { workspace: "." },
    { outputDirectory: "relative-output" },
    { outputDirectory: f.workspace },
    { outputDirectory: path.join(f.workspace, "private-output") },
    { candidateSha: undefined },
    { candidateSha: "a".repeat(39) },
    { candidateSha: "g".repeat(40) },
    { profile: "harborlight-phase2" },
    { profile: "unknown" },
    { profile: "" },
  ]) {
    assert.throws(() =>
      createDevelopmentBrowserPlan({
        workspace: f.workspace,
        outputDirectory: f.outputDirectory,
        candidateSha,
        test: selector,
        ...changes,
      }),
    );
  }
});

test("source fingerprint is stable and binds the actual local Git head and inputs", async (t) => {
  const f = await fixture(t);
  const first = await developmentSourceFingerprint(f.workspace);
  const second = await developmentSourceFingerprint(f.workspace);
  assert.deepEqual(second, first);
  assert.equal(first.head, f.head);
  assert.match(first.digest, /^[a-f0-9]{64}$/u);
  const files = new Map(first.files.map((entry) => [entry.path, entry.sha256]));
  for (const name of [
    "package.json",
    "package-lock.json",
    "next.config.ts",
    "playwright.config.ts",
    "src/app/page.tsx",
  ]) {
    assert.match(files.get(name) ?? "", /^[a-f0-9]{64}$/u, `Fingerprint includes ${name}`);
  }
});

test("dirty app development changes the source digest without requiring a commit", async (t) => {
  const f = await fixture(t);
  const before = await developmentSourceFingerprint(f.workspace);
  await writeFile(path.join(f.workspace, "src/app/page.tsx"), "export default function Page() { return 'changed'; }\n");
  const after = await developmentSourceFingerprint(f.workspace);
  assert.equal(after.head, before.head);
  assert.notEqual(after.digest, before.digest);
  assert.throws(
    () => assertDevelopmentBuildReuse(preparedFor(f.plan(), before), after, f.plan()),
    /DEVELOPMENT_SOURCE_CHANGED_PREPARE_AGAIN/u,
  );
});

test("untracked app source participates in fingerprinting and invalidates build reuse", async (t) => {
  const f = await fixture(t);
  const before = await developmentSourceFingerprint(f.workspace);
  await writeFile(path.join(f.workspace, "src/new-development-module.ts"), "export const changed = true;\n");
  const after = await developmentSourceFingerprint(f.workspace);
  assert.notEqual(after.digest, before.digest);
  assert.ok(after.files.some((entry) => entry.path === "src/new-development-module.ts"));
  assert.throws(
    () => assertDevelopmentBuildReuse(preparedFor(f.plan(), before), after, f.plan()),
    /DEVELOPMENT_SOURCE_CHANGED_PREPARE_AGAIN/u,
  );
});

test("configuration and dependency-lock edits independently invalidate reuse", async (t) => {
  const f = await fixture(t);
  const original = await developmentSourceFingerprint(f.workspace);
  const plan = f.plan();
  const prepared = preparedFor(plan, original);
  for (const name of ["next.config.ts", "playwright.config.ts", "package.json", "package-lock.json"]) {
    const file = path.join(f.workspace, name);
    const value = await readFile(file);
    await writeFile(file, Buffer.concat([value, Buffer.from("\n")]));
    const changed = await developmentSourceFingerprint(f.workspace);
    assert.notEqual(changed.digest, original.digest, name);
    assert.throws(
      () => assertDevelopmentBuildReuse(prepared, changed, plan),
      /DEVELOPMENT_SOURCE_CHANGED_PREPARE_AGAIN/u,
    );
    await writeFile(file, value);
    assert.equal((await developmentSourceFingerprint(f.workspace)).digest, original.digest);
  }
});

test("imported documentation JSON participates in the source fingerprint and invalidates reuse", async (t) => {
  const f = await fixture(t);
  const dataRoot = path.join(f.workspace, "Development_Docs", "Runtime");
  await mkdir(dataRoot, { recursive: true });
  const originalData = '{"version":1}\n';
  for (const name of ["registry.json", "dynamic.json", "unrelated.json"])
    await writeFile(path.join(dataRoot, name), originalData);
  await writeFile(
    path.join(f.workspace, "src/app/page.tsx"),
    [
      'import registry from "../../Development_Docs/Runtime/registry.json";',
      'export async function load() { return import("../../Development_Docs/Runtime/dynamic.json"); }',
      `const inertExample = 'import decoy from "../../Development_Docs/Runtime/string-only.json";';`,
      '// import decoy from "../../Development_Docs/Runtime/comment-only.json";',
      '/* const later = import("../../Development_Docs/Runtime/comment-dynamic.json"); */',
      "export default function Page() { return registry.version; }",
      "",
    ].join("\n"),
  );
  const source = await developmentSourceFingerprint(f.workspace);
  const paths = new Set(source.files.map((entry) => entry.path));
  assert.ok(paths.has("Development_Docs/Runtime/registry.json"));
  assert.ok(paths.has("Development_Docs/Runtime/dynamic.json"));
  assert.equal(paths.has("Development_Docs/Runtime/unrelated.json"), false);
  for (const name of ["string-only.json", "comment-only.json", "comment-dynamic.json"])
    assert.equal(paths.has(`Development_Docs/Runtime/${name}`), false);
  const plan = f.plan();
  const prepared = preparedFor(plan, source);
  assert.doesNotThrow(() => assertDevelopmentBuildReuse(prepared, source, plan));
  for (const name of ["registry.json", "dynamic.json"]) {
    await writeFile(path.join(dataRoot, name), '{"version":2}\n');
    const changed = await developmentSourceFingerprint(f.workspace);
    assert.notEqual(changed.digest, source.digest, `${name} is a real build input`);
    assert.throws(
      () => assertDevelopmentBuildReuse(prepared, changed, plan),
      /DEVELOPMENT_SOURCE_CHANGED_PREPARE_AGAIN/u,
    );
    await writeFile(path.join(dataRoot, name), originalData);
    assert.equal((await developmentSourceFingerprint(f.workspace)).digest, source.digest);
  }
});

test("unchanged source permits scoped reuse with a fresh private report destination", async (t) => {
  const f = await fixture(t);
  const source = await developmentSourceFingerprint(f.workspace);
  const plan = f.plan();
  const prepared = preparedFor(plan, source);
  assert.doesNotThrow(() => assertDevelopmentBuildReuse(prepared, source, plan));
  const nextPlan = createDevelopmentBrowserPlan({
    workspace: f.workspace,
    outputDirectory: path.join(path.dirname(f.outputDirectory), "another-private-output"),
    candidateSha,
    test: selector,
  });
  assert.equal(nextPlan.activeRuntimeDirectory, plan.activeRuntimeDirectory);
  assert.notEqual(nextPlan.outputDirectory, plan.outputDirectory);
  assert.doesNotThrow(() => assertDevelopmentBuildReuse(prepared, source, nextPlan));
});

test("reuse rejects foreign prepared scope, acceptance labels, runtime, and mutable context", async (t) => {
  const f = await fixture(t);
  const source = await developmentSourceFingerprint(f.workspace);
  const plan = f.plan();
  const prepared = preparedFor(plan, source);
  for (const changes of [
    { version: 2 },
    { role: "QUALIFICATION" },
    { qualification: true },
    { workspace: path.join(f.workspace, "foreign") },
    { profile: "harborlight-phase2" },
    { node: "v0.0.0" },
    { activeRuntimeDirectory: path.join(f.workspace, "foreign-runtime") },
  ]) {
    assert.throws(
      () => assertDevelopmentBuildReuse({ ...prepared, ...changes }, source, plan),
      /DEVELOPMENT_PREPARED_SCOPE_MISMATCH/u,
    );
  }
  assert.throws(
    () => assertDevelopmentBuildReuse(prepared, source, { ...plan, profile: "other" }),
    /DEVELOPMENT_PREPARED_SCOPE_MISMATCH/u,
  );
  const otherCandidatePlan = createDevelopmentBrowserPlan({
    workspace: f.workspace,
    outputDirectory: f.outputDirectory,
    candidateSha: "f".repeat(40),
    test: selector,
  });
  assert.throws(
    () => assertDevelopmentBuildReuse(prepared, source, otherCandidatePlan),
    /DEVELOPMENT_PREPARED_SCOPE_MISMATCH/u,
  );
  for (const databaseName of [
    "../outside.db",
    "/tmp/outside.db",
    "generic.db",
    "validation-isolated-20261017-123456789-0123456789abcdef0123456789abcdef.db/../outside",
  ]) {
    assert.throws(
      () => assertDevelopmentBuildReuse({ ...prepared, databaseName }, source, plan),
      /DEVELOPMENT_DATABASE_BASENAME_INVALID/u,
    );
  }
});

test("development diagnostic context binds source identity without granting acceptance", async (t) => {
  const f = await fixture(t),
    source = await developmentSourceFingerprint(f.workspace),
    plan = f.plan();
  const binding = developmentDiagnosticBinding(source);
  assert.deepEqual(binding, { baseSha: source.head, candidateSha: source.head, planDigest: source.digest });
  const session = createBrowserDiagnosticSession(f.workspace, binding);
  const environment = session.beginScope();
  assert.deepEqual(Object.keys(environment), [BROWSER_DIAGNOSTIC_CONTEXT]);
  const context = JSON.parse(environment[BROWSER_DIAGNOSTIC_CONTEXT]);
  assert.deepEqual(
    Object.keys(context).sort(),
    ["version", "runId", "scopeId", "baseSha", "candidateSha", "planDigest"].sort(),
  );
  assert.equal(context.baseSha, source.head);
  assert.equal(context.candidateSha, source.head);
  assert.equal(plan.role, "DEVELOPMENT_ONLY");
  assert.equal(plan.qualification, false);
  session.clearScope();
  assert.deepEqual(await session.read(), { binding: null, runtime: null, profile: null });
});

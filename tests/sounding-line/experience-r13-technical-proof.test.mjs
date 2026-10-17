// Inert source and policy fixtures only. Never execute dependency or product setup.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { createTechnicalProof } from "../../scripts/sounding-line/experience-technical-proof.mjs";
import { r12TechnicalMarkerPath } from "../../scripts/sounding-line/experience-r12-technical-proof.mjs";
import {
  R13_TECHNICAL,
  assertR13ReadinessFocusedBinding,
  r13TechnicalBrowserArguments,
  r13TechnicalEnvironment,
  r13TechnicalMarkerPath,
  r13TechnicalSuiteArguments,
  requireR13TechnicalSuite,
  runR13TechnicalProof,
} from "../../scripts/sounding-line/experience-r13-technical-proof.mjs";

function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), "r13-inert-source-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  git("init", "-q");
  git("config", "user.name", "Synthetic test");
  git("config", "user.email", "synthetic@example.invalid");
  mkdirSync(path.join(root, "src"));
  writeFileSync(path.join(root, "src/example.ts"), "export const value=1;\n");
  writeFileSync(path.join(root, ".gitignore"), "artifacts/\ntest-results/\n");
  git("add", ".");
  git("commit", "-qm", "inert source");
  const candidateSha = git("rev-parse", "HEAD");
  const manifest = {
    baseSha: candidateSha,
    candidateSha,
    candidateTree: git("rev-parse", "HEAD^{tree}"),
    sourceDigest: "a".repeat(64),
    contractDigest: "b".repeat(64),
    recordDigest: "c".repeat(64),
  };
  return { root, baseSha: candidateSha, candidateSha, manifest, record: { id: "SYNTHETIC_NO_GRANT" } };
}

test("R13 uses a distinct finite namespace and the unchanged exact technical case", (t) => {
  const f = fixture(t);
  assert.notEqual(r13TechnicalMarkerPath(f.root, "original"), r12TechnicalMarkerPath(f.root, "original"));
  assert.match(r13TechnicalMarkerPath(f.root, "corrected"), /crossdeck-r13-focused-corrected\.json$/u);
  assert.match(R13_TECHNICAL.publicationDirectory, /r13-verification-20261017\/focused-technical$/u);
  assert.deepEqual(r13TechnicalBrowserArguments(), [
    "tests/e2e/crossdeck-phase2.spec.ts",
    "--grep",
    "crossdeck\\.surface-handoff$",
    "--workers",
    "1",
    "--retries",
    "0",
    "--repeat-each",
    "1",
    "--reporter",
    "json",
  ]);
  const args = r13TechnicalSuiteArguments({
    ...f,
    stage: "original",
    databaseUrl: "file:/owned/validation-isolated-test.db",
  });
  assert.ok(args.includes("--r13-technical-proof"));
  assert.ok(args.includes("--r13-base"));
  assert.ok(!args.includes("--r12-technical-proof"));
});

test("R13 refuses a case before readiness without consuming its case namespace", async (t) => {
  const f = fixture(t);
  let executions = 0;
  await assert.rejects(
    runR13TechnicalProof({
      ...f,
      stage: "original",
      admission: async () => ({ record: f.record, manifest: f.manifest }),
      execute: async () => {
        executions++;
        throw Error("Synthetic execution must remain unreachable");
      },
    }),
  );
  assert.equal(executions, 0);
  assert.equal(existsSync(r13TechnicalMarkerPath(f.root, "original")), false);
  assert.equal(existsSync(r13TechnicalMarkerPath(f.root, "original", true)), false);
  assert.equal(existsSync(r12TechnicalMarkerPath(f.root, "original")), false);
});

test("R13 raw child cannot enter setup or create a launch without its exact reserved case", async (t) => {
  const f = fixture(t);
  await assert.rejects(
    requireR13TechnicalSuite({
      root: f.root,
      candidateSha: f.candidateSha,
      options: { "r13-technical-proof": "original", "r13-base": f.baseSha },
      browserTests: r13TechnicalBrowserArguments(),
      argv: [],
      environment: {},
    }),
    /RESERVATION_REQUIRED/u,
  );
  assert.equal(existsSync(r13TechnicalMarkerPath(f.root, "original", true)), false);
});

test("R13 strips transport, checksum bypass, engine override and readiness spoofing environment", () => {
  assert.deepEqual(
    r13TechnicalEnvironment({
      PATH: "/synthetic",
      HOME: "/owned",
      PLAYWRIGHT_BROWSERS_PATH: "/owned/browsers",
      NODE_OPTIONS: "forbidden",
      NODE_USE_ENV_PROXY: "1",
      NODE_EXTRA_CA_CERTS: "/external",
      HTTPS_PROXY: "https://external.invalid",
      PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING: "1",
      PRISMA_QUERY_ENGINE_LIBRARY: "/external/engine",
      PRISMA_SCHEMA_ENGINE_BINARY: "/external/schema",
      PRISMA_ENGINES_MIRROR: "https://external.invalid",
      XDG_CACHE_HOME: "/external/cache",
      SOUNDING_LINE_READINESS_MARKER: "/forged",
      SOUNDING_LINE_R13_READINESS_ATTEMPT: "1",
      GH_TOKEN: "secret",
      CROSSDECK_ANDROID_CDP: "forbidden",
    }),
    { PATH: "/synthetic", HOME: "/owned", PLAYWRIGHT_BROWSERS_PATH: "/owned/browsers" },
  );
});

test("Shared runner rejects caller-defined profiles", () => {
  for (const value of [undefined, 11, 14, "13", {}, { version: 13 }])
    assert.throws(() => createTechnicalProof(value), /TECHNICAL_PROFILE_INVALID/u);
});

test("R13 published readiness must bind every focused source and admission field", () => {
  const receipt = {
    stage: "corrected",
    baseSha: "a".repeat(40),
    candidateSha: "b".repeat(40),
    candidateTree: "c".repeat(40),
    sourceDigest: "d".repeat(64),
    contractDigest: "e".repeat(64),
    recordDigest: "f".repeat(64),
  };
  const marker = {
    sourceManifestSha256: "1".repeat(64),
    readinessReceiptSha256: "2".repeat(64),
    readinessAttempt: 2,
    proofRoot: "/synthetic/proof",
    databaseUrl: "file:/synthetic/proof/owned.db",
  };
  const readiness = {
    binding: { ...receipt, sourceManifestSha256: marker.sourceManifestSha256 },
    receiptSha256: marker.readinessReceiptSha256,
    attempt: 2,
    proofRoot: marker.proofRoot,
    databaseUrl: marker.databaseUrl,
  };
  assert.doesNotThrow(() => assertR13ReadinessFocusedBinding({ readiness, receipt, marker }));
  for (const field of ["proofRoot", "databaseUrl"])
    assert.throws(
      () => assertR13ReadinessFocusedBinding({ readiness: { ...readiness, [field]: "different" }, receipt, marker }),
      /PUBLISHED_READINESS_BINDING_CHANGED/u,
    );
  for (const field of [
    "baseSha",
    "candidateSha",
    "candidateTree",
    "sourceDigest",
    "contractDigest",
    "recordDigest",
    "sourceManifestSha256",
    "stage",
  ])
    assert.throws(
      () =>
        assertR13ReadinessFocusedBinding({
          readiness: { ...readiness, binding: { ...readiness.binding, [field]: "different" } },
          receipt,
          marker,
        }),
      /PUBLISHED_READINESS_(?:SOURCE|BINDING)_CHANGED/u,
    );
});

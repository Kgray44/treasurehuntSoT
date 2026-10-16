import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  existsSync,
  renameSync,
  symlinkSync,
} from "node:fs";
import { gunzipSync } from "node:zlib";
import { generateDocumentIndex } from "../../scripts/generate-document-index.mjs";
import { validate as validateDocumentation } from "../../scripts/validate-documentation.mjs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { createCustodyRequest } from "../../scripts/sounding-line/custody-transport.mjs";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  R8_FORMAT,
  R8_RAW_ORIGINALS,
  R8_FORMAT_OVERLAY_PATHS,
  validateR8FormatRecord,
  validateR8FormatOverlay,
  validateR8RawIdentity,
  r8FormatEvidencePlan,
  assertR8FormatMode,
  validateR8FormatCustody,
  validateR8FormatPublication,
  validateR8RawOriginals,
  bindR8FormatReconciliation,
  pendingR8FormatReconciliation,
  R8_FORMAT_REGENERATED_METADATA,
  R8_FORMAT_MERGED_METADATA,
} from "../../scripts/sounding-line/experience-r8-format.mjs";
import { validatePairedPublication } from "../../scripts/sounding-line/experience-paired.mjs";
import {
  CROSSDECK_R2,
  CROSSDECK_R3,
  CROSSDECK_R4,
  CROSSDECK_R5,
  CROSSDECK_R6,
  CROSSDECK_R7,
  CROSSDECK_R8,
  CROSSDECK_R9,
  bindExperienceException,
  assertExceptionExecution,
  campaignRelated,
  claimExceptionPhase,
  exceptionBinding,
  exceptionStore,
  requireExceptionPhase,
  requireSuccessfulReservation,
  sealedReviewIdentity,
  validateExceptionEvidence,
  validateExceptionRecord,
  validateExceptionExecutionPlan,
  requireFirstCampaignRun,
  reserveExceptionStage,
  validateLiveContext,
  verifyExceptionAttestation,
  selectTrustedExceptions,
  recordBinding,
  recognizeExceptionExecution,
  historicalExceptionContext,
  sealExceptionQualification,
  validateSuccessorPredecessor,
  inspectCampaignBeforeLocalProof,
} from "../../scripts/sounding-line/experience-exception.mjs";
import {
  R9_OVERLAY_PATHS,
  pendingR9Reconciliation,
  r9HistoricalEvidencePlan,
} from "../../scripts/sounding-line/experience-r9.mjs";
import {
  validateR3Contracts,
  validateR3LocalReceipt,
  r3LocalPlan,
} from "../../scripts/sounding-line/experience-r3.mjs";
import { checkoutProbe } from "../../scripts/sounding-line/experience-checkout-probe.mjs";
import { verifyTrustedExperienceAttestation } from "../../scripts/sounding-line/experience-attestation.mjs";
import {
  planProductExperience,
  sourceSnapshot,
  productSourceDigest,
  verifyProductExperience,
} from "../../scripts/sounding-line/product-experience.mjs";
import {
  captureProductExperience,
  runTrustedExperienceReplay,
} from "../../scripts/sounding-line/experience-browser.mjs";
import {
  exceptionCommandRunner,
  run as runVerificationCommand,
  buildPlan,
  buildEvidenceObligations,
  trackedEntries,
  verificationObligationGroups,
} from "../../scripts/sounding-line/ordinary.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

// Explicit supporting source fixture: no application/browser, live API, remote
// writes or consumer execution. The normal regression suite needs no private
// task receipts. The dedicated invocation supplies preserved public receipts and
// already fetched immutable Git objects in this owned maintenance repository.
if (process.env.SOUNDING_LINE_R8_FORMAT_SOURCE_FIXTURE)
  test(
    "R8 format real Git integration binds pending reservation, original proof and one current qualification",
    { timeout: 180_000 },
    async (t) => {
      const artifactRoot = path.resolve(process.env.SOUNDING_LINE_R8_FORMAT_SOURCE_FIXTURE);
      const metadataSha = process.env.SOUNDING_LINE_R8_FORMAT_METADATA_SHA ?? R8_FORMAT.publicationCandidateSha;
      const invoke = (cwd, args, options = {}) =>
        execFileSync("git", args, {
          cwd,
          encoding: "utf8",
          maxBuffer: 64 * 1024 * 1024,
          stdio: ["pipe", "pipe", "pipe"],
          ...options,
        }).trim();
      const baseSha = invoke(repo, ["rev-parse", "HEAD"]);
      assert.notEqual(baseSha, R8_FORMAT.baseSha);
      assert.equal(productSourceDigest(sourceSnapshot(repo, metadataSha)), R8_FORMAT.sourceDigest);
      const record = JSON.parse(invoke(repo, ["show", `${baseSha}:${R8_FORMAT.registry}`])).exceptions.find(
        (value) => value.id === CROSSDECK_R8.id,
      );
      const reconciliation = JSON.parse(invoke(repo, ["show", `${baseSha}:${R8_FORMAT.registry}`])).reconciliations[0];
      validateR8FormatRecord(reconciliation);
      const owned = mkdtempSync(path.join(tmpdir(), "r8-format-integration-"));
      const checkout = path.join(owned, "checkout"),
        index = path.join(owned, "index");
      assert(owned.startsWith(path.resolve(tmpdir()) + path.sep));
      t.after(() => {
        if (existsSync(path.join(checkout, ".git"))) invoke(repo, ["worktree", "remove", "--force", checkout]);
        rmSync(owned, { recursive: true, force: true });
      });
      const withIndex = { env: { ...process.env, GIT_INDEX_FILE: index } };
      const merge = spawnSync("git", ["merge-tree", "--write-tree", baseSha, metadataSha], {
        cwd: repo,
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
      });
      assert([0, 1].includes(merge.status), merge.stderr);
      const tree = merge.stdout.split(/\r?\n/u)[0];
      assert(/^[a-f0-9]{40}$/u.test(tree));
      const conflicts = [...merge.stdout.matchAll(/^\d{6} [a-f0-9]{40} [123]\t(.+)$/gmu)].map((value) => value[1]);
      assert(
        conflicts.every((file) => R8_FORMAT_REGENERATED_METADATA.includes(file)),
        merge.stdout,
      );
      const provisionalSha = invoke(
        repo,
        [
          "-c",
          "user.name=Fixture",
          "-c",
          "user.email=fixture@example.test",
          "commit-tree",
          tree,
          "-p",
          baseSha,
          "-p",
          metadataSha,
        ],
        { input: "Nonexecuting reconciliation fixture\n" },
      );
      invoke(repo, ["worktree", "add", "--no-checkout", "--detach", checkout, provisionalSha]);
      invoke(checkout, ["-c", "core.longpaths=true", "read-tree", "-mu", "HEAD"]);
      const generated = await generateDocumentIndex({ root: checkout, baseRef: baseSha });
      assert(generated.recordCount > 0);
      const union = JSON.parse(readFileSync(path.join(checkout, R8_FORMAT_REGENERATED_METADATA[0]), "utf8"));
      const paths = new Set(union.records.map((entry) => entry.path));
      const treePaths = (revision) => new Set(invoke(repo, ["ls-tree", "-r", "--name-only", revision]).split(/\r?\n/u));
      const mergedPaths = treePaths(tree),
        sourcePaths = treePaths(metadataSha),
        originalPaths = treePaths(R8_FORMAT.baseSha);
      for (const revision of [metadataSha, baseSha])
        for (const entry of JSON.parse(invoke(repo, ["show", `${revision}:${R8_FORMAT_REGENERATED_METADATA[0]}`]))
          .records)
          if (mergedPaths.has(entry.path)) assert(paths.has(entry.path), `Union inventory lost ${entry.path}`);
          else assert(originalPaths.has(entry.path) && !sourcePaths.has(entry.path), `Maintenance lost ${entry.path}`);
      const matrixRows = readFileSync(path.join(checkout, R8_FORMAT_REGENERATED_METADATA[1]), "utf8")
        .trim()
        .split(/\r?\n/u);
      const matrix = new Set(matrixRows);
      assert.equal(matrix.size, matrixRows.length, "Duplicate migration rows");
      const oldPaths = matrixRows.slice(1).map((row) => row.match(/^"((?:[^"]|"")*)",/u)?.[1]);
      assert(oldPaths.every((file) => typeof file === "string"));
      assert.equal(new Set(oldPaths).size, oldPaths.length, "Duplicate or conflicting migration paths");
      const renamed = new Map(
        invoke(checkout, ["diff", "--name-status", "-M", baseSha, "--"])
          .split(/\r?\n/u)
          .map((line) => line.split("\t"))
          .filter(([status]) => /^R\d+$/u.test(status))
          .map(([, before, after]) => [before, after]),
      );
      for (const revision of [metadataSha, baseSha])
        for (const row of invoke(repo, ["show", `${revision}:${R8_FORMAT_REGENERATED_METADATA[1]}`]).split(/\r?\n/u)) {
          if (matrix.has(row)) continue;
          const fields = [...row.matchAll(/"((?:[^"]|"")*)"/gu)].map((match) => match[1].replaceAll('""', '"'));
          assert.equal(fields.length, 12, `Invalid published migration row: ${row}`);
          const target = renamed.get(fields[0]);
          assert(target && mergedPaths.has(target), `Unexplained migration loss from ${revision}: ${row}`);
          fields[5] = target;
          fields[6] = "move";
          const relocated = fields.map((value) => `"${value.replaceAll('"', '""')}"`).join(",");
          assert(matrix.has(relocated), `Union migration inventory lost the observed relocation of ${fields[0]}`);
        }
      assert.deepEqual(await validateDocumentation(checkout), []);
      invoke(checkout, ["add", "--", ...R8_FORMAT_REGENERATED_METADATA]);
      const finalTree = invoke(checkout, ["write-tree"]);
      const candidateSha = invoke(
        repo,
        [
          "-c",
          "user.name=Fixture",
          "-c",
          "user.email=fixture@example.test",
          "commit-tree",
          finalTree,
          "-p",
          baseSha,
          "-p",
          metadataSha,
        ],
        { input: "Regenerated publication union fixture\n" },
      );
      invoke(checkout, ["-c", "core.longpaths=true", "reset", "--hard", candidateSha]);
      for (const entry of R8_RAW_ORIGINALS)
        assert(existsSync(path.join(checkout, entry.path)), `Missing owned fixture: ${entry.path}`);
      const changedPaths = invoke(checkout, ["diff", "--name-only", "--no-renames", baseSha, candidateSha]).split(
        /\r?\n/u,
      );
      const full = planProductExperience({ root: checkout, baseSha, candidateSha, changedPaths, prNumber: 721 });
      assert.equal(full.exception.id, CROSSDECK_R8.id);
      assert.equal(full.contextCount, 38);
      const pending = {
        baseSha,
        candidateSha,
        sourceDigest: productSourceDigest(sourceSnapshot(checkout, candidateSha)),
        contractDigest: record.contractDigest,
        exception: recordBinding(record),
      };
      pending.exception.nonExecutingReconciliation = pendingR8FormatReconciliation({
        root: checkout,
        baseSha,
        plan: pending,
        record,
      });
      assert.deepEqual(exceptionBinding(pending), exceptionBinding(full));
      const historical = r8FormatEvidencePlan(full);
      const evidence = JSON.parse(
        invoke(checkout, ["show", `${metadataSha}:Development_Docs/Testing/Product_Experience/candidate-review.json`]),
      );
      validatePairedPublication({ root: checkout, plan: historical, binding: evidence.pairedEvidence.binding });
      const originals = JSON.parse(
        readFileSync(path.join(artifactRoot, "authenticated-submission3-custody-seals.verified.json"), "utf8"),
      );
      const prepare = JSON.parse(
        readFileSync(path.join(artifactRoot, "preparation18-reservation.verified.json"), "utf8"),
      );
      assert.deepEqual(sealedReviewIdentity(historical, evidence), originals.reviewSeal.reviewIdentity);
      const api = await r8ApiFixture(t);
      api.commits.set(R8_FORMAT.baseSha, structuredClone(api.commits.get(api.plan.baseSha)));
      api.commits.set(baseSha, structuredClone(api.commits.get(api.plan.baseSha)));
      const pin = async (slot, observed) => {
        const { commitSha, ...payload } = observed;
        const created = await api.store.create(slot, payload);
        api.commits.set(commitSha, structuredClone(api.commits.get(created.commitSha)));
        api.refs.set(`refs/tags/sounding-line-exceptions/${CROSSDECK_R8.id}/${slot}`, {
          object: { type: "commit", sha: commitSha },
        });
      };
      await pin("prepare", prepare);
      await pin("capture", originals.captureSeal);
      await pin("review-submit", originals.submission);
      await pin("review7", originals.reviewSeal);
      api.runs.delete(api.current.runId);
      api.runs.set(R8_FORMAT.prepareRun, remoteRun(prepare.run, "completed", "success"));
      api.runs.set(R8_FORMAT.reviewRun, remoteRun(originals.reviewSeal.run, "completed", "success"));
      for (const [id, digest, runId] of [
        [R8_FORMAT.captureArtifact, R8_FORMAT.captureDigest, R8_FORMAT.prepareRun],
        [R8_FORMAT.reviewArtifact, R8_FORMAT.reviewDigest, R8_FORMAT.reviewRun],
      ])
        api.artifacts.set(id, { id, digest, expired: false, workflow_run: { id: runId } });
      const current = {
        ...api.current,
        runId: 39999000000,
        createdAt: "2026-10-16T16:00:00Z",
        headSha: baseSha,
        displayTitle: `Sounding Line finite 1 ordinary 721 ${candidateSha} active`,
      };
      api.runs.set(current.runId, remoteRun(current));
      api.operations.length = 0;
      const capture = {
        exception: historical.exception,
        exceptionPreparationReservation: prepare.commitSha,
        trustedArtifact: originals.captureSeal.provenance,
      };
      const review = {
        exception: historical.exception,
        exceptionPreparationReservation: prepare.commitSha,
        exceptionReviewSeal: originals.reviewSeal.commitSha,
      };
      await verifyExceptionAttestation({
        root: checkout,
        plan: full,
        evidence,
        capture,
        review,
        request: api.request,
        now: new Date(current.createdAt),
      });
      await reserveExceptionStage({
        root: checkout,
        record,
        plan: pending,
        mode: "ordinary",
        run: current,
        store: api.store,
        request: api.request,
        now: new Date(current.createdAt),
      });
      const qualifier = await api.store.read("qualify");
      assert.deepEqual(qualifier.binding, exceptionBinding(full));
      assert.equal(qualifier.candidateSha, candidateSha);
      const after = planProductExperience({ root: checkout, baseSha, candidateSha, changedPaths, prNumber: 721 });
      assert.deepEqual(exceptionBinding(after), exceptionBinding(full));
      await assert.rejects(
        () =>
          reserveExceptionStage({
            root: checkout,
            record,
            plan: pending,
            mode: "ordinary",
            run: current,
            store: api.store,
            request: api.request,
          }),
        /QUALIFICATION_ALREADY_CONSUMED/u,
      );
      for (const mode of ["capture", "review"])
        await assert.rejects(
          () =>
            reserveExceptionStage({
              root: checkout,
              record,
              plan: pending,
              mode,
              run: current,
              store: api.store,
              request: api.request,
            }),
          /EXECUTION_FORBIDDEN/u,
        );
      await assert.rejects(
        () =>
          assertExceptionExecution({
            root: checkout,
            plan: full,
            kind: "experience",
            environment: { SOUNDING_LINE_PR_NUMBER: "721", SOUNDING_LINE_R8_LOCAL_LEASE: "forbidden" },
            request: api.request,
          }),
        /R8_FORMAT_EXECUTION_FORBIDDEN/u,
      );
      for (const file of [
        "testing/contracts.json",
        "Development_Docs/Projects/Project_Homeport/evidence/product-debt.csv",
        ...R8_FORMAT_MERGED_METADATA,
      ]) {
        invoke(repo, ["read-tree", candidateSha], withIndex);
        const blob = invoke(repo, ["hash-object", "-w", "--stdin"], { input: "unapproved change\n" });
        invoke(repo, ["update-index", "--add", "--cacheinfo", `100644,${blob},${file}`], withIndex);
        const badTree = invoke(repo, ["write-tree"], withIndex);
        const badCandidate = invoke(
          repo,
          [
            "-c",
            "user.name=Fixture",
            "-c",
            "user.email=fixture@example.test",
            "commit-tree",
            badTree,
            "-p",
            candidateSha,
          ],
          { input: "Rejected fixture\n" },
        );
        assert.throws(
          () => bindR8FormatReconciliation({ root: checkout, baseSha, candidateSha: badCandidate, plan: full, record }),
          /PUBLICATION_SCOPE_CHANGED|REVIEWED_SOURCE_CHANGED|MERGED_METADATA_CHANGED/u,
        );
      }
      t.diagnostic(
        JSON.stringify({
          classification: "NONEXECUTING_SYNTHETIC_SOURCE_FIXTURE_NOT_QUALIFICATION",
          baseSha,
          candidateSha,
          originalBase: historical.baseSha,
          originalSource: historical.sourceDigest,
          currentSource: full.sourceDigest,
          fakeQualifyCreates: 1,
          liveRequests: 0,
          consumerExecutions: 0,
          regeneratedIndices: 2,
          preservedConsumerAndAuthorityIndexPaths: true,
        }),
      );
    },
  );

function formatReconciliationFixture() {
  const originalBase = new Map(),
    acceptedBase = new Map(),
    originalSource = new Map(),
    candidate = new Map();
  const overlay = R8_FORMAT_OVERLAY_PATHS.map((file, i) => {
    const oldBlob = String(i + 1).padStart(40, "0"),
      newBlob = String(i + 101).padStart(40, "0");
    originalBase.set(file, `100644 blob ${oldBlob}`);
    originalSource.set(file, `100644 blob ${oldBlob}`);
    acceptedBase.set(file, `100644 blob ${newBlob}`);
    candidate.set(file, `100644 blob ${newBlob}`);
    return { path: file, oldMode: "100644", oldBlob, newMode: "100644", newBlob };
  });
  for (const file of [
    "src/editor.tsx",
    "tests/e2e/product.spec.ts",
    "testing/contracts.json",
    "package-lock.json",
    ".gitattributes",
  ])
    for (const map of [originalBase, acceptedBase, originalSource, candidate])
      map.set(file, `100644 blob ${"a".repeat(40)}`);
  for (const map of [originalBase, originalSource]) map.set(R8_FORMAT.registry, `100644 blob ${"b".repeat(40)}`);
  for (const map of [acceptedBase, candidate]) map.set(R8_FORMAT.registry, `100644 blob ${"c".repeat(40)}`);
  const record = {
    version: 1,
    id: R8_FORMAT.id,
    status: "ACTIVE",
    exceptionId: CROSSDECK_R8.id,
    recordDigest: CROSSDECK_R8.recordDigest,
    overlay,
    captureSeal: R8_FORMAT.captureSeal,
    reviewSeal: R8_FORMAT.reviewSeal,
    reviewSubmission: R8_FORMAT.reviewSubmission,
    reviewArtifact: { id: R8_FORMAT.reviewArtifact, digest: R8_FORMAT.reviewDigest, runId: R8_FORMAT.reviewRun },
  };
  const descriptor = {
    version: 1,
    id: R8_FORMAT.id,
    recordDigest: createHash("sha256").update(JSON.stringify(record)).digest("hex"),
    originalBaseSha: R8_FORMAT.baseSha,
    originalSourceDigest: R8_FORMAT.sourceDigest,
    originalPublicationCandidateSha: R8_FORMAT.publicationCandidateSha,
    currentBaseSha: "d".repeat(40),
    currentSourceDigest: "e".repeat(64),
    overlay,
    captureSeal: record.captureSeal,
    reviewSeal: record.reviewSeal,
    reviewSubmission: record.reviewSubmission,
    reviewArtifact: record.reviewArtifact,
  };
  const plan = {
    baseSha: descriptor.currentBaseSha,
    candidateSha: "f".repeat(40),
    sourceDigest: descriptor.currentSourceDigest,
    contractDigest: R8_FORMAT.contractDigest,
    exception: {
      id: CROSSDECK_R8.id,
      recordDigest: CROSSDECK_R8.recordDigest,
      priorRepairRecaptureAttempts: 11,
      independentReviewOrdinal: 7,
      nonExecutingReconciliation: descriptor,
    },
  };
  return { record, originalBase, acceptedBase, originalSource, candidate, descriptor, plan };
}

test("R8 format reconciliation accepts only its complete exact accepted overlay", () => {
  const f = formatReconciliationFixture();
  validateR8FormatOverlay(f);
  for (const mapName of ["acceptedBase", "candidate"])
    for (const replacement of [`100755 blob ${"9".repeat(40)}`, `100644 blob ${"9".repeat(40)}`]) {
      const broken = formatReconciliationFixture();
      broken[mapName].set(".prettierignore", replacement);
      assert.throws(() => validateR8FormatOverlay(broken), /OVERLAY_CHANGED/u);
    }
  for (const file of [
    "src/editor.tsx",
    "tests/e2e/product.spec.ts",
    "testing/contracts.json",
    "package-lock.json",
    ".gitattributes",
  ]) {
    const broken = formatReconciliationFixture();
    broken.candidate.set(file, `100644 blob ${"9".repeat(40)}`);
    assert.throws(() => validateR8FormatOverlay(broken), /REVIEWED_SOURCE_CHANGED/u);
  }
  const extra = formatReconciliationFixture();
  extra.acceptedBase.set("scripts/unapproved.mjs", `100644 blob ${"9".repeat(40)}`);
  assert.throws(() => validateR8FormatOverlay(extra), /BASE_SCOPE_CHANGED/u);
  const changedRegistry = formatReconciliationFixture();
  changedRegistry.candidate.delete(R8_FORMAT.registry);
  assert.throws(() => validateR8FormatOverlay(changedRegistry), /REGISTRY_CHANGED/u);
  const missing = formatReconciliationFixture();
  missing.record.overlay.pop();
  assert.throws(() => validateR8FormatRecord(missing.record), /RECORD_INVALID/u);
});

test("R8 publication indexes can regenerate while accepted overlay and runtime pins remain exact", () => {
  for (const file of [...R8_FORMAT_REGENERATED_METADATA, ...R8_FORMAT_MERGED_METADATA]) {
    const f = formatReconciliationFixture();
    f.candidate.set(file, `100644 blob ${"9".repeat(40)}`);
    validateR8FormatOverlay(f); // Merged README content is additionally checked against the exact clean merge in Git admission.
    f.candidate.set(file, `100755 blob ${"9".repeat(40)}`);
    assert.throws(() => validateR8FormatOverlay(f), /OVERLAY_CHANGED/u);
    f.candidate.set(file, `100644 blob ${"9".repeat(40)}`);
    f.acceptedBase.set(file, `100644 blob ${"8".repeat(40)}`);
    assert.throws(() => validateR8FormatOverlay(f), /OVERLAY_CHANGED/u);
  }
});

test("R8 historical validation keeps the actual execution plan and original tuple distinct", () => {
  const f = formatReconciliationFixture();
  const before = JSON.stringify(f.plan);
  const historical = r8FormatEvidencePlan(f.plan);
  assert.equal(historical.baseSha, R8_FORMAT.baseSha);
  assert.equal(historical.sourceDigest, R8_FORMAT.sourceDigest);
  assert.equal(historical.candidateSha, R8_FORMAT.publicationCandidateSha);
  assert.equal(historical.exception.nonExecutingReconciliation, undefined);
  assert.equal(JSON.stringify(f.plan), before);
  for (const field of [
    "currentBaseSha",
    "currentSourceDigest",
    "originalBaseSha",
    "originalSourceDigest",
    "recordDigest",
  ]) {
    const broken = structuredClone(f.plan);
    broken.exception.nonExecutingReconciliation[field] = "0".repeat(field.includes("Sha") ? 40 : 64);
    assert.throws(() => r8FormatEvidencePlan(broken), /BINDING_CHANGED/u);
  }
  for (const mode of ["capture", "review", "local", "prepare"])
    assert.throws(() => assertR8FormatMode(f.plan, mode), /EXECUTION_FORBIDDEN/u);
  for (const mode of ["ordinary", "qualify", "verify"]) assertR8FormatMode(f.plan, mode);
});

test("raw formatter exemptions require both immutable Git identity and actual bytes", () => {
  assert.equal(R8_RAW_ORIGINALS.length, 5);
  const bytes = Buffer.from('{"raw":true}\n');
  const expected = { blob: "a".repeat(40), sha256: createHash("sha256").update(bytes).digest("hex") };
  validateR8RawIdentity(expected, `100644 blob ${expected.blob}`, bytes);
  for (const metadata of [
    `100755 blob ${expected.blob}`,
    `120000 blob ${expected.blob}`,
    `100644 blob ${"b".repeat(40)}`,
    undefined,
  ])
    assert.throws(() => validateR8RawIdentity(expected, metadata, bytes), /RAW_ORIGINAL_CHANGED/u);
  assert.throws(
    () => validateR8RawIdentity(expected, `100644 blob ${expected.blob}`, Buffer.from('{ "raw": true }\n')),
    /RAW_ORIGINAL_CHANGED/u,
  );
});

test("permanent raw guard observes actual Git and filesystem changes for all five originals", (t) => {
  const root = mkdtempSync(path.join(tmpdir(), "r8-raw-originals-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) =>
    execFileSync("git", ["-c", "user.name=Fixture", "-c", "user.email=fixture@example.test", ...args], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  git("init", "--quiet");
  git("config", "core.autocrlf", "false");
  const data = JSON.parse(
    readFileSync(path.join(repo, "tests/sounding-line/fixtures/r8-format-originals.json"), "utf8"),
  );
  assert.deepEqual(
    data.map((entry) => entry.path),
    R8_RAW_ORIGINALS.map((entry) => entry.path),
  );
  for (const entry of data) {
    const file = path.join(root, entry.path);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, gunzipSync(Buffer.from(entry.gzipBase64, "base64")));
  }
  git("add", ".");
  git("commit", "--quiet", "-m", "originals");
  const baseSha = git("rev-parse", "HEAD");
  validateR8RawOriginals({ root, baseSha, candidateSha: baseSha });
  for (const entry of data) {
    const file = path.join(root, entry.path),
      original = readFileSync(file);
    writeFileSync(file, Buffer.concat([original, Buffer.from(" ")]));
    assert.throws(() => validateR8RawOriginals({ root, baseSha, candidateSha: baseSha }), /RAW_ORIGINAL_CHANGED/u);
    git("add", entry.path);
    const dirtyTree = git("write-tree");
    assert.throws(() => validateR8RawOriginals({ root, baseSha, candidateSha: dirtyTree }), /RAW_ORIGINAL_CHANGED/u);
    writeFileSync(file, original);
    git("read-tree", baseSha);
    git("update-index", "--chmod=+x", entry.path);
    const executableTree = git("write-tree");
    assert.throws(
      () => validateR8RawOriginals({ root, baseSha, candidateSha: executableTree }),
      /RAW_ORIGINAL_CHANGED/u,
    );
    git("read-tree", baseSha);
    git("update-index", "--force-remove", entry.path);
    const removedTree = git("write-tree");
    assert.throws(() => validateR8RawOriginals({ root, baseSha, candidateSha: removedTree }), /RAW_ORIGINAL_CHANGED/u);
    git("read-tree", baseSha);
    renameSync(file, file + ".owned-backup");
    mkdirSync(file);
    assert.throws(() => validateR8RawOriginals({ root, baseSha, candidateSha: baseSha }), /RAW_ORIGINAL_CHANGED/u);
    rmSync(file, { recursive: true });
    const target = path.join(root, "owned-link-target");
    mkdirSync(target, { recursive: true });
    symlinkSync(target, file, process.platform === "win32" ? "junction" : "dir");
    assert.throws(() => validateR8RawOriginals({ root, baseSha, candidateSha: baseSha }), /RAW_ORIGINAL_CHANGED/u);
    rmSync(file, { recursive: true });
    renameSync(file + ".owned-backup", file);
  }
  validateR8RawOriginals({ root, baseSha, candidateSha: baseSha });
});

test("R8 reconciliation preserves the existing publication boundary beyond the exact maintenance overlay", () => {
  validateR8FormatPublication([
    ...R8_FORMAT_OVERLAY_PATHS,
    R8_FORMAT.registry,
    "docs/product/features.md",
    "Development_Docs/Projects/Project_Crossdeck/evidence/current/metadata.json",
  ]);
  for (const file of [
    "Development_Docs/Projects/Project_Homeport/evidence/product-debt.csv",
    "testing/contracts.json",
    "scripts/extra.mjs",
    "package.json",
  ])
    assert.throws(() => validateR8FormatPublication([file]), /PUBLICATION_SCOPE_CHANGED/u);
});

test("R8 reused custody requires exact successful original runs, seals and artifact metadata", async () => {
  const f = formatReconciliationFixture();
  const slots = new Map([
    ["prepare", [R8_FORMAT.prepareCommit, R8_FORMAT.prepareRun]],
    ["capture", [R8_FORMAT.captureSeal, R8_FORMAT.prepareRun]],
    ["review7", [R8_FORMAT.reviewSeal, R8_FORMAT.reviewRun]],
    ["review-submit", [R8_FORMAT.reviewSubmission, R8_FORMAT.reviewRun]],
  ]);
  const replies = new Map();
  for (const id of [R8_FORMAT.prepareRun, R8_FORMAT.reviewRun])
    replies.set(`actions/runs/${id}`, {
      status: "completed",
      conclusion: "success",
      run_attempt: 1,
      head_sha: R8_FORMAT.baseSha,
      head_branch: "main",
      event: "workflow_dispatch",
      actor: { login: "Kgray44" },
      triggering_actor: { login: "Kgray44" },
    });
  for (const [id, digest, runId] of [
    [R8_FORMAT.captureArtifact, R8_FORMAT.captureDigest, R8_FORMAT.prepareRun],
    [R8_FORMAT.reviewArtifact, R8_FORMAT.reviewDigest, R8_FORMAT.reviewRun],
  ])
    replies.set(`actions/artifacts/${id}`, { id, digest, expired: false, workflow_run: { id: runId } });
  const store = {
    read: async (slot) => {
      const [commitSha, runId] = slots.get(slot) ?? [];
      return { commitSha, run: { runId } };
    },
  };
  const request = async (endpoint) => replies.get(endpoint);
  await validateR8FormatCustody({ plan: f.plan, store, request });
  for (const state of [
    { status: "in_progress", conclusion: null },
    { conclusion: "failure" },
    { run_attempt: 2 },
    { head_sha: "0".repeat(40) },
  ]) {
    const original = replies.get(`actions/runs/${R8_FORMAT.reviewRun}`);
    replies.set(`actions/runs/${R8_FORMAT.reviewRun}`, { ...original, ...state });
    await assert.rejects(
      () => validateR8FormatCustody({ plan: f.plan, store, request }),
      /ORIGINAL_RUN_NOT_SUCCESSFUL/u,
    );
    replies.set(`actions/runs/${R8_FORMAT.reviewRun}`, original);
  }
  const saved = slots.get("review7");
  slots.set("review7", ["0".repeat(40), R8_FORMAT.reviewRun]);
  await assert.rejects(() => validateR8FormatCustody({ plan: f.plan, store, request }), /ORIGINAL_CUSTODY_CHANGED/u);
  slots.set("review7", saved);
  replies.get(`actions/artifacts/${R8_FORMAT.reviewArtifact}`).digest = "sha256:" + "0".repeat(64);
  await assert.rejects(() => validateR8FormatCustody({ plan: f.plan, store, request }), /ORIGINAL_ARTIFACT_CHANGED/u);
});

function transportFixture(sequence) {
  const calls = [],
    reports = [],
    waits = [];
  const request = createCustodyRequest({
    repository: "fixture/repository",
    token: "credential-secret",
    fetchImpl: async (url, options) => {
      calls.push({ url, ...options });
      const next = sequence.shift();
      if (next instanceof Error) throw next;
      if (typeof next === "function") return next(options.signal);
      assert(next, "unexpected additional transport attempt");
      return { ok: next.status >= 200 && next.status < 300, json: async () => next.value, ...next };
    },
    wait: async (ms) => {
      waits.push(ms);
    },
    report: (entry) => reports.push(entry),
  });
  return { request, calls, reports, waits };
}
test("custody transport keeps success, missing refs and policy/access failures single-attempt", async () => {
  for (const status of [200, 404, 401, 403, 429, 422]) {
    const f = transportFixture([{ status, value: { sha: "immutable" } }]);
    if (status === 200) assert.deepEqual(await f.request("git/ref/tags/fixture"), { sha: "immutable" });
    else if (status === 404) assert.equal(await f.request("git/ref/tags/fixture"), null);
    else await assert.rejects(() => f.request("git/ref/tags/fixture"), new RegExp(`CUSTODY_ACCESS_${status}`, "u"));
    assert.equal(f.calls.length, 1);
    assert.equal(f.calls[0].signal.aborted, true);
    assert.deepEqual(f.waits, []);
  }
});
test("custody transport retries one transient GET, closes each attempt and sanitizes diagnostics", async () => {
  for (const first of [
    new Error("credential-secret body-secret"),
    { status: 503 },
    {
      status: 200,
      json: async () => {
        throw new SyntaxError("body-secret");
      },
    },
  ]) {
    const f = transportFixture([first, { status: 200, value: { sha: "immutable" } }]);
    assert.deepEqual(await f.request("git/ref/tags/fixture?private=query-secret"), { sha: "immutable" });
    assert.equal(f.calls.length, 2);
    assert(f.calls.every((c) => c.signal.aborted));
    assert.deepEqual(f.waits, [250]);
    assert.equal(f.reports[0].outcome, "READ_FAILURE");
    assert.equal(f.reports[0].willRetry, true);
    assert.equal(f.reports[1].outcome, "READ_RECOVERED");
    assert.equal(f.reports[1].maximumAttempts, 2);
    assert.doesNotMatch(JSON.stringify(f.reports), /credential-secret|body-secret|query-secret|Authorization/u);
  }
});
test("custody transport exhausts exactly two reads and fails closed", async () => {
  const f = transportFixture([{ status: 502 }, new Error("fetch failed")]);
  await assert.rejects(() => f.request("git/ref/tags/fixture"), /CUSTODY_READ_TRANSPORT_EXHAUSTED/u);
  assert.equal(f.calls.length, 2);
  assert(f.calls.every((c) => c.signal.aborted));
  assert.deepEqual(f.waits, [250]);
  assert.equal(f.reports.at(-1).willRetry, false);
});
test("custody transport shares a finite retry budget across all reads in one invocation", async () => {
  const f = transportFixture([
    { status: 503 },
    { status: 200, value: 1 },
    new Error("fetch failed"),
    { status: 200, value: 2 },
    { status: 502 },
  ]);
  assert.equal(await f.request("git/ref/tags/one"), 1);
  assert.equal(await f.request("git/ref/tags/two"), 2);
  await assert.rejects(() => f.request("git/ref/tags/three"), /CUSTODY_READ_TRANSPORT_EXHAUSTED/u);
  assert.equal(f.calls.length, 5);
  assert.deepEqual(f.waits, [250, 250]);
  assert.equal(f.reports.at(-1).willRetry, false);
});
test("custody transport never retries writes, including unknown responses and consumed refs", async () => {
  for (const method of ["POST", "PATCH", "DELETE"]) {
    for (const first of [
      new Error("fetch failed"),
      { status: 503 },
      { status: 409 },
      { status: 422 },
      {
        status: 201,
        json: async () => {
          throw new Error("lost response");
        },
      },
    ]) {
      const f = transportFixture([first]);
      await assert.rejects(
        () => f.request("git/refs", method, { secret: "body-secret" }),
        /CUSTODY_WRITE_OUTCOME_UNKNOWN|SLOT_CONSUMED|CUSTODY_ACCESS_/u,
      );
      assert.equal(f.calls.length, 1);
      assert.equal(f.calls[0].signal.aborted, true);
      assert.deepEqual(f.waits, []);
      assert.doesNotMatch(JSON.stringify(f.reports), /credential-secret|body-secret/u);
    }
  }
});
test("custody transport deadlines bound hanging fetch and body reads with no surviving timers", () => {
  // Isolate the fake clock from other process/browser lifecycle tests in this worker.
  const moduleUrl = pathToFileURL(path.join(repo, "scripts/sounding-line/custody-transport.mjs")).href;
  const source = `import assert from "node:assert/strict";
    import { mock } from "node:test";
    import { setImmediate as immediate } from "node:timers/promises";
    import { createCustodyRequest, CUSTODY_TRANSPORT_POLICY } from ${JSON.stringify(moduleUrl)};
    mock.timers.enable({ apis: ["setTimeout"] });
    const hanging = signal => new Promise((resolve, reject) => signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true }));
    for (const bodyRead of [false, true]) {
      const signals = [];
      const request = createCustodyRequest({ repository: "fixture/repository", token: "synthetic",
        fetchImpl: async (url, { signal }) => { signals.push(signal); return bodyRead ? { ok: true, status: 200, json: () => hanging(signal) } : hanging(signal); },
        wait: async () => {}, report: () => {},
      });
      const terminal = assert.rejects(() => request("git/ref/tags/fixture"), /CUSTODY_READ_TRANSPORT_EXHAUSTED/u);
      await immediate();
      mock.timers.tick(CUSTODY_TRANSPORT_POLICY.requestTimeoutMs);
      await immediate();
      assert.equal(signals.length, 2);
      mock.timers.tick(CUSTODY_TRANSPORT_POLICY.requestTimeoutMs);
      await terminal;
      assert(signals.every(signal => signal.aborted));
    }
    mock.timers.reset();
    assert.equal(process.getActiveResourcesInfo().includes("Timeout"), false);
    console.log("BOUNDED_DEADLINES_PASS");`;
  const output = execFileSync(process.execPath, ["--input-type=module", "--eval", source], {
    encoding: "utf8",
    timeout: 5000,
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert.match(output, /BOUNDED_DEADLINES_PASS/u);
});
const template = JSON.parse(readFileSync(path.join(repo, "testing/product-experience-exceptions.json"), "utf8"))
  .exceptions[0];
const successorTemplate = JSON.parse(
  readFileSync(path.join(repo, "testing/product-experience-exceptions.json"), "utf8"),
).exceptions.find((record) => record.id === CROSSDECK_R2.id);
const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const now = new Date("2026-10-15T14:00:00Z");
function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), "experience-exception-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) =>
    execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  const write = (file, value) => {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), typeof value === "string" ? value : JSON.stringify(value));
  };
  const commit = () => {
    git("add", ".");
    git("commit", "-qm", "fixture");
    return git("rev-parse", "HEAD");
  };
  git("init", "-q");
  git("config", "user.name", "Fixture");
  git("config", "user.email", "fixture@example.invalid");
  for (const file of [
    "src/product.ts",
    "public/icon.txt",
    "prisma/schema.prisma",
    "scripts/sounding-line/browser-authority.mjs",
    "tests/e2e/crossdeck.spec.ts",
  ])
    write(file, "historical");
  write("package.json", { scripts: { "test:sounding-line": "old" }, dependencies: { safe: "1" } });
  for (const file of ["package-lock.json", "next.config.ts", "tsconfig.json", "playwright.config.ts"])
    write(file, "{}");
  write("testing/contracts.json", { contracts: [] });
  const historical = commit();
  write("src/product.ts", "frozen product");
  write("tests/e2e/crossdeck.spec.ts", "frozen E2E");
  const historyPath = template.immutableHistory[0].path;
  write(historyPath, { attempts: 11, reviews: 2 });
  const frozen = commit();
  const record = structuredClone(template);
  record.frozenReferenceSha = frozen;
  record.frozenHistoricalBaseSha = historical;
  record.frozenTrees = Object.fromEntries(
    ["src", "public", "prisma"].map((file) => [file, git("rev-parse", `${frozen}:${file}`)]),
  );
  record.frozenBlobs = Object.fromEntries(
    ["package.json", "package-lock.json", "next.config.ts", "tsconfig.json", "playwright.config.ts"].map((file) => [
      file,
      git("rev-parse", `${frozen}:${file}`),
    ]),
  );
  record.immutableHistory = [{ path: historyPath, blob: git("rev-parse", `${frozen}:${historyPath}`) }];
  record.protectedBaseRuntimeOverrides = [
    {
      path: "tests/e2e/crossdeck.spec.ts",
      mode: "100644",
      blob: git("rev-parse", `${frozen}:tests/e2e/crossdeck.spec.ts`),
    },
  ];
  git("checkout", "-qb", "protected", historical);
  write("scripts/sounding-line/browser-authority.mjs", "accepted lifecycle");
  write("tests/accepted-infrastructure.test.mjs", "accepted tests");
  write("package.json", { scripts: { "test:sounding-line": "accepted" }, dependencies: { safe: "1" } });
  write("testing/product-experience-exceptions.json", { version: 1, exceptions: [record] });
  const baseSha = commit();
  git("merge", "--no-edit", frozen);
  const candidateSha = git("rev-parse", "HEAD");
  const contracts = record.contractIds.map((id, index) => ({
    id,
    experience: {
      devices: ["DESKTOP", "MOBILE"],
      journeys: Array.from({ length: index === 6 ? 4 : 2 }, (_, j) => ({ id: String(j), roles: ["PLAYER"] })),
    },
  }));
  const plan = {
    applicable: true,
    baseSha,
    candidateSha,
    sourceDigest: "b".repeat(64),
    contractDigest: record.contractDigest,
    contractIds: record.contractIds,
    contracts,
  };
  plan.exception = bindExperienceException({ root, baseSha, candidateSha, plan, now });
  return { root, git, write, commit, record, plan, baseSha, candidateSha, frozen, now };
}
function apiFixture(record, plan) {
  const refs = new Map(),
    blobs = new Map(),
    trees = new Map(),
    commits = new Map(),
    runs = new Map();
  const operations = [];
  let loseNextRefResponse = false,
    failBeforeRef = false;
  const baseTree = "f".repeat(40);
  trees.set(baseTree, {
    tree: [
      { path: ".github", mode: "040000", type: "tree", sha: "e".repeat(40) },
      { path: "src", mode: "040000", type: "tree", sha: "d".repeat(40) },
    ],
  });
  commits.set(plan.baseSha, { tree: { sha: baseTree }, parents: [] });
  const request = async (endpoint, method = "GET", body) => {
    operations.push({ endpoint, method });
    if (method === "POST") {
      const sha = hash(body).slice(0, 40);
      if (endpoint === "git/blobs") {
        if (failBeforeRef) {
          failBeforeRef = false;
          throw Error("Failure before ref creation");
        }
        blobs.set(sha, { content: Buffer.from(body.content).toString("base64") });
        return { sha };
      }
      if (endpoint === "git/trees") {
        trees.set(sha, { tree: [...structuredClone(trees.get(body.base_tree)?.tree ?? []), ...body.tree] });
        return { sha };
      }
      if (endpoint === "git/commits") {
        commits.set(sha, { tree: { sha: body.tree }, parents: body.parents.map((value) => ({ sha: value })) });
        return { sha };
      }
      if (endpoint === "git/refs") {
        if (refs.has(body.ref)) throw Error("PRODUCT_EXPERIENCE_EXCEPTION_SLOT_CONSUMED");
        refs.set(body.ref, { object: { type: "commit", sha: body.sha } });
        if (loseNextRefResponse) {
          loseNextRefResponse = false;
          throw Error("Unknown network outcome");
        }
        return refs.get(body.ref);
      }
    }
    if (endpoint.startsWith("git/ref/")) return refs.get(`refs/${endpoint.slice(8)}`) ?? null;
    if (endpoint.startsWith("git/blobs/")) return blobs.get(endpoint.slice(10));
    if (endpoint.startsWith("git/trees/")) return trees.get(endpoint.slice(10));
    if (endpoint.startsWith("git/commits/")) return commits.get(endpoint.slice(12));
    if (endpoint.endsWith("/jobs?per_page=100"))
      return {
        total_count: 4,
        jobs: Array.from({ length: 4 }, () => ({ status: "completed", conclusion: "skipped" })),
      };
    if (endpoint.startsWith("actions/runs/")) return runs.get(Number(endpoint.slice(13))) ?? null;
    if (endpoint.startsWith("actions/workflows/5/runs?"))
      return { total_count: runs.size, workflow_runs: [...runs.values()] };
    if (endpoint === `pulls/${record.pullRequest}`)
      return {
        state: "open",
        base: { ref: "main" },
        head: { sha: plan.candidateSha, ref: "candidate", repo: { full_name: record.repository } },
      };
    if (endpoint === "actions/workflows/5") return { path: ".github/workflows/sounding-line-ordinary.yml" };
    throw Error(`Unexpected API ${method} ${endpoint}`);
  };
  refs.set("refs/heads/main", { object: { sha: plan.baseSha } });
  return {
    request,
    store: exceptionStore({ record, request }),
    refs,
    runs,
    operations,
    trees,
    commits,
    failBeforeRef: () => {
      failBeforeRef = true;
    },
    loseResponse: () => {
      loseNextRefResponse = true;
    },
  };
}
test("custody transport leaves an ambiguously created ref consumed without retry or refund", async (t) => {
  const f = fixture(t),
    api = apiFixture(f.record, f.plan),
    reports = [];
  const request = createCustodyRequest({
    repository: "fixture/repository",
    token: "synthetic",
    fetchImpl: async (url, options) => {
      const endpoint = url.slice("https://api.github.com/repos/fixture/repository/".length);
      const value = await api.request(endpoint, options.method, options.body ? JSON.parse(options.body) : undefined);
      return { ok: value !== null, status: value === null ? 404 : 200, json: async () => value };
    },
    report: (entry) => reports.push(entry),
  });
  const store = exceptionStore({ record: f.record, request });
  const value = { binding: exceptionBinding(f.plan), run: runIdentity(f.plan), candidateSha: f.plan.candidateSha };
  api.loseResponse();
  await assert.rejects(() => store.create("prepare", value), /CUSTODY_WRITE_OUTCOME_UNKNOWN/u);
  assert.equal(api.operations.filter((o) => o.method === "POST" && o.endpoint === "git/refs").length, 1);
  assert.equal((await store.read("prepare")).candidateSha, f.plan.candidateSha);
  await assert.rejects(() => store.create("prepare", value), /SLOT_CONSUMED/u);
  assert.equal(api.operations.filter((o) => o.method === "POST" && o.endpoint === "git/refs").length, 1);
  assert.equal(reports.at(-1).outcome, "WRITE_OUTCOME_UNKNOWN");
});
test("custody invocation shares retry budget through nested trusted attestation without changing artifact loading", async (t) => {
  const f = fixture(t),
    api = apiFixture(f.record, f.plan);
  const plan = { ...f.plan, applicable: true, attestationPolicy: { required: true } };
  const prepareRun = runIdentity(plan),
    reviewRun = runIdentity(plan, 20, "workflow_dispatch", "review");
  api.runs.set(prepareRun.runId, remoteRun(prepareRun, "completed", "success"));
  api.runs.set(reviewRun.runId, remoteRun(reviewRun, "completed", "success"));
  const binding = exceptionBinding(plan);
  const prepare = await api.store.create("prepare", { binding, run: prepareRun, candidateSha: plan.candidateSha });
  const provenance = { id: 100, digest: "sha256:" + "a".repeat(64), runId: prepareRun.runId, runAttempt: 1 };
  const evidence = { captureArtifactId: 100, reviewArtifactId: 101, artifacts: [], journeys: [], reviews: [] };
  await api.store.create("capture", { binding, run: prepareRun, provenance });
  const seal = await api.store.create("review3", {
    binding,
    run: reviewRun,
    prepareReservation: prepare.commitSha,
    reviewIdentity: sealedReviewIdentity(plan, evidence),
  });
  const capture = {
    ...evidence,
    exception: plan.exception,
    exceptionPreparationReservation: prepare.commitSha,
    trustedArtifact: provenance,
  };
  const review = {
    ...evidence,
    exception: plan.exception,
    exceptionPreparationReservation: prepare.commitSha,
    exceptionReviewSeal: seal.commitSha,
  };
  const prepareEndpoint = `git/ref/tags/${f.record.custody.namespace}/prepare`;
  const captureEndpoint = `git/ref/tags/${f.record.custody.namespace}/capture`;
  for (const exhaust of [false, true]) {
    const counts = new Map(),
      waits = [],
      loaded = [];
    const failures = new Set(["probe/before", prepareEndpoint, ...(exhaust ? [captureEndpoint] : [])]);
    const request = createCustodyRequest({
      repository: "fixture/repository",
      token: "synthetic",
      report: () => {},
      wait: async (ms) => waits.push(ms),
      fetchImpl: async (url, options) => {
        const endpoint = url.slice("https://api.github.com/repos/fixture/repository/".length);
        counts.set(endpoint, (counts.get(endpoint) ?? 0) + 1);
        if (failures.has(endpoint) && counts.get(endpoint) === 1) return { ok: false, status: 503 };
        const value = endpoint === "probe/before" ? {} : await api.request(endpoint, options.method);
        return { ok: value !== null, status: value === null ? 404 : 200, json: async () => value };
      },
    });
    await request("probe/before");
    const verify = () =>
      verifyTrustedExperienceAttestation({
        root: f.root,
        plan,
        evidence,
        custodyRequest: request,
        loadArtifact: async (options) => {
          loaded.push(options);
          return options.kind === "capture" ? capture : review;
        },
      });
    if (exhaust) await assert.rejects(verify, /CUSTODY_READ_TRANSPORT_EXHAUSTED/u);
    else assert.equal((await verify()).status, "PASS");
    assert.deepEqual(waits, [250, 250]);
    assert.equal(counts.get("probe/before"), 2);
    assert.equal(counts.get(prepareEndpoint), 2);
    assert.equal(counts.get(captureEndpoint), 1);
    assert(loaded.every((options) => !Object.hasOwn(options, "request")));
  }
  const cli = readFileSync(path.join(repo, "scripts/sounding-line/experience-exception.mjs"), "utf8");
  assert(cli.includes("verifyTrustedExperienceAttestation({ root, plan, evidence, custodyRequest: request })"));
});
function runIdentity(plan, id = 10, event = "workflow_dispatch", mode = "capture") {
  return {
    runId: id,
    runAttempt: 1,
    actor: "Kgray44",
    workflowPath: ".github/workflows/sounding-line-ordinary.yml",
    event,
    headSha: event === "workflow_dispatch" ? plan.baseSha : plan.candidateSha,
    headBranch: event === "workflow_dispatch" ? "main" : "candidate",
    createdAt: "2026-10-15T14:00:00Z",
    workflowId: 5,
    displayTitle: `Sounding Line finite 1 ${mode} 721 ${plan.candidateSha} active`,
  };
}
function remoteRun(identity, status = "in_progress", conclusion = null) {
  return {
    id: identity.runId,
    run_attempt: 1,
    event: identity.event,
    head_sha: identity.headSha,
    head_branch: identity.headBranch,
    head_repository: { full_name: template.repository },
    actor: { login: "Kgray44" },
    triggering_actor: { login: "Kgray44" },
    workflow_id: identity.workflowId,
    status,
    conclusion,
    created_at: identity.createdAt,
    display_title: identity.displayTitle,
    path: identity.workflowPath,
  };
}
function environment(plan) {
  return {
    GITHUB_ACTIONS: "true",
    GITHUB_REPOSITORY: template.repository,
    GITHUB_REF: "refs/heads/main",
    GITHUB_SHA: plan.baseSha,
    GITHUB_RUN_ATTEMPT: "1",
    GITHUB_ACTOR: "Kgray44",
    GITHUB_TRIGGERING_ACTOR: "Kgray44",
    GITHUB_WORKFLOW_REF: `${template.repository}/.github/workflows/sounding-line-ordinary.yml@refs/heads/main`,
    GITHUB_RUN_ID: "10",
  };
}
test("frozen product and tests combine only with exact accepted lifecycle runtime", (t) => {
  const f = fixture(t);
  assert.equal(f.plan.exception.priorRepairRecaptureAttempts, 11);
  assert.equal(f.plan.exception.independentReviewOrdinal, 3);
  f.write("scripts/sounding-line/browser-authority.mjs", "historical");
  const changed = f.commit();
  assert.throws(
    () => bindExperienceException({ ...f, candidateSha: changed, plan: f.plan, now }),
    /RUNTIME_BINDING_CHANGED/u,
  );
});
for (const [name, file, value, code] of [
  ["product repair", "src/product.ts", "repair", "FROZEN_PRODUCT_CHANGED"],
  ["dependency change", "package-lock.json", "changed", "FROZEN_CONFIGURATION_CHANGED"],
  [
    "package script not enumerated",
    "package.json",
    { scripts: { "test:sounding-line": "accepted", capture: "changed" }, dependencies: { safe: "1" } },
    "FROZEN_PACKAGE_CHANGED",
  ],
  ["new runtime file", "scripts/new-runtime.mjs", "extra", "RUNTIME_BINDING_CHANGED"],
  ["changed frozen E2E", "tests/e2e/crossdeck.spec.ts", "weakened", "RUNTIME_BINDING_CHANGED"],
  ["rewritten eleven history", template.immutableHistory[0].path, { attempts: 3 }, "HISTORY_CHANGED"],
])
  test(`exception rejects ${name}`, (t) => {
    const f = fixture(t);
    f.write(file, value);
    const candidateSha = f.commit();
    assert.throws(() => bindExperienceException({ ...f, candidateSha, plan: f.plan, now }), new RegExp(code, "u"));
  });
test("deleted and renamed accepted runtime paths are rejected", (t) => {
  const f = fixture(t);
  f.git("mv", "scripts/sounding-line/browser-authority.mjs", "scripts/renamed.mjs");
  const candidateSha = f.commit();
  assert.throws(() => bindExperienceException({ ...f, candidateSha, plan: f.plan, now }), /RUNTIME_BINDING_CHANGED/u);
});
test("records-only candidate and missing exception fields cannot evade campaign admission", (t) => {
  const f = fixture(t);
  assert.equal(campaignRelated({ ...f, record: f.record }), true);
  assert.throws(
    () => planProductExperience({ ...f, changedPaths: ["Development_Docs/record.md"] }),
    /PLAN_SCOPE_CHANGED/u,
  );
  assert.throws(() => validateExceptionEvidence(f.plan, { reviews: [{ iterations: 3 }] }), /EVIDENCE_BINDING_MISSING/u);
  assert.throws(
    () =>
      validateExceptionEvidence(f.plan, {
        exception: f.plan.exception,
        reviews: [{ iterations: 3, independentReviewOrdinal: 3 }],
      }),
    /HISTORY_OR_REVIEW_ORDINAL_CHANGED/u,
  );
});
test("candidate cannot activate its own registry on an older protected base", (t) => {
  const f = fixture(t);
  assert.throws(
    () => bindExperienceException({ ...f, baseSha: f.record.frozenHistoricalBaseSha, plan: f.plan, now }),
    /APPROVAL_MISSING_OR_INACTIVE/u,
  );
});
test("expiry and record enlargement fail closed", () => {
  assert.throws(() => validateExceptionRecord(template, new Date(template.expiresAt)), /EXPIRED/u);
  for (const mutation of [
    (r) => (r.priorRepairRecaptureAttempts = 3),
    (r) => (r.remainingIndependentReviewOrdinal = 4),
    (r) => (r.executionBudget.preparationPasses = 2),
    (r) => delete r.ownerApproval,
  ]) {
    const r = structuredClone(template);
    mutation(r);
    assert.throws(() => validateExceptionRecord(r, now), /RECORD_INVALID/u);
  }
});
test("atomic campaign-global reservation admits one concurrent winner and has no refund", async (t) => {
  const f = fixture(t),
    api = apiFixture(f.record, f.plan),
    value = { binding: exceptionBinding(f.plan), run: runIdentity(f.plan), candidateSha: f.candidateSha };
  const results = await Promise.allSettled([
    api.store.create("prepare", value),
    api.store.create("prepare", { ...value, candidateSha: "e".repeat(40) }),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(results.filter((r) => r.status === "rejected").length, 1);
  await assert.rejects(() => api.store.create("prepare", value), /SLOT_CONSUMED/u);
  assert.equal(
    api.operations.some((op) => !["GET", "POST"].includes(op.method)),
    false,
  );
});
test("unknown reservation publication outcome stays consumed", async (t) => {
  const f = fixture(t),
    api = apiFixture(f.record, f.plan);
  api.loseResponse();
  const value = { binding: exceptionBinding(f.plan), run: runIdentity(f.plan) };
  await assert.rejects(() => api.store.create("prepare", value), /Unknown network outcome/u);
  await assert.rejects(() => api.store.create("prepare", value), /SLOT_CONSUMED/u);
});
for (const conclusion of ["failure", "cancelled", null])
  test(`${conclusion ?? "unfinished"} capture cannot establish provenance or refund`, async (t) => {
    const f = fixture(t),
      api = apiFixture(f.record, f.plan),
      run = runIdentity(f.plan);
    await api.store.create("prepare", { binding: exceptionBinding(f.plan), run });
    api.runs.set(run.runId, remoteRun(run, conclusion ? "completed" : "in_progress", conclusion));
    await assert.rejects(
      () => requireSuccessfulReservation({ store: api.store, slot: "prepare", plan: f.plan, request: api.request }),
      /RESERVED_RUN_NOT_SUCCESSFUL/u,
    );
    await assert.rejects(
      () => api.store.create("prepare", { binding: exceptionBinding(f.plan), run }),
      /SLOT_CONSUMED/u,
    );
  });
test("live context binds both real workflow event forms and rejects stale main, head, actor and rerun", async (t) => {
  const f = fixture(t),
    api = apiFixture(f.record, f.plan),
    env = environment(f.plan);
  for (const event of ["workflow_dispatch", "pull_request_target"]) {
    api.runs.set(10, remoteRun(runIdentity(f.plan, 10, event)));
    assert.equal(
      (await validateLiveContext({ record: f.record, plan: f.plan, request: api.request, environment: env, now }))
        .event,
      event,
    );
  }
  for (const mutation of [
    (e) => (e.GITHUB_RUN_ATTEMPT = "2"),
    (e) => (e.GITHUB_ACTOR = "other"),
    (e) => (e.GITHUB_TRIGGERING_ACTOR = "other"),
    (e) => (e.GITHUB_SHA = "f".repeat(40)),
    (e) => (e.GITHUB_WORKFLOW_REF = "candidate/workflow"),
  ]) {
    const changed = { ...env };
    mutation(changed);
    await assert.rejects(
      () => validateLiveContext({ record: f.record, plan: f.plan, request: api.request, environment: changed, now }),
      /PROTECTED_EXECUTOR_REQUIRED/u,
    );
  }
  api.refs.set("refs/heads/main", { object: { sha: "f".repeat(40) } });
  await assert.rejects(
    () => validateLiveContext({ record: f.record, plan: f.plan, request: api.request, environment: env, now }),
    /LIVE_SOURCE_OR_EXECUTOR_CHANGED/u,
  );
});
test("a reservation cannot be read as permission for repeated launches or a changed phase", (t) => {
  const f = fixture(t),
    value = claimExceptionPhase({ root: f.root, phase: "experience", plan: f.plan, runId: 10 });
  assert.equal(
    requireExceptionPhase({
      root: f.root,
      phase: "experience",
      plan: f.plan,
      environment: { GITHUB_RUN_ID: "10", SOUNDING_LINE_EXCEPTION_LEASE: value.lease },
    }).ownerPid,
    process.pid,
  );
  assert.throws(
    () => claimExceptionPhase({ root: f.root, phase: "experience", plan: f.plan, runId: 11 }),
    /EXECUTION_PHASE_ALREADY_CONSUMED/u,
  );
  assert.throws(
    () =>
      requireExceptionPhase({
        root: f.root,
        phase: "experience",
        plan: f.plan,
        environment: { GITHUB_RUN_ID: "10", SOUNDING_LINE_EXCEPTION_LEASE: "candidate-claim" },
      }),
    /EXECUTION_PHASE_BINDING_MISMATCH/u,
  );
  assert.throws(
    () => requireExceptionPhase({ root: f.root, phase: "technical", plan: f.plan }),
    /EXECUTION_PHASE_NOT_RESERVED/u,
  );
});
test("sealed exact review binds successful original capture and cannot substitute another reviewer", async (t) => {
  const f = fixture(t),
    api = apiFixture(f.record, f.plan),
    binding = exceptionBinding(f.plan),
    captureRun = runIdentity(f.plan),
    reviewRun = runIdentity(f.plan, 11);
  api.runs.set(10, remoteRun(captureRun, "completed", "success"));
  api.runs.set(11, remoteRun(reviewRun, "completed", "success"));
  const prepare = await api.store.create("prepare", { binding, run: captureRun });
  const capture = {
    exception: f.plan.exception,
    exceptionPreparationReservation: prepare.commitSha,
    trustedArtifact: { id: 100, digest: "sha256:" + "e".repeat(64), runId: 10, runAttempt: 1 },
  };
  const evidence = {
    captureArtifactId: 100,
    artifacts: [{ id: "actual" }],
    journeys: [{ id: "journey" }],
    reviews: [{ reviewerContext: "independent", iterations: 11, independentReviewOrdinal: 3 }],
  };
  await api.store.create("capture", { binding, run: captureRun, provenance: capture.trustedArtifact });
  const seal = await api.store.create("review3", {
    binding,
    run: reviewRun,
    reviewIdentity: sealedReviewIdentity(f.plan, evidence),
  });
  const review = {
    exception: f.plan.exception,
    exceptionPreparationReservation: prepare.commitSha,
    exceptionReviewSeal: seal.commitSha,
  };
  assert.equal(
    (
      await verifyExceptionAttestation({
        root: f.root,
        plan: f.plan,
        evidence,
        capture,
        review,
        request: api.request,
        now,
      })
    ).reviewSeal,
    seal.commitSha,
  );
  evidence.reviews[0].reviewerContext = "replacement";
  await assert.rejects(
    () =>
      verifyExceptionAttestation({ root: f.root, plan: f.plan, evidence, capture, review, request: api.request, now }),
    /SEALED_EVIDENCE_MISMATCH/u,
  );
});
test("new blocking finding is terminal even when labeled resolved", () => {
  const plan = { exception: { id: template.id } };
  const evidence = {
    exception: plan.exception,
    reviews: [
      {
        iterations: 11,
        independentReviewOrdinal: 3,
        findings: [{ classification: "MAJOR_EXPERIENCE_DEFECT", disposition: "RESOLVED" }],
      },
    ],
  };
  assert.throws(() => validateExceptionEvidence(plan, evidence), /NEW_BLOCKING_FINDING/u);
});
test("a supplied replay plan cannot remove journeys while retaining claimed digest strings", () => {
  const actual = {
    baseSha: "a".repeat(40),
    candidateSha: "b".repeat(40),
    sourceDigest: "c".repeat(64),
    contractDigest: "d".repeat(64),
    contractIds: ["bound"],
    contracts: [{ id: "bound", experience: { journeys: [{ id: "must-run" }] } }],
    exception: { id: template.id },
  };
  const supplied = structuredClone(actual);
  supplied.contracts[0].experience.journeys = [];
  assert.throws(() => validateExceptionExecutionPlan(supplied, actual), /EXECUTION_PLAN_CHANGED/u);
  assert.doesNotThrow(() =>
    validateExceptionExecutionPlan(
      { ...actual, outputDirectory: "artifacts/isolated", fixtureProfile: "generic" },
      actual,
    ),
  );
});
test("direct capture and replay plans cannot grant browser execution", async (t) => {
  const f = fixture(t),
    plan = { ...f.plan };
  delete plan.exception;
  await assert.rejects(
    () =>
      captureProductExperience({
        root: f.root,
        plan,
        baseURL: "http://127.0.0.1:1",
        outputDirectory: "artifacts/unauthorized",
      }),
    /EXCEPTION_(?:PLAN_SCOPE_CHANGED|EXPIRED)/u,
  );
  await assert.rejects(
    () => runTrustedExperienceReplay({ root: f.root, plan, environment: {} }),
    /EXCEPTION_(?:PLAN_SCOPE_CHANGED|EXPIRED)/u,
  );
  assert.equal(existsSync(path.join(f.root, "artifacts/unauthorized")), false);
  const planPath = path.join(f.root, "plan.json");
  writeFileSync(planPath, JSON.stringify(plan));
  for (const flag of ["--replay", "--run-server"]) {
    const result = spawnSync(
      process.execPath,
      [path.join(repo, "scripts/sounding-line/experience-browser.mjs"), "--workspace", f.root, flag, planPath],
      { encoding: "utf8", timeout: 30000 },
    );
    assert.equal(result.error, undefined);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /EXCEPTION_(?:PLAN_SCOPE_CHANGED|EXPIRED)/u);
  }
  const suite = spawnSync(
    process.execPath,
    [
      path.join(repo, "scripts/sounding-line/run-browser-suite.mjs"),
      "--workspace",
      f.root,
      "--candidate",
      f.candidateSha,
      "--profile",
      "generic",
      "--database-url",
      "file:isolated.db",
      "--",
      "tests/e2e/crossdeck.spec.ts",
    ],
    { encoding: "utf8", timeout: 30000, env: { ...process.env, SOUNDING_LINE_BASE_SHA: f.baseSha } },
  );
  assert.notEqual(suite.status, 0);
  assert.match(suite.stderr, /EXCEPTION_(?:PLAN_SCOPE_CHANGED|EXPIRED)/u);
});
test("historical/equal bases and missing or retired grants cannot erase the campaign", async (t) => {
  const f = fixture(t);
  for (const baseSha of [f.candidateSha, f.record.frozenHistoricalBaseSha]) {
    const plan = { ...f.plan, baseSha };
    delete plan.exception;
    await assert.rejects(
      () =>
        captureProductExperience({
          root: f.root,
          plan,
          baseURL: "http://127.0.0.1:1",
          outputDirectory: "artifacts/extra",
        }),
      /EXCEPTION_(?:INSTALLED_PROTECTED_BASE_REQUIRED|APPROVAL_MISSING_OR_INACTIVE|EXPIRED)/u,
    );
    const suite = spawnSync(
      process.execPath,
      [
        path.join(repo, "scripts/sounding-line/run-browser-suite.mjs"),
        "--workspace",
        f.root,
        "--candidate",
        f.candidateSha,
        "--profile",
        "generic",
        "--database-url",
        "file:isolated.db",
        "--",
        "tests/e2e/crossdeck.spec.ts",
      ],
      { encoding: "utf8", timeout: 20000, env: { ...process.env, SOUNDING_LINE_BASE_SHA: baseSha } },
    );
    assert.notEqual(suite.status, 0);
    assert.match(
      suite.stderr,
      /EXCEPTION_(?:INSTALLED_PROTECTED_BASE_REQUIRED|APPROVAL_MISSING_OR_INACTIVE|PLAN_SCOPE_CHANGED|EXPIRED)/u,
    );
  }
  f.git("checkout", "-qb", "retired", f.baseSha);
  for (const exceptions of [[{ ...f.record, status: "RETIRED" }], []]) {
    f.write("testing/product-experience-exceptions.json", { version: 1, exceptions });
    const baseSha = f.commit();
    assert.throws(() => bindExperienceException({ ...f, baseSha, plan: f.plan, now }), /APPROVAL_MISSING_OR_INACTIVE/u);
  }
  assert.equal(existsSync(path.join(f.root, "artifacts/extra")), false);
});
test("one review3 is exactly the seven contracts and one reviewer context", () => {
  const plan = { contractIds: template.contractIds, exception: { id: template.id } };
  const evidence = {
    exception: plan.exception,
    reviews: template.contractIds.map((contractId) => ({
      contractId,
      reviewerContext: "one-independent-context",
      iterations: 11,
      independentReviewOrdinal: 3,
      findings: [],
    })),
  };
  assert.doesNotThrow(() => validateExceptionEvidence(plan, evidence));
  evidence.reviews.push({ ...evidence.reviews[0] });
  assert.throws(() => validateExceptionEvidence(plan, evidence), /ONE_REVIEW3_SCOPE_REQUIRED/u);
  evidence.reviews.pop();
  evidence.reviews[0].reviewerContext = "second-reviewer";
  assert.throws(() => validateExceptionEvidence(plan, evidence), /ONE_REVIEW3_SCOPE_REQUIRED/u);
});

test("copied product trees and refit identities cannot evade direct execution guards", async (t) => {
  const f = fixture(t);
  f.git("checkout", "-qb", "copied", f.baseSha);
  f.git("checkout", f.frozen, "--", "src", "tests/e2e");
  let candidateSha = f.commit();
  assert.notEqual(spawnSync("git", ["merge-base", "--is-ancestor", f.frozen, candidateSha], { cwd: f.root }).status, 0);
  assert.equal(existsSync(path.join(f.root, f.record.immutableHistory[0].path)), false);
  for (const expected of [/HISTORY_CHANGED/u, /FROZEN_PRODUCT_CHANGED/u]) {
    const plan = { ...f.plan, candidateSha };
    delete plan.exception;
    await assert.rejects(
      () =>
        captureProductExperience({
          root: f.root,
          plan,
          baseURL: "http://127.0.0.1:1",
          outputDirectory: "artifacts/forbidden",
        }),
      expected,
    );
    const trace = path.join(f.root, `guard-${expected.source}.trace`);
    const suite = spawnSync(
      process.execPath,
      [
        path.join(repo, "scripts/sounding-line/run-browser-suite.mjs"),
        "--workspace",
        f.root,
        "--candidate",
        candidateSha,
        "--profile",
        "generic",
        "--database-url",
        "file:isolated.db",
        "--",
        "tests/e2e/crossdeck.spec.ts",
      ],
      {
        encoding: "utf8",
        timeout: 20000,
        env: { ...process.env, SOUNDING_LINE_BASE_SHA: f.baseSha, GIT_TRACE: trace.replaceAll("\\", "/") },
      },
    );
    assert.ifError(suite.error);
    assert.notEqual(suite.status, 0);
    assert.match(suite.stderr, expected);
    const gitCalls = (readFileSync(trace, "utf8").match(/built-in: git /gu) ?? []).length;
    assert(gitCalls <= 120, `direct guard must stay bounded across installed history records; observed ${gitCalls}`);
    t.diagnostic(
      JSON.stringify({
        classification: "DIRECT_EXECUTION_DENIAL_GUARD",
        expected: expected.source,
        gitOperations: gitCalls,
        maximumGitOperations: 120,
        timeoutMs: 20000,
      }),
    );
    if (expected.source.includes("HISTORY_CHANGED")) {
      f.write("src/product.ts", "copied and changed");
      f.write("testing/contracts.json", { contracts: [{ id: "crossdeck.refit.companion" }] });
      candidateSha = f.commit();
    }
  }
  assert.equal(existsSync(path.join(f.root, "artifacts/forbidden")), false);
});

test("failed work in any earlier campaign stage stops a new stage before custody writes", async (t) => {
  const f = fixture(t);
  for (const priorMode of ["ordinary", "review"])
    for (const conclusion of ["failure", "cancelled"]) {
      const api = apiFixture(f.record, f.plan),
        current = runIdentity(f.plan, 20),
        prior = runIdentity(f.plan, 10, "workflow_dispatch", priorMode);
      api.runs.set(20, remoteRun(current));
      api.runs.set(10, remoteRun(prior, "completed", conclusion));
      await assert.rejects(
        () =>
          reserveExceptionStage({
            root: f.root,
            record: f.record,
            plan: f.plan,
            mode: "capture",
            run: current,
            store: api.store,
            request: api.request,
          }),
        /EARLIER_CAMPAIGN_FAILURE/u,
      );
      assert.equal(
        api.operations.some(({ method }) => method === "POST"),
        false,
      );
    }
  const api = apiFixture(f.record, f.plan),
    current = runIdentity(f.plan, 30, "workflow_dispatch", "ordinary");
  api.runs.set(30, remoteRun(current));
  api.runs.set(10, remoteRun(runIdentity(f.plan, 10), "completed", "success"));
  api.runs.set(20, remoteRun(runIdentity(f.plan, 20, "workflow_dispatch", "review"), "completed", "success"));
  await requireFirstCampaignRun({
    root: f.root,
    record: f.record,
    plan: f.plan,
    mode: "ordinary",
    run: current,
    request: api.request,
  });
});

test("malformed finite campaign names fail closed instead of disappearing from history", async (t) => {
  const f = fixture(t),
    api = apiFixture(f.record, f.plan),
    current = runIdentity(f.plan, 20),
    prior = runIdentity(f.plan, 10);
  prior.displayTitle = prior.displayTitle.replace(" 721 ", " 721 extra ");
  api.runs.set(20, remoteRun(current));
  api.runs.set(10, remoteRun(prior, "completed", "failure"));
  await assert.rejects(
    () =>
      reserveExceptionStage({
        root: f.root,
        record: f.record,
        plan: f.plan,
        mode: "capture",
        run: current,
        store: api.store,
        request: api.request,
      }),
    /HISTORY_NAME_UNVERIFIABLE/u,
  );
  assert.equal(
    api.operations.some(({ method }) => method === "POST"),
    false,
  );
});
test("custody commit retains every protected-base root including workflows", async (t) => {
  const f = fixture(t),
    api = apiFixture(f.record, f.plan);
  const stored = await api.store.create("prepare", { binding: exceptionBinding(f.plan), run: runIdentity(f.plan) });
  const tree = api.trees.get(api.commits.get(stored.commitSha).tree.sha).tree;
  assert.equal(tree.length, 3);
  assert.equal(tree.find((entry) => entry.path === ".github").sha, "e".repeat(40));
  assert.equal((await api.store.read("prepare")).commitSha, stored.commitSha);
  tree.find((entry) => entry.path === ".github").sha = "c".repeat(40);
  await assert.rejects(() => api.store.read("prepare"), /CUSTODY_BASE_TREE_CHANGED/u);
});
test("failed cancelled queued and malformed prior attempts consume across candidate heads without a ref", async (t) => {
  const f = fixture(t);
  for (const mode of ["capture", "ordinary"])
    for (const state of ["failure", "cancelled", "queued", "in_progress"]) {
      const api = apiFixture(f.record, f.plan),
        current = runIdentity(f.plan, 20, "workflow_dispatch", mode),
        prior = runIdentity({ ...f.plan, candidateSha: "e".repeat(40) }, 10, "workflow_dispatch", mode);
      api.runs.set(20, remoteRun(current));
      api.runs.set(
        10,
        remoteRun(
          prior,
          ["failure", "cancelled"].includes(state) ? "completed" : state,
          ["failure", "cancelled"].includes(state) ? state : null,
        ),
      );
      await assert.rejects(
        () =>
          requireFirstCampaignRun({
            root: f.root,
            record: f.record,
            plan: f.plan,
            mode,
            run: current,
            request: api.request,
          }),
        /EARLIER_ATTEMPT_CONSUMED/u,
      );
      assert.equal(await api.store.read("prepare"), null);
    }
  const api = apiFixture(f.record, f.plan),
    current = runIdentity(f.plan, 20),
    prior = runIdentity(f.plan, 10);
  prior.displayTitle = prior.displayTitle.replace(" 721 ", " unbound ");
  api.runs.set(20, remoteRun(current));
  api.runs.set(10, remoteRun(prior, "completed", "failure"));
  await assert.rejects(
    () =>
      requireFirstCampaignRun({
        root: f.root,
        record: f.record,
        plan: f.plan,
        mode: "capture",
        run: current,
        request: api.request,
      }),
    /EARLIER_ATTEMPT_CONSUMED/u,
  );
  api.runs.get(10).actor.login = "unknown";
  await assert.rejects(
    () =>
      requireFirstCampaignRun({
        root: f.root,
        record: f.record,
        plan: f.plan,
        mode: "capture",
        run: current,
        request: api.request,
      }),
    /HISTORY_ATTEMPT_INVALID_OR_AMBIGUOUS/u,
  );
});
test("history rejects truncation or missing current run and excludes only proved skipped draft", async (t) => {
  const f = fixture(t),
    api = apiFixture(f.record, f.plan),
    current = runIdentity(f.plan, 20, "workflow_dispatch", "ordinary"),
    prior = runIdentity(f.plan, 10, "pull_request_target", "ordinary");
  prior.displayTitle = prior.displayTitle.replace(/active$/u, "draft");
  api.runs.set(20, remoteRun(current));
  api.runs.set(10, remoteRun(prior, "completed", "skipped"));
  await requireFirstCampaignRun({
    root: f.root,
    record: f.record,
    plan: f.plan,
    mode: "ordinary",
    run: current,
    request: api.request,
  });
  for (const data of [
    { total_count: 1001, workflow_runs: [] },
    { total_count: 0, workflow_runs: [] },
  ]) {
    await assert.rejects(
      () =>
        requireFirstCampaignRun({
          root: f.root,
          record: f.record,
          plan: f.plan,
          mode: "ordinary",
          run: current,
          request: async () => data,
        }),
      /HISTORY_INCOMPLETE/u,
    );
  }
});
test("a failure before any ref creation cannot receive a new dispatch allowance", async (t) => {
  const f = fixture(t),
    api = apiFixture(f.record, f.plan),
    first = runIdentity(f.plan);
  api.runs.set(10, remoteRun(first));
  api.failBeforeRef();
  await assert.rejects(
    () =>
      reserveExceptionStage({
        root: f.root,
        record: f.record,
        plan: f.plan,
        mode: "capture",
        run: first,
        store: api.store,
        request: api.request,
      }),
    /Failure before ref creation/u,
  );
  assert.equal(await api.store.read("prepare"), null);
  api.runs.set(10, remoteRun(first, "completed", "cancelled"));
  const second = runIdentity({ ...f.plan, candidateSha: "e".repeat(40) }, 20);
  api.runs.set(20, remoteRun(second));
  await assert.rejects(
    () =>
      reserveExceptionStage({
        root: f.root,
        record: f.record,
        plan: { ...f.plan, candidateSha: "e".repeat(40) },
        mode: "capture",
        run: second,
        store: api.store,
        request: api.request,
      }),
    /EARLIER_ATTEMPT_CONSUMED/u,
  );
});
test("trusted parent passes an authenticated one-use lease to a token-free real child", async (t) => {
  const f = fixture(t),
    api = apiFixture(f.record, f.plan),
    env = environment(f.plan),
    identity = runIdentity(f.plan);
  api.runs.set(10, remoteRun(identity));
  f.write("plan.json", f.plan);
  f.write(
    "scripts/sounding-line/run-browser-suite.mjs",
    `import assert from 'node:assert/strict';import fs from 'node:fs';import {requireExceptionPhase} from ${JSON.stringify(pathToFileURL(path.join(repo, "scripts/sounding-line/experience-exception.mjs")).href)};assert.equal(process.env.GH_TOKEN,undefined);assert.equal(process.env.GITHUB_TOKEN,undefined);const plan=JSON.parse(fs.readFileSync('plan.json','utf8'));requireExceptionPhase({root:process.cwd(),phase:'technical',plan});fs.writeFileSync('token-free-proof.json',JSON.stringify({tokenFree:true}));`,
  );
  const before = { GH_TOKEN: process.env.GH_TOKEN, GITHUB_TOKEN: process.env.GITHUB_TOKEN };
  process.env.GH_TOKEN = "synthetic";
  process.env.GITHUB_TOKEN = "synthetic";
  try {
    const execute = exceptionCommandRunner(f.plan, runVerificationCommand, async () => {
      assert.equal(process.env.GH_TOKEN, "synthetic");
      await validateLiveContext({ record: f.record, plan: f.plan, request: api.request, environment: env, now });
      return claimExceptionPhase({ root: f.root, phase: "technical", plan: f.plan, runId: 10 });
    });
    await execute(f.root, process.execPath, ["scripts/sounding-line/run-browser-suite.mjs"], {
      env: { GITHUB_RUN_ID: "10" },
    });
    assert.deepEqual(JSON.parse(readFileSync(path.join(f.root, "token-free-proof.json"), "utf8")), { tokenFree: true });
    await assert.rejects(
      () =>
        execute(f.root, process.execPath, ["scripts/sounding-line/run-browser-suite.mjs"], {
          env: { GITHUB_RUN_ID: "10" },
        }),
      /EXECUTION_PHASE_ALREADY_CONSUMED/u,
    );
  } finally {
    for (const [key, value] of Object.entries(before)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

async function successorApiFixture(t) {
  const f = fixture(t),
    record = structuredClone(successorTemplate);
  const plan = { ...f.plan, exception: recordBinding(record) };
  const api = apiFixture(record, plan),
    p = record.predecessor;
  const originalRun = {
    ...runIdentity({ baseSha: p.baseSha, candidateSha: p.candidateSha }, p.runId),
    createdAt: p.createdAt,
    workflowId: p.workflowId,
  };
  api.commits.set(p.baseSha, structuredClone(api.commits.get(plan.baseSha)));
  const originalStore = exceptionStore({ record: template, request: api.request });
  const stored = await originalStore.create("prepare", {
    binding: {
      exception: recordBinding(template),
      baseSha: p.baseSha,
      sourceDigest: p.sourceDigest,
      contractDigest: p.contractDigest,
    },
    run: originalRun,
    candidateSha: p.candidateSha,
    independentReviewsCompleted: 2,
    reservedIndependentReviewOrdinal: 3,
  });
  api.commits.set(p.prepareCommit, structuredClone(api.commits.get(stored.commitSha)));
  api.refs.set(`refs/tags/${p.namespace}/prepare`, { object: { type: "commit", sha: p.prepareCommit } });
  api.commits.set(p.candidateSha, { tree: { sha: p.candidateTree }, parents: [] });
  api.runs.set(p.runId, remoteRun(originalRun, "completed", "failure"));
  const current = { ...runIdentity(plan, 38790000001), createdAt: "2026-10-15T17:00:00Z", workflowId: p.workflowId };
  api.runs.set(current.runId, remoteRun(current));
  const artifacts = new Map(
    p.artifacts.map((a) => [
      a.id,
      { id: a.id, digest: a.digest, size_in_bytes: a.size, workflow_run: { id: p.runId, head_sha: p.baseSha } },
    ]),
  );
  const historyQueries = [];
  const request = async (endpoint, method = "GET", body) => {
    if (endpoint.startsWith("actions/artifacts/")) return artifacts.get(Number(endpoint.slice(18))) ?? null;
    if (endpoint.startsWith(`actions/workflows/${p.workflowId}/runs?`)) {
      historyQueries.push(endpoint);
      return api.request(endpoint.replace(`/${p.workflowId}/runs?`, "/5/runs?"), method, body);
    }
    return api.request(endpoint, method, body);
  };
  const store = exceptionStore({ record, request });
  api.operations.length = 0;
  return {
    ...f,
    ...api,
    record,
    plan,
    current,
    artifacts,
    request,
    store,
    originalStore,
    historyQueries,
    now: new Date("2026-10-15T17:00:00Z"),
  };
}

test("R2 historical fixture clock stays deterministic while expired admission remains blocked", async (t) => {
  const f = await successorApiFixture(t);
  const expired = new Date("2026-10-23T00:00:00Z");
  await assert.rejects(
    () => validateSuccessorPredecessor({ record: f.record, request: f.request, now: expired }),
    /EXPIRED/u,
  );
  await assert.rejects(
    () =>
      validateLiveContext({
        record: f.record,
        plan: f.plan,
        request: f.request,
        now: expired,
        environment: { ...environment(f.plan), SOUNDING_LINE_NOW: "2026-10-15T17:00:00Z" },
      }),
    /EXPIRED/u,
  );
  await validateSuccessorPredecessor({ record: f.record, request: f.request, now: f.now });
  await requireFirstCampaignRun({
    now: f.now,
    root: f.root,
    record: f.record,
    plan: f.plan,
    mode: "capture",
    run: f.current,
    request: f.request,
  });
});

test("R2 permits one authenticated review submission and cannot republish a successful seal through another run", async (t) => {
  const f = await successorApiFixture(t);
  await reserveExceptionStage({
    root: f.root,
    record: f.record,
    plan: f.plan,
    mode: "capture",
    run: f.current,
    store: f.store,
    request: f.request,
    now: f.now,
  });
  f.runs.set(f.current.runId, remoteRun(f.current, "completed", "success"));
  const submitted = {
    ...f.current,
    runId: f.current.runId + 1,
    createdAt: "2026-10-15T17:01:00Z",
    displayTitle: f.current.displayTitle.replace(" capture ", " review "),
  };
  f.runs.set(submitted.runId, remoteRun(submitted));
  await reserveExceptionStage({
    root: f.root,
    record: f.record,
    plan: f.plan,
    mode: "review",
    run: submitted,
    store: f.store,
    request: f.request,
    now: f.now,
  });
  await f.store.create("review3", { binding: exceptionBinding(f.plan), run: submitted });
  f.runs.set(submitted.runId, remoteRun(submitted, "completed", "success"));
  const duplicate = { ...submitted, runId: submitted.runId + 1, createdAt: "2026-10-15T17:02:00Z" };
  f.runs.set(duplicate.runId, remoteRun(duplicate));
  f.operations.length = 0;
  await assert.rejects(
    () =>
      reserveExceptionStage({
        root: f.root,
        record: f.record,
        plan: f.plan,
        mode: "review",
        run: duplicate,
        store: f.store,
        request: f.request,
        now: f.now,
      }),
    /REVIEW_SUBMISSION_ALREADY_CONSUMED/u,
  );
  assert.equal(
    f.operations.some((o) => o.method === "POST"),
    false,
  );
});

test("R2 preserves original record and binds exact delegated approval and honest history", () => {
  assert.equal(hash(template), CROSSDECK_R2.predecessor.recordDigest);
  validateExceptionRecord(successorTemplate, new Date("2026-10-15T17:00:00Z"));
  const binding = recordBinding(successorTemplate);
  assert.equal(binding.priorRepairRecaptureAttempts, 11);
  assert.equal(binding.independentReviewOrdinal, 3);
  assert.equal(binding.attemptHistory.totalPriorExecutedAttempts, 12);
  assert.equal(binding.attemptHistory.nextPreparationAttemptTotal, 13);
  assert.equal(binding.predecessor.prepareCommit, "2706b52f12fc167434b03ff8e6fb7d3198db8d62");
  assert.equal(successorTemplate.ownerApproval.humanMessageId, "Sentinel_ae98f58b5fc88191b9132a017d43518c");
  for (const mutate of [
    (r) => (r.ownerApproval.humanMessageId = "invented"),
    (r) => (r.ownerApproval.sourceThreadId = "wrong"),
    (r) => (r.ownerApproval.approvedAtUtcMinute = "2026-10-15T17:00Z"),
    (r) => (r.ownerApproval.answer = "NO"),
    (r) => (r.predecessor.campaignEpoch = r.ownerApproval.approvedAtUtcMinute),
    (r) => r.predecessor.runId++,
    (r) => (r.predecessor.artifacts[0].digest = "wrong"),
    (r) => (r.attemptHistory.totalPriorExecutedAttempts = 11),
    (r) => (r.executionBudget.preparationPasses = 2),
    (r) => (r.custody.namespace += "-escape"),
  ]) {
    const record = structuredClone(successorTemplate);
    mutate(record);
    assert.throws(() => validateExceptionRecord(record), /RECORD_INVALID/u);
  }
});

test("R2 selection retains predecessor unchanged and retirement cannot revive consumed grant", () => {
  const records = [structuredClone(template), structuredClone(successorTemplate)];
  assert.deepEqual(selectTrustedExceptions(records), [records[1]]);
  for (const mutate of [
    (r) => (r.affectedRoutes[0] = "/different"),
    (r) => r.requiredTechnicalBrowserTests.pop(),
    (r) => r.protectedBaseRuntimeOverrides.pop(),
    (r) => (r.custody.noUpdateDeleteRefund = false),
    (r) => (r.frozenTrees.src = "a".repeat(40)),
  ]) {
    const changed = structuredClone(successorTemplate);
    mutate(changed);
    assert.throws(() => selectTrustedExceptions([template, changed]), /PREDECESSOR_SCOPE_CHANGED/u);
  }
  records[1].status = "RETIRED";
  assert.deepEqual(selectTrustedExceptions(records), []);
  records[1].status = "ACTIVE";
  assert.throws(() => validateExceptionRecord(records[1], new Date(records[1].expiresAt)), /EXPIRED/u);
  records[0].reason += "changed";
  assert.throws(() => selectTrustedExceptions(records), /PREDECESSOR_REGISTRY_CHANGED/u);
  assert.throws(() => selectTrustedExceptions([successorTemplate]), /PREDECESSOR_REGISTRY_CHANGED/u);
  assert.throws(
    () => selectTrustedExceptions([template, successorTemplate, successorTemplate]),
    /PREDECESSOR_REGISTRY_CHANGED/u,
  );
});

test("R2 admits one new preparation while retaining old consumed ref and original history epoch", async (t) => {
  const f = await successorApiFixture(t),
    p = f.record.predecessor;
  await reserveExceptionStage({
    now: f.now,
    root: f.root,
    record: f.record,
    plan: f.plan,
    mode: "capture",
    run: f.current,
    store: f.store,
    request: f.request,
  });
  assert.equal((await f.originalStore.read("prepare")).commitSha, p.prepareCommit);
  const reserved = await f.store.read("prepare");
  assert.equal(reserved.exceptionId, CROSSDECK_R2.id);
  assert.equal(reserved.binding.exception.attemptHistory.totalPriorExecutedAttempts, 12);
  assert.equal(reserved.attemptHistory.status, "NEXT_PREPARATION_RESERVED_NOT_EXECUTED");
  assert(f.historyQueries[0].includes(encodeURIComponent("2026-10-15T13:54:00.000Z")));
  assert(
    f.operations
      .filter((o) => o.method === "POST")
      .every((o) => ["git/blobs", "git/trees", "git/commits", "git/refs"].includes(o.endpoint)),
  );
  await assert.rejects(
    () => f.store.create("prepare", { binding: exceptionBinding(f.plan), run: f.current }),
    /SLOT_CONSUMED/u,
  );
  const phase = claimExceptionPhase({
    root: f.root,
    phase: "experience",
    plan: f.plan,
    runId: f.current.runId,
    executionHistory: { ...f.record.attemptHistory, stage: "prepare", executedAttemptsIncludingThisPreparation: 13 },
  });
  assert.equal(phase.executionHistory.executedAttemptsIncludingThisPreparation, 13);
});

test("R2 rejects any changed predecessor consumption, source, run or artifact before custody writes", async (t) => {
  for (const mutation of [
    (f) => f.refs.delete(`refs/tags/${f.record.predecessor.namespace}/prepare`),
    (f) => (f.runs.get(f.record.predecessor.runId).conclusion = "success"),
    (f) => (f.runs.get(f.record.predecessor.runId).run_attempt = 2),
    (f) => (f.runs.get(f.record.predecessor.runId).head_sha = "e".repeat(40)),
    (f) => (f.commits.get(f.record.predecessor.candidateSha).tree.sha = "e".repeat(40)),
    (f) => (f.artifacts.get(f.record.predecessor.artifacts[0].id).digest = "wrong"),
    (f) => f.artifacts.delete(f.record.predecessor.artifacts[1].id),
    (f) =>
      f.refs.set(
        `refs/tags/${f.record.predecessor.namespace}/review3`,
        f.refs.get(`refs/tags/${f.record.predecessor.namespace}/prepare`),
      ),
  ]) {
    const f = await successorApiFixture(t);
    mutation(f);
    await assert.rejects(
      () =>
        reserveExceptionStage({
          now: f.now,
          root: f.root,
          record: f.record,
          plan: f.plan,
          mode: "capture",
          run: f.current,
          store: f.store,
          request: f.request,
        }),
      /PREDECESSOR_/u,
    );
    assert.equal(
      f.operations.some((o) => o.method === "POST"),
      false,
    );
    assert.equal(await f.store.read("prepare"), null);
  }
});

test("R2 complete history cannot omit or rewrite the authorized predecessor", async (t) => {
  const f = await successorApiFixture(t);
  for (const rewrite of [
    (runs) => runs.filter((r) => r.id !== f.record.predecessor.runId),
    (runs) => runs.map((r) => (r.id === f.record.predecessor.runId ? { ...r, conclusion: "success" } : r)),
  ]) {
    const request = async (endpoint, method, body) => {
      const data = await f.request(endpoint, method, body);
      if (!endpoint.includes("/runs?")) return data;
      const workflow_runs = rewrite(data.workflow_runs);
      return { total_count: workflow_runs.length, workflow_runs };
    };
    await assert.rejects(
      () =>
        requireFirstCampaignRun({
          now: f.now,
          root: f.root,
          record: f.record,
          plan: f.plan,
          mode: "capture",
          run: f.current,
          request,
        }),
      /PREDECESSOR_HISTORY_(?:MISSING|CHANGED)/u,
    );
  }
  assert.equal(
    f.operations.some((o) => o.method === "POST"),
    false,
  );
});

test("R2 recognizes only exact predecessor; other failures before new approval still stop", async (t) => {
  for (const date of ["2026-10-15T16:00:00Z", "2026-10-15T16:55:00Z"]) {
    const f = await successorApiFixture(t);
    const extra = { ...f.current, runId: f.current.runId - 1, createdAt: date };
    f.runs.set(extra.runId, remoteRun(extra, "completed", "failure"));
    await assert.rejects(
      () =>
        reserveExceptionStage({
          now: f.now,
          root: f.root,
          record: f.record,
          plan: f.plan,
          mode: "capture",
          run: f.current,
          store: f.store,
          request: f.request,
        }),
      /EARLIER_ATTEMPT_CONSUMED/u,
    );
    assert.equal(
      f.operations.some((o) => o.method === "POST"),
      false,
    );
  }
});

test("R2 new failed preparation remains consumed and original failure cannot supply successful evidence", async (t) => {
  const f = await successorApiFixture(t);
  await validateSuccessorPredecessor({ record: f.record, request: f.request, now: f.now });
  await reserveExceptionStage({
    now: f.now,
    root: f.root,
    record: f.record,
    plan: f.plan,
    mode: "capture",
    run: f.current,
    store: f.store,
    request: f.request,
  });
  f.runs.set(f.current.runId, remoteRun(f.current, "completed", "failure"));
  await assert.rejects(
    () => requireSuccessfulReservation({ store: f.store, slot: "prepare", plan: f.plan, request: f.request }),
    /RESERVED_RUN_NOT_SUCCESSFUL/u,
  );
  await assert.rejects(
    () => requireSuccessfulReservation({ store: f.originalStore, slot: "prepare", plan: f.plan, request: f.request }),
    /RESERVATION_BINDING_MISSING/u,
  );
  const next = { ...f.current, runId: f.current.runId + 1, createdAt: "2026-10-15T17:01:00Z" };
  f.runs.set(next.runId, remoteRun(next));
  f.operations.length = 0;
  await assert.rejects(
    () =>
      reserveExceptionStage({
        now: f.now,
        root: f.root,
        record: f.record,
        plan: f.plan,
        mode: "capture",
        run: next,
        store: f.store,
        request: f.request,
      }),
    /EARLIER_ATTEMPT_CONSUMED/u,
  );
  assert.equal(
    f.operations.some((o) => o.method === "POST"),
    false,
  );
  assert.equal((await f.originalStore.read("prepare")).commitSha, f.record.predecessor.prepareCommit);
});

const r3Template = JSON.parse(
  readFileSync(path.join(repo, "testing/product-experience-exceptions.json"), "utf8"),
).exceptions.find((r) => r.id === CROSSDECK_R3.id);
test("R3 preserves both predecessor objects and selects only the exact new approval", () => {
  const records = [template, successorTemplate, structuredClone(r3Template)];
  validateExceptionRecord(records[2], new Date("2026-10-15T19:00:00Z"));
  assert.deepEqual(selectTrustedExceptions(records), [records[2]]);
  assert.equal(hash(template), CROSSDECK_R2.predecessor.recordDigest);
  assert.equal(hash(successorTemplate), CROSSDECK_R3.predecessorDigest);
  const binding = recordBinding(records[2]);
  assert.equal(binding.independentReviewOrdinal, 4);
  assert.equal(binding.attemptHistory.totalPriorExecutedAttempts, 13);
  assert.equal(binding.attemptHistory.nextPreparationAttemptTotal, 14);
  for (const mutate of [
    (r) => r.executionBudget.reruns++,
    (r) => r.executionBudget.productRepairs++,
    (r) => r.executionBudget.targetedLocalProofInvocations++,
    (r) => r.repairScope.productPaths.push("src/unrelated.ts"),
    (r) => r.affectedRoutes.pop(),
    (r) => r.requiredTechnicalBrowserTests.pop(),
    (r) => (r.blockedReview3.sha256 = "0".repeat(64)),
    (r) => (r.ownerApproval.humanMessageId = "invented"),
    (r) => (r.predecessor.conclusion = "failure"),
    (r) => r.originalPredecessor.runId++,
    (r) => r.attemptHistory.totalPriorExecutedAttempts--,
  ]) {
    const changed = structuredClone(r3Template);
    mutate(changed);
    assert.throws(() => selectTrustedExceptions([template, successorTemplate, changed]), /R3_RECORD_CHANGED/u);
  }
  records[2].status = "RETIRED";
  assert.deepEqual(selectTrustedExceptions(records), []);
  assert.throws(() => selectTrustedExceptions([template, r3Template]), /R3_PREDECESSOR_REGISTRY_CHANGED/u);
});

function r3ContractFixture() {
  const original = {
    contracts: [
      {
        id: CROSSDECK_R3.contractId,
        experience: {
          journeys: [{ id: CROSSDECK_R3.journeyId, steps: [{ action: "assert", name: "Journal tools" }] }],
        },
      },
      { id: "other", experience: { immutable: true } },
    ],
    policy: { required: true },
  };
  const proposed = structuredClone(original);
  proposed.contracts[0].experience.journeys[0].steps.push({
    action: "assert",
    role: "button",
    name: "Continue Voyage",
    unobscured: true,
  });
  proposed.contracts[0].experience.localContinuationProof = {
    steps: [
      { action: "click", role: "button", name: "Continue Voyage" },
      {
        action: "assert",
        kind: "outcome",
        role: "main",
        name: "",
        path: CROSSDECK_R3.route,
        state: "RETURNED",
        text: "Voyage complete",
        meaning: "The same Voyage continues after primary activation.",
      },
    ],
  };
  return { original, proposed };
}
test("R3 contract extension cannot change an old step, other field, object or obligation", () => {
  const { original, proposed } = r3ContractFixture();
  validateR3Contracts(original, proposed);
  for (const mutate of [
    (r) => (r.policy.required = false),
    (r) => r.contracts.pop(),
    (r) => (r.contracts[0].experience.devices = ["DESKTOP"]),
    (r) => (r.contracts[0].experience.journeys[0].steps[0].name = "Different"),
    (r) => delete r.contracts[0].experience.journeys[0].steps[1].unobscured,
    (r) => (r.contracts[0].experience.localContinuationProof.steps[0].name = "Dismiss"),
    (r) => (r.contracts[0].experience.localContinuationProof.steps[1].path = "/other-voyage"),
    (r) => r.contracts[0].experience.journeys[0].steps.push({ action: "click", name: "Extra" }),
  ]) {
    const changed = structuredClone(proposed);
    mutate(changed);
    assert.throws(
      () => validateR3Contracts(original, changed),
      /R3_(CONTRACT_SCOPE_CHANGED|CONTINUATION_PROOF_REQUIRED)/u,
    );
  }
});
test("R3 rejects old review3 and any blocking finding while requiring one complete review4", () => {
  const plan = { contractIds: r3Template.contractIds, exception: recordBinding(r3Template) };
  const evidence = {
    exception: plan.exception,
    reviews: plan.contractIds.map((contractId) => ({
      contractId,
      reviewerContext: "independent-r3",
      iterations: 11,
      independentReviewOrdinal: 4,
      findings: [],
    })),
  };
  validateExceptionEvidence(plan, evidence);
  evidence.reviews[0].independentReviewOrdinal = 3;
  assert.throws(() => validateExceptionEvidence(plan, evidence), /HISTORY_OR_REVIEW_ORDINAL_CHANGED/u);
  evidence.reviews[0].independentReviewOrdinal = 4;
  evidence.reviews[0].findings.push({
    id: "R3-HOMEPORT-MOBILE-P01",
    classification: "INTERACTION_DEFECT",
    disposition: "UNRESOLVED_BLOCKER",
  });
  assert.throws(() => validateExceptionEvidence(plan, evidence), /NEW_BLOCKING_FINDING/u);
});

test("R3 activation belongs only to separately scoped local contexts and never mutates the full matrix plan", () => {
  const { proposed } = r3ContractFixture();
  const full = { contracts: proposed.contracts, contractIds: [CROSSDECK_R3.contractId, "other"] };
  const snapshot = structuredClone(full);
  const normal = r3LocalPlan(full, "NORMAL"),
    reduced = r3LocalPlan(full, "REDUCED");
  assert.deepEqual(full, snapshot);
  for (const [plan, mode] of [
    [normal, "NORMAL"],
    [reduced, "REDUCED"],
  ]) {
    assert.equal(plan.localProofMotionMode, mode);
    assert.equal(plan.contracts.length, 1);
    assert.equal(
      plan.contracts[0].experience.journeys[0].steps.length,
      full.contracts[0].experience.journeys[0].steps.length + 2,
    );
    assert.equal(plan.contracts[0].experience.journeys[0].steps.at(-1).text, "Voyage complete");
  }
  assert.notEqual(normal.outputDirectory, reduced.outputDirectory);
  assert.notEqual(normal.contracts[0], reduced.contracts[0]);
});

test("R3 local receipt requires both actual contexts, unobscured activation and all media types", () => {
  const { proposed } = r3ContractFixture();
  const plan = {
    baseSha: "a".repeat(40),
    sourceDigest: "b".repeat(64),
    contractDigest: "c".repeat(64),
    exception: recordBinding(r3Template),
    contracts: proposed.contracts,
  };
  const receipt = {
    classification: "OPERATOR_LOCAL_ONE_USE_NOT_AUTHENTICATED_CUSTODY",
    status: "PASS",
    exceptionId: CROSSDECK_R3.id,
    recordDigest: plan.exception.recordDigest,
    baseSha: plan.baseSha,
    sourceDigest: plan.sourceDigest,
    contractDigest: plan.contractDigest,
    boundedRepairEvents: 1,
    localProofInvocations: 1,
    childReplayInvocations: 2,
    fullPreparations: 0,
    independentReviews: 0,
    contexts: ["MOBILE/PLAYER/NORMAL", "MOBILE/PLAYER/REDUCED"],
    declaredCanonicalFixtureIds: CROSSDECK_R3.fixtureIds,
    isolatedFixtures: [
      { profile: "generic", motionMode: "NORMAL", databaseSha256: "a".repeat(64) },
      { profile: "generic", motionMode: "REDUCED", databaseSha256: "b".repeat(64) },
    ],
    artifacts: [],
    journeys: [],
  };
  for (const motionMode of ["NORMAL", "REDUCED"]) {
    receipt.journeys.push({
      id: CROSSDECK_R3.journeyId,
      contractId: CROSSDECK_R3.contractId,
      motionMode,
      device: "MOBILE",
      role: "PLAYER",
      status: "PASS",
      visibleActions: 3,
      returnPathVerified: true,
      accessibility: { keyboard: true, focus: true, motionPreferenceVerified: true, overflow: false },
      unobscuredActions: [{ role: "button", name: "Continue Voyage", viewportHitTest: true, trialClick: true }],
      observations: [
        {
          role: "main",
          name: "",
          text: "Voyage complete",
          meaning: proposed.contracts[0].experience.localContinuationProof.steps.at(-1).meaning,
        },
      ],
    });
    for (const type of ["screenshot", "recording", "trace"])
      receipt.artifacts.push({
        type,
        motionMode,
        contractId: CROSSDECK_R3.contractId,
        device: "MOBILE",
        role: "PLAYER",
        sha256: "e".repeat(64),
      });
  }
  validateR3LocalReceipt(receipt, plan);
  for (const mutate of [
    (r) => r.journeys.pop(),
    (r) => (r.status = "STARTED"),
    (r) => (r.sourceDigest = "changed"),
    (r) => r.artifacts.pop(),
    (r) => r.localProofInvocations++,
    (r) => (r.journeys[1].unobscuredActions = []),
    (r) => (r.journeys[0].observations = []),
    (r) => (r.journeys[1].accessibility.overflow = true),
    (r) => (r.isolatedFixtures[1].databaseSha256 = r.isolatedFixtures[0].databaseSha256),
  ]) {
    const changed = structuredClone(receipt);
    mutate(changed);
    assert.throws(() => validateR3LocalReceipt(changed, plan), /LOCAL_PROOF_MISSING_OR_CHANGED/u);
  }
});

async function r3ApiFixture(t) {
  const f = await successorApiFixture(t),
    p = CROSSDECK_R3.predecessor;
  f.commits.set(p.baseSha, structuredClone(f.commits.get(f.plan.baseSha)));
  const secondRun = {
    ...runIdentity({ baseSha: p.baseSha, candidateSha: p.candidateSha }, p.runId),
    createdAt: p.createdAt,
    workflowId: p.workflowId,
  };
  const secondStore = exceptionStore({ record: successorTemplate, request: f.request });
  const stored = await secondStore.create("prepare", {
    binding: {
      exception: recordBinding(successorTemplate),
      baseSha: p.baseSha,
      sourceDigest: p.sourceDigest,
      contractDigest: p.contractDigest,
    },
    run: secondRun,
    candidateSha: p.candidateSha,
    independentReviewsCompleted: 2,
    reservedIndependentReviewOrdinal: 3,
  });
  f.commits.set(p.prepareCommit, structuredClone(f.commits.get(stored.commitSha)));
  f.refs.set(`refs/tags/${p.namespace}/prepare`, { object: { type: "commit", sha: p.prepareCommit } });
  f.commits.set(p.candidateSha, { tree: { sha: p.candidateTree } });
  f.runs.set(p.runId, remoteRun(secondRun, "completed", "success"));
  for (const a of p.artifacts)
    f.artifacts.set(a.id, {
      id: a.id,
      digest: a.digest,
      size_in_bytes: a.size,
      workflow_run: { id: p.runId, head_sha: p.baseSha },
    });
  const reviewBytes = readFileSync(
    path.join(
      repo,
      "Development_Docs/Programs/Sounding_Line/evidence/crossdeck-r3-owner-decision-proposal-20261015/review3/reviews.original.raw.txt",
    ),
  );
  const request = async (endpoint, method, body) => {
    if (endpoint === `git/commits/${CROSSDECK_R3.evidenceCommit}`) return { tree: { sha: "review-tree" } };
    if (endpoint === "git/trees/review-tree?recursive=1")
      return {
        truncated: false,
        tree: [{ path: CROSSDECK_R3.reviewPath, type: "blob", mode: "100644", sha: "review-blob" }],
      };
    if (endpoint === "git/blobs/review-blob") return { content: reviewBytes.toString("base64") };
    return f.request(endpoint, method, body);
  };
  const plan = { ...f.plan, exception: recordBinding(r3Template) };
  f.current.createdAt = "2026-10-15T19:00:00Z";
  f.runs.set(f.current.runId, remoteRun(f.current));
  f.operations.length = 0;
  return {
    ...f,
    plan,
    record: r3Template,
    request,
    secondStore,
    store: exceptionStore({ record: r3Template, request }),
    now: new Date("2026-10-15T19:00:00Z"),
  };
}
test("R3 requires both exact historical preparations and preserves the original campaign epoch", async (t) => {
  const f = await r3ApiFixture(t);
  const historical = await validateSuccessorPredecessor(f);
  assert.deepEqual(
    historical.map((r) => r.id),
    [CROSSDECK_R2.predecessor.runId, CROSSDECK_R3.predecessor.runId],
  );
  await requireFirstCampaignRun({ ...f, mode: "capture", run: f.current });
  assert(f.historyQueries.at(-1).includes(encodeURIComponent("2026-10-15T13:54:00.000Z")));
  assert.equal(await f.secondStore.read("qualify"), null);
  assert.equal(
    f.operations.some((o) => o.method === "POST"),
    false,
  );
  for (const mutate of [
    () => (f.runs.get(CROSSDECK_R3.predecessor.runId).conclusion = "failure"),
    () => (f.artifacts.get(CROSSDECK_R3.predecessor.artifacts[0].id).digest = "changed"),
    () => f.refs.delete(`refs/tags/${CROSSDECK_R3.predecessor.namespace}/prepare`),
  ]) {
    // Apply each mutation to the same validated fixture, restoring before next.
    const runs = structuredClone(f.runs),
      artifacts = structuredClone(f.artifacts),
      refs = structuredClone(f.refs);
    mutate();
    await assert.rejects(() => validateSuccessorPredecessor(f), /PREDECESSOR_/u);
    f.runs.clear();
    for (const [k, v] of runs) f.runs.set(k, v);
    f.artifacts.clear();
    for (const [k, v] of artifacts) f.artifacts.set(k, v);
    f.refs.clear();
    for (const [k, v] of refs) f.refs.set(k, v);
    assert.equal(
      f.operations.some((o) => o.method === "POST"),
      false,
    );
  }
  const request = async (endpoint, method, body) =>
    endpoint === "git/blobs/review-blob"
      ? { content: Buffer.from("altered blocked review").toString("base64") }
      : f.request(endpoint, method, body);
  await assert.rejects(() => validateSuccessorPredecessor({ ...f, request }), /R3_BLOCKED_REVIEW_CHANGED/u);
});
test("R3 recognizes only named predecessor preparations; a third attempt cannot disappear", async (t) => {
  const f = await r3ApiFixture(t);
  const extra = { ...f.current, runId: f.current.runId - 2, createdAt: "2026-10-15T18:30:00Z" };
  f.runs.set(extra.runId, remoteRun(extra, "completed", "failure"));
  await assert.rejects(
    () => requireFirstCampaignRun({ ...f, mode: "capture", run: f.current }),
    /EARLIER_ATTEMPT_CONSUMED/u,
  );
  assert.equal(
    f.operations.some((o) => o.method === "POST"),
    false,
  );
});
test("R3 seals review4 only once without writing a review3 seal or using R2 ordinary", async (t) => {
  const f = await r3ApiFixture(t);
  await f.store.create("prepare", {
    binding: exceptionBinding(f.plan),
    run: f.current,
    candidateSha: f.plan.candidateSha,
  });
  f.runs.set(f.current.runId, remoteRun(f.current, "completed", "success"));
  const run = {
    ...f.current,
    runId: f.current.runId + 1,
    createdAt: "2026-10-15T19:01:00Z",
    displayTitle: f.current.displayTitle.replace(" capture ", " review "),
  };
  f.runs.set(run.runId, remoteRun(run));
  await reserveExceptionStage({ ...f, mode: "review", run });
  await f.store.create("review4", { binding: exceptionBinding(f.plan), run });
  f.runs.set(run.runId, remoteRun(run, "completed", "success"));
  await assert.rejects(
    () => reserveExceptionStage({ ...f, mode: "review", run: { ...run, runId: run.runId + 1 } }),
    /REVIEW_SUBMISSION_ALREADY_CONSUMED/u,
  );
  assert.equal(await f.store.read("review3"), null);
  assert.equal(await f.secondStore.read("qualify"), null);
});

test("R3 Git admission permits only the bounded repair and freezes every other runtime entry", (t) => {
  const directory = path.join(repo, "artifacts");
  mkdirSync(directory, { recursive: true });
  const root = mkdtempSync(path.join(directory, "r3-admission-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const run = (args, input) =>
    execFileSync("git", args, { cwd: root, input, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
  run(["init", "-q"]);
  run(["config", "user.name", "R3 Fixture"]);
  run(["config", "user.email", "fixture@example.invalid"]);
  const common = execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], {
    cwd: repo,
    encoding: "utf8",
  }).trim();
  writeFileSync(
    path.join(root, ".git/objects/info/alternates"),
    path.join(common, "objects").replaceAll("\\", "/") + "\n",
  );
  const put = (file, bytes, mode = "100644") => {
    const blob = run(["hash-object", "-w", "--stdin"], bytes);
    run(["update-index", "--add", "--cacheinfo", `${mode},${blob},${file}`]);
  };
  const commit = (parent) => run(["commit-tree", run(["write-tree"]), "-p", parent, "-m", "isolated R3 fixture"]);
  const baseInput = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" }).trim();
  run(["read-tree", baseInput]);
  put(
    "testing/product-experience-exceptions.json",
    JSON.stringify({ version: 1, exceptions: [template, successorTemplate, r3Template] }),
  );
  const baseSha = commit(baseInput);
  const original = JSON.parse(run(["show", `${CROSSDECK_R3.blockedCandidate}:testing/contracts.json`]));
  const contracts = structuredClone(original);
  const target = contracts.contracts.find((c) => c.id === CROSSDECK_R3.contractId);
  target.experience.journeys[0].steps.push(
    ...r3ContractFixture().proposed.contracts[0].experience.journeys[0].steps.slice(1),
  );
  target.experience.localContinuationProof =
    r3ContractFixture().proposed.contracts[0].experience.localContinuationProof;
  const overlay = run(["ls-tree", "-r", CROSSDECK_R3.blockedCandidate, "--", "src", "public", "prisma"]);
  run(["update-index", "--index-info"], overlay + "\n");
  for (const entry of r3Template.protectedBaseRuntimeOverrides)
    run(["update-index", "--add", "--cacheinfo", `${entry.mode},${entry.blob},${entry.path}`]);
  for (const entry of r3Template.immutableHistory)
    run(["update-index", "--add", "--cacheinfo", `100644,${entry.blob},${entry.path}`]);
  put("testing/contracts.json", JSON.stringify(contracts));
  const product = CROSSDECK_R3.productPaths[0];
  const originalBytes = run(["show", `${CROSSDECK_R3.blockedCandidate}:${product}`]);
  put(product, originalBytes + "\n// bounded fixture change\n");
  const candidateSha = commit(baseSha);
  const selected = JSON.parse(
    readFileSync(
      path.join(
        repo,
        "Development_Docs/Programs/Sounding_Line/evidence/crossdeck-r3-owner-decision-proposal-20261015/scope-binding.json",
      ),
    ),
  ).contractObjects;
  const plan = {
    applicable: true,
    contractIds: r3Template.contractIds,
    contracts: selected,
    contractDigest: "a".repeat(64),
  };
  const bind = (candidate) =>
    bindExperienceException({
      root,
      baseSha,
      candidateSha: candidate,
      plan,
      prNumber: 721,
      now: new Date("2026-10-15T19:00:00Z"),
    });
  assert.equal(bind(candidateSha).independentReviewOrdinal, 4);
  run(["read-tree", candidateSha]);
  put("src/app/layout.tsx", "unrelated product change");
  assert.throws(() => bind(commit(baseSha)), /RUNTIME_BINDING_CHANGED/u);
  run(["read-tree", candidateSha]);
  put(product, originalBytes, "100755");
  assert.throws(() => bind(commit(baseSha)), /REPAIR_PATH_TYPE_CHANGED/u);
  run(["read-tree", candidateSha]);
  const narrowed = structuredClone(contracts);
  narrowed.contracts.find((c) => c.id !== CROSSDECK_R3.contractId).name += "hidden change";
  put("testing/contracts.json", JSON.stringify(narrowed));
  assert.throws(() => bind(commit(baseSha)), /CONTRACT_SCOPE_CHANGED/u);
});

function r3SourceEntries() {
  return execFileSync("git", ["ls-tree", "-rz", CROSSDECK_R3.blockedCandidate, "--", "src"], {
    cwd: repo,
    encoding: "utf8",
  })
    .trim()
    .split("\0")
    .filter(Boolean)
    .map((item) => {
      const [meta, file] = item.split("\t"),
        [mode, type, sha] = meta.split(" ");
      return { path: file, mode, type, sha };
    });
}
test("R3 copied repaired source is denied without ancestry, reference objects, ledgers or contracts", async (t) => {
  const directory = path.join(repo, "artifacts");
  mkdirSync(directory, { recursive: true });
  const root = mkdtempSync(path.join(directory, "r3-copied-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (args, input) =>
    execFileSync("git", args, { cwd: root, input, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
  git(["init", "-q"]);
  git(["config", "user.name", "Copied fixture"]);
  git(["config", "user.email", "fixture@example.invalid"]);
  git(["read-tree", "--empty"]);
  const baseSha = git(["commit-tree", git(["write-tree"]), "-m", "empty fixture"]);
  const source = r3SourceEntries();
  // Import source blobs only, never the original commit/tree/ancestry or refs.
  const pack = execFileSync("git", ["pack-objects", "--stdout"], {
    cwd: repo,
    input: [...new Set(source.map((e) => e.sha))].join("\n") + "\n",
    maxBuffer: 128 * 1024 * 1024,
  });
  execFileSync("git", ["index-pack", "--stdin"], { cwd: root, input: pack, stdio: ["pipe", "pipe", "pipe"] });
  git(["update-index", "--index-info"], source.map((e) => `${e.mode} ${e.type} ${e.sha}\t${e.path}`).join("\n") + "\n");
  const repaired = git(["hash-object", "-w", "--stdin"], "copied bounded repair");
  git(["update-index", "--cacheinfo", `100644,${repaired},${CROSSDECK_R3.productPaths[0]}`]);
  const candidateSha = git(["commit-tree", git(["write-tree"]), "-p", baseSha, "-m", "copied repaired fixture"]);
  git(["symbolic-ref", "HEAD", "refs/heads/copied"]);
  git(["update-ref", "refs/heads/copied", candidateSha]);
  git(["update-ref", "refs/remotes/origin/main", baseSha]);
  assert.equal(existsSync(path.join(root, ".git/objects/info/alternates")), false);
  assert.throws(() => git(["cat-file", "-e", CROSSDECK_R3.blockedCandidate]));
  assert.equal(recognizeExceptionExecution({ root, baseSha, candidateSha, environment: {} }), true);
  await assert.rejects(
    () =>
      captureProductExperience({
        root,
        plan: { applicable: true, baseSha, candidateSha },
        baseURL: "http://127.0.0.1:1",
        outputDirectory: "artifacts/forbidden",
      }),
    /INSTALLED_PROTECTED_BASE_REQUIRED/u,
  );
});
test("R3 history recognizes remote copied repaired source even under an omitted or wrong PR number", async (t) => {
  const f = await r3ApiFixture(t),
    candidate = "5".repeat(40);
  const extra = {
    ...f.current,
    runId: f.current.runId - 2,
    createdAt: "2026-10-15T18:30:00Z",
    displayTitle: `Sounding Line finite 1 capture 999 ${candidate} active`,
  };
  f.runs.set(extra.runId, remoteRun(extra, "completed", "failure"));
  const tree = r3SourceEntries().map((entry) =>
    entry.path === CROSSDECK_R3.productPaths[0] ? { ...entry, sha: "e".repeat(40) } : entry,
  );
  const request = async (endpoint, method, body) => {
    if (endpoint === `git/commits/${candidate}`) return { tree: { sha: "remote-copied-tree" } };
    if (endpoint === "git/trees/remote-copied-tree?recursive=1") return { truncated: false, tree };
    return f.request(endpoint, method, body);
  };
  await assert.rejects(
    () => requireFirstCampaignRun({ ...f, request, mode: "capture", run: f.current }),
    /EARLIER_ATTEMPT_CONSUMED/u,
  );
  assert.equal(
    f.operations.some((o) => o.method === "POST"),
    false,
  );
});

const r4Template = JSON.parse(
  readFileSync(path.join(repo, "testing/product-experience-exceptions.json"), "utf8"),
).exceptions.find((r) => r.id === CROSSDECK_R4.id);
const r5Template = JSON.parse(
  readFileSync(path.join(repo, "testing/product-experience-exceptions.json"), "utf8"),
).exceptions.find((r) => r.id === CROSSDECK_R5.id);
const r6Template = JSON.parse(
  readFileSync(path.join(repo, "testing/product-experience-exceptions.json"), "utf8"),
).exceptions.find((r) => r.id === CROSSDECK_R6.id);
const r7Template = JSON.parse(
  readFileSync(path.join(repo, "testing/product-experience-exceptions.json"), "utf8"),
).exceptions.find((r) => r.id === CROSSDECK_R7.id);

const r8Template = JSON.parse(
  readFileSync(path.join(repo, "testing/product-experience-exceptions.json")),
).exceptions.find((r) => r.id === CROSSDECK_R8.id);

test("R8 keeps R7 local PASS and consumed preparation17 FAIL while granting fresh finite ordinals", () => {
  const records = [
    template,
    successorTemplate,
    r3Template,
    r4Template,
    r5Template,
    r6Template,
    r7Template,
    structuredClone(r8Template),
  ];
  validateExceptionRecord(records[7], new Date("2026-10-16T12:00:00Z"));
  assert.deepEqual(selectTrustedExceptions(records), [records[7]]);
  assert.equal(hash(r7Template), CROSSDECK_R8.predecessorDigest);
  assert.equal(r8Template.immutableHistory.length, 1099);
  assert.deepEqual(r8Template.immutableHistory.slice(0, 475), r7Template.immutableHistory);
  assert.deepEqual(r8Template.executionBudget, r7Template.executionBudget);
  assert.equal(r8Template.expiresAt, r7Template.expiresAt);
  assert.equal(r8Template.predecessor.localStatus, "PASS");
  assert.equal(r8Template.predecessor.preparationStatus, "FAIL");
  assert.equal(r8Template.attemptHistory.nextPreparationAttemptTotal, 18);
  assert.equal(r8Template.attemptHistory.nextPairedLocalProofInvocationTotal, 3);
  assert.equal(r8Template.attemptHistory.remainingIndependentReviewOrdinal, 7);
  assert.equal(r8Template.attemptHistory.nextAuthenticatedReviewDispatchTotal, 3);
  assert.equal(r8Template.attemptHistory.nextOrdinaryDispatchTotal, 2);
  for (const change of [
    (r) => r.immutableHistory.pop(),
    (r) => r.executionBudget.reruns++,
    (r) => r.attemptHistory.nextPreparationAttemptTotal--,
    (r) => (r.predecessor.localStatus = "FAIL"),
    (r) => (r.predecessor.preparationStatus = "PASS"),
    (r) => (r.expiresAt = "2026-10-23T23:59:59Z"),
  ]) {
    const altered = structuredClone(r8Template);
    change(altered);
    assert.throws(() => validateExceptionRecord(altered, new Date("2026-10-16T12:00:00Z")), /R8_RECORD_CHANGED/u);
  }
  records[7].status = "RETIRED";
  assert.deepEqual(selectTrustedExceptions(records), []);
  records[6] = { ...records[6], status: "RETIRED" };
  assert.throws(() => selectTrustedExceptions(records), /R8_PREDECESSOR_REGISTRY_CHANGED/u);
});
test("R8 identical-source checkout is unrelated unless the explicit consumer PR matches", () => {
  const same = "a".repeat(40);
  for (const prNumber of [undefined, 741])
    assert.equal(
      campaignRelated({ root: "unused", baseSha: same, candidateSha: same, record: r8Template, prNumber }),
      false,
    );
  assert.equal(
    campaignRelated({ root: "unused", baseSha: same, candidateSha: same, record: r8Template, prNumber: 721 }),
    true,
  );
});
async function r8ApiFixture(t) {
  const f = await r7ApiFixture(t),
    p = CROSSDECK_R8.predecessor;
  const packet = JSON.parse(
    readFileSync(
      path.join(
        repo,
        "Development_Docs/Programs/Sounding_Line/evidence/crossdeck-r8-readiness-20261016/r7-custody-observation.json",
      ),
    ),
  );
  f.commits.set(p.baseSha, structuredClone(f.commits.get(f.plan.baseSha)));
  const { commitSha, ...payload } = packet;
  const created = await f.store.create("prepare", payload);
  f.commits.set(commitSha, structuredClone(f.commits.get(created.commitSha)));
  f.refs.set(`refs/tags/${p.namespace}/prepare`, { object: { type: "commit", sha: commitSha } });
  f.commits.set(p.candidateSha, { tree: { sha: p.candidateTree } });
  f.runs.set(
    p.runId,
    remoteRun(
      {
        ...runIdentity(p, p.runId, "workflow_dispatch", "capture"),
        createdAt: p.createdAt,
        workflowId: p.workflowId,
        headSha: p.baseSha,
        headBranch: "main",
      },
      "completed",
      "failure",
    ),
  );
  for (const a of p.artifacts)
    f.artifacts.set(a.id, {
      id: a.id,
      digest: a.digest,
      size_in_bytes: a.size,
      workflow_run: { id: p.runId, head_sha: p.baseSha },
    });
  const indexes = new Map(
    [p.failureIndexPath, p.localProofIndexPath].map((file) => [
      file,
      execFileSync("git", ["show", `${p.failureCommit}:${file}`], { cwd: repo, maxBuffer: 64 * 1024 * 1024 }),
    ]),
  );
  const request = async (endpoint, method, body) => {
    if (endpoint === `git/commits/${p.failureCommit}`) return { tree: { sha: "r8-preservation-tree" } };
    if (endpoint === "git/trees/r8-preservation-tree?recursive=1")
      return {
        truncated: false,
        tree: [...indexes.keys()].map((file) => ({ path: file, type: "blob", mode: "100644", sha: file })),
      };
    if (endpoint.startsWith("git/blobs/") && indexes.has(endpoint.slice(10)))
      return { content: indexes.get(endpoint.slice(10)).toString("base64") };
    return f.request(endpoint, method, body);
  };
  const current = { ...f.current, runId: 38890000000, createdAt: "2026-10-16T12:00:00Z" };
  f.runs.delete(f.current.runId);
  f.runs.set(current.runId, remoteRun(current));
  f.operations.length = 0;
  return {
    ...f,
    record: r8Template,
    plan: { ...f.plan, exception: recordBinding(r8Template) },
    current,
    request,
    priorStore: f.store,
    store: exceptionStore({ record: r8Template, request }),
    now: new Date(current.createdAt),
    indexes,
  };
}
const r9Template = JSON.parse(
  readFileSync(path.join(repo, "testing/product-experience-exceptions.json"), "utf8"),
).exceptions.find((record) => record.id === CROSSDECK_R9.id);
async function r9ApiFixture(t, supplied) {
  const f = await r8ApiFixture(t);
  const observation = JSON.parse(
    readFileSync(
      path.join(
        repo,
        "Development_Docs/Programs/Sounding_Line/evidence/crossdeck-r9-ordinary-only-20261016/r8-custody-read-only.original.raw.txt",
      ),
      "utf8",
    ),
  );
  const baseCommit = structuredClone(f.commits.get(f.plan.baseSha));
  for (const [slot, value] of Object.entries(observation.custody)) {
    if (!value) continue;
    f.commits.set(value.binding.baseSha, structuredClone(baseCommit));
    const { commitSha, ...payload } = value;
    const created = await f.store.create(slot, payload);
    f.commits.set(commitSha, structuredClone(f.commits.get(created.commitSha)));
    f.refs.set(`refs/tags/${r8Template.custody.namespace}/${slot}`, { object: { type: "commit", sha: commitSha } });
  }
  for (const value of Object.values(observation.resources)) {
    if (value.run_attempt) f.runs.set(value.id, structuredClone(value));
    else f.artifacts.set(value.id, structuredClone(value));
  }
  const p = r9Template.predecessor;
  f.commits.set(p.candidateSha, { tree: { sha: p.candidateTree } });
  const indexes = new Map(
    [p.failureIndexPath, p.localProofIndexPath].map((file) => [
      file,
      execFileSync("git", ["show", `${p.failurePublication}:${file}`], { cwd: repo, maxBuffer: 64 * 1024 * 1024 }),
    ]),
  );
  const request = async (endpoint, method, body) => {
    if (endpoint === `git/commits/${p.failurePublication}`) return { tree: { sha: p.failurePublicationTree } };
    if (endpoint === `git/trees/${p.failurePublicationTree}?recursive=1`)
      return {
        truncated: false,
        tree: [...indexes.keys()].map((file) => ({ path: file, mode: "100644", type: "blob", sha: file })),
      };
    if (endpoint.startsWith("git/blobs/") && indexes.has(endpoint.slice(10)))
      return { content: indexes.get(endpoint.slice(10)).toString("base64") };
    return f.request(endpoint, method, body);
  };
  let root = supplied?.root ?? f.root;
  let plan = supplied?.plan;
  if (!plan) {
    const registry = JSON.parse(readFileSync(path.join(repo, "testing/product-experience-exceptions.json"), "utf8"));
    const bridge = {
      version: 1,
      id: CROSSDECK_R9.bridgeId,
      status: "ACTIVE",
      exceptionId: CROSSDECK_R9.id,
      recordDigest: CROSSDECK_R9.recordDigest,
      overlay: R9_OVERLAY_PATHS.map((file) => ({
        path: file,
        oldMode: null,
        oldBlob: null,
        newMode: "100644",
        newBlob: "b".repeat(40),
      })),
    };
    registry.reconciliations = [...registry.reconciliations.slice(0, 1), bridge];
    f.write("testing/product-experience-exceptions.json", registry);
    const baseSha = f.commit();
    f.write("fixture-publication.md", "Synthetic publication\n");
    const candidateSha = f.commit();
    plan = { ...f.plan, baseSha, candidateSha, exception: recordBinding(r9Template) };
    plan.exception.nonExecutingReconciliation = pendingR9Reconciliation({ root, baseSha, plan, record: r9Template });
  }
  f.commits.set(plan.baseSha, structuredClone(baseCommit));
  const current = {
    ...f.current,
    runId: 39999100000,
    createdAt: "2026-10-16T18:00:00Z",
    event: "pull_request_target",
    headSha: plan.candidateSha,
    headBranch: "candidate",
    displayTitle: `Sounding Line finite 1 ordinary 721 ${plan.candidateSha} active`,
  };
  f.runs.delete(f.current.runId);
  f.runs.set(current.runId, remoteRun(current));
  f.refs.set("refs/heads/main", { object: { sha: plan.baseSha } });
  f.operations.length = 0;
  return {
    ...f,
    root,
    record: r9Template,
    plan,
    current,
    request,
    indexes,
    observation,
    store: exceptionStore({ record: r9Template, request }),
    now: new Date(current.createdAt),
  };
}

test("R9 authenticates all twelve predecessor runs, consumed reservation and failure indexes before any write", async (t) => {
  const f = await r9ApiFixture(t);
  assert.equal((await validateSuccessorPredecessor(f)).length, 12);
  assert(f.operations.every((op) => op.method === "GET"));
  for (const file of f.indexes.keys()) {
    const prior = f.indexes.get(file);
    f.indexes.set(file, Buffer.from("changed original"));
    await assert.rejects(() => validateSuccessorPredecessor(f), /R9_PRESERVATION_INDEX_CHANGED/u);
    f.indexes.set(file, prior);
  }
  const failed = f.runs.get(r9Template.predecessor.runId);
  failed.conclusion = "cancelled";
  await assert.rejects(() => validateSuccessorPredecessor(f), /R9_CONSUMED_RUN_CHANGED/u);
  failed.conclusion = "failure";
  const oldQualifyRef = `refs/tags/${r8Template.custody.namespace}/qualify`;
  const value = f.refs.get(oldQualifyRef);
  f.refs.delete(oldQualifyRef);
  await assert.rejects(() => validateSuccessorPredecessor(f), /R9_CONSUMED_QUALIFICATION_CHANGED/u);
  f.refs.set(oldQualifyRef, value);
  assert(f.operations.every((op) => op.method === "GET"));
});

test("R9 reserves only ordinary3 in its own namespace and exposes an explicit read-only historical view", async (t) => {
  const f = await r9ApiFixture(t);
  const historical = historicalExceptionContext(f);
  assert.equal(historical.plan.baseSha, R8_FORMAT.baseSha);
  assert.equal((await historical.store.read("prepare")).commitSha, R8_FORMAT.prepareCommit);
  assert.throws(() => historical.store.read("qualify"), /R9_HISTORICAL_SLOT_FORBIDDEN/u);
  assert.throws(() => historical.store.create("prepare", {}), /R9_HISTORICAL_WRITE_FORBIDDEN/u);
  for (const mode of ["capture", "review", "verify"])
    await assert.rejects(() => reserveExceptionStage({ ...f, run: f.current, mode }), /R9_MODE_FORBIDDEN/u);
  assert(f.operations.every((op) => op.method === "GET"));
  await reserveExceptionStage({ ...f, run: f.current, mode: "ordinary" });
  assert.deepEqual((await f.store.read("qualify")).binding, exceptionBinding(f.plan));
  const writes = f.operations.filter((op) => op.method !== "GET").length;
  await assert.rejects(
    () => reserveExceptionStage({ ...f, run: f.current, mode: "ordinary" }),
    /QUALIFICATION_ALREADY_CONSUMED/u,
  );
  assert.equal(f.operations.filter((op) => op.method !== "GET").length, writes);
  assert.equal(
    (await exceptionStore({ record: r8Template, request: f.request }).read("qualify")).commitSha,
    r9Template.predecessor.qualifyCommit,
  );
});

test("R9 default attestation client keeps one retry budget through historical projection", async (t) => {
  const f = await r9ApiFixture(t),
    attempts = new Map(),
    reports = [];
  const prepare = `git/ref/tags/${r8Template.custody.namespace}/prepare`;
  const capture = `git/ref/tags/${r8Template.custody.namespace}/capture`;
  let factories = 0;
  const createRequest = () => {
    factories++;
    return createCustodyRequest({
      repository: r9Template.repository,
      token: "synthetic",
      wait: async () => {},
      report: (value) => reports.push(value),
      fetchImpl: async (url, options) => {
        const route = url.slice(`https://api.github.com/repos/${r9Template.repository}/`.length);
        const count = (attempts.get(route) ?? 0) + 1;
        attempts.set(route, count);
        if ((route === prepare && [1, 3].includes(count)) || (route === capture && count === 1))
          return { ok: false, status: 503, json: async () => ({}) };
        const value = await f.request(route, options.method);
        return { ok: value !== null, status: value === null ? 404 : 200, json: async () => value };
      },
    });
  };
  await assert.rejects(
    () =>
      verifyExceptionAttestation({
        root: f.root,
        plan: f.plan,
        evidence: {},
        capture: {},
        review: {},
        now: f.now,
        createRequest,
      }),
    /CUSTODY_READ_TRANSPORT_EXHAUSTED/u,
  );
  assert.equal(factories, 1);
  assert.equal(attempts.get(prepare), 3);
  assert.equal(attempts.get(capture), 2);
  assert.equal(reports.filter((value) => value.willRetry).length, 2);
  assert.equal(reports.at(-1).willRetry, false);
  assert(f.operations.every((op) => op.method === "GET"));
});

// Supporting immutable-source integration only. All API operations below use the
// in-memory fixture; synthetic PASS fields test seal consistency, not execution.
if (process.env.SOUNDING_LINE_R9_SOURCE_FIXTURE)
  test(
    "R9 real merged source preserves historical proof, complete obligations and separate one-use custody",
    { timeout: 300_000 },
    async (t) => {
      const invoke = (cwd, args, options = {}) =>
        execFileSync("git", args, {
          cwd,
          encoding: "utf8",
          maxBuffer: 64 * 1024 * 1024,
          stdio: ["pipe", "pipe", "pipe"],
          ...options,
        }).trim();
      const baseSha = invoke(repo, ["rev-parse", "HEAD"]);
      const owned = mkdtempSync(path.join(tmpdir(), "r9-source-integration-")),
        checkout = path.join(owned, "checkout");
      assert(owned.startsWith(path.resolve(tmpdir()) + path.sep));
      t.after(() => {
        if (existsSync(path.join(checkout, ".git"))) invoke(repo, ["worktree", "remove", "--force", checkout]);
        rmSync(owned, { recursive: true, force: true });
      });
      const merge = spawnSync("git", ["merge-tree", "--write-tree", baseSha, CROSSDECK_R9.frozenReferenceSha], {
        cwd: repo,
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
      });
      assert([0, 1].includes(merge.status), merge.stderr);
      const tree = merge.stdout.split(/\r?\n/u)[0];
      const conflicts = [...merge.stdout.matchAll(/^\d{6} [a-f0-9]{40} [123]\t(.+)$/gmu)].map((value) => value[1]);
      assert(
        conflicts.every((file) => R8_FORMAT_REGENERATED_METADATA.includes(file)),
        merge.stdout,
      );
      const commitTree = (treeSha) =>
        invoke(
          repo,
          [
            "-c",
            "user.name=Fixture",
            "-c",
            "user.email=fixture@example.invalid",
            "commit-tree",
            treeSha,
            "-p",
            baseSha,
            "-p",
            CROSSDECK_R9.frozenReferenceSha,
          ],
          { input: "Nonexecuting R9 source fixture\n" },
        );
      invoke(repo, ["worktree", "add", "--no-checkout", "--detach", checkout, commitTree(tree)]);
      invoke(checkout, ["-c", "core.longpaths=true", "read-tree", "-mu", "HEAD"]);
      await generateDocumentIndex({ root: checkout, baseRef: baseSha });
      const union = JSON.parse(readFileSync(path.join(checkout, R8_FORMAT_REGENERATED_METADATA[0]), "utf8"));
      const documentPaths = new Set(union.records.map((entry) => entry.path));
      const treePaths = (revision) => new Set(invoke(repo, ["ls-tree", "-r", "--name-only", revision]).split(/\r?\n/u));
      const mergedPaths = treePaths(tree),
        sourcePaths = treePaths(CROSSDECK_R9.frozenReferenceSha),
        commonPaths = treePaths("43340791355526fb31fe2dbf9274eb8632589b30");
      for (const revision of [CROSSDECK_R9.frozenReferenceSha, baseSha])
        for (const entry of JSON.parse(invoke(repo, ["show", `${revision}:${R8_FORMAT_REGENERATED_METADATA[0]}`]))
          .records)
          if (mergedPaths.has(entry.path)) assert(documentPaths.has(entry.path), `Union inventory lost ${entry.path}`);
          else
            assert(
              commonPaths.has(entry.path) && !sourcePaths.has(entry.path),
              `Unexplained maintenance loss ${entry.path}`,
            );
      const matrixRows = readFileSync(path.join(checkout, R8_FORMAT_REGENERATED_METADATA[1]), "utf8")
        .trim()
        .split(/\r?\n/u);
      const matrix = new Set(matrixRows);
      assert.equal(matrix.size, matrixRows.length, "Duplicate migration rows");
      const oldPaths = matrixRows.slice(1).map((row) => row.match(/^"((?:[^"]|"")*)",/u)?.[1]);
      assert(oldPaths.every((file) => typeof file === "string"));
      assert.equal(new Set(oldPaths).size, oldPaths.length, "Duplicate or conflicting migration paths");
      const renamed = new Map(
        invoke(checkout, ["diff", "--name-status", "-M", baseSha, "--"])
          .split(/\r?\n/u)
          .map((line) => line.split("\t"))
          .filter(([status]) => /^R\d+$/u.test(status))
          .map(([, before, after]) => [before, after]),
      );
      for (const revision of [CROSSDECK_R9.frozenReferenceSha, baseSha])
        for (const row of invoke(repo, ["show", `${revision}:${R8_FORMAT_REGENERATED_METADATA[1]}`]).split(/\r?\n/u)) {
          if (matrix.has(row)) continue;
          const fields = [...row.matchAll(/"((?:[^"]|"")*)"/gu)].map((match) => match[1].replaceAll('""', '"'));
          assert.equal(fields.length, 12, `Invalid published migration row: ${row}`);
          const target = renamed.get(fields[0]);
          assert(target && mergedPaths.has(target), `Unexplained migration loss from ${revision}: ${row}`);
          fields[5] = target;
          fields[6] = "move";
          const relocated = fields.map((value) => `"${value.replaceAll('"', '""')}"`).join(",");
          assert(matrix.has(relocated), `Union migration inventory lost observed relocation ${fields[0]}`);
        }
      assert.deepEqual(await validateDocumentation(checkout), []);
      invoke(checkout, ["add", "--", ...R8_FORMAT_REGENERATED_METADATA]);
      const candidateSha = commitTree(invoke(checkout, ["write-tree"]));
      invoke(checkout, ["-c", "core.longpaths=true", "reset", "--hard", candidateSha]);
      const ordinary = await buildPlan({
        root: checkout,
        baseSha,
        candidateSha,
        experienceEvidenceRequired: false,
        prNumber: 721,
      });
      const plan = ordinary.productExperience;
      assert.equal(plan.exception.id, CROSSDECK_R9.id);
      assert.equal(plan.contextCount, 38);
      assert.deepEqual(ordinary.selected.browserTests, r9Template.requiredTechnicalBrowserTests);
      assert.notEqual(plan.sourceDigest, R8_FORMAT.sourceDigest);
      const pending = { ...plan, exception: recordBinding(r9Template) };
      pending.exception.nonExecutingReconciliation = pendingR9Reconciliation({
        root: checkout,
        baseSha,
        plan: pending,
        record: r9Template,
      });
      assert.deepEqual(exceptionBinding(pending), exceptionBinding(plan));
      const evidence = JSON.parse(invoke(checkout, ["show", `${candidateSha}:${plan.evidencePath}`]));
      assert.equal(evidence.baseSha, R8_FORMAT.baseSha);
      assert.equal(evidence.sourceDigest, R8_FORMAT.sourceDigest);
      const peDecision = verifyProductExperience(checkout, candidateSha, plan);
      assert.equal(peDecision.status, "PASS");
      assert.equal(peDecision.sourceDigest, plan.sourceDigest);
      const inventory = trackedEntries(checkout, candidateSha),
        obligations = await buildEvidenceObligations(checkout, ordinary);
      assert.equal(obligations.length, 8);
      const privacy = obligations.find((entry) =>
        entry.commandLabels.some((label) => label.includes("private-content/scan")),
      );
      assert.deepEqual(
        privacy.fingerprint.semanticClosureMembers,
        inventory.map((entry) => `${entry.path}@${entry.blob}`).sort(),
      );
      const api = await r9ApiFixture(t, { root: checkout, plan });
      assert.equal((await validateSuccessorPredecessor(api)).length, 12);
      const historical = r9HistoricalEvidencePlan(plan);
      const capture = {
        ...evidence,
        exception: historical.exception,
        exceptionPreparationReservation: R8_FORMAT.prepareCommit,
        trustedArtifact: api.observation.custody.capture.provenance,
      };
      const review = {
        exception: historical.exception,
        exceptionPreparationReservation: R8_FORMAT.prepareCommit,
        exceptionReviewSeal: R8_FORMAT.reviewSeal,
        captureArtifactId: evidence.captureArtifactId,
        reviews: evidence.reviews,
        pairedEvidenceDigest: hash(evidence.pairedEvidence),
      };
      const attestation = await verifyTrustedExperienceAttestation({
        root: checkout,
        plan,
        evidence,
        custodyRequest: api.request,
        loadArtifact: async ({ kind }) => (kind === "capture" ? capture : review),
      });
      assert.equal(attestation.status, "PASS");
      assert.equal(attestation.currentSourceDigest, plan.sourceDigest);
      assert.equal(attestation.reviewedSourceDigest, R8_FORMAT.sourceDigest);
      assert(api.operations.every((op) => op.method === "GET"));
      await reserveExceptionStage({ ...api, run: api.current, mode: "ordinary" });
      const groups = verificationObligationGroups(ordinary);
      const decision = {
        ...ordinary,
        decision: "PASS",
        productExperience: { ...plan, trustedAttestation: attestation },
        productExperienceDecision: peDecision,
        productExperienceReplay: { status: "PASS", sourceDigest: plan.sourceDigest },
        timing: { commands: groups.map((group) => ({ obligationId: group.id, status: "PASS" })) },
        evidenceReconciliation: {
          requiredObligations: groups.length,
          obligations: groups.map((group) => ({ id: group.id, commands: group.commandLabels })),
          reconciliation: groups.map((group) => ({
            obligationId: group.id,
            receiptId: `synthetic-${group.id}`,
            disposition: "FRESH",
            freshExecuted: true,
          })),
          finalization: {
            authority: "SOUNDING_LINE_EVIDENCE_FINALIZER",
            decision: "PASS",
            requiredObligations: groups.length,
            errors: [],
            remainder: [],
            closure: groups.map((group) => ({
              obligationId: group.id,
              receiptId: `synthetic-${group.id}`,
              satisfied: true,
            })),
          },
        },
      };
      await sealExceptionQualification({
        root: checkout,
        record: r9Template,
        plan,
        ordinary,
        run: api.current,
        store: api.store,
        decision,
      });
      assert.equal((await api.store.read("qualified")).candidateSha, candidateSha);
      await assert.rejects(
        () => reserveExceptionStage({ ...api, run: api.current, mode: "ordinary" }),
        /QUALIFICATION_ALREADY_CONSUMED/u,
      );
      let requests = 0;
      await assert.rejects(
        () =>
          assertExceptionExecution({
            root: checkout,
            plan,
            kind: "experience",
            environment: { SOUNDING_LINE_PR_NUMBER: "721", SOUNDING_LINE_R9_LOCAL_LEASE: "forbidden" },
            request: async () => {
              requests++;
              throw Error("No live request permitted");
            },
          }),
        /R8_FORMAT_EXECUTION_FORBIDDEN/u,
      );
      assert.equal(requests, 0);
      t.diagnostic(
        JSON.stringify({
          classification: "READ_ONLY_SOURCE_AND_FAKE_CUSTODY_NOT_QUALIFICATION",
          baseSha,
          candidateSha,
          sourceDigest: plan.sourceDigest,
          inventoryEntries: inventory.length,
          obligations: obligations.length,
          verificationCommands: 0,
          browsers: 0,
          captures: 0,
          liveRequests: 0,
          liveCustodyWrites: 0,
        }),
      );
    },
  );
test("R8 preserves exact R7 reservation, failed run, artifacts and both indexes before any custody write", async (t) => {
  const f = await r8ApiFixture(t),
    p = CROSSDECK_R8.predecessor;
  assert.equal((await validateSuccessorPredecessor(f)).length, 9);
  for (const file of f.indexes.keys()) {
    const bytes = f.indexes.get(file);
    f.indexes.set(file, Buffer.from("changed original"));
    await assert.rejects(() => validateSuccessorPredecessor(f), /R8_PRESERVATION_INDEX_CHANGED/u);
    f.indexes.set(file, bytes);
  }
  for (const key of ["run_attempt", "event", "conclusion"]) {
    const run = f.runs.get(p.runId),
      prior = run[key];
    run[key] = key === "run_attempt" ? 2 : "changed";
    await assert.rejects(() => validateSuccessorPredecessor(f), /PREDECESSOR_RUN_CHANGED/u);
    run[key] = prior;
  }
  for (const a of p.artifacts) {
    const value = f.artifacts.get(a.id),
      prior = value.digest;
    value.digest = "changed";
    await assert.rejects(() => validateSuccessorPredecessor(f), /PREDECESSOR_ARTIFACT_CHANGED/u);
    value.digest = prior;
  }
  const reservationRef = `refs/tags/${p.namespace}/prepare`;
  const savedRef = f.refs.get(reservationRef);
  f.refs.delete(reservationRef);
  await assert.rejects(() => validateSuccessorPredecessor(f), /PREDECESSOR_RESERVATION_CHANGED/u);
  f.refs.set(reservationRef, savedRef);
  const tree = f.trees.get(f.commits.get(p.prepareCommit).tree.sha);
  const entry = tree.tree.find((e) => e.path === ".sounding-line-exception-reservation.json");
  const originalBlob = await f.request(`git/blobs/${entry.sha}`);
  const originalContent = originalBlob.content;
  const changed = JSON.parse(Buffer.from(originalBlob.content, "base64"));
  changed.attemptHistory.status = "changed payload";
  originalBlob.content = Buffer.from(JSON.stringify(changed)).toString("base64");
  await assert.rejects(() => validateSuccessorPredecessor(f), /R8_PREDECESSOR_PREPARE_CHANGED/u);
  originalBlob.content = originalContent;
  assert(f.operations.every((o) => o.method === "GET"));
  await f.priorStore.create("review7", { binding: exceptionBinding(f.plan), unexpected: true });
  const writes = f.operations.filter((o) => o.method !== "GET").length;
  await assert.rejects(() => validateSuccessorPredecessor(f), /R8_PREDECESSOR_CONSUMPTION_CHANGED/u);
  assert.equal(f.operations.filter((o) => o.method !== "GET").length, writes);
});

test("R7 preserves consumed R6 and every predecessor while granting only a separate finite successor", () => {
  const records = [
    template,
    successorTemplate,
    r3Template,
    r4Template,
    r5Template,
    r6Template,
    structuredClone(r7Template),
  ];
  validateExceptionRecord(records[6], new Date("2026-10-16T08:00:00Z"));
  assert.deepEqual(selectTrustedExceptions(records), [records[6]]);
  assert.equal(hash(r6Template), CROSSDECK_R7.predecessorDigest);
  assert.equal(r7Template.immutableHistory.length, 475);
  assert.deepEqual(r7Template.immutableHistory.slice(0, 405), r6Template.immutableHistory);
  assert.deepEqual(r7Template.r5MediaArchive, r6Template.r5MediaArchive);
  assert.equal(r7Template.expiresAt, r6Template.expiresAt);
  assert.deepEqual(r7Template.executionBudget, r6Template.executionBudget);
  assert.equal(r7Template.attemptHistory.pairedLocalProofInvocationsCompletedSeparately, 1);
  assert.equal(r7Template.attemptHistory.nextPairedLocalProofInvocationTotal, 2);
  assert.equal(r7Template.predecessor.status, "FAIL");
  assert.equal(r7Template.predecessor.pairedCaseExecutions, null);
  assert.equal(r7Template.predecessor.participatingBrowserContexts, null);
  for (const change of [
    (r) => r.executionBudget.reruns++,
    (r) => r.executionBudget.targetedLocalProofInvocations++,
    (r) => r.immutableHistory.pop(),
    (r) => (r.predecessor.status = "PASS"),
    (r) => (r.predecessor.pairedCaseExecutions = 3),
    (r) => (r.frozenBlobs[".prettierignore"] = "f".repeat(40)),
    (r) => (r.consumerSource.paths[1].blob = r6Template.consumerSource.paths[1].blob),
    (r) => (r.expiresAt = "2026-10-23T23:59:59Z"),
  ]) {
    const altered = structuredClone(r7Template);
    change(altered);
    assert.throws(() => validateExceptionRecord(altered, new Date("2026-10-16T08:00:00Z")), /R7_RECORD_CHANGED/u);
  }
  const changedPrior = structuredClone(records);
  changedPrior[5].status = "RETIRED";
  assert.throws(() => selectTrustedExceptions(changedPrior), /R7_PREDECESSOR_REGISTRY_CHANGED/u);
  records[6].status = "RETIRED";
  assert.deepEqual(selectTrustedExceptions(records), []);
  assert.throws(() => validateExceptionRecord(r7Template, new Date(r7Template.expiresAt)), /EXPIRED/u);
});

async function r7ApiFixture(t) {
  const f = await r6ApiFixture(t),
    p = CROSSDECK_R7.predecessor;
  const bytes = execFileSync("git", ["show", `${p.failureCommit}:${p.failureIndexPath}`], { cwd: repo });
  const observation = { bytes };
  const request = async (endpoint, method, body) => {
    if (endpoint === `git/commits/${p.failureCommit}`) return { tree: { sha: "r7-failure-tree" } };
    if (endpoint === "git/trees/r7-failure-tree?recursive=1")
      return {
        truncated: false,
        tree: [{ path: p.failureIndexPath, type: "blob", mode: "100644", sha: "failure-index" }],
      };
    if (endpoint === "git/blobs/failure-index") return { content: observation.bytes.toString("base64") };
    return f.request(endpoint, method, body);
  };
  const current = { ...f.current, runId: 38872000000, createdAt: "2026-10-16T08:00:00Z" };
  f.runs.delete(f.current.runId);
  f.runs.set(current.runId, remoteRun(current));
  return {
    ...f,
    record: r7Template,
    plan: { ...f.plan, exception: recordBinding(r7Template) },
    request,
    current,
    now: new Date("2026-10-16T08:00:00Z"),
    priorStore: f.store,
    store: exceptionStore({ record: r7Template, request }),
    observation,
  };
}
test("R7 preserves the original R6 failure index and eight consumed runs before any custody write", async (t) => {
  const args = await r7ApiFixture(t);
  assert.equal((await validateSuccessorPredecessor(args)).length, 8);
  const bytes = args.observation.bytes;
  args.observation.bytes = Buffer.from("changed failure verdict");
  await assert.rejects(() => validateSuccessorPredecessor(args), /R7_FAILURE_INDEX_CHANGED/u);
  args.observation.bytes = bytes;
  await args.priorStore.create("prepare", { binding: exceptionBinding(args.plan), unexpectedR6Reservation: true });
  const writes = args.operations.filter((o) => o.method !== "GET").length;
  await assert.rejects(() => validateSuccessorPredecessor(args), /R7_PREDECESSOR_CONSUMPTION_CHANGED/u);
  assert.equal(args.operations.filter((o) => o.method !== "GET").length, writes);
});
async function r6ApiFixture(t) {
  const f = await r5ApiFixture(t),
    p = CROSSDECK_R6.predecessor;
  const packet = JSON.parse(
    readFileSync(
      path.join(
        repo,
        "Development_Docs/Programs/Sounding_Line/evidence/crossdeck-r6-paired-20261016/r5-custody.original.json",
      ),
      "utf8",
    ),
  );
  f.commits.set(p.baseSha, structuredClone(f.commits.get(f.plan.baseSha)));
  const fifthStore = exceptionStore({ record: r5Template, request: f.request });
  const { commitSha, ...payload } = packet;
  const created = await fifthStore.create("prepare", payload);
  f.commits.set(commitSha, structuredClone(f.commits.get(created.commitSha)));
  f.refs.set(`refs/tags/${p.namespace}/prepare`, { object: { type: "commit", sha: commitSha } });
  f.commits.set(p.candidateSha, { tree: { sha: p.candidateTree } });
  const historical = {
    ...runIdentity(p, p.runId, "workflow_dispatch", "capture"),
    createdAt: p.createdAt,
    workflowId: p.workflowId,
    headSha: p.baseSha,
    headBranch: "main",
  };
  f.runs.set(p.runId, remoteRun(historical, "completed", "success"));
  for (const a of p.artifacts)
    f.artifacts.set(a.id, {
      id: a.id,
      digest: a.digest,
      size_in_bytes: a.size,
      workflow_run: { id: p.runId, head_sha: p.baseSha },
    });
  const review = CROSSDECK_R6.blockedReview;
  const bytes = execFileSync("git", ["show", `${review.commit}:${review.path}`], {
    cwd: repo,
    maxBuffer: 64 * 1024 * 1024,
  });
  const request = async (endpoint, method, body) => {
    if (endpoint === `git/commits/${review.commit}`) return { tree: { sha: "r6-blocked-review-tree" } };
    if (endpoint === "git/trees/r6-blocked-review-tree?recursive=1")
      return {
        truncated: false,
        tree: [{ path: review.path, type: "blob", mode: "100644", sha: "r6-blocked-review-blob" }],
      };
    if (endpoint === "git/blobs/r6-blocked-review-blob") return { content: bytes.toString("base64") };
    return f.request(endpoint, method, body);
  };
  const plan = { ...f.plan, exception: recordBinding(r6Template), contractDigest: r6Template.contractDigest };
  const current = { ...f.current, runId: 38860000000, createdAt: "2026-10-16T05:10:00Z" };
  f.runs.delete(f.current.runId);
  f.runs.set(current.runId, remoteRun(current));
  f.operations.length = 0;
  return {
    ...f,
    record: r6Template,
    plan,
    current,
    request,
    fifthStore,
    store: exceptionStore({ record: r6Template, request }),
    now: new Date(current.createdAt),
  };
}
test("R6 pins both actual owner approvals, all old records and finite counted stages; retirement cannot revive R5", () => {
  const records = [template, successorTemplate, r3Template, r4Template, r5Template, structuredClone(r6Template)];
  validateExceptionRecord(records[5], new Date("2026-10-16T05:10:00Z"));
  assert.deepEqual(selectTrustedExceptions(records), [records[5]]);
  assert.equal(hash(r5Template), CROSSDECK_R6.predecessorDigest);
  assert.equal(records[5].attemptHistory.nextPreparationAttemptTotal, 17);
  assert.equal(records[5].attemptHistory.completedIndependentReviews, 6);
  assert.equal(records[5].attemptHistory.nextAuthenticatedReviewDispatchTotal, 3);
  assert.equal(records[5].attemptHistory.nextOrdinaryDispatchTotal, 2);
  assert.equal(records[5].r5MediaArchive.length, 228);
  for (const change of [
    (r) => r.executionBudget.reruns++,
    (r) => r.executionBudget.targetedLocalProofInvocations++,
    (r) => r.executionBudget.productRepairs++,
    (r) => r.immutableHistory.pop(),
    (r) => r.attemptHistory.completedIndependentReviews--,
    (r) => r.requiredTechnicalBrowserTests.pop(),
    (r) => (r.ownerApproval.frozenDispositionApproval.answer = "maybe"),
    (r) => (r.expiresAt = "2026-10-23T23:59:59Z"),
  ]) {
    const altered = structuredClone(r6Template);
    change(altered);
    assert.throws(() => validateExceptionRecord(altered, new Date("2026-10-16T05:10:00Z")), /R6_RECORD_CHANGED/u);
  }
  records[5].status = "RETIRED";
  assert.deepEqual(selectTrustedExceptions(records), []);
  assert.throws(() => validateExceptionRecord(r6Template, new Date(r6Template.expiresAt)), /EXPIRED/u);
});
test("R6 preserves eight exact consumed runs and blocked review6; local admission rejects any extra pre-ref execution", async (t) => {
  const f = await r6ApiFixture(t);
  const prior = await validateSuccessorPredecessor({ record: f.record, request: f.request, now: f.now });
  assert.equal(prior.length, 8);
  assert(prior.some((r) => r.id === 38840988544));
  await requireFirstCampaignRun({ ...f, root: f.root, mode: "capture", run: f.current });
  f.runs.delete(f.current.runId);
  assert.equal((await inspectCampaignBeforeLocalProof({ ...f, root: f.root, now: f.now })).preservedPredecessorRuns, 8);
  f.runs.set(f.current.runId, remoteRun(f.current, "queued", null));
  await assert.rejects(
    () => inspectCampaignBeforeLocalProof({ ...f, root: f.root, now: f.now }),
    /LOCAL_HISTORY_EXECUTION_ALREADY_CONSUMED/u,
  );
  assert(f.operations.every((o) => o.method === "GET"));
});
async function r5ApiFixture(t) {
  const f = await r4ApiFixture(t),
    p = CROSSDECK_R5.predecessor;
  const packets = JSON.parse(
    readFileSync(
      path.join(
        repo,
        "Development_Docs/Programs/Sounding_Line/evidence/crossdeck-r5-transport-20261015/r4-custody.original.json",
      ),
    ),
  );
  f.commits.set(p.baseSha, structuredClone(f.commits.get(f.plan.baseSha)));
  const fourthStore = exceptionStore({ record: r4Template, request: f.request });
  for (const seal of p.seals) {
    const { commitSha, ...payload } = packets[seal.slot];
    const created = await fourthStore.create(seal.slot, payload);
    f.commits.set(commitSha, structuredClone(f.commits.get(created.commitSha)));
    f.refs.set(`refs/tags/${p.namespace}/${seal.slot}`, { object: { type: "commit", sha: commitSha } });
  }
  f.commits.set(p.candidateSha, { tree: { sha: p.candidateTree } });
  f.commits.set(p.consumerSha, { tree: { sha: p.consumerTree } });
  for (const r of p.runs) {
    const identity = {
      ...runIdentity(r, r.runId, r.event, r.mode),
      createdAt: r.createdAt,
      workflowId: r.workflowId,
      headSha: r.headSha,
      headBranch: r.headBranch,
    };
    f.runs.set(r.runId, remoteRun(identity, "completed", r.conclusion));
    for (const a of r.artifacts)
      f.artifacts.set(a.id, {
        id: a.id,
        digest: a.digest,
        size_in_bytes: a.size,
        workflow_run: { id: r.runId, head_sha: r.headSha },
      });
  }
  const jobs = {
    total_count: p.failedOrdinary.jobs.length,
    jobs: p.failedOrdinary.jobs.map(({ completedAt, ...j }) => ({ ...structuredClone(j), completed_at: completedAt })),
  };
  const request = async (endpoint, method, body) => {
    if (endpoint === `actions/runs/${p.failedOrdinary.runId}/jobs?per_page=100`) return jobs;
    if (endpoint === `actions/runs/${p.failedOrdinary.runId}/artifacts?per_page=100`)
      return { total_count: 0, artifacts: [] };
    return f.request(endpoint, method, body);
  };
  const plan = { ...f.plan, exception: recordBinding(r5Template) };
  const current = { ...f.current, runId: 38830000000, createdAt: "2026-10-16T02:00:00Z" };
  f.runs.delete(f.current.runId);
  f.runs.set(current.runId, remoteRun(current));
  f.operations.length = 0;
  return {
    ...f,
    record: r5Template,
    plan,
    current,
    jobs,
    request,
    fourthStore,
    store: exceptionStore({ record: r5Template, request }),
    now: new Date(current.createdAt),
  };
}
test("R5 pins actual approval provenance, finite scope and all old records; retirement never revives them", () => {
  const records = [template, successorTemplate, r3Template, r4Template, structuredClone(r5Template)];
  validateExceptionRecord(records[4], new Date("2026-10-16T02:00:00Z"));
  assert.deepEqual(selectTrustedExceptions(records), [records[4]]);
  assert.equal(hash(r4Template), CROSSDECK_R5.predecessorDigest);
  assert.equal(recordBinding(records[4]).attemptHistory.nextPreparationAttemptTotal, 16);
  assert.equal(records[4].ownerApproval.approvedAtUtcMinute, null);
  for (const mutate of [
    (r) => r.executionBudget.reruns++,
    (r) => r.executionBudget.productRepairs++,
    (r) => r.executionBudget.paidProviderCalls++,
    (r) => r.requiredTechnicalBrowserTests.pop(),
    (r) => r.immutableHistory.pop(),
    (r) => r.attemptHistory.priorOrdinaryFailures--,
    (r) => (r.ownerApproval.executionNotBeforeUtc = r.predecessor.campaignEpoch),
    (r) => (r.ownerApproval.answer = "YES"),
    (r) => (r.ownerApproval.scopeRelayTurnId = "invented"),
    (r) => (r.remainingIndependentReviewOrdinal = 5),
  ]) {
    const record = structuredClone(r5Template);
    mutate(record);
    assert.throws(() => validateExceptionRecord(record), /R5_RECORD_CHANGED/u);
  }
  records[4].status = "RETIRED";
  assert.deepEqual(selectTrustedExceptions(records), []);
  assert.throws(
    () => selectTrustedExceptions(records.filter((r) => r.id !== CROSSDECK_R4.id)),
    /R5_PREDECESSOR_REGISTRY_CHANGED/u,
  );
  assert.throws(() => validateExceptionRecord(r5Template, new Date(r5Template.expiresAt)), /EXPIRED/u);
});
test("R5 validates all seven exact historical runs, four sealed R4 packets and original epoch before one reservation", async (t) => {
  const f = await r5ApiFixture(t);
  const historical = await validateSuccessorPredecessor(f);
  assert.equal(historical.length, 7);
  assert(
    historical.some((r) => r.id === 38822426167 && r.conclusion === "failure" && r.event === "pull_request_target"),
  );
  await reserveExceptionStage({ ...f, mode: "capture", run: f.current });
  const reservation = await f.store.read("prepare");
  assert.equal(reservation.reservedIndependentReviewOrdinal, 6);
  assert.equal(reservation.attemptHistory.nextPreparationAttemptTotal, 16);
  assert(f.historyQueries[0].includes(encodeURIComponent("2026-10-15T13:54:00.000Z")));
  assert.equal(
    (await f.fourthStore.read("review5")).commitSha,
    CROSSDECK_R5.predecessor.seals.find((s) => s.slot === "review5").commitSha,
  );
  assert.equal(await f.fourthStore.read("qualify"), null);
});
test("R5 rejects missing/changed successful seals, failed-run boundary, source, artifact or history before writes", async (t) => {
  const p = CROSSDECK_R5.predecessor;
  for (const mutate of [
    (f) => f.refs.delete(`refs/tags/${p.namespace}/review5`),
    (f) => (f.refs.get(`refs/tags/${p.namespace}/capture`).object.sha = p.seals[0].commitSha),
    (f) => f.runs.get(38822426167).run_attempt++,
    (f) => (f.runs.get(38822426167).event = "workflow_dispatch"),
    (f) => (f.runs.get(38820570426).conclusion = "failure"),
    (f) => f.runs.delete(38814444774),
    (f) => (f.jobs.jobs[0].steps.find((s) => s.number === 6).conclusion = "success"),
    (f) => (f.jobs.jobs.find((j) => j.name.includes("Focused verification")).conclusion = "success"),
    (f) => (f.commits.get(p.consumerSha).tree.sha = "0".repeat(40)),
    (f) => (f.artifacts.get(12012399990).digest = "changed"),
    (f) => f.refs.set(`refs/tags/${p.namespace}/qualify`, f.refs.get(`refs/tags/${p.namespace}/prepare`)),
  ]) {
    const f = await r5ApiFixture(t);
    mutate(f);
    await assert.rejects(() => reserveExceptionStage({ ...f, mode: "capture", run: f.current }), /R5_/u);
    assert.equal(
      f.operations.some((o) => o.method === "POST"),
      false,
    );
  }
});
test("R5 cannot omit the failed ordinary, accept another failure or borrow accepted review FIVE", async (t) => {
  const f = await r5ApiFixture(t);
  const withoutFailure = (endpoint, method, body) =>
    endpoint.includes("/runs?per_page=")
      ? { total_count: f.runs.size - 1, workflow_runs: [...f.runs.values()].filter((r) => r.id !== 38822426167) }
      : f.request(endpoint, method, body);
  await assert.rejects(
    () => requireFirstCampaignRun({ ...f, request: withoutFailure, mode: "capture", run: f.current }),
    /PREDECESSOR_HISTORY_MISSING/u,
  );
  const extra = { ...f.current, runId: f.current.runId - 1, createdAt: "2026-10-16T01:59:00Z" };
  f.runs.set(extra.runId, remoteRun(extra, "completed", "failure"));
  await assert.rejects(
    () => requireFirstCampaignRun({ ...f, mode: "capture", run: f.current }),
    /EARLIER_ATTEMPT_CONSUMED/u,
  );
  const evidence = {
    exception: f.plan.exception,
    reviews: f.plan.contractIds.map((contractId) => ({
      contractId,
      iterations: 11,
      independentReviewOrdinal: 6,
      reviewerContext: "independent",
      findings: [],
    })),
  };
  validateExceptionEvidence(f.plan, evidence);
  evidence.reviews[0].independentReviewOrdinal = 5;
  assert.throws(() => validateExceptionEvidence(f.plan, evidence), /HISTORY_OR_REVIEW_ORDINAL_CHANGED/u);
  await assert.rejects(
    () => requireSuccessfulReservation({ store: f.fourthStore, slot: "prepare", plan: f.plan, request: f.request }),
    /RESERVATION_BINDING_MISSING/u,
  );
});
async function r4ApiFixture(t) {
  const f = await r3ApiFixture(t),
    p = CROSSDECK_R4.predecessor;
  f.commits.set(p.baseSha, structuredClone(f.commits.get(f.plan.baseSha)));
  const thirdRun = {
    ...runIdentity({ baseSha: p.baseSha, candidateSha: p.candidateSha }, p.runId),
    createdAt: p.createdAt,
    workflowId: p.workflowId,
  };
  const thirdStore = exceptionStore({ record: r3Template, request: f.request });
  const stored = await thirdStore.create("prepare", {
    binding: {
      exception: recordBinding(r3Template),
      baseSha: p.baseSha,
      sourceDigest: p.sourceDigest,
      contractDigest: p.contractDigest,
    },
    run: thirdRun,
    candidateSha: p.candidateSha,
    independentReviewsCompleted: 3,
    reservedIndependentReviewOrdinal: 4,
  });
  f.commits.set(p.prepareCommit, structuredClone(f.commits.get(stored.commitSha)));
  f.refs.set(`refs/tags/${p.namespace}/prepare`, { object: { type: "commit", sha: p.prepareCommit } });
  f.commits.set(p.candidateSha, { tree: { sha: p.candidateTree } });
  f.runs.set(p.runId, remoteRun(thirdRun, "completed", "success"));
  for (const a of p.artifacts)
    f.artifacts.set(a.id, {
      id: a.id,
      digest: a.digest,
      size_in_bytes: a.size,
      workflow_run: { id: p.runId, head_sha: p.baseSha },
    });
  const c = CROSSDECK_R4.cancelledReview;
  const cancelled = {
    ...runIdentity({ baseSha: c.baseSha, candidateSha: c.candidateSha }, c.runId, "workflow_dispatch", "review"),
    createdAt: c.createdAt,
    workflowId: c.workflowId,
  };
  f.runs.set(c.runId, remoteRun(cancelled, "completed", "cancelled"));
  const jobs = {
    total_count: 1,
    jobs: [
      {
        id: c.jobId,
        conclusion: "cancelled",
        completed_at: c.completedAt,
        steps: [3, 4, 5, 6].map((number) => ({ number, conclusion: number === 3 ? "cancelled" : "skipped" })),
      },
    ],
  };
  const aggregate = readFileSync(
    path.join(
      repo,
      "Development_Docs/Programs/Sounding_Line/evidence/crossdeck-r4-recovery-20261015/review4-aggregate.original.raw.txt",
    ),
  );
  const request = async (endpoint, method, body) => {
    if (endpoint === `actions/runs/${c.runId}/jobs?per_page=100`) return jobs;
    if (endpoint === `actions/runs/${c.runId}/artifacts?per_page=100`) return { total_count: 0, artifacts: [] };
    if (endpoint === `git/commits/${CROSSDECK_R4.evidenceCommit}`) return { tree: { sha: "review4-tree" } };
    if (endpoint === "git/trees/review4-tree?recursive=1")
      return {
        truncated: false,
        tree: [{ path: CROSSDECK_R4.evidencePath, type: "blob", mode: "100644", sha: "review4-blob" }],
      };
    if (endpoint === "git/blobs/review4-blob") return { content: aggregate.toString("base64") };
    return f.request(endpoint, method, body);
  };
  const plan = { ...f.plan, exception: recordBinding(r4Template) };
  const current = { ...f.current, runId: 38810000000, createdAt: "2026-10-15T22:00:00Z" };
  f.runs.delete(f.current.runId);
  f.runs.set(current.runId, remoteRun(current));
  f.operations.length = 0;
  return {
    ...f,
    record: r4Template,
    plan,
    current,
    jobs,
    request,
    thirdStore,
    store: exceptionStore({ record: r4Template, request }),
    now: new Date(current.createdAt),
  };
}

test("R4 pins the exact expanded approval and cannot revive any older grant", () => {
  const records = [template, successorTemplate, r3Template, structuredClone(r4Template)];
  validateExceptionRecord(records[3], new Date("2026-10-15T22:00:00Z"));
  assert.deepEqual(selectTrustedExceptions(records), [records[3]]);
  assert.equal(hash(r3Template), CROSSDECK_R4.predecessorDigest);
  assert.equal(recordBinding(records[3]).independentReviewOrdinal, 5);
  assert.equal(recordBinding(records[3]).attemptHistory.nextPreparationAttemptTotal, 15);
  for (const mutate of [
    (r) => r.executionBudget.reruns++,
    (r) => r.executionBudget.productRepairs++,
    (r) => r.executionBudget.targetedLocalProofInvocations++,
    (r) => r.requiredTechnicalBrowserTests.pop(),
    (r) => r.immutableHistory.pop(),
    (r) => (r.ownerApproval.answer = "YES"),
    (r) => (r.frozenTrees.src = "0".repeat(40)),
    (r) => r.predecessor.runId++,
    (r) => r.attemptHistory.completedIndependentReviews--,
  ]) {
    const changed = structuredClone(r4Template);
    mutate(changed);
    assert.throws(() => validateExceptionRecord(changed), /R4_RECORD_CHANGED/u);
  }
  records[3].status = "RETIRED";
  assert.deepEqual(selectTrustedExceptions(records), []);
  assert.throws(() => selectTrustedExceptions(records.slice(1)), /PREDECESSOR_REGISTRY_CHANGED/u);
  assert.throws(() => validateExceptionRecord(r4Template, new Date(r4Template.expiresAt)), /EXPIRED/u);
});

test("R4 recognizes only the exact three preparations and exact cancelled review, never a new epoch", async (t) => {
  const f = await r4ApiFixture(t);
  const history = await validateSuccessorPredecessor(f);
  assert.deepEqual(
    history.map((r) => r.id),
    [
      CROSSDECK_R2.predecessor.runId,
      CROSSDECK_R3.predecessor.runId,
      CROSSDECK_R4.predecessor.runId,
      CROSSDECK_R4.cancelledReview.runId,
    ],
  );
  await reserveExceptionStage({ ...f, mode: "capture", run: f.current });
  const reserved = await f.store.read("prepare");
  assert.equal(reserved.reservedIndependentReviewOrdinal, 5);
  assert.equal(reserved.attemptHistory.nextPreparationAttemptTotal, 15);
  assert(f.historyQueries[0].includes(encodeURIComponent("2026-10-15T13:54:00.000Z")));
  assert.equal((await f.thirdStore.read("prepare")).commitSha, CROSSDECK_R4.predecessor.prepareCommit);
  assert.equal(await f.thirdStore.read("qualify"), null);
});

test("R4 predecessor, cancellation boundary and accepted review mutations stop before any custody write", async (t) => {
  for (const mutate of [
    (f) => f.runs.get(CROSSDECK_R4.cancelledReview.runId).run_attempt++,
    (f) => (f.runs.get(CROSSDECK_R4.cancelledReview.runId).conclusion = "failure"),
    (f) => (f.jobs.jobs[0].steps[3].conclusion = "success"),
    (f) => f.refs.delete(`refs/tags/${CROSSDECK_R4.predecessor.namespace}/prepare`),
    (f) => (f.artifacts.get(CROSSDECK_R4.predecessor.artifacts[0].id).digest = "changed"),
    (f) => (f.runs.get(CROSSDECK_R4.predecessor.runId).head_sha = "0".repeat(40)),
  ]) {
    const f = await r4ApiFixture(t);
    mutate(f);
    await assert.rejects(() => reserveExceptionStage({ ...f, mode: "capture", run: f.current }), /R4_|PREDECESSOR_/u);
    assert.equal(
      f.operations.some((o) => o.method === "POST"),
      false,
    );
  }
  const f = await r4ApiFixture(t);
  const request = (endpoint, method, body) =>
    endpoint === "git/blobs/review4-blob"
      ? { content: Buffer.from("changed").toString("base64") }
      : f.request(endpoint, method, body);
  await assert.rejects(() => validateSuccessorPredecessor({ ...f, request }), /R4_ACCEPTED_REVIEW_CHANGED/u);
});

test("R4 cannot hide a missing cancelled dispatch, another same-mode dispatch or ordinary failure", async (t) => {
  const f = await r4ApiFixture(t),
    c = CROSSDECK_R4.cancelledReview;
  f.runs.delete(c.runId);
  await assert.rejects(
    () => requireFirstCampaignRun({ ...f, mode: "capture", run: f.current }),
    /R4_CANCELLED_REVIEW_CHANGED/u,
  );
  const other = await r4ApiFixture(t);
  const extra = { ...other.current, runId: other.current.runId - 1, createdAt: "2026-10-15T21:59:00Z" };
  other.runs.set(extra.runId, remoteRun(extra, "completed", "cancelled"));
  await assert.rejects(
    () => requireFirstCampaignRun({ ...other, mode: "capture", run: other.current }),
    /EARLIER_ATTEMPT_CONSUMED/u,
  );
  await assert.rejects(
    () =>
      requireFirstCampaignRun({
        ...other,
        mode: "ordinary",
        run: { ...other.current, displayTitle: other.current.displayTitle.replace("capture", "ordinary") },
      }),
    /EARLIER_CAMPAIGN_FAILURE/u,
  );
});

test("R4 requires review FIVE and a fresh preparation binding; accepted review FOUR cannot be borrowed", async (t) => {
  const f = await r4ApiFixture(t);
  const evidence = {
    exception: f.plan.exception,
    reviews: f.plan.contractIds.map((contractId) => ({
      contractId,
      iterations: 11,
      independentReviewOrdinal: 5,
      reviewerContext: "separate-reviewer",
      findings: [],
    })),
  };
  validateExceptionEvidence(f.plan, evidence);
  evidence.reviews[0].independentReviewOrdinal = 4;
  assert.throws(() => validateExceptionEvidence(f.plan, evidence), /HISTORY_OR_REVIEW_ORDINAL_CHANGED/u);
  await assert.rejects(
    () => requireSuccessfulReservation({ store: f.thirdStore, slot: "prepare", plan: f.plan, request: f.request }),
    /RESERVATION_BINDING_MISSING/u,
  );
  await reserveExceptionStage({ ...f, mode: "capture", run: f.current });
  f.runs.set(f.current.runId, remoteRun(f.current, "completed", "success"));
  const run = {
    ...f.current,
    runId: f.current.runId + 1,
    createdAt: "2026-10-15T22:05:00Z",
    displayTitle: f.current.displayTitle.replace("capture", "review"),
  };
  f.runs.set(run.runId, remoteRun(run));
  await reserveExceptionStage({ ...f, mode: "review", run });
  assert.equal((await f.store.read("review-submit")).run.runId, run.runId);
  await assert.rejects(
    () => reserveExceptionStage({ ...f, mode: "review", run: { ...run, runId: run.runId + 1 } }),
    /REVIEW_SUBMISSION_ALREADY_CONSUMED/u,
  );
});

test("custody-only diagnostic has no finalization path and preserves ordinary protections", () => {
  const workflow = readFileSync(path.join(repo, ".github/workflows/sounding-line-ordinary.yml"), "utf8");
  const guard = workflow.slice(workflow.indexOf("  campaign-custody:"), workflow.indexOf("  experience-preparation:"));
  assert(guard.includes("timeout-minutes: 15"));
  assert.match(guard, /path: authority\s+fetch-depth: 1/u);
  assert.match(guard, /path: candidate\s+fetch-depth: 0/u);
  assert.equal(guard.includes("sparse-checkout"), false);
  assert.equal((guard.match(/persist-credentials: false/gu) ?? []).length, 3);
  const condition = "inputs.experience_mode == 'ordinary' && !inputs.experience_diagnostic";
  assert(workflow.slice(workflow.indexOf("  final-check:")).includes(condition));
  assert(workflow.slice(workflow.indexOf("  mainline-decision:")).includes(condition));
  assert(workflow.includes('test "$CUSTODY_RESULT" = success && test "$VERIFICATION_RESULT" = success'));
  const sha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" }).trim();
  const env = {
    GITHUB_SHA: sha,
    GITHUB_REF: "refs/heads/main",
    GITHUB_ACTIONS: "true",
    GITHUB_JOB: "campaign-custody",
    GITHUB_RUN_ATTEMPT: "1",
    GITHUB_ACTOR: "Kgray44",
    GITHUB_TRIGGERING_ACTOR: "Kgray44",
    SOUNDING_LINE_PR_NUMBER: "741",
  };
  assert.throws(
    () =>
      checkoutProbe({
        root: repo,
        baseSha: sha,
        candidateSha: sha,
        environment: { ...env, SOUNDING_LINE_PR_NUMBER: "721" },
      }),
    /CUSTODY_PROBE/u,
  );
  assert.throws(
    () => checkoutProbe({ root: repo, baseSha: sha, candidateSha: "0".repeat(40), environment: env }),
    /CUSTODY_PROBE/u,
  );
});

for (const record of [r4Template, r5Template, r6Template, r7Template, r8Template])
  test(`R${record.version} freezes accepted product, contracts, targeted tests and history while custody probe verifies real Git lineage`, async (t) => {
    const root = mkdtempSync(path.join(repo, "artifacts/r4-admission-"));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const git = (args, input) =>
      execFileSync("git", args, { cwd: root, input, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
    git(["init", "-q"]);
    git(["config", "user.name", "R4 Fixture"]);
    git(["config", "user.email", "fixture@example.invalid"]);
    const common = execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], {
      cwd: repo,
      encoding: "utf8",
    }).trim();
    writeFileSync(
      path.join(root, ".git/objects/info/alternates"),
      path.join(common, "objects").replaceAll("\\", "/") + "\n",
    );
    const put = (file, bytes) => {
      const blob = git(["hash-object", "-w", "--stdin"], bytes);
      git(["update-index", "--add", "--cacheinfo", `100644,${blob},${file}`]);
    };
    const commit = (parent) => git(["commit-tree", git(["write-tree"]), "-p", parent, "-m", "R4 fixture"]);
    const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" }).trim();
    git(["read-tree", head]);
    if (record.version >= 7) {
      put(".prettierignore", execFileSync("git", ["show", record.frozenBlobs[".prettierignore"]], { cwd: repo }));
      put(".prettierrc.json", readFileSync(path.join(repo, ".prettierrc.json")));
    }
    put(
      "testing/product-experience-exceptions.json",
      JSON.stringify({
        version: 1,
        exceptions: [
          template,
          successorTemplate,
          r3Template,
          r4Template,
          ...(record.version >= 5 ? [r5Template] : []),
          ...(record.version >= 6 ? [r6Template] : []),
          ...(record.version >= 7 ? [r7Template] : []),
          ...(record.version >= 8 ? [r8Template] : []),
        ],
      }),
    );
    const baseSha = commit(head);
    git(["update-ref", "refs/heads/master", baseSha]);
    git(["symbolic-ref", "HEAD", "refs/heads/master"]);
    const env = {
      GITHUB_SHA: baseSha,
      GITHUB_REF: "refs/heads/main",
      GITHUB_ACTIONS: "true",
      GITHUB_JOB: "campaign-custody",
      GITHUB_RUN_ATTEMPT: "1",
      GITHUB_ACTOR: "Kgray44",
      GITHUB_TRIGGERING_ACTOR: "Kgray44",
      SOUNDING_LINE_PR_NUMBER: "741",
    };
    const probe = checkoutProbe({ root, baseSha, candidateSha: baseSha, environment: env });
    assert.equal(probe.status, "PASS");
    assert.equal(probe.mainlineDecision, "NONE");
    assert.equal(probe.consumerReservations, 0);
    assert.throws(
      () =>
        checkoutProbe({
          root,
          baseSha,
          candidateSha: baseSha,
          environment: { ...env, SOUNDING_LINE_PR_NUMBER: "721" },
        }),
      /CUSTODY_PROBE/u,
    );
    const overlay = git(["ls-tree", "-r", record.frozenReferenceSha, "--", "src", "public", "prisma"]);
    git(["update-index", "--index-info"], overlay + "\n");
    for (const e of record.protectedBaseRuntimeOverrides)
      git(["update-index", "--add", "--cacheinfo", `${e.mode},${e.blob},${e.path}`]);
    git(
      ["update-index", "--index-info"],
      record.immutableHistory.map((e) => `100644 blob ${e.blob}\t${e.path}\n`).join(""),
    );
    const candidateSha = commit(baseSha);
    const plan = {
      applicable: true,
      contractIds: record.contractIds,
      contractDigest: record.contractDigest,
      ...(record.version >= 6 ? { paired: record.pairedEvidence, contextCount: 38 } : {}),
      contracts: JSON.parse(
        git(["show", `${record.consumerSource?.commit ?? record.frozenReferenceSha}:testing/contracts.json`]),
      ).contracts.filter((c) => record.contractIds.includes(c.id)),
    };
    const bind = (candidate) =>
      bindExperienceException({
        root,
        baseSha,
        candidateSha: candidate,
        plan,
        prNumber: 721,
        now: new Date("2026-10-16T02:00:00Z"),
      });
    assert.equal(bind(candidateSha).independentReviewOrdinal, record.remainingIndependentReviewOrdinal);
    if (record.version === 7) {
      const configs = [
        "package.yaml",
        ".prettierrc",
        ".prettierrc.json",
        ".prettierrc.yaml",
        ".prettierrc.yml",
        ".prettierrc.json5",
        ".prettierrc.js",
        ".prettierrc.ts",
        ".prettierrc.mjs",
        ".prettierrc.mts",
        ".prettierrc.cjs",
        ".prettierrc.cts",
        ".prettierrc.toml",
        "prettier.config.js",
        "prettier.config.ts",
        "prettier.config.mjs",
        "prettier.config.mts",
        "prettier.config.cjs",
        "prettier.config.cts",
        "package.json",
        ".editorconfig",
        ".PRETTIERRC",
        ".EDITORCONFIG",
      ];
      for (const name of configs) {
        git(["read-tree", candidateSha]);
        put(`Development_Docs/Testing/Product_Experience/${name}`, "{}");
        assert.throws(() => bind(commit(baseSha)), /FORMATTING_INPUT_CHANGED|RUNTIME_BINDING_CHANGED/u, name);
      }
      for (const file of [".gitignore", ".prettierignore", ".prettierrc.json"]) {
        git(["read-tree", candidateSha]);
        put(file, "**/*\n");
        assert.throws(() => bind(commit(baseSha)), /FORMATTING_INPUT_CHANGED|FROZEN_CONFIGURATION_CHANGED/u, file);
        git(["read-tree", candidateSha]);
        git(["update-index", "--force-remove", file]);
        assert.throws(
          () => bind(commit(baseSha)),
          /FORMATTING_INPUT_CHANGED|FROZEN_CONFIGURATION_CHANGED|Command failed/u,
          file,
        );
      }
      for (const mode of ["100755", "120000", "160000"]) {
        git(["read-tree", candidateSha]);
        const blob = mode === "160000" ? candidateSha : record.frozenBlobs[".prettierignore"];
        git(["update-index", "--add", "--cacheinfo", `${mode},${blob},.prettierignore`]);
        assert.throws(() => bind(commit(baseSha)), /FORMATTING_INPUT_CHANGED|FROZEN_CONFIGURATION_CHANGED/u, mode);
      }
    }
    if (record.version >= 6) {
      const api = await (record.version === 8 ? r8ApiFixture : record.version === 7 ? r7ApiFixture : r6ApiFixture)(t);
      const guardedPlan = { ...plan, baseSha, candidateSha, exception: recordBinding(record) };
      const current = {
        ...api.current,
        candidateSha,
        displayTitle: `Sounding Line finite 1 capture 721 ${candidateSha} active`,
      };
      api.runs.set(current.runId, remoteRun(current));
      await assert.rejects(
        () => reserveExceptionStage({ ...api, root, plan: guardedPlan, mode: "capture", run: current }),
        /ARTIFACT_NOT_TRACKED_REGULAR_FILE/u,
      );
      assert(api.operations.every((o) => o.method === "GET"));
      assert.equal(await api.store.read("prepare"), null);
    }
    for (const file of [
      CROSSDECK_R3.productPaths[0],
      "tests/e2e/crossdeck-experience-refit.spec.ts",
      "testing/contracts.json",
      record.immutableHistory.at(-1).path,
    ]) {
      git(["read-tree", candidateSha]);
      put(file, "unauthorized change");
      assert.throws(() => bind(commit(baseSha)), /FROZEN_|RUNTIME_|HISTORY_/u);
    }
  });

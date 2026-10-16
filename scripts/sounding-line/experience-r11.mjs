// Finite ordinary5 successor; original R8 evidence and all consumed failures stay read-only.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, lstatSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { productSourceDigest, sourceSnapshot } from "./product-experience.mjs";
import { pairedPublicationPathAllowed } from "./experience-paired.mjs";
import { R8_FORMAT, validateR8RawOriginals } from "./experience-r8-format.mjs";
import { validateR9HistoricalCustody, validateR9FinalDecision, validateR9FailureOriginals } from "./experience-r9.mjs";
import { validateR10Registry, validateR10FailureOriginals } from "./experience-r10.mjs";

export const CROSSDECK_R11 = Object.freeze({
  id: "PE-X-CROSSDECK-FINAL-VERIFY-20261015-R11",
  recordDigest: "6304b4a65189531815b18fd8cb1e2afa12cdb2602a2b972d807a07d58d225b12",
  frozenReferenceSha: "0f71639b0a13be839357f6e7d8d4331fe15fb7a6",
  requiredDiagnosticRepairCandidateSha: "2cf9c1dd10378e6bba08978a9cc4f97543c09979",
  oldRegistryDigest: "f5faad091801cb059a25ee8b68e3de635e423c1e9a67741bf23f519d5d81346e",
  historicalExceptionDigest: "4d2f73505425dc68b4a14b9e6b030e46a15cc0cc60b53acd4e74c3b382b86c82",
  bridgeId: "PE-R11-ORDINARY-ONLY-BRIDGE-20261016",
  predecessor: {
    runId: 38968131415,
    qualifyCommit: "e414624dd6b3901b360729ae024cd181fd42396f",
    qualifyPayloadDigest: "147f76e9447c1812a2998caa4d1a4a9186af60baabf5964571640b78ce8ade48",
  },
});
export const R11_REGENERATED = [
  "Development_Docs/document-index.json",
  "Development_Docs/Programs/Other/Ledgerlight/Project_Ledgerlight_Documentation_Migration_Matrix.csv",
];
export const R11_MERGED = [".agents/README.md", "Development_Docs/Testing/Product_Experience/README.md"];
export const R11_OVERLAY_PATHS = [
  ".agents/README.md",
  ".agents/crossdeck-r10-ordinary-only.md",
  ".agents/crossdeck-r11-ordinary-only.md",
  ".agents/crossdeck-r8-historical-format.md",
  ".agents/crossdeck-r9-ordinary-only.md",
  ".agents/git-output-buffer-repair.md",
  ".agents/ordinary-test-context-repair.md",
  ".agents/replay-failure-diagnostics.md",
  ".github/workflows/sounding-line-ordinary.yml",
  ".prettierignore",
  "Development_Docs/INDEX.md",
  "Development_Docs/Engineering/Crossdeck_R8_Historical_Format_Reconciliation.md",
  "Development_Docs/Engineering/Experience_Changed_Path_Buffer_Repair.md",
  "Development_Docs/Programs/Other/Ledgerlight/Project_Ledgerlight_Documentation_Migration_Matrix.csv",
  "Development_Docs/Programs/Sounding_Line/Project_Sounding_Line_Crossdeck_R10_Ordinary_Only_20261016.md",
  "Development_Docs/Programs/Sounding_Line/Project_Sounding_Line_Crossdeck_R11_Ordinary_Only_20261016.md",
  "Development_Docs/Programs/Sounding_Line/Project_Sounding_Line_Crossdeck_R9_Ordinary_Only_20261016.md",
  "Development_Docs/Programs/Sounding_Line/Project_Sounding_Line_Neutral_Test_Context_Repair_20261016.md",
  "Development_Docs/Programs/Sounding_Line/Project_Sounding_Line_Replay_Failure_Diagnostics_20261016.md",
  "Development_Docs/Programs/Sounding_Line/evidence/crossdeck-r10-ordinary-only-20261016/r9-consumed-frozen-publication.derived.json",
  "Development_Docs/Programs/Sounding_Line/evidence/crossdeck-r11-ordinary-only-20261016/r10-consumed-frozen-publication.derived.json",
  "Development_Docs/Programs/Sounding_Line/evidence/crossdeck-r9-ordinary-only-20261016/r8-custody-read-only.original.raw.txt",
  "Development_Docs/Testing/Product_Experience/README.md",
  "Development_Docs/document-index.json",
  "scripts/sounding-line/experience-attestation.mjs",
  "scripts/sounding-line/experience-browser.mjs",
  "scripts/sounding-line/experience-checkout-probe.mjs",
  "scripts/sounding-line/experience-exception.mjs",
  "scripts/sounding-line/experience-paired.mjs",
  "scripts/sounding-line/experience-prepare.mjs",
  "scripts/sounding-line/experience-r10.mjs",
  "scripts/sounding-line/experience-r11.mjs",
  "scripts/sounding-line/experience-r8-format.mjs",
  "scripts/sounding-line/experience-r9.mjs",
  "scripts/sounding-line/ordinary.mjs",
  "scripts/sounding-line/product-experience.mjs",
  "scripts/sounding-line/verification-diagnostics.mjs",
  "tests/sounding-line/browser-diagnostics.test.mjs",
  "tests/sounding-line/experience-browser-fixtures.test.mjs",
  "tests/sounding-line/experience-exception.test.mjs",
  "tests/sounding-line/experience-r10.test.mjs",
  "tests/sounding-line/experience-r11.test.mjs",
  "tests/sounding-line/experience-r9.test.mjs",
  "tests/sounding-line/fixtures/r8-format-originals.json",
  "tests/sounding-line/ordinary-consumer-policy.test.mjs",
  "tests/sounding-line/ordinary.test.mjs",
  "tests/sounding-line/product-experience.test.mjs",
].sort();
const registryPath = "testing/product-experience-exceptions.json";
const hash = (value) =>
  createHash("sha256")
    .update(JSON.stringify(value ?? null))
    .digest("hex");
const bytesHash = (value) => createHash("sha256").update(value).digest("hex");
const fail = (code) => {
  throw new Error(`PRODUCT_EXPERIENCE_EXCEPTION_R11_${code}`);
};
const git = (root, args, binary = false) =>
  execFileSync("git", args, {
    cwd: root,
    encoding: binary ? null : "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "ignore"],
  });
const json = (root, revision, file) => JSON.parse(git(root, ["show", `${revision}:${file}`]));
const inventory = (root, revision) =>
  new Map(
    git(root, ["ls-tree", "-rz", revision])
      .split("\0")
      .filter(Boolean)
      .map((line) => {
        const [metadata, file] = line.split("\t");
        return [file, metadata];
      }),
  );
const runtime = (file) =>
  /^(?:src|app|components|lib|styles|public|prisma|scripts|tests|testing|\.github)\//u.test(file) ||
  /^(?:package(?:-lock)?\.json|.*\.config\.[^/]+|tsconfig\.json|\.nvmrc|\.prettierignore|\.gitignore|\.gitattributes)$/u.test(
    file,
  );

export function validateR11Record(record) {
  if (
    !["ACTIVE", "RETIRED"].includes(record?.status) ||
    hash({ ...record, status: "ACTIVE" }) !== CROSSDECK_R11.recordDigest
  )
    fail("RECORD_CHANGED");
}
export function assertR11Mode(plan, mode) {
  if (plan.exception?.id === CROSSDECK_R11.id && !["ordinary", "qualify"].includes(mode)) fail("MODE_FORBIDDEN");
}
export function validateR11Bridge(record) {
  if (
    hash(Object.keys(record ?? {}).sort()) !==
      hash(["version", "id", "status", "exceptionId", "recordDigest", "overlay"].sort()) ||
    record.version !== 1 ||
    record.id !== CROSSDECK_R11.bridgeId ||
    record.status !== "ACTIVE" ||
    record.exceptionId !== CROSSDECK_R11.id ||
    record.recordDigest !== CROSSDECK_R11.recordDigest ||
    hash(record.overlay?.map((entry) => entry.path).sort()) !== hash(R11_OVERLAY_PATHS) ||
    new Set(record.overlay?.map((entry) => entry.path)).size !== R11_OVERLAY_PATHS.length ||
    record.overlay.some(
      (entry) =>
        entry.newMode !== "100644" ||
        !/^[a-f0-9]{40}$/u.test(entry.newBlob ?? "") ||
        !(
          (entry.oldMode === null && entry.oldBlob === null) ||
          (entry.oldMode === "100644" && /^[a-f0-9]{40}$/u.test(entry.oldBlob ?? ""))
        ),
    )
  )
    fail("BRIDGE_CHANGED");
}
export function validateR11Registry(registry) {
  const records = registry.exceptions?.filter((record) => record.id === CROSSDECK_R11.id);
  if (records?.length !== 1 || registry.exceptions.length !== 11 || registry.reconciliations?.length !== 4)
    fail("REGISTRY_CHANGED");
  validateR11Record(records[0]);
  const old = {
    ...registry,
    exceptions: registry.exceptions.filter((record) => record.id !== CROSSDECK_R11.id),
    reconciliations: registry.reconciliations.slice(0, 3),
  };
  if (hash(old) !== CROSSDECK_R11.oldRegistryDigest) fail("PREDECESSOR_REGISTRY_CHANGED");
  validateR10Registry(old);
  validateR11Bridge(registry.reconciliations[3]);
  return records[0];
}
function historicalBinding(record) {
  return {
    id: record.id,
    recordDigest: hash(record),
    frozenReferenceSha: record.frozenReferenceSha,
    priorRepairRecaptureAttempts: 11,
    independentReviewOrdinal: record.remainingIndependentReviewOrdinal,
    version: record.version,
    predecessor: record.predecessor,
    attemptHistory: record.attemptHistory,
  };
}
export function pendingR11Reconciliation({ root, baseSha, plan, record }) {
  if (record.id !== CROSSDECK_R11.id) return null;
  const registry = json(root, baseSha, registryPath);
  validateR11Registry(registry);
  if (hash(registry.exceptions.at(-1)) !== hash(record)) fail("RECORD_CHANGED");
  const bridge = registry.reconciliations[3];
  const historicalException = historicalBinding(
    registry.exceptions.find((value) => value.id === R8_FORMAT_EXCEPTION_ID),
  );
  if (hash(historicalException) !== CROSSDECK_R11.historicalExceptionDigest) fail("HISTORICAL_EXCEPTION_CHANGED");
  return {
    version: 1,
    id: CROSSDECK_R11.bridgeId,
    recordDigest: hash(bridge),
    originalBaseSha: R8_FORMAT.baseSha,
    originalSourceDigest: R8_FORMAT.sourceDigest,
    originalPublicationCandidateSha: R8_FORMAT.publicationCandidateSha,
    currentBaseSha: baseSha,
    currentSourceDigest: plan.sourceDigest,
    overlay: bridge.overlay,
    historicalException,
  };
}
const R8_FORMAT_EXCEPTION_ID = "PE-X-CROSSDECK-FINAL-VERIFY-20261015-R8";
export function r11HistoricalEvidencePlan(plan) {
  if (plan.exception?.id !== CROSSDECK_R11.id) return plan;
  const binding = plan.exception.nonExecutingReconciliation;
  if (
    !binding ||
    plan.exception.recordDigest !== CROSSDECK_R11.recordDigest ||
    binding.version !== 1 ||
    binding.id !== CROSSDECK_R11.bridgeId ||
    binding.currentBaseSha !== plan.baseSha ||
    binding.currentSourceDigest !== plan.sourceDigest ||
    binding.originalBaseSha !== R8_FORMAT.baseSha ||
    binding.originalSourceDigest !== R8_FORMAT.sourceDigest ||
    binding.originalPublicationCandidateSha !== R8_FORMAT.publicationCandidateSha ||
    hash(binding.historicalException) !== CROSSDECK_R11.historicalExceptionDigest ||
    plan.contractDigest !== R8_FORMAT.contractDigest
  )
    fail("BINDING_CHANGED");
  const bridge = {
    version: 1,
    id: CROSSDECK_R11.bridgeId,
    status: "ACTIVE",
    exceptionId: CROSSDECK_R11.id,
    recordDigest: CROSSDECK_R11.recordDigest,
    overlay: binding.overlay,
  };
  validateR11Bridge(bridge);
  if (hash(bridge) !== binding.recordDigest) fail("BINDING_CHANGED");
  return {
    ...plan,
    baseSha: R8_FORMAT.baseSha,
    sourceDigest: R8_FORMAT.sourceDigest,
    candidateSha: R8_FORMAT.publicationCandidateSha,
    exception: binding.historicalException,
  };
}
export function validateR11Overlay({ bridge, originalBase, acceptedBase, originalSource, candidate }) {
  validateR11Bridge(bridge);
  const allowed = new Map(bridge.overlay.map((entry) => [entry.path, entry]));
  const metadata = (mode, blob) => (mode === null ? undefined : `${mode} blob ${blob}`);
  for (const [file, entry] of allowed)
    if (
      originalBase.get(file) !== metadata(entry.oldMode, entry.oldBlob) ||
      acceptedBase.get(file) !== metadata(entry.newMode, entry.newBlob) ||
      ([...R11_REGENERATED, ...R11_MERGED].includes(file)
        ? !/^100644 blob [a-f0-9]{40}$/u.test(candidate.get(file) ?? "")
        : candidate.get(file) !== acceptedBase.get(file))
    )
      fail("OVERLAY_CHANGED");
  for (const file of new Set([...originalBase.keys(), ...acceptedBase.keys()]))
    if (file !== registryPath && !allowed.has(file) && originalBase.get(file) !== acceptedBase.get(file))
      fail("BASE_SCOPE_CHANGED");
  for (const file of new Set([...originalSource.keys(), ...candidate.keys()]))
    if (
      runtime(file) &&
      file !== registryPath &&
      !allowed.has(file) &&
      originalSource.get(file) !== candidate.get(file)
    )
      fail("REVIEWED_SOURCE_CHANGED");
  if (candidate.get(registryPath) !== acceptedBase.get(registryPath)) fail("REGISTRY_CHANGED");
}
function validateMergedMetadata({ root, baseSha, candidateSha }) {
  for (const file of R11_MERGED) {
    const directory = mkdtempSync(path.join(tmpdir(), "r11-readme-"));
    try {
      const files = ["current", "base", "other"].map((name) => path.join(directory, name));
      for (const [index, revision] of [
        baseSha,
        "b7935ad2f68a278ef49f0618ec3b72263b0fb8b9",
        CROSSDECK_R11.frozenReferenceSha,
      ].entries())
        writeFileSync(files[index], git(root, ["show", `${revision}:${file}`], true));
      const merged = execFileSync("git", ["merge-file", "--stdout", ...files], {
        cwd: root,
        maxBuffer: 64 * 1024 * 1024,
        timeout: 5000,
        stdio: ["ignore", "pipe", "ignore"],
      });
      const blob = createHash("sha1").update(`blob ${merged.length}\0`).update(merged).digest("hex");
      if (git(root, ["rev-parse", `${candidateSha}:${file}`]).trim() !== blob) fail("MERGED_METADATA_CHANGED");
    } finally {
      if (!directory.startsWith(path.resolve(tmpdir()) + path.sep)) fail("TEMP_PATH_INVALID");
      rmSync(directory, { recursive: true, force: true });
    }
  }
}
export function validateR11FailureOriginals({ root, candidateSha, record }) {
  const index = json(root, candidateSha, record.predecessor.failureIndexPath);
  if (
    bytesHash(git(root, ["show", `${candidateSha}:${record.predecessor.failureIndexPath}`], true)) !==
      record.predecessor.failureIndexSha256 ||
    index.entries?.length !== 7
  )
    fail("FAILURE_INDEX_CHANGED");
  const entries = inventory(root, candidateSha);
  for (const entry of index.entries) {
    const file = path.join(root, entry.path);
    if (
      entries.get(entry.path) !== `100644 blob ${entry.gitBlob}` ||
      !lstatSync(file).isFile() ||
      lstatSync(file).isSymbolicLink()
    )
      fail("FAILURE_ORIGINAL_CHANGED");
    for (const bytes of [git(root, ["show", `${candidateSha}:${entry.path}`], true), readFileSync(file)])
      if (bytes.length !== entry.bytes || bytesHash(bytes) !== entry.sha256) fail("FAILURE_ORIGINAL_CHANGED");
  }
}
export function bindR11Reconciliation({ root, baseSha, candidateSha, plan, record }) {
  if (record.id !== CROSSDECK_R11.id) return null;
  const binding = pendingR11Reconciliation({ root, baseSha, plan, record });
  const registry = json(root, baseSha, registryPath);
  const bridge = registry.reconciliations[3];
  for (const [ancestor, descendant] of [
    [CROSSDECK_R11.requiredDiagnosticRepairCandidateSha, baseSha],
    [CROSSDECK_R11.frozenReferenceSha, candidateSha],
    [record.predecessor.candidateSha, candidateSha],
    [R8_FORMAT.publicationCandidateSha, candidateSha],
  ])
    git(root, ["merge-base", "--is-ancestor", ancestor, descendant]);
  const changes = git(root, ["diff", "--name-only", "--no-renames", CROSSDECK_R11.frozenReferenceSha, candidateSha])
    .trim()
    .split(/\r?\n/u)
    .filter(Boolean);
  if (
    changes.some(
      (file) => file !== registryPath && !R11_OVERLAY_PATHS.includes(file) && !pairedPublicationPathAllowed(file),
    )
  )
    fail("PUBLICATION_SCOPE_CHANGED");
  validateR11Overlay({
    bridge,
    originalBase: inventory(root, R8_FORMAT.baseSha),
    acceptedBase: inventory(root, baseSha),
    originalSource: inventory(root, CROSSDECK_R11.frozenReferenceSha),
    candidate: inventory(root, candidateSha),
  });
  validateMergedMetadata({ root, baseSha, candidateSha });
  const original = sourceSnapshot(root, R8_FORMAT.publicationCandidateSha),
    actual = sourceSnapshot(root, candidateSha);
  const normalized = new Map(actual.entries.map((entry) => [entry.path, entry]));
  const originals = new Map(original.entries.map((entry) => [entry.path, entry]));
  const contents = new Map(actual.contents);
  for (const entry of bridge.overlay) {
    if (!runtime(entry.path)) continue;
    if (originals.has(entry.path)) normalized.set(entry.path, originals.get(entry.path));
    else normalized.delete(entry.path);
    if (original.contents.has(entry.path)) contents.set(entry.path, original.contents.get(entry.path));
    else contents.delete(entry.path);
  }
  if (
    productSourceDigest(original) !== R8_FORMAT.sourceDigest ||
    productSourceDigest(actual) !== plan.sourceDigest ||
    productSourceDigest({ entries: [...normalized.values()], contents }) !== R8_FORMAT.sourceDigest
  )
    fail("REVIEWED_SOURCE_CHANGED");
  if (git(root, ["rev-parse", `${baseSha}:.prettierignore`]).trim() !== "d21c485a0c9996cafbd53dde2ab76d0abaa779b4")
    fail("FORMAT_INPUT_CHANGED");
  validateR8RawOriginals({ root, baseSha, candidateSha });
  validateR9FailureOriginals({
    root,
    candidateSha,
    record: registry.exceptions.find((value) => value.id === "PE-X-CROSSDECK-FINAL-VERIFY-20261015-R9"),
  });
  validateR10FailureOriginals({
    root,
    candidateSha,
    record: registry.exceptions.find((value) => value.id === "PE-X-CROSSDECK-FINAL-VERIFY-20261015-R10"),
  });
  validateR11FailureOriginals({ root, candidateSha, record });
  return binding;
}

// Reuse canonical historical custody and finalizer consistency checks after the
// exact R11 binding validates; neither helper executes consumer commands.
export async function validateR11HistoricalCustody({ plan, ...options }) {
  if (plan) r11HistoricalEvidencePlan(plan);
  return validateR9HistoricalCustody(options);
}
export function validateR11FinalDecision(options) {
  r11HistoricalEvidencePlan(options.plan);
  return validateR9FinalDecision(options);
}

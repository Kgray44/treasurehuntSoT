// Finite ordinary4 successor; original R8 evidence and all consumed failures stay read-only.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, lstatSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { productSourceDigest, sourceSnapshot } from "./product-experience.mjs";
import { pairedPublicationPathAllowed } from "./experience-paired.mjs";
import { R8_FORMAT, validateR8RawOriginals } from "./experience-r8-format.mjs";
import {
  validateR9Registry,
  validateR9HistoricalCustody,
  validateR9FinalDecision,
  validateR9FailureOriginals,
} from "./experience-r9.mjs";

export const CROSSDECK_R10 = Object.freeze({
  id: "PE-X-CROSSDECK-FINAL-VERIFY-20261015-R10",
  recordDigest: "5c5bd94f499b0eef58d30bef254e7ea8a5a4933d6b6c294b70884510494b28d0",
  frozenReferenceSha: "856c1288123e33ad655b876294888f46841edb07",
  requiredNeutralRepairCandidateSha: "fc4a58e64830eb701a8302e757deda752c2d7b55",
  oldRegistryDigest: "215c7e7eee4bae3337a90e67dfb578475093ab18d6000e29ffe37e9156066b8c",
  historicalExceptionDigest: "4d2f73505425dc68b4a14b9e6b030e46a15cc0cc60b53acd4e74c3b382b86c82",
  bridgeId: "PE-R10-ORDINARY-ONLY-BRIDGE-20261016",
  predecessor: {
    runId: 38948434772,
    qualifyCommit: "e24188d5654921f7ffc91c69d6d8be12d7d40ece",
    qualifyPayloadDigest: "22da785317e514446297ada68a7fca0ad83c1c1198dc8da55ca69f1f3bd9e306",
  },
});
export const R10_REGENERATED = [
  "Development_Docs/document-index.json",
  "Development_Docs/Programs/Other/Ledgerlight/Project_Ledgerlight_Documentation_Migration_Matrix.csv",
];
export const R10_MERGED = [".agents/README.md", "Development_Docs/Testing/Product_Experience/README.md"];
export const R10_OVERLAY_PATHS = [
  ".agents/README.md",
  ".agents/crossdeck-r10-ordinary-only.md",
  ".agents/crossdeck-r8-historical-format.md",
  ".agents/crossdeck-r9-ordinary-only.md",
  ".agents/git-output-buffer-repair.md",
  ".agents/ordinary-test-context-repair.md",
  ".github/workflows/sounding-line-ordinary.yml",
  ".prettierignore",
  "Development_Docs/Engineering/Crossdeck_R8_Historical_Format_Reconciliation.md",
  "Development_Docs/Engineering/Experience_Changed_Path_Buffer_Repair.md",
  "Development_Docs/Programs/Other/Ledgerlight/Project_Ledgerlight_Documentation_Migration_Matrix.csv",
  "Development_Docs/Programs/Sounding_Line/Project_Sounding_Line_Crossdeck_R10_Ordinary_Only_20261016.md",
  "Development_Docs/Programs/Sounding_Line/Project_Sounding_Line_Crossdeck_R9_Ordinary_Only_20261016.md",
  "Development_Docs/Programs/Sounding_Line/Project_Sounding_Line_Neutral_Test_Context_Repair_20261016.md",
  "Development_Docs/Programs/Sounding_Line/evidence/crossdeck-r10-ordinary-only-20261016/r9-consumed-frozen-publication.derived.json",
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
  "scripts/sounding-line/experience-r8-format.mjs",
  "scripts/sounding-line/experience-r9.mjs",
  "scripts/sounding-line/ordinary.mjs",
  "scripts/sounding-line/product-experience.mjs",
  "tests/sounding-line/browser-diagnostics.test.mjs",
  "tests/sounding-line/experience-browser-fixtures.test.mjs",
  "tests/sounding-line/experience-exception.test.mjs",
  "tests/sounding-line/experience-r10.test.mjs",
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
  throw new Error(`PRODUCT_EXPERIENCE_EXCEPTION_R10_${code}`);
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

export function validateR10Record(record) {
  if (
    !["ACTIVE", "RETIRED"].includes(record?.status) ||
    hash({ ...record, status: "ACTIVE" }) !== CROSSDECK_R10.recordDigest
  )
    fail("RECORD_CHANGED");
}
export function assertR10Mode(plan, mode) {
  if (plan.exception?.id === CROSSDECK_R10.id && !["ordinary", "qualify"].includes(mode)) fail("MODE_FORBIDDEN");
}
export function validateR10Bridge(record) {
  if (
    hash(Object.keys(record ?? {}).sort()) !==
      hash(["version", "id", "status", "exceptionId", "recordDigest", "overlay"].sort()) ||
    record.version !== 1 ||
    record.id !== CROSSDECK_R10.bridgeId ||
    record.status !== "ACTIVE" ||
    record.exceptionId !== CROSSDECK_R10.id ||
    record.recordDigest !== CROSSDECK_R10.recordDigest ||
    hash(record.overlay?.map((entry) => entry.path).sort()) !== hash(R10_OVERLAY_PATHS) ||
    new Set(record.overlay?.map((entry) => entry.path)).size !== R10_OVERLAY_PATHS.length ||
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
export function validateR10Registry(registry) {
  const records = registry.exceptions?.filter((record) => record.id === CROSSDECK_R10.id);
  if (records?.length !== 1 || registry.exceptions.length !== 10 || registry.reconciliations?.length !== 3)
    fail("REGISTRY_CHANGED");
  validateR10Record(records[0]);
  const old = {
    ...registry,
    exceptions: registry.exceptions.filter((record) => record.id !== CROSSDECK_R10.id),
    reconciliations: registry.reconciliations.slice(0, 2),
  };
  if (hash(old) !== CROSSDECK_R10.oldRegistryDigest) fail("PREDECESSOR_REGISTRY_CHANGED");
  validateR9Registry(old);
  validateR10Bridge(registry.reconciliations[2]);
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
export function pendingR10Reconciliation({ root, baseSha, plan, record }) {
  if (record.id !== CROSSDECK_R10.id) return null;
  const registry = json(root, baseSha, registryPath);
  validateR10Registry(registry);
  if (hash(registry.exceptions.at(-1)) !== hash(record)) fail("RECORD_CHANGED");
  const bridge = registry.reconciliations[2];
  const historicalException = historicalBinding(
    registry.exceptions.find((value) => value.id === R8_FORMAT_EXCEPTION_ID),
  );
  if (hash(historicalException) !== CROSSDECK_R10.historicalExceptionDigest) fail("HISTORICAL_EXCEPTION_CHANGED");
  return {
    version: 1,
    id: CROSSDECK_R10.bridgeId,
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
export function r10HistoricalEvidencePlan(plan) {
  if (plan.exception?.id !== CROSSDECK_R10.id) return plan;
  const binding = plan.exception.nonExecutingReconciliation;
  if (
    !binding ||
    plan.exception.recordDigest !== CROSSDECK_R10.recordDigest ||
    binding.version !== 1 ||
    binding.id !== CROSSDECK_R10.bridgeId ||
    binding.currentBaseSha !== plan.baseSha ||
    binding.currentSourceDigest !== plan.sourceDigest ||
    binding.originalBaseSha !== R8_FORMAT.baseSha ||
    binding.originalSourceDigest !== R8_FORMAT.sourceDigest ||
    binding.originalPublicationCandidateSha !== R8_FORMAT.publicationCandidateSha ||
    hash(binding.historicalException) !== CROSSDECK_R10.historicalExceptionDigest ||
    plan.contractDigest !== R8_FORMAT.contractDigest
  )
    fail("BINDING_CHANGED");
  const bridge = {
    version: 1,
    id: CROSSDECK_R10.bridgeId,
    status: "ACTIVE",
    exceptionId: CROSSDECK_R10.id,
    recordDigest: CROSSDECK_R10.recordDigest,
    overlay: binding.overlay,
  };
  validateR10Bridge(bridge);
  if (hash(bridge) !== binding.recordDigest) fail("BINDING_CHANGED");
  return {
    ...plan,
    baseSha: R8_FORMAT.baseSha,
    sourceDigest: R8_FORMAT.sourceDigest,
    candidateSha: R8_FORMAT.publicationCandidateSha,
    exception: binding.historicalException,
  };
}
export function validateR10Overlay({ bridge, originalBase, acceptedBase, originalSource, candidate }) {
  validateR10Bridge(bridge);
  const allowed = new Map(bridge.overlay.map((entry) => [entry.path, entry]));
  const metadata = (mode, blob) => (mode === null ? undefined : `${mode} blob ${blob}`);
  for (const [file, entry] of allowed)
    if (
      originalBase.get(file) !== metadata(entry.oldMode, entry.oldBlob) ||
      acceptedBase.get(file) !== metadata(entry.newMode, entry.newBlob) ||
      ([...R10_REGENERATED, ...R10_MERGED].includes(file)
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
  for (const file of R10_MERGED) {
    const directory = mkdtempSync(path.join(tmpdir(), "r10-readme-"));
    try {
      const files = ["current", "base", "other"].map((name) => path.join(directory, name));
      for (const [index, revision] of [
        baseSha,
        "2e2efa5b8b02e9e5dd0bb0b15d9b23c2f694d7ed",
        CROSSDECK_R10.frozenReferenceSha,
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
export function validateR10FailureOriginals({ root, candidateSha, record }) {
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
export function bindR10Reconciliation({ root, baseSha, candidateSha, plan, record }) {
  if (record.id !== CROSSDECK_R10.id) return null;
  const binding = pendingR10Reconciliation({ root, baseSha, plan, record });
  const registry = json(root, baseSha, registryPath);
  const bridge = registry.reconciliations[2];
  for (const [ancestor, descendant] of [
    [CROSSDECK_R10.requiredNeutralRepairCandidateSha, baseSha],
    [CROSSDECK_R10.frozenReferenceSha, candidateSha],
    [record.predecessor.candidateSha, candidateSha],
    [R8_FORMAT.publicationCandidateSha, candidateSha],
  ])
    git(root, ["merge-base", "--is-ancestor", ancestor, descendant]);
  const changes = git(root, ["diff", "--name-only", "--no-renames", CROSSDECK_R10.frozenReferenceSha, candidateSha])
    .trim()
    .split(/\r?\n/u)
    .filter(Boolean);
  if (
    changes.some(
      (file) => file !== registryPath && !R10_OVERLAY_PATHS.includes(file) && !pairedPublicationPathAllowed(file),
    )
  )
    fail("PUBLICATION_SCOPE_CHANGED");
  validateR10Overlay({
    bridge,
    originalBase: inventory(root, R8_FORMAT.baseSha),
    acceptedBase: inventory(root, baseSha),
    originalSource: inventory(root, CROSSDECK_R10.frozenReferenceSha),
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
  validateR10FailureOriginals({ root, candidateSha, record });
  return binding;
}

// Reuse canonical historical custody and finalizer consistency checks after the
// exact R10 binding validates; neither helper executes consumer commands.
export async function validateR10HistoricalCustody({ plan, ...options }) {
  if (plan) r10HistoricalEvidencePlan(plan);
  return validateR9HistoricalCustody(options);
}
export function validateR10FinalDecision(options) {
  r10HistoricalEvidencePlan(options.plan);
  return validateR9FinalDecision(options);
}

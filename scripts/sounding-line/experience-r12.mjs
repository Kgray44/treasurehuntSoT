// Finite ordinary6 successor; original R8 evidence and all consumed failures stay read-only.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, lstatSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import path from "node:path";
import { productSourceDigest, sourceSnapshot } from "./product-experience.mjs";
import { pairedPublicationPathAllowed } from "./experience-paired.mjs";
import { R8_FORMAT, validateR8RawOriginals } from "./experience-r8-format.mjs";
import { validateR9HistoricalCustody, validateR9FinalDecision, validateR9FailureOriginals } from "./experience-r9.mjs";
import { validateR10FailureOriginals } from "./experience-r10.mjs";
import {
  CROSSDECK_R11,
  R11_OVERLAY_PATHS,
  validateR11Registry,
  validateR11FailureOriginals,
} from "./experience-r11.mjs";

export const CROSSDECK_R12 = Object.freeze({
  id: "PE-X-CROSSDECK-FINAL-VERIFY-20261015-R12",
  recordDigest: "9d140072d1cd31a363bf667380b1298eb1b8a9ef0489eb0be564922f85f5239c",
  frozenReferenceSha: "675208e7eee81d23abb71bc189afc1289d02409a",
  requiredTechnicalCorrectionCandidateSha: "6c9bd4c2ef694cdf0c8de5e8fd4e1719068d537e",
  requiredDiagnosticRepairCandidateSha: "2cf9c1dd10378e6bba08978a9cc4f97543c09979",
  oldRegistryDigest: "0d3ca795fe4d3679202359834094eb02ccf791de13d26335acf466ddee134f2c",
  historicalExceptionDigest: "4d2f73505425dc68b4a14b9e6b030e46a15cc0cc60b53acd4e74c3b382b86c82",
  bridgeId: "PE-R12-ORDINARY-ONLY-BRIDGE-20261017",
  predecessor: {
    runId: 38986106986,
    qualifyCommit: "59eee4ede94f91a116cc4e0cfcc98c795a62567e",
    qualifyPayloadDigest: "9bc236444cf2e5df9173fc182580f94600ec96f88a06571a2e5d507ee6f79131",
  },
});
export const R12_REGENERATED = [
  "Development_Docs/document-index.json",
  "Development_Docs/Programs/Other/Ledgerlight/Project_Ledgerlight_Documentation_Migration_Matrix.csv",
];
export const R12_MERGED = [
  ".agents/README.md",
  "Development_Docs/INDEX.md",
  "Development_Docs/Testing/Product_Experience/README.md",
];
export const R12_TEST_CORRECTION = Object.freeze({
  path: "tests/e2e/crossdeck-phase2.spec.ts",
  mode: "100644",
  oldBlob: "ba77b2faf27e6e44af8db2fbd577bd3b4f9c589a",
  newBlob: "68d861d7e4c819f3855cbcd3cbd8636afb1a034a",
  workingSha256: "d61b51d135b0a91d83b42ee6f01e6f455682aeb257e9d6ba1745fce39aed5e76",
});
export const R12_CORRECTION_EVIDENCE = Object.freeze({
  candidateSha: "6c9bd4c2ef694cdf0c8de5e8fd4e1719068d537e",
  candidateTree: "05eff39924a773335442bdbdc664dba06f38d755",
  patchPath:
    "Development_Docs/Projects/Project_Crossdeck/evidence/ordinary5-reverse-receive-repair-20261017/candidate-correction.patch",
  patchSha256: "7b0c1f5f6fdc922ac1ab4f953036a8ab60343b88551adf6eec7db120ac989feb",
  reviewPath:
    "Development_Docs/Projects/Project_Crossdeck/evidence/ordinary5-reverse-receive-repair-20261017/source-review.json",
  reviewSha256: "db3553ffc17218b35f61ee52d37190afb6b7dd2f99009e85beca255fa51331bf",
});
export const R12_FOCUSED = Object.freeze({
  directory: "Development_Docs/Projects/Project_Crossdeck/evidence/r12-verification-20261017/focused-technical",
  spec: R12_TEST_CORRECTION.path,
  title: "crossdeck.surface-handoff",
  original: Object.freeze({
    candidateSha: "53601e9e386bb4f1062719befc77b7778b9e4430",
    candidateTree: "85e9accc1d273d0f649119380d775df41e6dcf0a",
    baseSha: "a16c5807657786d614ef4c5b8942daa740b2dfdf",
    sourceDigest: "3e69c2306442758edca417fdb478f1a61e009f1cbc82d584bcad6e760257df0f",
  }),
});
export const R12_OVERLAY_PATHS = [
  ...R11_OVERLAY_PATHS,
  ".agents/crossdeck-r12-ordinary-only.md",
  "Development_Docs/Programs/Sounding_Line/Project_Sounding_Line_Crossdeck_R12_Diagnosed_Continuation_20261017.md",
  "Development_Docs/Programs/Sounding_Line/evidence/crossdeck-r12-ordinary-only-20261017/r11-consumed-frozen-publication.derived.json",
  "scripts/sounding-line/experience-r12.mjs",
  "scripts/sounding-line/experience-r12-technical-proof.mjs",
  "scripts/sounding-line/run-browser-suite.mjs",
  "tests/sounding-line/experience-r12.test.mjs",
  "tests/sounding-line/experience-r12-technical-proof.test.mjs",
].sort();
const registryPath = "testing/product-experience-exceptions.json";
const hash = (value) =>
  createHash("sha256")
    .update(JSON.stringify(value ?? null))
    .digest("hex");
const bytesHash = (value) => createHash("sha256").update(value).digest("hex");
const fail = (code) => {
  throw new Error(`PRODUCT_EXPERIENCE_EXCEPTION_R12_${code}`);
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

export function validateR12Record(record) {
  if (
    !["ACTIVE", "RETIRED"].includes(record?.status) ||
    hash({ ...record, status: "ACTIVE" }) !== CROSSDECK_R12.recordDigest
  )
    fail("RECORD_CHANGED");
}
export function assertR12Mode(plan, mode) {
  if (plan.exception?.id === CROSSDECK_R12.id && !["ordinary", "qualify"].includes(mode)) fail("MODE_FORBIDDEN");
}
export function validateR12Bridge(record) {
  if (
    hash(Object.keys(record ?? {}).sort()) !==
      hash(["version", "id", "status", "exceptionId", "recordDigest", "overlay"].sort()) ||
    record.version !== 1 ||
    record.id !== CROSSDECK_R12.bridgeId ||
    record.status !== "ACTIVE" ||
    record.exceptionId !== CROSSDECK_R12.id ||
    record.recordDigest !== CROSSDECK_R12.recordDigest ||
    hash(record.overlay?.map((entry) => entry.path).sort()) !== hash(R12_OVERLAY_PATHS) ||
    new Set(record.overlay?.map((entry) => entry.path)).size !== R12_OVERLAY_PATHS.length ||
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
export function validateR12Registry(registry) {
  const records = registry.exceptions?.filter((record) => record.id === CROSSDECK_R12.id);
  if (records?.length !== 1 || registry.exceptions.length !== 12 || registry.reconciliations?.length !== 5)
    fail("REGISTRY_CHANGED");
  validateR12Record(records[0]);
  const old = {
    ...registry,
    exceptions: registry.exceptions.filter((record) => record.id !== CROSSDECK_R12.id),
    reconciliations: registry.reconciliations.slice(0, 4),
  };
  if (hash(old) !== CROSSDECK_R12.oldRegistryDigest) fail("PREDECESSOR_REGISTRY_CHANGED");
  validateR11Registry(old);
  validateR12Bridge(registry.reconciliations[4]);
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
export function pendingR12Reconciliation({ root, baseSha, plan, record }) {
  if (record.id !== CROSSDECK_R12.id) return null;
  const registry = json(root, baseSha, registryPath);
  validateR12Registry(registry);
  if (hash(registry.exceptions.at(-1)) !== hash(record)) fail("RECORD_CHANGED");
  const bridge = registry.reconciliations[4];
  const historicalException = historicalBinding(
    registry.exceptions.find((value) => value.id === R8_FORMAT_EXCEPTION_ID),
  );
  if (hash(historicalException) !== CROSSDECK_R12.historicalExceptionDigest) fail("HISTORICAL_EXCEPTION_CHANGED");
  return {
    version: 1,
    id: CROSSDECK_R12.bridgeId,
    recordDigest: hash(bridge),
    originalBaseSha: R8_FORMAT.baseSha,
    originalSourceDigest: R8_FORMAT.sourceDigest,
    originalPublicationCandidateSha: R8_FORMAT.publicationCandidateSha,
    currentBaseSha: baseSha,
    currentSourceDigest: plan.sourceDigest,
    overlay: bridge.overlay,
    candidateTestCorrection: record.candidateTestCorrection,
    historicalException,
  };
}
const R8_FORMAT_EXCEPTION_ID = "PE-X-CROSSDECK-FINAL-VERIFY-20261015-R8";
export function r12HistoricalEvidencePlan(plan) {
  if (plan.exception?.id !== CROSSDECK_R12.id) return plan;
  const binding = plan.exception.nonExecutingReconciliation;
  if (
    !binding ||
    plan.exception.recordDigest !== CROSSDECK_R12.recordDigest ||
    binding.version !== 1 ||
    binding.id !== CROSSDECK_R12.bridgeId ||
    binding.currentBaseSha !== plan.baseSha ||
    binding.currentSourceDigest !== plan.sourceDigest ||
    binding.originalBaseSha !== R8_FORMAT.baseSha ||
    binding.originalSourceDigest !== R8_FORMAT.sourceDigest ||
    binding.originalPublicationCandidateSha !== R8_FORMAT.publicationCandidateSha ||
    hash(binding.candidateTestCorrection) !== hash(R12_TEST_CORRECTION) ||
    hash(binding.historicalException) !== CROSSDECK_R12.historicalExceptionDigest ||
    plan.contractDigest !== R8_FORMAT.contractDigest
  )
    fail("BINDING_CHANGED");
  const bridge = {
    version: 1,
    id: CROSSDECK_R12.bridgeId,
    status: "ACTIVE",
    exceptionId: CROSSDECK_R12.id,
    recordDigest: CROSSDECK_R12.recordDigest,
    overlay: binding.overlay,
  };
  validateR12Bridge(bridge);
  if (hash(bridge) !== binding.recordDigest) fail("BINDING_CHANGED");
  return {
    ...plan,
    baseSha: R8_FORMAT.baseSha,
    sourceDigest: R8_FORMAT.sourceDigest,
    candidateSha: R8_FORMAT.publicationCandidateSha,
    exception: binding.historicalException,
  };
}
export function validateR12Overlay({ bridge, originalBase, acceptedBase, originalSource, candidate }) {
  validateR12Bridge(bridge);
  const correction = R12_TEST_CORRECTION;
  if (
    originalSource.get(correction.path) !== `${correction.mode} blob ${correction.oldBlob}` ||
    candidate.get(correction.path) !== `${correction.mode} blob ${correction.newBlob}` ||
    originalBase.get(correction.path) !== acceptedBase.get(correction.path) ||
    bridge.overlay.some((entry) => entry.path === correction.path)
  )
    fail("TEST_CORRECTION_CHANGED");
  const allowed = new Map(bridge.overlay.map((entry) => [entry.path, entry]));
  const metadata = (mode, blob) => (mode === null ? undefined : `${mode} blob ${blob}`);
  for (const [file, entry] of allowed)
    if (
      originalBase.get(file) !== metadata(entry.oldMode, entry.oldBlob) ||
      acceptedBase.get(file) !== metadata(entry.newMode, entry.newBlob) ||
      ([...R12_REGENERATED, ...R12_MERGED].includes(file)
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
      file !== correction.path &&
      !allowed.has(file) &&
      originalSource.get(file) !== candidate.get(file)
    )
      fail("REVIEWED_SOURCE_CHANGED");
  if (candidate.get(registryPath) !== acceptedBase.get(registryPath)) fail("REGISTRY_CHANGED");
}
function validateMergedMetadata({ root, baseSha, candidateSha }) {
  for (const file of R12_MERGED) {
    const directory = mkdtempSync(path.join(tmpdir(), "r12-readme-"));
    try {
      const files = ["current", "base", "other"].map((name) => path.join(directory, name));
      for (const [index, revision] of [
        baseSha,
        R12_FOCUSED.original.baseSha,
        CROSSDECK_R12.frozenReferenceSha,
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
export function validateR12FailureOriginals({ root, candidateSha, record }) {
  const index = json(root, candidateSha, record.predecessor.failureIndexPath);
  if (
    bytesHash(git(root, ["show", `${candidateSha}:${record.predecessor.failureIndexPath}`], true)) !==
      record.predecessor.failureIndexSha256 ||
    index.files?.length !== 9
  )
    fail("FAILURE_INDEX_CHANGED");
  const entries = inventory(root, candidateSha);
  for (const entry of index.files) {
    const file = path.join(root, entry.path);
    if (
      entry.mode !== "100644" ||
      entries.get(entry.path) !== `100644 blob ${entry.blob}` ||
      !lstatSync(file).isFile() ||
      lstatSync(file).isSymbolicLink()
    )
      fail("FAILURE_ORIGINAL_CHANGED");
    for (const bytes of [git(root, ["show", `${candidateSha}:${entry.path}`], true), readFileSync(file)])
      if (bytes.length !== entry.bytes || bytesHash(bytes) !== entry.sha256) fail("FAILURE_ORIGINAL_CHANGED");
  }
}
export function bindR12Reconciliation({ root, baseSha, candidateSha, plan, record }) {
  if (record.id !== CROSSDECK_R12.id) return null;
  const binding = pendingR12Reconciliation({ root, baseSha, plan, record });
  const registry = json(root, baseSha, registryPath);
  const bridge = registry.reconciliations[4];
  for (const [ancestor, descendant] of [
    [CROSSDECK_R12.requiredDiagnosticRepairCandidateSha, baseSha],
    [R12_FOCUSED.original.baseSha, baseSha],
    [CROSSDECK_R12.frozenReferenceSha, candidateSha],
    [CROSSDECK_R12.requiredTechnicalCorrectionCandidateSha, candidateSha],
    [record.predecessor.candidateSha, candidateSha],
    [R8_FORMAT.publicationCandidateSha, candidateSha],
  ])
    git(root, ["merge-base", "--is-ancestor", ancestor, descendant]);
  if (
    hash(record.reviewedTechnicalCorrection) !== hash(R12_CORRECTION_EVIDENCE) ||
    git(root, ["rev-parse", `${R12_CORRECTION_EVIDENCE.candidateSha}^{tree}`]).trim() !==
      R12_CORRECTION_EVIDENCE.candidateTree
  )
    fail("CORRECTION_REVIEW_CHANGED");
  for (const [file, expected] of [
    [R12_CORRECTION_EVIDENCE.patchPath, R12_CORRECTION_EVIDENCE.patchSha256],
    [R12_CORRECTION_EVIDENCE.reviewPath, R12_CORRECTION_EVIDENCE.reviewSha256],
  ]) {
    const absolute = path.join(root, file);
    if (
      !lstatSync(absolute).isFile() ||
      lstatSync(absolute).isSymbolicLink() ||
      bytesHash(readFileSync(absolute)) !== expected ||
      bytesHash(git(root, ["show", `${candidateSha}:${file}`], true)) !== expected
    )
      fail("CORRECTION_REVIEW_CHANGED");
  }
  const changes = git(root, ["diff", "--name-only", "--no-renames", CROSSDECK_R12.frozenReferenceSha, candidateSha])
    .trim()
    .split(/\r?\n/u)
    .filter(Boolean);
  if (
    changes.some(
      (file) =>
        file !== registryPath &&
        file !== R12_TEST_CORRECTION.path &&
        !R12_OVERLAY_PATHS.includes(file) &&
        !pairedPublicationPathAllowed(file),
    )
  )
    fail("PUBLICATION_SCOPE_CHANGED");
  validateR12Overlay({
    bridge,
    originalBase: inventory(root, R8_FORMAT.baseSha),
    acceptedBase: inventory(root, baseSha),
    originalSource: inventory(root, CROSSDECK_R12.frozenReferenceSha),
    candidate: inventory(root, candidateSha),
  });
  validateMergedMetadata({ root, baseSha, candidateSha });
  const original = sourceSnapshot(root, R8_FORMAT.publicationCandidateSha),
    actual = sourceSnapshot(root, candidateSha);
  const normalized = new Map(actual.entries.map((entry) => [entry.path, entry]));
  const originals = new Map(original.entries.map((entry) => [entry.path, entry]));
  const contents = new Map(actual.contents);
  for (const entry of [...bridge.overlay, R12_TEST_CORRECTION]) {
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
  validateR11FailureOriginals({
    root,
    candidateSha,
    record: registry.exceptions.find((value) => value.id === CROSSDECK_R11.id),
  });
  validateR12FailureOriginals({ root, candidateSha, record });
  return binding;
}

// This separate source admission cannot reserve ordinary authority. In particular,
// the historical original is never accepted by the corrected consumer binder.
export async function admitR12FocusedTechnical({
  root,
  baseSha,
  candidateSha,
  stage,
  environment = process.env,
  request,
}) {
  if (!["original", "corrected"].includes(stage) || environment.GITHUB_ACTIONS === "true")
    fail("FOCUSED_SCOPE_CHANGED");
  const installed = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  if (
    git(installed, ["rev-parse", "HEAD"]).trim() !== baseSha ||
    git(root, ["rev-parse", "origin/main"]).trim() !== baseSha ||
    git(root, ["rev-parse", "HEAD"]).trim() !== candidateSha ||
    git(root, ["status", "--porcelain"]).trim()
  )
    fail("FOCUSED_EXACT_CLEAN_SOURCE_REQUIRED");
  git(installed, ["diff", "--exit-code", baseSha, "--", "scripts/sounding-line", registryPath, "package.json"]);
  if (git(installed, ["status", "--porcelain", "--", "scripts/sounding-line", registryPath, "package.json"]).trim())
    fail("FOCUSED_PROTECTED_HELPER_CHANGED");
  const registry = json(installed, baseSha, registryPath);
  const record = validateR12Registry(registry);
  if (record.status !== "ACTIVE" || Date.now() >= Date.parse(record.expiresAt)) fail("FOCUSED_RECORD_INACTIVE");
  const { recordBinding, githubRequest, exceptionStore, inspectCampaignBeforeLocalProof } = await import(
    "./experience-exception.mjs"
  );
  let plan;
  if (stage === "original") {
    const original = R12_FOCUSED.original;
    if (
      candidateSha !== original.candidateSha ||
      git(root, ["rev-parse", `${candidateSha}^{tree}`]).trim() !== original.candidateTree ||
      productSourceDigest(sourceSnapshot(root, candidateSha)) !== original.sourceDigest
    )
      fail("FOCUSED_ORIGINAL_SOURCE_CHANGED");
    plan = {
      baseSha,
      candidateSha,
      sourceDigest: original.sourceDigest,
      contractDigest: record.contractDigest,
      exception: recordBinding(record),
    };
  } else {
    const { planProductExperience } = await import("./product-experience.mjs");
    plan = planProductExperience({
      root,
      baseSha,
      candidateSha,
      changedPaths: git(root, ["diff", "--name-only", "--no-renames", baseSha, candidateSha]).split(/\r?\n/u),
      prNumber: 721,
    });
    if (plan.exception?.id !== CROSSDECK_R12.id) fail("FOCUSED_CORRECTED_SOURCE_CHANGED");
  }
  const api = request ?? githubRequest(record.repository);
  const history = await inspectCampaignBeforeLocalProof({ root, record, plan, request: api });
  const main = await api("git/ref/heads/main"),
    pr = await api("pulls/721");
  if (
    main?.object?.sha !== baseSha ||
    pr?.state !== "open" ||
    pr.draft !== true ||
    pr.base.ref !== "main" ||
    pr.head.repo.full_name !== record.repository ||
    (stage === "corrected" && pr.head.sha !== candidateSha)
  )
    fail("FOCUSED_LIVE_SOURCE_CHANGED");
  git(root, ["merge-base", "--is-ancestor", CROSSDECK_R12.frozenReferenceSha, pr.head.sha]);
  const store = exceptionStore({ record, request: api });
  for (const slot of ["prepare", "capture", "review-submit", "review7", "qualify", "qualified"])
    if (await store.read(slot)) fail("FOCUSED_STAGE_ALREADY_CONSUMED");
  return {
    record,
    plan,
    manifest: {
      classification: "READ_ONLY_R12_FOCUSED_TECHNICAL_ADMISSION_NO_EXECUTION",
      status: "PASS",
      stage,
      baseSha,
      candidateSha,
      candidateTree: git(root, ["rev-parse", `${candidateSha}^{tree}`]).trim(),
      sourceDigest: plan.sourceDigest,
      contractDigest: plan.contractDigest,
      recordDigest: CROSSDECK_R12.recordDigest,
      spec: R12_FOCUSED.spec,
      title: R12_FOCUSED.title,
      history,
      custodyWrites: 0,
      executions: 0,
    },
  };
}

export async function validateR12PublishedTechnicalProof({ root, candidateSha, plan, record }) {
  if (record.id !== CROSSDECK_R12.id) return;
  validateR12Record(record);
  const { validateR12FocusedReceipt } = await import("./experience-r12-technical-proof.mjs");
  const receipts = [];
  for (const stage of ["original", "corrected"]) {
    let receipt;
    try {
      receipt = json(root, candidateSha, `${R12_FOCUSED.directory}/${stage}/receipt.json`);
    } catch {
      fail("FOCUSED_PUBLICATION_MISSING");
    }
    await validateR12FocusedReceipt({ root, revision: candidateSha, record, plan, stage, receipt });
    if (
      receipt.exceptionId !== CROSSDECK_R12.id ||
      receipt.stage !== stage ||
      receipt.recordDigest !== CROSSDECK_R12.recordDigest ||
      receipt.contractDigest !== plan.contractDigest ||
      receipt.spec !== R12_FOCUSED.spec ||
      receipt.title !== R12_FOCUSED.title ||
      receipt.invocations !== 1 ||
      receipt.retries !== 0 ||
      receipt.repeatEachIndex !== 0 ||
      receipt.additionalRepeats !== 0 ||
      receipt.baseSha !== plan.baseSha ||
      receipt.productCaptures !== 0 ||
      receipt.productReviews !== 0 ||
      receipt.providerCalls !== 0 ||
      !["PASS", "FAIL"].includes(receipt.status)
    )
      fail("FOCUSED_PUBLICATION_CHANGED");
    if (stage === "original") {
      if (
        receipt.candidateSha !== R12_FOCUSED.original.candidateSha ||
        receipt.candidateTree !== R12_FOCUSED.original.candidateTree ||
        receipt.sourceDigest !== R12_FOCUSED.original.sourceDigest ||
        receipt.caseExecutions !== 1
      )
        fail("FOCUSED_ORIGINAL_PROOF_CHANGED");
    } else {
      if (
        receipt.status !== "PASS" ||
        receipt.outcome !== "CORRECTION_PASS" ||
        receipt.caseExecutions !== 1 ||
        receipt.baseSha !== plan.baseSha ||
        receipt.sourceDigest !== plan.sourceDigest ||
        productSourceDigest(sourceSnapshot(root, receipt.candidateSha)) !== plan.sourceDigest
      )
        fail("FOCUSED_CORRECTED_PROOF_CHANGED");
      git(root, ["merge-base", "--is-ancestor", receipt.candidateSha, candidateSha]);
      if (git(root, ["rev-parse", `${receipt.candidateSha}^{tree}`]).trim() !== receipt.candidateTree)
        fail("FOCUSED_CORRECTED_PROOF_CHANGED");
    }
    receipts.push(receipt);
  }
  return { status: "PASS", classification: "SUPPORTING_TECHNICAL_PROOF_NOT_QUALIFICATION", receipts };
}

// Reuse canonical historical custody and finalizer consistency checks after the
// exact R12 binding validates; neither helper executes consumer commands.
export async function validateR12HistoricalCustody({ plan, ...options }) {
  if (plan) r12HistoricalEvidencePlan(plan);
  return validateR9HistoricalCustody(options);
}
export function validateR12FinalDecision(options) {
  r12HistoricalEvidencePlan(options.plan);
  if (
    options.decision.productExperienceReplay?.status !== "PASS" ||
    options.decision.productExperienceReplay?.sourceDigest !== options.plan.sourceDigest
  )
    fail("CURRENT_REPLAY_REQUIRED");
  return validateR9FinalDecision(options);
}

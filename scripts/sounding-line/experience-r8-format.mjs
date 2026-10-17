// Nonexecuting reconciliation of one already captured/reviewed R8 source.
// Custody and every execution allowance remain in the original R8 namespace.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { CROSSDECK_R8 } from "./experience-r8.mjs";
import { productSourceDigest, sourceSnapshot } from "./product-experience.mjs";
import { pairedPublicationPathAllowed } from "./experience-paired.mjs";
import { CROSSDECK_R9, r9HistoricalEvidencePlan } from "./experience-r9.mjs";
import { CROSSDECK_R10, r10HistoricalEvidencePlan } from "./experience-r10.mjs";
import { CROSSDECK_R11, r11HistoricalEvidencePlan } from "./experience-r11.mjs";
import { CROSSDECK_R12, r12HistoricalEvidencePlan } from "./experience-r12.mjs";
import { CROSSDECK_R13, r13HistoricalEvidencePlan } from "./experience-r13.mjs";

export const R8_FORMAT = Object.freeze({
  id: "PE-R8-HISTORICAL-FORMAT-20261016",
  registry: "testing/product-experience-exceptions.json",
  baseSha: "151417a772c1bcde4e5c7f256302b803d25d40da",
  executedCandidateSha: "3415165ed9c4c11f2512d99aea0947f62696146a",
  publicationCandidateSha: "4e365e82fda3f272ca6fc2fec61b599b07746834",
  sourceDigest: "6d8ebc54902e7bce42a73c1e92d2ad6bc3465f94a1632c04559112bd3afee0ba",
  contractDigest: "33b7621269fa18417c20713ccc185783861ef043e38a527f727df7e1047c7274",
  prepareCommit: "d37e647ec70c459f5cdf69704d3a5ba02f077a9b",
  prepareRun: 38902634861,
  captureArtifact: 12048176159,
  captureDigest: "sha256:00d3706a20bfb1c9ec9f60bf6daabd58a4c10a298dcc9512dc5845cabf36d754",
  reviewRun: 38913515007,
  reviewArtifact: 12051889841,
  reviewDigest: "sha256:4bbb290f32061175579b8ce7c1de4a05acb8ccfcac0678f4346194d3caa84c20",
  captureSeal: "81847b8e96943609329990c7bca317d5206e60a8",
  reviewSeal: "0de6d65c804dbc7ce0cd589559473ccda0df7a4b",
  reviewSubmission: "2d0169e6425884f3440e76ddc9b4b8fe924e51f7",
});
export const R8_RAW_ORIGINALS = [
  [
    "final-publication-validation.json",
    "118a72ececae0ff75bae559ab899ec6c9975b2aa",
    "1e2c17fdd0ea724a79cb3f4fa3db05a9e68922f7f72cd0673c108be40dd4b65a",
  ],
  [
    "preparation-jobs.terminal.json",
    "8538a5ffde842a6f322889d89b8abb67c0240471",
    "bd3b81b13d5349b74ae1b10036cf23520bd62e190060d4b47322aaf0674964a2",
  ],
  [
    "review-artifacts.terminal.json",
    "0219da4fe7d8fddefa571e040fc9068bd171b666",
    "325d07bdf190652ab33ccfbed13dc222086e2dd758f29ff7987b02341f3220a2",
  ],
  [
    "review-jobs.terminal.json",
    "52e7bef2f34c7ac9ad1a1abeb80ee71d8d044aba",
    "18fbcd598a46bad3420644fa9076b7f5e8d1543b3617a2fa6d9fe88829ba49fd",
  ],
  [
    "review-run.terminal.json",
    "49f625b06c5f2a50969b0483cc768c8d02f00594",
    "2ec9b01e83ae11360e64095e5a0095e8895b14798ff5b41105c7fe15f2f1f085",
  ],
].map(([name, blob, sha256]) => ({
  path: `Development_Docs/Projects/Project_Crossdeck/evidence/r4-verification-20261015/${name}`,
  blob,
  sha256,
}));

// Exact filenames, never scripts/**, tests/** or all accepted-base changes.
export const R8_FORMAT_OVERLAY_PATHS = [
  ".prettierignore",
  ".agents/README.md",
  ".agents/crossdeck-r8-historical-format.md",
  "scripts/sounding-line/experience-r8-format.mjs",
  "scripts/sounding-line/experience-exception.mjs",
  "scripts/sounding-line/product-experience.mjs",
  "scripts/sounding-line/experience-attestation.mjs",
  "scripts/sounding-line/experience-paired.mjs",
  "scripts/sounding-line/ordinary.mjs",
  "tests/sounding-line/experience-exception.test.mjs",
  "tests/sounding-line/product-experience.test.mjs",
  "tests/sounding-line/fixtures/r8-format-originals.json",
  "Development_Docs/Engineering/Crossdeck_R8_Historical_Format_Reconciliation.md",
  "Development_Docs/Testing/Product_Experience/README.md",
  "Development_Docs/document-index.json",
  "Development_Docs/Programs/Other/Ledgerlight/Project_Ledgerlight_Documentation_Migration_Matrix.csv",
].sort();
export const R8_FORMAT_REGENERATED_METADATA = [
  "Development_Docs/document-index.json",
  "Development_Docs/Programs/Other/Ledgerlight/Project_Ledgerlight_Documentation_Migration_Matrix.csv",
];
export const R8_FORMAT_MERGED_METADATA = [".agents/README.md", "Development_Docs/Testing/Product_Experience/README.md"];
const hash = (value) =>
  createHash("sha256")
    .update(JSON.stringify(value ?? null))
    .digest("hex");
const fail = (code) => {
  throw new Error(`PRODUCT_EXPERIENCE_R8_FORMAT_${code}`);
};
const git = (root, args, binary = false) =>
  execFileSync("git", args, {
    cwd: root,
    encoding: binary ? null : "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "ignore"],
  });
const inventory = (root, revision) =>
  new Map(
    git(root, ["ls-tree", "-rz", revision])
      .split("\0")
      .filter(Boolean)
      .map((entry) => {
        const [metadata, file] = entry.split("\t");
        return [file, metadata];
      }),
  );
const runtime = (file) =>
  /^(?:src|app|components|lib|styles|public|prisma|scripts|tests|testing|\.github)\//u.test(file) ||
  /^(?:package(?:-lock)?\.json|.*\.config\.[^/]+|tsconfig\.json|\.nvmrc|\.prettierignore|\.gitignore|\.gitattributes)$/u.test(
    file,
  );

export function validateR8RawIdentity(expected, committed, actual) {
  if (
    committed !== `100644 blob ${expected.blob}` ||
    createHash("sha256").update(actual).digest("hex") !== expected.sha256
  )
    fail("RAW_ORIGINAL_CHANGED");
}
export function validateR8RawOriginals({ root, baseSha, candidateSha }) {
  const before = inventory(root, baseSha),
    after = inventory(root, candidateSha);
  for (const expected of R8_RAW_ORIGINALS) {
    if (!before.has(expected.path) && !after.has(expected.path)) continue;
    const file = path.join(root, expected.path);
    if (!existsSync(file) || !lstatSync(file).isFile() || lstatSync(file).isSymbolicLink())
      fail("RAW_ORIGINAL_CHANGED");
    validateR8RawIdentity(expected, after.get(expected.path), readFileSync(file));
    validateR8RawIdentity(
      expected,
      after.get(expected.path),
      git(root, ["show", `${candidateSha}:${expected.path}`], true),
    );
  }
}

export function validateR8FormatRecord(record) {
  const sha = (value) => /^[a-f0-9]{40}$/u.test(value ?? "");
  if (
    record?.version !== 1 ||
    record.id !== R8_FORMAT.id ||
    record.status !== "ACTIVE" ||
    record.exceptionId !== CROSSDECK_R8.id ||
    record.recordDigest !== CROSSDECK_R8.recordDigest ||
    record.reviewArtifact?.runId !== R8_FORMAT.reviewRun ||
    record.reviewArtifact.id !== R8_FORMAT.reviewArtifact ||
    record.reviewArtifact.digest !== R8_FORMAT.reviewDigest ||
    record.captureSeal !== R8_FORMAT.captureSeal ||
    record.reviewSeal !== R8_FORMAT.reviewSeal ||
    record.reviewSubmission !== R8_FORMAT.reviewSubmission ||
    hash(record.overlay?.map((entry) => entry.path).sort()) !== hash(R8_FORMAT_OVERLAY_PATHS) ||
    record.overlay.some(
      (entry) =>
        ![null, "100644"].includes(entry.oldMode) ||
        entry.newMode !== "100644" ||
        (entry.oldMode === null ? entry.oldBlob !== null : !sha(entry.oldBlob)) ||
        !sha(entry.newBlob),
    )
  )
    fail("RECORD_INVALID");
}

export function validateR8FormatOverlay({ record, originalBase, acceptedBase, originalSource, candidate }) {
  validateR8FormatRecord(record);
  const allowed = new Map(record.overlay.map((entry) => [entry.path, entry]));
  const metadata = (mode, blob) => (mode === null ? undefined : `${mode} blob ${blob}`);
  for (const [file, entry] of allowed) {
    if (
      originalBase.get(file) !== metadata(entry.oldMode, entry.oldBlob) ||
      acceptedBase.get(file) !== metadata(entry.newMode, entry.newBlob) ||
      ([...R8_FORMAT_REGENERATED_METADATA, ...R8_FORMAT_MERGED_METADATA].includes(file)
        ? !/^100644 blob [a-f0-9]{40}$/u.test(candidate.get(file) ?? "")
        : candidate.get(file) !== acceptedBase.get(file))
    )
      fail("OVERLAY_CHANGED");
  }
  for (const file of new Set([...originalBase.keys(), ...acceptedBase.keys()]))
    if (file !== R8_FORMAT.registry && !allowed.has(file) && originalBase.get(file) !== acceptedBase.get(file))
      fail("BASE_SCOPE_CHANGED");
  for (const file of new Set([...originalSource.keys(), ...candidate.keys()]))
    if (
      runtime(file) &&
      !allowed.has(file) &&
      file !== R8_FORMAT.registry &&
      originalSource.get(file) !== candidate.get(file)
    )
      fail("REVIEWED_SOURCE_CHANGED");
  if (candidate.get(R8_FORMAT.registry) !== acceptedBase.get(R8_FORMAT.registry)) fail("REGISTRY_CHANGED");
}

// Exact clean composition preserves both published index links and maintenance
// links. An unrelated automation/content edit cannot borrow this reconciliation.
export function validateR8FormatMergedMetadata({ root, baseSha, candidateSha }) {
  for (const file of R8_FORMAT_MERGED_METADATA) {
    const directory = mkdtempSync(path.join(tmpdir(), "r8-format-metadata-"));
    const current = path.join(directory, "current"),
      base = path.join(directory, "base"),
      other = path.join(directory, "other");
    try {
      writeFileSync(current, git(root, ["show", `${baseSha}:${file}`], true));
      writeFileSync(base, git(root, ["show", `${R8_FORMAT.baseSha}:${file}`], true));
      writeFileSync(other, git(root, ["show", `${R8_FORMAT.publicationCandidateSha}:${file}`], true));
      const merged = execFileSync("git", ["merge-file", "--stdout", current, base, other], {
        cwd: root,
        maxBuffer: 64 * 1024 * 1024,
        timeout: 5000,
        stdio: ["ignore", "pipe", "ignore"],
      });
      const blob = createHash("sha1").update(`blob ${merged.length}\0`).update(merged).digest("hex");
      if (git(root, ["rev-parse", `${candidateSha}:${file}`]).trim() !== blob) fail("MERGED_METADATA_CHANGED");
    } finally {
      if (!directory.startsWith(path.resolve(tmpdir()) + path.sep)) fail("METADATA_TEMP_PATH_INVALID");
      rmSync(directory, { recursive: true, force: true });
    }
  }
}

export function validateR8FormatPublication(changes) {
  if (
    changes.some(
      (file) =>
        file !== R8_FORMAT.registry && !R8_FORMAT_OVERLAY_PATHS.includes(file) && !pairedPublicationPathAllowed(file),
    )
  )
    fail("PUBLICATION_SCOPE_CHANGED");
}

// Construct the truthful pending reservation binding without granting admission.
export function pendingR8FormatReconciliation({ root, baseSha, plan, record }) {
  if (record.id !== CROSSDECK_R8.id || baseSha === R8_FORMAT.baseSha) return null;
  const current = JSON.parse(git(root, ["show", `${baseSha}:${R8_FORMAT.registry}`]));
  if (!current.reconciliations?.length) return null;
  const previous = JSON.parse(git(root, ["show", `${R8_FORMAT.baseSha}:${R8_FORMAT.registry}`]));
  const { reconciliations, ...unchanged } = current;
  if (hash(unchanged) !== hash(previous) || reconciliations?.length !== 1) fail("REGISTRY_CHANGED");
  const reconciliation = current.reconciliations[0];
  validateR8FormatRecord(reconciliation);
  return {
    version: 1,
    id: R8_FORMAT.id,
    recordDigest: hash(reconciliation),
    originalBaseSha: R8_FORMAT.baseSha,
    originalSourceDigest: R8_FORMAT.sourceDigest,
    originalPublicationCandidateSha: R8_FORMAT.publicationCandidateSha,
    currentBaseSha: baseSha,
    currentSourceDigest: plan.sourceDigest,
    overlay: reconciliation.overlay,
    captureSeal: reconciliation.captureSeal,
    reviewSeal: reconciliation.reviewSeal,
    reviewSubmission: reconciliation.reviewSubmission,
    reviewArtifact: reconciliation.reviewArtifact,
  };
}

export function bindR8FormatReconciliation({ root, baseSha, candidateSha, plan, record }) {
  const binding = pendingR8FormatReconciliation({ root, baseSha, plan, record });
  if (!binding) return null;
  const reconciliation = JSON.parse(git(root, ["show", `${baseSha}:${R8_FORMAT.registry}`])).reconciliations[0];
  git(root, ["merge-base", "--is-ancestor", R8_FORMAT.baseSha, baseSha]);
  git(root, ["merge-base", "--is-ancestor", R8_FORMAT.publicationCandidateSha, candidateSha]);
  validateR8FormatPublication(
    git(root, ["diff", "--name-only", "--no-renames", R8_FORMAT.publicationCandidateSha, candidateSha])
      .trim()
      .split(/\r?\n/u)
      .filter(Boolean),
  );
  if (plan.contractDigest !== R8_FORMAT.contractDigest) fail("CONTRACT_CHANGED");
  validateR8FormatOverlay({
    record: reconciliation,
    originalBase: inventory(root, R8_FORMAT.baseSha),
    acceptedBase: inventory(root, baseSha),
    originalSource: inventory(root, R8_FORMAT.publicationCandidateSha),
    candidate: inventory(root, candidateSha),
  });
  const originalSnapshot = sourceSnapshot(root, R8_FORMAT.publicationCandidateSha);
  validateR8FormatMergedMetadata({ root, baseSha, candidateSha });
  const actualSnapshot = sourceSnapshot(root, candidateSha);
  const normalized = new Map(actualSnapshot.entries.map((entry) => [entry.path, entry]));
  const originalEntries = new Map(originalSnapshot.entries.map((entry) => [entry.path, entry]));
  const contents = new Map(actualSnapshot.contents);
  for (const entry of reconciliation.overlay) {
    if (!runtime(entry.path)) continue;
    if (originalEntries.has(entry.path)) normalized.set(entry.path, originalEntries.get(entry.path));
    else normalized.delete(entry.path);
    if (originalSnapshot.contents.has(entry.path)) contents.set(entry.path, originalSnapshot.contents.get(entry.path));
    else contents.delete(entry.path);
  }
  if (
    productSourceDigest(originalSnapshot) !== R8_FORMAT.sourceDigest ||
    productSourceDigest(actualSnapshot) !== plan.sourceDigest ||
    productSourceDigest({ entries: [...normalized.values()], contents }) !== R8_FORMAT.sourceDigest
  )
    fail("REVIEWED_SOURCE_CHANGED");
  const originalIgnore = git(root, ["show", `${R8_FORMAT.baseSha}:.prettierignore`]);
  const nextIgnore = git(root, ["show", `${baseSha}:.prettierignore`]);
  const expectedIgnore =
    originalIgnore +
    "\n# Exact immutable R4 terminal originals; validated by ordinary admission.\n" +
    R8_RAW_ORIGINALS.map((entry) => `/${entry.path}\n`).join("");
  if (nextIgnore !== expectedIgnore) fail("FORMAT_INPUT_CHANGED");
  validateR8RawOriginals({ root, baseSha, candidateSha });
  return binding;
}

export function r8FormatEvidencePlan(plan) {
  if (plan.exception?.id === CROSSDECK_R13.id) return r13HistoricalEvidencePlan(plan);
  if (plan.exception?.id === CROSSDECK_R12.id) return r12HistoricalEvidencePlan(plan);
  if (plan.exception?.id === CROSSDECK_R11.id) return r11HistoricalEvidencePlan(plan);
  if (plan.exception?.id === CROSSDECK_R10.id) return r10HistoricalEvidencePlan(plan);
  if (plan.exception?.id === CROSSDECK_R9.id) return r9HistoricalEvidencePlan(plan);
  const binding = plan.exception?.nonExecutingReconciliation;
  if (!binding) return plan;
  if (
    binding.version !== 1 ||
    binding.id !== R8_FORMAT.id ||
    plan.exception.id !== CROSSDECK_R8.id ||
    plan.exception.recordDigest !== CROSSDECK_R8.recordDigest ||
    binding.originalBaseSha !== R8_FORMAT.baseSha ||
    binding.originalSourceDigest !== R8_FORMAT.sourceDigest ||
    binding.originalPublicationCandidateSha !== R8_FORMAT.publicationCandidateSha ||
    binding.currentBaseSha !== plan.baseSha ||
    binding.currentSourceDigest !== plan.sourceDigest ||
    plan.contractDigest !== R8_FORMAT.contractDigest ||
    !/^[a-f0-9]{64}$/u.test(binding.recordDigest ?? "")
  )
    fail("BINDING_CHANGED");
  const exception = { ...plan.exception };
  delete exception.nonExecutingReconciliation;
  const record = {
    version: 1,
    id: R8_FORMAT.id,
    status: "ACTIVE",
    exceptionId: CROSSDECK_R8.id,
    recordDigest: CROSSDECK_R8.recordDigest,
    overlay: binding.overlay,
    captureSeal: binding.captureSeal,
    reviewSeal: binding.reviewSeal,
    reviewSubmission: binding.reviewSubmission,
    reviewArtifact: binding.reviewArtifact,
  };
  validateR8FormatRecord(record);
  if (hash(record) !== binding.recordDigest) fail("BINDING_CHANGED");
  return {
    ...plan,
    baseSha: R8_FORMAT.baseSha,
    sourceDigest: R8_FORMAT.sourceDigest,
    candidateSha: R8_FORMAT.publicationCandidateSha,
    exception,
  };
}

export function assertR8FormatMode(plan, mode) {
  if (plan.exception?.id === CROSSDECK_R13.id) {
    r13HistoricalEvidencePlan(plan);
    if (!["ordinary", "qualify"].includes(mode)) fail("EXECUTION_FORBIDDEN");
    return;
  }
  if (plan.exception?.id === CROSSDECK_R12.id) {
    r12HistoricalEvidencePlan(plan);
    if (!["ordinary", "qualify"].includes(mode)) fail("EXECUTION_FORBIDDEN");
    return;
  }
  if (plan.exception?.id === CROSSDECK_R11.id) {
    r11HistoricalEvidencePlan(plan);
    if (!["ordinary", "qualify"].includes(mode)) fail("EXECUTION_FORBIDDEN");
    return;
  }
  if (plan.exception?.id === CROSSDECK_R10.id) {
    r10HistoricalEvidencePlan(plan);
    if (!["ordinary", "qualify"].includes(mode)) fail("EXECUTION_FORBIDDEN");
    return;
  }
  if (plan.exception?.id === CROSSDECK_R9.id) {
    r9HistoricalEvidencePlan(plan);
    if (!["ordinary", "qualify"].includes(mode)) fail("EXECUTION_FORBIDDEN");
    return;
  }
  if (!plan.exception?.nonExecutingReconciliation) return;
  r8FormatEvidencePlan(plan);
  if (!["ordinary", "verify", "qualify"].includes(mode)) fail("EXECUTION_FORBIDDEN");
}

export function validateR8FormatEvidenceIdentity(plan, evidence) {
  if (!plan.exception?.nonExecutingReconciliation) return;
  r8FormatEvidencePlan(plan);
  if (
    evidence.captureArtifactId !== R8_FORMAT.captureArtifact ||
    evidence.reviewArtifactId !== R8_FORMAT.reviewArtifact
  )
    fail("ORIGINAL_ARTIFACT_CHANGED");
}

export async function validateR8FormatCustody({ plan, store, request }) {
  const binding = plan.exception?.nonExecutingReconciliation;
  if (!binding) return;
  r8FormatEvidencePlan(plan);
  const expected = [
    ["prepare", R8_FORMAT.prepareCommit, R8_FORMAT.prepareRun],
    ["capture", binding.captureSeal, R8_FORMAT.prepareRun],
    ["review7", binding.reviewSeal, R8_FORMAT.reviewRun],
    ["review-submit", binding.reviewSubmission, R8_FORMAT.reviewRun],
  ];
  for (const [slot, commit, runId] of expected) {
    const sealed = await store.read(slot);
    if (sealed?.commitSha !== commit || sealed.run?.runId !== runId) fail("ORIGINAL_CUSTODY_CHANGED");
  }
  for (const runId of [R8_FORMAT.prepareRun, R8_FORMAT.reviewRun]) {
    const run = await request(`actions/runs/${runId}`);
    if (
      run?.status !== "completed" ||
      run.conclusion !== "success" ||
      run.run_attempt !== 1 ||
      run.head_sha !== R8_FORMAT.baseSha ||
      run.head_branch !== "main" ||
      run.event !== "workflow_dispatch" ||
      run.actor?.login !== "Kgray44" ||
      run.triggering_actor?.login !== "Kgray44"
    )
      fail("ORIGINAL_RUN_NOT_SUCCESSFUL");
  }
  for (const [artifactId, digest, runId] of [
    [R8_FORMAT.captureArtifact, R8_FORMAT.captureDigest, R8_FORMAT.prepareRun],
    [binding.reviewArtifact.id, binding.reviewArtifact.digest, R8_FORMAT.reviewRun],
  ]) {
    const artifact = await request(`actions/artifacts/${artifactId}`);
    if (
      artifact?.id !== artifactId ||
      artifact.expired ||
      artifact.digest !== digest ||
      artifact.workflow_run?.id !== runId
    )
      fail("ORIGINAL_ARTIFACT_CHANGED");
  }
}

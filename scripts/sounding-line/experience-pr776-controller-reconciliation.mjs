import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

// One protected controller successor; this preserves a spent review, never grants another pass.
export const PR776_CONTROLLER = Object.freeze({
  kind: "PR776_CONTROLLER_BASE_RECONCILIATION_1",
  id: "pr776-attestation-buffer-reconciliation-20261025",
  oldBase: "819c992fb15ef0b87299ddaaed143427bd00a13d",
  ancestor: "7036562034b19a70d10bd0d87ea66d208af11d64",
  sourceDigest: "9f4af409dd681c5b984bef3a1c97b221db0e413a0bf386eb86bed79298617fb5",
  contractDigest: "7dc2911fb58ef2d1794bb7d2e28d7dd175a34fa82f89b0ff7e715ec55ddf8da3",
  captureArtifactId: 12585174268,
  captureRunId: 40155440070,
  captureDigest: "sha256:1a76a62659b1a0dab9d97925daaf97c88105a651c81ce6016a3ebfcb18af8216",
  canonicalSha256: "cc081df079b0e8a646eec071ef263f5c2261d14ea776b9185a39e5ffe4baadcb",
  reviewSha256: "2a689c7f2c3f404e22cb3e69418fbad41c062284a4917496b62ee2566a0e38df",
  planSha256: "bd0fd9565d87c050224a8c38b9f936d811884d305115f686609da0fddfa56850",
  inventorySha256: "215152c2e05fc3d06d950d13a0212737ff50f271a6cc826dd1ca42d455e0ee34",
});
const E = "Development_Docs/Testing/Product_Experience/Engineering/pr776-controller-reconciliation-20261025";
const C = "Development_Docs/Testing/Product_Experience/candidate-review.json";
const INDEX = "Development_Docs/document-index.json";
const MATRIX = "Development_Docs/Programs/Other/Ledgerlight/Project_Ledgerlight_Documentation_Migration_Matrix.csv";
const originals = [
  "accepted-canonical.original.json",
  "independent-review.original.json",
  "captured-plan.original.json",
  "public-files-941.original.json",
].map((name) => `${E}/${name}`);
export const PR776_RECORD_PATH = `${E}/controller-reconciliation.json`;
export const PR776_CONTROLLER_PATHS = Object.freeze([
  ".prettierignore",
  "scripts/sounding-line/experience-pr776-controller-reconciliation.mjs",
  "scripts/sounding-line/experience-reviewed-adoption.mjs",
  "scripts/sounding-line/product-experience.mjs",
  "scripts/sounding-line/experience-prepare.mjs",
  "scripts/sounding-line/experience-attestation.mjs",
  "tests/sounding-line/experience-pr776-controller-reconciliation.test.mjs",
  "tests/sounding-line/experience-attestation.test.mjs",
  "tests/sounding-line/experience-paired.test.mjs",
  ...originals,
  PR776_RECORD_PATH,
  INDEX,
  MATRIX,
]);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const stable = (value) =>
  JSON.stringify(value, (_, item) =>
    item && !Array.isArray(item) && typeof item === "object"
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
      : item,
  );
const same = (a, b) => stable(a) === stable(b);
const need = (value, code) => {
  if (!value) throw new Error(`PRODUCT_EXPERIENCE_PR776_CONTROLLER_RECONCILIATION_${code}`);
};
const git = (root, args) =>
  execFileSync("git", ["--no-replace-objects", "--no-optional-locks", "-C", root, ...args], {
    maxBuffer: 16 * 1024 * 1024,
    timeout: 30000,
  });
const text = (read, root, args) => read(root, args).toString().trim();
const readRevision = (read, root, revision, file) => read(root, ["show", `${revision}:${file}`]);
const tree = (read, root, revision) =>
  new Map(
    read(root, ["ls-tree", "-rz", revision])
      .toString()
      .split("\0")
      .filter(Boolean)
      .map((row) => {
        const [meta, file] = row.split("\t");
        return [file, meta];
      }),
  );
const paths = (read, root, before, after) =>
  text(read, root, ["diff", "--name-only", "--no-renames", before, after]).split("\n").filter(Boolean).sort();
const exactPaths = (a, b) => same([...a].sort(), [...b].sort());
export const isPR776ControllerReconciliation = (plan) =>
  plan?.pr776ControllerReconciliation?.kind === PR776_CONTROLLER.kind;

function inspect({ root, plan, readGit = git }) {
  const p = PR776_CONTROLLER,
    read = readGit;
  need(plan.baseSha !== p.oldBase && plan.contractDigest === p.contractDigest, "SOURCE_IDENTITY");
  const parents = text(read, root, ["show", "-s", "--format=%P", plan.baseSha]).split(" ");
  need(parents.length === 2 && parents[0] === p.oldBase, "ONE_NEXT_NORMAL_MERGE_REQUIRED");
  need(
    text(read, root, ["rev-parse", `${plan.baseSha}^{tree}`]) ===
      text(read, root, ["rev-parse", `${parents[1]}^{tree}`]),
    "QUALIFIED_HEAD_TREE_REQUIRED",
  );
  read(root, ["merge-base", "--is-ancestor", p.ancestor, plan.candidateSha]);
  read(root, ["merge-base", "--is-ancestor", plan.baseSha, plan.candidateSha]);
  need(exactPaths(paths(read, root, p.oldBase, plan.baseSha), PR776_CONTROLLER_PATHS), "CONTROLLER_CHANGED_PATHS");
  const recordBytes = readRevision(read, root, plan.baseSha, PR776_RECORD_PATH),
    record = JSON.parse(recordBytes);
  need(
    record.status === "ACTIVE" &&
      record.kind === p.kind &&
      record.id === p.id &&
      record.prNumber === 776 &&
      record.additionalIndependentPasses === 0 &&
      same(record.originalIdentity, p),
    "FINITE_PROTECTED_RECORD",
  );
  need(
    exactPaths(
      Object.keys(record.requiredRepairBlobs ?? {}),
      PR776_CONTROLLER_PATHS.filter((file) => ![PR776_RECORD_PATH, INDEX, MATRIX].includes(file)),
    ),
    "REQUIRED_REPAIR_BLOBS",
  );
  need(
    /^[a-f0-9]{64}$/u.test(record.expectedCurrentSourceDigest ?? "") &&
      record.expectedCurrentSourceDigest !== p.sourceDigest &&
      plan.sourceDigest === record.expectedCurrentSourceDigest,
    "CURRENT_SOURCE_IDENTITY",
  );
  const baseTree = tree(read, root, plan.baseSha),
    candidateTree = tree(read, root, plan.candidateSha),
    oldTree = tree(read, root, p.ancestor);
  for (const [file, oid] of Object.entries(record.requiredRepairBlobs))
    need(
      /^[a-f0-9]{40}$/u.test(oid) &&
        baseTree.get(file) === `100644 blob ${oid}` &&
        candidateTree.get(file) === baseTree.get(file),
      "REPAIR_BLOB_CHANGED",
    );
  need(readRevision(read, root, plan.candidateSha, PR776_RECORD_PATH).equals(recordBytes), "RECORD_CHANGED");
  need(
    paths(read, root, p.ancestor, plan.candidateSha).every(
      (file) => PR776_CONTROLLER_PATHS.includes(file) || file === C,
    ),
    "UNRELATED_CANDIDATE_CHANGE",
  );
  const readOriginal = (index, digest) => {
    const bytes = readRevision(read, root, plan.baseSha, originals[index]);
    need(sha256(bytes) === digest, "ENGINEERING_ORIGINAL_CHANGED");
    return JSON.parse(bytes);
  };
  const canonical = readOriginal(0, p.canonicalSha256),
    review = readOriginal(1, p.reviewSha256),
    capturedPlan = readOriginal(2, p.planSha256),
    inventory = readOriginal(3, p.inventorySha256);
  need(
    capturedPlan.baseSha === p.oldBase &&
      capturedPlan.sourceDigest === p.sourceDigest &&
      capturedPlan.contractDigest === p.contractDigest &&
      same(plan.contracts, capturedPlan.contracts) &&
      same(plan.paired, capturedPlan.paired) &&
      same(plan.browserTests, capturedPlan.browserTests) &&
      plan.contextCount === 118 &&
      plan.genericContextCount === 112 &&
      plan.contracts.length === 32 &&
      !plan.debt.length &&
      !plan.uncertainty.length,
    "CAPTURED_OBLIGATIONS_CHANGED",
  );
  need(
    review.status === "ACCEPTED" &&
      canonical.reviews.length === 32 &&
      same(canonical.reviews, review.reviews) &&
      canonical.reviews.every((row) => row.status === "ACCEPTED") &&
      same(canonical.reviews.map((row) => row.iterations).sort(), [...Array(23).fill(2), ...Array(9).fill(4)]),
    "SPENT_REVIEW_CHANGED",
  );
  need(inventory.length === 941 && new Set(inventory.map((row) => row.path)).size === 941, "PUBLIC_941_INVENTORY");
  for (const row of inventory) {
    need(oldTree.get(row.path) === `100644 blob ${row.blob}`, "ORIGINAL_941_CHANGED");
    if (![C, INDEX, MATRIX].includes(row.path))
      need(candidateTree.get(row.path) === oldTree.get(row.path), "IMMUTABLE_EVIDENCE_CHANGED");
  }
  const addedPaths = [...originals, PR776_RECORD_PATH];
  const oldIndex = JSON.parse(readRevision(read, root, p.ancestor, INDEX)),
    baseIndex = JSON.parse(readRevision(read, root, plan.baseSha, INDEX)),
    currentIndex = JSON.parse(readRevision(read, root, plan.candidateSha, INDEX)),
    indexByPath = new Map(currentIndex.records.map((row) => [row.path, row])),
    oldIndexPaths = new Set(oldIndex.records.map((row) => row.path));
  need(
    oldIndex.records.every((row) => same(indexByPath.get(row.path), row)) &&
      currentIndex.records.length === oldIndex.records.length + addedPaths.length &&
      exactPaths(
        currentIndex.records.filter((row) => !oldIndexPaths.has(row.path)).map((row) => row.path),
        addedPaths,
      ) &&
      addedPaths.every((file) =>
        same(
          indexByPath.get(file),
          baseIndex.records.find((row) => row.path === file),
        ),
      ),
    "INDEX_ADDITIONS_ONLY",
  );
  const lines = (revision) => readRevision(read, root, revision, MATRIX).toString().trimEnd().split(/\r?\n/u),
    oldLines = lines(p.ancestor),
    currentLines = lines(plan.candidateSha),
    oldSet = new Set(oldLines),
    currentSet = new Set(currentLines),
    additions = currentLines.filter((line) => !oldSet.has(line));
  need(
    currentLines.length === currentSet.size &&
      oldLines.every((line) => currentSet.has(line)) &&
      additions.length === addedPaths.length &&
      exactPaths(
        additions.map((line) => /^"([^"]+)"/u.exec(line)?.[1]),
        addedPaths,
      ),
    "MATRIX_ADDITIONS_ONLY",
  );
  const publishedCanonical = JSON.parse(readRevision(read, root, plan.candidateSha, C));
  const publishedReviewArtifactId = publishedCanonical.reviewArtifactId;
  need(
    publishedReviewArtifactId === undefined ||
      (Number.isSafeInteger(publishedReviewArtifactId) && publishedReviewArtifactId > 0),
    "PUBLISHED_REVIEW_ID_INVALID",
  );
  delete publishedCanonical.reviewArtifactId;
  need(same(publishedCanonical, canonical), "PUBLISHED_CANONICAL_CHANGED");
  return {
    canonical,
    capturedPlan,
    publishedReviewArtifactId,
    binding: {
      kind: p.kind,
      id: p.id,
      originalBaseSha: p.oldBase,
      currentBaseSha: plan.baseSha,
      originalSourceDigest: p.sourceDigest,
      currentSourceDigest: plan.sourceDigest,
      contractDigest: p.contractDigest,
      recordDigest: sha256(recordBytes),
      captureArtifactId: p.captureArtifactId,
      captureRunId: p.captureRunId,
      captureDigest: p.captureDigest,
      rawReviewSha256: p.reviewSha256,
      acceptedCanonicalSha256: p.canonicalSha256,
      additionalIndependentPasses: 0,
    },
  };
}
export function bindPR776ControllerReconciliation({ root, plan, prNumber, readGit }) {
  if (String(prNumber ?? "") !== "776" || !plan.applicable) return plan;
  const read = readGit ?? git;
  if (!read(root, ["ls-tree", "-z", plan.baseSha, "--", PR776_RECORD_PATH]).length) return plan;
  const result = inspect({ root, plan, readGit });
  return {
    ...plan,
    pr776ControllerReconciliation: {
      ...result.binding,
      originalCandidateSha: result.capturedPlan.candidateSha,
      originalCandidateTree: result.capturedPlan.candidateTree,
    },
  };
}
export function validatePR776ReviewedIdentity(plan, evidence, { root, readGit } = {}) {
  need(isPR776ControllerReconciliation(plan) && root, "BOUND_PLAN_REQUIRED");
  const result = inspect({ root, plan, readGit }),
    expected = {
      ...result.binding,
      originalCandidateSha: result.capturedPlan.candidateSha,
      originalCandidateTree: result.capturedPlan.candidateTree,
    };
  need(same(plan.pr776ControllerReconciliation, expected), "PLAN_BINDING_CHANGED");
  const { reviewArtifactId, ...original } = evidence;
  need(
    reviewArtifactId === undefined || (Number.isSafeInteger(reviewArtifactId) && reviewArtifactId > 0),
    "AUTHENTICATED_REVIEW_ID_REQUIRED",
  );
  need(same(original, result.canonical), "CANONICAL_DATA_CHANGED");
  need(
    result.publishedReviewArtifactId === undefined || result.publishedReviewArtifactId === reviewArtifactId,
    "PUBLISHED_REVIEW_ID_MISMATCH",
  );
  return true;
}
export function pr776HistoricalReviewedPlan(plan) {
  const { pr776ControllerReconciliation: binding, ...historical } = plan;
  need(binding?.kind === PR776_CONTROLLER.kind, "BOUND_PLAN_REQUIRED");
  return {
    ...historical,
    baseSha: PR776_CONTROLLER.oldBase,
    sourceDigest: PR776_CONTROLLER.sourceDigest,
    candidateSha: binding.originalCandidateSha,
    candidateTree: binding.originalCandidateTree,
  };
}
export function pr776ReviewedAdoption(plan) {
  return { pr776ControllerReconciliation: plan.pr776ControllerReconciliation, independentPassesAdded: 0 };
}
export function validatePR776TrustedCapture(plan, capture) {
  if (!isPR776ControllerReconciliation(plan)) return;
  const p = PR776_CONTROLLER,
    actual = capture.trustedArtifact;
  need(
    actual?.id === p.captureArtifactId &&
      actual.runId === p.captureRunId &&
      actual.runAttempt === 1 &&
      actual.digest === p.captureDigest &&
      capture.baseSha === p.oldBase &&
      capture.sourceDigest === p.sourceDigest &&
      capture.contractDigest === p.contractDigest,
    "TRUSTED_CAPTURE_CHANGED",
  );
}
export const pr776ReviewSubmissionBinding = (plan) =>
  isPR776ControllerReconciliation(plan) ? { pr776ControllerReconciliation: plan.pr776ControllerReconciliation } : {};
export function validatePR776ReviewSubmission(plan, review) {
  if (!isPR776ControllerReconciliation(plan)) return;
  need(
    same(review.pr776ControllerReconciliation, plan.pr776ControllerReconciliation),
    "NEW_REVIEW_CONTROLLER_BINDING_CHANGED",
  );
}

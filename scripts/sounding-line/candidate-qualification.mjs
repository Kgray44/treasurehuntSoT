/* Trusted-main planning and finalization for pre-merge Sounding Line candidates. */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

const sha = (value) => typeof value === "string" && /^[0-9a-f]{40}$/u.test(value);
const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const readJson = async (root, file) => JSON.parse(await readFile(path.join(root, file), "utf8"));
const normalize = (value) => value.replaceAll("\\", "/").replace(/^\.\//u, "");
const matches = (file, pattern) => {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/gu, "\\$&")
    .replaceAll("**", "\u0000")
    .replaceAll("*", "[^/]*")
    .replaceAll("\u0000", ".*");
  return new RegExp(`^${escaped}$`, "u").test(file);
};
const required = (value, code) => {
  if (!value) throw new Error(code);
  return value;
};

export async function loadTrustedAuthority(authorityRoot) {
  const [authorityIndex, registry, gates] = await Promise.all([
    readJson(authorityRoot, "testing/sounding-line-authority.json"),
    readJson(authorityRoot, "testing/generated/active-test-registry.json"),
    readJson(authorityRoot, "testing/release-gates.json"),
  ]);
  if (authorityIndex.currentAuthorityVersion !== "1.4.1") throw new Error("TRUSTED_AUTHORITY_V141_REQUIRED");
  if (authorityIndex.candidateQualification?.trustedAuthoritySource !== "PROTECTED_CURRENT_MAIN")
    throw new Error("TRUSTED_CANDIDATE_POLICY_REQUIRED");
  return { authorityIndex, registry, gates };
}

export function classifyCandidatePaths(authorityIndex, changedPaths) {
  const policy = authorityIndex.candidateQualification?.maintenance;
  if (!policy || policy.mode !== "FAIL_CLOSED_TRUSTED_MAIN_CLASSIFIER")
    throw new Error("TRUSTED_MAINTENANCE_CLASSIFIER_REQUIRED");
  const paths = [...new Set(changedPaths.map(normalize))].sort();
  if (!paths.length) throw new Error("CANDIDATE_CHANGED_PATHS_REQUIRED");
  const isEligible = (file) => policy.eligiblePathGlobs.some((pattern) => matches(file, pattern));
  const isRecord = (file) => policy.recordOnlyPathGlobs.some((pattern) => matches(file, pattern));
  const isProduct = (file) => policy.productPathGlobs.some((pattern) => matches(file, pattern));
  const eligible = paths.filter(isEligible);
  const product = paths.filter(isProduct);
  const unknown = paths.filter((file) => !isEligible(file) && !isRecord(file) && !isProduct(file));
  const record = paths.filter(isRecord);
  if (product.length && eligible.length)
    return { classification: "INELIGIBLE_MIXED_SCOPE", paths, eligible, product, record, unknown };
  if (eligible.length === paths.length)
    return { classification: "VERIFICATION_MAINTENANCE", paths, eligible, product, record, unknown };
  if (record.length === paths.length)
    return { classification: "RECORD_ONLY", paths, eligible, product, record, unknown };
  return { classification: "ORDINARY_CANDIDATE", paths, eligible, product, record, unknown };
}

const obligationsFor = (classification, changedPaths) => {
  const base = ["policy-static", "trusted-authority-isolation", "exact-tree-binding", "trusted-finalizer"];
  if (classification === "VERIFICATION_MAINTENANCE")
    return [
      ...base,
      "sounding-line-governance",
      "maintenance-classifier-adversarial",
      "planner-finalizer-binding",
      "workflow-topology",
      "stable-test-registry",
      "p34-retirement",
      ...(changedPaths.some((file) => file.startsWith(".github/workflows/")) ? ["workflow-topology-changed"] : []),
    ];
  if (classification === "ORDINARY_CANDIDATE") return [...base, "impact-selected-candidate-workers"];
  return base;
};

export async function createTrustedCandidatePlan({
  authorityRoot,
  candidateRoot,
  authoritySourceSha,
  authoritySourceTree,
  candidateHeadSha,
  candidateTreeSha,
  qualifiedBaseSha,
  predictedIntegrationTree = null,
  gate = "mainline",
  changedPaths,
}) {
  if (!sha(authoritySourceSha) || !sha(authoritySourceTree)) throw new Error("AUTHORITY_SOURCE_IDENTITY_INVALID");
  if (!sha(candidateHeadSha) || !sha(candidateTreeSha) || !sha(qualifiedBaseSha))
    throw new Error("CANDIDATE_SOURCE_IDENTITY_INVALID");
  if (authoritySourceSha === candidateHeadSha || authorityRoot === candidateRoot)
    throw new Error("CANDIDATE_CANNOT_PROVIDE_TRUSTED_AUTHORITY");
  if (predictedIntegrationTree !== null && !sha(predictedIntegrationTree)) throw new Error("PREDICTED_TREE_INVALID");
  if (!new Set(["mainline", "release-candidate"]).has(gate)) throw new Error("CANDIDATE_GATE_INVALID");
  const trusted = await loadTrustedAuthority(authorityRoot);
  const classification = classifyCandidatePaths(trusted.authorityIndex, changedPaths);
  if (classification.classification === "INELIGIBLE_MIXED_SCOPE") throw new Error("INELIGIBLE_MIXED_SCOPE");
  const candidateAuthority = await readJson(candidateRoot, "testing/sounding-line-authority.json");
  const obligations = obligationsFor(classification.classification, classification.paths);
  return {
    schemaVersion: "1.4.1",
    executionIdentity: classification.classification === "VERIFICATION_MAINTENANCE" ? "MAINTENANCE" : "CANDIDATE",
    candidateClassification: classification.classification,
    gate,
    authoritySource: {
      sha: authoritySourceSha,
      tree: authoritySourceTree,
      root: authorityRoot,
      authorityDigest: digest(trusted.authorityIndex),
      registryDigest: digest(trusted.registry),
      gatesDigest: digest(trusted.gates),
    },
    subjectCandidate: {
      headSha: candidateHeadSha,
      treeSha: candidateTreeSha,
      root: candidateRoot,
      qualifiedBaseSha,
      predictedIntegrationTree,
      candidateAuthorityDigest: digest(candidateAuthority),
    },
    changedPaths: classification.paths,
    unknownMaintenanceImpact: classification.unknown,
    obligations,
    planDigest: null,
  };
}

export function sealTrustedCandidatePlan(plan) {
  const sealed = { ...plan, planDigest: null };
  return { ...sealed, planDigest: digest(sealed) };
}

export function finalizeTrustedCandidatePlan({ plan, receipts }) {
  if (!plan || plan.planDigest !== sealTrustedCandidatePlan(plan).planDigest)
    return { decision: "MAINTENANCE_EVIDENCE_INVALID", reason: "PLAN_DIGEST_INVALID" };
  if (
    !plan.authoritySource?.sha ||
    !plan.subjectCandidate?.headSha ||
    plan.authoritySource.sha === plan.subjectCandidate.headSha
  )
    return { decision: "MAINTENANCE_EVIDENCE_INVALID", reason: "TRUSTED_AUTHORITY_IDENTITY_INVALID" };
  const expected = new Set(plan.obligations ?? []);
  const seen = new Set();
  for (const receipt of receipts ?? []) {
    if (!expected.has(receipt.obligationId) || seen.has(receipt.obligationId))
      return { decision: "MAINTENANCE_EVIDENCE_INVALID", reason: "RECEIPT_OBLIGATION_INVALID" };
    seen.add(receipt.obligationId);
    if (
      receipt.status !== "PASSED" ||
      receipt.authoritySourceSha !== plan.authoritySource.sha ||
      receipt.authoritySourceTree !== plan.authoritySource.tree ||
      receipt.candidateHeadSha !== plan.subjectCandidate.headSha ||
      receipt.candidateTreeSha !== plan.subjectCandidate.treeSha ||
      receipt.qualifiedBaseSha !== plan.subjectCandidate.qualifiedBaseSha
    )
      return { decision: "MAINTENANCE_EVIDENCE_INVALID", reason: "EXACT_CANDIDATE_BINDING_INVALID" };
  }
  if (seen.size !== expected.size)
    return {
      decision: plan.executionIdentity === "MAINTENANCE" ? "MAINTENANCE_INCOMPLETE" : "RELEASE_INCOMPLETE",
      reason: "MANDATORY_OBLIGATION_MISSING",
    };
  return {
    decision: plan.executionIdentity === "MAINTENANCE" ? "MAINTENANCE_GO" : "RELEASE_GO",
    authority: "SOUNDING_LINE_TRUSTED_MAIN_FINALIZER",
    candidateClassification: plan.candidateClassification,
    planDigest: plan.planDigest,
  };
}

export const requiredCandidateField = required;

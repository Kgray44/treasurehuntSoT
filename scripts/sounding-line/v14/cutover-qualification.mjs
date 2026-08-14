/*
 * Prompt 5 shadow-qualification controls.  These records are deliberately
 * nonauthoritative: they make omissions and fail-closed outcomes auditable,
 * but cannot emit RELEASE_GO or alter the current authority.
 */
import { sealedRecord } from "./fast-channel.mjs";

export const REQUIRED_SHADOW_CASES = Object.freeze([
  "record-only-documentation",
  "isolated-project-source",
  "cross-project-contract",
  "global-navigation-access",
  "authentication-authorization",
  "privacy-sensitive",
  "dependency-identity",
  "prisma-schema",
  "migration",
  "seed-fixture",
  "test-definition",
  "sounding-line-policy",
  "sounding-line-workflow-runtime",
  "mapped-conditional-suite",
  "unmapped-path",
  "contract-map-debt",
  "corrupt-evidence-receipt",
  "stale-evidence",
  "incompatible-legacy-receipt",
  "prepared-layer-corruption",
  "prepared-layer-revocation-expiry",
  "missing-cleanup-receipt",
  "surviving-mutable-resource",
  "candidate-head-mutation",
  "middle-train-car-mutation",
  "candidate-withdrawal",
  "merge-conflict",
  "migration-collision",
  "policy-drift-during-train",
  "external-main-advance",
  "same-tree-different-commit",
  "actual-tree-mismatch",
  "record-only-train-admission",
  "emergency-preemption-denial",
  "exhaustive-release-candidate",
]);

const POSITIVE_DECISIONS = new Set(["QUALIFIED", "V14_QUALIFIED", "RELEASE_GO"]);
const CONFIDENCES = new Set(["EXACT", "BOUNDED", "COARSE", "UNKNOWN"]);
const PRESERVATION_REASONS = new Set(["PRESERVED", "REBOUND", "INAPPLICABLE"]);
const CORRUPTION_CASES = new Set([
  "corrupt-evidence-receipt",
  "prepared-layer-corruption",
  "prepared-layer-revocation-expiry",
  "missing-cleanup-receipt",
  "surviving-mutable-resource",
  "actual-tree-mismatch",
]);

const assert = (condition, code) => {
  if (!condition) throw new Error(code);
};

const normalize = (values) => (Array.isArray(values) ? values : []);

function assessCase(entry) {
  assert(entry && typeof entry.id === "string", "V14_SHADOW_CASE_ID_REQUIRED");
  assert(entry.candidateIdentity && entry.changedInterval, `V14_SHADOW_IDENTITY_REQUIRED:${entry.id}`);
  assert(CONFIDENCES.has(entry.closureConfidence), `V14_SHADOW_CONFIDENCE_INVALID:${entry.id}`);
  assert(Array.isArray(entry.reasonLedger), `V14_SHADOW_REASON_LEDGER_REQUIRED:${entry.id}`);
  assert(entry.v13 && entry.v14, `V14_SHADOW_DUAL_DECISION_REQUIRED:${entry.id}`);

  const errors = [];
  const omitted = normalize(entry.v14.omittedObligations);
  for (const omission of omitted) {
    const reason = omission?.reason;
    if (!PRESERVATION_REASONS.has(reason)) errors.push("UNEXPLAINED_OMISSION");
    if (["PRESERVED", "REBOUND"].includes(reason) && !["EXACT", "BOUNDED"].includes(entry.closureConfidence))
      errors.push("UNSAFE_PRESERVATION_CONFIDENCE");
    if (!entry.reasonLedger.some((item) => item?.obligationId === omission?.obligationId && item?.reason === reason))
      errors.push("OMISSION_REASON_LEDGER_MISSING");
  }

  const fallback = normalize(entry.v14.fallbackObligations);
  if (entry.closureConfidence === "UNKNOWN" && fallback.length === 0) errors.push("UNKNOWN_NARROWED_PROOF");
  if (entry.id === "unmapped-path" || entry.id === "contract-map-debt") {
    if (fallback.length === 0) errors.push("CONSERVATIVE_FALLBACK_REQUIRED");
  }
  if (CORRUPTION_CASES.has(entry.id) && POSITIVE_DECISIONS.has(entry.v14.decision))
    errors.push("CORRUPTION_REACHED_POSITIVE_DECISION");
  if (entry.id === "exhaustive-release-candidate" && entry.v14.exhaustive !== true)
    errors.push("RELEASE_CANDIDATE_NOT_EXHAUSTIVE");

  const status = errors.length ? "UNSAFE" : fallback.length ? "CONSERVATIVE_FALLBACK" : "SAFE";
  return {
    id: entry.id,
    status,
    errors,
    fresh: normalize(entry.v14.freshObligations).length,
    preserved: normalize(entry.v14.preservedObligations).length,
    rebound: normalize(entry.v14.reboundObligations).length,
    fallback: fallback.length,
    omitted: omitted.length,
  };
}

export function qualifyShadowCorpus({ cases, candidateSha, qualifiedBaseSha, policyDigest, authorityDigest }) {
  assert(/^[0-9a-f]{40}$/u.test(candidateSha ?? ""), "V14_SHADOW_CANDIDATE_SHA_INVALID");
  assert(/^[0-9a-f]{40}$/u.test(qualifiedBaseSha ?? ""), "V14_SHADOW_BASE_SHA_INVALID");
  assert(policyDigest && authorityDigest, "V14_SHADOW_AUTHORITY_IDENTITIES_REQUIRED");
  const supplied = normalize(cases);
  const ids = supplied.map((entry) => entry?.id);
  assert(new Set(ids).size === ids.length, "V14_SHADOW_CASE_DUPLICATE");
  const missing = REQUIRED_SHADOW_CASES.filter((id) => !ids.includes(id));
  const unexpected = ids.filter((id) => !REQUIRED_SHADOW_CASES.includes(id));
  assert(missing.length === 0, `V14_SHADOW_CASES_MISSING:${missing.join(",")}`);
  assert(unexpected.length === 0, `V14_SHADOW_CASES_UNEXPECTED:${unexpected.join(",")}`);

  const results = supplied.map(assessCase);
  const counts = {
    corpusCases: results.length,
    safe: results.filter((result) => result.status === "SAFE").length,
    conservativeFallback: results.filter((result) => result.status === "CONSERVATIVE_FALLBACK").length,
    blocked: 0,
    unsafe: results.filter((result) => result.status === "UNSAFE").length,
  };
  return sealedRecord("shadow-qualification", {
    candidateSha,
    qualifiedBaseSha,
    policyDigest,
    authorityDigest,
    decision: counts.unsafe === 0 ? "V14_SHADOW_QUALIFIED" : "V14_SHADOW_NO_GO",
    counts,
    results,
  });
}

/**
 * Evaluate a governed rollback drill. This consumes observations and creates
 * an immutable audit record; it neither changes a ref nor enables v1.3.
 */
export function evaluateRollbackDrill({ candidateSha, qualifiedBaseSha, observations }) {
  assert(/^[0-9a-f]{40}$/u.test(candidateSha ?? ""), "V14_ROLLBACK_CANDIDATE_SHA_INVALID");
  assert(/^[0-9a-f]{40}$/u.test(qualifiedBaseSha ?? ""), "V14_ROLLBACK_BASE_SHA_INVALID");
  const requirements = [
    ["v14Disabled", "V14_DISABLE_NOT_PROVEN"],
    ["serialCurrentBaseFailClosed", "SERIAL_CURRENT_BASE_NOT_FAIL_CLOSED"],
    ["v13RejectsV14Evidence", "V13_ACCEPTED_V14_EVIDENCE"],
    ["staleV13RejectedForV14", "STALE_V13_EVIDENCE_ACCEPTED"],
    ["branchProtectionEnforced", "BRANCH_PROTECTION_NOT_PROVEN"],
    ["noForcePush", "FORCE_PUSH_DETECTED"],
    ["historyUnrewritten", "HISTORY_REWRITE_DETECTED"],
    ["receiptsRetained", "ROLLBACK_RECEIPTS_MISSING"],
    ["partialCarsBlocked", "PARTIAL_TRAIN_CAR_LANDED"],
    ["v13RejectsV14PreparedLayers", "V14_LAYER_IMPERSONATED_V13_EVIDENCE"],
  ];
  const failures = requirements.filter(([field]) => observations?.[field] !== true).map(([, failure]) => failure);
  return sealedRecord("rollback-drill", {
    candidateSha,
    qualifiedBaseSha,
    observations: observations ?? {},
    decision: failures.length === 0 ? "ROLLBACK_DRILL_PASS" : "ROLLBACK_DRILL_NO_GO",
    failures,
  });
}

const ADOPTION_DISPOSITIONS = new Set([
  "FRESH",
  "PRESERVED",
  "REBOUND",
  "INVALIDATED",
  "SUPERSEDED",
  "CONSERVATIVE_FALLBACK",
]);

/**
 * Normalize paused-fleet evidence adoption. A historical green result is not
 * a disposition: every preserved or rebound obligation must carry the exact
 * v1.4 reconstruction identities that make it usable.
 */
export function evaluatePausedFleetAdoption({ candidates, policyDigest, authorityDigest }) {
  assert(policyDigest && authorityDigest, "V14_FLEET_AUTHORITY_IDENTITIES_REQUIRED");
  const projects = normalize(candidates).map((candidate) => {
    assert(candidate?.project && candidate?.branch, "V14_FLEET_PROJECT_IDENTITY_REQUIRED");
    assert(/^[0-9a-f]{40}$/u.test(candidate.head ?? ""), `V14_FLEET_HEAD_INVALID:${candidate.project}`);
    const obligations = normalize(candidate.obligations);
    const errors = [];
    const normalized = obligations.map((obligation) => {
      assert(obligation?.id, `V14_FLEET_OBLIGATION_ID_REQUIRED:${candidate.project}`);
      assert(
        ADOPTION_DISPOSITIONS.has(obligation.disposition),
        `V14_FLEET_DISPOSITION_INVALID:${candidate.project}:${obligation.id}`,
      );
      const preserves = ["PRESERVED", "REBOUND"].includes(obligation.disposition);
      const exactIdentity =
        obligation.immutableIdentity?.candidateSha === candidate.head &&
        obligation.immutableIdentity?.policyDigest === policyDigest &&
        obligation.immutableIdentity?.authorityDigest === authorityDigest &&
        typeof obligation.immutableIdentity?.testDefinitionDigest === "string" &&
        typeof obligation.immutableIdentity?.fingerprintDigest === "string" &&
        obligation.currentMainImpact?.compatible === true;
      if (preserves && !exactIdentity) {
        errors.push(`UNRECONSTRUCTABLE_${obligation.disposition}:${obligation.id}`);
        return { ...obligation, disposition: "CONSERVATIVE_FALLBACK", reason: "IDENTITY_OR_INTERVAL_UNPROVEN" };
      }
      return obligation;
    });
    const count = (disposition) => normalized.filter((item) => item.disposition === disposition).map((item) => item.id);
    return {
      project: candidate.project,
      branch: candidate.branch,
      head: candidate.head,
      evidenceAvailable: candidate.evidenceAvailable === true,
      evidenceReconstructable: errors.length === 0 && candidate.evidenceAvailable === true,
      preservedObligations: count("PRESERVED"),
      reboundObligations: count("REBOUND"),
      freshRequiredObligations: count("FRESH"),
      invalidatedObligations: count("INVALIDATED"),
      fallbackObligations: count("CONSERVATIVE_FALLBACK"),
      supersededObligations: count("SUPERSEDED"),
      blockingReason: errors.length ? errors.join(",") : null,
      obligations: normalized,
    };
  });
  return sealedRecord("paused-fleet-adoption", {
    policyDigest,
    authorityDigest,
    decision: projects.some((project) => project.blockingReason)
      ? "FLEET_ADOPTION_PARTIAL"
      : "FLEET_ADOPTION_QUALIFIED",
    projects,
  });
}

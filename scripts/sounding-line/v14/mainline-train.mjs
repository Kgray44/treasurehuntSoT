/*
 * Sounding Line v1.4 mainline train state controller. It plans exact,
 * content-addressed integration trees for the live ordinary orchestration
 * path; protected binding remains the only physical merge authority.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createTreeIdentity, digest } from "./foundation.mjs";
import { sealedRecord } from "./fast-channel.mjs";
import { buildSyntheticIntegrationTree, inspectGitTree } from "./synthetic-tree.mjs";

export const V14_TRAIN_STATE_VERSION = "1.4";
export const V14_TRAIN_AUTHORITY_BOUNDARY = "V14_MAINLINE_TRAIN_LIVE";
export const TRAIN_CAR_STATES = Object.freeze([
  "ADMITTED",
  "PLANNING",
  "QUALIFIED",
  "HEAD_READY",
  "LANDING",
  "LANDED",
  "BLOCKED",
  "INVALIDATED",
  "WITHDRAWN",
  "SUPERSEDED",
  "REPLAN_REQUIRED",
]);
export const TRAIN_BRAKES = Object.freeze([
  "TREE_MISMATCH",
  "MISSING_ACTUAL_TREE",
  "STALE_LANDING_RECEIPT",
  "MERGE_METHOD_MISMATCH",
  "MERGE_CONFLICT",
  "MIGRATION_COLLISION",
  "POLICY_DRIFT",
  "AUTHORITY_DRIFT",
  "EVIDENCE_REVOKED",
  "UNKNOWN_MAIN_RELATIONSHIP",
  "HEAD_QUALIFICATION_FAILURE",
  "TAMPERED_STATE",
  "RECORD_ONLY_CLASSIFICATION_INVALID",
]);

const sha = (value) => typeof value === "string" && /^[0-9a-f]{40}$/u.test(value);
const required = (value, code) => {
  if (!value) throw new Error(code);
  return value;
};
const clone = (value) => JSON.parse(JSON.stringify(value));
const orderedCanonical = (value) => {
  if (Array.isArray(value)) return value.map(orderedCanonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, orderedCanonical(value[key])]),
    );
  return value;
};
const stateDigest = (state) => {
  const unsigned = { ...state };
  delete unsigned.trainDigest;
  return digest(JSON.stringify(orderedCanonical(unsigned)));
};
const normalizeTimestamp = (value, code) => {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) throw new Error(code);
  return value;
};
const priority = (candidate) => ({ EMERGENCY: 0, RECORD_ONLY: 1, NORMAL: 2 })[candidate.priorityClass ?? "NORMAL"] ?? 3;
const sortString = (left, right) => left.localeCompare(right, "en", { sensitivity: "variant", numeric: false });

function assertCandidate(candidate) {
  required(candidate?.candidateId, "TRAIN_CANDIDATE_ID_REQUIRED");
  if (!sha(candidate.headCommitSha) || !sha(candidate.headTreeSha))
    throw new Error("TRAIN_CANDIDATE_FROZEN_HEAD_REQUIRED");
  required(candidate.admissionPolicyIdentity, "TRAIN_ADMISSION_POLICY_REQUIRED");
  normalizeTimestamp(candidate.admittedAt, "TRAIN_ADMISSION_TIMESTAMP_REQUIRED");
  if (!Number.isInteger(candidate.admissionOrdinal) || candidate.admissionOrdinal < 0)
    throw new Error("TRAIN_ADMISSION_ORDINAL_REQUIRED");
  if (!Number.isInteger(candidate.ageCycles) || candidate.ageCycles < 0) throw new Error("TRAIN_AGE_REQUIRED");
  if (candidate.priorityClass === "RECORD_ONLY" && candidate.recordOnlyClassification?.valid !== true)
    throw new Error("RECORD_ONLY_CLASSIFICATION_INVALID");
  return candidate;
}

/** Stable ordering is driven solely by frozen, caller-supplied metadata. */
export function orderTrainCandidates(candidates = []) {
  const byId = new Map(candidates.map((candidate) => [assertCandidate(candidate).candidateId, candidate]));
  if (byId.size !== candidates.length) throw new Error("TRAIN_CANDIDATE_ID_DUPLICATE");
  const visit = (candidate, visiting = new Set(), complete = new Set(), output = []) => {
    if (complete.has(candidate.candidateId)) return output;
    if (visiting.has(candidate.candidateId)) throw new Error("TRAIN_DEPENDENCY_CYCLE");
    visiting.add(candidate.candidateId);
    for (const dependencyId of [...(candidate.dependsOn ?? [])].sort(sortString)) {
      const dependency = byId.get(dependencyId);
      if (!dependency) throw new Error("TRAIN_DEPENDENCY_UNKNOWN");
      visit(dependency, visiting, complete, output);
    }
    visiting.delete(candidate.candidateId);
    complete.add(candidate.candidateId);
    output.push(candidate);
    return output;
  };
  const orderedRoots = [...candidates].sort(
    (left, right) =>
      priority(left) - priority(right) ||
      right.ageCycles - left.ageCycles ||
      left.admissionOrdinal - right.admissionOrdinal ||
      sortString(left.candidateId, right.candidateId),
  );
  const output = [];
  for (const candidate of orderedRoots)
    visit(candidate, new Set(), new Set(output.map((item) => item.candidateId)), output);
  return output;
}

function decorateCar(candidate, index, generation) {
  return {
    carId: `${candidate.candidateId}@${candidate.headCommitSha}`,
    candidateId: candidate.candidateId,
    candidateHeadCommitSha: candidate.headCommitSha,
    candidateHeadTreeSha: candidate.headTreeSha,
    qualifiedBaseCommitSha: candidate.qualifiedBaseCommitSha ?? null,
    qualifiedBaseTreeSha: candidate.qualifiedBaseTreeSha ?? null,
    candidatePrIdentity: candidate.prIdentity ?? null,
    evidenceClosureIdentity: candidate.evidenceClosureIdentity ?? null,
    planIdentity: candidate.planIdentity ?? null,
    msesClosureIdentity: candidate.msesClosureIdentity ?? null,
    priorityClass: candidate.priorityClass ?? "NORMAL",
    ageCycles: candidate.ageCycles,
    admittedAt: candidate.admittedAt,
    admissionOrdinal: candidate.admissionOrdinal,
    recordOnlyClassification: candidate.recordOnlyClassification ?? null,
    migrations: clone(candidate.migrations ?? []),
    trainPosition: index,
    replanGeneration: generation,
    state: "ADMITTED",
    reason: "ADMITTED",
    predictedParentCommitSha: null,
    predictedParentTreeSha: null,
    predictedIntegrationTreeSha: null,
    predictedIntegrationCommitSha: null,
    actualLandedCommitSha: null,
    actualLandedTreeSha: null,
    conflict: null,
  };
}

export function createMainlineTrain({
  trainId,
  authorityIdentity,
  policyIdentity,
  admissionPolicyIdentity,
  mergeStrategyIdentity,
  actualMainCommitSha,
  actualMainTreeSha,
  candidates = [],
  createdAt,
}) {
  required(trainId, "TRAIN_ID_REQUIRED");
  required(authorityIdentity, "TRAIN_AUTHORITY_REQUIRED");
  required(policyIdentity, "TRAIN_POLICY_REQUIRED");
  required(admissionPolicyIdentity, "TRAIN_ADMISSION_POLICY_REQUIRED");
  required(mergeStrategyIdentity, "TRAIN_MERGE_STRATEGY_REQUIRED");
  if (!sha(actualMainCommitSha) || !sha(actualMainTreeSha)) throw new Error("TRAIN_ACTUAL_MAIN_IDENTITY_REQUIRED");
  normalizeTimestamp(createdAt, "TRAIN_CREATED_TIMESTAMP_REQUIRED");
  const ordered = orderTrainCandidates(candidates);
  const train = {
    version: V14_TRAIN_STATE_VERSION,
    authorityBoundary: V14_TRAIN_AUTHORITY_BOUNDARY,
    trainId,
    generation: 0,
    authorityIdentity,
    policyIdentity,
    admissionPolicyIdentity,
    mergeStrategyIdentity,
    actualMainCommitSha,
    actualMainTreeSha,
    createdAt,
    updatedAt: createdAt,
    cars: ordered.map((candidate, index) => decorateCar(candidate, index, 0)),
    headPosition: 0,
    status: "PLANNING",
    brakes: [],
    replans: [],
    admissions: ordered.map((candidate) => ({
      candidateId: candidate.candidateId,
      headCommitSha: candidate.headCommitSha,
      reason: "ADMITTED",
      admittedAt: candidate.admittedAt,
    })),
    audit: [],
  };
  return sealTrain(train);
}

/**
 * Admit immutable candidate heads and construct their real Git merge-tree
 * predictions in order. The commits are unreachable local artifacts only;
 * protected binding remains the sole operation that can land main.
 */
export async function admitLiveMainlineTrain({
  repoPath,
  trainId,
  authorityIdentity,
  policyIdentity,
  admissionPolicyIdentity,
  mergeStrategyIdentity,
  actualMainCommitSha,
  candidates,
  createdAt,
}) {
  const base = await inspectGitTree(repoPath, actualMainCommitSha);
  const resolvedCandidates = await Promise.all(
    candidates.map(async (candidate) => {
      const identity = await inspectGitTree(repoPath, candidate.headCommitSha);
      if (identity.treeSha !== candidate.headTreeSha) throw new Error("TRAIN_CANDIDATE_TREE_MISMATCH");
      return candidate;
    }),
  );
  const initial = createMainlineTrain({
    trainId,
    authorityIdentity,
    policyIdentity,
    admissionPolicyIdentity,
    mergeStrategyIdentity,
    actualMainCommitSha: base.commitSha,
    actualMainTreeSha: base.treeSha,
    candidates: resolvedCandidates,
    createdAt,
  });
  const migrationSafety = detectMigrationCollisions(initial.cars);
  if (!migrationSafety.safe) throw new Error("TRAIN_MIGRATION_COLLISION");
  const orderedHeads = initial.cars.map((car) => car.candidateHeadCommitSha);
  const predicted = await buildSyntheticIntegrationTree({
    repoPath,
    baseSha: base.commitSha,
    candidateShas: orderedHeads,
    trainId,
    policyDigest: policyIdentity,
    mergeStrategyIdentity,
    planDigest: "V14_MAINLINE_TRAIN",
    msesDigest: "V14_MSES_PENDING",
    authorityBoundary: V14_TRAIN_AUTHORITY_BOUNDARY,
  });
  if (predicted.status !== "READY") throw new Error("TRAIN_SYNTHETIC_INTEGRATION_CONFLICT");
  const planned = planMainlineTrain(initial, {
    timestamp: createdAt,
    integrate: ({ position }) => ({
      treeSha: predicted.cars[position].predictedIntegrationTreeSha,
      commitSha: predicted.cars[position].resultingIntegrationSha,
    }),
  });
  return { train: planned, predicted };
}

export function sealTrain(train) {
  const state = clone(train);
  return { ...state, trainDigest: stateDigest(state) };
}
export function verifyTrain(train) {
  if (!train || train.version !== V14_TRAIN_STATE_VERSION || train.authorityBoundary !== V14_TRAIN_AUTHORITY_BOUNDARY)
    return { valid: false, code: "TAMPERED_STATE" };
  return train.trainDigest === stateDigest(train) ? { valid: true } : { valid: false, code: "TAMPERED_STATE" };
}

function brake(train, { code, position, sourceEvidence = null, timestamp, detail = null }) {
  if (!TRAIN_BRAKES.includes(code)) throw new Error("TRAIN_BRAKE_UNKNOWN");
  const bounded = Math.max(0, Math.min(position, train.cars.length));
  const affected = train.cars.slice(bounded).map((car) => car.carId);
  train.brakes.push({
    code,
    position: bounded,
    sourceEvidence,
    affected,
    preservedPrefix: train.cars.slice(0, bounded).map((car) => car.carId),
    detail,
    timestamp,
  });
  for (const car of train.cars.slice(bounded))
    if (car.state !== "LANDED") {
      car.state = "BLOCKED";
      car.reason = code;
    }
  train.status = "BLOCKED";
  return train;
}

/** Plans exact content trees. `integrate` must be deterministic and never mutate a remote. */
export function planMainlineTrain(train, { integrate, timestamp }) {
  if (!verifyTrain(train).valid) throw new Error("TAMPERED_STATE");
  if (typeof integrate !== "function") throw new Error("TRAIN_INTEGRATOR_REQUIRED");
  normalizeTimestamp(timestamp, "TRAIN_UPDATE_TIMESTAMP_REQUIRED");
  const next = clone(train);
  let parentCommitSha = next.actualMainCommitSha;
  let parentTreeSha = next.actualMainTreeSha;
  for (let index = 0; index < next.cars.length; index += 1) {
    const car = next.cars[index];
    if (["WITHDRAWN", "SUPERSEDED", "LANDED"].includes(car.state)) continue;
    car.state = "PLANNING";
    const outcome = integrate({
      parentCommitSha,
      parentTreeSha,
      candidateCommitSha: car.candidateHeadCommitSha,
      candidateTreeSha: car.candidateHeadTreeSha,
      mergeStrategyIdentity: next.mergeStrategyIdentity,
      position: index,
    });
    if (!outcome || outcome.conflict || !sha(outcome.treeSha)) {
      car.conflict = {
        paths: [...(outcome?.conflictingPaths ?? [])].sort(sortString),
        ownership: outcome?.conflictOwnership ?? "UNCLASSIFIED",
      };
      brake(next, { code: "MERGE_CONFLICT", position: index, timestamp, detail: car.conflict });
      break;
    }
    car.predictedParentCommitSha = parentCommitSha;
    car.predictedParentTreeSha = parentTreeSha;
    car.predictedIntegrationTreeSha = outcome.treeSha;
    car.predictedIntegrationCommitSha = outcome.commitSha ?? null;
    car.treeIdentity = createTreeIdentity({
      candidateHeadSha: car.candidateHeadCommitSha,
      candidateTreeSha: car.candidateHeadTreeSha,
      predictedParentCommitSha: parentCommitSha,
      predictedParentTreeSha: parentTreeSha,
      predictedIntegrationTreeSha: outcome.treeSha,
      mergeStrategyIdentity: next.mergeStrategyIdentity,
      trainId: next.trainId,
      trainPosition: index,
    });
    car.state = "PLANNING";
    car.reason = "PREDICTED_TREE_READY_FOR_QUALIFICATION";
    parentCommitSha = outcome.commitSha ?? parentCommitSha;
    parentTreeSha = outcome.treeSha;
  }
  if (next.status !== "BLOCKED") {
    next.status = next.cars.length ? "PLANNING" : "EMPTY";
    next.headPosition = next.cars.findIndex((car) => car.state !== "LANDED");
  }
  next.updatedAt = timestamp;
  return sealTrain(next);
}

/**
 * Binds one exact V14_CANDIDATE finalization to the car's predicted tree.
 * Planning alone is never a qualification claim: the finalizer's RELEASE_GO
 * and the exact candidate/base/tree identities are all required first.
 */
export function qualifyTrainCar(
  train,
  { candidateId, plan, finalization, evidenceClosureIdentity, timestamp },
) {
  if (!verifyTrain(train).valid) throw new Error("TAMPERED_STATE");
  normalizeTimestamp(timestamp, "TRAIN_UPDATE_TIMESTAMP_REQUIRED");
  const next = clone(train);
  const car = next.cars.find((entry) => entry.candidateId === candidateId);
  if (!car || car.state !== "PLANNING") throw new Error("TRAIN_CAR_NOT_READY_FOR_QUALIFICATION");
  if (
    plan?.authorityBoundary !== "V14_CANDIDATE_QUALIFICATION" ||
    plan?.authorityMode !== "V14_CANDIDATE" ||
    plan?.gate !== "mainline" ||
    plan?.sourceSha !== car.candidateHeadCommitSha ||
    plan?.qualifiedBaseSha !== car.predictedParentCommitSha ||
    plan?.qualifiedBaseTreeSha !== car.predictedParentTreeSha ||
    plan?.predictedIntegrationTreeSha !== car.predictedIntegrationTreeSha ||
    !plan?.planDigest ||
    finalization?.decision !== "RELEASE_GO" ||
    finalization?.planDigest !== plan.planDigest ||
    !evidenceClosureIdentity
  )
    throw new Error("TRAIN_QUALIFICATION_IDENTITY_MISMATCH");
  car.state = "QUALIFIED";
  car.reason = "V14_CANDIDATE_RELEASE_GO";
  car.evidenceClosureIdentity = evidenceClosureIdentity;
  car.planIdentity = plan.planDigest;
  car.msesClosureIdentity = plan.semanticPlanDigest ?? car.msesClosureIdentity;
  next.status = "QUALIFIED";
  next.updatedAt = timestamp;
  next.audit.push({ kind: "QUALIFIED", candidateId, planDigest: plan.planDigest, timestamp });
  return sealTrain(next);
}

const transitions = Object.freeze({
  ADMITTED: ["PLANNING", "WITHDRAWN", "SUPERSEDED", "INVALIDATED"],
  PLANNING: ["QUALIFIED", "BLOCKED", "INVALIDATED"],
  QUALIFIED: ["HEAD_READY", "REPLAN_REQUIRED", "INVALIDATED", "WITHDRAWN", "SUPERSEDED", "BLOCKED"],
  HEAD_READY: ["LANDING", "REPLAN_REQUIRED", "INVALIDATED", "BLOCKED"],
  LANDING: ["LANDED", "BLOCKED"],
  BLOCKED: ["REPLAN_REQUIRED", "INVALIDATED", "WITHDRAWN", "SUPERSEDED"],
  REPLAN_REQUIRED: ["PLANNING", "INVALIDATED", "WITHDRAWN", "SUPERSEDED"],
  INVALIDATED: ["REPLAN_REQUIRED", "SUPERSEDED", "WITHDRAWN"],
  WITHDRAWN: [],
  SUPERSEDED: [],
  LANDED: [],
});

export function transitionTrainCar(train, { position, to, timestamp }) {
  if (!verifyTrain(train).valid) throw new Error("TAMPERED_STATE");
  normalizeTimestamp(timestamp, "TRAIN_UPDATE_TIMESTAMP_REQUIRED");
  const next = clone(train);
  const car = next.cars[position];
  if (!car || !TRAIN_CAR_STATES.includes(to) || !transitions[car.state].includes(to))
    throw new Error("TRAIN_STATE_TRANSITION_INVALID");
  if (["HEAD_READY", "LANDING"].includes(to) && position !== next.headPosition)
    throw new Error("TRAIN_HEAD_ONLY_TRANSITION");
  car.state = to;
  car.reason = to;
  next.updatedAt = timestamp;
  return sealTrain(next);
}

function replan(train, { earliestPosition, cause, timestamp, replacement = null, remove = false, integrate }) {
  if (!verifyTrain(train).valid) throw new Error("TAMPERED_STATE");
  normalizeTimestamp(timestamp, "TRAIN_UPDATE_TIMESTAMP_REQUIRED");
  const next = clone(train);
  const oldGeneration = next.generation;
  const position = Math.max(0, earliestPosition);
  const oldSuffix = next.cars.slice(position);
  const prefix = next.cars.slice(0, position);
  let candidateCars = oldSuffix.map((car) => ({
    candidateId: car.candidateId,
    headCommitSha: car.candidateHeadCommitSha,
    headTreeSha: car.candidateHeadTreeSha,
    admissionPolicyIdentity: next.admissionPolicyIdentity,
    admittedAt: car.admittedAt,
    admissionOrdinal: car.admissionOrdinal,
    ageCycles: car.ageCycles,
    priorityClass: car.priorityClass,
    recordOnlyClassification: car.recordOnlyClassification,
    migrations: car.migrations,
    evidenceClosureIdentity: car.evidenceClosureIdentity,
    planIdentity: car.planIdentity,
    msesClosureIdentity: car.msesClosureIdentity,
    prIdentity: car.candidatePrIdentity,
  }));
  if (remove) candidateCars = candidateCars.slice(1);
  if (replacement) candidateCars = [replacement, ...candidateCars.slice(1)];
  for (const car of oldSuffix) {
    car.state = replacement && car.candidateId === replacement.candidateId ? "SUPERSEDED" : "INVALIDATED";
    car.reason = cause;
  }
  next.generation += 1;
  next.cars = [
    ...prefix,
    ...candidateCars.map((candidate, offset) => decorateCar(candidate, position + offset, next.generation)),
  ];
  next.headPosition = next.cars.findIndex((car) => car.state !== "LANDED");
  next.replans.push({
    cause,
    earliestAffectedPosition: position,
    preservedPrefix: prefix.map((car) => car.carId),
    invalidatedSuffix: oldSuffix.map((car) => car.carId),
    oldGeneration,
    newGeneration: next.generation,
    oldPredictedTrees: oldSuffix.map((car) => car.predictedIntegrationTreeSha),
    newPredictedTrees: [],
    evidenceDispositions: oldSuffix.map((car) => ({
      carId: car.carId,
      disposition:
        car.predictedParentTreeSha === (prefix.at(-1)?.predictedIntegrationTreeSha ?? next.actualMainTreeSha)
          ? "PRESERVED"
          : "INVALIDATED",
    })),
    timestamp,
  });
  next.audit.push({ kind: "REPLAN", cause, timestamp, position });
  next.status = "PLANNING";
  next.updatedAt = timestamp;
  const sealed = sealTrain(next);
  if (!integrate) return sealed;
  const planned = planMainlineTrain(sealed, { integrate, timestamp });
  planned.replans.at(-1).newPredictedTrees = planned.cars.slice(position).map((car) => car.predictedIntegrationTreeSha);
  return sealTrain(planned);
}

export function mutateTrainCandidate(train, { candidateId, replacement, timestamp, integrate }) {
  const position = train.cars.findIndex((car) => car.candidateId === candidateId);
  if (position < 0) throw new Error("TRAIN_CANDIDATE_UNKNOWN");
  assertCandidate(replacement);
  if (
    replacement.candidateId !== candidateId ||
    replacement.headCommitSha === train.cars[position].candidateHeadCommitSha
  )
    throw new Error("TRAIN_MUTATION_IDENTITY_INVALID");
  return replan(train, { earliestPosition: position, cause: "CANDIDATE_MUTATED", replacement, timestamp, integrate });
}
export function withdrawTrainCandidate(train, { candidateId, timestamp, integrate }) {
  const position = train.cars.findIndex((car) => car.candidateId === candidateId);
  if (position < 0) throw new Error("TRAIN_CANDIDATE_UNKNOWN");
  if (train.cars[position].state === "LANDED") throw new Error("TRAIN_LANDED_CAR_WITHDRAWAL_DENIED");
  return replan(train, {
    earliestPosition: position,
    cause: "CANDIDATE_WITHDRAWN",
    remove: true,
    timestamp,
    integrate,
  });
}
export function revokeTrainEvidence(train, { candidateId, evidenceIdentity, timestamp }) {
  const position = train.cars.findIndex((car) => car.candidateId === candidateId);
  if (position < 0) throw new Error("TRAIN_CANDIDATE_UNKNOWN");
  const next = clone(train);
  brake(next, { code: "EVIDENCE_REVOKED", position, sourceEvidence: evidenceIdentity, timestamp });
  next.updatedAt = timestamp;
  return sealTrain(next);
}
export function applyPolicyDrift(
  train,
  { policyIdentity, authorityIdentity = train.authorityIdentity, earliestPosition = 0, timestamp },
) {
  const next = clone(train);
  const code = authorityIdentity !== next.authorityIdentity ? "AUTHORITY_DRIFT" : "POLICY_DRIFT";
  next.policyIdentity = policyIdentity;
  next.authorityIdentity = authorityIdentity;
  brake(next, { code, position: earliestPosition, timestamp });
  next.updatedAt = timestamp;
  return sealTrain(next);
}
export function reconcileExternalMain(
  train,
  { actualMainCommitSha, actualMainTreeSha, earliestAffectedPosition = null, timestamp, integrate },
) {
  if (!sha(actualMainCommitSha) || !sha(actualMainTreeSha)) throw new Error("TRAIN_ACTUAL_MAIN_IDENTITY_REQUIRED");
  const matching = train.cars.findIndex((car) => car.predictedIntegrationTreeSha === actualMainTreeSha);
  const next = clone(train);
  next.actualMainCommitSha = actualMainCommitSha;
  next.actualMainTreeSha = actualMainTreeSha;
  if (matching >= 0) {
    for (let index = 0; index <= matching; index += 1) {
      next.cars[index].state = "LANDED";
      next.cars[index].actualLandedCommitSha =
        index === matching ? actualMainCommitSha : next.cars[index].actualLandedCommitSha;
      next.cars[index].actualLandedTreeSha =
        index === matching ? actualMainTreeSha : next.cars[index].predictedIntegrationTreeSha;
    }
    return replan(sealTrain(next), {
      earliestPosition: matching + 1,
      cause: "EXTERNAL_MAIN_MATCHED_PREDICTION",
      timestamp,
      integrate,
    });
  }
  // A caller that has completed the governed semantic comparison may retain a
  // proven-unaffected prefix. Without that proof, failing closed at zero is
  // intentional: unknown main movement cannot preserve evidence by wish.
  const earliest =
    Number.isInteger(earliestAffectedPosition) &&
    earliestAffectedPosition >= 0 &&
    earliestAffectedPosition < next.cars.length
      ? earliestAffectedPosition
      : 0;
  return replan(sealTrain(next), {
    earliestPosition: earliest,
    cause: earliest ? "EXTERNAL_MAIN_AFFECTED_SUFFIX" : "EXTERNAL_MAIN_UNEXPECTED",
    timestamp,
    integrate,
  });
}

export function compareLandedTree(
  train,
  {
    position,
    actualLandedCommitSha,
    actualLandedTreeSha,
    mergeStrategyIdentity,
    timestamp,
    generation = train.generation,
  },
) {
  if (!verifyTrain(train).valid) throw new Error("TAMPERED_STATE");
  const car = train.cars[position];
  normalizeTimestamp(timestamp, "TRAIN_UPDATE_TIMESTAMP_REQUIRED");
  let result = "MATCH";
  let code = null;
  if (generation !== train.generation) {
    result = "BRAKE";
    code = "STALE_LANDING_RECEIPT";
  } else if (!sha(actualLandedCommitSha) || !sha(actualLandedTreeSha)) {
    result = "BRAKE";
    code = "MISSING_ACTUAL_TREE";
  } else if (mergeStrategyIdentity !== train.mergeStrategyIdentity) {
    result = "BRAKE";
    code = "MERGE_METHOD_MISMATCH";
  } else if (!car || car.predictedIntegrationTreeSha !== actualLandedTreeSha) {
    result = "BRAKE";
    code = "TREE_MISMATCH";
  }
  const receipt = sealedRecord("landed-tree-comparison", {
    trainId: train.trainId,
    generation,
    carIdentity: car?.carId ?? null,
    candidateHead: car?.candidateHeadCommitSha ?? null,
    predictedParent: car?.predictedParentCommitSha ?? null,
    predictedTree: car?.predictedIntegrationTreeSha ?? null,
    actualLandedCommitSha: actualLandedCommitSha ?? null,
    actualLandedTreeSha: actualLandedTreeSha ?? null,
    mergeStrategyIdentity,
    result,
    code,
    authorityIdentity: train.authorityIdentity,
    policyIdentity: train.policyIdentity,
    timestamp,
  });
  return { result, code, receipt, authorityBoundary: V14_TRAIN_AUTHORITY_BOUNDARY };
}

/** Head-only live landing: compare actual protected-main tree, then replan only its suffix. */
export function landTrainHead(
  train,
  { actualLandedCommitSha, actualLandedTreeSha, mergeStrategyIdentity, timestamp, integrate },
) {
  const position = train.headPosition;
  if (position < 0 || train.cars[position]?.state !== "HEAD_READY") throw new Error("TRAIN_HEAD_NOT_READY");
  const landing = transitionTrainCar(train, { position, to: "LANDING", timestamp });
  const comparison = compareLandedTree(landing, {
    position,
    actualLandedCommitSha,
    actualLandedTreeSha,
    mergeStrategyIdentity,
    timestamp,
  });
  if (comparison.result !== "MATCH") {
    const next = clone(landing);
    brake(next, { code: comparison.code, position, timestamp, sourceEvidence: comparison.receipt.id });
    return { train: sealTrain(next), comparison };
  }
  return {
    train: reconcileExternalMain(landing, {
      actualMainCommitSha: actualLandedCommitSha,
      actualMainTreeSha: actualLandedTreeSha,
      timestamp,
      integrate,
    }),
    comparison,
  };
}

export function preemptTrain(train, { emergencyCandidate, timestamp, integrate }) {
  assertCandidate(emergencyCandidate);
  if (emergencyCandidate.priorityClass !== "EMERGENCY") throw new Error("TRAIN_EMERGENCY_CLASS_REQUIRED");
  const insertion = train.cars.findIndex((car) => car.state !== "LANDED");
  const next = clone(train);
  const position = insertion < 0 ? train.cars.length : insertion;
  const suffix = next.cars.slice(position).map((car) => ({
    candidateId: car.candidateId,
    headCommitSha: car.candidateHeadCommitSha,
    headTreeSha: car.candidateHeadTreeSha,
    admissionPolicyIdentity: next.admissionPolicyIdentity,
    admittedAt: car.admittedAt,
    admissionOrdinal: car.admissionOrdinal,
    ageCycles: car.ageCycles,
    priorityClass: car.priorityClass,
    recordOnlyClassification: car.recordOnlyClassification,
  }));
  next.cars = [
    ...next.cars.slice(0, position),
    decorateCar(emergencyCandidate, position, next.generation),
    ...suffix.map((candidate, offset) => decorateCar(candidate, position + offset + 1, next.generation)),
  ];
  const replanned = replan(sealTrain(next), {
    earliestPosition: position,
    cause: "EMERGENCY_PREEMPTION",
    timestamp,
    integrate,
  });
  replanned.audit.push({
    kind: "EMERGENCY_PREEMPTION",
    candidateId: emergencyCandidate.candidateId,
    timestamp,
    authorized: false,
  });
  return sealTrain(replanned);
}

export function detectMigrationCollisions(cars = []) {
  const seen = new Map();
  const collisions = [];
  for (const car of cars)
    for (const migration of car.migrations ?? []) {
      const key = migration.id ?? migration.path;
      if (!key) return { safe: false, code: "MIGRATION_IDENTITY_MISSING", collisions: [] };
      if (seen.has(key)) collisions.push({ key, cars: [seen.get(key), car.candidateId] });
      else seen.set(key, car.candidateId);
    }
  return collisions.length
    ? { safe: false, code: "MIGRATION_COLLISION", collisions }
    : { safe: true, code: "MIGRATION_SAFE", collisions: [] };
}

export function evaluateTrainMigrations(train, { timestamp }) {
  if (!verifyTrain(train).valid) throw new Error("TAMPERED_STATE");
  normalizeTimestamp(timestamp, "TRAIN_UPDATE_TIMESTAMP_REQUIRED");
  const result = detectMigrationCollisions(train.cars);
  if (result.safe) return { train, result };
  const candidates = result.collisions.flatMap((collision) => collision.cars);
  const position = Math.min(
    ...candidates.map((candidateId) => train.cars.findIndex((car) => car.candidateId === candidateId)),
  );
  const next = clone(train);
  brake(next, { code: "MIGRATION_COLLISION", position, timestamp, detail: result });
  next.updatedAt = timestamp;
  return { train: sealTrain(next), result };
}

const sealOrderedStateRecord = (train) => {
  const unsigned = { version: V14_TRAIN_STATE_VERSION, kind: "mainline-train-state", immutable: true, train };
  return { ...unsigned, digest: digest(JSON.stringify(orderedCanonical(unsigned))) };
};
const verifyOrderedStateRecord = (record) => {
  if (
    !record ||
    record.version !== V14_TRAIN_STATE_VERSION ||
    record.kind !== "mainline-train-state" ||
    record.immutable !== true
  )
    return false;
  const unsigned = { ...record };
  delete unsigned.digest;
  return record.digest === digest(JSON.stringify(orderedCanonical(unsigned)));
};

export async function persistTrainState(root, train) {
  const check = verifyTrain(train);
  if (!check.valid) throw new Error(check.code);
  await mkdir(root, { recursive: true });
  const record = sealOrderedStateRecord(train);
  const file = path.join(root, `${train.trainId}.${train.generation}.json`);
  await writeFile(file, `${JSON.stringify(record)}\n`, "utf8");
  return { file, record };
}
export async function loadTrainState(file) {
  const record = JSON.parse(await readFile(file, "utf8"));
  if (!verifyOrderedStateRecord(record) || !verifyTrain(record.train).valid) throw new Error("TAMPERED_STATE");
  return record.train;
}

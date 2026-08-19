/* Select one sealed authority-maintenance decision from a trusted-main dispatch. */
import { readFile } from "node:fs/promises";

const sha = (value) => typeof value === "string" && /^[0-9a-f]{40}$/u.test(value);

const envelopeIdentity = (envelope) =>
  [
    envelope?.prNumber,
    envelope?.candidateSha,
    envelope?.qualifiedBaseSha,
    envelope?.qualifiedBaseTreeSha,
    envelope?.planDigest,
    envelope?.policyDigest,
    envelope?.inventoryDigest,
    envelope?.authorityDigest,
    envelope?.evidenceDigest,
    envelope?.mandatoryReceiptCount,
  ].join(":");

const validEnvelope = (envelope, run) =>
  envelope?.version === 1 &&
  envelope?.authority === "SOUNDING_LINE_ACCEPTANCE_ENVELOPE" &&
  envelope?.authoritativeRunId === Number(run?.id) &&
  Number.isSafeInteger(envelope?.prNumber) &&
  envelope.prNumber > 0 &&
  envelope?.gate === "mainline" &&
  envelope?.finalizerAuthority === "SOUNDING_LINE_FINALIZER" &&
  envelope?.finalizerDecision === "RELEASE_GO" &&
  [
    envelope?.candidateSha,
    envelope?.qualifiedBaseSha,
    envelope?.qualifiedBaseTreeSha,
    envelope?.planDigest,
    envelope?.policyDigest,
    envelope?.inventoryDigest,
    envelope?.authorityDigest,
    envelope?.evidenceDigest,
  ].every(sha) &&
  Number.isSafeInteger(envelope?.mandatoryReceiptCount) &&
  envelope.mandatoryReceiptCount > 0 &&
  run?.event === "workflow_dispatch" &&
  run?.status === "completed" &&
  run?.conclusion === "success" &&
  run?.revoked !== true &&
  envelope?.revoked !== true;

const directAuthority = (candidate) =>
  candidate?.artifact === "sounding-line-acceptance-envelope" &&
  candidate?.run?.name === "Sounding Line authoritative" &&
  candidate?.run?.path === ".github/workflows/sounding-line-authoritative.yml";

const trainAuthority = (candidate) =>
  typeof candidate?.artifact === "string" &&
  candidate.artifact.startsWith("sounding-line-train-acceptance-envelope-") &&
  candidate?.run?.name === "Sounding Line mainline train" &&
  candidate?.run?.path === ".github/workflows/sounding-line-mainline-train.yml";

const distinctLineages = (candidates, key) => [
  ...candidates
    .reduce((lineages, candidate) => {
      const identity = key(candidate);
      const existing = lineages.get(identity);
      if (!existing || Number(candidate.run.id) < Number(existing.run.id)) lineages.set(identity, candidate);
      return lineages;
    }, new Map())
    .values(),
];

/**
 * Select the sole active ordinary-release authority lineage.  Historical
 * envelopes remain visible in the input; only identities tied to the current
 * PR head/base or its exact governed train rebind are eligible.
 */
export function selectSealedActiveAuthority({ candidates, prNumber, candidateSha, candidateTree, currentBaseSha }) {
  const identityValid = [candidateSha, candidateTree, currentBaseSha].every(sha) && Number.isSafeInteger(prNumber);
  const historical = [];
  const direct = [];
  const train = [];

  for (const candidate of candidates ?? []) {
    const envelope = candidate?.envelope;
    if (!validEnvelope(envelope, candidate?.run) || candidate?.expired === true) {
      historical.push({ candidate, reason: "INVALID_OR_REVOKED" });
      continue;
    }
    if (envelope.prNumber !== prNumber) {
      historical.push({ candidate, reason: "OTHER_PR" });
      continue;
    }
    if (directAuthority(candidate)) {
      if (envelope.candidateSha !== candidateSha) historical.push({ candidate, reason: "SUPERSEDED_CANDIDATE_HEAD" });
      else direct.push(candidate);
      continue;
    }
    if (trainAuthority(candidate)) {
      const plan = candidate.plan;
      if (
        plan?.sourceSha !== envelope.candidateSha ||
        plan?.authorityVersion !== "1.4" ||
        plan?.authorityBoundary !== "V14_CANDIDATE_QUALIFICATION" ||
        plan?.predictedIntegrationTreeSha !== candidateTree
      )
        historical.push({ candidate, reason: "STALE_OR_INVALID_TRAIN_REBIND" });
      else train.push(candidate);
      continue;
    }
    historical.push({ candidate, reason: "UNTRUSTED_AUTHORITY_SOURCE" });
  }

  const select = (mode, lineages) => {
    const [selected] = lineages;
    return {
      authority: "SOUNDING_LINE_ACTIVE_AUTHORITY_SELECTION",
      decision:
        identityValid && lineages.length === 1 ? "ACTIVE_AUTHORITY_SELECTED" : "SEALED_EXPLICIT_AUTHORITY_NOT_UNIQUE",
      selectedRunId: lineages.length === 1 ? Number(selected.run.id) : null,
      selectedArtifact: lineages.length === 1 ? selected.artifact : null,
      selectedMode: lineages.length === 1 ? mode : null,
      originalCandidateSha: lineages.length === 1 && mode === "TRAIN_REBIND" ? selected.envelope.candidateSha : null,
      eligibleRunIds: lineages.map((candidate) => Number(candidate.run.id)).sort((left, right) => left - right),
      historicalCount: historical.length,
    };
  };

  const exactDirect = distinctLineages(
    direct.filter((candidate) => candidate.envelope.qualifiedBaseSha === currentBaseSha),
    (candidate) => envelopeIdentity(candidate.envelope),
  );
  if (exactDirect.length) return select("EXACT_CANDIDATE_BASE", exactDirect);

  const activeTrain = distinctLineages(
    train,
    (candidate) => `${envelopeIdentity(candidate.envelope)}:${candidate.plan.predictedIntegrationTreeSha}`,
  );
  if (activeTrain.length) return select("TRAIN_REBIND", activeTrain);

  const carryForward = distinctLineages(direct, (candidate) => envelopeIdentity(candidate.envelope));
  return select("SEMANTIC_CARRY_FORWARD", carryForward);
}

export function selectSealedAuthorityMaintenance({ runs, candidateSha, candidateTree, qualifiedBaseSha }) {
  const eligible = (runs ?? []).filter((run) => {
    const plan = run?.plan;
    const finalization = run?.finalization;
    return (
      run?.name === "Sounding Line authority maintenance" &&
      run?.path === ".github/workflows/sounding-line-authority-maintenance.yml" &&
      run?.event === "workflow_dispatch" &&
      run?.status === "completed" &&
      run?.conclusion === "success" &&
      // The trusted policy and classifier always come from qualified main.
      // A sealed maintenance run may execute that unchanged workflow at the
      // protected base or the frozen candidate ref, so both heads are bound.
      [qualifiedBaseSha, candidateSha].includes(run?.headSha) &&
      plan?.authority === "SOUNDING_LINE_AUTHORITY_MAINTENANCE" &&
      plan?.disposition === "AUTHORITY_MAINTENANCE_GO" &&
      plan?.candidateSha === candidateSha &&
      plan?.candidateTree === candidateTree &&
      plan?.qualifiedBaseSha === qualifiedBaseSha &&
      plan?.trustedMainSha === qualifiedBaseSha &&
      plan?.ownerAuthorized === true &&
      plan?.classification?.classification === "SOUNDING_LINE_AUTHORITY_MAINTENANCE" &&
      !plan?.classification?.errors?.length &&
      finalization?.authority === "SOUNDING_LINE_AUTHORITY_MAINTENANCE_FINALIZER" &&
      finalization?.decision === "AUTHORITY_MAINTENANCE_GO" &&
      finalization?.planDigest === plan?.planDigest
    );
  });
  // A retried trusted-main dispatch can seal the same immutable authority
  // proof more than once. Collapse only exact plan lineages; distinct plans
  // for the same candidate remain ambiguous and fail closed.
  const lineages = [
    ...eligible
      .reduce((byIdentity, run) => {
        const identity = [
          run.plan.candidateSha,
          run.plan.candidateTree,
          run.plan.qualifiedBaseSha,
          run.plan.trustedMainSha,
          run.plan.planDigest,
          run.finalization.planDigest,
        ].join(":");
        const existing = byIdentity.get(identity);
        if (!existing || Number(run.id) < Number(existing.id)) byIdentity.set(identity, run);
        return byIdentity;
      }, new Map())
      .values(),
  ];
  const identityValid = [candidateSha, candidateTree, qualifiedBaseSha].every(sha);
  return {
    authority: "SOUNDING_LINE_AUTHORITY_MAINTENANCE_SELECTION",
    decision:
      identityValid && lineages.length === 1
        ? "AUTHORITY_MAINTENANCE_AUTHORITY_SELECTED"
        : "SEALED_AUTHORITY_MAINTENANCE_AUTHORITY_NOT_UNIQUE",
    selectedRunId: lineages.length === 1 ? lineages[0].id : null,
    eligibleRunIds: lineages.map((run) => run.id).sort((left, right) => Number(left) - Number(right)),
  };
}

if (process.argv[1] && new URL(`file://${process.argv[1]}`).href === import.meta.url) {
  const active = process.argv[2] === "select-active";
  const result = (active ? selectSealedActiveAuthority : selectSealedAuthorityMaintenance)(
    JSON.parse(await readFile(process.argv[active ? 3 : 2], "utf8")),
  );
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = ["AUTHORITY_MAINTENANCE_AUTHORITY_SELECTED", "ACTIVE_AUTHORITY_SELECTED"].includes(result.decision)
    ? 0
    : 1;
}

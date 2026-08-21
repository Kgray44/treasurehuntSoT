/* Select one sealed MAINTENANCE_GO from a trusted-main workflow dispatch. */
import { readFile } from "node:fs/promises";

const sha = (value) => typeof value === "string" && /^[0-9a-f]{40}$/u.test(value);

export function selectSealedMaintenanceAuthority({ runs, candidateSha, candidateTree, qualifiedBaseSha }) {
  const selected = (runs ?? []).filter((run) => {
    const plan = run?.plan;
    const finalization = run?.finalization;
    return (
      run?.name === "Sounding Line verification maintenance" &&
      run?.path === ".github/workflows/sounding-line-verification-maintenance.yml" &&
      run?.event === "workflow_dispatch" &&
      run?.status === "completed" &&
      run?.conclusion === "success" &&
      run?.headSha === candidateSha &&
      plan?.authority === "SOUNDING_LINE_VERIFICATION_MAINTENANCE" &&
      plan?.disposition === "MAINTENANCE_GO" &&
      plan?.candidateSha === candidateSha &&
      plan?.candidateTree === candidateTree &&
      plan?.qualifiedBaseSha === qualifiedBaseSha &&
      plan?.trustedMainSha === qualifiedBaseSha &&
      plan?.classification?.classification === "VERIFICATION_MAINTENANCE" &&
      !plan?.classification?.errors?.length &&
      finalization?.authority === "SOUNDING_LINE_VERIFICATION_MAINTENANCE_FINALIZER" &&
      finalization?.decision === "MAINTENANCE_GO" &&
      finalization?.planDigest === plan?.planDigest
    );
  });
  // A retried trusted-main dispatch can seal the same immutable maintenance
  // proof more than once. Collapse only exact plan lineages; distinct plans
  // for the same candidate remain ambiguous and fail closed.
  const lineages = [
    ...selected
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
    authority: "SOUNDING_LINE_MAINTENANCE_AUTHORITY_SELECTION",
    decision:
      identityValid && lineages.length === 1
        ? "MAINTENANCE_AUTHORITY_SELECTED"
        : "SEALED_MAINTENANCE_AUTHORITY_NOT_UNIQUE",
    selectedRunId: lineages.length === 1 ? lineages[0].id : null,
    eligibleRunIds: lineages.map((run) => run.id).sort((left, right) => Number(left) - Number(right)),
  };
}

if (process.argv[1] && new URL(`file://${process.argv[1]}`).href === import.meta.url) {
  const input = JSON.parse(await readFile(process.argv[2], "utf8"));
  const result = selectSealedMaintenanceAuthority(input);
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.decision === "MAINTENANCE_AUTHORITY_SELECTED" ? 0 : 1;
}

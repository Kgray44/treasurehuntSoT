/* Select one sealed authority-maintenance decision from a trusted-main dispatch. */
import { readFile } from "node:fs/promises";

const sha = (value) => typeof value === "string" && /^[0-9a-f]{40}$/u.test(value);

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
      run?.headSha === qualifiedBaseSha &&
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
  const identityValid = [candidateSha, candidateTree, qualifiedBaseSha].every(sha);
  return {
    authority: "SOUNDING_LINE_AUTHORITY_MAINTENANCE_SELECTION",
    decision:
      identityValid && eligible.length === 1
        ? "AUTHORITY_MAINTENANCE_AUTHORITY_SELECTED"
        : "SEALED_AUTHORITY_MAINTENANCE_AUTHORITY_NOT_UNIQUE",
    selectedRunId: eligible.length === 1 ? eligible[0].id : null,
    eligibleRunIds: eligible.map((run) => run.id).sort((left, right) => Number(left) - Number(right)),
  };
}

if (process.argv[1] && new URL(`file://${process.argv[1]}`).href === import.meta.url) {
  const result = selectSealedAuthorityMaintenance(JSON.parse(await readFile(process.argv[2], "utf8")));
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.decision === "AUTHORITY_MAINTENANCE_AUTHORITY_SELECTED" ? 0 : 1;
}

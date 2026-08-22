/* Select one exact, replay-safe Root Maintenance authority lineage. */
import { readFile } from "node:fs/promises";

const sha = (value) => typeof value === "string" && /^[0-9a-f]{40}$/u.test(value);

export function selectSealedRootMaintenance({ runs, candidateSha, candidateTree, qualifiedBaseSha, prNumber }) {
  const eligible = (runs ?? []).filter((run) => {
    const plan = run?.plan;
    const finalization = run?.finalization;
    return (
      run?.name === "Sounding Line root maintenance" &&
      run?.path === ".github/workflows/sounding-line-root-maintenance.yml" &&
      run?.event === "workflow_dispatch" &&
      run?.status === "completed" &&
      run?.conclusion === "success" &&
      [qualifiedBaseSha, candidateSha].includes(run?.headSha) &&
      plan?.authority === "SOUNDING_LINE_ROOT_MAINTENANCE" &&
      plan?.disposition === "ROOT_MAINTENANCE_GO" &&
      plan?.candidateSha === candidateSha &&
      plan?.candidateTree === candidateTree &&
      plan?.qualifiedBaseSha === qualifiedBaseSha &&
      plan?.trustedMainSha === qualifiedBaseSha &&
      plan?.prNumber === prNumber &&
      plan?.ownerAuthorized === true &&
      plan?.classification?.classification === "SOUNDING_LINE_ROOT_MAINTENANCE" &&
      !plan?.classification?.errors?.length &&
      finalization?.authority === "SOUNDING_LINE_ROOT_MAINTENANCE_FINALIZER" &&
      finalization?.decision === "ROOT_MAINTENANCE_GO" &&
      finalization?.planDigest === plan?.planDigest &&
      finalization?.prNumber === prNumber
    );
  });
  // Unlike lower maintenance lanes, Root Maintenance is intentionally
  // single-use for a PR identity. A second accepted dispatch is a replay,
  // not harmless retry evidence; it must require a new frozen candidate.
  const lineages = eligible;
  const identityValid =
    [candidateSha, candidateTree, qualifiedBaseSha].every(sha) && Number.isSafeInteger(prNumber) && prNumber > 0;
  return {
    authority: "SOUNDING_LINE_ROOT_MAINTENANCE_SELECTION",
    decision:
      identityValid && lineages.length === 1
        ? "ROOT_MAINTENANCE_AUTHORITY_SELECTED"
        : "SEALED_ROOT_MAINTENANCE_AUTHORITY_NOT_UNIQUE",
    selectedRunId: lineages.length === 1 ? Number(lineages[0].id) : null,
    eligibleRunIds: lineages.map((run) => Number(run.id)).sort((left, right) => left - right),
  };
}

if (process.argv[1] && new URL(`file://${process.argv[1]}`).href === import.meta.url) {
  const result = selectSealedRootMaintenance(JSON.parse(await readFile(process.argv[2], "utf8")));
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.decision === "ROOT_MAINTENANCE_AUTHORITY_SELECTED" ? 0 : 1;
}

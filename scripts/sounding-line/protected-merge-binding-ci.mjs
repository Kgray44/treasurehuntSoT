#!/usr/bin/env node
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import process from "node:process";
import { promisify } from "node:util";
import { qualifyProtectedMerge } from "./protected-merge-binding.mjs";

const execute = promisify(execFile);
const value = (name, optional = false) => {
  const index = process.argv.indexOf(name);
  const result = index >= 0 ? process.argv[index + 1] : undefined;
  if (!result && !optional) throw new Error(`PROTECTED_MERGE_BINDING_${name.slice(2).toUpperCase()}_REQUIRED`);
  return result;
};
const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));
const git = async (...args) => (await execute("git", args, { cwd: process.cwd() })).stdout.trim();
const gitExit = async (...args) =>
  execute("git", args, { cwd: process.cwd() }).then(
    () => true,
    () => false,
  );
const authority = await readJson(value("--authority"));
const finalization = await readJson(value("--finalization"));
const plan = await readJson(value("--plan"));
const envelopePath = value("--envelope", true);
const prNumber = Number(value("--pr-number"));
const candidateSha = value("--candidate-sha");
const currentBaseSha = value("--base-sha");
const mergeSha = value("--merge-sha");
const authorityRunId = Number(value("--authority-run-id"));
const legacy = authority.protectedMergeBinding?.legacyQualifiedCandidates?.find(
  (entry) =>
    entry.prNumber === prNumber && entry.candidateSha === candidateSha && entry.authoritativeRunId === authorityRunId,
);
const envelope = envelopePath ? await readJson(envelopePath) : null;
const qualified = envelope ?? legacy;
if (!qualified) throw new Error("QUALIFIED_ACCEPTANCE_ENVELOPE_REQUIRED");
if (envelope) {
  if (
    envelope.authority !== "SOUNDING_LINE_ACCEPTANCE_ENVELOPE" ||
    envelope.finalizerAuthority !== "SOUNDING_LINE_FINALIZER" ||
    envelope.finalizerDecision !== "RELEASE_GO" ||
    envelope.gate !== "mainline"
  )
    throw new Error("QUALIFIED_ACCEPTANCE_ENVELOPE_INVALID");
}
await git("cat-file", "-e", `${candidateSha}^{commit}`);
await git("cat-file", "-e", `${currentBaseSha}^{commit}`);
await git("cat-file", "-e", `${mergeSha}^{commit}`);
const mergeParents = (await git("show", "-s", "--format=%P", mergeSha)).split(/\s+/u).filter(Boolean);
const baseAncestryValid = await gitExit("merge-base", "--is-ancestor", qualified.qualifiedBaseSha, currentBaseSha);
const changedPaths =
  qualified.qualifiedBaseSha === currentBaseSha
    ? []
    : (await git("diff", "--name-only", qualified.qualifiedBaseSha, currentBaseSha)).split(/\r?\n/u).filter(Boolean);
const recordOnlyChangedPaths = plan.recordOnly
  ? (
      await git(
        "diff",
        "--name-only",
        "--no-renames",
        "--no-ext-diff",
        plan.recordOnly.candidateMergeBaseSha,
        candidateSha,
      )
    )
      .split(/\r?\n/u)
      .filter(Boolean)
      .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))
  : undefined;
const recordOnlyAncestryValid = plan.recordOnly
  ? await gitExit(
      "merge-base",
      "--is-ancestor",
      plan.recordOnly.priorAuthority?.implementationMergeSha ?? "",
      candidateSha,
    )
  : undefined;
const result = qualifyProtectedMerge({
  authority,
  qualified,
  plan,
  finalization,
  prNumber,
  candidateSha,
  currentBaseSha,
  mergeSha,
  mergeParents,
  changedPaths,
  baseAncestryValid,
  authorityRunId,
  recordOnlyChangedPaths,
  recordOnlyAncestryValid,
});
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
process.exitCode = result.decision === "BINDING_PASS" ? 0 : 1;

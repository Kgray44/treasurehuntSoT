/* Local-only deterministic synthetic integration-tree prototype (v1.4 shadow). */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createTreeIdentity, V14_AUTHORITY_BOUNDARY } from "./foundation.mjs";

const exec = promisify(execFile);
const git = async (repoPath, args, env = {}) => {
  try {
    const { stdout } = await exec("git", ["-C", repoPath, ...args], { env: { ...process.env, ...env } });
    return stdout.trim();
  } catch (error) {
    const detail = String(error.stderr ?? error.message).trim();
    throw new Error(`SYNTHETIC_GIT_FAILURE:${detail}`);
  }
};

const commitEnvironment = Object.freeze({
  GIT_AUTHOR_NAME: "Sounding Line v1.4 shadow",
  GIT_AUTHOR_EMAIL: "sounding-line-shadow@invalid",
  GIT_AUTHOR_DATE: "2000-01-01T00:00:00 +0000",
  GIT_COMMITTER_NAME: "Sounding Line v1.4 shadow",
  GIT_COMMITTER_EMAIL: "sounding-line-shadow@invalid",
  GIT_COMMITTER_DATE: "2000-01-01T00:00:00 +0000",
});

export async function inspectGitTree(repoPath, commitSha) {
  return { commitSha, treeSha: await git(repoPath, ["rev-parse", `${commitSha}^{tree}`]) };
}

/**
 * Builds temporary, unreachable commits in the caller-provided isolated
 * repository only. No refs, remotes, worktrees, or GitHub state are changed.
 */
export async function buildSyntheticIntegrationTree({
  repoPath,
  baseSha,
  candidateShas,
  trainId = "shadow-train",
  policyDigest = "shadow-policy",
  mergeStrategyIdentity = "git-merge-tree-write-tree",
  planDigest = "shadow-plan",
  msesDigest = "shadow-mses",
}) {
  let parentSha = baseSha;
  const base = await inspectGitTree(repoPath, baseSha);
  const cars = [];
  for (const candidateSha of candidateShas) {
    let treeSha;
    try {
      treeSha = (await git(repoPath, ["merge-tree", "--write-tree", parentSha, candidateSha])).split(/\s+/u)[0];
    } catch (error) {
      return {
        status: "CONFLICT",
        authorityBoundary: V14_AUTHORITY_BOUNDARY,
        failedCandidateSha: candidateSha,
        parentIntegrationSha: parentSha,
        cars,
        error: error.message,
      };
    }
    const candidate = await inspectGitTree(repoPath, candidateSha);
    const syntheticCommitSha = await git(
      repoPath,
      ["commit-tree", treeSha, "-p", parentSha, "-m", "Sounding Line v1.4 shadow integration"],
      commitEnvironment,
    );
    const identity = createTreeIdentity({
      candidateHeadSha: candidateSha,
      candidateTreeSha: candidate.treeSha,
      predictedParentCommitSha: parentSha,
      predictedParentTreeSha: (await inspectGitTree(repoPath, parentSha)).treeSha,
      predictedIntegrationTreeSha: treeSha,
      mergeStrategyIdentity,
      trainId,
      trainPosition: cars.length,
    });
    cars.push({
      carId: `${trainId}:${cars.length}`,
      sourceHeadSha: candidateSha,
      sourceTreeSha: candidate.treeSha,
      predictedParentCommitSha: parentSha,
      predictedParentTreeSha: identity.predictedParentTreeSha,
      predictedIntegrationTreeSha: treeSha,
      syntheticMergeEvidenceDigest: identity.treeIdentityDigest,
      planDigest,
      msesDigest,
      currentStatus: "PREDICTED",
      qualificationReceiptDigests: [],
      policyDigest,
      replanGeneration: 0,
      mutationCounter: 0,
      parentIntegrationSha: parentSha,
      resultingIntegrationSha: syntheticCommitSha,
      conflictState: "NONE",
      identity,
    });
    parentSha = syntheticCommitSha;
  }
  return {
    status: "READY",
    authorityBoundary: V14_AUTHORITY_BOUNDARY,
    trainId,
    policyDigest,
    mergeStrategyIdentity,
    base,
    cars,
    resultingIntegrationSha: parentSha,
    resultingTreeSha: (await inspectGitTree(repoPath, parentSha)).treeSha,
  };
}

export function rebuildAfterWithdrawal(train, withdrawnCandidateSha) {
  const index = train.cars.findIndex((car) => car.sourceHeadSha === withdrawnCandidateSha);
  if (index < 0) return { status: "UNCHANGED", retainedCars: train.cars, invalidatedCars: [] };
  return {
    status: "REBUILD_REQUIRED",
    retainedCars: train.cars.slice(0, index),
    invalidatedCars: train.cars.slice(index),
    rebuildFromIndex: index,
  };
}

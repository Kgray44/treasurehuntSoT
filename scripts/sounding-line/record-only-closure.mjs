#!/usr/bin/env node
/*
 * Fail-closed record-only closure qualification. This module deliberately
 * recognizes records, never product scope, and it can only be executed from a
 * protected merge workflow after the candidate diff is classified.
 */
import { execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

export const RECORD_ONLY_SUITE_ID = "record-only.closure";
export const RECORD_ONLY_PROTECTED_CONTEXT = "Sounding Line / Mainline Decision";
export const RECORD_ONLY_EVIDENCE_IDS = [
  "diff-classification",
  "prior-implementation-authority",
  "policy",
  "inventory",
  "documentation-index",
  "feature-catalog-sync",
  "documentation-validation",
  "feature-catalog-validation",
  "format-diff",
  "generated-record-consistency",
];

const execute = promisify(execFileCallback);
const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const shaPattern = /^[a-f0-9]{40}$/u;
const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const stable = (values) =>
  [...new Set(values)].sort((left, right) => String(left).localeCompare(String(right), undefined, { numeric: true }));

const commandValue = (name, optional = false) => {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value && !optional) throw new Error("RECORD_ONLY_" + name.slice(2).toUpperCase() + "_REQUIRED");
  return value;
};

const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));
const writeJson = async (file, value) => writeFile(file, JSON.stringify(value, null, 2) + "\n", "utf8");
const git = async (root, ...argumentsList) =>
  (await execute("git", argumentsList, { cwd: root, maxBuffer: 8 * 1024 * 1024 })).stdout.trim();
const gitPasses = async (root, ...argumentsList) =>
  execute("git", argumentsList, { cwd: root, maxBuffer: 8 * 1024 * 1024 }).then(
    () => true,
    () => false,
  );
const executeChecked = async (root, id, command, argumentsList) => {
  await execute(command, argumentsList, { cwd: root, maxBuffer: 16 * 1024 * 1024 });
  return { id, result: "PASSED" };
};

export function isApprovedRecordPath(relativePath) {
  if (typeof relativePath !== "string" || !relativePath || relativePath.includes("\\") || relativePath.includes(".."))
    return false;
  if (relativePath === "CHANGELOG.md") return true;
  if (relativePath.startsWith("Development_Docs/")) return /\.(?:md|json|csv|txt)$/u.test(relativePath);
  return relativePath.startsWith("docs/") && relativePath.endsWith(".md");
}

export function classifyRecordOnlyDiff(changes) {
  const errors = [];
  const approvedChanges = [];
  if (!Array.isArray(changes) || changes.length === 0) errors.push("RECORD_ONLY_DIFF_EMPTY");
  for (const change of changes ?? []) {
    const status = change?.status;
    const relativePath = change?.path;
    if (!["A", "M"].includes(status)) {
      errors.push(
        "RECORD_ONLY_CHANGE_STATUS_INVALID:" + String(status ?? "missing") + ":" + String(relativePath ?? ""),
      );
      continue;
    }
    if (!isApprovedRecordPath(relativePath)) {
      errors.push("RECORD_ONLY_PATH_NOT_ALLOWLISTED:" + String(relativePath ?? ""));
      continue;
    }
    approvedChanges.push({ status, path: relativePath });
  }
  return {
    mode: "RECORD_ONLY",
    eligible: errors.length === 0,
    changes: approvedChanges.sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0)),
    errors: stable(errors),
  };
}

function parseNameStatus(output) {
  if (!output) return [];
  return output.split(/\r?\n/u).map((line) => {
    const [status, relativePath] = line.split("\t");
    return { status, path: relativePath };
  });
}

function recordReferences(text) {
  const pullRequests = [];
  const runs = [];
  for (const match of text.matchAll(/(?:pull request|protected pr|\bpr)\s*#?\s*([1-9][0-9]*)/giu))
    pullRequests.push(Number(match[1]));
  for (const match of text.matchAll(/actions\/runs\/([1-9][0-9]*)/giu)) runs.push(Number(match[1]));
  return { pullRequests, runs };
}

async function referencesInChanges(root, candidateSha, changes) {
  const pullRequests = [];
  const runs = [];
  for (const change of changes) {
    if (!/\.(?:md|json|csv|txt)$/u.test(change.path)) continue;
    const text = await git(root, "show", candidateSha + ":" + change.path);
    const references = recordReferences(text);
    pullRequests.push(...references.pullRequests);
    runs.push(...references.runs);
  }
  return { pullRequests: stable(pullRequests), runs: stable(runs) };
}

async function githubJson(url, token) {
  if (!token) throw new Error("RECORD_ONLY_GITHUB_TOKEN_REQUIRED");
  const response = await fetch(url, {
    headers: {
      authorization: "Bearer " + token,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
    },
  });
  if (!response.ok) throw new Error("RECORD_ONLY_GITHUB_API_FAILED:" + response.status + ":" + url);
  return response.json();
}

function successfulProtectedContextCount(checkRuns) {
  return (checkRuns.check_runs ?? []).filter(
    (check) =>
      check?.name === RECORD_ONLY_PROTECTED_CONTEXT && check?.status === "completed" && check?.conclusion === "success",
  ).length;
}

async function inspectReferencedAuthority({ root, repository, candidateSha, prNumber, runId, token }) {
  const errors = [];
  const pull = await githubJson("https://api.github.com/repos/" + repository + "/pulls/" + prNumber, token);
  const run = await githubJson("https://api.github.com/repos/" + repository + "/actions/runs/" + runId, token);
  const implementationCandidateSha = pull?.head?.sha;
  const implementationMergeSha = pull?.merge_commit_sha;
  if (pull?.merged !== true) errors.push("PRIOR_IMPLEMENTATION_PR_NOT_MERGED");
  if (!shaPattern.test(implementationCandidateSha ?? "")) errors.push("PRIOR_IMPLEMENTATION_HEAD_INVALID");
  if (!shaPattern.test(implementationMergeSha ?? "")) errors.push("PRIOR_IMPLEMENTATION_MERGE_INVALID");
  if (
    run?.name !== "Sounding Line authoritative" ||
    run?.event !== "workflow_dispatch" ||
    run?.status !== "completed" ||
    run?.conclusion !== "success" ||
    run?.head_sha !== implementationCandidateSha
  )
    errors.push("PRIOR_IMPLEMENTATION_AUTHORITY_RUN_INVALID");
  if (!errors.length) {
    const parents = (await git(root, "show", "-s", "--format=%P", implementationMergeSha))
      .split(/\s+/u)
      .filter(Boolean);
    if (!parents.includes(implementationCandidateSha) || !parents.includes(pull?.base?.sha))
      errors.push("PRIOR_IMPLEMENTATION_MERGE_COMPOSITION_INVALID");
    if (!(await gitPasses(root, "merge-base", "--is-ancestor", implementationMergeSha, candidateSha)))
      errors.push("PRIOR_IMPLEMENTATION_NOT_ANCESTOR_OF_RECORD_CANDIDATE");
    const checks = await githubJson(
      "https://api.github.com/repos/" +
        repository +
        "/commits/" +
        implementationCandidateSha +
        "/check-runs?per_page=100",
      token,
    );
    if (successfulProtectedContextCount(checks) < 2) errors.push("PRIOR_IMPLEMENTATION_PROTECTED_CONTEXT_INVALID");
  }
  return {
    valid: errors.length === 0,
    errors: stable(errors),
    prNumber,
    authorityRunId: runId,
    implementationCandidateSha: implementationCandidateSha ?? null,
    implementationMergeSha: implementationMergeSha ?? null,
    protectedContext: RECORD_ONLY_PROTECTED_CONTEXT,
  };
}

export function validatePriorImplementationAuthority({ authority, plan, finalization }) {
  const errors = [];
  if (!authority?.valid) errors.push(...(authority?.errors ?? ["PRIOR_IMPLEMENTATION_AUTHORITY_INVALID"]));
  const { planDigest, ...unsignedPlan } = plan ?? {};
  if (!plan || planDigest !== digest(unsignedPlan)) errors.push("PRIOR_IMPLEMENTATION_PLAN_DIGEST_INVALID");
  if (plan?.authority !== "SOUNDING_LINE" || plan?.gate !== "mainline" || plan?.recordOnly)
    errors.push("PRIOR_IMPLEMENTATION_FULL_MAINLINE_PLAN_REQUIRED");
  if (plan?.sourceSha !== authority?.implementationCandidateSha)
    errors.push("PRIOR_IMPLEMENTATION_PLAN_SOURCE_MISMATCH");
  if (plan?.runtimeConformanceRequired !== true || !Array.isArray(plan?.nodes) || !plan.nodes.length)
    errors.push("PRIOR_IMPLEMENTATION_PLAN_SHAPE_INVALID");
  if (finalization?.authority !== "SOUNDING_LINE_FINALIZER" || finalization?.decision !== "RELEASE_GO")
    errors.push("PRIOR_IMPLEMENTATION_RELEASE_GO_REQUIRED");
  if (finalization?.gate !== "mainline" || finalization?.planDigest !== plan?.planDigest)
    errors.push("PRIOR_IMPLEMENTATION_FINALIZATION_PLAN_MISMATCH");
  const required = new Set((plan?.nodes ?? []).map((node) => node.id));
  const receipts = finalization?.receipts ?? [];
  if (receipts.length !== required.size || !receipts.length) errors.push("PRIOR_IMPLEMENTATION_RECEIPT_COUNT_INVALID");
  const counts = new Map();
  for (const receipt of receipts) counts.set(receipt.suiteId, (counts.get(receipt.suiteId) ?? 0) + 1);
  for (const suiteId of required)
    if (counts.get(suiteId) !== 1) errors.push("PRIOR_IMPLEMENTATION_RECEIPT_MISSING:" + suiteId);
  for (const receipt of receipts) {
    if (
      !required.has(receipt.suiteId) ||
      receipt.sourceSha !== plan?.sourceSha ||
      receipt.policyDigest !== plan?.policyDigest ||
      receipt.inventoryDigest !== plan?.inventoryDigest ||
      receipt.planDigest !== plan?.planDigest ||
      receipt.gate !== "mainline" ||
      receipt.cleanupState !== "CLEAN" ||
      receipt.result !== "PASSED" ||
      receipt.exitCode !== 0 ||
      receipt.timedOut === true
    )
      errors.push("PRIOR_IMPLEMENTATION_RECEIPT_INVALID:" + String(receipt.suiteId ?? "missing"));
  }
  if (finalization?.evidenceDigest !== digest(receipts)) errors.push("PRIOR_IMPLEMENTATION_EVIDENCE_DIGEST_INVALID");
  for (const field of [
    "missingMandatorySuites",
    "duplicateSuiteReceipts",
    "unknownSuiteReceipts",
    "invalidEvidence",
    "missingRuntimeConformance",
    "invalidRuntimeConformance",
  ])
    if (!Array.isArray(finalization?.[field]) || finalization[field].length)
      errors.push("PRIOR_IMPLEMENTATION_FINALIZATION_INVALID:" + field);
  return stable(errors);
}

export async function preflightRecordOnlyClosure({
  root = sourceRoot,
  repository,
  candidateSha,
  currentBaseSha,
  mergeSha,
  token,
}) {
  if (![candidateSha, currentBaseSha, mergeSha].every((value) => shaPattern.test(value ?? "")))
    throw new Error("RECORD_ONLY_IDENTITY_INVALID");
  await git(root, "cat-file", "-e", candidateSha + "^{commit}");
  await git(root, "cat-file", "-e", currentBaseSha + "^{commit}");
  await git(root, "cat-file", "-e", mergeSha + "^{commit}");
  const candidateMergeBaseSha = await git(root, "merge-base", currentBaseSha, candidateSha);
  const changes = parseNameStatus(
    await git(root, "diff", "--name-status", "--no-renames", "--no-ext-diff", candidateMergeBaseSha, candidateSha),
  );
  const classification = classifyRecordOnlyDiff(changes);
  const result = {
    version: 1,
    mode: "RECORD_ONLY",
    eligible: classification.eligible,
    candidateSha,
    currentBaseSha,
    mergeSha,
    candidateMergeBaseSha,
    classification,
    priorAuthority: null,
    errors: [...classification.errors],
  };
  if (!classification.eligible) return result;
  const references = await referencesInChanges(root, candidateSha, classification.changes);
  const candidates = [];
  for (const prNumber of references.pullRequests)
    for (const authorityRunId of references.runs) {
      try {
        const inspected = await inspectReferencedAuthority({
          root,
          repository,
          candidateSha,
          prNumber: Number(prNumber),
          runId: Number(authorityRunId),
          token,
        });
        if (inspected.valid) candidates.push(inspected);
      } catch (error) {
        result.errors.push(error instanceof Error ? error.message : String(error));
      }
    }
  if (candidates.length !== 1)
    result.errors.push(
      candidates.length ? "PRIOR_IMPLEMENTATION_AUTHORITY_AMBIGUOUS" : "PRIOR_IMPLEMENTATION_AUTHORITY_UNRESOLVED",
    );
  else result.priorAuthority = candidates[0];
  result.errors = stable(result.errors);
  return result;
}

async function assertCleanGeneratedRecords(root) {
  const cleanWorkingTree = await gitPasses(root, "diff", "--quiet");
  const cleanIndex = await gitPasses(root, "diff", "--cached", "--quiet");
  if (!cleanWorkingTree || !cleanIndex) throw new Error("RECORD_ONLY_GENERATED_RECORD_DRIFT");
}

export async function createRecordOnlyEvidence({
  root = sourceRoot,
  preflight,
  priorPlan,
  priorFinalization,
  planOutput,
  evidenceOutput,
}) {
  if (!preflight?.eligible) throw new Error("RECORD_ONLY_CLASSIFICATION_REFUSED");
  if (preflight.errors?.length || !preflight.priorAuthority) throw new Error("RECORD_ONLY_PRIOR_AUTHORITY_REFUSED");
  const priorErrors = validatePriorImplementationAuthority({
    authority: preflight.priorAuthority,
    plan: priorPlan,
    finalization: priorFinalization,
  });
  if (priorErrors.length) throw new Error(priorErrors.join(","));
  const changedPaths = preflight.classification.changes.map((change) => change.path);
  const checks = [
    { id: "diff-classification", result: "PASSED" },
    { id: "prior-implementation-authority", result: "PASSED" },
  ];
  checks.push(
    await executeChecked(root, "policy", process.execPath, ["scripts/sounding-line/cli.mjs", "validate-policy"]),
  );
  checks.push(
    await executeChecked(root, "inventory", process.execPath, ["scripts/sounding-line/cli.mjs", "inventory"]),
  );
  checks.push(
    await executeChecked(root, "documentation-index", process.execPath, ["scripts/generate-document-index.mjs"]),
  );
  checks.push(
    await executeChecked(root, "feature-catalog-sync", process.execPath, [
      "node_modules/tsx/dist/cli.mjs",
      "scripts/features/build-feature-catalog.ts",
    ]),
  );
  await assertCleanGeneratedRecords(root);
  checks.push(
    await executeChecked(root, "documentation-validation", process.execPath, ["scripts/validate-documentation.mjs"]),
  );
  checks.push(
    await executeChecked(root, "feature-catalog-validation", process.execPath, [
      "node_modules/tsx/dist/cli.mjs",
      "scripts/features/validate-feature-catalog.ts",
    ]),
  );
  checks.push(
    await executeChecked(root, "format-diff", "git", [
      "diff",
      "--check",
      "--no-ext-diff",
      preflight.candidateMergeBaseSha,
      preflight.candidateSha,
    ]),
  );
  await assertCleanGeneratedRecords(root);
  checks.push({ id: "generated-record-consistency", result: "PASSED" });
  const [policy, inventory, authority] = await Promise.all([
    readJson(path.join(root, "testing", "policy-manifest.json")),
    readJson(path.join(root, "testing", "generated", "active-test-registry.json")),
    readJson(path.join(root, "testing", "sounding-line-authority.json")),
  ]);
  const recordOnly = {
    version: 1,
    mode: "FAIL_CLOSED_RECORD_ONLY",
    candidateSha: preflight.candidateSha,
    currentBaseSha: preflight.currentBaseSha,
    mergeSha: preflight.mergeSha,
    candidateMergeBaseSha: preflight.candidateMergeBaseSha,
    changedPaths,
    priorAuthority: {
      prNumber: preflight.priorAuthority.prNumber,
      authorityRunId: preflight.priorAuthority.authorityRunId,
      implementationCandidateSha: preflight.priorAuthority.implementationCandidateSha,
      implementationMergeSha: preflight.priorAuthority.implementationMergeSha,
      protectedContext: preflight.priorAuthority.protectedContext,
    },
    evidence: checks,
  };
  const unsignedPlan = {
    version: 3,
    authority: "SOUNDING_LINE",
    sourceSha: preflight.candidateSha,
    gate: "mainline",
    serial: true,
    policyDigest: digest(policy),
    inventoryDigest: digest(inventory),
    authorityDigest: digest(authority),
    runtimeConformanceRequired: true,
    runtimeConformanceSuiteId: RECORD_ONLY_SUITE_ID,
    nodes: [
      {
        id: RECORD_ONLY_SUITE_ID,
        dependencies: [],
        resources: ["node-slot"],
        explanation: "FAIL_CLOSED_RECORD_ONLY_CLOSURE",
        adapter: "record-only-static",
        execution: { mode: "parallel", wave: 0 },
        testIds: [],
      },
    ],
    recordOnly,
  };
  const plan = { ...unsignedPlan, planDigest: digest(unsignedPlan) };
  const receipt = {
    suiteId: RECORD_ONLY_SUITE_ID,
    adapterId: "record-only-static",
    sourceSha: plan.sourceSha,
    policyDigest: plan.policyDigest,
    inventoryDigest: plan.inventoryDigest,
    planDigest: plan.planDigest,
    gate: plan.gate,
    cleanupState: "CLEAN",
    result: "PASSED",
    exitCode: 0,
    timedOut: false,
    recordOnlyDigest: digest(recordOnly),
  };
  const runtimeConformance = [
    {
      suiteId: RECORD_ONLY_SUITE_ID,
      planDigest: plan.planDigest,
      authorityDigest: plan.authorityDigest,
      result: "PASSED",
      scope: "RECORD_ONLY_STATIC_EVIDENCE",
      violations: [],
    },
  ];
  await writeJson(planOutput, plan);
  await writeJson(evidenceOutput, { version: 2, plan, receipts: [receipt], runtimeConformance });
  return { plan, receipt, runtimeConformance, checks };
}

async function main() {
  const command = process.argv[2];
  if (command === "preflight") {
    const result = await preflightRecordOnlyClosure({
      root: process.cwd(),
      repository: commandValue("--repository"),
      candidateSha: commandValue("--candidate-sha"),
      currentBaseSha: commandValue("--base-sha"),
      mergeSha: commandValue("--merge-sha"),
      token: process.env.GITHUB_TOKEN,
    });
    await writeJson(commandValue("--out"), result);
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    return;
  }
  if (command === "evidence") {
    const result = await createRecordOnlyEvidence({
      root: process.cwd(),
      preflight: await readJson(commandValue("--preflight")),
      priorPlan: await readJson(commandValue("--prior-plan")),
      priorFinalization: await readJson(commandValue("--prior-finalization")),
      planOutput: commandValue("--plan-out"),
      evidenceOutput: commandValue("--evidence-out"),
    });
    process.stdout.write(JSON.stringify({ planDigest: result.plan.planDigest, checks: result.checks }, null, 2) + "\n");
    return;
  }
  throw new Error("RECORD_ONLY_USAGE: preflight | evidence");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch((error) => {
    process.stderr.write(String(error instanceof Error ? error.message : error) + "\n");
    process.exitCode = 1;
  });

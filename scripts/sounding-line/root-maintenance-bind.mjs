/*
 * The one trusted Root Maintenance qualification-to-binding boundary.
 *
 * This helper deliberately treats GitHub Actions run identifiers as opaque
 * decimal strings.  It is loaded from the qualified protected base by the
 * workflows, so a candidate cannot replace its own authority selection.
 */
import { createHash } from "node:crypto";
import { lstat, mkdir, open, readdir, readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";

import { createRootMaintenancePlan, finalizeRootMaintenance } from "./root-maintenance.mjs";

const envelopeName = "root-maintenance-envelope.json";
const sha = (value) => typeof value === "string" && /^[0-9a-f]{40}$/u.test(value);
const runId = (value) => typeof value === "string" && /^[1-9][0-9]*$/u.test(value);
const positiveInteger = (value) => Number.isSafeInteger(value) && value > 0;
const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const fail = (code, detail = "") => {
  throw new Error(detail ? `${code}:${detail}` : code);
};
const inside = (root, target) => target === root || target.startsWith(`${root}${path.sep}`);
const equalJson = (left, right) => JSON.stringify(left) === JSON.stringify(right);

function requiredEnvelopeIdentity(plan, finalization, evidence) {
  return { plan, finalization, evidence };
}

export function createRootMaintenanceEnvelope({ plan, finalization, evidence, runId: authorityRunId, issuedAt }) {
  if (!runId(authorityRunId)) fail("ROOT_MAINTENANCE_ENVELOPE_RUN_ID_INVALID");
  if (!positiveInteger(plan?.prNumber)) fail("ROOT_MAINTENANCE_ENVELOPE_PR_INVALID");
  if (![plan?.trustedMainSha, plan?.candidateSha, plan?.candidateTree, plan?.qualifiedBaseSha].every(sha))
    fail("ROOT_MAINTENANCE_ENVELOPE_IDENTITY_INVALID");
  if (plan?.authority !== "SOUNDING_LINE_ROOT_MAINTENANCE" || plan?.disposition !== "ROOT_MAINTENANCE_GO")
    fail("ROOT_MAINTENANCE_ENVELOPE_AUTHORITY_INVALID");
  if (finalization?.authority !== "SOUNDING_LINE_ROOT_MAINTENANCE_FINALIZER" || finalization?.decision !== "ROOT_MAINTENANCE_GO")
    fail("ROOT_MAINTENANCE_ENVELOPE_QUALIFICATION_INVALID");
  const payload = requiredEnvelopeIdentity(plan, finalization, evidence);
  return {
    schemaVersion: "1.0",
    authorityClass: "SOUNDING_LINE_ROOT_MAINTENANCE",
    qualificationResult: "ROOT_MAINTENANCE_GO",
    runId: authorityRunId,
    prNumber: plan.prNumber,
    baseSha: plan.qualifiedBaseSha,
    candidateSha: plan.candidateSha,
    candidateTree: plan.candidateTree,
    policyDigest: plan.trustedPolicyDigest,
    qualificationDigest: digest(payload),
    issuedAt: issuedAt ?? new Date().toISOString(),
    plan,
    finalization,
    evidence,
  };
}

export async function assertSafeRootMaintenanceEnvelopePath(root, candidate) {
  const trustedRoot = await realpath(root);
  const resolved = path.resolve(candidate);
  if (!inside(trustedRoot, resolved)) fail("ROOT_MAINTENANCE_ENVELOPE_OUT_OF_ROOT", resolved);
  const candidateReal = await realpath(resolved);
  if (!inside(trustedRoot, candidateReal)) fail("ROOT_MAINTENANCE_ENVELOPE_OUT_OF_ROOT", candidateReal);
  return { trustedRoot, resolved: candidateReal };
}

export async function discoverRootMaintenanceEnvelope(root) {
  const trustedRoot = await realpath(root);
  const rootStat = await lstat(trustedRoot);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) fail("ROOT_MAINTENANCE_ENVELOPE_ROOT_INVALID");
  const matches = [];

  async function visit(directory) {
    const directoryReal = await realpath(directory);
    if (!inside(trustedRoot, directoryReal)) fail("ROOT_MAINTENANCE_ENVELOPE_OUT_OF_ROOT", directoryReal);
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const candidate = path.join(directory, entry.name);
      const stat = await lstat(candidate);
      if (stat.isSymbolicLink()) fail("ROOT_MAINTENANCE_ENVELOPE_SYMLINK_REJECTED", entry.name);
      if (stat.isDirectory()) {
        await visit(candidate);
        continue;
      }
      if (!stat.isFile() || entry.name !== envelopeName) continue;
      const candidateReal = await realpath(candidate);
      if (!inside(trustedRoot, candidateReal)) fail("ROOT_MAINTENANCE_ENVELOPE_OUT_OF_ROOT", candidateReal);
      matches.push(candidateReal);
    }
  }

  await visit(trustedRoot);
  if (matches.length === 0) fail("ROOT_MAINTENANCE_ENVELOPE_MISSING");
  if (matches.length !== 1) fail("ROOT_MAINTENANCE_ENVELOPE_AMBIGUOUS");
  return matches[0];
}

async function readJson(file, failure) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    fail(failure);
  }
}

export async function readRootMaintenanceEnvelope(root) {
  const file = await discoverRootMaintenanceEnvelope(root);
  return { file, envelope: await readJson(file, "ROOT_MAINTENANCE_ENVELOPE_JSON_INVALID") };
}

function validateEnvelopeShape(envelope) {
  if (envelope?.schemaVersion !== "1.0") fail("ROOT_MAINTENANCE_ENVELOPE_SCHEMA_INVALID");
  if (envelope?.authorityClass !== "SOUNDING_LINE_ROOT_MAINTENANCE")
    fail("ROOT_MAINTENANCE_ENVELOPE_AUTHORITY_INVALID");
  if (envelope?.qualificationResult !== "ROOT_MAINTENANCE_GO")
    fail("ROOT_MAINTENANCE_ENVELOPE_QUALIFICATION_INVALID");
  if (!runId(envelope?.runId)) fail("ROOT_MAINTENANCE_ENVELOPE_RUN_ID_INVALID");
  if (!positiveInteger(envelope?.prNumber)) fail("ROOT_MAINTENANCE_ENVELOPE_PR_INVALID");
  if (![envelope?.baseSha, envelope?.candidateSha, envelope?.candidateTree].every(sha))
    fail("ROOT_MAINTENANCE_ENVELOPE_IDENTITY_INVALID");
  if (typeof envelope?.policyDigest !== "string" || !/^[0-9a-f]{64}$/u.test(envelope.policyDigest))
    fail("ROOT_MAINTENANCE_ENVELOPE_POLICY_DIGEST_INVALID");
  if (typeof envelope?.qualificationDigest !== "string" || !/^[0-9a-f]{64}$/u.test(envelope.qualificationDigest))
    fail("ROOT_MAINTENANCE_ENVELOPE_QUALIFICATION_DIGEST_INVALID");
  if (typeof envelope?.issuedAt !== "string" || Number.isNaN(Date.parse(envelope.issuedAt)))
    fail("ROOT_MAINTENANCE_ENVELOPE_ISSUED_AT_INVALID");
}

function validateQualification({ envelope, trustedPolicy, authorityRunId, prNumber, baseSha, candidateSha, candidateTree }) {
  validateEnvelopeShape(envelope);
  if (envelope.runId !== authorityRunId) fail("ROOT_MAINTENANCE_AUTHORITY_RUN_IDENTITY_MISMATCH");
  if (envelope.prNumber !== prNumber) fail("ROOT_MAINTENANCE_ENVELOPE_PR_MISMATCH");
  if (envelope.baseSha !== baseSha) fail("ROOT_MAINTENANCE_ENVELOPE_BASE_MISMATCH");
  if (envelope.candidateSha !== candidateSha) fail("ROOT_MAINTENANCE_ENVELOPE_CANDIDATE_MISMATCH");
  if (envelope.candidateTree !== candidateTree) fail("ROOT_MAINTENANCE_ENVELOPE_TREE_MISMATCH");
  if (envelope.policyDigest !== digest(trustedPolicy)) fail("ROOT_MAINTENANCE_ENVELOPE_POLICY_MISMATCH");

  const expectedPlan = createRootMaintenancePlan({
    trustedPolicy,
    trustedMainSha: baseSha,
    candidateSha,
    candidateTree,
    qualifiedBaseSha: baseSha,
    prNumber,
    changedPaths: envelope.plan?.classification?.changedPaths,
    ownerAuthorized: true,
  });
  if (expectedPlan.errors.length || !equalJson(envelope.plan, expectedPlan))
    fail("ROOT_MAINTENANCE_ENVELOPE_PLAN_INVALID");
  const expectedFinalization = finalizeRootMaintenance({
    plan: envelope.plan,
    evidence: envelope.evidence,
    observedCandidateSha: candidateSha,
    observedTrustedMainSha: baseSha,
    observedPrNumber: prNumber,
  });
  if (expectedFinalization.errors.length || !equalJson(envelope.finalization, expectedFinalization))
    fail("ROOT_MAINTENANCE_ENVELOPE_FINALIZATION_INVALID");
  if (envelope.qualificationDigest !== digest(requiredEnvelopeIdentity(envelope.plan, envelope.finalization, envelope.evidence)))
    fail("ROOT_MAINTENANCE_ENVELOPE_QUALIFICATION_DIGEST_MISMATCH");
}

async function consumeReplayLedger(replayLedger, envelope) {
  if (!replayLedger) fail("ROOT_MAINTENANCE_REPLAY_LEDGER_REQUIRED");
  await mkdir(path.dirname(path.resolve(replayLedger)), { recursive: true });
  try {
    const handle = await open(replayLedger, "wx");
    try {
      await handle.writeFile(
        `${JSON.stringify({ schemaVersion: "1.0", runId: envelope.runId, qualificationDigest: envelope.qualificationDigest })}\n`,
      );
    } finally {
      await handle.close();
    }
  } catch (error) {
    if (error?.code === "EEXIST") fail("ROOT_MAINTENANCE_AUTHORITY_REPLAYED", envelope.runId);
    throw error;
  }
}

export async function prepareRootMaintenanceBinding({
  root,
  policyPath,
  authorityRunId,
  prNumber,
  baseSha,
  candidateSha,
  candidateTree,
  mergeSha,
  mergeTree,
  mergeParents,
  replayLedger,
}) {
  if (!runId(authorityRunId)) fail("ROOT_MAINTENANCE_AUTHORITY_RUN_INVALID");
  if (!positiveInteger(prNumber)) fail("ROOT_MAINTENANCE_PR_INVALID");
  if (![baseSha, candidateSha, candidateTree, mergeSha, mergeTree].every(sha))
    fail("ROOT_MAINTENANCE_BINDING_IDENTITY_INVALID");
  if (!Array.isArray(mergeParents) || mergeParents.some((entry) => !sha(entry)))
    fail("ROOT_MAINTENANCE_BINDING_MERGE_PARENTS_INVALID");
  const trustedPolicy = await readJson(policyPath, "ROOT_MAINTENANCE_TRUSTED_POLICY_INVALID");
  const { envelope } = await readRootMaintenanceEnvelope(root);
  validateQualification({ envelope, trustedPolicy, authorityRunId, prNumber, baseSha, candidateSha, candidateTree });
  await consumeReplayLedger(replayLedger, envelope);
  return {
    authority: "SOUNDING_LINE_ROOT_MAINTENANCE_BINDING_INPUT",
    authorityRunId: envelope.runId,
    plan: envelope.plan,
    finalization: envelope.finalization,
    candidateSha,
    currentBaseSha: baseSha,
    mergeSha,
    mergeTree,
    mergeParents,
    prNumber,
  };
}

const args = process.argv.slice(3);
const value = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const required = (name) => value(name) ?? fail(`ROOT_MAINTENANCE_BIND_${name.slice(2).toUpperCase()}_REQUIRED`);

if (process.argv[2] === "envelope") {
  const envelope = createRootMaintenanceEnvelope({
    plan: await readJson(required("--plan"), "ROOT_MAINTENANCE_ENVELOPE_PLAN_JSON_INVALID"),
    finalization: await readJson(required("--finalization"), "ROOT_MAINTENANCE_ENVELOPE_FINALIZATION_JSON_INVALID"),
    evidence: await readJson(required("--evidence"), "ROOT_MAINTENANCE_ENVELOPE_EVIDENCE_JSON_INVALID"),
    runId: required("--run-id"),
  });
  await writeFile(required("--out"), `${JSON.stringify(envelope, null, 2)}\n`);
  console.log(envelope.qualificationResult);
}

if (process.argv[2] === "bind") {
  const result = await prepareRootMaintenanceBinding({
    root: required("--root"),
    policyPath: required("--policy"),
    authorityRunId: required("--run-id"),
    prNumber: Number(required("--pr-number")),
    baseSha: required("--base-sha"),
    candidateSha: required("--candidate-sha"),
    candidateTree: required("--candidate-tree"),
    mergeSha: required("--merge-sha"),
    mergeTree: required("--merge-tree"),
    mergeParents: await readJson(required("--merge-parents"), "ROOT_MAINTENANCE_BINDING_MERGE_PARENTS_INVALID"),
    replayLedger: required("--replay-ledger"),
  });
  await writeFile(required("--out"), `${JSON.stringify(result, null, 2)}\n`);
  console.log(result.authorityRunId);
}

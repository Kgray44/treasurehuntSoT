import assert from "node:assert/strict";
import { mkdtemp, mkdir, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  createRootMaintenanceEnvelope,
  discoverRootMaintenanceEnvelope,
  assertSafeRootMaintenanceEnvelopePath,
  prepareRootMaintenanceBinding,
} from "../../../scripts/sounding-line/root-maintenance-bind.mjs";
import { createRootMaintenancePlan, finalizeRootMaintenance } from "../../../scripts/sounding-line/root-maintenance.mjs";

const sha = (letter) => letter.repeat(40);
const rootPolicy = {
  authority: "SOUNDING_LINE_ROOT_MAINTENANCE",
  disposition: "ROOT_MAINTENANCE_GO",
  workflowDispatchOnly: true,
  trustedMainOnly: true,
  ownerAuthorization: "REPOSITORY_OWNER_WORKFLOW_DISPATCH",
  releaseAuthority: "NONE",
  eligiblePathGlobs: ["scripts/sounding-line/**"],
  requiredEvidence: ["ROOT_ANTI_SELF_AUTHORIZATION"],
};
const identity = { baseSha: sha("a"), candidateSha: sha("b"), candidateTree: sha("c"), prNumber: 413 };

async function artifactRoot() {
  return mkdtemp(path.join(os.tmpdir(), "root-maintenance-envelope-"));
}

function validEnvelope(runId = "32551670593") {
  const plan = createRootMaintenancePlan({
    trustedPolicy: rootPolicy,
    trustedMainSha: identity.baseSha,
    candidateSha: identity.candidateSha,
    candidateTree: identity.candidateTree,
    qualifiedBaseSha: identity.baseSha,
    prNumber: identity.prNumber,
    changedPaths: ["scripts/sounding-line/root-maintenance-bind.mjs"],
    ownerAuthorized: true,
  });
  const evidence = [{ id: "ROOT_ANTI_SELF_AUTHORIZATION", result: "PASSED", candidateSha: identity.candidateSha }];
  const finalization = finalizeRootMaintenance({
    plan,
    evidence,
    observedCandidateSha: identity.candidateSha,
    observedTrustedMainSha: identity.baseSha,
    observedPrNumber: identity.prNumber,
  });
  return createRootMaintenanceEnvelope({ plan, finalization, evidence, runId, issuedAt: "2026-08-22T04:28:13.000Z" });
}

async function writeEnvelope(root, envelope = validEnvelope(), relative = "") {
  const directory = path.join(root, relative);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "root-maintenance-envelope.json"), `${JSON.stringify(envelope, null, 2)}\n`);
}

async function prepare(root, options = {}) {
  const policyPath = path.join(root, "trusted-root-maintenance-policy.json");
  await writeFile(policyPath, `${JSON.stringify(rootPolicy)}\n`);
  return prepareRootMaintenanceBinding({
    root,
    policyPath,
    authorityRunId: "32551670593",
    prNumber: identity.prNumber,
    ...identity,
    mergeSha: sha("d"),
    mergeTree: identity.candidateTree,
    mergeParents: [identity.baseSha, identity.candidateSha],
    replayLedger: path.join(root, "replay", "authority.json"),
    ...options,
  });
}

test("Root Maintenance canonical envelope accepts artifact-root and production-shaped hosted nested layouts", async () => {
  const root = await artifactRoot();
  await writeEnvelope(root);
  const atRoot = await prepare(root);
  assert.equal(atRoot.authorityRunId, "32551670593");

  const hosted = await artifactRoot();
  await writeFile(path.join(hosted, "treasurehuntSoT-baseline-note.json"), "{}\n");
  await writeEnvelope(hosted, validEnvelope(), "_temp/sounding-line-root-maintenance-32551670593-1");
  const nested = await prepare(hosted);
  assert.equal(nested.plan.candidateTree, identity.candidateTree);
  assert.match(await discoverRootMaintenanceEnvelope(hosted), /_temp[\\/]sounding-line-root-maintenance-32551670593-1/u);
});

test("Root Maintenance preserves production-scale run IDs as opaque strings", async () => {
  for (const authorityRunId of ["1", "2147483647", "2147483648", "32551670593", "9223372036854775807", "184467440737095516161844674407370955161"]) {
    const root = await artifactRoot();
    await writeEnvelope(root, validEnvelope(authorityRunId));
    const result = await prepare(root, { authorityRunId, replayLedger: path.join(root, "replay.json") });
    assert.equal(result.authorityRunId, authorityRunId);
    assert.equal(typeof result.authorityRunId, "string");
  }
});

test("Root Maintenance canonical envelope rejects absent, duplicate, malformed, traversal, and symlink extraction", async (t) => {
  const absent = await artifactRoot();
  await assert.rejects(prepare(absent), /ROOT_MAINTENANCE_ENVELOPE_MISSING/u);

  const duplicate = await artifactRoot();
  await writeEnvelope(duplicate, validEnvelope(), "first");
  await writeEnvelope(duplicate, validEnvelope(), "second");
  await assert.rejects(prepare(duplicate), /ROOT_MAINTENANCE_ENVELOPE_AMBIGUOUS/u);

  const malformed = await artifactRoot();
  await mkdir(path.join(malformed, "nested"));
  await writeFile(path.join(malformed, "nested", "root-maintenance-envelope.json"), "not-json");
  await assert.rejects(prepare(malformed), /ROOT_MAINTENANCE_ENVELOPE_JSON_INVALID/u);

  const traversal = await artifactRoot();
  const traversalOutside = await artifactRoot();
  await assert.rejects(
    assertSafeRootMaintenanceEnvelopePath(traversal, path.join(traversal, "..", path.basename(traversalOutside))),
    /ROOT_MAINTENANCE_ENVELOPE_OUT_OF_ROOT/u,
  );

  const escapedRoot = await artifactRoot();
  const outside = await artifactRoot();
  await writeEnvelope(outside);
  try {
    await symlink(outside, path.join(escapedRoot, "escape"), "junction");
  } catch (error) {
    if (error?.code === "EPERM" || error?.code === "EACCES") {
      t.skip("Windows host does not permit test junction creation");
      return;
    }
    throw error;
  }
  await assert.rejects(prepare(escapedRoot), /ROOT_MAINTENANCE_ENVELOPE_SYMLINK_REJECTED/u);
});

test("Root Maintenance canonical envelope rejects wrong qualification identity and policy", async () => {
  const cases = [
    ["authority", (envelope) => ({ ...envelope, authorityClass: "SOUNDING_LINE_ORDINARY" }), "ROOT_MAINTENANCE_ENVELOPE_AUTHORITY_INVALID"],
    ["failed", (envelope) => ({ ...envelope, qualificationResult: "ROOT_MAINTENANCE_NO_GO" }), "ROOT_MAINTENANCE_ENVELOPE_QUALIFICATION_INVALID"],
    ["pr", (envelope) => ({ ...envelope, prNumber: 414 }), "ROOT_MAINTENANCE_ENVELOPE_PR_MISMATCH"],
    ["base", (envelope) => ({ ...envelope, baseSha: sha("e") }), "ROOT_MAINTENANCE_ENVELOPE_BASE_MISMATCH"],
    ["candidate", (envelope) => ({ ...envelope, candidateSha: sha("e") }), "ROOT_MAINTENANCE_ENVELOPE_CANDIDATE_MISMATCH"],
    ["tree", (envelope) => ({ ...envelope, candidateTree: sha("e") }), "ROOT_MAINTENANCE_ENVELOPE_TREE_MISMATCH"],
    ["policy", (envelope) => ({ ...envelope, policyDigest: "e".repeat(64) }), "ROOT_MAINTENANCE_ENVELOPE_POLICY_MISMATCH"],
  ];
  for (const [name, mutate, code] of cases) {
    const root = await artifactRoot();
    await writeEnvelope(root, mutate(validEnvelope()));
    await assert.rejects(prepare(root), new RegExp(code, "u"), name);
  }
});

test("Root Maintenance canonical envelope rejects a replayed authority", async () => {
  const root = await artifactRoot();
  await writeEnvelope(root);
  await prepare(root);
  await assert.rejects(prepare(root), /ROOT_MAINTENANCE_AUTHORITY_REPLAYED:32551670593/u);
});

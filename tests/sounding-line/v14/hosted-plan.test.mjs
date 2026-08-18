import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildV14HostedPlan, resolvePlanAuthority } from "../../../scripts/sounding-line/planner.mjs";
import {
  batchPhysicalWorkers,
  validatePhysicalWorkerMatrix,
} from "../../../scripts/sounding-line/v14/physical-worker-batching.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const execute = promisify(execFile);
const json = async (file) => JSON.parse(await readFile(path.join(root, "testing", file), "utf8"));

test("v1.4 hosted plan carries the semantic plan and worker-compatible dependency waves", async () => {
  const sourceSha = (await execute("git", ["-C", root, "rev-parse", "HEAD"])).stdout.trim();
  // Governed workers intentionally check out only the sealed source commit.
  // A self-test must not require an unsealed parent merely to build its
  // deterministic semantic plan fixture.
  const qualifiedBaseSha = sourceSha;
  const [manifest, registry, authorityIndex] = await Promise.all([
    json("policy-manifest.json"),
    json("generated/active-test-registry.json"),
    json("sounding-line-authority.json"),
  ]);
  const plan = await buildV14HostedPlan({
    root,
    gateId: "mainline",
    serial: false,
    sourceSha,
    qualifiedBaseSha,
    manifest,
    registry,
    authorityIndex,
  });
  assert.equal(plan.authorityBoundary, "CURRENT_AUTHORITATIVE_V14");
  assert.equal(plan.semanticPlanDigest.length, 64);
  assert.equal(plan.planDigest.length, 64);
  assert.equal(plan.selectionContract.selectionMode, "EXACT_SEMANTIC_IMPACT_WITH_REQUIRED_SENTINELS");
  assert.ok(Array.isArray(plan.selectionLedger));
  assert.ok(plan.evidenceDispositionCounts.FRESH >= 1);
  assert.ok(plan.nodes.every((node) => Array.isArray(node.testIds)));
  for (const node of plan.nodes)
    for (const dependency of node.dependencies)
      assert.ok(plan.nodes.find((candidate) => candidate.id === dependency).execution.wave < node.execution.wave);
  for (const node of plan.nodes.filter((candidate) => candidate.adapter === "playwright-family")) {
    const selectedEngines = new Set(
      registry.cases
        .filter((entry) => entry.suiteId === node.id)
        .flatMap((entry) => entry.resources.filter((resource) => resource.startsWith("browser-"))),
    );
    for (const engine of selectedEngines)
      assert.ok(node.resources.includes(engine), `hosted node ${node.id} omits ${engine}`);
    const partitions = node.browserPartitions ?? [];
    assert.ok(partitions.length >= 1, `hosted browser node ${node.id} has no physical partition`);
    assert.deepEqual(
      partitions.flatMap((partition) => partition.testIds).sort(),
      node.testIds.slice().sort(),
      `hosted browser node ${node.id} partitions every selected case exactly once`,
    );
    for (const partition of partitions) {
      assert.ok(["chromium", "webkit"].includes(partition.browserEngine));
      assert.ok(partition.testIds.length > 0);
    }
  }
  const physical = [];
  for (const [key, nodes] of Object.entries(
    Object.groupBy(plan.nodes, (node) => `${node.execution.wave}:${node.execution.mode}`),
  )) {
    const [wave, mode] = key.split(":");
    physical.push(...batchPhysicalWorkers(nodes, { wave: Number(wave), mode }));
  }
  assert.ok(physical.length >= plan.nodes.length);
  assert.ok(physical.every((batch) => batch && batch.emptyWave === false));
  assert.deepEqual(
    [...new Set(physical.flatMap((batch) => batch.suiteIds))].sort(),
    plan.nodes.map((node) => node.id).sort(),
  );
  assert.doesNotThrow(() => validatePhysicalWorkerMatrix({ include: physical }));
});

test("v1.4 candidate plans seal only a valid candidate branch ref into their digest", async () => {
  const sourceSha = (await execute("git", ["-C", root, "rev-parse", "HEAD"])).stdout.trim();
  const [manifest, registry, authorityIndex] = await Promise.all([
    json("policy-manifest.json"),
    json("generated/active-test-registry.json"),
    json("sounding-line-authority.json"),
  ]);
  const candidateRef = "refs/heads/codex/sounding-line-v14-candidate-ref";
  const candidate = await buildV14HostedPlan({
    root,
    gateId: "mainline",
    serial: false,
    sourceSha,
    qualifiedBaseSha: sourceSha,
    manifest,
    registry,
    authorityIndex,
    authorityMode: "V14_CANDIDATE",
    candidateRef,
  });
  const current = await buildV14HostedPlan({
    root,
    gateId: "mainline",
    serial: false,
    sourceSha,
    qualifiedBaseSha: sourceSha,
    manifest,
    registry,
    authorityIndex,
    authorityMode: "V14_CURRENT",
  });

  assert.equal(candidate.candidateRef, candidateRef);
  assert.equal(current.candidateRef, null);
  assert.notEqual(candidate.planDigest, current.planDigest);
  await assert.rejects(
    () =>
      buildV14HostedPlan({
        root,
        gateId: "mainline",
        serial: false,
        sourceSha,
        qualifiedBaseSha: sourceSha,
        manifest,
        registry,
        authorityIndex,
        authorityMode: "V14_CANDIDATE",
      }),
    /V14_CANDIDATE_REF_REQUIRED/u,
  );
  await assert.rejects(
    () =>
      buildV14HostedPlan({
        root,
        gateId: "mainline",
        serial: false,
        sourceSha,
        qualifiedBaseSha: sourceSha,
        manifest,
        registry,
        authorityIndex,
        authorityMode: "V14_CANDIDATE",
        candidateRef: "refs/remotes/origin/candidate",
      }),
    /V14_CANDIDATE_REF_INVALID/u,
  );
  await assert.rejects(
    () =>
      buildV14HostedPlan({
        root,
        gateId: "mainline",
        serial: false,
        sourceSha,
        qualifiedBaseSha: sourceSha,
        manifest,
        registry,
        authorityIndex,
        authorityMode: "V14_CURRENT",
        candidateRef,
      }),
    /V14_NON_CANDIDATE_REF_FORBIDDEN/u,
  );
});

test("v1.4 current authority is restricted to protected main while v1.3 cutover remains pre-activation only", () => {
  const v14Authority = { currentAuthorityVersion: "1.4" };
  assert.throws(
    () =>
      resolvePlanAuthority({
        authorityIndex: v14Authority,
        gateId: "mainline",
        authorityMode: "CURRENT",
        githubRef: "refs/heads/candidate",
      }),
    /V14_CURRENT_AUTHORITY_REQUIRES_PROTECTED_MAIN/u,
  );
  assert.equal(
    resolvePlanAuthority({
      authorityIndex: v14Authority,
      gateId: "mainline",
      authorityMode: "CURRENT",
      githubRef: "refs/heads/main",
    }),
    "V14_CURRENT",
  );
  assert.throws(
    () =>
      resolvePlanAuthority({
        authorityIndex: v14Authority,
        gateId: "mainline",
        authorityMode: "V13_CUTOVER",
        githubRef: "refs/heads/candidate",
      }),
    /V13_CUTOVER_FORBIDDEN_AFTER_V14_ACTIVATION/u,
  );
  assert.throws(
    () =>
      resolvePlanAuthority({
        authorityIndex: v14Authority,
        gateId: "release-candidate",
        authorityMode: "CURRENT",
        githubRef: "refs/heads/main",
      }),
    /V14_AUTHORITY_MAINLINE_ONLY/u,
  );

  assert.equal(
    resolvePlanAuthority({
      authorityIndex: v14Authority,
      gateId: "mainline",
      authorityMode: "V14_OWNER_BOOTSTRAP",
      githubRef: "refs/heads/codex/one-shot-bootstrap",
      qualifiedBaseSha: sha("b"),
    }),
    "V14_CANDIDATE",
  );
  assert.equal(
    resolvePlanAuthority({
      authorityIndex: v14Authority,
      gateId: "mainline",
      authorityMode: "V14_OWNER_AUTHORIZED",
      githubRef: "refs/heads/main",
      qualifiedBaseSha: sha("c"),
    }),
    "V14_CANDIDATE",
  );
  assert.throws(
    () =>
      resolvePlanAuthority({
        authorityIndex: v14Authority,
        gateId: "mainline",
        authorityMode: "V14_OWNER_AUTHORIZED",
        githubRef: "refs/heads/codex/untrusted",
        qualifiedBaseSha: sha("d"),
      }),
    /V14_OWNER_AUTHORIZED_TRUSTED_MAIN_WORKFLOW_REQUIRED/u,
  );
});

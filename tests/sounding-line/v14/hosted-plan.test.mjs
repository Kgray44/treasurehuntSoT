import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildV14HostedPlan, resolvePlanAuthority } from "../../../scripts/sounding-line/planner.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const execute = promisify(execFile);
const json = async (file) => JSON.parse(await readFile(path.join(root, "testing", file), "utf8"));

test("v1.4 hosted plan carries the semantic plan and worker-compatible dependency waves", async () => {
  const sourceSha = (await execute("git", ["-C", root, "rev-parse", "HEAD"])).stdout.trim();
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
    qualifiedBaseSha: "0055d012a121a8950b7fa70d371d5eafc6223d10",
    manifest,
    registry,
    authorityIndex,
  });
  assert.equal(plan.authorityBoundary, "CURRENT_AUTHORITATIVE_V14");
  assert.equal(plan.semanticPlanDigest.length, 64);
  assert.equal(plan.planDigest.length, 64);
  assert.ok(plan.nodes.every((node) => Array.isArray(node.testIds)));
  for (const node of plan.nodes)
    for (const dependency of node.dependencies)
      assert.ok(plan.nodes.find((candidate) => candidate.id === dependency).execution.wave < node.execution.wave);
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
});

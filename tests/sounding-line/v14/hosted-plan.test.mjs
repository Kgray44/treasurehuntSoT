import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildV14HostedPlan } from "../../../scripts/sounding-line/planner.mjs";

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
  for (const node of plan.nodes)
    for (const dependency of node.dependencies)
      assert.ok(plan.nodes.find((candidate) => candidate.id === dependency).execution.wave < node.execution.wave);
});

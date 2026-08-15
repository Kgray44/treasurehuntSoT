import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  calculateMaximumLegalWave,
  validateHostedPlanCapacity,
  validateHostedWaveCapacity,
  validateHostedWorkflowCapacity,
} from "../../scripts/sounding-line/hosted-wave-capacity.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const authority = JSON.parse(await readFile(path.join(root, "testing", "sounding-line-authority.json"), "utf8"));
const suites = JSON.parse(await readFile(path.join(root, "testing", "suites.json"), "utf8"));

test("hosted capacity provides deliberate headroom over the maximum legal governed dependency depth", () => {
  const legal = calculateMaximumLegalWave(suites.suites);
  assert.equal(legal.maximumWave, 3);
  assert.deepEqual(legal.deepestSuiteIds, ["browser.wakebook"]);
  const capacity = validateHostedWaveCapacity({ capacity: authority.hostedExecutionCapacity, suites: suites.suites });
  assert.equal(capacity.valid, true, capacity.errors.join("\n"));
  assert.equal(authority.hostedExecutionCapacity.maximumWave, 5);
  assert.equal(authority.hostedExecutionCapacity.minimumHeadroom, 2);
});

test("hosted capacity accepts wave 3 parallel and exclusive work but rejects every overflow", () => {
  const valid = validateHostedPlanCapacity({
    capacity: authority.hostedExecutionCapacity,
    plan: {
      nodes: [
        { id: "wave-3-parallel", execution: { mode: "parallel", wave: 3 } },
        { id: "wave-3-exclusive", execution: { mode: "exclusive", wave: 3 } },
      ],
    },
  });
  assert.equal(valid.valid, true, valid.errors.join("\n"));
  const overflow = validateHostedPlanCapacity({
    capacity: authority.hostedExecutionCapacity,
    plan: { nodes: [{ id: "overflow", execution: { mode: "parallel", wave: 6 } }] },
  });
  assert.equal(overflow.valid, false);
  assert.deepEqual(overflow.errors, ["HOSTED_EXECUTION_WAVE_CAPACITY_EXCEEDED:overflow:6"]);
});

test("hosted workflow capacity is contract-bound through every wave and evidence closure", async () => {
  const workflow = await readFile(path.join(root, ".github", "workflows", "sounding-line-authoritative.yml"), "utf8");
  const topology = validateHostedWorkflowCapacity({ capacity: authority.hostedExecutionCapacity, workflow });
  assert.equal(topology.valid, true, topology.errors.join("\n"));
  assert.match(workflow, /governed-parallel-wave-3:[\s\S]*?needs: \[plan, wave-2-complete\]/u);
  assert.match(workflow, /governed-exclusive-wave-3:[\s\S]*?needs: \[plan, wave-2-complete\]/u);
  assert.match(workflow, /wave-3-complete:[\s\S]*?governed-parallel-wave-3[\s\S]*?governed-exclusive-wave-3/u);
  assert.match(workflow, /finalizer:[\s\S]*?wave-3-complete[\s\S]*?sounding-line-worker-evidence-\*/u);
  assert.match(workflow, /HOSTED_EXECUTION_WAVE_CAPACITY_EXCEEDED/u);
});

test("empty exclusive matrices do not create skipped reusable-workflow callers", async () => {
  const workflow = await readFile(path.join(root, ".github", "workflows", "sounding-line-authoritative.yml"), "utf8");
  for (let wave = 0; wave <= authority.hostedExecutionCapacity.maximumWave; wave += 1) {
    const segment = workflow.match(
      new RegExp(`governed-exclusive-wave-${wave}:([\\s\\S]*?)(?=\\n  [A-Za-z0-9_-]+:|$)`, "u"),
    );
    assert.ok(segment, `exclusive caller missing for wave ${wave}`);
    assert.ok(segment[1].includes(`matrix: \${{ fromJSON(needs.plan.outputs.exclusive${wave}) }}`));
    assert.doesNotMatch(segment[1], /\n    if:/u);
  }
});

test("policy capacity qualification fails closed before hosted activation loses a deeper graph", () => {
  const deeper = [
    { id: "root", dependencies: [] },
    { id: "one", dependencies: ["root"] },
    { id: "two", dependencies: ["one"] },
    { id: "three", dependencies: ["two"] },
    { id: "four", dependencies: ["three"] },
  ];
  const result = validateHostedWaveCapacity({ capacity: authority.hostedExecutionCapacity, suites: deeper });
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("HOSTED_WAVE_CAPACITY_HEADROOM_INSUFFICIENT"));
});

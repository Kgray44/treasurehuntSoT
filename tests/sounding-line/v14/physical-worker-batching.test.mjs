import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import {
  batchPhysicalWorkers,
  canBatchPhysicalWorker,
} from "../../../scripts/sounding-line/v14/physical-worker-batching.mjs";

const exec = promisify(execFile);

const node = (id, adapter = "vitest-family", resources = ["node-slot"]) => ({
  id,
  adapter,
  resources,
  execution: { mode: "parallel", wave: 0 },
});

test("pure Node obligations share one physical worker but preserve logical receipt IDs", () => {
  const batches = batchPhysicalWorkers([node("unit.b"), node("unit.a")], { wave: 0 });
  assert.equal(batches.length, 1);
  assert.deepEqual(batches[0].suiteIds, ["unit.a", "unit.b"]);
  assert.equal(batches[0].suiteIdsJson, '["unit.a","unit.b"]');
});

test("database, browser, and exclusive work never batch", () => {
  const browser = node("browser.access", "playwright-family", ["application-port", "sqlite-clone", "browser-chromium"]);
  const exclusive = { ...node("external"), execution: { mode: "exclusive" } };
  assert.equal(canBatchPhysicalWorker(browser), false);
  assert.equal(canBatchPhysicalWorker(exclusive), false);
  assert.equal(batchPhysicalWorkers([node("unit.a"), browser, exclusive]).length, 3);
});

test("CLI creates a deterministic sealed-plan matrix without admitting undeclared work", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "sl14-physical-batch-"));
  const plan = path.join(root, "plan.json");
  await writeFile(plan, JSON.stringify({ nodes: [node("unit.b"), node("unit.a")] }), "utf8");
  const { stdout } = await exec(process.execPath, [
    "scripts/sounding-line/v14/physical-worker-batching.mjs",
    "--plan",
    plan,
    "--wave",
    "0",
    "--mode",
    "parallel",
  ]);
  assert.deepEqual(JSON.parse(stdout).include[0].suiteIds, ["unit.a", "unit.b"]);
  assert.equal(JSON.parse(stdout).include[0].suiteIdsJson, '["unit.a","unit.b"]');
});

test("ordinary and train workers receive the preserved JSON-array contract instead of a flattened matrix value", async () => {
  for (const workflow of [
    ".github/workflows/sounding-line-authoritative.yml",
    ".github/workflows/sounding-line-train-wave.yml",
  ]) {
    const source = await readFile(workflow, "utf8");
    assert.doesNotMatch(source, /toJSON\(matrix\.suiteIds\)/u);
    assert.match(source, /suites_json: \$\{\{ matrix\.suiteIdsJson \}\}/u);
  }
  const worker = await readFile(".github/workflows/sounding-line-governed-worker.yml", "utf8");
  assert.match(worker, /SOUNDING_LINE_SUITES_JSON: \$\{\{ inputs\.suites_json \}\}/u);
  assert.match(worker, /GOVERNED_WORKER_RECEIPT_BATCH_BOUNDARY_INVALID/u);
  assert.doesNotMatch(worker, /\$receipts\.Count -ne 1/u);
});

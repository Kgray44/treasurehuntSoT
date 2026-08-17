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
  validatePhysicalWorkerMatrix,
} from "../../../scripts/sounding-line/v14/physical-worker-batching.mjs";

const exec = promisify(execFile);

const node = (id, adapter = "vitest-family", resources = ["node-slot"]) => ({
  id,
  adapter,
  resources,
  execution: { mode: "parallel", wave: 0 },
});

const browserNode = (id, browserPartitions) => ({
  id,
  adapter: "playwright-family",
  resources: [
    "application-port",
    "sqlite-clone",
    "trace-root",
    ...browserPartitions.map(({ browserEngine }) => `browser-${browserEngine}`),
  ],
  testIds: browserPartitions.flatMap(({ testIds }) => testIds),
  browserPartitions,
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

test("Chromium-only and WebKit-only browser obligations retain one compatible physical batch", () => {
  const chromium = browserNode("browser.chromium", [{ browserEngine: "chromium", testIds: ["case-c"] }]);
  const webkit = browserNode("browser.webkit", [{ browserEngine: "webkit", testIds: ["case-w"] }]);
  const chromiumBatch = batchPhysicalWorkers([chromium], { wave: 0, mode: "parallel" });
  const webkitBatch = batchPhysicalWorkers([webkit], { wave: 0, mode: "parallel" });
  assert.equal(chromiumBatch.length, 1);
  assert.equal(chromiumBatch[0].browserEngine, "chromium");
  assert.equal(webkitBatch.length, 1);
  assert.equal(webkitBatch[0].browserEngine, "webkit");
});

test("mixed Chromium and WebKit logical work partitions exact selected browser cases without changing logical suite identities", () => {
  const mixed = browserNode("browser.mixed", [
    { browserEngine: "chromium", testIds: ["case-c1", "case-c2"] },
    { browserEngine: "webkit", testIds: ["case-w1"] },
  ]);
  const batches = batchPhysicalWorkers([mixed], { wave: 0, mode: "parallel" });
  assert.equal(batches.length, 2);
  assert.deepEqual(
    batches.map((batch) => batch.browserEngine),
    ["chromium", "webkit"],
  );
  assert.deepEqual(
    batches.map((batch) => batch.suiteIds),
    [["browser.mixed"], ["browser.mixed"]],
  );
  assert.deepEqual(
    batches.map((batch) => JSON.parse(batch.browserTestIdsBySuiteJson)),
    [{ "browser.mixed": ["case-c1", "case-c2"] }, { "browser.mixed": ["case-w1"] }],
  );
  assert.ok(batches.every((batch) => batch && batch.emptyWave === false));
});

test("physical batching fails closed for unknown, incomplete, duplicate, or mixed browser partition declarations", () => {
  const unknown = browserNode("browser.unknown", [{ browserEngine: "firefox", testIds: ["case-f"] }]);
  const incomplete = {
    ...browserNode("browser.incomplete", [{ browserEngine: "chromium", testIds: ["case-c"] }]),
    testIds: ["case-c", "case-w"],
  };
  const duplicate = browserNode("browser.duplicate", [
    { browserEngine: "chromium", testIds: ["case-c"] },
    { browserEngine: "webkit", testIds: ["case-c"] },
  ]);
  const mixed = {
    ...browserNode("browser.mixed-declaration", [{ browserEngine: "chromium", testIds: ["case-c"] }]),
    resources: ["application-port", "sqlite-clone", "trace-root", "browser-chromium", "browser-webkit"],
  };
  for (const invalid of [unknown, incomplete, duplicate, mixed])
    assert.throws(() => batchPhysicalWorkers([invalid]), /PHYSICAL_BATCH_BROWSER_PARTITION_INVALID/u);
});

test("matrix validation accepts valid partitioned work, rejects null, and leaves an actually empty lane for the explicit marker contract", () => {
  const valid = {
    include: batchPhysicalWorkers(
      [browserNode("browser.partitioned", [{ browserEngine: "chromium", testIds: ["case-c"] }])],
      { wave: 0, mode: "parallel" },
    ),
  };
  assert.deepEqual(validatePhysicalWorkerMatrix(valid).include, valid.include);
  assert.throws(() => validatePhysicalWorkerMatrix({ include: [null] }), /PHYSICAL_BATCH_MATRIX_INVALID/u);
  assert.deepEqual(validatePhysicalWorkerMatrix({ include: [] }).include, []);
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

test("normal-authority matrix construction and Wave 0 barrier fail closed on malformed physical entries while preserving empty-wave markers", async () => {
  const workflow = await readFile(".github/workflows/sounding-line-authoritative.yml", "utf8");
  assert.match(workflow, /PHYSICAL_BATCH_MATRIX_INVALID/u);
  assert.match(workflow, /SOUNDING_LINE_WAVE_MATRIX_INVALID/u);
  assert.match(workflow, /\$LASTEXITCODE -ne 0/u);
  assert.match(workflow, /throw \("PHYSICAL_BATCH_MATRIX_INVALID:\{0\}:\{1\}" -f \$mode, \$wave\)/u);
  assert.doesNotMatch(workflow, /PHYSICAL_BATCH_MATRIX_INVALID:\$mode:/u);
  assert.match(workflow, /browser_test_ids_by_suite_json: \$\{\{ matrix\.browserTestIdsBySuiteJson \}\}/u);
  assert.match(workflow, /suiteId = '__SOUNDING_LINE_EMPTY_WAVE__'/u);
  assert.doesNotMatch(workflow, /\{"include":\[null\]\}/u);
});

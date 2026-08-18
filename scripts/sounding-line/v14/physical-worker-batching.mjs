/* Deterministically batch only pure Node logical obligations into one VM. */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const pureNodeResources = new Set(["node-slot", "vitest-worker-pool"]);
const supportedBrowserEngines = new Set(["chromium", "webkit"]);
const requiresBrowser = (node) => (node.resources ?? []).some((resource) => resource.startsWith("browser-"));
const browserEnginesFor = (nodes) =>
  [
    ...new Set(
      nodes.flatMap((node) =>
        (node.resources ?? [])
          .filter((resource) => resource.startsWith("browser-"))
          .map((resource) => resource.slice(8)),
      ),
    ),
  ].sort();
const browserEngineFor = (nodes) => {
  const engines = browserEnginesFor(nodes);
  if (engines.length > 1) throw new Error("PHYSICAL_BATCH_MULTI_BROWSER_ENGINE_UNSUPPORTED");
  return engines[0] ?? "";
};

const orderedStrings = (value) => [...value].sort((left, right) => left.localeCompare(right));
const sameStrings = (left, right) => JSON.stringify(orderedStrings(left)) === JSON.stringify(orderedStrings(right));

function browserPartitionsFor(node) {
  const engines = browserEnginesFor([node]);
  if (!engines.length) return [];
  const partitions = node?.browserPartitions;
  // Non-family adapters and legacy single-engine browser nodes retain their
  // existing one-worker contract. A mixed declaration may never silently pick
  // an engine: it must carry the sealed exact case partition metadata.
  if (!Array.isArray(partitions) || !partitions.length) {
    if (engines.length === 1 && supportedBrowserEngines.has(engines[0])) return [];
    throw new Error(`PHYSICAL_BATCH_BROWSER_PARTITION_INVALID:${node?.id ?? "unknown"}`);
  }
  const seenTestIds = [];
  const normalized = partitions.map((partition) => {
    const browserEngine = partition?.browserEngine;
    const testIds = partition?.testIds;
    if (
      !supportedBrowserEngines.has(browserEngine) ||
      !Array.isArray(testIds) ||
      !testIds.length ||
      testIds.some((id) => typeof id !== "string" || !id)
    )
      throw new Error(`PHYSICAL_BATCH_BROWSER_PARTITION_INVALID:${node?.id ?? "unknown"}`);
    seenTestIds.push(...testIds);
    return { browserEngine, testIds: orderedStrings(testIds) };
  });
  if (
    new Set(normalized.map((partition) => partition.browserEngine)).size !== normalized.length ||
    !sameStrings(
      engines,
      normalized.map((partition) => partition.browserEngine),
    ) ||
    new Set(seenTestIds).size !== seenTestIds.length ||
    !sameStrings(node.testIds ?? [], seenTestIds)
  )
    throw new Error(`PHYSICAL_BATCH_BROWSER_PARTITION_INVALID:${node?.id ?? "unknown"}`);
  return normalized.sort((left, right) => left.browserEngine.localeCompare(right.browserEngine));
}

const batchFor = (nodes, shared, { browserEngine = "", browserTestIdsBySuite = {} } = {}) => {
  const suiteIds = nodes.map((node) => node.id);
  return {
    ...shared,
    suiteId: suiteIds[0],
    suiteIds,
    // GitHub's reusable-workflow matrix coerces nested arrays into scalar
    // values. Carry the exact array as an already-serialized string so the
    // worker receives the same fail-closed contract the authority parses.
    suiteIdsJson: JSON.stringify(suiteIds),
    ...(Object.keys(browserTestIdsBySuite).length
      ? { browserTestIdsBySuiteJson: JSON.stringify(browserTestIdsBySuite) }
      : { browserTestIdsBySuiteJson: "" }),
    requiresBrowser: nodes.some(requiresBrowser),
    browserEngine,
    batchId: `node-${digest({ shared, suiteIds, browserEngine, browserTestIdsBySuite }).slice(0, 16)}`,
    emptyWave: false,
  };
};

export function canBatchPhysicalWorker(node) {
  return (
    node?.execution?.mode === "parallel" &&
    ["vitest-family", "static", "policy", "inventory", "docs", "features", "architecture", "language"].includes(
      node.adapter,
    ) &&
    Array.isArray(node.resources) &&
    node.resources.every((resource) => pureNodeResources.has(resource))
  );
}

/** Logical receipts remain independent; this only removes duplicated VM setup. */
export function batchPhysicalWorkers(nodes, shared = {}) {
  if (!Array.isArray(nodes)) throw new Error("PHYSICAL_BATCH_NODES_REQUIRED");
  const ordered = [...nodes].sort((left, right) => left.id.localeCompare(right.id));
  const batches = [];
  let pending = [];
  const flush = () => {
    if (!pending.length) return;
    batches.push(batchFor(pending, shared));
    pending = [];
  };
  for (const node of ordered) {
    if (!canBatchPhysicalWorker(node)) {
      flush();
      const partitions = browserPartitionsFor(node);
      if (partitions.length) {
        for (const partition of partitions)
          batches.push(
            batchFor([node], shared, {
              browserEngine: partition.browserEngine,
              browserTestIdsBySuite: { [node.id]: partition.testIds },
            }),
          );
      } else batches.push(batchFor([node], shared, { browserEngine: browserEngineFor([node]) }));
      continue;
    }
    pending.push(node);
  }
  flush();
  return batches;
}

export function validatePhysicalWorkerMatrix(matrix) {
  if (!matrix || typeof matrix !== "object" || !Array.isArray(matrix.include))
    throw new Error("PHYSICAL_BATCH_MATRIX_INVALID");
  for (const batch of matrix.include) {
    if (!batch || typeof batch !== "object" || typeof batch.suiteId !== "string" || !batch.suiteId)
      throw new Error("PHYSICAL_BATCH_MATRIX_INVALID");
    if (batch.emptyWave === true) {
      if (
        batch.suiteId !== "__SOUNDING_LINE_EMPTY_WAVE__" ||
        batch.suiteIdsJson !== "[]" ||
        batch.requiresBrowser !== false ||
        batch.browserEngine !== ""
      )
        throw new Error("PHYSICAL_BATCH_MATRIX_INVALID");
      continue;
    }
    let suiteIds;
    try {
      suiteIds = JSON.parse(batch.suiteIdsJson);
    } catch {
      throw new Error("PHYSICAL_BATCH_MATRIX_INVALID");
    }
    if (
      !Array.isArray(batch.suiteIds) ||
      !batch.suiteIds.length ||
      typeof batch.suiteIdsJson !== "string" ||
      !Array.isArray(suiteIds) ||
      !sameStrings(batch.suiteIds, suiteIds) ||
      typeof batch.batchId !== "string" ||
      !batch.batchId ||
      typeof batch.requiresBrowser !== "boolean" ||
      (batch.requiresBrowser && !supportedBrowserEngines.has(batch.browserEngine)) ||
      (!batch.requiresBrowser && batch.browserEngine !== "")
    )
      throw new Error("PHYSICAL_BATCH_MATRIX_INVALID");
    if (batch.requiresBrowser && batch.browserTestIdsBySuiteJson) {
      if (typeof batch.browserTestIdsBySuiteJson !== "string") throw new Error("PHYSICAL_BATCH_MATRIX_INVALID");
      let selections;
      try {
        selections = JSON.parse(batch.browserTestIdsBySuiteJson);
      } catch {
        throw new Error("PHYSICAL_BATCH_MATRIX_INVALID");
      }
      if (!selections || typeof selections !== "object" || Array.isArray(selections))
        throw new Error("PHYSICAL_BATCH_MATRIX_INVALID");
      for (const suiteId of batch.suiteIds)
        if (!Array.isArray(selections[suiteId]) || !selections[suiteId].length)
          throw new Error("PHYSICAL_BATCH_MATRIX_INVALID");
    }
  }
  return matrix;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const value = (flag) => {
    const index = args.indexOf(flag);
    return index < 0 ? undefined : args[index + 1];
  };
  if (args.includes("--validate-matrix-stdin")) {
    let serialized = "";
    for await (const chunk of process.stdin) serialized += chunk;
    process.stdout.write(`${JSON.stringify(validatePhysicalWorkerMatrix(JSON.parse(serialized)))}\n`);
    process.exit(0);
  }
  const planPath = value("--plan");
  const wave = Number(value("--wave"));
  const mode = value("--mode");
  if (!planPath || !Number.isInteger(wave) || !["parallel", "exclusive"].includes(mode))
    throw new Error("PHYSICAL_BATCH_COMMAND_INVALID");
  const plan = JSON.parse(await readFile(path.resolve(planPath), "utf8"));
  process.stdout.write(
    `${JSON.stringify({
      include: batchPhysicalWorkers(
        plan.nodes.filter((node) => node.execution.wave === wave && node.execution.mode === mode),
        { wave, mode },
      ),
    })}\n`,
  );
}

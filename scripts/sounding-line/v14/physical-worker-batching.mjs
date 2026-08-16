/* Deterministically batch only pure Node logical obligations into one VM. */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const pureNodeResources = new Set(["node-slot", "vitest-worker-pool"]);
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
    const suiteIds = pending.map((node) => node.id);
    batches.push({
      ...shared,
      suiteId: suiteIds[0],
      suiteIds,
      requiresBrowser: pending.some(requiresBrowser),
      browserEngine: browserEngineFor(pending),
      batchId: `node-${digest({ shared, suiteIds }).slice(0, 16)}`,
      emptyWave: false,
    });
    pending = [];
  };
  for (const node of ordered) {
    if (!canBatchPhysicalWorker(node)) {
      flush();
      batches.push({
        ...shared,
        suiteId: node.id,
        suiteIds: [node.id],
        requiresBrowser: requiresBrowser(node),
        browserEngine: browserEngineFor([node]),
        batchId: `node-${node.id}`,
        emptyWave: false,
      });
      continue;
    }
    pending.push(node);
  }
  flush();
  return batches;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const value = (flag) => {
    const index = args.indexOf(flag);
    return index < 0 ? undefined : args[index + 1];
  };
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

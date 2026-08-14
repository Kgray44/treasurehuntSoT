/* Fail-closed validation for the active stable governed-test identity registry. */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { assertNoSilentDisappearance, normalizeManifest } from "./stable-test-identities.mjs";

const root = process.cwd();
const read = async (file) => JSON.parse(await readFile(path.join(root, file), "utf8"));
const [registry, manifest, suites, ledger] = await Promise.all([
  read("testing/generated/active-test-registry.json"),
  read("testing/governed-test-identities.json"),
  read("testing/suites.json"),
  read("testing/generated/p34-retirement-ledger.json"),
]);
const errors = [];
let index;
try {
  index = normalizeManifest(manifest);
} catch (error) {
  errors.push(error.message);
}
const activeIds = new Set();
const suiteIds = new Set(suites.suites.map((suite) => suite.id));
for (const entry of registry.cases ?? []) {
  if (entry.currentStatus !== "ACTIVE") continue;
  if (!entry.stableId || entry.id !== entry.stableId)
    errors.push(`ACTIVE_STABLE_ID_REQUIRED:${entry.file}:${entry.title}`);
  if (activeIds.has(entry.stableId)) errors.push(`DUPLICATE_ACTIVE_STABLE_ID:${entry.stableId}`);
  activeIds.add(entry.stableId);
  if (!suiteIds.has(entry.suiteId)) errors.push(`UNKNOWN_ACTIVE_SUITE_REFERENCE:${entry.stableId}:${entry.suiteId}`);
  if (index && !index.byStableId.has(entry.stableId)) errors.push(`UNKNOWN_ACTIVE_STABLE_ID:${entry.stableId}`);
}
if (index) {
  try {
    assertNoSilentDisappearance(manifest, activeIds);
  } catch (error) {
    errors.push(error.message);
  }
}
for (const row of ledger.rows ?? [])
  for (const stableId of row.canonicalReplacementTestIds ?? [])
    if (!activeIds.has(stableId)) errors.push(`UNKNOWN_P34_REPLACEMENT_STABLE_ID:${stableId}`);
if (errors.length) {
  process.stderr.write(`${errors.join("\n")}\n`);
  process.exitCode = 1;
} else {
  console.log(
    `Stable governed identities validated: active=${activeIds.size} aliases=${[...(manifest.identities ?? [])].flatMap((entry) => entry.legacyTestIds ?? []).length}.`,
  );
}

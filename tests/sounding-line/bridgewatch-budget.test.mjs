import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("serial Bridgewatch units retain their serial adapter and measured hosted execution budget", async () => {
  const suites = JSON.parse(await readFile(path.join(root, "testing", "suites.json"), "utf8"));
  const bridgewatch = suites.suites.find((suite) => suite.id === "unit.bridgewatch");

  assert.equal(bridgewatch.adapter, "vitest-family-serial");
  assert.equal(bridgewatch.parallelSafe, true);
  assert.equal(bridgewatch.expectedDurationMs, 240000);
  assert.equal(bridgewatch.hardBudgetMs, 480000);
  assert.ok(bridgewatch.hardBudgetMs <= 15 * 60 * 1000);
});

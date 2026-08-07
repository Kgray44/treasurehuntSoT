import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import path from "node:path";

const root = path.resolve(process.cwd(), "Development_Docs", "Projects", "Project_Homeport");
const registry = JSON.parse(
  await readFile(path.join(root, "Project_Homeport_Phase_7_Integrated_Journey_Registry.json"), "utf8"),
);
const fixture = JSON.parse(
  await readFile(path.join(root, "Project_Homeport_Phase_7_Integrated_Fixture_Manifest.json"), "utf8"),
);

test("Phase 7 registers journeys A through O with isolated clones", () => {
  assert.deepEqual(
    registry.journeys.map((entry) => entry.journeyId),
    [..."ABCDEFGHIJKLMNO"],
  );
  assert.equal(new Set(registry.journeys.map((entry) => entry.fixtureClone)).size, 15);
  assert.ok(registry.journeys.every((entry) => entry.rootRoute === "/"));
});

test("Phase 7 fixture contains every governed alias without an Administrator", () => {
  const aliases = fixture.aliases.map((entry) => entry.alias);
  assert.equal(aliases.length, 11);
  assert.ok(aliases.includes("RETURNING_FULL_CAPABILITY"));
  assert.ok(!aliases.includes("ADMINISTRATOR"));
});

test("Phase 7 evidence is source-bound and no journey is silently skipped", () => {
  assert.ok(registry.journeys.every((entry) => entry.sourceSha && entry.result !== "SKIPPED"));
  assert.ok(registry.journeys.every((entry) => entry.evidenceIds.length > 0 && entry.testContractIds.length > 0));
});

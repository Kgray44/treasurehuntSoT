import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { selectV14Mainline } from "../../scripts/sounding-line/v14/fast-channel.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const json = async (file) => JSON.parse(await readFile(path.join(root, "testing", file), "utf8"));

test("Project Trim semantic registration keeps known agent-context work bounded and unknown seams fail closed", async () => {
  const [suiteInventory, impact, registry] = await Promise.all([
    json("suites.json"),
    json("impact-map.json"),
    json("generated/active-test-registry.json"),
  ]);
  const phase2Cases = registry.cases.filter(
    (entry) => entry.file === "tests/agent-context/project-trim-phase2.test.mjs",
  );
  assert.equal(phase2Cases.length, 10);
  assert.ok(phase2Cases.every((entry) => entry.suiteId === "unit.agent-context"));
  assert.ok(phase2Cases.every((entry) => entry.owner === "project-trim"));
  assert.ok(phase2Cases.every((entry) => entry.contracts.includes("project-trim.minimum-sufficient-context")));
  const phase3Cases = registry.cases.filter(
    (entry) => entry.file === "tests/agent-context/project-trim-phase3.test.mjs",
  );
  assert.equal(phase3Cases.length, 7);
  assert.ok(phase3Cases.every((entry) => entry.suiteId === "unit.agent-context"));
  assert.ok(phase3Cases.every((entry) => entry.owner === "project-trim"));
  assert.ok(phase3Cases.every((entry) => entry.contracts.includes("project-trim.minimum-sufficient-context")));
  const phase4Cases = registry.cases.filter(
    (entry) => entry.file === "tests/agent-context/project-trim-phase4.test.mjs",
  );
  assert.equal(phase4Cases.length, 7);
  assert.ok(phase4Cases.every((entry) => entry.suiteId === "unit.agent-context"));
  assert.ok(phase4Cases.every((entry) => entry.owner === "project-trim"));
  assert.ok(phase4Cases.every((entry) => entry.contracts.includes("project-trim.minimum-sufficient-context")));
  const select = (changedPaths) =>
    selectV14Mainline({
      changedPaths,
      suites: suiteInventory.suites,
      requiredSuiteIds: ["browser.access-sentinel"],
      ledgerSuiteIds: suiteInventory.suites.map((suite) => suite.id),
      impact,
    });

  const known = select(["scripts/agent-context/future-profile.mjs"]);
  assert.equal(known.fallback, null);
  assert.equal(known.ledger.find((entry) => entry.suiteId === "unit.agent-context").selectionReason, "DIRECT_IMPACT");
  assert.equal(
    known.ledger.find((entry) => entry.suiteId === "browser.access-sentinel").selectionReason,
    "REQUIRED_SENTINEL",
  );
  assert.equal(known.ledger.find((entry) => entry.suiteId === "unit.tideglass").evidenceDisposition, "PRESERVED");

  for (const unknownPath of [
    "scripts/agent-contextual/unmapped.mjs",
    "Development_Docs/Programs/Project_Trim_Experimental/unmapped.md",
    "src/unmapped-project-trim-seam.ts",
  ])
    assert.equal(select([unknownPath]).fallback?.disposition, "CONSERVATIVE_FALLBACK", unknownPath);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { selectV14Mainline } from "../../scripts/sounding-line/v14/fast-channel.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const json = async (file) => JSON.parse(await readFile(path.join(root, "testing", file), "utf8"));

test("Project Trim semantic registration keeps known agent-context work bounded and unknown seams fail closed", async () => {
  const [suiteInventory, impact] = await Promise.all([json("suites.json"), json("impact-map.json")]);
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

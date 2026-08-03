import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { discoverAppRouteSources } from "../../scripts/homeport/phase5-route-census.mjs";
import { knownPagePatterns } from "../../scripts/homeport/phase5-route-policy.mjs";
import { validatePhase5Reachability } from "../../scripts/homeport/validate-phase5-reachability.mjs";

const root = process.cwd();
const audit = "Development_Docs/Projects/Project_Homeport";
const generatedFiles = [
  `${audit}/Homeport_Control_Inventory.csv`,
  `${audit}/Homeport_Journey_Audit.md`,
  `${audit}/Homeport_Journey_Catalog.json`,
  `${audit}/Homeport_Navigation_Map.json`,
  `${audit}/Homeport_Nonconformity_Ledger.csv`,
  `${audit}/Homeport_Route_Inventory.json`,
  `${audit}/Homeport_Screen_Catalog.json`,
  `${audit}/Homeport_Screen_Contract_Catalog.json`,
  `${audit}/Homeport_Visual_Baseline_Manifest.json`,
  `${audit}/Project_Homeport_Phase_5_Compatibility_Route_Ledger.csv`,
  `${audit}/Project_Homeport_Phase_5_Dead_End_and_Return_Matrix.csv`,
  `${audit}/Project_Homeport_Phase_5_Desktop_Mobile_Reachability_Matrix.csv`,
  `${audit}/Project_Homeport_Phase_5_Dynamic_Source_Matrix.csv`,
  `${audit}/Project_Homeport_Phase_5_Natural_Path_Matrix.csv`,
  `${audit}/Project_Homeport_Phase_5_Route_Edge_Registry.json`,
  `${audit}/Project_Homeport_Phase_5_Route_Node_Registry.json`,
  `${audit}/Project_Homeport_Phase_5_Route_Reachability_Graph.json`,
  `${audit}/Project_Homeport_Phase_5_Tokenized_Route_Matrix.csv`,
  "testing/contracts.json",
  "testing/impact-map.json",
  "testing/ownership.json",
  "testing/suites.json",
  "testing/generated/active-test-registry.json",
];

const digests = () =>
  Object.fromEntries(
    generatedFiles.map((file) => [
      file,
      createHash("sha256")
        .update(readFileSync(path.join(root, file)))
        .digest("hex"),
    ]),
  );

test("Phase 5 source census and exclusive page policy remain in exact parity", () => {
  const pages = discoverAppRouteSources(root).filter((source) => source.kind === "page");
  assert.equal(new Set(pages.map((source) => source.pathPattern)).size, pages.length);
  assert.deepEqual(pages.map((source) => source.pathPattern).sort(), [...knownPagePatterns].sort());
});

test("Phase 5 graph independently clears source, reachability, capability, dead-end, and orphan gates", () => {
  const result = validatePhase5Reachability();
  assert.equal(result.outcome, "PHASE5_REACHABILITY_VALID");
  assert.equal(result.unexplainedOrdinaryOrphans, 0);
  assert.equal(result.nodes, result.pageSources);
});

test("Phase 5 inventory updater is byte-identical on its second provisional run", () => {
  execFileSync(process.execPath, ["scripts/homeport/apply-phase5-inventory-updates.mjs"], { cwd: root });
  const first = digests();
  execFileSync(process.execPath, ["scripts/homeport/apply-phase5-inventory-updates.mjs"], { cwd: root });
  assert.deepEqual(digests(), first);
});

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const files = [
  "Development_Docs/Projects/Project_Homeport/Homeport_Control_Inventory.csv",
  "Development_Docs/Projects/Project_Homeport/Homeport_Journey_Audit.md",
  "Development_Docs/Projects/Project_Homeport/Homeport_Journey_Catalog.json",
  "Development_Docs/Projects/Project_Homeport/Homeport_Navigation_Map.json",
  "Development_Docs/Projects/Project_Homeport/Homeport_Nonconformity_Ledger.csv",
  "Development_Docs/Projects/Project_Homeport/Homeport_Route_Inventory.json",
  "Development_Docs/Projects/Project_Homeport/Homeport_Screen_Catalog.json",
  "Development_Docs/Projects/Project_Homeport/Homeport_Screen_Contract_Catalog.json",
  "Development_Docs/Projects/Project_Homeport/Homeport_Visual_Baseline_Manifest.json",
  "Development_Docs/Projects/Project_Homeport/Project_Homeport_Phase_4_District_Registry.json",
  "Development_Docs/Projects/Project_Homeport/Project_Homeport_Phase_4_Public_Card_Contract.json",
  "Development_Docs/Projects/Project_Homeport/Project_Homeport_Phase_4_Search_and_Filter_Contract.json",
  "testing/contracts.json",
  "testing/ownership.json",
  "testing/impact-map.json",
  "testing/suites.json",
  "testing/generated/active-test-registry.json",
];
const digest = () =>
  Object.fromEntries(
    files.map((file) => [
      file,
      createHash("sha256")
        .update(readFileSync(path.join(root, file)))
        .digest("hex"),
    ]),
  );

test("Phase 4 artifact updater is byte-identical on its second final run", () => {
  execFileSync(process.execPath, ["scripts/homeport/apply-phase4-inventory-updates.mjs", "--final"], { cwd: root });
  const first = digest();
  execFileSync(process.execPath, ["scripts/homeport/apply-phase4-inventory-updates.mjs", "--final"], { cwd: root });
  assert.deepEqual(digest(), first);
});

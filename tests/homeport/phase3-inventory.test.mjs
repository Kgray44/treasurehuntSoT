import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { withInventoryWorkspace } from "./inventory-test-workspace.mjs";

const root = process.cwd();
const files = [
  "Homeport_Route_Inventory.json",
  "Homeport_Navigation_Map.json",
  "Homeport_Screen_Catalog.json",
  "Homeport_Screen_Contract_Catalog.json",
  "Homeport_Control_Inventory.csv",
  "Homeport_Journey_Catalog.json",
  "Homeport_Journey_Audit.md",
  "Homeport_Nonconformity_Ledger.csv",
  "Homeport_Visual_Baseline_Manifest.json",
].map((name) => path.join("Development_Docs", "Projects", "Project_Homeport", name));
files.push(
  ...["contracts.json", "ownership.json", "impact-map.json", "suites.json"].map((name) => path.join("testing", name)),
);
const digests = (workspace) =>
  Object.fromEntries(
    files.map((file) => [
      path.basename(file),
      createHash("sha256")
        .update(readFileSync(path.join(workspace, file)))
        .digest("hex"),
    ]),
  );

test("Phase 3 inventory updater is byte-idempotent and validates its cross references", () => {
  withInventoryWorkspace(
    (workspace) => {
      execFileSync(
        process.execPath,
        [path.join(root, "scripts/homeport/apply-phase3-inventory-updates.mjs"), "--final"],
        {
          cwd: workspace,
          stdio: "pipe",
        },
      );
      const first = digests(workspace);
      execFileSync(
        process.execPath,
        [path.join(root, "scripts/homeport/apply-phase3-inventory-updates.mjs"), "--final"],
        {
          cwd: workspace,
          stdio: "pipe",
        },
      );
      assert.deepEqual(digests(workspace), first);
      execFileSync(process.execPath, [path.join(root, "scripts/homeport/validate-phase3-contracts.mjs")], {
        cwd: workspace,
        stdio: "pipe",
      });
    },
    { evidence: true },
  );
});

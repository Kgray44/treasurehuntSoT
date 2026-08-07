import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  implementationSourceSha,
  phase6ContractIds,
  stateVocabulary,
  viewports,
} from "../../scripts/homeport/phase6-surface-model.mjs";

const root = process.cwd();
const auditRoot = path.join(root, "Development_Docs", "Projects", "Project_Homeport");
const evidenceRoot = path.join(auditRoot, "evidence", "phase6");
const testingRoot = path.join(root, "testing");
const json = (name, directory = auditRoot) => JSON.parse(readFileSync(path.join(directory, name), "utf8"));
const registry = () => json("Project_Homeport_Phase_6_Screen_Acceptance_Registry.json");
const matrix = (name) => parseCsv(readFileSync(path.join(auditRoot, name), "utf8"));

test("Phase 6 screen census discovers every page and records boundaries without duplicate source mapping", () => {
  const current = registry();
  const pages = execFileSync("rg", ["--files", "src/app", "-g", "page.tsx"], { encoding: "utf8" })
    .trim()
    .split(/\r?\n/u)
    .filter(Boolean);
  const loading = execFileSync("rg", ["--files", "src/app", "-g", "loading.tsx"], { encoding: "utf8" })
    .trim()
    .split(/\r?\n/u)
    .filter(Boolean);
  const errors = execFileSync("rg", ["--files", "src/app", "-g", "error.tsx"], { encoding: "utf8" })
    .trim()
    .split(/\r?\n/u)
    .filter(Boolean);
  assert.equal(current.census.pageRoutes, pages.length);
  assert.equal(current.census.pageRoutes, 90);
  assert.ok(current.census.loadingBoundaries >= 1);
  assert.ok(
    current.census.loadingBoundaries <= loading.length,
    "Later Homeport corrections may add loading boundaries without rewriting the source-bound Phase 6 registry.",
  );
  assert.equal(current.census.errorBoundaries, errors.length);
  assert.equal(current.census.omittedPages, 0);
  const pageSources = current.screens
    .flatMap((screen) => screen.sourceFiles)
    .filter((file) => file.endsWith("page.tsx"));
  assert.equal(new Set(pageSources).size, pages.length);
});

test("screen acceptance registry has valid identity, ownership, source, criticality, maturity, and contracts", () => {
  const current = registry();
  assert.equal(current.sourceSha, implementationSourceSha);
  assert.equal(current.screens.length, 97);
  assert.equal(new Set(current.screens.map((screen) => screen.screenId)).size, current.screens.length);
  for (const screen of current.screens) {
    if (screen.screenId.startsWith("screen-state-")) assert.equal(screen.routeIds.length, 0);
    else assert.ok(screen.routeIds.length > 0);
    assert.ok(screen.sourceFiles.every((file) => existsSync(path.join(root, file))));
    assert.match(screen.criticality, /^(CRITICAL|HIGH|STANDARD|CONTEXTUAL|DEVELOPMENT_ONLY)$/u);
    assert.match(
      screen.finalMaturity,
      /^(VISUALLY_COMPLETE|COMPLETE_WITH_TRUTHFUL_EXTERNAL_LIMITATION|DEVELOPMENT_ONLY|NOT_APPLICABLE|BLOCKED_WITH_GOVERNED_REASON)$/u,
    );
    assert.ok(screen.specialistOwner);
    assert.ok(screen.integrationOwner);
    assert.ok(screen.shellMode);
    assert.ok(screen.applicableStates.length > 0);
    assert.ok(screen.testContractIds.includes("homeport.surface.source-parity"));
    assert.equal(screen.sourceSha, implementationSourceSha);
  }
});

test("page-state matrix uses the governed vocabulary and keeps loading, empty, auth, and permission distinct", () => {
  const rows = matrix("Project_Homeport_Phase_6_Page_State_Matrix.csv");
  assert.ok(rows.length >= 1_000);
  assert.ok(rows.every((row) => stateVocabulary.includes(row.state)));
  for (const screen of registry().screens) {
    const states = new Set(rows.filter((row) => row.screen_id === screen.screenId).map((row) => row.state));
    for (const state of screen.applicableStates) assert.ok(states.has(state), `${screen.screenId}:${state}`);
    const authRequired = rows.find((row) => row.screen_id === screen.screenId && row.state === "AUTH_REQUIRED");
    const permissionRestricted = rows.find(
      (row) => row.screen_id === screen.screenId && row.state === "PERMISSION_RESTRICTED",
    );
    if (authRequired?.applicable === "YES" && permissionRestricted?.applicable === "YES") {
      assert.notEqual(
        authRequired.visual_composition,
        permissionRestricted.visual_composition,
        `${screen.screenId}:AUTH_REQUIRED:PERMISSION_RESTRICTED`,
      );
    }
  }
  assert.notEqual(
    rows.find((row) => row.state === "INITIAL_LOADING")?.visual_composition,
    rows.find((row) => row.state === "READY_EMPTY")?.visual_composition,
  );
});

test("responsive and accessibility matrices cover every critical and high screen", () => {
  const responsive = matrix("Project_Homeport_Phase_6_Responsive_Matrix.csv");
  const accessibility = matrix("Project_Homeport_Phase_6_Accessibility_Matrix.csv");
  for (const screen of registry().screens.filter((entry) => ["CRITICAL", "HIGH"].includes(entry.criticality))) {
    const families = new Set(
      responsive.filter((row) => row.screen_id === screen.screenId).map((row) => row.viewport_family),
    );
    for (const [family] of viewports) assert.ok(families.has(family), `${screen.screenId}:${family}`);
    assert.ok(
      accessibility.some((row) => row.screen_id === screen.screenId),
      screen.screenId,
    );
  }
});

test("component families are unique, source-backed, semantic, responsive, accessible, and actively consumed", () => {
  const families = json("Project_Homeport_Phase_6_Component_Family_Registry.json").families;
  assert.equal(new Set(families.map((family) => family.familyId)).size, families.length);
  for (const family of families) {
    assert.ok(
      family.sourceComponents.every((file) => existsSync(path.join(root, file))),
      family.familyId,
    );
    assert.ok(family.productAreaConsumers.length > 0, family.familyId);
    assert.ok(family.semanticContract);
    assert.ok(family.responsiveContract);
    assert.ok(family.accessibilityContract);
    assert.deepEqual(family.deprecatedDuplicates, []);
  }
});

test("Sounding Line registers every Phase 6 contract with unit, component, browser, and impact authority", () => {
  assert.equal(phase6ContractIds.length, 55);
  assert.equal(new Set(phase6ContractIds).size, phase6ContractIds.length);
  const contracts = json("contracts.json", testingRoot);
  const suites = json("suites.json", testingRoot);
  const impactMap = json("impact-map.json", testingRoot);
  assert.match(
    contracts.status,
    /^(?:phase-6-homeport-product-surfaces-validated|phase-7-owner-correction-round-3-pending-owner-rereview)$/u,
  );
  for (const contractId of phase6ContractIds) {
    const contract = contracts.contracts.find((candidate) => candidate.id === contractId);
    assert.equal(contract?.authority, "project-homeport", contractId);
    assert.deepEqual(contract?.owners, ["project-homeport"], contractId);
    assert.equal(contract?.critical, true, contractId);
    assert.deepEqual(
      impactMap.contractMappings.find((mapping) => mapping.contractId === contractId)?.suiteIds,
      ["unit.homeport", "component.homeport", "browser.homeport"],
      contractId,
    );
  }
  for (const suiteId of ["unit.homeport", "component.homeport", "browser.homeport"]) {
    const suite = suites.suites.find((candidate) => candidate.id === suiteId);
    assert.match(
      suite?.currentImplementationState ?? "",
      /^(?:phase-6-homeport-product-surface-contract-family|phase-7-owner-correction-round-3-source-bound)$/u,
    );
    for (const contractId of phase6ContractIds)
      assert.ok(suite.contracts.includes(contractId), `${suiteId}:${contractId}`);
  }
});

test("visual evidence exists, is checksum-valid, source-bound, fixture-bound, viewport-bound, and accepted", () => {
  const manifest = json("manifest.json", evidenceRoot);
  const ids = new Set();
  assert.equal(manifest.sourceSha, implementationSourceSha);
  assert.ok(manifest.records.length >= 70);
  for (const record of manifest.records) {
    assert.ok(!ids.has(record.evidenceId));
    ids.add(record.evidenceId);
    assert.equal(record.sourceSha, implementationSourceSha);
    assert.equal(record.fixtureVersion, manifest.fixtureVersion);
    assert.equal(record.fixtureChecksum, manifest.fixtureChecksum);
    assert.equal(record.visualReviewClassification, "ACCEPTED");
    assert.match(record.viewport, /^\d+x\d+$/u);
    const screenshot = path.join(root, record.capturePath);
    assert.ok(existsSync(screenshot));
    assert.equal(createHash("sha256").update(readFileSync(screenshot)).digest("hex"), record.sha256);
  }
});

test("authoritative Phase 6 validator rejects raw or incomplete implementation surfaces", () => {
  const result = spawnSync(process.execPath, ["scripts/homeport/validate-phase6-surfaces.mjs"], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stdout || result.stderr);
  assert.match(result.stdout, /RAW_IMPLEMENTATION_GATE_CLEAR/u);
  assert.match(result.stdout, /PHASE_6_SURFACES_VISUALLY_COMPLETE/u);
});

test("Phase 6 updater is byte-idempotent and preserves historical route source identity", () => {
  const targets = [
    "Homeport_Route_Inventory.json",
    "Homeport_Screen_Catalog.json",
    "Homeport_Nonconformity_Ledger.csv",
    "Project_Homeport_Phase_6_Screen_Acceptance_Registry.json",
    "Project_Homeport_Phase_6_Page_State_Matrix.csv",
    "Project_Homeport_Phase_6_Visual_Evidence_Matrix.csv",
  ];
  runUpdater();
  const first = targets.map((name) => hash(path.join(auditRoot, name)));
  runUpdater();
  const second = targets.map((name) => hash(path.join(auditRoot, name)));
  assert.deepEqual(second, first);
  const routes = json("Homeport_Route_Inventory.json");
  assert.ok(JSON.stringify(routes).includes("bda5217a67d8ce2b56a02163371c137d9ed07275"));
});

function runUpdater() {
  const result = spawnSync(process.execPath, ["scripts/homeport/apply-phase6-inventory-updates.mjs", "--final"], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stdout || result.stderr);
}

function hash(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/u, ""));
      rows.push(row);
      row = [];
      field = "";
    } else field += character;
  }
  const [headers, ...records] = rows;
  return records
    .filter((record) => record.length === headers.length)
    .map((record) => Object.fromEntries(headers.map((header, index) => [header, record[index]])));
}

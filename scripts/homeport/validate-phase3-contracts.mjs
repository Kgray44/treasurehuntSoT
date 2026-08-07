import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const auditRoot = path.join(root, "Development_Docs", "Projects", "Project_Homeport");
const readJson = (name, directory = auditRoot) => JSON.parse(readFileSync(path.join(directory, name), "utf8"));
const registry = readJson("Project_Homeport_Phase_3_Section_Registry.json");
const routes = readJson("Homeport_Route_Inventory.json");
const screens = readJson("Homeport_Screen_Catalog.json");
const contracts = readJson("Homeport_Screen_Contract_Catalog.json");
const navigation = readJson("Homeport_Navigation_Map.json");
const journeys = readJson("Homeport_Journey_Catalog.json");
const visual = readJson("Homeport_Visual_Baseline_Manifest.json");
const manifest = readJson("manifest.json", path.join(auditRoot, "evidence", "phase3"));
const failures = [];
const requireValue = (condition, code) => {
  if (!condition) failures.push(code);
};

requireValue(registry.sections.length === 18, "SECTION_COUNT");
requireValue(new Set(registry.sections.map((section) => section.sectionId)).size === 18, "SECTION_ID_UNIQUENESS");
requireValue(
  new Set(registry.sections.map((section) => section.canonicalRoute)).size === 18,
  "SECTION_ROUTE_UNIQUENESS",
);
requireValue(manifest.evidence.length === 29, "EVIDENCE_COUNT");
requireValue(new Set(manifest.evidence.map((evidence) => evidence.evidenceId)).size === 29, "EVIDENCE_ID_UNIQUENESS");
requireValue(
  journeys.journeys.filter((journey) => journey.journeyId.startsWith("HP-P3-JRN-")).length === 31,
  "JOURNEY_COUNT",
);
requireValue(
  visual.records.filter((record) => record.evidenceId.startsWith("HP-P3-EV-")).length === 29,
  "VISUAL_RECORD_COUNT",
);

for (const section of registry.sections) {
  const route = routes.routes.find((candidate) => candidate.routePattern === section.canonicalRoute);
  requireValue(Boolean(route), "ROUTE:" + section.sectionId);
  requireValue(
    Boolean(route && screens.screens.some((screen) => screen.routeIds.includes(route.routeId))),
    "SCREEN:" + section.sectionId,
  );
  requireValue(
    Boolean(route && contracts.screens.some((screen) => screen.routeIds.includes(route.routeId))),
    "CONTRACT:" + section.sectionId,
  );
  requireValue(
    navigation.edges.some((edge) => edge.nodeId === "phase3-" + section.sectionId),
    "NAVIGATION:" + section.sectionId,
  );
  requireValue(
    route?.directUrlRequired === false && route?.orphanedOrdinaryRoute === false,
    "REACHABILITY:" + section.sectionId,
  );
}
for (const evidence of manifest.evidence) {
  const file = path.join(auditRoot, "evidence", "phase3", evidence.file);
  requireValue(existsSync(file), "EVIDENCE_FILE:" + evidence.evidenceId);
  if (existsSync(file)) {
    const digest = createHash("sha256").update(readFileSync(file)).digest("hex");
    requireValue(digest === evidence.sha256, "EVIDENCE_SHA:" + evidence.evidenceId);
  }
}
for (const matrix of [
  "Project_Homeport_Phase_3_Data_Projection_Matrix.csv",
  "Project_Homeport_Phase_3_Mutation_State_Matrix.csv",
  "Project_Homeport_Phase_3_Sensitive_Action_Matrix.csv",
  "Project_Homeport_Phase_3_Desktop_Mobile_Parity_Matrix.csv",
]) {
  const text = readFileSync(path.join(auditRoot, matrix), "utf8").trim();
  requireValue(text.split(/\r?\n/u).length > 2, "MATRIX:" + matrix);
}
if (failures.length) throw new Error("HOMEPORT_PHASE3_CONTRACT_FAILURES\n" + failures.join("\n"));
console.log(
  JSON.stringify(
    {
      status: "HOMEPORT_PHASE3_CONTRACTS_VALID",
      sections: 18,
      journeys: 31,
      evidence: 29,
      matrices: 4,
    },
    null,
    2,
  ),
);

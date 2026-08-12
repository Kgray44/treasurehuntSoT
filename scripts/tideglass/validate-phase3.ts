import { promises as fs } from "node:fs";
import path from "node:path";
import { TIDEGLASS_COMPARISON_POLICY_VERSION, TIDEGLASS_SEMANTIC_SCHEMA_VERSION } from "../../src/tideglass/core";
import { TIDEGLASS_PROJECTION_POLICY_VERSION } from "../../src/tideglass/intelligence";

const root = process.cwd();
const requiredFiles = [
  "Development_Docs/Projects/Project_Tideglass/Project_Tideglass_Phase_3_Active_Phase_Registration.json",
  "Development_Docs/Projects/Project_Tideglass/Project_Tideglass_Phase_3_Design_Record.md",
  "Development_Docs/Projects/Project_Tideglass/Project_Tideglass_Phase_3_Test_Plan.md",
  "Development_Docs/Projects/Project_Tideglass/Project_Tideglass_Phase_3_Route_and_Screen_Registration.json",
  "Development_Docs/Projects/Project_Tideglass/Project_Tideglass_Phase_3_Qualification_Record.md",
  "Development_Docs/Projects/Project_Tideglass/Project_Tideglass_Phase_3_Integration_Manifest.md",
  "Development_Docs/Projects/Project_Tideglass/Project_Tideglass_Phase_3_Product_Walkthrough.md",
  "scripts/tideglass/prepare-phase3-fixture.mjs",
  "scripts/tideglass/seed-phase3-fixture.mjs",
  "scripts/tideglass/run-phase3-journeys.mjs",
  "playwright.tideglass-phase3.config.ts",
  "tests/e2e/tideglass-phase3.spec.ts",
  "tests/tideglass/phase3-passage.test.ts",
  "tests/tideglass/phase3-passage-service.test.ts",
  "tests/tideglass/phase3-performance.test.ts",
  "src/components/tideglass/TideglassEditionCard.tsx",
  "src/components/tideglass/TideglassChangeCards.tsx",
];

async function main() {
  const missing = [];
  for (const file of requiredFiles) if (!(await exists(file))) missing.push(file);
  assert(missing.length === 0, `TIDEGLASS_PHASE3_REQUIRED_FILES_MISSING:${missing.join(",")}`);

  const [registration, routes, passage, service, apiRoute, studioService, studioComparison, browserTest] =
    await Promise.all([
      json("Development_Docs/Projects/Project_Tideglass/Project_Tideglass_Phase_3_Active_Phase_Registration.json"),
      json("Development_Docs/Projects/Project_Tideglass/Project_Tideglass_Phase_3_Route_and_Screen_Registration.json"),
      text("src/tideglass/passage.ts"),
      text("src/tideglass/passage-service.ts"),
      text("src/app/api/tideglass/chronicles/[taleSlug]/route.ts"),
      text("src/chronicle/studio-service.ts"),
      text("src/components/tideglass/TideglassStudioComparison.tsx"),
      text("tests/e2e/tideglass-phase3.spec.ts"),
    ]);

  assert(
    registration.project === "Project Tideglass" && registration.phase === "3",
    "phase registration is not Tideglass Phase 3",
  );
  assert(TIDEGLASS_SEMANTIC_SCHEMA_VERSION === "tideglass.semantic.v1", "semantic schema version drifted");
  assert(TIDEGLASS_COMPARISON_POLICY_VERSION === "tideglass.policy.v1", "comparison policy version drifted");
  assert(TIDEGLASS_PROJECTION_POLICY_VERSION === "tideglass.projection.v1", "projection policy version drifted");

  const routeIds = new Set((routes.routes as Array<{ routeId?: string }>).map((route) => route.routeId));
  for (const routeId of [
    "tideglass-chronicle-compare",
    "tideglass-passport-history-compare-redirect",
    "tideglass-studio-semantic-comparison",
  ])
    assert(routeIds.has(routeId), `required route missing: ${routeId}`);

  for (const state of [
    "LOADING",
    "POPULATED",
    "NO_CHANGE",
    "PARTIAL",
    "UP_TO_DATE",
    "NO_HISTORY",
    "MULTIPLE_HISTORY",
    "SOURCE_UNAVAILABLE",
    "TARGET_UNAVAILABLE",
    "UNAUTHORIZED",
    "REDACTED",
    "INCOMPATIBLE",
    "COMPARISON_FAILED",
    "RETRYING",
    "ANNOTATION_UNAVAILABLE",
    "MEDIA_UNAVAILABLE",
  ])
    assert(JSON.stringify(routes).includes(`\"${state}\"`), `governed route state missing: ${state}`);

  assert(passage.includes("safeTideglassReturnPath"), "comparison return path is not bounded");
  assert(passage.includes("requestedHistoryRecordId"), "history record selection is not explicit");
  assert(service.includes("isCurrent"), "current publishing pointer is not read from publishing truth");
  assert(service.includes("db.playerChronicleRecord"), "Wayfarer history adapter is absent");
  assert(!/contentSnapshot|creatorNotes|storageKey/u.test(apiRoute), "public passage API mentions a raw/private field");
  assert(
    !studioService.includes("comparePublishedVersions"),
    "legacy Studio raw comparator remains in the product service",
  );
  assert(studioComparison.includes("TideglassChangeCards"), "Studio does not render Tideglass semantic change cards");
  assert(browserTest.includes("Journeys A-J"), "browser journey record is incomplete");
  for (const id of [
    "TG3-EV-A",
    "TG3-EV-B",
    "TG3-EV-C",
    "TG3-EV-D",
    "TG3-EV-E",
    "TG3-EV-F",
    "TG3-EV-G",
    "TG3-EV-H",
    "TG3-EV-I",
    "TG3-EV-J",
  ])
    assert(browserTest.includes(id), `visual evidence capture missing: ${id}`);

  process.stdout.write(
    `${JSON.stringify({
      status: "TIDEGLASS_PHASE3_CONTRACTS_VALID",
      phaseStatus: registration.status,
      semanticSchemaVersion: TIDEGLASS_SEMANTIC_SCHEMA_VERSION,
      comparisonPolicyVersion: TIDEGLASS_COMPARISON_POLICY_VERSION,
      projectionPolicyVersion: TIDEGLASS_PROJECTION_POLICY_VERSION,
      registeredRoutes: routeIds.size,
      authorityDispatched: false,
    })}\n`,
  );
}

void main();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
async function exists(file: string) {
  return Boolean(await fs.stat(path.join(root, file)).catch(() => null));
}
async function text(file: string) {
  return fs.readFile(path.join(root, file), "utf8");
}
async function json(file: string) {
  return JSON.parse(await text(file)) as { project?: string; phase?: string; status?: string; routes?: unknown };
}

import { promises as fs } from "node:fs";
import path from "node:path";
import {
  TIDEGLASS_ANNOTATION_SCHEMA_VERSION,
  TIDEGLASS_CHANGE_CODE_REGISTRY_VERSION,
  TIDEGLASS_PROJECTION_POLICY_VERSION,
  TIDEGLASS_SUMMARY_POLICY_VERSION,
} from "../../src/tideglass/intelligence";
import { TIDEGLASS_COMPARISON_POLICY_VERSION, TIDEGLASS_SEMANTIC_SCHEMA_VERSION } from "../../src/tideglass/core";

const root = process.cwd();
const required = [
  "Development_Docs/Projects/Project_Tideglass/Project_Tideglass_Phase_2_Design_Record.md",
  "Development_Docs/Projects/Project_Tideglass/Project_Tideglass_Phase_2_Test_Plan.md",
  "Development_Docs/Projects/Project_Tideglass/Project_Tideglass_Phase_2_Validation_Record.md",
  "Development_Docs/Projects/Project_Tideglass/Project_Tideglass_Phase_2_Integration_Manifest.md",
  "Development_Docs/Projects/Project_Tideglass/Project_Tideglass_Phase_2_Completion_Receipt.md",
  "Development_Docs/Projects/Project_Tideglass/Project_Tideglass_Phase_2_Change_Code_Registry.json",
  "Development_Docs/Projects/Project_Tideglass/Project_Tideglass_Phase_2_Projection_Policy.json",
  "Development_Docs/Projects/Project_Tideglass/Project_Tideglass_Phase_2_Active_Phase_Registration.json",
  "Development_Docs/Projects/Project_Tideglass/Project_Tideglass_Phase_2_Migration_Reservation.json",
  "prisma/migrations/20260809130000_tideglass_phase2_creator_annotations/migration.sql",
  "prisma/mysql-migrations/0053_tideglass_phase2_creator_annotations/migration.sql",
];

async function main() {
  const missing = [];
  for (const file of required) if (!(await fs.stat(path.join(root, file)).catch(() => null))) missing.push(file);
  if (missing.length) throw new Error(`TIDEGLASS_PHASE2_REQUIRED_FILES_MISSING:${missing.join(",")}`);

  const [changeCodes, projection, sqliteSchema, mysqlSchema, sqliteMigration, mysqlMigration] = await Promise.all([
    json(required[5]),
    json(required[6]),
    text("prisma/schema.sqlite.prisma"),
    text("prisma/schema.prisma"),
    text(required[9]),
    text(required[10]),
  ]);

  assert(TIDEGLASS_SEMANTIC_SCHEMA_VERSION === "tideglass.semantic.v1", "semantic schema version drifted");
  assert(TIDEGLASS_COMPARISON_POLICY_VERSION === "tideglass.policy.v1", "comparison policy changed without review");
  assert(changeCodes.registryVersion === TIDEGLASS_CHANGE_CODE_REGISTRY_VERSION, "change-code version mismatch");
  assert(projection.projectionPolicyVersion === TIDEGLASS_PROJECTION_POLICY_VERSION, "projection version mismatch");
  assert(projection.summaryPolicyVersion === TIDEGLASS_SUMMARY_POLICY_VERSION, "summary version mismatch");
  assert(projection.annotationSchemaVersion === TIDEGLASS_ANNOTATION_SCHEMA_VERSION, "annotation version mismatch");
  assert(changeCodes.categories.length === 14, "all governed categories must be registered");
  assert(
    new Set(changeCodes.categories.map((entry: { prefix: string }) => entry.prefix)).size === 14,
    "code prefixes collide",
  );
  for (const audience of ["PUBLIC_PREVIEW", "PLAYER_SAFE", "CREATOR_FULL"])
    assert(projection.audiences[audience], `projection audience missing: ${audience}`);
  for (const source of [sqliteSchema, mysqlSchema, sqliteMigration, mysqlMigration]) {
    assert(source.includes("TideglassCreatorAnnotation"), "annotation model missing from provider declaration");
    assert(!/DROP\s+TABLE|DROP\s+COLUMN|DELETE\s+FROM|TRUNCATE/iu.test(source), "destructive migration token found");
  }
  assert(!sqliteSchema.includes("TideglassComparisonCache"), "cache must remain rebuildable and non-durable");
  assert(!mysqlSchema.includes("TideglassComparisonCache"), "cache must remain rebuildable and non-durable");

  const routeFiles = await listFiles(path.join(root, "src/app/api/chronicles"));
  for (const file of routeFiles) {
    const source = await fs.readFile(file, "utf8");
    assert(
      !/contentSnapshot|creatorNotes|storageKey/u.test(source),
      `raw/private snapshot field in API route: ${file}`,
    );
  }

  process.stdout.write(
    `${JSON.stringify({
      status: "TIDEGLASS_PHASE2_CONTRACTS_VALID",
      semanticSchemaVersion: TIDEGLASS_SEMANTIC_SCHEMA_VERSION,
      comparisonPolicyVersion: TIDEGLASS_COMPARISON_POLICY_VERSION,
      projectionPolicyVersion: TIDEGLASS_PROJECTION_POLICY_VERSION,
      summaryPolicyVersion: TIDEGLASS_SUMMARY_POLICY_VERSION,
      annotationSchemaVersion: TIDEGLASS_ANNOTATION_SCHEMA_VERSION,
      changeCodeCategories: changeCodes.categories.length,
      projectionAudiences: Object.keys(projection.audiences).length,
    })}\n`,
  );
}

void main();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
async function text(file: string) {
  return fs.readFile(path.join(root, file), "utf8");
}
async function json(file: string) {
  return JSON.parse(await text(file));
}
async function listFiles(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(target)));
    else files.push(target);
  }
  return files;
}

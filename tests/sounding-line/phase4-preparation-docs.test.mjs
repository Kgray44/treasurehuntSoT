import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const docs = [
  "Project_Sounding_Line_Phase_4_Preparation_Design_Record.md",
  "Project_Sounding_Line_Phase_4_CI_and_Distributed_Worker_Architecture.md",
  "Project_Sounding_Line_Phase_4_Worker_Trust_and_Security_Model.md",
  "Project_Sounding_Line_Phase_4_Dual_Run_Comparison_Specification.md",
  "Project_Sounding_Line_Phase_4_Release_Decision_and_Authority_Model.md",
  "Project_Sounding_Line_Phase_4_Cutover_and_Rollback_Plan.md",
  "Project_Sounding_Line_Phase_4_Performance_and_Capacity_Qualification.md",
  "Project_Sounding_Line_Phase_4_Evidence_Integrity_and_Retention.md",
  "Project_Sounding_Line_Phase_4_Incident_Exception_and_Revocation_Playbook.md",
  "Project_Sounding_Line_Phase_4_Final_Acceptance_Matrix.md",
  "Project_Sounding_Line_Phase_4_Prerequisite_Checklist.md",
  "Project_Sounding_Line_Phase_4_Preparation_Completion_Receipt.md",
  "Project_Sounding_Line_Phase_4_Post_Phase_2_Reconciliation_Record.md",
];
const directory = path.join(root, "Development_Docs", "Programs", "Sounding_Line");
const schemaDirectory = path.join(directory, "Phase_4_Drafts");

test("phase 4 preparation documents retain their nonimplementation boundary", async () => {
  for (const document of docs) {
    const content = await readFile(path.join(directory, document), "utf8");
    assert.match(content, /^---\r?\ntitle: /);
    assert.match(content, /status: planned/);
  }
  const design = await readFile(path.join(directory, docs[0]), "utf8");
  assert.match(design, /PREPARATION ONLY - NONAUTHORITATIVE/);
  assert.match(design, /does\s+not activate CI/);
});

test("phase 4 schema drafts parse and require future integrity identities", async () => {
  const names = [
    "worker-registration.schema.json",
    "sealed-plan-dispatch.schema.json",
    "evidence-manifest.schema.json",
    "release-decision.schema.json",
  ];
  for (const name of names) {
    const raw = await readFile(path.join(schemaDirectory, name), "utf8");
    const schema = JSON.parse(raw);
    assert.equal(schema.preparationOnly, true);
    assert.equal(schema.additionalProperties, false);
    assert.ok(Array.isArray(schema.required));
    assert.equal(JSON.stringify(JSON.parse(raw)), JSON.stringify(schema));
  }
  const worker = JSON.parse(await readFile(path.join(schemaDirectory, names[0]), "utf8"));
  assert.deepEqual(worker.properties.status.enum, [
    "REGISTERING",
    "AVAILABLE",
    "RESERVED",
    "EXECUTING",
    "DRAINING",
    "UNHEALTHY",
    "QUARANTINED",
    "REVOKED",
  ]);
});

test("acceptance and prerequisite records retain reconciled prerequisite truth", async () => {
  const matrix = await readFile(
    path.join(directory, "Project_Sounding_Line_Phase_4_Final_Acceptance_Matrix.md"),
    "utf8",
  );
  const prerequisites = await readFile(
    path.join(directory, "Project_Sounding_Line_Phase_4_Prerequisite_Checklist.md"),
    "utf8",
  );
  assert.match(matrix, /veto/);
  assert.match(matrix, /Stage 0/);
  assert.match(prerequisites, /Phase 1\s+\|\s+`ACCEPTED_AND_MAINLINE`/);
  assert.match(prerequisites, /Phase 2\s+\|\s+`ACCEPTED_AND_MAINLINE`/);
  assert.match(prerequisites, /Phase 3\s+\|\s+`PREPARATION_COMPLETE_IMPLEMENTATION_NOT_STARTED`/);
  const receipt = await readFile(
    path.join(directory, "Project_Sounding_Line_Phase_4_Preparation_Completion_Receipt.md"),
    "utf8",
  );
  assert.match(receipt, /PREPARATION REFRESH COMPLETE/);
});

test("post-phase-2 reconciliation retains local boundaries and exact usage fields", async () => {
  const record = await readFile(
    path.join(directory, "Project_Sounding_Line_Phase_4_Post_Phase_2_Reconciliation_Record.md"),
    "utf8",
  );
  for (const term of [
    "14 suites, 17 contracts, and 19 resources",
    "execution-isolation\\s+evidence only",
    "not dual-run authority, local/CI parity, distributed-worker",
    "P34-BME-20260729",
    "UNAVAILABLE_FROM_HOST",
  ]) {
    assert.match(record, new RegExp(term, "i"));
  }
});

test("worker, evidence, incident, and dual-run requirements have a preparation record", async () => {
  const all = await Promise.all(docs.map((document) => readFile(path.join(directory, document), "utf8")));
  const content = all.join("\n");
  for (const term of [
    "LOCAL_TRUSTED",
    "forged or replayed evidence",
    "unacceptable differences",
    "PLANNER_DEFECT",
    "emergency serial",
    "retention class",
  ]) {
    assert.match(content, new RegExp(term, "i"));
  }
});

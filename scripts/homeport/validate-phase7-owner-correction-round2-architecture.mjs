import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { evidenceIds, round2Decisions, round2Findings } from "./phase7-owner-correction-round2-model.mjs";

const docs = resolve(process.cwd(), "Development_Docs", "Projects", "Project_Homeport");

function fail(message) {
  throw new Error(`HOMEPORT_PHASE7_OWNER_CORRECTION_ROUND2_ARCHITECTURE_INVALID: ${message}`);
}

function read(relative) {
  const target = resolve(docs, relative);
  if (!existsSync(target)) fail(`missing ${relative}`);
  return readFileSync(target, "utf8").replaceAll("\r\n", "\n");
}

function parseCsv(text) {
  const lines = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/u, ""));
      if (row.some(Boolean)) lines.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  if (field || row.length) {
    row.push(field.replace(/\r$/u, ""));
    lines.push(row);
  }
  const [header, ...body] = lines;
  return body.map((values) => Object.fromEntries(header.map((key, index) => [key, values[index] ?? ""])));
}

const required = [
  "Project_Homeport_Phase_7_Owner_Walkthrough_Correction_Round_2_Architecture.md",
  "Project_Homeport_Phase_7_Owner_Feedback_Round_2_Ledger.csv",
  "Project_Homeport_Phase_7_Correction_Round_2_Acceptance_Matrix.csv",
  "Project_Homeport_Runtime_Fixture_Parity_Contract.md",
  "Project_Homeport_Global_Theme_and_Visual_Token_Contract.md",
  "Project_Homeport_Home_Ambient_and_Role_Card_Motion_Contract.md",
  "Project_Homeport_Community_Loading_State_Contract.md",
  "Project_Homeport_Public_Profile_and_Community_Identity_Contract.md",
  "Project_Homeport_Community_Rating_and_Save_Aggregation_Contract.md",
  "Project_Homeport_Chronicle_Completion_Review_Contract.md",
  "Project_Homeport_Chronicle_Preview_Expansion_Contract.md",
  "Project_Homeport_Experience_Images_Contract.md",
  "Project_Homeport_Phase_7_Correction_Round_2_Test_Plan.md",
  "Project_Homeport_Phase_7_Correction_Round_2_Implementation_Report.md",
  "Project_Homeport_Phase_7_Correction_Round_2_Validation_Record.md",
  "Project_Homeport_Phase_7_Correction_Round_2_Integration_Manifest.md",
  "evidence/phase7-owner-correction-round2/README.md",
  "evidence/phase7-owner-correction-round2/Project_Homeport_Phase_7_Correction_Round_2_Visual_Review.md",
  "evidence/phase7-owner-correction-round2/manifest.json",
];

for (const file of required) {
  const content = read(file);
  if (
    file.endsWith(".md") &&
    (!content.startsWith("---\n") || !content.includes("\nlast_reviewed: 2026-08-05\n---\n"))
  ) {
    fail(`${file} lacks current human-document frontmatter`);
  }
}

const owner = parseCsv(read("Project_Homeport_Phase_7_Owner_Feedback_Round_2_Ledger.csv"));
if (owner.length !== 85) fail(`expected 85 owner rows, received ${owner.length}`);
owner.forEach((row, offset) => {
  const expectedId = `HP-OWCR2-${String(offset + 1).padStart(3, "0")}`;
  const expectedNc = `HP-NC-${String(offset + 72).padStart(3, "0")}`;
  if (row.finding_id !== expectedId) fail(`owner row ${offset + 1} expected ${expectedId}`);
  if (row.owner_wording !== round2Findings[offset]) fail(`${expectedId} does not preserve owner wording`);
  if (row.correction_nonconformity !== expectedNc) fail(`${expectedId} expected ${expectedNc}`);
  if (!row.architecture_contract || !row.planned_test_contracts || !row.planned_evidence_ids)
    fail(`${expectedId} is untraced`);
  if (row.current_status !== "ARCHITECTURE_FROZEN_IMPLEMENTATION_PENDING")
    fail(`${expectedId} has false architecture status`);
});

const acceptance = parseCsv(read("Project_Homeport_Phase_7_Correction_Round_2_Acceptance_Matrix.csv"));
if (acceptance.length !== 85) fail(`expected 85 acceptance rows, received ${acceptance.length}`);
acceptance.forEach((row, offset) => {
  const suffix = String(offset + 1).padStart(3, "0");
  if (row.finding_id !== `HP-OWCR2-${suffix}` || row.acceptance_id !== `HP-OWCR2-AC-${suffix}`)
    fail(`acceptance row ${suffix} is not sequential`);
  if (!row.acceptance_criterion || !row.required_tests || !row.required_evidence || row.final_status !== "PLANNED")
    fail(`acceptance row ${suffix} is incomplete or falsely final`);
});

const nonconformities = parseCsv(read("Homeport_Nonconformity_Ledger.csv"));
const round2Nc = nonconformities.filter((row) =>
  /^HP-NC-(?:0(?:7[2-9]|8[0-9]|9[0-9])|1(?:[0-4][0-9]|5[0-6]))$/u.test(row.id),
);
if (round2Nc.length !== 85) fail(`expected HP-NC-072 through HP-NC-156, received ${round2Nc.length}`);
round2Nc.forEach((row, offset) => {
  if (row.id !== `HP-NC-${String(offset + 72).padStart(3, "0")}`)
    fail(`nonconformity row ${offset + 1} is not sequential`);
  if (row.current_status !== "ARCHITECTURE_FROZEN_IMPLEMENTATION_PENDING")
    fail(`${row.id} has false architecture status`);
});

const architecture = read("Project_Homeport_Phase_7_Owner_Walkthrough_Correction_Round_2_Architecture.md");
if (round2Decisions.length !== 35) fail("model lacks 35 frozen decisions");
round2Decisions.forEach(([name], offset) => {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  if (!new RegExp(`^\\|\\s*${offset + 1}\\s*\\|\\s*${escapedName}\\s*\\|`, "mu").test(architecture))
    fail(`architecture missing decision ${offset + 1}: ${name}`);
});
for (const state of [
  "OWNER_RETURNED_FOR_CORRECTION",
  "OWNER_REJECTED_WITH_ACTIONABLE_FINDINGS",
  "PENDING_OWNER_DECISION",
]) {
  if (!architecture.includes(state)) fail(`architecture missing ${state}`);
}

const decision = read("Project_Homeport_Phase_7_Owner_Decision_Record.md");
for (const state of [
  "OWNER_RETURNED_FOR_CORRECTION",
  "OWNER_REJECTED_WITH_ACTIONABLE_FINDINGS",
  "PENDING_OWNER_DECISION",
]) {
  if (!decision.includes(state)) fail(`owner decision history missing ${state}`);
}

const manifest = JSON.parse(read("evidence/phase7-owner-correction-round2/manifest.json"));
if (
  manifest.state !== "ARCHITECTURE_FROZEN_IMPLEMENTATION_PENDING" ||
  manifest.sourceSha !== null ||
  manifest.captures.length !== 0 ||
  JSON.stringify(manifest.requiredEvidenceIds) !== JSON.stringify(evidenceIds)
) {
  fail("evidence scaffold falsely claims implementation or is incomplete");
}

console.log(
  JSON.stringify(
    {
      result: "HOMEPORT_PHASE7_OWNER_CORRECTION_ROUND2_ARCHITECTURE_VALID",
      findings: owner.length,
      nonconformities: round2Nc.length,
      decisions: round2Decisions.length,
      evidenceContracts: evidenceIds.length,
    },
    null,
    2,
  ),
);

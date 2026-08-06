import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { evidenceIds, round3Decisions, round3Findings } from "./phase7-owner-correction-round3-model.mjs";

const docs = resolve(process.cwd(), "Development_Docs", "Projects", "Project_Homeport");

function fail(message) {
  throw new Error(`HOMEPORT_PHASE7_OWNER_CORRECTION_ROUND3_ARCHITECTURE_INVALID: ${message}`);
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
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
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
  "Project_Homeport_Phase_7_Owner_Walkthrough_Correction_Round_3_Architecture.md",
  "Project_Homeport_Phase_7_Owner_Feedback_Round_3_Ledger.csv",
  "Project_Homeport_Phase_7_Correction_Round_3_Acceptance_Matrix.csv",
  "Project_Homeport_Profile_Imagery_and_Crop_Contract.md",
  "Project_Homeport_Profile_Identity_Presentation_Contract.md",
  "Project_Homeport_Registration_Email_Code_Verification_Contract.md",
  "Project_Homeport_Postmark_Transactional_Email_Contract.md",
  "Project_Homeport_Workspace_Entry_and_Resource_Authority_Contract.md",
  "Project_Homeport_Route_Crossfade_Transition_Contract.md",
  "Project_Homeport_Account_Menu_Motion_Contract.md",
  "Project_Homeport_Dark_Default_and_Light_Deferral_Contract.md",
  "Project_Homeport_Phase_7_Correction_Round_3_Test_Plan.md",
  "Project_Homeport_Phase_7_Correction_Round_3_Implementation_Report.md",
  "Project_Homeport_Phase_7_Correction_Round_3_Validation_Record.md",
  "Project_Homeport_Phase_7_Correction_Round_3_Integration_Manifest.md",
  "evidence/phase7-owner-correction-round3/README.md",
  "evidence/phase7-owner-correction-round3/Project_Homeport_Phase_7_Correction_Round_3_Visual_Review.md",
  "evidence/phase7-owner-correction-round3/manifest.json",
];

for (const file of required) {
  const content = read(file);
  if (file.endsWith(".md") && (!content.startsWith("---\n") || !content.includes("\nlast_reviewed: 2026-08-05\n---\n")))
    fail(`${file} lacks current human-document frontmatter`);
}

const owner = parseCsv(read("Project_Homeport_Phase_7_Owner_Feedback_Round_3_Ledger.csv"));
if (owner.length !== 54) fail(`expected 54 owner rows, received ${owner.length}`);
owner.forEach((row, offset) => {
  const suffix = String(offset + 1).padStart(3, "0");
  if (row.finding_id !== `HP-OWCR3-${suffix}`) fail(`owner row ${suffix} is not sequential`);
  if (row.owner_wording !== round3Findings[offset]) fail(`${row.finding_id} does not preserve owner wording`);
  if (row.correction_nonconformity !== `HP-NC-${String(offset + 157).padStart(3, "0")}`)
    fail(`${row.finding_id} has the wrong nonconformity`);
  if (!row.architecture_contract || !row.planned_test_contracts || !row.planned_evidence_ids)
    fail(`${row.finding_id} is untraced`);
  if (row.current_status !== "ARCHITECTURE_FROZEN_IMPLEMENTATION_PENDING")
    fail(`${row.finding_id} falsely claims implementation`);
});

const acceptance = parseCsv(read("Project_Homeport_Phase_7_Correction_Round_3_Acceptance_Matrix.csv"));
if (acceptance.length !== 54) fail(`expected 54 acceptance rows, received ${acceptance.length}`);
acceptance.forEach((row, offset) => {
  const suffix = String(offset + 1).padStart(3, "0");
  if (row.finding_id !== `HP-OWCR3-${suffix}` || row.acceptance_id !== `HP-OWCR3-AC-${suffix}`)
    fail(`acceptance row ${suffix} is not sequential`);
  if (!row.acceptance_criterion || !row.required_tests || !row.required_evidence || row.final_status !== "PLANNED")
    fail(`acceptance row ${suffix} is incomplete or falsely finalized`);
});

const nonconformities = parseCsv(read("Homeport_Nonconformity_Ledger.csv"));
const round3Nc = nonconformities.filter((row) => {
  const match = /^HP-NC-(\d+)$/u.exec(row.id);
  const value = match ? Number(match[1]) : 0;
  return value >= 157 && value <= 210;
});
if (round3Nc.length !== 54) fail(`expected HP-NC-157 through HP-NC-210, received ${round3Nc.length}`);
round3Nc.forEach((row, offset) => {
  if (row.id !== `HP-NC-${String(offset + 157).padStart(3, "0")}`) fail(`nonconformity ${offset + 157} is missing`);
  if (row.current_status !== "ARCHITECTURE_FROZEN_IMPLEMENTATION_PENDING")
    fail(`${row.id} falsely claims implementation`);
});

const architecture = read("Project_Homeport_Phase_7_Owner_Walkthrough_Correction_Round_3_Architecture.md");
if (round3Decisions.length !== 42) fail("model lacks 42 frozen decisions");
round3Decisions.forEach(([name], offset) => {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  if (!new RegExp(`^\\|\\s*${offset + 1}\\s*\\|\\s*${escaped}\\s*\\|`, "mu").test(architecture))
    fail(`architecture missing decision ${offset + 1}: ${name}`);
});
for (const state of [
  "OWNER_RETURNED_FOR_CORRECTION",
  "OWNER_REJECTED_WITH_ACTIONABLE_FINDINGS",
  "PENDING_OWNER_DECISION",
  "POSTMARK_BLOCKED_EXTERNAL_CONFIGURATION",
])
  if (!architecture.includes(state)) fail(`architecture missing ${state}`);

const decision = read("Project_Homeport_Phase_7_Owner_Decision_Record.md");
if ((decision.match(/OWNER_REJECTED_WITH_ACTIONABLE_FINDINGS/gu) ?? []).length < 2)
  fail("owner decision record lacks both rejected re-reviews");
if (!decision.includes("Owner Re-Review Round 3 Decision: `PENDING_OWNER_DECISION`"))
  fail("owner decision record lacks pending Round 3 decision");

const manifest = JSON.parse(read("evidence/phase7-owner-correction-round3/manifest.json"));
if (
  manifest.state !== "ARCHITECTURE_FROZEN_IMPLEMENTATION_PENDING" ||
  manifest.sourceSha !== null ||
  manifest.captures.length !== 0
)
  fail("evidence scaffold falsely claims implementation or evidence");
if (manifest.transactionalEmail !== "POSTMARK_BLOCKED_EXTERNAL_CONFIGURATION")
  fail("architecture scaffold misstates Postmark configuration");
if (JSON.stringify(manifest.requiredEvidenceIds) !== JSON.stringify(evidenceIds))
  fail("evidence ID contract is incomplete");

console.log(
  JSON.stringify(
    {
      result: "HOMEPORT_PHASE7_OWNER_CORRECTION_ROUND3_ARCHITECTURE_VALID",
      findings: owner.length,
      nonconformities: round3Nc.length,
      decisions: round3Decisions.length,
      evidenceContracts: evidenceIds.length,
    },
    null,
    2,
  ),
);

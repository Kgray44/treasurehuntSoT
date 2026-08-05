import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const docs = resolve(root, "Development_Docs", "Projects", "Project_Homeport");

function fail(message) {
  throw new Error(`HOMEPORT_CORRECTION_ARCHITECTURE_INVALID: ${message}`);
}

function read(relative) {
  const path = resolve(docs, relative);
  if (!existsSync(path)) fail(`missing ${relative}`);
  return readFileSync(path, "utf8");
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  const [header, ...body] = rows;
  return body.map((values) => Object.fromEntries(header.map((key, index) => [key, values[index] ?? ""])));
}

function assertSequential(rows, field, prefix, count) {
  if (rows.length !== count) fail(`${field} expected ${count} rows, received ${rows.length}`);
  rows.forEach((row, index) => {
    const expected = `${prefix}${String(index + 1).padStart(3, "0")}`;
    if (row[field] !== expected) fail(`${field} row ${index + 1} expected ${expected}, received ${row[field]}`);
  });
}

const requiredDocuments = [
  "Project_Homeport_Phase_7_Owner_Walkthrough_Correction_Round_1_Architecture.md",
  "Project_Homeport_Chronicle_Preview_and_Player_Alias_Contract.md",
  "Project_Homeport_Workspace_Capability_and_Active_Chronicle_Policy.md",
  "Project_Homeport_Account_Identity_Email_and_Claiming_Architecture.md",
  "Project_Homeport_Linked_Identity_Provider_Contract.md",
  "Project_Homeport_Account_Data_Export_Contract.md",
  "Project_Homeport_Account_Deactivation_and_Deletion_Contract.md",
  "Project_Homeport_Personal_Harbor_Correction_Contract.md",
  "Project_Homeport_Community_Search_and_Review_Correction_Contract.md",
  "Project_Homeport_Loading_Transition_and_Motion_Contract.md",
  "Project_Homeport_Phase_7_Correction_Round_1_Test_Plan.md",
  "Project_Homeport_Phase_7_Correction_Round_1_Implementation_Report.md",
  "Project_Homeport_Phase_7_Correction_Round_1_Validation_Record.md",
  "Project_Homeport_Phase_7_Correction_Round_1_Integration_Manifest.md",
  "evidence/phase7-owner-correction-round1/README.md",
  "evidence/phase7-owner-correction-round1/Project_Homeport_Phase_7_Correction_Round_1_Visual_Review.md",
  "walkthrough/phase7/correction-round1/README.md",
];

for (const document of requiredDocuments) {
  const content = read(document);
  if (!content.startsWith("---\n") || !/\nlast_reviewed: 2026-08-0[45]\n---\n/u.test(content)) {
    fail(`${document} lacks current document frontmatter`);
  }
}

const owner = parseCsv(read("Project_Homeport_Phase_7_Owner_Feedback_Round_1_Ledger.csv"));
assertSequential(owner, "finding_id", "HP-OWCR1-", 44);
if (owner.some((row) => !row.owner_wording || !row.architecture_contract || !row.planned_test_contracts)) {
  fail("owner ledger contains an untraced finding");
}
if (owner.some((row) => row.current_status !== "CORRECTED_PENDING_OWNER_REREVIEW")) {
  fail("an owner finding is not corrected and pending owner re-review");
}
if (
  owner
    .slice(0, 43)
    .some((row, index) => row.correction_nonconformity !== `HP-NC-${String(index + 29).padStart(3, "0")}`)
) {
  fail("owner ledger correction nonconformities are not HP-NC-029 through HP-NC-071");
}
if (owner[43].correction_nonconformity !== "") fail("process safeguard finding 44 must not invent a defect record");

const acceptance = parseCsv(read("Project_Homeport_Phase_7_Correction_Round_1_Acceptance_Matrix.csv"));
assertSequential(acceptance, "finding_id", "HP-OWCR1-", 44);
if (acceptance.some((row) => !row.acceptance_criterion || !row.required_tests || !row.required_evidence)) {
  fail("acceptance matrix contains an incomplete contract");
}
if (acceptance.some((row) => row.final_status !== "PASSED" || row.planned_source_locations.includes("PENDING"))) {
  fail("acceptance matrix is not bound to final source and passed evidence");
}

const preferences = parseCsv(read("Project_Homeport_Preference_Effect_Matrix.csv"));
if (preferences.length !== 14 || new Set(preferences.map((row) => row.preference_id)).size !== 14) {
  fail("preference matrix must enumerate all 14 current visible controls exactly once");
}
const preferenceFields = [
  "stored_field",
  "source_authority",
  "default",
  "affected_components",
  "runtime_behavior",
  "immediate_or_reload_behavior",
  "multi_tab_behavior",
  "server_client_boundary",
  "reduced_motion_relationship",
  "test",
  "evidence",
  "final_status",
];
if (preferences.some((row) => preferenceFields.some((field) => !row[field]))) {
  fail("preference matrix contains an incomplete effect contract");
}
if (preferences.slice(0, 4).some((row) => row.final_status !== "EFFECTIVE_VERIFIED")) {
  fail("the four visible preferences are not verified effective");
}
if (preferences.slice(4).some((row) => row.final_status !== "REMOVED_FROM_ORDINARY_UI_LEGACY_STORAGE_PRESERVED")) {
  fail("removed preferences are not recorded with their legacy-storage boundary");
}

const ncRows = parseCsv(read("Homeport_Nonconformity_Ledger.csv"));
const correctionNc = ncRows.filter((row) => /^HP-NC-0(?:29|[3-6][0-9]|7[01])$/.test(row.id));
if (correctionNc.length !== 43) fail(`expected 43 correction HP-NC rows, received ${correctionNc.length}`);
if (correctionNc.some((row) => row.current_status !== "CORRECTED_PENDING_OWNER_REREVIEW")) {
  fail("a correction HP-NC row is not corrected pending owner re-review");
}

const architecture = read("Project_Homeport_Phase_7_Owner_Walkthrough_Correction_Round_1_Architecture.md");
for (let decision = 1; decision <= 30; decision += 1) {
  if (!new RegExp(`^\\|\\s*${decision}\\s*\\|`, "m").test(architecture)) fail(`missing frozen decision ${decision}`);
}
for (const state of ["OWNER_RETURNED_FOR_CORRECTION", "PENDING_OWNER_DECISION"]) {
  if (!architecture.includes(state)) fail(`architecture missing ${state}`);
}

const ownerDecision = read("Project_Homeport_Phase_7_Owner_Decision_Record.md");
if (!ownerDecision.includes("OWNER_RETURNED_FOR_CORRECTION") || !ownerDecision.includes("PENDING_OWNER_DECISION")) {
  fail("owner decision history does not preserve returned and pending states");
}

const manifest = JSON.parse(read("evidence/phase7-owner-correction-round1/manifest.json"));
const sourceReceipt = JSON.parse(read("evidence/phase7-owner-correction-round1/source-bound-test-receipt.json"));
if (
  manifest.state !== "CORRECTION_VALIDATED_PENDING_OWNER_REREVIEW" ||
  !/^[0-9a-f]{40}$/u.test(manifest.sourceSha) ||
  manifest.sourceSha !== sourceReceipt.sourceSha ||
  sourceReceipt.originalPhase7?.result !== "PASSED" ||
  sourceReceipt.originalPhase7?.count !== 15 ||
  sourceReceipt.correctionRound1?.result !== "PASSED" ||
  sourceReceipt.correctionRound1?.count !== 21 ||
  sourceReceipt.evidenceCount !== 31 ||
  manifest.captures.length !== 31 ||
  manifest.captures.some(
    (capture) =>
      capture.sourceSha !== manifest.sourceSha || capture.visualReview !== "ACCEPTED" || capture.result !== "PASSED",
  )
) {
  fail("correction evidence manifest is not complete, source-bound, and Codex accepted");
}

console.log("HOMEPORT_PHASE7_OWNER_CORRECTION_ROUND1_VALID");

import { CURRENT_R22 } from "./experience-current-r22.mjs";
// Exact owner-approved R20 finding split. This is not a general debt exemption.
import { createHash } from "node:crypto";
import { CURRENT_R20, R20_SCOPE } from "./experience-current-r20.mjs";
import { CURRENT_R21 } from "./experience-current-r21.mjs";

export const R20_DEFERRED_DISPOSITION = "FUNCTIONAL_RESOLVED_EDITORIAL_DEFERRED";
const hash = (value) =>
  createHash("sha256")
    .update(JSON.stringify(value ?? null))
    .digest("hex");
const same = (left, right) => hash(left) === hash(right);
const need = (condition, code) => {
  if (!condition) throw new Error(`PRODUCT_EXPERIENCE_R20_ADJUDICATION_${code}`);
};
const meaningful = (value) => typeof value === "string" && value.trim().length >= 12;
const unique = (values) => Array.isArray(values) && values.length > 0 && new Set(values).size === values.length;

export function validateR20ScopeRecord(record) {
  need(
    record?.id === CURRENT_R20.id &&
      record.version === 20 &&
      same(record.ownerApproval, CURRENT_R20.ownerApproval) &&
      record.frozenReferenceSha === CURRENT_R20.frozenReferenceSha &&
      record.contractDigest === R20_SCOPE.approvedContractDigest &&
      same(record.currentSourceAdmission?.scopeAdjudication, R20_SCOPE),
    "APPROVAL_OR_SCOPE_CHANGED",
  );
  return record;
}

export function validateR20ContractDelta({ original, amended }) {
  const normalized = structuredClone(amended);
  for (const change of R20_SCOPE.contractChanges) {
    const before = original.contracts?.filter((contract) => contract.id === change.contractId);
    const after = normalized.contracts?.filter((contract) => contract.id === change.contractId);
    need(
      before?.length === 1 &&
        after?.length === 1 &&
        before[0].experience?.designTarget === change.oldValue &&
        after[0].experience?.designTarget === change.newValue,
      "CONTRACT_DELTA_CHANGED",
    );
    after[0].experience.designTarget = before[0].experience.designTarget;
  }
  need(same(normalized, original), "FUNCTIONAL_CONTRACT_CHANGED");
  return true;
}

export function validateR20ContractSource({ before, after, actualPaths, original, amended }) {
  need(
    same(actualPaths, ["testing/contracts.json"]) &&
      before.get("testing/contracts.json") === `100644 blob ${R20_SCOPE.originalContractBlob}` &&
      after.get("testing/contracts.json") === `100644 blob ${R20_SCOPE.approvedContractBlob}`,
    "CONTRACT_SOURCE_CHANGED",
  );
  for (const file of new Set([...before.keys(), ...after.keys()]))
    if (file !== "testing/contracts.json") need(before.get(file) === after.get(file), "PRODUCT_RUNTIME_CHANGED");
  return validateR20ContractDelta({ original, amended });
}

export function validateScopedR20Finding({ plan, finding, contractId, artifacts }) {
  const current =
    plan?.exception?.version === 22 ? CURRENT_R22 : plan?.exception?.version === 21 ? CURRENT_R21 : CURRENT_R20;
  need(
    plan?.exception?.id === current.id &&
      plan.exception.version === current.version &&
      plan.exception.currentSourceAdmission?.kind === "CROSSDECK_CURRENT_SOURCE_ADMISSION_1" &&
      /^[a-f0-9]{64}$/u.test(plan.exception.recordDigest ?? "") &&
      plan.exception.independentReviewOrdinal === current.remainingIndependentReviewOrdinal &&
      plan.exception.frozenReferenceSha === current.frozenReferenceSha &&
      same(plan.exception.currentSourceAdmission?.scopeAdjudication, R20_SCOPE) &&
      plan.sourceDigest === plan.exception.currentSourceAdmission.sourceDigest &&
      plan.contractDigest === R20_SCOPE.approvedContractDigest &&
      plan.contextCount === 38 &&
      plan.paired?.browserContexts === 6 &&
      Array.isArray(plan.contractIds) &&
      same([...plan.contractIds].sort(), [...CURRENT_R20.contractIds].sort()),
    "TRUSTED_SCOPE_REQUIRED",
  );
  const transfer = R20_SCOPE.transfers.find((entry) => entry.contractId === contractId);
  need(
    transfer &&
      finding?.id === "R17-R8-B1" &&
      finding.classification === "MAJOR_EXPERIENCE_DEFECT" &&
      finding.contractId === contractId &&
      finding.disposition === R20_DEFERRED_DISPOSITION &&
      meaningful(finding.resolution) &&
      unique(finding.repairEvidenceIds),
    "FINDING_OR_DISPOSITION_CHANGED",
  );
  const ids = new Set(
    artifacts.filter((artifact) => artifact.contractId === contractId).map((artifact) => artifact.id),
  );
  need(
    finding.repairEvidenceIds.every((id) => ids.has(id)),
    "SAME_CONTRACT_REPAIR_EVIDENCE_REQUIRED",
  );
  const functional = finding.functionalResolution;
  need(
    functional?.status === "RESOLVED" &&
      meaningful(functional.observation) &&
      unique(functional.evidenceIds) &&
      functional.evidenceIds.every((id) => ids.has(id) && finding.repairEvidenceIds.includes(id)),
    "UNRESOLVED_FUNCTIONAL_COMPONENT",
  );
  const deferred = finding.editorialDeferral;
  need(
    deferred?.adjudicationId === R20_SCOPE.id &&
      deferred.adjudicationDigest === hash(R20_SCOPE) &&
      deferred.component === "EDITORIAL_FIRST_VIEWPORT_HIERARCHY" &&
      deferred.refitAreaId === "player-journal-crossdeck" &&
      deferred.designPacket === R20_SCOPE.refit.designPacket &&
      deferred.ledgerEntryId === transfer.ledgerEntryId &&
      deferred.originalReview9Sha256 === R20_SCOPE.originalReview9Sha256 &&
      deferred.originalClosureSha256 === R20_SCOPE.originalClosureSha256 &&
      deferred.ownerAcceptance === "OUTSTANDING",
    "REFIT_TRANSFER_OR_ORIGINAL_HISTORY_CHANGED",
  );
  return true;
}

function csvRows(text) {
  const rows = [];
  let row = [],
    value = "",
    quoted = false;
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        value += '"';
        index++;
      } else quoted = !quoted;
    } else if (!quoted && character === ",") {
      row.push(value);
      value = "";
    } else if (!quoted && character === "\n") {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else if (character !== "\r" || quoted) value += character;
  }
  need(!quoted, "LEDGER_INVALID");
  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }
  const header = rows.shift();
  need(header?.includes("id") && rows.every((entry) => entry.length === header.length), "LEDGER_INVALID");
  return rows.map((entry) => Object.fromEntries(header.map((name, index) => [name, entry[index]])));
}

export function validateR20TransferDocuments({ registry, previousRegistry, packet, ledger, previousLedger }) {
  const areas = registry?.areas?.filter((area) => area.id === "player-journal-crossdeck");
  need(
    areas?.length === 1 &&
      areas[0].status === "PLANNED" &&
      areas[0].treatment === "UNASSESSED" &&
      areas[0].ownerAccepted === false &&
      areas[0].designPacket === "player-journal-crossdeck/design-packet.md",
    "REFIT_AREA_NOT_REGISTERED",
  );
  const retained = structuredClone(registry);
  retained.areas = retained.areas.filter((area) => area.id !== "player-journal-crossdeck");
  need(previousRegistry && same(retained, previousRegistry), "PRIOR_REFIT_REGISTRY_CHANGED");
  need(
    typeof packet === "string" &&
      packet.includes(CURRENT_R20.ownerApproval.humanMessageId) &&
      packet.includes(R20_SCOPE.originalReview9Sha256) &&
      packet.includes(R20_SCOPE.originalClosureSha256) &&
      R20_SCOPE.transfers.every((entry) => packet.includes(entry.contractId) && packet.includes(entry.ledgerEntryId)),
    "REFIT_PACKET_MISSING_OR_UNBOUND",
  );
  need(typeof previousLedger === "string" && ledger.startsWith(previousLedger), "PRIOR_LEDGER_CHANGED");
  const rows = csvRows(ledger),
    previous = csvRows(previousLedger);
  need(rows.length === previous.length + 3, "LEDGER_TRANSFER_COUNT_CHANGED");
  for (const transfer of R20_SCOPE.transfers) {
    const matches = rows.filter((row) => row.id === transfer.ledgerEntryId);
    need(
      matches.length === 1 &&
        matches[0].acceptance_contract === transfer.contractId &&
        matches[0].current_status === "DEFERRED_TO_REFIT" &&
        matches[0].disposition === R20_DEFERRED_DISPOSITION &&
        matches[0].notes.includes(CURRENT_R20.ownerApproval.humanMessageId) &&
        matches[0].notes.includes(R20_SCOPE.originalClosureSha256) &&
        matches[0].notes.includes(R20_SCOPE.refit.designPacket),
      "LEDGER_TRANSFER_MISSING_OR_UNBOUND",
    );
  }
  return true;
}

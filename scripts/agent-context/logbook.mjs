import { createHash } from "node:crypto";

export const LOGBOOK_SCHEMA_VERSION = "1.0";
export const CAPSULE_SCHEMA_VERSION = "1.0";
export const LOGBOOK_GENERATOR_VERSION = "project-trim-logbook-1.0.0";
export const EXPANSION_CLASSES = ["AUTHORITY", "SOURCE", "SCHEMA", "TEST", "HISTORY", "ADJACENT_PROJECT", "OPERATIONS", "SECURITY"];
const SECRET = /(?:secret|password|passwd|token|credential|cookie|authorization|private.?key)/i;
const digest = (value) => createHash("sha256").update(typeof value === "string" ? value : canonicalJson(value)).digest("hex");

export function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  return value;
}
export const canonicalJson = (value) => JSON.stringify(canonicalize(value));
const clean = (value, key = "") => {
  if (SECRET.test(key)) return "[REDACTED]";
  if (Array.isArray(value)) return value.map((item) => clean(item));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, clean(v, k)]));
  return typeof value === "string" && /(?:Bearer\s+|gh[pousr]_)/i.test(value) ? "[REDACTED]" : value;
};
const required = (value, label) => { if (!value) throw new Error(`LOGBOOK_REQUIRED:${label}`); return value; };
const sourceKey = (source) => `${source.path ?? source.sourceId}:${source.blobSha ?? source.digest}`;

export function createLogbook(taskId, packetDigest = null) {
  return { schemaVersion: LOGBOOK_SCHEMA_VERSION, generatorVersion: LOGBOOK_GENERATOR_VERSION, taskId: required(taskId, "taskId"), packetDigest, reads: [], searches: [], expansions: [], privacy: { prohibited: ["secrets", "credentials", "private content", "raw prompts", "raw logs"] } };
}
export function recordRead(logbook, entry) {
  const value = clean(entry);
  required(value.path ?? value.sourceId, "read.path"); required(value.blobSha ?? value.digest, "read.identity"); required(value.reason, "read.reason"); required(value.summary, "read.summary");
  const normalized = { path: value.path ?? value.sourceId, blobSha: value.blobSha ?? value.digest, reason: value.reason, summary: value.summary, summaryDigest: digest(value.summary), symbols: value.symbols ?? [], contracts: value.contracts ?? [], exactTextNeeded: Boolean(value.exactTextNeeded), coverage: value.coverage ?? "COMPLETE", lastVerified: value.lastVerified ?? { sourceIdentity: value.blobSha ?? value.digest }, confidence: value.confidence ?? "BOUNDED", sensitive: Boolean(value.sensitive), rereadReason: value.rereadReason ?? null };
  logbook.reads = [...logbook.reads.filter((item) => item.path !== normalized.path), normalized]; return normalized;
}
export function readReuseDecision(logbook, request) {
  const prior = logbook.reads.find((entry) => entry.path === request.path || entry.path === request.sourceId);
  if (!prior) return { reuse: false, reason: "NOT_RECORDED" };
  if ((request.blobSha ?? request.digest) !== prior.blobSha) return { reuse: false, reason: "SOURCE_IDENTITY_CHANGED", prior };
  if (request.exactTextNeeded && !prior.exactTextNeeded) return { reuse: false, reason: "EXACT_TEXT_ESCALATION", prior };
  if (prior.coverage !== "COMPLETE" && request.requiredCoverage && prior.coverage !== request.requiredCoverage) return { reuse: false, reason: "PARTIAL_COVERAGE", prior };
  if (request.relevantMainlineCrossing) return { reuse: false, reason: "RELEVANT_MAINLINE_CROSSING", prior };
  if (prior.confidence === "LOW" || request.securityReverification || request.contradictory) return { reuse: false, reason: request.securityReverification ? "SECURITY_REVERIFICATION" : "LOW_OR_CONTRADICTORY_CONFIDENCE", prior };
  return { reuse: true, reason: "UNCHANGED_SUMMARY_SUFFICIENT", summary: prior.summary, summaryDigest: prior.summaryDigest, prior };
}
export function recordSearch(logbook, entry) {
  const value = clean(entry); required(value.intent, "search.intent"); required(value.resultDigest, "search.resultDigest");
  const normalized = { intent: value.intent, normalizedIntent: value.normalizedIntent ?? value.intent.toLowerCase(), query: value.query ?? null, scope: value.scope ?? "repository", resultDigest: value.resultDigest, resolvedOwners: value.resolvedOwners ?? [], paths: value.paths ?? [], symbols: value.symbols ?? [], contracts: value.contracts ?? [], unresolved: value.unresolved ?? [], confidence: value.confidence ?? "BOUNDED", sourceIdentity: value.sourceIdentity ?? null, invalidationPaths: value.invalidationPaths ?? value.paths ?? [], lastVerified: value.lastVerified ?? value.sourceIdentity ?? null };
  logbook.searches = [...logbook.searches.filter((item) => item.normalizedIntent !== normalized.normalizedIntent), normalized]; return normalized;
}
export function searchReuseDecision(logbook, request) {
  const prior = logbook.searches.find((entry) => entry.normalizedIntent === (request.normalizedIntent ?? request.intent.toLowerCase()));
  if (!prior) return { reuse: false, reason: "NOT_RECORDED" };
  if (prior.confidence === "LOW" || prior.unresolved.length || request.relevantOwnershipChange || request.relevantSourceChange) return { reuse: false, reason: "RELEVANT_SEARCH_ASSUMPTION_CHANGED", prior };
  if (request.unresolvedNowMatters) return { reuse: false, reason: "UNRESOLVED_QUESTION_ESCALATED", prior };
  return { reuse: true, reason: "RESOLVED_OWNER_CLOSURE_REUSABLE", prior };
}
export function recordExpansion(logbook, entry) {
  const value = clean(entry); if (!EXPANSION_CLASSES.includes(value.reasonClass)) throw new Error("INVALID_EXPANSION_CLASS"); required(value.question, "expansion.question");
  const normalized = { reasonClass: value.reasonClass, question: value.question, sourcesAdded: value.sourcesAdded ?? [], sourceIdentities: value.sourceIdentities ?? [], resolution: value.resolution ?? "UNRESOLVED", triggeredFurtherExpansion: Boolean(value.triggeredFurtherExpansion), confidenceChange: value.confidenceChange ?? null, scopeChanged: Boolean(value.scopeChanged) };
  if (normalized.scopeChanged && !value.scopeAuthorization) throw new Error("CONTEXT_EXPANSION_IS_NOT_SCOPE_EXPANSION"); logbook.expansions.push(normalized); return normalized;
}

export function buildAcceptedCapsule(input) {
  const value = clean(input); required(value.project, "capsule.project"); required(value.increment, "capsule.increment"); required(value.acceptedMainSha, "capsule.acceptedMainSha"); required(value.acceptedTreeSha, "capsule.acceptedTreeSha");
  if (value.state && value.state !== "ACCEPTED") throw new Error("ACCEPTED_CAPSULE_STATE_REQUIRED");
  const capsule = { schemaVersion: CAPSULE_SCHEMA_VERSION, generatorVersion: LOGBOOK_GENERATOR_VERSION, state: "ACCEPTED", project: value.project, increment: value.increment, acceptedMainSha: value.acceptedMainSha, acceptedTreeSha: value.acceptedTreeSha, closureDate: value.closureDate ?? null, governingRequirements: value.governingRequirements ?? [], contractsChanged: value.contractsChanged ?? [], sourceOwnership: value.sourceOwnership ?? { producers: [], consumers: [], seams: [] }, dataState: value.dataState ?? { migrations: [], backfills: [], compatibility: [] }, runtimeState: value.runtimeState ?? { activeBehavior: [], featureFlags: [], adapters: [], fallbacks: [] }, verification: value.verification ?? { suites: [], evidenceIds: [], limitations: [] }, knownLimitations: value.knownLimitations ?? ["NOT_RECORDED"], futureDependencies: value.futureDependencies ?? { mayConsume: [], mustNotAssume: [] }, nextPhaseHints: value.nextPhaseHints ?? { files: [], tests: [], authority: [], contracts: [] }, integrity: { sourceRecords: value.sourceRecords ?? [], acceptedIdentity: { mainSha: value.acceptedMainSha, treeSha: value.acceptedTreeSha } } };
  capsule.integrity.semanticDigest = digest({ ...capsule, integrity: { ...capsule.integrity, semanticDigest: undefined } }); return canonicalize(capsule);
}
export function buildProvisionalCapsule(input) { const value = clean(input); return canonicalize({ schemaVersion: CAPSULE_SCHEMA_VERSION, generatorVersion: LOGBOOK_GENERATOR_VERSION, state: "PROVISIONAL", project: required(value.project, "capsule.project"), increment: required(value.increment, "capsule.increment"), candidateSha: required(value.candidateSha, "capsule.candidateSha"), acceptedMainSha: null, acceptedTreeSha: null, integrity: { sourceRecords: value.sourceRecords ?? [], semanticDigest: digest(value) } }); }
export function validateCapsule(capsule) { const errors=[]; if (!capsule || !["ACCEPTED","PROVISIONAL"].includes(capsule.state)) errors.push("INVALID_STATE"); if (capsule?.state === "ACCEPTED" && (!capsule.acceptedMainSha || !capsule.acceptedTreeSha)) errors.push("ACCEPTED_IDENTITY_REQUIRED"); if (capsule?.state === "PROVISIONAL" && (capsule.acceptedMainSha || capsule.acceptedTreeSha)) errors.push("PROVISIONAL_MUST_NOT_CLAIM_ACCEPTANCE"); return { valid: errors.length === 0, errors }; }

export function delegationDecision(input) { const value=clean(input); const reasons=[]; if ((value.mutableFiles ?? []).some((f) => (value.overlappingMutableFiles ?? []).includes(f))) reasons.push("OVERLAPPING_MUTABLE_OWNERSHIP"); if (value.sharedGoverningAmbiguity) reasons.push("SHARED_GOVERNING_AMBIGUITY"); if (value.parentContextCopied) reasons.push("FULL_PARENT_CONTEXT_REPLICATION"); if (value.tinyTask) reasons.push("STARTUP_COST_EXCEEDS_WORK"); return { delegate: reasons.length===0 && Boolean(value.independent), risk: reasons.length ? "HIGH" : "BOUNDED", reasons }; }
export function buildWorkstreamSlice(input) { const value=clean(input); const decision=delegationDecision(value); if (!decision.delegate) throw new Error(`DELEGATION_REJECTED:${decision.reasons.join(",")}`); const slice={ schemaVersion: LOGBOOK_SCHEMA_VERSION, generatorVersion: LOGBOOK_GENERATOR_VERSION, identity:{ parentTaskId:required(value.parentTaskId,"slice.parentTaskId"), workstreamId:required(value.workstreamId,"slice.workstreamId"), sourceIdentity:value.sourceIdentity ?? null }, objective:{ question:required(value.question,"slice.question"), expectedOutcome:required(value.expectedOutcome,"slice.expectedOutcome") }, ownedContracts:value.ownedContracts ?? [], authority:value.authority ?? [], context:{ sources:value.sources ?? [], data:value.data ?? [], tests:value.tests ?? [], capsuleFacts:value.capsuleFacts ?? [] }, constraints:{ nonGoals:value.nonGoals ?? [], editingAuthority:value.editingAuthority ?? "READ_ONLY", fileBoundary:value.fileBoundary ?? [], prohibitedOverlap:value.prohibitedOverlap ?? [], privacy:value.privacy ?? "NO_UNRELATED_SENSITIVE_CONTEXT" }, expansion:value.expansion ?? { allowed: [], parentEscalation: [] }, returnContract:value.returnContract ?? { required:["status","findings","filesTouched","contracts","evidence","sourceIdentities","expansions","blockers","parentAction","summaryDigest"] }, integrity:{ parentPacketDigest:value.parentPacketDigest ?? null, capsuleDigest:value.capsuleDigest ?? null, sourceIdentities:value.sourceIdentities ?? [] } }; slice.integrity.sliceDigest=digest(slice); return canonicalize(slice); }
export function validateDistilledReturn(value) { const result=clean(value); const requiredFields=["status","findings","filesTouched","contracts","evidence","sourceIdentities","expansions","blockers","parentAction"]; const missing=requiredFields.filter((field)=>!(field in result)); if (result.status === "FAILED" && !result.blockers?.length) missing.push("blockers for FAILED status"); if (result.scopeCrossing && !result.parentAction) missing.push("parentAction for scope crossing"); return { valid: missing.length===0, missing, summaryDigest:digest({ ...result, summaryDigest: undefined }) }; }
export function attachLogbook(packet, { capsule = null, ledgerPath = null, reuse = null, workstreamSlices = [] } = {}) { const result=canonicalize({ ...packet, phase3:{ capsule: capsule ? { state:capsule.state, digest:capsule.integrity?.semanticDigest ?? null, acceptedMainSha:capsule.acceptedMainSha ?? null } : null, ledgerPath, reuse, workstreamSlices:workstreamSlices.map((slice)=>({ workstreamId:slice.identity.workstreamId, digest:slice.integrity.sliceDigest })) } }); return { ...result, integrity:{ ...result.integrity, semanticDigest:digest({ ...result, observation:undefined, ledgerTemplate:undefined, integrity:{...result.integrity, semanticDigest:undefined} }) } }; }

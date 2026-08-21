import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { DEEPWATER_ROOT, stableStringify } from "./lib.mjs";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const uniqueSorted = (values) => [...new Set(values.filter((value) => value !== undefined && value !== null))].sort();
const readJson = async (root, relative) => JSON.parse(await readFile(path.join(root, relative), "utf8"));
const canonicalJson = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  return JSON.stringify(value);
};
const humanDisposition = new Set(["USER_FACING", "SECURITY_RESTRICTED"]);
const rungRank = {
  DOMAIN: 0,
  SERVICE: 1,
  API: 2,
  PROJECTION: 3,
  UI: 4,
  DISCOVERABLE: 5,
  STATE_COMPLETE: 6,
  ACCESSIBLE: 7,
  JOURNEY_PROVEN: 8,
  OWNER_ACCEPTED: 9,
};

async function recursivelyListFiles(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...(await recursivelyListFiles(path.join(directory, entry.name), relative)));
    else if (entry.isFile()) files.push(relative);
  }
  return files;
}

async function backendSurfaceInventory(root) {
  const candidates = ["src/app/api", "src/domain", "src/server", "src/workers"];
  const surfaces = [];
  for (const relative of candidates) {
    try {
      for (const file of await recursivelyListFiles(path.join(root, relative))) {
        if (!/\.(?:[cm]?[jt]sx?)$/u.test(file)) continue;
        const normalized = `${relative}/${file}`;
        const kind =
          normalized.includes("/api/") || normalized.endsWith("/route.ts")
            ? "API_ROUTE"
            : normalized.includes("/domain/")
              ? "DOMAIN_OR_SERVICE"
              : normalized.includes("worker")
                ? "WORKER"
                : "SERVER_OPERATION";
        surfaces.push({ id: `${kind}:${normalized}`, kind, path: normalized });
      }
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  return surfaces.sort((left, right) => left.id.localeCompare(right.id));
}

export async function computeSoundingLinePolicyDigest(root) {
  const files = [
    "policy-manifest.json",
    "ownership.json",
    "contracts.json",
    "resources.json",
    "suites.json",
    "impact-map.json",
    "release-gates.json",
    "quarantine.json",
    "validation-debt.json",
    "file-dispositions.json",
    "test-definition-schema.json",
    "retired-suites.json",
    "browser-capabilities.json",
    "sounding-line-authority.json",
    "evidence-fingerprint-policy.json",
    "prepared-artifacts.json",
    "mainline-train-policy.json",
    "verification-maintenance-policy.json",
  ];
  const policy = { manifest: await readJson(root, "testing/policy-manifest.json") };
  for (const file of files.slice(1)) policy[file.replace(/\.json$/u, "")] = await readJson(root, `testing/${file}`);
  policy.activeTests = await readJson(root, "testing/generated/active-test-registry.json");
  return sha256(canonicalJson(policy));
}

export const impactDeclarationTemplate = {
  disposition: "NO_REALIZATION_IMPACT",
  affectedCapabilityIds: [],
  affectedFeatureCatalogIds: [],
  potentialLayerImpact: [],
  affectedSurfaces: { routes: [], screens: [], journeys: [], apis: [] },
  expectedTerminalRungEffect: "NONE",
  evidenceRequiringRefresh: [],
  rationale: "Explain why the work has no capability-realization impact.",
};

export function validateImpactDeclaration(declaration, capabilityIds = new Set(), catalogIds = new Set()) {
  const errors = [];
  const dispositions = new Set([
    "ADDS_CAPABILITY",
    "CHANGES_EXISTING_CAPABILITY",
    "RETIRES_CAPABILITY",
    "EVIDENCE_ONLY",
    "NO_REALIZATION_IMPACT",
  ]);
  if (!declaration || typeof declaration !== "object")
    return ["missing Deepwater capability-realization impact declaration"];
  if (!dispositions.has(declaration.disposition)) errors.push("impact declaration has invalid disposition");
  if (!String(declaration.rationale ?? "").trim()) errors.push("impact declaration lacks rationale");
  for (const id of declaration.affectedCapabilityIds ?? [])
    if (!capabilityIds.has(id)) errors.push(`impact declaration references unknown capability ${id}`);
  for (const id of declaration.affectedFeatureCatalogIds ?? [])
    if (!catalogIds.has(id)) errors.push(`impact declaration references unknown Feature Catalog entry ${id}`);
  if (
    declaration.disposition === "NO_REALIZATION_IMPACT" &&
    ((declaration.affectedCapabilityIds ?? []).length || (declaration.affectedFeatureCatalogIds ?? []).length)
  )
    errors.push("NO_REALIZATION_IMPACT declaration names affected capability or catalog entries");
  if (
    ["ADDS_CAPABILITY", "CHANGES_EXISTING_CAPABILITY", "RETIRES_CAPABILITY"].includes(declaration.disposition) &&
    !(declaration.affectedCapabilityIds ?? []).length
  )
    errors.push("capability-changing declaration lacks affected capability IDs");
  return uniqueSorted(errors);
}

async function snapshot(root, artifacts, config) {
  const ledger = new Map(artifacts.ledger.capabilities.map((item) => [item.capabilityId, item]));
  const utilization = new Map(artifacts.utilizationDocument.capabilities.map((item) => [item.capabilityId, item]));
  const findings = new Map();
  for (const item of artifacts.findingsDocument.findings)
    findings.set(item.capabilityId, [
      ...(findings.get(item.capabilityId) ?? []),
      {
        findingId: item.findingId,
        status: item.status,
        severity: item.severity,
        closureEvidence: item.closureEvidence ?? null,
        debt: item.debt ?? null,
      },
    ]);
  const capabilities = artifacts.phase4ProofMatrix.capabilities
    .map((proof) => {
      const current = ledger.get(proof.capabilityId);
      const used = utilization.get(proof.capabilityId);
      const evidence = proof.runtimeEvidence ?? {};
      return {
        capabilityId: proof.capabilityId,
        owner: proof.canonicalOwner,
        featureCatalogId: proof.featureCatalogId,
        disposition: proof.disposition,
        terminalRung: proof.terminalRung,
        currentRung: current?.currentRealization?.highestRung ?? null,
        classification: proof.realizationClassification,
        audience: current?.audience?.roles ?? [],
        privacyClass: current?.audience?.privacyClass ?? proof.disposition,
        routes: uniqueSorted(proof.routeReferences ?? []),
        screens: uniqueSorted(proof.screenReferences ?? []),
        journeys: proof.proofFamilyId ? [proof.proofFamilyId] : [],
        apiOrActions: uniqueSorted((used?.expectedOperations ?? []).map((operation) => operation.operationId)),
        projection: uniqueSorted(used?.expectedSafeMetadata ?? []),
        states: uniqueSorted(evidence.states ?? []),
        requiredStates: uniqueSorted(proof.requiredStates ?? []),
        accessibility: uniqueSorted(evidence.accessibility ?? []),
        requiredAccessibility: uniqueSorted(proof.accessibilityRequirements ?? []),
        evidence: {
          sourceSha: evidence.sourceSha ?? config.baseOriginMainSha,
          status: proof.proofStatus,
          family: proof.proofFamilyId,
          disposition: evidence.evidenceDisposition ?? "BOUNDARY_CONFIRMED",
        },
        findings: (findings.get(proof.capabilityId) ?? []).sort((left, right) =>
          left.findingId.localeCompare(right.findingId),
        ),
        sourceReferences: uniqueSorted(proof.sourceReferences ?? []),
      };
    })
    .sort((left, right) => left.capabilityId.localeCompare(right.capabilityId));
  return {
    schemaVersion: "1.0.0",
    project: config.project,
    phase: config.phase,
    sourceSha: config.baseOriginMainSha,
    sourceIdentity: { branch: "origin/main", accepted: true },
    capabilityCount: capabilities.length,
    featureCatalogCount: artifacts.inputs.catalog.length,
    capabilities,
    inventories: {
      routeIds: uniqueSorted([
        ...artifacts.inputs.routes.routes.map((item) => item.routeId),
        ...artifacts.inputs.routes.routes.flatMap((item) => [item.path, item.pattern, item.route]),
        ...capabilities.flatMap((item) => item.routes),
      ]),
      screenIds: uniqueSorted([
        ...artifacts.inputs.screens.screens.map((item) => item.screenId),
        ...capabilities.flatMap((item) => item.screens),
      ]),
      journeyIds: uniqueSorted([
        ...artifacts.inputs.journeys.journeys.map((item) => item.journeyId),
        ...capabilities.flatMap((item) => item.journeys),
      ]),
      catalogIds: uniqueSorted(artifacts.inputs.catalog.map((item) => item.id)),
    },
    backendSurfaces: await backendSurfaceInventory(root),
  };
}

export function compareSnapshots(prior, current, backendSurfaceDispositions = []) {
  const previous = new Map((prior.capabilities ?? []).map((item) => [item.capabilityId, item]));
  const next = new Map((current.capabilities ?? []).map((item) => [item.capabilityId, item]));
  const fields = [
    ["owner", "OWNER_CHANGED"],
    ["audience", "AUDIENCE_CHANGED"],
    ["privacyClass", "PRIVACY_CLASS_CHANGED"],
    ["terminalRung", "EXPECTED_TERMINAL_RUNG_CHANGED"],
    ["currentRung", "CURRENT_REALIZATION_RUNG_CHANGED"],
    ["classification", "CLASSIFICATION_CHANGED"],
    ["featureCatalogId", "FEATURE_CATALOG_MAPPING_CHANGED"],
    ["routes", "ROUTE"],
    ["screens", "SCREEN"],
    ["journeys", "JOURNEY"],
    ["apiOrActions", "API_OR_ACTION"],
    ["projection", "PROJECTION_CHANGED"],
    ["states", "STATE_COVERAGE_CHANGED"],
    ["accessibility", "ACCESSIBILITY_EVIDENCE_CHANGED"],
  ];
  const deltas = [];
  for (const id of uniqueSorted([...previous.keys(), ...next.keys()])) {
    const before = previous.get(id);
    const after = next.get(id);
    const common = {
      capabilityId: id,
      sourceIdentities: { prior: prior.sourceSha, current: current.sourceSha },
      severity: null,
      owner: after?.owner ?? before?.owner,
      humanReviewRequired: false,
      soundingLineEvidenceInvalidated: false,
    };
    if (!before) {
      deltas.push({
        ...common,
        code: "CAPABILITY_ADDED",
        oldState: null,
        newState: after,
        reason: "New capability has no accepted disposition.",
        severity: "HIGH",
        humanReviewRequired: true,
      });
      continue;
    }
    if (!after) {
      deltas.push({
        ...common,
        code: "CAPABILITY_REMOVED",
        oldState: before,
        newState: null,
        reason: "Accepted capability disappeared without a governed transition.",
        severity: "HIGH",
        humanReviewRequired: true,
        soundingLineEvidenceInvalidated: true,
      });
      continue;
    }
    for (const [field, code] of fields) {
      if (stableStringify(before[field]) === stableStringify(after[field])) continue;
      if (["routes", "screens", "journeys", "apiOrActions"].includes(field)) {
        const oldValues = new Set(before[field] ?? []);
        const newValues = new Set(after[field] ?? []);
        for (const value of [...newValues].filter((value) => !oldValues.has(value)).sort())
          deltas.push({
            ...common,
            code: `${code}_ADDED`,
            oldState: null,
            newState: value,
            reason: `${field} added.`,
            humanReviewRequired: code === "ROUTE",
          });
        for (const value of [...oldValues].filter((value) => !newValues.has(value)).sort())
          deltas.push({
            ...common,
            code: `${code}_REMOVED`,
            oldState: value,
            newState: null,
            reason: `${field} removed.`,
            severity: code === "ROUTE" ? "HIGH" : null,
            humanReviewRequired: true,
            soundingLineEvidenceInvalidated: code === "ROUTE" || code === "JOURNEY",
          });
      } else
        deltas.push({
          ...common,
          code,
          oldState: before[field],
          newState: after[field],
          reason: `${field} changed.`,
          humanReviewRequired: ["OWNER_CHANGED", "AUDIENCE_CHANGED", "CLASSIFICATION_CHANGED"].includes(code),
          soundingLineEvidenceInvalidated: ["STATE_COVERAGE_CHANGED", "ACCESSIBILITY_EVIDENCE_CHANGED"].includes(code),
        });
    }
    for (const finding of after.findings ?? []) {
      const priorFinding = (before.findings ?? []).find((item) => item.findingId === finding.findingId);
      if (priorFinding?.status === "CLOSED" && finding.status !== "CLOSED")
        deltas.push({
          ...common,
          code: "FINDING_REOPENED",
          oldState: priorFinding.status,
          newState: finding.status,
          reason: "Closed finding regressed.",
          severity: finding.severity,
          humanReviewRequired: true,
          soundingLineEvidenceInvalidated: true,
        });
      if (priorFinding?.status !== "CLOSED" && finding.status === "CLOSED")
        deltas.push({
          ...common,
          code: "FINDING_CLOSED",
          oldState: priorFinding?.status ?? null,
          newState: finding.status,
          reason: "Finding received closure evidence.",
        });
    }
  }
  const previousBackend = new Map((prior.backendSurfaces ?? []).map((item) => [item.id, item]));
  const nextBackend = new Map((current.backendSurfaces ?? []).map((item) => [item.id, item]));
  const backendDispositions = new Map(backendSurfaceDispositions.map((item) => [item.path, item]));
  for (const id of uniqueSorted([...previousBackend.keys(), ...nextBackend.keys()])) {
    const before = previousBackend.get(id);
    const after = nextBackend.get(id);
    if (before && after) continue;
    const surface = after ?? before;
    const disposition = backendDispositions.get(surface.path);
    deltas.push({
      capabilityId: disposition?.capabilityId ?? `UNMAPPED_BACKEND_SURFACE:${surface.path}`,
      sourceIdentities: { prior: prior.sourceSha, current: current.sourceSha },
      code: after ? "BACKEND_SURFACE_ADDED" : "BACKEND_SURFACE_REMOVED",
      oldState: before ?? null,
      newState: after ?? null,
      reason: disposition?.rationale ?? `${surface.kind} changed without an explicit capability disposition.`,
      severity: disposition ? null : "HIGH",
      owner: disposition?.canonicalOwner ?? "UNASSIGNED",
      humanReviewRequired: true,
      soundingLineEvidenceInvalidated: !disposition,
    });
  }
  return {
    schemaVersion: "1.0.0",
    comparison: { priorSourceSha: prior.sourceSha, currentSourceSha: current.sourceSha },
    deltas: deltas.sort((left, right) =>
      `${left.capabilityId}:${left.code}`.localeCompare(`${right.capabilityId}:${right.code}`),
    ),
  };
}

function validateBackendSurfaceDispositions(config, currentBaseline) {
  const errors = [];
  const capabilities = new Map(currentBaseline.capabilities.map((item) => [item.capabilityId, item]));
  const surfaces = new Set((currentBaseline.backendSurfaces ?? []).map((item) => item.path));
  const seenPaths = new Set();
  for (const disposition of config.backendSurfaceDispositions ?? []) {
    if (!disposition.path || !disposition.capabilityId || !disposition.canonicalOwner || !disposition.rationale)
      errors.push("backend surface disposition has incomplete identity or rationale");
    if (seenPaths.has(disposition.path)) errors.push(`backend surface disposition duplicates ${disposition.path}`);
    seenPaths.add(disposition.path);
    const capability = capabilities.get(disposition.capabilityId);
    if (!capability)
      errors.push(`backend surface disposition references unknown capability ${disposition.capabilityId}`);
    else {
      if (capability.owner !== disposition.canonicalOwner)
        errors.push(`backend surface disposition owner disagrees with ${disposition.capabilityId}`);
      if (disposition.featureCatalogId !== capability.featureCatalogId)
        errors.push(`backend surface disposition Catalog mapping disagrees with ${disposition.capabilityId}`);
    }
    if (!surfaces.has(disposition.path))
      errors.push(`backend surface disposition references missing current source ${disposition.path}`);
  }
  return errors;
}

function validateSnapshot(value) {
  const errors = [];
  const routes = new Set(value.inventories.routeIds);
  const screens = new Set(value.inventories.screenIds);
  const journeys = new Set(value.inventories.journeyIds);
  const backendIds = new Set();
  for (const surface of value.backendSurfaces ?? []) {
    if (!surface.id || !surface.kind || !surface.path)
      errors.push("backend inventory has an incomplete surface identity");
    if (backendIds.has(surface.id)) errors.push(`backend inventory duplicates ${surface.id}`);
    backendIds.add(surface.id);
  }
  for (const capability of value.capabilities) {
    const human = humanDisposition.has(capability.disposition);
    const full = capability.classification === "FULLY_REALIZED";
    if (!capability.owner) errors.push(`${capability.capabilityId}: unknown canonical owner`);
    if (human && full && !capability.routes.length)
      errors.push(`${capability.capabilityId}: FULLY_REALIZED capability lacks discoverability`);
    if (human && full && !capability.journeys.length)
      errors.push(`${capability.capabilityId}: FULLY_REALIZED capability lacks a natural journey`);
    for (const id of capability.routes)
      if (!routes.has(id)) errors.push(`${capability.capabilityId}: references nonexistent route ${id}`);
    for (const id of capability.screens)
      if (!screens.has(id)) errors.push(`${capability.capabilityId}: references nonexistent screen ${id}`);
    for (const id of capability.journeys)
      if (!journeys.has(id)) errors.push(`${capability.capabilityId}: references nonexistent journey ${id}`);
    if (full && rungRank[capability.terminalRung] >= rungRank.STATE_COMPLETE)
      for (const state of capability.requiredStates)
        if (!capability.states.includes(state))
          errors.push(`${capability.capabilityId}: missing required state evidence ${state}`);
    if (full && rungRank[capability.terminalRung] >= rungRank.ACCESSIBLE)
      for (const item of capability.requiredAccessibility)
        if (!capability.accessibility.includes(item))
          errors.push(`${capability.capabilityId}: missing accessibility evidence ${item}`);
    if (capability.classification === "SECURITY_RESTRICTED" && capability.audience.includes("VISITOR"))
      errors.push(`${capability.capabilityId}: SECURITY_RESTRICTED capability has ordinary-user audience`);
    for (const finding of capability.findings)
      if (finding.status === "CLOSED" && !finding.closureEvidence)
        errors.push(`${capability.capabilityId}: closed finding lost closure evidence`);
  }
  return errors;
}

async function completionRecordAudits(root, config) {
  const audits = [];
  for (const relative of config.completionRecordPolicy?.governedRecordPaths ?? []) {
    const content = await readFile(path.join(root, relative), "utf8");
    audits.push({
      path: relative,
      hasImpactDeclaration: /^## Deepwater capability-realization impact declaration$/mu.test(content),
      falselyClaimsCompletion:
        /PROJECT DEEPWATER PROGRAM COMPLETE|Project Deepwater is complete\./iu.test(content) &&
        !/candidate-development|does not declare Project Deepwater complete/iu.test(content),
    });
  }
  return audits;
}

export async function buildPhase5Governance(root, artifacts) {
  const config = await readJson(root, `${DEEPWATER_ROOT}/deepwater-phase5-config.json`);
  const currentBaseline = await snapshot(root, artifacts, config);
  let priorBaseline;
  try {
    priorBaseline = await readJson(root, `${DEEPWATER_ROOT}/reports/Project_Deepwater_Phase_5_Drift_Baseline.json`);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    priorBaseline = {
      ...currentBaseline,
      sourceSha: config.phase4Authority.protectedImplementationMerge,
      sourceIdentity: { branch: "historical-phase-4", accepted: true },
    };
  }
  return {
    config,
    currentBaseline,
    priorBaseline,
    delta: compareSnapshots(priorBaseline, currentBaseline, config.backendSurfaceDispositions),
    completionRecordAudits: await completionRecordAudits(root, config),
    soundingLinePolicyDigest: await computeSoundingLinePolicyDigest(root),
  };
}

export function validatePhase5Governance(governance) {
  const { config, currentBaseline, delta, completionRecordAudits, soundingLinePolicyDigest } = governance;
  const errors = [];
  if (config.phase5Authorized !== true || !config.authorization?.ownerPrompt)
    errors.push("Phase 5 lacks explicit owner authorization");
  if (!/^[0-9a-f]{40}$/u.test(config.baseOriginMainSha ?? "")) errors.push("Phase 5 base source SHA is invalid");
  if (currentBaseline.sourceSha !== config.baseOriginMainSha)
    errors.push("Phase 5 baseline source does not match declared base");
  if (currentBaseline.capabilityCount !== currentBaseline.capabilities.length)
    errors.push("Phase 5 baseline count is stale");
  const capabilityIds = new Set(currentBaseline.capabilities.map((item) => item.capabilityId));
  const catalogIds = new Set(currentBaseline.inventories.catalogIds);
  for (const id of catalogIds)
    if (!currentBaseline.capabilities.some((item) => item.featureCatalogId === id))
      errors.push(`Feature Catalog entry has no Deepwater mapping: ${id}`);
  errors.push(
    ...validateSnapshot(currentBaseline),
    ...validateImpactDeclaration(config.phase5ImpactDeclaration, capabilityIds, catalogIds),
    ...validateBackendSurfaceDispositions(config, currentBaseline),
  );
  if (config.releaseAuthority?.decisionEmitter !== "Sounding Line")
    errors.push("Deepwater attempts to claim release authority");
  if (config.soundingLinePolicyDigest !== soundingLinePolicyDigest)
    errors.push("Phase 5 Sounding Line policy identity is stale");
  if (config.scope?.schemaImpact !== "NONE" || config.scope?.productBehaviorImpact !== "NONE")
    errors.push("Phase 5 scope claims unauthorized product schema or business behavior impact");
  for (const item of config.continuousGovernance?.openItems ?? []) {
    if (!item.findingId || !item.owner || !item.status || !item.source || !item.evidence)
      errors.push("Phase 5 continuous-governance item has incomplete identity or evidence");
    if (!item.closureRequirement || !item.retryTrigger)
      errors.push(`Phase 5 continuous-governance item lacks closure lifecycle: ${item.findingId ?? "unknown"}`);
    if (
      (item.severity === "CRITICAL" || item.severity === "HIGH") &&
      (!item.owner || !item.closureRequirement || !item.retryTrigger)
    )
      errors.push(`blocking Phase 5 item lacks owner or closure lifecycle: ${item.findingId ?? "unknown"}`);
  }
  if (!stableStringify(delta).endsWith("\n")) errors.push("Phase 5 delta is not deterministic JSON");
  for (const audit of completionRecordAudits ?? []) {
    if (!audit.hasImpactDeclaration) errors.push(`completion record lacks Deepwater impact declaration: ${audit.path}`);
    if (audit.falselyClaimsCompletion)
      errors.push(`completion record overclaims Project Deepwater completion: ${audit.path}`);
  }
  return uniqueSorted(errors);
}

function report(governance) {
  const { config, currentBaseline, delta } = governance;
  return `---\ntitle: Project Deepwater Phase 5 Governance Report\naudience: product-engineering\nstatus: current\ncanonical_for: project-deepwater-phase-5-governance-report\nlast_reviewed: ${config.auditDate}\n---\n\n# Project Deepwater Phase 5 governance report\n\nPhase 5 is explicitly owner-authorized from accepted current main \`${config.baseOriginMainSha}\`. Phase 1-4 remain immutable, source-bound historical evidence.\n\n- Capabilities: ${currentBaseline.capabilityCount}\n- Feature Catalog entries: ${currentBaseline.featureCatalogCount}\n- Deterministic delta entries: ${delta.deltas.length}\n- Regression policy: active\n- Release authority: Sounding Line only\n- Local candidate state: ${config.localQualification?.state ?? "CANDIDATE_DEVELOPMENT"}\n\nThe pre-cutover focused evidence is retained as non-authoritative semantic history and has been rebound through the current policy identity \`${governance.soundingLinePolicyDigest}\`. ${config.localQualification?.holdReason ?? ""}\n\nThe guard validates catalog mappings, capability maturity, route/screen/journey references, evidence freshness, finding closures, restricted audiences, impact declarations, and truthful completion language without owning product behavior.\n`;
}

export async function phase5ArtifactFiles(root, governance) {
  const status = {
    schemaVersion: "1.0.0",
    project: governance.config.project,
    phase: governance.config.phase,
    state: governance.config.localQualification?.state ?? "GOVERNANCE_BASELINE_ESTABLISHED",
    baseSourceSha: governance.config.baseOriginMainSha,
    validation: "LOCAL_CONTROL_PLANE_QUALIFIED",
    mainlineState: governance.config.localQualification?.mainlineState ?? "CANDIDATE_DEVELOPMENT",
    acceptanceLane: governance.config.localQualification?.acceptanceLane ?? "SOUNDING_LINE_MAINLINE_DECISION_REQUIRED",
    schemaImpact: "NONE",
    productSourceImpact: "NONE",
    featureCatalogImpact: "NO_CHANGE_REQUIRED",
    ownerDecision: "NOT_APPLICABLE",
    soundingLinePolicyDigest: governance.soundingLinePolicyDigest,
    limitations: [
      "Phase 5 does not self-issue release authority or owner product acceptance.",
      governance.config.localQualification?.holdReason,
    ].filter(Boolean),
  };
  const queue = {
    schemaVersion: "1.0.0",
    project: governance.config.project,
    phase: "Phase 5",
    phase5Authorized: true,
    sourceSha: governance.config.baseOriginMainSha,
    queue: governance.config.continuousGovernance?.openItems ?? [],
    rationale:
      "Phase 5 is explicitly owner-authorized as a governance institutionalization phase. Any discovered external blocker remains visible with its owner and closure lifecycle.",
  };
  return new Map([
    [`${DEEPWATER_ROOT}/deepwater-phase-status.json`, stableStringify(status)],
    [`${DEEPWATER_ROOT}/reports/Project_Deepwater_Phase_5_Governance_Queue.json`, stableStringify(queue)],
    [
      `${DEEPWATER_ROOT}/reports/Project_Deepwater_Phase_5_Drift_Baseline.json`,
      stableStringify(governance.currentBaseline),
    ],
    [`${DEEPWATER_ROOT}/reports/Project_Deepwater_Phase_5_Delta_Report.json`, stableStringify(governance.delta)],
    [`${DEEPWATER_ROOT}/reports/Project_Deepwater_Phase_5_Governance_Report.md`, report(governance)],
  ]);
}

export async function writePhase5Artifacts(root, governance) {
  for (const [relative, content] of await phase5ArtifactFiles(root, governance)) {
    const target = path.join(root, relative);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content, "utf8");
  }
}

export async function comparePhase5Artifacts(root, governance) {
  const errors = [];
  for (const [relative, expected] of await phase5ArtifactFiles(root, governance))
    try {
      if ((await readFile(path.join(root, relative), "utf8")) !== expected)
        errors.push(`stale Phase 5 generated artifact: ${relative}`);
    } catch {
      errors.push(`missing Phase 5 generated artifact: ${relative}`);
    }
  return errors;
}

export function phase5SemanticDigest(governance) {
  return sha256(
    stableStringify({ config: governance.config, baseline: governance.currentBaseline, delta: governance.delta }),
  );
}

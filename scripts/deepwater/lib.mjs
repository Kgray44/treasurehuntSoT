import { createHash } from "node:crypto";
import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { format, resolveConfig } from "prettier";

export const DEEPWATER_ROOT = "Development_Docs/Programs/Deepwater";

const severityRank = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
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

const normalizePath = (value) => value.replaceAll("\\", "/");
const uniqueSorted = (values) => [...new Set(values.filter((value) => value !== undefined && value !== null))].sort();
const canonicalize = (value) => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    );
  return value;
};
export const stableStringify = (value) => `${JSON.stringify(canonicalize(value), null, 2)}\n`;
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

async function readJson(root, relative) {
  return JSON.parse(await readFile(path.join(root, relative), "utf8"));
}

async function loadCatalog(root, catalogDirectory) {
  const directory = path.join(root, catalogDirectory);
  const files = (await readdir(directory)).filter((file) => file.endsWith(".json")).sort();
  const entries = [];
  for (const file of files) {
    for (const entry of await readJson(root, path.join(catalogDirectory, file)))
      entries.push({ ...entry, fragment: normalizePath(path.join(catalogDirectory, file)) });
  }
  return entries.sort((left, right) => left.id.localeCompare(right.id));
}

export async function loadInputs(root) {
  const config = await readJson(root, `${DEEPWATER_ROOT}/deepwater-audit-config.json`);
  const ownership = await readJson(root, `${DEEPWATER_ROOT}/deepwater-ownership-map.json`);
  const [
    catalog,
    routes,
    screens,
    journeys,
    soundingLinePolicy,
    soundingLineSuites,
    soundingLineContracts,
    ledgerSchema,
  ] = await Promise.all([
    loadCatalog(root, config.sources.featureCatalog),
    readJson(root, config.sources.routeInventory),
    readJson(root, config.sources.screenCatalog),
    readJson(root, config.sources.journeyCatalog),
    readJson(root, config.sources.soundingLinePolicy),
    readJson(root, config.sources.soundingLineSuites),
    readJson(root, config.sources.soundingLineContracts),
    readJson(root, `${DEEPWATER_ROOT}/capability-realization-ledger.schema.json`),
  ]);
  return {
    config,
    ownership,
    catalog,
    routes,
    screens,
    journeys,
    soundingLinePolicy,
    soundingLineSuites,
    soundingLineContracts,
    ledgerSchema,
  };
}

function ownerIndex(ownership) {
  return new Map(ownership.projects.map((project) => [project.project, project]));
}

function inferAudience(surfaces) {
  const roles = new Set();
  for (const surface of surfaces) {
    if (!surface.startsWith("/")) continue;
    if (surface === "/" || surface.startsWith("/community") || surface.startsWith("/tales")) roles.add("VISITOR");
    if (surface.startsWith("/player") || surface.startsWith("/play") || surface.startsWith("/join"))
      roles.add("PLAYER");
    if (surface.startsWith("/captain")) roles.add("CAPTAIN");
    if (surface.startsWith("/studio")) roles.add("CREATOR");
    if (surface.startsWith("/account") || surface.startsWith("/passport") || surface.startsWith("/profile"))
      roles.add("ACCOUNT_OWNER");
  }
  return roles.size ? [...roles].sort() : ["DEVELOPER", "OPERATOR"];
}

function evidenceKind(kind) {
  return (
    {
      path: "SOURCE_PATH",
      test: "TEST",
      "completion-record": "COMPLETION_RECORD",
      commit: "COMMIT",
      branch: "BRANCH",
    }[kind] ?? "FEATURE_CATALOG"
  );
}

function makeEvidence(capabilityId, index, kind, reference, sourceSha, freshness = "CURRENT") {
  return {
    evidenceId: `DW-EV-${capabilityId.slice("DW-CAP-".length)}-${String(index).padStart(3, "0")}`,
    kind,
    reference: normalizePath(reference),
    sourceSha,
    freshness,
  };
}

function sourceLayerReferences(references) {
  const normalized = uniqueSorted(references.map(normalizePath));
  return {
    domain: normalized.filter((reference) => /^(?:prisma\/|src\/domain\/)|\/domain\//u.test(reference)),
    service: normalized.filter(
      (reference) =>
        /^(?:src\/|scripts\/)/u.test(reference) &&
        !/^src\/app\//u.test(reference) &&
        !/^src\/components\//u.test(reference),
    ),
    transport: normalized.filter((reference) => /^src\/app\/api\//u.test(reference)),
    authorization: normalized.filter((reference) =>
      /auth|policy|privacy|security|consent/u.test(reference.toLowerCase()),
    ),
    projection: normalized.filter((reference) =>
      /projection|dto|saniti|public-card|privacy/u.test(reference.toLowerCase()),
    ),
    client: normalized.filter((reference) => /^src\/components\//u.test(reference)),
    ui: normalized.filter((reference) => /^src\/(?:app\/.*\/page|components\/)/u.test(reference)),
  };
}

function layer(status, references = []) {
  return { status, references: uniqueSorted(references) };
}

function statusFor(references, fallback = "UNKNOWN") {
  return references.length ? "PARTIAL" : fallback;
}

function stateCoverage(required, represented) {
  const values = uniqueSorted(represented);
  const tokens = values.map((value) => value.toUpperCase());
  const present = (state) => {
    const synonyms = {
      LOADING: ["LOADING"],
      READY: ["READY", "DEFAULT", "POPULATED", "SUCCESS", "COMPLETE"],
      EMPTY: ["EMPTY", "NO_RESULT", "NO-RESULT"],
      ERROR: ["ERROR", "FAILURE", "FAILED"],
      UNAUTHORIZED: ["UNAUTHORIZED", "FORBIDDEN", "PERMISSION", "DENIED"],
      RECOVERY: ["RECOVERY", "RETRY", "DEPENDENCY_UNAVAILABLE", "RESUMED", "CANCELLED"],
    }[state] ?? [state];
    return tokens.some((value) => synonyms.some((synonym) => value.includes(synonym)));
  };
  return {
    required: uniqueSorted(required),
    represented: values,
    missing: uniqueSorted(required.filter((state) => !present(state))),
  };
}

function routeMatchesFor(surfaces, routeMap) {
  return surfaces
    .filter((surface) => surface.startsWith("/"))
    .map((surface) => routeMap.get(surface))
    .filter(Boolean);
}

function buildCatalogCapability(entry, policy, context) {
  const { config, owners, routeMap, screens, journeysById } = context;
  const sourceReferences = entry.evidence.map((evidence) => evidence.value).filter(Boolean);
  const sourceLayers = sourceLayerReferences(sourceReferences);
  const humanSurfaces = entry.surfaces.filter((surface) => surface.startsWith("/") && !surface.startsWith("/api"));
  const matchedRoutes = routeMatchesFor(entry.surfaces, routeMap);
  const matchedRouteIds = new Set(matchedRoutes.map((route) => route.routeId));
  const matchedScreens = screens.filter((screen) => screen.routeIds.some((routeId) => matchedRouteIds.has(routeId)));
  const missingCatalogSurfaces = entry.surfaces.filter(
    (surface) => surface.startsWith("/") && surface !== "/api" && !routeMap.has(surface),
  );
  const hasHumanSurface = humanSurfaces.length > 0;
  const navigableRoutes = matchedRoutes.filter(
    (route) => ["USER_NAVIGABLE", "CONTEXTUAL_DYNAMIC"].includes(route.classification) && !route.directUrlRequired,
  );
  const journeyIds = uniqueSorted([
    ...matchedRoutes.flatMap((route) => route.currentJourneys ?? []),
    ...matchedScreens.flatMap((screen) => screen.journeyIds ?? []),
  ]).filter((journeyId) => journeysById.has(journeyId));
  const screenshotIds = uniqueSorted(matchedScreens.flatMap((screen) => screen.screenshotIds ?? []));
  const representedStates = uniqueSorted([
    ...matchedRoutes.flatMap((route) => route.currentSupportedStates ?? []),
    ...matchedScreens.flatMap((screen) => screen.applicableStates ?? []),
  ]);
  const defaultHighest = navigableRoutes.length
    ? "DISCOVERABLE"
    : matchedRoutes.length || sourceLayers.ui.length
      ? "UI"
      : sourceLayers.transport.length || entry.surfaces.some((surface) => surface.startsWith("/api"))
        ? "API"
        : sourceLayers.service.length
          ? "SERVICE"
          : "DOMAIN";
  const expectedDisposition = policy.expectedDisposition ?? (hasHumanSurface ? "USER_FACING" : "MACHINE_CONSUMER");
  const expectedTerminalRung = policy.expectedTerminalRung ?? (hasHumanSurface ? "JOURNEY_PROVEN" : "SERVICE");
  const classification = policy.classification ?? "PARTIALLY_REALIZED";
  const flags = new Set(policy.secondaryFlags ?? ["UNVERIFIED", ...(hasHumanSurface ? ["JOURNEY_UNPROVEN"] : [])]);
  if (missingCatalogSurfaces.length) flags.add("DOCUMENTATION_MISMATCH");
  const owner = owners.get(policy.ownerProject);
  const evidenceReferences = [];
  evidenceReferences.push(
    makeEvidence(
      policy.capabilityId,
      evidenceReferences.length + 1,
      "FEATURE_CATALOG",
      `${entry.fragment}#${entry.id}`,
      config.auditedSourceSha,
    ),
  );
  for (const evidence of entry.evidence)
    evidenceReferences.push(
      makeEvidence(
        policy.capabilityId,
        evidenceReferences.length + 1,
        evidenceKind(evidence.kind),
        evidence.value,
        config.auditedSourceSha,
        evidence.kind === "commit" || evidence.kind === "branch" ? "BOUNDED" : "CURRENT",
      ),
    );
  for (const route of matchedRoutes)
    evidenceReferences.push(
      makeEvidence(
        policy.capabilityId,
        evidenceReferences.length + 1,
        "ROUTE_INVENTORY",
        `${config.sources.routeInventory}#${route.routeId}`,
        config.auditedSourceSha,
        "BOUNDED",
      ),
    );
  for (const screen of matchedScreens)
    evidenceReferences.push(
      makeEvidence(
        policy.capabilityId,
        evidenceReferences.length + 1,
        "SCREEN_CATALOG",
        `${config.sources.screenCatalog}#${screen.screenId}`,
        config.auditedSourceSha,
        "BOUNDED",
      ),
    );
  const ownerAcceptance =
    entry.id === "FT-B007"
      ? "PENDING_OWNER_DECISION"
      : entry.id === "FT-B008"
        ? "OWNER_ACCEPTED_WITH_EXPLICIT_LIMITATIONS"
        : expectedTerminalRung === "OWNER_ACCEPTED"
          ? "UNKNOWN"
          : "NOT_REQUIRED";
  const requiredStates = hasHumanSurface
    ? ["LOADING", "READY", "EMPTY", "ERROR", "UNAUTHORIZED", "RECOVERY"]
    : ["SUCCESS", "FAILURE"];
  const navigationReferences = navigableRoutes.flatMap((route) => [
    route.routePattern,
    ...(route.currentVisibleEntries ?? []).map((entryPoint) => entryPoint.entryId),
  ]);
  const traceJourneyReferences = journeyIds.slice(0, 25);
  return {
    capabilityId: policy.capabilityId,
    catalogMapping: {
      featureCatalogId: entry.id,
      mapping: "PARENT",
      declaredProgram: entry.program ?? null,
      declaredStatus: entry.status,
      declaredSurfaces: uniqueSorted(entry.surfaces),
      declaredSubfeatures: uniqueSorted(entry.subfeatures),
      declaredLimitations: uniqueSorted(entry.limitations ?? []),
    },
    name: entry.title,
    meaning: entry.summary,
    owner: {
      project: owner.project,
      contract: owner.contract,
      contributingProjects: uniqueSorted(policy.contributingProjects ?? []),
    },
    audience: {
      roles: uniqueSorted(policy.audience ?? inferAudience(entry.surfaces)),
      privacyClass: policy.privacyClass ?? (hasHumanSurface ? "PUBLIC_OR_ACCOUNT_GOVERNED" : "INTERNAL_METADATA"),
      privilegeRequirements: uniqueSorted(
        policy.privilegeRequirements ?? (hasHumanSurface ? ["ROUTE_POLICY"] : ["REPOSITORY_OR_SERVICE_ACCESS"]),
      ),
    },
    expectedRealization: {
      terminalRung: expectedTerminalRung,
      disposition: expectedDisposition,
      requiredSurfaces: uniqueSorted(entry.surfaces),
      rationale:
        policy.rationale ??
        (hasHumanSurface
          ? "Cataloged human-facing capability requires a visible governed path, complete states, accessibility, and natural-journey evidence."
          : "Cataloged machine or developer capability terminates at its governed non-ordinary-user boundary."),
    },
    currentRealization: {
      highestRung: policy.currentHighestRung ?? defaultHighest,
      classification,
      secondaryFlags: [...flags].sort(),
      confidence: policy.confidence ?? "MEDIUM",
    },
    trace: {
      domain: layer(statusFor(sourceLayers.domain), sourceLayers.domain),
      service: layer(statusFor(sourceLayers.service), sourceLayers.service),
      transport: layer(
        statusFor(
          uniqueSorted([...sourceLayers.transport, ...entry.surfaces.filter((surface) => surface.startsWith("/api"))]),
          expectedDisposition === "USER_FACING" ? "UNKNOWN" : "NOT_APPLICABLE",
        ),
        [...sourceLayers.transport, ...entry.surfaces.filter((surface) => surface.startsWith("/api"))],
      ),
      authorization: layer(
        statusFor(sourceLayers.authorization, hasHumanSurface ? "UNKNOWN" : "NOT_APPLICABLE"),
        sourceLayers.authorization,
      ),
      projection: layer(
        statusFor(sourceLayers.projection, expectedDisposition === "INTERNAL" ? "NOT_APPLICABLE" : "UNKNOWN"),
        sourceLayers.projection,
      ),
      client: layer(
        statusFor(sourceLayers.client, hasHumanSurface ? "UNKNOWN" : "NOT_APPLICABLE"),
        sourceLayers.client,
      ),
      ui: layer(
        matchedRoutes.length ? "PARTIAL" : hasHumanSurface ? statusFor(sourceLayers.ui, "ABSENT") : "NOT_APPLICABLE",
        uniqueSorted([...sourceLayers.ui, ...matchedRoutes.map((route) => route.implementationSource)]),
      ),
      navigation: layer(
        navigableRoutes.length ? "PARTIAL" : hasHumanSurface ? "ABSENT" : "NOT_APPLICABLE",
        navigationReferences,
      ),
      accessibility: layer(
        matchedScreens.length ? "PARTIAL" : hasHumanSurface ? "UNKNOWN" : "NOT_APPLICABLE",
        matchedScreens.map((screen) => screen.acceptanceContract),
      ),
      journey: layer(
        traceJourneyReferences.length ? "PARTIAL" : hasHumanSurface ? "ABSENT" : "NOT_APPLICABLE",
        traceJourneyReferences,
      ),
      suspectedFirstLossPoint: missingCatalogSurfaces.length
        ? "CATALOG_TO_ROUTE"
        : classification === "BACKEND_ONLY"
          ? "PROJECTION"
          : flags.has("JOURNEY_UNPROVEN")
            ? "JOURNEY"
            : null,
    },
    states: stateCoverage(requiredStates, representedStates),
    quality: {
      discoverability: navigableRoutes.length ? "PARTIAL" : hasHumanSurface ? "ABSENT" : "NOT_APPLICABLE",
      visualMaturity: matchedScreens.length ? "PARTIAL" : hasHumanSurface ? "UNKNOWN" : "NOT_APPLICABLE",
      accessibility: matchedScreens.length ? "PARTIAL" : hasHumanSurface ? "UNKNOWN" : "NOT_APPLICABLE",
      responsive: matchedScreens.length ? "PARTIAL" : hasHumanSurface ? "UNKNOWN" : "NOT_APPLICABLE",
      recovery: representedStates.some((state) => /FAIL|ERROR|RECOVER|RETRY|UNAVAILABLE/u.test(state))
        ? "PARTIAL"
        : hasHumanSurface
          ? "UNKNOWN"
          : "NOT_APPLICABLE",
    },
    evidence: {
      sourceSha: config.auditedSourceSha,
      references: evidenceReferences,
      testIds: uniqueSorted(
        entry.evidence.filter((evidence) => evidence.kind === "test").map((evidence) => evidence.value),
      ),
      screenshotIds,
      journeyIds,
      ownerAcceptance,
    },
    gaps: { findingIds: [], highestSeverity: null, impact: null, assignedOwner: null, targetPhase: null },
    lifecycle: {
      firstSeen: config.auditDate,
      lastAudited: config.auditDate,
      closedAt: null,
      regressionState: "NOT_OBSERVED",
    },
    _audit: { missingCatalogSurfaces },
  };
}

function buildUncatalogedCapability(seed, context) {
  const { config, owners, routeMap, screens, journeysById } = context;
  const sourceLayers = sourceLayerReferences(seed.sourceReferences);
  const matchedRoutes = routeMatchesFor(seed.requiredSurfaces, routeMap);
  const matchedRouteIds = new Set(matchedRoutes.map((route) => route.routeId));
  const matchedScreens = screens.filter((screen) => screen.routeIds.some((routeId) => matchedRouteIds.has(routeId)));
  const journeyIds = uniqueSorted([
    ...matchedRoutes.flatMap((route) => route.currentJourneys ?? []),
    ...matchedScreens.flatMap((screen) => screen.journeyIds ?? []),
  ]).filter((journeyId) => journeysById.has(journeyId));
  const evidenceReferences = seed.sourceReferences.map((reference, index) =>
    makeEvidence(
      seed.capabilityId,
      index + 1,
      /\.test\./u.test(reference) ? "TEST" : "SOURCE_PATH",
      reference,
      config.auditedSourceSha,
    ),
  );
  const owner = owners.get(seed.ownerProject);
  const isHuman = seed.expectedDisposition === "USER_FACING";
  const rationale =
    seed.rationale ??
    (isHuman
      ? "Human-facing capability requires a visible, state-complete, accessible natural journey."
      : "The capability is bounded to its governed operational or machine audience.");
  return {
    capabilityId: seed.capabilityId,
    catalogMapping: null,
    name: seed.name,
    meaning: seed.meaning,
    owner: {
      project: owner.project,
      contract: owner.contract,
      contributingProjects: uniqueSorted(seed.contributingProjects ?? []),
    },
    audience: {
      roles: uniqueSorted(seed.audience),
      privacyClass: seed.privacyClass,
      privilegeRequirements: uniqueSorted(seed.privilegeRequirements),
    },
    expectedRealization: {
      terminalRung: seed.expectedTerminalRung,
      disposition: seed.expectedDisposition,
      requiredSurfaces: uniqueSorted(seed.requiredSurfaces),
      rationale,
    },
    currentRealization: {
      highestRung: seed.currentHighestRung,
      classification: seed.classification,
      secondaryFlags: uniqueSorted(seed.secondaryFlags ?? []),
      confidence: seed.confidence,
    },
    trace: {
      domain: layer(statusFor(sourceLayers.domain), sourceLayers.domain),
      service: layer(statusFor(sourceLayers.service), sourceLayers.service),
      transport: layer(
        statusFor(sourceLayers.transport, isHuman ? "UNKNOWN" : "NOT_APPLICABLE"),
        sourceLayers.transport,
      ),
      authorization: layer(
        statusFor(
          sourceLayers.authorization,
          seed.expectedDisposition === "SECURITY_RESTRICTED" ? "UNKNOWN" : "NOT_APPLICABLE",
        ),
        sourceLayers.authorization,
      ),
      projection: layer(
        statusFor(sourceLayers.projection, seed.expectedTerminalRung === "PROJECTION" ? "ABSENT" : "NOT_APPLICABLE"),
        sourceLayers.projection,
      ),
      client: layer(statusFor(sourceLayers.client, isHuman ? "UNKNOWN" : "NOT_APPLICABLE"), sourceLayers.client),
      ui: layer(
        matchedRoutes.length ? "PARTIAL" : isHuman ? "ABSENT" : "NOT_APPLICABLE",
        uniqueSorted([...sourceLayers.ui, ...matchedRoutes.map((route) => route.implementationSource)]),
      ),
      navigation: layer(
        matchedRoutes.length ? "PARTIAL" : isHuman ? "ABSENT" : "NOT_APPLICABLE",
        matchedRoutes.map((route) => route.routePattern),
      ),
      accessibility: layer(
        matchedScreens.length ? "PARTIAL" : isHuman ? "UNKNOWN" : "NOT_APPLICABLE",
        matchedScreens.map((screen) => screen.acceptanceContract),
      ),
      journey: layer(journeyIds.length ? "PARTIAL" : isHuman ? "ABSENT" : "NOT_APPLICABLE", journeyIds.slice(0, 25)),
      suspectedFirstLossPoint:
        seed.classification === "BACKEND_ONLY"
          ? "PROJECTION"
          : seed.secondaryFlags.includes("JOURNEY_UNPROVEN")
            ? "JOURNEY"
            : null,
    },
    states: stateCoverage(seed.requiredStates, seed.representedStates),
    quality: {
      discoverability: matchedRoutes.length ? "PARTIAL" : isHuman ? "ABSENT" : "NOT_APPLICABLE",
      visualMaturity: matchedScreens.length ? "PARTIAL" : isHuman ? "UNKNOWN" : "NOT_APPLICABLE",
      accessibility: matchedScreens.length ? "PARTIAL" : isHuman ? "UNKNOWN" : "NOT_APPLICABLE",
      responsive: matchedScreens.length ? "PARTIAL" : isHuman ? "UNKNOWN" : "NOT_APPLICABLE",
      recovery: seed.representedStates.some((state) => /FAIL|ERROR|RETRY|RECOVER|CANCEL|UNAVAILABLE/u.test(state))
        ? "PARTIAL"
        : "UNKNOWN",
    },
    evidence: {
      sourceSha: config.auditedSourceSha,
      references: evidenceReferences,
      testIds: uniqueSorted(seed.sourceReferences.filter((reference) => /\.test\./u.test(reference))),
      screenshotIds: uniqueSorted(matchedScreens.flatMap((screen) => screen.screenshotIds ?? [])),
      journeyIds,
      ownerAcceptance: seed.expectedTerminalRung === "OWNER_ACCEPTED" ? "UNKNOWN" : "NOT_REQUIRED",
    },
    gaps: { findingIds: [], highestSeverity: null, impact: null, assignedOwner: null, targetPhase: null },
    lifecycle: {
      firstSeen: config.auditDate,
      lastAudited: config.auditDate,
      closedAt: null,
      regressionState: "NOT_OBSERVED",
    },
    _audit: { missingCatalogSurfaces: [] },
  };
}

function buildFindingFromConfig(finding, config) {
  return {
    findingId: finding.findingId,
    capabilityId: finding.capabilityId,
    gapFamilies: uniqueSorted(finding.gapFamilies),
    severity: finding.severity,
    confidence: finding.confidence,
    observedSourceSha: config.auditedSourceSha,
    evidence: uniqueSorted(finding.evidence),
    expectedBehavior: finding.expectedBehavior,
    currentBehavior: finding.currentBehavior,
    firstLossPoint: finding.firstLossPoint,
    canonicalOwner: finding.canonicalOwner,
    contributingOwners: uniqueSorted(finding.contributingOwners ?? []),
    assignedProjectPhase: finding.assignedProjectPhase,
    mainlineDependency: finding.mainlineDependency,
    closureEvidence: finding.closureEvidence,
    status: finding.status,
    debt: null,
    closedAt: null,
  };
}

function buildCatalogMismatchFinding(capability, config) {
  const id = capability.catalogMapping.featureCatalogId;
  const missing = capability._audit.missingCatalogSurfaces;
  const present = capability.catalogMapping.declaredSurfaces.filter((surface) => !missing.includes(surface));
  return {
    findingId: `DW-FIND-CATALOG-SURFACE-${id}`,
    capabilityId: capability.capabilityId,
    gapFamilies: ["DW-DOC", "DW-NAV"],
    severity: present.some((surface) => surface.startsWith("/")) ? "LOW" : "MEDIUM",
    confidence: "HIGH",
    observedSourceSha: config.auditedSourceSha,
    evidence: [capability.catalogMapping.featureCatalogId, config.sources.routeInventory],
    expectedBehavior:
      "Feature Catalog primary surfaces identify current governed route patterns or an explicit non-route boundary.",
    currentBehavior: `Catalog surface(s) ${missing.join(", ")} do not exactly match the accepted Homeport route inventory.`,
    firstLossPoint: "FEATURE_CATALOG_TO_ROUTE_INVENTORY",
    canonicalOwner: capability.owner.project,
    contributingOwners: ["Ledgerlight"],
    assignedProjectPhase: `${capability.owner.project} and Ledgerlight catalog reconciliation`,
    mainlineDependency: "Current owner-approved route identity",
    closureEvidence:
      "Owning Feature Catalog fragment reconciled to current route identity or annotated with a governed compatibility explanation; feature sync and validation pass.",
    status: "ASSIGNED",
    debt: null,
    closedAt: null,
  };
}

function attachFindings(capabilities, findings) {
  const findingsByCapability = new Map();
  for (const finding of findings) {
    const list = findingsByCapability.get(finding.capabilityId) ?? [];
    list.push(finding);
    findingsByCapability.set(finding.capabilityId, list);
  }
  return capabilities.map((capability) => {
    const related = (findingsByCapability.get(capability.capabilityId) ?? []).sort((a, b) =>
      a.findingId.localeCompare(b.findingId),
    );
    const open = related.filter((finding) => finding.status !== "CLOSED");
    const highest = open.length
      ? [...open].sort((a, b) => severityRank[a.severity] - severityRank[b.severity])[0]
      : null;
    const cleanCapability = { ...capability };
    delete cleanCapability._audit;
    return {
      ...cleanCapability,
      gaps: {
        findingIds: related.map((finding) => finding.findingId),
        highestSeverity: highest?.severity ?? null,
        impact: highest?.currentBehavior ?? null,
        assignedOwner: highest?.canonicalOwner ?? null,
        targetPhase: highest?.assignedProjectPhase ?? null,
      },
    };
  });
}

function countBy(values) {
  return Object.fromEntries(
    [...new Set(values)].sort().map((value) => [value, values.filter((candidate) => candidate === value).length]),
  );
}

function ratio(numerator, denominator) {
  return denominator === 0 ? 1 : Number((numerator / denominator).toFixed(4));
}

export function buildMetrics(capabilities, findings, catalogEntryCount) {
  const classifications = countBy(capabilities.map((capability) => capability.currentRealization.classification));
  const flags = countBy(capabilities.flatMap((capability) => capability.currentRealization.secondaryFlags));
  const owners = countBy(capabilities.map((capability) => capability.owner.project));
  const terminalRungs = countBy(capabilities.map((capability) => capability.expectedRealization.terminalRung));
  const openFindings = findings.filter((finding) => finding.status !== "CLOSED");
  const userFacing = capabilities.filter((capability) => capability.expectedRealization.disposition === "USER_FACING");
  const mapped = capabilities.filter((capability) => capability.catalogMapping);
  const fullyAtTerminal = capabilities.filter(
    (capability) =>
      rungRank[capability.currentRealization.highestRung] >= rungRank[capability.expectedRealization.terminalRung] &&
      !capability.gaps.findingIds.some((findingId) =>
        openFindings.some(
          (finding) => finding.findingId === findingId && ["CRITICAL", "HIGH"].includes(finding.severity),
        ),
      ),
  );
  const journeyCovered = userFacing.filter((capability) => capability.evidence.journeyIds.length > 0);
  return {
    totalMeaningfulCapabilities: capabilities.length,
    featureCatalogMappedCount: mapped.length,
    uncatalogedMeaningfulCapabilityCount: capabilities.length - mapped.length,
    classifications,
    secondaryFlags: flags,
    capabilitiesByCanonicalOwner: owners,
    capabilitiesByExpectedTerminalRung: terminalRungs,
    openFindingsBySeverity: countBy(openFindings.map((finding) => finding.severity)),
    ownershipAmbiguousCount: flags.OWNERSHIP_AMBIGUOUS ?? 0,
    userFacingLackingDiscoverabilityEvidence: userFacing.filter(
      (capability) => capability.trace.navigation.status !== "VERIFIED",
    ).length,
    userFacingLackingStateCompletenessEvidence: userFacing.filter((capability) => capability.states.missing.length > 0)
      .length,
    userFacingLackingAccessibilityEvidence: userFacing.filter(
      (capability) => capability.trace.accessibility.status !== "VERIFIED",
    ).length,
    userFacingLackingJourneyEvidence: userFacing.filter((capability) => capability.evidence.journeyIds.length === 0)
      .length,
    ratios: {
      featureCatalogMappingCoverage: ratio(mapped.length, catalogEntryCount),
      initialRealizationCoverage: ratio(fullyAtTerminal.length, capabilities.length),
      naturalJourneyEvidenceCoverage: ratio(journeyCovered.length, userFacing.length),
      ownerMappedCoverage: ratio(
        capabilities.filter((capability) => capability.owner.project).length,
        capabilities.length,
      ),
    },
  };
}

function queuePriority(item) {
  const classRank = {
    BROKEN: 0,
    FRONTEND_ONLY: 1,
    BACKEND_ONLY: 2,
    HIDDEN: 3,
    PARTIALLY_REALIZED: 4,
    SECURITY_RESTRICTED: 5,
    INTERNAL_BY_DESIGN: 6,
    DEPRECATED: 7,
  };
  return severityRank[item.severity] * 100 + (classRank[item.currentClassification] ?? 50);
}

function buildTraceQueue(capabilities, findings) {
  const items = [];
  const queued = new Set();
  for (const finding of findings.filter((candidate) => candidate.status !== "CLOSED")) {
    const capability = capabilities.find((candidate) => candidate.capabilityId === finding.capabilityId);
    items.push({
      queueId: `DW-P2-${finding.findingId.slice("DW-FIND-".length)}`,
      capabilityId: capability.capabilityId,
      currentClassification: capability.currentRealization.classification,
      reasonSelected: `${finding.severity} ${finding.gapFamilies.join("+")} finding: ${finding.currentBehavior}`,
      suspectedLossLayer: finding.firstLossPoint,
      canonicalOwner: capability.owner.project,
      severity: finding.severity,
      confidence: finding.confidence,
      evidenceAvailable: finding.evidence,
      missingEvidence: [finding.closureEvidence],
      activeProjectConsiderations: `Audit accepted main only; coordinate with ${finding.assignedProjectPhase} before remediation.`,
    });
    queued.add(capability.capabilityId);
  }
  for (const capability of capabilities) {
    if (queued.has(capability.capabilityId)) continue;
    if (
      !["PARTIALLY_REALIZED", "BACKEND_ONLY", "FRONTEND_ONLY", "HIDDEN", "BROKEN"].includes(
        capability.currentRealization.classification,
      )
    )
      continue;
    items.push({
      queueId: `DW-P2-TRACE-${capability.capabilityId.slice("DW-CAP-".length)}`,
      capabilityId: capability.capabilityId,
      currentClassification: capability.currentRealization.classification,
      reasonSelected: `Initial ${capability.currentRealization.classification} classification requires a complete end-to-end trace.`,
      suspectedLossLayer: capability.trace.suspectedFirstLossPoint ?? "UNKNOWN",
      canonicalOwner: capability.owner.project,
      severity: capability.currentRealization.classification === "BACKEND_ONLY" ? "MEDIUM" : "LOW",
      confidence: capability.currentRealization.confidence,
      evidenceAvailable: capability.evidence.references.map((reference) => reference.reference).slice(0, 8),
      missingEvidence: ["Complete source-to-terminal-rung trace and capability-specific evidence"],
      activeProjectConsiderations: `Refresh if ${capability.owner.project} changes the audited surface before Phase 2 begins.`,
    });
  }
  return items.sort(
    (left, right) => queuePriority(left) - queuePriority(right) || left.queueId.localeCompare(right.queueId),
  );
}

function buildReconciliation(capabilities) {
  return capabilities
    .filter((capability) => capability.catalogMapping)
    .map((capability) => ({
      featureCatalogId: capability.catalogMapping.featureCatalogId,
      capabilityId: capability.capabilityId,
      declaredStatus: capability.catalogMapping.declaredStatus,
      declaredSurfaces: capability.catalogMapping.declaredSurfaces,
      observedClassification: capability.currentRealization.classification,
      observedHighestRung: capability.currentRealization.highestRung,
      documentationMismatch: capability.currentRealization.secondaryFlags.includes("DOCUMENTATION_MISMATCH"),
      mismatchFindingIds: capability.gaps.findingIds.filter((findingId) =>
        findingId.startsWith("DW-FIND-CATALOG-SURFACE-"),
      ),
    }))
    .sort((left, right) => left.featureCatalogId.localeCompare(right.featureCatalogId));
}

function markdownFrontmatter(title, canonicalFor) {
  return `---\ntitle: ${title}\naudience: product-engineering\nstatus: current\ncanonical_for: ${canonicalFor}\nlast_reviewed: 2026-08-09\n---\n\n`;
}

function buildAuditReport(inputs, ledger, findings, metrics, queue, reconciliation) {
  const mismatchCount = reconciliation.filter((entry) => entry.documentationMismatch).length;
  return `${markdownFrontmatter("Project Deepwater Phase 1 Audit Report", "project-deepwater-phase-1-audit-report")}# Project Deepwater Phase 1 audit report

## Decision boundary

Phase 1 establishes the governed inventory foundation. It does not claim complete Phase 2 traces, product remediation, deployment, production-provider proof, or owner acceptance. The audited product source is \`${ledger.auditedSourceSha}\`.

## Inventory result

| Measure | Count |
| --- | ---: |
| Meaningful capabilities | ${metrics.totalMeaningfulCapabilities} |
| Feature Catalog mapped | ${metrics.featureCatalogMappedCount} |
| Uncataloged meaningful | ${metrics.uncatalogedMeaningfulCapabilityCount} |
| Ownership ambiguous | ${metrics.ownershipAmbiguousCount} |
| Initial findings | ${findings.length} |
| Phase 2 queue | ${queue.length} |
| Catalog entries with route-surface mismatch | ${mismatchCount} |

The seed catalog contains ${inputs.catalog.length} accepted entries. The uncataloged survey adds account lifecycle, transactional email, private-provider operations, backup/restore, repair, community operations, bounded compatibility observation, and public-origin trust capabilities that have named consumers or operational purpose.

## Realization observations

${Object.entries(metrics.classifications)
  .map(([key, value]) => `- ${key}: ${value}`)
  .join("\n")}

The classifications are deliberately conservative. A catalog status, source path, route, or historic completion receipt is not sufficient to reach \`FULLY_REALIZED\`. Current Homeport route, screen, and journey records are consumed as bounded evidence, while capability-specific state, accessibility, journey, external-provider, deployment, and owner boundaries remain explicit.

## Material initial findings

${findings
  .filter((finding) => ["CRITICAL", "HIGH", "MEDIUM"].includes(finding.severity))
  .map(
    (finding) =>
      `- **${finding.findingId} (${finding.severity})** - ${finding.currentBehavior} Owner: ${finding.canonicalOwner}.`,
  )
  .join("\n")}

## Catalog reconciliation

${mismatchCount} catalog capabilities advertise at least one surface that does not exactly match the accepted Homeport route inventory. Most are legacy naming or composite-surface issues and are recorded as \`DW-DOC\`/\`DW-NAV\` findings rather than product-source fixes. Deepwater does not hand-edit the generated Feature Catalog or overwrite subsystem metadata.

## Truth boundaries

- Homeport Phase 7 remains \`PENDING_OWNER_DECISION\`.
- Protected-staging and synthetic evidence are not production deployment proof.
- Real-provider evidence is scoped to its recorded provider, host, account, and source.
- No Prisma schema, migration, product page, route, service, or runtime behavior is changed by Phase 1.
- Unknown trace layers remain unknown for Phase 2 rather than being inferred from filenames.
`;
}

function buildCapabilitySummary(ledger, metrics, findings, queue) {
  const ownerRows = Object.entries(metrics.capabilitiesByCanonicalOwner)
    .map(([owner, count]) => `| ${owner} | ${count} |`)
    .join("\n");
  const rungRows = Object.entries(metrics.capabilitiesByExpectedTerminalRung)
    .map(([rung, count]) => `| ${rung} | ${count} |`)
    .join("\n");
  return `${markdownFrontmatter("Project Deepwater Phase 1 Capability Summary", "project-deepwater-phase-1-capability-summary")}# Project Deepwater Phase 1 capability summary

Audited product source: \`${ledger.auditedSourceSha}\`. Generated deterministically from the explicit Deepwater policy registry and accepted control-plane sources.

## Coverage

| Ratio | Value |
| --- | ---: |
| Feature Catalog mapping | ${(metrics.ratios.featureCatalogMappingCoverage * 100).toFixed(2)}% |
| Initial realization | ${(metrics.ratios.initialRealizationCoverage * 100).toFixed(2)}% |
| Natural-journey evidence | ${(metrics.ratios.naturalJourneyEvidenceCoverage * 100).toFixed(2)}% |
| Owner mapped | ${(metrics.ratios.ownerMappedCoverage * 100).toFixed(2)}% |

## Capabilities by owner

| Canonical owner | Capabilities |
| --- | ---: |
${ownerRows}

## Expected terminal rungs

| Terminal rung | Capabilities |
| --- | ---: |
${rungRows}

## Evidence gaps

- User-facing capabilities lacking verified discoverability evidence: ${metrics.userFacingLackingDiscoverabilityEvidence}
- User-facing capabilities lacking complete state evidence: ${metrics.userFacingLackingStateCompletenessEvidence}
- User-facing capabilities lacking verified accessibility evidence: ${metrics.userFacingLackingAccessibilityEvidence}
- User-facing capabilities lacking any mapped journey evidence: ${metrics.userFacingLackingJourneyEvidence}
- Open findings: ${findings.filter((finding) => finding.status !== "CLOSED").length}
- Prioritized Phase 2 trace items: ${queue.length}

These figures prioritize tracing. They do not convert incomplete evidence into product maturity.
`;
}

export async function buildArtifacts(root) {
  const inputs = await loadInputs(root);
  const owners = ownerIndex(inputs.ownership);
  const routeMap = new Map(inputs.routes.routes.map((route) => [route.routePattern, route]));
  const journeysById = new Map(inputs.journeys.journeys.map((journey) => [journey.journeyId, journey]));
  const context = { config: inputs.config, owners, routeMap, screens: inputs.screens.screens, journeysById };
  const catalogCapabilities = inputs.catalog.map((entry) => {
    const policy = inputs.config.catalogPolicies[entry.id];
    if (!policy) throw new Error(`MISSING_CATALOG_POLICY:${entry.id}`);
    return buildCatalogCapability(entry, policy, context);
  });
  const uncatalogedCapabilities = inputs.config.uncatalogedCapabilities.map((seed) =>
    buildUncatalogedCapability(seed, context),
  );
  const rawCapabilities = [...catalogCapabilities, ...uncatalogedCapabilities].sort((left, right) =>
    left.capabilityId.localeCompare(right.capabilityId),
  );
  const explicitFindings = inputs.config.explicitFindings.map((finding) =>
    buildFindingFromConfig(finding, inputs.config),
  );
  const mismatchFindings = rawCapabilities
    .filter((capability) => capability.catalogMapping && capability._audit.missingCatalogSurfaces.length)
    .map((capability) => buildCatalogMismatchFinding(capability, inputs.config));
  const findings = [...explicitFindings, ...mismatchFindings].sort((left, right) =>
    left.findingId.localeCompare(right.findingId),
  );
  const capabilities = attachFindings(rawCapabilities, findings).sort((left, right) =>
    left.capabilityId.localeCompare(right.capabilityId),
  );
  const ledger = {
    schemaVersion: "1.0.0",
    project: inputs.config.project,
    phase: inputs.config.phase,
    auditedSourceSha: inputs.config.auditedSourceSha,
    auditDate: inputs.config.auditDate,
    generation: {
      deterministic: true,
      catalogEntries: catalogCapabilities.length,
      uncatalogedCapabilities: uncatalogedCapabilities.length,
      sourceInputs: uniqueSorted(Object.values(inputs.config.sources)),
    },
    capabilities,
  };
  const metrics = buildMetrics(capabilities, findings, inputs.catalog.length);
  const queue = buildTraceQueue(capabilities, findings);
  const reconciliation = buildReconciliation(capabilities);
  const findingsDocument = {
    schemaVersion: "1.0.0",
    project: inputs.config.project,
    phase: inputs.config.phase,
    auditedSourceSha: inputs.config.auditedSourceSha,
    findings,
  };
  const queueDocument = {
    schemaVersion: "1.0.0",
    project: inputs.config.project,
    sourceSha: inputs.config.auditedSourceSha,
    priorityPolicy:
      "Security/privacy/authorization, severity, broken/frontend-only/backend-only/hidden/partial class, then stable queue ID",
    queue,
  };
  const reconciliationDocument = {
    schemaVersion: "1.0.0",
    sourceSha: inputs.config.auditedSourceSha,
    catalogEntryCount: inputs.catalog.length,
    mappedEntryCount: reconciliation.length,
    entries: reconciliation,
  };
  const evidenceIndex = {
    schemaVersion: "1.0.0",
    sourceSha: inputs.config.auditedSourceSha,
    privacyBoundary:
      "Sanitized repository paths and governed IDs only; no private content, credentials, tokens, cookies, or personal data.",
    evidence: capabilities
      .flatMap((capability) => capability.evidence.references)
      .sort((left, right) => left.evidenceId.localeCompare(right.evidenceId)),
  };
  const status = {
    schemaVersion: "1.0.0",
    project: inputs.config.project,
    phase: inputs.config.phase,
    state: inputs.config.phaseState ?? "IMPLEMENTED_PENDING_VALIDATION",
    activation: "ACTIVE_GOVERNANCE_AUDIT_TOOLING",
    branch: inputs.config.branch,
    worktree: inputs.config.worktree,
    baseSourceSha: inputs.config.baseSourceSha,
    auditedSourceSha: inputs.config.auditedSourceSha,
    finalReconciledMainSha: inputs.config.finalReconciledMainSha ?? inputs.config.auditedSourceSha,
    mainlineState: inputs.config.mainlineState ?? "NOT_INTEGRATED",
    schemaImpact: "NONE",
    productSourceImpact: "NONE",
    featureCatalogImpact: "NO_CHANGE_REQUIRED",
    metrics,
    validation: inputs.config.validationState ?? "PENDING",
    reconciliation: inputs.config.reconciliationState ?? "BASELINE_FETCHED",
    limitations: [
      "Initial traces are Phase 1 skeletons, not complete Phase 2 traces.",
      "Homeport evidence retains its local, synthetic, staging, provider, deployment, and owner-decision boundaries.",
      "Phase 2 must begin from accepted main only after Phase 1 convergence.",
    ],
  };
  const reports = {
    audit: buildAuditReport(inputs, ledger, findings, metrics, queue, reconciliation),
    summary: buildCapabilitySummary(ledger, metrics, findings, queue),
  };
  return { inputs, ledger, findingsDocument, queueDocument, reconciliationDocument, evidenceIndex, status, reports };
}

function duplicateValues(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) (seen.has(value) ? duplicates : seen).add(value);
  return [...duplicates].sort();
}

function schemaTypeMatches(value, type) {
  if (type === "null") return value === null;
  if (type === "array") return Array.isArray(value);
  if (type === "object") return value !== null && typeof value === "object" && !Array.isArray(value);
  if (type === "integer") return Number.isInteger(value);
  return typeof value === type;
}

function resolveSchemaReference(rootSchema, reference) {
  if (!reference.startsWith("#/") || reference.includes("~"))
    throw new Error(`UNSUPPORTED_SCHEMA_REFERENCE:${reference}`);
  return reference
    .slice(2)
    .split("/")
    .reduce((value, key) => value?.[key], rootSchema);
}

export function validateAgainstLedgerSchema(value, rootSchema) {
  const errors = [];
  const visit = (candidate, schema, location) => {
    if (schema.$ref) {
      const resolved = resolveSchemaReference(rootSchema, schema.$ref);
      if (!resolved) errors.push(`${location}: unresolved schema reference ${schema.$ref}`);
      else visit(candidate, resolved, location);
      return;
    }
    if (Object.hasOwn(schema, "const") && !Object.is(candidate, schema.const))
      errors.push(`${location}: expected constant ${JSON.stringify(schema.const)}`);
    if (schema.enum && !schema.enum.some((item) => Object.is(item, candidate)))
      errors.push(`${location}: value is outside schema enum`);
    if (schema.type) {
      const types = Array.isArray(schema.type) ? schema.type : [schema.type];
      if (!types.some((type) => schemaTypeMatches(candidate, type))) {
        errors.push(`${location}: expected schema type ${types.join("|")}`);
        return;
      }
    }
    if (typeof candidate === "string") {
      if (schema.minLength !== undefined && candidate.length < schema.minLength)
        errors.push(`${location}: shorter than schema minLength`);
      if (schema.pattern && !new RegExp(schema.pattern, "u").test(candidate))
        errors.push(`${location}: does not match schema pattern`);
    }
    if (typeof candidate === "number" && schema.minimum !== undefined && candidate < schema.minimum)
      errors.push(`${location}: below schema minimum`);
    if (Array.isArray(candidate)) {
      if (schema.minItems !== undefined && candidate.length < schema.minItems)
        errors.push(`${location}: fewer than schema minItems`);
      if (schema.uniqueItems) {
        const serialized = candidate.map((item) => JSON.stringify(canonicalize(item)));
        if (new Set(serialized).size !== serialized.length) errors.push(`${location}: schema uniqueItems violated`);
      }
      if (schema.items) candidate.forEach((item, index) => visit(item, schema.items, `${location}[${index}]`));
    }
    if (candidate !== null && typeof candidate === "object" && !Array.isArray(candidate)) {
      for (const key of schema.required ?? [])
        if (!Object.hasOwn(candidate, key)) errors.push(`${location}: missing schema property ${key}`);
      if (schema.additionalProperties === false)
        for (const key of Object.keys(candidate))
          if (!Object.hasOwn(schema.properties ?? {}, key))
            errors.push(`${location}: unexpected schema property ${key}`);
      for (const [key, propertySchema] of Object.entries(schema.properties ?? {}))
        if (Object.hasOwn(candidate, key)) visit(candidate[key], propertySchema, `${location}.${key}`);
    }
  };
  visit(value, rootSchema, "$ledger");
  return errors;
}

export function validateModel({
  ledger,
  findingsDocument,
  queueDocument,
  reconciliationDocument,
  evidenceIndex,
  inputs,
}) {
  const errors = validateAgainstLedgerSchema(ledger, inputs.ledgerSchema).map((error) => `schema: ${error}`);
  const { config, ownership, catalog } = inputs;
  const vocab = config.closedVocabularies;
  const ownerNames = new Set(ownership.projects.map((project) => project.project));
  const catalogIds = new Set(catalog.map((entry) => entry.id));
  const capabilityIds = ledger.capabilities.map((capability) => capability.capabilityId);
  const duplicateCapabilityIds = duplicateValues(capabilityIds);
  if (duplicateCapabilityIds.length) errors.push(`duplicate capability IDs: ${duplicateCapabilityIds.join(", ")}`);
  if (
    stableStringify(ledger.capabilities.map((capability) => capability.capabilityId)) !==
    stableStringify([...capabilityIds].sort())
  )
    errors.push("capabilities are not sorted by stable ID");
  const findingIds = findingsDocument.findings.map((finding) => finding.findingId);
  const duplicateFindingIds = duplicateValues(findingIds);
  if (duplicateFindingIds.length) errors.push(`duplicate finding IDs: ${duplicateFindingIds.join(", ")}`);
  const findingIdSet = new Set(findingIds);
  const capabilityIdSet = new Set(capabilityIds);
  for (const capability of ledger.capabilities) {
    if (!/^DW-CAP-[A-Z0-9]+(?:-[A-Z0-9]+)*$/u.test(capability.capabilityId ?? ""))
      errors.push(`invalid capability ID: ${capability.capabilityId}`);
    if (!capability.owner?.project) errors.push(`${capability.capabilityId}: missing owner`);
    else if (
      !ownerNames.has(capability.owner.project) &&
      !capability.currentRealization?.secondaryFlags?.includes("OWNERSHIP_AMBIGUOUS")
    )
      errors.push(`${capability.capabilityId}: unknown owner ${capability.owner.project}`);
    const ownerContract = ownership.projects.find((project) => project.project === capability.owner?.project)?.contract;
    if (ownerContract && capability.owner.contract !== ownerContract)
      errors.push(`${capability.capabilityId}: ownership-map contract mismatch`);
    if (!vocab.rungs.includes(capability.expectedRealization?.terminalRung))
      errors.push(`${capability.capabilityId}: missing or invalid terminal rung`);
    if (!vocab.rungs.includes(capability.currentRealization?.highestRung))
      errors.push(`${capability.capabilityId}: invalid current rung`);
    if (!vocab.classifications.includes(capability.currentRealization?.classification))
      errors.push(`${capability.capabilityId}: invalid classification`);
    for (const flag of capability.currentRealization?.secondaryFlags ?? [])
      if (!vocab.secondaryFlags.includes(flag))
        errors.push(`${capability.capabilityId}: invalid secondary flag ${flag}`);
    if (!vocab.dispositions.includes(capability.expectedRealization?.disposition))
      errors.push(`${capability.capabilityId}: invalid disposition`);
    if (!vocab.confidence.includes(capability.currentRealization?.confidence))
      errors.push(`${capability.capabilityId}: invalid confidence`);
    for (const traceLayer of [
      "domain",
      "service",
      "transport",
      "authorization",
      "projection",
      "client",
      "ui",
      "navigation",
      "accessibility",
      "journey",
    ])
      if (!vocab.traceStatus.includes(capability.trace?.[traceLayer]?.status))
        errors.push(`${capability.capabilityId}: invalid trace status for ${traceLayer}`);
    if (capability.catalogMapping && !catalogIds.has(capability.catalogMapping.featureCatalogId))
      errors.push(
        `${capability.capabilityId}: unknown Feature Catalog reference ${capability.catalogMapping.featureCatalogId}`,
      );
    if (
      ["INTERNAL_BY_DESIGN", "SECURITY_RESTRICTED"].includes(capability.currentRealization?.classification) &&
      !capability.expectedRealization?.rationale
    )
      errors.push(`${capability.capabilityId}: internal/restricted capability lacks rationale`);
    if (
      capability.currentRealization?.classification === "SECURITY_RESTRICTED" &&
      capability.audience?.roles?.length === 0
    )
      errors.push(`${capability.capabilityId}: restricted capability lacks approved audience`);
    if (capability.currentRealization?.classification === "FULLY_REALIZED") {
      if (rungRank[capability.currentRealization.highestRung] < rungRank[capability.expectedRealization.terminalRung])
        errors.push(`${capability.capabilityId}: FULLY_REALIZED below terminal rung`);
      if (
        capability.expectedRealization.disposition === "USER_FACING" &&
        (capability.trace.navigation.status !== "VERIFIED" || capability.evidence.journeyIds.length === 0)
      )
        errors.push(`${capability.capabilityId}: user-facing FULLY_REALIZED lacks navigation/journey evidence`);
      const hasBlockingFinding = capability.gaps.findingIds.some((findingId) => {
        const finding = findingsDocument.findings.find((candidate) => candidate.findingId === findingId);
        return finding && finding.status !== "CLOSED" && ["CRITICAL", "HIGH"].includes(finding.severity);
      });
      if (hasBlockingFinding) errors.push(`${capability.capabilityId}: FULLY_REALIZED has open blocking finding`);
    }
    for (const findingId of capability.gaps?.findingIds ?? [])
      if (!findingIdSet.has(findingId))
        errors.push(`${capability.capabilityId}: unknown finding reference ${findingId}`);
    if (!/^[0-9a-f]{40}$/u.test(capability.evidence?.sourceSha ?? ""))
      errors.push(`${capability.capabilityId}: missing source SHA`);
  }
  const mappedCatalogIds = ledger.capabilities
    .map((capability) => capability.catalogMapping?.featureCatalogId)
    .filter(Boolean);
  for (const catalogId of catalogIds)
    if (!mappedCatalogIds.includes(catalogId)) errors.push(`Feature Catalog entry not mapped: ${catalogId}`);
  for (const finding of findingsDocument.findings) {
    if (!capabilityIdSet.has(finding.capabilityId))
      errors.push(`${finding.findingId}: invalid capability reference ${finding.capabilityId}`);
    if (!vocab.severity.includes(finding.severity)) errors.push(`${finding.findingId}: invalid severity`);
    if (!vocab.findingStatus.includes(finding.status)) errors.push(`${finding.findingId}: invalid status`);
    if (finding.status === "CLOSED" && (!finding.closedAt || !finding.closureEvidence))
      errors.push(`${finding.findingId}: closed finding lacks closure evidence`);
    if (finding.status === "DEBT_ACCEPTED") {
      const debt = finding.debt;
      if (!debt?.owner || !debt?.reason || (!debt?.expiry && !debt?.trigger))
        errors.push(`${finding.findingId}: debt record lacks owner/reason/expiry or trigger`);
    }
  }
  const queueCapabilityIds = queueDocument.queue.map((item) => item.capabilityId);
  for (const capabilityId of queueCapabilityIds)
    if (!capabilityIdSet.has(capabilityId)) errors.push(`Phase 2 queue references unknown capability ${capabilityId}`);
  if (reconciliationDocument.mappedEntryCount !== catalogIds.size)
    errors.push("Feature Catalog reconciliation does not cover every entry");
  if (evidenceIndex.evidence.some((entry) => !/^DW-EV-/u.test(entry.evidenceId)))
    errors.push("evidence index contains invalid evidence ID");
  const privacyText = stableStringify({
    ledger,
    findingsDocument,
    queueDocument,
    reconciliationDocument,
    evidenceIndex,
  });
  for (const pattern of config.privacy.forbiddenPatterns) {
    const expression = pattern.startsWith("(?i)") ? new RegExp(pattern.slice(4), "iu") : new RegExp(pattern, "u");
    if (expression.test(privacyText)) errors.push(`privacy scan matched forbidden pattern ${pattern}`);
  }
  return errors;
}

export async function validateEvidencePaths(root, artifacts) {
  const errors = [];
  for (const reference of artifacts.evidenceIndex.evidence) {
    if (!["SOURCE_PATH", "TEST", "COMPLETION_RECORD"].includes(reference.kind)) continue;
    const rawPath = reference.reference.split("#", 1)[0];
    if (!rawPath || /^[0-9a-f]{40}$/u.test(rawPath)) continue;
    try {
      await access(path.join(root, rawPath));
    } catch {
      errors.push(`missing evidence path: ${rawPath}`);
    }
  }
  return uniqueSorted(errors);
}

async function formatArtifact(root, relative, content) {
  const parser = relative.endsWith(".json") ? "json" : "markdown";
  const config = (await resolveConfig(path.join(root, relative))) ?? {};
  return format(content, { ...config, parser });
}

export async function artifactFiles(root, artifacts) {
  const rawFiles = new Map([
    [`${DEEPWATER_ROOT}/capability-realization-ledger.json`, stableStringify(artifacts.ledger)],
    [`${DEEPWATER_ROOT}/deepwater-findings.json`, stableStringify(artifacts.findingsDocument)],
    [`${DEEPWATER_ROOT}/deepwater-phase-status.json`, stableStringify(artifacts.status)],
    [
      `${DEEPWATER_ROOT}/evidence/Project_Deepwater_Phase_1_Evidence_Index.json`,
      stableStringify(artifacts.evidenceIndex),
    ],
    [
      `${DEEPWATER_ROOT}/reports/Project_Deepwater_Phase_1_Feature_Catalog_Reconciliation.json`,
      stableStringify(artifacts.reconciliationDocument),
    ],
    [`${DEEPWATER_ROOT}/reports/Project_Deepwater_Phase_2_Trace_Queue.json`, stableStringify(artifacts.queueDocument)],
    [`${DEEPWATER_ROOT}/reports/Project_Deepwater_Phase_1_Audit_Report.md`, artifacts.reports.audit],
    [`${DEEPWATER_ROOT}/reports/Project_Deepwater_Phase_1_Capability_Summary.md`, artifacts.reports.summary],
  ]);
  return new Map(
    await Promise.all(
      [...rawFiles].map(async ([relative, content]) => [relative, await formatArtifact(root, relative, content)]),
    ),
  );
}

export async function writeArtifacts(root, artifacts) {
  for (const [relative, content] of await artifactFiles(root, artifacts)) {
    const target = path.join(root, relative);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content, "utf8");
  }
}

export async function compareArtifacts(root, artifacts) {
  const errors = [];
  for (const [relative, expected] of await artifactFiles(root, artifacts)) {
    let actual;
    try {
      actual = await readFile(path.join(root, relative), "utf8");
    } catch {
      errors.push(`missing generated artifact: ${relative}`);
      continue;
    }
    if (actual !== expected) errors.push(`stale generated artifact: ${relative}`);
  }
  return errors;
}

export function semanticDigest(artifacts) {
  return sha256(
    stableStringify({
      ledger: artifacts.ledger,
      findings: artifacts.findingsDocument,
      queue: artifacts.queueDocument,
      reconciliation: artifacts.reconciliationDocument,
      evidence: artifacts.evidenceIndex,
    }),
  );
}

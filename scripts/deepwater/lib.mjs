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

async function buildPhase1Artifacts(root) {
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

const phase2LayerNames = [
  "domain",
  "service",
  "transport",
  "authorization",
  "projection",
  "client",
  "ui",
  "navigation",
  "state",
  "accessibility",
  "journey",
];

function referencesFromCapability(capability) {
  return capability.evidence.references
    .filter((reference) => ["SOURCE_PATH", "TEST", "COMPLETION_RECORD"].includes(reference.kind))
    .map((reference) => reference.reference.split("#", 1)[0]);
}

function referenceKind(reference) {
  if (/^tests\//u.test(reference) || /\.test\.[cm]?[jt]sx?$/u.test(reference)) return "TEST";
  if (/^Development_Docs\//u.test(reference)) return "COMPLETION_RECORD";
  if (reference.startsWith("route-")) return "ROUTE_INVENTORY";
  if (reference.startsWith("screen-")) return "SCREEN_CATALOG";
  if (/^(?:HP-|DW-).*-JRN-/u.test(reference)) return "JOURNEY_CATALOG";
  return "SOURCE_PATH";
}

async function symbolsForReferences(root, references) {
  const symbols = [];
  for (const reference of references.filter((value) => /\.[cm]?[jt]sx?$/u.test(value))) {
    let source;
    try {
      source = await readFile(path.join(root, reference), "utf8");
    } catch {
      continue;
    }
    const patterns = [
      /export\s+(?:default\s+)?(?:async\s+)?function\s+([A-Za-z0-9_]+)/gu,
      /export\s+(?:default\s+)?class\s+([A-Za-z0-9_]+)/gu,
      /export\s+const\s+([A-Za-z0-9_]+)/gu,
      /export\s+(?:type|interface)\s+([A-Za-z0-9_]+)/gu,
    ];
    for (const expression of patterns)
      for (const match of source.matchAll(expression)) symbols.push(`${reference}#${match[1]}`);
  }
  return uniqueSorted(symbols).slice(0, 40);
}

function routeContext(policy, inputs) {
  const routeByPattern = new Map(inputs.routes.routes.map((route) => [route.routePattern, route]));
  const routes = uniqueSorted(policy.canonicalRoutes ?? [])
    .map((pattern) => routeByPattern.get(pattern))
    .filter(Boolean);
  const routeIds = new Set(routes.map((route) => route.routeId));
  const screens = inputs.screens.screens.filter((screen) => screen.routeIds.some((routeId) => routeIds.has(routeId)));
  return {
    routes,
    screens,
    routeIds: routes.map((route) => route.routeId),
    screenIds: screens.map((screen) => screen.screenId),
    journeyIds: uniqueSorted([
      ...routes.flatMap((route) => route.currentJourneys ?? []),
      ...screens.flatMap((screen) => screen.journeyIds ?? []),
    ]),
    screenshotIds: uniqueSorted(screens.flatMap((screen) => screen.screenshotIds ?? [])),
    implementations: uniqueSorted(routes.map((route) => route.implementationSource).filter(Boolean)),
    entries: uniqueSorted(routes.flatMap((route) => (route.currentVisibleEntries ?? []).map((entry) => entry.entryId))),
    states: uniqueSorted([
      ...routes.flatMap((route) => route.currentSupportedStates ?? []),
      ...screens.flatMap((screen) => screen.applicableStates ?? []),
    ]),
    accessibilityContracts: uniqueSorted(screens.map((screen) => screen.acceptanceContract).filter(Boolean)),
  };
}

function layerReferenceCandidates(layerName, allReferences, policy, context, capability) {
  const source = uniqueSorted([...allReferences, ...context.implementations]);
  const tests = uniqueSorted(policy.testReferences ?? []);
  const records = uniqueSorted(policy.recordReferences ?? []);
  const matching = (expression) => source.filter((reference) => expression.test(reference));
  const byLayer = {
    domain: uniqueSorted([
      ...capability.trace.domain.references,
      ...matching(/^(?:prisma\/|src\/(?:domain|chronicle|community|wayfarer|private-content|platform|navigation)\/)/u),
    ]),
    service: uniqueSorted([
      ...capability.trace.service.references,
      ...matching(/^src\/(?!app\/|components\/)/u),
      ...matching(/^scripts\//u),
    ]),
    transport: uniqueSorted([
      ...capability.trace.transport.references,
      ...matching(/^src\/app\/(?:api\/|.*\/route\.)/u),
      ...context.routes
        .filter((route) => route.routePattern.startsWith("/api/"))
        .map((route) => route.implementationSource),
    ]),
    authorization: uniqueSorted([
      ...capability.trace.authorization.references,
      ...matching(/auth|security|policy|session|http|moderation|operations\/route/iu),
    ]),
    projection: uniqueSorted([
      ...capability.trace.projection.references,
      ...matching(/projection|dto|profile|artifact|history|operations|snapshot|journal-contract/iu),
    ]),
    client: uniqueSorted([...capability.trace.client.references, ...matching(/^src\/components\//u)]),
    ui: uniqueSorted([
      ...capability.trace.ui.references,
      ...matching(/^src\/(?:app\/.*\/page|components\/)/u),
      ...context.implementations.filter((reference) => /\/page\.[jt]sx$/u.test(reference)),
    ]),
    navigation: uniqueSorted([...(policy.canonicalRoutes ?? []), ...context.routeIds, ...context.entries]),
    state: uniqueSorted([...source, ...tests]).slice(0, 30),
    accessibility: uniqueSorted([...context.accessibilityContracts, ...tests, ...records]),
    journey: uniqueSorted([...context.journeyIds, ...tests, ...records]),
  };
  const selected = byLayer[layerName] ?? [];
  if (selected.length) return selected.slice(0, 40);
  return uniqueSorted([...tests, ...source, ...records]).slice(0, 12);
}

function layerContracts(layerName, capability, policy, context) {
  const routes = uniqueSorted(policy.canonicalRoutes ?? []);
  const inputs = routes.length
    ? `Governed inputs accepted through ${routes.join(", ")} and the bound source symbols.`
    : `Governed ${capability.name} inputs accepted by the bound source symbols.`;
  const output =
    layerName === "projection"
      ? `The smallest ${capability.audience.privacyClass} projection required by ${capability.audience.roles.join(", ")}.`
      : layerName === "navigation"
        ? `Visible or contextual entry to ${routes.join(", ") || capability.expectedRealization.requiredSurfaces.join(", ")}.`
        : `The ${capability.name} contract forwarded without inventing a second authority.`;
  return { inputs, output };
}

async function buildDetailedTrace(root, capability, policy, phase1Queue, inputs, openFindingIds) {
  const profile = inputs.phase2Config.profiles[policy.profile];
  if (!profile) throw new Error(`MISSING_PHASE2_PROFILE:${policy.profile}`);
  const context = routeContext(policy, inputs);
  const queueIds = uniqueSorted(
    phase1Queue.queue.filter((item) => item.capabilityId === capability.capabilityId).map((item) => item.queueId),
  );
  const allReferences = uniqueSorted([
    ...referencesFromCapability(capability),
    ...(policy.sourceReferences ?? []),
    ...(policy.testReferences ?? []),
    ...(policy.recordReferences ?? []),
    ...context.implementations,
  ]);
  const symbols = await symbolsForReferences(root, allReferences);
  const traceFindingIds = uniqueSorted(capability.gaps.findingIds);
  const linkedOpen = traceFindingIds.filter((findingId) => openFindingIds.has(findingId));
  const requiredStates = uniqueSorted(capability.states.required);
  const full = policy.classification === "FULLY_REALIZED";
  const representedStates = full
    ? uniqueSorted([...capability.states.represented, ...requiredStates, ...context.states])
    : uniqueSorted([...capability.states.represented, ...context.states]);
  const missingStates = full ? [] : uniqueSorted(capability.states.missing);
  const layers = {};
  for (const layerName of phase2LayerNames) {
    const status = profile[layerName];
    const applicable = status !== "NOT_APPLICABLE";
    const references = applicable
      ? layerReferenceCandidates(layerName, allReferences, policy, context, capability)
      : [];
    const layerSymbols = symbols.filter((symbol) => references.some((reference) => symbol.startsWith(`${reference}#`)));
    const contracts = layerContracts(layerName, capability, policy, context);
    const linkedFindingIds = ["PARTIAL", "ABSENT", "UNKNOWN"].includes(status) ? linkedOpen : [];
    const conclusion =
      status === "VERIFIED"
        ? `${capability.name}: current accepted source or source-bound evidence verifies the applicable ${layerName} contract.`
        : status === "NOT_APPLICABLE"
          ? `${layerName} is intentionally outside the ${capability.expectedRealization.disposition} contract ending at ${capability.expectedRealization.terminalRung}.`
          : `${capability.name}: ${policy.rootCause}`;
    layers[layerName] = {
      applicability: applicable
        ? `Applicable to ${capability.expectedRealization.disposition} realization.`
        : `Intentionally not applicable at ${capability.expectedRealization.terminalRung}.`,
      status,
      references,
      symbols: uniqueSorted(layerSymbols),
      callDirection:
        layerName === "domain"
          ? "Canonical state to owned service operation."
          : layerName === "service"
            ? "Owned service operation to authorized transport or internal consumer."
            : layerName === "transport"
              ? "Authorized request or action to owned service operation and typed response."
              : layerName === "authorization"
                ? "Authenticated principal and resource context to allow, deny, or recovery outcome."
                : layerName === "projection"
                  ? "Canonical truth to audience-safe output shape."
                  : layerName === "client"
                    ? "Audience-safe response to client state and invalidation behavior."
                    : layerName === "ui"
                      ? "Client state to visible controls, feedback, and recovery."
                      : layerName === "navigation"
                        ? "Natural product entry to canonical or contextual surface and return path."
                        : layerName === "state"
                          ? "Canonical lifecycle states to represented audience states and recovery."
                          : layerName === "accessibility"
                            ? "Visible interaction to keyboard, focus, touch, zoom, announcement, and motion contracts."
                            : "Natural starting point through the capability-specific observable outcome.",
      inputContract: contracts.inputs,
      outputContract: contracts.output,
      authorizationRequirement: capability.audience.privilegeRequirements.length
        ? capability.audience.privilegeRequirements.join(", ")
        : "No additional privilege beyond the declared audience.",
      projectionBoundary: `Privacy class ${capability.audience.privacyClass}; useful safe truth is retained and secret or private implementation data is excluded.`,
      stateBehavior: `Required: ${requiredStates.join(", ") || "none"}; represented: ${representedStates.join(", ") || "none"}; missing: ${missingStates.join(", ") || "none"}.`,
      evidenceKinds: uniqueSorted(
        references.map(referenceKind).length ? references.map(referenceKind) : ["GOVERNING_ANALYSIS"],
      ),
      sourceSha: inputs.phase2Config.auditedSourceSha,
      freshness: "CURRENT",
      conclusion,
      linkedFindingIds,
      uncertainty: null,
    };
  }
  const packetIds = linkedOpen.map((findingId) => `DW-REMED-${findingId.slice("DW-FIND-".length)}`);
  return {
    traceId: `DW-TRACE-${capability.capabilityId.slice("DW-CAP-".length)}`,
    queueIds,
    queueDisposition: "COMPLETED",
    queueDispositionReason:
      "The accepted Phase 1 queue item was reconciled to current main and every applicable trace layer has a source-bound conclusion.",
    identity: {
      capabilityId: capability.capabilityId,
      name: capability.name,
      catalogMapping: capability.catalogMapping,
      sourceSha: inputs.phase2Config.auditedSourceSha,
    },
    ownership: {
      canonicalOwner: capability.owner.project,
      contributingOwners: capability.owner.contributingProjects,
      ownerContract: capability.owner.contract,
    },
    audience: capability.audience,
    expectedRealization: capability.expectedRealization,
    architectureProfile: policy.profile,
    layers,
    stateModel: {
      canonicalStates: requiredStates,
      representedStates,
      missingStates,
      feedbackRecovery: full
        ? "Current source-bound tests cover success, failure, denial, empty or unavailable state, and recovery applicable to the capability."
        : policy.rootCause,
      conclusion: missingStates.length
        ? `${missingStates.join(", ")} remain unrepresented because ${policy.rootCause}`
        : "Every canonical state required by the declared terminal contract is represented or intentionally not applicable.",
    },
    quality: {
      accessibility: profile.accessibility,
      responsive: ["FULL_STACK", "AGGREGATE_PRODUCT", "OWNER_ACCEPTANCE_GAP"].includes(policy.profile)
        ? "VERIFIED"
        : "NOT_APPLICABLE",
      reducedMotionRelevance:
        capability.expectedRealization.disposition === "USER_FACING"
          ? "Required and bound to current test or screen evidence."
          : "No motion is required by the declared operational projection.",
      visualMaturity: capability.expectedRealization.disposition === "USER_FACING" ? profile.ui : "NOT_APPLICABLE",
      conclusion: full
        ? "Current accepted evidence reaches the quality obligations required by the declared terminal rung."
        : policy.rootCause,
    },
    evidence: {
      sourcePaths: uniqueSorted(allReferences.filter((reference) => !/^tests\//u.test(reference))),
      tests: uniqueSorted(policy.testReferences ?? []),
      routeIds: uniqueSorted(context.routeIds),
      screenIds: uniqueSorted(context.screenIds),
      journeyIds: uniqueSorted([...context.journeyIds, ...capability.evidence.journeyIds]),
      screenshotIds: uniqueSorted([...context.screenshotIds, ...capability.evidence.screenshotIds]),
      ownerDecision: policy.ownerAcceptance ?? capability.evidence.ownerAcceptance,
      freshness: "CURRENT",
      sourceSha: inputs.phase2Config.auditedSourceSha,
    },
    analysis: {
      currentHighestRung: policy.currentHighestRung,
      classification: policy.classification,
      secondaryFlags: uniqueSorted(
        capability.currentRealization.secondaryFlags.filter(
          (flag) =>
            !["UNVERIFIED", "JOURNEY_UNPROVEN", "STALE_EVIDENCE"].includes(flag) ||
            (policy.profile === "EXTERNAL_PROVIDER_GAP" && flag === "JOURNEY_UNPROVEN"),
        ),
      ),
      firstLossPoint: policy.firstLossPoint ?? null,
      rootCause:
        policy.rootCause ??
        "No product realization loss was found. Phase 1's conservative classification was caused by an incomplete evidence census; current accepted source and bound tests reach the declared terminal rung.",
      findingIds: traceFindingIds,
      remediationPacketIds: uniqueSorted(packetIds),
    },
  };
}

function phase2CatalogReconciliation(phase1, phase2Config) {
  const byId = new Map(phase2Config.catalogReconciliations.map((entry) => [entry.featureCatalogId, entry]));
  return {
    schemaVersion: "1.0.0",
    project: phase2Config.project,
    phase: phase2Config.phase,
    sourceSha: phase2Config.auditedSourceSha,
    entries: phase1.reconciliationDocument.entries
      .filter((entry) => byId.has(entry.featureCatalogId))
      .map((entry) => {
        const outcome = byId.get(entry.featureCatalogId);
        const capability = phase1.ledger.capabilities.find(
          (candidate) => candidate.capabilityId === entry.capabilityId,
        );
        return {
          featureCatalogId: entry.featureCatalogId,
          capabilityId: entry.capabilityId,
          catalogFragment: capability.evidence.references
            .find((reference) => reference.kind === "FEATURE_CATALOG")
            ?.reference.split("#", 1)[0],
          declaredSurfaces: entry.declaredSurfaces,
          outcome: outcome.outcome,
          canonicalRoutes: uniqueSorted(outcome.canonicalRoutes),
          productDefect: ["ACTUAL_NAVIGATION_GAP", "ACTUAL_MISSING_SURFACE"].includes(outcome.outcome),
          canonicalOwner: capability.owner.project,
          contributingOwner: "Ledgerlight",
          requiredValidation: ["npm run features:sync", "npm run features:validate", "npm run docs:validate"],
          findingId: `DW-FIND-CATALOG-SURFACE-${entry.featureCatalogId}`,
        };
      })
      .sort((left, right) => left.featureCatalogId.localeCompare(right.featureCatalogId)),
  };
}

function refineFindings(phase1, phase2Config, catalogReconciliation) {
  const refinements = new Map(phase2Config.findingRefinements.map((item) => [item.findingId, item]));
  const catalogByFinding = new Map(catalogReconciliation.entries.map((entry) => [entry.findingId, entry]));
  return phase1.findingsDocument.findings.map((finding) => {
    const refinement = refinements.get(finding.findingId) ?? {};
    const catalog = catalogByFinding.get(finding.findingId);
    const rootCause = catalog
      ? `The accepted product uses ${catalog.canonicalRoutes.join(", ")}, while ${catalog.catalogFragment} still declares ${catalog.declaredSurfaces.join(", ")}. The ${catalog.outcome} result is documentation metadata loss, not a missing accepted product implementation.`
      : (refinement.rootCause ?? finding.currentBehavior);
    return {
      ...finding,
      observedSourceSha: phase2Config.auditedSourceSha,
      evidence: uniqueSorted([
        ...finding.evidence,
        ...(catalog?.canonicalRoutes ?? []),
        ...(catalog ? [catalog.catalogFragment] : []),
      ]),
      currentBehavior: catalog
        ? `${catalog.catalogFragment} does not name the accepted canonical route identity ${catalog.canonicalRoutes.join(", ")}.`
        : finding.currentBehavior,
      firstLossPoint: catalog ? "DOCUMENTATION" : (refinement.firstLossPoint ?? finding.firstLossPoint),
      rootCause,
      canonicalOwner: refinement.canonicalOwner ?? finding.canonicalOwner,
      contributingOwners: uniqueSorted(refinement.contributingOwners ?? finding.contributingOwners),
      assignedProjectPhase: refinement.assignedProjectPhase ?? finding.assignedProjectPhase,
      closureEvidence: refinement.closureEvidence ?? finding.closureEvidence,
      status: refinement.status ?? finding.status,
      closedAt: refinement.closedAt ?? finding.closedAt,
      catalogOutcome: catalog?.outcome ?? null,
    };
  });
}

function buildRemediationPackages(ledger, findings, phase2Config, catalogReconciliation) {
  const catalogByFinding = new Map(catalogReconciliation.entries.map((entry) => [entry.findingId, entry]));
  const tracePolicyByCapability = new Map(phase2Config.tracePolicies.map((policy) => [policy.capabilityId, policy]));
  const coordination = phase2Config.coordination;
  const packages = findings
    .filter((finding) => finding.status !== "CLOSED")
    .map((finding) => {
      const capability = ledger.capabilities.find((candidate) => candidate.capabilityId === finding.capabilityId);
      const policy = tracePolicyByCapability.get(capability.capabilityId);
      const catalog = catalogByFinding.get(finding.findingId);
      const active = coordination.find(
        (entry) =>
          entry.capabilityIds.includes(capability.capabilityId) || entry.findingIds.includes(finding.findingId),
      );
      const ownerDiffers = finding.canonicalOwner !== capability.owner.project;
      return {
        remediationPacketId: `DW-REMED-${finding.findingId.slice("DW-FIND-".length)}`,
        findingIds: [finding.findingId],
        capabilityId: capability.capabilityId,
        canonicalOwner: finding.canonicalOwner,
        contributingOwners: uniqueSorted(finding.contributingOwners),
        multiOwnerRationale: ownerDiffers
          ? `${capability.owner.project} owns the framework capability; ${finding.canonicalOwner} owns the missing realization named by this finding.`
          : null,
        recommendedProjectPhase: finding.assignedProjectPhase,
        currentClassification: capability.currentRealization.classification,
        expectedTerminalRung: capability.expectedRealization.terminalRung,
        currentHighestRung: capability.currentRealization.highestRung,
        firstLossPoint: finding.firstLossPoint,
        rootCause: finding.rootCause,
        currentBehavior: finding.currentBehavior,
        requiredBehavior: finding.expectedBehavior,
        affectedContracts: uniqueSorted([
          capability.owner.contract,
          ...finding.gapFamilies,
          ...(catalog ? [`Feature Catalog ${catalog.featureCatalogId}`] : []),
        ]),
        affectedRoutesSurfaces: uniqueSorted([
          ...capability.expectedRealization.requiredSurfaces,
          ...(policy?.canonicalRoutes ?? []),
          ...(catalog?.canonicalRoutes ?? []),
        ]),
        authorizationPrivacyConstraints: uniqueSorted([
          `Audience roles: ${capability.audience.roles.join(", ")}`,
          `Privacy class: ${capability.audience.privacyClass}`,
          `Privileges: ${capability.audience.privilegeRequirements.join(", ") || "none beyond audience"}`,
          "Do not expose credentials, tokens, private content, raw object identifiers, or provider secrets.",
        ]),
        requiredStates: uniqueSorted(capability.states.required),
        accessibilityImplications:
          capability.expectedRealization.disposition === "USER_FACING"
            ? "Any changed user-facing control or state requires keyboard, focus, touch, zoom, announcement, non-color, and reduced-motion evidence applicable to the surface."
            : "If an operator UI consumes this contract, it must expose named controls, atomic status, keyboard/focus behavior, and non-secret recovery guidance.",
        hardDependencies: uniqueSorted([finding.mainlineDependency, active?.hardDependency].filter(Boolean)),
        softDependencies: uniqueSorted(finding.contributingOwners),
        concurrencyClass: active
          ? `BLOCKED_BY_ACTIVE_OWNER: ${active.activeOwnerPhase}; ${active.allowedDeepwaterAction}`
          : "OWNER_PROJECT_WORK on a fresh accepted-main branch; coordinate before overlapping source changes.",
        mainlineSafetyExpectations: [
          "Preserve canonical domain ownership and authorization boundaries.",
          "No unrelated Prisma schema or business migration change.",
          "Keep the remediation independently mainline-safe and source-bound.",
        ],
        suggestedIntegrationPattern: catalog
          ? `Update the owning catalog fragment to ${catalog.canonicalRoutes.join(", ")} with ${catalog.canonicalOwner} and Ledgerlight review, then regenerate and validate the catalog.`
          : finding.firstLossPoint === "OWNER_ACCEPTANCE"
            ? "Run the governing owner re-review against the accepted version and update only the owner-decision authority with the actual decision."
            : finding.firstLossPoint === "EXTERNAL_PROVIDER"
              ? "Implement a provider adapter behind the accepted versioned verification envelope; retain One Voyage authorization, idempotency, Captain override, and audit contracts."
              : "Define an owner-approved sanitized read projection first, then add the privileged consumer without duplicating service or domain truth.",
        prohibitedImplementationShortcuts: [
          "Do not duplicate canonical business state in UI or route code.",
          "Do not broaden authorization or expose raw private/provider data.",
          "Do not treat synthetic, local, staging, or automated evidence as owner acceptance or live-provider proof.",
          "Do not hand-edit generated FEATURE_CATALOG.md.",
        ],
        requiredClosureEvidence: uniqueSorted([
          finding.closureEvidence,
          "Focused owner tests and the applicable Sounding Line gate pass on the remediation source SHA.",
        ]),
        sourceSha: phase2Config.auditedSourceSha,
        status:
          finding.firstLossPoint === "OWNER_ACCEPTANCE"
            ? "OWNER_DECISION_REQUIRED"
            : finding.firstLossPoint === "EXTERNAL_PROVIDER"
              ? "EXTERNAL_DEPENDENCY"
              : "ASSIGNED",
      };
    })
    .sort((left, right) => left.remediationPacketId.localeCompare(right.remediationPacketId));
  return {
    schemaVersion: "1.0.0",
    project: phase2Config.project,
    phase: phase2Config.phase,
    sourceSha: phase2Config.auditedSourceSha,
    packages,
  };
}

function buildPhase3Queue(remediation, findings, phase2Config) {
  const findingById = new Map(findings.map((finding) => [finding.findingId, finding]));
  const severityRank = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  const items = remediation.packages.map((packet) => {
    const finding = findingById.get(packet.findingIds[0]);
    const active = phase2Config.coordination.find(
      (entry) => entry.capabilityIds.includes(packet.capabilityId) || entry.findingIds.includes(finding.findingId),
    );
    const category = finding.catalogOutcome
      ? "DOCUMENTATION_RECONCILIATION"
      : finding.firstLossPoint === "OWNER_ACCEPTANCE"
        ? "OWNER_ACCEPTANCE_REQUIRED"
        : finding.firstLossPoint === "EXTERNAL_PROVIDER"
          ? "EXTERNAL_DEPENDENCY"
          : "OWNER_PROJECT_WORK";
    const eligibility =
      finding.firstLossPoint === "EXTERNAL_PROVIDER"
        ? "BLOCKED_BY_DEPENDENCY"
        : active
          ? "BLOCKED_BY_ACTIVE_OWNER"
          : ["PROJECTION", "CLIENT", "UI", "NAVIGATION", "STATE", "ACCESSIBILITY", "JOURNEY"].includes(
                finding.firstLossPoint,
              )
            ? "ELIGIBLE"
            : "NOT_ELIGIBLE";
    return {
      queueId: `DW-P3-${finding.findingId.slice("DW-FIND-".length)}`,
      category,
      findingId: finding.findingId,
      capabilityId: packet.capabilityId,
      owner: packet.canonicalOwner,
      remediationPacketId: packet.remediationPacketId,
      severity: finding.severity,
      priority: severityRank[finding.severity] * 100 + (finding.catalogOutcome ? 50 : 0),
      hardDependencies: packet.hardDependencies,
      activeProjectStatus:
        active?.activeOwnerPhase ?? "No overlapping active owner lane observed at Phase 2 design freeze.",
      recommendedIntegrationVehicle: packet.recommendedProjectPhase,
      eligibleEarliestPhase:
        "After Project Deepwater Phase 2 is accepted on main and the owner creates a fresh accepted-main lane.",
      closureEvidence: packet.requiredClosureEvidence,
      deepwaterSliceEligibility: eligibility,
    };
  });
  items.sort((left, right) => left.priority - right.priority || left.findingId.localeCompare(right.findingId));
  return {
    schemaVersion: "1.0.0",
    project: phase2Config.project,
    sourceSha: phase2Config.auditedSourceSha,
    phase3Authorized: false,
    categories: [
      "OWNER_PROJECT_WORK",
      "DEEPWATER_SLICE_ELIGIBLE",
      "EXTERNAL_DEPENDENCY",
      "OWNER_ACCEPTANCE_REQUIRED",
      "DOCUMENTATION_RECONCILIATION",
      "DEBT_CANDIDATE",
    ],
    queue: items,
  };
}

function updateEvidence(capability, policy, context, sourceSha) {
  const entries = [];
  const push = (kind, reference, freshness = "CURRENT") => {
    if (!reference || entries.some((entry) => entry.kind === kind && entry.reference === normalizePath(reference)))
      return;
    entries.push({ kind, reference: normalizePath(reference), freshness });
  };
  for (const reference of capability.evidence.references)
    push(
      reference.kind,
      reference.reference,
      ["COMMIT", "BRANCH", "COMPLETION_RECORD", "OWNER_DECISION", "GOVERNING_DOCUMENT"].includes(reference.kind)
        ? "BOUNDED"
        : "CURRENT",
    );
  for (const reference of policy?.sourceReferences ?? []) push("SOURCE_PATH", reference);
  for (const reference of policy?.testReferences ?? []) push("TEST", reference);
  for (const reference of policy?.recordReferences ?? []) push("COMPLETION_RECORD", reference, "BOUNDED");
  for (const route of context?.routes ?? []) push("ROUTE_INVENTORY", `${route.routeId}:${route.routePattern}`);
  for (const screen of context?.screens ?? []) push("SCREEN_CATALOG", screen.screenId);
  for (const journeyId of context?.journeyIds ?? []) push("JOURNEY_CATALOG", journeyId);
  return entries.map((entry, index) =>
    makeEvidence(capability.capabilityId, index + 1, entry.kind, entry.reference, sourceSha, entry.freshness),
  );
}

function phase2Metrics(ledger, findings, traces, remediation, phase3Queue, phase1Metrics) {
  const classifications = countBy(
    ledger.capabilities.map((capability) => capability.currentRealization.classification),
  );
  const open = findings.filter((finding) => finding.status !== "CLOSED");
  const incomplete = traces.filter((trace) => trace.analysis.classification !== "FULLY_REALIZED");
  const layerCount = traces.length * phase2LayerNames.length;
  const explained = traces
    .flatMap((trace) => Object.values(trace.layers))
    .filter((layer) => layer.status !== "UNKNOWN" || layer.uncertainty).length;
  return {
    totalCapabilities: ledger.capabilities.length,
    prioritizedQueueItemsCompleted: traces.flatMap((trace) => trace.queueIds).length,
    prioritizedTracesCompleted: traces.length,
    tracesSuperseded: traces.filter((trace) => trace.queueDisposition === "SUPERSEDED").length,
    tracesExternallyDeferred: traces.filter((trace) => trace.queueDisposition === "EXTERNALLY_DEFERRED").length,
    capabilitiesWithExactFirstLossPoint: incomplete.filter((trace) => trace.analysis.firstLossPoint).length,
    capabilitiesWithExactRootCause: traces.filter((trace) => trace.analysis.rootCause).length,
    capabilitiesWithCompleteOwnerAssignment: traces.filter((trace) => trace.ownership.canonicalOwner).length,
    remediationPackagesGenerated: remediation.packages.length,
    classifications,
    openFindingsBySeverity: countBy(open.map((finding) => finding.severity)),
    findingsByLossLayer: countBy(open.map((finding) => finding.firstLossPoint)),
    findingsByCanonicalOwner: countBy(open.map((finding) => finding.canonicalOwner)),
    findingsByAssignmentDestination: countBy(open.map((finding) => finding.assignedProjectPhase)),
    documentationOnlyMismatches: open.filter(
      (finding) => finding.catalogOutcome && finding.firstLossPoint === "DOCUMENTATION",
    ).length,
    actualProductGaps: open.filter(
      (finding) => !finding.catalogOutcome && finding.firstLossPoint !== "OWNER_ACCEPTANCE",
    ).length,
    ownerAcceptanceGaps: open.filter((finding) => finding.firstLossPoint === "OWNER_ACCEPTANCE").length,
    externalProviderGaps: open.filter((finding) => finding.firstLossPoint === "EXTERNAL_PROVIDER").length,
    deepwaterSliceEligibleFindings: phase3Queue.queue.filter((item) => item.deepwaterSliceEligibility === "ELIGIBLE")
      .length,
    remainingUnexplainedUnknownTraceLayers: traces
      .flatMap((trace) => Object.values(trace.layers))
      .filter((layer) => layer.status === "UNKNOWN" && !layer.uncertainty).length,
    traceCompletenessPercentage: Number((explained / layerCount).toFixed(4)),
    phase1ComparableMetrics: phase1Metrics,
  };
}

function phase2Reports(artifacts) {
  const { tracesDocument, findingsDocument, remediationDocument, phase3Queue, phase2Metrics, catalogReconciliation } =
    artifacts;
  const traceRows = tracesDocument.traces
    .map(
      (trace) =>
        `| ${trace.identity.capabilityId} | ${trace.ownership.canonicalOwner} | ${trace.analysis.classification} | ${trace.analysis.currentHighestRung} | ${trace.analysis.firstLossPoint ?? "none"} | ${trace.queueIds.length} |`,
    )
    .join("\n");
  const open = findingsDocument.findings.filter((finding) => finding.status !== "CLOSED");
  const causeRows = open
    .map(
      (finding) =>
        `| ${finding.findingId} | ${finding.firstLossPoint} | ${finding.canonicalOwner} | ${finding.severity} | ${finding.rootCause.replaceAll("|", "\\|")} |`,
    )
    .join("\n");
  const packetRows = remediationDocument.packages
    .map(
      (packet) =>
        `| ${packet.remediationPacketId} | ${packet.canonicalOwner} | ${packet.firstLossPoint} | ${packet.recommendedProjectPhase.replaceAll("|", "\\|")} | ${packet.status} |`,
    )
    .join("\n");
  const phase1ByCapability = new Map(
    artifacts.phase1.ledger.capabilities.map((capability) => [capability.capabilityId, capability]),
  );
  const deltaRows = tracesDocument.traces
    .map((trace) => {
      const before = phase1ByCapability.get(trace.identity.capabilityId);
      const change = `${before.currentRealization.classification} / ${before.currentRealization.highestRung} -> ${trace.analysis.classification} / ${trace.analysis.currentHighestRung}`;
      return `| ${trace.identity.capabilityId} | ${change} | ${trace.analysis.firstLossPoint ?? "none"} | ${trace.analysis.rootCause.replaceAll("|", "\\|")} |`;
    })
    .join("\n");
  const header = (title, canonical) => markdownFrontmatter(title, canonical);
  return {
    trace: `${header("Project Deepwater Phase 2 Trace Report", "project-deepwater-phase-2-trace-report")}# Project Deepwater Phase 2 trace report

## Decision boundary

All 44 accepted Phase 1 queue items map to ${tracesDocument.traceCount} complete source-bound capability traces. A completed trace is an audit conclusion, not implementation of its remediation packet.

## Metrics

- Queue items completed: ${phase2Metrics.prioritizedQueueItemsCompleted}
- Unique prioritized traces completed: ${phase2Metrics.prioritizedTracesCompleted}
- Exact first-loss points for incomplete capabilities: ${phase2Metrics.capabilitiesWithExactFirstLossPoint}
- Remaining unexplained UNKNOWN layers: ${phase2Metrics.remainingUnexplainedUnknownTraceLayers}
- Trace completeness: ${(phase2Metrics.traceCompletenessPercentage * 100).toFixed(2)}%

## Trace index

| Capability | Owner | Classification | Highest rung | First loss | Queue items |
| --- | --- | --- | --- | --- | ---: |
${traceRows}
`,
    rootCause: `${header("Project Deepwater Phase 2 Root Cause Summary", "project-deepwater-phase-2-root-cause-summary")}# Project Deepwater Phase 2 root-cause summary

## Result

Phase 2 closed two Phase 1 findings whose allegedly absent projections already existed on accepted main. ${open.length} findings remain open and assigned: ${phase2Metrics.documentationOnlyMismatches} documentation-only mismatches, ${phase2Metrics.actualProductGaps} product/provider gaps, and ${phase2Metrics.ownerAcceptanceGaps} owner-acceptance gap.

| Finding | First loss | Canonical owner | Severity | Root cause |
| --- | --- | --- | --- | --- |
${causeRows}
`,
    assignment: `${header("Project Deepwater Phase 2 Assignment Summary", "project-deepwater-phase-2-assignment-summary")}# Project Deepwater Phase 2 assignment summary

## Result

Every open finding has a canonical owner and an independently consumable remediation packet. Packets specify the missing outcome and closure proof without prescribing another owner's internal architecture.

| Packet | Owner | First loss | Recommended vehicle | Status |
| --- | --- | --- | --- | --- |
${packetRows}

The generated Phase 3 queue contains ${phase3Queue.queue.length} items and does not authorize Phase 3 work.
`,
    delta: `${header("Project Deepwater Phase 1 to Phase 2 Delta Report", "project-deepwater-phase-1-to-phase-2-delta-report")}# Project Deepwater Phase 1 to Phase 2 delta report

## What Phase 2 learned

Phase 1 intentionally used conservative skeletons. Phase 2 bound the same accepted product source to actual services, transports, projections, pages, route/screen records, and capability-specific tests. ${catalogReconciliation.entries.length} provisional catalog-to-route loss points were resolved into explicit current route identities; no accepted product route was changed.

| Capability | Classification and rung change | Exact first loss | Why |
| --- | --- | --- | --- |
${deltaRows}

## Finding lifecycle

- Closed as superseded source-census findings: ${findingsDocument.findings
      .filter((finding) => finding.status === "CLOSED")
      .map((finding) => finding.findingId)
      .join(", ")}
- Finding splits or merges: none
- New findings: none
- Ownership change: DW-FIND-VERIFICATION-PROVIDER-REALIZATION-GAP now assigns real-provider truth to Watchglass while One Voyage retains the framework contract.
- Catalog outcomes: ${catalogReconciliation.entries.map((entry) => `${entry.featureCatalogId}=${entry.outcome}`).join(", ")}
`,
  };
}

function operationSlug(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "")
    .slice(0, 96)
    .replace(/-$/u, "");
}

function phase3UtilizationStatus(capability, policy) {
  if (policy?.status) return policy.status;
  if (capability.currentRealization.classification === "INTERNAL_BY_DESIGN") return "INTERNAL_ONLY";
  if (capability.currentRealization.classification === "SECURITY_RESTRICTED") return "INTENTIONALLY_PARTIAL";
  if (capability.currentRealization.classification === "DEPRECATED") return "NOT_APPLICABLE";
  if (
    ["PARTIALLY_REALIZED", "BACKEND_ONLY", "FRONTEND_ONLY", "HIDDEN", "MISSING", "BROKEN"].includes(
      capability.currentRealization.classification,
    )
  )
    return "PARTIALLY_UTILIZED";
  return "FULLY_UTILIZED";
}

function capabilitySourceReferences(capability) {
  const evidencePaths = capability.evidence.references
    .filter((entry) => ["SOURCE_PATH", "TEST", "COMPLETION_RECORD"].includes(entry.kind))
    .map((entry) => normalizePath(entry.reference.split("#", 1)[0]));
  const tracePaths = Object.values(capability.trace)
    .flatMap((entry) => (entry && typeof entry === "object" && Array.isArray(entry.references) ? entry.references : []))
    .map(normalizePath)
    .filter((reference) => /^(?:src|scripts|tests|prisma|Development_Docs)\//u.test(reference));
  return uniqueSorted([...evidencePaths, ...tracePaths])
    .sort((left, right) => {
      const rank = (reference) =>
        /^(?:prisma\/|scripts\/|src\/(?!components\/|app\/.*\/page))/u.test(reference)
          ? 0
          : /^(?:src|tests)\//u.test(reference)
            ? 1
            : 2;
      return rank(left) - rank(right) || left.localeCompare(right);
    })
    .slice(0, 12);
}

function capabilityConsumerReferences(capability) {
  const productReferences = [
    ...capability.trace.ui.references,
    ...capability.trace.client.references,
    ...capability.trace.transport.references,
    ...(capability.evidence.testIds ?? []),
    ...(capability.evidence.journeyIds ?? []).map((id) => `journey:${id}`),
  ];
  const machineReferences = [
    ...capability.trace.service.references,
    ...capability.trace.transport.references,
    ...(capability.evidence.testIds ?? []),
  ];
  const preferred = ["INTERNAL", "MACHINE_CONSUMER", "SECURITY_RESTRICTED", "COMPATIBILITY", "DEPRECATED"].includes(
    capability.expectedRealization.disposition,
  )
    ? machineReferences
    : productReferences;
  return uniqueSorted(preferred.map(normalizePath)).slice(0, 12);
}

function utilizationMetadata(capability, policy) {
  const searchable = stableStringify({
    name: capability.name,
    meaning: capability.meaning,
    subfeatures: capability.catalogMapping?.declaredSubfeatures ?? [],
  }).toLowerCase();
  const values = policy?.metadata?.length
    ? [...policy.metadata]
    : ["authorization and audience scope", "authoritative lifecycle state"];
  if (/version|checksum|provenance|history|lineage|receipt/u.test(searchable))
    values.push("source, version, and provenance identity");
  if (/retry|recovery|failure|error|restore|resume|cancel/u.test(searchable))
    values.push("failure and recovery classification");
  values.push(...(policy?.blockedMetadata ?? []));
  return uniqueSorted(values);
}

function utilizationDisposition(capability, status, findingIds, policy) {
  if (policy?.phase3Disposition) return policy.phase3Disposition;
  if (findingIds.includes("DW-FIND-HOMEPORT-OWNER-DECISION-PENDING")) return "OWNER_ACCEPTANCE_REQUIRED";
  if (findingIds.includes("DW-FIND-EDITION-COMPARISON-SEMANTIC-UNDERUTILIZATION")) return "OWNER_PROJECT_WORK";
  if (findingIds.some((id) => id.startsWith("DW-FIND-CATALOG-SURFACE-"))) return "DOCUMENTATION_RECONCILIATION";
  if (["INTERNAL_ONLY", "NOT_APPLICABLE", "INTENTIONALLY_PARTIAL"].includes(status)) return "INTERNAL_OR_DEPRECATED";
  return "SATURATED";
}

function buildCapabilityUtilization(capability, policy, findingIds) {
  const status = phase3UtilizationStatus(capability, policy);
  const operationNames = uniqueSorted([
    ...(policy?.operations ?? capability.catalogMapping?.declaredSubfeatures ?? []),
    ...(policy?.intentionallyUnconsumed ?? []),
  ]);
  if (!operationNames.length) operationNames.push(capability.name);
  const sourceReferences = capabilitySourceReferences(capability);
  const consumerReferences = capabilityConsumerReferences(capability);
  const blocked = policy?.blockedOperations ?? {};
  const intentional = new Set(policy?.intentionallyUnconsumed ?? []);
  const expectedOperations = operationNames.map((name) => {
    const blockedFinding = blocked[name] ?? null;
    const disposition = blockedFinding
      ? "FINDING_BLOCKED"
      : intentional.has(name)
        ? "INTENTIONALLY_UNCONSUMED"
        : "CONSUMED";
    return {
      operationId: operationSlug(name),
      name,
      disposition,
      sourceReferences,
      consumerReferences: disposition === "CONSUMED" ? consumerReferences : [],
      rationale:
        disposition === "INTENTIONALLY_UNCONSUMED"
          ? policy.rationale
          : disposition === "FINDING_BLOCKED"
            ? `Open finding ${blockedFinding} owns the missing consumer or governed semantic replacement.`
            : null,
      findingId: blockedFinding,
    };
  });
  const metadata = utilizationMetadata(capability, policy);
  const blockedMetadata = new Set(policy?.blockedMetadata ?? []);
  const consumedMetadata = metadata.filter((value) => !blockedMetadata.has(value));
  const consumers = uniqueSorted([
    ...capability.audience.roles.map((role) => `audience:${role}`),
    ...capability.expectedRealization.requiredSurfaces.map((surface) => `surface:${surface}`),
    ...consumerReferences.map((reference) => `consumer:${reference}`),
  ]);
  const relatedOpen = findingIds.filter((findingId) => Object.values(blocked).includes(findingId));
  return {
    capabilityId: capability.capabilityId,
    name: capability.name,
    canonicalOwner: capability.owner.project,
    realizationClassification: capability.currentRealization.classification,
    status,
    expectedOperations,
    consumedOperations: expectedOperations
      .filter((operation) => operation.disposition === "CONSUMED")
      .map((operation) => operation.operationId),
    intentionallyUnconsumedOperations: expectedOperations
      .filter((operation) => operation.disposition === "INTENTIONALLY_UNCONSUMED")
      .map((operation) => operation.operationId),
    expectedSafeMetadata: metadata,
    consumedSafeMetadata: consumedMetadata,
    findingBlockedMetadata: metadata.filter((value) => blockedMetadata.has(value)),
    intentionallyOmittedMetadata: uniqueSorted(policy?.omittedMetadata ?? []),
    expectedStates: uniqueSorted(capability.states.required),
    consumedOrRepresentedStates: uniqueSorted([...capability.states.represented, ...capability.states.required]),
    intentionallyOmittedStates: [],
    utilizationConsumers: consumers.length ? consumers : ["consumer:governed-owner-service"],
    canonicalConsumption: relatedOpen.length === 0,
    phase3Disposition: utilizationDisposition(capability, status, findingIds, policy),
    rationale:
      policy?.rationale ??
      (status === "FULLY_UTILIZED"
        ? "Every governed operation or capability dimension appropriate to the audience has a source-bound consumer, and required states and safe decision metadata are represented."
        : status === "INTERNAL_ONLY"
          ? "The capability is consumed by a named machine, developer, or operator workflow and is intentionally absent from ordinary product navigation."
          : status === "NOT_APPLICABLE"
            ? "The capability is deprecated or compatibility-only and is not expected to gain an ordinary active consumer."
            : "Open governed findings identify the exact operations or metadata that remain underutilized."),
    evidence: uniqueSorted([
      ...sourceReferences,
      ...consumerReferences,
      ...relatedOpen.map((findingId) => `finding:${findingId}`),
    ]),
  };
}

function phase3Findings(phase2Findings, config) {
  const transitions = config.findingTransitions ?? {};
  const carried = phase2Findings.map((finding) => {
    const transition = transitions[finding.findingId];
    return transition ? { ...finding, ...transition, observedSourceSha: config.auditedSourceSha } : finding;
  });
  const additions = config.newFindings.map((finding) => ({
    catalogOutcome: null,
    debt: null,
    closedAt: null,
    observedSourceSha: config.auditedSourceSha,
    ...finding,
  }));
  return [...carried, ...additions].sort((left, right) => left.findingId.localeCompare(right.findingId));
}

function phase3QueueFor(findings, phase2Queue, config) {
  const prior = new Map(phase2Queue.queue.map((item) => [item.findingId, item]));
  const sliceByFinding = new Map();
  for (const finding of findings) {
    const featureId = finding.findingId.match(/FT-[0-9]{3}/u)?.[0];
    if (featureId && config.catalogSlices[featureId])
      sliceByFinding.set(finding.findingId, config.catalogSlices[featureId]);
  }
  const queue = findings
    .filter((finding) => finding.status !== "CLOSED" || finding.findingId.startsWith("DW-FIND-CATALOG-SURFACE-"))
    .map((finding) => {
      const previous = prior.get(finding.findingId);
      const sliceId = sliceByFinding.get(finding.findingId) ?? null;
      const closed = finding.status === "CLOSED";
      let category = previous?.category ?? "OWNER_PROJECT_WORK";
      let eligibility = previous?.deepwaterSliceEligibility ?? "NOT_ELIGIBLE";
      let activeProjectStatus = previous?.activeProjectStatus ?? "Owner project coordination required.";
      if (closed) {
        category = "ALREADY_CLOSED_BY_MAIN";
        eligibility = "RETIRED";
        activeProjectStatus = "Closure is present on current accepted main.";
      } else if (sliceId) {
        category = "DOCUMENTATION_RECONCILIATION";
        eligibility = "ELIGIBLE";
        activeProjectStatus = `Registered as ${sliceId}; implementation must use its fresh-main worktree.`;
      } else if (finding.findingId === "DW-FIND-EDITION-COMPARISON-SEMANTIC-UNDERUTILIZATION") {
        category = "OWNER_PROJECT_WORK";
        eligibility = "BLOCKED_BY_ACTIVE_OWNER";
        activeProjectStatus =
          "The Tideglass foundation is accepted; Studio consumer migration remains Tideglass and Shipwright owner work, and Deepwater does not compete with the active Shipwright lane.";
      } else if (finding.findingId.startsWith("DW-FIND-CATALOG-SURFACE-")) {
        category = "DOCUMENTATION_RECONCILIATION";
        eligibility = "BLOCKED_BY_ACTIVE_OWNER";
        activeProjectStatus =
          "The owning fragment is touched by an unaccepted Helm, Shipwright, or Tideglass lane and is excluded from Deepwater slices.";
      }
      return {
        queueId: previous?.queueId ?? `DW-P3-${finding.findingId.slice("DW-FIND-".length)}`,
        findingId: finding.findingId,
        capabilityId: finding.capabilityId,
        category,
        severity: finding.severity,
        owner: finding.canonicalOwner,
        status: finding.status,
        sliceId,
        deepwaterSliceEligibility: eligibility,
        activeProjectStatus,
        hardDependencies: previous?.hardDependencies ?? [finding.mainlineDependency],
        recommendedIntegrationVehicle: previous?.recommendedIntegrationVehicle ?? finding.assignedProjectPhase,
        closureEvidence: previous?.closureEvidence ?? [finding.closureEvidence],
      };
    })
    .sort((left, right) => left.queueId.localeCompare(right.queueId));
  return {
    schemaVersion: "1.0.0",
    project: config.project,
    phase: config.phase,
    sourceSha: config.auditedSourceSha,
    phase3Authorized: true,
    categories: [
      "OWNER_PROJECT_WORK",
      "DEEPWATER_SLICE_ELIGIBLE",
      "DOCUMENTATION_RECONCILIATION",
      "EXTERNAL_DEPENDENCY",
      "OWNER_ACCEPTANCE_REQUIRED",
      "EXPLICIT_DEBT_CANDIDATE",
      "ALREADY_CLOSED_BY_MAIN",
    ],
    queue,
  };
}

function phase3Metrics(artifacts) {
  const utilization = artifacts.utilizationDocument.capabilities;
  const findings = artifacts.findingsDocument.findings;
  const phase3Discovered = new Set(artifacts.inputs.phase3Config.newFindings.map((finding) => finding.findingId));
  const phase3Transitions = artifacts.inputs.phase3Config.findingTransitions ?? {};
  const catalog = findings.filter((finding) => finding.findingId.startsWith("DW-FIND-CATALOG-SURFACE-"));
  const operations = utilization.flatMap((capability) => capability.expectedOperations);
  const blockedMetadata = utilization.reduce(
    (count, capability) => count + capability.findingBlockedMetadata.length,
    0,
  );
  return {
    capabilityRealization: countBy(
      artifacts.ledger.capabilities.map((capability) => capability.currentRealization.classification),
    ),
    capabilityUtilization: countBy(utilization.map((capability) => capability.status)),
    backendOperationsReviewed: operations.length,
    unconsumedMeaningfulOperationsRemaining: operations.filter(
      (operation) => operation.disposition === "FINDING_BLOCKED",
    ).length,
    unconsumedSafeMetadataRemaining: blockedMetadata,
    unconsumedRecoveryCapabilitiesRemaining: operations.filter(
      (operation) =>
        operation.disposition === "FINDING_BLOCKED" && /retry|recover|resume|restore|requeue/u.test(operation.name),
    ).length,
    findings: {
      startingOpen: artifacts.phase2.findingsDocument.findings.filter((finding) => finding.status !== "CLOSED").length,
      phase3Discovered: phase3Discovered.size,
      closed: Object.values(phase3Transitions).filter((transition) => transition.status === "CLOSED").length,
      debtAccepted: findings.filter((finding) => finding.status === "DEBT_ACCEPTED").length,
      external: artifacts.phase3Queue.queue.filter((item) => item.category === "EXTERNAL_DEPENDENCY").length,
      ownerAcceptance: artifacts.phase3Queue.queue.filter((item) => item.category === "OWNER_ACCEPTANCE_REQUIRED")
        .length,
      remainingHigh: findings.filter((finding) => finding.status !== "CLOSED" && finding.severity === "HIGH").length,
      remainingCritical: findings.filter((finding) => finding.status !== "CLOSED" && finding.severity === "CRITICAL")
        .length,
    },
    documentation: {
      starting: 17,
      closed: catalog.filter((finding) => finding.status === "CLOSED").length,
      remaining: catalog.filter((finding) => finding.status !== "CLOSED").length,
    },
    slices: countBy(artifacts.slicesDocument.slices.map((slice) => slice.status)),
  };
}

function phase3Reports(artifacts) {
  const utilizationRows = artifacts.utilizationDocument.capabilities
    .map(
      (capability) =>
        `| ${capability.capabilityId} | ${capability.canonicalOwner} | ${capability.realizationClassification} | ${capability.status} | ${capability.expectedOperations.length} | ${capability.phase3Disposition} |`,
    )
    .join("\n");
  const queueRows = artifacts.phase3Queue.queue
    .map(
      (item) =>
        `| ${item.findingId} | ${item.owner} | ${item.category} | ${item.status} | ${item.sliceId ?? "owner/external"} |`,
    )
    .join("\n");
  const sliceRows = artifacts.slicesDocument.slices
    .map(
      (slice) =>
        `| ${slice.sliceId} | ${slice.canonicalOwner} | ${slice.concurrencyClass} | ${slice.status} | ${slice.branch} |`,
    )
    .join("\n");
  const newFindingIds = artifacts.inputs.phase3Config.newFindings.map((finding) => finding.findingId).join(", ");
  const closedFindings = artifacts.findingsDocument.findings
    .filter((finding) => finding.status === "CLOSED" && finding.closedAt === artifacts.inputs.phase3Config.auditDate)
    .map((finding) => finding.findingId);
  const header = (title, canonical) => markdownFrontmatter(title, canonical);
  return {
    utilization: `${header("Project Deepwater Phase 3 Utilization Report", "project-deepwater-phase-3-utilization-report")}# Project Deepwater Phase 3 utilization report

## Decision boundary

All ${artifacts.utilizationDocument.reviewedCapabilityCount} governed capabilities received an operation, safe-metadata, state, recovery, and consumer saturation review against accepted source \`${artifacts.utilizationDocument.sourceSha}\`. Realization and utilization remain separate dimensions.

## Result

- Backend operations or governed capability dimensions reviewed: ${artifacts.metrics.backendOperationsReviewed}
- Meaningful operations still finding-blocked: ${artifacts.metrics.unconsumedMeaningfulOperationsRemaining}
- Safe metadata families still finding-blocked: ${artifacts.metrics.unconsumedSafeMetadataRemaining}
- Phase 3-discovered findings: ${artifacts.metrics.findings.phase3Discovered}

| Capability | Owner | Realization | Utilization | Operations | Disposition |
| --- | --- | --- | --- | ---: | --- |
${utilizationRows}
`,
    remediation: `${header("Project Deepwater Phase 3 Remediation Report", "project-deepwater-phase-3-remediation-report")}# Project Deepwater Phase 3 remediation report

## Queue

The queue preserves every Phase 2 finding and adds the source-bound semantic-edition-comparison finding. Owner, external-provider, owner-acceptance, and active-fragment boundaries remain explicit.

| Finding | Owner | Category | Status | Slice or boundary |
| --- | --- | --- | --- | --- |
${queueRows}

## Registered slices

| Slice | Owner | Class | Status | Branch |
| --- | --- | --- | --- | --- |
${sliceRows}
`,
    delta: `${header("Project Deepwater Phase 2 to Phase 3 Delta Report", "project-deepwater-phase-2-to-phase-3-delta-report")}# Project Deepwater Phase 2 to Phase 3 delta report

## Explainable changes

- Phase 2 realization history is retained unchanged in the trace and remediation artifacts.
- Phase 3 adds utilization status for all ${artifacts.utilizationDocument.reviewedCapabilityCount} current accepted capabilities. The Phase 2 baseline remains ${artifacts.inputs.phase3Config.phase2AcceptedCapabilityCount}; accepted-main Tideglass completion added ${artifacts.inputs.phase3Config.currentMainCapabilityAdditions.map((entry) => entry.capabilityId).join(", ")} before coordination publication.
- New utilization finding: ${newFindingIds}.
- Findings closed by accepted Phase 3 slices: ${closedFindings.length ? closedFindings.join(", ") : "none yet"}.
- Product behavior changed by the coordination branch: none.
- External provider and Homeport owner-decision truth remain explicit and unclaimed.
`,
  };
}

async function buildPhase3Artifacts(root, phase2) {
  const [phase3Config, utilizationSchema, slicesSchema] = await Promise.all([
    readJson(root, `${DEEPWATER_ROOT}/deepwater-phase3-config.json`),
    readJson(root, `${DEEPWATER_ROOT}/utilization/deepwater-capability-utilization.schema.json`),
    readJson(root, `${DEEPWATER_ROOT}/remediation/deepwater-phase3-slices.schema.json`),
  ]);
  const findings = phase3Findings(phase2.findingsDocument.findings, phase3Config);
  const capabilities = attachFindings(
    phase2.ledger.capabilities.map((capability) => ({
      ...capability,
      evidence: { ...capability.evidence, sourceSha: phase3Config.auditedSourceSha },
      lifecycle: { ...capability.lifecycle, lastAudited: phase3Config.auditDate },
    })),
    findings,
  ).sort((left, right) => left.capabilityId.localeCompare(right.capabilityId));
  const utilizationCapabilities = capabilities.map((capability) =>
    buildCapabilityUtilization(
      capability,
      phase3Config.manualCapabilityPolicies[capability.capabilityId],
      capability.gaps.findingIds,
    ),
  );
  const utilizationDocument = {
    schemaVersion: "1.0.0",
    project: phase3Config.project,
    phase: phase3Config.phase,
    sourceSha: phase3Config.auditedSourceSha,
    reviewedCapabilityCount: utilizationCapabilities.length,
    statusCounts: Object.fromEntries(
      ["FULLY_UTILIZED", "PARTIALLY_UTILIZED", "INTENTIONALLY_PARTIAL", "INTERNAL_ONLY", "NOT_APPLICABLE"].map(
        (status) => [status, utilizationCapabilities.filter((capability) => capability.status === status).length],
      ),
    ),
    capabilities: utilizationCapabilities,
  };
  const slicesDocument = {
    schemaVersion: "1.0.0",
    project: phase3Config.project,
    phase: phase3Config.phase,
    sourceSha: phase3Config.auditedSourceSha,
    mainlineSafetyContract:
      "Each remediation slice is independently complete and mainline-safe. No slice assumes a future slice will make current behavior coherent.",
    slices: phase3Config.slices,
  };
  const phase3Queue = phase3QueueFor(findings, phase2.phase3Queue, phase3Config);
  const ledger = {
    ...phase2.ledger,
    phase: phase3Config.phase,
    auditedSourceSha: phase3Config.auditedSourceSha,
    auditDate: phase3Config.auditDate,
    generation: {
      ...phase2.ledger.generation,
      sourceInputs: uniqueSorted([
        ...phase2.ledger.generation.sourceInputs,
        `${DEEPWATER_ROOT}/deepwater-phase3-config.json`,
        `${DEEPWATER_ROOT}/utilization/deepwater-capability-utilization.schema.json`,
        `${DEEPWATER_ROOT}/remediation/deepwater-phase3-slices.schema.json`,
      ]),
    },
    capabilities,
  };
  const findingsDocument = {
    schemaVersion: "1.0.0",
    project: phase3Config.project,
    phase: phase3Config.phase,
    auditedSourceSha: phase3Config.auditedSourceSha,
    findings,
  };
  const evidence = uniqueSorted([
    ...utilizationCapabilities.flatMap((capability) => capability.evidence),
    ...phase3Config.newFindings.flatMap((finding) => finding.evidence),
    ...phase3Config.slices.flatMap((slice) => [...slice.ownedPaths, ...slice.verificationPlan]),
  ]).map((reference, index) => ({
    evidenceId: `DW-P3-EV-${String(index + 1).padStart(4, "0")}`,
    reference,
    sourceSha: phase3Config.auditedSourceSha,
  }));
  const evidenceIndex = {
    schemaVersion: "1.0.0",
    project: phase3Config.project,
    phase: phase3Config.phase,
    sourceSha: phase3Config.auditedSourceSha,
    privacyBoundary:
      "Repository paths, route/journey identifiers, safe capability conclusions, and slice receipts only; no credentials, tokens, cookies, private content, provider secrets, recipient addresses, message bodies, or object keys.",
    evidence,
  };
  const phase4ProofQueue = {
    schemaVersion: "1.0.0",
    project: phase3Config.project,
    phase: "Phase 4 - Break the Surface",
    phase4Authorized: false,
    sourceSha: phase3Config.auditedSourceSha,
    queue: [],
    rationale:
      "No accepted Phase 3 slice currently changes UI, navigation, state behavior, feedback, accessibility, responsiveness, or a natural journey. Owner-project remediation adds entries only after it is accepted on main.",
  };
  const status = {
    schemaVersion: "1.0.0",
    project: phase3Config.project,
    phase: phase3Config.phase,
    state: phase3Config.lifecycle.state,
    activation: "ACTIVE_OWNER_COORDINATED_REALIZATION_AND_UTILIZATION_CLOSURE",
    branch: phase3Config.branch,
    worktree: phase3Config.worktree,
    baseSourceSha: phase3Config.baseOriginMainSha,
    auditedSourceSha: phase3Config.auditedSourceSha,
    finalReconciledMainSha: null,
    mainlineState: phase3Config.lifecycle.mainlineState,
    schemaImpact: "NONE",
    productSourceImpact: "NONE_ON_COORDINATION_BRANCH",
    featureCatalogImpact: "PENDING_REGISTERED_SLICES",
    validation: phase3Config.lifecycle.validation,
    reconciliation: phase3Config.lifecycle.reconciliation,
    authorityGaps: phase3Config.authorityGaps,
    limitations: [
      "Unaccepted owner branches are coordination constraints, not implementation truth.",
      "Watchglass real-provider proof remains external and is not simulated as completion.",
      "Homeport PRODUCT_ACCEPTED remains an owner-only decision.",
      "Phase 4 is not authorized.",
    ],
  };
  const artifacts = {
    ...phase2,
    phase2,
    inputs: { ...phase2.inputs, phase3Config, utilizationSchema, slicesSchema },
    ledger,
    findingsDocument,
    evidenceIndex,
    utilizationDocument,
    slicesDocument,
    phase3Queue,
    phase4ProofQueue,
    status,
  };
  artifacts.metrics = phase3Metrics(artifacts);
  artifacts.status.metrics = artifacts.metrics;
  artifacts.phase3Reports = phase3Reports(artifacts);
  return artifacts;
}

async function generatePhase2Artifacts(root) {
  const phase1 = await buildPhase1Artifacts(root);
  const [phase2Config, tracesSchema, remediationSchema] = await Promise.all([
    readJson(root, `${DEEPWATER_ROOT}/deepwater-phase2-config.json`),
    readJson(root, `${DEEPWATER_ROOT}/traces/capability-traces.schema.json`),
    readJson(root, `${DEEPWATER_ROOT}/remediation/deepwater-remediation-packages.schema.json`),
  ]);
  const inputs = { ...phase1.inputs, phase2Config, tracesSchema, remediationSchema };
  const catalogReconciliation = phase2CatalogReconciliation(phase1, phase2Config);
  const refinedFindings = refineFindings(phase1, phase2Config, catalogReconciliation);
  const openFindingIds = new Set(
    refinedFindings.filter((finding) => finding.status !== "CLOSED").map((finding) => finding.findingId),
  );
  const policyByCapability = new Map(phase2Config.tracePolicies.map((policy) => [policy.capabilityId, policy]));
  const preliminaryCapabilities = phase1.ledger.capabilities.map((capability) => {
    const policy = policyByCapability.get(capability.capabilityId);
    const context = policy ? routeContext(policy, inputs) : null;
    const evidenceReferences = updateEvidence(capability, policy, context, phase2Config.auditedSourceSha);
    if (!policy)
      return {
        ...capability,
        evidence: { ...capability.evidence, sourceSha: phase2Config.auditedSourceSha, references: evidenceReferences },
      };
    const flags = uniqueSorted(
      capability.currentRealization.secondaryFlags.filter(
        (flag) =>
          !["UNVERIFIED", "JOURNEY_UNPROVEN", "STALE_EVIDENCE"].includes(flag) ||
          (policy.profile === "EXTERNAL_PROVIDER_GAP" && flag === "JOURNEY_UNPROVEN"),
      ),
    );
    const profile = phase2Config.profiles[policy.profile];
    const full = policy.classification === "FULLY_REALIZED";
    return {
      ...capability,
      currentRealization: {
        highestRung: policy.currentHighestRung,
        classification: policy.classification,
        secondaryFlags: flags,
        confidence: "HIGH",
      },
      trace: {
        domain: layer(
          profile.domain,
          layerReferenceCandidates("domain", referencesFromCapability(capability), policy, context, capability),
        ),
        service: layer(
          profile.service,
          layerReferenceCandidates("service", referencesFromCapability(capability), policy, context, capability),
        ),
        transport: layer(
          profile.transport,
          layerReferenceCandidates("transport", referencesFromCapability(capability), policy, context, capability),
        ),
        authorization: layer(
          profile.authorization,
          layerReferenceCandidates("authorization", referencesFromCapability(capability), policy, context, capability),
        ),
        projection: layer(
          profile.projection,
          layerReferenceCandidates("projection", referencesFromCapability(capability), policy, context, capability),
        ),
        client: layer(
          profile.client,
          layerReferenceCandidates("client", referencesFromCapability(capability), policy, context, capability),
        ),
        ui: layer(
          profile.ui,
          layerReferenceCandidates("ui", referencesFromCapability(capability), policy, context, capability),
        ),
        navigation: layer(
          profile.navigation,
          layerReferenceCandidates("navigation", referencesFromCapability(capability), policy, context, capability),
        ),
        accessibility: layer(
          profile.accessibility,
          layerReferenceCandidates("accessibility", referencesFromCapability(capability), policy, context, capability),
        ),
        journey: layer(
          profile.journey,
          layerReferenceCandidates("journey", referencesFromCapability(capability), policy, context, capability),
        ),
        suspectedFirstLossPoint: policy.firstLossPoint ?? null,
      },
      states: {
        required: capability.states.required,
        represented: full
          ? uniqueSorted([...capability.states.represented, ...capability.states.required, ...context.states])
          : uniqueSorted([...capability.states.represented, ...context.states]),
        missing: full ? [] : capability.states.missing,
      },
      quality: {
        discoverability: ["FULL_STACK", "AGGREGATE_PRODUCT", "OWNER_ACCEPTANCE_GAP", "EXTERNAL_PROVIDER_GAP"].includes(
          policy.profile,
        )
          ? profile.navigation
          : "NOT_APPLICABLE",
        visualMaturity: capability.expectedRealization.disposition === "USER_FACING" ? profile.ui : "NOT_APPLICABLE",
        accessibility: profile.accessibility,
        responsive:
          capability.expectedRealization.disposition === "USER_FACING" ? profile.accessibility : "NOT_APPLICABLE",
        recovery: full ? "VERIFIED" : profile.state,
      },
      evidence: {
        sourceSha: phase2Config.auditedSourceSha,
        references: evidenceReferences,
        testIds: uniqueSorted([...(capability.evidence.testIds ?? []), ...(policy.testReferences ?? [])]),
        screenshotIds: uniqueSorted([...(capability.evidence.screenshotIds ?? []), ...context.screenshotIds]),
        journeyIds: uniqueSorted([...(capability.evidence.journeyIds ?? []), ...context.journeyIds]),
        ownerAcceptance: policy.ownerAcceptance ?? capability.evidence.ownerAcceptance,
      },
      lifecycle: { ...capability.lifecycle, lastAudited: phase2Config.auditDate },
    };
  });
  const capabilities = attachFindings(preliminaryCapabilities, refinedFindings).sort((left, right) =>
    left.capabilityId.localeCompare(right.capabilityId),
  );
  const ledger = {
    ...phase1.ledger,
    phase: phase2Config.phase,
    auditedSourceSha: phase2Config.auditedSourceSha,
    auditDate: phase2Config.auditDate,
    generation: {
      ...phase1.ledger.generation,
      sourceInputs: uniqueSorted([
        ...phase1.ledger.generation.sourceInputs,
        `${DEEPWATER_ROOT}/deepwater-phase2-config.json`,
        `${DEEPWATER_ROOT}/reports/Project_Deepwater_Phase_2_Trace_Queue.json`,
      ]),
    },
    capabilities,
  };
  const findingsDocument = {
    schemaVersion: "1.0.0",
    project: phase2Config.project,
    phase: phase2Config.phase,
    auditedSourceSha: phase2Config.auditedSourceSha,
    findings: refinedFindings,
  };
  const traces = [];
  for (const policy of phase2Config.tracePolicies) {
    const capability = capabilities.find((candidate) => candidate.capabilityId === policy.capabilityId);
    traces.push(await buildDetailedTrace(root, capability, policy, phase1.queueDocument, inputs, openFindingIds));
  }
  traces.sort((left, right) => left.traceId.localeCompare(right.traceId));
  const tracesDocument = {
    schemaVersion: "1.0.0",
    project: phase2Config.project,
    phase: phase2Config.phase,
    sourceSha: phase2Config.auditedSourceSha,
    seedQueueCount: phase2Config.phase1.seedQueueCount,
    queueItemCount: traces.flatMap((trace) => trace.queueIds).length,
    traceCount: traces.length,
    traces,
  };
  const remediationDocument = buildRemediationPackages(ledger, refinedFindings, phase2Config, catalogReconciliation);
  const phase3Queue = buildPhase3Queue(remediationDocument, refinedFindings, phase2Config);
  const metrics = phase2Metrics(
    ledger,
    refinedFindings,
    traces,
    remediationDocument,
    phase3Queue,
    phase1.status.metrics,
  );
  const evidenceIndex = {
    schemaVersion: "1.0.0",
    sourceSha: phase2Config.auditedSourceSha,
    privacyBoundary:
      "Sanitized repository paths, symbols, route/screen/journey IDs, and governed conclusions only; no credentials, tokens, cookies, private content, provider secrets, object keys, or personal data.",
    evidence: capabilities
      .flatMap((capability) => capability.evidence.references)
      .sort((left, right) => left.evidenceId.localeCompare(right.evidenceId)),
  };
  const coordinationRegister = {
    schemaVersion: "1.0.0",
    project: phase2Config.project,
    sourceSha: phase2Config.auditedSourceSha,
    truthPolicy:
      "Accepted origin/main only; unaccepted owner lanes are coordination constraints, never implementation evidence.",
    entries: phase2Config.coordination,
  };
  const status = {
    schemaVersion: "1.0.0",
    project: phase2Config.project,
    phase: phase2Config.phase,
    state: phase2Config.lifecycle.state,
    activation: "ACTIVE_GOVERNANCE_TRACE_AND_ASSIGNMENT_TOOLING",
    branch: phase2Config.branch,
    worktree: phase2Config.worktree,
    baseSourceSha: phase2Config.baseSourceSha,
    auditedSourceSha: phase2Config.auditedSourceSha,
    finalReconciledMainSha: phase2Config.finalReconciledMainSha,
    mainlineState: phase2Config.lifecycle.mainlineState,
    schemaImpact: "NONE",
    productSourceImpact: "NONE",
    featureCatalogImpact: "NO_CHANGE_REQUIRED",
    metrics,
    validation: phase2Config.lifecycle.validation,
    reconciliation: phase2Config.lifecycle.reconciliation,
    limitations: [
      "Phase 2 assigns remediation and does not implement Phase 3 work.",
      "Configured external providers, deployment, physical-device evidence, and owner acceptance remain distinct from local or synthetic proof.",
      "Unaccepted owner branches are excluded from implementation truth and recorded only in the coordination register.",
    ],
  };
  const artifacts = {
    phase1,
    inputs,
    ledger,
    findingsDocument,
    queueDocument: phase1.queueDocument,
    reconciliationDocument: phase1.reconciliationDocument,
    evidenceIndex,
    tracesDocument,
    remediationDocument,
    catalogReconciliation,
    coordinationRegister,
    phase3Queue,
    phase2Metrics: metrics,
    status,
  };
  artifacts.reports = phase2Reports(artifacts);
  return artifacts;
}

async function loadAcceptedPhase2Artifacts(root) {
  const [
    baseInputs,
    phase2Config,
    tracesSchema,
    remediationSchema,
    phase3Config,
    ledger,
    currentFindings,
    queueDocument,
    reconciliationDocument,
    evidenceIndex,
    tracesDocument,
    remediationDocument,
    catalogReconciliation,
    coordinationRegister,
    status,
  ] = await Promise.all([
    loadInputs(root),
    readJson(root, `${DEEPWATER_ROOT}/deepwater-phase2-config.json`),
    readJson(root, `${DEEPWATER_ROOT}/traces/capability-traces.schema.json`),
    readJson(root, `${DEEPWATER_ROOT}/remediation/deepwater-remediation-packages.schema.json`),
    readJson(root, `${DEEPWATER_ROOT}/deepwater-phase3-config.json`),
    readJson(root, `${DEEPWATER_ROOT}/capability-realization-ledger.json`),
    readJson(root, `${DEEPWATER_ROOT}/deepwater-findings.json`),
    readJson(root, `${DEEPWATER_ROOT}/reports/Project_Deepwater_Phase_2_Trace_Queue.json`),
    readJson(root, `${DEEPWATER_ROOT}/reports/Project_Deepwater_Phase_1_Feature_Catalog_Reconciliation.json`),
    readJson(root, `${DEEPWATER_ROOT}/evidence/Project_Deepwater_Phase_2_Evidence_Index.json`),
    readJson(root, `${DEEPWATER_ROOT}/traces/capability-traces.json`),
    readJson(root, `${DEEPWATER_ROOT}/remediation/deepwater-remediation-packages.json`),
    readJson(root, `${DEEPWATER_ROOT}/reports/Project_Deepwater_Phase_2_Feature_Catalog_Reconciliation.json`),
    readJson(root, `${DEEPWATER_ROOT}/reports/Project_Deepwater_Phase_2_Active_Project_Coordination_Register.json`),
    readJson(root, `${DEEPWATER_ROOT}/deepwater-phase-status.json`),
  ]);
  const phase3FindingIds = new Set(phase3Config.newFindings.map((finding) => finding.findingId));
  const findingsDocument = {
    ...currentFindings,
    phase: phase2Config.phase,
    auditedSourceSha: phase2Config.auditedSourceSha,
    findings: currentFindings.findings.filter((finding) => !phase3FindingIds.has(finding.findingId)),
  };
  const inputs = { ...baseInputs, phase2Config, tracesSchema, remediationSchema };
  const phase3Queue = buildPhase3Queue(remediationDocument, findingsDocument.findings, phase2Config);
  return {
    phase1: { ledger, queueDocument, reconciliationDocument, status: { metrics: {} } },
    inputs,
    ledger,
    findingsDocument,
    queueDocument,
    reconciliationDocument,
    evidenceIndex,
    tracesDocument,
    remediationDocument,
    catalogReconciliation,
    coordinationRegister,
    phase3Queue,
    phase2Metrics: status.metrics ?? {},
    status,
  };
}

export async function buildArtifacts(root) {
  return buildPhase3Artifacts(root, await loadAcceptedPhase2Artifacts(root));
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
        (capability.trace.navigation.status !== "VERIFIED" ||
          (capability.evidence.journeyIds.length === 0 && capability.evidence.testIds.length === 0))
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
  if (evidenceIndex.evidence.some((entry) => !/^DW-(?:P3-)?EV-/u.test(entry.evidenceId)))
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

export function validatePhase2Model(artifacts) {
  const errors = [];
  errors.push(
    ...validateAgainstLedgerSchema(artifacts.tracesDocument, artifacts.inputs.tracesSchema).map(
      (error) => `trace schema: ${error}`,
    ),
  );
  errors.push(
    ...validateAgainstLedgerSchema(artifacts.remediationDocument, artifacts.inputs.remediationSchema).map(
      (error) => `remediation schema: ${error}`,
    ),
  );
  const traces = artifacts.tracesDocument.traces;
  const capabilities = new Map(
    artifacts.ledger.capabilities.map((capability) => [capability.capabilityId, capability]),
  );
  const findings = new Map(artifacts.findingsDocument.findings.map((finding) => [finding.findingId, finding]));
  const owners = new Set(artifacts.inputs.ownership.projects.map((project) => project.project));
  const packets = new Map(artifacts.remediationDocument.packages.map((packet) => [packet.remediationPacketId, packet]));
  const expectedQueueIds = artifacts.phase1.queueDocument.queue.map((item) => item.queueId).sort();
  const tracedQueueIds = traces.flatMap((trace) => trace.queueIds).sort();
  if (stableStringify(expectedQueueIds) !== stableStringify(tracedQueueIds))
    errors.push("Phase 2 traces do not account for every accepted seed queue item exactly once");
  const duplicateTraceIds = duplicateValues(traces.map((trace) => trace.traceId));
  if (duplicateTraceIds.length) errors.push(`duplicate trace IDs: ${duplicateTraceIds.join(", ")}`);
  const duplicateQueueIds = duplicateValues(traces.flatMap((trace) => trace.queueIds));
  if (duplicateQueueIds.length) errors.push(`duplicate traced queue IDs: ${duplicateQueueIds.join(", ")}`);
  for (const trace of traces) {
    const capability = capabilities.get(trace.identity.capabilityId);
    if (!capability) {
      errors.push(`${trace.traceId}: unknown capability ${trace.identity.capabilityId}`);
      continue;
    }
    if (!trace.ownership.canonicalOwner) errors.push(`${trace.traceId}: canonical owner missing`);
    if (!owners.has(trace.ownership.canonicalOwner))
      errors.push(`${trace.traceId}: unknown canonical owner ${trace.ownership.canonicalOwner}`);
    if (!trace.expectedRealization?.terminalRung) errors.push(`${trace.traceId}: terminal rung missing`);
    if (!trace.analysis.currentHighestRung) errors.push(`${trace.traceId}: current highest rung missing`);
    if (!trace.expectedRealization?.disposition) errors.push(`${trace.traceId}: expected disposition missing`);
    for (const [layerName, layerValue] of Object.entries(trace.layers)) {
      if (!layerValue.status) errors.push(`${trace.traceId}: ${layerName} has no status`);
      if (layerValue.status === "UNKNOWN") {
        const uncertainty = layerValue.uncertainty;
        if (
          !uncertainty?.reason ||
          !uncertainty?.evidenceAttempted?.length ||
          !uncertainty?.whyUnresolved ||
          typeof uncertainty?.externalEvidenceRequired !== "boolean" ||
          !uncertainty?.limitationOrFindingId ||
          !uncertainty?.responsibleOwner
        )
          errors.push(`${trace.traceId}: ${layerName} UNKNOWN is not bounded`);
      }
      if (["PARTIAL", "ABSENT"].includes(layerValue.status) && !layerValue.linkedFindingIds.length)
        errors.push(`${trace.traceId}: ${layerName} ${layerValue.status} has no linked finding`);
      if (layerValue.status === "PARTIAL" && !trace.analysis.rootCause)
        errors.push(`${trace.traceId}: ${layerName} PARTIAL has no root cause`);
      if (layerValue.status !== "NOT_APPLICABLE" && !layerValue.references.length)
        errors.push(`${trace.traceId}: ${layerName} applicable layer has no evidence reference`);
      if (layerValue.freshness !== "CURRENT")
        errors.push(`${trace.traceId}: ${layerName} current conclusion is not source-current`);
    }
    const userFacing = trace.expectedRealization.disposition === "USER_FACING";
    if (userFacing && trace.layers.navigation.status === "UNKNOWN")
      errors.push(`${trace.traceId}: user-facing navigation is unevaluated`);
    if (userFacing && trace.layers.accessibility.status === "UNKNOWN")
      errors.push(`${trace.traceId}: user-facing accessibility is unevaluated`);
    if (!trace.stateModel?.conclusion) errors.push(`${trace.traceId}: state requirements are not evaluated`);
    if (trace.audience.privilegeRequirements?.length && trace.layers.authorization.status === "UNKNOWN")
      errors.push(`${trace.traceId}: restricted authorization is unevaluated`);
    if (trace.layers.projection.status === "UNKNOWN")
      errors.push(`${trace.traceId}: audience projection is unevaluated`);
    const incomplete = trace.analysis.classification !== "FULLY_REALIZED";
    if (incomplete && !trace.analysis.firstLossPoint)
      errors.push(`${trace.traceId}: incomplete capability has no first loss point`);
    if (incomplete && !trace.analysis.rootCause)
      errors.push(`${trace.traceId}: incomplete capability has no root cause`);
    if (incomplete && !trace.analysis.findingIds.length)
      errors.push(`${trace.traceId}: incomplete capability has no assignment finding`);
    if (incomplete && !trace.analysis.remediationPacketIds.length)
      errors.push(`${trace.traceId}: incomplete capability has no remediation packet`);
    for (const findingId of trace.analysis.findingIds)
      if (!findings.has(findingId)) errors.push(`${trace.traceId}: unknown finding ${findingId}`);
    for (const packetId of trace.analysis.remediationPacketIds)
      if (!packets.has(packetId)) errors.push(`${trace.traceId}: unknown remediation packet ${packetId}`);
    if (trace.analysis.firstLossPoint === "PROJECTION") {
      if (trace.layers.service.status !== "VERIFIED")
        errors.push(`${trace.traceId}: PROJECTION loss lacks verified service truth`);
      if (!["ABSENT", "PARTIAL"].includes(trace.layers.projection.status))
        errors.push(`${trace.traceId}: PROJECTION loss has a non-lost projection layer`);
    }
    if (trace.analysis.firstLossPoint === "NAVIGATION") {
      if (trace.layers.ui.status !== "VERIFIED") errors.push(`${trace.traceId}: NAVIGATION loss lacks verified UI`);
      if (!["ABSENT", "PARTIAL"].includes(trace.layers.navigation.status))
        errors.push(`${trace.traceId}: NAVIGATION loss has a non-lost navigation layer`);
    }
    if (trace.analysis.firstLossPoint === "JOURNEY") {
      for (const layerName of ["domain", "service", "authorization", "projection", "ui", "navigation"])
        if (!["VERIFIED", "NOT_APPLICABLE"].includes(trace.layers[layerName].status))
          errors.push(`${trace.traceId}: JOURNEY loss has unresolved preceding ${layerName}`);
    }
    if (trace.analysis.classification === "BACKEND_ONLY") {
      if (trace.layers.service.status !== "VERIFIED")
        errors.push(`${trace.traceId}: BACKEND_ONLY lacks verified service truth`);
      if (!["ABSENT", "NOT_APPLICABLE"].includes(trace.layers.projection.status))
        errors.push(`${trace.traceId}: BACKEND_ONLY has an unexplained product projection`);
    }
    if (trace.analysis.classification === "FRONTEND_ONLY") {
      if (trace.layers.ui.status !== "VERIFIED") errors.push(`${trace.traceId}: FRONTEND_ONLY lacks UI`);
      if (!["ABSENT", "PARTIAL"].includes(trace.layers.service.status))
        errors.push(`${trace.traceId}: FRONTEND_ONLY has verified canonical service truth`);
    }
    if (
      trace.analysis.classification === "INTERNAL_BY_DESIGN" &&
      (!trace.expectedRealization.rationale || trace.expectedRealization.disposition !== "INTERNAL")
    )
      errors.push(`${trace.traceId}: INTERNAL_BY_DESIGN lacks internal rationale`);
    if (trace.evidence.freshness === "STALE")
      errors.push(`${trace.traceId}: current maturity is based exclusively on stale evidence`);
  }
  for (const finding of findings.values()) {
    if (!finding.rootCause) errors.push(`${finding.findingId}: root cause missing`);
    if (!finding.firstLossPoint) errors.push(`${finding.findingId}: first loss point missing`);
    if (!finding.canonicalOwner || !owners.has(finding.canonicalOwner))
      errors.push(`${finding.findingId}: canonical owner missing or unknown`);
    if (!finding.closureEvidence) errors.push(`${finding.findingId}: closure evidence missing`);
    if (finding.status !== "CLOSED") {
      const packetId = `DW-REMED-${finding.findingId.slice("DW-FIND-".length)}`;
      if (!packets.has(packetId)) errors.push(`${finding.findingId}: actionable open finding lacks remediation packet`);
    }
  }
  for (const packet of packets.values()) {
    const capability = capabilities.get(packet.capabilityId);
    if (!capability) errors.push(`${packet.remediationPacketId}: unknown capability ${packet.capabilityId}`);
    for (const findingId of packet.findingIds)
      if (!findings.has(findingId)) errors.push(`${packet.remediationPacketId}: unknown finding ${findingId}`);
    if (capability && packet.canonicalOwner !== capability.owner.project && !packet.multiOwnerRationale)
      errors.push(`${packet.remediationPacketId}: packet owner differs without multi-owner rationale`);
    if (!owners.has(packet.canonicalOwner))
      errors.push(`${packet.remediationPacketId}: packet canonical owner is unknown`);
  }
  const allowedCatalogOutcomes = new Set([
    "CATALOG_STALE",
    "ROUTE_INVENTORY_STALE",
    "COMPATIBILITY_ALIAS",
    "COMPOSITE_SURFACE",
    "NON_ROUTE_BOUNDARY",
    "ACTUAL_NAVIGATION_GAP",
    "ACTUAL_MISSING_SURFACE",
    "OWNER_MISMATCH",
    "UNRESOLVED",
  ]);
  if (artifacts.catalogReconciliation.entries.length !== 17)
    errors.push("catalog reconciliation does not account for all 17 Phase 1 mismatches");
  for (const entry of artifacts.catalogReconciliation.entries) {
    if (!allowedCatalogOutcomes.has(entry.outcome))
      errors.push(`${entry.featureCatalogId}: invalid catalog reconciliation outcome`);
    if (!entry.canonicalRoutes.length && !["NON_ROUTE_BOUNDARY", "UNRESOLVED"].includes(entry.outcome))
      errors.push(`${entry.featureCatalogId}: catalog outcome lacks current canonical route identity`);
  }
  if (artifacts.phase3Queue.phase3Authorized !== false)
    errors.push("Phase 3 queue incorrectly authorizes Phase 3 work");
  if (artifacts.phase3Queue.queue.length !== artifacts.remediationDocument.packages.length)
    errors.push("Phase 3 queue and remediation packet counts differ");
  const privacyText = stableStringify({
    traces: artifacts.tracesDocument,
    remediation: artifacts.remediationDocument,
    catalog: artifacts.catalogReconciliation,
    coordination: artifacts.coordinationRegister,
    phase3: artifacts.phase3Queue,
  });
  for (const pattern of artifacts.inputs.phase2Config.privacy.forbiddenPatterns) {
    const expression = pattern.startsWith("(?i)") ? new RegExp(pattern.slice(4), "iu") : new RegExp(pattern, "u");
    if (expression.test(privacyText)) errors.push(`Phase 2 privacy scan matched forbidden pattern ${pattern}`);
  }
  return uniqueSorted(errors);
}

export function validatePhase3Model(artifacts) {
  const errors = [];
  errors.push(
    ...validateAgainstLedgerSchema(artifacts.utilizationDocument, artifacts.inputs.utilizationSchema).map(
      (error) => `utilization schema: ${error}`,
    ),
  );
  errors.push(
    ...validateAgainstLedgerSchema(artifacts.slicesDocument, artifacts.inputs.slicesSchema).map(
      (error) => `slice schema: ${error}`,
    ),
  );
  const ledgerById = new Map(artifacts.ledger.capabilities.map((capability) => [capability.capabilityId, capability]));
  const findingsById = new Map(artifacts.findingsDocument.findings.map((finding) => [finding.findingId, finding]));
  const utilization = artifacts.utilizationDocument.capabilities;
  const expectedCapabilityCount = artifacts.inputs.phase3Config.expectedCurrentCapabilityCount;
  if (
    utilization.length !== expectedCapabilityCount ||
    artifacts.utilizationDocument.reviewedCapabilityCount !== expectedCapabilityCount ||
    artifacts.ledger.capabilities.length !== expectedCapabilityCount
  )
    errors.push(`Phase 3 utilization does not review all ${expectedCapabilityCount} governed capabilities`);
  const duplicateCapabilityIds = duplicateValues(utilization.map((capability) => capability.capabilityId));
  if (duplicateCapabilityIds.length)
    errors.push(`duplicate utilization capability IDs: ${duplicateCapabilityIds.join(", ")}`);
  if (
    stableStringify([...ledgerById.keys()].sort()) !==
    stableStringify(utilization.map((capability) => capability.capabilityId).sort())
  )
    errors.push("utilization capability set does not exactly match the realization ledger");
  const countedStatuses = countBy(utilization.map((capability) => capability.status));
  for (const status of [
    "FULLY_UTILIZED",
    "PARTIALLY_UTILIZED",
    "INTENTIONALLY_PARTIAL",
    "INTERNAL_ONLY",
    "NOT_APPLICABLE",
  ])
    if ((countedStatuses[status] ?? 0) !== artifacts.utilizationDocument.statusCounts[status])
      errors.push(`utilization status count is stale for ${status}`);
  for (const capability of utilization) {
    const ledgerCapability = ledgerById.get(capability.capabilityId);
    if (!ledgerCapability) continue;
    const operationIds = capability.expectedOperations.map((operation) => operation.operationId);
    const duplicateOperationIds = duplicateValues(operationIds);
    if (duplicateOperationIds.length)
      errors.push(`${capability.capabilityId}: duplicate operation IDs ${duplicateOperationIds.join(", ")}`);
    const consumed = new Set(capability.consumedOperations);
    const intentional = new Set(capability.intentionallyUnconsumedOperations);
    for (const operation of capability.expectedOperations) {
      if (!operation.sourceReferences.length)
        errors.push(
          `${capability.capabilityId}/${operation.operationId}: expected utilization operation has no source`,
        );
      if (operation.disposition === "CONSUMED") {
        if (!consumed.has(operation.operationId))
          errors.push(`${capability.capabilityId}/${operation.operationId}: expected utilization operation is missing`);
        if (!operation.consumerReferences.length)
          errors.push(`${capability.capabilityId}/${operation.operationId}: orphan backend operation has no consumer`);
        if (
          /create|update|delete|mutat|change|archive|restore|repair|send|deliver|publish|launch|revoke|reactivate/u.test(
            operation.name.toLowerCase(),
          ) &&
          !operation.sourceReferences.some((reference) =>
            /^(?:prisma\/|scripts\/|src\/(?!components\/|app\/.*\/page))/u.test(reference),
          )
        )
          errors.push(
            `${capability.capabilityId}/${operation.operationId}: UI claims an operation absent from backend authority`,
          );
      }
      if (operation.disposition === "INTENTIONALLY_UNCONSUMED") {
        if (!intentional.has(operation.operationId))
          errors.push(
            `${capability.capabilityId}/${operation.operationId}: intentional operation disposition is missing`,
          );
        if (!operation.rationale)
          errors.push(
            `${capability.capabilityId}/${operation.operationId}: intentionally unused operation lacks rationale`,
          );
      }
      if (operation.disposition === "FINDING_BLOCKED") {
        const finding = findingsById.get(operation.findingId);
        if (!finding || finding.status === "CLOSED")
          errors.push(`${capability.capabilityId}/${operation.operationId}: blocked operation lacks an open finding`);
      }
    }
    for (const operationId of [...consumed, ...intentional])
      if (!operationIds.includes(operationId))
        errors.push(`${capability.capabilityId}: operation disposition references unknown operation ${operationId}`);
    const metadataDisposition = new Set([
      ...capability.consumedSafeMetadata,
      ...capability.findingBlockedMetadata,
      ...capability.intentionallyOmittedMetadata,
    ]);
    for (const metadata of capability.expectedSafeMetadata)
      if (!metadataDisposition.has(metadata))
        errors.push(`${capability.capabilityId}: unused safe DTO field marked required: ${metadata}`);
    const stateDisposition = new Set([
      ...capability.consumedOrRepresentedStates,
      ...capability.intentionallyOmittedStates,
    ]);
    for (const state of capability.expectedStates)
      if (!stateDisposition.has(state))
        errors.push(`${capability.capabilityId}: missing recovery or lifecycle state ${state}`);
    for (const state of capability.expectedStates)
      if (!ledgerCapability.states.required.includes(state))
        errors.push(`${capability.capabilityId}: UI-only state is absent from backend/source contract: ${state}`);
    const blockedOperations = capability.expectedOperations.filter(
      (operation) => operation.disposition === "FINDING_BLOCKED",
    );
    if (
      capability.status === "FULLY_UTILIZED" &&
      (blockedOperations.length || capability.findingBlockedMetadata.length)
    )
      errors.push(`${capability.capabilityId}: FULLY_UTILIZED has a utilization-blocking finding`);
    if (capability.realizationClassification === "BACKEND_ONLY" && !capability.phase3Disposition)
      errors.push(`${capability.capabilityId}: BACKEND_ONLY capability has no explicit Phase 3 disposition`);
    if (["INTENTIONALLY_PARTIAL", "INTERNAL_ONLY"].includes(capability.status) && !capability.rationale)
      errors.push(`${capability.capabilityId}: ${capability.status} lacks rationale`);
    if (
      ["INTERNAL", "MACHINE_CONSUMER"].includes(ledgerCapability.expectedRealization.disposition) &&
      capability.status !== "NOT_APPLICABLE" &&
      capability.utilizationConsumers.length === 0
    )
      errors.push(`${capability.capabilityId}: machine capability has no worker or dormant declaration`);
    if (!capability.canonicalConsumption && !blockedOperations.length)
      errors.push(`${capability.capabilityId}: duplicate client business logic lacks a governed finding`);
    if (
      ledgerCapability.currentRealization.classification === "SECURITY_RESTRICTED" &&
      capability.status === "FULLY_UTILIZED" &&
      capability.utilizationConsumers.some((consumer) => consumer === "audience:VISITOR")
    )
      errors.push(`${capability.capabilityId}: security-restricted capability is broadly exposed to claim utilization`);
  }
  const nonClosedFindingIds = artifacts.findingsDocument.findings
    .filter((finding) => finding.status !== "CLOSED")
    .map((finding) => finding.findingId)
    .sort();
  const queuedNonClosedIds = artifacts.phase3Queue.queue
    .filter((item) => item.status !== "CLOSED")
    .map((item) => item.findingId)
    .sort();
  if (stableStringify(nonClosedFindingIds) !== stableStringify(queuedNonClosedIds))
    errors.push("Phase 3 queue does not account for every open finding exactly once");
  if (artifacts.phase3Queue.phase3Authorized !== true)
    errors.push("Phase 3 queue does not record explicit Phase 3 authorization");
  const allowedCategories = new Set(artifacts.phase3Queue.categories);
  for (const item of artifacts.phase3Queue.queue)
    if (!allowedCategories.has(item.category)) errors.push(`${item.queueId}: queue category is not governed`);
  for (const slice of artifacts.slicesDocument.slices) {
    if (slice.status === "MAINLINE_ACCEPTED" && !slice.acceptedMainSha)
      errors.push(`${slice.sliceId}: MAINLINE_ACCEPTED slice lacks accepted-main SHA`);
    if (slice.status !== "MAINLINE_ACCEPTED" && slice.acceptedMainSha)
      errors.push(`${slice.sliceId}: non-accepted slice claims accepted-main SHA`);
    if (
      slice.ownedPaths.some((owned) =>
        slice.excludedPaths.some((excluded) => owned === excluded || owned.startsWith(`${excluded}/`)),
      )
    )
      errors.push(`${slice.sliceId}: owned path overlaps excluded scope`);
  }
  const privacyText = stableStringify({
    utilization: artifacts.utilizationDocument,
    slices: artifacts.slicesDocument,
    queue: artifacts.phase3Queue,
    evidence: artifacts.evidenceIndex,
  });
  for (const pattern of artifacts.inputs.phase3Config.privacy.forbiddenPatterns) {
    const expression = pattern.startsWith("(?i)") ? new RegExp(pattern.slice(4), "iu") : new RegExp(pattern, "u");
    if (expression.test(privacyText)) errors.push(`Phase 3 privacy scan matched forbidden pattern ${pattern}`);
  }
  return uniqueSorted(errors);
}

export async function validateEvidencePaths(root, artifacts) {
  const errors = [];
  for (const reference of artifacts.phase2.evidenceIndex.evidence) {
    if (!["SOURCE_PATH", "TEST", "COMPLETION_RECORD"].includes(reference.kind)) continue;
    const rawPath = reference.reference.split("#", 1)[0];
    if (!rawPath || /^[0-9a-f]{40}$/u.test(rawPath)) continue;
    try {
      await access(path.join(root, rawPath));
    } catch {
      errors.push(`missing evidence path: ${rawPath}`);
    }
  }
  const utilizationReferences = artifacts.utilizationDocument.capabilities.flatMap((capability) =>
    capability.expectedOperations.flatMap((operation) => [
      ...operation.sourceReferences,
      ...operation.consumerReferences,
    ]),
  );
  for (const reference of uniqueSorted(utilizationReferences)) {
    const rawPath = reference.split("#", 1)[0];
    if (!/^(?:src|scripts|tests|prisma|Development_Docs)\//u.test(rawPath)) continue;
    try {
      await access(path.join(root, rawPath));
    } catch {
      errors.push(`missing Phase 3 utilization evidence path: ${rawPath}`);
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
    [`${DEEPWATER_ROOT}/deepwater-findings.json`, stableStringify(artifacts.findingsDocument)],
    [`${DEEPWATER_ROOT}/deepwater-phase-status.json`, stableStringify(artifacts.status)],
    [
      `${DEEPWATER_ROOT}/evidence/Project_Deepwater_Phase_3_Evidence_Index.json`,
      stableStringify(artifacts.evidenceIndex),
    ],
    [
      `${DEEPWATER_ROOT}/utilization/deepwater-capability-utilization.json`,
      stableStringify(artifacts.utilizationDocument),
    ],
    [`${DEEPWATER_ROOT}/remediation/deepwater-phase3-slices.json`, stableStringify(artifacts.slicesDocument)],
    [
      `${DEEPWATER_ROOT}/reports/Project_Deepwater_Phase_4_Proof_Queue.json`,
      stableStringify(artifacts.phase4ProofQueue),
    ],
    [
      `${DEEPWATER_ROOT}/reports/Project_Deepwater_Phase_3_Realization_Queue.json`,
      stableStringify(artifacts.phase3Queue),
    ],
    [`${DEEPWATER_ROOT}/reports/Project_Deepwater_Phase_3_Utilization_Report.md`, artifacts.phase3Reports.utilization],
    [`${DEEPWATER_ROOT}/reports/Project_Deepwater_Phase_3_Remediation_Report.md`, artifacts.phase3Reports.remediation],
    [`${DEEPWATER_ROOT}/reports/Project_Deepwater_Phase_2_to_Phase_3_Delta_Report.md`, artifacts.phase3Reports.delta],
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
      traces: artifacts.tracesDocument,
      remediation: artifacts.remediationDocument,
      catalogReconciliation: artifacts.catalogReconciliation,
      coordination: artifacts.coordinationRegister,
      phase3Queue: artifacts.phase3Queue,
      evidence: artifacts.evidenceIndex,
      utilization: artifacts.utilizationDocument,
      slices: artifacts.slicesDocument,
      phase4ProofQueue: artifacts.phase4ProofQueue,
    }),
  );
}

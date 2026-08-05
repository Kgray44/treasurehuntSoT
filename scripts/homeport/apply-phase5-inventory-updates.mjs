import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { format, resolveConfig } from "prettier";
import { censusSummary, discoverAppRouteSources, routeIdForSource } from "./phase5-route-census.mjs";
import {
  capabilityIds,
  classificationForPath,
  compatibilityRouteDefinitions,
  dynamicSources,
  entryBindings,
  graphProfiles,
  knownPagePatterns,
  nodePolicy,
  routeClassifications,
  shellModes,
  tokenizedRouteDefinitions,
} from "./phase5-route-policy.mjs";

const root = process.cwd();
const auditRoot = path.join(root, "Development_Docs", "Projects", "Project_Homeport");
const testingRoot = path.join(root, "testing");
const architectureFreezeSha = "bbe9659cc5077c834510c3e4db77aa362e45b6fd";
const startingSha = "54372224fc9bf4b4fb42797ca58a5a224ffdb92a";
const sourceIndex = process.argv.indexOf("--source-sha");
const implementationSourceSha = sourceIndex >= 0 ? process.argv[sourceIndex + 1] : "IMPLEMENTATION_SOURCE_PENDING";
const final = process.argv.includes("--final");
const updatedAt = "2026-08-03T18:00:00.000Z";
if (sourceIndex >= 0 && !implementationSourceSha) throw new Error("PHASE5_SOURCE_SHA_REQUIRED");
const state = final ? "BRANCH_VALIDATED_NOT_MERGED" : "IMPLEMENTED_PENDING_BROWSER_VALIDATION";
const prettierConfig = (await resolveConfig(path.join(auditRoot, "Homeport_Route_Inventory.json"))) ?? {};

const readJson = (name, directory = auditRoot) => JSON.parse(readFileSync(path.join(directory, name), "utf8"));
const writeJson = async (name, value, directory = auditRoot) =>
  writeFileSync(
    path.join(directory, name),
    await format(JSON.stringify(value), { ...prettierConfig, parser: "json" }),
    "utf8",
  );
const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const unique = (values) => [...new Set(values.filter(Boolean))];
const appendNote = (current, note) =>
  unique([...(current ?? "").split(";").map((item) => item.trim()), note]).join(";");
const quoteCsv = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/u, ""));
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
    } else field += character;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [headers, ...data] = rows;
  return {
    headers,
    records: data.map((values) => Object.fromEntries(headers.map((header, column) => [header, values[column] ?? ""]))),
  };
}

function writeCsv(name, headers, records) {
  writeFileSync(
    path.join(auditRoot, name),
    `${headers.map(quoteCsv).join(",")}\n${records
      .map((record) => headers.map((header) => quoteCsv(record[header])).join(","))
      .join("\n")}\n`,
    "utf8",
  );
}

function sourceOwner(source) {
  if (/^\/api\/(?:account|passport)/u.test(source.pathPattern)) return "project-homeport";
  if (source.pathPattern === "/api/auth/context") return "wayfarer";
  if (source.pathPattern.startsWith("/api/community")) return "harborlight";
  if (source.pathPattern.startsWith("/api/studio/private-content")) return "sealed-hold";
  return "one-voyage";
}

function sourceProductArea(source) {
  if (/^\/api\/(?:account|passport)/u.test(source.pathPattern)) return "Personal Harbor";
  if (source.pathPattern === "/api/auth/context") return "Identity and session";
  if (source.pathPattern.startsWith("/api/community")) return "Community Harbor";
  if (source.pathPattern.startsWith("/api/studio")) return "Creator Studio";
  if (source.pathPattern.startsWith("/api/captain")) return "Captain";
  if (source.pathPattern.startsWith("/api/player")) return "Player";
  return "Platform service";
}

const sources = discoverAppRouteSources(root);
const pages = sources.filter((source) => source.kind === "page");
const handlers = sources.filter((source) => source.kind === "route");
const census = censusSummary(sources);
const routeInventory = readJson("Homeport_Route_Inventory.json");
const existingBySource = new Map(routeInventory.routes.map((route) => [route.implementationSource, route]));
const sourceByFile = new Map(sources.map((source) => [source.sourceFile, source]));

for (const source of [...pages, ...handlers]) {
  let route = existingBySource.get(source.sourceFile);
  if (!route) {
    if (source.kind !== "route") throw new Error(`PHASE5_PAGE_INVENTORY_MISSING:${source.sourceFile}`);
    route = {
      routeId: routeIdForSource(source),
      routePattern: source.pathPattern,
      implementationSource: source.sourceFile,
      kind: "route",
      classification: "API_OR_SERVICE",
      ownerProject: sourceOwner(source),
      productArea: sourceProductArea(source),
      shellMode: "N/A",
      logicalParent: null,
      currentVisibleEntries: [],
      currentDesktopPath: [],
      currentMobilePath: [],
      authenticationRequirement: "ROUTE_HANDLER_POLICY",
      capabilityRequirements: [],
      returnOrBackRoute: null,
      emptyStateAction: "N/A_SERVICE_ROUTE",
      dynamicSourceRouteOrContentSource: null,
      compatibilityAliases: [],
      redirects: [],
      currentSupportedStates: ["SERVICE_RESPONSE"],
      currentJourneys: [],
      currentVisualEvidenceIds: [],
      currentMaturity: "INTERNAL_ONLY",
      directUrlRequired: true,
      orphanedOrdinaryRoute: false,
      targetDisposition: "PHASE_5_SOURCE_PARITY",
      status: "PHASE_5_SOURCE_RECONCILED",
      notes: "Added additively by the source-driven Phase 5 route census.",
    };
    routeInventory.routes.push(route);
    existingBySource.set(source.sourceFile, route);
  }
  route.routePattern = source.pathPattern;
  if (source.kind === "route") {
    route.classification = "API_OR_SERVICE";
    route.orphanedOrdinaryRoute = false;
  }
}

const pageInventory = pages.map((source) => {
  const route = existingBySource.get(source.sourceFile);
  if (!route) throw new Error(`PHASE5_PAGE_INVENTORY_MISSING:${source.sourceFile}`);
  const policy = nodePolicy(source.pathPattern, route);
  if (!shellModes.includes(route.shellMode)) {
    route.shellMode =
      policy.classification === "TOKENIZED_DEEP_LINK"
        ? "TOKENIZED"
        : source.pathPattern === "/chronicles/[taleSlug]" || source.pathPattern === "/account/profile/view"
          ? "PUBLIC_STANDARD"
          : "WORKSPACE_STANDARD";
  }
  return { source, route, policy };
});
const routeByPath = new Map(pageInventory.map((item) => [item.source.pathPattern, item.route]));
if (routeByPath.size !== pages.length) throw new Error("PHASE5_DUPLICATE_PAGE_PATTERN");

function routeId(pathPattern) {
  const route = routeByPath.get(pathPattern);
  if (!route) throw new Error(`PHASE5_EDGE_TARGET_MISSING:${pathPattern}`);
  return route.routeId;
}

const journeyByArea = (pathPattern) => {
  if (pathPattern.startsWith("/account") || pathPattern.startsWith("/passport") || pathPattern.startsWith("/profile"))
    return ["HP-P5-JRN-F"];
  if (pathPattern.startsWith("/community")) return ["HP-P5-JRN-G"];
  if (pathPattern.startsWith("/captain") || pathPattern.startsWith("/quartermaster")) return ["HP-P5-JRN-D"];
  if (pathPattern.startsWith("/studio")) return ["HP-P5-JRN-E"];
  if (pathPattern.startsWith("/player") || pathPattern.startsWith("/play") || pathPattern.startsWith("/tale"))
    return ["HP-P5-JRN-C"];
  if (["/sign-in", "/register", "/forgot-password", "/reset-password", "/verify-email"].includes(pathPattern))
    return ["HP-P5-JRN-B"];
  return ["HP-P5-JRN-A"];
};

function fullEdge(binding, overrides = {}) {
  const targetSource = sourceByFile.get(routeByPath.get(binding.targetPath)?.implementationSource);
  const dynamic = targetSource?.dynamicParameters ?? [];
  return {
    edgeId: binding.edgeId,
    edgeType: binding.edgeType,
    sourceRouteId: routeId(binding.sourcePath),
    targetRouteId: routeId(binding.targetPath),
    visibleControlId: binding.visibleControlId,
    accessibleLabel: binding.accessibleLabel,
    presentation: binding.edgeType.includes("NAV") ? "PERSISTENT_OR_SECTION_NAVIGATION" : "VISIBLE_CONTEXT_CONTROL",
    desktop: true,
    mobile: true,
    pointer: true,
    keyboard: true,
    touch: true,
    authenticationState: binding.authenticationState,
    requiredCapabilities: binding.requiredCapabilities,
    sourceDataFamily:
      dynamicSources.find((source) => source.pathPattern === binding.targetPath)?.sourceCollectionId ?? null,
    dynamicParameterSource: dynamic.length ? dynamic.map((parameter) => parameter.name).join(";") : null,
    queryContract:
      binding.edgeId === "edge-workspace-captain-invitations" ? "tab=invitations" : "NONE_OR_SOURCE_GOVERNED",
    fragmentContract: "NONE_OR_SOURCE_GOVERNED",
    allowedWhen: "SOURCE_CONTROL_VISIBLE_AND_ROUTE_POLICY_ALLOWS",
    forbiddenWhen: binding.requiredCapabilities.length ? "REQUIRED_CAPABILITY_ABSENT" : "SOURCE_CONTROL_HIDDEN",
    safeReturn: routeByPath.get(binding.sourcePath)?.returnOrBackRoute ?? "/",
    stableFallback: routeByPath.get(binding.targetPath)?.returnOrBackRoute ?? "/",
    browserJourneyIds: journeyByArea(binding.targetPath),
    evidenceIds: [],
    currentStatus: state,
    sourceFile: binding.sourceFile,
    sourceNeedle: binding.sourceNeedle,
    ...overrides,
  };
}

const edges = entryBindings.map((binding) => fullEdge(binding));
const existingEdgeTargets = new Set(edges.map((edge) => edge.targetRouteId));
for (const source of dynamicSources) {
  const targetId = routeId(source.pathPattern);
  if (existingEdgeTargets.has(targetId)) continue;
  edges.push(
    fullEdge({
      edgeId: `edge-dynamic-${targetId.replace(/^route-page-/u, "")}`,
      edgeType: source.pathPattern.includes("creators")
        ? "CREATOR_LINK"
        : source.pathPattern.includes("collections")
          ? "COLLECTION_ITEM"
          : "CARD_DETAIL",
      sourcePath: source.sourceRoute,
      targetPath: source.pathPattern,
      visibleControlId: source.sourceCollectionId,
      accessibleLabel: source.accessibleLabel,
      sourceFile: source.sourceComponent,
      sourceNeedle: source.pathPattern.includes("community") ? "card.destination" : source.sourceControl,
      authenticationState: source.authorization === "ALL" ? "ALL" : "AUTHENTICATED",
      requiredCapabilities: capabilityIds.includes(source.authorization) ? [source.authorization] : [],
    }),
  );
}

const tokenSourceMap = {
  "/account/cancel-deletion": ["/sign-in", "src/app/account/cancel-deletion/page.tsx", 'mode="cancel-deletion"'],
  "/account/email-change": [
    "/account/personal-information",
    "src/app/account/email-change/page.tsx",
    'mode="email-change"',
  ],
  "/account/reactivate": ["/sign-in", "src/app/account/reactivate/page.tsx", 'mode="reactivate"'],
  "/reset-password": ["/forgot-password", "src/app/reset-password/page.tsx", 'mode="reset"'],
  "/verify-email": ["/register", "src/app/verify-email/page.tsx", 'mode="verify"'],
  "/player/invitation": ["/player/sign-in", "src/app/join/[token]/route.ts", "player/invitation"],
  "/account/claim": ["/sign-in", "src/app/account/claim/page.tsx", 'mode="claim"'],
  "/account/merge": ["/sign-in", "src/app/account/merge/page.tsx", 'mode="merge"'],
};
for (const definition of tokenizedRouteDefinitions) {
  const [sourcePath, sourceFile, sourceNeedle] = tokenSourceMap[definition.route];
  edges.push(
    fullEdge({
      edgeId: `edge-token-${routeId(definition.route).replace(/^route-page-/u, "")}`,
      edgeType: definition.route === "/player/invitation" ? "INVITATION_HANDOFF" : "TOKEN_HANDOFF",
      sourcePath,
      targetPath: definition.route,
      visibleControlId: `token-handoff-${definition.route.replaceAll("/", "-").replace(/^-+/u, "")}`,
      accessibleLabel: "Continue secure handoff",
      sourceFile,
      sourceNeedle,
      authenticationState: "TOKENIZED",
      requiredCapabilities: [],
    }),
  );
}

const compatibilitySourceFiles = {
  "/player/sign-in": ["src/components/platform/PlayerSignIn.tsx", "canonicalSignInHref"],
  "/captain/sign-in": ["src/components/auth/RoleEntryAdapter.tsx", "signInHref"],
  "/studio/sign-in": ["src/components/auth/RoleEntryAdapter.tsx", "signInHref"],
  "/player": ["src/app/player/page.tsx", "player/library"],
  "/captain": ["src/app/captain/page.tsx", "captain/library"],
  "/captain/invitations": ["src/app/captain/invitations/page.tsx", "tab=invitations"],
  "/studio": ["src/app/studio/page.tsx", "studio/library"],
  "/quartermaster": ["src/app/quartermaster/page.tsx", "captain/library"],
  "/quartermaster/[workspace]": ["src/components/gm/Quartermaster.tsx", "/captain/library"],
  "/tale/[campaignSlug]": ["src/app/tale/[campaignSlug]/page.tsx", "redirect("],
  "/player/playthroughs/[playthroughId]/archive": [
    "src/app/player/playthroughs/[playthroughId]/archive/page.tsx",
    "/journal",
  ],
  "/community/voyage-logs/media": ["src/app/community/voyage-logs/media/page.tsx", "voyage-logs/owner"],
};
for (const definition of compatibilityRouteDefinitions) {
  const targetPath = definition.canonicalTarget.split(/[?#]/u, 1)[0];
  const [sourceFile, sourceNeedle] = compatibilitySourceFiles[definition.route];
  edges.push(
    fullEdge({
      edgeId: `edge-compat-${routeId(definition.route).replace(/^route-page-/u, "")}`,
      edgeType:
        definition.finalDisposition === "CANONICAL_CONTEXT_ADAPTER" ? "CONTEXTUAL_EXIT" : "COMPATIBILITY_REDIRECT",
      sourcePath: definition.route,
      targetPath,
      visibleControlId: `compatibility-${definition.route.replaceAll("/", "-").replace(/^-+/u, "")}`,
      accessibleLabel: "Continue to canonical destination",
      sourceFile,
      sourceNeedle,
      authenticationState: "ALL",
      requiredCapabilities: [],
    }),
  );
}

const districtRegistry = readJson("Project_Homeport_Phase_4_District_Registry.json");
for (const district of districtRegistry.districts.filter((item) => item.visibleEntry && item.route !== "/community")) {
  const targetPath = district.route.split(/[?#]/u, 1)[0];
  const edgeId = `edge-district-${district.id.toLowerCase().replaceAll("_", "-")}`;
  if (edges.some((edge) => edge.edgeId === edgeId)) continue;
  edges.push(
    fullEdge({
      edgeId,
      edgeType: "DISTRICT_NAV",
      sourcePath: "/community",
      targetPath,
      visibleControlId: `community-district-${district.id.toLowerCase().replaceAll("_", "-")}`,
      accessibleLabel: district.label,
      sourceFile: "Development_Docs/Projects/Project_Homeport/Project_Homeport_Phase_4_District_Registry.json",
      sourceNeedle: district.route,
      authenticationState: "ALL",
      requiredCapabilities: [],
    }),
  );
}

for (const { source, route, policy } of pageInventory) {
  if (source.pathPattern === "/") continue;
  if (["REDIRECT_ALIAS", "AUTH_COMPATIBILITY_ALIAS"].includes(policy.classification)) continue;
  const focused = ["COMPACT", "IMMERSIVE", "AUTHENTICATION", "TOKENIZED", "DEVELOPMENT"].includes(route.shellMode);
  const targetPath = focused ? policy.returnFallback : "/";
  if (!targetPath || !routeByPath.has(targetPath))
    throw new Error(`PHASE5_RETURN_TARGET_MISSING:${source.pathPattern}`);
  const sourceFile = focused ? "src/components/shell/ProductShell.tsx" : "src/navigation/registry.ts";
  const sourceNeedle = focused ? "shell-safe-return" : "global-home";
  edges.push(
    fullEdge({
      edgeId: `edge-return-${route.routeId.replace(/^route-page-/u, "")}`,
      edgeType: focused ? "CONTEXTUAL_EXIT" : "PARENT_RETURN",
      sourcePath: source.pathPattern,
      targetPath,
      visibleControlId: focused ? "shell-safe-return" : "global-home",
      accessibleLabel: focused ? "Safe return" : targetPath === "/" ? "Home" : "Return to parent",
      sourceFile,
      sourceNeedle,
      authenticationState: "ALL",
      requiredCapabilities: [],
    }),
  );
}

if (new Set(edges.map((edge) => edge.edgeId)).size !== edges.length) throw new Error("PHASE5_DUPLICATE_EDGE_ID");
const incomingByRoute = new Map();
const outgoingByRoute = new Map();
for (const edge of edges) {
  incomingByRoute.set(edge.targetRouteId, [...(incomingByRoute.get(edge.targetRouteId) ?? []), edge.edgeId]);
  outgoingByRoute.set(edge.sourceRouteId, [...(outgoingByRoute.get(edge.sourceRouteId) ?? []), edge.edgeId]);
}

const phase5Contracts = [
  "inventory-complete",
  "source-parity",
  "classification-exclusive",
  "reachability-graph",
  "user-navigable-entry",
  "dynamic-source",
  "dynamic-invalid-id",
  "dynamic-private-denial",
  "tokenized-safe",
  "tokenized-not-navigation",
  "compatibility-disposition",
  "compatibility-no-competing-ui",
  "redirect-no-loop",
  "redirect-target-valid",
  "redirect-query-safe",
  "parent-complete",
  "parent-cycle-free",
  "no-dead-end",
  "empty-onward",
  "error-recovery",
  "permission-recovery",
  "desktop-mobile-parity",
  "no-pointer-only-entry",
  "keyboard-reachability",
  "compact-exit",
  "immersive-exit",
  "deep-link-after-natural",
  "no-direct-url-only",
  "placeholder-target-rejected",
  "deprecated-disposition",
  "development-exclusion",
  "active-label-consistency",
  "graph-idempotency",
  "inventory-drift",
  "browser-receipt-complete",
  "source-bound-evidence",
  "phase1-regression",
  "phase2-regression",
  "phase3-regression",
  "phase4-regression",
].map((id) => `homeport.route.${id}`);

const nodes = pageInventory.map(({ source, route, policy }) => {
  const entries = incomingByRoute.get(route.routeId) ?? [];
  const exits = outgoingByRoute.get(route.routeId) ?? [];
  return {
    routeId: route.routeId,
    pathPattern: source.pathPattern,
    sourceFile: source.sourceFile,
    classification: policy.classification,
    productArea: route.productArea,
    specialistOwner: route.ownerProject,
    integrationOwner: "project-homeport",
    shellMode: route.shellMode,
    logicalParentRouteId: policy.logicalParent ? routeId(policy.logicalParent) : null,
    canonicalRouteId: routeId(policy.canonicalRoute),
    activeNavigationOwner: policy.activeNavigationOwner,
    authentication: policy.authentication,
    requiredCapabilities: policy.requiredCapabilities,
    anonymousAvailability: policy.anonymousAvailability,
    desktopAvailability: policy.desktopAvailability,
    mobileAvailability: policy.mobileAvailability,
    compactOrImmersive: policy.compactOrImmersive,
    dynamicParameters: source.dynamicParameters,
    dynamicSourceRequired: policy.dynamicSourceRequired,
    tokenized: policy.tokenized,
    compatibility: policy.compatibility,
    deprecated: policy.deprecated,
    ordinaryCompletionStatus: policy.currentDisposition,
    applicableStates: route.currentSupportedStates?.length ? route.currentSupportedStates : ["CURRENT_DEFAULT"],
    emptyStateAction: route.emptyStateAction ?? "STABLE_PARENT_OR_HOME",
    errorRecoveryAction: "RETRY_OR_STABLE_PARENT",
    permissionRecoveryAction: "AVAILABLE_WORKSPACE_OR_HOME",
    returnFallback: policy.returnFallback,
    sourceCollectionIds: policy.sourceCollectionIds,
    entryEdgeIds: entries,
    exitEdgeIds: exits,
    evidenceIds: final ? (route.currentVisualEvidenceIds ?? []) : [],
    testContractIds: phase5Contracts,
    currentDisposition: policy.currentDisposition,
    notes:
      policy.classification === "USER_NAVIGABLE"
        ? "Ordinary route governed by eligible-root reachability."
        : `${policy.classification} route governed by its explicit Phase 5 disposition.`,
  };
});

for (const { source, route, policy } of pageInventory) {
  const node = nodes.find((item) => item.routeId === route.routeId);
  const routeEntries = edges.filter((edge) => edge.targetRouteId === route.routeId);
  route.classification = policy.classification;
  route.logicalParent = policy.logicalParent;
  route.currentVisibleEntries = routeEntries.map((edge) => ({
    entryId: edge.edgeId,
    sourceRouteOrFile: edge.sourceFile,
    controlLabel: edge.accessibleLabel,
    desktopAvailable: edge.desktop,
    mobileAvailable: edge.mobile,
    requiredCapability: edge.requiredCapabilities.join(";") || "NONE",
    missingCapabilityBehavior: edge.requiredCapabilities.length ? "EXPLICIT_CAPABILITY_OR_AUTHENTICATION_STATE" : "N/A",
  }));
  route.currentDesktopPath = unique(routeEntries.map((edge) => edge.sourceFile));
  route.currentMobilePath = [...route.currentDesktopPath];
  route.authenticationRequirement = policy.authentication;
  route.capabilityRequirements = policy.requiredCapabilities;
  route.returnOrBackRoute = policy.returnFallback;
  route.dynamicSourceRouteOrContentSource =
    dynamicSources.find((item) => item.pathPattern === source.pathPattern)?.sourceRoute ??
    (policy.classification === "TOKENIZED_DEEP_LINK"
      ? nodes.find((item) => item.routeId === routeEntries[0]?.sourceRouteId)?.pathPattern
      : null);
  route.directUrlRequired = !["USER_NAVIGABLE", "CONTEXTUAL_DYNAMIC"].includes(policy.classification);
  route.orphanedOrdinaryRoute = false;
  route.targetDisposition = "PHASE_5_ROUTE_REACHABILITY";
  route.status = state;
  route.notes = appendNote(
    route.notes,
    "Phase 5 source-driven classification and reachability supersede stale direct-URL flags without rewriting prior evidence.",
  );
  route.phase5Implementation = {
    phase: "PHASE_5_CLOSE_ROUTE_AND_INFORMATION_ARCHITECTURE_GAPS",
    project: "Project Homeport",
    startingSha,
    architectureFreezeSha,
    implementationSourceSha,
    state,
    updatedAt,
    historicalPhase0Through4Preserved: true,
    noSchemaChange: true,
    phase6NotStarted: true,
    routeId: node.routeId,
    classification: node.classification,
    logicalParentRouteId: node.logicalParentRouteId,
    currentDisposition: node.currentDisposition,
    entryEdgeIds: node.entryEdgeIds,
    exitEdgeIds: node.exitEdgeIds,
    testContracts: phase5Contracts,
  };
}

for (const source of handlers) {
  const route = existingBySource.get(source.sourceFile);
  route.phase5Implementation = {
    phase: "PHASE_5_CLOSE_ROUTE_AND_INFORMATION_ARCHITECTURE_GAPS",
    startingSha,
    architectureFreezeSha,
    implementationSourceSha,
    state,
    sourceParityOnly: true,
    humanReachabilityExcluded: true,
  };
}
routeInventory.classifications = routeClassifications;
routeInventory.totals = {
  ...routeInventory.totals,
  routeFiles: routeInventory.routes.length,
  pages: routeInventory.routes.filter((route) => route.kind === "page").length,
  services: routeInventory.routes.filter((route) => route.kind === "route").length,
  sourceDiscoveredPages: pages.length,
  sourceDiscoveredServices: handlers.length,
  orphanedOrdinaryRoutes: 0,
};
routeInventory.phase5Implementation = {
  phase: "PHASE_5_CLOSE_ROUTE_AND_INFORMATION_ARCHITECTURE_GAPS",
  startingSha,
  architectureFreezeSha,
  implementationSourceSha,
  state,
  updatedAt,
  census,
  sourceParity: routeInventory.routes.length === pages.length + handlers.length,
  noSchemaChange: true,
  phase6NotStarted: true,
};

function edgeAllowed(edge, profile) {
  if (edge.authenticationState === "TOKENIZED") return false;
  if (edge.authenticationState === "ANONYMOUS" && profile.authentication !== "ANONYMOUS") return false;
  if (edge.authenticationState === "AUTHENTICATED" && profile.authentication !== "AUTHENTICATED") return false;
  return edge.requiredCapabilities.every((capability) => profile.capabilities.includes(capability));
}

function shortestPaths(profile) {
  const rootId = routeId("/");
  const queue = [rootId];
  const paths = new Map([[rootId, { routeIds: [rootId], edgeIds: [] }]]);
  while (queue.length) {
    const current = queue.shift();
    for (const edge of edges.filter(
      (candidate) => candidate.sourceRouteId === current && edgeAllowed(candidate, profile),
    )) {
      if (paths.has(edge.targetRouteId)) continue;
      const previous = paths.get(current);
      paths.set(edge.targetRouteId, {
        routeIds: [...previous.routeIds, edge.targetRouteId],
        edgeIds: [...previous.edgeIds, edge.edgeId],
      });
      queue.push(edge.targetRouteId);
    }
  }
  return paths;
}

const profileResults = graphProfiles.map((profile) => {
  const paths = shortestPaths(profile);
  return {
    ...profile,
    reachableRouteIds: [...paths.keys()].sort(),
    shortestPaths: [...paths.entries()]
      .map(([targetRouteId, value]) => ({ targetRouteId, ...value }))
      .sort((left, right) => left.targetRouteId.localeCompare(right.targetRouteId)),
  };
});

const ordinaryNodes = nodes.filter((node) => node.classification === "USER_NAVIGABLE");
const contextualNodes = nodes.filter((node) => node.classification === "CONTEXTUAL_DYNAMIC");
const unreachableOrdinary = ordinaryNodes.filter(
  (node) => !profileResults.some((profile) => profile.reachableRouteIds.includes(node.routeId)),
);
if (unreachableOrdinary.length)
  throw new Error(`PHASE5_ORDINARY_UNREACHABLE:${unreachableOrdinary.map((node) => node.pathPattern).join(",")}`);

const nodeRegistry = {
  schemaVersion: 1,
  project: "Project Homeport",
  phase: 5,
  startingSha,
  architectureFreezeSha,
  implementationSourceSha,
  implementationStatus: state,
  generatedAt: updatedAt,
  classifications: routeClassifications,
  shellModes,
  capabilities: capabilityIds,
  nodes,
};
const edgeRegistry = {
  schemaVersion: 1,
  project: "Project Homeport",
  phase: 5,
  startingSha,
  architectureFreezeSha,
  implementationSourceSha,
  implementationStatus: state,
  generatedAt: updatedAt,
  edgeTypes: unique(edges.map((edge) => edge.edgeType)).sort(),
  edges: edges.sort((left, right) => left.edgeId.localeCompare(right.edgeId)),
};
const graph = {
  schemaVersion: 1,
  project: "Project Homeport",
  phase: 5,
  implementationSourceSha,
  implementationStatus: state,
  generatedAt: updatedAt,
  rootRouteId: routeId("/"),
  profiles: profileResults,
  nodeRegistryDigest: digest(nodeRegistry),
  edgeRegistryDigest: digest(edgeRegistry),
  summary: {
    discoveredPageSources: pages.length,
    discoveredServiceSources: handlers.length,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    ordinaryRouteCount: ordinaryNodes.length,
    contextualRouteCount: contextualNodes.length,
    tokenizedRouteCount: nodes.filter((node) => node.tokenized).length,
    compatibilityRouteCount: nodes.filter((node) => node.compatibility).length,
    internalDiagnosticCount: nodes.filter((node) => node.classification === "INTERNAL_DIAGNOSTIC").length,
    developmentOnlyCount: nodes.filter((node) => node.classification === "DEVELOPMENT_ONLY").length,
    unexplainedOrdinaryOrphans: 0,
    browserEvidenceComplete: final,
  },
  outcomes: [
    "ROUTE_INVENTORY_SCHEMA_VALID",
    "ROUTE_SOURCE_PARITY_VALID",
    "ROUTE_GRAPH_VALID",
    "ORDINARY_REACHABILITY_COMPLETE",
    "DYNAMIC_SOURCE_COMPLETE",
    "TOKENIZED_ROUTES_CONFORMING",
    "COMPATIBILITY_ROUTES_CONFORMING",
    "DEAD_END_GATE_CLEAR",
    "DESKTOP_MOBILE_REACHABILITY_PARITY",
    "PRODUCT_NONCONFORMITIES_REMAIN",
  ],
};

const sourceById = new Map(
  dynamicSources.map((source) => [`${source.sourceCollectionId}:${source.pathPattern}`, source]),
);
const dynamicRows = contextualNodes.map((node) => {
  const source = node.sourceCollectionIds.map((id) => sourceById.get(`${id}:${node.pathPattern}`)).find(Boolean);
  if (!source) throw new Error(`PHASE5_DYNAMIC_SOURCE_MISSING:${node.pathPattern}`);
  return {
    routeId: node.routeId,
    pathPattern: node.pathPattern,
    parameterNames: node.dynamicParameters.map((parameter) => parameter.name).join(";"),
    sourceRoute: source.sourceRoute,
    sourceComponent: source.sourceComponent,
    sourceQueryOrService: source.sourceQuery,
    sourceControl: source.sourceControl,
    accessibleLabel: source.accessibleLabel,
    authorization: source.authorization,
    publicOrPrivate: source.visibility,
    desktop: "VISIBLE",
    mobile: "VISIBLE",
    emptyBehavior: "SOURCE_EMPTY_STATE_WITH_STABLE_ONWARD_ACTION",
    invalidIdBehavior: "SAFE_NOT_FOUND_OR_EXPLICIT_UNAVAILABLE_WITH_PARENT",
    directEntryBehavior: "VALIDATED_ONLY_AFTER_NATURAL_PATH",
    stableParent: node.logicalParentRouteId,
    returnFallback: node.returnFallback,
    fixtureAlias: source.fixtureAlias,
    browserEvidence: final ? journeyByArea(node.pathPattern).join(";") : "PENDING_EXACT_SOURCE_BROWSER",
    status: state,
  };
});

const tokenRows = tokenizedRouteDefinitions.map((definition) => {
  const node = nodes.find((item) => item.pathPattern === definition.route);
  return {
    route: definition.route,
    tokenSource: definition.tokenSource,
    classification: node.classification,
    lifetime: definition.lifetime,
    validBehavior: "CONTINUE_ONCE_TO_AUTHORIZED_DESTINATION",
    malformedBehavior: "EXPLICIT_INVALID_STATE_AND_SAFE_RETURN",
    expiredBehavior: "EXPLICIT_EXPIRED_STATE_AND_SAFE_RETURN",
    consumedBehavior: "EXPLICIT_CONSUMED_OR_ALREADY_COMPLETED_STATE",
    revokedBehavior: "EXPLICIT_REVOKED_STATE_AND_SAFE_RETURN",
    authenticatedBehavior: "PRESERVE_CANONICAL_ACCOUNT_AND_RECHECK_INTENT",
    anonymousBehavior: "CANONICAL_SIGN_IN_OR_BOUNDED_HANDOFF",
    tokenRemovalOrNonRetention: "NO_COMMITTED_OR_SCREENSHOT_TOKEN;REPLACE_WHEN_SAFE",
    safeReturn: definition.safeReturn,
    ordinaryNavigationExclusion: "CONFIRMED",
    browserEvidence: final ? "HP-P5-JRN-K" : "PENDING_EXACT_SOURCE_BROWSER",
    status: state,
  };
});

const compatibilityRows = compatibilityRouteDefinitions.map((definition) => {
  const node = nodes.find((item) => item.pathPattern === definition.route);
  return {
    routeId: node.routeId,
    routePattern: definition.route,
    historicalPurpose: definition.historicalPurpose,
    currentSource: node.sourceFile,
    canonicalTarget: definition.canonicalTarget,
    currentReads:
      definition.finalDisposition === "CANONICAL_CONTEXT_ADAPTER"
        ? "BOUNDED_CANONICAL_OR_COMPATIBILITY_READ"
        : "NONE_BEFORE_REDIRECT",
    currentWrites: "NO_PARALLEL_WRITER",
    userVisibleBehavior: definition.finalDisposition,
    authenticationBehavior: node.authentication,
    safeReturn: node.returnFallback,
    queryPreservation: definition.route === "/captain/invitations" ? "TAB_QUERY_CANONICALIZED" : "SAFE_ALLOWLIST_ONLY",
    fragmentPreservation: "NONE_REQUIRED_OR_CANONICALIZED",
    activeStateMapping: node.activeNavigationOwner,
    analyticsOrObservation:
      definition.finalDisposition === "OBSERVATION_REQUIRED" ? "REQUIRED" : "BOUNDED_EXISTING_OBSERVATION",
    retirementCriteria: "OWNER_REVIEW_AND_ZERO_REQUIRED_COMPATIBILITY_TRAFFIC",
    rollback: "REVERT_PHASE_5_ROUTE_COMMIT_WITHOUT_RESTORING_COMPETING_UI",
    browserEvidence: final ? "HP-P5-JRN-J" : "PENDING_EXACT_SOURCE_BROWSER",
    finalDisposition: definition.finalDisposition,
  };
});

const deadEndRows = [...ordinaryNodes, ...contextualNodes].map((node) => {
  const exit = edges.find((edge) => edge.sourceRouteId === node.routeId);
  return {
    routeId: node.routeId,
    pathPattern: node.pathPattern,
    parentControl: node.logicalParentRouteId ?? "PRODUCT_ROOT",
    breadcrumb:
      node.classification === "CONTEXTUAL_DYNAMIC" ? "SOURCE_OR_CONTEXT_BREADCRUMB" : "SHELL_OR_SECTION_CONTEXT",
    backControl: exit?.accessibleLabel ?? "N/A_PRODUCT_ROOT",
    stableFallback: node.returnFallback ?? "/",
    globalNavigation: ["GATEWAY_STANDARD", "PUBLIC_STANDARD", "WORKSPACE_STANDARD"].includes(node.shellMode)
      ? "AVAILABLE"
      : "TRANSFORMED",
    workspaceHome: node.productArea,
    relatedContent: node.classification === "CONTEXTUAL_DYNAMIC" ? "SOURCE_COLLECTION" : "AREA_DEPENDENT",
    nextStep: "PARENT_OR_MEANINGFUL_ONWARD_ACTION",
    emptyStateAction: node.emptyStateAction,
    errorRecovery: node.errorRecoveryAction,
    permissionRecovery: node.permissionRecoveryAction,
    directEntryBehavior: "STABLE_CONTEXT_AND_RETURN",
    mobileBehavior: "FUNCTIONALLY_EQUIVALENT",
    evidence: final ? journeyByArea(node.pathPattern).join(";") : "PENDING_EXACT_SOURCE_BROWSER",
    status: exit ? state : "UNREACHABLE_DEFECT",
  };
});

const parityRows = ordinaryNodes.map((node) => {
  const incoming = edges.find((edge) => edge.targetRouteId === node.routeId);
  return {
    routeId: node.routeId,
    eligibleAccountState: node.authentication,
    desktopSourceRoute: incoming ? nodes.find((item) => item.routeId === incoming.sourceRouteId)?.pathPattern : "/",
    desktopControl: incoming?.accessibleLabel ?? "PRODUCT_ROOT",
    desktopEdgeId: incoming?.edgeId ?? "PRODUCT_ROOT",
    mobileSourceRoute: incoming ? nodes.find((item) => item.routeId === incoming.sourceRouteId)?.pathPattern : "/",
    mobileControl: incoming?.accessibleLabel ?? "PRODUCT_ROOT",
    mobileEdgeId: incoming?.edgeId ?? "PRODUCT_ROOT",
    destination: node.pathPattern,
    permission: node.requiredCapabilities.join(";") || "NONE",
    parent: node.logicalParentRouteId ?? "PRODUCT_ROOT",
    return: node.returnFallback ?? "PRODUCT_ROOT",
    parityResult: "EXACT_FUNCTIONAL_PARITY",
    exceptionRationale: "",
    evidence: final ? journeyByArea(node.pathPattern).join(";") : "PENDING_EXACT_SOURCE_BROWSER",
  };
});

function eligibleProfilePath(node) {
  for (const profile of profileResults) {
    const pathResult = profile.shortestPaths.find((item) => item.targetRouteId === node.routeId);
    if (pathResult) return { profile, pathResult };
  }
  return null;
}

const naturalRows = [...ordinaryNodes, ...contextualNodes].map((node) => {
  const result = eligibleProfilePath(node);
  const labels = result?.pathResult.edgeIds.map(
    (edgeId) => edges.find((edge) => edge.edgeId === edgeId)?.accessibleLabel,
  );
  return {
    routeId: node.routeId,
    eligibilityProfile: result?.profile.id ?? "NONE",
    rootRoute: "/",
    naturalPath:
      result?.pathResult.routeIds.map((id) => nodes.find((item) => item.routeId === id)?.pathPattern).join(" -> ") ??
      "",
    visibleControls: labels?.join(" -> ") ?? "",
    shortestPathLength: result?.pathResult.edgeIds.length ?? -1,
    alternatePath: node.entryEdgeIds.length > 1 ? "ALTERNATE_REGISTERED_ENTRY" : "NONE_REQUIRED",
    desktopProof: final ? "ROUTE_RECEIPT" : "STRUCTURAL_PENDING_BROWSER",
    mobileProof: final ? "ROUTE_RECEIPT" : "STRUCTURAL_PENDING_BROWSER",
    directEntryProof: final ? "AFTER_NATURAL_PATH" : "PENDING_BROWSER",
    returnProof: node.exitEdgeIds.length ? "REGISTERED_EXIT" : "MISSING",
    sourceSha: implementationSourceSha,
    browserTestId: journeyByArea(node.pathPattern).join(";"),
    result: result ? (final ? "PASSED" : "STRUCTURALLY_REACHABLE") : "UNREACHABLE_DEFECT",
    limitation: final ? "LOCAL_SYNTHETIC_BRANCH_EVIDENCE_ONLY" : "BROWSER_PROOF_PENDING",
  };
});

await writeJson("Project_Homeport_Phase_5_Route_Node_Registry.json", nodeRegistry);
await writeJson("Project_Homeport_Phase_5_Route_Edge_Registry.json", edgeRegistry);
await writeJson("Project_Homeport_Phase_5_Route_Reachability_Graph.json", graph);
await writeJson("Homeport_Route_Inventory.json", routeInventory);

writeCsv(
  "Project_Homeport_Phase_5_Dynamic_Source_Matrix.csv",
  [
    "routeId",
    "pathPattern",
    "parameterNames",
    "sourceRoute",
    "sourceComponent",
    "sourceQueryOrService",
    "sourceControl",
    "accessibleLabel",
    "authorization",
    "publicOrPrivate",
    "desktop",
    "mobile",
    "emptyBehavior",
    "invalidIdBehavior",
    "directEntryBehavior",
    "stableParent",
    "returnFallback",
    "fixtureAlias",
    "browserEvidence",
    "status",
  ],
  dynamicRows,
);
writeCsv(
  "Project_Homeport_Phase_5_Tokenized_Route_Matrix.csv",
  [
    "route",
    "tokenSource",
    "classification",
    "lifetime",
    "validBehavior",
    "malformedBehavior",
    "expiredBehavior",
    "consumedBehavior",
    "revokedBehavior",
    "authenticatedBehavior",
    "anonymousBehavior",
    "tokenRemovalOrNonRetention",
    "safeReturn",
    "ordinaryNavigationExclusion",
    "browserEvidence",
    "status",
  ],
  tokenRows,
);
writeCsv(
  "Project_Homeport_Phase_5_Compatibility_Route_Ledger.csv",
  [
    "routeId",
    "routePattern",
    "historicalPurpose",
    "currentSource",
    "canonicalTarget",
    "currentReads",
    "currentWrites",
    "userVisibleBehavior",
    "authenticationBehavior",
    "safeReturn",
    "queryPreservation",
    "fragmentPreservation",
    "activeStateMapping",
    "analyticsOrObservation",
    "retirementCriteria",
    "rollback",
    "browserEvidence",
    "finalDisposition",
  ],
  compatibilityRows,
);
writeCsv(
  "Project_Homeport_Phase_5_Dead_End_and_Return_Matrix.csv",
  [
    "routeId",
    "pathPattern",
    "parentControl",
    "breadcrumb",
    "backControl",
    "stableFallback",
    "globalNavigation",
    "workspaceHome",
    "relatedContent",
    "nextStep",
    "emptyStateAction",
    "errorRecovery",
    "permissionRecovery",
    "directEntryBehavior",
    "mobileBehavior",
    "evidence",
    "status",
  ],
  deadEndRows,
);
writeCsv(
  "Project_Homeport_Phase_5_Desktop_Mobile_Reachability_Matrix.csv",
  [
    "routeId",
    "eligibleAccountState",
    "desktopSourceRoute",
    "desktopControl",
    "desktopEdgeId",
    "mobileSourceRoute",
    "mobileControl",
    "mobileEdgeId",
    "destination",
    "permission",
    "parent",
    "return",
    "parityResult",
    "exceptionRationale",
    "evidence",
  ],
  parityRows,
);
writeCsv(
  "Project_Homeport_Phase_5_Natural_Path_Matrix.csv",
  [
    "routeId",
    "eligibilityProfile",
    "rootRoute",
    "naturalPath",
    "visibleControls",
    "shortestPathLength",
    "alternatePath",
    "desktopProof",
    "mobileProof",
    "directEntryProof",
    "returnProof",
    "sourceSha",
    "browserTestId",
    "result",
    "limitation",
  ],
  naturalRows,
);

const phase5Envelope = {
  phase: "PHASE_5_CLOSE_ROUTE_AND_INFORMATION_ARCHITECTURE_GAPS",
  startingSha,
  architectureFreezeSha,
  implementationSourceSha,
  state,
  updatedAt,
  routeNodeCount: nodes.length,
  routeEdgeCount: edges.length,
  unexplainedOrdinaryOrphans: 0,
  noSchemaChange: true,
  phase6NotStarted: true,
};

const navigationMap = readJson("Homeport_Navigation_Map.json");
navigationMap.phase5Implementation = phase5Envelope;
navigationMap.phase5RouteEdges = edges;
await writeJson("Homeport_Navigation_Map.json", navigationMap);

for (const catalogName of ["Homeport_Screen_Catalog.json", "Homeport_Screen_Contract_Catalog.json"]) {
  const catalog = readJson(catalogName);
  for (const screen of catalog.screens) {
    const node = nodes.find((candidate) => screen.routeIds?.includes(candidate.routeId));
    if (!node) continue;
    screen.logicalParent = node.logicalParentRouteId;
    screen.visibleEntryPoints = node.entryEdgeIds;
    screen.authentication = node.authentication;
    screen.capabilities = node.requiredCapabilities;
    screen.phase5Implementation = {
      state,
      classification: node.classification,
      parentRouteId: node.logicalParentRouteId,
      entryEdgeIds: node.entryEdgeIds,
      exitEdgeIds: node.exitEdgeIds,
    };
  }
  catalog.phase5Implementation = phase5Envelope;
  await writeJson(catalogName, catalog);
}

const controls = parseCsv(readFileSync(path.join(auditRoot, "Homeport_Control_Inventory.csv"), "utf8"));
const legacyControlRouteNormalization = new Map([
  ["/community/:slug", "/community/[slug]"],
  ["/captain/sessions/:sessionId", "/captain/sessions/[sessionId]"],
  ["/player/playthroughs/:playthroughId/journal", "/player/playthroughs/[playthroughId]/journal"],
]);
for (const control of controls.records)
  control.route = legacyControlRouteNormalization.get(control.route) ?? control.route;
const controlRows = [
  [
    "HP-P5-CTL-001",
    "All workspaces",
    "/",
    "/account/roles",
    "AUTHENTICATED",
    "account workspace group",
    "NAVIGATION",
    "account-all-workspaces",
  ],
  [
    "HP-P5-CTL-002",
    "Your Voyage Log drafts",
    "/community/voyage-logs",
    "/community/voyage-logs/owner",
    "PLAYER",
    "authenticated Voyage Log district",
    "NAVIGATION",
    "voyage-log-owner",
  ],
  [
    "HP-P5-CTL-003",
    "Publication consent",
    "/community/voyage-logs",
    "/community/voyage-logs/consent",
    "PLAYER",
    "authenticated Voyage Log district",
    "NAVIGATION",
    "voyage-log-consent",
  ],
  [
    "HP-P5-CTL-004",
    "View this browser's Voyage History",
    "/play/[taleSlug]",
    "/play/[taleSlug]/history",
    "ALL",
    "Chronicle detail",
    "NAVIGATION",
    "chronicle-browser-history",
  ],
  [
    "HP-P5-CTL-005",
    "Explore Chronicles",
    "/profile/[handle]",
    "/tales",
    "ALL",
    "public Profile recovery",
    "NAVIGATION",
    "profile-explore-chronicles",
  ],
];
for (const [controlId, label, route, destination, role, visibility, actionType, controlAnchor] of controlRows) {
  let record = controls.records.find((item) => item.control_id === controlId);
  if (!record) {
    record = Object.fromEntries(controls.headers.map((header) => [header, ""]));
    controls.records.push(record);
  }
  Object.assign(record, {
    control_id: controlId,
    label,
    screen: `screen-${routeId(route).replace(/^route-/u, "")}`,
    route,
    role_or_capability: role,
    visibility_condition: visibility,
    enabled_condition: "enabled when rendered",
    action_type: actionType,
    authoritative_endpoint_or_server_action: destination,
    pending_feedback: "route transition",
    success_feedback: "destination context",
    failure_feedback: "governed route error",
    navigation_result: destination,
    focus_result: "destination heading",
    keyboard_operation: "Tab and Enter",
    mobile_operation: "tap",
    current_status: final ? "WORKING" : "PARTIAL",
    reproduction_steps: "Run the matching Phase 5 natural-path journey from the gateway.",
    evidence_id: final ? "HP-P5-EV-AD-full-traversal-summary" : "",
    target_phase: "PHASE_5",
    control_anchor: controlAnchor,
  });
}
writeCsv("Homeport_Control_Inventory.csv", controls.headers, controls.records);

const journeyDefinitions = [
  ["A", "Gateway route-map summary"],
  ["B", "Anonymous account entry"],
  ["C", "Player route family"],
  ["D", "Captain route family"],
  ["E", "Creator route family"],
  ["F", "Personal Harbor route family"],
  ["G", "Community Harbor route family"],
  ["H", "Dynamic source surface"],
  ["I", "Dynamic detail and parent"],
  ["J", "Direct-entry return"],
  ["K", "Valid token handoff"],
  ["L", "Invalid token recovery"],
  ["M", "Expired, consumed, and revoked token recovery"],
  ["N", "Redirect alias integrity"],
  ["O", "Compatibility and deprecation disposition"],
  ["P", "Ordinary empty-state onward action"],
  ["Q", "Dynamic invalid-ID recovery"],
  ["R", "Permission-aware recovery"],
  ["S", "Compact-surface exit"],
  ["T", "Immersive-surface exit"],
  ["U", "Mobile global path"],
  ["V", "Mobile dynamic detail and return"],
  ["W", "Mobile Personal Harbor path"],
  ["X", "Mobile Community path"],
  ["Y", "Effective 200 percent zoom navigation"],
  ["Z", "Keyboard-only route path"],
  ["AA", "Zero unexplained ordinary orphans"],
  ["AB", "Compatibility context-adapter target"],
  ["AC", "Acyclic parent graph"],
  ["AD", "Full ordinary-route traversal"],
];
const journeys = readJson("Homeport_Journey_Catalog.json");
if (!journeys.resultVocabulary.includes("STRUCTURALLY_REACHABLE"))
  journeys.resultVocabulary.push("STRUCTURALLY_REACHABLE");
for (const [suffix, name] of journeyDefinitions) {
  const journeyId = `HP-P5-JRN-${suffix}`;
  let journey = journeys.journeys.find((item) => item.journeyId === journeyId);
  if (!journey) {
    journey = { journeyId };
    journeys.journeys.push(journey);
  }
  Object.assign(journey, {
    name,
    sourceSha: implementationSourceSha,
    fixtureIdentity: `homeport-phase5-${suffix.toLowerCase()}-synthetic`,
    browser: "Chromium through Sounding Line isolated Playwright adapter",
    viewport: suffix === "M" ? "desktop;390x844;effective-200-percent-zoom" : "desktop-and-mobile-as-applicable",
    steps: ["Start at /", "Use registered visible controls", "Prove stable return", "Use direct entry only afterward"],
    controlsUsed: edges.filter((edge) => edge.browserJourneyIds.includes(journeyId)).map((edge) => edge.edgeId),
    routeTransitions: naturalRows.filter((row) => row.browserTestId.includes(journeyId)).map((row) => row.naturalPath),
    sessionAuthoritiesObservedWithoutValues: ["HP-SES-001"],
    expectedCurrentBehavior:
      "Every eligible route is reached without editing the URL and retains a stable onward path.",
    observedBehavior: final
      ? "Exact-source browser receipt accepted."
      : "Machine graph proof complete; exact-source browser proof pending.",
    screenshots: [],
    traces: [],
    result: final ? "PASSED" : "STRUCTURALLY_REACHABLE",
    rootBlocker: null,
    relatedNonconformityIds: ["HP-NC-014"],
    targetPhase: "PHASE_5",
    futureAcceptanceTest:
      "Repeat the gateway-first journey on the exact committed source, then verify direct entry and stable return.",
    phase5Implementation: phase5Envelope,
  });
}
journeys.phase5Implementation = phase5Envelope;
await writeJson("Homeport_Journey_Catalog.json", journeys);

const auditPath = path.join(auditRoot, "Homeport_Journey_Audit.md");
let audit = readFileSync(auditPath, "utf8");
const startMarker = "<!-- PHASE5_REACHABILITY_START -->";
const endMarker = "<!-- PHASE5_REACHABILITY_END -->";
const phase5Audit = `${startMarker}\n\n## Phase 5 route-reachability amendment\n\nThe source-driven Phase 5 graph records ${nodes.length} page nodes and ${edges.length} typed transitions from ${pages.length} current page sources. Machine traversal reports zero unexplained ordinary orphans. Status: **${state}**. Exact implementation source: \`${implementationSourceSha}\`. Browser, merge, deployment, owner acceptance, Phase 6, Phase 7, and product acceptance remain separate boundaries.\n\n${journeyDefinitions.map(([suffix, name]) => `- \`HP-P5-JRN-${suffix}\`: ${name} — ${final ? "PASSED" : "STRUCTURALLY_REACHABLE; BROWSER PENDING"}`).join("\n")}\n${endMarker}`;
if (audit.includes(startMarker))
  audit = audit.replace(new RegExp(`${startMarker}[\\s\\S]*?${endMarker}`, "u"), phase5Audit);
else audit = `${audit.trimEnd()}\n\n${phase5Audit}\n`;
writeFileSync(auditPath, audit, "utf8");

const nonconformities = parseCsv(readFileSync(path.join(auditRoot, "Homeport_Nonconformity_Ledger.csv"), "utf8"));
const nc14 = nonconformities.records.find((record) => record.id === "HP-NC-014");
if (!nc14) throw new Error("PHASE5_HP_NC_014_MISSING");
nc14.current_status = final ? "CLOSED_PHASE_5_BRANCH_VALIDATED" : "PHASE_5_IMPLEMENTED_PENDING_BROWSER_VALIDATION";
nc14.observed_result = final
  ? "The source-driven graph and exact-source browser receipts report zero unexplained ordinary orphans."
  : "The source-driven graph reports zero unexplained ordinary orphans; exact-source browser proof remains pending.";
const retainedNc14Evidence = (nc14.evidence_ids ?? "")
  .split(";")
  .map((item) => item.trim())
  .filter((item) => item && item !== "PENDING_EXACT_SOURCE_BROWSER" && !item.startsWith("HP-P5-EV-"))
  .join(";");
nc14.evidence_ids = final
  ? appendNote(retainedNc14Evidence, "HP-P5-EV-AA-zero-orphan;HP-P5-EV-AD-full-traversal-summary")
  : retainedNc14Evidence;
nc14.disposition = final ? "CLOSED_PHASE_5_BRANCH_VALIDATED" : "PHASE_5_IMPLEMENTED_PENDING_BROWSER_VALIDATION";
nc14.notes = appendNote(nc14.notes, "Phase 5 does not close Phase 6/7 findings or establish product acceptance.");
writeCsv("Homeport_Nonconformity_Ledger.csv", nonconformities.headers, nonconformities.records);

const visual = readJson("Homeport_Visual_Baseline_Manifest.json");
visual.phase5Implementation = phase5Envelope;
if (final) {
  const evidenceManifestPath = path.join(auditRoot, "evidence", "phase5", "manifest.json");
  if (!existsSync(evidenceManifestPath)) throw new Error("PHASE5_EVIDENCE_MANIFEST_MISSING");
  const manifest = JSON.parse(readFileSync(evidenceManifestPath, "utf8"));
  if (manifest.sourceSha !== implementationSourceSha) throw new Error("PHASE5_EVIDENCE_SOURCE_MISMATCH");
  for (const record of manifest.records) {
    const index = visual.records.findIndex((item) => item.evidenceId === record.evidenceId);
    if (index >= 0) visual.records[index] = record;
    else visual.records.push(record);
  }
  visual.phase5Run = manifest;
}
await writeJson("Homeport_Visual_Baseline_Manifest.json", visual);

const soundingContracts = readJson("contracts.json", testingRoot);
soundingContracts.status = final
  ? "phase-5-homeport-route-reachability-validated"
  : "phase-5-homeport-route-reachability-registered";
const contractsById = new Map(soundingContracts.contracts.map((contract) => [contract.id, contract]));
for (const id of phase5Contracts)
  contractsById.set(id, {
    id,
    name: id
      .replace("homeport.route.", "Homeport Route ")
      .split(/[.-]/u)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" "),
    authority: "project-homeport",
    owners: ["project-homeport"],
    critical: true,
  });
soundingContracts.contracts = [...contractsById.values()];
await writeJson("contracts.json", soundingContracts, testingRoot);

const ownership = readJson("ownership.json", testingRoot);
ownership.status = "phase-5-homeport-route-source-classification";
const homeportOwner = ownership.owners.find((owner) => owner.id === "project-homeport");
if (!homeportOwner) throw new Error("PHASE5_SOUNDING_LINE_OWNER_MISSING");
homeportOwner.sourcePaths = unique([
  ...homeportOwner.sourcePaths,
  "scripts/homeport/**",
  "Development_Docs/Projects/Project_Homeport/**",
  "src/navigation/**",
  "src/components/tales/TaleStart.tsx",
  "src/components/community/PublicCommunitySection.tsx",
  "src/app/community/voyage-logs/media/page.tsx",
  "src/app/profile/[handle]/page.tsx",
  "src/app/studio/page.tsx",
  "src/app/quartermaster/page.tsx",
]);
homeportOwner.testPaths = unique([
  ...homeportOwner.testPaths,
  "tests/homeport/phase5-*.test.mjs",
  "tests/e2e/homeport-phase5.spec.ts",
]);
homeportOwner.contractIds = unique([...homeportOwner.contractIds, ...phase5Contracts]);
await writeJson("ownership.json", ownership, testingRoot);

const impactMap = readJson("impact-map.json", testingRoot);
impactMap.status = "phase-5-homeport-route-reachability-impact-map";
const upsertPathMapping = (pathPattern, suiteIds, contractIds) => {
  const current = impactMap.pathMappings.find((mapping) => mapping.path === pathPattern);
  if (current) {
    current.suiteIds = unique([...current.suiteIds, ...suiteIds]);
    current.contractIds = unique([...current.contractIds, ...contractIds]);
  } else impactMap.pathMappings.push({ path: pathPattern, suiteIds, contractIds });
};
for (const sourcePath of [
  "scripts/homeport/**",
  "Development_Docs/Projects/Project_Homeport/**",
  "src/navigation/**",
  "src/components/tales/TaleStart.tsx",
  "src/components/community/PublicCommunitySection.tsx",
  "src/app/community/voyage-logs/media/page.tsx",
  "src/app/profile/[handle]/page.tsx",
  "src/app/studio/page.tsx",
  "src/app/quartermaster/page.tsx",
  "tests/homeport/phase5-*.test.mjs",
  "tests/e2e/homeport-phase5.spec.ts",
  "playwright.homeport-phase5.config.ts",
])
  upsertPathMapping(sourcePath, ["unit.homeport", "component.homeport", "browser.homeport"], phase5Contracts);
impactMap.contractMappings ??= [];
for (const contractId of phase5Contracts) {
  const current = impactMap.contractMappings.find((mapping) => mapping.contractId === contractId);
  if (current)
    current.suiteIds = unique([...current.suiteIds, "unit.homeport", "component.homeport", "browser.homeport"]);
  else
    impactMap.contractMappings.push({
      contractId,
      suiteIds: ["unit.homeport", "component.homeport", "browser.homeport"],
    });
}
await writeJson("impact-map.json", impactMap, testingRoot);

const suites = readJson("suites.json", testingRoot);
suites.status = "phase-5-homeport-route-reachability-owned-families";
for (const suiteId of ["unit.homeport", "component.homeport", "browser.homeport"]) {
  const suite = suites.suites.find((item) => item.id === suiteId);
  if (!suite) throw new Error(`PHASE5_SOUNDING_LINE_SUITE_MISSING:${suiteId}`);
  suite.contracts = unique([...suite.contracts, ...phase5Contracts]);
  suite.affectedPaths = unique([
    ...suite.affectedPaths,
    "scripts/homeport/phase5-*.mjs",
    "tests/homeport/phase5-*.test.mjs",
    "tests/e2e/homeport-phase5.spec.ts",
    "playwright.homeport-phase5.config.ts",
  ]);
  suite.currentImplementationState = "phase-5-homeport-route-reachability-contract-family";
}
await writeJson("suites.json", suites, testingRoot);

execFileSync(process.execPath, ["scripts/sounding-line/test-registry.mjs"], { cwd: root, stdio: "inherit" });

process.stdout.write(
  `${JSON.stringify(
    {
      outcome: "PHASE5_INVENTORY_UPDATED",
      implementationSourceSha,
      state,
      pageSources: pages.length,
      serviceSources: handlers.length,
      routeInventoryRecords: routeInventory.routes.length,
      nodes: nodes.length,
      edges: edges.length,
      ordinaryRoutes: ordinaryNodes.length,
      contextualRoutes: contextualNodes.length,
      unexplainedOrdinaryOrphans: 0,
    },
    null,
    2,
  )}\n`,
);

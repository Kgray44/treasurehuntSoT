import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

export const CAPTURE_CLASSIFICATIONS = Object.freeze([
  "USER_FACING_NAVIGABLE",
  "CONTEXTUAL_DYNAMIC_DESTINATION",
  "TOKENIZED_OR_INVITATION_DEEP_LINK",
  "COMPATIBILITY_OR_REDIRECT",
  "DEVELOPMENT_OR_DIAGNOSTIC",
  "INTERNAL_NON_PAGE",
]);

export const CURRENT_CAPTURE_STATUS = "CAPTURED_PENDING_BRIGHTWORK_REVIEW";
export const REQUIRED_VIEWPORTS = Object.freeze([
  { id: "desktop-1440x900", width: 1440, height: 900 },
  { id: "mobile-390x844", width: 390, height: 844 },
]);
export const REQUIRED_THEMES = Object.freeze(["DARK", "LIGHT"]);

const IDENTITY_COMPONENTS = Object.freeze([
  "routeId",
  "screenId",
  "state",
  "persona",
  "theme",
  "viewport",
  "motionMode",
  "coverageKind",
]);

const LEGACY_CLASSIFICATIONS = Object.freeze({
  USER_NAVIGABLE: "USER_FACING_NAVIGABLE",
  CONTEXTUAL_DYNAMIC: "CONTEXTUAL_DYNAMIC_DESTINATION",
  TOKENIZED_DEEP_LINK: "TOKENIZED_OR_INVITATION_DEEP_LINK",
  AUTH_COMPATIBILITY_ALIAS: "COMPATIBILITY_OR_REDIRECT",
  REDIRECT_ALIAS: "COMPATIBILITY_OR_REDIRECT",
  PRIVILEGED_DIRECT_ENTRY: "CONTEXTUAL_DYNAMIC_DESTINATION",
  INTERNAL_DIAGNOSTIC: "INTERNAL_NON_PAGE",
  DEVELOPMENT_ONLY: "DEVELOPMENT_OR_DIAGNOSTIC",
});

const TOKENIZED_ROUTES = new Set([
  "/account/cancel-deletion",
  "/account/claim",
  "/account/email-change",
  "/account/merge",
  "/account/reactivate",
  "/player/invitation",
  "/reset-password",
  "/verify-email",
]);

const COMPATIBILITY_ROUTES = new Set([
  "/captain",
  "/captain/sign-in",
  "/player",
  "/player/sign-in",
  "/quartermaster",
  "/studio",
  "/studio/sign-in",
  "/tale/[campaignSlug]",
]);

const ADMIN_PATHS = new Set([
  "/admin",
  "/admin/audit",
  "/admin/chronicles",
  "/admin/community",
  "/admin/configuration",
  "/admin/investigate",
  "/admin/operations",
  "/admin/people",
  "/admin/providers",
  "/admin/releases",
  "/admin/support/cases",
  "/admin/voyages",
]);

// The page-level gate is the evidence authority for Admiralty stations.  The
// shared layout requires PLATFORM_OBSERVE too, but it is not a substitute for
// the station-specific gate below.
const ADMIN_PAGE_CAPABILITIES = Object.freeze({
  "/admin": "PLATFORM_OBSERVE",
  "/admin/audit": "AUDIT_OBSERVE",
  "/admin/chronicles": "CHRONICLE_OBSERVE",
  "/admin/chronicles/[chronicleId]": "CHRONICLE_OBSERVE",
  "/admin/community": "COMMUNITY_OBSERVE",
  "/admin/community/[listingId]": "COMMUNITY_OBSERVE",
  "/admin/configuration": "CONFIG_OBSERVE",
  "/admin/investigate": "PLATFORM_OBSERVE",
  "/admin/operations": "JOBS_OBSERVE",
  "/admin/people": "ACCOUNT_OBSERVE",
  "/admin/people/[accountId]": "ACCOUNT_OBSERVE",
  "/admin/providers": "CONTENT_OBSERVE",
  "/admin/releases": "RELEASE_OBSERVE",
  "/admin/support/cases": "SUPPORT_REQUEST",
  "/admin/voyages": "VOYAGE_OBSERVE",
  "/admin/voyages/[voyageId]": "VOYAGE_OBSERVE",
});

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map((entry) => stableJson(entry)).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

export function routeIdFor(routePattern) {
  const value = routePattern === "/" ? "root" : routePattern.slice(1);
  return `route-page-${value
    .replaceAll(/[^a-zA-Z0-9]+/gu, "-")
    .replaceAll(/^-|-$/gu, "")
    .toLowerCase()}`;
}

export function screenIdFor(routePattern, priorScreenId) {
  return priorScreenId ?? `screen-${routeIdFor(routePattern).replace(/^route-/u, "")}`;
}

export function sourcePageRoutes(appRoot) {
  const pages = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (/^page\.(?:tsx|jsx|ts|js)$/u.test(entry.name)) pages.push(absolute);
    }
  };
  visit(appRoot);
  return pages
    .map((file) => {
      const directory = path.relative(appRoot, path.dirname(file));
      const routePattern = directory ? `/${directory.split(path.sep).join("/")}` : "/";
      return { implementationSource: path.relative(process.cwd(), file).split(path.sep).join("/"), routePattern };
    })
    .sort((left, right) => left.routePattern.localeCompare(right.routePattern));
}

export function productAreaFor(routePattern) {
  if (routePattern === "/") return "Gateway_Public_Shell";
  if (/^\/(sign-in|register|forgot-password|reset-password|verify-email|player\/invitation)/u.test(routePattern))
    return "Authentication_and_Recovery";
  if (routePattern.startsWith("/account")) return "Personal_Harbor";
  if (routePattern.startsWith("/passport")) return "Chronicle_Passport_Wakebook";
  if (routePattern.startsWith("/player") || routePattern.startsWith("/play")) return "Player";
  if (routePattern.startsWith("/captain") || routePattern.startsWith("/quartermaster")) return "Captain_Helm";
  if (routePattern.startsWith("/studio")) return "Creator_Studio_Shipwright";
  if (routePattern.startsWith("/community")) return "Community_Harbor";
  if (routePattern.startsWith("/admin")) return "Admiralty";
  if (routePattern.startsWith("/chronicles") || routePattern.startsWith("/tale") || routePattern.startsWith("/tales"))
    return "Public_Chronicle_and_Detail";
  if (routePattern.startsWith("/profile")) return "Personal_Harbor";
  if (routePattern.startsWith("/dev")) return "Development";
  return "Other_Current_Product_Area";
}

export function fallbackClassification(routePattern) {
  if (routePattern.startsWith("/dev/")) return "DEVELOPMENT_OR_DIAGNOSTIC";
  // This is a protected browser UI with an interactive refresh control.  It
  // is intentionally protected, not an internal service endpoint.
  if (routePattern === "/studio/private-content/operations") return "CONTEXTUAL_DYNAMIC_DESTINATION";
  if (TOKENIZED_ROUTES.has(routePattern)) return "TOKENIZED_OR_INVITATION_DEEP_LINK";
  if (COMPATIBILITY_ROUTES.has(routePattern)) return "COMPATIBILITY_OR_REDIRECT";
  if (routePattern.includes("[")) return "CONTEXTUAL_DYNAMIC_DESTINATION";
  return "USER_FACING_NAVIGABLE";
}

export function fallbackAuthentication(routePattern) {
  if (/^\/(sign-in|register|forgot-password|reset-password|verify-email)/u.test(routePattern))
    return "ANONYMOUS_ALLOWED";
  if (TOKENIZED_ROUTES.has(routePattern)) return "BOUNDED_TOKEN_OR_CODE";
  if (routePattern.startsWith("/admin")) return "AUTHENTICATED_CAPABILITY_REQUIRED";
  if (routePattern.startsWith("/captain") || routePattern.startsWith("/studio"))
    return "AUTHENTICATED_CAPABILITY_REQUIRED";
  if (routePattern.startsWith("/player") || routePattern.startsWith("/passport"))
    return "AUTHENTICATED_PLAYER_REQUIRED";
  return "ANONYMOUS_ALLOWED";
}

export function fallbackCapabilities(routePattern) {
  if (ADMIN_PAGE_CAPABILITIES[routePattern]) return [ADMIN_PAGE_CAPABILITIES[routePattern]];
  if (routePattern === "/studio/private-content/operations") return ["ADMIN"];
  if (routePattern.startsWith("/captain") || routePattern.startsWith("/quartermaster")) return ["captain"];
  if (routePattern.startsWith("/studio")) return ["creator"];
  if (routePattern.startsWith("/community/moderation")) return ["moderator"];
  if (routePattern.startsWith("/player") || routePattern.startsWith("/passport")) return ["player"];
  return [];
}

function legacyScreenByRoute(screenCatalog) {
  const result = new Map();
  for (const screen of screenCatalog.screens ?? [])
    for (const routeId of screen.routeIds ?? []) result.set(routeId, screen);
  return result;
}

export function buildRouteCensus({ appRoot, legacyInventory, screenCatalog, sourceSha, generatedAt }) {
  const priorRoutes = new Map((legacyInventory.routes ?? []).map((route) => [route.routePattern, route]));
  const priorScreens = legacyScreenByRoute(screenCatalog);
  const routes = sourcePageRoutes(appRoot).map(({ implementationSource, routePattern }) => {
    const prior = priorRoutes.get(routePattern);
    const routeId = prior?.routeId ?? routeIdFor(routePattern);
    const priorScreen = priorScreens.get(routeId);
    // A prior Homeport internal-service label must not hide a current browser
    // page that has a protected, interactive human console.
    const classification =
      routePattern === "/studio/private-content/operations"
        ? "CONTEXTUAL_DYNAMIC_DESTINATION"
        : (LEGACY_CLASSIFICATIONS[prior?.classification] ?? fallbackClassification(routePattern));
    // Stage 1 legacy metadata used a generic Admiralty label.  Prefer the
    // actual page gate whenever the current source defines one.
    const inferredCapabilities = fallbackCapabilities(routePattern);
    const capabilityRequirements =
      ADMIN_PAGE_CAPABILITIES[routePattern] || routePattern === "/studio/private-content/operations"
        ? inferredCapabilities
        : prior?.capabilityRequirements?.length
          ? prior.capabilityRequirements
          : inferredCapabilities;
    const authenticationRequirement = prior?.authenticationRequirement ?? fallbackAuthentication(routePattern);
    const route = {
      routeId,
      routePattern,
      implementationSource,
      screenId: screenIdFor(routePattern, priorScreen?.screenId),
      productArea: productAreaFor(routePattern),
      logicalParent: prior?.logicalParent ?? null,
      classification,
      authenticationRequirement,
      capabilityRequirements,
      applicablePersonas: personasFor({ routePattern, authenticationRequirement, capabilityRequirements }),
      meaningfulVisualStates:
        routePattern === "/studio/private-content/operations"
          ? ["DEPENDENCY_UNAVAILABLE", "INITIAL_LOADING", "READY", "UNAUTHORIZED"]
          : meaningfulStates(priorScreen?.applicableStates ?? [], routePattern),
      desktopMobileApplicability: ["INTERNAL_NON_PAGE", "DEVELOPMENT_OR_DIAGNOSTIC"].includes(classification)
        ? "EXCLUDED"
        : "DESKTOP_AND_MOBILE",
      themesApplicable: ["INTERNAL_NON_PAGE", "DEVELOPMENT_OR_DIAGNOSTIC"].includes(classification)
        ? []
        : [...REQUIRED_THEMES],
      motionApplicability: ["INTERNAL_NON_PAGE", "DEVELOPMENT_OR_DIAGNOSTIC"].includes(classification)
        ? "NOT_APPLICABLE"
        : "REDUCED_MOTION_REQUIRED",
      screenshotRequirements: [],
      captureStatus: ["INTERNAL_NON_PAGE", "DEVELOPMENT_OR_DIAGNOSTIC"].includes(classification)
        ? "EXCLUDED_BY_CLASSIFICATION"
        : "PLANNED",
      provenance: prior ? "CURRENT_SOURCE_RECONCILED_WITH_LEGACY_CATALOG" : "CURRENT_SOURCE_DISCOVERED",
    };
    route.screenshotRequirements = ["INTERNAL_NON_PAGE", "DEVELOPMENT_OR_DIAGNOSTIC"].includes(classification)
      ? []
      : captureRequirementsFor(route);
    return route;
  });
  const totals = countClassifications(routes);
  return {
    schemaVersion: "2.0.0",
    artifact: "Voyagewright Brightwork current-main route and screen census",
    sourceSha,
    generatedAt,
    discovery: {
      appRoot: path.relative(process.cwd(), appRoot).split(path.sep).join("/"),
      sourceOfTruth: "Current src/app page files reconciled with current navigation and catalog metadata.",
    },
    classifications: CAPTURE_CLASSIFICATIONS,
    totals,
    routes,
  };
}

export function personasFor({ routePattern, authenticationRequirement, capabilityRequirements }) {
  if (authenticationRequirement === "ANONYMOUS_ALLOWED" && !capabilityRequirements.length) return ["ANONYMOUS"];
  if (routePattern.startsWith("/admin") || hasCapability(capabilityRequirements, "admin"))
    return ["ADMIRALTY_OPERATOR", "ANONYMOUS"];
  if (hasCapability(capabilityRequirements, "moderator")) return ["MODERATOR", "ORDINARY_PLAYER"];
  if (hasCapability(capabilityRequirements, "captain")) return ["CAPTAIN_PLAYER", "ORDINARY_PLAYER"];
  if (hasCapability(capabilityRequirements, "creator")) return ["CREATOR", "ORDINARY_PLAYER"];
  if (hasCapability(capabilityRequirements, "player") || authenticationRequirement !== "ANONYMOUS_ALLOWED")
    return ["ORDINARY_PLAYER", "ANONYMOUS"];
  return ["ANONYMOUS"];
}

export function meaningfulStates(screenStates, routePattern) {
  const states = new Set(["READY"]);
  for (const state of screenStates) {
    const normalized = String(state)
      .toUpperCase()
      .replaceAll(/[^A-Z0-9]+/gu, "_");
    if (
      /EMPTY|LOADING|ERROR|UNAVAILABLE|DENIED|DISABLED|VALIDATION|SUCCESS|DESTRUCTIVE|MODAL|DRAWER|FOCUS|MOTION/u.test(
        normalized,
      )
    )
      states.add(normalized);
  }
  if (routePattern.startsWith("/admin")) states.add("UNAUTHORIZED");
  if (/^\/(account|passport|player|captain|studio)/u.test(routePattern)) states.add("SIGN_IN_REQUIRED");
  return [...states].sort();
}

export function captureRequirementsFor(route) {
  const persona = capturePersonaFor(route);
  const compatibility = compatibilityExpectation(route.routePattern);
  const state = route.classification === "COMPATIBILITY_OR_REDIRECT" ? "COMPATIBILITY_OR_REDIRECT" : "READY";
  return REQUIRED_THEMES.flatMap((theme) =>
    REQUIRED_VIEWPORTS.map((viewport) => ({
      state,
      persona,
      theme,
      viewport: viewport.id,
      motionMode: "REDUCED",
      coverageKind: "ROUTE",
      criticality: route.classification === "CONTEXTUAL_DYNAMIC_DESTINATION" ? "HIGH" : "STANDARD",
      ...(compatibility ?? {}),
    })),
  );
}

export function buildCaptureContract(census, generatedAt) {
  const requirements = census.routes.flatMap((route) =>
    route.screenshotRequirements.map((requirement) => ({
      routeId: route.routeId,
      routePattern: route.routePattern,
      screenId: route.screenId,
      productArea: route.productArea,
      classification: route.classification,
      authenticationRequirement: route.authenticationRequirement,
      capabilityRequirements: route.capabilityRequirements,
      ...(semanticReadyMarkerFor(route.routePattern)
        ? { semanticReadyMarker: semanticReadyMarkerFor(route.routePattern) }
        : {}),
      ...requirement,
    })),
  );
  const byPattern = new Map(census.routes.map((route) => [route.routePattern, route]));
  for (const state of [
    { routePattern: "/account", state: "SIGN_IN_REQUIRED", persona: "ANONYMOUS", action: "NONE" },
    { routePattern: "/admin", state: "UNAUTHORIZED", persona: "ANONYMOUS", action: "NONE" },
    {
      routePattern: "/community/collections/[slug]",
      state: "EMPTY",
      persona: "ANONYMOUS",
      action: "NONE",
      concreteRoute: "/community/collections/empty-chart-case",
    },
    {
      routePattern: "/community/chronicles",
      state: "DELAYED_LOADING",
      persona: "ANONYMOUS",
      action: "COMMUNITY_LOADING",
    },
    { routePattern: "/community/chronicles", state: "ERROR", persona: "ANONYMOUS", action: "COMMUNITY_ERROR" },
    {
      routePattern: "/captain/sessions/[sessionId]",
      state: "INITIAL_LOADING",
      persona: "CAPTAIN_PLAYER",
      action: "CAPTAIN_LOADING",
    },
    {
      routePattern: "/captain/sessions/[sessionId]",
      state: "RECOVERABLE_ERROR",
      persona: "CAPTAIN_PLAYER",
      action: "CAPTAIN_ERROR",
    },
    {
      routePattern: "/captain/sessions/[sessionId]",
      state: "DESTRUCTIVE_CONFIRMATION",
      persona: "CAPTAIN_PLAYER",
      action: "CAPTAIN_DESTRUCTIVE_CONFIRMATION",
    },
    {
      routePattern: "/studio/private-content/operations",
      state: "INITIAL_LOADING",
      persona: "ADMIRALTY_OPERATOR",
      action: "PRIVATE_OPERATIONS_LOADING",
    },
    {
      routePattern: "/studio/private-content/operations",
      state: "DEPENDENCY_UNAVAILABLE",
      persona: "ADMIRALTY_OPERATOR",
      action: "PRIVATE_OPERATIONS_DEPENDENCY_UNAVAILABLE",
    },
    {
      routePattern: "/studio/private-content/operations",
      state: "UNAUTHORIZED",
      persona: "ANONYMOUS",
      action: "NONE",
    },
    { routePattern: "/", state: "KEYBOARD_FOCUS", persona: "ANONYMOUS", action: "KEYBOARD_FOCUS" },
    { routePattern: "/account", state: "200_PERCENT_EFFECTIVE_ZOOM", persona: "ORDINARY_PLAYER", action: "ZOOM_200" },
    { routePattern: "/", state: "REDUCED_MOTION", persona: "ANONYMOUS", action: "NONE" },
  ]) {
    const route = byPattern.get(state.routePattern);
    if (!route) continue;
    requirements.push({
      routeId: route.routeId,
      routePattern: route.routePattern,
      screenId: route.screenId,
      productArea: route.productArea,
      classification: route.classification,
      authenticationRequirement: route.authenticationRequirement,
      capabilityRequirements: route.capabilityRequirements,
      ...(semanticReadyMarkerFor(route.routePattern)
        ? { semanticReadyMarker: semanticReadyMarkerFor(route.routePattern) }
        : {}),
      state: state.state,
      persona: state.persona,
      theme: "DARK",
      viewport: "desktop-1440x900",
      motionMode: "REDUCED",
      coverageKind: "STATE",
      criticality: "HIGH",
      captureAction: state.action,
      ...(state.concreteRoute ? { concreteRoute: state.concreteRoute } : {}),
    });
  }
  const normalizedRequirements = requirements.map((requirement) => {
    const normalized = { ...requirement, identity: canonicalCaptureIdentity(requirement) };
    return { ...normalized, requirementDigest: captureRequirementDigest(normalized) };
  });
  const contract = {
    schemaVersion: "2.0.0",
    artifact: "Voyagewright Brightwork visual capture contract",
    sourceSha: census.sourceSha,
    censusDigest: sha256(stableJson(census.routes)),
    generatedAt,
    requirements: normalizedRequirements,
  };
  const finalized = { ...contract, contractDigest: sha256(stableJson(contract)) };
  const validation = captureContractValidation({ contract: finalized, census });
  if (!validation.valid) throw new Error(`BRIGHTWORK_CAPTURE_CONTRACT_INVALID:${validation.failureCodes.join(",")}`);
  return finalized;
}

export function countClassifications(routes) {
  const counts = Object.fromEntries(CAPTURE_CLASSIFICATIONS.map((classification) => [classification, 0]));
  for (const route of routes) counts[route.classification] += 1;
  const allPageRoutes = routes.length;
  const humanFacing = routes.filter(
    (route) => !["INTERNAL_NON_PAGE", "DEVELOPMENT_OR_DIAGNOSTIC"].includes(route.classification),
  ).length;
  return {
    allPageRoutes,
    humanFacingRoutes: humanFacing,
    navigableRoutes: counts.USER_FACING_NAVIGABLE,
    contextualDynamicRoutes: counts.CONTEXTUAL_DYNAMIC_DESTINATION,
    tokenizedOrDeepLinkRoutes: counts.TOKENIZED_OR_INVITATION_DEEP_LINK,
    compatibilityRoutes: counts.COMPATIBILITY_OR_REDIRECT,
    developmentOnlyRoutes: counts.DEVELOPMENT_OR_DIAGNOSTIC,
    excludedInternalNonPageRoutes: counts.INTERNAL_NON_PAGE,
    byClassification: counts,
  };
}

export function requirementIdentity(requirement) {
  return canonicalCaptureIdentity(requirement);
}

export function canonicalCaptureIdentity(requirement) {
  const components = identityComponents(requirement);
  const invalid = components.filter(([, value]) => !value);
  if (invalid.length)
    throw new Error(`BRIGHTWORK_CANONICAL_IDENTITY_COMPONENT_INVALID:${invalid.map(([key]) => key).join(",")}`);
  return components.map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join("&");
}

// A global contract digest is useful provenance, but it must not force a
// ceremonial recapture of every unchanged image when Stage 4B adds one state.
// This binding contains every route-specific fact that makes an image valid.
export function captureRequirementDigest(requirement) {
  return sha256(
    stableJson({
      routeId: requirement.routeId,
      routePattern: requirement.routePattern,
      screenId: requirement.screenId,
      productArea: requirement.productArea,
      classification: requirement.classification,
      authenticationRequirement: requirement.authenticationRequirement ?? null,
      capabilityRequirements: [...(requirement.capabilityRequirements ?? [])].sort(),
      state: requirement.state,
      persona: requirement.persona,
      theme: requirement.theme,
      viewport: requirement.viewport,
      motionMode: requirement.motionMode,
      coverageKind: requirement.coverageKind,
      criticality: requirement.criticality,
      captureAction: requirement.captureAction ?? null,
      concreteRoute: requirement.concreteRoute ?? null,
      expectedDestination: requirement.expectedDestination ?? null,
      expectedCompatibilityState: requirement.expectedCompatibilityState ?? null,
      semanticReadyMarker: requirement.semanticReadyMarker ?? null,
    }),
  );
}

export function captureContractValidation({ contract, census }) {
  const routes = new Map((census?.routes ?? []).map((route) => [route.routeId, route]));
  const malformedIdentities = [];
  const duplicateIdentities = [];
  const personaMismatches = [];
  const malformedRequirementDigests = [];
  const seen = new Map();
  for (const requirement of contract.requirements ?? []) {
    let canonical;
    try {
      canonical = canonicalCaptureIdentity(requirement);
    } catch (error) {
      malformedIdentities.push({ requirement, reason: String(error.message ?? error) });
      continue;
    }
    if (requirement.identity !== canonical)
      malformedIdentities.push({ requirement, reason: "IDENTITY_DOES_NOT_MATCH_CANONICAL_COMPONENTS" });
    if (requirement.requirementDigest && requirement.requirementDigest !== captureRequirementDigest(requirement))
      malformedRequirementDigests.push({ requirement, reason: "REQUIREMENT_DIGEST_DOES_NOT_MATCH_BINDING" });
    if (seen.has(requirement.identity))
      duplicateIdentities.push({ requirement, duplicateOf: seen.get(requirement.identity) });
    else seen.set(requirement.identity, requirement);
    const route = routes.get(requirement.routeId);
    if (
      route &&
      !route.applicablePersonas.includes(requirement.persona) &&
      !requirement.personaException?.allowOutsideApplicablePersonas
    )
      personaMismatches.push({ requirement, route });
  }
  const failureCodes = [
    ...(malformedIdentities.length ? ["MALFORMED_IDENTITIES"] : []),
    ...(duplicateIdentities.length ? ["DUPLICATE_IDENTITIES"] : []),
    ...(personaMismatches.length ? ["PERSONA_MISMATCHES"] : []),
    ...(malformedRequirementDigests.length ? ["MALFORMED_REQUIREMENT_DIGESTS"] : []),
  ];
  return {
    valid: failureCodes.length === 0,
    failureCodes,
    malformedIdentities,
    duplicateIdentities,
    personaMismatches,
    malformedRequirementDigests,
  };
}

export function semanticCaptureIssue(requirement, observation) {
  if (!observation) return "SEMANTIC_OBSERVATION_MISSING";
  if (requirement.classification === "CONTEXTUAL_DYNAMIC_DESTINATION" && !observation.syntheticRecordProven)
    return "DYNAMIC_SYNTHETIC_RECORD_UNPROVEN";
  if (requirement.state === "READY") {
    if (observation.notFound) return "READY_NOT_FOUND";
    if (observation.unauthorizedSurface) return "READY_UNAUTHORIZED_SURFACE";
    if (observation.unavailableSurface || observation.deadEndSurface) return "READY_UNAVAILABLE_SURFACE";
    if (requirement.semanticReadyMarker && !observation.readyMarkers?.includes(requirement.semanticReadyMarker))
      return "READY_MARKER_MISSING";
  }
  if (requirement.state === "UNAUTHORIZED" && !observation.notFound && !observation.unauthorizedSurface)
    return "UNAUTHORIZED_EXPECTATION_UNMET";
  if (requirement.state === "SIGN_IN_REQUIRED" && !observation.signInSurface) return "SIGN_IN_EXPECTATION_UNMET";
  if (requirement.state === "COMPATIBILITY_OR_REDIRECT") {
    if (observation.notFound) return "COMPATIBILITY_NOT_FOUND";
    if (requirement.expectedDestination && observation.finalPath !== requirement.expectedDestination)
      return "COMPATIBILITY_DESTINATION_MISMATCH";
    if (requirement.expectedCompatibilityState === "SIGN_IN_SURFACE" && !observation.signInSurface)
      return "COMPATIBILITY_SIGN_IN_EXPECTATION_UNMET";
  }
  return null;
}

export function reconciliationReport({ contract, manifest, sourceSha, imageRoot, census, checksum = fileChecksum }) {
  const contractValidation = captureContractValidation({ contract, census });
  const requirements = new Map(contract.requirements.map((requirement) => [requirement.identity, requirement]));
  const captures = manifest?.records ?? [];
  const seen = new Map();
  const current = [];
  const stale = [];
  const missing = [];
  const blocked = [];
  const orphaned = [];
  const duplicates = [];
  const duplicateImageIds = [];
  const malformedRecordIdentities = [];
  const semanticFailures = [];
  const imageIds = new Set();
  for (const record of captures) {
    if (imageIds.has(record.imageId)) duplicateImageIds.push(record);
    imageIds.add(record.imageId);
    let identity;
    try {
      identity = canonicalCaptureIdentity(record);
    } catch (error) {
      malformedRecordIdentities.push({ record, reason: String(error.message ?? error) });
      continue;
    }
    if (record.identity !== identity) {
      malformedRecordIdentities.push({ record, reason: "RECORD_IDENTITY_DOES_NOT_MATCH_CANONICAL_COMPONENTS" });
      continue;
    }
    if (seen.has(identity)) duplicates.push(record);
    seen.set(identity, record);
    if (!requirements.has(identity)) {
      orphaned.push(record);
      continue;
    }
    if (record.captureStatus === "BLOCKED_BY_PRODUCT") {
      blocked.push(record);
      continue;
    }
    const requirement = requirements.get(identity);
    const requirementCurrent = record.requirementDigest
      ? record.requirementDigest === requirement.requirementDigest
      : record.contractDigest === contract.contractDigest;
    if (record.sourceSha !== sourceSha || !requirementCurrent) {
      stale.push(record);
      continue;
    }
    const file = path.join(imageRoot, ...String(record.screenshotPath).split("/"));
    if (!existsSync(file) || checksum(file) !== record.sha256) {
      missing.push({ ...record, reconciliationReason: existsSync(file) ? "CHECKSUM_MISMATCH" : "IMAGE_MISSING" });
      continue;
    }
    const semanticIssue = semanticCaptureIssue(requirement, record.semanticObservation);
    if (semanticIssue) {
      semanticFailures.push({ ...record, reconciliationReason: semanticIssue });
      continue;
    }
    current.push(record);
  }
  for (const [identity, requirement] of requirements)
    if (!seen.has(identity)) missing.push({ ...requirement, reconciliationReason: "REQUIRED_CAPTURE_MISSING" });
  const manifestPaths = new Set(captures.map((record) => String(record.screenshotPath).replaceAll("\\", "/")));
  const orphanedFiles = canonicalFiles(imageRoot)
    .filter((screenshotPath) => !manifestPaths.has(screenshotPath))
    .map((screenshotPath) => ({
      screenshotPath,
      reconciliationReason: "CANONICAL_FILE_NOT_IN_MANIFEST",
    }));
  const allOrphaned = [...orphaned, ...orphanedFiles];
  const excluded = contract.requirements.filter((requirement) => requirement.classification === "INTERNAL_NON_PAGE");
  return {
    schemaVersion: "1.0.0",
    artifact: "Voyagewright Brightwork visual evidence freshness and coverage reconciliation",
    sourceSha,
    contractDigest: contract.contractDigest,
    requiredCaptures: contract.requirements.length,
    currentCaptures: current.length,
    staleCaptures: stale.length,
    missingCaptures: missing.length,
    blockedByProduct: blocked.length,
    unexpectedOrphanedCaptures: allOrphaned.length,
    duplicateCanonicalIdentities: duplicates.length + contractValidation.duplicateIdentities.length,
    duplicateCanonicalImageIds: duplicateImageIds.length,
    malformedCanonicalIdentities: malformedRecordIdentities.length + contractValidation.malformedIdentities.length,
    personaContractMismatches: contractValidation.personaMismatches.length,
    semanticInvalidCaptures: semanticFailures.length,
    excludedByClassification: excluded.length,
    overallCompleteness:
      stale.length === 0 &&
      missing.length === 0 &&
      allOrphaned.length === 0 &&
      duplicates.length === 0 &&
      duplicateImageIds.length === 0 &&
      malformedRecordIdentities.length === 0 &&
      contractValidation.malformedIdentities.length === 0 &&
      contractValidation.duplicateIdentities.length === 0 &&
      contractValidation.personaMismatches.length === 0 &&
      semanticFailures.length === 0
        ? blocked.length === 0
          ? "COMPLETE"
          : "COMPLETE_WITH_PRODUCT_BLOCKERS"
        : "INCOMPLETE",
    current,
    stale,
    missing,
    blocked,
    orphaned: allOrphaned,
    duplicates,
    duplicateImageIds,
    malformedRecordIdentities,
    contractValidation,
    semanticFailures,
    excluded,
  };
}

function identityComponents(requirement) {
  return IDENTITY_COMPONENTS.map((key) => [key, String(requirement?.[key] ?? "").trim()]);
}

function hasCapability(capabilities, expected) {
  return capabilities.some((capability) => String(capability).toLocaleLowerCase() === expected);
}

function capturePersonaFor(route) {
  if (route.routePattern.startsWith("/admin")) return "ADMIRALTY_OPERATOR";
  if (hasCapability(route.capabilityRequirements, "admin")) return "ADMIRALTY_OPERATOR";
  if (hasCapability(route.capabilityRequirements, "moderator")) return "MODERATOR";
  if (hasCapability(route.capabilityRequirements, "captain")) return "CAPTAIN_PLAYER";
  if (hasCapability(route.capabilityRequirements, "creator")) return "CREATOR";
  if (
    route.authenticationRequirement === "ANONYMOUS_ALLOWED" ||
    route.classification === "TOKENIZED_OR_INVITATION_DEEP_LINK"
  )
    return "ANONYMOUS";
  return "ORDINARY_PLAYER";
}

function compatibilityExpectation(routePattern) {
  const expectedDestination = {
    "/captain": "/captain/library",
    "/captain/invitations": "/captain/library",
    "/captain/sign-in": "/captain/library",
    "/player": "/player/library",
    "/quartermaster": "/captain/library",
    "/quartermaster/[workspace]": "/captain/library",
    "/studio": "/studio/library",
    "/studio/sign-in": "/studio/library",
  }[routePattern];
  if (expectedDestination) return { expectedDestination };
  if (routePattern === "/player/sign-in") return { expectedCompatibilityState: "SIGN_IN_SURFACE" };
  return { expectedCompatibilityState: "DECLARED_COMPATIBILITY_SURFACE" };
}

function semanticReadyMarkerFor(routePattern) {
  if (routePattern === "/captain/sessions/[sessionId]") return "CAPTAIN_OPERATIONAL_PROJECTION";
  if (routePattern === "/captain/voyages/[playthroughId]/muster") return "CAPTAIN_MUSTER_PROJECTION";
  if (routePattern === "/captain/voyages/[playthroughId]/player-preview") return "PLAYER_SAFE_PREVIEW";
  if (routePattern === "/studio/private-content/operations") return "PRIVATE_OPERATIONS_CONSOLE";
  return null;
}

function canonicalFiles(imageRoot, directory = path.join(imageRoot, "Canonical")) {
  if (!existsSync(directory)) return [];
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...canonicalFiles(imageRoot, absolute));
    else if (entry.isFile()) files.push(path.relative(imageRoot, absolute).split(path.sep).join("/"));
  }
  return files;
}

export function fileChecksum(file) {
  return sha256(readFileSync(file));
}

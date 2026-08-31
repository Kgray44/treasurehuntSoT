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

const ADMIN_PATHS = new Set(["/admin", "/admin/audit", "/admin/chronicles", "/admin/community", "/admin/configuration", "/admin/investigate", "/admin/operations", "/admin/people", "/admin/providers", "/admin/releases", "/admin/support/cases", "/admin/voyages"]);

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
  return `route-page-${value.replaceAll(/[^a-zA-Z0-9]+/gu, "-").replaceAll(/^-|-$/gu, "").toLowerCase()}`;
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
  if (routePattern === "/studio/private-content/operations") return "INTERNAL_NON_PAGE";
  if (TOKENIZED_ROUTES.has(routePattern)) return "TOKENIZED_OR_INVITATION_DEEP_LINK";
  if (COMPATIBILITY_ROUTES.has(routePattern)) return "COMPATIBILITY_OR_REDIRECT";
  if (routePattern.includes("[")) return "CONTEXTUAL_DYNAMIC_DESTINATION";
  return "USER_FACING_NAVIGABLE";
}

export function fallbackAuthentication(routePattern) {
  if (/^\/(sign-in|register|forgot-password|reset-password|verify-email)/u.test(routePattern)) return "ANONYMOUS_ALLOWED";
  if (TOKENIZED_ROUTES.has(routePattern)) return "BOUNDED_TOKEN_OR_CODE";
  if (routePattern.startsWith("/admin")) return "AUTHENTICATED_CAPABILITY_REQUIRED";
  if (routePattern.startsWith("/captain") || routePattern.startsWith("/studio")) return "AUTHENTICATED_CAPABILITY_REQUIRED";
  if (routePattern.startsWith("/player") || routePattern.startsWith("/passport")) return "AUTHENTICATED_PLAYER_REQUIRED";
  return "ANONYMOUS_ALLOWED";
}

export function fallbackCapabilities(routePattern) {
  if (routePattern.startsWith("/admin")) return ["admiralty"];
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
    const classification = LEGACY_CLASSIFICATIONS[prior?.classification] ?? fallbackClassification(routePattern);
    const capabilityRequirements = prior?.capabilityRequirements?.length
      ? prior.capabilityRequirements
      : fallbackCapabilities(routePattern);
    const authenticationRequirement = prior?.authenticationRequirement ?? fallbackAuthentication(routePattern);
    return {
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
      meaningfulVisualStates: meaningfulStates(priorScreen?.applicableStates ?? [], routePattern),
      desktopMobileApplicability: ["INTERNAL_NON_PAGE", "DEVELOPMENT_OR_DIAGNOSTIC"].includes(classification)
        ? "EXCLUDED"
        : "DESKTOP_AND_MOBILE",
      themesApplicable: ["INTERNAL_NON_PAGE", "DEVELOPMENT_OR_DIAGNOSTIC"].includes(classification) ? [] : [...REQUIRED_THEMES],
      motionApplicability: ["INTERNAL_NON_PAGE", "DEVELOPMENT_OR_DIAGNOSTIC"].includes(classification)
        ? "NOT_APPLICABLE"
        : "REDUCED_MOTION_REQUIRED",
      screenshotRequirements: ["INTERNAL_NON_PAGE", "DEVELOPMENT_OR_DIAGNOSTIC"].includes(classification)
        ? []
        : captureRequirementsFor({ routePattern, classification, authenticationRequirement, capabilityRequirements }),
      captureStatus: ["INTERNAL_NON_PAGE", "DEVELOPMENT_OR_DIAGNOSTIC"].includes(classification)
        ? "EXCLUDED_BY_CLASSIFICATION"
        : "PLANNED",
      provenance: prior ? "CURRENT_SOURCE_RECONCILED_WITH_LEGACY_CATALOG" : "CURRENT_SOURCE_DISCOVERED",
    };
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
  if (routePattern.startsWith("/admin")) return ["ADMIRALTY_OPERATOR", "ANONYMOUS"];
  if (capabilityRequirements.includes("moderator")) return ["MODERATOR", "ORDINARY_PLAYER"];
  if (capabilityRequirements.includes("captain")) return ["CAPTAIN_PLAYER", "ORDINARY_PLAYER"];
  if (capabilityRequirements.includes("creator")) return ["CREATOR", "ORDINARY_PLAYER"];
  if (capabilityRequirements.includes("player") || authenticationRequirement !== "ANONYMOUS_ALLOWED")
    return ["ORDINARY_PLAYER", "ANONYMOUS"];
  return ["ANONYMOUS"];
}

export function meaningfulStates(screenStates, routePattern) {
  const states = new Set(["READY"]);
  for (const state of screenStates) {
    const normalized = String(state).toUpperCase().replaceAll(/[^A-Z0-9]+/gu, "_");
    if (/EMPTY|LOADING|ERROR|UNAVAILABLE|DENIED|DISABLED|VALIDATION|SUCCESS|DESTRUCTIVE|MODAL|DRAWER|FOCUS|MOTION/u.test(normalized))
      states.add(normalized);
  }
  if (routePattern.startsWith("/admin")) states.add("UNAUTHORIZED");
  if (/^\/(account|passport|player|captain|studio)/u.test(routePattern)) states.add("SIGN_IN_REQUIRED");
  return [...states].sort();
}

export function captureRequirementsFor(route) {
  const persona = route.capabilityRequirements.includes("admiralty")
    ? "ADMIRALTY_OPERATOR"
    : route.capabilityRequirements.includes("moderator")
      ? "MODERATOR"
      : route.capabilityRequirements.includes("captain")
        ? "CAPTAIN_PLAYER"
        : route.capabilityRequirements.includes("creator")
          ? "CREATOR"
          : route.authenticationRequirement === "ANONYMOUS_ALLOWED" || route.classification === "TOKENIZED_OR_INVITATION_DEEP_LINK"
            ? "ANONYMOUS"
            : "ORDINARY_PLAYER";
  return REQUIRED_THEMES.flatMap((theme) =>
    REQUIRED_VIEWPORTS.map((viewport) => ({
      identity: `${route.routeId}|READY|${persona}|${theme}|${viewport.id}|REDUCED`,
      state: "READY",
      persona,
      theme,
      viewport: viewport.id,
      motionMode: "REDUCED",
      coverageKind: "ROUTE",
      criticality: route.classification === "CONTEXTUAL_DYNAMIC_DESTINATION" ? "HIGH" : "STANDARD",
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
    { routePattern: "/community/chronicles", state: "DELAYED_LOADING", persona: "ANONYMOUS", action: "COMMUNITY_LOADING" },
    { routePattern: "/community/chronicles", state: "ERROR", persona: "ANONYMOUS", action: "COMMUNITY_ERROR" },
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
  const contract = {
    schemaVersion: "1.0.0",
    artifact: "Voyagewright Brightwork visual capture contract",
    sourceSha: census.sourceSha,
    censusDigest: sha256(stableJson(census.routes)),
    generatedAt,
    requirements,
  };
  return { ...contract, contractDigest: sha256(stableJson(contract)) };
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
  return `${requirement.routeId}|${requirement.state}|${requirement.persona}|${requirement.theme}|${requirement.viewport}|${requirement.motionMode}`;
}

export function reconciliationReport({ contract, manifest, sourceSha, imageRoot, checksum = fileChecksum }) {
  const requirements = new Map(contract.requirements.map((requirement) => [requirementIdentity(requirement), requirement]));
  const captures = manifest?.records ?? [];
  const seen = new Map();
  const current = [];
  const stale = [];
  const missing = [];
  const blocked = [];
  const orphaned = [];
  const duplicates = [];
  const duplicateImageIds = [];
  const imageIds = new Set();
  for (const record of captures) {
    if (imageIds.has(record.imageId)) duplicateImageIds.push(record);
    imageIds.add(record.imageId);
    const identity = requirementIdentity(record);
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
    if (record.sourceSha !== sourceSha || record.contractDigest !== contract.contractDigest) {
      stale.push(record);
      continue;
    }
    const file = path.join(imageRoot, ...String(record.screenshotPath).split("/"));
    if (!existsSync(file) || checksum(file) !== record.sha256) {
      missing.push({ ...record, reconciliationReason: existsSync(file) ? "CHECKSUM_MISMATCH" : "IMAGE_MISSING" });
      continue;
    }
    current.push(record);
  }
  for (const [identity, requirement] of requirements)
    if (!seen.has(identity)) missing.push({ ...requirement, reconciliationReason: "REQUIRED_CAPTURE_MISSING" });
  const manifestPaths = new Set(captures.map((record) => String(record.screenshotPath).replaceAll("\\", "/")));
  const orphanedFiles = canonicalFiles(imageRoot).filter((screenshotPath) => !manifestPaths.has(screenshotPath)).map((screenshotPath) => ({
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
    duplicateCanonicalIdentities: duplicates.length,
    duplicateCanonicalImageIds: duplicateImageIds.length,
    excludedByClassification: excluded.length,
    overallCompleteness:
      stale.length === 0 && missing.length === 0 && allOrphaned.length === 0 && duplicates.length === 0 && duplicateImageIds.length === 0
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
    excluded,
  };
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

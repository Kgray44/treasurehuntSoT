import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { censusSummary, discoverAppRouteSources } from "../homeport/phase5-route-census.mjs";

const root = process.cwd();
const homeportRoot = path.join(root, "Development_Docs", "Projects", "Project_Homeport");

function indentJson(value, spaces) {
  const prefix = " ".repeat(spaces);
  return JSON.stringify(value, null, 2)
    .split("\n")
    .map((line) => `${prefix}${line}`)
    .join("\n");
}

function writeIfChanged(file, current, next) {
  if (next !== current) writeFileSync(file, next, "utf8");
}

function insertArrayRecords(file, arrayNeedle, identityKey, records) {
  const current = readFileSync(file, "utf8");
  const missing = records.filter((record) => !current.includes(`"${identityKey}": "${record[identityKey]}"`));
  if (!missing.length) return;
  const eol = current.includes("\r\n") ? "\r\n" : "\n";
  const insertion = missing.map((record) => indentJson(record, 4)).join(`,${eol}`);
  const next = current.replace(arrayNeedle, `${arrayNeedle}${insertion},${eol}`);
  if (next === current) throw new Error(`BRIDGEWATCH_RECORD_INSERTION_POINT_MISSING:${file}`);
  writeIfChanged(file, current, next);
}

const sources = discoverAppRouteSources(root);
const census = censusSummary(sources);
const expectedSources = [
  "src/app/bridgewatch/[[...path]]/route.ts",
  "src/app/api/internal/bridgewatch/authorize/route.ts",
];
for (const source of expectedSources)
  if (!sources.some((entry) => entry.sourceFile === source))
    throw new Error(`BRIDGEWATCH_ROUTE_SOURCE_MISSING:${source}`);

const gatewayRecord = {
  routeId: "route-route-bridgewatch-path",
  routePattern: "/bridgewatch/[[...path]]",
  implementationSource: "src/app/bridgewatch/[[...path]]/route.ts",
  kind: "route",
  classification: "API_OR_SERVICE",
  ownerProject: "project-admiralty",
  productArea: "Bridgewatch private developer tooling",
  shellMode: "TOKENIZED",
  logicalParent: "/admin",
  currentVisibleEntries: ["Bridgewatch"],
  currentDesktopPath: ["/admin", "/bridgewatch"],
  currentMobilePath: ["/admin", "/bridgewatch"],
  authenticationRequirement: "AUTHENTICATED_CAPABILITY_REQUIRED",
  capabilityRequirements: ["PLATFORM_OBSERVE"],
  returnOrBackRoute: "/admin",
  emptyStateAction: "SAFE_PRIVATE_UNAVAILABLE",
  dynamicSourceRouteOrContentSource: "TRUSTED_SERVER_BRIDGEWATCH_INTERNAL_URL",
  compatibilityAliases: [],
  redirects: [],
  currentSupportedStates: ["READ_ONLY_READY", "PRIVATE_NOT_FOUND", "PRIVATE_TOOL_UNAVAILABLE"],
  currentJourneys: [],
  currentVisualEvidenceIds: [],
  currentMaturity: "INTERNAL_ONLY",
  directUrlRequired: false,
  orphanedOrdinaryRoute: false,
  targetDisposition: "PRIVILEGED_INTERNAL_TOOL_GATEWAY",
  status: "IMPLEMENTED_PENDING_BROWSER_VALIDATION",
  notes:
    "Standalone loopback Bridgewatch remains separate; only allowlisted GET/HEAD dashboard, static, and observation API routes are proxied after canonical PLATFORM_OBSERVE authorization.",
};
const authRecord = {
  routeId: "route-route-api-internal-bridgewatch-authorize",
  routePattern: "/api/internal/bridgewatch/authorize",
  implementationSource: "src/app/api/internal/bridgewatch/authorize/route.ts",
  kind: "route",
  classification: "API_OR_SERVICE",
  ownerProject: "project-admiralty",
  productArea: "Bridgewatch private developer tooling",
  shellMode: "not-applicable",
  logicalParent: "/bridgewatch",
  currentVisibleEntries: [],
  currentDesktopPath: [],
  currentMobilePath: [],
  authenticationRequirement: "AUTHENTICATED_CAPABILITY_REQUIRED",
  capabilityRequirements: ["PLATFORM_OBSERVE"],
  returnOrBackRoute: null,
  emptyStateAction: "NO_BODY",
  dynamicSourceRouteOrContentSource: null,
  compatibilityAliases: [],
  redirects: [],
  currentSupportedStates: ["AUTHORIZED_NO_CONTENT", "PRIVATE_DENIAL"],
  currentJourneys: [],
  currentVisualEvidenceIds: [],
  currentMaturity: "INTERNAL_ONLY",
  directUrlRequired: false,
  orphanedOrdinaryRoute: false,
  targetDisposition: "NGINX_INTERNAL_AUTH_SUBREQUEST",
  status: "IMPLEMENTED_PENDING_BROWSER_VALIDATION",
  notes: "Canonical cookie-backed Admiralty authorization only; never forwards a credential or upstream address.",
};
const acceptedMainReconciliationRecord = {
  routeId: "route-route-api-studio-tales-taleid-migrations-blockid",
  routePattern: "/api/studio/tales/[taleId]/migrations/[blockId]",
  implementationSource: "src/app/api/studio/tales/[taleId]/migrations/[blockId]/route.ts",
  kind: "route",
  classification: "API_OR_SERVICE",
  ownerProject: "one-voyage",
  productArea: "Creator Studio",
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
  notes: "Reconciles the accepted Shipwright route added on main before the Bridgewatch gateway route census.",
  phase5Implementation: {
    phase: "PHASE_5_CLOSE_ROUTE_AND_INFORMATION_ARCHITECTURE_GAPS",
    startingSha: "54372224fc9bf4b4fb42797ca58a5a224ffdb92a",
    architectureFreezeSha: "bbe9659cc5077c834510c3e4db77aa362e45b6fd",
    implementationSourceSha: "06a0d1f38",
    state: "IMPLEMENTED_PENDING_BROWSER_VALIDATION",
    sourceParityOnly: true,
    humanReachabilityExcluded: true,
  },
};

const routeInventoryPath = path.join(homeportRoot, "Homeport_Route_Inventory.json");
insertArrayRecords(routeInventoryPath, '  "routes": [\n', "routeId", [
  acceptedMainReconciliationRecord,
  authRecord,
  gatewayRecord,
]);
let routes = readFileSync(routeInventoryPath, "utf8");
const routeRecords = JSON.parse(routes).routes;
for (const [name, value] of [
  ["routeFiles", routeRecords.length],
  ["pages", routeRecords.filter((record) => record.kind === "page").length],
  ["services", routeRecords.filter((record) => record.kind === "route").length],
  ["sourceDiscoveredPages", census.humanRouteCount],
  ["sourceDiscoveredServices", census.serviceRouteCount],
])
  routes = routes.replace(new RegExp(`("${name}": )\\d+`, "u"), `$1${value}`);
writeFileSync(routeInventoryPath, routes, "utf8");

const navigationRecord = {
  nodeId: "nav-bridgewatch-private-gateway",
  routeId: "route-route-bridgewatch-path",
  label: "Bridgewatch",
  controlId: "admiralty-bridgewatch",
  sourceScreen: "src/components/admiralty/AdmiraltyShell.tsx",
  destinationScreen: "/bridgewatch",
  desktopAvailability: true,
  mobileAvailability: true,
  authentication: "AUTHENTICATED_CAPABILITY_REQUIRED",
  capabilities: ["PLATFORM_OBSERVE"],
  hiddenCondition: "PLATFORM_OBSERVE_ABSENT",
  disabledCondition: null,
  redirectBehavior: "NONE_CANONICAL_PATH_IS_BRIDGEWATCH",
  currentStatus: "IMPLEMENTED_PENDING_BROWSER_VALIDATION",
  evidenceId: null,
};
insertArrayRecords(path.join(homeportRoot, "Homeport_Navigation_Map.json"), '  "edges": [\n', "nodeId", [
  navigationRecord,
]);

for (const [file, needles] of [
  [
    path.join(root, "testing", "ownership.json"),
    ["src/admiralty/bridgewatch-gateway*", "src/app/bridgewatch/**", "deploy/forever-treasure-bridgewatch.service"],
  ],
  [
    path.join(root, "testing", "impact-map.json"),
    ["src/admiralty/bridgewatch-gateway*", "src/app/bridgewatch/**", "deploy/*bridgewatch*"],
  ],
]) {
  const text = readFileSync(file, "utf8");
  for (const needle of needles)
    if (!text.includes(needle)) throw new Error(`BRIDGEWATCH_POLICY_RECORD_MISSING:${needle}`);
}

process.stdout.write(
  `${JSON.stringify({ status: "BRIDGEWATCH_HOMEPORT_GATEWAY_RECORDS_UPDATED", routes: census.sourceCount })}\n`,
);

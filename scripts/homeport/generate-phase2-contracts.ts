import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { navigationRegistry } from "../../src/navigation/registry";
import { classifyRoute } from "../../src/navigation/route-classification";
import { routePatternMatches } from "../../src/navigation/route-matching";
import type { NavigationItem, ShellMode } from "../../src/navigation/types";

const root = process.cwd();
const homeportRoot = path.join(root, "Development_Docs", "Projects", "Project_Homeport");
const routeInventoryPath = path.join(homeportRoot, "Homeport_Route_Inventory.json");
const outputRoot = process.env.HOMEPORT_PHASE2_OUTPUT_ROOT
  ? path.resolve(process.env.HOMEPORT_PHASE2_OUTPUT_ROOT)
  : homeportRoot;
mkdirSync(outputRoot, { recursive: true });
const modeRegistryPath = path.join(outputRoot, "Project_Homeport_Phase_2_Shell_Mode_Registry.json");
const navigationContractPath = path.join(
  outputRoot,
  "Project_Homeport_Phase_2_Navigation_Projection_Contract.json",
);
const parityPath = path.join(outputRoot, "Project_Homeport_Phase_2_Desktop_Mobile_Parity_Matrix.csv");
const exitPath = path.join(outputRoot, "Project_Homeport_Phase_2_Contextual_Exit_Matrix.csv");

type RouteRecord = Readonly<{
  routeId: string;
  routePattern: string;
  implementationSource: string;
  kind: string;
  ownerProject: string;
  authenticationRequirement: string;
  capabilityRequirements: readonly string[];
  returnOrBackRoute: string;
  currentVisualEvidenceIds: readonly string[];
  shellMode: string;
}>;

const routeInventory = JSON.parse(readFileSync(routeInventoryPath, "utf8")) as { routes: RouteRecord[] };
const sourceSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const generatedAt = "2026-08-01T23:00:00.000Z";
const globalModes = new Set<ShellMode>(["GATEWAY_STANDARD", "PUBLIC_STANDARD", "WORKSPACE_STANDARD"]);
const accountModes = new Set<ShellMode>([
  "GATEWAY_STANDARD",
  "PUBLIC_STANDARD",
  "WORKSPACE_STANDARD",
  "COMPACT",
  "IMMERSIVE",
]);

function contextualIds(routePattern: string, mode: ShellMode) {
  return navigationRegistry
    .filter((item) => item.layer === "CONTEXTUAL")
    .filter((item) => (item.shellModes as readonly ShellMode[]).includes(mode))
    .filter((item) => item.contextPatterns?.some((pattern) => routePatternMatches(routePattern, pattern)))
    .map((item) => item.id);
}

function modeRecord(route: RouteRecord) {
  const classified = classifyRoute(route.routePattern);
  const contextualNavigation = contextualIds(route.routePattern, classified.shellMode);
  return {
    routeId: route.routeId,
    routePattern: route.routePattern,
    implementationSource: route.implementationSource,
    mode: classified.shellMode,
    reason: classified.reason,
    globalNavigationVisibility: globalModes.has(classified.shellMode) ? "VISIBLE" : "TRANSFORMED_OR_HIDDEN",
    workspaceNavigationVisibility: classified.shellMode === "WORKSPACE_STANDARD" ? "CAPABILITY_PROJECTED" : "HIDDEN",
    accountControlVisibility: accountModes.has(classified.shellMode) ? "VISIBLE_WHEN_SAFE" : "HIDDEN",
    footerVisibility: ["PUBLIC_STANDARD", "WORKSPACE_STANDARD"].includes(classified.shellMode)
      ? "VISIBLE_WHERE_APPROPRIATE"
      : "HIDDEN",
    contextualNavigation,
    exitTarget: classified.exitTarget ?? null,
    mobileTransformation: globalModes.has(classified.shellMode)
      ? "SHARED_FUNCTIONAL_SET_IN_DRAWER"
      : ["COMPACT", "IMMERSIVE"].includes(classified.shellMode)
        ? "COMPACT_CONTEXT_AND_EXIT"
        : ["AUTHENTICATION", "TOKENIZED"].includes(classified.shellMode)
          ? "BRAND_AND_SAFE_RETURN"
          : "DEVELOPMENT_EXIT",
    authenticationRule: route.authenticationRequirement,
    capabilityRule: route.capabilityRequirements,
    activeStateFamily: classified.activeFamily ?? "NEVER_ACTIVE",
    evidence: route.currentVisualEvidenceIds,
    owner: classified.owner,
    canonicalRoute: classified.canonicalRoute ?? route.routePattern,
    phase2Status: "ARCHITECTURE_AND_SOURCE_IMPLEMENTED_PENDING_BROWSER_EVIDENCE",
  };
}

function destination(item: NavigationItem) {
  if (typeof item.href === "string") return item.href;
  if (item.id === "account-sign-in") return "SAFE_LOCAL_SIGN_IN_RETURN";
  if (item.id === "account-view-profile") return "PUBLIC_PROFILE_OR_PASSPORT_PROFILE";
  if (item.action === "sign-out") return "SIGN_OUT_ACTION";
  throw new Error(`UNKNOWN_DYNAMIC_DESTINATION:${item.id}`);
}

function testContracts(item: NavigationItem) {
  const shared = ["homeport.navigation.one-authority", "homeport.navigation.desktop-mobile-set-equality"];
  if (item.layer === "GLOBAL") shared.push("homeport.shell.global-navigation", "homeport.shell.active-state");
  if (item.layer === "WORKSPACE") shared.push("homeport.shell.workspace-switcher");
  if (item.layer === "ACCOUNT") shared.push("homeport.shell.account-menu");
  if (item.layer === "CONTEXTUAL") shared.push("homeport.navigation.contextual-parent");
  if (item.id.includes("community")) shared.push("homeport.community.global-reachability");
  return [...new Set(shared)];
}

const pageRecords = routeInventory.routes.filter((route) => route.kind.toLowerCase() === "page").map(modeRecord);
const modeCounts = Object.fromEntries(
  [...new Set(pageRecords.map((record) => record.mode))]
    .sort()
    .map((mode) => [mode, pageRecords.filter((record) => record.mode === mode).length]),
);

const modeRegistry = {
  schemaVersion: "2.0.0",
  phase: "PHASE_2_RESTORE_GLOBAL_SHELL_AND_WAYFINDING",
  sourceSha,
  generatedAt,
  canonicalAuthority: "src/navigation/route-classification.ts",
  validModes: [
    "GATEWAY_STANDARD",
    "PUBLIC_STANDARD",
    "WORKSPACE_STANDARD",
    "COMPACT",
    "IMMERSIVE",
    "AUTHENTICATION",
    "TOKENIZED",
    "DEVELOPMENT",
  ],
  modeCounts,
  pageCount: pageRecords.length,
  apiRoutesExcluded: true,
  records: pageRecords,
};

const navigationRecords = (navigationRegistry as readonly NavigationItem[]).map((item) => ({
  itemId: item.id,
  label: item.label,
  layer: item.layer,
  destination: destination(item),
  description: item.description ?? null,
  owner: item.owner,
  requiredCapabilities: item.requiredCapabilities ?? [],
  requiresAuthentication: item.requiresAuthentication ?? false,
  anonymousOnly: item.anonymousOnly ?? false,
  authenticatedOnly: item.authenticatedOnly ?? false,
  shellModes: item.shellModes,
  desktopPlacement: item.desktop,
  mobilePlacement: item.mobile,
  activePolicy: item.activeMatch,
  parentId: item.parentId ?? null,
  accountGroup: item.accountGroup ?? null,
  contextualPatterns: item.contextPatterns ?? [],
  action: item.action ?? null,
  order: item.order,
  currentStatus: item.currentStatus,
  testContracts: testContracts(item),
}));

const navigationContract = {
  schemaVersion: "2.0.0",
  phase: "PHASE_2_RESTORE_GLOBAL_SHELL_AND_WAYFINDING",
  sourceSha,
  generatedAt,
  canonicalAuthority: "src/navigation/registry.ts",
  projectionAuthority: "src/navigation/navigation-projection.ts",
  layers: ["GLOBAL", "WORKSPACE", "ACCOUNT", "CONTEXTUAL"],
  activePolicies: ["EXACT", "SECTION", "DYNAMIC_FAMILY", "ALIAS_OF", "NEVER_ACTIVE"],
  capabilitySource: "PHASE_1_CURRENT_USER_PROVIDER_ONLY",
  viewportRule: "EQUIVALENT_STATE_FUNCTIONAL_DESTINATION_IDS_EQUAL",
  records: navigationRecords,
};

function csvCell(value: unknown) {
  const text = Array.isArray(value) ? value.join(";") : value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function csv(headers: readonly string[], rows: readonly Readonly<Record<string, unknown>>[]) {
  return `${headers.map(csvCell).join(",")}\n${rows
    .map((row) => headers.map((header) => csvCell(row[header])).join(","))
    .join("\n")}\n`;
}

const parityHeaders = [
  "navigation_item_id",
  "desktop_layer",
  "desktop_control",
  "mobile_layer",
  "mobile_control",
  "capability",
  "account_state",
  "destination",
  "evidence",
  "parity_status",
  "exception_rationale",
] as const;
const parityRows = navigationRecords
  .filter((item) => item.desktopPlacement !== "hidden" || item.mobilePlacement !== "hidden")
  .map((item) => ({
    navigation_item_id: item.itemId,
    desktop_layer: item.layer,
    desktop_control: item.desktopPlacement,
    mobile_layer: item.layer,
    mobile_control: item.mobilePlacement,
    capability: item.requiredCapabilities,
    account_state: item.anonymousOnly ? "ANONYMOUS_OR_ENDED_SESSION" : item.authenticatedOnly ? "AUTHENTICATED" : "ALL",
    destination: item.destination,
    evidence: "PENDING_PHASE_2_BROWSER_EVIDENCE",
    parity_status: item.desktopPlacement !== "hidden" && item.mobilePlacement !== "hidden" ? "EXACT_FUNCTIONAL_PARITY" : "GOVERNED_EXCEPTION",
    exception_rationale:
      item.desktopPlacement !== "hidden" && item.mobilePlacement !== "hidden" ? "" : "Compatibility alias is never rendered.",
  }));

const exitHeaders = [
  "route",
  "owner",
  "current_purpose",
  "current_account_access",
  "current_exit_control",
  "canonical_exit_target",
  "desktop_placement",
  "mobile_placement",
  "keyboard_operation",
  "reduced_motion_behavior",
  "session_continuity",
  "evidence",
  "status",
] as const;
const exitRows = pageRecords
  .filter((record) => record.mode === "COMPACT" || record.mode === "IMMERSIVE")
  .map((record) => ({
    route: record.routePattern,
    owner: record.owner,
    current_purpose: record.reason,
    current_account_access: "VISIBLE_WHEN_SAFE",
    current_exit_control: "HOMEPORT_CONTEXTUAL_EXIT",
    canonical_exit_target: record.exitTarget,
    desktop_placement: "CONTEXT_BAR",
    mobile_placement: "COMPACT_CONTEXT_BAR",
    keyboard_operation: "TAB_AND_ENTER",
    reduced_motion_behavior: "IMMEDIATE_NO_LARGE_TRAVEL",
    session_continuity: "NAVIGATION_ONLY_NO_PROGRESSION_MUTATION",
    evidence: "PENDING_PHASE_2_BROWSER_EVIDENCE",
    status: "SOURCE_IMPLEMENTED_PENDING_BROWSER_EVIDENCE",
  }));

const outputs = new Map<string, string>([
  [modeRegistryPath, `${JSON.stringify(modeRegistry, null, 2)}\n`],
  [navigationContractPath, `${JSON.stringify(navigationContract, null, 2)}\n`],
  [parityPath, csv(parityHeaders, parityRows)],
  [exitPath, csv(exitHeaders, exitRows)],
]);

const checkOnly = process.argv.includes("--check");
let drift = false;
for (const [file, content] of outputs) {
  if (checkOnly) {
    const current = readFileSync(file, "utf8");
    if (current !== content) {
      console.error(`PHASE_2_CONTRACT_DRIFT:${path.relative(root, file).replaceAll("\\", "/")}`);
      drift = true;
    }
  } else {
    writeFileSync(file, content, "utf8");
    console.log(`WROTE:${path.relative(root, file).replaceAll("\\", "/")}`);
  }
}
if (drift) process.exitCode = 1;
else console.log(checkOnly ? "PHASE_2_CONTRACTS_IDEMPOTENT" : "PHASE_2_CONTRACTS_GENERATED");

import { readFileSync } from "node:fs";
import path from "node:path";
import { navigationRegistry } from "../../src/navigation/registry";
import { classifyRoute } from "../../src/navigation/route-classification";
import type { ShellMode } from "../../src/navigation/types";

const root = process.cwd();
const homeportRoot = path.join(root, "Development_Docs", "Projects", "Project_Homeport");
const readJson = <T>(file: string) => JSON.parse(readFileSync(path.join(homeportRoot, file), "utf8")) as T;
const failures: string[] = [];
const fail = (message: string) => failures.push(message);

type ModeRecord = {
  routeId: string;
  routePattern: string;
  mode: ShellMode;
  exitTarget: string | null;
  accountControlVisibility: string;
};
type NavigationRecord = {
  itemId: string;
  layer: string;
  destination: string;
  owner: string;
  requiredCapabilities: string[];
  shellModes: ShellMode[];
  desktopPlacement: string;
  mobilePlacement: string;
  activePolicy: { type: string; canonicalItemId?: string };
  parentId: string | null;
  action: string | null;
};

const routes = readJson<{ routes: Array<{ routeId: string; routePattern: string; kind: string }> }>(
  "Homeport_Route_Inventory.json",
).routes;
const modes = readJson<{
  validModes: ShellMode[];
  pageCount: number;
  apiRoutesExcluded: boolean;
  records: ModeRecord[];
}>("Project_Homeport_Phase_2_Shell_Mode_Registry.json");
const navigation = readJson<{ layers: string[]; activePolicies: string[]; records: NavigationRecord[] }>(
  "Project_Homeport_Phase_2_Navigation_Projection_Contract.json",
);

const pageRoutes = routes.filter((route) => route.kind.toLowerCase() === "page");
if (modes.pageCount !== pageRoutes.length || modes.records.length !== pageRoutes.length)
  fail(`PAGE_COUNT_MISMATCH:${modes.records.length}:${pageRoutes.length}`);
if (!modes.apiRoutesExcluded || modes.records.some((record) => record.routePattern.startsWith("/api")))
  fail("API_ROUTE_CLASSIFIED_AS_PAGE");
const validModes = new Set<ShellMode>([
  "GATEWAY_STANDARD",
  "PUBLIC_STANDARD",
  "WORKSPACE_STANDARD",
  "COMPACT",
  "IMMERSIVE",
  "AUTHENTICATION",
  "TOKENIZED",
  "DEVELOPMENT",
]);
if (new Set(modes.validModes).size !== validModes.size || modes.validModes.some((mode) => !validModes.has(mode)))
  fail("INVALID_MODE_VOCABULARY");
for (const route of pageRoutes) {
  const records = modes.records.filter((record) => record.routeId === route.routeId);
  if (records.length !== 1) fail(`PAGE_MODE_CARDINALITY:${route.routeId}:${records.length}`);
  const record = records[0];
  if (!record) continue;
  if (!validModes.has(record.mode)) fail(`INVALID_MODE:${route.routeId}:${record.mode}`);
  if (classifyRoute(route.routePattern).shellMode !== record.mode) fail(`RUNTIME_MODE_DRIFT:${route.routeId}`);
  if (["COMPACT", "IMMERSIVE"].includes(record.mode) && !record.exitTarget?.startsWith("/"))
    fail(`MISSING_EXIT:${route.routeId}`);
}

const navigationIds = navigation.records.map((record) => record.itemId);
if (new Set(navigationIds).size !== navigationIds.length) fail("DUPLICATE_NAVIGATION_ID");
const runtimeIds = navigationRegistry.map((item) => item.id).sort();
if (JSON.stringify([...navigationIds].sort()) !== JSON.stringify(runtimeIds)) fail("RUNTIME_NAVIGATION_ID_DRIFT");
for (const layer of ["GLOBAL", "WORKSPACE", "ACCOUNT", "CONTEXTUAL"])
  if (!navigation.layers.includes(layer)) fail(`MISSING_LAYER:${layer}`);
for (const policy of ["EXACT", "SECTION", "DYNAMIC_FAMILY", "ALIAS_OF", "NEVER_ACTIVE"])
  if (!navigation.activePolicies.includes(policy)) fail(`MISSING_ACTIVE_POLICY:${policy}`);
const capabilities = new Set(["player", "captain", "creator", "moderator", "administrator"]);
for (const record of navigation.records) {
  if (
    !record.destination.startsWith("/") &&
    !["SAFE_LOCAL_SIGN_IN_RETURN", "PUBLIC_PROFILE_OR_PASSPORT_PROFILE", "SIGN_OUT_ACTION"].includes(record.destination)
  )
    fail(`INVALID_DESTINATION:${record.itemId}`);
  if (record.requiredCapabilities.some((capability) => !capabilities.has(capability)))
    fail(`INVALID_CAPABILITY:${record.itemId}`);
  if (record.parentId && !navigationIds.includes(record.parentId)) fail(`INVALID_PARENT:${record.itemId}`);
  if ((record.desktopPlacement === "hidden") !== (record.mobilePlacement === "hidden"))
    fail(`DESKTOP_MOBILE_PLACEMENT_DRIFT:${record.itemId}`);
  if (record.itemId.includes("moderator") && !record.requiredCapabilities.includes("moderator"))
    fail(`UNGUARDED_PRIVILEGED_ITEM:${record.itemId}`);
  if (record.activePolicy.type === "ALIAS_OF" && !navigationIds.includes(record.activePolicy.canonicalItemId ?? ""))
    fail(`INVALID_ALIAS_TARGET:${record.itemId}`);
}

const parity = readFileSync(
  path.join(homeportRoot, "Project_Homeport_Phase_2_Desktop_Mobile_Parity_Matrix.csv"),
  "utf8",
);
for (const record of navigation.records.filter(
  (record) => record.desktopPlacement !== "hidden" || record.mobilePlacement !== "hidden",
)) {
  if (!parity.includes(`"${record.itemId}"`)) fail(`MISSING_PARITY_ROW:${record.itemId}`);
}
const exitMatrix = readFileSync(path.join(homeportRoot, "Project_Homeport_Phase_2_Contextual_Exit_Matrix.csv"), "utf8");
for (const record of modes.records.filter((record) => record.mode === "COMPACT" || record.mode === "IMMERSIVE")) {
  if (!exitMatrix.includes(`"${record.routePattern}"`)) fail(`MISSING_EXIT_ROW:${record.routeId}`);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log("ARTIFACT_SCHEMA_VALID");
  console.log("PHASE_2_SHELL_CONFORMING");
  console.log("PRODUCT_NONCONFORMITIES_PRESENT");
}

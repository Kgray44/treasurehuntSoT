import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { censusSummary, discoverAppRouteSources } from "./phase5-route-census.mjs";
import {
  capabilityIds,
  classificationForPath,
  knownPagePatterns,
  routeClassifications,
  shellModes,
} from "./phase5-route-policy.mjs";

const moduleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const auditRoot = path.join(moduleRoot, "Development_Docs", "Projects", "Project_Homeport");
const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

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
  const [headers = [], ...data] = rows;
  return data.map((values) => Object.fromEntries(headers.map((header, column) => [header, values[column] ?? ""])));
}

const readJson = (name) => JSON.parse(readFileSync(path.join(auditRoot, name), "utf8"));
const readCsv = (name) => parseCsv(readFileSync(path.join(auditRoot, name), "utf8"));

function assertUnique(items, key, errors, label) {
  const values = items.map((item) => item[key]);
  const duplicates = values.filter((value, index) => values.indexOf(value) !== index);
  if (duplicates.length) errors.push(`${label}_DUPLICATE:${[...new Set(duplicates)].join(",")}`);
}

function assertRequired(object, fields, errors, label) {
  for (const field of fields) {
    if (!Object.hasOwn(object, field) || object[field] === undefined) errors.push(`${label}_MISSING_FIELD:${field}`);
  }
}

function edgeAllowed(edge, profile) {
  if (edge.authenticationState === "TOKENIZED") return false;
  if (edge.authenticationState === "ANONYMOUS" && profile.authentication !== "ANONYMOUS") return false;
  if (edge.authenticationState === "AUTHENTICATED" && profile.authentication !== "AUTHENTICATED") return false;
  return edge.requiredCapabilities.every((capability) => profile.capabilities.includes(capability));
}

function independentlyReachable(rootRouteId, edges, profile) {
  const visited = new Set([rootRouteId]);
  const queue = [rootRouteId];
  while (queue.length) {
    const current = queue.shift();
    for (const edge of edges) {
      if (edge.sourceRouteId !== current || !edgeAllowed(edge, profile) || visited.has(edge.targetRouteId)) continue;
      visited.add(edge.targetRouteId);
      queue.push(edge.targetRouteId);
    }
  }
  return visited;
}

function assertAcyclic(nodes, relation, errors, label) {
  const byId = new Map(nodes.map((node) => [node.routeId, node]));
  for (const node of nodes) {
    const seen = new Set([node.routeId]);
    let cursor = node;
    while (cursor?.[relation]) {
      const next = cursor[relation];
      if (next === cursor.routeId) break;
      if (seen.has(next)) {
        errors.push(`${label}_CYCLE:${node.routeId}`);
        break;
      }
      seen.add(next);
      cursor = byId.get(next);
    }
  }
}

export function validatePhase5Reachability(root = moduleRoot) {
  if (path.resolve(root) !== moduleRoot) throw new Error("PHASE5_VALIDATOR_MUST_RUN_FROM_ITS_OWN_REPOSITORY");

  const errors = [];
  const sources = discoverAppRouteSources(root);
  const census = censusSummary(sources);
  const pageSources = sources.filter((source) => source.kind === "page");
  const serviceSources = sources.filter((source) => source.kind === "route");
  const sourceFiles = new Set([...pageSources, ...serviceSources].map((source) => source.sourceFile));
  const sourcePagePatterns = new Set(pageSources.map((source) => source.pathPattern));
  const policyPatterns = new Set(knownPagePatterns);

  if (sourcePagePatterns.size !== pageSources.length) errors.push("SOURCE_PAGE_PATTERN_DUPLICATE");
  for (const pattern of sourcePagePatterns)
    if (!policyPatterns.has(pattern)) errors.push(`SOURCE_PAGE_UNCLASSIFIED:${pattern}`);
  for (const pattern of policyPatterns)
    if (!sourcePagePatterns.has(pattern)) errors.push(`POLICY_PAGE_PHANTOM:${pattern}`);

  const nodeRegistry = readJson("Project_Homeport_Phase_5_Route_Node_Registry.json");
  const edgeRegistry = readJson("Project_Homeport_Phase_5_Route_Edge_Registry.json");
  const graph = readJson("Project_Homeport_Phase_5_Route_Reachability_Graph.json");
  const inventory = readJson("Homeport_Route_Inventory.json");
  const nodes = nodeRegistry.nodes;
  const edges = edgeRegistry.edges;
  const nodeById = new Map(nodes.map((node) => [node.routeId, node]));
  const nodeByPath = new Map(nodes.map((node) => [node.pathPattern, node]));
  const edgeById = new Map(edges.map((edge) => [edge.edgeId, edge]));

  if (nodeRegistry.phase !== 5 || edgeRegistry.phase !== 5 || graph.phase !== 5) errors.push("PHASE_METADATA_INVALID");
  if (JSON.stringify(nodeRegistry.classifications) !== JSON.stringify(routeClassifications))
    errors.push("CLASSIFICATION_VOCABULARY_DRIFT");
  if (JSON.stringify(nodeRegistry.shellModes) !== JSON.stringify(shellModes))
    errors.push("SHELL_MODE_VOCABULARY_DRIFT");
  if (JSON.stringify(nodeRegistry.capabilities) !== JSON.stringify(capabilityIds))
    errors.push("CAPABILITY_VOCABULARY_DRIFT");
  if (graph.nodeRegistryDigest !== digest(nodeRegistry)) errors.push("NODE_REGISTRY_DIGEST_MISMATCH");
  if (graph.edgeRegistryDigest !== digest(edgeRegistry)) errors.push("EDGE_REGISTRY_DIGEST_MISMATCH");
  if (graph.rootRouteId !== nodeByPath.get("/")?.routeId) errors.push("GRAPH_ROOT_INVALID");

  assertUnique(nodes, "routeId", errors, "NODE_ID");
  assertUnique(nodes, "sourceFile", errors, "NODE_SOURCE");
  assertUnique(nodes, "pathPattern", errors, "NODE_PATTERN");
  assertUnique(edges, "edgeId", errors, "EDGE_ID");
  if (nodes.length !== pageSources.length)
    errors.push(`NODE_SOURCE_COUNT_MISMATCH:${nodes.length}:${pageSources.length}`);

  const nodeFields = [
    "routeId",
    "pathPattern",
    "sourceFile",
    "classification",
    "productArea",
    "specialistOwner",
    "integrationOwner",
    "shellMode",
    "logicalParentRouteId",
    "canonicalRouteId",
    "activeNavigationOwner",
    "authentication",
    "requiredCapabilities",
    "anonymousAvailability",
    "desktopAvailability",
    "mobileAvailability",
    "dynamicParameters",
    "dynamicSourceRequired",
    "tokenized",
    "compatibility",
    "deprecated",
    "ordinaryCompletionStatus",
    "returnFallback",
    "sourceCollectionIds",
    "entryEdgeIds",
    "exitEdgeIds",
  ];
  for (const node of nodes) {
    assertRequired(node, nodeFields, errors, `NODE:${node.routeId}`);
    if (!sourceFiles.has(node.sourceFile)) errors.push(`NODE_SOURCE_MISSING:${node.routeId}:${node.sourceFile}`);
    if (classificationForPath(node.pathPattern) !== node.classification)
      errors.push(`NODE_CLASSIFICATION_DRIFT:${node.pathPattern}`);
    if (!routeClassifications.includes(node.classification)) errors.push(`NODE_CLASSIFICATION_INVALID:${node.routeId}`);
    if (!shellModes.includes(node.shellMode)) errors.push(`NODE_SHELL_INVALID:${node.routeId}`);
    if (node.logicalParentRouteId && !nodeById.has(node.logicalParentRouteId))
      errors.push(`NODE_PARENT_MISSING:${node.routeId}`);
    if (!nodeById.has(node.canonicalRouteId)) errors.push(`NODE_CANONICAL_MISSING:${node.routeId}`);
    for (const capability of node.requiredCapabilities)
      if (!capabilityIds.includes(capability)) errors.push(`NODE_CAPABILITY_INVALID:${node.routeId}:${capability}`);
    for (const edgeId of node.entryEdgeIds)
      if (!edgeById.has(edgeId)) errors.push(`NODE_ENTRY_EDGE_MISSING:${node.routeId}:${edgeId}`);
    for (const edgeId of node.exitEdgeIds)
      if (!edgeById.has(edgeId)) errors.push(`NODE_EXIT_EDGE_MISSING:${node.routeId}:${edgeId}`);
    if (
      node.classification === "CONTEXTUAL_DYNAMIC" &&
      (!node.dynamicParameters.length || !node.sourceCollectionIds.length)
    )
      errors.push(`DYNAMIC_SOURCE_CONTRACT_MISSING:${node.routeId}`);
    if (node.classification === "TOKENIZED_DEEP_LINK" && !node.tokenized)
      errors.push(`TOKEN_CLASSIFICATION_DRIFT:${node.routeId}`);
    if (["AUTH_COMPATIBILITY_ALIAS", "REDIRECT_ALIAS"].includes(node.classification) && !node.compatibility)
      errors.push(`COMPATIBILITY_CLASSIFICATION_DRIFT:${node.routeId}`);
  }
  assertAcyclic(nodes, "logicalParentRouteId", errors, "PARENT");
  assertAcyclic(nodes, "canonicalRouteId", errors, "CANONICAL");

  const edgeFields = [
    "edgeId",
    "edgeType",
    "sourceRouteId",
    "targetRouteId",
    "visibleControlId",
    "accessibleLabel",
    "desktop",
    "mobile",
    "pointer",
    "keyboard",
    "touch",
    "authenticationState",
    "requiredCapabilities",
    "queryContract",
    "fragmentContract",
    "allowedWhen",
    "forbiddenWhen",
    "safeReturn",
    "stableFallback",
    "currentStatus",
    "sourceFile",
    "sourceNeedle",
  ];
  const ordinaryNavigationTypes = new Set([
    "ACCOUNT_NAV",
    "DISTRICT_NAV",
    "GLOBAL_NAV",
    "SECTION_NAV",
    "WORKSPACE_NAV",
  ]);
  for (const edge of edges) {
    assertRequired(edge, edgeFields, errors, `EDGE:${edge.edgeId}`);
    const sourceNode = nodeById.get(edge.sourceRouteId);
    const targetNode = nodeById.get(edge.targetRouteId);
    if (!sourceNode) errors.push(`EDGE_SOURCE_NODE_MISSING:${edge.edgeId}`);
    if (!targetNode) errors.push(`EDGE_TARGET_NODE_MISSING:${edge.edgeId}`);
    if (![edge.desktop, edge.mobile, edge.pointer, edge.keyboard, edge.touch].every(Boolean))
      errors.push(`EDGE_INPUT_PARITY_MISSING:${edge.edgeId}`);
    for (const capability of edge.requiredCapabilities)
      if (!capabilityIds.includes(capability)) errors.push(`EDGE_CAPABILITY_INVALID:${edge.edgeId}:${capability}`);
    const sourcePath = path.join(root, edge.sourceFile);
    if (!existsSync(sourcePath)) errors.push(`EDGE_SOURCE_FILE_MISSING:${edge.edgeId}:${edge.sourceFile}`);
    else if (!readFileSync(sourcePath, "utf8").includes(edge.sourceNeedle))
      errors.push(`EDGE_SOURCE_NEEDLE_MISSING:${edge.edgeId}:${edge.sourceNeedle}`);
    if (sourceNode && !sourceNode.exitEdgeIds.includes(edge.edgeId))
      errors.push(`EDGE_SOURCE_BACKREF_MISSING:${edge.edgeId}`);
    if (targetNode && !targetNode.entryEdgeIds.includes(edge.edgeId))
      errors.push(`EDGE_TARGET_BACKREF_MISSING:${edge.edgeId}`);
    if (targetNode?.tokenized && ordinaryNavigationTypes.has(edge.edgeType))
      errors.push(`TOKEN_ROUTE_IN_ORDINARY_NAV:${edge.edgeId}`);
    if (targetNode?.compatibility && ordinaryNavigationTypes.has(edge.edgeType))
      errors.push(`COMPAT_ROUTE_IN_ORDINARY_NAV:${edge.edgeId}`);
  }

  for (const node of nodes.filter((item) => item.classification === "CONTEXTUAL_DYNAMIC")) {
    if (!edges.some((edge) => edge.targetRouteId === node.routeId && edge.sourceDataFamily))
      errors.push(`DYNAMIC_INCOMING_SOURCE_EDGE_MISSING:${node.routeId}`);
  }
  for (const node of nodes.filter((item) => ["USER_NAVIGABLE", "CONTEXTUAL_DYNAMIC"].includes(item.classification))) {
    if (node.pathPattern !== "/" && !node.entryEdgeIds.length) errors.push(`REACHABLE_ENTRY_MISSING:${node.routeId}`);
    if (node.pathPattern !== "/" && !node.exitEdgeIds.length) errors.push(`STABLE_EXIT_MISSING:${node.routeId}`);
  }

  const independentProfiles = graph.profiles.map((profile) => ({
    id: profile.id,
    authentication: profile.authentication,
    capabilities: profile.capabilities,
    reachable: independentlyReachable(graph.rootRouteId, edges, profile),
  }));
  for (const profile of graph.profiles) {
    const independent = independentProfiles.find((candidate) => candidate.id === profile.id).reachable;
    const declared = new Set(profile.reachableRouteIds);
    for (const id of independent) if (!declared.has(id)) errors.push(`GRAPH_PROFILE_UNDERSTATES:${profile.id}:${id}`);
    for (const id of declared) if (!independent.has(id)) errors.push(`GRAPH_PROFILE_OVERSTATES:${profile.id}:${id}`);
  }
  for (const node of nodes.filter((item) => ["USER_NAVIGABLE", "CONTEXTUAL_DYNAMIC"].includes(item.classification))) {
    if (!independentProfiles.some((profile) => profile.reachable.has(node.routeId)))
      errors.push(`NATURAL_PATH_UNREACHABLE:${node.routeId}`);
  }
  for (const node of nodes.filter((item) => item.requiredCapabilities.length)) {
    for (const profile of independentProfiles.filter((item) => item.authentication === "AUTHENTICATED")) {
      if (
        node.requiredCapabilities.some((capability) => !profile.capabilities.includes(capability)) &&
        profile.reachable.has(node.routeId)
      )
        errors.push(`CAPABILITY_BOUNDARY_BYPASSED:${profile.id}:${node.routeId}`);
    }
  }

  const currentInventorySources = inventory.routes.map((route) => route.implementationSource);
  assertUnique(inventory.routes, "routeId", errors, "INVENTORY_ID");
  assertUnique(inventory.routes, "implementationSource", errors, "INVENTORY_SOURCE");
  if (inventory.routes.length !== pageSources.length + serviceSources.length)
    errors.push("INVENTORY_TOTAL_SOURCE_MISMATCH");
  for (const source of sourceFiles)
    if (!currentInventorySources.includes(source)) errors.push(`INVENTORY_SOURCE_MISSING:${source}`);
  for (const source of currentInventorySources)
    if (!sourceFiles.has(source)) errors.push(`INVENTORY_SOURCE_PHANTOM:${source}`);
  if (inventory.totals.pages !== pageSources.length || inventory.totals.services !== serviceSources.length)
    errors.push("INVENTORY_DERIVED_TOTALS_INVALID");
  if (inventory.totals.orphanedOrdinaryRoutes !== 0) errors.push("INVENTORY_ORPHAN_TOTAL_NONZERO");
  for (const route of inventory.routes.filter((item) => item.kind === "page")) {
    const node = nodes.find((item) => item.sourceFile === route.implementationSource);
    if (!node) errors.push(`INVENTORY_PAGE_NODE_MISSING:${route.routeId}`);
    else if (route.classification !== node.classification || route.orphanedOrdinaryRoute)
      errors.push(`INVENTORY_PAGE_POLICY_DRIFT:${route.routeId}`);
  }
  for (const route of inventory.routes.filter((item) => item.kind === "route"))
    if (route.classification !== "API_OR_SERVICE") errors.push(`SERVICE_CLASSIFICATION_INVALID:${route.routeId}`);

  const matrices = {
    dynamic: readCsv("Project_Homeport_Phase_5_Dynamic_Source_Matrix.csv"),
    token: readCsv("Project_Homeport_Phase_5_Tokenized_Route_Matrix.csv"),
    compatibility: readCsv("Project_Homeport_Phase_5_Compatibility_Route_Ledger.csv"),
    deadEnd: readCsv("Project_Homeport_Phase_5_Dead_End_and_Return_Matrix.csv"),
    parity: readCsv("Project_Homeport_Phase_5_Desktop_Mobile_Reachability_Matrix.csv"),
    natural: readCsv("Project_Homeport_Phase_5_Natural_Path_Matrix.csv"),
  };
  const count = (classification) => nodes.filter((node) => node.classification === classification).length;
  if (matrices.dynamic.length !== count("CONTEXTUAL_DYNAMIC")) errors.push("DYNAMIC_MATRIX_COVERAGE_INVALID");
  if (matrices.token.length !== count("TOKENIZED_DEEP_LINK")) errors.push("TOKEN_MATRIX_COVERAGE_INVALID");
  if (matrices.compatibility.length !== count("AUTH_COMPATIBILITY_ALIAS") + count("REDIRECT_ALIAS"))
    errors.push("COMPATIBILITY_MATRIX_COVERAGE_INVALID");
  if (matrices.deadEnd.length !== count("USER_NAVIGABLE") + count("CONTEXTUAL_DYNAMIC"))
    errors.push("DEAD_END_MATRIX_COVERAGE_INVALID");
  if (matrices.parity.length !== count("USER_NAVIGABLE")) errors.push("PARITY_MATRIX_COVERAGE_INVALID");
  if (matrices.natural.length !== count("USER_NAVIGABLE") + count("CONTEXTUAL_DYNAMIC"))
    errors.push("NATURAL_MATRIX_COVERAGE_INVALID");
  if (matrices.natural.some((row) => row.result === "UNREACHABLE_DEFECT" || row.returnProof === "MISSING"))
    errors.push("NATURAL_MATRIX_CONTAINS_DEFECT");
  if (matrices.deadEnd.some((row) => row.status === "UNREACHABLE_DEFECT"))
    errors.push("DEAD_END_MATRIX_CONTAINS_DEFECT");

  const summary = {
    outcome: errors.length ? "PHASE5_REACHABILITY_INVALID" : "PHASE5_REACHABILITY_VALID",
    errors,
    sourceCount: census.sourceCount,
    pageSources: pageSources.length,
    serviceSources: serviceSources.length,
    nodes: nodes.length,
    edges: edges.length,
    ordinaryRoutes: count("USER_NAVIGABLE"),
    contextualRoutes: count("CONTEXTUAL_DYNAMIC"),
    tokenizedRoutes: count("TOKENIZED_DEEP_LINK"),
    compatibilityRoutes: count("AUTH_COMPATIBILITY_ALIAS") + count("REDIRECT_ALIAS"),
    unexplainedOrdinaryOrphans: errors.filter((error) => error.startsWith("NATURAL_PATH_UNREACHABLE")).length,
  };
  if (errors.length) throw new Error(`${summary.outcome}\n${errors.join("\n")}`);
  return summary;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.stdout.write(`${JSON.stringify(validatePhase5Reachability(), null, 2)}\n`);
}

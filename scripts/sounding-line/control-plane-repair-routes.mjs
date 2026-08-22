/* Build and enforce repair-route coverage from current protected prerequisites. */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { rootMaintenanceEligiblePathGlobs } from "./root-maintenance.mjs";

const normalized = (value) => value.replaceAll("\\", "/");
const glob = (pattern) =>
  new RegExp(
    `^${pattern
      .replace(/[|\\{}()[\]^$+?.]/gu, "\\$&")
      .replace(/\*\*/gu, "::DS::")
      .replace(/\*/gu, "[^/]*")
      .replace(/::DS::/gu, ".*")}$`,
    "u",
  );
const matches = (file, patterns) => (patterns ?? []).some((pattern) => glob(pattern).test(file));
const exists = async (root, relative) =>
  readFile(path.join(root, relative), "utf8")
    .then(() => true)
    .catch(() => false);

async function walk(root, relative) {
  const directory = path.join(root, relative);
  const entries = await readdir(directory, { withFileTypes: true });
  const output = [];
  for (const entry of entries) {
    const child = normalized(path.join(relative, entry.name));
    if (entry.isDirectory()) output.push(...(await walk(root, child)));
    else if (entry.isFile()) output.push(child);
  }
  return output;
}

const sourceReferences = (text) =>
  [
    ...text.matchAll(
      /(?:(?:scripts|testing|Development_Docs|\.github)\/[A-Za-z0-9_./-]+\.(?:mjs|js|ts|json|ya?ml|md|csv))/gu,
    ),
  ].map((match) => match[0]);

const routeStageError = (prefix, lane, stage) => `${prefix}:${lane}:${stage}`;

export async function validateExecutableRepairRoutes({ root = process.cwd(), inventoryPolicy, readText } = {}) {
  const policy = inventoryPolicy ?? JSON.parse(await readFile(path.join(root, "testing/control-plane-repair-routes.json"), "utf8"));
  const load = readText ?? ((relative) => readFile(path.join(root, relative), "utf8"));
  const requiredStages = policy.requiredExecutableStages ?? [];
  const additionalStages = policy.additionalExecutableStages ?? {};
  const routes = policy.executableRouteContracts ?? {};
  const laneResults = {};
  const errors = [];
  for (const [lane, stages] of Object.entries(routes)) {
    const incompleteStages = [];
    const laneStages = [...new Set([...requiredStages, ...(additionalStages[lane] ?? [])])];
    for (const stage of laneStages) {
      const surfaces = stages?.[stage];
      let complete = Array.isArray(surfaces) && surfaces.length > 0;
      if (complete) {
        for (const surface of surfaces) {
          try {
            const text = await load(surface.path);
            if (!text.includes(surface.contains)) complete = false;
          } catch {
            complete = false;
          }
        }
      }
      if (!complete) {
        incompleteStages.push(stage);
        errors.push(routeStageError(policy.failurePrefix, lane, stage));
      }
    }
    laneResults[lane] = { complete: incompleteStages.length === 0, incompleteStages };
  }
  return { requiredStages, additionalStages, lanes: laneResults, errors };
}

export function classifyRepairRoute({ file, rootPolicy, authorityPolicy, verificationPolicy }) {
  if (matches(file, rootPolicy?.generatedConsequenceGlobs)) return "GENERATED_CONSEQUENCE";
  if (matches(file, rootMaintenanceEligiblePathGlobs(rootPolicy))) return "ROOT_MAINTENANCE";
  if (matches(file, authorityPolicy?.eligiblePathGlobs)) return "AUTHORITY_MAINTENANCE";
  if (matches(file, verificationPolicy?.eligiblePathGlobs)) return "VERIFICATION_MAINTENANCE";
  if (matches(file, verificationPolicy?.ordinaryCandidateEligiblePathGlobs)) return "ORDINARY";
  return null;
}

export async function buildRepairRouteInventory(root = process.cwd(), additionalPrerequisites = []) {
  const readJson = async (relative) => JSON.parse(await readFile(path.join(root, relative), "utf8"));
  const [inventoryPolicy, rootPolicy, authorityPolicy, verificationPolicy] = await Promise.all([
    readJson("testing/control-plane-repair-routes.json"),
    readJson("testing/root-maintenance-policy.json"),
    readJson("testing/authority-maintenance-policy.json"),
    readJson("testing/verification-maintenance-policy.json"),
  ]);
  const prerequisitePaths = new Set(inventoryPolicy.baselineSourcePaths);
  // Runtime roots are enumerated independently from the broad descriptive
  // protected-prerequisite list. This makes future Nightwatch/Bosun files part
  // of the executable-route proof without converting every test root into an
  // implicit repair surface.
  for (const runtimeRoot of inventoryPolicy.runtimePrerequisiteRoots ?? [])
    for (const file of await walk(root, runtimeRoot)) prerequisitePaths.add(file);
  const workflowFiles = await walk(root, ".github/workflows");
  for (const workflow of workflowFiles) {
    prerequisitePaths.add(workflow);
    for (const reference of sourceReferences(await readFile(path.join(root, workflow), "utf8")))
      if (await exists(root, reference)) prerequisitePaths.add(reference);
  }
  // The certifier is the actual protected-main prerequisite inventory.  Its
  // literal source references automatically enter coverage as it evolves.
  for (const reference of sourceReferences(
    await readFile(path.join(root, "scripts/nightwatch/baseline-certifier.mjs"), "utf8"),
  ))
    if (await exists(root, reference)) prerequisitePaths.add(reference);
  for (const file of additionalPrerequisites) prerequisitePaths.add(file);
  const paths = [...prerequisitePaths].sort();
  const entries = paths.map((file) => ({
    file,
    classification: classifyRepairRoute({ file, rootPolicy, authorityPolicy, verificationPolicy }),
  }));
  const missing = entries.filter((entry) => !entry.classification).map((entry) => entry.file);
  const executableRoutes = await validateExecutableRepairRoutes({ root, inventoryPolicy });
  return {
    authority: inventoryPolicy.authority,
    paths: entries,
    repairRouteCount: entries.length - missing.length,
    prerequisiteCount: entries.length,
    executableRoutes,
    missing,
    errors: [
      ...missing.map((file) => `${inventoryPolicy.failurePrefix}:${file}`),
      ...executableRoutes.errors,
    ],
  };
}

export async function assertRepairRouteCompleteness(root = process.cwd()) {
  const inventory = await buildRepairRouteInventory(root);
  if (inventory.errors.length) throw new Error(inventory.errors.join("\n"));
  return inventory;
}

if (process.argv[1]?.endsWith("control-plane-repair-routes.mjs")) {
  const inventory = await buildRepairRouteInventory();
  console.log(JSON.stringify(inventory, null, 2));
  process.exitCode = inventory.errors.length ? 1 : 0;
}

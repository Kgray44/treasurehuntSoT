/* Declarative ordinary test-registration boundary for ADR-EGS-001. */
import { promises as fs } from "node:fs";
import path from "node:path";

const tiers = new Set([1, 2, 3, 4]);
const risks = new Set(["LOW", "MODERATE", "HIGH", "CRITICAL"]);
const parallelSafety = new Set(["READ_ONLY_PARALLEL", "ISOLATED_MUTABLE_PARALLEL", "EXCLUSIVE"]);
const text = (value) => typeof value === "string" && value.trim().length > 0;
const unique = (values) => [...new Set(values ?? [])];

export async function loadDeclarativeRegistrations(root) {
  const directory = path.join(root, "testing", "test-registrations");
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch((error) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  const files = entries.filter((entry) => entry.isFile() && entry.name.endsWith(".json")).map((entry) => entry.name).sort();
  return Promise.all(
    files.map(async (file) => ({ source: `testing/test-registrations/${file}`, ...(JSON.parse(await fs.readFile(path.join(directory, file), "utf8"))) })),
  );
}

export function validateDeclarativeRegistrations({ registrations, ownership, contracts, suites, cases }) {
  const errors = [];
  const owners = new Map((ownership?.owners ?? []).map((entry) => [entry.id, entry]));
  const contractById = new Map((contracts?.contracts ?? []).map((entry) => [entry.id, entry]));
  const suiteById = new Map((suites?.suites ?? []).map((entry) => [entry.id, entry]));
  const caseByTest = new Map((cases ?? []).map((entry) => [`${entry.file}\0${entry.title}\0${entry.suiteId}`, entry]));
  const byCase = new Map();
  const ids = new Set();
  for (const registration of registrations ?? []) {
    const prefix = `TEST_REGISTRATION_INVALID:${registration?.source ?? "unknown"}`;
    if (registration?.schemaVersion !== "1.0") errors.push(`${prefix}:SCHEMA_VERSION`);
    if (!text(registration?.id) || !/^[a-z][a-z0-9.-]+$/u.test(registration.id)) errors.push(`${prefix}:STABLE_ID`);
    if (ids.has(registration?.id)) errors.push(`${prefix}:DUPLICATE_ID`);
    ids.add(registration?.id);
    const owner = owners.get(registration?.owner);
    if (!owner) errors.push(`${prefix}:UNKNOWN_OWNER`);
    const declaredContracts = unique(registration?.contracts);
    if (!declaredContracts.length || declaredContracts.some((id) => !contractById.has(id))) errors.push(`${prefix}:UNKNOWN_CONTRACT`);
    if (owner && declaredContracts.some((id) => !(owner.contractIds ?? []).includes(id))) errors.push(`${prefix}:OWNER_CONTRACT_MISMATCH`);
    const suite = suiteById.get(registration?.test?.suiteId);
    if (!suite || suite.owner !== registration?.owner) errors.push(`${prefix}:SUITE_OWNER_MISMATCH`);
    if (!text(registration?.test?.file) || !text(registration?.test?.title)) errors.push(`${prefix}:TEST_IDENTITY`);
    if (!tiers.has(registration?.tier) || !risks.has(registration?.risk)) errors.push(`${prefix}:TIER_OR_RISK`);
    if (!Array.isArray(registration?.resources) || !registration.resources.length) errors.push(`${prefix}:RESOURCES`);
    if (!parallelSafety.has(registration?.parallelSafety)) errors.push(`${prefix}:PARALLEL_SAFETY`);
    if (!text(registration?.adapter) || typeof registration?.releaseRelevant !== "boolean") errors.push(`${prefix}:ADAPTER_OR_RELEASE`);
    const discovered = caseByTest.get(`${registration?.test?.file}\0${registration?.test?.title}\0${registration?.test?.suiteId}`);
    if (!discovered) errors.push(`${prefix}:DISCOVERED_TEST_NOT_FOUND`);
    else if (byCase.has(discovered.semanticId)) errors.push(`${prefix}:DUPLICATE_TEST_BINDING`);
    else byCase.set(discovered.semanticId, registration);
  }
  return { errors: [...new Set(errors)].sort(), byCase };
}

export function applyDeclarativeRegistrations({ registrations, ownership, contracts, suites, cases }) {
  const result = validateDeclarativeRegistrations({ registrations, ownership, contracts, suites, cases });
  if (result.errors.length) throw new Error(result.errors.join("\n"));
  return cases.map((entry) => {
    const registration = result.byCase.get(entry.semanticId);
    if (!registration) return entry;
    return {
      ...entry,
      owner: registration.owner,
      contracts: [...registration.contracts],
      tier: registration.tier,
      risk: registration.risk,
      negativeCases:
        ["HIGH", "CRITICAL"].includes(registration.risk) ? ["declarative-negative-contract"] : entry.negativeCases,
      resources: [...registration.resources],
      parallelSafety: registration.parallelSafety,
      releaseRelevance: registration.releaseRelevant ? "declarative release-relevant evidence" : "not release-relevant",
      declarativeRegistration: { id: registration.id, source: registration.source, adapter: registration.adapter },
    };
  });
}

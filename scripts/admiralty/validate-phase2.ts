import { promises as fs } from "node:fs";
import path from "node:path";
import activationRegistry from "../../Development_Docs/Projects/Project_Admiralty/Project_Admiralty_Phase_2_Capability_Activation_Registry.json";
import dataCatalog from "../../Development_Docs/Projects/Project_Admiralty/Project_Admiralty_Phase_2_Data_Projection_Catalog.json";
import deepwaterRegister from "../../Development_Docs/Projects/Project_Admiralty/Project_Admiralty_Phase_2_Deepwater_Disposition_Register.json";
import roleRegistry from "../../Development_Docs/Projects/Project_Admiralty/Project_Admiralty_Phase_2_Role_Capability_Registry.json";
import { admiraltyRegistrySummary, validateAdmiraltyRegistry } from "../../src/admiralty/registry";
import { navigationRegistry } from "../../src/navigation/registry";
import { routeShellDefinitions } from "../../src/navigation/route-classification";

const root = process.cwd();
const failures: string[] = [];
const assert = (condition: unknown, message: string) => {
  if (!condition) failures.push(message);
};

const routeSources = [
  ["/admin", "src/app/admin/page.tsx"],
  ["/admin/people", "src/app/admin/people/page.tsx"],
  ["/admin/people/[accountId]", "src/app/admin/people/[accountId]/page.tsx"],
  ["/admin/chronicles", "src/app/admin/chronicles/page.tsx"],
  ["/admin/chronicles/[chronicleId]", "src/app/admin/chronicles/[chronicleId]/page.tsx"],
  ["/admin/voyages", "src/app/admin/voyages/page.tsx"],
  ["/admin/voyages/[voyageId]", "src/app/admin/voyages/[voyageId]/page.tsx"],
  ["/admin/community", "src/app/admin/community/page.tsx"],
  ["/admin/community/[listingId]", "src/app/admin/community/[listingId]/page.tsx"],
  ["/admin/operations", "src/app/admin/operations/page.tsx"],
  ["/admin/providers", "src/app/admin/providers/page.tsx"],
  ["/admin/configuration", "src/app/admin/configuration/page.tsx"],
  ["/admin/releases", "src/app/admin/releases/page.tsx"],
  ["/admin/audit", "src/app/admin/audit/page.tsx"],
  ["/admin/investigate", "src/app/admin/investigate/page.tsx"],
] as const;

async function main() {
  const registry = admiraltyRegistrySummary();
  const activationIds = activationRegistry.activations.map(({ id }) => id);
  assert(validateAdmiraltyRegistry().valid, "living capability registry must validate");
  assert(new Set(activationIds).size === activationIds.length, "Phase 2 activation IDs must be unique");
  assert(activationIds.length === activationRegistry.newlyImplemented, "Phase 2 activation count must match registry");
  assert(registry.total === 92, "governing v1.2 floor must remain 92");
  assert(registry.implemented === activationRegistry.implementedAfterPhase2, "implemented capability count mismatch");
  assert(registry.dormant === activationRegistry.dormantAfterPhase2, "dormant capability count mismatch");

  const operations = roleRegistry.roles.find(({ id }) => id === "OPERATIONS_OPERATOR");
  assert(Boolean(operations), "Operations Observer role is required");
  assert(
    !operations?.capabilities.some((capability) => capability.endsWith("_OPERATE")),
    "Operations Observer must remain read-only",
  );

  for (const [route, source] of routeSources) assert(await exists(source), `missing Phase 2 route ${route}: ${source}`);
  assert(
    routeShellDefinitions.some(({ pattern, owner }) => pattern === "/admin/*" && owner === "admiralty"),
    "admin route family classification missing",
  );
  assert(
    navigationRegistry.some(
      (item) =>
        item.href === "/admin" && item.requiredCapabilities?.includes("admiralty") && item.owner === "admiralty",
    ),
    "authorized Admiralty account navigation entry missing",
  );

  assert(dataCatalog.prohibitedReturnClass === "SECRET", "SECRET must be the prohibited projection class");
  assert(
    dataCatalog.ports.every((port) => !port.classes.includes("SECRET")),
    "a Phase 2 read port returns SECRET",
  );
  const dispositions = new Set([
    "REALIZED_IN_PHASE_2",
    "ASSIGNED_TO_PHASE_3",
    "ASSIGNED_TO_PHASE_4",
    "INTERNAL_BY_DESIGN",
    "SECURITY_RESTRICTED",
    "INTENTIONALLY_PROHIBITED",
    "BLOCKED_BY_MISSING_OWNER_CONTRACT",
  ]);
  assert(
    deepwaterRegister.dispositions.every(({ disposition }) => dispositions.has(disposition)),
    "invalid Deepwater disposition",
  );
  assert(
    deepwaterRegister.dispositions.some(
      ({ capabilityId, disposition }) =>
        capabilityId === "DW-CAP-TRANSACTIONAL-EMAIL-DELIVERY" && disposition === "BLOCKED_BY_MISSING_OWNER_CONTRACT",
    ),
    "transactional email health gap must not be guessed",
  );

  const readSources = await Promise.all(
    [
      "src/admiralty/ports/wayfarer-admin-read.ts",
      "src/admiralty/ports/one-voyage-admin-read.ts",
      "src/admiralty/ports/harborlight-admin-read.ts",
      "src/admiralty/ports/operations-admin-read.ts",
      "src/admiralty/ports/audit-admin-read.ts",
    ].map((file) => fs.readFile(path.join(root, file), "utf8")),
  );
  const joined = readSources.join("\n");
  for (const forbidden of [
    "passwordHash: true",
    "tokenHash: true",
    "csrfToken: true",
    "encryptedToken: true",
    "payload: true",
    "contentSnapshot: true",
  ])
    assert(!joined.includes(forbidden), `forbidden read selection: ${forbidden}`);
  for (const mutation of [".update(", ".updateMany(", ".delete(", ".deleteMany(", ".upsert("])
    assert(!joined.includes(mutation), `Phase 2 read port contains a business mutation: ${mutation}`);

  if (failures.length) throw new Error(`Project Admiralty Phase 2 validation failed:\n- ${failures.join("\n- ")}`);
  console.log(
    JSON.stringify(
      {
        status: "PASS",
        routes: routeSources.length,
        capabilityFloor: registry.total,
        phase1Implemented: registry.phase1Implemented,
        phase2Implemented: registry.phase2Implemented,
        implemented: registry.implemented,
        dormant: registry.dormant,
        schemaChange: "NONE",
        mutationBoundary: "PHASE_1_SUPPORT_ACCESS_ONLY",
      },
      null,
      2,
    ),
  );
}

async function exists(relativePath: string) {
  try {
    await fs.access(path.join(root, relativePath));
    return true;
  } catch {
    return false;
  }
}

void main();

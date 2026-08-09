import { promises as fs } from "node:fs";
import path from "node:path";
import capabilityRegistry from "../../Development_Docs/Projects/Project_Admiralty/Project_Admiralty_Phase_1_Capability_Registry.json";
import roleRegistry from "../../Development_Docs/Projects/Project_Admiralty/Project_Admiralty_Phase_1_Role_Capability_Registry.json";
import supportRegistry from "../../Development_Docs/Projects/Project_Admiralty/Project_Admiralty_Phase_1_Support_Scope_Registry.json";
import { ADMIRALTY_CAPABILITIES } from "../../src/admiralty/capabilities";
import { validateAdmiraltyRegistry } from "../../src/admiralty/registry";
import { navigationRegistry } from "../../src/navigation/registry";
import { routeShellDefinitions } from "../../src/navigation/route-classification";

const root = process.cwd();
const failures: string[] = [];
const assert = (condition: unknown, message: string) => {
  if (!condition) failures.push(message);
};

const registryValidation = validateAdmiraltyRegistry();
assert(registryValidation.valid, `capability registry: ${registryValidation.problems.join(",")}`);
assert(capabilityRegistry.entries.length === 92, "capability floor must contain 92 entries");
assert(new Set(capabilityRegistry.entries.map((entry) => entry.id)).size === 92, "capability IDs must be unique");
assert(
  JSON.stringify([...roleRegistry.capabilities].sort()) === JSON.stringify([...ADMIRALTY_CAPABILITIES].sort()),
  "runtime and governed capability IDs must match",
);
const roleIds = new Set(roleRegistry.roles.map((role) => role.id));
for (const expected of [
  "ADMINISTRATOR",
  "SUPPORT_OPERATOR",
  "SECURITY_OPERATOR",
  "MODERATION_OPERATOR",
  "OPERATIONS_OPERATOR",
  "RELEASE_OPERATOR",
  "AUDIT_OPERATOR",
  "EMERGENCY_OPERATOR",
])
  assert(roleIds.has(expected), `missing role ${expected}`);

assert(supportRegistry.scopes.length === 6, "Support Access scope floor must contain six safe categories");
assert(supportRegistry.maximumGrantMinutes === 30, "Support Access maximum must remain 30 minutes");
const supportScopeIds = new Set(supportRegistry.scopes.map((scope) => scope.id));
for (const prohibited of supportRegistry.prohibited)
  assert(!supportScopeIds.has(prohibited), `prohibited scope is grantable: ${prohibited}`);

assert(
  !navigationRegistry.some((item) => {
    const href = typeof item.href === "string" ? (item.href as string) : null;
    return href === "/admin" || Boolean(href?.startsWith("/admin/"));
  }),
  "Admiralty must remain absent from ordinary navigation",
);
const adminRoutes = routeShellDefinitions.filter((route) => route.pattern === "/admin");
assert(adminRoutes.length === 1, "the hidden admin route must have exactly one shell classification");
assert(adminRoutes[0]?.owner === "admiralty", "the admin route must be Admiralty-owned");
assert(adminRoutes[0]?.shellMode === "TOKENIZED", "the outer shell must not project ordinary navigation at /admin");

function modelFields(schema: string, model: string) {
  const match = schema.match(new RegExp(`model ${model} \\{([\\s\\S]*?)\\n\\}`, "u"));
  if (!match) return [];
  return match[1]
    .split(/\r?\n/u)
    .map((line) => line.trim().split(/\s+/u)[0])
    .filter((field) => field && !field.startsWith("@@") && !field.startsWith("//"));
}

async function main() {
  const [sqliteSchema, mysqlSchema, sqliteMigration, mysqlMigration] = await Promise.all([
    fs.readFile(path.join(root, "prisma/schema.sqlite.prisma"), "utf8"),
    fs.readFile(path.join(root, "prisma/schema.prisma"), "utf8"),
    fs.readFile(path.join(root, "prisma/migrations/20260809120000_admiralty_phase1_foundation/migration.sql"), "utf8"),
    fs.readFile(path.join(root, "prisma/mysql-migrations/0052_admiralty_phase1_foundation/migration.sql"), "utf8"),
  ]);
  for (const model of ["PrivilegedAssurance", "SupportAccessRequest", "SupportAccessGrant"]) {
    const sqliteFields = modelFields(sqliteSchema, model);
    const mysqlFields = modelFields(mysqlSchema, model);
    assert(sqliteFields.length > 0, `missing SQLite model ${model}`);
    assert(
      JSON.stringify(sqliteFields) === JSON.stringify(mysqlFields),
      `SQLite/MySQL Prisma field mismatch for ${model}`,
    );
    assert(sqliteMigration.includes(`"${model}"`), `SQLite migration missing ${model}`);
    assert(mysqlMigration.includes(`\`${model}\``), `MySQL migration missing ${model}`);
  }
  assert(
    !/DROP\s+TABLE|DROP\s+COLUMN|DELETE\s+FROM|TRUNCATE/iu.test(sqliteMigration),
    "SQLite migration must remain additive",
  );
  assert(
    !/DROP\s+TABLE|DROP\s+COLUMN|DELETE\s+FROM|TRUNCATE/iu.test(mysqlMigration),
    "MySQL migration must remain additive",
  );

  if (failures.length) throw new Error(`Project Admiralty Phase 1 validation failed:\n- ${failures.join("\n- ")}`);
  console.log(
    JSON.stringify(
      {
        status: "PASS",
        capabilityFloor: capabilityRegistry.entries.length,
        roles: roleRegistry.roles.length,
        supportScopes: supportRegistry.scopes.length,
        sqliteMigration: "20260809120000_admiralty_phase1_foundation",
        mysqlMigration: "0052_admiralty_phase1_foundation",
        adminNavigationEntries: 0,
      },
      null,
      2,
    ),
  );
}

void main();

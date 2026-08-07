import { execFileSync } from "node:child_process";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const taskRoot = path.resolve(process.env.HOMEPORT_PHASE7_TASK_ROOT ?? "");
const correctionMigration = "20260804190000_homeport_phase7_owner_correction_round1";

if (!process.env.HOMEPORT_PHASE7_TASK_ROOT || !taskRoot.includes("phase7-owner-correction-round1-")) {
  throw new Error("HOMEPORT_PHASE7_TASK_ROOT must identify the owned Phase 7 correction task root.");
}

const rehearsalRoot = path.join(taskRoot, "migration-rehearsal");
if (!rehearsalRoot.startsWith(`${taskRoot}${path.sep}`)) {
  throw new Error("Refusing to prepare a migration rehearsal outside the owned task root.");
}

await rm(rehearsalRoot, { recursive: true, force: true });
await mkdir(rehearsalRoot, { recursive: true });

const freshDatabase = path.join(rehearsalRoot, "fresh.db");
const upgradeDatabase = path.join(rehearsalRoot, "upgrade.db");

const sqliteUrl = (databasePath) => `file:${databasePath.replaceAll("\\", "/")}`;
const prismaCli = path.join(repositoryRoot, "node_modules", "prisma", "build", "index.js");
const runPrisma = (args, databasePath) =>
  execFileSync(process.execPath, [prismaCli, ...args], {
    cwd: repositoryRoot,
    env: { ...process.env, DATABASE_URL: sqliteUrl(databasePath) },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

const currentMigrationsRoot = path.join(repositoryRoot, "prisma", "migrations");
const orderedMigrations = (await readdir(currentMigrationsRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
if (orderedMigrations.at(-1) !== correctionMigration) {
  throw new Error(`Expected ${correctionMigration} to be the final SQLite migration.`);
}

const applyMigration = (migrationName, databasePath) =>
  runPrisma(
    [
      "db",
      "execute",
      "--file",
      path.join(currentMigrationsRoot, migrationName, "migration.sql"),
      "--schema",
      "prisma/schema.sqlite.prisma",
    ],
    databasePath,
  );

for (const migrationName of orderedMigrations) applyMigration(migrationName, freshDatabase);
for (const migrationName of orderedMigrations.filter((name) => name !== correctionMigration)) {
  applyMigration(migrationName, upgradeDatabase);
}

const withDatabase = async (databasePath, operation) => {
  const client = new PrismaClient({ datasources: { db: { url: sqliteUrl(databasePath) } } });
  try {
    return await operation(client);
  } finally {
    await client.$disconnect();
  }
};

await withDatabase(upgradeDatabase, (client) =>
  client.$executeRawUnsafe(
    "INSERT INTO UserAccount (id, status, updatedAt) VALUES (?, 'ACTIVE', CURRENT_TIMESTAMP)",
    "phase7-correction-upgrade-sentinel",
  ),
);
applyMigration(correctionMigration, upgradeDatabase);

const inspect = (databasePath) =>
  withDatabase(databasePath, async (client) => {
    const foreignKeyFailures = await client.$queryRawUnsafe("PRAGMA foreign_key_check");
    const accountTokenColumns = await client.$queryRawUnsafe("PRAGMA table_info('AccountToken')");
    const membershipColumns = await client.$queryRawUnsafe("PRAGMA table_info('PlaythroughMembership')");
    const lifecycleTables = await client.$queryRawUnsafe(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('AccountDataExport', 'AccountLifecycleRequest') ORDER BY name",
    );
    const sentinelRows = await client.$queryRawUnsafe(
      "SELECT id, status FROM UserAccount WHERE id = 'phase7-correction-upgrade-sentinel'",
    );
    return {
      migrationCount: orderedMigrations.length,
      finalMigration: correctionMigration,
      foreignKeyFailures: foreignKeyFailures.length,
      correctionColumns: {
        accountToken: accountTokenColumns
          .map((column) => column.name)
          .filter((name) => name === "pendingNormalizedEmail" || name === "pendingDisplayEmail")
          .sort(),
        playthroughMembership: membershipColumns
          .map((column) => column.name)
          .filter((name) => name === "participationAlias" || name === "participationAliasEditedAt")
          .sort(),
      },
      lifecycleTables: lifecycleTables.map((row) => row.name),
      sentinelPreserved: sentinelRows.length === 1 && sentinelRows[0].status === "ACTIVE",
    };
  });

const [fresh, upgrade] = await Promise.all([inspect(freshDatabase), inspect(upgradeDatabase)]);
const expectedColumns = {
  accountToken: ["pendingDisplayEmail", "pendingNormalizedEmail"],
  playthroughMembership: ["participationAlias", "participationAliasEditedAt"],
};
const expectedTables = ["AccountDataExport", "AccountLifecycleRequest"];
for (const [kind, result] of Object.entries({ fresh, upgrade })) {
  if (
    result.migrationCount !== orderedMigrations.length ||
    result.finalMigration !== correctionMigration ||
    result.foreignKeyFailures !== 0 ||
    JSON.stringify(result.correctionColumns) !== JSON.stringify(expectedColumns) ||
    JSON.stringify(result.lifecycleTables) !== JSON.stringify(expectedTables) ||
    (kind === "upgrade" && !result.sentinelPreserved)
  ) {
    throw new Error(`${kind} migration rehearsal invariant failed: ${JSON.stringify(result)}`);
  }
}

const receipt = {
  schema: "homeport.phase7.owner-correction-round1.migration-rehearsal.v1",
  execution: "ORDERED_PRISMA_DB_EXECUTE_ON_DISPOSABLE_SQLITE",
  correctionMigration,
  migrationCount: orderedMigrations.length,
  fresh,
  upgrade,
  databases: { fresh: freshDatabase, upgrade: upgradeDatabase },
};
await writeFile(path.join(rehearsalRoot, "receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
console.log(JSON.stringify(receipt, null, 2));
console.log("HOMEPORT_PHASE7_OWNER_CORRECTION_ROUND1_MIGRATIONS_VALID");

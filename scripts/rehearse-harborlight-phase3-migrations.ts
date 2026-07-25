import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

const rehearsalRoot = resolve("C:/Users/kgray/AppData/Local/ForeverTreasureCompanion/rehearsals");
const databasePath = join(rehearsalRoot, `harborlight-phase3-148-${randomUUID()}.sqlite`);

function splitStatements(sql: string) {
  sql = withoutLineComments(sql);
  const statements: string[] = [];
  let start = 0;
  let quote: "'" | '"' | "`" | null = null;
  for (let index = 0; index < sql.length; index++) {
    const character = sql[index];
    if (quote) {
      if (character === quote && sql[index - 1] !== "\\") quote = null;
      continue;
    }
    if (character === "'" || character === '"' || character === "`") quote = character;
    if (character === ";") {
      const statement = withoutLineComments(sql.slice(start, index)).trim();
      if (statement) statements.push(statement);
      start = index + 1;
    }
  }
  const remaining = withoutLineComments(sql.slice(start)).trim();
  if (remaining) statements.push(remaining);
  return statements;
}

function withoutLineComments(value: string) {
  return value
    .split(/\r?\n/u)
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");
}

async function migrations() {
  const root = resolve("prisma/migrations");
  const { readdir } = await import("node:fs/promises");
  return (await readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .map((name) => join(root, name, "migration.sql"));
}

async function main() {
  await mkdir(rehearsalRoot, { recursive: true });
  if (existsSync(databasePath)) throw new Error("Refusing to overwrite a rehearsal database.");
  const prisma = new PrismaClient({ datasources: { db: { url: `file:${databasePath.replace(/\\/gu, "/")}` } } });
  try {
    for (const file of await migrations()) {
      for (const statement of splitStatements(await readFile(file, "utf8"))) {
        try {
          await prisma.$executeRawUnsafe(statement);
        } catch (cause) {
          throw new Error(
            `Migration ${basename(resolve(file, ".."))} failed at ${statement.slice(0, 160)}: ${cause instanceof Error ? cause.message : String(cause)}`,
          );
        }
      }
      if (basename(resolve(file, "..")) === "20260725143000_harborlight_phase3_keepsakes_voyage_logs_consent") {
        await prisma.$executeRawUnsafe(
          "INSERT INTO CommunityVoyageKeepsake (id, ownerAccountId, taleSessionId, safeSnapshot, status, updatedAt) VALUES ('legacy-keepsake', 'owner-legacy', 'legacy-session', '{}', 'READY', CURRENT_TIMESTAMP)",
        );
      }
    }
    const columns = await prisma.$queryRawUnsafe<Array<{ name: string; dflt_value: string | null }>>(
      "PRAGMA table_info('CommunityVoyageKeepsake')",
    );
    const legacy = await prisma.$queryRawUnsafe<Array<{ taleSessionId: string; wayfarerKeepsakeId: string | null }>>(
      "SELECT taleSessionId, wayfarerKeepsakeId FROM CommunityVoyageKeepsake WHERE id = 'legacy-keepsake'",
    );
    const indexes = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
      "PRAGMA index_list('CommunityVoyageKeepsake')",
    );
    const collectionIndexes = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
      "PRAGMA index_list('CommunityCollection')",
    );
    const voyageLogColumns = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
      "PRAGMA table_info('CommunityVoyageLog')",
    );
    const consentColumns = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
      "PRAGMA table_info('CommunityVoyageLogParticipantConsent')",
    );
    const consentAuditColumns = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
      "PRAGMA table_info('CommunityVoyageLogConsentAudit')",
    );
    const foreignKeys = await prisma.$queryRawUnsafe<Array<unknown>>("PRAGMA foreign_key_check");
    const tableCount = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
    );
    await prisma.$executeRawUnsafe(
      "INSERT INTO CommunityVoyageKeepsake (id, ownerAccountId, wayfarerKeepsakeId, sourceWatermark, sourceProjectionChecksum, safeSnapshot, status, updatedAt) VALUES ('source-keepsake', 'owner-source', 'wayfarer-1', 'watermark-1', 'checksum-1', '{}', 'READY', CURRENT_TIMESTAMP)",
    );
    let legacyUnique = false;
    let sourceUnique = false;
    try {
      await prisma.$executeRawUnsafe(
        "INSERT INTO CommunityVoyageKeepsake (id, ownerAccountId, taleSessionId, safeSnapshot, status, updatedAt) VALUES ('duplicate-legacy', 'owner-legacy', 'legacy-session', '{}', 'READY', CURRENT_TIMESTAMP)",
      );
    } catch {
      legacyUnique = true;
    }
    try {
      await prisma.$executeRawUnsafe(
        "INSERT INTO CommunityVoyageKeepsake (id, ownerAccountId, wayfarerKeepsakeId, safeSnapshot, status, updatedAt) VALUES ('duplicate-source', 'owner-source', 'wayfarer-1', '{}', 'READY', CURRENT_TIMESTAMP)",
      );
    } catch {
      sourceUnique = true;
    }
    const requiredColumns = [
      "taleSessionId",
      "wayfarerKeepsakeId",
      "sourceWatermark",
      "sourceProjectionChecksum",
      "preparationState",
    ];
    const defaultState = columns.find((column) => column.name === "preparationState")?.dflt_value;
    const requiredIndexes = [
      "CommunityVoyageKeepsake_ownerAccountId_taleSessionId_key",
      "CommunityVoyageKeepsake_ownerAccountId_wayfarerKeepsakeId_key",
      "CommunityVoyageKeepsake_taleSessionId_idx",
      "CommunityVoyageKeepsake_wayfarerKeepsakeId_idx",
    ];
    const collectionColumns = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
      "PRAGMA table_info('CommunityCollection')",
    );
    const result = {
      appliedMigrations: (await migrations()).length,
      tableCount: Number(tableCount[0]?.count ?? 0),
      foreignKeyFindings: foreignKeys.length,
      legacyRowSurvived: legacy[0]?.taleSessionId === "legacy-session" && legacy[0]?.wayfarerKeepsakeId === null,
      nullableSourceFields: ["wayfarerKeepsakeId", "sourceWatermark", "sourceProjectionChecksum"].every(
        (name) => columns.find((column) => column.name === name)?.dflt_value === null,
      ),
      requiredColumnsPresent: requiredColumns.every((name) => columns.some((column) => column.name === name)),
      collectionLifecycleColumnsPresent: ["coverReference", "archivedAt", "deletedAt"].every((name) =>
        collectionColumns.some((column) => column.name === name),
      ),
      publicationConsentColumnsPresent:
        ["lifecycleState", "consentRevision", "projectionChecksum", "searchIndexedAt", "openGraphInvalidatedAt"].every(
          (name) => voyageLogColumns.some((column) => column.name === name),
        ) &&
        ["state", "requestedAt", "expiresAt", "updatedAt"].every((name) =>
          consentColumns.some((column) => column.name === name),
        ) &&
        ["voyageLogId", "participantId", "actorAccountId", "purpose", "action", "state", "occurredAt"].every((name) =>
          consentAuditColumns.some((column) => column.name === name),
        ),
      preparationStateDefault: defaultState,
      legacyUnique,
      sourceUnique,
      requiredIndexesPresent:
        requiredIndexes.every((name) => indexes.some((index) => index.name === name)) &&
        collectionIndexes.some((index) => index.name === "CommunityCollection_visibility_archivedAt_deletedAt_idx"),
    };
    if (
      result.foreignKeyFindings ||
      !result.legacyRowSurvived ||
      !result.nullableSourceFields ||
      !result.requiredColumnsPresent ||
      !result.collectionLifecycleColumnsPresent ||
      !result.publicationConsentColumnsPresent ||
      result.preparationStateDefault !== "'PENDING_SOURCE'" ||
      !result.legacyUnique ||
      !result.sourceUnique ||
      !result.requiredIndexesPresent
    )
      throw new Error(`Migration rehearsal invariant failed: ${JSON.stringify(result)}`);
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } finally {
    await prisma.$disconnect();
    await Promise.all(
      [databasePath, `${databasePath}-journal`, `${databasePath}-wal`, `${databasePath}-shm`].map((file) =>
        rm(file, { force: true }),
      ),
    );
  }
}

void main();

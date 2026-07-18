import { execFileSync } from "node:child_process";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

async function main() {
  const root = process.cwd();
  const temporary = await mkdtemp(path.join(os.tmpdir(), "forever-treasure-b6-migration-"));
  const databasePath = path.join(temporary, "representative-pre-b6.db");
  const databaseUrl = `file:${databasePath.replaceAll("\\", "/")}`;
  const prismaCli = path.join(root, "node_modules", "prisma", "build", "index.js");
  const schema = path.join(root, "prisma", "schema.sqlite.prisma");
  const migrationRoot = path.join(root, "prisma", "migrations");
  const b6Migration = "20260719010000_vision_release_hardening_b6";

  function apply(file: string) {
    execFileSync(process.execPath, [prismaCli, "db", "execute", "--file", file, "--schema", schema], {
      cwd: root,
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: "pipe",
    });
  }

  try {
    const allMigrations = (await readdir(migrationRoot, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    if (!allMigrations.includes(b6Migration)) throw new Error(`Required migration ${b6Migration} is missing.`);
    const migrations = allMigrations.filter((migration) => migration.localeCompare(b6Migration) < 0);
    if (migrations.length !== 10)
      throw new Error(`Expected 10 representative pre-B-6 migrations, found ${migrations.length}.`);
    for (const migration of migrations) apply(path.join(migrationRoot, migration, "migration.sql"));
    const representativeSql = path.join(temporary, "representative.sql");
    await writeFile(
      representativeSql,
      [
        `INSERT INTO "GameMasterUser" ("id","username","passwordHash") VALUES ('gm_pre_b6','pre-b6-owner','hash');`,
        `INSERT INTO "VisionWaypoint" ("id","ownerId","name","type","updatedAt") VALUES ('waypoint_pre_b6','gm_pre_b6','Preserved published waypoint','EXACT_LANDMARK','2026-07-18T00:00:00.000Z');`,
        `INSERT INTO "VisionWaypointVersion" ("id","waypointId","versionNumber","lifecycleStatus","createdBy","publishedBy","publishedAt","updatedAt") VALUES ('version_pre_b6','waypoint_pre_b6',1,'PUBLISHED','gm_pre_b6','gm_pre_b6','2026-07-18T00:00:00.000Z','2026-07-18T00:00:00.000Z');`,
      ].join("\n"),
      "utf8",
    );
    apply(representativeSql);
    apply(path.join(migrationRoot, b6Migration, "migration.sql"));
    const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    try {
      const rows = await db.$queryRawUnsafe<
        Array<{
          id: string;
          lifecycleStatus: string;
          certificationStatus: string;
          compatibilityStatus: string;
        }>
      >(
        `SELECT "id","lifecycleStatus","certificationStatus","compatibilityStatus" FROM "VisionWaypointVersion" WHERE "id"='version_pre_b6'`,
      );
      if (
        rows.length !== 1 ||
        rows[0].lifecycleStatus !== "PUBLISHED" ||
        rows[0].certificationStatus !== "DRAFT" ||
        rows[0].compatibilityStatus !== "NEEDS_RETEST"
      )
        throw new Error("The B-6 migration did not preserve the representative published waypoint.");
      const tables = await db.$queryRawUnsafe<Array<{ name: string }>>(
        `SELECT name FROM sqlite_master WHERE type='table' AND name IN ('VisionRelease','VisionReleaseIssue','VisionDatasetManifest','VisionUpdateState','VisionImprovementCandidate') ORDER BY name`,
      );
      if (tables.length !== 5) throw new Error("The B-6 release tables were not created.");
    } finally {
      await db.$disconnect();
    }
    process.stdout.write(
      `${JSON.stringify({
        verified: true,
        migration: b6Migration,
        preB6Migrations: migrations.length,
        publishedWaypointPreserved: true,
        defaultCertificationStatus: "DRAFT",
        defaultCompatibilityStatus: "NEEDS_RETEST",
      })}\n`,
    );
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

main().catch((cause: unknown) => {
  console.error(cause);
  process.exitCode = 1;
});

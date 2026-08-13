import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const repositoryRoot = process.cwd();
const taskRoot = path.join(os.tmpdir(), `voyagewright-admiralty-phase3-${randomUUID()}`);
const baselinePrismaRoot = path.join(taskRoot, "baseline-prisma");
const baselineMigrations = path.join(baselinePrismaRoot, "migrations");
const baselineDatabase = path.join(taskRoot, "upgraded.sqlite");
const freshDatabase = path.join(taskRoot, "fresh.sqlite");
const prismaCli = path.join(repositoryRoot, "node_modules", "prisma", "build", "index.js");
const currentMigration = "20260813130000_admiralty_phase3_wayfarer_command_receipts";
const sqliteUrl = (file) => `file:${file.replaceAll("\\", "/")}`;

function runMigrations(schema, databaseUrl) {
  execFileSync(process.execPath, [prismaCli, "migrate", "deploy", "--schema", schema], {
    cwd: repositoryRoot,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "pipe",
  });
}

async function clientFor(database) {
  const client = new PrismaClient({ datasources: { db: { url: sqliteUrl(database) } } });
  await client.$connect();
  return client;
}

try {
  await fs.mkdir(baselineMigrations, { recursive: true });
  await fs.copyFile(
    path.join(repositoryRoot, "prisma", "schema.sqlite.prisma"),
    path.join(baselinePrismaRoot, "schema.sqlite.prisma"),
  );
  await fs.copyFile(
    path.join(repositoryRoot, "prisma", "migrations", "migration_lock.toml"),
    path.join(baselineMigrations, "migration_lock.toml"),
  );
  for (const entry of await fs.readdir(path.join(repositoryRoot, "prisma", "migrations"), { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === currentMigration) continue;
    await fs.cp(
      path.join(repositoryRoot, "prisma", "migrations", entry.name),
      path.join(baselineMigrations, entry.name),
      { recursive: true },
    );
  }
  await fs.writeFile(baselineDatabase, "");
  runMigrations(path.join(baselinePrismaRoot, "schema.sqlite.prisma"), sqliteUrl(baselineDatabase));
  const baselineClient = await clientFor(baselineDatabase);
  await baselineClient.userAccount.create({ data: { id: "admiralty-phase3-upgrade-sentinel", status: "ACTIVE" } });
  await baselineClient.$disconnect();

  runMigrations(path.join(repositoryRoot, "prisma", "schema.sqlite.prisma"), sqliteUrl(baselineDatabase));
  const upgraded = await clientFor(baselineDatabase);
  const result = {
    status: "PASS",
    migration: currentMigration,
    sentinelRows: await upgraded.userAccount.count({ where: { id: "admiralty-phase3-upgrade-sentinel" } }),
    receiptRows: await upgraded.wayfarerAdminCommandReceipt.count(),
  };
  await upgraded.$disconnect();

  await fs.writeFile(freshDatabase, "");
  runMigrations(path.join(repositoryRoot, "prisma", "schema.sqlite.prisma"), sqliteUrl(freshDatabase));
  const fresh = await clientFor(freshDatabase);
  result.freshReceiptRows = await fresh.wayfarerAdminCommandReceipt.count();
  await fresh.$disconnect();
  if (result.sentinelRows !== 1) throw new Error("Upgrade rehearsal did not preserve the sentinel account.");
  console.log(JSON.stringify(result, null, 2));
} finally {
  await fs.rm(taskRoot, { recursive: true, force: true });
}

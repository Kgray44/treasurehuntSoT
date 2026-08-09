import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const repositoryRoot = process.cwd();
const taskRoot = path.join(os.tmpdir(), `voyagewright-admiralty-phase1-${randomUUID()}`);
const baselinePrismaRoot = path.join(taskRoot, "baseline-prisma");
const baselineMigrations = path.join(baselinePrismaRoot, "migrations");
const baselineDatabase = path.join(taskRoot, "upgraded.sqlite");
const freshDatabase = path.join(taskRoot, "fresh.sqlite");
const prismaCli = path.join(repositoryRoot, "node_modules", "prisma", "build", "index.js");
const currentMigration = "20260809120000_admiralty_phase1_foundation";
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

let result;
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
  const migrationEntries = await fs.readdir(path.join(repositoryRoot, "prisma", "migrations"), { withFileTypes: true });
  for (const entry of migrationEntries) {
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
  await baselineClient.userAccount.create({ data: { id: "admiralty-upgrade-sentinel", status: "ACTIVE" } });
  const before = await baselineClient.userAccount.count({ where: { id: "admiralty-upgrade-sentinel" } });
  await baselineClient.$disconnect();

  runMigrations(path.join(repositoryRoot, "prisma", "schema.sqlite.prisma"), sqliteUrl(baselineDatabase));
  const upgradedClient = await clientFor(baselineDatabase);
  const upgraded = {
    sentinelRows: await upgradedClient.userAccount.count({ where: { id: "admiralty-upgrade-sentinel" } }),
    assurances: await upgradedClient.privilegedAssurance.count(),
    requests: await upgradedClient.supportAccessRequest.count(),
    grants: await upgradedClient.supportAccessGrant.count(),
  };
  await upgradedClient.$disconnect();

  await fs.writeFile(freshDatabase, "");
  runMigrations(path.join(repositoryRoot, "prisma", "schema.sqlite.prisma"), sqliteUrl(freshDatabase));
  const freshClient = await clientFor(freshDatabase);
  const fresh = {
    assurances: await freshClient.privilegedAssurance.count(),
    requests: await freshClient.supportAccessRequest.count(),
    grants: await freshClient.supportAccessGrant.count(),
  };
  await freshClient.$disconnect();

  if (before !== 1 || upgraded.sentinelRows !== 1)
    throw new Error("Upgrade rehearsal did not preserve the sentinel account.");
  result = { status: "PASS", migration: currentMigration, baselineSentinelRows: before, upgraded, fresh };
  console.log(JSON.stringify(result, null, 2));
} finally {
  const resolvedTaskRoot = path.resolve(taskRoot);
  const resolvedTempRoot = path.resolve(os.tmpdir());
  if (!resolvedTaskRoot.startsWith(`${resolvedTempRoot}${path.sep}`))
    throw new Error("Refusing to remove a non-temporary task root.");
  await fs.rm(resolvedTaskRoot, { recursive: true, force: true });
}

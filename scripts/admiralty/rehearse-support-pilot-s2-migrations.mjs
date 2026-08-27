import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const repositoryRoot = process.cwd();
const s2Migration = "20260827133000_admiralty_support_pilot_s2";
const taskRoot = path.join(os.tmpdir(), `voyagewright-admiralty-support-pilot-s2-${randomUUID()}`);
const baselinePrismaRoot = path.join(taskRoot, "baseline-prisma");
const baselineMigrations = path.join(baselinePrismaRoot, "migrations");
const upgradedDatabase = path.join(taskRoot, "upgraded.sqlite");
const freshDatabase = path.join(taskRoot, "fresh.sqlite");
const prismaCli = path.join(repositoryRoot, "node_modules", "prisma", "build", "index.js");
const sqliteUrl = (file) => `file:${file.replaceAll("\\", "/")}`;

function deploy(schema, database) {
  execFileSync(process.execPath, [prismaCli, "migrate", "deploy", "--schema", schema], {
    cwd: repositoryRoot,
    env: { ...process.env, DATABASE_URL: sqliteUrl(database) },
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
    if (!entry.isDirectory() || entry.name === s2Migration) continue;
    await fs.cp(
      path.join(repositoryRoot, "prisma", "migrations", entry.name),
      path.join(baselineMigrations, entry.name),
      { recursive: true },
    );
  }

  await fs.writeFile(upgradedDatabase, "");
  deploy(path.join(baselinePrismaRoot, "schema.sqlite.prisma"), upgradedDatabase);
  const before = await clientFor(upgradedDatabase);
  await before.userAccount.create({ data: { id: "support-s2-upgrade-sentinel", status: "ACTIVE" } });
  await before.$disconnect();

  deploy(path.join(repositoryRoot, "prisma", "schema.sqlite.prisma"), upgradedDatabase);
  const upgraded = await clientFor(upgradedDatabase);
  const operatorId = "support-s2-upgrade-operator";
  const targetId = "support-s2-upgrade-target";
  await upgraded.userAccount.createMany({
    data: [
      { id: operatorId, status: "ACTIVE" },
      { id: targetId, status: "ACTIVE" },
    ],
  });
  const request = await upgraded.supportAccessRequest.create({
    data: {
      requestingAdminAccountId: operatorId,
      targetAccountId: targetId,
      purpose: "Synthetic S2 migration rehearsal.",
      requestedScopes: '["PROFILE_DIAGNOSTICS"]',
      requestedRepairIds: '["wayfarer.profile.reconcile"]',
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      correlationId: "support-s2-upgrade-request",
    },
  });
  const supportCase = await upgraded.supportCase.create({
    data: {
      caseNumber: "S2-UPGRADE-REHEARSAL",
      requestingOperatorId: operatorId,
      targetAccountId: targetId,
      supportAccessRequestId: request.id,
      title: "Synthetic S2 migration rehearsal case",
      safeSummary: "Exercises only S2 schema relationships.",
      correlationId: "support-s2-upgrade-case",
      revision: 7,
    },
  });
  const parentGrant = await upgraded.supportAccessGrant.create({
    data: {
      requestId: request.id,
      operatorAccountId: operatorId,
      targetAccountId: targetId,
      grantedScopes: '["PROFILE_DIAGNOSTICS"]',
      grantedRepairIds: '["wayfarer.profile.reconcile"]',
      maximumRiskClass: "R1",
      expiresAt: new Date("2030-01-01T00:10:00.000Z"),
      correlationId: "support-s2-upgrade-parent-grant",
    },
  });
  const grant = await upgraded.supportExecutionGrant.create({
    data: {
      supportCaseId: supportCase.id,
      parentSupportGrantId: parentGrant.id,
      operatorAccountId: operatorId,
      targetAccountId: targetId,
      grantedScopes: '["PROFILE_DIAGNOSTICS"]',
      dataClasses: '["ACCOUNT_PRIVATE"]',
      expiresAt: new Date("2030-01-01T00:05:00.000Z"),
      correlationId: "support-s2-upgrade-execution-grant",
      permittedRepairIds: '["wayfarer.profile.reconcile"]',
      maximumRiskClass: "R1",
      maximumCommands: 1,
      remainingCommands: 1,
      maximumAffectedRecords: 1,
      remainingAffectedRecords: 1,
      maximumDomains: 1,
    },
  });
  const session = await upgraded.supportExecutionSession.create({
    data: {
      supportCaseId: supportCase.id,
      supportExecutionGrantId: grant.id,
      operatorAccountId: operatorId,
      status: "COMPLETE",
      queriedDomains: '["Wayfarer"]',
      dataClasses: '["ACCOUNT_PRIVATE"]',
      receiptDigest: "a".repeat(64),
      completedAt: new Date("2030-01-01T00:01:00.000Z"),
      correlationId: "support-s2-upgrade-session",
    },
  });
  const proposal = await upgraded.supportRepairProposal.create({
    data: {
      supportExecutionSessionId: session.id,
      proposalType: "wayfarer.profile.reconcile",
      repairId: "wayfarer.profile.reconcile",
      targetType: "PlayerProfile",
      targetId: "synthetic-profile",
      targetRevision: "revision-1",
      proposalRevision: 7,
      preview: "{}",
      summary: "Synthetic registered repair proposal.",
      state: "READY",
    },
  });
  await upgraded.supportRepairExecution.create({
    data: {
      supportCaseId: supportCase.id,
      supportExecutionGrantId: grant.id,
      supportRepairProposalId: proposal.id,
      repairId: "wayfarer.profile.reconcile",
      registrySchemaVersion: "2.0.0",
      targetType: "PlayerProfile",
      targetId: "synthetic-profile",
      targetRevision: "revision-1",
      proposalRevision: 7,
      idempotencyKey: "support-s2-upgrade-idempotency",
      affectedRecords: 1,
      correlationId: "support-s2-upgrade-execution",
    },
  });
  await upgraded.supportRepairLease.create({
    data: {
      targetType: "PlayerProfile",
      targetId: "synthetic-profile",
      supportCaseId: supportCase.id,
      leaseToken: "support-s2-upgrade-lease",
      expiresAt: new Date("2030-01-01T00:03:00.000Z"),
    },
  });
  const [sentinel, executions, leases] = await Promise.all([
    upgraded.userAccount.count({ where: { id: "support-s2-upgrade-sentinel" } }),
    upgraded.supportRepairExecution.count(),
    upgraded.supportRepairLease.count(),
  ]);
  await upgraded.$disconnect();

  await fs.writeFile(freshDatabase, "");
  deploy(path.join(repositoryRoot, "prisma", "schema.sqlite.prisma"), freshDatabase);
  const fresh = await clientFor(freshDatabase);
  const [freshExecutions, freshLeases] = await Promise.all([
    fresh.supportRepairExecution.count(),
    fresh.supportRepairLease.count(),
  ]);
  await fresh.$disconnect();

  if (sentinel !== 1 || executions !== 1 || leases !== 1 || freshExecutions !== 0 || freshLeases !== 0)
    throw new Error("S2 migration rehearsal did not preserve or expose the expected Support Repair schema.");
  process.stdout.write(
    `${JSON.stringify({ status: "PASS", migration: s2Migration, sentinel, executions, leases, freshExecutions, freshLeases })}\n`,
  );
} finally {
  const resolvedTaskRoot = path.resolve(taskRoot);
  const resolvedTempRoot = path.resolve(os.tmpdir());
  if (!resolvedTaskRoot.startsWith(`${resolvedTempRoot}${path.sep}`))
    throw new Error("Refusing to remove a non-temporary task root.");
  await fs.rm(resolvedTaskRoot, { recursive: true, force: true });
}

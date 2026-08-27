import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const repositoryRoot = process.cwd();
const s1Migration = "20260827120000_admiralty_support_pilot_s1";
const taskRoot = path.join(os.tmpdir(), `voyagewright-admiralty-support-pilot-s1-${randomUUID()}`);
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

async function modelCounts(client) {
  return {
    cases: await client.supportCase.count(),
    executionGrants: await client.supportExecutionGrant.count(),
    sessions: await client.supportExecutionSession.count(),
    observations: await client.supportObservation.count(),
    evidenceReferences: await client.supportEvidenceReference.count(),
    findings: await client.supportFinding.count(),
    diagnoses: await client.supportDiagnosis.count(),
    repairProposals: await client.supportRepairProposal.count(),
  };
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
    if (!entry.isDirectory() || entry.name === s1Migration) continue;
    await fs.cp(
      path.join(repositoryRoot, "prisma", "migrations", entry.name),
      path.join(baselineMigrations, entry.name),
      {
        recursive: true,
      },
    );
  }

  await fs.writeFile(upgradedDatabase, "");
  deploy(path.join(baselinePrismaRoot, "schema.sqlite.prisma"), upgradedDatabase);
  const before = await clientFor(upgradedDatabase);
  await before.userAccount.create({ data: { id: "support-s1-upgrade-sentinel", status: "ACTIVE" } });
  const preservedBefore = await before.userAccount.count({ where: { id: "support-s1-upgrade-sentinel" } });
  await before.$disconnect();

  deploy(path.join(repositoryRoot, "prisma", "schema.sqlite.prisma"), upgradedDatabase);
  const upgraded = await clientFor(upgradedDatabase);
  const operatorId = "support-s1-upgrade-operator";
  const targetId = "support-s1-upgrade-target";
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
      purpose: "Synthetic Support Pilot S1 migration rehearsal.",
      requestedScopes: '["ACCOUNT_STATE"]',
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      correlationId: "support-s1-upgrade-request",
    },
  });
  const supportCase = await upgraded.supportCase.create({
    data: {
      caseNumber: "S1-UPGRADE-REHEARSAL",
      requestingOperatorId: operatorId,
      targetAccountId: targetId,
      supportAccessRequestId: request.id,
      title: "Synthetic migration rehearsal case",
      safeSummary: "Exercises only Support Pilot S1 schema relationships.",
      correlationId: "support-s1-upgrade-case",
    },
  });
  const parentGrant = await upgraded.supportAccessGrant.create({
    data: {
      requestId: request.id,
      operatorAccountId: operatorId,
      targetAccountId: targetId,
      grantedScopes: '["ACCOUNT_STATE"]',
      expiresAt: new Date("2030-01-01T00:10:00.000Z"),
      correlationId: "support-s1-upgrade-parent-grant",
    },
  });
  const executionGrant = await upgraded.supportExecutionGrant.create({
    data: {
      supportCaseId: supportCase.id,
      parentSupportGrantId: parentGrant.id,
      operatorAccountId: operatorId,
      targetAccountId: targetId,
      grantedScopes: '["ACCOUNT_STATE"]',
      dataClasses: '["ACCOUNT_PRIVATE"]',
      expiresAt: new Date("2030-01-01T00:05:00.000Z"),
      correlationId: "support-s1-upgrade-execution-grant",
    },
  });
  const session = await upgraded.supportExecutionSession.create({
    data: {
      supportCaseId: supportCase.id,
      supportExecutionGrantId: executionGrant.id,
      operatorAccountId: operatorId,
      status: "COMPLETE",
      queriedDomains: '["Wayfarer"]',
      dataClasses: '["ACCOUNT_PRIVATE"]',
      receiptDigest: "a".repeat(64),
      completedAt: new Date("2030-01-01T00:01:00.000Z"),
      correlationId: "support-s1-upgrade-session",
    },
  });
  const observation = await upgraded.supportObservation.create({
    data: {
      supportExecutionSessionId: session.id,
      domain: "Wayfarer",
      scope: "ACCOUNT_STATE",
      dataClassification: "ACCOUNT_PRIVATE",
      sourceType: "SyntheticMigrationRehearsal",
      sourceId: targetId,
      sourceDigest: "b".repeat(64),
      safeSummary: "Synthetic sanitized support observation.",
    },
  });
  const evidence = await upgraded.supportEvidenceReference.create({
    data: {
      supportExecutionSessionId: session.id,
      supportObservationId: observation.id,
      sourceDomain: "Wayfarer",
      sourceReference: "SyntheticMigrationRehearsal:target",
      dataClassification: "ACCOUNT_PRIVATE",
      digest: "c".repeat(64),
      sanitizedExcerpt: "Synthetic redacted evidence reference.",
      redacted: true,
    },
  });
  await upgraded.supportFinding.create({
    data: {
      supportExecutionSessionId: session.id,
      code: "SYNTHETIC_REHEARSAL",
      summary: "Synthetic migration rehearsal finding.",
      confidence: "LOW",
      uncertainty: "Synthetic migration rehearsal has no diagnostic meaning.",
      evidenceLinks: { create: { supportEvidenceReferenceId: evidence.id } },
    },
  });
  await upgraded.supportDiagnosis.create({
    data: {
      supportExecutionSessionId: session.id,
      primaryCause: "SYNTHETIC_REHEARSAL",
      confidence: "LOW",
      uncertainty: "Synthetic migration rehearsal has no diagnostic meaning.",
      evidenceDigest: "a".repeat(64),
    },
  });
  await upgraded.supportRepairProposal.create({
    data: {
      supportExecutionSessionId: session.id,
      proposalType: "SYNTHETIC_INFORMATION_ONLY",
      summary: "Synthetic migration rehearsal proposal.",
      state: "INFORMATION_ONLY",
    },
  });
  const upgradedCounts = await modelCounts(upgraded);
  const preservedAfter = await upgraded.userAccount.count({ where: { id: "support-s1-upgrade-sentinel" } });
  await upgraded.$disconnect();

  await fs.writeFile(freshDatabase, "");
  deploy(path.join(repositoryRoot, "prisma", "schema.sqlite.prisma"), freshDatabase);
  const fresh = await clientFor(freshDatabase);
  const freshCounts = await modelCounts(fresh);
  await fresh.$disconnect();

  if (preservedBefore !== 1 || preservedAfter !== 1)
    throw new Error("S1 upgrade rehearsal did not preserve the sentinel account.");
  if (
    Object.values(upgradedCounts).some((count) => count !== 1) ||
    Object.values(freshCounts).some((count) => count !== 0)
  )
    throw new Error("S1 migration rehearsal did not expose the expected typed support domain.");
  process.stdout.write(
    `${JSON.stringify({ status: "PASS", migration: s1Migration, preservedBefore, preservedAfter, upgradedCounts, freshCounts })}\n`,
  );
} finally {
  const resolvedTaskRoot = path.resolve(taskRoot);
  const resolvedTempRoot = path.resolve(os.tmpdir());
  if (!resolvedTaskRoot.startsWith(`${resolvedTempRoot}${path.sep}`))
    throw new Error("Refusing to remove a non-temporary task root.");
  await fs.rm(resolvedTaskRoot, { recursive: true, force: true });
}

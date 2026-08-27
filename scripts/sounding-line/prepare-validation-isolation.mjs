#!/usr/bin/env node
/* Establishes the single nonce-bound identity required by isolated browser profiles. */
import { PrismaClient } from "@prisma/client";
import path from "node:path";
import process from "node:process";

const databaseUrl = process.env.DATABASE_URL ?? "";
const nonceHash = process.env.FOREVER_VALIDATION_NONCE_HASH ?? "";
const profile = process.env.SOUNDING_LINE_SUITE_PROFILE ?? "";
const databasePath = databaseUrl.startsWith("file:") ? databaseUrl.slice("file:".length).replaceAll("/", path.sep) : "";

if (
  process.env.FOREVER_VALIDATION_ISOLATION !== "1" ||
  !["harborlight-phase2", "harborlight-phase3", "harborlight-phase4", "lanternwake-phase3"].includes(profile) ||
  !/^[a-f0-9]{64}$/u.test(nonceHash) ||
  !path.isAbsolute(databasePath) ||
  !/^validation-isolated-\d{8}-\d{9}-[a-f0-9]{32}\.db$/u.test(path.basename(databasePath))
) {
  throw new Error(`SOUNDING_LINE_SUITE_FIXTURE_CONTRACT_UNSATISFIED:${profile || "UNKNOWN_PROFILE"}`);
}

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
try {
  const marker = {
    action: "VALIDATION_DATABASE_IDENTITY",
    resourceType: "VALIDATION_DATABASE",
    resourceId: nonceHash,
    correlationId: nonceHash,
  };
  const count = await prisma.platformAuditEvent.count({ where: marker });
  if (count > 1) throw new Error(`SOUNDING_LINE_SUITE_FIXTURE_CONTRACT_UNSATISFIED:${profile}:IDENTITY_DUPLICATED`);
  if (count === 0) {
    await prisma.platformAuditEvent.create({
      data: {
        actorType: "VALIDATION_HARNESS",
        ...marker,
        outcome: "SUCCEEDED",
        metadata: JSON.stringify({ marker: "sounding-line-suite-isolation", profile, nonceHash }),
      },
    });
  }
  process.stdout.write(`${JSON.stringify({ status: "SOUNDING_LINE_SUITE_ISOLATION_READY", profile })}\n`);
} finally {
  await prisma.$disconnect();
}

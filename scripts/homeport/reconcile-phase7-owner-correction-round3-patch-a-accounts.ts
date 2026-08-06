import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { db } from "../../src/lib/db";
import { normalizeDisplayName, repairPendingVerificationChallenge } from "../../src/wayfarer/accounts";

type Mode = "DRY_RUN" | "COMMIT" | "VERIFY";

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}

function parseMode(): Mode {
  const candidate = (process.argv[2] ?? "DRY_RUN").toLocaleUpperCase("en-US");
  if (!(["DRY_RUN", "COMMIT", "VERIFY"] as const).includes(candidate as Mode))
    throw new Error("MODE_MUST_BE_DRY_RUN_COMMIT_OR_VERIFY");
  return candidate as Mode;
}

async function checksum(filePath: string) {
  const digest = createHash("sha256");
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => digest.update(chunk));
    stream.on("error", reject);
    stream.on("end", resolve);
  });
  return digest.digest("hex");
}

function opaqueReference(accountId: string) {
  return createHash("sha256").update(accountId).digest("hex").slice(0, 16);
}

async function main() {
  const mode = parseMode();
  const taskRoot = path.resolve(required("HOMEPORT_PHASE7_TASK_ROOT"));
  const approvedRoot = path.resolve(required("LOCALAPPDATA"), "ProjectHomeport");
  const databaseUrl = required("DATABASE_URL");
  const databasePath = databaseUrl.startsWith("file:") ? path.resolve(databaseUrl.slice(5)) : "";
  const canonicalDatabases = [
    path.resolve("C:/Users/kkids/Documents/Codex_TreasureHunt/prisma/dev.db"),
    path.resolve("C:/Users/kkids/Documents/Codex_TreasureHunt-homeport/prisma/dev.db"),
  ];

  if (
    !taskRoot.startsWith(`${approvedRoot}${path.sep}`) ||
    !taskRoot.includes("phase7-owner-correction-round3-patch-a-")
  )
    throw new Error(`PATCH_A_TASK_ROOT_REFUSED:${taskRoot}`);
  if (!databasePath || !databasePath.startsWith(`${taskRoot}${path.sep}`) || canonicalDatabases.includes(databasePath))
    throw new Error(`PATCH_A_DATABASE_REFUSED:${databasePath || databaseUrl}`);
  if (mode === "COMMIT" && process.env.HOMEPORT_SYNTHETIC_EMAIL_ADAPTER !== "TASK_OWNED_TEST")
    throw new Error("PATCH_A_COMMIT_REQUIRES_TASK_OWNED_SYNTHETIC_EMAIL");

  const beforeChecksum = await checksum(databasePath);
  const accounts = await db.userAccount.findMany({
    where: { status: "PENDING_VERIFICATION" },
    include: {
      profile: true,
      emails: { where: { isPrimary: true }, take: 1 },
      credential: true,
      roles: { where: { revokedAt: null } },
      tokens: {
        where: { purpose: "VERIFY_EMAIL" },
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { delivery: true },
      },
      securityEvents: { where: { eventType: "PATCH_A_TASK_OWNED_INCOMPLETE_FIXTURE" }, take: 1 },
    },
  });

  const counts = {
    scanned: accounts.length,
    healthyPending: 0,
    needsActivation: 0,
    needsChallengeDelivery: 0,
    needsNormalizedDisplayName: 0,
    releasedTaskOwnedIncomplete: 0,
    manualReview: 0,
    mutationsApplied: 0,
  };
  const actions: Array<{ accountRef: string; action: string; applied: boolean }> = [];
  const now = Date.now();

  for (const account of accounts) {
    const accountRef = opaqueReference(account.id);
    const email = account.emails[0];
    const playerRole = account.roles.some((role) => role.role === "PLAYER");
    const structurallyComplete = Boolean(account.profile && email && account.credential && playerRole);
    const taskOwnedIncomplete = account.securityEvents.length === 1;

    if (!structurallyComplete) {
      if (!taskOwnedIncomplete) {
        counts.manualReview += 1;
        actions.push({ accountRef, action: "MANUAL_REVIEW_INCOMPLETE_ACCOUNT", applied: false });
        continue;
      }
      counts.releasedTaskOwnedIncomplete += 1;
      const applied = mode === "COMMIT";
      if (applied) {
        await db.userAccount.delete({ where: { id: account.id } });
        counts.mutationsApplied += 1;
      }
      actions.push({ accountRef, action: "RELEASE_TASK_OWNED_INCOMPLETE_RESERVATIONS", applied });
      continue;
    }

    if (email!.verificationState === "VERIFIED") {
      counts.needsActivation += 1;
      const applied = mode === "COMMIT";
      if (applied) {
        await db.$transaction([
          db.userAccount.update({ where: { id: account.id }, data: { status: "ACTIVE" } }),
          db.securityEvent.create({
            data: {
              accountId: account.id,
              eventType: "ACCOUNT_VERIFIED_STATUS_REPAIRED",
              correlationId: `patch-a-${accountRef}`,
              metadata: "{}",
            },
          }),
        ]);
        counts.mutationsApplied += 1;
      }
      actions.push({ accountRef, action: "ACTIVATE_ALREADY_VERIFIED_ACCOUNT", applied });
      continue;
    }

    if (!account.profile!.normalizedDisplayName) {
      const normalizedDisplayName = normalizeDisplayName(account.profile!.displayName);
      const collision = await db.playerProfile.findFirst({
        where: { normalizedDisplayName, id: { not: account.profile!.id } },
        select: { id: true },
      });
      if (collision) {
        counts.manualReview += 1;
        actions.push({ accountRef, action: "MANUAL_REVIEW_DISPLAY_NAME_COLLISION", applied: false });
        continue;
      }
      counts.needsNormalizedDisplayName += 1;
      const applied = mode === "COMMIT";
      if (applied) {
        await db.playerProfile.update({ where: { id: account.profile!.id }, data: { normalizedDisplayName } });
        counts.mutationsApplied += 1;
      }
      actions.push({ accountRef, action: "RESERVE_NORMALIZED_DISPLAY_NAME", applied });
    }

    const latestToken = account.tokens[0];
    const challengeHealthy = Boolean(
      latestToken &&
        !latestToken.consumedAt &&
        latestToken.expiresAt.getTime() > now &&
        latestToken.delivery &&
        ["PENDING", "SUBMITTED", "DELIVERED"].includes(latestToken.delivery.status),
    );
    if (!challengeHealthy) {
      counts.needsChallengeDelivery += 1;
      const applied = mode === "COMMIT";
      if (applied) {
        await repairPendingVerificationChallenge(account.id);
        counts.mutationsApplied += 1;
      }
      actions.push({ accountRef, action: "REPLACE_VERIFICATION_CHALLENGE_AND_DELIVERY", applied });
    } else if (account.profile!.normalizedDisplayName) {
      counts.healthyPending += 1;
    }
  }

  const actionable =
    counts.needsActivation +
    counts.needsChallengeDelivery +
    counts.needsNormalizedDisplayName +
    counts.releasedTaskOwnedIncomplete +
    counts.manualReview;
  const report = {
    contract: "homeport.phase7.owner-correction.round3.patch-a.account-reconciliation.v1",
    mode,
    generatedAt: new Date().toISOString(),
    database: { location: "TASK_OWNED", beforeChecksum, afterChecksum: await checksum(databasePath) },
    counts: { ...counts, actionable },
    actions,
  };
  const evidenceDirectory = path.join(taskRoot, "evidence");
  await mkdir(evidenceDirectory, { recursive: true });
  await writeFile(
    path.join(evidenceDirectory, `patch-a-account-reconciliation-${mode.toLocaleLowerCase("en-US")}.json`),
    `${JSON.stringify(report, null, 2)}\n`,
    { encoding: "utf8", mode: 0o600 },
  );
  console.log(JSON.stringify(report));
  await db.$disconnect();

  if (mode === "VERIFY" && actionable !== 0) process.exitCode = 2;
}

void main().catch(async (cause: unknown) => {
  console.error(cause instanceof Error ? cause.message : String(cause));
  await db.$disconnect().catch(() => undefined);
  process.exitCode = 1;
});

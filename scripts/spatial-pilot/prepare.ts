import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, relative, isAbsolute, dirname } from "node:path";
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { hash } from "bcryptjs";
import { PrismaClient } from "@prisma/client";

async function main() {
  const root = resolve("artifacts/spatial-pilot");
  const database = resolve(process.argv[2] ?? "artifacts/spatial-pilot/owner-preview.db");
  const child = relative(root, database);
  if (!child || child.startsWith("..") || isAbsolute(child) || !database.endsWith(".db"))
    throw new Error("PILOT_OWNED_DATABASE_REQUIRED");
  const privatePath = `${database}.access.private.json`;
  await mkdir(dirname(database), { recursive: true });
  const url = `file:${database.replaceAll("\\", "/")}`;
  let access: { ownerAccountId: string; email: string; password: string; database: string } | null = null;
  try {
    access = JSON.parse(await readFile(privatePath, "utf8"));
  } catch {
    /* First preparation. */
  }
  if (access && (access.database !== database || access.ownerAccountId !== "spatial-pilot-navigator"))
    throw new Error("PILOT_ACCESS_BINDING_INVALID");
  if (!access) {
    // Refuse every pre-existing database without the task's private ownership receipt.
    try {
      await readFile(database);
      throw new Error("PILOT_EXISTING_DATABASE_WITHOUT_OWNERSHIP");
    } catch (cause) {
      if (!(cause && typeof cause === "object" && "code" in cause && cause.code === "ENOENT")) throw cause;
    }
    execFileSync(process.execPath, ["scripts/sounding-line/sqlite-bootstrap.mjs", "--database-url", url], {
      stdio: "pipe",
      timeout: 120000,
    });
    access = {
      ownerAccountId: "spatial-pilot-navigator",
      email: "navigator.spatial-pilot@example.test",
      password: `Pilot!${randomBytes(24).toString("base64url")}`,
      database,
    };
    const db = new PrismaClient({ datasourceUrl: url });
    try {
      const now = new Date();
      await db.userAccount.create({
        data: {
          id: access.ownerAccountId,
          status: "ACTIVE",
          claimedAt: now,
          ordinaryWorkspaceEntryAt: now,
          profile: {
            create: {
              displayName: "Iona’s Synthetic Navigator",
              normalizedDisplayName: "iona synthetic navigator",
              status: "ACTIVE",
              claimedAt: now,
            },
          },
          emails: {
            create: {
              normalizedEmail: access.email,
              displayEmail: access.email,
              isPrimary: true,
              verificationState: "VERIFIED",
              verifiedAt: now,
            },
          },
          credential: { create: { passwordHash: await hash(access.password, 12), changedAt: now } },
        },
      });
      await writeFile(privatePath, JSON.stringify(access, null, 2), { flag: "wx", mode: 0o600 });
    } finally {
      await db.$disconnect();
    }
  }
  console.log(
    JSON.stringify(
      {
        status: "READY",
        ownerAccountId: access.ownerAccountId,
        databaseUrl: url,
        accessFile: privatePath,
        entry: "/dev/spatial-pilot",
        environment: { SPATIAL_PILOT_ENABLED: "1", SPATIAL_PILOT_OWNER_ID: access.ownerAccountId },
        reset: "Use Start a fresh Voyage in Owner Sea Trials. Previous publications and Voyage history are preserved.",
      },
      null,
      2,
    ),
  );
}
void main().catch((cause) => {
  console.error(cause instanceof Error ? cause.message : "Pilot preparation failed");
  process.exitCode = 1;
});

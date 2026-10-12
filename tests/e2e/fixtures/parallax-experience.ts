import type { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import path from "node:path";

/** Public synthetic identities for the existing task-owned browser fixture only. */
export async function prepareParallaxExperienceAccounts(store: PrismaClient) {
  const database = process.env.DATABASE_URL ?? "";
  const file = database.startsWith("file:") ? database.slice(5) : "";
  if (
    process.env.FOREVER_VALIDATION_ISOLATION !== "1" ||
    process.env.SOUNDING_LINE_SUITE_PROFILE !== "generic" ||
    !/^[a-f0-9]{64}$/.test(process.env.FOREVER_VALIDATION_NONCE_HASH ?? "") ||
    !path.isAbsolute(file) ||
    !/^validation-isolated-\d{8}-\d{9}-[a-f0-9]{32}\.db$/.test(path.basename(file)) ||
    !path.resolve(file).startsWith(path.resolve("artifacts/sounding-line") + path.sep)
  )
    throw new Error("PARALLAX_EXPERIENCE_OWNED_FIXTURE_REQUIRED");
  const now = new Date();
  const passwordHash = await hash("Synthetic-Parallax-Review-2026!", 10);
  for (const [suffix, label, role] of [
    ["a101", "Creator", "CREATOR"],
    ["a102", "Operator", "ADMINISTRATOR"],
  ] as const) {
    const id = `00000000-0000-4000-8000-00000000${suffix}`;
    if (await store.userAccount.findUnique({ where: { id } })) continue;
    await store.userAccount.create({
      data: {
        id,
        status: "ACTIVE",
        claimedAt: now,
        ordinaryWorkspaceEntryAt: now,
        profile: {
          create: {
            displayName: `Synthetic Parallax ${label}`,
            normalizedDisplayName: `synthetic parallax ${label.toLowerCase()}`,
            status: "ACTIVE",
            claimedAt: now,
          },
        },
        emails: {
          create: {
            normalizedEmail: `parallax-review-${label.toLowerCase()}@example.test`,
            displayEmail: `parallax-review-${label.toLowerCase()}@example.test`,
            isPrimary: true,
            verificationState: "VERIFIED",
            verifiedAt: now,
          },
        },
        credential: { create: { passwordHash } },
        roles: { create: { role, scopeType: "GLOBAL" } },
      },
    });
  }
}

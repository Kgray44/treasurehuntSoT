import { prepareParallaxModerationFixture } from "./parallax-compatibility-governance";
import { activateWorkspaceCapability } from "../../../src/homeport/workspace-capabilities";
import { resolvePublicProfileProjection } from "../../../src/community/public-profile";
import { prepareParallaxCompatibilityArchive } from "./parallax-compatibility-archive";
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
  for (const [suffix, label, role, emailLabel] of [
    ["a101", "Creator", "CREATOR", "creator"],
    ["a102", "Operator", "ADMINISTRATOR", "operator"],
    ["a103", "Floating Creator", "CREATOR", "floating-creator"],
    ["a104", "Rooms Creator", "CREATOR", "rooms-creator"],
    ["a105", "Community Creator", "CREATOR", "community-creator"],
    ["a106", "Archive Player", "PLAYER", "archive-player"],
    ["a107", "Workspace Creator", "CREATOR", "workspace-creator"],
    ["a108", "Public Compatibility Creator", "CREATOR", "public-compatibility-creator"],
    ["a109", "Log Owner", "CREATOR", "log-owner"],
    ["a110", "Support Target", "PLAYER", "support-target"],
    ["a111", "Moderation Reviewer", "MODERATION_OPERATOR", "moderation-reviewer"],
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
            ...(emailLabel === "archive-player" ? { id: "00000000-0000-4000-8000-00000000b106" } : {}),
            displayName: `Synthetic Parallax ${label}`,
            normalizedDisplayName: `synthetic parallax ${label.toLowerCase()}`,
            status: "ACTIVE",
            claimedAt: now,
            ...(["community-creator", "public-compatibility-creator"].includes(emailLabel)
              ? {
                  handle: `synthetic-parallax-${emailLabel}`,
                  normalizedHandle: `synthetic-parallax-${emailLabel}`,
                  defaultVisibility: "PUBLIC",
                }
              : {}),
          },
        },
        emails: {
          create: {
            normalizedEmail: `parallax-review-${emailLabel}@example.test`,
            displayEmail: `parallax-review-${emailLabel}@example.test`,
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
  const archiveOwner = await store.playerProfile.findUniqueOrThrow({
    where: { accountId: "00000000-0000-4000-8000-00000000a106" },
    select: { id: true },
  });
  await prepareParallaxCompatibilityArchive(store, archiveOwner.id);
  await activateWorkspaceCapability("00000000-0000-4000-8000-00000000a107", "CAPTAIN");
  await resolvePublicProfileProjection(store, "00000000-0000-4000-8000-00000000a108");
  await prepareParallaxModerationFixture(store, "00000000-0000-4000-8000-00000000a108", "parallax-compat-moderation");
  await store.communityVoyageLog.upsert({
    where: { id: "parallax-compat-private-log" },
    create: {
      id: "parallax-compat-private-log",
      ownerAccountId: "00000000-0000-4000-8000-00000000a109",
      keepsakeId: "parallax-compat-missing-keepsake",
      slug: "parallax-compat-private-log",
      title: "Synthetic private compatibility log",
      visibility: "PRIVATE",
      lifecycleState: "DRAFT",
      verifiedCompletion: false,
    },
    update: {},
  });
}

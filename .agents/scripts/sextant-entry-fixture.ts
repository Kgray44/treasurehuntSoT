/** Exact-source owned synthetic identities for existing Display and unprepared pilot entry. */
import { compare, hash } from "bcryptjs";
import path from "node:path";
import { db } from "../../src/lib/db";
import { sextantOwnedSyntheticOutbox } from "./sextant-account-recovery-fixture";
import { seedSextantResourceExperiences } from "./sextant-resource-fixtures";

const cases = ["default", "1280-no-preference", "1280-reduce", "390-no-preference", "390-reduce"] as const;
export type SextantEntryCase = (typeof cases)[number];
const pilotId = "spatial-pilot-navigator";
const pilotEmail = "sextant.pilot@example.test";
const pilotName = "Synthetic Sextant Pilot";
const pilotPassword = "Synthetic-Sextant-Pilot-2026!";

export async function seedSextantEntryExperience(key: SextantEntryCase = "default") {
  if (!cases.includes(key)) throw new Error("SEXTANT_ENTRY_CASE_INVALID");
  // This verifies the actual HEAD-derived nonce, exact owned path and HTTP/mail
  // configuration. The persisted identity marker is checked before any mutation.
  sextantOwnedSyntheticOutbox();
  const nonce = process.env.FOREVER_VALIDATION_NONCE_HASH!;
  if (
    process.env.SOUNDING_LINE_SUITE_PROFILE !== "generic" ||
    process.env.FOREVER_VALIDATION_ISOLATION !== "1" ||
    !/^validation-isolated-\d{8}-\d{9}-[a-f0-9]{32}\.db$/u.test(
      path.basename((process.env.DATABASE_URL ?? "").slice(5)),
    ) ||
    (await db.platformAuditEvent.count({
      where: { action: "VALIDATION_DATABASE_IDENTITY", resourceId: nonce, correlationId: nonce },
    })) !== 1
  )
    throw new Error("SEXTANT_ENTRY_DATABASE_IDENTITY_REQUIRED");
  const existing = await db.userAccount.findUnique({
    where: { id: pilotId },
    include: { profile: true, emails: true, credential: true, roles: true },
  });
  if (existing) {
    if (
      existing.status !== "ACTIVE" ||
      existing.lockedAt ||
      existing.suspendedAt ||
      existing.mergedIntoAccountId ||
      existing.profile?.status !== "ACTIVE" ||
      existing.profile.displayName !== pilotName ||
      existing.emails.length !== 1 ||
      existing.emails[0].normalizedEmail !== pilotEmail ||
      !existing.emails[0].isPrimary ||
      existing.emails[0].verificationState !== "VERIFIED" ||
      !existing.credential ||
      !(await compare(pilotPassword, existing.credential.passwordHash)) ||
      !existing.roles.some((role) => role.role === "PLAYER" && role.scopeType === "GLOBAL" && !role.revokedAt)
    )
      throw new Error("SEXTANT_ENTRY_PILOT_IDENTITY_COLLISION");
  } else {
    if (await db.accountEmail.count({ where: { normalizedEmail: pilotEmail } }))
      throw new Error("SEXTANT_ENTRY_PILOT_EMAIL_COLLISION");
    const now = new Date();
    await db.userAccount.create({
      data: {
        id: pilotId,
        status: "ACTIVE",
        claimedAt: now,
        ordinaryWorkspaceEntryAt: now,
        profile: {
          create: {
            displayName: pilotName,
            normalizedDisplayName: pilotName.toLowerCase(),
            status: "ACTIVE",
            claimedAt: now,
          },
        },
        emails: {
          create: {
            normalizedEmail: pilotEmail,
            displayEmail: pilotEmail,
            isPrimary: true,
            verificationState: "VERIFIED",
            verifiedAt: now,
          },
        },
        credential: { create: { passwordHash: await hash(pilotPassword, 12) } },
        roles: { create: { role: "PLAYER", scopeType: "GLOBAL" } },
      },
    });
  }
  // No hidden provision, credential reset, publication, launch or cancellation.
  if (
    (await db.chronicle.count({ where: { creatorAccountId: pilotId } })) !== 0 ||
    (await db.taleSession.count({ where: { captainAccountId: pilotId } })) !== 0 ||
    (await db.playthroughMembership.count({ where: { player: { accountId: pilotId } } })) !== 0
  )
    throw new Error("SEXTANT_ENTRY_PILOT_MUST_BE_UNPREPARED");
  const fixture = await seedSextantResourceExperiences(`entry-${key}`);
  return { ...fixture, pilot: { id: pilotId, email: pilotEmail, name: pilotName, password: pilotPassword } };
}

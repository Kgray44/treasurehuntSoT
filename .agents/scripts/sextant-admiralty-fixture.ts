/** Existing canonical role authority, only after the nonce-owned synthetic guard. */
import { db } from "../../src/lib/db";
import { resolveAdmiraltyCapability } from "../../src/admiralty/capabilities";
import { seedSextantResourceExperiences } from "./sextant-resource-fixtures";

const cases = [
  "admiralty-default",
  "admiralty-1280-no-preference",
  "admiralty-1280-reduce",
  "admiralty-390-no-preference",
  "admiralty-390-reduce",
] as const;
export async function seedSextantAdmiraltyExperience(key: (typeof cases)[number] = "admiralty-default") {
  if (!cases.includes(key)) throw new Error("SEXTANT_ADMIRALTY_CASE_INVALID");
  const fixture = await seedSextantResourceExperiences(key);
  const rolesBefore = await db.accountRoleAssignment.findMany({ where: { accountId: fixture.ownerId } });
  if (
    rolesBefore.some(
      (role) =>
        role.revokedAt ||
        role.scopeType !== "GLOBAL" ||
        role.scopeId !== null ||
        !["PLAYER", "CREATOR", "ADMINISTRATOR"].includes(role.role),
    ) ||
    ["PLAYER", "CREATOR"].some((role) => rolesBefore.filter((assignment) => assignment.role === role).length !== 1)
  )
    throw new Error("SEXTANT_ADMIRALTY_EXISTING_ROLE_MISMATCH");
  const existing = rolesBefore.filter((role) => role.role === "ADMINISTRATOR");
  if (!existing.length)
    await db.accountRoleAssignment.create({
      data: { accountId: fixture.ownerId, role: "ADMINISTRATOR", scopeType: "GLOBAL" },
    });
  const roles = await db.accountRoleAssignment.findMany({ where: { accountId: fixture.ownerId } });
  const grants = roles.filter((role) => role.role === "ADMINISTRATOR");
  if (
    grants.length !== 1 ||
    grants[0].revokedAt ||
    grants[0].scopeType !== "GLOBAL" ||
    grants[0].scopeId !== null ||
    roles.some((role) => role.revokedAt || !["PLAYER", "CREATOR", "ADMINISTRATOR"].includes(role.role))
  )
    throw new Error("SEXTANT_ADMIRALTY_EXISTING_ROLE_MISMATCH");
  for (const capability of ["PLATFORM_OBSERVE", "ACCOUNT_OBSERVE", "SUPPORT_REQUEST", "SUPPORT_USE"] as const)
    if (!resolveAdmiraltyCapability(roles, capability).allowed)
      throw new Error("SEXTANT_ADMIRALTY_CANONICAL_AUTHORITY_REFUSED");
  return { ...fixture, targetAccountId: fixture.crewAccountId, targetDisplayName: fixture.crewDisplayName };
}

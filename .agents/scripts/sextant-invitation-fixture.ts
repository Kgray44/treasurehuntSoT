/** Canonical, single-use synthetic invitations; no browser session or acceptance is seeded. */
import { db } from "../../src/lib/db";
import { createPlaythroughAndInvitations } from "../../src/platform/invitations";
import { sextantOwnedSyntheticOutbox } from "./sextant-account-recovery-fixture";
import { seedSextantResourceExperiences } from "./sextant-resource-fixtures";

const cases = [
  "invitation-default",
  "invitation-1280-no-preference",
  "invitation-1280-reduce",
  "invitation-390-no-preference",
  "invitation-390-reduce",
] as const;
export type SextantInvitationCase = (typeof cases)[number];
export async function seedSextantInvitationBase(key: SextantInvitationCase = "invitation-default") {
  if (!cases.includes(key)) throw new Error("SEXTANT_INVITATION_CASE_INVALID");
  const outboxPath = sextantOwnedSyntheticOutbox();
  const fixture = await seedSextantResourceExperiences(key);
  return { ...fixture, outboxPath };
}

export async function createSextantInvitationExperience(
  key: Exclude<SextantInvitationCase, "invitation-default">,
  baseUrl: string,
) {
  const origin = new URL(baseUrl);
  if (origin.protocol !== "http:" || origin.hostname !== "127.0.0.1" || origin.username || origin.password)
    throw new Error("SEXTANT_INVITATION_OWNED_LOOPBACK_REQUIRED");
  const fixture = await seedSextantInvitationBase(key);
  if (!fixture.crewEmail) throw new Error("SEXTANT_INVITATION_CLAIMED_TARGET_REQUIRED");
  const voyageName = `Synthetic invitation ${key}`;
  const claimName = `Synthetic claim ${key}`;
  const mergeName = `Synthetic merge ${key}`;
  const claimEmail = `sextant.claim.${key}@example.test`;
  if (await db.taleSession.count({ where: { captainAccountId: fixture.ownerId, voyageName } }))
    throw new Error("SEXTANT_INVITATION_EXISTING_VOYAGE_REFUSED");
  if (await db.playerProfile.count({ where: { displayName: { in: [claimName, mergeName] } } }))
    throw new Error("SEXTANT_INVITATION_EXISTING_PLAYER_REFUSED");
  if (await db.accountEmail.count({ where: { normalizedEmail: claimEmail } }))
    throw new Error("SEXTANT_INVITATION_EXISTING_CLAIM_REFUSED");
  const invitation = await createPlaythroughAndInvitations(
    {
      taleId: fixture.taleId,
      versionId: fixture.versionId,
      voyageName,
      captainParticipationMode: "CAPTAIN_ONLY",
      accountRequired: false,
      maxRedemptions: 1,
      players: [
        { displayName: claimName, pin: "4826" },
        { displayName: mergeName, pin: "4826" },
      ],
    },
    fixture.ownerId,
    origin.origin,
  );
  if (invitation.invitations.length !== 2) throw new Error("SEXTANT_INVITATION_PAIR_REQUIRED");
  return { ...fixture, invited: invitation, voyageName, claimName, mergeName, claimEmail };
}

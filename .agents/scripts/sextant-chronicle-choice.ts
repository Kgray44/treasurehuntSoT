type Membership = {
  playthroughId: string;
  status: string;
  removedAt: Date | null;
  player: { status: string };
  playthrough: {
    taleId: string;
    publishedVersionId: string | null;
    status: string;
    expiresAt: Date | null;
  };
};

/** A refusal-only fixture check, never an authorization or selection writer. */
export function assertSextantOnlyChronicle(
  memberships: Membership[],
  expected: { voyageId: string; taleId: string; versionId: string },
  now: Date,
) {
  const member = memberships[0];
  if (
    memberships.length !== 1 ||
    member.playthroughId !== expected.voyageId ||
    member.playthrough.taleId !== expected.taleId ||
    member.playthrough.publishedVersionId !== expected.versionId ||
    member.player.status !== "ACTIVE" ||
    member.removedAt !== null ||
    !["ACCEPTED", "READY", "ACTIVE_MEMBER", "COMPLETED_MEMBER"].includes(member.status) ||
    member.playthrough.status !== "ACTIVE" ||
    (member.playthrough.expiresAt !== null && member.playthrough.expiresAt.getTime() <= now.getTime())
  )
    throw new Error("SEXTANT_SINGLE_CHRONICLE_FIXTURE_REQUIRED");
}

/** Canonical completed precondition for read-only generic Passport capture.
 * Actual ordinary authentication and browser completion are exercised separately
 * by sextant-history-journeys, with distinct per-variant ACTIVE fixtures. */
import { randomUUID } from "node:crypto";
import { db } from "../../src/lib/db";
import { interactWithTaleSession } from "../../src/chronicle/progression";
import { seedSextantResourceExperiences } from "./sextant-resource-fixtures";

export async function seedSextantHistoryPresentation() {
  // The fixed case invokes the canonical nonce/path/database guard before any
  // inspection or write. There is no caller-selected account or session input.
  const fixture = await seedSextantResourceExperiences("history-default");
  const crew = await db.playerProfile.findFirstOrThrow({ where: { accountId: fixture.crewAccountId } });
  const session = await db.taleSession.findUniqueOrThrow({ where: { id: fixture.voyageId } });
  const edition = await db.publishedTaleVersion.findUniqueOrThrow({ where: { id: fixture.versionId } });
  const initialMembership = await db.playthroughMembership.findUniqueOrThrow({
    where: { playthroughId_playerProfileId: { playthroughId: session.id, playerProfileId: crew.id } },
  });
  if (
    crew.accountId !== fixture.crewAccountId ||
    session.taleId !== fixture.taleId ||
    session.captainAccountId !== fixture.ownerId ||
    session.publishedVersionId !== edition.id ||
    edition.taleId !== fixture.taleId
  )
    throw new Error("SEXTANT_HISTORY_PRESENTATION_IDENTITY_REFUSED");
  if (session.status === "ACTIVE") {
    if (
      initialMembership.status !== "ACTIVE_MEMBER" ||
      initialMembership.removedAt !== null ||
      initialMembership.completedAt !== null ||
      session.currentSequence !== 4 ||
      session.currentBlockId !== "sextant-resource-passage-history-default" ||
      (await db.artifactGrantReceipt.count({ where: { sessionId: session.id } })) ||
      (await db.taleSessionEvent.count({ where: { sessionId: session.id, eventType: "blockCompleted" } }))
    )
      throw new Error("SEXTANT_HISTORY_PARTIAL_PRESENTATION_PRESERVED");
    // Trusted fixture setup invokes the same progression service as the Player
    // endpoint for this one guarded synthetic membership. It is not auth proof.
    for (let index = 0; index < 3; index++)
      await interactWithTaleSession(session.id, undefined, { action: "continue", idempotencyKey: randomUUID() }, true);
  } else if (session.status !== "COMPLETED") throw new Error("SEXTANT_HISTORY_PRESENTATION_STATE_REFUSED");
  const completed = await db.taleSession.findUniqueOrThrow({ where: { id: session.id } });
  const membership = await db.playthroughMembership.findFirstOrThrow({
    where: { playthroughId: session.id, playerProfileId: crew.id },
  });
  const grants = await db.artifactGrantReceipt.findMany({ where: { sessionId: session.id } });
  const afterEdition = await db.publishedTaleVersion.findUniqueOrThrow({ where: { id: fixture.versionId } });
  if (
    completed.status !== "COMPLETED" ||
    !completed.completedAt ||
    membership.status !== "COMPLETED_MEMBER" ||
    grants.length !== 1 ||
    grants[0].recipientPolicy !== "ALL_ACTIVE_PLAYERS" ||
    grants[0].receiptState !== "ACTIVE" ||
    grants[0].publishedVersionId !== fixture.versionId ||
    JSON.stringify(JSON.parse(grants[0].resolvedRecipientProfileIds)) !== JSON.stringify([crew.id]) ||
    afterEdition.checksum !== edition.checksum ||
    afterEdition.contentSnapshot !== edition.contentSnapshot ||
    (await db.taleSessionEvent.count({ where: { sessionId: session.id, eventType: "sessionCompleted" } })) !== 1
  )
    throw new Error("SEXTANT_HISTORY_PRESENTATION_PROVENANCE_REFUSED");
  return fixture;
}

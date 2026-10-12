import { randomUUID } from "node:crypto";
import { db } from "../../src/lib/db";
import { createAccountSession } from "../../src/wayfarer/accounts";
import { createCrossdeckService } from "../../src/crossdeck/service";
import { createCrossdeckRefitFixture } from "../../tests/e2e/fixtures/crossdeck-refit";

async function main() {
  if (process.env.SOUNDING_LINE_SUITE_PROFILE !== "generic") throw new Error("CROSSDECK_OWNED_DATABASE_REQUIRED");
  // The shared fixture verifies the owned generic path and establishes the
  // nonce marker before any account or Voyage is created.
  const fixture = await createCrossdeckRefitFixture();
  const nonceHash = process.env.FOREVER_VALIDATION_NONCE_HASH!;
  const markers = await db.platformAuditEvent.count({
    where: {
      action: "VALIDATION_DATABASE_IDENTITY",
      resourceType: "VALIDATION_DATABASE",
      resourceId: nonceHash,
      correlationId: nonceHash,
    },
  });
  if (markers !== 1) throw new Error("CROSSDECK_ISOLATION_IDENTITY_REQUIRED");
  const primarySession = await createAccountSession(fixture.account.id, "Synthetic Crossdeck primary experience");
  const companionSession = await createAccountSession(fixture.account.id, "Synthetic Crossdeck companion experience");
  const service = createCrossdeckService(db);
  const primaryActor = { accountId: fixture.account.id, id: primarySession.id };
  const companionActor = { accountId: fixture.account.id, id: companionSession.id };
  const primaryId = randomUUID(),
    companionId = randomUUID();
  const capabilities = {
    version: 1 as const,
    formFactor: "UNKNOWN" as const,
    viewportClass: "MEDIUM" as const,
    reducedMotion: false,
    sextant: {},
  };
  await service.act(primaryActor, {
    action: "register",
    voyageId: fixture.voyage.id,
    surfaceId: primaryId,
    label: "Synthetic primary screen",
    capabilities,
  });
  const challenge = await service.act(primaryActor, { action: "challenge", surfaceId: primaryId, role: "JOURNAL" });
  if (!("code" in challenge) || typeof challenge.code !== "string") throw new Error("CROSSDECK_FIXTURE_PAIRING_FAILED");
  await service.act(companionActor, {
    action: "claim",
    surfaceId: companionId,
    code: challenge.code,
    label: "Synthetic companion screen",
    capabilities,
  });
  const authorized = await service.list(companionActor, fixture.voyage.id);
  if (
    !authorized.some(
      (surface) => surface.surfaceId === companionId && surface.thisSession && surface.role === "JOURNAL",
    )
  )
    throw new Error("CROSSDECK_FIXTURE_PAIRING_AUTHORITY_FAILED");
  // Secrets stay in the capture process; no cookie/session file is archived.
  process.stdout.write(
    JSON.stringify({
      id: "crossdeck-refit",
      accountId: fixture.account.id,
      voyageId: fixture.voyage.id,
      versionId: fixture.voyage.versionId,
      surfaces: {
        PRIMARY: { token: primarySession.token, sessionId: primarySession.id, surfaceId: primaryId },
        COMPANION: { token: companionSession.token, sessionId: companionSession.id, surfaceId: companionId },
      },
    }) + "\n",
  );
}
void main()
  .catch(() => {
    process.stderr.write("CROSSDECK_EXPERIENCE_FIXTURE_FAILED\n");
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

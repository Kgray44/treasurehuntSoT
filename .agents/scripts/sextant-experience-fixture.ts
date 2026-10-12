/** Source-bound synthetic persisted data for the existing generic experience runtime. */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { hash } from "bcryptjs";
import { db } from "../../src/lib/db";
import { syntheticSpatialMoment } from "../../src/parallax/fixtures";
import { closureVoyage } from "../../tests/e2e/fixtures/landfall-closure";
import { saveStudioDraft, studioDraftSchema } from "../../src/chronicle/studio-service";

async function main() {
  const planPath = path.resolve("artifacts/sounding-line/product-experience-plan.json");
  let plan;
  try {
    plan = JSON.parse(await readFile(planPath, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  if (
    !plan.contracts?.some(
      (entry: { experience?: { fixture?: string } }) => entry.experience?.fixture === "sextant-shared-consumers-v1",
    )
  )
    return;
  const candidate = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const databaseUrl = process.env.DATABASE_URL ?? "";
  const databasePath = databaseUrl.startsWith("file:") ? path.resolve(databaseUrl.slice(5)) : "";
  const ownedRoot = path.resolve("artifacts/sounding-line", `generic-${candidate.slice(0, 12)}`);
  const credential = process.env.PHASE2_LEGACY_ACCESS_CODE ?? "";
  const nonceHash = createHash("sha256").update(`sounding-line:${candidate}:generic`).digest("hex");
  if (
    plan.candidateSha !== candidate ||
    plan.fixtureProfile !== "generic" ||
    process.env.SOUNDING_LINE_SUITE_PROFILE !== "generic" ||
    process.env.FOREVER_VALIDATION_ISOLATION !== "1" ||
    process.env.FOREVER_VALIDATION_NONCE_HASH !== nonceHash ||
    !path.isAbsolute(databaseUrl.slice(5)) ||
    path.dirname(databasePath) !== ownedRoot ||
    !/^validation-isolated-\d{8}-\d{9}-[a-f0-9]{32}\.db$/u.test(path.basename(databasePath)) ||
    credential.length < 24
  )
    throw new Error("SEXTANT_EXPERIENCE_OWNED_FIXTURE_REQUIRED");
  const marker = await db.platformAuditEvent.count({
    where: {
      action: "VALIDATION_DATABASE_IDENTITY",
      resourceId: nonceHash,
      correlationId: nonceHash,
    },
  });
  if (marker !== 1) throw new Error("SEXTANT_EXPERIENCE_DATABASE_IDENTITY_REQUIRED");
  const now = new Date();
  const accountId = "sextant-experience-navigator";
  const account = await db.userAccount.create({
    data: {
      id: accountId,
      status: "ACTIVE",
      claimedAt: now,
      ordinaryWorkspaceEntryAt: now,
      profile: {
        create: {
          displayName: "Synthetic Sextant Navigator",
          normalizedDisplayName: "synthetic sextant navigator",
          status: "ACTIVE",
          claimedAt: now,
        },
      },
      emails: {
        create: {
          normalizedEmail: "sextant.experience@example.test",
          displayEmail: "sextant.experience@example.test",
          isPrimary: true,
          verificationState: "VERIFIED",
          verifiedAt: now,
        },
      },
      credential: { create: { passwordHash: await hash(credential, 12) } },
    },
    include: { profile: true },
  });
  for (const role of ["PLAYER", "CREATOR"])
    await db.accountRoleAssignment.create({ data: { accountId, role, scopeType: "GLOBAL" } });
  const actor = { id: accountId, profileId: account.profile!.id, token: "NOT_USED_FOR_BROWSER_AUTHENTICATION" };
  const voyage = await closureVoyage(actor, actor, "narrative", {
    fixtureIds: {
      tale: "sextant-experience-chronicle",
      session: "sextant-experience-voyage",
      chapter: "sextant-experience-chapter",
      active: "sextant-experience-note",
      next: "sextant-experience-complete",
    },
  });
  const version = await db.publishedTaleVersion.findUniqueOrThrow({ where: { id: voyage.versionId } });
  const snapshot = JSON.parse(version.contentSnapshot);
  snapshot.tale.title = "Synthetic Sextant experience Voyage";
  const block = snapshot.chapters[0].blocks[0];
  block.title = "The Captain’s note";
  block.configuration = { heading: "The Captain’s note", body: "Open the Lens to read the released clue." };
  const moment = syntheticSpatialMoment(voyage.activeId);
  moment.definition.ownerPersonId = accountId;
  block.presentation = { spatialMoment: moment };
  block.completion = { mode: "playerConfirmation" };
  const contentSnapshot = JSON.stringify(snapshot);
  await db.publishedTaleVersion.update({
    where: { id: version.id },
    data: {
      contentSnapshot,
      checksum: createHash("sha256").update(contentSnapshot).digest("hex"),
    },
  });
  await db.chronicle.update({ where: { id: voyage.taleId }, data: { title: snapshot.tale.title } });
  // Use the canonical draft writer to mirror the released synthetic clue for
  // ordinary Creator navigation; capture never invokes a gated pilot route.
  const draft = await db.taleDraft.create({
    data: {
      taleId: voyage.taleId,
      createdBy: accountId,
      createdByAccountId: accountId,
    },
  });
  await db.chronicle.update({ where: { id: voyage.taleId }, data: { currentDraftRevisionId: draft.id } });
  await saveStudioDraft(
    voyage.taleId,
    studioDraftSchema.parse({
      autosaveVersion: draft.autosaveVersion,
      tale: snapshot.tale,
      chapters: snapshot.chapters,
    }),
    accountId,
  );
  process.stdout.write("SEXTANT_SYNTHETIC_EXPERIENCE_FIXTURE_READY\n");
}
main()
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : "Synthetic fixture preparation failed"}\n`);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

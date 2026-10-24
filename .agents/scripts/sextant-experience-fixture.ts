/** Source-bound synthetic persisted data for the existing generic experience runtime. */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { hash } from "bcryptjs";
import { assertSextantOnlyChronicle, assertSextantFormalSurfaceCount } from "./sextant-chronicle-choice";
import { db } from "../../src/lib/db";
import { syntheticSpatialMoment } from "../../src/parallax/fixtures";
import { closureVoyage } from "../../tests/e2e/fixtures/landfall-closure";
import { saveStudioDraft, studioDraftSchema } from "../../src/chronicle/studio-service";

async function verifyOnlyChronicle(
  accountId: string,
  expected: { voyageId: string; taleId: string; versionId: string },
  now: Date,
) {
  // Stronger than option eligibility: refuse any additional membership, including
  // old inactive records. This fixture check grants no product authority.
  const memberships = await db.playthroughMembership.findMany({
    where: { player: { accountId } },
    select: {
      playthroughId: true,
      status: true,
      removedAt: true,
      player: { select: { status: true } },
      playthrough: { select: { taleId: true, publishedVersionId: true, status: true, expiresAt: true } },
    },
  });
  assertSextantOnlyChronicle(memberships, expected, now);
}

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
    !plan.contracts?.some((entry: { experience?: { fixture?: string } }) =>
      [
        "sextant-shared-consumers-v1",
        "sextant-resource-consumers-v1",
        "sextant-community-consumers-v1",
        "sextant-history-consumers-v1",
        "sextant-catalog-consumers-v1",
        "sextant-creator-entry-v1",
        "sextant-admiralty-consumers-v1",
        "sextant-private-content-consumers-v1",
        "sextant-account-recovery-consumers-v1",
        "sextant-invitation-consumers-v1",
        "sextant-landfall-consumers-v1",
        "sextant-display-pilot-entry-v1",
      ].includes(entry.experience?.fixture ?? ""),
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
  await seedSextantExperience();
  if (
    plan.contracts.some(
      (entry: { experience?: { fixture?: string } }) => entry.experience?.fixture === "sextant-resource-consumers-v1",
    )
  ) {
    const { seedSextantResourceExperiences } = await import("./sextant-resource-fixtures");
    await seedSextantResourceExperiences();
  }
  if (
    plan.contracts.some(
      (entry: { experience?: { fixture?: string } }) => entry.experience?.fixture === "sextant-community-consumers-v1",
    )
  ) {
    const { seedSextantCommunityExperience } = await import("./sextant-community-fixture");
    await seedSextantCommunityExperience();
  }
  if (
    plan.contracts.some(
      (entry: { experience?: { fixture?: string } }) => entry.experience?.fixture === "sextant-history-consumers-v1",
    )
  ) {
    const { seedSextantHistoryPresentation } = await import("./sextant-history-fixture");
    await seedSextantHistoryPresentation();
  }
  if (
    plan.contracts.some(
      (entry: { experience?: { fixture?: string } }) => entry.experience?.fixture === "sextant-creator-entry-v1",
    )
  ) {
    const { seedSextantResourceExperiences } = await import("./sextant-resource-fixtures");
    await seedSextantResourceExperiences("creator-entry-default");
  }
  if (
    plan.contracts.some(
      (entry: { experience?: { fixture?: string } }) => entry.experience?.fixture === "sextant-catalog-consumers-v1",
    )
  ) {
    const { seedSextantCatalogExperience } = await import("./sextant-catalog-fixture");
    await seedSextantCatalogExperience();
  }
  if (
    plan.contracts.some(
      (entry: { experience?: { fixture?: string } }) => entry.experience?.fixture === "sextant-admiralty-consumers-v1",
    )
  ) {
    const { seedSextantAdmiraltyExperience } = await import("./sextant-admiralty-fixture");
    await seedSextantAdmiraltyExperience();
  }
  if (
    plan.contracts.some(
      (entry: { experience?: { fixture?: string } }) =>
        entry.experience?.fixture === "sextant-private-content-consumers-v1",
    )
  ) {
    const { seedSextantPrivateContentExperience } = await import("./sextant-private-content-fixture");
    await seedSextantPrivateContentExperience();
  }
  if (
    plan.contracts.some(
      (entry: { experience?: { fixture?: string } }) =>
        entry.experience?.fixture === "sextant-account-recovery-consumers-v1",
    )
  ) {
    const { seedSextantAccountRecoveryExperience } = await import("./sextant-account-recovery-fixture");
    await seedSextantAccountRecoveryExperience();
  }
  if (
    plan.contracts.some(
      (entry: { experience?: { fixture?: string } }) => entry.experience?.fixture === "sextant-invitation-consumers-v1",
    )
  ) {
    const { seedSextantInvitationBase } = await import("./sextant-invitation-fixture");
    await seedSextantInvitationBase();
  }
  if (
    plan.contracts.some(
      (entry: { experience?: { fixture?: string } }) => entry.experience?.fixture === "sextant-landfall-consumers-v1",
    )
  ) {
    const { seedSextantLandfallExperience } = await import("./sextant-landfall-fixture");
    await seedSextantLandfallExperience("physical");
  }
  if (
    plan.contracts.some(
      (entry: { experience?: { fixture?: string } }) => entry.experience?.fixture === "sextant-display-pilot-entry-v1",
    )
  ) {
    const { seedSextantEntryExperience } = await import("./sextant-entry-fixture");
    await seedSextantEntryExperience();
  }
  // Formal replay has only global role selectors. Refuse an ambiguous disclosure
  // before capture. This is plan admission, not a reusable development-seed rule:
  // browser tests still preserve and verify older rows through their own scopes.
  const formalIds = new Set(plan.contracts.map((entry: { id: string }) => entry.id));
  const formalAccounts = new Set<string>();
  if (formalIds.has("sextant.phase3.field-context") || formalIds.has("sextant.phase4.native-context"))
    formalAccounts.add("sextant-experience-navigator");
  if (formalIds.has("sextant.shared-consumers.display-entry"))
    formalAccounts.add("sextant-resource-crew-entry-default");
  for (const accountId of formalAccounts) {
    const liveSurfaceCount = await db.crossdeckSurfaceSession.count({
      where: { accountSession: { accountId }, revokedAt: null },
    });
    assertSextantFormalSurfaceCount(liveSurfaceCount);
  }
}

/** Shared by the guarded capture producer and owned generic browser tests.
 * Callers must establish their task-owned synthetic database before seeding. */
export async function seedSextantExperience() {
  const databaseUrl = process.env.DATABASE_URL ?? "";
  const databasePath = databaseUrl.startsWith("file:") ? databaseUrl.slice(5) : "";
  const relative = path.relative(path.resolve("artifacts/sounding-line"), databasePath);
  const nonceHash = process.env.FOREVER_VALIDATION_NONCE_HASH ?? "";
  if (
    process.env.SOUNDING_LINE_SUITE_PROFILE !== "generic" ||
    process.env.FOREVER_VALIDATION_ISOLATION !== "1" ||
    process.env.SOUNDING_LINE_TASK_OWNED_HTTP !== "1" ||
    !path.isAbsolute(databasePath) ||
    !/^generic-[a-f0-9]{12}[\\/]validation-isolated-\d{8}-\d{9}-[a-f0-9]{32}\.db$/.test(relative) ||
    !/^[a-f0-9]{64}$/.test(nonceHash) ||
    (await db.platformAuditEvent.count({
      where: {
        action: "VALIDATION_DATABASE_IDENTITY",
        resourceId: nonceHash,
        correlationId: nonceHash,
      },
    })) !== 1
  )
    throw new Error("SEXTANT_SHARED_FIXTURE_OWNED_DATABASE_REQUIRED");
  const now = new Date();
  const accountId = "sextant-experience-navigator";
  const existing = await db.userAccount.findUnique({
    where: { id: accountId },
    include: { emails: true, profile: true },
  });
  if (existing) {
    // Preparation can already have seeded this same plan. Verify ownership and
    // immutable content; never reset an authored draft, reading or progression.
    const voyage = await db.taleSession.findUniqueOrThrow({ where: { id: "sextant-experience-voyage" } });
    const tale = await db.chronicle.findUniqueOrThrow({ where: { id: "sextant-experience-chronicle" } });
    if (!voyage.publishedVersionId) throw new Error("SEXTANT_EXISTING_FIXTURE_EDITION_MISSING");
    const version = await db.publishedTaleVersion.findUniqueOrThrow({
      where: { id: voyage.publishedVersionId },
    });
    if (
      existing.status !== "ACTIVE" ||
      existing.profile?.displayName !== "Synthetic Sextant Navigator" ||
      !existing.emails.some(
        (email) => email.normalizedEmail === "sextant.experience@example.test" && email.isPrimary,
      ) ||
      tale.creatorAccountId !== accountId ||
      voyage.taleId !== tale.id ||
      version.taleId !== tale.id ||
      createHash("sha256").update(version.contentSnapshot).digest("hex") !== version.checksum
    )
      throw new Error("SEXTANT_EXISTING_FIXTURE_IDENTITY_MISMATCH");
    await verifyOnlyChronicle(accountId, { voyageId: voyage.id, taleId: tale.id, versionId: version.id }, now);
    return {
      accountId,
      voyageId: voyage.id,
      taleId: tale.id,
      versionId: version.id,
      activeId: "sextant-experience-note",
    };
  }
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
      // Public synthetic persona credential, usable only after the exact-source,
      // nonce-owned database guards above. This never configures a real account.
      credential: { create: { passwordHash: await hash("Synthetic-Sextant-Review-2026!", 12) } },
    },
    include: { profile: true },
  });
  for (const role of ["PLAYER", "CREATOR"])
    await db.accountRoleAssignment.create({ data: { accountId, role, scopeType: "GLOBAL" } });
  const actor = {
    id: accountId,
    profileId: account.profile!.id,
    token: "NOT_USED_FOR_BROWSER_AUTHENTICATION",
  };
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
  snapshot.tale.slug = "sextant-experience-chronicle";
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
  await db.chronicle.update({
    where: { id: voyage.taleId },
    data: { title: snapshot.tale.title, slug: "sextant-experience-chronicle" },
  });
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
  const persisted = await db.chronicle.findUniqueOrThrow({ where: { id: voyage.taleId } });
  if (persisted.slug !== snapshot.tale.slug) throw new Error("SEXTANT_SYNTHETIC_ROUTE_IDENTITY_MISMATCH");
  await verifyOnlyChronicle(accountId, { voyageId: voyage.id, taleId: voyage.taleId, versionId: version.id }, now);
  process.stdout.write("SEXTANT_SYNTHETIC_EXPERIENCE_FIXTURE_READY\n");
  return {
    accountId,
    voyageId: voyage.id,
    taleId: voyage.taleId,
    versionId: voyage.versionId,
    activeId: voyage.activeId,
  };
}
if (
  process.argv[1]?.replaceAll("\\", "/").endsWith("/.agents/scripts/sextant-experience-fixture.ts") ||
  process.argv[1] === ".agents/scripts/sextant-experience-fixture.ts"
)
  main()
    .catch((error: unknown) => {
      process.stderr.write(`${error instanceof Error ? error.message : "Synthetic fixture preparation failed"}\n`);
      process.exitCode = 1;
    })
    .finally(() => db.$disconnect());

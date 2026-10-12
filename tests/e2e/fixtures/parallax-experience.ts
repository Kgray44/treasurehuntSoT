import type { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import path from "node:path";
import { createHash } from "node:crypto";
import { updatePlayerJournalReadingState } from "../../../src/platform/libraries";
import { closureVoyage } from "./landfall-closure";
import { syntheticSpatialMoment } from "../../../src/parallax/fixtures";

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
    ["a105", "Lens Player", "PLAYER", "lens-player"],
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

  const voyageId = "00000000-0000-4000-8000-00000000c101";
  if (!(await store.taleSession.findUnique({ where: { id: voyageId } }))) {
    const account = await store.userAccount.findUniqueOrThrow({
      where: { id: "00000000-0000-4000-8000-00000000a105" },
      include: { profile: true },
    });
    const persona = { id: account.id, profileId: account.profile!.id, token: "" };
    const voyage = await closureVoyage(persona, persona, "narrative", { virtual: true });
    const published = await store.publishedTaleVersion.findUniqueOrThrow({ where: { id: voyage.versionId } });
    const snapshot = JSON.parse(published.contentSnapshot);
    snapshot.tale.title = "Synthetic Spatial Continuity Voyage";
    const block = snapshot.chapters
      .flatMap((c: { blocks: { id: string }[] }) => c.blocks)
      .find((b: { id: string }) => b.id === voyage.activeId);
    block.configuration = {
      heading: "A clue between worlds",
      body: "Inspect the released spatial note, then continue.",
    };
    block.presentation.spatialMoment = syntheticSpatialMoment(voyage.activeId);
    const contentSnapshot = JSON.stringify(snapshot);
    await store.publishedTaleVersion.update({
      where: { id: voyage.versionId },
      data: {
        contentSnapshot,
        checksum: createHash("sha256").update(contentSnapshot).digest("hex"),
      },
    });
    await store.chronicle.update({ where: { id: voyage.taleId }, data: { title: snapshot.tale.title } });
    await store.taleSession.update({ where: { id: voyage.id }, data: { id: voyageId } });
    await updatePlayerJournalReadingState(account.profile!.id, voyageId, { hasOpened: true });
  }
}

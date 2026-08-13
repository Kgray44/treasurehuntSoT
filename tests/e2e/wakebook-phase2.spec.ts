import { createHash, randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type BrowserContext } from "@playwright/test";
import { db } from "../../src/lib/db";

type Actor = { context: BrowserContext; profileId: string };

const suffix = randomUUID().replaceAll("-", "").slice(0, 16);
const password = "Wakebook-Phase2-Private-Only-9";

async function register(browser: import("@playwright/test").Browser, label: string): Promise<Actor> {
  const context = await browser.newContext();
  const response = await context.request.post("/api/auth/register", {
    data: {
      displayName: `Wakebook ${label}`,
      email: `wakebook-phase2-${label.toLowerCase()}-${suffix}@example.test`,
      password,
      confirmPassword: password,
    },
  });
  expect(response.status(), await response.text()).toBe(201);
  const body = (await response.json()) as { player: { id: string } };
  const profile = await db.playerProfile.findUniqueOrThrow({
    where: { id: body.player.id },
    select: { accountId: true },
  });
  if (!profile.accountId) throw new Error("The synthetic Wakebook actor was not linked to an account.");
  const verifiedAt = new Date();
  await db.$transaction([
    db.userAccount.update({ where: { id: profile.accountId }, data: { status: "ACTIVE", claimedAt: verifiedAt } }),
    db.accountEmail.updateMany({
      where: { accountId: profile.accountId, isPrimary: true },
      data: { verificationState: "VERIFIED", verifiedAt },
    }),
  ]);
  return { context, profileId: body.player.id };
}

async function seedDetail(ownerId: string, crewId: string) {
  const taleId = `wakebook-phase2-tale-${suffix}`;
  const chapterId = `wakebook-phase2-chapter-${suffix}`;
  const blockId = `wakebook-phase2-block-${suffix}`;
  const chronicle = await db.chronicle.create({
    data: { id: taleId, slug: `wakebook-phase2-${suffix}`, title: "The Remembered Beacon", creatorId: ownerId },
  });
  const snapshot = {
    schemaVersion: 1,
    tale: {
      id: taleId,
      slug: chronicle.slug,
      title: chronicle.title,
      subtitle: null,
      shortDescription: null,
      longDescription: null,
      coverAssetId: null,
      theme: "CARTOGRAPHERS_TABLE",
      visibility: "PRIVATE",
      playerCountMin: 1,
      playerCountMax: 4,
      estimatedDuration: null,
      contentWarnings: null,
    },
    chapters: [
      {
        id: chapterId,
        title: "Beacon Hill",
        subtitle: null,
        description: null,
        coverAssetId: null,
        estimatedDuration: null,
        isOptional: false,
        metadata: {},
        orderIndex: 0,
        entryBlockId: blockId,
        completionBlockId: blockId,
        blocks: [
          {
            id: blockId,
            chapterId,
            blockType: "NARRATIVE",
            title: "Arrival",
            configuration: {},
            presentation: {},
            completion: {},
            orderIndex: 0,
            nextBlockId: null,
          },
        ],
      },
    ],
    assets: [],
    locations: [],
    artifacts: [],
    publishedAt: "2026-08-13T00:00:00.000Z",
  };
  const checksum = createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
  const version = await db.publishedTaleVersion.create({
    data: {
      taleId: chronicle.id,
      versionNumber: 1,
      versionLabel: "Beacon edition",
      publishedBy: ownerId,
      checksum,
      contentSnapshot: JSON.stringify(snapshot),
    },
  });
  const record = await db.playerChronicleRecord.create({
    data: {
      id: `wakebook-phase2-record-${suffix}`,
      playerProfileId: ownerId,
      sourcePlaythroughId: `wakebook-phase2-playthrough-${suffix}`,
      publishedVersionId: version.id,
      publishedVersionChecksum: checksum,
      chronicleTitleSnapshot: chronicle.title,
      creatorAttributionSnapshot: "Wakebook Owner",
      playerNameSnapshot: "Wakebook Owner",
      participationRole: "CAPTAIN",
      crewRoleSnapshot: "Navigator",
      lifecycleStatus: "COMPLETED",
      outcome: "COMPLETED",
      startedAt: new Date("2026-08-12T10:00:00.000Z"),
      joinedAt: new Date("2026-08-12T10:00:00.000Z"),
      completedAt: new Date("2026-08-12T11:00:00.000Z"),
      wallClockSeconds: 3600,
      wallClockAccuracy: "EXACT",
      activeSeconds: 3300,
      activeAccuracy: "EXACT",
      pausedSeconds: 300,
      pausedAccuracy: "EXACT",
      connectedSeconds: 3600,
      connectedAccuracy: "EXACT",
      interactiveSeconds: 3300,
      interactiveAccuracy: "EXACT",
      captainWaitSeconds: 0,
      captainWaitAccuracy: "EXACT",
      completedChapters: JSON.stringify([
        {
          schemaVersion: 1,
          blockId,
          chapterId,
          title: "Beacon Hill",
          completedAt: "2026-08-12T11:00:00.000Z",
          sourceSequence: 1,
          accuracy: "EXACT",
        },
      ]),
      optionalObjectives: JSON.stringify([
        { schemaVersion: 1, state: "AVAILABLE", label: "Find the harbor bell", completed: true },
      ]),
      choiceSummary: JSON.stringify([
        {
          schemaVersion: 1,
          state: "AVAILABLE",
          label: "Light the beacon",
          chapterTitle: "Beacon Hill",
          kind: "CHOICE",
        },
      ]),
      artifactSummary: "[]",
      sourceFingerprint: `wakebook-phase2-fingerprint-${suffix}`,
    },
  });
  await db.playerChronicleParticipantSnapshot.createMany({
    data: [
      {
        historyRecordId: record.id,
        sourceMembershipId: `wakebook-phase2-owner-${suffix}`,
        participantProfileId: ownerId,
        displayNameSnapshot: "Wakebook Owner",
        participationRole: "CAPTAIN",
        crewRoleSnapshot: "Navigator",
        joinedAt: record.joinedAt,
        completedAt: record.completedAt,
      },
      {
        historyRecordId: record.id,
        sourceMembershipId: `wakebook-phase2-crew-${suffix}`,
        participantProfileId: crewId,
        displayNameSnapshot: "Wakebook Crew",
        participationRole: "PLAYER",
        crewRoleSnapshot: "Lookout",
        joinedAt: record.joinedAt,
        completedAt: record.completedAt,
      },
    ],
  });
  const definition = await db.achievementDefinition.create({
    data: {
      key: `wakebook-phase2-achievement-${suffix}`,
      definitionVersion: 1,
      titleSnapshot: "Beacon Keeper",
      descriptionSnapshot: "Recorded when the beacon was lit.",
      criteria: "{}",
    },
  });
  await db.playerAchievement.create({
    data: {
      playerProfileId: ownerId,
      achievementDefinitionId: definition.id,
      definitionVersion: 1,
      evidenceSnapshot: JSON.stringify({ sourcePlaythroughId: record.sourcePlaythroughId }),
      sourceFingerprint: `wakebook-phase2-achievement-fingerprint-${suffix}`,
      earnedAt: record.completedAt,
    },
  });
  return record.id;
}

test("Wakebook Phase 2 keeps rich Voyage Detail private, truthful, editable, and accessible", async ({ browser }) => {
  const owner = await register(browser, "Owner");
  const crew = await register(browser, "Crew");
  const foreign = await register(browser, "Foreign");
  const recordId = await seedDetail(owner.profileId, crew.profileId);
  try {
    const foreignResponse = await foreign.context.request.get(`/api/passport/voyages/${recordId}`);
    expect(foreignResponse.status()).toBe(404);
    expect(await foreignResponse.text()).not.toContain("The Remembered Beacon");

    const page = await owner.context.newPage();
    await page.goto(`/passport/history/${recordId}`);
    await expect(page.getByRole("heading", { name: "Voyage Detail", exact: true })).toBeVisible();
    for (const heading of [
      "Journey Summary",
      "Path Through the Chronicle",
      "Crew",
      "Artifacts",
      "Achievements",
      "Remembrance",
    ])
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    await expect(page.getByText("Wakebook Owner", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Find the harbor bell", { exact: true })).toBeVisible();
    await expect(page.getByText("Beacon Keeper", { exact: true })).toBeVisible();

    await page.getByLabel("What do you want to remember?").fill("A private reflection from the exact Voyage.");
    await page.getByRole("button", { name: "Save Reflection" }).click();
    await expect(page.getByText("Saved to your private archive.")).toBeVisible();
    await page.getByLabel("Memory title").fill("The beacon glow");
    await page.getByLabel("Your private Memory").fill("Only the owner can read this remembrance.");
    await page.getByRole("button", { name: "Add Memory" }).click();
    await expect(page.getByText("The beacon glow", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Edit" }).last().click();
    await expect(page.getByRole("heading", { name: "Edit Chronicle Memory" })).toBeVisible();
    await page.getByRole("button", { name: "Cancel edit" }).click();

    expect(
      (await new AxeBuilder({ page }).analyze()).violations.filter((violation) =>
        ["serious", "critical"].includes(violation.impact ?? ""),
      ),
    ).toEqual([]);
    for (const viewport of [
      { width: 1440, height: 1000 },
      { width: 430, height: 932 },
      { width: 640, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await expect(page.getByRole("heading", { name: "Remembrance" })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    }
    await page.close();
  } finally {
    await Promise.all([owner.context.close(), crew.context.close(), foreign.context.close()]);
  }
});

import { createHash, randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type BrowserContext } from "@playwright/test";
import { db } from "../../src/lib/db";
import { authenticateAccount, registerAccount } from "../../src/wayfarer/accounts";
import { WAYFARER_COOKIE } from "../../src/wayfarer/http";

type Actor = { context: BrowserContext; profileId: string; accountId: string; csrfToken: string };

const suffix = randomUUID().replaceAll("-", "").slice(0, 16);
const password = "Compass-Quartz-Lantern-9";

async function register(browser: import("@playwright/test").Browser, label: string): Promise<Actor> {
  const context = await browser.newContext();
  const email = `wakebook-phase2-${label.toLowerCase().replaceAll(/[^a-z0-9]+/gu, "-")}-${suffix}@example.test`;
  const registration = await registerAccount({
    displayName: `Wakebook ${label} ${suffix.slice(0, 6)}`,
    email,
    password,
    confirmPassword: password,
  });
  const profile = await db.playerProfile.findUniqueOrThrow({
    where: { id: registration.account.profile.id },
    select: { accountId: true },
  });
  if (!profile.accountId) throw new Error("The synthetic Wakebook actor was not linked to an account.");
  const verifiedAt = new Date();
  await db.$transaction([
    db.userAccount.update({
      where: { id: profile.accountId },
      // The browser fixture has completed the ordinary-account entry step; do
      // not bypass the Personal Harbor capability boundary with a legacy cookie.
      data: { status: "ACTIVE", claimedAt: verifiedAt, ordinaryWorkspaceEntryAt: verifiedAt },
    }),
    db.accountEmail.updateMany({
      where: { accountId: profile.accountId, isPrimary: true },
      data: { verificationState: "VERIFIED", verifiedAt },
    }),
  ]);
  const session = await authenticateAccount(email, password, `Wakebook ${label} browser`);
  if (!session) throw new Error("The synthetic Wakebook actor could not start an ordinary account session.");
  await context.addCookies([
    {
      name: WAYFARER_COOKIE,
      value: session.session.token,
      url: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3100",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  return {
    context,
    profileId: registration.account.profile.id,
    accountId: profile.accountId,
    csrfToken: session.session.csrfToken,
  };
}

async function seedDetail(ownerId: string, crewId: string) {
  const detailSuffix = randomUUID().replaceAll("-", "").slice(0, 16);
  const taleId = `wakebook-phase2-tale-${detailSuffix}`;
  const chapterId = `wakebook-phase2-chapter-${detailSuffix}`;
  const blockId = `wakebook-phase2-block-${detailSuffix}`;
  const chronicle = await db.chronicle.create({
    data: { id: taleId, slug: `wakebook-phase2-${detailSuffix}`, title: "The Remembered Beacon", creatorId: ownerId },
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
      id: `wakebook-phase2-record-${detailSuffix}`,
      playerProfileId: ownerId,
      sourcePlaythroughId: `wakebook-phase2-playthrough-${detailSuffix}`,
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
      sourceFingerprint: `wakebook-phase2-fingerprint-${detailSuffix}`,
    },
  });
  await db.playerChronicleParticipantSnapshot.createMany({
    data: [
      {
        historyRecordId: record.id,
        sourceMembershipId: `wakebook-phase2-owner-${detailSuffix}`,
        participantProfileId: ownerId,
        displayNameSnapshot: "Wakebook Owner",
        participationRole: "CAPTAIN",
        crewRoleSnapshot: "Navigator",
        joinedAt: record.joinedAt,
        completedAt: record.completedAt,
      },
      {
        historyRecordId: record.id,
        sourceMembershipId: `wakebook-phase2-crew-${detailSuffix}`,
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
      key: `wakebook-phase2-achievement-${detailSuffix}`,
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
      sourceFingerprint: `wakebook-phase2-achievement-fingerprint-${detailSuffix}`,
      earnedAt: record.completedAt,
    },
  });
  const artifact = await db.playerArtifactRecord.create({
    data: {
      playerProfileId: ownerId,
      sourcePlaythroughId: record.sourcePlaythroughId,
      sourceGrantEventId: `wakebook-phase2-grant-${detailSuffix}`,
      sourceGrantSequence: 2,
      sourceBlockId: blockId,
      publishedVersionId: version.id,
      publishedVersionChecksum: checksum,
      chronicleTitleSnapshot: chronicle.title,
      artifactDefinitionId: `wakebook-phase2-artifact-${detailSuffix}`,
      artifactNameSnapshot: "The Harbor Lantern",
      recipientPolicy: "ALL_ACTIVE_PLAYERS",
      ownershipState: "OWNED",
      sourceFingerprint: `wakebook-phase2-artifact-fingerprint-${detailSuffix}`,
      grantedAt: record.completedAt,
    },
  });
  await db.playerArtifactAssembly.create({
    data: {
      playerProfileId: ownerId,
      sourcePlaythroughId: record.sourcePlaythroughId,
      publishedVersionId: version.id,
      assemblyKeySnapshot: `beacon-assembly-${detailSuffix}`,
      assembledArtifactName: "Restored Beacon",
      recipeSnapshot: "{}",
      status: "COMPLETED",
      completedAt: record.completedAt,
      sourceFingerprint: `wakebook-phase2-assembly-fingerprint-${detailSuffix}`,
    },
  });
  return {
    recordId: record.id,
    sourcePlaythroughId: record.sourcePlaythroughId,
    chronicleId: chronicle.id,
    artifactId: artifact.id,
  };
}

async function seedUnavailableMemoryMedia(owner: Actor, recordId: string, memoryId: string) {
  const createMedia = async (label: string, scanState: string, withdrawnAt: Date | null) => {
    const source = await db.privateAssetObject.create({
      data: {
        sha256: createHash("sha256").update(`wakebook-phase2-${label}-${suffix}`).digest("hex"),
        byteLength: 2,
        mediaType: "image/png",
        representation: "ORIGINAL",
        storageKey: `wakebook-phase2/${label}-${suffix}.png`,
        scanStatus: scanState === "PENDING" ? "PENDING" : "CLEAN",
        ...(scanState === "PENDING" ? {} : { finalizedAt: new Date() }),
      },
    });
    const media = await db.protectedMedia.create({
      data: {
        ownerAccountId: owner.accountId,
        ownerProfileId: owner.profileId,
        sourcePrivateAssetObjectId: source.id,
        mediaKind: "IMAGE",
        declaredMediaType: "image/png",
        detectedMediaType: "image/png",
        byteLength: 2,
        sha256: source.sha256,
        scanState,
        availabilityState: "AVAILABLE",
        accessibilityDescription: `Synthetic ${label} media`,
        withdrawnAt,
      },
    });
    await db.protectedMediaAssociation.create({
      data: {
        protectedMediaId: media.id,
        ownerAccountId: owner.accountId,
        authority: "WAYFARER",
        subjectKind: "WAYFARER_MEMORY",
        subjectOpaqueId: memoryId,
        purpose: "MEMORY_PRIVATE",
        role: "PRIMARY",
        sourceRevision: "wakebook-phase2-browser",
      },
    });
    return media.id;
  };
  return {
    pendingMediaId: await createMedia("pending", "PENDING", null),
    withdrawnMediaId: await createMedia("withdrawn", "CLEAN", new Date()),
  };
}

async function seedConsentMemberships(owner: Actor, crew: Actor, sourcePlaythroughId: string, chronicleId: string) {
  await db.taleSession.create({
    data: {
      id: sourcePlaythroughId,
      taleId: chronicleId,
      accessTokenHash: createHash("sha256").update(`wakebook-phase2-consent-${suffix}`).digest("hex"),
      status: "COMPLETED",
      startedAt: new Date("2026-08-12T10:00:00.000Z"),
      completedAt: new Date("2026-08-12T11:00:00.000Z"),
    },
  });
  await db.playthroughMembership.createMany({
    data: [
      { playthroughId: sourcePlaythroughId, playerProfileId: owner.profileId, role: "CAPTAIN", status: "COMPLETED" },
      { playthroughId: sourcePlaythroughId, playerProfileId: crew.profileId, role: "PLAYER", status: "COMPLETED" },
    ],
  });
}

test("Wakebook Phase 2 keeps rich Voyage Detail private, truthful, editable, and accessible", async ({ browser }) => {
  const owner = await register(browser, "Owner");
  const crew = await register(browser, "Crew");
  const foreign = await register(browser, "Foreign");
  const { recordId } = await seedDetail(owner.profileId, crew.profileId);
  try {
    const foreignResponse = await foreign.context.request.get(`/api/passport/voyages/${recordId}`);
    const foreignBody = await foreignResponse.text();
    expect(foreignResponse.status(), foreignBody).toBe(404);
    expect(foreignBody).not.toContain("The Remembered Beacon");
    const ownerDetail = await owner.context.request.get(`/api/passport/voyages/${recordId}`);
    expect(ownerDetail.ok(), await ownerDetail.text()).toBeTruthy();
    const ownerDetailText = await ownerDetail.text();
    expect(ownerDetailText).toContain("Restored Beacon");
    expect(ownerDetailText).not.toContain("storageKey");

    const page = await owner.context.newPage();
    await page.goto("/passport");
    await expect(page.locator("h1", { hasText: "Chronicle Passport" })).toBeVisible();
    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(page.getByRole("link", { name: "Chronicle Passport", exact: true }).first()).toBeVisible();
    await page.getByRole("link", { name: "Chronicle Passport", exact: true }).first().click();
    await expect(page.locator("h1", { hasText: "Chronicle Passport" })).toBeVisible();
    const passportNavigation = page.getByRole("navigation", { name: "Chronicle Passport sections" });
    await expect(passportNavigation).toBeVisible();
    await expect(passportNavigation.getByRole("link", { name: "Passport", exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(passportNavigation.getByRole("link", { name: "Your Voyages", exact: true })).toHaveAttribute(
      "href",
      "/passport/history",
    );
    await expect(page.getByRole("link", { name: "Personal Harbor", exact: true })).toHaveAttribute("href", "/account");
    expect(
      (await new AxeBuilder({ page }).analyze()).violations.filter((violation) =>
        ["serious", "critical"].includes(violation.impact ?? ""),
      ),
    ).toEqual([]);
    await page.setViewportSize({ width: 430, height: 932 });
    await expect(passportNavigation).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    await page.emulateMedia({ reducedMotion: "reduce" });
    const reducedMotionDuration = await passportNavigation
      .locator("a")
      .first()
      .evaluate((link) => getComputedStyle(link).transitionDuration);
    expect(reducedMotionDuration).toMatch(/(?:0\.01ms|1e-05s)/u);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole("link", { name: "Personal Harbor", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
    await page.getByRole("button", { name: /Wakebook Owner/u }).click();
    const accountNavigation = page.getByRole("dialog", { name: "Account navigation" });
    await expect(accountNavigation.getByRole("link", { name: "Chronicle Passport", exact: true })).toHaveAttribute(
      "href",
      "/passport",
    );
    await accountNavigation.getByRole("link", { name: "Chronicle Passport", exact: true }).click();
    await expect(page.locator("h1", { hasText: "Chronicle Passport" })).toBeVisible();
    await passportNavigation.getByRole("link", { name: "Your Voyages", exact: true }).click();
    await expect(page.locator("h1", { hasText: "Your Voyages" })).toBeVisible();
    await page.getByRole("link", { name: "Open The Remembered Beacon Voyage", exact: true }).click();
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
    await expect(page.getByText("Find the harbor bell")).toBeVisible();
    await expect(page.getByText("Light the beacon")).toBeVisible();
    await expect(page.getByRole("link", { name: "The Harbor Lantern", exact: true })).toBeVisible();
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
    await page.getByRole("button", { name: "Edit" }).last().click();
    await page.getByLabel("Memory title").fill("The revised beacon glow");
    await page.getByRole("button", { name: "Save Memory" }).click();
    await expect(page.getByText("The revised beacon glow", { exact: true })).toBeVisible();

    await page.getByRole("link", { name: "Open private Voyage Book" }).click();
    await expect(page.getByRole("heading", { name: "Voyage Book", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "The Remembered Beacon", exact: true })).toBeVisible();
    await expect(page.getByText("A private reflection from the exact Voyage.")).toBeVisible();
    await expect(page.getByText("The revised beacon glow", { exact: true })).toBeVisible();
    await expect(page.getByText(/does not alter the Voyage/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Print this private Voyage Book" })).toBeVisible();
    await page.getByRole("link", { name: "Back to Voyage Detail" }).click();
    await expect(page.getByRole("heading", { name: "Voyage Detail", exact: true })).toBeVisible();

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
    await page.evaluate(() => {
      document.documentElement.style.zoom = "2";
    });
    await expect(page.getByRole("heading", { name: "Remembrance" })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1),
    ).toBeTruthy();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.keyboard.press("Tab");
    await expect(page.locator(":focus")).toBeVisible();
    await page.close();
  } finally {
    await Promise.all([owner.context.close(), crew.context.close(), foreign.context.close()]);
  }
});

test("Wakebook Phase 2 keeps private media, consent revocation, and historical snapshots owner-safe", async ({
  browser,
}) => {
  const owner = await register(browser, "Consent Owner");
  const crew = await register(browser, "Consent Crew");
  const foreign = await register(browser, "Consent Foreign");
  const fixture = await seedDetail(owner.profileId, crew.profileId);
  const { recordId } = fixture;
  try {
    const ownerHeaders = { "x-csrf-token": owner.csrfToken };
    const crewHeaders = { "x-csrf-token": crew.csrfToken };
    const memoryResponse = await owner.context.request.post(`/api/passport/history/${recordId}/memories`, {
      headers: ownerHeaders,
      data: { title: "A protected beacon Memory", body: "Owner-only remembrance." },
    });
    expect(memoryResponse.ok(), await memoryResponse.text()).toBeTruthy();
    const memory = (await memoryResponse.json()) as { id: string };
    const unavailable = await seedUnavailableMemoryMedia(owner, recordId, memory.id);
    const mediaDetail = await owner.context.request.get(`/api/passport/voyages/${recordId}`);
    expect(mediaDetail.ok(), await mediaDetail.text()).toBeTruthy();
    const mediaDetailText = await mediaDetail.text();
    expect(mediaDetailText).toContain('"state":"LOADING"');
    expect(mediaDetailText).toContain('"state":"WITHDRAWN"');
    expect(mediaDetailText).not.toContain("wakebook-phase2/pending");
    expect(
      (
        await foreign.context.request.get(
          `/api/passport/voyages/${recordId}/memories/${memory.id}/media/${unavailable.pendingMediaId}`,
        )
      ).status(),
    ).toBe(404);

    expect(
      (await owner.context.request.post(`/api/passport/history/${recordId}/keepsake`, { headers: ownerHeaders })).ok(),
    ).toBeTruthy();
    await seedConsentMemberships(owner, crew, fixture.sourcePlaythroughId, fixture.chronicleId);
    const recordBeforeConsent = await db.playerChronicleRecord.findUniqueOrThrow({
      where: { id: recordId },
      select: { completedChapters: true, chronicleTitleSnapshot: true, creatorAttributionSnapshot: true },
    });
    for (const [state, includesCrew] of [
      ["DENIED", false],
      ["GRANTED", true],
      ["REVOKED", false],
    ] as const) {
      const consent = await crew.context.request.put(`/api/passport/history/${recordId}/keepsake/consent`, {
        headers: crewHeaders,
        data: { scope: "DISPLAY_NAME", state },
      });
      expect(consent.ok(), await consent.text()).toBeTruthy();
      expect(
        (
          await owner.context.request.post(`/api/passport/history/${recordId}/keepsake`, { headers: ownerHeaders })
        ).ok(),
      ).toBeTruthy();
      const keepsake = await db.voyageKeepsake.findUniqueOrThrow({ where: { playerChronicleRecordId: recordId } });
      expect(keepsake.presentationPayload.includes("Wakebook Crew")).toBe(includesCrew);
    }
    expect(
      await db.playerChronicleRecord.findUniqueOrThrow({
        where: { id: recordId },
        select: { completedChapters: true, chronicleTitleSnapshot: true, creatorAttributionSnapshot: true },
      }),
    ).toEqual(recordBeforeConsent);
    const foreignConsent = await foreign.context.request.put(`/api/passport/history/${recordId}/keepsake/consent`, {
      headers: { "x-csrf-token": foreign.csrfToken },
      data: { scope: "DISPLAY_NAME", state: "GRANTED" },
    });
    expect(foreignConsent.status()).toBe(400);

    await db.chronicle.update({ where: { id: fixture.chronicleId }, data: { title: "Mutable current Chronicle" } });
    await db.playerProfile.update({ where: { id: crew.profileId }, data: { displayName: "Mutable current crew" } });
    expect(
      await db.playerChronicleRecord.findUniqueOrThrow({
        where: { id: recordId },
        select: { chronicleTitleSnapshot: true, creatorAttributionSnapshot: true },
      }),
    ).toMatchObject({ chronicleTitleSnapshot: "The Remembered Beacon", creatorAttributionSnapshot: "Wakebook Owner" });
    expect(
      await db.playerChronicleParticipantSnapshot.findFirstOrThrow({
        where: { historyRecordId: recordId, participantProfileId: crew.profileId },
        select: { displayNameSnapshot: true },
      }),
    ).toEqual({ displayNameSnapshot: "Wakebook Crew" });
    expect(
      (
        await owner.context.request.delete(`/api/passport/history/${recordId}/memories/${memory.id}`, {
          headers: ownerHeaders,
        })
      ).ok(),
    ).toBeTruthy();
    expect(
      await db.chronicleMemory.findUniqueOrThrow({ where: { id: memory.id }, select: { deletedAt: true } }),
    ).toMatchObject({
      deletedAt: expect.any(Date),
    });
  } finally {
    await Promise.all([owner.context.close(), crew.context.close(), foreign.context.close()]);
  }
});

import { createHash, randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { db } from "../../src/lib/db";

type Account = { context: import("@playwright/test").BrowserContext; profileId: string; csrfToken: string };

const unique = `wayfarer-p3-${randomUUID().slice(0, 12)}`;
const launchedAt = new Date("2026-07-25T10:00:00.000Z");
const joinedAt = new Date("2026-07-25T10:05:00.000Z");
const completedAt = new Date("2026-07-25T10:15:00.000Z");

async function register(browser: import("@playwright/test").Browser, label: string): Promise<Account> {
  const context = await browser.newContext();
  const email = `${unique}-${label.toLowerCase()}@example.test`;
  const password = "Cobalt-tide-lantern-2026!";
  const response = await context.request.post("/api/auth/register", {
    data: {
      displayName: `Synthetic ${label}`,
      email,
      password,
      confirmPassword: password,
    },
  });
  expect(response.status(), await response.text()).toBe(201);
  const body = (await response.json()) as { csrfToken: string; player: { id: string } };
  const profile = await db.playerProfile.findUniqueOrThrow({
    where: { id: body.player.id },
    select: { accountId: true },
  });
  expect(profile.accountId, "Registration must create an account-rooted Player profile.").toBeTruthy();
  const accountId = profile.accountId!;
  const verifiedAt = new Date();
  await Promise.all([
    db.userAccount.update({
      where: { id: accountId },
      data: { status: "ACTIVE", claimedAt: verifiedAt, ordinaryWorkspaceEntryAt: verifiedAt },
    }),
    db.accountEmail.updateMany({
      where: { accountId, isPrimary: true },
      data: { verificationState: "VERIFIED", verifiedAt },
    }),
  ]);
  const signIn = await context.request.post("/api/auth/sign-in", { data: { login: email, password } });
  expect(signIn.status(), await signIn.text()).toBe(200);
  const signedIn = (await signIn.json()) as { csrfToken: string };
  return { context, profileId: body.player.id, csrfToken: signedIn.csrfToken };
}

async function seedVoyage(ownerId: string, crewId: string) {
  const blockOne = `${unique}-block-one`;
  const blockFinal = `${unique}-block-final`;
  const artifactId = `${unique}-artifact`;
  const snapshot = {
    schemaVersion: 1,
    tale: {
      id: `${unique}-tale`,
      slug: unique,
      title: "Synthetic Harbor Chronicle",
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
        id: `${unique}-chapter-one`,
        title: "First Safe Chapter",
        subtitle: null,
        description: null,
        coverAssetId: null,
        estimatedDuration: null,
        isOptional: false,
        metadata: {},
        orderIndex: 0,
        entryBlockId: blockOne,
        completionBlockId: blockOne,
        blocks: [
          {
            id: blockOne,
            chapterId: `${unique}-chapter-one`,
            blockType: "NARRATIVE",
            title: "Safe marker",
            configuration: {},
            presentation: {},
            completion: {},
            orderIndex: 0,
            nextBlockId: blockFinal,
          },
        ],
      },
      {
        id: `${unique}-chapter-two`,
        title: "Final Safe Chapter",
        subtitle: null,
        description: null,
        coverAssetId: null,
        estimatedDuration: null,
        isOptional: false,
        metadata: {},
        orderIndex: 1,
        entryBlockId: blockFinal,
        completionBlockId: blockFinal,
        blocks: [
          {
            id: blockFinal,
            chapterId: `${unique}-chapter-two`,
            blockType: "ARTIFACT",
            title: "Safe lantern",
            configuration: { artifactId },
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
    artifacts: [{ id: artifactId, displayName: "Synthetic Harbor Lantern" }],
    publishedAt: launchedAt.toISOString(),
  };
  const chronicle = await db.chronicle.create({
    data: { slug: unique, title: "Synthetic Harbor Chronicle", creatorId: ownerId },
  });
  const version = await db.publishedTaleVersion.create({
    data: {
      taleId: chronicle.id,
      versionNumber: 1,
      versionLabel: "Synthetic v1",
      publishedBy: ownerId,
      checksum: createHash("sha256").update(JSON.stringify(snapshot)).digest("hex"),
      contentSnapshot: JSON.stringify(snapshot),
    },
  });
  const session = await db.taleSession.create({
    data: {
      taleId: chronicle.id,
      publishedVersionId: version.id,
      accessTokenHash: createHash("sha256").update(unique).digest("hex"),
      status: "COMPLETED",
      startedAt: launchedAt,
      completedAt,
    },
  });
  await db.playthroughMembership.createMany({
    data: [
      {
        playthroughId: session.id,
        playerProfileId: ownerId,
        role: "PLAYER",
        status: "COMPLETED",
        joinedAt,
        completedAt,
      },
      {
        playthroughId: session.id,
        playerProfileId: crewId,
        role: "PLAYER",
        status: "COMPLETED",
        joinedAt,
        completedAt,
      },
    ],
  });
  await db.taleSessionEvent.createMany({
    data: [
      {
        sessionId: session.id,
        publishedVersionId: version.id,
        blockId: blockOne,
        eventType: "chapterCompleted",
        sourceType: "SYNTHETIC",
        idempotencyKey: `${unique}-chapter`,
        sequence: 1,
        createdAt: new Date("2026-07-25T10:06:00.000Z"),
      },
      {
        sessionId: session.id,
        publishedVersionId: version.id,
        blockId: blockFinal,
        eventType: "artifactGranted",
        sourceType: "SYNTHETIC",
        idempotencyKey: `${unique}-artifact`,
        sequence: 2,
        createdAt: new Date("2026-07-25T10:10:00.000Z"),
      },
      {
        sessionId: session.id,
        publishedVersionId: version.id,
        blockId: blockFinal,
        eventType: "sessionCompleted",
        sourceType: "SYNTHETIC",
        idempotencyKey: `${unique}-complete`,
        sequence: 3,
        createdAt: completedAt,
      },
    ],
  });
  const invitationSession = await db.taleSession.create({
    data: {
      taleId: chronicle.id,
      publishedVersionId: version.id,
      accessTokenHash: createHash("sha256").update(`${unique}-invite`).digest("hex"),
    },
  });
  await db.invitation.create({
    data: {
      playthroughId: invitationSession.id,
      intendedPlayerId: ownerId,
      tokenHash: createHash("sha256").update(`${unique}-token`).digest("hex"),
      tokenPrefix: "synthetic",
      shortCodeHash: createHash("sha256").update(`${unique}-code`).digest("hex"),
      shortCodePrefix: "synthetic",
      recipientName: "Synthetic owner",
      createdBy: ownerId,
      expiresAt: completedAt,
      status: "DECLINED",
      declinedAt: completedAt,
    },
  });
  return { chronicle, session, version };
}

test("Wayfarer Phase 3 authenticated Passport history is private, pinned, consent-filtered, and read-only", async ({
  browser,
}) => {
  const owner = await register(browser, "Owner");
  const crew = await register(browser, "Crew");
  const foreign = await register(browser, "Foreign");
  const fixture = await seedVoyage(owner.profileId, crew.profileId);
  const sourceBefore = {
    sessions: await db.taleSession.count({ where: { id: { in: [fixture.session.id] } } }),
    events: await db.taleSessionEvent.count({ where: { sessionId: fixture.session.id } }),
    memberships: await db.playthroughMembership.count({ where: { playthroughId: fixture.session.id } }),
  };
  const materialized = await owner.context.request.post("/api/passport/history", {
    headers: { "x-csrf-token": owner.csrfToken },
  });
  expect(materialized.ok(), await materialized.text()).toBeTruthy();
  const ownerPage = await owner.context.newPage();
  await ownerPage.goto("/passport");
  await expect(ownerPage.locator("h1", { hasText: "Chronicle Passport" })).toBeVisible();
  await expect(ownerPage.getByRole("heading", { name: "Chronicle History", exact: true })).toBeVisible();
  await expect(ownerPage.locator(".passport-card").filter({ hasText: "Chronicle History" })).toContainText("1");
  await expect(ownerPage.getByRole("button", { name: "Reconcile history" })).toHaveCount(0);
  await ownerPage.goto("/passport/history");
  await expect(ownerPage.getByRole("heading", { name: "Synthetic Harbor Chronicle" })).toBeVisible();
  expect(
    (await new AxeBuilder({ page: ownerPage }).analyze()).violations.filter((item) =>
      ["serious", "critical"].includes(item.impact ?? ""),
    ),
  ).toEqual([]);
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 430, height: 932 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await ownerPage.setViewportSize(viewport);
    expect(await ownerPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  }

  const list = await owner.context.request.get("/api/passport/history");
  expect(list.ok(), await list.text()).toBeTruthy();
  const listBody = (await list.json()) as {
    items: Array<{ id: string }>;
    invitations: Array<{ lifecycleStatus: string }>;
  };
  expect(listBody.items).toHaveLength(1);
  expect(listBody.invitations).toEqual(
    expect.arrayContaining([expect.objectContaining({ lifecycleStatus: "DECLINED" })]),
  );
  const recordId = listBody.items[0]!.id;
  expect(
    await db.playerChronicleRecord.count({
      where: { playerProfileId: owner.profileId, sourcePlaythroughId: fixture.session.id },
    }),
  ).toBe(1);
  expect(await db.playerChronicleParticipantSnapshot.count({ where: { historyRecordId: recordId } })).toBe(2);

  const detail = await owner.context.request.get(`/api/passport/history/${recordId}`);
  expect(detail.ok(), await detail.text()).toBeTruthy();
  const detailText = await detail.text();
  expect(detailText).toContain("First Safe Chapter");
  expect(detailText).toContain("Synthetic Harbor Lantern");
  expect(detailText).toContain('"state":"UNAVAILABLE"');
  expect(detailText).toContain("UNAVAILABLE: canonical completion events do not retain selected choice identity.");
  expect(detailText).not.toContain("storageKey");
  expect(detailText).not.toContain("payload");

  const headers = { "x-csrf-token": owner.csrfToken };
  expect(
    (
      await owner.context.request.patch(`/api/passport/history/${recordId}`, {
        headers,
        data: { privateNote: "Synthetic private reflection" },
      })
    ).ok(),
  ).toBeTruthy();
  expect((await owner.context.request.get(`/api/passport/history/${recordId}`)).ok()).toBeTruthy();
  const memoryResponse = await owner.context.request.post(`/api/passport/history/${recordId}/memories`, {
    headers,
    data: { title: "Synthetic Memory", body: "Synthetic only" },
  });
  expect(memoryResponse.ok(), await memoryResponse.text()).toBeTruthy();
  const memory = (await memoryResponse.json()) as { id: string };
  expect(
    (await owner.context.request.delete(`/api/passport/history/${recordId}/memories/${memory.id}`, { headers })).ok(),
  ).toBeTruthy();
  expect(
    await db.chronicleMemory.findUniqueOrThrow({ where: { id: memory.id }, select: { deletedAt: true } }),
  ).toMatchObject({ deletedAt: expect.any(Date) });
  expect(
    (await owner.context.request.post(`/api/passport/history/${recordId}/keepsake`, { headers })).ok(),
  ).toBeTruthy();

  const crewConsent = await crew.context.request.put(`/api/passport/history/${recordId}/keepsake/consent`, {
    headers: { "x-csrf-token": crew.csrfToken },
    data: { scope: "DISPLAY_NAME", state: "GRANTED" },
  });
  expect(crewConsent.ok(), await crewConsent.text()).toBeTruthy();
  expect(
    (await owner.context.request.post(`/api/passport/history/${recordId}/keepsake`, { headers })).ok(),
  ).toBeTruthy();
  const keepsake = await db.voyageKeepsake.findUniqueOrThrow({ where: { playerChronicleRecordId: recordId } });
  expect(keepsake.presentationPayload).toContain("Synthetic Crew");
  expect(keepsake.presentationPayload).not.toContain("Synthetic Owner");
  expect(await db.voyageKeepsake.count({ where: { playerChronicleRecordId: recordId } })).toBe(1);
  const revoked = await crew.context.request.put(`/api/passport/history/${recordId}/keepsake/consent`, {
    headers: { "x-csrf-token": crew.csrfToken },
    data: { scope: "DISPLAY_NAME", state: "REVOKED" },
  });
  expect(revoked.ok(), await revoked.text()).toBeTruthy();
  expect(
    (await owner.context.request.post(`/api/passport/history/${recordId}/keepsake`, { headers })).ok(),
  ).toBeTruthy();
  expect(
    (await db.voyageKeepsake.findUniqueOrThrow({ where: { playerChronicleRecordId: recordId } })).presentationPayload,
  ).not.toContain("Synthetic Crew");

  await db.chronicle.update({ where: { id: fixture.chronicle.id }, data: { title: "Mutable rename must not leak" } });
  await db.playerProfile.update({ where: { id: crew.profileId }, data: { displayName: "Mutable crew rename" } });
  const stable = await owner.context.request.get(`/api/passport/history/${recordId}`);
  const stableText = await stable.text();
  expect(stableText).toContain("Synthetic Harbor Chronicle");
  expect(stableText).toContain("Synthetic Crew");
  expect(stableText).not.toContain("Mutable crew rename");

  const foreignDetail = await foreign.context.request.get(`/api/passport/history/${recordId}`);
  expect(foreignDetail.status()).toBe(404);
  expect(await foreignDetail.text()).not.toContain("Synthetic Harbor Chronicle");
  const foreignConsent = await foreign.context.request.put(`/api/passport/history/${recordId}/keepsake/consent`, {
    headers: { "x-csrf-token": foreign.csrfToken },
    data: { scope: "DISPLAY_NAME", state: "GRANTED" },
  });
  expect(foreignConsent.status()).toBe(400);
  const foreignMemory = await foreign.context.request.post(`/api/passport/history/${recordId}/memories`, {
    headers: { "x-csrf-token": foreign.csrfToken },
    data: { title: "not allowed" },
  });
  expect(foreignMemory.status()).toBe(400);

  expect({
    sessions: await db.taleSession.count({ where: { id: { in: [fixture.session.id] } } }),
    events: await db.taleSessionEvent.count({ where: { sessionId: fixture.session.id } }),
    memberships: await db.playthroughMembership.count({ where: { playthroughId: fixture.session.id } }),
  }).toEqual(sourceBefore);
  await Promise.all([owner.context.close(), crew.context.close(), foreign.context.close()]);
});

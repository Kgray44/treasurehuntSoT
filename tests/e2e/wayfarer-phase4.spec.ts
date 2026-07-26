import { createHash, randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { db } from "../../src/lib/db";

const unique = `wayfarer-p4-${randomUUID().slice(0, 12)}`;

async function register(browser: import("@playwright/test").Browser, label: string) {
  const context = await browser.newContext();
  const response = await context.request.post("/api/auth/register", {
    data: {
      displayName: `Synthetic ${label}`,
      email: `${unique}-${label.toLowerCase()}@example.test`,
      password: "A synthetic test password 42!",
    },
  });
  expect(response.status(), await response.text()).toBe(201);
  const body = (await response.json()) as { csrfToken: string; player: { id: string } };
  return { context, profileId: body.player.id, csrfToken: body.csrfToken };
}

async function seedAuthoritativeGrant(ownerId: string, crewId: string) {
  const artifactId = `${unique}-artifact`,
    eventId = `${unique}-event`,
    blockId = `${unique}-block`,
    occurredAt = new Date("2026-07-25T12:00:00.000Z");
  const snapshot = {
    schemaVersion: 1,
    tale: {
      id: `${unique}-tale`,
      slug: unique,
      title: "Synthetic Phase Four Chronicle",
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
    chapters: [],
    assets: [],
    locations: [],
    artifacts: [
      { id: artifactId, displayName: "Synthetic Compass", inventoryCategory: "RELIC", modelAssetId: "synthetic-model" },
    ],
    publishedAt: occurredAt.toISOString(),
  };
  const chronicle = await db.chronicle.create({
    data: { slug: unique, title: "Synthetic Phase Four Chronicle", creatorId: ownerId },
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
    },
  });
  const [ownerMembership, crewMembership] = await Promise.all([
    db.playthroughMembership.create({
      data: {
        playthroughId: session.id,
        playerProfileId: ownerId,
        status: "COMPLETED_MEMBER",
        joinedAt: new Date("2026-07-25T11:00:00.000Z"),
      },
    }),
    db.playthroughMembership.create({
      data: {
        playthroughId: session.id,
        playerProfileId: crewId,
        status: "COMPLETED_MEMBER",
        joinedAt: new Date("2026-07-25T11:00:00.000Z"),
      },
    }),
  ]);
  await db.taleSessionEvent.create({
    data: {
      id: eventId,
      sessionId: session.id,
      publishedVersionId: version.id,
      blockId,
      eventType: "artifactGranted",
      sourceType: "SYNTHETIC",
      idempotencyKey: `${unique}-grant`,
      sequence: 1,
      payload: JSON.stringify({ artifactId }),
      createdAt: occurredAt,
    },
  });
  await db.artifactGrantReceipt.create({
    data: {
      sessionId: session.id,
      sourceEventId: eventId,
      grantId: randomUUID(),
      schemaVersion: 1,
      artifactDefinitionId: artifactId,
      artifactOccurrenceId: `${session.id}:${eventId}`,
      publishedVersionId: version.id,
      sourceBlockId: blockId,
      recipientPolicy: "SELECTED_PLAYER",
      resolvedRecipientMembershipIds: JSON.stringify([ownerMembership.id]),
      resolvedRecipientProfileIds: JSON.stringify([ownerId]),
      sharedInventoryAction: "ADD_SHARED_INVENTORY",
      personalGrantState: "COLLECTED",
      custodyKind: "PERSONAL",
      receiptState: "ACTIVE",
      occurredAt,
    },
  });
  return { session, eventId, ownerMembership, crewMembership };
}

test("Wayfarer Phase 4 projects only receipt-authorized artifacts and protects private cabinet data", async ({
  browser,
}) => {
  const owner = await register(browser, "Owner"),
    crew = await register(browser, "Crew"),
    foreign = await register(browser, "Foreign");
  const fixture = await seedAuthoritativeGrant(owner.profileId, crew.profileId);
  const sourceBefore = {
    events: await db.taleSessionEvent.count({ where: { sessionId: fixture.session.id } }),
    memberships: await db.playthroughMembership.count({ where: { playthroughId: fixture.session.id } }),
  };
  const ownerPage = await owner.context.newPage();
  await ownerPage.goto("/passport");
  await expect(ownerPage.getByRole("heading", { name: "Artifact Cabinet" })).toBeVisible();
  await expect(ownerPage.getByText("Synthetic Compass")).toBeVisible();
  expect(
    (await new AxeBuilder({ page: ownerPage }).analyze()).violations.filter((item) =>
      ["serious", "critical"].includes(item.impact ?? ""),
    ),
  ).toEqual([]);
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await ownerPage.setViewportSize(viewport);
    expect(await ownerPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  }

  const list = await owner.context.request.get("/api/passport/artifacts");
  expect(list.ok(), await list.text()).toBeTruthy();
  const item = ((await list.json()) as { items: Array<{ id: string }> }).items[0]!;
  const headers = { "x-csrf-token": owner.csrfToken };
  expect(
    (
      await owner.context.request.patch(`/api/passport/artifacts/${item.id}`, {
        headers,
        data: { favorite: true, privateNote: "Owner-only synthetic note", visibility: "PUBLIC" },
      })
    ).ok(),
  ).toBeTruthy();
  const displayCase = await owner.context.request.post("/api/passport/artifacts/cases", {
    headers,
    data: { name: "Synthetic public case", visibility: "PUBLIC" },
  });
  expect(displayCase.ok(), await displayCase.text()).toBeTruthy();
  const caseId = ((await displayCase.json()) as { id: string }).id;
  expect(
    (
      await owner.context.request.put(`/api/passport/artifacts/cases/${caseId}/items`, {
        headers,
        data: { artifactRecordIds: [item.id] },
      })
    ).ok(),
  ).toBeTruthy();
  expect(
    (
      await owner.context.request.patch(`/api/passport/achievements/not-owned`, { headers, data: { showcased: true } })
    ).status(),
  ).toBe(404);
  expect((await foreign.context.request.get(`/api/passport/artifacts/${item.id}`)).status()).toBe(404);

  const profile = await owner.context.request.patch("/api/passport/profile", {
    headers,
    data: { handle: `${unique}-owner` },
  });
  expect(profile.ok(), await profile.text()).toBeTruthy();
  const anonymous = await browser.newContext();
  const publicProjection = await anonymous.request.get(`/api/profile/${unique}-owner/artifacts`);
  expect(publicProjection.ok(), await publicProjection.text()).toBeTruthy();
  const publicText = await publicProjection.text();
  expect(publicText).toContain("Synthetic Compass");
  expect(publicText).not.toContain("Owner-only synthetic note");
  expect(
    await owner.context.request.post("/api/passport/artifacts", { headers }).then((response) => response.ok()),
  ).toBeTruthy();
  expect({
    events: await db.taleSessionEvent.count({ where: { sessionId: fixture.session.id } }),
    memberships: await db.playthroughMembership.count({ where: { playthroughId: fixture.session.id } }),
  }).toEqual(sourceBefore);
  await Promise.all([owner.context.close(), crew.context.close(), foreign.context.close(), anonymous.close()]);
});

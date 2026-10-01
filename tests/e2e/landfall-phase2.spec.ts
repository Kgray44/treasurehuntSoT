import { createHash, randomUUID } from "node:crypto";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { db } from "../../src/lib/db";
import { interactWithTaleSession } from "../../src/chronicle/progression";
import { landfallFixture } from "../../src/landfall/fixtures";
import { createAccountSession } from "../../src/wayfarer/accounts";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";

const suffix = randomUUID().slice(0, 10);
let creatorToken = "";
let playerToken = "";
let captainToken = "";
let draftTaleId = "";
let playerVoyageId = "";
let captainVoyageId = "";
let offlineVoyageId = "";
let virtualVoyageId = "";

test.describe.configure({ mode: "serial", timeout: 120_000 });
test.skip(({ browserName }) => browserName !== "chromium", "Mutable isolated Landfall journey runs once.");

async function account(label: string) {
  const now = new Date();
  const created = await db.userAccount.create({
    data: {
      status: "ACTIVE",
      claimedAt: now,
      ordinaryWorkspaceEntryAt: now,
      profile: {
        create: {
          displayName: label,
          normalizedDisplayName: `${label.toLowerCase()} ${suffix}`,
          status: "ACTIVE",
          claimedAt: now,
        },
      },
      emails: {
        create: {
          normalizedEmail: `${label.replaceAll(" ", "-").toLowerCase()}-${suffix}@example.test`,
          displayEmail: `${label.replaceAll(" ", "-").toLowerCase()}-${suffix}@example.test`,
          isPrimary: true,
          verificationState: "VERIFIED",
          verifiedAt: now,
        },
      },
    },
    include: { profile: true },
  });
  return {
    id: created.id,
    profileId: created.profile!.id,
    token: (await createAccountSession(created.id, "Synthetic Landfall Phase 2 browser journey")).token,
  };
}

async function makeVoyage(
  taleId: string,
  versionId: string,
  accountId: string,
  profileId: string,
  chapterId: string,
  blockId: string,
  captainAccountId?: string,
) {
  const session = await db.taleSession.create({
    data: {
      taleId,
      publishedVersionId: versionId,
      accessTokenHash: createHash("sha256").update(randomUUID()).digest("hex"),
      status: "ACTIVE",
      currentChapterId: chapterId,
      currentBlockId: blockId,
      currentSequence: 1,
      launchedAt: new Date(),
      captainAccountId,
    },
  });
  await db.playthroughMembership.create({
    data: {
      playthroughId: session.id,
      playerProfileId: profileId,
      status: "ACTIVE_MEMBER",
      joinedAt: new Date(),
    },
  });
  return session.id;
}

async function authenticate(context: BrowserContext, token: string, baseURL: string) {
  await context.addCookies([{ name: "wayfarer_account", value: token, url: baseURL, sameSite: "Lax" }]);
}

async function openMap(page: Page, voyageId: string) {
  await page.goto(`/player/playthroughs/${voyageId}/journal`);
  const opening = page.getByRole("dialog", { name: "Open the voyage journal" });
  const map = page.getByRole("navigation", { name: "Journal tools" }).getByRole("button", { name: "map", exact: true });
  await expect.poll(async () => (await opening.isVisible()) || (await map.isVisible()), { timeout: 45_000 }).toBe(true);
  if (await opening.isVisible()) await opening.getByRole("button", { name: /Open the journal/u }).click();
  const chart = page.locator("[data-landfall-player-chart]");
  if ((await map.getAttribute("aria-expanded")) !== "true") await map.click();
  await expect(chart).toBeVisible({ timeout: 30_000 });
}

test.beforeAll(async () => {
  ensureGenericSoundingLineIsolation();
  const creator = await account("Landfall Phase2 Creator");
  const player = await account("Landfall Phase2 Player");
  const captain = await account("Landfall Phase2 Captain");
  creatorToken = creator.token;
  playerToken = player.token;
  captainToken = captain.token;
  const draft = await db.chronicle.create({
    data: {
      slug: `landfall-phase2-draft-${suffix}`,
      title: "Synthetic Landfall draft",
      creatorId: creator.profileId,
      creatorAccountId: creator.id,
      status: "DRAFT",
      visibility: "PRIVATE",
      drafts: { create: { createdBy: creator.profileId, createdByAccountId: creator.id } },
    },
  });
  draftTaleId = draft.id;
  const tale = await db.chronicle.create({
    data: {
      slug: `landfall-phase2-player-${suffix}`,
      title: "Synthetic Landfall Voyage",
      creatorId: creator.profileId,
      creatorAccountId: creator.id,
      status: "PUBLISHED",
      visibility: "PRIVATE",
    },
  });
  const definition = structuredClone(landfallFixture);
  definition.taleId = tale.id;
  definition.waypoints[0].evidenceProfile.acceptedSources.push("PLAYER_CONFIRMATION");
  const chapterId = `${suffix}-chapter`;
  const blockId = `${suffix}-waypoint`;
  const endingId = `${suffix}-ending`;
  const virtualChapterId = "chapter-isles";
  const virtualBlockId = `${suffix}-virtual-waypoint`;
  const virtualEndingId = `${suffix}-virtual-ending`;
  const publishedAt = new Date().toISOString();
  const snapshot = {
    schemaVersion: 1,
    tale: {
      id: tale.id,
      slug: tale.slug,
      title: tale.title,
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
        title: "Arrival passage",
        subtitle: null,
        description: null,
        coverAssetId: null,
        estimatedDuration: null,
        isOptional: false,
        metadata: {},
        orderIndex: 0,
        entryBlockId: blockId,
        completionBlockId: endingId,
        blocks: [
          {
            id: blockId,
            chapterId,
            blockType: "waypointJourney",
            title: "Reach the town",
            configuration: {
              worldspaceId: "town",
              waypointId: "town-arrival",
            },
            presentation: {},
            completion: {
              mode: "landfall",
              provider: {
                id: "landfall",
                version: 1,
                options: {
                  worldspaceId: "town",
                  locationId: "town-arrival",
                  requiredOutcome: "CONFIRMED",
                  allowCaptainOverride: true,
                  allowPlayerFallback: true,
                  replayPolicy: "PRESENTATION_ONLY",
                },
              },
            },
            orderIndex: 0,
            isEnabled: true,
            nextBlockId: endingId,
            connections: [],
          },
          {
            id: endingId,
            chapterId,
            blockType: "taleComplete",
            title: "Voyage complete",
            configuration: {},
            presentation: {},
            completion: {},
            orderIndex: 1,
            isEnabled: true,
            nextBlockId: null,
            connections: [],
          },
        ],
      },
      {
        id: virtualChapterId,
        title: "Imaginary crossing",
        subtitle: null,
        description: null,
        coverAssetId: null,
        estimatedDuration: null,
        isOptional: false,
        metadata: {},
        orderIndex: 1,
        entryBlockId: virtualBlockId,
        completionBlockId: virtualEndingId,
        blocks: [
          {
            id: virtualBlockId,
            chapterId: virtualChapterId,
            blockType: "waypointJourney",
            title: "Find the Secret Isle",
            configuration: { worldspaceId: "isles", waypointId: "isle-region" },
            presentation: {},
            completion: {
              mode: "landfall",
              provider: {
                id: "landfall",
                version: 1,
                options: {
                  worldspaceId: "isles",
                  locationId: "isle-region",
                  requiredOutcome: "CONFIRMED",
                  allowCaptainOverride: true,
                  allowPlayerFallback: true,
                  replayPolicy: "PRESENTATION_ONLY",
                },
              },
            },
            orderIndex: 0,
            isEnabled: true,
            nextBlockId: virtualEndingId,
            connections: [],
          },
          {
            id: virtualEndingId,
            chapterId: virtualChapterId,
            blockType: "taleComplete",
            title: "Isles voyage complete",
            configuration: {},
            presentation: {},
            completion: {},
            orderIndex: 1,
            isEnabled: true,
            nextBlockId: null,
            connections: [],
          },
        ],
      },
    ],
    assets: [],
    locations: [],
    artifacts: [],
    landfall: definition,
    publishedAt,
  };
  const contentSnapshot = JSON.stringify(snapshot);
  const version = await db.publishedTaleVersion.create({
    data: {
      taleId: tale.id,
      versionNumber: 1,
      versionLabel: "Synthetic Phase 2",
      publishedBy: creator.id,
      publishedByAccountId: creator.id,
      checksum: createHash("sha256").update(contentSnapshot).digest("hex"),
      contentSnapshot,
      publishedAt: new Date(publishedAt),
      isCurrent: true,
    },
  });
  await db.chronicle.update({ where: { id: tale.id }, data: { latestPublishedVersionId: version.id } });
  playerVoyageId = await makeVoyage(tale.id, version.id, player.id, player.profileId, chapterId, blockId);
  captainVoyageId = await makeVoyage(tale.id, version.id, player.id, player.profileId, chapterId, blockId, captain.id);
  offlineVoyageId = await makeVoyage(tale.id, version.id, player.id, player.profileId, chapterId, blockId);
  virtualVoyageId = await makeVoyage(
    tale.id,
    version.id,
    player.id,
    player.profileId,
    virtualChapterId,
    virtualBlockId,
  );
  await db.taleSessionEvent.createMany({
    data: [
      {
        sessionId: virtualVoyageId,
        publishedVersionId: version.id,
        blockId: virtualBlockId,
        eventType: "landfallWorldspaceEntered",
        sourceType: "progression",
        idempotencyKey: `${suffix}-virtual-entry`,
        payload: JSON.stringify({ worldspaceId: "isles" }),
        sequence: 2,
      },
      {
        sessionId: virtualVoyageId,
        publishedVersionId: version.id,
        blockId: virtualBlockId,
        eventType: "landfallWaypointRevealed",
        sourceType: "progression",
        idempotencyKey: `${suffix}-virtual-reveal`,
        payload: JSON.stringify({ waypointId: "isle-region" }),
        sequence: 3,
      },
      {
        sessionId: virtualVoyageId,
        publishedVersionId: version.id,
        blockId: virtualBlockId,
        eventType: "landfallRouteSelected",
        sourceType: "progression",
        idempotencyKey: `${suffix}-virtual-route`,
        payload: JSON.stringify({ routeId: "isle-route" }),
        sequence: 4,
      },
    ],
  });
  await db.taleSession.update({ where: { id: virtualVoyageId }, data: { currentSequence: 4 } });
});

test.afterAll(async () => db.$disconnect());

test("Creator authors a physical and virtual Worldspace through the Studio draft", async ({ browser, baseURL }) => {
  const context = await browser.newContext();
  await authenticate(context, creatorToken, baseURL!);
  const page = await context.newPage();
  await page.goto(`/studio/tales/${draftTaleId}/landfall`);
  await expect(page.getByRole("region", { name: "Landfall authoring workspace" })).toBeVisible({ timeout: 45_000 });
  await page.getByLabel("Worldspace name").fill("Synthetic park");
  await page.getByRole("button", { name: "Add Worldspace" }).click();
  await expect(page.getByRole("combobox", { name: "Worldspace", exact: true })).toContainText("Synthetic park");
  await page.getByLabel("Worldspace name").fill("Imaginary sea");
  await page.getByRole("combobox", { name: "Realm" }).selectOption("VIRTUAL");
  await page.getByRole("button", { name: "Add Worldspace" }).click();
  await expect(page.getByRole("combobox", { name: "Worldspace", exact: true })).toContainText("Imaginary sea");
  await expect
    .poll(async () =>
      JSON.parse(
        (await db.taleDraft.findFirstOrThrow({ where: { taleId: draftTaleId } })).landfallDefinition ?? "{}",
      ).worldspaces?.map((item: { kind: string }) => item.kind),
    )
    .toEqual(["PHYSICAL", "VIRTUAL"]);
  const saved = await db.taleDraft.findFirstOrThrow({ where: { taleId: draftTaleId } });
  const authored = JSON.parse(saved.landfallDefinition!);
  expect(authored.worldspaces.map((item: { kind: string }) => item.kind)).toEqual(["PHYSICAL", "VIRTUAL"]);
  const receiptButton = page.getByRole("button", { name: "Save virtual preview receipt" });
  await expect(receiptButton).toBeEnabled();
  await receiptButton.click();
  await expect(page.getByText(/Sanitized .* receipt saved/u)).toBeVisible();
  const receipts = await db.landfallFieldTestReceipt.findMany({ where: { draftId: saved.id } });
  expect(receipts).toHaveLength(1);
  expect(receipts[0].sourceVersion).toBe(saved.autosaveVersion);
  expect(JSON.stringify(receipts[0])).not.toMatch(/latitude|longitude|rawTrail/u);
  await page
    .getByRole("combobox", { name: "Worldspace", exact: true })
    .selectOption({ label: "Synthetic park · real" });
  await page.getByRole("button", { name: "Place at coordinates" }).click();
  await page.getByRole("button", { name: "Add route" }).click();
  await expect
    .poll(async () => {
      const current = await db.taleDraft.findFirstOrThrow({ where: { taleId: draftTaleId } });
      const chart = JSON.parse(current.landfallDefinition!);
      return [chart.waypoints.length, chart.routes.length];
    })
    .toEqual([1, 1]);
  await expect(page.getByText(/stale after draft edits/u)).toBeVisible();
  await context.close();
});

test("Player confirms a visit, sees canonical history, and replays without another event", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  await authenticate(context, playerToken, baseURL!);
  const page = await context.newPage();
  await openMap(page, playerVoyageId);
  const before = await db.taleSessionEvent.count({ where: { sessionId: playerVoyageId } });
  await page.getByRole("button", { name: "Confirm arrival myself" }).click();
  await expect
    .poll(async () => (await db.taleSession.findUnique({ where: { id: playerVoyageId } }))?.currentBlockId)
    .toMatch(/-ending$/u);
  await interactWithTaleSession(playerVoyageId, undefined, { action: "continue", idempotencyKey: randomUUID() }, true);
  await expect
    .poll(async () => (await db.taleSession.findUnique({ where: { id: playerVoyageId } }))?.status)
    .toBe("COMPLETED");
  await openMap(page, playerVoyageId);
  await expect(page.getByRole("region", { name: "Journey history" })).toContainText("Town arrival", {
    timeout: 30_000,
  });
  const events = await db.taleSessionEvent.findMany({ where: { sessionId: playerVoyageId } });
  expect(events.length).toBeGreaterThan(before);
  expect(events.some((event) => event.eventType === "landfallWaypointConfirmed")).toBe(true);
  expect(events.map((event) => event.payload).join(" ")).not.toMatch(/"latitude"|"longitude"/u);
  await page.getByRole("button", { name: "Replay arrival" }).click();
  await expect(page.getByText(/Arrival recorded: Town arrival/u)).toBeVisible();
  expect(await db.taleSessionEvent.count({ where: { sessionId: playerVoyageId } })).toBe(events.length);
  await context.close();
});

test("Captain safe controls show no exact coordinates and record a canonical pause", async ({ browser, baseURL }) => {
  const context = await browser.newContext();
  await authenticate(context, captainToken, baseURL!);
  const page = await context.newPage();
  await page.goto(`/captain/sessions/${captainVoyageId}`);
  await expect(page.getByRole("heading", { name: "Fixture Town" })).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText(/Current waypoint:/u)).toBeVisible();
  await expect(page.locator("body")).not.toContainText("44,-72");
  await page.getByLabel("Captain Landfall action").selectOption("pause");
  await page.getByRole("button", { name: "Review Landfall action" }).click();
  const review = page.getByRole("dialog", { name: "Pause Landfall progress?" });
  await expect(review).toBeVisible();
  await review.getByRole("button", { name: "Pause Landfall progress" }).click();
  await expect(page.getByText(/Pause Landfall progress was recorded/u)).toBeVisible();
  const events = await db.taleSessionEvent.findMany({
    where: { sessionId: captainVoyageId, eventType: "landfallProgressPaused" },
  });
  expect(events).toHaveLength(1);
  await context.close();
});

test("Virtual Player route and revealed region progress without GPS", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  await authenticate(context, playerToken, baseURL!);
  const page = await context.newPage();
  await page.addInitScript(() => {
    const geo = navigator.geolocation;
    const nativeWatch = geo.watchPosition.bind(geo);
    Object.defineProperty(window, "__virtualGpsCalls", { value: { count: 0 } });
    Object.defineProperty(geo, "watchPosition", {
      value: (...args: Parameters<Geolocation["watchPosition"]>) => {
        (window as unknown as { __virtualGpsCalls: { count: number } }).__virtualGpsCalls.count += 1;
        return nativeWatch(...args);
      },
    });
  });
  await openMap(page, virtualVoyageId);
  await expect(page.locator('[data-landfall-player-chart][data-worldspace-kind="VIRTUAL"]')).toBeVisible();
  await expect(page.getByRole("list", { name: "Visible map locations" })).toContainText("Secret Isle");
  await expect(page.getByRole("region", { name: "Route progress" })).toContainText("Isle crossing");
  await expect(page.getByRole("button", { name: "Use my location" })).toHaveCount(0);
  await page.getByRole("button", { name: "Confirm arrival myself" }).click();
  await expect
    .poll(async () =>
      db.taleSessionEvent.count({
        where: { sessionId: virtualVoyageId, eventType: "landfallWaypointConfirmed" },
      }),
    )
    .toBe(1);
  expect(
    await page.evaluate(() => (window as unknown as { __virtualGpsCalls: { count: number } }).__virtualGpsCalls.count),
  ).toBe(0);
  await context.close();
});

test("Offline Player evidence is visibly local, then reconciles once on reconnect", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  await authenticate(context, playerToken, baseURL!);
  const page = await context.newPage();
  await openMap(page, offlineVoyageId);
  await context.setOffline(true);
  await page.getByRole("button", { name: "Confirm arrival myself" }).click();
  await expect(page.getByText(/Evidence queued durably on this device/u)).toBeVisible();
  expect(
    await db.taleSessionEvent.count({ where: { sessionId: offlineVoyageId, eventType: "landfallWaypointConfirmed" } }),
  ).toBe(0);
  await context.setOffline(false);
  await expect
    .poll(
      async () =>
        db.taleSessionEvent.count({
          where: { sessionId: offlineVoyageId, eventType: "landfallWaypointConfirmed" },
        }),
      { timeout: 30_000 },
    )
    .toBe(1);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  expect(
    await db.taleSessionEvent.count({ where: { sessionId: offlineVoyageId, eventType: "landfallWaypointConfirmed" } }),
  ).toBe(1);
  await context.close();
});

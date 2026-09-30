import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { createHash, randomUUID } from "node:crypto";
import { db } from "../../src/lib/db";
import { landfallFixture } from "../../src/landfall/fixtures";
import { createAccountSession } from "../../src/wayfarer/accounts";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";

const suffix = randomUUID().slice(0, 10);
let playerToken = "";
let outsiderToken = "";
let physicalSessionId = "";
let deniedSessionId = "";
let virtualSessionId = "";

test.describe.configure({ mode: "serial", timeout: 120_000 });

async function createPlayer(label: string) {
  const now = new Date();
  const account = await db.userAccount.create({
    data: {
      status: "ACTIVE",
      claimedAt: now,
      ordinaryWorkspaceEntryAt: now,
      profile: {
        create: {
          displayName: label,
          normalizedDisplayName: label.toLocaleLowerCase("en-US"),
          status: "ACTIVE",
          claimedAt: now,
        },
      },
      roles: { create: { role: "PLAYER" } },
    },
    include: { profile: true },
  });
  return {
    accountId: account.id,
    profileId: account.profile!.id,
    token: (await createAccountSession(account.id, "Landfall browser proof")).token,
  };
}

async function seedVoyage(profileId: string, accountId: string, virtual: boolean, variant = "") {
  const slug = `landfall-browser-${virtual ? "virtual" : "physical"}-${variant ? `${variant}-` : ""}${suffix}`;
  const chapterId = `${slug}-chapter`;
  const blockId = `${slug}-block`;
  const tale = await db.chronicle.create({
    data: {
      slug,
      title: virtual ? "Synthetic Virtual Voyage" : "Synthetic Physical Voyage",
      creatorId: profileId,
      creatorAccountId: accountId,
      status: "PUBLISHED",
      visibility: "PRIVATE",
    },
  });
  const definition = structuredClone(landfallFixture);
  definition.taleId = tale.id;
  if (virtual) {
    definition.worldspaces = [definition.worldspaces[1], definition.worldspaces[0]];
    definition.maps[1].renderer = "VECTOR_2D";
    definition.maps[1].source = { type: "ASSET_VECTOR", assetId: "synthetic-vector" };
    definition.waypoints[1].visibility = { hiddenUntilRevealed: false, publicLabel: "Open harbor" };
  }
  const publishedAt = new Date().toISOString();
  const snapshot = {
    schemaVersion: 1,
    tale: {
      id: tale.id,
      slug,
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
        title: "First Passage",
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
      versionLabel: "Synthetic Landfall v1",
      publishedBy: accountId,
      publishedByAccountId: accountId,
      checksum: createHash("sha256").update(contentSnapshot).digest("hex"),
      contentSnapshot,
      publishedAt: new Date(publishedAt),
      isCurrent: true,
    },
  });
  await db.chronicle.update({ where: { id: tale.id }, data: { latestPublishedVersionId: version.id } });
  const session = await db.taleSession.create({
    data: {
      taleId: tale.id,
      publishedVersionId: version.id,
      accessTokenHash: createHash("sha256").update(randomUUID()).digest("hex"),
      status: "ACTIVE",
      currentChapterId: chapterId,
      currentBlockId: blockId,
      currentSequence: 1,
      launchedAt: new Date(),
    },
  });
  await db.playthroughMembership.create({
    data: { playthroughId: session.id, playerProfileId: profileId, status: "ACTIVE_MEMBER", joinedAt: new Date() },
  });
  return session.id;
}

async function installLocationProbe(page: Page) {
  await page.addInitScript(() => {
    const locationProbe = { watches: 0, clears: 0, emit: null as PositionCallback | null };
    Object.defineProperty(window, "__landfallLocationProbe", { value: locationProbe });
    const geo = navigator.geolocation;
    const watch = geo.watchPosition.bind(geo);
    const clear = geo.clearWatch.bind(geo);
    Object.defineProperty(geo, "watchPosition", {
      value: (...args: Parameters<Geolocation["watchPosition"]>) => {
        locationProbe.watches += 1;
        locationProbe.emit = args[0];
        return watch(...args);
      },
    });
    Object.defineProperty(geo, "clearWatch", {
      value: (id: number) => {
        locationProbe.clears += 1;
        clear(id);
      },
    });
  });
}

async function openJournalMap(page: Page, sessionId: string) {
  await page.goto(`/player/playthroughs/${sessionId}/journal`);
  const opening = page.getByRole("dialog", { name: "Open the voyage journal" });
  const map = page.getByRole("navigation", { name: "Journal tools" }).getByRole("button", { name: "map", exact: true });
  await expect.poll(async () => (await opening.isVisible()) || (await map.isVisible()), { timeout: 45_000 }).toBe(true);
  if (await opening.isVisible()) await opening.getByRole("button", { name: /Open the journal/u }).click();
  await expect(map).toBeVisible({ timeout: 45_000 });
  await map.click();
  await expect(page.locator("[data-landfall-player-chart]")).toBeVisible({ timeout: 30_000 });
  return map;
}

async function accountContext(context: BrowserContext, token: string, baseURL: string) {
  await context.addCookies([{ name: "wayfarer_account", value: token, url: baseURL, sameSite: "Lax" }]);
}

async function emitFollowUpFix(page: Page, latitude: number, longitude: number, accuracy: number) {
  await page.evaluate(
    ({ latitude, longitude, accuracy }) => {
      const probe = (window as unknown as { __landfallLocationProbe: { emit: PositionCallback | null } })
        .__landfallLocationProbe;
      probe.emit?.({
        coords: { latitude, longitude, accuracy, altitude: null, altitudeAccuracy: null, heading: null, speed: null },
        timestamp: Date.now(),
      } as GeolocationPosition);
    },
    { latitude, longitude, accuracy },
  );
}

test.beforeAll(async ({ request }) => {
  ensureGenericSoundingLineIsolation();
  const isolation = await request.get("/api/dev/validation/database-identity");
  expect(isolation.status(), await isolation.text()).toBe(200);
  expect(await isolation.json()).toEqual({ validationDatabase: true, nonceMatch: true });
  const player = await createPlayer(`Landfall Browser ${suffix}`);
  const outsider = await createPlayer(`Landfall Outsider ${suffix}`);
  playerToken = player.token;
  outsiderToken = outsider.token;
  physicalSessionId = await seedVoyage(player.profileId, player.accountId, false);
  deniedSessionId = await seedVoyage(player.profileId, player.accountId, false, "denied");
  virtualSessionId = await seedVoyage(player.profileId, player.accountId, true);
});

test.afterAll(async () => db.$disconnect());

test("A: explicit foreground grant shows weak accuracy, confirms arrival, and stops the watch", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  await accountContext(context, playerToken, baseURL!);
  await context.grantPermissions(["geolocation"], { origin: baseURL! });
  await context.setGeolocation({ latitude: 44, longitude: -72, accuracy: 8 });
  const page = await context.newPage();
  await installLocationProbe(page);
  await openJournalMap(page, physicalSessionId);
  expect(
    await page.evaluate(
      () => (window as unknown as { __landfallLocationProbe: { watches: number } }).__landfallLocationProbe.watches,
    ),
  ).toBe(0);
  const before = await db.taleSessionEvent.count({ where: { sessionId: physicalSessionId } });
  await page.getByRole("button", { name: "Use my location" }).click();
  await expect(page.getByText(/Current position shown\. Location signal: .*Estimated accuracy: 8 meters/u)).toBeVisible(
    { timeout: 30_000 },
  );
  expect(
    await page.evaluate(
      () => (window as unknown as { __landfallLocationProbe: { watches: number } }).__landfallLocationProbe.watches,
    ),
  ).toBe(1);
  await page.waitForTimeout(300);
  // Chromium's live override update emits POSITION_UNAVAILABLE in this test environment.
  // The first fix above is browser-native; follow-up fixes exercise the retained watch callback.
  await emitFollowUpFix(page, 44.00001, -72.00001, 1_000);
  await expect(page.getByText(/Location accuracy is too weak/u)).toBeVisible();
  await expect(page.getByText(/Current position shown/u)).toHaveCount(0);
  expect(await db.taleSessionEvent.count({ where: { sessionId: physicalSessionId } })).toBe(before);
  await page.waitForTimeout(300);
  await emitFollowUpFix(page, 44.00001, -72.00001, 12);
  await page.waitForTimeout(300);
  await emitFollowUpFix(page, 44.00002, -72.00002, 12);
  await expect(page.getByText(/Arrival recorded: Town arrival/u)).toBeVisible({ timeout: 30_000 });
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { __landfallLocationProbe: { clears: number } }).__landfallLocationProbe.clears,
      ),
    )
    .toBeGreaterThan(0);
  const events = await db.taleSessionEvent.findMany({ where: { sessionId: physicalSessionId } });
  expect(events.filter((event) => event.eventType === "landfallWaypointConfirmed")).toHaveLength(1);
  expect(JSON.stringify(events.map((event) => event.payload))).not.toMatch(/latitude|longitude|observations/u);
  const watches = await page.evaluate(
    () => (window as unknown as { __landfallLocationProbe: { watches: number } }).__landfallLocationProbe.watches,
  );
  await page.getByRole("button", { name: "Close journal tool drawer" }).click();
  expect(
    await page.evaluate(
      () => (window as unknown as { __landfallLocationProbe: { watches: number } }).__landfallLocationProbe.watches,
    ),
  ).toBe(watches);
  await context.close();
});

test("B: denied permission leaves the chart usable without a false position", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  await accountContext(context, playerToken, baseURL!);
  await context.grantPermissions([], { origin: baseURL! });
  const page = await context.newPage();
  await openJournalMap(page, deniedSessionId);
  await page.getByRole("button", { name: "Use my location" }).click();
  await expect(page.getByText(/Location permission was denied/u)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("list", { name: "Visible map locations" })).toContainText("Town arrival");
  await expect(page.getByText(/Current position shown/u)).toHaveCount(0);
  await context.close();
});

test("C: virtual chart renders with no browser geolocation request", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  await accountContext(context, playerToken, baseURL!);
  const page = await context.newPage();
  await installLocationProbe(page);
  await openJournalMap(page, virtualSessionId);
  await expect(page.getByRole("img", { name: "Virtual Landfall chart" })).toBeVisible();
  await expect(page.getByText(/No live virtual position source is connected/u)).toBeVisible();
  expect(
    await page.evaluate(
      () => (window as unknown as { __landfallLocationProbe: { watches: number } }).__landfallLocationProbe.watches,
    ),
  ).toBe(0);
  await expect(page.getByRole("button", { name: "Use my location" })).toHaveCount(0);
  await context.close();
});

test("D: unauthorized and released responses protect hidden geometry", async ({ browser, baseURL }) => {
  const outsider = await browser.newContext();
  await accountContext(outsider, outsiderToken, baseURL!);
  const outside = await outsider.request.get(`/api/player/playthroughs/${physicalSessionId}/landfall`);
  expect(outside.status()).toBe(404);
  expect(outside.headers()["cache-control"]).toContain("no-store");
  await outsider.close();
  const player = await browser.newContext();
  await accountContext(player, playerToken, baseURL!);
  const response = await player.request.get(`/api/player/playthroughs/${physicalSessionId}/landfall`);
  expect(response.status()).toBe(200);
  const body = await response.text();
  expect(body).not.toContain("isle-region");
  expect(body).not.toContain("synthetic-chart");
  expect(body).not.toContain("future-location");
  await player.close();
});

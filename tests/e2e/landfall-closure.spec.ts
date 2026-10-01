import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { db } from "../../src/lib/db";
import { landfallFixture } from "../../src/landfall/fixtures";
import { captainLandfallCommand, interactWithTaleSession } from "../../src/chronicle/progression";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";
import {
  closureAccount,
  closureVoyage,
  authenticateClosure,
  openClosureJournal,
  openClosureMap,
  auditNativeGeolocation,
  geoAudit,
  qualifiedFollowUpFixes,
  type ClosureAccount,
} from "./fixtures/landfall-closure";

let owner: ClosureAccount;
let player: ClosureAccount;
test.describe.configure({ timeout: 150_000 });
test.use({ actionTimeout: 15_000 });
test.skip(({ browserName }) => browserName !== "chromium", "Owned mutable closure fixtures run once.");
test.beforeAll(async () => {
  ensureGenericSoundingLineIsolation();
  owner = await closureAccount("Closure Creator Captain");
  player = await closureAccount("Closure Player");
});
test.afterAll(async () => db.$disconnect());
const events = (id: string, eventType: string) =>
  db.taleSessionEvent.findMany({ where: { sessionId: id, eventType }, orderBy: { sequence: "asc" } });
const chart = (page: Page) => page.locator("[data-landfall-player-chart]:visible");
async function cached(page: Page) {
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)), { timeout: 30_000 })
    .toBe(true);
  await expect(chart(page)).toContainText("Offline chart: saved", { timeout: 30_000 });
}

test("livingChart embeds the canonical map and shares explicit foreground location with the drawer", async ({
  browser,
  baseURL,
}) => {
  const voyage = await closureVoyage(owner, player);
  const context = await browser.newContext({
    reducedMotion: "reduce",
    permissions: ["geolocation"],
    geolocation: { latitude: 43.99, longitude: -72, accuracy: 5 },
  });
  await authenticateClosure(context, player, baseURL!);
  await auditNativeGeolocation(context);
  const page = await context.newPage();
  await openClosureJournal(page, voyage.id);
  await expect(chart(page)).toHaveCount(1);
  await expect(chart(page).getByRole("list", { name: "Visible map locations" })).toContainText("Town arrival");
  await expect(chart(page).getByLabel("Physical Landfall map", { exact: true })).toBeVisible();
  await expect(page.locator('[data-landfall-feature="town-hidden"]')).toHaveCount(0);
  expect((await geoAudit(page)).calls).toBe(0);
  expect(
    (
      await new AxeBuilder({ page })
        .include("[data-landfall-player-chart]")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await chart(page).getByRole("button", { name: "Use my location", exact: true }).click();
  await expect.poll(async () => (await geoAudit(page)).active.length).toBe(1);
  await expect(chart(page)).toContainText("Current position shown");
  await openClosureMap(page);
  expect((await geoAudit(page)).calls).toBe(1);
  expect((await geoAudit(page)).active).toHaveLength(1);
  await chart(page).getByRole("button", { name: "Stop using my location" }).click();
  await expect.poll(async () => (await geoAudit(page)).active.length).toBe(0);
  await chart(page).getByRole("button", { name: "Confirm arrival myself" }).click();
  await expect.poll(async () => (await events(voyage.id, "landfallWaypointConfirmed")).length).toBe(1);
  await expect(chart(page).getByRole("region", { name: "Journey history" })).toContainText("Town arrival");
  expect((await db.taleSession.findUniqueOrThrow({ where: { id: voyage.id } })).currentBlockId).toBe(voyage.activeId);
  await context.close();
});

test("locationObservation withholds its prompt until native arrival, then requires a separate response", async ({
  browser,
  baseURL,
}) => {
  const voyage = await closureVoyage(owner, player, "locationObservation");
  const context = await browser.newContext({
    reducedMotion: "reduce",
    permissions: ["geolocation"],
    geolocation: { latitude: 44, longitude: -72, accuracy: 200 },
  });
  await authenticateClosure(context, player, baseURL!);
  await auditNativeGeolocation(context);
  const page = await context.newPage();
  await openClosureJournal(page, voyage.id);
  await expect(page.getByText("Observe the carved bird and confirm what you found", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Confirm my observation" })).toHaveCount(0);
  await openClosureMap(page);
  await chart(page).getByRole("button", { name: "Use my location", exact: true }).click();
  await expect(chart(page)).toContainText("accuracy is too weak");
  expect(await events(voyage.id, "landfallWaypointConfirmed")).toHaveLength(0);
  await qualifiedFollowUpFixes(page);
  await expect.poll(async () => (await events(voyage.id, "landfallWaypointConfirmed")).length).toBe(1);
  expect((await db.taleSession.findUniqueOrThrow({ where: { id: voyage.id } })).currentBlockId).toBe(voyage.activeId);
  expect(await events(voyage.id, "landfallObservationResponded")).toHaveLength(0);
  await page.keyboard.press("Escape");
  await expect(
    page
      .getByRole("article", { name: "Contextual observation" })
      .getByText("Observe the carved bird and confirm what you found", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Confirm my observation" }).click();
  await expect
    .poll(async () => (await db.taleSession.findUniqueOrThrow({ where: { id: voyage.id } })).currentBlockId)
    .toBe(voyage.nextId);
  expect(await events(voyage.id, "landfallObservationResponded")).toHaveLength(1);
  expect((await geoAudit(page)).active).toHaveLength(0);
  await context.close();
});

test("routeJourney needs both canonical waypoint visits; a virtual Journey never asks for GPS", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  await authenticateClosure(context, player, baseURL!);
  await auditNativeGeolocation(context);
  const page = await context.newPage();
  const route = await closureVoyage(owner, player, "routeJourney", { route: true });
  await openClosureJournal(page, route.id);
  await openClosureMap(page);
  await expect(chart(page).getByRole("region", { name: "Route progress" })).toContainText("Second square");
  await chart(page).getByRole("button", { name: "Confirm arrival myself" }).click();
  await expect.poll(async () => (await events(route.id, "landfallWaypointConfirmed")).length).toBe(1);
  expect((await db.taleSession.findUniqueOrThrow({ where: { id: route.id } })).currentBlockId).toBe(route.activeId);
  await expect(chart(page)).toContainText("Current objective: Second square");
  await chart(page).getByRole("button", { name: "Confirm arrival myself" }).click();
  await expect
    .poll(async () => (await db.taleSession.findUniqueOrThrow({ where: { id: route.id } })).currentBlockId)
    .toBe(route.nextId);
  expect(await events(route.id, "landfallWaypointConfirmed")).toHaveLength(2);
  const virtual = await closureVoyage(owner, player, "waypointJourney", { virtual: true });
  await openClosureJournal(page, virtual.id);
  await openClosureMap(page);
  await expect(chart(page)).toHaveAttribute("data-worldspace-kind", "VIRTUAL");
  await expect(chart(page).getByRole("button", { name: "Use my location" })).toHaveCount(0);
  await chart(page).getByRole("button", { name: "Confirm arrival myself" }).click();
  await expect
    .poll(async () => (await db.taleSession.findUniqueOrThrow({ where: { id: virtual.id } })).currentBlockId)
    .toBe(virtual.nextId);
  expect((await geoAudit(page)).calls).toBe(0);
  await context.close();
});

test("locationReveal and locationChoice release and select canonical targets through Player actions", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  await authenticateClosure(context, player, baseURL!);
  await auditNativeGeolocation(context);
  const page = await context.newPage();
  for (const kind of ["locationReveal", "locationChoice"] as const) {
    const voyage = await closureVoyage(owner, player, kind);
    await openClosureJournal(page, voyage.id);
    await page
      .getByRole("button", {
        name: kind === "locationChoice" ? "Take the hidden course" : "Continue Voyage",
        exact: true,
      })
      .click();
    await expect
      .poll(async () => (await db.taleSession.findUniqueOrThrow({ where: { id: voyage.id } })).currentBlockId)
      .toBe(voyage.nextId);
    const reveals = await events(voyage.id, "landfallWaypointRevealed");
    expect(reveals).toHaveLength(1);
    expect(JSON.parse(reveals[0].payload).waypointId).toBe("town-hidden");
    if (kind === "locationChoice") {
      const selected = await events(voyage.id, "landfallWaypointSelected");
      expect(selected.some((event) => JSON.parse(event.payload).waypointId === "town-hidden")).toBe(true);
    }
    await openClosureMap(page);
    await expect(chart(page).getByRole("list", { name: "Visible map locations" })).toContainText(
      "Withheld destination",
    );
  }
  expect((await geoAudit(page)).calls).toBe(0);
  await context.close();
});

test("all eight Captain controls write canonical events through the reviewed browser commands", async ({
  browser,
  baseURL,
}) => {
  const voyage = await closureVoyage(owner, player, "livingChart", { captain: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await authenticateClosure(context, owner, baseURL!);
  const page = await context.newPage();
  await page.goto(`/captain/sessions/${voyage.id}`);
  await expect(page.getByLabel("Captain Landfall action")).toBeVisible({ timeout: 45_000 });
  const commands = [
    ["revealWaypoint", "town-hidden", "Reveal waypoint", "landfallWaypointRevealed"],
    ["revealRoute", "hidden-route", "Reveal route", "landfallRouteRevealed"],
    ["selectRoute", "town-route", "Set route", "landfallRouteSelected"],
    ["selectWaypoint", "town-second", "Set next waypoint", "landfallWaypointSelected"],
    ["skipWaypoint", "town-second", "Skip waypoint", "landfallWaypointSkipped"],
    ["confirmArrival", "town-arrival", "Confirm arrival without sensor evidence", "landfallWaypointConfirmed"],
    ["pause", "", "Pause Landfall progress", "landfallProgressPaused"],
    ["resume", "", "Resume Landfall progress", "landfallProgressResumed"],
  ];
  for (const [action, target, label, eventType] of commands) {
    const before = (await events(voyage.id, eventType)).length;
    await page.getByLabel("Captain Landfall action").selectOption(action);
    if (target) await page.getByRole("combobox", { name: "Target", exact: true }).selectOption(target);
    await page.getByRole("button", { name: "Review Landfall action" }).click();
    const review = page.getByRole("dialog", { name: `${label}?` });
    await expect(review).toBeVisible();
    if (["skipWaypoint", "confirmArrival"].includes(action)) {
      await expect(review.getByRole("button", { name: label, exact: true })).toBeDisabled();
      await review.getByLabel("Captain reason").fill("Synthetic closure accessibility fallback");
    }
    await review.getByRole("button", { name: label, exact: true }).click();
    await expect(page.getByText(`${label} was recorded in the canonical Voyage.`, { exact: true })).toBeVisible();
    await expect.poll(async () => (await events(voyage.id, eventType)).length).toBe(before + 1);
  }
  const confirmation = JSON.parse((await events(voyage.id, "landfallWaypointConfirmed"))[0].payload!);
  expect(confirmation.method).toBe("CAPTAIN_CONFIRMATION");
  expect(JSON.stringify(confirmation)).not.toMatch(/latitude|longitude|coordinate/u);
  const staleBefore = await db.taleSession.findUniqueOrThrow({ where: { id: voyage.id } });
  await page.getByLabel("Captain Landfall action").selectOption("pause");
  await page.getByRole("button", { name: "Review Landfall action" }).click();
  await captainLandfallCommand(voyage.id, owner.id, {
    action: "revealWaypoint",
    targetId: "town-hidden",
    expectedSequence: staleBefore.currentSequence,
    idempotencyKey: randomUUID(),
  });
  await page
    .getByRole("dialog", { name: "Pause Landfall progress?" })
    .getByRole("button", { name: "Pause Landfall progress", exact: true })
    .click();
  await expect(
    page.getByText("Voyage changed. Refresh before preparing another Landfall action.", { exact: true }),
  ).toBeVisible();
  expect(await events(voyage.id, "landfallProgressPaused")).toHaveLength(1);
  await expect(page.locator("body")).not.toContainText("44,-72");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  expect(
    (
      await new AxeBuilder({ page })
        .include(".captain-command-console")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await context.close();
});

test("physical Creator walk uses native fixes and saves only a source-bound sanitized receipt", async ({
  browser,
  baseURL,
}) => {
  const tale = await db.chronicle.create({
    data: {
      slug: `closure-field-${randomUUID()}`,
      title: "Synthetic physical field test",
      creatorId: owner.profileId,
      creatorAccountId: owner.id,
      status: "DRAFT",
      visibility: "PRIVATE",
    },
  });
  const definition = structuredClone(landfallFixture);
  definition.taleId = tale.id;
  const draft = await db.taleDraft.create({
    data: {
      taleId: tale.id,
      createdBy: owner.profileId,
      createdByAccountId: owner.id,
      landfallDefinition: JSON.stringify(definition),
      autosaveVersion: 1,
    },
  });
  const context = await browser.newContext({
    permissions: ["geolocation"],
    geolocation: { latitude: 44, longitude: -72, accuracy: 150 },
    viewport: { width: 768, height: 1024 },
  });
  await authenticateClosure(context, owner, baseURL!);
  await auditNativeGeolocation(context);
  const page = await context.newPage();
  await page.goto(`/studio/tales/${tale.id}/landfall`);
  await expect(page.getByRole("region", { name: "Landfall authoring workspace" })).toBeVisible({ timeout: 45_000 });
  await page.getByRole("complementary").getByRole("button", { name: "Town arrival", exact: true }).click();
  const panel = page.getByRole("region", { name: "Creator field test" });
  expect((await geoAudit(page)).calls).toBe(0);
  await panel.getByRole("button", { name: "Start test walk" }).click();
  await expect.poll(async () => (await geoAudit(page)).samples).toBeGreaterThan(0);
  await expect(panel.locator(".landfall-test-diagnostics")).toContainText("150 m");
  await qualifiedFollowUpFixes(page);
  await expect(panel.locator(".landfall-test-diagnostics")).toContainText("confirmed");
  await panel.getByRole("button", { name: "Save walk receipt" }).click();
  await expect(panel.getByText(/Sanitized .* receipt saved/u)).toBeVisible();
  const receipt = await db.landfallFieldTestReceipt.findFirstOrThrow({ where: { draftId: draft.id } });
  expect(receipt.sourceVersion).toBe(1);
  expect(receipt.providerClass).toBe("BROWSER_REPORTED_GEOLOCATION");
  expect(JSON.stringify(receipt)).not.toMatch(/latitude|longitude|rawTrail|observations/u);
  expect((await geoAudit(page)).active).toHaveLength(0);
  await panel.getByRole("button", { name: "Start test walk" }).click();
  await panel.getByRole("button", { name: "Stop test walk" }).click();
  await expect.poll(async () => (await geoAudit(page)).active.length).toBe(0);
  await panel.getByRole("button", { name: "Start test walk" }).click();
  await page.getByRole("combobox", { name: "Worldspace", exact: true }).selectOption("isles");
  await expect.poll(async () => (await geoAudit(page)).active.length).toBe(0);
  await page.getByRole("combobox", { name: "Worldspace", exact: true }).selectOption("town");
  await page.getByRole("complementary").getByRole("button", { name: "Town arrival", exact: true }).click();
  await context.setOffline(true);
  await panel.getByRole("button", { name: "Save walk receipt" }).click();
  await expect(panel).toContainText("No receipt was saved");
  expect(await db.landfallFieldTestReceipt.count({ where: { draftId: draft.id } })).toBe(1);
  await context.setOffline(false);
  await page
    .getByRole("complementary")
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("Edited synthetic arrival");
  await page.getByRole("complementary").getByRole("textbox", { name: "Name", exact: true }).press("Tab");
  await expect(panel.getByRole("button", { name: "Start test walk" })).toBeDisabled();
  await expect
    .poll(async () => (await db.taleDraft.findUniqueOrThrow({ where: { id: draft.id } })).autosaveVersion)
    .toBeGreaterThan(1);
  await expect(panel).toContainText("stale after draft edits");
  await expect(panel.getByRole("button", { name: "Start test walk" })).toBeEnabled();
  expect(
    (
      await new AxeBuilder({ page })
        .include(".landfall-workspace")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await expect(async () => {
    await panel.getByRole("button", { name: "Start test walk" }).focus();
    await expect(panel.getByRole("button", { name: "Start test walk" })).toBeFocused({ timeout: 250 });
  }).toPass({ timeout: 10_000 });
  await page.keyboard.press("Space");
  await expect.poll(async () => (await geoAudit(page)).active.length).toBe(1);
  await page.goto("/studio/library");
  await expect.poll(async () => (await geoAudit(page)).active.length).toBe(0);
  await page.goto(`/studio/tales/${tale.id}/landfall`);
  await page.getByRole("complementary").getByRole("button", { name: "Edited synthetic arrival", exact: true }).click();
  const cdp = await context.newCDPSession(page);
  const target = await cdp.send("Target.getTargetInfo");
  await cdp.send("Browser.setPermission", {
    permission: { name: "geolocation" },
    setting: "denied",
    origin: new URL(page.url()).origin,
    browserContextId: target.targetInfo.browserContextId,
  });
  await page
    .getByRole("region", { name: "Creator field test" })
    .getByRole("button", { name: "Start test walk" })
    .click();
  await expect(page.getByRole("region", { name: "Creator field test" })).toContainText(
    "Browser location is unavailable",
  );
  expect((await geoAudit(page)).active).toHaveLength(0);
  await context.close();
});

test("sign-out clears encrypted offline records and a different account cannot reopen them", async ({
  browser,
  baseURL,
}) => {
  const signer = await closureAccount("Offline cache signer");
  const other = await closureAccount("Offline cache other");
  const voyage = await closureVoyage(owner, signer);
  const context = await browser.newContext({ reducedMotion: "reduce" });
  await authenticateClosure(context, signer, baseURL!);
  const page = await context.newPage();
  await openClosureJournal(page, voyage.id);
  await cached(page);
  await page.getByRole("button", { name: "Offline cache signer", exact: true }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.waitForURL(baseURL! + "/");
  expect(
    await page.evaluate(() =>
      Object.keys(sessionStorage).filter((key) => key.startsWith("landfall-offline-lease-v2:")),
    ),
  ).toEqual([]);
  const count = await page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const request = indexedDB.open("landfall-offline-v2", 1);
        request.onsuccess = () => {
          const database = request.result;
          const count = database.transaction("records").objectStore("records").count();
          count.onsuccess = () => {
            resolve(count.result);
            database.close();
          };
          count.onerror = () => reject(count.error);
        };
        request.onerror = () => reject(request.error);
      }),
  );
  expect(count).toBe(0);
  await authenticateClosure(context, other, baseURL!);
  await page.goto(`/player/offline-landfall?session=${voyage.id}`);
  await expect(page.getByText(/No unexpired offline Voyage is available/u)).toBeVisible();
  await expect(chart(page)).toHaveCount(0);
  await context.close();
});

test("durable offline reload retains authorized chart and outbox, then reconciles exactly once", async ({
  browser,
  baseURL,
}) => {
  const voyage = await closureVoyage(owner, player, "waypointJourney");
  const context = await browser.newContext({ reducedMotion: "reduce" });
  await authenticateClosure(context, player, baseURL!);
  const page = await context.newPage();
  await openClosureJournal(page, voyage.id);
  await openClosureMap(page);
  await cached(page);
  await context.setOffline(true);
  await chart(page).getByRole("button", { name: "Confirm arrival myself" }).click();
  await expect(chart(page)).toContainText("Evidence queued durably");
  expect(await events(voyage.id, "landfallWaypointConfirmed")).toHaveLength(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Offline Voyage Journal" })).toBeVisible({ timeout: 30_000 });
  await expect(chart(page)).toContainText("Offline chart restored");
  await expect(chart(page)).toContainText("Pending evidence: 1");
  await expect(chart(page)).toContainText("Offline shell: prepared");
  await expect(chart(page).getByRole("list", { name: "Visible map locations" })).toContainText("Town arrival");
  await expect(page.locator('[data-landfall-feature="town-hidden"]')).toHaveCount(0);
  expect(await events(voyage.id, "landfallWaypointConfirmed")).toHaveLength(0);
  await context.setOffline(false);
  await expect
    .poll(async () => (await events(voyage.id, "landfallWaypointConfirmed")).length, { timeout: 30_000 })
    .toBe(1);
  await page.waitForURL(/\/journal/u);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  expect(await events(voyage.id, "landfallWaypointConfirmed")).toHaveLength(1);
  await context.close();
});

test("physical offline confidence stays local across reload until server requalification", async ({
  browser,
  baseURL,
}) => {
  const voyage = await closureVoyage(owner, player);
  const context = await browser.newContext({
    reducedMotion: "reduce",
    permissions: ["geolocation"],
    geolocation: { latitude: 44, longitude: -72, accuracy: 150 },
  });
  await authenticateClosure(context, player, baseURL!);
  await auditNativeGeolocation(context);
  const page = await context.newPage();
  await openClosureJournal(page, voyage.id);
  await cached(page);
  await chart(page).getByRole("button", { name: "Use my location", exact: true }).click();
  await expect.poll(async () => (await geoAudit(page)).nativeSamples).toBeGreaterThan(0);
  await context.setOffline(true);
  await qualifiedFollowUpFixes(page);
  await expect(chart(page)).toContainText("Evidence queued durably");
  expect(await events(voyage.id, "landfallWaypointConfirmed")).toHaveLength(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Offline Voyage Journal" })).toBeVisible();
  await expect(chart(page)).toContainText("Offline chart restored");
  expect((await geoAudit(page)).calls).toBe(0);
  await context.setOffline(false);
  await expect.poll(async () => (await events(voyage.id, "landfallWaypointConfirmed")).length).toBe(1);
  const arrival = (await events(voyage.id, "landfallWaypointConfirmed"))[0];
  expect(JSON.parse(arrival.payload).method).toBe("BROWSER_GEOLOCATION");
  expect(arrival.payload).not.toMatch(/latitude|longitude|observations/u);
  await context.close();
});

test("offline outbox drops stale sequence after reload and first-party virtual imagery remains usable offline", async ({
  browser,
  baseURL,
}) => {
  const voyage = await closureVoyage(owner, player, "livingChart", { captain: true, virtual: true, image: true });
  const context = await browser.newContext({ reducedMotion: "reduce" });
  await authenticateClosure(context, player, baseURL!);
  await auditNativeGeolocation(context);
  const page = await context.newPage();
  await openClosureJournal(page, voyage.id);
  await cached(page);
  await expect(chart(page)).toContainText("First-party map assets: ready");
  await context.setOffline(true);
  await chart(page).getByRole("button", { name: "Confirm arrival myself" }).click();
  await expect(chart(page)).toContainText("Evidence queued durably");
  const session = await db.taleSession.findUniqueOrThrow({ where: { id: voyage.id } });
  await captainLandfallCommand(voyage.id, owner.id, {
    action: "pause",
    expectedSequence: session.currentSequence,
    idempotencyKey: randomUUID(),
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Offline Voyage Journal" })).toBeVisible();
  await expect(chart(page).locator("image")).toBeVisible();
  const imageURL = await chart(page).locator("image").getAttribute("href");
  expect(imageURL).toMatch(/^blob:/u);
  expect(await page.evaluate(async (url) => (await fetch(url!)).ok, imageURL)).toBe(true);
  expect((await geoAudit(page)).calls).toBe(0);
  await context.setOffline(false);
  await expect
    .poll(async () => (await db.taleSession.findUniqueOrThrow({ where: { id: voyage.id } })).currentSequence)
    .toBe(session.currentSequence + 1);
  await page.waitForURL(/\/journal/u);
  expect(await events(voyage.id, "landfallWaypointConfirmed")).toHaveLength(0);
  await openClosureMap(page);
  await expect(chart(page)).toContainText("Captain paused");
  await context.close();
});

for (const viewport of [
  { width: 360, height: 640 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 1000 },
]) {
  test(`Player Chart is readable and keyboard accessible at ${viewport.width}x${viewport.height}`, async ({
    browser,
    baseURL,
  }) => {
    const voyage = await closureVoyage(owner, player, "livingChart", { virtual: true });
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
    await authenticateClosure(context, player, baseURL!);
    const page = await context.newPage();
    await openClosureJournal(page, voyage.id);
    await expect(chart(page)).toBeVisible();
    await expect(chart(page).getByRole("list", { name: "Visible map locations" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    const fallback = chart(page).getByRole("button", { name: "Confirm arrival myself" });
    await fallback.scrollIntoViewIfNeeded();
    const box = await fallback.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    const mapButton = page
      .getByRole("navigation", { name: "Journal tools" })
      .getByRole("button", { name: "map", exact: true });
    await mapButton.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".journal-objects-drawer [data-landfall-player-chart]")).toBeVisible();
    const results = await new AxeBuilder({ page })
      .include(".journal-objects-drawer")
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(results.violations).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(mapButton).toBeFocused();
    await page.emulateMedia({ forcedColors: "active" });
    await expect(fallback).toBeVisible();
    await page.addStyleTag({ content: "html { font-size: 200%; }" });
    const overflow = await page.evaluate(() => ({
      width: innerWidth,
      document: document.documentElement.scrollWidth,
      elements: Array.from(document.querySelectorAll("body *"))
        .flatMap((element) => {
          const rect = element.getBoundingClientRect();
          if (getComputedStyle(element).visibility !== "visible" || rect.right <= innerWidth + 1 || !rect.height)
            return [];
          return [
            {
              tag: element.tagName,
              class: element.className.toString(),
              right: Math.round(rect.right),
              width: Math.round(rect.width),
            },
          ];
        })
        .slice(0, 12),
    }));
    expect(overflow.document, JSON.stringify(overflow)).toBeLessThanOrEqual(overflow.width + 1);
    await expect(chart(page).getByRole("list", { name: "Visible map locations" })).toBeVisible();
    await context.close();
  });
}

test("completed livingChart is presentation-only, with no native location or canonical mutations", async ({
  browser,
  baseURL,
}) => {
  const voyage = await closureVoyage(owner, player, "livingChart", { captain: true });
  const session = await db.taleSession.findUniqueOrThrow({ where: { id: voyage.id } });
  await captainLandfallCommand(voyage.id, owner.id, {
    action: "confirmArrival",
    targetId: "town-arrival",
    expectedSequence: session.currentSequence,
    idempotencyKey: randomUUID(),
    reason: "Synthetic replay visit",
  });
  await interactWithTaleSession(voyage.id, undefined, { action: "continue", idempotencyKey: randomUUID() }, true);
  await interactWithTaleSession(voyage.id, undefined, { action: "continue", idempotencyKey: randomUUID() }, true);
  const before = await db.taleSessionEvent.count({ where: { sessionId: voyage.id } });
  const context = await browser.newContext({ reducedMotion: "reduce" });
  await authenticateClosure(context, player, baseURL!);
  await auditNativeGeolocation(context);
  const page = await context.newPage();
  await openClosureJournal(page, voyage.id);
  await openClosureMap(page);
  await expect(chart(page)).toContainText("Historical Landfall chart");
  const historical = await context.request.get(
    `/api/player/playthroughs/${voyage.id}/landfall?block=${voyage.activeId}`,
  );
  expect(historical.status()).toBe(200);
  const released = (await historical.json()).bootstrap;
  expect(released.replayOnly).toBe(true);
  const completed = await db.taleSessionEvent.findFirstOrThrow({
    where: { sessionId: voyage.id, blockId: voyage.activeId, eventType: "blockCompleted" },
  });
  expect(released.currentSequence).toBe(completed.sequence);
  expect(JSON.stringify(released)).not.toContain("town-hidden");
  expect(
    (await context.request.get(`/api/player/playthroughs/${voyage.id}/landfall?block=unreleased-chart`)).status(),
  ).toBe(404);
  await expect(chart(page).getByRole("button", { name: "Use my location" })).toHaveCount(0);
  await expect(chart(page).getByRole("button", { name: "Confirm arrival myself" })).toHaveCount(0);
  expect((await geoAudit(page)).calls).toBe(0);
  expect(await db.taleSessionEvent.count({ where: { sessionId: voyage.id } })).toBe(before);
  await context.close();
});

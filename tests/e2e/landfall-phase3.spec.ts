import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type TestInfo, type Locator } from "@playwright/test";
import { db } from "../../src/lib/db";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";
import {
  authenticateClosure,
  auditNativeGeolocation,
  closureAccount,
  closureVoyage,
  geoAudit,
  openClosureJournal,
  openClosureMap,
  type ClosureAccount,
} from "./fixtures/landfall-closure";
import { compactPosition, emitCompactFix, phase3Voyage, syntheticLandmarkCamera } from "./fixtures/landfall-phase3";

let owner: ClosureAccount;
let player: ClosureAccount;
test.describe.configure({ timeout: 180_000 });
test.use({ actionTimeout: 15_000 });
test.skip(({ browserName }) => browserName !== "chromium", "Owned mutable compact-site fixtures run once.");
test.beforeAll(async () => {
  ensureGenericSoundingLineIsolation();
  owner = await closureAccount("Phase3 compact-site Creator Captain");
  player = await closureAccount("Phase3 compact-site Player");
});
test.afterAll(async () => db.$disconnect());
const chart = (page: Page) => page.locator("[data-landfall-player-chart]:visible");
const events = (id: string, eventType: string) =>
  db.taleSessionEvent.findMany({ where: { sessionId: id, eventType }, orderBy: { sequence: "asc" } });
const block = (id: string) =>
  db.taleSession.findUniqueOrThrow({ where: { id } }).then((session) => session.currentBlockId);
async function ensureMap(page: Page) {
  if (!(await chart(page).isVisible())) await openClosureMap(page);
}
async function fixAt(page: Page, x: number, y: number) {
  await emitCompactFix(page, x, y);
  await emitCompactFix(page, x, y);
}
async function cameraAudit(page: Page) {
  return page.evaluate(
    () =>
      (
        window as unknown as {
          __landfallCameraAudit: { calls: number; stopped: number; frames: number; negative: boolean };
        }
      ).__landfallCameraAudit,
  );
}
async function capturePlayerView(page: Page, testInfo: TestInfo, name: string) {
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: false });
  await testInfo.attach(name, { path, contentType: "image/png" });
}

async function reachableDrawerControl(control: Locator) {
  // Scroll only the open map drawer: body scrolling can conceal overlap in a
  // full-page capture while a sticky objective still receives the pointer.
  await control.evaluate((element) => {
    const drawer = element.closest<HTMLElement>(".journal-objects-drawer")!;
    const box = element.getBoundingClientRect();
    const drawerBox = drawer.getBoundingClientRect();
    drawer.scrollTop += box.top - drawerBox.top - (drawer.clientHeight - box.height) / 2;
  });
  await expect
    .poll(() =>
      control.evaluate((element) => {
        const box = element.getBoundingClientRect();
        const drawer = element.closest<HTMLElement>(".journal-objects-drawer")!.getBoundingClientRect();
        const x = box.left + box.width / 2,
          y = box.top + box.height / 2;
        const hit = document.elementFromPoint(x, y);
        return {
          unobscured: hit === element || element.contains(hit),
          withinDrawer:
            x >= drawer.left &&
            x < Math.min(drawer.right, innerWidth) &&
            y >= Math.max(drawer.top, 0) &&
            y < Math.min(drawer.bottom, innerHeight),
          pointerTarget: hit?.tagName ?? "none",
        };
      }),
    )
    .toMatchObject({ unobscured: true, withinDrawer: true });
}

for (const viewport of [
  { width: 375, height: 812 },
  { width: 1280, height: 900 },
]) {
  test(`virtual v1.1 context preserves unavailable visual verification and canonical fallback at ${viewport.width}x${viewport.height}`, async ({
    browser,
    baseURL,
  }, testInfo) => {
    const voyage = await closureVoyage(owner, player, "waypointJourney", {
      virtual: true,
      image: true,
      contextual: true,
    });
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
    await authenticateClosure(context, player, baseURL!);
    await auditNativeGeolocation(context);
    await syntheticLandmarkCamera(context);
    const page = await context.newPage();
    await openClosureJournal(page, voyage.id);
    await openClosureMap(page);
    await expect(chart(page)).toHaveAttribute("data-worldspace-kind", "VIRTUAL");
    await expect(chart(page)).toContainText("No live game position is assumed");
    await expect(chart(page)).toContainText("Visual verification is not configured");
    await expect(chart(page).getByRole("button", { name: "Use my location" })).toHaveCount(0);
    await expect(chart(page).getByRole("button", { name: /compare.*landmark/i })).toHaveCount(0);
    await expect(chart(page).locator("image")).toBeVisible();
    const fallback = chart(page).getByRole("button", { name: "Confirm arrival myself" });
    await reachableDrawerControl(fallback);
    expect((await fallback.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(
      (
        await new AxeBuilder({ page })
          .include(".journal-objects-drawer")
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await capturePlayerView(page, testInfo, "virtual-context-fallback");
    await fallback.focus();
    await page.keyboard.press("Enter");
    await expect.poll(() => block(voyage.id)).toBe(voyage.nextId);
    const confirmed = await events(voyage.id, "landfallWaypointConfirmed");
    expect(confirmed).toHaveLength(1);
    expect(JSON.stringify(confirmed[0].payload)).toContain("PLAYER_CONFIRMATION");
    expect(JSON.stringify(confirmed[0].payload)).not.toMatch(/coordinate|frame|watchglassReceipt/);
    const replay = await context.request.get(`/api/player/playthroughs/${voyage.id}/landfall?block=${voyage.activeId}`);
    expect(replay.status()).toBe(200);
    expect((await replay.json()).bootstrap.replayOnly).toBe(true);
    expect((await geoAudit(page)).calls).toBe(0);
    expect((await cameraAudit(page)).calls).toBe(0);
    await context.close();
  });
}

test("museum journey keeps room inference honest, verifies multiple landmark frames, then requires the separate plaque answer", async ({
  browser,
  baseURL,
}, testInfo) => {
  const voyage = await phase3Voyage(owner, player);
  const context = await browser.newContext({
    reducedMotion: "reduce",
    permissions: ["geolocation"],
    geolocation: compactPosition(45, 0),
  });
  await authenticateClosure(context, player, baseURL!);
  await auditNativeGeolocation(context);
  await syntheticLandmarkCamera(context);
  const page = await context.newPage();
  await openClosureJournal(page, voyage.id);
  await openClosureMap(page);
  await expect(chart(page)).toContainText("Fictional Lantern Museum");
  await expect(chart(page)).toContainText("Local context: unavailable");
  expect((await geoAudit(page)).calls).toBe(0);
  await chart(page).getByRole("button", { name: "Use my location", exact: true }).click();
  await expect.poll(async () => (await geoAudit(page)).nativeSamples).toBeGreaterThan(0);
  await fixAt(page, 45, 0);
  await expect.poll(() => block(voyage.id)).toBe(voyage.ids["compact-door"]);
  await expect(chart(page)).toContainText("Current objective: Enter through the east entrance");
  await chart(page).getByRole("button", { name: "Confirm arrival myself" }).click();
  await expect.poll(() => block(voyage.id)).toBe(voyage.ids["compact-room"]);
  await expect(chart(page)).toContainText("Current objective: Continue along the gallery");
  await context.setGeolocation(compactPosition(-25, 10, 200));
  await chart(page).getByRole("button", { name: "Use my location", exact: true }).click();
  await expect(chart(page)).toContainText("accuracy is too weak");
  const beforeRoom = await events(voyage.id, "landfallWaypointConfirmed");
  expect(beforeRoom).toHaveLength(2);
  expect(await block(voyage.id)).toBe(voyage.ids["compact-room"]);
  await fixAt(page, -25, 10);
  await expect.poll(() => block(voyage.id)).toBe(voyage.ids["compact-landmark-target"]);
  const room = JSON.parse((await events(voyage.id, "landfallWaypointConfirmed"))[2].payload);
  expect(room.outcome).toBe("LIKELY_INSIDE");
  expect(room.contextualSummary.state).not.toBe("CONFIRMED");
  expect(JSON.stringify(room)).not.toMatch(/latitude|longitude|observations|frames|degrees/);
  await expect(chart(page)).toContainText("Current objective: Look for the Lantern mural");
  await expect(chart(page).getByRole("button", { name: "Open landmark camera" })).toBeDisabled();
  await context.setGeolocation(compactPosition(-25, 10));
  await chart(page).getByRole("button", { name: "Use my location", exact: true }).click();
  await fixAt(page, -25, 10);
  await expect(chart(page).getByRole("button", { name: "Open landmark camera" })).toBeEnabled();
  await expect(chart(page)).toContainText(/Local context: (likely|inferred|uncertain)/);
  await chart(page).getByLabel("Viewing map or floor").selectOption("compact-map-upper");
  await expect(chart(page)).toContainText("Viewing level Upper");
  await expect(chart(page)).toContainText("Choosing a map does not establish your location");
  await expect(chart(page)).not.toContainText("likely level Upper");
  await chart(page).getByRole("button", { name: "Open landmark camera" }).click();
  await expect(chart(page).getByRole("button", { name: "Compare landmark view" })).toBeEnabled();
  await chart(page).getByRole("region", { name: "Natural landmark" }).scrollIntoViewIfNeeded();
  await capturePlayerView(page, testInfo, "museum-context-camera-ready");
  const rejected = page.waitForResponse(
    (response) => response.url().endsWith(`/landfall/landmark`) && response.request().method() === "POST",
  );
  await chart(page).getByRole("button", { name: "Compare landmark view" }).click();
  expect((await (await rejected).json()).result).not.toBe("confirmed");
  expect(await block(voyage.id)).toBe(voyage.ids["compact-landmark-target"]);
  expect(await events(voyage.id, "landfallWaypointConfirmed")).toHaveLength(3);
  await page.evaluate(() => {
    (window as unknown as { __landfallCameraAudit: { negative: boolean } }).__landfallCameraAudit.negative = false;
  });
  await fixAt(page, -25, 10);
  const matched = page.waitForResponse(
    (response) => response.url().endsWith(`/landfall/landmark`) && response.request().method() === "POST",
  );
  await chart(page).getByRole("button", { name: "Compare landmark view" }).click();
  const match = await (await matched).json();
  expect(match).toMatchObject({ result: "confirmed", frameCount: 2 });
  expect(match.receipt).toEqual(expect.any(String));
  await expect.poll(() => block(voyage.id)).toBe(voyage.ids["compact-observation"]);
  expect((await cameraAudit(page)).frames).toBeGreaterThanOrEqual(4);
  expect((await cameraAudit(page)).stopped).toBeGreaterThan(0);
  const landmark = JSON.parse((await events(voyage.id, "landfallWaypointConfirmed"))[3].payload);
  expect(landmark.contextualSummary).toMatchObject({
    state: "CONFIRMED",
    landmarkId: "compact-mural",
    evidenceCategories: ["POSITION", "LANDMARK"],
  });
  expect(JSON.stringify(landmark)).not.toMatch(/frames|receipt|latitude|longitude/);
  await expect(chart(page)).toContainText("Current objective: Read the plaque beside the mural");
  await chart(page).getByRole("button", { name: "Use my location", exact: true }).click();
  await fixAt(page, -25, 10);
  await expect.poll(async () => (await events(voyage.id, "landfallWaypointConfirmed")).length).toBe(5);
  expect(await block(voyage.id)).toBe(voyage.ids["compact-observation"]);
  expect(await events(voyage.id, "landfallObservationResponded")).toHaveLength(0);
  const contextualArrival = JSON.parse((await events(voyage.id, "landfallWaypointConfirmed"))[4].payload);
  expect(contextualArrival).toMatchObject({ outcome: "LIKELY_INSIDE", contextualArrival: true });
  await page.keyboard.press("Escape");
  await page.getByLabel("Your answer", { exact: true }).fill("wrong word");
  await page.getByRole("button", { name: "Write answer", exact: true }).click();
  expect(await block(voyage.id)).toBe(voyage.ids["compact-observation"]);
  await page.getByLabel("Your answer", { exact: true }).fill("harbour");
  await page.getByRole("button", { name: "Write answer", exact: true }).click();
  await expect.poll(() => block(voyage.id)).toBe(voyage.nextId);
  expect(await events(voyage.id, "landfallObservationResponded")).toHaveLength(1);
  expect((await geoAudit(page)).active).toHaveLength(0);
  await context.close();
});

test("configured Captain landmark fallback records canonical context without claiming camera or coordinates", async ({
  browser,
  baseURL,
}) => {
  const voyage = await phase3Voyage(owner, player, { start: "landmark", captain: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await authenticateClosure(context, owner, baseURL!);
  const page = await context.newPage();
  await page.goto(`/captain/sessions/${voyage.id}`);
  await expect(page.getByLabel("Captain Landfall action")).toBeVisible({ timeout: 45_000 });
  await page.getByLabel("Captain Landfall action").selectOption("confirmArrival");
  await page.getByRole("combobox", { name: "Target", exact: true }).selectOption("compact-landmark-target");
  await page.getByRole("button", { name: "Review Landfall action" }).click();
  const review = page.getByRole("dialog", { name: "Confirm arrival without sensor evidence?" });
  await expect(
    review.getByRole("button", { name: "Confirm arrival without sensor evidence", exact: true }),
  ).toBeDisabled();
  await review.getByLabel("Captain reason").fill("Synthetic museum accessibility verification at the mural");
  await review.getByRole("button", { name: "Confirm arrival without sensor evidence", exact: true }).click();
  await expect.poll(() => block(voyage.id)).toBe(voyage.ids["compact-observation"]);
  const receipt = JSON.parse((await events(voyage.id, "landfallWaypointConfirmed"))[0].payload);
  expect(receipt.method).toBe("CAPTAIN_CONFIRMATION");
  expect(JSON.stringify(receipt)).not.toMatch(/latitude|longitude|frames|observations/);
  await expect(page.getByText(/Recorded context:/)).toBeVisible();
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

test("garden Player fallback and completed replay preserve regional history without restarting sensors", async ({
  browser,
  baseURL,
}) => {
  const voyage = await phase3Voyage(owner, player, { kind: "GARDEN", short: true });
  const context = await browser.newContext({ reducedMotion: "reduce" });
  await authenticateClosure(context, player, baseURL!);
  await auditNativeGeolocation(context);
  await syntheticLandmarkCamera(context);
  const page = await context.newPage();
  await openClosureJournal(page, voyage.id);
  await openClosureMap(page);
  await expect(chart(page)).toContainText("Fictional Lantern Garden");
  await expect(chart(page).getByLabel("Viewing map or floor")).toHaveCount(0);
  await chart(page).getByRole("button", { name: "Confirm arrival myself" }).click();
  await expect.poll(() => block(voyage.id)).toBe(voyage.nextId);
  const fallback = JSON.parse((await events(voyage.id, "landfallWaypointConfirmed"))[0].payload);
  expect(fallback.method).toBe("PLAYER_CONFIRMATION");
  expect(fallback.contextualSummary).toMatchObject({ fallbackUsed: true, evidenceCategories: ["PLAYER_CONFIRMATION"] });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Continue Voyage", exact: true }).click();
  await expect
    .poll(async () => (await db.taleSession.findUniqueOrThrow({ where: { id: voyage.id } })).status)
    .toBe("COMPLETED");
  const before = await db.taleSessionEvent.count({ where: { sessionId: voyage.id } });
  await ensureMap(page);
  await expect(chart(page)).toContainText("Historical Landfall chart");
  await chart(page).getByRole("button", { name: "Replay arrival", exact: true }).click();
  await expect(chart(page)).toContainText("Recorded context: confirmed");
  await expect(chart(page)).toContainText("Arrival used the configured fallback");
  await expect(chart(page).getByRole("button", { name: "Use my location", exact: true })).toHaveCount(0);
  await expect(chart(page).getByRole("button", { name: "Allow motion and heading hints" })).toHaveCount(0);
  expect((await geoAudit(page)).calls).toBe(0);
  expect((await cameraAudit(page)).calls).toBe(0);
  expect(await db.taleSessionEvent.count({ where: { sessionId: voyage.id } })).toBe(before);
  await context.close();
});

test("released first-party museum floor overlays restore offline without acquiring position", async ({
  browser,
  baseURL,
}) => {
  const voyage = await phase3Voyage(owner, player, { floorOverlays: true });
  const context = await browser.newContext({ reducedMotion: "reduce" });
  await authenticateClosure(context, player, baseURL!);
  await auditNativeGeolocation(context);
  const page = await context.newPage();
  await openClosureJournal(page, voyage.id);
  await openClosureMap(page);
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)), { timeout: 30_000 })
    .toBe(true);
  await expect(chart(page)).toContainText("Offline chart: saved", { timeout: 30_000 });
  await chart(page).getByLabel("Viewing map or floor").selectOption("compact-map-upper");
  await expect(chart(page)).toContainText("Viewed map offline: partial");
  await expect(chart(page)).toContainText("Overlay: Synthetic Upper floor map");
  await expect(chart(page)).toContainText("First-party map assets: ready");
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Offline Voyage Journal" })).toBeVisible();
  await expect(chart(page)).toContainText("Offline chart restored");
  await chart(page).getByLabel("Viewing map or floor").selectOption("compact-map-upper");
  await expect(chart(page)).toContainText("Viewing level Upper");
  await expect(chart(page)).toContainText("Overlay: Synthetic Upper floor map");
  await expect(chart(page)).toContainText("First-party map assets: ready");
  await expect(chart(page).getByRole("list", { name: "Visible map locations" })).toContainText("Upper gallery");
  expect((await geoAudit(page)).calls).toBe(0);
  expect(await events(voyage.id, "landfallWaypointConfirmed")).toHaveLength(0);
  await context.close();
});

for (const viewport of [
  { width: 360, height: 640 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 1000 },
]) {
  test(`context, landmark fallback and floor controls support keyboard and 200% text at ${viewport.width}x${viewport.height}`, async ({
    browser,
    baseURL,
  }, testInfo) => {
    const voyage = await phase3Voyage(owner, player, { start: "landmark" });
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
    await authenticateClosure(context, player, baseURL!);
    await auditNativeGeolocation(context);
    const page = await context.newPage();
    await openClosureJournal(page, voyage.id);
    const mapButton = page
      .getByRole("navigation", { name: "Journal tools" })
      .getByRole("button", { name: "map", exact: true });
    await mapButton.focus();
    await page.keyboard.press("Enter");
    await expect(chart(page)).toBeVisible();
    const floors = chart(page).getByLabel("Viewing map or floor");
    await floors.focus();
    await expect(floors).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(floors).toHaveValue("compact-map-upper");
    await expect(chart(page)).toContainText("Local context: unavailable");
    await expect(chart(page).getByRole("button", { name: "Open landmark camera" })).toBeDisabled();
    expect(
      (
        await new AxeBuilder({ page })
          .include(".journal-objects-drawer")
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await reachableDrawerControl(floors);
    await capturePlayerView(page, testInfo, `player-${viewport.width}x${viewport.height}-normal`);
    await page.emulateMedia({ forcedColors: "active" });
    await page.addStyleTag({ content: "html { font-size: 200%; }" });
    await expect(floors).toBeVisible();
    await expect(chart(page)).toContainText("Fallback:");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await reachableDrawerControl(floors);
    await floors.focus();
    await expect(floors).toBeFocused();
    await page.keyboard.press("Home");
    await expect(floors).toHaveValue("town-map");
    await page.keyboard.press("ArrowDown");
    await expect(floors).toHaveValue("compact-map-upper");
    await capturePlayerView(page, testInfo, `player-${viewport.width}x${viewport.height}-200pct-floor-controls`);
    const fallback = chart(page).getByRole("button", { name: "Confirm arrival myself" });
    await reachableDrawerControl(fallback);
    expect((await fallback.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await capturePlayerView(page, testInfo, `player-${viewport.width}x${viewport.height}-200pct-forced-colors`);
    if (viewport.width === 360) {
      await page.keyboard.press("Escape");
      await expect(mapButton).toBeFocused();
      const objectiveAction = page
        .locator(".chronicle-objective-tray")
        .getByRole("button", { name: "Continue Voyage", exact: true });
      for (let step = 0; step < 8; step++) {
        if (await objectiveAction.evaluate((element) => element === document.activeElement)) break;
        await page.keyboard.press("Tab");
      }
      await expect(objectiveAction).toBeFocused();
      await expect
        .poll(() =>
          objectiveAction.evaluate((element) => {
            const box = element.getBoundingClientRect();
            const tray = element.closest<HTMLElement>(".chronicle-objective-tray")!.getBoundingClientRect();
            const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
            return {
              fullyVisible:
                box.top >= Math.max(0, tray.top) - 1 &&
                box.bottom <= Math.min(innerHeight, tray.bottom) + 1 &&
                box.left >= Math.max(0, tray.left) - 1 &&
                box.right <= Math.min(innerWidth, tray.right) + 1,
              unobscured: hit === element || element.contains(hit),
            };
          }),
        )
        .toEqual({ fullyVisible: true, unobscured: true });
      await capturePlayerView(page, testInfo, "player-360x640-200pct-objective-action-focused");
      // Focus proves the internally scrolled action remains reachable. Arrival
      // evidence is still required, so do not activate Continue Voyage here.
      expect(await events(voyage.id, "landfallWaypointConfirmed")).toHaveLength(0);
      await mapButton.focus();
      await page.keyboard.press("Enter");
      await expect(chart(page)).toBeVisible();
      await reachableDrawerControl(fallback);
    }
    await fallback.focus();
    await expect(fallback).toBeFocused();
    await page.keyboard.press("Space");
    await expect.poll(() => block(voyage.id)).toBe(voyage.ids["compact-observation"]);
    const confirmed = JSON.parse((await events(voyage.id, "landfallWaypointConfirmed"))[0].payload);
    expect(confirmed).toMatchObject({ method: "PLAYER_CONFIRMATION", contextualSummary: { fallbackUsed: true } });
    await page.keyboard.press("Escape");
    await expect(mapButton).toBeFocused();
    expect((await geoAudit(page)).calls).toBe(0);
    await context.close();
  });
}

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { db } from "../../src/lib/db";
import { landfallFixture } from "../../src/landfall/fixtures";
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

let owner: ClosureAccount, player: ClosureAccount;
test.describe.configure({ timeout: 180_000 });
test.skip(({ browserName }) => browserName !== "chromium", "Owned mutable fixtures run once.");
test.beforeAll(async () => {
  ensureGenericSoundingLineIsolation();
  owner = await closureAccount("Phase4 synthetic Creator");
  player = await closureAccount("Phase4 synthetic Player");
});
test.afterAll(async () => db.$disconnect());

test("online background maps require a deliberate sharing choice and never write progression", async ({
  browser,
  baseURL,
}, testInfo) => {
  const definition = structuredClone(landfallFixture);
  definition.maps[0].source = { type: "BUILTIN_RASTER", providerId: "osm-standard", styleId: "standard" };
  const voyage = await closureVoyage(owner, player, "livingChart", { authoredDefinition: definition });
  const context = await browser.newContext({ viewport: { width: 375, height: 900 }, reducedMotion: "reduce" });
  const external: string[] = [];
  try {
    await authenticateClosure(context, player, baseURL!);
    await auditNativeGeolocation(context);
    await context.route("**/api/landfall/map-data", (route) =>
      route.fulfill({
        json: {
          state: "CONFIGURED",
          id: "deployment-raster",
          tileTemplate: "https://maps.example.org/{z}/{x}/{y}.png",
          attributionLabel: "Synthetic map license",
          attributionUrl: "https://maps.example.org/license",
          maxZoom: 18,
          offlineRights: "PROHIBITED",
        },
      }),
    );
    // Actual external services are never contacted by this hosted/browser fixture.
    await context.route("https://maps.example.org/**", (route) => {
      external.push("TILE_REQUEST");
      return route.abort();
    });
    const page = await context.newPage();
    await openClosureJournal(page, voyage.id);
    await openClosureMap(page);
    const chart = page.locator(".journal-objects-drawer [data-landfall-player-chart]");
    const load = chart.getByRole("button", { name: "Load online background maps", exact: true });
    await expect(load).toBeVisible();
    await expect(chart).toContainText("share the displayed map area with maps.example.org");
    expect(external).toEqual([]);
    const events = await db.taleSessionEvent.count({ where: { sessionId: voyage.id } });
    await load.click();
    await expect(chart.getByRole("link", { name: "Synthetic map license", exact: true })).toBeVisible();
    await chart.getByRole("button", { name: "Stop loading online background maps", exact: true }).click();
    await expect(load).toBeVisible();
    expect((await geoAudit(page)).calls).toBe(0);
    expect(await db.taleSessionEvent.count({ where: { sessionId: voyage.id } })).toBe(events);
    const screenshot = testInfo.outputPath("online-map-sharing-choice.png");
    await load.scrollIntoViewIfNeeded();
    await page.screenshot({ path: screenshot });
    await testInfo.attach("online-map-sharing-choice", { path: screenshot, contentType: "image/png" });
  } finally {
    await context.close();
  }
});

for (const virtual of [false, true])
  for (const width of [375, 1280]) {
    test(`released-place search only changes the view in ${virtual ? "VIRTUAL" : "PHYSICAL"} at ${width}px`, async ({
      browser,
      baseURL,
    }, testInfo) => {
      const voyage = await closureVoyage(owner, player, "livingChart", { virtual });
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
      try {
        await authenticateClosure(context, player, baseURL!);
        await auditNativeGeolocation(context);
        const page = await context.newPage();
        const mutations: string[] = [];
        page.on("request", (request) => {
          if (request.method() !== "GET" && /landfall/.test(new URL(request.url()).pathname))
            mutations.push(request.method());
        });
        await openClosureJournal(page, voyage.id);
        await openClosureMap(page);
        const chart = page.locator("[data-landfall-player-chart]:visible");
        const search = chart.getByRole("searchbox", { name: "Find a place on your released maps" });
        await expect(search).toBeVisible();
        expect((await search.boundingBox())?.height).toBeGreaterThanOrEqual(48);
        const baseline = await db.taleSession.findUniqueOrThrow({ where: { id: voyage.id } });
        const eventCount = await db.taleSessionEvent.count({ where: { sessionId: voyage.id } });
        const requestsBefore = mutations.length;
        await search.fill("Withheld destination");
        await expect(chart.getByRole("button", { name: /View Withheld destination/ })).toHaveCount(0);
        await search.fill(virtual ? "Secret Isle" : "Town arrival");
        const result = chart.getByRole("button", { name: virtual ? /View Secret Isle/ : /View Town arrival/ });
        await expect(result).toBeVisible();
        await result.focus();
        await page.keyboard.press("Enter");
        await expect(chart).toContainText("selected for viewing");
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        expect(
          (
            await new AxeBuilder({ page })
              .include('[aria-label="Search released places"]')
              .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
              .analyze()
          ).violations,
        ).toEqual([]);
        const shot = testInfo.outputPath("released-place-selected.png");
        await page.screenshot({ path: shot, fullPage: false });
        await testInfo.attach("released-place-selected", { path: shot, contentType: "image/png" });
        const preview = chart.locator('[aria-label="Landfall map preview"]');
        const renderedMap = preview.locator(
          virtual ? '[aria-label="Virtual Landfall chart"]' : '[aria-label="Physical Landfall map"]',
        );
        await renderedMap.scrollIntoViewIfNeeded();
        await expect(renderedMap).toBeVisible();
        expect(
          await renderedMap.evaluate((element) => {
            const box = element.getBoundingClientRect();
            const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
            return hit === element || (hit !== null && element.contains(hit));
          }),
        ).toBe(true);
        const mapShot = testInfo.outputPath("released-place-map.png");
        await page.screenshot({ path: mapShot, fullPage: false });
        await testInfo.attach("released-place-map", { path: mapShot, contentType: "image/png" });
        const selectedPlace = preview.locator('[aria-label="Visible map locations"] [data-selected="true"]');
        await selectedPlace.scrollIntoViewIfNeeded();
        await expect(selectedPlace).toContainText(virtual ? "Secret Isle" : "Town arrival");
        await expect(selectedPlace).toContainText("selected for viewing");
        await chart.getByRole("button", { name: "Clear place search" }).click();
        await expect(search).toHaveValue("");
        await expect(chart).not.toContainText("selected for viewing");
        expect((await geoAudit(page)).calls).toBe(0);
        expect(mutations.length).toBe(requestsBefore);
        expect(await db.taleSessionEvent.count({ where: { sessionId: voyage.id } })).toBe(eventCount);
        const after = await db.taleSession.findUniqueOrThrow({ where: { id: voyage.id } });
        expect(after.currentBlockId).toBe(baseline.currentBlockId);
        expect(after.currentSequence).toBe(baseline.currentSequence);
      } finally {
        await context.close();
      }
    });
  }

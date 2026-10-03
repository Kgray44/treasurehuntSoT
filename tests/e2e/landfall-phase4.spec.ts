import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
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

let owner: ClosureAccount, player: ClosureAccount;
test.describe.configure({ timeout: 180_000 });
test.skip(({ browserName }) => browserName !== "chromium", "Owned mutable fixtures run once.");
test.beforeAll(async () => {
  ensureGenericSoundingLineIsolation();
  owner = await closureAccount("Phase4 synthetic Creator");
  player = await closureAccount("Phase4 synthetic Player");
});
test.afterAll(async () => db.$disconnect());

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
